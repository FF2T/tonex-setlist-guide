// src/app/components/AppFooter.jsx — Phase 7.29.
//
// Footer global : espace pour ne pas masquer le contenu sous la nav
// mobile fixe + mention de copyright PathToMusic inc.

import React from 'react';

function AppFooter() {
  return (
    <div style={{ marginTop: 24, paddingTop: 12, paddingBottom: 84, textAlign: 'center', borderTop: '1px solid var(--a6)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.05em' }}>
        © 2026 <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>PathToMusic inc.</span> · Made with 🎸
      </div>
    </div>
  );
}

export default AppFooter;
