// src/app/components/AddSongModal.jsx — Phase 7.14 (découpage main.jsx).
//
// Modal "Ajouter un morceau" en bottom-sheet. 2 modes :
// - existing : sélectionne 1+ morceaux de songDb (non déjà dans activeSl)
//   + setlists cibles → ajoute en bulk.
// - new : titre + artiste libre → créé un song custom, fetch AI analysis,
//   l'ajoute aux setlists cibles.

import React, { useState } from 'react';
import { fetchAI } from '../utils/fetchAI.js';
import { updateAiCache } from '../utils/ai-helpers.js';

function AddSongModal({ songDb, onSongDb, setlists, onSetlists, activeSlId, onClose, banksAnn, banksPlug, aiProvider, aiKeys, guitars, guitarBias }) {
  const [mode, setMode] = useState('existing');
  const [search, setSearch] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [targetSlIds, setTargetSlIds] = useState([activeSlId]);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const activeSl = setlists.find((s) => s.id === activeSlId);
  const existingIds = new Set(activeSl?.songIds || []);
  const filtered = songDb.filter((s) => !existingIds.has(s.id) && (s.title.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase())));
  const toggleSong = (id) => setSelectedSongs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleSl = (id) => setTargetSlIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleAdd = () => {
    if (mode === 'existing') {
      if (selectedSongs.length === 0 || targetSlIds.length === 0) return;
      onSetlists((p) => p.map((sl) => targetSlIds.includes(sl.id) ? { ...sl, songIds: [...new Set([...sl.songIds, ...selectedSongs])] } : sl));
    } else {
      if (!newTitle.trim() || targetSlIds.length === 0) return;
      const ns = { id: `c_${Date.now()}`, title: newTitle.trim(), artist: newArtist.trim() || 'Artiste inconnu', isCustom: true, ig: [], aiCache: null };
      onSongDb((p) => [...p, ns]);
      onSetlists((p) => p.map((sl) => targetSlIds.includes(sl.id) ? { ...sl, songIds: [...sl.songIds, ns.id] } : sl));
      fetchAI(ns, '', banksAnn, banksPlug, aiProvider, aiKeys, guitars, null, null, 'balanced', guitarBias)
        .then((r) => onSongDb((p) => p.map((x) => x.id === ns.id ? { ...x, aiCache: updateAiCache(x.aiCache, '', r) } : x)))
        .catch(() => {});
    }
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxWidth: 700, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Ajouter un morceau</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[{ v: 'existing', l: 'Depuis la base' }, { v: 'new', l: 'Nouveau morceau' }].map(({ v, l }) => (
            <button key={v} onClick={() => setMode(v)} style={{ flex: 1, background: mode === v ? 'var(--accent-bg)' : 'var(--a5)', border: mode === v ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: mode === v ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        {mode === 'existing' && (
          <>
            <input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', background: 'var(--bg-elev-1)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}/>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 14 }}>
              {filtered.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Aucun morceau disponible</div>}
              {filtered.map((s) => {
                const sel = selectedSongs.includes(s.id);
                return (
                  <div key={s.id} onClick={() => toggleSong(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer', background: sel ? 'rgba(74,222,128,0.08)' : 'transparent', border: sel ? '1px solid var(--green-border)' : '1px solid transparent', marginBottom: 4 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 'var(--r-sm)', border: sel ? '2px solid #4ade80' : '2px solid var(--text-muted)', background: sel ? 'var(--green)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sel && <span style={{ color: 'var(--bg)', fontSize: 9, fontWeight: 900 }}>✓</span>}</div>
                    <div><div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.artist}</div></div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {mode === 'new' && (
          <div style={{ marginBottom: 14 }}>
            <input placeholder="Titre *" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ width: '100%', background: 'var(--bg-elev-1)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}/>
            <input placeholder="Artiste" value={newArtist} onChange={(e) => setNewArtist(e.target.value)} style={{ width: '100%', background: 'var(--bg-elev-1)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 13, boxSizing: 'border-box' }}/>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Analysé par l'IA dans le récap.</div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 600, marginBottom: 8 }}>Ajouter à :</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {setlists.map((sl) => {
              const sel = targetSlIds.includes(sl.id);
              return (
                <button key={sl.id} onClick={() => toggleSl(sl.id)} style={{ background: sel ? 'var(--accent-bg)' : 'var(--a5)', border: sel ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: sel ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{sl.name}</button>
              );
            })}
          </div>
        </div>
        <button onClick={handleAdd} disabled={targetSlIds.length === 0 || (mode === 'existing' && selectedSongs.length === 0) || (mode === 'new' && !newTitle.trim())}
          style={{ width: '100%', background: targetSlIds.length > 0 ? 'var(--accent)' : 'var(--bg-elev-3)', border: 'none', color: 'var(--text)', borderRadius: 'var(--r-lg)', padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          ✅ Ajouter{selectedSongs.length > 1 ? ` (${selectedSongs.length})` : ''}
        </button>
      </div>
    </div>
  );
}

export default AddSongModal;
export { AddSongModal };
