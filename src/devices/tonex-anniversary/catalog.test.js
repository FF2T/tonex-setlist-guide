// Tests du catalogue ToneX Pedal Anniversary.

import { describe, test, expect } from 'vitest';
import {
  TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible,
  INIT_BANKS_ANN, FACTORY_BANKS_ANNIVERSARY,
  buildFactoryBanksAnniversary,
} from './catalog.js';
import { ANNIVERSARY_CATALOG, FACTORY_BANKS_PEDALE } from '../../data/data_catalogs.js';

describe('TONEX_ANNIVERSARY_CATALOG · métadonnée', () => {
  test('structure complète', () => {
    expect(TONEX_ANNIVERSARY_CATALOG.id).toBe('tonex-anniversary');
    expect(TONEX_ANNIVERSARY_CATALOG.maxBanks).toBe(50);
    expect(TONEX_ANNIVERSARY_CATALOG.slots).toEqual(['A', 'B', 'C']);
    expect(TONEX_ANNIVERSARY_CATALOG.deviceKey).toBe('ann');
    expect(TONEX_ANNIVERSARY_CATALOG.bankStorageKey).toBe('banksAnn');
    expect(TONEX_ANNIVERSARY_CATALOG.presetResultKey).toBe('preset_ann');
    expect(TONEX_ANNIVERSARY_CATALOG.defaultEnabled).toBe(false);
    expect(TONEX_ANNIVERSARY_CATALOG.excludedSources).toEqual(['PlugFactory']);
    expect(TONEX_ANNIVERSARY_CATALOG.icon).toBe('🏭');
  });

  test('partage les mêmes données initBanks que tonex-pedal (banksAnn shared Phase 2)', () => {
    expect(Object.keys(INIT_BANKS_ANN).length).toBe(50);
  });
});

describe('FACTORY_BANKS_ANNIVERSARY (Phase 3.6)', () => {
  test('exactement 50 banks numérotées 0..49', () => {
    const keys = Object.keys(FACTORY_BANKS_ANNIVERSARY).map(Number).sort((a, b) => a - b);
    expect(keys.length).toBe(50);
    expect(keys[0]).toBe(0);
    expect(keys[49]).toBe(49);
  });

  test('chaque bank a un cat (vide) et 3 slots A/B/C de type string', () => {
    Object.values(FACTORY_BANKS_ANNIVERSARY).forEach((b) => {
      expect(b).toHaveProperty('cat', '');
      expect(typeof b.A).toBe('string');
      expect(typeof b.B).toBe('string');
      expect(typeof b.C).toBe('string');
    });
  });

  test('toutes les valeurs A/B/C non-vides référencent une entrée du ANNIVERSARY_CATALOG (jamais une entrée Pedal)', () => {
    const annKeys = new Set(Object.keys(ANNIVERSARY_CATALOG));
    Object.values(FACTORY_BANKS_ANNIVERSARY).forEach((b) => {
      ['A', 'B', 'C'].forEach((slot) => {
        const v = b[slot];
        if (v) expect(annKeys.has(v)).toBe(true);
      });
    });
  });

  test('aucune valeur A/B/C ne référence FACTORY_BANKS_PEDALE (pas de fuite cross-device)', () => {
    // Récupère tous les noms de presets qui apparaissent dans le firmware
    // Pedal standard. Aucun ne doit se retrouver dans les banks Anniversary.
    const pedaleNames = new Set();
    Object.values(FACTORY_BANKS_PEDALE).forEach((b) => {
      ['A', 'B', 'C'].forEach((s) => { if (b[s]) pedaleNames.add(b[s]); });
    });
    Object.values(FACTORY_BANKS_ANNIVERSARY).forEach((b) => {
      ['A', 'B', 'C'].forEach((slot) => {
        const v = b[slot];
        if (v) expect(pedaleNames.has(v)).toBe(false);
      });
    });
  });

  test('mapping déterministe : bank 0 = keys[0..2] du catalog', () => {
    const keys = Object.keys(ANNIVERSARY_CATALOG);
    expect(FACTORY_BANKS_ANNIVERSARY[0].A).toBe(keys[0]);
    expect(FACTORY_BANKS_ANNIVERSARY[0].B).toBe(keys[1]);
    expect(FACTORY_BANKS_ANNIVERSARY[0].C).toBe(keys[2]);
    expect(FACTORY_BANKS_ANNIVERSARY[49].A).toBe(keys[147]);
    expect(FACTORY_BANKS_ANNIVERSARY[49].C).toBe(keys[149]);
  });

  test('factoryBanks du catalog meta = FACTORY_BANKS_ANNIVERSARY (pas null)', () => {
    expect(TONEX_ANNIVERSARY_CATALOG.factoryBanks).toBe(FACTORY_BANKS_ANNIVERSARY);
    expect(TONEX_ANNIVERSARY_CATALOG.factoryBanks).not.toBeNull();
  });

  test('buildFactoryBanksAnniversary({}) → 50 banks vides (idempotence sur catalog vide)', () => {
    const empty = buildFactoryBanksAnniversary({});
    expect(Object.keys(empty).length).toBe(50);
    Object.values(empty).forEach((b) => {
      expect(b.A).toBe('');
      expect(b.B).toBe('');
      expect(b.C).toBe('');
    });
  });
});

describe('isPresetSourceCompatible · accepte Anniversary, rejette PlugFactory', () => {
  test('Anniversary accepté (exclusif à ce device)', () => {
    expect(isPresetSourceCompatible('Anniversary')).toBe(true);
  });

  test('PlugFactory rejeté', () => {
    expect(isPresetSourceCompatible('PlugFactory')).toBe(false);
  });

  test('Factory, TSR, ML, ToneNET, custom acceptés', () => {
    ['Factory', 'TSR', 'ML', 'ToneNET', 'custom'].forEach((src) => {
      expect(isPresetSourceCompatible(src)).toBe(true);
    });
  });

  test('src null → compatible', () => {
    expect(isPresetSourceCompatible(null)).toBe(true);
  });
});
