// @vitest-environment jsdom
//
// Tests UI du ToneXLiveBlock partagé — Phase 4.

import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import makeToneXLiveBlock, { findPresetLocation } from './ToneXLiveBlock.jsx';

const FAKE_DEVICE = {
  id: 'tonex-pedal',
  label: 'ToneX Pedal',
  icon: '📦',
  deviceColor: 'var(--copper-400)',
  bankStorageKey: 'banksAnn',
  presetResultKey: 'preset_ann',
};

const banksAnn = {
  3: { A: 'TSR Mars 800SL Cln', B: 'TSR Mars 800SL Drive', C: 'TSR Mars 800SL Full' },
  42: { A: 'TSR Mars 800SL Chnl 1 Cln', B: 'TSR Mars 800SL Chnl 1 Drive', C: 'TSR Mars 800SL Ch 1 Full Beans' },
};

describe('findPresetLocation', () => {
  test('exact match → bank + slot', () => {
    expect(findPresetLocation('TSR Mars 800SL Drive', banksAnn)).toMatchObject({
      bank: 3, slot: 'B',
    });
  });
  test('introuvable → null', () => {
    expect(findPresetLocation('Inexistant', banksAnn)).toBe(null);
  });
  test('name vide → null', () => {
    expect(findPresetLocation(null, banksAnn)).toBe(null);
    expect(findPresetLocation('', banksAnn)).toBe(null);
  });
});

describe('makeToneXLiveBlock — render', () => {
  const ToneXLiveBlock = makeToneXLiveBlock(FAKE_DEVICE);

  test('preset reco présent + bank trouvée → 3 slots A/B/C affichés', () => {
    const song = {
      id: 'acdc_hth',
      aiCache: {
        result: { preset_ann: { label: 'TSR Mars 800SL Chnl 1 Drive', score: 92 } },
      },
    };
    const { container } = render(
      <ToneXLiveBlock song={song} _guitar={null} _profile={null} banksAnn={banksAnn} banksPlug={{}}/>,
    );
    const block = container.querySelector('[data-testid="tonex-live-block-tonex-pedal"]');
    expect(block).not.toBeNull();
    expect(block.getAttribute('data-preset-bank')).toBe('42');
    expect(block.getAttribute('data-preset-slot')).toBe('B');
    expect(block.textContent).toContain('TSR Mars 800SL Chnl 1 Drive');
    // 3 slots
    expect(container.querySelector('[data-testid="tonex-live-slot-tonex-pedal-A"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tonex-live-slot-tonex-pedal-B"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tonex-live-slot-tonex-pedal-C"]')).not.toBeNull();
    // Slot B actif (recommandé)
    expect(container.querySelector('[data-testid="tonex-live-slot-tonex-pedal-B"]').getAttribute('data-active')).toBe('true');
    expect(container.querySelector('[data-testid="tonex-live-slot-tonex-pedal-A"]').getAttribute('data-active')).toBe('false');
    // Bank position badge
    expect(container.querySelector('[data-testid="tonex-live-position-tonex-pedal"]').textContent).toContain('Bank 42B');
    // Help text
    expect(block.textContent).toContain('Footswitch bank up/down');
  });

  test('preset reco présent mais introuvable dans les banks → "non installé"', () => {
    const song = {
      id: 'acdc_hth',
      aiCache: {
        result: { preset_ann: { label: 'Preset jamais installé', score: 80 } },
      },
    };
    const { container } = render(
      <ToneXLiveBlock song={song} _guitar={null} _profile={null} banksAnn={banksAnn} banksPlug={{}}/>,
    );
    expect(container.querySelector('[data-testid="tonex-live-not-installed-tonex-pedal"]')).not.toBeNull();
    // Pas de slots A/B/C (preset pas localisé)
    expect(container.querySelector('[data-testid="tonex-live-slots-tonex-pedal"]')).toBeNull();
  });

  test('pas de preset reco (aiCache absent) → bloc empty', () => {
    const song = { id: 'acdc_hth' };
    const { container } = render(
      <ToneXLiveBlock song={song} _guitar={null} _profile={null} banksAnn={banksAnn} banksPlug={{}}/>,
    );
    expect(container.querySelector('[data-testid="tonex-live-block-empty-tonex-pedal"]')).not.toBeNull();
    expect(container.textContent).toContain('Pas de preset déterminé');
  });
});

describe('makeToneXLiveBlock — devices différents', () => {
  test('Plug device utilise banksPlug', () => {
    const PLUG_DEVICE = {
      id: 'tonex-plug',
      label: 'ToneX Plug',
      icon: '🔌',
      deviceColor: 'var(--accent)',
      bankStorageKey: 'banksPlug',
      presetResultKey: 'preset_plug',
    };
    const ToneXPlugLive = makeToneXLiveBlock(PLUG_DEVICE);
    const banksPlug = { 5: { A: 'Plug Clean', B: 'Plug Drive', C: 'Plug OD' } };
    const song = {
      aiCache: { result: { preset_plug: { label: 'Plug Drive', score: 85 } } },
    };
    const { container } = render(
      <ToneXPlugLive song={song} _guitar={null} _profile={null} banksAnn={{}} banksPlug={banksPlug}/>,
    );
    const block = container.querySelector('[data-testid="tonex-live-block-tonex-plug"]');
    expect(block).not.toBeNull();
    expect(block.getAttribute('data-preset-bank')).toBe('5');
    expect(block.getAttribute('data-preset-slot')).toBe('B');
  });
});
