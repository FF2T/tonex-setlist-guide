// src/app/utils/ai-helpers.js — Phase 7.14 (découpage main.jsx).
//
// Helpers de scoring/preset autour des résultats AI :
// - resolveRefAmp : normalise un nom d'ampli libre (artiste) vers un nom
//   canonique du catalogue via AMP_ALIASES (~50 alias).
// - computeBestPresets : pour une guitare + style + ref_amp, calcule les
//   meilleurs presets installés dans les banks user + les meilleurs du
//   catalogue (top 6 amp-diversifié, top 1 idéal).
// - enrichAIResult : applique computeBestPresets sur un résultat AI brut
//   et merge avec son contenu existant (never regress).
// - mergeBestResults / bestScoreOf : merge "garde le meilleur" sur deux
//   versions d'un résultat AI (par dimension preset_ann / preset_plug /
//   ideal_preset). Utilisé pour le batch refetch.
// - preserveHistorical : merge qui préserve les faits historiques
//   (ref_guitarist, ref_amp, song_year, etc.) entre versions.
// - updateAiCache / getBestResult : couche cache par-(songId, gId) avec
//   mémoire du meilleur résultat par guitare.
// - computeRigSnapshot : signature stable des ids du rig au moment de
//   l'analyse (utilisée pour la détection de cache stale).
// - safeParseJSON : parseur robuste aux JSON tronqués (gestion
//   d'accolades manquantes en fin de réponse pour maxOutputTokens).
//
// Pas de side-effects. AMP_ALIASES est figé.

import { findCatalogEntry, PRESET_CATALOG_MERGED } from '../../core/catalog.js';
import { AMP_TAXONOMY } from '../../data/data_context.js';
import {
  SCORING_VERSION,
  computeFinalScore, computePickupScore, computeGainMatchScore,
  computeStyleMatchScore, computeRefAmpScore,
  getGainRange, gainToNumeric,
} from '../../core/scoring/index.js';

