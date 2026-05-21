// Tests Phase 9.1 — clampPresetSettings helper.
// Ranges du manuel TONEX p.22-28. Approche tolérante : préserve les
// champs présents et clamp les hors-bornes (Gemini hallucine parfois).

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { PRESET_RANGES, SUPPORTED_LOCALES, clampPresetSettings } from './preset-settings.js';

describe('PRESET_RANGES (Phase 9.1)', () => {
  test('5 main knobs avec range 0-10', () => {
    for (const key of ['gain', 'bass', 'mid', 'treble', 'volume']) {
      expect(PRESET_RANGES.main[key]).toMatchObject({ min: 0, max: 10 });
    }
  });

  test('5 alt knobs avec ranges officiels manuel TONEX', () => {
    expect(PRESET_RANGES.alt.presence).toMatchObject({ min: 0, max: 10 });
    expect(PRESET_RANGES.alt.depth).toMatchObject({ min: 0, max: 10 });
    expect(PRESET_RANGES.alt.reverb_mix).toMatchObject({ min: 0, max: 100, unit: '%' });
    expect(PRESET_RANGES.alt.comp_threshold).toMatchObject({ min: -40, max: 0, unit: 'dB' });
    expect(PRESET_RANGES.alt.gate_threshold).toMatchObject({ min: -100, max: 0, unit: 'dB' });
  });

  test('PRESET_RANGES est figé (Object.freeze)', () => {
    expect(Object.isFrozen(PRESET_RANGES)).toBe(true);
    expect(Object.isFrozen(PRESET_RANGES.main)).toBe(true);
    expect(Object.isFrozen(PRESET_RANGES.alt)).toBe(true);
  });

  test('SUPPORTED_LOCALES = fr/en/es', () => {
    expect(SUPPORTED_LOCALES).toEqual(['fr', 'en', 'es']);
  });
});

describe('clampPresetSettings — structure globale (Phase 9.1)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('null/undefined → null', () => {
    expect(clampPresetSettings(null)).toBe(null);
    expect(clampPresetSettings(undefined)).toBe(null);
  });

  test('string / number / array → null (pas un objet)', () => {
    expect(clampPresetSettings('foo')).toBe(null);
    expect(clampPresetSettings(42)).toBe(null);
    expect(clampPresetSettings([])).toBe(null);
  });

  test('objet vide → null (rien à préserver)', () => {
    expect(clampPresetSettings({})).toBe(null);
  });

  test('Phase 9.1 — ancien format (knob=number) coerce vers nouveau ({value})', () => {
    // Rétro-compat aiCache Phase 9.1-10 : un knob en number doit être
    // accepté et coercé vers { value: number, why: undefined }.
    const input = {
      cab_enabled: true,
      main: { gain: 6.2, bass: 4.5, mid: 7.0, treble: 5.3, volume: 6.0 },
      alt: { presence: 4.7, depth: 5.0, reverb_mix: 16, comp_threshold: -18, gate_threshold: -56 },
      why: { fr: 'Pourquoi', en: 'Why', es: 'Por qué' },
    };
    const out = clampPresetSettings(input);
    expect(out).toEqual({
      cab_enabled: true,
      main: {
        gain: { value: 6.2 }, bass: { value: 4.5 }, mid: { value: 7.0 },
        treble: { value: 5.3 }, volume: { value: 6.0 },
      },
      alt: {
        presence: { value: 4.7 }, depth: { value: 5.0 },
        reverb_mix: { value: 16 }, comp_threshold: { value: -18 }, gate_threshold: { value: -56 },
      },
      why: { fr: 'Pourquoi', en: 'Why', es: 'Por qué' },
    });
  });

  test('Phase 7.86 — nouveau format (knob={value,why}) préservé', () => {
    const input = {
      cab_enabled: true,
      main: {
        gain: { value: 6.2, why: { fr: 'Mesa déjà saturé', en: 'Mesa already saturated', es: 'Mesa ya saturado' } },
      },
      why: { fr: 'Global', en: 'Global', es: 'Global' },
    };
    const out = clampPresetSettings(input);
    expect(out).toEqual(input);
  });

  test('Phase 7.86 — nouveau format sans why → preserve juste value', () => {
    const out = clampPresetSettings({ main: { gain: { value: 6.2 } } });
    expect(out).toEqual({ main: { gain: { value: 6.2 } } });
  });

  test('IA retourne partial (juste main) → preserve main', () => {
    const out = clampPresetSettings({ main: { gain: 5, bass: 5 } });
    expect(out).toEqual({ main: { gain: { value: 5 }, bass: { value: 5 } } });
  });

  test('cab_enabled non-boolean → skip silencieusement', () => {
    const out = clampPresetSettings({ cab_enabled: 'yes', main: { gain: 5 } });
    expect(out).toEqual({ main: { gain: { value: 5 } } });
  });

  // Phase 10 v3 — cab_enabled toujours true sur les 3 contextes (frfr/
  // headphone/pa). Si Gemini retourne false par erreur (heuristique
  // AMP+CAB pré-Phase 10 v3), on override à true + warn.
  test('Phase 10 v3 — cab_enabled: false override à true + warn', () => {
    const out = clampPresetSettings({ cab_enabled: false, main: { gain: 5 } });
    expect(out.cab_enabled).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/cab_enabled=false ignoré/));
  });

  test('Phase 10 v3 — cab_enabled: true préservé tel quel', () => {
    const out = clampPresetSettings({ cab_enabled: true, main: { gain: 5 } });
    expect(out.cab_enabled).toBe(true);
  });

  test('Phase 10 v3 — cab_enabled absent → pas ajouté (preserve partial)', () => {
    const out = clampPresetSettings({ main: { gain: 5 } });
    expect(out.cab_enabled).toBeUndefined();
  });
});

