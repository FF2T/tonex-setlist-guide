// Tests des helpers TMP : validateBlock + validatePatch + getPatchBlocks
// + Phase 4 : validateScene + validateFootswitchMap + applyScene.

import { describe, test, expect } from 'vitest';
import {
  BLOCK_TYPES, validateBlock, validatePatch, getPatchBlocks, RENDER_ORDER,
  validateScene, validateFootswitchEntry, validateFootswitchMap, applyScene,
  TOGGLE_BLOCKS, FS_KEYS,
} from './chain-model.js';

describe('BLOCK_TYPES — 9 types incluant noise_gate + eq', () => {
  test('liste complète', () => {
    expect(BLOCK_TYPES).toEqual([
      'comp', 'drive', 'amp', 'cab', 'mod', 'delay', 'reverb', 'noise_gate', 'eq',
    ]);
  });
});

describe('validateBlock', () => {
  test('amp valide avec model whitelist → valid', () => {
    const r = validateBlock({
      type: 'amp', model: 'British Plexi', enabled: true,
      params: { volume_i: 5, treble: 6, bass: 5 },
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('type inconnu → invalid', () => {
    const r = validateBlock({ type: 'wahwah', model: 'X', enabled: true, params: {} });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('not in BLOCK_TYPES'))).toBe(true);
  });

  test('model hors whitelist → invalid', () => {
    const r = validateBlock({ type: 'amp', model: 'Inventor 9000', enabled: true, params: {} });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('not in whitelist'))).toBe(true);
  });

  test('params avec >10 clés → invalid', () => {
    const params = {};
    for (let i = 0; i < 12; i++) params[`p${i}`] = i;
    const r = validateBlock({ type: 'amp', model: 'British Plexi', enabled: true, params });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('too many params'))).toBe(true);
  });

  test('cab avec params strings (mic, axis) → valide', () => {
    const r = validateBlock({
      type: 'cab', model: '4x12 British Plexi Greenback', enabled: true,
      params: { mic: 'Dyn SM57', axis: 'on', distance: 6, low_cut: 20, high_cut: 20000 },
    });
    expect(r.valid).toBe(true);
  });

  test('enabled non-boolean → invalid', () => {
    const r = validateBlock({ type: 'drive', model: 'Klon', enabled: 'yes', params: {} });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('enabled must be a boolean'))).toBe(true);
  });

  test('block null → invalid', () => {
    const r = validateBlock(null);
    expect(r.valid).toBe(false);
  });
});

describe('validatePatch', () => {
  const baseAmp = { model: 'British Plexi', enabled: true, params: { gain: 5 } };
  const baseCab = { model: '4x12 British Plexi Greenback', enabled: true, params: { low_cut: 20 } };

  test('patch minimal valide (amp + cab + style + gain + pickupAffinity)', () => {
    const r = validatePatch({
      id: 'test', name: 'Test',
      amp: baseAmp, cab: baseCab,
      style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 80, SC: 60, P90: 70 },
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('sans amp → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', cab: baseCab, style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('amp block is required');
  });

  test('sans cab → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', amp: baseAmp, style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('cab block is required');
  });

  test('pickupAffinity hors 0-100 → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', amp: baseAmp, cab: baseCab, style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 150, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('pickupAffinity.HB'))).toBe(true);
  });

  test('style hors STYLES → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', amp: baseAmp, cab: baseCab,
      style: 'reggae', gain: 'mid', pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('style "reggae"'))).toBe(true);
  });

  test('gain hors GAINS → invalid', () => {
    const r = validatePatch({
      id: 'x', name: 'X', amp: baseAmp, cab: baseCab,
      style: 'rock', gain: 'extreme', pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('gain "extreme"'))).toBe(true);
  });

  test('amp model hors whitelist → invalid (cascade depuis validateBlock)', () => {
    const r = validatePatch({
      id: 'x', name: 'X',
      amp: { model: 'FakeAmp', enabled: true, params: {} },
      cab: baseCab,
      style: 'rock', gain: 'mid',
      pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('amp:') && e.includes('not in whitelist'))).toBe(true);
  });
});

