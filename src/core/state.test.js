// Tests des migrations localStorage v1 → v2 → v3.
// Critique : aucune migration ne doit perdre de données utilisateur.

import { describe, test, expect } from 'vitest';
import {
  STATE_VERSION, migrateV1toV2, migrateV2toV3,
  deriveEnabledDevices, makeDefaultProfile,
} from './state.js';

describe('STATE_VERSION', () => {
  test('vaut 4 en Phase 3 (TMP tmpPatches)', () => {
    expect(STATE_VERSION).toBe(4);
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
    expect(p.devices.anniversary).toBe(true);
  });

  test('utilisateur standard → Pedal + Plug', () => {
    const p = makeDefaultProfile('user', 'User', false);
    expect(p.enabledDevices).toEqual(['tonex-pedal', 'tonex-plug']);
    expect(p.devices.anniversary).toBe(false);
  });
});
