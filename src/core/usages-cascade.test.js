// src/core/usages-cascade.test.js — Phase 7.79.3a tests.

import { describe, it, expect } from 'vitest';
import {
  getUsageOverride,
  resolveUsagesCascade,
  mergeUsagesOverridesLWW,
} from './usages-cascade.js';

describe('Phase 7.79.3 — getUsageOverride', () => {
  it('retourne undefined sur map null/undefined', () => {
    expect(getUsageOverride(null, 'foo')).toBeUndefined();
    expect(getUsageOverride(undefined, 'foo')).toBeUndefined();
  });

  it('retourne undefined sur name vide', () => {
    expect(getUsageOverride({ foo: { usages: [] } }, '')).toBeUndefined();
    expect(getUsageOverride({ foo: { usages: [] } }, null)).toBeUndefined();
  });

  it('retourne l\'entry quand présent', () => {
    const map = { 'My Preset': { usages: [{ artist: 'Metallica' }], lastModified: 100 } };
    expect(getUsageOverride(map, 'My Preset')).toEqual({ usages: [{ artist: 'Metallica' }], lastModified: 100 });
  });

  it('retourne undefined sur nom inconnu', () => {
    const map = { 'My Preset': { usages: [] } };
    expect(getUsageOverride(map, 'Other Preset')).toBeUndefined();
  });
});

describe('Phase 7.79.3 — resolveUsagesCascade', () => {
  // Helper : compose un state minimal
  const mkState = (overrides) => ({
    profileOv: undefined,
    studioOv: undefined,
    backlineOv: undefined,
    catalogEntry: null,
    ...overrides,
  });

  it('niveau 1 (user) gagne sur tous les autres', () => {
    const result = resolveUsagesCascade('foo', mkState({
      profileOv: { foo: { usages: [{ artist: 'UserArtist' }], lastModified: 100 } },
      studioOv: { foo: { usages: [{ artist: 'StudioArtist' }], lastModified: 200 } },
      backlineOv: { foo: { usages: [{ artist: 'BacklineArtist' }], lastModified: 300 } },
      catalogEntry: { usages: [{ artist: 'DefaultArtist' }] },
    }));
    expect(result.source).toBe('user');
    expect(result.usages[0].artist).toBe('UserArtist');
  });

  it('niveau 2 (studio) gagne sur backline+default si profile absent', () => {
    const result = resolveUsagesCascade('foo', mkState({
      studioOv: { foo: { usages: [{ artist: 'StudioArtist' }], curatedBy: 'TSR', lastModified: 100 } },
      backlineOv: { foo: { usages: [{ artist: 'BacklineArtist' }] } },
      catalogEntry: { usages: [{ artist: 'DefaultArtist' }] },
    }));
    expect(result.source).toBe('studio');
    expect(result.usages[0].artist).toBe('StudioArtist');
    expect(result.curatedBy).toBe('TSR');
  });

  it('niveau 3 (backline) gagne sur default si user+studio absents', () => {
    const result = resolveUsagesCascade('foo', mkState({
      backlineOv: { foo: { usages: [{ artist: 'BacklineArtist' }], lastModified: 100 } },
      catalogEntry: { usages: [{ artist: 'DefaultArtist' }] },
    }));
    expect(result.source).toBe('backline');
    expect(result.usages[0].artist).toBe('BacklineArtist');
  });

  it('niveau 4 (default catalog) gagne en dernier ressort', () => {
    const result = resolveUsagesCascade('foo', mkState({
      catalogEntry: { usages: [{ artist: 'DefaultArtist' }] },
    }));
    expect(result.source).toBe('default');
    expect(result.usages[0].artist).toBe('DefaultArtist');
  });

  it('override vide explicite (usages: null) au niveau profile STOP la cascade', () => {
    // L'user a retiré l'override → on doit retourner null,
    // PAS tomber sur studio/backline/default
    const result = resolveUsagesCascade('foo', mkState({
      profileOv: { foo: { usages: null, lastModified: 100 } },
      studioOv: { foo: { usages: [{ artist: 'StudioArtist' }] } },
      catalogEntry: { usages: [{ artist: 'DefaultArtist' }] },
    }));
    expect(result.source).toBe('user');
    expect(result.usages).toBe(null);
  });

  it('override vide explicite au niveau studio STOP aussi la cascade', () => {
    const result = resolveUsagesCascade('foo', mkState({
      studioOv: { foo: { usages: null, curatedBy: 'TSR' } },
      backlineOv: { foo: { usages: [{ artist: 'BacklineArtist' }] } },
      catalogEntry: { usages: [{ artist: 'DefaultArtist' }] },
    }));
    expect(result.source).toBe('studio');
    expect(result.usages).toBe(null);
    expect(result.curatedBy).toBe('TSR');
  });

  it('niveau présent sans champ usages → skip (cascade continue)', () => {
    // Entry présente mais sans key 'usages' → traité comme absent
    const result = resolveUsagesCascade('foo', mkState({
      profileOv: { foo: { lastModified: 100 } }, // pas de champ usages
      backlineOv: { foo: { usages: [{ artist: 'BacklineArtist' }] } },
    }));
    expect(result.source).toBe('backline');
    expect(result.usages[0].artist).toBe('BacklineArtist');
  });

  it('catalogEntry avec usages vide [] → fallback null source', () => {
    const result = resolveUsagesCascade('foo', mkState({
      catalogEntry: { usages: [] },
    }));
    expect(result.source).toBe(null);
    expect(result.usages).toBe(null);
  });

  it('rien nulle part → usages null + source null', () => {
    expect(resolveUsagesCascade('foo', mkState({}))).toEqual({ usages: null, source: null });
  });

  it('inputs invalides → empty result', () => {
    expect(resolveUsagesCascade(null, null)).toEqual({ usages: null, source: null });
    expect(resolveUsagesCascade('foo', null)).toEqual({ usages: null, source: null });
    expect(resolveUsagesCascade('', { catalogEntry: { usages: [{ artist: 'X' }] } })).toEqual({ usages: null, source: null });
  });

  it('catalogEntry usages non-Array (legacy/garbage) → fallback null', () => {
    const result = resolveUsagesCascade('foo', mkState({
      catalogEntry: { usages: 'not an array' },
    }));
    expect(result.source).toBe(null);
    expect(result.usages).toBe(null);
  });
});

