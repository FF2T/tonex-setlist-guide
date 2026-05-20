// src/core/usages-cascade.integration.test.js — Phase 7.79.3 (solidification).
//
// Tests d'intégration end-to-end de la cascade 4 niveaux :
//   - resolveUsagesCascade (Phase 7.79.3a)
//   - findCatalogEntry avec window._usagesCascadeState (Phase 7.79.3a)
//   - saveUsagesForPreset routing (Phase 7.79.3b)
//   - removeUsagesOverride (Phase 7.79.3b)
//   - mergeUsagesOverridesLWW (Phase 7.79.3a)
//
// Différent de usages-cascade.test.js (tests unitaires des helpers purs) :
// ici on simule des SCÉNARIOS COMPLETS d'usage avec interactions entre
// les helpers et findCatalogEntry. Test du contrat global du système.

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Phase 7.79.3 — Le fichier .test.js tourne par défaut en env Node
// (pas jsdom). findCatalogEntry's _applyUsagesCascade early-return si
// `typeof window === 'undefined'`. On stub window globalement pour que
// la cascade soit appliquée par findCatalogEntry pendant les tests.
beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {};
  }
});
afterAll(() => {
  // Cleanup uniquement si on a posé window nous-mêmes.
  if (globalThis.window && Object.keys(globalThis.window).length <= 1) {
    delete globalThis.window;
  }
});

import { findCatalogEntry } from './catalog.js';
import {
  resolveUsagesCascade,
  mergeUsagesOverridesLWW,
} from './usages-cascade.js';
import {
  saveUsagesForPreset,
  removeUsagesOverride,
} from './preset-curation.js';

// Nom de preset Factory v2 qui a une entry catalog stable mais SANS
// usages d'origine — parfait pour tester la cascade.
// (Choisir un name connu pour PRESET_CATALOG_MERGED : "HG 800" est
//  un preset Factory v2 garanti par audit-factory-curation.test.js)
const TEST_PRESET = 'HG 800';

// Helpers de setup pour simuler les setters App
function makeStateSimulator() {
  const state = {
    profileOv: {},
    studioOv: {},
    backlineOv: {},
    profiles: { sebastien: {} },
    activeProfileId: 'sebastien',
  };
  // Setters style React (acceptent reducer)
  const setSharedUsagesOverrides = (reducer) => {
    const sh = { usagesOverrides: state.backlineOv };
    const next = reducer(sh);
    state.backlineOv = next?.usagesOverrides || {};
    syncWindow();
  };
  const setProfiles = (reducer) => {
    const next = reducer(state.profiles);
    state.profiles = next || state.profiles;
    // Re-sync profileOv depuis profile.usagesOverrides
    state.profileOv = state.profiles[state.activeProfileId]?.usagesOverrides || {};
    syncWindow();
  };
  const syncWindow = () => {
    if (typeof window === 'undefined') return;
    window._usagesCascadeState = {
      profileOv: state.profileOv,
      studioOv: state.studioOv,
      backlineOv: state.backlineOv,
    };
  };
  // Init window state vide
  syncWindow();
  return { state, setSharedUsagesOverrides, setProfiles, syncWindow };
}

