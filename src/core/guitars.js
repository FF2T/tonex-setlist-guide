// src/core/guitars.js — extrait depuis main.jsx (Phase 1, étape 2).
// Strict verbatim : GUITARS et findGuitar identiques à l'octet près
// à leur définition dans le HTML monolithe (Phase 0).
// Note : findGuitar référence window.__allGuitars — utilisable seulement
// en environnement navigateur. En tests Vitest (env node), n'est pas
// invoqué tant que les guitarId fournis sont dans GUITAR_PROFILES.

const GUITARS = [
  {id:"lp60",name:"Les Paul Standard 60",short:"LP 60",type:"HB",brand:"Gibson"},
  {id:"lp50p90",name:"Les Paul Standard 50 P90",short:"LP P90",type:"P90",brand:"Gibson"},
  {id:"sg_ebony",name:"SG Standard Ebony",short:"SG Ebony",type:"HB",brand:"Gibson"},
  {id:"sg61",name:"SG Standard 61",short:"SG 61",type:"HB",brand:"Gibson"},
  {id:"es335",name:"ES-335",short:"ES-335",type:"HB",brand:"Gibson"},
  {id:"strat61",name:"Strat AM Vintage II 61",short:"Strat 61",type:"SC",brand:"Fender"},
  {id:"strat_pro2",name:"Strat AM Pro II",short:"Strat Pro II",type:"SC",brand:"Fender"},
  {id:"strat_ec",name:"Eric Clapton Strat",short:"EC Strat",type:"SC",brand:"Fender"},
  {id:"tele63",name:"Telecaster AM Vintage II 63",short:"Tele 63",type:"SC",brand:"Fender"},
  {id:"tele_ultra",name:"Telecaster Ultra",short:"Tele Ultra",type:"SC",brand:"Fender"},
  {id:"jazzmaster",name:"Jazzmaster",short:"Jazzmaster",type:"SC",brand:"Fender"},
  {id:"sire_t7",name:"Sire Larry Carlton T7 (Telecaster)",short:"Sire T7",type:"SC",brand:"Sire"},
  {id:"sire_t3",name:"Sire Larry Carlton T3 (semi-hollow)",short:"Sire T3",type:"SC",brand:"Sire"},
];

const GUITAR_BRANDS = [...new Set(GUITARS.map(g=>g.brand))];

function findGuitar(id){var g=GUITARS.find(x=>x.id===id);if(g)return g;if(window.__allGuitars){var cg=window.__allGuitars.find(x=>x.id===id);if(cg)return cg;}return null;}

export { GUITARS, GUITAR_BRANDS, findGuitar };
