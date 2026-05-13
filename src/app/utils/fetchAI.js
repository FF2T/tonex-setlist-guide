// src/app/utils/fetchAI.js — Phase 7.14 (découpage main.jsx).
//
// Appel IA pour analyser un morceau et produire une recommandation
// guitare + presets + raisonnement. Provider auto-sélectionné :
// Gemini si une clé Gemini est dispo (perso ou partagée), Anthropic
// sinon. Retry intelligent : si bestScore < 85, relance jusqu'à 2x
// pour garder le meilleur résultat agrégé.
//
// Le prompt embarque :
// - Collection de guitares du rig (Phase 3.6 all-rigs).
// - Feedback historique optionnel (Phase 7.6.1).
// - Mode reco (balanced/faithful/interpretation, Phase 7.2).
// - Bias guitar/style auto+manual (Phase 7.7 + 7.9).
// - Catalogue TMP (Phase 7.10) — l'IA peut renvoyer preset_tmp.
//
// enrichAIResult est appliqué automatiquement après chaque réponse
// brute pour ajouter preset_ann/_plug installés + idéal catalogue.

import { GUITARS } from '../../core/guitars.js';
import { findGuitarProfile } from '../../core/scoring/guitar.js';
import { TMP_FACTORY_PATCHES } from '../../devices/tonemaster-pro/index.js';
import {
  enrichAIResult, mergeBestResults, bestScoreOf, safeParseJSON,
} from './ai-helpers.js';
import { getSharedGeminiKey } from './shared-key.js';

