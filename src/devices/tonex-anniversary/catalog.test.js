// Tests du catalogue ToneX Pedal Anniversary.

import { describe, test, expect } from 'vitest';
import {
  TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible,
  INIT_BANKS_ANN,
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

  test('partage les mêmes données initBanks que tonex-pedal (banksAnn shared Phase 2)', () => {
    expect(Object.keys(INIT_BANKS_ANN).length).toBe(50);
  });

  test('factoryBanks = null (TODO Phase 5 : 150 captures Anniversary exclusives)', () => {
    // Régression Phase 3.5 : l'Anniversary NE partage PAS les factory
    // presets du tonex-pedal. La donnée Anniversary exacte sera
    // ajoutée Phase 5. En attendant : null pour masquer le bouton
    // "Réinitialiser config usine" plutôt que d'écraser avec du faux.
    expect(TONEX_ANNIVERSARY_CATALOG.factoryBanks).toBeNull();
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
