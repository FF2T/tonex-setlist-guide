// Tests Phase ToneX One — devices One / One+ (modèle à plat 20 slots).
import { describe, test, expect } from 'vitest';
import { TONEX_ONE_CATALOG, FACTORY_BANKS_ONE, INIT_BANKS_ONE, isPresetSourceCompatible } from './catalog.js';
import { TONEX_ONE_PLUS_CATALOG, FACTORY_BANKS_ONE_PLUS, isPresetSourceCompatible as isCompatOnePlus } from '../tonex-one-plus/catalog.js';
import { getDevice } from '../registry.js';
import { findCatalogEntry } from '../../core/catalog.js';
// Side-effect imports : enregistrent les devices au registry.
import '../tonex-one/index.js';
import '../tonex-one-plus/index.js';

describe('TONEX_ONE_CATALOG — modèle à plat', () => {
  test('métadonnées device', () => {
    expect(TONEX_ONE_CATALOG.id).toBe('tonex-one');
    expect(TONEX_ONE_CATALOG.maxBanks).toBe(20);
    expect(TONEX_ONE_CATALOG.slots).toEqual(['A']);
    expect(TONEX_ONE_CATALOG.flatPresets).toBe(true);
    expect(TONEX_ONE_CATALOG.bankStorageKey).toBe('banksOne');
    expect(TONEX_ONE_CATALOG.presetResultKey).toBe('preset_one');
    expect(TONEX_ONE_CATALOG.defaultEnabled).toBe(false);
  });

  test('FACTORY_BANKS_ONE = 20 slots, tous résolvent dans le catalog (src Factory partagée)', () => {
    expect(Object.keys(FACTORY_BANKS_ONE)).toHaveLength(20);
    for (const b of Object.values(FACTORY_BANKS_ONE)) {
      const e = findCatalogEntry(b.A);
      expect(e, `manque catalog: ${b.A}`).toBeTruthy();
      expect(e.guessed).toBeFalsy();
    }
  });

  test('INIT_BANKS_ONE = copie de FACTORY_BANKS_ONE', () => {
    expect(INIT_BANKS_ONE).toEqual(FACTORY_BANKS_ONE);
  });

  test('isPresetSourceCompatible — accepte Factory + universels, rejette autres factory', () => {
    expect(isPresetSourceCompatible('Factory')).toBe(true);
    expect(isPresetSourceCompatible('TSR')).toBe(true);
    expect(isPresetSourceCompatible('custom')).toBe(true);
    expect(isPresetSourceCompatible('Anniversary')).toBe(false);
    expect(isPresetSourceCompatible('PlugFactory')).toBe(false);
    expect(isPresetSourceCompatible('OnePlusFactory')).toBe(false);
    expect(isPresetSourceCompatible('FactoryV1')).toBe(false);
  });

  test('device enregistré au registry', () => {
    expect(getDevice('tonex-one')).toBeTruthy();
    expect(typeof getDevice('tonex-one').LiveBlock).toBe('function');
  });
});

describe('TONEX_ONE_PLUS_CATALOG — modèle à plat + source dédiée', () => {
  test('métadonnées device', () => {
    expect(TONEX_ONE_PLUS_CATALOG.id).toBe('tonex-one-plus');
    expect(TONEX_ONE_PLUS_CATALOG.maxBanks).toBe(20);
    expect(TONEX_ONE_PLUS_CATALOG.slots).toEqual(['A']);
    expect(TONEX_ONE_PLUS_CATALOG.bankStorageKey).toBe('banksOnePlus');
    expect(TONEX_ONE_PLUS_CATALOG.presetResultKey).toBe('preset_one_plus');
  });

  test('FACTORY_BANKS_ONE_PLUS = 20 slots, tous résolvent en src OnePlusFactory', () => {
    expect(Object.keys(FACTORY_BANKS_ONE_PLUS)).toHaveLength(20);
    for (const b of Object.values(FACTORY_BANKS_ONE_PLUS)) {
      const e = findCatalogEntry(b.A);
      expect(e, `manque catalog: ${b.A}`).toBeTruthy();
      expect(e.src).toBe('OnePlusFactory');
      expect(e.guessed).toBeFalsy();
    }
  });

  test('isPresetSourceCompatible — accepte OnePlusFactory + universels, rejette Factory', () => {
    expect(isCompatOnePlus('OnePlusFactory')).toBe(true);
    expect(isCompatOnePlus('TSR')).toBe(true);
    expect(isCompatOnePlus('Factory')).toBe(false);
    expect(isCompatOnePlus('Anniversary')).toBe(false);
  });

  test('device enregistré au registry', () => {
    expect(getDevice('tonex-one-plus')).toBeTruthy();
  });
});
