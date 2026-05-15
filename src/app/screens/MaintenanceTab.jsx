// src/app/screens/MaintenanceTab.jsx — Phase 7.37 (wrapping i18n).
//
// Onglet 🔧 Maintenance dans MonProfilScreen (admin only) et
// ParametresScreen. Outils :
// - rafraîchir/recalculer l'IA (vide aiCache ou bloque sur fetchAI batch)
// - fusionner les doublons par titre/artiste normalisés
// - recalculer le scoring local sans appel IA
// - restaurer une sauvegarde automatique
// - dédupliquer les setlists (strict / aggressif)
// - réinitialiser toutes les données.

import React, { useState, useMemo } from 'react';
import { t, tFormat, tPlural, getLocale } from '../../i18n/index.js';
import { GUITARS, findGuitar } from '../../core/guitars.js';
import { SCORING_VERSION } from '../../core/scoring/index.js';
import {
  listBackups, restoreBackup, clearBackups,
  dedupSetlistsWithTombstones, findSetlistDuplicatesByName,
  dedupSongDb,
  buildDemoSnapshot,
} from '../../core/state.js';
import { normalizeSongTitle, normalizeArtist } from '../utils/song-helpers.js';
import { enrichAIResult, updateAiCache } from '../utils/ai-helpers.js';
import { fetchAI } from '../utils/fetchAI.js';
import { isNoSyncMode, setNoSyncMode } from '../utils/firestore.js';

