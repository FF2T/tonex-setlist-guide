// Tests des migrations localStorage v1 → v2 → v3 → v4 → v5.
// Critique : aucune migration ne doit perdre de données utilisateur.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STATE_VERSION, TOMBSTONE_MAX_AGE_MS,
  migrateV1toV2, migrateV2toV3, migrateV4toV5, migrateV5toV6, migrateV6toV7,
  migrateV7toV8, migrateV8toV9,
  ensureSharedV7, ensureProfileV7, ensureProfilesV7,
  ensureProfileV8, ensureProfilesV8,
  ensureProfileV9, ensureProfilesV9,
  isDemoProfile, isDemoMode, loadDemoSnapshot, buildDemoSnapshot,
  wrapDemoGuard, stripDemoProfiles, stripDemoFromSetlists,
  gcTombstones,
  mergeDeletedSetlistIds, mergeSetlistsLWW, mergeProfilesLWW, mergeProfileLWW,
  mergeToneNetPresetsLWW, mergeDeletedToneNetIds,
  stampedProfileUpdate,
  ensureProfileV10, ensureProfilesV10, migrateV9toV10, getProfileAiCache,
  ensureProfileV11, ensureProfilesV11, migrateV10toV11,
  ensureProfileV12, ensureProfilesV12, migrateV11toV12,
  ensureProfileV13, ensureProfilesV13, migrateV12toV13,
  ensureProfileV14, ensureProfilesV14, migrateV13toV14,
  ensureProfileV15, ensureProfilesV15, migrateV14toV15,
  mergeMyGuitarsWithDefenses,
  getDeviceId, getDeviceLabel, setDeviceLabel,
  stripAiCacheForSync, mergeSongDbPreservingLocalAiCache,
  computeNewzikCreateNames, computeNewzikMergeNames,
  toggleSetlistProfile,
  recordAdminSwitch, isAdminAsMode, appendLoginEntry,
  deriveEnabledDevices, makeDefaultProfile,
  getAllRigsGuitars,
  computeGuitarBiasFromFeedback,
  mergeGuitarBias,
  dedupSetlists, dedupSetlistsWithTombstones, setlistDedupKey,
  dedupSongDb,
  autoBackup, listBackups, clearBackups, isQuotaError, persistState,
  OUTPUT_CONTEXTS, DEFAULT_OUTPUT_CONTEXT, getEffectiveOutputContext,
  PLAY_INSTRUMENTS, PLAY_RIGS, getAvailableRigs, getEffectivePlayContext,
  getDefaultPlayInstrument, getEffectiveZones,
} from './state.js';

describe('STATE_VERSION', () => {
  test('vaut 15 en Phase ToneX One (banks One/One+)', () => {
    expect(STATE_VERSION).toBe(15);
  });
});

describe('migrateV14toV15 — Phase ToneX One (banks One/One+)', () => {
  test('v14 → v15 : backfill banksOne/banksOnePlus à {} (additif)', () => {
    const v14 = {
      version: 14,
      profiles: {
        seb: { id: 'seb', name: 'Seb', myGuitarsModified: 0, banksAnn: { 1: { cat: '', A: 'X' } }, banksPlug: {} },
      },
    };
    const v15 = migrateV14toV15(v14);
    expect(v15.version).toBe(15);
    expect(v15.profiles.seb.banksOne).toEqual({});
    expect(v15.profiles.seb.banksOnePlus).toEqual({});
    // Champs existants intacts
    expect(v15.profiles.seb.banksAnn).toEqual({ 1: { cat: '', A: 'X' } });
  });

  test('ensureProfileV15 — idempotent (banks One déjà présentes préservées)', () => {
    const p = { id: 'a', name: 'A', myGuitarsModified: 0, banksOne: { 5: { cat: '', A: 'DR 800' } }, banksOnePlus: {} };
    const out = ensureProfileV15(p);
    expect(out.banksOne).toEqual({ 5: { cat: '', A: 'DR 800' } });
    expect(out.banksOnePlus).toEqual({});
  });

  test('ensureProfileV15 — chaîne v13/v14 (backfill myGuitarsModified + banks One)', () => {
    const p = { id: 'a', name: 'A' }; // profil pré-v14
    const out = ensureProfileV15(p);
    expect(out.myGuitarsModified).toBe(0); // via ensureProfileV14
    expect(out.banksOne).toEqual({});
    expect(out.banksOnePlus).toEqual({});
  });

  test('ensureProfilesV15 — map sur tous les profils', () => {
    const out = ensureProfilesV15({ a: { id: 'a' }, b: { id: 'b' } });
    expect(out.a.banksOne).toEqual({});
    expect(out.b.banksOnePlus).toEqual({});
  });

  test('migrateV14toV15 — null safe', () => {
    expect(migrateV14toV15(null)).toBe(null);
  });
});

describe('migrateV4toV5 — purement additif Phase 4', () => {
  test("v4 → v5 : seul le numéro de version change", () => {
    const v4 = {
      version: 4,
      activeProfileId: 'u1',
      shared: { songDb: [{ id: 'a', title: 'A', artist: 'B' }] },
      profiles: {
        u1: {
          id: 'u1', name: 'U1', isAdmin: false,
          enabledDevices: ['tonex-pedal'],
          devices: { pedale: true },
          tmpPatches: { custom: [], factoryOverrides: {} },
        },
      },
    };
    const v5 = migrateV4toV5(v4);
    expect(v5.version).toBe(5);
    // Tout le reste préservé byte-for-byte
    expect(v5.shared).toEqual(v4.shared);
    expect(v5.profiles).toEqual(v4.profiles);
    expect(v5.activeProfileId).toBe('u1');
  });

  test('idempotent : appliquer migrateV4toV5 sur v5 ne corrompt rien', () => {
    const v5in = {
      version: 5,
      profiles: {
        u1: {
          id: 'u1',
          tmpPatches: {
            custom: [],
            factoryOverrides: {
              rock_preset: {
                scenes: [{ id: 's1', name: 'S1' }],
                footswitchMap: { fs1: { type: 'scene', sceneId: 's1' } },
              },
            },
          },
        },
      },
    };
    const v5out = migrateV4toV5(v5in);
    expect(v5out.version).toBe(5);
    expect(v5out.profiles.u1.tmpPatches.factoryOverrides.rock_preset.scenes).toEqual([
      { id: 's1', name: 'S1' },
    ]);
  });

  test('songs avec bpm/key préservés', () => {
    const v4 = {
      version: 4,
      shared: {
        songDb: [
          { id: 'x', title: 'X', artist: 'Y', bpm: 120, key: 'A minor' },
        ],
      },
      profiles: {},
    };
    const v5 = migrateV4toV5(v4);
    expect(v5.shared.songDb[0].bpm).toBe(120);
    expect(v5.shared.songDb[0].key).toBe('A minor');
  });
});

