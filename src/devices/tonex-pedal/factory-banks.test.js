// Conformité PDF — tone_models/TONEX_Pedal_Pre-loaded_Factory_Presets.pdf v2
// (2025/04/03). 50 banks × 3 slots = 150 presets. Empêche toute régression
// du mapping bank → slot. Phase 7.47.

import { describe, test, expect } from 'vitest';
import {
  FACTORY_BANKS_PEDALE,
  FACTORY_BANKS_PEDALE_V1,
  FACTORY_BANKS_PEDALE_V2,
} from './catalog.js';
import { FACTORY_CATALOG } from '../../data/data_catalogs.js';

// Source de vérité : PDF v2 (2025/04/03). Une ligne par slot, dans l'ordre
// du PDF, pour rester lisible à la relecture.
const PDF_V2_EXPECTED = {
  0:  { A: 'CL DMBL',         B: 'DR1 DMBL',       C: 'DR2 DMBL' },
  1:  { A: 'DR PLEXI',        B: 'HG PLEXI',       C: 'LD PLEXI' },
  2:  { A: 'CL 515S',         B: 'HG 515S',        C: 'LD 515S' },
  3:  { A: 'CL TWIN',         B: 'DR1 TWIN',       C: 'DR2 TWIN' },
  4:  { A: 'CL OR120',        B: 'DR OR120',       C: 'HG OR120' },
  5:  { A: 'DR DUAL',         B: 'HG DUAL',        C: 'LD DUAL' },
  6:  { A: 'CL VX30',         B: 'DR VX30',        C: 'HG VX30' },
  7:  { A: 'CL WRECK',        B: 'DR WRECK',       C: 'HG WRECK' },
  8:  { A: 'DR FRIED',        B: 'HG FRIED',       C: 'LD FRIED' },
  9:  { A: 'DR SOLD',         B: 'HG SOLD',        C: 'LD SOLD' },
  10: { A: 'CL MARK3',        B: 'HG MARK3',       C: 'LD MARK3' },
  11: { A: 'DR 800',          B: 'HG 800',         C: 'LD 800' },
  12: { A: 'DR DZL',          B: 'HG DZL',         C: 'LD DZL' },
  13: { A: 'CL HIWTT',        B: 'DR HIWTT',       C: 'HG HIWTT' },
  14: { A: 'DR MZER',         B: 'HG MZER',        C: 'LD MZER' },
  15: { A: 'DR 5051',         B: 'HG 5051',        C: 'LD 5051' },
  16: { A: 'DR1 PRIN',        B: 'DR2 PRIN',       C: 'HG PRIN' },
  17: { A: 'CL MRK5',         B: 'DR1 MRK5',       C: 'DR2 MRK5' },
  18: { A: 'DR FIRE',         B: 'HG FIRE',        C: 'LD FIRE' },
  19: { A: 'CL JAZZ',         B: 'DR1 JAZZ',       C: 'DR2 JAZZ' },
  20: { A: 'DR THUND',        B: 'HG THUND',       C: 'LD THUND' },
  21: { A: 'CL BOGN',         B: 'HG BOGN',        C: 'LD BOGN' },
  22: { A: 'CL DLX',          B: 'DR1 DLX',        C: 'DR2 DLX' },
  23: { A: 'CL GUNS',         B: 'HG GUNS',        C: 'LD GUNS' },
  24: { A: 'CL MAVER',        B: 'DR MAVER',       C: 'LD MAVER' },
  25: { A: 'CL ARCH',         B: 'HG ARCH',        C: 'LD ARCH' },
  26: { A: 'CL BMAN',         B: 'DR1 BMAN',       C: 'DR2 BMAN' },
  27: { A: 'CL RMAN',         B: 'DR RMAN',        C: 'LD RMAN' },
  28: { A: 'CL 3NITY',        B: 'DR 3NITY',       C: 'HG 3NITY' },
  29: { A: 'CL 900',          B: 'HG 900',         C: 'LD 900' },
  30: { A: 'BRIGHTON',        B: 'AMBIENT',        C: 'PINKDLY' },
  31: { A: 'AINTALK',         B: 'BOULEVAR',       C: 'STERPAN' },
  32: { A: 'SPRING4',         B: 'MYBABY',         C: 'BLKHOLE' },
  33: { A: '1CHAIN',          B: 'VOWELS',         C: 'SLAPBACK' },
  34: { A: 'PHASEY',          B: 'LUSH',           C: 'INFINITE' },
  35: { A: 'CL VX30 (Amp)',   B: 'DR PLEXI (Amp)', C: 'HG DZL (Amp)' },
  36: { A: 'CL JAZZ (Amp)',   B: 'DR OR120 (Amp)', C: 'HG SOLD (Amp)' },
  37: { A: 'CL TWIN (Amp)',   B: 'DR MARK3 (Amp)', C: 'HG 5051 (Amp)' },
  38: { A: 'CL DMBL (Amp)',   B: 'DR FRIED (Amp)', C: 'HG DUAL (Amp)' },
  39: { A: 'CL HIWTT (Amp)',  B: 'DR BOGN (Amp)',  C: 'HG FIRE (Amp)' },
  40: { A: 'BOX-SD1',         B: 'CLONE 1',        C: 'CLONE 2' },
  41: { A: 'DRVMASTR',        B: 'FULDRV 2',       C: 'FULL DOC' },
  42: { A: 'MAXO 8O8',        B: 'TS8O8 A',        C: 'TS8O8 B' },
  43: { A: 'SUNSET',          B: 'BOX-DS1',        C: 'MOUSE' },
  44: { A: 'XOTBOOST',        B: 'FUZZONE',        C: 'MAYFUZZ' },
  45: { A: 'BS B15',          B: 'BS DB750',       C: 'BS SVX 2' },
  46: { A: 'BS 800',          B: 'BS 800RB',       C: 'BS ORNG' },
  47: { A: 'BS SVX VR',       B: 'BS IRON',        C: 'BS SANS' },
  48: { A: 'BS BK7',          B: 'BS DUG',         C: 'BS LEE' },
  49: { A: 'BS XULTR',        B: 'BS DOC',         C: 'BS MUFF' },
};

