// src/devices/tonemaster-pro/chain-model.js — Phase 3.
// Définit le modèle de données TMPBlock + TMPPatch et fournit les helpers
// validateBlock / validatePatch utilisés par le catalog factory et (plus
// tard) par l'éditeur de patches custom.
//
// Spec (CLAUDE.md "Modèle TMP — décisions validées") :
// - 9 types de bloc : comp, drive, amp, cab, mod, delay, reverb,
//   noise_gate, eq.
// - amp et cab obligatoires dans un patch ; tous les autres optionnels.
// - params : objet { [k]: number | string } — string admis pour cab
//   (mic, axis), pour le reste essentiellement number.
// - Le firmware TMP supporte ~5 paramètres principaux par bloc, mais
//   certains amps (Plexi : 2 channels) en ont 6. On tolère jusqu'à 10.

import { MODELS_BY_TYPE, STYLES, GAINS } from './whitelist.js';

const BLOCK_TYPES = [
  'comp',
  'drive',
  'amp',
  'cab',
  'mod',
  'delay',
  'reverb',
  'noise_gate',
  'eq',
];

// Paramètres standards par type (référence pour la doc et l'autocomplete).
// Pas de validation stricte sur les NOMS de params (le firmware accepte
// des variations selon le model — ex. Plexi a volume_i/volume_ii au lieu
// de gain). On valide seulement la structure générale.
const STANDARD_PARAMS = {
  comp: ['threshold', 'ratio', 'attack', 'release', 'level'],
  drive: ['drive', 'tone', 'level', 'presence', 'mix'],
  amp: ['gain', 'bass', 'mid', 'treble', 'presence'],
  cab: ['low_cut', 'high_cut', 'depth', 'color', 'level'],
  mod: ['rate', 'depth', 'mix', 'feedback', 'type'],
  delay: ['time', 'feedback', 'mix', 'hi_cut', 'low_cut'],
  reverb: ['decay', 'mix', 'hi_cut', 'low_cut', 'predelay'],
  noise_gate: ['threshold', 'attenuation'],
  eq: ['low_freq', 'low_gain', 'mid_freq', 'mid_gain', 'hi_gain'],
};

// Limite haute du nombre de params par bloc (tolérance pour amps multi-canal).
const MAX_PARAMS_PER_BLOCK = 10;

