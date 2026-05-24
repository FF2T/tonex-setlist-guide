// src/core/state.js — Phase 5 (state v6).
// État applicatif persisté dans localStorage.
//
// Schéma v6 :
//   {
//     version: 6,
//     activeProfileId: string,
//     shared: { songDb, theme, setlists, customGuitars?, toneNetPresets?,
//               deletedSetlistIds? },
//     profiles: { [id]: profile },
//     lastModified?: number,
//     syncId?: string,
//   }
//
// Profil v6 :
//   {
//     id, name, isAdmin, password,
//     myGuitars: string[],
//     customGuitars: object[],
//     editedGuitars: { [id]: object },
//     enabledDevices: string[],                   // ids du registry
//                                                 // ('tonex-pedal', etc.)
//                                                 // Phase 5 (Item E) : seule
//                                                 // source de vérité, le
//                                                 // champ legacy `devices`
//                                                 // est supprimé.
//     availableSources: { [src]: bool },
//     customPacks: object[],
//     banksAnn, banksPlug,                        // 50 et 10 banks A/B/C
//     tmpPatches: { custom: TMPPatch[],           // v4 : Tone Master Pro
//                   factoryOverrides: { [patchId]: object } },
//                                                 // v5 (Phase 4) :
//                                                 //   factoryOverrides[id] peut contenir
//                                                 //   { scenes, footswitchMap }.
//                                                 //   custom[].scenes / footswitchMap optionnels.
//     aiProvider, aiKeys: { anthropic, gemini },
//     loginHistory?: object[],
//   }
//
// Songs v5 (shared.songDb[]) :
//   { id, title, artist, ig?, isCustom?, aiCache?, bpm?, key? }
//   — bpm + key Phase 4, optionnels.
//
// Migrations enchaînées : v1 → v2 → v3 → v4 → v5. Le caller utilise
// loadState() qui applique automatiquement la migration si nécessaire
// et retourne un état au schéma courant.
//
// v4 → v5 : purement additif (champs optionnels song.bpm/key + patch
// scenes/footswitchMap). Aucune transformation.

import { GUITARS } from './guitars.js';
import { findGuitarByAIName } from './scoring/guitar.js';
import { INIT_SONG_DB_META } from './songs.js';
import { INIT_SETLISTS } from './setlists.js';
import {
  INIT_BANKS_ANN, FACTORY_BANKS_PEDALE,
  INIT_BANKS_PLUG, FACTORY_BANKS_PLUG,
} from '../data/data_catalogs.js';
// Phase 7.51.1 — snapshot bundlé du profil démo public (id 'demo').
// Curé manuellement par l'admin via "Exporter snapshot démo" (Phase 7.51.4).
import demoSnapshot from '../data/demo-profile.json';

// ─── Versioning + clés localStorage ──────────────────────────────────
const STATE_VERSION = 11;
const LOCALE_KEY = 'backline_locale'; // Phase 7.49 — fallback pour migrateV7toV8
const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const LS_KEY = 'tonex_guide_v2';        // nom historique stable
const LS_KEY_V1 = 'tonex_guide_v1';
const LS_SECRETS_KEY = 'tonex_secrets';
const LS_TRUSTED_KEY = 'tonex_trusted_devices';
const LS_BACKUP_KEY = 'tonex_guide_backups';
// Phase 6.2 — réduit à 2 pour tenir dans le quota localStorage Safari
// iOS (~2 MB total). Le state lui-même peut peser 1.3 MB avec aiCache,
// donc 5 backups complets dépassent largement le quota.
// Phase 7.52.2 (B-TECH-02) — réduit à 1 : Phase 7.52 (catalog Anniversary
// Premium) a fait grossir le bundle de 232 KB, et avec aiCache stripped
// du sync Firestore (Phase 5.7.1) mais conservé localement, le state
// local atteint régulièrement 1.5+ MB sur les profils avec 100+ songs.
// 2 backups = 3+ MB, hors quota Safari iOS. 1 backup = ~1.5 MB + state
// actif → marge confortable.
const MAX_BACKUPS = 1;

// ─── Helpers ─────────────────────────────────────────────────────────
function mergeBanks(saved, init) {
  if (!saved) return init;
  const merged = { ...saved };
  for (const [k, v] of Object.entries(init)) {
    if (!(k in merged)) merged[k] = v;
  }
  return merged;
}

// Dérive enabledDevices depuis les flags legacy profile.devices.
// Fallback : si aucun device, on active tonex-pedal + tonex-plug
// (les deux defaultEnabled=true du registry).
function deriveEnabledDevices(legacyDevices) {
  const d = legacyDevices || {};
  const out = [];
  if (d.pedale) out.push('tonex-pedal');
  if (d.anniversary) out.push('tonex-anniversary');
  if (d.plug) out.push('tonex-plug');
  if (out.length === 0) return ['tonex-pedal', 'tonex-plug'];
  return out;
}

// Heal d'un profil : si enabledDevices est absent ou pas un tableau
// (state v2 brut, ou profil arrivé en v2 depuis Firestore après que le
// state local a été migré), on le dérive depuis le legacy devices.
// Idempotent : si le profil est déjà au bon format, on retourne la même
// référence (no-op).
//
// À appeler sur tout profil entrant depuis l'extérieur du module
// (Firestore poll, import JSON, …) en plus de la migration loadState.
function ensureProfileV3(profile) {
  if (!profile) return profile;
  if (Array.isArray(profile.enabledDevices)) return profile;
  return { ...profile, enabledDevices: deriveEnabledDevices(profile.devices) };
}

// Pour le rendu UI : retourne la liste d'IDs de devices que les screens
// doivent afficher pour ce profil. Robuste face aux désynchronisations :
// 1) Si profile.enabledDevices est un tableau NON vide → l'utilise tel quel.
// 2) Si profile.enabledDevices est absent OU vide → dérive depuis
//    profile.devices (legacy) — couvre le cas Firestore stale qui efface
//    enabledDevices et où le screen ne doit pas retomber sur les defaults
//    [tonex-pedal, tonex-plug] et afficher des blocs pour des devices que
//    l'utilisateur a explicitement décochés.
// 3) Sinon → defaults registry ['tonex-pedal','tonex-plug'].
//
// Note : retourne un tableau d'IDs (string[]), pas d'objets device. Le
// caller passe ensuite ces IDs à getEnabledDevices via {enabledDevices: ids}
// pour récupérer les objets device complets depuis le registry.
function getDevicesForRender(profile) {
  if (!profile) return ['tonex-pedal', 'tonex-plug'];
  if (Array.isArray(profile.enabledDevices) && profile.enabledDevices.length > 0) {
    return profile.enabledDevices;
  }
  const legacy = profile.devices || {};
  const ids = [];
  if (legacy.pedale) ids.push('tonex-pedal');
  if (legacy.anniversary) ids.push('tonex-anniversary');
  if (legacy.plug) ids.push('tonex-plug');
  if (ids.length > 0) return ids;
  return ['tonex-pedal', 'tonex-plug'];
}

function ensureProfilesV3(profiles) {
  if (!profiles) return profiles;
  const out = {};
  for (const [id, p] of Object.entries(profiles)) {
    out[id] = ensureProfileV3(p);
  }
  return out;
}

// Heal d'un profil v4 : si tmpPatches est absent, l'initialise au
// défaut {custom: [], factoryOverrides: {}}. Idempotent : préserve la
// référence si déjà présent. Pattern défensif pour éviter les
// désynchros Firestore (cf Phase 2 fix).
function ensureProfileV4(profile) {
  if (!profile) return profile;
  // Phase 4 = Phase 3 + tmpPatches. On commence par appliquer le heal v3
  // (qui assure enabledDevices), puis on ajoute tmpPatches.
  const v3healed = ensureProfileV3(profile);
  if (v3healed.tmpPatches && typeof v3healed.tmpPatches === 'object'
      && Array.isArray(v3healed.tmpPatches.custom)
      && typeof v3healed.tmpPatches.factoryOverrides === 'object') {
    return v3healed;
  }
  return {
    ...v3healed,
    tmpPatches: { custom: [], factoryOverrides: {} },
  };
}

function ensureProfilesV4(profiles) {
  if (!profiles) return profiles;
  const out = {};
  for (const [id, p] of Object.entries(profiles)) {
    out[id] = ensureProfileV4(p);
  }
  return out;
}

// Heal d'un profil v6 (Phase 5.1 FIX 1) : drop le champ legacy
// `devices` après avoir healed v3/v4. Le bug d'origine venait du
// fait que Firestore poll injectait des profils stale (v5- avec
// `devices`) via ensureProfilesV4, qui ne droppait pas. Résultat :
// après chaque poll, profile.devices était ré-injecté dans le state
// local. Maintenant ensureProfileV6 garantit l'absence du champ.
// Idempotent : si pas de `devices`, retourne la même référence (no-op).
function ensureProfileV6(profile) {
  if (!profile) return profile;
  const v4healed = ensureProfileV4(profile);
  if (!('devices' in v4healed)) return v4healed;
  const { devices, ...rest } = v4healed;
  return rest;
}

function ensureProfilesV6(profiles) {
  if (!profiles) return profiles;
  const out = {};
  for (const [id, p] of Object.entries(profiles)) {
    out[id] = ensureProfileV6(p);
  }
  return out;
}

// ─── v7 — Last-write-wins + tombstones avec timestamps ─────────────────
//
// Phase 5.7 : `shared.lastModified` (timestamp save global), per-setlist
// `lastModified` (stampé au write), per-profile `lastModified` (idem),
// et tombstones convertis de `string[]` en `{[id]: timestamp}`.
//
// Bug d'origine : le merge Firestore faisait
//   existing.songIds ∪ remote.songIds
// pour chaque setlist commune, jamais de delete propagé. Sébastien
// réduisait 120 → 50, le poll 5s re-unionnait en 120.

// Heal défensif du bloc `shared` au chargement.
// - Si `deletedSetlistIds` est un array legacy (v6 ou avant) → conversion
//   en `{[id]: Date.now() - 1000}` (1s d'antériorité pour ne pas
//   masquer une suppression remote concurrente lors de la cohabitation).
// - Si `lastModified` absent → stamp Date.now().
// - Setlists sans `lastModified` → stamp Date.now() (au moment du heal).
// Idempotent : même référence si tout est déjà conforme v7.
function ensureSharedV7(shared) {
  if (!shared || typeof shared !== 'object') return shared;
  let changed = false;
  const next = { ...shared };
  // Tombstones : array → objet, ou {} si absent/falsy.
  const cur = shared.deletedSetlistIds;
  if (Array.isArray(cur)) {
    const ts = Date.now() - 1000;
    const map = {};
    for (const id of cur) {
      if (typeof id === 'string' && id) map[id] = ts;
    }
    next.deletedSetlistIds = map;
    changed = true;
  } else if (!cur || typeof cur !== 'object') {
    next.deletedSetlistIds = {};
    changed = true;
  }
  // lastModified global.
  if (typeof shared.lastModified !== 'number') {
    next.lastModified = Date.now();
    changed = true;
  }
  // Setlists : stamp lastModified si absent.
  if (Array.isArray(shared.setlists)) {
    let setlistsChanged = false;
    const now = Date.now();
    const stamped = shared.setlists.map((sl) => {
      if (sl && typeof sl.lastModified !== 'number') {
        setlistsChanged = true;
        return { ...sl, lastModified: now };
      }
      return sl;
    });
    if (setlistsChanged) {
      next.setlists = stamped;
      changed = true;
    }
  }
  return changed ? next : shared;
}

// Heal d'un profil v7 : stamp `lastModified` si absent. Délègue d'abord
// à ensureProfileV6 (qui chaîne v3+v4 et drop legacy `devices`).
// Idempotent.
function ensureProfileV7(profile) {
  if (!profile) return profile;
  const v6 = ensureProfileV6(profile);
  if (typeof v6.lastModified === 'number') return v6;
  return { ...v6, lastModified: Date.now() };
}

function ensureProfilesV7(profiles) {
  if (!profiles) return profiles;
  const out = {};
  for (const [id, p] of Object.entries(profiles)) {
    out[id] = ensureProfileV7(p);
  }
  return out;
}

// Phase 7.49 v7 → v8 : ajoute `profile.language` (locale per-profile).
// Chaque profil existant hérite de la locale globale au moment de la
// migration (localStorage backline_locale), ou 'fr' par défaut.
// Migration purement additive, idempotente.
function _readGlobalLocale() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === 'fr' || stored === 'en' || stored === 'es') return stored;
  } catch (e) {}
  return null;
}
function ensureProfileV8(profile, fallbackLocale) {
  if (!profile) return profile;
  const v7 = ensureProfileV7(profile);
  if (v7.language === 'fr' || v7.language === 'en' || v7.language === 'es') return v7;
  return { ...v7, language: fallbackLocale || 'fr' };
}
function ensureProfilesV8(profiles, fallbackLocale) {
  if (!profiles) return profiles;
  const fb = fallbackLocale || _readGlobalLocale() || 'fr';
  const out = {};
  for (const [id, p] of Object.entries(profiles)) {
    out[id] = ensureProfileV8(p, fb);
  }
  return out;
}

// Phase 7.51.1 v8 → v9 : ajoute `profile.isDemo` (boolean, défaut false).
// Le profil démo public (`isDemo: true`) est read-only ; tous les writes
// (setProfileField, setSetlists, setSongDb, fetchAI, saveToFirestore…)
// sont bloqués par un guard runtime (cf. Phase 7.51.2). Le profil démo
// n'existe jamais dans Firestore (stripDemoProfiles à l'export Phase 7.51.2).
// Migration purement additive, idempotente.
function ensureProfileV9(profile) {
  if (!profile) return profile;
  const v8 = ensureProfileV8(profile);
  if (typeof v8.isDemo === 'boolean') return v8;
  return { ...v8, isDemo: false };
}
function ensureProfilesV9(profiles) {
  if (!profiles) return profiles;
  const out = {};
  for (const [id, p] of Object.entries(profiles)) {
    out[id] = ensureProfileV9(p);
  }
  return out;
}

// Phase 7.54 — v9 → v10 : pose `profile.aiCache = {}` (additif optionnel).
// Stocke les analyses IA per-profile au lieu de partagé dans
// `shared.songDb[i].aiCache`. Chaque profil ne stocke que SES analyses
// → state local par device diminue drastiquement quand plusieurs profils
// utilisent l'app.
//
// La migration ne touche PAS shared.songDb[i].aiCache existant (rétro-
// compatible — fallback de lecture). C'est `migrateV9toV10` qui se
// charge de copier shared → profile pour le profil actif et de drop le
// shared associé.
//
// Idempotent : si profile.aiCache existe déjà, retourne le profil tel
// quel.
function ensureProfileV10(profile) {
  if (!profile) return profile;
  const v9 = ensureProfileV9(profile);
  if (v9.aiCache && typeof v9.aiCache === 'object') return v9;
  return { ...v9, aiCache: {} };
}
function ensureProfilesV10(profiles) {
  if (!profiles) return profiles;
  const out = {};
  for (const [id, p] of Object.entries(profiles)) {
    out[id] = ensureProfileV10(p);
  }
  return out;
}

