# Backline — Contexte projet pour Claude Code

> Ce fichier est lu automatiquement par Claude Code à chaque session.
> Le tenir à jour quand l'archi évolue.

## But du projet

**Backline** (anciennement "ToneX Poweruser", renommé Phase 5.2 mai 2026
quand le scope a dépassé le strict ToneX Pedal pour couvrir 4 devices).

Tagline : *"Le guide intelligent pour tes pédales et amplis modélisés"*.

URL canonique : `https://mybackline.app/` (Phase 7.29, mai 2026).
Domaine alternatif `mybackline.fr` → redirect 301 vers `.app`.
Anciennes URLs `ff2t.github.io/tonex-setlist-guide/*` toujours
servies par GitHub Pages (les bookmarks Mac/iPhone/iPad de Sébastien
+ les PWA installées avant Phase 7.29 continuent à fonctionner).
`ToneX_Setlist_Guide.html` reste un redirect HTML legacy vers
`mybackline.app`.

Édité par **PathToTone** (2026).

PWA mono-fichier React de gestion de setlists et de presets pour
guitaristes. Aide à choisir la bonne guitare et le bon preset pour
chaque morceau d'une setlist, sur trois appareils :

- **ToneX Pedal** (50 banks A/B/C, captures `src` ∈ {TSR, ML, Factory,
  ToneNET, custom} — **rejette Anniversary** depuis Phase 2)
- **ToneX Pedal Anniversary** (50 banks A/B/C, partage `banksAnn` avec
  ToneX Pedal en Phase 2 ; accepte les captures `Anniversary`
  exclusives en plus du catalogue Pedal standard)
- **ToneX Plug** (10 banks A/B/C, rejette `Anniversary` et `Factory`)
- **Tone Master Pro** (à venir) : Layouts/Scenes/Presets, chaîne de
  5 blocs (Comp, Drive, Amp, Cab, FX), IR loading.

L'appli embarque un moteur de scoring guitare↔preset (5 dimensions,
versionné) et un assistant IA optionnel (OpenAI/Anthropic). Stockage
local + import/export JSON.

Déployée sur GitHub Pages, accessible via `mybackline.app` (URL principale,
Phase 7.29) ou `ff2t.github.io/tonex-setlist-guide/` (legacy, toujours OK).

## Public et contraintes d'usage

- Utilisateur principal : guitariste blues/rock 70s, ~13 morceaux
  actifs, 11 guitares dans la collection (LP60, LP P90, SG Ebony,
  SG 61, ES-335, Strat 61, Strat Pro II, EC Strat, Tele 63, Tele
  Ultra, Jazzmaster). Profil secondaire : son fils, 12 ans, fan
  d'AC/DC et BB King, équipement Epiphone + Fender Junior.
- Cible matérielle : iPad Pro M4 et iPhone récents en standalone PWA,
  Safari iOS 16+, Chrome desktop. **Doit fonctionner offline** une
  fois installée.
- Stockage local uniquement (localStorage). Pas de backend.
  Sync optionnelle via export/import JSON.
- App utilisée en répétition et potentiellement en live → la
  réactivité et la fiabilité offline priment sur tout le reste.

## Architecture cible

```
src/
  core/                ← partagé entre tous les devices
    guitars.js         ← GUITARS, GUITAR_PROFILES, GUITAR_BRANDS
    songs.js           ← INIT_SONG_DB_META, SONG_HISTORY, SONG_PRESETS
    setlists.js        ← INIT_SETLISTS, helpers
    scoring/
      pickup.js        ← computePickupScore, BASE_SCORES
      guitar.js        ← computeGuitarScoreV2, helpers GUITAR_PROFILES
      style.js         ← STYLE_COMPATIBILITY, getGainRange
      index.js         ← SCORING_VERSION, weights, agrégateur
    ai/
      providers.js     ← OpenAI, Anthropic
      prompts.js
      cache.js         ← updateAiCache, invalidation versionnée
  devices/
    registry.js        ← registerDevice, getEnabledDevices
    tonex-pedal/
      catalog.js       ← presets + bank model 50 slots
      scoring.js       ← spécifique captures
      RecommendBlock.jsx ← UI bloc Pedal du Recap
    tonex-plug/
      catalog.js
      scoring.js
      RecommendBlock.jsx
    tonemaster-pro/
      chain-model.js   ← TMPPatch = chaîne de 5 blocs
      catalog.js       ← amps, cabs/IRs, drives, FX
      scoring.js
      RecommendBlock.jsx
  app/
    App.jsx            ← router + screen dispatch
    screens/           ← HomeScreen, RecapScreen, SetlistsScreen,
                         SynthesisScreen, JamScreen, PresetBrowser,
                         BankOptimizerScreen, MonProfilScreen, etc.
    components/        ← composants partagés (PBlock, Breadcrumb…)
    hooks/             ← useLocalState, useProfile, etc.
  data/                ← preset_catalog_full, data_catalogs,
                         data_context (chargés en lazy si possible)
  index.html
  main.jsx
public/
  manifest.json
  icon-192.svg
  icon-512.svg
  sw.js                ← service worker (sortir du HTML)
```

## Contraintes techniques

- **Build** : Vite + `vite-plugin-singlefile` pour produire un HTML
  mono-fichier auto-suffisant déployable sur GitHub Pages. La sortie
  `dist/index.html` doit fonctionner ouvert seul (file://) et
  installé en PWA.
- **Service Worker** : conserver le comportement actuel (cache
  offline). Stratégie souhaitée : `stale-while-revalidate` sur le
  HTML pour que les nouvelles versions soient prises sans devoir
  vider le cache. Bumper `CACHE` à chaque release.
- **localStorage** : NE JAMAIS casser les données utilisateurs
  existantes. Toute migration doit être versionnée
  (`STATE_VERSION`), idempotente, et couverte par un test.
- **Pas de TypeScript** pour minimiser la rupture avec l'existant.
  JS uniquement, JSDoc pour les types complexes si nécessaire.
- **React 18** (pas de Server Components, pas de Suspense côté serveur).
- **Pas de framework UI** lourd : composants maison + Tailwind si on
  veut, sinon CSS via tokens.css comme aujourd'hui.

## Tests

- **Vitest** pour les utilitaires purs et le scoring.
- Tests **obligatoires** sur tout fichier dans `core/scoring/` et sur
  toute migration de localStorage.
- Snapshot du comportement de scoring **AVANT** toute refacto
  significative — c'est le filet de sécurité.
- Le scoring V9 actuel (`SCORING_VERSION = 9`) doit rester stable
  octet par octet aussi longtemps qu'on n'a pas explicitement décidé
  d'un V10. Les snapshots Vitest dans `src/core/scoring/__snapshots__/`
  font foi : 32 valeurs déterministes capturées en Phase 1 (38 tests,
  6 styles × HB drive + 5 fallbacks + 11 guitares × 2 fonctions sur
  ledzep_stairway + 5 cas redistribution).

## Doc Recos

Le détail du pipeline de recommandation (scoring V9, prompt IA,
override Phase 7.31, modes reco, biais, usages catalog, garde-fous
Phase 7.34 anti cross-contamination, etc.) est documenté dans
`docs/SCORING.md`. À lire quand on touche au scoring, au prompt
`fetchAI`, ou à `enrichAIResult`.

## Style de code

- Composants fonctionnels avec hooks. Pas de classes.
- Pas de PropTypes (JS sans types).
- ESLint avec eslint-config-react-app si on en met un.
- Préférer les fichiers courts (cible <300 lignes, plafond 500).
- Noms français acceptés pour le contenu utilisateur (descriptions,
  labels) ; noms anglais pour le code.
- Le contenu utilisateur (descriptions de morceaux, notes, packs) est
  en français.

## Conventions Git

- Une branche par phase : `phase-1-vite-core`, `phase-2-device-registry`,
  `phase-3-tmp`, `phase-4-scenes`, `phase-5-polish`.
- Commits petits et atomiques avec préfixe : `[phase-1] extract scoring`.
- Avant tout commit : `npm test` ET `npm run build` doivent passer.
- Avant tout merge dans `refactor-and-tmp` : revue par moi
  + test manuel sur PWA installée.
- Tag de stabilité avant chaque phase : `git tag phase-N-done`.

## Décisions de modèle (à étoffer au fil des phases)

### AI cache — guitar list (Phase 3.6)

La liste de guitares utilisée pour générer `cot_step2_guitars` dans
`aiCache.result` est l'**UNION des guitares de tous les profils**
(Sébastien + Arthur + Franck + …), pas seulement le profil actif.

Cela permet à un profil non-admin (ex. Arthur, Franck) de voir ses
guitares custom dans les recommandations dès la première ouverture
d'un morceau, sans avoir à déclencher un recalcul lui-même. Calcul
côté `src/core/state.js` via `getAllRigsGuitars(profiles,
customGuitars, GUITARS)` ; mémoïsé au niveau App et propagé à
`ListScreen` + `SongDetailCard` via la prop `allRigsGuitars`.

Conséquence : le bouton "🎸 Recalculer IA pour toutes les guitares"
de `MaintenanceTab` (Phase 3.5) se contente d'invalider `aiCache`. Le
prochain re-fetch passif (à l'ouverture d'un morceau) utilise
automatiquement l'union all-rigs.

Pas d'éditions per-profile (`editedGuitars`) appliquées sur l'union :
une guitare est identifiée par son id canonique. Si un profil a édité
localement le nom d'une guitare standard, c'est l'objet brut de
`GUITARS` qui sera poussé au prompt. Acceptable Phase 3.6.

### Modèle TMP (Phase 3 — décisions validées)

Toutes les décisions ci-dessous sont fixes pour Phase 3. Claude
Code et l'IA doivent les respecter à la lettre.

#### Forme de données

```
TMPBlock = {
  type: 'comp'|'drive'|'amp'|'cab'|'mod'|'delay'|'reverb',
  model: string,            // référence à la whitelist (voir plus bas)
  enabled: boolean,
  params: { [k]: number }   // jusqu'à 5 paramètres principaux
}

TMPPatch = {
  id, name,
  comp?: TMPBlock,
  drive?: TMPBlock,
  amp: TMPBlock,            // obligatoire
  cab: TMPBlock,            // obligatoire
  mod?: TMPBlock,
  delay?: TMPBlock,
  reverb?: TMPBlock,
  notes?: string,
  style: 'blues'|'rock'|'hard_rock'|'jazz'|'metal'|'pop',
  gain: 'low'|'mid'|'high',
  pickupAffinity: { HB: number, SC: number, P90: number },  // 0-100
  factory?: boolean,
  // Phase 3.8 — Conseils de jeu spécifiques à un morceau (id du
  // INIT_SONG_DB_META, ex. cream_wr, bbking_thrill). Affichés en bas
  // du drawer du RecommendBlock TMP sous "💡 Conseil pour ce
  // morceau" si song.id matche une clé.
  playingTipsBySong?: { [songId: string]: string },
  scenes?: TMPScene[],         // Phase 4
  footswitchMap?: {            // Phase 4
    fs1?, fs2?, fs3?, fs4?
  }
}
```

#### Paramètres standards par bloc (5 max)

- **comp** : threshold, ratio, attack, release, level
- **drive** : drive, tone, level, presence?, mix?
- **amp** : gain, bass, mid, treble, presence
- **cab** : low_cut, high_cut, depth, color, level
- **mod** : rate, depth, mix, feedback, type
- **delay** : time, feedback, mix, hi_cut, low_cut
- **reverb** : decay, mix, hi_cut, low_cut, predelay

#### Pondération du scoring TMP

```
amp model              : 0.45
cab/IR                 : 0.20
drive                  : 0.15
fx (mod/delay/reverb)  : 0.05
style match            : 0.10
pickup affinity        : 0.05
```

#### Stratégie cabs/IRs (v1)

Nom symbolique uniquement, jamais de chemin de fichier ni d'upload
IR. Format : `"<config> <model> <speaker>"`, ex.
`"4x12 British Plexi Greenback"`. v2 ajoutera le support du
chemin de fichier IR uploadé.

#### Stratégie de génération des patches factory (v1)

Claude Code génère ~30 patches factory pour les morceaux du seed
(`INIT_SONG_DB_META`) en s'appuyant sur :
- `SONG_HISTORY` (guitariste / amp / effets historiques)
- Les packs TSR ToneX référencés pour chaque morceau (déjà
  mappés dans `SONG_PRESETS`)

Les patches générés sont marqués `factory: true` et modifiables
via une UI d'édition (la modif est stockée séparément en
`tmp.factoryPatchOverrides`, jamais dans le catalog).

#### Whitelist amp models TMP (firmware v1.6)

Claude Code et l'assistant IA ne peuvent référencer que les amp
models de cette liste. Tout amp inventé hors liste = rejet du
patch.

**Marshall-style :**
- "British Plexi" (Marshall Plexi 1959)
- "British 45" (Marshall JTM45)
- "British 800" (Marshall JCM800)
- "British Jubilee Clean", "British Jubilee Rhythm", "British Jubilee Lead"
- "Brit Breaker" (Marshall Bluesbreaker 1962)

**Fender-style :**
- "Fender '57 Deluxe"
- "Fender '59 Bassman"
- "Fender '59 Bassman Custom"
- "Fender '62 Princeton"
- "Fender '65 Deluxe Reverb"
- "Fender '65 Deluxe Reverb Blonde NBC"
- "Fender '65 Princeton Reverb"
- "Fender '65 Super Reverb"
- "Fender '65 Twin Reverb"
- "Fender Blues Junior"
- "Fender Blues Junior LTD"
- "Fender Bassbreaker"
- "Fender Vibro-King"

**Boutique / autres :**
- "UK 30 Brilliant" (Vox AC30)
- "JC Clean" (Roland JC-120)
- "Marksman CH1" (Mesa Mark)
- "Solo 100 Overdrive" (Soldano SLO 100)
- "Tangerine RV53" (Orange Rockerverb)
- "Double Wreck" (Mesa Dual Rectifier)
- "EVH 5150 6L6 Green", "EVH 5150 6L6 Blue"

#### Whitelist cabs TMP (sélection v1)

- "1x10 '62 Princeton C10R"
- "1x12 '57 Deluxe"
- "1x12 '57 Deluxe Alnico Blue"
- "1x12 '65 Deluxe C12K"
- "1x12 '65 Deluxe Creamback"
- "1x12 Bassbreaker"
- "1x12 Blues Junior C12N"
- "2x12 '65 Twin C12K"
- "4x12 British Plexi Greenback"
- "4x12 British 800 G12T"
- "4x12 Brit Breaker"
- "4x12 EVH 5150"

#### Whitelist drives TMP (sélection v1)

- "Tube Screamer" (Ibanez TS-808/TS-9)
- "Klon" (Klon Centaur)
- "Boost" (boost transparent)
- "OD-1" (Boss OD-1)
- "Blues Driver" (Boss BD-2)
- "Rat" (ProCo Rat)
- "Big Muff" (Electro-Harmonix Big Muff Pi)
- "DS-1" (Boss DS-1)

#### Whitelist FX TMP (mod/delay/reverb, sélection v1)

- **mod** : "Chorus", "Phaser", "Flanger", "Tremolo", "Vibrato", "Univibe"
- **delay** : "Analog Delay", "Tape Echo", "Digital Delay", "Reverse Delay"
- **reverb** : "Spring", "Plate", "Hall", "Room", "Shimmer"

### Modèle Scenes / Footswitches / Mode scène live (Phase 4 — décisions validées)

#### Décision 1 — Nombre de Scenes par patch

Modèle flexible : 0 à N Scenes par patch (pas de limite imposée).
Patches simples sans Scene = comportement actuel inchangé.
Patches avec Scenes : 2-4 typique (ex. "Rythme" + "Solo", ou
"Intro" + "Verse" + "Chorus" + "Solo").

#### Décision 2 — Mapping footswitch

**TMP** : 4 footswitches assignables (FS1-FS4). Mapping manuel
dans l'UI d'édition du patch via 4 dropdowns. Options possibles
par dropdown :
- Switcher vers Scene X (du patch courant)
- Toggle Drive on/off
- Toggle Delay on/off
- Toggle Reverb on/off
- Tap Tempo (BPM du delay/reverb)
- (Phase 5+) MIDI CC out

**ToneX (Pedal/Anniversary/Plug)** : footswitches gérés par le
hardware (Bank up/down + slot A/B/C). L'appli ne mappe pas les
footswitches ToneX — elle ne fait qu'AFFICHER lequel des slots
A/B/C est recommandé (pour aider l'utilisateur à choisir le bon
footswitch en live).

#### Décision 3 — Mode scène live (LiveScreen)

Plein écran iPad (idéalement orientation paysage), 1 morceau à
la fois.

**Layout commun à tous les devices** :
- Titre du morceau en gros (~48pt) en haut
- BPM + tonalité (key) sous le titre
- Liste des artistes/refs originaux (compact, en bas)
- Swipe gauche/droite pour naviguer dans la setlist
- Bouton "🔒 Garder écran allumé" (Wake Lock API si dispo,
  fallback "screen on" prompt si non supporté)
- Bouton "← Sortir" en haut à gauche pour revenir à Setlists

**Bloc par device activé** (1 sous-bloc par device dans
enabledDevices, layout vertical) :

Pour **TMP** :
- Nom du patch recommandé
- Liste des Scenes du patch (badges horizontaux), Scene
  active surlignée
- 4 cards FS1-FS4 en bas montrant l'action mappée pour chaque
  footswitch dans le morceau courant
- Bloc compact avec drawer expandable si besoin de voir détail

Pour **ToneX (Pedal/Anniversary/Plug)** :
- Nom du preset recommandé + position (Bank X, Slot Y)
- Les 3 slots A/B/C de la bank courante affichés en cards,
  celui recommandé surligné
- Texte d'aide : "Footswitch bank up/down sur ton TMP/Anniversary/Plug
  pour changer de bank"

#### Décision 4 — BPM et tonalité par morceau

Champs simples ajoutés au modèle song :
- `bpm: number` (typiquement 60-200, optionnel)
- `key: string` (notation simple : "E", "A minor", "C#", "F# minor", optionnel)

Pré-remplis pour les 13 morceaux du seed (à fournir lors de
Phase 4). Éditables dans la fiche morceau via 2 nouveaux
champs.

#### Décision 5 — Extension ToneX (pas que TMP)

Le mode scène fonctionne pour **tous les devices activés**.
Sébastien (Anniversary + Plug) bénéficie du mode scène autant
qu'Arthur (TMP). Implémentation via convention sur le registry :

- Chaque device expose un composant optionnel `LiveBlock` (en
  plus du `RecommendBlock` Phase 3).
- Si présent, LiveScreen le rend dans la liste des blocs par
  device. Sinon, fallback sur un affichage minimal.
- TMP : son LiveBlock affiche Scenes + footswitch map.
- ToneX : son LiveBlock affiche bank slot recommandé + 3 slots
  A/B/C.

#### Modèle de données étendu

```
TMPScene = {
  id: string,
  name: string,                                 // 'Intro', 'Solo', 'Rythme'…
  blockToggles?: {                              // surcharges des "enabled" des blocs
    comp?: boolean, drive?: boolean, mod?: boolean,
    delay?: boolean, reverb?: boolean, noise_gate?: boolean,
    eq?: boolean
  },
  paramOverrides?: {                            // surcharges de params spécifiques
    [blockType: string]: { [paramKey: string]: number }
  },
  ampLevelOverride?: number                      // ex. 100 pour scene Solo
}

TMPPatch.scenes?: TMPScene[]                     // optionnel, déjà dans le type Phase 3
TMPPatch.footswitchMap?: {
  fs1?: { type: 'scene', sceneId: string }
       | { type: 'toggle', block: 'drive'|'delay'|'reverb'|... }
       | { type: 'tap_tempo' },
  fs2?: ..., fs3?: ..., fs4?: ...
}

Song.bpm?: number                                // ajout Phase 4
Song.key?: string                                // ajout Phase 4
```

#### Patch Arthur Rock Preset — Scenes pré-renseignées

Le footswitch solo d'Arthur (Amp Level 70%→100%) devient une
vraie Scene en Phase 4 :

```
rock_preset.scenes = [
  { id: "rythme", name: "Rythme", ampLevelOverride: 70 },
  { id: "solo",   name: "Solo",   ampLevelOverride: 100 }
]
rock_preset.footswitchMap = {
  fs1: { type: 'scene', sceneId: 'rythme' },
  fs2: { type: 'scene', sceneId: 'solo' }
}
```

Les notes Phase 3.8 ("Footswitch solo : monte Amp Level…") sont
remplacées par la Scene effective.

#### Ajouts à la whitelist (issus des patches Arthur)

**Drives ajoutés** :
- "Super Drive" (Boss SD-1, distinct du Tube Screamer — overdrive plus compressé, mid bump plus prononcé)

**Cabs ajoutés** :
- "4x10 '59 Bassman Tweed" (la config iconique 4x10 du Bassman tweed)
- "2x12 Twin D120" (variante du 2x12 Twin avec speakers JBL D120F au lieu de Jensen C12K — son plus claquant, plus brillant, utilisé par Joe Walsh et John Mayer)

**Comp ajouté** :
- "Studio Compressor" (compresseur studio à 6 paramètres : gain, threshold, ratio, attack, release, knee + blend pour parallèle)

**Nouveaux types de bloc** (étendent la liste à 9 au lieu de 7) :

- **noise_gate** : params threshold, attenuation
- **eq** : params low_freq (Hz), low_gain (dB), mid_freq (Hz), mid_gain (dB), hi_gain (dB) — modèle simplifié 3-bandes (le TMP supporte 5 bandes paramétriques mais on simplifie pour rester à 5 params)

Modèles dispo pour ces nouveaux blocs :
- **noise_gate** : "Noise Reducer" (générique)
- **eq** : "EQ-5 Parametric" (TMP standard)

#### Patches TMP de référence — Arthur (firmware v1.6, jouant sur Gibson SG 61 + Epiphone ES-339)

Ces 3 patches sont des **patches réels validés** d'Arthur, à utiliser comme seed pour générer les patches factory. Les valeurs des knobs sont mesurées approximativement depuis ses screenshots iPad — ±1 sur l'échelle 0-10.

**Patch 1 — "Rock Preset" (slot Arthur 211/213)**

> ⚠️ **VALEURS CORRIGÉES Phase 3.8 suite retour utilisateur du 10 mai 2026.**
> Les screenshots iPad d'origine étaient mal lus (Plexi en réalité
> cranked à 10/10, drive bien plus discret, treble plus poussé,
> bass à zéro). Valeurs validées en direct par Arthur — ne pas
> rebasculer sur les anciennes lectures.

Usages : AC/DC (TNT, Thunderstruck, Highway to Hell, Back in Black, Hells Bells, You Shook Me All Night Long), Cream "White Room", Deep Purple "Smoke on the Water"

```
{
  noise_gate: { model: "Noise Reducer", enabled: true,
                params: { threshold: 10, attenuation: 10 } },
  drive: { model: "Super Drive", enabled: true,
           params: { drive: 2.5, level: 3, tone: 8 } },
  amp: { model: "British Plexi", enabled: true,
         params: { volume_i: 10, volume_ii: 10, treble: 8.5,
                   middle: 5, bass: 0, presence: 5 } },
         // amp_level: 70% rythmique → 100% via footswitch solo
         // (Phase 4 : modélisé en Scene). Gate amp OFF.
  cab: { model: "4x12 British Plexi Greenback", enabled: true,
         params: { mic: "Dyn SM57", axis: "on", distance: 6,
                   low_cut: 20, high_cut: 20000 } },
  delay: { model: "Digital Delay", enabled: true,
           params: { time: 350, feedback: 25, mix: 15, hi_cut: 6000, low_cut: 100 } },
  reverb: { model: "Spring", enabled: true,
            params: { mixer: 2.5, dwell: 8, tone: 6, predelay: 0,
                      hi_cut: 8000, low_cut: 100 } },
  notes: "Footswitch solo : monte Amp Level de 70% à 100% pour les solos AC/DC. Phase 4 modélisera ça comme une vraie Scene TMP.",
  playingTipsBySong: {
    cream_wr: "Sur ce morceau : micro manche + tonalité à 0 pour adoucir le drive."
  },
  style: 'hard_rock',
  gain: 'mid',
  pickupAffinity: { HB: 95, SC: 70, P90: 80 }
}
```

**Patch 2 — "Clean Preset" (slot Arthur 210)**

Usages : BB King "The Thrill is Gone" (Arthur joue avec son Epiphone ES-339, pas la SG)

```
{
  eq: { model: "EQ-5 Parametric", enabled: true,
        params: { low_freq: 98, low_gain: -12, mid_freq: 2000, mid_gain: 2, hi_gain: -3 } },
  // low_gain -12 = low cut 6dB/Oct depuis 98Hz
  comp: { model: "Studio Compressor", enabled: true,
          params: { threshold: 5, ratio: 5, attack: 5, release: 5, level: 5 } },
  amp: { model: "Fender '65 Twin Reverb", enabled: true,
         params: { gain: 4, treble: 4, mid: 6, bass: 7, presence: 5 } },
  // amp_level: 70%, bright switch OFF, gate amp OFF
  cab: { model: "2x12 Twin D120", enabled: true,
         params: { mic: "Ribbon R121", axis: "off", distance: 3,
                   low_cut: 20, high_cut: 20000 } },
  reverb: { model: "Spring", enabled: true,
            params: { mixer: 3, dwell: 7, tone: 6, predelay: 0,
                      hi_cut: 8000, low_cut: 100 } },
  style: 'blues',
  gain: 'low',
  pickupAffinity: { HB: 90, SC: 75, P90: 85 }
}
```

**Patch 3 — "Flipper" (slot Arthur 202)**

Usages : Téléphone "Flipper"

```
{
  amp: { model: "Fender '59 Bassman", enabled: true,
         params: { gain: 6, treble: 7, mid: 7, bass: 8, presence: 6 } },
  // amp_level: 70%, gate amp MAX, scale du Bassman 1-12 (pas 0-10)
  cab: { model: "4x10 '59 Bassman Tweed", enabled: true,
         params: { mic: "Dyn SM57", axis: "on", distance: 6,
                   low_cut: 20, high_cut: 20000 } },
  reverb: { model: "Spring", enabled: true,
            params: { mixer: 3, dwell: 7, tone: 6, predelay: 0,
                      hi_cut: 8000, low_cut: 100 } },
  style: 'rock',
  gain: 'mid',
  pickupAffinity: { HB: 90, SC: 80, P90: 85 }
}
```

#### Patterns extraits des patches Arthur (à exploiter par Claude Code pour générer les autres factory patches)

1. **Reverb signature stable** : Spring Reverb {mixer:3, dwell:7, tone:6} sur les 3 patches → utiliser ces valeurs comme défaut universel pour tout patch nécessitant une reverb spring.
2. **Amp Level systématique à 70%** sur tous les patches → défaut.
3. **Mic SM57 axis-on à 6"** pour les sons crunch/rock, **Mic R121 off-axis à 3"** pour les sons clean/blues → règle de défaut.
4. **Low cut + High cut à 20Hz/20kHz** = pas de cut au niveau cab → défaut.
5. **Style hard_rock** → drive en boost (low gain, high level), amp Plexi/JCM, cab 4x12 Greenback, reverb spring discrète.
6. **Style blues** → comp + EQ shaping, amp Fender clean, cab 2x12 Twin (Ribbon mic), reverb spring discrète.
7. **Style rock** (genre Téléphone) → '59 Bassman cranked + 4x10 Bassman + Spring Reverb, sans drive ni FX (chaîne minimaliste).

## Scripts disponibles

```
npm install        # installer les deps
npm run dev        # serveur de dev Vite, hot reload sur http://localhost:5173
npm run build      # produit dist/index.html mono-fichier (~786 KB)
npm run preview    # sert dist/ pour test final sur http://localhost:4173
npm test           # Vitest run, 57 tests sur core/scoring + devices
npm run test:watch # Vitest watch mode
```

## Workflow de déploiement

Le site est servi par GitHub Pages depuis la branche `main` du repo
`FF2T/tonex-setlist-guide`. Les artefacts déployés vivent à la
RACINE de `main` :

- `index.html` (le bundle mono-fichier Vite)
- `sw.js` (le service worker)
- `ToneX_Setlist_Guide.html` (redirect HTML legacy pour les anciens
  bookmarks et PWA installées pré-7.29)
- `CNAME` (custom domain `mybackline.app`)

Le développement et les commits incrémentaux se font sur
`refactor-and-tmp`. Le `dist/` est gitignored sur cette branche, donc
le build doit être copié manuellement vers `main` au déploiement.

### Workflow recommandé (via git worktree)

Le worktree évite tout switch de branche sur le checkout principal —
zéro risque sur le workspace `refactor-and-tmp` (qui peut avoir des
fichiers staged/non-committés sans rapport avec le déploiement).

```bash
# 1. Depuis refactor-and-tmp : build + commit + push de la branche
git push origin refactor-and-tmp     # (et tags si applicable)
npm test                              # 710/710 verts
npm run build                         # produit dist/index.html + dist/sw.js

# 2. Créer un worktree pour main à côté
git worktree add ../ToneX-main main

# 3. Copier les artefacts depuis dist/
cp dist/index.html ../ToneX-main/index.html
cp dist/sw.js ../ToneX-main/sw.js

# 4. Commit + push depuis le worktree main
cd ../ToneX-main
git add index.html sw.js
git commit -m "Update prod with Backline vX.Y.Z (Phase N.M)"
git push origin main

# 5. Nettoyer le worktree
cd -
git worktree remove ../ToneX-main
```

GitHub Pages redéploie automatiquement en 30-60s après le push sur
`main`. Vérifier le déploiement en rechargeant `mybackline.app` et
en confirmant `vX.Y.Z` dans le header.

### À NE PAS faire

- ~~`cp dist/index.html main:/index.html`~~ — le préfixe `main:/`
  n'existe pas en bash, c'était un raccourci ambigu dans d'anciennes
  notes. Le déploiement nécessite forcément d'accéder à un checkout
  de la branche `main` (worktree ou switch).
- `git checkout main` directement depuis `refactor-and-tmp` quand il
  y a des fichiers staged/non-committés non destinés à `main` (genre
  BETA_TESTING.md, handoff/, etc.). Le worktree contourne ce piège.
- Pousser sans avoir bumpé `APP_VERSION` (`src/main.jsx`) ET `CACHE`
  (`public/sw.js`) — sinon le SW garde l'ancien cache et les
  utilisateurs ne voient pas la mise à jour.

### Versions à bumper à chaque release applicative

- `src/main.jsx` : `const APP_VERSION = "X.Y.Z";`
- `public/sw.js` : `const CACHE = 'backline-vNNN';`

Les deux doivent monter ensemble. Le SW utilise `CACHE` pour purger
automatiquement les anciens caches via le filtre `k !== CACHE` dans
son handler `activate`.

## État actuel (2026-05-16, Phase 7.52.5 close — Post-processing pin usages-match)

