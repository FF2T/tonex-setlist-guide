// src/core/guitars.js — extrait depuis main.jsx (Phase 1, étape 2).
// Phase 7.61 : rename des `name` vers les noms marketing/PDF complets
// (ex. "Strat AM Vintage II 61" → "Fender Stratocaster American Vintage II 1961").
// `short` reste compact pour le badge ListScreen. Le rétro-compat des
// aiCache historiques (qui contiennent les anciens `name`) est garanti
// par `matchGuitarName` Phase 7.61 (tokenize-set + abbreviations).
// Le nouveau nom complet contient le mot famille ("Stratocaster",
// "Telecaster", "Les Paul", etc.) → `getGuitarFamily` Phase 7.64 peut
// matcher direct sans regex complexe.

const GUITARS = [
  {id:"lp60",name:"Gibson Les Paul Standard '60s",short:"LP 60",type:"HB",brand:"Gibson"},
  {id:"lp50p90",name:"Gibson Les Paul Standard '50s P-90",short:"LP P90",type:"P90",brand:"Gibson"},
  {id:"sg_ebony",name:"Gibson SG Standard Ebony",short:"SG Ebony",type:"HB",brand:"Gibson"},
  {id:"sg61",name:"Gibson SG Standard '61",short:"SG 61",type:"HB",brand:"Gibson"},
  {id:"es335",name:"Gibson ES-335",short:"ES-335",type:"HB",brand:"Gibson"},
  {id:"strat61",name:"Fender Stratocaster American Vintage II 1961",short:"Strat 61",type:"SC",brand:"Fender"},
  {id:"strat_pro2",name:"Fender Stratocaster American Professional II",short:"Strat Pro II",type:"SC",brand:"Fender"},
  {id:"strat_ec",name:"Fender Eric Clapton Signature Stratocaster",short:"EC Strat",type:"SC",brand:"Fender"},
  {id:"tele63",name:"Fender Telecaster American Vintage II 1963",short:"Tele 63",type:"SC",brand:"Fender"},
  {id:"tele_ultra",name:"Fender Telecaster American Ultra",short:"Tele Ultra",type:"SC",brand:"Fender"},
  {id:"jazzmaster",name:"Fender American Vintage II 1966 Jazzmaster",short:"Jazzmaster",type:"SC",brand:"Fender"},
  {id:"sire_t7",name:"Sire Larry Carlton T7 (Telecaster)",short:"Sire T7",type:"SC",brand:"Sire"},
  {id:"sire_t3",name:"Sire Larry Carlton T3 (semi-hollow)",short:"Sire T3",type:"SC",brand:"Sire"},
];

const GUITAR_BRANDS = [...new Set(GUITARS.map(g=>g.brand))];

function findGuitar(id){var g=GUITARS.find(x=>x.id===id);if(g)return g;if(window.__allGuitars){var cg=window.__allGuitars.find(x=>x.id===id);if(cg)return cg;}return null;}

export { GUITARS, GUITAR_BRANDS, findGuitar };
