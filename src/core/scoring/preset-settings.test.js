// Tests Phase 9.1 — clampPresetSettings helper.
// Ranges du manuel TONEX p.22-28. Approche tolérante : préserve les
// champs présents et clamp les hors-bornes (Gemini hallucine parfois).

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { PRESET_RANGES, SUPPORTED_LOCALES, TWEAKS_MAX, FX_BLOCK_KEYS, FX_TYPE_ENUMS, FX_BLOCK_RANGES, clampPresetSettings, clampTweaks, clampPlayingHints, clampFxBlocks } from './preset-settings.js';

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

describe('clampTweaks (Phase 9.4)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('TWEAKS_MAX constant exposée et = 8', () => {
    expect(TWEAKS_MAX).toBe(8);
  });

  test('Array vide → null (rien à préserver)', () => {
    expect(clampTweaks([])).toBe(null);
  });

  test('non-Array (object, string, null, undefined) → null', () => {
    expect(clampTweaks(null)).toBe(null);
    expect(clampTweaks(undefined)).toBe(null);
    expect(clampTweaks({})).toBe(null);
    expect(clampTweaks('foo')).toBe(null);
  });

  test('tweak complet trilingue + fix string → préservé', () => {
    const input = [{
      symptom: { fr: 'trop brillant', en: 'too bright', es: 'demasiado brillante' },
      fix: 'Treble -0.5 + Presence -0.3',
    }];
    expect(clampTweaks(input)).toEqual(input);
  });

  test('symptom trilingue partiel (fr seul) accepté', () => {
    const out = clampTweaks([{ symptom: { fr: 'trop sombre' }, fix: 'Treble +0.5' }]);
    expect(out).toEqual([{ symptom: { fr: 'trop sombre' }, fix: 'Treble +0.5' }]);
  });

  test('symptom absent → drop entrée', () => {
    expect(clampTweaks([{ fix: 'Treble +0.5' }])).toBe(null);
  });

  test('fix absent ou vide ou non-string → drop entrée', () => {
    expect(clampTweaks([{ symptom: { fr: 'X' } }])).toBe(null);
    expect(clampTweaks([{ symptom: { fr: 'X' }, fix: '' }])).toBe(null);
    expect(clampTweaks([{ symptom: { fr: 'X' }, fix: '   ' }])).toBe(null);
    expect(clampTweaks([{ symptom: { fr: 'X' }, fix: 42 }])).toBe(null);
    expect(clampTweaks([{ symptom: { fr: 'X' }, fix: null }])).toBe(null);
  });

  test('fix avec espaces autour → trimmé', () => {
    const out = clampTweaks([{ symptom: { fr: 'X' }, fix: '  Treble -0.5  ' }]);
    expect(out[0].fix).toBe('Treble -0.5');
  });

  test('symptom non-objet (string, null, array) → drop entrée', () => {
    expect(clampTweaks([{ symptom: 'too bright', fix: 'X' }])).toBe(null);
    expect(clampTweaks([{ symptom: null, fix: 'X' }])).toBe(null);
    expect(clampTweaks([{ symptom: ['fr'], fix: 'X' }])).toBe(null);
  });

  test('symptom trilingue vide ({}) → drop entrée', () => {
    expect(clampTweaks([{ symptom: {}, fix: 'X' }])).toBe(null);
  });

  test('mix entrées valides + malformées → garde seulement valides', () => {
    const out = clampTweaks([
      { symptom: { fr: 'A' }, fix: 'Fix A' },
      null,
      { fix: 'no symptom' },
      { symptom: { fr: 'B' }, fix: '' },
      { symptom: { fr: 'C' }, fix: 'Fix C' },
    ]);
    expect(out).toEqual([
      { symptom: { fr: 'A' }, fix: 'Fix A' },
      { symptom: { fr: 'C' }, fix: 'Fix C' },
    ]);
  });

  test(`cap à ${TWEAKS_MAX} items (9e tronqué)`, () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      symptom: { fr: `S${i}` },
      fix: `Fix ${i}`,
    }));
    const out = clampTweaks(many);
    expect(out).toHaveLength(TWEAKS_MAX);
    expect(out[0].fix).toBe('Fix 0');
    expect(out[7].fix).toBe('Fix 7'); // 8 entries kept, indexes 0-7
  });

  test('entrées Array (au lieu d\'objet) drop', () => {
    expect(clampTweaks([['fr', 'X']])).toBe(null);
  });

  test('langue non supportée dans symptom (de) skippée', () => {
    const out = clampTweaks([{
      symptom: { fr: 'F', en: 'E', de: 'D' },
      fix: 'X',
    }]);
    expect(out[0].symptom).toEqual({ fr: 'F', en: 'E' });
  });
});

