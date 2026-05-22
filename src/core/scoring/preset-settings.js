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

export { PRESET_RANGES, SUPPORTED_LOCALES, TWEAKS_MAX, clampPresetSettings, clampTweaks };