// Garbage-collection des tombstones plus anciens que `maxAgeMs`
// (default 30 jours). Pure ; retourne un nouveau map. Au-delà de cette
// fenêtre, on considère que tous les devices ont propagé la suppression.
function gcTombstones(deletedMap, maxAgeMs = TOMBSTONE_MAX_AGE_MS) {
  if (!deletedMap || typeof deletedMap !== 'object') return {};
  const cutoff = Date.now() - maxAgeMs;
  const out = {};
  for (const [id, ts] of Object.entries(deletedMap)) {
    if (typeof ts === 'number' && ts >= cutoff) out[id] = ts;
  }
  return out;
}

// v6 → v7 : ensureSharedV7 + ensureProfilesV7 + cleanup one-shot des
// doublons (même nom + mêmes profileIds). Le survivant est celui ayant
// le plus de songIds (tiebreak ordre d'apparition) ; les losers sont
// tombstonés avec `Date.now()`. Le survivant absorbe les songIds des
// losers en union dédupliquée (cohérent avec dedupSetlists strict).
//
// Si au moins 1 doublon nettoyé → injecte `shared._migrationToast =
// {count, ts}` consommé par l'App au prochain mount. Sinon, pas de
// champ (le toast reste silencieux).
//
// Idempotent : appliqué sur un state déjà v7 sans doublons → no-op
// (juste version bumpée et heals).
function migrateV6toV7(v6) {
  const next = { ...v6, version: 7 };
  const profiles = ensureProfilesV7(v6.profiles);
  next.profiles = profiles;
  let shared = ensureSharedV7(v6.shared);
  // Cleanup doublons one-shot.
  if (Array.isArray(shared.setlists)) {
    const groups = new Map();
    shared.setlists.forEach((sl, idx) => {
      if (!sl || typeof sl.name !== 'string') return;
      const ids = Array.isArray(sl.profileIds) ? [...sl.profileIds].sort().join('|') : '';
      const key = `${sl.name}::${ids}`;
      if (!groups.has(key)) groups.set(key, { items: [], firstIdx: idx });
      groups.get(key).items.push({ sl, idx });
    });
    let count = 0;
    const survivors = [];
    const consumed = new Set();
    const deletedMap = { ...(shared.deletedSetlistIds || {}) };
    const now = Date.now();
    shared.setlists.forEach((sl, idx) => {
      if (consumed.has(idx)) return;
      const ids = Array.isArray(sl.profileIds) ? [...sl.profileIds].sort().join('|') : '';
      const key = sl && typeof sl.name === 'string' ? `${sl.name}::${ids}` : null;
      const grp = key ? groups.get(key) : null;
      if (!grp || grp.items.length === 1) {
        survivors.push(sl);
        consumed.add(idx);
        return;
      }
      // Choisit le survivant (plus de songIds, tiebreak idx min).
      let survivor = grp.items[0];
      for (let i = 1; i < grp.items.length; i++) {
        const cand = grp.items[i];
        if ((cand.sl.songIds || []).length > (survivor.sl.songIds || []).length) {
          survivor = cand;
        }
      }
      // Merge songIds + tombstone losers.
      const seen = new Set();
      const merged = [];
      const pushAll = (arr) => {
        for (const id of arr || []) {
          if (!seen.has(id)) { seen.add(id); merged.push(id); }
        }
      };
      pushAll(survivor.sl.songIds);
      grp.items.forEach(({ sl: sl2, idx: i2 }) => {
        consumed.add(i2);
        if (sl2 !== survivor.sl) {
          pushAll(sl2.songIds);
          deletedMap[sl2.id] = now;
          count += 1;
        }
      });
      survivors.push({ ...survivor.sl, songIds: merged, lastModified: now });
    });
    if (count > 0) {
      shared = { ...shared, setlists: survivors, deletedSetlistIds: deletedMap, _migrationToast: { count, ts: now } };
    } else if (survivors !== shared.setlists) {
      shared = { ...shared, setlists: survivors };
    }
  }
  next.shared = shared;
  return next;
}

// Phase 7.49 v7 → v8 : injection `profile.language` per-profile.
// Lit le `backline_locale` localStorage (présent depuis Phase 7.36) et
// l'applique uniformément à chaque profil. Une fois posé, chaque user
// pourra changer sa langue indépendamment via Mon Profil → Affichage.
// Idempotent : un état déjà v8 avec profile.language posé → no-op.
function migrateV7toV8(v7) {
  if (!v7) return v7;
  const fb = _readGlobalLocale() || 'fr';
  return {
    ...v7,
    version: 8,
    profiles: ensureProfilesV8(v7.profiles, fb),
  };
}

// Phase 7.51.1 v8 → v9 : injection `profile.isDemo: false` per-profile.
// Le profil démo public (id 'demo', isDemo: true) est chargé in-memory
// uniquement depuis demo-profile.json bundlé ; il n'est jamais migré
// depuis localStorage. Pour les profils existants, ce flag false signale
// explicitement "ce profil n'est pas en mode démo". Le runtime guard
// (Phase 7.51.2) check ce flag pour bloquer/autoriser les writes.
// Migration purement additive, idempotente.
function migrateV8toV9(v8) {
  if (!v8) return v8;
  return {
    ...v8,
    version: 9,
    profiles: ensureProfilesV9(v8.profiles),
  };
}

// Phase 7.54 — v9 → v10 : migration aiCache shared → per-profile.
//
// Étapes :
// 1. Pose `profile.aiCache = {}` sur TOUS les profils (additif via
//    ensureProfilesV10).
// 2. Pour le profil ACTIF (activeProfileId) UNIQUEMENT :
//    - Identifie les songs présentes dans ses setlists (où profileIds
//      inclut activeProfileId).
//    - Pour chaque song avec shared.songDb[i].aiCache présent :
//      copie aiCache → profile.aiCache[songId] et set
//      shared.songDb[i].aiCache = null.
//    - Stamp profile.lastModified pour propager via Firestore LWW.
// 3. Les aiCache des songs hors setlists du profil actif restent dans
//    shared (préservés pour les autres profils qui pourraient les
//    avoir dans leurs setlists). Quand un autre profil bootera en
//    v10, sa propre migration migrera ses songs.
//
// Idempotente : sur un state déjà v10, le helper extrait toujours les
// aiCache shared restants (cas dégénéré où une song serait
// re-shared-cached par un pull pré-7.54), ce qui converge vers un
// état où shared.songDb[i].aiCache est null pour les songs du profil
// actif.
function migrateV9toV10(state) {
  if (!state) return state;
  const out = { ...state, version: 10, profiles: ensureProfilesV10(state.profiles) };
  const activeId = state.activeProfileId;
  const profiles = out.profiles || {};
  // Songs dans les setlists du profil actif (pour copie ciblée)
  const mySongIds = new Set();
  const setlists = state.shared?.setlists || [];
  if (activeId) {
    for (const sl of setlists) {
      if (!Array.isArray(sl.profileIds) || !sl.profileIds.includes(activeId)) continue;
      for (const id of sl.songIds || []) mySongIds.add(id);
    }
  }
  // Phase 7.54.1 — DROP TOUS les shared.songDb.aiCache (pas seulement
  // ceux du profil actif). Avant le fix, on gardait les caches des
  // autres profils en shared, ce qui faisait gonfler le state Mac à
  // 2.5 MB (98 caches Bruno/Francisco/démo/Arthur conservés en shared).
  // Conséquence : push compressed > 800 KB → strip aiCache → modifs
  // ne propagent plus.
  //
  // Solution radicale : drop ALL. Les autres profils retrouvent leurs
  // caches via leur propre profile.aiCache au pull (sync per-profile
  // via mergeProfilesLWW Phase 5.7) ET via leur propre migration v10
  // sur leur device (qui copie leurs shared → leur profile).
  //
  // Trade-off accepté : si un autre profil se connecte sur ce device,
  // ses analyses doivent re-fetcher (pas dispo localement avant sync).
  // En pratique : rare. Compromise vs blocage permanent du sync.
  // Phase 7.74.8 — `cacheMigrated` : passe à true uniquement si la
  // migration déplace réellement au moins un aiCache shared→profile.
  // Sert à décider si on re-stampe `lastModified` (cf bloc plus bas).
  let cacheMigrated = false;
  const newProfileCache = activeId && profiles[activeId]
    ? { ...(profiles[activeId].aiCache || {}) }
    : {};
  const newSongDb = (state.shared?.songDb || []).map((s) => {
    if (!s || !s.id || !s.aiCache) return s;
    // Copie vers profile.aiCache du profil actif si la song est dans
    // ses setlists ET que profile n'a pas déjà un sv supérieur.
    if (activeId && mySongIds.has(s.id)) {
      const existing = newProfileCache[s.id];
      const existingSv = existing && typeof existing.sv === 'number' ? existing.sv : -1;
      const sharedSv = typeof s.aiCache.sv === 'number' ? s.aiCache.sv : 0;
      if (sharedSv > existingSv) {
        newProfileCache[s.id] = s.aiCache;
        cacheMigrated = true;
      }
    }
    // Drop shared.aiCache pour toutes les songs (legacy obsolète en v10).
    return { ...s, aiCache: null };
  });
  if (activeId && profiles[activeId]) {
    const curProfile = profiles[activeId];
    out.profiles = {
      ...profiles,
      [activeId]: {
        ...curProfile,
        aiCache: newProfileCache,
        // Phase 7.74.8 — POLLUTION PROFILE occurrence #7.
        // Ne re-stamper `lastModified` QUE si la migration a réellement
        // déplacé un aiCache shared→profile. `_runFullChain` (donc
        // `migrateV9toV10`) tourne à CHAQUE chargement de l'app, même
        // sur un state déjà-v10 (loadState: `version === STATE_VERSION
        // → _runFullChain`). Re-stamper inconditionnellement à chaque
        // boot rendait gratuitement le profil actif « le plus récent »
        // pour le LWW : un appareil au contenu périmé (banques
        // corrompues) gagnait tous les merges et propageait son état
        // stale (Mac → Firestore → iPhone). C'était le 2e amplificateur
        // de la pollution profile — Phase 7.74.7 n'avait corrigé que
        // `recordLogin`. Sur un state déjà-v10 stable (cas de 100% des
        // reloads), `cacheMigrated` est false → on préserve le
        // `lastModified` existant → un reload ne fait plus « gagner »
        // l'appareil. Cf docs/SYNC.md « Phase 7.74.8 ».
        lastModified: cacheMigrated ? Date.now() : curProfile.lastModified,
      },
    };
  }
  out.shared = { ...(state.shared || {}), songDb: newSongDb };
  return out;
}

// ─── Phase 7.74.9 — v10 → v11 : timestamp dédié aux banks ────────────
//
// Contexte : occurrence #8 de la pollution profile (2026-05-21 soir).
// `mergeProfileLWW` adoptait `banksAnn`/`banksPlug` EN BLOC dès que
// `remote.lastModified > local.lastModified`. Or `lastModified` est un
// timestamp **global au profil** : n'importe quelle écriture (édition
// de sources, ouverture d'un morceau qui déclenche `setSongAiCache`
// stampant, login, etc.) fait gagner le LWW à TOUS les champs, banks
// comprises. Un appareil dont le contenu de banks est périmé pouvait
// donc écraser un autre appareil dont les banks étaient à jour, dès lors
// qu'il avait stampé son `lastModified` plus récemment pour une raison
// totalement indépendante.
//
// Fix : timestamp dédié `profile.banksModified` stampé UNIQUEMENT lors
// d'une édition réelle de `banksAnn` ou `banksPlug`. `mergeProfileLWW`
// adopte les banks remote SEULEMENT si `remote.banksModified >
// local.banksModified` ; sinon keep local. Une vraie réorg propage
// normalement ; un reload ou une écriture aiCache n'écrase plus jamais
// les banks.
//
// Backfill volontairement à 0 (pas `lastModified`) : état neutre, tant
// que personne n'a fait d'édition réelle post-migration, aucun appareil
// n'écrase l'autre. La première vraie édition (qui stamp `Date.now()`)
// propage correctement.
//
// Idempotente : sur un state déjà v11 avec banksModified présent → no-op.

function ensureProfileV11(profile) {
  if (!profile) return profile;
  const v10 = ensureProfileV10(profile);
  if (typeof v10.banksModified === 'number') return v10;
  return { ...v10, banksModified: 0 };
}
function ensureProfilesV11(profiles) {
  if (!profiles) return profiles;
  const out = {};
  for (const [id, p] of Object.entries(profiles)) {
    out[id] = ensureProfileV11(p);
  }
  return out;
}

function migrateV10toV11(state) {
  if (!state) return state;
  return {
    ...state,
    version: 11,
    profiles: ensureProfilesV11(state.profiles),
  };
}

// Phase 7.54 — Helper lookup aiCache (priorité profile.aiCache, fallback
// shared.songDb[i].aiCache). Exposé pour la dérivation
// songDbWithProfileCache au niveau App + pour les call sites isolés.
function getProfileAiCache(profile, songId) {
  if (!profile || !songId) return null;
  const cache = profile.aiCache;
  if (cache && typeof cache === 'object' && cache[songId]) return cache[songId];
  return null;
}

// ─── Merge helpers LWW (utilisés par main.jsx applyRemoteData) ────────

// Union de deux maps de tombstones ; pour chaque id présent des deux
// côtés, garde max(localTs, remoteTs). Inputs falsy → {}.
function mergeDeletedSetlistIds(localMap, remoteMap) {
  const out = {};
  const l = localMap && typeof localMap === 'object' ? localMap : {};
  const r = remoteMap && typeof remoteMap === 'object' ? remoteMap : {};
  for (const [id, ts] of Object.entries(l)) {
    if (typeof ts === 'number') out[id] = ts;
  }
  for (const [id, ts] of Object.entries(r)) {
    if (typeof ts !== 'number') continue;
    out[id] = typeof out[id] === 'number' ? Math.max(out[id], ts) : ts;
  }
  return out;
}

