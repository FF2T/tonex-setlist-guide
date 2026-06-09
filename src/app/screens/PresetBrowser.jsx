// src/app/screens/PresetBrowser.jsx — Phase 7.17 (découpage main.jsx).
//
// Explorateur de presets : recherche, profils sonores, navigation par
// ampli (brand → family → preset). Affiche une fiche détaillée pour
// chaque preset sélectionné via PresetDetailInline (co-localisé).
//
// PresetDetailInline est également importé par JamScreen.jsx pour
// afficher le détail d'un preset jam-pick.

import React, { useState, useMemo, useEffect } from 'react';
import { t, tFormat, tPlural, useLocale, getLocale } from '../../i18n/index.js';
import { GUITARS } from '../../core/guitars.js';
import { normalizePresetName, findCatalogEntry, isBassPreset } from '../../core/catalog.js';
import NavIcon from '../components/NavIcon.jsx';
import { SOURCE_LABELS } from '../../core/sources.js';
import { cleanUsages } from './ToneNetTab.jsx';
import {
  computePickupScore, computeGuitarScoreV2, getGainRange, gainToNumeric,
} from '../../core/scoring/index.js';
import { findGuitarProfile } from '../../core/scoring/guitar.js';
import { bucketizeScore, groupByBucket, COMPAT_LEVELS } from '../../core/scoring/compat-buckets.js';
import { PRESET_CATALOG_FULL } from '../../data/preset_catalog_full.js';
import { TYPO, WEIGHT, TEXT_1, TEXT_2, TEXT_3, BG_1, BG_2, BORDER_SUBTLE, BORDER_STRONG, tile as tileStyle, chip as chipStyle } from '../styles/tokens.js';
import {
  PRESET_CATALOG, FACTORY_CATALOG, PLUG_FACTORY_CATALOG, TSR_PACK_CATALOG,
  ANNIVERSARY_CATALOG,
} from '../../data/data_catalogs.js';
import { PRESET_CONTEXT } from '../../data/data_context.js';
import { findInBanks, buildBankIndex, lookupBankIndex } from '../utils/preset-helpers.js';

const PRESET_PAGE_SIZE = 30;

// Résout un nom d'ampli vers son entrée PRESET_CONTEXT (info enrichie :
// émoji, refs artistes/morceaux, description). Tolère les noms volontairement
// déformés (trademark avoidance) via une table d'alias, les combos
// "Ampli + Pédale", et un fallback fuzzy par substring.
function findAmpContext(ampName, ctxMap) {
  if (!ampName) return null;
  const ctx = ctxMap || PRESET_CONTEXT;
  if (ctx[ampName]) return ctx[ampName];
  const ALIASES = {
    'Cornfield Harle': 'Cornford Harlequin',
    'Reinguard T-36': 'Reinhardt RT-36',
    'Diesel Humbert': 'Diezel Herbert',
    'Electro Dime': 'Electro-Harmonix',
    'Chandler GAV19T': 'Benson Chimera',
    'Chandler 19T': 'Benson Chimera',
    'Bumble Deluxe': 'Dumble Deluxe',
    'Rouge Plate D50': 'Dr. Z',
    'Sons Amplification': 'Sons Amp',
    'Mega Barba': 'Mesa Boogie',
    'Ample Betty': 'Supro',
    'Amplified Nation Overdrive Reverb': 'Dumble ODS',
    'Amplified Nation Wonderland Overdrive': 'Dumble ODS',
    'Bogner Goldfinger': 'Bogner G-Finger',
    'Dumble Overdrive Deluxe': 'Dumble Deluxe',
    'Mega Amp': 'Mesa Boogie',
    'Synergy SYN-30': 'Fender Champ',
    'Suhr PT-100 / 2864-S': 'Marshall Plexi',
    'Divers British': 'Marshall Plexi',
    'Divers basse': 'Ampeg SVT',
    'Divided by 13': 'Divided by 13',
    'Pédales de drive': 'Drive Pedals',
  };
  if (ALIASES[ampName] && ctx[ALIASES[ampName]]) return ctx[ALIASES[ampName]];
  if (ampName.includes(' + ')) {
    const baseAmp = ampName.split(' + ')[0].trim();
    const baseCtx = findAmpContext(baseAmp, ctx);
    if (baseCtx) return baseCtx;
  }
  const norm = ampName.replace(/\s+/g, ' ').trim();
  const variations = [
    norm.replace('Mesa Boogie ', 'Mesa '),
    norm.replace('Mesa ', 'Mesa Boogie '),
    norm.replace('Marshall ', 'Mars '),
    norm.replace('Mars ', 'Marshall '),
    norm.replace('Fender ', 'FNDR '),
    norm.replace('FNDR ', 'Fender '),
  ];
  for (const v of variations) { if (ctx[v]) return ctx[v]; }
  const lower = norm.toLowerCase();
  for (const [k, v] of Object.entries(ctx)) {
    if (k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) return v;
  }
  return null;
}

