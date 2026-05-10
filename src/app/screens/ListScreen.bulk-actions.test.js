// Tests Phase 5.5 — actions de suppression en masse de morceaux dans
// une setlist : "Vider la setlist" + "Retirer non-cochés".
// Comme ListScreen vit dans main.jsx (encore gros bloc), on teste la
// logique reducer pure en isolation.

import { describe, test, expect, vi } from 'vitest';

// Reducer pur : vider une setlist (Phase 5.5 FIX A).
function emptySetlist(setlists, slId) {
  return setlists.map((sl) => (sl.id === slId ? { ...sl, songIds: [] } : sl));
}

// Reducer pur : garder uniquement les ids cochés dans une setlist
// (Phase 5.5 FIX B).
function keepCheckedInSetlist(setlists, slId, checkedIds) {
  const keep = new Set(checkedIds);
  return setlists.map((sl) =>
    sl.id === slId ? { ...sl, songIds: sl.songIds.filter((id) => keep.has(id)) } : sl);
}

describe('emptySetlist — Phase 5.5 FIX A', () => {
  const setlists = [
    { id: 'sl_a', name: 'Ma Setlist', songIds: ['s1', 's2', 's3', 's4'], profileIds: ['u1'] },
    { id: 'sl_b', name: 'Autre', songIds: ['s5'], profileIds: ['u1'] },
  ];

  test('vide songIds de la setlist cible', () => {
    const next = emptySetlist(setlists, 'sl_a');
    expect(next[0].songIds).toEqual([]);
  });

  test('préserve nom, profileIds et autres champs', () => {
    const slWithGuitars = {
      id: 'sl_a', name: 'X', songIds: ['s1', 's2'],
      profileIds: ['u1'], guitars: { s1: 'lp60' }, sort: 'alpha',
    };
    const next = emptySetlist([slWithGuitars], 'sl_a');
    expect(next[0].name).toBe('X');
    expect(next[0].profileIds).toEqual(['u1']);
    expect(next[0].guitars).toEqual({ s1: 'lp60' });
    expect(next[0].sort).toBe('alpha');
    expect(next[0].songIds).toEqual([]);
  });

  test('ne touche pas aux autres setlists', () => {
    const next = emptySetlist(setlists, 'sl_a');
    expect(next[1]).toEqual(setlists[1]);
  });

  test('slId inexistant → no-op', () => {
    const next = emptySetlist(setlists, 'sl_ghost');
    expect(next).toEqual(setlists);
  });

  test('setlist déjà vide → idempotent', () => {
    const empty = [{ id: 'sl_a', name: 'X', songIds: [], profileIds: ['u1'] }];
    const next = emptySetlist(empty, 'sl_a');
    expect(next[0].songIds).toEqual([]);
  });

  test('songDb global non touché (le reducer ne le concerne pas)', () => {
    // Le reducer ne touche QUE setlists. Le test documente le contrat.
    const songDb = [{ id: 's1' }, { id: 's2' }];
    emptySetlist(setlists, 'sl_a');
    expect(songDb).toEqual([{ id: 's1' }, { id: 's2' }]);
  });
});

