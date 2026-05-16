// src/app/utils/firebase-auth.js — Phase 7.30.
//
// Firebase Anonymous Auth pour Firestore REST. Au boot, l'app crée
// un compte anonyme (ou réutilise celui en cache via refresh token).
// Le idToken est attaché en `Authorization: Bearer ...` sur chaque
// appel Firestore (via `authedFetch`).
//
// Pourquoi : les Firestore security rules basculent en
// `allow read, write: if request.auth != null;` — sans token, les
// requêtes brutes avec la Firebase Web Key seule retournent 403.
// Bloque la fuite GitGuardian du 9 mai 2026 (la clé reste publique
// dans le bundle, mais elle ne suffit plus à accéder aux données).
//
// Note : la création d'utilisateurs anonymes côté Firebase Auth
// s'accumule au fil du temps. Free tier = 50K DAU. À nettoyer
// périodiquement via Cloud Console si nécessaire.

const LS_AUTH_KEY = 'backline_anon_auth';

function loadAuthCache() {
  try { return JSON.parse(localStorage.getItem(LS_AUTH_KEY)); } catch (e) { return null; }
}
function saveAuthCache(data) {
  try { localStorage.setItem(LS_AUTH_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
function clearAuthCache() {
  try { localStorage.removeItem(LS_AUTH_KEY); } catch (e) { /* ignore */ }
}

async function signUpAnonymouslyOnce(apiKey) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Anonymous sign-up failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const cache = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
    localId: data.localId,
  };
  saveAuthCache(cache);
  return cache;
}

// Phase 7.52.17 — Retry exponentiel sur signUp.
// Couvre les 5xx transitoires, timeouts réseau, throttling Firebase.
// Backoff 500ms → 1s → 2s sur 3 tentatives totales.
async function signUpAnonymously(apiKey) {
  const delays = [500, 1000, 2000];
  let lastErr = null;
  for (let attempt = 0; attempt < delays.length + 1; attempt += 1) {
    try {
      return await signUpAnonymouslyOnce(apiKey);
    } catch (e) {
      lastErr = e;
      if (attempt >= delays.length) break;
      const wait = delays[attempt];
      console.warn(`[firebase-auth] signUp attempt ${attempt + 1} failed (${e.message}), retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  console.error('[firebase-auth] signUp failed after retries:', lastErr?.message);
  throw lastErr;
}

async function refreshIdToken(refreshToken, apiKey) {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = await res.json();
  const cache = {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
    localId: data.user_id,
  };
  saveAuthCache(cache);
  return cache;
}

let _authPromise = null;

export async function ensureAuthToken(apiKey) {
  if (_authPromise) return _authPromise;
  _authPromise = (async () => {
    try {
      let cache = loadAuthCache();
      // Token still valid → use it
      if (cache?.idToken && Date.now() < cache.expiresAt - 60_000) {
        return cache.idToken;
      }
      // Try refresh
      if (cache?.refreshToken) {
        try {
          cache = await refreshIdToken(cache.refreshToken, apiKey);
          return cache.idToken;
        } catch (e) {
          clearAuthCache();
        }
      }
      // New anonymous account
      cache = await signUpAnonymously(apiKey);
      return cache.idToken;
    } finally {
      _authPromise = null;
    }
  })();
  return _authPromise;
}

// Phase 7.52.17 — Auto-recovery 401 dans authedFetch.
//
// Cas observé 2026-05-16 Sébastien Mac : le cache local contenait un
// idToken expiré et un refreshToken devenu invalide. ensureAuthToken
// utilisait le idToken cached (passant le check expiresAt), Firestore
// répondait 401, aucune récupération automatique → l'app restait en
// 401 perpétuel jusqu'à reload manuel + localStorage.removeItem.
//
// Fix : si la 1ère réponse fetch est 401/403, on présume token rejeté.
// On clear le cache, force un nouveau signUpAnonymously via
// ensureAuthToken, et retry une seule fois. Si la 2e réponse est OK,
// transparent pour le caller. Si toujours 401/403, on propage tel quel.
export async function authedFetch(apiKey, url, init = {}) {
  const token = await ensureAuthToken(apiKey);
  const buildHeaders = (tok) => ({
    ...(init.headers || {}),
    Authorization: 'Bearer ' + tok,
  });
  const res = await fetch(url, { ...init, headers: buildHeaders(token) });
  if (res.status !== 401 && res.status !== 403) return res;
  console.warn(`[firebase-auth] fetch ${res.status} on ${url.split('?')[0]} — clearing cache + retry`);
  clearAuthCache();
  _authPromise = null;
  const freshToken = await ensureAuthToken(apiKey);
  return fetch(url, { ...init, headers: buildHeaders(freshToken) });
}

export function clearAnonAuth() {
  clearAuthCache();
  _authPromise = null;
}
