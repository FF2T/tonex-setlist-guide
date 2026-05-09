// src/devices/tonex-plug/catalog.js — Phase 2.
// ToneX Plug (version logicielle).

import { INIT_BANKS_PLUG, FACTORY_BANKS_PLUG } from '../../data/data_catalogs.js';

const TONEX_PLUG_CATALOG = {
  id: 'tonex-plug',
  label: 'ToneX Plug',
  icon: '🔌',
  description: 'ToneX Plug — version logicielle, 10 banks A/B/C.',
  initBanks: INIT_BANKS_PLUG,
  factoryBanks: FACTORY_BANKS_PLUG,
  maxBanks: 10,
  slots: ['A', 'B', 'C'],
  excludedSources: ['Anniversary', 'Factory'],
  bankStorageKey: 'banksPlug',
  presetResultKey: 'preset_plug',
  defaultEnabled: true,
  requiresPro: false,
  deviceKey: 'plug',
};

function isPresetSourceCompatible(src) {
  if (!src) return true;
  return src !== 'Anniversary' && src !== 'Factory';
}

export {
  INIT_BANKS_PLUG, FACTORY_BANKS_PLUG,
  TONEX_PLUG_CATALOG, isPresetSourceCompatible,
};
