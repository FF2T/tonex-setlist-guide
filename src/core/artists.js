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

  // Lookup direct par id
  if (ARTISTS_SEED[idOrName]) {
    return { id: idOrName, ...ARTISTS_SEED[idOrName] };
  }

  // Lookup par nom normalisé
  const target = normalizeArtistName(idOrName);
  if (!target) return null;
  for (const [id, artist] of Object.entries(ARTISTS_SEED)) {
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

  const ids = new Set();
  for (const [bandKey, artistIds] of Object.entries(BAND_TO_ARTIST_IDS)) {
    if (normalizeArtistName(bandKey) === target) {
      artistIds.forEach((id) => ids.add(id));
    }
  }

  const out = [];
  for (const id of ids) {
    if (ARTISTS_SEED[id]) out.push({ id, ...ARTISTS_SEED[id] });
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
function normalizeAmpName(amp) {
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
function ampNamesMatch(catalogAmp, artistAmp) {
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
  for (const [id, artist] of Object.entries(ARTISTS_SEED)) {
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