function fetchAI(song, gId, banksAnn, banksPlug, aiProvider, aiKeys, guitars, feedback, availableSources, recoMode, guitarBias) {
  guitars = guitars || GUITARS;
  const g = guitars.find((x) => x.id === gId);
  const gType = g?.type || 'HB';
  const feedbackLine = feedback
    ? `\nREMARQUE IMPORTANTE DE L'UTILISATEUR : "${feedback}". Prends en compte cette remarque pour ajuster ta réponse.`
    : '';
  // Phase 7.2 — Mode reco influence le prompt.
  const modeLine = (() => {
    if (recoMode === 'faithful') return `\nMODE RECO : FIDÈLE À L'ORIGINAL. Ton choix d'ideal_guitar doit privilégier la guitare EXACTEMENT utilisée par l'artiste sur l'enregistrement original. Si l'utilisateur a cette guitare ou une équivalente dans sa collection, choisis-la — même si une autre guitare scorerait mieux par compatibilité tonale pure. Penche le scoring vers la fidélité au matériel d'origine plutôt que vers la versatilité.`;
    if (recoMode === 'interpretation') return `\nMODE RECO : INTERPRÉTATION LIBRE. Ton choix d'ideal_guitar doit privilégier les guitares VERSATILES qui couvrent bien le style du morceau, même si ce n'est pas la guitare originale de l'artiste. Privilégie les instruments polyvalents (semi-hollow type ES-335, SG humbuckers, Stratocaster classique) qui permettent un son juste sans avoir la guitare exacte.`;
    return '';
  })();
  // Phase 7.7 — Bias soft hint depuis les feedbacks.
  const biasLine = (() => {
    if (!guitarBias || typeof guitarBias !== 'object') return '';
    const entries = Object.entries(guitarBias).filter(([, v]) => v && v.guitarName);
    if (entries.length === 0) return '';
    const lines = entries.map(([style, v]) => `- ${style} : ${v.guitarName} (${v.count} morceau${v.count > 1 ? 'x' : ''} feedbacké${v.count > 1 ? 's' : ''})`).join('\n');
    return `\nPRÉFÉRENCES UTILISATEUR (déduites de l'historique de feedback) :\n${lines}\nSi le style du morceau matche une de ces entrées, tiens-en compte sans forcer ton choix.`;
  })();
  // Phase 7.10 — Catalogue TMP exposé pour preset_tmp.
  const tmpCatalogLine = (() => {
    if (!Array.isArray(TMP_FACTORY_PATCHES) || TMP_FACTORY_PATCHES.length === 0) return '';
    const lines = TMP_FACTORY_PATCHES.map((p) => {
      const amp = p.amp?.model || '?';
      const usages = Array.isArray(p.usages) ? p.usages.map((u) => u.artist).filter(Boolean).slice(0, 4).join(', ') : '';
      const usagesPart = usages ? ` — pour ${usages}` : '';
      return `- "${p.name}" : ${amp} (${p.style || '?'}, ${p.gain || '?'} gain)${usagesPart}`;
    }).join('\n');
    return `\nCATALOGUE TMP (Tone Master Pro) — patches factory disponibles :\n${lines}`;
  })();
  const gProfiles = guitars.map((x) => {
    const p = findGuitarProfile(x.id);
    return `- ${x.name} (${x.type}) : ${p ? p.desc : 'profil inconnu'}`;
  }).join('\n');
  const prompt = `Expert guitare ToneX. Réponds TOUJOURS en français.
Morceau : "${song.title}" de "${song.artist}".
Guitare sélectionnée : ${g ? g.name + ' (' + g.type + ')' : 'non précisée'}.

COLLECTION DE GUITARES DISPONIBLES :
${gProfiles}
${feedbackLine}${modeLine}${biasLine}${tmpCatalogLine}
INSTRUCTIONS : Tu dois suivre un raisonnement structuré AVANT de donner ta recommandation. Ce raisonnement DOIT apparaître dans le JSON de sortie.

ÉTAPE 1 – PROFIL TONAL DU MORCEAU
Analyse en détail : artiste, guitare originale utilisée sur l'enregistrement, ampli original, type de gain (clean/crunch/overdrive/high gain), texture sonore (chaud, brillant, mid-heavy, scooped…), style de jeu typique.

ÉTAPE 2 – SCORING GUITARE (sur la collection ci-dessus)
Pour chaque guitare de la collection, évalue la compatibilité avec le profil tonal :
- Type de micro (humbucker / single coil / P90) et adéquation
- Corps et caractéristiques (attaque, sustain, chaleur)
- Référence historique (le guitariste original jouait-il ce type de guitare ?)
Garde uniquement les 2-3 meilleures avec un score sur 100 et une justification courte.

ÉTAPE 3 – PROFIL AMPLI IDÉAL
Identifie le type d'ampli idéal pour reproduire le son de ce morceau :
- Type/famille d'ampli (Marshall Plexi, Fender Blackface, Vox AC30, Mesa Boogie, etc.)
- Niveau de gain approprié
- Caractère tonal (mid-forward, bright, dark, scooped…)

ÉTAPE 4 – SCORE FINAL DU COUPLE GUITARE + AMPLI
Pour la guitare recommandée, calcule un score global de 0 à 100 basé sur ces critères pondérés :
- Adéquation du micro (25%)
- Corps/bois de la guitare (15%)
- Référence historique (30%)
- Adéquation ampli/gain (30%)
Justifie chaque sous-score.

ÉTAPE 5 – CHOIX TMP (Tone Master Pro) — optionnelle
Si un des patches du CATALOGUE TMP ci-dessus convient au morceau, retourne son nom EXACT dans le champ preset_tmp (entre guillemets). Match prioritaire : usages contenant l'artiste ou le morceau > matching style+gain+ampli. Si AUCUN patch ne colle (style trop éloigné, gain mauvais, ampli incompatible), retourne null pour preset_tmp.

Réponds en JSON pur (sans backticks ni markdown). Tous les textes en français :
{"cot_step1":"3-5 phrases analysant le profil tonal du morceau","cot_step2_guitars":[{"name":"nom exact guitare de la collection","score":85,"reason":"1-2 phrases"},{"name":"2e guitare","score":75,"reason":"justification"}],"cot_step3_amp":"2-3 phrases décrivant l'ampli idéal et son caractère tonal","cot_step4_score":{"guitar_score":85,"micro":{"score":90,"reason":"justification"},"body":{"score":80,"reason":"justification"},"history":{"score":95,"reason":"justification"},"amp_match":{"score":85,"reason":"justification"}},"song_year":1970,"song_album":"album","song_desc":"2-3 phrases sur le morceau","song_key":"tonalite du morceau (ex: Em, A, Bb)","song_bpm":120,"song_style":"blues/rock/hard_rock/jazz/metal/pop","target_gain":5,"tonal_school":"fender_clean/marshall_crunch/vox_chime/dumble_smooth/mesa_heavy/hiwatt_clean","pickup_preference":"HB/SC/P90/any","ideal_guitar":"nom complet guitare idéale de la collection","guitar_reason":"1-2 phrases expliquant le choix","settings_preset":"conseils réglage preset","settings_guitar":"conseils de jeu guitare","ref_guitarist":"guitariste original","ref_guitar":"guitare(s) originale(s) (modèle précis)","ref_amp":"ampli(s) original(aux) (modèle précis)","ref_effects":"effets ou 'Aucun effet'","preset_tmp":"nom exact du patch TMP du catalogue OU null si aucun ne convient"}

Champs spéciaux :
- song_key : tonalite du morceau (notation anglaise, ex: Em, A, Bb, F#m)
- song_bpm : tempo en BPM (nombre entier)
- target_gain : 0-10 (0=clean cristallin, 3=edge of breakup, 5=crunch, 7=drive, 9=high gain, 10=metal extrême)
- tonal_school : famille tonale de l'ampli original
- pickup_preference : type de micro idéal
- cot_step2_guitars : guitares choisies UNIQUEMENT dans la collection listée ci-dessus
- ideal_guitar : DOIT être une guitare de la collection ci-dessus`;
  const defaultKey = getSharedGeminiKey();
  const key = aiKeys.gemini || aiKeys.anthropic || defaultKey;
  const provider = (aiKeys.gemini || defaultKey) ? 'gemini' : 'anthropic';
  if (!key) return Promise.reject(new Error('Clé API manquante — configure-la dans ⚙️ Paramètres.'));
  const parse = safeParseJSON;
  const callAI = () => {
    const req = provider === 'gemini'
      ? fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4096 } }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error.message || d.error.status);
          return parse(d.candidates?.[0]?.content?.parts?.[0]?.text || '');
        })
      : fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error.message || d.error.type);
          return parse(d.content?.map((i) => i.text || '').join('') || '');
        });
    return req.then((r) => enrichAIResult(r, gType, gId, banksAnn, banksPlug, availableSources));
  };
  // Retry intelligent : si le meilleur score < 85%, relancer l'IA (max 2 retries).
  const RETRY_THRESHOLD = 85;
  const MAX_RETRIES = 2;
  const tryBest = (currentBest, retries) => {
    if (retries <= 0 || bestScoreOf(currentBest) >= RETRY_THRESHOLD) return Promise.resolve(currentBest);
    return callAI().then((newResult) => tryBest(mergeBestResults(currentBest, newResult), retries - 1)).catch(() => currentBest);
  };
  return callAI().then((first) => tryBest(first, MAX_RETRIES));
}

export default fetchAI;
export { fetchAI };
