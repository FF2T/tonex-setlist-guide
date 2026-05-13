// src/app/components/PresetSearchModal.jsx — Phase 7.18 (découpage main.jsx).
//
// Modal de recherche d'un preset depuis le catalogue complet (PRESET_CATALOG_MERGED).
// Utilisé par BankEditor pour remplacer le contenu d'un slot bank.

import React, { useState, useMemo } from 'react';
import { PRESET_CATALOG_MERGED } from '../../core/catalog.js';
import { SOURCE_LABELS } from '../../core/sources.js';

function PresetSearchModal({ onSelect, onClose, toneNetPresets }) {
  const [q, setQ] = useState('');
  const allPresets = useMemo(() => Object.entries(PRESET_CATALOG_MERGED).sort((a, b) => a[0].localeCompare(b[0])), [toneNetPresets]);
  const results = useMemo(() => {
    if (!q.trim()) return allPresets.slice(0, 30);
    const lq = q.toLowerCase();
    return allPresets.filter(([n, info]) => n.toLowerCase().includes(lq) || info.amp.toLowerCase().includes(lq)).slice(0, 30);
  }, [q, allPresets]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Chercher un preset</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <input autoFocus placeholder="Nom du preset ou ampli..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', background: 'var(--bg-elev-1)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 13, boxSizing: 'border-box', marginBottom: 10 }}/>
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {results.map(([name, info]) => (
            <button key={name} onClick={() => onSelect(name)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--a3)', border: '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 10px', marginBottom: 3, cursor: 'pointer' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{info.amp} · {SOURCE_LABELS[info.src] || info.src}</div>
            </button>
          ))}
          {results.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: 16 }}>Aucun preset trouvé</div>}
        </div>
      </div>
    </div>
  );
}

export default PresetSearchModal;
export { PresetSearchModal };
