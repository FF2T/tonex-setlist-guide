import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Phase 7.52.17 — Tests de la robustification auth Firebase
// (retry exponentiel signUp + auto-recovery 401/403).
//
// Note : le module utilise `localStorage` directement et fetch global.
// En env Vitest node, ces globals n'existent pas → vi.stubGlobal partout.
// Le module est ré-importé dynamiquement pour reset l'état _authPromise
// entre tests (sinon l'auto-recovery 401 share un cache module-level).

const API_KEY = 'test-key';
const ANON_KEY = 'backline_anon_auth';

function makeLsStub() {
  const store = {};
  return {
    store,
    ls: {
      getItem: vi.fn((k) => (k in store ? store[k] : null)),
      setItem: vi.fn((k, v) => { store[k] = String(v); }),
      removeItem: vi.fn((k) => { delete store[k]; }),
    },
  };
}

function okSignUp() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      idToken: 'tok_fresh',
      refreshToken: 'refresh_fresh',
      expiresIn: '3600',
      localId: 'uid_xyz',
    }),
  };
}

function failFetch(status, body = '') {
  return { ok: false, status, text: async () => body, json: async () => ({}) };
}

describe('signUpAnonymously — retry exponentiel (Phase 7.52.17)', () => {
  let lsBundle;
  beforeEach(() => {
    lsBundle = makeLsStub();
    vi.stubGlobal('localStorage', lsBundle.ls);
    vi.useFakeTimers();
    vi.resetModules();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retry 3× avec backoff exponentiel puis succès', async () => {
    let signUpCalls = 0;
    const fetchMock = vi.fn(async (url) => {
      if (url.includes('accounts:signUp')) {
        signUpCalls += 1;
        if (signUpCalls < 3) return failFetch(503, 'transient');
        return okSignUp();
      }
      return { ok: true, status: 200, headers: new Map() };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { authedFetch } = await import('./firebase-auth.js');
    const promise = authedFetch(API_KEY, 'https://firestore.googleapis.com/test');
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(signUpCalls).toBe(3); // 2 échecs + 1 succès
  });

  it('échec persistant après tous les retries → throw', async () => {
    const fetchMock = vi.fn(async () => failFetch(500, 'down'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { authedFetch } = await import('./firebase-auth.js');
    const promise = authedFetch(API_KEY, 'https://firestore.googleapis.com/test').catch((e) => e);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toMatch(/sign-up failed/i);
  });
});

describe('authedFetch — auto-recovery 401 (Phase 7.52.17)', () => {
  let lsBundle;
  beforeEach(() => {
    lsBundle = makeLsStub();
    vi.stubGlobal('localStorage', lsBundle.ls);
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('401 → clear cache + retry avec token frais', async () => {
    // Cache pré-rempli avec un token "stale" (dans expiresAt mais
    // rejeté par Firestore).
    lsBundle.store[ANON_KEY] = JSON.stringify({
      idToken: 'tok_stale',
      refreshToken: 'refresh_stale',
      expiresAt: Date.now() + 3_600_000,
      localId: 'uid_stale',
    });

    let firestoreCalls = 0;
    const fetchMock = vi.fn(async (url, init) => {
      if (url.includes('accounts:signUp')) return okSignUp();
      if (url.includes('firestore')) {
        firestoreCalls += 1;
        const auth = init?.headers?.Authorization || '';
        if (auth.includes('tok_stale')) return { ok: false, status: 401, headers: new Map() };
        return { ok: true, status: 200, headers: new Map() };
      }
      throw new Error('unexpected fetch: ' + url);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { authedFetch } = await import('./firebase-auth.js');
    const res = await authedFetch(API_KEY, 'https://firestore.googleapis.com/v1/test');

    expect(res.status).toBe(200);
    expect(firestoreCalls).toBe(2);
    const cache = JSON.parse(lsBundle.store[ANON_KEY]);
    expect(cache.idToken).toBe('tok_fresh');
  });

  it('403 → même recovery', async () => {
    lsBundle.store[ANON_KEY] = JSON.stringify({
      idToken: 'tok_stale', refreshToken: 'r',
      expiresAt: Date.now() + 3_600_000, localId: 'u',
    });
    let firestoreCalls = 0;
    const fetchMock = vi.fn(async (url, init) => {
      if (url.includes('accounts:signUp')) return okSignUp();
      firestoreCalls += 1;
      const auth = init?.headers?.Authorization || '';
      if (auth.includes('tok_stale')) return { ok: false, status: 403, headers: new Map() };
      return { ok: true, status: 200, headers: new Map() };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { authedFetch } = await import('./firebase-auth.js');
    const res = await authedFetch(API_KEY, 'https://firestore.googleapis.com/test');
    expect(res.status).toBe(200);
    expect(firestoreCalls).toBe(2);
  });

  it('200 direct → pas de retry signUp', async () => {
    lsBundle.store[ANON_KEY] = JSON.stringify({
      idToken: 'tok_valid', refreshToken: 'r',
      expiresAt: Date.now() + 3_600_000, localId: 'u',
    });
    let firestoreCalls = 0;
    const fetchMock = vi.fn(async (url) => {
      if (url.includes('accounts:signUp')) throw new Error('should not be called');
      firestoreCalls += 1;
      return { ok: true, status: 200, headers: new Map() };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { authedFetch } = await import('./firebase-auth.js');
    const res = await authedFetch(API_KEY, 'https://firestore.googleapis.com/test');
    expect(res.status).toBe(200);
    expect(firestoreCalls).toBe(1);
  });

  it('2e 401 après retry → propage tel quel (pas de boucle infinie)', async () => {
    lsBundle.store[ANON_KEY] = JSON.stringify({
      idToken: 'tok_stale', refreshToken: 'r',
      expiresAt: Date.now() + 3_600_000, localId: 'u',
    });
    const fetchMock = vi.fn(async (url) => {
      if (url.includes('accounts:signUp')) return okSignUp();
      return { ok: false, status: 401, headers: new Map() };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { authedFetch } = await import('./firebase-auth.js');
    const res = await authedFetch(API_KEY, 'https://firestore.googleapis.com/test');
    expect(res.status).toBe(401);
  });
});
