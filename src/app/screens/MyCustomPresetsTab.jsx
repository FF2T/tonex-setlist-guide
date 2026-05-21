// src/app/screens/MyCustomPresetsTab.jsx — Phase 7.69 (refonte
// Phase 7.67 MyCustomPacksTab).
//
// Refonte UX suite au retour Sébastien 2026-05-19 :
// - **Liste plate** unique de tous les presets persos (plus de
//   notion de "pack" en UI). En interne, on continue de stocker
//   dans profile.customPacks[].presets pour rétro-compat sync
//   Firestore. Tous les nouveaux presets vont dans un pack
//   "Mes presets" créé à la volée. Les anciens packs existants
//   restent affichés en liste plate.
// - **Champ `creator` informatif** (TSR/AA/JS/TJ/ML/WT/Galtone/
//   ToneNET/Custom maison/Autre). Ce champ remplace l'ancien
//   dropdown "Source" qui était filtrant. La vraie source de
//   filtrage est désormais `src: "custom"` toujours (1 seul
//   toggle "Mes presets custom" dans Sources). Le creator est
//   juste affiché en badge.
// - **Termes uniformisés** : "Mes presets custom" partout (tab
//   + Sources).
//
// Stocké dans profile.customPacks per-profile. Le useMemo
// Phase 7.30 (main.jsx) synchronise dans PRESET_CATALOG_MERGED
// avec src: "custom" toujours + creator séparé.

import React, { useState, useMemo } from 'react';
import { t, tFormat, useLocale } from '../../i18n/index.js';
import { PRESET_CATALOG_MERGED } from '../../core/catalog.js';
import { inferPresetInfo } from '../utils/infer-preset.js';
import { STYLE_SCORES } from '../utils/detect-preset-metadata.js';
import { cleanUsages } from './ToneNetTab.jsx';
import { bucketizeScore, COMPAT_LEVELS } from '../../core/scoring/compat-buckets.js';

// Phase 7.69.13 (origine) — Niveaux qualitatifs pour la saisie des
// scores de compatibilité par micro.
//
// Phase 7.83 (2026-05-20) — Aligné sur les 3 niveaux musicaux
// communs au projet : 🟢 Mariage parfait (≥75) · 🟡 Bon match (≥55) ·
// 🟠 Compromis (<55). Valeurs canoniques 85/65/40 (au cœur de chaque
// range). Cliquer un bouton snap à la valeur canonique du niveau.
const SCORE_LEVELS = [
  { value: 40, levelId: 'compromise' },
  { value: 65, levelId: 'good' },
  { value: 85, levelId: 'ideal' },
];

// Détermine quel SCORE_LEVELS correspond à un score donné (via bucket).
function getLevelForScore(score) {
  const bucket = bucketizeScore(score);
  return SCORE_LEVELS.find((lv) => lv.levelId === bucket.id) || SCORE_LEVELS[1];
}

// Label localisé pour un niveau, partagé avec PresetBrowser (Phase 7.83).
function getLevelLabel(levelId) {
  if (levelId === 'ideal') return t('compat.ideal-match', '🟢 Mariage parfait');
  if (levelId === 'good') return t('compat.good-match', '🟡 Bon match');
  return t('compat.compromise', '🟠 Compromis');
}

// Liste fermée des valeurs `creator` possibles. Auto-détection via
// regex sur le nom mais le user peut overrider. Décision Phase 7.69 :
// liste fermée plutôt que texte libre pour cohérence avec les
// SOURCE_IDS catalogues curated (TSR, AA, JS, etc.).
const CREATOR_OPTIONS = [
  { value: '', label: '— Provenance inconnue —' },
  { value: 'TSR', label: 'TSR — The Studio Rats' },
  { value: 'ML', label: 'ML Sound Lab' },
  { value: 'AA', label: 'Amalgam Audio' },
  { value: 'JS', label: 'Jason Sadites' },
  { value: 'TJ', label: 'Tone Junkie TV' },
  { value: 'WT', label: 'Worship Tutorials' },
  { value: 'Galtone', label: 'Galtone' },
  { value: 'ToneNET', label: 'ToneNET (téléchargé)' },
  { value: 'Maison', label: 'Custom maison (capture perso)' },
  { value: 'Autre', label: 'Autre' },
];

