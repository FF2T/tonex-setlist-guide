// Tests Phase A — Catalog amplis guitare traditionnels + helper findGuitarAmp.

import { describe, test, expect } from 'vitest';
import { GUITAR_AMPS, GUITAR_AMP_BRANDS, findGuitarAmp } from './guitar-amps.js';

describe('GUITAR_AMPS catalog', () => {
  test('contient au moins 4 amplis guitare iconiques', () => {
    expect(GUITAR_AMPS.length).toBeGreaterThanOrEqual(4);
  });

  test('chaque entrée a structure valide (id/name/short/brand/wattage/channels/knobs/eq/features/refs)', () => {
    GUITAR_AMPS.forEach((a) => {
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(typeof a.name).toBe('string');
      expect(typeof a.short).toBe('string');
      expect(typeof a.brand).toBe('string');
      expect(typeof a.wattage).toBe('number');
      expect(a.wattage).toBeGreaterThan(0);
      expect(Array.isArray(a.channels)).toBe(true);
      expect(a.channels.length).toBeGreaterThan(0);
      expect(Array.isArray(a.knobs)).toBe(true);
      expect(a.knobs.length).toBeGreaterThan(0);
      expect(Array.isArray(a.eq)).toBe(true);
      expect(Array.isArray(a.features)).toBe(true);
      expect(typeof a.refs).toBe('object');
      expect(typeof a.refs.fr).toBe('string');
      expect(typeof a.refs.en).toBe('string');
      expect(typeof a.refs.es).toBe('string');
    });
  });

  test('contient le Marshall Plexi (potards Vol-I/Vol-II + presence)', () => {
    const plexi = GUITAR_AMPS.find((a) => a.id === 'marshall_plexi');
    expect(plexi).toBeDefined();
    expect(plexi.brand).toBe('Marshall');
    expect(plexi.knobs).toContain('volume_i');
    expect(plexi.knobs).toContain('volume_ii');
    expect(plexi.knobs).toContain('presence');
  });

  test('contient le Fender Blues Junior (potards master + reverb)', () => {
    const bj = GUITAR_AMPS.find((a) => a.id === 'fender_blues_junior');
    expect(bj).toBeDefined();
    expect(bj.brand).toBe('Fender');
    expect(bj.knobs).toContain('master');
    expect(bj.knobs).toContain('reverb');
  });

  test('ids uniques', () => {
    const ids = GUITAR_AMPS.map((a) => a.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});

describe('GUITAR_AMP_BRANDS', () => {
  test('extrait les marques uniques (Marshall + Fender au minimum)', () => {
    expect(GUITAR_AMP_BRANDS).toContain('Marshall');
    expect(GUITAR_AMP_BRANDS).toContain('Fender');
  });
});

describe('findGuitarAmp', () => {
  test('retourne l\'ampli pour un id du catalog', () => {
    const a = findGuitarAmp('marshall_plexi');
    expect(a).toBeDefined();
    expect(a.brand).toBe('Marshall');
  });

  test('retourne null pour un id inconnu', () => {
    expect(findGuitarAmp('inexistant_amp')).toBeNull();
  });
});
