// src/core/scoring/jam.js — Phase 14.2.
//
// Métrique « ampli passe-partout » pour les JAMS — distincte du scoring V9
// (SCORING_VERSION reste 9, ce module ne touche PAS l'agrégateur V9 ni les
// snapshots). Un jam privilégie la RÉGULARITÉ sur un style, pas le pic de
// fidélité historique : on retire donc la dimension refAmp (computeRefAmpScore)
// et on renormalise les poids restants.
//
// Briques V9 réutilisées sans modif : computePickupScore (pickup.js),
// computeGainMatchScore / computeStyleMatchScore / getGainRange / gainToNumeric
// (style.js + index.js).

import {
  computePickupScore, computeGainMatchScore, computeStyleMatchScore,
  getGainRange, gainToNumeric,
} from './index.js';

// Poids jam = poids V9 du chemin "sans guitare" (computeBestPresets) MOINS
// refAmp (0.30), renormalisés sur les dimensions actives :
//   pickup 0.25 · gainMatch 0.20 · styleMatch 0.25  (somme 0.70)
const JAM_WEIGHTS = { pickup: 0.25, gainMatch: 0.20, styleMatch: 0.25 };

// Extrait {style, targetGain} d'un objet song (aiCache.result) ou d'un
// contexte direct {style/song_style, targetGain/target_gain}.
function songCtx(song) {
  const r = song?.aiCache?.result || song || {};
  const style = r.song_style || r.style || null;
  const targetGain = typeof r.target_gain === 'number' ? r.target_gain
    : (typeof r.targetGain === 'number' ? r.targetGain : null);
  return { style, targetGain };
}

// jamScore(preset, song, guitars) → 0-100. Fitness de STYLE, pas authenticité.
//
// Décision pickup (multi-guitares) : un jam se joue avec PLUSIEURS guitares
// du rig, pas une seule. On NE passe PAS un pickupType arbitraire → pour
// chaque guitare du rig on calcule computePickupScore et on prend le
// MEILLEUR (l'ampli passe-partout convient si AU MOINS une guitare matche
// bien — contexte d'impro). Si le rig est vide / pickup indéterminable, le
// terme pickup est NEUTRALISÉ (retiré de la renormalisation, pas mis à 0 qui
// pénaliserait à tort).
function jamScore(preset, song, guitars) {
  if (!preset) return 0;
  const presetGain = typeof preset.gain === 'number' ? preset.gain : gainToNumeric(preset.gain);
  const presetGainRange = getGainRange(presetGain);
  const { style: songStyle, targetGain } = songCtx(song);

  let pickupScore = null;
  const rig = Array.isArray(guitars) ? guitars : [];
  if (rig.length) {
    let best = -1;
    for (const g of rig) {
      const pt = g?.type || g?.pickupType || 'HB';
      const s = computePickupScore(preset.style, presetGainRange, pt);
      if (typeof s === 'number' && s > best) best = s;
    }
    if (best >= 0) pickupScore = best;
  }
  const gainMatchScore = computeGainMatchScore(presetGain, targetGain); // null si pas de target
  const styleScore = computeStyleMatchScore(preset.style, songStyle);   // null si pas de style

  const dims = [
    { score: pickupScore, weight: JAM_WEIGHTS.pickup },
    { score: gainMatchScore, weight: JAM_WEIGHTS.gainMatch },
    { score: styleScore, weight: JAM_WEIGHTS.styleMatch },
  ];
  const active = dims.filter((d) => d.score !== null && d.score !== undefined);
  if (!active.length) return 0;
  const totalWeight = active.reduce((s, d) => s + d.weight, 0);
  let final = 0;
  for (const d of active) final += (d.weight / totalWeight) * d.score;
  return Math.max(0, Math.min(100, Math.round(final)));
}

// Stats pures de polyvalence sur une série de scores (1 par morceau).
//   polyvalence = moyenne − k·écartType   (k défaut 1.5)
//   couverture  = nombre de morceaux ≥ 80
// C'est le cœur du « passe-partout » : pénalise l'irrégularité (gros écart
// type = ampli qui brille sur certains morceaux et s'effondre sur d'autres).
function versatilityStats(scores, k = 1.5) {
  const arr = (scores || []).filter((s) => typeof s === 'number');
  const n = arr.length;
  if (!n) return { moyenne: 0, ecartType: 0, polyvalence: 0, couverture: 0, n: 0 };
  const mean = arr.reduce((s, x) => s + x, 0) / n;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    moyenne: r1(mean),
    ecartType: r1(std),
    polyvalence: r1(mean - k * std),
    couverture: arr.filter((s) => s >= 80).length,
    n,
  };
}

