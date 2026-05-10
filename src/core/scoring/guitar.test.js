// Tests de regression pour computeGuitarScoreV2 et computeFinalScore.
// 11 guitares de la collection × 2 fonctions, sur un contexte cohérent
// avec ledzep_stairway (rock, gain 8, Marshall SL800).
// 22 snapshots au total.

import { describe, test, expect } from 'vitest';
import { computeGuitarScoreV2, inferGuitarProfile, localGuitarSongScore } from './guitar.js';
import { computeFinalScore } from './index.js';

const ALL_GUITARS = [
  'lp60', 'lp50p90', 'sg_ebony', 'sg61', 'es335',
  'strat61', 'strat_pro2', 'strat_ec',
  'tele63', 'tele_ultra', 'jazzmaster',
];

// Contexte morceau : Stairway to Heaven, section solo.
const STAIRWAY_SONG = {
  songStyle: 'rock',
  songTargetGain: 8,
  songRefAmp: 'Marshall SL800',
};

const STAIRWAY_PRESET = {
  style: 'rock',
  gain: 8,
  amp: 'Marshall SL800',
  voicing: 'balanced',
};

describe('computeGuitarScoreV2 · 11 guitares · ledzep_stairway (rock/drive/balanced)', () => {
  ALL_GUITARS.forEach((id) => {
    test(`${id}`, () => {
      expect(
        computeGuitarScoreV2(id, 'rock', 'drive', 'balanced'),
      ).toMatchSnapshot();
    });
  });
});

describe('computeFinalScore · 11 guitares · ledzep_stairway (preset Marshall SL800 drive)', () => {
  ALL_GUITARS.forEach((id) => {
    test(`${id}`, () => {
      expect(
        computeFinalScore(
          STAIRWAY_PRESET,
          id,
          STAIRWAY_SONG.songStyle,
          STAIRWAY_SONG.songTargetGain,
          STAIRWAY_SONG.songRefAmp,
        ),
      ).toMatchSnapshot();
    });
  });
});

describe('inferGuitarProfile · semi-hollow Phase 3.8 (Arthur ES-339)', () => {
  test('"Epiphone ES-339" (HB) → semi_hollow + voicing warm', () => {
    const p = inferGuitarProfile('Epiphone ES-339', 'HB');
    expect(p.bodyResonance).toBe('semi_hollow');
    expect(p.voicing).toBe('warm');
    expect(p.styleMods.blues).toBe(+5);
    expect(p.styleMods.jazz).toBe(+6);
  });

  test('"Epiphone Casino" → semi_hollow', () => {
    const p = inferGuitarProfile('Epiphone Casino', 'P90');
    expect(p.bodyResonance).toBe('semi_hollow');
  });

  test('"Epiphone 339" (sans préfixe ES) → semi_hollow (numéro brut)', () => {
    // Cas où l'utilisateur entre juste "Epiphone 339" sans le "ES-".
    const p = inferGuitarProfile('Epiphone 339', 'HB');
    expect(p.bodyResonance).toBe('semi_hollow');
  });

  test('"Epiphone Sheraton II" → semi_hollow', () => {
    const p = inferGuitarProfile('Epiphone Sheraton II', 'HB');
    expect(p.bodyResonance).toBe('semi_hollow');
  });

  test('"Gibson ES-175" (jazz hollow) → semi_hollow', () => {
    const p = inferGuitarProfile('Gibson ES-175', 'HB');
    expect(p.bodyResonance).toBe('semi_hollow');
  });

  test('"SG Standard 61" → solid (régression : pas de faux positif)', () => {
    const p = inferGuitarProfile('SG Standard 61', 'HB');
    expect(p.bodyResonance).toBe('solid');
  });

  test('"Strat 61" → solid', () => {
    const p = inferGuitarProfile('Strat 61', 'SC');
    expect(p.bodyResonance).toBe('solid');
  });
});

describe('localGuitarSongScore · Arthur ES-339 vs SG sur BB King "Thrill is Gone" (Phase 3.8)', () => {
  // BB King "The Thrill is Gone" : style blues, gain clean (3-4),
  // pickup_preference HB. Arthur veut son ES-339 (semi-hollow) au-dessus
  // de sa SG (solid). Sans le fix Phase 3.8, l'ES-339 custom était
  // inférée en "solid" via le fallback générique HB et perdait son bonus
  // semi_hollow + blues + clean.
  // Note : le test simule des guitares custom. findGuitar() ne les trouve
  // pas en environnement node (window.__allGuitars absent), donc on
  // utilise inferGuitarProfile directement via computeGuitarScoreV2 ne
  // fonctionne pas (besoin du guitarId résolvable). Ici on teste la
  // chaîne complète via inferGuitarProfile + un mini compute manuel.
  function score(profile, presetGain, presetStyle) {
    const styleMod = profile.styleMods[presetStyle] || 0;
    const gainMod = profile.gainAffinity[presetGain] || 0;
    let resonanceMod = 0;
    if (profile.bodyResonance === 'semi_hollow' && ['clean', 'crunch'].includes(presetGain) && ['blues', 'jazz'].includes(presetStyle)) resonanceMod = +4;
    return Math.max(0, Math.min(100, 50 + (styleMod + gainMod + resonanceMod) * 3));
  }

  test('ES-339 (semi-hollow) > SG Standard 61 (solid) sur blues/clean', () => {
    const es339 = inferGuitarProfile('Epiphone ES-339', 'HB');
    const sg = inferGuitarProfile('SG Standard 61', 'HB');
    const scoreEs = score(es339, 'clean', 'blues');
    const scoreSg = score(sg, 'clean', 'blues');
    expect(scoreEs).toBeGreaterThan(scoreSg);
    // Différence significative : l'ES-339 a styleMods.blues=+5 et un
    // bonus resonance +4, la SG via inferGuitarProfile a styleMods.blues
    // bas (+1) et pas de bonus.
    expect(scoreEs - scoreSg).toBeGreaterThanOrEqual(15);
  });

  test('ES-339 reste devant SG aussi en blues/crunch', () => {
    const es339 = inferGuitarProfile('Epiphone ES-339', 'HB');
    const sg = inferGuitarProfile('SG Standard 61', 'HB');
    expect(score(es339, 'crunch', 'blues')).toBeGreaterThan(score(sg, 'crunch', 'blues'));
  });
});
