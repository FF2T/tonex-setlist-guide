// src/core/scoring/preset-settings.js — Phase 9.1 (2026-05-21)
//                                       + Phase 9.4 (2026-05-22)
// Helper pur de validation des réglages PRESET retournés par l'IA.
//
// L'IA retourne un objet `preset_settings_v1` au format :
//   {
//     cab_enabled: boolean,
//     main: { gain, bass, mid, treble, volume },        // 5 knobs face avant
//     alt:  { presence, depth, reverb_mix, comp_threshold, gate_threshold },
//     why:  { fr, en, es },                             // explication trilingue
//     tweaks: [{ symptom: {fr,en,es}, fix: string }]    // Phase 9.4 — ajustements
//                                                       // empiriques post-écoute
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

// Phase 9.4 — cap dur sur le nombre de tweaks (l'IA est guidée vers 6-8
// dans le prompt mais peut en générer plus si elle hallucine). Au-delà,
// on tronque silencieusement pour préserver la densité UI.
const TWEAKS_MAX = 8;

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

// Pure helper : valide une entrée knob individuel. Phase 7.86 (2026-05-21)
// supporte 2 formats :
// - Ancien (Phase 9.1-10) : knob = number → coerce vers { value: number }
// - Nouveau (Phase 7.86)  : knob = { value: number, why?: { fr,en,es } }
// Retourne null si la valeur n'est pas validable, sinon un objet
// { value, why? } avec value clampé dans son range et why trilingue
// validé (skip si absent ou invalide).
function clampKnob(label, knob, range) {
  if (knob === null || knob === undefined) return null;
  // Ancien format : nombre direct
  if (typeof knob === 'number') {
    const v = clampValue(label, knob, range);
    return v !== null ? { value: v } : null;
  }
  // Nouveau format : objet { value, why? }
  if (typeof knob === 'object' && !Array.isArray(knob)) {
    const v = clampValue(label, knob.value, range);
    if (v === null) return null;
    const out = { value: v };
    const whyClean = validateTrilingual(knob.why);
    if (whyClean) out.why = whyClean;
    return out;
  }
  return null;
}

// Pure helper : clamp un sous-objet (main ou alt) selon ses ranges.
// Retourne un nouvel objet contenant uniquement les champs valides
// présents dans l'input. Skip silencieusement les champs inconnus.
function clampGroup(label, input, ranges) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const key of Object.keys(ranges)) {
    if (key in input) {
      const knob = clampKnob(`${label}.${key}`, input[key], ranges[key]);
      if (knob !== null) out[key] = knob;
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

// Phase 9.4 — valide la structure d'un tableau de tweaks. Chaque entrée :
//   { symptom: {fr,en,es}, fix: string }
// - symptom : structure trilingue validée via validateTrilingual
// - fix     : string non-vide (verbiage technique universel, ex.
//             "Treble -0.5 + Presence -0.3"). Pas de trilingue car
//             les noms de paramètres sont universels.
// Drop silencieusement les entrées malformées. Cap à TWEAKS_MAX items.
// Retourne null si input n'est pas un Array ou si rien de valide.
function clampTweaks(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const entry of raw) {
    if (out.length >= TWEAKS_MAX) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const symptom = validateTrilingual(entry.symptom);
    if (!symptom) continue;
    const fix = typeof entry.fix === 'string' ? entry.fix.trim() : '';
    if (!fix) continue;
    out.push({ symptom, fix });
  }
  return out.length > 0 ? out : null;
}

// Helper principal exporté. Retourne :
// - null si `raw` n'est pas un objet ou si tout est invalide
// - sinon un objet { cab_enabled?, main?, alt?, why? } avec uniquement
//   les champs validés présents.
//
// Phase 10 v3 (2026-05-21 nuit) — cab_enabled force à `true` si présent
// dans l'input, peu importe sa valeur. Raison : les 3 contextes
// d'écoute supportés Phase 10 v2 (frfr / headphone / pa) n'ont AUCUN
// cab physique aval, donc le bloc CAB du firmware ToneX DOIT être
// activé pour entendre la capture complète (manuel TONEX p.29 :
// CAB active = bloc CAB du TONE MODEL activé).
//
// CAB OFF (bypass) n'a de sens que vers un cab physique guitare —
// cas retiré Phase 10 v2 (ampWithCab). Si Gemini retourne
// cab_enabled: false par erreur (heuristique AMP+CAB des prompts
// antérieurs), on override à true. Si Gemini omet le champ, on
// préserve le comportement partial (l'UI gère).
//
// Phase 10.1 future (reportée) : si on enrichit PRESET_CATALOG_MERGED
// avec hasCab + on réintroduit ampWithCab, cette logique sera
// redevenue conditionnelle.
function clampPresetSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  if (typeof raw.cab_enabled === 'boolean') {
    if (raw.cab_enabled === false) {
      console.warn('[preset-settings] cab_enabled=false ignoré (Phase 10 v3 : toujours true sur frfr/headphone/pa)');
    }
    out.cab_enabled = true;
  }
  const mainClean = clampGroup('main', raw.main, PRESET_RANGES.main);
  if (mainClean) out.main = mainClean;
  const altClean = clampGroup('alt', raw.alt, PRESET_RANGES.alt);
  if (altClean) out.alt = altClean;
  const whyClean = validateTrilingual(raw.why);
  if (whyClean) out.why = whyClean;
  const tweaksClean = clampTweaks(raw.tweaks);
  if (tweaksClean) out.tweaks = tweaksClean;
  return Object.keys(out).length > 0 ? out : null;
}