function validateBlock(block) {
  const errors = [];
  if (!block || typeof block !== 'object') return { valid: false, errors: ['block is not an object'] };
  if (!BLOCK_TYPES.includes(block.type)) errors.push(`type "${block.type}" not in BLOCK_TYPES`);
  if (typeof block.model !== 'string' || !block.model) errors.push('model must be a non-empty string');
  if (typeof block.enabled !== 'boolean') errors.push('enabled must be a boolean');
  if (!block.params || typeof block.params !== 'object') errors.push('params must be an object');
  // Model dans la whitelist du type
  if (BLOCK_TYPES.includes(block.type) && typeof block.model === 'string') {
    const allowed = MODELS_BY_TYPE[block.type] || [];
    if (!allowed.includes(block.model)) {
      errors.push(`model "${block.model}" not in whitelist for type "${block.type}"`);
    }
  }
  // Nombre de params raisonnable
  if (block.params && typeof block.params === 'object') {
    const keys = Object.keys(block.params);
    if (keys.length > MAX_PARAMS_PER_BLOCK) {
      errors.push(`too many params: ${keys.length} > ${MAX_PARAMS_PER_BLOCK}`);
    }
    // Valeurs : number ou string (cab autorise mic/axis en string)
    for (const [k, v] of Object.entries(block.params)) {
      if (typeof v !== 'number' && typeof v !== 'string') {
        errors.push(`params.${k} must be number or string (got ${typeof v})`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

// Slots optionnels d'un patch (en plus de amp + cab obligatoires).
const OPTIONAL_BLOCK_SLOTS = ['comp', 'drive', 'mod', 'delay', 'reverb', 'noise_gate', 'eq'];

function validatePatch(patch) {
  const errors = [];
  if (!patch || typeof patch !== 'object') return { valid: false, errors: ['patch is not an object'] };
  if (typeof patch.id !== 'string' || !patch.id) errors.push('id must be a non-empty string');
  if (typeof patch.name !== 'string' || !patch.name) errors.push('name must be a non-empty string');

  // Blocs obligatoires
  if (!patch.amp) errors.push('amp block is required');
  if (!patch.cab) errors.push('cab block is required');

  // Validation de chaque bloc présent
  // Les blocs sont stockés directement comme champs (patch.amp, patch.cab, …).
  // On vérifie que chaque bloc a son type cohérent avec son slot.
  const checkSlot = (slot) => {
    if (!patch[slot]) return;
    const blockWithType = { ...patch[slot], type: slot };
    const v = validateBlock(blockWithType);
    if (!v.valid) {
      errors.push(`${slot}: ${v.errors.join('; ')}`);
    }
  };
  checkSlot('amp');
  checkSlot('cab');
  for (const slot of OPTIONAL_BLOCK_SLOTS) checkSlot(slot);

  // Style et gain
  if (!STYLES.includes(patch.style)) errors.push(`style "${patch.style}" not in STYLES`);
  if (!GAINS.includes(patch.gain)) errors.push(`gain "${patch.gain}" not in GAINS`);

  // pickupAffinity : objet {HB, SC, P90} numbers 0-100
  if (!patch.pickupAffinity || typeof patch.pickupAffinity !== 'object') {
    errors.push('pickupAffinity must be an object');
  } else {
    for (const k of ['HB', 'SC', 'P90']) {
      const v = patch.pickupAffinity[k];
      if (typeof v !== 'number' || v < 0 || v > 100) {
        errors.push(`pickupAffinity.${k} must be a number in [0, 100] (got ${v})`);
      }
    }
  }

  // Phase 4 — scenes et footswitchMap (optionnels)
  let sceneIds = [];
  if (patch.scenes !== undefined) {
    if (!Array.isArray(patch.scenes)) {
      errors.push('scenes must be an array');
    } else {
      const seen = new Set();
      patch.scenes.forEach((sc, i) => {
        const v = validateScene(sc);
        if (!v.valid) errors.push(`scenes[${i}]: ${v.errors.join('; ')}`);
        if (sc && sc.id) {
          if (seen.has(sc.id)) errors.push(`scenes[${i}]: duplicate id "${sc.id}"`);
          seen.add(sc.id);
          sceneIds.push(sc.id);
        }
      });
    }
  }
  if (patch.footswitchMap !== undefined) {
    const v = validateFootswitchMap(patch.footswitchMap, sceneIds);
    if (!v.valid) errors.push(...v.errors);
  }

  return { valid: errors.length === 0, errors };
}

// Liste des slots de bloc d'un patch (utile pour itération ordre standard
// d'affichage : noise_gate → comp → eq → drive → amp → cab → mod → delay →
// reverb).
const RENDER_ORDER = ['noise_gate', 'comp', 'eq', 'drive', 'amp', 'cab', 'mod', 'delay', 'reverb'];

function getPatchBlocks(patch) {
  if (!patch) return [];
  return RENDER_ORDER
    .filter((slot) => !!patch[slot])
    .map((slot) => ({ slot, ...patch[slot] }));
}

// ─── Phase 4 — Scenes & footswitch map ──────────────────────────────
// Les scenes appliquent des surcharges d'enabled/params/ampLevel sur le
// patch parent au moment du rendu live. Le footswitchMap décrit
// l'action assignée à chacun des 4 footswitches du TMP.

const TOGGLE_BLOCKS = ['drive', 'mod', 'delay', 'reverb', 'comp', 'noise_gate', 'eq'];
const FS_KEYS = ['fs1', 'fs2', 'fs3', 'fs4'];

function validateScene(scene) {
  const errors = [];
  if (!scene || typeof scene !== 'object') return { valid: false, errors: ['scene is not an object'] };
  if (typeof scene.id !== 'string' || !scene.id) errors.push('scene.id must be a non-empty string');
  if (typeof scene.name !== 'string' || !scene.name) errors.push('scene.name must be a non-empty string');
  if (scene.blockToggles !== undefined) {
    if (!scene.blockToggles || typeof scene.blockToggles !== 'object') {
      errors.push('scene.blockToggles must be an object');
    } else {
      for (const [k, v] of Object.entries(scene.blockToggles)) {
        if (!BLOCK_TYPES.includes(k)) errors.push(`scene.blockToggles.${k} not a known block type`);
        if (typeof v !== 'boolean') errors.push(`scene.blockToggles.${k} must be boolean`);
      }
    }
  }
  if (scene.paramOverrides !== undefined) {
    if (!scene.paramOverrides || typeof scene.paramOverrides !== 'object') {
      errors.push('scene.paramOverrides must be an object');
    } else {
      for (const [blockType, params] of Object.entries(scene.paramOverrides)) {
        if (!BLOCK_TYPES.includes(blockType)) {
          errors.push(`scene.paramOverrides.${blockType} not a known block type`);
          continue;
        }
        if (!params || typeof params !== 'object') {
          errors.push(`scene.paramOverrides.${blockType} must be an object`);
          continue;
        }
        for (const [k, v] of Object.entries(params)) {
          if (typeof v !== 'number' && typeof v !== 'string') {
            errors.push(`scene.paramOverrides.${blockType}.${k} must be number or string`);
          }
        }
      }
    }
  }
  if (scene.ampLevelOverride !== undefined) {
    if (typeof scene.ampLevelOverride !== 'number' || scene.ampLevelOverride < 0 || scene.ampLevelOverride > 100) {
      errors.push('scene.ampLevelOverride must be a number in [0, 100]');
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateFootswitchEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') return { valid: false, errors: ['entry is not an object'] };
  if (entry.type === 'scene') {
    if (typeof entry.sceneId !== 'string' || !entry.sceneId) errors.push('scene entry: sceneId required');
  } else if (entry.type === 'toggle') {
    if (!TOGGLE_BLOCKS.includes(entry.block)) errors.push(`toggle entry: block "${entry.block}" not toggleable`);
  } else if (entry.type === 'tap_tempo') {
    // rien d'autre à valider
  } else {
    errors.push(`entry.type "${entry.type}" not in {scene, toggle, tap_tempo}`);
  }
  return { valid: errors.length === 0, errors };
}

// Valide un footswitchMap dans le contexte d'un patch (référence croisée
// fs.sceneId ↔ patch.scenes[*].id). sceneIds = liste des ids de scenes
// disponibles, fournie par le caller (par défaut [], aucune scene → tout
// type:'scene' devient invalide).
function validateFootswitchMap(map, sceneIds = []) {
  const errors = [];
  if (map === undefined || map === null) return { valid: true, errors: [] }; // optionnel
  if (typeof map !== 'object') return { valid: false, errors: ['footswitchMap must be an object'] };
  for (const [k, entry] of Object.entries(map)) {
    if (!FS_KEYS.includes(k)) {
      errors.push(`footswitchMap.${k} not in {fs1, fs2, fs3, fs4}`);
      continue;
    }
    if (entry === undefined || entry === null) continue; // slot vide toléré
    const v = validateFootswitchEntry(entry);
    if (!v.valid) {
      errors.push(`footswitchMap.${k}: ${v.errors.join('; ')}`);
      continue;
    }
    if (entry.type === 'scene' && !sceneIds.includes(entry.sceneId)) {
      errors.push(`footswitchMap.${k}: sceneId "${entry.sceneId}" not in patch.scenes`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// Applique une scene à un patch et retourne un patch "résolu" :
// - blockToggles surchargent block.enabled
// - paramOverrides fusionnent les params (override clé par clé)
// - ampLevelOverride est posé sur patch._ampLevel (champ runtime, pas
//   persisté). Si la scene n'existe pas, retourne le patch tel quel.
function applyScene(patch, sceneId) {
  if (!patch) return patch;
  if (!sceneId) return patch;
  const scene = (patch.scenes || []).find((s) => s.id === sceneId);
  if (!scene) return patch;
  const out = { ...patch };
  // blockToggles
  if (scene.blockToggles) {
    for (const [blockType, enabled] of Object.entries(scene.blockToggles)) {
      if (out[blockType]) {
        out[blockType] = { ...out[blockType], enabled };
      }
    }
  }
  // paramOverrides
  if (scene.paramOverrides) {
    for (const [blockType, overrides] of Object.entries(scene.paramOverrides)) {
      if (out[blockType]) {
        out[blockType] = {
          ...out[blockType],
          params: { ...(out[blockType].params || {}), ...overrides },
        };
      }
    }
  }
  // ampLevelOverride : exposé en champ runtime _ampLevel (consommé par UI live).
  if (typeof scene.ampLevelOverride === 'number') {
    out._ampLevel = scene.ampLevelOverride;
  }
  out._activeSceneId = sceneId;
  return out;
}

export {
  BLOCK_TYPES,
  STANDARD_PARAMS,
  MAX_PARAMS_PER_BLOCK,
  OPTIONAL_BLOCK_SLOTS,
  RENDER_ORDER,
  TOGGLE_BLOCKS,
  FS_KEYS,
  validateBlock,
  validatePatch,
  getPatchBlocks,
  validateScene,
  validateFootswitchEntry,
  validateFootswitchMap,
  applyScene,
};
