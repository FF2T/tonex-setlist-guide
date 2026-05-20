// src/app/components/PresetCurationModal.jsx — Phase 7.79 + 7.79.3 (refactor cascade).
//
// Modale unifiée info preset + édition usages inline.
//
// Mode "view" (default) :
//   - Affiche status + amp/gain/style/scores + usages + pack
//   - Badge source cascade (👤 Toi / 🏷️ Studio / ⚙️ Backline) si override
//     actif (Phase 7.79.3 — annoté par findCatalogEntry via window._usagesCascadeState)
//   - Bouton "✏️ Modifier" sur toutes les sources catalog non-guessed
//     (Phase 7.79.3 — étendu depuis custom/ToneNET admin-only à TOUS les
//     catalog statiques avec routing user vs admin)
//   - Bouton "🔄 Restaurer la version par défaut" si override actif
//     (cascade reprend au niveau suivant)
//
// Mode "edit" :
//   - Form usages [{artist, songs?}] (réutilise pattern Phase 7.78)
//   - Save → route via saveUsagesForPreset selon entry.src + isAdmin :
//       custom → profile.customPacks (rétro-compat)
//       ToneNET → shared.toneNetPresets (rétro-compat)
//       catalog + admin → shared.usagesOverrides (cascade niveau 3)
//       catalog + !admin → profile.usagesOverrides (cascade niveau 1)
//   - Cancel → revient en mode view sans appliquer

import React, { useState, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import { findCatalogEntry, getPresetCurationStatus, CURATION_COLORS, getCurationLabel } from '../../core/catalog.js';
import { saveUsagesForPreset, removeUsagesOverride } from '../../core/preset-curation.js';
import { cleanUsages } from '../screens/ToneNetTab.jsx';

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
  onSharedUsagesOverrides, // Phase 7.79.3 — pour router catalog statique admin → shared
  onClose,
}) {
  const entry = useMemo(() => findCatalogEntry(presetName), [presetName]);
  const status = useMemo(() => getPresetCurationStatus(presetName), [presetName]);
  const colors = status ? CURATION_COLORS[status] : null;
  // Phase 7.79.3 — édition étendue à TOUTES les sources non-guessed.
  // Le routing custom/ToneNET/catalog statique est géré par saveUsagesForPreset
  // (preset-curation.js). Avant 7.79.3 c'était limité à custom/ToneNET + isAdmin.
  const editable = !!entry && !entry.guessed;
  // Phase 7.79.3 — source de cascade pour badge + condition Restaurer.
  const usagesSource = entry?._usagesSource || null;
  const usagesCuratedBy = entry?._usagesCuratedBy || null;
  // Bouton "Restaurer" : user voit son propre override OU admin voit override Backline.
  const canRemoveOverride = !!entry && !entry.guessed &&
    (usagesSource === 'user' || (usagesSource === 'backline' && isAdmin));

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
    // Phase 7.79.3 — Refactor : délégue au helper centralisé qui route
    // selon entry.src + isAdmin (4 branches). Avant 7.79.3 la modale
    // inlinait la logique pour custom/ToneNET seulement.
    saveUsagesForPreset(presetName, cleaned, {
      findEntry: findCatalogEntry,
      activeProfileId,
      isAdmin,
      onProfiles,
      onToneNetPresets,
      onShared: onSharedUsagesOverrides || undefined,
    });
    setMode('view');
  };

  // Phase 7.79.3 — Bouton "Restaurer la version par défaut" : DELETE
  // l'override de la cascade pour que le niveau suivant (Backline ou
  // Catalog) reprenne. No-op pour custom/ToneNET (pas concernés par
  // la cascade — leur usages est dans la donnée elle-même).
  const handleRestoreDefault = () => {
    removeUsagesOverride(presetName, {
      findEntry: findCatalogEntry,
      activeProfileId,
      isAdmin,
      onProfiles,
      onShared: onSharedUsagesOverrides || undefined,
    });
    // Pas de setMode('view') ici — on est déjà en view. Le badge cascade
    // sera mis à jour au prochain render (cascade resolve via window state).
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

  // Phase 7.79.3 — Badge source de la cascade. Affiché à côté du status
  // de curation pour montrer d'où viennent les usages affichés.
  const renderCascadeBadge = () => {
    if (!usagesSource || usagesSource === 'default') return null;
    const labels = {
      user: { emoji: '👤', label: t('cascade.source-user', 'Toi'), color: '#7dd3fc', bg: 'rgba(125,211,252,0.15)' },
      studio: { emoji: '🏷️', label: usagesCuratedBy ? tFormat('cascade.source-studio-by', { studio: usagesCuratedBy }, 'Studio ({studio})') : t('cascade.source-studio', 'Studio'), color: '#1e40af', bg: 'rgba(30,64,175,0.15)' },
      backline: { emoji: '⚙️', label: t('cascade.source-backline', 'Backline'), color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    };
    const lvl = labels[usagesSource];
    if (!lvl) return null;
    return (
      <span
        style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-sm)', color: lvl.color, background: lvl.bg, display: 'inline-flex', alignItems: 'center', gap: 3 }}
      >
        {lvl.emoji} {lvl.label}
      </span>
    );
  };

  const renderViewMode = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>{STATUS_ICONS[status] || ''}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors?.dot || 'var(--text)' }}>
          {getCurationLabel(status)}
        </span>
        {renderCascadeBadge()}
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

      {/* Phase 7.79.3 — la note "édite le code source" est obsolète :
          tout catalog statique est éditable via la cascade désormais.
          On garde uniquement une note pour les entries 'guessed' (inconnu). */}
      {!editable && entry?.guessed && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 10 }}>
          {t('preset-modal.guessed-note', 'Preset inconnu (fallback heuristique). Ajoute-le aux banks ou à customPacks pour l\'enrichir.')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {editable && (
          <button onClick={() => setMode('edit')} style={btnPrimary}>
            ✏️ {t('preset-modal.edit', 'Modifier')}
          </button>
        )}
        {/* Phase 7.79.3 — Bouton Restaurer si override actif visible-by-user */}
        {canRemoveOverride && (
          <button
            onClick={handleRestoreDefault}
            title={t('cascade.restore-tooltip', 'Retire ton override et reprend le niveau de cascade suivant (Backline ou Catalog).')}
            style={btnSecondary}
          >
            🔄 {t('cascade.restore', 'Restaurer la version par défaut')}
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
        {/* Phase 7.79.3 — hint adapté selon entry.src + isAdmin pour informer
            clairement l'user où sera persisté son override (4 cas). */}
        {entry.src === 'custom'
          ? t('preset-modal.edit-hint-custom', 'Persisté dans tes presets persos (profile.customPacks).')
          : entry.src === 'ToneNET'
          ? t('preset-modal.edit-hint-tonenet', 'Persisté dans le catalog ToneNET partagé (shared.toneNetPresets).')
          : isAdmin
          ? t('cascade.edit-hint-admin', 'Persisté dans le catalog Backline partagé (visible par tous les profils, niveau cascade 3).')
          : t('cascade.edit-hint-user', 'Persisté dans ton override perso (visible uniquement par toi, prioritaire sur les niveaux Backline et Catalog).')}
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
