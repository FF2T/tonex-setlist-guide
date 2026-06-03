// Phase 13.0 (2026-06-02) — Helpers purs ARTISTS.
//
// Source de vérité ARTISTS_SEED dans src/data/artists.js. Les helpers
// ici sont purs (input → output, pas d'I/O, pas de mutation) pour
// faciliter les tests Vitest et l'usage cross-modules.
//
// Phase 13.4 ajoutera la cascade lookup avec shared.artistsOverrides
// (admin runtime) et shared.artistsAutoEnrichments (Phase 13.6+).
// Pour l'instant on lit uniquement ARTISTS_SEED.

import { ARTISTS_SEED, BAND_TO_ARTIST_IDS } from '../data/artists.js';

// ============================================================
// Phase 13.4 — Cascade lookup avec overrides runtime
// ============================================================
//
// Pattern Phase 7.79.3 : les helpers lisent
//   1. ARTISTS_SEED (Phase 13.0 manual + Cowork v1/v2)
//   2. shared.artistsOverrides (admin edits runtime via UI Phase 13.4)
//
// Les overrides sont posés par main.jsx via setArtistsRuntimeState()
// au boot et à chaque pull Firestore. Tests Vitest stub un state vide
// par défaut → helpers retombent sur ARTISTS_SEED.
//
// Structure shared.artistsOverrides :
//   { [artistId]: Artist | null }
//   - Artist : override (créé ou modifié)
//   - null : delete override (le seed reprend la main si présent, sinon
//     l'artiste disparaît du lookup)

/** @type {Object<string, import('../data/artists.js').Artist | null> | null} */
let _artistsRuntimeOverrides = null;

/**
 * Pose les overrides runtime ARTISTS (appelé par main.jsx au boot
 * et à chaque pull Firestore).
 *
 * Le state attendu est :
 *   { [artistId]: { artist: Artist|null, lastModified: number } }
 *
 * Pour la cascade lookup côté getEffectiveArtistsMap, on extrait
 * uniquement le champ `artist` (ignore lastModified runtime).
 *
 * @param {Object<string, {artist: import('../data/artists.js').Artist | null, lastModified: number}> | null} stamped
 */
export function setArtistsRuntimeState(stamped) {
  if (!stamped || typeof stamped !== 'object') {
    _artistsRuntimeOverrides = null;
    return;
  }
  const plain = {};
  for (const [id, wrapper] of Object.entries(stamped)) {
    if (wrapper && typeof wrapper === 'object' && 'artist' in wrapper) {
      plain[id] = wrapper.artist;
    }
  }
  _artistsRuntimeOverrides = plain;
}

/**
 * Merge LWW per-item pour shared.artistsOverrides. Pattern identique
 * à mergeUsagesOverridesLWW (Phase 7.79.3).
 *
 * Format : { [artistId]: { artist, lastModified } }
 *
 * @param {Object | null | undefined} local
 * @param {Object | null | undefined} remote
 * @returns {Object<string, {artist: import('../data/artists.js').Artist | null, lastModified: number}>}
 */
export function mergeArtistsOverridesLWW(local, remote) {
  const safeLocal = (local && typeof local === 'object') ? local : {};
  const safeRemote = (remote && typeof remote === 'object') ? remote : {};
  const out = { ...safeLocal };
  for (const [id, remoteEntry] of Object.entries(safeRemote)) {
    if (!remoteEntry || typeof remoteEntry !== 'object') continue;
    const localEntry = safeLocal[id];
    const lts = (localEntry && typeof localEntry.lastModified === 'number') ? localEntry.lastModified : 0;
    const rts = (typeof remoteEntry.lastModified === 'number') ? remoteEntry.lastModified : 0;
    if (!localEntry || rts > lts) {
      out[id] = remoteEntry;
    }
    // Égalité ts → keep local (stabilité)
  }
  return out;
}

/**
 * Retourne la map effective ARTISTS_SEED + overrides runtime.
 * Les overrides ont précédence sur le seed.
 * - override.value = Artist → override actif
 * - override.value = null → delete (l'entry du seed est masquée)
 * @returns {Object<string, import('../data/artists.js').Artist>}
 */
export function getEffectiveArtistsMap() {
  if (!_artistsRuntimeOverrides) return ARTISTS_SEED;
  const out = { ...ARTISTS_SEED };
  for (const [id, value] of Object.entries(_artistsRuntimeOverrides)) {
    if (value === null) {
      delete out[id];
    } else if (value && typeof value === 'object') {
      out[id] = value;
    }
  }
  return out;
}

