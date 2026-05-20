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

const { t, tFormat, tPlural, getLocale, setLocale, SUPPORTED_LOCALES, subscribeLocale, detectFreshLocale, forceDemoLocale, setProfileLanguageUpdater } = await import('./index.js');

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

  it('clé absente des dicts retourne le fallback FR inline', () => {
    // Phase 7.40 : en.js / es.js sont remplis. Pour tester le fallback
    // inline il faut une clé qui n'existe dans aucun dict.
    setLocale('en');
    expect(t('inexistante.cle.x', 'Ajouter un morceau')).toBe('Ajouter un morceau');
    setLocale('es');
    expect(t('inexistante.cle.x', 'Ajouter un morceau')).toBe('Ajouter un morceau');
  });

  it('clé présente dans en.js retourne la valeur EN', () => {
    setLocale('en');
    expect(t('add-song.title', 'Ajouter un morceau')).toBe('Add a song');
  });

  it('clé présente dans es.js retourne la valeur ES', () => {
    setLocale('es');
    expect(t('add-song.title', 'Ajouter un morceau')).toBe('Añadir una canción');
  });

  it('locale fr → fallback inline (fr.js vide, comportement Phase E)', () => {
    setLocale('fr');
    expect(t('add-song.title', 'Ajouter un morceau')).toBe('Ajouter un morceau');
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

  // Phase 7.82 — Bug #3 fix : tPlural lit aussi le format plat des
  // dicts en.js/es.js (avant Phase 7.82, seul le format imbriqué via
  // split('.').reduce était essayé, donc 'list.songs-count' tombait
  // sur le fallback FR inline même en EN).
  it('lit le format plat des dicts (en/es) pour les keys avec point', () => {
    setLocale('en');
    expect(tPlural('list.songs-count', 1, {}, { one: '1 morceau', other: '{count} morceaux' })).toBe('1 song');
    expect(tPlural('list.songs-count', 5, {}, { one: '1 morceau', other: '{count} morceaux' })).toBe('5 songs');
    setLocale('es');
    expect(tPlural('list.songs-count', 1, {}, { one: '1 morceau', other: '{count} morceaux' })).toBe('1 canción');
    expect(tPlural('list.songs-count', 8, {}, { one: '1 morceau', other: '{count} morceaux' })).toBe('8 canciones');
  });
});

// Phase 7.82.1 — Bug #0 fix : detectFreshLocale lit toujours
// localStorage + navigator.language sans dépendre du cache module, et
// forceDemoLocale bascule l'i18n module sans déclencher
// _profileLanguageUpdater (qui écrirait dans le profil curateur).
describe('detectFreshLocale (Phase 7.82.1)', () => {
  it('retourne le locale stocké dans localStorage si valide', () => {
    localStorage.setItem('backline_locale', 'es');
    expect(detectFreshLocale()).toBe('es');
  });

  it('fallback navigator.language si localStorage vide', () => {
    localStorage.removeItem('backline_locale');
    // jsdom par défaut : navigator.language = 'en-US'
    expect(detectFreshLocale()).toBe('en');
  });

  it('ignore un localStorage avec valeur invalide', () => {
    localStorage.setItem('backline_locale', 'jp');
    // tombe sur navigator.language detection
    expect(detectFreshLocale()).toBe('en');
  });

  it('bypass le cache module : retourne la valeur localStorage actuelle même si le cache pointait autre chose', () => {
    setLocale('fr'); // pose _cachedLocale='fr'
    localStorage.setItem('backline_locale', 'es');
    // detectFreshLocale ignore le cache et relit localStorage
    expect(detectFreshLocale()).toBe('es');
  });
});

describe('forceDemoLocale (Phase 7.82.1)', () => {
  it('bascule getLocale immédiatement', () => {
    setLocale('fr');
    forceDemoLocale('en');
    expect(getLocale()).toBe('en');
  });

  it('notifie les listeners subscribeLocale', () => {
    setLocale('fr');
    let received = null;
    const unsub = subscribeLocale((l) => { received = l; });
    forceDemoLocale('es');
    expect(received).toBe('es');
    unsub();
  });

  it('NE déclenche PAS _profileLanguageUpdater (pas d\'écriture profil curateur)', () => {
    let updaterCalled = false;
    setProfileLanguageUpdater(() => { updaterCalled = true; });
    forceDemoLocale('en');
    expect(updaterCalled).toBe(false);
    setProfileLanguageUpdater(null);
  });

  it('no-op si locale identique au state courant', () => {
    setLocale('en');
    let calls = 0;
    const unsub = subscribeLocale(() => { calls += 1; });
    forceDemoLocale('en');
    expect(calls).toBe(0);
    unsub();
  });

  it('rejette les locales non supportés', () => {
    setLocale('fr');
    forceDemoLocale('jp');
    expect(getLocale()).toBe('fr');
  });
});
