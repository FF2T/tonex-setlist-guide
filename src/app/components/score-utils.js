// src/app/components/score-utils.js — Phase 1, étape 5.
// Helpers UI partagés pour l'affichage des scores : couleurs (vert/bleu/
// jaune/rouge), backgrounds, label + tooltip. Extrait verbatim depuis
// main.jsx.
// Seuils V2 : 80+ excellent, 65+ bon, 50+ acceptable, <50 mauvais.

function scoreColor(s){return s>=80?"var(--green)":s>=65?"var(--blue)":s>=50?"var(--yellow)":"var(--red)";}
function scoreBg(s){return s>=80?"var(--green-bg)":s>=65?"var(--blue-bg)":s>=50?"var(--yellow-bg)":"var(--red-bg)";}
function scoreLabel(s){return s>=80?{t:"Excellent",tip:"Preset très adapté à ce morceau"}:s>=65?{t:"Bon",tip:"Preset convenable pour ce morceau"}:s>=50?{t:"Moyen",tip:"Ça dépanne, mais un meilleur preset existe"}:{t:"Faible",tip:"Preset peu adapté à ce morceau"};}
const BREAKDOWN_LABELS={pickup:"Micro",guitar:"Guitare",gainMatch:"Gain",refAmp:"Ampli",styleMatch:"Style"};

export { scoreColor, scoreBg, scoreLabel, BREAKDOWN_LABELS };
