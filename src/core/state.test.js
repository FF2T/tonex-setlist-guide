// Tests des migrations localStorage v1 → v2 → v3.
// Critique : aucune migration ne doit perdre de données utilisateur.

import { describe, test, expect } from 'vitest';
import {
  STATE_VERSION, migrateV1toV2, migrateV2toV3,
  deriveEnabledDevices, makeDefaultProfile,
} from './state.js';

describe('STATE_VERSION', () => {
  test('vaut 3 en Phase 2', () => {
    expect(STATE_VERSION).toBe(3);
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
  test("migrateV2toV3 sur un state qui a déjà enabledDevices écrase avec la dérivation depuis devices", () => {
    // Comportement : on re-dérive systématiquement. Si on veut éviter ce
    // re-derive, ne pas appeler migrateV2toV3 sur du v3 (loadState gère ça).
    const v2 = {
      version: 2,
      profiles: { u: { devices: { pedale: true }, enabledDevices: ['tonex-anniversary'] } },
    };
    const v3 = migrateV2toV3(v2);
    expect(v3.profiles.u.enabledDevices).toEqual(['tonex-pedal']);
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
