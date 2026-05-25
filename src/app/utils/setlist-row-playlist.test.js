// src/app/utils/setlist-row-playlist.test.js — Phase 7.55.7 S8 (S8-1).

import { describe, it, expect } from 'vitest';
import { getRowPlaylistData, DEVICE_SHORT_LABELS } from './setlist-row-playlist.js';

const SONG_AC_DC = { id: 'acdc_bib', title: 'Back in Black', artist: 'AC/DC' };
const GUITAR_SG = { id: 'sg_ebony', name: 'SG Ebony', type: 'HB' };

describe('getRowPlaylistData — cas nominal', () => {
  it('scénario maquette user : tout présent', () => {
    const aiC = {
      preset_ann: { bank: 9, col: 'C', label: 'AA MRSH JT50', score: 88 },
      preset_plug: null,
      preset_settings_v1: {
        main: { gain: { value: 6.2 }, bass: { value: 4.5 }, mid: { value: 7 }, treble: { value: 5.3 }, volume: { value: 6 } },
      },
      fx_blocks: {
        noise_gate: { enabled: true },
        reverb: { enabled: true },
      },
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 95, true);
    expect(result.title).toBe('Back in Black');
    expect(result.artist).toBe('AC/DC');
    expect(result.guitarLabel).toBe('SG Ebony (HB)');
    expect(result.guitarScore).toBe(95);
    expect(result.isOptimalGuitar).toBe(true);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]).toEqual({
      deviceKey: 'tonex-anniversary',
      deviceLabel: 'Anniv',
      slot: '9C',
      presetName: 'AA MRSH JT50',
      presetScore: 88,
    });
    expect(result.potards).toBe('G6.2 B4.5 M7 T5.3 V6');
    expect(result.fxOn).toEqual(['Gate', 'Verb']);
    // S8.7 : absoluteScore = moyenne(guitar 95 + maxPreset 88) = 91.5 → 92
    expect(result.absoluteScore).toBe(92);
    expect(result.topScore).toBe(92); // alias retrocompat
    expect(result.maxPresetScore).toBe(88);
    expect(result.needsAnalysis).toBe(false);
  });

  it('multi-device : Anniv + Plug → maxPresetScore = max(devices)', () => {
    const aiC = {
      preset_ann: { bank: 9, col: 'C', label: 'AA MRSH JT50', score: 88 },
      preset_plug: { bank: 4, col: 'B', label: 'Plug Preset', score: 85 },
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 95, true);
    expect(result.devices).toHaveLength(2);
    expect(result.maxPresetScore).toBe(88); // max(88, 85)
    // absoluteScore = moyenne(95 + 88) = 91.5 → 92
    expect(result.absoluteScore).toBe(92);
  });

  it('absoluteScore = moyenne(guitar + maxPreset) avec arrondi', () => {
    const aiC = {
      preset_ann: { bank: 9, col: 'C', label: 'X', score: 70 },
      preset_plug: { bank: 4, col: 'B', label: 'Y', score: 90 },
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 95, true);
    expect(result.maxPresetScore).toBe(90);
    // (95 + 90) / 2 = 92.5 → 93 (Math.round arrondit au plus proche)
    expect(result.absoluteScore).toBe(93);
  });

  it('absoluteScore : fallback sur guitar seul si preset absent', () => {
    const result = getRowPlaylistData(SONG_AC_DC, null, GUITAR_SG, 88, true);
    expect(result.maxPresetScore).toBeNull();
    expect(result.absoluteScore).toBe(88);
  });

  it('absoluteScore : fallback sur preset seul si guitar absent', () => {
    const aiC = { preset_ann: { bank: 9, col: 'C', label: 'X', score: 78 } };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, null, null, false);
    expect(result.absoluteScore).toBe(78);
  });
});

