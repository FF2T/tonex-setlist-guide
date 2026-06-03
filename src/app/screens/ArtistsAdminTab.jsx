// src/app/screens/ArtistsAdminTab.jsx — Phase 13.4 (2026-06-03)
//
// UI admin "🎭 Artistes" pour CRUD runtime sur ARTISTS_SEED + overrides
// (cf core/artists.js cascade lookup).
//
// MVP : liste filtrée + modal JSON edit pour rapidité de mise en place.
// Une UI form structurée (champs name/role/bands + array eras) viendra
// Phase 13.4.1 si l'usage justifie l'effort.
//
// Architecture :
//   - Lecture : ARTISTS_SEED (Cowork+manual) merged via getEffectiveArtistsMap
//   - Écriture : shared.artistsOverrides[id] = { artist, lastModified }
//     null artist = delete override (le seed reprend la main si présent)
//   - Sync Firestore : via main.jsx setSharedArtistsOverrides + LWW per-item

import React, { useState, useMemo } from 'react';
import { t } from '../../i18n/index.js';
import { ARTISTS_SEED } from '../../data/artists.js';
import { getEffectiveArtistsMap } from '../../core/artists.js';

const inp = {
  background: 'var(--bg-card)',
  color: 'var(--text)',
  border: '1px solid var(--a15)',
  borderRadius: 'var(--r-md)',
  padding: '6px 10px',
  fontSize: 12,
  boxSizing: 'border-box',
};

const btn = (variant = 'neutral') => ({
  background: variant === 'accent' ? 'var(--accent)'
    : variant === 'wine' ? 'rgba(155,58,44,0.12)'
    : variant === 'brass' ? 'rgba(212,160,82,0.15)'
    : 'var(--a8)',
  color: variant === 'accent' ? 'var(--text-inverse)'
    : variant === 'wine' ? 'var(--wine-400)'
    : 'var(--text)',
  border: variant === 'wine' ? '1px solid rgba(155,58,44,0.3)'
    : variant === 'brass' ? '1px solid rgba(212,160,82,0.4)'
    : '1px solid var(--a15)',
  borderRadius: 'var(--r-sm)',
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
});

