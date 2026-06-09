// src/app/utils/infer-preset.test.js — anomalies B/C (retour prod 2026-06-09).

import { describe, it, expect } from 'vitest';
import { inferPresetInfo } from './infer-preset.js';

describe('inferPresetInfo — défaut gain high-gain (B)', () => {
  it('Mesa Boogie Dual Rectifier REV F → high (école mesa_heavy)', () => {
    expect(inferPresetInfo('Mesa Boogie Dual Rectifier REV F').gain).toBe('high');
  });
  it('variantes Mesa / Peavey / EVH / ENGL → high', () => {
    expect(inferPresetInfo('Mesa Mark IIC+ Lead').gain).toBe('high');
    expect(inferPresetInfo('Peavey 5150 Block Letter').gain).toBe('high');
    expect(inferPresetInfo('ENGL Powerball').gain).toBe('high');
  });
  it('boutiques high-gain marshall_crunch (Friedman / Soldano) → high', () => {
    expect(inferPresetInfo('Friedman BE-100').gain).toBe('high');
    expect(inferPresetInfo('Soldano SLO-100').gain).toBe('high');
  });
  it('NE bump PAS les Marshall crunch ni Bogner versatile', () => {
    expect(inferPresetInfo('Marshall JCM800 Crunch').gain).not.toBe('high');
    expect(inferPresetInfo('Marshall Plexi 1959').gain).not.toBe('high');
    expect(inferPresetInfo('Bogner Ecstasy Blue').gain).not.toBe('high');
  });
  it('un mot-clé clean explicite l\'emporte sur le bump high-gain', () => {
    expect(inferPresetInfo('Mesa Rectifier Clean').gain).toBe('low');
  });
});

describe('inferPresetInfo — abréviations/codes (C)', () => {
  it('BOG → Bogner, MES → Mesa, PV → Peavey, FRIED → Friedman, SOLD → Soldano', () => {
    expect(inferPresetInfo('BOG XTC Blue').amp).toMatch(/Bogner/);
    expect(inferPresetInfo('MES Rectifier Modern').amp).toMatch(/Mesa/);
    expect(inferPresetInfo('PV 5150 Lead').amp).toMatch(/Peavey/);
    expect(inferPresetInfo('FRIED BE Drive').amp).toMatch(/Friedman/);
    expect(inferPresetInfo('SOLD SLO Lead').amp).toMatch(/Soldano/);
  });
});
