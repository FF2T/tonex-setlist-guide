# ToneX Poweruser — Contexte projet pour Claude Code

> Ce fichier est lu automatiquement par Claude Code à chaque session.
> Le tenir à jour quand l'archi évolue.

## But du projet

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

Usages : AC/DC (TNT, Thunderstruck, Highway to Hell, Back in Black, Hells Bells, You Shook Me All Night Long), Cream "White Room", Deep Purple "Smoke on the Water"

```
{
  noise_gate: { model: "Noise Reducer", enabled: true,
                params: { threshold: 5, attenuation: 6 } },
  drive: { model: "Super Drive", enabled: true,
           params: { drive: 3, level: 7, tone: 5 } },
  amp: { model: "British Plexi", enabled: true,
         params: { volume_i: 5, volume_ii: 5, treble: 6, middle: 5,
                   bass: 5, presence: 6 } },  // amp_level: 70%, gate amp OFF
  cab: { model: "4x12 British Plexi Greenback", enabled: true,
         params: { mic: "Dyn SM57", axis: "on", distance: 6,
                   low_cut: 20, high_cut: 20000 } },
  delay: { model: "Digital Delay", enabled: true,
           params: { time: 350, feedback: 25, mix: 15, hi_cut: 6000, low_cut: 100 } },
  reverb: { model: "Spring", enabled: true,
            params: { mixer: 3, dwell: 7, tone: 6, predelay: 0,
                      hi_cut: 8000, low_cut: 100 } },
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
