// src/app/utils/ui-constants.js — Phase 7.14 (découpage main.jsx).
//
// Constantes visuelles partagées :
// - CC / CL : couleur + label des slots A/B/C (Clean/Drive/Lead).
// - TYPE_LABELS / TYPE_COLORS : pickup type → libellé FR + couleur RGB
//   pour les badges et fonds.

// Couleurs et labels des 3 slots ToneX (A=Clean, B=Drive, C=Lead).
const CC = {
  A: 'var(--brass-300)',
  B: 'var(--copper-400)',
  C: 'var(--wine-400)',
};
const CL = {
  A: 'Clean',
  B: 'Drive',
  C: 'Lead',
};

// Libellés FR pour les types de pickup.
const TYPE_LABELS = {
  HB: 'Humbucker',
  SC: 'Single Coil',
  P90: 'P-90',
};

// Couleurs RGB pour les badges/fonds pickup (utilisées en `rgba(${rgb},
// 0.12)` etc.).
const TYPE_COLORS = {
  HB: '194,158,92',
  SC: '184,115,51',
  P90: '155,58,44',
};

export { CC, CL, TYPE_LABELS, TYPE_COLORS };