describe('validateScene — Phase 4', () => {
  test('scene minimale (id + name) → valide', () => {
    const r = validateScene({ id: 'rythme', name: 'Rythme' });
    expect(r.valid).toBe(true);
  });
  test('scene avec ampLevelOverride dans [0,100] → valide', () => {
    const r = validateScene({ id: 'solo', name: 'Solo', ampLevelOverride: 100 });
    expect(r.valid).toBe(true);
  });
  test('ampLevelOverride hors borne → invalide', () => {
    const r = validateScene({ id: 's', name: 'S', ampLevelOverride: 150 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('ampLevelOverride'))).toBe(true);
  });
  test('blockToggles avec block inconnu → invalide', () => {
    const r = validateScene({ id: 's', name: 'S', blockToggles: { wahwah: true } });
    expect(r.valid).toBe(false);
  });
  test('blockToggles avec valeur non-boolean → invalide', () => {
    const r = validateScene({ id: 's', name: 'S', blockToggles: { drive: 1 } });
    expect(r.valid).toBe(false);
  });
  test('paramOverrides valide → valide', () => {
    const r = validateScene({
      id: 's', name: 'S',
      paramOverrides: { delay: { mix: 30, time: 500 } },
    });
    expect(r.valid).toBe(true);
  });
  test('paramOverrides avec block inconnu → invalide', () => {
    const r = validateScene({
      id: 's', name: 'S',
      paramOverrides: { wahwah: { rate: 5 } },
    });
    expect(r.valid).toBe(false);
  });
  test('id ou name manquant → invalide', () => {
    expect(validateScene({ name: 'X' }).valid).toBe(false);
    expect(validateScene({ id: 'x' }).valid).toBe(false);
    expect(validateScene(null).valid).toBe(false);
  });
});

describe('validateFootswitchEntry — Phase 4', () => {
  test("type 'scene' avec sceneId → valide", () => {
    const r = validateFootswitchEntry({ type: 'scene', sceneId: 'solo' });
    expect(r.valid).toBe(true);
  });
  test("type 'toggle' sur block toggleable → valide", () => {
    const r = validateFootswitchEntry({ type: 'toggle', block: 'drive' });
    expect(r.valid).toBe(true);
  });
  test("type 'toggle' sur amp (non toggleable) → invalide", () => {
    const r = validateFootswitchEntry({ type: 'toggle', block: 'amp' });
    expect(r.valid).toBe(false);
  });
  test("type 'tap_tempo' sans param → valide", () => {
    expect(validateFootswitchEntry({ type: 'tap_tempo' }).valid).toBe(true);
  });
  test('type inconnu → invalide', () => {
    const r = validateFootswitchEntry({ type: 'midi', cc: 12 });
    expect(r.valid).toBe(false);
  });
  test("entry 'scene' sans sceneId → invalide", () => {
    const r = validateFootswitchEntry({ type: 'scene' });
    expect(r.valid).toBe(false);
  });
});

describe('validateFootswitchMap — Phase 4', () => {
  test('map vide → valide', () => {
    expect(validateFootswitchMap({}).valid).toBe(true);
  });
  test('map undefined → valide (optionnel)', () => {
    expect(validateFootswitchMap(undefined).valid).toBe(true);
  });
  test('fs1 + fs2 sur scenes existantes → valide', () => {
    const r = validateFootswitchMap({
      fs1: { type: 'scene', sceneId: 'rythme' },
      fs2: { type: 'scene', sceneId: 'solo' },
    }, ['rythme', 'solo']);
    expect(r.valid).toBe(true);
  });
  test('fs1 référence sceneId inexistant → invalide', () => {
    const r = validateFootswitchMap({ fs1: { type: 'scene', sceneId: 'ghost' } }, ['solo']);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('sceneId "ghost"'))).toBe(true);
  });
  test('clé fs5 → invalide', () => {
    const r = validateFootswitchMap({ fs5: { type: 'tap_tempo' } });
    expect(r.valid).toBe(false);
  });
  test('FS_KEYS et TOGGLE_BLOCKS exposés', () => {
    expect(FS_KEYS).toEqual(['fs1', 'fs2', 'fs3', 'fs4']);
    expect(TOGGLE_BLOCKS).toContain('drive');
    expect(TOGGLE_BLOCKS).not.toContain('amp');
  });
});

