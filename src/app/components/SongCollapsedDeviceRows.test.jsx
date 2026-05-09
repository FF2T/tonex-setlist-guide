// @vitest-environment jsdom
//
// Test régression Phase 2 : la vue repliée d'un morceau ne doit afficher
// QUE les rows correspondant aux devices activés du profil. Reproduit
// exactement le scénario rapporté (enabledDevices=['tonex-pedal'], aiC
// avec preset_ann ET preset_plug renseignés, banksAnn ET banksPlug
// peuplés) et asserte qu'aucune référence à banksPlug n'apparaît dans
// le markup généré.

import { describe, test, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SongCollapsedDeviceRows from './SongCollapsedDeviceRows.jsx';

// Side-effect imports : enregistrent les 3 devices au registry.
beforeAll(async () => {
  await import('../../devices/tonex-pedal/index.js');
  await import('../../devices/tonex-anniversary/index.js');
  await import('../../devices/tonex-plug/index.js');
});

const aiC = {
  preset_ann: { label: 'TSR Mars 800SL Chnl 1 Drive', score: 93 },
  preset_plug: { label: 'TSR Mars 800SL Chnl 1 Grit', score: 93 },
};

const banksAnn = {
  10: { A: 'TSR Mars 800SL Chnl 1 Cln', B: 'TSR Mars 800SL Chnl 1 Drive', C: '' },
};

const banksPlug = {
  6: { A: '', B: '', C: 'TSR Mars 800SL Chnl 1 Grit' },
};

// Renderer sentinel : on inclut le label du preset dans une span avec un
// data-testid pour pouvoir compter les rows et leur source.
function renderRow(d, banks, presetData) {
  return (
    <span
      data-testid={`row-${d.id}`}
      data-banks-source={d.bankStorageKey}
      data-device-color={d.deviceColor}
    >
      {d.icon} {presetData.label}
    </span>
  );
}

describe('SongCollapsedDeviceRows · scénario bug rapporté', () => {
  test("profile.enabledDevices=['tonex-pedal'] → UNE seule ligne (Pedal), aucune trace de Plug", () => {
    const profile = {
      enabledDevices: ['tonex-pedal'],
      devices: { pedale: true, anniversary: false, plug: false },
    };
    const { container } = render(
      <SongCollapsedDeviceRows
        profile={profile}
        aiC={aiC}
        banksAnn={banksAnn}
        banksPlug={banksPlug}
        renderRow={renderRow}
      />,
    );
    // Une seule row visible, et c'est la Pedal.
    const rows = container.querySelectorAll('[data-testid^="row-"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-testid')).toBe('row-tonex-pedal');
    // banks de la row = banksAnn (Pedal storage), pas banksPlug.
    expect(rows[0].getAttribute('data-banks-source')).toBe('banksAnn');
    // Couleur device = copper (Pedal). Aucune trace de wine-400 dans le markup.
    expect(rows[0].getAttribute('data-device-color')).toBe('var(--copper-400)');
    expect(container.innerHTML).not.toContain('wine-400');
    // Aucune row Plug.
    expect(container.querySelector('[data-testid="row-tonex-plug"]')).toBeNull();
    // Aucun preset Plug rendu.
    expect(container.textContent).not.toContain('Grit');
  });

  test("profile.enabledDevices=['tonex-plug'] uniquement → AUCUN copper-400 dans le markup", () => {
    const profile = {
      enabledDevices: ['tonex-plug'],
      devices: { pedale: false, anniversary: false, plug: true },
    };
    const { container } = render(
      <SongCollapsedDeviceRows
        profile={profile}
        aiC={aiC}
        banksAnn={banksAnn}
        banksPlug={banksPlug}
        renderRow={renderRow}
      />,
    );
    const rows = container.querySelectorAll('[data-testid^="row-"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-testid')).toBe('row-tonex-plug');
    expect(rows[0].getAttribute('data-device-color')).toBe('var(--wine-400)');
    expect(container.innerHTML).not.toContain('copper-400');
    expect(container.querySelector('[data-testid="row-tonex-pedal"]')).toBeNull();
    expect(container.querySelector('[data-testid="row-tonex-anniversary"]')).toBeNull();
  });

  test("profile.enabledDevices=['tonex-anniversary'] → UNE ligne Anniversary, banks=banksAnn", () => {
    const profile = {
      enabledDevices: ['tonex-anniversary'],
      devices: { pedale: false, anniversary: true, plug: false },
    };
    const { container } = render(
      <SongCollapsedDeviceRows
        profile={profile}
        aiC={aiC}
        banksAnn={banksAnn}
        banksPlug={banksPlug}
        renderRow={renderRow}
      />,
    );
    const rows = container.querySelectorAll('[data-testid^="row-"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-testid')).toBe('row-tonex-anniversary');
    expect(rows[0].getAttribute('data-banks-source')).toBe('banksAnn');
    expect(container.querySelector('[data-testid="row-tonex-plug"]')).toBeNull();
  });

  test("profile.enabledDevices=['tonex-pedal','tonex-plug'] → 2 lignes (Pedal + Plug)", () => {
    const profile = {
      enabledDevices: ['tonex-pedal', 'tonex-plug'],
      devices: { pedale: true, anniversary: false, plug: true },
    };
    const { container } = render(
      <SongCollapsedDeviceRows
        profile={profile}
        aiC={aiC}
        banksAnn={banksAnn}
        banksPlug={banksPlug}
        renderRow={renderRow}
      />,
    );
    const rows = container.querySelectorAll('[data-testid^="row-"]');
    expect(rows).toHaveLength(2);
    const sources = [...rows].map((r) => r.getAttribute('data-banks-source')).sort();
    expect(sources).toEqual(['banksAnn', 'banksPlug']);
  });

  test('profile sans enabledDevices mais legacy devices.plug=false → 1 ligne (heal depuis devices)', () => {
    const profile = {
      // pas d'enabledDevices : simule un état partiellement migré
      devices: { pedale: true, anniversary: false, plug: false },
    };
    const { container } = render(
      <SongCollapsedDeviceRows
        profile={profile}
        aiC={aiC}
        banksAnn={banksAnn}
        banksPlug={banksPlug}
        renderRow={renderRow}
      />,
    );
    const rows = container.querySelectorAll('[data-testid^="row-"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-testid')).toBe('row-tonex-pedal');
    expect(container.textContent).not.toContain('Grit');
  });

  test('aiC vide → null rendered (pas de wrapper, pas de row)', () => {
    const profile = { enabledDevices: ['tonex-pedal', 'tonex-plug'] };
    const { container } = render(
      <SongCollapsedDeviceRows
        profile={profile}
        aiC={null}
        banksAnn={banksAnn}
        banksPlug={banksPlug}
        renderRow={renderRow}
      />,
    );
    const rows = container.querySelectorAll('[data-testid^="row-"]');
    expect(rows).toHaveLength(0);
  });
});
