// Tests des helpers TMP : validateBlock + validatePatch + getPatchBlocks.

import { describe, test, expect } from 'vitest';
import {
  BLOCK_TYPES, validateBlock, validatePatch, getPatchBlocks, RENDER_ORDER,
} from './chain-model.js';

describe('BLOCK_TYPES — 9 types incluant noise_gate + eq', () => {
  test('liste complète', () => {
    expect(BLOCK_TYPES).toEqual([
      'comp', 'drive', 'amp', 'cab', 'mod', 'delay', 'reverb', 'noise_gate', 'eq',
    ]);
  });
});

describe('validateBlock', () => {
  test('amp valide avec model whitelist → valid', () => {
    const r = validateBlock({
      type: 'amp', model: 'British Plexi', enabled: true,
      params: { volume_i: 5, treble: 6, bass: 5 },
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('type inconnu → invalid', () => {
    const r = validateBlock({ type: 'wahwah', model: 'X', enabled: true, params: {} });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('not in BLOCK_TYPES'))).toBe(true);
  });

  test('model hors whitelist → invalid', () => {
    const r = validateBlock({ type: 'amp', model: 'Inventor 9000', enabled: true, params: {} });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('not in whitelist'))).toBe(true);
  });

  test('params avec >10 clés → invalid', () => {
    const params = {};
    for (let i = 0; i < 12; i++) params[`p${i}`] = i;
    const r = validateBlock({ type: 'amp', model: 'British Plexi', enabled: true, params });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('too many params'))).toBe(true);
  });

  test('cab avec params strings (mic, axis) → valide', () => {
    const r = validateBlock({
      type: 'cab', model: '4x12 British Plexi Greenback', enabled: true,
      params: { mic: 'Dyn SM57', axis: 'on', distance: 6, low_cut: 20, high_cut: 20000 },
    });
    expect(r.valid).toBe(true);
  });

  test('enabled non-boolean → invalid', () => {
    const r = validateBlock({ type: 'drive', model: 'Klon', enabled: 'yes', params: {} });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('enabled must be a boolean'))).toBe(true);
  });

  test('block null → invalid', () => {
    const r = validateBlock(null);
    expect(r.valid).toBe(false);
  });
});

describe('validatePatch', () => {
  const baseAmp = { model: 'British Plexi', enabled: true, params: { gain: 5 } };
  const baseCab = { model: '4x12 British Plexi Greenback', enabled: true, params: { low_cut: 20 } };

  test('patch minimal valide (amp + cab + style + gain + pickupAffinity)', () => {
    const r = validatePatch({
      id: 'test', name: 'Test',
      amp: baseAmp, cab: baseCab,
      style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 80, SC: 60, P90: 70 },
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('sans amp → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', cab: baseCab, style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('amp block is required');
  });

  test('sans cab → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', amp: baseAmp, style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('cab block is required');
  });

  test('pickupAffinity hors 0-100 → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', amp: baseAmp, cab: baseCab, style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 150, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('pickupAffinity.HB'))).toBe(true);
  });

  test('style hors STYLES → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', amp: baseAmp, cab: baseCab,
      style: 'reggae', gain: 'mid', pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('style "reggae"'))).toBe(true);
  });

  test('gain hors GAINS → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', amp: baseAmp, cab: baseCab,
      style: 'rock', gain: 'extreme', pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('gain "extreme"'))).toBe(true);
  });

  test('amp model hors whitelist → invalid (cascade depuis validateBlock)', () => {
    const r = validatePatch({
      id: 'x', name: 'X',
      amp: { model: 'FakeAmp', enabled: true, params: {} },
      cab: baseCab,
      style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('amp:') && e.includes('not in whitelist'))).toBe(true);
  });
});

describe('getPatchBlocks — ordre de rendu standard', () => {
  test('renvoie les blocs dans RENDER_ORDER', () => {
    const patch = {
      amp: { model: 'British Plexi', enabled: true, params: {} },
      cab: { model: '4x12 British Plexi Greenback', enabled: true, params: {} },
      drive: { model: 'Tube Screamer', enabled: true, params: {} },
      reverb: { model: 'Spring', enabled: true, params: {} },
    };
    const blocks = getPatchBlocks(patch);
    expect(blocks.map((b) => b.slot)).toEqual(['drive', 'amp', 'cab', 'reverb']);
  });

  test('RENDER_ORDER inclut noise_gate et eq', () => {
    expect(RENDER_ORDER[0]).toBe('noise_gate');
    expect(RENDER_ORDER).toContain('eq');
  });

  test('patch null → []', () => {
    expect(getPatchBlocks(null)).toEqual([]);
  });
});
