// src/app/styles/tokens.js — Phase 7.55.7 S6 (S6-1).
//
// Mini design-system Backline : tokens typographiques + helpers de
// style pour badges, tiles, sections. Centralise les patterns ad-hoc
// dispersés dans ListScreen / SongDetailCard / PresetBrowser /
// HomeScreen depuis Phase 1-7.86 (audit code statique 25/05 a relevé
// 9 fontSize différents et 6 patterns badge sans spec unifiée).
//
// Stratégie :
//   - CSS vars (tokens.css + index.html bridge) restent source de vérité
//     pour les couleurs/backgrounds/borders. Pas de nouveaux tokens CSS.
//   - JS helpers retournent des objets style React prêts à spread en
//     `style={...}` ou à étendre. Couleurs dynamiques (score-based)
//     passées en paramètre.
//   - Discipline de naming : la doc des helpers indique quel canonique
//     CSS var est utilisé (préfère --text-primary à --text-bright/--text,
//     --bg-elev-1 à --a3/--a4, etc.).

// ───────────────────────────────────────────────────────────────
// Tokens typographiques (4 niveaux + 2 display)
// ───────────────────────────────────────────────────────────────
//
// Hiérarchie validée Sébastien 25/05 :
//   micro (9)  : labels uppercase, source badges, hints, scores compacts
//   meta  (10) : badges (slot/label/score), metadata mono, valeurs potards
//   body  (12) : body standard, infos card, descriptions
//   emph  (14) : titres section, titre morceau (collapsed row)
//   xl    (20) : titre fiche dépliée (Phase 7.86 sticky)
//   2xl   (32) : titre splash / app name (uniquement écrans accueil)
//
// Élimine la zone grise 9/10/11px qui se chevauchait (66 occurrences
// 11 + 101 occurrences 10 → fusion en 10/12 selon contexte sémantique).
export const TYPO = Object.freeze({
  micro: 9,
  meta: 10,
  body: 12,
  emph: 14,
  xl: 20,
  '2xl': 32,
});

// FontWeight : 4 niveaux suffisants. Le 500 (3 occurrences orphelines)
// est fusionné dans 400 (normal). Le 800 (11 occurrences erratiques)
// reste pour les data emphasis (scores hyper visibles).
export const WEIGHT = Object.freeze({
  normal: 400,
  medium: 600,
  bold: 700,
  black: 800,
});

// ───────────────────────────────────────────────────────────────
// Couleurs sémantiques — réfèrent aux 3 canoniques tokens.css
// ───────────────────────────────────────────────────────────────
//
// Discipline : utiliser CSS_TEXT_1/2/3 plutôt que --text-bright,
// --text-muted, --text-dim qui sont juste des alias. Les 3 niveaux
// suffisent pour toute la UI.
export const TEXT_1 = 'var(--text-primary)';   // Titres, données importantes
export const TEXT_2 = 'var(--text-secondary)'; // Body, labels visibles
export const TEXT_3 = 'var(--text-tertiary)';  // Hints, footnotes, dim

// Backgrounds canoniques (3 niveaux + accent).
export const BG_1 = 'var(--bg-elev-1)';   // Card, row background
export const BG_2 = 'var(--bg-elev-2)';   // Hover sur BG_1, secondary surfaces
export const BG_3 = 'var(--bg-elev-3)';   // Tertiary, max elevation
export const BG_ACCENT = 'var(--accent-soft)';

// Borders canoniques.
export const BORDER_SUBTLE = 'var(--border-subtle)';
export const BORDER_STRONG = 'var(--border-strong)';
export const BORDER_ACCENT = 'var(--border-accent)';

// ───────────────────────────────────────────────────────────────
// Helpers badge (5 variants)
// ───────────────────────────────────────────────────────────────
//
// Tous les badges partagent :
//   - fontSize: TYPO.meta (10) — pas TYPO.micro (réservé sections titles)
//   - borderRadius: var(--r-sm)
//   - padding: 1-2px vertical, 6-8px horizontal
//
// Différences :
//   score : color dynamique + bg dynamique + border `${color}30` semi-transparent
//   slot  : color dynamique + bg `${color}18` ultra léger + border `${color}40`
//   label : color dynamique optionnelle + border conditionnelle (transparent OK)
//   pill  : font-mono optionnel, bg neutre BG_1, border subtle (potards G/B/M/T/V)
//   tag   : micro size, uppercase, accent-bg actif (FX badges Gate/Verb)

/**
 * Badge score % — affichage d'un score numérique avec couleur sémantique.
 * @param {object} opts
 * @param {string} opts.color - couleur principale (scoreColor result)
 * @param {string} opts.bg    - couleur background (scoreBg result)
 */
export function badgeScore({ color, bg }) {
  return {
    fontFamily: 'var(--font-mono)',
    fontSize: TYPO.meta,
    fontWeight: WEIGHT.black,
    color,
    background: bg,
    border: `1px solid ${color}30`,
    borderRadius: 'var(--r-sm)',
    padding: '1px 6px',
  };
}

/**
 * Badge slot bank — "12B", "9C" — couleur unifiée score-based.
 * @param {object} opts
 * @param {string} opts.color - couleur unifiée (scoreColor || deviceColor || fallback)
 */