// Amp aliases : maps des ref_amp libres vers les noms canoniques du
// catalogue. Liste non exhaustive (couvre les amps les plus cités par
// les guitaristes blues/rock 70s).
const AMP_ALIASES = {
  // Marshall
  'marshall super lead': 'Marshall SL800',
  'marshall super lead 100': 'Marshall SL800',
  'marshall plexi': 'Marshall SL800',
  'marshall 1959': 'Marshall SL800',
  'plexi': 'Marshall Plexi',
  'marshall jcm800': 'Marshall JCM800',
  'marshall jcm 800': 'Marshall JCM800',
  'jcm800': 'Marshall JCM800',
  'jcm 800': 'Marshall JCM800',
  'marshall jcm900': 'Marshall JCM900',
  'marshall jcm 900': 'Marshall JCM900',
  'jcm900': 'Marshall JCM900',
  'jcm 900': 'Marshall JCM900',
  'marshall jtm45': 'Marshall JTM45',
  'marshall jtm 45': 'Marshall JTM45',
  'marshall jtm': 'Marshall JTM45',
  'jtm45': 'Marshall JTM45',
  'jtm 45': 'Marshall JTM45',
  'marshall sl800': 'Marshall SL800',
  'marshall slt60': 'Marshall SLT60',
  // Fender
  'fender twin reverb': 'Fender Twin Silverface',
  'fender twin': 'Fender Twin Silverface',
  'fender twin silverface': 'Fender Twin Silverface',
  'fender blackface twin': 'Fender Twin Silverface',
  'fender deluxe reverb': 'Fender Deluxe Reverb',
  'fender deluxe': 'Fender Deluxe',
  'fender bassman': 'Fender Tweed Bassman',
  'fender tweed bassman': 'Fender Tweed Bassman',
  'fender super reverb': 'Fender Twin Silverface',
  'fender super': 'Fender Twin Silverface',
  'fender champ': 'Fender Champ',
  'fender concert': 'Fender Concert',
  'fender 5e3': 'Fender Deluxe',
  // Vox
  'vox ac30': 'Vox AC30',
  'vox ac 30': 'Vox AC30',
  'vox ac30tb': 'Vox AC30',
  // Mesa
  'mesa boogie dual rectifier': 'Mesa Boogie Rectifier',
  'mesa dual rectifier': 'Mesa Boogie Rectifier',
  'mesa rectifier': 'Mesa Rectifier',
  'mesa boogie rectifier': 'Mesa Boogie Rectifier',
  'mesa boogie mark': 'Mesa Mark IV',
  'mesa mark iv': 'Mesa Mark IV',
  'mesa mark iic': 'Mesa Mark IIC+',
  'mesa mark 4': 'Mesa Mark IV',
  // Orange
  'orange or120': 'Orange Rockerverb',
  'orange rockerverb': 'Orange Rockerverb',
  // Friedman
  'friedman be-100': 'Friedman BE-100',
  'friedman be100': 'Friedman BE-100',
  'friedman be 100': 'Friedman BE-100',
  'friedman hbe': 'Friedman HBE',
  // Bogner
  'bogner ecstasy': 'Bogner Ecstasy',
  'bogner shiva': 'Bogner Ecstasy',
  // Dumble
  'dumble overdrive special': 'Dumble ODS',
  'dumble ods': 'Dumble ODS',
  'dumble': 'Dumble Deluxe',
  // Divers
  'two rock': 'Two Rock Stevie G',
  'peavey 5150': 'Peavey 5150',
  'peavey evh': 'Peavey 5150',
  'evh 5150': 'Peavey 5150',
  'hiwatt dr103': 'Hiwatt HG100',
  'hiwatt custom 100': 'Hiwatt HG100',
  'hiwatt': 'Hiwatt HG100',
  'soldano slo': 'Soldano SLO-100',
  'soldano slo-100': 'Soldano SLO-100',
  'soldano slo 100': 'Soldano SLO-100',
  'matchless dc30': 'Matchless DC30',
  'matchless dc 30': 'Matchless DC30',
  'roland jc-120': 'Roland JC-120',
  'roland jc120': 'Roland JC-120',
  'roland jazz chorus': 'Roland JC-120',
  // Laney
  'laney supergroup': 'Laney Supergroup',
  'laney super group': 'Laney Supergroup',
  'laney sg': 'Laney Supergroup',
  'laney aor': 'Laney AOR',
  'laney gh100': 'Laney GH100L',
  'laney gh': 'Laney GH100L',
  'laney vh100': 'Laney VH100',
  'laney vh': 'Laney VH100',
  'laney vc50': 'Laney VC50',
  'laney vc30': 'Laney VC30',
  'laney vc': 'Laney VC50',
  'laney lionheart': 'Laney Lionheart',
  'laney lion': 'Laney Lionheart',
  'laney irt': 'Laney IRT',
  'laney': 'Laney',
};

// Résout un ref_amp texte vers un nom canonique du catalogue.
function resolveRefAmp(refAmp) {
  if (!refAmp) return null;
  const refNorm = refAmp.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  for (const [alias, canonical] of Object.entries(AMP_ALIASES)) {
    if (refNorm.includes(alias)) return canonical;
  }
  if (AMP_TAXONOMY[refAmp]) return refAmp;
  return refAmp;
}

