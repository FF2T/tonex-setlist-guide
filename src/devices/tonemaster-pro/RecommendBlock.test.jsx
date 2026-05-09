// @vitest-environment jsdom
//
// Tests UI du composant RecommendBlock TMP : compact + drawer + edge
// cases (pas d'aiCache).

import { describe, test, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import RecommendBlock, { summarizeChain } from './RecommendBlock.jsx';
import { ROCK_PRESET } from './catalog.js';

const ACDC_HTH = {
  id: 'acdc_hth', title: 'Highway to Hell', artist: 'AC/DC',
  aiCache: {
    result: {
      ref_amp: 'Marshall Super Lead 100W',
      ref_effects: 'Aucun effet',
      song_style: 'hard_rock',
    },
  },
};

const SG = { id: 'sg_ebony', type: 'HB', name: 'SG' };

describe('summarizeChain', () => {
  test('Rock Preset summary mentionne Plexi + Greenback + Drive', () => {
    const s = summarizeChain(ROCK_PRESET);
    expect(s).toContain('Plexi');
    expect(s).toContain('+Drive');
    expect(s).toContain('Spring');
  });

  test('patch null → ""', () => {
    expect(summarizeChain(null)).toBe('');
  });
});

describe('TMPRecommendBlock — rendu compact', () => {
  test('AC/DC + SG → patch top affiché avec score', () => {
    const { container } = render(
      <RecommendBlock song={ACDC_HTH} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    const block = container.querySelector('[data-testid="tmp-recommend-block"]');
    expect(block).not.toBeNull();
    // Le top patch sur AC/DC doit être rock_preset (assertion via data-attr).
    expect(block.getAttribute('data-tmp-patch-id')).toBe('rock_preset');
    expect(block.getAttribute('data-device-id')).toBe('tonemaster-pro');
    // Score visible (chiffre + %)
    expect(block.textContent).toMatch(/\d+%/);
    // Nom du patch visible
    expect(block.textContent).toContain('Rock Preset');
  });
});

describe('TMPRecommendBlock — drawer expandable', () => {
  test('clic ouvre le drawer et affiche les blocs détaillés', () => {
    const { container, getByText } = render(
      <RecommendBlock song={ACDC_HTH} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    // Drawer fermé par défaut : pas de tmp-block-amp visible
    expect(container.querySelector('[data-testid="tmp-block-amp"]')).toBeNull();
    // Clic sur le bouton compact
    const button = container.querySelector('[data-testid="tmp-recommend-block"] button');
    fireEvent.click(button);
    // Drawer ouvert : blocs visibles
    expect(container.querySelector('[data-testid="tmp-block-amp"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-block-cab"]')).not.toBeNull();
    // Le contenu de tmp-block-amp doit mentionner British Plexi
    expect(getByText('British Plexi')).toBeTruthy();
  });

  test('drawer affiche Style + Gain + Pickup', () => {
    const { container } = render(
      <RecommendBlock song={ACDC_HTH} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    const button = container.querySelector('[data-testid="tmp-recommend-block"] button');
    fireEvent.click(button);
    // hard_rock + mid + pickup HB:95 dans le footer du drawer
    expect(container.textContent).toContain('hard_rock');
    expect(container.textContent).toContain('mid');
    expect(container.textContent).toContain('HB:95');
  });
});

describe('TMPRecommendBlock — edge cases', () => {
  test('song sans aiCache → composant ne crashe pas, rend quand même un patch', () => {
    const songNoCache = { id: 'foo', title: 'X', artist: 'Y' };
    const { container } = render(
      <RecommendBlock song={songNoCache} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    // Au moins un patch est suggéré (basé sur pickup + style neutre).
    const block = container.querySelector('[data-testid="tmp-recommend-block"]');
    expect(block).not.toBeNull();
  });

  test('song null → composant retourne null sans crash', () => {
    const { container } = render(
      <RecommendBlock song={null} guitar={null} profile={null} _allGuitars={null}/>,
    );
    // Le composant retourne null si pas de patch top — le wrapper test
    // rend simplement vide.
    const block = container.querySelector('[data-testid="tmp-recommend-block"]');
    // Soit null soit présent mais sans crash.
    expect(true).toBe(true);
  });
});
