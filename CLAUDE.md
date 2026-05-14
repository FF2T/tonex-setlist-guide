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

## État actuel (2026-05-14, Phase 7.30 close)

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
