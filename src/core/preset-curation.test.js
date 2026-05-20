// Tests Phase 7.77 — preset-curation helpers (résolution rouges + curation oranges).

import { describe, test, expect } from 'vitest';
import {
  detectPresetsByStatus,
  detectUnknownsInBanks,
  detectNonCuratedInBanks,
  detectAllNonCurated,
  EDITABLE_SOURCES,
  applyResolutionsToBanks,
  saveUsagesForPreset,
  removeUsagesOverride,
} from './preset-curation.js';

// Noms catalog "known" connus → status='known' (sans usages).
// "HG 800" est dans Factory (firmware v2) sans usages → known.
// "Some Random Name Xyz123" → unknown (fallback guessPresetInfo).
const KNOWN_NAME = 'HG 800';
const UNKNOWN_NAME = 'Wahwah ZZZ Garbage';
const UNKNOWN_NAME_2 = 'Another Unknown XYZ';

describe('detectPresetsByStatus', () => {
  test('détecte les noms par status spécifié', () => {
    const banks = {
      1: { A: KNOWN_NAME, B: UNKNOWN_NAME, C: '' },
      2: { A: UNKNOWN_NAME_2, B: KNOWN_NAME, C: UNKNOWN_NAME },
    };
    const unknowns = detectPresetsByStatus(banks, ['unknown']);
    // UNKNOWN_NAME apparaît 2 fois mais dédupliqué.
    expect(unknowns).toEqual([UNKNOWN_NAME_2, UNKNOWN_NAME].sort((a, b) => a.localeCompare(b)));
  });

  test('accept un Set de statuses', () => {
    const banks = { 1: { A: KNOWN_NAME, B: UNKNOWN_NAME, C: '' } };
    const out = detectPresetsByStatus(banks, new Set(['unknown', 'known']));
    expect(out.sort()).toEqual([KNOWN_NAME, UNKNOWN_NAME].sort());
  });

  test('banks vide → []', () => {
    expect(detectPresetsByStatus({}, ['unknown'])).toEqual([]);
  });

  test('banks null/undefined → []', () => {
    expect(detectPresetsByStatus(null, ['unknown'])).toEqual([]);
    expect(detectPresetsByStatus(undefined, ['unknown'])).toEqual([]);
  });

  test('slots vides ou non-string → ignorés', () => {
    const banks = { 1: { A: '', B: null, C: undefined }, 2: { A: 42 } };
    expect(detectPresetsByStatus(banks, ['unknown'])).toEqual([]);
  });

  test('dédoublonnage + tri alpha', () => {
    const banks = {
      1: { A: 'ZZZ Unknown', B: 'AAA Unknown', C: 'ZZZ Unknown' },
      2: { A: 'AAA Unknown', B: '', C: '' },
    };
    const unknowns = detectPresetsByStatus(banks, ['unknown']);
    expect(unknowns).toEqual(['AAA Unknown', 'ZZZ Unknown']);
  });
});

describe('detectUnknownsInBanks', () => {
  test('helper alias filtre uniquement unknown', () => {
    const banks = { 1: { A: KNOWN_NAME, B: UNKNOWN_NAME, C: '' } };
    expect(detectUnknownsInBanks(banks)).toEqual([UNKNOWN_NAME]);
  });
});

describe('detectNonCuratedInBanks', () => {
  test('helper alias filtre uniquement known (status non-curated)', () => {
    const banks = { 1: { A: KNOWN_NAME, B: UNKNOWN_NAME, C: '' } };
    const out = detectNonCuratedInBanks(banks);
    expect(out).toContain(KNOWN_NAME);
    expect(out).not.toContain(UNKNOWN_NAME);
  });
});

