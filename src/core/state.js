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
const STATE_VERSION = 9;
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
function mergeProfilesLWW(localProfiles, remoteProfiles, options = {}) {
  const local = localProfiles && typeof localProfiles === 'object' ? localProfiles : {};
  const remote = remoteProfiles && typeof remoteProfiles === 'object' ? remoteProfiles : {};
  const applySecrets = typeof options.applySecrets === 'function' ? options.applySecrets : null;
  const out = {};
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const id of ids) {
    const lp = local[id];
    const rp = remote[id];
    if (lp && rp) {
      const lts = typeof lp.lastModified === 'number' ? lp.lastModified : 0;
      const rts = typeof rp.lastModified === 'number' ? rp.lastModified : 0;
      if (rts > lts) {
        const adopted = applySecrets ? applySecrets({ [id]: rp })[id] : rp;
        out[id] = ensureProfileV9(adopted);
      } else {
        out[id] = ensureProfileV9(lp);
      }
    } else if (lp) {
      out[id] = ensureProfileV9(lp);
    } else if (rp) {
      const adopted = applySecrets ? applySecrets({ [id]: rp })[id] : rp;
      out[id] = ensureProfileV9(adopted);
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
function stripAiCacheForSync(state) {
  if (!state || typeof state !== 'object') return state;
  const shared = state.shared;
  if (!shared || !Array.isArray(shared.songDb)) return state;
  const lightSongs = shared.songDb.map((s) => {
    if (!s || typeof s !== 'object') return s;
    if (!('aiCache' in s)) return s;
    const { aiCache, ...rest } = s;
    return rest;
  });
  return { ...state, shared: { ...shared, songDb: lightSongs } };
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
function mergeSongDbPreservingLocalAiCache(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const map = new Map(local.map((s) => [s.id, s]));
  for (const rs of remote) {
    if (!rs || !rs.id) continue;
    const existing = map.get(rs.id);
    if (!existing) {
      map.set(rs.id, rs); // remote-only
      continue;
    }
    const rsv = rs.aiCache && typeof rs.aiCache.sv === 'number' ? rs.aiCache.sv : 0;
    const lsv = existing.aiCache && typeof existing.aiCache.sv === 'number' ? existing.aiCache.sv : 0;
    if (rs.aiCache && (!existing.aiCache || rsv > lsv)) {
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
      recoMode: 'balanced',
      guitarBias: {},
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
    recoMode: 'balanced',
    guitarBias: {},
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
  // Remappe profileIds vers 'demo' dans les setlists sortantes.
  const setlists = mySetlists.map((sl) => ({
    ...sl,
    profileIds: ['demo'],
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
  if (v9 && v9.shared && v9.shared.deletedSetlistIds) {
    v9.shared = { ...v9.shared, deletedSetlistIds: gcTombstones(v9.shared.deletedSetlistIds) };
  }
  // Phase 7.52.9 — Heal défensif au load : retire 'demo' des profileIds
  // des setlists non-démo (pollution Firestore historique, cf
  // stripDemoFromSetlists docstring).
  // Phase 7.52.10 fix : {stamp: false} → ne pas re-stamp lastModified
  // au boot. Sinon Mac+iPhone stamperaient chacun au boot → loop LWW
  // infinie → sync cassée. Le stamp se fait seulement au push Firestore
  // (saveToFirestore.prep) pour propager le clean correctement.
  return stripDemoFromSetlists(v9, { stamp: false });
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.version === STATE_VERSION) return _runFullChain(d);
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

export {
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
  mergeDeletedSetlistIds, mergeSetlistsLWW, mergeProfilesLWW,
  stripAiCacheForSync, mergeSongDbPreservingLocalAiCache,
  computeNewzikCreateNames, computeNewzikMergeNames,
  toggleSetlistProfile,
  makeDefaultProfile,
  migrateV1toV2, migrateV2toV3, migrateV3toV4, migrateV4toV5, migrateV5toV6, migrateV6toV7,
  dedupSetlists, dedupSetlistsWithTombstones, setlistDedupKey, findSetlistDuplicatesByName,
  loadState, saveState, persistState,
  autoBackup, listBackups, restoreBackup, clearBackups, isQuotaError,
  loadSecrets, saveSecrets,
  loadTrusted, isTrusted, setTrusted,
  getAllRigsGuitars,
  computeGuitarBiasFromFeedback,
  mergeGuitarBias,
  dedupSongDb,
  applySecrets,
};
