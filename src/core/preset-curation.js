// src/core/preset-curation.js — Phase 7.77.
//
// Helpers purs pour la résolution de presets non curés dans les banks
// installées (banksAnn, banksPlug). Réutilise getPresetCurationStatus
// du module catalog.
//
// Sémantique des 4 catégories (cf catalog.js):
//   - 'unknown'        🔴 wine    : fallback guessPresetInfo, pas dans catalog
//   - 'known'          🟠 brass   : catalog OK mais pas d'usages
//   - 'curated-perso'  🔵 cyan    : custom/ToneNET avec usages
//   - 'curated-admin'  🔵 bleu    : catalog statique avec usages
//
// Phase 7.77 cible 'unknown' (résolution user). Phase 7.78 cible 'known'
// éditables (résolution admin).

import { getPresetCurationStatus } from './catalog.js';

/**
 * Scanne un objet banks {[bank]: {A,B,C,cat?}} et retourne la liste des
 * noms de presets dont le status de curation matche un set donné.
 * Dédupliqué + trié alpha.
 *
 * @param {Object} banks — { [bankNum]: { A, B, C, cat? } }
 * @param {Set<string>|string[]} statuses — statuses à matcher (ex: ['unknown'])
 * @returns {string[]}
 */
function detectPresetsByStatus(banks, statuses) {
  if (!banks || typeof banks !== 'object') return [];
  const statusSet = statuses instanceof Set ? statuses : new Set(statuses);
  const seen = new Set();
  Object.values(banks).forEach((bank) => {
    if (!bank) return;
    ['A', 'B', 'C'].forEach((slot) => {
      const name = bank[slot];
      if (!name || typeof name !== 'string') return;
      const status = getPresetCurationStatus(name);
      if (status && statusSet.has(status)) seen.add(name);
    });
  });
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/**
 * Détecte tous les presets 🔴 inconnus (status='unknown') dans des banks.
 * Phase 7.77 — résolution côté user.
 */
function detectUnknownsInBanks(banks) {
  return detectPresetsByStatus(banks, ['unknown']);
}

/**
 * Détecte tous les presets 🟠 connus non curés (status='known') dans des banks.
 * Phase 7.78 — curation côté admin.
 */
function detectNonCuratedInBanks(banks) {
  return detectPresetsByStatus(banks, ['known']);
}

/**
 * Applique des résolutions à un objet banks (immutable).
 *
 * @param {Object} banks — { [bankNum]: { A, B, C, cat? } }
 * @param {Object} resolutions — { [presetName]: { action, target? } }
 *   action: 'remap' (target requis), 'clear', 'skip' (no-op)
 * @returns {Object} nouveau banks (référence change si au moins un slot change)
 */
function applyResolutionsToBanks(banks, resolutions) {
  if (!banks || typeof banks !== 'object') return banks;
  if (!resolutions || typeof resolutions !== 'object') return banks;
  let changed = false;
  const next = {};
  Object.entries(banks).forEach(([bankNum, bank]) => {
    if (!bank) { next[bankNum] = bank; return; }
    const nextBank = { ...bank };
    let bankChanged = false;
    ['A', 'B', 'C'].forEach((slot) => {
      const name = nextBank[slot];
      if (!name || typeof name !== 'string') return;
      const res = resolutions[name];
      if (!res || !res.action || res.action === 'skip') return;
      if (res.action === 'clear') {
        nextBank[slot] = '';
        bankChanged = true;
      } else if (res.action === 'remap' && res.target) {
        nextBank[slot] = String(res.target);
        bankChanged = true;
      }
    });
    next[bankNum] = bankChanged ? nextBank : bank;
    if (bankChanged) changed = true;
  });
  return changed ? next : banks;
}

export {
  detectPresetsByStatus,
  detectUnknownsInBanks,
  detectNonCuratedInBanks,
  applyResolutionsToBanks,
};
