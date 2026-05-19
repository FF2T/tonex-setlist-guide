// src/app/components/CurationDot.jsx — Phase 7.79.
//
// Pastille curation cliquable réutilisable. Affiche la couleur de
// status (unknown/known/curated-perso/curated-admin/curated-studio)
// du preset. Tooltip natif + callback onClick optionnel.
//
// Utilisé dans :
//   - BankEditor (Mes appareils) — depuis Phase 7.70
//   - SongDetailCard (vue dépliée setlist) — depuis Phase 7.70
//   - PresetBrowser (Explorer) — Phase 7.79.1 (à venir)

import React from 'react';
import { getPresetCurationStatus, CURATION_COLORS, getCurationLabel } from '../../core/catalog.js';

function CurationDot({ name, onClick, size = 6, style }) {
  if (!name) return null;
  const status = getPresetCurationStatus(name);
  if (!status) return null;
  const colors = CURATION_COLORS[status];
  if (!colors) return null;
  const label = getCurationLabel(status);
  const clickable = typeof onClick === 'function';
  const base = {
    display: 'inline-block',
    width: size,
    height: size,
    borderRadius: '50%',
    background: colors.dot,
    border: '1px solid ' + colors.border,
    flexShrink: 0,
    cursor: clickable ? 'pointer' : 'default',
    verticalAlign: 'middle',
    ...style,
  };
  return (
    <span
      role={clickable ? 'button' : undefined}
      aria-label={label}
      title={label + (clickable ? ' — clique pour voir/éditer' : '')}
      onClick={clickable ? (e) => { e.stopPropagation(); onClick(name); } : undefined}
      style={base}
    />
  );
}

export default CurationDot;
export { CurationDot };
