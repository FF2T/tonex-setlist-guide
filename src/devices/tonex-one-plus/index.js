// src/devices/tonex-one-plus/index.js — Phase ToneX One+.
// Auto-enregistrement du device ToneX One+ + LiveBlock partagé.

import { registerDevice } from '../registry.js';
import { TONEX_ONE_PLUS_CATALOG, isPresetSourceCompatible } from './catalog.js';
import makeToneXLiveBlock from '../_shared/ToneXLiveBlock.jsx';

const LiveBlock = makeToneXLiveBlock(TONEX_ONE_PLUS_CATALOG);

registerDevice({
  ...TONEX_ONE_PLUS_CATALOG,
  isPresetSourceCompatible,
  LiveBlock,
});

export { TONEX_ONE_PLUS_CATALOG, isPresetSourceCompatible, LiveBlock };
export { INIT_BANKS_ONE_PLUS, FACTORY_BANKS_ONE_PLUS } from './catalog.js';
