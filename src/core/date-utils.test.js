import { describe, test, expect } from 'vitest';
import { formatDateJJMMAA } from './date-utils.js';

describe('formatDateJJMMAA', () => {
  test('format JJMMAA basique', () => {
    expect(formatDateJJMMAA(new Date(2026, 4, 21))).toBe('210526'); // mois 0-indexé
  });

  test('padding zéro sur jour et mois < 10', () => {
    expect(formatDateJJMMAA(new Date(2026, 0, 5))).toBe('050126');
  });

  test('année 2000 → 00', () => {
    expect(formatDateJJMMAA(new Date(2000, 0, 1))).toBe('010100');
  });

  test('année 2099 → 99', () => {
    expect(formatDateJJMMAA(new Date(2099, 11, 31))).toBe('311299');
  });

  test('default = date courante (smoke test, 6 chars)', () => {
    const result = formatDateJJMMAA();
    expect(result).toMatch(/^\d{6}$/);
  });

  test('1er janvier 2026', () => {
    expect(formatDateJJMMAA(new Date(2026, 0, 1))).toBe('010126');
  });

  test('31 décembre 2026', () => {
    expect(formatDateJJMMAA(new Date(2026, 11, 31))).toBe('311226');
  });
});