/**
 * Reconstruit la map inverse band → [artistIds] à la volée si des
 * overrides sont posés. Sinon retourne le BAND_TO_ARTIST_IDS statique
 * (chemin chaud pour le cas no-override).
 * @returns {Object<string, string[]>}
 */
function _getEffectiveBandMap() {
  if (!_artistsRuntimeOverrides) return BAND_TO_ARTIST_IDS;
  const map = {};
  const eff = getEffectiveArtistsMap();
  for (const [id, artist] of Object.entries(eff)) {
    for (const band of artist.bands || []) {
      const key = band.toLowerCase().trim();
      if (!map[key]) map[key] = [];
      map[key].push(id);
    }
  }
  return map;
}

// ============================================================
// Normalisation
// ============================================================

/**
 * Normalise un nom d'artiste/groupe pour matching tolérant.
 * - lowercase
 * - strip accents
 * - strip ponctuation (. , ' " ! ?)
 * - strip whitespace multi → single
 * @param {string} s
 * @returns {string}
 */
export function normalizeArtistName(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // accents
    .replace(/[.,'"!?]/g, '')                          // ponctuation
    .replace(/\s+/g, ' ')                              // whitespace
    .trim();
}

// ============================================================
// Lookup primaire
// ============================================================

/**
 * Récupère un artiste par son id ou son nom (lookup tolérant).
 * @param {string} idOrName
 * @returns {(import('../data/artists.js').Artist & {id: string}) | null}
 */
export function getArtist(idOrName) {
  if (!idOrName || typeof idOrName !== 'string') return null;
  const eff = getEffectiveArtistsMap();

  // Lookup direct par id
  if (eff[idOrName]) {
    return { id: idOrName, ...eff[idOrName] };
  }

  // Lookup par nom normalisé
  const target = normalizeArtistName(idOrName);
  if (!target) return null;
  for (const [id, artist] of Object.entries(eff)) {
    if (normalizeArtistName(artist.name) === target) {
      return { id, ...artist };
    }
  }
  return null;
}

/**
 * Trouve tous les artistes d'un groupe (guitaristes + bassistes).
 * Lookup tolérant sur le nom du groupe.
 * @param {string} bandName
 * @returns {Array<import('../data/artists.js').Artist & {id: string}>}
 */
export function findArtistsByBand(bandName) {
  if (!bandName || typeof bandName !== 'string') return [];
  const target = normalizeArtistName(bandName);
  if (!target) return [];

  const bandMap = _getEffectiveBandMap();
  const ids = new Set();
  for (const [bandKey, artistIds] of Object.entries(bandMap)) {
    if (normalizeArtistName(bandKey) === target) {
      artistIds.forEach((id) => ids.add(id));
    }
  }

  const eff = getEffectiveArtistsMap();
  const out = [];
  for (const id of ids) {
    if (eff[id]) out.push({ id, ...eff[id] });
  }
  return out;
}

// ============================================================
// Eras
// ============================================================

/**
 * Récupère l'era qui couvre une année donnée pour un artiste.
 * Si plusieurs matches (chevauchement), retourne la plus récente.
 * @param {string|object} artistOrId
 * @param {number} year
 * @returns {import('../data/artists.js').ArtistEra | null}
 */
export function getEra(artistOrId, year) {
  if (typeof year !== 'number' || !Number.isFinite(year)) return null;
  const artist = typeof artistOrId === 'string' ? getArtist(artistOrId) : artistOrId;
  if (!artist || !Array.isArray(artist.eras)) return null;

  const matches = artist.eras.filter((e) => {
    if (!Array.isArray(e.years) || e.years.length < 2) return false;
    return year >= e.years[0] && year <= e.years[1];
  });

  if (matches.length === 0) return null;
  // Retourne la plus récente (latest start year)
  return matches.reduce((latest, e) => (e.years[0] > latest.years[0] ? e : latest));
}

/**
 * Récupère la dernière era ("active/now") d'un artiste.
 * @param {string|object} artistOrId
 * @returns {import('../data/artists.js').ArtistEra | null}
 */
export function getCurrentEra(artistOrId) {
  const artist = typeof artistOrId === 'string' ? getArtist(artistOrId) : artistOrId;
  if (!artist || !Array.isArray(artist.eras) || artist.eras.length === 0) return null;
  return artist.eras.reduce((latest, e) => {
    if (!latest || !Array.isArray(latest.years)) return e;
    if (!Array.isArray(e.years) || e.years.length < 2) return latest;
    return e.years[1] > latest.years[1] ? e : latest;
  }, artist.eras[0]);
}

// ============================================================
// Inférence usages depuis amp (cœur du gain Phase 13)
// ============================================================

/**
 * Normalise un nom d'amp pour matching tolérant catalog ↔ ARTISTS.
 * Pattern : strip "Marshall " / "Fender " prefix optionnel + lowercase + space normalize.
 * @param {string} amp
 * @returns {string}
 */
export function normalizeAmpName(amp) {
  if (!amp || typeof amp !== 'string') return '';
  return amp
    .toLowerCase()
    .replace(/[.,'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Vérifie si un amp catalog match un amp ARTISTS (substring tolérant).
 * Ex : "Marshall JCM800" catalog ↔ "Marshall JCM800 2203" ARTISTS → true.
 * @param {string} catalogAmp
 * @param {string} artistAmp
 * @returns {boolean}
 */
export function ampNamesMatch(catalogAmp, artistAmp) {
  const a = normalizeAmpName(catalogAmp);
  const b = normalizeAmpName(artistAmp);
  if (!a || !b) return false;
  if (a === b) return true;
  // Substring match dans les 2 sens (le plus court doit être dans le plus long)
  if (a.length < b.length) return b.includes(a);
  return a.includes(b);
}

/**
 * Pour un ampli catalog donné, scanne ARTISTS et retourne les artistes
 * qui l'ont utilisé (toutes eras confondues, avec score de confiance).
 *
 * Cœur du gain Phase 13 : ce helper permet d'auto-inférer les `usages`
 * de TOUTES les captures du catalog sans curation manuelle.
 *
 * @param {string} ampName - Nom de l'amp (catalog.entry.amp)
 * @returns {Array<{artistId, artistName, role, bands, eras: ArtistEra[], confidence}>}
 *   - eras : liste des eras où cet artiste a utilisé cet amp
 *   - confidence : 'high' (mono-ampli era) | 'medium' (multi-ampli era, boost dégressif)
 */
export function inferUsagesFromAmp(ampName) {
  if (!ampName || typeof ampName !== 'string') return [];

  const matches = [];
  const eff = getEffectiveArtistsMap();
  for (const [id, artist] of Object.entries(eff)) {
    const matchingEras = [];
    for (const era of artist.eras || []) {
      const eraMatch = (era.amps || []).some((a) => ampNamesMatch(ampName, a));
      if (eraMatch) matchingEras.push(era);
    }
    if (matchingEras.length === 0) continue;

    // Confidence : si TOUTES les matching eras de cet artiste ont un seul amp
    // (mono-ampli signature), confidence high. Sinon medium (Bonamassa-like).
    const allMono = matchingEras.every((e) => (e.amps || []).length === 1);
    matches.push({
      artistId: id,
      artistName: artist.name,
      role: artist.role,
      bands: artist.bands,
      eras: matchingEras,
      confidence: allMono ? 'high' : 'medium',
    });
  }

  return matches;
}

/**
 * Variante : retourne directement le format `usages: [{artist}]`
 * exploitable par le prompt fetchAI / scoring V9 / Phase 7.34.
 *
 * @param {string} ampName
 * @returns {Array<{artist: string, songs?: string[]}>}
 *   Format identique à entry.usages du catalog (Phase 7.52).
 */
export function inferUsagesArrayFromAmp(ampName) {
  const matches = inferUsagesFromAmp(ampName);
  // Un usage par BAND (pas par artiste), pour éviter "AC/DC" et "Cliff Williams"
  // dans la même liste. Le 1er band de chaque artiste suffit.
  const bandSet = new Set();
  for (const m of matches) {
    const primaryBand = (m.bands && m.bands.length > 0) ? m.bands[0] : null;
    if (primaryBand && primaryBand !== 'solo') bandSet.add(primaryBand);
    else if (m.artistName) bandSet.add(m.artistName);  // fallback solo artists
  }
  return Array.from(bandSet).map((artist) => ({ artist }));
}

// ============================================================
// Phase 13.1 — Post-process correctif ref_amp (anti-hallucination)
// ============================================================

/**
 * Pour un song.artist + song.year, retourne les amps candidats
 * historiquement utilisés par les guitaristes (ou multi) du groupe
 * pendant l'era couvrante (par year), ou current era si year absent.
 *
 * @param {string} songArtist - nom du groupe/band
 * @param {number|null} songYear - année du morceau (optionnel)
 * @returns {{amps: string[], primaryAmp: string|null, confidence: 'high'|'medium'|'low'} | null}
 */
export function getCandidateAmpsForBand(songArtist, songYear = null) {
  if (!songArtist) return null;
  // Filtrer sur guitaristes (et multi-instrument) — ref_amp est pour guitare.
  const artists = findArtistsByBand(songArtist).filter(
    (a) => a.role === 'guitarist' || a.role === 'multi'
  );
  if (artists.length === 0) return null;

  const allAmps = [];
  let monoAmpEra = false;
  let primaryAmp = null;

  for (const artist of artists) {
    // Si year fourni : era couvrante (precise). Sinon : UNION de TOUTES
    // les eras de l'artiste (tolérance maximale — évite de "corriger"
    // un amp utilisé dans une autre era que current).
    const erasToScan = (typeof songYear === 'number' && Number.isFinite(songYear))
      ? [getEra(artist, songYear) || getCurrentEra(artist)].filter(Boolean)
      : (artist.eras || []);
    for (const era of erasToScan) {
      if (!era || !Array.isArray(era.amps)) continue;
      if (!primaryAmp && era.amps.length > 0) primaryAmp = era.amps[0];
      if (era.amps.length === 1) monoAmpEra = true;
      for (const a of era.amps) {
        if (!allAmps.includes(a)) allAmps.push(a);
      }
    }
  }

  if (allAmps.length === 0) return null;

  // Confidence tiering :
  //   high   : un artiste a une era mono-amp (signature claire ex Brian May AC30)
  //            ET total ≤ 2 amps (peu d'ambiguïté)
  //   medium : 3-4 amps disponibles (ambigu mais primaryAmp informatif)
  //   low    : 5+ amps (Bonamassa-like, trop ambigu pour corriger)
  let confidence;
  if (monoAmpEra && allAmps.length <= 2) confidence = 'high';
  else if (allAmps.length <= 4) confidence = 'medium';
  else confidence = 'low';

  return { amps: allAmps, primaryAmp, confidence };
}

/**
 * Wrapper simple pour Phase 13.2 (boost amp family match) qui prend
 * directement un objet song au lieu de (artist, year). Retourne les
 * amps candidats historiques d'un morceau donné.
 *
 * @param {{artist?: string, year?: number}|null} song
 * @returns {ReturnType<getCandidateAmpsForBand> | null}
 */
export function getArtistAmpsForSong(song) {
  if (!song?.artist) return null;
  const year = (typeof song.year === 'number' && Number.isFinite(song.year))
    ? song.year
    : null;
  return getCandidateAmpsForBand(song.artist, year);
}

/**
 * Vérifie si un ref_amp (typiquement retourné par l'IA Gemini) est
 * plausible historiquement pour un song.artist + song.year donnés.
 *
 * Cas-cible : Bruno + Blink-182 → Gemini hallucine "Marshall Super100"
 * alors que le setup signature Blink-182 = Mesa Boogie. Si Blink-182
 * était dans ARTISTS, ce helper détecterait la divergence et suggérerait
 * "Mesa Boogie Triple Rectifier" (primaryAmp era 90s+).
 *
 * Retour :
 *   - null : pas d'info ARTISTS pour ce groupe (no-op, on garde IA)
 *   - { valid: true }  : ref_amp matche le setup historique
 *   - { valid: false, suggestedAmp } : hallucination détectée, suggestion
 *     de correction (sauf si confidence basse → suggestedAmp = null)
 *
 * @param {string} refAmp - amp retourné par l'IA
 * @param {string} songArtist - nom du groupe
 * @param {number|null} songYear - année du morceau (optionnel)
 * @returns {{valid: boolean, suggestedAmp: string|null, reason: string, confidence: 'high'|'medium'|'low'} | null}
 */
export function validateRefAmpAgainstArtists(refAmp, songArtist, songYear = null) {
  if (!refAmp || typeof refAmp !== 'string') return null;
  const candidate = getCandidateAmpsForBand(songArtist, songYear);
  if (!candidate) return null; // pas d'info → no-op

  const isMatch = candidate.amps.some((a) => ampNamesMatch(refAmp, a));

  if (isMatch) {
    return {
      valid: true,
      suggestedAmp: null,
      reason: 'matches historical setup',
      confidence: candidate.confidence,
    };
  }

  // Hallucination détectée : refAmp ne match aucun amp historique.
  // - Confidence high/medium : on suggère primaryAmp.
  // - Confidence low : trop ambigu (Bonamassa), on flag mais ne corrige pas.
  return {
    valid: false,
    suggestedAmp: candidate.confidence === 'low' ? null : candidate.primaryAmp,
    reason: candidate.confidence === 'low'
      ? `no historical match but artist has ${candidate.amps.length} candidate amps, too ambiguous to correct`
      : `no historical match for "${songArtist}", primary amp from ARTISTS: "${candidate.primaryAmp}"`,
    confidence: candidate.confidence,
  };
}