// Auto-détection du creator depuis le nom du preset. Heuristique
// regex utilisée pour pré-remplir le dropdown. Le user peut
// overrider. Identique à inferSource Phase 7.67 mais retourne
// les valeurs CREATOR_OPTIONS (Maison/Autre au lieu de Factory/custom).
export function inferCreator(presetName) {
  const n = String(presetName || '').trim();
  if (!n) return '';
  if (/^TSR\s|^TSR-|\bTSR\b/i.test(n)) return 'TSR';
  if (/^AA\s|amalgam/i.test(n)) return 'AA';
  if (/^JS\s|sadites/i.test(n)) return 'JS';
  if (/^TJ\s|junkie/i.test(n)) return 'TJ';
  if (/^ML\s|\bML\b\s*sound/i.test(n)) return 'ML';
  if (/^WT\s|worship/i.test(n)) return 'WT';
  if (/galtone|kirk\s*&\s*james/i.test(n)) return 'Galtone';
  return '';  // unknown — laissé au user
}

// Nom du pack par défaut pour les nouveaux presets ajoutés via ce tab.
// Permet de regrouper en interne sans exposer la notion de pack en UI.
const DEFAULT_PACK_NAME = 'Mes presets';

// Liste unique des amps présents dans PRESET_CATALOG_MERGED (pour
// la datalist auto-suggest du champ "Ampli source"). Skip les
// "Stomp - X" génériques.
function getKnownAmps() {
  const set = new Set();
  for (const entry of Object.values(PRESET_CATALOG_MERGED)) {
    if (entry?.amp && typeof entry.amp === 'string' && !entry.amp.startsWith('Stomp -')) {
      set.add(entry.amp);
    }
  }
  return Array.from(set).sort();
}

const STYLE_OPTIONS = ['blues', 'rock', 'hard_rock', 'jazz', 'metal', 'pop'];
const GAIN_OPTIONS = ['low', 'mid', 'high'];

function emptyForm() {
  // Phase 7.69.13 — Pré-saisie A : scores depuis STYLE_SCORES['rock']
  // (style par défaut). Recalculés à chaque changement de style.
  const defaultScores = STYLE_SCORES.rock || { HB: 75, SC: 75, P90: 75 };
  return {
    name: '',
    creator: '',
    amp: '',
    gain: 'mid',
    style: 'rock',
    channel: '',
    scoreHB: defaultScores.HB,
    scoreSC: defaultScores.SC,
    scoreP90: defaultScores.P90,
    usages: [],
  };
}

// Flatten profile.customPacks en liste plate avec metadata du pack
// d'origine pour retrouver le preset lors de l'édition/suppression.
// Phase 7.69 : la notion de "pack" est invisible en UI mais préservée
// en coulisses (rétro-compat sync). Chaque entry = preset + packIdx +
// presetIdx pour pouvoir remonter.
function flattenPresets(customPacks) {
  const list = [];
  (customPacks || []).forEach((pack, packIdx) => {
    (pack.presets || []).forEach((preset, presetIdx) => {
      list.push({ preset, packIdx, presetIdx, packName: pack.name });
    });
  });
  // Tri alpha par nom de preset pour stabilité d'affichage.
  list.sort((a, b) => (a.preset.name || '').localeCompare(b.preset.name || ''));
  return list;
}

