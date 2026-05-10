// src/devices/tonemaster-pro/whitelist.js — Phase 3.
// Whitelist EXACTE des amp/cab/drive/fx/comp/eq/noise_gate models supportés
// par le firmware TMP v1.6 (cf CLAUDE.md sections "Whitelist amp models TMP",
// "Whitelist cabs TMP", "Whitelist drives TMP", "Whitelist FX TMP",
// "Ajouts à la whitelist (issus des patches Arthur)").
//
// Tout model référencé par un patch DOIT être dans la whitelist correspondante,
// sinon validatePatch rejette le patch. Garantit que l'IA et l'utilisateur
// n'inventent pas de model qui n'existe pas réellement sur le device.

const AMP_MODELS = [
  // Marshall-style (7)
  'British Plexi',
  'British 45',
  'British 800',
  'British Jubilee Clean',
  'British Jubilee Rhythm',
  'British Jubilee Lead',
  'Brit Breaker',
  // Fender-style (13)
  "Fender '57 Deluxe",
  "Fender '59 Bassman",
  "Fender '59 Bassman Custom",
  "Fender '62 Princeton",
  "Fender '65 Deluxe Reverb",
  "Fender '65 Deluxe Reverb Blonde NBC",
  "Fender '65 Princeton Reverb",
  "Fender '65 Super Reverb",
  "Fender '65 Twin Reverb",
  'Fender Blues Junior',
  'Fender Blues Junior LTD',
  'Fender Bassbreaker',
  'Fender Vibro-King',
  // Boutique / autres (5 + 2 EVH = 7)
  'UK 30 Brilliant',
  'JC Clean',
  'Marksman CH1',
  'Solo 100 Overdrive',
  'Tangerine RV53',
  'Double Wreck',
  'EVH 5150 6L6 Green',
  'EVH 5150 6L6 Blue',
];

const CAB_MODELS = [
  // Whitelist principale v1 (12)
  "1x10 '62 Princeton C10R",
  "1x12 '57 Deluxe",
  "1x12 '57 Deluxe Alnico Blue",
  "1x12 '65 Deluxe C12K",
  "1x12 '65 Deluxe Creamback",
  '1x12 Bassbreaker',
  '1x12 Blues Junior C12N',
  "2x12 '65 Twin C12K",
  '4x12 British Plexi Greenback',
  '4x12 British 800 G12T',
  '4x12 Brit Breaker',
  '4x12 EVH 5150',
  // Ajouts Arthur (2)
  "4x10 '59 Bassman Tweed",
  '2x12 Twin D120',
];

const DRIVE_MODELS = [
  // Whitelist principale v1 (8)
  'Tube Screamer',
  'Klon',
  'Boost',
  'OD-1',
  'Blues Driver',
  'Rat',
  'Big Muff',
  'DS-1',
  // Ajout Arthur (1)
  'Super Drive',
];

const MOD_MODELS = ['Chorus', 'Phaser', 'Flanger', 'Tremolo', 'Vibrato', 'Univibe'];

const DELAY_MODELS = ['Analog Delay', 'Tape Echo', 'Digital Delay', 'Reverse Delay'];

const REVERB_MODELS = ['Spring', 'Plate', 'Hall', 'Room', 'Shimmer'];

// Ajouts Arthur — nouveaux types de bloc (étendent la liste à 9 au lieu de 7).
const COMP_MODELS = ['Studio Compressor'];

const EQ_MODELS = ['EQ-5 Parametric'];

const NOISE_GATE_MODELS = ['Noise Reducer'];

// Map agrégée par type de bloc, utilisée par validateBlock.
const MODELS_BY_TYPE = {
  comp: COMP_MODELS,
  drive: DRIVE_MODELS,
  amp: AMP_MODELS,
  cab: CAB_MODELS,
  mod: MOD_MODELS,
  delay: DELAY_MODELS,
  reverb: REVERB_MODELS,
  noise_gate: NOISE_GATE_MODELS,
  eq: EQ_MODELS,
};

// Styles et gains valides pour un patch.
const STYLES = ['blues', 'rock', 'hard_rock', 'jazz', 'metal', 'pop'];
const GAINS = ['low', 'mid', 'high'];

// Phase 3.6 — Échelle des knobs d'ampli pour l'affichage user-facing.
// Par défaut /10 (Marshall, Mesa, EVH, etc.). Les amps tweed historiques
// utilisaient une graduation 1-12 (Bassman, '57 Deluxe et variantes).
// Cette info n'est PAS visible sur la pédale TMP elle-même — c'est une
// précision ajoutée pour que l'utilisateur sache si un knob réglé à 7
// est "haut" (sur /10) ou "milieu" (sur /12). Utilisé par
// formatBlockParam('amp', ...) dans RecommendBlock.jsx.
const AMP_SCALE_BY_MODEL = {
  "Fender '57 Deluxe": 12,
  "Fender '59 Bassman": 12,
  "Fender '59 Bassman Custom": 12,
};
const DEFAULT_AMP_SCALE = 10;

export {
  AMP_MODELS,
  CAB_MODELS,
  DRIVE_MODELS,
  MOD_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  COMP_MODELS,
  EQ_MODELS,
  NOISE_GATE_MODELS,
  MODELS_BY_TYPE,
  STYLES,
  GAINS,
  AMP_SCALE_BY_MODEL,
  DEFAULT_AMP_SCALE,
};