**Backline v8.14.67 / SW backline-v167 / STATE_VERSION 9 / 977 tests verts.**
Phase 7.52.5 garantit la PRIORITÉ 1 du prompt Phase 7.34 + 7.52.1
("capture dont les `usages` contiennent l'artiste OU le titre du
morceau analysé") via un **post-processing JS** dans `enrichAIResult`,
même quand Gemini Flash ne respecte pas l'instruction.

**Cas observé 2026-05-16** : sur le snapshot démo re-généré post-Phase
7.52.4, les recos Cream étaient :
- White Room → `AA VX TB30 BR Edge BAL CAB` (Vox AC30) au lieu de
  `AA MRSH SB100 I Edge WRM CAB` (Marshall Super Bass Plexi 1968,
  usages explicit `Cream: [White Room, Sunshine of Your Love]`).
- Sunshine of Your Love → `AA FMAN B100D BE Drive` (Friedman BE-100,
  amp moderne 2009+) au lieu de SB100.

Le slot SB100 ÉTAIT dans les banks démo (bank 8A) avec usages catalog
correctement set. Le prompt Phase 7.52.1 sérialisait `usages: [Cream
(White Room, Sunshine of Your Love)]` dans la section INSTALLED SLOTS.
**Mais Gemini Flash a pinné autre chose** — fail de l'instruction
prompt "PRIORITÉ ABSOLUE 1".

### Fix Phase 7.52.5

`src/app/utils/ai-helpers.js` étendu avec :

- **`findSlotByUsageMatch(banks, songArtist, songTitle)`** : scan
  banks, retourne le slot dont `catalog.usages` match :
  - **Score 100** : `usages.artist === song.artist` ET
    `usages.songs.contains(song.title)` (match parfait).
  - **Score 50** : `usages.artist === song.artist` seul (artiste
    match, titre absent ou pas dans liste).
- **Override dans `enrichAIResult`** (avant le never-regress) : si
  score 100 trouvé → **force le pin** sur ce slot avec score 92,
  override le pin IA précédent (Phase 7.31). Score 50 → fallback
  uniquement si l'IA n'a pas déjà pin un slot.
- **Param `song` ajouté** (7e position) à `enrichAIResult` pour
  passer `song.artist` + `song.title`. Optionnel → si absent, pas de
  post-processing usages-match (comportement Phase 7.52.4 inchangé).

### Call sites mis à jour (passent `song`)

```
src/app/utils/fetchAI.js                ligne 262 ✓
src/app/screens/SongDetailCard.jsx      lignes 74, 118 ✓
src/app/screens/ListScreen.jsx          lignes 152, 594 ✓
src/app/screens/RecapScreen.jsx         ligne 130 ✓
src/app/screens/HomeScreen.jsx          ligne 385 ✓ (autocomplete)
                                        ligne 540 — non touché (sound
                                                    preview, song au
                                                    scope difficile)
src/main.jsx                            ligne 695 — non touché (recalc
                                                    batch admin, song
                                                    au scope diff)
```

### Architecture livrée Phase 7.52.5

```
src/main.jsx                            APP_VERSION 8.14.66 → 8.14.67
public/sw.js                            CACHE backline-v166 → backline-v167
src/app/utils/ai-helpers.js             +findSlotByUsageMatch helper pur
                                        enrichAIResult +param song
                                        override post-processing
                                        +export findSlotByUsageMatch,
                                          findSlotByName
src/app/utils/ai-helpers.test.js        +8 tests findSlotByUsageMatch
                                        (titre exact 100, artiste seul 50,
                                        case-insensitive, banks vides,
                                        artiste/titre inconnus, falsy)
+5 call sites mis à jour pour passer song
```

### Conséquences

- **977/977 tests verts** (+8 nouveaux Phase 7.52.5).
- **Bundle** 2122 → 2124 KB (+2 KB pour le helper + override).
- **Pas de bump SCORING_VERSION** (V9 inchangé, c'est un override
  d'affichage post-scoring).
- **Effet sur les recos existantes** : à la prochaine ouverture d'un
  morceau, `enrichAIResult` recompute → si le morceau a un slot
  usage-match titre dans les banks, il est pinné automatiquement.
  Pas besoin d'invalider les caches IA — le post-processing est
  appliqué à chaque render. Mais une ré-analyse complète garantit
  que les autres champs (cot_step1, settings_preset, etc.) soient
  cohérents avec le nouveau choix.

### Captures Anniversary Premium avec usages match-titre exact (32 entries)

Toutes les entries Phase 7.52 + 7.52.3 avec `usages: [{artist, songs}]`
explicit bénéficieront du pin automatique pour les morceaux concernés :

- **AC/DC** : 6 chansons (HtH, BiB, TNT, You Shook Me, Hells Bells,
  Whole Lotta Rosie) → AA MRSH JT50 I Drive BAL SCH CAB
- **Cream** : 2 chansons (White Room, Sunshine of Your Love) →
  AA MRSH SB100 I Edge WRM CAB
- **Jimi Hendrix** : 2 chansons (Voodoo Child, Purple Haze) →
  AA MRSH SL100 JU Dimed BAL CAB
- **Led Zeppelin** : 2 chansons (Whole Lotta Love, Black Dog) →
  AA MRSH SL100 JU Dimed BAL CAB
- **Black Sabbath** : 3 chansons (Paranoid, Iron Man, War Pigs) →
  AA ORNG 120 Dimed BAL CAB (à noter : décision Phase 7.52, mais
  historiquement débattable — cf section Idées en attente Phase 7.53)
- **Metallica** : 1 chanson (Master of Puppets) → AA MES MKIICP LD
- **Dream Theater** : 1 chanson (Pull Me Under) → AA MES MKIICP LD
- **The Who** : 2 chansons (Won't Get Fooled Again, Baba O'Riley) →
  AA HWTT CUT100 NR Clean
- **Eric Johnson** : 1 chanson (Cliffs of Dover) → AA SLDN SL100 OD ou
  TSR TSR20 + SLOW
- **Robben Ford** : 1 chanson (Help the Poor) → TJ DMBL ODS 124 LEAD 1
- **Jimmy Page** : 1 chanson (Whole Lotta Love) → TSR Mars Plexi Cn2 Cranked
- **Slash** : 1 chanson (Sweet Child O'Mine) → JS Brit Silver Dbl Crm OD
- **Hendrix WT** : 1 chanson (Voodoo Child) → WT Mars Super100 JMP 5
- **Metallica TSR** : 1 chanson (Master of Puppets) → TSR Mesa Mark V Cn3 LD 1

### Action post-déploiement

1. Reload PWA 2x, vérifier `v8.14.67`.
2. Mon Profil → 🎯 Préférences IA → "🗑 Invalider tous les caches IA"
   (admin) — déclenche ré-analyse au prochain mount des morceaux.
3. OU passer juste sur les morceaux concernés : l'override usages-match
   s'applique au render, donc juste ouvrir + refermer fait remonter
   le bon slot.
4. **Re-export snapshot démo** depuis profil curateur pour bénéficier
   des recos Cream → AA MRSH SB100 (slot 8A) + autres titres-match.

### Dette résiduelle Phase 7.52.5

- **Override "agressif"** : le score 100 (titre + artiste) force le
  pin même si l'IA avait pin un autre slot. Si l'utilisateur voulait
  garder le choix IA (cas dégénéré : l'IA a choisi un slot plus
  approprié à son rig / style préféré), un feedback "❌ pas ce slot"
  ne suffira pas à dépin. **Workaround** : retirer la capture
  usage-match de la bank, ou éditer le catalog pour retirer le titre
  des usages.
- **Sites non-passants song** : 2 call sites n'ont pas `song` au
  scope (main.jsx l. 695 recalc batch admin, HomeScreen l. 540 sound
  preview après changement guitare). Le post-processing ne s'applique
  pas dans ces cas (acceptable, ce sont des cas marginaux).
- **Smoke on the Water (Deep Purple)** : Phase 7.52.5 ne fix pas ce
  cas car aucune capture du catalog n'a `usages: Deep Purple` ou
  `Smoke on the Water`. L'IA continuera à choisir un fallback
  arbitraire (vu Phase 7.52.3 : AA MRSH JT50 = AC/DC sur Deep
  Purple, cross-contamination). Pour fixer : ajouter une capture
  Marshall Plexi avec usages Deep Purple, ou retirer Deep Purple des
  usages AA MRSH JT50.

---

## État précédent (2026-05-15, Phase 7.52.4 close — findCatalogEntry fallback toneModelName)

**Backline v8.14.66 / SW backline-v166 / STATE_VERSION 9 / 969 tests verts.**
Phase 7.52.4 corrige le matching firmware vs catalog quand le **Tone Model
Name** (col 2 du PDF) diverge du **Preset Name** (col 1).

**Cas observé 2026-05-15** : Sébastien voit dans sa pédale physique
Anniversary les noms `TSR D13 Best Tweed Ever Clean`, `TSR - TSR20 -
Light Gain P`, `TSR Freeman X Clean??`, etc. (= Tone Model Name col 2
du PDF). Mes keys Phase 7.52.3 utilisent le Preset Name (col 1 du
PDF), donc `findCatalogEntry("TSR D13 Best Tweed Ever Clean")` ne
matchait pas → fallback `guessPresetInfo` → metadata grossière → pas
d'usages exploitables au prompt IA.

### Fix Phase 7.52.4

`src/core/catalog.js:findCatalogEntry` enrichi avec 2 fallbacks :
- **Exact match toneModelName** : après lookup direct, boucle sur le
  catalog merged et compare `v.toneModelName === name`. Couvre tous
  les cas où le firmware utilise le Tone Model Name.
- **Fuzzy match toneModelName** : après normalisation
  (`normalizePresetName`), boucle sur `normalizePresetName(v.toneModelName)`.
  Couvre les variations casse/espaces/typos PDF (ex: `Slylark` vs
  `Skylark`, `LEAD` vs `Lead`).

Aussi : guard `typeof window !== 'undefined'` autour du check
`window._toneNetLookup` pour permettre l'exécution Vitest hors jsdom.

### Captures Anniversary qui résolvent désormais correctement (~25)

**Pack TSR** :
- `TSR Amp Nation ODR Clean 1` (vs Preset `TSR AmpNation ODR Clean 1`)
- `TSR - Rectified - Pushed`, `TSR - Rectified - Modern 1`,
  `TSR - Rectified - Vintage 2` (vs `TSR Rectified - ...`)
- `TSR - TSR20 - Light Gain P` (vs `TSR TSR20 + Light Gain`)
- `TSR - TSR20 + Candyman II`, `TSR - TSR20 + SLOW`
- `TSR D13 Best Tweed Ever Clean` (vs `TSR D13 Clean`)
- `TSR Freeman X Clean??` (vs `TSR Freeman X Clean`)
- `TSR Matchbox PeaceMaker` (vs `TSR Matchbox Peacemaker`, diff casse)
- `TSR MEGABABA CLEAN 2` (vs `TSR MEGABABA Clean 2`, diff casse)
- `TSR - Talon 50 - Clean`, `TSR - Talon 50 - Grit`, `TSR - Talon 50 - High Gain`

**Pack WT** :
- `WT TK IMPRL Lead 5` (vs `WT TK IMPRL LEAD 5`)
- `WT MSA TEXSTAR CH2 5`, `WT MSA TEXSTAR CH1 3`, `WT MSA TEXSTAR CH2 3`
  (vs `WT TEXSTAR Ch2 5`, etc.)
- `WT Mars Super100 JMP 5` (vs `WT Mars Super1100 JMP 5`, typo PDF)

**Pack TJ** :
- `TJ 68 Twin 15 N CLN`, `TJ 68 Twin 15 V DRTY` (vs `... 15  N ...` double espace)
- `TJ DMBL ODS 124 Lead 1`, `Lead 2` (vs `LEAD 1`, `LEAD 2`)
- `65 Cambridge N 4` (sans préfixe TJ — étrange dans PDF mais OK)
- `TJ 60s GA5 Skylark 2`, `TJ 60s GA5 Slylark 4 +` (typo `Slylark`)
  (vs `TJ Skylark 2`, `TJ Skylark 4+`)

### Architecture livrée Phase 7.52.4

```
src/main.jsx                            APP_VERSION 8.14.65 → 8.14.66
public/sw.js                            CACHE backline-v165 → backline-v166
src/core/catalog.js                     findCatalogEntry :
                                        +exact match toneModelName
                                        +fuzzy match toneModelName
                                        +guard typeof window pour Vitest
src/data/anniversary-premium-catalog.test.js
                                        +5 tests Phase 7.52.4
                                        (TSR D13, TSR20 Light Gain P,
                                        Freeman X Clean??, MSA TEXSTAR,
                                        unknown name → guessPresetInfo)
```

### Conséquences

- **969/969 tests verts** (+5 nouveaux Phase 7.52.4).
- **Bundle** 2122 KB → 2122 KB (stable).
- Sébastien (banks majoritairement remplies de TSR Anniversary Premium
  via Tone Model Names) bénéficie maintenant du pin direct via
  PRIORITÉ 1 du prompt Phase 7.34 + 7.52.1.
- **Pas de bump SCORING_VERSION** (V9 inchangé).
- **Pas de migration**.

### Action post-déploiement

1. Reload PWA iPhone + Mac, vérifier `v8.14.66`.
2. Mon Profil → 🎯 Préférences IA → "🗑 Invalider tous les caches IA"
   (admin).
3. Setlists → "🤖 Analyser/MAJ N" pour batch ré-analyse.
4. Vérifier sur un morceau Phil X que `TSR Freeman X Drive 3` (Sébastien
   bank 29B) remonte en top installé. Pareil pour Joe Walsh / Brad
   Paisley + `TSR ZWREK Riverside LG` (34C).

### Dette résiduelle Phase 7.52.4

- **Perf** : la boucle `Object.entries` pour le fallback toneModelName
  itère ~1700 entries du catalog merged à chaque miss. Si le profil
  a beaucoup de slots inconnus, ça peut être noticeable. Optim
  future possible : indexer un Map `toneModelName → entry` au load
  du catalog. Non urgent vu que ça ne s'exécute qu'au mount
  enrichAIResult (par morceau) et pas par render.
- **Pas testé en intégration sur une analyse IA complète** : les
  tests Vitest valident le helper isolé. Smoke-test manuel
  post-déploiement obligatoire pour confirmer que l'IA pin
  effectivement les bons slots.

---

## État précédent (2026-05-15, Phase 7.52.3 close — Audit + correctif noms TSR/WT vs PDF)

**Backline v8.14.65 / SW backline-v165 / STATE_VERSION 9 / 964 tests verts.**
Phase 7.52.3 corrige les 60 noms inventés des packs TSR (91-120) et WT
(121-150) du catalog Anniversary Premium Phase 7.52, en se basant sur
le PDF officiel `tone_models/TONEX_Pedal_Anniversary_Edition_Premium_Tone_Models.pdf`
pages 4-6 (2024/10/29).

**Bug Phase 7.52** : mes 30 entrées TSR (`"TSR Mars Anniv1 Cn1 Crunch"`,
`"TSR Mars JCM800"`, `"TSR EVH 5150 III Blue"`…) et 30 entrées WT
(`"WT VOX AC30 1964 TB CL"`, `"WT BAD Cub II R Clean"`…) étaient des
noms **inventés**, sans correspondance avec le PDF officiel IK Multimedia
ni avec les vrais slots dans les banks Anniversary du firmware. Diff
contre le legacy `ANNIVERSARY_CATALOG` (data_catalogs.js) avait révélé :
les packs AA/JS/TJ étaient corrects à 100% (mêmes keys que le PDF), mais
**TSR + WT divergeaient complètement** (60/60 keys hors-sujet).

**Conséquence Phase 7.52 + 7.52.1** : mon override Premium ne touchait
JAMAIS les vrais slots TSR/WT des banks du user. Les usages artist
(Phil X, Hendrix, Lincoln Brewster, etc.) sur ces entrées étaient
invisibles au prompt IA car aucun slot installé ne matchait ces noms
fantômes. Les vrais slots TSR/WT remontaient avec le legacy metadata
(grossier, sans usages).

### Fix Phase 7.52.3

- **30 entrées TSR réécrites** avec les vrais noms PDF :
  AmpNation ODR Clean 1, D13 Best Tweed Ever Drive, Freeman X Drive 3
  (Phil X), Matchbox Inde Klone Boost, MEGABABA DRIVE1, Rectified
  Pushed/Modern, Socks DC30 Wax-On, TSR20 + Light Gain/Candyman II/SLOW,
  ZWREK Crunch/Clean/Riverside LG, Talon 50 Clean/Grit/High Gain, etc.
- **30 entrées WT réécrites** avec les vrais noms PDF :
  64 AC30 Nm/Br 3-4, 77 ORNG OR120 3-5, 94 MATCH C30 AX/JMP/EF,
  BadKat C2R Focus/Spectrum, BNSN CHMR, TK IMPRL RHY/LEAD, MATCH CANYON,
  CarStar 53/58, TEXSTAR Ch1/Ch2, Mars Super100/Super1100 (PDF typo
  préservée), etc.
- **2 micro-corrections TJ** : `"TJ 68 Twin 15  N CLN"` et
  `"TJ 68 Twin 15  V DRTY"` (double espace réel du PDF, mes Phase 7.52
  avait single).
- **Usages préservés et migrés** :
  - WT Mars Super100 Br 5 → Hendrix
  - WT Mars Super1100 JMP 5 → Hendrix (Voodoo Child)
  - WT TEXSTAR Ch2 5 → Lincoln Brewster (Mesa Lonestar = signature)
  - WT 64 AC30 Br 4 → Brian May, The Edge
  - TSR Freeman X Drive 1/3 → Phil X
  - TSR ZWREK Crunch → Joe Walsh, Brad Paisley
  - TSR Rectified - Modern 1 → Tool, Metallica
  - TSR TSR20 + SLOW → Eric Johnson

### Architecture livrée Phase 7.52.3

```
src/main.jsx                                APP_VERSION 8.14.64 → 8.14.65
public/sw.js                                CACHE backline-v164 → backline-v165
src/data/anniversary-premium-catalog.js     Pack TSR (lignes 981-1300+) :
                                            30 entrées réécrites
                                            Pack WT (lignes ~1300-1600+) :
                                            30 entrées réécrites
                                            2 corrections TJ double espace
```

### Conséquences

- **964/964 tests verts** (aucune régression structurelle — schéma
  identique, même nb d'entrées par pack, même src=Anniversary).
- **Bundle** 2123 KB → 2122 KB (~stable).
- Les recos AC/DC restent stables (basées sur les entrées AA déjà OK
  Phase 7.52).
- Les recos Hendrix peuvent désormais préférer `WT Mars Super100 JH OD`
  (qui existe et a usages explicit Voodoo Child) au lieu de la 1ère
  capture Plexi générique.
- Les utilisateurs Worship avec setup Mesa Lonestar (Lincoln Brewster
  style) bénéficient maintenant du pin direct via PRIORITÉ 1.

### Dette résiduelle Phase 7.52.3

- **PDF typo `Super1100`** : la ligne 148 du PDF affiche
  `WT Mars Super1100 JMP 5` (preset name) et `WT Mars Super100 JMP 5`
  (tone model name). Je respecte la typo PDF comme key (visible dans
  les banks user) mais la metadata `amp` reste `"Marshall Super 100 JH"`
  cohérente. Si le firmware réel corrige la typo, ajuster.
- **Cab metadata sommaire** pour les TSR boutiques (Socks DC30,
  Cornell TSR20, Gryphin Talon 50, DrZ Z Wreck) : le PDF liste juste
  "TSR" ou "The Studio Rats" comme cab, sans détail. La metadata
  reflète cette imprécision. Si l'utilisateur veut plus de précision,
  ajuster cab à l'avenir (Phase 8+).
- **Pas de tests Vitest dédiés au matching slot-réel** : la suite
  vérifie la structure mais pas que les noms matchent ceux du firmware.
  Smoke-test manuel post-déploiement : Sébastien doit voir ses slots
  TSR/WT remonter avec usages corrects sur ses morceaux Hendrix,
  Lincoln Brewster, Phil X, etc.
- **Le legacy `ANNIVERSARY_CATALOG` dans data_catalogs.js peut maintenant
  être supprimé** : les 150 keys Phase 7.52.3 matchent désormais le PDF
  et donc les firmware factory banks. Le `buildFactoryBanksAnniversary`
  (devices/tonex-anniversary/catalog.js) pourrait pointer sur
  `ANNIVERSARY_PREMIUM_CATALOG` à la place. **Cleanup reporté Phase
  7.52.4** (vérifier que l'ordre Object.keys() du nouveau catalog matche
  l'ordre legacy pour ne pas casser le mapping bank-par-défaut).

---

## État précédent (2026-05-15, Phase 7.52.2 close — Fix sync iPhone via persistState retry-on-quota)

**Backline v8.14.64 / SW backline-v164 / STATE_VERSION 9 / 964 tests verts.**
Phase 7.52.2 fix B-TECH-02 (sync iPhone) découvert ce soir :

**Bug rapporté** : modifs Mac (setlists + guitares) ne remontaient pas
sur iPhone malgré ☁️ vert affiché. Direction Mac → iPhone bloquée.

**Cause** : Phase 6.2 (MAX_BACKUPS=2) + Phase 7.52 (catalog Anniversary
+232 KB) ont fait gonfler le state local au-delà du quota Safari iOS
(~2 MB). `autoBackup()` remplissait 2 × 1.5 MB de backups → localStorage
saturé → le `setItem(LS_KEY, state)` qui suit (main.jsx:832) throw
`QuotaExceededError` **silently swallowed** par le `catch(e){}`
historique. Au reload iPhone, l'ancien state non-muté est rechargé →
semble "désynchronisé".

**Fix 2-niveaux** :

1. **MAX_BACKUPS 2 → 1** (`src/core/state.js`) : réduit le volume des
   backups de moitié (1 × 1.5 MB au lieu de 2 × 1.5 MB).
2. **`persistState(state)` helper avec retry-on-quota** : nouveau
   helper dans `state.js`, remplace l'inline `setItem(LS_KEY, ...)`
   de main.jsx. Si quota au 1er setItem → **purge agressive des
   backups** (`localStorage.removeItem(LS_BACKUP_KEY)`) + retry. Si
   toujours quota → `console.error` LOUD avec taille du payload.
   Retourne `true`/`false` (le caller peut afficher un toast si
   échec final — pas encore câblé Phase 7.52.2).

### Architecture livrée Phase 7.52.2

```
src/main.jsx                    APP_VERSION 8.14.63 → 8.14.64
                                +import persistState
                                setItem(LS_KEY, ...) → persistState(state)
public/sw.js                    CACHE backline-v163 → backline-v164
src/core/state.js               MAX_BACKUPS 2 → 1
                                +persistState helper (retry-on-quota
                                avec purge backups)
                                +export persistState
src/core/state.test.js          +4 tests persistState (OK direct,
                                quota+retry succeed, quota persistant
                                fail-soft, non-quota error)
                                test autoBackup retry-on-quota adapté
                                (MAX_BACKUPS=1 → early return)
```

### Action post-déploiement iPhone

1. Reload PWA iPhone **2 fois** (1ère = active SW v164, 2ème = boot
   sur v8.14.64).
2. Vérifier header affiche `v8.14.64`.
3. Mac → toggle une guitare ou ajouter un morceau setlist → 5s
   plus tard, recharger iPhone → modification doit apparaître.
4. Si **toujours désynchronisé** : ouvrir DevTools console iPhone
   (via Safari Mac → Develop → iPhone) → chercher
   `"CRITICAL: persistState failed"` → si présent, le state global
   est plus gros que le quota disponible → solution :
   "🗑 Vider les sauvegardes" + "Réinitialiser mes analyses" dans
   Mon Profil → Préférences IA pour réduire l'aiCache local.

### Dette résiduelle Phase 7.52.2

- **Toast utilisateur en cas d'échec persist** : `persistState`
  retourne `false` mais le caller (main.jsx useEffect persist) ignore
  le retour. À câbler Phase 7.52.3 : afficher un toast "⚠ Mémoire
  locale saturée — purge les sauvegardes ou les caches IA" qui
  pointe vers MaintenanceTab.
- **Auto-purge backups au boot si overflow détecté** : actuellement
  le passage à MAX_BACKUPS=1 ne purge pas les 2 backups existants
  d'un user déjà en v8.14.63 ; ils seront tronqués au prochain
  autoBackup. Acceptable car éphémère.
- **Audit autre call sites localStorage.setItem** : `saveState`
  (state.js:1108) garde encore `try { ... } catch (e) { /* ignore */ }`.
  Utilisé uniquement par tests ; pas urgent.

---

## État précédent (2026-05-15, Phase 7.52.1 close — Usages catalog injectés au prompt IA)

**Backline v8.14.63 / SW backline-v163 / STATE_VERSION 9 / 960 tests verts.**
Phase 7.52.1 hotfix Phase 7.52 : le helper `buildInstalledSlotsSection`
(`src/app/utils/fetchAI.js`) sérialise désormais les `usages` du catalog
dans le prompt IA, format ` — usages: [AC/DC (Highway to Hell, Back in
Black, TNT); Led Zeppelin]`. Avant : les 32 entrées Anniversary Premium
avec usages artist/songs (Phase 7.52) étaient invisibles à Gemini — le
prompt ne listait que `(slot, name, amp, gain, style, src)`. Résultat
observé en prod après Phase 7.52 : sur Highway to Hell, l'IA choisissait
22C `TJ 74 Purple Plexi` (90%) au lieu de 9C `MRSH JT50 I Drive BAL SCH
CAB` (90%) qui a pourtant `AC/DC, Highway to Hell` dans ses usages. Pour
Back in Black, l'IA hallucinait `AA FMAN B100D BE` (Friedman BE-100) au
lieu d'`AA MRSH JT50` (rig Angus Young 1979).

L'instruction finale de la section "INSTRUCTION CAPTURES" a aussi été
durcie en 4 priorités explicites : (1) usages contenant artiste OU
titre, (2) nom mentionnant artiste/morceau (Blink-182, Kirk & James),
(3) capture custom/specialty matching ampli, (4) Factory matching
ampli. Rappel Phase 7.34 : capture avec `usages: [X]` est RÉSERVÉE à
X (rejette cross-contamination Hendrix Plexi → AC/DC).

**Pas de bump SCORING_VERSION** (V9 inchangé), **pas de migration**.
Pour bénéficier du fix sur les aiCache existants : "🗑 Invalider tous
les caches IA" (admin) + batch "🤖 Analyser/MAJ N".

### Architecture livrée Phase 7.52.1

```
src/main.jsx                    APP_VERSION 8.14.62 → 8.14.63
public/sw.js                    CACHE backline-v162 → backline-v163
src/app/utils/fetchAI.js        +formatUsages(usages) helper pur
                                fmt() append usagesPart à chaque ligne
                                INSTRUCTION CAPTURES durcie 4 priorités
                                + rappel Phase 7.34 anti cross-contamination
```

### Dette résiduelle Phase 7.52.1

- Pas de tests Vitest dédiés sur `formatUsages` ni
  `buildInstalledSlotsSection` (helpers internes pas exportés). À
  exporter pour tester en isolation si régression observée.
- Le respect du prompt dépend toujours de Gemini Flash. Si malgré
  les 4 priorités l'IA continue à proposer du Purple Plexi sur
  Highway to Hell, fallback : post-processing JS qui force
  `preset_ann_name` au slot avec usages-match. Acceptable car
  non-déterministe LLM = trade-off intrinsèque.
- Le `usages` sérialisé est tronqué à 4 morceaux par artiste pour
  éviter prompt overflow. Si une capture a 10 morceaux ciblés, les
  6 derniers sont absents du prompt mais restent dans le catalog
  (utilisés par le scoring V9 local).

---

## État précédent (2026-05-15, Phase 7.52 close — Catalog Anniversary Premium 150 captures curées)

**Backline v8.14.62 / SW backline-v162 / STATE_VERSION 9 / 960 tests verts.**
Phase 7.52 livre le catalog complet des 150 captures premium pré-installées
sur la ToneX Pedal Anniversary Edition, signées par 5 créateurs externes
(Amalgam Audio, Jason Sadites, Tone Junkie TV, The Studio Rats Anniversary,
Worship Tutorials). Chaque entrée a été curée individuellement (gain,
style, scores HB/SC/P90, usages artiste/morceau) sur la base du PDF
officiel `tone_models/TONEX_Pedal_Anniversary_Edition_Premium_Tone_Models.pdf`
daté 2024/10/29.

### Architecture livrée Phase 7.52

```
src/main.jsx                                       APP_VERSION 8.14.61 → 8.14.62
public/sw.js                                       CACHE backline-v161 → backline-v162
src/data/anniversary-premium-catalog.js            NOUVEAU — 150 entrées curées
                                                   (30 par pack × 5 packs).
src/data/anniversary-premium-catalog.test.js       NOUVEAU — 157 tests Vitest :
                                                   - 150 par-entrée (structure
                                                     valide : packName,
                                                     character, gain, style,
                                                     scores, usages).
                                                   - 7 globaux : 150 total,
                                                     30/pack × 5, distribution
                                                     gain/style, pas de collision
                                                     avec FACTORY_CATALOG,
                                                     régression findCatalogEntry
                                                     pour AA MRSH JT50 (Schaffer
                                                     + AC/DC).
src/core/catalog.js                                +import ANNIVERSARY_PREMIUM_CATALOG ;
                                                   spread APRÈS ANNIVERSARY_CATALOG
                                                   dans PRESET_CATALOG_MERGED →
                                                   override les 150 entrées
                                                   legacy (mêmes clés).
```

### Distribution

Chacun des 5 packs : 30 captures.
- **Amalgam Audio (AA, 1-30)** : Marshall Plexi/JTM50/JCM800/SuperBass + Schaffer,
  Fender Tweed Deluxe/Bassman/Twin/Deluxe Reverb, Vox AC30 TB, Soldano SLO,
  Matchless Chieftain, Mesa Mark IIC+, Hiwatt CUT100, Friedman BE-100, Orange
  OR120/GR100, Peavey 5150, Two-Rock OD100, Fender Brown Deluxe.
- **Jason Sadites (JS, 31-60)** : Marshall Studio JTM ST20H, Silver Jubilee 2555x,
  Fuchs ODS Classic, Friedman Pink Taco, Fender '59 Bassman LTD, Suhr Hombre,
  Matchless Chieftain, Dr. Z Z Wreck Jr., Marshall 1974x, Two Rock Studio Signature.
- **Tone Junkie TV (TJ, 61-90)** : Fender 5E3 Tweed Deluxe, 5E7 Tweed Bandmaster,
  62 Pro Amp, 68 Twin Reverb, 74 Purple Plexi JMP, DMBL ODS 124, Matchless
  Brave, Vox Cambridge, Vox AC44, 60s GA5 Skylark, Tyler 18 Watt Custom.
- **The Studio Rats Anniversary (TSR, 91-120)** : Marshall Anniversary 6100
  (3 modes), JCM800 2210, Plexi 1959 (Cn1/Cn2/Jumped/Cranked), Silver Jubilee
  2555 (Rhythm/Lead/Clean), Mesa Mark V (Cn1/Cn2/Cn3), Mesa Dual Rectifier
  (Vintage/Modern), Fender Twin/Deluxe Reverb, Vox AC30 TB, EVH 5150 III.
- **Worship Tutorials (WT, 121-150)** : Vox AC30 TB 1964, Orange OR120 1977,
  Matchless C-30 1994, Bad Cat Cub II R, Benson Chimera, Tone King Imperial,
  Matchless Laurel Canyon, Carr Telstar, Mesa Lonestar 100, Marshall Super 100 JH,
  Fender Deluxe Tweed, Two-Rock Studio Pro 22, Milkman Dover, Marshall JCM900 SLX.

### Usages artiste/morceau (32 entrées avec `usages`)

Les captures dont le triplet amp + cab + stomp pointe sur un artiste précis
ont un champ `usages: [{artist, songs?}]` exploité par le prompt IA
Phase 7.34 (anti cross-contamination + priorité capture-artiste). Exemples :

- **AA MRSH JT50 I Drive BAL SCH CAB** → AC/DC (Highway to Hell, Back in
  Black, TNT, You Shook Me, Hells Bells, Whole Lotta Rosie) — capture
  Schaffer Replica + JTM-50 = rig Angus Young 1979.
- **AA MRSH SL100 JU Dimed** → Jimi Hendrix (Voodoo Child, Purple Haze)
  + Led Zeppelin (Whole Lotta Love, Black Dog).
- **AA MRSH SB100 I Edge** → Cream (White Room, Sunshine of Your Love).
- **AA MES MKIICP LD** → Dream Theater (Pull Me Under), Metallica
  (Master of Puppets).
- **AA HWTT CUT100** → The Who (Won't Get Fooled Again, Baba O'Riley),
  Pink Floyd.
- **AA SLDN SL100 OD** → Eric Johnson (Cliffs of Dover).
- **AA ORNG 120 Dimed** → Black Sabbath (Paranoid, Iron Man, War Pigs).
- **TJ DMBL ODS 124 LEAD 1** → Robben Ford (Help the Poor).
- **TJ AC44 B 3+** → The Edge (U2), Beatles.
- **TJ 65 Cambridge** → Brian May (Queen).
- **TSR Mars Plexi Cn2 Cranked** → Jimmy Page (Whole Lotta Love).
- **TSR Mars Plexi Jumped** → Eric Clapton, Bluesbreakers.
- **TSR Mars JCM800 Cn2 HG 2/3** → Slash / Guns N' Roses, Iron Maiden.
- **TSR Mars Jubilee Lead** → Slash, Joe Bonamassa.
- **TSR Mesa Mark V Cn3 LD 1/2** → Metallica (Master of Puppets), Dream Theater.
- **TSR Mesa Rect Cn3 Mdrn 1** → Tool, System of a Down.
- **TSR Vox AC30 TB CH2 OD** → Brian May (Queen), The Edge (U2).
- **TSR EVH 5150 III Blue** → Van Halen, EVH.
- **WT VOX AC30 TB Push** → Hillsong, Bethel Music (worship).
- **WT MRSH Super 100 JH OD** → Jimi Hendrix (Voodoo Child).
- **WT TR Studio Pro 22 Cln** → Lincoln Brewster (worship modern).
- **JS Brit Silver Dbl Crm OD** → Slash (Sweet Child O'Mine).
- **JS Mars 74x Ult Push 1** → Slash, Guns N' Roses.
- **JS D-Classic Cream OD** → Robben Ford, John Mayer.
- **JS Sir Ombre Ult Push 1** → Stevie Ray Vaughan.
- **JS Twd B-Man Push 2** → Stevie Ray Vaughan.
- **JS Wrecked Z Push 1** → Joe Walsh, Brad Paisley.

### Effet sur le scoring et l'IA

- **`findCatalogEntry("AA MRSH JT50 I Drive BAL SCH CAB")`** retourne désormais
  la metadata curée (HB:96/SC:78/P90:86 + usages AC/DC) au lieu du legacy
  (HB:82/SC:74/P90:82, pas d'usages). Le scoring V9 local préfère ce capture
  pour les morceaux AC/DC sur SG/LP HB.
- **Le prompt IA Phase 7.34** reçoit désormais `buildInstalledSlotsSection`
  enrichi avec les usages → moins de cross-contamination, plus de précision
  sur les recos pour les morceaux vintage.
- **SCORING_VERSION inchangé** (reste à 9). C'est uniquement le catalog
  d'entrée qui s'enrichit, pas la math du scoring.

### Bundle

1890.27 KB (Phase 7.50) → 2122.24 KB (Phase 7.52) = +232 KB.
Acceptable pour 150 entrées riches (metadata complète + usages structurés
+ tests test.each qui pèsent ~70 KB en source).

### Action post-déploiement recommandée

Pour que les aiCache existants bénéficient du nouveau catalog, l'admin
peut :
1. Mon Profil → 🎯 Préférences IA → "🗑 Invalider tous les caches IA" (admin).
2. Setlists → "🤖 Analyser/MAJ N" pour batch re-analyse de toutes les
   setlists.
3. Vérifier sur Highway to Hell que la reco pointe désormais sur
   AA MRSH JT50 (Schaffer) au lieu de TSR Mars 800SL ou Factory HG 800.

### Dette résiduelle Phase 7.52

- **Mapping bank → slot par défaut** : Phase 7.52 ne concerne que le catalog
  metadata. Le PDF source liste les 150 captures numérotées 1 à 150 mais
  ne précise pas leur position bank A/B/C dans le firmware Anniversary.
  Si l'utilisateur reset ses banks Anniversary aux defaults firmware, il
  faut compléter `INIT_BANKS_ANN` (data_catalogs.js). Phase 7.53+ si besoin.
- **Coexistence ANNIVERSARY_CATALOG legacy** : l'entrée legacy dans
  `data_catalogs.js` (150 entrées avec metadata grossière) reste présente
  mais override par le spread Phase 7.52. Cleanup possible Phase 8+
  (suppression définitive de l'ANNIVERSARY_CATALOG legacy), pas urgent.
- **Tests E2E** : tests Vitest valident la structure et le merge. Une
  validation manuelle sur un morceau AC/DC + SG (Sébastien) ou un morceau
  Metallica + Schecter (Bruno) après déploiement confirmera l'amélioration
  des recos en pratique.
- **Pack creators contactés** : Paul (TSR) déjà notifié et favorable
  (Phase 7.45). Pas encore de contact avec Amalgam Audio / Jason Sadites /
  Tone Junkie TV / Worship Tutorials. Si feedback positif, étendre la
  curation aux packs standalone de ces créateurs (TSR 64 déjà fait,
  Amalgam standalone à investiguer).

---

## État précédent (2026-05-15, Phase 7.51.6 close — Export snapshot avec sélecteur profil)

**Backline v8.14.58 / SW backline-v158 / STATE_VERSION 9 / 803 tests verts.**
Phase 7.51.6 ajoute un **dropdown sélecteur de profil** dans l'outil
"📦 Exporter snapshot démo" du MaintenanceTab. Auparavant l'outil
n'exportait que le profil ACTIF, ce qui obligeait l'admin à switcher
vers le profil curateur (et le profil curateur devait être admin pour
accéder au tab Maintenance). Désormais Sébastien admin peut sélectionner
n'importe quel profil dans la liste (y compris des profils non-admin
comme `demo_1778839429588`) et exporter directement.

### Comportement attendu

1. Sébastien admin → Mon Profil → 🔧 Maintenance.
2. Tout en bas, section "📦 Exporter snapshot démo (admin)".
3. **Nouveau dropdown** "Profil à exporter :" avec la liste de tous les
   profils (triés par nom alpha), affichage `Nom (id)`.
4. Default = profil actif (Sébastien). L'admin peut sélectionner un
   autre profil (curateur démo, etc.).
5. Click "📦 Exporter snapshot démo" → `buildDemoSnapshot(profiles[selectedId], setlists, songDb)`
   → download `demo-profile.json`.

### Workflow simplifié

Avant Phase 7.51.6 :
1. Sébastien crée un profil curateur.
2. Sébastien switche dessus (déconnexion + reconnexion via ProfilePicker).
3. Si profil curateur non-admin → impossible d'accéder au Maintenance.
4. Devait toggler ★ Admin sur le curateur avant.
5. Switch + curer + exporter.

Après Phase 7.51.6 :
1. Sébastien curé un profil dédié (par exemple `demo_1778839429588`).
2. Reste connecté admin Sébastien.
3. Va dans Maintenance → dropdown → sélectionne le profil curateur.
4. Click Export.

### Architecture livrée Phase 7.51.6

```
src/main.jsx                            APP_VERSION 8.14.57 → 8.14.58
public/sw.js                            CACHE backline-v157 → backline-v158
src/app/screens/MaintenanceTab.jsx      +prop profiles
                                        +useState exportProfileId (default profile.id)
                                        +dropdown <select> liste tous profils
                                        export utilise profiles[exportProfileId]
src/app/screens/MonProfilScreen.jsx     passe profiles={profiles} à MaintenanceTabComponent
src/i18n/en.js, es.js                   +maintenance.demo-export-profile-label
                                        message hint + workflow updated
```

### Dette résiduelle

- Si l'utilisateur veut exporter un profil dont les setlists ont des
  noms trop personnels (ex. "Cours Franck B"), il faut quand même les
  renommer manuellement sur le profil avant export. Phase 7.51.6 ne
  fait que faciliter le bouton — la curation des noms reste manuelle.
- Tests Vitest non ajoutés (helper buildDemoSnapshot déjà testé Phase
  7.51.4, l'ajout est purement UI dropdown).

---

## État précédent (2026-05-15, Phase 7.51.4 close — Phase 7.51 complète)

**Backline v8.14.56 / SW backline-v156 / STATE_VERSION 9 / 803 tests verts.**
Phase 7.51.4 ajoute l'outil admin "📦 Exporter snapshot démo" dans
MaintenanceTab. Sébastien peut maintenant cure un profil dédié, switcher
dessus, cliquer le bouton, et obtenir un JSON downloadable à utiliser
pour remplacer `src/data/demo-profile.json`. **Phase 7.51 est désormais
complète** (4 sous-phases livrées + 1 hotfix UX). Le mode démo est
accessible via ProfilePicker + URL `?demo=1`, avec banner trilingue,
guards runtime, UX search grisée, et outil de curation admin.

### Helper buildDemoSnapshot (Phase 7.51.4)

`buildDemoSnapshot(profile, allSetlists, allSongs)` retourne :
```
{
  version: 9,
  profile: {
    ...origProfile,
    id: 'demo',                     // forcé
    name: 'Démo',                   // forcé
    isDemo: true,                   // forcé
    isAdmin: false,                 // forcé
    password: null,                 // forcé
    aiKeys: { anthropic: '', gemini: '' },  // vidé
    loginHistory: [],               // vidé
  },
  setlists: [<filtrées par profileIds=[origId], remappées profileIds=['demo']>],
  songs: [<filtrées par songIds des setlists ci-dessus, aiCache préservé>],
}
```

Helper pur testable (7 nouveaux tests Vitest). Préserve l'intégralité
de `aiCache` y compris champs trilingues (cot_step1.fr/en/es, etc.).

### Bouton MaintenanceTab

Section "📦 Exporter snapshot démo (admin)" en bas du tab Maintenance
(admin-only via gating MonProfilScreen). Au click :
1. Appelle `buildDemoSnapshot(profile, setlists, songDb)`.
2. JSON.stringify pretty (indent 2).
3. Crée un Blob `application/json` + URL.createObjectURL.
4. Trigger download `demo-profile.json` via `<a download>` programmatique.
5. revokeObjectURL pour libérer.

Texte d'aide explicatif sur le workflow.

### Workflow curation (Phase 7.51.4 + suite)

1. Admin Sébastien crée/édite un profil curateur dédié (ex.
   `demo_1778839429588` déjà existant sur le compte de prod).
2. Switch vers ce profil dans l'app.
3. Mon Profil → 🔧 Maintenance → bas de la page → "📦 Exporter
   snapshot démo".
4. Le fichier `demo-profile.json` est téléchargé.
5. Côté repo : remplacer `src/data/demo-profile.json` par le fichier
   téléchargé.
6. `git add src/data/demo-profile.json && git commit && git push`.
7. Bump `APP_VERSION` + SW `CACHE` (cf. workflow déploiement
   habituel).
8. Le mode démo charge le snapshot frais au prochain reload.

### Architecture livrée à fin Phase 7.51.4

```
src/main.jsx                            APP_VERSION 8.14.55 → 8.14.56
public/sw.js                            CACHE backline-v155 → backline-v156
src/core/state.js                       +buildDemoSnapshot helper pur
                                        +export
src/core/state.test.js                  +7 tests Phase 7.51.4
src/app/screens/MaintenanceTab.jsx      +section "Exporter snapshot démo"
                                        avec bouton download blob JSON
src/i18n/en.js, es.js                   +maintenance.demo-export-*
                                        (5 clés × 2 langues)
```

### Récap Phase 7.51 (4 sous-phases + 1 hotfix)

| Sous-phase | Version | Sujet |
|---|---|---|
| 7.51.1 | 8.14.52 | Foundations : STATE_VERSION 9, `profile.isDemo`, helpers, placeholder JSON |
| 7.51.2 | 8.14.53 | Guards runtime : wrapDemoGuard, Firestore, fetchAI, tabs cachés, toast |
| 7.51.3 | 8.14.54 | Accès UI : carte ProfilePicker, URL `?demo=1`, DemoBanner trilingue |
| 7.51.3.1 | 8.14.55 | Hotfix UX : SongSearchBar grisée en mode démo |
| 7.51.4 | 8.14.56 | Outil admin : buildDemoSnapshot + bouton MaintenanceTab |

**Phase 7.51 close**. Tag `phase-7.51-done`. Mode démo public
fonctionnel de bout en bout. Reste à faire :
1. Curer un profil de démonstration via l'outil.
2. Remplacer `src/data/demo-profile.json` placeholder par le snapshot
   curé.
3. Bumper version, commit, déployer sur main.
4. Annoncer le mode démo aux beta-testeurs (Paul TSR, etc.) via URL
   `https://mybackline.app/?demo=1`.

### Dette résiduelle Phase 7.51 → 7.52+

- **Audit complet UX grisé** : Phase 7.51.3.1 a grisé SongSearchBar.
  D'autres inputs en mode démo restent fonctionnels (rename setlist,
  create setlist, custom guitar add). Si feedback utilisateur, Phase
  7.51.3.2 grisera ces points.
- **Formulaire de demande d'accès** vs mailto : Phase 7.51 garde le
  mailto simple. Idée Phase 7.44 listée dans "Idées en attente" pour
  un formulaire Formspree/Web3Forms si le volume justifie.
- **Tests E2E mode démo** : non couvert par Vitest. Smoke test
  manuel à automatiser plus tard (Playwright/Cypress).
- **B-TECH-01** (cycles sync Firestore) et **B-TECH-02** (taille
  localStorage MAX_BACKUPS=1) : reportés Phase 7.52 comme prévu.

---

## État précédent (2026-05-15, Phase 7.51.3.1 close — UX recherche grisée mode démo)

**Backline v8.14.55 / SW backline-v155 / STATE_VERSION 9 / 796 tests verts.**
Phase 7.51.3.1 hotfix : la barre de recherche `SongSearchBar` (HomeScreen
+ Setlists → onglet Morceaux) et son bouton "OK" sont désormais
**disabled + grisés visuellement** en mode démo. Sinon le visiteur tapait
un morceau, cliquait OK et recevait un toast 🔒 sans signal préalable —
mauvaise UX. Désormais l'input et le bouton signalent immédiatement
qu'ils sont indisponibles (opacity 0.5, cursor not-allowed, title
"Action désactivée en mode démo").

Cf. section "Phase 7.51.3 close" ci-dessous pour le scope principal du
mode démo.

### Architecture livrée Phase 7.51.3.1

```
src/main.jsx                            APP_VERSION 8.14.54 → 8.14.55
public/sw.js                            CACHE backline-v154 → backline-v155
src/app/screens/HomeScreen.jsx          SongSearchBar +prop isDemo →
                                        input + bouton disabled,
                                        opacity 0.5, cursor not-allowed,
                                        title 'Action désactivée en mode démo'
                                        HomeScreen dérive isDemo depuis
                                        profiles[activeProfileId]?.isDemo
src/app/screens/SetlistsScreen.jsx      passe isDemo à SongSearchBar
```

### Dette résiduelle 7.51.3.1 → 7.51.3.2 / 7.51.4

- Si l'utilisateur teste et trouve d'autres inputs/boutons non-grisés
  en mode démo (rename setlist, créer setlist, ajouter custom guitar,
  etc.), Phase 7.51.3.2 grisera ces points. Audit complet reporté.
- Bug `?demo=1` URL non-fonctionnel rapporté : à diagnostiquer
  avec dump console DevTools de l'utilisateur. Suspecté : cache
  SW localhost ou test sur prod (où 7.51 n'est pas déployée).

---

## État précédent (2026-05-15, Phase 7.51.3 close — Mode démo accès UI + banner)

**Backline v8.14.54 / SW backline-v154 / STATE_VERSION 9 / 796 tests verts.**
Phase 7.51.3 expose le mode démo aux visiteurs : carte "Mode démo ·
Découvrir Backline" sur ProfilePickerScreen, URL `?demo=1` auto-load,
bandeau DemoBanner persistant trilingue avec lien mailto pré-rempli.
Le mode démo est maintenant **accessible et fonctionnel**. Phase 7.51.4
ajoutera l'outil admin "Exporter snapshot démo" pour remplacer le
placeholder par le contenu curé.

### Comportement attendu

**Visiteur via URL `?demo=1`** :
- Charge `https://mybackline.app/?demo=1`.
- Au mount App, `_demoModeRequested` flag est lu → `enterDemoMode()`
  est appelé → snapshot bundlé chargé in-memory → activeProfileId='demo'.
- L'URL est nettoyée en `https://mybackline.app/` via
  `history.replaceState`.
- Le visiteur arrive direct sur HomeScreen avec le profil démo,
  DemoBanner en haut.

**Visiteur via ProfilePicker** :
- Charge `https://mybackline.app/`.
- ProfilePicker affiche en tête une carte "Mode démo · Découvrir
  Backline" + badge "Sans compte" (toujours visible, même avec 0
  profil trusted sur l'appareil).
- Click sur la carte → `enterDemoMode()` → bascule directe.
- Les profils trusted normaux sont affichés en-dessous, comportement
  inchangé.

**DemoBanner** :
- Sticky top sous AppHeader, z-index 50.
- Background gradient brass/copper, fontSize 12, textAlign center.
- Message trilingue : "Tu testes Backline en mode démo." + lien
  "demande un accès" (mailto pré-rempli avec template guitares /
  ToneX hardware / 5-10 morceaux).
- Non dismissible — le visiteur garde en permanence le contexte.
- Visible partout SAUF `screen === 'live'` (LiveScreen plein écran).

**Persistance localStorage** :
- En mode démo, le `useEffect` persist early-return AVANT
  `localStorage.setItem(LS_KEY, ...)`. Le snapshot in-memory ne pollue
  donc JAMAIS le profil normal de l'utilisateur trusted sur cet appareil.
- Au reload : localStorage chargé normalement → state restauré sans
  trace du démo.

### Architecture enterDemoMode

`useCallback(() => {...}, [])` stable (deps vide). Le helper :
1. Charge `loadDemoSnapshot()` (Phase 7.51.1 import statique du JSON).
2. **Non-destructif** : `_setProfilesRaw(prev => ({...prev, demo: snap.profile}))`
   ajoute le profil démo sans écraser les profils existants.
3. Merge des `setlists` et `songDb` (dedup par id) — le filtrage
   Phase 7.29.5 (mySetlists via profileIds) masque les autres setlists
   au visiteur démo, qui ne voit que celles du profil 'demo'.
4. `setActiveProfileId('demo')` → next render isDemo devient true.
5. `setScreen('list')` → navigation vers HomeScreen.

### Détection URL `?demo=1`

Au module-load (avant le mount App), même bloc que `?beta=1`
(Phase 7.25) :
- `URLSearchParams` lit `window.location.search`.
- Si `demo === '1'` ou `demo === 'true'` → `_demoModeRequested = true`.
- Params nettoyés via `history.replaceState`.
- Le flag est consommé dans le useEffect auto-login : s'il est true,
  `enterDemoMode()` est appelé directement, court-circuitant le check
  sessionStorage / trusted devices.

### Carte démo ProfilePickerScreen

Nouvelle carte styled brass→copper gradient, full-width 400px max,
au-dessus du grid des profils trusted. Toujours rendue si la prop
`onDemoEnter` est passée. Click handler = `onDemoEnter` (= `enterDemoMode`
dans App).

### Architecture livrée à fin Phase 7.51.3

```
src/main.jsx                                 APP_VERSION 8.14.53 → 8.14.54
                                             +import DemoBanner, loadDemoSnapshot
                                             +_demoModeRequested flag URL
                                             +useCallback enterDemoMode
                                             useEffect auto-login : court-circuit
                                               si _demoModeRequested
                                             useEffect persist : skip localStorage
                                               si isDemo
                                             +<DemoBanner> root JSX (gated live)
                                             ProfilePickerScreen +onDemoEnter prop
public/sw.js                                 CACHE backline-v153 → backline-v154
src/app/components/DemoBanner.jsx            NOUVEAU — bandeau trilingue + mailto
src/app/screens/ProfilePickerScreen.jsx      +onDemoEnter prop, +carte démo
src/i18n/en.js, es.js                        +demo.card-title, card-badge,
                                              card-subtitle, banner-text, banner-link
```

### Dette résiduelle Phase 7.51.3 → 7.51.4

- **Phase 7.51.4** (outil de curation admin) : bouton "📦 Exporter
  snapshot démo" dans MaintenanceTab admin. Helper pur
  `buildDemoSnapshot(profile, allSetlists, allSongs)` qui force
  `isDemo=true`, `isAdmin=false`, `password=null` et extrait
  setlists+songs+aiCache pour produire le JSON downloadable.
- **Tests E2E mode démo** : non couvert par Vitest. Smoke test
  manuel post-déploiement : ouvrir `?demo=1` → vérifier que tout
  marche, tenter chaque write → toast 🔒.
- **Limite session** : si le visiteur démo recharge sans `?demo=1`,
  il sort du mode démo (localStorage normal restauré). Acceptable.

---

## État précédent (2026-05-15, Phase 7.51.2 close — Mode démo guards runtime)

**Backline v8.14.53 / SW backline-v153 / STATE_VERSION 9 / 796 tests verts.**
Phase 7.51.2 implémente les blocages runtime du mode démo : les writes
profile/setlists/songDb/deletedSetlistIds sont gated par
`wrapDemoGuard`, les appels Firestore et fetchAI early-return, les
tabs admin de Mon Profil sont cachés. Toast non-intrusif "Action
désactivée en mode démo" sur chaque tentative bloquée. Le mode démo
n'est PAS encore accessible (Phase 7.51.3 pose la carte ProfilePicker
+ URL `?demo=1` + DemoBanner).

### Architecture des guards (Phase 7.51.2)

**`wrapDemoGuard(fn, isDemo, onBlocked, label)`** (state.js, helper pur) :
- `isDemo=false` → retourne `fn` tel quel (identité, zéro overhead).
- `isDemo=true` → retourne un wrapper no-op qui notifie `onBlocked(label)`.
- Callback try/catch'é pour ne pas casser le flow si le UI plante.

**`stripDemoProfiles(state)`** (state.js, helper pur) :
- Filtre les profils `isDemo: true` du state avant push Firestore.
- Symétrique à `stripAiCacheForSync` (Phase 5.7.1).
- Défense en profondeur : le profil démo (chargé in-memory) ne doit
  JAMAIS être dans Firestore, mais protège contre les écritures
  accidentelles (debug, import JSON, etc.).

### Câblage App (main.jsx)

- `_setSongDbRaw`, `_setDeletedSetlistIdsRaw`, `_setProfilesRaw` :
  setters useState renommés (underscore-prefix pour signifier "interne").
- `_setSetlistsComposed` : ancien wrapper composé (tombstones + stamp
  lastModified) renommé.
- `isDemo = useMemo(() => isDemoMode({ profiles }, activeProfileId), …)`.
- `setSongDb`, `setSetlists`, `setDeletedSetlistIds`, `setProfiles` :
  exposés via `useMemo(() => wrapDemoGuard(_setRaw, isDemo, showDemoToast, label))`.
  Quand isDemo=false → identité (référence stable). Quand isDemo=true
  → no-op + toast. Les ~33 sites d'appel downstream restent inchangés.
- `useEffect(() => setFirestoreDemoMode(isDemo))` : signale au module
  Firestore d'early-return tous les appels save/load/poll.
- `bindActiveProfile(profile)` étendu : capture aussi `profile.isDemo`
  → i18n module skip l'updater `profile.language` en mode démo.
- `<ToastDemoBlocked message={demoToastMsg} onDismiss={...}/>` rendu
  une fois au niveau App, après AppFooter et AppNavBottom.

### Firestore (firestore.js)

- `setFirestoreDemoMode(b)` + `_isDemoMode` module-level.
- Nouvelle helper `isDemoOrNoSync()` étend `isNoSyncMode()`.
- Early-return dans `saveToFirestore`, `loadFromFirestore`,
  `pollRemoteSyncId`, `loadSharedKey`, `saveSharedKey`.
- `saveToFirestore.prep()` applique `stripDemoProfiles` avant
  `JSON.stringify` (défense en profondeur).

### i18n (i18n/index.js)

- `_activeProfileIsDemo` module-level posé par `bindActiveProfile`.
- `setLocale(loc)` skip l'updater `_profileLanguageUpdater(loc)` si
  `_activeProfileIsDemo` est true. Le `localStorage.backline_locale`
  est toujours écrit (UI pref globale, OK même en mode démo).
- Le visiteur démo peut donc changer la langue sans toucher au profil
  bundlé (in-memory).

### Composant ToastDemoBlocked

`src/app/components/ToastDemoBlocked.jsx` (45 lignes) :
- Position fixed bottom centered, z-index 99, auto-dismiss 2.5s.
- `pointer-events: none` : le visiteur peut continuer à cliquer
  derrière le toast.
- `role="status"`, `aria-live="polite"` pour l'accessibilité.
- Icône 🔒 + message i18n trilingue.

### Gates fetchAI

- `SongDetailCard.jsx:66` useEffect : `if (isDemo) return;` en tête,
  avant les autres conditions. `isDemo` dans deps array.
- `ListScreen.jsx:316` `analyzeMissingAll` : `if (isDemo) return;`.
- `ListScreen.jsx:348` `improveAll` : idem.
- `MaintenanceTab.jsx:92` `recalcAll` : `if (profile?.isDemo) return;`.

Aucun appel `fetchAI` ne peut être déclenché en mode démo. Zéro
quota Gemini consommé pour le visiteur.

### MonProfilScreen tabs cachés

En mode démo, seul le tab `display` (theme + locale) est exposé.
Tous les autres (guitars, devices, sources, tonenet, pedale, ann,
plug, tmp, reco, password, ia, maintenance, export, admin_profiles)
sont conditionnés par `!isDemo &&`. Le visiteur peut configurer son
thème et sa langue mais rien d'autre.

### Tests Phase 7.51.2 (+10 nouveaux)

`state.test.js` section "Phase 7.51.2 — Demo guard runtime (helpers purs)" :
- `wrapDemoGuard` × 6 : identité quand !isDemo, no-op quand isDemo,
  label par défaut "write", onBlocked optionnel, swallow callback
  qui throw.
- `stripDemoProfiles` × 4 : filtre isDemo:true, préserve normaux,
  state null/undefined safe, immutabilité (new object).

Total : 786 → 796 tests verts.

### Comportement utilisateur attendu (Phase 7.51.2)

- **Profil normal** (Sébastien, Bruno, etc.) : aucun changement.
  Toutes les actions fonctionnent comme avant. wrapDemoGuard
  retourne l'identité, zéro overhead.
- **Profil démo** (à activer Phase 7.51.3) : tout click "Ajouter
  guitare", "Toggle device", "Modifier banks", "Donner feedback",
  "Forcer recalcul IA", "Maintenance" → toast 🔒 "Action désactivée
  en mode démo" + écran inchangé. Aucun appel Firestore. Aucun
  appel Gemini. Locale et theme changeables (UI pref globale).

### Architecture livrée à fin Phase 7.51.2

```
src/main.jsx                            APP_VERSION 8.14.52 → 8.14.53
                                        +import isDemoMode, isDemoProfile,
                                          loadDemoSnapshot, wrapDemoGuard,
                                          setFirestoreDemoMode, ToastDemoBlocked
                                        useState setters → _setRaw (3 sites)
                                        _setSetlistsComposed (renommage)
                                        +bloc démo (isDemo, toast, wrappers)
                                        +useEffect setFirestoreDemoMode
                                        bindActiveProfile deps +profile.isDemo
                                        +<ToastDemoBlocked> au root JSX
public/sw.js                            CACHE backline-v152 → backline-v153
src/core/state.js                       +wrapDemoGuard, +stripDemoProfiles
                                        +exports
src/core/state.test.js                  +10 tests Phase 7.51.2
src/app/components/ToastDemoBlocked.jsx NOUVEAU — toast 45 lignes
src/app/utils/firestore.js              +setFirestoreDemoMode, isDemoOrNoSync,
                                        stripDemoProfiles import
                                        early-returns 5 fonctions
                                        prep() applique stripDemoProfiles
src/i18n/index.js                       +_activeProfileIsDemo
                                        bindActiveProfile détecte isDemo
                                        setLocale skip updater si demo
src/i18n/en.js, es.js                   +demo.blocked
src/app/screens/SongDetailCard.jsx      useEffect gate isDemo
src/app/screens/ListScreen.jsx          analyzeMissingAll + improveAll gates
src/app/screens/MaintenanceTab.jsx      recalcAll gate
src/app/screens/MonProfilScreen.jsx     tabs hidden si isDemo (sauf display)
```

### Dette résiduelle Phase 7.51.2 → 7.51.3-4

- **Phase 7.51.3** (accès & banner) : carte "Mode démo · Découvrir
  Backline" toujours visible sur ProfilePickerScreen. URL `?demo=1`
  auto-load + nettoyage URL via history.replaceState. Composant
  `DemoBanner.jsx` sticky top trilingue avec mailto pré-rempli vers
  sebastien.chemin@gmail.com. Visible partout sauf LiveScreen.
  Skip trusted device addition.
- **Phase 7.51.4** (outil de curation admin) : bouton "📦 Exporter
  snapshot démo" dans MaintenanceTab admin. Helper pur
  `buildDemoSnapshot(profile, allSetlists, allSongs)`. Workflow doc
  dans CLAUDE.md : curer un profil dédié → exporter → remplacer
  src/data/demo-profile.json → commit → push → bump version.
- **Sites de write non-couverts** : `recordLogin` (loginHistory)
  passe encore par `_setProfilesRaw` directement dans le code
  ProfilePicker (à vérifier Phase 7.51.3). En mode démo activé
  Phase 7.51.3, le visiteur ne se loggue jamais via password donc
  pas de risque, mais à valider.
- **Pas de tests E2E** sur les gates UI (juste les helpers purs).
  À automatiser plus tard.

---

## État précédent (2026-05-15, Phase 7.51.1 close — Mode démo foundations)

**Backline v8.14.52 / SW backline-v152 / STATE_VERSION 9 / 786 tests verts.**
Phase 7.51.1 pose les fondations du mode démo public : migration
STATE_VERSION 8→9 avec `profile.isDemo: boolean`, helpers purs
(`isDemoProfile`, `isDemoMode`, `loadDemoSnapshot`), placeholder
`src/data/demo-profile.json` (à remplacer par le snapshot curé via
l'outil d'export Phase 7.51.4). Phase 7.51.1 = backend uniquement
— les guards runtime (7.51.2), l'accès UI + banner (7.51.3) et
l'outil d'export admin (7.51.4) suivront dans les sous-phases
ultérieures.

### Objectif Phase 7.51 (rappel)

Aujourd'hui mybackline.app est invitation-only (ProfilePicker exige
un profil existant + password). Un visiteur (Reddit, DM, créateur
TSR/ML) n'a pas moyen d'essayer l'app sans setup manuel admin.
Objectif : vitrine publique read-only via `?demo=1` ou carte
"Mode démo" sur ProfilePicker. Snapshot bundlé avec analyses IA
pré-cachées, banks remplies, recos qui marchent. Tous les writes
bloqués. Aucun appel `fetchAI` ni Firestore en mode démo.

### Schéma v9 (additif vs v8)

```
profile {
  ...,                  // v8 inchangé
  isDemo: boolean       // NOUVEAU v9 — flag profil démo public
}
```

### Migration v8 → v9 (Phase 7.51.1)

`migrateV8toV9(state)` ajoute `isDemo: false` à chaque profil
existant. Idempotent, purement additif. Cohabitation v8↔v9 safe :
- Un client v9 reçoit un push v8 (sans isDemo) → `ensureProfileV9`
  pose le flag false au pull (mergeProfilesLWW).
- Un client v8 reçoit un push v9 (avec isDemo: false) → ignore le
  champ inconnu, comportement legacy normal.
- Le profil démo (id `demo`, `isDemo: true`) n'est JAMAIS dans
  Firestore (chargé in-memory uniquement depuis le snapshot
  bundlé). `stripDemoProfiles` à ajouter Phase 7.51.2.

### Helpers purs Phase 7.51.1

```js
// True uniquement si profile.isDemo === true strict (rejette 'true', 1).
isDemoProfile(profile)

// True quand activeProfileId pointe un profil démo dans state.profiles.
isDemoMode(state, activeProfileId)

// Retourne le snapshot bundlé { version: 9, profile, setlists, songs }.
loadDemoSnapshot()
```

`makeDefaultProfile` (admin + non-admin) pose désormais
`isDemo: false` explicite.

### Tests Phase 7.51.1 (+11 nouveaux)

`state.test.js` section "Phase 7.51.1 — Demo profile foundations" :
- `migrateV8toV9` × 4 : pose false, préserve true, idempotent, null safe.
- `ensureProfileV9 / ensureProfilesV9` × 3 : chaîne v8 + pose isDemo,
  préserve flags explicites, map sur tous profils.
- `isDemoProfile` × 1 : strict boolean true uniquement.
- `isDemoMode` × 2 : true sur profil démo actif, false sinon, defensive.
- `loadDemoSnapshot` × 1 : structure valide (version 9, profile.id='demo',
  isDemo:true, setlists Array, songs Array).

Mise à jour test `STATE_VERSION` (attend 9, plus 8).

### Placeholder demo-profile.json (Phase 7.51.1)

`src/data/demo-profile.json` contient un placeholder minimal :
- profil démo (id='demo', name='Démo', isDemo:true, isAdmin:false),
  rig 2 guitares (lp60, strat61), Anniversary + Plug activés,
  sources TSR/ML/Anniversary/PlugFactory/ToneNET activées.
- 1 setlist "Demo Setlist" avec 5 morceaux mock (`demo_s1` à `demo_s5`),
  aiCache: null partout.

Le contenu réel curé (rig 11 guitares, banks complètes, setlist 11
morceaux avec aiCache trilingue) sera produit par l'outil d'export
admin Phase 7.51.4 à partir du profil `demo_1778839429588` déjà
existant sur le compte de production.

### Architecture livrée à fin Phase 7.51.1

```
src/main.jsx                APP_VERSION 8.14.51 → 8.14.52
public/sw.js                CACHE backline-v151 → backline-v152
src/core/state.js           STATE_VERSION 8 → 9
                            +import demoSnapshot from '../data/demo-profile.json'
                            +ensureProfileV9 / ensureProfilesV9
                            +migrateV8toV9
                            _runFullChain chaîne v9
                            loadState accepte v8 → migrate
                            mergeProfilesLWW utilise ensureProfileV9
                            makeDefaultProfile pose isDemo: false
                            +isDemoProfile, isDemoMode, loadDemoSnapshot
                            +exports
src/core/state.test.js      +11 tests Phase 7.51.1, STATE_VERSION attend 9
src/data/demo-profile.json  NOUVEAU — placeholder 5 morceaux mock
```

### Dette résiduelle Phase 7.51.1 → 7.51.2-4

- **Phase 7.51.2** (guard runtime) : wrapper `wrapDemoGuard(fn, label)` +
  toast "Action désactivée en mode démo" appliqué sur setProfileField,
  setSetlists, setSongDb, setDeletedSetlistIds, recordLogin. Block
  `fetchAI` à la racine. Block Firestore (saveToFirestore,
  loadFromFirestore, pollRemoteSyncId, load/saveSharedKey) early-return
  si isDemoMode(state). Cacher tabs admin (Profils, ToneNET,
  Maintenance, Mot de passe, Clé API, Export/Import). Locale switch
  écrit localStorage backline_locale + state in-memory mais pas
  profile.language. `stripDemoProfiles(state)` symétrique à
  stripAiCacheForSync (Phase 5.7.1) pour les pushes Firestore.
- **Phase 7.51.3** (accès & banner) : carte "Mode démo · Découvrir
  Backline" toujours visible sur ProfilePickerScreen. URL `?demo=1`
  auto-load + nettoyage URL via history.replaceState. Composant
  `DemoBanner.jsx` sticky top trilingue avec mailto pré-rempli vers
  sebastien.chemin@gmail.com. Visible partout sauf LiveScreen.
  Skip trusted device addition.
- **Phase 7.51.4** (outil de curation admin) : bouton "📦 Exporter
  snapshot démo" dans MaintenanceTab admin. Helper pur
  `buildDemoSnapshot(profile, allSetlists, allSongs)` qui produit le
  JSON à downloader. Workflow doc dans CLAUDE.md : curer un profil
  dédié → exporter → remplacer src/data/demo-profile.json → commit
  → push → bump version.

---

## État précédent (2026-05-15, Phase 7.50 close — 8 fixes rapport beta v8.14.48)

**Backline v8.14.51 / SW backline-v151 / STATE_VERSION 8 / 775 tests verts.**
Phase 7.50 traite les bugs du rapport de test fonctionnel sur v8.14.48
(15 mai 2026) : Vague 1 (cosmétique + i18n) et Vague 2 (UX + sources)
groupées. 8 tickets sur 12 closes (4 reportés P3 ou pending dump).

### Tickets clôturés Phase 7.50

#### Vague 1 — Cosmétique / i18n

- **B-COSM-01** — Accents FR : ~22 corrections diacritiques dans les
  fallbacks inline `t('key', 'FR-sans-accents')` :
  - HomeScreen.jsx : memes→mêmes, ideale→idéale, recommande→recommandé,
    Cree→Crée, repetition→répétition, scene→scène, parametrage→paramétrage,
    installes→installés, depliables→dépliables, etapes→étapes,
    pedale→pédale, modele→modèle, adaptees→adaptées, temps reel→temps réel,
    telephone→téléphone, Compatibilite→Compatibilité, (estime)→(estimé),
    Reglages→Réglages, Fonctionnalites→Fonctionnalités,
    Preparer→Préparer, ideal→idéal.
  - SongDetailCard.jsx : Recommandation idéale, Non installé,
    Paramétrage, Installé — Banque, Compatibilité, (estimé), Réglages,
    "Packs recommandés à l'achat", "Aucun preset installé", "Le meilleur
    preset installé".
  - MonProfilScreen.jsx : Clé API (tab), clé API (sous-titre),
    Modèle actif, Mise à jour, Se déconnecter.
  - PresetBrowser.jsx : Pédales de drive, Captures pédales seules,
    Modèle d'ampli, Sons saturés, Réinitialiser.
- **B-COSM-02** — Double ✕ Explorer : CSS
  `input[type="search"]::-webkit-search-cancel-button { -webkit-appearance: none }`
  ajouté à `src/styles/tokens.css`. Cache l'icône native Safari/Chrome
  superposée au bouton ✕ custom Phase 7.21.
- **B-I18N-01** — Strings FR résiduelles wrappées i18n :
  - ListScreen.jsx:562 (badge guitare recap "{count} morceau(x)") →
    `tPlural('list.songs-count', ...)`.
  - GuitarSelect.jsx:43 ("✓ Choix optimal") → `t('guitar-select.ideal', ...)`.
  - Aussi placeholder dropdown et message warn (Idéalement: ...).
  - 3 nouvelles clés EN/ES (`guitar-select.placeholder`, `.ideal`, `.warn`).
- **B-COSM-04** — Emoji collé au texte : **No-op**. Audit fait : tous
  les emojis dans le source ont bien un espace après. L'effet visuel
  "🎤Mode" rapporté est un rendu navigateur (fonte emoji couleur tasse
  visuellement par rapport au texte). Pas un bug code.

#### Vague 2 — UX / Logique

- **B-UX-01** — Sources orphelines : ProfileTab.jsx tab Sources gère
  désormais l'état "indisponible" pour `FactoryV1` (si
  `FACTORY_BANKS_PEDALE_V1` vide) et `custom` (si `customPacks` vide).
  Toggle disabled + opacity 0.5 + cursor not-allowed + badge "liste à
  fournir" / "aucun pack custom". Évite que Sébastien voie un toggle
  coché par défaut pour des sources qui n'ont pas de contenu disponible.
  3 nouvelles clés i18n.
- **B-UX-02** — Label dynamique Pédale vs Anniversary :
  `BankOptimizerScreen.jsx` + `JamScreen.jsx` retirent le hardcode
  "📦 Pédale". Label calculé selon `enabledDevices` :
  - `tonex-anniversary` activé → "🏭 Anniversary".
  - `tonex-pedal` activé → "📦 ToneX Pedal".
  - Aucun → "📦 Pédale" (fallback).
  9 nouvelles clés i18n (`optimizer.anniversary-*`, `optimizer.pedal-*`,
  `jam.top3-pedal`, `jam.top3-anniversary`).
- **B-COSM-03** — Overflow badge amp ListScreen :
  - `maxWidth` 180 → 220 (donne plus d'espace).
  - `title` attribut sur le span externe avec `"<preset> · <amp>"`
    complet → hover desktop / tap mobile montre la valeur entière.
  - Le span amp inner devient `flexShrink: 0` (ne tronque plus) ; c'est
    le span preset label qui tronque en priorité (ellipsis).
- **B-UX-04** — Avatar discoverable : `ProfileSelector.jsx` ajoute un
  chevron `▾` à droite de l'initiale + `title` + `aria-label`.
  Layout passe en flex avec chevron 9px opacity 0.7. Le user comprend
  immédiatement que l'élément est un dropdown.
- **B-UX-05** — Tu/vous IA : nouvelle section "CONSIGNE DE REGISTRE"
  dans `fetchAI.js` prompt entre "settings_guitar" et "OUTPUT TRILINGUE".
  Demande explicitement le tutoiement informel dans les 3 langues :
  FR (tu/ta/ton/tes, verbes 2e personne singulier), EN (you/your
  conversationnel), ES (tú/tu/tus, tuteo, verbes "prueba/empuja/mantén"
  pas "pruebe/empuje/mantenga"). Liste explicitement les champs
  concernés et interdit le mélange tu+vous dans une même phrase.

### Tickets reportés Phase 7.50 → 7.51+

- **B-UX-03** (preset 93% non-installé vs installé) : nécessite
  investigation runtime sur un cas concret. Phase 7.32 fix utilise stable
  sort (V8 TimSort ES2019), donc le preset_ann (1er du tableau source)
  gagne sur ideal_preset à score égal exact. Si user voit un cas où
  ideal_preset gagne malgré un installed à même score affiché, c'est
  probablement un float arrondi (ex. installed=92.4, ideal=92.8, tous
  deux affichés 93). À investiguer avec dump aiCache du morceau concerné.
- **B-UX-06** (faux positif filtrage Phase 7.29.5) : confirmé comme
  attendu, pas un bug.
- **B-TECH-01** (cycles pull/push Firestore au reload) : investigation
  reportée Phase 7.51 — pourquoi "Batch rescore 2 morceaux" à chaque
  reload alors que SCORING_VERSION stable.
- **B-TECH-02** (localStorage 3.5 MB) : MAX_BACKUPS=1 décidé reporté
  Phase 7.51 — touche à la robustesse, à appliquer avec test plan.
- **B-TECH-03** (raw 1.7 MB Firestore) : surveillance, pas d'action
  Phase 7.50.
- **B-I18N-02** (ES non testé) : extrapolation, pas d'action sans
  test concret.
- **B-I18N-03** (footer Phase 7.44 EN/ES) : audit côté code confirme
  que `AppFooter.jsx` a bien `useLocale()` + `t('common.footer-disclaimer',...)`.
  Probablement un cache SW stale pendant le test sur v8.14.48. À
  reconfirmer après reload sur v8.14.51.
- Améliorations (A-UX-*, A-FEAT-*) : reportées Phase 8+.

### Conséquences

- Pas de bump STATE_VERSION (changements purement UI + prompt IA).
- Pas de migration localStorage.
- Bundle 1886.54 → 1890.27 KB (+3.7 KB : 22 corrections accents inline
  + 15 nouvelles clés i18n × 2 langues + 2 nouvelles consignes prompt
  + dropdown chevron + classes CSS).
- 775/775 tests verts (aucun nouveau test, aucune régression).
- aiCache existants : phrasing tu/vous mixte conservé jusqu'à
  ré-analyse. Pour basculer sur le nouveau registre 100% tutoiement,
  invalider via "🔄 Réinitialiser mes analyses" Mon Profil → Préférences IA.

### Architecture livrée à fin Phase 7.50

```
src/main.jsx                            APP_VERSION 8.14.50 → 8.14.51
public/sw.js                            CACHE backline-v150 → backline-v151
src/styles/tokens.css                   [7.50 B-COSM-02] hide webkit search clear
src/app/screens/HomeScreen.jsx          [7.50 B-COSM-01] ~16 accents FR
src/app/screens/SongDetailCard.jsx      [7.50 B-COSM-01] ~10 accents FR
src/app/screens/MonProfilScreen.jsx     [7.50 B-COSM-01] 5 accents FR
src/app/screens/PresetBrowser.jsx       [7.50 B-COSM-01] 5 accents FR
src/app/screens/ListScreen.jsx          [7.50 B-I18N-01] tPlural sur badge guitare
                                        [7.50 B-COSM-03] title + maxWidth + minWidth 0
src/app/components/GuitarSelect.jsx     [7.50 B-I18N-01] useLocale + 3 t() wraps
src/app/screens/ProfileTab.jsx          [7.50 B-UX-01] disabled toggle FactoryV1/custom
src/app/screens/BankOptimizerScreen.jsx [7.50 B-UX-02] label dynamique annLabel*
src/app/screens/JamScreen.jsx           [7.50 B-UX-02] annTop3Label dynamique
src/app/components/ProfileSelector.jsx  [7.50 B-UX-04] chevron ▾ + title + aria
src/app/utils/fetchAI.js                [7.50 B-UX-05] CONSIGNE DE REGISTRE tutoiement
src/i18n/en.js                          +15 clés (guitar-select, profile-tab.empty-*,
                                        optimizer.anniversary-*, .pedal-*, jam.top3-*)
src/i18n/es.js                          idem ES
```

### Dette résiduelle Phase 7.50

- Investigation B-UX-03 nécessite dump aiCache (cf T6 Paranoid
  pending pour le même besoin).
- B-TECH-01 (cycles sync) à analyser : possiblement un bug Phase
  6.1.3 où le rescore mute aiCache.sv et déclenche un push même
  après stabilisation. À monitorer en console après déploiement
  v8.14.51.
- Tutoiement IA dépend du respect du prompt par Gemini Flash. Si
  l'IA continue à utiliser "vous" malgré la consigne, fallback :
  post-processing JS qui détecte/réécrit les motifs ("réglez" →
  "règle", "essayez" → "essaie", etc.).
- Labels dynamiques B-UX-02 : si l'utilisateur active SIMULTANÉMENT
  `tonex-anniversary` ET `tonex-pedal`, le label affiche "Anniversary"
  (priorité). C'est OK car les deux devices partagent `banksAnn`,
  mais à reconsidérer si Phase 8+ splitte les banks par device.

---

## État précédent (2026-05-15, Phase 7.49 close — i18n per-profile + T9 vocabulaire)

**Backline v8.14.50 / SW backline-v150 / STATE_VERSION 8 / 775 tests verts.**
Phase 7.49 introduit la migration `STATE_VERSION 7 → 8` pour ajouter le
champ `profile.language` per-profile (T7) et documente la dichotomie
capture vs preset (T9, décision sans refactor wholesale).

### Schéma v8 (additif vs v7)

```
profile {
  ...,                            // v7 inchangé
  language: 'fr' | 'en' | 'es'    // NOUVEAU v8 — locale per-profile
}
```

### Migration v7 → v8 (Phase 7.49 — T7)

`migrateV7toV8(state)` lit `localStorage.backline_locale` (présent
depuis Phase 7.36) et applique uniformément cette locale à chaque
profil existant. Fallback `'fr'` si rien dans localStorage.

- **Profil existant sans `language`** : hérite de la locale globale au
  moment du premier load post-7.49.
- **Profil existant avec `language` valide** (`'fr'/'en'/'es'`) :
  préservé.
- **Profil existant avec `language` invalide** (ex. `'de'`) : écrasé
  par fallback.
- **Profil new via `makeDefaultProfile`** : `language` = locale globale
  actuelle (`_readGlobalLocale()`), fallback `'fr'`.
- **Idempotence** : appliquer migrateV7toV8 sur un state déjà v8 → no-op.
- **`mergeProfilesLWW` Firestore** : tous les profils sortants passent
  désormais par `ensureProfileV8` (qui appelle `ensureProfileV7` + pose
  `language` si absent).

### Architecture i18n per-profile (Phase 7.49 — T7)

`src/i18n/index.js` étendu avec deux nouvelles API :

- `bindActiveProfile(profile)` : appelée par l'App au switch de profil
  ou au changement de `profile.language`. Met à jour la locale module
  niveau (`_activeProfileLanguage`) et notifie les listeners.
- `setProfileLanguageUpdater(updater)` : enregistre un callback
  `(loc) => void` que `setLocale()` invoque pour persister le changement
  dans `profile.language` (en plus du localStorage global, conservé en
  fallback pour le ProfilePicker pré-login).

`getLocale()` priorité : `_activeProfileLanguage` > `localStorage.backline_locale`
> détection nav. Le hook `useLocale()` continue à fonctionner sans
modification (re-render via `subscribeLocale`).

**App (main.jsx)** ajoute deux `useEffect` après la résolution du
profil actif :

```js
useEffect(() => { bindActiveProfile(profile); }, [profile?.id, profile?.language]);
useEffect(() => {
  setProfileLanguageUpdater((loc) => {
    setProfiles((p) => {
      const cur = p[activeProfileId]; if (!cur) return p;
      if (cur.language === loc) return p;
      return { ...p, [activeProfileId]: { ...cur, language: loc, lastModified: Date.now() } };
    });
  });
  return () => setProfileLanguageUpdater(null);
}, [activeProfileId]);
```

Le `profile.language` est inclus dans le `profileHash` syncHash
(Phase 7.46) → propagation Firestore.

### Comportement utilisateur (Phase 7.49)

- **Premier load post-déploiement** : chaque profil existant hérite de
  la locale globale au moment de la migration. Sébastien (FR) →
  `language: 'fr'`, Bruno (auto-détecté EN si nav.language=en) →
  `language: 'en'`.
- **Switch de profil** : la langue de l'app suit `profile.language` du
  nouveau profil actif. Si Sébastien (FR) switch vers Francisco (ES),
  l'UI passe en ES instantanément.
- **Changement de langue** : Mon Profil → 🎨 Affichage → drapeau →
  écriture dans `profile.language` du profil actif + sync Firestore.
  Les autres profils gardent leur langue.
- **ProfilePicker (avant pick)** : utilise localStorage `backline_locale`
  global comme fallback. Sébastien qui pose `language: 'es'` sur son
  profil voit son picker rester en FR jusqu'à ce qu'il le change
  explicitement (Mon Profil → Affichage écrit aussi le localStorage
  global pour cohérence).

### Tests Phase 7.49

10 nouveaux tests Vitest ajoutés (`state.test.js`) :
- `migrateV7toV8` (6) : fallback fr, héritage localStorage (mocké via
  `vi.stubGlobal`), préservation language explicite, idempotence,
  language invalide écrasé, null/undefined safe.
- `ensureProfileV8 / ensureProfilesV8` (4) : fallback fr, préservation
  valide, délégation V7 (stamp lastModified), map sur tous profils.

Le test `STATE_VERSION` mis à jour pour expecter `8` (vs `7` Phase 7.46).

### T9 — Vocabulaire capture vs preset (décision documentée, refactor reporté)

Voir section **Vocabulaire ToneX** ci-dessous.

### Conséquences

- Bump STATE_VERSION 7 → 8 (migration additive idempotente).
- Bundle 1885.47 KB → 1886.54 KB (+1 KB pour la migration + bindings i18n).
- 775/775 tests verts (vs 765 Phase 7.48, +10 nouveaux migrateV7toV8 +
  ensureProfileV8).
- Cohabitation v7/v8 sur Firestore : les clients v7 reçoivent un push
  v8 (profile.language présent) → ignoré silencieusement par leur
  schéma v7 (champ non interprété). Les clients v8 reçoivent un v7
  push (sans language) → `ensureProfileV8` au pull comble. Pas de
  perte de données.

### Architecture livrée à fin Phase 7.49

```
src/main.jsx                    APP_VERSION 8.14.49 → 8.14.50
                                +useEffect bindActiveProfile + updater
                                +profileHash includes p.language
public/sw.js                    CACHE backline-v149 → backline-v150
src/core/state.js               STATE_VERSION 7 → 8
                                +LOCALE_KEY, _readGlobalLocale
                                +ensureProfileV8 / ensureProfilesV8
                                +migrateV7toV8
                                _runFullChain chaîne v8
                                loadState accepte v7 → migrate
                                mergeProfilesLWW utilise ensureProfileV8
                                makeDefaultProfile pose language
src/core/state.test.js          +10 tests migrateV7toV8 + ensureProfileV8
                                STATE_VERSION attend 8
src/i18n/index.js               +bindActiveProfile / setProfileLanguageUpdater
                                getLocale priorité _activeProfileLanguage
                                setLocale invoke updater + localStorage
```

### Dette résiduelle Phase 7.49

- Cohabitation v7/v8 sur Firestore : un device pré-7.49 peut pousser un
  state sans `profile.language`. Le device post-7.49 le heal au pull
  via `ensureProfileV8` mais le push retour porte language → le pré-7.49
  ne le voit pas. Fenêtre courte (max le temps de déploiement sur tous
  les devices).
- **ProfilePicker** : ne suit pas encore `profile.language` (le pick
  est PRÉ-login). Utilise localStorage global. Acceptable car la
  langue choisie au pick reflète la dernière langue d'usage sur
  l'appareil — sera mise à jour après pick.
- **Test E2E sync per-profile** : non couvert par Vitest. Smoke-test
  manuel à faire post-déploiement (Sébastien FR sur Mac, Bruno EN sur
  iPhone, vérifier que chacun garde sa langue après sync).

---

## Vocabulaire ToneX (Phase 7.49 — décision documentée pour T9)

Terminologie officielle IK Multimedia × usage interne Backline :

- **Capture (Tone Model)** : Le ML model entraîné depuis un ampli/cab
  physique. C'est l'unité atomique du ToneX. Une capture a un nom (ex.
  "TSR Mars 800SL Cn1&2 HG"), un voicing fixe (amp + cab + mic dans la
  capture), et un `src` (`Factory`, `FactoryV1`, `Anniversary`,
  `PlugFactory`, `TSR`, `ML`, `ToneNET`, `custom`).
- **Preset** : Un slot configuré dans le hardware. Sur ToneX Pedal
  classique (50 slots × A/B/C) et ToneX Plug (10 × A/B/C), un preset =
  une capture chargée dans le slot + Stomp + EQ + Reverb intégrés au
  firmware. La distinction capture/preset est mince ici car un slot
  contient essentiellement une capture (les FX intégrés sont minimes).
- **Patch (TMP)** : Sur le Tone Master Pro, un patch = chaîne complète
  de 9 blocs (noise_gate, comp, eq, drive, amp+cab issus de captures,
  mod, delay, reverb) + Scenes + footswitch map. Plus complexe que
  l'unité capture seule.

**Décision Phase 7.49** : Le vocabulaire i18n actuel mixe "preset"
(usage hardware end-user) et "capture" (terme technique). La
distinction est faible sur Pedal/Anniversary/Plug — refactor wholesale
non justifié (87 strings i18n × 3 langues = risque énorme). Pour
TMP, "patch" est déjà utilisé dans l'UI quand on parle de la chaîne
complète, ce qui est correct.

Si la confusion utilisateur est rapportée explicitement par les
beta-testeurs, un refactor ciblé sur les ~10 sites visibles
(badges, titres de cards) pourra être fait Phase 7.50+ — sans toucher
aux champs JSON internes (`preset_ann_name`, `settings_preset`).

### PDF Anniversary — Preset Name vs Tone Model Name (Phase 7.52.4)

Le PDF officiel `tone_models/TONEX_Pedal_Anniversary_Edition_Premium_Tone_Models.pdf`
liste chaque capture avec **2 colonnes distinctes** :

- **Preset Name** (col 1) : nom court, version "marketing" parfois.
  Ex: `"TSR D13 Clean"`, `"TSR TSR20 + Light Gain"`, `"WT TEXSTAR Ch2 5"`.
- **Tone Model Name** (col 2) : nom complet du modèle ML.
  Ex: `"TSR D13 Best Tweed Ever Clean"`, `"TSR - TSR20 - Light Gain P"`,
  `"WT MSA TEXSTAR CH2 5"`.

**Décision firmware Anniversary** (confirmée 2026-05-15 par Sébastien
en observant la pédale physique) : **le firmware affiche le Tone Model
Name** (col 2), pas le Preset Name. Donc les utilisateurs voient les
noms longs dans leurs banks visualisables côté pédale ET côté Backline.

**Conséquence pour le catalog Phase 7.52** (`src/data/anniversary-premium-catalog.js`) :
les keys utilisent le Preset Name (col 1) par défaut (Phase 7.52.3),
mais chaque entry a un champ `toneModelName: "<col 2>"`. Le helper
`findCatalogEntry` (`src/core/catalog.js`) a un fallback Phase 7.52.4
qui matche `v.toneModelName === name` en plus du match direct sur la
key. Cela couvre les ~25 cas où col 1 ≠ col 2.

Pour les futures additions de captures Anniversary : **toujours
renseigner les deux** :
- `name: "<Preset Name col 1>"` (key dict + display fallback)
- `toneModelName: "<Tone Model Name col 2>"` (firmware-visible name)

Si col 1 = col 2 (cas majoritaire AA, JS, certaines TJ et WT), pas de
préoccupation supplémentaire — le match direct fonctionne pour les
deux variantes.

Source : confirmation utilisateur 2026-05-15 + diff visuel banks
Sébastien vs PDF source (`tone_models/`).

---

## État précédent (2026-05-15, Phase 7.48 close — 6 tickets beta)

**Backline v8.14.49 / SW backline-v149 / STATE_VERSION 7 / 765 tests verts.**
Phase 7.48 traite 6 tickets remontés ce week-end par les beta-testeurs
(Bruno, Francisco) et observations Mac/iPhone. Vague 1+2 sur le plan
en 4 vagues : quick wins responsive + logique IA/profil ciblée.

### Tickets clôturés Phase 7.48

- **T11** — `Sire` ajoutée à `GUITAR_BRANDS` via 2 modèles (Larry Carlton T7
  Telecaster + T3 semi-hollow). Single coils, type SC. Le profil de scoring
  est inféré via les heuristiques `inferGuitarProfile` existantes (les
  noms incluent "Telecaster" / "semi-hollow" pour matcher les regex).
- **T1** — Bouton 🗑️ ListScreen responsive : `padding '0 6px'` (au lieu de
  '0 12px') + `minWidth: 32` pour garantir une cible touch acceptable.
  Libère ~8px sur la row morceau (cf testing iPhone 390px).
- **T5** — PasswordTab overflow iPhone : wrapper `MonProfilScreen.jsx:457`
  passe à `width: '100%' + boxSizing: 'border-box'` (en plus de
  `maxWidth: 480`). Évite que les 32px de padding débordent du parent
  390px.
- **T4** — `historicalFeedback` désormais passé à `fetchAI` dans les
  batches : `ListScreen.analyzeMissingAll` (l.331), `ListScreen.improveAll`
  (l.368), `MaintenanceTab.recalcAll` (l.100). 3 sites alignés sur le
  pattern de `SongDetailCard.jsx:78` (concat de `song.feedback[].text`
  via `.join('. ')`). Le recalcul tient maintenant compte de l'historique
  feedback du user — alignement avec Phase 7.6.
- **T8 court terme** — `makeDefaultProfile` (`core/state.js:565`) split en
  deux branches : `isAdmin=true` garde les defaults Sébastien (rétrocompat,
  rarement appelé), `isAdmin=false` retourne désormais un profil
  **vierge** : `myGuitars=[]`, `enabledDevices=[]`, `banksAnn/Plug={}`,
  `availableSources={ TSR:false, ML:false, Anniversary:false, Factory:false,
  FactoryV1:false, PlugFactory:false, ToneNET:false, custom:false }`,
  `customPacks/customGuitars/editedGuitars` déjà vides. Un nouveau
  beta-testeur démarre sans présupposé sur son rig. Wizard onboarding
  3 étapes reporté à Phase 7.50+ (cf dette résiduelle).
- **T10** — Détection `rigStale` (= `song.aiCache.rigSnapshot !==
  computeRigSnapshot(rig actif)`) ajoutée dans le `useEffect` de
  `SongDetailCard.jsx:60`. Quand stale, le rescore local via
  `enrichAIResult` est bypassé et un `fetchAI` complet est forcé.
  Message UI dédié : *"Analyse précédente faite avec un autre rig —
  recalcul pour ton matériel…"* (3 langues). Resout le trade-off
  Phase 7.29.5 (aiCache partagé entre profils via dedup songDb par id) :
  un nouveau user qui ajoute un morceau déjà en base déclenche
  automatiquement un re-fetch à l'ouverture, sans attendre qu'il
  clique manuellement.

### Conséquences

- Pas de bump STATE_VERSION (changements additifs côté GUITARS +
  logique d'effets côté UI).
- Pas de migration localStorage.
- Bundle 1884.47 → 1885.47 KB (+1 KB pour 2 nouvelles guitares Sire,
  2 traductions EN/ES, message UI rigStale).
- 765/765 tests verts (test `makeDefaultProfile` mis à jour pour
  expecter le profil vierge non-admin).
- aiCache existants restent valides ; les caches avec rigSnapshot
  divergent du rig actif déclenchent désormais un re-fetch auto à
  l'ouverture du morceau (au lieu d'attendre clic batch).

### Architecture livrée à fin Phase 7.48

```
src/main.jsx                            APP_VERSION 8.14.48 → 8.14.49
public/sw.js                            CACHE backline-v148 → backline-v149
src/core/guitars.js                     [7.48 T11] +Sire (Larry Carlton T7, T3)
src/core/state.js                       [7.48 T8] makeDefaultProfile split
                                        admin/non-admin, non-admin vierge.
src/core/state.test.js                  [7.48 T8] test 'user' updated → []
src/app/screens/ListScreen.jsx          [7.48 T1] bouton 🗑️ padding réduit
                                        [7.48 T4] historicalFeedback × 2
src/app/screens/MaintenanceTab.jsx      [7.48 T4] historicalFeedback recalcAll
src/app/screens/MonProfilScreen.jsx     [7.48 T5] PasswordTab wrapper width/box-sizing
src/app/screens/SongDetailCard.jsx      [7.48 T10] rigStale détection + force fetchAI
src/i18n/en.js                          [7.48 T10] +song-detail.rig-stale-analyzing
src/i18n/es.js                          [7.48 T10] +song-detail.rig-stale-analyzing
```

### Vagues 3-4 reportées (tickets 6, 9, 7, 2, 3)

- **T6** (Paranoid reco) : nécessite dump aiCache iPhone pour identifier
  si l'IA hallucine `ref_amp=Orange` ou si la résolution rate Laney.
  Investigation à mener avec Sébastien au prochain test.
- **T9** (audit vocabulaire preset/capture) : refactor cohérent
  prompt + UI + i18n. Gros chantier scope-bound à part.
- **T7** (langue per-profile) : STATE_VERSION 7→8. Phase 7.51 dédiée
  (cluster avec autres migrations potentielles si possible).
- **T2** (LWW symétrique aiCache) : touche `mergeSongDbPreservingLocalAiCache`.
  Risque régression sync — Phase 7.52 avec test plan dédié.
- **T3** (SW background fetch iPhone) : Service Worker background sync.
  Architecture lourde — Phase 7.53+.

### Dette résiduelle Phase 7.48

- Wizard onboarding 3 étapes (T8 moyen terme) : à la première
  connexion d'un profil non-admin sans devices ni guitares, afficher
  "Matériel ? / Guitares ? / Setlist ?". Reporté Phase 7.50+ quand
  on aura du recul sur le profil vierge.
- Test Vitest sur `rigStale` flow dans SongDetailCard : non ajouté
  Phase 7.48 (utiliserait Vitest + jsdom + mock fetchAI). À ajouter
  si régression observée.

---

## État précédent (2026-05-15, Phase 7.47 close)

**Backline v8.14.48 / SW backline-v148 / STATE_VERSION 7 / 765 tests verts.**
Phase 7.47 corrige le mapping `FACTORY_BANKS_PEDALE` (cassé depuis l'origine
du repo) et introduit la distinction de sources `Factory` (firmware v2,
presets PDF 2025/04/03) vs `FactoryV1` (firmware historique, liste à
fournir). Le hardware ToneX Pedal est identique — seule la liste des
presets factory pré-installés diffère.

### Bug corrigé : mapping bank → slot décalé

`FACTORY_BANKS_PEDALE` dans `src/data/data_catalogs.js` était décalé dès
la bank 4 vs le PDF officiel `tone_models/TONEX_Pedal_Pre-loaded_Factory_Presets.pdf`
v2 (2025/04/03). 5 presets manquaient (`DR OR120`, `HG OR120`, `HG 5051`,
`LD 5051`, `BOULEVAR`) → toute la suite était shiftée d'un slot. Le code
s'arrêtait à la bank 48 au lieu de 49 (BS XULTR/BS DOC/BS MUFF perdus).

Aussi corrigé : typos d'orthographe (PDF utilise `HIWTT`, `3NITY`,
`8O8` avec lettre O — pas `HWTT`, `3NTY`, `808`). Les 4 clés Factory
correspondantes (`CL/DR/HG HIWTT`, `CL/DR/HG 3NITY`, `MAXO 8O8`,
`TS8O8 A/B`, `CL HIWTT (Amp)`) ont été renommées dans `FACTORY_CATALOG`
pour matcher le PDF.

### Split FACTORY_BANKS_PEDALE V1/V2

- `FACTORY_BANKS_PEDALE_V2` : 50 banks × 3 slots = 150 presets conformes
  au PDF v2.
- `FACTORY_BANKS_PEDALE_V1` : objet vide (`{}`). Liste à fournir par
  Sébastien (firmware v1 historique).
- `FACTORY_BANKS_PEDALE` : alias rétro-compat → pointe sur V2.

### Ajout source FactoryV1 (additif, pas de migration)

`src/core/sources.js` étendu :
- `SOURCE_IDS` : `[...existing, 'FactoryV1', ...]` (8 sources désormais).
- `Factory` label clarifié → "Pédale classique v2 — Captures pré-installées".
- `FactoryV1` ajouté → "Pédale classique v1 — Captures pré-installées".
- Badges courts : `Factory → 'Fact v2'`, `FactoryV1 → 'Fact v1'`
  (≤ 8 chars contrainte UI).
- Descriptions tunées pour distinguer firmware v1 vs v2.

**Pas de migration localStorage** : `profile.availableSources.Factory`
reste valide et continue à représenter le firmware v2. Les utilisateurs
verront simplement un nouveau toggle "Pédale classique v1" inactif par
défaut (aucun preset n'a `src: "FactoryV1"` tant que la liste n'est
pas fournie).

### BankEditor : dropdown firmware

`src/app/components/BankEditor.jsx` étendu avec une nouvelle prop
optionnelle `factoryBanksByVersion` (array d'options `{id, label, banks}`)
+ `defaultFactoryVersion`. Quand fournie, un dropdown firmware
("v2 (2025)" / "v1 (historique)") apparaît au-dessus du bouton "Réinitialiser".
L'option dont la liste est vide est `disabled` dans le dropdown +
le bouton est désactivé avec hint "Liste à fournir pour cette version".

`MonProfilScreen` tab `pedale` câblé avec les deux versions. Tabs
`ann` et `plug` continuent à utiliser la prop `factoryBanks` legacy
(rétro-compat, aucune migration UI).

### Profil Sébastien (Anniversary) non impacté

Sébastien tourne sur `tonex-anniversary` (`banksAnn` partagé, presets
issus de la curation TSR/ML, pas de FactoryV2 dans son catalogue
installé). Le fix touche uniquement le bouton "Réinitialiser banks
factory" du tab `pedale` (`tonex-pedal`), qui n'est visible que si
ce device est dans `enabledDevices`. Arthur (futur, ToneX Pedal) est
le profil cible directement concerné.

### Test conformité PDF v2

`src/devices/tonex-pedal/factory-banks.test.js` (nouveau) hardcode les
150 slots attendus du PDF v2 et vérifie l'égalité avec
`FACTORY_BANKS_PEDALE_V2`. 55 tests :
- 50 tests `test.each` (un par bank, vérifie A/B/C exacts).
- 1 test `50 banks total`.
- 1 test `chaque nom existe dans FACTORY_CATALOG`.
- 1 test `150 presets total`.
- 1 test `FACTORY_BANKS_PEDALE alias = V2`.
- 1 test `FACTORY_BANKS_PEDALE_V1 est un objet vide`.

`src/core/sources.test.js` updated : SOURCE_IDS attend désormais 8
sources (vs 7).

### Conséquences

- Pas de bump STATE_VERSION (changement purement additif).
- Pas de migration localStorage.
- Bundle 1882.22 KB → 1884.23 KB (+2 KB pour le nouveau dropdown
  BankEditor + 5 presets corrects + 6 nouvelles clés i18n).
- 710 → 765 tests verts (+55 nouveaux).
- aiCache existants : les caches citant `CL HWTT` / `CL 3NTY` /
  `MAXO 808` / `TS808 A/B` (typos anciennes) ne matcheront plus
  `findCatalogEntry` directement → fallback `guessPresetInfo` au
  prochain render, puis régénération propre au prochain `fetchAI`
  naturel. Pas critique.

### Architecture livrée à fin Phase 7.47

```
src/main.jsx                            APP_VERSION 8.14.47 → 8.14.48
public/sw.js                            CACHE backline-v147 → backline-v148
src/data/data_catalogs.js               [7.47] FACTORY_CATALOG keys renamed
                                        (HWTT→HIWTT, 3NTY→3NITY, 808→8O8) ;
                                        FACTORY_BANKS_PEDALE_V2 réécrit
                                        conforme PDF v2 (150 presets, 50
                                        banks) ; FACTORY_BANKS_PEDALE_V1
                                        placeholder vide ; alias
                                        FACTORY_BANKS_PEDALE → V2.
src/core/sources.js                     [7.47] +SOURCE_IDS 'FactoryV1' ;
                                        Factory label/badge/info clarifiés
                                        firmware v2.
src/core/sources.test.js                [7.47] SOURCE_IDS attend 8 ids.
src/devices/tonex-pedal/catalog.js      [7.47] re-export V1 + V2.
src/devices/tonex-pedal/index.js        [7.47] re-export V1 + V2.
src/devices/tonex-pedal/factory-banks.test.js   [7.47] NOUVEAU — 55 tests
                                        conformité PDF v2.
src/app/components/BankEditor.jsx       [7.47] +prop factoryBanksByVersion,
                                        defaultFactoryVersion ; dropdown
                                        firmware + bouton disabled si liste
                                        vide.
src/app/screens/MonProfilScreen.jsx     [7.47] tab pedale câblé sur les
                                        deux firmwares.
src/i18n/en.js                          [7.47] +bank-editor.firmware*,
                                        reset-empty-hint.
src/i18n/es.js                          [7.47] +bank-editor.firmware*,
                                        reset-empty-hint.
```

### Dette résiduelle Phase 7.47

- **Liste presets factory v1** : `FACTORY_BANKS_PEDALE_V1` reste vide
  tant que Sébastien n'a pas trouvé la liste historique. Quand fournie,
  ajouter les entries correspondantes au `FACTORY_CATALOG` (avec
  `src: "FactoryV1"`) et remplir `FACTORY_BANKS_PEDALE_V1` dans
  `data_catalogs.js`. Le dropdown et le bouton du BankEditor
  s'activeront automatiquement.
- **Coexistence Factory v1 + Factory v2 côté Profil → Sources** : un
  utilisateur ne devrait probablement cocher qu'**un seul** des deux
  firmwares (le sien). Pas de garde-fou UI pour empêcher de cocher
  les deux ; à voir si besoin de l'ajouter plus tard.
- **Renommage final Factory → FactoryV2** : non fait Phase 7.47
  (additif). Si la nomenclature interne doit être homogénéisée (toutes
  les entries `src: "Factory"` deviennent `src: "FactoryV2"`),
  c'est un changement Phase 8+ avec STATE_VERSION 7→8.

---

## État précédent (2026-05-14, Phase 7.46 close)

**Backline v8.14.47 / SW backline-v147 / STATE_VERSION 7 / 710 tests verts.**
Phase 7.46 corrige un bug majeur de sync Firestore : les éditions de
banks (ainsi que customPacks, editedGuitars, tmpPatches, recoMode,
guitarBias) ne remontaient JAMAIS à Firestore depuis Phase 6.1.1
(2026-05-12). Symptôme reporté ce soir par Sébastien : il a perdu ses
banks plusieurs fois dans la soirée et a dû réimporter son CSV à
chaque fois ; il a aussi constaté que les banks modifiées sur Mac ne
descendaient pas sur l'iPhone.

### Bug racine (depuis Phase 6.1.1)

Le `syncHash` (anti-boucle infinie de sync, `src/main.jsx:696-698`
pré-7.46) ne hashait que 5 champs profile : `myGuitars`,
`customGuitars` (ids), `availableSources`, `enabledDevices`,
`aiProvider`. Tous les autres champs LWW étaient invisibles au
détecteur de changement.

Conséquence chaîne :

1. User édite ses banks sur Mac → `setBanksAnn` → `setProfileField` →
   `setProfiles` stamp bien `profile.lastModified = Date.now()`.
2. Le `useEffect` persist se déclenche, recompute le hash → **hash
   inchangé** (banks pas hashées) → `shouldBump=false` → `if(!shouldBump) return;`
   ligne 734 → **push Firestore skippé**.
3. localStorage est bien écrit (banks persistent localement).
4. Firestore reste sur l'ancien état.
5. Plus tard, n'importe quel autre device (ou un événement local du
   genre login, ajout de morceau, toggle guitare) bumpe le hash →
   push à Firestore avec son profil ET son `lastModified` plus récent.
6. Le device qui avait les banks fraîches poll Firestore → `mergeProfilesLWW`
   voit `remote.lastModified > local.lastModified` → adopte
   ENTIÈREMENT le profil remote → **banks vaporisées**.

### Fix Phase 7.46 (1 changement)

**`src/main.jsx:696-712`** : `profileHash` étendu pour inclure tous
les champs LWW qu'un user peut éditer :

```js
const profileHash=Object.entries(profiles||{}).map(([id,p])=>
  id
  +":"+(p.myGuitars||[]).slice().sort().join(',')
  +":"+(p.customGuitars||[]).map(g=>g.id).slice().sort().join(',')
  +":"+JSON.stringify(p.availableSources||{})
  +":"+(p.enabledDevices||[]).slice().sort().join(',')
  +":"+(p.aiProvider||'')
  +":"+JSON.stringify(p.banksAnn||{})        // NOUVEAU 7.46
  +":"+JSON.stringify(p.banksPlug||{})       // NOUVEAU 7.46
  +":"+(p.customPacks||[]).map(pk=>(pk.name||'')+":"+((pk.presets||[]).map(pr=>pr.name||'').sort().join(','))).join('|')  // NOUVEAU 7.46
  +":"+JSON.stringify(p.editedGuitars||{})   // NOUVEAU 7.46
  +":"+JSON.stringify(p.tmpPatches||{})      // NOUVEAU 7.46
  +":"+(p.recoMode||'')                      // NOUVEAU 7.46
  +":"+JSON.stringify(p.guitarBias||{})      // NOUVEAU 7.46
).join('|');
```

### Champs volontairement EXCLUS

- `aiKeys` : stripés à `saveToFirestore` ligne 58 (anthropic + gemini
  vidés) et réinjectés via `applySecrets` au pull. Ne transitent
  jamais via Firestore, pas besoin de les hasher.
- `password` : pareil, stocké séparément en `tonex_secrets`
  localStorage et réinjecté par `applySecrets`.
- `loginHistory` : mute à chaque login (recordLogin stamp
  lastModified). Inclure dans le hash forcerait un push à chaque
  login, ce qui n'apporte rien — le log est local seulement.

### Conséquences

- Pas de bump STATE_VERSION (changement runtime uniquement).
- Pas de migration localStorage.
- Bundle 1881.99 KB → 1882.22 KB (+0.23 KB pour les fields supplémentaires).
- 710/710 tests verts (aucune régression).
- **Comportement attendu après déploiement** : édition d'une slot
  banks → icône sync ⏳ pendant ~2s (debounce) → ☁️ → autre device
  picke les banks dans les 5-10s suivants (poll 5s).

### Limite résiduelle Phase 7.46

- **Pas de test Vitest dédié au hash**. Il est inline dans un
  `useEffect` de main.jsx, peu testable en isolation. Pour ajouter
  un filet de régression : extraire le hash en helper pur
  `computeSyncHash(state)` dans `core/state.js`. Phase 7.47+ si
  jugé utile.
- **Pertes irréversibles avant déploiement** : les banks Sébastien
  perdues ce soir sont vraiment perdues — réimport CSV requis une
  dernière fois. Après v8.14.47 actif sur tous les devices, plus de
  perte.
- **Cohabitation pré-7.46/post-7.46** : un device pré-7.46 qui pousse
  encore un profil avec ses anciennes banks peut écraser un device
  post-7.46. Bumper APP_VERSION + SW CACHE force le pull de la
  nouvelle version au prochain reload de chaque device, ce qui
  limite la fenêtre à quelques minutes.

### Architecture livrée à fin Phase 7.46

```
src/main.jsx                   APP_VERSION 8.14.46 → 8.14.47
                               +profileHash étendu (banks, customPacks,
                               editedGuitars, tmpPatches, recoMode,
                               guitarBias)
public/sw.js                   CACHE backline-v146 → backline-v147
```

---

## État précédent (2026-05-14, Phase 7.45 close)

**Backline v8.14.46 / SW backline-v146 / STATE_VERSION 7 / 710 tests verts.**
Phase 7.45 reframe les conseils `settings_preset` et `settings_guitar`
de l'IA pour qu'ils soient présentés comme **personnalisation au
matériel/contexte de l'utilisateur**, pas comme **correction du
preset**. Anti-pattern à éviter dans les communications avec pack
creators (TSR Paul a répondu ce soir, ce qui a soulevé la question).

### Risque évité

Le champ `settings_preset` retournait des conseils du type :
> *"Pousse les basses et les aigus vers 6-7, garde les médiums vers 4
> pour le côté 'scooped' caractéristique du son californien."*

Lecture possible par un pack creator (TSR, ML, Galtone, Amalgam) :
- **Neutre** : "voici comment ajuster le preset à TA guitare/pièce"
- **Vexante** : "le preset TSR a besoin d'être corrigé, voici comment"

La lecture vexante peut blesser inutilement les créateurs dont les
captures sont leur métier (Paul de TSR fait des captures studio
mind-blowing — toute suggestion de "tweak" peut être interprétée
comme imperfection perçue).

### Fix Phase 7.45 (1 changement)

**`src/app/utils/fetchAI.js`** : ajout d'une section **"CONSIGNE DE
PHRASING POUR settings_preset ET settings_guitar"** entre ÉTAPE 6 et
OUTPUT TRILINGUE :

- **À FAIRE** :
  - Framer les conseils comme adaptation au matériel utilisateur :
    "Sur ta guitare, tu peux pousser les mids vers 6 pour compenser…",
    "Avec ton ampli FRFR, baisse légèrement les aigus pour…"
  - Présenter les ajustements comme optionnels et contextuels :
    "Si ta pièce est très réverbérante, tu peux…", "Pour faire
    ressortir ton attaque, essaie…"
  - Mettre en avant le point de départ qualitatif : "Le preset est
    déjà très juste pour ce morceau. Tu peux affiner avec…"

- **À ÉVITER ABSOLUMENT** :
  - "Corrige les basses du preset à 4", "Le preset gagne à avoir les
    mids à 6" (sous-entend défaut)
  - "Le preset manque de chaleur" / "trop scoopé" / "trop fort en
    aigus" (critique directe)
  - Toute formulation lisible comme défaut du capture par son créateur.

Le preset est explicitement présenté comme **calibré correctement par
son créateur** (TSR, ML Sound Lab, Galtone, Amalgam, ToneNET
community, IK Multimedia factory).

### Conséquences

- Pas de bump STATE_VERSION (changement prompt uniquement).
- Pas de migration localStorage.
- Les aiCache existants restent en place avec le phrasing ancien
  jusqu'à ré-analyse (les anciennes recos Bruno notamment). Pour
  basculer sur le nouveau phrasing : "🔄 Réinitialiser mes analyses"
  Phase 7.33 ou "🗑 Invalider tous les caches IA" admin.
- Bundle 1880 KB → 1882 KB (+2 KB pour le nouveau bloc prompt).
- 710/710 tests verts.

### Pourquoi le timing maintenant

Paul de TSR a répondu en quelques minutes au DM du soir :
> *"Thanks so much for your support! I'd love to see that working.
> Let me know if there's any packs you need!"*

→ Réponse hyper positive, ouverture à tester l'app. Avant qu'il y
plonge, il fallait s'assurer que le phrasing AI ne le pique pas
indirectement. C'est un signal clair sur la sensibilité du sujet
pour les créateurs : à intégrer comme contrainte produit
permanente, pas seulement pour TSR.

### Architecture livrée à fin Phase 7.45

```
src/main.jsx                   APP_VERSION 8.14.45 → 8.14.46
public/sw.js                   CACHE backline-v145 → backline-v146
src/app/utils/fetchAI.js       [7.45] +section "CONSIGNE DE PHRASING
                               POUR settings_preset ET settings_guitar"
                               entre ÉTAPE 6 et OUTPUT TRILINGUE.
                               Backticks templates échappés en
                               guillemets pour éviter rupture du
                               template literal (build error).
```

### Dette résiduelle Phase 7.45

- Le respect du phrasing dépend de Gemini Flash. Si l'IA continue
  à utiliser des formulations "le preset gagne à...", solution
  Phase 7.46 : post-processing JS qui filtre/réécrit les outputs
  qui contiennent des mots-clés défensifs ("corrige", "manque de",
  "trop", "remplace par"...).
- Aucun test Vitest dédié sur le respect du phrasing. Difficile à
  tester automatiquement vu la nature non-déterministe du LLM. À
  surveiller en feedback utilisateur (Paul lui-même peut nous
  signaler des cas problématiques).
- Quand un beta-testeur ML/Galtone/Amalgam rejoindra, valider que
  leur phrasing reste respectueux côté apostrophes culturelles
  (chaque pack creator a sa sensibilité).

---

## État précédent (2026-05-14, Phase 7.44 close)

**Backline v8.14.45 / SW backline-v145 / STATE_VERSION 7 / 710 tests verts.**
Phase 7.44 ajoute un disclaimer de marques tierces dans `AppFooter`,
en réponse au premier contact externe officiel (email envoyé à The
Studio Rats le 2026-05-14, réponse cordiale immédiate de Paul). Avant
ce contact, l'app n'avait que le copyright "© 2026 PathToTone" sans
mention explicite des marques utilisées (ToneX, ToneNET, etc.).

### Fix Phase 7.44 (1 changement)

**`src/app/components/AppFooter.jsx`** : nouvelle ligne sous le
copyright, plus discrète (fontSize 9 vs 10, opacity 0.7) :

```
© 2026 PathToTone · Made with 🎸 and ❤️
Outil indépendant — ToneX™ est une marque d'IK Multimedia SpA.
Autres marques citées appartiennent à leurs propriétaires respectifs.
```

Wrapping i18n via `t('common.footer-disclaimer', fallback FR)`.
Traductions ajoutées dans :
- `src/i18n/en.js` : "Independent tool — ToneX™ is a trademark of
  IK Multimedia SpA. Other mentioned trademarks belong to their
  respective owners."
- `src/i18n/es.js` : "Herramienta independiente — ToneX™ es una marca
  de IK Multimedia SpA. Las demás marcas mencionadas pertenecen a sus
  respectivos propietarios."

Hook `useLocale()` ajouté pour re-render au switch de langue.

### Conséquences

- Pas de bump STATE_VERSION.
- Pas de migration localStorage.
- Bundle 1880 KB → 1881 KB (+1 KB pour les 3 traductions et le 2e div).
- 710/710 tests verts.
- **Protection légale préventive** : usage nominatif des marques
  clarifié, indépendance affichée. Réduit le risque de contestation
  par IKM ou tout autre détenteur si le projet gagne en visibilité.

### Architecture livrée à fin Phase 7.44

```
src/main.jsx                       APP_VERSION 8.14.44 → 8.14.45
public/sw.js                       CACHE backline-v144 → backline-v145
src/app/components/AppFooter.jsx   [7.44] +import t/useLocale, +2e div
                                   disclaimer marques tierces wrappé
                                   t('common.footer-disclaimer')
src/i18n/en.js                     [7.44] +common.footer-disclaimer
src/i18n/es.js                     [7.44] +common.footer-disclaimer
```

### Dette résiduelle Phase 7.44

- Le disclaimer ne mentionne nominativement que ToneX/IK Multimedia.
  Les autres marques utilisées (TSR, ML Sound Lab, Galtone, Amalgam,
  Marshall, Fender, Mesa Boogie, Vox, etc.) sont couvertes par la
  formule générique "Autres marques citées…". Suffisant légalement
  mais pourrait être enrichi en Phase 7.45+ si TSR/ML/etc. demandent
  une mention explicite.
- Une page dédiée "Mentions légales" (Option B du conseil utilisateur
  initial) reste possible plus tard si le projet bascule vers
  scenario (b) freemium ou (c) open-source. Pas urgent.
- Pas de mention de licence du code Backline (par défaut "all rights
  reserved" GitHub). À trancher quand le scenario business est clair.

---

## État précédent (2026-05-14, Phase 7.43 close)

**Backline v8.14.44 / SW backline-v144 / STATE_VERSION 7 / 710 tests verts.**
**Multilingue FR/EN/ES complet** sur ~605 strings UI + 26 entrées seed +
champs texte IA via prompt trilingue. Bundle 1788 → 1880 KB (+92 KB pour
1170+ traductions inline). Plan déroulé en 8 sous-phases (7.36 → 7.43).

### Architecture i18n (Phase 7.36–7.43)

**`src/i18n/index.js`** :
- `SUPPORTED_LOCALES = [fr, en, es]`, auto-détection `navigator.language`
  au premier boot (persisté immédiatement pour stabilité reload — fix
  du design Phase 7.26 qui supprimait la clé pour FR).
- `getLocale()` avec cache module-level `_cachedLocale` (Phase 7.41) +
  `_tCache = Map` qui memoize résolution t(key, locale). Évite ~100
  `localStorage.getItem` + lookup hasOwnProperty par render de ListScreen.
  Cache vidé à `setLocale()`.
- `lookup()` supporte format **plat** (`dict['home.search.placeholder']`)
  prioritaire sur format imbriqué (reduce sur split('.')). en.js/es.js
  sont plats pour faciliter l'édition. fr.js reste vide volontairement
  (fallbacks inline FR = source de vérité).
- Helpers : `t(key, fallback)`, `tFormat(key, params, fallback)` avec
  remplacement `{placeholder}`, `tPlural(key, n, params, {one, other})`.
- Hook `useLocale()` (useState + subscribeLocale via useEffect) à appeler
  en tête de tout composant qui contient des t() et doit suivre le switch.
  Présent dans App (main.jsx), HomeScreen, SongDetailCard, MonProfilScreen.
- Sélecteur de langue dans Mon Profil → 🎨 Affichage (3 boutons drapeaux).

**`src/i18n/en.js`, `es.js`** : 605 traductions chacun. Termes guitare
en EN restent en anglais (preset, pickup, humbucker, gain, BPM, clean,
drive, lead). ES : "pastilla" pour pickup, "ampli" pour amp, "canción"
pour song, "banco" pour bank. Pluriels `{one, other}` pour les clés
tPlural. Tutoiement informel pour matcher le FR "tu". Namespaces :
add-song, bank-editor, common, devices, export, feedback, fuzzy,
guitar-add, home, jam, list, live, loading, maintenance, nav, optimizer,
packs, picker, preset-browser, preset-search, profile, profile-selector,
profile-tab, profiles, recap, setlists, song-detail, sound, synthesis,
tonenet, view-profile.

### IA trilingue (Phase 7.39 — Option D)

Le prompt `fetchAI.js` demande à Gemini de retourner les champs texte
au format `{"fr":"...","en":"...","es":"..."}` en UN seul appel :
- `cot_step1`, `cot_step3_amp`, `song_desc`, `guitar_reason`,
  `settings_preset`, `settings_guitar` (objets trilingues)
- `cot_step2_guitars[].reason` (objet trilingue par guitare)
- `cot_step4_score.{micro,body,history,amp_match}.reason` (idem)
- Champs scalaires NOMS PROPRES restent identiques : `ideal_guitar`,
  `ref_guitarist`, `ref_guitar`, `ref_amp`, `preset_*_name`,
  `cot_step2_guitars[].name`. Scores numériques inchangés.

Helper `getLocalizedText(value, locale)` dans `ai-helpers.js` décode :
- String legacy (aiCache pré-7.39) → retourne tel quel (FR pour tous)
- Objet trilingue `{fr, en, es}` → pioche locale avec cascade fallback
  fr → en → es → ''. Skip vides.
- null/undefined → ''
- Number → coerce string

Câblé dans HomeScreen + SongDetailCard sur tous les sites de rendu
texte IA. **Pas de bump STATE_VERSION** : schéma additif rétrocompat.

### Schéma localStorage v7 (inchangé, additif côté champs)

```
shared.songDb[i].aiCache.result {
  ...,
  cot_step1: string | { fr, en, es },   // legacy ou trilingue
  cot_step2_guitars: [{ name, score, reason: string|{fr,en,es} }],
  cot_step3_amp: string | { fr, en, es },
  guitar_reason: string | { fr, en, es },
  settings_preset: string | { fr, en, es },
  settings_guitar: string | { fr, en, es },
  song_desc: string | { fr, en, es },   // pareil, si fetched post-7.39
  // ref_*, ideal_*, *_name, scores, song_year/album/key/bpm/style : inchangés
}
```

### SONG_HISTORY + INIT_SONG_DB_META trilingues (Phase 7.40)

`src/core/songs.js` : 13 morceaux seed × 2 champs trilingues =
26 traductions ajoutées.
- `INIT_SONG_DB_META[i].desc` : passe de string à `{fr, en, es}`.
- `SONG_HISTORY[id].effects` : pareil. Les autres champs (guitarist,
  guitar, amp) restent string FR car noms propres + annotations FR
  mineures négligeables ("(ébène)", "(modifié)").

`getSongInfo()` retourne `desc` brut (objet ou string), décodage côté
UI via `getLocalizedText(info.desc, locale)`. Sites câblés : HomeScreen,
SongDetailCard, SetlistPdfExport.

### Perf ListScreen (Phase 7.42)

Bug latent pré-Phase A révélé par Sébastien testant une setlist de
120 morceaux : `enrichAIResult` coûte ~150ms/song sur ses customPacks
gonflés → 14s par render bloquant le main thread → timeout navigateur.
Phase A→E n'a pas introduit le bug, juste a poussé à le constater.

3 fixes appliqués :
1. **`mySetlists` memoizé** (main.jsx) : était `setlists.filter(...)`
   nu, ref-changée à chaque render → cascade `mySongIds` → `activeSongs`
   → `songRowData` → `collapsedAiCBySongId` recompute inutile.
   Maintenant `useMemo([setlists, activeProfileId])`.
2. **`collapsedAiCBySongId` progressif** (ListScreen.jsx) :
   passe d'un `useMemo` synchrone à un `useState` + `useEffect` qui
   process en batches de 3 songs via `requestIdleCallback` (fallback
   setTimeout). L'UI affiche immediately les rows (Map vide initiale +
   raw aiCache fallback), puis les badges enrichis arrivent
   progressivement entre frames. Persistance setState : les rows déjà
   enrichies conservent leur aiC ref → React.memo
   SongCollapsedDeviceRows continue de fonctionner. Reset complet de la
   Map au changement de setlist/banks/availableSources.
3. **i18n cache** : `_cachedLocale` + `_tCache` (cf section Architecture
   ci-dessus).

Diagnostic perf gardé derrière `window.__TONEX_PERF = true` (logs
`[perf] collapsedAiCBySongId total: Xms (N enriched)`).

**Dette résiduelle perf** : `enrichAIResult` lui-même reste lent
(itère PRESET_CATALOG_MERGED ~700–1500 entries × scoring math). Optims
futures possibles : cache scoring par (gType, style, refAmp, targetGain)
réutilisable entre songs avec mêmes attributs, ou Web Worker pour
offloader le scoring.

### Comportement utilisateur

- **User FR** : tout en français, comportement identique à Phase 7.35.
  aiCache existants restent en FR (fallback inline).
- **User EN/ES (auto-détecté via navigator.language au premier boot)** :
  UI 100% traduite. aiCache legacy reste affiché en FR jusqu'à
  ré-analyse (Phase D rétro-compatible). Pour bascule des aiCache en
  trilingue : "🔄 Réinitialiser mes analyses" (Mon Profil → 🎯
  Préférences IA, tous profils) ou "🗑 Invalider tous les caches" (admin)
  puis "🤖 Analyser/MAJ N" dans Setlists.
- **Switch de langue** : Mon Profil → 🎨 Affichage → 🇫🇷/🇬🇧/🇪🇸.
  Instantané, persisté en localStorage. Au switch, aiCache trilingues
  bascule sans appel IA supplémentaire (3 langues déjà en cache).

### Commits (8 phases)

```
8231bc2 [phase-7.43] Wrap nav titles + SOUND_PROFILES + page titles inline main.jsx
65e64b9 [phase-7.42] Fix perf ListScreen + locale cache i18n
2862c62 [phase-7.40] Traductions EN + ES complètes (572 clés UI + 26 seed)
65563d9 [phase-7.39] Option D - IA trilingue {fr,en,es} en 1 fetch
d964718 [phase-7.38] Wrapping i18n Phase C - 18 écrans restants
d070444 [phase-7.37] Wrapping i18n top 5 fichiers
897a917 [phase-7.36] Fondations i18n + sélecteur langue FR/EN/ES
```

### Scripts dédiés

`scripts/extract-i18n-keys.cjs` : scan src/ pour extraire toutes les
paires (key, fallback FR) depuis les appels t/tFormat/tPlural.
Produit un JSON groupé par namespace, utilisé Phase 7.40 pour générer
en.js/es.js à partir des fallbacks inline. À relancer après ajout de
nouveau wrapping pour identifier les clés à traduire dans en/es.

### Dette résiduelle Phase 7.43

- **Annotations FR mineures** dans `SONG_HISTORY` : `guitar:"Gibson SG
  Custom (ébène)"` — "(ébène)" reste FR. Pareil pour `(modifié)`,
  `(peinte)`. Si polish 100% propre voulu, ~10 mini-traductions à
  inliner. Pas critique.
- **References à "⚙️ Paramètres"** dans certains messages d'erreur
  (`packs.api-key-missing`, `song-detail.ai-error-hint`) : cet écran a
  été supprimé Phase 7.26, devrait pointer vers "Mon Profil → 🔑 Clé
  API". 2 strings à mettre à jour FR+EN+ES.
- **`fr.js` reste vide** : volontaire (fallbacks inline FR = source de
  vérité). Aucune valeur fonctionnelle à le remplir mais ça donnerait
  un seul point d'édition pour les traductions FR si jamais besoin.
- **`enrichAIResult` lent** : ~150ms/song sur catalog gonflé (cf section
  Perf). Compute progressif Phase 7.42 masque le problème, optim de
  fond optionnelle (Phase 8 ou plus tard).
- **Test CI sur clés manquantes** : à coder. Un script qui détecte les
  clés `t('x.y', '...')` qui n'existent pas dans en.js / es.js
  empêcherait de régresser à l'avenir.
- **Coût IA opérationnel** : prompt trilingue = +30% tokens output par
  fetch (3× texte au lieu de 1×), 1 appel toujours. Acceptable
  (Gemini largement gratuit), à surveiller si beta s'agrandit.

---

## État précédent (2026-05-14, Phase 7.35 close)

**Backline v8.14.35 / SW backline-v135 / STATE_VERSION 7 / 674 tests verts.**
Phase 7.35 permet à TOUS les profils (admin + non-admin) de changer leur
propre mot de passe sans dépendre de l'admin. Avant : seul l'admin pouvait
modifier les passwords via l'onglet "👥 Profils" (ProfilesAdmin), donc un
beta-testeur comme Bruno devait demander à Sébastien pour rotater son
password initial `bruno2026`. Friction inutile pour un test.

### Fix Phase 7.35 (1 changement)

**`src/app/screens/MonProfilScreen.jsx`** : nouveau composant `PasswordTab`
exposé via un onglet "🔐 Mot de passe" visible à TOUS les profils.

Flow utilisateur :
1. Mot de passe actuel (vérifié via `verifyPassword` ou fallback legacy
   plain-text si `isPasswordLegacy`). Champ caché si le profil n'a pas
   encore de password.
2. Nouveau mot de passe (4 caractères min).
3. Confirmation (doit matcher).
4. Submit → `hashPassword` (SHA-256 + salt 128 bits) → stamp profile +
   `lastModified` pour LWW Firestore.

Validation côté client :
- 4 caractères min pour le nouveau password (alerte sinon).
- Confirmation matche obligatoirement.
- Si profil sans password (cas dégénéré), la vérification du current est
  skippée et un message explicatif s'affiche.

L'onglet admin "👥 Profils → Mot de passe" reste actif pour les cas où
un admin veut rotater le password d'un autre profil (ex. reset forcé
après oubli, ou pour un nouveau beta-testeur).

### Conséquences

- Pas de bump STATE_VERSION.
- Pas de migration localStorage.
- Bundle 1783 KB → 1787 KB (+4 KB pour le PasswordTab).
- 674/674 tests verts.
- Bruno peut désormais changer `bruno2026` → un password de son choix
  dès son premier login.

### Architecture livrée à fin Phase 7.35

```
src/main.jsx                       APP_VERSION 8.14.34 → 8.14.35
public/sw.js                       CACHE backline-v134 → backline-v135
src/app/screens/MonProfilScreen.jsx [7.35] +import hashPassword,
                                   verifyPassword, isPasswordLegacy ;
                                   +tabBtn('password') visible à tous ;
                                   +composant PasswordTab (current /
                                   next / confirm + submit hashé).
```

### Dette résiduelle Phase 7.35

- Pas de tests Vitest dédiés sur PasswordTab. Le flow hashPassword est
  déjà couvert par 13 tests `core/crypto-utils.test.js`.
- Si l'utilisateur oublie son nouveau password, le seul recours reste
  l'admin via ProfilesAdmin (qui peut overwrite n'importe quel
  password). Pas de flow "mot de passe oublié" par email puisque l'app
  n'a pas de backend mail.
- L'UI ne montre pas la force du nouveau password (pas de meter). Le
  minimum 4 caractères est très bas — à durcir si beta test public.

---

## État précédent (2026-05-14, Phase 7.34 close)

**Backline v8.14.34 / SW backline-v134 / STATE_VERSION 7 / 674 tests verts.**
Phase 7.34 renforce le prompt Étape 6 de fetchAI avec un garde-fou anti
cross-contamination : une capture nommée d'après un artiste/groupe est
RÉSERVÉE à cet artiste. Le retour Phase 7.32 sur les 6 morceaux de Bruno
avait montré que l'IA poussait "Blink-182 Mesa Boggie" (48B custom Mesa
Triple Rectifier) pour Self Esteem de The Offspring uniquement parce que
les deux morceaux veulent du Mesa Boogie — confusion entre "capture
signature d'un artiste" et "capture générique d'un ampli".

### Fix Phase 7.34 (1 changement)

**`src/app/utils/fetchAI.js`** : prompt Étape 6 réécrit avec règle
impérative en tête et 3 étapes strictement ordonnées :

**Règle impérative — Cross-contamination interdite** : une capture
mentionnant un artiste/groupe/morceau (ex: "Blink-182 Mesa Boggie",
"Kirk & James - Gasoline v2", "Drain You - Punk", "ACDC - Marshall")
est RÉSERVÉE à cet artiste. Interdiction de proposer "Blink-182 Mesa
Boggie" pour un morceau qui n'est pas de Blink-182, même si l'ampli
est cohérent. EXCLUS-la complètement de la considération pour les
autres artistes.

1. **Match artiste/morceau direct** : capture dont le nom contient
   le nom de l'artiste OU un titre de l'artiste analysé.
2. **Pas de match artiste → capture custom/specialty générique** :
   capture dont le nom NE MENTIONNE PAS d'artiste/groupe (ex: "TSR
   Mars 800SL Cn1&2 HG", "5150-CAB57-1073") avec src custom/TSR/ML/
   Anniversary/ToneNET et amp matchant.
3. **En dernier recours** : Factory matchant l'ampli ("HG 800", etc.).

### Conséquences

- Pas de bump STATE_VERSION.
- Pas de migration localStorage.
- Les aiCache existants restent en place mais sous-optimaux pour les
  cas cross-contaminés (Self Esteem → Blink-182 Mesa Boggie). Ré-analyse
  nécessaire via le bouton "🔄 Réinitialiser mes analyses" Phase 7.33.
- Bundle 1782 KB → 1783 KB (+1 KB pour le prompt étendu).
- 674/674 tests verts.

### Cas Bruno après Phase 7.34 (attendu)

| Morceau | Attendu après ré-analyse |
|---|---|
| All the Small Things (Blink-182) | 48B Blink-182 Mesa Boggie ← Étape 1 |
| The Final Countdown (Europe) | 49B Silver Jubilee 2555 HG (custom) OU 10B DR 800 (factory) si IA ne pin pas ← Étape 2 ou 3 |
| Dr. Stein (Helloween) | 49C TSR Mars 800SL Cn1&2 HG ← Étape 2 |
| Fear of the Dark (Iron Maiden) | 49C TSR Mars 800SL Cn1&2 HG ← Étape 2 (capture custom JCM800) |
| For Whom the Bell Tolls (Metallica) | 48A Kirk & James - Gasoline v2 ← Étape 1 |
| Self Esteem (Offspring) | PAS 48B Blink-182 (exclusion stricte). Factory JCM900 ou Mesa générique ← Étape 3 |

### Architecture livrée à fin Phase 7.34

```
src/main.jsx                   APP_VERSION 8.14.33 → 8.14.34
public/sw.js                   CACHE backline-v133 → backline-v134
src/app/utils/fetchAI.js       [7.34] Étape 6 prompt réécrit avec règle
                               anti cross-contamination + 3 étapes
                               strictement ordonnées
```

### Dette résiduelle Phase 7.34

- Le respect strict du prompt dépend de Gemini 3 Flash. Si l'IA continue
  à cross-contaminer malgré la règle impérative, fallback Phase 7.35 :
  pré-filtrer la liste des captures en JS avant de l'envoyer à l'IA
  (omettre les captures nommées d'après un artiste qui n'est PAS celui
  du morceau analysé).
- Non-déterminisme LLM : deux analyses successives du même morceau peuvent
  différer. Solution future : aiCache.locked (Phase ~8) qui permet à
  l'utilisateur de "verrouiller" un choix IA validé.

---

## État précédent (2026-05-14, Phase 7.33 close)

**Backline v8.14.33 / SW backline-v133 / STATE_VERSION 7 / 674 tests verts.**
Phase 7.33 ajoute un bouton d'invalidation cache IA scopé au profil actif,
accessible à TOUS les profils (admin + non-admin). Avant : seul l'admin
pouvait invalider, et le bouton wipeait TOUS les caches (y compris ceux
d'autres profils). Cas Bruno : pour forcer une ré-analyse après un fix
backend, il devait demander à Sébastien de wiper, ce qui invalidait aussi
les 127 caches de Sébastien. Coûteux et bloquant pour le beta test.

### Fix Phase 7.33 (1 changement)

**`src/app/screens/MonProfilScreen.jsx`** : nouveau bloc en tête de
Préférences IA (tab `reco`), visible à TOUS les profils :

```
Réinitialiser mes analyses IA
Invalide les caches IA UNIQUEMENT pour les morceaux de tes setlists
(N morceaux concernés). Pratique pour forcer une ré-analyse après
un changement de banks, de sources ou de mode reco.
[🔄 Réinitialiser mes analyses (N)]
```

Calcul de `mySongIds` au render : `Set` des `songIds` de toutes les
setlists du profil actif (via la prop `setlists` qui est déjà filtrée
par profileIds côté main.jsx, cf Phase 7.29.5). `myCount` = nombre de
ces morceaux avec `aiCache` non null. Bouton désactivé si N=0.

Le bouton admin "Invalider tous les caches IA" reste accessible en
dessous, mais relégué et relabelé "(admin)" pour clarifier qu'il
écrase aussi les caches des autres profils. À utiliser après un
changement structurel (prompt, scoring) qui affecte tout le monde.

### Conséquences

- Pas de bump STATE_VERSION (UI seulement).
- Pas de migration localStorage.
- Bundle 1780 KB → 1782 KB (+2 KB pour le compteur dynamique).
- 674/674 tests verts.
- Bruno peut désormais re-déclencher ses 6 analyses sans solliciter
  l'admin et sans toucher aux 127 caches de Sébastien.

### Architecture livrée à fin Phase 7.33

```
src/main.jsx                       APP_VERSION 8.14.32 → 8.14.33
public/sw.js                       CACHE backline-v132 → backline-v133
src/app/screens/MonProfilScreen.jsx [7.33] bloc "Réinitialiser mes
                                   analyses" en tête tab reco, scoped
                                   sur setlists profil actif. Bouton
                                   "Invalider tous" relabelé (admin)
                                   en wine en dessous.
```

### Dette résiduelle Phase 7.33

- Pas de tests Vitest dédiés sur le compteur dynamique ni sur l'action
  scoped. Le path se teste indirectement via la suite existante
  MonProfilScreen.test (si elle existe) ou par smoke test manuel.
- Si l'utilisateur a plusieurs profils trusted sur le même device et
  switch souvent, le compteur N suit le profil actif (correct).
- Possibilité future : exposer ce bouton aussi en barre d'actions
  Setlists (à côté de "🤖 Analyser/MAJ N") pour un usage encore plus
  immédiat. Non fait Phase 7.33 — d'abord valider le placement Mon
  Profil avant de dupliquer.

---

## État précédent (2026-05-14, Phase 7.32 close)

**Backline v8.14.32 / SW backline-v132 / STATE_VERSION 7 / 674 tests verts.**
Phase 7.32 corrige 3 incohérences d'affichage et de scoring repérées en
inspectant le retour Phase 7.31 sur les 6 morceaux de Bruno (Reddit beta) :
captures custom ignorées au profit de Factory à amp égal, `ideal_guitar`
citée hors du rig du profil actif, et "Recommandation idéale Preset"
qui n'affichait pas le top installé quand il battait le catalog top.

### Fix Phase 7.32 (3 changements)

**Fix A — `src/app/screens/SongDetailCard.jsx`** : `ideal_guitar` filtrée
sur le rig du profil actif. Le partage de l'aiCache via Phase 3.6 (union
all-rigs) faisait que `aiC.ideal_guitar` pouvait nommer "Les Paul Standard
60" pour Bruno (qui n'a que Schecter + Ibanez Gio miKro). Nouvelle dérivation
`displayIdealGuitarName` :
- D'abord essaie `findGuitarByAIName(aiC.ideal_guitar, guitars)` (guitars =
  rig profil actif, pas all-rigs).
