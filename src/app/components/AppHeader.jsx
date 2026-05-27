// src/app/components/AppHeader.jsx — Phase 7.22 (découpage main.jsx).
//
// Header global de l'app (avatar profil + nom Backline + statut sync +
// version). Sur desktop, ajoute aussi la nav inline en tabs. Sur
// mobile, seul le header bar est affiché (la nav passe en
// AppNavBottom).

import React from 'react';
import { t } from '../../i18n/index.js';
import { APP_NAME } from '../../core/branding.js';
import { isNoSyncMode } from '../utils/firestore.js';
import BacklineIcon from './BacklineIcon.jsx';
import NavIcon from './NavIcon.jsx';
import ProfileSelector from './ProfileSelector.jsx';
import { profileColor } from './profile-color.js';

// Phase 7.43 — getNavItems() au lieu d'un const top-level pour permettre
// au switch de langue de re-évaluer les labels à chaque render.
const getNavItems = () => [
  { id: 'list', label: t('nav.home', 'Accueil') },
  { id: 'setlists', label: t('nav.setlists', 'Setlists') },
  { id: 'explore', label: t('nav.explore', 'Explorer') },
  { id: 'jam', label: t('nav.jam', 'Jammer') },
  { id: 'optimizer', label: t('nav.optimizer', 'Optimiser'), adminOnly: true },
  // Phase 7.72 — Écran admin séparé, gated isAdmin.
  { id: 'admin', label: t('nav.admin', '⚙️ Admin'), adminOnly: true },
];

function AppHeader({ profiles, activeProfileId, onProfile, onSwitch, onViewProfile, onUpgradePassword, screen, onNavigate, isAdmin, syncStatus, appVersion }) {
  const visibleNav = getNavItems().filter((it) => !it.adminOnly || isAdmin);
  const profileName = (profiles[activeProfileId] || {}).name || '';
  const c = profileColor(activeProfileId);
  return (
    <div>
      <div className="app-header-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px var(--s-3,12px)', background: 'var(--surface-card,var(--bg-card))', borderBottom: '1px solid var(--border-subtle,var(--a8))' }}>
        {/* Phase 7.63 — Pour les admins, ProfileSelector dropdown (switch
            profils trusted + lien Mon Profil en bas). Pour les non-admins,
            bouton avatar simple qui ouvre directement MonProfilScreen
            (pas de switch possible — Phase 7.29.6 confidentialité). */}
        {isAdmin && onSwitch ? (
          <ProfileSelector
            profiles={profiles}
            activeProfileId={activeProfileId}
            onSwitch={onSwitch}
            onSettings={onProfile}
            onViewProfile={onViewProfile}
            onUpgradePassword={onUpgradePassword}
          />
        ) : (
          <button onClick={onProfile} style={{ background: c, color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--r-pill,50%)', width: 44, height: 44, fontSize: 16, fontWeight: 800, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={profileName}>{profileName[0]?.toUpperCase() || '?'}</button>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BacklineIcon size={20} color="var(--brass-300)"/>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display,system-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{APP_NAME}</div>
        </div>
        {isNoSyncMode()
          ? <span title={t('nav.no-sync-tooltip', 'Mode local — aucune sync Firestore')} style={{ fontSize: 10, color: 'var(--text-dim)' }}>🔒</span>
          : syncStatus && <span style={{ fontSize: 10, color: syncStatus === 'synced' ? 'var(--status-success,var(--green))' : syncStatus === 'syncing' ? 'var(--status-warning,var(--yellow))' : 'var(--text-dim)' }}>{syncStatus === 'synced' ? '☁️' : syncStatus === 'syncing' ? '⏳' : '⚠️'}</span>
        }
        {/* Phase 7.85 — whiteSpace:nowrap + flexShrink:0 pour éviter
            la troncature future (rapport Cowork B23 : risque tronc si
            numéro 2 chiffres v10.x.y). */}
        <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono,monospace)', whiteSpace: 'nowrap', flexShrink: 0 }}>v{appVersion}</span>
      </div>
      <div className="nav-desktop" style={{ display: 'none', gap: 4, marginBottom: 12 }}>
        {visibleNav.map((item) => {
          const active = screen === item.id;
          // S9.16 audit Cowork : minHeight 44 (iOS HIG) + padding/fontSize bumpés
          // pour lisibilité desktop (clamp evite hardcode tablette).
          // Phase 7.85 — État actif renforcé (rapport Cowork B21 P2 :
          // "seul fond léger distingue"). Background plus opaque +
          // border 2px accent + box-shadow inset bottom 2px pour
          // souligner visuellement.
          return <button key={item.id} onClick={() => { onNavigate(item.id); }} style={{ minHeight: 44, background: active ? 'var(--accent-bg,rgba(129,140,248,0.18))' : 'transparent', border: active ? '1px solid var(--accent,#818cf8)' : '1px solid transparent', color: active ? 'var(--accent,#818cf8)' : 'var(--text-tertiary,var(--text-muted))', borderRadius: 'var(--r-md,8px)', padding: '10px 16px', fontSize: 'clamp(12px, 1.25vw, 14px)', fontWeight: active ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: active ? 'inset 0 -2px 0 var(--accent,#818cf8)' : 'none' }}><NavIcon id={item.id} size={18}/>{item.label}</button>;
        })}
      </div>
    </div>
  );
}

function AppNavBottom({ screen, onNavigate, isAdmin }) {
  const ITEMS = [
    { id: 'list', icon: '🏠', label: t('nav.home', 'Accueil') },
    { id: 'setlists', icon: '🎵', label: t('nav.setlists', 'Setlists') },
    { id: 'explore', label: t('nav.explore', 'Explorer') },
    { id: 'jam', label: t('nav.jam', 'Jammer') },
    { id: 'optimizer', label: t('nav.optimizer', 'Optimiser'), adminOnly: true },
    // Phase 7.72 — Écran admin séparé.
    { id: 'admin', label: t('nav.admin', '⚙️ Admin'), adminOnly: true },
  ];
  const visibleItems = ITEMS.filter((it) => !it.adminOnly || isAdmin);
  return (
    // Phase 7.55.7 fix Cowork — bumper la hauteur min à 50px pour atteindre
    // 44×44 Apple HIG (vs 30px observé). padding 8→10 vertical + minHeight.
    <div className="nav-mobile" style={{ display: 'flex', position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface-card,var(--bg-card))', borderTop: '1px solid var(--border-subtle,var(--a8))', zIndex: 50, paddingBottom: 'max(4px,env(safe-area-inset-bottom))' }}>
      {visibleItems.map((item) => {
        const active = screen === item.id;
        return <button key={item.id} onClick={() => { onNavigate(item.id); }} style={{ flex: 1, minHeight: 50, background: 'none', border: 'none', color: active ? 'var(--accent,#818cf8)' : 'var(--text-tertiary,var(--text-muted))', padding: '10px 0 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <NavIcon id={item.id} size={22}/>
          <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
        </button>;
      })}
    </div>
  );
}

export default AppHeader;
export { AppHeader, AppNavBottom };
