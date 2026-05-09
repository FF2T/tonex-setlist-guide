// src/devices/tonex-plug/index.js — Phase 1, étape 4.
// Auto-enregistrement du device ToneX Plug au registre central.

import { registerDevice } from '../registry.js';
import { TONEX_PLUG_CATALOG, isPresetSourceCompatible } from './catalog.js';

registerDevice({
  ...TONEX_PLUG_CATALOG,
  isPresetSourceCompatible,
});

export { TONEX_PLUG_CATALOG, isPresetSourceCompatible };
export { INIT_BANKS_PLUG, FACTORY_BANKS_PLUG } from './catalog.js';