describe('clampPresetSettings — clamp main knobs (Phase 9.1 + 7.86)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('valeurs in-range préservées (output au nouveau format {value})', () => {
    const input = { main: { gain: 6.2, bass: 4.5, mid: 7.0, treble: 5.3, volume: 6.0 } };
    const expected = { main: {
      gain: { value: 6.2 }, bass: { value: 4.5 }, mid: { value: 7.0 },
      treble: { value: 5.3 }, volume: { value: 6.0 },
    } };
    expect(clampPresetSettings(input)).toEqual(expected);
  });

  test('hors-bornes haut → clamp au max + warn', () => {
    const out = clampPresetSettings({ main: { gain: 15 } });
    expect(out.main.gain.value).toBe(10);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/gain=15/));
  });

  test('hors-bornes bas → clamp au min + warn', () => {
    const out = clampPresetSettings({ main: { bass: -3 } });
    expect(out.main.bass.value).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/bass=-3/));
  });

  test('valeur min exacte (0) acceptée', () => {
    const out = clampPresetSettings({ main: { gain: 0 } });
    expect(out.main.gain.value).toBe(0);
  });

  test('valeur max exacte (10) acceptée', () => {
    const out = clampPresetSettings({ main: { volume: 10 } });
    expect(out.main.volume.value).toBe(10);
  });

  test('valeur non-numérique skip silencieusement', () => {
    const out = clampPresetSettings({ main: { gain: 'high', bass: 5 } });
    expect(out.main).toEqual({ bass: { value: 5 } });
  });

  test('NaN / Infinity ignorés', () => {
    const out = clampPresetSettings({ main: { gain: NaN, bass: Infinity, mid: 5 } });
    expect(out.main).toEqual({ mid: { value: 5 } });
  });

  test('champ inconnu skip', () => {
    const out = clampPresetSettings({ main: { gain: 5, unknown_knob: 99 } });
    expect(out.main).toEqual({ gain: { value: 5 } });
    expect(out.main.unknown_knob).toBeUndefined();
  });

  test('Phase 7.86 — knob {value, why} : why préservé si trilingue valide', () => {
    const out = clampPresetSettings({
      main: { gain: { value: 6.2, why: { fr: 'F', en: 'E', es: 'S' } } },
    });
    expect(out.main.gain).toEqual({ value: 6.2, why: { fr: 'F', en: 'E', es: 'S' } });
  });

  test('Phase 7.86 — knob {value, why invalide} : why skip', () => {
    const out = clampPresetSettings({
      main: { gain: { value: 6.2, why: 'string-pas-objet' } },
    });
    expect(out.main.gain).toEqual({ value: 6.2 });
  });

  test('Phase 7.86 — knob hors-bornes haut dans nouveau format : clamp + warn', () => {
    const out = clampPresetSettings({ main: { gain: { value: 15, why: { fr: 'X', en: 'X', es: 'X' } } } });
    expect(out.main.gain.value).toBe(10);
    expect(out.main.gain.why).toEqual({ fr: 'X', en: 'X', es: 'X' });
    expect(console.warn).toHaveBeenCalled();
  });

  test('Phase 7.86 — knob {value: non-numérique} skip', () => {
    const out = clampPresetSettings({ main: { gain: { value: 'high' }, bass: 5 } });
    expect(out.main).toEqual({ bass: { value: 5 } });
  });
});

