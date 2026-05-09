// Tests de la catalogue ToneX Pedal — structure attendue (50 banks A/B/C)
// et filtre source.

import { describe, test, expect } from 'vitest';
import {
  TONEX_PEDAL_CATALOG, isPresetSourceCompatible,
  INIT_BANKS_ANN, FACTORY_BANKS_PEDALE,
} from './catalog.js';

describe('TONEX_PEDAL_CATALOG · métadonnée du device', () => {
  test('structure complète (Phase 2 : icon, description, bankStorageKey, …)', () => {
    expect(TONEX_PEDAL_CATALOG.id).toBe('tonex-pedal');
    expect(TONEX_PEDAL_CATALOG.maxBanks).toBe(50);
    expect(TONEX_PEDAL_CATALOG.slots).toEqual(['A', 'B', 'C']);
    expect(TONEX_PEDAL_CATALOG.deviceKey).toBe('ann');
    expect(TONEX_PEDAL_CATALOG.bankStorageKey).toBe('banksAnn');
    expect(TONEX_PEDAL_CATALOG.presetResultKey).toBe('preset_ann');
    expect(TONEX_PEDAL_CATALOG.defaultEnabled).toBe(true);
    expect(TONEX_PEDAL_CATALOG.excludedSources).toEqual(['PlugFactory', 'Anniversary']);
    expect(TONEX_PEDAL_CATALOG.icon).toBe('📦');
  });
});

describe('INIT_BANKS_ANN · structure', () => {
  test('50 banks (clés 0 à 49)', () => {
    expect(Object.keys(INIT_BANKS_ANN).length).toBe(50);
    for (let i = 0; i < 50; i++) {
      expect(INIT_BANKS_ANN[i]).toBeDefined();
    }
  });

  test('chaque bank a au plus les slots A/B/C (et éventuellement cat)', () => {
    Object.values(INIT_BANKS_ANN).forEach((bank) => {
      const keys = Object.keys(bank);
      keys.forEach((k) => {
        expect(['cat', 'A', 'B', 'C']).toContain(k);
      });
    });
  });
});

describe('FACTORY_BANKS_PEDALE · présence', () => {
  test('a au moins 40 entrées', () => {
    expect(Object.keys(FACTORY_BANKS_PEDALE).length).toBeGreaterThanOrEqual(40);
  });
});

describe('isPresetSourceCompatible · accepte/rejette correctement', () => {
  test('PlugFactory rejeté', () => {
    expect(isPresetSourceCompatible('PlugFactory')).toBe(false);
  });

  test('Anniversary rejeté (Phase 2 : exclusif à tonex-anniversary)', () => {
    expect(isPresetSourceCompatible('Anniversary')).toBe(false);
  });

  test('Factory, TSR, ML, ToneNET, custom acceptés', () => {
    ['Factory', 'TSR', 'ML', 'ToneNET', 'custom'].forEach((src) => {
      expect(isPresetSourceCompatible(src)).toBe(true);
    });
  });
});
