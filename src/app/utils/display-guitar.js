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

export default resolveDisplayGuitar;
