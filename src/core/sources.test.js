// Tests Phase 5 (Item F) — constantes SOURCE_LABELS / BADGES / INFO.

import { describe, test, expect } from 'vitest';
import {
  SOURCE_IDS, SOURCE_LABELS, SOURCE_BADGES, SOURCE_INFO,
  getSourceBadge, getSourceInfo, isSourceAvailable,
} from './sources.js';

describe('SOURCE_IDS — liste canonique', () => {
  test('contient les 7 sources connues', () => {
    expect(SOURCE_IDS).toEqual([
      'TSR', 'ML', 'Anniversary', 'Factory', 'PlugFactory', 'ToneNET', 'custom',
    ]);
  });
});

describe('SOURCE_LABELS — long form', () => {
  test('chaque source id a un label long', () => {
    SOURCE_IDS.forEach((id) => {
      expect(typeof SOURCE_LABELS[id]).toBe('string');
      expect(SOURCE_LABELS[id].length).toBeGreaterThan(0);
    });
  });
  test('Anniversary distinct de Factory (Phase 5.12 — refonte labels)', () => {
    expect(SOURCE_LABELS.Anniversary).not.toBe(SOURCE_LABELS.Factory);
    expect(SOURCE_LABELS.Anniversary).toContain('Anniversary');
    // Phase 5.12 : le label Factory ne contient plus "Factory" pour éviter
    // la confusion avec le device. Il utilise "classique" pour distinguer
    // de l'Anniversary.
    expect(SOURCE_LABELS.Factory).toContain('classique');
  });
});

describe('SOURCE_BADGES — short form ≤ 8 chars', () => {
  test('chaque badge ≤ 8 chars', () => {
    SOURCE_IDS.forEach((id) => {
      expect(SOURCE_BADGES[id].length).toBeLessThanOrEqual(8);
    });
  });
  test('Anniversary → "Pédale" (legacy)', () => {
    expect(SOURCE_BADGES.Anniversary).toBe('Pédale');
  });
});

describe('getSourceBadge', () => {
  test('source connue → badge', () => {
    expect(getSourceBadge('TSR')).toBe('TSR');
    expect(getSourceBadge('Anniversary')).toBe('Pédale');
  });
  test('source inconnue → ""', () => {
    expect(getSourceBadge('Wahwah')).toBe('');
    expect(getSourceBadge(null)).toBe('');
    expect(getSourceBadge(undefined)).toBe('');
  });
});

