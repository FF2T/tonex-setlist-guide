// src/devices/tonemaster-pro/index.js — Phase 3.
// Auto-enregistrement du device Tone Master Pro au registry central.
// Importer ce module (side-effect) suffit à activer le device.
//
// Le device expose le champ optionnel `RecommendBlock` qui permet aux
// écrans existants (SongCollapsedDeviceRows, RecapScreen, etc.) de
// rendre un composant dédié au lieu du `presetRow` legacy ToneX.

import { registerDevice } from '../registry.js';
import {
  TONEMASTER_PRO_CATALOG, isPresetSourceCompatible, TMP_FACTORY_PATCHES,
} from './catalog.js';
import RecommendBlock from './RecommendBlock.jsx';

registerDevice({
  ...TONEMASTER_PRO_CATALOG,
  isPresetSourceCompatible,
  RecommendBlock,
});

export {
  TONEMASTER_PRO_CATALOG, isPresetSourceCompatible, TMP_FACTORY_PATCHES,
  RecommendBlock,
};
