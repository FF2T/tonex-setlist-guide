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
import { findCatalogEntry } from '../../core/catalog.js';
import {
  enrichAIResult, mergeBestResults, bestScoreOf, safeParseJSON,
} from './ai-helpers.js';
import { getSharedGeminiKey } from './shared-key.js';

// Phase 7.31 — Construit une section "CAPTURES INSTALLÉES" listant les slots
// non vides des banks avec leur metadata catalog (amp/style/gain). Sans ça,
// l'IA ignore les captures user spécifiques (Blink-182 Mesa Boggie, Kirk &
// James Gasoline, etc.) et hallucine un ref_amp générique Marshall/JCM800
// → le résolveur V9 mappe alors sur un mauvais slot.
//
// Phase 7.52.1 — Append `usages` (artiste + morceaux ciblés) à chaque ligne
// quand le catalog entry les fournit (typiquement les 32 entrées AA/JS/TJ/TSR/WT
// Anniversary Premium qui ont des usages explicit). Sans ça, l'IA n'a aucun
// signal pour distinguer une capture générique d'une capture artist-specific
// alors que l'Étape 6 du prompt repose sur cette info.
function formatUsages(usages) {
  if (!Array.isArray(usages) || usages.length === 0) return '';
  const parts = usages.map((u) => {
    if (!u || !u.artist) return null;
    if (Array.isArray(u.songs) && u.songs.length > 0) {
      return `${u.artist} (${u.songs.slice(0, 4).join(', ')})`;
    }
    return u.artist;
  }).filter(Boolean);
  if (!parts.length) return '';
  return ` — usages: [${parts.join('; ')}]`;
}

