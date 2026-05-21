// src/core/scoring/preset-settings.js — Phase 9.1 (2026-05-21)
// Helper pur de validation des réglages PRESET retournés par l'IA.
//
// L'IA retourne un objet `preset_settings_v1` au format :
//   {
//     cab_enabled: boolean,
//     main: { gain, bass, mid, treble, volume },        // 5 knobs face avant
//     alt:  { presence, depth, reverb_mix, comp_threshold, gate_threshold },
//     why:  { fr, en, es }                              // explication trilingue
//   }
//
// Les ranges officiels viennent du manuel TONEX (pages 22-28) :
// `tone_models/TONEX_Pedal_User_Manual_French.pdf`. Conforme aux 5
// devices ToneX (Pedal classique, Anniversary, Plug, One, One+) qui
// partagent les mêmes capacités de réglage PRESET (confirmé Sébastien
// 2026-05-21).
//
// Le helper clamp chaque valeur hors-bornes (Gemini hallucine
// occasionnellement) et émet un `console.warn` détaillé. Retourne
// l'objet validé ou null si la structure est totalement invalide.
// Approche tolérante : préserve les champs présents même si l'IA
// n'en retourne qu'une partie.

// Ranges officiels (manuel TONEX). Format : { min, max, unit }.
// Notes :
// - 'main' / 'alt' réfèrent à la face avant (boutons principaux + ALT).
// - reverb_mix / comp_threshold / gate_threshold sont les paramètres
//   ALT chiffrés (cf manuel p.22).
const PRESET_RANGES = Object.freeze({
  main: Object.freeze({
    gain:    { min: 0,  max: 10,  unit: '' },
    bass:    { min: 0,  max: 10,  unit: '' },
    mid:     { min: 0,  max: 10,  unit: '' },
    treble:  { min: 0,  max: 10,  unit: '' },
    volume:  { min: 0,  max: 10,  unit: '' },
  }),
  alt: Object.freeze({
    presence:         { min: 0,    max: 10,  unit: '' },
    depth:            { min: 0,    max: 10,  unit: '' },
    reverb_mix:       { min: 0,    max: 100, unit: '%' },
    comp_threshold:   { min: -40,  max: 0,   unit: 'dB' },
    gate_threshold:   { min: -100, max: 0,   unit: 'dB' },
  }),
});

const SUPPORTED_LOCALES = ['fr', 'en', 'es'];

// Pure helper : clamp une valeur numérique dans un range, warn si
// hors-bornes. Retourne null si la valeur n'est pas un nombre fini.
function clampValue(label, value, range) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < range.min) {
    console.warn(`[preset-settings] ${label}=${value} below min ${range.min} — clamped`);
    return range.min;
  }
  if (value > range.max) {
    console.warn(`[preset-settings] ${label}=${value} above max ${range.max} — clamped`);
    return range.max;
  }
  return value;
}

// Pure helper : clamp un sous-objet (main ou alt) selon ses ranges.
// Retourne un nouvel objet contenant uniquement les champs valides
// présents dans l'input. Skip silencieusement les champs inconnus.
function clampGroup(label, input, ranges) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const key of Object.keys(ranges)) {
    if (key in input) {
      const v = clampValue(`${label}.${key}`, input[key], ranges[key]);
      if (v !== null) out[key] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Pure helper : valide la structure trilingue { fr, en, es }. Retourne
// un objet avec les langues valides (string non-vide). Si aucune langue
// valide, retourne null.
function validateTrilingual(why) {
  if (!why || typeof why !== 'object') return null;
  const out = {};
  for (const loc of SUPPORTED_LOCALES) {
    if (typeof why[loc] === 'string' && why[loc].trim()) out[loc] = why[loc];
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Helper principal exporté. Retourne :
// - null si `raw` n'est pas un objet ou si tout est invalide
// - sinon un objet { cab_enabled?, main?, alt?, why? } avec uniquement
//   les champs validés présents.
function clampPresetSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  if (typeof raw.cab_enabled === 'boolean') out.cab_enabled = raw.cab_enabled;
  const mainClean = clampGroup('main', raw.main, PRESET_RANGES.main);
  if (mainClean) out.main = mainClean;
  const altClean = clampGroup('alt', raw.alt, PRESET_RANGES.alt);
  if (altClean) out.alt = altClean;
  const whyClean = validateTrilingual(raw.why);
  if (whyClean) out.why = whyClean;
  return Object.keys(out).length > 0 ? out : null;
}

export { PRESET_RANGES, SUPPORTED_LOCALES, clampPresetSettings };
