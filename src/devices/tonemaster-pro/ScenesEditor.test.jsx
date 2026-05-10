// @vitest-environment jsdom
//
// Tests UI du ScenesEditor TMP — Phase 4.

import { describe, test, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import ScenesEditor, { serializeFs, deserializeFs, nextSceneId } from './ScenesEditor.jsx';
import { ROCK_PRESET } from './catalog.js';

describe('serializeFs / deserializeFs — round trip', () => {
  test('scene', () => {
    const e = { type: 'scene', sceneId: 'rythme' };
    expect(deserializeFs(serializeFs(e))).toEqual(e);
  });
  test('toggle', () => {
    const e = { type: 'toggle', block: 'drive' };
    expect(deserializeFs(serializeFs(e))).toEqual(e);
  });
  test('tap_tempo', () => {
    const e = { type: 'tap_tempo' };
    expect(deserializeFs(serializeFs(e))).toEqual(e);
  });
  test('vide', () => {
    expect(serializeFs(undefined)).toBe('');
    expect(deserializeFs('')).toBe(undefined);
  });
});

describe('nextSceneId', () => {
  test('sans existing → scene1', () => {
    expect(nextSceneId([])).toBe('scene1');
  });
  test('scene1 pris → scene2', () => {
    expect(nextSceneId(['scene1'])).toBe('scene2');
  });
  test('autre nom déjà pris ne bloque pas', () => {
    expect(nextSceneId(['rythme', 'solo'])).toBe('scene1');
  });
});

describe('ScenesEditor — read-only (sans callbacks)', () => {
  test('rock_preset → affiche les 2 scenes Rythme/Solo', () => {
    const { container } = render(<ScenesEditor patch={ROCK_PRESET}/>);
    expect(container.querySelector('[data-testid="tmp-scene-row-rythme"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-scene-row-solo"]')).not.toBeNull();
    // Pas de bouton "+ Ajouter une scene" en read-only.
    expect(container.querySelector('[data-testid="tmp-scene-add"]')).toBeNull();
  });

  test('patch sans scenes ni footswitchMap (read-only) → null render', () => {
    const patch = { id: 'p', amp: { model: 'X', enabled: true, params: {} } };
    const { container } = render(<ScenesEditor patch={patch}/>);
    expect(container.querySelector('[data-testid="tmp-scenes-editor"]')).toBeNull();
  });

  test('inputs name désactivés en read-only', () => {
    const { container } = render(<ScenesEditor patch={ROCK_PRESET}/>);
    const nameInput = container.querySelector(
      '[data-testid="tmp-scene-row-rythme"] input[type="text"]',
    );
    expect(nameInput.disabled).toBe(true);
  });
});

describe('ScenesEditor — édition', () => {
  test('rename scene appelle onScenesChange avec name modifié', () => {
    const onScenesChange = vi.fn();
    const { container } = render(
      <ScenesEditor patch={ROCK_PRESET} onScenesChange={onScenesChange}/>,
    );
    const nameInput = container.querySelector(
      '[data-testid="tmp-scene-row-rythme"] input[type="text"]',
    );
    fireEvent.change(nameInput, { target: { value: 'Verse' } });
    expect(onScenesChange).toHaveBeenCalledTimes(1);
    const [scenes] = onScenesChange.mock.calls[0];
    expect(scenes[0].name).toBe('Verse');
    expect(scenes[1].name).toBe('Solo'); // inchangée
  });

  test('changer ampLevel appelle onScenesChange avec ampLevelOverride à jour', () => {
    const onScenesChange = vi.fn();
    const { container } = render(
      <ScenesEditor patch={ROCK_PRESET} onScenesChange={onScenesChange}/>,
    );
    const lvlInput = container.querySelector(
      '[data-testid="tmp-scene-row-solo"] input[type="number"]',
    );
    fireEvent.change(lvlInput, { target: { value: '85' } });
    expect(onScenesChange).toHaveBeenCalled();
    const [scenes] = onScenesChange.mock.calls[onScenesChange.mock.calls.length - 1];
    expect(scenes[1].ampLevelOverride).toBe(85);
  });

  test('ampLevel vide → ampLevelOverride supprimé (undefined)', () => {
    const onScenesChange = vi.fn();
    const { container } = render(
      <ScenesEditor patch={ROCK_PRESET} onScenesChange={onScenesChange}/>,
    );
    const lvlInput = container.querySelector(
      '[data-testid="tmp-scene-row-solo"] input[type="number"]',
    );
    fireEvent.change(lvlInput, { target: { value: '' } });
    const [scenes] = onScenesChange.mock.calls[onScenesChange.mock.calls.length - 1];
    expect(scenes[1].ampLevelOverride).toBe(undefined);
  });

  test('ampLevel hors borne (150) → clamp à 100', () => {
    const onScenesChange = vi.fn();
    const { container } = render(
      <ScenesEditor patch={ROCK_PRESET} onScenesChange={onScenesChange}/>,
    );
    const lvlInput = container.querySelector(
      '[data-testid="tmp-scene-row-rythme"] input[type="number"]',
    );
    fireEvent.change(lvlInput, { target: { value: '150' } });
    const [scenes] = onScenesChange.mock.calls[onScenesChange.mock.calls.length - 1];
    expect(scenes[0].ampLevelOverride).toBe(100);
  });

  test('+ Ajouter une scene crée une nouvelle scene avec id unique', () => {
    const onScenesChange = vi.fn();
    const { container } = render(
      <ScenesEditor patch={ROCK_PRESET} onScenesChange={onScenesChange}/>,
    );
    const addBtn = container.querySelector('[data-testid="tmp-scene-add"]');
    fireEvent.click(addBtn);
    const [scenes] = onScenesChange.mock.calls[0];
    expect(scenes).toHaveLength(3);
    expect(scenes[2].id).toBe('scene1'); // pas de "scene1" dans rock_preset
  });

  test('Supprimer une scene retire de la liste + nettoie le footswitchMap', () => {
    const onScenesChange = vi.fn();
    const onFootswitchChange = vi.fn();
    const { container } = render(
      <ScenesEditor
        patch={ROCK_PRESET}
        onScenesChange={onScenesChange}
        onFootswitchChange={onFootswitchChange}
      />,
    );
    const delBtn = container.querySelector(
      '[data-testid="tmp-scene-row-rythme"] button[aria-label^="Supprimer"]',
    );
    fireEvent.click(delBtn);
    const [scenes] = onScenesChange.mock.calls[0];
    expect(scenes).toHaveLength(1);
    expect(scenes[0].id).toBe('solo');
    // Le fs1 pointait sur rythme → nettoyé.
    expect(onFootswitchChange).toHaveBeenCalled();
    const [fsMap] = onFootswitchChange.mock.calls[0];
    expect(fsMap.fs1).toBe(undefined);
    expect(fsMap.fs2?.sceneId).toBe('solo'); // préservé
  });

  test('changer un dropdown FS appelle onFootswitchChange', () => {
    const onFootswitchChange = vi.fn();
    const { container } = render(
      <ScenesEditor
        patch={ROCK_PRESET}
        onFootswitchChange={onFootswitchChange}
        onScenesChange={() => {}}
      />,
    );
    const fs3Select = container.querySelector('select[aria-label="Action fs3"]');
    fireEvent.change(fs3Select, { target: { value: 'tap_tempo' } });
    const [fsMap] = onFootswitchChange.mock.calls[onFootswitchChange.mock.calls.length - 1];
    expect(fsMap.fs3).toEqual({ type: 'tap_tempo' });
  });

  test('reset FS via "— aucun —" supprime l\'entrée', () => {
    const onFootswitchChange = vi.fn();
    const { container } = render(
      <ScenesEditor
        patch={ROCK_PRESET}
        onFootswitchChange={onFootswitchChange}
        onScenesChange={() => {}}
      />,
    );
    const fs1Select = container.querySelector('select[aria-label="Action fs1"]');
    fireEvent.change(fs1Select, { target: { value: '' } });
    const [fsMap] = onFootswitchChange.mock.calls[onFootswitchChange.mock.calls.length - 1];
    expect(fsMap.fs1).toBe(undefined);
    // fs2 préservé
    expect(fsMap.fs2?.sceneId).toBe('solo');
  });
});

describe('ScenesEditor — toggle blocs sur scene', () => {
  test('cycle 3 états drive: hérité → OFF → ON → hérité', () => {
    const onScenesChange = vi.fn();
    const { container, rerender } = render(
      <ScenesEditor patch={ROCK_PRESET} onScenesChange={onScenesChange}/>,
    );
    // Bouton drive de la scene rythme (Drive non-toggled au départ).
    const driveBtn = container.querySelector(
      '[data-testid="tmp-scene-row-rythme"] button[title^="Drive"]',
    );
    expect(driveBtn).not.toBeNull();

    // 1er click : hérité → OFF
    fireEvent.click(driveBtn);
    let [scenes] = onScenesChange.mock.calls[0];
    expect(scenes[0].blockToggles?.drive).toBe(false);

    // Re-render avec le state mis à jour pour second click
    const patchMid = { ...ROCK_PRESET, scenes: scenes };
    rerender(<ScenesEditor patch={patchMid} onScenesChange={onScenesChange}/>);
    const driveBtn2 = container.querySelector(
      '[data-testid="tmp-scene-row-rythme"] button[title^="Drive"]',
    );
    fireEvent.click(driveBtn2);
    [scenes] = onScenesChange.mock.calls[1];
    expect(scenes[0].blockToggles?.drive).toBe(true);

    // 3e click : ON → hérité (clé supprimée)
    const patchMid2 = { ...ROCK_PRESET, scenes: scenes };
    rerender(<ScenesEditor patch={patchMid2} onScenesChange={onScenesChange}/>);
    const driveBtn3 = container.querySelector(
      '[data-testid="tmp-scene-row-rythme"] button[title^="Drive"]',
    );
    fireEvent.click(driveBtn3);
    [scenes] = onScenesChange.mock.calls[2];
    expect(scenes[0].blockToggles).toBe(undefined);
  });
});
