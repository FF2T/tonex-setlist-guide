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

export function getLocale() {
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
  _tCache.clear(); // Phase 7.41 — invalider le memo t() au changement de langue.
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
  const node = key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : undefined, dict);
  const variant = n === 1 ? 'one' : 'other';
  let template;
  if (node && typeof node === 'object' && node[variant] !== undefined) template = node[variant];
  else if (fallbacks && fallbacks[variant] !== undefined) template = fallbacks[variant];
  else template = String(n);
  const merged = { count: n, ...(params || {}) };
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (merged[k] !== undefined ? String(merged[k]) : m));
}
