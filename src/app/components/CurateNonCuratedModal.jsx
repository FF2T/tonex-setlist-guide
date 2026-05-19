// src/app/components/CurateNonCuratedModal.jsx — Phase 7.78.
//
// Modale admin pour transformer les presets 🟠 non curés en 🔵 curated
// (perso pour custom/ToneNET, admin pour catalog statique → message).
//
// Scope MVP : édition runtime uniquement pour src ∈ {custom, ToneNET}.
// Les autres sources (TSR/ML/AA/JS/TJ/WT/Galtone/Anniversary/Factory) →
// section read-only avec note "édite le catalog source code".
//
// Réutilise le pattern usages éditable de ToneNetTab Phase 7.53
// (input artiste + tags songs + Enter add).

import React, { useState, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import { findCatalogEntry } from '../../core/catalog.js';
import { cleanUsages } from '../screens/ToneNetTab.jsx';

// Initialise les usages d'un preset à partir de son entry catalog.
// Retourne [{artist, songs:[]}] mutable pour édition. Clone profond.
function initUsages(entry) {
  if (!entry || !Array.isArray(entry.usages)) return [];
  return entry.usages.map((u) => ({
    artist: u.artist || '',
    songs: Array.isArray(u.songs) ? [...u.songs] : [],
  }));
}

/**
 * Props :
 *   - nonCurated: [{name, src, editable}] (cf detectAllNonCurated)
 *   - songDb: songs[] pour datalist autocomplete (title + artist)
 *   - onConfirm: (usagesByName) => void
 *     usagesByName = { [presetName]: usages|undefined }
 *     Seuls les presets modifiés sont dans la map. undefined = retirer usages.
 *   - onCancel: () => void
 */
function CurateNonCuratedModal({ nonCurated, songDb, onConfirm, onCancel }) {
  const editables = useMemo(() => nonCurated.filter((p) => p.editable), [nonCurated]);
  const readonly = useMemo(() => nonCurated.filter((p) => !p.editable), [nonCurated]);

  // State : usagesByName = { [name]: [{artist, songs}] } pour les editables.
  // Initialisé depuis l'entry existante (au cas où des usages partiels
  // existaient déjà).
  const [usagesByName, setUsagesByName] = useState(() => {
    const out = {};
    editables.forEach((p) => {
      const entry = findCatalogEntry(p.name);
      out[p.name] = initUsages(entry);
    });
    return out;
  });

  // Drafts songs (input courant non-pushé) — { [name]: { [artistIdx]: typed } }.
  const [songDrafts, setSongDrafts] = useState({});

  // Datalists pré-calculées.
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

  // Helpers manipulation usages d'un preset donné
  const updatePresetUsages = (name, updater) => {
    setUsagesByName((prev) => ({ ...prev, [name]: updater(prev[name] || []) }));
  };

  const addArtist = (name) => {
    updatePresetUsages(name, (us) => [...us, { artist: '', songs: [] }]);
  };

  const setArtist = (name, idx, value) => {
    updatePresetUsages(name, (us) => us.map((u, i) => i === idx ? { ...u, artist: value } : u));
  };

  const removeArtist = (name, idx) => {
    updatePresetUsages(name, (us) => us.filter((_, i) => i !== idx));
    setSongDrafts((prev) => { const next = { ...prev }; delete next[name]; return next; });
  };

  const addSong = (name, idx, song) => {
    const v = String(song || '').trim();
    if (!v) return;
    updatePresetUsages(name, (us) => us.map((u, i) =>
      i === idx ? { ...u, songs: Array.from(new Set([...(u.songs || []), v])) } : u,
    ));
  };

  const removeSong = (name, artistIdx, songIdx) => {
    updatePresetUsages(name, (us) => us.map((u, i) =>
      i === artistIdx ? { ...u, songs: (u.songs || []).filter((_, j) => j !== songIdx) } : u,
    ));
  };

  // Flush songDrafts dans usages avant onConfirm.
  const flushSongDraftsForPreset = (name, usages) => {
    const drafts = songDrafts[name] || {};
    return usages.map((u, idx) => {
      const draft = (drafts[idx] || '').trim();
      if (!draft) return u;
      return { ...u, songs: Array.from(new Set([...(u.songs || []), draft])) };
    });
  };

  const handleConfirm = () => {
    const out = {};
    editables.forEach((p) => {
      const raw = usagesByName[p.name] || [];
      const flushed = flushSongDraftsForPreset(p.name, raw);
      const cleaned = cleanUsages(flushed);
      // cleaned = undefined si tout est vide → on retirera le champ usages
      // de l'entry (cas où l'admin vide volontairement la curation).
      out[p.name] = cleaned;
    });
    onConfirm(out);
  };

  // Compteur presets avec au moins 1 artiste non-vide.
  const editedCount = editables.filter((p) => {
    const us = usagesByName[p.name] || [];
    return us.some((u) => (u.artist || '').trim());
  }).length;

  const inp = {
    background: 'var(--bg-elev-1)', color: 'var(--text)',
    border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)',
    padding: '4px 6px',
  };

  const renderEditable = (p) => {
    const usages = usagesByName[p.name] || [];
    return (
      <div key={p.name} style={{ background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{p.name}</span>
          <span style={{ fontSize: 9, background: 'var(--a7)', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '1px 5px' }}>{p.src}</span>
        </div>
        {usages.map((u, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-elev-1)', borderRadius: 'var(--r-sm)', padding: 6, marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                placeholder={t('curate.artist-placeholder', 'Artiste (ex: Metallica)')}
                list="curate-artist-list"
                value={u.artist}
                onChange={(e) => setArtist(p.name, idx, e.target.value)}
                style={{ ...inp, flex: 1, fontSize: 12 }}
              />
              <button
                type="button"
                onClick={() => removeArtist(p.name, idx)}
                style={{ background: 'var(--red-bg)', border: 'none', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: 10, color: 'var(--danger, #ef4444)', cursor: 'pointer' }}
                title={t('curate.remove-artist', 'Retirer cet artiste')}
              >✕</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              {(u.songs || []).map((song, si) => (
                <span key={si} style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-sm)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  {song}
                  <button type="button" onClick={() => removeSong(p.name, idx, si)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 10, cursor: 'pointer', padding: 0 }}>×</button>
                </span>
              ))}
              <input
                placeholder={t('curate.song-add', '+ Morceau (Enter pour ajouter)')}
                list="curate-song-list"
                value={(songDrafts[p.name] && songDrafts[p.name][idx]) || ''}
                onChange={(e) => setSongDrafts((prev) => ({ ...prev, [p.name]: { ...(prev[p.name] || {}), [idx]: e.target.value } }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = ((songDrafts[p.name] && songDrafts[p.name][idx]) || '').trim();
                    if (!v) return;
                    addSong(p.name, idx, v);
                    setSongDrafts((prev) => ({ ...prev, [p.name]: { ...(prev[p.name] || {}), [idx]: '' } }));
                  }
                }}
                style={{ ...inp, flex: 1, minWidth: 120, fontSize: 11 }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addArtist(p.name)}
          style={{ background: 'transparent', border: '1px dashed var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: 6, fontSize: 11, cursor: 'pointer', width: '100%' }}
        >+ {t('curate.add-artist', 'Ajouter un artiste')}</button>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-elev-1)', borderRadius: 'var(--r-lg)', padding: 18, maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brass-300)', marginBottom: 6 }}>
          🟠 {tFormat('curate.title', { n: nonCurated.length }, 'Curer {n} preset(s) non curé(s)')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 12 }}>
          {t('curate.hint', 'Ajoute des usages artiste/morceau pour qu\'un preset soit pin direct par l\'IA. Sources éditables runtime : custom (tes presets persos) + ToneNET. Pour les catalogs statiques (TSR/AA/JS/...), édite le source code (Phase 11 future : enrichissement par les studios partenaires).')}
        </div>

        {/* Section 1 — Éditables (custom + ToneNET) */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
            ✏️ {tFormat('curate.section-editable', { n: editables.length, ok: editedCount }, 'Éditables ({n}, {ok} renseignés)')}
          </div>
          {editables.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', padding: 10, background: 'var(--a3)', borderRadius: 'var(--r-md)' }}>
              {t('curate.section-editable-empty', 'Aucun preset éditable depuis l\'app. Tous les non-curés viennent de catalogs statiques (cf section ci-dessous).')}
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {editables.map(renderEditable)}
            </div>
          )}
        </div>

        {/* Section 2 — Non éditables (catalog statique) */}
        {readonly.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              📦 {tFormat('curate.section-readonly', { n: readonly.length }, 'Catalogs statiques ({n}, édition source code requise)')}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontStyle: 'italic' }}>
              {t('curate.section-readonly-hint', 'Ces presets viennent de catalogs Backline. Pour ajouter des usages, édite le source code (data_catalogs.js, anniversary-premium-catalog.js, etc.) ou attends Phase 11 (Studio-driven enrichment).')}
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: 6 }}>
              {readonly.map((p) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', fontSize: 11, color: 'var(--text-sec)' }}>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 9, background: 'var(--a7)', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '1px 5px' }}>{p.src || '?'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Datalists partagées */}
        <datalist id="curate-artist-list">
          {artistList.map((a) => <option key={a} value={a}/>)}
        </datalist>
        <datalist id="curate-song-list">
          {songList.map((s) => <option key={s} value={s}/>)}
        </datalist>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'var(--a7)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {t('curate.cancel', 'Annuler')}
          </button>
          <button onClick={handleConfirm} disabled={editables.length === 0} style={{ flex: 2, background: editables.length > 0 ? 'var(--accent)' : 'var(--a7)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: 9, fontSize: 13, fontWeight: 700, cursor: editables.length > 0 ? 'pointer' : 'not-allowed' }}>
            {t('curate.confirm', 'Enregistrer les usages →')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CurateNonCuratedModal;
export { CurateNonCuratedModal };
