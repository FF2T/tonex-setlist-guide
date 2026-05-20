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

import { getPresetCurationStatus, findCatalogEntry } from './catalog.js';

// Phase 7.78 — sources de presets dont les usages sont éditables au
// runtime depuis l'app (sans modif source code). custom = profile.customPacks
// (Phase 7.69), ToneNET = shared.toneNetPresets (Phase 7.53).
// Les autres sources (TSR/ML/AA/JS/TJ/WT/Galtone/Anniversary/Factory/
// FactoryV1/PlugFactory) sont des catalogs statiques bundlés dans le code
// → édition nécessite Phase 11 (Studio-driven) ou modif source code.
const EDITABLE_SOURCES = new Set(['custom', 'ToneNET']);

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

/**
 * Phase 7.78 — Détecte tous les presets 🟠 non curés dans les banks et
 * retourne pour chaque : {name, src, editable}.
 *
 * editable=true si src ∈ {custom, ToneNET} (édition runtime via UI).
 * editable=false sinon (catalog statique → édition nécessite Phase 11
 * ou modif source code).
 *
 * Dédupliqué par nom, trié alpha. Le first encounter wins pour le src.
 *
 * @param {Object} banks
 * @returns {Array<{name: string, src: string, editable: boolean}>}
 */
function detectAllNonCurated(banks) {
  if (!banks || typeof banks !== 'object') return [];
  const seen = new Map();
  Object.values(banks).forEach((bank) => {
    if (!bank) return;
    ['A', 'B', 'C'].forEach((slot) => {
      const name = bank[slot];
      if (!name || typeof name !== 'string') return;
      if (seen.has(name)) return;
      const status = getPresetCurationStatus(name);
      if (status !== 'known') return;
      const entry = findCatalogEntry(name);
      if (!entry || entry.guessed) return; // sécurité (filtré déjà par status)
      const src = entry.src || '';
      seen.set(name, { name, src, editable: EDITABLE_SOURCES.has(src) });
    });
  });
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Phase 7.79.2 + 7.79.3b — Helper centralisé pour persister les usages
 * d'un preset. Route automatiquement selon entry.src et isAdmin :
 *
 *   1. entry.src === 'custom'           → profile.customPacks[].presets[].usages
 *                                         (stamp profile.lastModified, LWW Firestore)
 *   2. entry.src === 'ToneNET'          → shared.toneNetPresets[].usages
 *                                         (stamp item.lastModified, per-item LWW Phase 7.53.1)
 *   3. catalog statique + isAdmin       → shared.usagesOverrides[name]    (Phase 7.79.3b)
 *                                         niveau 3 cascade — visible tous users
 *   4. catalog statique + !isAdmin      → profile.usagesOverrides[name]   (Phase 7.79.3b)
 *                                         niveau 1 cascade — visible user seul
 *
 * Si usages=undefined, retire le champ usages de l'entry. Pour les niveaux
 * 3 et 4 (cascade), on écrit { usages: null, lastModified } pour signaler
 * un "override vide explicite" qui stoppe la cascade et masque les usages
 * du catalog. Pour DELETE complètement l'override (et reprendre la cascade
 * au niveau suivant), utiliser removeUsagesOverride.
 *
 * @param {string} presetName
 * @param {Array<{artist, songs?}>|undefined} usages
 * @param {Object} ctx
 *   - findEntry:        (name) => entry|null (fourni par caller pour éviter import circulaire)
 *   - activeProfileId:  string
 *   - isAdmin:          boolean (Phase 7.79.3b — décide profile vs shared sur catalog statique)
 *   - onProfiles:       setter
 *   - onToneNetPresets: setter (optionnel pour custom-only)
 *   - onShared:         setter shared (Phase 7.79.3b — pour shared.usagesOverrides)
 */
