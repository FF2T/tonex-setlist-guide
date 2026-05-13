// src/i18n/index.js — Phase 7.26 (infra minimale).
//
// Helper t(key, fallback) pour internationaliser les strings UI de
// Backline. Pour l'instant tout reste en français hardcodé dans le
// code, ce module est juste l'infrastructure prête pour le jour où
// un beta testeur anglophone le déclenche.
//
// Quand on activera : remplir en.js + wrapper les strings UI en
// t('key.path') et ajouter un sélecteur de langue dans Mon Profil →
// 🎨 Affichage. Le contenu utilisateur (descriptions de morceaux,
// SONG_HISTORY) reste en français — c'est ton contenu, à toi de le
// traduire si tu veux.

import fr from './fr.js';

const LOCALE_KEY = 'backline_locale';
const DICTS = { fr };

export function getLocale() {
  try { return localStorage.getItem(LOCALE_KEY) || 'fr'; } catch (e) { return 'fr'; }
}

export function setLocale(loc) {
  try {
    if (loc === 'fr') localStorage.removeItem(LOCALE_KEY);
    else localStorage.setItem(LOCALE_KEY, loc);
  } catch (e) {}
}

export function t(key, fallback) {
  const locale = getLocale();
  const dict = DICTS[locale] || DICTS.fr;
  const v = key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : undefined, dict);
  return v !== undefined ? v : (fallback !== undefined ? fallback : key);
}