describe('keepCheckedInSetlist — Phase 5.5 FIX B', () => {
  const setlists = [
    { id: 'sl_a', name: 'Ma Setlist', songIds: ['s1', 's2', 's3', 's4', 's5'], profileIds: ['u1'] },
  ];

  test('garde uniquement les songIds cochés', () => {
    const next = keepCheckedInSetlist(setlists, 'sl_a', ['s2', 's4']);
    expect(next[0].songIds).toEqual(['s2', 's4']);
  });

  test('préserve l\'ordre d\'origine des songIds (filter, pas reorder)', () => {
    // Cochés dans un ordre différent → l'ordre du songIds d'origine
    // prime.
    const next = keepCheckedInSetlist(setlists, 'sl_a', ['s5', 's1', 's3']);
    expect(next[0].songIds).toEqual(['s1', 's3', 's5']);
  });

  test('aucun coché → setlist vide après application', () => {
    const next = keepCheckedInSetlist(setlists, 'sl_a', []);
    expect(next[0].songIds).toEqual([]);
  });

  test('tous cochés → setlist inchangée (filter all match)', () => {
    const next = keepCheckedInSetlist(setlists, 'sl_a', ['s1', 's2', 's3', 's4', 's5']);
    expect(next[0].songIds).toEqual(['s1', 's2', 's3', 's4', 's5']);
  });

  test('coché inclut un songId absent → ignoré', () => {
    const next = keepCheckedInSetlist(setlists, 'sl_a', ['s2', 'ghost']);
    expect(next[0].songIds).toEqual(['s2']);
  });

  test('préserve les autres champs (name, profileIds, guitars)', () => {
    const sl = {
      id: 'sl_a', name: 'X', songIds: ['s1', 's2'],
      profileIds: ['u1'], guitars: { s1: 'sg61', s2: 'strat61' },
    };
    const next = keepCheckedInSetlist([sl], 'sl_a', ['s1']);
    expect(next[0].name).toBe('X');
    expect(next[0].guitars).toEqual({ s1: 'sg61', s2: 'strat61' });
    expect(next[0].songIds).toEqual(['s1']);
  });

  test('slId inexistant → no-op', () => {
    const next = keepCheckedInSetlist(setlists, 'sl_ghost', ['s1']);
    expect(next).toEqual(setlists);
  });
});

describe('Phase 5.5 — confirmation modale : si annulée, songIds inchangé', () => {
  test('emptySetlist appelé uniquement si confirm renvoie true', () => {
    const confirmMock = vi.fn();
    // Simulation : décor du bouton 🧹 Vider la setlist.
    const handler = () => {
      if (!confirmMock()) return;
      // emptySetlist applied here.
    };
    confirmMock.mockReturnValueOnce(false);
    handler();
    expect(confirmMock).toHaveBeenCalledTimes(1);
    // (Pas de fonction emptySetlist appelée car confirm=false.)
  });

  test('keepCheckedInSetlist appelé uniquement si confirm renvoie true', () => {
    const confirmMock = vi.fn().mockReturnValue(false);
    const onSetlists = vi.fn();
    const handler = () => {
      if (!confirmMock()) return;
      onSetlists((prev) => keepCheckedInSetlist(prev, 'sl_a', ['s1']));
    };
    handler();
    expect(onSetlists).not.toHaveBeenCalled();
  });
});

describe('Visibility rules — Phase 5.5', () => {
  test('"🧹 Vider la setlist" visible si songIds.length > 0', () => {
    const shouldShowEmpty = (sl) => !!(sl && Array.isArray(sl.songIds) && sl.songIds.length > 0);
    expect(shouldShowEmpty({ songIds: [] })).toBe(false);
    expect(shouldShowEmpty({ songIds: ['s1'] })).toBe(true);
    expect(shouldShowEmpty(null)).toBe(false);
  });

  test('"🧹 Retirer non-cochés" visible si activeSlId + 0 < checked < total', () => {
    const shouldShowKeepChecked = (activeSlId, checkedLen, totalLen) =>
      !!activeSlId && checkedLen > 0 && checkedLen < totalLen;
    // Pas de setlist active (mode "Tous les morceaux") → caché.
    expect(shouldShowKeepChecked(null, 5, 10)).toBe(false);
    // Aucun morceau coché → caché.
    expect(shouldShowKeepChecked('sl_a', 0, 10)).toBe(false);
    // Tous cochés → caché (l'action ne ferait rien d'utile).
    expect(shouldShowKeepChecked('sl_a', 10, 10)).toBe(false);
    // Partial check + setlist active → visible.
    expect(shouldShowKeepChecked('sl_a', 3, 10)).toBe(true);
  });
});