describe('clampPresetSettings — tweaks intégrés (Phase 9.4)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('preset_settings_v1 complet avec tweaks → preserve tweaks', () => {
    const input = {
      cab_enabled: true,
      main: { gain: 6 },
      tweaks: [
        {
          symptom: { fr: 'trop brillant sur FRFR', en: 'too bright on FRFR', es: 'demasiado brillante en FRFR' },
          fix: 'Treble -0.5 + Presence -0.3',
        },
        {
          symptom: { fr: 'noyé dans le mix', en: 'buried in mix', es: 'enterrado en la mezcla' },
          fix: 'Mid +0.5 + Volume +0.3',
        },
      ],
    };
    const out = clampPresetSettings(input);
    expect(out.tweaks).toEqual(input.tweaks);
    expect(out.cab_enabled).toBe(true);
    expect(out.main.gain.value).toBe(6);
  });

  test('preset_settings_v1 sans tweaks → out.tweaks undefined', () => {
    const out = clampPresetSettings({ main: { gain: 5 } });
    expect(out.tweaks).toBeUndefined();
  });

  test('tweaks vide [] dans input → out.tweaks undefined', () => {
    const out = clampPresetSettings({ main: { gain: 5 }, tweaks: [] });
    expect(out.tweaks).toBeUndefined();
  });

  test('tweaks tous malformés → out.tweaks undefined', () => {
    const out = clampPresetSettings({
      main: { gain: 5 },
      tweaks: [{ fix: 'X' }, { symptom: {} }, null],
    });
    expect(out.tweaks).toBeUndefined();
  });

  test('rétro-compat aiCache pré-Phase 9.4 (pas de tweaks) → fonctionne', () => {
    // aiCache Phase 9.1-7.86 sans tweaks doit toujours marcher (additif).
    const input = {
      cab_enabled: true,
      main: { gain: { value: 6.2, why: { fr: 'X', en: 'X', es: 'X' } } },
      why: { fr: 'G', en: 'G', es: 'G' },
    };
    const out = clampPresetSettings(input);
    expect(out.tweaks).toBeUndefined();
    expect(out.main.gain.value).toBe(6.2);
  });

  test('preset_settings_v1 avec UNIQUEMENT tweaks (cas dégénéré) → out non-null', () => {
    const out = clampPresetSettings({
      tweaks: [{ symptom: { fr: 'X' }, fix: 'Fix' }],
    });
    expect(out).not.toBeNull();
    expect(out.tweaks).toHaveLength(1);
  });
});

