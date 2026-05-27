// Tests Phase 8.1 — Catalog amplis basse traditionnels + helper findBassAmp.

import { describe, test, expect } from 'vitest';
import { BASS_AMPS, BASS_AMP_BRANDS, findBassAmp } from './bass-amps.js';

describe('BASS_AMPS catalog', () => {
  test('contient au moins 4 amplis basse iconiques', () => {
    expect(BASS_AMPS.length).toBeGreaterThanOrEqual(4);
  });

  test('chaque entrée a structure valide (id/name/short/brand/wattage/channels/eq/features/refs)', () => {
    BASS_AMPS.forEach((a) => {
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(typeof a.name).toBe('string');
      expect(typeof a.short).toBe('string');
      expect(typeof a.brand).toBe('string');
      expect(typeof a.wattage).toBe('number');
      expect(a.wattage).toBeGreaterThan(0);
      expect(Array.isArray(a.channels)).toBe(true);
      expect(a.channels.length).toBeGreaterThan(0);
      expect(Array.isArray(a.eq)).toBe(true);
      expect(a.eq.length).toBeGreaterThan(0);
      expect(Array.isArray(a.features)).toBe(true);
      expect(typeof a.refs).toBe('object');
      expect(typeof a.refs.fr).toBe('string');
      expect(typeof a.refs.en).toBe('string');
      expect(typeof a.refs.es).toBe('string');
    });
  });

  test('contient le Fender Rumble 100 Sébastien', () => {
    const rumble = BASS_AMPS.find((a) => a.id === 'rumble_100');
    expect(rumble).toBeDefined();
    expect(rumble.name).toBe('Fender Rumble 100');
    expect(rumble.wattage).toBe(100);
    expect(rumble.eq).toContain('Bass');
    expect(rumble.eq).toContain('Treble');
  });

  test('contient Ampeg SVT (vintage rock)', () => {
    const ampeg = BASS_AMPS.find((a) => a.id === 'ampeg_svt_vr');
    expect(ampeg).toBeDefined();
    expect(ampeg.brand).toBe('Ampeg');
  });

  test('ids uniques', () => {
    const ids = BASS_AMPS.map((a) => a.id);
    const uniq = new Set(ids);
    expect(ids.length).toBe(uniq.size);
  });
});

describe('BASS_AMP_BRANDS', () => {
  test('extrait les marques uniques', () => {
    expect(BASS_AMP_BRANDS).toContain('Fender');
    expect(BASS_AMP_BRANDS).toContain('Ampeg');
    expect(BASS_AMP_BRANDS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('findBassAmp', () => {
  test('retourne l\'ampli pour un id du catalog', () => {
    const a = findBassAmp('rumble_100');
    expect(a).toBeDefined();
    expect(a.brand).toBe('Fender');
  });

  test('retourne null pour un id inconnu', () => {
    expect(findBassAmp('inexistant_amp')).toBeNull();
  });
});
