// src/devices/tonemaster-pro/scoring.js — Phase 3.
// Recommandation de patch TMP pour un morceau + guitare donnés.
//
// Pondération (cf CLAUDE.md "Pondération du scoring TMP") :
//   amp model              : 0.45
//   cab/IR                 : 0.20
//   drive                  : 0.15
//   fx (mod/delay/reverb)  : 0.05
//   style match            : 0.10
//   pickup affinity        : 0.05
//
// Total = 1.00. Score retourné en 0-100 entier.

import { computeRefAmpScore } from '../../core/scoring/amp.js';
import { computeStyleMatchScore } from '../../core/scoring/style.js';

const WEIGHTS = {
  amp: 0.45,
  cab: 0.20,
  drive: 0.15,
  fx: 0.05,
  style: 0.10,
  pickup: 0.05,
};

// ─── Helpers de scoring par dimension ────────────────────────────────

// Match amp : la whitelist TMP utilise des noms génériques ("British
// Plexi", "Fender '59 Bassman") qui ne matchent pas l'AMP_TAXONOMY
// hérité (qui utilise les noms de marque "Marshall Plexi"). On combine
// donc le legacy `computeRefAmpScore` (cas où le nom matche directement
// la taxonomy) avec un fallback de matching par tokens partagés (mots
// significatifs comme "Plexi", "Bassman", "Twin").
function scoreAmp(patchAmp, refAmp) {
  if (!patchAmp?.model) return 0;
  if (!refAmp) return 50;
  const legacy = computeRefAmpScore(patchAmp.model, refAmp);
  if (legacy != null && legacy >= 50) return legacy;
  const tokens = (s) => s.toLowerCase().split(/[\s'\-]+/)
    .filter((t) => t.length >= 3 && !['the', 'and'].includes(t));
  const a = new Set(tokens(patchAmp.model));
  const b = new Set(tokens(refAmp));
  const overlap = [...a].filter((t) => b.has(t));
  if (overlap.length === 0) return legacy != null ? legacy : 25;
  // Mots-clés de model d'amp distinctifs (présence indique un match fort).
  const keyTerms = ['plexi', 'bassman', 'twin', 'jcm', 'jcm800', '800',
    'jubilee', 'princeton', 'deluxe', 'rectifier', '5150', 'soldano',
    'slo', 'vox', 'ac30', 'jc', 'mark', 'rockerverb', 'tangerine',
    'blues', 'vibro', 'breaker', 'super', 'reverb', 'evh', 'orange'];
  const hasKey = overlap.some((t) => keyTerms.includes(t));
  return hasKey ? 90 : 65;
}

// Match cab : le cab est cohérent avec son amp si ça matche par famille
// (4x12 Greenback ↔ Plexi/JCM800, 2x12 Twin ↔ Twin Reverb, 4x10 Bassman
// ↔ Bassman, etc.). Heuristique simple sur sous-chaînes.
function scoreCab(patchCab, patchAmp) {
  if (!patchCab?.model) return 0;
  if (!patchAmp?.model) return 50;
  const cab = patchCab.model.toLowerCase();
  const amp = patchAmp.model.toLowerCase();
  // Match exact par mot-clé partagé
  const ampKeywords = ['plexi', 'jcm', '800', 'jubilee', 'breaker', 'bassman',
    'twin', 'deluxe', 'princeton', 'super', 'blues junior', 'vibro',
    'ac30', 'jc', 'mark', 'soldano', 'orange', 'rectifier', '5150', 'evh'];
  for (const kw of ampKeywords) {
    if (amp.includes(kw) && cab.includes(kw)) return 100;
  }
  // Match approximatif par marque
  const ampBrand = amp.includes('fender') || amp.includes("'5") || amp.includes("'6")
    ? 'fender'
    : amp.includes('british') || amp.includes('brit') || amp.includes('jubilee')
    ? 'marshall' : null;
  const cabBrand = cab.includes('fender') || cab.includes('twin') || cab.includes('deluxe') || cab.includes('bassman') || cab.includes("'5") || cab.includes("'6") || cab.includes('princeton')
    ? 'fender'
    : cab.includes('british') || cab.includes('brit') ? 'marshall' : null;
  if (ampBrand && cabBrand && ampBrand === cabBrand) return 75;
  return 40;
}

// Match drive : plus le patch a du gain (mid/high), plus la présence
// d'un drive est attendue. Si gain=low, drive optionnel (penalty mineure
// si présent). Si gain=high sans drive, on s'attend à ce que l'amp seul
// suffise — pas de penalty.
function scoreDrive(patchDrive, patchGain) {
  if (patchGain === 'low') {
    // Idéal : pas de drive ou drive très léger.
    return patchDrive ? 60 : 90;
  }
  if (patchGain === 'mid') {
    return patchDrive ? 95 : 70;
  }
  // high : drive aide mais pas obligatoire (l'amp peut saturer seul).
  return patchDrive ? 85 : 75;
}

// Match fx : bonus si le patch a une chaîne FX cohérente avec les
// effets historiques du morceau. Pour Phase 3 v1 : simple score
// proportionnel à la richesse de la chaîne FX (mod + delay + reverb).
function scoreFx(patch, refEffects) {
  let count = 0;
  if (patch.mod) count++;
  if (patch.delay) count++;
  if (patch.reverb) count++;
  // Match basé sur présence (1-3 blocs FX présents).
  const presence = (count / 3) * 100;
  // Si refEffects mentionne explicitement des effets connus, bonus.
  if (refEffects && typeof refEffects === 'string') {
    const ref = refEffects.toLowerCase();
    if (ref === 'aucun effet' || ref.includes('aucun effet')) {
      // Le morceau n'a pas d'effets historiques → patch sobre préféré.
      return count === 0 ? 100 : Math.max(50, 100 - count * 15);
    }
    let bonus = 0;
    if (patch.delay && (ref.includes('delay') || ref.includes('echo'))) bonus += 20;
    if (patch.reverb && (ref.includes('reverb') || ref.includes('réverb'))) bonus += 15;
    if (patch.mod && (ref.includes('chorus') || ref.includes('phaser') || ref.includes('flanger') || ref.includes('vibe'))) bonus += 25;
    return Math.min(100, presence + bonus);
  }
  return presence;
}

// Match style : utilise STYLE_COMPATIBILITY de core/scoring/style.js
// (matrice 6×6). Si pas de song style, neutre 50.
function scoreStyle(patchStyle, songStyle) {
  if (!songStyle) return 50;
  const s = computeStyleMatchScore(patchStyle, songStyle);
  return s == null ? 50 : s;
}

// Match pickup : direct depuis pickupAffinity[guitar.type] (0-100).
// Si pas de guitar, on prend le max pickup (favorise les patches
// polyvalents).
function scorePickup(pickupAffinity, guitar) {
  if (!pickupAffinity) return 50;
  if (!guitar?.type) return Math.max(...Object.values(pickupAffinity));
  const v = pickupAffinity[guitar.type];
  return typeof v === 'number' ? v : 50;
}

// Bonus "usages explicite" : si le patch déclare dans patch.usages que
// l'artiste OU un morceau précis correspond, on applique un bonus
// additif de 25 (clampé à 100). Le bonus est ADDITIF au score pondéré
// pour respecter strictement la pondération CLAUDE.md (somme = 1.00) ;
// il représente une connaissance explicite "ce patch est conçu pour
// ce morceau" qui ne se déduit pas des dimensions analytiques.
function usagesBonus(patch, song) {
  if (!patch.usages || !song) return 0;
  const songTitle = (song.title || '').toLowerCase();
  const songArtist = (song.artist || '').toLowerCase();
  for (const u of patch.usages) {
    const uArtist = (u.artist || '').toLowerCase();
    if (uArtist && songArtist && (uArtist === songArtist || uArtist.includes(songArtist) || songArtist.includes(uArtist))) {
      // Match artiste : bonus 15. Match exact morceau : bonus 25 (cumul).
      const songMatch = Array.isArray(u.songs) && u.songs.some(
        (s) => s.toLowerCase() === songTitle || s.toLowerCase().includes(songTitle) || songTitle.includes(s.toLowerCase()),
      );
      return songMatch ? 25 : 15;
    }
  }
  return 0;
}

// ─── recommendTMPPatch ──────────────────────────────────────────────

function recommendTMPPatch(patches, song, guitar, _profile) {
  if (!Array.isArray(patches) || patches.length === 0) return [];
  const aiC = song?.aiCache?.result;
  // Si pas d'aiCache, on retourne quand même un classement basé sur
  // pickup + style (les seules dimensions évaluables sans contexte AI).
  const refAmp = aiC?.ref_amp || null;
  const refEffects = aiC?.ref_effects || null;
  const songStyle = aiC?.song_style || null;

  const scored = patches.map((patch) => {
    const breakdown = {
      amp: scoreAmp(patch.amp, refAmp),
      cab: scoreCab(patch.cab, patch.amp),
      drive: scoreDrive(patch.drive, patch.gain),
      fx: scoreFx(patch, refEffects),
      style: scoreStyle(patch.style, songStyle),
      pickup: scorePickup(patch.pickupAffinity, guitar),
    };
    const weighted =
      breakdown.amp * WEIGHTS.amp +
      breakdown.cab * WEIGHTS.cab +
      breakdown.drive * WEIGHTS.drive +
      breakdown.fx * WEIGHTS.fx +
      breakdown.style * WEIGHTS.style +
      breakdown.pickup * WEIGHTS.pickup;
    const bonus = usagesBonus(patch, song);
    const final = Math.min(100, Math.round(weighted) + bonus);
    return { patch, score: final, breakdown, usagesBonus: bonus };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export {
  WEIGHTS,
  scoreAmp, scoreCab, scoreDrive, scoreFx, scoreStyle, scorePickup,
  usagesBonus, recommendTMPPatch,
};
