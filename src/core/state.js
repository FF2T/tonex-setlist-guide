// src/core/state.js — Phase 2.
// État applicatif persisté dans localStorage.
//
// Schéma :
//   {
//     version: 3,
//     activeProfileId: string,
//     shared: { songDb, theme, setlists, customGuitars?, toneNetPresets?,
//               deletedSetlistIds? },
//     profiles: { [id]: profile },
//     lastModified?: number,
//     syncId?: string,
//   }
//
// Profil :
//   {
//     id, name, isAdmin, password,
//     myGuitars: string[],
//     customGuitars: object[],
//     editedGuitars: { [id]: object },
//     devices: { pedale, anniversary, plug },     // legacy v2, conservé en
//                                                 // miroir pour rétrocompat
//                                                 // (auto-lock sources, tabs).
//     enabledDevices: string[],                   // v3 : ids du registry
//                                                 // ('tonex-pedal', etc.)
//     availableSources: { [src]: bool },
//     customPacks: object[],
//     banksAnn, banksPlug,                        // 50 et 10 banks A/B/C
//     aiProvider, aiKeys: { anthropic, gemini },
//     loginHistory?: object[],
//   }
//
// Migrations enchaînées : v1 → v2 → v3. Le caller utilise loadState() qui
// applique automatiquement la migration si nécessaire et retourne un état
// au schéma courant.

import { GUITARS } from './guitars.js';
import { INIT_SONG_DB_META } from './songs.js';
import { INIT_SETLISTS } from './setlists.js';
import {
  INIT_BANKS_ANN, FACTORY_BANKS_PEDALE,
  INIT_BANKS_PLUG, FACTORY_BANKS_PLUG,
} from '../data/data_catalogs.js';

// ─── Versioning + clés localStorage ──────────────────────────────────
const STATE_VERSION = 3;
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

function ensureProfilesV3(profiles) {
  if (!profiles) return profiles;
  const out = {};
  for (const [id, p] of Object.entries(profiles)) {
    out[id] = ensureProfileV3(p);
  }
  return out;
}

// ─── makeDefaultProfile ──────────────────────────────────────────────
function makeDefaultProfile(id, name, isAdmin = false, password = '') {
  const devices = { pedale: false, anniversary: isAdmin, plug: false };
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
    devices,
    enabledDevices,
    availableSources: { TSR: true, ML: true, Anniversary: true, Factory: true, ToneNET: true },
    customPacks: [],
    banksAnn: isAdmin ? { ...INIT_BANKS_ANN } : { ...FACTORY_BANKS_PEDALE },
    banksPlug: isAdmin ? { ...INIT_BANKS_PLUG } : { ...FACTORY_BANKS_PLUG },
    aiProvider: 'gemini',
    aiKeys: { anthropic: '', gemini: '' },
    loginHistory: [],
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

// ─── loadState / saveState ───────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      // Même quand version === 3, on passe par migrateV2toV3 pour heal
      // d'éventuels profils incomplets (cas où la migration a tourné
      // mais que Firestore a écrasé les profils par une version v2 sans
      // enabledDevices entre temps, qui s'est ensuite re-saved en v3).
      if (d.version === STATE_VERSION) return migrateV2toV3(d);
      if (d.version === 2) return migrateV2toV3(d);
    }
    const v1raw = localStorage.getItem(LS_KEY_V1);
    if (v1raw) return migrateV2toV3(migrateV1toV2(JSON.parse(v1raw)));
  } catch (e) { /* ignore */ }
  return null;
}

function saveState(state) {
  autoBackup();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

// ─── Backups (rotation des 5 derniers, throttle 5 min) ───────────────
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
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(backups));
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

export {
  STATE_VERSION,
  LS_KEY, LS_KEY_V1, LS_SECRETS_KEY, LS_TRUSTED_KEY, LS_BACKUP_KEY, MAX_BACKUPS,
  mergeBanks, deriveEnabledDevices,
  ensureProfileV3, ensureProfilesV3,
  makeDefaultProfile,
  migrateV1toV2, migrateV2toV3,
  loadState, saveState,
  autoBackup, listBackups, restoreBackup,
  loadSecrets, saveSecrets,
  loadTrusted, isTrusted, setTrusted,
};
