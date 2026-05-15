// src/app/utils/firestore.js — Phase 7.22 (découpage main.jsx).
//
// Firestore REST API — pas de SDK, juste fetch(). Stocke / récupère
// l'état complet de l'app pour la sync multi-device (Mac / iPhone /
// iPad). Le projet Firestore est `tonex-guide` (legacy name, jamais
// renommé).
//
// Phase 5.7.1 : strip aiCache du payload pour rester sous la limite
// document 1 MiB. Phase 6 : push opportuniste de l'aiCache si tout
// tient. Phase 6.1 : compression lz-string en fallback avant strip.

import LZString from 'lz-string';
import { stripAiCacheForSync, stripDemoProfiles } from '../../core/state.js';
import { setSharedGeminiKey } from './shared-key.js';
import { authedFetch as anonAuthedFetch } from './firebase-auth.js';

const FS_BASE = 'https://firestore.googleapis.com/v1/projects/tonex-guide/databases/(default)/documents';
const FS_KEY = 'AIzaSyAnaJMN-a47S9W_cTC60lKAnzRMAgHNMAA';

// Phase 7.30 — wrapper qui injecte le idToken Firebase Anonymous Auth
// dans chaque appel Firestore. Sans token, les rules `if request.auth
// != null` retournent 403 → bloque la fuite GitGuardian.
function authedFetch(url, init) { return anonAuthedFetch(FS_KEY, url, init); }

// Phase 7.24 — Mode "no-sync" pour les beta testeurs : désactive tous
// les appels Firestore. Le flag est lu au chargement et à chaque call.
// Activé via le toggle dans Mon Profil → 🔧 Maintenance → "Mode local".
// Stockage localStorage simple (pas synchronisé bien sûr).
const NO_SYNC_KEY = 'backline_no_sync';
export function isNoSyncMode() {
  try { return localStorage.getItem(NO_SYNC_KEY) === '1'; } catch (e) { return false; }
}
export function setNoSyncMode(enabled) {
  try {
    if (enabled) localStorage.setItem(NO_SYNC_KEY, '1');
    else localStorage.removeItem(NO_SYNC_KEY);
  } catch (e) {}
}

// Phase 7.51.2 — Mode démo : bloque tous les appels Firestore en runtime.
// Géré in-memory (pas de localStorage car le visiteur démo ne doit pas
// laisser de trace). L'App appelle setFirestoreDemoMode(true) au switch
// vers le profil démo, et false au retour.
let _isDemoMode = false;
export function setFirestoreDemoMode(b) { _isDemoMode = !!b; }
export function isFirestoreDemoMode() { return _isDemoMode; }
function isDemoOrNoSync() { return _isDemoMode || isNoSyncMode(); }

// IDs partagés avec le reste de main.jsx via les helpers
// getLastSavedSyncId() / getLastRemoteSyncId() pour les checks anti-echo.
let _lastSavedSyncId = null;
let _lastRemoteSyncId = null;

export function getLastSavedSyncId() { return _lastSavedSyncId; }
export function getLastRemoteSyncId() { return _lastRemoteSyncId; }
export function setLastRemoteSyncId(sid) { _lastRemoteSyncId = sid; }