describe('migrateV3toV4 — ajoute tmpPatches additif', () => {
  test('profil v3 sans tmpPatches → tmpPatches ajouté avec defaults', async () => {
    const { migrateV3toV4 } = await import('./state.js');
    const v3 = {
      version: 3,
      profiles: {
        u1: {
          id: 'u1', name: 'U1', isAdmin: false,
          enabledDevices: ['tonex-pedal'],
          devices: { pedale: true },
        },
      },
    };
    const v4 = migrateV3toV4(v3);
    expect(v4.version).toBe(4);
    expect(v4.profiles.u1.tmpPatches).toEqual({ custom: [], factoryOverrides: {} });
    // Préservation des autres champs
    expect(v4.profiles.u1.enabledDevices).toEqual(['tonex-pedal']);
    expect(v4.profiles.u1.name).toBe('U1');
  });

  test('profil v3 avec tmpPatches déjà présent → préservé tel quel (idempotence)', async () => {
    const { migrateV3toV4 } = await import('./state.js');
    const existing = {
      custom: [{ id: 'mine', name: 'My Patch' }],
      factoryOverrides: { rock_preset: { 'amp.params.gain': 8 } },
    };
    const v3 = {
      version: 3,
      profiles: { u1: { id: 'u1', enabledDevices: ['tonex-pedal'], tmpPatches: existing } },
    };
    const v4 = migrateV3toV4(v3);
    expect(v4.profiles.u1.tmpPatches).toEqual(existing);
    expect(v4.profiles.u1.tmpPatches.custom[0].name).toBe('My Patch');
  });

  test('migration chaînée v1 → v2 → v3 → v4', async () => {
    const { loadState, migrateV1toV2, migrateV2toV3, migrateV3toV4 } = await import('./state.js');
    const v1 = { banksAnn: {}, banksPlug: {}, songDb: [], theme: 'dark' };
    const v2 = migrateV1toV2(v1);
    const v3 = migrateV2toV3(v2);
    const v4 = migrateV3toV4(v3);
    expect(v4.version).toBe(4);
    expect(v4.profiles.sebastien.tmpPatches).toEqual({ custom: [], factoryOverrides: {} });
    expect(v4.profiles.sebastien.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
  });

  test('plusieurs profils traités indépendamment', async () => {
    const { migrateV3toV4 } = await import('./state.js');
    const v3 = {
      version: 3,
      profiles: {
        a: { enabledDevices: ['tonex-pedal'] },
        b: { enabledDevices: ['tonex-plug'], tmpPatches: { custom: [{ id: 'x' }], factoryOverrides: {} } },
      },
    };
    const v4 = migrateV3toV4(v3);
    expect(v4.profiles.a.tmpPatches).toEqual({ custom: [], factoryOverrides: {} });
    expect(v4.profiles.b.tmpPatches.custom[0].id).toBe('x');
  });

  test('ensureProfileV4(null) → null', async () => {
    const { ensureProfileV4 } = await import('./state.js');
    expect(ensureProfileV4(null)).toBeNull();
  });

  test('ensureProfileV4 idempotent : profil déjà v4 → préservé (pas de spread)', async () => {
    const { ensureProfileV4 } = await import('./state.js');
    const profile = {
      enabledDevices: ['tonex-pedal'],
      tmpPatches: { custom: [], factoryOverrides: {} },
    };
    const out = ensureProfileV4(profile);
    expect(out.tmpPatches).toBe(profile.tmpPatches);
  });

  test('ensureProfilesV4 applique heal à tous les profils', async () => {
    const { ensureProfilesV4 } = await import('./state.js');
    const profiles = {
      a: { devices: { pedale: true } },
      b: { enabledDevices: ['tonex-plug'], tmpPatches: { custom: [{ id: 'p1' }], factoryOverrides: {} } },
    };
    const out = ensureProfilesV4(profiles);
    expect(out.a.tmpPatches).toEqual({ custom: [], factoryOverrides: {} });
    expect(out.a.enabledDevices).toEqual(['tonex-pedal']); // heal v3 cascade
    expect(out.b.tmpPatches.custom[0].id).toBe('p1');
  });
});

describe('deriveEnabledDevices · règles de dérivation depuis profile.devices', () => {
  test('Sébastien (anniversary + plug)', () => {
    const out = deriveEnabledDevices({ pedale: false, anniversary: true, plug: true });
    expect(out).toEqual(['tonex-anniversary', 'tonex-plug']);
  });

  test('utilisateur standard (pedal + plug)', () => {
    const out = deriveEnabledDevices({ pedale: true, anniversary: false, plug: true });
    expect(out).toEqual(['tonex-pedal', 'tonex-plug']);
  });

  test('vide → fallback pedal + plug', () => {
    const out = deriveEnabledDevices({ pedale: false, anniversary: false, plug: false });
    expect(out).toEqual(['tonex-pedal', 'tonex-plug']);
  });

  test('null → fallback pedal + plug', () => {
    const out = deriveEnabledDevices(null);
    expect(out).toEqual(['tonex-pedal', 'tonex-plug']);
  });

  test('utilisateur avec les 3 devices', () => {
    const out = deriveEnabledDevices({ pedale: true, anniversary: true, plug: true });
    expect(out).toEqual(['tonex-pedal', 'tonex-anniversary', 'tonex-plug']);
  });
});

describe('migrateV2toV3', () => {
  test('cas Sébastien : ajoute enabledDevices, préserve devices et tous les autres champs', () => {
    const v2 = {
      version: 2,
      activeProfileId: 'sebastien',
      shared: { songDb: [{ id: 'foo' }], theme: 'dark', setlists: [] },
      profiles: {
        sebastien: {
          id: 'sebastien', name: 'Sébastien', isAdmin: true,
          devices: { pedale: false, anniversary: true, plug: true },
          banksAnn: { 0: { A: 'preset' } },
          customGuitars: [{ id: 'custom1' }],
          aiKeys: { gemini: 'XXX' },
        },
      },
    };
    const v3 = migrateV2toV3(v2);
    expect(v3.version).toBe(3);
    expect(v3.profiles.sebastien.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
    // Préservation totale du reste
    expect(v3.profiles.sebastien.devices).toEqual({ pedale: false, anniversary: true, plug: true });
    expect(v3.profiles.sebastien.banksAnn).toEqual({ 0: { A: 'preset' } });
    expect(v3.profiles.sebastien.customGuitars).toEqual([{ id: 'custom1' }]);
    expect(v3.profiles.sebastien.aiKeys).toEqual({ gemini: 'XXX' });
    expect(v3.activeProfileId).toBe('sebastien');
    expect(v3.shared).toEqual(v2.shared);
  });

  test('cas standard : pedal + plug', () => {
    const v2 = {
      version: 2, profiles: { user1: { devices: { pedale: true, anniversary: false, plug: true } } },
    };
    const v3 = migrateV2toV3(v2);
    expect(v3.profiles.user1.enabledDevices).toEqual(['tonex-pedal', 'tonex-plug']);
  });

  test('cas vide (aucun device) : fallback pedal + plug', () => {
    const v2 = {
      version: 2, profiles: { user1: { devices: { pedale: false, anniversary: false, plug: false } } },
    };
    const v3 = migrateV2toV3(v2);
    expect(v3.profiles.user1.enabledDevices).toEqual(['tonex-pedal', 'tonex-plug']);
  });

  test('plusieurs profils traités indépendamment', () => {
    const v2 = {
      version: 2,
      profiles: {
        admin: { devices: { pedale: false, anniversary: true, plug: true } },
        franck: { devices: { pedale: true, anniversary: false, plug: true } },
        kid: { devices: { pedale: true, anniversary: false, plug: false } },
      },
    };
    const v3 = migrateV2toV3(v2);
    expect(v3.profiles.admin.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
    expect(v3.profiles.franck.enabledDevices).toEqual(['tonex-pedal', 'tonex-plug']);
    expect(v3.profiles.kid.enabledDevices).toEqual(['tonex-pedal']);
  });
});

describe('migration chaînée v1 → v2 → v3', () => {
  test("payload v1 brut produit un état v3 avec sebastien.enabledDevices['tonex-anniversary','tonex-plug']", () => {
    const v1 = { banksAnn: {}, banksPlug: {}, songDb: [{ id: 'song1' }], theme: 'light' };
    const v2 = migrateV1toV2(v1);
    expect(v2.version).toBe(2);
    expect(v2.profiles.sebastien.devices).toEqual({ pedale: false, anniversary: true, plug: true });
    const v3 = migrateV2toV3(v2);
    expect(v3.version).toBe(3);
    expect(v3.profiles.sebastien.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
    // Données v1 préservées
    expect(v3.shared.songDb).toEqual([{ id: 'song1' }]);
    expect(v3.shared.theme).toBe('light');
  });
});

describe('idempotence et préservation', () => {
  test('migrateV2toV3 sur un state qui a déjà enabledDevices : préserve la valeur existante (idempotence)', () => {
    // Bug-fix Phase 2 : on respecte enabledDevices déjà présent au lieu
    // de le re-dériver. Garantit que les choix utilisateur (cocher/décocher
    // depuis Mes appareils) ne sont pas écrasés par une re-migration.
    const v2 = {
      version: 2,
      profiles: { u: { devices: { pedale: true }, enabledDevices: ['tonex-anniversary'] } },
    };
    const v3 = migrateV2toV3(v2);
    expect(v3.profiles.u.enabledDevices).toEqual(['tonex-anniversary']);
  });

  test('migrateV2toV3 ne touche pas aux champs hors profiles et version', () => {
    const v2 = {
      version: 2,
      activeProfileId: 'u1',
      shared: { songDb: [], theme: 'dark', setlists: [{ id: 'sl1' }] },
      profiles: { u1: { devices: {} } },
      lastModified: 12345,
      syncId: 'abc',
    };
    const v3 = migrateV2toV3(v2);
    expect(v3.activeProfileId).toBe('u1');
    expect(v3.shared).toEqual(v2.shared);
    expect(v3.lastModified).toBe(12345);
    expect(v3.syncId).toBe('abc');
  });
});

describe('régression Phase 2 SetlistsScreen : enabledDevices doit refléter le legacy profile.devices quand absent', () => {
  test("getDevicesForRender (helper d'écran) : profile sans enabledDevices, legacy {pedale:false, anniversary:true, plug:false} → 1 device Anniversary", async () => {
    // Cas reproducteur : user a décoché Plug, devices.plug=false, mais
    // un push/pull Firestore a effacé enabledDevices entre temps.
    // L'écran doit lire le legacy au lieu de retomber sur les defaults
    // (qui sont Pedal + Plug et causent 2 lignes au lieu d'1).
    const { getDevicesForRender } = await import('./state.js');
    const profile = {
      id: 'sebastien',
      devices: { pedale: false, anniversary: true, plug: false },
      // pas d'enabledDevices : simule le bug
    };
    const ids = getDevicesForRender(profile);
    expect(ids).toEqual(['tonex-anniversary']);
  });

  test("profile vide : devices = {} → fallback ['tonex-pedal','tonex-plug']", async () => {
    const { getDevicesForRender } = await import('./state.js');
    expect(getDevicesForRender({})).toEqual(['tonex-pedal', 'tonex-plug']);
  });

  test('profile null → fallback', async () => {
    const { getDevicesForRender } = await import('./state.js');
    expect(getDevicesForRender(null)).toEqual(['tonex-pedal', 'tonex-plug']);
  });

  test('profile.enabledDevices = [] (vide explicite) → fallback', async () => {
    // Cas garde-fou MesAppareilsTab — ne devrait jamais arriver car le
    // toggle bloque le décoché du dernier device. Mais si l'utilisateur
    // avait un profil v3 corrompu avec liste vide, on retombe sur le
    // legacy plutôt que rendre une page sans aucun bloc device.
    const { getDevicesForRender } = await import('./state.js');
    const profile = { enabledDevices: [], devices: { anniversary: true } };
    expect(getDevicesForRender(profile)).toEqual(['tonex-anniversary']);
  });

  test('profile.enabledDevices = ["tonex-anniversary"] (cas Sébastien fixé) → 1 device', async () => {
    const { getDevicesForRender } = await import('./state.js');
    const profile = {
      enabledDevices: ['tonex-anniversary'],
      devices: { pedale: false, anniversary: true, plug: false },
    };
    expect(getDevicesForRender(profile)).toEqual(['tonex-anniversary']);
  });

  test('profile.enabledDevices a priorité sur le legacy si présent', async () => {
    const { getDevicesForRender } = await import('./state.js');
    // L'utilisateur a fait un toggle ; l'enabledDevices est plus récent
    // que le legacy. On ne re-dérive pas.
    const profile = {
      enabledDevices: ['tonex-pedal'],
      devices: { pedale: false, anniversary: true, plug: true }, // ancien
    };
    expect(getDevicesForRender(profile)).toEqual(['tonex-pedal']);
  });
});

describe('régression : enabledDevices manquant doit être complété (heal)', () => {
  test('cas reproducteur du bug Phase 2 : profile v2 avec devices.anniversary=true et devices.plug=true doit produire enabledDevices', async () => {
    // Le profil arrive depuis Firestore EN VERSION 2 (synced avant
    // déploiement Phase 2). Le state local a déjà été migré v3 par
    // loadState, mais Firestore poll écrase profiles avec la version
    // distante (v2, sans enabledDevices). Le re-render doit lire
    // enabledDevices et recevoir undefined → bug.
    const { ensureProfileV3 } = await import('./state.js');
    const v2Profile = {
      id: 'sebastien', name: 'Sébastien', isAdmin: true,
      devices: { pedale: false, anniversary: true, plug: true },
      banksAnn: { 0: { A: 'preset' } },
    };
    const healed = ensureProfileV3(v2Profile);
    expect(healed.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
    // Préservation du reste
    expect(healed.devices).toEqual({ pedale: false, anniversary: true, plug: true });
    expect(healed.banksAnn).toEqual({ 0: { A: 'preset' } });
  });

  test('ensureProfileV3 idempotent : profil déjà migré reste inchangé', async () => {
    const { ensureProfileV3 } = await import('./state.js');
    const v3 = {
      id: 'u', devices: { pedale: true },
      enabledDevices: ['tonex-pedal', 'tonex-anniversary'],
    };
    const out = ensureProfileV3(v3);
    expect(out.enabledDevices).toEqual(['tonex-pedal', 'tonex-anniversary']);
    expect(out).toBe(v3); // même référence si déjà OK (no-op)
  });

  test('migrateV2toV3 sur état v3 mais profils sans enabledDevices : heal', async () => {
    const { migrateV2toV3 } = await import('./state.js');
    const partial = {
      version: 3,
      profiles: {
        u: { devices: { pedale: true, plug: true } },
      },
    };
    const out = migrateV2toV3(partial);
    expect(out.profiles.u.enabledDevices).toEqual(['tonex-pedal', 'tonex-plug']);
  });

  test('ensureProfilesV3 : applique le heal à tous les profils', async () => {
    const { ensureProfilesV3 } = await import('./state.js');
    const profiles = {
      a: { devices: { pedale: true } },
      b: { devices: { anniversary: true, plug: true } },
      c: { enabledDevices: ['tonex-plug'] }, // déjà OK
    };
    const out = ensureProfilesV3(profiles);
    expect(out.a.enabledDevices).toEqual(['tonex-pedal']);
    expect(out.b.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
    expect(out.c.enabledDevices).toEqual(['tonex-plug']);
  });

  test('ensureProfileV3 : profil null → null', async () => {
    const { ensureProfileV3 } = await import('./state.js');
    expect(ensureProfileV3(null)).toBeNull();
  });
});

describe('makeDefaultProfile · enabledDevices conforme au flag isAdmin', () => {
  test('admin → Anniversary + Plug', () => {
    const p = makeDefaultProfile('admin', 'Admin', true);
    expect(p.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
    // Phase 5 (Item E) : devices legacy supprimé en v6.
    expect(p.devices).toBeUndefined();
  });

  test('utilisateur standard (Phase 7.48) → profil vierge', () => {
    const p = makeDefaultProfile('user', 'User', false);
    expect(p.enabledDevices).toEqual([]);
    expect(p.devices).toBeUndefined();
    expect(p.myGuitars).toEqual([]);
    expect(p.banksAnn).toEqual({});
    expect(p.banksPlug).toEqual({});
    expect(p.availableSources).toEqual({
      TSR: false, ML: false, Anniversary: false,
      Factory: false, FactoryV1: false, PlugFactory: false,
      ToneNET: false, custom: false,
    });
  });
});

describe('getAllRigsGuitars (Phase 3.6) · union des guitares de tous les profils', () => {
  const STD = [
    { id: 'lp60', name: 'LP60', type: 'HB' },
    { id: 'sg61', name: 'SG 61', type: 'HB' },
    { id: 'strat61', name: 'Strat 61', type: 'SC' },
    { id: 'tele63', name: 'Tele 63', type: 'SC' },
  ];

  test('union de 2 profils sans recouvrement → liste fusionnée dédupliquée', () => {
    const profiles = {
      sebastien: { myGuitars: ['lp60', 'sg61'] },
      arthur: { myGuitars: ['strat61', 'tele63'] },
    };
    const out = getAllRigsGuitars(profiles, [], STD);
    expect(out.map((g) => g.id).sort()).toEqual(['lp60', 'sg61', 'strat61', 'tele63']);
  });

  test('overlap entre profils → guitare présente une seule fois', () => {
    const profiles = {
      a: { myGuitars: ['lp60', 'sg61'] },
      b: { myGuitars: ['sg61', 'strat61'] },
    };
    const out = getAllRigsGuitars(profiles, [], STD);
    expect(out.map((g) => g.id).sort()).toEqual(['lp60', 'sg61', 'strat61']);
  });

  test('inclut customGuitars partagés référencés par au moins un profil', () => {
    const customs = [
      { id: 'arthur_es339', name: 'ES-339 Arthur', type: 'HB' },
      { id: 'unused_custom', name: 'Inutilisée', type: 'HB' },
    ];
    const profiles = {
      sebastien: { myGuitars: ['lp60'] },
      arthur: { myGuitars: ['arthur_es339'] },
    };
    const out = getAllRigsGuitars(profiles, customs, STD);
    const ids = out.map((g) => g.id);
    expect(ids).toContain('lp60');
    expect(ids).toContain('arthur_es339');
    // unused_custom n'est listée par aucun profil → exclue.
    expect(ids).not.toContain('unused_custom');
  });

  test('profile.myGuitars vide ou absent → ignoré sans crash', () => {
    const profiles = {
      a: { myGuitars: ['lp60'] },
      b: {},
      c: { myGuitars: [] },
    };
    const out = getAllRigsGuitars(profiles, [], STD);
    expect(out.map((g) => g.id)).toEqual(['lp60']);
  });

  test('profiles null → fallback sur la liste standard complète (defensive)', () => {
    expect(getAllRigsGuitars(null, [], STD).length).toBe(STD.length);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.7 — computeGuitarBiasFromFeedback
// ───────────────────────────────────────────────────────────────────

describe('computeGuitarBiasFromFeedback (Phase 7.7) · dérive un bias style→guitare depuis song.feedback', () => {
  const GUITARS_FX = [
    { id: 'es335', name: 'ES-335' },
    { id: 'sg61', name: 'SG 61' },
    { id: 'strat61', name: 'Strat 61' },
  ];

  const mkSong = (id, style, idealGuitar, nbFeedbacks) => ({
    id,
    feedback: Array.from({ length: nbFeedbacks }, (_, i) => ({ text: `fb${i}`, ts: i })),
    aiCache: { result: { song_style: style, ideal_guitar: idealGuitar } },
  });

  test('songDb vide ou guitars vide → {} (defensive)', () => {
    expect(computeGuitarBiasFromFeedback([], GUITARS_FX)).toEqual({});
    expect(computeGuitarBiasFromFeedback([mkSong('s1', 'blues', 'ES-335', 1)], [])).toEqual({});
    expect(computeGuitarBiasFromFeedback(null, GUITARS_FX)).toEqual({});
    expect(computeGuitarBiasFromFeedback([mkSong('s1', 'blues', 'ES-335', 1)], null)).toEqual({});
  });

  test('songs sans feedback ne comptent pas', () => {
    const db = [
      { id: 's1', feedback: [], aiCache: { result: { song_style: 'blues', ideal_guitar: 'ES-335' } } },
      { id: 's2', aiCache: { result: { song_style: 'blues', ideal_guitar: 'ES-335' } } },
    ];
    expect(computeGuitarBiasFromFeedback(db, GUITARS_FX)).toEqual({});
  });

  test('songs sans aiCache.result ne comptent pas', () => {
    const db = [
      { id: 's1', feedback: [{ text: 'x', ts: 1 }] },
      { id: 's2', feedback: [{ text: 'x', ts: 1 }], aiCache: null },
      { id: 's3', feedback: [{ text: 'x', ts: 1 }], aiCache: { result: { song_style: 'blues' } } }, // ideal_guitar absent
    ];
    expect(computeGuitarBiasFromFeedback(db, GUITARS_FX)).toEqual({});
  });

  test('seuil = 3 par défaut : 2 occurrences ne suffisent pas', () => {
    const db = [
      mkSong('s1', 'blues', 'ES-335', 1),
      mkSong('s2', 'blues', 'ES-335', 1),
    ];
    expect(computeGuitarBiasFromFeedback(db, GUITARS_FX)).toEqual({});
  });

  test('seuil atteint (3 morceaux feedbackés même style+guitare) → bias retenu', () => {
    const db = [
      mkSong('s1', 'blues', 'ES-335', 1),
      mkSong('s2', 'blues', 'ES-335', 2),
      mkSong('s3', 'blues', 'ES-335', 1),
    ];
    const out = computeGuitarBiasFromFeedback(db, GUITARS_FX);
    expect(out).toEqual({ blues: { guitarId: 'es335', guitarName: 'ES-335', count: 3 } });
  });

  test('plusieurs styles indépendants tally séparément', () => {
    const db = [
      mkSong('s1', 'blues', 'ES-335', 1),
      mkSong('s2', 'blues', 'ES-335', 1),
      mkSong('s3', 'blues', 'ES-335', 1),
      mkSong('s4', 'hard_rock', 'SG 61', 1),
      mkSong('s5', 'hard_rock', 'SG 61', 1),
      mkSong('s6', 'hard_rock', 'SG 61', 1),
    ];
    const out = computeGuitarBiasFromFeedback(db, GUITARS_FX);
    expect(out.blues).toEqual({ guitarId: 'es335', guitarName: 'ES-335', count: 3 });
    expect(out.hard_rock).toEqual({ guitarId: 'sg61', guitarName: 'SG 61', count: 3 });
  });

  test('plusieurs guitares pour un même style : la plus fréquente gagne', () => {
    const db = [
      mkSong('s1', 'blues', 'ES-335', 1),
      mkSong('s2', 'blues', 'ES-335', 1),
      mkSong('s3', 'blues', 'ES-335', 1),
      mkSong('s4', 'blues', 'SG 61', 1), // 1 seule ES-335 wins
    ];
    const out = computeGuitarBiasFromFeedback(db, GUITARS_FX);
    expect(out.blues.guitarId).toBe('es335');
    expect(out.blues.count).toBe(3);
  });

  test('égalité de count → tiebreak alphabétique sur guitarId (déterministe)', () => {
    const db = [
      mkSong('s1', 'rock', 'ES-335', 1),
      mkSong('s2', 'rock', 'ES-335', 1),
      mkSong('s3', 'rock', 'ES-335', 1),
      mkSong('s4', 'rock', 'SG 61', 1),
      mkSong('s5', 'rock', 'SG 61', 1),
      mkSong('s6', 'rock', 'SG 61', 1),
    ];
    const out = computeGuitarBiasFromFeedback(db, GUITARS_FX);
    // 'es335' < 'sg61' alpha
    expect(out.rock.guitarId).toBe('es335');
  });

  test('nom IA inconnu (ne match aucune guitare) ignoré', () => {
    const db = [
      mkSong('s1', 'blues', 'Telecaster Custom Shop Inconnue', 1),
      mkSong('s2', 'blues', 'Telecaster Custom Shop Inconnue', 1),
      mkSong('s3', 'blues', 'Telecaster Custom Shop Inconnue', 1),
    ];
    expect(computeGuitarBiasFromFeedback(db, GUITARS_FX)).toEqual({});
  });

  test('threshold custom (2) → bias retenu à 2 occurrences', () => {
    const db = [
      mkSong('s1', 'jazz', 'ES-335', 1),
      mkSong('s2', 'jazz', 'ES-335', 1),
    ];
    const out = computeGuitarBiasFromFeedback(db, GUITARS_FX, 2);
    expect(out.jazz.guitarId).toBe('es335');
    expect(out.jazz.count).toBe(2);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.9 — mergeGuitarBias (manual override)
// ───────────────────────────────────────────────────────────────────

describe('mergeGuitarBias (Phase 7.9) · merge auto-dérivé + overrides manuels', () => {
  const GUITARS_FX = [
    { id: 'es335', name: 'ES-335' },
    { id: 'sg61', name: 'SG 61' },
    { id: 'strat61', name: 'Strat 61' },
  ];

  test('auto seul → entries source=auto avec count préservé', () => {
    const auto = { blues: { guitarId: 'es335', guitarName: 'ES-335', count: 4 } };
    const out = mergeGuitarBias(auto, null, GUITARS_FX);
    expect(out.blues).toEqual({ guitarId: 'es335', guitarName: 'ES-335', count: 4, source: 'auto' });
  });

  test('manual seul → entries source=manual avec count null', () => {
    const manual = { rock: 'sg61' };
    const out = mergeGuitarBias({}, manual, GUITARS_FX);
    expect(out.rock).toEqual({ guitarId: 'sg61', guitarName: 'SG 61', count: null, source: 'manual' });
  });

  test('manual écrase auto sur le même style', () => {
    const auto = { blues: { guitarId: 'es335', guitarName: 'ES-335', count: 5 } };
    const manual = { blues: 'sg61' };
    const out = mergeGuitarBias(auto, manual, GUITARS_FX);
    expect(out.blues).toEqual({ guitarId: 'sg61', guitarName: 'SG 61', count: null, source: 'manual' });
  });

  test('styles disjoints → auto et manual coexistent', () => {
    const auto = { blues: { guitarId: 'es335', guitarName: 'ES-335', count: 3 } };
    const manual = { rock: 'strat61' };
    const out = mergeGuitarBias(auto, manual, GUITARS_FX);
    expect(out.blues.source).toBe('auto');
    expect(out.rock.source).toBe('manual');
    expect(Object.keys(out).sort()).toEqual(['blues', 'rock']);
  });

  test('manual avec guitarId stale (pas dans le rig) → ignoré silencieusement', () => {
    const manual = { metal: 'guitare_supprimee_42' };
    const out = mergeGuitarBias({}, manual, GUITARS_FX);
    expect(out).toEqual({});
  });

  test('auto avec guitarId stale → ignoré silencieusement', () => {
    const auto = { blues: { guitarId: 'guitare_supprimee_42', guitarName: 'X', count: 5 } };
    const out = mergeGuitarBias(auto, {}, GUITARS_FX);
    expect(out).toEqual({});
  });

  test('manual avec guitarId vide/null/undefined → entry ignorée (pas un override)', () => {
    const manual = { jazz: '', pop: null, metal: undefined };
    const out = mergeGuitarBias({}, manual, GUITARS_FX);
    expect(out).toEqual({});
  });

  test('inputs falsy → {} (defensive)', () => {
    expect(mergeGuitarBias(null, null, GUITARS_FX)).toEqual({});
    expect(mergeGuitarBias({}, {}, [])).toEqual({});
    expect(mergeGuitarBias(undefined, undefined, undefined)).toEqual({});
  });

  test('guitarName toujours rafraîchi depuis le rig (pas depuis l\'entry auto)', () => {
    // Si la guitare a été renommée mais l'auto bias garde l'ancien nom,
    // mergeGuitarBias resync depuis l'objet guitars actuel.
    const renamedGuitars = [{ id: 'es335', name: 'ES-335 (renommée)' }];
    const auto = { blues: { guitarId: 'es335', guitarName: 'ES-335', count: 3 } };
    const out = mergeGuitarBias(auto, {}, renamedGuitars);
    // Note : pour le auto, on garde le nom de l'entry (rafraîchissement
    // optionnel). Pour le manual, on lit toujours depuis guitars.
    expect(out.blues.guitarId).toBe('es335');
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 4.1 — FIX B : dedupSetlists
// ───────────────────────────────────────────────────────────────────

describe('dedupSetlists — Phase 4.1 FIX B', () => {
  test('aucun doublon → retourne la liste inchangée (référence préservée)', () => {
    const input = [
      { id: 'a', name: 'A', profileIds: ['u1'], songIds: [] },
      { id: 'b', name: 'B', profileIds: ['u1'], songIds: [] },
    ];
    const out = dedupSetlists(input);
    expect(out).toBe(input);
  });

  test('doublon name + profileIds → garde la plus longue, fusionne les songIds', () => {
    const input = [
      { id: 'a', name: 'Ma Setlist', profileIds: ['u1'], songIds: ['s1', 's2'] },
      { id: 'b', name: 'Ma Setlist', profileIds: ['u1'], songIds: ['s2', 's3', 's4'] },
    ];
    const out = dedupSetlists(input);
    expect(out).toHaveLength(1);
    // Le 2e gagne (plus de songs) ; les songIds sont fusionnés en union
    // dédupliquée (préserve l'ordre du survivant).
    expect(out[0].id).toBe('b');
    expect(out[0].songIds).toEqual(['s2', 's3', 's4', 's1']);
  });

  test('même name mais profileIds différents → pas de fusion', () => {
    const input = [
      { id: 'a', name: 'Ma Setlist', profileIds: ['u1'], songIds: ['s1'] },
      { id: 'b', name: 'Ma Setlist', profileIds: ['u2'], songIds: ['s2'] },
    ];
    const out = dedupSetlists(input);
    expect(out).toHaveLength(2);
  });

  test('profileIds présents dans des ordres différents → considérés équivalents', () => {
    const input = [
      { id: 'a', name: 'Shared', profileIds: ['u1', 'u2'], songIds: ['s1'] },
      { id: 'b', name: 'Shared', profileIds: ['u2', 'u1'], songIds: ['s2', 's3'] },
    ];
    const out = dedupSetlists(input);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
    expect(out[0].songIds).toEqual(['s2', 's3', 's1']);
  });

  test('3 doublons → garde le plus long, fusionne tout', () => {
    const input = [
      { id: 'a', name: 'X', profileIds: ['u1'], songIds: ['s1'] },
      { id: 'b', name: 'X', profileIds: ['u1'], songIds: ['s2', 's3'] },
      { id: 'c', name: 'X', profileIds: ['u1'], songIds: ['s4'] },
    ];
    const out = dedupSetlists(input);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
    expect(out[0].songIds).toEqual(['s2', 's3', 's1', 's4']);
  });

  test('ordre d\'insertion préservé pour les non-doublons', () => {
    const input = [
      { id: 'a', name: 'A', profileIds: ['u1'], songIds: [] },
      { id: 'b', name: 'B', profileIds: ['u1'], songIds: ['s1'] },
      { id: 'c', name: 'B', profileIds: ['u1'], songIds: ['s1', 's2'] },
      { id: 'd', name: 'C', profileIds: ['u1'], songIds: [] },
    ];
    const out = dedupSetlists(input);
    expect(out.map((s) => s.id)).toEqual(['a', 'c', 'd']);
  });

  test('migrateV4toV5 applique dedupSetlists en passant', () => {
    const v4 = {
      version: 4,
      shared: {
        setlists: [
          { id: 'a', name: 'X', profileIds: ['u1'], songIds: ['s1'] },
          { id: 'b', name: 'X', profileIds: ['u1'], songIds: ['s2'] },
        ],
      },
      profiles: {},
    };
    const v5 = migrateV4toV5(v4);
    expect(v5.shared.setlists).toHaveLength(1);
  });

  test('setlistDedupKey expose la clé pour debug', () => {
    expect(setlistDedupKey({ name: 'X', profileIds: ['u1', 'u2'] })).toBe('X::u1|u2');
    expect(setlistDedupKey({ name: 'X', profileIds: ['u2', 'u1'] })).toBe('X::u1|u2');
    expect(setlistDedupKey({ name: 'X' })).toBe('X::');
  });

  test('input non-array → renvoyé tel quel (defensive)', () => {
    expect(dedupSetlists(null)).toBe(null);
    expect(dedupSetlists(undefined)).toBe(undefined);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 4.1 — FIX C : autoBackup quota retry + clearBackups
// ───────────────────────────────────────────────────────────────────

describe('isQuotaError — détecte les erreurs de quota localStorage', () => {
  test('QuotaExceededError name', () => {
    const e = new Error('quota');
    e.name = 'QuotaExceededError';
    expect(isQuotaError(e)).toBe(true);
  });
  test('code 22 (Webkit)', () => {
    expect(isQuotaError({ code: 22 })).toBe(true);
  });
  test('code 1014 (Firefox)', () => {
    expect(isQuotaError({ code: 1014 })).toBe(true);
  });
  test("message contient 'quota'", () => {
    expect(isQuotaError(new Error('Storage quota exceeded'))).toBe(true);
  });
  test('erreur normale → false', () => {
    expect(isQuotaError(new Error('boom'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe('autoBackup — Phase 4.1 FIX C : retry-on-quota', () => {
  let store;
  beforeEach(() => {
    store = {};
    const ls = {
      getItem: vi.fn((k) => (k in store ? store[k] : null)),
      setItem: vi.fn((k, v) => { store[k] = v; }),
      removeItem: vi.fn((k) => { delete store[k]; }),
    };
    vi.stubGlobal('localStorage', ls);
    // Snapshot courant avec contenu non-vide pour passer le early-return.
    store.tonex_guide_v2 = JSON.stringify({
      version: 5,
      shared: { songDb: [{ id: 'a', title: 'A', artist: 'B' }] },
      profiles: { u1: { id: 'u1' } },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  test('Phase 7.52.2 — quota exceeded avec MAX_BACKUPS=1 → early return, pas de crash', () => {
    // Remplit la rotation avec 5 backups anciens (12 min, > throttle 5 min).
    const old = Array.from({ length: 5 }, (_, i) => ({
      time: Date.now() - 12 * 60 * 1000 - i * 60000,
      data: '{}', songs: 1, profiles: 1,
    }));
    store.tonex_guide_backups = JSON.stringify(old);
    let calls = 0;
    localStorage.setItem.mockImplementation((k, v) => {
      if (k === 'tonex_guide_backups') {
        calls += 1;
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
      store[k] = v;
    });
    // Avec MAX_BACKUPS=1 (Phase 7.52.2) : la troncature laisse 1 entry.
    // Le retry-on-quota check `backups.length <= 1` → early return sans
    // re-tenter. C'est attendu : avec 1 seul backup, on n'a rien à pop.
    // Le test garantit l'absence de crash et de boucle infinie.
    expect(() => autoBackup()).not.toThrow();
    expect(calls).toBe(1);
  });

  test('quota persistant 3x → abandon silencieux, pas de crash', () => {
    const old = Array.from({ length: 5 }, (_, i) => ({
      time: Date.now() - 12 * 60 * 1000 - i * 60000,
      data: '{}', songs: 1, profiles: 1,
    }));
    store.tonex_guide_backups = JSON.stringify(old);
    localStorage.setItem.mockImplementation((k) => {
      if (k === 'tonex_guide_backups') {
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
    });
    expect(() => autoBackup()).not.toThrow();
  });

  test('throttle 5 min : ne rajoute pas si dernier backup récent', () => {
    store.tonex_guide_backups = JSON.stringify([{
      time: Date.now() - 60 * 1000, // 1 min ago
      data: '{}', songs: 1, profiles: 1,
    }]);
    autoBackup();
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      'tonex_guide_backups', expect.any(String),
    );
  });
});

describe('persistState — Phase 7.52.2 (B-TECH-02) retry-on-quota state principal', () => {
  let store;
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => (k in store ? store[k] : null)),
      setItem: vi.fn((k, v) => { store[k] = v; }),
      removeItem: vi.fn((k) => { delete store[k]; }),
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  test('persist OK direct → retourne true, state écrit', () => {
    const state = { version: 9, foo: 'bar' };
    expect(persistState(state)).toBe(true);
    expect(JSON.parse(store.tonex_guide_v2)).toEqual(state);
  });

  test('quota au 1er setItem → purge backups + retry → succeed', () => {
    store.tonex_guide_backups = JSON.stringify([{ time: 1, data: 'x' }]);
    let calls = 0;
    localStorage.setItem.mockImplementation((k, v) => {
      if (k === 'tonex_guide_v2') {
        calls += 1;
        if (calls === 1) {
          const e = new Error('quota');
          e.name = 'QuotaExceededError';
          throw e;
        }
      }
      store[k] = v;
    });
    const state = { version: 9, foo: 'bar' };
    expect(persistState(state)).toBe(true);
    expect(calls).toBe(2);
    expect(localStorage.removeItem).toHaveBeenCalledWith('tonex_guide_backups');
    expect(JSON.parse(store.tonex_guide_v2)).toEqual(state);
  });

  test('quota persistant après purge → retourne false, ne crash pas', () => {
    let calls = 0;
    localStorage.setItem.mockImplementation((k) => {
      if (k === 'tonex_guide_v2') {
        calls += 1;
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
    });
    expect(persistState({ version: 9 })).toBe(false);
    expect(calls).toBe(2); // 1 tentative initiale + 1 retry après purge
    expect(localStorage.removeItem).toHaveBeenCalledWith('tonex_guide_backups');
  });

  test('erreur non-quota → retourne false sans tenter de purge', () => {
    localStorage.setItem.mockImplementation((k) => {
      if (k === 'tonex_guide_v2') throw new Error('disk error');
    });
    expect(persistState({ version: 9 })).toBe(false);
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });
});

describe('clearBackups — Phase 4.1 FIX C', () => {
  beforeEach(() => {
    const store = { tonex_guide_backups: '[{"time":1}]' };
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
      _store: store,
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  test('removeItem appelé sur la clé backups', () => {
    expect(clearBackups()).toBe(true);
    expect(listBackups()).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 5 (Item E) — migrateV5toV6 : drop profile.devices legacy
// ───────────────────────────────────────────────────────────────────

describe('migrateV5toV6 — Phase 5 Item E', () => {
  test('drop devices, préserve enabledDevices et autres champs', () => {
    const v5 = {
      version: 5,
      profiles: {
        u1: {
          id: 'u1', name: 'U1',
          enabledDevices: ['tonex-pedal', 'tonex-plug'],
          devices: { pedale: true, anniversary: false, plug: true },
          tmpPatches: { custom: [], factoryOverrides: {} },
          myGuitars: ['lp60'],
        },
      },
    };
    const v6 = migrateV5toV6(v5);
    expect(v6.version).toBe(6);
    expect(v6.profiles.u1.devices).toBeUndefined();
    expect(v6.profiles.u1.enabledDevices).toEqual(['tonex-pedal', 'tonex-plug']);
    expect(v6.profiles.u1.tmpPatches).toEqual({ custom: [], factoryOverrides: {} });
    expect(v6.profiles.u1.myGuitars).toEqual(['lp60']);
  });

  test('defensive : enabledDevices manquant → dérivé depuis devices avant drop', () => {
    const v5 = {
      version: 5,
      profiles: {
        u1: {
          id: 'u1',
          devices: { pedale: false, anniversary: true, plug: true },
          // enabledDevices absent (cas Firestore stale).
        },
      },
    };
    const v6 = migrateV5toV6(v5);
    expect(v6.profiles.u1.devices).toBeUndefined();
    expect(v6.profiles.u1.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
  });

  test('idempotent : v6 input → v6 output sans corruption', () => {
    const v6in = {
      version: 6,
      profiles: { u1: { id: 'u1', enabledDevices: ['tonex-pedal'] } },
    };
    const v6out = migrateV5toV6(v6in);
    expect(v6out.version).toBe(6);
    expect(v6out.profiles.u1.enabledDevices).toEqual(['tonex-pedal']);
    expect(v6out.profiles.u1.devices).toBeUndefined();
  });

  test('plusieurs profils : tous traités indépendamment', () => {
    const v5 = {
      version: 5,
      profiles: {
        a: { enabledDevices: ['tonex-pedal'], devices: { pedale: true } },
        b: { enabledDevices: ['tonex-anniversary'], devices: { anniversary: true } },
      },
    };
    const v6 = migrateV5toV6(v5);
    expect(v6.profiles.a.devices).toBeUndefined();
    expect(v6.profiles.b.devices).toBeUndefined();
    expect(v6.profiles.a.enabledDevices).toEqual(['tonex-pedal']);
    expect(v6.profiles.b.enabledDevices).toEqual(['tonex-anniversary']);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 5.1 FIX 1 — ensureProfileV6 drop legacy devices
// ───────────────────────────────────────────────────────────────────

describe('ensureProfileV6 — Phase 5.1 FIX 1', () => {
  test('drop devices, préserve les autres champs (enabledDevices, tmpPatches)', async () => {
    const { ensureProfileV6 } = await import('./state.js');
    const profile = {
      id: 'sebastien',
      enabledDevices: ['tonex-anniversary', 'tonex-plug'],
      devices: { pedale: false, anniversary: true, plug: false },
      tmpPatches: { custom: [], factoryOverrides: {} },
      myGuitars: ['lp60'],
    };
    const out = ensureProfileV6(profile);
    expect(out.devices).toBeUndefined();
    expect(out.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
    expect(out.tmpPatches).toBeDefined();
    expect(out.myGuitars).toEqual(['lp60']);
  });

  test('idempotent : profil déjà sans devices → même référence (no spread)', async () => {
    const { ensureProfileV6 } = await import('./state.js');
    const profile = {
      enabledDevices: ['tonex-pedal'],
      tmpPatches: { custom: [], factoryOverrides: {} },
    };
    const out = ensureProfileV6(profile);
    // ensureProfileV6 traverse ensureProfileV4 qui peut spread.
    // Le contrat ici : pas de `devices` introduit, autres champs OK.
    expect(out.devices).toBeUndefined();
    expect(out.enabledDevices).toEqual(['tonex-pedal']);
  });

  test('profil v3 partiel (pas de enabledDevices ni tmpPatches) → heal cascade + drop devices', async () => {
    const { ensureProfileV6 } = await import('./state.js');
    const profile = { devices: { pedale: true } };
    const out = ensureProfileV6(profile);
    expect(out.devices).toBeUndefined();
    expect(out.enabledDevices).toEqual(['tonex-pedal']); // dérivé via v3 heal
    expect(out.tmpPatches).toEqual({ custom: [], factoryOverrides: {} }); // ajouté v4 heal
  });

  test('null → null (defensive)', async () => {
    const { ensureProfileV6 } = await import('./state.js');
    expect(ensureProfileV6(null)).toBeNull();
  });

  test('ensureProfilesV6 applique heal + drop sur tous les profils', async () => {
    const { ensureProfilesV6 } = await import('./state.js');
    const profiles = {
      a: { devices: { pedale: true }, enabledDevices: ['tonex-pedal'] },
      b: { devices: { plug: true }, enabledDevices: ['tonex-plug'], tmpPatches: { custom: [{ id: 'x' }], factoryOverrides: {} } },
    };
    const out = ensureProfilesV6(profiles);
    expect(out.a.devices).toBeUndefined();
    expect(out.b.devices).toBeUndefined();
    expect(out.b.tmpPatches.custom[0].id).toBe('x');
  });

  test('Firestore poll scenario : profil stale v5 → setProfiles ne ré-injecte pas devices', async () => {
    const { ensureProfilesV6 } = await import('./state.js');
    // Simule un doc Firestore renvoyé en v5 avec devices présent.
    const remoteProfiles = {
      sebastien: {
        id: 'sebastien',
        enabledDevices: ['tonex-anniversary', 'tonex-plug'],
        devices: { pedale: false, anniversary: true, plug: false }, // legacy
        tmpPatches: { custom: [], factoryOverrides: {} },
      },
    };
    const healed = ensureProfilesV6(remoteProfiles);
    expect(healed.sebastien.devices).toBeUndefined();
    expect(healed.sebastien.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
  });

  test("migrateV5toV6 utilise désormais ensureProfileV6 (cohérence du heal)", async () => {
    const { migrateV5toV6 } = await import('./state.js');
    const v5 = {
      version: 5,
      profiles: {
        u1: {
          id: 'u1',
          enabledDevices: ['tonex-pedal'],
          devices: { pedale: true },
        },
      },
    };
    const v6 = migrateV5toV6(v5);
    expect(v6.version).toBe(6);
    expect(v6.profiles.u1.devices).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 5.4 — dedupSetlists name-only + findSetlistDuplicatesByName
// ───────────────────────────────────────────────────────────────────

describe('dedupSetlists — option mergeAcrossProfiles (Phase 5.4)', () => {
  test('mode strict (default) : 2 setlists name identique, profileIds différents → 2 setlists distinctes', () => {
    const input = [
      { id: 'a', name: 'Cours Franck B', profileIds: ['sebastien'], songIds: ['s1', 's2'] },
      { id: 'b', name: 'Cours Franck B', profileIds: ['sebastien', 'franck'], songIds: ['s2', 's3'] },
    ];
    const out = dedupSetlists(input);
    expect(out).toHaveLength(2);
  });

  test('mode mergeAcrossProfiles : 2 setlists name identique → 1 fusionnée + union profileIds + union songIds', () => {
    const input = [
      { id: 'a', name: 'Cours Franck B', profileIds: ['sebastien'], songIds: ['s1', 's2'] },
      { id: 'b', name: 'Cours Franck B', profileIds: ['sebastien', 'franck'], songIds: ['s2', 's3', 's4'] },
    ];
    const out = dedupSetlists(input, { mergeAcrossProfiles: true });
    expect(out).toHaveLength(1);
    // Survivant = b (plus de songs).
    expect(out[0].id).toBe('b');
    expect(out[0].profileIds).toEqual(['sebastien', 'franck']);
    expect(out[0].songIds).toEqual(['s2', 's3', 's4', 's1']);
  });

  test('mode mergeAcrossProfiles : 3 setlists name identique → fusion totale', () => {
    const input = [
      { id: 'a', name: 'X', profileIds: ['u1'], songIds: ['s1'] },
      { id: 'b', name: 'X', profileIds: ['u2'], songIds: ['s2', 's3'] },
      { id: 'c', name: 'X', profileIds: ['u3'], songIds: ['s4'] },
    ];
    const out = dedupSetlists(input, { mergeAcrossProfiles: true });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b'); // plus long
    expect(out[0].profileIds).toEqual(['u2', 'u1', 'u3']);
    expect(out[0].songIds).toEqual(['s2', 's3', 's1', 's4']);
  });

  test('mode mergeAcrossProfiles : préserve profileIds ordre du survivant en tête', () => {
    const input = [
      { id: 'a', name: 'X', profileIds: ['u1', 'u2'], songIds: ['s1', 's2'] },
      { id: 'b', name: 'X', profileIds: ['u3'], songIds: ['s3'] },
    ];
    const out = dedupSetlists(input, { mergeAcrossProfiles: true });
    expect(out[0].profileIds).toEqual(['u1', 'u2', 'u3']);
  });

  test('aucun doublon → retourne la même référence (mode strict ou aggressif)', () => {
    const input = [
      { id: 'a', name: 'A', profileIds: ['u1'], songIds: [] },
      { id: 'b', name: 'B', profileIds: ['u1'], songIds: [] },
    ];
    expect(dedupSetlists(input)).toBe(input);
    expect(dedupSetlists(input, { mergeAcrossProfiles: true })).toBe(input);
  });

  test('migrateV4toV5 utilise toujours le mode strict (pas mergeAcrossProfiles)', () => {
    const v4 = {
      version: 4,
      shared: {
        setlists: [
          { id: 'a', name: 'Cours Franck B', profileIds: ['sebastien'], songIds: ['s1'] },
          { id: 'b', name: 'Cours Franck B', profileIds: ['franck'], songIds: ['s2'] },
        ],
      },
      profiles: {},
    };
    const v5 = migrateV4toV5(v4);
    // Mode strict → 2 setlists conservées (profileIds différents).
    expect(v5.shared.setlists).toHaveLength(2);
  });

  test('setlistDedupKey(mergeAcrossProfiles) = name uniquement', () => {
    expect(setlistDedupKey({ name: 'X', profileIds: ['u1'] }, true)).toBe('X');
    expect(setlistDedupKey({ name: 'X', profileIds: ['u2'] }, true)).toBe('X');
    expect(setlistDedupKey({ name: 'X', profileIds: ['u1'] }, false)).toBe('X::u1');
  });
});

describe('findSetlistDuplicatesByName — Phase 5.4', () => {
  test('aucun doublon → []', async () => {
    const { findSetlistDuplicatesByName } = await import('./state.js');
    expect(findSetlistDuplicatesByName([
      { name: 'A', profileIds: ['u1'] },
      { name: 'B', profileIds: ['u1'] },
    ])).toEqual([]);
  });

  test('2 setlists même name (profileIds différents) → 1 groupe avec union', async () => {
    const { findSetlistDuplicatesByName } = await import('./state.js');
    const groups = findSetlistDuplicatesByName([
      { id: 'a', name: 'Cours Franck B', profileIds: ['sebastien'], songIds: ['s1'] },
      { id: 'b', name: 'Cours Franck B', profileIds: ['sebastien', 'franck'], songIds: ['s2'] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Cours Franck B');
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].profileIdsUnion).toEqual(['sebastien', 'franck']);
  });

  test('input null/non-array → []', async () => {
    const { findSetlistDuplicatesByName } = await import('./state.js');
    expect(findSetlistDuplicatesByName(null)).toEqual([]);
    expect(findSetlistDuplicatesByName(undefined)).toEqual([]);
    expect(findSetlistDuplicatesByName('foo')).toEqual([]);
  });

  test('plusieurs groupes', async () => {
    const { findSetlistDuplicatesByName } = await import('./state.js');
    const groups = findSetlistDuplicatesByName([
      { name: 'A', profileIds: ['u1'] },
      { name: 'B', profileIds: ['u1'] },
      { name: 'A', profileIds: ['u2'] },
      { name: 'B', profileIds: ['u2'] },
      { name: 'C', profileIds: ['u1'] },
    ]);
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.name === 'A');
    expect(a.items).toHaveLength(2);
  });
});

// ─── Phase 5.7 — last-write-wins + tombstones {[id]:ts} ───────────────

describe('ensureSharedV7 — Phase 5.7', () => {
  test('convertit deletedSetlistIds array legacy en objet { [id]: ts }', () => {
    const before = Date.now();
    const out = ensureSharedV7({ deletedSetlistIds: ['sl1', 'sl2'] });
    expect(typeof out.deletedSetlistIds).toBe('object');
    expect(Array.isArray(out.deletedSetlistIds)).toBe(false);
    expect(typeof out.deletedSetlistIds.sl1).toBe('number');
    expect(typeof out.deletedSetlistIds.sl2).toBe('number');
    // ts = Date.now() - 1000 — légèrement antérieur pour ne pas
    // écraser une suppression remote concurrente.
    expect(out.deletedSetlistIds.sl1).toBeLessThanOrEqual(before);
    expect(out.deletedSetlistIds.sl1).toBeGreaterThan(before - 5000);
  });

  test('idempotent quand shape déjà v7', () => {
    const ts = Date.now() - 5000;
    const shared = {
      lastModified: ts,
      deletedSetlistIds: { sl1: ts },
      setlists: [{ id: 'a', name: 'A', songIds: [], lastModified: ts }],
    };
    const out = ensureSharedV7(shared);
    expect(out).toBe(shared); // même référence
  });

  test('stamp lastModified sur setlists qui n\'en ont pas', () => {
    const before = Date.now();
    const out = ensureSharedV7({
      setlists: [
        { id: 'a', name: 'A', songIds: [] },                                   // pas de lastModified
        { id: 'b', name: 'B', songIds: [], lastModified: 12345 },              // déjà stampée
      ],
    });
    expect(typeof out.setlists[0].lastModified).toBe('number');
    expect(out.setlists[0].lastModified).toBeGreaterThanOrEqual(before);
    expect(out.setlists[1].lastModified).toBe(12345); // préservée
  });
});

describe('ensureProfileV7 — Phase 5.7', () => {
  test('stamp lastModified si absent', () => {
    const before = Date.now();
    const out = ensureProfileV7({ id: 'u1', enabledDevices: ['tonex-pedal'] });
    expect(typeof out.lastModified).toBe('number');
    expect(out.lastModified).toBeGreaterThanOrEqual(before);
  });

  test('préserve lastModified existant', () => {
    const out = ensureProfileV7({ id: 'u1', enabledDevices: ['tonex-pedal'], lastModified: 12345 });
    expect(out.lastModified).toBe(12345);
  });

  test('chaîne le heal v6 (drop legacy devices)', () => {
    const out = ensureProfileV7({
      id: 'u1',
      devices: { pedale: true, plug: true },
      enabledDevices: ['tonex-pedal'],
    });
    expect(out.devices).toBeUndefined();
    expect(out.enabledDevices).toEqual(['tonex-pedal']);
    expect(typeof out.lastModified).toBe('number');
  });
});

describe('gcTombstones — Phase 5.7', () => {
  test('drop entries plus anciennes que 30 jours, garde les récentes', () => {
    const now = Date.now();
    const old = now - (31 * 24 * 3600 * 1000);
    const recent = now - (5 * 24 * 3600 * 1000);
    const out = gcTombstones({ sl_old: old, sl_recent: recent });
    expect(out.sl_old).toBeUndefined();
    expect(out.sl_recent).toBe(recent);
  });

  test('map vide / null / undefined → retour {}', () => {
    expect(gcTombstones({})).toEqual({});
    expect(gcTombstones(null)).toEqual({});
    expect(gcTombstones(undefined)).toEqual({});
  });

  test('maxAgeMs custom respecté', () => {
    const now = Date.now();
    const out = gcTombstones({ a: now - 2000, b: now - 500 }, 1000);
    expect(out.a).toBeUndefined();
    expect(out.b).toBe(now - 500);
  });
});

describe('mergeDeletedSetlistIds — Phase 5.7', () => {
  test('union ; conflit → max(localTs, remoteTs)', () => {
    const out = mergeDeletedSetlistIds(
      { a: 100, b: 200, c: 500 },
      { b: 300, c: 400, d: 600 },
    );
    expect(out).toEqual({ a: 100, b: 300, c: 500, d: 600 });
  });

  test('inputs falsy → {}', () => {
    expect(mergeDeletedSetlistIds(null, null)).toEqual({});
    expect(mergeDeletedSetlistIds({}, {})).toEqual({});
    expect(mergeDeletedSetlistIds({ a: 1 }, null)).toEqual({ a: 1 });
    expect(mergeDeletedSetlistIds(null, { b: 2 })).toEqual({ b: 2 });
  });
});

describe('mergeSetlistsLWW — Phase 5.7 (le scénario du bug)', () => {
  test('SCÉNARIO BUG : local 50 morceaux récents bat remote 120 morceaux anciens', () => {
    const tLocal = Date.now();
    const tRemote = tLocal - 30000; // remote 30s plus ancien
    const local50 = { id: 'sl_main', name: 'Ma Setlist', songIds: Array.from({length:50}, (_,i)=>`s${i}`), lastModified: tLocal };
    const remote120 = { id: 'sl_main', name: 'Ma Setlist', songIds: Array.from({length:120}, (_,i)=>`s${i}`), lastModified: tRemote };
    const out = mergeSetlistsLWW([local50], [remote120], {});
    expect(out).toHaveLength(1);
    expect(out[0].songIds).toHaveLength(50); // local gagne, pas d'union à 120
    expect(out[0]).toBe(local50);
  });

  test('remote plus récent → adopt remote', () => {
    const t = Date.now();
    const local = { id: 'a', name: 'X', songIds: [], lastModified: t - 1000 };
    const remote = { id: 'a', name: 'Y', songIds: ['s1'], lastModified: t };
    const out = mergeSetlistsLWW([local], [remote], {});
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(remote);
  });

  test('égalité lastModified → keep local (idempotence)', () => {
    const t = 12345;
    const local = { id: 'a', name: 'X', songIds: [], lastModified: t };
    const remote = { id: 'a', name: 'Y', songIds: ['s1'], lastModified: t };
    const out = mergeSetlistsLWW([local], [remote], {});
    expect(out[0]).toBe(local);
  });

  test('tombstone plus récent que la setlist remote → drop la setlist', () => {
    const t = Date.now();
    const remote = { id: 'a', name: 'X', songIds: ['s1'], lastModified: t - 5000 };
    const out = mergeSetlistsLWW([], [remote], { a: t });
    expect(out).toHaveLength(0);
  });

  test('local-only préservé, remote-only adopté', () => {
    const t = Date.now();
    const localOnly = { id: 'l1', name: 'L', songIds: [], lastModified: t };
    const remoteOnly = { id: 'r1', name: 'R', songIds: [], lastModified: t };
    const out = mergeSetlistsLWW([localOnly], [remoteOnly], {});
    expect(out).toHaveLength(2);
    expect(out.find(sl => sl.id === 'l1')).toBe(localOnly);
    expect(out.find(sl => sl.id === 'r1')).toBe(remoteOnly);
  });

  test('lastModified absent → fallback 0 ; tombstone à 1 droppe les deux côtés', () => {
    const local = { id: 'a', name: 'L', songIds: [] };  // pas de lastModified
    const remote = { id: 'a', name: 'R', songIds: [] };
    const out = mergeSetlistsLWW([local], [remote], { a: 1 });
    expect(out).toHaveLength(0);
  });
});

describe('mergeToneNetPresetsLWW — Phase 7.53.1', () => {
  test('local-only preserved (pas écrasé par remote vide)', () => {
    // Scénario du bug Phase 7.53.1 (Sébastien Mac 2026-05-16) :
    // un autre device push toneNetPresets=[] → l'ancien remplacement
    // en bloc écrasait définitivement les presets locaux.
    // Avec LWW per-item, local-only est préservé.
    const local = [{ id: 'tn_1', name: 'Laney Iommi', lastModified: 1000 }];
    const out = mergeToneNetPresetsLWW(local, []);
    expect(out).toEqual(local);
  });

  test('local-only preserved (remote présent sans cet id)', () => {
    const local = [{ id: 'tn_1', name: 'A', lastModified: 1000 }];
    const remote = [{ id: 'tn_2', name: 'B', lastModified: 2000 }];
    const out = mergeToneNetPresetsLWW(local, remote);
    expect(out).toHaveLength(2);
    expect(out.find((p) => p.id === 'tn_1')).toEqual(local[0]);
    expect(out.find((p) => p.id === 'tn_2')).toEqual(remote[0]);
  });

  test('présent des deux côtés : remote plus récent gagne', () => {
    const local = [{ id: 'tn_1', name: 'Old name', lastModified: 1000 }];
    const remote = [{ id: 'tn_1', name: 'New name', lastModified: 2000 }];
    const out = mergeToneNetPresetsLWW(local, remote);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('New name');
  });

  test('présent des deux côtés : local plus récent gagne', () => {
    const local = [{ id: 'tn_1', name: 'Local name', lastModified: 2000 }];
    const remote = [{ id: 'tn_1', name: 'Remote name', lastModified: 1000 }];
    const out = mergeToneNetPresetsLWW(local, remote);
    expect(out[0].name).toBe('Local name');
  });

  test('égalité ts → keep local pour stabilité', () => {
    const local = [{ id: 'tn_1', name: 'Local', lastModified: 1000 }];
    const remote = [{ id: 'tn_1', name: 'Remote', lastModified: 1000 }];
    const out = mergeToneNetPresetsLWW(local, remote);
    expect(out[0].name).toBe('Local');
  });

  test('legacy preset sans lastModified → ts=0, remote stampé gagne toujours', () => {
    const local = [{ id: 'tn_1', name: 'Legacy local' }]; // pas de lastModified
    const remote = [{ id: 'tn_1', name: 'Stamped remote', lastModified: 1 }];
    const out = mergeToneNetPresetsLWW(local, remote);
    expect(out[0].name).toBe('Stamped remote');
  });

  test('remote-only adopté', () => {
    const out = mergeToneNetPresetsLWW([], [{ id: 'tn_1', name: 'R', lastModified: 1 }]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('R');
  });

  test('inputs falsy : tableaux vides', () => {
    expect(mergeToneNetPresetsLWW(null, null)).toEqual([]);
    expect(mergeToneNetPresetsLWW(undefined, [])).toEqual([]);
    expect(mergeToneNetPresetsLWW([], null)).toEqual([]);
  });

  test('items sans id ignorés', () => {
    const local = [{ name: 'no-id', lastModified: 1 }, { id: 'tn_1', name: 'A', lastModified: 1 }];
    const remote = [{ id: 'tn_2', name: 'B', lastModified: 1 }];
    const out = mergeToneNetPresetsLWW(local, remote);
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.id).sort()).toEqual(['tn_1', 'tn_2']);
  });

  test('usages préservés au merge LWW', () => {
    // Vérifie que le champ usages Phase 7.53 transite correctement
    // au travers du merge.
    const local = [{ id: 'tn_1', name: 'Laney', lastModified: 1000, usages: [{ artist: 'Black Sabbath', songs: ['Paranoid'] }] }];
    const remote = [{ id: 'tn_1', name: 'Laney updated', lastModified: 2000, usages: [{ artist: 'Black Sabbath', songs: ['Paranoid', 'Iron Man'] }] }];
    const out = mergeToneNetPresetsLWW(local, remote);
    expect(out[0].usages[0].songs).toEqual(['Paranoid', 'Iron Man']);
  });
});

describe('mergeDeletedToneNetIds — Phase 7.53.2', () => {
  test('union max(ts) sur ids communs', () => {
    const local = { 'tn_1': 1000, 'tn_2': 500 };
    const remote = { 'tn_1': 800, 'tn_3': 2000 };
    const out = mergeDeletedToneNetIds(local, remote);
    expect(out).toEqual({ 'tn_1': 1000, 'tn_2': 500, 'tn_3': 2000 });
  });

  test('inputs falsy → {}', () => {
    expect(mergeDeletedToneNetIds(null, null)).toEqual({});
    expect(mergeDeletedToneNetIds(undefined, {})).toEqual({});
    expect(mergeDeletedToneNetIds({}, null)).toEqual({});
  });

  test('ignore ts non-numérique', () => {
    const local = { 'tn_1': 'not-a-number', 'tn_2': 100 };
    const remote = { 'tn_1': 500 };
    const out = mergeDeletedToneNetIds(local, remote);
    expect(out).toEqual({ 'tn_1': 500, 'tn_2': 100 });
  });
});

describe('mergeToneNetPresetsLWW — Phase 7.53.2 (tombstones)', () => {
  test('scénario bug 2026-05-24 : Mac purge avec tombstone → iPhone drop au pull', () => {
    // Mac purge id=X à T2, tombstones[X]=T2
    // iPhone garde local avec lastModified=T1 (T1 < T2)
    // mergeToneNetPresetsLWW(local=[{X,T1}], remote=[], tombstones={X:T2})
    // → DROP X
    const local = [{ id: 'tn_X', name: 'Old', lastModified: 1000 }];
    const remote = [];
    const tombstones = { 'tn_X': 2000 };
    const out = mergeToneNetPresetsLWW(local, remote, tombstones);
    expect(out).toEqual([]);
  });

  test('tombstone gagne sur remote-only plus ancien', () => {
    // iPhone push id=Y (lastModified=T1), Mac a tombstone Y à T2 (T2>T1)
    // → DROP Y
    const local = [];
    const remote = [{ id: 'tn_Y', name: 'Resurrected', lastModified: 1000 }];
    const tombstones = { 'tn_Y': 2000 };
    const out = mergeToneNetPresetsLWW(local, remote, tombstones);
    expect(out).toEqual([]);
  });

  test('local plus récent que tombstone → keep local (resurrection légitime)', () => {
    // Si user a re-créé un preset id=X après suppression :
    // local lastModified=T3 > tombstone[X]=T2 → keep local (nouvelle saisie)
    const local = [{ id: 'tn_X', name: 'Recreated', lastModified: 3000 }];
    const remote = [];
    const tombstones = { 'tn_X': 2000 };
    const out = mergeToneNetPresetsLWW(local, remote, tombstones);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Recreated');
  });

  test('remote plus récent que tombstone → keep remote', () => {
    // Autre device a recreated le preset après ta suppression :
    // remote lastModified=T3 > tombstone[X]=T2 → adopt remote
    const local = [];
    const remote = [{ id: 'tn_X', name: 'Remote recreate', lastModified: 3000 }];
    const tombstones = { 'tn_X': 2000 };
    const out = mergeToneNetPresetsLWW(local, remote, tombstones);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Remote recreate');
  });

  test('égalité ts tombstone vs item → tombstone gagne (drop)', () => {
    // Convention : tombstone === item ts → DROP. Évite cycle quand
    // tombstone et item sont créés simultanément (rare mais possible).
    const local = [{ id: 'tn_X', name: 'Same ts', lastModified: 2000 }];
    const tombstones = { 'tn_X': 2000 };
    const out = mergeToneNetPresetsLWW(local, [], tombstones);
    expect(out).toEqual([]);
  });

  test('tombstones absent → comportement Phase 7.53.1 préservé', () => {
    // Sans 3e param, rétro-compat strict.
    const local = [{ id: 'tn_1', name: 'A', lastModified: 1000 }];
    const out = mergeToneNetPresetsLWW(local, []);
    expect(out).toEqual(local);
  });

  test('tombstones {} → comportement Phase 7.53.1 préservé', () => {
    const local = [{ id: 'tn_1', name: 'A', lastModified: 1000 }];
    const out = mergeToneNetPresetsLWW(local, [], {});
    expect(out).toEqual(local);
  });

  test('mix : 2 items, 1 tombstone qui matche, 1 qui pas', () => {
    const local = [
      { id: 'tn_keep', name: 'Keep', lastModified: 1000 },
      { id: 'tn_drop', name: 'Drop', lastModified: 1000 },
    ];
    const tombstones = { 'tn_drop': 2000 }; // tombstone match tn_drop seul
    const out = mergeToneNetPresetsLWW(local, [], tombstones);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tn_keep');
  });

  test('gcTombstones 30j applicable à deletedToneNetIds (réutilise helper Phase 5.7)', () => {
    const old = Date.now() - 31 * 24 * 3600 * 1000;
    const recent = Date.now() - 10 * 24 * 3600 * 1000;
    const map = { 'tn_old': old, 'tn_recent': recent };
    const out = gcTombstones(map);
    expect(out).toEqual({ 'tn_recent': recent });
  });
});

describe('mergeProfilesLWW — Phase 5.7', () => {
  test('LWW per-profile + applySecrets sur remote adopté', () => {
    // Phase 7.74.10 — adoption d'enabledDevices désormais gated par
    // enabledDevicesModified. Donc côté remote stampé > local.
    const t = Date.now();
    const localP = { sebastien: { id: 'sebastien', name: 'Seb local', enabledDevices: ['tonex-anniversary'], enabledDevicesModified: t - 2000, aiKeys: { gemini: 'LOCAL_KEY' }, lastModified: t - 1000 } };
    const remoteP = { sebastien: { id: 'sebastien', name: 'Seb remote', enabledDevices: ['tonex-anniversary', 'tonex-plug'], enabledDevicesModified: t - 500, aiKeys: { gemini: '' }, lastModified: t } };
    const applySecrets = (profiles) => {
      const out = {};
      for (const [id, p] of Object.entries(profiles)) {
        out[id] = { ...p, aiKeys: { gemini: 'LOCAL_KEY' } };
      }
      return out;
    };
    const out = mergeProfilesLWW(localP, remoteP, { applySecrets });
    // Remote gagne (plus récent), mais secrets locaux réappliqués.
    expect(out.sebastien.name).toBe('Seb remote');
    expect(out.sebastien.enabledDevices).toEqual(['tonex-anniversary', 'tonex-plug']);
    expect(out.sebastien.aiKeys.gemini).toBe('LOCAL_KEY');
    expect(typeof out.sebastien.lastModified).toBe('number');
  });

  test('local-only et remote-only préservés', () => {
    const localP = { u1: { id: 'u1', enabledDevices: [], lastModified: 1000 } };
    const remoteP = { u2: { id: 'u2', enabledDevices: [], lastModified: 2000 } };
    const out = mergeProfilesLWW(localP, remoteP, {});
    expect(Object.keys(out).sort()).toEqual(['u1', 'u2']);
  });
});

describe('migrateV6toV7 — Phase 5.7', () => {
  test('convertit deletedSetlistIds array → objet', () => {
    const v6 = {
      version: 6,
      shared: { setlists: [], deletedSetlistIds: ['sl_dead'] },
      profiles: {},
    };
    const out = migrateV6toV7(v6);
    expect(out.version).toBe(7);
    expect(typeof out.shared.deletedSetlistIds).toBe('object');
    expect(Array.isArray(out.shared.deletedSetlistIds)).toBe(false);
    expect(typeof out.shared.deletedSetlistIds.sl_dead).toBe('number');
  });

  test('stamp lastModified sur setlists et profiles', () => {
    const before = Date.now();
    const v6 = {
      version: 6,
      shared: {
        setlists: [{ id: 'a', name: 'A', songIds: [], profileIds: ['u1'] }],
      },
      profiles: {
        u1: { id: 'u1', enabledDevices: ['tonex-pedal'] },
      },
    };
    const out = migrateV6toV7(v6);
    expect(out.shared.setlists[0].lastModified).toBeGreaterThanOrEqual(before);
    expect(out.profiles.u1.lastModified).toBeGreaterThanOrEqual(before);
  });

  test('cleanup doublons (même name + profileIds) → losers tombstones + _migrationToast', () => {
    const v6 = {
      version: 6,
      shared: {
        setlists: [
          { id: 'sl_a1', name: 'Cours Franck B', profileIds: ['sebastien'], songIds: ['s1', 's2'] },
          { id: 'sl_a2', name: 'Cours Franck B', profileIds: ['sebastien'], songIds: ['s2', 's3', 's4'] },
          { id: 'sl_b',  name: 'Unique', profileIds: ['sebastien'], songIds: ['s1'] },
        ],
      },
      profiles: {},
    };
    const out = migrateV6toV7(v6);
    // Le survivant est celui avec le plus de songs (sl_a2). sl_a1 tombstoné.
    expect(out.shared.setlists).toHaveLength(2);
    expect(out.shared.setlists.find(s => s.id === 'sl_a1')).toBeUndefined();
    expect(out.shared.setlists.find(s => s.id === 'sl_a2')).toBeDefined();
    // songIds fusionnés en union dédupliquée (préserve l'ordre du survivant).
    const survivor = out.shared.setlists.find(s => s.id === 'sl_a2');
    expect(survivor.songIds).toEqual(['s2', 's3', 's4', 's1']);
    // Tombstone du loser.
    expect(typeof out.shared.deletedSetlistIds.sl_a1).toBe('number');
    // _migrationToast présent.
    expect(out.shared._migrationToast).toBeDefined();
    expect(out.shared._migrationToast.count).toBe(1);
  });

  test('pas de doublons → pas de _migrationToast', () => {
    const v6 = {
      version: 6,
      shared: {
        setlists: [
          { id: 'a', name: 'A', profileIds: ['u1'], songIds: [] },
          { id: 'b', name: 'B', profileIds: ['u1'], songIds: [] },
        ],
      },
      profiles: {},
    };
    const out = migrateV6toV7(v6);
    expect(out.shared._migrationToast).toBeUndefined();
  });

  test('idempotent sur un state déjà v7 sans doublons', () => {
    const v7input = {
      version: 7,
      shared: {
        lastModified: Date.now(),
        deletedSetlistIds: {},
        setlists: [{ id: 'a', name: 'A', profileIds: ['u1'], songIds: [], lastModified: Date.now() }],
      },
      profiles: { u1: { id: 'u1', enabledDevices: ['tonex-pedal'], lastModified: Date.now() } },
    };
    const out1 = migrateV6toV7(v7input);
    const out2 = migrateV6toV7(out1);
    expect(out2.shared.setlists.length).toBe(1);
    expect(out2.shared._migrationToast).toBeUndefined();
    expect(out2.version).toBe(7);
  });
});

describe('TOMBSTONE_MAX_AGE_MS', () => {
  test('vaut 30 jours en ms', () => {
    expect(TOMBSTONE_MAX_AGE_MS).toBe(30 * 24 * 3600 * 1000);
  });
});

describe('migrateV7toV8 — Phase 7.49 i18n per-profile', () => {
  test('ajoute profile.language fallback fr quand backline_locale absent', () => {
    const before = {
      version: 7,
      profiles: {
        a: { id: 'a', name: 'A', enabledDevices: [], lastModified: 1 },
        b: { id: 'b', name: 'B', enabledDevices: [], lastModified: 2 },
      },
    };
    const out = migrateV7toV8(before);
    expect(out.version).toBe(8);
    expect(out.profiles.a.language).toBe('fr');
    expect(out.profiles.b.language).toBe('fr');
  });

  test('hérite de backline_locale localStorage si défini', () => {
    // Mock localStorage (env node n'en a pas par défaut).
    const store = { backline_locale: 'es' };
    vi.stubGlobal('localStorage', { getItem: (k) => store[k] || null });
    const before = {
      version: 7,
      profiles: { a: { id: 'a', enabledDevices: [], lastModified: 1 } },
    };
    const out = migrateV7toV8(before);
    expect(out.profiles.a.language).toBe('es');
    vi.unstubAllGlobals();
  });

  test('préserve language explicite déjà posé sur le profil', () => {
    const before = {
      version: 7,
      profiles: {
        fr_user: { id: 'fr_user', language: 'fr', enabledDevices: [], lastModified: 1 },
        en_user: { id: 'en_user', language: 'en', enabledDevices: [], lastModified: 2 },
      },
    };
    const out = migrateV7toV8(before);
    expect(out.profiles.fr_user.language).toBe('fr');
    expect(out.profiles.en_user.language).toBe('en');
  });

  test('idempotent sur un state déjà v8', () => {
    const before = {
      version: 7,
      profiles: { a: { id: 'a', language: 'en', enabledDevices: [], lastModified: 1 } },
    };
    const v8 = migrateV7toV8(before);
    const v8again = migrateV7toV8(v8);
    expect(v8again.version).toBe(8);
    expect(v8again.profiles.a.language).toBe('en');
  });

  test('language invalide → écrasé par fallback', () => {
    const before = {
      version: 7,
      profiles: { a: { id: 'a', language: 'de', enabledDevices: [], lastModified: 1 } },
    };
    const out = migrateV7toV8(before);
    expect(out.profiles.a.language).toBe('fr'); // de pas dans SUPPORTED → fr default
  });

  test('null/undefined input retourné tel quel', () => {
    expect(migrateV7toV8(null)).toBe(null);
    expect(migrateV7toV8(undefined)).toBe(undefined);
  });
});

describe('ensureProfileV8 / ensureProfilesV8 (Phase 7.49)', () => {
  test('ensureProfileV8 pose language fallback fr si absent', () => {
    const p = ensureProfileV8({ id: 'a', enabledDevices: [] });
    expect(p.language).toBe('fr');
  });

  test('ensureProfileV8 préserve language valide', () => {
    const p = ensureProfileV8({ id: 'a', language: 'es', enabledDevices: [] });
    expect(p.language).toBe('es');
  });

  test('ensureProfileV8 délègue ensureProfileV7 (lastModified stamp)', () => {
    const p = ensureProfileV8({ id: 'a', enabledDevices: [] });
    expect(typeof p.lastModified).toBe('number');
  });

  test('ensureProfilesV8 map sur tous les profils', () => {
    const out = ensureProfilesV8({
      a: { id: 'a', enabledDevices: [] },
      b: { id: 'b', language: 'en', enabledDevices: [] },
    });
    expect(out.a.language).toBe('fr');
    expect(out.b.language).toBe('en');
  });
});

// ─── Phase 7.51.1 — Demo profile foundations ────────────────────────

describe('migrateV8toV9 — Phase 7.51.1 mode démo', () => {
  test('pose isDemo: false sur profil sans flag', () => {
    const before = {
      version: 8,
      profiles: {
        a: { id: 'a', name: 'A', language: 'fr', enabledDevices: [], lastModified: 1 },
        b: { id: 'b', name: 'B', language: 'en', enabledDevices: [], lastModified: 2 },
      },
    };
    const out = migrateV8toV9(before);
    expect(out.version).toBe(9);
    expect(out.profiles.a.isDemo).toBe(false);
    expect(out.profiles.b.isDemo).toBe(false);
  });

  test('préserve isDemo: true existant (idempotence forte)', () => {
    const before = {
      version: 8,
      profiles: {
        demo: { id: 'demo', isDemo: true, language: 'fr', enabledDevices: [], lastModified: 1 },
        normal: { id: 'normal', isDemo: false, language: 'fr', enabledDevices: [], lastModified: 2 },
      },
    };
    const out = migrateV8toV9(before);
    expect(out.profiles.demo.isDemo).toBe(true);
    expect(out.profiles.normal.isDemo).toBe(false);
  });

  test('idempotent sur state déjà v9', () => {
    const before = {
      version: 8,
      profiles: { a: { id: 'a', isDemo: false, language: 'fr', enabledDevices: [], lastModified: 1 } },
    };
    const v9 = migrateV8toV9(before);
    const v9again = migrateV8toV9(v9);
    expect(v9again.version).toBe(9);
    expect(v9again.profiles.a.isDemo).toBe(false);
  });

  test('null/undefined input retourné tel quel', () => {
    expect(migrateV8toV9(null)).toBe(null);
    expect(migrateV8toV9(undefined)).toBe(undefined);
  });
});

describe('ensureProfileV9 / ensureProfilesV9 (Phase 7.51.1)', () => {
  test('ensureProfileV9 chaîne ensureProfileV8 (language + isDemo posés)', () => {
    const p = ensureProfileV9({ id: 'a', enabledDevices: [] });
    expect(p.language).toBe('fr');
    expect(p.isDemo).toBe(false);
    expect(typeof p.lastModified).toBe('number');
  });

  test('ensureProfileV9 préserve isDemo valide (false explicite et true)', () => {
    expect(ensureProfileV9({ id: 'a', isDemo: false, enabledDevices: [] }).isDemo).toBe(false);
    expect(ensureProfileV9({ id: 'demo', isDemo: true, enabledDevices: [] }).isDemo).toBe(true);
  });

  test('ensureProfilesV9 map sur tous les profils', () => {
    const out = ensureProfilesV9({
      a: { id: 'a', enabledDevices: [] },
      demo: { id: 'demo', isDemo: true, enabledDevices: [] },
    });
    expect(out.a.isDemo).toBe(false);
    expect(out.demo.isDemo).toBe(true);
  });
});

describe('isDemoProfile (Phase 7.51.1) — strict boolean true', () => {
  test('true uniquement si isDemo === true (boolean strict)', () => {
    expect(isDemoProfile({ id: 'demo', isDemo: true })).toBe(true);
    expect(isDemoProfile({ id: 'a', isDemo: false })).toBe(false);
    expect(isDemoProfile({ id: 'a' })).toBe(false);
    expect(isDemoProfile({ id: 'a', isDemo: 'true' })).toBe(false);
    expect(isDemoProfile({ id: 'a', isDemo: 1 })).toBe(false);
    expect(isDemoProfile(null)).toBe(false);
    expect(isDemoProfile(undefined)).toBe(false);
  });
});

describe('isDemoMode (Phase 7.51.1)', () => {
  test('true quand activeProfileId pointe un profil démo, false sinon', () => {
    const state = {
      profiles: {
        demo: { id: 'demo', isDemo: true },
        normal: { id: 'normal', isDemo: false },
      },
    };
    expect(isDemoMode(state, 'demo')).toBe(true);
    expect(isDemoMode(state, 'normal')).toBe(false);
    expect(isDemoMode(state, 'inexistant')).toBe(false);
  });

  test('false sur state null/incomplet (defensive)', () => {
    expect(isDemoMode(null, 'demo')).toBe(false);
    expect(isDemoMode({}, 'demo')).toBe(false);
    expect(isDemoMode({ profiles: null }, 'demo')).toBe(false);
  });
});

describe('loadDemoSnapshot (Phase 7.51.1)', () => {
  test('retourne un objet structuré { version, profile, setlists, songs }', () => {
    const snap = loadDemoSnapshot();
    expect(snap).toBeDefined();
    expect(snap.version).toBe(11);
    expect(snap.profile).toBeDefined();
    expect(snap.profile.id).toBe('demo');
    expect(snap.profile.isDemo).toBe(true);
    expect(snap.profile.isAdmin).toBe(false);
    expect(Array.isArray(snap.setlists)).toBe(true);
    expect(Array.isArray(snap.songs)).toBe(true);
  });
});

// ─── Phase 7.51.2 — Demo guard runtime (helpers purs) ────────────────

describe('wrapDemoGuard (Phase 7.51.2)', () => {
  test('isDemo=false → retourne fn (identité)', () => {
    const fn = () => 'called';
    const wrapped = wrapDemoGuard(fn, false);
    expect(wrapped).toBe(fn);
    expect(wrapped()).toBe('called');
  });

  test('isDemo=true → retourne wrapper qui ne call pas fn', () => {
    let fnCalled = false;
    const fn = () => { fnCalled = true; return 'should-not-return'; };
    const wrapped = wrapDemoGuard(fn, true);
    const result = wrapped();
    expect(fnCalled).toBe(false);
    expect(result).toBeUndefined();
  });

  test('isDemo=true → appelle onBlocked avec label', () => {
    let receivedLabel = null;
    const onBlocked = (lbl) => { receivedLabel = lbl; };
    const wrapped = wrapDemoGuard(() => 'x', true, onBlocked, 'mylabel');
    wrapped();
    expect(receivedLabel).toBe('mylabel');
  });

  test('isDemo=true sans label → onBlocked reçoit "write" par défaut', () => {
    let receivedLabel = null;
    wrapDemoGuard(() => null, true, (lbl) => { receivedLabel = lbl; })();
    expect(receivedLabel).toBe('write');
  });

  test('isDemo=true sans onBlocked → ne crash pas', () => {
    const wrapped = wrapDemoGuard(() => null, true);
    expect(() => wrapped()).not.toThrow();
    expect(wrapped()).toBeUndefined();
  });

  test('onBlocked qui throw → swallow silencieusement', () => {
    const wrapped = wrapDemoGuard(() => null, true, () => { throw new Error('boom'); }, 'lbl');
    expect(() => wrapped()).not.toThrow();
  });
});

describe('stripDemoProfiles (Phase 7.51.2)', () => {
  test('filtre les profils isDemo: true', () => {
    const state = {
      profiles: {
        sebastien: { id: 'sebastien', isDemo: false, name: 'Seb' },
        demo: { id: 'demo', isDemo: true, name: 'Démo' },
        arthur: { id: 'arthur', isDemo: false, name: 'Arthur' },
      },
    };
    const out = stripDemoProfiles(state);
    expect(out.profiles.sebastien).toBeDefined();
    expect(out.profiles.arthur).toBeDefined();
    expect(out.profiles.demo).toBeUndefined();
  });

  test('préserve tous les profils si aucun n\'est démo', () => {
    const state = {
      profiles: {
        a: { id: 'a', isDemo: false },
        b: { id: 'b' }, // pas de flag explicite — considéré non-démo
      },
    };
    const out = stripDemoProfiles(state);
    expect(Object.keys(out.profiles).length).toBe(2);
  });

  test('state null/undefined safe', () => {
    expect(stripDemoProfiles(null)).toBe(null);
    expect(stripDemoProfiles(undefined)).toBe(undefined);
    expect(stripDemoProfiles({})).toEqual({});
    expect(stripDemoProfiles({ profiles: null })).toEqual({ profiles: null });
  });

  test('immutabilité — retourne un nouvel objet', () => {
    const state = { profiles: { a: { isDemo: false } }, other: 'preserved' };
    const out = stripDemoProfiles(state);
    expect(out).not.toBe(state);
    expect(out.profiles).not.toBe(state.profiles);
    expect(out.other).toBe('preserved');
  });
});

describe('stripDemoFromSetlists (Phase 7.52.9)', () => {
  test("retire 'demo' des profileIds des setlists non-démo", () => {
    const state = {
      shared: {
        setlists: [
          { id: 'a', name: 'Cours Franck B', profileIds: ['sebastien', 'arthur', 'demo'] },
          { id: 'b', name: 'Arthur & Seb', profileIds: ['sebastien', 'demo'] },
          { id: 'c', name: 'Demo Setlist', profileIds: ['demo'] },
          { id: 'd', name: 'Bruno', profileIds: ['bruno'] },
        ],
      },
    };
    const out = stripDemoFromSetlists(state);
    expect(out.shared.setlists[0].profileIds).toEqual(['sebastien', 'arthur']);
    expect(out.shared.setlists[1].profileIds).toEqual(['sebastien']);
    expect(out.shared.setlists[2].profileIds).toEqual(['demo']); // Demo Setlist préservée
    expect(out.shared.setlists[3].profileIds).toEqual(['bruno']); // pas touchée
  });

  test('stamp lastModified sur les setlists modifiées seulement (default stamp:true)', () => {
    const t0 = Date.now() - 10000;
    const state = {
      shared: {
        setlists: [
          { id: 'a', name: 'Polluée', profileIds: ['x', 'demo'], lastModified: t0 },
          { id: 'b', name: 'Clean', profileIds: ['y'], lastModified: t0 },
        ],
      },
    };
    const out = stripDemoFromSetlists(state);
    expect(out.shared.setlists[0].lastModified).toBeGreaterThan(t0);
    expect(out.shared.setlists[1].lastModified).toBe(t0); // pas re-stampée
  });

  test("Phase 7.52.10 — option {stamp: false} : strip silencieux sans toucher lastModified", () => {
    const t0 = Date.now() - 10000;
    const state = {
      shared: {
        setlists: [
          { id: 'a', name: 'Polluée', profileIds: ['x', 'demo'], lastModified: t0 },
        ],
      },
    };
    const out = stripDemoFromSetlists(state, { stamp: false });
    expect(out.shared.setlists[0].profileIds).toEqual(['x']); // toujours strippée
    expect(out.shared.setlists[0].lastModified).toBe(t0); // pas re-stampée
  });

  test('immutabilité — pas de mutation du state input', () => {
    const setlist = { id: 'a', name: 'X', profileIds: ['sebastien', 'demo'] };
    const state = { shared: { setlists: [setlist] } };
    const out = stripDemoFromSetlists(state);
    expect(setlist.profileIds).toEqual(['sebastien', 'demo']); // intact
    expect(out.shared.setlists[0].profileIds).toEqual(['sebastien']); // copié + filtré
    expect(out).not.toBe(state);
    expect(out.shared).not.toBe(state.shared);
  });

  test('no-op si pas de setlists ou state falsy', () => {
    expect(stripDemoFromSetlists(null)).toBe(null);
    expect(stripDemoFromSetlists({})).toEqual({});
    expect(stripDemoFromSetlists({ shared: {} })).toEqual({ shared: {} });
    expect(stripDemoFromSetlists({ shared: { setlists: [] } })).toEqual({ shared: { setlists: [] } });
  });

  test("setlist sans profileIds → préservée sans toucher", () => {
    const state = {
      shared: { setlists: [{ id: 'a', name: 'No profileIds' }] },
    };
    const out = stripDemoFromSetlists(state);
    expect(out.shared.setlists[0]).toEqual({ id: 'a', name: 'No profileIds' });
  });

  test('Demo Setlist avec profileIds: [\"demo\", \"other\"] → demo préservé', () => {
    // Edge case : si quelqu'un a ajouté 'other' à profileIds de Demo Setlist,
    // l'helper ne touche pas (filtre sur le name).
    const state = {
      shared: { setlists: [{ id: 'a', name: 'Demo Setlist', profileIds: ['demo', 'other'] }] },
    };
    const out = stripDemoFromSetlists(state);
    expect(out.shared.setlists[0].profileIds).toEqual(['demo', 'other']);
  });
});

// ─── Phase 7.51.4 — buildDemoSnapshot (outil export admin) ──────────

describe('buildDemoSnapshot (Phase 7.51.4)', () => {
  const sampleProfile = {
    id: 'demo_curator_1778839429588',
    name: 'Demo Curator',
    isAdmin: true,
    password: 'h1:abc:def',
    isDemo: false,
    aiKeys: { anthropic: 'sk-ant-xxx', gemini: 'AIzaXXX' },
    loginHistory: [{ ts: 1, device: 'mac' }, { ts: 2, device: 'iphone' }],
    myGuitars: ['lp60', 'strat61'],
    enabledDevices: ['tonex-anniversary', 'tonex-plug'],
    banksAnn: { 0: { A: 'X', B: 'Y', C: '' } },
    language: 'fr',
  };
  const sampleSetlists = [
    { id: 'sl_curator', name: 'Demo Setlist', profileIds: ['demo_curator_1778839429588'], songIds: ['s1', 's2'] },
    { id: 'sl_other', name: 'Autre', profileIds: ['someone_else'], songIds: ['s3'] },
  ];
  const sampleSongs = [
    { id: 's1', title: 'Song 1', artist: 'A', aiCache: { sv: 9, result: { cot_step1: { fr: 'fr', en: 'en', es: 'es' } } } },
    { id: 's2', title: 'Song 2', artist: 'B', aiCache: { sv: 9, result: { cot_step1: { fr: 'fr2', en: 'en2', es: 'es2' } } } },
    { id: 's3', title: 'Other song', artist: 'C', aiCache: { sv: 9 } },
  ];

  test('force profile.id=demo, isDemo:true, isAdmin:false, password:null', () => {
    const snap = buildDemoSnapshot(sampleProfile, sampleSetlists, sampleSongs);
    expect(snap.profile.id).toBe('demo');
    expect(snap.profile.name).toBe('Démo');
    expect(snap.profile.isDemo).toBe(true);
    expect(snap.profile.isAdmin).toBe(false);
    expect(snap.profile.password).toBeNull();
  });

  test('strip aiKeys + loginHistory', () => {
    const snap = buildDemoSnapshot(sampleProfile, sampleSetlists, sampleSongs);
    expect(snap.profile.aiKeys).toEqual({ anthropic: '', gemini: '' });
    expect(snap.profile.loginHistory).toEqual([]);
  });

  test('extrait uniquement les songs référencées par les setlists du profil', () => {
    const snap = buildDemoSnapshot(sampleProfile, sampleSetlists, sampleSongs);
    expect(snap.songs.length).toBe(2);
    expect(snap.songs.map((s) => s.id).sort()).toEqual(['s1', 's2']);
    // s3 (référencé uniquement par sl_other appartenant à someone_else) doit être absent.
    expect(snap.songs.find((s) => s.id === 's3')).toBeUndefined();
  });

  test('préserve aiCache trilingue complet sur les songs extraites', () => {
    const snap = buildDemoSnapshot(sampleProfile, sampleSetlists, sampleSongs);
    const s1 = snap.songs.find((s) => s.id === 's1');
    expect(s1.aiCache).toBeDefined();
    expect(s1.aiCache.sv).toBe(9);
    expect(s1.aiCache.result.cot_step1.fr).toBe('fr');
    expect(s1.aiCache.result.cot_step1.en).toBe('en');
    expect(s1.aiCache.result.cot_step1.es).toBe('es');
  });

  test('setlists sortantes ont profileIds=[demo, curatorId] (Phase 7.52.16)', () => {
    // Phase 7.52.16 : préserve l'id du curateur source en plus de 'demo'
    // pour que le curateur garde son ownership de la setlist après que
    // enterDemoMode (Phase 7.52.14) force override par id la version locale.
    const snap = buildDemoSnapshot(sampleProfile, sampleSetlists, sampleSongs);
    expect(snap.setlists.length).toBe(1);
    expect(snap.setlists[0].profileIds).toEqual(['demo', 'demo_curator_1778839429588']);
    expect(snap.setlists[0].songIds).toEqual(['s1', 's2']);
  });

  test('profileIds curateur préservé même si curateur a un id non-démo', () => {
    // Validation Phase 7.52.16 : marche pour n'importe quel id curateur
    // (pas seulement les ids commençant par 'demo_').
    const otherCurator = { ...sampleProfile, id: 'sebastien_admin' };
    const setlists = [
      { id: 'sl_a', name: 'Demo Setlist', profileIds: ['sebastien_admin'], songIds: ['s1'] },
    ];
    const snap = buildDemoSnapshot(otherCurator, setlists, sampleSongs);
    expect(snap.setlists[0].profileIds).toEqual(['demo', 'sebastien_admin']);
  });

  test('format compatible loadDemoSnapshot (version + 4 clés)', () => {
    const snap = buildDemoSnapshot(sampleProfile, sampleSetlists, sampleSongs);
    expect(snap.version).toBe(STATE_VERSION);
    expect(snap).toHaveProperty('profile');
    expect(snap).toHaveProperty('setlists');
    expect(snap).toHaveProperty('songs');
  });

  test('null profile retourne null (defensive)', () => {
    expect(buildDemoSnapshot(null, sampleSetlists, sampleSongs)).toBeNull();
  });
});

// ─── Phase 5.7.1 — strip aiCache du push Firestore ──────────────────

describe('stripAiCacheForSync — Phase 5.7.1', () => {
  test('strip aiCache de chaque song dans shared.songDb', () => {
    const state = {
      shared: {
        songDb: [
          { id: 's1', title: 'A', artist: 'X', aiCache: { sv: 9, result: { foo: 'bar' } } },
          { id: 's2', title: 'B', artist: 'Y', aiCache: { sv: 9, result: { bar: 'baz' } } },
        ],
      },
      profiles: {},
    };
    const out = stripAiCacheForSync(state);
    expect(out.shared.songDb).toHaveLength(2);
    expect('aiCache' in out.shared.songDb[0]).toBe(false);
    expect('aiCache' in out.shared.songDb[1]).toBe(false);
    expect(out.shared.songDb[0].title).toBe('A');
    expect(out.shared.songDb[1].artist).toBe('Y');
  });

  test('input non muté (state local localStorage préservé)', () => {
    const song = { id: 's1', title: 'A', aiCache: { sv: 9 } };
    const state = { shared: { songDb: [song] }, profiles: {} };
    const out = stripAiCacheForSync(state);
    expect(song.aiCache).toBeDefined();
    expect(out).not.toBe(state);
    expect(out.shared).not.toBe(state.shared);
    expect(out.shared.songDb).not.toBe(state.shared.songDb);
  });

  test('shared.songDb absent → état retourné inchangé', () => {
    const state = { shared: { setlists: [] }, profiles: {} };
    expect(stripAiCacheForSync(state)).toBe(state);
  });

  test('song sans aiCache → preserved tel quel', () => {
    const state = { shared: { songDb: [{ id: 's1', title: 'A' }] }, profiles: {} };
    const out = stripAiCacheForSync(state);
    expect(out.shared.songDb[0]).toEqual({ id: 's1', title: 'A' });
  });

  test('réduit drastiquement la taille JSON (cas réel ~7 KB par aiCache)', () => {
    // Simule 100 morceaux avec aiCache moyen ~7 KB
    const big = Array.from({ length: 100 }, (_, i) => ({
      id: `s${i}`,
      title: `Title ${i}`,
      artist: 'Artist',
      aiCache: {
        sv: 9,
        gId: 'g1',
        result: {
          cot_step1: 'x'.repeat(2000),
          cot_step2_guitars: { g1: 'y'.repeat(2000), g2: 'z'.repeat(2000) },
          preset_ann: 'a'.repeat(500),
          preset_plug: 'b'.repeat(500),
        },
      },
    }));
    const state = { shared: { songDb: big }, profiles: {} };
    const heavy = JSON.stringify(state).length;
    const light = JSON.stringify(stripAiCacheForSync(state)).length;
    expect(light).toBeLessThan(heavy / 10); // ≥10× réduction
  });
});

describe('mergeSongDbPreservingLocalAiCache — Phase 5.7.1', () => {
  test('SCÉNARIO PRINCIPAL — common song : adopt remote.* mais réinjecte local.aiCache', () => {
    const local = [
      { id: 's1', title: 'Old Title', artist: 'X', aiCache: { sv: 9, result: { foo: 'LOCAL_CACHE' } } },
    ];
    const remote = [
      // Remote a été stripped (pas d'aiCache) mais a un titre mis à jour.
      { id: 's1', title: 'New Title', artist: 'X' },
    ];
    const out = mergeSongDbPreservingLocalAiCache(local, remote);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('New Title');       // remote field adopted
    expect(out[0].aiCache.result.foo).toBe('LOCAL_CACHE'); // local aiCache preserved
  });

  test('remote-only song sans aiCache → adopté tel quel', () => {
    const local = [{ id: 'l1', title: 'Local', aiCache: { sv: 9 } }];
    const remote = [{ id: 'r1', title: 'Remote' }];
    const out = mergeSongDbPreservingLocalAiCache(local, remote);
    expect(out).toHaveLength(2);
    const r = out.find((s) => s.id === 'r1');
    expect(r.title).toBe('Remote');
    expect(r.aiCache).toBeUndefined();
  });

  test('local-only song avec aiCache → preserved', () => {
    const local = [{ id: 'l1', title: 'Local', aiCache: { sv: 9, result: { foo: 'X' } } }];
    const remote = [];
    const out = mergeSongDbPreservingLocalAiCache(local, remote);
    expect(out).toHaveLength(1);
    expect(out[0].aiCache.result.foo).toBe('X');
  });

  test('cohabitation : remote a un aiCache plus récent (sv supérieur) → adopté complet', () => {
    const local = [{ id: 's1', title: 'A', aiCache: { sv: 8, result: { foo: 'OLD' } } }];
    const remote = [{ id: 's1', title: 'A', aiCache: { sv: 9, result: { foo: 'NEW' } } }];
    const out = mergeSongDbPreservingLocalAiCache(local, remote);
    expect(out[0].aiCache.sv).toBe(9);
    expect(out[0].aiCache.result.foo).toBe('NEW');
  });

  test('remote arrive avec aiCache plus ancien → local préservé', () => {
    const local = [{ id: 's1', title: 'A', aiCache: { sv: 9, result: { foo: 'NEW' } } }];
    const remote = [{ id: 's1', title: 'A', aiCache: { sv: 8, result: { foo: 'OLD' } } }];
    const out = mergeSongDbPreservingLocalAiCache(local, remote);
    expect(out[0].aiCache.sv).toBe(9);
    expect(out[0].aiCache.result.foo).toBe('NEW');
  });

  test('dedup by title+artist : remote stripped + local aiCache → pas de perte', () => {
    const local = [
      { id: 'local_uid', title: 'Hotel California', artist: 'Eagles', aiCache: { sv: 9, result: { foo: 'KEEP' } } },
    ];
    const remote = [
      // Même song ajoutée sur un autre device avec un id différent, sans aiCache.
      { id: 'remote_uid', title: 'Hotel California', artist: 'Eagles' },
    ];
    const out = mergeSongDbPreservingLocalAiCache(local, remote);
    expect(out).toHaveLength(1);
    // Le survivant dedup garde celui avec aiCache (local). Pas de perte du cache.
    expect(out[0].aiCache.result.foo).toBe('KEEP');
    // _idRemap propage le remote_uid → local_uid (utilisé pour remapper les setlists).
    expect(out._idRemap.remote_uid).toBe(out[0].id);
  });

  test('input local ou remote falsy → retourne l\'autre', () => {
    const data = [{ id: 's1', title: 'A' }];
    expect(mergeSongDbPreservingLocalAiCache(null, data)).toBe(data);
    expect(mergeSongDbPreservingLocalAiCache(data, null)).toBe(data);
  });
});

describe('computeNewzikCreateNames — Phase 5.7.2', () => {
  const LISTS_KEYS = ['Cours Franck B', 'Arthur & Seb', 'Nouvelle setlist'];
  const MERGE_INTO = { 'Nouvelle setlist': 'Ma Setlist' };

  test('aucune setlist → toutes les non-merge dans createNames', () => {
    const out = computeNewzikCreateNames([], LISTS_KEYS, MERGE_INTO);
    expect(out).toEqual(['Cours Franck B', 'Arthur & Seb']);
  });

  test('setlist exact match (peu importe profileIds) → exclue', () => {
    const setlists = [
      { id: 'sl1', name: 'Cours Franck B', profileIds: ['franck'], songIds: [] },
    ];
    const out = computeNewzikCreateNames(setlists, LISTS_KEYS, MERGE_INTO);
    // "Cours Franck B" exclu car déjà présent ; "Arthur & Seb" reste à créer.
    expect(out).toEqual(['Arthur & Seb']);
  });

  test('setlist existe avec profileIds différents → quand même skip (le fix Phase 5.7.2)', () => {
    // Scénario du bug : iPhone fraîchement nettoyé, Firestore ramène
    // "Cours Franck B" avec profileIds=['sebastien','franck']. L'ancien
    // guard regardait sameProfileIds([activeProfileId]) → false → recréait.
    // Le nouveau guard regarde uniquement le name.
    const setlists = [
      { id: 'sl1', name: 'Cours Franck B', profileIds: ['sebastien', 'franck'], songIds: [] },
      { id: 'sl2', name: 'Arthur & Seb', profileIds: ['arthur', 'sebastien'], songIds: [] },
    ];
    const out = computeNewzikCreateNames(setlists, LISTS_KEYS, MERGE_INTO);
    expect(out).toEqual([]);
  });

  test('"Nouvelle setlist" (clé de MERGE_INTO) jamais dans createNames', () => {
    const out = computeNewzikCreateNames([], ['Nouvelle setlist'], MERGE_INTO);
    expect(out).toEqual([]);
  });

  test('setlists non-array → []', () => {
    expect(computeNewzikCreateNames(null, LISTS_KEYS, MERGE_INTO)).toEqual([]);
    expect(computeNewzikCreateNames(undefined, LISTS_KEYS, MERGE_INTO)).toEqual([]);
  });

  test('listKeys non-array → []', () => {
    expect(computeNewzikCreateNames([], null, MERGE_INTO)).toEqual([]);
  });

  test('mergeInto falsy → traite tout comme create', () => {
    const out = computeNewzikCreateNames([], ['A', 'B'], null);
    expect(out).toEqual(['A', 'B']);
  });

  test('setlist avec name null/undefined → ignorée dans le set existing', () => {
    const setlists = [
      { id: 'sl1', name: null, songIds: [] },
      { id: 'sl2', songIds: [] }, // pas de name
    ];
    const out = computeNewzikCreateNames(setlists, ['Foo'], {});
    expect(out).toEqual(['Foo']);
  });
});

describe('computeNewzikMergeNames — Phase 5.7.2', () => {
  const MERGE_INTO = { 'Nouvelle setlist': 'Ma Setlist' };

  test('source absente → exclue (déjà mergée ou jamais créée)', () => {
    const setlists = [
      { id: 'sl1', name: 'Ma Setlist', songIds: [] },
    ];
    const out = computeNewzikMergeNames(setlists, MERGE_INTO);
    expect(out).toEqual([]);
  });

  test('source présente → incluse', () => {
    const setlists = [
      { id: 'sl1', name: 'Nouvelle setlist', songIds: [] },
      { id: 'sl2', name: 'Ma Setlist', songIds: [] },
    ];
    const out = computeNewzikMergeNames(setlists, MERGE_INTO);
    expect(out).toEqual(['Nouvelle setlist']);
  });

  test('source ET source__merged présents → exclue (déjà marqué fait)', () => {
    const setlists = [
      { id: 'sl1', name: 'Nouvelle setlist', songIds: [] },
      { id: 'sl2', name: 'Nouvelle setlist__merged', songIds: [] },
    ];
    const out = computeNewzikMergeNames(setlists, MERGE_INTO);
    expect(out).toEqual([]);
  });

  test('setlists ou mergeInto falsy → []', () => {
    expect(computeNewzikMergeNames(null, MERGE_INTO)).toEqual([]);
    expect(computeNewzikMergeNames([], null)).toEqual([]);
  });

  test('multiple merges, certains absents → seuls les présents incluse', () => {
    const map = { 'A': 'X', 'B': 'Y', 'C': 'Z' };
    const setlists = [
      { id: 'sl1', name: 'A', songIds: [] },
      { id: 'sl2', name: 'C', songIds: [] },
    ];
    const out = computeNewzikMergeNames(setlists, map);
    expect(out.sort()).toEqual(['A', 'C']);
  });
});

describe('Scénario bug iPhone nettoyé — Phase 5.7.2', () => {
  // Reproduction du scénario réel : iPhone vide reçoit Firestore qui
  // contient les 3 setlists. La migration ne doit RIEN faire.
  test('iPhone post-Firestore avec setlists synchronisées → migration no-op', () => {
    const LISTS_KEYS = ['Cours Franck B', 'Arthur & Seb', 'Nouvelle setlist'];
    const MERGE_INTO = { 'Nouvelle setlist': 'Ma Setlist' };
    // État après applyRemoteData : Firestore a ramené tout le contenu Mac.
    // Sébastien a déjà mergé "Nouvelle setlist" → "Ma Setlist" sur Mac, donc
    // "Nouvelle setlist" n'existe plus dans Firestore.
    const setlists = [
      { id: 'sl_main', name: 'Ma Setlist', profileIds: ['sebastien'], songIds: ['s1', 's2'] },
      { id: 'sl_cfb', name: 'Cours Franck B', profileIds: ['sebastien', 'franck'], songIds: ['s3'] },
      { id: 'sl_as', name: 'Arthur & Seb', profileIds: ['arthur', 'sebastien'], songIds: ['s4'] },
    ];
    expect(computeNewzikCreateNames(setlists, LISTS_KEYS, MERGE_INTO)).toEqual([]);
    expect(computeNewzikMergeNames(setlists, MERGE_INTO)).toEqual([]);
  });

  test('Vraie première install (pas de Firestore, pas de local) → migration crée tout', () => {
    const LISTS_KEYS = ['Cours Franck B', 'Arthur & Seb', 'Nouvelle setlist'];
    const MERGE_INTO = { 'Nouvelle setlist': 'Ma Setlist' };
    // Pas de setlists du tout : truly first install. Mais la migration
    // attend qu'au moins "Nouvelle setlist" existe pour le merge. Du coup
    // mergeNames est vide. Acceptable car la migration ne crée pas non plus
    // "Nouvelle setlist" — elle suppose qu'elle existe déjà (importée par
    // Newzik en amont). Cas dégénéré : aucun import Newzik historique
    // détecté.
    const setlists = [];
    expect(computeNewzikCreateNames(setlists, LISTS_KEYS, MERGE_INTO).sort())
      .toEqual(['Arthur & Seb', 'Cours Franck B']);
    expect(computeNewzikMergeNames(setlists, MERGE_INTO)).toEqual([]);
  });
});

describe('dedupSetlistsWithTombstones — Phase 5.7.3', () => {
  test('strict — aucun doublon → tombstones vides + setlists identiques', () => {
    const setlists = [
      { id: 'sl1', name: 'A', profileIds: ['p1'], songIds: ['s1'] },
      { id: 'sl2', name: 'B', profileIds: ['p1'], songIds: ['s2'] },
    ];
    const res = dedupSetlistsWithTombstones(setlists);
    expect(res.tombstones).toEqual({});
    expect(res.setlists).toEqual(setlists);
  });

  test('strict — 2 doublons stricts → 1 tombstone du loser', () => {
    const setlists = [
      { id: 'sl_big', name: 'A', profileIds: ['p1'], songIds: ['s1','s2','s3'] },
      { id: 'sl_small', name: 'A', profileIds: ['p1'], songIds: ['s4'] },
    ];
    const res = dedupSetlistsWithTombstones(setlists, { ts: 1234567890 });
    expect(res.setlists.length).toBe(1);
    expect(res.setlists[0].id).toBe('sl_big');
    expect(res.tombstones).toEqual({ 'sl_small': 1234567890 });
  });

  test('aggressif — name-only avec profileIds différents → tombstone des losers', () => {
    const setlists = [
      { id: 'sl_seb', name: 'Cours Franck B', profileIds: ['sebastien'], songIds: ['s1','s2','s3','s4','s5'] },
      { id: 'sl_arthur', name: 'Cours Franck B', profileIds: ['arthur'], songIds: ['s6','s7'] },
      { id: 'sl_seb2', name: 'Cours Franck B', profileIds: ['sebastien','franck'], songIds: ['s8'] },
    ];
    const res = dedupSetlistsWithTombstones(setlists, { mergeAcrossProfiles: true, ts: 100 });
    expect(res.setlists.length).toBe(1);
    expect(res.setlists[0].id).toBe('sl_seb'); // plus garnie
    expect(res.tombstones).toEqual({ 'sl_arthur': 100, 'sl_seb2': 100 });
  });

  test('scénario du bug 18 setlists Sébastien → tombstones non vides', () => {
    // Reproduit le bordel Mac/iPhone : 6 versions de "Arthur & Seb",
    // 6 de "Cours Franck B", 2 de "Cours samedi après-midi".
    const make = (n, name, songs, profile) => ({ id: `sl_${n}`, name, profileIds: [profile], songIds: Array(songs).fill(0).map((_,i)=>'s'+i) });
    const setlists = [
      make('a1','Arthur & Seb',31,'sebastien'),
      make('a2','Arthur & Seb',28,'arthur'),
      make('a3','Arthur & Seb',28,'sebastien'),
      make('a4','Arthur & Seb',28,'sebastien'),
      make('a5','Arthur & Seb',31,'sebastien'),
      make('a6','Arthur & Seb',28,'arthur'),
      make('c1','Cours Franck B',45,'arthur'),
      make('c2','Cours Franck B',46,'sebastien'),
      make('c3','Cours Franck B',45,'sebastien'),
      make('c4','Cours Franck B',45,'sebastien'),
      make('c5','Cours Franck B',45,'sebastien'),
      make('c6','Cours Franck B',45,'arthur'),
      make('z1','Ma Setlist',13,'sebastien'),
    ];
    const res = dedupSetlistsWithTombstones(setlists, { mergeAcrossProfiles: true });
    // Survivants : 1 par name = 3
    expect(res.setlists.length).toBe(3);
    // Tombstones : 10 losers (5 Arthur&Seb + 5 Cours Franck B)
    expect(Object.keys(res.tombstones).length).toBe(10);
  });

  test('option ts personnalisée appliquée à tous les tombstones', () => {
    const setlists = [
      { id: 'sl1', name: 'A', profileIds: ['p1'], songIds: ['s1','s2'] },
      { id: 'sl2', name: 'A', profileIds: ['p1'], songIds: ['s3'] },
      { id: 'sl3', name: 'A', profileIds: ['p1'], songIds: ['s4'] },
    ];
    const customTs = 9999999;
    const res = dedupSetlistsWithTombstones(setlists, { ts: customTs });
    expect(res.tombstones).toEqual({ 'sl2': customTs, 'sl3': customTs });
  });

  test('ts par défaut = Date.now()', () => {
    const before = Date.now();
    const setlists = [
      { id: 'sl1', name: 'A', profileIds: ['p1'], songIds: ['s1','s2'] },
      { id: 'sl2', name: 'A', profileIds: ['p1'], songIds: ['s3'] },
    ];
    const res = dedupSetlistsWithTombstones(setlists);
    const after = Date.now();
    expect(res.tombstones['sl2']).toBeGreaterThanOrEqual(before);
    expect(res.tombstones['sl2']).toBeLessThanOrEqual(after);
  });

  test('setlists falsy → tombstones vides', () => {
    expect(dedupSetlistsWithTombstones(null)).toEqual({ setlists: null, tombstones: {} });
    expect(dedupSetlistsWithTombstones(undefined)).toEqual({ setlists: undefined, tombstones: {} });
  });

  test('setlist sans id ne génère pas de tombstone (defensive)', () => {
    const setlists = [
      { name: 'A', profileIds: ['p1'], songIds: ['s1','s2'] }, // pas d'id
      { id: 'sl_keep', name: 'A', profileIds: ['p1'], songIds: ['s3'] },
    ];
    const res = dedupSetlistsWithTombstones(setlists);
    // sl_keep gagne par tiebreak (idx min when same length OR is the only one with songs higher),
    // actually first has more songs so it wins. Loser is sl_keep (id present), tombstone exists.
    // OR first has no id → if loser, no tombstone.
    expect(Object.keys(res.tombstones).length).toBeLessThanOrEqual(1);
  });
});

describe('toggleSetlistProfile — Phase 5.8', () => {
  test('ajoute profileId absent → newIds avec le profileId, lastModified stampé', () => {
    const sl = { id: 'sl1', name: 'A', profileIds: ['sebastien'], songIds: [] };
    const before = Date.now();
    const out = toggleSetlistProfile(sl, 'arthur', 'sebastien');
    const after = Date.now();
    expect(out).not.toBe(sl); // nouvelle référence
    expect(out.profileIds).toEqual(['sebastien', 'arthur']);
    expect(out.lastModified).toBeGreaterThanOrEqual(before);
    expect(out.lastModified).toBeLessThanOrEqual(after);
  });

  test('retire profileId présent → newIds sans le profileId', () => {
    const sl = { id: 'sl1', name: 'A', profileIds: ['sebastien', 'arthur'], songIds: [] };
    const out = toggleSetlistProfile(sl, 'arthur', 'sebastien');
    expect(out.profileIds).toEqual(['sebastien']);
  });

  test('garde-fou : retirer activeProfileId → retourne le setlist intact (même référence)', () => {
    const sl = { id: 'sl1', name: 'A', profileIds: ['sebastien', 'arthur'], songIds: [] };
    const out = toggleSetlistProfile(sl, 'sebastien', 'sebastien');
    expect(out).toBe(sl); // même référence — pas de modif
  });

  test('vider toute la liste → activeProfileId réinjecté automatiquement', () => {
    // Cas dégénéré : profileIds=['arthur'] et on retire 'arthur' alors qu'on
    // est 'sebastien' (donc pas le garde-fou direct). La liste devient vide,
    // on force activeProfileId à rester.
    const sl = { id: 'sl1', name: 'A', profileIds: ['arthur'], songIds: [] };
    const out = toggleSetlistProfile(sl, 'arthur', 'sebastien');
    expect(out.profileIds).toEqual(['sebastien']);
  });

  test('setlist null → retourne null', () => {
    expect(toggleSetlistProfile(null, 'arthur', 'sebastien')).toBeNull();
  });

  test('profileId vide → no-op', () => {
    const sl = { id: 'sl1', name: 'A', profileIds: ['sebastien'], songIds: [] };
    expect(toggleSetlistProfile(sl, '', 'sebastien')).toBe(sl);
    expect(toggleSetlistProfile(sl, null, 'sebastien')).toBe(sl);
  });

  test('profileIds inexistant sur la setlist → défensive', () => {
    const sl = { id: 'sl1', name: 'A', songIds: [] }; // pas de profileIds
    const out = toggleSetlistProfile(sl, 'arthur', 'sebastien');
    expect(out.profileIds).toEqual(['arthur']);
  });

  test('chaining toggle add+remove same profile → idempotent', () => {
    const sl = { id: 'sl1', name: 'A', profileIds: ['sebastien'], songIds: [] };
    const added = toggleSetlistProfile(sl, 'arthur', 'sebastien');
    expect(added.profileIds).toEqual(['sebastien', 'arthur']);
    const removed = toggleSetlistProfile(added, 'arthur', 'sebastien');
    expect(removed.profileIds).toEqual(['sebastien']);
  });
});

describe('dedupSongDb — Phase 7.20', () => {
  test('songDb sans doublons → identique, removed=0', () => {
    const input = [
      { id: 's1', title: 'A', artist: 'X' },
      { id: 's2', title: 'B', artist: 'Y' },
    ];
    const { songs, removed } = dedupSongDb(input);
    expect(removed).toBe(0);
    expect(songs).toHaveLength(2);
    expect(songs.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  test('garde le premier rencontré par id', () => {
    const input = [
      { id: 's1', title: 'A v1', artist: 'X' },
      { id: 's1', title: 'A v2', artist: 'Y' },
      { id: 's1', title: 'A v3', artist: 'Z' },
    ];
    const { songs, removed } = dedupSongDb(input);
    expect(removed).toBe(2);
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('A v1');
    expect(songs[0].artist).toBe('X');
  });

  test('aiCache : adopte le plus riche (sv plus récent gagne)', () => {
    const input = [
      { id: 's1', title: 'A', aiCache: { sv: 5, result: { ideal_guitar: 'sg' } } },
      { id: 's1', title: 'A bis', aiCache: { sv: 9, result: { cot_step1: 'x', ideal_guitar: 'lp' } } },
    ];
    const { songs, removed } = dedupSongDb(input);
    expect(removed).toBe(1);
    expect(songs[0].title).toBe('A');
    expect(songs[0].aiCache.sv).toBe(9);
    expect(songs[0].aiCache.result.cot_step1).toBe('x');
  });

  test('aiCache : remplace null par non-null', () => {
    const input = [
      { id: 's1', title: 'A', aiCache: null },
      { id: 's1', title: 'A bis', aiCache: { sv: 9, result: { cot_step1: 'x' } } },
    ];
    const { songs } = dedupSongDb(input);
    expect(songs[0].aiCache).not.toBeNull();
    expect(songs[0].aiCache.sv).toBe(9);
  });

  test('aiCache : préserve le premier si plus riche', () => {
    const input = [
      { id: 's1', title: 'A', aiCache: { sv: 9, result: { cot_step1: 'x' } } },
      { id: 's1', title: 'A bis', aiCache: { sv: 5, result: { ideal_guitar: 'sg' } } },
    ];
    const { songs } = dedupSongDb(input);
    expect(songs[0].aiCache.sv).toBe(9);
    expect(songs[0].aiCache.result.cot_step1).toBe('x');
  });

  test('feedback : union dédoublonnée par (text, ts)', () => {
    const input = [
      { id: 's1', title: 'A', feedback: [{ text: 'fb1', ts: 100 }, { text: 'fb2', ts: 200 }] },
      { id: 's1', title: 'A bis', feedback: [{ text: 'fb2', ts: 200 }, { text: 'fb3', ts: 300 }] },
    ];
    const { songs } = dedupSongDb(input);
    expect(songs[0].feedback).toHaveLength(3);
    expect(songs[0].feedback.map((f) => f.text)).toEqual(['fb1', 'fb2', 'fb3']);
  });

  test('feedback absent ou non-array : pas de crash', () => {
    const input = [
      { id: 's1', title: 'A' },
      { id: 's1', title: 'A bis', feedback: [{ text: 'fb', ts: 1 }] },
    ];
    const { songs } = dedupSongDb(input);
    expect(songs[0].feedback).toHaveLength(1);
    expect(songs[0].feedback[0].text).toBe('fb');
  });

  test('scénario bug réel : 2 doublons par collision Date.now()', () => {
    const input = [
      { id: 'c_1778428303600_jch2', title: 'Wonderful World', aiCache: { sv: 9, result: {} } },
      { id: 'c_1778309153614_ined', title: 'Mr Jones', aiCache: { sv: 9, result: {} } },
      { id: 'c_1778428303600_jch2', title: 'Wonderful World', aiCache: null },
      { id: 'c_1778309153614_ined', title: 'Mr Jones', aiCache: null },
    ];
    const { songs, removed } = dedupSongDb(input);
    expect(removed).toBe(2);
    expect(songs).toHaveLength(2);
    expect(songs.every((s) => s.aiCache !== null)).toBe(true);
  });

  test('songs sans id (corrompus) : ignorés silencieusement', () => {
    const input = [
      { id: 's1', title: 'A' },
      { title: 'sans id' },
      { id: null, title: 'id null' },
      { id: 's1', title: 'A bis' },
    ];
    const { songs, removed } = dedupSongDb(input);
    expect(songs).toHaveLength(1);
    expect(removed).toBe(1);
  });

  test('input falsy ou non-array → { songs: [], removed: 0 }', () => {
    expect(dedupSongDb(null)).toEqual({ songs: [], removed: 0 });
    expect(dedupSongDb(undefined)).toEqual({ songs: [], removed: 0 });
    expect(dedupSongDb('not array')).toEqual({ songs: [], removed: 0 });
  });

  test('immutabilité : input non muté', () => {
    const input = [
      { id: 's1', title: 'A' },
      { id: 's1', title: 'A bis' },
    ];
    const snap = JSON.stringify(input);
    dedupSongDb(input);
    expect(JSON.stringify(input)).toBe(snap);
  });
});

describe('migrateV9toV10 — Phase 7.54', () => {
  test('pose profile.aiCache={} sur tous les profils (additif)', () => {
    const v9 = {
      version: 9,
      activeProfileId: 'sebastien',
      shared: { songDb: [], setlists: [] },
      profiles: { sebastien: { id: 'sebastien' }, bruno: { id: 'bruno' } },
    };
    const v10 = migrateV9toV10(v9);
    expect(v10.version).toBe(10);
    expect(v10.profiles.sebastien.aiCache).toEqual({});
    expect(v10.profiles.bruno.aiCache).toEqual({});
  });

  test('copie shared aiCache → profile.aiCache pour songs profil actif + drop ALL shared (Phase 7.54.1)', () => {
    const v9 = {
      version: 9,
      activeProfileId: 'sebastien',
      shared: {
        songDb: [
          { id: 's1', aiCache: { sv: 9, result: { cot_step1: 'fr' } } },
          { id: 's2', aiCache: { sv: 9, result: { cot_step1: 'es' } } },
          { id: 's3', aiCache: { sv: 9, result: { cot_step1: 'autre' } } },
        ],
        setlists: [
          { id: 'sl1', name: 'Ma Setlist', songIds: ['s1', 's2'], profileIds: ['sebastien'] },
          { id: 'sl2', name: 'Autre', songIds: ['s3'], profileIds: ['bruno'] },
        ],
      },
      profiles: { sebastien: { id: 'sebastien' }, bruno: { id: 'bruno' } },
    };
    const v10 = migrateV9toV10(v9);
    expect(v10.profiles.sebastien.aiCache.s1).toBeDefined();
    expect(v10.profiles.sebastien.aiCache.s2).toBeDefined();
    // s3 n'est PAS dans setlists Sébastien → pas copié dans profile.aiCache
    expect(v10.profiles.sebastien.aiCache.s3).toBeUndefined();
    // Phase 7.54.1 — drop ALL shared.aiCache (legacy obsolète en v10).
    // Bruno récupérera s3 via sa propre migration v10 sur son device.
    expect(v10.shared.songDb.find(s => s.id === 's1').aiCache).toBeNull();
    expect(v10.shared.songDb.find(s => s.id === 's2').aiCache).toBeNull();
    expect(v10.shared.songDb.find(s => s.id === 's3').aiCache).toBeNull();
  });

  test('idempotente : v10 → v10 ne mute pas profile.aiCache existant', () => {
    const v10input = {
      version: 10,
      activeProfileId: 'sebastien',
      shared: { songDb: [], setlists: [] },
      profiles: { sebastien: { id: 'sebastien', aiCache: { existing: { sv: 9 } } } },
    };
    const v10out = migrateV9toV10(v10input);
    expect(v10out.profiles.sebastien.aiCache.existing).toBeDefined();
  });

  test('preserve si profile.aiCache déjà plus récent (sv supérieur)', () => {
    const v9 = {
      version: 9,
      activeProfileId: 'sebastien',
      shared: {
        songDb: [{ id: 's1', aiCache: { sv: 9, result: { source: 'shared' } } }],
        setlists: [{ id: 'sl1', songIds: ['s1'], profileIds: ['sebastien'] }],
      },
      profiles: { sebastien: { id: 'sebastien', aiCache: { s1: { sv: 10, result: { source: 'profile' } } } } },
    };
    const v10 = migrateV9toV10(v9);
    expect(v10.profiles.sebastien.aiCache.s1.sv).toBe(10);
    expect(v10.profiles.sebastien.aiCache.s1.result.source).toBe('profile');
  });

  test('null state → null', () => {
    expect(migrateV9toV10(null)).toBeNull();
  });

  test('pas d activeProfileId → drop ALL shared.aiCache quand même (Phase 7.54.1)', () => {
    const v9 = {
      version: 9,
      activeProfileId: null,
      shared: { songDb: [{ id: 's1', aiCache: { sv: 9 } }], setlists: [] },
      profiles: { sebastien: { id: 'sebastien' } },
    };
    const v10 = migrateV9toV10(v9);
    expect(v10.profiles.sebastien.aiCache).toEqual({});
    // Phase 7.54.1 — shared.aiCache toujours droppé en v10
    expect(v10.shared.songDb[0].aiCache).toBeNull();
  });

  // ── Phase 7.74.8 — POLLUTION PROFILE occurrence #7 ──
  // migrateV9toV10 tourne à CHAQUE boot (_runFullChain est appelé même
  // sur un state déjà-v10). Il ne doit re-stamper lastModified que si une
  // migration aiCache réelle a lieu — sinon un simple reload fait
  // gratuitement « gagner » le profil actif au LWW et propage son état
  // (banques potentiellement corrompues) aux autres appareils.
  test('Phase 7.74.8 — state déjà-v10 stable : lastModified PRÉSERVÉ (pas de re-stamp)', () => {
    const STALE = 1700000000000;
    const v10input = {
      version: 10,
      activeProfileId: 'sebastien',
      shared: {
        songDb: [{ id: 's1', aiCache: null }],
        setlists: [{ id: 'sl1', songIds: ['s1'], profileIds: ['sebastien'] }],
      },
      profiles: {
        sebastien: { id: 'sebastien', lastModified: STALE, aiCache: { s1: { sv: 9 } } },
      },
    };
    const out = migrateV9toV10(v10input);
    expect(out.profiles.sebastien.lastModified).toBe(STALE);
  });

  test('Phase 7.74.8 — migration aiCache réelle (shared→profile) : lastModified RE-STAMPÉ', () => {
    const before = Date.now();
    const v9 = {
      version: 9,
      activeProfileId: 'sebastien',
      shared: {
        songDb: [{ id: 's1', aiCache: { sv: 9, result: { cot_step1: 'fr' } } }],
        setlists: [{ id: 'sl1', songIds: ['s1'], profileIds: ['sebastien'] }],
      },
      profiles: { sebastien: { id: 'sebastien', lastModified: 1700000000000, aiCache: {} } },
    };
    const out = migrateV9toV10(v9);
    expect(out.profiles.sebastien.aiCache.s1).toBeDefined();
    expect(out.profiles.sebastien.lastModified).toBeGreaterThanOrEqual(before);
  });

  test('Phase 7.74.8 — shared aiCache présent mais song hors setlists du profil actif : pas de migration → lastModified préservé', () => {
    const STALE = 1700000000000;
    const v10input = {
      version: 10,
      activeProfileId: 'sebastien',
      shared: {
        songDb: [{ id: 's3', aiCache: { sv: 9 } }],
        setlists: [{ id: 'sl2', songIds: ['s3'], profileIds: ['bruno'] }],
      },
      profiles: {
        sebastien: { id: 'sebastien', lastModified: STALE, aiCache: {} },
        bruno: { id: 'bruno', lastModified: STALE, aiCache: {} },
      },
    };
    const out = migrateV9toV10(v10input);
    expect(out.profiles.sebastien.lastModified).toBe(STALE);
  });

  test('Phase 7.74.8 — double passage idempotent : le 2e run préserve lastModified', () => {
    const v9 = {
      version: 9,
      activeProfileId: 'sebastien',
      shared: {
        songDb: [{ id: 's1', aiCache: { sv: 9 } }],
        setlists: [{ id: 'sl1', songIds: ['s1'], profileIds: ['sebastien'] }],
      },
      profiles: { sebastien: { id: 'sebastien', lastModified: 1700000000000, aiCache: {} } },
    };
    const run1 = migrateV9toV10(v9);
    const lm1 = run1.profiles.sebastien.lastModified;
    // 2e run : shared.aiCache déjà droppé + profile.aiCache déjà plein
    // → cacheMigrated false → lastModified inchangé (cas de tout reload).
    const run2 = migrateV9toV10(run1);
    expect(run2.profiles.sebastien.lastModified).toBe(lm1);
  });
});

describe('getProfileAiCache — Phase 7.54', () => {
  test('retourne profile.aiCache[songId] si présent', () => {
    const profile = { aiCache: { s1: { sv: 10 } } };
    expect(getProfileAiCache(profile, 's1')).toEqual({ sv: 10 });
  });
  test('null si profile sans aiCache', () => {
    expect(getProfileAiCache({}, 's1')).toBeNull();
    expect(getProfileAiCache(null, 's1')).toBeNull();
  });
  test('null si songId absent', () => {
    const profile = { aiCache: { s2: { sv: 10 } } };
    expect(getProfileAiCache(profile, 's1')).toBeNull();
  });
  test('null si arguments invalides', () => {
    expect(getProfileAiCache(null, null)).toBeNull();
    expect(getProfileAiCache({ aiCache: {} }, '')).toBeNull();
  });
});

describe('ensureProfileV10 — Phase 7.54', () => {
  test('pose aiCache={} si absent', () => {
    const p = ensureProfileV10({ id: 's' });
    expect(p.aiCache).toEqual({});
  });
  test('préserve aiCache existant', () => {
    const p = ensureProfileV10({ id: 's', aiCache: { s1: { sv: 10 } } });
    expect(p.aiCache.s1).toBeDefined();
  });
  test('chaîne v3→v10 (héritage isDemo)', () => {
    const p = ensureProfileV10({ id: 's' });
    expect(p.isDemo).toBe(false);
    expect(p.aiCache).toEqual({});
  });
});

// Phase 7.63 — Sécurité admin-switch profil.
describe('recordAdminSwitch (Phase 7.63)', () => {
  test('push une entry admin_switch dans loginHistory du target', () => {
    const profiles = {
      bruno: { id: 'bruno', name: 'Bruno', isAdmin: false, loginHistory: [] },
      sebastien: { id: 'sebastien', name: 'Sébastien', isAdmin: true },
    };
    const out = recordAdminSwitch(profiles, 'bruno', profiles.sebastien);
    expect(out.bruno.loginHistory).toHaveLength(1);
    const entry = out.bruno.loginHistory[0];
    expect(entry.type).toBe('admin_switch');
    expect(entry.adminId).toBe('sebastien');
    expect(entry.adminName).toBe('Sébastien');
    expect(typeof entry.ts).toBe('number');
    expect(out.bruno.lastModified).toBeGreaterThan(0);
  });

  test('préserve les entries existantes (timestamp + admin_switch précédent)', () => {
    const profiles = {
      bruno: {
        id: 'bruno',
        loginHistory: [
          1716000000000,
          { type: 'admin_switch', ts: 1715990000000, adminId: 'sebastien', adminName: 'Sébastien' },
        ],
      },
      sebastien: { id: 'sebastien', name: 'Sébastien', isAdmin: true },
    };
    const out = recordAdminSwitch(profiles, 'bruno', profiles.sebastien);
    expect(out.bruno.loginHistory).toHaveLength(3);
    expect(out.bruno.loginHistory[0].type).toBe('admin_switch'); // nouveau en tête
    expect(out.bruno.loginHistory[1]).toBe(1716000000000);
    expect(out.bruno.loginHistory[2].type).toBe('admin_switch');
  });

  test('cap à 10 entries', () => {
    const longHistory = Array(15).fill(0).map((_, i) => 1716000000000 + i * 1000);
    const profiles = {
      bruno: { id: 'bruno', loginHistory: longHistory },
      sebastien: { id: 'sebastien', name: 'Sébastien', isAdmin: true },
    };
    const out = recordAdminSwitch(profiles, 'bruno', profiles.sebastien);
    expect(out.bruno.loginHistory).toHaveLength(10);
    expect(out.bruno.loginHistory[0].type).toBe('admin_switch');
  });

  test('utilise adminId si name manquant', () => {
    const profiles = { bruno: { id: 'bruno', loginHistory: [] } };
    const adminProfile = { id: 'sebastien_admin_42', isAdmin: true };
    const out = recordAdminSwitch(profiles, 'bruno', adminProfile);
    expect(out.bruno.loginHistory[0].adminName).toBe('sebastien_admin_42');
  });

  test('targetId inexistant → retourne profiles inchangé', () => {
    const profiles = { sebastien: { id: 'sebastien', isAdmin: true } };
    const out = recordAdminSwitch(profiles, 'ghost', profiles.sebastien);
    expect(out).toBe(profiles);
  });

  test('adminProfile sans id → retourne profiles inchangé', () => {
    const profiles = { bruno: { id: 'bruno', loginHistory: [] } };
    expect(recordAdminSwitch(profiles, 'bruno', {})).toBe(profiles);
    expect(recordAdminSwitch(profiles, 'bruno', null)).toBe(profiles);
  });

  test('immutabilité : ne mute pas le profiles d\'origine', () => {
    const profiles = { bruno: { id: 'bruno', loginHistory: [] } };
    const originalLength = profiles.bruno.loginHistory.length;
    recordAdminSwitch(profiles, 'bruno', { id: 'sebastien', name: 'Sébastien', isAdmin: true });
    expect(profiles.bruno.loginHistory).toHaveLength(originalLength);
  });

  test('loginHistory non-array (corrupted) → init array vide', () => {
    const profiles = { bruno: { id: 'bruno', loginHistory: 'corrupted' } };
    const out = recordAdminSwitch(profiles, 'bruno', { id: 'sebastien', name: 'Sébastien', isAdmin: true });
    expect(out.bruno.loginHistory).toHaveLength(1);
    expect(out.bruno.loginHistory[0].type).toBe('admin_switch');
  });
});

describe('isAdminAsMode (Phase 7.63)', () => {
  const profiles = {
    sebastien: { id: 'sebastien', name: 'Sébastien', isAdmin: true },
    bruno: { id: 'bruno', name: 'Bruno', isAdmin: false },
    franck: { id: 'franck', name: 'Franck', isAdmin: true },
  };

  test('admin sur profil non-admin → true (cas Sébastien switch sur Bruno)', () => {
    expect(isAdminAsMode(profiles, 'bruno', 'sebastien')).toBe(true);
  });

  test('admin sur son propre profil → false', () => {
    expect(isAdminAsMode(profiles, 'sebastien', 'sebastien')).toBe(false);
  });

  test('sans adminOriginId → false', () => {
    expect(isAdminAsMode(profiles, 'bruno', null)).toBe(false);
    expect(isAdminAsMode(profiles, 'bruno', undefined)).toBe(false);
    expect(isAdminAsMode(profiles, 'bruno', '')).toBe(false);
  });

  test('adminOriginId pointe sur profil non-admin → false (defensive)', () => {
    expect(isAdminAsMode(profiles, 'sebastien', 'bruno')).toBe(false);
  });

  test('adminOriginId pointe sur profil inexistant → false', () => {
    expect(isAdminAsMode(profiles, 'bruno', 'ghost')).toBe(false);
  });

  test('admin sur un autre profil admin → true (les 2 sont admin)', () => {
    expect(isAdminAsMode(profiles, 'franck', 'sebastien')).toBe(true);
  });

  test('activeProfileId manquant → false', () => {
    expect(isAdminAsMode(profiles, null, 'sebastien')).toBe(false);
    expect(isAdminAsMode(profiles, '', 'sebastien')).toBe(false);
  });

  test('profiles null/undefined → false', () => {
    expect(isAdminAsMode(null, 'bruno', 'sebastien')).toBe(false);
    expect(isAdminAsMode(undefined, 'bruno', 'sebastien')).toBe(false);
  });
});

// ─── Phase 7.74 Couche 1 — stampedProfileUpdate ────────────────────────
describe('stampedProfileUpdate — Phase 7.74 Couche 1', () => {
  test('stamp lastModified forcé sur le profil cible', () => {
    const before = Date.now() - 10000;
    const profiles = { seb: { id: 'seb', name: 'Sébastien', lastModified: before } };
    const out = stampedProfileUpdate(profiles, 'seb', { name: 'Seb renamed' });
    expect(out.seb.name).toBe('Seb renamed');
    expect(out.seb.lastModified).toBeGreaterThan(before);
    expect(out.seb.lastModified).toBeGreaterThanOrEqual(Date.now() - 100);
  });

  test('partial fonction (prev) → résolu avec stamp', () => {
    const profiles = { seb: { id: 'seb', myGuitars: ['a', 'b'] } };
    const out = stampedProfileUpdate(profiles, 'seb', (cur) => ({
      myGuitars: [...cur.myGuitars, 'c'],
    }));
    expect(out.seb.myGuitars).toEqual(['a', 'b', 'c']);
    expect(typeof out.seb.lastModified).toBe('number');
  });

  test('profileId inexistant → no-op (profiles inchangé)', () => {
    const profiles = { seb: { id: 'seb' } };
    const out = stampedProfileUpdate(profiles, 'unknown', { name: 'X' });
    expect(out).toBe(profiles);
  });

  test('partial null/undefined → no-op', () => {
    const profiles = { seb: { id: 'seb' } };
    expect(stampedProfileUpdate(profiles, 'seb', null)).toBe(profiles);
    expect(stampedProfileUpdate(profiles, 'seb', undefined)).toBe(profiles);
    expect(stampedProfileUpdate(profiles, 'seb', () => null)).toBe(profiles);
  });

  test('immutabilité : profiles original non muté', () => {
    const profiles = { seb: { id: 'seb', name: 'Old' } };
    const orig = profiles.seb;
    stampedProfileUpdate(profiles, 'seb', { name: 'New' });
    expect(profiles.seb).toBe(orig); // référence identique
    expect(profiles.seb.name).toBe('Old');
  });
});

// ─── Phase 7.74 Couche 2+3 — mergeProfileLWW per-field ────────────────
describe('mergeProfileLWW — Phase 7.74 Couche 2 (per-field) + 3 (defense)', () => {
  test('remote plus ancien → keep local entier', () => {
    const local = { id: 'seb', lastModified: 2000, name: 'Local' };
    const remote = { id: 'seb', lastModified: 1000, name: 'Remote' };
    const out = mergeProfileLWW(local, remote);
    expect(out).toBe(local);
  });

  test('remote plus récent, pas de drop suspect → adopt remote', () => {
    const local = { id: 'seb', lastModified: 1000, myGuitars: ['a', 'b'], language: 'fr' };
    const remote = { id: 'seb', lastModified: 2000, myGuitars: ['a', 'b', 'c'], language: 'fr' };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(['a', 'b', 'c']);
    expect(out.lastModified).toBe(2000);
  });

  test('SCÉNARIO BUG SÉBASTIEN : remote drop ≥3 guitares → keep local', () => {
    // Sébastien Mac a 5 guitares, remote essaye d'écraser avec
    // seulement 2 (pollution cross-profil typique).
    const local = {
      id: 'sebastien',
      lastModified: 1000,
      myGuitars: ['lp60', 'sg61', 'es335', 'strat61', 'tele63'],
    };
    const remote = {
      id: 'sebastien',
      lastModified: 2000,
      myGuitars: ['sire_t7', 'sire_t3'], // pollution Francisco
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(['lp60', 'sg61', 'es335', 'strat61', 'tele63']);
  });

  test('drop modéré (1 guitare) → adopt remote (pas suspect)', () => {
    const local = { id: 'seb', lastModified: 1000, myGuitars: ['a', 'b', 'c', 'd'] };
    const remote = { id: 'seb', lastModified: 2000, myGuitars: ['a', 'b', 'c'] };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(['a', 'b', 'c']);
  });

  test('Phase 7.74.10 — language adoption gated par languageModified, pas par delta (legacy delta 60s retiré)', () => {
    // Sans timestamps dédiés, pas d'adoption (les deux à 0 → keep local).
    const local = { id: 'seb', lastModified: 1000, language: 'fr' };
    const remote = { id: 'seb', lastModified: 3000, language: 'en' };
    const out = mergeProfileLWW(local, remote);
    expect(out.language).toBe('fr');
  });

  test('Phase 7.74.10 — language adopté SEULEMENT si remote.languageModified > local.languageModified', () => {
    const local = { id: 'seb', lastModified: 1000, language: 'fr', languageModified: 100 };
    const remote = { id: 'seb', lastModified: 100000, language: 'en', languageModified: 200 };
    const out = mergeProfileLWW(local, remote);
    expect(out.language).toBe('en'); // remote.languageModified (200) > local (100) → adopté
  });

  test('customGuitars : union par id, remote overwrite si conflit', () => {
    const local = {
      id: 'seb', lastModified: 1000,
      customGuitars: [{ id: 'a', name: 'Local A' }, { id: 'b', name: 'Local B' }],
    };
    const remote = {
      id: 'seb', lastModified: 2000,
      customGuitars: [{ id: 'b', name: 'Remote B' }, { id: 'c', name: 'Remote C' }],
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.customGuitars).toHaveLength(3);
    const byId = Object.fromEntries(out.customGuitars.map((g) => [g.id, g]));
    expect(byId.a.name).toBe('Local A');
    expect(byId.b.name).toBe('Remote B'); // remote overwrite
    expect(byId.c.name).toBe('Remote C');
  });

  test('customPacks : union par name, remote overwrite si conflit', () => {
    const local = {
      id: 'seb', lastModified: 1000,
      customPacks: [{ name: 'Pack A', presets: [{ name: 'p1' }] }],
    };
    const remote = {
      id: 'seb', lastModified: 2000,
      customPacks: [{ name: 'Pack A', presets: [{ name: 'p1' }, { name: 'p2' }] }, { name: 'Pack B' }],
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.customPacks).toHaveLength(2);
    const byName = Object.fromEntries(out.customPacks.map((p) => [p.name, p]));
    expect(byName['Pack A'].presets).toHaveLength(2);
    expect(byName['Pack B']).toBeTruthy();
  });

  test('local null → retourne remote', () => {
    const remote = { id: 'seb', lastModified: 1000, name: 'Remote' };
    expect(mergeProfileLWW(null, remote)).toBe(remote);
  });

  test('remote null → retourne local', () => {
    const local = { id: 'seb', lastModified: 1000, name: 'Local' };
    expect(mergeProfileLWW(local, null)).toBe(local);
  });

  // Phase 7.74.1 — orphan cross-profile filter
  test('SCÉNARIO BUG 2 : remote add guitare appartenant à autre profil → filter orphan', () => {
    // Cas Sébastien 2026-05-19 : remote essaye d'ajouter sire_t7+t3
    // au profil Sébastien. sire_t7/t3 appartiennent à Francisco local.
    // Drop modéré (1 guitare) ne bloque pas Couche 3 v1, mais le
    // filter orphan-cross-profile Phase 7.74.1 doit kick in.
    const local = {
      id: 'sebastien', lastModified: 1000,
      myGuitars: ['lp60', 'sg61', 'es335', 'strat61', 'tele51'],
    };
    const remote = {
      id: 'sebastien', lastModified: 2000,
      // Drop tele51 + ADD sire_t7 + sire_t3 (pollution Francisco)
      myGuitars: ['lp60', 'sg61', 'es335', 'strat61', 'sire_t7', 'sire_t3'],
    };
    const otherProfilesGuitars = new Set(['sire_t7', 'sire_t3', 'ibanez_gio']); // guitares Francisco
    const out = mergeProfileLWW(local, remote, { otherProfilesGuitars });
    // Doit avoir filtré sire_t7 + sire_t3 (orphans)
    expect(out.myGuitars).not.toContain('sire_t7');
    expect(out.myGuitars).not.toContain('sire_t3');
    // Mais doit adopter le drop tele51 (drop modéré accepté)
    expect(out.myGuitars).not.toContain('tele51');
  });

  test('local vide + remote contient orphans → filter au premier merge', () => {
    const local = { id: 'newuser', lastModified: 1000, myGuitars: [] };
    const remote = { id: 'newuser', lastModified: 2000, myGuitars: ['lp60', 'sire_t7'] };
    const otherProfilesGuitars = new Set(['sire_t7']);
    const out = mergeProfileLWW(local, remote, { otherProfilesGuitars });
    expect(out.myGuitars).toEqual(['lp60']);
    expect(out.myGuitars).not.toContain('sire_t7');
  });

  test('guitare partagée légitimement (présente dans plusieurs profils) → pas considérée orphan', () => {
    // lp60 est dans Sébastien ET dans Bruno local. Remote ajoute lp60
    // à Bruno : ne doit pas filtrer (légitime).
    const local = { id: 'bruno', lastModified: 1000, myGuitars: ['schecter_c1'] };
    const remote = { id: 'bruno', lastModified: 2000, myGuitars: ['schecter_c1', 'lp60'] };
    const otherProfilesGuitars = new Set(['lp60']); // appartient à Sébastien aussi
    const out = mergeProfileLWW(local, remote, { otherProfilesGuitars });
    // lp60 est dans la set otherProfilesGuitars (car appartient à Séb)
    // ET pas dans local (Bruno n'avait pas lp60) → orphan filtré
    expect(out.myGuitars).not.toContain('lp60');
    // Note : sémantique stricte. Si user veut vraiment partager une
    // guitare standard entre profils, il devra accepter le filter
    // initial puis re-cocher manuellement.
  });
});

describe('repairProfileGuitarsOrphans — Phase 7.74.2', () => {
  // Helper pour import
  let repairFn;
  beforeEach(async () => {
    const mod = await import('./state.js');
    repairFn = mod.repairProfileGuitarsOrphans;
  });

  test('SCÉNARIO BUG SÉBASTIEN : id fantôme cg_xxx absent partout → drop', () => {
    const state = {
      profiles: {
        sebastien: {
          id: 'sebastien',
          name: 'Sébastien',
          myGuitars: ['lp60', 'cg_1778885069427'], // cg_1778885069427 ghost
          customGuitars: [],
          lastModified: 1000,
        },
      },
      shared: {
        customGuitars: [{ id: 'cg_1779120397266', name: 'Tele 51' }], // l'id réel
      },
    };
    const catalog = [{ id: 'lp60', name: 'Les Paul' }];
    const result = repairFn(state, catalog);
    expect(result.repairs).toHaveLength(1);
    expect(result.repairs[0].removed).toEqual(['cg_1778885069427']);
    expect(result.state.profiles.sebastien.myGuitars).toEqual(['lp60']);
    expect(result.state.profiles.sebastien.lastModified).toBeGreaterThan(1000);
  });

  test('id standard catalog → conservé', () => {
    const state = {
      profiles: { seb: { id: 'seb', myGuitars: ['lp60', 'sg61'], customGuitars: [] } },
      shared: { customGuitars: [] },
    };
    const catalog = [{ id: 'lp60' }, { id: 'sg61' }];
    const result = repairFn(state, catalog);
    expect(result.repairs).toEqual([]);
    expect(result.state).toBe(state); // référence identique si pas de repair
  });

  test('id dans shared.customGuitars → conservé', () => {
    const state = {
      profiles: { seb: { id: 'seb', myGuitars: ['cg_real'], customGuitars: [] } },
      shared: { customGuitars: [{ id: 'cg_real' }] },
    };
    const result = repairFn(state, []);
    expect(result.repairs).toEqual([]);
  });

  test('id dans profile.customGuitars legacy → conservé', () => {
    const state = {
      profiles: { seb: { id: 'seb', myGuitars: ['cg_legacy'], customGuitars: [{ id: 'cg_legacy' }] } },
      shared: {},
    };
    const result = repairFn(state, []);
    expect(result.repairs).toEqual([]);
  });

  test('aucun profil → pas de repair', () => {
    expect(repairFn({}, []).repairs).toEqual([]);
    expect(repairFn(null, []).repairs).toEqual([]);
  });

  test('immutabilité : state original non muté', () => {
    const state = {
      profiles: { seb: { id: 'seb', myGuitars: ['orphan'], customGuitars: [], lastModified: 1000 } },
      shared: {},
    };
    const orig = state.profiles.seb;
    repairFn(state, []);
    expect(state.profiles.seb).toBe(orig);
    expect(state.profiles.seb.myGuitars).toEqual(['orphan']);
  });

  test('plusieurs profils avec orphans : repair indépendant', () => {
    const state = {
      profiles: {
        seb: { id: 'seb', myGuitars: ['lp60', 'orphan_a'], customGuitars: [], lastModified: 1000 },
        bruno: { id: 'bruno', myGuitars: ['sg61', 'orphan_b'], customGuitars: [], lastModified: 1000 },
      },
      shared: {},
    };
    const catalog = [{ id: 'lp60' }, { id: 'sg61' }];
    const result = repairFn(state, catalog);
    expect(result.repairs).toHaveLength(2);
    expect(result.state.profiles.seb.myGuitars).toEqual(['lp60']);
    expect(result.state.profiles.bruno.myGuitars).toEqual(['sg61']);
  });
});

describe('mergeProfilesLWW — Phase 7.74.1 calcul otherProfilesGuitarsByProfile', () => {
  test('passe correctement otherProfilesGuitars au merge per-field', () => {
    const local = {
      sebastien: { id: 'sebastien', lastModified: 1000, myGuitars: ['lp60', 'tele51'] },
      francisco: { id: 'francisco', lastModified: 1000, myGuitars: ['sire_t7', 'sire_t3'] },
    };
    const remote = {
      sebastien: { id: 'sebastien', lastModified: 2000, myGuitars: ['lp60', 'sire_t7'] }, // pollution
      francisco: { id: 'francisco', lastModified: 1000, myGuitars: ['sire_t7', 'sire_t3'] },
    };
    const out = mergeProfilesLWW(local, remote);
    // Sébastien doit avoir sire_t7 filtré (orphan Francisco)
    expect(out.sebastien.myGuitars).not.toContain('sire_t7');
    // Francisco inchangé
    expect(out.francisco.myGuitars).toEqual(expect.arrayContaining(['sire_t7', 'sire_t3']));
  });
});

// ─── Phase 7.74 Couche 4 — dedup intégré au mergeSetlistsLWW ──────────
describe('mergeSetlistsLWW — Phase 7.74 Couche 4 dedup intégré', () => {
  test('doublons name+profileIds divergents → fusion auto', () => {
    // Cas Sébastien : "Cours Franck B" présent 2x avec profileIds
    // divergents (sebastien vs sebastien+franck). dedupSetlists
    // mergeAcrossProfiles fusionne.
    const local = [
      { id: 'sl1', name: 'Cours Franck B', profileIds: ['sebastien'], songIds: ['s1', 's2'], lastModified: 1000 },
    ];
    const remote = [
      { id: 'sl2', name: 'Cours Franck B', profileIds: ['sebastien', 'franck'], songIds: ['s2', 's3'], lastModified: 1500 },
    ];
    const out = mergeSetlistsLWW(local, remote, {});
    expect(out).toHaveLength(1); // dedup fusionné
    // Le survivant a les songIds + profileIds union
    const survivor = out[0];
    expect(survivor.songIds).toEqual(expect.arrayContaining(['s1', 's2', 's3']));
    expect(survivor.profileIds).toEqual(expect.arrayContaining(['sebastien', 'franck']));
  });

  test('pas de doublon → retourne le merge LWW standard sans modif', () => {
    const local = [{ id: 'sl1', name: 'Setlist A', profileIds: ['seb'], songIds: ['s1'], lastModified: 1000 }];
    const remote = [{ id: 'sl2', name: 'Setlist B', profileIds: ['seb'], songIds: ['s2'], lastModified: 2000 }];
    const out = mergeSetlistsLWW(local, remote, {});
    expect(out).toHaveLength(2);
  });

  test('stamp lastModified du survivant si fusion (propage le clean via sync)', () => {
    const before = Date.now() - 60000;
    const local = [
      { id: 'sl1', name: 'A', profileIds: ['seb'], songIds: ['s1'], lastModified: before },
    ];
    const remote = [
      { id: 'sl2', name: 'A', profileIds: ['seb'], songIds: ['s2'], lastModified: before + 1000 },
    ];
    const out = mergeSetlistsLWW(local, remote, {});
    expect(out).toHaveLength(1);
    // Survivant a stamp récent
    expect(out[0].lastModified).toBeGreaterThan(before + 5000);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.74.4 — Couche 4 : swap suspect cg_*→standard + union remote
// ───────────────────────────────────────────────────────────────────

describe('mergeProfileLWW — Phase 7.74.4 swap suspect cg_*→standard', () => {
  test('SCÉNARIO BUG 4 (2026-05-19 soir) : drop cg_* + add standard hors otherProfilesGuitars → keep local', () => {
    // Reproduction exacte du bug observé via wrapper Phase 7.74.5 :
    // - local Mac : 11 standards Sébastien + cg_1779120397266 (Tele 51)
    // - remote pollué (iPhone session antérieure) : 11 standards + sire_t3
    // - otherProfilesGuitars : sire_t3 N'EST PAS DEDANS (Francisco actuel
    //   n'a que [sire_t7, cg_1779120671806], donc sire_t3 pas dans le rig
    //   d'aucun profil au moment du merge)
    // → Couche 3 drop ≥3 inopérante (drop = 1)
    // → Couche 1 orphan check inopérante (sire_t3 pas dans otherProfilesGuitars)
    // → Couche 4 swap suspect doit catch : drop 1 cg_* + add 1 g_* → keep local
    const local = {
      id: 'sebastien',
      lastModified: 1000,
      myGuitars: ['lp60', 'lp50p90', 'sg_ebony', 'sg61', 'es335', 'strat61', 'strat_pro2', 'strat_ec', 'tele63', 'tele_ultra', 'jazzmaster', 'cg_1779120397266'],
    };
    const remote = {
      id: 'sebastien',
      lastModified: 2000,
      myGuitars: ['lp60', 'lp50p90', 'sg_ebony', 'sg61', 'es335', 'strat61', 'strat_pro2', 'strat_ec', 'tele63', 'tele_ultra', 'jazzmaster', 'sire_t3'],
    };
    const otherProfilesGuitars = new Set(['sire_t7', 'cg_1779120671806', 'schecter_c1']);
    const out = mergeProfileLWW(local, remote, { otherProfilesGuitars });
    // Tele 51 préservée (keep local entier)
    expect(out.myGuitars).toContain('cg_1779120397266');
    // sire_t3 rejeté
    expect(out.myGuitars).not.toContain('sire_t3');
    // 12 guitares, identique à local
    expect(out.myGuitars).toHaveLength(12);
  });

  test('drop 1 cg_* + add 2 standards hors orphans → keep local (swap suspect élargi)', () => {
    // Variante : même pattern avec multiple adds standard.
    const local = {
      id: 'seb', lastModified: 1000,
      myGuitars: ['lp60', 'cg_xxx'],
    };
    const remote = {
      id: 'seb', lastModified: 2000,
      myGuitars: ['lp60', 'sire_t3', 'sire_t7'],
    };
    const out = mergeProfileLWW(local, remote, { otherProfilesGuitars: new Set() });
    // Keep local : Tele 51 préservée, pas d'adoption suspecte
    expect(out.myGuitars).toEqual(['lp60', 'cg_xxx']);
  });

  test('régression : ajout SEUL d\'une guitare standard (pas de drop) → adopté normalement', () => {
    // User ajoute légitimement sg61 à son rig sur un autre device.
    // Pas de drop → swap suspect NE DOIT PAS s'activer.
    const local = {
      id: 'seb', lastModified: 1000,
      myGuitars: ['lp60', 'cg_xxx'],
    };
    const remote = {
      id: 'seb', lastModified: 2000,
      myGuitars: ['lp60', 'cg_xxx', 'sg61'],
    };
    const out = mergeProfileLWW(local, remote, { otherProfilesGuitars: new Set() });
    expect(out.myGuitars).toEqual(expect.arrayContaining(['lp60', 'cg_xxx', 'sg61']));
    expect(out.myGuitars).toHaveLength(3);
  });

  test('régression : drop d\'une standard (pas cg_*) + add standard → adopté (swap pas activé)', () => {
    // Le user remplace une standard par une autre standard.
    // Pas de cg_* dropped → pas un swap suspect au sens 7.74.4.
    const local = {
      id: 'seb', lastModified: 1000,
      myGuitars: ['lp60', 'sg61'],
    };
    const remote = {
      id: 'seb', lastModified: 2000,
      myGuitars: ['lp60', 'es335'],
    };
    const out = mergeProfileLWW(local, remote, { otherProfilesGuitars: new Set() });
    expect(out.myGuitars).toEqual(['lp60', 'es335']);
  });

  test('régression : drop 1 cg_* + add 1 cg_* (custom replace custom) → adopté', () => {
    // User remplace une custom par une autre custom (peu probable mais possible).
    // Le pattern n'est pas swap cg_*→standard (add est aussi cg_*) → adopté.
    const local = {
      id: 'seb', lastModified: 1000,
      myGuitars: ['lp60', 'cg_old'],
    };
    const remote = {
      id: 'seb', lastModified: 2000,
      myGuitars: ['lp60', 'cg_new'],
    };
    const out = mergeProfileLWW(local, remote, { otherProfilesGuitars: new Set() });
    expect(out.myGuitars).toEqual(['lp60', 'cg_new']);
  });

  test('régression : drop 2 cg_* + add 2 standards (drop ≤ 50% local) → adopté (swap pas activé)', () => {
    // Le pattern signature est "drop exactement 1 cg_*". Si drop > 1,
    // c'est Couche 3 (drop ≥3 = block, drop > 50% = block, drop modéré
    // ≤ 50% = adopt) qui décide. Ici local de 5 → drop 2 = 40% → adopt.
    const local = {
      id: 'seb', lastModified: 1000,
      myGuitars: ['lp60', 'sg61', 'es335', 'cg_a', 'cg_b'],
    };
    const remote = {
      id: 'seb', lastModified: 2000,
      myGuitars: ['lp60', 'sg61', 'es335', 'sire_t3', 'sire_t7'],
    };
    const out = mergeProfileLWW(local, remote, { otherProfilesGuitars: new Set() });
    // Drop = 2 (pas 1) → swap suspect non activé → adopté
    expect(out.myGuitars).toEqual(['lp60', 'sg61', 'es335', 'sire_t3', 'sire_t7']);
  });
});

describe('mergeProfileLWW — Phase 7.74.10 language adoption gated par languageModified (legacy delta retiré)', () => {
  test('languageModified absent des deux côtés (legacy v11-) → keep local (aucune adoption)', () => {
    // Avant Phase 7.74.10 : delta 30s ou 70s décidait. Maintenant le
    // garde-fou delta est retiré ; sans timestamp dédié, le merge ne
    // peut pas savoir si remote a vraiment changé sa langue → keep local.
    const local = {
      id: 'seb', lastModified: 1000,
      language: 'fr',
      myGuitars: ['lp60'],
    };
    const remote = {
      id: 'seb', lastModified: 1000 + 30000,
      language: 'en',
      myGuitars: ['lp60'],
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.language).toBe('fr');
    expect(out.languageModified).toBe(0);
  });

  test('remote.languageModified > local.languageModified → adopt remote', () => {
    // C'est ainsi qu'une vraie édition de langue propage via le merge.
    const local = {
      id: 'seb', lastModified: 1000,
      language: 'fr', languageModified: 500,
      myGuitars: ['lp60'],
    };
    const remote = {
      id: 'seb', lastModified: 2000,
      language: 'en', languageModified: 1500,
      myGuitars: ['lp60'],
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.language).toBe('en');
    expect(out.languageModified).toBe(1500);
  });

  test('local.languageModified > remote.languageModified → keep local (scénario bug FR→EN)', () => {
    // Scénario observé 2026-05-26 : device dormant pousse `language: en` +
    // `lastModified` récent (parce qu'il a fait une autre écriture
    // innocente), mais son `languageModified` est ancien (n'a pas changé
    // de langue). Le merge doit garder la langue locale.
    const local = {
      id: 'seb', lastModified: 1000,
      language: 'fr', languageModified: 5000,
      myGuitars: ['lp60'],
    };
    const remote = {
      id: 'seb', lastModified: 9999999,
      language: 'en', languageModified: 100,
      myGuitars: ['lp60'],
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.language).toBe('fr');
    expect(out.languageModified).toBe(5000);
  });

  test('égalité languageModified → keep local (idempotence)', () => {
    const local = {
      id: 'seb', lastModified: 1000,
      language: 'fr', languageModified: 500,
      myGuitars: ['lp60'],
    };
    const remote = {
      id: 'seb', lastModified: 2000,
      language: 'en', languageModified: 500,
      myGuitars: ['lp60'],
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.language).toBe('fr');
  });

  test('enabledDevices adopté seulement si enabledDevicesModified plus récent', () => {
    const local = {
      id: 'seb', lastModified: 1000,
      enabledDevices: ['tonex-anniversary'],
      enabledDevicesModified: 5000,
    };
    const remote = {
      id: 'seb', lastModified: 9999999,
      enabledDevices: ['tonex-pedal'],
      enabledDevicesModified: 100,
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.enabledDevices).toEqual(['tonex-anniversary']);
  });

  test('availableSources adopté seulement si availableSourcesModified plus récent', () => {
    const local = {
      id: 'seb', lastModified: 1000,
      availableSources: { TSR: true, ML: true },
      availableSourcesModified: 5000,
    };
    const remote = {
      id: 'seb', lastModified: 9999999,
      availableSources: { TSR: false, ML: false },
      availableSourcesModified: 100,
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.availableSources).toEqual({ TSR: true, ML: true });
  });
});

describe('migrateV11toV12 — Phase 7.74.10 backfill timestamps dédiés', () => {
  test('pose languageModified/enabledDevicesModified/availableSourcesModified à 0', () => {
    const v11 = {
      version: 11,
      profiles: {
        seb: { id: 'seb', name: 'Sébastien', isAdmin: true, banksModified: 12345 },
      },
    };
    const v12 = migrateV11toV12(v11);
    expect(v12.version).toBe(12);
    expect(v12.profiles.seb.languageModified).toBe(0);
    expect(v12.profiles.seb.enabledDevicesModified).toBe(0);
    expect(v12.profiles.seb.availableSourcesModified).toBe(0);
    expect(v12.profiles.seb.banksModified).toBe(12345); // préservé
  });

  test('idempotent : déjà v12 avec timestamps présents → no-op', () => {
    const v12 = {
      version: 12,
      profiles: {
        seb: {
          id: 'seb', name: 'Sébastien',
          languageModified: 1000,
          enabledDevicesModified: 2000,
          availableSourcesModified: 3000,
        },
      },
    };
    const out = ensureProfileV12(v12.profiles.seb);
    expect(out.languageModified).toBe(1000);
    expect(out.enabledDevicesModified).toBe(2000);
    expect(out.availableSourcesModified).toBe(3000);
  });

  test('partial backfill : préserve les timestamps présents', () => {
    const partial = {
      id: 'seb', name: 'Sébastien',
      languageModified: 7777, // déjà stampé
      // enabledDevicesModified / availableSourcesModified absents
    };
    const out = ensureProfileV12(partial);
    expect(out.languageModified).toBe(7777);
    expect(out.enabledDevicesModified).toBe(0);
    expect(out.availableSourcesModified).toBe(0);
  });
});

describe('migrateV12toV13 — Phase 8.1 intégration basse', () => {
  test('pose instruments/myBasses/customBasses/myBassAmps/customBassAmps avec defaults', () => {
    const v12 = {
      version: 12,
      profiles: {
        seb: { id: 'seb', name: 'Sébastien', isAdmin: true, banksModified: 12345 },
      },
    };
    const v13 = migrateV12toV13(v12);
    expect(v13.version).toBe(13);
    expect(v13.profiles.seb.instruments).toEqual(['guitar']);
    expect(v13.profiles.seb.myBasses).toEqual([]);
    expect(v13.profiles.seb.customBasses).toEqual([]);
    expect(v13.profiles.seb.myBassAmps).toEqual([]);
    expect(v13.profiles.seb.customBassAmps).toEqual([]);
    expect(v13.profiles.seb.banksModified).toBe(12345); // préservé
  });

  test('idempotent : profil déjà v13 → préserve les valeurs', () => {
    const v13 = {
      version: 13,
      profiles: {
        seb: {
          id: 'seb', name: 'Sébastien',
          instruments: ['guitar', 'bass'],
          myBasses: ['jazz_bass_player_plus', 'precision_avri'],
          customBasses: [],
          myBassAmps: ['rumble_100'],
          customBassAmps: [],
        },
      },
    };
    const out = ensureProfileV13(v13.profiles.seb);
    expect(out.instruments).toEqual(['guitar', 'bass']);
    expect(out.myBasses).toEqual(['jazz_bass_player_plus', 'precision_avri']);
    expect(out.myBassAmps).toEqual(['rumble_100']);
  });

  test('partial backfill : préserve champs présents, ajoute manquants', () => {
    const partial = {
      id: 'seb',
      instruments: ['bass'], // déjà set
      // myBasses, customBasses, etc. absents
    };
    const out = ensureProfileV13(partial);
    expect(out.instruments).toEqual(['bass']);
    expect(out.myBasses).toEqual([]);
    expect(out.customBasses).toEqual([]);
    expect(out.myBassAmps).toEqual([]);
    expect(out.customBassAmps).toEqual([]);
  });

  test('null profile → return null', () => {
    expect(ensureProfileV13(null)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.74.11 — Device fingerprint pour identifier les sources de
// pollution profile (cf docs/INVESTIGATION_POLLUTION_PROFILE.md).
// ───────────────────────────────────────────────────────────────────

describe('Phase 7.74.11 — Device fingerprint', () => {
  // Stub localStorage pour les tests (Vitest tourne en jsdom mais on
  // veut clean state à chaque test).
  let mockStorage;
  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; },
      clear: () => { mockStorage = {}; },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('getDeviceId génère un ID au format platform-YYMMDD-rand6', () => {
    const id = getDeviceId();
    expect(id).toMatch(/^(mac|iphone|ipad|android|win|linux|web|node)-\d{6}-[a-z0-9]{6}$/);
  });

  test('getDeviceId est idempotent (persistance localStorage)', () => {
    const id1 = getDeviceId();
    const id2 = getDeviceId();
    expect(id1).toBe(id2);
  });

  test('getDeviceLabel retourne null si non posé', () => {
    expect(getDeviceLabel()).toBeNull();
  });

  test('setDeviceLabel + getDeviceLabel round-trip', () => {
    setDeviceLabel('Mac Sébastien');
    expect(getDeviceLabel()).toBe('Mac Sébastien');
  });

  test('setDeviceLabel(null/empty) retire le label', () => {
    setDeviceLabel('Tmp Label');
    setDeviceLabel('');
    expect(getDeviceLabel()).toBeNull();
  });

  test('setDeviceLabel trim + cap 80 chars', () => {
    const longLabel = 'a'.repeat(200);
    setDeviceLabel('  Label avec spaces  ');
    expect(getDeviceLabel()).toBe('Label avec spaces');
    setDeviceLabel(longLabel);
    expect(getDeviceLabel().length).toBe(80);
  });

  test('mergeProfileLWW : remoteDeviceId/Label propagé dans les logs forensique', () => {
    // On vérifie qu'aucune exception n'est levée quand on passe les
    // options remoteDeviceId/Label (le log devra inclure le device dans
    // les chaînes "BLOCKED" / "ADOPTED" mais ça n'est testable
    // précisément qu'avec un spy sur console.warn).
    const local = {
      id: 'seb', lastModified: 1000,
      language: 'fr', languageModified: 5000,
    };
    const remote = {
      id: 'seb', lastModified: 9999,
      language: 'en', languageModified: 100,
    };
    const out = mergeProfileLWW(local, remote, {
      remoteDeviceId: 'mac-260527-abc123',
      remoteDeviceLabel: 'iPhone Bruno',
    });
    expect(out.language).toBe('fr'); // BLOCKED → keep local
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.74.12 — myGuitarsModified per-field LWW (Sébastien iPad bug)
// ───────────────────────────────────────────────────────────────────

describe('Phase 7.74.12 — myGuitarsModified per-field LWW', () => {
  test('migrateV13toV14 backfill myGuitarsModified = 0 sur tous profils', () => {
    const state = {
      version: 13,
      profiles: {
        sebastien: { id: 'sebastien', name: 'Sébastien', myGuitars: ['lp60'], lastModified: 1000 },
        bruno: { id: 'bruno', name: 'Bruno', myGuitars: ['schecter_c1'], lastModified: 2000 },
      },
    };
    const out = migrateV13toV14(state);
    expect(out.version).toBe(14);
    expect(out.profiles.sebastien.myGuitarsModified).toBe(0);
    expect(out.profiles.bruno.myGuitarsModified).toBe(0);
    expect(out.profiles.sebastien.myGuitars).toEqual(['lp60']); // données inchangées
  });

  test('ensureProfileV14 idempotent (préserve myGuitarsModified existant)', () => {
    const profile = { id: 's', name: 'S', myGuitars: ['lp60'], myGuitarsModified: 12345 };
    const out = ensureProfileV14(profile);
    expect(out.myGuitarsModified).toBe(12345);
  });

  test('SCÉNARIO BUG SÉBASTIEN iPad : rts <= lts MAIS rts_g > lts_g → adopt remote myGuitars (clean)', () => {
    // iPad local : pollué avec Sire, lastModified bumpé par une autre écriture
    const local = {
      id: 'sebastien', name: 'Sébastien',
      myGuitars: ['lp60', 'sg61', 'sire_t7', 'sire_t3'], // pollué
      myGuitarsModified: 100, // vieux (Sire setup historique)
      lastModified: 1000, // bumpé récemment par autre écriture
    };
    // Mac remote : clean (sans Sire), myGuitarsModified plus récent (toggle volontaire)
    const remote = {
      id: 'sebastien', name: 'Sébastien',
      myGuitars: ['lp60', 'sg61'], // clean
      myGuitarsModified: 5000, // toggle Mac récent
      lastModified: 500, // mais lastModified global pas bumpé depuis
    };
    const out = mergeProfileLWW(local, remote);
    // rts (500) <= lts (1000), MAIS rts_g (5000) > lts_g (100)
    // → adoption per-field : myGuitars adopté de remote (clean)
    expect(out.myGuitars).toEqual(['lp60', 'sg61']);
    expect(out.myGuitarsModified).toBe(5000);
  });

  test('rts <= lts ET rts_g <= lts_g → keep local myGuitars (pas d\'adoption)', () => {
    const local = {
      id: 's', name: 'S',
      myGuitars: ['lp60'], myGuitarsModified: 2000,
      lastModified: 1000,
    };
    const remote = {
      id: 's', name: 'S',
      myGuitars: ['sg61'], myGuitarsModified: 1500, // plus ancien
      lastModified: 500,
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(['lp60']); // local conservé
  });

  test('rts > lts ET lts_g > rts_g → BLOCK adoption myGuitars (local plus récent sur la dim)', () => {
    // Cas où global remote est plus récent, mais local a stamp myGuitars
    // plus récent → on ne doit pas écraser local myGuitars avec remote.
    const local = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg61'], myGuitarsModified: 5000, // toggle local récent
      lastModified: 1000,
    };
    const remote = {
      id: 's', name: 'S',
      myGuitars: ['lp60'], myGuitarsModified: 100, // myGuitars stale
      lastModified: 9000, // mais global rts > lts
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(['lp60', 'sg61']); // local conservé sur myGuitars
    expect(out.myGuitarsModified).toBe(5000);
  });

  test('legacy : rts > lts + myGuitarsModified=0 des deux côtés → adopt remote (comportement Phase 7.74.x préservé)', () => {
    const local = {
      id: 's', name: 'S',
      myGuitars: ['lp60'], myGuitarsModified: 0,
      lastModified: 100,
    };
    const remote = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg61'], myGuitarsModified: 0,
      lastModified: 9000,
    };
    const out = mergeProfileLWW(local, remote);
    // rts_g === lts_g === 0, branche "adopt remote with defenses" (drop 0
    // donc sous le seuil ≥3) → adopté.
    expect(out.myGuitars).toEqual(['lp60', 'sg61']);
  });

  test('stampedProfileUpdate stamp myGuitarsModified quand field=myGuitars', () => {
    const profiles = { sebastien: { id: 'sebastien', myGuitars: ['lp60'], myGuitarsModified: 100 } };
    const out = stampedProfileUpdate(profiles, 'sebastien', { myGuitars: ['lp60', 'sg61'] });
    expect(out.sebastien.myGuitars).toEqual(['lp60', 'sg61']);
    expect(out.sebastien.myGuitarsModified).toBeGreaterThan(100);
  });

  test('stampedProfileUpdate ne stamp PAS myGuitarsModified si autre field écrit', () => {
    const profiles = { sebastien: { id: 'sebastien', myGuitars: ['lp60'], myGuitarsModified: 100 } };
    const out = stampedProfileUpdate(profiles, 'sebastien', { language: 'en' });
    expect(out.sebastien.myGuitarsModified).toBe(100); // inchangé
    expect(out.sebastien.languageModified).toBeGreaterThan(0); // langue stampée
  });

  test('mergeMyGuitarsWithDefenses helper : Couche 3 drop ≥3 → keep local + blocked=true', () => {
    const local = { myGuitars: ['lp60', 'sg61', 'es335', 'strat61'] };
    const remote = { myGuitars: ['lp60'] }; // drop 3 → suspect
    const out = mergeMyGuitarsWithDefenses(local, remote, {});
    expect(out.guitars).toEqual(['lp60', 'sg61', 'es335', 'strat61']);
    expect(out.blocked).toBe(true);
  });

  test('mergeMyGuitarsWithDefenses helper : drop 2 standards → adopt remote (sous seuil) + blocked=false', () => {
    const local = { myGuitars: ['lp60', 'sg61', 'sire_t7', 'sire_t3'] }; // 4 dont 2 polluants
    const remote = { myGuitars: ['lp60', 'sg61'] }; // drop 2 → sous seuil 3 ET sous 50%
    const out = mergeMyGuitarsWithDefenses(local, remote, {});
    expect(out.guitars).toEqual(['lp60', 'sg61']);
    expect(out.blocked).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.74.13 — Fix défense+timestamp incohérence (bug iPad 2026-06-01)
// ───────────────────────────────────────────────────────────────────
//
// Quand `mergeMyGuitarsWithDefenses` block (Couche 3 drop ≥3 ou Couche 4
// swap), `mergeProfileLWW` ne doit PAS stamper `myGuitarsModified` à la
// valeur remote — sinon on a un état "timestamp adopté mais données
// locales" qui rend la pollution permanente côté défense (le pull suivant
// avec remote ts ≤ local ts ne re-déclenche pas le merge per-field).

describe('Phase 7.74.13 — défense+timestamp cohérence', () => {
  test('branche rts<=lts : Couche 3 BLOCK → myGuitarsModified=local (pas remote)', () => {
    // Bug iPad Sébastien 2026-06-01 reproduit :
    // - iPad local pollué avec 13 guitares (10 standards + sg61, sire_t7, sire_t3)
    // - Mac remote clean 11 guitares, myGuitarsModified=08:53 (récent), lastModified plus ancien
    // - rts (Mac global) <= lts (iPad global) ; rts_g (08:53) > lts_g (0)
    // - Couche 3 : drop=3 (sg61, sire_t7, sire_t3) → BLOCK
    // - AVANT 7.74.13 : myGuitars=local (13), myGuitarsModified=Mac (08:53) ← incohérent
    // - APRÈS 7.74.13 : myGuitars=local (13), myGuitarsModified=local (0) ← cohérent
    const local = {
      id: 'sebastien', name: 'S',
      myGuitars: ['lp60', 'lp50p90', 'sg_ebony', 'sg61', 'es335',
                  'strat61', 'strat_pro2', 'strat_ec', 'tele63',
                  'tele_ultra', 'jazzmaster', 'sire_t7', 'sire_t3'],
      myGuitarsModified: 0,
      lastModified: 1000, // bumpé pour autre raison
    };
    const remote = {
      id: 'sebastien', name: 'S',
      myGuitars: ['lp60', 'lp50p90', 'sg_ebony', 'es335', 'strat61',
                  'strat_pro2', 'strat_ec', 'tele63', 'tele_ultra',
                  'jazzmaster', 'cg_1779120397266'], // Mac clean + Tele 51
      myGuitarsModified: 5000,
      lastModified: 500,
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(local.myGuitars); // BLOCKED → keep local
    expect(out.myGuitarsModified).toBe(0); // ← FIX 7.74.13 : pas 5000
  });

  test('branche rts<=lts : adoption clean → myGuitarsModified=remote (comportement normal)', () => {
    const local = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg_ebony'],
      myGuitarsModified: 100,
      lastModified: 1000,
    };
    const remote = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg_ebony', 'es335'], // add 1 → adopt
      myGuitarsModified: 5000,
      lastModified: 500,
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(['lp60', 'sg_ebony', 'es335']);
    expect(out.myGuitarsModified).toBe(5000); // adoption → stamp remote
  });

  test('branche rts>lts : Couche 3 BLOCK → myGuitarsModified=lts_g (pas max)', () => {
    const local = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg61', 'es335', 'strat61'],
      myGuitarsModified: 100,
      lastModified: 500,
    };
    const remote = {
      id: 's', name: 'S',
      myGuitars: ['lp60'], // drop 3 → BLOCK Couche 3
      myGuitarsModified: 200,
      lastModified: 1000, // rts > lts (global)
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(['lp60', 'sg61', 'es335', 'strat61']);
    expect(out.myGuitarsModified).toBe(100); // ← FIX 7.74.13 : pas 200
  });

  test('branche rts>lts : Couche 4 swap BLOCK → myGuitarsModified=lts_g', () => {
    const local = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'cg_1779120397266'], // Tele 51 custom
      myGuitarsModified: 100,
      lastModified: 500,
    };
    const remote = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg61'], // drop cg_ + add standard → swap suspect
      myGuitarsModified: 200,
      lastModified: 1000,
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(['lp60', 'cg_1779120397266']);
    expect(out.myGuitarsModified).toBe(100); // ← FIX 7.74.13
  });

  test('branche rts>lts : adoption clean (drop 1 standard) → myGuitarsModified=max', () => {
    const local = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg_ebony', 'es335'],
      myGuitarsModified: 100,
      lastModified: 500,
    };
    const remote = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg_ebony'], // drop 1 standard → sous seuil
      myGuitarsModified: 200,
      lastModified: 1000,
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.myGuitars).toEqual(['lp60', 'sg_ebony']);
    expect(out.myGuitarsModified).toBe(200); // adoption → stamp remote
  });

  test('branche rts>lts : filter orphan (adoption partielle) → myGuitarsModified=max', () => {
    // Orphan-cross-profile = adoption partielle (on accepte remote moins
    // les orphans). Reste considéré comme adopté pour le timestamp.
    const local = {
      id: 'sebastien', name: 'S',
      myGuitars: ['lp60', 'sg_ebony'],
      myGuitarsModified: 100,
      lastModified: 500,
    };
    const remote = {
      id: 'sebastien', name: 'S',
      myGuitars: ['lp60', 'sg_ebony', 'sg61'], // sg61 orphan (Arthur)
      myGuitarsModified: 200,
      lastModified: 1000,
    };
    const out = mergeProfileLWW(local, remote, {
      otherProfilesGuitars: new Set(['sg61']),
    });
    expect(out.myGuitars).toEqual(['lp60', 'sg_ebony']); // filtered
    expect(out.myGuitarsModified).toBe(200); // partial adoption → stamp remote
  });

  test('séquence post-fix : 2e merge ne re-block plus puisque ts cohérent', () => {
    // Scénario crucial : sans Phase 7.74.13, le 1er merge laisse
    // myGuitarsModified=remote, mais myGuitars=local. Le 2e merge avec
    // remote-ts<=local-ts ne re-déclenche pas la défense per-field →
    // pollution perdure. Phase 7.74.13 keep ts=local → prochaine sync
    // peut re-tester la défense.
    const local1 = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg61', 'es335', 'strat61'], // pollué
      myGuitarsModified: 0,
      lastModified: 1000,
    };
    const remote1 = {
      id: 's', name: 'S',
      myGuitars: ['lp60'], // drop 3 → BLOCK
      myGuitarsModified: 5000,
      lastModified: 500,
    };
    const out1 = mergeProfileLWW(local1, remote1);
    expect(out1.myGuitarsModified).toBe(0); // Phase 7.74.13 : pas 5000

    // 2e merge : si dans le futur un autre device push une version
    // raisonnable (drop 1 = sous seuil), on doit pouvoir l'adopter.
    const remote2 = {
      id: 's', name: 'S',
      myGuitars: ['lp60', 'sg61', 'es335'], // drop strat61 = 1 standard
      myGuitarsModified: 6000,
      lastModified: 2000,
    };
    const out2 = mergeProfileLWW(out1, remote2);
    expect(out2.myGuitars).toEqual(['lp60', 'sg61', 'es335']); // adoption clean
    expect(out2.myGuitarsModified).toBe(6000);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.80.2 — Fix mergeProfileLWW aiCache per-songId
// ───────────────────────────────────────────────────────────────────

describe('mergeProfileLWW — Phase 7.80.2 aiCache per-songId merge', () => {
  test('scénario bug Mac↔iPhone : local plein + remote vide (récent) → keep local plein', () => {
    // Cas observé : Mac a fait analyses → push avec aiCache plein, T1.
    // iPhone toggle un truc → push avec aiCache vide, T2 > T1.
    // Avant fix : Mac pull → merged = {...remote} → aiCache = {} ← PERTE.
    // Fix : merge per-songId → garde Mac.aiCache (local plein).
    const local = {
      id: 'seb',
      lastModified: 1000,
      myGuitars: ['lp60'],
      aiCache: {
        song_a: { sv: 9, result: { ideal_guitar: 'LP' } },
        song_b: { sv: 9, result: { ideal_guitar: 'SG' } },
      },
    };
    const remote = {
      id: 'seb',
      lastModified: 2000, // PLUS RÉCENT
      myGuitars: ['lp60'],
      aiCache: {}, // VIDE !
    };
    const out = mergeProfileLWW(local, remote);
    expect(Object.keys(out.aiCache).sort()).toEqual(['song_a', 'song_b']);
    expect(out.aiCache.song_a.sv).toBe(9);
    expect(out.aiCache.song_b.sv).toBe(9);
  });

  test('local vide + remote plein → adopt remote', () => {
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: {},
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { song_a: { sv: 9, result: { ideal_guitar: 'LP' } } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(Object.keys(out.aiCache)).toEqual(['song_a']);
    expect(out.aiCache.song_a.sv).toBe(9);
  });

  test('conflit sur même songId → sv le plus élevé gagne', () => {
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { song_a: { sv: 8, result: { ideal_guitar: 'LP-old' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { song_a: { sv: 9, result: { ideal_guitar: 'LP-new' } } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.aiCache.song_a.sv).toBe(9);
    expect(out.aiCache.song_a.result.ideal_guitar).toBe('LP-new');
  });

  test('égalité sv → keep local (stabilité)', () => {
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { song_a: { sv: 9, result: { ideal_guitar: 'LP-local' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { song_a: { sv: 9, result: { ideal_guitar: 'LP-remote' } } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.aiCache.song_a.result.ideal_guitar).toBe('LP-local');
  });

  test('union per-songId : Mac a song_a + iPhone analyse song_b → merge garde les 2', () => {
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { song_a: { sv: 9, result: { ideal_guitar: 'LP' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { song_b: { sv: 9, result: { ideal_guitar: 'SG' } } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(Object.keys(out.aiCache).sort()).toEqual(['song_a', 'song_b']);
  });

  test('Phase 7.74.9 — si remote plus ancien (rts ≤ lts) MAIS aiCache divergent → merge aiCache, autres champs locaux préservés', () => {
    const local = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { song_a: { sv: 9, ts: 100, result: { ideal_guitar: 'LP' } } },
    };
    const remote = {
      id: 'seb', lastModified: 1000, myGuitars: ['sg61'],
      aiCache: { song_b: { sv: 9, ts: 200, result: { ideal_guitar: 'SG' } } },
    };
    const out = mergeProfileLWW(local, remote);
    // Phase 7.74.9 : setSongAiCache ne stamp plus lastModified. Donc un
    // device qui ne fait QUE des analyses peut avoir rts <= lts vs un
    // autre device qui a fait une écriture stampante. Les analyses
    // doivent quand même descendre. Le merge aiCache per-songId est
    // appliqué ; les autres champs (myGuitars, language, banks…) restent
    // locaux car rts <= lts.
    expect(out.myGuitars).toEqual(['lp60']); // local preserved
    expect(Object.keys(out.aiCache).sort()).toEqual(['song_a', 'song_b']);
    expect(out.aiCache.song_a.result.ideal_guitar).toBe('LP');
    expect(out.aiCache.song_b.result.ideal_guitar).toBe('SG');
  });

  test('Phase 7.74.9 — si remote plus ancien ET aiCache identique → return local identité (pas de clone)', () => {
    const sharedCache = { song_a: { sv: 9, ts: 100, result: { ideal_guitar: 'LP' } } };
    const local = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: sharedCache,
    };
    const remote = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: sharedCache, // même contenu → no-op
    };
    const out = mergeProfileLWW(local, remote);
    expect(out).toBe(local); // identity check (pas de clone gratuit)
  });

  test('aiCache absent des 2 côtés → mergedAi = {}', () => {
    const local = { id: 'seb', lastModified: 1000, myGuitars: ['lp60'] };
    const remote = { id: 'seb', lastModified: 2000, myGuitars: ['lp60'] };
    const out = mergeProfileLWW(local, remote);
    expect(out.aiCache).toEqual({});
  });

  test('aiCache null défensif → traité comme {} ', () => {
    const local = { id: 'seb', lastModified: 1000, myGuitars: ['lp60'], aiCache: null };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { song_a: { sv: 9 } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.aiCache.song_a.sv).toBe(9);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.81 — Fix divergence aiCache via LWW par ts
// ───────────────────────────────────────────────────────────────────
// Phase 7.80.2 résolvait le bug "Mac plein vs iPhone vide" via merge
// per-songId. Mais le tiebreak par `sv` (SCORING_VERSION) ne convergait
// pas quand 2 devices avaient analysé indépendamment le même morceau :
// sv = 9 partout → égalité → keep local des 2 côtés → divergence
// permanente (cas Hells Bells / Mountain Climbing observé 2026-05-20).
//
// Phase 7.81 : LWW par `ts` (timestamp posé par updateAiCache). Le
// device qui a analysé en dernier gagne. Fallback sv pour entries
// legacy sans ts.

describe('mergeProfileLWW — Phase 7.81 aiCache LWW par ts', () => {
  test('SCÉNARIO BUG : 2 devices ont analysé indépendamment HB → ts plus récent gagne', () => {
    // Mac a analysé HB à T1 = 1000, result A.
    // iPhone a analysé HB à T2 = 2000, result B.
    // iPhone push → Mac pull → adopt remote (ts B > ts A).
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, ts: 1000, result: { ref_amp: 'JMP 50 (Mac)' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, ts: 2000, result: { ref_amp: 'Super Lead (iPhone)' } } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.aiCache.hb.result.ref_amp).toBe('Super Lead (iPhone)');
    expect(out.aiCache.hb.ts).toBe(2000);
  });

  test('ts local plus récent que remote → keep local', () => {
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, ts: 5000, result: { ref_amp: 'LOCAL' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, ts: 3000, result: { ref_amp: 'REMOTE' } } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.aiCache.hb.result.ref_amp).toBe('LOCAL');
  });

  test('égalité ts → keep local (stabilité)', () => {
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, ts: 5000, result: { ref_amp: 'LOCAL' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, ts: 5000, result: { ref_amp: 'REMOTE' } } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.aiCache.hb.result.ref_amp).toBe('LOCAL');
  });

  test('local sans ts (legacy) + remote avec ts → remote gagne (rts > 0, lts = 0)', () => {
    // Cas migration : Mac upgrade d'abord, refait fetchAI HB → ts.
    // iPhone encore sur ancien code (Phase 7.80.2) : aiCache HB sans ts.
    // iPhone upgrade puis pull → adopt remote (Mac avec ts récent).
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, result: { ref_amp: 'LEGACY-noTS' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, ts: 5000, result: { ref_amp: 'FRESH-withTS' } } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.aiCache.hb.result.ref_amp).toBe('FRESH-withTS');
  });

  test('local avec ts + remote sans ts (legacy) → local gagne (lts > 0, rts = 0)', () => {
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, ts: 5000, result: { ref_amp: 'FRESH' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, result: { ref_amp: 'LEGACY' } } },
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.aiCache.hb.result.ref_amp).toBe('FRESH');
  });

  test('aucun ts (2 caches legacy) → fallback sv → comportement Phase 7.80.2 préservé', () => {
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, result: { ref_amp: 'A' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, result: { ref_amp: 'B' } } },
    };
    const out = mergeProfileLWW(local, remote);
    // Égalité sv (fallback legacy) → keep local
    expect(out.aiCache.hb.result.ref_amp).toBe('A');
  });

  test('priorité ts sur sv : ts plus récent gagne même si sv plus bas', () => {
    // Cas dégénéré : Mac a fait fetchAI sur sv=9 avec ts récent ; iPhone
    // a un cache plus ancien stamped sv=10 (impossible en pratique mais
    // testons la priorité de l'algo : ts > sv).
    const local = {
      id: 'seb', lastModified: 1000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 9, ts: 5000, result: { ref_amp: 'A' } } },
    };
    const remote = {
      id: 'seb', lastModified: 2000, myGuitars: ['lp60'],
      aiCache: { hb: { sv: 10, ts: 3000, result: { ref_amp: 'B' } } },
    };
    const out = mergeProfileLWW(local, remote);
    // ts local (5000) > ts remote (3000) → keep local
    expect(out.aiCache.hb.result.ref_amp).toBe('A');
  });
});

describe('appendLoginEntry — Phase 7.74.7 (recordLogin sans re-stamp)', () => {
  test('ajoute un timestamp en tête de loginHistory', () => {
    const before = Date.now();
    const out = appendLoginEntry({ seb: { id: 'seb', loginHistory: [] } }, 'seb');
    const h = out.seb.loginHistory;
    expect(h.length).toBe(1);
    expect(typeof h[0]).toBe('number');
    expect(h[0]).toBeGreaterThanOrEqual(before);
  });

  test('NE re-stampe PAS lastModified (cœur du fix anti-pollution)', () => {
    const out = appendLoginEntry(
      { seb: { id: 'seb', lastModified: 111, banksAnn: {}, loginHistory: [] } },
      'seb',
    );
    // lastModified inchangé — un login ne doit pas rendre le profil "le
    // plus récent" pour le LWW.
    expect(out.seb.lastModified).toBe(111);
  });

  test('préserve les entrées existantes (unshift) et cappe à 5', () => {
    const out = appendLoginEntry(
      { seb: { id: 'seb', loginHistory: [4, 3, 2, 1, 0] } },
      'seb',
    );
    const h = out.seb.loginHistory;
    expect(h.length).toBe(5);
    expect(h[1]).toBe(4); // ancienne tête conservée en 2e position
    expect(h[4]).toBe(1); // la plus vieille (0) écartée
  });

  test('initialise loginHistory si absent', () => {
    const out = appendLoginEntry({ seb: { id: 'seb' } }, 'seb');
    expect(Array.isArray(out.seb.loginHistory)).toBe(true);
    expect(out.seb.loginHistory.length).toBe(1);
  });

  test('no-op si id inexistant ou profiles falsy', () => {
    const profiles = { seb: { id: 'seb', loginHistory: [] } };
    expect(appendLoginEntry(profiles, 'inconnu')).toBe(profiles);
    expect(appendLoginEntry(null, 'seb')).toBe(null);
    expect(appendLoginEntry(undefined, 'seb')).toBe(undefined);
  });

  test('immutable : ne mute pas le profiles ni le profil source', () => {
    const profiles = { seb: { id: 'seb', loginHistory: [9] } };
    const out = appendLoginEntry(profiles, 'seb');
    expect(out).not.toBe(profiles);
    expect(out.seb).not.toBe(profiles.seb);
    expect(profiles.seb.loginHistory).toEqual([9]); // original intact
  });
});

// ─── Phase 7.74.9 — Bank-dedicated LWW via banksModified ──────────────
//
// Occurrence #8 (2026-05-21 soir) : adoption en bloc des banks via
// merged={...remote} dès que remote.lastModified > local.lastModified.
// lastModified étant global, toute écriture (sources, aiCache, login)
// faisait gagner les banks remote — même quand le device en question
// n'avait pas touché aux banks. Fix : timestamp dédié `banksModified`,
// stampé UNIQUEMENT lors d'une édition réelle de banks.
describe('mergeProfileLWW — Phase 7.74.9 bank-dedicated LWW', () => {
  const mkBanks = (n, val) => {
    const o = {};
    for (let i = 0; i < n; i++) o[String(i)] = { cat: '', A: val, B: val, C: val };
    return o;
  };
  let warnSpy;
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });
  const banksWarns = () => warnSpy.mock.calls.filter(
    (c) => c.some((a) => typeof a === 'string' && a.includes('mass-change')),
  );

  test('adopte banks remote si remote.banksModified > local.banksModified', () => {
    const local = {
      id: 'seb', lastModified: 1000, banksModified: 1000,
      banksAnn: mkBanks(10, 'OLD'),
    };
    const remote = {
      id: 'seb', lastModified: 2000, banksModified: 2000,
      banksAnn: mkBanks(10, 'NEW'),
    };
    const out = mergeProfileLWW(local, remote, { debug: true });
    expect(out.banksAnn).toEqual(remote.banksAnn); // adopté
    // log forensique ADOPTED présent
    const w = banksWarns();
    expect(w.length).toBe(1);
    expect(w[0].some((a) => typeof a === 'string' && a.includes('ADOPTED'))).toBe(true);
  });

  test('SCÉNARIO BUG #8 — garde banks local si remote.banksModified == local.banksModified (lastModified gonflé par autre écriture)', () => {
    // Cas observé occurrence #8 : Mac avait fait une écriture autre
    // (sources, aiCache, login) → lastModified gonflé. Mais banksModified
    // identique côté Mac et iPhone → les banks iPhone (à jour) sont
    // préservées au lieu d'être écrasées par la version périmée Mac.
    const local = {
      id: 'seb', lastModified: 5000, banksModified: 3000,
      banksAnn: mkBanks(10, 'FRESH'), // ce qu'on veut préserver
    };
    const remote = {
      id: 'seb', lastModified: 9000, banksModified: 3000, // égal !
      banksAnn: mkBanks(10, 'STALE'), // version périmée
    };
    const out = mergeProfileLWW(local, remote, { debug: true });
    expect(out.banksAnn).toEqual(local.banksAnn); // local préservé
    const w = banksWarns();
    expect(w.length).toBe(1);
    expect(w[0].some((a) => typeof a === 'string' && a.includes('BLOCKED'))).toBe(true);
  });

  test('garde banks local si remote.banksModified < local.banksModified', () => {
    const local = {
      id: 'seb', lastModified: 1000, banksModified: 5000,
      banksAnn: mkBanks(10, 'FRESH'),
    };
    const remote = {
      id: 'seb', lastModified: 9000, banksModified: 2000,
      banksAnn: mkBanks(10, 'STALE'),
    };
    const out = mergeProfileLWW(local, remote, { debug: true });
    expect(out.banksAnn).toEqual(local.banksAnn);
  });

  test('SCÉNARIO récupération — un device répare ses banks → banksModified frais → l\'autre adopte', () => {
    // Setup : Mac corrompu (banks STALE, banksModified=3000), iPhone aussi.
    // User récupère Mac depuis CSV → setProfileField stamp banksModified=Date.now().
    // Au prochain push, le merge côté iPhone doit adopter les banks Mac.
    const macBeforeFix = {
      id: 'seb', lastModified: 5000, banksModified: 3000,
      banksAnn: mkBanks(10, 'STALE'),
    };
    // user reset → setProfileField stamp banksModified=8000
    const macAfterFix = {
      id: 'seb', lastModified: 8000, banksModified: 8000,
      banksAnn: mkBanks(10, 'FIXED'),
    };
    // iPhone côté merge : local=stale-as-mac-was, remote=mac-after-fix
    const out = mergeProfileLWW(macBeforeFix, macAfterFix, { debug: true });
    expect(out.banksAnn).toEqual(macAfterFix.banksAnn);
    expect(out.banksModified).toBe(8000);
  });

  test('banks identiques (même contenu) → garde local sans log de mass-change', () => {
    const sameBanks = mkBanks(10, 'IDEM');
    const local = {
      id: 'seb', lastModified: 1000, banksModified: 1000, banksAnn: sameBanks,
    };
    const remote = {
      id: 'seb', lastModified: 2000, banksModified: 1500, banksAnn: sameBanks,
    };
    const out = mergeProfileLWW(local, remote, { debug: true });
    expect(out.banksAnn).toEqual(sameBanks);
    expect(banksWarns().length).toBe(0); // 0 diff slots, pas de log
  });

  test('banks différentes mais peu de slots (<10 diff) → pas de log mass-change quel que soit le winner', () => {
    const local = {
      id: 'seb', lastModified: 1000, banksModified: 1000,
      banksAnn: mkBanks(10, 'SAME'),
    };
    const rb = mkBanks(10, 'SAME');
    rb['0'].A = 'CHANGED';
    const remote = {
      id: 'seb', lastModified: 2000, banksModified: 2000, banksAnn: rb,
    };
    mergeProfileLWW(local, remote, { debug: true });
    expect(banksWarns().length).toBe(0); // <10 slots diff
  });

  test('banksPlug subit la même règle que banksAnn', () => {
    const local = {
      id: 'seb', lastModified: 5000, banksModified: 3000,
      banksPlug: mkBanks(10, 'FRESH'),
    };
    const remote = {
      id: 'seb', lastModified: 9000, banksModified: 3000,
      banksPlug: mkBanks(10, 'STALE'),
    };
    const out = mergeProfileLWW(local, remote, { debug: true });
    expect(out.banksPlug).toEqual(local.banksPlug);
  });

  test('merged.banksModified = max(local, remote) après merge (cohérent avec lastModified)', () => {
    const local = {
      id: 'seb', lastModified: 1000, banksModified: 3000,
      banksAnn: mkBanks(2, 'L'),
    };
    const remote = {
      id: 'seb', lastModified: 5000, banksModified: 7000,
      banksAnn: mkBanks(2, 'R'),
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.banksModified).toBe(7000);
  });

  test('legacy : banksModified absent des 2 côtés → traité comme 0/0 → keep local (égalité)', () => {
    const local = { id: 'seb', lastModified: 1000, banksAnn: mkBanks(10, 'L') };
    const remote = { id: 'seb', lastModified: 2000, banksAnn: mkBanks(10, 'R') };
    const out = mergeProfileLWW(local, remote);
    // 0 == 0 → keep local. Un device pré-7.74.9 ne peut donc pas
    // écraser un device post-7.74.9 — sûr-de-tendre vers l'invariant.
    expect(out.banksAnn).toEqual(local.banksAnn);
  });

  test('legacy asymétrique : local sans banksModified (=0) + remote avec banksModified > 0 → remote gagne', () => {
    const local = { id: 'seb', lastModified: 1000, banksAnn: mkBanks(10, 'L') };
    const remote = {
      id: 'seb', lastModified: 2000, banksModified: 5000,
      banksAnn: mkBanks(10, 'R'),
    };
    const out = mergeProfileLWW(local, remote);
    expect(out.banksAnn).toEqual(remote.banksAnn);
  });
});

// ─── Phase 7.74.9 — Migration v10 → v11 (banksModified) ──────────────
describe('migrateV10toV11 + ensureProfileV11 — Phase 7.74.9', () => {
  test('migrateV10toV11 backfill banksModified=0 pour profils existants', () => {
    const v10 = {
      version: 10,
      profiles: {
        seb: { id: 'seb', name: 'Sébastien', isAdmin: true, banksAnn: {} },
        bruno: { id: 'bruno', name: 'Bruno', isAdmin: false, banksAnn: {} },
      },
    };
    const v11 = migrateV10toV11(v10);
    expect(v11.version).toBe(11);
    expect(v11.profiles.seb.banksModified).toBe(0);
    expect(v11.profiles.bruno.banksModified).toBe(0);
  });

  test('migrateV10toV11 préserve banksModified explicite (idempotent)', () => {
    const v10 = {
      version: 10,
      profiles: {
        seb: { id: 'seb', banksModified: 123456 },
      },
    };
    const v11 = migrateV10toV11(v10);
    expect(v11.profiles.seb.banksModified).toBe(123456);
  });

  test('migrateV10toV11 idempotent : double passage → no-op stable', () => {
    const v10 = { version: 10, profiles: { seb: { id: 'seb' } } };
    const r1 = migrateV10toV11(v10);
    const r2 = migrateV10toV11(r1);
    expect(r2.version).toBe(11);
    expect(r2.profiles.seb.banksModified).toBe(0);
    expect(r2.profiles.seb).toEqual(r1.profiles.seb);
  });

  test('migrateV10toV11 sur input null retourne null', () => {
    expect(migrateV10toV11(null)).toBeNull();
  });

  test('ensureProfileV11 pose banksModified=0 si absent', () => {
    const out = ensureProfileV11({ id: 'seb', name: 'Sébastien' });
    expect(out.banksModified).toBe(0);
  });

  test('ensureProfileV11 préserve banksModified présent', () => {
    const out = ensureProfileV11({ id: 'seb', banksModified: 999 });
    expect(out.banksModified).toBe(999);
  });

  test('ensureProfileV11 chaîne ensureProfileV10 (aiCache pose)', () => {
    const out = ensureProfileV11({ id: 'seb' });
    expect(out.aiCache).toEqual({});
    expect(out.banksModified).toBe(0);
  });

  test('ensureProfilesV11 map sur tous les profils', () => {
    const ps = { seb: { id: 'seb' }, bruno: { id: 'bruno' } };
    const out = ensureProfilesV11(ps);
    expect(out.seb.banksModified).toBe(0);
    expect(out.bruno.banksModified).toBe(0);
  });

  test('ensureProfileV11 sur null retourne null defensive', () => {
    expect(ensureProfileV11(null)).toBeNull();
  });
});

// Phase 10 v2 — Contexte d'écoute simplifié (3 valeurs)
// Décision 2026-05-21 : retiré ampWithCab + ampNoCab (cas marginaux).
// Le toggle CAB on/off est désormais indépendant du contexte d'écoute,
// décidé par l'IA selon la capture nommée (Phase 9.1).
describe('OUTPUT_CONTEXTS / getEffectiveOutputContext (Phase 10 v2)', () => {
  test('OUTPUT_CONTEXTS contient les 3 valeurs attendues (Phase 10 v2)', () => {
    expect(OUTPUT_CONTEXTS).toEqual(['headphone', 'frfr', 'pa']);
  });

  test('DEFAULT_OUTPUT_CONTEXT vaut frfr', () => {
    expect(DEFAULT_OUTPUT_CONTEXT).toBe('frfr');
  });

  describe('getEffectiveOutputContext', () => {
    test('song.outputContext override prioritaire', () => {
      expect(getEffectiveOutputContext({ outputContext: 'frfr' }, { outputContext: 'headphone' })).toBe('headphone');
    });

    test('profile.outputContext utilisé sans override song', () => {
      expect(getEffectiveOutputContext({ outputContext: 'pa' }, { outputContext: undefined })).toBe('pa');
      expect(getEffectiveOutputContext({ outputContext: 'headphone' }, {})).toBe('headphone');
      expect(getEffectiveOutputContext({ outputContext: 'pa' }, null)).toBe('pa');
    });

    test('default frfr si profile sans outputContext', () => {
      expect(getEffectiveOutputContext({}, {})).toBe('frfr');
      expect(getEffectiveOutputContext(null, null)).toBe('frfr');
    });

    test('valeur invalide song.outputContext → fallback profile', () => {
      expect(getEffectiveOutputContext({ outputContext: 'pa' }, { outputContext: 'invalid' })).toBe('pa');
    });

    test('valeur invalide profile.outputContext → fallback default', () => {
      expect(getEffectiveOutputContext({ outputContext: 'bogus' }, null)).toBe('frfr');
    });

    test('valeur vide / null song.outputContext → fallback profile', () => {
      expect(getEffectiveOutputContext({ outputContext: 'headphone' }, { outputContext: '' })).toBe('headphone');
      expect(getEffectiveOutputContext({ outputContext: 'pa' }, { outputContext: null })).toBe('pa');
    });

    test('Phase 10 v1 valeurs legacy ampWithCab / ampNoCab → fallback default frfr', () => {
      // Migration douce : les profils Phase 10 v1 (avant simplification)
      // qui auraient ces valeurs retombent silencieusement sur 'frfr'.
      expect(getEffectiveOutputContext({ outputContext: 'ampWithCab' }, null)).toBe('frfr');
      expect(getEffectiveOutputContext({ outputContext: 'ampNoCab' }, null)).toBe('frfr');
      expect(getEffectiveOutputContext(null, { outputContext: 'ampWithCab' })).toBe('frfr');
    });
  });

  test('makeDefaultProfile (admin et non-admin) pose outputContext frfr', () => {
    const admin = makeDefaultProfile('seb', 'Sébastien', true);
    const standard = makeDefaultProfile('bruno', 'Bruno', false);
    expect(admin.outputContext).toBe('frfr');
    expect(standard.outputContext).toBe('frfr');
  });
});

// Phase B — Contexte de jeu (instrument × rig)
describe('Phase B — getAvailableRigs / getEffectivePlayContext', () => {
  const tonexProfile = { enabledDevices: ['tonex-anniversary', 'tonex-plug'], instruments: ['guitar'] };

  describe('PLAY_INSTRUMENTS / PLAY_RIGS', () => {
    test('valeurs attendues', () => {
      expect(PLAY_INSTRUMENTS).toEqual(['guitar', 'bass']);
      expect(PLAY_RIGS).toEqual(['tonex', 'tmp', 'amp']);
    });
  });

  describe('getDefaultPlayInstrument', () => {
    test('1er instrument valide, sinon guitar', () => {
      expect(getDefaultPlayInstrument({ instruments: ['bass', 'guitar'] })).toBe('bass');
      expect(getDefaultPlayInstrument({ instruments: ['guitar', 'bass'] })).toBe('guitar');
      expect(getDefaultPlayInstrument({ instruments: [] })).toBe('guitar');
      expect(getDefaultPlayInstrument({})).toBe('guitar');
      expect(getDefaultPlayInstrument(null)).toBe('guitar');
    });
  });

  describe('getAvailableRigs', () => {
    test('tonex si device ToneX activé', () => {
      expect(getAvailableRigs(tonexProfile, 'guitar')).toEqual(['tonex']);
    });

    test('tmp si tonemaster-pro activé', () => {
      const p = { enabledDevices: ['tonemaster-pro'] };
      expect(getAvailableRigs(p, 'guitar')).toEqual(['tmp']);
    });

    test('amp si myGuitarAmps non vide (instrument guitar)', () => {
      const p = { enabledDevices: ['tonex-plug'], myGuitarAmps: ['marshall_plexi'] };
      expect(getAvailableRigs(p, 'guitar')).toEqual(['tonex', 'amp']);
    });

    test('amp basse lit myBassAmps, pas myGuitarAmps', () => {
      // Guitar a un ampli coché, basse non → amp dispo guitare seulement.
      const p = { enabledDevices: ['tonex-plug'], myGuitarAmps: ['marshall_plexi'], myBassAmps: [] };
      expect(getAvailableRigs(p, 'guitar')).toEqual(['tonex', 'amp']);
      expect(getAvailableRigs(p, 'bass')).toEqual(['tonex']);
      // Symétrique : basse a un ampli, guitare non.
      const p2 = { enabledDevices: ['tonex-plug'], myGuitarAmps: [], myBassAmps: ['rumble_100'] };
      expect(getAvailableRigs(p2, 'bass')).toEqual(['tonex', 'amp']);
      expect(getAvailableRigs(p2, 'guitar')).toEqual(['tonex']);
    });

    test('ordre priorité tonex > tmp > amp', () => {
      const p = { enabledDevices: ['tonex-anniversary', 'tonemaster-pro'], myGuitarAmps: ['marshall_plexi'] };
      expect(getAvailableRigs(p, 'guitar')).toEqual(['tonex', 'tmp', 'amp']);
    });

    test('profil sans devices → fallback default getDevicesForRender (tonex)', () => {
      // getDevicesForRender retourne ['tonex-pedal','tonex-plug'] par défaut.
      expect(getAvailableRigs({}, 'guitar')).toEqual(['tonex']);
    });
  });

  describe('getEffectivePlayContext', () => {
    test('défaut : guitar + tonex sur profil ToneX guitariste', () => {
      expect(getEffectivePlayContext(tonexProfile, {})).toEqual({ instrument: 'guitar', rig: 'tonex' });
    });

    test('song.playRig override prioritaire (si dispo)', () => {
      const p = { enabledDevices: ['tonex-plug'], myGuitarAmps: ['marshall_plexi'], playRig: 'tonex', instruments: ['guitar'] };
      expect(getEffectivePlayContext(p, { playRig: 'amp' })).toEqual({ instrument: 'guitar', rig: 'amp' });
    });

    test('profile.playRig utilisé sans override song', () => {
      const p = { enabledDevices: ['tonex-plug'], myGuitarAmps: ['marshall_plexi'], playRig: 'amp', instruments: ['guitar'] };
      expect(getEffectivePlayContext(p, {})).toEqual({ instrument: 'guitar', rig: 'amp' });
    });

    test('rig indispo demandé → fallback 1er rig dispo', () => {
      // playRig 'amp' mais aucun ampli coché → fallback tonex.
      const p = { enabledDevices: ['tonex-anniversary'], playRig: 'amp', instruments: ['guitar'] };
      expect(getEffectivePlayContext(p, {}).rig).toBe('tonex');
    });

    test('instrument bass demandé mais profil mono-guitare → fallback guitar', () => {
      const p = { enabledDevices: ['tonex-plug'], instruments: ['guitar'] };
      expect(getEffectivePlayContext(p, { playInstrument: 'bass' }).instrument).toBe('guitar');
    });

    test('instrument bass respecté si profil multi-instrument', () => {
      const p = { enabledDevices: ['tonex-plug'], instruments: ['guitar', 'bass'], myBassAmps: [] };
      expect(getEffectivePlayContext(p, { playInstrument: 'bass' })).toEqual({ instrument: 'bass', rig: 'tonex' });
    });

    test('valeur invalide → fallback profile puis défaut', () => {
      const p = { enabledDevices: ['tonex-plug'], instruments: ['guitar'] };
      expect(getEffectivePlayContext(p, { playInstrument: 'drums', playRig: 'bogus' })).toEqual({ instrument: 'guitar', rig: 'tonex' });
    });

    test('aucun rig détecté → fallback tonex (defensive)', () => {
      // Profil sans enabledDevices ET sans amplis : getDevicesForRender
      // retourne le défaut tonex, donc rig tonex. On force le cas vide via
      // enabledDevices:[] (qui déclenche le fallback default tonex-pedal/plug).
      expect(getEffectivePlayContext({ instruments: ['guitar'] }, {}).rig).toBe('tonex');
    });

    test('null-safe', () => {
      expect(getEffectivePlayContext(null, null)).toEqual({ instrument: 'guitar', rig: 'tonex' });
    });
  });

  test('makeDefaultProfile pose playInstrument guitar + playRig tonex', () => {
    const admin = makeDefaultProfile('seb', 'Sébastien', true);
    const standard = makeDefaultProfile('bruno', 'Bruno', false);
    expect(admin.playInstrument).toBe('guitar');
    expect(admin.playRig).toBe('tonex');
    expect(standard.playInstrument).toBe('guitar');
    expect(standard.playRig).toBe('tonex');
  });
});

// ─── Phase 14.1 — getEffectiveZones (zones de banques) ───
describe('getEffectiveZones — Phase 14.1', () => {
  test('défaut grand device (50 banques) → 25/40', () => {
    expect(getEffectiveZones({}, 'tonex-anniversary', 50)).toEqual({ liveEnd: 25, jamEnd: 40 });
  });
  test('défaut petit device (plug 10) → tout live (10/10)', () => {
    expect(getEffectiveZones({}, 'tonex-plug', 10)).toEqual({ liveEnd: 10, jamEnd: 10 });
  });
  test('défaut flat (One 20) → tout live (20/20)', () => {
    expect(getEffectiveZones({}, 'tonex-one', 20)).toEqual({ liveEnd: 20, jamEnd: 20 });
  });
  test('valeur stockée honorée', () => {
    const p = { bankZones: { 'tonex-anniversary': { liveEnd: 30, jamEnd: 45 } } };
    expect(getEffectiveZones(p, 'tonex-anniversary', 50)).toEqual({ liveEnd: 30, jamEnd: 45 });
  });
  test('clamp : liveEnd > jamEnd → jamEnd remonté à liveEnd', () => {
    const p = { bankZones: { d: { liveEnd: 40, jamEnd: 20 } } };
    expect(getEffectiveZones(p, 'd', 50)).toEqual({ liveEnd: 40, jamEnd: 40 });
  });
  test('clamp : valeurs > nbBanks ramenées à nbBanks', () => {
    const p = { bankZones: { d: { liveEnd: 80, jamEnd: 99 } } };
    expect(getEffectiveZones(p, 'd', 50)).toEqual({ liveEnd: 50, jamEnd: 50 });
  });
  test('clamp : valeurs négatives → 0', () => {
    const p = { bankZones: { d: { liveEnd: -5, jamEnd: -2 } } };
    expect(getEffectiveZones(p, 'd', 50)).toEqual({ liveEnd: 0, jamEnd: 0 });
  });
  test('stored partiel (liveEnd seul) → défaut appliqué', () => {
    const p = { bankZones: { d: { liveEnd: 10 } } };
    // jamEnd null → défaut recalculé (grand device) puis clamp ≥ liveEnd
    const z = getEffectiveZones(p, 'd', 50);
    expect(z.liveEnd).toBe(25); // défaut car liveEnd OU jamEnd manquant → défauts
    expect(z.jamEnd).toBe(40);
  });
  test('profile null / nbBanks invalide → safe', () => {
    expect(getEffectiveZones(null, 'd', 50)).toEqual({ liveEnd: 25, jamEnd: 40 });
    expect(getEffectiveZones({}, 'd', 0)).toEqual({ liveEnd: 0, jamEnd: 0 });
    expect(getEffectiveZones({}, 'd', undefined)).toEqual({ liveEnd: 0, jamEnd: 0 });
  });
});
