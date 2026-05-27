// Tests Phase 8.1 — Catalog basses + helper findBass.

import { describe, test, expect } from 'vitest';
import { BASSES, BASS_BRANDS, findBass } from './basses.js';

describe('BASSES catalog', () => {
  test('contient au moins 8 basses iconiques', () => {
    expect(BASSES.length).toBeGreaterThanOrEqual(8);
  });

  test('chaque entrée a id/name/short/type/brand non vides', () => {
    BASSES.forEach((b) => {
      expect(typeof b.id).toBe('string');
      expect(b.id.length).toBeGreaterThan(0);
      expect(typeof b.name).toBe('string');
      expect(b.name.length).toBeGreaterThan(0);
      expect(typeof b.short).toBe('string');
      expect(b.short.length).toBeGreaterThan(0);
      expect(['SC', 'PJ', 'HB', 'MM']).toContain(b.type);
      expect(typeof b.brand).toBe('string');
      expect(b.brand.length).toBeGreaterThan(0);
    });
  });

  test('contient les 2 basses Sébastien V1', () => {
    const jazzPlus = BASSES.find((b) => b.id === 'jazz_bass_player_plus');
    expect(jazzPlus).toBeDefined();
    expect(jazzPlus.name).toContain('Player Plus');
    const pAvri = BASSES.find((b) => b.id === 'precision_avri');
    expect(pAvri).toBeDefined();
    expect(pAvri.name).toContain('American Vintage II');
    expect(pAvri.type).toBe('PJ');
  });

  test('ids uniques', () => {
    const ids = BASSES.map((b) => b.id);
    const uniq = new Set(ids);
    expect(ids.length).toBe(uniq.size);
  });
});

describe('BASS_BRANDS', () => {
  test('extrait les marques uniques', () => {
    expect(BASS_BRANDS).toContain('Fender');
    expect(BASS_BRANDS).toContain('Music Man');
    expect(BASS_BRANDS).toContain('Rickenbacker');
    expect(BASS_BRANDS).toContain('Höfner');
    expect(BASS_BRANDS).toContain('Sire');
    expect(BASS_BRANDS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('findBass', () => {
  test('retourne la basse pour un id du catalog', () => {
    const b = findBass('jazz_bass_player_plus');
    expect(b).toBeDefined();
    expect(b.name).toBe('Fender Jazz Bass Player Plus');
  });

  test('retourne null pour un id inconnu', () => {
    expect(findBass('inexistant_basse')).toBeNull();
  });
});
