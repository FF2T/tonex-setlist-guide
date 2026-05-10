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

export {
  BLOCK_TYPES,
  STANDARD_PARAMS,
  MAX_PARAMS_PER_BLOCK,
  OPTIONAL_BLOCK_SLOTS,
  RENDER_ORDER,
  validateBlock,
  validatePatch,
  getPatchBlocks,
};
