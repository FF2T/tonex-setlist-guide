// @vitest-environment jsdom
//
// Smoke test — mount React de SongDetailCard sur le chemin BASSE complet.
//
// Raison d'être : le hotfix v8.14.286 (écran noir prod vue dépliée,
// 2026-05-28) a corrigé un ReferenceError TDZ — `selectedBassScore` (IIFE
// exécutée à la déclaration) lisait `cotBasses` déclaré plus bas dans la
// même IIFE du bloc "Recommandations basse". Bug runtime-only : ni la suite
// Vitest (helpers purs), ni le build Vite, ni le smoke test main.jsx (qui
// monte <App/> mais n'atteint jamais la vue dépliée bass) ne l'attrapaient.
//
// Ce test monte SongDetailCard avec un profil bass-actif + un aiCache
// contenant un bass_recommendation complet (cot_step2_basses + alternatives
// + EQ + FX), ce qui exécute toute l'IIFE bass. Si un const y est référencé
// avant sa déclaration, le render throw → test rouge. Filet anti-régression
// pour les bugs d'ordre de déclaration dans le bloc bass.

import { describe, test, expect, beforeAll, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { SongDetailCard } from './SongDetailCard.jsx';
import { SCORING_VERSION } from '../../core/scoring/index.js';

beforeAll(() => {
  globalThis.fetch = () => Promise.resolve({
    ok: false, status: 0,
    json: () => Promise.resolve({}), text: () => Promise.resolve(''),
  });
  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false, media: '', onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent() { return false; },
    });
  }
  window.scrollTo = () => {};
  process.on('unhandledRejection', () => {});
});

afterEach(() => { cleanup(); });

// aiCache avec bass_recommendation complet (les 4 cadres + selectedBassScore).
const tri = (s) => ({ fr: s, en: s, es: s });
const bassReco = {
  ideal_bass: 'Fender Jazz Bass Player Plus',
  bass_reason: tri('Polyvalente pour ce style.'),
  ref_bassist: 'John Deacon',
  ref_bass_guitar: 'Fender Precision Bass',
  ref_bass_amp: 'Ampeg SVT',
  ref_bass_effects: 'Aucun effet',
  capture_name: 'BS SVT',
  cot_step2_basses: [
    { name: 'Fender Jazz Bass Player Plus', score: 90, reason: tri('Punch et clarté.') },
    { name: 'Fender Precision Bass American Vintage II', score: 82, reason: tri('Assise ronde.') },
  ],
  bass_alternatives: [
    { name: 'BS SVT', amp: 'Ampeg SVT', score: 91 },
    { name: 'TSR GK MBS150', amp: 'GK Bass', score: 74 },
  ],
  amp_settings: { gain: 5, bass: 6, low_mid: 6, high_mid: 5, treble: 4, master: 6, channel: 'Clean' },
  settings_bass: tri('Joue aux doigts.'),
  bass_preset_settings_v1: {
    cab_enabled: true,
    main: {
      gain: { value: 4, why: tri('x') }, bass: { value: 6, why: tri('x') },
      mid: { value: 5, why: tri('x') }, treble: { value: 4, why: tri('x') },
      volume: { value: 6, why: tri('x') },
    },
    why: tri('EQ basse de référence.'),
  },
  bass_fx_blocks: {
    compressor: { enabled: true, threshold: -18, gain: 2, attack: 12, why: tri('Ronde l\'attaque.') },
    reverb: { enabled: false, why: tri('x') },
  },
};

const song = {
  id: 'bass_smoke_song',
  title: 'Under Pressure',
  artist: 'Queen',
  ig: [],
  aiCache: {
    sv: SCORING_VERSION, // pas de needsRescore
    result: {
      cot_step1: tri('Profil tonal.'),
      cot_step2_guitars: [],
      bass_recommendation: bassReco,
    },
  },
};

const profile = {
  id: 'p_bass', name: 'Bassiste', isAdmin: false,
  instruments: ['guitar', 'bass'],
  myBasses: ['jazz_bass_player_plus', 'precision_avri'],
  myBassAmps: ['rumble_100'],
  // Phase B — contexte de jeu sur basse : la section basse n'est rendue
  // que si playCtx.instrument === 'bass' (filtre instrument).
  playInstrument: 'bass',
};

const noop = () => {};
const baseProps = {
  song, banksAnn: {}, banksPlug: {}, onBanksAnn: noop, onBanksPlug: noop,
  onClose: noop, guitars: [], allRigsGuitars: [], availableSources: {},
  savedGuitarId: undefined, onGuitarChange: noop, savedBassId: undefined,
  onBassChange: noop, aiProvider: 'gemini', aiKeys: {}, onSongDb: noop,
  onAiCacheUpdate: noop, profile, guitarBias: {}, onTmpPatchOverride: noop,
  songDb: [song], onProfiles: noop, activeProfileId: 'p_bass',
  toneNetPresets: [], onToneNetPresets: noop, onSharedUsagesOverrides: noop,
};

describe('SongDetailCard — smoke mount chemin basse (filet TDZ)', () => {
  test('le mount de la vue dépliée bass ne throw pas (cot_step2_basses + EQ + FX)', () => {
    let result;
    expect(() => { result = render(<SongDetailCard {...baseProps} />); }).not.toThrow();
    // Les cadres bass doivent être rendus (preuve que l'IIFE bass s'exécute).
    expect(document.body.textContent).toContain('Scoring basses');
    if (result) result.unmount();
  });

  test('rend aussi sans bass_alternatives/EQ/FX (aiCache pré-vague-B partiel)', () => {
    const partialSong = {
      ...song,
      aiCache: {
        sv: SCORING_VERSION,
        result: {
          cot_step1: tri('x'),
          bass_recommendation: { ideal_bass: 'Fender Jazz Bass Player Plus', bass_reason: tri('x') },
        },
      },
    };
    let result;
    expect(() => { result = render(<SongDetailCard {...baseProps} song={partialSong} />); }).not.toThrow();
    if (result) result.unmount();
  });
});