- Sinon parcourt `cot_step2_guitars` et prend la PREMIÈRE qui matche
  `findGuitarByAIName(c.name, guitars)`.
- Sinon cache la ligne "Guitare" plutôt que d'afficher une guitare absente
  du rig. `idealGuitarScore` recalculé à partir de la guitare trouvée.

**Fix B — `src/app/screens/SongDetailCard.jsx`** : "Recommandation idéale
Preset" affiche maintenant le MEILLEUR preset accessible (max de preset_ann,
preset_plug, ideal_preset). Avant : on affichait `aiC.ideal_preset` (catalog
top) même quand `preset_ann` installé scorait plus haut. Cas Bruno : Pedal
48B Blink-182 Mesa Boggie 90% + Plug 2B Some Grit 89% + ideal_preset
"Some Grit" 89% → on affichait Some Grit 89% au lieu de Blink-182 Mesa
Boggie 90%. Nouveau `displayTopPreset` = sort par score décroissant des
3 candidats, prend le top. Toutes les références `aiC.ideal_preset` dans
le bloc Section 3 (install button, modal title, doInstall body) basculées
sur `displayPresetName`.

**Fix C — `src/app/utils/fetchAI.js`** : prompt Étape 6 étendu avec
priorité 3 niveaux explicite :
1. Capture mentionnant l'artiste/morceau (comportement Phase 7.31).
2. Capture custom/specialty (src: TSR, ML, custom, ToneNET) dont l'ampli
   matche l'ampli historique — préfère "TSR Mars 800SL Cn1&2 HG" pour Iron
   Maiden à "HG 800" (Factory).