// Merge LWW de deux listes de setlists.
//  - Si `mergedDeletedMap[id]` >= max(local.lastModified, remote.lastModified)
//    → drop (tombstone gagne).
//  - Sinon si présent des deux côtés → garde celui au plus grand
//    `lastModified` (égalité = keep local pour idempotence). Fallback ?? 0.
//  - Sinon local-only ou remote-only → garde tel quel.
// Ordre de sortie : ordre des locaux d'abord, puis remote-only à la
// suite (préserve la stabilité visuelle côté UI).
function mergeSetlistsLWW(localSetlists, remoteSetlists, mergedDeletedMap) {
  const local = Array.isArray(localSetlists) ? localSetlists : [];
  const remote = Array.isArray(remoteSetlists) ? remoteSetlists : [];
  const dead = mergedDeletedMap && typeof mergedDeletedMap === 'object' ? mergedDeletedMap : {};
  const remoteMap = new Map(remote.filter((sl) => sl && sl.id).map((sl) => [sl.id, sl]));
  const seenIds = new Set();
  const out = [];
  for (const localSl of local) {
    if (!localSl || !localSl.id) continue;
    seenIds.add(localSl.id);
    const remoteSl = remoteMap.get(localSl.id);
    const localTs = typeof localSl.lastModified === 'number' ? localSl.lastModified : 0;
    const remoteTs = remoteSl && typeof remoteSl.lastModified === 'number' ? remoteSl.lastModified : 0;
    const tombstoneTs = typeof dead[localSl.id] === 'number' ? dead[localSl.id] : -1;
    if (tombstoneTs >= Math.max(localTs, remoteTs)) continue; // drop : suppression la plus récente
    if (!remoteSl) {
      out.push(localSl);
      continue;
    }
    // Présent des deux côtés : LWW.
    out.push(remoteTs > localTs ? remoteSl : localSl);
  }
  // Remote-only : ajouter en respectant le tombstone.
  for (const remoteSl of remote) {
    if (!remoteSl || !remoteSl.id || seenIds.has(remoteSl.id)) continue;
    const remoteTs = typeof remoteSl.lastModified === 'number' ? remoteSl.lastModified : 0;
    const tombstoneTs = typeof dead[remoteSl.id] === 'number' ? dead[remoteSl.id] : -1;
    if (tombstoneTs >= remoteTs) continue;
    out.push(remoteSl);
  }
  // Phase 7.74 Couche 4 — Dedup aggressif AUTOMATIQUE après le merge LWW
  // per-id. Le LWW dedupe par id mais pas par (name+profileIds différents).
  // Cas observé : Mac et iPhone ont chacun une setlist "Cours Franck B"
  // avec des ids différents mais le même name. Après merge LWW per-id,
  // les deux survivent côte à côte → doublon visible côté user.
  // dedupSetlists({mergeAcrossProfiles:true}) Phase 5.4 fusionne par
  // name uniquement, union des profileIds, garde celle avec le plus
  // de songs. Stamp lastModified sur le survivant pour propager le merge.
  const deduped = dedupSetlists(out, { mergeAcrossProfiles: true });
  // Si dedup a effectivement fusionné, stamp les survivants pour que
  // la sync propage le clean. dedupSetlists ne stamp pas par défaut
  // (mode pure helper). On stamp ici uniquement les setlists modifiées
  // (différentes de leur version d'origine dans `out`).
  if (deduped !== out && deduped.length !== out.length) {
    const ts = Date.now();
    return deduped.map((sl) => {
      // Si la setlist a un songIds ou profileIds plus grand que la
      // version d'origine (= elle a absorbé une autre), stamp.
      const orig = out.find((o) => o.id === sl.id);
      if (!orig) return { ...sl, lastModified: ts };
      const grew = (sl.songIds || []).length > (orig.songIds || []).length
        || (sl.profileIds || []).length > (orig.profileIds || []).length;
      return grew ? { ...sl, lastModified: ts } : sl;
    });
  }
  return deduped;
}

// Phase 7.53.1 — Merge LWW per-item pour shared.toneNetPresets.
//
// Bug observé 2026-05-16 (avant fix) : applyRemoteData remplaçait en
// bloc setToneNetPresets(data.shared.toneNetPresets), donc un device
// avec un tableau vide qui poussait écrasait définitivement la curation
// d'un autre device. Sébastien Mac a perdu ses presets ToneNET ainsi.
//
// Logique : LWW per-item par `id` du preset. Pour chaque id dans union :
//  - Présent des deux côtés → garde celui au plus grand `lastModified`
//    (égalité = keep local pour stabilité).
//  - Local-only → keep local (préserve une saisie locale non encore
//    propagée à Firestore).
//  - Remote-only → adopte remote (nouveau preset depuis autre device).
//
// Différence avec mergeSetlistsLWW : pas de tombstones. La suppression
// d'un preset est délibérée user action, propagée via deletePreset →
// next push absent → mais comment fait-on la diff avec "remote a un
// preset que local n'a jamais vu" ? Solution v1 : pas de suppression
// distribuée. Si user supprime un preset sur Mac et qu'iPhone n'a pas
// encore pull, iPhone re-pushera ce preset → réapparaît sur Mac. C'est
// acceptable car la délétion ToneNET est rare ; v2 pourrait ajouter
// tombstones si besoin (cf Phase 5.7 pour le pattern complet).
//
// Migration : si un preset existant n'a pas de `lastModified`, on
// considère ts=0 → un remote stampé gagne toujours. Inverse safe :
// un remote sans stamp ne gagne jamais sur un local stampé. Convergence
// éventuelle vers tous stampés à mesure que les saves se font.
// Phase 7.53.2 — Union de deux maps de tombstones ToneNET (alias
// fonctionnel de mergeDeletedSetlistIds pour clarté de l'API). Pour
// chaque id présent des deux côtés, garde max(localTs, remoteTs).
// Inputs falsy → {}.
function mergeDeletedToneNetIds(localMap, remoteMap) {
  return mergeDeletedSetlistIds(localMap, remoteMap);
}

// Phase 7.53.2 — Param `mergedTombstones` (optional) pour résoudre la
// résurrection ToneNET cross-device. Sans tombstones (param absent ou
// {}) : comportement Phase 7.53.1 inchangé (rétro-compat). Avec :
// drop les items dont `id ∈ tombstones` ET `tombstones[id] >=
// max(local.lastModified, remote.lastModified)`. Tombstone gagne sur
// item plus ancien → suppression vraiment propagée.
//
// Cas-cible Phase 7.53.2 (bug 2026-05-24) :
//   - Mac purge un preset id=X à T2, écrit tombstones[X]=T2
//   - iPhone garde le preset local avec lastModified=T1 (T1 < T2)
//   - Mac push : Firestore = {presets: [], tombstones: {X: T2}}
//   - iPhone pull → mergeToneNetPresetsLWW(local=[{id:X,T1}],
//     remote=[], tombstones={X:T2}) → DROP X car T2 >= T1
//   - Cycle cassé.
function mergeToneNetPresetsLWW(localPresets, remotePresets, mergedTombstones) {
  const local = Array.isArray(localPresets) ? localPresets : [];
  const remote = Array.isArray(remotePresets) ? remotePresets : [];
  const tombstones = mergedTombstones && typeof mergedTombstones === 'object' ? mergedTombstones : {};
  const remoteMap = new Map(remote.filter((p) => p && p.id).map((p) => [p.id, p]));
  const seenIds = new Set();
  const out = [];
  for (const lp of local) {
    if (!lp || !lp.id) continue;
    seenIds.add(lp.id);
    const rp = remoteMap.get(lp.id);
    const lts = typeof lp.lastModified === 'number' ? lp.lastModified : 0;
    const rts = rp && typeof rp.lastModified === 'number' ? rp.lastModified : 0;
    const tts = typeof tombstones[lp.id] === 'number' ? tombstones[lp.id] : 0;
    // Phase 7.53.2 — Tombstone gagne si son ts >= max(local, remote)
    if (tts > 0 && tts >= Math.max(lts, rts)) continue;
    if (!rp) {
      out.push(lp);
      continue;
    }
    out.push(rts > lts ? rp : lp);
  }
  // Remote-only (respecte aussi tombstones)
  for (const rp of remote) {
    if (!rp || !rp.id || seenIds.has(rp.id)) continue;
    const rts = typeof rp.lastModified === 'number' ? rp.lastModified : 0;
    const tts = typeof tombstones[rp.id] === 'number' ? tombstones[rp.id] : 0;
    if (tts > 0 && tts >= rts) continue;
    out.push(rp);
  }
  return out;
}

// Merge LWW per-profile. Pour chaque id dans union :
//  - Présent des deux côtés → garde celui au plus grand lastModified
//    (égalité = keep local).
//  - Local-only → garde local.
//  - Remote-only → adopte remote.
// Le callback `applySecrets` (optionnel) est appliqué sur les profils
// remote adoptés (pour préserver aiKeys/password locaux côté caller).
// Tous les profils sortants passent par ensureProfileV7 pour heal.
// Phase 7.74 Couche 1 — Helper pour update profil avec stamp obligatoire.
//
// Bug récurrent observé 2026-05-18 : plusieurs call sites onProfiles/
// setProfiles oubliaient `lastModified: Date.now()`. Conséquence : le
// merge LWW perd l'update si un autre device push entretemps avec stamp
// récent (par exemple un toggle device, un rename profile, un changement
// password admin).
//
// Sites coupables identifiés Phase 7.74 audit H1 :
//   - ProfilesAdmin.jsx:47 (change password admin)
//   - ProfilesAdmin.jsx:55 (rename profile admin)
//   - ProfileTab.jsx:52 (delete custom guitar de tous profils)
//   - MesAppareilsTab.jsx:25-31 (toggle enabledDevices)
//
// Helper pur qui :
//  1. Lit le profil cible dans `profiles[profileId]`
//  2. Applique `partial` (peut être objet ou fonction `(prev) => partial`)
//  3. Force `lastModified: Date.now()` même si l'appelant l'a omis
//  4. Retourne le nouveau profiles object (immutable)
//
// Si `profileId` est absent du store, retourne profiles inchangé.
// Si `partial` est une fonction qui renvoie null/undefined → no-op.
function stampedProfileUpdate(profiles, profileId, partial) {
  if (!profiles || typeof profiles !== 'object' || !profileId) return profiles;
  const cur = profiles[profileId];
  if (!cur) return profiles;
  const resolved = typeof partial === 'function' ? partial(cur) : partial;
  if (resolved == null || typeof resolved !== 'object') return profiles;
  return {
    ...profiles,
    [profileId]: { ...cur, ...resolved, lastModified: Date.now() },
  };
}

// Phase 7.81 + 7.74.9 — Merge aiCache per-songId. Extrait en helper
// pour pouvoir l'appliquer dans les DEUX branches de `mergeProfileLWW`
// (rts > lts ET rts <= lts). Pourquoi : `setSongAiCache` ne stamp plus
// `lastModified` (Phase 7.74.9, anti-pollution profile) — donc un
// device qui n'a fait QUE des analyses peut avoir rts <= lts vs un
// remote qui a fait une autre écriture stampante (login, etc.). Sans
// ce merge dans la branche locale-gagne, ces analyses ne descendraient
// jamais sur l'autre device.
//
// L'aiCache s'auto-arbitre déjà via `ts` per-entry (Phase 7.81). LWW
// par `ts` ; fallback sv pour les entries legacy.
//
// Retourne { merged, changed } : changed=true si le résultat diffère
// de localAi (utilisé par la branche rts<=lts pour décider si on
// retourne local tel quel ou local enrichi).
function mergeAiCachePerSongId(local, remote) {
  const localAi = (local && typeof local === 'object') ? local : {};
  const remoteAi = (remote && typeof remote === 'object') ? remote : {};
  const songIds = new Set([...Object.keys(localAi), ...Object.keys(remoteAi)]);
  const mergedAi = {};
  let changed = false;
  for (const sid of songIds) {
    const le = localAi[sid];
    const re = remoteAi[sid];
    let pick;
    if (le && re) {
      const lts = typeof le.ts === 'number' ? le.ts : 0;
      const rts = typeof re.ts === 'number' ? re.ts : 0;
      if (lts > 0 || rts > 0) {
        pick = rts > lts ? re : le;
      } else {
        const lsv = typeof le.sv === 'number' ? le.sv : 0;
        const rsv = typeof re.sv === 'number' ? re.sv : 0;
        pick = rsv > lsv ? re : le;
      }
    } else if (le) {
      pick = le;
    } else if (re) {
      pick = re;
      changed = true; // remote-only adopté
    }
    if (pick) {
      mergedAi[sid] = pick;
      if (pick !== localAi[sid]) changed = true;
    }
  }
  // Détecte aussi le cas où local avait des entries qui ne sont pas
  // dans merged (impossible vu qu'on prend l'union, mais defensive).
  if (!changed && Object.keys(localAi).length !== Object.keys(mergedAi).length) {
    changed = true;
  }
  return { merged: mergedAi, changed };
}

