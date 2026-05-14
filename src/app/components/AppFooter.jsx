// src/app/components/AppFooter.jsx — Phase 7.29 + 7.44.
//
// Footer global : espace pour ne pas masquer le contenu sous la nav
// mobile fixe + signature PathToTone + disclaimer marques tierces.
//
// Phase 7.44 (2026-05-14) — ajout du disclaimer après contact TSR
// pour clarifier l'indépendance du projet vis-à-vis d'IK Multimedia
// et autres détenteurs de marques. Signal de respect des marques
// utilisées + protection légale préventive. Usage strictement
// nominatif (identification de produits dans l'écosystème).

import React from 'react';
import { t, useLocale } from '../../i18n/index.js';

function AppFooter() {
  useLocale();
  return (
    <div style={{ marginTop: 24, paddingTop: 12, paddingBottom: 84, textAlign: 'center', borderTop: '1px solid var(--a6)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.05em', marginBottom: 4 }}>
        © 2026 <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>PathToTone</span> · Made with 🎸 and ❤️
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', opacity: 0.7, lineHeight: 1.4, maxWidth: 520, margin: '0 auto', padding: '0 12px' }}>
        {t('common.footer-disclaimer', 'Outil indépendant — ToneX™ est une marque d\'IK Multimedia SpA. Autres marques citées appartiennent à leurs propriétaires respectifs.')}
      </div>
    </div>
  );
}

export default AppFooter;
