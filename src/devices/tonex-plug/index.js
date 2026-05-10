// src/devices/tonex-plug/index.js — Phase 1 (étendu Phase 4).
// Auto-enregistrement du device ToneX Plug au registre central.
//
// Phase 4 : attache un LiveBlock partagé (via makeToneXLiveBlock) pour
// le mode scène plein écran.

import { registerDevice } from '../registry.js';
import { TONEX_PLUG_CATALOG, isPresetSourceCompatible } from './catalog.js';
import makeToneXLiveBlock from '../_shared/ToneXLiveBlock.jsx';

const LiveBlock = makeToneXLiveBlock(TONEX_PLUG_CATALOG);

registerDevice({
  ...TONEX_PLUG_CATALOG,
  isPresetSourceCompatible,
  LiveBlock,
});

export { TONEX_PLUG_CATALOG, isPresetSourceCompatible, LiveBlock };
export { INIT_BANKS_PLUG, FACTORY_BANKS_PLUG } from './catalog.js';