function buildInstalledSlotsSection(banksAnn, banksPlug) {
  const lines = [];
  const fmt = (bank, col, name) => {
    const info = findCatalogEntry(name);
    if (!info) return null;
    const amp = info.amp || '?';
    const style = info.style || '?';
    const gain = info.gain || '?';
    const src = info.src || '?';
    const usagesPart = formatUsages(info.usages);
    return `- ${bank}${col} "${name}" — ${amp} — ${style} ${gain} gain — src:${src}${usagesPart}`;
  };
  const annLines = [];
  for (const [k, v] of Object.entries(banksAnn || {})) {
    for (const c of ['A', 'B', 'C']) {
      if (v?.[c]) { const l = fmt(k, c, v[c]); if (l) annLines.push(l); }
    }
  }
  const plugLines = [];
  for (const [k, v] of Object.entries(banksPlug || {})) {
    for (const c of ['A', 'B', 'C']) {
      if (v?.[c]) { const l = fmt(k, c, v[c]); if (l) plugLines.push(l); }
    }
  }
  if (!annLines.length && !plugLines.length) return '';
  if (annLines.length) {
    lines.push(`\nCAPTURES INSTALLÉES DANS LES BANKS PEDALE/ANNIVERSARY (50 banks × 3 slots A/B/C) :\n${annLines.join('\n')}`);
  }
  if (plugLines.length) {
    lines.push(`\nCAPTURES INSTALLÉES DANS LES BANKS PLUG (10 banks × 3 slots A/B/C) :\n${plugLines.join('\n')}`);
  }
  lines.push(`\nINSTRUCTION CAPTURES : Si une de ces captures matche le morceau, retourne son nom EXACT dans preset_ann_name (pour Pedale/Anniversary) et preset_plug_name (pour Plug). PRIORITÉ ABSOLUE 1 : capture dont les "usages: [...]" contiennent l'artiste OU le titre du morceau analysé. Ex: pour "Highway to Hell" de AC/DC, choisis le slot dont usages contient "AC/DC" OU "Highway to Hell". PRIORITÉ 2 : capture dont le NOM mentionne explicitement l'artiste/morceau (ex: "Blink-182 Mesa Boggie" pour un morceau Blink-182). PRIORITÉ 3 : capture custom/specialty (src: TSR, ML, custom, ToneNET, Anniversary) dont l'ampli matche l'ampli historique. PRIORITÉ 4 : Factory matching l'ampli. Sinon retourne null pour ces champs et laisse le scoring fallback choisir. RAPPEL Phase 7.34 : une capture avec "usages: [X]" est RÉSERVÉE à l'artiste X — n'utilise PAS "AA MRSH SL100 JU Dimed" (usages Hendrix/Led Zep) pour un morceau qui n'est ni Hendrix ni Led Zep.`);
  return lines.join('\n');
}

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
  // Phase 7.31 — Captures installées dans les banks user (lookup via
  // PRESET_CATALOG_MERGED enrichi de customPacks au mount). Critique pour
  // que l'IA nomme les vrais slots user ("Blink-182 Mesa Boggie" en 48B)
  // au lieu de proposer un nom catalog generic ("Marshall JCM800") qui
  // résoudrait sur le mauvais slot.
  const installedSlotsLine = buildInstalledSlotsSection(banksAnn, banksPlug);
  const gProfiles = guitars.map((x) => {
    const p = findGuitarProfile(x.id);
    return `- ${x.name} (${x.type}) : ${p ? p.desc : 'profil inconnu'}`;
  }).join('\n');
  const prompt = `Expert guitare ToneX. Tu génères les textes en TROIS langues (français, anglais, espagnol) pour permettre à l'app de servir le user dans sa langue préférée.
Morceau : "${song.title}" de "${song.artist}".
Guitare sélectionnée : ${g ? g.name + ' (' + g.type + ')' : 'non précisée'}.

COLLECTION DE GUITARES DISPONIBLES :
${gProfiles}
${feedbackLine}${modeLine}${biasLine}${tmpCatalogLine}${installedSlotsLine}
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

ÉTAPE 6 – CHOIX CAPTURES INSTALLÉES (Pedale/Anniversary + Plug) — optionnelle
Si une capture des listes "CAPTURES INSTALLÉES" ci-dessus matche le morceau, retourne son nom EXACT dans preset_ann_name (pour Pedale/Anniversary) et preset_plug_name (pour Plug). Ordre de priorité STRICT (applique-les dans cet ordre, n'enchaîne au suivant que si l'étape précédente ne donne pas de match) :

**RÈGLE IMPÉRATIVE — Cross-contamination interdite** : Une capture dont le nom mentionne un artiste, un groupe ou un morceau précis (ex : "Blink-182 Mesa Boggie", "Kirk & James - Gasoline v2", "Drain You - Punk", "ACDC - Marshall") est RÉSERVÉE à cet artiste. Tu ne dois JAMAIS proposer "Blink-182 Mesa Boggie" pour un morceau qui n'est pas de Blink-182, même si l'ampli est cohérent. Ces captures sont des profils signature, pas des captures génériques de leur ampli. EXCLUS-les complètement de ta considération pour les autres artistes.

1. **Match artiste/morceau direct** : Cherche dans la liste des captures une dont le nom contient le nom de l'artiste OU un titre de morceau de l'artiste analysé. Ex : pour Blink-182 "All the Small Things", "Blink-182 Mesa Boggie" matche. Pour Metallica "For Whom the Bell Tolls", "Kirk & James - Gasoline" matche (Kirk/James = Metallica). Si trouvé → retourne ce nom dans preset_ann_name/preset_plug_name.

2. **Pas de match artiste → capture custom/specialty générique** : Cherche une capture dont le nom NE MENTIONNE PAS d'artiste/groupe/morceau (donc un nom d'ampli ou de pack neutre type "TSR Mars 800SL Cn1&2 HG", "5150-CAB57-1073", "RECTO-CAB57-1073") avec src custom/TSR/ML/Anniversary/ToneNET et amp matchant l'ampli historique. Ex : pour Iron Maiden Marshall JCM800, "TSR Mars 800SL Cn1&2 HG" matche (générique JCM800 capture studio). Ces captures sont plus authentiques que les Factory.

3. **En dernier recours** : Factory matchant l'ampli ("HG 800", "DR 800", etc.).

Si AUCUNE des 3 étapes ne donne de match, retourne null pour preset_ann_name et preset_plug_name — le scoring fallback choisira.

CONSIGNE DE PHRASING POUR settings_preset ET settings_guitar
Le champ "settings_preset" regroupe des conseils de **personnalisation du preset** pour la guitare et le contexte d'écoute de l'utilisateur — PAS des corrections du preset lui-même. Le preset est considéré comme calibré correctement par son créateur (TSR, ML Sound Lab, Galtone, Amalgam, ToneNET community, IK Multimedia factory, etc.).

À FAIRE dans le phrasing :
- Framer les conseils comme adaptation au matériel de l'utilisateur : "Sur ta guitare, tu peux pousser les mids vers 6 pour compenser…", "Avec ton ampli FRFR, baisse légèrement les aigus pour…"
- Présenter les ajustements comme optionnels et contextuels : "Si ta pièce est très réverbérante, tu peux…", "Pour faire ressortir ton attaque, essaie…"
- Mettre en avant le point de départ qualitatif : "Le preset est déjà très juste pour ce morceau. Tu peux affiner avec…"

À ÉVITER ABSOLUMENT :
- "Corrige les basses du preset à 4", "Le preset gagne à avoir les mids à 6" (sous-entend défaut)
- "Le preset manque de chaleur" / "trop scoopé" / "trop fort en aigus" (critique directe)
- Toute formulation qui pourrait être lue comme un défaut du capture par son créateur.

Idem pour "settings_guitar" : ce sont des conseils de jeu et d'utilisation des contrôles guitare (volume, tone, micros, attaque, palm muting…), pas des corrections de la guitare elle-même.

CONSIGNE DE REGISTRE (Phase 7.50) — IMPÉRATIVE :
Tutoie systématiquement l'utilisateur dans TOUS les champs texte (cot_step1, cot_step3_amp, song_desc, guitar_reason, settings_preset, settings_guitar, cot_step2_guitars[].reason, cot_step4_score.*.reason).
- FR : utilise "tu", "ta", "ton", "tes", "te". JAMAIS "vous", "votre", "vos". Verbes à la 2e personne du singulier informel (ex : "essaie", "pousse", "garde", "mets"). PAS "essayez", "poussez", "gardez", "mettez".
- EN : utilise "you", "your" en registre informel (le tutoiement informel anglais étant identique au formel grammaticalement, garde un ton conversationnel et direct, pas trop formel).
- ES : utilise "tú", "tu", "tus", "te" (tuteo informal). JAMAIS "usted", "su", "sus". Verbes en 2e personne du singulier : "prueba", "empuja", "mantén", "pon". PAS "pruebe", "empuje", "mantenga", "ponga".

À ÉVITER ABSOLUMENT : tout mélange tu/vous dans une même phrase (ex : "Tu peux pousser les mids ; réglez le volume à 5" est interdit — doit être "Tu peux pousser les mids ; règle le volume à 5").

OUTPUT TRILINGUE — Format des champs texte :
Les champs marqués "TEXTE TRILINGUE" ci-dessous DOIVENT être un objet à 3 clés {"fr":"...","en":"...","es":"..."} avec la même information traduite dans chaque langue. Garde le sens et le niveau de détail constant entre les 3 versions. Les NOMS PROPRES (noms d'artistes, modèles d'amplis "Marshall JCM800", noms de guitares "Stratocaster '62", titres de morceaux) restent identiques dans les 3 langues. Les autres champs (noms, scores numériques, énums) restent des valeurs scalaires.

Réponds en JSON pur (sans backticks ni markdown) :
{"cot_step1":{"fr":"3-5 phrases analysant le profil tonal","en":"3-5 sentences analyzing the tonal profile","es":"3-5 frases analizando el perfil tonal"},"cot_step2_guitars":[{"name":"nom exact guitare","score":85,"reason":{"fr":"justification","en":"justification","es":"justificación"}},{"name":"2e guitare","score":75,"reason":{"fr":"...","en":"...","es":"..."}}],"cot_step3_amp":{"fr":"2-3 phrases","en":"2-3 sentences","es":"2-3 frases"},"cot_step4_score":{"guitar_score":85,"micro":{"score":90,"reason":{"fr":"...","en":"...","es":"..."}},"body":{"score":80,"reason":{"fr":"...","en":"...","es":"..."}},"history":{"score":95,"reason":{"fr":"...","en":"...","es":"..."}},"amp_match":{"score":85,"reason":{"fr":"...","en":"...","es":"..."}}},"song_year":1970,"song_album":"album","song_desc":{"fr":"2-3 phrases","en":"2-3 sentences","es":"2-3 frases"},"song_key":"Em","song_bpm":120,"song_style":"blues/rock/hard_rock/jazz/metal/pop","target_gain":5,"tonal_school":"fender_clean/marshall_crunch/vox_chime/dumble_smooth/mesa_heavy/hiwatt_clean","pickup_preference":"HB/SC/P90/any","ideal_guitar":"nom complet guitare idéale","guitar_reason":{"fr":"...","en":"...","es":"..."},"settings_preset":{"fr":"conseils","en":"settings","es":"ajustes"},"settings_guitar":{"fr":"conseils de jeu","en":"playing tips","es":"consejos de juego"},"ref_guitarist":"guitariste","ref_guitar":"modèle guitare","ref_amp":"modèle ampli","ref_effects":"effets ou 'Aucun effet'","preset_tmp":"nom exact patch TMP OU null","preset_ann_name":"nom EXACT capture OU null","preset_plug_name":"nom EXACT capture OU null"}

Champs TEXTE TRILINGUE (à fournir en {fr, en, es}) :
- cot_step1, cot_step3_amp, song_desc, guitar_reason, settings_preset, settings_guitar
- cot_step2_guitars[].reason
- cot_step4_score.{micro,body,history,amp_match}.reason

Champs SCALAIRES (valeur unique, pas d'objet) :
- song_year (number), song_album (string nom album), song_key (string notation), song_bpm (number)
- song_style, target_gain, tonal_school, pickup_preference : ENUMS
- ideal_guitar, ref_guitarist, ref_guitar, ref_amp : NOMS PROPRES (pas de traduction)
- ref_effects : nom des effets en anglais ou null/'Aucun effet'
- preset_tmp, preset_ann_name, preset_plug_name : noms exacts depuis listes fournies
- cot_step2_guitars[].name (string), .score (number)
- cot_step4_score.guitar_score (number), .{micro,body,history,amp_match}.score (number)

Contraintes :
- cot_step2_guitars : guitares UNIQUEMENT dans la collection listée
- ideal_guitar : DOIT être une guitare de la collection
- song_key : notation anglaise (Em, A, Bb, F#m)
- target_gain : 0-10`;
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