function computeBestPresets(gType, style, banksAnn, banksPlug, guitarId, refAmp, targetGain, availableSources) {
  // Fallback : si l'appelant n'a pas passé availableSources, on lit la config
  // active publiée par App() — évite de threader le param dans toute l'app.
  if (availableSources === undefined && typeof window !== 'undefined') availableSources = window.__activeSources;
  const resolvedAmp = resolveRefAmp(refAmp);
  const songTargetGain = targetGain != null ? targetGain : null;
  const scorePreset = (name, info, withBreakdown) => {
    if (!guitarId) {
      // Sans guitare : utiliser le contexte morceau avec pickup statique.
      const presetGain = typeof info.gain === 'number' ? info.gain : gainToNumeric(info.gain);
      const presetGainRange = getGainRange(presetGain);
      const pickupScore = computePickupScore(info.style, presetGainRange, gType);
      const gainMatchScore = computeGainMatchScore(presetGain, songTargetGain);
      const refAmpScore = computeRefAmpScore(info.amp, resolvedAmp);
      const styleScore = computeStyleMatchScore(info.style, style);
      const dims = [
        { key: 'pickup', score: pickupScore, weight: 0.25 },
        { key: 'gainMatch', score: gainMatchScore, weight: 0.20 },
        { key: 'refAmp', score: refAmpScore, weight: 0.30 },
        { key: 'styleMatch', score: styleScore, weight: 0.25 },
      ];
      const active = dims.filter((d) => d.score !== null);
      const totalWeight = active.reduce((s, d) => s + d.weight, 0);
      let final = 0;
      const breakdown = {};
      for (const d of active) {
        const ew = d.weight / totalWeight;
        final += ew * d.score;
        breakdown[d.key] = { raw: d.score, weight: Math.round(ew * 100), contribution: Math.round(ew * d.score) };
      }
      const s = Math.max(0, Math.min(100, Math.round(final)));
      return withBreakdown ? { score: s, breakdown } : s;
    }
    return computeFinalScore(info, guitarId, style, songTargetGain, resolvedAmp, withBreakdown);
  };
  const annPresets = [];
  for (const [k, v] of Object.entries(banksAnn)) {
    for (const c of ['A', 'B', 'C']) {
      if (v[c]) {
        const info = findCatalogEntry(v[c]);
        if (info) {
          const score = scorePreset(v[c], info);
          annPresets.push({ name: v[c], bank: Number(k), col: c, score, rawScore: score, amp: info.amp, style: info.style });
        }
      }
    }
  }
  annPresets.sort((a, b) => b.score - a.score);
  const plugPresets = [];
  for (const [k, v] of Object.entries(banksPlug)) {
    for (const c of ['A', 'B', 'C']) {
      if (v[c]) {
        const info = findCatalogEntry(v[c]);
        if (info) {
          const score = scorePreset(v[c], info);
          plugPresets.push({ name: v[c], bank: Number(k), col: c, score, rawScore: score, amp: info.amp, style: info.style });
        }
      }
    }
  }
  plugPresets.sort((a, b) => b.score - a.score);
  // Best from full catalog — diversify amps (no 2 presets from same amp).
  const catalogAll = Object.entries(PRESET_CATALOG_MERGED)
    .filter(([, info]) => !availableSources || !info?.src || availableSources[info.src] !== false)
    .map(([name, info]) => {
      const score = scorePreset(name, info);
      return { name, score, rawScore: score, amp: info.amp, style: info.style, src: info.src };
    })
    .sort((a, b) => b.score - a.score);
  const catalogBest = [];
  const seenAmps = new Set();
  for (const p of catalogAll) {
    if (!seenAmps.has(p.amp)) { catalogBest.push(p); seenAmps.add(p.amp); }
    if (catalogBest.length >= 6) break;
  }
  const addBreakdown = (p) => {
    if (!p) return p;
    const info = findCatalogEntry(p.name);
    if (!info) return p;
    const r = scorePreset(p.name, info, true);
    return { ...p, score: r.score != null ? r.score : p.score, breakdown: r.breakdown || null };
  };
  return {
    annTop: addBreakdown(annPresets[0]) || null,
    plugTop: addBreakdown(plugPresets[0]) || null,
    idealTop: catalogBest[0] || null,
    idealTop3: catalogBest,
  };
}

// Phase 7.31 — Cherche un slot bank par nom exact (case-insensitive),
// retourne {bank, col, label} ou null. Permet à enrichAIResult d'honorer
// preset_ann_name / preset_plug_name retournés par l'IA.
function findSlotByName(banks, name) {
  if (!banks || !name) return null;
  const target = String(name).trim().toLowerCase();
  for (const [k, v] of Object.entries(banks)) {
    for (const c of ['A', 'B', 'C']) {
      if (v?.[c] && String(v[c]).trim().toLowerCase() === target) {
        return { bank: Number(k), col: c, label: v[c] };
      }
    }
  }
  return null;
}