// Phase 9.2 (2026-05-22) — valide la structure d'un objet `fx_blocks`
// retourné par l'IA. Phase 9.7 (2026-05-23) étendu avec sub-params
// par bloc (Niveau 2). Format complet :
//   {
//     noise_gate: { enabled: boolean, release?, depth?, why? },
//     compressor: { enabled: boolean, gain?, attack?, why? },
//     modulation: { enabled: boolean, type?: MOD_TYPE, why? },  // Niveau 1 only
//     delay:      { enabled: boolean, type?: DELAY_TYPE, mode?: DELAY_MODE,
//                   time?, feedback?, mix?, why? },
//     reverb:     { enabled: boolean, type?: REVERB_TYPE, time?, pre_delay?,
//                   color?, mix?, why? }
//   }
//
// Types officiels du manuel TONEX p.22-28 :
// - MOD_TYPES    : Chorus / Tremolo / Phaser / Flanger / Rotary
// - DELAY_TYPES  : Digital / Tape
// - DELAY_MODES  : Normal / Ping.Pong (Phase 9.7)
// - REVERB_TYPES : Spring 1 / Spring 2 / Spring 3 / Spring 4 / Room / Plate
//   (Phase 9.7 — retire Hall/Shimmer Niveau 1, ajoute 4 variantes Spring
//   numérotées conformes firmware)
//
// Ranges officiels par sub-param (Phase 9.7 manuel TONEX p.22-28) :
// - noise_gate.release : 5-500 ms
// - noise_gate.depth   : -100 à -20 dB
// - compressor.gain    : -30 à +10 dB
// - compressor.attack  : 1-51 ms
// - delay.time         : 0-1000 ms
// - delay.feedback     : 0-100 %
// - delay.mix          : 0-100 %
// - reverb.time        : 0-10 (scale)
// - reverb.pre_delay   : 0-500 ms
// - reverb.color       : -10 à +10
// - reverb.mix         : 0-100 %
//
// Note : threshold gate/comp restent dans preset_settings_v1.alt
// (Phase 9.1) — pas dupliqués ici. L'UI Phase 9.7 les affiche dans la
// section Effets sous leur bloc respectif (regroupement visuel).
// reverb_mix existe aussi dans alt (Phase 9.1) ET ici (Phase 9.7) —
// décision data : on accepte les deux côté validation, l'UI lit
// uniquement alt.reverb_mix pour la rétro-compat.
//
// Validation conservative : enabled DOIT être boolean (sinon drop le
// bloc entier). type/mode DOIT être dans l'enum (sinon retire ce
// champ, garde enabled). Sub-params hors-bornes → clamp + warn.
// Sub-params inconnus → skip silencieusement. why validé via
// validateTrilingual.

const FX_BLOCK_KEYS = Object.freeze([
  'noise_gate', 'compressor', 'modulation', 'delay', 'reverb',
]);

