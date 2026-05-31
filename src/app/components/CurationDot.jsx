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
  const dot = {
    display: 'inline-block',
    width: size,
    height: size,
    borderRadius: '50%',
    background: colors.dot,
    border: '1px solid ' + colors.border,
    flexShrink: 0,
  };
  // v9.7.10 (audit Cowork iPad) — pastille visuelle = `size`px (compacte),
  // mais hit area étendue via padding + negative margin quand cliquable :
  // tap zone ~30×22 au lieu de 6×6, sans modifier l'espace inline occupé.
  if (!clickable) {
    return (
      <span aria-label={label} title={label} style={{ verticalAlign: 'middle', ...style }}>
        <span style={dot}/>
      </span>
    );
  }
  return (
    <span
      role="button"
      aria-label={label}
      title={label + ' — clique pour voir/éditer'}
      onClick={(e) => { e.stopPropagation(); onClick(name); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: '12px 8px',
        margin: '-12px -8px',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      <span style={dot}/>
    </span>
  );
}

export default CurationDot;
export { CurationDot };
