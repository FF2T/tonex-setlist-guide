// src/core/scoring/guitar.js — extrait verbatim depuis main.jsx.
// GUITAR_PROFILES (11 modèles), inferGuitarProfile (heuristique pour
// guitares custom non listées), findGuitarProfile (façade), et le
// score guitare à 4 modificateurs (style + gain + voicing + résonance).
// Aussi : matchers de noms guitare (utilisés par l'UI) et helpers
// pour les retours utilisateur (settings + feedback).

import { findGuitar } from '../guitars.js';
import { getGainRange } from './style.js';

const GUITAR_PROFILES={
  lp60:{
    pickupType:"HB",voicing:"warm",bodyResonance:"solid",
    gainAffinity:{clean:-1,crunch:+3,drive:+4,high_gain:+2},
    styleMods:{blues:+3,rock:+4,hard_rock:+5,jazz:-2,pop:0,metal:+1},
    desc:"Polyvalente, référence HB, sustain long"
  },
  lp50p90:{
    pickupType:"P90",voicing:"balanced",bodyResonance:"solid",
    gainAffinity:{clean:+1,crunch:+3,drive:+2,high_gain:-2},
    styleMods:{blues:+5,rock:+3,hard_rock:+1,jazz:+2,pop:+1,metal:-3},
    desc:"P90 gras et mordant, midrange caractéristique"
  },
  sg_ebony:{
    pickupType:"HB",voicing:"bright",bodyResonance:"solid",
    gainAffinity:{clean:-2,crunch:+2,drive:+5,high_gain:+4},
    styleMods:{blues:+1,rock:+4,hard_rock:+6,jazz:-4,pop:-1,metal:+3},
    desc:"Médiums agressifs, attaque rapide, léger"
  },
  sg61:{
    pickupType:"HB",voicing:"balanced",bodyResonance:"solid",
    gainAffinity:{clean:0,crunch:+3,drive:+4,high_gain:+2},
    styleMods:{blues:+2,rock:+4,hard_rock:+5,jazz:-2,pop:0,metal:+2},
    desc:"Vintage 60s, crunch classique rock"
  },
  strat61:{
    pickupType:"SC",voicing:"bright",bodyResonance:"solid",
    gainAffinity:{clean:+4,crunch:+2,drive:0,high_gain:-4},
    styleMods:{blues:+5,rock:+3,hard_rock:-1,jazz:+3,pop:+2,metal:-6},
    desc:"Vintage 61, cleans cristallins, quack positions 2/4"
  },
  strat_pro2:{
    pickupType:"SC",voicing:"balanced",bodyResonance:"solid",
    gainAffinity:{clean:+3,crunch:+3,drive:+1,high_gain:-3},
    styleMods:{blues:+4,rock:+3,hard_rock:-1,jazz:+3,pop:+3,metal:-5},
    desc:"Moderne, V-Mod II, polyvalente tous styles"
  },
  strat_ec:{
    pickupType:"SC",voicing:"warm",bodyResonance:"solid",
    gainAffinity:{clean:+3,crunch:+4,drive:+1,high_gain:-3},
    styleMods:{blues:+6,rock:+3,hard_rock:-1,jazz:+2,pop:+1,metal:-5},
    desc:"Noiseless, midboost, son Clapton smooth"
  },
  tele63:{
    pickupType:"SC",voicing:"bright",bodyResonance:"solid",
    gainAffinity:{clean:+4,crunch:+2,drive:0,high_gain:-4},
    styleMods:{blues:+3,rock:+3,hard_rock:-1,jazz:+2,pop:+2,metal:-6},
    desc:"Twang vintage, attaque percussive, bridge bright"
  },
  tele_ultra:{
    pickupType:"SC",voicing:"balanced",bodyResonance:"solid",
    gainAffinity:{clean:+3,crunch:+3,drive:+1,high_gain:-3},
    styleMods:{blues:+3,rock:+4,hard_rock:0,jazz:+2,pop:+3,metal:-4},
    desc:"Noiseless moderne, S1 switch, très polyvalente"
  },
  jazzmaster:{
    pickupType:"SC",voicing:"warm",bodyResonance:"solid",
    gainAffinity:{clean:+4,crunch:+1,drive:-1,high_gain:-4},
    styleMods:{blues:+4,rock:+2,hard_rock:-2,jazz:+6,pop:+3,metal:-6},
    desc:"Single coil large, son chaud et rond, peu de twang"
  },
  es335:{
    pickupType:"HB",voicing:"warm",bodyResonance:"semi_hollow",
    gainAffinity:{clean:+3,crunch:+3,drive:+1,high_gain:-4},
    styleMods:{blues:+5,rock:+2,hard_rock:-2,jazz:+6,pop:+2,metal:-6},
    desc:"Semi-hollow, chaleur et résonance, idéale jazz/blues"
  }
};

