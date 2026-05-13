// src/app/screens/MaintenanceTab.jsx — Phase 7.19 (découpage main.jsx).
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
import { GUITARS, findGuitar } from '../../core/guitars.js';
import { SCORING_VERSION } from '../../core/scoring/index.js';
import {
  listBackups, restoreBackup, clearBackups,
  dedupSetlistsWithTombstones, findSetlistDuplicatesByName,
  dedupSongDb,
} from '../../core/state.js';
import { normalizeSongTitle, normalizeArtist } from '../utils/song-helpers.js';
import { enrichAIResult, updateAiCache } from '../utils/ai-helpers.js';
import { fetchAI } from '../utils/fetchAI.js';

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

  const mergeIdDuplicates = () => {
    if (idDupCount <= 0) return;
    if (!window.confirm(`${idDupCount} entrée${idDupCount > 1 ? 's' : ''} avec id dupliqué dans la base.\n\nLa première occurrence de chaque id est conservée, les aiCache et feedbacks sont fusionnés.\n\nConfirmer ?`)) return;
    const { songs, removed } = dedupSongDb(songDb);
    onSongDb(() => songs);
    setDone(true); setTimeout(() => setDone(false), 3000);
  };

  const mergeDuplicates = () => {
    if (!duplicateGroups.length) return;
    const lines = duplicateGroups.map((g) => '• ' + g.map((s) => `"${s.title}" — ${s.artist}`).join(' / ')).join('\n');
    if (!window.confirm(`${dupCount} doublon${dupCount > 1 ? 's' : ''} à fusionner :\n\n${lines}\n\nLa version la plus riche en cache est conservée, les setlists sont redirigées.`)) return;
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
    setRecalculating(true); setDone(false);
    const total = songDb.length;
    setProgress({ done: 0, total, current: '' });
    for (let i = 0; i < songDb.length; i++) {
      const s = songDb[i];
      setProgress({ done: i, total, current: s.title });
      try {
        const r = await fetchAI(s, '', banksAnn, banksPlug, aiProvider, aiKeys, GUITARS, null, null, profile?.recoMode || 'balanced', guitarBias);
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
    if (!window.confirm(`Rafraîchir l'IA pour ${n} morceau${n > 1 ? 'x' : ''} ?\n\nLe cache est vidé immédiatement. Le recalcul IA se fera passivement à l'ouverture de chaque morceau (incluant tes nouvelles guitares).\n\nAucun appel API n'est lancé maintenant.`)) return;
    onSongDb((p) => p.map((s) => ({ ...s, aiCache: null })));
    setDone(true); setTimeout(() => setDone(false), 4000);
  };

  const recalcAllConfirmed = () => {
    const n = songDb.length;
    const estimSec = Math.round(n * 5);
    const estimMin = Math.ceil(estimSec / 60);
    const dureeLabel = estimMin >= 2 ? `~${estimMin} minutes` : `~${estimSec} secondes`;
    if (!window.confirm(`Forcer le recalcul IA EN BLOC pour ${n} morceau${n > 1 ? 'x' : ''} ?\n\n• Durée estimée : ${dureeLabel}\n• Appels API : ${n}\n• Consomme du quota API\n\nNe ferme pas l'app pendant le traitement. Préfère "Rafraîchir l'IA" si tu n'as pas besoin du résultat immédiatement.`)) return;
    recalcAll();
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 16 }}>Outils de maintenance de l'application.</div>

      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🤖</span><span>Mes analyses IA</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>{cachedCount} morceau{cachedCount > 1 ? 'x' : ''} en cache sur {songDb.length}</div>
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
          : done ? <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Terminé !</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <button onClick={refreshAI} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🔄 Rafraîchir l'IA (tous morceaux)</button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.4 }}>Vide le cache et relance l'IA passivement à l'ouverture de chaque morceau. À utiliser après avoir ajouté des guitares ou changé ton matériel.</div>
              </div>
              <div>
                <button onClick={recalcAllConfirmed} style={{ background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>⚡ Forcer le recalcul IA en bloc — {songDb.length} morceau{songDb.length > 1 ? 'x' : ''}</button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.4 }}>Lance immédiatement l'IA pour tous les morceaux, en bloc. Long et consomme du quota API.</div>
              </div>
            </div>}
      </div>

      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Fusionner les doublons</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          {dupCount > 0
            ? `${dupCount} morceau${dupCount > 1 ? 'x' : ''} doublon${dupCount > 1 ? 's' : ''} détecté${dupCount > 1 ? 's' : ''} (variantes d'orthographe : T.N.T./TNT, Romeo & Juliet/Romeo and Juliet…). Conserve la version avec le cache le plus riche, redirige les setlists.`
            : 'Aucun doublon détecté dans la base.'}
        </div>
        {dupCount > 0 && <button onClick={mergeDuplicates} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Fusionner ({dupCount})</button>}
      </div>

      {/* Phase 7.20 — Dédup par id (collisions Date.now() / migrations). */}
      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Dédupliquer la base (par id)</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          {idDupCount > 0
            ? `${idDupCount} entrée${idDupCount > 1 ? 's' : ''} avec un id en doublon (collisions Date.now() ou anciennes migrations). Conserve la première occurrence, fusionne aiCache et feedbacks.`
            : 'Aucun id dupliqué dans la base.'}
        </div>
        {idDupCount > 0 && <button data-testid="maint-dedup-songdb-by-id" onClick={mergeIdDuplicates} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Dédupliquer ({idDupCount})</button>}
      </div>

      <div style={{ background: 'var(--a3)', border: '1px solid var(--brass-400)', borderLeftWidth: 3, borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📐</span><span>Scoring local</span>
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
          }} style={{ background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>📐 Recalculer les scores (sans IA) — {songDb.filter((s) => s.aiCache).length} morceau{songDb.filter((s) => s.aiCache).length > 1 ? 'x' : ''} en cache</button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.4 }}>Réapplique le scoring sur les analyses existantes. À utiliser après avoir ajouté un preset ToneNET ou modifié tes banks.</div>
        </div>
      </div>

      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Sauvegardes automatiques</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>L'app sauvegarde automatiquement tes données toutes les 5 minutes. Tu peux restaurer un état précédent en cas de problème.</div>
        {(() => {
          const backups = listBackups();
          if (!backups.length) return <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Aucune sauvegarde disponible.</div>;
          return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {backups.map((b, i) => {
              const d = new Date(b.time);
              const ago = Math.round((Date.now() - b.time) / 60000);
              const label = ago < 60 ? `il y a ${ago} min` : ago < 1440 ? `il y a ${Math.round(ago / 60)}h` : `${d.toLocaleDateString('fr')} ${d.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}`;
              return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{b.songs} morceaux · {b.profiles} profil{b.profiles > 1 ? 's' : ''}</div>
                </div>
                <button onClick={() => { if (confirm('Restaurer cette sauvegarde ? Les données actuelles seront remplacées.')) { restoreBackup(i); location.reload(); } }} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Restaurer</button>
              </div>;
            })}
          </div>;
        })()}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <button data-testid="maint-clear-backups" onClick={() => {
            const n = listBackups().length;
            if (n === 0) { window.alert('Aucune sauvegarde à supprimer.'); return; }
            if (!window.confirm(`Vider les ${n} sauvegarde${n > 1 ? 's' : ''} stockées localement ? Les données actuelles ne sont pas affectées.`)) return;
            clearBackups();
            location.reload();
          }} style={{ background: 'var(--a5)', border: '1px solid var(--a8)', color: 'var(--text-muted)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>🗑 Vider les sauvegardes</button>
        </div>
      </div>

      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Setlists — doublons</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Deux modes de dédup. Mode strict (gentle) = même nom ET mêmes profils. Mode aggressif = même nom seul, fusionne les profils en union.</div>
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
                <b style={{ color: 'var(--text-muted)' }}>Strict</b> (name + profils) :
                {removedStrict <= 0 ? <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}> aucun doublon</span> : ` ${removedStrict} doublon${removedStrict > 1 ? 's' : ''}`}
              </div>
              {removedStrict > 0 && <button data-testid="maint-dedup-setlists" onClick={() => {
                const msg = `${removedStrict} setlist${removedStrict > 1 ? 's' : ''} doublon${removedStrict > 1 ? 's' : ''} détecté${removedStrict > 1 ? 's' : ''} (même nom ET mêmes profils).\n\nLa version la plus complète est conservée, morceaux fusionnés. Confirmer ?`;
                if (!window.confirm(msg)) return;
                onSetlists(() => dedupedStrict);
                if (onDeletedSetlistIds && Object.keys(tombstonesStrict).length) {
                  onDeletedSetlistIds((prev) => ({ ...(prev || {}), ...tombstonesStrict }));
                }
              }} style={{ background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>🧹 Fusionner strict</button>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--a7)', paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', flex: 1, minWidth: 160 }}>
                <b style={{ color: 'var(--text-muted)' }}>Aggressif</b> (name seul, fusionne profils) :
                {nameOnlyGroups.length === 0 ? <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}> aucun doublon supplémentaire</span> : ` ${nameOnlyGroups.length} groupe${nameOnlyGroups.length > 1 ? 's' : ''} (${nameOnlyGroups.map((g) => g.name).join(', ')})`}
              </div>
              {removedExtra > 0 && <button data-testid="maint-dedup-setlists-loose" onClick={() => {
                const lines = nameOnlyGroups.map((g) => `• "${g.name}" → ${g.items.length} versions, profils fusionnés [${g.profileIdsUnion.join(', ')}]`).join('\n');
                const msg = `${removedExtra} setlist${removedExtra > 1 ? 's' : ''} doublon${removedExtra > 1 ? 's' : ''} par nom seul (profils différents) :\n\n${lines}\n\nLa version la plus complète est conservée, profils ET morceaux fusionnés. Confirmer ?`;
                if (!window.confirm(msg)) return;
                onSetlists(() => dedupedLoose);
                if (onDeletedSetlistIds && Object.keys(tombstonesLoose).length) {
                  onDeletedSetlistIds((prev) => ({ ...(prev || {}), ...tombstonesLoose }));
                }
              }} style={{ background: 'var(--wine-400)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>⚡ Fusionner aggressif</button>}
            </div>
          </div>;
        })()}
      </div>

      <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Réinitialiser toutes les données</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Remet l'app à zéro : profils, banks, morceaux. Les presets par défaut et le profil initial seront restaurés.</div>
        {!confirmReset
          ? <button onClick={() => setConfirmReset(true)} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Réinitialiser...</button>
          : <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--r-md)', padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700, marginBottom: 8 }}>Toutes les données seront supprimées. Cette action est irréversible.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { localStorage.removeItem('tonex_guide_v2'); localStorage.removeItem('tonex_guide_v1'); location.reload(); }} style={{ background: 'var(--danger)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Confirmer la réinitialisation</button>
              <button onClick={() => setConfirmReset(false)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
            </div>
          </div>
        }
      </div>
    </div>
  );
}

export default MaintenanceTab;
export { MaintenanceTab };
