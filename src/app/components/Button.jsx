// src/app/components/Button.jsx — Vague 3 UX (2026-05-28).
//
// Bouton d'action unifié. Remplace les styles inline divergents
// (padding 3px→12px, fontSize 10→13, couleurs ad-hoc) qui rendaient
// les boutons hétérogènes (signalé Sébastien sur l'onglet Mon compte).
//
// Variants : primary (accent) · secondary (neutre rempli) · ghost
// (neutre transparent) · danger (wine rempli) · danger-ghost (wine
// outline). Tailles : md (défaut, touch 44px) · sm (compact 32px).
//
// Gère l'état disabled (opacity + bg-disabled + cursor not-allowed)
// et une icône NavIcon optionnelle.

import React from 'react';
import NavIcon from './NavIcon.jsx';

const SIZES = {
  md: { padding: '10px 16px', fontSize: 12, minHeight: 44 },
  sm: { padding: '6px 12px', fontSize: 11, minHeight: 32 },
};

function variantStyle(variant, disabled) {
  if (disabled) {
    return { background: 'var(--bg-disabled)', border: '1px solid var(--a8)', color: 'var(--text-muted)' };
  }
  switch (variant) {
    case 'secondary':
      return { background: 'var(--a5)', border: '1px solid var(--a8)', color: 'var(--text-sec)' };
    case 'ghost':
      return { background: 'transparent', border: '1px solid var(--a10)', color: 'var(--text-sec)' };
    case 'danger':
      return { background: 'var(--wine-400)', border: 'none', color: 'var(--text-inverse)' };
    case 'danger-ghost':
      return { background: 'transparent', border: '1px solid var(--wine-400)', color: 'var(--wine-400)' };
    case 'primary':
    default:
      return { background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)' };
  }
}

function Button({ children, onClick, variant = 'primary', size = 'md', iconId, disabled = false, title, testId, fullWidth = false, style: extra }) {
  const sz = SIZES[size] || SIZES.md;
  const vs = variantStyle(variant, disabled);
  return (
    <button
      data-testid={testId}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        ...vs,
        borderRadius: 'var(--r-md)',
        padding: sz.padding,
        fontSize: sz.fontSize,
        fontWeight: 700,
        minHeight: sz.minHeight,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: fullWidth ? '100%' : undefined,
        transition: 'all .15s',
        ...extra,
      }}
    >
      {iconId && <NavIcon id={iconId} size={size === 'sm' ? 12 : 14}/>}
      <span>{children}</span>
    </button>
  );
}

export default Button;
