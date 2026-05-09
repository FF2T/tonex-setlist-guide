// Tests du registre de devices et de la compatibilité de source.
// Phase 2 : étendu pour getAllDevices, getEnabledDevices(profile),
// getDeviceMeta, et la sémantique du device tonex-anniversary.

import { describe, test, expect } from 'vitest';
import {
  registerDevice, getDevice, getAllDevices, getEnabledDevices,
  getDeviceMeta, isSrcCompatible,
} from './registry.js';

// Side-effect imports : enregistrent les 3 devices au module load.
import './tonex-pedal/index.js';
import './tonex-anniversary/index.js';
import './tonex-plug/index.js';

describe('isSrcCompatible · LEGACY (clés ann/plug)', () => {
  test("'ann' = ToneX Anniversary historique : permissif (rejette PlugFactory uniquement)", () => {
    expect(isSrcCompatible('Anniversary', 'ann')).toBe(true);
    expect(isSrcCompatible('Factory', 'ann')).toBe(true);
    expect(isSrcCompatible('PlugFactory', 'ann')).toBe(false);
  });

  test("'plug' rejette Anniversary et Factory", () => {
    expect(isSrcCompatible('Anniversary', 'plug')).toBe(false);
    expect(isSrcCompatible('Factory', 'plug')).toBe(false);
    expect(isSrcCompatible('PlugFactory', 'plug')).toBe(true);
  });

  test('TSR / ML / ToneNET / custom → les deux devices legacy', () => {
    ['TSR', 'ML', 'ToneNET', 'custom'].forEach((src) => {
      expect(isSrcCompatible(src, 'ann')).toBe(true);
      expect(isSrcCompatible(src, 'plug')).toBe(true);
    });
  });

  test('src null → compatible avec tout', () => {
    expect(isSrcCompatible(null, 'ann')).toBe(true);
    expect(isSrcCompatible(null, 'plug')).toBe(true);
  });

  test("délégation : passer un device id complet (ex 'tonex-pedal') route vers son filtre", () => {
    // tonex-pedal en Phase 2 rejette Anniversary (différent de 'ann' legacy).
    expect(isSrcCompatible('Anniversary', 'tonex-pedal')).toBe(false);
    expect(isSrcCompatible('Anniversary', 'tonex-anniversary')).toBe(true);
    expect(isSrcCompatible('PlugFactory', 'tonex-plug')).toBe(true);
  });
});

describe('Registry · enregistrement et récupération', () => {
  test('registerDevice puis getDevice', () => {
    const fake = { id: 'fake-device-test', label: 'Fake', maxBanks: 1 };
    registerDevice(fake);
    expect(getDevice('fake-device-test')).toEqual(fake);
  });

  test('registerDevice sans id → throw', () => {
    expect(() => registerDevice({ label: 'no id' })).toThrow();
    expect(() => registerDevice(null)).toThrow();
  });

  test('getAllDevices contient au moins les 3 devices ToneX', () => {
    const ids = getAllDevices().map((d) => d.id);
    expect(ids).toContain('tonex-pedal');
    expect(ids).toContain('tonex-anniversary');
    expect(ids).toContain('tonex-plug');
  });

  test('getDevice(tonex-anniversary) accepte la source Anniversary', () => {
    const d = getDevice('tonex-anniversary');
    expect(d).toBeDefined();
    expect(d.isPresetSourceCompatible('Anniversary')).toBe(true);
    expect(d.isPresetSourceCompatible('PlugFactory')).toBe(false);
  });

  test('getDevice(tonex-pedal) rejette désormais Anniversary (Phase 2)', () => {
    const d = getDevice('tonex-pedal');
    expect(d.isPresetSourceCompatible('Anniversary')).toBe(false);
  });
});

describe('getEnabledDevices(profile)', () => {
  test('liste explicite enabledDevices', () => {
    const profile = { enabledDevices: ['tonex-pedal'] };
    const out = getEnabledDevices(profile);
    expect(out.length).toBe(1);
    expect(out[0].id).toBe('tonex-pedal');
  });

  test('plusieurs devices activés', () => {
    const profile = { enabledDevices: ['tonex-anniversary', 'tonex-plug'] };
    const ids = getEnabledDevices(profile).map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['tonex-anniversary', 'tonex-plug']));
    expect(ids.length).toBe(2);
  });

  test('liste vide → tableau vide (le caller gère le fallback UI)', () => {
    expect(getEnabledDevices({ enabledDevices: [] })).toEqual([]);
  });

  test('profile sans enabledDevices (état v2 brut) → fallback defaultEnabled', () => {
    const out = getEnabledDevices({});
    const ids = out.map((d) => d.id);
    // tonex-pedal et tonex-plug sont defaultEnabled=true en Phase 2.
    expect(ids).toContain('tonex-pedal');
    expect(ids).toContain('tonex-plug');
    // tonex-anniversary est defaultEnabled=false → exclu du fallback.
    expect(ids).not.toContain('tonex-anniversary');
  });

  test('profile null → tableau vide', () => {
    expect(getEnabledDevices(null)).toEqual([]);
  });

  test('id inconnu dans enabledDevices → ignoré', () => {
    const profile = { enabledDevices: ['tonex-pedal', 'tonex-unknown'] };
    const ids = getEnabledDevices(profile).map((d) => d.id);
    expect(ids).toEqual(['tonex-pedal']);
  });
});

describe('getDeviceMeta', () => {
  test('retourne metadata légère pour un device connu', () => {
    const m = getDeviceMeta('tonex-anniversary');
    expect(m).toEqual({
      id: 'tonex-anniversary',
      label: 'ToneX Pedal Anniversary',
      icon: '🏭',
      description: expect.stringContaining('Anniversary'),
      defaultEnabled: false,
      requiresPro: false,
    });
  });

  test('retourne null pour un id inconnu', () => {
    expect(getDeviceMeta('tonex-unknown')).toBeNull();
  });
});
