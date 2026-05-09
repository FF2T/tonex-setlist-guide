// Tests du catalogue ToneX Pedal Anniversary.

import { describe, test, expect } from 'vitest';
import {
  TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible,
  INIT_BANKS_ANN, FACTORY_BANKS_PEDALE,
} from './catalog.js';

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

  test('partage les mêmes données de banks que tonex-pedal (Phase 2)', () => {
    // bankStorageKey = banksAnn pour les deux pedal devices.
    expect(Object.keys(INIT_BANKS_ANN).length).toBe(50);
    expect(Object.keys(FACTORY_BANKS_PEDALE).length).toBeGreaterThanOrEqual(40);
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
