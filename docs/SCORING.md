# Backline — Règles de recommandation

> Document de référence Phase 7.52.1 (2026-05-15).
> Décrit comment Backline choisit les guitares, presets et patches
> recommandés pour un morceau donné.

## Vue d'ensemble — Pipeline complet

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User ouvre un morceau (SongDetailCard)                       │
└──────────────┬──────────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. fetchAI(song, gId, banksAnn, banksPlug, ...)                 │
│    Build prompt avec :                                          │
│    - song.title + song.artist                                   │
│    - SONG_HISTORY (guitariste/guitare/amp original)             │
│    - rig user (guitares dans collection)                        │
│    - INSTALLED SLOTS (Phase 7.31, enrichi 7.52.1 avec usages)   │
│    - CATALOGUE TMP (Phase 7.10)                                 │
│    - feedback historique (Phase 7.5)                            │
│    - guitarBias auto + manuel (Phase 7.7+7.9)                   │
│    - recoMode : balanced/faithful/interpretation (Phase 7.1-7.3)│
└──────────────┬──────────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Gemini Flash retourne JSON :                                 │
│    {                                                            │
│      ideal_guitar : "Gibson SG Standard 61",                    │
│      ref_amp      : "Marshall Super Lead 100W",                 │
│      ref_guitarist: "Angus Young",                              │
│      song_style   : "hard_rock",                                │
│      song_gain    : "mid",                                      │
│      preset_ann_name : "AA MRSH JT50 I Drive BAL SCH CAB",      │
│      preset_plug_name: null,                                    │
│      ideal_preset    : "AA MRSH JT50 I Drive BAL SCH CAB",      │
│      preset_tmp      : null,                                    │
│      cot_step1, cot_step2_guitars, cot_step3_amp, ...           │
│    }                                                            │
└──────────────┬──────────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. enrichAIResult(aiResult, ...) (ai-helpers.js)                │
│    - resolveRefAmp() : alias Marshall Plexi ↔ Super Lead 1959   │
│    - findSlotByName() : pin preset_ann_name au slot exact       │
│      → preset_ann.score = max(90, V9Score), flag annPinnedByAI  │
│    - computeBestPresets() : scoring V9 local sur tout le        │
│      catalog filtré par availableSources + isSrcCompatible      │
│    - preserveHistorical() : merge avec aiCache.bestByGuitar      │
│      pour ne jamais régresser un score validé                   │
└──────────────┬──────────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Display (SongDetailCard) :                                   │
│    - Section 1 : Reco idéale (ideal_guitar + ideal_preset)      │
│    - Section 2 : Pourquoi (cot_step1 + cot_step3_amp)           │
│    - Section 3 : Installed slots (preset_ann/plug du rig user)  │
│    - Section 4 : Paramétrage (settings_preset + settings_guitar)│
│    - displayTopPreset = max(preset_ann, preset_plug,            │
│                             ideal_preset) Phase 7.32            │
└─────────────────────────────────────────────────────────────────┘
```

## Le scoring V9 (local, déterministe)

Le scoring V9 (`src/core/scoring/index.js`) calcule un score 0-100 pour
chaque couple (preset, guitare, morceau). Il est **déterministe** (pas
d'IA, juste de la math) et tourne en local. Sert à :

- Choisir le meilleur preset accessible quand l'IA n'est pas disponible
- Re-classer les slots installés derrière le pin IA Phase 7.31
- Donner un score affiché à côté de chaque preset proposé
- Comparer deux presets entre eux pour le tri

### Les 5 dimensions et leurs poids

| Dimension | Poids | Description |
|-----------|------:|-------------|
| **refAmp** | 30% | Match entre l'ampli du preset et l'ampli de référence du morceau |
| **styleMatch** | 25% | Compatibilité entre le style du preset (blues/rock/...) et celui du morceau |
| **pickup** | 20% | Score d'affinité entre le pickup de la guitare (HB/SC/P90) et le couple (style, gain) du preset |
| **gainMatch** | 15% | Distance entre le gain du preset et le gain cible du morceau |
| **guitar** | 10% | Score d'affinité spécifique de la guitare (par modèle, pas juste pickup type) |

**Total** = 100%. Si une dimension retourne `null` (info manquante),
son poids est **redistribué proportionnellement** sur les dimensions
actives.

### Détail de chaque dimension

#### 1. refAmp (30%) — Match ampli historique

`computeRefAmpScore(presetAmp, songRefAmp)` (`src/core/scoring/amp.js`) :

- **100** : nom exact (`"Marshall JCM800" === "Marshall JCM800"`)
- **100** : nom exact après normalisation (strip "100W", "MkI", "head", "combo")
- **95** : inclusion (l'un contient l'autre)
- **85** : même **famille** dans AMP_TAXONOMY (ex. Plexi 1959, Super Lead 100, JTM45 = famille "Marshall Vintage")
- **50** : même **marque** (Marshall vs Marshall, mais pas même famille)
- **40** : même **école** (British vs British, US vs US)
- **25** : taxonomy lookup échoué côté preset ou song
- **10** : marques différentes, écoles différentes
- **null** : pas de songRefAmp ou pas de presetAmp

#### 2. styleMatch (25%) — Compatibilité de style

`computeStyleMatchScore(presetStyle, songStyle)` (`src/core/scoring/style.js`)
utilise une matrice 6×6 (blues, rock, hard_rock, jazz, metal, pop) :

```
              blues  rock  hard_rock  jazz  metal  pop
