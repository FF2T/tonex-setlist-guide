// src/app/components/PresetCurationModal.jsx — Phase 7.79.
//
// Modale unifiée info preset + édition usages inline.
//
// Mode "view" (default) :
//   - Affiche status + amp/gain/style/scores + usages + pack
//   - Bouton "✏️ Modifier" si entry éditable (src ∈ {custom, ToneNET})
//     ET isAdmin → bascule en mode "edit" inline
//   - Catalog statique : bouton désactivé + note "édite le code source"
//
// Mode "edit" :
//   - Form usages [{artist, songs?}] (réutilise pattern Phase 7.78)
//   - Save → update profile.customPacks ou shared.toneNetPresets
//     avec stamp lastModified (LWW Firestore)
//   - Cancel → revient en mode view sans appliquer

import React, { useState, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import { findCatalogEntry, getPresetCurationStatus, CURATION_COLORS, getCurationLabel } from '../../core/catalog.js';
import { cleanUsages } from '../screens/ToneNetTab.jsx';

const EDITABLE_SOURCES = new Set(['custom', 'ToneNET']);

const STATUS_ICONS = {
  unknown: '🔴',
  known: '🟠',
  'curated-perso': '🔵',
  'curated-admin': '🔵',
  'curated-studio': '🔵',
};

function PresetCurationModal({
  presetName,
  isAdmin,
  songDb,
  profile, onProfiles, activeProfileId,
  toneNetPresets, onToneNetPresets,
  onClose,
}) {
  const entry = useMemo(() => findCatalogEntry(presetName), [presetName]);
  const status = useMemo(() => getPresetCurationStatus(presetName), [presetName]);
  const colors = status ? CURATION_COLORS[status] : null;
  const editable = !!entry && !entry.guessed && EDITABLE_SOURCES.has(entry.src) && isAdmin;

  const [mode, setMode] = useState('view');
  const [usages, setUsages] = useState(() => {
    if (!entry || !Array.isArray(entry.usages)) return [];
    return entry.usages.map((u) => ({
      artist: u.artist || '',
      songs: Array.isArray(u.songs) ? [...u.songs] : [],
    }));
  });
  const [songDrafts, setSongDrafts] = useState({});

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

  const flushDrafts = (rawUsages) => rawUsages.map((u, idx) => {
    const draft = (songDrafts[idx] || '').trim();
    if (!draft) return u;
    return { ...u, songs: Array.from(new Set([...(u.songs || []), draft])) };
  });

  const handleSave = () => {
    if (!entry) return;
    const flushed = flushDrafts(usages);
    const cleaned = cleanUsages(flushed); // undefined si tout vide

    if (entry.src === 'custom') {
      // Update profile.customPacks[].presets[].usages
      onProfiles((p) => {
        const cur = p[activeProfileId];
        if (!cur) return p;
        const packs = (cur.customPacks || []).map((pack) => ({
          ...pack,
          presets: (pack.presets || []).map((pr) => {
            if (pr.name !== presetName) return pr;
            if (!cleaned) {
              const { usages: _, ...rest } = pr;
              return rest;
            }
            return { ...pr, usages: cleaned };
          }),
        }));
        return { ...p, [activeProfileId]: { ...cur, customPacks: packs, lastModified: Date.now() } };
      });
    } else if (entry.src === 'ToneNET' && typeof onToneNetPresets === 'function') {
      // Update shared.toneNetPresets[].usages
      onToneNetPresets((prev) => {
        return (prev || []).map((tp) => {
          if (tp.name !== presetName) return tp;
          const stamped = { ...tp, lastModified: Date.now() };
          if (!cleaned) {
            const { usages: _, ...rest } = stamped;
            return rest;
          }
          return { ...stamped, usages: cleaned };
        });
      });
    }
    setMode('view');
  };

  if (!entry) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={dialogStyle}>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>{t('preset-modal.not-found', 'Aucune information catalog pour ce preset.')}</div>
          <button onClick={onClose} style={btnSecondary}>{t('preset-modal.close', 'Fermer')}</button>
        </div>
      </div>
    );
  }

  const renderViewMode = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{STATUS_ICONS[status] || ''}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors?.dot || 'var(--text)' }}>
          {getCurationLabel(status)}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12, wordBreak: 'break-word' }}>{presetName}</div>

      <div style={{ background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: 10, marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: 11 }}>
          {entry.src && (<><span style={{ color: 'var(--text-muted)' }}>{t('preset-modal.source', 'Source')}</span><span style={{ color: 'var(--text)' }}>{entry.src}{entry.pack ? ' · ' + entry.pack : ''}</span></>)}
          {entry.amp && (<><span style={{ color: 'var(--text-muted)' }}>{t('preset-modal.amp', 'Ampli')}</span><span style={{ color: 'var(--text)' }}>{entry.amp}</span></>)}
          {entry.gain && (<><span style={{ color: 'var(--text-muted)' }}>{t('preset-modal.gain', 'Gain')}</span><span style={{ color: 'var(--text)' }}>{entry.gain}</span></>)}
          {entry.style && (<><span style={{ color: 'var(--text-muted)' }}>{t('preset-modal.style', 'Style')}</span><span style={{ color: 'var(--text)' }}>{entry.style}</span></>)}
          {entry.channel && (<><span style={{ color: 'var(--text-muted)' }}>{t('preset-modal.channel', 'Canal')}</span><span style={{ color: 'var(--text)' }}>{entry.channel}</span></>)}
          {entry.scores && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>{t('preset-modal.scores', 'Scores')}</span>
              <span style={{ color: 'var(--text)' }}>HB:{entry.scores.HB ?? '-'} · SC:{entry.scores.SC ?? '-'} · P90:{entry.scores.P90 ?? '-'}</span>
            </>
          )}
        </div>
      </div>

      {Array.isArray(entry.usages) && entry.usages.length > 0 ? (
        <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-md)', padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>🎯 {t('preset-modal.usages', 'Usages')}</div>
          {entry.usages.map((u, idx) => (
            <div key={idx} style={{ marginBottom: 4, fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>• {u.artist}</span>
              {Array.isArray(u.songs) && u.songs.length > 0 && (
                <div style={{ marginLeft: 14, color: 'var(--text-sec)' }}>
                  {u.songs.map((s, si) => <div key={si}>{s}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 10, padding: 8, background: 'var(--a3)', borderRadius: 'var(--r-sm)' }}>
          {t('preset-modal.no-usages', 'Aucun usage artiste/morceau enregistré pour ce preset.')}
        </div>
      )}

      {!editable && status === 'known' && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 10 }}>
          {t('preset-modal.readonly-note', 'Preset du catalog statique. Pour ajouter des usages, édite le code source (data_catalogs.js, etc.) ou attends Phase 11 (Studio-driven enrichment).')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {editable && (
          <button onClick={() => setMode('edit')} style={btnPrimary}>
            ✏️ {t('preset-modal.edit', 'Modifier')}
          </button>
        )}
        <button onClick={onClose} style={editable ? btnSecondary : { ...btnPrimary, flex: 1 }}>
          {t('preset-modal.close', 'Fermer')}
        </button>
      </div>
    </>
  );

  const renderEditMode = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>✏️</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{t('preset-modal.edit-title', 'Modifier les usages')}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, wordBreak: 'break-word' }}>{presetName}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
        {entry.src === 'custom' ? t('preset-modal.edit-hint-custom', 'Persisté dans tes presets persos (profile.customPacks).') : t('preset-modal.edit-hint-tonenet', 'Persisté dans le catalog ToneNET partagé (shared.toneNetPresets).')}
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 10 }}>
        {usages.map((u, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--a3)', borderRadius: 'var(--r-sm)', padding: 6, marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                placeholder={t('preset-modal.artist', 'Artiste (ex: Metallica)')}
                list="preset-modal-artist-dl"
                value={u.artist}
                onChange={(e) => {
                  const v = e.target.value;
                  setUsages((prev) => prev.map((x, i) => i === idx ? { ...x, artist: v } : x));
                }}
                style={inp}
              />
              <button
                type="button"
                onClick={() => {
                  setUsages((prev) => prev.filter((_, i) => i !== idx));
                  setSongDrafts({});
                }}
                style={{ background: 'var(--red-bg)', border: 'none', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: 10, color: 'var(--danger, #ef4444)', cursor: 'pointer' }}
                title={t('preset-modal.remove-artist', 'Retirer cet artiste')}
              >✕</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              {(u.songs || []).map((song, si) => (
                <span key={si} style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-sm)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  {song}
                  <button
                    type="button"
                    onClick={() => setUsages((prev) => prev.map((x, i) => i === idx ? { ...x, songs: (x.songs || []).filter((_, j) => j !== si) } : x))}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 10, cursor: 'pointer', padding: 0 }}
                  >×</button>
                </span>
              ))}
              <input
                placeholder={t('preset-modal.song-add', '+ Morceau (Enter pour ajouter)')}
                list="preset-modal-song-dl"
                value={songDrafts[idx] || ''}
                onChange={(e) => setSongDrafts((prev) => ({ ...prev, [idx]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = (songDrafts[idx] || '').trim();
                    if (!v) return;
                    setUsages((prev) => prev.map((x, i) => i === idx ? { ...x, songs: Array.from(new Set([...(x.songs || []), v])) } : x));
                    setSongDrafts((prev) => ({ ...prev, [idx]: '' }));
                  }
                }}
                style={{ ...inp, flex: 1, minWidth: 120, fontSize: 11 }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setUsages((prev) => [...prev, { artist: '', songs: [] }])}
          style={{ background: 'transparent', border: '1px dashed var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: 6, fontSize: 11, cursor: 'pointer', width: '100%', marginTop: 4 }}
        >+ {t('preset-modal.add-artist', 'Ajouter un artiste')}</button>
      </div>

      <datalist id="preset-modal-artist-dl">
        {artistList.map((a) => <option key={a} value={a}/>)}
      </datalist>
      <datalist id="preset-modal-song-dl">
        {songList.map((s) => <option key={s} value={s}/>)}
      </datalist>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { setMode('view'); }} style={btnSecondary}>
          {t('preset-modal.cancel-edit', 'Annuler')}
        </button>
        <button onClick={handleSave} style={btnPrimary}>
          {t('preset-modal.save', 'Enregistrer →')}
        </button>
      </div>
    </>
  );

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={dialogStyle}>
        {mode === 'view' ? renderViewMode() : renderEditMode()}
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 16,
};
const dialogStyle = {
  background: 'var(--bg-elev-1)', borderRadius: 'var(--r-lg)',
  padding: 18, maxWidth: 520, width: '100%', maxHeight: '90vh',
  overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
};
const btnPrimary = {
  flex: 2, background: 'var(--accent)', border: 'none',
  color: 'var(--text-inverse)', borderRadius: 'var(--r-md)',
  padding: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const btnSecondary = {
  flex: 1, background: 'var(--a7)', border: '1px solid var(--a10)',
  color: 'var(--text-sec)', borderRadius: 'var(--r-md)',
  padding: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const inp = {
  background: 'var(--bg-elev-1)', color: 'var(--text)',
  border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)',
  padding: '4px 6px', flex: 1, fontSize: 12,
};

export default PresetCurationModal;
export { PresetCurationModal };