// Phase 7.74 Couche 2 — merge LWW per-field pour les champs critiques
// d'un profile (vs ancien adopt-en-bloc qui causait des pollutions
// cross-mélange).
//
// Champs critiques avec garde-fous Couche 3 (drop massif détecté) :
//  - myGuitars : adopt remote uniquement si pas de drop suspect
//  - language : keep local si delta stamp < 5s (anti-cycle short delta)
//
// Champs adopt-en-bloc safe (atomiques, source de vérité unique) :
//  - banksAnn, banksPlug, enabledDevices : adopt remote si plus récent
//  - aiCache : déjà géré par mergeSongDbPreservingLocalAiCache + Phase
//    7.54 per-profile
//  - availableSources, aiProvider, recoMode, guitarBias, theme :
//    adopt si plus récent (champs simples)
//  - customGuitars : union par id (LWW remote gagne si conflict)
//  - customPacks : union par name (remote gagne si conflict)
//  - tmpPatches : adopt en bloc (objet imbriqué)
//  - loginHistory : adopt en bloc (cap 10 entries)
//  - editedGuitars : adopt en bloc
//
// Champs préservés (jamais propagés via Firestore, locaux uniquement) :
//  - password, aiKeys, isDemo, id, name, isAdmin (gérés via applySecrets)
//
// Si remote.lastModified <= local.lastModified, on garde local tel quel
// (le local est déjà à jour ou plus récent).
//
// `options.debug = true` active console.warn forensique pour observer
// les décisions de merge (cf Couche 3 défense ultime).
function mergeProfileLWW(local, remote, options = {}) {
  // Cas dégénérés : 1 seul des deux présent
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  const lts = typeof local.lastModified === 'number' ? local.lastModified : 0;
  const rts = typeof remote.lastModified === 'number' ? remote.lastModified : 0;
  // Phase 7.74.9 — Si remote plus ancien ou égal sur lastModified,
  // on garde local pour TOUS les champs sauf l'aiCache, qui s'auto-
  // arbitre via ts per-entry et doit pouvoir propager même quand
  // setSongAiCache ne stamp plus lastModified.
  if (rts <= lts) {
    const { merged: mergedAi, changed: aiChanged } = mergeAiCachePerSongId(local.aiCache, remote.aiCache);
    if (!aiChanged) return local;
    return { ...local, aiCache: mergedAi };
  }
  // Sinon : remote plus récent → on construit un merge per-field.
  const debug = options.debug === true || (typeof window !== 'undefined' && window.__BACKLINE_MERGE_DEBUG === true);
  const debugLog = (msg, data) => {
    if (debug && typeof console !== 'undefined' && console.warn) {
      console.warn('[merge-defense]', local.id || '?', msg, data || '');
    }
  };

  // Base : champs adopt-en-bloc (banks, enabledDevices, devices,
  // availableSources, aiProvider, recoMode, guitarBias, tmpPatches,
  // loginHistory, editedGuitars). On part de remote pour ces champs.
  const merged = { ...remote };

  // ── banksAnn / banksPlug : LWW dédié via `banksModified` ──
  //    Phase 7.74.9 — occurrence #8 a démontré que l'adoption en bloc
  //    via `merged = { ...remote }` était le canal de propagation de la
  //    pollution profile. `lastModified` étant global au profil, toute
  //    écriture (édition de sources, ouverture d'un morceau via
  //    setSongAiCache, login, etc.) faisait gagner le LWW à TOUS les
  //    champs, banks comprises — y compris quand le device en question
  //    n'avait pas touché aux banks (et les avait éventuellement périmées).
  //
  //    Fix : adoption des banks UNIQUEMENT si `remote.banksModified >
  //    local.banksModified`. Sinon keep local. Stamp posé seulement lors
  //    d'une édition réelle de banks via setProfileField (main.jsx).
  //
  //    Phase 7.74.7 log forensique conservé (diff slots) mais reformulé
  //    pour refléter la décision réelle (adopté vs gardé).
  const lbm = typeof local.banksModified === 'number' ? local.banksModified : 0;
  const rbm = typeof remote.banksModified === 'number' ? remote.banksModified : 0;
  const banksRemoteWins = rbm > lbm;
  for (const bk of ['banksAnn', 'banksPlug']) {
    const lb = local[bk] && typeof local[bk] === 'object' ? local[bk] : {};
    const rb = remote[bk] && typeof remote[bk] === 'object' ? remote[bk] : {};
    let diffSlots = 0;
    for (const bid of new Set([...Object.keys(lb), ...Object.keys(rb)])) {
      const ls = lb[bid] || {};
      const rs = rb[bid] || {};
      for (const slot of ['A', 'B', 'C']) {
        if ((ls[slot] || '') !== (rs[slot] || '')) diffSlots++;
      }
    }
    if (banksRemoteWins) {
      // Adopte remote (déjà dans merged via `{ ...remote }`).
      if (diffSlots >= 10) {
        debugLog(`${bk} mass-change ADOPTED : remote.banksModified=${rbm} > local.banksModified=${lbm}, ${diffSlots} slots remplacés`, { diffSlots, lbm, rbm });
      }
    } else {
      // Keep local (override la valeur remote injectée par {...remote}).
      merged[bk] = lb;
      if (diffSlots >= 10) {
        debugLog(`${bk} mass-change BLOCKED : remote.banksModified=${rbm} <= local.banksModified=${lbm}, ${diffSlots} slots préservés en local`, { diffSlots, lbm, rbm });
      }
    }
  }
  // Stamp banksModified du merged = max(local, remote) pour que la prochaine
  // sync n'oscille pas. Cohérent avec le stamp lastModified de la ligne
  // ~1001 (max des deux).
  merged.banksModified = Math.max(lbm, rbm);

  // ── myGuitars : Couche 3 defense ──
  // 1. Block adoption si drop suspect (≥3 guitares OU >50% local)
  // 2. Filter orphan-cross-profile (Phase 7.74.1 fix) : si remote
  //    ADD une guitare qui appartient à un autre profil local
  //    (otherProfilesGuitars) ET pas au local actuel, c'est une
  //    pollution cross-profil → filter cette guitare.
  const localGuitars = Array.isArray(local.myGuitars) ? local.myGuitars : [];
  const remoteGuitars = Array.isArray(remote.myGuitars) ? remote.myGuitars : [];
  // otherProfilesGuitars : set des guitares qui appartiennent UNIQUEMENT
  // à d'autres profils locaux (pas au profil courant). Passé via
  // options par mergeProfilesLWW pluriel.
  const otherProfilesGuitars = options.otherProfilesGuitars instanceof Set
    ? options.otherProfilesGuitars
    : null;

  if (localGuitars.length > 0) {
    const dropped = localGuitars.filter((g) => !remoteGuitars.includes(g));
    const tooManyDropped = dropped.length >= 3 || (dropped.length / localGuitars.length) > 0.5;
    if (tooManyDropped) {
      debugLog(`SUSPECT myGuitars drop : remote drops ${dropped.length} guitares (${dropped.join(',')}) — keeping local`, { local: localGuitars, remote: remoteGuitars });
      merged.myGuitars = localGuitars;
    } else {
      // Drop modéré → on adopte remote MAIS on filtre les orphan
      // cross-profile (Phase 7.74.1).
      let nextGuitars = remoteGuitars;
      if (otherProfilesGuitars) {
        const localSet = new Set(localGuitars);
        const orphans = remoteGuitars.filter((g) => !localSet.has(g) && otherProfilesGuitars.has(g));
        if (orphans.length > 0) {
          debugLog(`SUSPECT orphan-cross-profile : remote ADD guitares (${orphans.join(',')}) qui appartiennent à un autre profil — filtering`, { orphans, local: localGuitars, remote: remoteGuitars });
          nextGuitars = remoteGuitars.filter((g) => !orphans.includes(g));
        }
      }
      // Phase 7.74.4 — Couche 4 : détection pattern swap suspect
      // cg_* → standard. Si après filter orphan le delta entre local
      // et nextGuitars est "drop exactement 1 cg_* + add ≥1 standard",
      // c'est la signature d'une pollution résiduelle (cas observé
      // 2026-05-19 soir : drop Tele 51 cg_* + add sire_t3 sans que
      // sire_t3 soit dans le rig d'aucun profil — orphan check
      // inopérant). Keep local entier.
      //
      // Risque false-positive : un user qui remplace explicitement
      // sa custom par une standard du catalog. Très rare (les customs
      // sont créés justement car absentes du catalog). Workaround :
      // faire les 2 actions sur des stamps séparés (add d'abord,
      // remove ensuite — donne 2 merges distincts qui passent).
      const localSetCheck = new Set(localGuitars);
      const nextSetCheck = new Set(nextGuitars);
      const droppedNow = localGuitars.filter((g) => !nextSetCheck.has(g));
      const addedNow = nextGuitars.filter((g) => !localSetCheck.has(g));
      const isSwapSuspect =
        droppedNow.length === 1 &&
        /^cg_/.test(droppedNow[0]) &&
        addedNow.length >= 1 &&
        addedNow.every((g) => !/^cg_/.test(g));
      if (isSwapSuspect) {
        debugLog(`SUSPECT swap pattern cg_*→standard : drop=${droppedNow[0]} add=${addedNow.join(',')} — keeping local`, { dropped: droppedNow, added: addedNow, local: localGuitars, remote: remoteGuitars });
        nextGuitars = localGuitars;
      }
      merged.myGuitars = nextGuitars;
    }
  } else if (otherProfilesGuitars) {
    // Local vide : filtrer quand même les orphans pour ne pas hériter
    // de pollutions au premier merge.
    const orphans = remoteGuitars.filter((g) => otherProfilesGuitars.has(g));
    if (orphans.length > 0) {
      debugLog(`SUSPECT orphan-cross-profile (local vide) : remote contient ${orphans.length} guitares d'autres profils — filtering`, { orphans });
      merged.myGuitars = remoteGuitars.filter((g) => !orphans.includes(g));
    } else {
      merged.myGuitars = remoteGuitars;
    }
  } else {
    merged.myGuitars = remoteGuitars;
  }

  // ── language : keep local si delta stamp < 60s (Phase 7.74.4 — élargi
  //    de 5s à 60s pour couvrir les cycles sync espacés observés
  //    2026-05-19 soir où la langue passait FR → EN involontairement
  //    via merge LWW grossier). Anti-cycle : le user ne change pas sa
  //    langue 2× en 60s. ──
  if (local.language && remote.language && local.language !== remote.language) {
    if (rts - lts < 60000) {
      debugLog(`SUSPECT language conflict short delta (${rts - lts}ms) : ${local.language} → ${remote.language} — keeping local`, { local: local.language, remote: remote.language });
      merged.language = local.language;
    }
  }

  // ── customGuitars : union par id, LWW remote gagne si conflit ──
  const localCG = Array.isArray(local.customGuitars) ? local.customGuitars : [];
  const remoteCG = Array.isArray(remote.customGuitars) ? remote.customGuitars : [];
  const cgById = {};
  for (const g of localCG) { if (g && g.id) cgById[g.id] = g; }
  for (const g of remoteCG) { if (g && g.id) cgById[g.id] = g; } // remote overwrite
  merged.customGuitars = Object.values(cgById);

  // ── customPacks : union par name (les noms sont uniques per profil) ──
  const localCP = Array.isArray(local.customPacks) ? local.customPacks : [];
  const remoteCP = Array.isArray(remote.customPacks) ? remote.customPacks : [];
  const cpByName = {};
  for (const pk of localCP) { if (pk && pk.name) cpByName[pk.name] = pk; }
  for (const pk of remoteCP) { if (pk && pk.name) cpByName[pk.name] = pk; } // remote overwrite
  merged.customPacks = Object.values(cpByName);

  // ── aiCache : merge per-songId via helper Phase 7.81 + 7.74.9 ──
  // Délégué à `mergeAiCachePerSongId` (helper partagé avec la branche
  // rts <= lts, cf Phase 7.74.9). LWW par `ts` per-entry, fallback sv.
  merged.aiCache = mergeAiCachePerSongId(local.aiCache, remote.aiCache).merged;

  // Stamp lastModified = max des deux (pour que la prochaine sync
  // détecte cet état comme à jour).
  merged.lastModified = Math.max(lts, rts);

  return merged;
}

function mergeProfilesLWW(localProfiles, remoteProfiles, options = {}) {
  const local = localProfiles && typeof localProfiles === 'object' ? localProfiles : {};
  const remote = remoteProfiles && typeof remoteProfiles === 'object' ? remoteProfiles : {};
  const applySecrets = typeof options.applySecrets === 'function' ? options.applySecrets : null;
  const out = {};
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)]);

  // Phase 7.74.1 — Pré-calcul otherProfilesGuitarsByProfile : pour
  // chaque profil, set des guitares qui appartiennent à un AUTRE
  // profil local (et pas au profil courant). Permet à mergeProfileLWW
  // de filtrer les orphan-cross-profile (= guitares ajoutées par
  // remote au mauvais profil suite à une pollution sync).
  //
  // Source : on prend les profiles LOCAUX (avant merge). Les guitares
  // custom partagées (ex: lp60 dans plusieurs profils) ne sont PAS
  // considérées comme orphan car elles sont dans ce profil aussi.
  //
  // Phase 7.74.4 explore : étendre la source à union local+remote.
  // Conclusion : approche rejetée. Cas pathologique symétrique — une
  // pollution dans remote.X contamine guitarsByProfile.X qui contamine
  // l'orphan check des autres profils. Le bug réel observé (sire_t3
  // pas dans aucun rig) est couvert par la détection swap suspect
  // cg_*→standard dans mergeProfileLWW (Couche 4 Phase 7.74.4).
  const guitarsByProfile = {};
  for (const [id, p] of Object.entries(local)) {
    guitarsByProfile[id] = new Set(Array.isArray(p?.myGuitars) ? p.myGuitars : []);
  }

  for (const id of ids) {
    const lp = local[id];
    const rp = remote[id];
    if (lp && rp) {
      // Phase 7.74 — Per-field merge via mergeProfileLWW (singulier).
      // Remplace l'ancien adopt-en-bloc qui causait des pollutions.
      const adoptedRemote = applySecrets ? applySecrets({ [id]: rp })[id] : rp;
      // Phase 7.74.1 — Calcul de l'union des guitares des AUTRES profils
      // locaux (excluant le profil courant).
      const otherProfilesGuitars = new Set();
      for (const [otherId, gset] of Object.entries(guitarsByProfile)) {
        if (otherId === id) continue;
        for (const g of gset) otherProfilesGuitars.add(g);
      }
      // Retire les guitares qui sont aussi dans le profil courant
      // (ne pas considérer comme orphan une guitare légitimement
      // partagée entre profils).
      const localGuitarSet = guitarsByProfile[id] || new Set();
      for (const g of localGuitarSet) otherProfilesGuitars.delete(g);
      const merged = mergeProfileLWW(lp, adoptedRemote, { ...options, otherProfilesGuitars });
      out[id] = ensureProfileV11(merged || lp);
    } else if (lp) {
      out[id] = ensureProfileV11(lp);
    } else if (rp) {
      const adopted = applySecrets ? applySecrets({ [id]: rp })[id] : rp;
      out[id] = ensureProfileV11(adopted);
    }
  }
  return out;
}

// ─── Phase 5.7.1 — strip aiCache du push Firestore ────────────────────
//
// Problème : l'état local atteint ~1037 KB avec 129 morceaux × aiCache
// complets (cot_step2_guitars, cot_step1, preset_ann, preset_plug, …),
// soit ~7-8 KB par song en moyenne. Le push Firestore renvoie alors
// 400 Bad Request (limite document Firestore = 1 MiB = 1 048 576 octets).
// Solution : strip aiCache à la sérialisation pour Firestore, préserver
// aiCache local au pull.

// Retourne une COPIE de `state` où chaque song dans shared.songDb a
// son aiCache retiré. Le state local (localStorage) reste intact.
// Pure : ne mute pas l'input. Si shared.songDb absent → retourne
// l'input tel quel.
function stripAiCacheForSync(state, options = {}) {
  if (!state || typeof state !== 'object') return state;
  const shared = state.shared;
  let mutated = false;
  let out = state;
  // Strip shared.songDb[i].aiCache (Phase 5.7.1 legacy)
  if (shared && Array.isArray(shared.songDb)) {
    const lightSongs = shared.songDb.map((s) => {
      if (!s || typeof s !== 'object') return s;
      if (!('aiCache' in s)) return s;
      const { aiCache, ...rest } = s;
      return rest;
    });
    out = { ...state, shared: { ...shared, songDb: lightSongs } };
    mutated = true;
  }
  // Phase 7.58 — strip profile.aiCache des profils NON-ACTIFS au push.
  // Le profile.aiCache du profil actif (activeId) est PRÉSERVÉ —
  // c'est l'objectif Phase 7.54 (per-profile). Les autres profils
  // sont gardés en local sur le device mais pas pushés pour éviter
  // de gonfler le payload Firestore (limite hard 1 MB).
  //
  // Conséquence : si un autre profil se connecte sur SON device et
  // pull, il ne recevra PAS les profile.aiCache calculés depuis le
  // device de Sébastien (cas pré-calcul beta-testeur). Il doit
  // re-fetcher localement. Acceptable car les pré-calculs admin
  // restent disponibles via le snapshot démo bundlé Phase 7.51.4.
  const activeId = options.activeId || state.activeProfileId;
  if (activeId && out.profiles && typeof out.profiles === 'object') {
    // Vérifie d'abord si au moins un profil non-actif a un aiCache non-vide
    // (sinon le strip est no-op → garder identity check)
    let hasNonActiveAiCache = false;
    for (const [id, p] of Object.entries(out.profiles)) {
      if (id !== activeId && p && p.aiCache && Object.keys(p.aiCache).length > 0) {
        hasNonActiveAiCache = true;
        break;
      }
    }
    if (hasNonActiveAiCache) {
      const lightProfiles = {};
      for (const [id, p] of Object.entries(out.profiles)) {
        if (id === activeId) {
          lightProfiles[id] = p;
        } else if (p && typeof p === 'object' && p.aiCache && Object.keys(p.aiCache).length > 0) {
          lightProfiles[id] = { ...p, aiCache: {} };
        } else {
          lightProfiles[id] = p;
        }
      }
      out = { ...out, profiles: lightProfiles };
      mutated = true;
    }
  }
  return mutated ? out : state;
}