3. En dernier recours : Factory dont l'ampli matche.

Objectif Fix C : que Bruno voie "TSR Mars 800SL Cn1&2 HG" (49C custom)
recommandé pour Fear of the Dark au lieu de "HG 800" (10C factory),
les deux étant des captures JCM800 mais le TSR plus authentique studio.

### Conséquences

- Pas de bump STATE_VERSION (logique d'affichage + prompt seulement).
- Pas de migration localStorage.
- Les aiCache existants restent valides pour Fix A et B (display-side).
  Pour Fix C, ré-analyse nécessaire pour que le nouveau prompt influence
  le choix IA — invalidation manuelle via "🗑 Invalider tous les caches
  IA" ou attente de feedback/fetch naturel.
- Bundle 1779 KB → 1780 KB (+1 KB pour la dérivation displayTopPreset).
- 674/674 tests verts.

### Architecture livrée à fin Phase 7.32

```
src/main.jsx                       APP_VERSION 8.14.31 → 8.14.32
public/sw.js                       CACHE backline-v131 → backline-v132
src/app/screens/SongDetailCard.jsx [7.32] displayIdealGuitarName +
                                   displayTopPreset, refs aiC.ideal_preset
                                   → displayPresetName dans Section 3
src/app/utils/fetchAI.js           [7.32] Étape 6 prompt étendu :
                                   priorité 3-niveaux artist → custom → factory
```

### Dette résiduelle Phase 7.32

- Fix C dépend de l'IA pour respecter le prompt à 3 niveaux. Si l'IA
  continue à privilégier Factory malgré l'instruction, on devra basculer
  vers un `srcBonus` (+5 sur custom/TSR/ML/ToneNET) dans `computeBestPresets`,
  ce qui bumperait SCORING_VERSION → V10. Évité pour rester sur V9.
- `idealGuitarObj` (line 109 ancien) supprimé du flow render mais
  encore référencé par d'anciens commentaires/tests qui ne testent pas
  l'attribut. À nettoyer si découplage Phase 7.33.
- Pas de tests Vitest dédiés Phase 7.32 sur la dérivation
  `displayIdealGuitarName` / `displayTopPreset`. La suite existante
  (SongDetailCard.guitar-select.test.jsx) couvre indirectement le rendu
  via 12 tests.

---

## État précédent (2026-05-14, Phase 7.31 close)

**Backline v8.14.31 / SW backline-v131 / STATE_VERSION 7 / 674 tests verts.**
Phase 7.31 corrige un bug majeur de recommandation découvert pendant
l'onboarding du beta testeur Bruno (Reddit, profil metal/punk avec
captures custom Amalgam + TSR + Galtone + ToneNET dans ses banks 45-49).

