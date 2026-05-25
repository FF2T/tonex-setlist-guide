// src/app/utils/ai-error-helper.test.js — Phase 7.55.7 S7.

import { describe, it, expect } from 'vitest';
import { classifyAIError, getAIErrorMessage } from './ai-error-helper.js';

describe('classifyAIError', () => {
  describe('quota detection', () => {
    it('scénario user 25/05 : "monthly spending cap"', () => {
      const msg = 'Your project has exceeded its monthly spending cap. Please go to AI Studio at https://ai.studio/spend to manage your project spend cap.';
      expect(classifyAIError(new Error(msg))).toBe('quota');
    });
    it('détecte "rate limit"', () => {
      expect(classifyAIError(new Error('Rate limit exceeded'))).toBe('quota');
    });
    it('détecte "RESOURCE_EXHAUSTED"', () => {
      expect(classifyAIError(new Error('RESOURCE_EXHAUSTED: quota exceeded'))).toBe('quota');
    });
    it('détecte HTTP 429', () => {
      expect(classifyAIError(new Error('Request failed with status code 429'))).toBe('quota');
    });
    it('détecte "quota exceeded" générique', () => {
      expect(classifyAIError(new Error('Daily quota exceeded'))).toBe('quota');
    });
  });

  describe('auth detection', () => {
    it('détecte "API key not valid"', () => {
      expect(classifyAIError(new Error('API key not valid. Please pass a valid API key.'))).toBe('auth');
    });
    it('détecte "API_KEY_INVALID"', () => {
      expect(classifyAIError(new Error('API_KEY_INVALID'))).toBe('auth');
    });
    it('détecte HTTP 401', () => {
      expect(classifyAIError(new Error('HTTP 401 Unauthorized'))).toBe('auth');
    });
    it('détecte HTTP 403', () => {
      expect(classifyAIError(new Error('403 Forbidden'))).toBe('auth');
    });
    it('détecte "INVALID_ARGUMENT" + "API key" → auth', () => {
      expect(classifyAIError(new Error('INVALID_ARGUMENT: API key not valid'))).toBe('auth');
    });
  });

  describe('safety detection', () => {
    it('détecte "blocked due to safety"', () => {
      expect(classifyAIError(new Error('Response blocked due to safety settings'))).toBe('safety');
    });
    it('détecte "SAFETY"', () => {
      expect(classifyAIError(new Error('Generation stopped: SAFETY'))).toBe('safety');
    });
  });

  describe('parse detection', () => {
    it('détecte "JSON"', () => {
      expect(classifyAIError(new Error('Unable to parse JSON response'))).toBe('parse');
    });
    it('détecte "unexpected token"', () => {
      expect(classifyAIError(new Error('Unexpected token } in JSON at position 42'))).toBe('parse');
    });
  });

  describe('network detection', () => {
    it('détecte "Failed to fetch"', () => {
      expect(classifyAIError(new Error('Failed to fetch'))).toBe('network');
    });
    it('détecte "NetworkError"', () => {
      expect(classifyAIError(new Error('NetworkError when attempting to fetch resource'))).toBe('network');
    });
    it('détecte timeout', () => {
      expect(classifyAIError(new Error('Request timeout after 30s'))).toBe('network');
    });
  });

  describe('unknown fallback', () => {
    it('null / undefined / vide → unknown', () => {
      expect(classifyAIError(null)).toBe('unknown');
      expect(classifyAIError(undefined)).toBe('unknown');
      expect(classifyAIError('')).toBe('unknown');
      expect(classifyAIError(new Error())).toBe('unknown');
    });
    it('message générique → unknown', () => {
      expect(classifyAIError(new Error('Something weird happened'))).toBe('unknown');
    });
  });

  describe('accepte string ou Error', () => {
    it('string direct → classifie', () => {
      expect(classifyAIError('Rate limit exceeded')).toBe('quota');
    });
    it('objet { message } → classifie', () => {
      expect(classifyAIError({ message: 'Failed to fetch' })).toBe('network');
    });
  });
});

describe('getAIErrorMessage', () => {
  it('scénario user 25/05 → FR avec hints + learnMoreUrl', () => {
    const msg = 'Your project has exceeded its monthly spending cap. Please go to AI Studio at https://ai.studio/spend to manage your project spend cap.';
    const result = getAIErrorMessage(new Error(msg), 'fr');
    expect(result.kind).toBe('quota');
    expect(result.icon).toBe('🤖');
    expect(result.title).toContain('quota');
    expect(result.hints).toBeInstanceOf(Array);
    expect(result.hints.length).toBeGreaterThan(0);
    expect(result.learnMoreUrl).toContain('ai.google.dev');
    expect(result.rawMessage).toBe(msg);
  });

  it('quota en EN', () => {
    const result = getAIErrorMessage(new Error('Rate limit exceeded'), 'en');
    expect(result.kind).toBe('quota');
    expect(result.title).toMatch(/quota|reached/i);
    expect(result.hints[0]).toMatch(/Configure|profile/i);
  });

  it('quota en ES', () => {
    const result = getAIErrorMessage(new Error('Rate limit exceeded'), 'es');
    expect(result.kind).toBe('quota');
    expect(result.title).toMatch(/cuota/i);
  });

  it('auth en FR', () => {
    const result = getAIErrorMessage(new Error('API key not valid'), 'fr');
    expect(result.kind).toBe('auth');
    expect(result.icon).toBe('🔑');
    expect(result.learnMoreUrl).toContain('api-key');
  });

  it('network en FR sans learnMoreUrl', () => {
    const result = getAIErrorMessage(new Error('Failed to fetch'), 'fr');
    expect(result.kind).toBe('network');
    expect(result.icon).toBe('📡');
    expect(result.learnMoreUrl).toBeUndefined();
  });

  it('unknown fallback FR', () => {
    const result = getAIErrorMessage(new Error('Mystery error'), 'fr');
    expect(result.kind).toBe('unknown');
    expect(result.icon).toBe('⚠️');
    expect(result.rawMessage).toBe('Mystery error');
  });

  it('locale invalide → fallback FR', () => {
    const result = getAIErrorMessage(new Error('Rate limit exceeded'), 'zh');
    expect(result.title).toMatch(/quota/i);
  });

  it('rawMessage capture le message brut pour debug', () => {
    const msg = 'Specific Gemini error xyz';
    const result = getAIErrorMessage(new Error(msg), 'fr');
    expect(result.rawMessage).toBe(msg);
  });

  it('string err direct → fonctionne', () => {
    const result = getAIErrorMessage('Failed to fetch', 'fr');
    expect(result.kind).toBe('network');
    expect(result.rawMessage).toBe('Failed to fetch');
  });
});
