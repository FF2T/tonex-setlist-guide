// src/core/branding.js — Phase 5.2.
// Constantes d'identité produit. Centralisées ici pour permettre un
// rebrand global propre. Précédent nom : "ToneX Poweruser" (renommé
// Phase 5.2, mai 2026, suite à l'élargissement du scope au-delà du
// strict ToneX Pedal — l'app couvre maintenant 4 devices : ToneX
// Pedal, ToneX Pedal Anniversary, ToneX Plug, et Tone Master Pro).
//
// IMPORTANT : ces constantes ne couvrent QUE l'identité produit. Le
// terme "ToneX" reste utilisé comme marque pour les noms de devices
// (ToneX Pedal, ToneX Plug…) et de sources de captures (TSR,
// Anniversary, Factory, ToneNET) — ce sont des produits/marques
// IK Multimedia tiers, pas du branding interne.
//
// IMPORTANT 2 : les LS_KEY (`tonex_guide_v2`, `tonex_secrets`, etc.)
// dans state.js restent inchangés pour préserver la rétrocompat des
// données utilisateur déjà stockées localStorage.

const APP_NAME = 'Backline';
const APP_TAGLINE = 'Le guide intelligent pour tes pédales et amplis modélisés';
const APP_SHORT_NAME = 'Backline';

// Phase 7.84 dette → bonus Phase 7.79.3 — Tagline localisée pour la
// modale d'intro (SplashPopup) et autres sites EN/ES où l'APP_TAGLINE
// brut était affiché en FR pour les visiteurs non-francophones.
// Fallback FR si locale inconnu.
const APP_TAGLINE_BY_LOCALE = {
  fr: APP_TAGLINE,
  en: 'The intelligent guide for your modeled pedals and amps',
  es: 'La guía inteligente para tus pedales y amplificadores modelados',
};

function getAppTagline(locale) {
  return APP_TAGLINE_BY_LOCALE[locale] || APP_TAGLINE;
}

// Phase 7.73.0 — Formulaire Tally pour les feedbacks beta-testeurs.
// Champs cachés pré-remplis via URL params : profile_name + app_version
// (Tally les expose comme champs cachés natifs).
const TALLY_FEEDBACK_URL = 'https://tally.so/r/xXR1G5';

/**
 * Construit l'URL Tally avec pré-remplissage des champs cachés.
 * @param {string} profileName - Nom du profil actif (pour réponse perso)
 * @param {string} appVersion - Version Backline (debug)
 */
function buildFeedbackUrl(profileName, appVersion) {
  const url = new URL(TALLY_FEEDBACK_URL);
  if (profileName) url.searchParams.set('profile_name', profileName);
  if (appVersion) url.searchParams.set('app_version', appVersion);
  return url.toString();
}

// Phase 7.55.5 — Formulaires Tally bilingues pour les demandes d'accès
// beta depuis le mode démo (DemoBanner) + landing publique (LandingScreen
// Phase 7.60.1). Distinct de TALLY_FEEDBACK_URL (Phase 7.73.0, feedback
// générique post-login).
//
// 1 form par locale (FR + EN). Si locale courante n'a pas de form mappé,
// fallback FR (Sébastien comprend les 3 langues côté réponse). ES suit
// FR pour l'instant — basculer sur EN serait pire (les hispanophones
// bilingues FR sont rares vs hispanophones bilingues EN). Si demande
// explicite ES, ajouter un form ES et un mapping ici.
//
// Champs Tally : pseudo + email + guitares + ToneX hardware (radio) +
// morceaux + source (radio Reddit/DM/Démo/Studio/Autre) + temps démo
// (radio <5/5-15/>15min). Hidden field "source" pour distinguer
// demandes "depuis demo banner" vs landing publique.
const TALLY_FORM_ID_BY_LOCALE = {
  fr: 'RGbBVd',
  en: '68WQyO',
};

/**
 * Construit l'URL Tally demande d'accès beta selon la locale active,
 * avec param `source` pour distinguer les canaux d'entrée.
 * @param {object} opts - { source: 'demo_banner' | 'landing' | ..., locale: 'fr'|'en'|'es' }
 */
function buildDemoRequestUrl(opts) {
  const locale = opts?.locale;
  const formId = TALLY_FORM_ID_BY_LOCALE[locale] || TALLY_FORM_ID_BY_LOCALE.fr;
  try {
    const url = new URL(`https://tally.so/r/${formId}`);
    if (opts?.source) url.searchParams.set('source', opts.source);
    return url.toString();
  } catch (_e) {
    return `https://tally.so/r/${formId}`;
  }
}

export {
  APP_NAME, APP_TAGLINE, APP_TAGLINE_BY_LOCALE, getAppTagline, APP_SHORT_NAME,
  TALLY_FEEDBACK_URL, buildFeedbackUrl,
  TALLY_FORM_ID_BY_LOCALE, buildDemoRequestUrl,
};
