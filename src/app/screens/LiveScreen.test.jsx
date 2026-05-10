// @vitest-environment jsdom
//
// Tests UI du LiveScreen — Phase 4.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import LiveScreen from './LiveScreen.jsx';

// Devices mock — un avec LiveBlock, un sans.
const fakeLive = ({ song }) => (
  <div data-testid="fake-live-block">
    Live for {song.title}
  </div>
);
const DEVICE_WITH_LIVE = {
  id: 'fake-live', label: 'FakeLive', icon: '🎸',
  LiveBlock: fakeLive,
};
const DEVICE_NO_LIVE = {
  id: 'fake-nolive', label: 'NoLive', icon: '📻',
};

const SONGS = [
  { id: 'acdc_hth', title: 'Highway to Hell', artist: 'AC/DC' },
  { id: 'cream_wr', title: 'White Room', artist: 'Cream' },
  { id: 'bbking_thrill', title: 'The Thrill is Gone', artist: 'B.B. King' },
];

describe('LiveScreen — render', () => {
  test('rendu initial → 1er morceau, devices avec LiveBlock affichés, fallback pour les autres', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS}
        profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}}
        enabledDevices={[DEVICE_WITH_LIVE, DEVICE_NO_LIVE]}
        onExit={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="live-screen-title"]').textContent).toBe('Highway to Hell');
    expect(container.querySelector('[data-testid="fake-live-block"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="live-screen-fallback-fake-nolive"]')).not.toBeNull();
  });

  test('compteur "1 / 3"', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    expect(container.textContent).toContain('1 / 3');
  });

  test('setlist vide → message + bouton Sortir', () => {
    const onExit = vi.fn();
    const { container } = render(
      <LiveScreen
        songs={[]} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={onExit}
      />,
    );
    expect(container.querySelector('[data-testid="live-screen-empty"]')).not.toBeNull();
    fireEvent.click(container.querySelector('button'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test('initialIndex non-zero pris en compte', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[DEVICE_WITH_LIVE]}
        onExit={() => {}} initialIndex={2}
      />,
    );
    expect(container.querySelector('[data-testid="live-screen-title"]').textContent).toBe('The Thrill is Gone');
  });
});

describe('LiveScreen — navigation', () => {
  test('clic Suivant → morceau 2 ; clic Précédent → revient à 1', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    fireEvent.click(container.querySelector('[data-testid="live-screen-next"]'));
    expect(container.querySelector('[data-testid="live-screen-title"]').textContent).toBe('White Room');
    fireEvent.click(container.querySelector('[data-testid="live-screen-prev"]'));
    expect(container.querySelector('[data-testid="live-screen-title"]').textContent).toBe('Highway to Hell');
  });

  test('Précédent désactivé sur le premier morceau', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="live-screen-prev"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="live-screen-next"]').disabled).toBe(false);
  });

  test('Suivant désactivé sur le dernier morceau', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}} initialIndex={2}
      />,
    );
    expect(container.querySelector('[data-testid="live-screen-next"]').disabled).toBe(true);
  });

  test('Swipe gauche (dx négatif) → next', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    const root = container.querySelector('[data-testid="live-screen"]');
    fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 100, clientY: 110 }] });
    expect(container.querySelector('[data-testid="live-screen-title"]').textContent).toBe('White Room');
  });

  test('Swipe droite (dx positif) sans morceau précédent → ignoré', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    const root = container.querySelector('[data-testid="live-screen"]');
    fireEvent.touchStart(root, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 300, clientY: 100 }] });
    expect(container.querySelector('[data-testid="live-screen-title"]').textContent).toBe('Highway to Hell');
  });

  test('Swipe trop court → ignoré', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    const root = container.querySelector('[data-testid="live-screen"]');
    fireEvent.touchStart(root, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 180, clientY: 100 }] });
    expect(container.querySelector('[data-testid="live-screen-title"]').textContent).toBe('Highway to Hell');
  });

  test('Swipe trop vertical → ignoré', () => {
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    const root = container.querySelector('[data-testid="live-screen"]');
    fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 100, clientY: 300 }] });
    expect(container.querySelector('[data-testid="live-screen-title"]').textContent).toBe('Highway to Hell');
  });

  test('Bouton Sortir appelle onExit', () => {
    const onExit = vi.fn();
    const { container } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={onExit}
      />,
    );
    fireEvent.click(container.querySelector('[data-testid="live-screen-exit"]'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('LiveScreen — Wake Lock graceful', () => {
  let originalWakeLock;
  beforeEach(() => {
    originalWakeLock = navigator.wakeLock;
  });
  afterEach(() => {
    if (originalWakeLock === undefined) {
      try { delete navigator.wakeLock; } catch (_e) { /* ignore */ }
    } else {
      navigator.wakeLock = originalWakeLock;
    }
  });

  test('Wake Lock API absente → pas de crash', () => {
    try { delete navigator.wakeLock; } catch (_e) { /* ignore */ }
    expect(() => render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    )).not.toThrow();
  });

  test('Wake Lock API présente → request appelée', async () => {
    const releaseMock = vi.fn();
    const requestMock = vi.fn().mockResolvedValue({ release: releaseMock });
    navigator.wakeLock = { request: requestMock };
    const { unmount } = render(
      <LiveScreen
        songs={SONGS} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    // useEffect → request appelée au mount.
    await new Promise((r) => setTimeout(r, 0));
    expect(requestMock).toHaveBeenCalledWith('screen');
    unmount();
    // Release au démontage (lazy : le mock résout, puis cleanup release).
    await new Promise((r) => setTimeout(r, 0));
    expect(releaseMock).toHaveBeenCalled();
  });
});

describe('LiveScreen — BPM/key affichage', () => {
  test('si bpm + key sur le morceau → ligne visible', () => {
    const songs = [
      { id: 'x', title: 'X', artist: 'Y', bpm: 120, key: 'A minor' },
    ];
    const { container } = render(
      <LiveScreen
        songs={songs} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    const bk = container.querySelector('[data-testid="live-screen-bpm-key"]');
    expect(bk).not.toBeNull();
    expect(bk.textContent).toContain('120');
    expect(bk.textContent).toContain('A minor');
  });

  test('sans bpm/key → ligne absente', () => {
    const songs = [{ id: 'x', title: 'X', artist: 'Y' }];
    const { container } = render(
      <LiveScreen
        songs={songs} profile={null} allGuitars={null}
        banksAnn={{}} banksPlug={{}} enabledDevices={[]}
        onExit={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="live-screen-bpm-key"]')).toBeNull();
  });
});
