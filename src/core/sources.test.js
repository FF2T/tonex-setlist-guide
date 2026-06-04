// Tests Phase 5 (Item F) — constantes SOURCE_LABELS / BADGES / INFO.

import { describe, test, expect } from 'vitest';
import {
  SOURCE_IDS, SOURCE_LABELS, SOURCE_BADGES, SOURCE_INFO,
  getSourceBadge, getSourceInfo, isSourceAvailable,
  cascadeAvailableSources, DEVICE_ENABLES_SOURCES,
  DEVICE_DISABLES_SOURCES, SOURCE_REQUIRES_DEVICE,
  effectiveAvailableSources, isRequiredDeviceMissing,
} from './sources.js';

describe('SOURCE_IDS — liste canonique', () => {
  test('contient les 14 sources connues (Phase ToneX One+ : OnePlusFactory ajouté)', () => {
    expect(SOURCE_IDS).toEqual([
      'TSR', 'ML', 'AA', 'JS', 'TJ', 'WT', 'Galtone',
      'Anniversary', 'Factory', 'FactoryV1', 'PlugFactory', 'OnePlusFactory', 'ToneNET', 'custom',
    ]);
  });
  test('contient les sources pack creators Phase 7.67', () => {
    expect(SOURCE_IDS).toContain('AA');
    expect(SOURCE_IDS).toContain('JS');
    expect(SOURCE_IDS).toContain('TJ');
    expect(SOURCE_IDS).toContain('WT');
    expect(SOURCE_IDS).toContain('Galtone');
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
    // Phase 7.76 — label révisé sans "Pack 64 Studio Rats"
    expect(getSourceInfo({ src: 'TSR' })).toEqual({
      icon: '📦', label: 'The Studio Rats',
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

describe('Phase 7.74.10 — cascade availableSources au toggle device', () => {
  test('mappings device → sources cohérents (ON ⊆ OFF)', () => {
    for (const deviceId of Object.keys(DEVICE_ENABLES_SOURCES)) {
      const onSrcs = DEVICE_ENABLES_SOURCES[deviceId];
      const offSrcs = DEVICE_DISABLES_SOURCES[deviceId];
      // Toutes les sources cochées à l'ON doivent être décochées à l'OFF.
      for (const src of onSrcs) {
        expect(offSrcs).toContain(src);
      }
    }
  });

  test('SOURCE_REQUIRES_DEVICE cohérent avec DEVICE_DISABLES_SOURCES', () => {
    // Si une source est dans DEVICE_DISABLES_SOURCES[device], alors
    // SOURCE_REQUIRES_DEVICE[source] inclut device (string OU array any-of).
    for (const [deviceId, srcs] of Object.entries(DEVICE_DISABLES_SOURCES)) {
      for (const src of srcs) {
        expect([].concat(SOURCE_REQUIRES_DEVICE[src])).toContain(deviceId);
      }
    }
  });

  test('cascade tonex-pedal ON → Factory: true, FactoryV1 inchangé', () => {
    const before = { Factory: false, FactoryV1: false, TSR: true };
    const after = cascadeAvailableSources(before, 'tonex-pedal', true);
    expect(after).toEqual({ Factory: true, FactoryV1: false, TSR: true });
  });

  test('cascade tonex-pedal OFF → Factory ET FactoryV1 à false', () => {
    const before = { Factory: true, FactoryV1: true, TSR: true };
    const after = cascadeAvailableSources(before, 'tonex-pedal', false);
    expect(after).toEqual({ Factory: false, FactoryV1: false, TSR: true });
  });

  test('cascade tonex-anniversary ON → Anniversary: true', () => {
    const before = { Anniversary: false, TSR: true };
    const after = cascadeAvailableSources(before, 'tonex-anniversary', true);
    expect(after).toEqual({ Anniversary: true, TSR: true });
  });

  test('cascade tonex-anniversary OFF → Anniversary: false', () => {
    const before = { Anniversary: true, TSR: true };
    const after = cascadeAvailableSources(before, 'tonex-anniversary', false);
    expect(after).toEqual({ Anniversary: false, TSR: true });
  });

  test('cascade tonex-plug ON → PlugFactory: true', () => {
    const before = { PlugFactory: false };
    const after = cascadeAvailableSources(before, 'tonex-plug', true);
    expect(after).toEqual({ PlugFactory: true });
  });

  test('cascade tonex-plug OFF → PlugFactory: false', () => {
    const before = { PlugFactory: true };
    const after = cascadeAvailableSources(before, 'tonex-plug', false);
    expect(after).toEqual({ PlugFactory: false });
  });

  test('device inconnu (tonemaster-pro) → availableSources inchangé', () => {
    const before = { Factory: true, Anniversary: true };
    const after = cascadeAvailableSources(before, 'tonemaster-pro', true);
    expect(after).toEqual(before);
  });

  test('availableSources null/undefined → retourne {} (toggle device inconnu) ou obj cohérent', () => {
    expect(cascadeAvailableSources(null, 'tonemaster-pro', true)).toEqual({});
    expect(cascadeAvailableSources(undefined, 'tonemaster-pro', true)).toEqual({});
  });

  test('availableSources null + cascade pedal ON → {Factory: true}', () => {
    const after = cascadeAvailableSources(null, 'tonex-pedal', true);
    expect(after).toEqual({ Factory: true });
  });

  test('identité préservée si aucun changement effectif (perf)', () => {
    // Déjà à la valeur cible → même référence retournée
    const before = { Factory: true, FactoryV1: false };
    const after = cascadeAvailableSources(before, 'tonex-pedal', true);
    expect(after).toBe(before);
  });

  test('scénario bug Sébastien (24/05) : Factory: true polluant + tonex-pedal non activé → OFF cascade cleanup', () => {
    // État pollué observé : Factory: true alors que tonex-pedal pas activé.
    // Au prochain toggle device, si user décoche tonex-pedal (déjà décoché
    // techniquement, mais simule "user toggle"), la cascade nettoie.
    // Ce test simule plutôt : user toggle tonex-pedal OFF (avant: ON),
    // cascade décoche Factory + FactoryV1.
    const polluted = { Factory: true, FactoryV1: true, Anniversary: true };
    const cleaned = cascadeAvailableSources(polluted, 'tonex-pedal', false);
    expect(cleaned.Factory).toBe(false);
    expect(cleaned.FactoryV1).toBe(false);
    expect(cleaned.Anniversary).toBe(true); // pas touché
  });
});

// Phase 9.7.43 — effectiveAvailableSources (device-gated)
describe('effectiveAvailableSources — Phase 9.7.43 (device-gated)', () => {
  test('scénario bug Optimiseur (03/06) : Anniversary-only, Factory true → forcé false', () => {
    // Sébastien : enabledDevices = anniversary + plug, PAS tonex-pedal.
    // availableSources.Factory = true (jamais décoché car jamais activé).
    const raw = { Factory: true, Anniversary: true, PlugFactory: true, TSR: true };
    const eff = effectiveAvailableSources(raw, ['tonex-anniversary', 'tonex-plug']);
    expect(eff.Factory).toBe(false);      // device requis (tonex-pedal) absent
    expect(eff.FactoryV1).toBe(false);    // idem (forcé même si absent du raw)
    expect(eff.Anniversary).toBe(true);   // device présent → préservé
    expect(eff.PlugFactory).toBe(true);   // device présent → préservé
    expect(eff.TSR).toBe(true);           // pas de device requis → intact
  });

  test('Factory undefined + tonex-pedal absent → forcé false (le cas réel : jamais coché)', () => {
    const raw = { Anniversary: true };
    const eff = effectiveAvailableSources(raw, ['tonex-anniversary']);
    expect(eff.Factory).toBe(false);
    expect(eff.FactoryV1).toBe(false);
    expect(eff.PlugFactory).toBe(false);
  });

  test('tonex-pedal activé → Factory respecte la valeur user (true)', () => {
    const raw = { Factory: true };
    const eff = effectiveAvailableSources(raw, ['tonex-pedal']);
    expect(eff.Factory).toBe(true);
  });

  test('tonex-pedal activé mais Factory user-décoché → reste false', () => {
    const raw = { Factory: false };
    const eff = effectiveAvailableSources(raw, ['tonex-pedal']);
    expect(eff.Factory).toBe(false);
  });

  test('identité préservée si aucun device manquant ne change une source (perf)', () => {
    // Tous les devices présents → rien à forcer.
    const raw = { Factory: true, Anniversary: true, PlugFactory: true, OnePlusFactory: true };
    const eff = effectiveAvailableSources(raw, ['tonex-pedal', 'tonex-anniversary', 'tonex-plug', 'tonex-one-plus']);
    expect(eff).toBe(raw);
  });

  test('identité préservée si les sources device-gated sont déjà false', () => {
    const raw = { Factory: false, FactoryV1: false, Anniversary: false, PlugFactory: false, OnePlusFactory: false };
    const eff = effectiveAvailableSources(raw, []);
    expect(eff).toBe(raw);
  });

  test('enabledDevices absent/non-array → traité comme aucun device (tout device-gated forcé false)', () => {
    expect(effectiveAvailableSources({ Factory: true }, undefined).Factory).toBe(false);
    expect(effectiveAvailableSources({ Factory: true }, null).Factory).toBe(false);
  });

  test('availableSources null/undefined → pas de crash, force les sources device-gated absentes', () => {
    // null + tonex-pedal seul → Anniversary, PlugFactory, OnePlusFactory (devices absents) forcés false
    expect(effectiveAvailableSources(null, ['tonex-pedal'])).toEqual({
      Anniversary: false, PlugFactory: false, OnePlusFactory: false,
    });
    // undefined + aucun device → les 5 sources device-gated forcées false
    expect(effectiveAvailableSources(undefined, [])).toEqual({
      Anniversary: false, Factory: false, FactoryV1: false, PlugFactory: false, OnePlusFactory: false,
    });
  });

  test('sources sans device requis (TSR, ML, ToneNET, custom) jamais touchées', () => {
    const raw = { TSR: true, ML: false, ToneNET: true, custom: true };
    const eff = effectiveAvailableSources(raw, []);
    expect(eff.TSR).toBe(true);
    expect(eff.ML).toBe(false);
    expect(eff.ToneNET).toBe(true);
    expect(eff.custom).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase ToneX One / One+ — source Factory partagée (any-of) + OnePlusFactory
// ───────────────────────────────────────────────────────────────────

describe('ToneX One / One+ — sources device-gated any-of', () => {
  test('OnePlusFactory dans SOURCE_IDS + labels/badges/info/requires', () => {
    expect(SOURCE_IDS).toContain('OnePlusFactory');
    expect(SOURCE_REQUIRES_DEVICE.OnePlusFactory).toBe('tonex-one-plus');
  });

  test('Factory requires any-of [tonex-pedal, tonex-one]', () => {
    expect(SOURCE_REQUIRES_DEVICE.Factory).toEqual(['tonex-pedal', 'tonex-one']);
  });

  test('isRequiredDeviceMissing — Factory dispo si tonex-one seul (sans pédale)', () => {
    expect(isRequiredDeviceMissing('Factory', ['tonex-one'])).toBe(false);
    expect(isRequiredDeviceMissing('Factory', ['tonex-pedal'])).toBe(false);
    expect(isRequiredDeviceMissing('Factory', ['tonex-pedal', 'tonex-one'])).toBe(false);
  });

  test('isRequiredDeviceMissing — Factory manquant si ni pédale ni one', () => {
    expect(isRequiredDeviceMissing('Factory', ['tonex-anniversary', 'tonex-plug'])).toBe(true);
    expect(isRequiredDeviceMissing('Factory', [])).toBe(true);
  });

  test('isRequiredDeviceMissing — OnePlusFactory string 1:1', () => {
    expect(isRequiredDeviceMissing('OnePlusFactory', ['tonex-one-plus'])).toBe(false);
    expect(isRequiredDeviceMissing('OnePlusFactory', ['tonex-one'])).toBe(true);
  });

  test('isRequiredDeviceMissing — source sans device requis → jamais manquant', () => {
    expect(isRequiredDeviceMissing('TSR', [])).toBe(false);
    expect(isRequiredDeviceMissing('custom', [])).toBe(false);
  });

  test('effectiveAvailableSources — One seul : Factory NON forcé false (any-of)', () => {
    const eff = effectiveAvailableSources({ Factory: true }, ['tonex-one']);
    expect(eff.Factory).toBe(true);
    // FactoryV1 (requiert tonex-pedal strict) reste forcé false
    expect(eff.FactoryV1).toBe(false);
  });

  test('effectiveAvailableSources — One+ : OnePlusFactory dispo, Factory forcé false', () => {
    const eff = effectiveAvailableSources({ Factory: true, OnePlusFactory: true }, ['tonex-one-plus']);
    expect(eff.OnePlusFactory).toBe(true);
    expect(eff.Factory).toBe(false); // ni pédale ni one
  });

  test('cascade tonex-one toggle → ne touche PAS Factory (partagé pédale)', () => {
    const before = { Factory: true, OnePlusFactory: false };
    expect(cascadeAvailableSources(before, 'tonex-one', false)).toBe(before);
    expect(cascadeAvailableSources(before, 'tonex-one', true)).toBe(before);
  });

  test('cascade tonex-one-plus ON/OFF → OnePlusFactory', () => {
    expect(cascadeAvailableSources({ OnePlusFactory: false }, 'tonex-one-plus', true)).toEqual({ OnePlusFactory: true });
    expect(cascadeAvailableSources({ OnePlusFactory: true }, 'tonex-one-plus', false)).toEqual({ OnePlusFactory: false });
  });
});