describe('Phase 7.79.3 — Cascade end-to-end : admin curé visible tous', () => {
  let sim;
  beforeEach(() => { sim = makeStateSimulator(); });
  afterEach(() => { if (typeof window !== 'undefined') delete window._usagesCascadeState; });

  it('état initial : pas d\'override, findCatalogEntry retourne catalog brut', () => {
    const entry = findCatalogEntry(TEST_PRESET);
    expect(entry).toBeTruthy();
    expect(entry.guessed).not.toBe(true);
    // Pas de _usagesSource car cascade state existe mais aucun override actif
    // → findCatalogEntry retourne l'entry tel quel (rétro-compat).
    expect(entry._usagesSource).toBeUndefined();
  });

  it('admin écrit un override Backline → findCatalogEntry annote _usagesSource=backline', () => {
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'Iron Maiden' }], {
      findEntry: findCatalogEntry,
      isAdmin: true,
      onShared: sim.setSharedUsagesOverrides,
    });
    // Vérification de l'override dans le state simulé
    expect(sim.state.backlineOv[TEST_PRESET]).toBeTruthy();
    expect(sim.state.backlineOv[TEST_PRESET].usages).toEqual([{ artist: 'Iron Maiden' }]);
    // findCatalogEntry retourne maintenant l'entry enrichie
    const entry = findCatalogEntry(TEST_PRESET);
    expect(entry._usagesSource).toBe('backline');
    expect(entry.usages).toEqual([{ artist: 'Iron Maiden' }]);
  });

  it('user perso override + admin Backline existant → user gagne (priorité niveau 1)', () => {
    // Admin pose un override Backline
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'AdminVersion' }], {
      findEntry: findCatalogEntry,
      isAdmin: true,
      onShared: sim.setSharedUsagesOverrides,
    });
    // User perso ajoute son override
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'UserVersion' }], {
      findEntry: findCatalogEntry,
      isAdmin: false,
      activeProfileId: 'sebastien',
      onProfiles: sim.setProfiles,
    });
    const entry = findCatalogEntry(TEST_PRESET);
    expect(entry._usagesSource).toBe('user');
    expect(entry.usages[0].artist).toBe('UserVersion');
    // L'override Backline existe toujours côté state, juste caché par user
    expect(sim.state.backlineOv[TEST_PRESET].usages[0].artist).toBe('AdminVersion');
  });

  it('user clique "Restaurer" → DELETE override user, cascade reprend à Backline', () => {
    // Setup : Backline + user
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'BacklineVersion' }], {
      findEntry: findCatalogEntry,
      isAdmin: true,
      onShared: sim.setSharedUsagesOverrides,
    });
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'UserVersion' }], {
      findEntry: findCatalogEntry,
      isAdmin: false,
      activeProfileId: 'sebastien',
      onProfiles: sim.setProfiles,
    });
    expect(findCatalogEntry(TEST_PRESET)._usagesSource).toBe('user');
    // User Restaure
    removeUsagesOverride(TEST_PRESET, {
      findEntry: findCatalogEntry,
      isAdmin: false,
      activeProfileId: 'sebastien',
      onProfiles: sim.setProfiles,
    });
    const entry = findCatalogEntry(TEST_PRESET);
    expect(entry._usagesSource).toBe('backline');
    expect(entry.usages[0].artist).toBe('BacklineVersion');
  });

  it('user override vide explicite (usages: null) STOP la cascade au niveau user', () => {
    // Backline pose un override
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'BacklineVersion' }], {
      findEntry: findCatalogEntry,
      isAdmin: true,
      onShared: sim.setSharedUsagesOverrides,
    });
    // User écrit override "vide" (usages=undefined → { usages: null })
    saveUsagesForPreset(TEST_PRESET, undefined, {
      findEntry: findCatalogEntry,
      isAdmin: false,
      activeProfileId: 'sebastien',
      onProfiles: sim.setProfiles,
    });
    const entry = findCatalogEntry(TEST_PRESET);
    // Source 'user' (l'user a parlé), usages null (vide explicite)
    expect(entry._usagesSource).toBe('user');
    expect(entry.usages).toBe(null);
    // L'override Backline existe toujours côté state mais masqué
    expect(sim.state.backlineOv[TEST_PRESET].usages[0].artist).toBe('BacklineVersion');
  });

  it('admin retire son override Backline → findCatalogEntry revient au catalog default', () => {
    // Admin pose puis retire
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'AdminVersion' }], {
      findEntry: findCatalogEntry,
      isAdmin: true,
      onShared: sim.setSharedUsagesOverrides,
    });
    expect(findCatalogEntry(TEST_PRESET)._usagesSource).toBe('backline');
    removeUsagesOverride(TEST_PRESET, {
      findEntry: findCatalogEntry,
      isAdmin: true,
      onShared: sim.setSharedUsagesOverrides,
    });
    const entry = findCatalogEntry(TEST_PRESET);
    // Pas d'override actif, mais cascade state non-vide → on tombe sur 'default'
    // ou aucun _usagesSource si entry n'a pas d'usages catalog (HG 800 n'en a pas)
    expect(entry._usagesSource === 'default' || entry._usagesSource === undefined).toBe(true);
  });
});

describe('Phase 7.79.3 — Sync Firestore : merge LWW per-item bout-en-bout', () => {
  it('2 devices créent des overrides sur presets différents → union au merge', () => {
    const deviceA = {
      'HG 800': { usages: [{ artist: 'Metallica' }], lastModified: 1000 },
    };
    const deviceB = {
      'CL HIWTT': { usages: [{ artist: 'Pink Floyd' }], lastModified: 1500 },
    };
    const merged = mergeUsagesOverridesLWW(deviceA, deviceB);
    expect(Object.keys(merged).sort()).toEqual(['CL HIWTT', 'HG 800']);
    expect(merged['HG 800'].usages[0].artist).toBe('Metallica');
    expect(merged['CL HIWTT'].usages[0].artist).toBe('Pink Floyd');
  });

  it('2 devices modifient le même preset à des temps différents → plus récent gagne', () => {
    const deviceA = {
      'HG 800': { usages: [{ artist: 'V1' }], lastModified: 1000 },
    };
    const deviceB = {
      'HG 800': { usages: [{ artist: 'V2' }], lastModified: 2000 },
    };
    // A pull B : B plus récent
    expect(mergeUsagesOverridesLWW(deviceA, deviceB)['HG 800'].usages[0].artist).toBe('V2');
    // B pull A : reste B (plus récent)
    expect(mergeUsagesOverridesLWW(deviceB, deviceA)['HG 800'].usages[0].artist).toBe('V2');
  });

  it('override vide explicite (usages: null) plus récent → propagé au merge', () => {
    const deviceA = {
      'HG 800': { usages: null, lastModified: 2000 }, // user a clear l'override
    };
    const deviceB = {
      'HG 800': { usages: [{ artist: 'OldVersion' }], lastModified: 1000 },
    };
    const merged = mergeUsagesOverridesLWW(deviceA, deviceB);
    expect(merged['HG 800'].usages).toBe(null);
    expect(merged['HG 800'].lastModified).toBe(2000);
  });

  it('édition concurrente same-second (égalité ts) → keep local pour stabilité', () => {
    const deviceA = { 'HG 800': { usages: [{ artist: 'A' }], lastModified: 1500 } };
    const deviceB = { 'HG 800': { usages: [{ artist: 'B' }], lastModified: 1500 } };
    // Au pull, on garde local en cas d'égalité (anti-thrashing).
    expect(mergeUsagesOverridesLWW(deviceA, deviceB)['HG 800'].usages[0].artist).toBe('A');
    expect(mergeUsagesOverridesLWW(deviceB, deviceA)['HG 800'].usages[0].artist).toBe('B');
  });
});

