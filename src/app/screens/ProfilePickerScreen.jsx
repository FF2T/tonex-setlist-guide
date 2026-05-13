// src/app/screens/ProfilePickerScreen.jsx — Phase 7.18 (découpage main.jsx).
//
// Écran de sélection du profil au démarrage de l'app. Affiche les
// profils en grille, demande le mot de passe pour les profils
// protégés non-trusted. "Trusted" persiste via core/state.js.

import React, { useState, useRef, useEffect } from 'react';
import { isTrusted, setTrusted } from '../../core/state.js';
import { APP_NAME } from '../../core/branding.js';
import { profileColor } from '../components/profile-color.js';

function ProfilePickerScreen({ profiles, onPick, appVersion }) {
  const [selectedId, setSelectedId] = useState(null);
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState(false);
  const [remember, setRemember] = useState(true);
  const pwdRef = useRef(null);
  useEffect(() => { if (selectedId && profiles[selectedId]?.password) setTimeout(() => pwdRef.current?.focus(), 50); }, [selectedId]);
  const pickWith = (id) => {
    const p = profiles[id]; if (!p) return;
    if (!p.password) { onPick(id); return; }
    if (isTrusted(id)) { onPick(id); return; }
    setSelectedId(id); setPwd(''); setPwdErr(false); setRemember(true);
  };
  const tryLogin = () => {
    const p = profiles[selectedId];
    if (!p) return;
    if (!p.password || p.password === pwd) {
      if (p.password) setTrusted(selectedId, remember);
      onPick(selectedId);
    } else { setPwdErr(true); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 20 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🎸</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{APP_NAME}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>Qui joue aujourd'hui ?</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, width: '100%', maxWidth: 400, marginBottom: 16 }}>
        {Object.values(profiles).sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
          const c = profileColor(p.id);
          const sel = selectedId === p.id;
          const trusted = p.password && isTrusted(p.id);
          return <button key={p.id} onClick={() => pickWith(p.id)} style={{ background: sel ? 'var(--accent-bg)' : 'var(--a4)', border: sel ? '2px solid var(--accent)' : '2px solid var(--a10)', borderRadius: 'var(--r-xl)', padding: '24px 12px', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}>
            <div style={{ background: c, color: 'var(--text-inverse)', borderRadius: 'var(--r-pill)', width: 48, height: 48, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>{p.name[0].toUpperCase()}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
            {p.password && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{trusted ? '🔓' : '🔒'}</div>}
          </button>;
        })}
      </div>
      {selectedId && profiles[selectedId]?.password && !isTrusted(selectedId) && <div style={{ width: '100%', maxWidth: 300 }}>
        <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 8, textAlign: 'center' }}>Mot de passe pour {profiles[selectedId].name}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={pwdRef} type="password" inputMode="numeric" autoFocus placeholder="Mot de passe" value={pwd} onChange={(e) => { setPwd(e.target.value); setPwdErr(false); }} onKeyDown={(e) => e.key === 'Enter' && tryLogin()} style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text)', border: `1px solid ${pwdErr ? 'var(--red)' : 'var(--a15)'}`, borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 14 }}/>
          <button onClick={tryLogin} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>OK</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--text-sec)', cursor: 'pointer', justifyContent: 'center' }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ cursor: 'pointer' }}/>
          Mémoriser sur cet appareil
        </label>
        {pwdErr && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, textAlign: 'center' }}>Mot de passe incorrect</div>}
      </div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 32 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>v{appVersion}</span>
        <button onClick={() => { location.reload(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-mono)' }} title="Recharger pour récupérer la dernière version">MAJ</button>
      </div>
    </div>
  );
}

export default ProfilePickerScreen;
export { ProfilePickerScreen };