describe('clampPlayingHints (Phase 9.5)', () => {
  test('full hints valides → preserve tous champs', () => {
    const out = clampPlayingHints({
      pickup: 'Bridge HB',
      guitar_volume: '8-10',
      guitar_tone: '10 (open)',
      stereo: true,
    });
    expect(out).toEqual({
      pickup: 'Bridge HB',
      guitar_volume: '8-10',
      guitar_tone: '10 (open)',
      stereo: true,
    });
  });

  test('null / undefined / non-object → null', () => {
    expect(clampPlayingHints(null)).toBe(null);
    expect(clampPlayingHints(undefined)).toBe(null);
    expect(clampPlayingHints('foo')).toBe(null);
    expect(clampPlayingHints(42)).toBe(null);
    expect(clampPlayingHints([])).toBe(null);
  });

  test('objet vide → null', () => {
    expect(clampPlayingHints({})).toBe(null);
  });

  test('partial (juste pickup) → preserve pickup seul', () => {
    expect(clampPlayingHints({ pickup: 'Neck' })).toEqual({ pickup: 'Neck' });
  });

  test('strings avec espaces → trim', () => {
    const out = clampPlayingHints({
      pickup: '  Bridge  ',
      guitar_tone: ' 7-9 ',
    });
    expect(out).toEqual({ pickup: 'Bridge', guitar_tone: '7-9' });
  });

  test('strings vides ou whitespace-only → drop', () => {
    expect(clampPlayingHints({ pickup: '', guitar_tone: '   ' })).toBe(null);
    const partial = clampPlayingHints({ pickup: 'Bridge', guitar_tone: '' });
    expect(partial).toEqual({ pickup: 'Bridge' });
  });

  test('valeurs non-string ignorées', () => {
    const out = clampPlayingHints({
      pickup: 42,
      guitar_volume: { value: '8' },
      guitar_tone: 'OK',
      stereo: true,
    });
    expect(out).toEqual({ guitar_tone: 'OK', stereo: true });
  });

  test('stereo non-boolean → drop (truthy / falsy non-bool ignorés)', () => {
    expect(clampPlayingHints({ pickup: 'Neck', stereo: 'yes' })).toEqual({ pickup: 'Neck' });
    expect(clampPlayingHints({ pickup: 'Neck', stereo: 1 })).toEqual({ pickup: 'Neck' });
    expect(clampPlayingHints({ pickup: 'Neck', stereo: null })).toEqual({ pickup: 'Neck' });
  });

  test('stereo: false preservé (différent de stereo absent)', () => {
    const out = clampPlayingHints({ pickup: 'Neck', stereo: false });
    expect(out).toEqual({ pickup: 'Neck', stereo: false });
  });

  test('champ inconnu (picking_style) ignoré silencieusement', () => {
    const out = clampPlayingHints({
      pickup: 'Bridge',
      picking_style: 'Aggressive', // exclu Phase 9.5 (settings_guitar prose suffit)
    });
    expect(out).toEqual({ pickup: 'Bridge' });
    expect(out.picking_style).toBeUndefined();
  });

  test('scénario réel (Under Pressure ES-335)', () => {
    const out = clampPlayingHints({
      pickup: 'Position 4 (Middle+Bridge)',
      guitar_volume: '8-10',
      guitar_tone: '7-9',
      stereo: false,
    });
    expect(out.pickup).toBe('Position 4 (Middle+Bridge)');
    expect(out.stereo).toBe(false);
  });
});

