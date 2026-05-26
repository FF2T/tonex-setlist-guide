// src/app/utils/merge-debug-logger.js — Phase 7.74.5.
//
// Wrapper console.warn/log persistant pour observer en différé les
// logs forensiques du merge LWW Firestore. Survit aux reloads de
// l'app (logs stockés dans localStorage).
//
// Activation côté user (admin) :
//   localStorage.__backline_persist_logs = 'true';
//   // Puis reload. À partir de là, chaque [merge*] ou SUSPECT est
//   // persisté dans localStorage.__backline_merge_logs (max 50).
//
// Consultation :
//   window.__getMergeDebugLogs()
//
// Reset :
//   window.__clearMergeDebugLogs()
//
// Désactivation :
//   localStorage.removeItem('__backline_persist_logs');
//   // Puis reload.

const LOGS_KEY = '__backline_merge_logs';
const FLAG_KEY = '__backline_persist_logs';
const MAX_LOGS = 50;

function isPersistLoggerActive() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

function shouldPersistMessage(msg) {
  if (!msg || typeof msg !== 'string') return false;
  // Phase 7.74.11 — capture aussi les logs `[firestore] Pulled from
  // device` qui contiennent le fingerprint du device qui a poussé le
  // remote. Permet à l'admin de retracer qui pousse quoi via
  // window.__getMergeDebugLogs() même après plusieurs reloads.
  return msg.includes('[merge') || msg.includes('SUSPECT') || msg.includes('[firestore] Pulled from device');
}

function persistLog(level, msg) {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOGS_KEY) || '[]';
    const logs = JSON.parse(raw);
    logs.push({ ts: new Date().toISOString(), level, msg });
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch {
    // localStorage full ou corrompu — fail silently
  }
}

function getMergeDebugLogs() {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
  } catch {
    return [];
  }
}

function clearMergeDebugLogs() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LOGS_KEY);
  } catch {}
}

// Installs the persistent logger on top of console.warn/log. Idempotent
// (safe to call twice). Has no effect if FLAG_KEY is not true.
function installPersistLogger() {
  if (typeof console === 'undefined') return false;
  if (!isPersistLoggerActive()) return false;
  // Guard against double-install
  if (console._backlineLoggerInstalled) return true;

  const origWarn = console.warn.bind(console);
  const origLog = console.log.bind(console);

  console.warn = function backlineWarn(...args) {
    const msg = args.map((a) => typeof a === 'string' ? a : (() => {
      try { return JSON.stringify(a); } catch { return String(a); }
    })()).join(' ');
    if (shouldPersistMessage(msg)) persistLog('warn', msg);
    origWarn(...args);
  };

  console.log = function backlineLog(...args) {
    const msg = args.map((a) => typeof a === 'string' ? a : (() => {
      try { return JSON.stringify(a); } catch { return String(a); }
    })()).join(' ');
    if (shouldPersistMessage(msg)) persistLog('log', msg);
    origLog(...args);
  };

  console._backlineLoggerInstalled = true;

  // Expose helpers on window for easy console access
  if (typeof window !== 'undefined') {
    window.__getMergeDebugLogs = getMergeDebugLogs;
    window.__clearMergeDebugLogs = clearMergeDebugLogs;
  }

  // Active aussi le merge debug si pas déjà
  if (typeof window !== 'undefined' && !window.__BACKLINE_MERGE_DEBUG) {
    window.__BACKLINE_MERGE_DEBUG = true;
  }

  origLog(`✅ [Backline] Persistent merge logger active. Use window.__getMergeDebugLogs() to view, window.__clearMergeDebugLogs() to reset.`);

  return true;
}

export {
  installPersistLogger,
  getMergeDebugLogs,
  clearMergeDebugLogs,
  isPersistLoggerActive,
  shouldPersistMessage,
  LOGS_KEY,
  FLAG_KEY,
  MAX_LOGS,
};
