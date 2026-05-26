// src/core/date-utils.js — Phase 7.55.7 dette UX (2026-05-26).
//
// Format court FR JJMMAA pour les noms de fichiers d'export (CSV, JSON).
// Préférence Sébastien vs format ISO YYYY-MM-DD : meilleur tri
// chronologique côté Mac Finder + plus compact dans les listings.

export function formatDateJJMMAA(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aa = String(d.getFullYear()).slice(2);
  return `${dd}${mm}${aa}`;
}