describe('clampFxBlocks (Phase 9.2 Niveau 1)', () => {
  test('FX_BLOCK_KEYS contient les 5 blocs attendus', () => {
    expect(FX_BLOCK_KEYS).toEqual(['noise_gate', 'compressor', 'modulation', 'delay', 'reverb']);
  });

  test('FX_TYPE_ENUMS conformes manuel TONEX (Phase 9.7)', () => {
    expect(FX_TYPE_ENUMS.modulation).toEqual(['Chorus', 'Tremolo', 'Phaser', 'Flanger', 'Rotary']);
    expect(FX_TYPE_ENUMS.delay).toEqual(['Digital', 'Tape']);
    // Phase 9.7 — Reverb enum corrigé : retire Hall/Shimmer, ajoute
    // 4 variantes Spring numérotées conformes firmware TONEX.
    expect(FX_TYPE_ENUMS.reverb).toEqual(['Spring 1', 'Spring 2', 'Spring 3', 'Spring 4', 'Room', 'Plate']);
    // Phase 9.7 — delay mode (Normal / Ping.Pong)
    expect(FX_TYPE_ENUMS.delay_mode).toEqual(['Normal', 'Ping.Pong']);
  });

  test('null / undefined / non-object → null', () => {
    expect(clampFxBlocks(null)).toBe(null);
    expect(clampFxBlocks(undefined)).toBe(null);
    expect(clampFxBlocks('foo')).toBe(null);
    expect(clampFxBlocks([])).toBe(null);
  });

  test('objet vide → null', () => {
    expect(clampFxBlocks({})).toBe(null);
  });

  test('5 blocs complets avec types valides → preserve tout', () => {
    const input = {
      noise_gate: { enabled: true },
      compressor: { enabled: false },
      modulation: { enabled: false, type: 'Chorus' },
      delay: { enabled: false, type: 'Tape' },
      reverb: { enabled: true, type: 'Plate' },
    };
    expect(clampFxBlocks(input)).toEqual(input);
  });

  test('enabled non-boolean → drop le bloc entier', () => {
    const out = clampFxBlocks({
      noise_gate: { enabled: 'yes' },
      reverb: { enabled: true, type: 'Plate' },
    });
    expect(out.noise_gate).toBeUndefined();
    expect(out.reverb).toEqual({ enabled: true, type: 'Plate' });
  });

  test('type invalide (hors enum) → drop le type mais garde enabled', () => {
    const out = clampFxBlocks({
      modulation: { enabled: true, type: 'Univibe' }, // pas dans enum
    });
    expect(out.modulation).toEqual({ enabled: true });
    expect(out.modulation.type).toBeUndefined();
  });

  test('type case-insensitive matché et renvoyé canonique', () => {
    const out = clampFxBlocks({
      reverb: { enabled: true, type: 'plate' }, // minuscule
      delay: { enabled: true, type: 'TAPE' },   // majuscule
    });
    expect(out.reverb.type).toBe('Plate');
    expect(out.delay.type).toBe('Tape');
  });

  test('why trilingue préservé', () => {
    const out = clampFxBlocks({
      reverb: {
        enabled: true,
        type: 'Spring 1',
        why: { fr: 'Reverb spring vintage', en: 'Vintage spring reverb', es: 'Reverb spring vintage' },
      },
    });
    expect(out.reverb.why).toEqual({ fr: 'Reverb spring vintage', en: 'Vintage spring reverb', es: 'Reverb spring vintage' });
  });

  test('why invalide ignorée silencieusement', () => {
    const out = clampFxBlocks({
      reverb: { enabled: true, why: 'not-an-object' },
    });
    expect(out.reverb).toEqual({ enabled: true });
    expect(out.reverb.why).toBeUndefined();
  });

  test('bloc inconnu (eq) ignoré', () => {
    const out = clampFxBlocks({
      noise_gate: { enabled: true },
      eq: { enabled: true, bands: [] }, // pas dans FX_BLOCK_KEYS
    });
    expect(out.noise_gate).toEqual({ enabled: true });
    expect(out.eq).toBeUndefined();
  });

  test('partial (seulement reverb) → preserve reverb seul', () => {
    expect(clampFxBlocks({ reverb: { enabled: true, type: 'Room' } })).toEqual({
      reverb: { enabled: true, type: 'Room' },
    });
  });

  test('Phase 9.7 — Hall/Shimmer rejetés (retirés de l\'enum)', () => {
    expect(clampFxBlocks({ reverb: { enabled: true, type: 'Hall' } })).toEqual({
      reverb: { enabled: true }, // type droppé silencieusement
    });
    expect(clampFxBlocks({ reverb: { enabled: true, type: 'Shimmer' } })).toEqual({
      reverb: { enabled: true },
    });
  });

  test('Phase 9.7 — Spring 1/2/3/4 acceptés', () => {
    for (const t of ['Spring 1', 'Spring 2', 'Spring 3', 'Spring 4']) {
      expect(clampFxBlocks({ reverb: { enabled: true, type: t } }).reverb.type).toBe(t);
    }
  });

  test('tous les blocs malformés → null', () => {
    expect(clampFxBlocks({
      noise_gate: 'on',
      compressor: { enabled: 1 },
      modulation: null,
    })).toBe(null);
  });

  test('scénario réel (Hells Bells AC/DC, FX dry)', () => {
    const out = clampFxBlocks({
      noise_gate: { enabled: false, why: { fr: 'Pas de gate, son dynamique', en: 'No gate, dynamic tone', es: 'Sin gate, tono dinámico' } },
      compressor: { enabled: false },
      modulation: { enabled: false },
      delay: { enabled: false },
      reverb: { enabled: true, type: 'Spring 2' },
    });
    expect(out.noise_gate.enabled).toBe(false);
    expect(out.reverb.type).toBe('Spring 2');
    expect(out.noise_gate.why.fr).toBe('Pas de gate, son dynamique');
  });

  test('scénario réel (For Whom the Bell Tolls Metallica, FX OFF sauf reverb)', () => {
    const out = clampFxBlocks({
      noise_gate: { enabled: true },
      compressor: { enabled: false },
      modulation: { enabled: false },
      delay: { enabled: false },
      reverb: { enabled: true, type: 'Plate' },
    });
    expect(out.noise_gate.enabled).toBe(true);
    expect(out.modulation.enabled).toBe(false);
    expect(out.reverb.type).toBe('Plate');
  });
});

