// src/app/screens/ProfilesAdmin.jsx — Phase 7.18 (découpage main.jsx).
//
// Onglet 👤 Profils dans ⚙️ Paramètres : CRUD des profils, édition
// password, "Oublier appareil" (reset trusted), historique de
// connexion (5 derniers logins).

import React, { useState } from 'react';
import { makeDefaultProfile, isTrusted, setTrusted } from '../../core/state.js';

function ProfilesAdmin({ profiles, onProfiles }) {
  const [name, setName] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [editPwdId, setEditPwdId] = useState(null);
  const [editPwdVal, setEditPwdVal] = useState('');
  const [editNameId, setEditNameId] = useState(null);
  const [editNameVal, setEditNameVal] = useState('');
  const create = () => {
    if (!name.trim()) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + `_${Date.now()}`;
    onProfiles((p) => ({ ...p, [id]: makeDefaultProfile(id, name.trim(), false, newPwd) }));
    setName(''); setNewPwd('');
  };
  const deleteProfile = (id) => {
    if (Object.keys(profiles).length <= 1) return;
    onProfiles((p) => { const n = { ...p }; delete n[id]; return n; });
  };
  const savePwd = (id) => {
    onProfiles((p) => ({ ...p, [id]: { ...p[id], password: editPwdVal } }));
    setTrusted(id, false);
    setEditPwdId(null); setEditPwdVal('');
  };
  const [trustTick, setTrustTick] = useState(0);
  const forgetDevice = (id) => { setTrusted(id, false); setTrustTick((t) => t + 1); };
  const saveName = (id) => {
    if (!editNameVal.trim()) return;
    onProfiles((p) => ({ ...p, [id]: { ...p[id], name: editNameVal.trim() } }));
    setEditNameId(null); setEditNameVal('');
  };
  const inp = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 12, boxSizing: 'border-box' };
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>Gestion des utilisateurs.</div>
      {Object.values(profiles).map((p) => (
        <div key={p.id} style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: '10px 14px', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {editNameId === p.id ? (
              <>
                <input value={editNameVal} onChange={(e) => setEditNameVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName(p.id)} style={{ ...inp, flex: 1 }} autoFocus/>
                <button onClick={() => saveName(p.id)} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>OK</button>
                <button onClick={() => setEditNameId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>✕</button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}{p.isAdmin && <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 6 }}>admin</span>}</div>
                <button onClick={() => { setEditNameId(p.id); setEditNameVal(p.name); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '2px 4px' }}>✏️</button>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.password ? (isTrusted(p.id) ? '🔓' : '🔒') : '🔓'}</span>
                <button onClick={() => { setEditPwdId(editPwdId === p.id ? null : p.id); setEditPwdVal(p.password || ''); }} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 7px', fontSize: 10, cursor: 'pointer' }}>Mot de passe</button>
                {p.password && isTrusted(p.id) && <button onClick={() => forgetDevice(p.id)} title="Le mot de passe sera redemandé au prochain login sur cet appareil" style={{ background: 'var(--a5)', border: 'none', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '3px 7px', fontSize: 10, cursor: 'pointer' }}>Oublier appareil</button>}
                {Object.keys(profiles).length > 1 && !p.isAdmin && <button onClick={() => deleteProfile(p.id)} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>Supprimer</button>}
              </>
            )}
          </div>
          {editPwdId === p.id && editNameId !== p.id && <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input type="text" placeholder="Nouveau mot de passe (vide = sans)" value={editPwdVal} onChange={(e) => setEditPwdVal(e.target.value)} style={{ ...inp, flex: 1 }}/>
            <button onClick={() => savePwd(p.id)} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>OK</button>
          </div>}
          {(p.loginHistory || []).length > 0 && <div style={{ marginTop: 8, borderTop: '1px solid var(--a8)', paddingTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Dernières connexions</div>
            {(p.loginHistory || []).slice(0, 5).map((ts, i) => <div key={i} style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.6 }}>{new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>)}
          </div>}
        </div>
      ))}
      <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)', borderRadius: 'var(--r-lg)', padding: 14, marginTop: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>+ Nouvel utilisateur</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp, flex: 1 }}/>
            <input type="text" placeholder="Mot de passe" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} style={{ ...inp, flex: 1 }}/>
          </div>
          <button onClick={create} disabled={!name.trim()} style={{ background: name.trim() ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Créer</button>
        </div>
      </div>
    </div>
  );
}

export default ProfilesAdmin;
export { ProfilesAdmin };
