// src/app/components/GuitarSilhouette.jsx — Phase 1, étape 5.
// Affiche une silhouette SVG de la guitare (LP/SG/ES-335/Strat/Tele/JM)
// avec coloration via filter CSS selon l'id de la guitare.
//
// Phase 1 fix : les SVG sont importés en ES module pour que Vite (via
// vite-plugin-singlefile + assetsInlineLimit grand) les inline en
// data-URI dans le bundle final. Avant le fix, <img src="lespaul.svg">
// pointait vers un asset qui n'était pas embarqué dans dist/ — les
// silhouettes apparaissaient brisées en prod.

import React from 'react';
import lespaulSvg from '../../assets/lespaul.svg';
import sgSvg from '../../assets/sg.svg';
import es335Svg from '../../assets/es335.svg';
import stratSvg from '../../assets/strat.svg';
import teleSvg from '../../assets/tele.svg';
import jazzmasterSvg from '../../assets/jazzmaster.svg';

function GuitarSilhouette({id,size}){
  var s=size||40;
  var n=(id||"").toLowerCase();
  var file=lespaulSvg;
  if(n.includes("sg")) file=sgSvg;
  else if(n.includes("es-335")||n.includes("es335")||n.includes("335")) file=es335Svg;
  else if(n.includes("strat")) file=stratSvg;
  else if(n.includes("tele")) file=teleSvg;
  else if(n.includes("jazz")||n.includes("jazzmaster")) file=jazzmasterSvg;
  var gc={lp60:"cherry",lp50p90:"gold",sg_ebony:"black",sg61:"cherry",es335:"cherry",strat61:"red",strat_pro2:"cherry",strat_ec:"black",tele63:"green",tele_ultra:"black",jazzmaster:"blue"};
  var gf={red:"brightness(0) saturate(100%) invert(20%) sepia(85%) saturate(5500%) hue-rotate(350deg) brightness(95%) contrast(105%)",gold:"brightness(0) saturate(100%) invert(55%) sepia(50%) saturate(700%) hue-rotate(15deg) brightness(90%) contrast(85%)",green:"brightness(0) saturate(100%) invert(35%) sepia(30%) saturate(400%) hue-rotate(95deg) brightness(75%) contrast(90%)",blue:"brightness(0) saturate(100%) invert(25%) sepia(40%) saturate(900%) hue-rotate(200deg) brightness(75%) contrast(95%)",cherry:"brightness(0) saturate(100%) invert(15%) sepia(60%) saturate(2200%) hue-rotate(355deg) brightness(60%) contrast(105%)",sunburst:"invert(1) sepia(1) saturate(2) hue-rotate(350deg) brightness(0.9)",black:"invert(0.3)",beige:"invert(1) sepia(0.3) saturate(0.5) hue-rotate(10deg) brightness(1.1)"};
  var color=gc[id];
  if(!color&&n.includes("tele")&&/\b5[01]\b/.test(n)) color="beige";
  var f=gf[color]||"invert(1) brightness(1.2)";
  return <img src={file} alt="" style={{width:s*1.6,height:s,objectFit:"contain",filter:f,opacity:1}}/>;
}

export default GuitarSilhouette;
