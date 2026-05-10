// Tests Phase 5.2 — constantes d'identité produit.

import { describe, test, expect } from 'vitest';
import { APP_NAME, APP_TAGLINE, APP_SHORT_NAME } from './branding.js';

describe('branding constants — Phase 5.2', () => {
  test('APP_NAME === "Backline"', () => {
    expect(APP_NAME).toBe('Backline');
  });

  test('APP_SHORT_NAME === "Backline"', () => {
    expect(APP_SHORT_NAME).toBe('Backline');
  });

  test('APP_TAGLINE non-vide et descriptif', () => {
    expect(typeof APP_TAGLINE).toBe('string');
    expect(APP_TAGLINE.length).toBeGreaterThan(20);
    expect(APP_TAGLINE).toContain('pédales');
    expect(APP_TAGLINE).toContain('amplis');
  });

  test("APP_NAME ne contient plus 'ToneX'", () => {
    expect(APP_NAME).not.toMatch(/ToneX/i);
    expect(APP_TAGLINE).not.toMatch(/ToneX/i);
  });
});
