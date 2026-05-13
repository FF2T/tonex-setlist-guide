// src/app/utils/preset-helpers.js — Phase 7.14 (découpage main.jsx).
//
// Helpers pour la résolution des presets dans les banks utilisateur.
// Pures, pas de side-effects.
//
// - findInBanks(name, banks) : localise un preset par nom (exact OU
//   fuzzy via normalizePresetName) → {bank, slot} ou null.
// - worstSlot(banks, gType, exclude) : candidat au remplacement
//   (slot dont le preset matche le moins bien gType).
// - findBestAvailable : meilleure alternative dans PRESET_CATALOG_MERGED
//   (filtrée par style compatible, gain proche, sources disponibles).
// - getInstallRec : recommandation install ou upgrade pour un preset.
// - guitarScore / presetScore : wrappers fins sur computeSimpleScore.
//
// COMPAT_STYLES : règle de compatibilité entre styles (blues accepte
// jazz, rock accepte hard_rock, etc.). Utilisé par findBestAvailable.

import {
  PRESET_CATALOG_MERGED, findCatalogEntry, normalizePresetName,
} from '../../core/catalog.js';
import { computeSimpleScore } from '../../core/scoring/index.js';

// Wrappers fins sur le scoring V9 (deux usages courants).
function guitarScore(name, guitarId) { return computeSimpleScore(name, guitarId, null); }
function presetScore(name, gType) { return computeSimpleScore(name, null, gType); }

// Cherche un preset dans les banks d'une pédale (comparaison souple).
function findInBanks(name, banks) {
  if (!name || !banks) return null;
  // Exact match d'abord (rapide).
  for (const [k, bank] of Object.entries(banks)) {
    for (const slot of ['A', 'B', 'C']) {
      if (bank[slot] === name) return { bank: Number(k), slot };
    }
  }
  // Fuzzy match si pas trouvé (T.N.T. = TNT, etc.).
  const norm = normalizePresetName(name);
  for (const [k, bank] of Object.entries(banks)) {
    for (const slot of ['A', 'B', 'C']) {
      if (normalizePresetName(bank[slot]) === norm) return { bank: Number(k), slot };
    }
  }
  return null;
}

// Trouve le slot le moins pertinent pour un type de guitare
// (candidat au remplacement).
function worstSlot(banks, gType, exclude = []) {
  let worst = { score: 101, bank: null, slot: null, name: null };
  for (const [k, bank] of Object.entries(banks)) {
    for (const slot of ['A', 'B', 'C']) {
      const name = bank[slot];
      if (!name || exclude.includes(name)) continue;
      const s = presetScore(name, gType);
      if (s < worst.score) worst = { score: s, bank: Number(k), slot, name };
    }
  }
  return worst;
}

// Compatibilité entre styles pour la suggestion d'alternatives.
const COMPAT_STYLES = {
  blues: ['blues', 'jazz', 'rock'],
  jazz: ['jazz', 'blues'],
  rock: ['rock', 'hard_rock', 'blues'],
  hard_rock: ['hard_rock', 'rock', 'metal'],
  metal: ['metal', 'hard_rock'],
  pop: ['pop', 'rock', 'blues'],
};

// Cherche la meilleure alternative disponible dans le catalogue pour le
// même style musical. Retourne le preset avec le score gType le plus
// élevé du même style (gain ±1 niveau, source disponible).
function findBestAvailable(presetName, gType, banks, availableSources, guitarId) {
  const entry = findCatalogEntry(presetName);
  if (!entry) return null;
  const currentScore = guitarId ? guitarScore(presetName, guitarId) : (entry.scores?.[gType] ?? 60);
  const compatStyles = COMPAT_STYLES[entry.style] || [entry.style];
  const gainOrder = { low: 0, mid: 1, high: 2 };
  const currentGainLevel = gainOrder[entry.gain] ?? 1;

  let best = { score: 0, name: null, installed: false, bank: null, slot: null };
  for (const [name, info] of Object.entries(PRESET_CATALOG_MERGED)) {
    if (!compatStyles.includes(info.style)) continue;
    if (availableSources && availableSources[info.src] === false) continue;
    const gainDiff = Math.abs((gainOrder[info.gain] ?? 1) - currentGainLevel);
    if (gainDiff > 1) continue;
    const s = guitarId ? guitarScore(name, guitarId) : (info.scores?.[gType] ?? 60);
    if (s > best.score || (s === best.score && !best.installed)) {
      const found = findInBanks(name, banks);
      if (s > best.score || (s === best.score && found && !best.installed)) {
        best = { score: s, name, src: info.src, amp: info.amp, installed: !!found, bank: found?.bank ?? null, slot: found?.slot ?? null };
      }
    }
  }
  if (!best.name) return null;
  const isCurrent = best.name === presetName;
  return { ...best, isCurrent, currentScore };
}

// Recommandation d'installation pour un preset donné. Renvoie soit
// {installed:true, bank, slot, upgrade?} soit {installed:false,
// replaceBank, replaceSlot, replaceName, replaceScore}.
function getInstallRec(presetName, gType, banks, guitarId) {
  if (!presetName) return null;
  const score = guitarId ? guitarScore(presetName, guitarId) : presetScore(presetName, gType);
  const found = findInBanks(presetName, banks);
  if (found) {
    const upgrade = findBestAvailable(presetName, gType, banks, null, guitarId);
    return { name: presetName, score, installed: true, bank: found.bank, slot: found.slot, upgrade };
  }
  const ws = worstSlot(banks, gType, [presetName]);
  return { name: presetName, score, installed: false, replaceBank: ws.bank, replaceSlot: ws.slot, replaceName: ws.name, replaceScore: ws.score };
}

export {
  COMPAT_STYLES,
  guitarScore, presetScore,
  findInBanks, worstSlot, findBestAvailable, getInstallRec,
};
