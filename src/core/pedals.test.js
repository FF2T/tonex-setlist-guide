// Tests Phase C — Catalog pédales d'effet + helper findPedal.

import { describe, test, expect } from 'vitest';
import { PEDALS, PEDAL_TYPES, PEDAL_BRANDS, findPedal } from './pedals.js';

describe('PEDALS catalog', () => {
  test('contient au moins 12 pédales iconiques', () => {
    expect(PEDALS.length).toBeGreaterThanOrEqual(12);
  });

  test('chaque entrée a structure valide (id/name/short/brand/type/knobs/refs)', () => {
    PEDALS.forEach((p) => {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe('string');
      expect(typeof p.short).toBe('string');
      expect(typeof p.brand).toBe('string');
      expect(PEDAL_TYPES).toContain(p.type);
      expect(Array.isArray(p.knobs)).toBe(true);
      expect(typeof p.refs).toBe('object');
      expect(typeof p.refs.fr).toBe('string');
      expect(typeof p.refs.en).toBe('string');
      expect(typeof p.refs.es).toBe('string');
    });
  });

  test('ids uniques', () => {
    const ids = PEDALS.map((p) => p.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test('couvre au moins drive/distortion/fuzz/chorus/delay/reverb/compressor', () => {
    const types = new Set(PEDALS.map((p) => p.type));
    ['overdrive', 'distortion', 'fuzz', 'chorus', 'delay', 'reverb', 'compressor'].forEach((t) => {
      expect(types).toContain(t);
    });
  });

  test('Tube Screamer présent (overdrive, potards drive/tone/level)', () => {
    const ts = PEDALS.find((p) => p.id === 'ts808');
    expect(ts).toBeDefined();
    expect(ts.type).toBe('overdrive');
    expect(ts.knobs).toEqual(['drive', 'tone', 'level']);
  });
});

describe('PEDAL_TYPES', () => {
  test('contient les types principaux', () => {
    ['drive', 'overdrive', 'distortion', 'fuzz', 'boost', 'compressor', 'chorus', 'phaser', 'delay', 'reverb', 'wah', 'octave'].forEach((t) => {
      expect(PEDAL_TYPES).toContain(t);
    });
  });
});

describe('PEDAL_BRANDS', () => {
  test('extrait les marques uniques (Boss + Ibanez + MXR au minimum)', () => {
    expect(PEDAL_BRANDS).toContain('Boss');
    expect(PEDAL_BRANDS).toContain('Ibanez');
    expect(PEDAL_BRANDS).toContain('MXR');
  });
});

describe('findPedal', () => {
  test('retourne la pédale pour un id du catalog', () => {
    const p = findPedal('big_muff');
    expect(p).toBeDefined();
    expect(p.type).toBe('fuzz');
  });

  test('retourne null pour un id inconnu', () => {
    expect(findPedal('inexistant_pedal')).toBeNull();
  });
});
