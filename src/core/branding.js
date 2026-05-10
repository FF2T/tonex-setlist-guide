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

export { APP_NAME, APP_TAGLINE, APP_SHORT_NAME };