// Phase 7.52.5 — Cherche le meilleur slot avec usages-match (artiste +
// titre du morceau analysé). Retourne {bank, col, label, score} où :
//  - score 100 : usages.artist === song.artist ET usages.songs contient
//    song.title (match parfait)
//  - score 50  : usages.artist === song.artist seul (match artiste, titre
//    absent ou pas dans liste)
// Permet à enrichAIResult de FORCER la PRIORITÉ 1 du prompt Phase 7.34 +
// 7.52.1 même quand Gemini Flash ne la respecte pas (cas observé sur
// Cream White Room / Sunshine of Your Love → AA MRSH SB100 ignoré au
// profit de Vox AC30 / Friedman BE-100 alors que SB100 a usages explicit
// Cream + ces deux titres).
function findSlotByUsageMatch(banks, songArtist, songTitle) {
  if (!banks || (!songArtist && !songTitle)) return null;
  const artistLc = String(songArtist || '').toLowerCase();
  const titleLc = String(songTitle || '').toLowerCase();
  let bestMatch = null;
  for (const [k, v] of Object.entries(banks)) {
    for (const c of ['A', 'B', 'C']) {
      if (!v?.[c]) continue;
      const info = findCatalogEntry(v[c]);
      if (!info?.usages || !Array.isArray(info.usages)) continue;
      for (const u of info.usages) {
        if (!u?.artist) continue;
        const matchArtist = u.artist.toLowerCase() === artistLc;
        const matchTitle = Array.isArray(u.songs)
          && u.songs.some((s) => String(s).toLowerCase() === titleLc);
        let score = 0;
        if (matchArtist && matchTitle) score = 100;
        else if (matchArtist) score = 50;
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { bank: Number(k), col: c, label: v[c], score };
        }
      }
    }
  }
  return bestMatch;
}