// Merge songDb avec préservation explicite de aiCache local (Phase 5.7.1).
// - Si song présent local ET remote :
//     - Si remote.aiCache existe ET remote.aiCache.sv > local.aiCache.sv
//       (ou local sans aiCache) → adopt remote complet. Couvre la
//       cohabitation pendant le rollout : un client v7 (pré-5.7.1) qui
//       pousse encore aiCache continue de propager une mise à jour
//       d'aiCache plus récente.
//     - Sinon → adopt remote.* mais réinjecte local.aiCache. Ce cas
//       couvre Phase 5.7.1 (remote stripped) ET les updates de
//       title/artist/ig/bpm/key faits sur un autre device.
// - Si local-only → garde local (avec aiCache).
// - Si remote-only → adopt remote (sans aiCache, sera recalculé au
//   prochain fetchAI).
// Puis dedup by title+artist normalisé (même song ajoutée sur 2 devices
// avec des ids distincts) ; renvoie un `_idRemap` non-énumérable sur le
// tableau retour pour que les call sites puissent remapper les songIds
// dans les setlists.
function mergeSongDbPreservingLocalAiCache(local, remote, options = {}) {
  if (!remote) return local;
  if (!local) return remote;
  // Phase 7.54.1 — en v10, l'aiCache vit dans profile.aiCache, pas
  // dans shared.songDb. On NE doit JAMAIS adopter remote.aiCache car
  // ça ré-injecterait du legacy obsolète qui ferait gonfler le state
  // (et déclencher le strip Phase 5.7.1 au push).
  const isV10 = options.isV10 === true;
  const map = new Map(local.map((s) => [s.id, s]));
  for (const rs of remote) {
    if (!rs || !rs.id) continue;
    const existing = map.get(rs.id);
    if (!existing) {
      // Remote-only : en v10, drop son aiCache (obsolète shared)
      if (isV10) {
        map.set(rs.id, { ...rs, aiCache: null });
      } else {
        map.set(rs.id, rs);
      }
      continue;
    }
    const rsv = rs.aiCache && typeof rs.aiCache.sv === 'number' ? rs.aiCache.sv : 0;
    const lsv = existing.aiCache && typeof existing.aiCache.sv === 'number' ? existing.aiCache.sv : 0;
    if (isV10) {
      // En v10 : adopt remote.* (title, artist, bpm, etc.) mais TOUJOURS
      // drop l'aiCache (vient de shared, obsolète — la source de vérité
      // est profile.aiCache).
      map.set(rs.id, { ...rs, aiCache: null });
    } else if (rs.aiCache && (!existing.aiCache || rsv > lsv)) {
      // Remote a un aiCache strictement plus récent (cohabitation pré-5.7.1).
      map.set(rs.id, rs);
    } else {
      // Cas Phase 5.7.1 par défaut : adopt remote.* mais réinjecte
      // local.aiCache pour ne pas perdre le cache calculé localement.
      if (existing.aiCache !== undefined) {
        map.set(rs.id, { ...rs, aiCache: existing.aiCache });
      } else {
        map.set(rs.id, rs);
      }
    }
  }
  // Dedup by title+artist normalisé (Phase 2 helper). Même policy :
  // si conflit, garde la version au plus grand aiCache.sv (ou la 1ère
  // si égalité).
  const normStr = (x) => (x || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const byKey = new Map();
  const idRemap = {};
  for (const s of map.values()) {
    const key = `${normStr(s.title)}|||${normStr(s.artist)}`;
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, s); continue; }
    const psv = prev.aiCache && typeof prev.aiCache.sv === 'number' ? prev.aiCache.sv : 0;
    const ssv = s.aiCache && typeof s.aiCache.sv === 'number' ? s.aiCache.sv : 0;
    if (s.aiCache && (!prev.aiCache || ssv > psv)) {
      idRemap[prev.id] = s.id;
      byKey.set(key, s);
    } else {
      idRemap[s.id] = prev.id;
    }
  }
  const result = [...byKey.values()];
  result._idRemap = idRemap;
  return result;
}

// ─── makeDefaultProfile ──────────────────────────────────────────────
//
// Phase 5 (Item E) — le champ legacy `devices` (pedale, anniversary,
// plug) n'est plus créé. Le state v6 utilise uniquement
// `enabledDevices` comme source de vérité.
//
// Phase 7.48 — un nouveau profil non-admin démarre vierge (myGuitars=[],
// enabledDevices=[], availableSources tous false, banks vides). Le user
// configure son rig depuis Mon Profil. Wizard onboarding reporté à 7.50+.
// Le profil admin conserve les defaults Sébastien (rare, créé via
// migration historique uniquement).
function makeDefaultProfile(id, name, isAdmin = false, password = '') {
  const fallbackLang = _readGlobalLocale() || 'fr';
  if (isAdmin) {
    return {
      id, name, isAdmin, password,
      myGuitars: GUITARS.map((g) => g.id),
      customGuitars: [],
      editedGuitars: {},
      enabledDevices: ['tonex-anniversary', 'tonex-plug'],
      availableSources: { TSR: true, ML: true, Anniversary: true, Factory: true, ToneNET: true },
      customPacks: [],
      banksAnn: { ...INIT_BANKS_ANN },
      banksPlug: { ...INIT_BANKS_PLUG },
      tmpPatches: { custom: [], factoryOverrides: {} },
      aiProvider: 'gemini',
      aiKeys: { anthropic: '', gemini: '' },
      loginHistory: [],
      lastModified: Date.now(),
      // Phase 7.74.9 — timestamp dédié aux banks (0 = neutre, sera
      // stampé Date.now() à la première édition réelle via setProfileField).
      banksModified: 0,
      recoMode: 'balanced',
      guitarBias: {},
      // Phase 10 — contexte d'écoute (default 'frfr', cf OUTPUT_CONTEXTS).
      outputContext: DEFAULT_OUTPUT_CONTEXT,
      language: fallbackLang,
      isDemo: false,
    };
  }
  return {
    id, name, isAdmin, password,
    myGuitars: [],
    customGuitars: [],
    editedGuitars: {},
    enabledDevices: [],
    availableSources: {
      TSR: false, ML: false, Anniversary: false,
      Factory: false, FactoryV1: false, PlugFactory: false,
      ToneNET: false, custom: false,
    },
    customPacks: [],
    banksAnn: {},
    banksPlug: {},
    tmpPatches: { custom: [], factoryOverrides: {} },
    aiProvider: 'gemini',
    aiKeys: { anthropic: '', gemini: '' },
    loginHistory: [],
    lastModified: Date.now(),
    // Phase 7.74.9 — timestamp dédié aux banks (0 = neutre).
    banksModified: 0,
    recoMode: 'balanced',
    guitarBias: {},
    // Phase 10 — contexte d'écoute (default 'frfr', cf OUTPUT_CONTEXTS).
    outputContext: DEFAULT_OUTPUT_CONTEXT,
    language: fallbackLang,
    isDemo: false,
  };
}

// ─── Migrations ──────────────────────────────────────────────────────
function migrateV1toV2(v1) {
  const oldSetlists = (v1.setlists || INIT_SETLISTS).map((sl) => ({ ...sl, profileIds: ['sebastien'] }));
  const profile = {
    id: 'sebastien', name: 'Sébastien', isAdmin: true,
    myGuitars: GUITARS.map((g) => g.id),
    customGuitars: [],
    editedGuitars: {},
    devices: { pedale: false, anniversary: true, plug: true },
    availableSources: { TSR: true, ML: true, Anniversary: true, Factory: true, ToneNET: true },
    customPacks: [],
    banksAnn: mergeBanks(v1.banksAnn, INIT_BANKS_ANN),
    banksPlug: mergeBanks(v1.banksPlug, INIT_BANKS_PLUG),
    aiProvider: v1.aiProvider || 'gemini',
    aiKeys: v1.aiKeys || { anthropic: v1.apiKey || '', gemini: '' },
  };
  return {
    version: 2,
    activeProfileId: 'sebastien',
    shared: { songDb: v1.songDb || INIT_SONG_DB_META, theme: v1.theme || 'dark', setlists: oldSetlists },
    profiles: { sebastien: profile },
  };
}

// v2 → v3 : ajoute enabledDevices à chaque profil, dérivé depuis le
// champ legacy devices. Purement additif : aucun autre champ n'est
// modifié.
//
// Note d'idempotence : on délègue à ensureProfileV3, qui re-dérive
// uniquement si enabledDevices est absent. Donc appliquer
// migrateV2toV3 sur un état déjà v3 mais avec des profils incomplets
// (cas Firestore où la version locale a migré mais pas la version
// distante) heal les profils sans toucher à ceux déjà migrés.
function migrateV2toV3(v2) {
  return { ...v2, version: 3, profiles: ensureProfilesV3(v2.profiles) };
}

// v3 → v4 : ajoute tmpPatches à chaque profil. Purement additif. Les
// profils déjà au format v4 (tmpPatches présent et bien typé) sont
// préservés à l'identique via ensureProfileV4.
function migrateV3toV4(v3) {
  return { ...v3, version: 4, profiles: ensureProfilesV4(v3.profiles) };
}

// v5 → v6 (Phase 5 Item E) : drop le champ legacy profile.devices
// {pedale, anniversary, plug}. enabledDevices est désormais la seule
// source de vérité. La migration est defensive : si enabledDevices
// est absent (cas Firestore stale arrivé avec v3 partiel), on le
// dérive depuis devices avant de drop. Aucun autre champ touché.
//
// Phase 5.1 FIX 1 : délégué à ensureProfileV6 pour garantir que tous
// les call sites (loadState + Firestore poll via ensureProfilesV6)
// appliquent exactement le même heal. Le bug original venait du fait
// que migrateV5toV6 droppait `devices` au load, mais Firestore poll
// ré-injectait des profils v5 avec `devices` via ensureProfilesV4
// (qui ne droppait pas). On a maintenant un helper unique.
function migrateV5toV6(v5) {
  const profiles = { ...(v5.profiles || {}) };
  for (const id of Object.keys(profiles)) {
    let p = profiles[id];
    if (!p) continue;
    // Defensive : dérive enabledDevices si absent (avant le drop
    // pour ne pas perdre l'info).
    if (!Array.isArray(p.enabledDevices) || p.enabledDevices.length === 0) {
      p = { ...p, enabledDevices: deriveEnabledDevices(p.devices) };
    }
    // Drop devices via le helper unique.
    profiles[id] = ensureProfileV6(p);
  }
  return { ...v5, version: 6, profiles };
}

// v4 → v5 (Phase 4) : purement additif. Les nouveaux champs Phase 4
// (song.bpm, song.key, patch.scenes, patch.footswitchMap) sont tous
// optionnels et lus défensivement par les composants. Aucune
// transformation de données ; on bump uniquement la version pour
// signaler le schéma courant.
//
// Phase 4.1 (FIX B) : dedup défensif des setlists avec name +
// profileIds identiques. Si 2 setlists ont la même clé, on garde celle
// avec le plus de songs (et on fusionne les songIds des autres en
// union dédupliquée pour ne perdre aucun morceau pré-existant).
function migrateV4toV5(v4) {
  const next = { ...v4, version: 5 };
  if (v4.shared && Array.isArray(v4.shared.setlists)) {
    next.shared = { ...v4.shared, setlists: dedupSetlists(v4.shared.setlists) };
  }
  return next;
}

// FIX 4.1 B — dedup défensif des setlists.
// Clé de dédup : nom + profileIds (sortés, joinés par "|"). Pour chaque
// groupe :
//  - Garde la setlist avec le plus de songs (tiebreak : la 1ère en
//    ordre d'apparition).
//  - Fusionne les songIds des doublons en union dédupliquée et applique
//    cette union au survivant.
//  - Préserve les autres champs (guitars, sort) du survivant.
//
// Idempotent : si aucun doublon, retourne le même tableau (même ordre).
// Pure : ne mute pas les setlists d'entrée.
//
// Phase 5.4 — option `mergeAcrossProfiles` (default false) :
//  - false (mode strict, comportement Phase 4.1 inchangé) : clé =
//    name + profileIds. Deux setlists name identique mais profileIds
//    différents → considérées distinctes, pas fusionnées.
//  - true (mode aggressif) : clé = name uniquement. Le survivant
//    fusionne ses profileIds avec ceux des autres (union dédupliquée),
//    en plus des songIds.
// Le mode strict reste utilisé par la migration auto au load
// (migrateV4toV5) pour ne pas mélanger silencieusement des profils
// que l'utilisateur a sciemment séparés. Le mode aggressif est exposé
// via le bouton manuel "Fusionner doublons par nom" de MaintenanceTab.
function setlistDedupKey(sl, mergeAcrossProfiles = false) {
  if (mergeAcrossProfiles) return `${sl.name || ''}`;
  const ids = Array.isArray(sl.profileIds) ? [...sl.profileIds].sort().join('|') : '';
  return `${sl.name || ''}::${ids}`;
}

function dedupSetlists(setlists, options = {}) {
  const mergeAcrossProfiles = !!options.mergeAcrossProfiles;
  if (!Array.isArray(setlists)) return setlists;
  const groups = new Map();
  setlists.forEach((sl, idx) => {
    if (!sl || typeof sl.name !== 'string') return;
    const key = setlistDedupKey(sl, mergeAcrossProfiles);
    if (!groups.has(key)) groups.set(key, { items: [], firstIdx: idx });
    groups.get(key).items.push(sl);
  });
  if ([...groups.values()].every((g) => g.items.length === 1)) return setlists;
  // Construit la sortie en respectant l'ordre du 1er apparenté.
  const result = [];
  const consumed = new Set();
  setlists.forEach((sl, idx) => {
    if (consumed.has(idx)) return;
    const key = sl && typeof sl.name === 'string' ? setlistDedupKey(sl, mergeAcrossProfiles) : null;
    const grp = key ? groups.get(key) : null;
    if (!grp || grp.items.length === 1) {
      result.push(sl);
      consumed.add(idx);
      return;
    }
    // Trouve le survivant : plus grand songIds.length ; tiebreak idx
    // plus petit.
    let survivor = grp.items[0];
    let survivorLen = (survivor.songIds || []).length;
    for (let i = 1; i < grp.items.length; i++) {
      const cand = grp.items[i];
      const len = (cand.songIds || []).length;
      if (len > survivorLen) { survivor = cand; survivorLen = len; }
    }
    // Fusionne tous les songIds en union dédupliquée (préserve l'ordre
    // du survivant).
    const merged = [];
    const seen = new Set();
    const pushAll = (ids) => {
      for (const id of ids || []) {
        if (!seen.has(id)) { seen.add(id); merged.push(id); }
      }
    };
    pushAll(survivor.songIds);
    grp.items.forEach((sl2) => { if (sl2 !== survivor) pushAll(sl2.songIds); });
    const merged_entry = { ...survivor, songIds: merged };
    // Phase 5.4 — en mode mergeAcrossProfiles : fusionne aussi les
    // profileIds (union dédupliquée). Préserve l'ordre du survivant.
    if (mergeAcrossProfiles) {
      const profileIdsSeen = new Set();
      const mergedProfileIds = [];
      const pushProfileIds = (ids) => {
        for (const id of ids || []) {
          if (!profileIdsSeen.has(id)) { profileIdsSeen.add(id); mergedProfileIds.push(id); }
        }
      };
      pushProfileIds(survivor.profileIds);
      grp.items.forEach((sl2) => { if (sl2 !== survivor) pushProfileIds(sl2.profileIds); });
      if (mergedProfileIds.length > 0) merged_entry.profileIds = mergedProfileIds;
    }
    result.push(merged_entry);
    // Marque tous les items du groupe comme consommés.
    setlists.forEach((s2, i2) => {
      if (grp.items.includes(s2)) consumed.add(i2);
    });
  });
  return result;
}