describe('applyResolutionsToBanks', () => {
  test('action remap remplace le slot par target', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: KNOWN_NAME, C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'remap', target: 'TSR Mars 800SL Drive' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe('TSR Mars 800SL Drive');
    expect(out[1].B).toBe(KNOWN_NAME); // intact
    expect(out[1].C).toBe('');
  });

  test('action clear vide le slot', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: KNOWN_NAME, C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'clear' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe('');
  });

  test('action skip laisse intact', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'skip' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe(UNKNOWN_NAME);
    // Pas de modif → retourne la même référence (optim React)
    expect(out).toBe(banks);
  });

  test('preset non listé dans resolutions → intact', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: UNKNOWN_NAME_2, C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'clear' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe('');
    expect(out[1].B).toBe(UNKNOWN_NAME_2);
  });

  test('immutabilité — banks input pas muté', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '' } };
    const original = JSON.parse(JSON.stringify(banks));
    const res = { [UNKNOWN_NAME]: { action: 'clear' } };
    applyResolutionsToBanks(banks, res);
    expect(banks).toEqual(original);
  });

  test('plusieurs résolutions appliquées en une passe', () => {
    const banks = {
      1: { A: UNKNOWN_NAME, B: UNKNOWN_NAME_2, C: '' },
      2: { A: UNKNOWN_NAME, B: '', C: KNOWN_NAME },
    };
    const res = {
      [UNKNOWN_NAME]: { action: 'remap', target: 'TSR Mars 800SL Drive' },
      [UNKNOWN_NAME_2]: { action: 'clear' },
    };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe('TSR Mars 800SL Drive');
    expect(out[1].B).toBe('');
    expect(out[2].A).toBe('TSR Mars 800SL Drive');
    expect(out[2].C).toBe(KNOWN_NAME);
  });

  test('banks null/undefined → retourne tel quel', () => {
    expect(applyResolutionsToBanks(null, {})).toBe(null);
    expect(applyResolutionsToBanks(undefined, {})).toBe(undefined);
  });

  test('resolutions null/undefined → banks inchangé', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '' } };
    expect(applyResolutionsToBanks(banks, null)).toBe(banks);
    expect(applyResolutionsToBanks(banks, undefined)).toBe(banks);
  });

  test('action remap sans target → no-op', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '' } };
    const res = { [UNKNOWN_NAME]: { action: 'remap' } }; // pas de target
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].A).toBe(UNKNOWN_NAME);
  });

  test('préserve les autres champs de bank (cat, etc.)', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '', cat: 'Custom' } };
    const res = { [UNKNOWN_NAME]: { action: 'clear' } };
    const out = applyResolutionsToBanks(banks, res);
    expect(out[1].cat).toBe('Custom');
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.78 — detectAllNonCurated
// ───────────────────────────────────────────────────────────────────

describe('detectAllNonCurated', () => {
  test('EDITABLE_SOURCES contient custom + ToneNET (MVP)', () => {
    expect(EDITABLE_SOURCES.has('custom')).toBe(true);
    expect(EDITABLE_SOURCES.has('ToneNET')).toBe(true);
    expect(EDITABLE_SOURCES.has('TSR')).toBe(false);
    expect(EDITABLE_SOURCES.has('Factory')).toBe(false);
  });

  test('preset known catalog statique → {name, src, editable: false}', () => {
    // HG 800 = Factory v2, sans usages → status='known', src='Factory'
    const banks = { 1: { A: KNOWN_NAME, B: '', C: '' } };
    const out = detectAllNonCurated(banks);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe(KNOWN_NAME);
    expect(out[0].src).toBe('Factory');
    expect(out[0].editable).toBe(false);
  });

  test('unknown preset → exclu (status != known)', () => {
    const banks = { 1: { A: UNKNOWN_NAME, B: '', C: '' } };
    expect(detectAllNonCurated(banks)).toEqual([]);
  });

  test('banks vide / null / undefined → []', () => {
    expect(detectAllNonCurated({})).toEqual([]);
    expect(detectAllNonCurated(null)).toEqual([]);
    expect(detectAllNonCurated(undefined)).toEqual([]);
  });

  test('dédoublonnage par nom + tri alpha', () => {
    const banks = {
      1: { A: KNOWN_NAME, B: '', C: KNOWN_NAME },
      2: { A: KNOWN_NAME, B: '', C: '' },
    };
    const out = detectAllNonCurated(banks);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe(KNOWN_NAME);
  });

  test('slots vides ou non-string → ignorés', () => {
    const banks = { 1: { A: '', B: null, C: undefined } };
    expect(detectAllNonCurated(banks)).toEqual([]);
  });
});

