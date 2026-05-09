// src/devices/tonex-pedal/catalog.js — Phase 1, étape 4.
// Wrapper de catalogue spécifique au ToneX Pedal (Anniversary).
// Réexporte INIT_BANKS_ANN et FACTORY_BANKS_PEDALE depuis data/ et
// expose la métadonnée du device (50 banks × 3 slots A/B/C, sources
// exclues).

import { INIT_BANKS_ANN, FACTORY_BANKS_PEDALE } from '../../data/data_catalogs.js';
import { isSrcCompatible } from '../registry.js';

const TONEX_PEDAL_CATALOG = {
  id: 'tonex-pedal',
  label: 'ToneX Pedal',
  initBanks: INIT_BANKS_ANN,
  factoryBanks: FACTORY_BANKS_PEDALE,
  maxBanks: 50,
  slots: ['A', 'B', 'C'],
  excludedSources: ['PlugFactory'],
  deviceKey: 'ann',
};

function isPresetSourceCompatible(src) {
  return isSrcCompatible(src, 'ann');
}

export {
  INIT_BANKS_ANN, FACTORY_BANKS_PEDALE,
  TONEX_PEDAL_CATALOG, isPresetSourceCompatible,
};