// Phase 5.7.3 — Variante de dedupSetlists qui retourne aussi les ids
// à tombstoner. Indispensable pour propager les suppressions via
// Firestore en multi-device : sans tombstone, le device qui n'a pas
// encore dédupliqué re-push ses anciennes setlists par leurs ids
// originaux et les ressuscite sur le device qui avait fait le clean.
//
// Retourne { setlists, tombstones } où :
//   - setlists : tableau des survivants (= ce que dedupSetlists retourne)
//   - tombstones : { [losingId]: ts } prêt à merger dans
//                  shared.deletedSetlistIds via mergeDeletedSetlistIds.
//
// Ne touche pas à l'API de dedupSetlists existante (rétrocompat tests).
function dedupSetlistsWithTombstones(setlists, options = {}) {
  if (!Array.isArray(setlists)) return { setlists, tombstones: {} };
  const mergeAcrossProfiles = !!options.mergeAcrossProfiles;
  const ts = typeof options.ts === 'number' ? options.ts : Date.now();
  const groups = new Map();
  setlists.forEach((sl) => {
    if (!sl || typeof sl.name !== 'string') return;
    const key = setlistDedupKey(sl, mergeAcrossProfiles);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sl);
  });
  // Identifie le survivant de chaque groupe (même règle que dedupSetlists :
  // plus grand songIds.length, tiebreak idx min).
  const tombstones = {};
  groups.forEach((items) => {
    if (items.length <= 1) return;
    let survivor = items[0];
    let survivorLen = (survivor.songIds || []).length;
    for (let i = 1; i < items.length; i++) {
      const cand = items[i];
      const len = (cand.songIds || []).length;
      if (len > survivorLen) { survivor = cand; survivorLen = len; }
    }
    items.forEach((sl) => { if (sl !== survivor && sl.id) tombstones[sl.id] = ts; });
  });
  const survivors = dedupSetlists(setlists, options);
  return { setlists: survivors, tombstones };
}

// Phase 5.4 — helper d'investigation pour MaintenanceTab.
// Retourne les groupes de setlists ayant le même nom (peu importe
// profileIds). Pour chaque groupe avec ≥2 setlists, renvoie :
//   { name, items: [setlist...], profileIdsUnion: string[] }
// Utile à l'UI pour afficher un récap avant fusion.
function findSetlistDuplicatesByName(setlists) {
  if (!Array.isArray(setlists)) return [];
  const map = new Map();
  for (const sl of setlists) {
    if (!sl || typeof sl.name !== 'string') continue;
    if (!map.has(sl.name)) map.set(sl.name, []);
    map.get(sl.name).push(sl);
  }
  const groups = [];
  for (const [name, items] of map.entries()) {
    if (items.length < 2) continue;
    const profileIdsSet = new Set();
    for (const sl of items) {
      for (const id of sl.profileIds || []) profileIdsSet.add(id);
    }
    groups.push({ name, items, profileIdsUnion: [...profileIdsSet] });
  }
  return groups;
}

// ─── Phase 7.51.1 — Mode démo : helpers purs ───────────────────────────
//
// Le mode démo est un profil read-only public (id 'demo') chargé in-memory
// depuis un snapshot JSON bundlé. Tous les writes sont bloqués par un guard
// runtime (Phase 7.51.2). Le profil démo n'existe jamais dans localStorage
// ni dans Firestore.

// Retourne true si le profil est en mode démo (flag explicite uniquement,
// pas de truthy coercion : "true"/1 retournent false).
function isDemoProfile(profile) {
  return profile?.isDemo === true;
}

// Retourne true si le profil actuellement actif est en mode démo.
// `state` est le store global { profiles, activeProfileId, ... }.
function isDemoMode(state, activeProfileId) {
  if (!state || !state.profiles) return false;
  return isDemoProfile(state.profiles[activeProfileId]);
}

// Retourne le snapshot bundlé { version, profile, setlists, songs }.
// Le contenu est figé au build time ; l'app reload à chaque session
// visiteur recharge le même snapshot frais (pas de persistance).
function loadDemoSnapshot() {
  return demoSnapshot;
}

// Phase 7.51.4 — buildDemoSnapshot : construit un snapshot exportable
// depuis un profil curé. Utilisé par l'outil admin MaintenanceTab.
//
// Étapes :
// 1. Filtre les setlists dont profileIds inclut profile.id (les setlists
//    "appartenant" au profil curé).
// 2. Collecte les songIds de ces setlists.
// 3. Filtre allSongs pour ne garder que les songs référencées (préserve
//    aiCache complet, y compris trilingue).
// 4. Force le profil sortant : id='demo', name='Démo', isDemo:true,
//    isAdmin:false, password:null, aiKeys vidés, loginHistory vide.
// 5. Retourne { version: STATE_VERSION, profile, setlists, songs }.
//
// Note : le `profile.id` dans les setlists sortantes est aussi remappé
// à 'demo' pour cohérence (sinon le filtrage Phase 7.29.5 mySetlists ne
// trouverait pas les setlists du visiteur démo).
function buildDemoSnapshot(profile, allSetlists, allSongs) {
  if (!profile) return null;
  const origId = profile.id;
  const mySetlists = (allSetlists || []).filter((sl) => Array.isArray(sl.profileIds) && sl.profileIds.includes(origId));
  const songIds = new Set();
  mySetlists.forEach((sl) => (sl.songIds || []).forEach((id) => songIds.add(id)));
  const songs = (allSongs || []).filter((s) => s && songIds.has(s.id));
  // Phase 7.52.16 — Préserve l'id du curateur source dans profileIds en
  // plus de 'demo'. Sans ça (Phase 7.51.4 original), le snapshot écrit
  // profileIds=['demo'] uniquement. Quand le curateur ré-entre en mode
  // démo (enterDemoMode force override par id, Phase 7.52.14), la
  // setlist locale du curateur est écrasée par la version snapshot →
  // perd l'ownership curateur → invisible côté curateur après sortie
  // du mode démo. Solution : exporter avec les deux profileIds → le
  // curateur garde l'ownership, le profil démo bundlé garde l'accès
  // via 'demo' (filtre Phase 7.52.7 strict).
  const setlists = mySetlists.map((sl) => ({
    ...sl,
    profileIds: ['demo', origId],
  }));
  const cleanProfile = {
    ...profile,
    id: 'demo',
    name: 'Démo',
    isDemo: true,
    isAdmin: false,
    password: null,
    aiKeys: { anthropic: '', gemini: '' },
    loginHistory: [],
  };
  return {
    version: STATE_VERSION,
    profile: cleanProfile,
    setlists,
    songs,
  };
}

// Phase 7.51.2 — wrapDemoGuard : helper pur composant le runtime guard.
//
// Si `isDemo` est false, retourne `fn` tel quel (identité, zéro overhead).
// Si `isDemo` est true, retourne une fonction no-op qui notifie `onBlocked`
// avec le `label` du write tenté (utile pour le toast côté UI).
//
// Usage typique côté App :
//   const setProfilesGuarded = wrapDemoGuard(setProfiles, isDemo, showToast, 'profile');
//
// Le callback `onBlocked` est try/catch'é pour qu'une erreur dans le UI
// ne casse pas le flow d'appel (le no-op doit toujours retourner undefined
// sans crash).
function wrapDemoGuard(fn, isDemo, onBlocked, label) {
  if (!isDemo) return fn;
  return function blockedFn() {
    if (typeof onBlocked === 'function') {
      try { onBlocked(label || 'write'); } catch (e) { /* swallow */ }
    }
    return undefined;
  };
}

// Phase 7.51.2 — stripDemoProfiles : filtre les profils isDemo:true avant
// push Firestore. Symétrique à stripAiCacheForSync (Phase 5.7.1). Défense
// en profondeur : le profil démo (chargé in-memory) ne devrait JAMAIS être
// dans `state.profiles` d'un admin réel, mais si pour une raison X
// (réécriture in-memory, debug, import JSON), un profil isDemo:true s'y
// retrouve, on s'assure qu'il ne fuite pas dans Firestore.
function stripDemoProfiles(state) {
  if (!state || !state.profiles) return state;
  const out = { ...state, profiles: {} };
  for (const [id, p] of Object.entries(state.profiles)) {
    if (!isDemoProfile(p)) out.profiles[id] = p;
  }
  return out;
}

// Phase 7.52.9 — stripDemoFromSetlists : retire 'demo' du profileIds des
// setlists qui ne s'appellent pas "Demo Setlist". Bug observé 2026-05-16
// sur iPhone : la setlist "Cours Franck B" (Sébastien) avait
// profileIds: ['sebastien', 'arthur_*', 'demo'] → visible en mode démo
// car le filtre Phase 7.52.7 strict garde toutes setlists dont
// profileIds inclut 'demo'.
//
// Cause vraisemblable : à un moment, Sébastien a switché vers un profil
// curateur nommé 'demo' (avant Phase 7.51.4 qui renomme en
// demo_<timestamp>) et a fait des actions qui ont ajouté 'demo' aux
// profileIds via Phase 5.8 toggleSetlistProfile. La pollution a été
// syncée à Firestore puis tirée sur iPhone.
//
// Helper appliqué :
//  1) Au boot via loadState (heal localStorage existant) AVEC {stamp:false}
//     — Phase 7.52.10 fix : sans stamp au boot, sinon Mac+iPhone stampent
//     chacun à chaque boot → loop LWW infinie → sync cassée.
//  2) Avant push Firestore (saveToFirestore) AVEC {stamp:true} — défense
//     en profondeur, stamp pour que le LWW propage le clean.
function stripDemoFromSetlists(state, { stamp = true } = {}) {
  if (!state?.shared?.setlists) return state;
  const now = Date.now();
  const next = state.shared.setlists.map((sl) => {
    if (!sl || sl.name === 'Demo Setlist') return sl;
    if (!Array.isArray(sl.profileIds) || !sl.profileIds.includes('demo')) return sl;
    const cleaned = { ...sl, profileIds: sl.profileIds.filter((p) => p !== 'demo') };
    if (stamp) cleaned.lastModified = now;
    return cleaned;
  });
  return { ...state, shared: { ...state.shared, setlists: next } };
}

// ─── loadState / saveState ───────────────────────────────────────────
//
// Tous les paths passent par la chaîne complète v1→...→v7. Toutes les
// migrations sont idempotentes ; les appliquer même quand
// `version === STATE_VERSION` permet de heal d'éventuels profils
// incomplets (Firestore stale, import JSON, …). Phase 5.7 ajoute une
// passe `gcTombstones` finale (purge >30j) défensive.
function _runFullChain(d) {
  const v9 = migrateV8toV9(migrateV7toV8(migrateV6toV7(migrateV5toV6(migrateV4toV5(migrateV3toV4(d))))));
  // Phase 7.54 — v9 → v10 : aiCache per-profile.
  const v10 = migrateV9toV10(v9);
  // Phase 7.74.9 — v10 → v11 : timestamp dédié banks.
  const v11 = migrateV10toV11(v10);
  if (v11 && v11.shared && v11.shared.deletedSetlistIds) {
    v11.shared = { ...v11.shared, deletedSetlistIds: gcTombstones(v11.shared.deletedSetlistIds) };
  }
  // Phase 7.52.9 — Heal défensif au load : retire 'demo' des profileIds
  // des setlists non-démo (pollution Firestore historique, cf
  // stripDemoFromSetlists docstring).
  // Phase 7.52.10 fix : {stamp: false} → ne pas re-stamp lastModified
  // au boot. Sinon Mac+iPhone stamperaient chacun au boot → loop LWW
  // infinie → sync cassée. Le stamp se fait seulement au push Firestore
  // (saveToFirestore.prep) pour propager le clean correctement.
  return stripDemoFromSetlists(v11, { stamp: false });
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.version === STATE_VERSION) return _runFullChain(d);
      if (d.version === 10) return _runFullChain(d);
      if (d.version === 9) return _runFullChain(d);
      if (d.version === 8) return _runFullChain(d);
      if (d.version === 7) return _runFullChain(d);
      if (d.version === 6) return _runFullChain(d);
      if (d.version === 5) return _runFullChain(d);
      if (d.version === 4) return _runFullChain(d);
      if (d.version === 3) return _runFullChain(d);
      if (d.version === 2) return _runFullChain(migrateV2toV3(d));
    }
    const v1raw = localStorage.getItem(LS_KEY_V1);
    if (v1raw) return _runFullChain(migrateV2toV3(migrateV1toV2(JSON.parse(v1raw))));
  } catch (e) { /* ignore */ }
  return null;
}

function saveState(state) {
  autoBackup();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

// Phase 7.52.2 (B-TECH-02) — persistState avec retry-on-quota.
//
// Bug reproduit iPhone 2026-05-15 : modifs Mac (setlists + guitares) ne
// remontaient pas sur iPhone, malgré ☁️ vert. Cause : Phase 6.2 (MAX_BACKUPS=2)
// + Phase 7.52 (catalog Anniversary +232 KB) ont fait gonfler le state local
// au-delà du quota Safari iOS (~2 MB). autoBackup remplissait 2 × 1.5 MB →
// localStorage saturé → le setItem du state principal qui suit throw
// QuotaExceededError, **silently swallowed** par le `catch(e){}` historique
// (main.jsx:832). Au reload, iPhone récupère l'ancien state non muté.
//
// Fix : si quota au setItem state → purge agressive des backups + retry.
// Si toujours quota après purge → console.error LOUD (le caller peut afficher
// un toast). Retourne true si persist OK, false sinon.
function persistState(state) {
  let payload;
  try { payload = JSON.stringify(state); } catch (e) {
    console.error('persistState: JSON.stringify failed', e);
    return false;
  }
  try {
    localStorage.setItem(LS_KEY, payload);
    return true;
  } catch (e) {
    if (!isQuotaError(e)) {
      console.warn('persistState failed (non-quota):', e);
      return false;
    }
    // Quota saturé. Tentative de récupération : purge des backups (le state
    // principal est la priorité — un backup perdu est récupérable via
    // Firestore au prochain pull, alors qu'un state principal non persisté
    // signifie perte de modifications utilisateur).
    try { localStorage.removeItem(LS_BACKUP_KEY); } catch { /* ignore */ }
    try {
      localStorage.setItem(LS_KEY, payload);
      console.warn('persistState: recovered after purging backups (quota).');
      return true;
    } catch (e2) {
      // State principal lui-même plus gros que le quota disponible.
      // Rien à faire côté code — l'utilisateur doit nettoyer manuellement.
      console.error(
        'CRITICAL: persistState failed even after purging backups.',
        'State size:', payload.length, 'bytes.', e2,
      );
      return false;
    }
  }
}

// ─── Backups (rotation des 5 derniers, throttle 5 min) ───────────────
//
// FIX 4.1 C — robustesse au quota localStorage :
// - autoBackup gère QuotaExceededError sur setItem en supprimant le
//   plus ancien backup et en réessayant (max 3 retries). Si malgré
//   tout l'écriture échoue (le snapshot courant lui-même est plus
//   gros que tout le quota), on fail silencieusement plutôt que de
//   crasher l'app.
// - clearBackups supprime tous les backups (utile depuis MaintenanceTab).
function isQuotaError(e) {
  if (!e) return false;
  return e.name === 'QuotaExceededError'
    || e.code === 22
    || e.code === 1014 // Firefox
    || /quota/i.test(e.message || '');
}

function autoBackup() {
  try {
    const current = localStorage.getItem(LS_KEY);
    if (!current) return;
    const parsed = JSON.parse(current);
    if (!parsed?.shared?.songDb || parsed.shared.songDb.length < 1) return;
    const backups = JSON.parse(localStorage.getItem(LS_BACKUP_KEY) || '[]');
    const lastBackup = backups[0];
    if (lastBackup && Date.now() - lastBackup.time < 5 * 60 * 1000) return;
    backups.unshift({
      time: Date.now(),
      data: current,
      songs: parsed.shared.songDb.length,
      profiles: Object.keys(parsed.profiles || {}).length,
    });
    while (backups.length > MAX_BACKUPS) backups.pop();
    // Retry-on-quota : jusqu'à 3 fois, on supprime le plus ancien
    // backup et on retente. Garantit qu'on ne crashe jamais sur un
    // localStorage saturé — au pire le backup le plus récent est
    // perdu silencieusement.
    let attempt = 0;
    while (attempt < 3) {
      try {
        localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(backups));
        return;
      } catch (e) {
        if (!isQuotaError(e)) {
          console.warn('Backup failed (non-quota):', e);
          return;
        }
        if (backups.length <= 1) {
          // Plus rien à supprimer ; on abandonne sans rien casser.
          console.warn('Backup quota exceeded with single entry — skipping.');
          return;
        }
        backups.pop(); // supprime le plus ancien
        attempt += 1;
      }
    }
    console.warn('Backup quota exceeded after 3 retries — skipping snapshot.');
  } catch (e) { console.warn('Backup failed:', e); }
}

