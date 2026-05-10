// Tests Phase 4 — bpm/key sur INIT_SONG_DB_META + getSongInfo précédence.

import { describe, test, expect } from 'vitest';
import { INIT_SONG_DB_META, getSongInfo } from './songs.js';

describe('INIT_SONG_DB_META — bpm/key Phase 4', () => {
  test('les 13 morceaux ont bpm + key', () => {
    expect(INIT_SONG_DB_META).toHaveLength(13);
    INIT_SONG_DB_META.forEach((s) => {
      expect(typeof s.bpm).toBe('number');
      expect(s.bpm).toBeGreaterThan(50);
      expect(s.bpm).toBeLessThan(220);
      expect(typeof s.key).toBe('string');
      expect(s.key.length).toBeGreaterThan(0);
    });
  });

  test('valeurs de référence (échantillon)', () => {
    const stairway = INIT_SONG_DB_META.find((s) => s.id === 'ledzep_stairway');
    expect(stairway.bpm).toBe(72);
    expect(stairway.key).toBe('A minor');
    const tnt = INIT_SONG_DB_META.find((s) => s.id === 'acdc_tnt');
    expect(tnt.bpm).toBe(128);
    expect(tnt.key).toBe('A');
  });
});

describe('getSongInfo — précédence Phase 4', () => {
  test('préfère seed > song > aiCache pour bpm', () => {
    // Seed connu, mais on simule des valeurs concurrentes sur le morceau.
    const song = {
      id: 'acdc_hth', // bpm:116 dans le seed
      bpm: 999,
      aiCache: { result: { song_bpm: 200 } },
    };
    expect(getSongInfo(song).bpm).toBe(116);
  });

  test('si pas dans le seed, prend la valeur du morceau', () => {
    const song = {
      id: 'custom_song_xxx',
      bpm: 140,
      key: 'C',
    };
    expect(getSongInfo(song).bpm).toBe(140);
    expect(getSongInfo(song).key).toBe('C');
  });

  test('si ni seed ni song, retombe sur aiCache', () => {
    const song = {
      id: 'custom_song_yyy',
      aiCache: { result: { song_bpm: 100, song_key: 'D' } },
    };
    expect(getSongInfo(song).bpm).toBe(100);
    expect(getSongInfo(song).key).toBe('D');
  });

  test('aucune source → null', () => {
    const song = { id: 'unknown' };
    expect(getSongInfo(song).bpm).toBe(null);
    expect(getSongInfo(song).key).toBe(null);
  });
});