describe('Phase 7.79.3 — Préparation Phase 11 Studio-driven', () => {
  let sim;
  beforeEach(() => { sim = makeStateSimulator(); });
  afterEach(() => { if (typeof window !== 'undefined') delete window._usagesCascadeState; });

  it('studio override (niveau 2) gagne sur backline (niveau 3)', () => {
    // Backline pose un override (niveau 3)
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'BacklineVersion' }], {
      findEntry: findCatalogEntry,
      isAdmin: true,
      onShared: sim.setSharedUsagesOverrides,
    });
    // Studio (Phase 11, simulé ici en posant directement studioOv)
    sim.state.studioOv = {
      [TEST_PRESET]: { usages: [{ artist: 'StudioVersion' }], curatedBy: 'TSR', lastModified: 5000 },
    };
    sim.syncWindow();
    const entry = findCatalogEntry(TEST_PRESET);
    expect(entry._usagesSource).toBe('studio');
    expect(entry.usages[0].artist).toBe('StudioVersion');
    expect(entry._usagesCuratedBy).toBe('TSR');
  });

  it('hiérarchie complète : user > studio > backline > catalog', () => {
    // 1. Catalog seul (état initial, HG 800 sans usages)
    let entry = findCatalogEntry(TEST_PRESET);
    expect(entry._usagesSource).toBeUndefined();

    // 2. + Backline (niveau 3 prend la main)
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'L3' }], {
      findEntry: findCatalogEntry,
      isAdmin: true,
      onShared: sim.setSharedUsagesOverrides,
    });
    entry = findCatalogEntry(TEST_PRESET);
    expect(entry._usagesSource).toBe('backline');

    // 3. + Studio (niveau 2 prend la main, Phase 11 simulé)
    sim.state.studioOv = {
      [TEST_PRESET]: { usages: [{ artist: 'L2' }], curatedBy: 'AA', lastModified: 5000 },
    };
    sim.syncWindow();
    entry = findCatalogEntry(TEST_PRESET);
    expect(entry._usagesSource).toBe('studio');

    // 4. + User (niveau 1 prend la main)
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'L1' }], {
      findEntry: findCatalogEntry,
      isAdmin: false,
      activeProfileId: 'sebastien',
      onProfiles: sim.setProfiles,
    });
    entry = findCatalogEntry(TEST_PRESET);
    expect(entry._usagesSource).toBe('user');
    expect(entry.usages[0].artist).toBe('L1');
  });
});

describe('Phase 7.79.3 — Sécurité : isolation entre profils non-admin', () => {
  it('user A pose override perso → user B (autre profil) ne le voit pas', () => {
    // Setup : 2 profils
    const state = {
      profileOv_userA: {},
      profileOv_userB: {},
      backlineOv: {},
    };
    const setProfilesA = (reducer) => {
      const next = reducer({ userA: { usagesOverrides: state.profileOv_userA } });
      state.profileOv_userA = next.userA?.usagesOverrides || {};
    };
    // userA pose son override
    saveUsagesForPreset(TEST_PRESET, [{ artist: 'OnlyMine' }], {
      findEntry: findCatalogEntry,
      isAdmin: false,
      activeProfileId: 'userA',
      onProfiles: setProfilesA,
    });
    expect(state.profileOv_userA[TEST_PRESET]).toBeTruthy();
    // userB n'a rien — cascade state pour userB = profileOv_userB vide
    if (typeof window !== 'undefined') {
      window._usagesCascadeState = {
        profileOv: state.profileOv_userB, // {} vide
        studioOv: {},
        backlineOv: state.backlineOv,
      };
    }
    const entry = findCatalogEntry(TEST_PRESET);
    // userB ne voit pas l'override de userA
    expect(entry._usagesSource).not.toBe('user');
    if (typeof window !== 'undefined') delete window._usagesCascadeState;
  });
});
