import { describe, it, expect } from 'vitest';
import { cleanUsages } from './ToneNetTab.jsx';

// Phase 7.53 — Tests du helper cleanUsages.
// Helper pur extrait du composant ToneNetTab. Garantit que la
// sérialisation des usages avant persist est propre (pas d'entrée
// vide, dedup songs, undefined si liste totalement vide).

describe('cleanUsages — Phase 7.53', () => {
  it('liste vide → undefined', () => {
    expect(cleanUsages([])).toBeUndefined();
    expect(cleanUsages(null)).toBeUndefined();
    expect(cleanUsages(undefined)).toBeUndefined();
  });

  it('artiste vide → drop', () => {
    expect(cleanUsages([{ artist: '', songs: ['X'] }])).toBeUndefined();
    expect(cleanUsages([{ artist: '   ', songs: ['X'] }])).toBeUndefined();
  });

  it('artiste valide sans songs → garde sans songs vides', () => {
    const out = cleanUsages([{ artist: 'Joe Walsh' }]);
    expect(out).toEqual([{ artist: 'Joe Walsh', songs: [] }]);
  });

  it('artiste + songs → trim + dedup', () => {
    const out = cleanUsages([
      { artist: '  Black Sabbath  ', songs: ['Paranoid', '  Iron Man  ', 'Paranoid'] },
    ]);
    expect(out).toEqual([
      { artist: 'Black Sabbath', songs: ['Paranoid', 'Iron Man'] },
    ]);
  });

  it('drops entries with empty artist mixés avec valides', () => {
    const out = cleanUsages([
      { artist: 'Eric Clapton', songs: ['Layla'] },
      { artist: '', songs: ['Bohemian Rhapsody'] },
      { artist: 'Brian May', songs: [] },
    ]);
    expect(out).toEqual([
      { artist: 'Eric Clapton', songs: ['Layla'] },
      { artist: 'Brian May', songs: [] },
    ]);
  });

  it('songs filtre les valeurs vides ou string-y', () => {
    const out = cleanUsages([
      { artist: 'Slash', songs: ['Sweet Child', '', null, '   ', 'November Rain'] },
    ]);
    expect(out).toEqual([
      { artist: 'Slash', songs: ['Sweet Child', 'November Rain'] },
    ]);
  });

  it('input null/falsy dans la liste tolérés', () => {
    const out = cleanUsages([null, { artist: 'Slash' }, undefined]);
    expect(out).toEqual([{ artist: 'Slash', songs: [] }]);
  });

  it('coerce artist non-string', () => {
    const out = cleanUsages([{ artist: 42, songs: ['Test'] }]);
    expect(out).toEqual([{ artist: '42', songs: ['Test'] }]);
  });
});
