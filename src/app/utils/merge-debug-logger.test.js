// Tests Phase 7.74.5 — merge-debug-logger (helpers purs).

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPersistLoggerActive,
  shouldPersistMessage,
  getMergeDebugLogs,
  clearMergeDebugLogs,
  LOGS_KEY,
  FLAG_KEY,
  MAX_LOGS,
} from './merge-debug-logger.js';

describe('shouldPersistMessage', () => {
  test('match [merge', () => {
    expect(shouldPersistMessage('[merge-defense] suspect drop')).toBe(true);
    expect(shouldPersistMessage('[merge] adopting remote myGuitars')).toBe(true);
  });

  test('match SUSPECT', () => {
    expect(shouldPersistMessage('Block SUSPECT swap detected')).toBe(true);
  });

  test('rejette non-match', () => {
    expect(shouldPersistMessage('Regular console output')).toBe(false);
    expect(shouldPersistMessage('')).toBe(false);
    expect(shouldPersistMessage(null)).toBe(false);
    expect(shouldPersistMessage(undefined)).toBe(false);
    expect(shouldPersistMessage(123)).toBe(false);
  });
});

describe('isPersistLoggerActive / getMergeDebugLogs / clearMergeDebugLogs', () => {
  let store;
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => (k in store ? store[k] : null)),
      setItem: vi.fn((k, v) => { store[k] = String(v); }),
      removeItem: vi.fn((k) => { delete store[k]; }),
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  test('isPersistLoggerActive : false par défaut', () => {
    expect(isPersistLoggerActive()).toBe(false);
  });

  test('isPersistLoggerActive : true si flag === "true"', () => {
    store[FLAG_KEY] = 'true';
    expect(isPersistLoggerActive()).toBe(true);
  });

  test('isPersistLoggerActive : false si flag === "false" ou autre', () => {
    store[FLAG_KEY] = 'false';
    expect(isPersistLoggerActive()).toBe(false);
    store[FLAG_KEY] = '1';
    expect(isPersistLoggerActive()).toBe(false);
  });

  test('getMergeDebugLogs : [] par défaut', () => {
    expect(getMergeDebugLogs()).toEqual([]);
  });

  test('getMergeDebugLogs : retourne le tableau parsé', () => {
    const logs = [{ ts: '2026-05-19T18:00:00Z', level: 'warn', msg: '[merge] test' }];
    store[LOGS_KEY] = JSON.stringify(logs);
    expect(getMergeDebugLogs()).toEqual(logs);
  });

  test('clearMergeDebugLogs retire la clé', () => {
    store[LOGS_KEY] = '[{"ts":"x","level":"warn","msg":"y"}]';
    clearMergeDebugLogs();
    expect(store[LOGS_KEY]).toBeUndefined();
  });

  test('parsing fail → []', () => {
    store[LOGS_KEY] = 'invalid json{';
    expect(getMergeDebugLogs()).toEqual([]);
  });
});

describe('Constantes', () => {
  test('MAX_LOGS = 50', () => {
    expect(MAX_LOGS).toBe(50);
  });
  test('clés localStorage stables', () => {
    expect(LOGS_KEY).toBe('__backline_merge_logs');
    expect(FLAG_KEY).toBe('__backline_persist_logs');
  });
});
