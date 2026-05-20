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
//
// Phase 7.61 — Extension tokenize-set : permet de matcher des variantes
// abrégées ou suffixées de noms longs ("Strat 1961" ↔ "Fender Stratocaster
// American Vintage II 1961"). Sert deux objectifs :
//   1. Rétro-compat aiCache historique avec anciens noms abrégés (le rename
//      des 11 guitares Phase 7.61 vers noms PDF/marketing complets aurait
//      cassé les caches sinon).
//   2. Phase 7.64 family match — `getRefGuitarFamily` n'a plus besoin de
//      regex complexe puisque les noms complets contiennent "Stratocaster",
//      "Telecaster", etc.

// Stopwords courants des noms de guitares — pas discriminants pour le
// matching (présents dans beaucoup de noms différents). Pour matcher
// par tokens significatifs, on filtre ces mots vides.
const GUITAR_STOPWORDS = new Set([
  // articles + connecteurs
  'the','a','an','of','and','with','for','de','la','le',
  // marques (la marque seule ne discrimine pas le modèle)
  'fender','gibson','epiphone','squier','sire','ibanez','schecter',
  'gretsch','prs','yamaha','jackson','esp','ltd','charvel','jet',
  // qualificatifs marketing courants
  'american','mexican','japanese','standard','professional','custom',
  'classic','vintage','modern','reissue','signature','limited','edition',
  'series','original','player','plus',
  // numerals romains
  'ii','iii','iv','v','vi',
  // génériques
  'guitar','electric','solidbody',
  // abréviations communes
  'am','pro','mim','mia',
]);

// Expand les abréviations communes en forme longue AVANT tokenize.
// "LP 60" → "les paul 60" pour matcher "Gibson Les Paul Standard '60s".
function _expandGuitarAbbreviations(s){
  return s
    .replace(/\blp\b/gi,'les paul')
    .replace(/\bjm\b/gi,'jazzmaster')
    .replace(/\bjb\b/gi,'jazz bass');
}

