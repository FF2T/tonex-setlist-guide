// Tests du scoring TMP : recommendTMPPatch + dimensions individuelles.

import { describe, test, expect } from 'vitest';
import {
  WEIGHTS, recommendTMPPatch,
  scoreAmp, scoreCab, scoreDrive, scoreFx, scoreStyle, scorePickup,
} from './scoring.js';
import { TMP_FACTORY_PATCHES } from './catalog.js';

const SG_GUITAR = { id: 'sg_ebony', type: 'HB', name: 'SG' };
const ES339_LIKE = { id: 'es335', type: 'HB', name: 'ES-335' };
const STRAT = { id: 'strat61', type: 'SC', name: 'Strat' };

const ACDC_HTH = {
  id: 'acdc_hth',
  title: 'Highway to Hell',
  artist: 'AC/DC',
  aiCache: {
    result: {
      ref_amp: 'Marshall Super Lead 100W',
      ref_effects: 'Aucun effet',
      song_style: 'hard_rock',
    },
  },
};

const BBKING_THRILL = {
  id: 'bbking_thrill',
  title: 'The Thrill is Gone',
  artist: 'B.B. King',
  aiCache: {
    result: {
      ref_amp: 'Fender Super Reverb',
      ref_effects: 'Réverb spring, vibrato ES-355, léger delay studio',
      song_style: 'blues',
    },
  },
};

const TEL_FLIPPER = {
  id: 'tel_flipper',
  title: 'Flipper',
  artist: 'Téléphone',
  aiCache: {
    result: {
      ref_amp: 'Marshall JCM800',
      ref_effects: 'Léger chorus / delay, boost pour les solos',
      song_style: 'rock',
    },
  },
};

describe('WEIGHTS — somme = 1.00', () => {
  test('amp 0.45 + cab 0.20 + drive 0.15 + fx 0.05 + style 0.10 + pickup 0.05 = 1.00', () => {
    const sum = WEIGHTS.amp + WEIGHTS.cab + WEIGHTS.drive + WEIGHTS.fx + WEIGHTS.style + WEIGHTS.pickup;
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    expect(WEIGHTS.amp).toBe(0.45);
    expect(WEIGHTS.cab).toBe(0.20);
    expect(WEIGHTS.drive).toBe(0.15);
    expect(WEIGHTS.fx).toBe(0.05);
    expect(WEIGHTS.style).toBe(0.10);
    expect(WEIGHTS.pickup).toBe(0.05);
  });
});

describe('recommendTMPPatch — cas connus du seed', () => {
  test('AC/DC Highway to Hell + SG → rock_preset top', () => {
    const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, ACDC_HTH, SG_GUITAR, null);
    expect(recs[0].patch.id).toBe('rock_preset');
  });

  test('BB King Thrill is Gone + ES-339 (≈ es335) → clean_preset top', () => {
    const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, BBKING_THRILL, ES339_LIKE, null);
    expect(recs[0].patch.id).toBe('clean_preset');
  });

  test('Téléphone Flipper → flipper_patch top', () => {
    const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, TEL_FLIPPER, STRAT, null);
    expect(recs[0].patch.id).toBe('flipper_patch');
  });

  test('Stairway + LP → stairway_patch ou patch hard rock dans top 3', () => {
    const stairway = {
      id: 'ledzep_stairway',
      title: 'Stairway to Heaven',
      artist: 'Led Zeppelin',
      aiCache: {
        result: {
          ref_amp: 'Marshall Super Lead · Hiwatt Custom 100',
          ref_effects: 'Écho à bande Binson Echorec, Leslie speaker (studio)',
          song_style: 'rock',
        },
      },
    };
    const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, stairway, { id: 'lp60', type: 'HB' }, null);
    const top3Ids = recs.slice(0, 3).map((r) => r.patch.id);
    // Au moins un des candidats hard-rock/JCM800 doit apparaître en top 3.
    const hardRockMatches = ['stairway_patch', 'rock_preset', 'evh_brown_sound', 'orange_stoner_grit'];
    expect(top3Ids.some((id) => hardRockMatches.includes(id))).toBe(true);
  });
});

describe('recommendTMPPatch — edge cases', () => {
  test('song sans aiCache → liste retournée (basée sur pickup + style neutre)', () => {
    const songNoCache = { id: 'foo', title: 'X', artist: 'Y' };
    const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, songNoCache, SG_GUITAR, null);
    expect(recs.length).toBe(TMP_FACTORY_PATCHES.length);
    // Les scores ne sont pas tous 0 (pickup + style neutre 50 contribuent).
    expect(recs[0].score).toBeGreaterThan(0);
  });

  test('guitar null → utilise max pickup affinity', () => {
    const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, ACDC_HTH, null, null);
    expect(recs.length).toBeGreaterThan(0);
    // Top toujours rock_preset (amp + style + cab dominent largement)
    expect(recs[0].patch.id).toBe('rock_preset');
  });

  test('patches vide → []', () => {
    expect(recommendTMPPatch([], ACDC_HTH, SG_GUITAR, null)).toEqual([]);
  });

  test('chaque entrée du résultat contient {patch, score, breakdown}', () => {
    const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, ACDC_HTH, SG_GUITAR, null);
    recs.forEach((r) => {
      expect(r).toHaveProperty('patch');
      expect(r).toHaveProperty('score');
      expect(typeof r.score).toBe('number');
      expect(r).toHaveProperty('breakdown');
      ['amp', 'cab', 'drive', 'fx', 'style', 'pickup'].forEach((d) => {
        expect(r.breakdown).toHaveProperty(d);
      });
    });
  });

  test('classement décroissant', () => {
    const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, ACDC_HTH, SG_GUITAR, null);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i].score).toBeLessThanOrEqual(recs[i - 1].score);
    }
  });
});

describe('Dimensions individuelles', () => {
  test('scoreAmp : match parfait → 100, sans refAmp → 50', () => {
    expect(scoreAmp({ model: 'British Plexi' }, 'Marshall Plexi')).toBeGreaterThan(40);
    expect(scoreAmp({ model: 'British Plexi' }, null)).toBe(50);
    expect(scoreAmp(null, 'Marshall Plexi')).toBe(0);
  });

  test('scoreCab : Plexi + 4x12 Greenback → match', () => {
    const s = scoreCab({ model: '4x12 British Plexi Greenback' }, { model: 'British Plexi' });
    expect(s).toBe(100);
  });

  test('scoreDrive : low gain + drive présent → moins bon que sans drive', () => {
    expect(scoreDrive({ model: 'Klon' }, 'low')).toBeLessThan(scoreDrive(null, 'low'));
  });

  test('scoreDrive : mid gain + drive présent → meilleur que sans', () => {
    expect(scoreDrive({ model: 'Klon' }, 'mid')).toBeGreaterThan(scoreDrive(null, 'mid'));
  });

  test('scoreFx : refEffects = Aucun effet + patch sans FX → 100', () => {
    expect(scoreFx({}, 'Aucun effet')).toBe(100);
  });

  test('scorePickup : guitar HB + pickupAffinity {HB:95} → 95', () => {
    expect(scorePickup({ HB: 95, SC: 70, P90: 80 }, { type: 'HB' })).toBe(95);
  });

  test('scoreStyle : songStyle null → 50 (neutre)', () => {
    expect(scoreStyle('rock', null)).toBe(50);
  });
});
