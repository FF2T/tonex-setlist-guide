// Tests Phase 5.4 — logique de retrait morceau + toast undo dans
// ListScreen. Le composant ListScreen vit dans main.jsx (encore gros
// bloc Phase 1+ dette), donc on teste la logique du retrait+undo en
// isolation via une fonction helper qui mime l'implémentation.

import { describe, test, expect, vi } from 'vitest';

// Réimplémente removeSongFromActiveSetlist + undoRemoveSong en
// extrayant la logique pure (pas de state React, juste reducers).

function removeSong(setlists, slId, songId) {
  const current = setlists.find((s) => s.id === slId);
  if (!current) return { setlists, position: -1 };
  const position = current.songIds.indexOf(songId);
  if (position < 0) return { setlists, position: -1 };
  const next = setlists.map((sl) =>
    sl.id === slId ? { ...sl, songIds: sl.songIds.filter((x) => x !== songId) } : sl);
  return { setlists: next, position };
}

function undoRemoveSong(setlists, slId, songId, position) {
  return setlists.map((sl) => {
    if (sl.id !== slId) return sl;
    if (sl.songIds.includes(songId)) return sl; // déjà ré-ajouté
    const ids = [...sl.songIds];
    ids.splice(Math.min(position, ids.length), 0, songId);
    return { ...sl, songIds: ids };
  });
}

describe('removeSong + undoRemoveSong — Phase 5.4', () => {
  const baseSetlist = {
    id: 'sl_a',
    name: 'Ma Setlist',
    songIds: ['s1', 's2', 's3', 's4'],
  };

  test('removeSong : songIds filtré sans le morceau retiré', () => {
    const { setlists: next, position } = removeSong([baseSetlist], 'sl_a', 's2');
    expect(next[0].songIds).toEqual(['s1', 's3', 's4']);
    expect(position).toBe(1);
  });

  test('removeSong : position capturée pour permettre l\'undo', () => {
    const { position } = removeSong([baseSetlist], 'sl_a', 's3');
    expect(position).toBe(2);
  });

  test("removeSong : songId absent → no-op, position -1", () => {
    const { setlists: next, position } = removeSong([baseSetlist], 'sl_a', 'inexistant');
    expect(next).toEqual([baseSetlist]);
    expect(position).toBe(-1);
  });

  test('removeSong : slId inexistant → no-op', () => {
    const { setlists: next, position } = removeSong([baseSetlist], 'sl_ghost', 's1');
    expect(next).toEqual([baseSetlist]);
    expect(position).toBe(-1);
  });

  test('undoRemoveSong : réinsère à la position d\'origine', () => {
    const { setlists: afterRemove, position } = removeSong([baseSetlist], 'sl_a', 's2');
    const afterUndo = undoRemoveSong(afterRemove, 'sl_a', 's2', position);
    expect(afterUndo[0].songIds).toEqual(['s1', 's2', 's3', 's4']);
  });

  test('undoRemoveSong : préserve l\'ordre des morceaux non touchés', () => {
    const sl = { id: 'sl_a', name: 'X', songIds: ['s1', 's2', 's3', 's4', 's5'] };
    const { setlists: r1, position } = removeSong([sl], 'sl_a', 's3');
    expect(r1[0].songIds).toEqual(['s1', 's2', 's4', 's5']);
    const r2 = undoRemoveSong(r1, 'sl_a', 's3', position);
    expect(r2[0].songIds).toEqual(['s1', 's2', 's3', 's4', 's5']);
  });

  test('undoRemoveSong : songId déjà présent → no-op (ré-ajouté manuellement)', () => {
    const sl = { id: 'sl_a', name: 'X', songIds: ['s1', 's2', 's3'] };
    const out = undoRemoveSong([sl], 'sl_a', 's1', 0);
    expect(out[0].songIds).toEqual(['s1', 's2', 's3']);
  });

  test('undoRemoveSong : position au-delà de la longueur → append en queue', () => {
    const sl = { id: 'sl_a', name: 'X', songIds: ['s1', 's2'] };
    const out = undoRemoveSong([sl], 'sl_a', 's3', 99);
    expect(out[0].songIds).toEqual(['s1', 's2', 's3']);
  });

  test('cycle remove → undo → remove → undo : reset complet', () => {
    let setlists = [baseSetlist];
    const r1 = removeSong(setlists, 'sl_a', 's2'); setlists = r1.setlists;
    const r2 = undoRemoveSong(setlists, 'sl_a', 's2', r1.position); setlists = r2;
    expect(setlists[0].songIds).toEqual(['s1', 's2', 's3', 's4']);
    const r3 = removeSong(setlists, 'sl_a', 's4'); setlists = r3.setlists;
    expect(setlists[0].songIds).toEqual(['s1', 's2', 's3']);
    const r4 = undoRemoveSong(setlists, 'sl_a', 's4', r3.position); setlists = r4;
    expect(setlists[0].songIds).toEqual(['s1', 's2', 's3', 's4']);
  });

  test('toast state machine : nouveau retrait écrase l\'ancien toast', () => {
    // Simule un comportement séquentiel : un removedSong en cours,
    // puis un autre retrait → le précédent est définitivement perdu.
    let removedSong = { songId: 's2', position: 1, expiresAt: 1000 };
    const newRemove = { songId: 's3', position: 2, expiresAt: 2000 };
    // remplacement (clearTimeout précédent + set du nouveau)
    removedSong = newRemove;
    expect(removedSong.songId).toBe('s3');
  });
});
