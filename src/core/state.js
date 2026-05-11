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
import { INIT_SONG_DB_META } from './songs.js';
import { INIT_SETLISTS } from './setlists.js';
import {
  INIT_BANKS_ANN, FACTORY_BANKS_PEDALE,
  INIT_BANKS_PLUG, FACTORY_BANKS_PLUG,
} from '../data/data_catalogs.js';

// ─── Versioning + clés localStorage ──────────────────────────────────
const STATE_VERSION = 7;
const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const LS_KEY = 'tonex_guide_v2';        // nom historique stable
const LS_KEY_V1 = 'tonex_guide_v1';
const LS_SECRETS_KEY = 'tonex_secrets';
const LS_TRUSTED_KEY = 'tonex_trusted_devices';
const LS_BACKUP_KEY = 'tonex_guide_backups';
const MAX_BACKUPS = 5;

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
        out[id] = ensureProfileV7(adopted);
      } else {
        out[id] = ensureProfileV7(lp);
      }
    } else if (lp) {
      out[id] = ensureProfileV7(lp);
    } else if (rp) {
      const adopted = applySecrets ? applySecrets({ [id]: rp })[id] : rp;
      out[id] = ensureProfileV7(adopted);
    }
  }
  return out;
}

// ─── makeDefaultProfile ──────────────────────────────────────────────
//
// Phase 5 (Item E) — le champ legacy `devices` (pedale, anniversary,
// plug) n'est plus créé. Le state v6 utilise uniquement
// `enabledDevices` comme source de vérité. Les profils v5 et antérieurs
// sont migrés via migrateV5toV6 qui drop le champ.
function makeDefaultProfile(id, name, isAdmin = false, password = '') {
  // Defaults v3 : admin = Anniversary + Plug (Sébastien) ; standard
  // utilisateur = Pedal + Plug (defaultEnabled du registry).
  const enabledDevices = isAdmin
    ? ['tonex-anniversary', 'tonex-plug']
    : ['tonex-pedal', 'tonex-plug'];
  return {
    id, name, isAdmin, password,
    myGuitars: GUITARS.map((g) => g.id),
    customGuitars: [],
    editedGuitars: {},
    enabledDevices,
    availableSources: { TSR: true, ML: true, Anniversary: true, Factory: true, ToneNET: true },
    customPacks: [],
    banksAnn: isAdmin ? { ...INIT_BANKS_ANN } : { ...FACTORY_BANKS_PEDALE },
    banksPlug: isAdmin ? { ...INIT_BANKS_PLUG } : { ...FACTORY_BANKS_PLUG },
    // Phase 3 (v4) : Tone Master Pro patches custom + overrides factory.
    tmpPatches: { custom: [], factoryOverrides: {} },
    aiProvider: 'gemini',
    aiKeys: { anthropic: '', gemini: '' },
    loginHistory: [],
    // Phase 5.7 — last-write-wins per-profile.
    lastModified: Date.now(),
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

// ─── loadState / saveState ───────────────────────────────────────────
//
// Tous les paths passent par la chaîne complète v1→...→v7. Toutes les
// migrations sont idempotentes ; les appliquer même quand
// `version === STATE_VERSION` permet de heal d'éventuels profils
// incomplets (Firestore stale, import JSON, …). Phase 5.7 ajoute une
// passe `gcTombstones` finale (purge >30j) défensive.
function _runFullChain(d) {
  const v7 = migrateV6toV7(migrateV5toV6(migrateV4toV5(migrateV3toV4(d))));
  if (v7 && v7.shared && v7.shared.deletedSetlistIds) {
    v7.shared = { ...v7.shared, deletedSetlistIds: gcTombstones(v7.shared.deletedSetlistIds) };
  }
  return v7;
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.version === STATE_VERSION) return _runFullChain(d);
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
  gcTombstones,
  mergeDeletedSetlistIds, mergeSetlistsLWW, mergeProfilesLWW,
  makeDefaultProfile,
  migrateV1toV2, migrateV2toV3, migrateV3toV4, migrateV4toV5, migrateV5toV6, migrateV6toV7,
  dedupSetlists, setlistDedupKey, findSetlistDuplicatesByName,
  loadState, saveState,
  autoBackup, listBackups, restoreBackup, clearBackups, isQuotaError,
  loadSecrets, saveSecrets,
  loadTrusted, isTrusted, setTrusted,
  getAllRigsGuitars,
};
