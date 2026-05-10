# Backline — Contexte projet pour Claude Code

> Ce fichier est lu automatiquement par Claude Code à chaque session.
> Le tenir à jour quand l'archi évolue.

## But du projet

**Backline** (anciennement "ToneX Poweruser", renommé Phase 5.2 mai 2026
quand le scope a dépassé le strict ToneX Pedal pour couvrir 4 devices).

Tagline : *"Le guide intelligent pour tes pédales et amplis modélisés"*.

URL canonique : `https://ff2t.github.io/tonex-setlist-guide/index.html`
(le slug GitHub Pages reste historique pour ne pas casser les
bookmarks ; c'est `index.html` à la racine qui sert l'app, et
`ToneX_Setlist_Guide.html` un redirect HTML vers `index.html`).

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

Déployée sur GitHub Pages : https://ff2t.github.io/tonex-setlist-guide/

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
