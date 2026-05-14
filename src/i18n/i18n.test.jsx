// src/i18n/i18n.test.js — Phase 7.36 (fondations multilingue).
//
// Tests sur t() / tFormat() / tPlural() / setLocale / getLocale /
// SUPPORTED_LOCALES / auto-détection navigator.language au premier
// boot. Pas de test sur useLocale (hook React, couvert indirectement
// via le sélecteur dans MonProfilScreen au smoke test manuel).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// jsdom v29 + vitest 2.x : localStorage n'est pas exposé par défaut
// sur globalThis. On stub un Map-backed shim avant l'import dynamique
// du module (les helpers getLocale/setLocale font des try/catch
// défensifs mais les assertions directes du test ont besoin d'un
// vrai store fonctionnel).
const _store = new Map();
const lsShim = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); },
  clear: () => { _store.clear(); },
};
vi.stubGlobal('localStorage', lsShim);

const { t, tFormat, tPlural, getLocale, setLocale, SUPPORTED_LOCALES, subscribeLocale } = await import('./index.js');

beforeEach(() => {
  try { localStorage.removeItem('backline_locale'); } catch (e) {}
});

afterEach(() => {
  try { localStorage.removeItem('backline_locale'); } catch (e) {}
});

describe('SUPPORTED_LOCALES', () => {
  it('exporte fr/en/es avec labels et flags', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(3);
    const ids = SUPPORTED_LOCALES.map((l) => l.id);
    expect(ids).toEqual(['fr', 'en', 'es']);
    SUPPORTED_LOCALES.forEach((l) => {
      expect(l.label).toBeTruthy();
      expect(l.flag).toBeTruthy();
    });
  });
});

describe('getLocale', () => {
  it('retourne fr par défaut si navigator.language indéfini', () => {
    // jsdom expose navigator.language=en-US par défaut → detect 'en'.
    // On force le test en stockant fr explicitement.
    setLocale('fr');
    expect(getLocale()).toBe('fr');
  });

  it('respecte la valeur stockée', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    setLocale('es');
    expect(getLocale()).toBe('es');
  });

  it('persiste après reload (read direct localStorage)', () => {
    setLocale('en');
    const raw = localStorage.getItem('backline_locale');
    expect(raw).toBe('en');
  });

  it('persiste fr explicitement (Phase 7.36 fix : pas de removeItem)', () => {
    // Régression contre l'ancien design Phase 7.26 qui supprimait la
    // clé pour FR → auto-detect re-déclenchait au reload.
    setLocale('fr');
    const raw = localStorage.getItem('backline_locale');
    expect(raw).toBe('fr');
  });
});

describe('setLocale', () => {
  it('rejette une locale non supportée silencieusement', () => {
    setLocale('en');
    setLocale('de');
    expect(getLocale()).toBe('en');
  });

  it('notifie les subscribers', () => {
    let received = null;
    const unsub = subscribeLocale((loc) => { received = loc; });
    setLocale('es');
    expect(received).toBe('es');
    unsub();
  });

  it('unsubscribe stoppe les notifications', () => {
    let count = 0;
    const unsub = subscribeLocale(() => { count += 1; });
    setLocale('en');
    expect(count).toBe(1);
    unsub();
    setLocale('fr');
    expect(count).toBe(1);
  });
});

describe('t', () => {
  it('retourne la clé si pas de fallback ni traduction', () => {
    setLocale('fr');
    expect(t('inexistante.cle')).toBe('inexistante.cle');
  });

  it('retourne le fallback si la clé est absente', () => {
    setLocale('fr');
    expect(t('inexistante.cle', 'Texte par défaut')).toBe('Texte par défaut');
  });

  it('fallback identique en EN et ES tant que les dicts sont vides', () => {
    setLocale('en');
    expect(t('home.add-song', 'Ajouter un morceau')).toBe('Ajouter un morceau');
    setLocale('es');
    expect(t('home.add-song', 'Ajouter un morceau')).toBe('Ajouter un morceau');
  });
});

describe('tFormat', () => {
  it('remplace les placeholders {name}', () => {
    setLocale('fr');
    expect(tFormat('profile.deleted', { name: 'Bruno' }, 'Profil {name} supprimé')).toBe('Profil Bruno supprimé');
  });

  it('garde le placeholder intact si param manquant', () => {
    setLocale('fr');
    expect(tFormat('x.y', {}, 'Bonjour {name}')).toBe('Bonjour {name}');
  });

  it('supporte plusieurs placeholders', () => {
    setLocale('fr');
    expect(tFormat('x.y', { a: '1', b: '2' }, 'A={a}, B={b}')).toBe('A=1, B=2');
  });

  it('coerce les nombres en string', () => {
    setLocale('fr');
    expect(tFormat('x.y', { n: 42 }, 'N={n}')).toBe('N=42');
  });
});

describe('tPlural', () => {
  it('retourne one si n===1', () => {
    setLocale('fr');
    expect(tPlural('songs.count', 1, {}, { one: '1 morceau', other: '{count} morceaux' })).toBe('1 morceau');
  });

  it('retourne other si n!==1', () => {
    setLocale('fr');
    expect(tPlural('songs.count', 0, {}, { one: '1 morceau', other: '{count} morceaux' })).toBe('0 morceaux');
    expect(tPlural('songs.count', 5, {}, { one: '1 morceau', other: '{count} morceaux' })).toBe('5 morceaux');
  });

  it('remplace {count} par n', () => {
    setLocale('fr');
    expect(tPlural('x.y', 42, {}, { one: '1', other: '{count}' })).toBe('42');
  });

  it('merge params au remplacement', () => {
    setLocale('fr');
    expect(tPlural('x.y', 3, { name: 'Bruno' }, { one: '{name} a 1 morceau', other: '{name} a {count} morceaux' })).toBe('Bruno a 3 morceaux');
  });
});
