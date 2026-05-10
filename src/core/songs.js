// src/core/songs.js — extrait verbatim depuis main.jsx (Phase 1, étape 3).
// SONG_PRESETS : recommandations preset par morceau (pA = ToneX Pedal,
// pP = ToneX Plug), 13 morceaux initiaux.
// INIT_SONG_DB_META : métadonnées (titre, artiste, année, album, desc).
// SONG_HISTORY : référence historique (guitariste, guitare, ampli, effets).
// getSongInfo : façade qui combine init + cache IA.

// Les fonctions preset sont sérialisées sous forme de données statiques pour localStorage
const SONG_PRESETS = {
  acdc_hth:{
    pA:{HB:{b:42,c:"B",l:"TSR Mars 800SL Chnl 1 Drive"},SC:{b:8,c:"B",l:"AA MRSH SL100 JU Dimed BAL CAB"},P90:{b:17,c:"B",l:"AA ORNG 120 Dimed BAL CAB"}},
    pP:{HB:{b:3,c:"B",l:"ML MARS 800 Drive"},SC:{b:2,c:"B",l:"MRSH SL100 JU Dimed BAL CAB"}},
    set:{HB:{p:"Gate si silences nets.",g:"Micro chevalet. Volume à fond."},SC:{p:"Input Trim +1.5dB. Gate si silences nets.",g:"Micro chevalet. Strat manquera de punch."}},
    gr:{HB:"SG micro chevalet — son Angus Young.",SC:"Strat fonctionne mais HB idéal.",P90:"P90 acceptable."},
    ig:["sg_ebony","sg61"],tsr:{label:"Marshall SL800 — AC/DC",A:{n:"TSR Mars 800SL Chnl 1 Cln",r:"Clean intro"},B:{n:"TSR Mars 800SL Chnl 1 Drive",r:"Drive Angus"},C:{n:"TSR Mars 800SL Ch 1 Full Beans",r:"Full gain solos"}},
  },
  acdc_ysmanll:{
    pA:{HB:{b:42,c:"B",l:"TSR Mars 800SL Chnl 1 Drive"},SC:{b:8,c:"B",l:"AA MRSH SL100 JU Dimed BAL CAB"}},
    pP:{HB:{b:3,c:"B",l:"ML MARS 800 Drive"},SC:{b:2,c:"B",l:"MRSH SL100 JU Dimed BAL CAB"}},
    set:{HB:{g:"Micro chevalet. Volume à fond."},SC:{p:"Input Trim +1.5dB.",g:"Input Trim +1.5dB."}},
    gr:{HB:"SG micro chevalet.",SC:"HB préférable."},ig:["sg_ebony","sg61"],tsrRef:"acdc_hth",
  },
  acdc_thunderstruck:{
    pA:{HB:{b:42,c:"A",l:"TSR Mars 800SL Chnl 1 Cln"},SC:{b:6,c:"A",l:"TSR TWO ROK Bloom Cln"}},
    pP:{HB:{b:3,c:"A",l:"ML MARS 800 Clean"},SC:{b:1,c:"A",l:"TSR Super S Clean"}},
    set:{HB:{p:"Preset A pour intro, B pour riffs.",g:"Picking alterné strict."},SC:{p:"Preset A pour intro, B pour riffs. Input Trim +1.5dB.",g:"Input Trim +1.5dB."}},
    gr:{HB:"SG réactive pour le picking.",SC:"Strat convient."},ig:["sg_ebony","sg61"],tsrRef:"acdc_hth",
  },
  acdc_tnt:{
    pA:{HB:{b:42,c:"B",l:"TSR Mars 800SL Chnl 1 Drive"},SC:{b:8,c:"B",l:"AA MRSH SL100 JU Dimed BAL CAB"}},
    pP:{HB:{b:3,c:"B",l:"ML MARS 800 Drive"},SC:{b:2,c:"B",l:"MRSH SL100 JU Dimed BAL CAB"}},
    set:{HB:{g:"Riffs en staccato."},SC:{g:"Riffs en staccato."}},
    gr:{HB:"SG micro chevalet.",SC:"HB préférable."},ig:["sg_ebony","sg61"],tsrRef:"acdc_hth",
  },
  acdc_bib:{
    pA:{HB:{b:42,c:"B",l:"TSR Mars 800SL Chnl 1 Drive"},SC:{b:8,c:"B",l:"AA MRSH SL100 JU Dimed BAL CAB"}},
    pP:{HB:{b:3,c:"B",l:"ML MARS 800 Drive"},SC:{b:2,c:"B",l:"MRSH SL100 JU Dimed BAL CAB"}},
    set:{HB:{g:"Volume entre riffs et solo."},SC:{g:"Volume entre riffs et solo."}},
    gr:{HB:"SG micro chevalet.",SC:"HB préférable."},ig:["sg_ebony","sg61"],tsrRef:"acdc_hth",
  },
  cream_wr:{
    pA:{HB:{b:43,c:"B",l:"TSR Stevie G Gritty Clean"},SC:{b:43,c:"A",l:"TSR Stevie G Bright Clean"},P90:{b:43,c:"B",l:"TSR Stevie G Gritty Clean"}},
    pP:{HB:{b:2,c:"A",l:"TSR JTM Clean(ish)"},SC:{b:1,c:"A",l:"TSR Super S Clean"}},
    set:{HB:{p:"Reverb légère. Wah sur le solo.",g:"Micro manche couplets, chevalet solo."},SC:{p:"Reverb légère.",g:"Micro manche couplets, chevalet solo."}},
    gr:{HB:"Clapton utilisait une SG.",SC:"Strat fonctionne bien."},ig:["sg_ebony","lp60","strat61"],
    tsr:{label:"Two Rock Stevie G — Clapton (Bank 43)",A:{n:"TSR Stevie G Bright Clean",r:"Clean brillant"},B:{n:"TSR Stevie G Gritty Clean",r:"Grain Clapton"},C:{n:"TSR Stevie G High Gain",r:"Solo"}},
  },
  bbking_thrill:{
    pA:{HB:{b:44,c:"A",l:"Bumble Deluxe Cln 1"},SC:{b:43,c:"A",l:"TSR Stevie G Bright Clean"},P90:{b:44,c:"A",l:"Bumble Deluxe Cln 1"}},
    pP:{HB:{b:7,c:"A",l:"FNDR BFTWN NR Clean BAL CAB"},SC:{b:1,c:"A",l:"TSR Super S Clean"}},
    set:{HB:{p:"Reverb Spring obligatoire.",g:"Médiator souple ou doigts. Bends larges."},SC:{p:"Reverb Spring obligatoire.",g:"Médiator souple ou doigts."}},
    gr:{HB:"ES-335 idéale.",SC:"Strat — micro chevalet.",P90:"P90 chaud."},ig:["es335","lp60","sg_ebony"],
    tsr:{label:"Dumble Deluxe — BB King (Bank 44)",A:{n:"Bumble Deluxe Cln 1",r:"Le plus proche de Lucille"},B:{n:"Bumble Deluxe Drive 1",r:"Drive léger"},C:{n:"Bumble Deluxe Klon",r:"Sustain pour les bends"}},
  },
  dire_mfn:{
    pA:{HB:{b:13,c:"A",l:"ML MARS 800 Clean"},SC:{b:45,c:"A",l:"TSR Stevie G Bright Clean"}},
    pP:{HB:{b:9,c:"A",l:"ML FNDR Deluxe Clean"},SC:{b:9,c:"B",l:"TSR TWO ROK Bloom KOT"}},
    set:{HB:{p:"Monte les aigus.",g:"Monte les aigus."},SC:{p:"Input Trim +1.5dB.",g:"Knopfler joue en doigts."}},
    gr:{HB:"HB donnent un son plus sombre.",SC:"Strat — single coil indispensable."},ig:["strat61","strat_pro2","strat_ec"],
    tsr:{label:"Two Rock Stevie G — Knopfler (Bank 45)",A:{n:"TSR Stevie G Bright Clean",r:"Cristallin Strat"},B:{n:"TSR Stevie G Low Gain",r:"Riff en doigts"},C:{n:"TSR Stevie G Mid Gain",r:"Solo"}},
  },
  dire_romeo:{
    pA:{HB:{b:13,c:"A",l:"ML MARS 800 Clean"},SC:{b:45,c:"A",l:"TSR Stevie G Bright Clean"}},
    pP:{HB:{b:7,c:"A",l:"FNDR BFTWN NR Clean BAL CAB"},SC:{b:9,c:"A",l:"ML FNDR Deluxe Clean"}},
    set:{HB:{p:"Input Trim +1.5dB. Reverb Hall.",g:"Jeu en doigts."},SC:{p:"Input Trim +1.5dB. Reverb Hall.",g:"Jeu en doigts."}},
    gr:{HB:"HB moins cristallins.",SC:"Strat pour la clarté."},ig:["strat61","strat_pro2","strat_ec"],tsrRef:"dire_mfn",
  },
  ledzep_stairway:{
    pA:{HB:{b:46,c:"A",l:"TSR Mars 800SL Chnl 1 Cln"},SC:{b:7,c:"A",l:"TSR Super S Clean"}},
    pP:{HB:{b:5,c:"A",l:"TSR D13 Best Tweed Ever Clean"},SC:{b:1,c:"A",l:"TSR Super S Clean"}},
    set:{HB:{p:"Preset A intro, B montée, C solo.",g:"Volume 5-6 intro, fond solo. Médiator souple."},SC:{p:"Reverb plate intro.",g:"Volume 5-6 intro, fond solo."}},
    gr:{HB:"LP 60 idéale pour le sustain.",SC:"Strat manque de sustain sur le solo."},ig:["lp60","sg_ebony"],
    tsr:{label:"Marshall SL800 — Led Zep (Bank 46)",A:{n:"TSR Mars 800SL Chnl 1 Cln",r:"Clean intro"},B:{n:"TSR Mars 800SL Chnl 1 Drive",r:"Drive montée"},C:{n:"TSR Mars 800SL Ch 1 Full Beans",r:"Solo de Page"}},
  },
  tel_flipper:{
    pA:{HB:{b:47,c:"B",l:"TSR Mars 900 Chnl 1Dirty"},SC:{b:47,c:"B",l:"TSR Mars 900 Chnl 1Dirty"}},
    pP:{HB:{b:3,c:"B",l:"ML MARS 800 Drive"},SC:{b:2,c:"B",l:"MRSH SL100 JU Dimed BAL CAB"}},
    set:{HB:{g:"Mise en place rythmique stricte."},SC:{g:"Mise en place rythmique stricte."}},
    gr:{HB:"SG ou LP.",SC:"Bertignac jouait Strat."},ig:["strat61","sg_ebony","lp60"],
    tsr:{label:"Marshall JCM900 — Téléphone (Bank 47)",A:{n:"TSR Mars 900 Clean",r:"Clean couplets"},B:{n:"TSR Mars 900 Chnl 1Dirty",r:"Rock français 90s"},C:{n:"TSR Mars 900 Chanl 2 OD",r:"Refrains saturés"}},
  },
  muddy_hoochie:{
    pA:{HB:{b:48,c:"A",l:"TSR Twin Clean"},SC:{b:7,c:"A",l:"TSR Super S Clean"},P90:{b:18,c:"A",l:"TJ 60s GA5 Skylark"}},
    pP:{HB:{b:7,c:"A",l:"FNDR BFTWN NR Clean BAL CAB"},SC:{b:7,c:"A",l:"FNDR BFTWN NR Clean BAL CAB"}},
    set:{HB:{p:"Reverb Spring légère.",g:"Marquer les silences du stop-time."},SC:{g:"Micro chevalet."}},
    gr:{HB:"ES-335 ou LP.",SC:"Strat — micro chevalet.",P90:"P90 parfait."},ig:["es335","lp60","lp50p90"],
    tsr:{label:"Fender Twin Silverface — Muddy (Bank 48)",A:{n:"TSR Twin Clean",r:"Chicago Blues de référence"},B:{n:"TSR Fender Twin + Blues Drive",r:"Riffs stop-time"},C:{n:"TSR Fender Twin + Blues Brkr",r:"Solo expressif"}},
  },
  deeppurple_smoke:{
    pA:{HB:{b:47,c:"B",l:"TSR Mars 900 Chnl 1Dirty"},SC:{b:23,c:"B",l:"TSR JTM Jumped"}},
    pP:{HB:{b:3,c:"B",l:"ML MARS 800 Drive"},SC:{b:5,c:"B",l:"TSR JTM Jumped"}},
    set:{HB:{g:"Riff sur cordes 4-5-6."},SC:{g:"Blackmore jouait Strat !"}},
    gr:{HB:"Humbuckers pour le riff en quintes.",SC:"Blackmore jouait Strat !"},ig:["lp60","sg_ebony"],
    tsr:{label:"Marshall JCM900 — Deep Purple (Bank 47)",A:{n:"TSR Mars 900 Clean",r:"Parties mid-gain"},B:{n:"TSR Mars 900 Chnl 1Dirty",r:"Son Blackmore 70s/80s"},C:{n:"TSR Mars 900 Chanl 2 OD",r:"Solo"}},
  },
};

