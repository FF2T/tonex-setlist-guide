// src/devices/tonex-pedal/index.js — Phase 1, étape 4.
// Auto-enregistrement du device ToneX Pedal au registre central.
// Importer ce module (side-effect) suffit à activer le device.

import { registerDevice } from '../registry.js';
import { TONEX_PEDAL_CATALOG, isPresetSourceCompatible } from './catalog.js';

registerDevice({
  ...TONEX_PEDAL_CATALOG,
  isPresetSourceCompatible,
});

export { TONEX_PEDAL_CATALOG, isPresetSourceCompatible };
export { INIT_BANKS_ANN, FACTORY_BANKS_PEDALE } from './catalog.js';