function listBackups() {
  try { return JSON.parse(localStorage.getItem(LS_BACKUP_KEY) || '[]'); } catch (e) { return []; }
}

function restoreBackup(index) {
  const backups = listBackups();
  if (!backups[index]) return false;
  localStorage.setItem(LS_KEY, backups[index].data);
  return true;
}

// FIX 4.1 C — vide explicitement la rotation. Utilisé par le bouton
// "Vider les backups" dans MaintenanceTab. Ne touche pas LS_KEY (les
// données utilisateurs courantes).
function clearBackups() {
  try { localStorage.removeItem(LS_BACKUP_KEY); return true; }
  catch (e) { return false; }
}

// Phase 7.59-A — Snapshots manuels (séparés des backups auto rotatifs).
//
// Stocké dans une clé localStorage distincte `tonex_guide_snapshots_manual`
// (vs `tonex_guide_backups` Phase 4.1 qui est rotation auto MAX_BACKUPS=1
// throttlée 5 min). Pas de limite hard, mais l'utilisateur peut en
// supprimer manuellement depuis MaintenanceTab.
//
// Cas d'usage : Sébastien fait une sauvegarde AVANT une opération risquée
// (pré-calcul beta, switch profil, import CSV, etc.) pour pouvoir
// restaurer en cas de pollution profil constatée (cas observé 2026-05-17
// où profile.sebastien.myGuitars a hérité de sire_t7/t3 issus de
// Francisco par un mécanisme inconnu, sans repro).
//
// Schéma stocké : array de { id, time, label, data }.
//   id : `manual-${Date.now()}-${rand}`
//   time : Date.now()
//   label : string fournie par user (max 60 chars), affichée dans la
//          liste pour identifier le snapshot
//   data : JSON.stringify(state) au moment du snapshot
const LS_MANUAL_SNAPSHOTS_KEY = 'tonex_guide_snapshots_manual';

function listManualSnapshots() {
  try { return JSON.parse(localStorage.getItem(LS_MANUAL_SNAPSHOTS_KEY) || '[]'); }
  catch { return []; }
}

function createManualSnapshot(label) {
  try {
    const current = localStorage.getItem(LS_KEY);
    if (!current) return { ok: false, error: 'no_state' };
    const snaps = listManualSnapshots();
    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const safeLabel = String(label || 'snapshot').slice(0, 60).trim() || 'snapshot';
    snaps.unshift({ id, time: Date.now(), label: safeLabel, data: current });
    localStorage.setItem(LS_MANUAL_SNAPSHOTS_KEY, JSON.stringify(snaps));
    return { ok: true, id };
  } catch (e) {
    if (isQuotaError(e)) return { ok: false, error: 'quota' };
    return { ok: false, error: e?.message || 'unknown' };
  }
}

function restoreManualSnapshot(id) {
  const snaps = listManualSnapshots();
  const snap = snaps.find((s) => s.id === id);
  if (!snap) return false;
  try { localStorage.setItem(LS_KEY, snap.data); return true; }
  catch { return false; }
}

function deleteManualSnapshot(id) {
  const snaps = listManualSnapshots();
  const next = snaps.filter((s) => s.id !== id);
  try { localStorage.setItem(LS_MANUAL_SNAPSHOTS_KEY, JSON.stringify(next)); return true; }
  catch { return false; }
}

// Phase 7.59-B — Sanity check au boot : détecte les guitar ids
// "orphelins" dans profile.myGuitars (ni dans GUITARS catalog, ni dans
// shared.customGuitars). Indique une pollution profile (cas observé
// 2026-05-17 : sire_t7/t3 dans profile.sebastien sans repro).
//
// Note : appelle avec le state + le catalog GUITARS importé du caller
// (évite import circulaire dans state.js qui ne doit pas dépendre de
// guitars.js metadata).
//
// Retourne array de warnings { profileId, profileName, orphanIds }.
// Phase 7.74.2 — Repair des orphans myGuitars.
//
// `validateProfileGuitars` (Phase 7.59-B) ne fait que LOG les orphans
// au boot pour diagnostic. Le user a observé un cas concret 2026-05-19 :
// `profile.myGuitars` contenait `cg_1778885069427` mais cette guitare
// n'existait nulle part (ni catalog standard, ni shared.customGuitars,
// ni profile.customGuitars). C'est un orphelin historique (probably
// guitare custom supprimée et re-créée avec un nouvel id) qui survit
// silencieusement dans myGuitars → UI affiche "rien" pour ce slot.
//
// Helper qui retire ces orphans + stamp lastModified pour propager
// le clean via sync. Appliqué AU BOOT après le 1er pull Firestore
// (gate firestoreLoaded dans main.jsx) pour éviter les faux positifs
// (cas où customGuitars sera disponible une fois le pull terminé).
//
// Différence vs validateProfileGuitars : ce helper DROPPE aussi les
// ids `cg_*` qui ne sont nulle part (vs validateProfileGuitars qui
// les considère "soft orphans légitimes" — c'était trop permissif,
// Phase 7.74.2 force la rigueur).
//
// Retourne { state, repairs } :
//  - state : nouveau state avec profiles nettoyés (immutable, ===
//    input state si aucun repair)
//  - repairs : Array<{profileId, profileName, removed: string[]}>
function repairProfileGuitarsOrphans(state, guitarsCatalog) {
  if (!state || !state.profiles) return { state, repairs: [] };
  const sharedCustomIds = new Set((state.shared?.customGuitars || []).map((g) => g.id));
  const catalogIds = new Set((guitarsCatalog || []).map((g) => g.id));
  const repairs = [];
  let mutated = false;
  const nextProfiles = {};
  for (const [pid, p] of Object.entries(state.profiles)) {
    if (!p || !Array.isArray(p.myGuitars)) {
      nextProfiles[pid] = p;
      continue;
    }
    const profileCustomIds = new Set((p.customGuitars || []).map((g) => g.id));
    const orphans = [];
    const cleanMyGuitars = [];
    for (const gid of p.myGuitars) {
      if (catalogIds.has(gid)) { cleanMyGuitars.push(gid); continue; }
      if (sharedCustomIds.has(gid)) { cleanMyGuitars.push(gid); continue; }
      if (profileCustomIds.has(gid)) { cleanMyGuitars.push(gid); continue; }
      orphans.push(gid);
    }
    if (orphans.length > 0) {
      mutated = true;
      nextProfiles[pid] = { ...p, myGuitars: cleanMyGuitars, lastModified: Date.now() };
      repairs.push({ profileId: pid, profileName: p.name || pid, removed: orphans });
    } else {
      nextProfiles[pid] = p;
    }
  }
  if (!mutated) return { state, repairs: [] };
  return { state: { ...state, profiles: nextProfiles }, repairs };
}

function validateProfileGuitars(state, guitarsCatalog) {
  if (!state || !state.profiles) return [];
  const sharedCustomIds = new Set((state.shared?.customGuitars || []).map((g) => g.id));
  const catalogIds = new Set((guitarsCatalog || []).map((g) => g.id));
  const warnings = [];
  for (const [pid, p] of Object.entries(state.profiles)) {
    if (!p || !Array.isArray(p.myGuitars)) continue;
    // Profile customGuitars (legacy v3-)
    const profileCustomIds = new Set((p.customGuitars || []).map((g) => g.id));
    const orphans = [];
    for (const gid of p.myGuitars) {
      if (catalogIds.has(gid)) continue;
      if (sharedCustomIds.has(gid)) continue;
      if (profileCustomIds.has(gid)) continue;
      // Phase 7.59.1 — Skip les `cg_*` device-local non-migrés. Ces
      // customGuitars créées sur un autre device peuvent légitimement
      // vivre dans myGuitars sans être dans shared.customGuitars du
      // device courant — la metadata (image, nom, marque) reste sur le
      // device d'origine, et la propagation via sync ne couvre pas
      // toujours customGuitars (notamment quand cg_* créé après une
      // migration Phase 7.x qui consolide shared.customGuitars).
      // Conséquence : ces ids sont des "soft orphans" légitimes, pas
      // des pollutions. Skip pour éviter le bruit.
      if (typeof gid === 'string' && gid.startsWith('cg_')) continue;
      orphans.push(gid);
    }
    if (orphans.length > 0) {
      warnings.push({ profileId: pid, profileName: p.name || pid, orphanIds: orphans });
    }
  }
  return warnings;
}

// ─── Secrets (clés API, jamais syncés) ───────────────────────────────
function loadSecrets() {
  try { return JSON.parse(localStorage.getItem(LS_SECRETS_KEY)) || {}; } catch (e) { return {}; }
}

function saveSecrets(secrets) {
  try { localStorage.setItem(LS_SECRETS_KEY, JSON.stringify(secrets)); } catch (e) { /* ignore */ }
}

// ─── Trusted devices (par device, jamais syncés) ─────────────────────
function loadTrusted() {
  try { return JSON.parse(localStorage.getItem(LS_TRUSTED_KEY)) || {}; } catch (e) { return {}; }
}

function isTrusted(id) { return !!loadTrusted()[id]; }

function setTrusted(id, v) {
  const t = loadTrusted();
  if (v) t[id] = true; else delete t[id];
  try { localStorage.setItem(LS_TRUSTED_KEY, JSON.stringify(t)); } catch (e) { /* ignore */ }
}

// ─── All-rigs guitar union (Phase 3.6) ───────────────────────────────
// Union des guitares de TOUS les profils (standard + customs partagés).
// Utilisé par le mécanisme passif de re-fetch IA pour que la liste de
// guitares poussée au prompt couvre la collection complète de la
// famille (Sébastien + Arthur + Franck...) plutôt que seulement le
// profil actif. Conséquence : `cot_step2_guitars` dans aiCache contient
// des entrées pour TOUTES les guitares de la maison, et un profil
// non-admin (Arthur, Franck) voit ses guitares custom prises en compte
// dès la première ouverture d'un morceau sans avoir à déclencher un
// recalcul lui-même.
//
// Pas d'éditions per-profile (editedGuitars) : une guitare est
// identifiée par son id canonique. Si un profil a édité localement le
// nom d'une guitare standard, c'est l'objet brut de GUITARS qui sera
// envoyé au prompt (pas la version éditée). Acceptable Phase 3.6.
// Phase 5.8 — Toggle d'un profileId dans une setlist (partage multi-profils).
// Le profil actif ne peut JAMAIS être retiré (garde-fou : sinon l'utilisateur
// se ferait disparaître la setlist sous les yeux). Si retirer le dernier
// profileId rendrait la setlist orpheline, on force activeProfileId à rester.
//
// Retourne un nouveau setlist (immutable) avec lastModified stamped pour le
// LWW Firestore. Si pas de modif (toggle bloqué par garde-fou), retourne le
// setlist d'origine intact (référence préservée).
function toggleSetlistProfile(setlist, profileId, activeProfileId) {
  if (!setlist || !profileId) return setlist;
  const currentIds = Array.isArray(setlist.profileIds) ? [...setlist.profileIds] : [];
  const has = currentIds.includes(profileId);
  // Garde-fou : interdire le retrait de soi-même
  if (has && profileId === activeProfileId) return setlist;
  let newIds;
  if (has) {
    newIds = currentIds.filter((id) => id !== profileId);
    // Assure que activeProfileId reste dans la liste si on l'a vidée
    if (newIds.length === 0 && activeProfileId) newIds.push(activeProfileId);
  } else {
    newIds = [...currentIds, profileId];
  }
  return { ...setlist, profileIds: newIds, lastModified: Date.now() };
}

// Phase 5.7.2 — Helpers purs pour la migration Newzik (one-shot import des
// setlists "Cours Franck B" / "Arthur & Seb" / merge "Nouvelle setlist" →
// "Ma Setlist"). Extraits pour permettre des tests régression sans monter
// le composant App.
//
// Le guard original ("idempotent per setlist name") était cassé : la
// migration s'exécutait dans un useEffect avec dep [] AVANT que
// loadFromFirestore réponde, donc le local fraîchement vide ne contenait
// aucune setlist et la migration recréait tout. Sur l'iPhone fraîchement
// nettoyé, Firestore ramenait ensuite les vraies setlists de Sébastien,
// créant des doublons par profileIds divergents.
//
// Nouvelle politique : skip si une setlist du même nom existe DÉJÀ (peu
// importe les profileIds). Le caller doit aussi gate sur firestoreLoaded
// pour laisser le poll Firestore peupler le state avant le check.
function computeNewzikCreateNames(setlists, listKeys, mergeInto) {
  if (!Array.isArray(setlists) || !Array.isArray(listKeys)) return [];
  const map = mergeInto || {};
  const existing = new Set((setlists || []).map((sl) => sl && sl.name).filter(Boolean));
  return listKeys.filter((n) => {
    if (map[n]) return false;       // c'est un merge, pas un create
    if (existing.has(n)) return false; // déjà présente
    return true;
  });
}

function computeNewzikMergeNames(setlists, mergeInto) {
  if (!Array.isArray(setlists) || !mergeInto) return [];
  return Object.keys(mergeInto).filter((srcName) => {
    // Skip si on a déjà marqué le merge comme fait (suffix legacy)
    if (setlists.some((sl) => sl && sl.name === srcName + '__merged')) return false;
    // Skip si la source n'existe pas (déjà mergée ou jamais créée)
    if (!setlists.some((sl) => sl && sl.name === srcName)) return false;
    return true;
  });
}

