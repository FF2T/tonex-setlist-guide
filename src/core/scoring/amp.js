// src/core/scoring/amp.js — extrait verbatim depuis main.jsx.
// computeRefAmpScore : matche le nom d'amp d'un preset contre l'amp
// référence du morceau, avec normalisation et fallback via AMP_TAXONOMY
// (famille → marque → école).

import { AMP_TAXONOMY } from '../../data/data_context.js';

function computeRefAmpScore(presetAmp,songRefAmp){
  if(!songRefAmp||!presetAmp) return null;
  if(presetAmp===songRefAmp) return 100;
  // Normalize: strip common suffixes (bass, 100w, mkI, combo, head, etc.)
  var normalize=function(s){return s.toLowerCase().replace(/\b(bass|head|combo|cab|cabinet|\d+w|\d+watt|mk\s*[iv]+|mk\s*\d+|super|100|50|20|amp)\b/g,"").replace(/\s+/g," ").trim();};
  var pNorm=normalize(presetAmp),sNorm=normalize(songRefAmp);
  if(pNorm===sNorm) return 100;
  if(pNorm.includes(sNorm)||sNorm.includes(pNorm)) return 95;
  // AMP_TAXONOMY lookup
  var preset=AMP_TAXONOMY[presetAmp];
  var song=AMP_TAXONOMY[songRefAmp];
  if(!preset){for(var k in AMP_TAXONOMY){if(normalize(k)===pNorm||k.toLowerCase().includes(pNorm)||pNorm.includes(k.toLowerCase())){preset=AMP_TAXONOMY[k];break;}}}
  if(!song){for(var k2 in AMP_TAXONOMY){if(normalize(k2)===sNorm||k2.toLowerCase().includes(sNorm)||sNorm.includes(k2.toLowerCase())){song=AMP_TAXONOMY[k2];break;}}}
  if(!preset||!song) return 25;
  if(preset.family===song.family) return 85;
  if(preset.brand===song.brand) return 50;
  if(preset.school===song.school) return 40;
  return 10;
}

export { computeRefAmpScore };