// Fiche détaillée d'un preset : infos ampli, style/gain, morceaux
// mythiques filtrés par registre de gain (clean/heavy tracks), guitares
// Phase 7.79.2 — Section "🎯 Usages curés" inline avec édition toggle.
// Affiche les usages [{artist, songs?}] du catalog entry. Bouton
// "✏️ Modifier" (admin only sur custom/ToneNET) bascule en mode édition
// inline directement dans le drawer (pas de modale). Bouton "💡 Reprendre
// les morceaux mythiques de l'ampli" copie les refs ampli (déjà filtrés
// par gain) dans le form en 1 clic pour curation rapide.
//
// Props :
//   - presetName: string
//   - ampRefs: [{a, t}] refs ampli depuis findAmpContext (filtrés par gain)
//   - isAdmin: boolean
//   - songDb: songs[] pour datalist artist+song
//   - onSaveUsages: (presetName, usages|undefined) => void
//     usages=undefined ⇒ retirer le champ usages (custom/ToneNET) ou écrire
//     { usages: null } (catalog statique = override vide explicite).
//     Si non fourni (callers JamScreen, etc.), le composant reste en mode
//     lecture seule (pas de bouton Modifier).
//   - onRemoveOverride: (presetName) => void (Phase 7.79.3b)
//     Pour retirer un override de la cascade et reprendre le niveau suivant.
//     Disponible uniquement quand entry._usagesSource ∈ {'user', 'backline'}.
//
// Phase 7.79.3b — édition étendue à TOUS les catalog non-guessed :
//   - custom/ToneNET : édition perso comme avant (Phase 7.79.2)
//   - catalog statique (TSR/AA/JS/...) :
//     - non-admin → écrit dans profile.usagesOverrides (visible user seul)
//     - admin → écrit dans shared.usagesOverrides (visible tous users)
//   - guessed=true (preset inconnu) → pas éditable (saveUsagesForPreset no-op)
function UsagesSection({ presetName, ampRefs, isAdmin, songDb, onSaveUsages, onRemoveOverride, sectionStyle, sectionTitle }) {
  const entry = useMemo(() => findCatalogEntry(presetName), [presetName]);
  // Phase 7.79.3b — éditable pour TOUTES les sources non-guessed.
  // Le routing user/admin est géré côté saveUsagesForPreset (Phase 7.79.3b).
  const editable = !!entry && !entry.guessed && typeof onSaveUsages === 'function';
  const existingUsages = Array.isArray(entry?.usages) ? entry.usages : [];
  // Phase 7.79.3b — source de cascade pour affichage badge + condition Restaurer.
  const usagesSource = entry?._usagesSource || null;
  const usagesCuratedBy = entry?._usagesCuratedBy || null;
  // Bouton "Restaurer" disponible si l'user voit son propre override
  // ('user' visible que par lui) ou si admin voit un override Backline.
  const canRemoveOverride = !!entry && !entry.guessed && typeof onRemoveOverride === 'function' &&
    (usagesSource === 'user' || (usagesSource === 'backline' && isAdmin));
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => existingUsages.map((u) => ({
    artist: u.artist || '',
    songs: Array.isArray(u.songs) ? [...u.songs] : [],
  })));
  const [songDrafts, setSongDrafts] = useState({});

  // Reset draft si on switch de preset
  useEffect(() => {
    setIsEditing(false);
    setDraft(existingUsages.map((u) => ({
      artist: u.artist || '',
      songs: Array.isArray(u.songs) ? [...u.songs] : [],
    })));
    setSongDrafts({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetName]);

  const artistList = useMemo(() => {
    const set = new Set();
    (songDb || []).forEach((s) => { if (s.artist) set.add(s.artist); });
    return Array.from(set).sort();
  }, [songDb]);

  const songList = useMemo(() => {
    const set = new Set();
    (songDb || []).forEach((s) => { if (s.title) set.add(s.title); });
    return Array.from(set).sort();
  }, [songDb]);

  const fillFromAmpRefs = () => {
    if (!Array.isArray(ampRefs) || ampRefs.length === 0) return;
    // Fusionne ampRefs ({a, t}) avec draft existant ({artist, songs}).
    // Si artist déjà présent, merge les songs sans doublon.
    setDraft((prev) => {
      const byArtist = new Map(prev.map((u) => [u.artist, u]));
      ampRefs.forEach((r) => {
        const a = r.a || '';
        if (!a) return;
        const existing = byArtist.get(a);
        const newSongs = Array.isArray(r.t) ? r.t : [];
        if (existing) {
          byArtist.set(a, { artist: a, songs: Array.from(new Set([...(existing.songs || []), ...newSongs])) });
        } else {
          byArtist.set(a, { artist: a, songs: [...newSongs] });
        }
      });
      return Array.from(byArtist.values());
    });
  };

  const flushDrafts = (raw) => raw.map((u, idx) => {
    const dr = (songDrafts[idx] || '').trim();
    if (!dr) return u;
    return { ...u, songs: Array.from(new Set([...(u.songs || []), dr])) };
  });

  const handleSave = () => {
    const flushed = flushDrafts(draft);
    const cleaned = cleanUsages(flushed);
    onSaveUsages(presetName, cleaned);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(existingUsages.map((u) => ({
      artist: u.artist || '',
      songs: Array.isArray(u.songs) ? [...u.songs] : [],
    })));
    setSongDrafts({});
    setIsEditing(false);
  };

  // Si pas d'usages ET pas éditable → ne rien afficher (section inutile)
  if (existingUsages.length === 0 && !editable) return null;

  const inp = {
    background: 'var(--bg-elev-1)', color: 'var(--text)',
    border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)',
    padding: '4px 6px', flex: 1, fontSize: 12,
  };

  // Phase 7.79.3b — Badge source de la cascade. Helper inline pour
  // éviter de surcharger l'export i18n.
  const renderSourceBadge = () => {
    if (!usagesSource || usagesSource === 'default') return null;
    const labels = {
      user: { label: t('cascade.source-user', 'Toi'), color: '#7dd3fc', bg: 'rgba(125,211,252,0.15)' },
      studio: { label: usagesCuratedBy ? tFormat('cascade.source-studio-by', { studio: usagesCuratedBy }, 'Studio ({studio})') : t('cascade.source-studio', 'Studio'), color: '#1e40af', bg: 'rgba(30,64,175,0.15)' },
      backline: { label: t('cascade.source-backline', 'Backline'), color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    };
    const lvl = labels[usagesSource];
    if (!lvl) return null;
    return (
      <span
        title={t(`cascade.source-${usagesSource}-tooltip`, '')}
        style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-sm)', color: lvl.color, background: lvl.bg, display: 'inline-flex', alignItems: 'center', gap: 3 }}
      >
        {lvl.label}
      </span>
    );
  };

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        {sectionTitle(<NavIcon id="target" size={13}/>, t('usages.section', 'Usages curés (preset)'))}
        {renderSourceBadge()}
      </div>
      {!isEditing && (
        <>
          {existingUsages.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('usages.empty', 'Aucun usage artiste/morceau enregistré.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {existingUsages.map((u, idx) => (
                <div key={idx} style={{ fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>• {u.artist}</span>
                  {Array.isArray(u.songs) && u.songs.length > 0 && (
                    <span style={{ color: 'var(--text-dim)' }}> — {u.songs.join(', ')}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Phase 7.79.3b — Boutons d'action : Modifier + Restaurer (si applicable) */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {editable && (
              <button
                onClick={() => setIsEditing(true)}
                style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
              >
                {existingUsages.length === 0 ? t('usages.curate', 'Curer ce preset') : t('usages.edit', 'Modifier ces usages')}
              </button>
            )}
            {canRemoveOverride && (
              <button
                onClick={() => onRemoveOverride(presetName)}
                title={t('cascade.restore-tooltip', 'Retire ton override et reprend le niveau de cascade suivant (Backline ou Catalog).')}
                style={{ background: 'var(--a7)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
              >
                {t('cascade.restore', 'Restaurer la version par défaut')}
              </button>
            )}
          </div>
        </>
      )}
      {isEditing && (
        <>
          {/* Phase 7.79.3b — hint adapté selon entry.src + isAdmin pour informer
              clairement l'user où sera persisté son override. */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
            {entry.src === 'custom'
              ? t('usages.edit-hint-custom', 'Persisté dans tes presets persos (profile.customPacks).')
              : entry.src === 'ToneNET'
              ? t('usages.edit-hint-tonenet', 'Persisté dans le catalog ToneNET partagé (shared.toneNetPresets).')
              : isAdmin
              ? t('cascade.edit-hint-admin', 'Persisté dans le catalog Backline partagé (visible par tous les profils, niveau cascade 3).')
              : t('cascade.edit-hint-user', 'Persisté dans ton override perso (visible uniquement par toi, prioritaire sur les niveaux Backline et Catalog).')}
          </div>
          {Array.isArray(ampRefs) && ampRefs.length > 0 && (
            <button
              onClick={fillFromAmpRefs}
              style={{ marginBottom: 8, background: 'rgba(218,165,32,0.15)', border: '1px solid rgba(218,165,32,0.4)', color: 'var(--brass-300)', borderRadius: 'var(--r-sm)', padding: '5px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
              title={t('usages.fill-from-amp-hint', 'Copie les artistes/morceaux mythiques de l\'ampli (filtrés par gain) dans ton form. Tu peux ensuite ajuster.')}
            >
              💡 {tFormat('usages.fill-from-amp', { n: ampRefs.length }, 'Reprendre les morceaux mythiques de l\'ampli ({n} artistes)')}
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {draft.map((u, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--a3)', borderRadius: 'var(--r-sm)', padding: 6 }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    placeholder={t('usages.artist', 'Artiste')}
                    list="usages-artist-dl"
                    value={u.artist}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft((prev) => prev.map((x, i) => i === idx ? { ...x, artist: v } : x));
                    }}
                    style={inp}
                  />
                  <button
                    type="button"
                    onClick={() => { setDraft((prev) => prev.filter((_, i) => i !== idx)); setSongDrafts({}); }}
                    style={{ background: 'var(--red-bg)', border: 'none', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: 10, color: 'var(--danger, #ef4444)', cursor: 'pointer' }}
                  >✕</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  {(u.songs || []).map((song, si) => (
                    <span key={si} style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-sm)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      {song}
                      <button
                        type="button"
                        onClick={() => setDraft((prev) => prev.map((x, i) => i === idx ? { ...x, songs: (x.songs || []).filter((_, j) => j !== si) } : x))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 10, cursor: 'pointer', padding: 0 }}
                      >×</button>
                    </span>
                  ))}
                  <input
                    placeholder={t('usages.song-add', '+ Morceau (Enter)')}
                    list="usages-song-dl"
                    value={songDrafts[idx] || ''}
                    onChange={(e) => setSongDrafts((prev) => ({ ...prev, [idx]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = (songDrafts[idx] || '').trim();
                        if (!v) return;
                        setDraft((prev) => prev.map((x, i) => i === idx ? { ...x, songs: Array.from(new Set([...(x.songs || []), v])) } : x));
                        setSongDrafts((prev) => ({ ...prev, [idx]: '' }));
                      }
                    }}
                    style={{ ...inp, flex: 1, minWidth: 110, fontSize: 11 }}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDraft((prev) => [...prev, { artist: '', songs: [] }])}
              style={{ background: 'transparent', border: '1px dashed var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: 6, fontSize: 11, cursor: 'pointer', width: '100%' }}
            >+ {t('usages.add-artist', 'Ajouter un artiste')}</button>
          </div>
          <datalist id="usages-artist-dl">
            {artistList.map((a) => <option key={a} value={a}/>)}
          </datalist>
          <datalist id="usages-song-dl">
            {songList.map((s) => <option key={s} value={s}/>)}
          </datalist>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={handleCancel} style={{ flex: 1, background: 'var(--a7)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {t('usages.cancel', 'Annuler')}
            </button>
            <button onClick={handleSave} style={{ flex: 2, background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-sm)', padding: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {t('usages.save', 'Enregistrer →')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// adaptées scorées par computePickupScore + computeGuitarScoreV2.
// Utilisé par PresetBrowser (via PresetList) et JamScreen (via JamPresetItem).
function PresetDetailInline({ name, info, banksAnn, banksPlug, presetContext, guitars, isAdmin, songDb, onSaveUsages }) {
  const ctx = findAmpContext(info.amp, presetContext || PRESET_CONTEXT);
  const annLoc = findInBanks(name, banksAnn);
  const plugLoc = findInBanks(name, banksPlug);
  const allGuitars = guitars || GUITARS;
  const sectionStyle = { background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: '10px 12px', marginBottom: 8 };
  // Vague 3 emojis — icon peut être JSX (NavIcon) ou null. Si null,
  // pas d'espace parasite (gap flex géré conditionnellement).
  const sectionTitle = (icon, label) => <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: icon ? 5 : 0 }}>{icon}<span>{label}</span></div>;
  const STYLE_LABELS = {
    blues: t('preset-detail.style.blues', 'Blues'),
    rock: t('preset-detail.style.rock', 'Rock'),
    hard_rock: t('preset-detail.style.hard-rock', 'Hard Rock'),
    jazz: t('preset-detail.style.jazz', 'Jazz'),
    metal: t('preset-detail.style.metal', 'Metal'),
    pop: t('preset-detail.style.pop', 'Pop'),
  };
  const GAIN_LABELS = {
    low: t('preset-detail.gain.low', 'Low gain — Clean / Edge of breakup'),
    mid: t('preset-detail.gain.mid', 'Mid gain — Crunch / Drive'),
    high: t('preset-detail.gain.high', 'High gain — Lead / Saturé'),
  };
  const GAIN_SHORT = {
    low: t('preset-detail.gain-short.low', 'Clean'),
    mid: t('preset-detail.gain-short.mid', 'Crunch / Drive'),
    high: t('preset-detail.gain-short.high', 'Lead / High gain'),
  };
  const GAIN_STYLES = {
    low: { primary: ['blues', 'jazz', 'pop', 'rock'], desc: t('preset-detail.gain-desc.low', 'Son clean : idéal pour blues, jazz, pop, rock rythmique') },
    mid: { primary: ['rock', 'blues', 'hard_rock'], desc: t('preset-detail.gain-desc.mid', 'Son crunch/drive : idéal pour rock, blues-rock, hard rock') },
    high: { primary: ['hard_rock', 'metal', 'rock'], desc: t('preset-detail.gain-desc.high', 'Son saturé : idéal pour hard rock, metal, rock lead') },
  };
  const gainStyles = GAIN_STYLES[info.gain] || GAIN_STYLES.mid;
  const CLEAN_TRACKS = ['gravity', 'waiting on the world', 'sultans of swing', 'romeo', 'juliet', 'wonderful tonight', 'tears in heaven', 'blackbird', 'dust in the wind', 'stairway', 'hotel california intro', 'wish you were here', 'under the bridge', 'hallelujah', 'the thrill is gone', 'truckin'];
  const HEAVY_TRACKS = ['money for nothing', 'paranoid', 'back in black', 'highway to hell', 'thunderstruck', 'smoke on the water', 'purple haze', 'whole lotta love', 'eruption', 'master of puppets', 'enter sandman', 'schism', 'b.y.o.b.', 'ace of spades', 'crazy train', 'iron man'];
  const filterRefs = (refs) => {
    if (!refs || refs.length === 0) return refs;
    const gain = info.gain;
    let filtered = refs.map((r) => {
      if (!r.t || r.t.length === 0) return r;
      const tracks = r.t.filter((t) => {
        const tl = t.toLowerCase();
        if (gain === 'low') return !HEAVY_TRACKS.some((h) => tl.includes(h));
        if (gain === 'high') return !CLEAN_TRACKS.some((c) => tl.includes(c));
        return true;
      });
      return { ...r, t: tracks };
    });
    filtered = filtered.filter((r) => r.t.length > 0 || (refs.find((o) => o.a === r.a)?.t || []).length === 0);
    return filtered.length > 0 ? filtered : refs;
  };
  const nameLower = name.toLowerCase();
  const presetChar =
    (/\bclean\b|\bclr\b|\bcln\b/i.test(nameLower)) ? t('preset-detail.char.clean', 'Clean — Son clair, dynamique, expressif')
      : (/\bedge\b|\beob\b|\bbreakup\b/i.test(nameLower)) ? t('preset-detail.char.edge', 'Edge of breakup — À la limite de la saturation, très dynamique')
        : (/\bcrunch\b|\bgrit\b/i.test(nameLower)) ? t('preset-detail.char.crunch', 'Crunch — Saturation légère, réactif au toucher')
          : (/\bdrive\b|\bod\b|\boverdrive\b/i.test(nameLower)) ? t('preset-detail.char.drive', 'Drive — Saturation moyenne, sustain musical')
            : (/\blead\b|\bsolo\b/i.test(nameLower)) ? t('preset-detail.char.lead', 'Lead — Saturation prononcée, sustain long pour solos')
              : (/\bhigh.?gain\b|\bfull.?beans\b|\bdimed\b|\bmax\b/i.test(nameLower)) ? t('preset-detail.char.high-gain', 'High gain — Saturation maximale, mur de son')
                : (/\bboost\b|\bklon\b|\bts\b|\btube.?screamer\b|\brodent\b|\bmuff\b|\bfuzz\b/i.test(nameLower)) ? t('preset-detail.char.boost', 'Boost / Pédale — Son avec pédale de drive en amont')
                  : null;
  const filteredRefs = filterRefs(ctx?.refs);
  const guitarScores = allGuitars.map((g) => {
    const sc = computePickupScore(info.style, getGainRange(gainToNumeric(info.gain)), g.type);
    const gs = computeGuitarScoreV2(g.id, info.style, getGainRange(gainToNumeric(info.gain)), info.voicing);
    const combined = Math.round(sc * 0.6 + gs * 0.4);
    return { id: g.id, name: g.short || g.name, type: g.type, score: combined };
  }).sort((a, b) => b.score - a.score);
  return (
    <div style={{ background: 'var(--bg-elev-1)', border: '1px solid var(--a7)', borderRadius: '0 0 9px 9px', padding: 12, marginTop: -1, animation: 'slideDown .2s ease-out', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={sectionStyle}>
        {sectionTitle(null, t('preset-detail.section.amp-info', 'Infos ampli / preset'))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 2 }}>{info.amp}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{name}{info.channel ? ' · ' + info.channel : ''}</div>
          </div>
        </div>
        {presetChar && <div style={{ fontSize: 11, color: 'var(--text-sec)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 6, fontWeight: 500 }}>{presetChar}</div>}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
          {info.src && <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '2px 6px', fontWeight: 600 }}>{SOURCE_LABELS[info.src] || info.src}</span>}
          {info.cab && <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '2px 6px' }}>🔈 {info.cab}</span>}
          {info.pack && <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '2px 6px' }}>{info.pack}</span>}
          {/* Phase 7.84 — span ZIP brut TSR_PACK_ZIPS retiré (redondant avec info.pack, paraissait plomberie au visiteur). */}
        </div>
        {info.comment && <div style={{ fontSize: 10, color: 'var(--text-sec)', fontStyle: 'italic', marginBottom: 6 }}>{info.comment}</div>}
        {(() => {
          // Phase 7.84 — Si locale EN et desc_en disponible, l'utiliser. Sinon fallback FR.
          // Dette : desc_en absent pour la majorité des amplis (~167), à compléter progressivement.
          // ES reste FR-fallback (dette explicite Phase 7.84).
          const loc = getLocale();
          const desc = (loc === 'en' && ctx?.desc_en) ? ctx.desc_en : ctx?.desc;
          if (desc) return <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5 }}>{desc}</div>;
          return <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>{t('preset-browser.no-desc', 'Pas de description disponible pour cet ampli.')}</div>;
        })()}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          {annLoc
            ? <span style={{ fontSize: 10, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-md)', padding: '3px 8px', fontWeight: 600 }}>{tFormat('preset-detail.installed-pedal-flat', { bank: annLoc.bank, slot: annLoc.slot }, 'Pédale — Banque {bank}{slot}')}</span>
            : <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '3px 8px' }}>{t('preset-detail.not-installed-pedal', 'Pédale — non installé')}</span>}
          {plugLoc
            ? <span style={{ fontSize: 10, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-md)', padding: '3px 8px', fontWeight: 600 }}>{tFormat('preset-detail.installed-plug-flat', { bank: plugLoc.bank, slot: plugLoc.slot }, 'Plug — Banque {bank}{slot}')}</span>
            : <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '3px 8px' }}>{t('preset-detail.not-installed-plug', 'Plug — non installé')}</span>}
        </div>
      </div>
      <div style={sectionStyle}>
        {sectionTitle(<NavIcon id="sliders" size={13}/>, t('preset-detail.section.style-gain', 'Style & gain'))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-sec)' }}><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('preset-browser.gain', 'Gain')}</span> <span style={{ fontWeight: 600 }}>{GAIN_LABELS[info.gain] || info.gain}</span></div>
          <div style={{ fontSize: 11, color: 'var(--text-sec)' }}><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('preset-browser.style', 'Style catalogue')}</span> <span style={{ fontWeight: 600 }}>{STYLE_LABELS[info.style] || info.style}</span></div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{gainStyles.desc}</div>
        </div>
      </div>
      {filteredRefs && filteredRefs.length > 0 && (
        <div style={sectionStyle}>
          {sectionTitle(null, tFormat('preset-detail.section.iconic-songs', { register: GAIN_SHORT[info.gain] }, 'Morceaux mythiques — registre {register}'))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {filteredRefs.map((r) => (
              <div key={r.a} style={{ fontSize: 11, color: 'var(--text-sec)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{r.a}</span>
                {r.t.length > 0 && <span style={{ color: 'var(--text-dim)' }}> — {r.t.join(', ')}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Phase 7.79.2 — Section usages curés + édition inline */}
      <UsagesSection
        presetName={name}
        ampRefs={filteredRefs}
        isAdmin={isAdmin}
        songDb={songDb}
        onSaveUsages={onSaveUsages}
        sectionStyle={sectionStyle}
        sectionTitle={sectionTitle}
      />
      {/* Phase 8.9 — Masquer section "Guitares adaptées" pour les
          presets bass : non-sensique d'afficher des guitares pour un
          preset BS B15, Bass Elliot, etc. Phase ultérieure pourra
          ajouter une section "Basses adaptées" symétrique. */}
      {!isBassPreset(name, info) && (
      <div style={sectionStyle}>
        {sectionTitle(<NavIcon id="guitar" size={13}/>, t('preset-detail.section.suitable-guitars', 'Guitares adaptées'))}
        {/* Phase 7.83 — Buckets qualitatifs 3 niveaux (Mariage parfait / Bon match / Compromis)
            au lieu de scores % bruts. Le % reste accessible via title HTML pour power-users. */}
        {(() => {
          const grouped = groupByBucket(guitarScores);
          const BUCKET_LABELS = {
            ideal: t('compat.ideal-match-flat', 'Mariage parfait'),
            good: t('compat.good-match-flat', 'Bon match'),
            compromise: t('compat.compromise-flat', 'Compromis'),
          };
          const sectionsToRender = ['ideal', 'good', 'compromise'].filter((k) => grouped[k].length > 0);
          if (sectionsToRender.length === 0) return null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sectionsToRender.map((key) => {
                const lvl = COMPAT_LEVELS[key];
                return (
                  <div key={key}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: lvl.color, marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>
                      {BUCKET_LABELS[key]} <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>({grouped[key].length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {grouped[key].map((g) => (
                        <div
                          key={g.id}
                          title={tFormat('compat.score-tooltip', { score: g.score }, 'Score : {score}%')}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}
                        >
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: lvl.color, flexShrink: 0 }}/>
                          <span style={{ fontWeight: 600, color: 'var(--text-bright)', flex: 1 }}>
                            {g.name}
                          </span>
                          <div style={{ width: 60, height: 4, background: 'var(--a8)', borderRadius: 'var(--r-xs)', overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${g.score}%`, height: '100%', background: lvl.color, borderRadius: 'var(--r-xs)' }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
      )}
    </div>
  );
}

function PresetList({ filtered, selected, setSelected, banksAnn, banksPlug, fullCatalog, filterSrcs, filterPacks, togglePack, setFilterPacks, mergedContext, guitars, isAdmin, songDb, onSaveUsages }) {
  const [shown, setShown] = useState(PRESET_PAGE_SIZE);
  useEffect(() => setShown(PRESET_PAGE_SIZE), [filtered, filterPacks]);

  // Phase 14.12 — Index banks O(1) (anomalie A). Avant : 2× findInBanks
  // O(150)/carte × 30 cartes à chaque changement de catégorie. Recalculé
  // seulement quand les banks changent (pas au re-filtrage).
  const annIndex = useMemo(() => buildBankIndex(banksAnn), [banksAnn]);
  const plugIndex = useMemo(() => buildBankIndex(banksPlug), [banksPlug]);

  const subPacks = useMemo(() => {
    const groups = {};
    filtered.forEach(([name, info]) => {
      const key = info.amp || 'Autre';
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const displayFiltered = useMemo(() => {
    if (filterPacks.length === 0) return filtered;
    return filtered.filter(([, info]) => filterPacks.includes(info.amp || 'Autre'));
  }, [filtered, filterPacks]);

  const visible = displayFiltered.slice(0, shown);
  const remaining = displayFiltered.length - shown;
  return (
    <div>
      {subPacks && subPacks.length > 1 && (() => {
        // Phase 7.55.7 S6 — chip() centralisé tokens.js (filtres compacts).
        const chipStyleFn = (on) => chipStyle({ active: on });
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 6 }}>{t('preset-list.amp-model', 'Modèle d\'ampli')}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => setFilterPacks([])} style={chipStyleFn(filterPacks.length === 0)}>{tFormat('preset-list.all-count', { count: filtered.length }, 'Tous ({count})')}</button>
              {subPacks.slice(0, 20).map(([amp, count]) => { const on = filterPacks.includes(amp); return <button key={amp} onClick={() => togglePack(amp)} style={chipStyleFn(on)}>{amp} ({count})</button>; })}
            </div>
          </div>
        );
      })()}
      {/* Phase 7.55.7 S3 — flexWrap + gap pour éviter le chevauchement
          en mobile étroit (372-402px). Sans wrap, les deux blocs cassaient
          chacun sur 2 lignes et se collaient (rapport Cowork v8.14.191 BUG 6).
          flexShrink:0 sur la légende garde HB·SC·P90 sur 1 ligne ; si la
          largeur manque, la légende passe sous l'en-tête principal. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', minWidth: 0 }}>
          {tPlural('preset-list.count-click', displayFiltered.length, {}, { one: '1 preset — clique pour voir la fiche', other: '{count} presets — clique pour voir la fiche' })}
        </div>
        {/* Phase 8.x — pastilles HB/SC/P90 retirées (validé Sébastien) : la compat
            par guitare réelle du rig est couverte par le bloc 'Guitares adaptées'
            qualitatif Phase 7.83 dans la fiche dépliée. Plus actionnable que des
            pastilles abstraites de type pickup dans la liste. */}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {visible.map(([name, info]) => {
          const annLoc = lookupBankIndex(annIndex, name);
          const plugLoc = lookupBankIndex(plugIndex, name);
          const isSel = selected === name;
          return (
            <div key={name}>
              <div onClick={() => setSelected(isSel ? null : name)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: isSel ? 'var(--accent-bg)' : 'var(--a3)', border: isSel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: isSel ? '9px 9px 0 0' : 9, padding: '8px 11px', cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: isSel ? 'var(--accent)' : 'var(--text-bright)', fontWeight: 600, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3, wordBreak: 'break-word' }}>{name}</div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{info.amp}</span>
                    {info.pack && info.pack !== info.amp && <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '1px 5px' }}>{info.pack}</span>}
                    {annLoc && <span title={t('preset-list.installed-pedal', 'Installé sur Pédale/Anniversary')} style={{ fontSize: 9, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 'var(--r-sm)', padding: '1px 5px', fontWeight: 700 }}>Ped {annLoc.bank}{annLoc.slot}</span>}
                    {plugLoc && <span title={t('preset-list.installed-plug', 'Installé sur Plug')} style={{ fontSize: 9, color: 'var(--accent)', background: 'rgba(165,180,252,0.1)', borderRadius: 'var(--r-sm)', padding: '1px 5px', fontWeight: 700 }}>Plug {plugLoc.bank}{plugLoc.slot}</span>}
                  </div>
                </div>
                {/* Phase 8.x — pastilles HB/SC/P90 retirées (cf commentaire header). */}
              </div>
              {isSel && <PresetDetailInline name={name} info={info} banksAnn={banksAnn} banksPlug={banksPlug} presetContext={mergedContext} guitars={guitars} isAdmin={isAdmin} songDb={songDb} onSaveUsages={onSaveUsages}/>}
            </div>
          );
        })}
      </div>
      {remaining > 0 && (
        <button onClick={() => setShown((s) => s + PRESET_PAGE_SIZE)}
          style={{ width: '100%', marginTop: 10, background: 'var(--a5)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-lg)', padding: '10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          {tFormat('preset-list.show-more', { n: Math.min(remaining, PRESET_PAGE_SIZE), remaining }, 'Voir {n} de plus ({remaining} restants)')}
        </button>
      )}
    </div>
  );
}

const CURATED_FAMILIES = {
  Fender: [
    ['Bassman', ['Bassman']],
    ['Twin', ['Twin']],
    ['Princeton', ['Princeton']],
    ['Deluxe', ['Deluxe']],
    ['Champ', ['Champ']],
    ['Super', ['Super Reverb', 'Super S', 'Super ']],
    ['Concert', ['Concert']],
    ['Pro', ['Pro Amp']],
    ['Cambridge', ['Cambridge']],
    ['Bandmaster', ['Bandmaster']],
    ['Texas Star', ['Texas Star']],
    ['Tweed', ['Tweed']],
  ],
  Marshall: [
    ['Plexi', ['Plexi', 'Super Lead', 'Super 100', '1974X', 'Major']],
    ['JCM800', ['JCM800', 'JC800']],
    ['JCM900', ['JCM900']],
    ['SL800', ['SL800']],
    ['SL100', ['SL100']],
    ['JTM', ['JTM']],
    ['SLT60', ['SLT60']],
    ['Silver Jubilee', ['Silver Jubilee', 'Silver J']],
    ['Super Bass', ['Super Bass', 'SB100']],
    ['18W', ['18W']],
  ],
};

function familyForAmp(amp, brand) {
  if (!amp) return 'Autre';
  if (brand === 'Pédales') {
    const after = amp.split(' + ').slice(1).join(' + ').trim();
    return after || amp;
  }
  const base = amp.split(' + ')[0].trim();
  const curated = CURATED_FAMILIES[brand];
  if (curated) {
    for (let i = 0; i < curated.length; i++) {
      const fam = curated[i][0]; const pats = curated[i][1];
      for (let j = 0; j < pats.length; j++) {
        if (base.indexOf(pats[j]) !== -1) return fam;
      }
    }
  }
  let name = base;
  if (brand && name.indexOf(brand) === 0) name = name.substring(brand.length).trim();
  name = name.replace(/^(Tweed|Blonde|Silverface|Blackface|BF|SF|Custom|Hot Rod)\s+/i, '');
  name = name.replace(/^(5E\d+|505\d+|AA\d+|AB\d+|6G\d+)\s+/i, '');
  name = name.replace(/\b(19[5-9]\d|20[0-2]\d)\b/g, '').trim().replace(/\s+/g, ' ');
  return name || base || 'Autre';
}

function PresetBrowser({ banksAnn, banksPlug, availableSources, customPacks, guitars, toneNetPresets, isAdmin, songDb, onSaveUsages }) {
  useLocale(); // Phase 7.84 — re-render au switch de langue (force refresh des sous-composants)
  const [soundProfile, setSoundProfile] = useState('all');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [filterPacks, setFilterPacks] = useState([]);
  // Phase 8.9 — filtre instrument haut niveau (guitar / bass / all).
  // Default 'all' = comportement Phase 8.8 inchangé. Switch sur 'bass'
  // → liste uniquement captures bass (BS prefix, TSR bass packs,
  // custom user instrument:'bass'). 'guitar' → tout SAUF bass.
  const [instrumentFilter, setInstrumentFilter] = useState('all');
  const togglePack = (key) => setFilterPacks((p) => p.includes(key) ? p.filter((x) => x !== key) : [...p, key]);

  // Phase 14.5 — deep-link depuis l'Optimiseur (Découverte → « Voir dans Explorer »).
  // Pattern window._demoPrefSongId : on lit le global une fois au mount,
  // pré-remplit la recherche sur la capture, puis on le nettoie.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = window._explorePreset;
    if (target && typeof target === 'string') {
      setSearch(target);
      setSoundProfile('all');
      window._explorePreset = null;
    }
  }, []);

  const mergedContext = useMemo(() => {
    const ctx = { ...PRESET_CONTEXT };
    (customPacks || []).forEach((pack) => {
      if (pack.ampContext) {
        for (const [amp, info] of Object.entries(pack.ampContext)) {
          if (!ctx[amp]) ctx[amp] = info;
        }
      }
    });
    return ctx;
  }, [customPacks]);

  const fullCatalog = useMemo(() => {
    const tsrNorms = new Set(Object.keys(TSR_PACK_CATALOG).map(normalizePresetName));
    const fullDeduped = {};
    for (const [k, v] of Object.entries(PRESET_CATALOG_FULL)) {
      if (!tsrNorms.has(normalizePresetName(k))) fullDeduped[k] = v;
    }
    const cat = { ...fullDeduped, ...TSR_PACK_CATALOG, ...ANNIVERSARY_CATALOG, ...FACTORY_CATALOG, ...PLUG_FACTORY_CATALOG, ...PRESET_CATALOG };
    (customPacks || []).forEach((pack) => {
      (pack.presets || []).forEach((p) => {
        if (p.name && !cat[p.name]) cat[p.name] = { src: pack.name, amp: p.amp || 'Custom', gain: p.gain || 'mid', style: p.style || 'rock', scores: p.scores || { HB: 78, SC: 78, P90: 78 } };
      });
    });
    (toneNetPresets || []).forEach((p) => {
      if (p.name && !cat[p.name]) cat[p.name] = { src: 'ToneNET', amp: p.amp || 'ToneNET', gain: p.gain || 'mid', style: p.style || 'rock', channel: p.channel || '', cab: p.cab || '', comment: p.comment || '', scores: p.scores || { HB: 75, SC: 75, P90: 75 } };
    });
    if (availableSources) {
      for (const k of Object.keys(cat)) {
        if (availableSources[cat[k].src] === false) delete cat[k];
      }
    }
    return cat;
  }, [customPacks, toneNetPresets, availableSources]);

  // Phase 7.43 — labels et desc wrappés via t() pour le multilingue.
  // Les artistes (BB King, Clapton, etc.) restent FR/identiques car
  // noms propres. Les filtres restent inchangés (logique sur i.gain/style).
  const SOUND_PROFILES = {
    all: { label: t('sound.all', 'Tous les presets'), filter: () => true },
    clean_cristallin: { label: t('sound.clean-label', 'Clean cristallin'), desc: t('sound.clean-desc', 'Fender, jazz, pop'), filter: (i) => i.gain === 'low' && ['jazz', 'pop', 'blues', 'rock'].includes(i.style) },
    blues_vintage: { label: t('sound.blues-vintage-label', 'Blues vintage'), desc: t('sound.blues-vintage-desc', 'B.B. King, Clapton, edge of breakup'), filter: (i) => (i.style === 'blues') || (i.gain === 'low' && i.style === 'rock') },
    jazz_warm: { label: t('sound.jazz-label', 'Jazz warm'), desc: t('sound.jazz-desc', 'Son rond, chaleureux'), filter: (i) => i.style === 'jazz' || (i.gain === 'low' && i.style === 'pop') },
    crunch_70s: { label: t('sound.crunch-70s-label', 'Crunch rock 70s'), desc: t('sound.crunch-70s-desc', 'Led Zep, Stones, Hendrix'), filter: (i) => i.gain === 'mid' && ['rock', 'blues'].includes(i.style) },
    british: { label: t('sound.british-label', 'British invasion'), desc: t('sound.british-desc', 'Marshall, Vox, AC/DC'), filter: (i) => i.gain === 'mid' && ['rock', 'hard_rock'].includes(i.style) },
    blues_rock: { label: t('sound.blues-rock-label', 'Blues-rock texan'), desc: t('sound.blues-rock-desc', 'SRV, Mayer, Bonamassa'), filter: (i) => i.style === 'blues' && ['mid', 'low'].includes(i.gain) },
    funk_soul: { label: t('sound.funk-label', 'Funk / Soul'), desc: t('sound.funk-desc', 'Clean dynamique, Nile Rodgers'), filter: (i) => i.gain === 'low' && ['pop', 'rock'].includes(i.style) },
    hard_rock: { label: t('sound.hard-rock-label', 'Hard rock classique'), desc: t('sound.hard-rock-desc', 'AC/DC, GN\'R, Van Halen'), filter: (i) => i.style === 'hard_rock' && ['mid', 'high'].includes(i.gain) },
    metal: { label: t('sound.metal-label', 'Metal moderne'), desc: t('sound.metal-desc', 'Metallica, Tool, Petrucci'), filter: (i) => i.style === 'metal' || (i.gain === 'high' && i.style === 'hard_rock') },
    high_gain_lead: { label: t('sound.high-gain-label', 'High gain lead'), desc: t('sound.high-gain-desc', 'Solos, shred, sustain'), filter: (i) => i.gain === 'high' },
    pedales: { label: t('sound.pedals-label', 'Pédales de drive'), desc: t('sound.pedals-desc', 'Captures pédales seules'), filter: (i) => (i.amp || '').includes('drive') || (i.amp || '').includes('Pedal') || (i.amp || '').toLowerCase().includes('pédale') },
  };

  // Phase 8.9 — ampBrands respecte le filtre instrument haut niveau.
  // Sans ça, une tuile "Marshall" affichait "126 presets" alors que
  // 0 captures Marshall sont bass → tuile vide en mode bass-only.
  // Le count est recalculé sur les entries filtrées par isBassPreset.
  const ampBrands = useMemo(() => {
    const brands = {};
    Object.entries(fullCatalog).forEach(([name, info]) => {
      if (!info.amp) return;
      if (instrumentFilter !== 'all') {
        const isBass = isBassPreset(name, info);
        if (instrumentFilter === 'bass' && !isBass) return;
        if (instrumentFilter === 'guitar' && isBass) return;
      }
      let brand = info.amp.split(' ')[0];
      if (brand === 'Dr.' || brand === 'Two' || brand === 'Bad' || brand === 'Divided') brand = info.amp.split(' ').slice(0, 2).join(' ');
      if (!brands[brand]) brands[brand] = 0;
      brands[brand]++;
    });
    return Object.entries(brands).sort((a, b) => b[1] - a[1]);
  }, [fullCatalog, instrumentFilter]);

  const filtered = useMemo(() => Object.entries(fullCatalog).filter(([name, info]) => {
    // Phase 8.9 — filtre instrument haut niveau (avant tout autre filtre)
    if (instrumentFilter !== 'all') {
      const isBass = isBassPreset(name, info);
      if (instrumentFilter === 'bass' && !isBass) return false;
      if (instrumentFilter === 'guitar' && isBass) return false;
    }
    const profile = SOUND_PROFILES[soundProfile];
    if (profile && !profile.filter(info)) return false;
    if (filterBrand) {
      let b = info.amp ? info.amp.split(' ')[0] : '';
      if (b === 'Dr.' || b === 'Two' || b === 'Bad' || b === 'Divided') b = info.amp.split(' ').slice(0, 2).join(' ');
      if (b !== filterBrand) return false;
    }
    if (filterModel && familyForAmp(info.amp, filterBrand) !== filterModel) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const ctx = mergedContext[info.amp];
      const artistsStr = (ctx?.refs || []).map((r) => r.a).join(' ').toLowerCase();
      const tracksStr = (ctx?.refs || []).flatMap((r) => r.t).join(' ').toLowerCase();
      if (!name.toLowerCase().includes(q) && !info.amp.toLowerCase().includes(q) && !artistsStr.includes(q) && !tracksStr.includes(q)) return false;
    }
    return true;
  }), [soundProfile, filterBrand, filterModel, search, instrumentFilter, fullCatalog, mergedContext]);

  const [randomPick, setRandomPick] = useState(null);
  // Phase 8.9 — random preset respecte filter instrument
  const pickRandom = () => {
    const pool = Object.entries(fullCatalog).filter(([name, info]) => {
      if (instrumentFilter === 'all') return true;
      const isBass = isBassPreset(name, info);
      return instrumentFilter === 'bass' ? isBass : !isBass;
    });
    if (!pool.length) return;
    const [name, info] = pool[Math.floor(Math.random() * pool.length)];
    setRandomPick({ name, info });
    setSelected(null);
  };

  // Phase 8.9 — ampFamilies respecte aussi le filtre instrument.
  const ampFamilies = useMemo(() => {
    if (!filterBrand) return [];
    const fams = {};
    Object.entries(fullCatalog).forEach(([name, info]) => {
      if (!info.amp) return;
      if (instrumentFilter !== 'all') {
        const isBass = isBassPreset(name, info);
        if (instrumentFilter === 'bass' && !isBass) return;
        if (instrumentFilter === 'guitar' && isBass) return;
      }
      let b = info.amp.split(' ')[0];
      if (b === 'Dr.' || b === 'Two' || b === 'Bad' || b === 'Divided') b = info.amp.split(' ').slice(0, 2).join(' ');
      if (b !== filterBrand) return;
      const profile = SOUND_PROFILES[soundProfile];
      if (profile && !profile.filter(info)) return;
      const fam = familyForAmp(info.amp, filterBrand);
      if (!fams[fam]) fams[fam] = { count: 0, amps: new Set() };
      fams[fam].count++;
      fams[fam].amps.add(info.amp);
    });
    return Object.entries(fams).map(([fam, data]) => [fam, { count: data.count, amps: [...data.amps].sort() }]).sort((a, b) => b[1].count - a[1].count);
  }, [fullCatalog, filterBrand, soundProfile, instrumentFilter]);

  const hasFilter = soundProfile !== 'all' || filterBrand || search.trim();
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{t('preset-browser.intro', 'Explore ta bibliothèque de presets et découvre leur contexte musical.')}</div>

      {/* Phase 8.9 — Filtre instrument haut niveau (guitar/bass/all).
          Bumpé en tête de l'écran avant search/profiles pour permettre
          le switching rapide entre catalogue guitar et bass. Tab radio
          style avec accent visuel sur le bouton actif. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { id: 'all',    label: t('preset-browser.instrument-all-flat',    'Tous'),     iconId: null },
          { id: 'guitar', label: t('preset-browser.instrument-guitar-flat', 'Guitare'),  iconId: 'guitar' },
          { id: 'bass',   label: t('preset-browser.instrument-bass-flat',   'Basse'),    iconId: 'bass' },
        ].map(({ id, label, iconId }) => {
          const active = instrumentFilter === id;
          return (
            <button
              key={id}
              onClick={() => setInstrumentFilter(id)}
              style={{
                flex: 1,
                background: active ? 'var(--accent-bg, rgba(129,140,248,0.18))' : 'var(--a3)',
                border: active ? '1px solid var(--accent, #818cf8)' : '1px solid var(--a8)',
                color: active ? 'var(--accent, #818cf8)' : 'var(--text-muted)',
                borderRadius: 'var(--r-md)',
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                minHeight: 44,
                whiteSpace: 'nowrap',
                boxShadow: active ? 'inset 0 -2px 0 var(--accent, #818cf8)' : 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >{iconId && <NavIcon id={iconId} size={15}/>}{label}</button>
          );
        })}
      </div>

      <div style={{ position: 'relative', marginBottom: 6 }}>
        <input
          type="search"
          enterKeyHint="search"
          placeholder={t('preset-browser.search-placeholder-flat', 'Rechercher artiste, morceau, ampli...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{ width: '100%', background: 'var(--bg-card)', color: 'var(--text)', border: '2px solid var(--a15)', borderRadius: 'var(--r-lg)', padding: '14px 44px 14px 16px', fontSize: 15, boxSizing: 'border-box' }}
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label={t('preset-browser.clear-search', 'Effacer la recherche')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: '50%', width: 28, height: 28, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 14, fontStyle: 'italic' }}>{t('preset-browser.live-filter', 'Résultats filtrés en temps réel')}</div>

      <button onClick={pickRandom} style={{ width: '100%', background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-lg)', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
        {t('preset-browser.random-flat', 'Preset aléatoire')}
      </button>

      {randomPick && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{randomPick.name}</span>
            <button onClick={() => setRandomPick(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <PresetDetailInline name={randomPick.name} info={randomPick.info} banksAnn={banksAnn} banksPlug={banksPlug} presetContext={mergedContext} guitars={guitars} isAdmin={isAdmin} songDb={songDb} onSaveUsages={onSaveUsages}/>
        </div>
      )}

      {(() => {
        // Phase 7.55.7 S7.1 — tile() centralisé + textAlign center
        // (homogène avec tuiles "Parcourir par ampli" ligne ~920).
        const tile = (active) => tileStyle({ active });
        const PROFILE_GROUPS = [
          { title: t('preset-browser.group-clean', 'Sons cleans'), profiles: ['clean_cristallin', 'blues_vintage', 'jazz_warm', 'funk_soul'] },
          { title: t('preset-browser.group-crunch', 'Sons crunch / drive'), profiles: ['crunch_70s', 'british', 'blues_rock'] },
          { title: t('preset-browser.group-saturated', 'Sons saturés'), profiles: ['hard_rock', 'metal', 'high_gain_lead'] },
          { title: t('preset-browser.group-other', 'Autre'), profiles: ['pedales'] },
        ];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 6, whiteSpace: 'nowrap' }}>{t('preset-browser.what-sound', 'Quel son cherches-tu ?')}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                <button onClick={() => setSoundProfile('all')}
                  style={tile(soundProfile === 'all')}
                  onMouseOver={(e) => { if (soundProfile !== 'all') { e.currentTarget.style.borderColor = 'var(--a15)'; e.currentTarget.style.background = 'var(--a7)'; } }}
                  onMouseOut={(e) => { if (soundProfile !== 'all') { e.currentTarget.style.borderColor = 'var(--a8)'; e.currentTarget.style.background = 'var(--a4)'; } }}>{t('preset-browser.all', 'Tous')}</button>
              </div>
              {PROFILE_GROUPS.map((g) => (
                <div key={g.title} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 4 }}>{g.title}</div>
                  {/* Phase 7.55.7 S7.1 — grid 3 colonnes fixes desktop+ (≥640),
                      1 colonne mobile (sinon labels écrasés). Cohérent avec le
                      grid amplis ligne ~920 qui est repeat(3,1fr). Sébastien
                      25/05 : "rester sur 3 cols pour ne pas passer de 3 à 4". */}
                  <div className="preset-sound-tiles">
                    {g.profiles.map((id) => {
                      const p = SOUND_PROFILES[id]; if (!p) return null;
                      const active = soundProfile === id;
                      return (
                        <button key={id}
                          onClick={() => setSoundProfile(active ? 'all' : id)}
                          style={tile(active)}
                          onMouseOver={(e) => { if (!active) { e.currentTarget.style.borderColor = 'var(--a15)'; e.currentTarget.style.background = 'var(--a7)'; } }}
                          onMouseOut={(e) => { if (!active) { e.currentTarget.style.borderColor = 'var(--a8)'; e.currentTarget.style.background = 'var(--a4)'; } }}>
                          <div>{p.label}</div>
                          {p.desc && <div style={{ fontSize: 10, fontWeight: 400, color: active ? 'var(--accent)' : 'var(--text-tertiary)', marginTop: 2 }}>{p.desc}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {hasFilter && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {filterBrand && !filterModel && <button onClick={() => { setFilterBrand(''); setFilterModel(''); }} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{t('preset-browser.back-to-amps', '← Amplis')}</button>}
                  {filterBrand && filterModel && <button onClick={() => setFilterModel('')} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← {filterBrand}</button>}
                  {filterBrand && !filterModel && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{filterBrand}</span>}
                  {filterModel && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{filterModel}</span>}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tPlural('preset-browser.presets-count', filtered.length, {}, { one: '1 preset', other: '{count} presets' })}</span>
                </div>
                <button onClick={() => { setSoundProfile('all'); setFilterBrand(''); setFilterModel(''); setFilterPacks([]); setSearch(''); }} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{t('preset-browser.reset', 'Réinitialiser')}</button>
              </div>
            )}
          </div>
        );
      })()}

      {!hasFilter && (
        <div>
          {/* Phase 8.9 — count total reflète aussi le filtre instrument */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 10 }}>{tFormat('preset-browser.browse-by-amp', { count: ampBrands.reduce((s, [, n]) => s + n, 0) }, 'Parcourir par ampli — {count} presets')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {ampBrands.slice(0, 18).map(([brand, count]) => (
              <button key={brand} onClick={() => { setFilterBrand(brand); setFilterModel(''); }}
                style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--a15)'; e.currentTarget.style.background = 'var(--a7)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--a8)'; e.currentTarget.style.background = 'var(--a4)'; }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{brand}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{tPlural('preset-browser.presets-count', count, {}, { one: '1 preset', other: '{count} presets' })}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {filterBrand && !filterModel && !search.trim() && ampFamilies.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
            {ampFamilies.map(([fam, data]) => {
              const sub = data.amps.length > 1 ? data.amps.map((a) => a.replace(filterBrand, '').replace(' + ', ' + ').trim()).slice(0, 3).join(' · ') : '';
              return (
                <button key={fam} onClick={() => setFilterModel(fam)}
                  style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, transition: 'all .15s' }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--a15)'; e.currentTarget.style.background = 'var(--a7)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--a8)'; e.currentTarget.style.background = 'var(--a4)'; }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fam}</div>
                    {sub && <div style={{ fontSize: 9, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{sub}{data.amps.length > 3 ? ' …' : ''}</div>}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{data.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {hasFilter && (filterModel || search.trim() || !filterBrand) && filtered.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)', fontSize: 13 }}>{t('preset-browser.no-match', 'Aucun preset ne correspond à ces critères.')}</div>}
      {hasFilter && (filterModel || search.trim() || !filterBrand) && filtered.length > 0 && <PresetList filtered={filtered} selected={selected} setSelected={setSelected} banksAnn={banksAnn} banksPlug={banksPlug} fullCatalog={fullCatalog} filterSrcs={[]} filterPacks={filterPacks} togglePack={togglePack} setFilterPacks={setFilterPacks} mergedContext={mergedContext} guitars={guitars} isAdmin={isAdmin} songDb={songDb} onSaveUsages={onSaveUsages}/>}
    </div>
  );
}

export default PresetBrowser;
export {
  PresetBrowser, PresetDetailInline, PresetList,
  findAmpContext, familyForAmp,
};
