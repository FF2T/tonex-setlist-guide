// Tests Phase 5 (Item F) — constantes SOURCE_LABELS / BADGES / INFO.

import { describe, test, expect } from 'vitest';
import {
  SOURCE_IDS, SOURCE_LABELS, SOURCE_BADGES, SOURCE_INFO,
  getSourceBadge, getSourceInfo,
} from './sources.js';

describe('SOURCE_IDS — liste canonique', () => {
  test('contient les 7 sources connues', () => {
    expect(SOURCE_IDS).toEqual([
      'TSR', 'ML', 'Anniversary', 'Factory', 'PlugFactory', 'ToneNET', 'custom',
    ]);
  });
});

describe('SOURCE_LABELS — long form', () => {
  test('chaque source id a un label long', () => {
    SOURCE_IDS.forEach((id) => {
      expect(typeof SOURCE_LABELS[id]).toBe('string');
      expect(SOURCE_LABELS[id].length).toBeGreaterThan(0);
    });
  });
  test('Anniversary distinct de Factory', () => {
    expect(SOURCE_LABELS.Anniversary).not.toBe(SOURCE_LABELS.Factory);
    expect(SOURCE_LABELS.Anniversary).toContain('Anniversary');
    expect(SOURCE_LABELS.Factory).toContain('Factory');
  });
});

describe('SOURCE_BADGES — short form ≤ 8 chars', () => {
  test('chaque badge ≤ 8 chars', () => {
    SOURCE_IDS.forEach((id) => {
      expect(SOURCE_BADGES[id].length).toBeLessThanOrEqual(8);
    });
  });
  test('Anniversary → "Pédale" (legacy)', () => {
    expect(SOURCE_BADGES.Anniversary).toBe('Pédale');
  });
});

describe('getSourceBadge', () => {
  test('source connue → badge', () => {
    expect(getSourceBadge('TSR')).toBe('TSR');
    expect(getSourceBadge('Anniversary')).toBe('Pédale');
  });
  test('source inconnue → ""', () => {
    expect(getSourceBadge('Wahwah')).toBe('');
    expect(getSourceBadge(null)).toBe('');
    expect(getSourceBadge(undefined)).toBe('');
  });
});

describe('getSourceInfo', () => {
  test('TSR sans pack → label générique', () => {
    expect(getSourceInfo({ src: 'TSR' })).toEqual({
      icon: '📦', label: 'Pack 64 Studio Rats (zip)',
    });
  });
  test('TSR avec pack → label inclut le nom du pack', () => {
    expect(getSourceInfo({ src: 'TSR', pack: 'British Lead' }).label).toContain('British Lead');
  });
  test('custom avec pack → "Custom — pack"', () => {
    expect(getSourceInfo({ src: 'custom', pack: 'My collection' }).label).toBe('Custom — My collection');
  });
  test('source inconnue → fallback "📁 src"', () => {
    expect(getSourceInfo({ src: 'Mystery' })).toEqual({ icon: '📁', label: 'Mystery' });
  });
  test('entry null/sans src → null', () => {
    expect(getSourceInfo(null)).toBe(null);
    expect(getSourceInfo({})).toBe(null);
  });
});
