// src/app/utils/enrich-pack-ai.js — Phase 7.69.9
//
// Appelle Gemini (ou Anthropic en fallback) pour enrichir une liste
// de noms de presets parsés par parsePackListing avec metadata complète
// (amp/gain/style/channel/scores + usages + ampContext).
//
// "Raccord" avec PacksTab.jsx Vision IA (Phase 7.19) qui faisait le
// même travail mais depuis un screenshot. Ici on part de texte pur.

import { safeParseJSON } from './ai-helpers.js';

/**
 * enrichPackWithAI(presetNames, packName, source, options) → Promise<{ presets, ampContext }>
 *
 * @param {string[]} presetNames - liste de noms parsés depuis listing
 * @param {string} packName - nom du pack
 * @param {string} source - source ID (TSR / AA / JS / etc.)
 * @param {{aiKey, aiProvider}} options - clé API + provider
 *
 * @returns Promise<{
 *   presets: [{name, amp, gain, style, channel, scores: {HB, SC, P90}, usages?: [{artist, songs?}]}],
 *   ampContext: {[amp]: {emoji, refs: [{a, t: []}], desc}}
 * }>
 *
 * Throw Error si appel échoue ou réponse non-parsable.
 */
export async function enrichPackWithAI(presetNames, packName, source, { aiKey, aiProvider = 'gemini' } = {}) {
  if (!aiKey) throw new Error('Clé API manquante');
  if (!Array.isArray(presetNames) || presetNames.length === 0) {
    throw new Error('Aucun preset à enrichir');
  }

  const list = presetNames.map((n, i) => `${i + 1}. ${n}`).join('\n');
  const prompt = `Tu es un expert ToneX et tone modeling guitar. Analyse cette liste de captures (presets ToneX) du pack "${packName}" (source: ${source}).

Pour CHAQUE preset, déduis depuis son nom :
- amp : modèle d'ampli simulé (nom canonique précis, ex: "Marshall JCM800", "Fender '65 Twin Reverb", "Mesa Boogie Mark V", "Dumble Overdrive Special", "Vox AC30", "Soldano SLO-100"). Si tu ne peux pas déduire, mets "Unknown".
- gain : "low" (clean) | "mid" (crunch/drive) | "high" (lead/heavy gain)
- style : "blues" | "rock" | "hard_rock" | "jazz" | "metal" | "pop"
- channel : nom du channel si discernable depuis le naming ("Clean", "Drive", "Lead", "Crunch", "Rhythm", sinon "")
- scores : compatibilité par type de micro {HB: 0-100, SC: 0-100, P90: 0-100} basé sur la connaissance des amps réels. Calibrage :
   - amps high-gain (Mesa, 5150, JCM800) → HB élevé (90-95), SC faible (55-65), P90 mid (70-75)
   - amps clean (Twin, Deluxe Reverb) → SC élevé (85-90), HB mid (70-75), P90 (80)
   - amps crunch (Plexi, AC30, JTM) → équilibrés (80-85)
- usages : artistes/morceaux typiques (OPTIONNEL si tu en es sûr, ex: Marshall JCM800 → Slash/Iron Maiden ; Vox AC30 → Brian May/The Edge). Format [{artist, songs: ["..."]}]. Si tu ne sais pas → [] vide.

Pour CHAQUE ampli UNIQUE dans la liste, génère aussi une fiche descriptive :
- emoji : un emoji représentatif (ex: 🤘 pour metal, 🎸 pour clean, 🔥 pour high-gain)
- refs : [{a: "Artiste", t: ["Morceau1", "Morceau2"]}] (max 3 artistes par amp)
- desc : description courte de l'ampli (2-3 phrases en français, ton informatif)

Presets à analyser :
${list}

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de \`\`\`json) :
{
  "presets": [
    {"name": "...", "amp": "...", "gain": "...", "style": "...", "channel": "...", "scores": {"HB": 85, "SC": 70, "P90": 78}, "usages": [{"artist": "Slash", "songs": ["Sweet Child O' Mine"]}]}
  ],
  "ampContext": {
    "Marshall JCM800": {"emoji": "🤘", "refs": [{"a": "Slash", "t": ["Sweet Child O' Mine"]}], "desc": "Le Marshall JCM800 est l'ampli rock emblématique des années 80..."}
  }
}`;

  let txt = '';
  if (aiProvider === 'gemini' || !aiProvider) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${aiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
      }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message || 'Erreur Gemini');
    txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': aiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message || 'Erreur Anthropic');
    txt = d.content?.map((i) => i.text || '').join('') || '';
  }

  const parsed = safeParseJSON(txt);
  if (!parsed || !Array.isArray(parsed.presets)) {
    throw new Error('Réponse IA non parsable');
  }

  // Sanity : assure que chaque preset a au moins name + scores + style
  const validated = parsed.presets
    .filter((p) => p && p.name && typeof p.name === 'string')
    .map((p) => ({
      name: p.name,
      amp: p.amp || 'Unknown',
      gain: ['low', 'mid', 'high'].includes(p.gain) ? p.gain : 'mid',
      style: ['blues', 'rock', 'hard_rock', 'jazz', 'metal', 'pop'].includes(p.style) ? p.style : 'rock',
      channel: p.channel || '',
      scores: {
        HB: clamp(p.scores?.HB, 0, 100, 75),
        SC: clamp(p.scores?.SC, 0, 100, 75),
        P90: clamp(p.scores?.P90, 0, 100, 75),
      },
      usages: Array.isArray(p.usages) ? p.usages.filter((u) => u && u.artist) : [],
    }));

  return {
    presets: validated,
    ampContext: parsed.ampContext && typeof parsed.ampContext === 'object' ? parsed.ampContext : {},
  };
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