describe('validatePatch — scenes & footswitchMap (Phase 4)', () => {
  const baseAmp = { model: 'British Plexi', enabled: true, params: { gain: 5 } };
  const baseCab = { model: '4x12 British Plexi Greenback', enabled: true, params: { low_cut: 20 } };
  const base = {
    id: 'p', name: 'P', amp: baseAmp, cab: baseCab,
    style: 'rock', gain: 'mid',
    pickupAffinity: { HB: 80, SC: 60, P90: 70 },
  };

  test('patch + scenes valides → valide', () => {
    const r = validatePatch({
      ...base,
      scenes: [
        { id: 'rythme', name: 'Rythme', ampLevelOverride: 70 },
        { id: 'solo', name: 'Solo', ampLevelOverride: 100 },
      ],
      footswitchMap: {
        fs1: { type: 'scene', sceneId: 'rythme' },
        fs2: { type: 'scene', sceneId: 'solo' },
      },
    });
    expect(r.valid).toBe(true);
  });

  test('scenes avec id dupliqué → invalide', () => {
    const r = validatePatch({
      ...base,
      scenes: [
        { id: 'a', name: 'A' },
        { id: 'a', name: 'A2' },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('duplicate id'))).toBe(true);
  });

  test('footswitchMap référence sceneId absent → invalide', () => {
    const r = validatePatch({
      ...base,
      scenes: [{ id: 'rythme', name: 'Rythme' }],
      footswitchMap: { fs1: { type: 'scene', sceneId: 'solo' } },
    });
    expect(r.valid).toBe(false);
  });

  test('scenes pas un tableau → invalide', () => {
    const r = validatePatch({ ...base, scenes: { rythme: {} } });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('scenes must be an array');
  });

  test('patch sans scenes (rétrocompat Phase 3) → valide', () => {
    const r = validatePatch(base);
    expect(r.valid).toBe(true);
  });
});

describe('applyScene — Phase 4', () => {
  const patch = {
    id: 'rock', name: 'Rock',
    amp: { model: 'British Plexi', enabled: true, params: { volume_i: 10, treble: 8 } },
    cab: { model: '4x12 British Plexi Greenback', enabled: true, params: {} },
    drive: { model: 'Super Drive', enabled: true, params: { drive: 2.5 } },
    delay: { model: 'Digital Delay', enabled: true, params: { mix: 15 } },
    scenes: [
      { id: 'rythme', name: 'Rythme', ampLevelOverride: 70 },
      { id: 'solo', name: 'Solo', ampLevelOverride: 100,
        blockToggles: { delay: false },
        paramOverrides: { drive: { drive: 5 } } },
    ],
    style: 'hard_rock', gain: 'mid',
    pickupAffinity: { HB: 95, SC: 70, P90: 80 },
  };

  test('applyScene avec sceneId existant pose _ampLevel + _activeSceneId', () => {
    const r = applyScene(patch, 'rythme');
    expect(r._ampLevel).toBe(70);
    expect(r._activeSceneId).toBe('rythme');
    expect(r.drive.enabled).toBe(true); // pas de toggle dans rythme
  });

  test('applyScene applique blockToggles', () => {
    const r = applyScene(patch, 'solo');
    expect(r.delay.enabled).toBe(false);
    expect(r._ampLevel).toBe(100);
  });

  test('applyScene applique paramOverrides sans écraser les params non concernés', () => {
    const r = applyScene(patch, 'solo');
    expect(r.drive.params.drive).toBe(5);
    // les autres params préservés
    expect(r.amp.params.treble).toBe(8);
  });

  test('applyScene ne mute pas le patch original', () => {
    const original = JSON.parse(JSON.stringify(patch));
    applyScene(patch, 'solo');
    expect(patch).toEqual(original);
  });

  test('sceneId inexistant → patch tel quel', () => {
    const r = applyScene(patch, 'ghost');
    expect(r).toEqual(patch);
  });

  test('sceneId nul/undefined → patch tel quel', () => {
    expect(applyScene(patch, null)).toEqual(patch);
    expect(applyScene(patch, undefined)).toEqual(patch);
  });
});

describe('getPatchBlocks — ordre de rendu standard', () => {
  test('renvoie les blocs dans RENDER_ORDER', () => {
    const patch = {
      amp: { model: 'British Plexi', enabled: true, params: {} },
      cab: { model: '4x12 British Plexi Greenback', enabled: true, params: {} },
      drive: { model: 'Tube Screamer', enabled: true, params: {} },
      reverb: { model: 'Spring', enabled: true, params: {} },
    };
    const blocks = getPatchBlocks(patch);
    expect(blocks.map((b) => b.slot)).toEqual(['drive', 'amp', 'cab', 'reverb']);
  });

  test('RENDER_ORDER inclut noise_gate et eq', () => {
    expect(RENDER_ORDER[0]).toBe('noise_gate');
    expect(RENDER_ORDER).toContain('eq');
  });

  test('patch null → []', () => {
    expect(getPatchBlocks(null)).toEqual([]);
  });
});