// Voix d'une banque jam triplet : A=clean / B=crunch / C=lead.
// Mappe le bucket de gain d'une capture vers sa voix.
function captureVoice(gainValue) {
  const range = getGainRange(gainValue); // clean / crunch / drive / high_gain
  if (range === 'clean') return 'A';
  if (range === 'crunch') return 'B';
  return 'C'; // drive + high_gain = lead
}

// computeAmpVersatility(ampModel, styleSongs, ampCaptures, guitars, opts)
// - ampCaptures : entrées catalog {name, amp, gain, style} de CET ampli
// - pour chaque morceau : meilleur jamScore atteignable par les captures
// - gainSpanOK : l'ampli a au moins 1 capture clean + 1 crunch + 1 lead
// - bankFill {A,B,C} : meilleure capture par voix (nom), sur moyenne des
//   jamScores du style (null si voix non couverte)
function computeAmpVersatility(ampModel, styleSongs, ampCaptures, guitars, opts = {}) {
  const k = typeof opts.k === 'number' ? opts.k : 1.5;
  const songs = Array.isArray(styleSongs) ? styleSongs : [];
  const caps = Array.isArray(ampCaptures) ? ampCaptures : [];
  // Meilleur jamScore par morceau (toutes captures de l'ampli confondues).
  const perSong = songs.map((song) => {
    let best = 0;
    for (const cap of caps) {
      const s = jamScore(cap, song, guitars);
      if (s > best) best = s;
    }
    return best;
  });
  const stats = versatilityStats(perSong, k);
  // gainSpan + bankFill : meilleure capture par voix (moyenne sur le style).
  const voiceBest = { A: null, B: null, C: null };
  const voiceScore = { A: -1, B: -1, C: -1 };
  for (const cap of caps) {
    const voice = captureVoice(typeof cap.gain === 'number' ? cap.gain : gainToNumeric(cap.gain));
    let mean = 0;
    if (songs.length) {
      mean = songs.reduce((acc, song) => acc + jamScore(cap, song, guitars), 0) / songs.length;
    } else {
      mean = jamScore(cap, {}, guitars); // pas de morceaux → score contextuel neutre
    }
    if (mean > voiceScore[voice]) { voiceScore[voice] = mean; voiceBest[voice] = cap.name || null; }
  }
  const gainSpanOK = !!(voiceBest.A && voiceBest.B && voiceBest.C);
  return { ampModel, ...stats, gainSpanOK, bankFill: voiceBest };
}

// rankJamAmps(styleId, songs, catalog, ownedSources, opts)
// - candidats = modèles d'amplis distincts du catalog, filtrés par sources
//   possédées (isSourceAvailable, injecté via opts.isSourceAvailable pour
//   garder ce module découplé de core/sources — fallback : tout autorisé)
// - songs filtrés au style demandé (song_style === styleId)
// - tri polyvalence desc, exige gainSpanOK, tiebreak couverture
// - fallback : si AUCUN ampli n'a le span complet, on relâche la contrainte
//   et on flag gainSpanPartial: true sur les résultats (l'UI signalera)
function rankJamAmps(styleId, songs, catalog, ownedSources, opts = {}) {
  const k = typeof opts.k === 'number' ? opts.k : 1.5;
  const guitars = opts.guitars || [];
  const srcOk = typeof opts.isSourceAvailable === 'function'
    ? (src) => opts.isSourceAvailable(src, ownedSources)
    : () => true;
  const cat = catalog || {};
  const styleSongs = (songs || []).filter((s) => {
    const st = s?.aiCache?.result?.song_style || s?.song_style || null;
    return st === styleId;
  });
  // Regroupe les captures par ampli (filtrées par source possédée + amp défini).
  const byAmp = new Map();
  for (const [name, info] of Object.entries(cat)) {
    if (!info || !info.amp) continue;
    if (info.src && !srcOk(info.src)) continue;
    if (!byAmp.has(info.amp)) byAmp.set(info.amp, []);
    byAmp.get(info.amp).push({ name, amp: info.amp, gain: info.gain, style: info.style });
  }
  let ranked = [];
  for (const [ampModel, caps] of byAmp) {
    ranked.push(computeAmpVersatility(ampModel, styleSongs, caps, guitars, { k }));
  }
  const sortFn = (a, b) => (b.polyvalence - a.polyvalence) || (b.couverture - a.couverture) || (b.moyenne - a.moyenne);
  const full = ranked.filter((r) => r.gainSpanOK).sort(sortFn);
  if (full.length) return full;
  // Fallback span partiel : aucun ampli clean→lead complet sur ce style.
  return ranked.sort(sortFn).map((r) => ({ ...r, gainSpanPartial: true }));
}

export { jamScore, versatilityStats, computeAmpVersatility, rankJamAmps, JAM_WEIGHTS, captureVoice };