function inferGuitarProfile(name,type){
  if(!name) return null;
  var n=name.toLowerCase();
  var t=type||"HB";
  if(/\btele(caster)?\b/.test(n)){
    var is51=/\b5[01]\b|\besquire\b|\bnocaster\b|\bbroad/.test(n);
    return {pickupType:t,voicing:"bright",bodyResonance:"solid",
      gainAffinity:{clean:is51?+3:+4,crunch:+2,drive:is51?0:-1,high_gain:-4},
      styleMods:{blues:+3,rock:+4,hard_rock:is51?0:-1,jazz:+1,pop:+2,metal:-6},
      desc:is51?"Tele 51, frêne, SC bridge, twang brut vintage":"Telecaster, twang, attaque percussive"};
  }
  if(/\bstrat(ocaster)?\b/.test(n)){
    var isVintage=/\b5[0-9]\b|\b6[0-9]\b|\bvintage\b/.test(n);
    var isClapton=/\bclapton\b|\bec\b/.test(n);
    return {pickupType:t,voicing:isClapton?"warm":isVintage?"bright":"balanced",bodyResonance:"solid",
      gainAffinity:{clean:+4,crunch:isClapton?+4:+2,drive:+1,high_gain:-3},
      styleMods:{blues:isClapton?+6:+5,rock:+3,hard_rock:-1,jazz:+3,pop:+2,metal:-5},
      desc:isClapton?"Strat noiseless, midboost, son smooth":isVintage?"Strat vintage, cleans cristallins":"Strat moderne, polyvalente"};
  }
  if(/\bjazzmaster\b|\bjazz\s?m\b/.test(n)){
    return {pickupType:t,voicing:"warm",bodyResonance:"solid",
      gainAffinity:{clean:+4,crunch:+1,drive:-1,high_gain:-4},
      styleMods:{blues:+4,rock:+2,hard_rock:-2,jazz:+6,pop:+3,metal:-6},
      desc:"SC large, son chaud et rond, peu de twang"};
  }
  if(/\bjaguar\b|\bmustang\b/.test(n)){
    return {pickupType:t,voicing:"bright",bodyResonance:"solid",
      gainAffinity:{clean:+3,crunch:+2,drive:0,high_gain:-4},
      styleMods:{blues:+2,rock:+3,hard_rock:-1,jazz:+2,pop:+4,metal:-5},
      desc:"Short scale Fender, son vif et compact"};
  }
  if(/\bles\s?paul\b|\blp\b/.test(n)){
    var isP90=t==="P90"||/\bp90\b/.test(n);
    return {pickupType:t,voicing:isP90?"balanced":"warm",bodyResonance:"solid",
      gainAffinity:{clean:isP90?+1:-1,crunch:+3,drive:isP90?+2:+4,high_gain:isP90?-2:+2},
      styleMods:{blues:isP90?+5:+3,rock:isP90?+3:+4,hard_rock:isP90?+1:+5,jazz:isP90?+2:-2,pop:isP90?+1:0,metal:isP90?-3:+1},
      desc:isP90?"Les Paul P90, midrange caractéristique":"Les Paul, sustain long, référence HB"};
  }
  if(/\bsg\b/.test(n)){
    return {pickupType:t,voicing:"bright",bodyResonance:"solid",
      gainAffinity:{clean:-1,crunch:+2,drive:+5,high_gain:+3},
      styleMods:{blues:+1,rock:+4,hard_rock:+6,jazz:-3,pop:-1,metal:+2},
      desc:"SG, médiums agressifs, attaque rapide, léger"};
  }
  // Phase 3.8 — Heuristique semi-hollow étendue suite retour Arthur :
  // Epiphone ES-339, Casino, Sheraton, Riviera, ainsi que les ES Gibson
  // au numéro brut (335, 339, 345, 355…) et les variantes courantes
  // (Dot, hollowbody). La détection est volontairement permissive sur
  // les modèles Epiphone parce qu'ils sont fréquents dans les profils
  // custom de la famille (Arthur joue une ES-339 sur BB King "The
  // Thrill is Gone"). Conséquence scoring : computeGuitarScoreV2
  // applique +4 sur semi_hollow + clean/crunch + blues/jazz, et -3 sur
  // semi_hollow + high_gain.
  if(/\bes[\s-]?\d{2,4}\b|\bsemi[\s-]?hollow\b|\bcasino\b|\bsheraton\b|\briviera\b|\bhollow[\s-]?body\b|\b(?:3(?:30|35|39|45|55|95)|175|150|295)\b/.test(n)){
    return {pickupType:t,voicing:"warm",bodyResonance:"semi_hollow",
      gainAffinity:{clean:+3,crunch:+3,drive:+1,high_gain:-4},
      styleMods:{blues:+5,rock:+2,hard_rock:-2,jazz:+6,pop:+2,metal:-6},
      desc:"Semi-hollow, chaleur et résonance, jazz/blues"};
  }
  if(/\bflying\s?v\b|\bexplorer\b/.test(n)){
    return {pickupType:t,voicing:"bright",bodyResonance:"solid",
      gainAffinity:{clean:-3,crunch:+1,drive:+4,high_gain:+5},
      styleMods:{blues:0,rock:+3,hard_rock:+5,jazz:-5,pop:-3,metal:+5},
      desc:"Gibson extrême, haute énergie, hard rock / metal"};
  }
  if(/\bprs\b|\bpaul\s?reed\b/.test(n)){
    return {pickupType:t,voicing:"balanced",bodyResonance:"solid",
      gainAffinity:{clean:+2,crunch:+3,drive:+3,high_gain:+1},
      styleMods:{blues:+3,rock:+4,hard_rock:+3,jazz:+1,pop:+2,metal:0},
      desc:"PRS, polyvalente, HB versatiles, sustain"};
  }
  if(/\bgretsch\b/.test(n)){
    var isHollow=/\bhollow\b|\bcountry\b|\b6120\b|\bfalcon\b/.test(n);
    return {pickupType:t,voicing:"bright",bodyResonance:isHollow?"semi_hollow":"solid",
      gainAffinity:{clean:+4,crunch:+3,drive:0,high_gain:-4},
      styleMods:{blues:+3,rock:+4,hard_rock:-1,jazz:+3,pop:+3,metal:-5},
      desc:"Gretsch, son claquant, rockabilly / country / indie"};
  }
  if(/\bjackson\b|\besp\b|\bschecter\b|\bbc\s?rich\b/.test(n)||(/\bibanez\b/.test(n)&&/\brg\b|\bs\d/.test(n))){
    return {pickupType:t,voicing:"bright",bodyResonance:"solid",
      gainAffinity:{clean:-2,crunch:+1,drive:+4,high_gain:+6},
      styleMods:{blues:-2,rock:+2,hard_rock:+4,jazz:-5,pop:-2,metal:+6},
      desc:"Guitare shred/metal, manche rapide, HB haut gain"};
  }
  if(/\brickenbacker\b|\bricken\b/.test(n)){
    return {pickupType:t,voicing:"bright",bodyResonance:"solid",
      gainAffinity:{clean:+4,crunch:+3,drive:0,high_gain:-4},
      styleMods:{blues:+1,rock:+4,hard_rock:-1,jazz:+2,pop:+5,metal:-5},
      desc:"Rickenbacker, jangle, chime, pop/rock"};
  }
  if(t==="SC") return {pickupType:"SC",voicing:"bright",bodyResonance:"solid",
    gainAffinity:{clean:+3,crunch:+2,drive:0,high_gain:-3},
    styleMods:{blues:+3,rock:+3,hard_rock:-1,jazz:+2,pop:+2,metal:-5},
    desc:"Guitare single coil"};
  if(t==="P90") return {pickupType:"P90",voicing:"balanced",bodyResonance:"solid",
    gainAffinity:{clean:+1,crunch:+3,drive:+2,high_gain:-2},
    styleMods:{blues:+4,rock:+3,hard_rock:+1,jazz:+1,pop:+1,metal:-3},
    desc:"Guitare P90, gras et dynamique"};
  return {pickupType:"HB",voicing:"warm",bodyResonance:"solid",
    gainAffinity:{clean:0,crunch:+2,drive:+3,high_gain:+1},
    styleMods:{blues:+2,rock:+3,hard_rock:+3,jazz:0,pop:+1,metal:+1},
    desc:"Guitare humbucker polyvalente"};
}