describe('Phase 7.79.3 — mergeUsagesOverridesLWW', () => {
  it('local plus récent gagne sur conflit', () => {
    const local = { foo: { usages: [{ artist: 'Local' }], lastModified: 200 } };
    const remote = { foo: { usages: [{ artist: 'Remote' }], lastModified: 100 } };
    const out = mergeUsagesOverridesLWW(local, remote);
    expect(out.foo.usages[0].artist).toBe('Local');
  });

  it('remote plus récent gagne sur conflit', () => {
    const local = { foo: { usages: [{ artist: 'Local' }], lastModified: 100 } };
    const remote = { foo: { usages: [{ artist: 'Remote' }], lastModified: 200 } };
    const out = mergeUsagesOverridesLWW(local, remote);
    expect(out.foo.usages[0].artist).toBe('Remote');
  });

  it('égalité → keep local (stabilité)', () => {
    const local = { foo: { usages: [{ artist: 'Local' }], lastModified: 100 } };
    const remote = { foo: { usages: [{ artist: 'Remote' }], lastModified: 100 } };
    const out = mergeUsagesOverridesLWW(local, remote);
    expect(out.foo.usages[0].artist).toBe('Local');
  });

  it('local-only → préservé', () => {
    const local = { foo: { usages: [{ artist: 'LocalOnly' }], lastModified: 100 } };
    const remote = {};
    const out = mergeUsagesOverridesLWW(local, remote);
    expect(out.foo.usages[0].artist).toBe('LocalOnly');
  });

  it('remote-only → adopté', () => {
    const local = {};
    const remote = { foo: { usages: [{ artist: 'RemoteOnly' }], lastModified: 100 } };
    const out = mergeUsagesOverridesLWW(local, remote);
    expect(out.foo.usages[0].artist).toBe('RemoteOnly');
  });

  it('merge keys distinctes union', () => {
    const local = { a: { usages: [], lastModified: 100 } };
    const remote = { b: { usages: [], lastModified: 100 } };
    const out = mergeUsagesOverridesLWW(local, remote);
    expect(Object.keys(out).sort()).toEqual(['a', 'b']);
  });

  it('lastModified manquant → ts=0 fallback (legacy)', () => {
    const local = { foo: { usages: [{ artist: 'Local' }] } }; // pas de lastModified
    const remote = { foo: { usages: [{ artist: 'Remote' }], lastModified: 50 } };
    const out = mergeUsagesOverridesLWW(local, remote);
    expect(out.foo.usages[0].artist).toBe('Remote'); // remote (ts=50) > local (ts=0)
  });

  it('null/undefined inputs → {}', () => {
    expect(mergeUsagesOverridesLWW(null, null)).toEqual({});
    expect(mergeUsagesOverridesLWW(undefined, undefined)).toEqual({});
  });

  it('null map d\'un côté préserve l\'autre', () => {
    const remote = { foo: { usages: [{ artist: 'R' }], lastModified: 1 } };
    expect(mergeUsagesOverridesLWW(null, remote)).toEqual(remote);
    expect(mergeUsagesOverridesLWW(remote, null)).toEqual(remote);
  });

  it('override vide explicite (usages: null) propagé correctement', () => {
    // L'user a fait { usages: null } pour retirer un override — doit survivre
    // au merge LWW pour que la cascade lise bien "override vide" et stoppe
    const local = { foo: { usages: null, lastModified: 200 } };
    const remote = { foo: { usages: [{ artist: 'Remote' }], lastModified: 100 } };
    const out = mergeUsagesOverridesLWW(local, remote);
    expect(out.foo.usages).toBe(null); // override vide local gagne (plus récent)
    expect(out.foo.lastModified).toBe(200);
  });
});