### Bug recos captures user (Phase 7.31)

Symptôme observé : Bruno avait `Blink-182 Mesa Boggie` en 48B et
`Kirk & James - Gasoline v2` en 48A (captures Mesa dédiées) mais l'IA
recommandait `ACDC - Marshall` (46A) pour All the Small Things et
`DR 800` factory (10B) pour For Whom the Bell Tolls — captures
inadaptées au son original Mesa Triple Rectifier / Mesa Mark IIC+.

Cause racine (chaîne de 3 problèmes empilés) :

1. **fetchAI.js ne threadait pas les banks user au prompt IA.** L'IA
   ignorait l'existence des 15 captures Bruno. Sans cette info, elle
   proposait un `ideal_preset` "générique" (`Marshall JCM800`, `WT
   Mars Super100 Br 3`) basé sur sa connaissance pré-entraînée — pas
   sur l'inventaire installé.
2. **`PRESET_CATALOG_MERGED` n'intégrait pas `profile.customPacks`
   globalement** (seul site historique : local à `PresetBrowser.jsx`).
   Quand `computeBestPresets` appelait `findCatalogEntry("Blink-182
   Mesa Boggie")`, fallback sur `guessPresetInfo` qui parsait "boogie"
   → metadata fragile `{amp:"Mesa Boogie", gain:"mid", style:"hard_rock",
   scores:{HB:75,SC:75,P90:75}, guessed:true}` au lieu de la vraie
   metadata du customPack (`amp:"Mesa Triple Rectifier"`, `gain:"high"`,
   etc.).
3. **Effet domino sur le scoring V9** (refAmp pèse 30%) : avec un
   `ref_amp` halluciné "Marshall Super100" pour Blink-182,
   `computeRefAmpScore("Marshall", "Marshall Super100")` ≈ 95 vs
   `computeRefAmpScore("Mesa Boogie", "Marshall Super100")` ≈ 25 →
   `ACDC - Marshall` (slot custom de Bruno) gagne contre `Blink-182
   Mesa Boggie` (slot custom de Bruno aussi). Le résolveur a choisi
   le mauvais slot **parmi les slots user**, ce qui le rend visuellement
   crédible et difficile à debug à l'œil nu.

### Fix Phase 7.31 (3 changements)

**Fix A — `src/main.jsx`** : nouveau `useMemo` après `profile = ...`
qui mirrore le pattern ToneNET (line ~423-436) pour
`profile.customPacks`. À chaque mutation de customPacks :
- Drop toutes les entrées `src==="custom"` de `PRESET_CATALOG_MERGED`.
- Re-ajoute chaque preset des customPacks du profil actif avec
  `{src:"custom", amp, gain, style, channel, pack:pack.name, scores}`.
- Conséquence : `findCatalogEntry("Blink-182 Mesa Boggie")` retourne
  immédiatement la vraie metadata du pack au lieu du guess fragile.

**Fix B — `src/app/utils/fetchAI.js`** : nouvelle fonction
`buildInstalledSlotsSection(banksAnn, banksPlug)` qui itère les slots
non-vides, appelle `findCatalogEntry` pour chacun et produit des lignes
`- 48B "Blink-182 Mesa Boggie" — Mesa Triple Rectifier — rock high gain
— src:custom`. Section ajoutée au prompt après le catalogue TMP.
Nouvelle Étape 6 dans les instructions demande à l'IA de retourner
`preset_ann_name` (nom EXACT d'une capture Pedale/Anniversary) et
`preset_plug_name` (nom EXACT d'une capture Plug). Priorité explicite :
nom de capture mentionnant l'artiste/morceau > match ampli historique >
match style+gain.

**Fix C — `src/app/utils/ai-helpers.js`** : nouvelle fonction
`findSlotByName(banks, name)` (case-insensitive). `enrichAIResult`
honore `preset_ann_name` / `preset_plug_name` retournés par l'IA :
si le nom existe dans les banks, on set `preset_ann` / `preset_plug`
sur ce slot avec score `max(90, V9Score)` et un breakdown V9 préservé.
Flags `annPinnedByAI` / `plugPinnedByAI` empêchent le "never-regress"
plus bas (line ~340) d'écraser le choix IA même si V9 aurait scoré
mieux un autre slot (cas Bruno : V9 préfère ACDC-Marshall 95 par
match Marshall hallucineé, mais l'IA voit la liste et nomme
explicitement Blink-182 Mesa Boggie).

### Conséquences

- Pas de bump STATE_VERSION (purement logique côté prompt + scoring).
- Pas de migration localStorage.
- Les aiCache existants restent valides mais sous-optimaux ; ils
  seront naturellement régénérés au prochain feedback ou via
  "🤖 Analyser/MAJ N" / "🗑 Invalider tous les caches IA".
- Bundle taille inchangée à la marge (1779 KB / 484 KB gzip).
- 674/674 tests verts (aucune régression sur les snapshots V9).

### Architecture livrée à fin Phase 7.31

```
src/main.jsx                 [7.31] +useMemo customPacks → PRESET_CATALOG_MERGED
src/app/utils/fetchAI.js     [7.31] +buildInstalledSlotsSection,
                             Étape 6 prompt, preset_ann_name/_plug_name JSON
src/app/utils/ai-helpers.js  [7.31] +findSlotByName, enrichAIResult
                             honore preset_ann_name/preset_plug_name avec
                             flags pinning anti-regress
```

### Dette résiduelle Phase 7.31

- Pas de tests Vitest dédiés Phase 7.31 sur `findSlotByName` et le
  flag pinning (les comportements indirects sont couverts par la
  suite existante). À ajouter si le code touche encore au flow IA.
- Si l'IA retourne un nom approximatif (typo, casse différente),
  `findSlotByName` ne match pas (exact case-insensitive only). Le
  fuzzy matching de `normalizePresetName` n'est pas appliqué ici.
  Acceptable car l'IA a la liste exacte sous les yeux dans le prompt.
- Pour les profils sans customPacks (Sébastien admin avec
  Anniversary device : packs builtin TSR/ML), Fix A n'a aucun effet
  (loop vide). Le bug n'existait que pour les profils à banks
  remplies de captures custom user.

---

## État précédent (2026-05-14, Phase 7.30 close)

**Backline v8.14.30 / SW backline-v130 / STATE_VERSION 7 / 674 tests verts.**
Déployé sur `https://mybackline.app/`. Session du 2026-05-14 = stack de
13 sous-phases 7.29.X + Phase 7.30 (sécurité Firestore).

### Sécurité Firestore (Phase 7.30 — fix fuite GitGuardian)

Le 2026-05-09, GitGuardian a flaggé la Firebase Web API Key
`AIzaSyAnaJMN-a47S9W_cTC60lKAnzRMAgHNMAA` hardcodée dans le bundle
(`src/app/utils/firestore.js:17`). Les rules Firestore étaient
permissives :

```
match /sync/{doc}   { allow read, write: if true; }
match /config/{doc} { allow read: if true; allow write: if false; }
```

→ N'importe qui pouvait pull `/sync/state` (toutes les données users,
incluant passwords hashés) et `/config/apikeys` (clé Gemini partagée
en clair).

**Solution déployée** : Firebase Anonymous Auth (REST API, sans SDK)
+ rules tightening + restrictions Cloud Console.

- **`src/app/utils/firebase-auth.js`** (nouveau) :
  - `ensureAuthToken(apiKey)` : signUp anonyme au 1er appel, cache
    idToken + refreshToken en localStorage (`backline_anon_auth`),
    refresh auto avant expiration (~1h).
  - `authedFetch(apiKey, url, init)` : wrappe fetch en ajoutant
    `Authorization: Bearer <idToken>`.
- **`src/app/utils/firestore.js`** : tous les `fetch(FS_BASE+...)`
  passent par `authedFetch` (5 sites : saveToFirestore,
  loadFromFirestore, pollRemoteSyncId, loadSharedKey, saveSharedKey).
- Mode no-sync (Phase 7.24) respecté en amont → zéro appel auth ni
  Firestore quand activé.

**Manuel côté Firebase / GCP Console (fait par Sébastien)** :

1. Firebase Console → Authentication → Sign-in method → **Anonymous
   activé**
2. Firebase Console → Firestore → Rules :
   ```
   match /sync/{doc}   { allow read, write: if request.auth != null; }
   match /config/{doc} { allow read:  if request.auth != null; allow write: if false; }
   ```
3. Cloud Console (projet `tonex-guide`) → 2 clés Firebase Web key
   restreintes :
   - `AIzaSyAnaJMN-...MAA` (principale, dans le bundle)
   - `AIzaSyBVEbaPUM-...wk` (auto-créée par Firebase à l'activation
     Anonymous Auth)
   - **HTTP referrers** : `https://mybackline.app/*`,
     `https://mybackline.fr/*`,
     `https://ff2t.github.io/tonex-setlist-guide/*`,
     `http://localhost:5173/*`, `http://localhost:4173/*`
   - **API restrictions** : Cloud Firestore API + Identity Toolkit API
     uniquement
4. Cloud Console (projet `claude - ToneX Poweruser`) → clé Gemini
   `AIzaSyCx0oA-...JVk` : mêmes HTTP referrers, API restriction =
   Gemini API uniquement.

**Limite résiduelle connue** : un attaquant qui a la Firebase Web Key
peut techniquement appeler `identitytoolkit.googleapis.com/accounts:signUp`
depuis un autre origin pour obtenir son propre token anonyme → mais
les HTTP referrer restrictions Cloud Console bloquent ce path. Sans
les referrers, l'auth seule serait contournable. Avec les deux
combinés, la fuite est mitigée à ~99%.

Note PWA iOS standalone : selon les versions Safari, l'en-tête
`Referer` peut être absent → si Bruno casse en mode PWA installée,
basculer sur App Check (P5, non implémenté).

### Visibilité songDb filtrée par profil (Phase 7.29.5 + 7.29.11)

Pour préparer le mode partagé avec beta testeurs :

- **`mySongIds`** (main.jsx App()) : `Set | null`. Admin = null (pas de
  filtre), non-admin = Set des `songIds` de ses `mySetlists`.
- Propagé à HomeScreen, SetlistsScreen, ListScreen.
- **`collapsedAiCBySongId`** (ListScreen, Phase 7.29.11) : useMemo qui
  recompute `preset_ann` + `preset_plug` + `ideal_preset` filtrés par
  `availableSources` pour TOUTES les songs visibles avec les banks du
  profil actif. Memoizé sur `[activeSongs, songRowData, banksAnn,
  banksPlug, availableSources]` → un seul recompute par switch de
  profil. Bug Phase 7.29.11 : la vue repliée affichait les
  preset_ann/plug cachés (banks du premier analyseur) → fix par recompute.
- **HomeScreen `visibleSongDb`** : SongSearchBar autocomplete filtré
  → un non-admin tape "Highway to Hell" et ne voit que ses morceaux
  en suggestion. **Mais** au moment de l'add, le code checke le
  songDb COMPLET (lines 363/403/570 HomeScreen) → si Sébastien a
  déjà la song, dédup vers son id existant → aiCache partagé.
- **Trade-off documenté** : `song.feedback[]`, `song.notes`,
  `song.recoMode` restent partagés (un beta qui croise une song de
  Sébastien voit ses feedbacks). À adresser plus tard via
  annotations per-profile si besoin.

### Gating admin-only (Phase 7.29.3 + 7.29.4 + 7.29.7)

- **Optimiser** (Phase 7.29.3) : route `screen==='optimizer'` bloquée
  si `!isAdmin`. `AppHeader.NAV_ITEMS` + `AppNavBottom.ITEMS` marquent
  l'entrée `adminOnly: true`, filtrés via `isAdmin` prop.
- **ToneNET tab** (Phase 7.29.4) : `MonProfilScreen` tab `tonenet`
  bouton + route gated `profile.isAdmin`. Empêche un beta de polluer
  `shared.toneNetPresets`.
- **Custom guitars edit/delete** (Phase 7.29.4) : dans `ProfileTab`,
  les boutons ✏️ et ✕ sur custom guitars + le `GuitarSearchAdd`
  sont gated `isAdmin`. Le toggle pour cocher une custom guitar reste
  ouvert (per-profile `myGuitars`).
- **Toggle ★/☆ Admin** (Phase 7.29.7) : `ProfilesAdmin` reçoit un
  bouton par profil pour toggle `isAdmin`. Garde-fou : empêche de
  retirer admin au dernier admin (alert "Impossible : ce profil est
  le dernier admin").
- **ViewProfile** (Phase 7.27, antérieur) : déjà gated `isAdmin`.

### Confidentialité ProfilePicker (Phase 7.29.6)

Avant : le picker au boot listait TOUS les profils par nom (Sébastien,
Arthur, Franck, Emmanuel, Bruno) → fuite des identités.

Après : grid affiche UNIQUEMENT les profils trusted sur l'appareil
(via `isTrusted(p.id)` cookie localStorage `tonex_trusted_devices`).
Sinon, form "Identifiants" (nom + password) déplié par défaut.
Message d'erreur générique "Identifiants incorrects" → empêche
l'énumération.

- Sur device frais (pas de trusted) : form direct → user tape son
  nom + password, après succès l'appareil devient trusted, son profil
  apparaît dans le grid au prochain reload.
- Sur device existant : grid trusted + lien "Se connecter à un autre
  profil" pour rouvrir le form.

### Visuel custom guitars (Phase 7.29.9 + 7.29.10)

- **`src/assets/default.svg`** : silhouette outline générique pour
  fallback.
- **`src/app/utils/image-resize.js`** : `resizeImageToDataUrl(file,
  maxWidth=240, quality=0.85)` → Canvas resize → data-URL JPEG
  ~30 KB. Évite d'exploser localStorage / 1MB Firestore avec photos
  brutes.
- **ProfileTab edit dialog** (admin-only via Phase 7.29.4) : input
  file `📷 Ajouter/Changer l'image` → preview live + bouton "Retirer".
- **Data model** : `customGuitar.image: string | null` (data-URL).
- **Retrait du thumbnail dans la liste** (Phase 7.29.10) : feedback
  user — l'image reste stockée et uploadable, juste plus affichée
  dans la ligne ProfileTab pour aérer.

### Détection de marque pour custom guitars (Phase 7.29.10)

Bug : "Tele Pro II" (full name "Fender Telecaster American Pro II")
classé dans "Mes guitares" au lieu de "Fender", car la détection
old-school prenait le 1er mot du nom et le matchait contre 13 marques.

Fix :
- **`src/app/utils/infer-brand.js`** : `inferBrand(name)` qui scanne
  toute la chaîne pour un nom de marque, puis fallback heuristique
  modèle→marque (`Telecaster|Strat|Jazz Bass → Fender`,
  `Les Paul|SG|ES-3xx|Flying V → Gibson`, `Pacifica → Yamaha`,
  `White Falcon|Duo Jet → Gretsch`, etc.).
- **Edit dialog ProfileTab** : nouveau dropdown "Marque" pour
  re-classifier manuellement les guitares historiquement parquées
  dans "Mes guitares". `saveEditGuitar` persiste désormais `brand`.

### Badge collapsed amélioré (Phase 7.29.13)

Avant : `[10B] [Marshall JCM800] [85%]` → user comprenait que
"Marshall JCM800" était le nom du preset (alors que c'est l'amp).

Après : `[10B] [DR 800 · JCM800] [85%]` — le PRESET NAME en gras
primaire, l'amp en plus discret après ` · ` (avec prefixes redondants
"Marshall " / "Fender " strippés pour la place).

### AppFooter monté + rebrand PathToTone (Phase 7.29.1 + 7.29.2)

- `AppFooter` était importé dans `main.jsx` depuis Phase 7.29 mais
  JAMAIS rendu en JSX → invisible. Fix : `<AppFooter/>` ajouté entre
  `{screenContent}` et `<AppNavBottom>` → visible sur tous les écrans
  sauf LiveScreen (fullscreen).
- Rebrand cosmétique : "PathToMusic inc." → "PathToTone" (nom
  inventé, plus aligné avec l'univers guitar tone). Texte final :
  `© 2026 PathToTone · Made with 🎸 and ❤️`.

### Documentation beta (Phase 7.29.7 + 7.29.12)

- **`BETA_ONBOARDING.md`** (versionné, template générique) :
  procédure 9 étapes pour créer un beta testeur, préparer son setup,
  créer sa setlist, lui envoyer le lien, observer son usage,
  révoquer. Mentionne les trade-offs (feedbacks partagés, etc.).
- **`BETA_CREDENTIALS.md`** (gitignored via Phase 7.29.12) : fichier
  local pour stocker les vraies infos (nom + password) sans risque
  de push.

### Discipline SW cache (leçon Phase 7.29.8)

Le SW ne bumpait pas son CACHE name entre Phase 7.29.1 → 7.29.7 →
6 deploys mais aucun n'arrivait aux utilisateurs (cache identique
v118). À retenir : **bump `CACHE` dans `public/sw.js` + bump
`APP_VERSION` dans `main.jsx` à chaque deploy main qui touche du
code applicatif**. L'activate handler purge auto les anciens caches
via le filtre `k !== CACHE`.

### Beta testeur live

- **Bruno** créé via ProfilesAdmin par Sébastien. Mode partagé
  Firestore (pas `?beta=1`).
- Setlist personnelle préparée par Sébastien avec ses morceaux
  (Blink 182, etc.). Schecter C-1 Platinum (HB) coché.
- Bruno doit recharger sa PWA jusqu'à voir `v8.14.30` dans le header
  pour pouvoir se connecter (rules tightened → ancien bundle = 403).

### Architecture livrée à fin Phase 7.30

```
src/app/utils/
  ...existing
  firebase-auth.js     [7.30] ensureAuthToken / authedFetch
  image-resize.js      [7.29.9] resizeImageToDataUrl Canvas helper
  infer-brand.js       [7.29.10] inferBrand + BRAND_KEYWORDS
src/assets/
  default.svg          [7.29.9] silhouette outline fallback
src/app/screens/
  ProfilePickerScreen.jsx   [refondu 7.29.6] trusted-only grid +
                            login form
  ProfilesAdmin.jsx         [7.29.7] toggle ★/☆ Admin + dropdown
                            isAdmin + adminCount guard
  ProfileTab.jsx            [7.29.4 + 7.29.9 + 7.29.10] isAdmin
                            gating (GuitarSearchAdd, ✏️, ✕) + image
                            upload + brand dropdown
  ListScreen.jsx            [7.29.11 + 7.29.13] mySongIds filter +
                            collapsedAiCBySongId + badge label/amp
  HomeScreen.jsx            [7.29.5] visibleSongDb pour SongSearchBar
  SetlistsScreen.jsx        [7.29.5] visibleSongDb pour tab Morceaux
  MonProfilScreen.jsx       [7.29.4] tonenet tab gated
BETA_ONBOARDING.md      [7.29.7] template (versionné)
BETA_CREDENTIALS.md     [7.29.12] gitignored
```

### Dette résiduelle Phase 7.30

- Découpage final de `App()` (~945 lignes, dette persistante).
- AI populating `preset_tmp` pour patches custom (depuis Phase 7.10).
- `window.DEFAULT_GEMINI_KEY` legacy bridge à auditer.
- `ReactDOM.render → createRoot` (warning React 18 cosmétique).
- ToneX One + ToneX One+ devices (PDFs dans `tone_models/`, scope
  discuté mais non implémenté — bank model flat 20 slots vs 50×3 à
  travailler).
- App Check (P5, défense ultime) : si PWA iOS Safari standalone
  perd ses Referer headers → fallback Firebase App Check avec
  reCAPTCHA Enterprise. À envisager si breaks PWA.
- `song.feedback[]` / `song.notes` / `song.recoMode` partagés : si
  besoin d'isolation per-profile, refacto vers
  `profile.songAnnotations[songId]`.
- Rotation clé Gemini partagée (`AIzaSyCx0oA...`) : transitait en
  clair pendant les mois où `/config/apikeys` était public.
  Préventif — pas critique tant qu'aucun abus n'est constaté.
- i18n : scaffolding Phase 7.24 jamais cabled. À démarrer si beta
  anglophone.

---

## État actuel (2026-05-13, Phase 7.29 close)

**Backline v8.14.29 / SW backline-v118 / STATE_VERSION 7 / 674 tests verts.**
**main.jsx 1334 → 945 lignes** (Phase 7.23 a passé le cap des 1000 lignes
pour la première fois). Déployé sur `https://mybackline.app/`.

### Migration domaine + signature PathToTone (Phase 7.29)

- URL canonique : `https://mybackline.app/` (Let's Encrypt via GitHub
  Pages, 4 A records sur `@`).
- `mybackline.fr` → 301 vers `.app` (côté OVH, hors code).
- `src/index-redirect-from-old.html` redirige les anciens bookmarks
  `ff2t.github.io/tonex-setlist-guide/ToneX_Setlist_Guide.html` vers
  `https://mybackline.app/` (meta refresh + window.location.replace).
- **`AppFooter`** : "© 2026 PathToTone · Made with 🎸" en bas de
  toutes les pages.
- Clé Gemini Cloud Console : referrer `mybackline.app` ajouté (action
  manuelle Sébastien).

### Sécurité passwords (Phase 7.28)

- `core/crypto-utils.js` : `hashPassword` (SHA-256 + salt 128 bits,
  format `h1:salt:hash`) + `verifyPassword` + `isPasswordLegacy`.
  WebCrypto natif, pas de lib. 13 tests Vitest.
- **Migration auto** : passwords plain text legacy re-hashés
  silencieusement au prochain login successful (callback
  `onUpgradePassword`).
- Avant : `profile.password` en clair dans localStorage + Firestore
  (quiconque lisait le doc Firestore voyait tous les passwords).
- Nouveaux passwords (beta testeurs créés par admin) hashés à la
  création directement.

### Suppression PIN admin global + gating isAdmin (Phase 7.26 + 7.27)

- Suppression de `ADMIN_PIN='212402'` (PIN hardcodé en clair sur le
  GitHub public — mauvaise mesure).
- Suppression de l'écran `⚙️ Paramètres` (redondant avec Mon Profil →
  tabs admin déjà gated par `profile.isAdmin`).
