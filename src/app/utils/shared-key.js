// src/app/utils/shared-key.js — Phase 7.14 (découpage main.jsx).
//
// Holder pour la clé Gemini partagée (chargée depuis Firestore au boot
// par `loadSharedKey()` côté state, et écrasable par les profils admin
// via "Partager la clé"). C'est un singleton volontaire : utilisé
// uniquement par fetchAI et 2-3 helpers AI inline pour fallback quand
// l'utilisateur n'a pas posé sa propre clé `aiKeys.gemini`.
//
// Pattern : module avec getter/setter explicites, plutôt qu'un export
// `let` muable (qui ne propage pas la mutation aux imports).

let _sharedGeminiKey = '';

function getSharedGeminiKey() { return _sharedGeminiKey; }

function setSharedGeminiKey(k) {
  _sharedGeminiKey = k || '';
  // Bridge legacy pour les console hacks (Sébastien manuel) et pour les
  // anciens call sites qui lisaient `window.DEFAULT_GEMINI_KEY`.
  if (typeof window !== 'undefined') window.DEFAULT_GEMINI_KEY = _sharedGeminiKey;
}

export { getSharedGeminiKey, setSharedGeminiKey };
