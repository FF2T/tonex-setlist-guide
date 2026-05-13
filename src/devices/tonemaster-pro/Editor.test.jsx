// @vitest-environment jsdom
//
// Tests UI du TmpPatchEditor (Phase 7.12) : clone, edit, save, delete,
// validation.

import { describe, test, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import TmpPatchEditor, { clonePatchAsCustom, genCustomId, deepClone } from './Editor.jsx';
import { ROCK_PRESET, CLEAN_PRESET } from './catalog.js';

describe('clonePatchAsCustom (Phase 7.12)', () => {
  test('clone deep, nouvel id, factory:false, source:custom, name + (copie)', () => {
    const c = clonePatchAsCustom(ROCK_PRESET);
    expect(c.id).toMatch(/^custom_/);
    expect(c.id).not.toBe(ROCK_PRESET.id);
    expect(c.factory).toBe(false);
    expect(c.source).toBe('custom');
    expect(c.name).toBe('Rock Preset (copie)');
    // Deep clone — modifier le clone ne touche pas l'original.
    c.amp.params.gain = 999;
    expect(ROCK_PRESET.amp.params.gain).not.toBe(999);
  });

  test('null → null', () => {
    expect(clonePatchAsCustom(null)).toBe(null);
  });

  test('preserve les blocs FX (drive, delay, reverb, etc.)', () => {
    const c = clonePatchAsCustom(ROCK_PRESET);
    expect(c.drive).toBeDefined();
    expect(c.delay).toBeDefined();
    expect(c.reverb).toBeDefined();
    expect(c.noise_gate).toBeDefined();
  });
});

describe('genCustomId', () => {
  test('format custom_<ts>_<rand>', () => {
    const id = genCustomId();
    expect(id).toMatch(/^custom_\d+_\d+$/);
  });
  test('ids majoritairement uniques (sur 100 calls, tolérance collisions sur Date.now() identique + Math.random 0-999)', () => {
    const ids = new Set(Array.from({ length: 100 }, () => genCustomId()));
    // En théorie ~5 collisions max sur 100 tirages dans un intervalle de 1000.
    // Tolérance large (>= 85) — l'idée est que ce n'est PAS systématiquement
    // collisionnant. En usage réel, le user ne génère pas 100 ids en 1ms.
    expect(ids.size).toBeGreaterThanOrEqual(85);
  });
});

describe('TmpPatchEditor — rendering + interactions', () => {
  test('rend les champs métadonnées + blocs amp/cab', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={() => {}} onCancel={() => {}}/>,
    );
    expect(container.querySelector('[data-testid="tmp-editor-overlay"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-editor-name"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-editor-block-amp"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-editor-block-cab"]')).not.toBeNull();
  });

  test('mode clone → titre "Nouveau patch TMP", pas de bouton delete', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={() => {}} onCancel={() => {}}/>,
    );
    expect(container.textContent).toContain('Nouveau patch TMP');
    expect(container.querySelector('[data-testid="tmp-editor-delete"]')).toBeNull();
  });

  test('mode edit + onDelete → bouton delete visible', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const onDelete = vi.fn();
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="edit" onSave={() => {}} onCancel={() => {}} onDelete={onDelete}/>,
    );
    expect(container.querySelector('[data-testid="tmp-editor-delete"]')).not.toBeNull();
  });

  test('modifier name + save → callback reçoit le patch updated', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const onSave = vi.fn();
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={onSave} onCancel={() => {}}/>,
    );
    const input = container.querySelector('[data-testid="tmp-editor-name"]');
    fireEvent.change(input, { target: { value: 'Mon Rock' } });
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-save"]'));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].name).toBe('Mon Rock');
    expect(onSave.mock.calls[0][0].amp.model).toBe(ROCK_PRESET.amp.model);
  });

  test('cancel → onCancel callback, pas de save', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={onSave} onCancel={onCancel}/>,
    );
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-cancel"]'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('changer amp model → save → patch updated avec nouveau model', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const onSave = vi.fn();
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={onSave} onCancel={() => {}}/>,
    );
    const ampSelect = container.querySelector('[data-testid="tmp-editor-model-amp"]');
    fireEvent.change(ampSelect, { target: { value: 'British 800' } });
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-save"]'));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].amp.model).toBe('British 800');
  });

  test('amp.model vide → validation error, pas de save', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const onSave = vi.fn();
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={onSave} onCancel={() => {}}/>,
    );
    const ampSelect = container.querySelector('[data-testid="tmp-editor-model-amp"]');
    fireEvent.change(ampSelect, { target: { value: '' } });
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-save"]'));
    expect(onSave).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="tmp-editor-errors"]')).not.toBeNull();
  });

  test('pickupAffinity inputs HB/SC/P90 modifiables', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const onSave = vi.fn();
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={onSave} onCancel={() => {}}/>,
    );
    fireEvent.change(container.querySelector('[data-testid="tmp-editor-pickup-HB"]'), { target: { value: '80' } });
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-save"]'));
    expect(onSave.mock.calls[0][0].pickupAffinity.HB).toBe(80);
  });

  test('Phase 7.13 — TOUS les blocs présents éditables (drive, delay, reverb…)', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={() => {}} onCancel={() => {}}/>,
    );
    // ROCK_PRESET a noise_gate, drive, amp, cab, delay, reverb
    expect(container.querySelector('[data-testid="tmp-editor-block-drive"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-editor-block-delay"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-editor-block-reverb"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-editor-block-noise_gate"]')).not.toBeNull();
  });
});

