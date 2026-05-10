// src/core/scoring/index.js — façade scoring V2.
// Expose SCORING_VERSION, SCORING_WEIGHTS, computeGainMatchScore,
// computeFinalScore (l'agrégateur 5 dimensions avec redistribution
// des poids quand certaines dimensions sont null), et réexporte
// les helpers des sous-fichiers pour les consommateurs (main.jsx,
// futurs devices, tests).

import { findGuitar } from '../guitars.js';
import { findCatalogEntry } from '../catalog.js';
import { computePickupScore, BASE_SCORES } from './pickup.js';
import {
  GUITAR_PROFILES, inferGuitarProfile, findGuitarProfile,
  computeGuitarScoreV2, matchGuitarName, findGuitarByAIName,
  findCotEntryForGuitar, localGuitarSongScore, pickTopGuitar,
  guitarChoiceFeedback, localGuitarSettings,
} from './guitar.js';
import {
  GAIN_RANGES, getGainRange, gainToNumeric, inferGainFromName,
  STYLE_COMPATIBILITY, computeStyleMatchScore,
} from './style.js';
import { computeRefAmpScore } from './amp.js';

// Pondérations des 5 dimensions
const SCORING_VERSION=9; // v9: inferGuitarProfile for custom guitars
const SCORING_WEIGHTS={
  pickup:    0.20,
  guitar:    0.10,
  gainMatch: 0.15,
  refAmp:    0.30,
  styleMatch:0.25
};

function computeGainMatchScore(presetGain,songTargetGain){
  if(songTargetGain==null) return null;
  const diff=Math.abs(presetGain-songTargetGain);
  return Math.max(0,100-diff*12);
}

function computeFinalScore(preset,guitarId,songStyle,songTargetGain,songRefAmp,_returnBreakdown){
  const presetGain=typeof preset.gain==="number"?preset.gain:gainToNumeric(preset.gain);
  const presetGainRange=getGainRange(presetGain);
  const pickupType=findGuitarProfile(guitarId)?.pickupType||findGuitar(guitarId)?.type||"HB";
  // Always use BASE_SCORES matrix for consistent scoring (ignore inflated static catalog scores)
  const pickupScore=computePickupScore(preset.style,presetGainRange,pickupType);
  const guitarScore2=computeGuitarScoreV2(guitarId,preset.style,presetGainRange,preset.voicing);
  const gainMatchScore=computeGainMatchScore(presetGain,songTargetGain);
  const refAmpScore=computeRefAmpScore(preset.amp,songRefAmp);
  const styleScore=computeStyleMatchScore(preset.style,songStyle);
  // Build active dimensions, redistribute weights when some are null
  const dims=[
    {key:"pickup",score:pickupScore,weight:SCORING_WEIGHTS.pickup},
    {key:"guitar",score:guitarScore2,weight:SCORING_WEIGHTS.guitar},
    {key:"gainMatch",score:gainMatchScore,weight:SCORING_WEIGHTS.gainMatch},
    {key:"refAmp",score:refAmpScore,weight:SCORING_WEIGHTS.refAmp},
    {key:"styleMatch",score:styleScore,weight:SCORING_WEIGHTS.styleMatch}
  ];
  const active=dims.filter(d=>d.score!==null);
  const totalWeight=active.reduce((s,d)=>s+d.weight,0);
  let final=0;
  const breakdown={};
  for(const d of active){
    const ew=d.weight/totalWeight;
    const contrib=ew*d.score;
    final+=contrib;
    breakdown[d.key]={raw:d.score,weight:Math.round(ew*100),contribution:Math.round(contrib)};
  }
  for(const d of dims){if(d.score===null)breakdown[d.key]={raw:null,weight:0,contribution:0};}
  const result=Math.max(0,Math.min(100,Math.round(final)));
  const rawResult=Math.max(0,Math.min(100,final));
  if(_returnBreakdown) return {score:result,rawScore:rawResult,breakdown};
  return result;
}

// Score simplifié sans contexte morceau (pour affichage liste, worstSlot, etc.)
function computeSimpleScore(presetName,guitarId,gType){
  const entry=findCatalogEntry(presetName);
  if(!entry) return 60;
  if(!guitarId){return entry.scores?.[gType]??60;}
  const gp=findGuitarProfile(guitarId);
  if(!gp){const gt=findGuitar(guitarId)?.type||gType||"HB";return entry.scores?.[gt]??60;}
  const presetGain=gainToNumeric(entry.gain);
  const presetGainRange=getGainRange(presetGain);
  const pickupScore=entry.scores?.[gp.pickupType]??60;
  const guitarScore2=computeGuitarScoreV2(guitarId,entry.style,presetGainRange,entry.voicing);
  // Sans contexte morceau : pickup 60% + guitar 40%
  return Math.max(30,Math.min(99,Math.round(pickupScore*0.6+guitarScore2*0.4)));
}

export {
  SCORING_VERSION, SCORING_WEIGHTS,
  computeGainMatchScore, computeFinalScore, computeSimpleScore,
  // re-exports
  BASE_SCORES, computePickupScore,
  GUITAR_PROFILES, inferGuitarProfile, findGuitarProfile,
  computeGuitarScoreV2, matchGuitarName, findGuitarByAIName,
  findCotEntryForGuitar, localGuitarSongScore, pickTopGuitar,
  guitarChoiceFeedback, localGuitarSettings,
  GAIN_RANGES, getGainRange, gainToNumeric, inferGainFromName,
  STYLE_COMPATIBILITY, computeStyleMatchScore,
  computeRefAmpScore,
};