function enrichAIResult(aiResult, gType, gId, banksAnn, banksPlug, availableSources, song) {
  if (availableSources === undefined && typeof window !== 'undefined') availableSources = window.__activeSources;
  const style = aiResult.song_style || 'rock';
  const targetGain = typeof aiResult.target_gain === 'number' ? aiResult.target_gain : null;
  const best = computeBestPresets(gType, style, banksAnn, banksPlug, gId, aiResult.ref_amp, targetGain, availableSources);
  // Phase 7.31 — Si l'IA a nommé une capture installée précise via
  // preset_ann_name / preset_plug_name (Étape 6 du prompt), on lui fait
  // confiance et on bypass le scoring V9 pour cette dimension. Le scoring
  // V9 (computeBestPresets ci-dessus) sert toujours de fallback si l'IA
  // n'a pas nommé de slot (ou si son nom n'existe pas dans les banks).
  // Les flags ci-dessous protègent ce choix contre le "never regress" plus
  // bas qui sinon écraserait le slot nommé par un slot V9 mieux scoré.
  let annPinnedByAI = false;
  let plugPinnedByAI = false;
  const aiAnnName = aiResult.preset_ann_name;
  if (aiAnnName) {
    const slot = findSlotByName(banksAnn, aiAnnName);
    if (slot) {
      // Récupère le score V9 du slot nommé pour cohérence d'affichage
      const info = findCatalogEntry(slot.label);
      let scoreObj = null;
      if (info) {
        const dims = [
          { key: 'pickup', score: computePickupScore(info.style, getGainRange(typeof info.gain === 'number' ? info.gain : gainToNumeric(info.gain)), gType), weight: 0.25 },
          { key: 'gainMatch', score: computeGainMatchScore(typeof info.gain === 'number' ? info.gain : gainToNumeric(info.gain), targetGain), weight: 0.20 },
          { key: 'refAmp', score: computeRefAmpScore(info.amp, aiResult.ref_amp), weight: 0.30 },
          { key: 'styleMatch', score: computeStyleMatchScore(info.style, style), weight: 0.25 },
        ];
        const active = dims.filter((d) => d.score !== null);
        const totalWeight = active.reduce((s, d) => s + d.weight, 0);
        let final = 0; const breakdown = {};
        for (const d of active) {
          const ew = d.weight / totalWeight;
          final += ew * d.score;
          breakdown[d.key] = { raw: d.score, weight: Math.round(ew * 100), contribution: Math.round(ew * d.score) };
        }
        const v9Score = Math.max(0, Math.min(100, Math.round(final)));
        // Boost de confiance : nommé par l'IA → score min 90, sinon V9
        scoreObj = { score: Math.max(90, v9Score), breakdown };
      }
      aiResult.preset_ann = { bank: slot.bank, col: slot.col, label: slot.label, score: scoreObj?.score || 90, breakdown: scoreObj?.breakdown || null };
      annPinnedByAI = true;
    }
  }
  const aiPlugName = aiResult.preset_plug_name;
  if (aiPlugName) {
    const slot = findSlotByName(banksPlug, aiPlugName);
    if (slot) {
      const info = findCatalogEntry(slot.label);
      let scoreObj = null;
      if (info) {
        const dims = [
          { key: 'pickup', score: computePickupScore(info.style, getGainRange(typeof info.gain === 'number' ? info.gain : gainToNumeric(info.gain)), gType), weight: 0.25 },
          { key: 'gainMatch', score: computeGainMatchScore(typeof info.gain === 'number' ? info.gain : gainToNumeric(info.gain), targetGain), weight: 0.20 },
          { key: 'refAmp', score: computeRefAmpScore(info.amp, aiResult.ref_amp), weight: 0.30 },
          { key: 'styleMatch', score: computeStyleMatchScore(info.style, style), weight: 0.25 },
        ];
        const active = dims.filter((d) => d.score !== null);
        const totalWeight = active.reduce((s, d) => s + d.weight, 0);
        let final = 0; const breakdown = {};
        for (const d of active) {
          const ew = d.weight / totalWeight;
          final += ew * d.score;
          breakdown[d.key] = { raw: d.score, weight: Math.round(ew * 100), contribution: Math.round(ew * d.score) };
        }
        const v9Score = Math.max(0, Math.min(100, Math.round(final)));
        scoreObj = { score: Math.max(90, v9Score), breakdown };
      }
      aiResult.preset_plug = { bank: slot.bank, col: slot.col, label: slot.label, score: scoreObj?.score || 90, breakdown: scoreObj?.breakdown || null };
      plugPinnedByAI = true;
    }
  }
  // Phase 7.52.5 — Override usage-match TITRE EXACT (PRIORITÉ 1 prompt).
  // Si un slot des banks a usages.artist === song.artist ET usages.songs
  // contient song.title, il gagne TOUJOURS sur le pin IA (Gemini ne
  // respecte pas systématiquement la PRIORITÉ 1 du prompt Phase 7.34 +
  // 7.52.1). Match TITRE EXACT seulement — un match artiste seul (score
  // 50) ne sert que de fallback si l'IA n'a pas pin (annPinnedByAI = false).
  const songArtist = song?.artist || aiResult.ref_artist || aiResult.song_artist;
  const songTitle = song?.title || aiResult.song_title;
  if (songArtist || songTitle) {
    const annUsage = findSlotByUsageMatch(banksAnn, songArtist, songTitle);
    if (annUsage && (annUsage.score === 100 || !annPinnedByAI)) {
      aiResult.preset_ann = { bank: annUsage.bank, col: annUsage.col, label: annUsage.label, score: 92, breakdown: null };
      annPinnedByAI = true;
    }
    const plugUsage = findSlotByUsageMatch(banksPlug, songArtist, songTitle);
    if (plugUsage && (plugUsage.score === 100 || !plugPinnedByAI)) {
      aiResult.preset_plug = { bank: plugUsage.bank, col: plugUsage.col, label: plugUsage.label, score: 92, breakdown: null };
      plugPinnedByAI = true;
    }
  }
  // Si l'IA a proposé un ideal_preset depuis un pack non possédé → reset.
  if (availableSources && aiResult.ideal_preset) {
    const e = findCatalogEntry(aiResult.ideal_preset);
    if (e?.src && availableSources[e.src] === false) {
      aiResult.ideal_preset = null; aiResult.ideal_preset_score = 0;
    }
  }
  if (availableSources && aiResult.ideal_top3?.length) {
    aiResult.ideal_top3 = aiResult.ideal_top3.filter((p) => {
      const e = findCatalogEntry(p.name);
      return !e?.src || availableSources[e.src] !== false;
    });
    if (!aiResult.ideal_top3.length) aiResult.ideal_top3 = null;
  }
  if (availableSources && aiResult.preset_ann) {
    const e = findCatalogEntry(aiResult.preset_ann.label);
    if (e?.src && availableSources[e.src] === false) aiResult.preset_ann = null;
  }
  if (availableSources && aiResult.preset_plug) {
    const e = findCatalogEntry(aiResult.preset_plug.label);
    if (e?.src && availableSources[e.src] === false) aiResult.preset_plug = null;
  }
  // Never regress: keep the better of old vs new for each dimension.
  // Phase 7.31 — Si l'IA a explicitement nommé un slot via preset_ann_name /
  // preset_plug_name (et que ce slot existe), on respecte son choix même si
  // le V9 best.annTop scorait mieux : l'IA a vu la liste des captures et a
  // sciemment préféré "Blink-182 Mesa Boggie" pour un morceau Blink-182 même
  // si "ACDC - Marshall" scorait plus haut par compatibilité d'ampli.
  if (best.annTop && !annPinnedByAI) {
    const newAnn = { bank: best.annTop.bank, col: best.annTop.col, label: best.annTop.name, score: best.annTop.score, breakdown: best.annTop.breakdown || null };
    if (!aiResult.preset_ann || newAnn.score >= (aiResult.preset_ann.score || 0)) aiResult.preset_ann = newAnn;
  }
  if (best.plugTop && !plugPinnedByAI) {
    const newPlug = { bank: best.plugTop.bank, col: best.plugTop.col, label: best.plugTop.name, score: best.plugTop.score, breakdown: best.plugTop.breakdown || null };
    if (!aiResult.preset_plug || newPlug.score >= (aiResult.preset_plug.score || 0)) aiResult.preset_plug = newPlug;
  }
  if (best.idealTop) {
    if (!aiResult.ideal_preset || best.idealTop.score >= (aiResult.ideal_preset_score || 0)) {
      aiResult.ideal_preset = best.idealTop.name; aiResult.ideal_preset_score = best.idealTop.score;
    }
  }
  if (best.idealTop3?.length && (!aiResult.ideal_top3?.length || best.idealTop3[0]?.score >= (aiResult.ideal_top3[0]?.score || 0))) {
    aiResult.ideal_top3 = best.idealTop3;
  }
  return aiResult;
}

