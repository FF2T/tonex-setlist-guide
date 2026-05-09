// Tests de regression sur la redistribution des poids dans
// computeFinalScore. Quand une ou plusieurs dimensions retournent null
// (songRefAmp absent, songStyle absent, …) les poids des dimensions
// actives doivent être normalisés pour totaliser 100% — le breakdown
// renvoyé par _returnBreakdown=true le reflète.

import { describe, test, expect } from 'vitest';
import { computeFinalScore, SCORING_WEIGHTS } from './index.js';

const PRESET = {
  style: 'rock', gain: 8, amp: 'Marshall SL800', voicing: 'balanced',
};

describe('computeFinalScore · redistribution des poids', () => {
  test('5 dimensions actives → poids identiques aux SCORING_WEIGHTS', () => {
    const r = computeFinalScore(
      PRESET, 'lp60', 'rock', 8, 'Marshall SL800', true,
    );
    expect(r).toMatchSnapshot();
    // Sanity : aucune dimension à raw=null (toutes calculées)
    Object.values(r.breakdown).forEach((dim) => {
      expect(dim.raw).not.toBeNull();
    });
    // Somme des contributions ≈ score arrondi
    const sum = Object.values(r.breakdown).reduce((s, d) => s + d.contribution, 0);
    expect(Math.abs(sum - r.score)).toBeLessThanOrEqual(1);
  });

  test('songRefAmp = null → 4 dimensions actives, refAmp.raw = null', () => {
    const r = computeFinalScore(
      PRESET, 'lp60', 'rock', 8, null, true,
    );
    expect(r).toMatchSnapshot();
    expect(r.breakdown.refAmp.raw).toBeNull();
    expect(r.breakdown.refAmp.weight).toBe(0);
    expect(r.breakdown.refAmp.contribution).toBe(0);
    // Le poids de refAmp (0.30) doit être redistribué sur les 4 autres
    const activeWeights = ['pickup', 'guitar', 'gainMatch', 'styleMatch']
      .map((k) => r.breakdown[k].weight);
    expect(activeWeights.reduce((s, w) => s + w, 0)).toBeGreaterThanOrEqual(99);
    expect(activeWeights.reduce((s, w) => s + w, 0)).toBeLessThanOrEqual(101);
  });

  test('songStyle = null → 4 dimensions actives, styleMatch.raw = null', () => {
    const r = computeFinalScore(
      PRESET, 'lp60', null, 8, 'Marshall SL800', true,
    );
    expect(r).toMatchSnapshot();
    expect(r.breakdown.styleMatch.raw).toBeNull();
  });

  test('songRefAmp = null ET songStyle = null → 3 dimensions actives', () => {
    const r = computeFinalScore(
      PRESET, 'lp60', null, 8, null, true,
    );
    expect(r).toMatchSnapshot();
    expect(r.breakdown.refAmp.raw).toBeNull();
    expect(r.breakdown.styleMatch.raw).toBeNull();
    // Le score utilise pickup + guitar + gainMatch redistribués
    const activeWeights = ['pickup', 'guitar', 'gainMatch']
      .map((k) => r.breakdown[k].weight);
    expect(activeWeights.reduce((s, w) => s + w, 0)).toBeGreaterThanOrEqual(99);
  });

  test('SCORING_WEIGHTS somme = 1.00', () => {
    const sum = Object.values(SCORING_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });
});
