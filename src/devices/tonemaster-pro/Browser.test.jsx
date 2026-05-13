// @vitest-environment jsdom
//
// Tests UI du TMP Browser (Phase 7.11) : groupements factory/custom,
// expand/collapse, badge override.

import { describe, test, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import TmpBrowser from './Browser.jsx';
import { TMP_FACTORY_PATCHES } from './catalog.js';

describe('TmpBrowser — Phase 7.11', () => {
  test('rend la root + compte total des patches (factory + custom)', () => {
    const { container } = render(<TmpBrowser profile={{}}/>);
    const root = container.querySelector('[data-testid="tmp-browser-root"]');
    expect(root).not.toBeNull();
    expect(root.textContent).toContain(`${TMP_FACTORY_PATCHES.length} patches`);
  });

  test('groupes factory rendus : arthur (3), orphan (4), generated (13)', () => {
    const { container } = render(<TmpBrowser profile={{}}/>);
    expect(container.querySelector('[data-testid="tmp-browser-group-arthur"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-browser-group-orphan"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-browser-group-generated"]')).not.toBeNull();
    // Pas de groupe custom si profile sans customs
    expect(container.querySelector('[data-testid="tmp-browser-group-custom"]')).toBeNull();
  });

  test('chaque patch factory a une card dédiée', () => {
    const { container } = render(<TmpBrowser profile={{}}/>);
    TMP_FACTORY_PATCHES.forEach((p) => {
      const card = container.querySelector(`[data-testid="tmp-browser-patch-${p.id}"]`);
      expect(card).not.toBeNull();
    });
  });

  test('customs du profil rendus en tête (avant arthur)', () => {
    const customs = [
      { id: 'my_clean', name: 'Mon Clean', amp: { model: 'Twin' }, cab: { model: '2x12' }, style: 'blues', gain: 'low' },
    ];
    const { container } = render(
      <TmpBrowser profile={{ tmpPatches: { custom: customs, factoryOverrides: {} } }}/>,
    );
    expect(container.querySelector('[data-testid="tmp-browser-group-custom"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-browser-patch-my_clean"]')).not.toBeNull();
  });

  test('click sur une card → expand drawer; second click → collapse', () => {
    const { container } = render(<TmpBrowser profile={{}}/>);
    const card = container.querySelector('[data-testid="tmp-browser-patch-rock_preset"]');
    expect(container.querySelector('[data-testid="tmp-browser-detail-rock_preset"]')).toBeNull();
    fireEvent.click(card.querySelector('button'));
    expect(container.querySelector('[data-testid="tmp-browser-detail-rock_preset"]')).not.toBeNull();
    fireEvent.click(card.querySelector('button'));
    expect(container.querySelector('[data-testid="tmp-browser-detail-rock_preset"]')).toBeNull();
  });

  test('expand un autre patch collapse le précédent (1 seul ouvert)', () => {
    const { container } = render(<TmpBrowser profile={{}}/>);
    fireEvent.click(container.querySelector('[data-testid="tmp-browser-patch-rock_preset"] button'));
    expect(container.querySelector('[data-testid="tmp-browser-detail-rock_preset"]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-testid="tmp-browser-patch-clean_preset"] button'));
    expect(container.querySelector('[data-testid="tmp-browser-detail-rock_preset"]')).toBeNull();
    expect(container.querySelector('[data-testid="tmp-browser-detail-clean_preset"]')).not.toBeNull();
  });

  test('badge override visible si profile.tmpPatches.factoryOverrides[id] existe', () => {
    const profile = {
      tmpPatches: {
        custom: [],
        factoryOverrides: { rock_preset: { scenes: [{ id: 'x', name: 'X' }] } },
      },
    };
    const { container } = render(<TmpBrowser profile={profile}/>);
    expect(container.querySelector('[data-testid="tmp-browser-override-rock_preset"]')).not.toBeNull();
    // Pas de badge sur les autres
    expect(container.querySelector('[data-testid="tmp-browser-override-clean_preset"]')).toBeNull();
  });

  test('drawer affiche le détail des blocs (amp model, params)', () => {
    const { container } = render(<TmpBrowser profile={{}}/>);
    fireEvent.click(container.querySelector('[data-testid="tmp-browser-patch-rock_preset"] button'));
    const detail = container.querySelector('[data-testid="tmp-browser-detail-rock_preset"]');
    expect(detail).not.toBeNull();
    // Le Plexi doit apparaître dans le détail
    expect(detail.textContent).toContain('British Plexi');
  });

  test('profile null/sans tmpPatches → ne crashe pas', () => {
    const { container } = render(<TmpBrowser profile={null}/>);
    expect(container.querySelector('[data-testid="tmp-browser-root"]')).not.toBeNull();
  });
});
