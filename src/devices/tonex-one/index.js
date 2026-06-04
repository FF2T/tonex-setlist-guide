// src/devices/tonex-one/index.js — Phase ToneX One.
// Auto-enregistrement du device ToneX One + LiveBlock partagé (mode scène).

import { registerDevice } from '../registry.js';
import { TONEX_ONE_CATALOG, isPresetSourceCompatible } from './catalog.js';
import makeToneXLiveBlock from '../_shared/ToneXLiveBlock.jsx';

const LiveBlock = makeToneXLiveBlock(TONEX_ONE_CATALOG);

registerDevice({
  ...TONEX_ONE_CATALOG,
  isPresetSourceCompatible,
  LiveBlock,
});

export { TONEX_ONE_CATALOG, isPresetSourceCompatible, LiveBlock };
export { INIT_BANKS_ONE, FACTORY_BANKS_ONE } from './catalog.js';
