// src/app/components/DemoBanner.jsx — Phase 7.51.3.
//
// Bandeau persistant affiché en haut de tous les écrans en mode démo,
// SAUF LiveScreen (mode scène plein écran où le clutter UI doit être
// minimal — la nature démo y est implicite vu que rien ne se sauvegarde).
//
// Non dismissible : le visiteur doit garder en permanence le contexte
// "mode démo" pour comprendre que les actions de write sont bloquées
// (cf. ToastDemoBlocked Phase 7.51.2).
//
// Le lien mailto pré-rempli ouvre le client mail du visiteur avec un
// template prêt à remplir (guitares, hardware ToneX, morceaux types) →
// l'admin (Sébastien) reçoit la demande structurée et crée le profil
// curé manuellement.

import React from 'react';
import { t, useLocale } from '../../i18n/index.js';

const MAILTO_URL = 'mailto:sebastien.chemin@gmail.com'
  + '?subject=' + encodeURIComponent('Demande de profil Backline')
  + '&body=' + encodeURIComponent(
    "Hi Sébastien,\n\n"
    + "I'd like a Backline profile with my own rig. Here's my setup:\n\n"
    + "- Main guitars : [...]\n"
    + "- ToneX hardware : [...]\n"
    + "- 5-10 songs I typically rehearse : [...]\n\n"
    + "Thanks!"
  );

function DemoBanner() {
  useLocale(); // re-render au switch de langue
  const text = t('demo.banner-text', 'Tu testes Backline en mode démo.');
  const linkLabel = t('demo.banner-link', 'Pour avoir ton propre profil avec ta rig, demande un accès');

  return (
    <div
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'linear-gradient(90deg, var(--brass-100) 0%, var(--brass-200) 100%)',
        color: 'var(--tolex-900)',
        padding: '8px 16px',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'center',
        borderBottom: '1px solid var(--brass-400)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true" style={{ marginRight: 6 }}>🎸</span>
      <span>{text}</span>
      <span style={{ margin: '0 6px', opacity: 0.6 }}>·</span>
      <a
        href={MAILTO_URL}
        style={{
          color: 'var(--tolex-900)',
          textDecoration: 'underline',
          fontWeight: 700,
        }}
      >{linkLabel}</a>
    </div>
  );
}

export default DemoBanner;
export { DemoBanner, MAILTO_URL };
