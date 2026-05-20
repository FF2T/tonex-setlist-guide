// src/core/scoring/compat-buckets.js — Phase 7.83 (2026-05-20).
//
// Bucketise un score de compatibilité 0-100 en 3 niveaux qualitatifs
// pour l'affichage. Évite de présenter des scores bruts (84%, 64%,
// 52%, 49%…) qui suggèrent une précision que le scoring V9
// heuristique n'a pas, et qui ne disent pas au visiteur quoi faire
// d'un "64%".
//
// 3 niveaux musicaux :
// - 🟢 Mariage parfait (≥ 75) : la guitare/pickup matche idéalement
//   l'ampli, le style et le gain. Choix évident.
// - 🟡 Bon match (≥ 55) : compromis acceptable, le son sera juste
//   sans être optimal.
// - 🟠 Compromis (< 55) : la guitare/pickup n'est pas faite pour
//   ça, mais ça peut dépanner.
//
// Pas de bump SCORING_VERSION — c'est une couche d'affichage qui
// bucketise les scores existants V9. Le scoring brut reste inchangé.
//
// Phase 7.69.13 (presets custom editor) avait introduit 4 niveaux ;
// Phase 7.83 aligne tout le projet sur 3 niveaux pour cohérence.

// Niveaux exposés en constants pour réutilisation cross-modules.
const COMPAT_LEVELS = {
  ideal: { id: 'ideal', emoji: '🟢', threshold: 75, color: 'var(--green)', bgColor: 'rgba(74,222,128,0.15)', borderColor: 'rgba(74,222,128,0.4)' },
  good: { id: 'good', emoji: '🟡', threshold: 55, color: 'var(--yellow)', bgColor: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.4)' },
  compromise: { id: 'compromise', emoji: '🟠', threshold: 0, color: '#fb923c', bgColor: 'rgba(251,146,60,0.15)', borderColor: 'rgba(251,146,60,0.4)' },
};

// Retourne le bucket level pour un score donné.
// - score : number 0-100 (ou null/undefined/NaN → 'compromise' par défaut)
// - retour : { id, emoji, threshold, color, bgColor, borderColor }
function bucketizeScore(score) {
  // Defensive : null/undefined/NaN/non-number → fallback 'compromise'
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return COMPAT_LEVELS.compromise;
  }
  if (score >= COMPAT_LEVELS.ideal.threshold) return COMPAT_LEVELS.ideal;
  if (score >= COMPAT_LEVELS.good.threshold) return COMPAT_LEVELS.good;
  return COMPAT_LEVELS.compromise;
}

// Group une liste d'items {score, ...rest} par bucket.
// Retourne { ideal: [...], good: [...], compromise: [...] } en
// préservant l'ordre relatif d'origine au sein de chaque groupe.
function groupByBucket(items) {
  const out = { ideal: [], good: [], compromise: [] };
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    const bucket = bucketizeScore(item?.score);
    out[bucket.id].push(item);
  }
  return out;
}

export { COMPAT_LEVELS, bucketizeScore, groupByBucket };
