// Tests de regression pour computeGuitarScoreV2 et computeFinalScore.
// 11 guitares de la collection × 2 fonctions, sur un contexte cohérent
// avec ledzep_stairway (rock, gain 8, Marshall SL800).
// 22 snapshots au total.

import { describe, test, expect } from 'vitest';
import { computeGuitarScoreV2 } from './guitar.js';
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
