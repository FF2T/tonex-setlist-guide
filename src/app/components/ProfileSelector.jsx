// src/app/components/ProfileSelector.jsx — Phase 7.18 (découpage main.jsx).
//
// Avatar + dropdown de switch de profil utilisé dans le header. Quand
// l'utilisateur clique un autre profil, on demande mot de passe si
// nécessaire (sauf trusted). Bouton 👁 pour ouvrir le ViewProfileScreen
// d'un autre profil (lecture seule).

import React, { useState, useRef, useEffect } from 'react';
import { isTrusted, setTrusted } from '../../core/state.js';
import { profileColor } from './profile-color.js';

function ProfileSelector({ profiles, activeProfileId, onSwitch, onSettings, onViewProfile }) {
  const [open, setOpen] = useState(false);
  const [loginId, setLoginId] = useState(null);
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState(false);
  const [remember, setRemember] = useState(true);
  const ref = useRef(null);
  const pwdRef2 = useRef(null);
  useEffect(() => { if (loginId) setTimeout(() => pwdRef2.current?.focus(), 50); }, [loginId]);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setLoginId(null); } };
    document.addEventListener('click', h, true);
    return () => document.removeEventListener('click', h, true);
  }, [open]);
  const trySwitch = (id) => {
    const p = profiles[id];
    if (!p) return;
    if (!p.password || isTrusted(id)) { onSwitch(id); setOpen(false); setLoginId(null); return; }
    setLoginId(id); setPwd(''); setPwdErr(false); setRemember(true);
  };
  const tryLogin = () => {
    const p = profiles[loginId];
    if (!p) return;
    if (p.password === pwd) {
      setTrusted(loginId, remember);
      onSwitch(loginId); setOpen(false); setLoginId(null);
    } else setPwdErr(true);
  };
  const active = profiles[activeProfileId];
  const color = profileColor(activeProfileId);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(!open); setLoginId(null); }} style={{ background: color, border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-pill)', width: 34, height: 34, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {(active?.name || '?')[0].toUpperCase()}
      </button>
      {open && <div style={{ position: 'absolute', top: 40, left: 0, background: 'var(--bg-card)', border: '1px solid var(--a12)', borderRadius: 'var(--r-lg)', padding: 8, zIndex: 50, minWidth: 200, boxShadow: 'var(--shadow-lg)' }}>
        {Object.values(profiles).sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
          const isActive = p.id === activeProfileId;
          const c = profileColor(p.id);
          const isLogin = loginId === p.id;
          return <div key={p.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: isActive ? 'var(--a7)' : isLogin ? 'var(--accent-bg)' : 'transparent', borderRadius: 'var(--r-md)', padding: '6px 8px', marginBottom: 2 }}>
              <button onClick={() => trySwitch(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ background: c, color: 'var(--text-inverse)', borderRadius: 'var(--r-pill)', width: 26, height: 26, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.name[0].toUpperCase()}</div>
                <span style={{ fontSize: 13, color: isActive ? 'var(--text)' : 'var(--text-sec)', fontWeight: isActive ? 700 : 400 }}>{p.name}</span>
                {p.password && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{isTrusted(p.id) ? '🔓' : '🔒'}</span>}
              </button>
              {isActive && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓</span>}
              {!isActive && <button onClick={() => { if (onViewProfile) { onViewProfile(p.id); setOpen(false); } }} style={{ background: 'var(--a5)', border: 'none', color: 'var(--text-dim)', borderRadius: 'var(--r-sm)', padding: '2px 6px', fontSize: 9, cursor: 'pointer' }} title="Voir la config">👁</button>}
            </div>
            {isLogin && <div style={{ padding: '4px 8px 8px' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input ref={pwdRef2} type="password" inputMode="numeric" autoFocus placeholder="Mot de passe" value={pwd} onChange={(e) => { setPwd(e.target.value); setPwdErr(false); }} onKeyDown={(e) => e.key === 'Enter' && tryLogin()} style={{ flex: 1, background: 'var(--bg-elev-1)', color: 'var(--text)', border: `1px solid ${pwdErr ? 'var(--red)' : 'var(--a15)'}`, borderRadius: 'var(--r-md)', padding: '5px 8px', fontSize: 11 }}/>
                <button onClick={tryLogin} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>OK</button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ cursor: 'pointer' }}/>
                Mémoriser sur cet appareil
              </label>
            </div>}
          </div>;
        })}
      </div>}
    </div>
  );
}

export default ProfileSelector;
export { ProfileSelector };
