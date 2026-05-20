// src/i18n/index.js — Phase 7.36 (fondations multilingue).
//
// Helpers t/tFormat/tPlural pour internationaliser Backline en FR/EN/ES.
// Phase 7.36 pose l'infrastructure : auto-détection navigator.language
// au premier boot, sélecteur de langue dans Mon Profil → Affichage,
// event de re-render. Les strings UI restent hardcoded FR — c'est la
// Phase 7.37+ qui wrappera les composants.

import { useEffect, useState } from 'react';
import fr from './fr.js';
import en from './en.js';
import es from './es.js';

const LOCALE_KEY = 'backline_locale';
const DICTS = { fr, en, es };

export const SUPPORTED_LOCALES = [
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
];

const SUPPORTED_IDS = new Set(SUPPORTED_LOCALES.map((l) => l.id));

// Auto-détection navigator.language au premier boot uniquement (pas de
// valeur dans localStorage). Renvoie 'fr', 'en', ou 'es' selon le prefix.
function detectBrowserLocale() {
  try {
    const nav = (typeof navigator !== 'undefined' && navigator.language) || '';
    const prefix = nav.toLowerCase().split('-')[0];
    if (SUPPORTED_IDS.has(prefix)) return prefix;
  } catch (e) {}
  return 'fr';
}

// Phase 7.41 — Cache la locale au niveau du module pour éviter un
// localStorage.getItem à chaque appel t()/tFormat()/tPlural(). Sans
// cache, un écran comme ListScreen (~30 morceaux × ~3 calls = 100
// lectures localStorage par render) devenait perceptiblement lent.
let _cachedLocale = null;

// Phase 7.49 — i18n per-profile. L'App appelle bindActiveProfile(profile)
// au switch de profil ; getLocale() priorise profile.language sur le
// localStorage global. setLocale() écrit dans profile.language via un
// updater callback enregistré par l'App + persiste localStorage en
// fallback (utilisé par ProfilePicker avant le pick).
//
// Phase 7.51.2 — En mode démo, setLocale n'écrit PAS dans profile.language
// (le profil démo est in-memory only). Le visiteur peut quand même
// changer la langue via le localStorage global (UI pref, pas liée au profil).
let _activeProfileLanguage = null;
let _activeProfileIsDemo = false;
let _profileLanguageUpdater = null;

export function bindActiveProfile(profile) {
  const next = (profile && SUPPORTED_IDS.has(profile.language)) ? profile.language : null;
  _activeProfileIsDemo = profile?.isDemo === true;
  if (next === _activeProfileLanguage) return;
  _activeProfileLanguage = next;
  if (next) {
    _cachedLocale = next;
    _tCache.clear();
    listeners.forEach((cb) => { try { cb(next); } catch (e) {} });
  }
}

export function setProfileLanguageUpdater(updater) {
  _profileLanguageUpdater = typeof updater === 'function' ? updater : null;
}

// Phase 7.82.1 — detectFreshLocale : re-détecte le locale "frais" sans
// toucher au cache module. Phase 7.82 utilisait getLocale() dans
// enterDemoMode mais _cachedLocale peut être figé sur une mauvaise
// valeur (LandingScreen monté avant que le visiteur n'ait choisi sa
// langue, ou cache stale). detectFreshLocale lit toujours localStorage
// + navigator.language sans dépendre du cache.
export function detectFreshLocale() {
  try {
    const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem(LOCALE_KEY) : null;
    if (stored && SUPPORTED_IDS.has(stored)) return stored;
  } catch (e) {}
  return detectBrowserLocale();
}

// Phase 7.82.1 — forceDemoLocale : force le locale module (cache +
// active profile language + invalide cache memo + notify listeners)
// SANS déclencher _profileLanguageUpdater (qui écrirait dans
// profile.language → Firestore via le profil curateur). Utilisé par
// enterDemoMode pour basculer l'i18n vers le locale du visiteur avant
// d'injecter le profil démo, sans modifier le profil source.
export function forceDemoLocale(loc) {
  if (!SUPPORTED_IDS.has(loc)) return;
  if (_activeProfileLanguage === loc && _cachedLocale === loc) return;
  _activeProfileLanguage = loc;
  _cachedLocale = loc;
  _tCache.clear();
  listeners.forEach((cb) => { try { cb(loc); } catch (e) {} });
}

export function getLocale() {
  if (_activeProfileLanguage) return _activeProfileLanguage;
  if (_cachedLocale !== null) return _cachedLocale;
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && SUPPORTED_IDS.has(stored)) {
      _cachedLocale = stored;
      return stored;
    }
    // Premier boot : détecte et persiste pour stabilité au reload.
    const detected = detectBrowserLocale();
    try { localStorage.setItem(LOCALE_KEY, detected); } catch (e) {}
    _cachedLocale = detected;
    return detected;
  } catch (e) {
    return 'fr';
  }
}