function findGuitarProfile(guitarId){
  if(GUITAR_PROFILES[guitarId]) return GUITAR_PROFILES[guitarId];
  var g=findGuitar(guitarId);
  if(g) return inferGuitarProfile(g.name,g.type);
  return null;
}

function computeGuitarScoreV2(guitarId,presetStyle,presetGainRange,presetVoicing){
  const g=findGuitarProfile(guitarId);
  if(!g) return 50;
  const styleMod=g.styleMods[presetStyle]||0;
  const gainMod=g.gainAffinity[presetGainRange]||0;
  let voicingMod=0;
  if(g.voicing!=="balanced"&&presetVoicing&&presetVoicing!=="balanced"){
    voicingMod=(g.voicing!==presetVoicing)?+3:-2;
  }
  let resonanceMod=0;
  if(g.bodyResonance==="semi_hollow"&&["clean","crunch"].includes(presetGainRange)&&["blues","jazz"].includes(presetStyle)){
    resonanceMod=+4;
  }
  if(g.bodyResonance==="semi_hollow"&&presetGainRange==="high_gain"){
    resonanceMod=-3;
  }
  return Math.max(0,Math.min(100,50+(styleMod+gainMod+voicingMod+resonanceMod)*3));
}


// avec une guitare de la collection. Évite que "SG Ebony" rate "SG Standard Ebony".
function matchGuitarName(name,g){
  if(!name||!g) return false;
  const n=String(name).toLowerCase().replace(/\s+/g," ").trim();
  const a=String(g.name||"").toLowerCase().replace(/\s+/g," ").trim();
  const b=String(g.short||"").toLowerCase().replace(/\s+/g," ").trim();
  if(!n) return false;
  if(n===a||n===b) return true;
  if(a&&(n.includes(a)||a.includes(n))) return true;
  if(b&&(n.includes(b)||b.includes(n))) return true;
  return false;
}
function findGuitarByAIName(name,guitars){
  if(!name||!guitars) return null;
  return guitars.find(g=>matchGuitarName(name,g))||null;
}
function findCotEntryForGuitar(cotList,g){
  if(!cotList||!g) return null;
  return cotList.find(gt=>matchGuitarName(gt?.name,g))||null;
}