// Phase 7.7 — Dérive un biais guitare/style à partir des morceaux feedbackés.
// Pour chaque song avec feedback[].length > 0 et aiCache.result.song_style +
// ideal_guitar définis, on tally (style → guitarId) en résolvant le nom IA via
// findGuitarByAIName. Si un (style, guitarId) atteint le seuil (3 par défaut),
// il est retenu dans le bias. Tie-break déterministe : plus grand count, puis
// guitarId alpha. Retourne { [style]: { guitarId, guitarName, count } }.
// Pur, testable, idempotent.
function computeGuitarBiasFromFeedback(songDb, guitars, threshold = 3) {
  if (!Array.isArray(songDb) || !Array.isArray(guitars) || guitars.length === 0) return {};
  const tally = {};
  songDb.forEach((s) => {
    if (!s || !Array.isArray(s.feedback) || s.feedback.length === 0) return;
    const result = s.aiCache && s.aiCache.result;
    if (!result) return;
    const style = result.song_style;
    const idealName = result.ideal_guitar;
    if (!style || !idealName) return;
    const matched = findGuitarByAIName(idealName, guitars);
    if (!matched) return;
    if (!tally[style]) tally[style] = {};
    tally[style][matched.id] = (tally[style][matched.id] || 0) + 1;
  });
  const out = {};
  Object.entries(tally).forEach(([style, byGuitar]) => {
    const sorted = Object.entries(byGuitar).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] < b[0] ? -1 : 1;
    });
    const [topId, topCount] = sorted[0] || [null, 0];
    if (topCount >= threshold && topId) {
      const g = guitars.find((x) => x.id === topId);
      out[style] = { guitarId: topId, guitarName: g ? g.name : topId, count: topCount };
    }
  });
  return out;
}

// Phase 7.9 — Merge le bias auto-dérivé (Phase 7.7) avec les overrides
// manuels (profile.guitarBias = { [style]: guitarId }). Les overrides
// manuels gagnent toujours. Si l'utilisateur a explicitement écrit un
// guitarId, on l'utilise même si le auto-dérivé propose autre chose.
// Une entry manuelle dont la guitare n'existe plus dans le rig est
// ignorée (id stale). count: null marque les entries manuelles. Pur,
// testable.
function mergeGuitarBias(autoBias, manualBias, guitars) {
  const out = {};
  const autoObj = autoBias && typeof autoBias === 'object' ? autoBias : {};
  const manualObj = manualBias && typeof manualBias === 'object' ? manualBias : {};
  const guitarsArr = Array.isArray(guitars) ? guitars : [];
  // 1) Auto entries d'abord (source: 'auto').
  Object.entries(autoObj).forEach(([style, entry]) => {
    if (!entry || !entry.guitarId) return;
    const g = guitarsArr.find((x) => x.id === entry.guitarId);
    if (!g) return;
    out[style] = {
      guitarId: entry.guitarId,
      guitarName: entry.guitarName || g.name,
      count: typeof entry.count === 'number' ? entry.count : null,
      source: 'auto',
    };
  });
  // 2) Manual overrides écrasent (source: 'manual', count: null).
  Object.entries(manualObj).forEach(([style, guitarId]) => {
    if (!guitarId) return;
    const g = guitarsArr.find((x) => x.id === guitarId);
    if (!g) return;
    out[style] = { guitarId, guitarName: g.name, count: null, source: 'manual' };
  });
  return out;
}

// Phase 7.22 — applySecrets : injecte aiKeys + password depuis le store
// localStorage local (LS_SECRETS_KEY) sur les profils chargés (initialement
// depuis localStorage state ou Firestore remote). Les secrets restent
// device-local et ne sont jamais sync via Firestore.
function applySecrets(profiles) {
  const secrets = loadSecrets();
  const result = { ...profiles };
  for (const [id, p] of Object.entries(result)) {
    const s = secrets[id] || {};
    result[id] = {
      ...p,
      aiKeys: (s.aiKeys && (s.aiKeys.gemini || s.aiKeys.anthropic)) ? s.aiKeys : (p.aiKeys || { anthropic: '', gemini: '' }),
      password: s.password ? s.password : (p.password || ''),
    };
  }
  return result;
}

// Phase 7.20 — Dédup songDb par id. Anciennes migrations Newzik et collisions
// Date.now() sur ajouts simultanés ont laissé des doublons (`c_1778428303600_jch2`,
// `c_1778309153614_ined`). Le fix défensif Phase 7.17 est au rendering ; ce
// helper nettoie la source à la demande (bouton MaintenanceTab).
//
// Garde le premier de chaque id, mais merge defensively :
// - aiCache : garde le plus riche (sv le plus récent OU avec result.cot_step1
//   présent OU non-null si l'autre est null).
// - feedback : union dédoublonnée par (text, ts).
// - autres champs : on garde ceux du premier rencontré (canonical).
//
// Retourne { songs, removed } où `removed` est le nombre de doublons supprimés.
function dedupSongDb(songDb) {
  if (!Array.isArray(songDb)) return { songs: [], removed: 0 };
  const seen = new Map();
  let removed = 0;
  for (const s of songDb) {
    if (!s || !s.id) continue;
    const existing = seen.get(s.id);
    if (!existing) {
      seen.set(s.id, { ...s });
      continue;
    }
    removed++;
    // Merge aiCache : richer wins (presence > null, higher sv, presence of cot_step1).
    const richness = (c) => {
      if (!c) return 0;
      let r = 1;
      if (c.result?.cot_step1) r += 2;
      if (typeof c.sv === 'number') r += c.sv;
      return r;
    };
    if (richness(s.aiCache) > richness(existing.aiCache)) {
      existing.aiCache = s.aiCache;
    }
    // Merge feedback : union par (text, ts).
    const fbExisting = Array.isArray(existing.feedback) ? existing.feedback : [];
    const fbIncoming = Array.isArray(s.feedback) ? s.feedback : [];
    if (fbIncoming.length) {
      const key = (f) => `${f.text || ''}|${f.ts || 0}`;
      const seenKeys = new Set(fbExisting.map(key));
      const merged = [...fbExisting];
      for (const f of fbIncoming) {
        if (!seenKeys.has(key(f))) { merged.push(f); seenKeys.add(key(f)); }
      }
      existing.feedback = merged;
    }
  }
  return { songs: [...seen.values()], removed };
}

function getAllRigsGuitars(profiles, customGuitars, allStandardGuitars) {
  const std = allStandardGuitars || GUITARS;
  if (!profiles || typeof profiles !== 'object') return [...std];
  const idSet = new Set();
  Object.values(profiles).forEach((p) => {
    if (p && Array.isArray(p.myGuitars)) {
      p.myGuitars.forEach((id) => idSet.add(id));
    }
  });
  const standards = std.filter((g) => idSet.has(g.id));
  const customs = (customGuitars || []).filter((g) => g && idSet.has(g.id));
  return [...standards, ...customs];
}

// Phase 7.63 — Sécurité admin-switch profil.
//
// Quand un admin (Sébastien) clique sur un autre profil dans le
// ProfileSelector dropdown, on tracke l'origine admin via sessionStorage
// (clé ADMIN_ORIGIN_KEY) et on push une entry `{type: 'admin_switch'}`
// dans `profile.loginHistory` du profil cible. Le beta-testeur garde la
// trace de l'accès admin sur son profil (transparence). Le banner UI
// `AdminAsBanner` (mode "Connecté en tant que X") s'affiche tant que
// sessionStorage tonex_admin_origin est posé.
//
// loginHistory accepte désormais 2 formats par entry :
//   - number (timestamp) : login normal (Phase 5.7+, format historique)
//   - object {type: 'admin_switch', ts, adminId, adminName} : Phase 7.63
// La UI loginHistory display gère les 2 formats.

const ADMIN_ORIGIN_KEY = 'tonex_admin_origin';

// Push une entry admin_switch dans loginHistory du profil target.
// Pure : retourne un nouvel objet profiles, ne mute pas l'original.
// adminProfile : { id, name } — le profil admin d'origine au moment du switch.
function recordAdminSwitch(profiles, targetId, adminProfile) {
  if (!profiles || !profiles[targetId] || !adminProfile?.id) return profiles;
  const target = profiles[targetId];
  const h = Array.isArray(target.loginHistory) ? target.loginHistory.slice() : [];
  h.unshift({
    type: 'admin_switch',
    ts: Date.now(),
    adminId: adminProfile.id,
    adminName: adminProfile.name || adminProfile.id,
  });
  // Phase 7.63 : cap à 10 entries (5 historique Phase 5.7 + marge pour
  // admin_switch). Les entries plus anciennes sont écartées.
  if (h.length > 10) h.length = 10;
  return {
    ...profiles,
    [targetId]: { ...target, loginHistory: h, lastModified: Date.now() },
  };
}

// Phase 7.74.7 — Push un timestamp de login dans loginHistory du profil
// `id`. Pure : retourne un nouvel objet profiles, ne mute pas l'original.
//
// ⚠ Ne touche PAS `lastModified` — c'était le cœur de la pollution
// profile (6 occurrences, mai 2026). L'ancien `recordLogin` re-stampait
// `lastModified = Date.now()` à CHAQUE boot/login. Comme un login ne
// change aucune donnée du profil, ce stamp rendait gratuitement le
// profil "le plus récent" pour le LWW : un appareil au contenu périmé,
// simplement rechargé, gagnait le merge et propageait son état stale.
// loginHistory est exclu du syncHash (Phase 7.46) — il se propage quand
// un AUTRE champ déclenche un push, jamais tout seul. C'est voulu : un
// login ne mérite pas un push.
function appendLoginEntry(profiles, id) {
  if (!profiles || !profiles[id]) return profiles;
  const cur = profiles[id];
  const h = Array.isArray(cur.loginHistory) ? cur.loginHistory.slice() : [];
  h.unshift(Date.now());
  if (h.length > 5) h.length = 5;
  return { ...profiles, [id]: { ...cur, loginHistory: h } };
}

// True si l'admin est actuellement connecté sur un profil ≠ son propre id.
// `adminOriginId` vient typiquement de sessionStorage.tonex_admin_origin
// (posé par switchProfile dans main.jsx). On valide qu'il pointe bien sur
// un profil ADMIN existant — sinon false (cas defensive : session corrompue
// ou profil admin supprimé entre temps).
function isAdminAsMode(profiles, activeProfileId, adminOriginId) {
  if (!adminOriginId || !activeProfileId) return false;
  if (adminOriginId === activeProfileId) return false;
  const origin = profiles?.[adminOriginId];
  if (!origin?.isAdmin) return false;
  return true;
}

// Phase 10 (2026-05-21) — Contexte d'écoute par profil + override par
// morceau. 3 valeurs simplifiées : `frfr` / `headphone` / `pa`. Tous
// impliquent CAB activated (pas de cab physique aval). Le toggle
// `cab_enabled` de preset_settings_v1 (Phase 9.1) est dicté
// indépendamment par la CAPTURE choisie (AMP+CAB → CAB off, AMP-only →
// CAB on), pas par le contexte d'écoute.
//
// Décision design 2026-05-21 (v2) : supprimé `ampWithCab` + `ampNoCab`.
// Cas marginaux que Sébastien ne rencontre pas en pratique (Sébastien
// joue FRFR, ses beta-testeurs aussi). Reportée Phase 10.1 future si
// signal user : enrichir `PRESET_CATALOG_MERGED` avec flag `hasCab` pour
// que l'IA décide cab_enabled de manière 100% déterministe selon la
// capture choisie (vs heuristique actuelle).
//
// Identifiants anglais sobres ; labels affichables côté UI via i18n.
// Default 'frfr' = config la plus courante utilisateurs ToneX.
const OUTPUT_CONTEXTS = ['headphone', 'frfr', 'pa'];
const DEFAULT_OUTPUT_CONTEXT = 'frfr';

// Pure helper : retourne le contexte effectif pour un morceau donné.
// Priorité song.outputContext (override) > profile.outputContext > default
// 'frfr'. Defensive face aux valeurs invalides (legacy / fresh profile /
// migration depuis Phase 10 v1 qui avait ampWithCab/ampNoCab).
function getEffectiveOutputContext(profile, song) {
  const songCtx = song?.outputContext;
  if (songCtx && OUTPUT_CONTEXTS.includes(songCtx)) return songCtx;
  const profileCtx = profile?.outputContext;
  if (profileCtx && OUTPUT_CONTEXTS.includes(profileCtx)) return profileCtx;
  return DEFAULT_OUTPUT_CONTEXT;
}

export {
  OUTPUT_CONTEXTS, DEFAULT_OUTPUT_CONTEXT, getEffectiveOutputContext,
  ADMIN_ORIGIN_KEY, recordAdminSwitch, isAdminAsMode, appendLoginEntry,
  STATE_VERSION, TOMBSTONE_MAX_AGE_MS,
  LS_KEY, LS_KEY_V1, LS_SECRETS_KEY, LS_TRUSTED_KEY, LS_BACKUP_KEY, MAX_BACKUPS,
  mergeBanks, deriveEnabledDevices, getDevicesForRender,
  ensureProfileV3, ensureProfilesV3,
  ensureProfileV4, ensureProfilesV4,
  ensureProfileV6, ensureProfilesV6,
  ensureSharedV7, ensureProfileV7, ensureProfilesV7,
  ensureProfileV8, ensureProfilesV8, migrateV7toV8,
  ensureProfileV9, ensureProfilesV9, migrateV8toV9,
  isDemoProfile, isDemoMode, loadDemoSnapshot, buildDemoSnapshot,
  wrapDemoGuard, stripDemoProfiles, stripDemoFromSetlists,
  gcTombstones,
  mergeDeletedSetlistIds, mergeSetlistsLWW, mergeProfilesLWW, mergeProfileLWW,
  mergeToneNetPresetsLWW, mergeDeletedToneNetIds,
  stampedProfileUpdate,
  ensureProfileV10, ensureProfilesV10, migrateV9toV10, getProfileAiCache,
  ensureProfileV11, ensureProfilesV11, migrateV10toV11,
  stripAiCacheForSync, mergeSongDbPreservingLocalAiCache,
  computeNewzikCreateNames, computeNewzikMergeNames,
  toggleSetlistProfile,
  makeDefaultProfile,
  migrateV1toV2, migrateV2toV3, migrateV3toV4, migrateV4toV5, migrateV5toV6, migrateV6toV7,
  dedupSetlists, dedupSetlistsWithTombstones, setlistDedupKey, findSetlistDuplicatesByName,
  loadState, saveState, persistState,
  autoBackup, listBackups, restoreBackup, clearBackups, isQuotaError,
  createManualSnapshot, listManualSnapshots, restoreManualSnapshot, deleteManualSnapshot,
  validateProfileGuitars, repairProfileGuitarsOrphans,
  loadSecrets, saveSecrets,
  loadTrusted, isTrusted, setTrusted,
  getAllRigsGuitars,
  computeGuitarBiasFromFeedback,
  mergeGuitarBias,
  dedupSongDb,
  applySecrets,
};