- **`ProfileSelector` dropdown gated** : un profil non-admin ne voit
  QUE son propre profil dans la liste (les autres profils restent
  password-protected mais ne sont plus listés).
- Route `screen==='viewprofile'` bloquée si `!profile.isAdmin` (URL
  hack defense).
- `ProfilePicker` au boot continue d'afficher tous les profils (il
  faut bien pouvoir picker le sien). Chaque profil reste
  password-protected.
- `ListScreen` "Partager :" continue de lister tous les profils
  (légitime — partager une setlist avec un autre user).

### Mode no-sync + URL beta + i18n scaffolding (Phase 7.24 + 7.25)

- Flag localStorage `backline_no_sync` : si actif,
  `saveToFirestore`/`loadFromFirestore`/`pollRemoteSyncId`/`load+saveSharedKey`
  return early (zéro appel HTTP). Helpers `isNoSyncMode()` +
  `setNoSyncMode()` dans `firestore.js`.
- **`MaintenanceTab` section "Mode local"** : toggle + confirmation
  modale + reload (réinitialise les useEffect Firestore).
- **`AppHeader`** : icône sync 🔒 quand no-sync actif (vs ☁️/⏳/⚠️).
- **URL `?beta=1`** : active no-sync AVANT le mount React → aucun
  pull Firestore. Le param est nettoyé de l'URL après activation.
  Usage : beta testeurs Reddit isolés.
- `src/i18n/{index,fr}.js` : infra minimale `t(key, fallback)` + dict
  FR vide. Scaffolding pour quand un beta testeur anglophone arrive.
  Aucun string n'utilise encore `t()`.

### Découpage main.jsx final batch (Phase 7.22 + 7.23)

- **Phase 7.22** : `firestore.js` (saveToFirestore, loadFromFirestore,
  firestoreToJs, fsVal, pollRemoteSyncId, load+saveSharedKey, FS_BASE,
  FS_KEY, getLastSavedSyncId, getLastRemoteSyncId), `AppHeader.jsx`
  (AppHeader + AppNavBottom co-localisés, `appVersion` en prop),
  `applySecrets` déplacé vers `core/state.js`. Dead code supprimé :
  `srcBadge`, `presetSourceInfo`, `styleBadge`, `gainBadge` inline.
  main.jsx 1334 → 1110 lignes.
- **Phase 7.23** : `newzik-migration.js` —
  `prepareNewzikMigration(songDb, setlists, activeProfileId)` retourne
  `{ newSongs, createNames, mergeNames, setlistUpdater }` ou `null` si
  idempotent. main.jsx useEffect réduit à 10 lignes. Les 3 listes
  Newzik (Cours Franck B, Arthur & Seb, Nouvelle setlist) — données
  figées historiques — vivent désormais dans le module. main.jsx
  1110 → 945 lignes (**sous 1000 pour la première fois**).

### Quality-of-life (Phase 7.20 + 7.21)

- **Phase 7.20** : `dedupSongDb(songDb)` helper pur dans
  `core/state.js` (garde premier de chaque id, merge `aiCache` par
  `sv` + cot_step1 + non-null, merge `feedback` union par (text, ts)).
  Bouton "Dédupliquer la base (par id)" dans `MaintenanceTab` admin.
  Distinct du bouton "Fusionner les doublons" (groupe par titre+artiste
  normalisés). Counter en useMemo. 11 tests Vitest. Nettoie la dette
  des doublons par id (collisions `Date.now()` ajouts simultanés +
  anciennes migrations Newzik). Le fix défensif au render (Phase 7.17)
  reste comme filet.
- **Phase 7.21** : Explorer search UX — input `type=search` +
  `enterKeyHint=search` (clavier iOS "Rechercher"), bouton ✕ pour
  effacer rapidement, Enter dismiss le clavier sans valider, caption
  "Résultats filtrés en temps réel".

### Architecture livrée à fin Phase 7.29

```
src/app/utils/
  ...existing (devices-render, song-helpers, preset-helpers,
              ai-helpers, fetchAI, shared-key, ui-constants,
              csv-helpers, infer-preset)
  firestore.js         [7.22] saveToFirestore, loadFromFirestore,
                       fsVal, firestoreToJs, pollRemoteSyncId,
                       load+saveSharedKey, FS_BASE/FS_KEY,
                       isNoSyncMode, setNoSyncMode (Phase 7.24)
  newzik-migration.js  [7.23] prepareNewzikMigration
src/app/components/
  ...existing
  AppHeader.jsx        [7.22] AppHeader + AppNavBottom
  AppFooter.jsx        [7.29] © PathToTone
src/core/
  ...existing
  crypto-utils.js      [7.28] hashPassword/verifyPassword/isPasswordLegacy
src/i18n/              [7.24] scaffolding minimal
  index.js             t(key, fallback)
  fr.js                dict FR vide
src/index-redirect-from-old.html   [5.2 + 7.29] → mybackline.app
```

### Encore dans main.jsx (~945 lignes)

- Imports + init (~80 lignes)
- **`App()` lui-même** (~850 lignes) : useState massif, useEffect
  Firestore/poll/migration, dispatch d'écrans, helpers locaux pour
  setProfileField/recordLogin/onTmpPatchOverride/etc.

### Dette résiduelle Phase 7.29

- Découpage final de `App()` (optionnel, plus risqué — cœur de
  l'état).
- AI populating `preset_tmp` pour patches custom (Phase 7.10 ne
  sérialise que les 20 factory dans le prompt).
- `window.DEFAULT_GEMINI_KEY` legacy bridge à auditer.
- `ReactDOM.render → createRoot` (warning React 18 cosmétique).
- i18n : aucun string n'utilise encore `t()` — à câbler quand un
  beta anglophone matérialise le besoin.

---

## État actuel (2026-05-13, Phase 7.19 close)

**Backline v8.14.19 / SW backline-v108 / STATE_VERSION 7 / 650 tests verts.**
**main.jsx 7671 → 1334 lignes (-6337, -83%)**. Déployé sur main.

Phase 7.18 + 7.19 = poursuite du découpage main.jsx. **18 extractions** sans
régression comportementale, tous tests verts maintenus du début à la fin.

**Phase 7.18** (commits `7abce99` refactor + `cbbd456` deploy) — 3211 → 2542 lignes :

11 extractions vers `src/app/screens/` et `src/app/components/` :
- `csv-helpers.js` : exportJSON, generateCSV, downloadFile, parseCSV.
- `ExportImportScreen` : tab "📋 Export/Import" — JSON/CSV banks.
- `ParametresScreen` : écran ⚙️ Paramètres avec PIN admin. Reçoit
  PacksTab/ProfilesAdmin/MaintenanceTab en `XxxComponent` props pour
  éviter une dépendance circulaire le temps du découpage. Bugfix latent :
  `onDeletedSetlistIds` et `guitarBias` étaient `undefined` car
  ParametresScreen ne les recevait pas en props — maintenant injectés
  depuis App scope.
- `ProfilePickerScreen` : écran de sélection profil au démarrage.
  `APP_VERSION` passé en prop `appVersion`.
- `ProfilesAdmin` : tab "👤 Profils" CRUD utilisateurs.
- `PresetSearchModal`, `FuzzyPresetMatch` (+ `fuzzyMatch` helper),
  `BankEditor` : modals et éditeur des banks ToneX.
- `ProfileSelector` : avatar + dropdown switch profil header.
- `profile-color.js` : `profileColor()` + `PROFILE_COLORS` (palette
  brass/copper/wine déterministe par hash d'id).
- `GuitarSearchAdd` : mini-form recherche IA Gemini + saisie manuelle.

`saveSharedKey` (Firestore) passé via callback `onSaveSharedKey` pour
découpler ParametresScreen de FS_BASE/FS_KEY.

**Phase 7.19** (commits `c34fc4c` refactor + `64b6d80` deploy) — 2542 → 1334 lignes :

7 extractions :
- `MesAppareilsTab` : checkbox par device (boucle `getAllDevices()`
  registry). Garde-fou ≥1 device coché.
- `ToneNetTab` : ajout/édition presets ToneNET avec pré-remplissage IA
  via `inferPresetInfo`.
- `infer-preset.js` (utils) : heuristique amp/gain/style/channel depuis
  un nom de preset libre. Utilisé par ToneNetTab ET le merge
  `PRESET_CATALOG_MERGED` enrichment dans main.jsx.
- `PacksTab` : ingestion packs presets via Vision IA (Gemini ou Claude),
  extraction du catalogue presets + contexte amp.
- `ProfileTab` : guitares (catalogue standard + custom par marque) +
  sources de presets (verrouillage auto selon matériel coché).
- `MonProfilScreen` : wrapper de tous les tabs profil (338 lignes).
  MaintenanceTab reste dans main.jsx mais passé en composant prop
  `MaintenanceTabComponent` le temps de l'extraction.
- `MaintenanceTab` : maintenance admin (recalc IA, fusionner doublons
  songDb, recalculer scoring local, restaurer backups, dédup setlists
  strict/aggressif, reset total).

**Architecture livrée à fin Phase 7.19** :

```
src/app/
  utils/
    devices-render.js       getActiveDevicesForRender
    song-helpers.js         getPA, getPP, getSet, getGr, getIg, getTsr,
                            getTsrRef, getSongHist, normalizeSongTitle,
                            normalizeArtist, findDuplicateSong
    preset-helpers.js       findInBanks, worstSlot, findBestAvailable,
                            getInstallRec, guitarScore, presetScore,
                            COMPAT_STYLES
    ai-helpers.js           AMP_ALIASES, resolveRefAmp, computeBestPresets,
                            enrichAIResult, mergeBestResults, bestScoreOf,
                            preserveHistorical, HISTORICAL_FIELDS,
                            computeRigSnapshot, updateAiCache,
                            getBestResult, safeParseJSON
    fetchAI.js              fetchAI (prompt + retry tryBest)
    shared-key.js           getSharedGeminiKey, setSharedGeminiKey
    ui-constants.js         CC, CL, TYPE_LABELS, TYPE_COLORS
    csv-helpers.js          [7.18] exportJSON, generateCSV, downloadFile,
                            parseCSV
    infer-preset.js         [7.19] inferPresetInfo (amp/gain/style/channel
                            depuis nom de preset libre)
  components/
    GuitarSelect.jsx
    StatusDot.jsx
    PBlock.jsx              + ScoreWithBreakdown co-located
    FeedbackPanel.jsx       + FEEDBACK_TAGS
    AddSongModal.jsx
    BankEditor.jsx          [7.18] éditeur banks ToneX 50/10 + factory reset
    PresetSearchModal.jsx   [7.18] recherche dans PRESET_CATALOG_MERGED
    FuzzyPresetMatch.jsx    [7.18] suggestions approchantes + fuzzyMatch
    ProfileSelector.jsx     [7.18] avatar header + switch profil
    profile-color.js        [7.18] profileColor() + PROFILE_COLORS
    GuitarSearchAdd.jsx     [7.18] form ajout guitare via IA Gemini
  screens/
    RecapScreen.jsx
    HomeScreen.jsx          + SongSearchBar, SplashPopup, OnboardingWizard
    SongDetailCard.jsx
    ListScreen.jsx          + InlineRenameInput
    SetlistsScreen.jsx
    BankOptimizerScreen.jsx
    SynthesisScreen.jsx
    JamScreen.jsx           + getJamRecs
    PresetBrowser.jsx       + PresetDetailInline + PresetList
    LiveScreen.jsx
    ViewProfileScreen.jsx
    ExportImportScreen.jsx  [7.18]
    ParametresScreen.jsx    [7.18]
    ProfilePickerScreen.jsx [7.18]
    ProfilesAdmin.jsx       [7.18]
    MesAppareilsTab.jsx     [7.19]
    ToneNetTab.jsx          [7.19]
    PacksTab.jsx            [7.19]
    ProfileTab.jsx          [7.19]
    MonProfilScreen.jsx     [7.19]
    MaintenanceTab.jsx      [7.19]
src/data/
  tsr-packs.js              TSR_PACK_ZIPS + TSR_PACK_GROUPS
```

**Encore dans main.jsx (~1334 lignes)** :
- AppHeader + AppNavBottom (~50 lignes)
- Helpers Firestore : saveToFirestore, loadFromFirestore, firestoreToJs,
  pollRemoteSyncId, loadSharedKey, saveSharedKey (~150 lignes)
- applySecrets, srcBadge, presetSourceInfo, styleBadge (~30 lignes)
- **`App()` lui-même** (~1000 lignes) : useState massif, useEffect
  Firestore/poll/migration, dispatch d'écrans, helpers locaux pour
  setProfileField/recordLogin/onTmpPatchOverride/etc.
- Imports et init

**Dette résiduelle Phase 7.19** :
- Découpage final de `App()` (optionnel, plus risqué — cœur de l'état).
- Bouton "Dédupliquer songDb" dans MaintenanceTab pour nettoyer la dette
  des doublons par id (`c_1778428303600_jch2`, `c_1778309153614_ined`)
  observée Phase 7.17. Fix défensif au render actuellement, source à
  nettoyer.
- AI populating `preset_tmp` pour patches custom (Phase 7.10 ne sérialise
  que les 20 factory dans le prompt).
- `window.DEFAULT_GEMINI_KEY` legacy bridge à auditer.
- `ReactDOM.render → createRoot` (warning React 18 cosmétique).

## État actuel (2026-05-13, Phase 7.14 close, tag `phase-7.14-done`)

**Backline v8.14.14 / SW backline-v103 / STATE_VERSION 7 / 650 tests verts.**
**main.jsx 7671 → 4723 lignes (-2948, -38.4%)**. Déployé sur main.

Phase 7.14 = découpage main.jsx pure (zéro changement comportement
utilisateur). Tous les screens Phase 8-critiques sont extraits, prêts
à accueillir les modifications bass/drums sans rendre main.jsx
ingérable.

**Architecture livrée** :

```
src/app/
  utils/
    devices-render.js     getActiveDevicesForRender
    song-helpers.js       getPA, getPP, getSet, getGr, getIg, getTsr,
                          getTsrRef, getSongHist, normalizeSongTitle,
                          normalizeArtist, findDuplicateSong
    preset-helpers.js     findInBanks, worstSlot, findBestAvailable,
                          getInstallRec, guitarScore, presetScore,
                          COMPAT_STYLES
    ai-helpers.js         AMP_ALIASES, resolveRefAmp, computeBestPresets,
                          enrichAIResult, mergeBestResults, bestScoreOf,
                          preserveHistorical, HISTORICAL_FIELDS,
                          computeRigSnapshot, updateAiCache,
                          getBestResult, safeParseJSON
    fetchAI.js            fetchAI (prompt + retry tryBest)
    shared-key.js         getSharedGeminiKey, setSharedGeminiKey
    ui-constants.js       CC, CL, TYPE_LABELS, TYPE_COLORS
  components/
    GuitarSelect.jsx
    StatusDot.jsx
    PBlock.jsx            + ScoreWithBreakdown co-located
    FeedbackPanel.jsx     + FEEDBACK_TAGS
    AddSongModal.jsx
  screens/
    RecapScreen.jsx       (step 5)
    HomeScreen.jsx        + SongSearchBar, SplashPopup, OnboardingWizard
                          co-localisés (step 8)
    SongDetailCard.jsx    (step 9, 612 lignes — le plus complexe)
    ListScreen.jsx        + InlineRenameInput co-localisé (step 10,
                          682 lignes — perf-sensitive)
    SetlistsScreen.jsx    wrapper 2-tabs (step 11)
    LiveScreen.jsx        (déjà depuis Phase 4)
src/data/
  tsr-packs.js            TSR_PACK_ZIPS + TSR_PACK_GROUPS
```

**11 commits atomiques** sur refactor-and-tmp, chacun gardant
`npm test` + `npm run build` verts. Smoke-testé local après step 5
(quick wins) puis step 8 (HomeScreen big) puis step 9 (SongDetailCard
gros + complexe) puis step 11 (SetlistsScreen). Déployé sur main avec
bump SW v102 → v103 (purement cosmétique pour distinguer le build).

**Dette résiduelle Phase 7.14** (non-bloquant pour Phase 8) :
- BankOptimizerScreen (694 lignes) — gros, indépendant
- SynthesisScreen (393 lignes)
- MonProfilScreen (404 lignes, avec ses tabs internes ProfileTab,
  PacksTab, ToneNetTab, MesAppareilsTab, MaintenanceTab,
  ProfilesAdmin, ParametresScreen)
- ExportImportScreen (475 lignes)
- PresetBrowser (262 lignes)
- JamScreen (103 lignes) + getJamRecs helper
- ViewProfileScreen (67 lignes)
- À grignoter opportunistically. main.jsx vise <500 lignes (cible
  CLAUDE.md style), 4723 → ~3000 atteignable au prochain coup.

## État actuel (2026-05-13, Phase 7.13.1 close, tag `phase-7.13.1-done`)

**Backline v8.14.13 / SW backline-v102 / STATE_VERSION 7 / 650 tests verts.**

Phase 7.13.1 = création d'un patch TMP from scratch. Bouton **🆕 Nouveau
patch** en haut du tab 🎚️ Patches TMP (à droite du compteur). Click →
ouvre l'éditeur en mode clone avec un patch vide.

- Helper `buildBlankPatch()` (Editor.jsx) retourne un patch minimal
  validatePatch-valide : id `custom_<ts>_<rand>`, name "Nouveau patch",
  factory:false, source:'custom', style:'rock', gain:'mid',
  pickupAffinity 50/50/50, amp + cab par défaut (premier model
  whitelist, params à 5 + defaults mic="Dyn SM57"/axis="on"), aucun
  bloc optionnel.
- Le user complète : édite name/notes/style/gain/pickup, modifie
  amp+cab, ajoute les blocs FX désirés via "+ Ajouter un bloc", édite
  scenes/footswitchMap via ScenesEditor branché. Save → écrit dans
  `profile.tmpPatches.custom`.

7 nouveaux tests (3 buildBlankPatch + 4 Browser bouton "Nouveau patch").
TMP entièrement fonctionnel pour création et édition : clôt aussi la
dette implicite "création from scratch" qui restait après Phase 7.13.

## État actuel (2026-05-13, Phase 7.13 close, tag `phase-7.13-done`)

**Backline v8.14.12 / SW backline-v101 / STATE_VERSION 7 / 643 tests verts.**

Phase 7.13 = TMP editor étendu (complet). Sur la base du MVP Phase 7.12,
l'éditeur supporte maintenant **tous les aspects** du modèle TMPPatch :

- **9 blocs éditables** : amp, cab (déjà MVP) + drive, mod, delay,
  reverb, comp, noise_gate, eq. Boucle sur `RENDER_ORDER`, BlockEditor
  identique partout. Plus de section read-only.
- **Add/remove blocks** : amp et cab non-removable (contrainte du
  modèle). Pour les 7 optionnels, un bouton 🗑️ Supprimer dans le
  BlockEditor + une section "Ajouter un bloc" en bas avec un bouton
  par type absent. `buildDefaultBlock(slot)` initialise avec premier
  model whitelist + `STANDARD_PARAMS` à 5 (defaults sensibles pour
  cab.mic="Dyn SM57"/axis="on", mod.type="sine").
- **ScenesEditor branché** : section "Scenes / Footswitch" en bas du
  modal, rend `<ScenesEditor patch={patch} onScenesChange onFootswitchChange/>`
  (composant Phase 4 réutilisé tel quel). Édite `patch.scenes` et
  `patch.footswitchMap` inline.
- **Cleanup au remove** : supprimer un bloc qui était cible d'un
  footswitch (`type: 'toggle', block: <slot>`) nettoie automatiquement
  l'entry FS correspondante. Les scene.blockToggles qui le ciblaient
  deviennent no-op silencieusement (acceptable Phase 7.13, à nettoyer
  Phase 7.14 si nécessaire).

7 nouveaux tests régression dans `Editor.test.jsx` (643 tests verts au
total). La dette Phase 4 sur l'éditeur custom TMP est désormais
**entièrement clôturée**.

## État actuel (2026-05-13, Phase 7.12 close, tag `phase-7.12-done`)

**Backline v8.14.11 / SW backline-v100 / STATE_VERSION 7 / 636 tests verts.**

Phase 7.12 = TMP custom patches editor (MVP). Modal overlay déclenchée
depuis le browser Phase 7.11 :

- **Clone factory** : bouton 📋 sur chaque card factory → ouvre l'éditeur
  avec un deep clone (`clonePatchAsCustom`). Nouvel id `custom_<ts>_<rand>`,
  name suffixé "(copie)", factory:false, source:'custom'.
- **Édition métadonnées** : name (input), notes (textarea), style
  (dropdown 6 styles), gain (dropdown low/mid/high), pickupAffinity
  (3 inputs HB/SC/P90, 0-100).
- **Édition amp + cab** : model dropdown depuis la whitelist du type +
  toggle enabled + inputs numériques (ou text pour cab.mic/axis) pour
  chaque param présent. Pas d'ajout/suppression de params en v1 (preserve
  la forme du factory cloné).
- **Blocs FX préservés** : drive, mod, delay, reverb, comp, noise_gate,
  eq affichés en read-only ("préservés tels quels au save"). Phase 7.13
  les rendra éditables.
- **Save** : `validatePatch` (chain-model.js) avant write. Errors
  affichées inline. Au save, callback `onUpdateCustoms(nextArray)` →
  `profile.tmpPatches.custom` mis à jour via `onProfiles` (stamp
  lastModified pour LWW Firestore).
- **Delete** : bouton 🗑️ dans le modal (mode edit uniquement) + dans la
  card custom du browser. Confirmation modale.

Composants : `src/devices/tonemaster-pro/Editor.jsx` (TmpPatchEditor +
helpers clonePatchAsCustom, genCustomId, deepClone). 14 tests Vitest
dans `Editor.test.jsx`. Browser.jsx étendu avec 6 tests régression
(clone, save additive, edit replace, delete).

Phase 7.13 (dette résiduelle) : étendre l'éditeur aux 7 autres blocs +
permettre add/remove blocks + brancher le ScenesEditor existant
(Phase 4) pour scenes/footswitchMap.

## État actuel (2026-05-13, Phase 7.11 close, tag `phase-7.11-done`)

**Backline v8.14.10 / SW backline-v99 / STATE_VERSION 7 / 616 tests verts.**

Phase 7.11 = TMP browser dans Mon Profil. Nouveau tab **"🎚️ Patches
TMP"** visible si `tonemaster-pro ∈ profile.enabledDevices`. Liste
read-only des 20 factory groupés par source (Arthur 3 / seed 4 /
family 13) + customs `profile.tmpPatches.custom`. Chaque carte montre
le name + chain summary + badges style/gain + usages courts. Drawer
expandable affichant la chaîne complète bloc par bloc (réutilise
`pickTopParams` + `formatBlockParam` de RecommendBlock).

Badge **⚙️ personnalisé** sur les patches factory qui ont un override
profil (`factoryOverrides[patchId]`). Un seul drawer ouvert à la fois.

Composant `src/devices/tonemaster-pro/Browser.jsx` (TmpBrowser +
PatchCard). 9 tests Vitest dans `Browser.test.jsx`. L'éditeur (créer
des customs from scratch, modifier un factory complet) reste dette
Phase 4 séparée.

## État actuel (2026-05-13, Phase 7.10 close, tag `phase-7.10-done`)

**Backline v8.14.9 / SW backline-v98 / STATE_VERSION 7 / 607 tests verts.**

Phase 7.10 = AI populating `preset_tmp` field. Le prompt `fetchAI` reçoit
désormais le catalogue complet des 20 patches TMP factory (nom, ampli,
style/gain, usages — artistes ciblés), et une **ÉTAPE 5** demande à l'IA
de retourner `preset_tmp: "nom exact du patch"` ou `null` dans le JSON
output. Aucun bump SCORING_VERSION (le scoring V9 local est inchangé) ;
les aiCache existants n'ont pas `preset_tmp` mais le récupèreront au
prochain fetchAI naturel.

Helper `resolveTmpPatchByName(name, patches=TMP_FACTORY_PATCHES)` dans
`devices/tonemaster-pro/catalog.js` : case-insensitive, normalise les
espaces. 7 tests Vitest.

`RecommendBlock` TMP : si `song.aiCache.result.preset_tmp` résolvable →
utilisé comme top avec score conventionnel 92 (high confidence). Sinon
fallback `recommendTMPPatch` scoring local. 3 tests régression. Les
overrides Phase 4 (`profile.tmpPatches.factoryOverrides[id]`) continuent
de s'appliquer au patch retenu, peu importe la source (AI ou scoring).

Phase 7.9 = override manuel `profile.guitarBias` par style. UI éditable
dans Mon Profil → 🎯 Préférences IA : table de 6 styles (blues, rock,
hard_rock, jazz, metal, pop), badge effective value (🎯 manuel · 📊 auto
N feedbacks · aucune), dropdown override "Pas d'override | each guitar
du rig". Bouton "Réinitialiser N overrides manuels" si applicable.

Helper pur `mergeGuitarBias(auto, manual, guitars)` dans `core/state.js` :
manuel > auto, drop entries stales (guitarId inexistant). 9 tests Vitest.

`effectiveGuitarBias = useMemo(mergeGuitarBias(derivedGuitarBias,
profile.guitarBias, allRigsGuitars))` au niveau App. Propagé partout en
prop `guitarBias` (remplace `derivedGuitarBias` de Phase 7.7). Le prompt
`fetchAI` reçoit donc la fusion : un override manuel `blues → SG 61`
écrase le auto-dérivé `blues → ES-335` injecté dans la section
"PRÉFÉRENCES UTILISATEUR".

Phase 7.8 = lot "petits chantiers" (3 fixes deploy, pas une nouvelle
feature) :

- **SW externalisé** dans `public/sw.js` (au lieu d'une registration via
  blob URL). Vite copy verbatim → `dist/sw.js`. `main.jsx` registrer
  `./sw.js`. Restaure l'offline + stale-while-revalidate qui était
  silencieusement cassé depuis le rebrand Phase 5.2 : le blob URL a un
  origin distinct du document → le SW ne contrôlait jamais les fetchs
  de la page. **Workflow déploiement augmenté** : copier `dist/sw.js`
  → `main:/sw.js` en plus de `dist/index.html` à chaque release.
- **Favicon SVG inline** (`link rel=icon` réutilisant la silhouette
  Backline) → plus de 404 sur `/favicon.ico`.
- **`meta mobile-web-app-capable=yes`** couplé à l'Apple deprecated
  (deprecation warning iOS disparaît).
- `vite.config.js` : `publicDir: false` → `publicDir: '../public'`.

Marathon de 22 sous-phases ajoutées le 12 mai 2026 :

### Phase 5.7.3 (fix critiques sync, tag `phase-5.7.3-done`)

- **`updateProfile` ne stampait pas `lastModified`** : symptôme = toggle
  guitare sur iPhone disparaissait après poll Firestore. LWW tiebreak
  ne tranchait jamais en faveur d'iPhone (timestamps égaux → keep
  local). 2 occurrences l. 1585+1776 patchées : ajout
  `lastModified: Date.now()`.
- **`dedupSetlists` ne tombstonait pas les losers** : Phase 5.4 nettoyait
  les setlists doublons en local mais ne propage pas la suppression
  via Firestore → autres devices ressuscitaient les setlists par
  leurs IDs originaux. Nouvelle variante `dedupSetlistsWithTombstones`
  qui retourne `{ setlists, tombstones }`. MaintenanceTab utilise
  cette variante et propage les tombstones via `onDeletedSetlistIds`.
- 8 tests ajoutés.

### Phase 5.8 + 5.8.1 (UI partage setlists, tags `phase-5.8-done` + `phase-5.8.1-done`)

- Helper pur `toggleSetlistProfile(setlist, profileId, activeProfileId)`
  dans `core/state.js` avec garde-fou anti-auto-retrait (le profil
  actif ne peut PAS se retirer de la setlist).
- UI "Partager :" sous chaque setlist en mode édition. Pills cliquables
  par profil. Profil actif marqué 🔒 (verrouillé). Autres profils
  cliquables → toggle inclusion/exclusion.
- Phase 5.8.1 : fix propagation prop `profiles` au call site
  `<SetlistsScreen>` (oubli initial). Sans ça l'UI était invisible.
- 8 tests ajoutés.

### Phase 5.10 + 5.10.1 + 5.10.2 (Auto-fetchAI, tag `phase-5.10.2-done`)

- **Phase 5.10** : `useEffect` SongDetailCard n'exige plus `gId` pour
  déclencher fetchAI. L'IA tourne sans guitare présélectionnée. À
  son retour, si `gId` était vide et l'IA propose `ideal_guitar`,
  on auto-adopte cette guitare via `onGuitarChange`. Les morceaux
  Newzik (sans `ig`) ne demandent plus à l'utilisateur de choisir
  manuellement.
- **Phase 5.10.1** : Bouton **"⏳ Analyser N"** dans la barre d'actions
  Setlists. Visible si `missingCount > 0`. Click → batch fetchAI
  séquentiel avec progress `⏸ X/N` et annulation. Permet de pré-remplir
  l'aiCache pour toute une setlist en une fois.
- **Phase 5.10.2** : `aiCache.rigSnapshot` enregistre les ids des
  guitares du rig au moment de l'analyse. Le `missingCount` inclut
  désormais les morceaux dont le rig actuel diffère du snapshot.
  Helper `computeRigSnapshot(guitars)` dans main.jsx, ajouté à
  `updateAiCache(prev, gId, result, opts)` 4e param. Caches legacy
  sans rigSnapshot considérés OK (pas re-fetch forcé). Label bouton
  passe de "⏳ Analyser" à "🤖 Analyser/MAJ".

### Phase 5.11 (bouton Partager Clé Mon Profil, tag `phase-5.11-done`)

- Bouton **"🔑 Partager la clé (tous les profils)"** déplacé/copié de
  ⚙️ Paramètres (PIN-protégé) vers **Mon Profil → onglet 🔑 Clé API**
  (admin-only). Push la clé Gemini locale vers Firestore
  `config/apikeys.gemini` → tous les profils héritent au boot via
  `loadSharedKey()`. Indispensable pour que Arthur/Franck/Emmanuel
  puissent utiliser l'IA sans avoir leur propre clé.

### Phase 5.12 (refonte UX Sources, tag `phase-5.12-done`)

- Labels révisés dans `core/sources.js` pour éliminer la confusion
  entre device (matériel) et source (collection de presets) :
  - `Factory` → "Pédale classique — Captures pré-installées"
  - `Anniversary` → "Anniversary — Captures pré-installées"
  - `PlugFactory` → "Plug — Captures pré-installées"
  - `TSR` → "TSR — 64 Studio Rats Packs"
  - `ML` → "ML — ML Sound Lab Essentials"
  - `ToneNET` → "ToneNET — Presets téléchargés"
  - `custom` → "Mes presets personnels"
- Nouvelle table `SOURCE_DESCRIPTIONS` exposée en UI sous chaque
  toggle. Exemple : "Si tu possèdes une ToneX Pédale classique
  (la non-Anniversary)".
- UI : icône + label + description + badge "verrouillé (matériel
  coché)" remplace "auto".

### Phase 5.13 → 5.13.14 (Perf Setlists/Optimiser, tag `phase-5.13-final`)

Énorme refonte performance après mesure 6400ms sur ListScreen 28
morceaux. 14 sous-phases pour atteindre <50ms.

- **5.13** : `content-visibility: auto` sur chaque row de morceau.
  `React.memo` sur `SongCollapsedDeviceRows` (comparaison custom :
  song.id, guitar.id, aiC, banksAnn, banksPlug, enabledDevices,
  precomputedTopRecBySongId).
- **5.13.1** : Lazy batch rendering ListScreen. `visibleCount` débute
  à 12, incrémente par 18 toutes les 60ms via `requestIdleCallback`.
  Reset à 12 quand `activeSlId` ou `sort` change.
- **5.13.2** → **5.13.3** : Defer `<SongCollapsedDeviceRows>` 80ms
  après mount via `showDeviceRows` state. Defer aussi history line +
  badge guitare + score.
- **5.13.4** → **5.13.6** : Diagnostic profiling intermédiaire pour
  identifier le bottleneck (3811ms persistant). Outils : `__perfMark`
  helper, log par useMemo, mark `before-return`.
- **5.13.7** : **TROUVÉ** — `improveBadgeCount` useMemo synchrone
  qui appelait `enrichAIResult` (~500 ops par morceau qui a
  `aiCache.gId !== gId` courant) → ~14k ops par mount = 3.7s. Fix :
  defer via `useState + useEffect setTimeout(200ms)`. Le badge
  apparaît 200ms après le mount. **3811ms → 16ms (×320)**.
- **5.13.8** : Cleanup debug instrumentation + ajout perf
  instrumentation à `BankOptimizerScreen` et `HomeScreen`.
- **5.13.9** : Defer `analyzeDevice` × 2 (catalog complet × songs =
  5240ms synchrones) via useState + useEffect setTimeout(0).
- **5.13.10** : Defer `standardBanks` (15k ops) similaire.
- **5.13.11** : Mark `before-return` BankOptimizerScreen révèle que
  le coût n'est pas dans le mount (1ms) mais dans les re-renders
  post-setAnnAnalysis (1162ms).
- **5.13.12** : `content-visibility: auto` sur `sectionStyle` du
  BankOptimizerScreen pour skip le rendering des sections offscreen.
- **5.13.13** : **CRITIQUE** — boucle infinie analyzeDevice détectée
  (cascade 51s). Cause : `songs` recalculé à chaque render comme
  nouveau tableau → useEffect re-trigger en boucle. Fix : `useMemo`
  sur `songs` avec deps `[sl, songDb]`.
- **5.13.14** : Même problème pour `pickupTypes` (deps du useEffect
  `standardBanks`). Fix : `useMemo` sur `pickupTypes` avec deps
  `[allGuitars]`.

**Résultat final** : ListScreen 6400ms → 16ms (×400). HomeScreen
2.4ms. BankOptimizerScreen 1ms mount + analyses background non-bloquantes.

### Phase 6 + 6.1 + 6.1.1 + 6.1.2 + 6.1.3 + 6.2 (Partage aiCache via Firestore, tag `phase-6.2-done`)

- **Phase 6** : `saveToFirestore` push opportuniste de l'aiCache. Si
  payload total < 800 KB → push avec aiCache. Sinon strip (Phase 5.7.1).
  Le merge `mergeSongDbPreservingLocalAiCache` adopte le remote
  aiCache si plus récent ou si local n'en a pas.
- **Phase 6.1** : **Compression lz-string** pour faire passer les
  states >800 KB sous la limite. Nouveau champ Firestore
  `dataCompressed`. Au pull, priorité au champ compressé (décompression
  via `LZString.decompressFromBase64`). Fallback `data` legacy.
  Sébastien : 1302 KB raw → 434 KB compressed (ratio 3×).
- **Phase 6.1.1** : **BOUCLE INFINIE détectée** entre Mac + iPhone +
  iPad (chacun push après chaque pull). Cause : `shared.lastModified
  = Date.now()` à chaque persist effect → state change → push. Fix :
  hash léger du contenu (sans timestamps) + skip push si pas de
  vraie modif.
- **Phase 6.1.2** : Hash refait sans `lastModified` ni autres champs
  qui mutent à chaque mergeLWW. Hash basé sur (myGuitars sorted,
  songIds sorted, profileIds sorted, aiProvider, etc.).
- **Phase 6.1.3** : Boucle subtile résiduelle — pull adopte les
  aiCaches manquants → syncHash change → push → autre device pull →
  écho. Fix : `justPulledRef` set 3s après `applyRemoteData`, le
  persist effect skip push pendant cette fenêtre.
- **Phase 6.2** : iPhone affichait 0 aiCache même après pull car
  `tonex_guide_backups` pesait 1706 KB → quota Safari iOS (~2 MB)
  saturé → `setItem(1319 KB)` échouait silencieusement. Fix :
  `MAX_BACKUPS` 5 → 2.

**Résultat** : Sync multi-device avec aiCache compressé fonctionne.
Mac (127 aiCaches) → Firestore (439 KB compressed) → iPhone hérite
des 127 aiCaches. Plus de ⏳ sur les devices secondaires.

### Phase 7.1 → 7.5 (Feedback global + Mode reco, tag `phase-7.5-done`)

- **Phase 7.1** : `profile.recoMode` ∈ {`balanced`, `faithful`,
  `interpretation`} avec défaut `balanced`. UI : nouvel onglet
  **Mon Profil → 🎯 Préférences IA** avec 3 cards radio.
  `profile.guitarBias = {}` réservé pour Phase 7.6+ (non utilisé).
