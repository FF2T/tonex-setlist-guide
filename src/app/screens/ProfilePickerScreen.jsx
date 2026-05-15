// src/app/screens/ProfilePickerScreen.jsx — Phase 7.29.6.
//
// Écran de sélection du profil au démarrage. Pour la confidentialité,
// le grid n'affiche QUE les profils déjà trusted sur cet appareil.
// Pour se connecter à un autre profil (ou en première visite), un form
// "nom + mot de passe" est disponible. Message d'erreur générique pour
// empêcher l'énumération des comptes existants.

import React, { useState, useRef, useEffect } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import { isTrusted, setTrusted } from '../../core/state.js';
import { APP_NAME } from '../../core/branding.js';
import { profileColor } from '../components/profile-color.js';
import { verifyPassword, hashPassword, isPasswordLegacy } from '../../core/crypto-utils.js';

function ProfilePickerScreen({ profiles, onPick, appVersion, onUpgradePassword, onDemoEnter }) {
  const trustedProfiles = Object.values(profiles).filter((p) => isTrusted(p.id) || !p.password);
  const [selectedId, setSelectedId] = useState(null);
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState(false);
  const [remember, setRemember] = useState(true);
  const pwdRef = useRef(null);
  // Form "autre profil" : déplié par défaut si aucun trusted (première
  // visite ou nouveau device), replié sinon.
  const [showOtherForm, setShowOtherForm] = useState(trustedProfiles.length === 0);
  const [otherName, setOtherName] = useState('');
  const [otherPwd, setOtherPwd] = useState('');
  const [otherErr, setOtherErr] = useState(false);
  useEffect(() => { if (selectedId && profiles[selectedId]?.password) setTimeout(() => pwdRef.current?.focus(), 50); }, [selectedId]);
  const pickWith = (id) => {
    const p = profiles[id]; if (!p) return;
    if (!p.password) { onPick(id); return; }
    if (isTrusted(id)) { onPick(id); return; }
    setSelectedId(id); setPwd(''); setPwdErr(false); setRemember(true);
  };
  const tryLogin = async () => {
    const p = profiles[selectedId];
    if (!p) return;
    const ok = await verifyPassword(pwd, p.password);
    if (ok) {
      if (p.password && isPasswordLegacy(p.password) && onUpgradePassword) {
        const newHash = await hashPassword(pwd);
        onUpgradePassword(selectedId, newHash);
      }
      if (p.password) setTrusted(selectedId, remember);
      onPick(selectedId);
    } else {
      setPwdErr(true);
    }
  };
  const tryOtherLogin = async () => {
    const name = otherName.trim().toLowerCase();
    if (!name) { setOtherErr(true); return; }
    const p = Object.values(profiles).find((x) => x.name.toLowerCase() === name);
    if (!p) { setOtherErr(true); return; }
    if (!p.password) { setTrusted(p.id, true); onPick(p.id); return; }
    const ok = await verifyPassword(otherPwd, p.password);
    if (!ok) { setOtherErr(true); return; }
    if (isPasswordLegacy(p.password) && onUpgradePassword) {
      const newHash = await hashPassword(otherPwd);
      onUpgradePassword(p.id, newHash);
    }
    setTrusted(p.id, true);
    onPick(p.id);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 20 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🎸</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{APP_NAME}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>{trustedProfiles.length > 0 ? t('picker.who-plays', "Qui joue aujourd'hui ?") : t('picker.login', 'Connexion')}</div>
      {typeof onDemoEnter === 'function' && <button
        data-testid="profile-picker-demo-card"
        onClick={onDemoEnter}
        style={{
          width: '100%', maxWidth: 400, marginBottom: 20,
          background: 'linear-gradient(135deg, var(--brass-200) 0%, var(--copper-400) 100%)',
          border: '2px solid var(--brass-400)',
          borderRadius: 'var(--r-xl)',
          padding: '18px 16px',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ fontSize: 28, flexShrink: 0 }}>🎸</div>
        <div style={{ flex: 1, color: 'var(--tolex-900)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{t('demo.card-title', 'Mode démo · Découvrir Backline')}</span>
            <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--tolex-900)', color: 'var(--brass-100)', padding: '2px 6px', borderRadius: 'var(--r-sm)' }}>{t('demo.card-badge', 'Sans compte')}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85 }}>{t('demo.card-subtitle', 'Teste l\'app avec un profil de démonstration. Aucune donnée sauvegardée.')}</div>
        </div>
        <div style={{ fontSize: 18, color: 'var(--tolex-900)', opacity: 0.7 }}>→</div>
      </button>}
      {trustedProfiles.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, width: '100%', maxWidth: 400, marginBottom: 16 }}>
        {trustedProfiles.sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
          const c = profileColor(p.id);
          const sel = selectedId === p.id;
          return <button key={p.id} onClick={() => pickWith(p.id)} style={{ background: sel ? 'var(--accent-bg)' : 'var(--a4)', border: sel ? '2px solid var(--accent)' : '2px solid var(--a10)', borderRadius: 'var(--r-xl)', padding: '24px 12px', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}>
            <div style={{ background: c, color: 'var(--text-inverse)', borderRadius: 'var(--r-pill)', width: 48, height: 48, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>{p.name[0].toUpperCase()}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
            {p.password && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>🔓</div>}
          </button>;
        })}
      </div>}
      {selectedId && profiles[selectedId]?.password && !isTrusted(selectedId) && <div style={{ width: '100%', maxWidth: 300 }}>
        <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 8, textAlign: 'center' }}>{tFormat('picker.password-for', { name: profiles[selectedId].name }, 'Mot de passe pour {name}')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={pwdRef} type="password" inputMode="numeric" autoFocus placeholder={t('picker.password', 'Mot de passe')} value={pwd} onChange={(e) => { setPwd(e.target.value); setPwdErr(false); }} onKeyDown={(e) => e.key === 'Enter' && tryLogin()} style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text)', border: `1px solid ${pwdErr ? 'var(--red)' : 'var(--a15)'}`, borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 14 }}/>
          <button onClick={tryLogin} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t('picker.ok', 'OK')}</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--text-sec)', cursor: 'pointer', justifyContent: 'center' }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ cursor: 'pointer' }}/>
          {t('picker.remember', 'Mémoriser sur cet appareil')}
        </label>
        {pwdErr && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, textAlign: 'center' }}>{t('picker.wrong-password', 'Mot de passe incorrect')}</div>}
      </div>}
      {!selectedId && <div style={{ width: '100%', maxWidth: 300, marginTop: trustedProfiles.length > 0 ? 8 : 0 }}>
        {!showOtherForm && <button onClick={() => setShowOtherForm(true)} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 8, width: '100%', textAlign: 'center' }}>{t('picker.other-profile', 'Se connecter à un autre profil')}</button>}
        {showOtherForm && <div>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 8, textAlign: 'center' }}>{t('picker.credentials', 'Identifiants')}</div>
          <input type="text" autoComplete="username" placeholder={t('picker.profile-name', 'Nom du profil')} value={otherName} onChange={(e) => { setOtherName(e.target.value); setOtherErr(false); }} style={{ width: '100%', background: 'var(--bg-card)', color: 'var(--text)', border: `1px solid ${otherErr ? 'var(--red)' : 'var(--a15)'}`, borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }}/>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="password" autoComplete="current-password" placeholder={t('picker.password', 'Mot de passe')} value={otherPwd} onChange={(e) => { setOtherPwd(e.target.value); setOtherErr(false); }} onKeyDown={(e) => e.key === 'Enter' && tryOtherLogin()} style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text)', border: `1px solid ${otherErr ? 'var(--red)' : 'var(--a15)'}`, borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 14 }}/>
            <button onClick={tryOtherLogin} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t('picker.ok', 'OK')}</button>
          </div>
          {otherErr && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, textAlign: 'center' }}>{t('picker.wrong-credentials', 'Identifiants incorrects')}</div>}
          {trustedProfiles.length > 0 && <button onClick={() => { setShowOtherForm(false); setOtherName(''); setOtherPwd(''); setOtherErr(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 6, width: '100%', textAlign: 'center', marginTop: 4 }}>{t('picker.back', 'Retour')}</button>}
        </div>}
      </div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 32 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>v{appVersion}</span>
        <button onClick={() => { location.reload(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-mono)' }} title={t('picker.reload-title', 'Recharger pour récupérer la dernière version')}>{t('picker.update', 'MAJ')}</button>
      </div>
    </div>
  );
}

export default ProfilePickerScreen;
export { ProfilePickerScreen };
