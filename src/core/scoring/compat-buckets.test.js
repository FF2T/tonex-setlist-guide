// src/core/scoring/compat-buckets.test.js — Phase 7.83 tests.

import { describe, it, expect } from 'vitest';
import { COMPAT_LEVELS, bucketizeScore, groupByBucket } from './compat-buckets.js';

describe('Phase 7.83 — bucketizeScore', () => {
  it('classes ideal pour score >= 75', () => {
    expect(bucketizeScore(75).id).toBe('ideal');
    expect(bucketizeScore(80).id).toBe('ideal');
    expect(bucketizeScore(100).id).toBe('ideal');
  });

  it('classes good pour score 55-74', () => {
    expect(bucketizeScore(55).id).toBe('good');
    expect(bucketizeScore(60).id).toBe('good');
    expect(bucketizeScore(74).id).toBe('good');
  });

  it('classes compromise pour score < 55', () => {
    expect(bucketizeScore(54).id).toBe('compromise');
    expect(bucketizeScore(0).id).toBe('compromise');
    expect(bucketizeScore(30).id).toBe('compromise');
  });

  it('fallback compromise pour input invalide', () => {
    expect(bucketizeScore(null).id).toBe('compromise');
    expect(bucketizeScore(undefined).id).toBe('compromise');
    expect(bucketizeScore(NaN).id).toBe('compromise');
    expect(bucketizeScore('80').id).toBe('compromise');
    expect(bucketizeScore({}).id).toBe('compromise');
  });

  it('retourne emoji + couleur cohérents', () => {
    const ideal = bucketizeScore(85);
    expect(ideal.emoji).toBe('🟢');
    expect(ideal.color).toMatch(/green/);

    const good = bucketizeScore(65);
    expect(good.emoji).toBe('🟡');

    const compromise = bucketizeScore(40);
    expect(compromise.emoji).toBe('🟠');
  });

  it('seuils boundary corrects (74→good, 75→ideal, 54→compromise, 55→good)', () => {
    expect(bucketizeScore(74).id).toBe('good');
    expect(bucketizeScore(75).id).toBe('ideal');
    expect(bucketizeScore(54).id).toBe('compromise');
    expect(bucketizeScore(55).id).toBe('good');
  });
});

describe('Phase 7.83 — groupByBucket', () => {
  it('groupe correctement par bucket', () => {
    const items = [
      { id: 'g1', score: 85 },  // ideal
      { id: 'g2', score: 60 },  // good
      { id: 'g3', score: 40 },  // compromise
      { id: 'g4', score: 90 },  // ideal
    ];
    const out = groupByBucket(items);
    expect(out.ideal.map((i) => i.id)).toEqual(['g1', 'g4']);
    expect(out.good.map((i) => i.id)).toEqual(['g2']);
    expect(out.compromise.map((i) => i.id)).toEqual(['g3']);
  });

  it('préserve l\'ordre d\'origine au sein de chaque groupe', () => {
    const items = [
      { id: 'a', score: 80 },
      { id: 'b', score: 90 },
      { id: 'c', score: 76 },
    ];
    const out = groupByBucket(items);
    expect(out.ideal.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('retourne 3 listes vides sur input falsy', () => {
    expect(groupByBucket(null)).toEqual({ ideal: [], good: [], compromise: [] });
    expect(groupByBucket(undefined)).toEqual({ ideal: [], good: [], compromise: [] });
    expect(groupByBucket([])).toEqual({ ideal: [], good: [], compromise: [] });
  });

  it('items sans score → compromise (defensive)', () => {
    const items = [
      { id: 'a' },
      { id: 'b', score: null },
      { id: 'c', score: 80 },
    ];
    const out = groupByBucket(items);
    expect(out.compromise.length).toBe(2);
    expect(out.ideal.length).toBe(1);
  });
});

describe('Phase 7.83 — COMPAT_LEVELS structure', () => {
  it('expose 3 niveaux avec id/emoji/threshold/color', () => {
    expect(Object.keys(COMPAT_LEVELS).sort()).toEqual(['compromise', 'good', 'ideal']);
    for (const lvl of Object.values(COMPAT_LEVELS)) {
      expect(typeof lvl.id).toBe('string');
      expect(typeof lvl.emoji).toBe('string');
      expect(typeof lvl.threshold).toBe('number');
      expect(typeof lvl.color).toBe('string');
    }
  });

  it('thresholds ordonnés décroissants', () => {
    expect(COMPAT_LEVELS.ideal.threshold).toBeGreaterThan(COMPAT_LEVELS.good.threshold);
    expect(COMPAT_LEVELS.good.threshold).toBeGreaterThan(COMPAT_LEVELS.compromise.threshold);
  });
});
