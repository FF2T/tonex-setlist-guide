// @vitest-environment jsdom
//
// Tests Phase 5.2 — BacklineIcon component.

import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import BacklineIcon from './BacklineIcon.jsx';

describe('BacklineIcon — Phase 5.2', () => {
  test('rendu par défaut → svg avec viewBox 417x292, role img, aria-label Backline', () => {
    const { container } = render(<BacklineIcon/>);
    const svg = container.querySelector('[data-testid="backline-icon"]');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('viewBox')).toBe('0 0 417 292');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Backline');
  });

  test('size prop applique width/height respectant le ratio', () => {
    const { container } = render(<BacklineIcon size={48}/>);
    const svg = container.querySelector('[data-testid="backline-icon"]');
    expect(svg.getAttribute('height')).toBe('48');
    // Width = 48 * (417/292) ≈ 68.5 → arrondi à 69
    expect(svg.getAttribute('width')).toBe('69');
  });

  test('color prop appliqué au path', () => {
    const { container } = render(<BacklineIcon color="#fbf5e6"/>);
    const path = container.querySelector('path');
    expect(path.getAttribute('fill')).toBe('#fbf5e6');
  });

  test('title prop personnalisable', () => {
    const { container } = render(<BacklineIcon title="Logo Backline"/>);
    const svg = container.querySelector('[data-testid="backline-icon"]');
    expect(svg.getAttribute('aria-label')).toBe('Logo Backline');
    expect(svg.querySelector('title').textContent).toBe('Logo Backline');
  });
});
