// src/app/utils/infer-preset.js — Phase 7.19 (découpage main.jsx).
//
// Heuristique d'auto-détection de metadata (amp, gain, style, channel)
// depuis un nom de preset ToneNET libre. Utilisé par :
// - ToneNetTab (pré-remplissage du formulaire d'ajout)
// - PRESET_CATALOG_MERGED (enrichit les presets ToneNET déjà saisis
//   sans amp/style identifiés).

import { AMP_TAXONOMY } from '../../data/data_context.js';
import { inferGainFromName } from '../../core/scoring/style.js';
import { resolveRefAmp } from './ai-helpers.js';

// Anomalie B (retour prod 2026-06-09) : sans mot-clé de gain explicite, le
// défaut « mid » (gainNum 6) est trompeur pour les amplis high-gain.
// On bump via l'école mesa_heavy (toutes variantes Mesa Rectifier/Mark,
// Peavey/EVH 5150, ENGL, Diezel — robuste face aux noms canoniques divers)
// + un set explicite pour les boutiques high-gain de l'école marshall_crunch
// (Friedman BE/HBE, Soldano SLO/GP77). On NE bump PAS les Marshall (JCM/Plexi/
// JTM) ni Bogner (versatile), qui partagent l'école marshall_crunch.
const HIGH_GAIN_AMPS = new Set([
  'Friedman BE-100', 'Friedman HBE', 'Soldano SLO-100', 'Soldano GP77',
]);

