// Tests des whitelists TMP — counts exactes selon CLAUDE.md +
// présence des ajouts Arthur + absence de doublons.

import { describe, test, expect } from 'vitest';
import {
  AMP_MODELS, CAB_MODELS, DRIVE_MODELS, MOD_MODELS, DELAY_MODELS,
  REVERB_MODELS, COMP_MODELS, EQ_MODELS, NOISE_GATE_MODELS,
  MODELS_BY_TYPE, STYLES, GAINS,
} from './whitelist.js';

describe('Whitelist TMP — counts exacts par catégorie (firmware v1.6 + ajouts Arthur)', () => {
  test('AMP_MODELS : 28 entrées (Marshall ×7, Fender ×13, Boutique ×8 dont 2 EVH)', () => {
    expect(AMP_MODELS.length).toBe(28);
  });
  test('CAB_MODELS : 14 entrées (12 principal + 2 ajouts Arthur)', () => {
    expect(CAB_MODELS.length).toBe(14);
  });
  test('DRIVE_MODELS : 9 entrées (8 principal + 1 ajout Arthur Super Drive)', () => {
    expect(DRIVE_MODELS.length).toBe(9);
  });
  test('MOD_MODELS : 6 entrées', () => {
    expect(MOD_MODELS.length).toBe(6);
  });
  test('DELAY_MODELS : 4 entrées', () => {
    expect(DELAY_MODELS.length).toBe(4);
  });
  test('REVERB_MODELS : 5 entrées', () => {
    expect(REVERB_MODELS.length).toBe(5);
  });
  test('COMP_MODELS : 1 entrée (Studio Compressor — ajout Arthur)', () => {
    expect(COMP_MODELS).toEqual(['Studio Compressor']);
  });
  test('EQ_MODELS : 1 entrée (EQ-5 Parametric)', () => {
    expect(EQ_MODELS).toEqual(['EQ-5 Parametric']);
  });
  test('NOISE_GATE_MODELS : 1 entrée (Noise Reducer)', () => {
    expect(NOISE_GATE_MODELS).toEqual(['Noise Reducer']);
  });
});

describe('Whitelist TMP — ajouts Arthur présents', () => {
  test('Super Drive (Boss SD-1) dans DRIVE_MODELS', () => {
    expect(DRIVE_MODELS).toContain('Super Drive');
  });
  test("4x10 '59 Bassman Tweed dans CAB_MODELS", () => {
    expect(CAB_MODELS).toContain("4x10 '59 Bassman Tweed");
  });
  test('2x12 Twin D120 dans CAB_MODELS', () => {
    expect(CAB_MODELS).toContain('2x12 Twin D120');
  });
});

describe('Whitelist TMP — pas de doublons', () => {
  test.each([
    ['AMP_MODELS', AMP_MODELS],
    ['CAB_MODELS', CAB_MODELS],
    ['DRIVE_MODELS', DRIVE_MODELS],
    ['MOD_MODELS', MOD_MODELS],
    ['DELAY_MODELS', DELAY_MODELS],
    ['REVERB_MODELS', REVERB_MODELS],
  ])('%s : pas de doublon', (_label, list) => {
    expect(new Set(list).size).toBe(list.length);
  });
});

describe('Whitelist TMP — MODELS_BY_TYPE agrège correctement', () => {
  test('chaque type de bloc a sa whitelist', () => {
    expect(MODELS_BY_TYPE.amp).toBe(AMP_MODELS);
    expect(MODELS_BY_TYPE.cab).toBe(CAB_MODELS);
    expect(MODELS_BY_TYPE.drive).toBe(DRIVE_MODELS);
    expect(MODELS_BY_TYPE.comp).toBe(COMP_MODELS);
    expect(MODELS_BY_TYPE.eq).toBe(EQ_MODELS);
    expect(MODELS_BY_TYPE.noise_gate).toBe(NOISE_GATE_MODELS);
  });
});

describe('Whitelist TMP — STYLES + GAINS', () => {
  test('STYLES : 6 entrées canoniques', () => {
    expect(STYLES).toEqual(['blues', 'rock', 'hard_rock', 'jazz', 'metal', 'pop']);
  });
  test('GAINS : 3 entrées', () => {
    expect(GAINS).toEqual(['low', 'mid', 'high']);
  });
});

describe('Whitelist TMP — Plexi/Twin Reverb/Bassman utilisés par Arthur dans AMP_MODELS', () => {
  test('British Plexi (Rock Preset)', () => {
    expect(AMP_MODELS).toContain('British Plexi');
  });
  test("Fender '65 Twin Reverb (Clean Preset)", () => {
    expect(AMP_MODELS).toContain("Fender '65 Twin Reverb");
  });
  test("Fender '59 Bassman (Flipper)", () => {
    expect(AMP_MODELS).toContain("Fender '59 Bassman");
  });
});