- **Phase 7.2** : `fetchAI` prend un 10e param `recoMode`. Prompt
  enrichi selon le mode :
  - `faithful` : "Privilégie EXACTEMENT la guitare originale de
    l'artiste, même si une autre scorerait mieux par compatibilité
    tonale pure."
  - `interpretation` : "Privilégie les guitares VERSATILES (ES-335,
    SG, Strat) qui couvrent bien le style, même si ce n'est pas
    l'instrument original."
  - `balanced` : prompt inchangé.
- **Phase 7.3** : Override par morceau via `song.recoMode`. 4 boutons
  compacts dans SongDetailCard : `↻ Profil` (hérite), `⚖️ Équilibré`,
  `🎯 Fidèle`, `🎨 Interprétation`. Changer le mode invalide le cache
  IA du morceau → re-fetch automatique avec le nouveau mode.
  `effectiveRecoMode = song.recoMode || profile.recoMode || balanced`.
- **Phase 7.4** : Bouton **"🗑 Invalider tous les caches IA"** dans
  Mon Profil → 🎯 Préférences IA (admin). Confirmation + count.
  Click → vide tous les `aiCache`. Sébastien peut ensuite utiliser
  "⏳ Analyser/MAJ N" dans Setlists pour batch re-analyse avec le
  nouveau mode.
- **Phase 7.5** : Bouton **"💬 Donner un feedback à l'IA"** dans la
  fiche dépliée d'un morceau (FeedbackPanel existant mais mal exposé).
  Historique des feedbacks précédents affiché au-dessus (3 derniers,
  avec date). Submit → relance fetchAI avec `feedback + recoMode` →
  nouvelle reco. Feedback persisté dans `song.feedback[]`
  (synchronisé via Firestore).
- **Phase 7.6 + 7.6.1** : Suppression individuelle des feedbacks (✕ par
  ligne) + bouton "Tout effacer" si >3. Concat de l'historique
  `song.feedback[]` en string envoyée à chaque `fetchAI` (relance auto
  via invalidation cache, ou clic mode reco) → l'IA prend en compte
  l'historique complet sans re-saisie. Suppression → `aiCache: null`
  pour re-déclencher l'analyse sans le feedback retiré.
- **Phase 7.7** : Bias auto-dérivé `style → guitare` depuis
  `song.feedback[]`. Helper pur `computeGuitarBiasFromFeedback(songDb,
  guitars, threshold=3)` dans `core/state.js` : scanne les morceaux
  avec `feedback[].length > 0` + `aiCache.result.song_style` +
  `ideal_guitar`, tally (style → guitarId), retient `{guitarId,
  guitarName, count}` quand ≥3 occurrences. Tiebreak alpha sur
  guitarId. `derivedGuitarBias = useMemo(...)` au niveau App,
  recompute à chaque mutation `songDb`. Injecté dans `fetchAI` (11e
  param `guitarBias`) → section `PRÉFÉRENCES UTILISATEUR (déduites
  de l'historique de feedback)` ajoutée au prompt en soft hint
  ("tiens-en compte sans forcer"). UI read-only dans Mon Profil →
  🎯 Préférences IA. **Pas de modif du scoring V9 local** : le bias
  ne s'applique qu'au prompt IA. Source de vérité = `song.feedback[]`
  (déjà sync Firestore), `profile.guitarBias` toujours non utilisé.
  10 tests Vitest sur le helper.

### Schéma localStorage v7 (inchangé depuis Phase 5.7) avec ajouts Phase 7

```
profile {
  ...,
  recoMode?: 'balanced' | 'faithful' | 'interpretation',  // Phase 7.1
  guitarBias?: { [styleId]: guitarId },                   // Phase 7.1 réservé,
                                                          //   toujours non utilisé
                                                          //   Phase 7.7 (le bias
                                                          //   effectif est calculé
                                                          //   à la volée depuis
                                                          //   song.feedback[]).
}

shared.songDb[i] {
  ...,
  recoMode?: string,           // Phase 7.3 override par morceau
  feedback?: [{ text, ts }],   // Phase 7.5 historique
}

shared.songDb[i].aiCache {
  ...,                          // gId, result, sv, bestByGuitar
  rigSnapshot?: string,         // Phase 5.10.2 — "g1|g2|g3..." sorted
}
```

### Dette résiduelle Phase 7

- **V10 scoring** (optionnel, à éviter) : appliquer le bias au scoring
  local V9 (pas seulement au prompt IA). Implique un bump V10 +
  régénération des snapshots + invalidation de tous les aiCache (sv
  mismatch). À éviter sauf demande explicite, V9 est verrouillée.
- Le feedback influence désormais les autres morceaux via le bias
  global Phase 7.7+7.9 dès que le seuil (3 occurrences) est atteint
  sur un (style, guitare) OU que l'utilisateur a posé un override
  manuel. En deçà, l'effet reste local au morceau feedbacké.

### Dette générale ouverte

- **Découpage main.jsx** (~7700 lignes) : dette Phase 1 persistante.
- **Phase 8** — Basse + batterie + sections instrumentales : gros chantier non démarré. Modèle de données étendu (`device.instrument: 'guitar'|'bass'|'drums'`), Roland TD-17 comme device drums, Fender Jazz Bass Player Plus comme device bass, sections par instrument dans `song.recommendations.{guitar,bass,drums}`, LiveScreen multi-instrument.
- **AI preset_tmp pour patches custom** : Phase 7.10 ne sérialise que
  TMP_FACTORY_PATCHES dans le prompt. L'IA ne peut pas suggérer un
  patch custom de l'utilisateur. À étendre Phase 7.14+.

Items clôturés Phase 7.8 (`SW non enregistré`, `Deprecation warning
apple-mobile-web-app-capable`, `Favicon 404`), Phase 7.10 (`AI
populating preset_tmp field`), Phase 7.11 (`TMP browser dans
MonProfilScreen`), Phase 7.12 (`TMP custom patches editor MVP`) et
Phase 7.13 (`TMP editor étendu — 9 blocs + add/remove + scenes`).

## État Phase 5.7.2 (gate migration Newzik, 2026-05-11, tag `phase-5.7.2-done`)

1 commit `[phase-5.7.2]`. Suite 547 → 562 tests (+15). SW CACHE
`backline-v57` → `backline-v58`. **Pas de changement de
STATE_VERSION** (7 inchangé).

**Bug rapporté** : iPhone après suppression des données de site
montrait 10 setlists avec doublons ("Cours Franck B" ×2, "Arthur
& Seb" ×2, etc.) au lieu de l'état Mac propre (qui est source de
vérité). Console iPhone : `[migration] Imported 104 new songs.
Created: Cours Franck B, Arthur & Seb. Merged into Ma Setlist:
Nouvelle setlist`.

**Cause** : la `useEffect` "One-time migration: import Newzik
setlists" dans main.jsx (l. 6495 avant 5.7.2) s'exécutait avec dep
array `[]` (au mount immédiat). Or `loadFromFirestore()` est async.
Donc sur l'iPhone fraîchement nettoyé :
1. Mount → state local vide
2. `loadFromFirestore()` part en async (5-10s sur 5G)
3. Migration effect s'exécute **immédiatement** → crée "Cours
   Franck B" / "Arthur & Seb" / merge "Nouvelle setlist" → "Ma
   Setlist", tous avec `profileIds=[activeProfileId]=['sebastien']`
4. Firestore répond → applyRemoteData merge LWW avec les vraies
   setlists Mac (profileIds=['sebastien','franck'] ou
   ['arthur','sebastien'])
5. Résultat : doublons par profileIds divergents

Le guard original via `existingSetlistFor()` cherchait `name +
sameProfileIds([activeProfileId])`. Une setlist Firestore "Cours
Franck B" avec profileIds=['sebastien','franck'] ne matchait pas,
la migration recréait.

### Solution (3 changements)

1. **Gate `useEffect` derrière `firestoreLoaded`** :
   `if(!firestoreLoaded) return;` + dep array `[firestoreLoaded]`.
   La migration attend que `loadFromFirestore()` ait posé son
   `setFirestoreLoaded(true)` avant de s'exécuter.

2. **Skip si setlist du même nom existe DÉJÀ (peu importe les
   profileIds)** : helpers purs `computeNewzikCreateNames` et
   `computeNewzikMergeNames` extraits dans `core/state.js`.
   createNames : `if(existsByName(n)) return false;` — un seul
   check par name. mergeNames : skip si source absente ou
   `__merged` marker présent.

3. **Helpers purs testables** : extraction dans `core/state.js`
   permet tests régression Vitest (15 nouveaux tests). main.jsx
   remplace les 20 lignes inline par 2 appels.

### Tests (15 nouveaux dans `state.test.js`)

- `computeNewzikCreateNames` (8) dont scénario bug : setlist avec
  profileIds différents → skip (le fix Phase 5.7.2).
- `computeNewzikMergeNames` (5) : présence source, marker
  `__merged`, falsy inputs, multi-merge.
- Scénario bug iPhone (2) : post-Firestore no-op + fresh install
  crée tout.

### Test manuel post-déploiement

1. **iPhone** : Safari → Préférences → Avancé → Données de site →
   Supprimer "ff2t.github.io". Recharger l'app.
2. Attendre 5-10s pour Firestore initial load.
3. Vérifier : 3 setlists alignées avec Mac (pas de doublon).
   Console doit afficher `[migration] Newzik migration skipped —
   setlists already present (Firestore sync or manual creation).`
4. Sync icon ☁️ vert dans le header.

### Dette résiduelle

- mergeNames path actuel jamais déclenché en pratique (Sébastien
  a déjà mergé "Nouvelle setlist" historiquement). Le code reste
  pour le cas dégénéré "fresh install sans Firestore" (nouveau
  device, compte Google différent, pas d'accès au tonex-guide
  Firestore).

## État Phase 5.7.1 (strip aiCache du push Firestore, 2026-05-11, tag `phase-5.7.1-done`)

1 commit `[phase-5.7.1]`. Suite 535 → 547 tests (+12). SW CACHE
`backline-v56` → `backline-v57`. **Pas de changement de
STATE_VERSION** (7 inchangé) — c'est une refacto de sérialisation,
pas de schéma.

**Problème confirmé** : état local 1037 KB (>1024 KB limite Firestore
par document), songDb 1000 KB dont aiCache 986 KB (95% du state).
Push Firestore renvoyait `400 Bad Request` systématique, `syncStatus`
passait à `"error"` (icône ⚠️ dans le header), et les modifs
iPhone/iPad ne remontaient plus au Mac et vice-versa.

**Cause** : `saveToFirestore` (main.jsx:172) sérialisait
`state.shared.songDb` avec `aiCache` complet pour chaque song
(`cot_step2_guitars` × N guitares + `cot_step1` + `preset_ann/plug`,
~7-8 KB/song en moyenne).

### Solution — strip à la sérialisation, preserve au pull

- **`stripAiCacheForSync(state)`** (state.js, pur) : retourne une
  copie de `state` où chaque song dans `shared.songDb` a son
  `aiCache` retiré. `localStorage` local reste intact. Appelé en
  premier par `saveToFirestore`.
- **`mergeSongDbPreservingLocalAiCache(local, remote)`** (state.js,
  pur — remplace l'inline `mergeSongDb` de main.jsx, désormais
  alias) :
  - Common song : si `remote.aiCache.sv > local.aiCache.sv` →
    adopt remote complet (cohabitation : un client v7 pré-5.7.1
    pousse encore aiCache et son sv peut être plus récent). Sinon
    → adopt `remote.*` mais réinjecte `local.aiCache`.
  - Remote-only → adopté sans aiCache (sera recalculé au prochain
    fetchAI).
  - Local-only → préservé avec aiCache.
  - Dedup by title+artist normalisé : même policy (max aiCache.sv).

### Robustesse `saveToFirestore` (Phase 5.7.1)

- Sanity check de taille avant envoi :
  - ≥ 1 000 000 octets → `console.error` + `Promise.reject` (refus
    de push pour éviter un 400 prévisible).
  - ≥ 800 KB → `console.warn` (proche limite).
- HTTP fail → `console.error` détaillé (status + taille payload).
- `.catch` final qui re-throw pour que le `setSyncStatus("error")`
  côté caller s'allume.

### Push initial inconditionnel (one-shot post-load)

L'effect `loadFromFirestore` (initial load) déclenchait
auparavant un push UNIQUEMENT si `mergedSongs.length > remoteSongs.length`
ou similaire. Phase 5.7.1 rend ce push inconditionnel : même si le
state local matche exactement remote, on push la version light
pour overwrite le payload Firestore stale (qui contient encore les
aiCache de la dernière fois où le push a fonctionné). Sans ça, un
state local idempotent ne se déclenchait pas de persist effect et
Firestore restait coincé à >1 MB.

### Tests (12 nouveaux dans `state.test.js`)

- `stripAiCacheForSync` (5) : strip, immutabilité, songDb absent,
  song sans aiCache, réduction taille ≥10× sur 100 songs simulés.
- `mergeSongDbPreservingLocalAiCache` (7) :
  - **Scénario principal** : remote stripped avec titre updated +
    local aiCache → out a remote.title ET local.aiCache.
  - Remote-only sans aiCache → adopté tel quel.
  - Local-only avec aiCache → preserved.
  - Cohabitation : remote aiCache.sv > local → adopt remote.
  - Remote aiCache.sv < local → local préservé.
  - Dedup by title+artist : aiCache preserved au survivant + remap id.
  - Inputs falsy → retourne l'autre.

### Test manuel post-déploiement

1. Au reload : icône sync passe en ☁️ vert dans les 5s.
2. Ajouter un morceau sur Mac → reload iPhone après 10s → morceau
   apparaît.
3. Aucune perte de aiCache local sur Mac après le merge
   (les morceaux gardent leurs scores et IA cachée).
4. Vérifier `JSON.stringify(state)` en console : `aiCache` toujours
   présent côté local (preservé pour `localStorage`).

### Pourquoi pas de migration de schéma

Le state local localStorage continue de stocker les aiCache comme
avant. C'est uniquement la sérialisation pour Firestore qui les
exclut. Donc :
- Pas de bump `STATE_VERSION` (reste à 7).
- Pas de migration `migrateV7toV8`.
- Pas de toast utilisateur.
- Le push initial inconditionnel se charge de refresh Firestore.

### Dette résiduelle

- Si un client pré-5.7.1 reste actif dans la nature, il continuera
  à pousser des payloads avec aiCache. Au prochain push 5.7.1, le
  state Firestore redevient light. Pas de cumul possible (Firestore
  doc remplace, n'ajoute pas).
- L'aiCache est désormais reconstruit local-only après une
  installation sur un nouveau device (pas re-poussé via Firestore).
  Le premier fetchAI sur chaque morceau reconstruit le cache, ce
  qui peut consommer du quota OpenAI/Anthropic. Acceptable : c'est
  le mode de fonctionnement attendu de l'app (cache opportuniste
  per-device).

## État Phase 5.7 (sync Firestore LWW + tombstones, 2026-05-11, tag `phase-5.7-done`)

1 commit `[phase-5.7]`. Suite 510 → 535 tests (+25). SW CACHE
`backline-v55` → `backline-v56`.

**Bug reproduit** (Sébastien sur Mac) : réduction de "Ma Setlist"
120 → 50 morceaux ; le poll Firestore 5s ré-injecte 120 morceaux.
Idem pour les setlists doublons nettoyées qui reviennent.

**Cause racine** (`src/main.jsx:6690` avant Phase 5.7) :
`mergeSetlists` faisait `[...new Set([...existing.songIds,
...sl.songIds])]` pour chaque setlist commune local/remote → union
add-only, jamais de delete propagé. Symétriquement, le merge profile
(ligne 6767) écrasait en bloc via `applySecrets(ensureProfilesV6(…))`
sans arbitrage temporel.

**Fix** : last-write-wins per-record avec timestamps + tombstones
`{[setlistId]: ts}`. Le merge dans `applyRemoteData` arbitre désormais
par `setlist.lastModified` et `profile.lastModified` au lieu d'unir.

### Schéma localStorage v7 (purement additif vs v6)

```
state {
  version: 7,
  shared: {
    ...,                                    // v6 inchangé
    lastModified: number,                   // timestamp save global
    deletedSetlistIds: { [id]: number },    // CONVERTI depuis string[]
    setlists: [{ ..., lastModified?: number }],
    _migrationToast?: { count, ts }         // one-shot, cleared après affichage
  },
  profiles: { [id]: { ..., lastModified?: number } }
}
```

### Helpers nouveaux (`src/core/state.js`)

- **`ensureSharedV7(shared)`** : heal défensif au load. Convertit
  `deletedSetlistIds` legacy (`string[]`) → `{[id]: Date.now() -
  1000}` (1s d'antériorité pour ne pas masquer une suppression
  remote concurrente lors de la cohabitation v6/v7). Stamp
  `setlist.lastModified` si manquant. Idempotent.
- **`ensureProfileV7` / `ensureProfilesV7`** : chaîne le heal
  v3→v4→v6 (drop legacy `devices`) + stamp `lastModified`.
- **`gcTombstones(map, maxAgeMs = 30j)`** : pure ; purge les entries
  >30j. Appelé une fois au mount via `useEffect([])` côté
  main.jsx, avec `setDeletedSetlistIds` pour persister le clean.
- **`mergeDeletedSetlistIds`** : union avec `max(ts)` en cas de
  conflit.
- **`mergeSetlistsLWW(local, remote, mergedDeletedMap)`** :
  - Si `mergedDeletedMap[id]` >= max(local.lastModified,
    remote.lastModified) → drop (tombstone gagne).
  - Sinon, présent des deux côtés → garde plus grand
    `lastModified`. Égalité → keep local.
  - Sinon local-only / remote-only → keep tel quel.
- **`mergeProfilesLWW(local, remote, { applySecrets })`** : LWW
  per-profile via `lastModified`. Callback `applySecrets`
  (optionnel, fourni par main.jsx) réapplique aiKeys/password
  locaux sur les profils remote adoptés. Tous les profils sortants
  passent par `ensureProfileV7`.

### Migration `migrateV6toV7`

1. `ensureSharedV7` + `ensureProfilesV7`.
2. **Cleanup doublons one-shot** : groupe par
   `(name, profileIds.sort())` ; pour chaque groupe ≥2, garde le
   survivant (plus de songIds, tiebreak idx min), fusionne songIds
   en union dédupliquée, tombstone les losers avec `Date.now()`.
3. Si `count > 0` → injecte `shared._migrationToast = { count, ts }`
   consommé par App au mount (toast 5s, message
   `"Nettoyage initial : N setlists doublons fusionnée"`). Le
   champ disparaît naturellement au prochain save légitime (App ne
   le copie pas dans son state React, juste lu une fois).
4. Idempotent sur v7 sans doublons restants.

### Stamping write-time (`src/main.jsx`)

- **`setSetlists` wrapper (ligne 6264)** : diff shallow par setlist
  (`length|name|profileIds(sorted)|songIds(sorted)`). Si différent
  → stamp `lastModified = Date.now()`. Évite les stamps gratuits
  sur identité-only.
- **`setProfileField` (ligne 6384)** : stamp
  `profile.lastModified` sur chaque write de champ.
- **`recordLogin`** : stamp aussi (login = activité utilisateur).
- **`makeDefaultProfile`** : stamp `lastModified = Date.now()` à la
  création (pour que les profils nouvellement créés gagnent contre
  un remote vide).

### Cohabitation v6/v7 pendant rollout

- Clients v7 reçoivent un push v6 (array tombstones) → conversion
  défensive via `normalizeTombstones` dans `applyRemoteData`
  (`{[id]: Date.now() - 1000}`).
- Clients v6 reçoivent un push v7 (objet tombstones) → leur
  `mergeSetlists` legacy ignore l'objet (Set(obj) = []) ; ils
  continueront à mal merger jusqu'à update. Fenêtre courte car
  single-file build se propage en 1 reload.

### Tests (25 nouveaux dans `src/core/state.test.js`)

- `ensureSharedV7` (3) : conversion array→objet, idempotence,
  stamp setlists.
- `ensureProfileV7` (3) : stamp lastModified, préservation,
  chaînage drop legacy devices.
- `gcTombstones` (3) : drop >30j, falsy → `{}`, maxAgeMs custom.
- `mergeDeletedSetlistIds` (2) : union max(ts), falsy.
- `mergeSetlistsLWW` (6) dont **scénario du bug** explicite :
  local 50 récents bat remote 120 anciens (pas d'union à 120).
- `mergeProfilesLWW` (2) : LWW + applySecrets, local/remote only.
- `migrateV6toV7` (5) : conversion tombstones, stamping,
  cleanup doublons + `_migrationToast`, pas de toast si rien,
  idempotence.
- `TOMBSTONE_MAX_AGE_MS` (1) : 30 jours en ms.

### Test manuel post-déploiement

1. **Reproduction bug** : profil Sébastien, "Ma Setlist" → réduire
   120 → 50 morceaux. Attendre 5s (1 cycle poll après push 2s).
   Reload → 50 morceaux (pas 120). Vérifier
   `localStorage.tonex_guide_v2.shared.deletedSetlistIds` est un
   objet, `shared.lastModified` présent, chaque
   `setlists[i].lastModified` présent.
2. **Toast migration** : avec un state v6 contenant 2+ setlists
   doublons → 1er load après déploiement → toast
   "Nettoyage initial : N setlists doublons fusionnées" pendant 5s.
   Reload → pas de re-toast.
3. **Régression Phase 5.1** : `profile.devices` toujours pas
   ressuscité par le poll (chaîne `ensureProfileV7` → v6).

### Dette résiduelle Phase 5.7

- `mergeSongDb` (`main.jsx:6655`) toujours en union by id (non
  touché Phase 5.7 — hors scope, les songs sont mostly add-only).
  Si un jour la suppression de song doit propagger, Phase 6 ou plus
  étendra LWW à songDb.
- Garbage collection 30j actuellement local-only (pas pushé en
  Firestore). Au prochain save légitime après GC, l'état clean part
  bien à Firestore — mais une race avec un autre device qui aurait
  une vieille tombstone pourrait la réintroduire. Acceptable car
  la fenêtre est ≥30j.

## État Phase 5.6 (Optimiser respect availableSources, 2026-05-11, tag `phase-5.6-done`)

1 commit `[phase-5.6]`. Suite 499 → 510 tests (+11).

**Bug rapporté** : sur l'écran Optimiser, profil Sébastien avec
`profile.availableSources.Factory = false` voyait néanmoins des
suggestions Factory à installer (ex. "VOWELS" → 🏭 ToneX Factory →
Bank 6B). Cohérence brisée : l'utilisateur ne possède pas le pack.

**Cause** : dans `BankOptimizerScreen.analyzeDevice` (main.jsx
~ligne 3942), la boucle qui scanne `PRESET_CATALOG_MERGED` pour
construire `idealTop3` filtrait sur `isSrcCompatible(pInfo.src,
deviceKey)` (compat ToneX Pedal vs Anniversary vs Plug) mais PAS
sur `availableSources[pInfo.src]`. Les autres call sites (lignes
4097 et 4426) avaient déjà le filtre.

**Fix** : ajout du filtre `if(pInfo.src && availableSources &&
availableSources[pInfo.src] === false) continue;` dans la boucle.
Passage de `availableSources` à `computeBestPresets` (5e param).
Le helper `isSourceAvailable(srcId, availableSources)` est ajouté
à `core/sources.js` pour usage cross-modules futur.

**Tests** (11) :
- `isSourceAvailable` (6) : explicitement true/false, absent (permissif),
  null/undefined fallback, srcId vide, scenario Sébastien Factory=false.
- Régression `filterCatalog` simulant la boucle analyzeDevice (5) :
  Sébastien Factory=false → VOWELS exclu mais TSR/Anniversary/ML passent ;
  toutes sources off → vide ; partial TSR+Anniversary → 2 presets ;
  availableSources undefined → catalogue entier (régression profil stale).

**Non touché (déjà OK)** : `computeBestPresets` (filter ligne 824),
`findBestAvailable` (411), boucles standardBanks (4097) et plan
réorganisation (4426). Seul `analyzeDevice` manquait. Phase 5.3
ligne 3023 (SongDetailCard install) avait déjà ce filtre.

**Test manuel après déploiement** :
1. Profil Sébastien → Optimiseur → choisir setlist contenant un
  morceau avec match Factory (VOWELS, etc.) → vérifier que la
  suggestion n'est PLUS Factory.
2. Profil → Sources → cocher Factory → retour Optimiseur → la
  suggestion Factory réapparaît.

## État Phase 5.5 (suppression en masse setlist, 2026-05-11, tag `phase-5.5-done`)

1 commit `[phase-5.5]`. Suite 482 → 499 tests (+17).

**Problème** : sur une setlist 120 morceaux, retirer un par un via
🗑️ (Phase 5.4) prend trop de temps.

**FIX A — Bouton 🧹 Vider la setlist** (panneau d'édition).
- Rangé entre ✏️ (rename) et 🗑️ (delete setlist) dans la ligne
  d'édition de chaque setlist (mode editingSetlists).
- Visible uniquement si `sl.songIds.length > 0`.
- Click → `window.confirm` avec message explicite :
  `Vider "<name>" ? N morceaux retirés. Les morceaux restent dans
  la base globale. La setlist continue d'exister, juste vide.`
- Validation → `onSetlists(p => p.map(s => s.id===sl.id ? {...s,songIds:[]} : s))`.
- songDb global non touché.

**FIX B — Bouton 🧹 Retirer non-cochés** (barre d'actions setlist
active).
- Dans la barre d'actions compacte, à côté de "Cocher".
- Visible si `activeSlId` ET `0 < checked.length < activeSongs.length`.
- Label dynamique : `🧹 Retirer non-cochés (M)`.
- Style wine (action destructive mais ciblée).
- Click → `window.confirm` avec compte : `Garder N et retirer M ?
  Les morceaux retirés restent dans la base globale.`
- Validation → filter songIds par les checked + reset checked.
- Permet le tri inverse : cocher les 20 à garder, virer les 100
  autres en 1 clic.

**Tests** :
- `ListScreen.bulk-actions.test.js` (17) :
  - `emptySetlist` reducer (5 tests) : songIds clear, autres champs
    préservés, slId inexistant no-op, idempotent, songDb intact.
  - `keepCheckedInSetlist` reducer (7 tests) : filter, ordre préservé,
    edge cases (vide / tout / ghost id / autres champs / slId
    inexistant).
  - Confirmation modale (2) : si confirm false, no-op.
  - Visibility rules (3) : règles d'affichage des 2 boutons.

## État Phase 5.4 (retrait morceau + dédup name-only, 2026-05-10, tag `phase-5.4-done`)

1 commit `[phase-5.4]`. Suite 461 → 482 tests (+21 : 11 dédup + 10 remove/undo).

**FIX A — Bouton 🗑️ par morceau + toast undo 5s**
- `ListScreen` : 3e zone frère à droite du row morceau (en plus de
  la checkbox et de la zone clickable). Bouton 🗑️ visible uniquement
  quand `activeSlId` est défini (mode "Tous les morceaux" reste sans).
  Couleur text-dim au repos, rouge au hover. `stopPropagation` pour
  ne pas trigger l'expand.
- État local `removedSong = { slId, songId, songTitle, position, expiresAt }`
  + `removedTimeoutRef`. Au click 🗑️ :
  1. Capture la position du songId dans setlist.songIds.
  2. Filter songIds (morceau retiré de la setlist, RESTE dans songDb).
  3. Set removedSong + timeout 5s pour auto-dismiss.
- Toast sticky-bottom : `"<titre>" retiré · ↩ Annuler`. Le titre du
  morceau est affiché pour confirmation visuelle (évite l'undo
  aveugle). Click "Annuler" → réinsère songId à la position d'origine
  (avec garde si le morceau a été ré-ajouté manuellement entre temps).
- Si l'utilisateur retire un 2e morceau pendant que le toast est
  actif : le 1er retrait devient définitif, le toast est remplacé.

**FIX B — Dédup setlists name-only (Option A)**
- `dedupSetlists(setlists, { mergeAcrossProfiles: true })` (Phase 5.4) :
  clé = name uniquement, le survivant fusionne `profileIds` en union
  ET `songIds` en union dédupliquée. Préserve l'ordre des profileIds
  du survivant en tête.
- Mode strict (default `mergeAcrossProfiles: false`, comportement
  Phase 4.1 inchangé) reste utilisé par la migration auto `migrateV4toV5`
  pour ne pas mélanger silencieusement des profils que l'utilisateur a
  sciemment séparés.
- Helper `findSetlistDuplicatesByName(setlists)` retourne les groupes
  de doublons par name avec union des profileIds. Utilisé par
  MaintenanceTab pour pré-visualiser ce qui sera fusionné.
- MaintenanceTab "Setlists — doublons" refait : 2 actions :
  - **Strict** (brass button) : Phase 4.1 inchangé, "même nom ET mêmes
    profils".
  - **Aggressif** (wine button, Phase 5.4) : liste les groupes
    name-only (profileIds différents), demande confirmation avec
    récap "• 'Cours Franck B' → 2 versions, profils fusionnés
    [sebastien, franck]", puis applique.

**Cas d'usage cible** (rapport user) : la setlist "Cours Franck B"
apparaît 2 fois pour Sébastien parce que profileIds diffèrent
légèrement (`['sebastien']` vs `['sebastien', 'franck']`). Le mode
aggressif les fusionne en une seule avec profileIds=['sebastien',
'franck'] et songIds=union.

## État Phase 5.3 (fix sélecteur guitare invisible, 2026-05-10, tag `phase-5.3-done`)

1 commit `[phase-5.3]`. Suite 454 → 461 tests (+7 régression).

**Bug rapporté** (Chrome DevTools) : sur les morceaux custom sans
aiCache (cas typique : "A Horse with No Name" importé Newzik,
`song.ig = []`, `song.aiCache = null`), la fiche dépliée
(SongDetailCard) affichait le message "Aucune analyse IA en cache.
Selectionne une guitare pour lancer l'analyse." mais **AUCUN
sélecteur de guitare** n'était rendu. L'utilisateur ne pouvait donc
pas déclencher l'analyse → bloqué.

**Cause** : la SECTION 4 "Paramétrage" (qui contient le `<GuitarSelect>`)
était à l'intérieur d'un fragment `{!reloading && aiC && <>...</>}`
ouvert par la SECTION 2 "Raisonnement IA". Quand `aiC` est null,
toute la SECTION 4 — et donc le sélecteur — était masquée. Phase 5
Item A avait corrigé le scoring/listing mais pas la condition de
rendu structurelle.

**Fix** :
- Fermeture du fragment déplacée AVANT la SECTION 4 (entre les
  sections 3 et 4).
- SECTION 4 sortie du fragment → `<GuitarSelect>` toujours visible.
- Sous-parties qui dépendent strictement de `aiC` (presets ToneX
  installés via `aiC[d.presetResultKey]`, suggestion si score<90%)
  gated par `aiC && (...)` à l'intérieur de la SECTION 4.
- RecommendBlock TMP reste visible (il fait sa propre reco basée
  sur song/guitar, pas sur aiC) — l'utilisateur voit la reco TMP
  même sans cache IA.

**Tests régression ajoutés** (`SongDetailCard.guitar-select.test.jsx`) :
- 4 tests structurels validant le contrat de gating (sélecteur
  toujours rendu, sous-parties gated par aiC).
- 3 tests DOM via `<GuitarSelect>` isolé : ig=[] → toutes guitares
  listées + change déclenche callback + étoile sur ig préfilled.

## État Phase 5.2 (rebrand Backline, 2026-05-10, tag `phase-5.2-done`)

Rebrand "ToneX Poweruser" → "Backline" en 4 commits atomiques
`[phase-5.2]` :

- **Commit 1 — `core/branding.js` + replace hardcoded names.**
  Nouveau module exporte `APP_NAME = 'Backline'`, `APP_TAGLINE`,
  `APP_SHORT_NAME`. 6 sites `<div>ToneX Poweruser</div>` → `<div>{APP_NAME}</div>`
  dans main.jsx (AppHeader, ExportImportScreen, SplashPopup,
  OnboardingWizard, HomeScreen, loading screen). Tagline obsolète
  "Le guide intelligent pour ta pédale ToneX" remplacée par
  `APP_TAGLINE` (élargissement multi-devices). "Mes appareils
  ToneX" → "Mes appareils audio". Filename export JSON
  `tonex_guide_*.json` → `backline_*.json`. Commentaire header
  `tokens.css`. **NON touché** (intentionnel) : LS_KEY
  (rétrocompat données), noms de devices "ToneX Pedal/Anniversary/Plug"
  (marques tiers), noms de SOURCE catalog ("Anniversary", "Factory",
  "PlugFactory" sont des sources de capture, pas l'identité produit).

- **Commit 2 — icône SVG carrée + composant `BacklineIcon`.**
  Nouveau logo silhouette d'ampli avec speakers (basé sur
  `src/assets/backline-icon.svg`, viewBox 417×292 paysage). Versions
  carrées PWA : `backline-icon-192.svg` (radius 32, fond tolex-900,
  ampli centré 70% en cream-50) + `backline-icon-512.svg` (idem
  scale up). Composant `<BacklineIcon size color title>` qui inline
  le SVG d'origine. Intégré aux 4 sites identitaires (header 20px,
  splash 56px, onboarding 64px, loading 56px) — les emojis 🎸
  sémantiques (history, ig hint) restent inchangés.

- **Commit 3 — manifest PWA + apple-touch-icon Backline.**
  data-URI inline mis à jour : `name = 'Backline'`,
  `short_name = 'Backline'`, `description = APP_TAGLINE`,
  `start_url = './index.html'` (explicite vs `./` avant), icons
  array 192+512 SVG inline. apple-touch-icon basculé sur
  backline-icon-192. Test régression `branding-regression.test.js`
  scan récursif des sources (jsx/js/html/css/md hors node_modules+dist)
  pour bloquer toute future réintroduction de "ToneX Poweruser" /
  "ToneX Setlist Guide" / "ToneX Superuser".

- **Commit 4 — SW `backline-v55` + redirect template.**
  CACHE prefix `tonex-v*` → `backline-v55`. Cleanup automatique
  des anciens caches via le filter `k!==CACHE` du SW activate.
  Nouveau `src/index-redirect-from-old.html` : page minimale
  triple-safety (meta refresh + window.location.replace + lien
  fallback) destinée à remplacer `ToneX_Setlist_Guide.html` à la
  racine main au déploiement. Sert les anciennes PWA installées
  (start_url legacy) → redirigées transparently vers `/index.html`
  à la prochaine ouverture.

**Workflow déploiement Phase 5.2** :
1. `git push origin refactor-and-tmp` + `git push origin phase-5.2-done`.
2. `npm run build` → produit `dist/index.html` (Backline complet).
3. `cp dist/index.html main:/index.html` (URL canonique).
4. `cp src/index-redirect-from-old.html main:/ToneX_Setlist_Guide.html`
   (rétrocompat).
5. `git add` + commit `Update prod with Backline rebrand` + push origin main.
6. GitHub Pages servira `https://ff2t.github.io/tonex-setlist-guide/`
   → directement Backline (anciens bookmarks redirigés).

**Risques connus** :
- PWA installées avant Phase 5.2 (start_url=./ToneX_Setlist_Guide.html).
  Le redirect HTML les fera arriver sur `/index.html` au prochain
  lancement, mais le manifest pourrait être considéré "à réinstaller"
  par l'OS. Le user verra peut-être un prompt "réinstaller l'app".
  À surveiller en pratique au déploiement.
- localStorage : préservé via les LS_KEY inchangés (`tonex_guide_v2`).

**Suite 443 → 454 tests** (+11 nouveaux Phase 5.2 : 4 branding +
4 BacklineIcon + 3 régression).

## État Phase 5.1 (fixes complémentaires, 2026-05-10, re-tag `phase-5-done`)

2 fixes Phase 5 en 1 commit `[phase-5.1]` :

- **FIX 1 — `profile.devices` ressuscitait via Firestore poll.**
  Le bug rapporté : après chargement,
  `JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.devices`
  retournait `{...}` même après `migrateV5toV6`. Cause : le polling
  Firestore (`applyRemoteData`) injectait les profils distants via
  `ensureProfilesV4` — qui heal v3+v4 mais ne droppe pas `devices`.
  Chaque poll Firestore (toutes les 5s) ré-injectait silencieusement
  `devices` depuis le doc distant stale. Fix : nouveau
  `ensureProfileV6`/`ensureProfilesV6` qui drop le champ après heal
  v4. `migrateV5toV6` délègue à ce helper unique. Les 3 call sites
  Firestore (mergedProfiles initial, applyRemoteData, push merge)
  utilisent désormais `ensureProfilesV6`.

- **FIX 2 — lazy load jsPDF impossible avec single-file build.**
  Tentative initiale du plan : `const { jsPDF } = await import('jspdf')`
  au moment du click pour basculer jsPDF en chunk séparé. Vérifié sur
  la config :
  ```js
  // vite.config.js
  rollupOptions: { output: { inlineDynamicImports: true } },
  plugins: [react(), viteSingleFile()],
  ```
  → `inlineDynamicImports: true` force Rollup à embarquer tous les
  chunks dynamiques dans le bundle principal. Le single-file est
  une contrainte produit (dist/index.html mono-fichier déployé
  GitHub Pages, doit marcher en file:// ouvert seul). Donc lazy
  load = neutre en pratique, jsPDF reste embarqué dans le HTML.
  Limitation documentée ici, statu quo sur l'import statique.
  Alternative si trop lourd : remplacer jsPDF par une page HTML
  imprimable (window.print, zéro dépendance).

7 nouveaux tests ensureProfileV6 (drop devices, idempotent, cascade
v3+v4, scenario Firestore poll, migrateV5toV6 délègue, null
defensive). Suite 436 → 443.

## État Phase 5 (terminée 2026-05-10, tag `phase-5-done`)

Polish final + bugs résiduels en 7 commits atomiques `[phase-5]` :

- **Item G — code mort supprimé.** `AICard` (92 lignes) et
  `NewSongExplorer` (93 lignes) supprimés de main.jsx (audit
  Phase 2 confirmé : zéro instance JSX). main.jsx 6836 → 6651
  lignes.

- **Item C — Service Worker stale-while-revalidate sur le HTML.**
  Avant Phase 5 : network-first avec fallback cache (en pratique
  bloquant sur connexion lente). Après : SWR sur navigation/HTML —
  sert immédiatement le cache + fetch en background pour la
  prochaine visite. CACHE bumpé tonex-v52 → v53.

- **Item F — `core/sources.js`.** Centralise SOURCE_IDS,
  SOURCE_LABELS, SOURCE_BADGES, SOURCE_INFO + helpers
  `getSourceBadge(srcId)` et `getSourceInfo(entry)`. main.jsx
  refactor : `srcBadge` et `presetSourceInfo` deviennent
  one-liner sur ces helpers ; définition locale `SOURCE_LABELS`
  supprimée.

- **Item A — fix sélection guitare sur morceaux Newzik.**
  3 bugs chaînés résolus : (1) double `fetchAI` (handleGuitarChange +
  useEffect en parallèle) → `handleGuitarChange` devient passive
  (setGId + reset + propage `onGuitarChange`), seul le useEffect
  lance fetchAI ; (2) `.catch(()=>{})` silencieux → erreur capturée
  dans `setLocalAiErr` et affichée dans la card avec instruction
  "Vérifie ta clé API" ; (3) `setLocalAiResult(null)` inline annulait
  le useEffect en cours → supprimé. Test régression dédié.

- **Item E — drop legacy `profile.devices`.**
  STATE_VERSION=6, `migrateV5toV6` drop le champ après dérivation
  defensive de `enabledDevices` si manquant. `makeDefaultProfile`
  ne crée plus `devices`. 4 call sites refactorés
  (`MesAppareilsTab` mirror retiré, locked sources, tabs profile,
  ViewProfileScreen) → utilisent `enabledDevices.includes('tonex-X')`.
  SW CACHE bumpé v53 → v54.

- **Item I — UI paramOverrides collapsable dans ScenesEditor.**
  Sous chaque scene, sous-section "▼ Paramètres avancés" cachée par
  défaut (power users only). Mini-form inline : sélecteur bloc + input
  paramKey (datalist) + input value. Conversion auto numérique. Mode
  read-only montre les overrides existants sans le mini-form. Badge
  "ovr" sur LiveBlock TMP pour signaler les scenes avec overrides
  actifs.

- **Item K — Export PDF setlist (jsPDF).**
  `src/app/screens/SetlistPdfExport.js` génère 1 page par morceau :
  titre 24pt + artiste + meta (BPM/key/year/album) + Référence
  (SONG_HISTORY) + Guitare reco + Patches par device (ToneX
  bank+slot, TMP nom+chaîne) + description seed. Bouton 📄 dans
  l'éditeur setlists (mode édition). Defensive : songs null
  no-throw, render fail per-song catch and continue.

**Schéma localStorage v6** :
```
profile {
  ...,                                   // v5 inchangé
  // devices: { pedale, anniversary, plug }   ← SUPPRIMÉ Phase 5 Item E
  enabledDevices: string[]               // seule source de vérité
}
```

**Suite tests : 392 → 436** (+44 nouveaux Phase 5).

**Dette résiduelle (Phase 6+ si nécessaire)** :
- jsPDF coûte 240 KB gzip. Si jugé trop lourd, basculer sur une
  page HTML imprimable (window.print, pas de dep).
- Browser de patches dans MonProfilScreen (lister custom +
  factory + overrides utilisateur) — toujours dette Phase 4.
- Editor pour patches custom from scratch — dette Phase 4.
- Wake Lock toggle manuel dans LiveScreen — dette Phase 4.
- AI populating `preset_tmp` dans aiCache — dette Phase 3+.
- Découpage main.jsx (~6700 lignes) — dette Phase 1+ persistante.

## État Phase 4.1 (fixes complémentaires, 2026-05-10, re-tag `phase-4-done`)

3 fixes Phase 4 complémentaires en 1 commit `[phase-4.1]` :

- **FIX A — Bouton 🎤 pour profils sans setlist propre.** HomeScreen
  cherche aussi dans `allSetlists` les setlists partagées (sans
  `profileIds` ou avec `profileIds=[]`) si `mySetlists` est vide.
  L'App route `screen==='live'` accepte `liveSetlistId` même hors
  `mySetlists` (fallback sur `setlists` complet).
- **FIX B — Dédup setlists complet.** Helper `dedupSetlists(setlists)`
  dans `state.js` (clé `name + profileIds.sort().join('|')`) : garde
  la setlist avec le plus de songs, fusionne tous les `songIds` en
  union dédupliquée. Appliqué en 3 points :
  - `migrateV4toV5(s)` passe `s.shared.setlists` au dédup au load.
  - L'import Newzik (one-time migration) fusionne désormais sur
    `(name, profileIds)` au lieu de skip-on-name : si la setlist
    existe déjà, ajoute uniquement les songIds manquants.
  - Bouton "🧹 Fusionner setlists doublons" dans MaintenanceTab :
    compte les doublons, demande confirmation, applique
    `setSetlists(dedupSetlists(setlists))`.
- **FIX C — Rotation backups robuste au quota.** `autoBackup` :
  retry sur `QuotaExceededError` (max 3 fois, pop oldest entre
  chaque essai). `clearBackups()` exporté + bouton "🗑 Vider les
  sauvegardes" dans MaintenanceTab. `isQuotaError(e)` détecte les
  variantes name/code (Webkit 22, Firefox 1014, message regex).
- SW CACHE `tonex-v51` → `tonex-v52`.
- 18 tests Vitest ajoutés (8 dedupSetlists + 5 isQuotaError + 3
  autoBackup quota retry + 1 clearBackups + 1 migrateV4toV5
  cross-cut). Suite 392/392.

## État Phase 4 (terminée 2026-05-10, tag `phase-4-done`)

**Acquis** :
- `src/devices/tonemaster-pro/chain-model.js` étendu Phase 4 :
  - `validateScene` : id non-vide, name non-vide, blockToggles sur
    BLOCK_TYPES + boolean, paramOverrides sur BLOCK_TYPES + valeurs
    number/string, ampLevelOverride dans [0,100].
  - `validateFootswitchEntry` : type ∈ {scene, toggle, tap_tempo}.
    `toggle` accepte uniquement TOGGLE_BLOCKS = ['drive', 'mod',
    'delay', 'reverb', 'comp', 'noise_gate', 'eq'] (rejette amp/cab).
  - `validateFootswitchMap(map, sceneIds)` : clés fs1..fs4, vérifie
    cross-ref `entry.sceneId ∈ sceneIds`.
  - `validatePatch` étendu : scenes (Array, ids uniques) + footswitchMap
    (cross-check sceneIds) optionnels.
  - `applyScene(patch, sceneId)` : produit un patch résolu (toggles +
    paramOverrides + `_ampLevel`/`_activeSceneId` runtime) sans muter
    l'original.
- `rock_preset` (`tonemaster-pro/catalog.js`) reçoit ses scenes :
  - `scenes: [{rythme, ampLvl 70}, {solo, ampLvl 100}]` exact CLAUDE.md.
  - `footswitchMap: {fs1: scene rythme, fs2: scene solo}`.
  - `notes` mises à jour ("Scene Solo (FS2) : Amp Level 70%→100%").
- `INIT_SONG_DB_META` (`core/songs.js`) : 13 morceaux du seed reçoivent
  `bpm` (number) + `key` (string) statiques. Valeurs validées
  utilisateur (BPM/key proposés acceptés). `getSongInfo` corrigé Phase 4 :
  précédence `song.bpm/key` (édition utilisateur) > seed > aiCache.
- `src/devices/tonemaster-pro/ScenesEditor.jsx` : éditeur compact de
  scenes + footswitchMap, intégré au drawer du RecommendBlock TMP.
  Édite name, ampLevelOverride, blockToggles (cycle 3 états
  hérité→OFF→ON), ajout/suppression scenes, dropdowns FS1-FS4
  (scene/toggle/tap_tempo). Mode read-only sans callbacks. Pas d'UI
  pour `paramOverrides` Phase 4 (différé Phase 5).
- `RecommendBlock` TMP étendu : lit
  `profile.tmpPatches.factoryOverrides[patchId]` et fusionne sur le
  patch factory. Édition remontée via `onPatchOverride(patchId, partial)`.
  La suppression d'une scene nettoie aussi le footswitchMap qui
  pointait dessus.
- `App.onTmpPatchOverride(patchId, partial)` : helper niveau App qui
  écrit dans `profile.tmpPatches.factoryOverrides` via
  `setProfileField('tmpPatches', ...)`. Propagé en cascade
  HomeScreen/SetlistsScreen → ListScreen → SongDetailCard et
  RecapScreen → RecommendBlock TMP.
- `SongDetailCard` : inputs inline BPM (number 30-300, vide = reset)
  + tonalité (text + datalist E/A/D minor…). Persistence via `onSongDb`.
- Convention `device.LiveBlock` documentée dans `registry.js`. Signature
  `(props) → JSX`, props `{ song, guitar, profile, allGuitars,
  banksAnn, banksPlug, availableSources?, onPatchOverride? }`.
- `tonemaster-pro/LiveBlock.jsx` : LiveBlock TMP plein écran. Nom
  patch (titre 26pt) + scenes en badges horizontaux cliquables (active
  surlignée + badge ampLevel) + 4 cards FS1-FS4 avec action mappée
  (FS qui pointe sur scene active mise en évidence). Sélection initiale
  via `footswitchMap.fs1` (convention CLAUDE.md "FS1 = scene de base"),
  fallback sur première scene.
- `_shared/ToneXLiveBlock.jsx` : factory `makeToneXLiveBlock(device)`
  partagée par tonex-pedal/anniversary/plug. Affiche header device +
  nom preset reco (titre 22pt) + badge "Bank N+slot" (couleur device)
  ou badge "non installé" (jaune) + 3 cards A/B/C de la bank
  (slot reco surligné) + texte d'aide footswitch bank up/down. Si
  pas de preset reco (aiCache absent) → bloc empty.
- `src/app/screens/LiveScreen.jsx` : mode scène plein écran (position
  fixed, z-index 9999). Header avec bouton "← Sortir" + compteur
  "i/total". Title block clamp(28-48px) + artiste + BPM/key + ligne
  history (guitariste/guitare/amp original). Boucle sur enabledDevices
  pour rendre `device.LiveBlock` ; fallback minimal si absent. Footer
  prev/next (disabled aux bornes). Swipe touch (50px horizontal,
  80px max vertical). Wake Lock API auto-on à l'entrée + auto-off
  au démontage + re-acquérir au visibilitychange (Safari iOS release
  au tab change). Silencieux si l'API n'existe pas. Clavier
  ←/→/Escape pour preview desktop.
- Bouton `🎤 Mode scène` :
  - HomeScreen : CTA centré "🎤 Mode scène — {name}" si
    setlists.length > 0 et au moins une non-vide. Lance live sur la
    première setlist non-vide.
  - ListScreen (sous SetlistsScreen) : bouton 🎤 dans la barre du
    sélecteur de setlist (à côté de l'éditeur ✏️). Lance live sur
    activeSlId, ou sur songDb complet si "Tous les morceaux".
  - App : `screen === "live"` rend `LiveScreen` directement (pas de
    AppHeader/AppNavBottom).
- `state.js` v4 → v5 : purement additif. Les nouveaux champs Phase 4
  (song.bpm/key, patch.scenes/footswitchMap) sont tous optionnels et
  lus défensivement. `migrateV4toV5(s) = {...s, version: 5}`. Aucune
  transformation de données. Loader chaîne v1→v2→v3→v4→v5,
  idempotent sur v5.
- 374 tests Vitest (309 Phase 3.10 + 65 Phase 4) :
  - chain-model : 49 tests (12 Phase 3 + 37 Phase 4 sur scenes/
    footswitchMap/applyScene/validatePatch étendu).
  - catalog TMP : 34 tests (rock_preset Phase 4 scenes vérifié).
  - songs : 7 tests (création file Phase 4).
  - ScenesEditor : 19 tests (création file Phase 4).
  - LiveBlock TMP : 10 tests (création file Phase 4).
  - ToneXLiveBlock : 7 tests (création file Phase 4).
  - LiveScreen : 16 tests (création file Phase 4).
  - state.test.js : 41 tests (38 Phase 3 + 3 Phase 4 sur migrateV4toV5).
- SW CACHE bumpé `tonex-v50` → `tonex-v51`.

**Schéma localStorage v5** (purement additif vs v4) :
```
profile {
  ...,                                      // v4 inchangé
  tmpPatches: {
    custom: TMPPatch[],                     //  Phase 4 : peut contenir
                                            //  scenes / footswitchMap.
    factoryOverrides: {
      [patchId]: {                          //  Phase 4 : nouveau format
        scenes?: TMPScene[],                //  flexible (override par
        footswitchMap?: { fs1?, … }         //  champ structuré).
      }
    }
  }
}

shared.songDb[i] {
  ...,                                      // v4 inchangé
  bpm?: number,                             // Phase 4 (optionnel)
  key?: string                              // Phase 4 (optionnel)
}
```

**Dette à clore avant Phase 5 (polish)** :
- UI d'édition complète des `paramOverrides` (Scene + paramètres
  bloc-par-bloc). Phase 4 ne propose que blockToggles + ampLevelOverride.
- Browser de patches dans MonProfilScreen (lister les patches custom +
  factory + overrides utilisateur).
- Editor pour patches custom (création from scratch, pas seulement
  override de factory).
- Wake Lock toggle manuel dans LiveScreen (Phase 4 : auto-on/off).
- AI populating `preset_tmp` field dans aiCache — différé Phase 4
  comme prévu Phase 3.
- Découpage main.jsx (toujours dette Phase 1, ~6700 lignes).

## État Phase 3 (terminée 2026-05-09, tag `phase-3-done`)

**Acquis** :
- `src/devices/tonemaster-pro/` complet (4ème device de premier rang) :
  - `chain-model.js` : 9 BLOCK_TYPES (comp, drive, amp, cab, mod,
    delay, reverb + ajouts Arthur noise_gate, eq), validateBlock,
    validatePatch, getPatchBlocks dans RENDER_ORDER (noise_gate →
    comp → eq → drive → amp → cab → mod → delay → reverb).
  - `whitelist.js` : whitelist EXACTE depuis CLAUDE.md (firmware
    v1.6 + ajouts Arthur). 28 amps, 14 cabs, 9 drives, 6 mods,
    4 delays, 5 reverbs, 1 comp, 1 eq, 1 noise_gate.
  - `catalog.js` : **20 patches factory** dont **3 Arthur recopiés
    au caractère près** (rock_preset slot 211/213, clean_preset
    slot 210, flipper_patch slot 202) + 4 patches orphelins seed
    (Stairway, Money for Nothing, Romeo & Juliet, Hoochie Coochie)
    + 13 patches "famille" avec champ `usages: [{artist,songs?}]`
    listant cibles types (Beatles, SRV, Metallica, Van Halen,
    Robben Ford, Sabbath, Sigur Rós, etc.).
  - `scoring.js` : `recommendTMPPatch` avec pondération CLAUDE.md
    EXACTE (amp 0.45, cab 0.20, drive 0.15, fx 0.05, style 0.10,
    pickup 0.05) + bonus `usagesBonus` additif (+15 artiste, +25
    morceau précis) qui permet aux patches Arthur de remonter en
    top sur leurs usages explicites même quand l'amp scoring est
    ambigu (Plexi vs JCM800).
  - `RecommendBlock.jsx` : composant React compact (1 ligne) +
    drawer expandable affichant chaque bloc avec params clés,
    style/gain/pickupAffinity, usages.
  - `index.js` : auto-registration du device avec
    `RecommendBlock` attaché à la metadata.
- Registry étendu (sans modifier registry.js) : convention
  `device.RecommendBlock` (composant React optionnel). Si présent,
  les écrans (`SongCollapsedDeviceRows`, `RecapScreen`,
  `SongDetailCard`) le rendent à la place du `presetRow` legacy.
  ToneX devices (sans `RecommendBlock`) : comportement inchangé.
  `SynthesisScreen` filter out les devices avec `RecommendBlock`
  (ne fittent pas une colonne tabulaire).
- `state.js` v3 → v4 : ajoute `profile.tmpPatches: { custom: [],
  factoryOverrides: {} }`. Migration purement additive,
  idempotente, défensive face aux désynchros Firestore via
  `ensureProfileV4` / `ensureProfilesV4`.
- 220 tests Vitest (113 Phase 1+2 + 107 Phase 3 dont 50 catalog/
  scoring TMP).
- SW CACHE bumpé `tonex-v49` → `tonex-v50`.

**Schéma localStorage v4** (les changements vs v3 en gras) :
```
profile {
  ...,                                      // v3 inchangé
  tmpPatches: {                             // v4 NOUVEAU
    custom: TMPPatch[],                     //  patches user-créés
    factoryOverrides: { [patchId]: object } //  modifs sur factory
  }
}
```

**Dette à clore avant Phase 4 (Scenes / footswitch)** :
- UI d'édition des patches custom TMP (Phase 3 lit-only ;
  édition, save dans `profile.tmpPatches.custom` + UI scenes /
  footswitchMap → Phase 4).
- Champs `scenes`, `footswitchMap` du modèle TMPPatch sont
  documentés dans le type mais non encore exposés (Phase 4).
- Browser de patches dans MonProfilScreen — Phase 4.
- AI populating `preset_tmp` field dans aiCache — différé (Phase 3
  utilise un scoring pur sans IA, défensif au cas où l'AI serait
  indispo).
- Découpage main.jsx (toujours dette Phase 1, encore ~6500 lignes).

## État Phase 2 (terminée 2026-05-09, tag `phase-2-done`)

**Acquis** :
- `src/devices/registry.js` étendu : `getAllDevices`, `getEnabledDevices(profile)`,
  `getDeviceMeta`. Conserve `isSrcCompatible(src, deviceKey)` legacy
  (`'ann'` permissif, `'plug'`) pour les call sites Phase 1, plus une
  délégation vers `device.isPresetSourceCompatible` quand on lui passe
  un device id complet.
- `src/devices/tonex-anniversary/` (nouveau) : 3e device de premier
  rang. 50 banks A/B/C, partage `banksAnn` avec `tonex-pedal`,
  `excludedSources: ['PlugFactory']` (accepte `Anniversary` en exclusif),
  `defaultEnabled: false`, `icon: 🏭`.
- `tonex-pedal` filtre source durci : rejette désormais `Anniversary`
  ET `PlugFactory` (Phase 1 acceptait `Anniversary`). Les call sites
  legacy via `isSrcCompatible(src, 'ann')` sont préservés.
- `src/core/state.js` (nouveau) : extraction de toute la logique
  d'état (chargement, sauvegarde, migrations, backups, secrets,
  trusted devices) depuis main.jsx vers un module testable.
  - `STATE_VERSION = 3`, clé localStorage inchangée
    (`tonex_guide_v2`).
  - `migrateV2toV3` ajoute `profile.enabledDevices: string[]` dérivé
    de `profile.devices.{pedale, anniversary, plug}` legacy.
    Migration purement additive : aucun autre champ touché.
  - `loadState` enchaîne v1→v2→v3 si nécessaire, idempotent sur v3.
  - `makeDefaultProfile` : admin → `enabledDevices=['tonex-anniversary',
    'tonex-plug']`, standard → `['tonex-pedal','tonex-plug']`.
  - 21 tests (state.test.js + intégration registry).