const listeners = new Set();

export function setLocale(loc) {
  if (!SUPPORTED_IDS.has(loc)) return;
  _cachedLocale = loc;
  _activeProfileLanguage = loc;
  _tCache.clear(); // Phase 7.41 — invalider le memo t() au changement de langue.
  // Phase 7.49 — écrit aussi dans profile.language via updater.
  // Phase 7.51.2 — En mode démo, skip l'updater (profil démo read-only).
  if (_profileLanguageUpdater && !_activeProfileIsDemo) {
    try { _profileLanguageUpdater(loc); } catch (e) {}
  }
  try { localStorage.setItem(LOCALE_KEY, loc); } catch (e) {}
  listeners.forEach((cb) => { try { cb(loc); } catch (e) {} });
}

export function subscribeLocale(cb) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// useLocale() — hook qui retourne la locale courante et force un
// re-render du composant appelant à chaque setLocale(). À appeler en
// tête de tout composant qui contient du t()/tFormat()/tPlural() et
// doit réagir au switch de langue.
export function useLocale() {
  const [loc, setLoc] = useState(getLocale());
  useEffect(() => subscribeLocale((next) => setLoc(next)), []);
  return loc;
}

function lookup(key, locale) {
  const dict = DICTS[locale] || DICTS.fr;
  if (!dict) return undefined;
  // Format plat : la clé entière est une key du dict (en.js / es.js Phase E).
  if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  // Format imbriqué : reduce sur split('.') (legacy fr.js, future flexibilité).
  return key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : undefined, dict);
}

// Phase 7.41 — Memo des résultats t()/lookup pour éviter de re-lookup
// la même clé à chaque render. ListScreen fait ~60-90 t/tFormat calls
// dans la boucle des songs ; sans memo c'était perceptible (10-30ms
// par render sur iOS). Cache invalidé via setLocale() qui clear la Map.
const _tCache = new Map(); // key: `${locale}|${key}`, value: resolved string ou undefined (negative cache)

function resolveT(key, locale, fallback) {
  const cacheKey = locale + '|' + key;
  if (_tCache.has(cacheKey)) {
    const cached = _tCache.get(cacheKey);
    return cached !== undefined ? cached : (fallback !== undefined ? fallback : key);
  }
  let v = lookup(key, locale);
  if (v === undefined && locale !== 'fr') {
    v = lookup(key, 'fr');
  }
  _tCache.set(cacheKey, v); // undefined = negative cache (fallback inline sera utilisé)
  return v !== undefined ? v : (fallback !== undefined ? fallback : key);
}

// t('home.add-song', 'Ajouter un morceau') — fallback obligatoire pour
// les strings non encore wrappées. La string FR reste la source de
// vérité tant qu'on n'a pas rempli le dict.
export function t(key, fallback) {
  return resolveT(key, getLocale(), fallback);
}

// tFormat('profile.deleted', { name: 'Bruno' }, 'Profil {name} supprimé')
// → "Profil Bruno supprimé". Remplace {placeholder} par params[placeholder].
export function tFormat(key, params, fallback) {
  const template = t(key, fallback);
  if (!params || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
}

// tPlural('songs.count', n, params, { one: '1 morceau', other: '{count} morceaux' })
// → choisit one/other selon n, applique remplacement {count} + params.
// Règle simple binaire (n===1 → one, sinon other) : suffisant pour fr/en/es.
export function tPlural(key, n, params, fallbacks) {
  const locale = getLocale();
  const dict = DICTS[locale] || DICTS.fr;
  // Phase 7.82 — Bug #3 ("8 morceaux" en EN) : tPlural cherchait
  // uniquement le format imbriqué via split('.').reduce. Les dicts
  // en.js/es.js sont en format plat (la clé entière "list.songs-count"
  // est une key directe) → lookup undefined → fallback inline FR
  // utilisé même en EN. Cohérence avec lookup() qui essaie d'abord
  // le format plat puis l'imbriqué.
  let node;
  if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
    node = dict[key];
  } else {
    node = key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : undefined, dict);
  }
  // Fallback locale FR si pas trouvé dans EN/ES (mêmes règles que t()).
  if (node === undefined && locale !== 'fr') {
    const frDict = DICTS.fr;
    if (frDict && Object.prototype.hasOwnProperty.call(frDict, key)) node = frDict[key];
    else node = key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : undefined, frDict);
  }
  const variant = n === 1 ? 'one' : 'other';
  let template;
  if (node && typeof node === 'object' && node[variant] !== undefined) template = node[variant];
  else if (fallbacks && fallbacks[variant] !== undefined) template = fallbacks[variant];
  else template = String(n);
  const merged = { count: n, ...(params || {}) };
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (merged[k] !== undefined ? String(merged[k]) : m));
}
