// @vitest-environment jsdom
//
// Tests UI du LiveBlock TMP — Phase 4.

import { describe, test, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import LiveBlock, { fsActionLabel } from './LiveBlock.jsx';

const ACDC_HTH = {
  id: 'acdc_hth', title: 'Highway to Hell', artist: 'AC/DC',
  aiCache: { result: { song_style: 'hard_rock' } },
};

const SG = { id: 'sg_ebony', type: 'HB', name: 'SG' };

describe('fsActionLabel', () => {
  test("scene → nom de la scene", () => {
    const scenes = [{ id: 'rythme', name: 'Rythme' }];
    expect(fsActionLabel({ type: 'scene', sceneId: 'rythme' }, scenes)).toBe('Rythme');
  });
  test('toggle drive → "Toggle Drive"', () => {
    expect(fsActionLabel({ type: 'toggle', block: 'drive' }, [])).toBe('Toggle Drive');
  });
  test('tap_tempo → "Tap Tempo"', () => {
    expect(fsActionLabel({ type: 'tap_tempo' }, [])).toBe('Tap Tempo');
  });
  test('null → "—"', () => {
    expect(fsActionLabel(null, [])).toBe('—');
  });
});

describe('TMPLiveBlock — rendu', () => {
  test('AC/DC → rock_preset top + 2 scenes Rythme/Solo + 4 FS', () => {
    const { container } = render(
      <LiveBlock song={ACDC_HTH} guitar={SG} profile={null}/>,
    );
    const block = container.querySelector('[data-testid="tmp-live-block"]');
    expect(block).not.toBeNull();
    expect(block.getAttribute('data-tmp-patch-id')).toBe('rock_preset');
    expect(block.textContent).toContain('Rock Preset');
    // Scenes
    expect(container.querySelector('[data-testid="tmp-live-scene-rythme"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-live-scene-solo"]')).not.toBeNull();
    // 4 footswitches
    for (const k of ['fs1', 'fs2', 'fs3', 'fs4']) {
      expect(container.querySelector(`[data-testid="tmp-live-fs-${k}"]`)).not.toBeNull();
    }
  });

  test('FS1 (mappé sur scene rythme) marqué actif par défaut', () => {
    const { container } = render(
      <LiveBlock song={ACDC_HTH} guitar={SG} profile={null}/>,
    );
    const fs1 = container.querySelector('[data-testid="tmp-live-fs-fs1"]');
    expect(fs1.getAttribute('data-active')).toBe('true');
    const fs2 = container.querySelector('[data-testid="tmp-live-fs-fs2"]');
    expect(fs2.getAttribute('data-active')).toBe('false');
    // Le bouton scene rythme aussi
    const rythmeBtn = container.querySelector('[data-testid="tmp-live-scene-rythme"]');
    expect(rythmeBtn.getAttribute('data-active')).toBe('true');
  });

  test('Click sur scene Solo → fs2 devient actif + amp level 100% affiché', () => {
    const { container } = render(
      <LiveBlock song={ACDC_HTH} guitar={SG} profile={null}/>,
    );
    const soloBtn = container.querySelector('[data-testid="tmp-live-scene-solo"]');
    fireEvent.click(soloBtn);
    expect(soloBtn.getAttribute('data-active')).toBe('true');
    expect(container.querySelector('[data-testid="tmp-live-fs-fs2"]').getAttribute('data-active')).toBe('true');
    expect(container.querySelector('[data-testid="tmp-live-fs-fs1"]').getAttribute('data-active')).toBe('false');
    // Badge amp level visible
    const ampLvl = container.querySelector('[data-testid="tmp-live-amp-level"]');
    expect(ampLvl).not.toBeNull();
    expect(ampLvl.textContent).toContain('100%');
  });

  test('Sélection initiale par défaut affiche déjà l\'amp level de la scene rythme (70%)', () => {
    const { container } = render(
      <LiveBlock song={ACDC_HTH} guitar={SG} profile={null}/>,
    );
    const ampLvl = container.querySelector('[data-testid="tmp-live-amp-level"]');
    expect(ampLvl).not.toBeNull();
    expect(ampLvl.textContent).toContain('70%');
  });

  test("Patch sans scenes (ex. clean_preset) → pas de badges scenes", () => {
    const SONG_BBKING = {
      id: 'bbking_thrill', title: 'The Thrill is Gone', artist: 'B.B. King',
      aiCache: { result: { song_style: 'blues' } },
    };
    const { container } = render(
      <LiveBlock song={SONG_BBKING} guitar={SG} profile={null}/>,
    );
    expect(container.querySelector('[data-testid="tmp-live-block"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-live-scenes"]')).toBeNull();
  });

  test('Overrides du profil sont appliqués (mute scene → seule scene affichée)', () => {
    const profile = {
      tmpPatches: {
        custom: [],
        factoryOverrides: {
          rock_preset: {
            scenes: [{ id: 'mute', name: 'Mute', ampLevelOverride: 5 }],
            footswitchMap: { fs1: { type: 'scene', sceneId: 'mute' } },
          },
        },
      },
    };
    const { container } = render(
      <LiveBlock song={ACDC_HTH} guitar={SG} profile={profile}/>,
    );
    expect(container.querySelector('[data-testid="tmp-live-scene-mute"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-live-scene-rythme"]')).toBeNull();
    expect(container.querySelector('[data-testid="tmp-live-amp-level"]').textContent).toContain('5%');
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 5 (Item I) — badge "ovr" sur scenes avec paramOverrides
// ───────────────────────────────────────────────────────────────────

describe('TMPLiveBlock — badge paramOverrides (Phase 5 Item I)', () => {
  test('scene avec paramOverrides → badge "ovr" visible', () => {
    const profile = {
      tmpPatches: {
        custom: [],
        factoryOverrides: {
          rock_preset: {
            scenes: [
              { id: 'rythme', name: 'Rythme', ampLevelOverride: 70 },
              {
                id: 'solo', name: 'Solo', ampLevelOverride: 100,
                paramOverrides: { drive: { drive: 5 } },
              },
            ],
          },
        },
      },
    };
    const { container } = render(
      <LiveBlock song={ACDC_HTH} guitar={SG} profile={profile}/>,
    );
    expect(container.querySelector('[data-testid="tmp-live-scene-solo-ovr"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-live-scene-rythme-ovr"]')).toBeNull();
  });

  test('scene sans paramOverrides → pas de badge', () => {
    const { container } = render(
      <LiveBlock song={ACDC_HTH} guitar={SG} profile={null}/>,
    );
    // rock_preset scenes sans paramOverrides → aucun badge ovr.
    expect(container.querySelector('[data-testid="tmp-live-scene-rythme-ovr"]')).toBeNull();
    expect(container.querySelector('[data-testid="tmp-live-scene-solo-ovr"]')).toBeNull();
  });
});