const INIT_SONG_DB_META = [
  {id:"acdc_hth",title:"Highway to Hell",artist:"AC/DC",year:1979,album:"Highway to Hell",bpm:116,key:"A",desc:"Le riff d'ouverture le plus iconique du hard rock. Angus Young en SG sur un Marshall, le son brut du rock australien."},
  {id:"acdc_ysmanll",title:"You Shook Me All Night Long",artist:"AC/DC",year:1980,album:"Back in Black",bpm:127,key:"G",desc:"Le groove parfait d'AC/DC. Riff en La majeur, son crunchy et rythmique imparable."},
  {id:"acdc_thunderstruck",title:"Thunderstruck",artist:"AC/DC",year:1990,album:"The Razors Edge",bpm:134,key:"B minor",desc:"L'intro en tapping d'Angus Young sur une seule corde. Technique et énergie à l'état pur."},
  {id:"acdc_tnt",title:"TNT",artist:"AC/DC",year:1975,album:"T.N.T.",bpm:128,key:"A",desc:"Riff simple et efficace en power chords. L'essence du rock'n'roll : 3 accords et la vérité."},
  {id:"acdc_bib",title:"Back in Black",artist:"AC/DC",year:1980,album:"Back in Black",bpm:92,key:"E",desc:"L'album le plus vendu d'AC/DC. Le riff en Mi est devenu un standard du rock mondial."},
  {id:"cream_wr",title:"White Room",artist:"Cream",year:1968,album:"Wheels of Fire",bpm:116,key:"D minor",desc:"Clapton à la wah-wah sur un riff psychédélique. Le son du blues-rock britannique des sixties."},
  {id:"bbking_thrill",title:"The Thrill Is Gone",artist:"B.B. King",year:1969,album:"Completely Well",bpm:96,key:"B minor",desc:"Le chef-d'œuvre de B.B. King. Vibrato légendaire sur Lucille, le son du blues moderne."},
  {id:"dire_mfn",title:"Money for Nothing",artist:"Dire Straits",year:1985,album:"Brothers in Arms",bpm:136,key:"G",desc:"Le riff de Knopfler aux doigts (pas de médiator). Son Gibson Les Paul dans un Laney amplifié."},
  {id:"dire_romeo",title:"Romeo & Juliet",artist:"Dire Straits",year:1980,album:"Making Movies",bpm:138,key:"F",desc:"Fingerpicking délicat de Knopfler sur une National steel guitar. Ballade folk-rock intemporelle."},
  {id:"ledzep_stairway",title:"Stairway to Heaven",artist:"Led Zeppelin",year:1971,album:"Led Zeppelin IV",bpm:72,key:"A minor",desc:"Progression de l'arpège acoustique au solo électrique légendaire de Jimmy Page. Le morceau de guitare par excellence."},
  {id:"tel_flipper",title:"Flipper",artist:"Téléphone",year:1977,album:"Téléphone",bpm:158,key:"E",desc:"Le rock français de Bertignac. Énergie punk, riffs simples et efficaces sur Marshall JCM900."},
  {id:"muddy_hoochie",title:"Hoochie Coochie Man",artist:"Muddy Waters",year:1954,album:"Single",bpm:84,key:"A",desc:"Le standard du Chicago Blues. Riff hypnotique en Mi, le son qui a inspiré le rock'n'roll."},
  {id:"deeppurple_smoke",title:"Smoke on the Water",artist:"Deep Purple",year:1972,album:"Machine Head",bpm:112,key:"G minor",desc:"Le riff le plus connu de l'histoire du rock. Ritchie Blackmore sur une Strat dans un Marshall."},
];

