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
      [/\b(jcm\s?800|jcm800)\b/, 'Marshall JCM800'],
      [/\b(jcm\s?900|jcm900)\b/, 'Marshall JCM900'],
      [/\b(jtm\s?45|jtm45)\b/, 'Marshall JTM45'],
      [/\b(silver\s?jubilee|2555)\b/, 'Marshall Silver Jubilee'],
      [/\b(superlead|super\s?lead|1959)\b/, 'Marshall SL800'],
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
  const finalAmp = (detectedAmp && detectedAmp !== presetName) ? detectedAmp : '';
  return { amp: finalAmp, gain, style, channel };
}