describe('TmpPatchEditor — Phase 7.13 add/remove blocks + scenes', () => {
  test('amp et cab : pas de bouton remove (obligatoires)', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={() => {}} onCancel={() => {}}/>,
    );
    expect(container.querySelector('[data-testid="tmp-editor-remove-amp"]')).toBeNull();
    expect(container.querySelector('[data-testid="tmp-editor-remove-cab"]')).toBeNull();
  });

  test('blocs optionnels présents : bouton remove visible', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={() => {}} onCancel={() => {}}/>,
    );
    expect(container.querySelector('[data-testid="tmp-editor-remove-drive"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-editor-remove-delay"]')).not.toBeNull();
  });

  test('remove drive + save → patch n\'a plus de drive', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const onSave = vi.fn();
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={onSave} onCancel={() => {}}/>,
    );
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-remove-drive"]'));
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-save"]'));
    expect(onSave.mock.calls[0][0].drive).toBeUndefined();
  });

  test('blocs absents listés dans "Ajouter un bloc" (mod absent de ROCK_PRESET)', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={() => {}} onCancel={() => {}}/>,
    );
    expect(container.querySelector('[data-testid="tmp-editor-add-mod"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-editor-add-comp"]')).not.toBeNull();
    // drive est présent → pas dans la liste add
    expect(container.querySelector('[data-testid="tmp-editor-add-drive"]')).toBeNull();
  });

  test('add mod + save → patch a un mod block avec model + params', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const onSave = vi.fn();
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={onSave} onCancel={() => {}}/>,
    );
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-add-mod"]'));
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-save"]'));
    const saved = onSave.mock.calls[0][0];
    expect(saved.mod).toBeDefined();
    expect(saved.mod.model).toBeTruthy();
    expect(saved.mod.enabled).toBe(true);
    expect(saved.mod.params).toBeDefined();
  });

  test('section scenes/footswitch rendue (ScenesEditor branché)', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={() => {}} onCancel={() => {}}/>,
    );
    expect(container.querySelector('[data-testid="tmp-editor-scenes-section"]')).not.toBeNull();
  });

  test('remove un bloc référencé par footswitchMap toggle → FS nettoyé', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    // Force un FS qui pointe sur drive
    cloned.footswitchMap = { ...(cloned.footswitchMap || {}), fs3: { type: 'toggle', block: 'drive' } };
    const onSave = vi.fn();
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={onSave} onCancel={() => {}}/>,
    );
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-remove-drive"]'));
    fireEvent.click(container.querySelector('[data-testid="tmp-editor-save"]'));
    const saved = onSave.mock.calls[0][0];
    expect(saved.drive).toBeUndefined();
    expect(saved.footswitchMap?.fs3).toBeUndefined();
  });
});