const FX_TYPE_ENUMS = Object.freeze({
  modulation: Object.freeze(['Chorus', 'Tremolo', 'Phaser', 'Flanger', 'Rotary']),
  delay: Object.freeze(['Digital', 'Tape']),
  delay_mode: Object.freeze(['Normal', 'Ping.Pong']),
  reverb: Object.freeze(['Spring 1', 'Spring 2', 'Spring 3', 'Spring 4', 'Room', 'Plate']),
});

const FX_BLOCK_RANGES = Object.freeze({
  noise_gate: Object.freeze({
    release: { min: 5,    max: 500,  unit: 'ms' },
    depth:   { min: -100, max: -20,  unit: 'dB' },
  }),
  compressor: Object.freeze({
    gain:    { min: -30,  max: 10,   unit: 'dB' },
    attack:  { min: 1,    max: 51,   unit: 'ms' },
  }),
  delay: Object.freeze({
    time:     { min: 0,   max: 1000, unit: 'ms' },
    feedback: { min: 0,   max: 100,  unit: '%' },
    mix:      { min: 0,   max: 100,  unit: '%' },
  }),
  reverb: Object.freeze({
    time:      { min: 0,    max: 10,   unit: '' },
    pre_delay: { min: 0,    max: 500,  unit: 'ms' },
    color:     { min: -10,  max: 10,   unit: '' },
    mix:       { min: 0,    max: 100,  unit: '%' },
  }),
});

function clampFxBlock(key, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.enabled !== 'boolean') return null;
  const out = { enabled: raw.enabled };

  // type enum pour modulation/delay/reverb (case-insensitive matching).
  const typeEnum = FX_TYPE_ENUMS[key];
  if (typeEnum && typeof raw.type === 'string' && raw.type.trim()) {
    const found = typeEnum.find((t) => t.toLowerCase() === raw.type.trim().toLowerCase());
    if (found) out.type = found;
  }

  // mode enum (Phase 9.7) — delay uniquement (Normal / Ping.Pong).
  if (key === 'delay' && typeof raw.mode === 'string' && raw.mode.trim()) {
    const modeEnum = FX_TYPE_ENUMS.delay_mode;
    const found = modeEnum.find((m) => m.toLowerCase() === raw.mode.trim().toLowerCase());
    if (found) out.mode = found;
  }

  // sub-params numériques (Phase 9.7) — clamp dans le range officiel.
  const ranges = FX_BLOCK_RANGES[key];
  if (ranges) {
    for (const paramKey of Object.keys(ranges)) {
      if (paramKey in raw) {
        const clamped = clampValue(`fx_blocks.${key}.${paramKey}`, raw[paramKey], ranges[paramKey]);
        if (clamped !== null) out[paramKey] = clamped;
      }
    }
  }

  const whyClean = validateTrilingual(raw.why);
  if (whyClean) out.why = whyClean;
  return out;
}

function clampFxBlocks(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const key of FX_BLOCK_KEYS) {
    const block = clampFxBlock(key, raw[key]);
    if (block) out[key] = block;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Phase 9.5 (2026-05-22) — valide la structure d'un objet `playing_hints`
// retourné par l'IA. Format scalaire (pas trilingue : valeurs courtes
// universelles, comme les noms de pickup et les ranges) :
//   {
//     pickup: string,         // "Bridge", "Neck", "Position 2-4", "Middle+Bridge"...
//     guitar_volume: string,  // "8-10", "10 (full)", "5-7"...
//     guitar_tone: string,    // "10 (open)", "7-9", "5-7"...
//     stereo: boolean         // true si setup stereo recommandé (rare)
//   }
// Tous champs optionnels (preserve partial). Strings vides/non-strings
// → drop. Stereo non-boolean → drop. Retourne null si tout vide.
//
// picking_style est volontairement EXCLU : déjà couvert par
// settings_guitar (prose trilingue). Pas de duplication.
function clampPlayingHints(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const key of ['pickup', 'guitar_volume', 'guitar_tone']) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  if (typeof raw.stereo === 'boolean') out.stereo = raw.stereo;
  return Object.keys(out).length > 0 ? out : null;
}

export { PRESET_RANGES, SUPPORTED_LOCALES, TWEAKS_MAX, FX_BLOCK_KEYS, FX_TYPE_ENUMS, FX_BLOCK_RANGES, clampPresetSettings, clampTweaks, clampPlayingHints, clampFxBlocks };
