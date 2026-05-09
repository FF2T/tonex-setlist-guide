// src/devices/tonex-pedal/catalog.js — Phase 2.
// ToneX Pedal (version standard, non-Anniversary). Réexporte INIT_BANKS_ANN
// et FACTORY_BANKS_PEDALE depuis data/ (le storage de banks est partagé
// avec tonex-anniversary en Phase 2).
//
// Filtre source : rejette PlugFactory ET Anniversary. Les captures
// Anniversary sont exclusives au device tonex-anniversary.

import { INIT_BANKS_ANN, FACTORY_BANKS_PEDALE } from '../../data/data_catalogs.js';

const TONEX_PEDAL_CATALOG = {
  id: 'tonex-pedal',
  label: 'ToneX Pedal',
  icon: '📦',
  description: 'ToneX Pedal — captures TSR/ML/Factory, 50 banks A/B/C.',
  initBanks: INIT_BANKS_ANN,
  factoryBanks: FACTORY_BANKS_PEDALE,
  maxBanks: 50,
  slots: ['A', 'B', 'C'],
  excludedSources: ['PlugFactory', 'Anniversary'],
  bankStorageKey: 'banksAnn',
  presetResultKey: 'preset_ann',
  defaultEnabled: true,
  requiresPro: false,
  deviceKey: 'ann',
};

function isPresetSourceCompatible(src) {
  if (!src) return true;
  return src !== 'PlugFactory' && src !== 'Anniversary';
}

export {
  INIT_BANKS_ANN, FACTORY_BANKS_PEDALE,
  TONEX_PEDAL_CATALOG, isPresetSourceCompatible,
};