- Onglet `📱 Mes appareils` (renommé depuis `📱 Materiel`) dans
  MonProfilScreen : nouveau composant `MesAppareilsTab` qui itère sur
  `getAllDevices()` pour afficher une checkbox par device. Toggle
  écrit `profile.enabledDevices` ET `profile.devices` (legacy) en
  miroir. Garde-fou : ≥1 device coché obligatoire.
- `RecapScreen`, `SynthesisScreen`, `SongDetailCard` : suppression
  des hardcodes `'Pédale'/'ToneX Plug'`. Le rendu boucle sur
  `getEnabledDevices(profile)` et utilise `device.bankStorageKey` +
  `device.presetResultKey` pour piocher les bonnes données. SCORING
  inchangé : `preset_ann`/`preset_plug` reste partagé entre les deux
  pedal devices (Phase 5 pourra splitter si besoin).
- 96 tests Vitest (57 Phase 1 + 39 Phase 2 : registry étendu,
  tonex-anniversary, state migrations, intégration).

**Schéma localStorage v3** :
```
{
  version: 3,
  activeProfileId,
  shared: { songDb, theme, setlists, customGuitars?, toneNetPresets?,
            deletedSetlistIds? },
  profiles: {
    [id]: {
      id, name, isAdmin, password,
      myGuitars[], customGuitars[], editedGuitars{},
      devices: {pedale, anniversary, plug},  // legacy v2, conservé
      enabledDevices: string[],              // v3 : registry ids
      availableSources, customPacks[], banksAnn, banksPlug,
      aiProvider, aiKeys, loginHistory[],
    }
  }
}
```

**Dette à clore avant Phase 3** (TMP) :
- Suppression des champs legacy `profile.devices.{pedale,anniversary,
  plug}` (Phase 5 cleanup).
- Suppression des hardcodes `'Anniversary'` comme nom de SOURCE
  catalog dans `srcBadge`, `presetSourceInfo`, `ExportImportScreen`
  CSV, `ProfileTab` summary, `ViewProfileScreen` summary
  (Phase 5 cleanup, indépendant des devices).
- Code mort `AICard` et `NewSongExplorer` (jamais instanciés en
  JSX) — à supprimer ou réintroduire.
- Découpage de main.jsx (encore 6440 lignes) — dette Phase 1 à
  clore avant Phase 3.

## État Phase 1 (terminée 2026-05-09, tag `phase-1-done`)

**Acquis** :
- Vite + `vite-plugin-singlefile` + Vitest configurés. Build produit
  un `dist/index.html` mono-fichier (~786 KB, 178 KB gzip) avec SW
  blob inline (CACHE bumpé `tonex-v48` → `tonex-v49`) et manifest
  data-URI préservés. CDN React/Babel remplacés par les paquets npm.
- `src/core/scoring/{pickup,guitar,style,amp,index}.js` : extraction
  verbatim avec 38 tests de régression (snapshots déterministes).
- `src/core/{guitars,songs,setlists,catalog}.js` : données et
  helpers extraits. `main.jsx` importe désormais en bindings nommés.
- `src/devices/{registry,tonex-pedal/*,tonex-plug/*}.js` : devices
  modulaires avec auto-registration. 19 tests devices.
- `src/data/{preset_catalog_full,data_catalogs,data_context}.js` :
  data files convertis en ES modules avec `export {…}` final.
  `gen_catalog.js` met à jour `src/data/preset_catalog_full.js`.
  `inject_catalog.js` annoté obsolète.
- `src/app/components/` initialisé avec 6 composants leaf
  (Row, GuitarSilhouette, NavIcon, AppFooter, Breadcrumb,
  score-utils).

**Dette à clore avant Phase 2** :
- Découpage complet de `main.jsx` (encore 6438 lignes au lieu de la
  cible <500). À traiter par batches : helpers internes
  (presetSourceInfo, srcBadge, computeBestPresets, scorePreset,
  worstSlot, etc.) → `src/core/utils/*` ; puis composants moyens
  (PBlock, AICard, BankEditor, AddSongModal, SongDetailCard,
  PresetSearchModal, etc.) → `src/app/components/*` ; puis screens
  (BankOptimizerScreen 619 lignes, SetlistsScreen, HomeScreen,
  ListScreen, RecapScreen, SynthesisScreen, PresetBrowser,
  JamScreen, ProfilePickerScreen + tabs imbriqués, MonProfilScreen,
  ParametresScreen, ExportImportScreen, ViewProfileScreen) →
  `src/app/screens/*` ; root `App` → `src/app/App.jsx`.
- Extraction `src/core/ai/{cache,providers,prompts,index}.js`
  (différée car en cascade derrière les helpers internes).
- Tests devices à étoffer : actuellement on vérifie la structure
  des banks et le filtre source. Idéalement aussi `recommendForSong`
  par device une fois que le code AI est extrait.

**Workflow imposé par Phase 1** :
- `npm test` + `npm run build` doivent passer avant chaque commit.
- Tout changement du scoring V9 casse les snapshots — c'est
  intentionnel : régénérer les snapshots est un signal explicite,
  pas un automatisme.
- Service Worker préservé jusqu'en Phase 5 (externalisation +
  passage à stale-while-revalidate listés dans "Bugs et dettes
  connus").

## Bugs et dettes connus (à corriger Phase 5)

- `oldSetlists` force `profileIds:["sebastien"]` dans la migration
  v1→v2. Remplacer par `activeProfileId` dynamique.
- `TSR_PACK_GROUPS.Bass` existe mais aucune basse dans `GUITARS`.
  Ajouter le type "Bass" + Jazz Bass Player Plus en optionnel.
- `SCORING_VERSION` invalide tout le cache IA à chaque bump → refacto
  vers invalidation sélective par device et dimension.
- Manifest et icône en data-URI inline → sortir dans `public/`.
- Service Worker stratégie cache-first peut bloquer les updates →
  passer en stale-while-revalidate sur le HTML.

## Idées en attente (proposées, pas encore validées)

### Phase 7.44 (proposée) — Bouton "Demander un compte" sur ProfilePicker

**Idée** : ajouter sur l'écran de connexion (`ProfilePickerScreen`) un
lien discret *"Pas encore de compte ? Demander un accès"* qui ouvre un
formulaire collectant en une fois :
- Pseudo / prénom
- Email (pour recevoir le password généré par admin)
- Guitares principales (input libre, 2-4 max)
- Modèle ToneX (radio : Pedal standard / Anniversary / One / Plug / Autre)
- 5-10 morceaux prioritaires (textarea libre, séparés par virgule)
- Champ honeypot caché (anti-bot)
- Disclaimer *"Beta limitée — je reviens vers toi sous 48h"*

**Objectif** : remplacer le workflow actuel "DM Reddit + setup manuel"
par un onboarding semi-automatisé, scalable au-delà de 10-20 testeurs.
Conserve la curation côté admin (pas d'auto-création de profil).

**Implémentation suggérée** (2 niveaux, démarrer par le plus simple) :

- **Niveau 1 (MVP, ~2h dev)** : formulaire → Formspree/Web3Forms (free)
  → email à Sébastien. Pas de stockage Firestore, pas de queue admin.
  Sébastien lit l'email, crée le profil dans ProfilesAdmin avec
  password random fort, pré-configure rig + setlist (10 min), envoie
  email de confirmation au demandeur.
- **Niveau 2 (si volume justifie)** : formulaire → Firestore collection
  `requests/` avec `status: pending|approved|rejected`. Nouvelle section
  `RequestsQueue` dans MaintenanceTab admin pour traiter la file. Bouton
  "Approuver" qui auto-crée le profil avec les infos saisies (parser
  guitars/songs en best-effort, l'admin peut ajuster ensuite).

**Timing recommandé** : pas avant le post case study J+10. Avant ce
moment, la demande organique est trop faible pour justifier le code.
Après le post, si demande spike → le formulaire absorbe sans saturer
les DM Reddit.

**Risques à cadrer avant build** :
- **GDPR** : collecte email + nom + préférences musicales. Ajouter
  privacy notice ("données utilisées uniquement pour création du compte
  et contact"), permettre suppression sur demande, ne pas vendre/partager.
- **Spam/bot** : honeypot champ caché + rate-limit Cloudflare/Formspree.
  reCAPTCHA seulement si abus avéré (ajoute friction).
- **Charge admin** : 1 nouvelle demande = ~30 min de processing
  (lecture + setup + email). Mettre un quota mental (~5/sem max) ou
  fermer le formulaire temporairement si overflow.
- **Perte de curation** : actuellement les beta-testeurs sont
  pré-qualifiés via conversation Reddit/forum. Un formulaire public
  abaisse la barre — accepter que certains profils créés ne reviendront
  jamais (~50% taux d'abandon prévu).

**Composants à créer/modifier** :
- `src/app/components/RequestAccessForm.jsx` — nouveau, formulaire
  contrôlé avec validation honeypot.
- `src/app/screens/ProfilePickerScreen.jsx` — ajouter le lien
  *"Demander un accès"* sous le form login + ouverture modale du
  formulaire.
- `src/core/branding.js` — constantes pour URL Formspree, copywriting.
- Mail de confirmation type à drafter (FR + EN + ES) avec :
  - Identifiants (pseudo + password généré)
  - Lien direct vers app
  - Comment installer en PWA
  - Rappel de la beta (limitée, support best-effort)

**Question préalable à trancher avec utilisateur** : niveau 1 (email)
ou niveau 2 (Firestore queue) ? MVP recommandé niveau 1.

**Décision actuelle** : pas implémenté. Idée enregistrée pour Phase
7.44 hypothétique, à activer si signal de demande publique post J+10
case study Reddit (cf. BETA_TESTING.md local pour la stratégie).

### Phase 7.53 (proposée) — Édition usages artiste/morceau sur presets ToneNET

**Contexte** : Phase 7.52 a curé 150 captures Anniversary Premium avec
un champ `usages: [{artist, songs?}]` exploité par le prompt IA Phase
7.34 + 7.52.1 (PRIORITÉ 1 : capture dont les usages contiennent
l'artiste ou le titre du morceau analysé). Cette curation est **statique**
côté code — l'utilisateur ne peut pas tagger ses propres presets
ToneNET avec des usages.

Cas d'usage concret (rapporté 2026-05-15 sur le morceau "Paranoid" de
Black Sabbath) : Sébastien a un preset Laney dans ses ToneNET presets.
Historiquement, Tony Iommi a utilisé du **Laney Supergroup**
(LA100BL) sur le premier album Black Sabbath (1970-72), donc le Laney
ToneNET devrait remonter en top pour Paranoid/Iron Man/N.I.B. Mais
sans `usages` côté ToneNET, le prompt IA ne sait pas que ce Laney est
"pour Sabbath" — il fait son scoring V9 standard et l'AA ORNG 120
Dimed (qui a usages Sabbath dans le catalog Anniversary Premium)
gagne, alors qu'historiquement c'est moins juste pour les premiers
albums.

**Workarounds existants** :

- **Option A** (zéro code) : renommer le preset ToneNET pour qu'il
  contienne le nom de l'artiste/morceau, ex. `"Laney Supergroup Sabbath
  Iommi"`. La règle PRIORITÉ 2 du prompt Phase 7.52.1 ("capture dont
  le NOM mentionne explicitement l'artiste/morceau") le pinne. Simple
  mais cassant pour la lisibilité du nom dans les banks et le browser.

- **Option B** (correctif catalog) : ajuster les `usages` des entrées
  Anniversary Premium pour qu'ils reflètent mieux l'histoire (ex.
  AA ORNG 120 Dimed → retirer Paranoid/Iron Man/War Pigs, assigner
  à la période Vol.4+ uniquement). Maintenance continue à chaque
  désaccord historique perçu. Moins flexible que Option C.

**Option C — feature à implémenter Phase 7.53** :

- Ajout d'un champ `usages?: [{ artist, songs? }]` sur le modèle
  ToneNET preset (déjà présent dans le schéma catalog Anniversary
  Phase 7.52).
- UI : Mon Profil → 🌐 ToneNET → édition d'un preset → nouvelle
  section "Usages (optionnel)" avec :
  - Liste éditable d'entrées `{artist, songs?}`
  - Bouton "+ Ajouter un usage" → input artiste (text)
  - Bouton "+ Ajouter un morceau" sous chaque artiste (datalist depuis
    songDb pour autocomplete)
  - Bouton ✕ pour retirer un usage ou un morceau
- Persistence : ajoutée à `profile.toneNetPresets[i].usages` (LWW
  Firestore via stamp `lastModified` profil, Phase 5.7).
- Lookup : le useMemo main.jsx (Phase 2.x) qui injecte ToneNET dans
  `PRESET_CATALOG_MERGED` recopie le champ `usages` tel quel →
  `findCatalogEntry(name)` retourne déjà les usages user-définis →
  `buildInstalledSlotsSection` Phase 7.52.1 les sérialise au prompt
  sans modification.

**Effort estimé** : ~2-3h dev (UI éditeur + persist + propagation
catalog) + 1h tests Vitest (helpers purs add/remove usage + integration
fetchAI).

**Pas de bump SCORING_VERSION** (V9 inchangé, c'est purement
prompt-side). **Pas de migration** (champ additif optionnel sur le
modèle existant).

**Cas-cible Phase 7.53** : après implémentation, Sébastien peut
éditer son preset Laney ToneNET et lui ajouter `usages: [{artist:
"Black Sabbath", songs: ["Paranoid", "Iron Man", "N.I.B.", "War Pigs"]},
{artist: "Tony Iommi"}]`. La prochaine analyse IA de "Paranoid"
verra le Laney avec ces usages au prompt → PRIORITÉ 1 → pin direct.

**Quand activer** : à coupler avec un audit / correctif historique
des usages Anniversary Premium catalog Phase 7.52 (ex. retirer
Sabbath des Orange première période). Le user peut compenser via les
ToneNET, et progressivement on raffine le catalog statique en
parallèle. À démarrer après Phase 7.52.1 si Sébastien rapporte
plusieurs cas similaires (Laney pour Sabbath, autres captures
spécifiques pour artistes pas couverts par Anniversary Premium).

**Décision actuelle** : **proposée Phase 7.53**, pas d'implémentation
immédiate.

### Phase 9 (proposée) — Output IA enrichi (inspiration Gear Assistant Ok_Ask2411)

**Contexte** : un peer-builder Reddit (Ok_Ask2411, 2026-05-15) a
partagé l'output complet de son "Gear Assistant" appliqué à
*"Panama strat shawbucker"* (Van Halen). Format remarquablement
structuré qui dépasse Backline sur 4 dimensions concrètes. Détails
dans `BETA_TESTING.md` section 2 (entrée Ok_Ask2411 mise à jour
2026-05-15).

**4 features à reprendre**, indépendantes les unes des autres
(peuvent être livrées en sous-phases 9.1 / 9.2 / 9.3 / 9.4) :

#### 9.1 — Knob settings en table chiffrée

Aujourd'hui : champ `settings_preset` (objet trilingue `{fr, en, es}`)
en prose. Exemple : *"Pousse les médiums vers 6-7, garde les
basses à 4 pour le côté scooped."* Lecture humaine OK mais pas
machine-friendly et pas chiffré.

Cible : ajouter au prompt IA une demande de table JSON structurée :

```json
"settings_knobs": {
  "gain":     { "value": 6.2, "scale": "0-10", "why": "..." },
  "bass":     { "value": 4.5, "scale": "0-10", "why": "..." },
  "mid":      { "value": 7.0, "scale": "0-10", "why": "..." },
  "treble":   { "value": 5.3, "scale": "0-10", "why": "..." },
  "presence": { "value": 4.7, "scale": "0-10", "why": "..." },
  "volume":   { "value": 6.0, "scale": "0-10", "why": "..." }
}
```

UI : nouvelle sous-section "🎛️ Réglages knobs" sous le preset reco,
table 6 lignes (parameter / value / why). Conserver `settings_preset`
prose en parallèle ou le remplacer (à trancher selon retour UX).

**Coût** : +20 lignes prompt, +1 sous-composant UI, +1 champ aiCache
schéma. Pas de bump STATE_VERSION (additif optionnel).

#### 9.2 — Built-in FX params générés par l'IA

Aujourd'hui : Backline ne génère aucun setting de Noise Gate, Reverb,
Delay côté ToneX (que des recos preset). L'utilisateur configure ces
FX à la main.

Cible : ajouter au prompt :

```json
"fx_settings": {
  "noise_gate": { "threshold": -48, "release": 140, "depth": -75, "enabled": true },
  "reverb":     { "type": "Plate", "time": 1.8, "predelay": 18, "color": 52, "mix": 16 },
  "delay":      { "type": "Analog", "time": 320, "feedback": 20, "mix": 14 }
}
```

UI : 3 nouvelles sous-sections compactes sous le bloc preset. Les
params suivent la convention ToneX hardware (dB, ms, %).

**Coût** : +30 lignes prompt, +3 sous-composants UI. Risque
hallucination IA modérée (les unités ToneX réelles doivent être
listées explicitement dans le prompt).

#### 9.3 — Section "ONE TWEAK TO FIX IT" conditionnelle

Aujourd'hui : aucun ajustement empirique post-écoute n'est suggéré.

Cible : ajouter un champ aiCache :

```json
"tweaks": [
  { "if": "too_bright",        "do": "Presence -0.5 to -1.0" },
  { "if": "too_dark",          "do": "Treble +0.5" },
  { "if": "too_boomy",         "do": "Bass -0.5" },
  { "if": "buried_in_mix",     "do": "Mid +0.5" },
  { "if": "too_fizzy",         "do": "Presence -0.5 + Gain -0.3" },
  { "if": "not_tight_enough",  "do": "Gain -0.5 + Gate threshold up" }
]
```

UI : section pliée par défaut "🔧 Si ça ne sonne pas tout à fait
juste...", expand → 6 lignes "Si X → Fais Y". Réutilisable en
répétition / sur scène.

**Coût** : +15 lignes prompt, +1 sous-composant UI. Trivial à
implémenter, gros impact perçu.

#### 9.4 — Pickup choice + Playing technique

Aujourd'hui : Backline propose `ideal_guitar` mais ne précise pas
quel pickup utiliser (manche/centre/chevalet, tap coil, etc.) ni
quel style de picking convient au morceau.

Cible : ajouter au prompt :

```json
"playing_hints": {
  "pickup":  "Bridge humbucker",
  "guitar_volume": "8.5-10",
  "picking_style": "Aggressive right hand, palm-muted",
  "tone_pot": "10 (open)",
  "stereo": true
}
```

UI : sous-section "🎸 Conseils de jeu" sous le `ideal_guitar`,
4-5 lignes max. Compatible avec le `playingTipsBySong` Phase 3.8
TMP — fusionner si overlap.

**Coût** : +15 lignes prompt, +1 sous-composant UI. Risque
hallucination IA sur la position du pickup en fonction de la
guitare réelle (ex. Strat Shawbucker = HSS, donc bridge=HB ;
mais pour Tele simple = bridge=SC).

**Timing recommandé** : pas avant J+30 post-déploiement. Attendre
le feedback de Bruno (J+3-5) + Francisco (J+5-10) + Paul (J+10+)
pour savoir si l'output actuel suffit ou si la demande pour plus
de détail est explicite. Phase 9 = enrichissement, pas critique.

**Décision actuelle** : pas implémenté. Idée enregistrée pour
Phase 9 hypothétique, à activer si :
1. Au moins 2 beta-testeurs demandent explicitement "plus de
   détails sur les réglages", OU
2. Ok_Ask2411 partage son stack et un échange peer-to-peer
   confirme la valeur du format enrichi.

(cf. BETA_TESTING.md section 2 Ok_Ask2411 pour les détails du
format observé et la comparaison Backline ↔ Gear Assistant.)

## Hors scope (pour rappel, à NE PAS faire sans demande explicite)

- TypeScript.
- Backend / serveur.
- Auth utilisateur réelle (les profils sont locaux).
- Réécriture from scratch d'un screen qui marche.
- Migration vers Next.js, Remix, ou n'importe quel framework SSR.
- Ajout de connecteurs cloud (Spotify, YouTube, Songsterr) sans
  validation préalable.

## Workflow attendu de Claude Code

1. À chaque session, **commencer par lire ce fichier** + l'état
   du repo (`git status`, `git log -10`).
2. Pour toute phase listée dans le plan, **présenter d'abord un plan
   en mode plan**, attendre validation, puis exécuter par étapes.
3. À chaque étape : `npm test` + `npm run build` avant de commiter.
4. Commits atomiques avec préfixe `[phase-N]`.
5. **Ne jamais merger** dans `refactor-and-tmp` sans accord explicite.
6. Si un test échoue, **arrêter** et signaler — ne pas le contourner
   en commentant ou en relâchant l'assertion.
7. Pour les décisions de design ou de modèle, **demander avant de
   coder** plutôt que d'improviser.
