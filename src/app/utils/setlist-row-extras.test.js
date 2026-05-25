// src/app/utils/setlist-row-extras.test.js — Phase 7.55.7 S4 (S4-3).

import { describe, it, expect } from 'vitest';
import { formatRowPotardsFX, getKnobValue, formatPotardValue } from './setlist-row-extras.js';

describe('getKnobValue', () => {
  it('extrait depuis format Phase 7.86 nested {value, why}', () => {
    expect(getKnobValue({ value: 6.2, why: { fr: '...' } })).toBe(6.2);
  });
  it('extrait depuis format legacy number direct', () => {
    expect(getKnobValue(6.2)).toBe(6.2);
    expect(getKnobValue(0)).toBe(0);
  });
  it('retourne null pour null/undefined/string', () => {
    expect(getKnobValue(null)).toBeNull();
    expect(getKnobValue(undefined)).toBeNull();
    expect(getKnobValue('6.2')).toBeNull();
  });
  it('retourne null pour NaN/Infinity', () => {
    expect(getKnobValue(NaN)).toBeNull();
    expect(getKnobValue(Infinity)).toBeNull();
    expect(getKnobValue({ value: NaN })).toBeNull();
  });
  it('retourne null si value absent/invalide dans objet', () => {
    expect(getKnobValue({})).toBeNull();
    expect(getKnobValue({ value: 'high' })).toBeNull();
  });
});

describe('formatPotardValue', () => {
  it('formate entier sans virgule', () => {
    expect(formatPotardValue(6)).toBe('6');
    expect(formatPotardValue(10)).toBe('10');
    expect(formatPotardValue(0)).toBe('0');
  });
  it('formate décimal à 1 chiffre', () => {
    expect(formatPotardValue(6.2)).toBe('6.2');
    expect(formatPotardValue(4.5)).toBe('4.5');
  });
  it('arrondit décimal de plus de 1 chiffre', () => {
    expect(formatPotardValue(6.24)).toBe('6.2');
    expect(formatPotardValue(6.26)).toBe('6.3');
  });
  it('"6.0" devient "6" (entier après arrondi)', () => {
    expect(formatPotardValue(6.0)).toBe('6');
    expect(formatPotardValue(6.04)).toBe('6');
  });
  it('null/undefined → null', () => {
    expect(formatPotardValue(null)).toBeNull();
    expect(formatPotardValue(undefined)).toBeNull();
  });
});

describe('formatRowPotardsFX', () => {
  it('format Phase 7.86 nested complet → potards + fxOn', () => {
    const aiC = {
      preset_settings_v1: {
        main: {
          gain: { value: 6.2 },
          bass: { value: 4.5 },
          mid: { value: 7.0 },
          treble: { value: 5.3 },
          volume: { value: 6.0 },
        },
      },
      fx_blocks: {
        noise_gate: { enabled: true },
        compressor: { enabled: false },
        modulation: { enabled: false },
        delay: { enabled: false },
        reverb: { enabled: true },
      },
    };
    const result = formatRowPotardsFX(aiC);
    expect(result).toEqual({
      potards: 'G6.2 B4.5 M7 T5.3 V6',
      fxOn: ['Gate', 'Verb'],
    });
  });

  it('format legacy number direct → idem', () => {
    const aiC = {
      preset_settings_v1: {
        main: { gain: 5, bass: 4, mid: 7, treble: 5, volume: 6 },
      },
      fx_blocks: {
        reverb: { enabled: true },
      },
    };
    const result = formatRowPotardsFX(aiC);
    expect(result).toEqual({
      potards: 'G5 B4 M7 T5 V6',
      fxOn: ['Verb'],
    });
  });

  it('preset_settings_v1 absent + fx_blocks présent → potards null, fxOn rempli', () => {
    const result = formatRowPotardsFX({
      fx_blocks: { reverb: { enabled: true } },
    });
    expect(result).toEqual({ potards: null, fxOn: ['Verb'] });
  });

  it('fx_blocks absent + potards présents → potards rempli, fxOn vide', () => {
    const result = formatRowPotardsFX({
      preset_settings_v1: { main: { gain: 6 } },
    });
    expect(result).toEqual({ potards: 'G6', fxOn: [] });
  });

  it('tout absent → null (skip render)', () => {
    expect(formatRowPotardsFX({})).toBeNull();
    expect(formatRowPotardsFX(null)).toBeNull();
    expect(formatRowPotardsFX(undefined)).toBeNull();
  });

  it('main avec un seul potard renseigné → format partial', () => {
    const aiC = {
      preset_settings_v1: { main: { gain: { value: 7 } } },
    };
    expect(formatRowPotardsFX(aiC)).toEqual({ potards: 'G7', fxOn: [] });
  });

  it('fx tous OFF → fxOn = []', () => {
    const aiC = {
      preset_settings_v1: { main: { gain: 5 } },
      fx_blocks: {
        noise_gate: { enabled: false },
        compressor: { enabled: false },
        modulation: { enabled: false },
        delay: { enabled: false },
        reverb: { enabled: false },
      },
    };
    expect(formatRowPotardsFX(aiC)).toEqual({ potards: 'G5', fxOn: [] });
  });

  it('fx_blocks malformé (string, undefined enabled) → skip silencieux', () => {
    const aiC = {
      preset_settings_v1: { main: { gain: 5 } },
      fx_blocks: {
        noise_gate: 'enabled',
        compressor: { enabled: 'yes' }, // pas strict true
        reverb: { enabled: true },
      },
    };
    expect(formatRowPotardsFX(aiC)).toEqual({ potards: 'G5', fxOn: ['Verb'] });
  });

  it('ordre FX préservé : Gate, Comp, Mod, Delay, Verb', () => {
    const aiC = {
      fx_blocks: {
        reverb: { enabled: true },
        compressor: { enabled: true },
        noise_gate: { enabled: true },
        delay: { enabled: true },
        modulation: { enabled: true },
      },
    };
    expect(formatRowPotardsFX(aiC).fxOn).toEqual(['Gate', 'Comp', 'Mod', 'Delay', 'Verb']);
  });

  it('main.bass=0 (valeur valide, pas falsy skip) → inclus', () => {
    const aiC = {
      preset_settings_v1: {
        main: { gain: 5, bass: 0, mid: 5, treble: 5, volume: 5 },
      },
    };
    expect(formatRowPotardsFX(aiC)).toEqual({ potards: 'G5 B0 M5 T5 V5', fxOn: [] });
  });

  it('aiC.preset_settings_v1 null safe', () => {
    const aiC = { preset_settings_v1: null, fx_blocks: { reverb: { enabled: true } } };
    expect(formatRowPotardsFX(aiC)).toEqual({ potards: null, fxOn: ['Verb'] });
  });
});
