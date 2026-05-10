// src/devices/tonex-anniversary/index.js — Phase 2.
// Auto-enregistrement du device ToneX Pedal Anniversary au registry.

import { registerDevice } from '../registry.js';
import { TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible } from './catalog.js';

registerDevice({
  ...TONEX_ANNIVERSARY_CATALOG,
  isPresetSourceCompatible,
});

export { TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible };
// FACTORY_BANKS_PEDALE retiré du re-export Phase 3.5 (Anniversary
// n'a pas accès aux factory presets de la pédale standard — ses
// 150 captures exclusives seront ajoutées Phase 5).
export { INIT_BANKS_ANN } from './catalog.js';
