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

  test('readonly blocks affichés pour info (drive, delay, reverb sur ROCK_PRESET)', () => {
    const cloned = clonePatchAsCustom(ROCK_PRESET);
    const { container } = render(
      <TmpPatchEditor patch={cloned} mode="clone" onSave={() => {}} onCancel={() => {}}/>,
    );
    const ro = container.querySelector('[data-testid="tmp-editor-readonly-blocks"]');
    expect(ro).not.toBeNull();
    expect(ro.textContent).toMatch(/drive/i);
    expect(ro.textContent).toMatch(/reverb/i);
  });
});