describe('clampPresetSettings — clamp alt knobs (Phase 9.1 + 7.86)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('reverb_mix in-range 0-100', () => {
    expect(clampPresetSettings({ alt: { reverb_mix: 50 } }).alt.reverb_mix.value).toBe(50);
    expect(clampPresetSettings({ alt: { reverb_mix: 0 } }).alt.reverb_mix.value).toBe(0);
    expect(clampPresetSettings({ alt: { reverb_mix: 100 } }).alt.reverb_mix.value).toBe(100);
  });

  test('reverb_mix hors-bornes → clamp', () => {
    expect(clampPresetSettings({ alt: { reverb_mix: 150 } }).alt.reverb_mix.value).toBe(100);
    expect(clampPresetSettings({ alt: { reverb_mix: -10 } }).alt.reverb_mix.value).toBe(0);
  });

  test('comp_threshold range -40 à 0 dB', () => {
    expect(clampPresetSettings({ alt: { comp_threshold: -20 } }).alt.comp_threshold.value).toBe(-20);
    expect(clampPresetSettings({ alt: { comp_threshold: 5 } }).alt.comp_threshold.value).toBe(0);
    expect(clampPresetSettings({ alt: { comp_threshold: -50 } }).alt.comp_threshold.value).toBe(-40);
  });

  test('gate_threshold range -100 à 0 dB', () => {
    expect(clampPresetSettings({ alt: { gate_threshold: -56 } }).alt.gate_threshold.value).toBe(-56);
    expect(clampPresetSettings({ alt: { gate_threshold: 10 } }).alt.gate_threshold.value).toBe(0);
    expect(clampPresetSettings({ alt: { gate_threshold: -200 } }).alt.gate_threshold.value).toBe(-100);
  });

  test('presence / depth (0-10 même range que main)', () => {
    expect(clampPresetSettings({ alt: { presence: 5, depth: 5 } }).alt).toEqual({ presence: { value: 5 }, depth: { value: 5 } });
    expect(clampPresetSettings({ alt: { presence: 12 } }).alt.presence.value).toBe(10);
  });

  test('Phase 7.86 — alt knob {value, why} préservé', () => {
    const out = clampPresetSettings({
      alt: { gate_threshold: { value: -56, why: { fr: 'thrash sévère', en: 'severe thrash', es: 'thrash severo' } } },
    });
    expect(out.alt.gate_threshold).toEqual({
      value: -56,
      why: { fr: 'thrash sévère', en: 'severe thrash', es: 'thrash severo' },
    });
  });
});