function saveUsagesForPreset(presetName, usages, ctx) {
  if (!presetName || !ctx) return;
  const { findEntry, activeProfileId, isAdmin, onProfiles, onToneNetPresets, onShared } = ctx;
  const entry = typeof findEntry === 'function' ? findEntry(presetName) : null;
  if (!entry || entry.guessed) return;

  if (entry.src === 'custom' && typeof onProfiles === 'function' && activeProfileId) {
    onProfiles((p) => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      const packs = (cur.customPacks || []).map((pack) => ({
        ...pack,
        presets: (pack.presets || []).map((pr) => {
          if (pr.name !== presetName) return pr;
          if (!usages) {
            const { usages: _, ...rest } = pr;
            return rest;
          }
          return { ...pr, usages };
        }),
      }));
      return { ...p, [activeProfileId]: { ...cur, customPacks: packs, lastModified: Date.now() } };
    });
    return;
  }

  if (entry.src === 'ToneNET' && typeof onToneNetPresets === 'function') {
    onToneNetPresets((prev) => (prev || []).map((tp) => {
      if (tp.name !== presetName) return tp;
      const stamped = { ...tp, lastModified: Date.now() };
      if (!usages) {
        const { usages: _, ...rest } = stamped;
        return rest;
      }
      return { ...stamped, usages };
    }));
    return;
  }

  // Phase 7.79.3b — catalog statique (TSR/AA/JS/TJ/WT/Galtone/ML/Anniversary/
  // Factory/FactoryV1/PlugFactory). Route vers le bon niveau de cascade :
  //   - isAdmin → shared.usagesOverrides (niveau 3, visible tous users)
  //   - !isAdmin → profile.usagesOverrides (niveau 1, visible user seul)
  const stampedEntry = {
    usages: usages || null, // null = override vide explicite (stop cascade)
    lastModified: Date.now(),
  };
  if (isAdmin && typeof onShared === 'function') {
    onShared((sh) => {
      const map = { ...(sh?.usagesOverrides || {}) };
      map[presetName] = stampedEntry;
      return { ...sh, usagesOverrides: map, lastModified: Date.now() };
    });
  } else if (!isAdmin && typeof onProfiles === 'function' && activeProfileId) {
    onProfiles((p) => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      const map = { ...(cur.usagesOverrides || {}) };
      map[presetName] = stampedEntry;
      return { ...p, [activeProfileId]: { ...cur, usagesOverrides: map, lastModified: Date.now() } };
    });
  }
  // Sinon (admin sans onShared, ou non-admin sans onProfiles) : no-op silencieux.
}

/**
 * Phase 7.79.3b — Retire complètement un override d'usages d'un preset
 * catalog statique. Différent de saveUsagesForPreset(name, undefined) qui
 * écrit { usages: null } (= "override vide explicite"). Ici on DELETE
 * l'entry de la map → la cascade reprend au niveau suivant.
 *
 * Routing similaire à saveUsagesForPreset :
 *   - isAdmin  → delete shared.usagesOverrides[name]
 *   - !isAdmin → delete profile.usagesOverrides[name]
 *
 * No-op si l'entry source est custom/ToneNET (pas de cascade pour ces
 * sources, leur "usages" est dans la donnée elle-même).
 *
 * @param {string} presetName
 * @param {Object} ctx — même shape que saveUsagesForPreset
 */
function removeUsagesOverride(presetName, ctx) {
  if (!presetName || !ctx) return;
  const { findEntry, activeProfileId, isAdmin, onProfiles, onShared } = ctx;
  const entry = typeof findEntry === 'function' ? findEntry(presetName) : null;
  if (!entry || entry.guessed) return;
  if (entry.src === 'custom' || entry.src === 'ToneNET') return; // pas concerné par la cascade

  if (isAdmin && typeof onShared === 'function') {
    onShared((sh) => {
      const map = { ...(sh?.usagesOverrides || {}) };
      if (!(presetName in map)) return sh; // no-op si pas d'override
      delete map[presetName];
      return { ...sh, usagesOverrides: map, lastModified: Date.now() };
    });
  } else if (!isAdmin && typeof onProfiles === 'function' && activeProfileId) {
    onProfiles((p) => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      const map = { ...(cur.usagesOverrides || {}) };
      if (!(presetName in map)) return p; // no-op si pas d'override
      delete map[presetName];
      return { ...p, [activeProfileId]: { ...cur, usagesOverrides: map, lastModified: Date.now() } };
    });
  }
}

export {
  detectPresetsByStatus,
  detectUnknownsInBanks,
  detectNonCuratedInBanks,
  detectAllNonCurated,
  EDITABLE_SOURCES,
  applyResolutionsToBanks,
  saveUsagesForPreset,
  removeUsagesOverride,
};
