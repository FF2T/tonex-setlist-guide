// src/app/utils/amp-context.js
//
// Résolution d'un nom d'ampli → entrée PRESET_CONTEXT (data_context.js)
// avec ses refs artistes/morceaux, émoji, description. Tolère les noms
// volontairement déformés (trademark avoidance) via une table d'alias,
// les combos "Ampli + Pédale", et un fallback fuzzy par substring.
//
// Extrait de PresetBrowser (Phase 9.8.23) pour réutilisation par l'écran
// Évaluer (simulation d'usages : pré-remplissage depuis les refs ampli).

import { PRESET_CONTEXT } from '../../data/data_context.js';

const ALIASES = {
  'Cornfield Harle': 'Cornford Harlequin',
  'Reinguard T-36': 'Reinhardt RT-36',
  'Diesel Humbert': 'Diezel Herbert',
  'Electro Dime': 'Electro-Harmonix',
  'Chandler GAV19T': 'Benson Chimera',
  'Chandler 19T': 'Benson Chimera',
  'Bumble Deluxe': 'Dumble Deluxe',
  'Rouge Plate D50': 'Dr. Z',
  'Sons Amplification': 'Sons Amp',
  'Mega Barba': 'Mesa Boogie',
  'Ample Betty': 'Supro',
  'Amplified Nation Overdrive Reverb': 'Dumble ODS',
  'Amplified Nation Wonderland Overdrive': 'Dumble ODS',
  'Bogner Goldfinger': 'Bogner G-Finger',
  'Dumble Overdrive Deluxe': 'Dumble Deluxe',
  'Mega Amp': 'Mesa Boogie',
  'Synergy SYN-30': 'Fender Champ',
  'Suhr PT-100 / 2864-S': 'Marshall Plexi',
  'Divers British': 'Marshall Plexi',
  'Divers basse': 'Ampeg SVT',
  'Divided by 13': 'Divided by 13',
  'Pédales de drive': 'Drive Pedals',
};

export function findAmpContext(ampName, ctxMap) {
  if (!ampName) return null;
  const ctx = ctxMap || PRESET_CONTEXT;
  if (ctx[ampName]) return ctx[ampName];
  if (ALIASES[ampName] && ctx[ALIASES[ampName]]) return ctx[ALIASES[ampName]];
  if (ampName.includes(' + ')) {
    const baseAmp = ampName.split(' + ')[0].trim();
    const baseCtx = findAmpContext(baseAmp, ctx);
    if (baseCtx) return baseCtx;
  }
  const norm = ampName.replace(/\s+/g, ' ').trim();
  const variations = [
    norm.replace('Mesa Boogie ', 'Mesa '),
    norm.replace('Mesa ', 'Mesa Boogie '),
    norm.replace('Marshall ', 'Mars '),
    norm.replace('Mars ', 'Marshall '),
    norm.replace('Fender ', 'FNDR '),
    norm.replace('FNDR ', 'Fender '),
  ];
  for (const v of variations) { if (ctx[v]) return ctx[v]; }
  const lower = norm.toLowerCase();
  for (const [k, v] of Object.entries(ctx)) {
    if (k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) return v;
  }
  return null;
}

// Convertit les refs d'un ampli ([{a, t}]) en usages [{artist, songs}]
// exploitables par usagesMatchSong. Le champ `a` est souvent
// "Guitariste (Groupe)" → on émet 2 entrées (lead + groupe) pour maximiser
// le match (song.artist = groupe OU ref_guitarist = lead). Éditable ensuite.
export function refsToUsages(refs) {
  if (!Array.isArray(refs)) return [];
  const out = [];
  for (const r of refs) {
    if (!r?.a) continue;
    const songs = Array.isArray(r.t) ? r.t.slice() : [];
    const m = String(r.a).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m) {
      const lead = m[1].trim();
      const band = m[2].trim();
      if (lead) out.push({ artist: lead, songs });
      if (band && band.toLowerCase() !== lead.toLowerCase()) out.push({ artist: band, songs: songs.slice() });
    } else {
      out.push({ artist: String(r.a).trim(), songs });
    }
  }
  return out;
}
