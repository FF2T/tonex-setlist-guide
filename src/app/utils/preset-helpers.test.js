import { describe, test, expect } from 'vitest';
import { findInBanks, buildBankIndex, lookupBankIndex } from './preset-helpers.js';

// Phase 14.12 — l'index banks doit reproduire EXACTEMENT findInBanks
// (exact prioritaire, fuzzy en fallback) mais en O(1).
describe('buildBankIndex / lookupBankIndex — Phase 14.12', () => {
  const banks = {
    1: { A: 'HG 800', B: 'CL DMBL', C: '' },
    2: { A: 'T.N.T.', B: '', C: 'DR VX30' },
    13: { A: '', B: '', C: 'TSR JTM Klone Lead' },
  };
  const idx = buildBankIndex(banks);

  test('exact match → bank/slot corrects', () => {
    expect(lookupBankIndex(idx, 'HG 800')).toEqual({ bank: 1, slot: 'A' });
    expect(lookupBankIndex(idx, 'DR VX30')).toEqual({ bank: 2, slot: 'C' });
    expect(lookupBankIndex(idx, 'TSR JTM Klone Lead')).toEqual({ bank: 13, slot: 'C' });
  });

  test('fuzzy fallback (parité findInBanks)', () => {
    // "TNT" doit matcher "T.N.T." via normalizePresetName, comme findInBanks.
    expect(lookupBankIndex(idx, 'TNT')).toEqual(findInBanks('TNT', banks));
  });

  test('absent → null', () => {
    expect(lookupBankIndex(idx, 'Inexistant XYZ')).toBeNull();
    expect(lookupBankIndex(idx, '')).toBeNull();
    expect(lookupBankIndex(idx, null)).toBeNull();
  });

  test('slot vide ignoré', () => {
    expect(lookupBankIndex(idx, '')).toBeNull();
  });

  test('banks falsy → index vide, lookup null', () => {
    expect(buildBankIndex(null).size).toBe(0);
    expect(lookupBankIndex(buildBankIndex(undefined), 'HG 800')).toBeNull();
  });

  test('parité globale avec findInBanks sur tous les slots installés', () => {
    for (const [k, bank] of Object.entries(banks)) {
      for (const slot of ['A', 'B', 'C']) {
        const nm = bank[slot];
        if (!nm) continue;
        expect(lookupBankIndex(idx, nm)).toEqual(findInBanks(nm, banks));
      }
    }
  });

  test('premier slot vu gagne sur doublon (ordre ascendant des banks)', () => {
    const dup = { 5: { A: 'DUP', B: '', C: '' }, 2: { A: 'DUP', B: '', C: '' } };
    // Object.entries ordonne les clés entières en ascendant → bank 2 d'abord.
    expect(lookupBankIndex(buildBankIndex(dup), 'DUP')).toEqual(findInBanks('DUP', dup));
  });
});
