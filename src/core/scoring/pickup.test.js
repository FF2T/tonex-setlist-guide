// Tests de regression pour computePickupScore (BASE_SCORES lookup pur).
// 6 styles × HB en drive + 5 cas de fallback.
// Les snapshots sont créés à la première exécution puis verrouillés —
// toute divergence ultérieure casse le test, ce qui est l'intention :
// le scoring V9 ne doit pas dériver pendant les phases 1-5.

import { describe, test, expect } from 'vitest';
import { computePickupScore, BASE_SCORES } from './pickup.js';

const STYLES = ['blues', 'rock', 'hard_rock', 'jazz', 'metal', 'pop'];

describe('computePickupScore · 6 styles avec HB en drive', () => {
  STYLES.forEach((style) => {
    test(`HB · ${style} · drive`, () => {
      expect(computePickupScore(style, 'drive', 'HB')).toMatchSnapshot();
    });
  });
});

describe('computePickupScore · cas de fallback', () => {
  test('style inconnu → 60', () => {
    expect(computePickupScore('reggae', 'drive', 'HB')).toBe(60);
  });

  test('gain inconnu → fallback crunch[pickup] = BASE_SCORES.rock.crunch.HB = 85', () => {
    expect(computePickupScore('rock', 'mid', 'HB')).toBe(BASE_SCORES.rock.crunch.HB);
    expect(computePickupScore('rock', 'mid', 'HB')).toBe(85);
  });

  test('pickup inconnu → 60', () => {
    expect(computePickupScore('rock', 'drive', 'XYZ')).toBe(60);
  });

  test('pickup null → 60', () => {
    expect(computePickupScore('rock', 'drive', null)).toBe(60);
  });

  test('style null → 60', () => {
    expect(computePickupScore(null, 'drive', 'HB')).toBe(60);
  });
});