function ArtistsAdminTab({ sharedArtistsOverrides, onSharedArtistsOverrides }) {
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null); // { id, json, isNew }
  const [editorErr, setEditorErr] = useState('');

  // Liste effective : ARTISTS_SEED + overrides (cascade côté core/artists.js
  // déjà appliquée via getEffectiveArtistsMap).
  const effective = useMemo(() => getEffectiveArtistsMap(), [sharedArtistsOverrides]);
  const overridesMap = sharedArtistsOverrides || {};

  const allEntries = useMemo(() => {
    const arr = Object.entries(effective).map(([id, a]) => ({
      id,
      ...a,
      isOverride: overridesMap[id] && overridesMap[id].artist != null,
      isSeed: !!ARTISTS_SEED[id],
    }));
    arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return arr;
  }, [effective, overridesMap]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return allEntries;
    const q = filter.toLowerCase().trim();
    return allEntries.filter((a) => {
      if (a.name && a.name.toLowerCase().includes(q)) return true;
      if (a.id.toLowerCase().includes(q)) return true;
      if ((a.bands || []).some((b) => b.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [allEntries, filter]);

  const counts = useMemo(() => ({
    total: allEntries.length,
    overrides: Object.keys(overridesMap).filter((id) => overridesMap[id]?.artist != null).length,
    deleted: Object.keys(overridesMap).filter((id) => overridesMap[id]?.artist === null).length,
  }), [allEntries, overridesMap]);

  const startEdit = (id) => {
    const entry = effective[id];
    if (!entry) return;
    const { id: _drop, ...rest } = entry;
    setEditing({
      id,
      json: JSON.stringify(rest, null, 2),
      isNew: false,
    });
    setEditorErr('');
  };

  const startAdd = () => {
    const template = {
      name: 'Nouvel Artiste',
      role: 'guitarist',
      bands: ['Nom du Groupe'],
      eras: [
        {
          period: 'Période',
          years: [1970, 2026],
          guitars: ['Marque Modèle'],
          amps: ['Marque Modèle'],
          pedals: [],
        },
      ],
      notes: '',
      sources: [],
    };
    setEditing({
      id: '',
      json: JSON.stringify(template, null, 2),
      isNew: true,
    });
    setEditorErr('');
  };

  const saveEdit = () => {
    if (!editing) return;
    let parsed;
    try {
      parsed = JSON.parse(editing.json);
    } catch (e) {
      setEditorErr(`JSON invalide : ${e.message}`);
      return;
    }
    // Validation minimale
    if (!parsed.name || typeof parsed.name !== 'string') {
      setEditorErr('name requis (string)');
      return;
    }
    if (!['guitarist', 'bassist', 'multi'].includes(parsed.role)) {
      setEditorErr('role doit être "guitarist", "bassist" ou "multi"');
      return;
    }
    if (!Array.isArray(parsed.bands) || parsed.bands.length === 0) {
      setEditorErr('bands requis (array non vide)');
      return;
    }
    if (!Array.isArray(parsed.eras) || parsed.eras.length === 0) {
      setEditorErr('eras requis (array non vide)');
      return;
    }
    let targetId = editing.id;
    if (editing.isNew) {
      // Generate id from name : snake_case lowercase
      targetId = parsed.name.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      if (!targetId) {
        setEditorErr('Impossible de générer un id depuis le name (vide après normalisation)');
        return;
      }
      if (effective[targetId]) {
        setEditorErr(`L'id "${targetId}" existe déjà. Choisis un autre nom.`);
        return;
      }
    }
    onSharedArtistsOverrides((prev) => ({
      ...(prev || {}),
      [targetId]: { artist: parsed, lastModified: Date.now() },
    }));
    setEditing(null);
    setEditorErr('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditorErr('');
  };

  const restoreSeed = (id) => {
    if (!window.confirm(`Restaurer "${id}" sur la version du seed (perdre tes modifications) ?`)) return;
    onSharedArtistsOverrides((prev) => {
      const next = { ...(prev || {}) };
      delete next[id];
      return next;
    });
  };

  const deleteEntry = (id) => {
    const isSeed = !!ARTISTS_SEED[id];
    const msg = isSeed
      ? `Masquer "${id}" (entry du seed) ? Tu pourras restaurer le seed plus tard.`
      : `Supprimer "${id}" (override seul) ? Cette entry disparaîtra de la base.`;
    if (!window.confirm(msg)) return;
    onSharedArtistsOverrides((prev) => {
      const next = { ...(prev || {}) };
      if (isSeed) {
        // Tombstone : artist=null masque le seed
        next[id] = { artist: null, lastModified: Date.now() };
      } else {
        // Override-only entry : suppression directe
        delete next[id];
      }
      return next;
    });
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>
          {t('artists-admin.title', '🎭 Artistes (ARTISTS_SEED)')}
        </h2>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {t('artists-admin.subtitle',
            'Base setup historique des guitaristes/bassistes utilisée par Phase 13.1/13.2 (anti-hallucination ref_amp, boost amp family). Édition runtime synced via Firestore (LWW per-item).')}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
          {counts.total} entries · {counts.overrides} overrides actifs · {counts.deleted} entries seed masquées
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder={t('artists-admin.filter-placeholder', 'Filtrer par nom, id, ou groupe…')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 200 }}
        />
        <button onClick={startAdd} style={btn('accent')}>
          + {t('artists-admin.add', 'Nouvel artiste')}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 600, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>
            {filter ? t('artists-admin.no-match', 'Aucun artiste ne matche le filtre.') : t('artists-admin.empty', 'Base vide.')}
          </div>
        )}
        {filtered.map((a) => (
          <div key={a.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            background: a.isOverride ? 'rgba(212,160,82,0.06)' : 'var(--bg-card)',
            border: '1px solid ' + (a.isOverride ? 'rgba(212,160,82,0.3)' : 'var(--a15)'),
            borderRadius: 'var(--r-sm)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</span>
                {a.isOverride && (
                  <span style={{ fontSize: 9, padding: '1px 6px', background: 'rgba(212,160,82,0.2)', color: 'var(--brass-100)', borderRadius: 'var(--r-sm)', fontWeight: 700 }}>OVERRIDE</span>
                )}
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{a.id}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {a.role} · {(a.bands || []).join(', ')} · {(a.eras || []).length} era(s)
              </div>
            </div>
            <button onClick={() => startEdit(a.id)} style={btn('neutral')}>
              {t('artists-admin.edit', 'Éditer')}
            </button>
            {a.isOverride && a.isSeed && (
              <button onClick={() => restoreSeed(a.id)} style={btn('brass')} title={t('artists-admin.restore-tooltip', 'Restaurer la version du seed')}>
                {t('artists-admin.restore', 'Restaurer')}
              </button>
            )}
            <button onClick={() => deleteEntry(a.id)} style={btn('wine')}>
              {a.isSeed ? t('artists-admin.hide', 'Masquer') : t('artists-admin.delete', 'Supprimer')}
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 100,
        }} onClick={cancelEdit}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--a15)',
            borderRadius: 'var(--r-lg)',
            padding: 16,
            maxWidth: 700,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
              {editing.isNew ? t('artists-admin.add-title', '+ Nouvel artiste') : t('artists-admin.edit-title', 'Éditer artiste')}
            </h3>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {editing.isNew ? 'id auto-généré depuis name au save' : `id: ${editing.id}`}
            </div>
            <textarea
              value={editing.json}
              onChange={(e) => setEditing({ ...editing, json: e.target.value })}
              style={{
                ...inp,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                minHeight: 400,
                resize: 'vertical',
                lineHeight: 1.4,
              }}
              spellCheck={false}
            />
            {editorErr && (
              <div style={{ fontSize: 11, color: 'var(--wine-400)', padding: 6, background: 'rgba(155,58,44,0.08)', borderRadius: 'var(--r-sm)' }}>
                ⚠ {editorErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={cancelEdit} style={btn('neutral')}>
                {t('artists-admin.cancel', 'Annuler')}
              </button>
              <button onClick={saveEdit} style={btn('accent')}>
                {t('artists-admin.save', 'Enregistrer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArtistsAdminTab;
export { ArtistsAdminTab };