export function badgeSlot({ color }) {
  return {
    fontSize: TYPO.meta,
    fontWeight: WEIGHT.bold,
    color,
    background: `${color}18`,
    border: `1px solid ${color}40`,
    borderRadius: 'var(--r-sm)',
    padding: '1px 6px',
  };
}

/**
 * Badge label preset — "AA MRSH JT50 · Marshall" — typiquement tronqué.
 * @param {object} opts
 * @param {string} opts.color - couleur texte
 * @param {string} [opts.bg]  - background (transparent si absent)
 */
export function badgeLabel({ color, bg }) {
  return {
    fontSize: TYPO.meta,
    fontWeight: WEIGHT.bold,
    color,
    background: bg || 'transparent',
    border: color ? `1px solid ${color}30` : 'none',
    borderRadius: 'var(--r-sm)',
    padding: '1px 6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  };
}

/**
 * Badge pill — info compacte neutre, optionnellement monospace.
 * Usage : guitare badge, potards "G6.2 B4.5 ...", chips info.
 * @param {object} [opts]
 * @param {boolean} [opts.mono=false] - utiliser font-mono
 */
export function badgePill(opts = {}) {
  const { mono = false } = opts;
  return {
    fontSize: TYPO.meta,
    fontWeight: WEIGHT.medium,
    color: TEXT_2,
    background: BG_1,
    border: `1px solid ${BORDER_SUBTLE}`,
    borderRadius: 'var(--r-md)',
    padding: '2px 8px',
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
    whiteSpace: 'nowrap',
  };
}

/**
 * Badge tag — micro uppercase, état actif/inactif.
 * Usage : FX badges (Gate/Verb), filtres on/off.
 * @param {object} [opts]
 * @param {boolean} [opts.active=true] - état coloré accent ou neutre
 */
export function badgeTag(opts = {}) {
  const { active = true } = opts;
  return {
    fontSize: TYPO.micro,
    fontWeight: WEIGHT.bold,
    color: active ? 'var(--accent)' : TEXT_3,
    background: active ? BG_ACCENT : 'transparent',
    border: `1px solid ${active ? BORDER_ACCENT : BORDER_SUBTLE}`,
    borderRadius: 'var(--r-sm)',
    padding: '1px 7px',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  };
}

// ───────────────────────────────────────────────────────────────
// Helpers section (card + title)
// ───────────────────────────────────────────────────────────────

/**
 * Card de section — fond, border, padding, margin uniforme.
 * Usage : SECTION 1/2/3 SongDetailCard, group containers.
 * @param {object} [opts]
 * @param {boolean} [opts.accent=false] - variante avec teinte accent
 */
export function sectionCard(opts = {}) {
  const { accent = false } = opts;
  return {
    background: accent ? BG_ACCENT : BG_1,
    border: `1px solid ${accent ? BORDER_ACCENT : BORDER_SUBTLE}`,
    borderRadius: 'var(--r-lg)',
    padding: '10px 12px',
    marginBottom: 8,
  };
}

/**
 * Titre de section — micro uppercase mono avec letterSpacing.
 * Usage : "📖 Infos morceau", "🎯 Recommandations IA", etc.
 */
export function sectionTitle() {
  return {
    fontSize: TYPO.micro,
    fontWeight: WEIGHT.bold,
    color: TEXT_3,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-wider)',
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  };
}

// ───────────────────────────────────────────────────────────────
// Helpers tile (pour PresetBrowser catégories + amplis)
// ───────────────────────────────────────────────────────────────

/**
 * Tile massive — pour grille de catégories / amplis (PresetBrowser).
 * S4-2 a aligné les chips catégorie d'entrée sur ce format.
 * S7.1 (25/05) : textAlign 'center' (cohérent avec les tuiles
 * "Parcourir par ampli" ligne ~920). Le user demande l'homogénéité.
 * @param {object} [opts]
 * @param {boolean} [opts.active=false] - état sélectionné
 */
export function tile(opts = {}) {
  const { active = false } = opts;
  return {
    fontSize: TYPO.body,
    fontWeight: active ? WEIGHT.bold : WEIGHT.medium,
    color: active ? 'var(--accent)' : TEXT_1,
    background: active ? BG_ACCENT : BG_1,
    border: `1px solid ${active ? BORDER_ACCENT : BORDER_SUBTLE}`,
    borderRadius: 'var(--r-md)',
    padding: '10px 14px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all .15s',
  };
}

/**
 * Chip compact — pour filtres secondaires (sous-pack, modèle amp).
 * @param {object} [opts]
 * @param {boolean} [opts.active=false]
 */
export function chip(opts = {}) {
  const { active = false } = opts;
  return {
    fontSize: TYPO.meta,
    fontWeight: active ? WEIGHT.bold : WEIGHT.medium,
    color: active ? 'var(--accent)' : TEXT_2,
    background: active ? BG_ACCENT : BG_1,
    border: `1px solid ${active ? BORDER_ACCENT : BORDER_SUBTLE}`,
    borderRadius: 'var(--r-md)',
    // Audit Cowork v9.7.4 (P0-08) — nowrap pour éviter cassure mid-mot.
    // Audit v9.7.9 (P1-D) — bump padding 4×8 → 10×12 + minHeight 40
    // pour cible tactile iPad (vs 22px observé). Toujours "chip-like".
    padding: '10px 12px',
    minHeight: 40,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
