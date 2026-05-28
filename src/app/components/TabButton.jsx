// src/app/components/TabButton.jsx — Vague 3 UX (2026-05-28).
//
// Bouton d'onglet unifié pour MonProfilScreen + AdminScreen (et tout
// futur écran à onglets). Garantit une taille/un style cohérents :
// même padding, fontSize, minHeight 44 (Apple HIG touch target),
// icône SVG flat optionnelle via NavIcon.
//
// Remplace les helpers `tabBtn` locaux qui divergeaient (padding
// 12 vs 14, fontWeight fixe vs conditionnel, whiteSpace, backgrounds).

import React from 'react';
import NavIcon from './NavIcon.jsx';

function TabButton({ active, label, iconId, onClick, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        background: active ? 'var(--accent-bg)' : 'var(--a5)',
        border: active ? '1px solid var(--accent-border, var(--accent))' : '1px solid var(--a8)',
        color: active ? 'var(--accent)' : 'var(--text-sec)',
        borderRadius: 'var(--r-md)',
        padding: '10px 14px',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        minHeight: 44,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        boxShadow: active ? 'inset 0 -2px 0 var(--accent)' : 'none',
        transition: 'all .15s',
      }}
    >
      {iconId && <NavIcon id={iconId} size={14}/>}
      <span>{label}</span>
    </button>
  );
}

export default TabButton;
