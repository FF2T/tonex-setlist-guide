// src/devices/tonex-anniversary/index.js — Phase 2 (étendu Phase 4).
// Auto-enregistrement du device ToneX Pedal Anniversary au registry.
//
// Phase 4 : attache un LiveBlock partagé (via makeToneXLiveBlock) pour
// le mode scène plein écran.

import { registerDevice } from '../registry.js';
import { TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible } from './catalog.js';
import makeToneXLiveBlock from '../_shared/ToneXLiveBlock.jsx';

const LiveBlock = makeToneXLiveBlock(TONEX_ANNIVERSARY_CATALOG);

registerDevice({
  ...TONEX_ANNIVERSARY_CATALOG,
  isPresetSourceCompatible,
  LiveBlock,
});

export { TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible, LiveBlock };
// FACTORY_BANKS_ANNIVERSARY (Phase 3.6) construit depuis les 150
// captures Anniversary exclusives déjà présentes dans
// data/data_catalogs.js (ANNIVERSARY_CATALOG). FACTORY_BANKS_PEDALE
// reste dispo via tonex-pedal/index.js (différentes données).
export { INIT_BANKS_ANN, FACTORY_BANKS_ANNIVERSARY } from './catalog.js';
