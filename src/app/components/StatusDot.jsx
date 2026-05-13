// src/app/components/StatusDot.jsx — Phase 7.14 (découpage main.jsx).
//
// Petit pavé carré qui visualise l'état d'un score :
// - `ideal=true` : background brass-400 + bordure brass-200 (cas "Ideal").
// - sinon, couleur dérivée de scoreColor(score) (rouge → orange → vert).
// - score null + ideal false : couleur neutre (a12).
//
// Utilisé partout (HomeScreen, RecapScreen, SongDetailCard, ListScreen,
// SynthesisScreen, PresetBrowser) à côté du libellé du score ou de la
// recommandation.

import React from 'react';
import { scoreColor, scoreLabel } from './score-utils.js';

function StatusDot({ score, ideal, size }) {
  const s = size || 8;
  const bg = ideal ? 'var(--brass-400)' : (score != null ? scoreColor(score) : 'var(--a12)');
  const title = ideal ? 'Ideal' : (score != null ? scoreLabel(score).t : '');
  return (
    <span
      title={title}
      style={{
        display: 'inline-block', width: s, height: s,
        borderRadius: 'var(--r-xs)', flexShrink: 0, background: bg,
        border: ideal ? '2px solid var(--brass-200)' : 'none',
      }}
    />
  );
}

export default StatusDot;
export { StatusDot };