describe('clampPresetSettings — why trilingue (Phase 9.1)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('why complet {fr, en, es} préservé', () => {
    const why = { fr: 'FR', en: 'EN', es: 'ES' };
    expect(clampPresetSettings({ main: { gain: 5 }, why }).why).toEqual(why);
  });

  test('why partiel (que fr) préservé', () => {
    const out = clampPresetSettings({ main: { gain: 5 }, why: { fr: 'FR' } });
    expect(out.why).toEqual({ fr: 'FR' });
  });

  test('why vide → null (skip)', () => {
    const out = clampPresetSettings({ main: { gain: 5 }, why: {} });
    expect(out.why).toBeUndefined();
  });

  test('why avec string vide → skip cette langue', () => {
    const out = clampPresetSettings({ main: { gain: 5 }, why: { fr: '', en: 'EN' } });
    expect(out.why).toEqual({ en: 'EN' });
  });

  test('why avec valeur non-string → skip', () => {
    const out = clampPresetSettings({ main: { gain: 5 }, why: { fr: 123, en: 'EN' } });
    expect(out.why).toEqual({ en: 'EN' });
  });

  test('why null/string/array → undefined', () => {
    expect(clampPresetSettings({ main: { gain: 5 }, why: null }).why).toBeUndefined();
    expect(clampPresetSettings({ main: { gain: 5 }, why: 'foo' }).why).toBeUndefined();
    expect(clampPresetSettings({ main: { gain: 5 }, why: ['fr'] }).why).toBeUndefined();
  });

  test('langue non supportée (de) skippée', () => {
    const out = clampPresetSettings({ main: { gain: 5 }, why: { fr: 'FR', de: 'DE' } });
    expect(out.why).toEqual({ fr: 'FR' });
  });
});

describe('clampPresetSettings — scénarios IA réels (Phase 9.1)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Chop Suey thrash typique (gain élevé, gate sévère, FX min)', () => {
    const out = clampPresetSettings({
      cab_enabled: true,
      main: { gain: 8.5, bass: 6.5, mid: 4.0, treble: 6.5, volume: 7.0 },
      alt: { presence: 6.5, depth: 7.0, reverb_mix: 8, comp_threshold: -22, gate_threshold: -52 },
      why: { fr: 'Thrash sec', en: 'Dry thrash', es: 'Thrash seco' },
    });
    expect(out.cab_enabled).toBe(true);
    expect(out.main.gain.value).toBe(8.5);
    expect(out.alt.gate_threshold.value).toBe(-52);
  });

  test('IA hallucine gain à 12 sur ToneX Pedal (range 0-10) → clamp 10', () => {
    const out = clampPresetSettings({
      main: { gain: 12, bass: 5, mid: 5, treble: 5, volume: 5 },
    });
    expect(out.main.gain.value).toBe(10);
    expect(console.warn).toHaveBeenCalled();
  });

  test('Phase 7.86 — Chop Suey thrash avec why per-knob (nouveau format)', () => {
    const out = clampPresetSettings({
      cab_enabled: true,
      main: {
        gain: { value: 8.5, why: { fr: 'Mesa déjà saturé', en: 'Mesa already saturated', es: 'Mesa ya saturado' } },
        bass: { value: 6.5, why: { fr: 'Drop C ferme', en: 'Tight Drop C', es: 'Drop C firme' } },
      },
      alt: {
        gate_threshold: { value: -52, why: { fr: 'Palm mutes secs', en: 'Dry palm mutes', es: 'Palm mutes secos' } },
      },
      why: { fr: 'Thrash dry', en: 'Dry thrash', es: 'Thrash seco' },
    });
    expect(out.main.gain.value).toBe(8.5);
    expect(out.main.gain.why.fr).toBe('Mesa déjà saturé');
    expect(out.alt.gate_threshold.why.es).toBe('Palm mutes secos');
    expect(out.why.en).toBe('Dry thrash');
  });

  test('Phase 10 v3 — IA retourne seulement cab_enabled (override à true)', () => {
    const out = clampPresetSettings({ cab_enabled: false });
    expect(out).toEqual({ cab_enabled: true });
  });

  test('Phase 10 v3 — IA retourne seulement cab_enabled true (preserved)', () => {
    const out = clampPresetSettings({ cab_enabled: true });
    expect(out).toEqual({ cab_enabled: true });
  });
});
