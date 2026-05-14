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

export function getLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && SUPPORTED_IDS.has(stored)) return stored;
    // Premier boot : détecte et persiste pour stabilité au reload.
    const detected = detectBrowserLocale();
    try { localStorage.setItem(LOCALE_KEY, detected); } catch (e) {}
    return detected;
  } catch (e) {
    return 'fr';
  }
}

const listeners = new Set();

export function setLocale(loc) {
  if (!SUPPORTED_IDS.has(loc)) return;
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

// t('home.add-song', 'Ajouter un morceau') — fallback obligatoire pour
// les strings non encore wrappées. La string FR reste la source de
// vérité tant qu'on n'a pas rempli le dict.
export function t(key, fallback) {
  const locale = getLocale();
  const v = lookup(key, locale);
  if (v !== undefined) return v;
  // Fallback FR si la clé existe en français mais pas dans la locale active.
  if (locale !== 'fr') {
    const frVal = lookup(key, 'fr');
    if (frVal !== undefined) return frVal;
  }
  return fallback !== undefined ? fallback : key;
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
