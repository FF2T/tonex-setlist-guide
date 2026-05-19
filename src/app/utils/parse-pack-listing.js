// src/app/utils/parse-pack-listing.js — Phase 7.69.7
//
// Parser tolérant pour transformer un listing de fichiers .txp (collé
// depuis le terminal) en liste de noms de presets prêts à devenir un
// custom pack dans profile.customPacks.
//
// Formats acceptés :
//   1. unzip -l <pack>.zip (output complet avec header "Archive:")
//   2. ls *.txp ou find . -name "*.txp" (lignes simples)
//   3. Liste brute (un nom par ligne, avec ou sans .txp)
//
// Sortie : { archiveName: string|null, presets: string[] }
//   - archiveName : extrait depuis "Archive:" si format unzip, sinon null
//   - presets : noms uniques (path strippé, extension .txp retirée)

/**
 * Tente d'extraire le nom du fichier d'une ligne `unzip -l`.
 * Format typique : "   123456  2024-01-15 14:32   path/to/file.txp"
 * Retourne null si la ligne ne matche pas le format unzip.
 */
function extractFromUnzipLine(line) {
  // Pattern: <whitespace><digits size><whitespace><date><whitespace><time HH:MM><whitespace><filename>
  // Date format flexible (2024-01-15 ou 01-15-2024 ou similaire)
  const m = line.match(/^\s*\d+\s+\S+\s+\d{1,2}:\d{2}\s+(.+)$/);
  if (!m) return null;
  return m[1].trim();
}

/**
 * Retourne true si la ligne est un artefact d'un listing (header,
 * séparateur, total, etc.) qu'on doit ignorer.
 */
function isListingArtifact(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^Archive:/i.test(trimmed)) return true;
  if (/^\s*Length\s+Date\s+Time\s+Name/i.test(line)) return true;
  if (/^-{3,}/.test(trimmed)) return true;
  if (/^\d+\s+files?(?:\s|$)/i.test(trimmed)) return true;
  if (/^\s*\d[\d\s]*\s+\d+\s+files?$/i.test(line)) return true;
  if (/^total\s+\d+$/i.test(trimmed)) return true;
  return false;
}

/**
 * Parse un listing texte et retourne archiveName + presets.
 *
 * @param {string} text - le listing collé par le user
 * @returns {{archiveName: string|null, presets: string[]}}
 */
export function parsePackListing(text) {
  if (!text || typeof text !== 'string') return { archiveName: null, presets: [] };
  const lines = text.split(/\r?\n/);

  // Détection nom d'archive (format unzip).
  let archiveName = null;
  const archiveMatch = text.match(/^\s*Archive:\s+(.+)$/m);
  if (archiveMatch) {
    archiveName = archiveMatch[1]
      .trim()
      .replace(/\.zip$/i, '')
      .replace(/^.*\//, ''); // strip path
  }

  const presets = [];
  const seen = new Set();

  for (const line of lines) {
    if (isListingArtifact(line)) continue;

    // Format unzip d'abord (lignes avec date+time)
    let raw = extractFromUnzipLine(line);
    if (raw === null) {
      // Fallback : ligne brute
      raw = line.trim();
    }
    if (!raw) continue;

    // On ne garde que les lignes qui ressemblent à un nom de fichier .txp,
    // OU une ligne propre (sans header artifact) qui pourrait être un nom
    // brut. Détection :
    //   - extension .txp explicite → garder
    //   - sinon : garder uniquement si la ligne ne contient pas de
    //     caractères suspects (slash, tab, plusieurs espaces consécutifs)
    let isTxp = /\.txp$/i.test(raw);
    if (!isTxp) {
      // Liste brute : si la ligne contient encore des données de listing
      // (tabs, multi-espaces), skip.
      if (/\t/.test(raw)) continue;
      // Ligne brute simple : on accepte (le user a collé une liste de noms)
    }

    // Strip path
    let name = raw.replace(/^.*\//, '');
    // Strip .txp extension
    name = name.replace(/\.txp$/i, '').trim();
    if (!name) continue;

    if (seen.has(name)) continue;
    seen.add(name);
    presets.push(name);
  }

  return { archiveName, presets };
}