// ─── Référence originale par morceau ──────────────────────────────────────────
// guitarist, guitar, amp, effects : données historiques de l'enregistrement original
const SONG_HISTORY = {
  acdc_hth:          {guitarist:"Angus Young",     guitar:"Gibson SG Custom (ébène)",                   amp:"Marshall Super Lead 100W",            effects:"Aucun effet — directement dans l'ampli à fond"},
  acdc_ysmanll:      {guitarist:"Angus Young",     guitar:"Gibson SG Custom",                           amp:"Marshall Super Lead 100W",            effects:"Aucun effet"},
  acdc_thunderstruck:{guitarist:"Angus Young",     guitar:"Gibson SG Custom",                           amp:"Marshall Super Lead 100W",            effects:"Aucun effet — intro en tapping en picking"},
  acdc_tnt:          {guitarist:"Angus Young",     guitar:"Gibson SG (standard)",                       amp:"Marshall Super Lead 100W",            effects:"Aucun effet"},
  acdc_bib:          {guitarist:"Angus Young",     guitar:"Gibson SG Custom",                           amp:"Marshall Super Lead 100W",            effects:"Aucun effet — enr. aux Compass Point Studios (Bahamas)"},
  cream_wr:          {guitarist:"Eric Clapton",    guitar:"Gibson SG Standard «The Fool» (peinte)",     amp:"Marshall JTM45 / Super Lead",         effects:"Wah-wah Vox Clyde McCoy (intro & solo)"},
  bbking_thrill:     {guitarist:"B.B. King",       guitar:"Gibson ES-355 «Lucille»",                    amp:"Fender Super Reverb",                 effects:"Réverb spring, vibrato ES-355, léger delay studio"},
  dire_mfn:          {guitarist:"Mark Knopfler",   guitar:"Schecter Telecaster (humbuckers)",           amp:"Mesa Boogie Mark II",                 effects:"Roland SDD-320 Dimension D (chorus), jeu aux doigts"},
  dire_romeo:        {guitarist:"Mark Knopfler",   guitar:"Fender Stratocaster",                        amp:"Music Man HD130",                     effects:"Léger delay studio, jeu aux doigts"},
  ledzep_stairway:   {guitarist:"Jimmy Page",      guitar:"Martin D-28 (intro) · Gibson Les Paul '59 «No.1» (solo)",amp:"Marshall Super Lead · Hiwatt Custom 100",effects:"Écho à bande Binson Echorec, Leslie speaker (studio)"},
  tel_flipper:       {guitarist:"Louis Bertignac", guitar:"Fender Stratocaster",                        amp:"Marshall JCM800",                     effects:"Léger chorus / delay, boost pour les solos"},
  muddy_hoochie:     {guitarist:"Muddy Waters",    guitar:"Fender Telecaster (modifié, micros custom)", amp:"Fender Super Reverb",                 effects:"Aucun effet — blues électrique Chicago originel (1954)"},
  deeppurple_smoke:  {guitarist:"Ritchie Blackmore",guitar:"Fender Stratocaster (noir, modifiée)",      amp:"Marshall Major 200W (modifié)",       effects:"Hornby-Skewes Treble Booster"},
};

function getSongInfo(song){
  const init=INIT_SONG_DB_META.find(s=>s.id===song.id);
  const ai=song.aiCache?.result;
  // Phase 4 — bpm/key : précédence song (édition utilisateur)
  // > seed statique > aiCache. L'utilisateur peut surcharger localement
  // une valeur seed si elle est imprécise.
  return {
    year:init?.year||ai?.song_year||null,
    album:init?.album||ai?.song_album||null,
    desc:init?.desc||ai?.song_desc||null,
    key:song?.key||init?.key||ai?.song_key||null,
    bpm:song?.bpm||init?.bpm||ai?.song_bpm||null,
  };
}

export { SONG_PRESETS, INIT_SONG_DB_META, SONG_HISTORY, getSongInfo };