// Phase 7.79.3b — saveUsagesForPreset routing étendu (4 niveaux)
describe('saveUsagesForPreset routing étendu (Phase 7.79.3b)', () => {
  // Helper : capture l'appel et stocke le reducer pour le rejouer
  function captureSetter() {
    const calls = [];
    const setter = (reducer) => { calls.push(reducer); };
    setter.calls = calls;
    return setter;
  }

  test('src=custom → onProfiles avec customPacks (rétro-compat)', () => {
    const onProfiles = captureSetter();
    saveUsagesForPreset('MyCustom', [{ artist: 'A' }], {
      findEntry: () => ({ src: 'custom', guessed: false }),
      activeProfileId: 'p1',
      onProfiles,
      onShared: captureSetter(),
    });
    expect(onProfiles.calls).toHaveLength(1);
    const result = onProfiles.calls[0]({ p1: { customPacks: [{ name: 'P', presets: [{ name: 'MyCustom' }] }] } });
    expect(result.p1.customPacks[0].presets[0].usages).toEqual([{ artist: 'A' }]);
    expect(typeof result.p1.lastModified).toBe('number');
  });

  test('src=ToneNET → onToneNetPresets (rétro-compat)', () => {
    const onToneNetPresets = captureSetter();
    saveUsagesForPreset('MyTN', [{ artist: 'A' }], {
      findEntry: () => ({ src: 'ToneNET', guessed: false }),
      onToneNetPresets,
    });
    expect(onToneNetPresets.calls).toHaveLength(1);
    const result = onToneNetPresets.calls[0]([{ name: 'MyTN' }]);
    expect(result[0].usages).toEqual([{ artist: 'A' }]);
    expect(typeof result[0].lastModified).toBe('number');
  });

  test('catalog statique + admin → shared.usagesOverrides', () => {
    const onShared = captureSetter();
    saveUsagesForPreset('TSR Mars 800SL', [{ artist: 'Iron Maiden' }], {
      findEntry: () => ({ src: 'TSR', guessed: false }),
      isAdmin: true,
      onShared,
    });
    expect(onShared.calls).toHaveLength(1);
    const result = onShared.calls[0]({ usagesOverrides: {} });
    expect(result.usagesOverrides['TSR Mars 800SL'].usages).toEqual([{ artist: 'Iron Maiden' }]);
    expect(typeof result.usagesOverrides['TSR Mars 800SL'].lastModified).toBe('number');
    expect(typeof result.lastModified).toBe('number');
  });

  test('catalog statique + non-admin → profile.usagesOverrides', () => {
    const onProfiles = captureSetter();
    saveUsagesForPreset('TSR Mars 800SL', [{ artist: 'Slash' }], {
      findEntry: () => ({ src: 'TSR', guessed: false }),
      isAdmin: false,
      activeProfileId: 'bruno',
      onProfiles,
    });
    expect(onProfiles.calls).toHaveLength(1);
    const result = onProfiles.calls[0]({ bruno: {} });
    expect(result.bruno.usagesOverrides['TSR Mars 800SL'].usages).toEqual([{ artist: 'Slash' }]);
    expect(typeof result.bruno.usagesOverrides['TSR Mars 800SL'].lastModified).toBe('number');
    expect(typeof result.bruno.lastModified).toBe('number');
  });

  test('catalog statique + usages=undefined → écrit { usages: null } (override vide explicite)', () => {
    const onProfiles = captureSetter();
    saveUsagesForPreset('AA MRSH JT50', undefined, {
      findEntry: () => ({ src: 'Anniversary', guessed: false }),
      isAdmin: false,
      activeProfileId: 'bruno',
      onProfiles,
    });
    const result = onProfiles.calls[0]({ bruno: {} });
    expect(result.bruno.usagesOverrides['AA MRSH JT50'].usages).toBe(null);
  });

  test('catalog statique + admin sans onShared → no-op silencieux', () => {
    const onProfiles = captureSetter();
    saveUsagesForPreset('TSR Mars 800SL', [{ artist: 'X' }], {
      findEntry: () => ({ src: 'TSR', guessed: false }),
      isAdmin: true,
      onProfiles, // ignoré car admin va vers onShared
    });
    expect(onProfiles.calls).toHaveLength(0);
  });

  test('entry.guessed=true → no-op (preset inconnu pas enrichissable)', () => {
    const onShared = captureSetter();
    const onProfiles = captureSetter();
    saveUsagesForPreset('Random Unknown', [{ artist: 'X' }], {
      findEntry: () => ({ src: 'ToneNET', guessed: true }),
      isAdmin: true,
      onShared,
      onProfiles,
    });
    expect(onShared.calls).toHaveLength(0);
    expect(onProfiles.calls).toHaveLength(0);
  });

  test('findEntry retourne null → no-op', () => {
    const onShared = captureSetter();
    saveUsagesForPreset('Whatever', [{ artist: 'X' }], {
      findEntry: () => null,
      isAdmin: true,
      onShared,
    });
    expect(onShared.calls).toHaveLength(0);
  });

  test('ctx vide ou name vide → no-op', () => {
    const onShared = captureSetter();
    saveUsagesForPreset(null, [{ artist: 'X' }], { findEntry: () => ({ src: 'TSR' }), onShared });
    saveUsagesForPreset('Name', [{ artist: 'X' }], null);
    expect(onShared.calls).toHaveLength(0);
  });
});