// MyCustomPresetsTab — composant principal.
// Props :
//   profile : profile actif (ou cible si admin édite un autre profil)
//   onProfiles : setter setProfiles
//   activeProfileId : id du profile à modifier (override possible pour vue admin)
//   songDb : pour autocomplete usages
//   inp : style commun input
function MyCustomPresetsTab({ profile, onProfiles, activeProfileId, songDb, inp }) {
  // Phase 7.74.7 — useLocale() : re-render de l'onglet (et de ses
  // sous-composants PresetForm/ScoreLevelsRow) au switch de langue.
  useLocale();
  const customPacks = profile?.customPacks || [];
  const flatList = useMemo(() => flattenPresets(customPacks), [customPacks]);
  const [editKey, setEditKey] = useState(null); // 'packIdx:presetIdx' ou 'new'
  const [form, setForm] = useState(emptyForm());

  const knownAmps = useMemo(() => getKnownAmps(), []);
  const artistList = useMemo(() => {
    const set = new Set();
    (songDb || []).forEach((s) => { if (s.artist) set.add(s.artist); });
    return Array.from(set).sort();
  }, [songDb]);
  const titleList = useMemo(() => {
    const set = new Set();
    (songDb || []).forEach((s) => { if (s.title) set.add(s.title); });
    return Array.from(set).sort();
  }, [songDb]);

  const writePacks = (newPacks) => {
    onProfiles((p) => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      return {
        ...p,
        [activeProfileId]: { ...cur, customPacks: newPacks, lastModified: Date.now() },
      };
    });
  };

  const startNew = () => {
    setForm(emptyForm());
    setEditKey('new');
  };

  const startEdit = (item) => {
    const { preset, packIdx, presetIdx } = item;
    setForm({
      name: preset.name || '',
      // Phase 7.69 — récupère creator (champ informatif). Legacy : si
      // p.src existe et n'est pas "custom", l'utiliser comme creator
      // (migration silencieuse Phase 7.67 → 7.69).
      creator: preset.creator || (preset.src && preset.src !== 'custom' ? preset.src : ''),
      amp: preset.amp || '',
      gain: preset.gain || 'mid',
      style: preset.style || 'rock',
      channel: preset.channel || '',
      scoreHB: preset.scores?.HB ?? 75,
      scoreSC: preset.scores?.SC ?? 75,
      scoreP90: preset.scores?.P90 ?? 75,
      usages: (preset.usages || []).map((u) => ({
        artist: u.artist || '',
        songs: Array.isArray(u.songs) ? u.songs.slice() : [],
      })),
    });
    setEditKey(`${packIdx}:${presetIdx}`);
  };

  const cancel = () => {
    setEditKey(null);
    setForm(emptyForm());
  };

  const onNameChange = (newName) => {
    setForm((f) => {
      const next = { ...f, name: newName };
      // Auto-suggest creator si user n'a pas overridé manuellement.
      if (!f.creator || f.creator === inferCreator(f.name)) {
        const inferred = inferCreator(newName);
        if (inferred) next.creator = inferred;
      }
      // Auto-suggest amp/gain/style si vides.
      if (!f.amp) {
        const info = inferPresetInfo(newName);
        if (info?.amp) next.amp = info.amp;
        if (info?.style && f.style === 'rock') {
          next.style = info.style;
          // Phase 7.69.13 — recalc scores depuis le nouveau style.
          const s = STYLE_SCORES[info.style];
          if (s) { next.scoreHB = s.HB; next.scoreSC = s.SC; next.scoreP90 = s.P90; }
        }
        if (info?.gain && f.gain === 'mid') next.gain = info.gain;
      }
      return next;
    });
  };

  // Phase 7.69.13 — Au changement de style, recalc scores via STYLE_SCORES.
  // Le user peut quand même override en cliquant un bouton niveau ensuite.
  const onStyleChange = (newStyle) => {
    setForm((f) => {
      const next = { ...f, style: newStyle };
      const s = STYLE_SCORES[newStyle];
      if (s) { next.scoreHB = s.HB; next.scoreSC = s.SC; next.scoreP90 = s.P90; }
      return next;
    });
  };

  // Phase 7.69.13 — Set un score à la valeur canonique d'un niveau
  // (Médiocre/Moyen/Bon/Excellent → 50/75/85/95).
  const setScoreLevel = (key, levelValue) => {
    setForm((f) => ({ ...f, [key]: levelValue }));
  };

  const addUsage = () => {
    setForm((f) => ({ ...f, usages: [...f.usages, { artist: '', songs: [] }] }));
  };
  const removeUsage = (idx) => {
    setForm((f) => ({ ...f, usages: f.usages.filter((_, i) => i !== idx) }));
  };
  const updateUsageArtist = (idx, artist) => {
    setForm((f) => ({
      ...f,
      usages: f.usages.map((u, i) => (i === idx ? { ...u, artist } : u)),
    }));
  };
  const addSongToUsage = (idx, title) => {
    const trimmed = String(title || '').trim();
    if (!trimmed) return;
    setForm((f) => ({
      ...f,
      usages: f.usages.map((u, i) =>
        i === idx ? { ...u, songs: Array.from(new Set([...u.songs, trimmed])) } : u,
      ),
    }));
  };
  const removeSongFromUsage = (idx, songIdx) => {
    setForm((f) => ({
      ...f,
      usages: f.usages.map((u, i) =>
        i === idx ? { ...u, songs: u.songs.filter((_, j) => j !== songIdx) } : u,
      ),
    }));
  };

  const buildPreset = () => {
    const cleanedUsages = cleanUsages(form.usages);
    const preset = {
      name: form.name.trim(),
      // Phase 7.69 — `src` toujours "custom" (filtrage via 1 toggle).
      // `creator` informatif (jamais lu par isSourceAvailable).
      src: 'custom',
      creator: form.creator || '',
      amp: form.amp.trim() || 'Custom',
      gain: form.gain,
      style: form.style,
      channel: form.channel.trim() || '',
      scores: {
        HB: Math.max(0, Math.min(100, parseInt(form.scoreHB, 10) || 75)),
        SC: Math.max(0, Math.min(100, parseInt(form.scoreSC, 10) || 75)),
        P90: Math.max(0, Math.min(100, parseInt(form.scoreP90, 10) || 75)),
      },
    };
    if (cleanedUsages) preset.usages = cleanedUsages;
    return preset;
  };

  const save = () => {
    if (!form.name.trim()) {
      alert(t('mycustompresets.error-name', 'Nom de preset requis.'));
      return;
    }
    const preset = buildPreset();
    let nextPacks;
    if (editKey === 'new') {
      // Nouveau preset → ajouté au pack "Mes presets" (créé à la volée si absent).
      // Override si même nom déjà présent (par sécurité).
      const defaultPackIdx = customPacks.findIndex((p) => p.name === DEFAULT_PACK_NAME);
      if (defaultPackIdx >= 0) {
        nextPacks = customPacks.map((p, i) => {
          if (i !== defaultPackIdx) return p;
          const filtered = (p.presets || []).filter((pr) => pr.name !== preset.name);
          return { ...p, presets: [...filtered, preset] };
        });
      } else {
        nextPacks = [...customPacks, { name: DEFAULT_PACK_NAME, presets: [preset] }];
      }
    } else {
      // Édition — remplace in-place dans le pack d'origine.
      const [packIdxStr, presetIdxStr] = editKey.split(':');
      const packIdx = parseInt(packIdxStr, 10);
      const presetIdx = parseInt(presetIdxStr, 10);
      nextPacks = customPacks.map((p, i) => {
        if (i !== packIdx) return p;
        return {
          ...p,
          presets: (p.presets || []).map((pr, j) => (j === presetIdx ? preset : pr)),
        };
      });
    }
    writePacks(nextPacks);
    cancel();
  };

  const deletePreset = (item) => {
    const { preset, packIdx, presetIdx } = item;
    if (!window.confirm(tFormat('mycustompresets.confirm-delete', { name: preset.name }, 'Supprimer le preset "{name}" ?'))) return;
    const nextPacks = customPacks
      .map((p, i) => {
        if (i !== packIdx) return p;
        return { ...p, presets: (p.presets || []).filter((_, j) => j !== presetIdx) };
      })
      .filter((p) => (p.presets || []).length > 0); // drop pack vide
    writePacks(nextPacks);
  };

  const sectionStyle = { background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 12 };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>
        {t('mycustompresets.intro', 'Liste de tous tes presets persos avec leurs metadata. Les usages artiste/morceau aident l\'IA à pinner le bon preset pour chaque song. Activable/désactivable via le toggle "Mes presets custom" dans 📦 Sources.')}
      </div>

      {flatList.length === 0 && (
        <div style={{ ...sectionStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 12 }}>{t('mycustompresets.empty', 'Aucun preset custom pour le moment.')}</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>{t('mycustompresets.empty-hint', 'Clique "+ Ajouter un preset" pour commencer.')}</div>
        </div>
      )}

      {/* Liste plate de tous les presets */}
      {flatList.length > 0 && (
        <div style={{ ...sectionStyle, padding: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, padding: '0 6px' }}>
            {flatList.length} {t('mycustompresets.preset-count', 'preset(s)')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {flatList.map((item) => {
              const editKeyCur = `${item.packIdx}:${item.presetIdx}`;
              const isEditing = editKey === editKeyCur;
              const { preset } = item;
              // Phase 7.69 — affiche creator du preset (legacy : préfère
              // preset.creator, fallback preset.src si !=custom).
              const creator = preset.creator || (preset.src && preset.src !== 'custom' ? preset.src : '');
              return (
                <div key={editKeyCur}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--a3)', border: '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '6px 10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {preset.name}
                        {creator && (
                          <span style={{ fontSize: 9, background: 'var(--a7)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '1px 5px', fontWeight: 500, flexShrink: 0 }}>{creator}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {preset.amp || '—'} · {preset.gain} gain · {preset.style}
                        {Array.isArray(preset.usages) && preset.usages.length > 0 && (
                          <span style={{ marginLeft: 6, color: 'var(--accent)' }} title={preset.usages.map((u) => u.artist).join(', ')}>🎯 {preset.usages.length}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => startEdit(item)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 7px', fontSize: 10, cursor: 'pointer' }}>✏️</button>
                    <button onClick={() => deletePreset(item)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }}>✕</button>
                  </div>
                  {isEditing && (
                    <PresetForm
                      form={form}
                      setForm={setForm}
                      onNameChange={onNameChange}
                      onStyleChange={onStyleChange}
                      setScoreLevel={setScoreLevel}
                      knownAmps={knownAmps}
                      artistList={artistList}
                      titleList={titleList}
                      addUsage={addUsage}
                      removeUsage={removeUsage}
                      updateUsageArtist={updateUsageArtist}
                      addSongToUsage={addSongToUsage}
                      removeSongFromUsage={removeSongFromUsage}
                      onSave={save}
                      onCancel={cancel}
                      inp={inp}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Formulaire création */}
      {editKey === 'new' ? (
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('mycustompresets.new', '+ Nouveau preset')}</div>
          <PresetForm
            form={form}
            setForm={setForm}
            onNameChange={onNameChange}
            onStyleChange={onStyleChange}
            setScoreLevel={setScoreLevel}
            knownAmps={knownAmps}
            artistList={artistList}
            titleList={titleList}
            addUsage={addUsage}
            removeUsage={removeUsage}
            updateUsageArtist={updateUsageArtist}
            addSongToUsage={addSongToUsage}
            removeSongFromUsage={removeSongFromUsage}
            onSave={save}
            onCancel={cancel}
            inp={inp}
          />
        </div>
      ) : (
        <button
          onClick={startNew}
          style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
        >
          + {t('mycustompresets.add', 'Ajouter un preset')}
        </button>
      )}
    </div>
  );
}

// Formulaire CRUD preset Phase 7.69 — extrait pour partage entre
// édition existante et création new.
function PresetForm({
  form, setForm, onNameChange, onStyleChange, setScoreLevel,
  knownAmps, artistList, titleList,
  addUsage, removeUsage, updateUsageArtist, addSongToUsage, removeSongFromUsage,
  onSave, onCancel, inp,
}) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [songInputByUsage, setSongInputByUsage] = useState({});
  return (
    <div style={{ background: 'var(--a5)', borderRadius: 'var(--r-md)', padding: 12, marginTop: 6, border: '1px solid var(--a8)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Nom */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompresets.field-name', 'Nom du preset')}</label>
          <input
            value={form.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('mycustompresets.field-name-placeholder', 'Ex: TSR Mars 800SL Cn1&2 HG')}
            style={{ ...inp, width: '100%', fontSize: 12 }}
          />
        </div>

        {/* Provenance (creator) — informatif, jamais filtrant Phase 7.69 */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompresets.field-creator', 'Provenance (informatif)')}</label>
          <select value={form.creator} onChange={(e) => set('creator', e.target.value)} style={{ ...inp, width: '100%', fontSize: 12 }}>
            {CREATOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            {t('mycustompresets.creator-hint', 'Ce champ est juste un label. Le filtrage des presets se fait via le toggle "Mes presets custom" dans 📦 Sources.')}
          </div>
        </div>

        {/* Ampli + Gain + Style */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 200px' }}>
            <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompresets.field-amp', 'Ampli source')}</label>
            <input
              list="known-amps"
              value={form.amp}
              onChange={(e) => set('amp', e.target.value)}
              placeholder={t('mycustompresets.field-amp-placeholder', 'Ex: Mesa Boogie Mark V')}
              style={{ ...inp, width: '100%', fontSize: 12 }}
            />
            <datalist id="known-amps">
              {knownAmps.map((a) => <option key={a} value={a}/>)}
            </datalist>
          </div>
          <div style={{ flex: '1 1 90px' }}>
            <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompresets.field-gain', 'Gain')}</label>
            <select value={form.gain} onChange={(e) => set('gain', e.target.value)} style={{ ...inp, width: '100%', fontSize: 12 }}>
              {GAIN_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompresets.field-style', 'Style')}</label>
            <select
              value={form.style}
              onChange={(e) => (onStyleChange ? onStyleChange(e.target.value) : set('style', e.target.value))}
              style={{ ...inp, width: '100%', fontSize: 12 }}
            >
              {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Channel */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompresets.field-channel', 'Channel (optionnel)')}</label>
          <input
            value={form.channel}
            onChange={(e) => set('channel', e.target.value)}
            placeholder={t('mycustompresets.field-channel-placeholder', 'Ex: Clean / Drive / Hi-Gain / Lead')}
            style={{ ...inp, width: '100%', fontSize: 12 }}
          />
        </div>

        {/* Scores HB / SC / P90 — Phase 7.69.13 niveaux qualitatifs */}
        <ScoreLevelsRow form={form} set={set} setScoreLevel={setScoreLevel} inp={inp}/>

        {/* Usages */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-sec)' }}>{t('mycustompresets.field-usages', 'Usages artiste / morceau (optionnel, recommandé)')}</label>
            <button onClick={addUsage} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>+ {t('mycustompresets.add-artist', 'Artiste')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {form.usages.map((u, idx) => (
              <div key={idx} style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-sm)', padding: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <input
                    list="artist-list"
                    value={u.artist}
                    onChange={(e) => updateUsageArtist(idx, e.target.value)}
                    placeholder={t('mycustompresets.usage-artist', 'Artiste / groupe')}
                    style={{ ...inp, flex: 1, fontSize: 11 }}
                  />
                  <button onClick={() => removeUsage(idx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                  {u.songs.map((song, j) => (
                    <span key={j} style={{ fontSize: 10, background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {song}
                      <button onClick={() => removeSongFromUsage(idx, j)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 10, padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    list="title-list"
                    value={songInputByUsage[idx] || ''}
                    onChange={(e) => setSongInputByUsage((p) => ({ ...p, [idx]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addSongToUsage(idx, songInputByUsage[idx] || '');
                        setSongInputByUsage((p) => ({ ...p, [idx]: '' }));
                      }
                    }}
                    placeholder={t('mycustompresets.usage-song-add', '+ Morceau (Enter pour ajouter)')}
                    style={{ ...inp, flex: 1, fontSize: 10 }}
                  />
                  <button
                    onClick={() => {
                      addSongToUsage(idx, songInputByUsage[idx] || '');
                      setSongInputByUsage((p) => ({ ...p, [idx]: '' }));
                    }}
                    style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}
                  >+</button>
                </div>
              </div>
            ))}
            <datalist id="artist-list">
              {artistList.map((a) => <option key={a} value={a}/>)}
            </datalist>
            <datalist id="title-list">
              {titleList.map((tt) => <option key={tt} value={tt}/>)}
            </datalist>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>{t('mycustompresets.cancel', 'Annuler')}</button>
          <button onClick={onSave} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('mycustompresets.save', 'Sauvegarder')}</button>
        </div>
      </div>
    </div>
  );
}

// Phase 7.69.13 — Composant ScoreLevelsRow : 3 lignes (HB/SC/P90) avec
// 4 boutons niveaux (Médiocre/Moyen/Bon/Excellent = 50/75/85/95). Le
// score actuel highlight le bouton dont la range matche. Toggle "Avancé"
// pour saisie 0-100 fine (power users).
function ScoreLevelsRow({ form, set, setScoreLevel, inp }) {
  const [advanced, setAdvanced] = useState(false);
  const rows = [
    ['HB', 'scoreHB', t('mycustompresets.score-hb', 'Humbuckers')],
    ['SC', 'scoreSC', t('mycustompresets.score-sc', 'Single coils')],
    ['P90', 'scoreP90', t('mycustompresets.score-p90', 'P90')],
  ];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--text-sec)' }}>
          {t('mycustompresets.field-scores-qual', 'Compatibilité par type de micro')}
        </label>
        <button
          onClick={() => setAdvanced((a) => !a)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
        >
          {advanced ? t('mycustompresets.scores-simple', '← Mode simple') : t('mycustompresets.scores-advanced', 'Mode avancé (0-100) →')}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(([key, formKey, label]) => {
          const current = form[formKey];
          const activeLevel = getLevelForScore(current);
          return (
            <div key={formKey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, width: 90 }}>
                {label}
              </span>
              {advanced ? (
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={current}
                  onChange={(e) => set(formKey, parseInt(e.target.value, 10) || 0)}
                  style={{ ...inp, width: 80, fontSize: 12, textAlign: 'center' }}
                />
              ) : (
                <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                  {/* Phase 7.83 — 3 niveaux qualitatifs alignés sur PresetBrowser */}
                  {SCORE_LEVELS.map((lv) => {
                    const isActive = lv.levelId === activeLevel.levelId;
                    const color = COMPAT_LEVELS[lv.levelId].color;
                    const label = getLevelLabel(lv.levelId);
                    return (
                      <button
                        key={lv.levelId}
                        onClick={() => setScoreLevel(formKey, lv.value)}
                        style={{
                          flex: 1,
                          background: isActive ? color : 'var(--a4)',
                          border: isActive ? `1px solid ${color}` : '1px solid var(--a8)',
                          color: isActive ? 'var(--tolex-900)' : 'var(--text-sec)',
                          borderRadius: 'var(--r-sm)',
                          padding: '4px 6px',
                          fontSize: 10,
                          fontWeight: isActive ? 700 : 500,
                          cursor: 'pointer',
                          minWidth: 60,
                        }}
                        title={`${label} (${lv.value})`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>
                {current}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MyCustomPresetsTab;
export { MyCustomPresetsTab, DEFAULT_PACK_NAME, CREATOR_OPTIONS, flattenPresets };