describe('FACTORY_BANKS_PEDALE_V2 · conformité PDF v2 (2025/04/03)', () => {
  test('expose exactement 50 banks (0..49)', () => {
    const keys = Object.keys(FACTORY_BANKS_PEDALE_V2).map(Number).sort((a, b) => a - b);
    expect(keys.length).toBe(50);
    expect(keys[0]).toBe(0);
    expect(keys[49]).toBe(49);
  });

  test.each(Object.keys(PDF_V2_EXPECTED).map(Number))(
    'bank %i matche le PDF v2 (slots A/B/C)',
    (idx) => {
      const exp = PDF_V2_EXPECTED[idx];
      const got = FACTORY_BANKS_PEDALE_V2[idx];
      expect(got).toBeDefined();
      expect(got.A).toBe(exp.A);
      expect(got.B).toBe(exp.B);
      expect(got.C).toBe(exp.C);
    }
  );

  test('chaque preset nommé existe dans FACTORY_CATALOG', () => {
    const missing = [];
    for (const idx of Object.keys(PDF_V2_EXPECTED)) {
      for (const slot of ['A', 'B', 'C']) {
        const name = PDF_V2_EXPECTED[idx][slot];
        if (!FACTORY_CATALOG[name]) missing.push(`Bank ${idx}${slot}: "${name}"`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('total de 150 presets (50 banks × 3 slots)', () => {
    let count = 0;
    Object.values(FACTORY_BANKS_PEDALE_V2).forEach((bank) => {
      ['A', 'B', 'C'].forEach((s) => { if (bank[s]) count += 1; });
    });
    expect(count).toBe(150);
  });

  test('FACTORY_BANKS_PEDALE (alias) pointe sur V2', () => {
    expect(FACTORY_BANKS_PEDALE).toBe(FACTORY_BANKS_PEDALE_V2);
  });
});

describe('FACTORY_BANKS_PEDALE_V1 · placeholder firmware v1', () => {
  test('défini comme objet vide en attendant la liste utilisateur', () => {
    expect(FACTORY_BANKS_PEDALE_V1).toBeDefined();
    expect(typeof FACTORY_BANKS_PEDALE_V1).toBe('object');
    expect(Object.keys(FACTORY_BANKS_PEDALE_V1).length).toBe(0);
  });
});