export function saveToFirestore(s) {
  if (isDemoOrNoSync()) return Promise.resolve({ skipped: _isDemoMode ? 'demo' : 'no-sync' });
  const SAFE_LIMIT = 800 * 1024;
  const ts = (s && s.shared && typeof s.shared.lastModified === 'number') ? s.shared.lastModified : Date.now();
  const sid = Date.now().toString(36) + Math.random().toString(36).slice(2);
  _lastSavedSyncId = sid;
  const prep = (stateIn) => {
    // Phase 7.51.2 — défense en profondeur : strip les profils démo
    // (isDemo: true) avant push. Ne devrait jamais arriver en pratique
    // (le profil démo est in-memory uniquement), mais protège contre
    // les écritures accidentelles.
    const stripped = stripDemoProfiles(stateIn);
    const c = JSON.parse(JSON.stringify(stripped));
    c.syncId = sid;
    if (c.profiles) { for (const pid in c.profiles) { if (c.profiles[pid].aiKeys) c.profiles[pid].aiKeys = { anthropic: '', gemini: '' }; } }
    return c;
  };
  const cleanFull = prep(s);
  const payloadFull = JSON.stringify(cleanFull);
  let compressed = null;
  let clean = cleanFull;
  let payload = payloadFull;
  if (payloadFull.length >= SAFE_LIMIT) {
    compressed = LZString.compressToBase64(payloadFull);
    if (compressed.length < SAFE_LIMIT) {
      console.log('[firestore] Push WITH aiCache COMPRESSED (raw ' + (payloadFull.length / 1024).toFixed(0) + ' KB → compressed ' + (compressed.length / 1024).toFixed(0) + ' KB).');
      payload = null;
    } else {
      compressed = null;
      const light = stripAiCacheForSync(s);
      clean = prep(light);
      payload = JSON.stringify(clean);
      console.log('[firestore] Push WITHOUT aiCache (compressed ' + (LZString.compressToBase64(payloadFull).length / 1024).toFixed(0) + ' KB still ≥ ' + (SAFE_LIMIT / 1024) + ' KB limit). After strip: ' + (payload.length / 1024).toFixed(0) + ' KB.');
    }
  } else {
    console.log('[firestore] Push WITH aiCache opportunistic (size ' + (payloadFull.length / 1024).toFixed(0) + ' KB < ' + (SAFE_LIMIT / 1024) + ' KB limit).');
  }
  const actualPayload = compressed || payload;
  const sz = actualPayload.length;
  if (sz >= 1000000) {
    console.error('[firestore] Payload ' + (sz / 1024).toFixed(0) + ' KB ≥ 1 MB — push aborted (would 400). songs=' + (clean.shared && clean.shared.songDb ? clean.shared.songDb.length : 0));
    return Promise.reject(new Error('Payload too large: ' + sz + ' bytes'));
  }
  if (sz > 800 * 1024) {
    console.warn('[firestore] Payload ' + (sz / 1024).toFixed(0) + ' KB approche la limite 1 MB.');
  }
  const fields = { syncId: { stringValue: sid }, ts: { integerValue: String(ts) } };
  if (compressed) {
    fields.dataCompressed = { stringValue: compressed };
    fields.data = { stringValue: '' };
  } else {
    fields.data = { stringValue: payload };
  }
  const body = { fields };
  return authedFetch(FS_BASE + '/sync/state?key=' + FS_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => {
      if (!r.ok) {
        console.error('[firestore] Save failed: HTTP ' + r.status + ' (payload ' + (sz / 1024).toFixed(0) + ' KB).');
        throw new Error('Firestore save: ' + r.status);
      }
      return r.json();
    })
    .catch((e) => {
      console.error('[firestore] Save error:', e);
      throw e;
    });
}

export function loadFromFirestore() {
  if (isDemoOrNoSync()) return Promise.resolve(null);
  return authedFetch(FS_BASE + '/sync/state?key=' + FS_KEY)
    .then((r) => { if (!r.ok) return null; return r.json(); })
    .then((doc) => {
      if (!doc || !doc.fields) return null;
      if (doc.fields.dataCompressed && doc.fields.dataCompressed.stringValue) {
        try {
          const decompressed = LZString.decompressFromBase64(doc.fields.dataCompressed.stringValue);
          if (decompressed) {
            const parsed = JSON.parse(decompressed);
            _lastRemoteSyncId = doc.fields.syncId ? doc.fields.syncId.stringValue : null;
            console.log('[firestore] Pull WITH aiCache (compressed → ' + (decompressed.length / 1024).toFixed(0) + ' KB).');
            return parsed;
          }
        } catch (e) { console.warn('[firestore] Decompress failed, fallback to data:', e); }
      }
      if (doc.fields.data && doc.fields.data.stringValue) {
        const parsed = JSON.parse(doc.fields.data.stringValue);
        _lastRemoteSyncId = doc.fields.syncId ? doc.fields.syncId.stringValue : null;
        return parsed;
      }
      try {
        const f = doc.fields;
        const legacy = firestoreToJs(f);
        _lastRemoteSyncId = legacy.syncId || null;
        return legacy;
      } catch (e) { console.warn('Legacy parse failed:', e); return null; }
    })
    .catch((e) => { console.error('loadFromFirestore:', e); return null; });
}

export function firestoreToJs(fields) {
  const result = {};
  for (const k in fields) {
    result[k] = fsVal(fields[k]);
  }
  return result;
}

export function fsVal(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.mapValue) return firestoreToJs(v.mapValue.fields || {});
  if (v.arrayValue) return (v.arrayValue.values || []).map(fsVal);
  return null;
}

export function pollRemoteSyncId() {
  if (isDemoOrNoSync()) return Promise.resolve(null);
  return authedFetch(FS_BASE + '/sync/state?key=' + FS_KEY + '&mask.fieldPaths=syncId&mask.fieldPaths=ts')
    .then((r) => { if (!r.ok) return null; return r.json(); })
    .then((doc) => {
      if (!doc || !doc.fields || !doc.fields.syncId) return null;
      return doc.fields.syncId.stringValue;
    })
    .catch(() => null);
}

export function loadSharedKey() {
  if (isDemoOrNoSync()) return Promise.resolve();
  return authedFetch(FS_BASE + '/config/apikeys?key=' + FS_KEY)
    .then((r) => { if (!r.ok) return; return r.json(); })
    .then((doc) => { if (doc && doc.fields && doc.fields.gemini) setSharedGeminiKey(doc.fields.gemini.stringValue); })
    .catch(() => {});
}

export function saveSharedKey(key) {
  if (isDemoOrNoSync()) return Promise.resolve();
  const body = { fields: { gemini: { stringValue: key } } };
  return authedFetch(FS_BASE + '/config/apikeys?key=' + FS_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
}