function _tokenizeGuitarName(s){
  return _expandGuitarAbbreviations(String(s).toLowerCase())
    .replace(/[-()'.,/]/g,' ')
    .split(/\s+/)
    .filter(Boolean);
}

function _significantTokens(tokens){
  return tokens.filter(t=>!GUITAR_STOPWORDS.has(t));
}

// Match flexible entre 2 tokens : exact, suffix/prefix numeric, ou
// substring sur ≥4 chars.
function _tokenMatch(t1,t2){
  if(t1===t2) return true;
  const m1=t1.match(/^\d+/);
  const m2=t2.match(/^\d+/);
  if(m1&&m2){
    const d1=m1[0],d2=m2[0];
    if(d1===d2) return true;                          // 60 ↔ 60s
    if(d1.length>=2&&d2.endsWith(d1)) return true;    // 61 ↔ 1961
    if(d2.length>=2&&d1.endsWith(d2)) return true;
  }
  if(t1.length>=4&&t2.includes(t1)) return true;      // strat ↔ stratocaster
  if(t2.length>=4&&t1.includes(t2)) return true;
  return false;
}

// Tous les tokens significatifs de `needle` doivent matcher au moins un
// token de `haystack`.
function _tokenSubsetMatch(needle,haystack){
  if(!needle.length) return false;
  return needle.every(n=>haystack.some(h=>_tokenMatch(n,h)));
}

function matchGuitarName(name,g){
  if(!name||!g) return false;
  const n=String(name).toLowerCase().replace(/\s+/g," ").trim();
  const a=String(g.name||"").toLowerCase().replace(/\s+/g," ").trim();
  const b=String(g.short||"").toLowerCase().replace(/\s+/g," ").trim();
  if(!n) return false;
  // Match exact (legacy)
  if(n===a||n===b) return true;
  // Match substring (legacy, conserve "Schecter C-1 Platinum" ↔
  // "Schecter" et autres cas où une chaîne en contient une autre).
  if(a&&(n.includes(a)||a.includes(n))) return true;
  if(b&&(n.includes(b)||b.includes(n))) return true;
  // Phase 7.61 — tokenize-set avec expand abbreviations + stoplist.
  const nTokens=_significantTokens(_tokenizeGuitarName(n));
  if(!nTokens.length) return false;
  const aTokens=_significantTokens(_tokenizeGuitarName(a));
  if(aTokens.length&&_tokenSubsetMatch(nTokens,aTokens)) return true;
  const bTokens=_significantTokens(_tokenizeGuitarName(b));
  if(bTokens.length&&_tokenSubsetMatch(nTokens,bTokens)) return true;
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

// Phase 7.64 — Famille de guitare (Strat/Tele/LP/SG/ES-335/Jazzmaster/other).
// Sert au bonus de scoring family-match : quand l'IA dit "ref_guitar:
// Fender Stratocaster" et que le rig contient une Strat + une Tele, on
// veut privilégier la Strat même si le scoring V9 brut préfère la Tele
// pour des raisons secondaires (voicing pickups, etc.).
//
// Couplé à Phase 7.61 (rename guitares vers noms complets type "Fender
// Stratocaster American Vintage II 1961"), le match est trivial via
// substring sur le mot famille. Pour les noms abrégés legacy ou les
// customs (Schecter C-1, Ibanez Gio…), tombera sur 'other' — ce qui est
// correct (pas de bonus appliqué, scoring V9 standard).
function getGuitarFamily(name){
  if(!name||typeof name!=="string") return 'other';
  const n=name.toLowerCase();
  // Ordre intentionnel : 'jazz bass' avant 'jazzmaster' pour ne pas confondre.
  // 'les paul' avant 'paul' générique (pas d'autre cas).
  if(n.includes('stratocaster')||/\bstrat\b/.test(n)) return 'stratocaster';
  if(n.includes('telecaster')||/\btele\b/.test(n)) return 'telecaster';
  if(n.includes('les paul')||/\blp\b/.test(n)) return 'les_paul';
  if(n.includes('jazzmaster')) return 'jazzmaster';
  if(n.includes('jaguar')) return 'jaguar';
  if(n.includes('mustang')) return 'mustang';
  if(/\bes[- ]?(335|339|345|355|175|150|125)\b/.test(n)) return 'es335';
  if(n.includes('flying v')||/\bflying[- ]v\b/.test(n)) return 'flying_v';
  if(n.includes('explorer')) return 'explorer';
  if(n.includes('firebird')) return 'firebird';
  if(/\bsg\b/.test(n)) return 'sg';
  if(/\bprs\b/.test(n)||n.includes('paul reed smith')) return 'prs';
  if(n.includes('superstrat')||n.includes('super strat')) return 'superstrat';
  return 'other';
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

// Phase 7.82 — Bug #2 ("Micro chevalet" en EN dans SETTINGS — MY PICK) :
// localGuitarSettings retourne désormais un objet structuré avec des
// clés i18n + fallbacks FR au lieu d'une string FR brute. Les appelants
// UI (HomeScreen.SongDetailCard) composent le rendu avec t() et un
// template localisé (`{pickup} · Tone {tone} · Volume {volume}{mismatch}`).
function localGuitarSettings(g,aiC){
  if(!g||!aiC) return null;
  const profile=findGuitarProfile(g.id)||{};
  const voicing=profile.voicing||"balanced";
  const pickupType=g.type;
  const targetGain=typeof aiC.target_gain==="number"?aiC.target_gain:5;
  const gainRange=getGainRange(targetGain);
  const wantedPickup=aiC.pickup_preference;
  const style=aiC.song_style;
  // Position des micros — clé i18n + fallback FR.
  let pickupKey, pickupFallback;
  if(gainRange==="clean"||style==="jazz"){
    if(pickupType==="SC"){ pickupKey="pickup.neck-pos5"; pickupFallback="Micro manche (pos. 5)"; }
    else { pickupKey="pickup.neck"; pickupFallback="Micro manche"; }
  }else if(gainRange==="high_gain"||style==="metal"||style==="hard_rock"){
    pickupKey="pickup.bridge"; pickupFallback="Micro chevalet";
  }else if(gainRange==="drive"||style==="rock"){
    if(pickupType==="SC"){ pickupKey="pickup.bridge-or-pos4"; pickupFallback="Chevalet ou intermediaire (pos. 4)"; }
    else { pickupKey="pickup.bridge"; pickupFallback="Micro chevalet"; }
  }else{ // crunch / blues
    if(pickupType==="SC"){ pickupKey="pickup.middle-or-neck"; pickupFallback="Position intermediaire (2 ou 4) ou manche"; }
    else if(pickupType==="P90"){ pickupKey="pickup.choice-attack"; pickupFallback="Au choix selon attaque"; }
    else { pickupKey="pickup.neck-or-bridge"; pickupFallback="Manche pour rondeur, chevalet pour mordant"; }
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
  // Hint si la guitare ne correspond pas au pickup ideal — clé i18n + fallback FR.
  let mismatchKey=null, mismatchFallback="";
  if(wantedPickup&&wantedPickup!=="any"&&wantedPickup!==pickupType){
    if(wantedPickup==="HB"&&pickupType==="SC"){ mismatchKey="pickup.mismatch.hb-sc"; mismatchFallback=" — l'ideal serait un humbucker, baisse le tone pour epaissir"; }
    else if(wantedPickup==="SC"&&pickupType==="HB"){ mismatchKey="pickup.mismatch.sc-hb"; mismatchFallback=" — l'ideal serait un single coil, split le HB si possible"; }
    else if(wantedPickup==="P90"){ mismatchKey="pickup.mismatch.p90"; mismatchFallback=" — l'ideal serait un P90 (mordant)"; }
    else if(pickupType==="P90"&&wantedPickup==="HB"){ mismatchKey="pickup.mismatch.p90-hb"; mismatchFallback=" — pour plus de chaleur, monte le volume"; }
  }
  return { pickupKey, pickupFallback, tone, volume, mismatchKey, mismatchFallback };
}

export {
  GUITAR_PROFILES, inferGuitarProfile, findGuitarProfile,
  computeGuitarScoreV2, matchGuitarName, findGuitarByAIName,
  findCotEntryForGuitar, localGuitarSongScore, pickTopGuitar,
  guitarChoiceFeedback, localGuitarSettings,
  getGuitarFamily,
};
