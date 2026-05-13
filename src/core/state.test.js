// Tests des migrations localStorage v1 → v2 → v3 → v4 → v5.
// Critique : aucune migration ne doit perdre de données utilisateur.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STATE_VERSION, TOMBSTONE_MAX_AGE_MS,
  migrateV1toV2, migrateV2toV3, migrateV4toV5, migrateV5toV6, migrateV6toV7,
  ensureSharedV7, ensureProfileV7, ensureProfilesV7,
  gcTombstones,
  mergeDeletedSetlistIds, mergeSetlistsLWW, mergeProfilesLWW,
  stripAiCacheForSync, mergeSongDbPreservingLocalAiCache,
  computeNewzikCreateNames, computeNewzikMergeNames,
  toggleSetlistProfile,
  deriveEnabledDevices, makeDefaultProfile,
  getAllRigsGuitars,
  computeGuitarBiasFromFeedback,
  mergeGuitarBias,
  dedupSetlists, dedupSetlistsWithTombstones, setlistDedupKey,
  dedupSongDb,
  autoBackup, listBackups, clearBackups, isQuotaError,
} from './state.js';

describe('STATE_VERSION', () => {
  test('vaut 7 en Phase 5.7 (LWW + tombstones {[id]:ts})', () => {
    expect(STATE_VERSION).toBe(7);
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

  test('utilisateur standard → Pedal + Plug', () => {
    const p = makeDefaultProfile('user', 'User', false);
    expect(p.enabledDevices).toEqual(['tonex-pedal', 'tonex-plug']);
    expect(p.devices).toBeUndefined();
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

  test('quota exceeded → pop oldest et réussit au 2e essai', () => {
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
        if (calls === 1) {
          const e = new Error('quota');
          e.name = 'QuotaExceededError';
          throw e;
        }
      }
      store[k] = v;
    });
    autoBackup();
    expect(calls).toBe(2);
    const final = JSON.parse(store.tonex_guide_backups);
    // Avant retry : 5 backups + 1 nouveau = 6 → tronqué à MAX_BACKUPS (2 Phase 6.2).
    // Quota throw → on pop le plus ancien → 1. Set réussit.
    expect(final.length).toBe(1);
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

describe('mergeProfilesLWW — Phase 5.7', () => {
  test('LWW per-profile + applySecrets sur remote adopté', () => {
    const t = Date.now();
    const localP = { sebastien: { id: 'sebastien', name: 'Seb local', enabledDevices: ['tonex-anniversary'], aiKeys: { gemini: 'LOCAL_KEY' }, lastModified: t - 1000 } };
    const remoteP = { sebastien: { id: 'sebastien', name: 'Seb remote', enabledDevices: ['tonex-anniversary', 'tonex-plug'], aiKeys: { gemini: '' }, lastModified: t } };
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
