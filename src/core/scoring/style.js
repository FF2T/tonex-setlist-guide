// src/core/scoring/style.js — extrait verbatim depuis main.jsx.
// Tranches de gain (clean/crunch/drive/high_gain), helpers de conversion
// gain numérique ↔ label, et compatibilité de style 6×6.

// Tranches de gain
const GAIN_RANGES={clean:{min:0,max:3},crunch:{min:4,max:6},drive:{min:7,max:8},high_gain:{min:9,max:10}};
function getGainRange(gain){
  if(typeof gain==="number") return gain<=3?"clean":gain<=6?"crunch":gain<=8?"drive":"high_gain";
  return gain==="low"?"clean":gain==="high"?"high_gain":"crunch";
}
function gainToNumeric(gain){
  if(typeof gain==="number") return gain;
  return gain==="low"?2:gain==="high"?9:6;
}
function inferGainFromName(name){
  if(!name) return 6;
  const n=name.toLowerCase();
  if(/\bclean\b|\bcln\b/.test(n)) return 2;
  if(/\bedge\b|\bcrunch\b|\bbloom cln\b/.test(n)) return 5;
  if(/\bdrive\b|\bod\b|\bklon\b|\bkot\b|\bduellist\b/.test(n)) return 7;
  if(/\blead\b|\bdimed\b|\bmuff\b|\bhigh\b|\bfull beans\b/.test(n)) return 9;
  return 6;
}

// Compatibilité de style (score 0-100)
const STYLE_COMPATIBILITY={
  blues:    {blues:100,rock:60,hard_rock:30,jazz:70,metal:10,pop:55},
  rock:     {blues:55,rock:100,hard_rock:75,jazz:20,metal:40,pop:60},
  hard_rock:{blues:25,rock:70,hard_rock:100,jazz:10,metal:65,pop:20},
  jazz:     {blues:65,rock:15,hard_rock:5,jazz:100,metal:5,pop:30},
  metal:    {blues:10,rock:35,hard_rock:60,jazz:5,metal:100,pop:10},
  pop:      {blues:50,rock:60,hard_rock:20,jazz:35,metal:10,pop:100}
};

function computeStyleMatchScore(presetStyle,songStyle){
  if(!songStyle) return null;
  return STYLE_COMPATIBILITY[presetStyle]?.[songStyle]??30;
}

export { GAIN_RANGES, getGainRange, gainToNumeric, inferGainFromName, STYLE_COMPATIBILITY, computeStyleMatchScore };
