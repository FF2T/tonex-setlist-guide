// Tests du catalog factory TMP : 3 Arthur EXACTS + couverture seed +
// validation structurelle.

import { describe, test, expect } from 'vitest';
import {
  TMP_FACTORY_PATCHES,
  ROCK_PRESET, CLEAN_PRESET, FLIPPER_PATCH,
  STAIRWAY_PATCH, MONEY_PATCH, ROMEO_PATCH, MUDDY_PATCH,
  findPatchById, getFactoryPatches,
} from './catalog.js';
import { validatePatch } from './chain-model.js';
import { recommendTMPPatch } from './scoring.js';
import { INIT_SONG_DB_META, SONG_HISTORY } from '../../core/songs.js';

describe('Catalog TMP — 20 patches factory au total', () => {
  test('3 Arthur + 4 orphan + 13 family = 20', () => {
    expect(TMP_FACTORY_PATCHES.length).toBe(20);
  });

  test('Tous factory:true', () => {
    TMP_FACTORY_PATCHES.forEach((p) => {
      expect(p.factory).toBe(true);
    });
  });

  test('Chaque patch a un id unique', () => {
    const ids = TMP_FACTORY_PATCHES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('findPatchById fonctionne pour chaque patch', () => {
    TMP_FACTORY_PATCHES.forEach((p) => {
      expect(findPatchById(p.id)).toBe(p);
    });
    expect(findPatchById('does-not-exist')).toBe(null);
  });
});

describe('Catalog TMP — patches Arthur EXACTS (recopiés depuis CLAUDE.md)', () => {
  test("Rock Preset (slot 211/213) — Plexi + Super Drive + 4x12 Greenback (valeurs Arthur 10 mai 2026)", () => {
    expect(ROCK_PRESET.id).toBe('rock_preset');
    expect(ROCK_PRESET.source).toBe('arthur');
    expect(ROCK_PRESET.amp.model).toBe('British Plexi');
    // Valeurs CORRIGÉES Phase 3.8 — retour Arthur (Plexi cranked 10/10).
    expect(ROCK_PRESET.amp.params.volume_i).toBe(10);
    expect(ROCK_PRESET.amp.params.volume_ii).toBe(10);
    expect(ROCK_PRESET.amp.params.treble).toBe(8.5);
    expect(ROCK_PRESET.amp.params.middle).toBe(5);
    expect(ROCK_PRESET.amp.params.bass).toBe(0);
    expect(ROCK_PRESET.amp.params.presence).toBe(5);
    // Drive Super Drive — beaucoup plus discret (boost transparent).
    expect(ROCK_PRESET.drive.model).toBe('Super Drive');
    expect(ROCK_PRESET.drive.params.drive).toBe(2.5);
    expect(ROCK_PRESET.drive.params.level).toBe(3);
    expect(ROCK_PRESET.drive.params.tone).toBe(8);
    // Cab 4x12 Greenback (inchangé).
    expect(ROCK_PRESET.cab.model).toBe('4x12 British Plexi Greenback');
    expect(ROCK_PRESET.cab.params.mic).toBe('Dyn SM57');
    expect(ROCK_PRESET.cab.params.distance).toBe(6);
    // Noise gate à fond (gate très agressif).
    expect(ROCK_PRESET.noise_gate.model).toBe('Noise Reducer');
    expect(ROCK_PRESET.noise_gate.params.threshold).toBe(10);
    expect(ROCK_PRESET.noise_gate.params.attenuation).toBe(10);
    // Delay Digital (inchangé).
    expect(ROCK_PRESET.delay.params.time).toBe(350);
    expect(ROCK_PRESET.delay.params.feedback).toBe(25);
    // Reverb Spring — mixer plus discret (2.5 au lieu de 3 par défaut).
    expect(ROCK_PRESET.reverb.params.mixer).toBe(2.5);
    expect(ROCK_PRESET.reverb.params.dwell).toBe(8);
    expect(ROCK_PRESET.reverb.params.tone).toBe(6);
    // Style + pickup (inchangés).
    expect(ROCK_PRESET.style).toBe('hard_rock');
    expect(ROCK_PRESET.gain).toBe('mid');
    expect(ROCK_PRESET.pickupAffinity).toEqual({ HB: 95, SC: 70, P90: 80 });
    // Validation passe (decimals OK : validateBlock accepte tout number).
    expect(validatePatch(ROCK_PRESET).valid).toBe(true);
  });

  test('Rock Preset — playingTipsBySong et notes footswitch solo (Phase 3.8)', () => {
    // FIX 2 — playingTipsBySong : conseil par song.id.
    expect(ROCK_PRESET.playingTipsBySong).toBeDefined();
    expect(ROCK_PRESET.playingTipsBySong.cream_wr).toContain('micro manche');
    expect(ROCK_PRESET.playingTipsBySong.cream_wr).toContain('tonalité à 0');
    // FIX 3 — notes mentionnent le footswitch solo + Scene Phase 4.
    expect(ROCK_PRESET.notes).toContain('Footswitch solo');
    expect(ROCK_PRESET.notes).toContain('70% à 100%');
    expect(ROCK_PRESET.notes).toContain('Scene');
  });

  test('Clean Preset (slot 210) — EQ + Studio Comp + Twin Reverb + 2x12 Twin D120', () => {
    expect(CLEAN_PRESET.id).toBe('clean_preset');
    expect(CLEAN_PRESET.source).toBe('arthur');
    expect(CLEAN_PRESET.amp.model).toBe("Fender '65 Twin Reverb");
    expect(CLEAN_PRESET.amp.params.gain).toBe(4);
    expect(CLEAN_PRESET.amp.params.bass).toBe(7);
    expect(CLEAN_PRESET.amp.params.mid).toBe(6);
    // EQ avec low_gain -12
    expect(CLEAN_PRESET.eq.params.low_freq).toBe(98);
    expect(CLEAN_PRESET.eq.params.low_gain).toBe(-12);
    expect(CLEAN_PRESET.eq.params.mid_freq).toBe(2000);
    // Comp
    expect(CLEAN_PRESET.comp.model).toBe('Studio Compressor');
    expect(CLEAN_PRESET.comp.params.threshold).toBe(5);
    // Cab 2x12 Twin D120 + Ribbon R121
    expect(CLEAN_PRESET.cab.model).toBe('2x12 Twin D120');
    expect(CLEAN_PRESET.cab.params.mic).toBe('Ribbon R121');
    expect(CLEAN_PRESET.cab.params.axis).toBe('off');
    expect(CLEAN_PRESET.cab.params.distance).toBe(3);
    // Style + pickup
    expect(CLEAN_PRESET.style).toBe('blues');
    expect(CLEAN_PRESET.gain).toBe('low');
    expect(CLEAN_PRESET.pickupAffinity).toEqual({ HB: 90, SC: 75, P90: 85 });
    expect(validatePatch(CLEAN_PRESET).valid).toBe(true);
  });

  test('Flipper (slot 202) — Bassman cranked + 4x10 Bassman Tweed + Spring', () => {
    expect(FLIPPER_PATCH.id).toBe('flipper_patch');
    expect(FLIPPER_PATCH.source).toBe('arthur');
    expect(FLIPPER_PATCH.amp.model).toBe("Fender '59 Bassman");
    expect(FLIPPER_PATCH.amp.params.gain).toBe(6);
    expect(FLIPPER_PATCH.amp.params.treble).toBe(7);
    expect(FLIPPER_PATCH.amp.params.mid).toBe(7);
    expect(FLIPPER_PATCH.amp.params.bass).toBe(8);
    expect(FLIPPER_PATCH.amp.params.presence).toBe(6);
    expect(FLIPPER_PATCH.cab.model).toBe("4x10 '59 Bassman Tweed");
    expect(FLIPPER_PATCH.cab.params.mic).toBe('Dyn SM57');
    expect(FLIPPER_PATCH.cab.params.distance).toBe(6);
    // Pas de drive ni FX modulation (chaîne minimaliste)
    expect(FLIPPER_PATCH.drive).toBeUndefined();
    expect(FLIPPER_PATCH.mod).toBeUndefined();
    expect(FLIPPER_PATCH.delay).toBeUndefined();
    // Spring reverb signature Arthur
    expect(FLIPPER_PATCH.reverb.model).toBe('Spring');
    expect(FLIPPER_PATCH.reverb.params.dwell).toBe(7);
    // Style + pickup
    expect(FLIPPER_PATCH.style).toBe('rock');
    expect(FLIPPER_PATCH.gain).toBe('mid');
    expect(FLIPPER_PATCH.pickupAffinity).toEqual({ HB: 90, SC: 80, P90: 85 });
    expect(validatePatch(FLIPPER_PATCH).valid).toBe(true);
  });
});

describe('Catalog TMP — patches orphelins seed (4)', () => {
  test('stairway_patch existe et passe validation', () => {
    expect(STAIRWAY_PATCH.id).toBe('stairway_patch');
    expect(STAIRWAY_PATCH.source).toBe('orphan');
    expect(validatePatch(STAIRWAY_PATCH).valid).toBe(true);
    expect(STAIRWAY_PATCH.usages.some((u) => u.songs?.includes('Stairway to Heaven'))).toBe(true);
  });

  test('money_patch existe et passe validation', () => {
    expect(MONEY_PATCH.source).toBe('orphan');
    expect(validatePatch(MONEY_PATCH).valid).toBe(true);
  });

  test('romeo_patch existe et passe validation', () => {
    expect(ROMEO_PATCH.source).toBe('orphan');
    expect(validatePatch(ROMEO_PATCH).valid).toBe(true);
  });

  test('muddy_patch existe et passe validation', () => {
    expect(MUDDY_PATCH.source).toBe('orphan');
    expect(validatePatch(MUDDY_PATCH).valid).toBe(true);
  });
});

describe('Catalog TMP — patches famille (13) ont tous un champ usages non-vide', () => {
  test('13 patches family avec usages renseignés', () => {
    const family = TMP_FACTORY_PATCHES.filter((p) => p.source === 'generated');
    expect(family.length).toBe(13);
    family.forEach((p) => {
      expect(Array.isArray(p.usages)).toBe(true);
      expect(p.usages.length).toBeGreaterThan(0);
      p.usages.forEach((u) => {
        expect(typeof u.artist).toBe('string');
        expect(u.artist.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Catalog TMP — tous les patches passent validatePatch', () => {
  test.each(TMP_FACTORY_PATCHES.map((p) => [p.id, p]))('%s', (_id, patch) => {
    const r = validatePatch(patch);
    if (!r.valid) {
      throw new Error(`Patch ${patch.id} fails validation: ${r.errors.join(' | ')}`);
    }
    expect(r.valid).toBe(true);
  });
});

describe('Catalog TMP — chaque morceau du seed a au moins un patch matché', () => {
  test('chaque song INIT_SONG_DB_META → top patch existe avec score > 30', () => {
    const patches = getFactoryPatches();
    INIT_SONG_DB_META.forEach((meta) => {
      // Construire un song mock avec aiCache minimal (style + ref_amp depuis history)
      const hist = SONG_HISTORY[meta.id];
      const refAmp = hist?.amp || null;
      // Dériver style depuis l'artiste/genre (heuristique simple pour le test)
      const guess = guessStyleFromHistory(meta, hist);
      const songMock = {
        id: meta.id,
        title: meta.title,
        artist: meta.artist,
        aiCache: {
          result: {
            ref_amp: refAmp,
            ref_effects: hist?.effects || null,
            song_style: guess.style,
          },
        },
      };
      // Guitar mock — utilise le type recommandé pour le morceau
      const guitarMock = { id: 'lp60', type: 'HB', name: 'Les Paul' };
      const recs = recommendTMPPatch(patches, songMock, guitarMock, null);
      expect(recs.length).toBeGreaterThan(0);
      const top = recs[0];
      expect(top.score).toBeGreaterThan(30);
    });
  });
});

// Helper local : devine un style depuis l'artiste pour les tests (pas
// utilisé en production — le style vient normalement de l'AI cache).
function guessStyleFromHistory(meta, _hist) {
  const a = meta.artist.toLowerCase();
  if (a.includes('ac/dc') || a.includes('deep purple')) return { style: 'hard_rock' };
  if (a.includes('b.b. king') || a.includes('muddy')) return { style: 'blues' };
  if (a.includes('cream') || a.includes('led zep') || a.includes('téléphone')) return { style: 'rock' };
  if (a.includes('dire straits')) return { style: 'rock' };
  return { style: 'rock' };
}