// Score local de compatibilité guitare ↔ morceau, utilisé quand l'IA ne renvoie pas cette guitare dans cot_step2_guitars (top 2-3 only).
function localGuitarSongScore(g,aiC){
  if(!g||!aiC) return null;
  const pref=aiC.pickup_preference;
  let pickupScore;
  if(!pref||pref==="any") pickupScore=80;
  else if(pref===g.type) pickupScore=95;
  else pickupScore=55;
  const presetGainRange=getGainRange(typeof aiC.target_gain==="number"?aiC.target_gain:5);
  const styleScore=aiC.song_style?computeGuitarScoreV2(g.id,aiC.song_style,presetGainRange,null):70;
  return Math.max(30,Math.min(99,Math.round(pickupScore*0.6+styleScore*0.4)));
}

// Phase 3.9 — Auto-pick top guitar robuste au cache IA stale.
// Combine la ranking IA (aiC.cot_step2_guitars, top 2-3 only) avec un
// re-scoring local pour les guitares ABSENTES du cache. Garantit qu'une
// guitare ajoutée APRÈS la dernière passe IA (ex. custom Epiphone
// ES-339 ajoutée dans le profil Arthur) puisse devenir top automatique
// même si l'IA pointe encore vers la guitare précédente (SG, LP, etc.)
// dans cot_step2_guitars / ideal_guitar.
//
// Pour chaque guitare de availableGuitars :
//   1. Si elle apparaît dans aiC.cot_step2_guitars (matchGuitarName) :
//      on prend son score IA (= confiance dans le ranking IA quand
//      toutes les guitares sont dans le cache).
//   2. Sinon : on calcule un score local équivalent à
//      localGuitarSongScore mais sans dépendance window.__allGuitars
//      (profil résolu via GUITAR_PROFILES puis fallback
//      inferGuitarProfile sur name+type).
//
// Retourne le guitar object au top score, ou null si liste vide.
//
// Sans aiC, on retombe purement sur le scoring local (pickup neutre).
function pickTopGuitar(aiC, availableGuitars, _song){
  if(!Array.isArray(availableGuitars)||availableGuitars.length===0) return null;
  const cot=Array.isArray(aiC?.cot_step2_guitars)?aiC.cot_step2_guitars:null;
  const scored=availableGuitars.map((g)=>{
    if(!g) return {g,score:0};
    // 1. IA score si la guitare est dans cot_step2_guitars.
    if(cot){
      const entry=findCotEntryForGuitar(cot,g);
      if(entry&&typeof entry.score==='number'){
        return {g,score:entry.score,source:'cot'};
      }
    }
    // 2. Score local. Profil résolu sans window dep pour testabilité.
    const profile=GUITAR_PROFILES[g.id]||inferGuitarProfile(g.name,g.type);
    if(!aiC||!profile) return {g,score:50,source:'fallback'};
    const pref=aiC.pickup_preference;
    const pickupScore=(!pref||pref==='any')?80:(pref===g.type?95:55);
    const presetGainRange=getGainRange(typeof aiC.target_gain==='number'?aiC.target_gain:5);
    let styleScore=70;
    if(aiC.song_style){
      const sm=profile.styleMods?.[aiC.song_style]||0;
      const gm=profile.gainAffinity?.[presetGainRange]||0;
      let resonanceMod=0;
      if(profile.bodyResonance==='semi_hollow'&&['clean','crunch'].includes(presetGainRange)&&['blues','jazz'].includes(aiC.song_style)) resonanceMod=+4;
      if(profile.bodyResonance==='semi_hollow'&&presetGainRange==='high_gain') resonanceMod=-3;
      styleScore=Math.max(0,Math.min(100,50+(sm+gm+resonanceMod)*3));
    }
    const score=Math.max(30,Math.min(99,Math.round(pickupScore*0.6+styleScore*0.4)));
    return {g,score,source:'local'};
  });
  scored.sort((a,b)=>(b.score||0)-(a.score||0));
  return scored[0]?.g||null;
}