describe('getSourceInfo', () => {
  test('TSR sans pack → label générique', () => {
    expect(getSourceInfo({ src: 'TSR' })).toEqual({
      icon: '📦', label: 'Pack 64 Studio Rats (zip)',
    });
  });
  test('TSR avec pack → label inclut le nom du pack', () => {
    expect(getSourceInfo({ src: 'TSR', pack: 'British Lead' }).label).toContain('British Lead');
  });
  test('custom avec pack → "Custom — pack"', () => {
    expect(getSourceInfo({ src: 'custom', pack: 'My collection' }).label).toBe('Custom — My collection');
  });
  test('source inconnue → fallback "📁 src"', () => {
    expect(getSourceInfo({ src: 'Mystery' })).toEqual({ icon: '📁', label: 'Mystery' });
  });
  test('entry null/sans src → null', () => {
    expect(getSourceInfo(null)).toBe(null);
    expect(getSourceInfo({})).toBe(null);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 5.6 — isSourceAvailable (filtre profile.availableSources)
// ───────────────────────────────────────────────────────────────────

describe('isSourceAvailable — Phase 5.6', () => {
  test('source explicitement true → autorisée', () => {
    expect(isSourceAvailable('TSR', { TSR: true })).toBe(true);
    expect(isSourceAvailable('Factory', { Factory: true, TSR: true })).toBe(true);
  });

  test('source explicitement false → bloquée', () => {
    expect(isSourceAvailable('Factory', { Factory: false })).toBe(false);
    expect(isSourceAvailable('Factory', { Factory: false, TSR: true })).toBe(false);
  });

  test('source absente d\'availableSources → autorisée (permissif par défaut)', () => {
    expect(isSourceAvailable('PlugFactory', { TSR: true })).toBe(true);
    expect(isSourceAvailable('Custom', {})).toBe(true);
  });

  test('availableSources null/undefined → autorisée (fallback profil stale)', () => {
    expect(isSourceAvailable('Factory', null)).toBe(true);
    expect(isSourceAvailable('Factory', undefined)).toBe(true);
  });

  test('srcId vide → autorisée (preset sans src n\'est jamais bloqué)', () => {
    expect(isSourceAvailable(null, { TSR: false })).toBe(true);
    expect(isSourceAvailable('', { TSR: false })).toBe(true);
  });

  test('scenario bug rapporté Phase 5.6 : Sébastien Factory=false', () => {
    const sebastienSources = {
      TSR: true, ML: true, Anniversary: true, Factory: false, ToneNET: true,
    };
    expect(isSourceAvailable('Factory', sebastienSources)).toBe(false);
    expect(isSourceAvailable('TSR', sebastienSources)).toBe(true);
    expect(isSourceAvailable('Anniversary', sebastienSources)).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 5.6 — simulation du filtre dans BankOptimizerScreen.analyzeDevice
// ───────────────────────────────────────────────────────────────────

describe('Phase 5.6 — filtre catalogue selon availableSources (régression)', () => {
  // Reproduit la logique de la boucle ligne 3942-3947 (main.jsx)
  // après le fix : un preset n'entre dans allCandidates que si
  // availableSources autorise sa src.
  function filterCatalog(catalog, availableSources) {
    const out = [];
    for (const [pName, pInfo] of Object.entries(catalog)) {
      if (!pInfo || !pInfo.amp) continue;
      if (pInfo.src && availableSources && availableSources[pInfo.src] === false) continue;
      out.push({ name: pName, src: pInfo.src, amp: pInfo.amp });
    }
    return out;
  }

  const SAMPLE_CATALOG = {
    'VOWELS': { src: 'Factory', amp: 'Custom Amp', gain: 'high' },
    'TSR Mars 800SL Drive': { src: 'TSR', amp: 'Marshall JCM800', gain: 'mid' },
    'AA MRSH SL100 JU Dimed BAL CAB': { src: 'Anniversary', amp: 'Marshall Super Lead', gain: 'high' },
    'ML MARS 800 Clean': { src: 'ML', amp: 'Marshall JCM800', gain: 'low' },
    'ToneNET shared preset': { src: 'ToneNET', amp: 'Mesa Mark', gain: 'mid' },
  };

  test('Sébastien profile (Factory=false) → "VOWELS" exclue', () => {
    const sebastienSources = {
      TSR: true, ML: true, Anniversary: true, Factory: false, ToneNET: true,
    };
    const filtered = filterCatalog(SAMPLE_CATALOG, sebastienSources);
    const names = filtered.map((p) => p.name);
    expect(names).not.toContain('VOWELS');
    expect(names).toContain('TSR Mars 800SL Drive');
    expect(names).toContain('AA MRSH SL100 JU Dimed BAL CAB');
    expect(names).toContain('ML MARS 800 Clean');
  });

  test('Toutes sources désactivées → catalogue filtré vide', () => {
    const noSources = {
      TSR: false, ML: false, Anniversary: false, Factory: false, ToneNET: false,
    };
    const filtered = filterCatalog(SAMPLE_CATALOG, noSources);
    expect(filtered).toEqual([]);
  });

  test("TSR + Anniversary uniquement → exclut Factory, ML, ToneNET", () => {
    const partial = {
      TSR: true, Anniversary: true,
      ML: false, Factory: false, ToneNET: false,
    };
    const filtered = filterCatalog(SAMPLE_CATALOG, partial);
    const names = filtered.map((p) => p.name);
    expect(names).toEqual(['TSR Mars 800SL Drive', 'AA MRSH SL100 JU Dimed BAL CAB']);
  });

  test('availableSources undefined → catalogue entier (régression : profil sans config)', () => {
    const filtered = filterCatalog(SAMPLE_CATALOG, undefined);
    expect(filtered).toHaveLength(5);
  });

  test('availableSources avec toutes les sources true → comportement identique à undefined', () => {
    const allOn = {
      TSR: true, ML: true, Anniversary: true, Factory: true, ToneNET: true,
    };
    const filtered = filterCatalog(SAMPLE_CATALOG, allOn);
    expect(filtered).toHaveLength(5);
  });
});
