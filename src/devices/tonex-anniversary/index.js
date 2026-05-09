// src/devices/tonex-anniversary/index.js — Phase 2.
// Auto-enregistrement du device ToneX Pedal Anniversary au registry.

import { registerDevice } from '../registry.js';
import { TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible } from './catalog.js';

registerDevice({
  ...TONEX_ANNIVERSARY_CATALOG,
  isPresetSourceCompatible,
});

export { TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible };
export { INIT_BANKS_ANN, FACTORY_BANKS_PEDALE } from './catalog.js';