function guitarChoiceFeedback(g,aiC,cotEntry){
  if(!g||!aiC) return null;
  if(cotEntry?.reason) return cotEntry.reason;
  var profile=findGuitarProfile(g.id);
  if(!profile) return null;
  var pros=[],cons=[];
  var pref=aiC.pickup_preference;
  var style=aiC.song_style;
  var gain=getGainRange(typeof aiC.target_gain==="number"?aiC.target_gain:5);
  if(pref&&pref!=="any"){
    if(pref===g.type) pros.push("micros "+g.type+" adaptés au morceau");
    else cons.push("micros "+g.type+" — le morceau demande plutôt des "+pref);
  }
  if(style&&profile.styleMods[style]!=null){
    var sm=profile.styleMods[style];
    if(sm>=4) pros.push("excellente affinité "+style.replace("_"," "));
    else if(sm<=-2) cons.push("peu naturelle en "+style.replace("_"," "));
  }
  if(gain&&profile.gainAffinity[gain]!=null){
    var gm=profile.gainAffinity[gain];
    if(gm>=3) pros.push("à l'aise en "+gain.replace("_"," "));
    else if(gm<=-3) cons.push("moins adaptée au registre "+gain.replace("_"," "));
  }
  var parts=[];
  if(pros.length) parts.push("✓ "+pros.join(", "));
  if(cons.length) parts.push("⚠ "+cons.join(", "));
  return parts.length?parts.join(" · "):profile.desc;
}