describe('clampFxBlocks — sub-params Niveau 2 (Phase 9.7)', () => {
  let warnSpy;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('FX_BLOCK_RANGES conformes manuel TONEX', () => {
    expect(FX_BLOCK_RANGES.noise_gate).toMatchObject({
      release: { min: 5, max: 500, unit: 'ms' },
      depth: { min: -100, max: -20, unit: 'dB' },
    });
    expect(FX_BLOCK_RANGES.compressor).toMatchObject({
      gain: { min: -30, max: 10, unit: 'dB' },
      attack: { min: 1, max: 51, unit: 'ms' },
    });
    expect(FX_BLOCK_RANGES.delay).toMatchObject({
      time: { min: 0, max: 1000, unit: 'ms' },
      feedback: { min: 0, max: 100, unit: '%' },
      mix: { min: 0, max: 100, unit: '%' },
    });
    expect(FX_BLOCK_RANGES.reverb).toMatchObject({
      time: { min: 0, max: 10 },
      pre_delay: { min: 0, max: 500, unit: 'ms' },
      color: { min: -10, max: 10 },
      mix: { min: 0, max: 100, unit: '%' },
    });
  });

  test('noise_gate sub-params in-range préservés', () => {
    const out = clampFxBlocks({
      noise_gate: { enabled: true, release: 140, depth: -75 },
    });
    expect(out.noise_gate).toEqual({ enabled: true, release: 140, depth: -75 });
  });

  test('noise_gate sub-params hors-bornes clampés', () => {
    const out = clampFxBlocks({
      noise_gate: { enabled: true, release: 800, depth: -10 },
    });
    expect(out.noise_gate.release).toBe(500); // max 500
    expect(out.noise_gate.depth).toBe(-20);   // max -20 (range -100/-20)
    expect(warnSpy).toHaveBeenCalled();
  });

  test('compressor sub-params (gain + attack)', () => {
    const out = clampFxBlocks({
      compressor: { enabled: true, gain: 5, attack: 10 },
    });
    expect(out.compressor).toEqual({ enabled: true, gain: 5, attack: 10 });
  });

  test('compressor gain hors-bornes négatif clampé', () => {
    const out = clampFxBlocks({
      compressor: { enabled: true, gain: -50, attack: 0.5 },
    });
    expect(out.compressor.gain).toBe(-30);  // min -30
    expect(out.compressor.attack).toBe(1);  // min 1
  });

  test('delay type Digital + mode Normal + sub-params', () => {
    const out = clampFxBlocks({
      delay: { enabled: true, type: 'Digital', mode: 'Normal', time: 320, feedback: 25, mix: 14 },
    });
    expect(out.delay).toEqual({
      enabled: true, type: 'Digital', mode: 'Normal',
      time: 320, feedback: 25, mix: 14,
    });
  });

  test('delay type Tape + mode Ping.Pong (Phase 9.7)', () => {
    const out = clampFxBlocks({
      delay: { enabled: true, type: 'Tape', mode: 'Ping.Pong', time: 500, feedback: 40, mix: 30 },
    });
    expect(out.delay.type).toBe('Tape');
    expect(out.delay.mode).toBe('Ping.Pong');
  });

  test('delay mode case-insensitive canonisé', () => {
    const out = clampFxBlocks({
      delay: { enabled: true, mode: 'ping.pong' },
    });
    expect(out.delay.mode).toBe('Ping.Pong');
  });

  test('delay mode invalide droppé (keep enabled)', () => {
    const out = clampFxBlocks({
      delay: { enabled: true, mode: 'Reverse' }, // pas dans enum
    });
    expect(out.delay).toEqual({ enabled: true });
    expect(out.delay.mode).toBeUndefined();
  });

  test('delay time hors-bornes (1500ms) clampé à 1000', () => {
    const out = clampFxBlocks({
      delay: { enabled: true, time: 1500 },
    });
    expect(out.delay.time).toBe(1000);
  });

  test('reverb full sub-params (type Spring 2 + time + pre_delay + color + mix)', () => {
    const out = clampFxBlocks({
      reverb: { enabled: true, type: 'Spring 2', time: 4.5, pre_delay: 18, color: 2, mix: 16 },
    });
    expect(out.reverb).toEqual({
      enabled: true, type: 'Spring 2',
      time: 4.5, pre_delay: 18, color: 2, mix: 16,
    });
  });

  test('reverb color hors-bornes négatif clampé', () => {
    const out = clampFxBlocks({
      reverb: { enabled: true, color: -20 },
    });
    expect(out.reverb.color).toBe(-10);
  });

  test('reverb pre_delay hors-bornes positif clampé', () => {
    const out = clampFxBlocks({
      reverb: { enabled: true, pre_delay: 900 },
    });
    expect(out.reverb.pre_delay).toBe(500);
  });

  test('sub-param non-numérique skip silencieusement', () => {
    const out = clampFxBlocks({
      reverb: { enabled: true, time: 'long', color: 0 },
    });
    expect(out.reverb).toEqual({ enabled: true, color: 0 });
    expect(out.reverb.time).toBeUndefined();
  });

  test('sub-param inconnu (ex. release sur reverb) ignoré', () => {
    const out = clampFxBlocks({
      reverb: { enabled: true, type: 'Plate', release: 200 }, // release n'est pas reverb param
    });
    expect(out.reverb).toEqual({ enabled: true, type: 'Plate' });
    expect(out.reverb.release).toBeUndefined();
  });

  test('modulation Niveau 1 préservé (pas de sub-params Phase 9.7)', () => {
    const out = clampFxBlocks({
      modulation: { enabled: true, type: 'Chorus', rate: 1.5 }, // rate skip (Niveau 1)
    });
    expect(out.modulation).toEqual({ enabled: true, type: 'Chorus' });
    expect(out.modulation.rate).toBeUndefined();
  });

  test('scénario réel Phase 9.7 (Under Pressure ambient Plate)', () => {
    const out = clampFxBlocks({
      noise_gate: { enabled: false },
      compressor: { enabled: true, gain: 2, attack: 8 },
      modulation: { enabled: false },
      delay: { enabled: true, type: 'Tape', mode: 'Normal', time: 380, feedback: 25, mix: 18 },
      reverb: { enabled: true, type: 'Plate', time: 5.2, pre_delay: 25, color: 1, mix: 22 },
    });
    expect(out.delay.mode).toBe('Normal');
    expect(out.delay.type).toBe('Tape');
    expect(out.reverb.type).toBe('Plate');
    expect(out.reverb.color).toBe(1);
    expect(out.compressor.attack).toBe(8);
  });
});
