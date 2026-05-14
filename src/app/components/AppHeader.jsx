// src/app/components/AppHeader.jsx — Phase 7.22 (découpage main.jsx).
//
// Header global de l'app (avatar profil + nom Backline + statut sync +
// version). Sur desktop, ajoute aussi la nav inline en tabs. Sur
// mobile, seul le header bar est affiché (la nav passe en
// AppNavBottom).

import React from 'react';
import { APP_NAME } from '../../core/branding.js';
import { isNoSyncMode } from '../utils/firestore.js';
import BacklineIcon from './BacklineIcon.jsx';
import NavIcon from './NavIcon.jsx';
import { profileColor } from './profile-color.js';

const NAV_ITEMS = [
  { id: 'list', label: 'Accueil' },
  { id: 'setlists', label: 'Setlists' },
  { id: 'explore', label: 'Explorer' },
  { id: 'jam', label: 'Jammer' },
  { id: 'optimizer', label: 'Optimiser', adminOnly: true },
];

function AppHeader({ profiles, activeProfileId, onProfile, screen, onNavigate, isAdmin, syncStatus, appVersion }) {
  const visibleNav = NAV_ITEMS.filter((it) => !it.adminOnly || isAdmin);
  const profileName = (profiles[activeProfileId] || {}).name || '';
  const c = profileColor(activeProfileId);
  return (
    <div>
      <div className="app-header-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px var(--s-3,12px)', background: 'var(--surface-card,var(--bg-card))', borderBottom: '1px solid var(--border-subtle,var(--a8))' }}>
        <button onClick={onProfile} style={{ background: c, color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--r-pill,50%)', width: 32, height: 32, fontSize: 14, fontWeight: 800, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={profileName}>{profileName[0]?.toUpperCase() || '?'}</button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BacklineIcon size={20} color="var(--brass-300)"/>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display,system-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{APP_NAME}</div>
        </div>
        {isNoSyncMode()
          ? <span title="Mode local — aucune sync Firestore" style={{ fontSize: 10, color: 'var(--text-dim)' }}>🔒</span>
          : syncStatus && <span style={{ fontSize: 10, color: syncStatus === 'synced' ? 'var(--status-success,var(--green))' : syncStatus === 'syncing' ? 'var(--status-warning,var(--yellow))' : 'var(--text-dim)' }}>{syncStatus === 'synced' ? '☁️' : syncStatus === 'syncing' ? '⏳' : '⚠️'}</span>
        }
        <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono,monospace)' }}>v{appVersion}</span>
      </div>
      <div className="nav-desktop" style={{ display: 'none', gap: 4, marginBottom: 12 }}>
        {visibleNav.map((item) => {
          const active = screen === item.id;
          return <button key={item.id} onClick={() => { onNavigate(item.id); }} style={{ background: active ? 'var(--accent-soft,rgba(129,140,248,0.1))' : 'transparent', border: active ? '1px solid var(--border-accent,rgba(129,140,248,0.3))' : '1px solid transparent', color: active ? 'var(--accent,#818cf8)' : 'var(--text-tertiary,var(--text-muted))', borderRadius: 'var(--r-md,8px)', padding: '6px 12px', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><NavIcon id={item.id} size={16}/>{item.label}</button>;
        })}
      </div>
    </div>
  );
}

function AppNavBottom({ screen, onNavigate, isAdmin }) {
  const ITEMS = [
    { id: 'list', icon: '🏠', label: 'Accueil' },
    { id: 'setlists', icon: '🎵', label: 'Setlists' },
    { id: 'explore', label: 'Explorer' },
    { id: 'jam', label: 'Jammer' },
    { id: 'optimizer', label: 'Optimiser', adminOnly: true },
  ];
  const visibleItems = ITEMS.filter((it) => !it.adminOnly || isAdmin);
  return (
    <div className="nav-mobile" style={{ display: 'flex', position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface-card,var(--bg-card))', borderTop: '1px solid var(--border-subtle,var(--a8))', zIndex: 50, paddingBottom: 'max(4px,env(safe-area-inset-bottom))' }}>
      {visibleItems.map((item) => {
        const active = screen === item.id;
        return <button key={item.id} onClick={() => { onNavigate(item.id); }} style={{ flex: 1, background: 'none', border: 'none', color: active ? 'var(--accent,#818cf8)' : 'var(--text-tertiary,var(--text-muted))', padding: '8px 0 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <NavIcon id={item.id} size={20}/>
          <span style={{ fontSize: 9, fontWeight: active ? 700 : 500 }}>{item.label}</span>
        </button>;
      })}
    </div>
  );
}

export default AppHeader;
export { AppHeader, AppNavBottom };
