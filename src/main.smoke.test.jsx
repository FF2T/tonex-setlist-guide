// @vitest-environment jsdom
//
// Smoke test — mount React de l'App complète.
//
// Raison d'être : le hotfix v8.14.156 (écran noir prod, 2026-05-21) a
// corrigé un ReferenceError TDZ — un `useEffect` dont le deps array
// référençait `profile` AVANT la déclaration `const profile = ...`.
// Ce bug était runtime-only : ni la suite Vitest (qui ne testait que
// des helpers purs), ni le build Vite minifié ne l'attrapaient. Il ne
// s'est manifesté qu'en prod, au 1er render React.
//
// Ce test monte l'App entière dans jsdom et vérifie que le mount ne
// throw pas. Il aurait attrapé le TDZ : un deps array fautif est
// évalué synchroneusement au 1er render → render() throw → test rouge.
//
// C'est volontairement un test « large et grossier » : il ne vérifie
// pas un comportement précis, juste que l'arbre React se monte sans
// exploser. Filet anti-régression pour les bugs d'init / d'ordre de
// déclaration dans main.jsx.

import { describe, test, expect, beforeAll, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { App } from './main.jsx';

beforeAll(() => {
  // ── Stubs jsdom ──────────────────────────────────────────────────
  // jsdom (env de ce test) n'implémente pas toutes les API navigateur
  // que l'App touche au render / dans ses effects. On les neutralise
  // AVANT tout render de <App/> pour que le test échoue uniquement sur
  // un vrai bug d'init, jamais sur une API manquante.

  // fetch : les helpers Firestore tournent dans des useEffect. Réponse
  // bénigne `ok:false` → les helpers prennent leur branche d'échec
  // déjà gérée (try/catch internes), aucun appel réseau réel.
  globalThis.fetch = () => Promise.resolve({
    ok: false,
    status: 0,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });

  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false, media: '', onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
      dispatchEvent() { return false; },
    });
  }
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = (cb) =>
      setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0);
    window.cancelIdleCallback = (id) => clearTimeout(id);
  }
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class {
      observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
    };
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  }
  // jsdom logge « Not implemented » sur scrollTo — on le neutralise.
  window.scrollTo = () => {};

  // Rejets asynchrones tardifs (Firestore en arrière-plan via les
  // effects) : sans intérêt pour un smoke test, on les avale pour ne
  // pas polluer le run.
  process.on('unhandledRejection', () => {});
});

afterEach(() => {
  cleanup();
});

describe('main.jsx — smoke mount', () => {
  test('App est bien exporté comme composant', () => {
    expect(typeof App).toBe('function');
  });

  test('le mount de <App/> ne throw pas (filet TDZ / ordre d\'init)', () => {
    let result;
    expect(() => {
      result = render(<App />);
    }).not.toThrow();
    // L'arbre racine doit être rendu (div.page-root du return de App).
    expect(document.querySelector('.page-root')).not.toBeNull();
    if (result) result.unmount();
  });
});
