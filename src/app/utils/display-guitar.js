// src/app/utils/display-guitar.js — Phase 7.65
//
// resolveDisplayGuitar(aiC, rigGuitars, options?)
//
// Restreint la guitare à afficher au rig actif du profil.
//
// Pourquoi : Phase 3.6 (union all-rigs) fait que le prompt IA reçoit la
// liste des guitares de TOUS les profils (Sébastien + Arthur + …).
// Conséquence : `aiC.ideal_guitar` et `aiC.cot_step2_guitars[].name`
// peuvent référencer une guitare absente du rig actif. Si on les rend
// directement dans la vue d'un profil non-admin (vue repliée ListScreen
// notamment), on affiche une guitare qu'il ne possède pas.
//
// Phase 7.32 a déjà appliqué ce filtrage dans SongDetailCard (vue
// dépliée). Phase 7.65 généralise via ce helper partagé.
//
// Ordre de préférence :
//   1. `aiC.ideal_guitar` matche le rig → cette guitare (score :
//      cot_step2.score si présent, sinon localGuitarSongScore).
//   2. Premier `cot_step2_guitars[i]` dont name matche le rig → cette
//      guitare (score : cot.score, fallback localGuitarSongScore).
//   3. Si `fallbackToFirst === true` (défaut) : 1ère guitare du rig
//      avec localGuitarSongScore. Sinon : retourne null.
//   4. Rig vide → null.
//
// Retour : { guitar, score, source } où source ∈
//   'ideal' | 'cot' | 'fallback' | null
//
// `source === 'fallback'` permet à l'appelant de signaler à l'UI que
// le choix est dégradé (ex. ne pas marquer "idéal").
//
// Pas d'effets de bord. Importé par ListScreen (vue repliée) et
// SongDetailCard (vue dépliée, DRY).

import {
  findGuitarByAIName, findCotEntryForGuitar, localGuitarSongScore,
} from '../../core/scoring/guitar.js';

/**
 * filterCotGuitarsToRig(cotList, rigGuitars)
 *
 * Filtre la liste cot_step2_guitars pour ne garder que les entrées dont
 * le `name` matche une guitare du rig actif. Phase 7.65.1 — utilisé par
 * la section "🧠 Raisonnement IA → Scoring guitares" (SongDetailCard +
 * HomeScreen) pour ne pas exposer à un profil non-admin des guitares
 * d'autres profils via l'union all-rigs Phase 3.6.
 *
 * Retourne un nouveau tableau (l'original n'est jamais muté). Si vide,
 * l'appelant doit décider de cacher le sous-bloc (sinon il affiche
 * une section "Scoring guitares" vide).
 *
 * - cotList null/non-array → []
 * - rigGuitars null/vide → []
 * - entries sans name ou null → ignorées
 */
export function filterCotGuitarsToRig(cotList, rigGuitars) {
  if (!Array.isArray(cotList) || !cotList.length) return [];
  if (!Array.isArray(rigGuitars) || !rigGuitars.length) return [];
  return cotList.filter((c) => c?.name && findGuitarByAIName(c.name, rigGuitars));
}

export function resolveDisplayGuitar(aiC, rigGuitars, options = {}) {
  const { fallbackToFirst = true } = options;
  const rig = Array.isArray(rigGuitars) ? rigGuitars : [];
  if (!rig.length) return { guitar: null, score: null, source: null };

  // Étape 1 — ideal_guitar dans le rig ?
  if (aiC?.ideal_guitar) {
    const m = findGuitarByAIName(aiC.ideal_guitar, rig);
    if (m) {
      const cot = findCotEntryForGuitar(aiC?.cot_step2_guitars, m);
      const score = (cot?.score != null) ? cot.score : localGuitarSongScore(m, aiC);
      return { guitar: m, score, source: 'ideal' };
    }
  }

  // Étape 2 — premier cot_step2_guitars dans le rig ?
  const cotList = Array.isArray(aiC?.cot_step2_guitars) ? aiC.cot_step2_guitars : [];
  for (const c of cotList) {
    if (!c?.name) continue;
    const m = findGuitarByAIName(c.name, rig);
    if (m) {
      const score = (c.score != null) ? c.score : localGuitarSongScore(m, aiC);
      return { guitar: m, score, source: 'cot' };
    }
  }

  // Étape 3 — fallback rig[0] (sauf si fallbackToFirst=false).
  if (!fallbackToFirst) return { guitar: null, score: null, source: null };
  const fallback = rig[0];
  return {
    guitar: fallback,
    score: localGuitarSongScore(fallback, aiC),
    source: 'fallback',
  };
}

// ─── Phase 9.5.1 — Localisation des noms de pickup ─────────────────────────
//
// L'IA retourne `playing_hints.pickup` en anglais (jargon universel : Bridge,
// Neck, Middle, Position 2, etc.). Mais l'affichage FR/ES gagne à traduire
// ces termes pour cohérence avec `localGuitarSettings` qui produit déjà
// "Micro chevalet" / "Micro manche" en FR.
//
// Approche conservative : remplacement word-boundary sur les patterns
// courants. Préserve les annotations entre parenthèses (ex. "Position 4
// (Middle+Bridge)" → "Position 4 (intermédiaire+chevalet)" en FR).
// Si aucun pattern ne matche, retourne la string d'origine (le HSS Strat
// "Position 2-4" ou les setups exotiques restent tels quels).

const PICKUP_DICT = Object.freeze({
  fr: {
    Bridge: 'Chevalet',
    Neck: 'Manche',
    Middle: 'Intermédiaire',
    Position: 'Position',
  },
  es: {
    Bridge: 'Puente',
    Neck: 'Mástil',
    Middle: 'Intermedia',
    Position: 'Posición',
  },
});

export function localizePickup(name, locale) {
  if (typeof name !== 'string' || !name) return name;
  if (locale !== 'fr' && locale !== 'es') return name; // EN : inchangé
  const dict = PICKUP_DICT[locale];
  let out = name;
  // Ordre intentionnel : "Position" en premier (pour ne pas casser "Bridge" /
  // "Neck" / "Middle" dans "Position 2 (Neck+Middle)"). word-boundary `\b`
  // protège des sous-chaînes (ex. "Neckar" ne matchera pas "Neck").
  for (const key of ['Position', 'Bridge', 'Neck', 'Middle']) {
    out = out.replace(new RegExp(`\\b${key}\\b`, 'g'), dict[key]);
  }
  return out;
}

// ─── Phase 9.5.2 — Decapitalize première lettre d'une string ───────────────
//
// L'IA capitalize les symptoms des tweaks comme s'ils étaient des phrases
// autonomes ("Trop de distorsion", "Manque de clarté"). Concaténés avec
// le préfixe "Si"/"If"/"Si" dans l'UI, ça donne "Si Trop de..." (FR
// incorrect). Cette helper lowercase le 1er char SAUF si le 1er mot est
// un acronyme (tout en majuscules ≥ 2 chars, ex. "FRFR vs cab" → laisse
// "FRFR" tel quel).

export function decapitalizeFirst(s) {
  if (typeof s !== 'string' || !s) return s;
  const firstSpace = s.search(/\s/);
  const firstWord = firstSpace > 0 ? s.slice(0, firstSpace) : s;
  // Acronyme : tout en majuscules, ≥ 2 chars, au moins une lettre A-Z.
  // "FRFR", "EQ", "DI" → préservé. "Trop", "Manque", "A" → decap.
  if (
    firstWord.length >= 2 &&
    firstWord === firstWord.toUpperCase() &&
    /[A-Z]/.test(firstWord)
  ) {
    return s;
  }
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export default resolveDisplayGuitar;
