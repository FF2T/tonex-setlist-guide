// src/core/crypto-utils.js — Phase 7.28.
//
// Hash de password pour profile.password. Utilise SHA-256 + salt 128
// bits, format stocké `h1:hexsalt:hexhash`. Backward compat avec les
// passwords legacy en clair : si stored n'a pas le préfixe `h1:`, on
// fait une compare directe et on auto-upgrade au prochain save.
//
// Pas de lib externe — crypto.subtle.digest() est disponible dans
// tous les navigateurs cibles (Safari iOS 11+, Chrome 37+, Firefox 34+).

const HASH_PREFIX = 'h1:';

function genSalt() {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    // Defensive fallback (SSR / vieux env). Pas idéal mais évite le crash.
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function _sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function _hashWithSalt(plain, salt) {
  const hex = await _sha256Hex(salt + ':' + plain);
  return HASH_PREFIX + salt + ':' + hex;
}

// Hash a plaintext password. Empty input → empty output (no password).
export async function hashPassword(plain) {
  if (!plain) return '';
  return _hashWithSalt(plain, genSalt());
}

// Verify a plaintext password against a stored representation.
// stored = empty/null → match only if plain also empty
// stored = `h1:salt:hash` → SHA-256 compare
// stored = anything else → legacy clear text, direct compare
export async function verifyPassword(plain, stored) {
  if (!stored) return !plain;
  if (typeof stored === 'string' && stored.startsWith(HASH_PREFIX)) {
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expected = await _hashWithSalt(plain, salt);
    return expected === stored;
  }
  return stored === plain;
}

// True if `stored` is a legacy plaintext (non-empty without `h1:` prefix).
// Used to trigger silent auto-upgrade on next save.
export function isPasswordLegacy(stored) {
  if (!stored || typeof stored !== 'string') return false;
  return !stored.startsWith(HASH_PREFIX);
}
