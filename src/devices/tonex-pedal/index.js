// src/devices/tonex-pedal/index.js — Phase 1 (étendu Phase 4).
// Auto-enregistrement du device ToneX Pedal au registre central.
// Importer ce module (side-effect) suffit à activer le device.
//
// Phase 4 : attache un LiveBlock partagé (via makeToneXLiveBlock) pour
// le mode scène plein écran.

import { registerDevice } from '../registry.js';
import { TONEX_PEDAL_CATALOG, isPresetSourceCompatible } from './catalog.js';
import makeToneXLiveBlock from '../_shared/ToneXLiveBlock.jsx';

const LiveBlock = makeToneXLiveBlock(TONEX_PEDAL_CATALOG);

registerDevice({
  ...TONEX_PEDAL_CATALOG,
  isPresetSourceCompatible,
  LiveBlock,
});

export { TONEX_PEDAL_CATALOG, isPresetSourceCompatible, LiveBlock };
export {
  INIT_BANKS_ANN,
  FACTORY_BANKS_PEDALE,
  FACTORY_BANKS_PEDALE_V1,
  FACTORY_BANKS_PEDALE_V2,
} from './catalog.js';
