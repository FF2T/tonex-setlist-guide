// src/app/utils/ai-error-helper.js — Phase 7.55.7 S7.
//
// Classification des erreurs Gemini/Anthropic en messages user-friendly
// trilingues. Les erreurs remontent depuis fetchAI() via `throw new
// Error(d.error.message)` — donc on a accès au message brut du provider
// (ex. "Your project has exceeded its monthly spending cap...").
//
// Categories détectées (regex case-insensitive sur err.message) :
//   - quota   : limite mensuelle / rate limit / RESOURCE_EXHAUSTED / 429
//   - auth    : clé API invalide / 401 / 403 / UNAUTHENTICATED / INVALID_ARGUMENT
//   - safety  : contenu bloqué par filtres de sécurité Gemini
//   - parse   : JSON malformé retourné par l'IA
//   - network : pas de connexion, timeout, fetch failed
//   - unknown : tout le reste (fallback message générique)

const RE_QUOTA = /spending\s*cap|rate\s*limit|quota|RESOURCE_EXHAUSTED|exceeded|429|limit.*exceeded|over\s*limit/i;
const RE_AUTH = /api[\s_-]*key|UNAUTHENTICATED|UNAUTHORIZED|INVALID_ARGUMENT|invalid\s*key|401|403|API_KEY_INVALID/i;
const RE_SAFETY = /blocked.*safety|SAFETY|RECITATION|PROHIBITED_CONTENT/i;
const RE_PARSE = /JSON|parse|unexpected\s+token|malformed/i;
const RE_NETWORK = /Failed\s*to\s*fetch|NetworkError|ECONNREFUSED|ETIMEDOUT|network\s*error|timeout/i;

/**
 * Classifie une erreur AI selon son message brut.
 * @param {Error|string|object} err - L'erreur (Error, string, ou objet { message })
 * @returns {string} kind ∈ { 'quota', 'auth', 'safety', 'parse', 'network', 'unknown' }
 */
export function classifyAIError(err) {
  if (!err) return 'unknown';
  const msg = typeof err === 'string' ? err : (err.message || err.toString() || '');
  if (!msg) return 'unknown';
  // Ordre des matches : quota avant auth car "spending cap" mentionne parfois "key"
  if (RE_QUOTA.test(msg)) return 'quota';
  if (RE_AUTH.test(msg)) return 'auth';
  if (RE_SAFETY.test(msg)) return 'safety';
  if (RE_PARSE.test(msg)) return 'parse';
  if (RE_NETWORK.test(msg)) return 'network';
  return 'unknown';
}

// Messages trilingues par catégorie. Chaque entrée retourne :
//   - icon : emoji
//   - title : titre court (header)
//   - body : explication + 1-2 phrases context
//   - hints : array d'actions suggérées (1-3 items)
//   - learnMoreUrl : URL externe (optionnel, pour quota Gemini par ex)
//
// Le rawMessage est passé séparément au composant d'affichage qui peut
// le révéler en détails dépliables (debug).

const MESSAGES_FR = {
  quota: {
    icon: '🤖',
    title: 'L\'IA Gemini a atteint son quota mensuel',
    body: 'La clé Gemini partagée a dépassé son plafond de dépense pour ce mois-ci. Les analyses IA sont temporairement indisponibles.',
    hints: [
      'Configure ta propre clé Gemini dans Mon Profil → Clé API (gratuite jusqu\'à 15 requêtes/min).',
      'Attends le 1er du mois prochain pour le reset automatique du quota.',
    ],
    learnMoreUrl: 'https://ai.google.dev/gemini-api/docs/billing#project-spend-caps',
    learnMoreLabel: 'Voir la doc Gemini billing',
  },
  auth: {
    icon: '🔑',
    title: 'Clé API invalide',
    body: 'La clé Gemini configurée n\'est pas reconnue par Google.',
    hints: [
      'Vérifie ta clé dans Mon Profil → Clé API.',
      'Récupère une nouvelle clé sur ai.google.dev (gratuite).',
    ],
    learnMoreUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
    learnMoreLabel: 'Obtenir une clé Gemini',
  },
  safety: {
    icon: '🚧',
    title: 'Contenu bloqué par les filtres Gemini',
    body: 'Le morceau ou les paramètres ont déclenché les filtres de sécurité de Gemini (rare).',
    hints: [
      'Réessaye avec un autre titre (peut-être un caractère spécial qui pose problème).',
      'Si le bug persiste, signale-le via le bouton 💬 feedback.',
    ],
  },
  parse: {
    icon: '🧩',
    title: 'Réponse IA mal formatée',
    body: 'L\'IA a répondu mais sa réponse n\'est pas un JSON valide. C\'est temporaire — Gemini réessaie souvent mieux au 2e coup.',
    hints: [
      'Clique à nouveau sur 🤖 Analyser pour relancer l\'IA.',
      'Si ça persiste, change de mode IA dans la fiche (équilibré / fidèle / interprétation).',
    ],
  },
  network: {
    icon: '📡',
    title: 'Pas de connexion',
    body: 'L\'app n\'arrive pas à contacter les serveurs Gemini. Vérifie ta connexion réseau.',
    hints: [
      'Vérifie que tu es connecté à Internet.',
      'Si tu es derrière un VPN ou un firewall, désactive-le temporairement.',
    ],
  },
  unknown: {
    icon: '⚠️',
    title: 'Erreur IA inattendue',
    body: 'L\'analyse IA a échoué pour une raison inconnue. Le message technique est affiché ci-dessous.',
    hints: [
      'Réessaye dans quelques secondes.',
      'Si ça persiste, signale via le bouton 💬 feedback.',
    ],
  },
};