export function inferPresetInfo(presetName) {
  if (!presetName || presetName.length < 3) return null;
  const n = presetName.toLowerCase();
  let detectedAmp = resolveRefAmp(presetName);
  if (detectedAmp === presetName || !AMP_TAXONOMY[detectedAmp]) {
    const norm = n.replace(/[^a-z0-9\s]/g, '').trim();
    const TONENET_PATTERNS = [
      [/\b(ac\s?30|ac30)\b/, 'Vox AC30'],
      [/\b(ac\s?15|ac15)\b/, 'Vox AC15'],
      [/\b(twin\s?reverb|twin\s?rev)\b/, 'Fender Twin Silverface'],
      [/\b(blues?\s?junior|blues?\s?jr)\b/, 'Fender Blues Junior'],
      [/\b(deluxe\s?reverb|dlx\s?rev)\b/, 'Fender Deluxe Reverb'],
      [/\b(princeton)\b/, 'Fender Princeton'],
      [/\b(bassman)\b/, 'Fender Tweed Bassman'],
      [/\b(super\s?reverb)\b/, 'Fender Twin Silverface'],
      [/\b(jcm\s?800|jcm800|mars\s?800sl|mars\s?800|marshall\s?800|m800)\b/, 'Marshall JCM800'],
      [/\b(jcm\s?900|jcm900|mars\s?900|marshall\s?900|m900)\b/, 'Marshall JCM900'],
      [/\b(jtm\s?45|jtm45|mars\s?jtm|marshall\s?jtm)\b/, 'Marshall JTM45'],
      [/\b(silver\s?jubilee|2555|mars\s?jubilee|marshall\s?jubilee)\b/, 'Marshall Silver Jubilee'],
      [/\b(superlead|super\s?lead|1959|mars\s?plexi|marshall\s?plexi|plexi)\b/, 'Marshall SL800'],
      [/\b(dual\s?rec|recto|rectifier)\b/, 'Mesa Rectifier'],
      [/\b(mark\s?(iv|4|iic|2c))\b/, 'Mesa Mark IV'],
      [/\b(5150|evh|block\s?letter)\b/, 'Peavey 5150'],
      [/\b(slo|slo.?100)\b/, 'Soldano SLO-100'],
      [/\b(rockerverb|rocker\s?verb)\b/, 'Orange Rockerverb'],
      [/\b(or.?120|orange)\b/i, 'Orange Rockerverb'],
      [/\b(be.?100|friedman)\b/, 'Friedman BE-100'],
      [/\b(bogner|ecstasy)\b/, 'Bogner Ecstasy'],
      [/\b(matchless|dc.?30)\b/, 'Matchless DC30'],
      [/\b(dumble|ods)\b/, 'Dumble ODS'],
      [/\b(two\s?rock)\b/, 'Two Rock Stevie G'],
      [/\b(dr\.?\s?z|carmen\s?ghia)\b/, 'Dr. Z'],
      [/\b(supro)\b/, 'Supro'],
      [/\b(hiwatt|dr.?103)\b/, 'Hiwatt HG100'],
      [/\b(roland\s?jc|jazz\s?chorus)\b/, 'Roland JC-120'],
      [/\b(ampeg|svt)\b/, 'Ampeg SVT'],
      [/\b(diezel|herbert|vh4)\b/, 'Diezel Herbert'],
      [/\b(engl|powerball|savage)\b/, 'ENGL'],
      [/\b(soldano)\b/, 'Soldano SLO-100'],
      [/\b(laney\s?supergroup|supergroup\s?bass|supergroup)/, 'Laney Supergroup'],
      [/\b(laney\s?vh\s?100|vh\s?100)\b/, 'Laney VH100'],
      [/\b(laney\s?vc\s?50|vc\s?50)\b/, 'Laney VC50'],
      [/\b(laney\s?vc\s?30|vc\s?30)\b/, 'Laney VC30'],
      [/\b(laney\s?aor)\b/, 'Laney AOR'],
      [/\b(laney\s?lionheart|laney\s?lion)\b/, 'Laney Lionheart'],
      [/\b(laney)\b/, 'Laney'],
      // Abréviations / codes (banks Anniversary, packs Bogner/Revv…).
      // Retour prod 2026-06-09 anomalie C — ne mapper que vers des amplis
      // présents dans AMP_TAXONOMY (sinon finalAmp reste vide → Unknown).
      [/\bbog\b/, 'Bogner Ecstasy'],
      [/\bmes\b/, 'Mesa Rectifier'],
      [/\bfried\b/, 'Friedman BE-100'],
      [/\bsold\b/, 'Soldano SLO-100'],
      [/\bpv\b/, 'Peavey 5150'],
    ];
    for (const [rx, amp] of TONENET_PATTERNS) {
      if (rx.test(norm)) { detectedAmp = amp; break; }
    }
    if (detectedAmp === presetName || !AMP_TAXONOMY[detectedAmp]) {
      for (const k of Object.keys(AMP_TAXONOMY)) {
        if (norm.includes(k.toLowerCase())) { detectedAmp = k; break; }
      }
    }
  }
  let channel = '';
  const chMatch = n.match(/\b(ch\.?\s*\d|channel\s*\d|clean\s*ch|drive\s*ch|lead\s*ch|crunch\s*ch)/i);
  if (chMatch) channel = chMatch[1].trim();
  const gainNum = inferGainFromName(presetName);
  let finalGainNum = gainNum;
  if (gainNum === 6 && channel) {
    const chLow = channel.toLowerCase();
    if (/clean/i.test(chLow)) finalGainNum = 2;
    else if (/crunch/i.test(chLow)) finalGainNum = 5;
    else if (/drive|od/i.test(chLow)) finalGainNum = 7;
    else if (/lead|high/i.test(chLow)) finalGainNum = 9;
  }
  // Défaut high quand aucun mot-clé de gain n'a tranché (gainNum neutre 6) :
  // école mesa_heavy OU boutique high-gain explicite.
  const ampSchool = AMP_TAXONOMY[detectedAmp]?.school;
  if (finalGainNum === 6 && (ampSchool === 'mesa_heavy' || HIGH_GAIN_AMPS.has(detectedAmp))) finalGainNum = 8;
  const gain = finalGainNum <= 3 ? 'low' : finalGainNum >= 8 ? 'high' : 'mid';
  const SCHOOL_STYLE = { fender_clean: 'blues', marshall_crunch: 'rock', vox_chime: 'rock', dumble_smooth: 'blues', mesa_heavy: 'hard_rock', hiwatt_clean: 'rock', orange_crunch: 'hard_rock', friedman_modern: 'hard_rock', bogner_versatile: 'rock', matchless_chime: 'blues', soldano_lead: 'hard_rock', diezel_modern: 'metal', peavey_heavy: 'metal', two_rock_boutique: 'blues' };
  let style = 'rock';
  if (detectedAmp && AMP_TAXONOMY[detectedAmp]) {
    const school = AMP_TAXONOMY[detectedAmp].school;
    if (school && SCHOOL_STYLE[school]) style = SCHOOL_STYLE[school];
  }
  if (/\bmetal\b|\bheavy\b|\bdjent\b|\bbrutal\b/.test(n)) style = 'metal';
  else if (/\bblues\b/.test(n)) style = 'blues';
  else if (/\bjazz\b/.test(n)) style = 'jazz';
  else if (/\bfunk\b|\bpop\b/.test(n)) style = 'pop';
  // Phase 7.69.8 — fix: utiliser AMP_TAXONOMY comme garde au lieu de
  // detectedAmp !== presetName. L'ancien check stripait l'amp légitime
  // quand le nom du preset coïncidait avec le nom canonique de l'amp
  // (ex: "Marshall JCM800" → match pattern → detectedAmp = "Marshall JCM800"
  // → detectedAmp === presetName → finalAmp = ''). Le bon contrat :
  // un amp est valide ssi présent dans AMP_TAXONOMY.
  const finalAmp = (detectedAmp && AMP_TAXONOMY[detectedAmp]) ? detectedAmp : '';
  return { amp: finalAmp, gain, style, channel };
}