blues          100    60     30        70    10    55
rock            55   100     75        20    40    60
hard_rock       25    70    100        10    65    20
jazz            65    15      5       100     5    30
metal           10    35     60         5   100    10
pop             50    60     20        35    10   100
```

Lecture : ligne = style du **preset**, colonne = style du **morceau**.
Ex : preset hard_rock sur morceau rock = 70. Preset blues sur morceau
hard_rock = 30 (mauvais match).

#### 3. pickup (20%) — Affinité pickup

`computePickupScore(presetStyle, presetGainRange, pickupType)`
(`src/core/scoring/pickup.js`) lookup dans une matrice 6 styles ×
4 gains × 3 pickups (60 cellules). Exemples :

- `hard_rock` × `drive` × `HB` = **90** (Marshall JCM800 sur SG/LP)
- `hard_rock` × `drive` × `SC` = **70** (même preset sur Strat = OK mais moins idéal)
- `blues` × `crunch` × `SC` = **88** (Fender Tweed sur Strat = excellent)
- `metal` × `high_gain` × `HB` = **95** (Mesa Rectifier sur 7-cordes HB)
- `metal` × `high_gain` × `SC` = **50** (pas le bon pickup pour du metal moderne)

#### 4. gainMatch (15%) — Match du gain

`computeGainMatchScore(presetGain, songTargetGain)` :

```
score = max(0, 100 - abs(presetGain - songTargetGain) * 12)
```

Où `presetGain` et `songTargetGain` sont 0-10. Donc :

- Diff 0 → 100
- Diff 1 → 88
- Diff 2 → 76
- Diff 3 → 64
- Diff 5 → 40
- Diff 8+ → 4 puis 0

#### 5. guitar (10%) — Affinité guitare spécifique

`computeGuitarScoreV2(guitarId, presetStyle, presetGainRange, voicing)`
utilise `GUITAR_PROFILES` (par guitare individuelle, pas juste pickup
type). Permet de distinguer ES-335 (HB warm) d'une SG Standard (HB
aggressive) sur le même style hard_rock.

### Redistribution des poids

Si une dimension est `null` (info manquante côté preset ou song), son
poids est redistribué :

```
totalWeight = somme des poids des dimensions actives
finalScore = somme(score_i * weight_i / totalWeight)
```

Exemple : si song.ref_amp est manquant et style aussi :
- refAmp(30%) + styleMatch(25%) = 55% redistribués sur pickup(20) + gainMatch(15) + guitar(10) = 45% restant
- Nouveaux poids effectifs : pickup 44%, gainMatch 33%, guitar 23%

## Le prompt IA (fetchAI.js)

Le prompt envoyé à Gemini Flash est composé de **plusieurs sections**
en ordre fixe :

### Section 1 — Contexte morceau

```
Morceau : "Highway to Hell" de "AC/DC".
Guitare sélectionnée : Gibson SG Standard 61 (HB).
```

### Section 2 — Rig user

```
COLLECTION DE GUITARES DISPONIBLES :
- Gibson Les Paul Standard 60 (HB) : ...
- Gibson SG Standard Ebony (HB) : ...
- Gibson ES-335 (HB) : ...
- Fender Stratocaster 61 (SC) : ...
...
```

### Section 3 — Mode reco (Phase 7.1-7.3)

Selon `effectiveRecoMode = song.recoMode || profile.recoMode || 'balanced'` :

- **balanced** (défaut) : rien d'ajouté au prompt, scoring équilibré.
- **faithful** : *"Privilégie la guitare EXACTEMENT utilisée par
  l'artiste sur l'enregistrement original."*
- **interpretation** : *"Privilégie les guitares VERSATILES qui
  couvrent bien le style du morceau."*

### Section 4 — Préférences utilisateur (Phase 7.7-7.9)

Le `guitarBias` est dérivé de `song.feedback[]` historique (auto)
**fusionné** avec `profile.guitarBias` (manuel, prioritaire). Format :

```
PRÉFÉRENCES UTILISATEUR (déduites de l'historique de feedback) :
- blues : Gibson ES-335 (5 morceaux feedbackés)
- hard_rock : Gibson SG Standard 61 (manuel)

Si le style du morceau matche une de ces entrées, tiens-en compte
sans forcer ton choix.
```

Soft hint : non bloquant, l'IA peut s'en écarter si le contexte
historique du morceau le justifie.

### Section 5 — Catalogue TMP (Phase 7.10)

Les 20 patches factory TMP (Tone Master Pro) sont sérialisés pour
permettre le pin `preset_tmp`. Format compact avec usages :

```
CATALOGUE TMP — patches factory disponibles :
- "Rock Preset" : British Plexi (hard_rock, mid gain) — pour AC/DC, Cream
- "Clean Preset" : Fender '65 Twin Reverb (blues, low gain) — pour BB King
...
```

### Section 6 — Captures installées (Phase 7.31 + 7.52.1)

`buildInstalledSlotsSection(banksAnn, banksPlug)` itère les slots
non-vides des banks user. Pour chaque slot :

- Lookup catalog via `findCatalogEntry(name)` (avec fuzzy + fallback
  `guessPresetInfo`)
- Sérialise `(bank+slot, name, amp, style, gain, src, usages)`

**Phase 7.52.1** ajoute le champ `usages` quand le catalog entry les
fournit :

```
CAPTURES INSTALLÉES DANS LES BANKS PEDALE/ANNIVERSARY :
- 9C "AA MRSH JT50 I Drive BAL SCH CAB" — Marshall JTM-50 1967 — hard_rock mid gain — src:Anniversary — usages: [AC/DC (Highway to Hell, Back in Black, TNT, You Shook Me All Night Long)]
- 22C "TJ 74 Purple Plexi 1 3" — 1974 Purple Plexi Marshall JMP — hard_rock mid gain — src:Anniversary
- 48B "Blink-182 Mesa Boggie" — Mesa Triple Rectifier — rock high gain — src:custom — usages: [Blink-182]
...
```

### Section 7 — INSTRUCTION CAPTURES (Phase 7.34 + 7.52.1)

Règle de priorité explicite pour le choix de `preset_ann_name` /
`preset_plug_name` :

1. **PRIORITÉ ABSOLUE 1** : capture dont les `usages: [...]`
   contiennent l'**artiste OU le titre** du morceau analysé.
   Ex : pour "Highway to Hell" de AC/DC, choisir le slot dont
   usages contient "AC/DC" OU "Highway to Hell".
2. **PRIORITÉ 2** : capture dont le **nom** mentionne explicitement
   l'artiste/morceau (ex : `"Blink-182 Mesa Boggie"` pour un morceau
   Blink-182, `"Kirk & James - Gasoline v2"` pour Metallica).
3. **PRIORITÉ 3** : capture **custom/specialty** (`src: TSR, ML,
   custom, ToneNET, Anniversary`) dont l'ampli matche l'ampli
   historique.
4. **PRIORITÉ 4** : capture **Factory** matching l'ampli.

**Garde-fou Phase 7.34 — anti cross-contamination** :

> Une capture avec `usages: [X]` est RÉSERVÉE à l'artiste X. N'utilise
> PAS "AA MRSH SL100 JU Dimed" (usages Hendrix/Led Zep) pour un
> morceau qui n'est ni Hendrix ni Led Zep, même si l'ampli est
> cohérent.

Cela empêche par exemple "Blink-182 Mesa Boogie" (capture custom user)
de remonter pour "Self Esteem" de The Offspring juste parce que les
deux veulent du Mesa.

### Section 8 — Phrasing settings_preset / settings_guitar (Phase 7.45)

> Présente les conseils comme **adaptation au matériel utilisateur**,
> pas comme correction du preset :
> - "Sur ta guitare, pousse les mids vers 6 pour..." (OK)
> - "Le preset gagne à avoir les mids à 6" (ÉVITER — sous-entend défaut)
>
> Le preset est calibré par son créateur (TSR, ML Sound Lab, Galtone,
> Amalgam, ToneNET, IK Factory) — les conseils adaptent au contexte,
> ils ne corrigent pas.

### Section 9 — Output trilingue + registre tutoiement

Phase 7.39 : champs texte retournés en `{fr, en, es}` (1 fetch produit
3 langues).

Phase 7.50 (B-UX-05) : consigne explicite tutoiement informel dans
les 3 langues (`tu/ta/ton/tes` en FR, `you/your` conversationnel
en EN, `tú/tu/tus` en ES).

## L'override IA → V9 (Phase 7.31)

Quand l'IA retourne un `preset_ann_name` exact qui matche un slot des
banks user, `findSlotByName(banks, name)` (case-insensitive) le
résout et `enrichAIResult` :

1. Set `preset_ann = { bank, slot, name, score, breakdown }` avec
   `score = max(90, V9Score)` (high confidence)
2. Set flag `annPinnedByAI = true` → empêche le "never-regress"
   d'écraser le choix IA même si V9 aurait scoré mieux un autre slot.

Idem pour `preset_plug_name`.

**Effet** : le scoring V9 reste autoritaire pour ranger les autres
slots, mais le top installé est dicté par l'IA quand elle a une
opinion claire (ex. nom artiste-specific dans usages ou dans le
nom de capture).

## Le "never-regress" (Phase 6.1.3)

`preserveHistorical(prev, next, ...)` (`ai-helpers.js`) compare
`aiCache.bestByGuitar` avec le nouveau résultat. Pour chaque dimension
(`preset_ann`, `preset_plug`, etc.), si le nouveau score est inférieur
au précédent **et** que `annPinnedByAI` n'est pas levé, on garde le
précédent. Évite que :

- Un fetch IA bruité dégrade une reco validée
- Un rescore après ajout d'une guitare dans le rig oublie un slot
  qui scorait mieux pour une autre guitare

## La cascade de display (Phase 7.32)

`displayTopPreset` = max de `(preset_ann, preset_plug, ideal_preset)`
par score décroissant. La section 3 "Recommandation idéale Preset"
affiche ce top, en gras + indication de l'origine :

- 🏭 `preset_ann` : installé dans tes banks Pedale/Anniversary
- 🔌 `preset_plug` : installé dans tes banks Plug
- 💡 `ideal_preset` : catalogue (à acheter ou télécharger)

Si plusieurs sont à égalité, **stable sort** ES2019 (V8 TimSort) :
ordre du tableau source préservé (preset_ann d'abord, puis preset_plug,
puis ideal_preset). Donc en cas d'égalité parfaite, l'installé
Anniversary gagne sur l'idéal catalogue.

## Le bias `guitarBias` (Phase 7.7+7.9)

### Auto-dérivé (Phase 7.7)

`computeGuitarBiasFromFeedback(songDb, guitars, threshold=3)`
(`core/state.js`) scanne tous les morceaux avec :
- `feedback.length > 0`
- `aiCache.result.song_style` présent
- `aiCache.result.ideal_guitar` présent

Tally `(style → guitarId)`. Si une combinaison apparaît ≥3 fois,
elle remonte dans `derivedGuitarBias`. Soft hint au prompt IA.

### Override manuel (Phase 7.9)

`profile.guitarBias = { [styleId]: guitarId }` édité dans Mon Profil
→ 🎯 Préférences IA. Écrase l'auto-dérivé style par style.

`mergeGuitarBias(auto, manual, guitars)` fusionne :
- Manuel prioritaire (overwrites auto pour ce style)
- Drop entries stales (guitarId inexistant)
- Format final : `{ [style]: { guitarId, guitarName, count?, source } }`

## Les modes reco (Phase 7.1-7.3)

`effectiveRecoMode = song.recoMode || profile.recoMode || 'balanced'`

Boutons sous chaque morceau :
- `↻ Profil` (hérite)
- `⚖️ Équilibré`
- `🎯 Fidèle`
- `🎨 Interprétation`

Changer le mode invalide l'aiCache du morceau → re-fetch automatique
au prochain render avec le nouveau prompt.

## Le `rigStale` (Phase 7.48 T10)

`useEffect` SongDetailCard détecte si `aiCache.rigSnapshot` (Phase 5.10.2)
diffère de `computeRigSnapshot(allRigsGuitars)` actuel. Si stale,
bypass `enrichAIResult` local et force `fetchAI` complet. Évite que
les recos de Sébastien (rig 11 guitares) restent affichées telles
quelles pour Bruno (rig 2 guitares Schecter + Ibanez) qui ouvre la
même song partagée.

## Filtrage par `availableSources` (Phase 5.6)

`isSourceAvailable(srcId, availableSources)` dans `core/sources.js` :

- `availableSources[srcId] === true` → autorisé
- `availableSources[srcId] === false` → exclu
- Absent / undefined → permissif (autorisé)

Filtré à 4 endroits :
- `computeBestPresets` (ai-helpers.js)
- `findBestAvailable` (preset-helpers.js)
- `BankOptimizerScreen.analyzeDevice`
- Plan réorganisation (BankOptimizerScreen)

Donc un user qui n'a pas le toggle Factory ne verra jamais une reco
Factory même si elle scorerait 95%.

## Compatibilité source ↔ device

`isSrcCompatible(src, deviceKey)` :

- `tonex-pedal` : accepte `TSR, ML, Factory, FactoryV1, ToneNET, custom`. Rejette `Anniversary` (exclusif aux modèles Anniversary) et `PlugFactory`.
- `tonex-anniversary` : accepte tout sauf `PlugFactory`. (Accepte `Anniversary` en exclusif + tout le catalogue Pedal standard.)
- `tonex-plug` : accepte `TSR, ML, PlugFactory, ToneNET, custom`. Rejette `Anniversary` et `Factory` (Pedal-only).

## Catalog enrichi par profil

3 sources d'enrichissement de `PRESET_CATALOG_MERGED` au runtime :

1. **ToneNET presets** (main.jsx useMemo, Phase 2.x) : injecte
   `profile.toneNetPresets` avec `src: "ToneNET"`.
2. **Custom packs** (Phase 7.31) : injecte `profile.customPacks` avec
   `src: "custom"`.
3. **Anniversary Premium** (Phase 7.52, statique) : 150 entrées
   curées avec usages artist/songs explicit.

Permet à `findCatalogEntry(name)` de retourner la vraie metadata
(pas du `guessPresetInfo` heuristique) pour les presets user et
les captures Anniversary.

## Snapshot rig (Phase 5.10.2)

`computeRigSnapshot(guitars)` retourne `"id1|id2|id3..."` (ids
sortés). Stocké dans `aiCache.rigSnapshot`. Permet de détecter
qu'une analyse a été faite avec un rig différent du rig actuel
(profil partagé, nouveau profil, ajout guitare).

## Référence rapide — Où regarder dans le code

| Sujet | Fichier |
|-------|---------|
| Scoring V9 agrégateur | `src/core/scoring/index.js` |
| Score ampli refAmp | `src/core/scoring/amp.js` |
| Score pickup | `src/core/scoring/pickup.js` |
| Score style | `src/core/scoring/style.js` |
| Score guitare | `src/core/scoring/guitar.js` |
| Catalog merge + lookup | `src/core/catalog.js` |
| Catalog Anniversary Premium | `src/data/anniversary-premium-catalog.js` |
| Prompt IA + instructions | `src/app/utils/fetchAI.js` |
| Résolution aiResult → scores | `src/app/utils/ai-helpers.js` |
| Sources + compatibilité | `src/core/sources.js` |
| Bias auto + manuel | `src/core/state.js` (computeGuitarBiasFromFeedback, mergeGuitarBias) |
| Devices registry | `src/devices/registry.js` |
| Modes reco UI | `src/app/screens/MonProfilScreen.jsx` (tab reco) |
| Feedback panel | `src/app/components/FeedbackPanel.jsx` |
| Display top preset | `src/app/screens/SongDetailCard.jsx` (displayTopPreset) |

## SCORING_VERSION

Actuellement `SCORING_VERSION = 9` (Phase 1 freeze, octobre 2025).
Tout aiCache avec `sv < 9` est considéré stale et déclenche un
re-fetch ou un rescore local au prochain render. Bump V10 = invalide
tous les caches existants → à éviter sauf changement majeur de la
math V9.

Les snapshots Vitest dans `src/core/scoring/__snapshots__/` font foi :
38 tests qui capturent des valeurs déterministes (6 styles × HB
drive + 5 fallbacks + 11 guitares × 2 fonctions sur ledzep_stairway
+ 5 cas redistribution). Modifier la math casse les snapshots — c'est
intentionnel, c'est un signal explicite.