const MESSAGES_EN = {
  quota: {
    icon: '🤖',
    title: 'Gemini AI has reached its monthly quota',
    body: 'The shared Gemini key has exceeded its monthly spending cap. AI analysis is temporarily unavailable.',
    hints: [
      'Configure your own Gemini key in My Profile → API Key (free up to 15 req/min).',
      'Wait for the 1st of next month for automatic quota reset.',
    ],
    learnMoreUrl: 'https://ai.google.dev/gemini-api/docs/billing#project-spend-caps',
    learnMoreLabel: 'See Gemini billing docs',
  },
  auth: {
    icon: '🔑',
    title: 'Invalid API key',
    body: 'The Gemini API key configured is not recognized by Google.',
    hints: [
      'Check your key in My Profile → API Key.',
      'Get a new key on ai.google.dev (free).',
    ],
    learnMoreUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
    learnMoreLabel: 'Get a Gemini key',
  },
  safety: {
    icon: '🚧',
    title: 'Content blocked by Gemini safety filters',
    body: 'The song or parameters triggered Gemini\'s safety filters (rare).',
    hints: [
      'Try with another title (maybe a special character is causing issues).',
      'If the bug persists, report it via the 💬 feedback button.',
    ],
  },
  parse: {
    icon: '🧩',
    title: 'AI response malformed',
    body: 'The AI responded but the response is not valid JSON. This is temporary — Gemini often does better on retry.',
    hints: [
      'Click 🤖 Analyze again to retry the AI.',
      'If it persists, change the AI mode (balanced / faithful / interpretation).',
    ],
  },
  network: {
    icon: '📡',
    title: 'No connection',
    body: 'The app can\'t reach Gemini servers. Check your network connection.',
    hints: [
      'Make sure you\'re connected to the Internet.',
      'If behind a VPN or firewall, try disabling it temporarily.',
    ],
  },
  unknown: {
    icon: '⚠️',
    title: 'Unexpected AI error',
    body: 'AI analysis failed for an unknown reason. The technical message is shown below.',
    hints: [
      'Try again in a few seconds.',
      'If it persists, report via the 💬 feedback button.',
    ],
  },
};

const MESSAGES_ES = {
  quota: {
    icon: '🤖',
    title: 'La IA Gemini ha alcanzado su cuota mensual',
    body: 'La clave Gemini compartida ha superado su límite de gasto este mes. El análisis IA está temporalmente no disponible.',
    hints: [
      'Configura tu propia clave Gemini en Mi Perfil → Clave API (gratis hasta 15 req/min).',
      'Espera al 1º del mes siguiente para el reinicio automático.',
    ],
    learnMoreUrl: 'https://ai.google.dev/gemini-api/docs/billing#project-spend-caps',
    learnMoreLabel: 'Ver documentación de facturación Gemini',
  },
  auth: {
    icon: '🔑',
    title: 'Clave API inválida',
    body: 'La clave Gemini configurada no es reconocida por Google.',
    hints: [
      'Verifica tu clave en Mi Perfil → Clave API.',
      'Obtén una nueva clave en ai.google.dev (gratis).',
    ],
    learnMoreUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
    learnMoreLabel: 'Obtener una clave Gemini',
  },
  safety: {
    icon: '🚧',
    title: 'Contenido bloqueado por los filtros Gemini',
    body: 'La canción o los parámetros activaron los filtros de seguridad de Gemini (raro).',
    hints: [
      'Intenta con otro título (quizá un carácter especial causa problemas).',
      'Si el problema persiste, repórtalo con el botón 💬 feedback.',
    ],
  },
  parse: {
    icon: '🧩',
    title: 'Respuesta IA mal formada',
    body: 'La IA respondió pero la respuesta no es JSON válido. Es temporal — Gemini suele hacerlo mejor en el reintento.',
    hints: [
      'Haz clic en 🤖 Analizar para reintentar la IA.',
      'Si persiste, cambia el modo IA (equilibrado / fiel / interpretación).',
    ],
  },
  network: {
    icon: '📡',
    title: 'Sin conexión',
    body: 'La app no puede contactar los servidores Gemini. Verifica tu conexión de red.',
    hints: [
      'Asegúrate de estar conectado a Internet.',
      'Si usas un VPN o firewall, intenta desactivarlo temporalmente.',
    ],
  },
  unknown: {
    icon: '⚠️',
    title: 'Error IA inesperado',
    body: 'El análisis IA falló por una razón desconocida. El mensaje técnico se muestra abajo.',
    hints: [
      'Reintenta en unos segundos.',
      'Si persiste, repórtalo con el botón 💬 feedback.',
    ],
  },
};

const MESSAGES_BY_LOCALE = { fr: MESSAGES_FR, en: MESSAGES_EN, es: MESSAGES_ES };

/**
 * Retourne le message structuré pour une erreur AI selon le locale.
 * @param {Error|string} err - L'erreur
 * @param {string} [locale='fr'] - Locale fr|en|es
 * @returns {object} { kind, icon, title, body, hints, learnMoreUrl?, learnMoreLabel?, rawMessage }
 */
export function getAIErrorMessage(err, locale = 'fr') {
  const kind = classifyAIError(err);
  const dict = MESSAGES_BY_LOCALE[locale] || MESSAGES_BY_LOCALE.fr;
  const entry = dict[kind] || dict.unknown;
  const rawMessage = (typeof err === 'string') ? err : (err?.message || String(err || ''));
  return { kind, rawMessage, ...entry };
}
