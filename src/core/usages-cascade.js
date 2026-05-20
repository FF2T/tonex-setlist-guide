// src/core/usages-cascade.js — Phase 7.79.3 (2026-05-20).
//
// Cascade de résolution des usages d'un preset avec 4 niveaux de priorité :
//
//   1. profile.usagesOverrides[name]     ← user perso (priorité max)
//   2. shared.studioUsages[name]         ← studio partenaire (Phase 11)
//   3. shared.usagesOverrides[name]      ← Backline admin runtime
//   4. catalog.entry.usages              ← default (code source, bundled)
//
// Pour chaque niveau, la valeur peut être :
//   - undefined / map[name] absent → passe au niveau suivant
//   - { usages: null }            → "override vide explicite" — STOP la cascade,
//                                    retourne null (l'user a explicitement
//                                    retiré les usages du niveau supérieur)
//   - { usages: [...] }           → cette liste gagne, STOP la cascade
//
// Conséquence importante : un override "vide explicite" (usages: null) au
// niveau profile écrase un usages: [...] au niveau studio/backline/catalog.
// C'est intentionnel — l'user a le dernier mot sur ce qu'il veut voir.
//
// Pas de bump SCORING_VERSION (cascade purement display + prompt-side).
// Conçu pour préparer Phase 11 (Studio-driven) qui n'utilise pas encore
// shared.studioUsages mais a son slot dans la cascade.

/**
 * Lookup defensive dans une map d'overrides.
 * @param {Object|undefined} map — { [name]: { usages, lastModified, ... } }
 * @param {string} name
 * @returns {Object|undefined} l'entry brut ou undefined
 */
function getUsageOverride(map, name) {
  if (!map || typeof map !== 'object' || !name || typeof name !== 'string') {
    return undefined;
  }
  return map[name];
}

/**
 * Résout les usages d'un preset via la cascade 4 niveaux.
 *
 * @param {string} presetName
 * @param {Object} state
 *   - profileOv:  {[name]: {usages, lastModified}}  niveau 1 (user)
 *   - studioOv:   {[name]: {usages, lastModified, curatedBy}}  niveau 2 (studio, Phase 11)
 *   - backlineOv: {[name]: {usages, lastModified}}  niveau 3 (admin runtime)
 *   - catalogEntry: l'entry catalog brut (ou null) avec son champ usages
 *
 * @returns {{ usages: Array|null, source: 'user'|'studio'|'backline'|'default'|null, curatedBy?: string }}
 *   - source='user' / 'studio' / 'backline' : l'override a parlé (même si usages=null explicite)
 *   - source='default'                      : c'est le catalog qui a parlé (avec ou sans usages)
 *   - source=null + usages=null             : ni override ni catalog n'avait quoi que ce soit
 */
function resolveUsagesCascade(presetName, state) {
  const empty = { usages: null, source: null };
  if (!presetName || typeof presetName !== 'string') return empty;
  if (!state || typeof state !== 'object') return empty;
  const { profileOv, studioOv, backlineOv, catalogEntry } = state;

  // Niveau 1 — user perso (priorité max)
  const userOv = getUsageOverride(profileOv, presetName);
  if (userOv && Object.prototype.hasOwnProperty.call(userOv, 'usages')) {
    const u = userOv.usages;
    return {
      usages: Array.isArray(u) ? u : null,
      source: 'user',
    };
  }

  // Niveau 2 — studio (Phase 11)
  const studioOvE = getUsageOverride(studioOv, presetName);
  if (studioOvE && Object.prototype.hasOwnProperty.call(studioOvE, 'usages')) {
    const u = studioOvE.usages;
    const result = {
      usages: Array.isArray(u) ? u : null,
      source: 'studio',
    };
    if (studioOvE.curatedBy) result.curatedBy = studioOvE.curatedBy;
    return result;
  }

  // Niveau 3 — Backline admin runtime
  const backlineOvE = getUsageOverride(backlineOv, presetName);
  if (backlineOvE && Object.prototype.hasOwnProperty.call(backlineOvE, 'usages')) {
    const u = backlineOvE.usages;
    return {
      usages: Array.isArray(u) ? u : null,
      source: 'backline',
    };
  }

  // Niveau 4 — default catalog
  if (catalogEntry && Array.isArray(catalogEntry.usages) && catalogEntry.usages.length > 0) {
    return {
      usages: catalogEntry.usages,
      source: 'default',
    };
  }

  // Rien nulle part
  return empty;
}

/**
 * Phase 7.79.3 — Merge per-item LWW pour shared.usagesOverrides au pull
 * Firestore. Pattern identique à mergeToneNetPresetsLWW Phase 7.53.1 :
 *
 *   - Présent des 2 côtés     → garde celui au plus grand lastModified
 *                                (égalité → keep local pour stabilité)
 *   - Local-only              → keep local (saisie pas encore propagée)
 *   - Remote-only             → adopte remote (nouvel override d'un autre device)
 *
 * Pas de tombstones v1 : pour retirer un override, écrire { usages: null }
 * (le niveau cascade suivant prendra le relais). Cf doc cascade plus haut.
 *
 * @param {Object|undefined} localMap   { [name]: { usages, lastModified } }
 * @param {Object|undefined} remoteMap  { [name]: { usages, lastModified } }
 * @returns {Object} merged map (immutable, nouveau object)
 */
function mergeUsagesOverridesLWW(localMap, remoteMap) {
  const local = (localMap && typeof localMap === 'object') ? localMap : {};
  const remote = (remoteMap && typeof remoteMap === 'object') ? remoteMap : {};
  const out = {};
  const allNames = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const name of allNames) {
    const l = local[name];
    const r = remote[name];
    if (l && r) {
      const lts = (typeof l.lastModified === 'number') ? l.lastModified : 0;
      const rts = (typeof r.lastModified === 'number') ? r.lastModified : 0;
      if (rts > lts) out[name] = r;
      else out[name] = l; // égalité ou local plus récent → keep local
    } else if (l) {
      out[name] = l;
    } else if (r) {
      out[name] = r;
    }
  }
  return out;
}

export {
  getUsageOverride,
  resolveUsagesCascade,
  mergeUsagesOverridesLWW,
};
