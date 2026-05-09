// src/devices/tonex-plug/catalog.js — Phase 1, étape 4.
// Wrapper de catalogue spécifique au ToneX Plug.
// Réexporte INIT_BANKS_PLUG et FACTORY_BANKS_PLUG depuis data/ et
// expose la métadonnée du device.

import { INIT_BANKS_PLUG, FACTORY_BANKS_PLUG } from '../../data/data_catalogs.js';
import { isSrcCompatible } from '../registry.js';

const TONEX_PLUG_CATALOG = {
  id: 'tonex-plug',
  label: 'ToneX Plug',
  initBanks: INIT_BANKS_PLUG,
  factoryBanks: FACTORY_BANKS_PLUG,
  maxBanks: 10,
  slots: ['A', 'B', 'C'],
  excludedSources: ['Anniversary', 'Factory'],
  deviceKey: 'plug',
};

function isPresetSourceCompatible(src) {
  return isSrcCompatible(src, 'plug');
}

export {
  INIT_BANKS_PLUG, FACTORY_BANKS_PLUG,
  TONEX_PLUG_CATALOG, isPresetSourceCompatible,
};