describe('getRowPlaylistData — cas dégénérés', () => {
  it('aiC null → needsAnalysis true', () => {
    const result = getRowPlaylistData(SONG_AC_DC, null, GUITAR_SG, null, false);
    expect(result.devices).toEqual([]);
    expect(result.potards).toBeNull();
    expect(result.fxOn).toEqual([]);
    expect(result.topScore).toBeNull();
    expect(result.needsAnalysis).toBe(true);
  });

  it('aiC avec preset mais sans bank/col → device pas affiché', () => {
    const aiC = {
      preset_ann: { label: 'X', score: 80 }, // pas de bank/col
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 90, true);
    expect(result.devices).toEqual([]);
  });

  it('aiC avec preset_ann.score absent → device présent mais score null', () => {
    const aiC = {
      preset_ann: { bank: 1, col: 'A', label: 'X' }, // pas de score
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 90, true);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].presetScore).toBeNull();
    // topScore fallback sur guitarScore
    expect(result.topScore).toBe(90);
  });

  it('guitar null → guitarLabel null', () => {
    const aiC = { preset_ann: { bank: 9, col: 'C', label: 'X', score: 80 } };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, null, null, false);
    expect(result.guitarLabel).toBeNull();
    expect(result.guitarScore).toBeNull();
  });

  it('guitarScore=0 → considéré null (non significatif)', () => {
    const result = getRowPlaylistData(SONG_AC_DC, null, GUITAR_SG, 0, false);
    expect(result.guitarScore).toBeNull();
    expect(result.needsAnalysis).toBe(true);
  });

  it('guitarScore=NaN → null', () => {
    const result = getRowPlaylistData(SONG_AC_DC, null, GUITAR_SG, NaN, false);
    expect(result.guitarScore).toBeNull();
  });

  it('song undefined → title/artist vides, pas de crash', () => {
    const result = getRowPlaylistData(undefined, null, null, null, false);
    expect(result.title).toBe('');
    expect(result.artist).toBe('');
    expect(result.needsAnalysis).toBe(true);
  });
});

describe('getRowPlaylistData — fix bank=0 (Sébastien 25/05)', () => {
  it('preset_ann.bank=0 (slot 0A) → device affiché (pas filtré)', () => {
    const aiC = {
      preset_ann: { bank: 0, col: 'A', label: 'CL DMBL', score: 88 },
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 90, true);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].slot).toBe('0A');
    expect(result.devices[0].presetName).toBe('CL DMBL');
  });

  it('preset_plug.bank=0 → device affiché aussi', () => {
    const aiC = {
      preset_plug: { bank: 0, col: 'B', label: 'Plug Preset Bank 0', score: 80 },
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 90, true);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].slot).toBe('0B');
  });

  it('scénario user : preset_ann bank=0 + preset_plug bank=4 → 2 devices', () => {
    const aiC = {
      preset_ann: { bank: 0, col: 'A', label: 'CL DMBL', score: 88 },
      preset_plug: { bank: 4, col: 'B', label: 'Some plug', score: 85 },
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 90, true);
    expect(result.devices).toHaveLength(2);
    expect(result.devices[0].slot).toBe('0A');
    expect(result.devices[1].slot).toBe('4B');
  });

  it('preset_ann sans bank ni col → filtré (pas affiché)', () => {
    const aiC = { preset_ann: { label: 'X', score: 80 } };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 90, true);
    expect(result.devices).toEqual([]);
  });

  it('preset_ann.col vide string → filtré', () => {
    const aiC = { preset_ann: { bank: 5, col: '', label: 'X', score: 80 } };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 90, true);
    expect(result.devices).toEqual([]);
  });
});

describe('getRowPlaylistData — extras Phase 9 absents', () => {
  it('pas de preset_settings_v1 ni fx_blocks → potards/fxOn null/[]', () => {
    const aiC = {
      preset_ann: { bank: 9, col: 'C', label: 'X', score: 80 },
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 90, true);
    expect(result.potards).toBeNull();
    expect(result.fxOn).toEqual([]);
  });

  it('preset_settings_v1 partiel (gain seul) → potards partiel', () => {
    const aiC = {
      preset_ann: { bank: 9, col: 'C', label: 'X', score: 80 },
      preset_settings_v1: { main: { gain: 7 } },
    };
    const result = getRowPlaylistData(SONG_AC_DC, aiC, GUITAR_SG, 90, true);
    expect(result.potards).toBe('G7');
  });
});

describe('DEVICE_SHORT_LABELS', () => {
  it('expose les 3 labels courts', () => {
    expect(DEVICE_SHORT_LABELS['tonex-pedal']).toBe('Pedal');
    expect(DEVICE_SHORT_LABELS['tonex-anniversary']).toBe('Anniv');
    expect(DEVICE_SHORT_LABELS['tonex-plug']).toBe('Plug');
  });
});