function MaintenanceTab({ songDb, onSongDb, setlists, onSetlists, onDeletedSetlistIds, banksAnn, banksPlug, aiProvider, aiKeys, profile, guitarBias, onFullReset }) {
  const [recalculating, setRecalculating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [done, setDone] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const cachedCount = songDb.filter((s) => s.aiCache).length;

  const duplicateGroups = useMemo(() => {
    const byKey = {};
    for (const s of songDb) {
      const k = normalizeSongTitle(s.title) + '|' + normalizeArtist(s.artist);
      (byKey[k] = byKey[k] || []).push(s);
    }
    return Object.values(byKey).filter((g) => g.length > 1);
  }, [songDb]);
  const dupCount = duplicateGroups.reduce((n, g) => n + g.length - 1, 0);

  // Phase 7.20 — Dédup par id (anciennes collisions Date.now() / migrations).
  // Distinct du mergeDuplicates par titre normalisé ci-dessus.
  const idDupCount = useMemo(() => {
    if (!Array.isArray(songDb)) return 0;
    const ids = new Set();
    let dup = 0;
    for (const s of songDb) {
      if (!s || !s.id) continue;
      if (ids.has(s.id)) dup++;
      else ids.add(s.id);
    }
    return dup;
  }, [songDb]);

  // Helpers de pluriels FR (avec fallback EN compatible Phase E)
  const songsPlural = (n) => tPlural('maintenance.songs', n, {}, { one: '1 morceau', other: '{count} morceaux' });
  const duplicatesPlural = (n) => tPlural('maintenance.duplicates', n, {}, { one: '1 doublon', other: '{count} doublons' });
  const setlistsPlural = (n) => tPlural('maintenance.setlists', n, {}, { one: '1 setlist', other: '{count} setlists' });
  const overridesPlural = (n) => tPlural('maintenance.overrides', n, {}, { one: '1 override', other: '{count} overrides' });

  const mergeIdDuplicates = () => {
    if (idDupCount <= 0) return;
    const msg = tFormat('maintenance.id-dup-confirm', { entries: tPlural('maintenance.entries', idDupCount, {}, { one: '1 entrée', other: '{count} entrées' }) }, '{entries} avec id dupliqué dans la base.\n\nLa première occurrence de chaque id est conservée, les aiCache et feedbacks sont fusionnés.\n\nConfirmer ?');
    if (!window.confirm(msg)) return;
    const { songs, removed } = dedupSongDb(songDb);
    onSongDb(() => songs);
    setDone(true); setTimeout(() => setDone(false), 3000);
  };

  const mergeDuplicates = () => {
    if (!duplicateGroups.length) return;
    const lines = duplicateGroups.map((g) => '• ' + g.map((s) => `"${s.title}" — ${s.artist}`).join(' / ')).join('\n');
    const msg = tFormat('maintenance.merge-confirm', { duplicates: duplicatesPlural(dupCount), lines }, '{duplicates} à fusionner :\n\n{lines}\n\nLa version la plus riche en cache est conservée, les setlists sont redirigées.');
    if (!window.confirm(msg)) return;
    const idMap = {};
    const idsToDelete = new Set();
    const richness = (s) => (s.aiCache?.result?.cot_step1 ? 2 : 0) + (s.aiCache ? 1 : 0);
    for (const group of duplicateGroups) {
      const sorted = [...group].sort((a, b) => richness(b) - richness(a));
      const canonical = sorted[0];
      for (const s of sorted.slice(1)) { idMap[s.id] = canonical.id; idsToDelete.add(s.id); }
    }
    if (onSetlists) {
      onSetlists((prev) => prev.map((sl) => ({ ...sl, songIds: [...new Set((sl.songIds || []).map((id) => idMap[id] || id))] })));
    }
    onSongDb((prev) => prev.filter((s) => !idsToDelete.has(s.id)));
    setDone(true); setTimeout(() => setDone(false), 3000);
  };

  const recalcAll = async () => {
    if (profile?.isDemo) return; // Phase 7.51.2 — pas de fetchAI en mode démo
    setRecalculating(true); setDone(false);
    const total = songDb.length;
    setProgress({ done: 0, total, current: '' });
    for (let i = 0; i < songDb.length; i++) {
      const s = songDb[i];
      setProgress({ done: i, total, current: s.title });
      try {
        const historicalFeedback = Array.isArray(s.feedback) && s.feedback.length > 0
          ? s.feedback.map((f) => f.text).filter(Boolean).join('. ')
          : null;
        const r = await fetchAI(s, '', banksAnn, banksPlug, aiProvider, aiKeys, GUITARS, historicalFeedback, null, profile?.recoMode || 'balanced', guitarBias);
        onSongDb((p) => p.map((x) => x.id === s.id ? { ...x, aiCache: updateAiCache(x.aiCache, '', r) } : x));
      } catch (e) { console.warn('Recalc failed for', s.title, e); }
      if (i < songDb.length - 1) await new Promise((r) => setTimeout(r, 2000));
    }
    setProgress({ done: total, total, current: '' });
    setRecalculating(false); setDone(true);
    setTimeout(() => setDone(false), 5000);
  };

  const refreshAI = () => {
    const n = songDb.length;
    const msg = tFormat('maintenance.refresh-confirm', { songs: songsPlural(n) }, "Rafraîchir l'IA pour {songs} ?\n\nLe cache est vidé immédiatement. Le recalcul IA se fera passivement à l'ouverture de chaque morceau (incluant tes nouvelles guitares).\n\nAucun appel API n'est lancé maintenant.");
    if (!window.confirm(msg)) return;
    onSongDb((p) => p.map((s) => ({ ...s, aiCache: null })));
    setDone(true); setTimeout(() => setDone(false), 4000);
  };

  const recalcAllConfirmed = () => {
    const n = songDb.length;
    const estimSec = Math.round(n * 5);
    const estimMin = Math.ceil(estimSec / 60);
    const dureeLabel = estimMin >= 2
      ? tFormat('maintenance.duration-min', { min: estimMin }, '~{min} minutes')
      : tFormat('maintenance.duration-sec', { sec: estimSec }, '~{sec} secondes');
    const msg = tFormat('maintenance.recalc-confirm', { songs: songsPlural(n), duration: dureeLabel, count: n }, "Forcer le recalcul IA EN BLOC pour {songs} ?\n\n• Durée estimée : {duration}\n• Appels API : {count}\n• Consomme du quota API\n\nNe ferme pas l'app pendant le traitement. Préfère \"Rafraîchir l'IA\" si tu n'as pas besoin du résultat immédiatement.");
    if (!window.confirm(msg)) return;
    recalcAll();
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 16 }}>{t('maintenance.intro', "Outils de maintenance de l'application.")}</div>

      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🤖</span><span>{t('maintenance.my-analyses', 'Mes analyses IA')}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>{tFormat('maintenance.cached-count', { cached: songsPlural(cachedCount), total: songDb.length }, '{cached} en cache sur {total}')}</div>
        {recalculating ? <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 20, animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>&#9203;</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{progress.done}/{progress.total}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progress.current}</div>
            </div>
          </div>
          <div style={{ background: 'var(--a8)', borderRadius: 'var(--r-sm)', height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${progress.total ? progress.done / progress.total * 100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 'var(--r-sm)', transition: 'width 0.3s' }}/>
          </div>
        </div>
          : done ? <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>{t('maintenance.done', 'Terminé !')}</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <button onClick={refreshAI} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('maintenance.refresh-button', "🔄 Rafraîchir l'IA (tous morceaux)")}</button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.4 }}>{t('maintenance.refresh-hint', "Vide le cache et relance l'IA passivement à l'ouverture de chaque morceau. À utiliser après avoir ajouté des guitares ou changé ton matériel.")}</div>
              </div>
              <div>
                <button onClick={recalcAllConfirmed} style={{ background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>{tFormat('maintenance.recalc-button', { songs: songsPlural(songDb.length) }, '⚡ Forcer le recalcul IA en bloc — {songs}')}</button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.4 }}>{t('maintenance.recalc-hint', "Lance immédiatement l'IA pour tous les morceaux, en bloc. Long et consomme du quota API.")}</div>
              </div>
            </div>}
      </div>

      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('maintenance.merge-duplicates', 'Fusionner les doublons')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          {dupCount > 0
            ? tFormat('maintenance.dup-detected', { duplicates: duplicatesPlural(dupCount) }, "{duplicates} détecté(s) (variantes d'orthographe : T.N.T./TNT, Romeo & Juliet/Romeo and Juliet…). Conserve la version avec le cache le plus riche, redirige les setlists.")
            : t('maintenance.no-dup', 'Aucun doublon détecté dans la base.')}
        </div>
        {dupCount > 0 && <button onClick={mergeDuplicates} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{tFormat('maintenance.merge-button', { count: dupCount }, 'Fusionner ({count})')}</button>}
      </div>

      {/* Phase 7.20 — Dédup par id (collisions Date.now() / migrations). */}
      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('maintenance.dedup-by-id', 'Dédupliquer la base (par id)')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          {idDupCount > 0
            ? tFormat('maintenance.id-dup-detected', { entries: tPlural('maintenance.entries', idDupCount, {}, { one: '1 entrée', other: '{count} entrées' }) }, "{entries} avec un id en doublon (collisions Date.now() ou anciennes migrations). Conserve la première occurrence, fusionne aiCache et feedbacks.")
            : t('maintenance.no-id-dup', 'Aucun id dupliqué dans la base.')}
        </div>
        {idDupCount > 0 && <button data-testid="maint-dedup-songdb-by-id" onClick={mergeIdDuplicates} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{tFormat('maintenance.dedup-button', { count: idDupCount }, 'Dédupliquer ({count})')}</button>}
      </div>

      <div style={{ background: 'var(--a3)', border: '1px solid var(--brass-400)', borderLeftWidth: 3, borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📐</span><span>{t('maintenance.local-scoring', 'Scoring local')}</span>
        </div>
        <div>
          <button onClick={() => {
            try {
              const updated = songDb.map((s) => {
                if (!s.aiCache?.result?.cot_step1) return s;
                const gId = s.aiCache.gId || '';
                const gType = findGuitar(gId)?.type || 'HB';
                const cleaned = { ...s.aiCache.result, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null };
                const recalc = enrichAIResult(cleaned, gType, gId, banksAnn, banksPlug);
                return { ...s, aiCache: { ...updateAiCache(s.aiCache, gId, recalc), sv: SCORING_VERSION } };
              });
              onSongDb(() => updated);
            } catch (e) { console.warn('Rescore error:', e); }
            setDone(true); setTimeout(() => setDone(false), 3000);
          }} style={{ background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>{tFormat('maintenance.rescore-button', { songs: songsPlural(songDb.filter((s) => s.aiCache).length) }, '📐 Recalculer les scores (sans IA) — {songs} en cache')}</button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.4 }}>{t('maintenance.rescore-hint', 'Réapplique le scoring sur les analyses existantes. À utiliser après avoir ajouté un preset ToneNET ou modifié tes banks.')}</div>
        </div>
      </div>

      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('maintenance.backups', 'Sauvegardes automatiques')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('maintenance.backups-hint', "L'app sauvegarde automatiquement tes données toutes les 5 minutes. Tu peux restaurer un état précédent en cas de problème.")}</div>
        {(() => {
          const backups = listBackups();
          if (!backups.length) return <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('maintenance.no-backups', 'Aucune sauvegarde disponible.')}</div>;
          return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {backups.map((b, i) => {
              const d = new Date(b.time);
              const ago = Math.round((Date.now() - b.time) / 60000);
              const locale = getLocale();
              const label = ago < 60
                ? tFormat('maintenance.backup-ago-min', { min: ago }, 'il y a {min} min')
                : ago < 1440
                  ? tFormat('maintenance.backup-ago-hour', { h: Math.round(ago / 60) }, 'il y a {h}h')
                  : `${d.toLocaleDateString(locale)} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
              return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tFormat('maintenance.backup-content', { songs: songsPlural(b.songs), profiles: tPlural('maintenance.profiles', b.profiles, {}, { one: '1 profil', other: '{count} profils' }) }, '{songs} · {profiles}')}</div>
                </div>
                <button onClick={() => { if (confirm(t('maintenance.restore-confirm', 'Restaurer cette sauvegarde ? Les données actuelles seront remplacées.'))) { restoreBackup(i); location.reload(); } }} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('maintenance.restore', 'Restaurer')}</button>
              </div>;
            })}
          </div>;
        })()}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <button data-testid="maint-clear-backups" onClick={() => {
            const n = listBackups().length;
            if (n === 0) { window.alert(t('maintenance.no-backups-to-clear', 'Aucune sauvegarde à supprimer.')); return; }
            if (!window.confirm(tFormat('maintenance.clear-backups-confirm', { backups: tPlural('maintenance.backups-plural', n, {}, { one: '1 sauvegarde', other: '{count} sauvegardes' }) }, 'Vider les {backups} stockées localement ? Les données actuelles ne sont pas affectées.'))) return;
            clearBackups();
            location.reload();
          }} style={{ background: 'var(--a5)', border: '1px solid var(--a8)', color: 'var(--text-muted)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>{t('maintenance.clear-backups', '🗑 Vider les sauvegardes')}</button>
        </div>
      </div>

      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('maintenance.setlists-dup', 'Setlists — doublons')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('maintenance.setlists-dup-hint', 'Deux modes de dédup. Mode strict (gentle) = même nom ET mêmes profils. Mode aggressif = même nom seul, fusionne les profils en union.')}</div>
        {(() => {
          const strictRes = dedupSetlistsWithTombstones(setlists);
          const dedupedStrict = strictRes.setlists;
          const tombstonesStrict = strictRes.tombstones;
          const removedStrict = setlists.length - dedupedStrict.length;
          const looseRes = dedupSetlistsWithTombstones(setlists, { mergeAcrossProfiles: true });
          const dedupedLoose = looseRes.setlists;
          const tombstonesLoose = looseRes.tombstones;
          const removedLoose = setlists.length - dedupedLoose.length;
          const removedExtra = removedLoose - removedStrict;
          const dupByName = findSetlistDuplicatesByName(setlists);
          const nameOnlyGroups = dupByName.filter((g) => {
            const keys = new Set(g.items.map((sl) => (Array.isArray(sl.profileIds) ? [...sl.profileIds].sort().join('|') : '')));
            return keys.size > 1;
          });
          return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', flex: 1, minWidth: 160 }}>
                <b style={{ color: 'var(--text-muted)' }}>{t('maintenance.strict', 'Strict')}</b> {t('maintenance.strict-criteria', '(name + profils) :')}
                {removedStrict <= 0
                  ? <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}> {t('maintenance.no-dup-short', 'aucun doublon')}</span>
                  : ` ${duplicatesPlural(removedStrict)}`}
              </div>
              {removedStrict > 0 && <button data-testid="maint-dedup-setlists" onClick={() => {
                const msg = tFormat('maintenance.strict-confirm', { setlists: setlistsPlural(removedStrict) }, '{setlists} doublon(s) détecté(s) (même nom ET mêmes profils).\n\nLa version la plus complète est conservée, morceaux fusionnés. Confirmer ?');
                if (!window.confirm(msg)) return;
                onSetlists(() => dedupedStrict);
                if (onDeletedSetlistIds && Object.keys(tombstonesStrict).length) {
                  onDeletedSetlistIds((prev) => ({ ...(prev || {}), ...tombstonesStrict }));
                }
              }} style={{ background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>{t('maintenance.merge-strict', '🧹 Fusionner strict')}</button>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--a7)', paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', flex: 1, minWidth: 160 }}>
                <b style={{ color: 'var(--text-muted)' }}>{t('maintenance.aggressive', 'Aggressif')}</b> {t('maintenance.aggressive-criteria', '(name seul, fusionne profils) :')}
                {nameOnlyGroups.length === 0
                  ? <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}> {t('maintenance.no-extra-dup', 'aucun doublon supplémentaire')}</span>
                  : ` ${tFormat('maintenance.groups', { count: nameOnlyGroups.length, names: nameOnlyGroups.map((g) => g.name).join(', ') }, '{count} groupe(s) ({names})')}`}
              </div>
              {removedExtra > 0 && <button data-testid="maint-dedup-setlists-loose" onClick={() => {
                const lines = nameOnlyGroups.map((g) => `• "${g.name}" → ${g.items.length} versions, profils fusionnés [${g.profileIdsUnion.join(', ')}]`).join('\n');
                const msg = tFormat('maintenance.aggressive-confirm', { setlists: setlistsPlural(removedExtra), lines }, '{setlists} doublon(s) par nom seul (profils différents) :\n\n{lines}\n\nLa version la plus complète est conservée, profils ET morceaux fusionnés. Confirmer ?');
                if (!window.confirm(msg)) return;
                onSetlists(() => dedupedLoose);
                if (onDeletedSetlistIds && Object.keys(tombstonesLoose).length) {
                  onDeletedSetlistIds((prev) => ({ ...(prev || {}), ...tombstonesLoose }));
                }
              }} style={{ background: 'var(--wine-400)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>{t('maintenance.merge-aggressive', '⚡ Fusionner aggressif')}</button>}
            </div>
          </div>;
        })()}
      </div>

      {/* Phase 7.24 — Toggle mode no-sync (beta testeurs). */}
      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('maintenance.local-mode', 'Mode local (pas de sync Firestore)')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
          {t('maintenance.local-mode-hint', "Désactive complètement la synchronisation Firestore : tes données restent uniquement sur cet appareil. Utile pour tester l'app en isolation (beta testeurs Reddit) sans collisions avec d'autres utilisateurs. Au prochain reload, l'icône sync passe en 🔒.")}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic' }}>
          {isNoSyncMode() ? t('maintenance.local-mode-active', '🔒 Mode local actif — aucun appel Firestore.') : t('maintenance.sync-active', '☁️ Sync Firestore actif (par défaut).')}
        </div>
        <button
          data-testid="maint-toggle-no-sync"
          onClick={() => {
            const nextOn = !isNoSyncMode();
            const msg = nextOn
              ? t('maintenance.local-mode-on-confirm', "Activer le mode local ?\n\n• Les modifications ne seront PLUS syncées vers tes autres appareils.\n• Les morceaux et profils sont stockés uniquement dans ce navigateur.\n• Les autres profils (Arthur, Franck) ne verront pas tes modifications.\n• Tu peux revenir en mode sync à tout moment.\n\nL'app va se recharger pour appliquer.")
              : t('maintenance.local-mode-off-confirm', 'Désactiver le mode local ?\n\n• Reprise de la sync Firestore au prochain reload.\n• Tes données locales seront fusionnées avec le state remote (LWW per record).\n\nContinuer ?');
            if (!window.confirm(msg)) return;
            setNoSyncMode(nextOn);
            location.reload();
          }}
          style={{ background: isNoSyncMode() ? 'var(--accent)' : 'var(--a7)', border: 'none', color: isNoSyncMode() ? 'var(--text-inverse)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >{isNoSyncMode() ? t('maintenance.reactivate-sync', '☁️ Réactiver la sync') : t('maintenance.activate-local', '🔒 Activer le mode local')}</button>
      </div>

      <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>{t('maintenance.reset-title', 'Réinitialiser toutes les données')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('maintenance.reset-hint', "Remet l'app à zéro : profils, banks, morceaux. Les presets par défaut et le profil initial seront restaurés.")}</div>
        {!confirmReset
          ? <button onClick={() => setConfirmReset(true)} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('maintenance.reset-button', 'Réinitialiser...')}</button>
          : <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--r-md)', padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700, marginBottom: 8 }}>{t('maintenance.reset-warning', 'Toutes les données seront supprimées. Cette action est irréversible.')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { localStorage.removeItem('tonex_guide_v2'); localStorage.removeItem('tonex_guide_v1'); location.reload(); }} style={{ background: 'var(--danger)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('maintenance.reset-confirm', 'Confirmer la réinitialisation')}</button>
              <button onClick={() => setConfirmReset(false)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>{t('maintenance.cancel', 'Annuler')}</button>
            </div>
          </div>
        }
      </div>

      {/* Phase 7.51.4 — Exporter snapshot démo (admin) */}
      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('maintenance.demo-export-title', '📦 Exporter snapshot démo (admin)')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          {t('maintenance.demo-export-hint', 'Génère un JSON à partir du profil actif (ses setlists + songs + aiCache) à utiliser pour remplacer src/data/demo-profile.json. Le profil exporté est forcé id=demo, isDemo=true, isAdmin=false, password=null. Les aiKeys + loginHistory sont vidés.')}
        </div>
        <button
          data-testid="maintenance-export-demo-snapshot"
          onClick={() => {
            const snap = buildDemoSnapshot(profile, setlists, songDb);
            if (!snap) { window.alert(t('maintenance.demo-export-error', 'Échec de la construction du snapshot.')); return; }
            const json = JSON.stringify(snap, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'demo-profile.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          style={{ background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
        >{t('maintenance.demo-export-button', '📦 Exporter snapshot démo')}</button>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
          {t('maintenance.demo-export-workflow', 'Workflow : cure un profil dédié → switche dessus → clique ce bouton → remplace src/data/demo-profile.json par le téléchargé → commit + push + bump version.')}
        </div>
      </div>
    </div>
  );
}

export default MaintenanceTab;
export { MaintenanceTab };