function localGuitarSettings(g,aiC){
  if(!g||!aiC) return null;
  const profile=findGuitarProfile(g.id)||{};
  const voicing=profile.voicing||"balanced";
  const pickupType=g.type;
  const targetGain=typeof aiC.target_gain==="number"?aiC.target_gain:5;
  const gainRange=getGainRange(targetGain);
  const wantedPickup=aiC.pickup_preference;
  const style=aiC.song_style;
  // Position des micros
  let pickupAdvice;
  if(gainRange==="clean"||style==="jazz"){
    pickupAdvice=pickupType==="SC"?"Micro manche (pos. 5)":"Micro manche";
  }else if(gainRange==="high_gain"||style==="metal"||style==="hard_rock"){
    pickupAdvice="Micro chevalet";
  }else if(gainRange==="drive"||style==="rock"){
    pickupAdvice=pickupType==="SC"?"Chevalet ou intermediaire (pos. 4)":"Micro chevalet";
  }else{ // crunch / blues
    if(pickupType==="SC") pickupAdvice="Position intermediaire (2 ou 4) ou manche";
    else if(pickupType==="P90") pickupAdvice="Au choix selon attaque";
    else pickupAdvice="Manche pour rondeur, chevalet pour mordant";
  }
  // Tone
  let tone;
  if(style==="jazz") tone="4-6";
  else if(voicing==="bright"&&(gainRange==="drive"||gainRange==="high_gain")) tone="6-7";
  else if(voicing==="warm"&&gainRange==="clean") tone="8-10";
  else if(gainRange==="high_gain") tone="8-10";
  else tone="7-9";
  // Volume
  const volume=gainRange==="clean"?"7-9":"10";
  // Hint si la guitare ne correspond pas au pickup ideal
  let mismatchHint="";
  if(wantedPickup&&wantedPickup!=="any"&&wantedPickup!==pickupType){
    if(wantedPickup==="HB"&&pickupType==="SC") mismatchHint=" — l'ideal serait un humbucker, baisse le tone pour epaissir";
    else if(wantedPickup==="SC"&&pickupType==="HB") mismatchHint=" — l'ideal serait un single coil, split le HB si possible";
    else if(wantedPickup==="P90") mismatchHint=" — l'ideal serait un P90 (mordant)";
    else if(pickupType==="P90"&&wantedPickup==="HB") mismatchHint=" — pour plus de chaleur, monte le volume";
  }
  return `${pickupAdvice} · Tone ${tone} · Volume ${volume}${mismatchHint}`;
}

export {
  GUITAR_PROFILES, inferGuitarProfile, findGuitarProfile,
  computeGuitarScoreV2, matchGuitarName, findGuitarByAIName,
  findCotEntryForGuitar, localGuitarSongScore, pickTopGuitar,
  guitarChoiceFeedback, localGuitarSettings,
};
