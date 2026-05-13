// src/core/crypto-utils.test.js — Phase 7.28.
//
// Tests du hash de password : format de sortie, vérification correcte,
// backward compat avec legacy plaintext, edge cases (empty/null).

import { describe, test, expect } from 'vitest';
import { hashPassword, verifyPassword, isPasswordLegacy } from './crypto-utils.js';

describe('hashPassword', () => {
  test('produit le format h1:hexsalt:hexhash', async () => {
    const out = await hashPassword('hello');
    expect(out).toMatch(/^h1:[0-9a-f]{32}:[0-9a-f]{64}$/);
  });

  test('empty input → empty output', async () => {
    expect(await hashPassword('')).toBe('');
    expect(await hashPassword(null)).toBe('');
    expect(await hashPassword(undefined)).toBe('');
  });

  test('même input → outputs différents (salts différents)', async () => {
    const a = await hashPassword('hello');
    const b = await hashPassword('hello');
    expect(a).not.toBe(b);
    expect(a.startsWith('h1:')).toBe(true);
    expect(b.startsWith('h1:')).toBe(true);
  });
});

describe('verifyPassword', () => {
  test('hash correct → true', async () => {
    const stored = await hashPassword('secret123');
    expect(await verifyPassword('secret123', stored)).toBe(true);
  });

  test('hash incorrect → false', async () => {
    const stored = await hashPassword('secret123');
    expect(await verifyPassword('wrong', stored)).toBe(false);
  });

  test('plaintext legacy → compare directe', async () => {
    expect(await verifyPassword('plain', 'plain')).toBe(true);
    expect(await verifyPassword('wrong', 'plain')).toBe(false);
  });

  test('stored vide + input vide → true (pas de password requis)', async () => {
    expect(await verifyPassword('', '')).toBe(true);
    expect(await verifyPassword('', null)).toBe(true);
    expect(await verifyPassword('', undefined)).toBe(true);
  });

  test('stored vide + input non vide → false', async () => {
    expect(await verifyPassword('something', '')).toBe(false);
    expect(await verifyPassword('something', null)).toBe(false);
  });

  test('stored malformé → false (pas de crash)', async () => {
    expect(await verifyPassword('foo', 'h1:incomplete')).toBe(false);
    expect(await verifyPassword('foo', 'h1:')).toBe(false);
  });

  test('cas réel : create + verify boucle', async () => {
    const plain = 'azerty123';
    const stored = await hashPassword(plain);
    expect(await verifyPassword(plain, stored)).toBe(true);
    expect(await verifyPassword(plain + 'x', stored)).toBe(false);
  });
});

describe('isPasswordLegacy', () => {
  test('plaintext non vide → true (à migrer)', () => {
    expect(isPasswordLegacy('plain')).toBe(true);
    expect(isPasswordLegacy('1234')).toBe(true);
  });

  test('hash h1: → false (déjà à jour)', () => {
    expect(isPasswordLegacy('h1:abc:def')).toBe(false);
  });

  test('empty/null → false (rien à migrer)', () => {
    expect(isPasswordLegacy('')).toBe(false);
    expect(isPasswordLegacy(null)).toBe(false);
    expect(isPasswordLegacy(undefined)).toBe(false);
  });
});