function bestScoreOf(r) {
  return Math.max(r.preset_ann?.score || 0, r.preset_plug?.score || 0, r.ideal_preset_score || 0);
}

// Fusionne deux résultats en gardant le meilleur score pour CHAQUE dimension.
function mergeBestResults(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  const merged = { ...next };
  if (prev.preset_ann?.score > 0 && (!merged.preset_ann || prev.preset_ann.score > (merged.preset_ann.score || 0))) {
    merged.preset_ann = prev.preset_ann;
  }
  if (prev.preset_plug?.score > 0 && (!merged.preset_plug || prev.preset_plug.score > (merged.preset_plug.score || 0))) {
    merged.preset_plug = prev.preset_plug;
  }
  if ((prev.ideal_preset_score || 0) > (merged.ideal_preset_score || 0)) {
    merged.ideal_preset = prev.ideal_preset;
    merged.ideal_preset_score = prev.ideal_preset_score;
  }
  if (prev.ideal_top3?.length && (!merged.ideal_top3?.length || prev.ideal_top3[0]?.score > merged.ideal_top3[0]?.score)) {
    merged.ideal_top3 = prev.ideal_top3;
  }
  return merged;
}

// Préserve les faits historiques (matériel original de l'artiste, infos
// morceau) — une optimisation ne doit JAMAIS réécrire ces faits, seulement
// la recommandation.
const HISTORICAL_FIELDS = ['ref_guitarist', 'ref_guitar', 'ref_amp', 'ref_effects', 'song_year', 'song_album', 'song_desc', 'song_key', 'song_bpm'];

