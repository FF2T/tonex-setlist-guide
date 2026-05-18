// src/app/components/AdminAsBanner.jsx — Phase 7.63.
//
// Bandeau persistant affiché en haut de tous les écrans (sauf LiveScreen)
// quand l'admin (Sébastien) est connecté sur un autre profil (Bruno,
// Francisco, Arthur, etc.) en mode admin-as.
//
// Évite que l'admin édite par inadvertance dans le mauvais profil. Le
// click "← Retour admin" repasse sur le profil admin d'origine en
// préservant le sessionStorage.
//
// Visibilité gérée par main.jsx App() via `isAdminAsMode(profiles,
// activeProfileId, sessionStorage.tonex_admin_origin)`. Phase 7.63 helper
// pur dans core/state.js.

import React from 'react';
import { t, useLocale } from '../../i18n/index.js';

function AdminAsBanner({ targetProfileName, adminProfileName, onSwitchBack }) {
  useLocale(); // re-render au switch de langue
  const targetLabel = targetProfileName || t('admin-as.target-default', 'ce profil');
  const adminLabel = adminProfileName || t('admin-as.admin-default', 'admin');
  const message = t(
    'admin-as.banner-text',
    `🔍 Connecté en tant que ${targetLabel} (mode admin) — tes modifs s'appliquent à son profil`
  )
    // Phase 7.39 — t() retourne la version trilingue interpolée. Si le
    // fallback inline est utilisé (mode dev / locale FR), on remplace
    // manuellement targetLabel.
    .replace('${targetLabel}', targetLabel)
    .replace('${adminLabel}', adminLabel);

  return (
    <div
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'linear-gradient(90deg, var(--copper-200, #b87333) 0%, var(--brass-300, #c9a14b) 100%)',
        color: 'var(--tolex-900, #1a1208)',
        padding: '8px 16px',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'center',
        borderBottom: '1px solid var(--copper-400, #8a5520)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        lineHeight: 1.4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
        🔍 {t('admin-as.connected-as', 'Connecté en tant que')}{' '}
        <strong>{targetLabel}</strong>{' '}
        ({t('admin-as.mode-suffix', 'mode admin')}) —{' '}
        {t('admin-as.warning', 'tes modifs s\'appliquent à son profil')}
      </span>
      {typeof onSwitchBack === 'function' && (
        <button
          type="button"
          onClick={onSwitchBack}
          style={{
            background: 'rgba(0,0,0,0.18)',
            border: '1px solid var(--copper-500, #6e4218)',
            color: 'var(--tolex-900, #1a1208)',
            padding: '3px 10px',
            borderRadius: 'var(--r-sm, 6px)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={t('admin-as.switch-back-title', 'Repasser sur le profil admin')}
        >
          ← {t('admin-as.switch-back', 'Retour admin')}
        </button>
      )}
    </div>
  );
}

export default AdminAsBanner;
export { AdminAsBanner };
