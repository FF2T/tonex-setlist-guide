// Tests Phase 7.77 — preset-curation helpers (résolution rouges + curation oranges).

import { describe, test, expect } from 'vitest';
import {
  detectPresetsByStatus,
  detectUnknownsInBanks,
  detectNonCuratedInBanks,
  applyResolutionsToBanks,
} from './preset-curation.js';

// Noms catalog "known" connus → status='known' (sans usages).
// "HG 800" est dans Factory (firmware v2) sans usages → known.
// "Some Random Name Xyz123" → unknown (fallback guessPresetInfo).
const KNOWN_NAME = 'HG 800';
const UNKNOWN_NAME = 'Wahwah ZZZ Garbage';
const UNKNOWN_NAME_2 = 'Another Unknown XYZ';

describe('detectPresetsByStatus', () => {
  test('détecte les noms par status spécifié', () => {
    const banks = {
      1: { A: KNOWN_NAME, B: UNKNOWN_NAME, C: '' },
      2: { A: UNKNOWN_NAME_2, B: KNOWN_NAME, C: UNKNOWN_NAME },
    };
    const unknowns = detectPresetsByStatus(banks, ['unknown']);
    // UNKNOWN_NAME apparaît 2 fois mais dédupliqué.
    expect(unknowns).toEqual([UNKNOWN_NAME_2, UNKNOWN_NAME].sort((a, b) => a.localeCompare(b)));
  });

  test('accept un Set de statuses', () => {
    const banks = { 1: { A: KNOWN_NAME, B: UNKNOWN_NAME, C: '' } };
    const out = detectPresetsByStatus(banks, new Set(['unknown', 'known']));
    expect(out.sort()).toEqual([KNOWN_NAME, UNKNOWN_NAME].sort());
  });

  test('banks vide → []', () => {
    expect(detectPresetsByStatus({}, ['unknown'])).toEqual([]);
  });

  test('banks null/undefined → []', () => {
    expect(detectPresetsByStatus(null, ['unknown'])).toEqual([]);
    expect(detectPresetsByStatus(undefined, ['unknown'])).toEqual([]);
  });

  test('slots vides ou non-string → ignorés', () => {
    const banks = { 1: { A: '', B: null, C: undefined }, 2: { A: 42 } };
    expect(detectPresetsByStatus(banks, ['unknown'])).toEqual([]);
  });

  test('dédoublonnage + tri alpha', () => {
    const banks = {
      1: { A: 'ZZZ Unknown', B: 'AAA Unknown', C: 'ZZZ Unknown' },
      2: { A: 'AAA Unknown', B: '', C: '' },
    };
    const unknowns = detectPresetsByStatus(banks, ['unknown']);
    expect(unknowns).toEqual(['AAA Unknown', 'ZZZ Unknown']);
  });
});

describe('detectUnknownsInBanks', () => {
  test('helper alias filtre uniquement unknown', () => {
    const banks = { 1: { A: KNOWN_NAME, B: UNKNOWN_NAME, C: '' } };
    expect(detectUnknownsInBanks(banks)).toEqual([UNKNOWN_NAME]);
  });
});

describe('detectNonCuratedInBanks', () => {
  test('helper alias filtre uniquement known (status non-curated)', () => {
    const banks = { 1: { A: KNOWN_NAME, B: UNKNOWN_NAME, C: '' } };
    const out = detectNonCuratedInBanks(banks);
    expect(out).toContain(KNOWN_NAME);
    expect(out).not.toContain(UNKNOWN_NAME);
  });
});

describe('applyResolutionsToBanks', () => {
  test('action remap remplace le slot par target', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: KNOWN_NAME, C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'remap', target: 'TSR Mars 800SL Drive' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe('TSR Mars 800SL Drive');
    expect(out[1].B).toBe(KNOWN_NAME); // intact
    expect(out[1].C).toBe('');
  });

  test('action clear vide le slot', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: KNOWN_NAME, C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'clear' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe('');
  });

  test('action skip laisse intact', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'skip' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe(UNKNOWN_NAME);
    // Pas de modif → retourne la même référence (optim React)
    expect(out).toBe(banks);
  });

  test('preset non listé dans resolutions → intact', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: UNKNOWN_NAME_2, C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'clear' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe('');
    expect(out[1].B).toBe(UNKNOWN_NAME_2);
  });

  test('immutabilité — banks input pas muté', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '' } };
    const original = JSON.parse(JSON.stringify(banks));
    const res = { [UNKNOWN_NAME]: { action: 'clear' } };
    applyResolutionsToBanks(banks, res);
    expect(banks).toEqual(original);
  });

  test('plusieurs résolutions appliquées en une passe', () => {
    const banks = {
      1: { A: UNKNOWN_NAME, B: UNKNOWN_NAME_2, C: '' },
      2: { A: UNKNOWN_NAME, B: '', C: KNOWN_NAME },
    };
    const res = {
      [UNKNOWN_NAME]: { action: 'remap', target: 'TSR Mars 800SL Drive' },
      [UNKNOWN_NAME_2]: { action: 'clear' },
    };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe('TSR Mars 800SL Drive');
    expect(out[1].B).toBe('');
    expect(out[2].A).toBe('TSR Mars 800SL Drive');
    expect(out[2].C).toBe(KNOWN_NAME);
  });

  test('banks null/undefined → retourne tel quel', () => {
    expect(applyResolutionsToBanks(null, {})).toBe(null);
    expect(applyResolutionsToBanks(undefined, {})).toBe(undefined);
  });

  test('resolutions null/undefined → banks inchangé', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '' } };
    expect(applyResolutionsToBanks(banks, null)).toBe(banks);
    expect(applyResolutionsToBanks(banks, undefined)).toBe(banks);
  });

  test('action remap sans target → no-op', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'remap' } }; // pas de target
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe(UNKNOWN_NAME);
  });

  test('préserve les autres champs de bank (cat, etc.)', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '', cat: 'Custom' } };
    const res = { [UNKNOWN_NAME]: { action: 'clear' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].cat).toBe('Custom');
  });
});