describe('removeUsagesOverride (Phase 7.79.3b)', () => {
  function captureSetter() {
    const calls = [];
    const setter = (reducer) => { calls.push(reducer); };
    setter.calls = calls;
    return setter;
  }

  test('admin → delete shared.usagesOverrides[name]', () => {
    const onShared = captureSetter();
    removeUsagesOverride('TSR Mars 800SL', {
      findEntry: () => ({ src: 'TSR', guessed: false }),
      isAdmin: true,
      onShared,
    });
    const result = onShared.calls[0]({
      usagesOverrides: { 'TSR Mars 800SL': { usages: [{ artist: 'X' }], lastModified: 100 } },
    });
    expect('TSR Mars 800SL' in result.usagesOverrides).toBe(false);
    expect(typeof result.lastModified).toBe('number');
  });

  test('non-admin → delete profile.usagesOverrides[name]', () => {
    const onProfiles = captureSetter();
    removeUsagesOverride('TSR Mars 800SL', {
      findEntry: () => ({ src: 'TSR', guessed: false }),
      isAdmin: false,
      activeProfileId: 'bruno',
      onProfiles,
    });
    const result = onProfiles.calls[0]({
      bruno: { usagesOverrides: { 'TSR Mars 800SL': { usages: [{ artist: 'X' }] } } },
    });
    expect('TSR Mars 800SL' in result.bruno.usagesOverrides).toBe(false);
  });

  test('no-op si entry pas dans la map (pas d\'override actif)', () => {
    const onShared = captureSetter();
    removeUsagesOverride('TSR Mars 800SL', {
      findEntry: () => ({ src: 'TSR', guessed: false }),
      isAdmin: true,
      onShared,
    });
    const result = onShared.calls[0]({ usagesOverrides: {} });
    // Le reducer doit retourner sh tel quel
    expect(result).toEqual({ usagesOverrides: {} });
  });

  test('src=custom → no-op (cascade ne s\'applique pas)', () => {
    const onShared = captureSetter();
    const onProfiles = captureSetter();
    removeUsagesOverride('MyCustom', {
      findEntry: () => ({ src: 'custom', guessed: false }),
      isAdmin: true,
      onShared,
      onProfiles,
    });
    expect(onShared.calls).toHaveLength(0);
    expect(onProfiles.calls).toHaveLength(0);
  });

  test('src=ToneNET → no-op (cascade ne s\'applique pas)', () => {
    const onShared = captureSetter();
    removeUsagesOverride('MyTN', {
      findEntry: () => ({ src: 'ToneNET', guessed: false }),
      isAdmin: true,
      onShared,
    });
    expect(onShared.calls).toHaveLength(0);
  });

  test('entry.guessed=true → no-op', () => {
    const onShared = captureSetter();
    removeUsagesOverride('Random', {
      findEntry: () => ({ src: 'TSR', guessed: true }),
      isAdmin: true,
      onShared,
    });
    expect(onShared.calls).toHaveLength(0);
  });

  test('findEntry null → no-op', () => {
    const onShared = captureSetter();
    removeUsagesOverride('X', {
      findEntry: () => null,
      isAdmin: true,
      onShared,
    });
    expect(onShared.calls).toHaveLength(0);
  });
});
