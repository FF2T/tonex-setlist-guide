// Tests symétriques côté ToneX Plug.

import { describe, test, expect } from 'vitest';
import {
  TONEX_PLUG_CATALOG, isPresetSourceCompatible,
  INIT_BANKS_PLUG, FACTORY_BANKS_PLUG,
} from './catalog.js';

describe('TONEX_PLUG_CATALOG · métadonnée', () => {
  test('structure complète', () => {
    expect(TONEX_PLUG_CATALOG.id).toBe('tonex-plug');
    expect(TONEX_PLUG_CATALOG.maxBanks).toBe(10);
    expect(TONEX_PLUG_CATALOG.slots).toEqual(['A', 'B', 'C']);
    expect(TONEX_PLUG_CATALOG.deviceKey).toBe('plug');
    expect(TONEX_PLUG_CATALOG.excludedSources).toContain('Anniversary');
    expect(TONEX_PLUG_CATALOG.excludedSources).toContain('Factory');
  });
});

describe('INIT_BANKS_PLUG · structure', () => {
  test('au moins 8 banks définis', () => {
    expect(Object.keys(INIT_BANKS_PLUG).length).toBeGreaterThanOrEqual(8);
  });
});

describe('FACTORY_BANKS_PLUG · présence', () => {
  test('au moins 8 entrées', () => {
    expect(Object.keys(FACTORY_BANKS_PLUG).length).toBeGreaterThanOrEqual(8);
  });
});

describe('isPresetSourceCompatible · accepte/rejette correctement', () => {
  test('Anniversary et Factory rejetés', () => {
    expect(isPresetSourceCompatible('Anniversary')).toBe(false);
    expect(isPresetSourceCompatible('Factory')).toBe(false);
  });

  test('PlugFactory, TSR, ML, ToneNET, custom acceptés', () => {
    ['PlugFactory', 'TSR', 'ML', 'ToneNET', 'custom'].forEach((src) => {
      expect(isPresetSourceCompatible(src)).toBe(true);
    });
  });
});
