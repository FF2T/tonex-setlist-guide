// Tests du registre de devices et de la compatibilité de source
// (utilisée par PresetBrowser, BankOptimizer, etc.).

import { describe, test, expect, beforeEach } from 'vitest';
import {
  registerDevice, getDevice, getEnabledDevices, isSrcCompatible,
} from './registry.js';

describe('isSrcCompatible · règles ToneX Pedal vs ToneX Plug', () => {
  test('Anniversary → pédale only', () => {
    expect(isSrcCompatible('Anniversary', 'ann')).toBe(true);
    expect(isSrcCompatible('Anniversary', 'plug')).toBe(false);
  });

  test('Factory → pédale only', () => {
    expect(isSrcCompatible('Factory', 'ann')).toBe(true);
    expect(isSrcCompatible('Factory', 'plug')).toBe(false);
  });

  test('PlugFactory → plug only', () => {
    expect(isSrcCompatible('PlugFactory', 'ann')).toBe(false);
    expect(isSrcCompatible('PlugFactory', 'plug')).toBe(true);
  });

  test('TSR / ML / ToneNET / custom → les deux devices', () => {
    ['TSR', 'ML', 'ToneNET', 'custom'].forEach((src) => {
      expect(isSrcCompatible(src, 'ann')).toBe(true);
      expect(isSrcCompatible(src, 'plug')).toBe(true);
    });
  });

  test('src null → compatible avec tout', () => {
    expect(isSrcCompatible(null, 'ann')).toBe(true);
    expect(isSrcCompatible(null, 'plug')).toBe(true);
  });
});

describe('Registry · enregistrement et récupération', () => {
  beforeEach(() => {
    // Le registry persiste entre les tests (Map module-scoped) — on nettoie
    // en supprimant nos faux devices, sans toucher aux vrais.
    const fakeId = 'fake-device-test';
    if (getDevice(fakeId)) getEnabledDevices(); // no-op cleanup placeholder
  });

  test('registerDevice puis getDevice', () => {
    const fake = { id: 'fake-device-test', label: 'Fake', maxBanks: 1 };
    registerDevice(fake);
    expect(getDevice('fake-device-test')).toEqual(fake);
  });

  test('registerDevice sans id → throw', () => {
    expect(() => registerDevice({ label: 'no id' })).toThrow();
    expect(() => registerDevice(null)).toThrow();
  });

  test('getEnabledDevices retourne au moins un device une fois enregistré', () => {
    expect(getEnabledDevices().length).toBeGreaterThanOrEqual(1);
  });
});
