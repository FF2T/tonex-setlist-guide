// src/core/scoring/pickup.js — extrait verbatim depuis main.jsx.
// BASE_SCORES : matrice 6 styles × 4 gains × 3 pickups (60 cellules).
// computePickupScore : score pur, fallback à 60 si style/pickup inconnu,
// fallback à crunch[pickup] si gain inconnu.

// Matrice de base : 5 styles × 4 gains × 3 pickups (60 cellules)
const BASE_SCORES={
  blues:{
    clean:    {HB:78,SC:92,P90:88},
    crunch:   {HB:82,SC:88,P90:90},
    drive:    {HB:85,SC:78,P90:85},
    high_gain:{HB:70,SC:60,P90:68}
  },
  rock:{
    clean:    {HB:75,SC:80,P90:78},
    crunch:   {HB:85,SC:80,P90:84},
    drive:    {HB:88,SC:75,P90:82},
    high_gain:{HB:82,SC:64,P90:72}
  },
  hard_rock:{
    clean:    {HB:70,SC:72,P90:68},
    crunch:   {HB:85,SC:72,P90:78},
    drive:    {HB:90,SC:70,P90:78},
    high_gain:{HB:92,SC:60,P90:72}
  },
  jazz:{
    clean:    {HB:68,SC:92,P90:86},
    crunch:   {HB:62,SC:85,P90:80},
    drive:    {HB:50,SC:60,P90:58},
    high_gain:{HB:35,SC:40,P90:38}
  },
  metal:{
    clean:    {HB:60,SC:65,P90:58},
    crunch:   {HB:78,SC:58,P90:68},
    drive:    {HB:88,SC:55,P90:70},
    high_gain:{HB:95,SC:50,P90:65}
  },
  pop:{
    clean:    {HB:72,SC:90,P90:82},
    crunch:   {HB:75,SC:85,P90:80},
    drive:    {HB:70,SC:68,P90:72},
    high_gain:{HB:55,SC:50,P90:52}
  }
};

function computePickupScore(presetStyle,presetGainRange,pickupType){
  const styleScores=BASE_SCORES[presetStyle];
  if(!styleScores) return 60;
  const gainScores=styleScores[presetGainRange];
  if(!gainScores) return styleScores.crunch?.[pickupType]??60;
  return gainScores[pickupType]??60;
}

export { BASE_SCORES, computePickupScore };
