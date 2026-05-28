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
import { findCatalogEntry, isBassPreset } from '../../core/catalog.js';
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
  // Phase 8.8 — filtre out captures bass (extraites par
  // buildBassSlotsSection séparément). Évite que Gemini propose un
  // preset bass pour un morceau guitare (et vice-versa).
  const fmt = (bank, col, name) => {
    const info = findCatalogEntry(name);
    if (!info) return null;
    if (isBassPreset(name, info)) return null;
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

// Phase 8.8 — Section dédiée captures BASS installées dans les banks
// user. Symétrique à buildInstalledSlotsSection mais filtré
// isBassPreset === true. Utilisé par ÉTAPE 8 du prompt pour permettre
// à Gemini de retourner bass_recommendation.capture_name + position
// bank/slot quand pertinent (vs n'avoir que amp_settings traditionnel).
function buildBassSlotsSection(banksAnn, banksPlug) {
  const fmt = (bank, col, name) => {
    const info = findCatalogEntry(name);
    if (!info) return null;
    if (!isBassPreset(name, info)) return null;
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
  const lines = [];
  if (annLines.length) {
    lines.push(`\nCAPTURES BASS INSTALLÉES DANS LES BANKS PEDALE/ANNIVERSARY :\n${annLines.join('\n')}`);
  }
  if (plugLines.length) {
    lines.push(`\nCAPTURES BASS INSTALLÉES DANS LES BANKS PLUG :\n${plugLines.join('\n')}`);
  }
  lines.push(`\nINSTRUCTION CAPTURES BASS : Si une de ces captures bass matche la ligne de basse du morceau, retourne son nom EXACT dans bass_recommendation.capture_name (ÉTAPE 8). Priorités identiques aux captures guitar (usages > nom mentionnant artiste > custom matchant ampli > Factory matchant ampli). Si aucune capture bass installée n'est pertinente OU si le user joue préférablement sur ampli traditionnel (Rumble, Ampeg SVT physique), laisse capture_name à null et utilise uniquement amp_settings.`);
  return lines.join('\n');
}

function fetchAI(song, gId, banksAnn, banksPlug, aiProvider, aiKeys, guitars, feedback, availableSources, recoMode, guitarBias, outputContext, preferredStyles, basses, bassAmps) {
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
  // Phase 10 v2 — Contexte d'écoute simplifié (3 valeurs). Informe l'IA
  // du matériel d'écoute pour adapter ses conseils EQ et volume. Le
  // toggle cab_enabled est désormais indépendant : décidé par l'IA selon
  // la CAPTURE qu'elle choisit (preset_ann_name / preset_plug_name) —
  // si la capture inclut un cab modélisé (AMP+CAB) → CAB OFF dans la
  // pédale, sinon (AMP-only) → CAB ON.
  const outputContextLine = (() => {
    if (!outputContext) return '';
    const map = {
      headphone:  'casque (CASQUE), via la sortie casque de la pédale. Conseil d\'EQ : tu peux modérer légèrement les aigus pour le confort d\'écoute prolongée',
      frfr:       'enceinte FRFR neutre amplifiée (Headrush / Friedman ASM / Powercab+ / ToneX Cab). Restitution fidèle de la capture',
      pa:         'système de sonorisation ou table de mixage via DI. La table de mixage attend un signal prêt à mixer, donc évite les conseils qui ajoutent trop de basses ou de réverbération',
    };
    const desc = map[outputContext] || '';
    if (!desc) return '';
    return `\nCONTEXTE D'ÉCOUTE : l'utilisateur joue sur ${desc}. Adapte tes conseils settings_preset (EQ, volume) en conséquence.`;
  })();
  // Phase 7.73.2 Session A — Préférences musicales du user (multi-select
  // depuis profile.preferredStyles). Soft hint contextuel : signale à
  // l'IA quels styles le user joue le plus souvent. Ne pas filtrer dur
  // (chaque morceau garde son scoring spécifique selon son style).
  const preferredStylesLine = (() => {
    if (!Array.isArray(preferredStyles) || preferredStyles.length === 0) return '';
    const STYLE_LABELS = {
      blues: 'blues', rock: 'rock', hard_rock: 'hard rock',
      jazz: 'jazz', metal: 'metal', pop: 'pop',
    };
    const labels = preferredStyles.map((s) => STYLE_LABELS[s] || s).join(', ');
    return `\nPRÉFÉRENCES MUSICALES USER : tu joues principalement ${labels}. Soft hint contextuel — utile pour ajuster le ton de tes conseils (ex. analogies dans cot_step1, références d'autres morceaux du même style). Ne filtre PAS le scoring du morceau actuel selon ces préférences (le morceau garde son style spécifique).`;
  })();
  // Phase 8.4 — Intégration basse. Si l'utilisateur a au moins 1 basse
  // OU 1 ampli basse traditionnel, active la section "RECOMMANDATION
  // BASSE". L'IA détermine elle-même si le morceau a une ligne de basse
  // notable (sa connaissance du catalogue musical historique). Si le
  // morceau n'a pas de ligne de basse mémorable (ex. solo guitare
  // acoustique), elle retourne bass_recommendation: null.
  const hasBassContext = (Array.isArray(basses) && basses.length > 0)
    || (Array.isArray(bassAmps) && bassAmps.length > 0);
  const bassContextLine = (() => {
    if (!hasBassContext) return '';
    const bassesList = (basses || []).map((b) => `- ${b.name} (${b.type}, ${b.brand})`).join('\n');
    const ampsList = (bassAmps || []).map((a) => `- ${a.name} (${a.brand}, ${a.wattage}W, channels: ${(a.channels || []).join('/')}, EQ: ${(a.eq || []).join('/')})`).join('\n');
    // Phase 8.8 — captures BASS installées dans les banks user (Factory
    // banks 45-49 BS prefix + TSR bass packs + custom user instrument:'bass').
    const bassSlotsSection = buildBassSlotsSection(banksAnn, banksPlug);
    const sections = [];
    if (bassesList) sections.push(`COLLECTION DE BASSES DISPONIBLES :\n${bassesList}`);
    if (ampsList) sections.push(`AMPLIS BASSE TRADITIONNELS DISPONIBLES :\n${ampsList}`);
    let body = sections.join('\n\n');
    if (bassSlotsSection) body += '\n' + bassSlotsSection;
    return `\n${body}\n\nL'utilisateur joue aussi la basse — RETOURNE TOUJOURS un objet bass_recommendation (jamais null). Recommande quelle basse de sa collection + quel matériel basse utiliser, peu importe si le morceau a une ligne de basse iconique ou de simple support. Pour les morceaux où la basse est purement support (rock standard), choisis la basse la plus polyvalente du rig et propose des réglages cohérents avec le style.`;
  })();
  const gProfiles = guitars.map((x) => {
    const p = findGuitarProfile(x.id);
    return `- ${x.name} (${x.type}) : ${p ? p.desc : 'profil inconnu'}`;
  }).join('\n');
  const prompt = `Expert guitare ToneX. Tu génères les textes en TROIS langues (français, anglais, espagnol) pour permettre à l'app de servir le user dans sa langue préférée.
Morceau : "${song.title}" de "${song.artist}".
Guitare sélectionnée : ${g ? g.name + ' (' + g.type + ')' : 'non précisée'}.

COLLECTION DE GUITARES DISPONIBLES :
${gProfiles}
${feedbackLine}${modeLine}${biasLine}${tmpCatalogLine}${installedSlotsLine}${outputContextLine}${preferredStylesLine}${bassContextLine}
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

ÉTAPE 7 – PARAMÉTRAGE DU PRESET (preset_settings_v1) — IMPORTANT
La capture (TONE MODEL) est une boîte noire immuable fournie par son créateur. Ce qui est ajustable autour, dans le PRESET TONEX : les EQ post-capture (BASS/MID/TREBLE/PRESENCE/DEPTH), le volume preset, le seuil du compresseur, le seuil du noise gate, le mix de reverb, et l'activation du bloc CAB. Tous identiques sur ToneX Pedal classique, Anniversary, Plug, One, One+.

CONTEXTE CRUCIAL — Capture vs réglages post-capture (Phase 9.7.1) :
La capture TONEX (TONE MODEL AMP+CAB) contient DÉJÀ FIGÉS les réglages physiques de l'ampli original AU MOMENT de la capture (potards de gain/bass/mid/treble/presence du vrai ampli physique, type/distance/axis du micro, position du cab, etc.). Le créateur de pack (TSR, AA, JS, etc.) a calibré ces réglages POUR QUE LA CAPTURE SONNE BIEN telle quelle — c'est son métier.

Les boutons preset_settings_v1 que tu retournes sont des SETTINGS POST-CAPTURE qui s'additionnent ou compensent PAR-DESSUS la capture, dans le firmware TONEX. Ils ne touchent PAS aux potards de l'ampli physique (gravés dans le ML model).

Tu NE CONNAIS PAS le profil tonal interne de la capture choisie (mid-heavy ? scooped ? bright ? compressed déjà ?). Donc :
- Privilégie des valeurs de POINT DE DÉPART NEUTRES proches du défaut (5/5/5/5/5 pour main, 5/5/15/-20/-60 pour alt) sauf si le morceau requiert clairement un boost ou cut spécifique (ex : mid pop-funk +1, gate metal sévère).
- Évite les valeurs extrêmes (ex : Mid 9, Treble 9, Bass 1) qui supposent que la capture est neutre alors qu'elle est déjà typée par son créateur.
- Le user affinera à l'oreille via les tweaks (ÉTAPE 7C — "Si trop boomy → Bass -0.5"). C'est là que se fait le vrai dialing empirique.
- Ton rôle : poser un POINT DE DÉPART RAISONNABLE adapté au style/contexte d'écoute/guitare, pas reproduire à la perfection le son original (qui dépend de la capture choisie, hors de ton contrôle).

Retourne un objet preset_settings_v1 avec les valeurs POINT DE DÉPART pour reproduire le son du morceau sur la guitare et le contexte d'écoute du user. Respecte STRICTEMENT les ranges ci-dessous (toute valeur hors-bornes sera clampée et émettra un warning).

CHAQUE knob doit être un OBJET {value, why} avec :
- value : nombre dans le range officiel
- why : objet TRILINGUE {"fr":"...","en":"...","es":"..."} contenant UNE phrase courte (10-15 mots max) expliquant ce choix précis pour ce morceau (Phase 7.86)

{
  "cab_enabled": true,                       // TOUJOURS true sur les 3 contextes d'écoute (frfr/headphone/pa) — pas de cab physique aval, donc le bloc CAB du firmware doit rester ON pour entendre la capture complète. Toute valeur false sera overridée à true côté validation.
  "main": {
    "gain":   {"value": 0 à 10, "why": {"fr":"...","en":"...","es":"..."}},   // gain d'entrée du TONE MODEL
    "bass":   {"value": 0 à 10, "why": {...}},                                 // EQ shelf basses
    "mid":    {"value": 0 à 10, "why": {...}},                                 // EQ bell mediums
    "treble": {"value": 0 à 10, "why": {...}},                                 // EQ shelf aigus
    "volume": {"value": 0 à 10, "why": {...}}                                  // volume du preset
  },
  "alt": {
    "presence":       {"value": 0 à 10, "why": {...}},                         // hautes fréquences
    "depth":          {"value": 0 à 10, "why": {...}},                         // basses fréquences (profondeur)
    "reverb_mix":     {"value": 0 à 100, "why": {...}},                        // % mix reverb (0 = sec, 100 = wash)
    "comp_threshold": {"value": -40 à 0, "why": {...}},                        // dB (0 = off-ish, -20 = compression sensible)
    "gate_threshold": {"value": -100 à 0, "why": {...}}                        // dB (-100 = quasi-off, -50 = gate sévère metal)
  },
  "why": {"fr":"...","en":"...","es":"..."}, // RÉSUMÉ global 1-2 phrases TRILINGUE (en complément des why per-knob)
  "tweaks": [                                // Phase 9.4 — MIN 3, MAX 8 ajustements empiriques
    {                                        // post-écoute, SPÉCIFIQUES à ce morceau/style/contexte
      "symptom": {"fr":"...","en":"...","es":"..."}, // 3-6 mots TRILINGUE
      "fix": "Treble -0.5 + Presence -0.3"            // 1-2 paramètres, format universel
    }
  ]
}

Exemples de why per-knob (Chop Suey thrash) :
- gain.why : {"fr":"Mesa déjà saturé, 6.2 préserve la dynamique","en":"Mesa already saturated, 6.2 keeps dynamics","es":"Mesa ya saturado, 6.2 mantiene dinámica"}
- gate_threshold.why : {"fr":"Palm mutes secs, gate sévère pour silence","en":"Dry palm mutes, severe gate","es":"Palm mutes secos, gate severo"}

CONSIGNE TWEAKS (Phase 9.4 + 9.4.1) — "ONE TWEAK TO FIX IT"
Génère ENTRE 3 ET 8 tweaks (ajustements empiriques post-écoute) spécifiques à ce morceau, ce style et ce contexte. Le MINIMUM est 3 — jamais moins, même si tu juges que peu de symptoms s'appliquent à ce morceau précis. Pour atteindre 3, complète avec les symptoms cross-cutting (boomy, brillant, noyé dans mix, manque chaleur) toujours pertinents. Pas une canned list générique — adapte chaque tweak au contexte (gain, style, type de pickup, contexte d'écoute).

Format de chaque tweak :
- symptom : objet TRILINGUE {"fr":"...","en":"...","es":"..."}. 3-6 mots décrivant un défaut perçu APRÈS écoute (ex : "trop brillant sur FRFR", "noyé dans le mix groupe", "pas assez tight pour les palm mutes", "trop fizzy en high gain", "boomy sur cab guitare", "manque de chaleur dans le solo")
- fix : STRING courte au format universel "Param ±N" ou "Param ±N + Param ±N" (ex : "Treble -0.5 + Presence -0.3", "Mid +0.5 + Volume +0.3", "Gain -0.3 + Gate threshold -10dB"). Pas de prose, pas de traduction (les noms de paramètres sont universels). Préfère les ajustements par 0.3 ou 0.5 (pas par 1.0 entier — trop brutal).

Adaptation au contexte attendue :
- thrash/metal high gain → tweaks autour de Gate threshold, Gain, Presence (fizzy)
- blues clean → tweaks autour de Reverb mix, Comp threshold, Mid
- FRFR (vs cab physique) → tweaks autour de Treble/Presence (compense l'absence de filtrage cab)
- pickups SC (vs HB) → tweaks autour de Mid/Volume (compense moins de signal de sortie)

À ÉVITER :
- Tweaks génériques recyclés (ex : "Si trop brillant → Treble -1" pour TOUS les morceaux sans contexte). Adapte au cas concret.
- Format prose dans le fix (ex : "Baisse un peu les aigus" — non, écrire "Treble -0.5").
- Ajustements trop brutaux (-1.0 ou plus). Préfère 0.3-0.5 sauf justification claire.

Règles :
- cab_enabled : retourne TOUJOURS true sur les 3 contextes d'écoute (frfr / headphone / pa). Le bloc CAB du firmware ToneX doit rester ON dans tous les cas couverts (pas de cab physique aval = pas de risque de double-cab). Toute valeur false sera overridée à true côté validation JS.
- Valeurs nominales par défaut : main 5/5/5/5/5, alt 5/5/15/-20/-60 si pas de contrainte spécifique
- why per-knob : OBLIGATOIRE pour chaque knob. Phrase courte (10-15 mots max) TRILINGUE qui justifie ce choix précis pour ce morceau (pas une phrase générique). Si le knob est sa valeur par défaut, explique pourquoi le défaut convient ici (ex : "Valeur neutre — pas d'ajustement nécessaire pour ce style").
- Adapte aux contraintes du morceau : thrash → gate sévère (-50 dB) + reverb_mix bas (<15%) + mid haut ; blues → comp doux + reverb modérée (20-35%) ; clean → volume preset 6-7 + comp doux + mid 5-6
- Le "why" résume EN UNE OU DEUX PHRASES TRILINGUE les choix faits (ex : "Thrash dry — gate sévère pour les palm mutes, mid scoopé léger, reverb minimale"). Pas une explication par paramètre.
- Si tu ne peux pas justifier une valeur (incertitude), retourne le default (5/5/5/5/5 + 5/5/15/-20/-60).

ÉTAPE 7B – PLAYING HINTS (Phase 9.5) — conseils de jeu structurés
Retourne un objet playing_hints AVEC LES 4 CHAMPS scalaires courts qui complètent settings_guitar (prose) en donnant des valeurs cibles directement utilisables.

{
  "pickup": "Bridge" / "Neck" / "Middle" / "Position 2 (Neck+Middle)" / "Position 4 (Middle+Bridge)" / "Bridge+Neck (both)", // string adaptée à la guitare réelle (Strat 5-positions vs LP 3-positions vs HSS vs P-90 single, etc.)
  "guitar_volume": "8-10" / "10 (full)" / "6-8" / "switch 7→10",          // range ou consigne courte
  "guitar_tone": "10 (open)" / "7-9" / "5-7" / "switch 10→6 for verses",  // range ou consigne courte
  "stereo": false                                                          // true UNIQUEMENT si setup stereo réellement recommandé (rare ; ex. ambient avec delay ping-pong). false par défaut.
}

Règles :
- pickup : adapte au type de guitare proposé en ideal_guitar. Si HSS Strat → Position 2-4 ou Bridge. Si LP HH → Neck ou Bridge. Si P-90 SC → Neck (clarté) ou Bridge (mordant). Pas de pickup hardcodé si la guitare n'a pas cette position.
- guitar_volume : range plutôt que valeur unique (ex "8-10" plutôt que "9"). "10 (full)" si max constant. Permet de moduler via le volume guitar (technique "clean to dirty").
- guitar_tone : pareil. "10 (open)" pour son brillant max, "5-7" pour adoucir, "switch X→Y" si manœuvre dynamique.
- stereo : false dans 95% des cas. true uniquement si delay stéréo / ambient / dual-amp recommandé pour CE morceau précis.
- PAS de duplication avec settings_guitar : ce dernier reste la prose contextuelle ("Use neck pickup for verses, switch to bridge for solo"). playing_hints fournit les VALEURS scalaires de référence.

ÉTAPE 7C – FX BLOCKS (Phase 9.2 Niveau 1 + Phase 9.7 Niveau 2) — état + sub-params des blocs effets
Retourne un objet fx_blocks AVEC LES 5 BLOCS effets de la chaîne preset TONEX (manuel p.22-28). Chaque bloc indique son ÉTAT (enabled bool), son TYPE quand applicable (mod/delay/reverb), et ses SUB-PARAMS numériques quand enabled=true (Phase 9.7). Modulation reste en Niveau 1 (juste enabled + type, pas de sub-params). Threshold gate/comp restent dans preset_settings_v1.alt (Phase 9.1) — pas dupliqués ici.

{
  "noise_gate": { "enabled": boolean,                                                       "release": 5-500, "depth": -100 à -20, "why": {"fr":"...","en":"...","es":"..."} },
  "compressor": { "enabled": boolean,                                                       "gain": -30 à 10, "attack": 1-51,      "why": {...} },
  "modulation": { "enabled": boolean, "type": MOD_TYPE,                                                                            "why": {...} },
  "delay":      { "enabled": boolean, "type": DELAY_TYPE, "mode": DELAY_MODE,               "time": 0-1000,   "feedback": 0-100, "mix": 0-100, "why": {...} },
  "reverb":     { "enabled": boolean, "type": REVERB_TYPE,                                  "time": 0-10,     "pre_delay": 0-500, "color": -10 à 10, "mix": 0-100, "why": {...} }
}

Types autorisés (enums OFFICIELS manuel TONEX) :
- MOD_TYPE    ∈ {"Chorus", "Tremolo", "Phaser", "Flanger", "Rotary"}
- DELAY_TYPE  ∈ {"Digital", "Tape"}
- DELAY_MODE  ∈ {"Normal", "Ping.Pong"} (Phase 9.7 — note le point dans "Ping.Pong")
- REVERB_TYPE ∈ {"Spring 1", "Spring 2", "Spring 3", "Spring 4", "Room", "Plate"} (Phase 9.7 — 6 variantes officielles firmware, retire Hall/Shimmer)

Sub-params Niveau 2 (Phase 9.7) avec ranges OFFICIELS manuel TONEX p.22-28 :
- noise_gate.release  : 5-500 ms (temps de fermeture du gate après le seuil)
- noise_gate.depth    : -100 à -20 dB (atténuation, -100 = total mute, -20 = atténuation douce)
- compressor.gain     : -30 à +10 dB (gain de sortie post-compression)
- compressor.attack   : 1-51 ms (temps de réaction, 1 = très agressif, 51 = doux)
- delay.time          : 0-1000 ms (temps inter-répétitions, ex 320 pour 1/8 dotted @ 120 BPM)
- delay.feedback      : 0-100 % (nombre de répétitions, 25 = 4-5 reps, 60 = quasi-infini)
- delay.mix           : 0-100 % (niveau du wet vs dry)
- reverb.time         : 0-10 (durée queue de reverb, scale relative)
- reverb.pre_delay    : 0-500 ms (délai avant 1ère réflexion, 0 = collé au signal direct)
- reverb.color        : -10 à +10 (-10 = sombre/lo-fi, 0 = neutre, +10 = brillant/aérien)
- reverb.mix          : 0-100 % (niveau wet)

Règles :
- enabled : true si le bloc est nécessaire pour reproduire le son du morceau, false sinon. Default false (bypass) pour mod/delay (peu de morceaux les utilisent). Default true pour noise_gate sur metal HG, false ailleurs. Reverb généralement true (ajoute de la profondeur), exception morceaux totalement secs.
- type (mod/delay/reverb uniquement) : retourne null ou omet le champ si enabled=false. Si enabled=true, choisis le type EXACT (case-sensitive — "Chorus" pas "chorus") depuis l'enum. Pour reverb, choisis "Spring 1" pour les voicings vintage Fender les plus mid-rich, "Spring 2/3/4" pour des variantes plus brillantes/diffuses, "Room" pour un espace court non-réverbérant, "Plate" pour le studio lush.
- mode (delay uniquement) : "Normal" = délai standard, "Ping.Pong" = répétitions alternées L/R (rare hors stereo).
- sub-params (Phase 9.7) : OMETS les sub-params si enabled=false (pas besoin pour un bloc bypassed). Si enabled=true, fournis des valeurs cohérentes au morceau.
- why per-bloc : OBLIGATOIRE. Phrase courte (10-15 mots) TRILINGUE expliquant pourquoi ce bloc est ON/OFF avec son TYPE et ses sub-params. Ex : "Reverb Plate ON time 5 pre_delay 25 mix 22 — ajoute du studio sans noyer le mix".
- noise_gate.enabled : true sur metal/thrash high gain. Coordonne avec preset_settings_v1.alt.gate_threshold (Phase 9.1).
- compressor.enabled : true sur funk/clean/country, false sur rock/metal. Coordonne avec alt.comp_threshold.
- modulation.enabled : RARE. true seulement si chorus/phaser/rotary/tremolo audible dans le morceau. Hells Bells = OFF, The Police "Walking on the Moon" = Chorus ON.
- delay.enabled : true si delay audible (U2 = Tape Normal time 380, ambient = Digital long). Default false pour le rock classique.
- reverb.enabled : généralement true. Type adapté : Spring 1-4 pour blues/rock vintage, Plate pour studio/lead, Room pour ambient court.

Adaptation au contexte attendue (Phase 9.7 avec sub-params) :
- thrash/metal high gain (For Whom the Bell Tolls, Master of Puppets) → noise_gate ON (release 80, depth -75), compressor OFF, mod OFF, delay OFF, reverb Plate (time 2.5, pre_delay 12, color -2, mix 8)
- blues clean (Thrill is Gone, Sunshine of Your Love) → noise_gate OFF, compressor ON (gain 0, attack 15), mod OFF, delay OFF (ou Tape mode Normal time 380 feedback 22 mix 12), reverb Spring 2 (time 4, pre_delay 0, color 1, mix 25)
- ambient/post-rock (Wish You Were Here) → noise_gate OFF, compressor ON (gain 2, attack 8), mod éventuellement Chorus, delay Tape Normal (time 480 feedback 40 mix 25), reverb Plate (time 7, pre_delay 30, color 2, mix 35)
- classic rock (AC/DC Hells Bells) → noise_gate OFF, compressor OFF, mod OFF, delay OFF, reverb Spring 2 ou Room (time 2, pre_delay 5, color 0, mix 10)
- funk (Get Lucky) → noise_gate OFF, compressor ON (gain 3, attack 5), mod éventuellement Phaser, delay OFF, reverb Room (time 1.5, pre_delay 0, color 0, mix 12)
- worship modern → noise_gate OFF, compressor ON, mod Chorus, delay Digital Normal (time 380 feedback 35 mix 22), reverb Plate (time 6, pre_delay 25, color 3, mix 30)

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

CONSIGNE DE PHRASING POUR settings_guitar (Phase 9.6 — déduplication)
Le champ "settings_guitar" est de la PROSE complémentaire à playing_hints (qui contient déjà les valeurs nominales scalaires pickup/guitar_volume/guitar_tone). Il NE DOIT PAS répéter ces valeurs.

À FAIRE :
- Décrire les TRANSITIONS de section (ex : "baisse le volume guitare à 7 pour l'intro puis remonte à 10 pour le riff", "switche du micro manche au chevalet pour le solo")
- Conseils de TECHNIQUE de jeu : palm muting, attaque médiator (proche chevalet vs proche manche), bends, vibrato, slides, hammer-ons, contrôle dynamique
- Conseils contextuels guitare spécifiques (ex : "joue les cordes graves avec le pouce pour adoucir l'attaque", "utilise un médiator plus dur pour gagner en mordant")

À ÉVITER ABSOLUMENT :
- Répéter les valeurs déjà dans playing_hints : "utilise le micro chevalet", "volume à 10", "tone ouvert à 10" (ces valeurs SONT DÉJÀ affichées en chiffres juste au-dessus dans l'UI → redondance bruyante)
- Indiquer une valeur scalaire fixe (pickup, volume, tone) sans qu'elle soit en transition/contextuelle au cours du morceau
- Corrections de la guitare elle-même ("la guitare manque de…")

Idem pour "settings_guitar" : ce sont des conseils de jeu et d'utilisation des contrôles guitare (volume, tone, micros, attaque, palm muting…), pas des corrections de la guitare elle-même.

ÉTAPE 8 – RECOMMANDATION BASSE (Phase 8.4) — conditionnelle

Si la section "COLLECTION DE BASSES DISPONIBLES" et/ou "AMPLIS BASSE TRADITIONNELS DISPONIBLES" apparaît ci-dessus, retourne TOUJOURS un objet "bass_recommendation" dans la sortie JSON (jamais null). L'utilisateur joue aussi la basse et a besoin d'une reco pour CHAQUE morceau qu'il prépare — même si la ligne de basse est purement support, recommande la basse la plus pertinente du rig + des réglages cohérents avec le style.

Format de bass_recommendation :
{
  "ideal_bass": "nom EXACT d'une basse de la collection" (string, OBLIGATOIRE si non-null),
  "bass_reason": {"fr":"1-2 phrases justifiant le choix de cette basse","en":"...","es":"..."} (TRILINGUE),
  "ref_bassist": "nom du bassiste original" (string),
  "ref_bass_guitar": "modèle basse historique" (string),
  "ref_bass_amp": "modèle ampli basse historique" (string),
  "capture_name": "nom EXACT d'une capture BASS installée dans les banks user" (string OU null) — Phase 8.8 : si la section "CAPTURES BASS INSTALLÉES" est présente et contient une capture pertinente pour le morceau (par usages match OU ampli match), retourne son nom EXACT ici. Sinon null. Mêmes priorités que captures guitar (usages > nom artiste > custom > Factory).
  "amp_settings": {"gain": 0-10, "bass": 0-10, "low_mid": 0-10, "high_mid": 0-10, "treble": 0-10, "master": 0-10, "channel": "Clean" | "Drive" | autre} (OPTIONNEL si user a un ampli basse traditionnel coché — réglages 0-10 sur les boutons),
  "settings_bass": {"fr":"conseils de jeu basse (doigts/médiator, position chevalet/manche, technique)","en":"...","es":"..."} (TRILINGUE, OPTIONNEL),
  "ref_bass_effects": "effets basse historiques (chorus, fuzz, octaver, compresseur…) OU 'Aucun effet'" (string),
  "cot_step2_basses": [{"name":"nom EXACT d'une basse de COLLECTION DE BASSES","score":0-100,"reason":{"fr":"justification courte","en":"...","es":"..."}}] — Phase vague B : classe TOUTES les basses du rig (COLLECTION DE BASSES) par pertinence pour CE morceau, comme cot_step2_guitars pour les guitares. JAMAIS de basse hors collection. Mirror exact de cot_step2_guitars.
  "bass_alternatives": [{"name":"nom EXACT capture BASS","amp":"ampli basse capturé","score":0-100}] — 1-3 captures ToneX BASS pertinentes triées par score décroissant. La PREMIÈRE doit être celle de "capture_name" si non-null. Privilégie les captures BASS installées listées dans "CAPTURES BASS INSTALLÉES". Si aucune capture bass pertinente, retourne [].
  "bass_preset_settings_v1": {même format que preset_settings_v1 guitar : cab_enabled + main{gain,bass,mid,treble,volume avec value+why trilingue} + alt{presence,depth,reverb_mix,comp_threshold,gate_threshold} + why} (OBJET OU null) — UNIQUEMENT si "capture_name" non-null (réglages des boutons PRESET de la ToneX pour la capture bass). Si capture_name null, mets null (l'user joue sur ampli traditionnel via amp_settings).
  "bass_fx_blocks": {même format que fx_blocks guitar : noise_gate/compressor/modulation/delay/reverb avec enabled bool + type/mode enum + sub-params + why trilingue par bloc} (OBJET OU null) — UNIQUEMENT si "capture_name" non-null. Sinon null. Pour la basse, compressor est souvent ON (ronde l'attaque), reverb/delay généralement OFF.
}

NOTE : capture_name et amp_settings ne sont PAS exclusifs. Si l'user a à la fois une capture bass installée pertinente ET un ampli basse traditionnel, retourne LES DEUX — l'UI affichera les 2 options côte à côte (Sur ta ToneX : Bank 47A "BS SVT" / Sur ton Rumble : amp_settings...). L'user choisit selon son contexte d'usage du moment.

NOTE vague B : cot_step2_basses + bass_alternatives sont TOUJOURS à fournir (jamais omis) dès que la section basse est présente. bass_preset_settings_v1 + bass_fx_blocks sont conditionnels à capture_name non-null (réglages d'une capture ToneX). Pour les ranges des knobs PRESET et des blocs FX, applique exactement les mêmes règles que pour preset_settings_v1 / fx_blocks décrites ÉTAPE 7.

Adapte le ton de la reco selon l'importance de la basse dans le morceau :
- **Ligne iconique** (Under Pressure de Queen, Money de Pink Floyd, Hysteria de Muse, Roundabout de Yes, funk/reggae/motown, bassistes iconiques type John Deacon/Jack Bruce/Geddy Lee) : reco précise + bass_reason qui souligne la signature
- **Ligne support solide** (rock standard, support rythmique sans riff signature) : reco de la basse la plus polyvalente du rig + amp_settings cohérents avec le genre. Le bass_reason peut juste mentionner "support solide rythmique" ou similaire — pas besoin de prétendre que c'est iconique si ça ne l'est pas.

amp_settings : seulement si l'utilisateur a un ampli basse traditionnel coché. Valeurs typiques :
- Rock vintage (Ampeg SVT) : gain 4-6, bass 6-7, low_mid 5-6, high_mid 4-5, treble 4-5, master 5-7
- Pop/funk (Markbass) : gain 3-5, bass 5, low_mid 6, high_mid 6, treble 6, master 5-7
- Hard rock (Rumble + Overdrive) : gain 6-7, bass 6, low_mid 6, high_mid 5, treble 5, master 6-7
- Reggae/dub : gain 3-4, bass 8, low_mid 7, high_mid 3, treble 2, master 5-6

CONSIGNE DE REGISTRE (Phase 7.50) — IMPÉRATIVE :
Tutoie systématiquement l'utilisateur dans TOUS les champs texte (cot_step1, cot_step3_amp, song_desc, guitar_reason, settings_preset, settings_guitar, cot_step2_guitars[].reason, cot_step4_score.*.reason).
- FR : utilise "tu", "ta", "ton", "tes", "te". JAMAIS "vous", "votre", "vos". Verbes à la 2e personne du singulier informel (ex : "essaie", "pousse", "garde", "mets"). PAS "essayez", "poussez", "gardez", "mettez".
- EN : utilise "you", "your" en registre informel (le tutoiement informel anglais étant identique au formel grammaticalement, garde un ton conversationnel et direct, pas trop formel).
- ES : utilise "tú", "tu", "tus", "te" (tuteo informal). JAMAIS "usted", "su", "sus". Verbes en 2e personne du singulier : "prueba", "empuja", "mantén", "pon". PAS "pruebe", "empuje", "mantenga", "ponga".

À ÉVITER ABSOLUMENT : tout mélange tu/vous dans une même phrase (ex : "Tu peux pousser les mids ; réglez le volume à 5" est interdit — doit être "Tu peux pousser les mids ; règle le volume à 5").

OUTPUT TRILINGUE — Format des champs texte :
Les champs marqués "TEXTE TRILINGUE" ci-dessous DOIVENT être un objet à 3 clés {"fr":"...","en":"...","es":"..."} avec la même information traduite dans chaque langue. Garde le sens et le niveau de détail constant entre les 3 versions. Les NOMS PROPRES (noms d'artistes, modèles d'amplis "Marshall JCM800", noms de guitares "Stratocaster '62", titres de morceaux) restent identiques dans les 3 langues. Les autres champs (noms, scores numériques, énums) restent des valeurs scalaires.

Réponds en JSON pur (sans backticks ni markdown) :
{"cot_step1":{"fr":"3-5 phrases analysant le profil tonal","en":"3-5 sentences analyzing the tonal profile","es":"3-5 frases analizando el perfil tonal"},"cot_step2_guitars":[{"name":"nom exact guitare","score":85,"reason":{"fr":"justification","en":"justification","es":"justificación"}},{"name":"2e guitare","score":75,"reason":{"fr":"...","en":"...","es":"..."}}],"cot_step3_amp":{"fr":"2-3 phrases","en":"2-3 sentences","es":"2-3 frases"},"cot_step4_score":{"guitar_score":85,"micro":{"score":90,"reason":{"fr":"...","en":"...","es":"..."}},"body":{"score":80,"reason":{"fr":"...","en":"...","es":"..."}},"history":{"score":95,"reason":{"fr":"...","en":"...","es":"..."}},"amp_match":{"score":85,"reason":{"fr":"...","en":"...","es":"..."}}},"song_year":1970,"song_album":"album","song_desc":{"fr":"2-3 phrases","en":"2-3 sentences","es":"2-3 frases"},"song_key":"Em","song_bpm":120,"song_style":"blues/rock/hard_rock/jazz/metal/pop","target_gain":5,"tonal_school":"fender_clean/marshall_crunch/vox_chime/dumble_smooth/mesa_heavy/hiwatt_clean","pickup_preference":"HB/SC/P90/any","ideal_guitar":"nom complet guitare idéale","guitar_reason":{"fr":"...","en":"...","es":"..."},"settings_preset":{"fr":"conseils","en":"settings","es":"ajustes"},"settings_guitar":{"fr":"conseils de jeu","en":"playing tips","es":"consejos de juego"},"ref_guitarist":"guitariste","ref_guitar":"modèle guitare","ref_amp":"modèle ampli","ref_effects":"effets ou 'Aucun effet'","preset_tmp":"nom exact patch TMP OU null","preset_ann_name":"nom EXACT capture OU null","preset_plug_name":"nom EXACT capture OU null","preset_settings_v1":{"cab_enabled":true,"main":{"gain":{"value":6.2,"why":{"fr":"...","en":"...","es":"..."}},"bass":{"value":4.5,"why":{"fr":"...","en":"...","es":"..."}},"mid":{"value":7.0,"why":{"fr":"...","en":"...","es":"..."}},"treble":{"value":5.3,"why":{"fr":"...","en":"...","es":"..."}},"volume":{"value":6.0,"why":{"fr":"...","en":"...","es":"..."}}},"alt":{"presence":{"value":4.7,"why":{"fr":"...","en":"...","es":"..."}},"depth":{"value":5.0,"why":{"fr":"...","en":"...","es":"..."}},"reverb_mix":{"value":16,"why":{"fr":"...","en":"...","es":"..."}},"comp_threshold":{"value":-18,"why":{"fr":"...","en":"...","es":"..."}},"gate_threshold":{"value":-56,"why":{"fr":"...","en":"...","es":"..."}}},"why":{"fr":"...","en":"...","es":"..."},"tweaks":[{"symptom":{"fr":"trop brillant sur FRFR","en":"too bright on FRFR","es":"demasiado brillante en FRFR"},"fix":"Treble -0.5 + Presence -0.3"},{"symptom":{"fr":"noyé dans le mix groupe","en":"buried in band mix","es":"enterrado en la mezcla"},"fix":"Mid +0.5 + Volume +0.3"}]},"playing_hints":{"pickup":"Bridge","guitar_volume":"8-10","guitar_tone":"10 (open)","stereo":false},"fx_blocks":{"noise_gate":{"enabled":false,"why":{"fr":"...","en":"...","es":"..."}},"compressor":{"enabled":false,"why":{"fr":"...","en":"...","es":"..."}},"modulation":{"enabled":false,"why":{"fr":"...","en":"...","es":"..."}},"delay":{"enabled":false,"why":{"fr":"...","en":"...","es":"..."}},"reverb":{"enabled":true,"type":"Spring 2","time":2,"pre_delay":5,"color":0,"mix":10,"why":{"fr":"...","en":"...","es":"..."}}},"bass_recommendation":null} (note : cab_enabled DOIT être true ; CHAQUE knob doit avoir value+why trilingue Phase 7.86 ; tweaks = MIN 3 MAX 8 ajustements empiriques spécifiques au morceau Phase 9.4/9.4.1 ; playing_hints = 4 champs scalaires Phase 9.5 ; fx_blocks Phase 9.2 N1 + Phase 9.7 N2 = 5 blocs avec enabled bool + type/mode enum + sub-params numériques quand enabled=true + why trilingue par bloc ; bass_recommendation = null si user ne joue PAS la basse, SINON objet complet ÉTAPE 8 — exemple ci-dessous)

Exemple bass_recommendation (vague B) quand l'user joue la basse — fournis cot_step2_basses + bass_alternatives TOUJOURS, bass_preset_settings_v1 + bass_fx_blocks seulement si capture_name non-null :
{"ideal_bass":"Fender Precision Bass American Vintage II","bass_reason":{"fr":"...","en":"...","es":"..."},"ref_bassist":"John Deacon","ref_bass_guitar":"Fender Precision Bass","ref_bass_amp":"Ampeg SVT","ref_bass_effects":"Aucun effet","capture_name":"BS SVT","cot_step2_basses":[{"name":"Fender Precision Bass American Vintage II","score":92,"reason":{"fr":"...","en":"...","es":"..."}},{"name":"Fender Jazz Bass Player Plus","score":80,"reason":{"fr":"...","en":"...","es":"..."}}],"bass_alternatives":[{"name":"BS SVT","amp":"Ampeg SVT","score":91},{"name":"TSR GK MBS150","amp":"GK Bass","score":74}],"amp_settings":{"gain":5,"bass":6,"low_mid":6,"high_mid":5,"treble":4,"master":6,"channel":"Clean"},"settings_bass":{"fr":"...","en":"...","es":"..."},"bass_preset_settings_v1":{"cab_enabled":true,"main":{"gain":{"value":4,"why":{"fr":"...","en":"...","es":"..."}},"bass":{"value":6,"why":{"fr":"...","en":"...","es":"..."}},"mid":{"value":5,"why":{"fr":"...","en":"...","es":"..."}},"treble":{"value":4,"why":{"fr":"...","en":"...","es":"..."}},"volume":{"value":6,"why":{"fr":"...","en":"...","es":"..."}}},"alt":{"presence":{"value":4,"why":{"fr":"...","en":"...","es":"..."}},"depth":{"value":6,"why":{"fr":"...","en":"...","es":"..."}},"reverb_mix":{"value":0,"why":{"fr":"...","en":"...","es":"..."}},"comp_threshold":{"value":-20,"why":{"fr":"...","en":"...","es":"..."}},"gate_threshold":{"value":-60,"why":{"fr":"...","en":"...","es":"..."}}},"why":{"fr":"...","en":"...","es":"..."}},"bass_fx_blocks":{"noise_gate":{"enabled":false,"why":{"fr":"...","en":"...","es":"..."}},"compressor":{"enabled":true,"threshold":-18,"gain":2,"attack":12,"why":{"fr":"...","en":"...","es":"..."}},"modulation":{"enabled":false,"why":{"fr":"...","en":"...","es":"..."}},"delay":{"enabled":false,"why":{"fr":"...","en":"...","es":"..."}},"reverb":{"enabled":false,"why":{"fr":"...","en":"...","es":"..."}}}}

Champs TEXTE TRILINGUE (à fournir en {fr, en, es}) :
- cot_step1, cot_step3_amp, song_desc, guitar_reason, settings_preset, settings_guitar
- cot_step2_guitars[].reason
- cot_step4_score.{micro,body,history,amp_match}.reason
- preset_settings_v1.why (résumé global)
- preset_settings_v1.main.{gain,bass,mid,treble,volume}.why (Phase 7.86 — par knob)
- preset_settings_v1.alt.{presence,depth,reverb_mix,comp_threshold,gate_threshold}.why (Phase 7.86 — par knob)
- preset_settings_v1.tweaks[].symptom (Phase 9.4 — symptom trilingue, fix reste string universelle)
- fx_blocks.{noise_gate,compressor,modulation,delay,reverb}.why (Phase 9.2 — par bloc, trilingue 10-15 mots)
- bass_recommendation.bass_reason, .settings_bass (vague B / Phase 8)
- bass_recommendation.cot_step2_basses[].reason (vague B — par basse du rig)
- bass_recommendation.bass_preset_settings_v1.* (mêmes champs why que preset_settings_v1, si présent)
- bass_recommendation.bass_fx_blocks.*.why (mêmes champs why que fx_blocks, si présent)

Champs SCALAIRES (valeur unique, pas d'objet) :
- song_year (number), song_album (string nom album), song_key (string notation), song_bpm (number)
- song_style, target_gain, tonal_school, pickup_preference : ENUMS
- ideal_guitar, ref_guitarist, ref_guitar, ref_amp : NOMS PROPRES (pas de traduction)
- ref_effects : nom des effets en anglais ou null/'Aucun effet'
- preset_tmp, preset_ann_name, preset_plug_name : noms exacts depuis listes fournies
- bass_recommendation.ideal_bass, .ref_bassist, .ref_bass_guitar, .ref_bass_amp, .capture_name : NOMS PROPRES
- bass_recommendation.ref_bass_effects : string effets ou 'Aucun effet'
- bass_recommendation.cot_step2_basses[].name (string), .score (number)
- bass_recommendation.bass_alternatives[].name (string), .amp (string), .score (number)
- bass_recommendation.amp_settings.* (number 0-10), .channel (string)
- cot_step2_guitars[].name (string), .score (number)
- cot_step4_score.guitar_score (number), .{micro,body,history,amp_match}.score (number)
- preset_settings_v1.cab_enabled (boolean), .main.* (number 0-10), .alt.{presence,depth} (number 0-10), .alt.reverb_mix (number 0-100), .alt.comp_threshold (number -40 à 0), .alt.gate_threshold (number -100 à 0)
- preset_settings_v1.tweaks[].fix (string courte, format "Param ±N" ou "Param ±N + Param ±N", universel)
- playing_hints.pickup, .guitar_volume, .guitar_tone (strings courtes scalaires, universelles), .stereo (boolean, false par défaut) — Phase 9.5
- fx_blocks.{noise_gate,compressor,modulation,delay,reverb}.enabled (boolean), .type (string enum, optional pour mod/delay/reverb) — Phase 9.2
- fx_blocks.delay.mode (string enum "Normal"/"Ping.Pong") — Phase 9.7
- fx_blocks.noise_gate.{release,depth} (number), .compressor.{gain,attack} (number), .delay.{time,feedback,mix} (number), .reverb.{time,pre_delay,color,mix} (number) — Phase 9.7 sub-params Niveau 2

Contraintes :
- cot_step2_guitars : guitares UNIQUEMENT dans la collection listée
- ideal_guitar : DOIT être une guitare de la collection
- song_key : notation anglaise (Em, A, Bb, F#m)
- target_gain : 0-10`;
  // S9.11 — Routing provider qui respecte aiProvider explicitement.
  // Avant : `provider = (aiKeys.gemini || defaultKey) ? 'gemini' : 'anthropic'`
  // ignorait le param et préférait toujours Gemini si une clé Gemini était
  // disponible. Conséquence : impossible pour l'admin de basculer sur
  // Anthropic même avec une clé sk-ant-... configurée. Le main.jsx S9.11
  // override aiProvider à 'anthropic' pour admin+clé Anthropic dispo.
  const defaultKey = getSharedGeminiKey();
  let provider, key;
  if (aiProvider === 'anthropic' && aiKeys.anthropic) {
    provider = 'anthropic';
    key = aiKeys.anthropic;
  } else {
    provider = 'gemini';
    key = aiKeys.gemini || defaultKey;
  }
  if (!key) return Promise.reject(new Error('Clé API manquante — configure-la dans ⚙️ Paramètres.'));
  const parse = safeParseJSON;
  const callAI = () => {
    const req = provider === 'gemini'
      ? fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8192 } }),
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
    return req.then((r) => enrichAIResult(r, gType, gId, banksAnn, banksPlug, availableSources, song));
  };
  // S9.17 — Retry automatique sur rate limit Gemini (429 / quota exceeded).
  // Gemini free tier = 20 RPM par projet, fenêtre 60s. Le message
  // "Please retry in X.Xs" donne le délai exact à attendre. Si parsable,
  // on l'utilise ; sinon fallback 20s. Max 2 retries quota (40s max).
  const isQuotaError = (err) => {
    const msg = String(err?.message || err || '').toLowerCase();
    // S9.18 — Ne PAS retry sur spend cap / billing : erreur permanente,
    // pas transient. Retry serait inutile et masquerait le problème
    // pendant 40s. Diffère du rate limit RPM qui se résout en 15s.
    if (msg.includes('spending cap') || msg.includes('spend cap') || msg.includes('billing') || msg.includes('payment')) return false;
    return msg.includes('quota') || msg.includes('exceeded') || msg.includes('rate limit') || msg.includes('429') || msg.includes('resource_exhausted');
  };
  const parseRetryDelayMs = (msg) => {
    const m = String(msg || '').match(/retry in (\d+(?:\.\d+)?)s/i);
    if (m) return Math.ceil(parseFloat(m[1]) * 1000) + 500;
    return null;
  };
  const callAIWithQuotaRetry = (retriesLeft = 2) => callAI().catch((err) => {
    if (retriesLeft <= 0) throw err;
    if (!isQuotaError(err)) throw err;
    const delay = parseRetryDelayMs(err?.message) || 20000;
    console.warn(`[fetchAI] Rate limit Gemini, retry in ${delay}ms (${retriesLeft} retries restants)`);
    return new Promise((r) => setTimeout(r, delay)).then(() => callAIWithQuotaRetry(retriesLeft - 1));
  });
  // Retry intelligent qualité : si le meilleur score < 85%, relancer
  // l'IA (max 2 retries). Indépendant du retry quota ci-dessus.
  const RETRY_THRESHOLD = 85;
  const MAX_RETRIES = 2;
  const tryBest = (currentBest, retries) => {
    if (retries <= 0 || bestScoreOf(currentBest) >= RETRY_THRESHOLD) return Promise.resolve(currentBest);
    return callAIWithQuotaRetry().then((newResult) => tryBest(mergeBestResults(currentBest, newResult), retries - 1)).catch(() => currentBest);
  };
  return callAIWithQuotaRetry().then((first) => tryBest(first, MAX_RETRIES));
}

export default fetchAI;
export { fetchAI };