function preserveHistorical(prev, next) {
  if (!prev) return next;
  const merged = { ...next };
  for (const k of HISTORICAL_FIELDS) {
    if (prev[k] != null && prev[k] !== '') merged[k] = prev[k];
  }
  return merged;
}

// Phase 5.10.2 — signature stable des ids du rig au moment de l'analyse.
function computeRigSnapshot(guitars) {
  if (!Array.isArray(guitars) || !guitars.length) return '';
  return guitars.map((g) => g.id).sort().join('|');
}

function updateAiCache(existing, gId, newResult, opts) {
  const prevResult = existing?.result;
  const merged = preserveHistorical(prevResult, newResult);
  const prevBest = existing?.bestByGuitar?.[gId];
  const best = mergeBestResults(prevBest, merged);
  const bestByGuitar = { ...(existing?.bestByGuitar || {}), [gId]: best };
  const rigSnapshot = opts && opts.rigSnapshot != null ? opts.rigSnapshot : existing?.rigSnapshot;
  return { gId, result: merged, sv: SCORING_VERSION, bestByGuitar, rigSnapshot };
}

function getBestResult(song, gId, fallback) {
  const cached = song.aiCache?.bestByGuitar?.[gId];
  return mergeBestResults(cached, fallback);
}

// Parseur JSON robuste — gère les réponses tronquées par maxOutputTokens.
// Phase 7.39 — Option D trilingue. Helper qui retourne un texte localisé
// depuis un champ aiCache. Trois formes acceptées :
// - string  : ancien format (legacy aiCache pré-Phase 7.39) → retourne tel quel
//             quelle que soit la locale demandée (le user verra du FR).
// - {fr, en, es} : nouveau format trilingue → pioche locale, fallback fr → en →
//             es → '' selon disponibilité.
// - null/undefined : retourne ''.
//
// Robuste si l'IA renvoie partiellement (ex: {fr: "...", en: ""}). Si la
// locale demandée n'a pas de valeur exploitable, on cascade sur les
// autres langues disponibles plutôt que de retourner vide.
function getLocalizedText(value, locale) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  const order = [locale || 'fr', 'fr', 'en', 'es'];
  for (const loc of order) {
    const v = value[loc];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

function safeParseJSON(t) {
  let s = t.replace(/```json|```/g, '').trim();
  try { return JSON.parse(s); } catch (e) {
    let fixed = s, inStr = false, esc = false, opens = [];
    for (let i = 0; i < fixed.length; i++) {
      const c = fixed[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{' || c === '[') opens.push(c);
      if (c === '}' || c === ']') opens.pop();
    }
    if (inStr) fixed += '"';
    while (opens.length) { const o = opens.pop(); fixed += o === '{' ? '}' : ']'; }
    return JSON.parse(fixed);
  }
}

export {
  AMP_ALIASES,
  resolveRefAmp,
  computeBestPresets,
  enrichAIResult,
  findSlotByName,
  findSlotByUsageMatch,
  mergeBestResults,
  bestScoreOf,
  preserveHistorical,
  HISTORICAL_FIELDS,
  computeRigSnapshot,
  updateAiCache,
  getBestResult,
  safeParseJSON,
  getLocalizedText,
};
