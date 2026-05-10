// src/devices/tonex-anniversary/index.js — Phase 2.
// Auto-enregistrement du device ToneX Pedal Anniversary au registry.

import { registerDevice } from '../registry.js';
import { TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible } from './catalog.js';

registerDevice({
  ...TONEX_ANNIVERSARY_CATALOG,
  isPresetSourceCompatible,
});

export { TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible };
// FACTORY_BANKS_ANNIVERSARY (Phase 3.6) construit depuis les 150
// captures Anniversary exclusives déjà présentes dans
// data/data_catalogs.js (ANNIVERSARY_CATALOG). FACTORY_BANKS_PEDALE
// reste dispo via tonex-pedal/index.js (différentes données).
export { INIT_BANKS_ANN, FACTORY_BANKS_ANNIVERSARY } from './catalog.js';
