// src/devices/tonemaster-pro/index.js — Phase 3 + Phase 4.
// Auto-enregistrement du device Tone Master Pro au registry central.
// Importer ce module (side-effect) suffit à activer le device.
//
// Le device expose les champs optionnels :
// - RecommendBlock (Phase 3) : composant rendu dans les listes de
//   morceaux à la place du presetRow legacy ToneX.
// - LiveBlock (Phase 4) : composant rendu en plein écran par
//   LiveScreen (mode scène).

import { registerDevice } from '../registry.js';
import {
  TONEMASTER_PRO_CATALOG, isPresetSourceCompatible, TMP_FACTORY_PATCHES,
  resolveTmpPatchByName,
} from './catalog.js';
import { recommendTMPPatch } from './scoring.js';
import RecommendBlock from './RecommendBlock.jsx';
import LiveBlock from './LiveBlock.jsx';

registerDevice({
  ...TONEMASTER_PRO_CATALOG,
  isPresetSourceCompatible,
  RecommendBlock,
  LiveBlock,
});

export {
  TONEMASTER_PRO_CATALOG, isPresetSourceCompatible, TMP_FACTORY_PATCHES,
  resolveTmpPatchByName,
  recommendTMPPatch,
  RecommendBlock, LiveBlock,
};