describe('Phase 7.79.3 — Scénarios bout-en-bout (cascade + merge)', () => {
  it('Scénario : user perso écrase Backline qui écrase catalog', () => {
    // État initial : seul catalog a des usages
    let state = {
      profileOv: undefined,
      studioOv: undefined,
      backlineOv: undefined,
      catalogEntry: { usages: [{ artist: 'OriginalCatalogArtist' }] },
    };
    expect(resolveUsagesCascade('foo', state).source).toBe('default');

    // Backline admin enrichit
    state.backlineOv = { foo: { usages: [{ artist: 'AdminCurated' }], lastModified: 100 } };
    expect(resolveUsagesCascade('foo', state).source).toBe('backline');
    expect(resolveUsagesCascade('foo', state).usages[0].artist).toBe('AdminCurated');

    // User perso préfère sa version
    state.profileOv = { foo: { usages: [{ artist: 'MyOwn' }], lastModified: 200 } };
    expect(resolveUsagesCascade('foo', state).source).toBe('user');
    expect(resolveUsagesCascade('foo', state).usages[0].artist).toBe('MyOwn');

    // User restaure le default (override vide explicite niveau user)
    state.profileOv = { foo: { usages: null, lastModified: 300 } };
    expect(resolveUsagesCascade('foo', state).source).toBe('user');
    expect(resolveUsagesCascade('foo', state).usages).toBe(null);
    // Note : "Restaurer Backline" devrait DELETE l'entry, pas écrire null.
    // Tester ce cas séparément :
    delete state.profileOv.foo;
    expect(resolveUsagesCascade('foo', state).source).toBe('backline');
  });

  it('Scénario : sync Firestore — deux devices créent overrides différents', () => {
    // Device A crée override sur preset Alpha
    const deviceA = { alpha: { usages: [{ artist: 'A-Artist' }], lastModified: 100 } };
    // Device B crée override sur preset Beta (concurrent)
    const deviceB = { beta: { usages: [{ artist: 'B-Artist' }], lastModified: 150 } };
    // Au pull, A reçoit B
    const merged = mergeUsagesOverridesLWW(deviceA, deviceB);
    expect(Object.keys(merged).sort()).toEqual(['alpha', 'beta']);
    expect(merged.alpha.usages[0].artist).toBe('A-Artist');
    expect(merged.beta.usages[0].artist).toBe('B-Artist');
  });

  it('Scénario : sync Firestore — conflit sur le même preset', () => {
    // A modifie alpha à t=100
    const deviceA = { alpha: { usages: [{ artist: 'A-v1' }], lastModified: 100 } };
    // B modifie alpha à t=200 (plus tard)
    const deviceB = { alpha: { usages: [{ artist: 'B-v2' }], lastModified: 200 } };
    // A pull B → adopt B
    const merged = mergeUsagesOverridesLWW(deviceA, deviceB);
    expect(merged.alpha.usages[0].artist).toBe('B-v2');
  });
});
