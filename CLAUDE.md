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
  actifs, 11 guitares dans son rig app (LP60, LP P90, SG Ebony,
  ES-335, Strat 61, Strat Pro II, EC Strat, Tele 63, Tele Ultra,
  Jazzmaster, Tele 51 custom). ⚠ La **SG 61** du foyer est sur le
  profil **d'Arthur** (un seul exemplaire à la maison, qu'Arthur
  utilise) — elle n'est PAS dans le rig de Sébastien. La défense
  « orphan-cross-profile » de `mergeProfileLWW` filtre donc
  légitimement `sg61` de `myGuitars` de Sébastien : ce n'est PAS un
  bug. Profil secondaire : son fils, 12 ans, fan d'AC/DC et BB King,
  équipement Epiphone + Fender Junior.
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

## Docs additionnelles

- **`docs/SCORING.md`** — Pipeline de recommandation (scoring V9,
  prompt IA, override Phase 7.31, modes reco, biais, usages catalog,
  garde-fous Phase 7.34 anti cross-contamination). À lire quand on
  touche au scoring, au prompt `fetchAI`, ou à `enrichAIResult`.

- **`docs/SYNC.md`** ⚠️ — Sync Firestore : invariants + pièges. **À
  lire OBLIGATOIREMENT avant de toucher au `useEffect` persist de
  main.jsx, à `enterDemoMode`, à `saveToFirestore`, ou à
  `applyRemoteData`.** Documente les 3 refs critiques
  (`lastSyncHashRef`, `justPulledRef`, `lastPulledHashRef`), le
  syncHash Phase 7.46, le merge LWW, et l'historique des 9
  régressions vécues en prod (à ne pas reproduire).

- **`docs/CASCADE.md`** ⚠️ — Cascade d'overrides d'usages 4 niveaux
  (Phase 7.79.3, livrée 2026-05-20). **À lire avant de toucher à
  `findCatalogEntry`, `saveUsagesForPreset`, `removeUsagesOverride`,
  `mergeUsagesOverridesLWW`, ou au pipeline
  `window._usagesCascadeState`.** Documente les 4 niveaux (user >
  studio > backline > default catalog), le pattern "override vide
  explicite" (`usages: null`), le routing custom/ToneNET vs catalog
  statique, et 6 pièges classiques. Slot Phase 11 Studio-driven déjà
  câblé (niveau 2).

## Style de code

- Composants fonctionnels avec hooks. Pas de classes.
- Pas de PropTypes (JS sans types).
- ESLint avec eslint-config-react-app si on en met un.
- Préférer les fichiers courts (cible <300 lignes, plafond 500).
- Noms français acceptés pour le contenu utilisateur (descriptions,
  labels) ; noms anglais pour le code.
- Le contenu utilisateur (descriptions de morceaux, notes, packs) est
  en français.

## Composants UI partagés (Button, TabButton — Vague 3 UX 2026-05-28)

Pour garantir l'homogénéité des tailles/styles (signalé par Sébastien :
boutons hétérogènes, onglets de tailles différentes), **2 composants
partagés** existent. Les utiliser systématiquement pour tout nouveau
bouton/onglet plutôt que des styles inline ad-hoc.

### `src/app/components/Button.jsx`

Bouton d'action unifié. Props : `{ children, onClick, variant, size,
iconId, disabled, title, testId, fullWidth, style }`.

- **5 variants** : `primary` (accent rempli) · `secondary` (neutre
  rempli a5) · `ghost` (neutre transparent) · `danger` (wine rempli) ·
  `danger-ghost` (wine outline).
- **2 tailles** : `md` (défaut, padding 10×16, minHeight 44 touch HIG) ·
  `sm` (compact, padding 6×12, minHeight 32).
- État `disabled` géré (bg-disabled + opacity 0.5 + cursor not-allowed).
- Icône NavIcon optionnelle (`iconId`), gap 6.
- Couleurs spéciales (gradient brass, vert JSON export) : passer via
  le prop `style` qui merge par-dessus le variant.

### `src/app/components/TabButton.jsx`

Bouton d'onglet unifié (MonProfilScreen + AdminScreen). Props :
`{ active, label, iconId, onClick, testId }`. padding 10×14, fontSize
12, minHeight 44, fontWeight active?700:500, whiteSpace nowrap,
boxShadow inset accent quand actif, icône NavIcon optionnelle.

### Migrés (Vague 3 UX)

Button : Mon compte (8) · Préférences (2) · MaintenanceTab (25, 0
`<button>` restant) · ExportImportScreen · AdminPacksTab · ToneNetTab ·
MyCustomPresetsTab · ProfileTab. TabButton : MonProfilScreen (8 tabs) +
AdminScreen (6 tabs). Micro-boutons `×` de suppression inline laissés
(déjà cohérents entre eux).

## Iconographie — pas d'emojis dans l'UI (règle 2026-05-27)

⚠️ **Règle stricte** : **JAMAIS d'emoji dans les éléments d'UI**
(boutons, tabs, sectionTitles, labels, badges). Utiliser exclusivement
des **icônes SVG flat outline** via le composant
`src/app/components/NavIcon.jsx`.

> **Vague 3 close (v8.14.282, 2026-05-28)** : tout l'UI est désormais
> sans emoji — seul le footer (`© 2026 PathToTone · Made with 🎸 and
> ❤️`) en conserve, volontairement (validé Sébastien). Le `device.icon`
> emoji (🏭/🔌/📦/🎚️) est remplacé par `device.iconId` → NavIcon `amp`
> partout. 26 icônes NavIcon disponibles. Cf section Historique en bas.

### Pourquoi

- **Cohérence visuelle** : rendu identique sur tous les OS (les emojis
  s'affichent différemment selon Apple/Google/MS).
- **Ton pro** : les SVG outline donnent un look design system
  professionnel, les emojis donnent un look amateur / chat.
- **Color theming** : `stroke=currentColor` suit automatiquement
  le thème actif (clair/sombre, état actif/inactif), les emojis ne
  peuvent pas être teintés.
- **Accessibilité** : un SVG peut avoir un `<title>` et `aria-label`,
  un emoji est lu littéralement par les lecteurs d'écran (parfois mal).
- **Cohérence avec la navbar** : la barre de nav (Accueil/Setlists/
  Explorer/Jammer/Optimiser/Admin) utilise déjà NavIcon depuis Phase 1.

### Pattern d'utilisation

```jsx
import NavIcon from '../components/NavIcon.jsx';

// Bouton avec icône inline
<button style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
  <NavIcon id="live" size={18}/>
  Mode scène
</button>

// SectionTitle (helper qui accepte JSX comme icône)
{sectionTitle(<NavIcon id="guitar" size={16}/>, t('song-detail.setup-block', 'Mon setup'))}
```

### Icônes disponibles (`src/app/components/NavIcon.jsx`)

Style cohérent : outline, `stroke=currentColor`, viewBox 24×24,
`strokeWidth=1.8`.

**26 icônes disponibles** (vagues 1 + 2 + 3 cumulées) — en plus du
tableau ci-dessous : `pen` (crayon édition) · `trash` (poubelle) ·
`broom` (vider) · `doc` (export PDF) · `amp` (cabinet + grille HP, pour
les devices ToneX via `device.iconId`) :

| id | Visuel | Usage |
|---|---|---|
| `list` | maison | nav Accueil |
| `setlists` | note musique + cercles | nav Setlists |
| `explore` | loupe | nav Explorer / Recherche intelligente |
| `jam` | rectangle arrondi + flèches | nav Jammer |
| `optimizer` | barres verticales | nav Optimiser (admin) |
| `admin` | engrenage | nav Admin / tab Préférences / config |
| `live` | micro | bouton Mode scène / empty state Live |
| `target` | cible concentrique | section Recommandations IA / Raisonnement |
| `guitar` | silhouette guitare | section Ma guitare / config |
| `bass` | corps allongé + 4 chevilles | section Ma basse / Mes basses |
| `info` | i dans cercle | section Infos morceau |
| `sliders` | 3 sliders horizontaux | réglages effets / paramétrage / Réglages EQ |
| `user` | personne unique | tab Mon compte |
| `users` | plusieurs personnes | tab Profils (admin) / Multi-profils & Sync |
| `eye` | œil | tab Tous presets users (admin) |
| `globe` | globe lat/lng | tab ToneNET (admin) |
| `wrench` | clé à molette | tab Maintenance (admin) |
| `key` | clé | tab Clé API (admin) |
| `lock` | cadenas fermé | section Mot de passe (réservé) |
| `device` | smartphone | tab Mes appareils / matériel |
| `package` | boîte 3D | tab Mes sources / Mes presets custom / packs |
| `pen` | crayon | bouton renommer / éditer |
| `trash` | poubelle | bouton supprimer (setlist, morceau) |
| `broom` | balai | bouton vider (setlist) |
| `doc` | document plié | bouton export PDF |

### Ajouter une nouvelle icône

1. Ouvrir `src/app/components/NavIcon.jsx`.
2. Ajouter un `if(id==="monid") return <svg style={st} viewBox="0 0 24 24">…</svg>;`
   AVANT le `return null;` final.
3. Respecter le style : outline only, `stroke=currentColor`,
   viewBox 24×24, strokeWidth 1.8. Pas de `fill` sauf pour des dots
   ou détails (cf `sliders`).
4. Documenter l'icône dans le tableau ci-dessus en mettant à jour
   CLAUDE.md.
5. Pour les icônes complexes : s'inspirer de Feather Icons / Lucide
   (même style outline, MIT license, base de données très complète).
6. Si l'icône n'a pas de sens flat (ex. drapeau de pays, logo de
   marque), discuter d'une exception avant.

### Exceptions tolérées (PAS dans l'UI)

Les emojis restent acceptables dans :

1. **Prompts IA Gemini** (`src/app/utils/fetchAI.js`) : les prompts
   peuvent inclure des emojis comme signaux sémantiques pour le LLM
   (ex. `🎯` pour priorité). Pas rendu côté UI.
2. **Données seed** (`SONG_HISTORY` dans `core/songs.js`) :
   les descriptions historiques peuvent contenir des emojis si l'auteur
   original les a utilisés. Préférer du texte clair en pratique.
3. **CHANGELOG / docs markdown** (CLAUDE.md, README, etc.) : ⚠️ / ✅ /
   ❌ etc. pour signaler visuellement les sections importantes — c'est
   de la doc, pas de l'UI.
4. **i18n fallback FR transitoirement** : si un emoji est encore dans
   un fallback inline `t('key', '⚙️ Admin')`, c'est une dette
   héritée à migrer. Pas une raison d'en remettre des nouveaux.

### Détection automatique

Pas de test régression automatique en place (les emojis ont trop
de faux positifs : code points multibyte, sequences ZWJ, etc.). La
règle dépend de la discipline humaine + revue de code. Pour vérifier
manuellement un fichier UI avant commit :

```bash
grep -P "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" src/app/screens/MonScreen.jsx
```

### Historique

- **Vague 1** (v8.14.267, 2026-05-27) : 7 icônes ajoutées
  (admin/live/target/guitar/bass/info/sliders). Sites migrés :
  AppHeader nav admin, HomeScreen bouton Mode scène, SongDetailCard
  4 sectionTitle (Mon setup, Recommandations IA, Basse, Infos morceau).
- **Vague 2 majoritaire** (v8.14.270 → v8.14.272, 2026-05-27/28) :
  Sébastien clarifie *"les seuls emojis que je veux conserver sont
  dans le footer"*. +14 icônes ajoutées
  (user/users/eye/globe/wrench/key/lock/device/package/pen/trash/
  broom/doc). 7 écrans nettoyés :
  - **MonProfilScreen** 8 tabs : 👤/🎸/🎻/📱/📦×2/⚙️ → NavIcon
  - **AdminScreen** 6 tabs + header : 👥/👁/📦/🌐/🔧/🔑 → NavIcon
  - **HomeScreen** : SplashPopup 3 étapes (🔍/🧠/🎸) +
    OnboardingWizard 7 features (🔍/🧠/🎵/🎲/🎛️/📦/👥) + 3 config
    items (🎸/📱/📦) + bouton Mode scène (🎤) + sectionTitle
    Paramétrage (🎛) + refs inline (🎸/🔊/🎚) + compat buckets
    (🟢/🟡/🟠) + bouton random (🎲) + Raisonnement IA (🧠) +
    Analyse/Relancer/Affiner (⏳/🔄) → tous flat ou NavIcon
  - **SongDetailCard** : EQ/FX sectionTitles (🎛️/🎚) → NavIcon
    sliders ; output context buttons (↻/📢/🎧/🎚️) → labels courts
    Profil/FRFR/Casque/Sono ; STEREO/Non installé/feedback (💬/📤)/
    buckets/refs/deviceLabel (📦/🔌) → tous flat ; **Référence
    bassiste symétrique guitariste** ajoutée dans Infos morceau
  - **LiveScreen** : empty state 🎤 + STEREO + refs inline
  - **ListScreen** : compat buckets + 🎤 Mode scène + boutons
    ✏️/🗑/📄/🧹 → NavIcon pen/trash/doc/broom ; 🔒 (moi) → '(moi)' ;
    🎵 empty state → NavIcon setlists ; ⬇/⏳/⚡ slot/pending/FX
    → texte ; 🤖 Analyser/MAJ → texte
  - **RecapScreen** : titres 🎸/🎵/⬇ + icon emoji 📦/🔌 missing
    presets → flat
  - **PBlock** : badges ⬇/↑/★/✦/→ → texte
- **Vague 3 CLOSE** (v8.14.273 → v8.14.282, 2026-05-28) : tous les
  écrans + composants nettoyés. +5 icônes (pen/trash/broom/doc/amp).
  - **MonProfilScreen** (54 emojis → 0) : titre, section headers,
    boutons, cards radio (recoMode/output/styles), badges, stats,
    hints, messages confirm/alert, thème/langue (🌙/☀️/🇫🇷 → labels)
  - **PresetBrowser** (25) : sectionTitles → NavIcon, cascade badges,
    boutons, badges install, compat buckets, filtre instrument, search,
    random
  - **Device icons** (source centrale 🏭/🔌/📦/🎚️) : `device.iconId`
    ajouté aux 4 catalogs (anniversary/plug/pedal → `amp`, tmp →
    `sliders`), 8 call sites `{d.icon}` → `<NavIcon id={d.iconId}/>`
  - **Paquet écrans** : Jam, Synthesis, ProfileTab, Landing,
    ProfilePicker (→ BacklineIcon), ViewProfile, MesAppareils,
    MyCustomPresets, ToneNet, ProfilesAdmin, AllUserPresets,
    AdminPacks, Maintenance, ExportImport, BankOptimizer,
    PresetCurationModal (pastilles statut → dot CSS), DemoBanner,
    ProfileSelector
  - **main.jsx** : titre page "🎛️ Explorer les presets" → flat ;
    PresetBrowser `ctx.emoji` ampli (🎸 devant "Orange AD200") retiré
- **Cohabitation i18n** : ~80 nouvelles clés `-flat` ajoutées sans
  emojis (ex. `'song-detail.eq-settings-flat'` vs ancien
  `'song-detail.eq-settings'` qui contenait `🎛️`). Anciennes clés
  conservées pour rétro-compat (les emojis y subsistent mais ne sont
  jamais rendus car les call sites pointent sur les clés `-flat`).
  **Vague 4 i18n cleanup** (dette) : retirer les anciennes clés à
  emojis des dicts EN/ES une fois certain qu'aucun call site ne les
  référence. Purement technique, zéro impact visuel.

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

### Catalog des presets TSR — deux sources de vérité (Phase 7.14+)

Le projet maintient **deux listes parallèles** liées aux 64 packs The
Studio Rats. Elles ont des rôles distincts et **dérivent volontairement**
l'une de l'autre dans le temps.

| Fichier | Rôle | Taille | Mis à jour comment |
|---|---|---|---|
| `src/data/tsr-packs.js` (`TSR_PACK_ZIPS` + `TSR_PACK_GROUPS`) | UI : mapping nom de pack → slug URL de la fiche d'achat TSR. Utilisé par `SongDetailCard` pour le bouton « Acheter ce pack » quand le `ref_amp` d'un morceau ne matche aucun preset installé. | 64 entrées | Édition manuelle à chaque nouvel achat. Pas de scoring touché |
| `src/data/preset_catalog_full.js` (`PRESET_CATALOG_FULL`) | Scoring + IA : metadata par capture (amp, gain bucket, style, scores HB/SC/P90). Alimente `PRESET_CATALOG_MERGED`, le moteur V9 et la sérialisation au prompt IA | ~636 entrées dont **609 TSR**, 27 ML | Régénéré par `gen_catalog.js` |

**`gen_catalog.js`** (à la racine du repo) est un script Node qui scanne
le Google Drive local de Sébastien et reconstruit
`preset_catalog_full.js` à partir des fichiers `.txp` ToneX réellement
présents :

```
BASE = /Users/sebastien/Library/CloudStorage/GoogleDrive-.../Musique/Guitare/TONEX/AMP/
TSR_DIR = $BASE/TSR TONE MODELS
ML_DIR  = $BASE/ML-Sound-Lab-Capture-Pack-ESSENTIALS/ToneX
```

Les règles d'extraction (amp / gain / style depuis le nom de fichier
`.txp`) sont hardcodées dans `AMP_RULES` du script. À relancer après
chaque ajout de pack pour que le catalog reflète la nouvelle réalité.

#### Dérive constatée (audit 2026-05-16)

Au moment de cet audit, le catalog couvre **56 / 64 packs**. Les 8 packs
absents se classent en 4 cas distincts — pas tous des bugs :

| Pack absent du catalog | Cas | Action recommandée |
|---|---|---|
| Mega Barba Skill, Friedman Phil X, Amplifonics & Gain | **Catalog stale** : packs achetés / sortis après la dernière exécution de `gen_catalog.js` (figé depuis Phase 1, 9 mai 2026) | Relancer `gen_catalog.js` après avoir décompressé les ZIPs dans le Google Drive |
| **D13 Best Tweed** | **Faux manquant** : son `TSR_PACK_ZIPS` pointe sur `TSR-D13-Pack`, le même slug que le pack `'D13'`. C'est une réédition / variante commerciale du pack D13 standard. Les 28 presets `TSR D13*` du catalog couvrent les deux | Rien à faire. Documenter dans `TSR_PACK_GROUPS` si la confusion gêne |
| Drive Pedal Pack 3, Jivey Drives, Jivey Drives 2 | **Hors modèle amp-centric** : ces packs capturent des PÉDALES seules (sans ampli en aval). Le scoring V9 exige `entry.amp: string` et applique `computeRefAmpScore` (30 % du score). Une capture de pédale standalone fitte mal le modèle | À trancher : soit on ajoute un champ `entry.kind: 'pedal'` qui shunte refAmpScore (Phase 8+), soit on les exclut formellement de la pipeline scoring. En attendant : ne PAS regenerate ces .txp, ou les filtrer dans `gen_catalog.js` |
| Bass Elliot | **Hors modèle bass** : pas de basses dans `GUITARS` / pas de scoring bass-vs-pickup défini. Cohérent avec dette CLAUDE.md « TSR_PACK_GROUPS.Bass existe mais aucune basse dans GUITARS » | Lever quand Phase 8 (basse) démarre : ajouter Jazz Bass Player Plus + type 'Bass' dans GUITARS, étendre scoring, regenerate |

#### Workflow recommandé pour ajouter un nouveau pack TSR

1. Acheter le pack sur thestudiorats.com, dézipper dans
   `$BASE/TSR TONE MODELS/`.
2. Ajouter une entrée dans `src/data/tsr-packs.js` (`TSR_PACK_ZIPS` +
   `TSR_PACK_GROUPS` si applicable) avec le slug URL de la page d'achat.
3. Relancer `node gen_catalog.js` pour mettre à jour
   `src/data/preset_catalog_full.js` avec les nouvelles captures.
4. Vérifier `npm test` (snapshots V9 verts) + smoke test sur un morceau
   dont le `ref_amp` matche le nouveau pack.

Étape 3 oubliée = la dérive reprend. À l'inverse, jamais besoin de
toucher `tsr-packs.js` si le pack ajouté est uniquement pour un usage
scoring interne (mais alors le bouton « Acheter ce pack » ne pourra pas
pointer dessus dans l'UI).

#### Idée Phase ultérieure : sync auto

Le gap actuel pourrait être résorbé en faisant lire au `gen_catalog.js`
la liste `TSR_PACK_ZIPS` et émettre un `console.warn` pour chaque pack
listé sans .txp trouvés dans le Google Drive. Ou symétriquement, faire
émettre un warn pour chaque .txp scanné dont le préfixe ne matche aucun
pack connu. Phase 8+ si la dette devient gênante.

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

## État actuel (2026-06-05 vendredi, V9.8.10 — Phase 14 CLOSE : refonte Optimiseur (zones Live/Jams/Découverte + mobile + dérivation cross-device))

**Backline v9.8.10 / SW backline-v456 / STATE_VERSION 15 / 2058 tests verts. Bundle 2969 KB.**

### Chantier Phase 14 — Refonte Optimiseur ✅ CLOSE (handoff `handoff/PHASE_14_OPTIMISEUR_ZONES.md` entièrement traité)

L'Optimiseur passe de 3 blocs empilés (Actions / Diagnostic / Plan) à **2 modes
explicites** (Améliorer / Réorganiser) + un **découpage de la pédale en zones**
(Live / Jams / Découverte) pilotable, une **métrique ampli passe-partout** pour
les jams, le **packing sous contrainte** pour les devices mobiles et la
**dérivation cross-device** depuis un rig de référence. **Zéro scoring V9 touché**
(SCORING_VERSION reste 9, snapshots verts), pas de bump STATE_VERSION (les 7
champs Phase 14 sont additifs optionnels, déjà au profileHash depuis 14.1).

| Sous-phase | Version | Sujet |
|---|---|---|
| 14.0 (déjà fait v9.8.x) | 9.8.x | Devices One/One+ : modèle `flat` (20 slots), `bankModel`/`nbSlots` exposés tous devices |
| 14.1 | 9.8.5 | Zones `bankZones` + `getEffectiveZones` (triplet ET flat) + barre de zones (Live/Jams/Découverte) + sync (7 champs au profileHash) |
| 14.2 | (core) | `core/scoring/jam.js` : `jamScore` (refAmp retiré, renormalisé), `versatilityStats` (polyvalence = moyenne − k·écartType, défaut k=1.5), `computeAmpVersatility`, `rankJamAmps`. Test de réf §4.4 (Deluxe régulier > Plexi à pics). Pas d'UI |
| 14.3 | 9.8.6 | Segmented **Améliorer / Réorganiser** + mode Réorganiser zone **Live** mutualisée (1 banque/ampli partagé, garde-fou régression δ/floor) + aperçu **diff** (inchangée/modifiée/fusionnée/libérée) + axes (setlist/famille ampli) + apply zone Live only. Suppression ancien Plan de réorganisation |
| 14.4 | 9.8.7 | Mode **Améliorer seuillé** : `splitSwapsByImpact` (utile = franchit 80% OU sauvetage point faible `gain≥rescueGain`), mineures repliées, projected sur swaps utiles |
| 14.5 | 9.8.8 | Zone **Jams** (branchée jam.js : ampli passe-partout par style, polyvalence/couverture, forçage `jamOverrides`, slider k) + zone **Découverte** (`discoveryPins` + suggestions + deep-link Explorer `window._explorePreset` + promotion → Jam/→ Live) |
| 14.6 | 9.8.9 | **Mobile + dérivation** : `packForCapacity` (dégradation Découverte→Jams→fusion Live same-amp→flat 1-son→couverture, jamais de drop silencieux), `deriveLayoutFromReference` (capture compatible gardée / substituée même ampli-gain-style / vidée + divergences), `applyJamOverrides` (override survit à la dérivation), `getEffectiveReferenceDeviceId`/`getDerivationMode`, workflow « préparer ce device pour ce soir » (`portableTargets`), UI divergences + dropped |
| 14.6.1 | 9.8.10 | Fix renumérotation : jams dérivées numérotées à la frontière de zone (Plug 11-12/10, One+ 21-22/20) → `numberDerivedLayout` (Live puis Jams contigus depuis startBank, dans la capacité) |

**Helpers purs livrés** (tous testés, ~90 tests Phase 14) :
- `core/state.js` : `getEffectiveZones`, `getEffectiveJamStyles`,
  `getEffectiveReferenceDeviceId`, `getDerivationMode`.
- `core/scoring/jam.js` : `jamScore`, `versatilityStats`,
  `computeAmpVersatility`, `rankJamAmps`.
- `app/utils/optimizer-helpers.js` : `clusterSongsBySharedTone`,
  `buildLiveLayout`, `diffLayout`, `splitSwapsByImpact`, `buildJamLayout`,
  `packForCapacity`, `deriveLayoutFromReference`, `applyJamOverrides`,
  `numberDerivedLayout`.

**Modèle de données Phase 14** (additif, `profile.*`, défauts via helpers) :
`bankZones[deviceId]={liveEnd,jamEnd}`, `jamStyles[]`,
`jamOverrides[deviceId][style]`, `discoveryPins[deviceId][]`,
`referenceDeviceId`, `derivationMode[deviceId]` ('derived'|'independent'),
`portableTargets[deviceId]={kind:'setlist'|'jam',setlistId?,styles?}`. Tous au
profileHash (sync Firestore), pas de STATE_VERSION bump.

**Dette résiduelle Phase 14** (assumée v1) :
- Le mode Réorganiser est gated **admin** (route `optimizer` Phase 7.29.3). Si un
  beta-testeur non-admin doit packer son device mobile, ouvrir l'accès (cf
  dette Phase 7.67 édition rig non-admin).
- `findClosestForTarget` (substitut dérivation) prend le 1er match
  ampli→gain→style sans scorer finement (suffisant v1).
- Pas de test E2E React de `BankOptimizerScreen` (les helpers purs couvrent la
  logique ; smoke test manuel au déploiement). Le compute dérivation/packing est
  déféré + mémoïsé (`window.__TONEX_PERF`).

---

## État précédent (2026-06-04 jeudi, V9.8.1 — ToneX One + One+ + fix Optimiseur source device-gated)

**Backline v9.8.1 / SW backline-v447 / STATE_VERSION 15 / 1974 tests verts. Bundle 2914 KB.**

### v9.8.0 → 9.8.1 — Support ToneX One + ToneX One+ (jalon multi-device)

Ajout des **2 pédales compactes ToneX One et One+** comme devices à part
entière dans "Mon matériel numérique". Phase A (activation + banks +
factory) **et** Phase B (recommandations, parité Anniversary/Plug)
livrées d'un bloc.

**Modèle de banks À PLAT** : les One/One+ ont 20 presets numérotés 1-20
(pas de A/B/C). Modélisés en **"20 banques × 1 slot A"** → réutilise
TOUT le moteur scoring/findInBanks/CSV existant sans toucher aux boucles
`['A','B','C']` hardcodées (B/C absents = ignorés gracieusement). Zéro
surface de régression sur les 4 devices existants. Le `BankEditor` reçoit
`slots:['A']` → rendu 1 colonne / 20 lignes (pas de label de slot).

**Architecture sources (décision structurante)** : le catalogue est
indexé par nom → un nom = une seule `src`. Or la **ToneX One reprend les
MÊMES Tone Models que la Pédale Factory v2** (mêmes noms : HG PLEXI,
CL DMBL, DR 800… — les 20 presets One existent déjà dans FACTORY_CATALOG).
Donc :
- **One → réutilise la source `Factory`** (factuel). `SOURCE_REQUIRES_DEVICE.Factory`
  généralisé en "un parmi" : `['tonex-pedal', 'tonex-one']` (Factory dispo
  si Pédale **OU** One activée). Helper `isRequiredDeviceMissing(srcId,
  enabledDevices)` gère string|array, utilisé par `effectiveAvailableSources`
  + ProfileTab gating.
- **One+ → source dédiée `OnePlusFactory`** (20 noms inédits : Big Hair 800,
  Smooth D-Lead… → `ONE_PLUS_FACTORY_CATALOG` 20 entrées dérivées du PDF
  `tone_models/TONEX_ONE_Plus_Pre-loaded_Factory_Presets.pdf`). Pas de
  collision de clés.

**STATE_VERSION 14 → 15** : `migrateV14toV15` additif (backfill
`banksOne`/`banksOnePlus` à `{}`), `ensureProfileV15`, idempotent. Merge
LWW banks étendu (`['banksAnn','banksPlug','banksOne','banksOnePlus']`,
timestamp `banksModified` partagé). makeDefaultProfile 2 branches.

**Phase B scoring** : `computeBestPresets` produit `oneTop`/`onePlusTop`
(helper `scoreBanks` générique) ; `enrichAIResult` pose `preset_one`/
`preset_one_plus` (V9 best slot installé, source-filtered + family boost ;
pas d'AI-pinning car le prompt ne retourne pas de `preset_one_name`).
Banks One/One+ publiées sur `window.__activeBanksOne`/`OnePlus` (pattern
`__activeSources`, **gate par `enabledDevices`**) → lues en fallback par
le scoring sans threader 2 params dans les 9 call sites enrichAIResult.

**Affichage** : `getRowPlaylistData` (vue setlist repliée) + 
`SongCollapsedDeviceRows` + `ToneXLiveBlock` (mode scène) généralisés —
résolution des banks par `bankStorageKey` au lieu du hardcode ann/plug.
Le LiveBlock One/One+ est auto-enregistré via `makeToneXLiveBlock`.

**v9.8.1 hotfix** (signalement Sébastien "coché One+ + recalculé mais
pas de recos") :
1. **Auto-chargement factory à l'activation** : cocher One/One+ dans
   MesAppareilsTab charge ses 20 presets factory si banks vides (la
   pédale physique est livrée avec ; un device aux banks vides est
   "muet" sans reco). N'écrase jamais des banks déjà peuplées.
2. **deps `collapsedAiCBySongId`** (ListScreen) incluait pas
   banksOne/banksOnePlus → pas de recalcul des recos au changement de
   banks One. Props threadées main → SetlistsScreen → ListScreen.
   `cleaned` nullifie désormais preset_one/preset_one_plus.

**Fichiers** : nouveaux `src/devices/tonex-one/{catalog,index}.js` +
`tonex-one-plus/{catalog,index}.js` + `tonex-one/catalog.test.js`.
Modifiés : data_catalogs, catalog, sources(+test), state(+test),
registry, ai-helpers(+test), BankEditor, MesAppareilsTab, MonProfilScreen,
ProfileTab, SongCollapsedDeviceRows, ToneXLiveBlock, LiveScreen,
setlist-row-playlist, main.jsx. +36 tests.

### Dette résiduelle ToneX One/One+ (v1 assumée)

1. **Fiche dépliée détaillée** : le bloc "Scoring preset" de SongDetailCard
   (boutons d'installation + alternatives catalogue) reste centré
   Anniversary/Plug (hardcodé `deviceKey === 'ann' || 'plug'`,
   `findInBanks(name, banksAnn)`, `displayTopPreset` = max preset_ann/plug/
   ideal_preset). Les recos One/One+ apparaissent en **vue repliée setlist
   + mode scène** mais PAS dans le bloc détaillé d'install de la fiche
   dépliée. À généraliser si besoin (~1-2h : étendre displayTopPreset +
   findInBanks + install buttons aux banks One/One+).
2. **Import/Export CSV** par device One/One+ : différé. Le `ExportImportScreen`
   `restrictToDevice` ne gère que 'ann'/'plug'. L'édition directe BankEditor
   + reset factory couvrent le besoin v1.
3. **HomeScreen** (recherche libre Accueil) : à vérifier s'il affiche aussi
   les recos par device — non threadé banksOne/banksOnePlus (le fix v9.8.1
   ne couvre que ListScreen/setlists). Si HomeScreen montre des recos
   device, ajouter le même threading.

### v9.7.42 — Fix Optimiseur source device-gated (avant le jalon One)

Bug : un user Anniversary-only voyait des captures Factory (firmware v2
Pédale classique) proposées à l'installation dans l'Optimiseur. Cause :
la règle "source dont le device requis n'est pas dans enabledDevices =
indisponible" (`SOURCE_REQUIRES_DEVICE`) n'existait que côté UI ProfileTab.
Le scoring/Optimiseur lisaient `availableSources` brut où Factory était
`true`/`undefined` (jamais `false` car la cascade ne se déclenche qu'au
TOGGLE). Fix : `effectiveAvailableSources(availableSources, enabledDevices)`
pur qui force `false` toute source device-gated absente. Dérivé une seule
fois dans main.jsx (après `const profile`, TDZ-safe) → tous les
consommateurs héritent de la règle sans threading.

---

## État précédent (2026-06-03 mardi soir, V9.7.41 — Méga-session perf batch fetchAI + payload Firestore)

**Backline v9.7.41 / SW backline-v444 / STATE_VERSION 14 / 1938 tests verts. Bundle 2904 KB.**

### Récap session perf 2026-06-03 soir — 9 versions livrées (v9.7.33 → v9.7.41)

Mesure initiale Sébastien : « 5 morceaux en 3min30 » (42s/morceau) avec
estimation UI menteuse à 8s/morceau. Cible : honnêteté + perf.

| # | Version | Sujet | Gain |
|---|---|---|---|
| 1 | 9.7.33 | Estimation honnête 8s → 40s/morceau (fix mensonge) | 0 |
| 2 | 9.7.34 | **Levier 1** : fetchAI mono-langue selon `profile.language` (regex transform `{"fr":...,"en":...,"es":...}` du prompt + stamp `_locale` + détection `localeStale` re-fetch) | -15% temps mesuré |
| 3 | 9.7.35 | Retry qualité 85→80 + retries 2→1 (déprécié par 9.7.36) | marginal |
| 4 | 9.7.36 | **Suppression retry qualité intelligent** : Phase 13.1 (correctif ref_amp ARTISTS) + 13.2 (boost amp family) corrigent à la source ce que le retry compensait empiriquement. Doublement redondant. | marginal mais propre |
| 5 | 9.7.37 | **Parallélisation batch concurrency 3** + chrono console détaillé (per-fetch ms + speedup ratio). Suppression jauge animée rAF v9.7.20 (plus de `[Violation] requestAnimationFrame`). | -67% temps |
| 6 | 9.7.38 | Concurrency 3 → 5 (mesure 9.7.37 : speedup 2.70x = 90% efficacité, Gemini scale presque linéairement) | -75% cumulé |
| 7 | 9.7.39 | Retry ciblé JSON parse (1 max). Cas observé v9.7.38 : Paranoid skip avec `Expected ',' or '}' after property value`. Distinct du retry qualité (supprimé) et quota 429 (câblé). | robustesse |
| 8 | 9.7.40 | **Levier 2** : split songMeta architecture (cross-profil via `shared.songDb[i].songMeta`) + cleanup payload A+B (drop 12 flags internes Phase 13 / clamp `ideal_top3` à 3 entries). | -600 KB payload |
| 9 | 9.7.41 | Fix estimation UI parallèle : `ceil(N/5) × 33s` au lieu de `N × 40s` séquentiel | UI honnête |

### Mesures mesurées (chrono console v9.7.37+)

| Batch | Wall-clock | Per-fetch avg | Speedup | Efficacité |
|---|---|---|---|---|
| 3 morceaux | 36.1s | 32.5s | 2.70x | 90% (sur 3) |
| 6 morceaux (référence pré-optims) | 3min25 | 34.2s | 1.0x | 100% (séquentiel) |
| 13 morceaux | 1min45 | 32.5s | 3.73x | 75% (sur 5) |
| 16 morceaux | 2min15 | 34.3s | 4.07x | 80% (sur 5) |
| 21 morceaux | 2min40 | 33.1s | 4.34x | 86% (sur 5) |

**Per-fetch Gemini Flash incompressible** : ~32-35s par fetch.
**Bottleneck restant** : latence intrinsèque Gemini Flash, pas le code Backline.

### Gain payload Firestore (Levier 2 v9.7.40)

| Avant | Après v9.7.40 |
|---|---|
| **940 KB** (à 4% du mur SAFE_LIMIT 980 KB) | **336 KB** (à 65% sous le mur) |

Warning `Payload XXX KB approche la limite 1 MB` disparu. ~600 KB de
marge libérée — beaucoup plus qu'attendu (estimation initiale 50-90 KB).

Surprise positive probable : le split songMeta (C) a migré progressivement
beaucoup d'analyses vers `shared.songDb[i].songMeta` au fil des nouveaux
fetches. Le cleanup A (12 flags) + B (clamp top3) a grattté au push.
Combiné : effet structurel énorme.

**Phase 9.7.42 perf inject prompt** (utiliser songMeta cached comme input
du prompt fetchAI → réduit output Gemini ~30%) **devient OPTIONNELLE** —
le payload n'est plus le bottleneck. À activer uniquement si gain perf
supplémentaire désiré (passer de 33s → ~22s par fetch).

### Architecture Levier 2 (v9.7.40)

```
shared.songDb[i] {
  ..., songMeta?: {
    result: {              // 14 champs factuels morceau cross-profil
      song_year, song_album, song_key, song_bpm, song_style,
      song_desc, cot_step1,
      tonal_school, target_gain, pickup_preference,
      ref_guitarist, ref_guitar, ref_amp, ref_effects
    },
    locale,                // langue de l'analyse
    ts                     // pour LWW Firestore
  }
}

profile.aiCache[songId] {  // per-profil, déjà existant
  ..., result: {           // champs RigReco uniquement (post-split)
    cot_step2_guitars, cot_step3_amp, cot_step4_score,
    ideal_guitar, guitar_reason,
    preset_ann_name, preset_plug_name, preset_tmp,
    preset_ann, preset_plug, ideal_preset, ideal_preset_score, ideal_top3,
    preset_settings_v1, tweaks, fx_blocks, playing_hints,
    settings_preset, settings_guitar,
    bass_recommendation, guitar_amp_settings, pedalboard_settings
  }
}
```

**Helpers purs** (`src/app/utils/ai-helpers.js`, +6 exports) :
- `SONG_META_KEYS` constant (14 champs)
- `INTERNAL_FLAGS` constant (12 flags Phase 13 à drop au push)
- `splitResultByMeta(result) → {meta, rig}` pure
- `mergeMetaIntoResult(meta, rig) → result` pure
- `cleanInternalFlags(result) → result` pure
- `clampIdealTop3(result, max=3) → result` pure

**Câblage main.jsx** :
- `setSongAiCache(songId, value)` : split au write
  - `value.result` → `splitResultByMeta` →
    - `meta` → `setSongDb` qui écrit `shared.songDb[i].songMeta`
    - `rig` → `setProfiles` qui écrit `profile.aiCache[songId].result`
- `songDbWithProfileCache` useMemo : merge au read
  - `mergeMetaIntoResult(s.songMeta?.result, profEntry.result)`
  - Caches existants pré-v9.7.40 ont tout dans `profile.aiCache` →
    fallback antérieur préservé

**Migration douce** :
- Aucun bump STATE_VERSION
- Champ `shared.songDb[i].songMeta` additif optional
- Caches existants fonctionnent inchangés via fallback du useMemo
- Le split s'applique aux NEW fetchAI au fil de l'eau

**`stripAiCacheForSync` étendu (state.js)** :
- Drop 12 flags internes du profile.aiCache actif au push
- Clamp `ideal_top3` à 3 entries (rétro-compat caches existants avec 10+)
- Pas de duplication avec ai-helpers : helpers inline `_cleanCacheEntry`
  pour découpler state ↔ ai-helpers

### Parallélisation batch (v9.7.37/38)

`src/app/screens/ListScreen.jsx` `analyzeMissingAll` :

```js
const CONCURRENCY = 5;
const worker = async () => {
  while (!analyzeCancelRef.current) {
    const myIdx = nextIdx++;
    if (myIdx >= total) return;
    const s = missing[myIdx];
    // ... fetchAI + persist + status update
  }
};
await Promise.all(Array.from(
  { length: Math.min(CONCURRENCY, total) },
  () => worker(),
));
```

Pattern N workers concurrents qui se distribuent une queue partagée via
`nextIdx`. Cancel : `analyzeCancelRef.current = true` interrompt les
NOUVEAUX fetches, les in-flight finissent normalement.

**Status format `{completed, total, inFlightCount}`** au lieu de
`{current, total, songTitle}` (parallèle = plusieurs songs en cours).
Rendu bouton cancel : "X% · completed/total · N en cours ⏸".

**Suppression jauge animée rAF (v9.7.20)** : avec parallèle concurrency 5
la progression avance par paliers naturels rapprochés. Plus besoin
d'interpoler entre paliers — `transition: width 0.3s ease-out` CSS
suffit. Bonus : supprime les centaines de `[Violation] requestAnimationFrame
handler` qui polluaient la console.

### Chrono console détaillé (v9.7.37)

À chaque batch :
```
[batch] analyzeMissingAll: N morceaux, concurrency 5
[batch] X/N "titre" — Yms       (par fetch)
[batch] TOTAL: Zs wall-clock · N fetches
[batch] Per-fetch: min Xms · avg Yms · max Zms
[batch] Speedup vs séquentiel : Wx (sum fetches Xs / wall Ys)
```

Permet diagnostic précis :
- Latence Gemini Flash réelle (avg fetch)
- Efficacité concurrence (speedup / concurrency)
- Identifier les morceaux problématiques (max bien au-dessus de avg)

### Quota Gemini Free Tier

- Limite : 20 RPM (Requests Per Minute), 1500 RPD (Per Day)
- Concurrency 5 + fetch ~33s : ~9 fetches/min en steady state → bien sous quota
- 30 morceaux à concurrency 5 = ~9 RPM avg → reste sous 20
- Retry quota 429 Phase 7.52.17 reste câblé en backup

### Estimation UI (v9.7.41 fix)

Formule corrigée : `ceil(N / CONCURRENCY) × SEC_PER_WAVE`
avec `CONCURRENCY = 5` et `SEC_PER_WAVE = 33`.

| N morceaux | Avant (séquentiel 40s) | Après v9.7.41 (parallèle ceil/5×33s) | Réel mesuré |
|---|---|---|---|
| 1 | 40s | 33s | ~30s |
| 6 | 4 min | 1 min | 36s |
| 16 | 11 min | 2 min | 2min15 |
| 30 | 20 min | 3 min | ~3min15 |
| 60 | 40 min | 7 min | extrapolé ~6min30 |

**3 sites à jour** : `missingDurationStr` helper + 2 confirms (analyser/
MAJ toolbar + bandeau fingerprint-stale) + 2 confirms MonProfilScreen
(invalider mes caches IA + admin invalider tous).

### Phase 9 — Famille perf désormais close + Levier 2 architecture posée

Cf section "Idées en attente" pour Phase 9.7.42 perf inject prompt (gain
output Gemini ~30%) — **plus prioritaire car le mur payload est très
loin maintenant**. À activer si signal user.

---

## État précédent (2026-06-03 mardi midi, V9.7.28 — Phase 13 close + polish UX fiche dépliée)

**Backline v9.7.28 / SW backline-v431 / STATE_VERSION 14 / 1919 tests verts. Bundle 2900 KB.**

### Récap session 2026-06-02 → 2026-06-03 — 15 deploys prod

| # | Version | Sujet |
|---|---|---|
| 1 | 9.7.14 | Label guitare COMPLET + cadre vert pleine largeur mobile (vue repliée) |
| 2 | 9.7.15 | Phase 13.0 + 13.1 — Schema ARTISTS + helpers + 20 seed + post-process correctif `ref_amp` |
| 3 | 9.7.16 | Phase 13.5 v1 — Cowork batch +224 artistes 60s-90s (60s/70s/80s/90s) |
| 4 | 9.7.17 | Phase 13.5 v2 — Densification +41 (bassistes + niches Doors/Beach Boys/Don Felder) |
| 5 | 9.7.18 | Phase 13.2 — Boost amp family V9 dégressif (anti-Bonamassa via confidence high/medium/low) |
| 6 | 9.7.19 | Bonus seed manuel : Louis Bertignac (Téléphone) — non couvert par Cowork anglo-saxon |
| 7 | 9.7.20 | Jauge animée Niveau 2 batch fetchAI (interpolation rAF + titre morceau courant) |
| 8 | 9.7.21 | Phase 13.1.1 — Injection setup ARTISTS dans le prompt fetchAI (anti-hallucination prose) |
| 9 | 9.7.22 | Noms longs guitares partout (revert short Phase 7.85 P0-04) + cadre wrap |
| 10 | 9.7.23 | Tentative cadre compact (revert immédiat 9.7.24) |
| 11 | 9.7.24 | Cadre vert étiré pleine largeur + padding aéré 4px 10px (compatLabelStyle) |
| 12 | 9.7.25 | Alternatives catalogue wrap + emojis source retirés (no-emoji UI Phase 7.85) |
| 13 | 9.7.26 | Scoring preset + Alternatives en 3 lignes claires (L1 cadre / L2 nom tech + pack / L3 install) |
| 14 | 9.7.27 | Homogénéisation police ligne 2 (tout en mono dim) |
| 15 | 9.7.28 | Phase 13.4 — UI admin Artistes (CRUD) + cascade overrides sync + fix cadre header ListScreen |

### Phase 13 — ✅ CLOSE à 100% (sauf dette optionnelle 13.6/13.7)

| Sous-phase | Status | Version livraison |
|---|---|---|
| **13.0** — Schema ARTISTS + helpers + 20 seed test | ✅ | 9.7.15 |
| **13.1** — Post-process correctif `ref_amp` (anti-hallucination) | ✅ | 9.7.15 |
| **13.1.1** — Injection setup ARTISTS dans prompt fetchAI | ✅ | 9.7.21 |
| **13.2** — Boost amp family V9 dégressif (anti-Bonamassa) | ✅ | 9.7.18 |
| **13.3** — Pré-filtrage catalog selon artiste | ❌ Inapplicable (le prompt n'envoie pas le catalog complet, optimisation théorique sans effet réel) |
| **13.4** — UI admin "🎭 Artistes" CRUD + sync Firestore LWW | ✅ | 9.7.28 |
| **13.5 v1** — Cowork batch ~224 artistes 60s-90s | ✅ | 9.7.16 |
| **13.5 v2** — Densification +41 (bassistes + niches) | ✅ | 9.7.17 |
| 13.6/13.7 — Queue runtime `pendingArtists` + UI processing | ⏳ dette optionnelle |

**Base ARTISTS finale** : 286 artistes (20 seed Phase 13.0 + Louis Bertignac ajout manuel + 224 Cowork v1 + 41 Cowork v2). Cascade lookup core/artists.js : `ARTISTS_SEED + shared.artistsOverrides` (admin runtime edits).

**Effet validé sur Flipper (Téléphone, 1977)** avant/après ré-analyse Phase 13.1.1 :
- `preset_ann` : Fender Tweed Bassman 22B → **TSR Sons Amp - Hi G Plexi 0B** ✅
- `preset_plug` : (inconnu) → **Marshall JTM45 5B** ✅
- `cot_step3_amp` profil ampli : "Tweed comme Fender Bassman" → "Marshall Super Lead (Plexi) 100W" ✅
- `cot_step1` profil tonal : "Bassman saturation naturelle" → "Marshall nerveux, Super Lead poussés à bout" ✅
- Refs : "SG Junior / Strat · Super Lead 100W" → "Strat '60s · Super Lead 100W · TS-9, DS-1" ✅

**Cas Bruno Blink-182** : test Vitest dédié confirme que "Marshall JCM800 halluciné" est désormais corrigé en "Mesa Boogie Dual Rectifier" via Phase 13.1 + ARTISTS Cowork v1.

### Polish UX fiche dépliée (v9.7.22 → 9.7.27)

Restructure visuelle du bloc Scoring preset + Alternatives catalogue :
- **3 lignes claires** (au lieu de mélange flex inline + flexWrap) :
  - L1 : cadre vert amp **étiré pleine largeur** + pill score à droite (`flex: 1` direct)
  - L2 : nom technique mono dim + pack (homogène font mono partout)
  - L3 : état installation + bouton Installer
- **Cadre vert guitare** : noms COMPLETS partout (Gibson Les Paul Standard '60s, Fender Stratocaster American Vintage II 1961). Plus de troncature ellipsis (wordBreak break-word + wrap si déborde).
- **`compatLabelStyle` padding** harmonisé `4px 10px` (au lieu de `2px 8px`) sur SongDetailCard ET ListScreen → texte respire mieux, cohérence desktop + mobile.
- **Emojis source retirés** dans la fiche dépliée (📦/🎚/🌐/🏭 supprimés du rendu, SOURCE_INFO data inchangée — règle no-emoji UI Phase 7.85).
- **Pill score** harmonisé `padding 4px 10px / minWidth 48`.

### Jauge animée batch fetchAI (v9.7.20)

Le bouton "🤖 Analyser/MAJ N" pendant un batch ré-analyse devient une mini progress bar :
- Barre wine animée (background gradient `width: pct%`)
- Animation **interpolation rAF** pendant l'attente Gemini (~15s par morceau, ease-out) — la barre bouge même quand Gemini réfléchit
- Plafond 95% du segment pour ne pas "tricher" visuellement avant que le morceau soit vraiment fini
- Snap au vrai % quand fetch finit (re-trigger useEffect)
- Affichage `{pct}% · {current}/{total} · {titleTruncated} ⏸`
- minWidth 180 / maxWidth 320 pour rester lisible sur iPhone 375px

### Architecture cascade ARTISTS (Phase 13.4)

```
core/artists.js :
  - ARTISTS_SEED (read-only depuis data/artists.js)
  - _artistsRuntimeOverrides (state module, posé par setArtistsRuntimeState)
  - getEffectiveArtistsMap() : merge ARTISTS_SEED + overrides
  - _getEffectiveBandMap() : reconstruit band → ids à la volée si overrides
  - Helpers utilisent la cascade : getArtist, findArtistsByBand, inferUsagesFromAmp
  - mergeArtistsOverridesLWW(local, remote) : LWW per-item

main.jsx :
  - useState sharedArtistsOverrides (initialisé depuis localStorage)
  - useEffect → setArtistsRuntimeState(sharedArtistsOverrides) à chaque changement
  - syncHash inclut sharedArtistsOverrides
  - Push Firestore inclut shared.artistsOverrides
  - applyRemoteData merge LWW per-item au pull

AdminScreen → ArtistsAdminTab.jsx :
  - Liste filtrable + compteur (total / overrides actifs / entries masquées)
  - "+ Nouvel artiste" : modal JSON template (auto-génère id depuis name)
  - Edit per row : modal JSON
  - Restaurer (seed override) : delete override → seed reprend la main
  - Masquer (seed) → tombstone artist=null
  - Supprimer (override seul) → delete direct
```

Schema additif, pas de bump STATE_VERSION (slot `shared.artistsOverrides` optionnel, fallback `{}` si absent).

### Cas Phase 13.6/13.7 reportés (dette optionnelle)

Détection runtime des artistes inconnus à l'ajout d'un morceau + queue admin pour processer via Cowork batch ponctuel. Aujourd'hui couvert manuellement via Phase 13.4 UI admin (Sébastien ajoute les artistes manquants au fil de l'eau). À activer si beta scale et si la queue accumule beaucoup de signal.

---

## État précédent (2026-06-01 lundi, V9.7.13 — Phase 7.74.13 défense+timestamp cohérence)

**Backline v9.7.13 / SW backline-v416 / STATE_VERSION 14 / 1837 tests verts. Bundle 2675 KB.**

### v9.7.13 — Phase 7.74.13 fix incohérence défense+timestamp (post-mortem bug iPad)

Session 2026-06-01 a révélé un bug latent Phase 7.74.12 : sur l'iPad
Sébastien après wipe + reload, on observait `myGuitarsModified =
Mac's stamp 08:53` MAIS `myGuitars = local pollué` (13 entries avec
sg61 + sire_t7 + sire_t3). Incohérence permanente : le pull suivant
ne pouvait plus re-tester la défense (rts_g <= lts_g post-stamp) →
pollution durable.

**Cause** : dans `mergeProfileLWW`, les 2 branches (`rts > lts` et
`rts <= lts`) updateaient `myGuitarsModified = rts_g` (ou `Math.max`)
même quand `mergeMyGuitarsWithDefenses` retournait `local.myGuitars`
parce qu'une défense Couche 3 (drop ≥3) ou Couche 4 (swap
cg_*→standard) avait bloqué l'adoption. Résultat : timestamp "adopté"
mais données rejetées.

**Fix Phase 7.74.13** :
- **`mergeMyGuitarsWithDefenses` retourne `{ guitars, blocked: boolean }`**
  au lieu d'un array. `blocked = true` quand Couche 3 ou Couche 4
  retiennent local entièrement. `blocked = false` pour adoption
  complète OU partielle (filter orphan reste considéré comme
  adoption pour le timestamp).
- **Branche `rts <= lts`** : `perFieldChanges.myGuitarsModified =
  r.blocked ? lts_g : rts_g` (au lieu de toujours `rts_g`).
- **Branche `rts > lts`** : `merged.myGuitarsModified =
  myGuitarsDefenseBlocked ? lts_g : Math.max(lts_g, rts_g)` (au lieu
  de toujours `Math.max`).

7 nouveaux tests Vitest dont :
- **Scénario bug iPad 2026-06-01 reproduit** (branche `rts<=lts` +
  Couche 3 BLOCK + `myGuitarsModified=0` post-block au lieu de `5000`)
- Branche `rts>lts` Couche 3 + Couche 4 swap
- Adoption clean → stamp remote (régression)
- Filter orphan (adoption partielle) → stamp remote
- **Séquence post-fix** : après un BLOCK, le 2e merge avec données
  raisonnables peut re-adopter (pollution n'est plus permanente).

Limite : non rétroactif. Si un device a déjà un `myGuitarsModified`
"fantôme" stampé sans données adoptées (cas iPad Sébastien avant
v9.7.13), seul un toggle utilisateur ou un script console manuel
résout. Préventif pour futur.

**Bilan session 2026-06-01** :
- Pollution cross-device historique nettoyée manuellement via console
  sur 4 devices (Mac + iPhone + iPad Sébastien + iPad Arthur). Tous
  alignés à 11 guitares + Tele 51 + banks correctes.
- Source identifiée : iPad d'Arthur (state pré-Phase 7.74.9 avec
  banksModified=0 + pollution myGuitars sur le profil Sébastien
  stocké chez Arthur).
- Phase 7.74.12 v9.7.12 déployée (myGuitarsModified per-field LWW)
- Phase 7.74.13 v9.7.13 déployée (fix défense+timestamp post-mortem)
- 17 tests Vitest ajoutés sur la journée (10 Phase 7.74.12 + 7
  Phase 7.74.13). 1837 verts au total. Bundle 2675 KB.

### v9.7.12 — Phase 7.74.12 myGuitarsModified per-field LWW (fix pollution cross-device)

Bug observé Sébastien 2026-05-31 (9e occurrence pollution profile cross-mélange) :
iPad gardait Sire Larry Carlton dans `profile.myGuitars` malgré pulls Firestore
clean depuis Mac. Cause racine : `mergeProfileLWW` branche `rts <= lts` return
local en bloc (sauf aiCache Phase 7.81). Les défenses Couche 3/4/orphan (Phase
7.74.1/3/4) ne s'exécutaient QUE dans la branche `rts > lts`. Quand iPad bumpe
`profile.lastModified` pour une écriture autre (langue/source/...), sa myGuitars
polluée est conservée à vie.

**Fix Phase 7.74.12** (pattern Phase 7.74.9 banksModified / 7.74.10 lang/dev/src) :
- **STATE_VERSION 13 → 14**. `ensureProfileV14` + `migrateV13toV14` backfill
  `myGuitarsModified = 0`. Idempotent. Cohabitation v13/v14 safe.
- **`stampedProfileUpdate` (state.js) + `setProfileField` (main.jsx)** : stamp
  dédié `myGuitarsModified = Date.now()` quand field `myGuitars` écrit.
- **Helper `mergeMyGuitarsWithDefenses`** extrait (Couche 3 drop ≥3 + orphan-
  cross-profile + Couche 4 swap pattern cg_*→standard). Exporté + testé.
- **`mergeProfileLWW` branche `rts > lts`** : adopte remote myGuitars sauf si
  `lts_g > rts_g` strict (local stampé plus récent sur la dimension). Préserve
  comportement legacy (rts_g === lts_g === 0 → adopt remote).
- **`mergeProfileLWW` branche `rts <= lts`** : extension pour merger
  per-field si `rts_g > lts_g`. Couvre aussi au passage le même oubli
  structurel pour language/enabledDevices/availableSources (Phase 7.74.10
  qui n'avait pas étendu cette branche).
- **`makeDefaultProfile`** initialise `myGuitarsModified: 0`.

**Limite** : la pollution PRÉ-existante (caches v13 avec myGuitarsModified=0
des deux côtés) ne se résout pas automatiquement — il faut une action user
(toggle myGuitars) qui stamp le ts et propage. Préventif pour futur, pas
rétroactif. Sébastien a déjà décoché Sire sur iPad → propagation propre via
Phase 7.74.12 LWW.

10 tests Vitest ajoutés (scénario bug iPad, équivalence rts_g, block local,
legacy, stamp via stampedProfileUpdate, helper isolé). 1830 verts. Bundle
2675 KB. Migration safe v13→v14, no data loss.

### v9.7.11 — Layouts 2-cols iPad fiche dépliée (P2-A)

Audit Cowork P2-A : sections 1-col à 1024 CSS px gaspillent ~40% de
largeur (mesures à 640 CSS px exagéraient mais le principe tient). Focus
pragmatique : **les 2 tableaux les plus denses de la fiche dépliée
consultés ensemble**.
- Nouvelle classe utilitaire CSS `.ipad-2col` (`index.html`) : grid 1fr
  mobile, `1fr 1fr` à `min-width:720px` + `align-items: start`.
- **SongDetailCard guitare** (`playCtx.rig === 'tonex'`) : `eqSettingsCadre`
  + `FxBlocksCadre` wrappés dans `.ipad-2col`.
- **SongDetailCard basse** (idem rig tonex) : cadre EQ basse +
  `FxBlocksCadre` (bass_fx_blocks) wrappés dans `.ipad-2col`.

Mobile (<720) : empilement inchangé. iPad ≥720 : EQ à gauche, Effets à
droite, alignés en haut.

**Cas écartés après revérification** :
- Styles préférés en grid 2x3 : ce sont déjà des pills `flex-wrap`, elles
  tiennent naturellement à 1024px. Cowork mesurait à 640 (artifact).
- Cards Thème / Langue / Instruments (Préférences) : déjà `flex:1`, OK à
  1024 même si "spacieuses".

Utilitaire `.ipad-2col` réutilisable pour d'autres paires si besoin
(Scoring guitares + Scoring preset, etc.).

1820 tests. Bundle 2673 KB.

### v9.7.10 — Hit area CurationDot étendue (workflow B P1-G résiduel)

Suite décision P1-G (status quo densité BankEditor mais workflow tactile
OK) : audit de tous les déclencheurs cellules révèle que la **pastille
curation 6×6 px** était le pire trigger (workflow B : édition usages
artiste/morceau via PresetCurationModal).
- Wrap du dot visuel dans un `<span role="button">` avec `padding: 12px
  8px` + `margin: -12px -8px` → hit area ~30×22 px, espace inline
  occupé inchangé (visuel toujours 6×6).
- Pas de cassure de layout : `negative margin` annule l'inflation
  inline. Mode non-clickable inchangé (juste le dot 6×6 sans hit area
  étendue).
- 1820 tests verts. Bundle 2672 → 2673 KB.

Workflow A (cellule → PresetSearchModal ou sélection) inchangé ;
fonctionnel mais cellule reste sub-44 verticalement. Acceptable par
choix design (densité 150 cellules).

### v9.7.9 — Audit iPad Cowork sur compte réel : 3 batches (10 fixes)

Cowork a audité sur le compte Sébastien (admin) à 640 CSS px (Mac Retina
DPR=2). Le filtre signal/bruit a écarté les spurious (nav-desktop labels en
2 lignes, onglets profil/admin 2 rangées — tous résolus à 1024 CSS px du
vrai iPad Pro 13"). Les vraies issues : cibles tactiles <44px + Mode scène
sous-dimensionné + vide central Accueil.

**Batch 1 — Tactile critique (<44px) iPad** :
- Pills setlist inline onglet Morceaux : padding 5×12 → 10×14 + minHeight 44
- Bouton "← Sortir" LiveScreen : ajout `minHeight: clamp(44px, 5vw, 56px)`
  + fontSize min 13→14 + whiteSpace nowrap
- Chips Explorer (token `chip()`) : padding 4×8 → 10×12 + minHeight 40
  (cascade sur tous chip callers — pills filtre ampli, packs, etc.)
- CTA Accueil "Mode scène — {setlist}" : padding 10×18 → 14×18 + minHeight 52
  + fontSize 14→16 + `width: '100%'` (full-width, vs inline 234×38 avant)

**Batch 2 — Mode scène scène iPad** :
- Titre morceau : clamp(28, **7vw**, 72) → clamp(32, **8vw**, 96) — à
  1024 CSS px (iPad portrait) ~82px vs 72 avant ; à 1366 (iPad paysage)
  → 96px. Lecture scène à 1m enfin viable.
- Badge Wake Lock : code Phase 7.55.7 S1 présent mais emoji 🔒 → remplacé
  par NavIcon `lock` (compliance no-emoji UI). Visibilité dépend toujours
  de `wakeLockActive` (acquis seulement après mount LiveScreen via
  navigator.wakeLock).

**Batch 3 — Chips suggérés Accueil étendus au non-démo (P1-E + P2-D)** :
- `demoSuggestSongs` renommée `suggestSongs`, useMemo étendu : pour
  non-démo, surface 4 morceaux avec aiCache depuis la 1ère setlist
  non-vide du user. Comble le vide central iPad (~300-500px avant).
- Render dropable `isDemo && ...` → `suggestSongs.length > 0 && ...`.
- Bouton "Au hasard" inchangé fonctionnellement, pool source étendu.

Test `chip()` token mis à jour (padding + minHeight + nowrap). 1820 tests
verts. Bundle 2672 KB.

**Spurious filtrés** (640 CSS px artifact, OK à 1024 CSS px du vrai iPad) :
P1-F nav-desktop labels 2 lignes, P1-J onglets profil 2 rangées, P1-K
onglets admin 2 rangées, P2-B, P2-J. **Différé** : P1-G banks cells 20px
(décision design densité vs tactile, à discuter — 150 cellules × 44px
= 6600px de hauteur, infaisable). P2-A layouts 2-cols sur sections denses
à iPad (chantier dédié). P2-C bandeau fingerprint compact, P2-G version
14px illisible (cosmétique).

### v9.7.8 — Estimation de durée sur les boutons de recalcul

Demande Sébastien : voir le temps que prendra le recalcul AVANT de cliquer
(était seulement dans le confirm popup). Ajoutée dans 2 labels :
- Toolbar setlist active : "Analyser/MAJ N (~Xs|X min)"
- Bandeau Phase 9.9 fingerprint-stale : "Tout recalculer (N, ~Xs|X min)"

Helper inline `missingDurationStr` = base 8s/morceau (cohérent avec
analyze-confirm), <60s → "Xs", sinon "X min" arrondi (min 1). Trilingue
FR/EN/ES alignés. 1820 tests, bundle 2672 KB stable.

### v9.7.7 — P1-02 résiduel fixé (bouton OK ne déborde plus)

Vérif Cowork v9.7.6 : 15.5/16 closes. Seul résidu : à 375px, input
`minWidth:140` + gap + bouton OK fixe dépassaient le container (~33px
de débordement, OK rogné à droite).
- input `minWidth: 140 → 120`
- placeholder FR/EN/ES : retiré le "..." final ("Titre, artiste" au lieu
  de "Titre, artiste...") → 14 chars × ~7px ≈ 98px, tient sans tronquer
  dans un input 120px
- Calcul final : 120 input + 8 gap + ~55 OK ≈ 183px ≤ 199px container, ~16px
  de marge confortable

1820 tests, bundle 2672 KB stable. **16/16 issues de l'audit Cowork closes**
(les P2 iPad + P1-07 nav portrait restent reportés selon décision).

### v9.7.6 — Tour 2 audit Cowork : 4 résiduels traités

Rapport vérif Cowork v9.7.5 : 12/16 closes, 2 résiduels (P0-03 / P0-05 / P1-02),
1 régression P0-NEW (boutons Langue).
- **P0-03** (badge guitare ligne repliée) : `guitarLabel` (setlist-row-playlist.js)
  utilise désormais `guitar.short || guitar.name` au lieu de `guitar.name` long.
  Évite la cassure mid-mot de "Gibson SG Standard '61" sur 130px mobile. Cohérent
  avec le fix v9.7.5 P0-04 (GuitarSelect plain mode short).
- **P0-05** (badges scoring guitares cadre fiche dépliée) : résolution du nom
  court via `findGuitarByAIName(gt.name, guitars)?.short` au render. Fallback
  `cleanGuitarName(gt.name)` si pas de match (custom mal nommée par l'IA).
- **P1-02** (SongSearchBar placeholder "Titre, a") : input `minWidth:0` → `140`
  + bouton OK padding 22→16 et fontSize 17→15 + `minHeight:44` (HIG) +
  whiteSpace:nowrap. Libère de la place au placeholder.
- **P0-NEW** (régression boutons Langue Français/English/Español cassés
  syllabe par syllabe) : +`whiteSpace:'nowrap'` sur boutons + label div
  (mêmes que v9.7.5 boutons thème, oublié).

1820 tests verts. Bundle 2671 → 2672 KB.

### v9.7.5 — Fixes responsive audit Cowork (10 P0 + 6 P1 traités)

Rapport audit Cowork (Chrome MCP, 6 résolutions iPhone/iPad). Root cause
identifiée par Cowork sur les P0 mobile : `flex-shrink:1` + `white-space:normal`
+ `min-width:auto` → texte qui se découpe syllabe par syllabe sous 430px.

**Batch A — Root cause CSS (boutons inline + chips)** :
- `chip()` token (`src/app/styles/tokens.js`) → +`whiteSpace:'nowrap'` global
  (fixe P0-08 pills filtre ampli Explorer et tous les chip() callers).
- `SetlistsScreen.tabBtn` (tabs Setlists/Morceaux) → +nowrap (P0-01) ; idem
  compteur "8 morceaux" (P1-03).
- `ListScreen` toolbar 5 boutons (Guitares / Éditer / Analyser-MAJ / Cancel
  ⏸ / +) → +nowrap + bumps minHeight 36→44 (P0-02 + dette HIG passage).
- `PresetBrowser` tabs instrument haut niveau (Tous/Guitare/Basse) → +nowrap
  (P0-07) + label "QUEL SON CHERCHES-TU ?" +nowrap (P1-06).
- `MonProfilScreen` Préférences cartes Instrument(s) + boutons thème
  Sombre/Clair → +nowrap (P0-10).

**Batch B — Truncation / overflow** :
- `index.html` `.songrow-pl-meta-guitar .songrow-pl-guitar` :
  `word-break:break-word` (casse mid-mot syllabe) → `word-break:normal;
  overflow-wrap:break-word` (casse aux espaces, Phase 7.83 multi-line intent
  préservé). Fixe P0-03 badges guitare ligne repliée.
- `PresetBrowser` preset card name : single-line ellipsis →
  `-webkit-line-clamp:2` (2 lignes ellipsis). Fixe P0-09.
- `GuitarSelect` (mode `plain` SongDetailCard) : option text utilise
  `g.short || g.name` au lieu de `g.name` long → sélecteur natif iOS ne
  tronque plus. Fixe P0-04.
- `SongDetailCard` scoring guitares cadre : `overflow:hidden; minWidth:0`
  + description `overflowWrap:break-word`. Fixe P0-05.
- `index.html` `.songrow-pl-potards` : +`min-width:0; overflow-wrap:anywhere;
  white-space:normal` → ligne EQ wrap au lieu d'être amputée. Fixe P0-06.

**Batch C — P1 spécifiques** :
- `AppHeader` "Backline" : retiré `overflow:hidden; textOverflow:ellipsis`
  (8 chars, pas besoin de tronquer) + `flexShrink:0`. Fixe P1-01 ("Bac…").
- `HomeScreen` SongSearchBar input : +`minWidth:0` (flex bien fonctionnel,
  placeholder visible). Fixe P1-02.
- `SetlistsScreen` Morceaux row : flex wrapper +`minWidth:0` + titre/artiste
  ellipsis nowrap + bouton Supprimer `whiteSpace:nowrap; flexShrink:0`.
  Fixe P1-04.
- `DemoBanner` ✕ Quitter : minHeight 36→44 + padding 7→10 (iOS HIG).
  Fixe P1-05.

**Reportés** :
- P1-07 (iPad portrait nav format mobile) : décision design (nav latérale vs
  bottom), pas bug pur. Trigger : si signal user iPad portrait.
- P2-01/02/03 (zone vide accueil iPad, marges paysage, grid chips incomplet)
  : cosmétique iPad, pas bloquant.

1820 tests verts (CSS pur + props inline → aucun test ne casse).
Bundle stable 2671 KB.

### v9.7.4 — Kill RecapScreen + SynthesisScreen (code mort)

Constat : le flow récap/synthèse était **inaccessible** depuis Phase 7.71 (qui
a retiré les checkboxes + le bouton "Générer le récap"). `onNext` (déclencheur
vers `screen='recap'`) n'était plus jamais appelé, et `songs` (prop des 2 écrans)
dérivait de `checked` (cases cochées) elles aussi supprimées → écrans morts.
Décision Sébastien : on les tue.
- Supprimés : `RecapScreen.jsx` + `SynthesisScreen.jsx` + leurs imports + les 2
  branches de rendu (`screen==='recap'`/`'synthesis'`) + état `synth` + useMemo
  `songs` + entrées `recap`/`synthesis` de `mainScreens` + prop `onNext` (call
  sites + signatures ListScreen/HomeScreen/SetlistsScreen + threading).
- Conservé : `checked`/`onChecked` (ListScreen l'appelle encore pour reset au
  changement de setlist — concern checkbox séparé, toujours vide en pratique).
- Bundle 2689 → 2671 KB (-18 KB). 1820 tests (aucun ne référençait ces écrans).
- LiveScreen non touché (utilise `liveSongs`, pas `songs`).

### v9.7.3 — Fix layout contrôles basse (Jazz/Precision = pas de sélecteur)

Correction Sébastien : une Jazz Bass n'a PAS de sélecteur de micro — l'équilibre
manche/chevalet se fait via les **2 volumes**. Mon exemple de prompt v9.7.2 y
mettait à tort un `selector`. Corrigé : exemple Jazz Bass → `selector:""` +
instruction explicite "les basses Fender (Jazz, Precision) n'ont PAS de sélecteur
(selector=''), l'équilibre micros se fait par les volumes ; Jazz = 2 Vol (manche
+ chevalet) + 1 Tone ; Precision = 1 Vol + 1 Tone ; ne mets un selector non vide
que si le modèle a réellement un commutateur". `PickupControlsCadre` masque déjà
la ligne Sélecteur quand vide (aucune modif UI). Prompt seul → caches existants
à re-analyser. 1820 tests.

### v9.7.2 — Fix "Réglages micros" disparaissent au changement de basse

Bug Sébastien : changer de basse fait disparaître le cadre "Réglages micros".
**Cause racine** : le template JSON du prompt fetchAI ne mettait `controls` que
sur la **1ère entrée** de `cot_step2_basses` (et idem cot_step2_guitars) → Gemini
copiait l'exemple → seule la basse/guitare idéale recevait `controls`. Une basse
alternative sélectionnée → pas de controls → cadre masqué.
- **Prompt** : `controls` ajouté à la 2e entrée des exemples JSON (guitare ET
  basse) + instruction renforcée "OBLIGATOIRE sur CHAQUE entrée (idéale ET
  alternatives), l'user peut sélectionner n'importe quel instrument du rig".
- **Matcher robuste** : SongDetailCard remplace le `includes()` naïf du match
  basse par `findCotEntryForGuitar` (tokenization matchGuitarName, name-generic,
  déjà utilisé côté guitare) → un léger écart de nom ne rate plus le match.
- **Caches existants** : n'ont controls que sur la basse idéale → re-analyser
  pour peupler toutes les basses (prompt côté futur). UI pure + prompt → pas de
  bump STATE_VERSION. 1820 tests.

### v9.7.1 — Toggle setlist inline (onglet Morceaux des Setlists)

Demande Sébastien : ajouter facilement un morceau à une setlist dans l'onglet
Morceaux, avec le **même système que la recherche initiale** (HomeScreen) :
toggle sur chaque setlist. Avant, les pills toggle étaient **cachées derrière
un bouton "Setlists"** (expand via `expandedSongId`). Désormais elles sont
**inline, toujours visibles** par morceau (rangée de pills flex-wrap, ✓ vert
quand présent, clic = `toggleSongInSetlist`). Bouton "Setlists" + state
`expandedSongId` retirés. UI pure → pas de bump STATE_VERSION. 1820 tests.

### Phase 9.9 — Empreinte d'analyse + flag analyses incomplètes (v9.7.0)

Demande Sébastien : signaler les morceaux dont l'analyse IA est devenue
incomplète après un changement de profil (sources/amplis/pédales/instruments/
recoMode) ou antérieure aux dernières features (réglages micros/ampli/pédalier).
2 raffinements : **expliquer la raison** (pour décider) + **bandeau en haut de
setlist** pour les changements globaux (pas de pollution par ligne).

**Empreinte (`fingerprint`)** stockée dans l'aiCache au fetch :
`computeAnalysisFingerprint(profile)` (ai-helpers.js) = `{sources, amps, pedals,
instruments, recoMode}` (structuré, pas un hash → permet d'expliquer la raison).
`diffAnalysisFingerprint(stored, current)` retourne les dimensions changées,
`['legacy']` si pas d'empreinte stockée (analyse pré-feature). `updateAiCache`
stocke `opts.fingerprint`. Hors rig guitare (rigSnapshot) et basse (bassStale),
déjà couverts.

**ListScreen** :
- `isStaleSong` étendu : fingerprint mismatch → stale (alimente "Analyser/MAJ N").
- **Bandeau** en tête de setlist active (NavIcon `info`, zéro emoji) : raisons
  (union des dimensions changées, labels i18n) + count + bouton "Tout recalculer".
- **Bouton recalcul par ligne** (NavIcon `refresh`, nouvelle icône) dans le
  headline = header sticky (S9.14) → activable en **vue repliée ET dépliée**.
  Visible seulement si l'analyse du morceau est fingerprint-stale. `stopPropagation`
  (ne déplie pas). Recalcul **ciblé d'1 morceau** via `recalcSong(s)` (état
  `recalcingId`), analyse COMPLÈTE (passe basses/amplis/pédales).
- **Fix latent** : `analyzeMissingAll` + `improveAll` ne passaient PAS
  basses/amplis/pédales à `fetchAI` → recalcul incomplet pour bass_recommendation
  /guitar_amp_settings/pedalboard_settings. Corrigé (3 sites alignés sur
  SongDetailCard).

**Pas d'auto-recalcul** : l'auto-refetch SongDetailCard (rig/bass/scoring)
reste inchangé ; le fingerprint-stale est purement informatif → l'user décide.

Additif (champ aiCache optionnel) → pas de bump STATE_VERSION. +10 tests → 1820.
NavIcon `refresh` documentée (flèche circulaire, 27 icônes).

---

## État précédent (2026-05-29 vendredi, V9.6.0 — Réglages micros par instrument sélectionné)

**Backline v9.6.0 / SW backline-v402 / STATE_VERSION 13 / 1810 tests verts. Bundle 2683 KB.**

### v9.6.0 — Section "Réglages micros" par instrument (2026-05-29)

Retour Sébastien : une section dédiée de réglage des micros/contrôles par
morceau, propre à l'instrument SÉLECTIONNÉ (volume + tonalité + sélecteur,
plusieurs boutons selon le modèle), conseillée précisément par l'IA. Décision
(AskUserQuestion) : **maj instantanée** — l'IA pré-calcule par instrument du
rig en 1 analyse, le changement de liste met à jour sans re-fetch.

- **Modèle** : champ `controls` ajouté à chaque `cot_step2_guitars[i]` ET
  `cot_step2_basses[i]` : `{ selector, knobs:[{name,value}], why{fr,en,es} }`.
  L'IA adapte au layout réel du modèle (Strat 5 pos + 1 vol + 2 tone ; LP/SG
  3 pos + 2 vol + 2 tone ; Tele 3 pos + 1 vol + 1 tone ; Jazz Bass 2 vol + 1
  tone ; Precision 1 vol + 1 tone…). Additif → pas de bump STATE_VERSION.
- **`sanitizeControls`** (`ai-helpers.js`, exporté, +6 tests) : valide selector
  string + knobs {name, value coercé string, cap 6, drop sans name} + why
  trilingue. `enrichAIResult` sanitize `controls` sur chaque entrée cot_step2_*
  (flag `_controlsValidated`, idempotent).
- **Prompt fetchAI** : ÉTAPE 2 + template cot_step2_guitars/basses étendus avec
  `controls` + instruction layout par modèle. `controls.why` ajouté aux champs
  trilingues.
- **UI** : composant module-level `PickupControlsCadre` (NavIcon `sliders`,
  partagé guitare↔basse). Guitare : lit `chosenGuitarCot.controls` (déjà calculé
  l.310 via findCotEntryForGuitar). Basse : lit `selectedBassCot.controls`
  (match par nom dans cotBasses). Les deux se mettent à jour **instantanément**
  au changement de liste déroulante (g/gId / setSelectedBassId → re-render,
  0 re-fetch). Fallback : caches sans `controls` → ligne playing_hints existante.
- i18n EN/ES (`song-detail.pickup-controls` + `pickup-selector`). 1810 tests.

**Maj des sections au changement d'instrument (réponse à la question)** :
section micros → instantané (cot entry par instrument) ; preset → re-scoré
(fast-path) ; EQ/effets du preset → inchangés (peu dépendants de l'instrument).

### v9.5.1 — Vue repliée setlist adaptée au contexte basse (2026-05-29)

### v9.5.1 — Vue repliée ListScreen basse-aware (2026-05-29)

Suite v9.5.0 (bassiste pur possible) : la **vue repliée des setlists**
(ListScreen) affichait encore le badge guitare + preset guitare pour un morceau
joué à la basse. Désormais elle reflète le contexte de jeu.

- ListScreen : `getEffectivePlayContext(profile, song)` par morceau. Si
  `instrument === 'bass'`, la `rowData` est overridée : cellule instrument =
  basse idéale (`bass_recommendation.ideal_bass`) + score basse
  (cot_step2_basses[0] ou bass_alternatives[0]) ; cellule devices = capture
  basse top (`bass_alternatives[0]`, amp + bank/slot via findInBanks, rig=tonex
  uniquement) ; potards/FX vidés. Réutilise stripSlotPrefix + findInBanks +
  getEffectivePlayContext (tous testés). Pas de bump STATE_VERSION. 1804 tests.

**RecapScreen non touché** (décision) : c'est un outil de **ranking guitare de
session** (top3 guitares, guitare/morceau, presets). Un équivalent basse =
feature parallèle dédiée (ranking basses), pas un swap de badge. Pour un
bassiste pur (rig sans guitare) le récap s'affiche vide (non bloquant). À faire
en feature séparée si demandé.

### v9.5.0 — Choix d'instrument(s) de haut niveau (2026-05-29)

### v9.5.0 — Choix d'instrument(s) de haut niveau (2026-05-29)

Retour Sébastien : un réglage de haut niveau (Préférences) pour déclarer
guitariste / bassiste / les deux, qui **active ou non les onglets** du profil.
Rend le **bassiste pur** possible (la basse pouvait déjà être un instrument à
part entière v9.4.1, mais la guitare restait toujours présente).

- **Préférences → Section 0 "Instrument(s)"** : 2 cartes cochables Guitare +
  Basse (NavIcon flat), écrit `profile.instruments`. Garde-fou ≥1 instrument
  (impossible de tout décocher). Helper `toggleInstrument` (MonProfilScreen).
- **Gating onglets** : "Mes guitares" affiché si `instruments.includes('guitar')`,
  "Mes basses" si `includes('bass')`. `useEffect` de repli : si l'onglet actif
  devient masqué → retombe sur Préférences.
- **ProfileTab** : toggle "Je joue de la basse" + helper `toggleBassInstrument`
  RETIRÉS de l'onglet "Mes basses" (activation centralisée en Préférences) ;
  l'onglet affiche directement la liste des basses (n'apparaît que si bass coché).
- Comportement : guitariste → guitare seule ; bassiste pur (`['bass']`) →
  "Mes guitares" masqué, fiche song en contexte basse par défaut
  (`getDefaultPlayInstrument` Phase B) ; les deux → tout. `instruments` déjà
  dans le profileHash (sync) + déjà migré → pas de bump STATE_VERSION.
- i18n EN/ES (`preferences.section-instruments` + `instruments-hint`). 1804 tests.

**Hors scope (noté)** : ListScreen vue repliée / RecapScreen restent
guitar-oriented par défaut pour un bassiste pur (le besoin portait sur les
onglets du profil). Polish vue repliée bassiste = follow-up si demandé.

### v9.4.1 — Basse instrument à part entière + analyse tous morceaux (2026-05-29)

### v9.4.1 — Basse first-class + wording (2026-05-29)

Retour Sébastien sur l'activation basse (Mon Profil → Mes basses) : (1) la
basse doit être un **instrument à part entière** (peut être l'unique instrument
de l'utilisateur), pas un "aussi" secondaire ; (2) **analyse basse sur TOUS les
morceaux**, pas seulement les lignes "notables".

- Toggle "Je joue aussi la basse" → **"Je joue de la basse"** (FR/EN/ES).
- Hint reformulé : "instrument à part entière (principal ou unique) · analysée
  sur TOUS les morceaux · section dédiée" (retrait de "multi-instrument" +
  "ligne de basse notable"). Clé `bass-activate-hint-flat` traduite EN/ES
  (était fallback FR only).
- **Prompt fetchAI aligné** : la fonctionnalité retournait déjà TOUJOURS
  `bass_recommendation` (Phase 8.7), mais le header ÉTAPE 8 disait
  "conditionnelle" + commentaires "null si pas notable" (incohérents). Header,
  commentaires et `bassContextLine` réécrits : basse = instrument à part
  entière, reco pour CHAQUE morceau sans exception.
- Commentaire SongDetailCard section basse aligné. Pas de changement de logique
  (gating + bassStale inchangés), pas de bump STATE_VERSION. 1804 tests verts.

**Note** : un vrai mode bass-only (désactiver la guitare, `instruments:['bass']`)
n'est pas encore exposé — la guitare reste présente dans les onglets. Le
contexte de jeu Phase B permet déjà de jouer 100% basse par morceau. Toggle
guitare on/off = follow-up si demandé.

### v9.4.0 — LiveScreen multi-instrument (parité contexte de jeu Phase B/C) (2026-05-29)

### v9.4.0 — LiveScreen multi-instrument (parité contexte de jeu Phase B/C) (2026-05-29)

Le mode scène (`LiveScreen`) respecte désormais le **contexte de jeu**
(instrument × rig) et affiche les blocs basse/ampli/pédalier en plus de la
guitare/ToneX. Parité avec la fiche dépliée (SongDetailCard Phase B/C).

- `getEffectivePlayContext(profile, song)` lu par morceau → filtre les sections.
- **Badge contexte** read-only dans le header (instrument · rig, NavIcon flat),
  masqué si profil mono-instrument + mono-rig.
- **Section guitare** (playing_hints) gated `instrument === 'guitar'`.
- **Section basse** (`instrument === 'bass'`) : basse idéale + jeu (settings_bass)
  depuis `aiC.bass_recommendation`, style scène.
- **Cadre "Sur ton ampli"** (`rig === 'amp'`) : potards 0-10 (guitar_amp_settings
  guitare OU bass_recommendation.amp_settings basse).
- **Cadre "Sur ton pédalier"** (`rig === 'amp'` + guitare + pedalboard_settings).
- **Devices loop gatée par rig** : LiveBlock ToneX (deviceKey ann/plug) si
  rig=tonex, TMP si rig=tmp, aucun device si rig=amp (cadres ampli/pédalier
  prennent le relais).
- L'override par morceau (`song.playInstrument/playRig`) est respecté → swipe
  entre morceaux affiche le bon contexte par morceau.
- i18n EN/ES (`live.bass-section`, `live.amp-section`, `live.pedalboard-section`).
  Lecture seule de l'aiCache/profile → pas de bump STATE_VERSION. +5 tests → 1804.

Chantier rig multi-instrument **clos de bout en bout** (prép + fiche dépliée +
mode scène) : A → B → B.1 → réorg onglets (9.2) → pédalier (9.3) → LiveScreen (9.4).

### v9.3.0 — Phase C : pédalier physique (STEP 2) (2026-05-28)

### v9.3.0 — Phase C : pédalier physique (STEP 2) (2026-05-28)

Dernière phase du chantier rig multi-instrument. L'utilisateur déclare ses
pédales d'effet physiques (catalogue + ajout custom enrichi IA, comme les
amplis B.1), et l'IA recommande lesquelles activer + leurs réglages 0-10 par
morceau quand il joue sur ampli (rig = Ampli).

- **`core/pedals.js`** (nouveau) : `PEDAL_TYPES` (17 types) + `PEDALS`
  (17 pédales iconiques `{id, name, short, brand, type, knobs, refs}` :
  Tube Screamer, Klon, Big Muff, Rat, DS-1, Fuzz Face, CE-2, Phase 90,
  Carbon Copy, DD-3, Holy Grail, Dyna Comp, Cry Baby, POG…) + `PEDAL_BRANDS`
  + `findPedal` (lit `window.__allPedals`). +`pedals.test.js`.
- **`profile.myPedals` + `customPedals`** (défauts `[]`, makeDefaultProfile,
  additif — pas de bump STATE_VERSION).
- **`sanitizePedalSuggestion`** (`ai-helpers.js`) : valide la sortie IA (type
  ∈ PEDAL_TYPES fallback drive, knobs snake_case cap 6, refs trilingue). +tests.
- **`PedalSearchAdd.jsx`** (mirror AmpSearchAdd) : recherche IA Gemini +
  fallback manuel (dropdown type). Bloc "Mes pédales" dans l'onglet "Mes
  amplis & pédales" (catalogue par marque + customs + ajout IA).
- **`fetchAI`** : 17e param `pedals` + `pedalboardContextLine` (injecte
  "PÉDALIER PHYSIQUE DISPONIBLE" + demande `pedalboard_settings: [{pedal,
  enabled, settings:{<potard>:0-10}, why trilingue}]`). `enrichAIResult`
  valide (clamp 0-10, drop sans `pedal`, flag `_pedalboardValidated`).
- **SongDetailCard** : cadre **"Sur ton pédalier"** (NavIcon `sliders`), gated
  `playCtx.rig === 'amp'` + `myPedals` non vide + `pedalboard_settings` non
  vide, rendu après "Sur ton ampli". 2 call sites fetchAI passent `pedals`.
- **main.jsx** : `window.__allPedals` useEffect + profileHash += myPedals/
  customPedals. i18n EN/ES (`pedal-add.*`, `song-detail.pedalboard-block`,
  `profile-tab.my-pedals*`). +17 tests → 1799. Zéro emoji (NavIcon flat).

Chantier rig multi-instrument (A→B→C) **complet** : symétrie titres + amplis
trad (A) → contexte de jeu instrument×rig + filtrage (B) → ampli custom IA
(B.1) → réorg 6 onglets (9.2.0) → pédalier (C, 9.3.0).

### v9.2.0 — Réorg onglets Mon Profil (STEP 1 du chantier pédalier) (2026-05-28)

### v9.2.0 — Réorg onglets Mon Profil (STEP 1 du chantier pédalier) (2026-05-28)

Validé Sébastien. Clarifie instrument vs matériel, analogique vs numérique.
Les amplis (guitare Phase A + basse Phase 8), ajoutés sous les onglets
instruments, sont sortis vers un onglet matériel dédié.

**6 onglets cible** : Mon compte · Mes guitares (guitares seules) · Mes basses
(basses seules) · **Mes amplis & pédales** (analogique : amplis guitare +
basse, + pédales Phase C à venir) · **Mon matériel numérique** (ToneX + TMP +
banks + sources + presets custom) · Préférences.

- **ProfileTab** : sous-sections amplis guitare (ex-section guitars) + amplis
  basse (ex-section basses) extraites vers un nouveau branch `s === 'ampsPedals'`
  (amplis basse gated `instruments.includes('bass')`). Helpers (toggle/add/remove
  guitar+bass amps) déjà component-scope → JSX déplacée seulement.
- **MonProfilScreen** : tabBtn `ampsPedals` ajouté (NavIcon `amp`), `devices`
  renommé "Mon matériel numérique", `sources`+`custompacks` standalone retirés.
  Onglet `devices` empile désormais `MesAppareilsTab` + `ProfileTab section=sources`
  + `MyCustomPresetsTab`. Rétrocompat `normalizedInitTab` : `sources`/`custompacks`
  → `devices`.
- i18n EN/ES (`profile.tab.amps-pedals-flat`, `devices-flat` → "Mon matériel
  numérique", `profile-tab.amps-pedals-title/hint`). Pas de changement data,
  pas de bump STATE_VERSION. 1782 tests verts.

**STEP 2 (à venir, v9.3.0)** : Phase C pédalier physique (`core/pedals.js` +
`PedalSearchAdd` + `sanitizePedalSuggestion` + `pedalboard_settings` IA + cadre
"Sur ton pédalier" rig=amp).

### v9.1.2 — Ajout ampli custom enrichi par l'IA (Phase B.1) (2026-05-28)

### v9.1.2 — Ajout ampli custom enrichi par l'IA (Phase B.1) (2026-05-28)

Retour Sébastien : *"lors de l'ajout ampli custom, l'IA devrait le valider
comme fait sur un morceau"*. Avant, les formulaires custom amp (guitare Phase A
+ basse Phase 8) posaient des **defaults génériques** (knobs/channels/eq fixes)
→ l'IA per-morceau ne connaissait pas les vrais potards de l'ampli.

- **Nouveau composant `AmpSearchAdd.jsx`** (mirror `GuitarSearchAdd`,
  paramétré `instrument='guitar'|'bass'`) : recherche IA Gemini qui identifie
  l'ampli depuis son nom et en déduit marque / wattage / canaux / **vrais
  potards** / EQ / features / refs trilingue ; confirmation utilisateur ;
  fallback saisie manuelle (nom + marque + watt).
- **Helper pur `sanitizeAmpSuggestion(raw, instrument)`** (`ai-helpers.js`,
  exporté, +11 tests) : valide/normalise la sortie IA. knobs → snake_case
  lowercase dédupliqués cap 8 (cohérent catalog + rendu `k.replace(/_/g,' ')`),
  wattage clampé 1-2000 (défaut 50 guitare / 100 basse), channels/eq/features
  labels conservés, refs forcé trilingue. Fallback knobs par instrument si
  absents. null si pas de nom.
- **ProfileTab** : les 2 formulaires manuels remplacés par
  `<AmpSearchAdd instrument="guitar"/>` + `<AmpSearchAdd instrument="bass"/>`.
  `addCustomGuitarAmp`/`addCustomBassAmp` reçoivent désormais l'objet ampli
  enrichi (ajoutent juste l'id `cgamp_`/`camp_`). États form locaux retirés.
- **Pourquoi ça compte** : `fetchAI` sérialise `amp.knobs` dans le prompt
  morceau (ligne 230 `potards: ...`) → des potards précis = des réglages
  "Sur ton ampli" pertinents par morceau (au lieu des defaults génériques).
- i18n EN/ES (`amp-add.*`, 15 clés). +11 tests → 1782. Pas de bump
  STATE_VERSION (champs additifs sur customGuitarAmps/customBassAmps).

### v9.1.1 — Retrait badge "Idéal" header morceau (2026-05-28)

Retour Sébastien : le pill bucket compat ("Idéal/Bon/Limite") en haut à droite
du header morceau (row playlist ListScreen) "n'apporte rien" → retiré. Helper
mort `_compatPillProps` + CSS `.songrow-pl-topscore-pill` (3 règles) supprimés ;
`margin-left:auto` reporté sur `.songrow-pl-chevron` (garde le chevron à droite).
Le score chiffré + la couleur des libellés guitare/preset restent (l'info compat
est déjà encodée par la couleur + le % ailleurs). Note : le rig guitare
(ToneX/Ampli) + TMP étaient déjà câblés symétriquement à la basse dès v9.1.0
(getAvailableRigs ajoute 'tmp' si tonemaster-pro activé, 'amp' si myGuitarAmps
non vide) — le sélecteur rig apparaît dès que ≥2 rigs sont dispos pour
l'instrument actif (donc cocher Marshall Plexi/Blues Junior dans Mes amplis
guitare fait apparaître le switch ToneX/Ampli côté guitare).

### Phase B — Contexte de jeu (instrument × rig) + filtrage vue morceau (v9.1.0)

Première de 3 phases du chantier "rig multi-instrument" (A→B→C, cf
`/Users/sebastien/.claude/plans/misty-jumping-crayon.md`). Phase B résout le
"mur de blocs" de la fiche dépliée : l'utilisateur **déclare avec quoi il
joue** (instrument × chaîne de signal) et la fiche **n'affiche que les blocs
pertinents**.

**Modèle de données** (additif, pas de bump STATE_VERSION) :
- `profile.playInstrument: 'guitar'|'bass'` + `profile.playRig: 'tonex'|'tmp'|'amp'`
  (défauts globaux) + overrides `song.playInstrument`/`song.playRig` (mirror
  du pattern `outputContext` Phase 10).
- Helpers purs `core/state.js` : `PLAY_INSTRUMENTS`, `PLAY_RIGS`,
  `getAvailableRigs(profile, instrument)` (tonex si device ToneX activé, tmp si
  tonemaster-pro, amp si myGuitarAmps/myBassAmps selon instrument),
  `getEffectivePlayContext(profile, song)` → `{instrument, rig}` (priorité
  song > profile > défaut, defensive : 'bass' demandé sur profil mono-guitare
  → fallback guitar ; rig indispo → 1er dispo). +21 tests Vitest.

**UI sélecteur "Je joue"** (SongDetailCard, en tête de fiche, NavIcon flat,
style boutons outputContext) :
- Boutons Instrument (Guitare/Basse) — affichés seulement si profil
  multi-instrument.
- Boutons Rig dynamiques (ToneX/Tone Master Pro/Ampli) via getAvailableRigs.
- **Bandeau entièrement masqué si profil mono-instrument ET mono-rig** (zéro
  friction, vue identique à avant pour les profils simples).
- Click → `song.playInstrument`/`song.playRig` (override par morceau, pas de
  re-fetch — filtre d'affichage pur).

**Filtrage** :
- Section "Ma guitare" + "Recommandations guitare" : gated instrument === guitar.
- Section "Ma basse" + "Recommandations basse" : gated instrument === bass.
- Dans Recommandations : blocs ToneX (Scoring preset + EQ + effets) gated rig
  === tonex ; "Sur ton ampli" gated rig === amp ; bloc TMP (RecommendBlock)
  gated rig === tmp. Idem côté basse (Scoring preset/EQ/effets basse = tonex,
  amp_settings = amp). Scoring guitares/basses + dropdown + prose + Feedback
  toujours visibles (rig-agnostiques).
- **Infos morceau adaptatif** (retour Sébastien) : référence guitariste
  affichée si instrument === guitar, référence bassiste si instrument === bass
  (au lieu de toujours guitar-focus). Profils tonals (cot_step1/cot_step3_amp)
  restent (descriptifs du morceau).

**Sync** : `playInstrument`/`playRig` ajoutés au `profileHash` (main.jsx) →
push Firestore au changement. `song.playInstrument`/`playRig` voyagent avec
la song. Smoke test bass mis à jour (profil `playInstrument: 'bass'` pour
forcer le chemin basse, désormais instrument-gated). +18 tests → 1772.

**Hors scope (Phase C)** : pédalier physique (`core/pedals.js` +
`pedalboard_settings` IA + cadre "Sur ton pédalier" affiché quand rig=amp).

---

## État précédent (2026-05-28 jeudi, V9.0.0 — jalon multi-instrument, vue dépliée raccord guitare/basse)

**Backline v9.0.0 / SW backline-v392 / STATE_VERSION 13 / 1754 tests verts. Bundle 2636 KB.**

### V9.0.0 — Jalon multi-instrument (2026-05-28)

Passage **8.14.x → 9.0.0** validé Sébastien : marque l'ère multi-instrument
(intégration basse Phase 8 + symétrie + amplis traditionnels guitare/basse
Phase A). `APP_VERSION` est purement un libellé d'affichage (aucun parsing,
`STATE_VERSION` reste à 13, séparé) → bump cosmétique safe. Désormais on
incrémente le patch par deploy (9.0.1…), minors pour les gros jalons (9.1 =
Phase B contexte de jeu). SW CACHE garde son compteur (`backline-v392`).

### Reorg vue dépliée — raccord guitare/basse (v9.0.0)

Retours Sébastien sur l'ordre/cohérence des cadres :
- **Scoring guitares/basses sous le dropdown** de choix d'instrument (lié au
  choix). Helpers hoistés au scope composant (`scoringGuitaresCadre`).
- **Scoring preset AVANT Réglages EQ + Réglages effets** (guitare ET basse) :
  on choisit la capture, puis on règle. `eqSettingsCadre` hoisté.
- **Bass : bloc "Sur ta ToneX" retiré** (redondant avec "Scoring preset basse"
  qui affiche déjà capture + bank/slot + score — raccord avec le bloc guitare
  qui n'a pas de bloc ToneX séparé). Même style (pill bucket-color, vert =
  excellent) des deux côtés.
- Ligne "Sur ta {guitar} :" retirée (redondante avec dropdown + Scoring).
- Pas de bump STATE_VERSION (UI pure). 1754 tests verts.

Retour Sébastien : le Scoring est lié au choix d'instrument → le rapprocher
du sélecteur.
- **"Scoring guitares"** déplacé de la section "Recommandations guitare" vers
  "Ma guitare", juste sous la liste déroulante de choix de guitare. Helpers
  `cotInRig`/`compatLabelStyle`/`cleanGuitarName` + `scoringGuitaresCadre`
  hoistés au scope composant (réutilisés par les 2 sections).
- **"Scoring basses"** déplacé symétriquement sous le dropdown "Ma basse".
- Ligne "Sur ta {guitar} :" (rappel sous le bloc Sortie) **retirée**
  (redondante avec dropdown + Scoring juste au-dessus).
- Pas de bump STATE_VERSION (UI pure). 1754 tests verts.

**Note versioning** : décision V9.0.0 (jalon multi-instrument) en attente du
choix Sébastien — APP_VERSION est purement un libellé d'affichage (aucun
parsing, STATE_VERSION séparé à 13), bump safe quand validé.

### Phase A — Symétrie titres + amplis guitare traditionnels custom (v8.14.290)

Première phase d'un chantier "rig multi-instrument" en 3 phases (A→B→C, cf
`/Users/sebastien/.claude/plans/misty-jumping-crayon.md`). Phase A livrée :

- **Symétrie titres** : "Mon setup" → "Ma guitare", "Recommandations IA" →
  "Recommandations guitare" (parité avec "Ma basse"/"Recommandations basse").
  Sous-cadre interne "Recommandations" : titre + emoji 💡 retirés (collision +
  règle no-emoji). EN/ES déjà alignés.
- **Amplis guitare traditionnels** (mirror complet du pattern amplis basse
  Phase 8.1) : nouveau `core/guitar-amps.js` (Marshall Plexi + Fender Blues
  Junior + Deluxe/Twin Reverb + Vox AC30 + JCM800 + Mesa Dual Rectifier),
  **potards réels par ampli** (`knobs`). `profile.myGuitarAmps` +
  `customGuitarAmps`. UI sous-section "Mes amplis guitare" dans l'onglet Mes
  guitares (catalogue cochable + ajout custom), calquée sur les amplis basse.
  `window.__allGuitarAmps` + syncHash.
- **IA** : `fetchAI` 16e param `guitarAmps` + section "AMPLIS GUITARE
  TRADITIONNELS" + champ `guitar_amp_settings` (potards 0-10 de l'ampli réel
  coché, par morceau, parallèle à `bass_recommendation.amp_settings`). Validé
  dans `enrichAIResult` (clamp 0-10, flag `_guitarAmpValidated`). Câblé aux 2
  call sites SongDetailCard.
- **Affichage** : cadre "Sur ton ampli" (NavIcon `amp`, zéro emoji) dans
  Recommandations guitare, gated par ampli guitare coché + guitar_amp_settings.
- **Bonus** : retrait du "➕" emoji du form custom ampli basse existant.
- **Pas de backfill** profil admin (Sébastien coche Plexi + Blues Junior
  lui-même). Champs additifs → pas de bump STATE_VERSION. +12 tests → 1754.

**Hors scope (Phases suivantes)** : Phase B = contexte de jeu (instrument ×
rig) + filtrage de la vue morceau (masquer ToneX/ampli/TMP hors contexte) +
réharmonisation de l'ordre des sous-cadres. Phase C = pédalier physique
(`core/pedals.js` + `pedalboard_settings` IA + cadre "Sur ton pédalier").

---

## État précédent (2026-05-28, Étape 2 vague B basse + dropdowns + i18n EN/ES + UX cleanup)

**Backline v8.14.289 / SW backline-v389 / STATE_VERSION 13 / 1742 tests verts. Bundle 2620 KB.**

### Vague 4 i18n — cleanup + traductions EN/ES (v8.14.289)

- **Cleanup** : 115 anciennes clés à emoji **mortes** (0 référence,
  superseded par les call sites `-flat`) retirées de en.js + es.js.
- **Traductions** : les 110 clés `-flat` référencées n'étaient PAS dans
  en.js/es.js → visiteurs EN/ES voyaient le fallback FR. Traduites EN +
  ES (989 clés chacun). Les anglophones/hispanophones voient désormais
  les bons libellés (tabs, Explorer, Optimiseur, Maintenance, recap, etc.).
- Net : en.js/es.js passent de 994 → 989 clés (−115 mortes +110 flat).

### Fixes cohérence Scoring preset basse (v8.14.287 → 288)

- **v8.14.287** — Retrait du ★ dans les options du dropdown guitare en mode
  `plain` (le pill score à droite l'indique déjà ; RecapScreen legacy garde ★).
- **v8.14.288** — 2 fixes Scoring preset basse :
  1. **Strip préfixe position** : Gemini colle parfois "40B " dans le nom de
     capture (`"40B TSR - A-Peg Pro 4..."`) → `findInBanks` ratait → "Non
     installé" affiché à côté d'un "40B" trompeur (incohérence rapportée).
     Helper module-level `stripSlotPrefix` (ai-helpers.js, factorisé depuis
     `findSlotByName` Phase 7.56) appliqué dans `enrichAIResult` (données
     canoniques) ET à l'affichage SongDetailCard (couvre les aiCache déjà
     validés `_bassFieldsValidated` qui ne re-strippent pas). Bug `loc.col`
     (undefined) → `loc.slot` corrigé au passage.
  2. **Réordonnancement ToneX** : "Sur ta ToneX" (capture + bank/slot) remonté
     AVANT Réglages EQ basse + Réglages effets basse — les 3 blocs liés à la
     ToneX sont désormais groupés (Scoring basses → Scoring preset basse →
     Sur ta ToneX → Réglages EQ → Réglages effets), amp_settings + jeu après.
  - +5 tests (strip + stripSlotPrefix) → 1742 verts.

### Hotfix TDZ écran noir vue dépliée (v8.14.286)

Écran noir en prod sur la vue dépliée (v8.14.285) :
`ReferenceError: Cannot access 'it' before initialization`. Même classe que
le hotfix Phase 7.79.3b : `selectedBassScore` (IIFE exécutée à la déclaration)
lisait `cotBasses` déclaré PLUS BAS dans l'IIFE du bloc "Recommandations basse"
→ TDZ au render. Bug **runtime-only** invisible aux tests Vitest (helpers purs),
au build Vite minifié, ET au smoke test main.jsx (qui monte `<App/>` mais
n'atteint jamais la vue dépliée bass).

- **Fix** : remontée du bloc des champs bass (`cotBasses`/`bassAlts`/`bassEq`/
  `bassFx`/`bassCompatStyle`) AVANT les consts qui les consomment
  (`effectiveBassId`/`selectedBassScore`).
- **Garde-fou ajouté** : `src/app/screens/SongDetailCard.bass.smoke.test.jsx`
  — monte SongDetailCard sur le chemin basse complet (profil bass-actif +
  bass_recommendation avec cot_step2_basses/alternatives/EQ/FX). Aurait
  attrapé le TDZ (render throw → test rouge). +2 tests → 1737 verts.
- **Leçon** : tout `const`/IIFE qui consomme une variable doit être déclaré
  APRÈS elle. Cf piège Phase 7.79.3b (`docs/CASCADE.md`) — même cause.

### Homogénéisation listes déroulantes guitare ↔ basse (v8.14.285)

Retour Sébastien : *"je préfère le design de la liste déroulante basse vs
guitare. Tu peux homogénéiser ?"*. Le `GuitarSelect` (bordure verte/jaune
selon optimalité, fontSize fixe 13) divergeait du `<select>` basse sobre.

- **Prop `plain` ajouté à `GuitarSelect`** : bordure neutre `var(--a15)`
  (drop variation verte/jaune), `fontSize: clamp(12px, 1.35vw, 14px)`,
  `fontWeight: 600`. Activé par SongDetailCard "Ma guitare" (`plain={true}`).
  RecapScreen garde le style legacy (`plain=false` défaut, bordure
  verte/jaune + status text).
- **Ordre homogène** : les 2 lignes deviennent `[select flex:1] [pill score
  à droite]`. Guitare flip (le pill score passe de gauche à droite). Basse
  gagne un pill score (score de la basse sélectionnée depuis `cot_step2_basses`,
  fallback ★ si non noté), au lieu du seul ★.
- Pas de bump STATE_VERSION (purement UI).

### Dropdown sélection basse (v8.14.284)

Retour Sébastien post-v8.14.283 : *"je ne vois pas de liste déroulante pour
la basse (alors qu'il y en a une pour la guitare)"*. La section *Ma basse*
affichait la basse élue en texte statique au lieu d'un sélecteur (demandé en
vague A mais pas implémenté). Ajout d'une **liste déroulante** symétrique à
`GuitarSelect` :
- `<select>` listant `userBasses` (basses cochées du profil), option idéale IA
  suffixée "— idéale", étoile ★ si la basse sélectionnée est l'idéale.
- Choix persisté dans `setlist.basses[songId]` (symétrique à `setlist.guitars`,
  via nouveaux props `savedBassId` / `onBassChange` câblés depuis ListScreen).
  Inclus automatiquement dans le hash setlist (Phase 7.54.2 full JSON.stringify)
  → sync Firestore + LWW sans plumbing supplémentaire.
- **Pas de re-fetch au changement** (contrairement à la guitare) : `cot_step2_basses`
  contient déjà le scoring de toutes les basses du rig, le choix est purement
  "quelle basse je joue". Fallback gracieux (état local) si `onBassChange` absent.

### Étape 2 vague B — Symétrie scoring/EQ/FX basse (v8.14.283)

Sébastien : *"j'ai oublié scoring basse et scoring preset (basse)"* → scope
**symétrie complète** validé. Le bloc *Recommandations basse* (SongDetailCard)
reproduit désormais les 4 cadres du bloc guitare, sous la reason :

1. **Scoring basses** (`cot_step2_basses`) — classement du rig basse, scoring IA.
2. **Scoring preset basse** (`bass_alternatives`) — capture ToneX top (amp encadré
   + score + bank/slot) + alternatives catalogue.
3. **Réglages EQ basse** (`bass_preset_settings_v1`) — why global + boutons PRESET
   0-10. Gated par `capture_name` (null si ampli traditionnel seul). Contrairement
   à la guitare (table dropée S9.5 car redondante avec vue repliée), la basse n'a
   PAS de vue repliée → les valeurs PRESET sont affichées.
4. **Réglages effets basse** (`bass_fx_blocks`) — histogramme 5 blocs FX.

**Implémentation** :
- **Prompt fetchAI ÉTAPE 8** étendu : 5 champs ajoutés à `bass_recommendation`
  (`cot_step2_basses`, `bass_alternatives`, `bass_preset_settings_v1`,
  `bass_fx_blocks`, `ref_bass_effects`) + exemple JSON complet. `cot_step2_basses`
  + `bass_alternatives` toujours fournis ; EQ/FX conditionnels à `capture_name`.
- **Validation** `enrichAIResult` (ai-helpers.js) : nouveau bloc gated par flag
  `_bassFieldsValidated`. Réutilise `clampPresetSettings` / `clampFxBlocks`
  (device-agnostiques) sur les sous-objets bass + clamp léger scores
  cot_step2_basses / bass_alternatives (0-100, drop sans name).
- **UI** : composant partagé **`FxBlocksCadre`** extrait (histogramme FX) →
  réutilisé par guitare ET basse (DRY, ~95 lignes dédupliquées). 4 cadres bass +
  `ref_bass_effects` (IA prioritaire, fallback seed) dans Infos morceau.
- **bassStale étendu** (SongDetailCard + ListScreen `isStaleSong`) : détecte
  `bass_recommendation` présent mais sans `cot_step2_basses` (= aiCache pré-vague-B)
  → re-fetch auto au mount + inclus dans "Analyser/MAJ N". Re-batch sans clic manuel.
- Pas de scoring V9 local basse (décision Phase 8 — scores fournis par Gemini).
- Pas d'UI d'installation de capture bass (le rendu "Sur ta ToneX Bank X" suffit).
- +6 tests Vitest (validation bass) → 1735 verts. Pas de bump STATE_VERSION
  (champs additifs optionnels, rétro-compat).

---

## État UX cleanup (2026-05-28, CLOSE — emojis retirés de toute l'UI + composants Button/TabButton)

**Backline v8.14.282 / SW backline-v382 / STATE_VERSION 13 / 1729 tests verts. Bundle 2607 KB.**

### Session 2026-05-27/28 — 42 deploys cumulés (v8.14.240 → v8.14.282)

Continuation directe de la session du 2026-05-27 (Phase 8 V1 + 7.85
audit Cowork). 22 deploys aujourd'hui après v8.14.260 (détection bass
robuste TSR Bass Pack 1) :

| # | Version | Sujet |
|---|---|---|
| 1 | 8.14.261 | Fix isBassPreset A-Peg pattern TSR Ampeg Pro 4 |
| 2 | 8.14.262 | Fix isBassPreset détection robuste via entry.amp |
| 3 | 8.14.263 | Fix isBassPreset variants TSR avec/sans tirets via normalizePresetName |
| 4 | 8.14.264 | Fix doublon amp dans tuile preset (info.pack absent) |
| 5 | 8.14.265 | Masque pastilles HB/SC/P90 sur bass presets dans Explorer |
| 6 | 8.14.266 | Retrait pastilles HB/SC/P90 dans liste Explorer (option A validée) |
| 7 | 8.14.267 | **Vague 1 retrait emojis** : 7 icônes SVG flat sur 3 sites prioritaires |
| 8 | 8.14.268 | Fix recos basse manquantes pré-Phase 8.7 : détection bassStale + auto-refetch |
| 9 | 8.14.269 | **Vague A bass restructure** : Ma guitare/Ma basse + Recos guitare/Recos basse |
| 10 | 8.14.270 | **Vague 2 emojis (tabs)** : MonProfilScreen 8 tabs + AdminScreen 6 tabs |
| 11 | 8.14.271 | Vague 2 emojis : SongDetailCard + HomeScreen complets + ref bass Infos morceau |
| 12 | 8.14.272 | Vague 2 emojis : LiveScreen + ListScreen + RecapScreen + PBlock |
| 13 | 8.14.273 | **Vague 3 emojis** : MonProfilScreen sub-sections (MonCompteSection 54 emojis → 0) |
| 14 | 8.14.274 | Vague 3 : PresetBrowser fiches preset (25 emojis) + ctx.emoji ampli retiré |
| 15 | 8.14.275 | Vague 3 : device.iconId (4 catalogs + registry) → NavIcon `amp`/`sliders` sur 8 call sites |
| 16 | 8.14.276 | Vague 3 : Jam + Synthesis + ProfileTab + Landing + ProfilePicker (BacklineIcon) + ViewProfile |
| 17 | 8.14.277 | Vague 3 : MesAppareils + MyCustomPresets + ToneNet + ProfilesAdmin + AllUserPresets |
| 18 | 8.14.278 | Vague 3 : AdminPacks + Maintenance + ExportImport + BankOptimizer + PresetCurationModal + DemoBanner + ProfileSelector |
| 19 | 8.14.279 | Vague 3 : titre page "Explorer les presets" main.jsx → flat (dernier emoji UI) |
| 20 | 8.14.280 | **Button.jsx + TabButton.jsx** : composants partagés (5 variants × 2 sizes) |
| 21 | 8.14.281 | Migration Button : Mon compte + Préférences + Maintenance (25 boutons) + tabs unifiés |
| 22 | 8.14.282 | Uniformisation boutons : ExportImport + AdminPacks + ToneNet + MyCustomPresets + ProfileTab |

### Vague A bass restructure (v8.14.269) — symétrie partielle UI

Sébastien : *"renommer Recommandations IA en Recommandation guitare et
remettre les mêmes éléments pour la basse : recos, réglages eq, effets.
Renommer Mon setup en Ma guitare et mettre une liste déroulante avec
la sélection pour la basse aussi"*.

Étape 1 livrée (renommages + restructure visuelle) :
- 'Mon setup' → 'Ma guitare'
- 'Recommandations IA' → 'Recommandations guitare'
- Bloc Basse splité en 2 sections symétriques :
  - **'Ma basse'** : basse idéale élue (priorité bassReco match rig
    sinon 1ère basse cochée)
  - **'Recommandations basse'** : gated par bassReco présent
    (bass_reason + capture_name 'Sur ta ToneX' + amp_settings
    'Sur ton ampli' + settings_bass conseils de jeu)
- Ordre final fiche dépliée : Header → Ma guitare → Recos guitare →
  Feedback → Ma basse → Recos basse → Infos morceau
- Référence bassiste/basse/ampli/effets ajoutée dans **Infos morceau**
  bas de page (symétrique au guitariste). Source : aiC.bass_recommendation
  (ref_bassist/ref_bass_guitar/ref_bass_amp) en priorité, fallback
  bassHist seed.

**Étape 2 vague B en attente (~3-5h dev)** : symétrie complète scoring.
Extension prompt fetchAI : `cot_step2_basses` (ranking basses rig) +
`bass_alternatives` (catalog captures ToneX bass) +
`bass_preset_settings_v1` (knob settings ToneX bass) + `bass_fx_blocks`
(FX bass) + `ref_bass_effects` top-level. UI : Scoring basses + Scoring
preset basse + Réglages EQ basse + Réglages effets basse + Alternatives
catalogue basse. Re-batch coûteux post-déploiement.

### Détection bassStale (v8.14.268)

Sébastien : *"pourquoi je ne retrouve pas les recos basses sur tous
les morceaux ? Je ne veux pas limiter à 3 ou 4 morceaux"*.

Diagnostic : les aiCache calculés avant le fix Phase 8.7 (v8.14.257,
prompt assoupli) ont `bass_recommendation: null`. La section Basse
était gated `bassHist OU bassReco` → invisible sur les 25+ morceaux
hors seed.

Fix : détection bassStale similaire à rigStale Phase 5.10.2.

```js
userHasBassRig = profile.instruments inclut 'bass' ET ≥1 basse/ampli coché
bassStale = userHasBassRig ET aiCache existe ET bass_recommendation == null
```

**3 effets** :
1. **SongDetailCard** useEffect : à l'ouverture d'un morceau stale →
   re-fetchAI auto (1 seule fois — après fetch, bass_recommendation
   garanti non-null par prompt Phase 8.7 → plus stale).
2. **ListScreen** missingCount inclut les bassStale → bouton "🤖
   Analyser/MAJ N" affiche le total correct → re-batch d'1 clic.
3. Helper centralisé `isStaleSong` partagé entre missingCount et
   batch (DRY).

### Mini-fixes Explorer presets bass (v8.14.261 → 8.14.266)

Suite de retours user 28/05 sur la détection bass + UX Explorer :

- **v8.14.261** : Sébastien rapporte *"Des amplis Ampeg ne sont pas
  reconnus pour basse : TSR - A-Peg Pro 4 - Classic A DI..."*. Pattern
  `/^TSR A-Peg Pro/i` ajouté.
- **v8.14.262** : *"TSR-The-Bass-Pack-1-w8fa9b ne contient que des
  preset basses"* + *"TSR-Bass-Elliot-yp8vl7 aussi"*. Détection
  robuste via `entry.amp \bBass\b` (excluding Bassman/Bassbreaker =
  amplis GUITAR historiques). Couvre tous les amplis "Ampeg Bass",
  "GK Bass", etc. quel que soit le naming TSR.
- **v8.14.263** : Sébastien donne liste détaillée naming réel —
  `"TSR - A-Peg Pro 4 - Fretless DI"` (banks user, avec tirets) vs
  `"TSR A-Peg Pro 4 Fretless DI"` (catalog interne, sans tirets).
  Refactor isBassPreset : test sur `normalizePresetName(name)` qui
  strippe les tirets → variants matchent identiquement.
- **v8.14.264** : Doublon amp dans tuile preset quand `info.pack`
  absent (cas Factory BS ORNG). Fix : badge fallback conditionné sur
  `info.pack` seul + garde `info.pack !== info.amp`.
- **v8.14.265** : Pastilles HB/SC/P90 masquées sur bass presets dans
  Explorer (HB/SC/P90 = types pickups GUITARE, non pertinent basse).
- **v8.14.266** : Pastilles HB/SC/P90 retirées globalement (validation
  Sébastien option A) — la compat guitar est couverte par bloc
  'Guitares adaptées' qualitatif Phase 7.83 dans la fiche dépliée.

### Vague 2 retrait emojis — règle stricte

Sébastien clarifie 2026-05-28 : *"je n'aime pas les emojis, je veux
des visuels flat comme ceux de Accueil, Setlist..."* puis *"les seuls
emojis que je veux conserver sont dans le footer"*.

Règle stricte établie dans CLAUDE.md section "Iconographie" :
**JAMAIS d'emoji dans les éléments d'UI** (boutons, tabs, sectionTitles,
labels, badges). Utiliser exclusivement icônes SVG flat outline via
`src/app/components/NavIcon.jsx`.

Footer (`© 2026 PathToTone · Made with 🎸 and ❤️`) volontairement
conservé. Exceptions tolérées : prompts IA, docs markdown, données seed.

**Vague 1 (v8.14.267)** : 7 icônes + 3 sites prioritaires.
**Vague 2 (v8.14.270/271/272)** : +14 icônes (total 21) + 7 écrans.
**Vague 3 CLOSE (v8.14.273 → 279)** : +5 icônes (total 26) + TOUS les
écrans + composants restants. `device.iconId` (4 catalogs + registry)
→ NavIcon `amp`/`sliders`. Dernier emoji UI (titre page "Explorer les
presets" main.jsx) retiré v8.14.279. **L'UI est désormais 100%
emoji-free sauf le footer** (`© 2026 PathToTone · Made with 🎸 and ❤️`).

### Composants partagés Button / TabButton (v8.14.280 → 282)

Suite au constat Sébastien *"les boutons sont encore hétérogènes dans
l'onglet Mon compte. A voir dans les autres écrans aussi"* :

- **`src/app/components/Button.jsx`** : 5 variants (primary / secondary
  / ghost / danger / danger-ghost) × 2 sizes (md : padding 10×16,
  minHeight 44 ; sm : padding 6×12, minHeight 32). Props `{children,
  onClick, variant, size, iconId, disabled, title, testId, fullWidth,
  style}`. État disabled = bg-disabled + opacity 0.5 + cursor
  not-allowed. iconId optionnel → NavIcon inline.
- **`src/app/components/TabButton.jsx`** : bouton d'onglet unifié.
  Props `{active, label, iconId, onClick, testId}`. padding 10×14,
  fontSize 12, minHeight 44 (cible tactile iOS HIG), whiteSpace nowrap,
  boxShadow inset accent quand actif.

Migrés : MonProfilScreen (tabs → TabButton + Mon compte + Préférences
→ Button), AdminScreen (tabs → TabButton), MaintenanceTab (25 boutons,
0 `<button>` restant), ExportImportScreen, AdminPacksTab, ToneNetTab,
MyCustomPresetsTab, ProfileTab.

Cf section "Composants UI partagés" + "Iconographie" en tête de
CLAUDE.md pour le tableau des 26 icônes + l'historique des 3 vagues.

### Dette résiduelle session 2026-05-28

1. ~~**Vague 4 i18n cleanup**~~ ✅ FAIT (déployé v8.14.289). 115
   anciennes clés à emoji **mortes** (0 référence, superseded par les
   call sites `-flat`) retirées de en.js + es.js. Détection : valeur
   contient un emoji ET 0 référence dans `src/` hors i18n, en excluant
   les clés dynamiques `cascade.source-*`.
2. ~~**Gap traduction `-flat` EN/ES**~~ ✅ FAIT (déployé v8.14.289). Les
   110 clés `-flat` référencées dans les call sites n'étaient PAS dans
   en.js/es.js → les visiteurs EN/ES voyaient le fallback FR inline.
   Traduites EN + ES et ajoutées aux 2 dicts (989 clés chacun). Les
   visiteurs anglophones/hispanophones voient désormais les bons
   libellés. Bloc généré commenté "Vague 4 — traductions des clés -flat".
2. ~~**Étape 2 vague B bass complète**~~ ✅ LIVRÉE v8.14.283
   (cf section "Étape 2 vague B" en tête). Re-batch auto via bassStale.
3. **Propagation Button aux écrans restants** (opportuniste) :
   quelques `<button>` inline subsistent dans les écrans secondaires
   (BankEditor, AddSongModal, PresetCurationModal, FeedbackPanel…).
   À migrer au fil de l'eau quand on touche ces fichiers.
4. **Test visuel navigateur étape 2 bass** : le build compile et les
   tests passent, mais le rendu des 4 cadres bass n'a PAS été validé
   en navigateur (pas d'accès interactif). À vérifier au reload PWA
   post-déploiement sur un morceau bass-jouable.

---

## État précédent (2026-05-27 soir, Phase 8 complète — Intégration basse + UI Mon Profil + sync multi-device)

**Backline v8.14.253 / SW backline-v353 / STATE_VERSION 13 / 1729 tests verts.**

### Phase 8 livraison complète (6 sous-phases + 2 hotfixes, 6 deploys cumulés)

| Sous-phase | Version | Livrable |
|---|---|---|
| **8.1** Data layer (commit WIP `795cdaa`) | refactor-and-tmp | `core/basses.js` (8 modèles iconiques + 2 Sébastien : Jazz Bass Player Plus + Precision American Vintage II) · `core/bass-amps.js` (4 amplis trad : Fender Rumble 100 + Ampeg SVT + Markbass + Aguilar) · STATE_VERSION 12→13 avec `migrateV12toV13` additive · `profile.instruments` + `myBasses` + `customBasses` + `myBassAmps` + `customBassAmps` · 3 morceaux bass-jouables ajoutés au seed (Sunshine of Your Love · Under Pressure · I Love Rock 'n' Roll) avec `bass: {bassist, bass_guitar, bass_amp, effects}` dans SONG_HISTORY · 19 tests Vitest |
| **8.4** Prompt fetchAI étendu | v8.14.250 | Signature étendue `fetchAI(..., basses, bassAmps)` (params optionnels) · Section conditionnelle "COLLECTION DE BASSES" + "AMPLIS BASSE TRADITIONNELS" injectée si user a basses cochées · Nouvelle ÉTAPE 8 dans le prompt : Gemini retourne `bass_recommendation: {ideal_bass, bass_reason, ref_bassist, ref_bass_guitar, ref_bass_amp, amp_settings, settings_bass}` ou `null` si pas de ligne de basse notable · JSON template output mis à jour |
| **8.3** UI SongDetailCard | v8.14.250 | Nouveau helper `getSongBassHist(song)` retourne `SONG_HISTORY[song.id].bass || null` · Section "🎻 Basse" entre Feedback IA et Infos morceau · Gated par `profile.instruments.includes('bass')` ET (seed bass OU `aiC.bass_recommendation`) · Affichage hiérarchique : basse idéale + reason + Sur ton ampli {amp} avec amp_settings 0-10 + conseils de jeu prose + référence originale historique · 2 call sites fetchAI dans SongDetailCard mis à jour pour passer `basses` + `bassAmps` |
| **8.5** Hotfix fallback fuzzy match | v8.14.251 | `getSongBassHist` étendu : si song.id pas dans SONG_HISTORY, fallback fuzzy match par title normalisé dans INIT_SONG_DB_META. Couvre les songs custom (ex. Under Pressure ajouté pré-Phase 8.1 avec id `c_xxx` au lieu de `queen_underpressure`). Évite à user de patcher manuellement chaque song. |
| **8.6** UI Mon Profil bass toggle | v8.14.252 | Nouveau tab "🎻 Mes basses" dans `MonProfilScreen` entre "Mes guitares" et "Mes appareils". 3 sections empilées : toggle "🎻 Je joue aussi la basse" (modifie `profile.instruments`) + liste basses cochables (gated bass active) + liste amplis basse traditionnels cochables. Visible à tous (admin + non-admin, gated !isDemo). 8 nouvelles clés i18n EN/ES. |
| **8.6** Hotfix syncHash bass fields | v8.14.253 | `profileHash` (Phase 7.46) étendu avec 5 nouvelles dimensions : `instruments` + `myBasses` + `myBassAmps` + `customBasses` (futur) + `customBassAmps` (futur). Sans ce fix, le toggle "Je joue aussi la basse" ne déclenchait pas le push Firestore → modif restait locale (bug rapporté Sébastien). Désormais propagation correcte multi-device via LWW per-profile. |

### Validation end-to-end Phase 8 sur Under Pressure (Sébastien 2026-05-27 soir)

Re-fetchAI déclenché via feedback IA "test bass" → Gemini retourne `bass_recommendation` parfaitement structuré :
- **ideal_bass** : "Fender Precision Bass American Vintage II" (match exact ta basse cochée)
- **bass_reason** : "La ligne de basse de John Deacon est l'élément le plus reconnaissable du morceau. La Precision Bass apporte ce claquement et cette assise mythique."
- **amp_settings Rumble 100** : Gain 4 / Bass 6 / Low Mid 7 / High Mid 5 / Treble 4 / Master 6 / Channel Clean (cohérent rock 80s, low_mid bumpé pour faire chanter le riff 4 notes)
- **settings_bass** : "Joue aux doigts pour la rondeur, avec une attaque précise sur les cordes de Ré et Sol pour faire ressortir le riff."

Reco IA qualitative + techniquement actionnable. Phase 8.4 contrat respecté à 100%.

### Comportement utilisateur post-déploiement

- **Admin Sébastien** (profil v13 migré automatiquement au reload) :
  - `instruments` posé à `['guitar', 'bass']` (multi-instrument)
  - `myBasses` posé à `['jazz_bass_player_plus', 'precision_avri']` (2 Fender Sébastien)
  - `myBassAmps` posé à `['rumble_100']`
  - À l'ouverture d'une fiche song bass-jouable (Sunshine of Your Love, Under Pressure, I Love Rock 'n' Roll) → section "🎻 Basse" visible avec référence historique. Au prochain re-fetch IA (clic feedback ou "🤖 Analyser/MAJ") → l'IA peut retourner `bass_recommendation` avec amp_settings pour le Rumble 100.
- **Non-admin existants** (Bruno/Francisco/etc.) : `instruments=['guitar']` par défaut → comportement strictement inchangé. Pas de section basse visible (toggle bass désactivé tant que UI Mon Profil pas étendue Phase 8.6).

### Hors scope Phase 8 livraison du jour (notés pour Phase 8.x+ future)

- ~~**UI Mon Profil bass toggle**~~ ✅ LIVRÉ Phase 8.6 v8.14.252
- **Custom basses + custom bass amps** (~2-3h) : parallèle à `profile.customGuitars` + `customPacks`. UI dans tab "🎻 Mes basses" pour ajouter une basse hors catalog (ex. ESP, Schecter, Ibanez Gio bass, Bass Elliot TSR pour un futur beta-tester). Form + add/edit/delete + brand inference. À déclencher si un beta-tester signale "je veux ajouter ma basse hors catalog".
- **Scoring V9 dédié basse** (`core/scoring/bass.js`) : reporté. L'IA Gemini fait le scoring contextuel via prompt étendu — qualité MVP **validée Sébastien 2026-05-27** sur Under Pressure (reco Precision Bass + amp_settings Rumble 100 cohérents). À monitorer en pratique. Si signal user que les recos basse manquent de cohérence sur certains styles, Phase 8.7 ajouterait scoring local.
- **LiveScreen multi-instrument** : section basse dans le mode scène plein écran. Non implémenté V1.
- **HomeScreen fiche dépliée** : section basse non ajoutée V1 (seul SongDetailCard via Setlists vue dépliée affiche bass).
- **Pédales basse curées** : Compresseur Aguilar TLC, Octaver Boss OC-2, EBS MultiComp etc. Phase 8.8 si bandwidth.
- **Ampli traditionnel guitare + pédalier** : pivot Phase 13 séparée (non démarrée). Le pattern Phase 8.1 BASS_AMPS est réutilisable pour amplis guitare trad quand on l'attaque.

### Bilan tests + déploiements

- **1729/1729 tests verts** à chaque étape (zéro régression)
- Bundle 2565 → 2589 KB (+24 KB pour catalogs + UI sections + i18n + prompt étendu + tab bass + syncHash fix)
- **STATE_VERSION 12 → 13** (migration additive, idempotente)
- **6 deploys Phase 8** : v8.14.250 (V1 close 8.1+8.3+8.4+8.5) → 251 (hotfix fallback fuzzy) → 252 (UI bass toggle 8.6) → 253 (hotfix syncHash bass fields)
- Cohabitation v12/v13 sur Firestore : un device pré-Phase 8 reçoit un state v13 → ignore champs inconnus (`instruments` etc.) sans erreur. Un device post-Phase 8 reçoit un state v12 → `ensureProfileV13` au pull comble les champs.

### Récap session 2026-05-27 complète (12 deploys + 1 WIP)

| # | Version | Phase | Sujet |
|---|---|---|---|
| 1 | 8.14.240 | 7.85 batch 1 | tabs Mon Profil/Admin 44px + bug recherche démo + 4 P0 Cowork (B01 noms presets row 2, B02 Scoring Preset wrap, B03 Feedback IA column, B04 SongSearchBar maxWidth) + B07 Fermer ↑ + B20 input rename setlist |
| 2 | 8.14.241 | 7.85 batch 2 | retours user (alignement guitare vue repliée + inversion Mes guitares nom complet/court) + Lot B 11 touch targets 44×44 (chips Home + avatar header + toolbar + SORTIE + Mon Profil boutons) |
| 3 | 8.14.242 | 7.85 batch 3 | Lot polish P2 (banner desktop hauteur + nav top active state + version label + chips wrap + iPad banner) |
| 4 | 8.14.243 | 7.85 batch 4 | Lot A2 prose readable max-width 65ch + section card max-width 960 + CLAUDE.md État actuel update |
| 5 | 8.14.244 | 7.85 fontSize bump | fontSize prose vue dépliée morceau (retour user mobile densité) |
| 6 | WIP `795cdaa` | 8.1 | data layer basse (catalogs + migration v13 + 3 morceaux seed) — pas déployé prod |
| 7 | 8.14.250 | 8 V1 close | 8.1 + 8.3 UI section bass + 8.4 prompt fetchAI + 8.5 deploy prod |
| 8 | 8.14.251 | 8.5 hotfix | getSongBassHist fallback fuzzy match par title (Under Pressure custom id) |
| 9 | 8.14.252 | 8.6 | UI Mon Profil tab "🎻 Mes basses" (toggle + liste basses + amplis) |
| 10 | 8.14.253 | 8.6 hotfix | syncHash inclut instruments/myBasses/myBassAmps/customBasses/customBassAmps |

---

## État précédent (2026-05-27 soir, Phase 7.85 close — Audit responsive Cowork 4 batchs + retours user)

**Backline v8.14.243 / SW backline-v343 / STATE_VERSION 12 / 1710 tests verts.**

### Session 2026-05-27 soir — 4 deploys Phase 7.85 (audit responsive Cowork + retours user)

| Batch | Version | Sujet |
|---|---|---|
| 1 | 8.14.240 | Tabs Mon Profil + Admin 44px iOS HIG · Bug fonctionnel recherche démo (chips dynamiques + defense in depth) · B04 SongSearchBar maxWidth 580 · B07 Fermer ↑ padding 44 · B20 Input rename setlist maxWidth 480 · **B01 P0** songrow-pl-preset row 2 mobile (no truncate) · **B02 P0** Scoring Preset flex-wrap word-break · **B03 P0** Feedback IA layout column robuste |
| 2 | 8.14.241 | Retour user : alignement guitare vue repliée setlist (grid → flex simple) · Mes guitares inversion nom complet/court · **Lot B 11 touch targets 44×44** (B08 chips démo · B09 Au hasard · B10 avatar header · B11 + InlineRenameInput · B12 ✏️/🎤 toolbar · B13 SORTIE 4 boutons Mon Setup · B14 Modifier nom · B15 footer liens · B16 Se déconnecter · B17 Réinitialiser · B18 Enregistrer/Exporter) |
| 3 | 8.14.242 | **Lot polish P2** : B19 + B24 + demo banner wrap iPad (padding compact + retrait marginLeft:auto bouton ✕) · B23 version label nowrap · B25 séparateur "Au hasard" · B21 nav top desktop état actif renforcé (border accent + boxShadow inset) |
| 4 | 8.14.243 | **Lot A2** : retour user mobile densité · `.prose-readable` class CSS (max-width 65ch) appliquée 7 paragraphes prose SongDetailCard + 3 HomeScreen · `.song-row-detail` max-width 960px + centrage tablet+ (B05 + B22) |

### Audit Cowork — couverture finale

- **4 P0 fixés** : recherche démo + B01 noms presets row 2 + B02 Scoring Preset double tronc + B03 Feedback IA chevauche
- **17 P1 fixés** : tous touch targets 44×44 + alignement guitare + max-width sections
- **5 P2 fixés** : banner desktop hauteur + nav top active + version label + chips wrap + iPad banner wrap
- **B06 non touché** (ListScreen iPad portrait centrage) — `.page-root` gère déjà le centrage 92% à 640px+, le décalage Cowork peut être un cas spécifique de mesure non reproduit. À investiguer avec screenshot si récidive.

### Retours user direct intégrés (hors audit Cowork)

- **Alignement guitare vue repliée setlist** (iPhone) : décalage 40px causé par spacer transparent JSX (col 1 grid vide depuis Phase 7.83 final4). Retiré + simplification CSS `display: flex`.
- **Mes guitares (ProfileTab)** : inversion nom complet (gros) / nom court (petit). Le full name devient l'info principale.
- **Densité mobile prose** (sub-text "il y a bcp de caractères par ligne"). Class `.prose-readable` (max-width 65ch) appliquée aux paragraphes long pour plafonner à ~65 chars/ligne (optimum lecture typographique). Effet neutre sur mobile étroit (largeur naturelle déjà sous 65ch), plafond visible sur tablet/desktop.

### Architecture livrée Phase 7.85

```
src/main.jsx                                APP_VERSION 8.14.239 → 8.14.243
public/sw.js                                CACHE backline-v339 → backline-v343
src/app/screens/MonProfilScreen.jsx         tabBtn 44px + boutons Mon compte
                                            (Modifier/Se déconnecter/Réinitialiser/
                                            Enregistrer pwd/Exporter mes données +
                                            footer liens Aide/Feedback/Mise à jour)
src/app/screens/AdminScreen.jsx             tabBtn 44px
src/app/screens/HomeScreen.jsx              demoSuggestSongs dynamique (bug
                                            recherche démo fix) + chips 44 +
                                            "Au hasard" 44 + séparateur +
                                            SongSearchBar wrapper maxWidth 580
                                            + state demoInfoMsg defense in depth
                                            + prose-readable sur cot/desc
src/app/screens/SongDetailCard.jsx          B02 flex-wrap word-break · B03 layout
                                            column · B07 Fermer ↑ padding 44 ·
                                            B13 SORTIE 44 · prose-readable sur 7
                                            paragraphes prose long
src/app/screens/ListScreen.jsx              spacer transparent songrow-pl-meta-
                                            guitar retiré · B11 + InlineRename 44 ·
                                            B12 ✏️/🎤 toolbar 44 · maxWidth 480
                                            sur InlineRenameInput
src/app/screens/ProfileTab.jsx              inversion nom complet/court sur 2
                                            listes (standards + customs)
src/app/components/AppHeader.jsx            avatar 32→44 · version label nowrap ·
                                            nav top desktop état actif renforcé
src/app/components/ProfileSelector.jsx      avatar dropdown trigger 34→44
src/app/components/DemoBanner.jsx           padding 8x16→6x14 · retrait
                                            marginLeft:auto bouton ✕
src/index.html                              .songrow-pl-device-line @media mobile :
                                            preset en row 2 grid (B01) ·
                                            .songrow-pl-preset retire max-width
                                            300px legacy (le grid règle) ·
                                            .songrow-pl-meta-guitar grid → flex
                                            simple ·
                                            .song-row-detail max-width 960 +
                                            centrage tablet+ (B05 + B22) ·
                                            .prose-readable class utility 65ch
src/i18n/en.js, es.js                       +demo.no-analysis (Phase 7.85)
```

### Bilan tests

- **1710/1710 tests Vitest verts** à chaque étape (zéro régression)
- Bundle 2562 → 2565 KB stable
- Pas de bump STATE_VERSION (purement UI)
- Pas de migration localStorage

### Dette résiduelle Phase 7.85

- **B06 ListScreen iPad portrait centrage** non reproduit en static analysis — `.page-root` margin:auto centre normalement. Si récidive avec screenshot Cowork, creuser.
- **Lot A2 follow-up** : si retour user mobile densité persiste après v8.14.243, bumper fontSize min des clamp `clamp(10px, ...)` à `clamp(11-12px, ...)` sur les paragraphes prose denses. À surveiller.
- **Mail Jason Sadites (JS)** : démarchage Plan B reporté (silence Paul Drew TSR Mail 3 du 21/05 à J+6). À envoyer fin mai / début juin selon timing BETA_TESTING.md.

---

## État précédent (2026-05-27, session pollution profile + polish UX fiche song)

**Backline v8.14.239 / SW backline-v339 / STATE_VERSION 12 / 1710 tests verts.**

### Session 2026-05-26 nuit + 2026-05-27 — 16 commits déployés en prod

| Phase | Version | Sujet |
|---|---|---|
| demo-snapshot | 8.14.224 | Re-export snapshot démo bundlé (v10 → v11, 8 morceaux préservés, profileIds curateur préservé Phase 7.52.16) |
| dette-ux JJMMAA | 8.14.225 | Helper `formatDateJJMMAA` dans `core/date-utils.js` (FR Mac Finder friendly) + migration 2 sites exportJSON / Mon compte export perso |
| **7.74.10** | **8.14.226** | **Timestamps dédiés `language` / `enabledDevices` / `availableSources` (pattern Phase 7.74.9 étendu). STATE_VERSION 11 → 12. Cause racine pollution language FR→EN fermée.** |
| **7.74.11** | **8.14.227** | **Fingerprint device dans payload Firestore. `getDeviceId()` génère ID format `${platform}-${YYMMDD}-${rand6}`. UI Admin → Maintenance → 🆔 Cet appareil pour rename humain. Logs sync + mergeLogs enrichis `[from device "X"=id]`.** |
| 7.83 résidu | 8.14.228 | Pill compat fiche song : bucket qualitatif `[🟢 Idéal]` au lieu de score brut `[87%]` |
| 7.83 polish | 8.14.230 | Pill plein vert (au lieu pastel) + wrap multi-lignes nom guitare vue repliée |
| 7.83 final | 8.14.231 | Strip emoji pill + bucket labels vue repliée 3 pills + retrait `(HB)/(SC)/(P90)` partout |
| 7.83 final2 | 8.14.232 | Encadrement libellé guitare/preset couleur bucket compat + strip (HB) Gemini résiduel |
| 7.83 final3 | 8.14.233 | Style plein (au lieu pastel+bordure) + encadrement appliqué vue repliée ListScreen |
| 7.83 final4 | 8.14.234 | Pills "Idéal" séparés retirés (redondants avec libellé encadré) + score chiffré "99%" à gauche du select |
| 7.83 final5 | 8.14.235 | Mode IA fiche song retiré (jargon peu clair) + **histogramme barres horizontales** réglages effets |
| 7.83 final6 | 8.14.236 | Grid multi-col responsive 3 sections (Réglages effets / Scoring guitares / Alternatives) |
| 7.83 final7 | 8.14.237 | Grid 2 cols max via classe `.reco-multicol` (3+ cols coupaient les textes longs) |
| 7.83 final8 | 8.14.238 | Scoring preset : **amp encadré (réel) + preset name à côté en mono dim** (cohérent vue repliée) |
| **7.83-demo-gating** | **8.14.239** | **Audit UX mode démo (clôture dette résiduelle Phase 7.51.3.1). Pattern uniforme `disabled + opacity 0.5 + cursor not-allowed + title` sur tous les writes profil/setlists/songs accessibles en démo.** |

### Phase 7.83-demo-gating — Audit UX mode démo (v8.14.239)

Suite à un audit Explore (rapport 25 sites identifiés), clôture de
la dette résiduelle Phase 7.51.3.1 (~1h estimée → 2h réelles). Tous
les inputs/boutons qui appellent `onSongDb` / `onSetlists` /
`onProfiles` (writes bloqués par `wrapDemoGuard` Phase 7.51.2) sont
désormais visuellement grisés en mode démo.

**8 fichiers modifiés, +70/-46 lignes** :

| Fichier | Sites gated | Notes |
|---|---|---|
| `ListScreen.jsx` | 7 sites Haute | InlineRenameInput (prop `disabled`) + ✏️/🧹/🗑 + pills partage + 🗑 retrait + bouton "+" |
| `ProfileTab.jsx` | 4 sites | Toggle row standard/custom guitare + ✏️/✕ + GuitarSearchAdd + Sources (bonus) |
| `SongDetailCard.jsx` | 5 sites | Boutons override outputContext + textarea feedback + 📤 Envoyer + ✕ delete feedback + Tout effacer |
| `MonProfilScreen.jsx` | 2 wraps | Wrap `pointer-events:none` sur section IA + section musicales (le tab "⚙️ Préférences" est le seul accessible en démo) |
| `PresetCurationModal.jsx` | 1 cond | `editable` + `canRemoveOverride` désactivés → boutons ✏️ Modifier + 🔄 Restaurer invisibles, modal reste en lecture |
| `GuitarSearchAdd.jsx` | 1 prop | Composant étendu avec prop `disabled` (wrap parent) |

**Sites volontairement laissés fonctionnels** :
- `GuitarSelect` (dropdown choix guitare) : exploration utile pour
  la démo, `setGId` reste local React, write parent `onGuitarChange`
  → `setlist.guitars[songId]` est wrappé par `wrapDemoGuard` côté
  parent.
- Thème + langue (section Affichage tab Préférences) : préférences
  globales localStorage, pas writes profil. Le i18n module skip
  l'updater `profile.language` en mode démo (Phase 7.49).
- Chips suggérés + bouton 🎲 random Accueil démo (Phase 7.55.3) :
  appellent `handleSongConfirm` qui early-return sur le fetchAI et
  qui trouve les morceaux dans le songDb démo bundlé → pas de write.

**Sites déjà invisibles via tabs gated `!isDemo`** (Phase 7.51.2) :
MyCustomPresetsTab, ToneNetTab (migré AdminScreen), BankEditor,
MesAppareilsTab, ExportImportScreen. Tous masqués au niveau
`tabBtn` de MonProfilScreen / AdminScreen.

**Bonus annexe (Sources ProfileTab)** : le tab Sources est gated
`!isDemo`, donc invisible. Mais en mode normal, la prop `isDemo`
ajoutée s'étend aux toggles `availableSources` (préservation du
chemin Phase 7.74.10 `deviceMissing` + `unavailable`).

**Pas de bump STATE_VERSION** (purement UI).

### Phase 7.74.10 — Timestamps dédiés multi-champs (v8.14.226)

Pattern Phase 7.74.9 `banksModified` étendu à 3 nouveaux champs sensibles.
Cause racine pollution observée 2026-05-26 (Mac repasse FR → EN
involontairement) : `language` n'avait pas de timestamp dédié, adopté
en bloc dès `remote.lastModified > local.lastModified`. Garde-fou
Phase 7.74.4 délai 60s inopérant au-delà.

**5 champs LWW protégés désormais** :
| Champ | Timestamp dédié | Phase |
|---|---|---|
| `banksAnn` / `banksPlug` | `banksModified` | 7.74.9 |
| `language` | `languageModified` | **7.74.10** |
| `enabledDevices` | `enabledDevicesModified` | **7.74.10** |
| `availableSources` | `availableSourcesModified` | **7.74.10** |

Le merge LWW adopte ces champs UNIQUEMENT si `remote.{field}Modified
> local.{field}Modified`. Stamps appliqués automatiquement via
`setProfileField` (main.jsx) / `stampedProfileUpdate` (state.js) /
`_profileLanguageUpdater` (i18n) / `ProfileTab.updateProfile`.

Migration `migrateV11toV12` backfill 0 sur tous profils (idempotente).
7 tests Vitest dédiés.

### Phase 7.74.11 — Fingerprint device chasse au fantôme (v8.14.227)

Diagnostic 2026-05-27 : Firestore propre, mais `mergeLogs` Mac contiennent
encore `[merge-defense] banksAnn mass-change BLOCKED : remote.banksModified=0`
→ un device dormant pousse encore un état pré-v11 (Phase 7.74.9 du
2026-05-21 jamais reçue). Probablement un mobile beta-testeur (Bruno /
Francisco / Franck / Emmanuel) jamais rouvert depuis 5+ jours.

**Solution structurelle** : chaque device génère un `_deviceId` unique
persistant (`localStorage.tonex_device_id`, format `${platform}-${YYMMDD}-${rand6}`).
Inclus dans tous les pushes Firestore + 4 metadata sidecar :
- `_deviceId` : ID technique
- `_deviceLabel` : rename humain optionnel ("Mac Sébastien")
- `_deviceUA` : User-Agent (60 chars)
- `_pushAt` : ISO timestamp

Logs `[firestore] Pulled from device "X" (id=..., ua=..., pushed=..., v=...)`
capturés par wrapper Phase 7.74.5. `mergeProfileLWW` accepte options
`remoteDeviceId / remoteDeviceLabel` → logs BLOCKED/ADOPTED préfixés
`[from device "X"=id]`.

UI Admin → Maintenance → section **"🆔 Cet appareil"** : ID + UA + Label
+ bouton Renommer + boutons Voir/Effacer/Activer logs sync.

**Workflow de chasse** :
1. Sébastien Mac + iPhone nommés ("Mac Sébastien" / "iPhone Sébastien") ✅ fait 2026-05-27
2. Ping beta-testeurs pour qu'ils ouvrent Backline sur tous leurs devices
3. Attendre 24-48h
4. Dump `window.__getMergeDebugLogs()` Mac → identifier le device fantôme via UA + pattern d'ID
5. Réveiller manuellement (Cmd+Shift+R) → il passe en v12 → fini de polluer

7 tests Vitest dédiés (`getDeviceId` génération + idempotence + format,
`setDeviceLabel`/`getDeviceLabel` round-trip, `mergeProfileLWW` accepte
options remoteDeviceId/Label).

### Phase 7.83 — Refonte cohérente compat fiche song (final → final8, 11 commits)

Refonte intensive de la fiche song dépliée (`SongDetailCard`) + vue
repliée (`ListScreen`) suite à audit progressif user. Vision finale :

**Fiche dépliée Bloc 🎯 Recommandations IA** :

```
Mon Setup
─────────────────────────────────────
[99%] [▼ Gibson Les Paul Standard '60s]
⚠️ Idéalement : Strat 61, ES-335    (si pas idéal)

🎛️ Réglages EQ
  why global + tweaks "Si X → fix Y"

🎚 Réglages effets                    ← grid 2 col max desktop
┌────────────────┬────────────────┐
│ GATE           │ COMP           │
│ Threshold ▓▓░ -56dB│ Threshold ▓▓░ -18dB│
│ Release   ░░░ 140ms│ Gain      ▓▓░ 2dB │
│ Depth     ▓▓░ -75dB│ Attack    ▓░░ 10ms│
└────────────────┴────────────────┘

Scoring guitares                       ← grid 2 col max
┌──────────────────┬──────────────────┐
│ [LP60]      99%  │ [Strat61]   82%  │
│ raison IA prose  │ raison IA prose  │
└──────────────────┴──────────────────┘

Scoring preset
[Marshall JCM800] TSR Mars 800SL Cn1&2 🔵   93%
 ↑ amp encadré bucket                       ↑ pill score

Alternatives catalogue                  ← grid 2 col max
[Marshall Super Lead] WT Mars Super100  71%
[Vox AC30 TB]         AA VX TB30 BR     63%
```

**Vue repliée ListScreen — libellés encadrés cohérents** :
```
[1] Hells Bells [Idéal] ▼
   AC/DC
   [Gibson Les Paul Standard '60s]   ← guitare encadrée bucket
   📦 Ann [13C] [Marshall JCM800]    ← amp encadré bucket
```

Bucket compatibilité : 🟢 ≥75 (Idéal) / 🟡 ≥55 (Bon) / 🟠 <55 (Limite).
Style pills : fond plein bucket.color + texte `var(--text-inverse)` +
mono bold (pattern songrow-pl-score-pill-inline étendu).

11 commits incrementaux suite à un dialogue UX itératif user :
- Strip emoji du label (redondant avec fond coloré)
- Retrait `(HB)/(SC)/(P90)` partout (info pas utile à l'affichage)
- Pills "Idéal" séparés retirés (libellé encadré suffit)
- Score chiffré "99%" placé à gauche du select (cohérent vue repliée)
- Mode IA fiche song retiré (jargon `↻ Profil / ⚖️ Équilibré / 🎯
  Fidèle / 🎨 Interprétation` peu clair pour user, override par
  morceau toujours dispo côté data)
- Histogramme barres horizontales pour les sub-params FX (ranges
  officiels manuel TONEX p.22-28)
- Grid 2 cols max via classe CSS `.reco-multicol` (media query
  `min-width: 720px`, 3+ cols coupaient les textes longs)
- Amp encadré (réel) + preset name à côté en mono dim (cohérence
  avec vue repliée ListScreen qui affiche `ampLabel || presetName`)

### Action en attente côté user

Pour identifier le device fantôme qui pollue (cause #9+) :
1. Pinger Bruno / Francisco / Franck / Emmanuel : "ouvre Backline sur
   tous tes devices + reload"
2. Attendre 24-48h
3. Capturer `window.__getMergeDebugLogs()` Mac → identifier device
   coupable via UA + ID pattern
4. Réveiller manuellement ce device → fin pollution

### Dette résiduelle session

- Phase 8 (bass + drums + pédales modélisées) : ~20-40h, validée 2
  signaux Francisco. Pas démarrée.
- Phase 11 (Studio-driven enrichment) : ~15-20h dev + démarches.
  Trigger : Paul Drew TSR réponse positive Mail 3 (statut inconnu).
- Phase 12 (catalog GLOBAL vs USER granularité par pack) : ~12-17h,
  bump SCORING_VERSION 9 → 10.
- Phase 7.80.1 (audit responsive iPhone/iPad complet) : ~6-10h audit
  + ~10-15h fixes.
- Audit UX grisé mode démo (rename setlist, custom guitar add) : ~1h.
- Phase 7.84 résidu descriptions ampli ES (167 entries) : ~3-4h prose.

---

## État précédent (2026-05-25/26, Phase 7.55.7 close — Refonte Setlists vue repliée + dépliée, 29 sessions S1-S9.15)

**Backline v8.14.220 / SW backline-v320 / STATE_VERSION 11 / 1690 tests verts.**

### Récap final Phase 7.55.7 — refonte UX Setlists (29 sous-phases livrées en prod sur 2 jours)

Session marathon de refonte UX des 2 vues clés Setlists : **row playlist
(vue repliée)** + **fiche dépliée (SongDetailCard)**. Cohérence visuelle,
alignement, hiérarchie typographique, et élimination des doublons entre
les 2 vues. Toutes les sous-phases livrées en prod (refactor-and-tmp
→ main worktree) avec npm test 100% + build OK à chaque release.

#### Sessions S1-S7 (matinée + AM) — bug fixes Cowork + Explorer polish + erreur Gemini friendly

| Session | Sujet | Version |
|---|---|---|
| S1-S2 | 7 bugs Cowork (sticky DemoBanner, overflow-x clip, etc.) | v8.14.193-194 |
| S3 | Mockup vue repliée — choix variante C "playlist-like" | — |
| S4 | Refonte row replié vue Tous (3 alignements pills) | v8.14.195-198 |
| S5 | Mini design-system tokens.js (TYPO, WEIGHT, badges, sections) | v8.14.199 |
| S6 | Explorer tuiles amplis 3 colonnes alignées | v8.14.200-203 |
| S7 | AIErrorPanel friendly (classify quota/auth/safety/parse/network) | v8.14.204 |
| S8 | Row playlist variante C (numéro, titre, score abs, meta 4-col) | v8.14.205-208 |
| S8.1-S8.7 | Bug bank=0, helper getRowPlaylistData, scores entre numéro/libellé, alignement | v8.14.205-208 |

#### Sessions S9.1-S9.7 (après-midi + soir) — Refonte fiche dépliée 3 blocs

| Session | Sujet | Version |
|---|---|---|
| S9.1 | Passe globale fiche dépliée (3 blocs Phase 7.86 simplifiés) | v8.14.209 |
| S9.2 | Réordonnancement : Mon Setup en tête, Infos morceau en fin | v8.14.210 |
| S9.3 | Drop sticky bandeau (était doublon avec row repliée) | v8.14.210 |
| S9.4 | Bumper fontSize desktop via clamp(11px, 1.25vw, 13px) | v8.14.211 |
| S9.5 | Drop table Réglages pédale chiffrée (doublon row repliée) | v8.14.211 |
| S9.6 | **Hotfix** : restaure texte why preset + tweaks + FX whys (S9.5 trop agressif) | v8.14.212 |
| S9.7 | Cadres symétriques Scoring guitares/Scoring preset + Recommandations + drop doublon feedback | v8.14.213 |

#### Sessions S9.8-S9.15 (soirée 25/05 + 26/05) — Polish final fiche + Anthropic + amp réel

| Session | Sujet | Version |
|---|---|---|
| S9.8 | Réordonnance Bloc 2 (Recos → Réglages EQ → Réglages effets → Scoring g. → Scoring p.) + rename + sub-params FX Phase 9.7 + feedback inline textarea | v8.14.214 |
| S9.9 | Aligne taille pills slot/score (border transparente compensation) | v8.14.215 |
| S9.10 | Bouton Fermer en fin + score compat à droite GuitarSelect + playing_hints intégré dans Recommandations | v8.14.216 |
| S9.11 | Auto-fallback Anthropic admin (si profile.isAdmin + aiKeys.anthropic posée → force aiProvider='anthropic') | v8.14.217 |
| S9.12 | 3 entrées Clé API distinctes Admin (partagée Firestore / Gemini perso / Anthropic perso) | v8.14.218 |
| S9.13 + S9.14 | Affichage amp réel ("Marshall JCM800") vs preset name préfixé + row playlist sticky quand fiche dépliée | v8.14.219 |
| **S9.15** | **Retire les guillemets autour des libellés amplis row playlist** | **v8.14.220** |

### Phase 7.55.7 S9.7 — Cadres symétriques + drop doublon feedback (v8.14.213)

Retour user après S9.6 : *"il faudrait un cadre scoring preset autant
qu'il y a un cadre scoring guitares. Il faudrait aligner les scores.
Il faudrait un cadre 'Recommandations' dans lequel intégrer le textuel
preset et guitare."* Puis : *"Il y a un doublon de bouton pour le
feedback IA, celui du bas suffit."*

#### 4 changements

1. **Cadre "Scoring preset"** symétrique au cadre "Scoring guitares" :
   même style encadré (background `var(--a3)`, border `var(--a8)`,
   borderRadius `var(--r-md)`, padding 8x10). Wrap `displayTopPreset`
   + alternatives catalog. Titre uppercase mono `Scoring preset`.
2. **Scores alignés à droite** via pills uniformes dans les 2 cadres :
   `background: scoreColor`, `color: text-inverse`, `minWidth: 44`,
   `font mono bold 800`, `padding 2x7`. Alignement vertical entre
   rows guitare et preset.
3. **Cadre "Recommandations"** unique wrap `settings_preset` +
   `settings_guitar` (au lieu de 2 mini-blocs ad-hoc). Padding et
   typography alignés sur les autres cadres.
4. **Bouton feedback sticky retiré** : doublon avec
   `song-feedback-open` en bas (qui ouvre le formulaire complet via
   `setShowFeedback(true)`).

3 nouvelles clés i18n EN/ES (`song-detail.scoring-preset`,
`song-detail.recommendations`).

### Phase 7.55.7 S9.8 — Réordonnance Bloc 2 + sub-params FX (v8.14.214)

Nouvel ordre fiche dépliée demandé : `Header → Mon Setup →
Recommandations → Réglages EQ → Réglages effets → Feedback →
Scoring guitares → Scoring preset → Infos morceau`.

#### 5 changements

1. **Réordonnance Bloc 2** : Recommandations/Réglages EQ/Réglages
   effets remontent en tête. Scoring guitares + Scoring preset
   descendent après les réglages.
2. **Rename** : "Réglages pédale" → **Réglages EQ** ;
   "Effets activés" → **Réglages effets**.
3. **Sub-params FX visibles** (Phase 9.7 Niveau 2) par bloc :
   - Gate : Threshold dB · Release ms · Depth dB
   - Comp : Threshold dB · Gain dB · Attack ms
   - Mod : Rate Hz · Depth % · Level
   - Delay : Mode · Time ms · Feedback % · Mix %
   - Reverb : Time · Pre-delay ms · Color · Mix %
4. **Feedback inline** : textarea + bouton "📤 Envoyer" remplace
   l'ancien toggle [bouton "Donner feedback"] → [FeedbackPanel
   modal]. Plus rapide à utiliser, pas besoin de cliquer pour
   révéler le formulaire. Submit → push dans `song.feedback` +
   relance fetchAI auto + reset du quickFeedback state.
5. **+4 clés i18n EN/ES** : `eq-settings`, `fx-settings`,
   `feedback-placeholder`, `feedback-send`.

### Phase 7.55.7 S9.11 — Auto-fallback Anthropic admin (v8.14.217)

Réponse au souci utilisateur "je consomme trop de crédits Gemini".
Permet à l'admin de basculer ses analyses sur Anthropic (sa propre
clé sk-ant-...) sans impacter les beta-testeurs.

#### Logique

- `main.jsx` ligne 950 : `aiProvider` n'est plus la valeur brute
  du profil mais est dérivé :
  ```js
  const aiProvider = (profile?.isAdmin && aiKeys?.anthropic?.trim())
    ? 'anthropic'
    : (rawAiProvider || 'gemini');
  ```
  Si l'admin pose une clé Anthropic, elle est auto-utilisée.
  Aucun toggle UI explicite (déterministe par présence de la clé).

- `fetchAI.js` ligne 422 : routing provider réécrit pour respecter
  le param `aiProvider` au lieu de la heuristique précédente
  `provider = (aiKeys.gemini || defaultKey) ? 'gemini' : 'anthropic'`
  qui IGNORAIT le param et préférait toujours Gemini.

#### Conséquences

- Sébastien admin avec clé `sk-ant-...` → ses analyses consomment
  Anthropic → quota Gemini partagé préservé pour beta-testeurs.
- Bruno/Francisco → aucun changement, restent sur Gemini partagée
  (leur `profile.aiKeys.anthropic` est vide).
- Aucune clé syncée Firestore (Phase 7.30 strip → reste local Mac).
- Pré-calculs admin-switch (Phase 7.63) sur profil Bruno utilisent
  toujours Gemini partagée (cohérent — Bruno aura les mêmes recos
  qu'en autonomie).

#### Limite

**Anthropic API n'est pas inclus dans Claude.ai Pro/Max** : pour
appeler `api.anthropic.com/v1/messages` depuis Backline (PWA
browser), facturation API séparée, prépaiement minimum $5 sur
console.anthropic.com. Alternative gratuite documentée Phase
S9.12 : 2e clé Gemini sur projet Google Cloud séparé (free
tier 1500 req/jour indépendant).

### Phase 7.55.7 S9.12 — 3 entrées Clé API distinctes (v8.14.218)

Tab Admin → 🔑 Clé API restructuré pour clarifier l'usage des
3 clés. Avant : `aiKeys.gemini` servait à LA FOIS pour la clé
perso ET pour celle à partager → confus.

#### 3 sections séparées

1. **🌐 Clé Gemini partagée (Firestore)** : nouveau state local
   `sharedKeyInput` initialisé via `getSharedGeminiKey()` (singleton
   shared-key.js posé au boot par `loadSharedKey()`). Bouton
   "Mettre à jour la clé partagée" pousse à Firestore via
   `onSaveSharedKey` + update local module.
2. **🅖 Clé Gemini perso** (locale, `aiKeys.gemini`) : reste sur le
   device (Phase 7.30 strip → jamais Firestore). Prend priorité
   sur la clé partagée pour les analyses admin. Stratégie clé :
   créer une 2e clé sur nouveau projet Google Cloud → free tier
   indépendant 1500 req/jour pour l'admin, sans toucher au quota
   partagé.
3. **🅰 Clé Anthropic perso** (locale, `aiKeys.anthropic`) : reste
   sur le device. S9.11 auto-force `aiProvider='anthropic'` si
   présente.

Bandeau "Modèle actif" enrichi avec badge type de clé utilisée :
🅰 Anthropic perso / 🅖 Gemini perso / 🅖 Gemini partagée.

### Phase 7.55.7 S9.13 + S9.14 + S9.15 — Affichage amp réel + header sticky (v8.14.219-220)

Sébastien : *"je préfèrerais avoir le nom de l'ampli réel plutôt
que le preset (ex : Marshall 800 SL Channel 1 Drive au lieu de
TSR - Mars 800SL Chnl 1 Drive)"*.

#### Changements

- **S9.13** — `setlist-row-playlist.js` étendu avec champ
  `ampLabel` via `findCatalogEntry(presetName)?.amp`. Fallback
  null si preset unknown/guessed → display tombe sur `presetName`
  comme avant (régression-safe).
- **ListScreen.jsx** ligne 783 : `<span>{d.ampLabel || d.presetName}</span>`
  avec `title` HTML montrant le presetName original si différent
  (hover desktop / tap mobile).
- **S9.14** — Row playlist devient `position: sticky; top: 60;
  zIndex: 5` quand `isExpanded`. Reste visible en haut du scroll
  → clic dessus replie sans devoir scroller en fin pour le bouton
  "Fermer ↑". Tooltip "Clique sur le header pour replier la fiche."
- **S9.15** — Retire les guillemets `"..."` autour du libellé.
  Héritage legacy (citation d'identifiant technique) qui n'a plus
  de sens avec l'amp name "lisible naturel" Marshall JCM800.

### Architecture finale fiche dépliée post-S9.15

Ordre final (modifié S9.8 + S9.10) :

```
Header sticky : row playlist (S9.14) — clic pour replier
Bloc 3 — 🎸 Mon Setup
  • GuitarSelect avec score compat pill à DROITE (S9.10)
  • outputContext buttons (Profil / FRFR / Casque / PA)
  • Rappel "Sur ta {guitar} :" italique
  • guitarChoiceFeedback (reason)
  • localGuitarSettings fallback (si pas playing_hints)
  • Mode reco avancé (replié, Phase 7.3)
Bloc 2 — 🎯 Recommandations IA
  • Cadre 💡 Recommandations (settings_preset + settings_guitar +
    playing_hints intégré sous Guitare → ↳ pickup·tone·volume·stereo, S9.10)
  • Cadre 🎛️ Réglages EQ (rename S9.8 ; why global preset_settings_v1 +
    tweaks Phase 9.4)
  • Cadre 🎚 Réglages effets (rename S9.8 ; FX blocks ON + sub-params
    Phase 9.7 N2 : Threshold/Release/Depth/Time/Mix/etc.)
  • Cadre Scoring guitares (descendu S9.8, cot_step2 filter rig)
  • Hors cadre : Guitare idéale (cas family boost Phase 7.64)
  • Cadre Scoring preset (descendu S9.8, wrap displayTopPreset + alts)
Feedback IA inline (S9.8 : textarea + bouton 📤 Envoyer, plus de modal)
Bloc 1 — 📚 Infos morceau (déplacé S9.2)
  • Titre + BPM/key + desc + history + cot_step1 + cot_step3_amp
Bouton Fermer ↑ (déplacé en fin S9.10)
```

### Architecture livrée Phase 7.55.7 (cumul session S1 → S9.15)

```
src/main.jsx                              APP_VERSION 8.14.192 → 8.14.220
                                          +aiProvider override admin S9.11
                                          (anthropic auto si clé posée)
public/sw.js                              CACHE backline-v292 → backline-v320
src/app/screens/SongDetailCard.jsx        Refonte 3 blocs + cadres
                                          symétriques + drop sticky/table
                                          + S9.8 réordonnance + S9.10
                                          score pill droite GuitarSelect
                                          + playing_hints dans Recos
                                          + bouton Fermer en fin
                                          + S9.8 feedback inline textarea
src/app/screens/ListScreen.jsx            Row playlist variante C
                                          + S9.13 ampLabel || presetName
                                          + S9.14 sticky quand expanded
                                          + S9.15 drop guillemets
src/app/screens/AdminScreen.jsx           S9.12 — 3 sections Clé API
                                          distinctes (partagée Firestore /
                                          Gemini perso / Anthropic perso)
                                          + bandeau modèle actif enrichi
src/app/utils/setlist-row-playlist.js     NOUVEAU — helper getRowPlaylistData
                                          + S9.13 champ ampLabel via
                                          findCatalogEntry (19 tests)
src/app/utils/setlist-row-extras.js       NOUVEAU — formatRowPotardsFX
src/app/utils/ai-error-helper.js          NOUVEAU — classifyAIError +
                                          getAIErrorMessage trilingual
src/app/utils/fetchAI.js                  S9.11 — routing provider
                                          respecte aiProvider explicite
                                          (avant : forçait Gemini si clé
                                          dispo, ignorait Anthropic)
src/app/components/AIErrorPanel.jsx       NOUVEAU
src/app/styles/tokens.js                  NOUVEAU — mini design-system
src/index.html                            CSS Grid row playlist
                                          + tuiles Explorer 3 cols
                                          + overflow-x: clip
                                          + S9.9 score pill border
                                          transparent (= taille slot)
src/i18n/en.js, es.js                     +scoring-preset, recommendations
                                          +eq-settings, fx-settings
                                          +feedback-placeholder, feedback-send
```

### Conséquences Phase 7.55.7

- **1690/1690 tests verts** (+10 nouveaux vs Phase 7.74.10 : helpers
  row playlist, ai-error, tokens ; +1 test ampLabel S9.13).
- Bundle 2625 → 2638 KB (+13 KB cumul refonte fiche + helpers +
  i18n + 3 entrées Admin).
- **Pas de bump STATE_VERSION** (purement UI + routing IA + helper).
- **Pas de migration localStorage**.
- **29 sous-phases déployées en prod** sur GitHub Pages via worktree
  main (v8.14.192 → v8.14.220, SW v292 → v320).

### Validation cible utilisateur

- Cohérence visuelle entre row replié et fiche dépliée : header sticky
  drop, pas de doublon "Meilleurs presets installés", scores alignés
  via pills uniformes.
- Hiérarchie typographique homogène : `clamp(11px, 1.25vw, 13px)` pour
  body, `clamp(10px, 1.15vw, 12px)` pour meta, `clamp(9px, 1.05vw, 11px)`
  pour micro. Plus de fontSize 11 hardcoded restant.
- Encadrés sémantiques : Scoring guitares / Scoring preset /
  Recommandations / Réglages pédale = 4 cadres aux styles alignés.
- Mon Setup en tête (action prioritaire), Infos morceau en fin
  (contexte). Plus de Bloc 1 → 2 → 3 historique.

### Dette résiduelle Phase 7.55.7

- **Test E2E SongDetailCard** : non couvert par Vitest (rendering
  React complexe avec aiCache mock). Smoke test manuel post-déploiement
  obligatoire.
- **Clés i18n orphelines** : `song-detail.sticky-feedback` + `.sticky-feedback-tooltip`
  (sticky bandeau retiré S9.7) + `song-detail.compat`/`estimated` (ligne
  compat retirée S9.10) restent dans les dicts EN/ES. Cleanup mineur à
  grignoter.
- **Helper extraction props SongDetailCard** : le composant fait
  ~890 lignes. Decoupage possible (SongDetailHeader, SongDetailScoring,
  SongDetailRecommendations, SongDetailInfo) si test E2E nécessaire.
- **S9.11 (Anthropic admin) inerte** tant que pas de clé `sk-ant-...`
  posée. Sébastien a choisi alternative gratuite : 2e clé Gemini sur
  nouveau projet Google Cloud → free tier 1500 req/jour indépendant
  du quota partagé. Setup manuel utilisateur (non automatisable).
- **Modèle Anthropic** : actuellement `claude-haiku-4-5-20251001`
  (le plus rapide/abordable). Sonnet ou Opus si signal qualité
  insuffisante.

---

## État précédent (2026-05-25 lundi, Phase 7.74.10 — Cascade availableSources au toggle device + UI gating sources non disponibles)

**Backline v8.14.192 / SW backline-v292 / STATE_VERSION 11 / 1592 tests verts.**

### Phase 7.74.10 — UX cleanup couplage device ↔ source (v8.14.192)

**Bug rapporté 24/05 soir** : sur Mac admin Sébastien, l'état
`profile.availableSources.Factory = true` est apparu alors que
`tonex-pedal` n'était PAS dans `enabledDevices`. Idem pour
`language: 'en'` (Sébastien francophone). État convergé sur Mac
ET iPhone (Firestore sync). Pas de cycle actif de pollution
observé en logs (les 3 défenses Phase 7.74.x tournent normalement).
Hypothèse cause : un push historique a écrit cet état une fois,
l'autre device a adopté en bloc, c'est resté.

**Phase 7.74.10 = UX cleanup défensif** (pas le fix racine, cf
dette résiduelle "Phase 7.74.X investigation cause profonde"
ci-dessous) :

#### Helper pur `core/sources.js`

- **`DEVICE_ENABLES_SOURCES`** : mapping device → sources à
  cocher à l'activation. `tonex-pedal → ['Factory']` seulement
  (firmware v2 par défaut). User cochera `FactoryV1` manuellement
  si firmware v1.
- **`DEVICE_DISABLES_SOURCES`** : à la désactivation, cascade ON
  toutes les sources liées. `tonex-pedal → ['Factory',
  'FactoryV1']` (pas de pédale = aucune des deux factory liée n'a
  de sens).
- **`SOURCE_REQUIRES_DEVICE`** : mapping inverse pour UI gating.
  Si la source dépend d'un device non activé → grisée +
  non-cliquable + force OFF visuel.
- **`cascadeAvailableSources(availableSources, deviceId,
  isEnabled)`** : helper pur testable. Préserve l'identité de
  l'objet si rien ne change (perf).
- **12 tests Vitest dédiés** (`sources.test.js`) : symétrie ON ⊆
  OFF, cascade tonex-pedal/anniversary/plug, device inconnu
  no-op, identité préservée, scénario bug Sébastien cleanup.

#### Câblage `MesAppareilsTab.jsx` `toggleDevice`

Au toggle d'un device :
```js
const isNowEnabled = next.has(id);
const nextAvailableSources = cascadeAvailableSources(
  cur.availableSources, id, isNowEnabled
);
const patch = { enabledDevices: arr };
if (nextAvailableSources !== cur.availableSources) {
  patch.availableSources = nextAvailableSources;
}
return stampedProfileUpdate(p, activeProfileId, patch);
```

Effet : un toggle device propage automatiquement aux sources
liées. Auto-cleanup d'un état pollué quand le user re-toggle.

#### UI gating `ProfileTab.jsx` Sources

Pour chaque source listée :
```js
const requiredDevice = SOURCE_REQUIRES_DEVICE[key];
const deviceMissing = !!(requiredDevice && !enabled.has(requiredDevice));
const unavailable = ... || deviceMissing;
const on = !unavailable && (locked || profile.availableSources?.[key] !== false);
const unavailableLabel = deviceMissing
  ? t('profile-tab.device-required', 'matériel non activé')
  : (key === 'FactoryV1' ? '...' : '...');
```

Si device requis non activé :
- Source grisée (opacity 0.5)
- Cursor `not-allowed`
- Affichage forcé OFF (peu importe la valeur stockée)
- Badge "matériel non activé" à droite du label

### Architecture livrée Phase 7.74.10

```
src/main.jsx                              APP_VERSION 8.14.191 → 8.14.192
public/sw.js                              CACHE backline-v291 → backline-v292
src/core/sources.js                       +DEVICE_ENABLES_SOURCES,
                                          +DEVICE_DISABLES_SOURCES,
                                          +SOURCE_REQUIRES_DEVICE,
                                          +cascadeAvailableSources helper pur
src/core/sources.test.js                  +12 tests Phase 7.74.10
src/app/screens/MesAppareilsTab.jsx       toggleDevice :
                                          +cascade availableSources via helper
src/app/screens/ProfileTab.jsx            Sources section :
                                          +deviceMissing check via SOURCE_REQUIRES_DEVICE
                                          +unavailableLabel dynamique
src/i18n/en.js                            +profile-tab.device-required
src/i18n/es.js                            +profile-tab.device-required
```

### Conséquences

- **1592/1592 tests verts** (+12 nouveaux Phase 7.74.10, +1
  ré-équilibrage : baseline 1580 → 1592).
- Bundle 2624 → 2625 KB (+0.8 KB).
- Pas de bump STATE_VERSION.
- Pas de migration localStorage.
- **Cohabitation pré/post-7.74.10 safe** : un client pré-7.74.10
  qui pull un état où `availableSources.Factory: false` (posé par
  la cascade post-7.74.10) ignore juste la valeur (champ optional).

### Dette résiduelle Phase 7.74.10 → 7.74.X investigation

- **Pas de heal défensif au boot** : si un état pollué arrive via
  Firestore (push d'un device pré-7.74.10), il n'est pas nettoyé
  tant que le user ne touche pas Mes appareils. À implémenter
  Phase 7.74.10.1 (heal au boot via `ensureProfileV12` qui appelle
  `cascadeAvailableSources` pour chaque device non-activé) si bug
  récidive.
- **Cause profonde non identifiée** — Phase 7.74.X investigation
  séparée à mener. Hypothèses à instruire :
  - H1 : `setLocale` détecte `navigator.language` 'en' au boot et
    écrit `profile.language` via `_profileLanguageUpdater` Phase
    7.49 → revoir `src/i18n/index.js`.
  - H2 : Migration v7→v8 (`migrateV7toV8`) lit
    `localStorage.backline_locale` 'en' au premier load et pose
    `language: 'en'` comme default → revoir `state.js`.
  - H3 : `enterDemoMode` historique a injecté un snapshot avec
    `Factory: true` + `language: 'en'` via override par id →
    revoir `demo-profile.json` + merge.
  - H4 : `makeDefaultProfile(isAdmin=true)` historique a
    `availableSources.Factory: true` hérité (Sébastien profil
    pré-existant) → revoir `state.js`.
  - H5 : `recordAdminSwitch` (Phase 7.63) écrit dans profile
    target avec champs Sébastien → revoir.
  Sans identifier la cause, on continue d'accumuler du défensif.
  À planifier prochaine session dédiée.

---

## État précédent (2026-05-24 dimanche après-midi, Phase 7.55.7 S2 fixes Cowork + diagnostic 401 Firestore résolu)

**Backline v8.14.191 / SW backline-v291 / STATE_VERSION 11 / 1579 tests verts.**

### Session dimanche 2026-05-24 — 9 phases livrées + diagnostic 401

| # | Phase | Sujet | Version |
|---|---|---|---|
| 1 | 7.53.2 | Tombstones ToneNET (cycle pollution résolu) | 8.14.183 |
| 2 | 7.66 | Prompt fetchAI rig actif uniquement | 8.14.184 |
| 3 | 7.55.6 | Cloudflare Web Analytics setup | 8.14.185 |
| 4 | 4.6 + 4.6.1 | LiveScreen recos détaillées + hotfix | 8.14.186/187 |
| 5 | 7.55.5 | Tally beta request + ThanksScreen (refactor bilingue) | 8.14.188/189 |
| 6 | 7.55.7 S1 | LiveScreen iPad polish (typo XXL + Wake Lock badge) | 8.14.190 |
| 7 | **7.55.7 S2** | **Fixes Cowork (preset name iPhone + cibles tactiles)** | **8.14.191** |

### Phase 7.55.7 S2 — Fixes Cowork audit responsive (v8.14.191)

Rapport Claude Cowork (Chrome MCP, 6 résolutions iPhone/iPad émulées)
livré dimanche après-midi. 2 bugs prioritaires fixés :

🔴 **Effondrement vertical preset name SongDetailCard iPhone** :
Cowork observait sur iPhone 375-430px un span à width:17px height:248px
pour 'AA MRSH JT50 I Drive BAL SCH CAB' (1 char par ligne dans une
colonne 17px de large). Cause : `<div style={{flex:1}}>` ligne 912
SongDetailCard SANS `min-width:0` autour du PBlock → flex enfants
shrinkent à 0 sur viewport étroit, puis le mot long s'effondre
caractère par caractère. Fix double :
- SongDetailCard:912 — ajout `minWidth: 0` au wrapper flex
- PBlock:76 — ajout `overflowWrap: anywhere` + `wordBreak: break-word`
  sur le `<div>` displayName (belt-and-suspenders)

🟠 **Cibles tactiles < 44×44 iOS HIG (systémique)** : 3 fixes prioritaires :
- `AppNavBottom` (Accueil/Setlists/Explorer/Jammer) : 30px → `minHeight: 50px`,
  padding 8px→10px, icon 20→22
- Boutons toolbar setlist (Éditer / Analyser/MAJ / Annuler) : 23-25px →
  `minHeight: 36px`, padding 3px→7px, fontSize 10→11
- Bouton ✕ Quitter banner démo : 21px → `minHeight: 36px`, padding 3px→7px

Autres fixes Cowork reportés (chantier plus large) :
- 🟠 Layout iPad rétréci ProfilePicker + SongDetailCard centrée 500-620px
  avec gros gutters → effort ~2-3h, à trigger si signal user iPad ou
  démo studio
- 🟠 HomeScreen vide vertical central → effort ~1-2h
- 🟠 Onglets profile Mon Profil 31px → 30 min
- 🟡 Troncatures noms preset, chips wrap inélégant → cosmétique pur

Bug fonctionnel séparé identifié par Cowork (pas responsive) :
🔴 **Gel rendu "Analyser/MAJ 5"** (2+ min main thread bloqué). Probable
boucle synchrone non-yieldée dans batch fetchAI. À investiguer
séparément si reproduit. Cf Phase 5.13 (mai 2026) qui a déjà fait ce
type d'optim pour `enrichAIResult` côté affichage mais pas pour le
batch fetchAI lui-même.

### Diagnostic 401 Firestore résolu dimanche après-midi

**Symptôme** : cascade `[firebase-auth] fetch 401 → clearing cache +
retry` dans les logs depuis plusieurs jours. Chaque retry crée un
nouveau Anonymous User → 449 users accumulés au compteur Firebase
Console (vs 5-20 attendus pour 4-5 devices actifs).

**Diagnostic en 2 étapes Firebase Console** :
- Étape 1 — Authentication → Users count : **449 anonymes** (sous
  free tier 50K, pas critique mais signal de retry boucle)
- Étape 2 — Authentication → Settings → Authorized domains : **seuls
  localhost + tonex-guide.firebaseapp.com + tonex-guide.web.app
  listés**. `mybackline.app` MANQUANT.

**Cause** : depuis la migration Phase 7.29 (mai 2026 — `mybackline.app`
domaine canonique), l'app appelle Firestore avec un token anonyme
mais Firebase Auth vérifie l'origine du domaine. `mybackline.app`
n'était pas autorisé → token rejeté → 401 → retry → nouveau signUp →
encore 401 → boucle = 449 users créés.

**Fix** : ajout `mybackline.app` dans Authentication → Settings →
Authorized domains (1 clic Console). Validation immédiate au reload
PWA : plus de 401 cascade en console, Push/Pull Firestore fonctionnent
normalement (`Pull WITH aiCache → 983 KB → Push WITH aiCache COMPRESSED`).

**Résiduel** : un 403 isolé sur `securetoken.googleapis.com/v1/token`
correspond au `refreshToken` cached localStorage datant d'avant le
fix → rejet refresh → fallback auto sur `signUpAnonymously` → nouveau
user propre. Non bloquant. Cleanup optionnel via
`localStorage.removeItem('backline_anon_auth')` + reload.

**Bulk delete 449 users obsolètes** : abandonné (Firebase Console UI
n'a plus de "Select all" récent + 449 = 0.9% free tier, aucun impact
pratique). Le compteur restera stable maintenant que le domaine est
autorisé.

**Phase 7.55.7.x circuit breaker firebase-auth** : initialement
proposée en backup si le bug venait du code retry. Non nécessaire —
bug venait de la config Firebase Console, pas du code. Le retry Phase
7.52.17 fonctionne correctement maintenant.

### Architecture livrée session 2026-05-24

```
src/main.jsx                            APP_VERSION 8.14.180 → 8.14.191
public/sw.js                            CACHE backline-v280 → backline-v291
src/core/state.js                       +mergeDeletedToneNetIds (Phase 7.53.2)
                                        +mergeToneNetPresetsLWW tombstones
src/core/state.test.js                  +12 tests Phase 7.53.2
src/core/branding.js                    +TALLY_FORM_ID_BY_LOCALE
                                        +buildDemoRequestUrl (Phase 7.55.5)
src/index.html                          +script Cloudflare beacon (Phase 7.55.6)
src/app/utils/ai-helpers.js             Phase 7.66 — guitars (rig actif)
src/app/screens/SongDetailCard.jsx      Phase 7.66 + Phase 7.55.7 min-width:0
src/app/screens/LiveScreen.jsx          Phase 4.6 section guitare +
                                        Phase 4.6.1 songDbWithProfileCache +
                                        Phase 7.55.7 S1 polish iPad
src/devices/_shared/ToneXLiveBlock.jsx  Phase 4.6 sections pédale + FX
src/app/components/PBlock.jsx           Phase 7.55.7 S2 overflowWrap
src/app/components/AppHeader.jsx        Phase 7.55.7 S2 AppNavBottom 50px
src/app/components/DemoBanner.jsx       Phase 7.55.5 Tally + 7.55.7 S2 button
src/app/screens/ToneNetTab.jsx          Phase 7.53.2 tombstone stamp
src/app/screens/ListScreen.jsx          Phase 7.66 fetchAI guitars +
                                        Phase 7.55.7 S2 toolbar buttons
src/app/screens/AdminScreen.jsx         Phase 7.53.2 onDeletedToneNetIds prop
docs/SYNC.md                            +Phase 7.73.2.6 + 7.53.2 régressions
CLAUDE.md                               état actuel session dimanche
```

### Actions en attente côté Sébastien (à faire si non encore fait)

1. ~~**Configurer Tally redirect ThanksScreen**~~ ✅ FAIT 24/05 :
   redirect `https://mybackline.app/?thanks=1` configuré sur les 2
   formulaires (RGbBVd FR + 68WQyO EN). Le visiteur atterrit
   désormais sur ThanksScreen branded après soumission.
2. **Cloudflare Analytics stats** : stats détaillées arrivent demain
   matin (24h après setup ce matin). Premier checkpoint trafic
   landing publique.
3. **Test iPad v8.14.191** : reload PWA → vérifier mode scène (typo XXL +
   Wake Lock badge 🔒 + sections guitare/pédale/FX lisibles à 1m) +
   vérifier preset name SongDetailCard iPhone (plus d'effondrement
   vertical).
4. **Brouillon post Reddit** : prêt à copier (variantes A/B/C),
   publication ce soir ou demain matin selon timing souhaité.
5. **Cleanup local 403 isolé Mac** (optionnel) :
   `localStorage.removeItem('backline_anon_auth'); location.reload();`

### Dette résiduelle Phase 7.55.7

- **Session 3 (proposée si signal user)** : layout iPad rétréci
  (ProfilePicker + SongDetailCard) + HomeScreen vide vertical +
  onglets profile minHeight. Effort ~4-5h.
- **Investigation gel "Analyser/MAJ"** : main thread bloqué 2+ min.
  Si reproduit par Bruno/Francisco ou Sébastien, ~1-2h investigation.

---

## État précédent (2026-05-24 dimanche fin matinée, Phase 7.55.7 Session 1 LiveScreen iPad polish + analytics + Tally + LiveScreen recos détaillées)

**Backline v8.14.190 / SW backline-v290 / STATE_VERSION 11 / 1579 tests verts.**

### Session dimanche 2026-05-24 — 8 phases livrées

| # | Phase | Sujet | Version |
|---|---|---|---|
| 1 | 7.53.2 | Tombstones ToneNET (fix résurrection cross-device) | 8.14.183 |
| 2 | 7.66 | Prompt fetchAI rig actif uniquement | 8.14.184 |
| 3 | 7.55.6 | Cloudflare Web Analytics setup | 8.14.185 |
| 4 | 4.6 | LiveScreen recos détaillées (playing_hints + preset_settings + fx_blocks) | 8.14.186 |
| 5 | 4.6.1 | Hotfix LiveScreen songDbWithProfileCache | 8.14.187 |
| 6 | 7.55.5 (1) | Tally beta request initial | 8.14.188 |
| 7 | 7.55.5 (2) | Refactor Tally bilingue centralisé branding.js | 8.14.189 |
| 8 | **7.55.7 S1** | **LiveScreen iPad polish (typo XXL + bouton 48×48 + Wake Lock badge)** | **8.14.190** |

### Phase 7.55.7 Session 1 — LiveScreen iPad polish (v8.14.190)

Optimise le mode scène pour iPad Pro M4 (outil de scène principal de
Sébastien) :

1. **Bouton "← Sortir"** — cible touch 48×48 min (ergo scène doigts
   moites) : padding `clamp(10px, 1.4vw, 14px) clamp(14px, 2vw, 22px)` +
   minWidth `clamp(80px, 12vw, 140px)` + fontSize `clamp(13, 1.6vw, 18)`.
   Avant : 28×24px ~ insuffisant Apple HIG.

2. **Indicateur Wake Lock 🔒** visible dans le header. `useWakeLock`
   retourne maintenant `isLocked` state via useState + écoute event
   `release` du lock natif (Safari iOS release au tab change). Badge
   vert "🔒" rassure le user que l'écran ne va pas s'éteindre pendant
   le set. Silencieux si API pas disponible.

3. **Typo XXL pour lecture scène** (caps poussés vs Phase 4) :
   - Titre morceau : cap 48 → **72pt** (paysage iPad 13" 1366px = 7vw)
   - Artiste : cap 18 → 28pt
   - BPM/Key : cap 16 → 22pt
   - History (guitariste / amp original) : 11pt fixe → clamp(11, 1.4vw, 15)
   - Compteur "i/total" : 13pt fixe → clamp(13, 1.8vw, 19)
   - Section guitare Phase 4.6 : cap 20 → 26pt
   - Sections pédale/FX ToneXLiveBlock : caps 14→18 et 13→16

4. **Padding container responsive** : 12px 16px 16px fixe →
   `clamp(12, 1.8vw, 24) clamp(16, 2.5vw, 32) clamp(16, 2.2vw, 28)`
   pour respirer sur iPad sans casser mobile. iPhone 393px reste
   identique (caps minimum inchangés).

5. **i18n FR/EN/ES** : nouvelle clé `live.wakelock-active` ("Écran
   maintenu allumé" / "Screen kept awake" / "Pantalla siempre encendida").

**Effort réel** : ~1h dev. **Session 2 (bugs iPhone précis + Setlists
iPad)** : reportée — audit responsive complet déclenché en parallèle
via Claude Cowork (Chrome MCP) qui peut visualiser le rendu réel sur
différentes émulations vs deviner depuis le code.

### Phase 7.55.5 — Formulaire Tally demande d'accès beta (v8.14.188 + 8.14.189)

DemoBanner.jsx remplace `mailto:contact@mybackline.app` par lien Tally
qualifiant `target="_blank"` avec champs structurés (pseudo / email /
guitares / ToneX hardware / morceaux / source découverte / temps démo).
Réutilise les 2 formulaires bilingues existants (Phase 7.60.1 :
`RGbBVd` FR + `68WQyO` EN) — Sébastien avait créé un 3e form `Bz2LeA`
en doublon, refactor v8.14.189 centralise `TALLY_FORM_ID_BY_LOCALE`
dans `core/branding.js` (LandingScreen importe désormais depuis là).

**ThanksScreen** (Phase 7.60 préparée mai 2026, jamais activée) :
maintenant câblée. Tally redirige vers `mybackline.app/?thanks=1` après
submit → main.jsx détecte param → screen='thanks' → page branded
Backline (icône Backline + 🎸 + "Merci ! Sébastien reviendra sous 48h"
+ CTA "🎸 Tester la démo en attendant" + lien retour accueil).

**Config Tally requise côté Sébastien** (à faire post-déploiement) :
pour chacun des 2 forms (RGbBVd + 68WQyO) → Settings → Form behaviors →
After submit → Redirect to URL → `https://mybackline.app/?thanks=1`.

### Phase 4.6 + 4.6.1 — LiveScreen recos détaillées (v8.14.186/187)

Le mode scène n'affichait que le slot reco bank A/B/C + nom preset.
Tout le contenu Phase 9 (playing_hints / preset_settings_v1 / fx_blocks)
n'était visible que dans la fiche song dépliée → user devait quitter
LiveScreen pour consulter, cassait le flow de jeu.

Phase 4.6 intègre 3 sections dans LiveScreen :
1. **🎸 Sur ta {guitar.name}** — pickup localisé FR/EN/ES + Volume +
   Tone + badge STEREO (device-agnostic, entre Title et Devices)
2. **🎛️ Réglages pédale** — 5 boutons principaux + 5 ALT + badge
   CAB ON/OFF (dans ToneXLiveBlock, après les 3 slots A/B/C)
3. **🎚 Effets** — 5 blocs (Gate/Comp/Mod/Delay/Reverb) avec ON/OFF
   coloré + type (dans ToneXLiveBlock)

Trilingue FR/EN/ES via 6 nouvelles clés `live.*`. Skip silencieux si
aiCache absent ou champs Phase 9 absents (caches pré-Phase 9 = Mai
2026 affichent juste le bloc preset legacy).

**Phase 4.6.1 hotfix** : `screen==='live'` dans main.jsx utilisait
`songDb` brut au lieu de `songDbWithProfileCache` → liveSongs avait
aiCache=null après migration Phase 7.54 (per-profile aiCache) →
ToneXLiveBlock retournait "Pas de preset déterminé". Fix : remplacer
`songDb` par `songDbWithProfileCache` aux 2 lignes (1660, 1661 main.jsx).
Bug latent depuis Phase 7.54, jamais détecté car aucun test E2E
LiveScreen. Découvert par Sébastien au 1er test post-déploiement Phase 4.6.

### Phase 7.55.6 — Cloudflare Web Analytics (v8.14.185)

Snippet `<script defer src='https://static.cloudflareinsights.com/beacon.min.js'
data-cf-beacon='{"token": "5a8503857f494b259d11a1b17cef0df6"}'>` inline
dans `src/index.html`. Compteur visiteurs + sources trafic + pays +
device type pour `mybackline.app`. Gratuit, sans cookies, sans
bandeau RGPD. Stats détaillées sous 24h dans dashboard Cloudflare.

Permet de mesurer la conversion landing Phase 7.60 + démo `?demo=1`
+ flow Tally beta request (Phase 7.55.5). Si signal trafic suffisant
plus tard, basculer sur Umami self-hosted pour funnels conversion
détaillés (cf "Idées en attente" Phase 7.55.6 doc).

### Phase 7.66 — Prompt fetchAI passe rig actif uniquement (v8.14.184)

Phase 3.6 (mai 2026) passait `allRigsGuitars` (union all-profils) au
prompt fetchAI pour enrichir le cache cross-profil. Phase 7.54
(per-profile aiCache) a rendu ce bénéfice obsolète. Phase 7.32+7.65
filtraient l'affichage côté UI quand l'IA proposait `ideal_guitar`
hors rig — mais le prompt envoyait toujours l'union.

Fix : 4 call sites fetchAI passent maintenant `guitars` (rig actif) :
- `ListScreen.jsx:349` analyzeMissingAll
- `ListScreen.jsx:394` improveAll
- `SongDetailCard.jsx:110` useEffect mount
- `SongDetailCard.jsx:1078` rerunWithFeedback

`findGuitarByAIName(r.ideal_guitar, allRigsGuitars || guitars)` ligne
119 garde le fallback `allRigsGuitars` pour résoudre les aiCache
historiques pré-Phase 7.66 (rétro-compat).

Bénéfices : prompt ~50-100 tokens plus court + élimine hallucinations
IA à la source + cohérence prompt↔affichage.

### Phase 7.53.2 — Tombstones ToneNET (v8.14.183)

Pattern Phase 5.7 setlists appliqué à `shared.toneNetPresets`. Champ
`shared.deletedToneNetIds: {[id]: ts}` + `mergeToneNetPresetsLWW`
étendu avec 3e param `mergedTombstones` (drop items dont `id ∈
tombstones` ET `ts >= max(local, remote)`). Rétro-compat stricte
(param optional). `gcTombstones` 30j réutilisé. `ToneNetTab.deletePreset`
stamp tombstone. Phase 7.73.2.6 du matin (toneNetPresets dans
syncHash) + Phase 7.53.2 ferment ensemble le bug résurrection
cross-device ToneNET observé samedi.

**+12 tests Vitest** Phase 7.53.2 : scénario bug reproduit + safe-by-
design + égalité ts + idempotence + rétro-compat sans tombstones + mix
items keep/drop + gcTombstones 30j.

### Observations annexes session 2026-05-24

- **Cycle pollution ToneNET résolu structurellement** (Phase 7.73.2.6 +
  7.53.2 + workaround manuel session matinée). Mac=0, iPhone=0 stable.
- **Erreurs Firestore 401 répétées** dans les logs : `[firebase-auth]
  fetch 401 → clearing cache + retry` en cascade. Retry boucle sans
  succès → crée un nouveau user anonyme à chaque retry → potentielle
  explosion quota Firebase Anonymous Auth (50K DAU free tier). À
  diagnostiquer côté Firebase Console (Authentication → Users count).
  Code Phase 7.52.17 retry n'a PAS de circuit breaker → pollution
  Auth + burn quota. Fix possible Phase 7.55.7.x : circuit breaker
  qui bloque les signUp après 3 401 consécutifs pendant 60s.
- **Pollution profile cross-device Phase 7.74.x** : défenses Phase
  7.74.1/.4/.9 tiennent toujours.

### Dette résiduelle session 2026-05-24

- **Phase 7.55.7 Session 2** (audit responsive complet) : déclenché
  via Claude Cowork qui peut visualiser le rendu réel sur 6 résolutions
  émulées (iPhone SE/14/14+, iPad portrait/paysage 11"/13"). Rapport
  attendu en parallèle. Ensuite fixes prioritaires selon sévérité
  rapportée.
- **Phase 7.55.7.x — Circuit breaker firebase-auth** : à activer si
  diagnostic Firebase Console confirme une pollution Anonymous Auth
  user count > 10K ou quota burn observé. ~30 min dev + tests.
- **Post Reddit case study J+11** : draft prêt, à publier ce soir /
  demain matin (timing US prime 10h EST = 16h Paris).
- ~~**CONFIG TALLY redirect**~~ ✅ FAIT 24/05 par Sébastien sur les 2
  formulaires (RGbBVd FR + 68WQyO EN). ThanksScreen branded s'affiche
  désormais après soumission.

---

## État précédent (2026-05-24 dimanche tôt, Phase 7.53.2 + 7.66 — Tombstones ToneNET + Prompt fetchAI rig actif)

**Backline v8.14.184 / SW backline-v284 / STATE_VERSION 11 / 1579 tests verts.**

### Phase 7.66 — Prompt fetchAI passe rig actif uniquement (v8.14.184)

**Context** : Phase 3.6 (mai 2026) passait l'union all-rigs des
guitares de TOUS les profils (`allRigsGuitars`) au prompt fetchAI
pour enrichir le cache cross-profil (admin pré-calcule recos pour
beta-testeurs avant qu'ils se connectent). Conséquence : pour les
non-admins (Bruno, Francisco), Gemini voyait des guitares hors leur
rig actif et pouvait proposer `ideal_guitar` hors rig. Phase 7.32 +
7.65 ont fixé l'affichage (filtre côté UI) mais le prompt envoyait
toujours l'union.

**Phase 7.54** (mai 2026) a per-profile-isé l'aiCache → le bénéfice
Phase 3.6 (cache partagé) est devenu obsolète. Sébastien admin peut
pré-calculer pour un beta-testeur en basculant via Phase 7.63
admin-switch — une fois basculé, `profile = profiles.bruno` →
`guitars = bruno.myGuitars` → le prompt voit le bon rig.

**Fix Phase 7.66** : remplacer `allRigsGuitars || guitars` par
`guitars` (rig actif) dans les 4 call sites fetchAI :
- `ListScreen.jsx:349` (analyzeMissingAll batch)
- `ListScreen.jsx:394` (improveAll batch)
- `SongDetailCard.jsx:110` (useEffect mount/recompute)
- `SongDetailCard.jsx:1078` (rerunWithFeedback)

Les autres call sites (HomeScreen, SetlistsScreen, MaintenanceTab,
MonProfilScreen, AddSongModal) passaient déjà `allGuitars` (rig
actif merged in main.jsx:902) ou `GUITARS` (catalog complet pour
admin recalc batch) — pas touchés.

`findGuitarByAIName(r.ideal_guitar, allRigsGuitars || guitars)`
ligne 119 SongDetailCard reste avec fallback `allRigsGuitars` pour
**résoudre les aiCache historiques pré-Phase 7.66** qui contiennent
un `ideal_guitar` hors rig actif. Phase 7.32 filtre l'affichage si
match hors rig.

**Bénéfices** :
- Prompt fetchAI plus court (1 rig au lieu de 11+ guitares unioned)
- Moins de tokens Gemini par fetch (~50-100 tokens économisés)
- Élimine les hallucinations IA "ideal_guitar hors rig" → réduit
  les cas où Phase 7.32 + 7.65 doivent filtrer
- Cohérence : prompt et affichage voient désormais le même rig
- **Aucune invalidation aiCache** : caches existants restent
  fonctionnels, leurs cot_step2 hors rig sont filtrés à l'affichage

**Limites** :
- Pré-calcul admin pour autres profils (Phase 3.6 design original)
  : nécessite explicitement de basculer via admin-switch Phase 7.63
  avant de lancer "🤖 Analyser/MAJ N". Documenté dans BETA_TESTING.md
  section 6 (pitfall onboarding).

### Phase 7.53.2 — Tombstones ToneNET (v8.14.183, déployée matin 2026-05-24)

Pattern Phase 5.7 setlists appliqué à `shared.toneNetPresets` :
- Champ `shared.deletedToneNetIds: {[id]: number}` map de tombstones
- `mergeToneNetPresetsLWW(local, remote, mergedTombstones)` étendu :
  drop items dont `id ∈ tombstones` ET `tombstones[id] >= max(local,
  remote)`. Rétro-compat stricte (3e param optional → comportement
  Phase 7.53.1 préservé).
- `mergeDeletedToneNetIds = alias mergeDeletedSetlistIds` (union
  max(ts))
- `gcTombstones` 30j (helper Phase 5.7 réutilisé)
- syncHash inclut `deletedToneNetIds` (push se déclenche sur
  suppression)
- Push Firestore inclut `shared.deletedToneNetIds`
- `ToneNetTab.deletePreset` stamp `tombstones[id] = Date.now()`
- `applyRemoteData` merge LWW tombstones puis passe au
  `mergeToneNetPresetsLWW`

**Tests Vitest +12** dans `state.test.js` :
- `mergeDeletedToneNetIds` × 3 : union max(ts), falsy, non-numeric
- `mergeToneNetPresetsLWW` tombstones × 9 : scénario bug 2026-05-24
  reproduit, tombstone gagne sur remote, local plus récent que
  tombstone (resurrection légitime), égalité ts → tombstone gagne,
  tombstones absent/{} → rétro-compat Phase 7.53.1 préservée, mix
  items keep/drop, gcTombstones 30j applicable.

### Phase 7.73.2.6 — Fix bug push manquant toneNetPresets (v8.14.182, matin)

Le `syncHash` Phase 7.46 n'incluait pas `shared.toneNetPresets` →
modifications dans le tab ToneNET (suppression / ajout / édition)
ne déclenchaient AUCUN push Firestore → cycle infini de résurrection
entre devices.

**Fix** : +1 ligne dans syncHash array sur pattern adminPacks (Phase
7.69.7) :
```js
(toneNetPresets||[]).map(p=>(p.id||p.name||'')+':'+(p.lastModified||0)+':'+(Array.isArray(p.usages)?p.usages.length:0)).sort().join('|'),
```

### Phase 7.73.2.5 — Légende pastilles fix doublon emojis (v8.14.181)

Emojis 🔴/🟠/🔵/🟦 retirés des labels de la légende (doublon avec
LegendRow dots colorés). Ligne "🟪 Curé studio (Phase 11)" retirée
(non encore déployée). Légende finale 4 lignes propres + tip.

### Architecture livrée session 2026-05-24

```
src/main.jsx                            APP_VERSION 8.14.180 → 8.14.181 → 8.14.182
                                                    → 8.14.183 → 8.14.184
                                        Phase 7.73.2.6 : +toneNetPresets dans syncHash
                                        Phase 7.53.2 : +deletedToneNetIds state, push,
                                                       merge LWW, gcTombstones boot
                                        Phase 7.66 : (rien à changer, propage via
                                                     guitars prop des screens)
public/sw.js                            CACHE backline-v280 → backline-v284
src/core/state.js                       Phase 7.53.2 : +mergeDeletedToneNetIds (alias),
                                        mergeToneNetPresetsLWW étendu avec param tombstones
src/core/state.test.js                  +12 tests Phase 7.53.2
src/app/screens/ToneNetTab.jsx          Phase 7.53.2 : deletePreset stamp tombstone via
                                        onDeletedToneNetIds prop
src/app/screens/AdminScreen.jsx         Phase 7.53.2 : propagation onDeletedToneNetIds
src/app/screens/ListScreen.jsx          Phase 7.66 : 2 call sites fetchAI → guitars
src/app/screens/SongDetailCard.jsx      Phase 7.66 : 2 call sites fetchAI → guitars
                                        Note : findGuitarByAIName garde allRigsGuitars
                                        en fallback pour caches historiques
src/app/screens/MesAppareilsTab.jsx     Phase 7.73.2.5 : LegendRow labels sans emojis,
                                        4 lignes (drop curated-studio)
src/i18n/en.js, es.js                   Phase 7.73.2.5 : curation-legend.* sans emojis,
                                        retire curated-studio
docs/SYNC.md                            +Phase 7.73.2.6 et 7.53.2 dans table régressions
                                        +invariant tombstones pour listes per-item LWW
CLAUDE.md                               État actuel mis à jour
```

### Diagnostic session pollutions ToneNET (2026-05-24)

Session de troubleshooting collaborative sur la pollution ToneNET
cross-device entre Mac + iPhone + Safari Mac (3 instances) :

1. **Safari Mac** mis hors boucle : reset localStorage + `?beta=1` →
   flag `backline_no_sync='1'` → arrête push/pull Firestore.
2. **iPhone** mis hors boucle temporairement : `?beta=1` →
   `backline_no_sync='1'`.
3. **Chrome Mac** clean propre : FR + purge 5 ToneNET + décoche
   tonex-pedal. Stamp `lastModified` 24/05/2026 08:48:57.
4. **iPhone** retiré du no-sync → reload → pull → mais re-injecte
   ses 5 ToneNET locales (mergeLWW local-only keep).
5. **Diagnostic Sébastien** : "je n'ai pas vu la sync se
   déclencher" → identification du bug syncHash → Phase 7.73.2.6.
6. Deploy v8.14.182 → reload Mac + iPhone.
7. iPhone purge directe console + reload v8.14.182 → push se
   déclenche → Firestore vide → Mac reste à 0.
8. Phase 7.53.2 livrée v8.14.183 pour résoudre structurellement la
   résurrection cross-device sans intervention manuelle future.

Cycle cassé confirmé : Mac=0, iPhone=0, stable. Tests futurs
n'auront pas besoin de workaround manuel grâce aux tombstones.

### Observations annexes session 2026-05-24

- **Erreurs Firestore 401 répétées** dans les logs : `[firebase-auth]
  fetch 401 → clearing cache + retry`. Le retry Phase 7.52.17 kick
  in mais la prochaine requête re-fail aussi. Pull/Push fonctionnent
  malgré tout entre les 401. À surveiller dans Firebase Console →
  Authentication → Usage si récidive massive (possible quota
  Anonymous Auth).
- **Pollution profile cross-device Phase 7.74.x** : 3 défenses
  observées en logs (banksAnn mass-change BLOCKED + orphan-cross-
  profile + swap pattern cg_*→standard). Les 3 couches tiennent.
  Un device stale (probably iPhone à un moment) essaie encore de
  pousser des états anciens. Pas critique.

### Dette résiduelle

- **Pastille Laney VC50 HighGain/extrim Sat** : 1 entry encore en
  localStorage post-purge partielle. À traiter au choix :
  - Recréer comme custom (avec usages tagués) → pastille bleu clair
  - Supprimer via tab ToneNET admin (Phase 7.53.2 propage maintenant)
  - Laisser tel quel (pastille orange = correct car entry connue
    sans usages)
- **Recos pré-Phase 7.66** : les aiCache existants contiennent
  potentiellement des `ideal_guitar` hors rig actif. Phase 7.32 +
  7.65 filtrent à l'affichage. Pour basculer sur des recos
  100% in-rig dès le 1er render, "🔄 Réinitialiser mes analyses"
  (Mon Profil → ⚙️ Préférences → 🎯 Préférences IA) puis re-batch
  "🤖 Analyser/MAJ N". Optionnel.

---

## État précédent (2026-05-24 matin, Phase 7.73.2.5 + 7.73.2.6 — Légende pastilles fix doublon + Push toneNetPresets manquant)

**Backline v8.14.182 / SW backline-v282 / STATE_VERSION 11 / 1567 tests verts.**

### Phase 7.73.2.6 — Fix bug push manquant toneNetPresets (v8.14.182)

**Bug découvert par Sébastien** : modifications dans le tab ToneNET
(suppression / ajout / édition de presets) ne déclenchaient **pas**
de push Firestore. Sébastien purgeait 5 entries → state local Mac
propre → aucun `[firestore] Push WITH aiCache` dans les logs →
Firestore reste avec les 5 entries → iPhone au prochain pull
ré-injecte les 5 → cycle infini.

**Cause** : le `syncHash` Phase 7.46 (`src/main.jsx:1146-1162`)
n'incluait PAS `shared.toneNetPresets`. Le hash incluait songDb /
setlists / customGuitars / deletedSetlistIds / **adminPacks** (Phase
7.69.7) / sharedUsagesOverrides / sharedStudioUsages / profileHash /
activeProfileId / theme — mais oubli historique sur `toneNetPresets`.
`shouldBump` reste donc `false` → `if(!shouldBump) return` → push
skip.

**Fix livré** — 1 ligne ajoutée au syncHash array sur le pattern
adminPacks (Phase 7.69.7) :

```js
(toneNetPresets||[]).map(p=>(p.id||p.name||'')+':'+(p.lastModified||0)+':'+(Array.isArray(p.usages)?p.usages.length:0)).sort().join('|'),
```

Le hash inclut name (id en fallback) + lastModified + usages.length
pour détecter add / remove / edit usages.

**Limite résiduelle** : ce fix résout le PUSH manquant. Il NE résout
PAS la **résurrection cross-device** par absence de tombstones
(Phase 7.53.1 documenté). Si iPhone garde 5 entries locales avec
lastModified avant le pull, son `mergeToneNetPresetsLWW(local=5,
remote=0)` retourne `5` (local-only keep) → iPhone repushé 5 →
Firestore réinjecte → Mac repull 5. Workaround manuel : sur chaque
device polluant, purge directe console + reload (cf docs/SYNC.md
section workarounds).

Cf section "Idées en attente" Phase 7.53.2 (tombstones ToneNET)
pour fix structurel.

### Phase 7.73.2.5 — Légende pastilles fix doublon emojis (v8.14.181)

Le user a remonté que les emojis 🔴/🟠/🔵/🟦 dans les labels de
la légende Phase 7.73.2.4 faisaient **doublon** avec les pastilles
colorées rendues à gauche par `LegendRow` via `CURATION_COLORS`.

Fix : retire les emojis des labels (FR + EN + ES). La pastille
12×12px à gauche suffit. Aussi : retirer la ligne "🟪 Curé studio
(Phase 11)" non encore déployée.

Légende finale : 4 lignes (Inconnu rouge / Connu non curé orange /
Curé perso bleu clair / Curé admin bleu moyen) + tip
"clique sur une pastille pour voir ou éditer ses usages".

`CURATION_COLORS.curated-studio` conservée dans `core/catalog.js`
(utilisée par `getPresetCurationStatus` si `entry.curatedBy ===
'studio'`, prête pour Phase 11 future).

### Architecture livrée Phase 7.73.2.5 + 7.73.2.6

```
src/main.jsx                            APP_VERSION 8.14.180 → 8.14.181 → 8.14.182
                                        syncHash : +ligne toneNetPresets (Phase 7.73.2.6)
public/sw.js                            CACHE backline-v280 → backline-v281 → backline-v282
src/app/screens/MesAppareilsTab.jsx     LegendRow labels : retire emojis
                                        4 lignes au lieu de 5 (drop curated-studio)
src/i18n/en.js, es.js                   curation-legend.* : retire emojis labels
                                        retire curated-studio
```

### Diagnostic session 2026-05-24 matin (workaround manuel)

Session de troubleshooting collaborative sur la pollution ToneNET
cross-device entre Mac + iPhone + Safari Mac (3 instances) :

1. **Safari Mac** mis hors boucle : reset localStorage + `?beta=1` →
   flag `backline_no_sync='1'` posé → arrête push/pull Firestore.
2. **iPhone** mis hors boucle temporairement : `?beta=1` →
   `backline_no_sync='1'` → stop polluer.
3. **Chrome Mac** clean propre : FR + purge 5 ToneNET + décoche
   tonex-pedal. Stamp `lastModified` 24/05/2026 08:48:57.
4. **iPhone** retiré du no-sync → reload → pull → mais re-injecte
   ses 5 ToneNET locales (mergeLWW local-only keep).
5. **Diagnostic Sébastien** : "je n'ai pas vu la sync se
   déclencher" → identification du bug syncHash → Phase 7.73.2.6.
6. **Deploy v8.14.182** → reload Mac + iPhone.
7. **iPhone purge directe console** : `s.shared.toneNetPresets=[];
   s.shared.lastModified=Date.now(); localStorage.setItem(...);
   location.reload();`
8. Au reload v8.14.182, syncHash recalcul → diff (5→0) → push
   automatique → Firestore vide → Mac reste à 0.

**Cycle cassé** confirmé : Mac=0, iPhone=0, stable.

### Observations annexes (non bloquantes)

- **Erreurs Firestore 401 répétées** dans les logs Safari/Chrome :
  `[firebase-auth] fetch 401 → clearing cache + retry`. Le retry
  Phase 7.52.17 kick in à chaque fois mais la prochaine requête
  re-fail aussi. Possible quota Firebase Anonymous Auth proche, ou
  rate limit. Sans impact (Pull/Push fonctionnent malgré tout entre
  les 401), à surveiller dans Firebase Console → Authentication →
  Usage si récidive massive.
- **Pollution profile cross-device Phase 7.74.x** : 3 défenses
  observées en logs :
  - `[merge-defense] banksAnn mass-change BLOCKED` (Phase 7.74.9
    banksModified timestamp dédié)
  - `[merge-defense] orphan-cross-profile` (Phase 7.74.1 filter
    guitares d'autres profils)
  - `[merge-defense] swap pattern cg_*→standard` (Phase 7.74.4
    détection swap suspect)

  Les 3 couches tiennent → état Sébastien Mac préservé. Un device
  stale (probablement iPhone à un moment) essaie encore de pousser
  des états anciens. Pas critique.

### Dette résiduelle Phase 7.73.2.5 + 7.73.2.6

- **Phase 7.53.2 — Tombstones ToneNET** (cf "Idées en attente").
  Validée comme prochaine étape post-Phase 7.73.2.6. Effort ~1.5h
  dev + tests. Pattern Phase 5.7 setlists : champ
  `shared.deletedToneNetIds: {[id]: ts}` qui survit aux merges et
  empêche la résurrection. Phase 7.73.2.6 résout le push manquant
  (Mac peut maintenant pusher une purge), mais sans tombstones,
  un autre device qui garde l'item local peut encore le pousser
  via son propre push. Une fois Phase 7.53.2 livrée, le cycle est
  cassé structurellement.
- **Pastille Laney VC50 HighGain/extrim Sat** : si Sébastien
  souhaite la rendre fonctionnelle (pastille bleu clair + pin IA),
  recréer comme custom avec usages tagués. Sinon laisser comme
  rien — ne bloque rien (juste un slot Plug avec label inconnu,
  scoring V9 fallback).

---

## État précédent (2026-05-23 PM, Phase 7.73.2.3 + 7.73.2.4 — Paranoid fix via propagation V9-top + Légende pastilles curation)

**Backline v8.14.180 / SW backline-v280 / STATE_VERSION 11 / 1567 tests verts.**

### Contexte — Diagnostic Paranoid affiné

`SupergroupBass_SM57_TB_full` (utilisé par Sébastien sur Paranoid) est
**présent dans `shared.toneNetPresets`** mais **sans usages tagués**
(`getPresetCurationStatus()` retourne `'known'` → pastille orange brass
en bank 18C). Donc Phase 7.73.2.2 (override final via
`findSlotByUsageMatch`) ne fait RIEN sur ce cas — elle dépend des
usages tagués pour matcher.

Le 93% Recommandation idéale vient du **catalog scan V9 pur** (good
match Laney Supergroup sur ref_amp). Le 92% Meilleurs installés vient
du pin Phase 7.52.5 sur ORNG 120 Dimed 32C (usages tagués Sabbath
côté catalog Anniversary Premium).

### Phase 7.73.2.3 — Propagation V9-top vs usages-pin (remplace 7.73.2.2)

**Fix structurel** : si `best.annTop.score` (V9 réel du slot V9-top
installé) > `preset_ann.score` (pin Phase 7.52.5 hardcoded 92/80) →
propage le slot V9-top sur `preset_ann`. Couvre TOUS les cas H1
(presets connus non tagués) sans dépendre de la curation user.

```js
if (best.annTop && best.annTop.score > (aiResult.preset_ann?.score || 0)) {
  aiResult.preset_ann = {
    bank: best.annTop.bank, col: best.annTop.col,
    label: best.annTop.name,
    score: best.annTop.score,
    breakdown: best.annTop.breakdown || null,
  };
}
// idem preset_plug avec best.plugTop
```

**Pourquoi Phase 7.31 (pin IA via preset_ann_name) reste protégée** :
son pin pose `score = max(90, v9Score)`. Si v9Score réel ≥ 90 →
best.annTop ne peut pas le dépasser → no-op. Si v9Score réel < 90
(pin hardcoded à 90) ET best.annTop V9 > 90 → propage : l'IA s'est
trompée, le V9 top est mieux.

**Idempotent** : 2e appel → `best.annTop.score === preset_ann.score`
(post-propagation) → strict `>` → no-op.

**Tests Vitest Phase 7.73.2.3 (+6 tests)** :
1. **Scénario Paranoid** : ORNG pin Phase 7.52.5 à 92 (usages match
   titre), SupergroupBass V9 réel > 92 grâce à ref_amp Laney exact →
   propagation → preset_ann = SupergroupBass 18C.
2. **Safe-by-design** : preset_ann = best.annTop déjà (single slot)
   → no-op via strict `>`.
3. **Phase 7.31 préservé avec V9 réel haut** : pin via preset_ann_name
   posé à score ≥ 90 → best.annTop same slot → no-op.
4. **Phase 7.31 V9 bas (pin hardcoded 90) + best.annTop > 90** :
   propage (FAKE_PIN avec V9 30, SupergroupBass V9 95+ → écrase).
5. **Idempotence** : 2e appel ne change pas preset_ann.
6. **preset_plug** : propage aussi via best.plugTop.

### Phase 7.73.2.4 — Légende pastilles curation dans MesAppareilsTab

Le user a remonté que les couleurs de pastilles Phase 7.70 (rouge wine
/ orange brass / bleu clair / bleu moyen) ne sont pas explicitées dans
l'UI — tooltip hover existe mais peu pratique sur mobile.

Nouveau bloc collapsable dans **Mon Profil → 📱 Mes appareils** sous
la phrase "Banks et patches de tes N appareil(s) activé(s)" :

```
▼ Légende des pastilles de curation       (collapsée par défaut)

[expand]
🔴 Inconnu — pas dans le catalog, scoring dégradé, pas de pin IA possible
🟠 Connu non curé — dans le catalog, mais sans usages artiste/morceau
🔵 Curé perso — tu as enrichi ce preset (custom ou ToneNET) avec des usages
🟦 Curé admin — preset enrichi par Sébastien dans le catalog Backline
🟪 Curé studio — futur (Phase 11) : enrichi par son créateur

Astuce : clique sur une pastille pour voir ou éditer ses usages.
```

Composant `LegendRow` inline (10px dot coloré via `CURATION_COLORS` +
label texte). 7 nouvelles clés i18n FR/EN/ES (`curation-legend.*`).
Trilingue dès J0.

### Architecture livrée Phase 7.73.2.3 + 7.73.2.4

```
src/main.jsx                            APP_VERSION 8.14.179 → 8.14.180
public/sw.js                            CACHE backline-v279 → backline-v280
src/app/utils/ai-helpers.js             Phase 7.73.2.3 : remplace le bloc
                                          Phase 7.73.2.2 par propagation
                                          V9-top vs usages-pin. Plus simple,
                                          plus robuste, indépendant des
                                          usages tagués.
src/app/utils/ai-helpers.test.js        Phase 7.73.2.3 : 6 tests adaptés
                                          (scénario Paranoid avec ref_amp
                                          Laney + target_gain 9 pour V9
                                          réel > 92, Phase 7.31 préservé,
                                          FAKE_PIN propagation, idempotence,
                                          plug).
src/app/screens/MesAppareilsTab.jsx     +import CURATION_COLORS
                                        +state legendOpen
                                        +composant LegendRow inline
                                        +bloc légende collapsable sous
                                          "Banks et patches de tes N
                                          appareil(s) activé(s)"
src/i18n/en.js, es.js                   +7 clés curation-legend.* (title,
                                          unknown, known, curated-perso/
                                          admin/studio, tip) × 2 langues
```

### Conséquences Phase 7.73.2.3 + 7.73.2.4

- **1567/1567 tests verts** (6 tests Phase 7.73.2.2 remplacés par 6
  tests Phase 7.73.2.3, count inchangé).
- Bundle 2613 → 2616 KB (+3 KB pour légende + i18n + nouveaux tests).
- **Pas de bump STATE_VERSION**, pas de migration.
- **Effet** au prochain render `enrichAIResult` (mount fiche song ou
  re-fetch) : si `best.annTop` V9 réel > `preset_ann.score` actuel,
  le slot V9-top installé est propagé automatiquement, sans
  dépendance aux usages tagués.

### Validation post-déploiement attendue

1. Reload PWA → `v8.14.180`
2. Ouvrir Paranoid :
   - ✅ "Meilleurs presets installés Anniversary" affiche maintenant
     **SupergroupBass 18C** avec son score V9 réel (probablement
     93+ grâce à ref_amp Laney match).
   - ORNG 120 Dimed 32C est désormais relégué (best.annTop V9 < SupergroupBass).
3. Mon Profil → 📱 Mes appareils :
   - ✅ Sous "Banks et patches de tes N appareil(s) activé(s) :"
     apparaît un toggle "▼ Légende des pastilles de curation"
   - Click → révèle les 5 couleurs avec labels explicits + astuce
     "clique sur une pastille pour voir ou éditer ses usages"
4. Régression check :
   - Hells Bells (AC/DC) → top installé inchangé (AA MRSH JT50, usages
     Sabbath/AC/DC dans Anniversary Premium, V9 réel > 92).
   - Sur les autres morceaux, le bloc "Meilleurs installés" est
     désormais cohérent avec "Recommandation idéale" (même top quand
     le top catalog est installé).

### Dette résiduelle Phase 7.73.2.3 + 7.73.2.4

- **Trade-off** : si l'IA Gemini pin un slot via `preset_ann_name`
  avec un V9 réel bas (rare), Phase 7.73.2.3 va écraser ce pin si
  best.annTop a un V9 réel > 90. Comportement souhaité (le V9 top
  est probablement plus juste qu'une IA qui s'est trompée) mais à
  surveiller si feedback contraire d'un beta-tester.
- **`computeBestPresets` reste pur V9** : non touché. Si signal user
  qu'on veut un scoring intégré usages-bonus dans le scoring lui-même
  (au lieu d'override), Phase 7.73.2.5 future étendrait
  `computeBestPresets` avec params song.artist/title + secondary
  sort usageBonus. Plus invasif.
- **Phase 11 long terme** : enrichissement Studio-driven
  (`tone_profile` per-capture) permettra de pré-tagger automatiquement
  les usages des packs commerciaux sans effort user. Cf section
  "Idées en attente" Phase 11.
- **Quick win user immédiat** : tagger `SupergroupBass_SM57_TB_full`
  via Mon Profil → ⚙️ Admin → 🌐 ToneNET avec `usages: [{artist:
  "Black Sabbath", songs: ["Paranoid", "Iron Man", "War Pigs",
  "N.I.B."]}]` → pastille passe orange → bleu clair + pin direct
  Phase 7.52.5 → cohérence renforcée même si Phase 7.73.2.3 le
  couvrait déjà via propagation V9.

---

## État précédent (2026-05-23 matin, Phase 7.73.2.1 hotfix privacy — retrait bouton mailto admin)

**Backline v8.14.178 / SW backline-v278 / STATE_VERSION 11 / 1561 tests verts.**

### Phase 7.73.2.1 — Hotfix privacy mailto (v8.14.178)

Constat post-déploiement Phase 7.73.2 Session C v8.14.177 : la
section 💬 Aide de Mon compte contenait un bouton
**"📧 Contacter Sébastien (admin)"** qui exposait `sebastien.chemin@
gmail.com` en clair dans le DOM via `mailto:`. Visible par tous les
utilisateurs (beta-testeurs Bruno/Francisco et futurs visiteurs démo
si le tab leur devient accessible).

**Fix immédiat** : retirer le bouton mailto de
`src/app/screens/MonProfilScreen.jsx` (MonCompteSection Section Aide).
Toute communication passe désormais par le formulaire Tally via le
bouton "💬 Envoyer un feedback à l'équipe" (canal unique).

Clés i18n `mon-compte.help-contact-admin`, `.help-contact-subject`,
`.help-contact-body` retirées de `src/i18n/en.js` et `src/i18n/es.js`
(devenues inutiles, cleanup).

APP_VERSION 8.14.177 → 8.14.178, SW CACHE v277 → v278. Pas de bump
STATE_VERSION. 1561/1561 tests verts. Bundle 2613 → 2612 KB
(retrait léger).

### 🐛 Bug Paranoid observé — investigation à faire prochaine session

Sur la fiche Paranoid de Black Sabbath, incohérence visuelle entre
deux blocs :

- **🎯 Recommandation idéale Preset** : `SupergroupBass_SM57_TB_full`
  à **93%**, ✓ installé en Banque 18C, source 🌐 ToneNET
- **Meilleurs presets installés pour SG Ebony · Anniversary** :
  `ORNG 120 Dimed BAL CAB` à **92%** en Banque 32C

Le 93% installé devrait apparaître dans "Meilleurs installés" mais
le bloc affiche un 92% à la place. Bug d'affichage UI ou de
scoring.

**Investigation déjà faite** :
- ✅ Le useMemo Phase 7.53 dans `main.jsx:546-563` copie bien le
  champ `usages` depuis `shared.toneNetPresets` vers
  `PRESET_CATALOG_MERGED` (ligne 560). Donc **H2 écartée** (pas un
  bug de propagation).
- ✅ Le never-regress dans `enrichAIResult` (lignes 517-520) est
  correctement gated par `!annPinnedByAI`. Si `findSlotByUsageMatch`
  trouve un slot avec score 100, le pin survit et "Meilleurs
  installés" devrait afficher SupergroupBass.

**Hypothèses restantes** (à valider runtime) :
- **H1 — Pas de tag user** : Sébastien n'a pas tagué le ToneNET
  SupergroupBass avec `usages: [{artist: "Black Sabbath", songs:
  ["Paranoid"]}]` via le tab admin ⚙️ Admin → ToneNET (Phase 7.53).
  Alors `findSlotByUsageMatch` ne match pas → fallback V9 → ORNG.
  Le 93% Recommandation idéale viendrait du scoring V9 catalog scan
  de SupergroupBass (Laney Supergroup amp Sabbath-historic).
- **H3 — Pin écrasé** : Les usages sont tagués mais quelque chose
  écrase `preset_ann` après le pin (cross-contamination Phase 7.31
  preset_ann_name, ou autre).

**Étapes diagnostic** :
1. Inspecter `shared.toneNetPresets` dans localStorage Sébastien
   (DevTools → Application → Local Storage → `tonex_guide_v2`) :
   chercher l'entry `SupergroupBass_SM57_TB_full` et vérifier la
   présence ou absence du champ `usages`.
2. Si présent → c'est H3. Inspecter `aiC.preset_ann` runtime sur
   Paranoid + tracer le pipeline `enrichAIResult` pour identifier
   ce qui écrase le pin.
3. Si absent → c'est H1. Solution : tagger via Mon Profil →
   ⚙️ Admin → 🌐 ToneNET (Phase 7.53 UI éditable usages). Optionnel
   Phase ultérieure : améliorer l'inférence usages depuis le nom
   du preset (ex. "Supergroup" → Sabbath/Iommi). Risque
   cross-contamination, à éviter sans signal user explicit.

**Fix code (si H3 confirmé)** : ajouter un override final dans
`enrichAIResult` après le never-regress lignes 517-524, qui re-vérifie
`findSlotByUsageMatch` et écrase `preset_ann` si match >= 50 ET
label différent du current. ~10 lignes + tests Vitest.

### Architecture livrée Phase 7.73.2.1

```
src/main.jsx                            APP_VERSION 8.14.177 → 8.14.178
public/sw.js                            CACHE backline-v277 → backline-v278
src/app/screens/MonProfilScreen.jsx     MonCompteSection Section Aide :
                                          retire <a href="mailto:..."> et
                                          son bloc. Commentaire de remplacement
                                          pour traçabilité.
src/i18n/en.js, es.js                   Retire 3 clés mon-compte.help-contact-*
                                          (admin, subject, body)
```

### Conséquences

- **1561/1561 tests verts** (aucun changement de logique testée).
- Bundle 2613 → 2612 KB (cleanup).
- Pas de bump STATE_VERSION ni migration.
- **Email admin n'apparaît plus dans le DOM** côté production.
- Tally reste le canal unique de feedback.

### Validation post-déploiement

1. Reload PWA → `v8.14.178`
2. Mon Profil → 👤 Mon compte → Section Aide :
   - ✅ Bouton "📧 Contacter Sébastien" DISPARU
   - ✅ Bouton "💬 Envoyer un feedback à l'équipe" (Tally) toujours présent
3. View Source de la page → aucune occurrence de `sebastien.chemin@gmail.com`
4. Régression : autres sections Mon compte (Identité, Sécurité, Données, Activité, Communauté) fonctionnent normalement

---

## État précédent (2026-05-23 nuit, Phase 7.73.2 Session C — sections Activité + Communauté + Aide)

**Backline v8.14.177 / SW backline-v277 / STATE_VERSION 11 / 1561 tests verts.**

(Section C livrée hier soir, voir commits `b6cb048` + `cd5b05f`. Inclut
les 3 dernières sections du tab Mon compte : 📊 Activité stats read-only,
🤝 Communauté partages reçus, 💬 Aide tutoriel + feedback + version.
Le bouton mailto privacy de cette session a été retiré Phase 7.73.2.1.)

---

## État précédent (2026-05-23 matin, Phase 7.73.2 Session B + Bonus — Tab 👤 Mon compte + preferredStyles au prompt)

**Backline v8.14.176 / SW backline-v276 / STATE_VERSION 11 / 1561 tests verts.**

### Phase 7.73.2 Session B — Tab "👤 Mon compte" (v8.14.176)

Deuxième session du chantier Phase 7.73.2 (Session A 2026-05-23 nuit
livrait le tab ⚙️ Préférences + renommages). Session B livre le **cœur
de la refonte** : nouveau tab "👤 Mon compte" en première position
avec 3 sections empilées.

#### Composant `MonCompteSection` (inline dans MonProfilScreen.jsx)

**Section 1 — 👤 Identité** :
- **Avatar** : upload via `image-resize.js` (Phase 7.29.9) → data-URL
  JPEG 240px max, qualité 0.85, ~30 KB. Affichage circulaire 64×64
  avec border. Si pas d'avatar → cercle avec initiale du nom. Boutons
  "📷 Changer / Ajouter un avatar" + "Retirer" (avec confirm). Validation
  type image + size 5 MB max avant resize.
- **Nom** : édition inline (display normal + bouton "Modifier" qui
  bascule en input). Save par Enter ou bouton ✓, cancel par Escape ou
  ✕. Stamp `lastModified`.
- **Bio courte** : textarea ≤200 chars, 2 lignes, save au blur.
- **Email** (optionnel) : input `type=email` avec autocomplete=email,
  save au blur. Pour récup password future ou contact admin.
- **Badges read-only** : ★ ADMIN (si `profile.isAdmin`) + 🎬 DEMO (si
  `profile.isDemo`). Pas de badge BETA (champ pas dans le schéma).

**Section 2 — 🔐 Sécurité** :
- Réutilise le composant `PasswordTab` existant (Phase 7.35) : change
  password current+next+confirm via WebCrypto (Phase 7.28) +
  historique de connexion (5 dernières entries au format dual
  timestamp/admin_switch Phase 7.63).
- **Trusted devices** (nouvelle sous-section) : affiche le statut
  trusted/non-trusted DU profil actif sur CE device (via `isTrusted`
  de `core/state.js`). Si trusted → bouton wine "🔒 Révoquer pour cet
  appareil" avec confirm + `setTrusted(id, false)`. Hint explicatif
  "la confiance est locale à cet appareil (pas synchronisée)".

**Section 3 — 💾 Mes données** :
- **Export JSON perso** : génère un payload filtré au profil actif
  (profile + customPacks + customGuitars + banksAnn/Plug +
  toneNetPresets perso + aiCache + setlists où `profileIds` inclut
  moi). Inclut format version `mon-compte-export-v1`. Nom de fichier
  `backline_{name}_DDMMAA.json` (format date court FR).
- **Réinitialiser mon profil** : action destructive avec confirm
  détaillé. Vide rig + customs + banks + setlists solo + aiCache +
  guitarBias + preferredStyles. Garde nom + email + bio + avatar +
  password + loginHistory. Les setlists multi-profileIds restent
  intactes (seul le user actif est concerné).

#### Tab order et rétrocompat

**Avant Session B (8 tabs)** : Mes guitares · Mes appareils · Mes
sources · Mes presets custom · ⚙️ Préférences

**Après Session B (8 tabs, ordre réorganisé)** :
1. **👤 Mon compte** ← NOUVEAU premier tab
2. 🎸 Mes guitares
3. 📱 Mes appareils
4. 📦 Mes sources
5. 📦 Mes presets custom
6. ⚙️ Préférences
7. (devices selon enabledDevices)
8. (TMP si activé)

Le tab "🔐 Mot de passe" séparé n'existait déjà plus (le rendu avait
été retiré lors d'une refonte précédente, on a juste nettoyé le tabBtn).

**Default tab** : passé de `'profile'` à `'monCompte'` — le user
arrive maintenant directement sur Mon compte au lieu de Mes guitares.

**Rétrocompat `initTab`** : si caller passe encore `'password'` →
redirigé vers `'monCompte'`. Pareil pour `'display'`/`'reco'` →
`'preferences'` (déjà fait Session A).

### Bonus livré en même temps Session B

**Bonus.1 — `preferredStyles` câblé au prompt fetchAI** :
Phase 7.73.2 Session A avait ajouté le multi-select Styles préférés
mais le champ n'était pas envoyé à Gemini. Maintenant `fetchAI(...)`
accepte un 13e param `preferredStyles` et injecte dans le prompt :

> *"PRÉFÉRENCES MUSICALES USER : tu joues principalement {styles}.
> Soft hint contextuel — utile pour ajuster le ton de tes conseils
> (ex. analogies dans cot_step1, références d'autres morceaux du
> même style). Ne filtre PAS le scoring du morceau actuel selon ces
> préférences (le morceau garde son style spécifique)."*

10 call sites mis à jour (ListScreen ×2, HomeScreen ×2, SongDetailCard
×2, SetlistsScreen, MonProfilScreen, MaintenanceTab, AddSongModal).
AddSongModal passe `[]` vide (n'a pas accès à `profile` en props,
cohérent avec `'balanced'` + `'frfr'` déjà hardcodés).

**Bonus.2 — `preferredStyles` ajouté au profileHash (sync)** :
`profileHash` Phase 7.46 dans main.jsx étendu avec
`(p.preferredStyles||[]).slice().sort().join(',')`. Sinon un toggle
isolé du multi-select ne déclenchait pas le push Firestore (dette
notée Session A).

### Architecture livrée Session B + Bonus

```
src/main.jsx                            APP_VERSION 8.14.175 → 8.14.176
                                        profileHash : +preferredStyles
public/sw.js                            CACHE backline-v275 → backline-v276
src/app/screens/MonProfilScreen.jsx     +import isTrusted, setTrusted
                                        +import resizeImageToDataUrl
                                        tabBtn list : +monCompte premier,
                                          password retiré (déjà absent
                                          du rendu)
                                        normalizedInitTab : +'password'
                                          → 'monCompte'
                                        Default tab : 'profile' → 'monCompte'
                                        +{tab === 'monCompte' &&
                                          <MonCompteSection .../>}
                                        +function MonCompteSection (~200 lignes) :
                                          - state local (editingName,
                                            drafts name/bio/email,
                                            avatarErr)
                                          - 3 sections empilées <hr/>
                                          - Section Identité (avatar
                                            upload + nom inline + bio
                                            + email + badges)
                                          - Section Sécurité (réutilise
                                            PasswordTab + Trusted devices
                                            statut + bouton révoquer)
                                          - Section Mes données (export
                                            JSON filtré profil + reset
                                            avec confirm détaillé)
src/app/utils/fetchAI.js                fetchAI(...) +13e param preferredStyles
                                        +preferredStylesLine dans le prompt
                                        injecté entre outputContextLine
                                        et INSTRUCTIONS.
src/app/screens/ListScreen.jsx          2 call sites fetchAI étendus
src/app/screens/HomeScreen.jsx          2 call sites fetchAI étendus
src/app/screens/SongDetailCard.jsx      2 call sites fetchAI étendus
src/app/screens/SetlistsScreen.jsx      1 call site étendu
src/app/screens/MaintenanceTab.jsx      1 call site étendu
src/app/components/AddSongModal.jsx     1 call site étendu ([] vide)
src/i18n/en.js, es.js                   +profile.tab.mon-compte
                                        +~33 clés mon-compte.* trilingues
                                        (intro, section-identity/security/
                                        data, fields, avatar, badges,
                                        trusted-*, data-export-*, reset-*)
```

### Conséquences Session B + Bonus

- **1561/1561 tests verts** (aucun nouveau, MonCompteSection est UI
  pure sans test dédié à ce stade).
- Bundle 2583 → 2605 KB (+22 KB pour MonCompteSection + i18n + Bonus
  changements call sites).
- **Pas de bump STATE_VERSION** (champs `profile.avatar`, `profile.bio`,
  `profile.email` additifs optionnels, lecture défensive partout).
- **Pas de migration localStorage**.
- **Effet immédiat post-déploiement** :
  - Mon Profil ouvre désormais sur "👤 Mon compte" par défaut
  - User peut uploader son avatar + remplir bio + email
  - User peut révoquer trusted device sur son appareil
  - User peut exporter ses données JSON filtrées
- **Effet au re-fetch IA** : `preferredStyles` injecté dans le prompt
  → l'IA peut adapter le ton de ses conseils selon les styles préférés.

### Validation post-déploiement attendue

1. Reload PWA → `v8.14.176`
2. Mon Profil → **"👤 Mon compte" doit être le premier tab et ouvert par défaut**
3. Section Identité :
   - Avatar : cliquer "📷 Ajouter un avatar" → choisir une image →
     elle s'affiche en cercle 64×64
   - Nom : cliquer "Modifier" → input + boutons ✓/✕ → save Enter
   - Bio : taper du texte → blur → sauvegardé
   - Email : taper → blur → sauvegardé
   - Badges : ★ ADMIN apparaît pour Sébastien
4. Section Sécurité :
   - PasswordTab fonctionne normalement (change password + historique)
   - "Cet appareil est de confiance" affiché si trusted
   - Bouton wine "🔒 Révoquer" disponible si trusted
5. Section Mes données :
   - Cliquer "⬇ Exporter mes données" → fichier JSON téléchargé
   - Cliquer "🗑 Réinitialiser mon profil" → confirm modal détaillé
6. Switch FR/EN/ES → tous les labels traduits

### Dette résiduelle Session B

- **Pas de tests Vitest** sur MonCompteSection. Smoke test manuel
  obligatoire post-déploiement.
- **Reset profile**: la logique filter setlists solo
  (`profileIds.length === 1`) est pragmatique mais peut être trop
  conservatrice (cas multi-user). À affiner si signal user.
- **Import JSON** : pas livré Session B (export seul). Phase 7.73.2
  Session C peut l'ajouter si besoin. Pour l'instant le user export
  est suffisant (cas backup avant reset).
- **Email récup password** : champ stocké mais pas encore utilisé
  pour récupération réelle. Backend nécessaire (Phase ultérieure).
- **Avatar dans ProfileSelector** : actuellement ProfileSelector
  affiche juste l'initiale. Phase 7.73.2.1 future pourrait lire
  `profile.avatar` pour afficher la photo. Trivial (~10 min).

### Phase 7.73.2 — Status final

| Session | Status | Version |
|---|---|---|
| Session A — Tab ⚙️ Préférences + renommages | ✅ LIVRÉE 2026-05-23 nuit | 8.14.175 |
| Session B — Tab 👤 Mon compte (Identité + Sécurité + Mes données) | ✅ LIVRÉE 2026-05-23 matin | 8.14.176 |
| Session C — Activité + Communauté + Aide | ⏳ Pending (~2h) | — |

**Sessions A+B livrées** (~4h50 réelles vs 4h30 estimées). Session C
optionnelle (Activité + Communauté + Aide = bonus polish, pas core).

---

## État précédent (2026-05-23 nuit, Phase 7.73.2 Session A — Refonte Mon Profil avec tab ⚙️ Préférences)

**Backline v8.14.175 / SW backline-v275 / STATE_VERSION 11 / 1561 tests verts.**

### Phase 7.73.2 Session A — Refonte tabs Mon Profil (v8.14.175)

Première session du chantier Phase 7.73.2 (validée 2026-05-19,
implémentée 2026-05-23). Structure consolidée des tabs de Mon Profil
avec création d'un tab **"⚙️ Préférences"** fusionné + renommages
de cohérence.

#### Changements UI

**Tabs avant Session A (10 tabs visibles selon device+admin)** :
1. 🎸 Guitares
2. 📱 Mes appareils
3. 📦 Sources
4. 📦 Mes presets custom
5. 🎨 Affichage
6. 🎯 Préférences IA
7. 🔐 Mot de passe

**Tabs après Session A (8 tabs)** :
1. 🎸 **Mes guitares** ← renommé
2. 📱 Mes appareils
3. 📦 **Mes sources** ← renommé
4. 📦 Mes presets custom
5. **⚙️ Préférences** ← NOUVEAU (fusionne Affichage + Préférences IA + Préférences musicales)
6. 🔐 Mot de passe

**Tab "⚙️ Préférences"** contient 3 sous-sections empilées avec
séparateurs horizontaux (`<hr/>`) :

1. **🎨 Affichage** : thème (sombre/clair) + langue (FR/EN/ES) —
   contenu identique à l'ancien tab Phase 7.36
2. **🎯 Préférences IA** : recoMode (Équilibré/Fidèle/Interprétation)
   + outputContext (FRFR/Casque/PA) + guitarBias par style +
   "🔄 Réinitialiser mes analyses" + bouton admin "🗑 Invalider tous
   les caches IA" — contenu identique à l'ancien tab Phase 7.1
3. **🎵 Préférences musicales** (NOUVEAU) : multi-select des styles
   préférés du user (Blues / Rock / Hard rock / Jazz / Metal / Pop)
   avec boutons toggle. Stocké dans `profile.preferredStyles:
   string[]`. Indicatif pour l'IA, pas de filtre strict.

#### Rétrocompat initTab

Le prop `initTab` (passé depuis main.jsx via `setScreen` /
`onNavigate`) accepte encore `'display'` ou `'reco'` comme valeurs
historiques : normalisation inline dans `MonProfilScreen` qui
redirige vers `'preferences'`. Évite les régressions navigation
depuis bookmarks / sessionStorage tonex_active_tab si elles
existent.

#### Schéma data — additif

Ajout du champ optionnel `profile.preferredStyles: string[]`
(ex. `['blues', 'rock']`). Default `undefined` ou tableau vide.

**Pas de bump STATE_VERSION** (purement additif, retro-compat OK
via Array.isArray check).

### Architecture livrée Session A

```
src/main.jsx                            APP_VERSION 8.14.174 → 8.14.175
public/sw.js                            CACHE backline-v274 → backline-v275
src/app/screens/MonProfilScreen.jsx     +normalizedInitTab (rétrocompat
                                          'display'/'reco' → 'preferences')
                                        tabBtn list : retire display/reco,
                                          ajoute preferences, renomme
                                          guitars → "Mes guitares",
                                          sources → "Mes sources"
                                        Bloc {tab === 'display' && …} +
                                          {tab === 'reco' && …} fusionnés
                                          en {tab === 'preferences' && …}
                                          avec 3 sous-sections (séparateurs
                                          <hr/>, headers fontSize 14)
                                        +section 3 "Préférences musicales" :
                                          multi-select 6 styles avec
                                          toggle boutons + état actif
                                          ✓ accent. Stocké dans
                                          profile.preferredStyles.
src/i18n/en.js, es.js                   profile.tab.guitars : "My guitars"
                                          / "Mis guitarras"
                                        profile.tab.sources : "My sources"
                                          / "Mis fuentes"
                                        +profile.tab.preferences : "⚙️
                                          Preferences" / "Preferencias"
                                        +preferences.* (intro, section-*,
                                          musical-styles-*, 6 styles labels)
                                        ~16 nouvelles clés × 2 langues
```

### Conséquences Session A

- **1561/1561 tests verts** (aucun nouveau test, refacto UI pure).
- Bundle 2583 KB stable (compensation ajouts/retraits).
- **Pas de bump STATE_VERSION**, **pas de migration**.
- **Cohérence renommages** : "Mes guitares" + "Mes appareils" +
  "Mes sources" + "Mes presets custom" + "Mon compte" (à venir
  Session B).
- **Fenêtre 1h30 respectée**.

### Validation post-déploiement attendue

1. Reload PWA → `v8.14.175`
2. Mon Profil :
   - ✅ Tabs renommés "Mes guitares" et "Mes sources"
   - ✅ Plus de tabs séparés "🎨 Affichage" et "🎯 Préférences IA"
   - ✅ Nouveau tab "⚙️ Préférences" au milieu de la liste
3. Cliquer "⚙️ Préférences" :
   - ✅ 3 sous-sections empilées avec séparateurs
   - 🎨 Affichage en haut (thème + langue)
   - 🎯 Préférences IA au milieu (recoMode + outputContext + guitarBias + Réinitialiser caches)
   - 🎵 Préférences musicales en bas (NOUVEAU : 6 boutons toggle styles)
4. Toggle un style (ex. "Rock") → vérifier que :
   - L'état actif s'affiche (vert + ✓)
   - `JSON.parse(localStorage.tonex_guide_v2).profiles.{id}.preferredStyles`
     contient `['rock']`
5. Switch FR/EN/ES → tous les labels traduits

### Prochaines sessions Phase 7.73.2

**Session B (cœur Mon compte)** : Identité + Sécurité (migration
PasswordTab) + Mes données + retrait tab Password. ~3h.

**Session C (finitions)** : Activité + Communauté + Aide. ~2h.

Cf design CLAUDE.md "Idées en attente" Phase 7.73.2 pour le
détail des sections restantes.

### Dette résiduelle Session A

- **`profile.preferredStyles` non câblé au prompt IA** : actuellement
  stocké mais pas envoyé à Gemini. Phase 7.73.2.1 ajoutera une ligne
  au prompt fetchAI ("PRÉFÉRENCES MUSICALES USER : tu joues
  principalement {styles}, hint contextuel pour l'IA"). ~30 min,
  reporté Session B ou C selon priorité.
- **Pas de sync Firestore explicit pour `preferredStyles`** : le
  champ est inclus dans le push profil habituel (LWW Phase 5.7),
  donc déjà sync. Mais syncHash main.jsx Phase 7.46 ne contient
  pas ce champ → un changement isolé `preferredStyles` ne
  déclenche pas le push. À ajouter au profileHash. ~5 min,
  Session B.

---

## État précédent (2026-05-23 nuit, Phase 9.7.1 — honest framing capture vs réglages post-capture)

**Backline v8.14.174 / SW backline-v274 / STATE_VERSION 11 / 1561 tests verts.**

### Phase 9.7.1 — Honest framing "point de départ" (v8.14.174)

**Question Sébastien** (2026-05-23 post-Phase 9.7) : *"je me demande
comment l'IA propose les ajustements EQ etc. sachant que la capture
a probablement déjà des réglages physiques sur l'ampli ?"*

Excellent point conceptuel qui touche au cœur du fonctionnement
TONEX. Une capture (TONE MODEL) contient déjà FIGÉS les réglages
physiques de l'ampli original (gain/EQ/presence des potards du vrai
ampli, type/distance/axis du micro). Le créateur de pack (TSR, AA,
JS, ML) calibre ces réglages POUR QUE LA CAPTURE SONNE BIEN telle
quelle. Les boutons preset_settings_v1 Phase 9.1 sont des SETTINGS
POST-CAPTURE qui s'additionnent par-dessus dans le firmware, ils
ne touchent PAS aux potards de l'ampli physique.

L'IA Gemini ne connaît PAS le profil tonal interne de la capture
choisie. Elle propose donc des valeurs en supposant que la capture
est "neutre", ce qui n'est pas toujours vrai.

#### Mitigation court terme — Honest framing (Phase 9.7.1)

**Prompt fetchAI ÉTAPE 7 étendu** avec un bloc "CONTEXTE CRUCIAL"
qui explique à Gemini :
- La capture contient déjà figés les réglages physiques de l'ampli
- preset_settings_v1 = settings POST-CAPTURE additifs, pas absolus
- L'IA ne connaît PAS le profil tonal de la capture
- Conséquence : privilégier des valeurs NEUTRES (5/5/5/5/5) sauf
  raison spécifique du morceau, éviter les extrêmes
- Le vrai dialing empirique passe par les tweaks ÉTAPE 7C
- Rôle de l'IA : poser un POINT DE DÉPART RAISONNABLE, pas
  reproduire à la perfection (hors de son contrôle)

**UI SongDetailCard** — mention italique discrète juste sous le
titre "🎛️ Réglages pédale (suggérés par l'IA)" :

> *"Point de départ — la capture intègre déjà les réglages physiques
> de l'ampli original. Affine à l'oreille avec les ajustements
> ci-dessous."*

Trilingue FR/EN/ES via nouvelle clé `preset-settings.starting-point`.
Format : inline, fontSize 9, italique, color text-dim. Pas pliable
(info importante mais courte).

#### Solution long terme — Phase 11 `tone_profile` per-capture

Documentation détaillée ajoutée dans la section Phase 11 "Idées en
attente" : enrichir chaque capture du catalog avec un profil tonal
estimé par son créateur (`mid_character`, `treble_character`,
`bass_character`, `compression`, `breakup_threshold`,
`presence_emphasis`). L'IA tient compte du profil pour des recos en
delta plutôt qu'absolues (Phase 9.7.2 hypothétique).

Seul le créateur du pack peut fournir ces métadonnées (Sébastien ne
peut pas écouter et catégoriser 600+ captures). D'où l'approche
Studio-driven Phase 11.

Décision actuelle : design documenté, **pas d'implémentation avant
Phase 11 globale + signal pilote studio**.

### Architecture livrée Phase 9.7.1

```
src/main.jsx                            APP_VERSION 8.14.173 → 8.14.174
public/sw.js                            CACHE backline-v273 → backline-v274
src/app/utils/fetchAI.js                ÉTAPE 7 : +bloc "CONTEXTE CRUCIAL —
                                          Capture vs réglages post-capture"
                                          qui explique à Gemini la limitation
                                          et oriente vers valeurs neutres
src/app/screens/SongDetailCard.jsx      +mention italique "Point de départ"
                                          sous le titre Réglages pédale
src/i18n/en.js, es.js                   +1 clé preset-settings.starting-point
                                          (trilingue FR inline + EN + ES)
CLAUDE.md                               +sous-section "Tone profile per-capture"
                                          dans Phase 11 Idées en attente :
                                          schéma data, caractéristiques tonales
                                          énum, bénéfice IA recos en delta,
                                          pourquoi Studio-driven viable seul
                                          chemin, effort estimé
```

### Conséquences Phase 9.7.1

- **1561/1561 tests verts** (aucun nouveau test, pure modif prompt
  + UI mention).
- Bundle 2581 → 2583 KB (+2 KB : prompt étendu + i18n + mention UI).
- **Pas de bump STATE_VERSION**, pas de migration.
- **Effet immédiat (display)** : la mention "Point de départ"
  apparaît sous le titre Réglages pédale sans re-fetch.
- **Effet au re-fetch** : Gemini suit le nouveau framing et propose
  des valeurs plus neutres (moins de Mid 7.5 ou Treble 8 absolus
  sans justification spécifique du morceau).

### Validation post-déploiement attendue

1. Reload PWA → `v8.14.174`
2. Sans re-fetch : ouvrir n'importe quelle fiche song → vérifier
   que la mention "Point de départ — la capture intègre déjà les
   réglages physiques..." apparaît sous le titre Réglages pédale,
   en italique discrète.
3. Re-fetch d'un morceau → vérifier que les valeurs proposées
   restent plus proches de 5/5/5/5/5 (sauf si le morceau a vraiment
   un profil tonal extrême style thrash ou ambient).
4. Switch FR/EN/ES → texte localisé OK.

### Dette résiduelle Phase 9.7.1

- **Le respect du framing dépend de Gemini**. Si l'IA continue à
  proposer des valeurs extrêmes systématiquement, fallback Phase
  9.7.2 : post-process JS qui plafonne les écarts vs neutre (5)
  à ±2 sauf raison style spécifique. Coût ~1h dev. À monitorer.
- **Phase 11 + tone_profile** : solution structurelle long terme.
  Documentée dans CLAUDE.md "Idées en attente" Phase 11. À activer
  quand Phase 11 Studio-driven démarre (signal pilote studio
  partenaire requis, probablement Paul Drew TSR si réponse Mail 3
  positive).

### Famille Phase 9 — État final définitif

| Sous-phase | Status | Version |
|---|---|---|
| 9.1 MVP table chiffrée | ✅ | 8.14.160 |
| 9.2 N1 FX ON/OFF + type | ✅ | 8.14.172 |
| 9.2 N2 sub-params (= 9.7) | ✅ | 8.14.173 |
| 9.3 EQ avancé 4-bandes | Reporté | — |
| 9.4 ONE TWEAK + hotfixes | ✅ | 8.14.167 |
| 9.5 Playing hints + polish | ✅ | 8.14.169 |
| 9.6 Déduplication + hotfixes | ✅ | 8.14.172 |
| 9.7 Refonte UI + sub-params | ✅ | 8.14.173 |
| 9.7.1 Honest framing post-capture | ✅ | 8.14.174 |
| 9.7.2 Post-process clamp extrêmes | Reporté (si signal user) | — |

**Famille Phase 9 close à 100%**. Phase 11 + tone_profile reste
comme solution structurelle long terme (documentée).

---

## État précédent (2026-05-23 nuit, Phase 9.7 — FX blocks Niveau 2 + refonte section pédale 3 sous-sections)

**Backline v8.14.173 / SW backline-v273 / STATE_VERSION 11 / 1561 tests verts.**

### Phase 9.7 — FX blocks Niveau 2 + regroupement section pédale (v8.14.173)

Constat Sébastien post-Phase 9.2 Niveau 1 sur Hells Bells :
**incohérence visuelle** entre les "Boutons ALT" et la "Blocs effets" :
- "Gate threshold -80dB" affiché dans alt knobs
- MAIS Noise Gate **OFF** dans la section blocs effets
- Idem pour "Comp threshold 0dB" + Compressor OFF

→ Pollution UI + contradiction perçue. Le user ne sait pas si le gate
est actif ou pas. Phase 9.7 résout en **regroupant tous les params
FX par bloc** + en ajoutant les **sub-params Niveau 2** demandés
par Sébastien.

#### Sub-params Niveau 2 par bloc (manuel TONEX p.22-28)

```
Noise Gate   : enabled + threshold (depuis alt) + release (5-500ms) + depth (-100/-20dB)
Compressor   : enabled + threshold (depuis alt) + gain (-30/+10dB) + attack (1-51ms)
Modulation   : enabled + type (Chorus/Tremolo/Phaser/Flanger/Rotary) — Niveau 1 préservé
Delay        : enabled + type (Digital/Tape) + mode (Normal/Ping.Pong) + time (0-1000ms) +
               feedback (0-100%) + mix (0-100%)
Reverb       : enabled + type (Spring 1/2/3/4/Room/Plate) + time (0-10) +
               pre_delay (0-500ms) + color (-10/+10) + mix (0-100%, depuis alt.reverb_mix
               en priorité, fallback fx_blocks.reverb.mix)
```

**Correction REVERB_TYPES enum** : Phase 9.2 N1 avait `[Spring, Plate,
Room, Hall, Shimmer]` qui ne correspond pas au firmware. Phase 9.7
livre les **6 types officiels** : `[Spring 1, Spring 2, Spring 3,
Spring 4, Room, Plate]`. Hall et Shimmer retirés (les aiCache pré-9.7
avec ces types les verront droppés silencieusement à la prochaine
validation — minoritaire).

**Nouveau DELAY_MODE enum** : `[Normal, Ping.Pong]` (le point est
intentionnel, conforme firmware TONEX).

**Modulation reste en Niveau 1** : pas de sub-params (rate/depth/level)
ajoutés. Si signal user explicit → Phase 9.7.1 dédié.

#### Architecture data — threshold/mix non-dupliqués

Décision design : **garder gate_threshold + comp_threshold + reverb_mix
dans `preset_settings_v1.alt` (Phase 9.1)** plutôt que les déplacer
dans `fx_blocks.*`. Avantages :
- Rétro-compat totale avec aiCache pré-9.7
- Pas de migration nécessaire
- Côté UI Phase 9.7, on **affiche ces 3 valeurs sous leur bloc
  respectif dans la section Effets** (lecture inter-objets)

Helper `clampFxBlocks` étendu avec `FX_BLOCK_RANGES` (manuel TONEX) :
clamp chaque sub-param dans son range, drop si hors-format (non-numérique,
NaN, Infinity), skip champs inconnus. +19 tests Vitest dédiés (sub-params
in-range/hors-bornes, types valides, scénarios Hells Bells/For Whom the
Bell Tolls/Under Pressure).

#### UI — refonte section "🎛️ Réglages pédale" en 3 sous-sections

**Avant Phase 9.7** :
```
🎛️ Réglages pédale
├── Boutons principaux (5)
├── Boutons ALT mode avancé (5 : Presence + Depth + Reverb_mix + Comp_threshold + Gate_threshold)
└── 🎚 Blocs effets (5 lignes ON/OFF)
```

**Après Phase 9.7** :
```
🎛️ Réglages pédale
├── Boutons principaux (5 inchangés)
├── EQ avancé (2 : Presence + Depth) ← filtré si fx_blocks présent
└── 🎚 Effets (5 blocs avec leurs sub-params dépliés sous le bloc si enabled)
    ├── Noise Gate    [type? ON/OFF]    Threshold -80dB · Release 140ms · Depth -75dB    ↳ why
    ├── Compressor    [type? ON/OFF]    Threshold -18dB · Gain 2dB · Attack 10ms          ↳ why
    ├── Modulation    [type ON/OFF]                                                       ↳ why
    ├── Delay         [type ON/OFF]     Mode Normal · Time 320ms · Feedback 25% · Mix 14% ↳ why
    └── Reverb        [type ON/OFF]     Time 5 · Pre-delay 25ms · Color 2 · Mix 16%       ↳ why
```

**Fallback gracieux** : si `aiC.fx_blocks` absent (aiCache pré-9.2 ou
pré-9.7), comportement Phase 9.1 préservé (5 ALT knobs en bloc, section
Effets absente).

#### Prompt fetchAI ÉTAPE 7C étendue (Phase 9.7)

Le prompt demande désormais les sub-params numériques + le `mode`
delay + types corrigés. Règles d'adaptation par style mises à jour :
- thrash → noise_gate ON (release 80, depth -75), reverb Plate (time 2.5, pre_delay 12, color -2, mix 8)
- blues → compressor ON (gain 0, attack 15), reverb Spring 2 (time 4, mix 25)
- ambient → delay Tape Normal (time 480, feedback 40, mix 25), reverb Plate (time 7, mix 35)
- classic rock → tous OFF sauf reverb Spring 2/Room basse
- funk → compressor ON, reverb Room courte
- worship → chorus, delay Digital, reverb Plate

#### i18n FR/EN/ES (12 nouvelles clés)

- `preset-settings.section-eq-advanced` : "EQ avancé" / "Advanced EQ" / "EQ avanzado"
- `fx-blocks.section-title` retitré : "🎚 Effets" / "🎚 Effects" / "🎚 Efectos"
  (avant Phase 9.2 : "🎚 Blocs effets" / "Effect blocks" / "Bloques de efectos")
- `fx-params.*` : 11 labels universels short (Threshold, Release, Depth,
  Gain, Attack, Mode, Time, Feedback, Mix, Pre-delay, Color). FR
  préserve "Gain"/"Mode"/"Time"/"Mix" universels, ES localise
  Threshold→Umbral, Gain→Ganancia, Attack→Ataque, Mode→Modo,
  Time→Tiempo, Mix→Mezcla.

### Architecture livrée Phase 9.7

```
src/main.jsx                            APP_VERSION 8.14.172 → 8.14.173
public/sw.js                            CACHE backline-v272 → backline-v273
src/core/scoring/preset-settings.js     FX_TYPE_ENUMS.reverb corrigé
                                          (Hall/Shimmer retirés, Spring 1-4 + Room + Plate)
                                        +FX_TYPE_ENUMS.delay_mode (Normal/Ping.Pong)
                                        +FX_BLOCK_RANGES (sub-params officiels manuel)
                                        clampFxBlock étendu :
                                          +clamp sub-params via FX_BLOCK_RANGES
                                          +mode delay (case-insensitive enum)
                                        commentaire docstring complet Niveau 2
src/core/scoring/preset-settings.test.js +19 tests Phase 9.7 :
                                          - REVERB_TYPES corrigé (Spring 1-4)
                                          - DELAY_MODES (Normal/Ping.Pong)
                                          - Sub-params noise_gate/compressor/delay/reverb
                                          - Hors-bornes clampés, non-numériques skip
                                          - Modulation Niveau 1 préservé
                                          - Scénarios réels Hells Bells/Bell Tolls/Under Pressure
src/core/scoring/index.js               re-export FX_BLOCK_RANGES
src/app/utils/fetchAI.js                ÉTAPE 7C étendue Niveau 2 :
                                          ranges officiels manuel TONEX
                                          listés par sub-param.
                                          Adaptation contextuelle par style
                                          avec sub-params suggérés.
                                        JSON template inline mis à jour
                                          (reverb Spring 2 avec sub-params).
                                        Listes trilingue/scalaires étendues.
src/app/screens/SongDetailCard.jsx      ALT knobs filtré si fx_blocks
                                          présent (Presence/Depth seuls)
                                        Section "🎚 Effets" enrichie :
                                          subParamsFor(key, block) helper
                                          local qui construit la liste de
                                          sub-params à afficher en
                                          combinant alt (threshold/mix) +
                                          fx_blocks (sub-params Niveau 2).
                                          Rendu compact "Label1 Val1 · Label2 Val2".
src/i18n/en.js, es.js                   +12 clés Phase 9.7 (section-eq-advanced,
                                          fx-params.* × 11)
```

### Conséquences Phase 9.7

- **1561/1561 tests verts** (+19 nouveaux Phase 9.7 sur clampFxBlocks Niveau 2).
- Bundle 2574 → 2581 KB (+7 KB : helper étendu + UI sub-params +
  i18n + prompt).
- **Pas de bump STATE_VERSION** (additif sur sub-params optionnels
  fx_blocks, rétrocompat aiCache pré-9.7 garantie).
- **Pas de migration localStorage**.
- **Pas de risque sync** : `fx_blocks` voyage avec `aiCache.result`.
- **Effet immédiat partiel (display-side)** sans re-fetch :
  - Bloc "Boutons ALT mode avancé" devient "EQ avancé" si fx_blocks
    présent, filtré à Presence + Depth.
  - Threshold gate/comp/reverb_mix s'affichent sous leur bloc dans
    la section Effets (vue regroupée cohérente).
  - Les aiCache Phase 9.2 N1 (sans sub-params) restent valides : la
    section Effets reste compacte (ON/OFF + type sans sub-params).
- **Effet complet au re-fetch** : la section Effets affiche les
  sub-params numériques fournis par Gemini.

### Famille Phase 9 — État final

| Sous-phase | Status | Version |
|---|---|---|
| 9.1 MVP table chiffrée | ✅ | 8.14.160 |
| 9.2 N1 FX blocks ON/OFF + type | ✅ | 8.14.172 |
| 9.2 N2 sub-params (= Phase 9.7) | ✅ | 8.14.173 |
| 9.3 EQ avancé | Reporté (signal power-user) | — |
| 9.4 ONE TWEAK + hotfixes | ✅ | 8.14.167 |
| 9.5 Playing hints + polish | ✅ | 8.14.169 |
| 9.6 Déduplication + hotfixes | ✅ | 8.14.172 |
| 9.7 FX Niveau 2 + refonte UI 3 sous-sections | ✅ | 8.14.173 |

**Famille Phase 9 close en Niveau 2**. Niveau 3 EQ avancé (Phase 9.3)
reporté.

### Validation post-déploiement attendue

1. Reload PWA → `v8.14.173`
2. **Sans re-fetch** : ouvrir Hells Bells (aiCache Phase 9.2 N1) :
   - ✅ Bloc "Boutons ALT mode avancé" → renommé "EQ avancé"
   - ✅ Plus que Presence + Depth dans EQ avancé
   - ✅ Threshold/mix déplacés dans section Effets sous leur bloc
   - Gate threshold -80dB visible **sous** Noise Gate OFF
     (cohérent : on voit que le bloc est OFF mais on garde la valeur
     du threshold qui resterait la valeur cible si on l'activait)
3. **Avec re-fetch** : "🔄 Réinitialiser mes analyses" + re-batch :
   - ✅ Sub-params apparaissent pour les blocs ON :
     - Reverb ON → Type Spring 2 + Time 2 + Pre-delay 5 + Color 0 + Mix 10%
     - (etc. selon le morceau)
   - ✅ Si type Hall/Shimmer en cache pré-9.7 → droppé silencieusement
   - ✅ Delay mode Normal/Ping.Pong respecté
4. Switch FR/EN/ES → labels sub-params traduits (Threshold/Umbral,
   Gain/Ganancia, Attack/Ataque, etc.), valeurs numériques universelles

### Dette résiduelle Phase 9.7

- **Modulation Niveau 1** intentionnel (Sébastien a explicitement
  exclu Mod du Niveau 2). Si signal user pour Chorus rate/depth/level
  → Phase 9.7.1 dédié, ~30 min.
- **EQ avancé (Phase 9.3)** : les 4 bandes paramétriques `eq` du
  firmware TONEX restent non exposées. Power-users uniquement. À
  activer si demande explicite.
- **Cohabitation pré-9.7 avec Hall/Shimmer** : un aiCache Phase 9.2
  N1 avec `type: 'Hall'` verra son `type` droppé au re-clamp
  Phase 9.7. Le bloc reste `enabled` mais sans type → UI montre
  "Reverb ON" sans badge type. Cosmétique mineur, se résout au
  re-fetch.

---

## État précédent (2026-05-22 nuit, Phase 9.6.2 + 9.2 — finitions famille Phase 9 + FX blocks ON/OFF)

**Backline v8.14.172 / SW backline-v272 / STATE_VERSION 11 / 1542 tests verts.**

### Phase 9.6.2 + 9.2 — fin de la famille Phase 9 (v8.14.172)

3 livraisons dans ce commit :

#### Phase 9.6.1 (hotfix avant) — stripTypeSuffix sur cot_step2 name

(Cf section "État précédent" — appliqué à 8.14.171.) Le check `cotTop?.name`
matchait pas `displayIdealGuitarName` à cause du suffix "(HB)" / "(SC)"
ajouté par Gemini. Strip du `\s*\([^)]*\)\s*$` avant comparison.

#### Phase 9.6.2 — Mini-cleanup déduplication

**Fix 1 — "Reverb_mix" → "Reverb mix"** : Gemini copie parfois le nom
de variable JSON avec underscore dans le `fix` du tweak. Post-process
inline `String(tweak.fix).replace(/_/g, ' ')` au render. Cosmétique
pure.

**Fix 2 — Bloc 3 reason masqué si dupliquée avec cot_step2[0]** :
`guitarChoiceFeedback` retourne `kind: 'ai'` avec la reason du cot
entry correspondant à la guitare. Si la guitare choisie matche
`cot_step2[0]?.name` (modulo strip suffix type), la reason est déjà
rendue dans Bloc 2 → on masque la 3e répétition. Cas `kind: 'tokens'`
(heuristique pros/cons) et `kind: 'desc'` restent visibles car
infos distinctes.

#### Phase 9.2 Niveau 1 — FX blocks ON/OFF + type

Adresse le pain point Bruno (For Whom the Bell Tolls : *"est ce que
l'IA a connaissance des effets appliqués aux preset et les inclut
dans son raisonnement"*) en exposant l'état des 5 blocs effets du
preset TONEX (manuel p.22-28).

**Niveau 1 = MVP minimal** : `enabled` boolean + `type` optionnel
selon enum. Pas de sub-params (rate/depth/time/feedback/mix) — ces
valeurs détaillées restent dans `preset_settings_v1.alt` Phase 9.1
(reverb_mix, comp_threshold, gate_threshold) sans duplication.

**Format `aiResult.fx_blocks`** :

```json
{
  "noise_gate": { "enabled": boolean,                      "why": {fr,en,es} },
  "compressor": { "enabled": boolean,                      "why": {fr,en,es} },
  "modulation": { "enabled": boolean, "type": MOD_TYPE,    "why": {fr,en,es} },
  "delay":      { "enabled": boolean, "type": DELAY_TYPE,  "why": {fr,en,es} },
  "reverb":     { "enabled": boolean, "type": REVERB_TYPE, "why": {fr,en,es} }
}
```

Enums officiels (`FX_TYPE_ENUMS` exporté) :
- **MOD_TYPE** : Chorus / Tremolo / Phaser / Flanger / Rotary
- **DELAY_TYPE** : Digital / Tape
- **REVERB_TYPE** : Spring / Plate / Room / Hall / Shimmer

**Helper pur `clampFxBlocks(raw)`** dans `preset-settings.js` :
- `enabled` non-boolean → drop bloc entier
- `type` hors enum → drop type, garde enabled (match case-insensitive,
  retourne version canonique)
- `why` validé via `validateTrilingual` (skip si invalide)
- Cap : 5 blocs `FX_BLOCK_KEYS` connus, autres ignorés (ex. `eq`)

15 tests Vitest dédiés. Re-export depuis `core/scoring/index.js`.
Validation au render via `enrichAIResult` + flag `_fxBlocksValidated`
(pattern Phase 9.1).

**Prompt fetchAI ÉTAPE 7C** : entre ÉTAPE 7B (PLAYING HINTS) et
CONSIGNE PHRASING. Demande l'état et type pour les 5 blocs + why
trilingue 10-15 mots par bloc. Règles d'adaptation contextuelle
(thrash → noise_gate ON, compressor OFF, mod/delay OFF, reverb Plate
bas ; blues → comp ON, reverb Spring ; ambient → reverb Hall + delay
Tape ; etc.). Pas de duplication avec gate_threshold / comp_threshold
qui restent dans alt knobs Phase 9.1.

**UI SongDetailCard** : nouvelle sous-section "🎚 Blocs effets"
au-dessous des tweaks dans le bloc "🎛️ Réglages pédale". 5 lignes
compactes `{Label}                    {type?} {ON/OFF badge}`.
Badge ON (vert) / OFF (gris). Toggle "▸ Pourquoi ces FX ?" pour
révéler les why per-block (pattern Phase 7.86 + 9.4).

**i18n FR/EN/ES** : 10 nouvelles clés (`fx-blocks.section-title`,
`.noise-gate`, `.compressor`, `.modulation`, `.delay`, `.reverb`,
`.on`, `.off`, `.why-show`, `.why-hide`).

### Architecture livrée Phase 9.6.2 + 9.2

```
src/main.jsx                            APP_VERSION 8.14.171 → 8.14.172
public/sw.js                            CACHE backline-v271 → backline-v272
src/core/scoring/preset-settings.js     +FX_BLOCK_KEYS, FX_TYPE_ENUMS
                                        +clampFxBlock helper interne
                                        +clampFxBlocks helper exporté
                                        commentaire docstring étendu
src/core/scoring/preset-settings.test.js +15 tests Phase 9.2 (enums,
                                        helper, blocs malformés,
                                        type case-insensitive,
                                        scénarios thrash/AC/DC)
src/core/scoring/index.js               re-export FX_BLOCK_KEYS,
                                        FX_TYPE_ENUMS, clampFxBlocks
src/app/utils/ai-helpers.js             +import clampFxBlocks
                                        enrichAIResult : +validation
                                        fx_blocks + flag _fxBlocksValidated
src/app/utils/fetchAI.js                ÉTAPE 7C "FX BLOCKS Niveau 1"
                                        entre ÉTAPE 7B et CONSIGNE
                                        PHRASING. Règles adaptation
                                        contextuelle par style.
                                        JSON template inline étendu.
                                        Listes trilingue/scalaires
                                        étendues.
src/app/screens/SongDetailCard.jsx      +useState showFxWhy
                                        +section "🎚 Blocs effets"
                                        sous tweaks dans bloc
                                        Réglages pédale
                                        +Phase 9.6.2 : fix Reverb_mix
                                        post-process replace _ → space
                                        +Phase 9.6.2 : masquer fbText
                                        Bloc 3 si chosenGuitar matche
                                        cot_step2[0] (kind:'ai' only)
src/i18n/en.js, es.js                   +10 clés Phase 9.2 (fx-blocks.*)
```

### Conséquences Phase 9.6.2 + 9.2

- **1542/1542 tests verts** (+15 nouveaux Phase 9.2 sur clampFxBlocks).
- Bundle 2566 → 2574 KB (+8 KB : helper + tests + UI section + i18n
  + prompt étendu).
- **Pas de bump STATE_VERSION** (additif sur aiResult.fx_blocks,
  rétrocompat aiCache pré-9.2 via skip UI si absent).
- **Pas de migration localStorage**.
- **Pas de risque sync** : `fx_blocks` voyage avec `aiCache.result`.
- **Effet immédiat 9.6.2** (display-side, pas de re-fetch nécessaire) :
  - "Reverb_mix +5" devient "Reverb mix +5" dans les tweaks
  - Bloc 3 reason masqué si déjà visible en Bloc 2
- **Effet 9.2 au re-fetch** : la section "🎚 Blocs effets" apparaît
  après re-batch d'une setlist. Sans re-fetch, l'aiCache pré-9.2
  n'a pas `fx_blocks` → section invisible (fallback gracieux).

### Famille Phase 9 — État final

| Sous-phase | Status | Version |
|---|---|---|
| 9.1 MVP table chiffrée | ✅ | 8.14.160 |
| 9.2 FX blocks Niveau 1 (ON/OFF + type) | ✅ | 8.14.172 |
| 9.2.1 FX blocks Niveau 2 (sub-params) | Reporté (signal user) | — |
| 9.3 EQ avancé | Reporté (signal power-user) | — |
| 9.4 ONE TWEAK | ✅ + 9.4.1 + 9.4.2 hotfixes | 8.14.167 |
| 9.5 Playing hints | ✅ + 9.5.1 + 9.5.2 polish | 8.14.169 |
| 9.6 Déduplication conseils guitare | ✅ + 9.6.1 + 9.6.2 hotfixes | 8.14.172 |

**Famille Phase 9 close en MVP**. Niveau 2 sub-params (9.2.1) et EQ
avancé (9.3) reportés selon signal user.

### Validation post-déploiement attendue

1. Reload PWA Mac + iPhone → `v8.14.172`
2. **Sans re-fetch** : ouvrir Hells Bells :
   - ✅ Bloc 3 reason "C'est l'instrument indissociable d'Angus..."
     doit DISPARAÎTRE (déjà dans Bloc 2 scoring)
   - ✅ Tweak "Reverb_mix +5" doit devenir "Reverb mix +5"
3. "🔄 Réinitialiser mes analyses" → re-batch
4. Ré-ouvrir Hells Bells (et 1-2 autres morceaux variés) :
   - ✅ Section "🎚 Blocs effets" apparaît sous les tweaks dans le
     bloc Réglages pédale
   - ✅ Sur AC/DC (Hells Bells) : Noise Gate OFF + Compressor OFF +
     Mod OFF + Delay OFF + Reverb ON (Spring probable) — son sec
   - ✅ Sur thrash (For Whom the Bell Tolls) : Noise Gate ON +
     Compressor OFF + Mod OFF + Delay OFF + Reverb ON (Plate basse)
   - ✅ Sur blues clean (Thrill is Gone) : Noise Gate OFF +
     Compressor ON + Mod OFF + Delay OFF + Reverb ON (Spring 20-30%)
5. Toggle "▸ Pourquoi ces FX ?" → 5 lignes d'explication par bloc

### Dette résiduelle Phase 9.2

- **Niveau 2 sub-params** : Phase 9.2.1 reportée. Bruno demandait
  surtout la connaissance par l'IA des effets dans son raisonnement
  (atteint Niveau 1). Si besoin de tunabilité fine (rate Chorus,
  feedback Delay, color Reverb), Phase 9.2.1 ~4-5h dev.
- **EQ avancé** : Phase 9.3 reportée. Power-users uniquement (les 4
  bandes paramétriques `eq` du firmware TONEX). VIR mic placement
  skip v1. ~2h dev si signal user explicit.
- **Coordonnance gate/comp threshold** : la consigne prompt suggère
  cohérence entre `fx_blocks.noise_gate.enabled` et
  `preset_settings_v1.alt.gate_threshold`. Si Gemini retourne un
  conflit (gate ON + threshold -100dB = inutile), pas de
  cross-validation côté helper. Acceptable car cosmétique mineur.

---

## État précédent (2026-05-22 soir, Phase 9.6 — déduplication conseils guitare)

**Backline v8.14.170 / SW backline-v270 / STATE_VERSION 11 / 1527 tests verts.**

### Phase 9.6 — Déduplication conseils guitare (v8.14.170)

Constat post-déploiement Phase 9.5 (Hells Bells) par Sébastien :
**3 blocs UI parlaient du pickup / tone / volume** :
1. "Réglages : Micro chevalet · Tone 7-9 · Volume 10"
   (`localGuitarSettings` heuristique)
2. "💡 Conseil IA : Chevalet · Tone 10 (open) · Volume 8-10"
   (`playing_hints` IA Phase 9.5)
3. Prose `settings_guitar` : *"Utilise le micro chevalet... baisse à
   7-8 pour l'intro..."*

→ Triple redondance bruyante. Aussi observé : bloc `guitar_reason`
dupliquait souvent `cot_step2_guitars[0].reason` (même guitare top).

#### 3 changements concrets

**1. UI : masquer le bloc "Réglages" local quand `playing_hints` présent**

`SongDetailCard` Bloc 3 : `localGuitarSettings` était toujours rendu.
Désormais gated `!aiC.playing_hints` → fallback gracieux pour les
aiCache pré-9.5 (qui n'ont pas de playing_hints), masqué pour les
re-fetchés Phase 9.5+. Au render, on a soit le bloc local (legacy)
soit le bloc "💡 Conseil IA" (Phase 9.5), jamais les deux.

**2. UI : masquer `guitar_reason` quand il duplique cot_step2[0]**

`SongDetailCard` Bloc 2 : check `displayIdealGuitarName ===
cot_step2_guitars[0].name` (case-insensitive trim). Si match (cas
courant) → masque `guitar_reason` (déjà couvert par la 1ère entrée
du scoring). Si diffère (cas family boost Phase 7.64 où l'ideal
remonte par boost +15 et change la top) → affiche `guitar_reason`
qui apporte alors une valeur contextuelle.

Pas de modif prompt — effet immédiat post-déploiement sur les
aiCache existants.

**3. Prompt fetchAI : recadrer `settings_guitar`**

Nouvelle section "CONSIGNE DE PHRASING POUR settings_guitar (Phase
9.6 — déduplication)". Interdit explicitement la répétition des
valeurs scalaires déjà couvertes par `playing_hints` (pickup,
guitar_volume, guitar_tone) :

À FAIRE :
- Décrire les TRANSITIONS de section (verse→chorus→solo, intro→riff)
- Conseils de TECHNIQUE de jeu : palm muting, attaque médiator,
  bends, vibrato, slides, hammer-ons, contrôle dynamique
- Conseils contextuels guitare spécifiques (technique de pouce,
  médiator plus dur, etc.)

À ÉVITER ABSOLUMENT :
- Répéter les valeurs déjà dans playing_hints ("utilise le micro
  chevalet", "volume à 10", "tone à 10") → redondance bruyante
- Indiquer une valeur scalaire fixe (pickup, volume, tone) sans
  qu'elle soit en transition/contextuelle au cours du morceau

Effet : nécessite re-fetch pour bénéficier (le prompt influence
l'output IA, pas les aiCache existants).

### Architecture livrée Phase 9.6

```
src/main.jsx                            APP_VERSION 8.14.169 → 8.14.170
public/sw.js                            CACHE backline-v269 → backline-v270
src/app/screens/SongDetailCard.jsx      +gate !aiC.playing_hints sur
                                          le bloc "Réglages :" local
                                        +check displayIdealGuitarName
                                          === cot_step2[0]?.name avant
                                          rendu guitar_reason
src/app/utils/fetchAI.js                CONSIGNE DE PHRASING
                                          settings_guitar étendue :
                                          interdit répétition
                                          pickup/volume/tone,
                                          focus transitions/techniques
```

### Conséquences Phase 9.6

- **1527/1527 tests verts** (aucun nouveau, modif UI + prompt purement
  display/prompt-side).
- Bundle 2564 → 2566 KB (+2 KB commentaires + consigne prompt étendue).
- **Pas de bump STATE_VERSION**, **pas de migration**.
- **Effet partiel immédiat** (sans re-fetch) :
  - Masquage du bloc "Réglages :" local pour aiCache post-9.5 (qui
    ont déjà playing_hints) ✅
  - Masquage de guitar_reason si match avec cot_step2[0] ✅
- **Effet complet au re-fetch** :
  - `settings_guitar` ne répète plus les valeurs scalaires (Gemini
    suit la nouvelle consigne)
  - Focus prose sur les transitions et techniques

### Validation post-déploiement attendue

1. Reload PWA → `v8.14.170`
2. Ouvrir Hells Bells (déjà analysé Phase 9.5) :
   - ✅ Le bloc "Réglages : Micro chevalet · Tone 7-9 · Volume 10"
     doit DISPARAÎTRE (playing_hints présent)
   - ✅ Le bloc "💡 Conseil IA : Chevalet · Tone 10 (open) ·
     Volume 8-10" reste seul
   - Le bloc "Guitare Gibson SG Standard Ebony 99% — guitar_reason"
     devrait être MASQUÉ (cot_step2[0] = Gibson SG → match)
3. Lancer une ré-analyse via "🔄 Réinitialiser mes analyses"
4. À l'arrivée du nouveau résultat, vérifier que la prose
   "Guitare : ..." (settings_guitar) ne mentionne PLUS le pickup
   ou les valeurs de volume/tone, mais parle de transitions
   ("baisse à 7 pour l'intro, remonte à 10 pour le riff") ou
   techniques (palm muting, attaque)
5. Test sur un morceau metal/thrash → vérifier que settings_guitar
   parle de palm muting + attaque + chord work, pas de "Use bridge
   pickup volume 10"

### Dette résiduelle Phase 9.6

- **Le respect du recadrage prompt dépend de Gemini Flash**. Si
  l'IA continue à inclure "Utilise le micro chevalet" en redondance,
  fallback : post-process JS qui détecte les patterns
  pickup/volume/tone dans settings_guitar et les strip. ~30 min
  Phase 9.6.1.
- **Bloc "Guitare {nom}" sans guitar_reason** quand match → reste
  affiché juste avec le score (peu informatif). Acceptable car
  les détails sont déjà dans le scoring cot_step2 juste au-dessus.
- **Possibilité future Phase 9.7** : retirer carrément `guitar_reason`
  du prompt (tokens économisés ~50-100/fetch) et masquer le bloc
  entièrement. Acceptable si on confirme que le cas family boost
  est marginal (déjà rare en pratique).

---

## État précédent (2026-05-22 soir, Phase 9.5 — playing hints structurés (pickup / volume / tone / stereo))

**Backline v8.14.168 / SW backline-v268 / STATE_VERSION 11 / 1510 tests verts.**

### Phase 9.5 — Playing hints structurés (v8.14.168)

Suite à Phase 9.4 stabilisée (avec hotfixes 9.4.1 prompt MIN 3 + 9.4.2
maxOutputTokens 4096 → 8192), Phase 9.5 complète la famille Phase 9
avec des conseils de jeu **structurés et scalaires**. Inspiré
directement de l'output Ok_Ask2411 "Gear Assistant" (peer-builder
2026-05-15 : pickup choice + guitar volume + picking style + stereo).

#### Schéma `playing_hints` (additif sur `aiResult`, pas sur preset_settings_v1)

```json
"playing_hints": {
  "pickup": "Bridge",                  // ou "Neck", "Position 4 (Middle+Bridge)", "Bridge+Neck"...
  "guitar_volume": "8-10",             // range plutôt que valeur unique
  "guitar_tone": "10 (open)",          // pareil
  "stereo": false                       // true rare (delay ping-pong, ambient, dual-amp)
}
```

- **4 champs scalaires courts** : pas trilingue (les noms de pickup,
  les ranges et les flags bool sont universels). Évite la duplication
  avec `settings_guitar` prose trilingue.
- **Tous optionnels** : `clampPlayingHints` preserve partial.
- **picking_style volontairement EXCLU** : déjà couvert par
  `settings_guitar` (prose nuancée "Use neck pickup for verses,
  switch to bridge for solo"). Pas de duplication.

#### Helper pur `clampPlayingHints(raw)`

Dans `src/core/scoring/preset-settings.js`. Drop silencieux des
strings vides/non-strings, stereo non-boolean ignoré, retourne null
si tout vide. 11 tests Vitest dédiés (full / partial / null /
edge cases). Re-export depuis `src/core/scoring/index.js`.

#### Validation au render via `enrichAIResult`

Cabled dans `src/app/utils/ai-helpers.js` après la validation
`preset_settings_v1`. Flag `_playingHintsValidated` pour idempotence
(même pattern Phase 9.1).

#### Prompt fetchAI étendu

Nouvelle ÉTAPE 7B "PLAYING HINTS" dans le prompt, juste après ÉTAPE 7
preset_settings_v1. Demande explicite des 4 champs + règles
d'adaptation au type de guitare (Strat 5-positions vs LP 3-positions
vs HSS vs P-90), range plutôt que valeur unique, stereo:false par
défaut (true seulement si réellement justifié). JSON template inline
+ listes scalaires étendues.

#### UI SongDetailCard — Bloc 3 "Mon setup"

Nouveau bloc "💡 Conseil IA :" inséré juste sous le bloc "Réglages :"
existant (qui vient de `localGuitarSettings` heuristique local).
Format : `💡 Conseil IA : Position 4 (Middle+Bridge) · Tone 7-9 ·
Volume 8-10`. Si `stereo === true`, badge brass "🎚️ STEREO" en
fin de ligne. Skip silencieux si `playing_hints` absent (rétro-
compat aiCache pré-9.5 → bloc invisible).

**Note de design** : on conserve `localGuitarSettings` (heuristique
local, instantané) ET `playing_hints` IA (contextuel au morceau)
côte à côte plutôt que remplacement. Permet de comparer "défaut
guitar-only" vs "spécifique pour ce morceau". Si le user veut juste
le quick start, il lit le 1er bloc ; si il veut creuser, le 2e.

#### i18n FR/EN/ES (2 clés)

- `playing-hints.ai-advice` : "💡 Conseil IA :" / "💡 AI advice:" /
  "💡 Consejo IA:"
- `playing-hints.stereo` : "🎚️ STEREO" (identique 3 langues, label
  universel)

### Architecture livrée Phase 9.5

```
src/main.jsx                            APP_VERSION 8.14.167 → 8.14.168
public/sw.js                            CACHE backline-v267 → backline-v268
src/core/scoring/preset-settings.js     +clampPlayingHints helper pur
                                        export
src/core/scoring/preset-settings.test.js +11 tests Phase 9.5 (full,
                                        partial, null, trim, strings
                                        vides, non-string, stereo
                                        non-bool, champ inconnu)
src/core/scoring/index.js               re-export clampPlayingHints
src/app/utils/ai-helpers.js             enrichAIResult :
                                          +validation playing_hints
                                          via clampPlayingHints
                                          + flag _playingHintsValidated
src/app/utils/fetchAI.js                ÉTAPE 7B nouvelle section
                                        "PLAYING HINTS" entre ÉTAPE 7
                                        et CONSIGNE DE PHRASING.
                                        JSON template inline étendu
                                        avec playing_hints au niveau
                                        root (pas dans preset_settings_v1).
                                        Liste scalaires étendue.
src/app/screens/SongDetailCard.jsx      +bloc "💡 Conseil IA" inséré
                                        sous "Réglages :" dans Bloc 3
                                        Mon setup. Skip si playing_hints
                                        absent. Badge STEREO optionnel.
src/i18n/en.js, es.js                   +2 clés Phase 9.5
                                        (playing-hints.ai-advice + .stereo)
```

### Conséquences Phase 9.5

- **1510/1510 tests verts** (+11 nouveaux Phase 9.5 sur clampPlayingHints).
- Bundle 2560 → 2564 KB (+4 KB pour helper + tests + UI + i18n +
  prompt étendu).
- **Pas de bump STATE_VERSION** (additif sur aiResult.playing_hints,
  rétrocompat garantie via skip UI si absent).
- **Pas de migration localStorage**.
- **Pas de risque sync** : `playing_hints` voyage avec le reste de
  `aiCache.result`.
- **Effet immédiat** : prochaine analyse IA d'un morceau retourne
  playing_hints. Sur les fiches existantes pré-9.5, le bloc
  "💡 Conseil IA" reste invisible jusqu'au re-fetch. Pour basculer
  tous les aiCache : "🔄 Réinitialiser mes analyses" Mon Profil →
  🎯 Préférences IA (par profil) + re-batch.

### Dette résiduelle Phase 9.5

- **Pas d'override par utilisateur** : si l'utilisateur n'aime pas
  le pickup proposé par l'IA, il peut juste le voir comme un conseil
  contextuel (pas appliqué automatiquement). Phase 9.5.1 si signal
  user pourrait ajouter un toggle "✓ Appliquer ce conseil" qui
  cascade dans le bloc Réglages localGuitarSettings.
- **`stereo: true` est très rare en pratique** : Gemini ne devrait
  l'activer que sur des morceaux ambient / delay ping-pong / dual-
  amp explicit. À monitorer en pratique (post-déploiement) si l'IA
  abuse du flag.
- **Pas de tests UI smoke** sur le bloc 💡 Conseil IA. Le test
  unitaire couvre seulement le helper.

### Validation post-déploiement attendue

1. Reload PWA Mac + iPhone → vérifier `v8.14.168`.
2. Ouvrir une fiche song déjà analysée pré-9.5 → bloc "💡 Conseil
   IA" doit être ABSENT (rien à révéler tant que pas re-fetché).
3. "🔄 Réinitialiser mes analyses" + re-batch.
4. Ouvrir un morceau → bloc "💡 Conseil IA : {pickup} · Tone {x} ·
   Volume {y}" doit apparaître **sous** le bloc "Réglages : ..."
   existant.
5. Vérifier que les valeurs sont **adaptées à la guitare proposée** :
   - Stratocaster → mention "Position 2/4" possible
   - LP/SG → "Neck" ou "Bridge"
   - Tele → "Neck" ou "Bridge" (pas Position 2-4 — Tele à 3 positions)
6. Sur un morceau ambient / delay ping-pong (rare), vérifier que
   badge "🎚️ STEREO" apparaît.
7. Switch FR / EN / ES → label "💡 Conseil IA" se localise, les
   valeurs scalaires (pickup, tone, volume) restent universelles.

---

## État précédent (2026-05-22 soir, Phase 9.4 — "ONE TWEAK TO FIX IT" : ajustements empiriques post-écoute)

**Backline v8.14.165 / SW backline-v265 / STATE_VERSION 11 / 1499 tests verts.**

### Phase 9.4 — Section "ONE TWEAK TO FIX IT" (v8.14.165)

Complète la famille Phase 9 (Phase 9.1 MVP table chiffrée livrée
2026-05-21). Phase 9.4 ajoute une section pédagogique conditionnelle
de 6-8 ajustements empiriques post-écoute, spécifiques au morceau
analysé (pas une canned list générique). Pattern inspiré de l'output
Ok_Ask2411 "Gear Assistant" (peer-builder, retour 2026-05-15).

#### Schéma `preset_settings_v1.tweaks` (additif vs Phase 9.1/7.86)

```json
"tweaks": [
  {
    "symptom": { "fr":"trop brillant sur FRFR", "en":"too bright on FRFR", "es":"demasiado brillante en FRFR" },
    "fix": "Treble -0.5 + Presence -0.3"
  },
  ...
]
```

- `symptom` : objet trilingue `{fr, en, es}` validé via
  `validateTrilingual` (Phase 7.86 helper existant)
- `fix` : string courte au format universel "Param ±N" ou
  "Param ±N + Param ±N" (pas de prose, pas de traduction — les noms
  de paramètres TONEX sont universels)
- Cap dur 8 items (constant `TWEAKS_MAX` exposé)
- Drop silencieux des entrées malformées (symptom absent/invalide,
  fix absent/non-string/vide)
- Field optionnel sur `preset_settings_v1` → aiCache pré-Phase 9.4
  continue à fonctionner sans le champ.

#### Helper pur `clampTweaks(raw)`

Nouveau export depuis `src/core/scoring/preset-settings.js`. Retourne
un tableau d'entrées validées ou `null` si :
- input n'est pas un Array
- tous les entries sont malformés
- array vide après filtrage

Integré dans `clampPresetSettings` (output `out.tweaks` ou
undefined). 22 nouveaux tests Vitest (clampTweaks isolé + tweaks
intégrés à preset_settings_v1 complet).

#### Prompt fetchAI ÉTAPE 7 étendu

Ajout d'une section **CONSIGNE TWEAKS (Phase 9.4) — "ONE TWEAK TO
FIX IT"** qui demande à Gemini 6-8 tweaks adaptés au contexte du
morceau (style/gain/pickup/contexte d'écoute). Règles explicites :
- Format symptom trilingue 3-6 mots
- Format fix universel "Param ±N" (préfère 0.3-0.5, pas 1.0 entier)
- Adaptation au contexte (thrash → Gate/Gain/Presence ; blues →
  Reverb/Comp/Mid ; FRFR → Treble/Presence ; pickups SC → Mid/Volume)
- Anti-générique : pas de canned list recyclée entre morceaux

JSON template inline étendu avec exemples concrets. `tweaks[].symptom`
ajouté à la liste des champs trilingues. `tweaks[].fix` ajouté à la
liste des champs scalaires.

#### UI SongDetailCard

Nouvelle section repliée sous le bloc "🎛️ Réglages pédale" (Bloc 2
Phase 7.86), sous le toggle "▸ Pourquoi ces valeurs ?" :

```
🔧 Si ça ne sonne pas tout à fait juste... (N)
  ↓ (au click)
  ┌─────────────────────────────────────────────┐
  │ Si trop brillant sur FRFR → Treble -0.5 +   │
  │                              Presence -0.3   │
  │ Si noyé dans le mix groupe → Mid +0.5 +     │
  │                               Volume +0.3    │
  │ ... (jusqu'à 8 entrées)                      │
  └─────────────────────────────────────────────┘
```

- State `showTweaks` (useState false, default replié — préserve la
  densité visuelle, expose uniquement quand l'utilisateur en a
  besoin)
- Skip si `ps.tweaks` absent ou vide (rétro-compat aiCache pré-9.4)
- Drop entrées invalides au render (symptom localisé absent ou fix vide)
- Compteur dynamique dans le label du toggle via `tFormat({count})`

#### i18n FR/EN/ES (3 clés)

- `tweaks.toggle-show` : "🔧 Si ça ne sonne pas tout à fait
  juste... ({count})" / "🔧 If it doesn't sound quite right...
  ({count})" / "🔧 Si no suena del todo bien... ({count})"
- `tweaks.toggle-hide` : "▲ Masquer les ajustements ({count})" /
  "▲ Hide tweaks ({count})" / "▲ Ocultar los ajustes ({count})"
- `tweaks.if` : "Si" / "If" / "Si"

### Architecture livrée Phase 9.4

```
src/main.jsx                            APP_VERSION 8.14.164 → 8.14.165
public/sw.js                            CACHE backline-v264 → backline-v265
src/core/scoring/preset-settings.js     +TWEAKS_MAX constant (8)
                                        +clampTweaks helper pur exporté
                                        clampPresetSettings : +out.tweaks
                                        commentaire docstring étendu
src/core/scoring/preset-settings.test.js +22 tests Phase 9.4 :
                                        clampTweaks isolé (15 cases)
                                        + tweaks intégrés (7 cases)
src/app/utils/fetchAI.js                ÉTAPE 7 : +section CONSIGNE
                                        TWEAKS avec règles d'adaptation
                                        contextuelle + format fix
                                        JSON template +tweaks[]
                                        Listes trilingues/scalaires
                                        étendues avec tweaks[].symptom
                                        / .fix
src/app/screens/SongDetailCard.jsx      +useState showTweaks
                                        +section ONE TWEAK TO FIX IT
                                        repliée par défaut, sous le
                                        toggle why per-knob, dans le
                                        bloc Réglages pédale
src/i18n/en.js, es.js                   +3 clés tweaks.* (toggle-show,
                                        toggle-hide, if)
```

### Conséquences Phase 9.4

- **1499/1499 tests verts** (+22 nouveaux Phase 9.4 sur preset-settings).
- Bundle 2556 → 2560 KB (+4 KB pour helper + tests + section UI +
  i18n + prompt étendu).
- **Pas de bump STATE_VERSION** (additif sur preset_settings_v1,
  rétrocompat aiCache pré-9.4 garantie via clampTweaks tolérant à
  l'absence du champ).
- **Pas de migration localStorage**.
- **Effet immédiat post-déploiement** : prochaine analyse IA d'un
  morceau (mount fiche avec rigStale OU batch "🤖 Analyser/MAJ N")
  retourne tweaks[]. Sur les fiches existantes pré-9.4, le toggle
  reste invisible jusqu'au re-fetch (rien à révéler). Pour basculer
  tous les aiCache : "🔄 Réinitialiser mes analyses" Mon Profil →
  🎯 Préférences IA (par profil) + re-batch.
- **Pas de risque sync** : `tweaks[]` voyage avec le reste de
  `aiCache.result` via push profil habituel (Phase 7.54 per-profile
  + Phase 7.81 LWW par ts).

### Dette résiduelle Phase 9.4

- **Le respect du format `fix` dépend de Gemini Flash**. Si l'IA
  retourne de la prose ("Baisse un peu les aigus") au lieu de
  "Treble -0.5", le helper accepte (fix est juste validé non-vide).
  Si trop de drift observé, post-processing JS pour normaliser le
  format pourra être ajouté Phase 9.4.1.
- **Pas de tests d'intégration "prompt → output"** : on valide le
  helper et l'UI séparément. Smoke-test manuel post-déploiement
  obligatoire (ouvrir 2-3 fiches re-analysées, vérifier que les
  tweaks sont contextuels et pas génériques).
- **Pas de localisation du `fix`** : le format "Treble -0.5 +
  Presence -0.3" reste universel. Si un beta-testeur signale que
  les noms de paramètres en anglais gênent les utilisateurs FR/ES,
  étendre vers `fix: {fr, en, es}` Phase 9.4.2.

### Validation post-déploiement attendue

1. Reload PWA Mac + iPhone → vérifier `v8.14.165` dans le header.
2. Ouvrir une fiche song déjà analysée pré-9.4 → vérifier que le
   bloc "🎛️ Réglages pédale" s'affiche normalement, **sans** le
   toggle "🔧 Si ça ne sonne pas tout à fait juste..." (rien à
   révéler tant que pas re-fetché).
3. Mon Profil → 🎯 Préférences IA → "🔄 Réinitialiser mes analyses"
   → ouvrir un morceau OU lancer batch "🤖 Analyser/MAJ N".
4. Au retour de l'IA, vérifier qu'apparaît le toggle "🔧 Si ça ne
   sonne pas tout à fait juste... (N)" sous "▸ Pourquoi ces
   valeurs ?".
5. Click → liste de 6-8 tweaks au format `Si {symptom} →
   {fix}`. Vérifier que les tweaks sont **spécifiques** au morceau
   (ex : un morceau metal HG doit parler de Gate threshold + Gain,
   un blues clean doit parler de Reverb mix + Comp threshold), pas
   génériques.
6. Switch de langue → vérifier que les symptoms sont localisés,
   les fix restent universels ("Treble -0.5 + Presence -0.3").

---

## État précédent (2026-05-21 nuit, Phase 7.74.9 — Fix pollution profile occurrence #8 : timestamp dédié banks + hardening aiCache)

**Backline v8.14.164 / SW backline-v264 / STATE_VERSION 11 / 1479 tests verts.**

### Phase 7.74.9 — Pollution profile occurrence #8 : timestamp dédié `banksModified` (v8.14.164)

**Bug observé 2026-05-21 soir** : 8e occurrence de la pollution profile.
Banques Anniversary de Sébastien à nouveau réverties (79/150 slots,
slot 23C vidé — signature occ #5), Mac ET iPhone corrompus, MALGRÉ
les fixes 7.74.7 + 7.74.8 déployés en v8.14.162.

**Capture forensique décisive** (`window.__getMergeDebugLogs()`, Mac) :
3 logs `[merge-defense] sebastien SUSPECT banksAnn mass-change : adoption
remote remplace 79 slots (log seul, pas de blocage)` aux 15:52, 16:29
et 20:25. Le log Phase 7.74.7 **détectait** mais ne **bloquait pas** —
décision explicite à l'époque.

### Cause racine (canal de propagation, pas amplificateur)

`mergeProfileLWW` (`src/core/state.js:830`) adoptait `banksAnn`/
`banksPlug` **en bloc** via `merged = { ...remote }` dès que
`remote.lastModified > local.lastModified`. Or `lastModified` est un
timestamp **global au profil** : toute écriture (édition de sources,
ouverture d'un morceau via `setSongAiCache` stampant, login, etc.)
faisait gagner le LWW à TOUS les champs, banks comprises — même
quand le device n'avait pas touché aux banks (et avait éventuellement
des banks périmées). `myGuitars` a 3 couches de défense ; `banksAnn`/
`banksPlug` n'en avaient **aucune** — seulement un log Phase 7.74.7.

Les fixes 7.74.7 (`recordLogin`) et 7.74.8 (`migrateV9toV10`) fermaient
deux **amplificateurs** de re-stamp `lastModified`, mais le **canal
de propagation** (adoption en bloc des banks) restait ouvert.

### Fix principal — timestamp dédié aux banks

1. **Schéma v10 → v11** : nouveau champ optionnel
   `profile.banksModified: number`. STATE_VERSION 10 → 11.
2. **Migration `migrateV10toV11`** : backfill `banksModified=0` pour
   tous les profils existants (volontairement 0, pas `lastModified`
   — état neutre qui ne fait gagner aucun appareil tant que personne
   n'a fait d'édition réelle post-migration). Idempotente.
3. **`ensureProfileV11`** : pose `banksModified=0` si absent au pull
   d'un profil pré-v11. Idempotent.
4. **Stamp** (`src/main.jsx` `setProfileField`) : quand `field` vaut
   `'banksAnn'` ou `'banksPlug'`, on stamp `banksModified=Date.now()`
   en plus de `lastModified`. Seule une édition réelle de banks
   déclenche le stamp dédié.
5. **`mergeProfileLWW`** : section banks réécrite. Adopte les banks
   remote SEULEMENT si `(remote.banksModified || 0) >
   (local.banksModified || 0)` ; sinon keep local. Le log forensique
   du diff de slots est conservé mais reformulé (`ADOPTED` vs
   `BLOCKED` selon la décision réelle). `merged.banksModified =
   max(lbm, rbm)` pour cohérence avec `lastModified`.

### Hardening secondaire (couplé)

- **`setSongAiCache` ne stamp plus `lastModified`** (`src/main.jsx`).
  Une écriture aiCache (ouverture d'un morceau, rescore) n'est pas
  une « modification du profil » au sens LWW per-field — elle se
  propage déjà via le merge aiCache per-songId qui s'auto-arbitre
  via `ts` per-entry (Phase 7.81). Stamper `lastModified` ici
  amplifiait gratuitement le LWW pour tous les autres champs.
- **`mergeProfileLWW` merge l'aiCache dans les DEUX branches**
  (rts > lts ET rts <= lts). Helper extrait
  `mergeAiCachePerSongId(local, remote)` retourne `{ merged,
  changed }`. Sans ce changement, une nouvelle analyse ne descendrait
  plus jamais sur l'autre device puisque `setSongAiCache` ne fait
  plus avancer `lastModified`. Identité préservée quand `changed`
  est false (pas de clone gratuit).

### Architecture livrée Phase 7.74.9

```
src/main.jsx                APP_VERSION 8.14.163 → 8.14.164
                            setProfileField : stamp banksModified
                              quand field ∈ {banksAnn, banksPlug}
                            setSongAiCache : retire stamp lastModified
public/sw.js                CACHE backline-v263 → backline-v264
src/core/state.js           STATE_VERSION 10 → 11
                            +ensureProfileV11 / ensureProfilesV11
                            +migrateV10toV11 (backfill banksModified=0)
                            +mergeAiCachePerSongId (helper extrait,
                              utilisé dans les 2 branches LWW)
                            mergeProfileLWW :
                              - branche rts<=lts : merge aiCache, sinon
                                identité local
                              - banks : LWW dédié via banksModified
                                (adopt seulement si remote>local)
                              - log forensique reformulé ADOPTED/BLOCKED
                            makeDefaultProfile : pose banksModified=0
                            exports +ensureProfileV11, ensureProfilesV11,
                              migrateV10toV11
                            _runFullChain : ajoute migrateV10toV11
                            loadState : accepte v10 (migrate vers v11)
src/core/state.test.js      STATE_VERSION attend 11 (vs 10)
                            buildDemoSnapshot version attend 11
                            +13 tests Phase 7.74.9 (bank-dedicated LWW
                              + scénario bug #8 + récupération
                              + migrateV10toV11 + ensureProfileV11)
                            test branche rts<=lts adapté (merge aiCache
                              au lieu de identity-only)
                            +1 test régression : aiCache identique →
                              identité local préservée (pas de clone)
docs/SYNC.md                +section Phase 7.74.9 (canal de propagation
                              vs amplificateur, fix dédié, invariant)
                            +ligne table régressions
docs/INVESTIGATION_POLLUTION_PROFILE.md
                            Session 3 + occurrence #8 : Phase 7.74.9
                              marquée ✅ LIVRÉE avec détails
```

### Conséquences Phase 7.74.9

- **1479/1479 tests verts** (+16 vs baseline 1463 : 13 Phase 7.74.9 +
  3 adaptations Phase 7.74.7/7.80.2 obsolètes).
- Bundle 2551 → 2556 KB (+5 KB pour helper + tests + sections doc
  équivalentes en runtime).
- **Bump STATE_VERSION 10 → 11** : migration purement additive
  (`banksModified=0` backfill), idempotente. Aucune donnée
  utilisateur perdue.
- **Cohabitation v10/v11** : un device pré-7.74.9 push un state v10
  (sans `banksModified`) → device post-7.74.9 le pull,
  `ensureProfileV11` pose `banksModified=0` → asymétrie sûre (le
  device avec `banksModified > 0` réel — une édition post-fix — gagne
  contre un device pré-fix qui a `banksModified=0` implicite). Tests
  Vitest dédiés à ce cas.
- **Cas-cible attendu post-déploiement** : sur Mac et iPhone tous
  deux à jour v8.14.164 :
  1. Sébastien restaure manuellement ses banks Anniversary depuis
     CSV → `setProfileField('banksAnn', ...)` stamp
     `banksModified=Date.now()` → push Firestore inclut le nouveau
     timestamp.
  2. Sur iPhone (s'il avait des banks périmées avec `banksModified`
     antérieur ou 0), le pull → `mergeProfileLWW` voit
     `remote.banksModified > local.banksModified` → adopte les banks
     fraîches du Mac. Log forensique `ADOPTED 79 slots remplacés`.
  3. Toute écriture future non-banks (édition de sources, ouverture
     d'un morceau, login) ne touche plus `banksModified` → ne peut
     plus faire écraser les banks par une version antérieure même
     si `lastModified` global est gonflé.

### Validation post-déploiement attendue

1. Reload PWA Mac + iPhone → `v8.14.164` dans le header.
2. Console : `JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.banksModified`
   doit être présent (0 initialement, puis `Date.now()` à la
   première édition de banks via UI).
3. Activer wrapper Phase 7.74.5 si pas déjà :
   `localStorage.__backline_persist_logs = 'true'` + reload.
4. Faire une édition réelle de bank (BankEditor → modifier 1 slot)
   → vérifier log `banksAnn mass-change ADOPTED` au prochain pull
   sur l'autre device.
5. Surveiller 48-72h. Si aucune nouvelle occurrence du pattern
   `banksAnn mass-change BLOCKED ... 79 slots`, la pollution est
   éteinte. Si `BLOCKED` apparaît, c'est exactement ce qu'on veut :
   la pollution est désormais visible ET stoppée.

### Dette résiduelle Phase 7.74.9

- **Aucun test d'intégration multi-device automatisé** (Vitest pure
  helpers seulement). Test manuel Mac↔iPhone obligatoire au
  déploiement.
- **`stampedProfileUpdate` helper Phase 7.74 Couche 1** : ne stamp
  pas encore `banksModified` automatiquement. Pas critique : les
  sites coupables identifiés Phase 7.74 ne touchaient pas aux banks
  (`MesAppareilsTab` toggle device → `enabledDevices`,
  `ProfilesAdmin` password/rename, `ProfileTab` delete custom
  guitar). Si un futur site écrit `banksAnn`/`banksPlug` via
  `stampedProfileUpdate`, ajouter la même branche conditionnelle.
- **Invariant à documenter pour les futurs développeurs** : tout
  champ critique sensible aux régressions massives (banks, settings
  système, etc.) devrait avoir son propre timestamp dédié, pas se
  fier au `lastModified` global. Documenté dans `docs/SYNC.md`
  section « Phase 7.74.9 » invariant final.

---

## État précédent (2026-05-21 fin de nuit++, Phase 7.86 — Refonte SongDetailCard 3 blocs + why per-knob)

**Backline v8.14.163 / SW backline-v263 / STATE_VERSION 10 / 1463 tests verts.**

### Phase 7.86 — Refonte fiche song 3 blocs + sticky bandeau + why per-knob (v8.14.163)

Retour user 2026-05-21 nuit : la fiche dépliée actuelle est dense et
mélange recommandations IA théoriques avec custom utilisateur. Refonte
en 3 blocs distincts + sticky bandeau en tête + explication par
paramètre de la table Réglages pédale.

#### Structure UI nouvelle

```
┌─ Sticky bandeau (top) ──────────────────────────────────┐
│ 🎸 [GuitarSelect]  🔌 [Sortie audio : profil ↻/📢/🎧/🎚️]  💬 │
└─────────────────────────────────────────────────────────┘

┌─ Bloc 1 — 📚 Infos morceau ─────────────────────────────┐
│ • Titre, BPM, key, desc, history (factuel)              │
│ • Profil tonal IA (cot_step1)                           │
│ • Profil ampli idéal IA (cot_step3_amp)                 │
└─────────────────────────────────────────────────────────┘

┌─ Bloc 2 — 🎯 Recommandations IA ────────────────────────┐
│ • Scoring guitares (cot_step2_guitars filtered rig)     │
│ • Guitare idéale ★ + guitar_reason                      │
│ • Preset/capture idéal + alternatives catalogue         │
│ • 🎛️ Table Réglages pédale (Phase 9.1 + value+why)      │
│   - Why global trilingue                                │
│   - ▸ Pourquoi ces valeurs ? (toggle replié) — Phase 7.86│
│ • settings_preset + settings_guitar prose               │
└─────────────────────────────────────────────────────────┘

┌─ Bloc 3 — 🎸 Mon setup ─────────────────────────────────┐
│ Sur ta {guitare} : (rappel défense scroll long)         │
│ • Compatibilité % + raisons + pickup/tone/volume        │
│ • ▸ Mode reco avancé (toggle replié — Phase 7.3)        │
│ • Mes presets installés (per device)                    │
│ • Suggestion amélioration si score < 90%                │
└─────────────────────────────────────────────────────────┘
```

#### Changements détaillés

**Sticky bandeau** (nouveau, en tête de fiche, `position: sticky top: 0`) :
- GuitarSelect (déplacé de section 4)
- Override outputContext compact 4 boutons (déplacé de section 4)
- Bouton 💬 feedback toggle (raccourci vers section feedback IA en bas)
- Reste visible quand on scroll dans la fiche

**Bloc 1 = ancien SECTION 1 enrichi** :
- Titre renommé "📖 Infos morceau" → "📚 Infos morceau"
- Ajout `cot_step1` (profil tonal IA) et `cot_step3_amp` (profil ampli IA)
  en sous-blocs en bas, déplacés depuis l'ancien SECTION 2 (Raisonnement
  IA pliable)

**SECTION 2 (Raisonnement IA pliable) supprimée** :
- Son contenu cot_step1/cot_step3 → Bloc 1 (ci-dessus)
- Son contenu cot_step2_guitars → tête de Bloc 2
- Le toggle `showCot` state retiré (plus utilisé)

**Bloc 2 = ancien SECTION 3 enrichi** :
- Titre renommé "Recommandation idéale" → "🎯 Recommandations IA"
- Ajout `cot_step2_guitars` (scoring) en tête (déplacé de SECTION 2)
- Le reste inchangé (ideal_guitar, preset, alternatives, settings, table
  Réglages pédale)

**Bloc 3 = ancien SECTION 4 nettoyé** :
- Titre renommé "Paramétrage — mon choix" → "🎸 Mon setup"
- **Retiré** : GuitarSelect (dans sticky), outputContext override (dans
  sticky), bloc Mode IA boutons direct
- **Ajouté** : rappel "Sur ta {guitar} :" en tête (utile si sticky scrollé
  hors vue sur fiche longue)
- Mode IA Phase 7.3 désormais replié sous toggle "▸ Mode reco avancé"
  (préserve la fonctionnalité pour power-users, désencombre pour
  débutants)
- Le reste inchangé (compat, réglages local, best installed, suggestion
  amélioration)

#### Schéma preset_settings_v1 étendu

Évolution du format Phase 9.1 (knob = number) vers Phase 7.86
(knob = `{value, why}`) :

```json
"preset_settings_v1": {
  "cab_enabled": true,
  "main": {
    "gain":   { "value": 6.2, "why": { "fr":"...", "en":"...", "es":"..." } },
    "bass":   { "value": 4.5, "why": { ... } },
    ... (5 main knobs)
  },
  "alt": {
    "presence":       { "value": 4.7, "why": { ... } },
    ... (5 alt knobs)
  },
  "why": { "fr":"résumé global","en":"...","es":"..." }
}
```

**Rétro-compat** : `clampPresetSettings` tolère l'ancien format
(knob = number) et coerce vers `{value: number}`. Les aiCache Phase
9.1-10 continuent à fonctionner — leur `why` per-knob sera vide, donc
le toggle "▸ Pourquoi ces valeurs ?" ne s'affiche pas (rien à révéler).

**Toggle UI** "▸ Pourquoi ces valeurs ?" (replié par défaut) : si au
moins un knob a un why, le bouton apparaît. Click → révèle 1 ligne
italique sous chaque knob avec son why localisé (fr/en/es).

**Prompt fetchAI étendu** : ÉTAPE 7 réécrite pour demander le nouveau
format. why per-knob = phrase courte 10-15 mots TRILINGUE. why global
= résumé 1-2 phrases (conservé en complément).

#### Architecture livrée Phase 7.86

```
src/main.jsx                            APP_VERSION 8.14.162 → 8.14.163
public/sw.js                            CACHE backline-v262 → backline-v263
src/core/scoring/preset-settings.js     +clampKnob helper (rétro-compat
                                        knob=number ou {value,why})
                                        clampGroup délègue à clampKnob
                                        commentaire Phase 7.86
src/core/scoring/preset-settings.test.js +8 tests Phase 7.86 :
                                        nouveau format préservé,
                                        ancien coerce, why per-knob
                                        valide / invalide / partial,
                                        hors-bornes nouveau format,
                                        scénario Chop Suey complet
src/app/utils/fetchAI.js                ÉTAPE 7 prompt : demande nouveau
                                        format {value, why} par knob.
                                        JSON template étendu. Liste
                                        champs trilingues étendue.
src/app/screens/SongDetailCard.jsx      Refonte UI 3 blocs :
                                        - Sticky bandeau (GuitarSelect
                                          + outputContext + feedback)
                                        - Bloc 1 enrichi (cot_step1 +
                                          cot_step3_amp inline)
                                        - SECTION 2 wrapper supprimé
                                          (showCot state retiré)
                                        - Bloc 2 avec scoring guitares
                                          en tête
                                        - Bloc 3 nettoyé + rappel guitare
                                          + Mode IA replié + table
                                          Réglages pédale avec toggle
                                          "▸ Pourquoi ces valeurs ?"
                                        +useState showAdvancedMode +
                                        showWhyPerKnob
src/i18n/en.js, es.js                   +10 clés Phase 7.86 (titres
                                        blocs, toggles repli, rappel
                                        guitare, sticky feedback tooltip)
```

#### Conséquences Phase 7.86

- **1463/1463 tests verts** (+8 nouveaux Phase 7.86).
- Bundle 2551 → 2554 KB (+3 KB : sticky bandeau + toggles + i18n).
- **Pas de bump STATE_VERSION** (additif UI + schéma additif rétro-compat).
- **Migration douce aiCache Phase 9.1-10 → Phase 7.86** : `clampKnob`
  tolère knob=number, coerce vers `{value}`. Pas de why per-knob jusqu'à
  re-fetch. Le toggle "▸ Pourquoi ces valeurs ?" reste caché si aucun
  why présent.
- **Effet immédiat** : prochaine analyse IA d'un morceau (mount fiche
  + rigStale OU batch "🤖 Analyser/MAJ N") retourne le nouveau format.
  Sur les fiches existantes pré-7.86, ouvrir la fiche → voir la
  nouvelle structure 3 blocs immédiatement (UI consomme les aiCache
  existants). Le toggle why per-knob n'apparaît qu'après re-fetch.

#### Dette résiduelle Phase 7.86

- **Audit tailles de polices et couleurs (Phase 7.87 future)** :
  audit visuel à mener sur la fiche song dépliée. État actuel hérité
  de la structure d'avant la refonte (cascade Phase 1 → 7.85, ad-hoc).
  Choses à challenger :
  - **Hiérarchie typographique** : actuellement on a fontSize 9 / 10 /
    11 / 12 / 13 mélangés sans cohérence systémique. La nouvelle
    structure 3 blocs amplifie la perception de désordre car les
    sous-titres "PROFIL TONAL" / "SCORING GUITARES" / etc. (10pt
    mono-uppercase) sont similaires aux titres de blocs 📚/🎯/🎸
    (aussi 10pt mono-uppercase), brouillant la distinction
    macro (3 blocs) vs micro (sous-blocs).
  - **Couleurs sémantiques** : `var(--text)` / `--text-bright` /
    `--text-sec` / `--text-muted` / `--text-dim` / `--text-tertiary`
    se mélangent. Difficile de distinguer un titre d'un corps. Le
    score color (vert/jaune/rouge selon scoring) est OK mais les
    "couleurs neutres" mériteraient une mini-charte (titre / corps /
    secondaire / hint).
  - **Couleurs des badges** (CAB ON/OFF green/yellow, score V9 multi-
    couleur, Phase 7.83 niveau qualité) : 5+ palettes différentes qui
    peuvent fatiguer l'œil ou créer de la confusion sur "qu'est-ce
    qui est important ici ?".
  - **Densité de l'information** : malgré la refonte 3 blocs, le
    Bloc 2 reste très dense (scoring guitares + ideal_guitar + preset
    + alternatives + table Réglages pédale + 2 settings prose). Peut-
    être qu'il faut envisager des sous-toggles supplémentaires ou un
    espacement plus aéré.

  Audit à mener avec Sébastien :
  1. Lister les vraies HIÉRARCHIES (titres bloc / sous-titres / corps
     gras / corps / annotations).
  2. Mapper chacune sur une combo (fontSize, fontWeight, color) figée.
  3. Refactorer SongDetailCard pour utiliser ces tokens partagés.
  4. Idéalement étendre à HomeScreen + ListScreen vue dépliée pour
     cohérence cross-écran.

  Effort estimé : ~3-4h audit + ~3-4h refacto.
- **Table Réglages pédale dans Bloc 2 vs Bloc 3** : design original
  prévoyait Bloc 3 (Mon setup, car dépend du contexte d'écoute). Pour
  cette nuit, restée dans Bloc 2 (Recommandations IA, car c'est de
  l'output IA prose). Acceptable car le badge CAB et les valeurs
  dépendent surtout de la capture nommée par l'IA, pas du choix user.
  À déplacer Phase 7.86.1 si tu préfères.
- **settings_guitar prose dans Bloc 2 vs Bloc 3** : pareil, restée dans
  Bloc 2 pour cohérence avec settings_preset. Si tu préfères dans
  Bloc 3 ("recos de réglage de TA guitare"), déplacement trivial.
- **`marginLeft: 24` legacy** dans certains sous-blocs de Section 4
  (anciennement sous GuitarSelect 24px). Plus aligné maintenant. À
  nettoyer en polish UI.
- **Tests Vitest manuel UI** : pas de smoke-test mount React de la
  fiche dépliée. Validation visuelle nécessaire par Sébastien sur
  mybackline.app après deploy.

### Validation côté Sébastien (post-déploiement)

1. Reload PWA Mac → `v8.14.163` dans header.
2. Ouvrir une fiche song (n'importe laquelle, par ex. Highway to Hell) :
   - Sticky bandeau en tête : guitare + sortie audio + 💬
   - Bloc 1 "📚 Infos morceau" : factuel + cot_step1 + cot_step3_amp
   - Bloc 2 "🎯 Recommandations IA" : scoring guitares + ideal +
     preset + alternatives + table Réglages pédale + settings prose
   - Bloc 3 "🎸 Mon setup" : "Sur ta {guitare} :" + compat + Mode
     reco avancé (replié) + best installed presets
3. Click ▸ Mode reco avancé → 4 boutons recoMode apparaissent.
4. Lancer ré-analyse d'un morceau ("🔄 Réinitialiser mes analyses"
   sur le profil OU re-fetch via override outputContext) → au
   retour de l'IA, toggle "▸ Pourquoi ces valeurs ?" apparaît
   sous la table Réglages pédale (si au moins un knob a un why).
5. Click ▸ Pourquoi ces valeurs ? → 1 ligne d'explication italique
   sous chaque knob.

---

## État précédent (2026-05-21 fin de nuit, Phase 10 v3 — cab_enabled toujours true)

**Backline v8.14.162 / SW backline-v262 / STATE_VERSION 10 / 1455 tests verts.**

### Phase 10 v3 — Fix `cab_enabled` toujours true sur 3 contextes (v8.14.162)

Retour user immédiat post-Phase 10 v2 : le badge "CAB OFF" apparaît
systématiquement dans la table Réglages pédale. **Erreur de raisonnement
de ma part** dans la consigne IA Phase 10 v2.

**Ce que dit vraiment le firmware TONEX** (manuel p.29) :
- `CAB active` = bloc CAB du TONE MODEL **activé** → on entend la
  capture complète (amp + cab modélisé)
- `CAB bypass` = bloc CAB **désactivé** → on entend seulement
  l'ampli capturé, sans cab

Sur **FRFR / casque / PA**, il n'y a aucun cab physique aval. Donc
bypasser le CAB du firmware = signal d'ampli pur sans aucun cab =
son très sec/criard, **inutilisable**.

CAB OFF (bypass) n'a de sens que vers un cab physique guitare — cas
`ampWithCab` retiré Phase 10 v2. Sur les 3 contextes restants, **CAB
doit être ON systématiquement** pour entendre la capture complète.

**Mon erreur Phase 10 v2** : le prompt fetchAI demandait à l'IA de
retourner `cab_enabled: false` pour les captures AMP+CAB sous prétexte
de "double-cab à éviter". Faux dans les 3 contextes — le double-cab
n'existait que dans `ampWithCab` (retiré).

**Fix Phase 10 v3** :

1. **Prompt fetchAI ÉTAPE 7 réécrite** : `cab_enabled` retourne désormais
   TOUJOURS `true` sur les 3 contextes (frfr/headphone/pa). La règle
   précise explicitement "pas de cab physique aval = pas de risque
   de double-cab".

2. **`clampPresetSettings` (helper Phase 9.1)** : si l'input contient
   `cab_enabled: false`, override à `true` + `console.warn` détaillé.
   Safety net si Gemini hallucine encore (heuristique AMP+CAB des
   prompts antérieurs persistant via aiCache).

3. **Badge UI table Réglages pédale** : continue d'afficher "CAB ON"
   systématiquement. Devient pédagogique — l'utilisateur sait que
   c'est le bon réglage sur sa pédale.

**Phase 10.1 future (dette signalée)** : si on enrichit
`PRESET_CATALOG_MERGED` avec flag `hasCab` ET on réintroduit le
contexte `ampWithCab`, alors `cab_enabled` redevient conditionnel
(false sur AMP+CAB → ampWithCab, true ailleurs). Reportée si signal
user.

### Architecture livrée Phase 10 v3

```
src/main.jsx                            APP_VERSION 8.14.161 → 8.14.162
public/sw.js                            CACHE backline-v261 → backline-v262
src/core/scoring/preset-settings.js     clampPresetSettings : override
                                        cab_enabled false → true + warn
                                        commentaire Phase 10 v3 détaillé
src/core/scoring/preset-settings.test.js -1 test obsolète (cab_enabled
                                        false preserved)
                                        +3 tests Phase 10 v3 (override
                                        false→true + warn, true preserved,
                                        absent preserved)
                                        adapté "IA retourne seulement
                                        cab_enabled" : false → true
src/app/utils/fetchAI.js                ÉTAPE 7 prompt : cab_enabled
                                        TOUJOURS true (vs conditionnel
                                        Phase 10 v2). JSON template :
                                        note explicite "DOIT être true".
                                        Règles : explication "pas de cab
                                        physique aval = pas de double-cab".
```

### Conséquences Phase 10 v3

- **1455/1455 tests verts** (+3 net : 4 nouveaux Phase 10 v3, -1 test
  obsolète).
- Bundle ~2549 KB (stable, juste commentaires + 1 ligne logique).
- **Pas de bump STATE_VERSION** (correctif logique pure).
- **Effet immédiat post-déploiement** : tout `preset_settings_v1`
  validé via `enrichAIResult` retournera `cab_enabled: true` ou rien.
  Les aiCache pré-10 v3 avec `cab_enabled: false` seront overridés
  au prochain render (idempotent via `_presetSettingsValidated`
  flag — note : le flag est posé avant le clamp, donc les caches
  déjà "validés" Phase 10 v2 ne seront PAS re-clamped. À surveiller
  : si le user voit encore "CAB OFF" sur des morceaux analysés
  pré-v3, il doit invalider l'aiCache via "🔄 Réinitialiser mes
  analyses").

### Validation après déploiement

1. Reload PWA Mac (Cmd+Shift+R) → `v8.14.162` dans le header.
2. Ouvrir une fiche song déjà analysée → si le badge affiche encore
   "CAB OFF", c'est un cache pré-v3 → "🔄 Réinitialiser mes analyses"
   Mon Profil → 🎯 Préférences IA → re-fetch.
3. Au retour de l'IA, vérifier que le badge affiche "CAB ON"
   systématiquement.

### Dette résiduelle Phase 10 v3

- **Idempotence du `_presetSettingsValidated` flag** : un aiCache
  pré-v3 marqué `_presetSettingsValidated: true` avec
  `cab_enabled: false` ne se re-clampe pas au render Phase 10 v3.
  Solution propre : retirer le flag dans `clampPresetSettings`
  appelé par `enrichAIResult` quand le `sv` (SCORING_VERSION) ne
  matche pas ou quand `cab_enabled === false` détecté → force
  re-clamp. Pas critique : si Sébastien clique "🔄 Réinitialiser
  mes analyses" Phase 7.33, tous les caches sont vidés et le
  prochain fetchAI retournera `cab_enabled: true` (prompt Phase 10
  v3 explicite).
- Phase 10.1 (`hasCab` catalog) + Phase 10.2 (override par morceau)
  toujours reportées.

---

## État précédent (2026-05-21 nuit++, Phase 10 v2 simplifiée — 5→3 contextes + CAB indépendant)

**Backline v8.14.161 / SW backline-v261 / STATE_VERSION 10 / 1452 tests verts.**

### Phase 10 v2 — Simplification 5→3 contextes (v8.14.161)

Retour utilisateur immédiat après Phase 10 v1 (livrée 2026-05-21 nuit) :
les options `ampWithCab` ("Ampli + cab guitare physique") et `ampNoCab`
("Ampli sans cab — FRFR-like") n'arrivent jamais en pratique chez les
utilisateurs ToneX cibles (Sébastien joue FRFR, ses beta-testeurs aussi).
Cas marginaux qui polluent l'UX avec des descriptions techniques peu
compréhensibles.

**Suppression** des 2 valeurs marginales. `OUTPUT_CONTEXTS` passe de
5 à 3 valeurs :
- `frfr` : enceinte FRFR neutre amplifiée (default)
- `headphone` : casque sortie pédale
- `pa` : système de sonorisation / table de mixage via DI

**Rôle redéfini** : `outputContext` ne dicte plus le toggle CAB. Il
sert désormais à adapter les **conseils EQ et volume** de l'IA selon
le rendu attendu :
- FRFR → restitution fidèle de la capture
- Casque → modération possible des aigus pour confort prolongé
- PA → éviter conseils ajoutant trop de basses/réverbération (mix-ready)

**`cab_enabled` du `preset_settings_v1`** (Phase 9.1) reste dans la
sortie de l'IA mais est désormais dicté par la **CAPTURE choisie**
(`preset_ann_name` / `preset_plug_name`) :
- Capture AMP+CAB (cab modélisé inclus) → CAB OFF dans la pédale (sinon
  double-cab)
- Capture AMP-only (pas de cab modélisé) → CAB ON dans la pédale (pour
  fournir la modélisation cab)
- Indéterminé → CAB ON par défaut

**Helper `shouldCabBeEnabled` supprimé** (n'avait plus de sens vu que
le cab ne dépend plus du contexte). Tests Vitest correspondants
retirés (-3) + 1 test ajouté pour validation migration douce : profils
Phase 10 v1 qui auraient `outputContext: 'ampWithCab'` ou `'ampNoCab'`
retombent silencieusement sur `'frfr'` au render via
`getEffectiveOutputContext` (valeur invalide → fallback default).

**Phase 10.1 future (dette signalée, à activer si signal user)** :
enrichir `PRESET_CATALOG_MERGED` avec flag `hasCab: boolean` par entry.
Pour Anniversary Phase 7.52 + Factory v2, le PDF officiel le donne
(`tone_models/`). Pour TSR/AA/JS/TJ/WT/Galtone, curation manuelle
progressive. Au prompt, l'IA verra `hasCab` à côté du nom des captures
installées et décidera `cab_enabled` de manière 100% déterministe (vs
heuristique actuelle). ~3-4h dev + curation.

**Phase 10.2 future (dette signalée)** : override `cab_enabled` par
morceau dans SongDetailCard (3 boutons `↻ Profil / CAB ON / CAB OFF`)
si l'utilisateur veut corriger l'IA. À activer si signal user que
l'IA se trompe régulièrement.

### Architecture livrée Phase 10 v2

```
src/main.jsx                            APP_VERSION 8.14.160 → 8.14.161
public/sw.js                            CACHE backline-v260 → backline-v261
src/core/state.js                       OUTPUT_CONTEXTS 5 → 3 valeurs
                                        shouldCabBeEnabled SUPPRIMÉ
                                        getEffectiveOutputContext préservé
                                        (defensive : valeurs invalides
                                        ampWithCab/ampNoCab → fallback frfr)
src/core/state.test.js                  -3 tests shouldCabBeEnabled
                                        +1 test legacy migration
                                        (5 verts au lieu de 9)
src/app/screens/MonProfilScreen.jsx     -2 cards (ampWithCab + ampNoCab)
                                        +hint expliquant que cab on/off
                                        n'est pas dicté par ce paramètre
src/app/screens/SongDetailCard.jsx      -2 boutons override
                                        +hint mis à jour (EQ/volume, pas cab)
src/app/utils/fetchAI.js                outputContextLine reformulé :
                                        n'évoque plus CAB ACTIVATED/BYPASSED
                                        ÉTAPE 7 : cab_enabled dicté par
                                        CAPTURE (AMP+CAB → false, AMP-only
                                        → true), pas par contexte
src/i18n/en.js, es.js                   -4 clés (ampWithCab/ampNoCab label
                                        + desc). Adaptation intro/hint
                                        pour clarifier le rôle 3-valeurs.
```

### Conséquences Phase 10 v2

- **1452/1452 tests verts** (-2 net : -3 shouldCabBeEnabled, +1 legacy).
- Bundle 2551 → 2548 KB (-3 KB : moins d'UI + i18n + prompt).
- **Pas de bump STATE_VERSION** (modif modèle dans la liste autorisée,
  les valeurs supprimées fallback gracieusement).
- **Migration douce Phase 10 v1 → v2** : aucune action user requise.
  Les profils créés Phase 10 v1 avec `outputContext: 'ampWithCab'` ou
  `'ampNoCab'` voient leur valeur ignorée au render (fallback `frfr`).
  Pas de migration explicite — `getEffectiveOutputContext` filtre via
  `OUTPUT_CONTEXTS.includes()`.
- **UX clarifiée** : 3 cards UI sans jargon technique opaque. Le toggle
  CAB de la pédale apparaît comme une décision IA pure (table Réglages
  pédale Phase 9.1) — le user ne se demande plus quel contexte choisir
  pour le déclencher.

### Validation après déploiement

1. Reload PWA Mac (Cmd+Shift+R) → vérifier `v8.14.161` dans le header.
2. Mon Profil → 🎯 Préférences IA → section "🔌 Contexte d'écoute" :
   désormais 3 cards (FRFR / Casque / Sono / Table de mixage). Default
   FRFR sélectionné.
3. Ouvrir une fiche song → section "🔌 Sortie audio pour ce morceau"
   sous Mode IA : 4 boutons (↻ Profil + 3 contexts).
4. Tester override (ex. `🎧 Casque`) → invalide aiCache → re-fetch.
5. Au retour de l'IA, la table "🎛️ Réglages pédale" affiche un badge
   `CAB ON` ou `CAB OFF` (selon la capture choisie, pas selon le
   contexte d'écoute).

---

## État précédent (2026-05-21 nuit, Phase 10 + Phase 9.1 livrées — Contexte d'écoute + Réglages pédale chiffrés)

**Backline v8.14.160 / SW backline-v260 / STATE_VERSION 10 / 1454 tests verts.**

### Phase 10 — Contexte d'écoute par profil + override par morceau (v8.14.160)

Validation 3 signaux user : Bruno (cab/no-cab par contexte d'écoute,
2026-05-18), Francisco (knob settings chiffrés, 2026-05-17),
Ok_Ask2411 (output enrichi, peer-builder 2026-05-15). Couplée à
Phase 9.1 (Réglages pédale chiffrés) car cab_enabled est dicté par
le contexte d'écoute.

**Modèle data** (additif, pas de bump STATE_VERSION) :
- `OUTPUT_CONTEXTS = ['headphone', 'frfr', 'pa', 'ampWithCab', 'ampNoCab']`
- `DEFAULT_OUTPUT_CONTEXT = 'frfr'` (cas le plus courant utilisateurs
  ToneX : enceinte FRFR neutre)
- `profile.outputContext: string` optional, fallback 'frfr' au render
- `song.outputContext: string` optional, override par morceau

**Mapping context → CAB section** (conforme manuel TONEX p.8-12) :
| Context | CAB section | Cas type |
|---|---|---|
| `headphone` | activated | Casque sortie pédale |
| `frfr` | activated | FRFR / Powercab+ / ToneX Cab (default) |
| `pa` | activated | DI → système sono ou table de mixage |
| `ampWithCab` | bypassed | Amp puissance + cab guitare physique |
| `ampNoCab` | activated | Amp avec cab désactivable / préampli pur |

**Helpers purs exportés depuis `core/state.js`** :
- `getEffectiveOutputContext(profile, song)` : priorité song > profile
  > default. Defensive face aux valeurs invalides.
- `shouldCabBeEnabled(outputContext)` : true sauf pour 'ampWithCab'.

**UI Mon Profil → 🎯 Préférences IA** : nouvelle section "🔌 Contexte
d'écoute" avec 5 cards radio (icône + label + description) sur le
pattern Phase 7.1 recoMode. Default 'frfr'.

**UI SongDetailCard** : override par morceau sous le bloc "Mode IA
pour ce morceau" Phase 7.3. 6 boutons compacts (↻ Profil + 5
contexts). Change → invalide aiCache du morceau → re-fetch auto
avec nouveau contexte + nouveaux cab_enabled / réglages.

**Pas d'invalidation auto** sur changement global
`profile.outputContext` (volontaire, sinon brutal). User clique
"🔄 Réinitialiser mes analyses" Phase 7.33 s'il veut tout
regenerer.

**Tests Phase 10** : 12 nouveaux dans `state.test.js` (OUTPUT_CONTEXTS,
DEFAULT_OUTPUT_CONTEXT, getEffectiveOutputContext × 7,
shouldCabBeEnabled × 3, makeDefaultProfile × 1).

### Phase 9.1 — MVP Réglages pédale chiffrés (v8.14.160)

L'IA retourne désormais un objet `preset_settings_v1` validé,
rendu en table compacte sous le bloc preset reco de la fiche
morceau.

**Format output IA** :
```json
"preset_settings_v1": {
  "cab_enabled": true,                          // dicté par Phase 10
  "main": {                                     // 5 boutons face avant
    "gain": 6.2, "bass": 4.5, "mid": 7.0,
    "treble": 5.3, "volume": 6.0                // 0-10 chacun
  },
  "alt": {                                      // 5 boutons ALT
    "presence": 4.7, "depth": 5.0,              // 0-10
    "reverb_mix": 16,                           // 0-100 %
    "comp_threshold": -18,                      // -40 à 0 dB
    "gate_threshold": -56                       // -100 à 0 dB
  },
  "why": { "fr": "...", "en": "...", "es": "..." }  // 1-2 phrases trilingue
}
```

Ranges officiels du manuel TONEX p.22-28. Confirmé Sébastien
2026-05-21 : les 5 devices ToneX (Pedal classique, Anniversary,
Plug, One, One+) partagent les mêmes capacités PRESET → design
unifié, pas device-specific.

**Helper `clampPresetSettings`** (`src/core/scoring/preset-settings.js`,
nouveau fichier) :
- PRESET_RANGES const figé (Object.freeze) avec min/max/unit par knob
- Clamp les valeurs hors-bornes (Gemini hallucine parfois) + warn
  détaillé
- Skip silencieusement les champs inconnus / non-numériques / NaN /
  Infinity
- Préserve les champs partiels (Gemini peut retourner partial)
- Retourne null si structure totalement invalide
- 34 tests Vitest dans `preset-settings.test.js`

**Validation au render via enrichAIResult** (`ai-helpers.js`) :
- Idempotent via flag `_presetSettingsValidated`
- preset_settings_v1 invalide → set à null, fallback UI gracieux

**Prompt fetchAI étendu** :
- Nouveau 12e param `outputContext`
- Section "CONTEXTE D'ÉCOUTE" injectée avec mapping cab_enabled
  explicite selon les 5 contexts
- Nouvelle "ÉTAPE 7 — PARAMÉTRAGE DU PRESET (preset_settings_v1)"
  avec ranges officiels listés + defaults nominaux + exemples par
  style (thrash gate sévère, blues comp doux, clean volume 6-7)

**UI table "🎛️ Réglages pédale"** dans SongDetailCard section 3
(Recommandation idéale), entre le bloc preset reco et settings_preset
prose :
- Badge "CAB ON/OFF" en haut à droite (green/yellow)
- 5 lignes "Boutons principaux" (Gain/Bass/Mid/Treble/Volume) avec
  /10 scale
- 5 lignes "Boutons ALT" (Presence/Depth /10 + Reverb mix % +
  Comp/Gate threshold dB)
- why trilingue en italique en bas (getLocalizedText)
- Skip silencieusement si aiCache pré-9.1 (fallback gracieux)
- settings_preset prose conservé en parallèle pour transition douce

**Call sites fetchAI mis à jour** (10 sites) avec
`effectiveOutputContext = song.outputContext || profile?.outputContext
|| 'frfr'` inline :
- SongDetailCard × 2 (useEffect + rerunWithFeedback)
- ListScreen × 2 (analyzeMissingAll + improveAll)
- SetlistsScreen, MaintenanceTab, MonProfilScreen, HomeScreen × 2,
  AddSongModal

**i18n FR/EN/ES** :
- Phase 10 : 20 nouvelles clés (profile.output-context.*, output-context.label.*,
  output-context.desc.*, song-detail.output-context-*)
- Phase 9.1 : 6 nouvelles clés (preset-settings.* — title, subtitle,
  cab-on, cab-off, section-main, section-alt). Knob labels en
  anglais clair (jargon universel).

### Architecture livrée

```
src/main.jsx                            APP_VERSION 8.14.159 → 8.14.160
public/sw.js                            CACHE backline-v259 → backline-v260
src/core/state.js                       +OUTPUT_CONTEXTS, DEFAULT_OUTPUT_CONTEXT
                                        +getEffectiveOutputContext (pure)
                                        +shouldCabBeEnabled (pure)
                                        makeDefaultProfile : pose
                                          outputContext='frfr'
src/core/state.test.js                  +12 tests Phase 10
src/core/scoring/preset-settings.js     NOUVEAU — PRESET_RANGES (manuel TONEX)
                                        + clampPresetSettings (pure)
src/core/scoring/preset-settings.test.js NOUVEAU — 34 tests Phase 9.1
src/core/scoring/index.js               re-export Phase 9.1 helpers
src/app/utils/fetchAI.js                +12e param outputContext
                                        +section prompt CONTEXTE D'ÉCOUTE
                                        +section prompt ÉTAPE 7 + ranges
                                        +preset_settings_v1 JSON template
src/app/utils/ai-helpers.js             enrichAIResult valide
                                        preset_settings_v1 via clampPresetSettings
src/app/screens/MonProfilScreen.jsx     +section "🔌 Contexte d'écoute"
                                        (5 cards radio) dans tab reco
                                        +outputContext propagé fetchAI
src/app/screens/SongDetailCard.jsx      +override outputContext par morceau
                                        +sous-section "🎛️ Réglages pédale"
                                        +outputContext propagé fetchAI (× 2)
src/app/screens/ListScreen.jsx          +outputContext propagé fetchAI (× 2)
src/app/screens/SetlistsScreen.jsx      +outputContext propagé fetchAI
src/app/screens/MaintenanceTab.jsx      +outputContext propagé fetchAI
src/app/screens/HomeScreen.jsx          +outputContext propagé fetchAI (× 2)
src/app/components/AddSongModal.jsx     +outputContext default 'frfr'
src/i18n/en.js                          +26 clés (Phase 10 × 20 + 9.1 × 6)
src/i18n/es.js                          +26 clés (idem ES)
```

### Conséquences Phase 10 + 9.1

- **1454/1454 tests verts** (+46 nouveaux : 12 Phase 10 + 34 Phase 9.1).
- Bundle 2534 → 2552 KB (+18 KB : prompt étendu + UI table + i18n).
- **Pas de bump STATE_VERSION** (additif profile.outputContext +
  song.outputContext + aiCache.preset_settings_v1).
- **Pas de migration localStorage** : profils existants héritent
  default 'frfr' au render. aiCache pré-9.1 fallback UI gracieux.
- **Effet immédiat post-déploiement** : prochaine analyse IA
  (SongDetailCard mount avec rigStale OU "🤖 Analyser/MAJ N" batch)
  retournera preset_settings_v1. Pour basculer tous les aiCache
  existants : "🔄 Réinitialiser mes analyses" Mon Profil → Préférences
  IA (action user).

### Bénéficiaires immédiats

- **Bruno** (metal/punk, ampli + cab guitare physique probable) :
  peut maintenant signaler `ampWithCab` → IA décide cab_enabled=false
  + adapte les réglages (pas de double-cab). Phase 9.2 (FX blocks
  détaillés) traitera son cas For Whom the Bell Tolls (mod/reverb
  OFF).
- **Francisco** (FRFR probable, demande knob settings chiffrés
  explicite 2026-05-17) : table chiffrée + why trilingue répond
  directement à son besoin.
- **Paul Drew** (TSR, si réponse positive au Mail 3 envoyé 20:21) :
  démo publique `?demo=1` affichera désormais la table Réglages
  pédale sur les morceaux ré-analysés. Atout supplémentaire pour
  la valeur perçue.

### Dette résiduelle Phase 10 + 9.1

- **Phase 9.2 — FX blocks détaillés** : Niveau 1 ✅ LIVRÉ 2026-05-22
  (v8.14.172). Niveau 2 (sub-params rate/depth/time/feedback/mix)
  reporté selon signal user. Cf section "État actuel" en tête de
  CLAUDE.md.
- **Phase 9.3 — EQ avancé + TONE MODEL fine** : ~2h dev. Optionnel,
  power-users.
- **Phase 9.4 — "ONE TWEAK TO FIX IT"** ✅ LIVRÉE 2026-05-22
  (v8.14.165). Cf section "État actuel" en tête de CLAUDE.md.
- **Phase 9.5 — Pickup + playing hints** ✅ LIVRÉE 2026-05-22
  (v8.14.168). Cf section "État actuel" en tête de CLAUDE.md.
- **settings_preset prose conservé en parallèle** : transition
  douce. À supprimer Phase ultérieure quand tous les aiCache ont été
  regenerer avec preset_settings_v1.
- **Re-analyse manuelle** : Sébastien peut tester sur 1-2 morceaux
  via SongDetailCard → bouton override outputContext (invalide
  aiCache du morceau seul) pour valider le format de retour Gemini.
- **Cohabitation pré-9.1 / post-9.1** : un client pré-9.1 qui pousse
  son state sans preset_settings_v1 → un client post-9.1 fallback
  UI sans table (la prose settings_preset reste affichée).

### Validation à faire côté Sébastien

1. Reload PWA Mac (Cmd+Shift+R) → vérifier `v8.14.160` dans le
   header.
2. Mon Profil → 🎯 Préférences IA → vérifier nouvelle section
   "🔌 Contexte d'écoute" avec FRFR par défaut. Toggle un autre
   context, retour FRFR.
3. Ouvrir une fiche morceau de ta setlist → "🔌 Sortie audio pour
   ce morceau" sous Mode IA. Tester l'override (invalide aiCache
   → re-fetch).
4. Après re-fetch, vérifier que la nouvelle table "🎛️ Réglages
   pédale" apparaît sous le bloc preset reco, avec :
   - Badge CAB ON/OFF cohérent avec le contexte
   - 5 lignes Boutons principaux + 5 lignes Boutons ALT
   - why trilingue en bas
5. Tester sur l'iPhone aussi (sync Firestore propagera profile.outputContext).

### Déploiement Phase 10 + 9.1

À faire via workflow git worktree habituel (5 commits sur
`refactor-and-tmp` poussés origin, copie dist/* vers main worktree,
commit + push main).

---

## État précédent (2026-05-21 soir, Phase 7.85 close — Demo EN audit fixes Chop Suey)

**Backline v8.14.159 / SW backline-v259 / STATE_VERSION 10 / 1408 tests verts.**

### Phase 7.85 — 4 bloqueurs + bonus sur fiche démo EN Chop Suey (v8.14.159)

Audit Chrome MCP de `mybackline.app/?demo=1` en EN sur la fiche
morceau « Chop Suey! » (System of a Down) — la carte exacte que le
Mail 3 à Paul Drew (co-fondateur TSR) invite à ouvrir. 4 défauts
visibles + 1 bonus. Tous corrigés en 4 commits atomiques.

#### Bloqueur 1 — `guitarChoiceFeedback` retournait du FR concaténé

Section « SETTINGS — MY PICK » de la fiche dépliée, sous « Compatibility:
84% (estimated) » : la ligne de raison affichait « ✓ micros HB
adaptés au morceau, à l'aise en drive » en FR brut dans l'UI EN.

Cause : `guitarChoiceFeedback` (`src/core/scoring/guitar.js:417`)
construisait la string par concaténation de fragments FR codés en
dur (`"micros "+g.type+" adaptés au morceau"`, `"à l'aise en "+gain`).
Quand `cotEntry.reason` (objet trilingue de l'aiCache) était absent,
le fallback pros/cons partait en FR. `getLocalizedText` (Phase 7.39)
laisse les strings legacy passer telles quelles → leak FR en EN.

Fix Phase 7.85 pattern Phase 7.82 (`localGuitarSettings`) : la
fonction pure retourne désormais un objet structuré poly­morphe :
- `{kind:'ai', reason: {fr,en,es}}` — path principal (inchangé)
- `{kind:'tokens', pros:[...], cons:[...]}` — fallback profil-based
  (le cas du bug). Chaque token : `{key, fallback, params}`.
- `{kind:'desc', desc: string}` — fallback ultime sur `profile.desc`
  (FR-only, dette mineure).

L'UI (`SongDetailCard:401`) compose via `tFormat` selon `kind`. 1
seul call site → refacto safe.

6 nouvelles clés i18n FR/EN/ES (`guitar-feedback.*`) :
- `pickup-match` : "micros {type} adaptés au morceau" / "{type}
  pickups suit the track" / "pastillas {type} adecuadas para el tema"
- `pickup-mismatch` (type+pref)
- `style-excellent` / `style-unnatural` ({style})
- `gain-comfortable` / `gain-uncomfortable` ({gain})

Placeholders `{type}` (HB/SC/P90), `{style}`, `{gain}` injectés
littéralement — termes techniques universels FR/EN/ES.

#### Bloqueur 2 — `Banque 37A` au lieu de `Bank 37A`

Bloc « Best installed presets for SG 61 » en bas de la fiche EN :
badge "Banque 37A" en FR alors qu'ailleurs dans la même carte
"Bank 37A" était déjà correct.

Cause : `PBlock.jsx:78` avait `"Banque {bank}{slot}"` hardcodé en
dur. Le composant `PBlock` est le rendu unifié des slots
installés pour chaque device dans la section "Best installed".

Fix : wrap via `tFormat('pblock.installed-bank', {bank, slot},
'Banque {bank}{slot}')`. EN: `Bank {bank}{slot}` / ES: `Banco
{bank}{slot}`.

Dette signalée hors scope : PBlock contient encore plusieurs strings
FR hardcodées non wrappées (`À installer`, `↑ meilleur choix`,
`★ top dispo`, `✦ adapté`, `→ Remplace`, `↑ Meilleur dispo`,
`Source non dispo`). À traiter Phase ultérieure si retours user.

#### Bloqueur 3 — `guitar_reason` Chop Suey contredit la reco effective

Section « IDEAL RECOMMENDATION » disait « The Les Paul provides the
harmonic density and punch needed for the Drop C tuned riffs… »
mais la guitare réellement recommandée (★ « Optimal choice » + badge
vue repliée) est la Gibson SG Standard '61.

Cause racine : `enrichAIResult` applique le boost family-match Phase
7.64 sur l'aiCache. Pour Chop Suey, `ref_guitar = "Ibanez Iceman /
Gibson SG"` → family `sg` → la SG Standard 61 reçoit +15 (92+15→99
clamp) et passe devant la Les Paul Standard 60 (95). `ideal_guitar`
est updaté vers SG, MAIS `guitar_reason` (généré par l'IA au prompt-
time, avant le post-process) reste inchangé → prose LP périmée.

Phénomène général : tout cas où le post-processing reordonne
`cot_step2_guitars` + change `ideal_guitar` sans toucher la prose
`guitar_reason`. Signalé en dette pour Phase ultérieure (refacto
de la logique d'affichage non triviale, à valider avec retour user).

Fix Phase 7.85 (pattern Phase 7.52.16 Hotel California) : pour le
snapshot démo, corriger directement `guitar_reason` (FR+EN+ES) du
c_1779040659179 aiCache (`result` + `bestByGuitar['']` +
`bestByGuitar['lp60']`) pour parler de la SG, en cohérence avec :
- ref_guitar : "Ibanez Iceman / Gibson SG"
- cot_step4_score.history.reason : "Daron Malakian primarily uses
  humbucker-equipped guitars (Ibanez Iceman, Gibson SG)"
- ideal_guitar effectif après boost : "SG Standard 61 (HB)"

**Audit des 7 autres morceaux du snapshot** effectué : seul Chop
Suey était incohérent.

| Morceau | ref_guitar family | ideal post-boost | guitar_reason | OK ? |
|---|---|---|---|---|
| Back in Black | sg | SG Ebony | SG | ✓ |
| Thrill Is Gone | es335 | ES-335 | ES-335 | ✓ |
| Smoke on the Water | strat | Strat 61 | Stratocaster | ✓ |
| Hotel California | telecaster | Tele 1951 | 1951 Telecaster | ✓ |
| Pride and Joy | strat | Strat 61 | Stratocaster | ✓ |
| **Chop Suey!** | **sg** | **SG 61** | **Les Paul** | **❌ fixé** |
| Schism | (no ref) → other | LP (no boost) | Les Paul | ✓ |
| Help the Poor | other | ES-335 | ES-335 | ✓ |

#### Bloqueur 4 — TSR pack avec `.zip` + guillemets FR

Section « CATALOG ALTERNATIVES » de la fiche : la capture TSR
s'affichait « 📦 The Studio Rats — « Mesa Boogie IIC+.zip » » avec
guillemets français + nom de fichier interne. Les captures ML Sound
Lab s'affichaient proprement « 🎚 ML Sound Lab » à côté. Sensible
car c'est le pack d'un créateur qu'on va solliciter via le Mail 3.

Cause : `getSourceInfo` (`src/core/sources.js:140`) avait un format
spécifique TSR avec `« ${pack}.zip »`. Phase 7.84 avait retiré le
ZIP brut de l'Explorer (PresetDetailInline) pour la même raison
("paraissait plomberie au visiteur") mais le format TSR de
`getSourceInfo` était resté FR-ish.

Fix : aligner sur le pattern des branches `custom` (`Custom — ${pack}`)
et `adminPack` (`${base.label} — ${pack}`) : `The Studio Rats —
${entry.pack}`. Pas d'i18n nécessaire (proper noun + séparateur
universel).

#### Bonus — Espace manquant avant `(estimated)`

« Compatibility: 84%(estimated) » sans espace visible. Le
`marginLeft: 6` sur le span le rendait visuellement trop tight.

Fix : ajout `{' '}` explicite entre `</b>` et le span sur
`SongDetailCard:400` et `HomeScreen:659`. Belt-and-suspenders avec
le marginLeft : 6px CSS + ~3px du space char = séparation visible.

### Architecture livrée Phase 7.85

```
src/main.jsx                            APP_VERSION 8.14.158 → 8.14.159
public/sw.js                            CACHE backline-v258 → backline-v259
src/core/scoring/guitar.js              guitarChoiceFeedback refacto
                                        retour {kind, pros, cons, desc}
src/app/screens/SongDetailCard.jsx      consume via tFormat composition
                                        +{' '} bonus space avant (estimated)
src/app/screens/HomeScreen.jsx          +{' '} bonus space avant (estimated)
src/app/components/PBlock.jsx           wrap "Banque" via tFormat
                                        +import tFormat
src/core/sources.js                     getSourceInfo TSR : drop .zip + « »
src/i18n/en.js                          +7 clés (guitar-feedback.* x6,
                                        pblock.installed-bank)
src/i18n/es.js                          +7 clés (idem ES)
src/data/demo-profile.json              Chop Suey c_1779040659179 :
                                        guitar_reason FR/EN/ES SG-coherent
                                        (3 emplacements identiques :
                                        result + bestByGuitar[''] +
                                        bestByGuitar['lp60'])
```

### Conséquences Phase 7.85

- **1408/1408 tests verts** (aucune régression, aucun nouveau test
  Vitest — refacto pure helper + UI compose).
- Bundle 2534 → 2533 KB (–1 KB, slight reduction).
- Pas de bump STATE_VERSION (additif UI + data uniquement).
- Pas de migration localStorage.
- **Démo EN Chop Suey désormais cohérente bout en bout** : prose
  cohérente avec la SG, badge banque traduit, label TSR propre, FR
  scoring concaténé éliminé. Mail 3 Paul peut être envoyé sans
  embarras sur la fiche citée.

### Dette résiduelle Phase 7.85

- **PBlock strings FR résiduelles** (À installer, ↑ meilleur choix,
  ★ top dispo, ✦ adapté, → Remplace, Meilleur dispo, Source non
  dispo) : à wrapper i18n si retours user. Hors scope (1 string
  demandée par Sébastien).
- **Phénomène général guitar_reason périmé après family boost** :
  signalé. Solutions possibles à instruction :
  1. Le post-process Phase 7.64 invalide aussi `guitar_reason` à
     0 si la guitare change → l'UI affiche cot_step2_guitars[0].reason
     à la place. Refacto modéré.
  2. Ou au prompt-time, demander à l'IA de générer guitar_reason
     pour CHAQUE entrée cot_step2_guitars (pas seulement la top),
     puis sélection à l'affichage. Plus coûteux en tokens.
  Reporter Phase ultérieure si signal user.
- **`profile.desc` FR-only** dans le 3e fallback de
  `guitarChoiceFeedback`. Chaque guitare (11 du catalog + customs) a
  son `desc` en FR. À i18n-iser si signal user — rare en pratique
  (le fallback se déclenche uniquement quand aucun pros/cons).

### Déploiement Phase 7.85 confirmé (2026-05-21 soir)

- `refactor-and-tmp` : 5 commits poussés (`bf287d8..aa50fef`).
- `main` : commit `7e0b7ad` poussé. GitHub Pages auto-deploy 30-60s.
- **v8.14.159 / SW backline-v259** live sur `mybackline.app`.
- Mail 3 à Paul Drew (TSR) débloqué côté technique — la fiche démo
  EN Chop Suey citée dans le draft est désormais cohérente bout en
  bout (prose SG, badge Bank, label TSR propre, scoring EN).

---

## État précédent (2026-05-21 soir, Phase 7.74.8 — 2e cause racine pollution profile : migrateV9toV10 re-stamp)

**Backline v8.14.158 / SW backline-v258 / STATE_VERSION 10 / 1408 tests verts.**

### Phase 7.74.8 — `migrateV9toV10` ne re-stampe plus `lastModified` à chaque boot (v8.14.158)

7e occurrence de la pollution profile observée 2026-05-21 (banques
Anniversary ~79 slots + Plug 7 slots de Sébastien révertées vers une
version périmée, propagées Mac↔iPhone) — **alors que le fix Phase
7.74.7 était déployé et actif** (v8.14.157 confirmée sur les
appareils). La cause racine de Session 1 (`recordLogin`) n'était qu'un
amplificateur sur deux.

**2e cause racine** (capture forensique live via Chrome MCP) : un
simple rechargement re-stampe `profile.sebastien.lastModified` à
l'heure du boot — reproductible à 100 % des reloads. `loadState()`
appelle `_runFullChain()` **même sur un state déjà-v10** (`state.js` :
`if (d.version === STATE_VERSION) return _runFullChain(d)` — les
migrations sont idempotentes, elles servent aussi à heal des profils
incomplets). `_runFullChain` exécute donc `migrateV9toV10()` à chaque
chargement, et celui-ci re-stampait `profiles[activeId].lastModified =
Date.now()` **inconditionnellement** (dans le bloc qui copie l'aiCache
vers le profil actif), qu'une migration réelle ait lieu ou non.
Amplificateur plus systématique que `recordLogin` : 100 % des boots
vs seulement les logins.

**Fix livré** :
- `migrateV9toV10` : flag `cacheMigrated` qui passe à `true` uniquement
  quand une entrée aiCache est réellement déplacée shared→profile. Le
  stamp devient `lastModified: cacheMigrated ? Date.now() :
  curProfile.lastModified`. Sur un state déjà-v10 stable (cas de 100 %
  des reloads) → `lastModified` préservé → un reload ne fait plus
  « gagner » l'appareil au LWW.
- 4 tests Vitest (`state.test.js`) : state déjà-v10 stable → préserve,
  migration aiCache réelle → re-stampe, song hors setlists du profil
  actif → préserve, double passage idempotent → préserve.
- `docs/SYNC.md` (section Phase 7.74.8 + ligne table régressions) et
  `docs/INVESTIGATION_POLLUTION_PROFILE.md` (occurrence #7 + Session 2)
  mis à jour.

**Restauration des banques** : les banques de Sébastien (Anniversary
50 + Plug 10) ont été restaurées depuis `ToneX_Anniversary_ref.csv` +
`ToneX_Plug_ref.csv` via capture Chrome MCP — push Firestore (`PATCH
/sync/state`) confirmé 200.

### Architecture livrée Phase 7.74.8

```
src/main.jsx              APP_VERSION 8.14.157 → 8.14.158
public/sw.js              CACHE backline-v257 → backline-v258
src/core/state.js         migrateV9toV10 : flag cacheMigrated, stamp
                          lastModified conditionnel
src/core/state.test.js    +4 tests Phase 7.74.8
docs/SYNC.md              +section Phase 7.74.8 + ligne table régressions
docs/INVESTIGATION_POLLUTION_PROFILE.md  +occurrence #7 + Session 2
```

### Conséquences Phase 7.74.8

- **1408 tests verts** (1404 baseline + 4 Phase 7.74.8).
- Pas de bump STATE_VERSION (logique de migration pure).
- Pas de migration localStorage.
- **Effet** : un reload ne re-stampe plus le profil actif. Un appareil
  au contenu périmé ne peut plus regagner le LWW à chaque ouverture et
  propager son état stale. Combiné à Phase 7.74.7 (recordLogin), les
  deux amplificateurs de la pollution profile sont neutralisés.
- **Déployé en prod** : `main` commit `2249aa0`, v8.14.158 live sur
  `mybackline.app` (vérifié). Banques de Sébastien restaurées et
  propagées via Firestore.

### Dette résiduelle Phase 7.74.8

- `setSongAiCache` (main.jsx) stampe encore `profile.lastModified` sur
  une écriture aiCache réelle (fetchAI / feedback / rescore). Reste un
  amplificateur mineur — il ne tourne PAS à chaque boot (contrairement
  à `migrateV9toV10`). Fix de fond possible : merger l'aiCache
  per-songId même dans la branche `rts <= lts` de `mergeProfileLWW`
  (l'aiCache s'auto-arbitre déjà par son `ts` per-entry, Phase 7.81),
  puis retirer ce stamp. Reporté.
- Test manuel multi-device recommandé après déploiement : recharger
  Mac + iPhone plusieurs fois, vérifier qu'aucune banque ne bouge.

---

## État précédent (2026-05-21, Phase 7.74.7 — cause racine pollution profile + smoke test mount)

**Backline v8.14.157 / SW backline-v257 / STATE_VERSION 10 / 1404 tests verts.**

### Phase 7.74.7 — `recordLogin` ne re-stampe plus `lastModified` (v8.14.157)

6e occurrence de la pollution profile observée 2026-05-21 (profil
Sébastien : 79/150 slots `banksAnn` + 7/30 `banksPlug` révertés vers
une version périmée, langue FR→EN, propagé Mac+iPhone). La capture
forensique live a enfin livré la **cause racine**.

**Cause racine** : `recordLogin` (main.jsx) re-stampait
`lastModified = Date.now()` à **chaque boot/login**. Un login ne change
aucune donnée, mais le stamp rendait le profil « le plus récent » pour
le LWW (`mergeProfileLWW` compare `lastModified`). Tout appareil
rechargé avec un contenu périmé en localStorage devenait gagnant et
propageait son état stale à tous les autres appareils. C'est
l'amplificateur commun aux 6 occurrences. `banksAnn`/`banksPlug` sont
en plus adoptés en bloc dans `mergeProfileLWW` sans défense ni log →
corruption totalement invisible.

**Fix livré** :
- `recordLogin` → nouveau helper pur `appendLoginEntry(profiles, id)`
  (`state.js`) : met à jour `loginHistory` (cap 5) **sans toucher
  `lastModified`**. Un login n'est plus une « modif » au sens LWW.
- Log forensique dans `mergeProfileLWW` : `[merge-defense] SUSPECT
  banksAnn/Plug mass-change` quand l'adoption en bloc remplace ≥10
  slots. **Log seul, pas de blocage** (une réorg de banques est
  légitime — bloquer ferait des faux positifs).
- 12 tests Vitest : `appendLoginEntry` (×6) + log banks mass-change
  (×4) dans `state.test.js` ; smoke mount (×2, cf ci-dessous).
- `docs/SYNC.md` : section « Phase 7.74.7 » + ligne au tableau des
  régressions. `docs/INVESTIGATION_POLLUTION_PROFILE.md` : résultats
  Session 1 (cause trouvée).

### Smoke test mount React (`src/main.smoke.test.jsx`)

Suite à la leçon du hotfix v8.14.156 (TDZ runtime-only non attrapé par
Vitest ni le build) : `App` est désormais exporté de `main.jsx`, le
`ReactDOM.render` de fin de fichier est gardé (`if (#root)`) pour que
l'import en test ne render pas, et `main.smoke.test.jsx` monte `<App/>`
dans jsdom et vérifie que le mount ne throw pas. Filet anti-régression
pour les bugs d'init / d'ordre de déclaration.

### Traduction onglet « Mes presets custom » (commit `[i18n]`, même release)

Dette i18n Phase 7.69 résorbée : 30 clés `mycustompresets.*` +
`profile.tab.custom-packs` avaient des fallbacks FR inline mais
manquaient dans `en.js`/`es.js` → l'onglet restait en français en mode
EN/ES. 31 clés ajoutées dans les deux dicos. `MyCustomPresetsTab` :
ajout de `useLocale()` (l'onglet ne se re-rendait pas au switch de
langue) ; `confirm-delete` passé de `t()` à `tFormat({name})` pour
garder le nom du preset dans toutes les langues. Livré dans la même
release v8.14.157 (commit séparé `[i18n]`).

### Architecture livrée Phase 7.74.7

```
src/main.jsx              APP_VERSION 8.14.156 → 8.14.157
                          recordLogin → appendLoginEntry (no re-stamp)
                          +export function App + guard render #root
public/sw.js              CACHE backline-v256 → backline-v257
src/core/state.js         +appendLoginEntry helper pur
                          mergeProfileLWW +log forensique banks mass-change
src/core/state.test.js    +10 tests (appendLoginEntry + log banks)
src/main.smoke.test.jsx   NOUVEAU — smoke mount React (2 tests)
docs/SYNC.md              +section Phase 7.74.7 + régression table
docs/INVESTIGATION_POLLUTION_PROFILE.md  +résultats Session 1
src/i18n/en.js            +31 clés mycustompresets.* / tab.custom-packs
src/i18n/es.js            +31 clés (idem ES)
src/app/screens/MyCustomPresetsTab.jsx  +useLocale() ; confirm-delete
                          → tFormat({name})
```

### Conséquences Phase 7.74.7

- **1404 tests verts** (1392 baseline + 10 Phase 7.74.7 + 2 smoke).
- Pas de bump STATE_VERSION (logique sync pure).
- Pas de migration localStorage.
- **Effet** : un reload ne rend plus un appareil « le plus récent ».
  Un appareil au contenu périmé ne peut plus écraser les autres. La
  pollution profile ne devrait plus se reproduire.
- Le déploiement sur `main` reste à faire (build + push).

### Dette résiduelle Phase 7.74.7

- Pas de blocage dur de l'adoption `banksAnn`/`banksPlug` en bloc —
  choix délibéré (faux positifs sur les réorgs légitimes). Le log
  forensique suffit ; si une 7e occurrence survient malgré le fix
  recordLogin, le log donnera la trace pour décider d'un blocage.
- Test manuel multi-device recommandé après déploiement : recharger
  Mac + iPhone plusieurs fois, vérifier qu'aucune banque ne bouge.

---

## État précédent (2026-05-21 matin, hotfix v8.14.156 — TDZ ReferenceError écran noir corrigé)

**Backline v8.14.156 / SW backline-v256 / STATE_VERSION 10 / 1392 tests verts.**

### Hotfix v8.14.156 — Écran noir mybackline.app (TDZ Phase 7.79.3b)

**Bug critique reporté par Sébastien 2026-05-21 matin** : `mybackline.app`
affiche un écran noir, console montre `Cannot access 'D' before
initialization` (D = identifiant minifié). React mount échoue.

**Cause racine** : le `useEffect` qui sync `window._usagesCascadeState`
(introduit Phase 7.79.3b livré v8.14.152) référence `profile?.usagesOverrides`
dans son deps array. **Le deps array est évalué synchroneusement à chaque
render**, mais le useEffect avait été placé ligne ~533, AVANT la déclaration
`const profile = profiles[activeProfileId]` ligne ~580 → TDZ
(Temporal Dead Zone) ReferenceError au 1er render → React mount crash.

**Pourquoi pas détecté avant** :
- Tests Vitest testent les helpers purs (`resolveUsagesCascade`,
  `saveUsagesForPreset`, etc.), pas l'init React App de main.jsx
- Build Vite minifie sans détecter la TDZ (erreur runtime-only)
- Le bug existe depuis v8.14.152 mais s'est manifesté seulement
  en prod sur device Sébastien (probablement masqué localement par
  HMR Vite dev qui ne déclenche pas les mêmes paths d'init)

**Fix** : déplace le useEffect APRÈS la déclaration `const profile = ...`.
Commentaire WARNING ajouté à l'emplacement d'origine pour éviter ré-introduction.

**Documenté dans `docs/CASCADE.md` piège #2** (nouveau) : "ordre du useEffect
sync vs déclaration profile ⚠". Mention explicite : tout `useEffect`/`useMemo`
qui référence `profile` dans son deps array DOIT être après la déclaration.

### Architecture livrée hotfix

```
src/main.jsx              APP_VERSION 8.14.155 → 8.14.156
                          useEffect cascade déplacé après const profile
                          +commentaire WARNING à l'emplacement d'origine
public/sw.js              CACHE backline-v255 → backline-v256
docs/CASCADE.md           +Piège #2 (TDZ profile)
                          renumérotation 3→4, 4→5, 5→6
```

### Conséquences hotfix

- **1392/1392 tests verts** (aucune logique changée, juste réordonnancement).
- Bundle identique (2526.88 KB).
- Pas de bump STATE_VERSION.
- **Production restorée** : v8.14.156 corrige l'écran noir. User doit
  faire hard reload (Cmd+Shift+R) ou Unregister SW v255 cassé pour
  bypasser le cache stale.

### Leçon prise

Tests Vitest ne couvraient pas le smoke-test mount React. Ajout
possible Phase ultérieure : test minimal qui import main.jsx + App
component et vérifie que le mount ne throw pas. Coût ~30 min, valeur
préventive importante.

---

## État précédent (2026-05-20 nuit, Phase 7.79.3 solidification — PresetCurationModal cascade + 13 tests E2E + docs/CASCADE.md)

**Backline v8.14.155 / SW backline-v255 / STATE_VERSION 10 / 1392 tests verts.**

### Phase 7.79.3 solidification — PresetCurationModal + tests E2E + doc (v8.14.155)

Phase 7.79.3 (cascade 4 niveaux) livrée 7.79.3a/b/c. Cette solidification
boucle les dettes résiduelles identifiées + ajoute des garde-fous tests
+ documente le système complet pour les futures sessions.

#### PresetCurationModal refactor cascade

La modale `PresetCurationModal` (déclenchée par click sur la pastille
CurationDot dans BankEditor et SongDetailCard) n'avait pas reçu le
routing 4 niveaux Phase 7.79.3b. Refactor en parité avec UsagesSection
(PresetBrowser) :
- Édition étendue à TOUS les catalog non-guessed (avant : custom/ToneNET +
  isAdmin uniquement)
- Badge source cascade (`👤 Toi` / `🏷️ Studio` / `⚙️ Backline`) à côté
  du status de curation
- Bouton "🔄 Restaurer la version par défaut" si `_usagesSource ∈
  {'user', 'backline'+admin}`
- `handleSave` refactor : délègue à `saveUsagesForPreset` (Phase 7.79.3b)
  au lieu d'inliner la logique custom/ToneNET → routing automatique 4
  branches
- Hint mode édition adapté selon `entry.src` + `isAdmin` (4 cas)
- Nouvelle prop `onSharedUsagesOverrides` propagée à travers la chain :
  - main.jsx → SetlistsScreen → ListScreen → SongDetailCard → PresetCurationModal
  - main.jsx → MonProfilScreen → MesAppareilsTab → BankEditor → PresetCurationModal

#### Tests E2E cascade (`usages-cascade.integration.test.js`)

13 tests d'intégration end-to-end qui simulent des scénarios complets
au lieu de tester les helpers en isolation :

- **Cascade end-to-end** (6) : état initial sans override, admin écrit
  Backline override, user perso écrase Backline, bouton Restaurer DELETE
  user → cascade reprend à Backline, override vide explicite stop cascade,
  admin retire Backline → catalog default
- **Sync Firestore LWW bout-en-bout** (4) : 2 devices keys distinctes →
  union, même preset conflit → plus récent gagne, override vide explicite
  plus récent → propagé, égalité ts → keep local
- **Préparation Phase 11** (2) : studio override gagne sur Backline,
  hiérarchie complète user > studio > backline > catalog
- **Sécurité isolation** (1) : user A perso → user B ne voit pas

**Détail technique** : les tests `.test.js` tournent en env Node (pas
jsdom), donc `findCatalogEntry._applyUsagesCascade` early-return car
`typeof window === 'undefined'`. Solution : `beforeAll` stubbe
`globalThis.window = {}` pour activer la cascade pendant les tests.

#### Documentation `docs/CASCADE.md`

Nouveau doc de référence (~250 lignes, aux côtés de SCORING.md + SYNC.md) :
- Pourquoi la cascade (motivation Phase 7.79.3)
- Schéma ASCII des 4 niveaux + règle "override vide explicite"
- Architecture (3 fichiers clés + pipeline runtime)
- Routing `saveUsagesForPreset` (table 4 branches)
- Sync Firestore + LWW merge per-item
- 4 cas d'usage typiques (admin curé, user perso, Restaurer, Phase 11)
- **6 pièges à éviter** : modifier findCatalogEntry sans cascade, oublier
  sync window state, confondre usages:undefined vs usages:null vs DELETE,
  routing custom/ToneNET vs catalog statique, tests Node vs jsdom
- Tests de référence + lien Phase 11

Référencé dans CLAUDE.md section "Docs additionnelles" avec ⚠️ "À lire
avant de toucher à la cascade".

### Architecture livrée solidification

```
src/main.jsx                                APP_VERSION 8.14.154 → 8.14.155
public/sw.js                                CACHE backline-v254 → backline-v255
                                            +propage onSharedUsagesOverrides
                                            à SetlistsScreen (depuis
                                            screen==='setlists')
src/app/components/PresetCurationModal.jsx  Refactor cascade : édition
                                            ouverte à tous catalog
                                            non-guessed, badge source,
                                            bouton Restaurer, handleSave
                                            via saveUsagesForPreset,
                                            hint adapté isAdmin
                                            +import removeUsagesOverride
                                            +prop onSharedUsagesOverrides
src/app/components/BankEditor.jsx           passe onSharedUsagesOverrides
                                            à PresetCurationModal
src/app/screens/SongDetailCard.jsx          +prop onSharedUsagesOverrides
                                            +passe à PresetCurationModal
src/app/screens/ListScreen.jsx              +prop onSharedUsagesOverrides
                                            +propage à SongDetailCard
src/app/screens/SetlistsScreen.jsx          +prop onSharedUsagesOverrides
                                            +propage à ListScreen
src/core/usages-cascade.integration.test.js NOUVEAU — 13 tests E2E
                                            (window stub pour env Node)
docs/CASCADE.md                             NOUVEAU — doc de référence
CLAUDE.md                                   référence docs/CASCADE.md
```

### Conséquences solidification

- **1392/1392 tests verts** (+13 nouveaux intégration cascade).
- Bundle 2525.55 → 2526.88 KB (+1.33 KB pour PresetCurationModal refactor).
- Pas de bump STATE_VERSION (pas de schéma changé).
- **PresetCurationModal et UsagesSection en parité fonctionnelle** :
  les 2 chemins UI (click pastille CurationDot vs drawer expand BankEditor)
  offrent désormais la même expérience cascade.
- **Tests E2E** : garde-fou contre régressions futures du système
  cascade (modification de findCatalogEntry, du routing, etc.).
- **docs/CASCADE.md** : prévention des 6 pièges classiques pour les
  prochains touches au système.

### Dette résiduelle solidification

- **Tombstones pour `shared.usagesOverrides`** : pas de mécanisme v1.
  Pour DELETE complètement un override Backline, on fait
  `removeUsagesOverride` qui DELETE l'entry. Mais si un autre device
  pre-7.79.3 ou un device offline depuis longtemps a encore l'entry
  côté sa map, le merge LWW peut ressusciter l'override. Acceptable
  v1 (suppression d'overrides rare). Phase ultérieure si rapporté.
- **Pas de UI pour Phase 11 studios** : `shared.studioUsages` est un
  slot ready-to-write mais aucune UI/account studio n'existe. Phase 11
  complète quand TSR/JS/TJ/etc. acceptent de participer.

---

## État précédent (2026-05-20 soir, bonus i18n livrés — html lang sync + APP_TAGLINE localisé + JamScreen useLocale)

**Backline v8.14.154 / SW backline-v254 / STATE_VERSION 10 / 1379 tests verts.**

### Bonus — Résidus i18n Phase 7.82 + JamScreen useLocale (v8.14.154)

Trois quick wins enchaînés après livraison Phase 7.79.3 :

#### 1. `<html lang>` synchronisé avec le locale effectif

Dette résiduelle Phase 7.82 documentée le 2026-05-20 (audit Chrome MCP
démo EN) : l'attribut `lang` de `<html>` restait toujours `"fr"` même
quand l'UI rendait en EN. Cosmétique (lecteurs d'écran, SEO) mais pas
propre. Fix dans `src/i18n/index.js` :

- `setLocale(loc)` : pose `document.documentElement.lang = loc` après
  écriture localStorage. Guard `typeof document !== 'undefined'` pour
  Vitest/SSR.
- `forceDemoLocale(loc)` : pareil (cas du mode démo qui bascule sans
  passer par setLocale).
- **Init module-level** : à l'import de `i18n/index.js`, `<html lang>`
  est posé à `getLocale()` pour le 1er render. Garantit que les
  lecteurs d'écran voient le bon lang dès le boot, sans attendre un
  switch.

#### 2. `APP_TAGLINE` localisé pour modale d'intro + onboarding

Dette résiduelle Phase 7.82 (item 2) : la constante `APP_TAGLINE` de
`core/branding.js` ("Le guide intelligent pour tes pédales et amplis
modélisés") était affichée en FR brut dans le SplashPopup et
l'OnboardingWizard, même en mode EN. Visible par un visiteur
anglophone dès la modale.

Fix `core/branding.js` : nouveau mapping `APP_TAGLINE_BY_LOCALE` :
- FR : "Le guide intelligent pour tes pédales et amplis modélisés" (conservé)
- EN : "The intelligent guide for your modeled pedals and amps"
- ES : "La guía inteligente para tus pedales y amplificadores modelados"

Nouveau helper `getAppTagline(locale)` qui retourne la version locale
(fallback FR si locale inconnu). HomeScreen.jsx import + 2 sites mis
à jour (SplashPopup ligne 179, OnboardingWizard ligne 217). Le re-render
au switch de langue est garanti via `useLocale()` au composant parent.

#### 3. `useLocale` ajouté à JamScreen

Dette résiduelle Phase 7.84 (item 2) : JamScreen utilise `t()` /
`tFormat()` mais n'a pas `useLocale()` au mount → ne se re-render pas
au switch de langue. Bug latent si visiteur switch FR↔EN depuis
JamScreen. Fix : 1 ligne `useLocale()` au début de la fonction
`JamScreen`. Cohérent avec le pattern Phase 7.36+ déjà appliqué
à HomeScreen, MonProfilScreen, SongDetailCard, ThanksScreen, etc.

### Architecture livrée bonus

```
src/main.jsx                    APP_VERSION 8.14.153 → 8.14.154
public/sw.js                    CACHE backline-v253 → backline-v254
src/i18n/index.js               setLocale + forceDemoLocale : sync
                                document.documentElement.lang. Init
                                module-level : pose lang au boot.
src/core/branding.js            +APP_TAGLINE_BY_LOCALE (FR/EN/ES)
                                +getAppTagline(locale) helper
                                +exports
src/app/screens/HomeScreen.jsx  +import getLocale +getAppTagline
                                2 sites APP_TAGLINE → getAppTagline(getLocale())
                                (SplashPopup + OnboardingWizard)
src/app/screens/JamScreen.jsx   +import useLocale +useLocale() en tête
                                de la fonction JamScreen
```

### Conséquences bonus

- **1379/1379 tests verts** (aucun nouveau, aucune régression).
- Bundle 2525.07 → 2525.55 KB (+0.48 KB pour les nouveaux helpers
  + 2 traductions + appel useLocale).
- Pas de bump STATE_VERSION (purement i18n + DOM).
- **Effet utilisateur** :
  - Visiteur anglophone : tagline modale d'intro désormais en EN.
  - `<html lang>` correctement annoté → meilleur SEO + accessibilité.
  - JamScreen suit le switch de langue sans reload nécessaire.

---

## État précédent (2026-05-20 soir, Phase 7.79.3c livrée — Sync Firestore cascade complète multi-device)

**Backline v8.14.153 / SW backline-v253 / STATE_VERSION 10 / 1379 tests verts.**

### Phase 7.79.3c — Sync Firestore cascade (v8.14.153)

Troisième et dernière sous-phase de la cascade 4 niveaux usages.
Phase 7.79.3a a livré les helpers purs, Phase 7.79.3b le routing + UI.
Phase 7.79.3c rend la cascade **multi-device** via la sync Firestore +
localStorage.

#### Persistance localStorage

`state.shared` étendu avec deux nouveaux champs (additifs, pas de bump
STATE_VERSION) :
- `shared.usagesOverrides: {[name]: {usages, lastModified}}` (niveau 3)
- `shared.studioUsages: {[name]: {usages, lastModified, curatedBy}}` (niveau 2, slot Phase 11)

Les useState `sharedUsagesOverrides` + `sharedStudioUsages` initialisés
depuis `initDefault.shared?.usagesOverrides || {}` au load (Phase 7.79.3b
déjà câblé). Persistés via le `persistState` standard à chaque mutation.

`profile.usagesOverrides` (niveau 1) est inclus automatiquement dans le
`profiles` du state (déjà sync via push profil habituel Phase 5.7 LWW).

#### Push Firestore

Aucune modif requise dans `firestore.js` : le `prep()` sérialise tout
`state` via `JSON.parse(JSON.stringify(...))`, les nouveaux champs
sont donc inclus automatiquement.

#### syncHash étendu

`main.jsx` syncHash inclut désormais 3 nouvelles dimensions :
- **profileHash** : `profile.usagesOverrides` entries → `name|lastModified|usages.length-or-NULL`
- **syncHash global** : `shared.usagesOverrides` + `shared.studioUsages`
  (avec `curatedBy` pour studio)

Sans ces hashes, le push Firestore ne se déclenche pas après une modif
locale (bug latent Phase 7.46 — corrigé pour les autres champs). Le
format "NULL" vs "len-N" permet de distinguer un override actif d'un
override vide explicite (cf Phase 7.79.3a cascade docstring).

#### Pull Firestore — merge LWW

`applyRemoteData` étendu avec 2 nouveaux merges per-item LWW (pattern
Phase 7.53.1 `mergeToneNetPresetsLWW`) :

```js
if(data.shared.usagesOverrides!==undefined) setSharedUsagesOverrides(prev=>{
  const merged=mergeUsagesOverridesLWW(prev,data.shared.usagesOverrides);
  if(JSON.stringify(merged)===JSON.stringify(prev))return prev;
  return merged;
});
if(data.shared.studioUsages!==undefined) setSharedStudioUsages(prev=>{
  const merged=mergeUsagesOverridesLWW(prev,data.shared.studioUsages);
  if(JSON.stringify(merged)===JSON.stringify(prev))return prev;
  return merged;
});
```

Le helper `mergeUsagesOverridesLWW` (Phase 7.79.3a, 10 tests Vitest
dédiés) :
- Présent des 2 côtés → garde plus grand `lastModified` (égalité → keep local)
- Local-only → keep local
- Remote-only → adopt remote

Les overrides vides explicites (`{ usages: null, lastModified }`)
survivent au merge → la cascade lit bien "vide explicite" sur tous
les devices.

`profile.usagesOverrides` (niveau 1, per-profile) est mergé automatiquement
via `mergeProfilesLWW` Phase 5.7 (LWW per-profile par `profile.lastModified`).
Pas besoin de merge per-item séparé : les overrides perso changent
avec le profil entier.

### Architecture livrée Phase 7.79.3c

```
src/main.jsx                              APP_VERSION 8.14.152 → 8.14.153
                                          +import mergeUsagesOverridesLWW
                                          profileHash +usagesOverrides
                                          syncHash +sharedUsagesOverrides
                                          +sharedStudioUsages
                                          state.shared +usagesOverrides
                                          +studioUsages
                                          applyRemoteData : merge LWW
                                          per-item pour les 2 maps shared
public/sw.js                              CACHE backline-v252 → backline-v253
```

### Conséquences Phase 7.79.3c — Cascade 4 niveaux opérationnelle

- **1379/1379 tests verts** (aucun nouveau test — la sync est testée
  indirectement par `mergeUsagesOverridesLWW` qui a 10 tests Phase 7.79.3a).
- Bundle 2523.72 → 2525.07 KB (+1.35 KB pour hashes + merges).
- **Pas de bump STATE_VERSION** : le schéma étendu est additif
  (`shared.usagesOverrides` et `studioUsages` sont des champs optionnels,
  initialisés à `{}` si absents). Un client pré-7.79.3 reçoit un state
  v10 avec ces champs → ignore silencieusement (`useState(initDefault.shared
  ?.usagesOverrides || {})` retourne `{}` vide).
- **Cohabitation pré/post-7.79.3** safe : un client pré-7.79.3 qui
  pousse à Firestore n'inclut pas ces champs → `data.shared.usagesOverrides
  === undefined` côté client 7.79.3 → branche skip dans applyRemoteData
  → les overrides locaux survivent.
- **Effet utilisateur multi-device** :
  - Admin Sébastien curé un preset TSR depuis son Mac via "Modifier" :
    écrit dans `shared.usagesOverrides`, sync Firestore en ~5s,
    propage à tous les profils + tous les devices.
  - Bruno cure un preset TSR perso depuis iPhone via "Modifier" :
    écrit dans `profile.usagesOverrides`, sync Firestore via push profil,
    propage à ses propres autres devices (mais invisible aux autres
    profils → privacy respectée).
  - Bruno restaure la version par défaut : DELETE entry de la map →
    LWW propage le delete au prochain push (l'absence d'entry tombe
    sur la cascade niveau suivant).

### Phase 7.79.3 — Cascade 4 niveaux COMPLÈTE

Récap :
- **Phase 7.79.3a** ✅ Helpers purs cascade + extension findCatalogEntry (v8.14.151)
- **Phase 7.79.3b** ✅ Routing saveUsagesForPreset 4 niveaux + UI badges + bouton Restaurer (v8.14.152)
- **Phase 7.79.3c** ✅ Sync Firestore cascade complète multi-device (v8.14.153)
- **Phase 7.79.3 solidification** ✅ PresetCurationModal cascade (parité
  UsagesSection) + 13 tests E2E intégration + `docs/CASCADE.md` (v8.14.155)

**Total livré** : 41 tests dédiés cascade (28 unitaires `usages-cascade.test.js`
+ 13 intégration `usages-cascade.integration.test.js`), routing étendu
sur 4 branches via `saveUsagesForPreset`, UI cascade en parité sur les
2 chemins (UsagesSection drawer + PresetCurationModal pastille), sync
multi-device LWW per-item, doc de référence avec 6 pièges à éviter.

**Préparation Phase 11 Studio-driven** : `shared.studioUsages` est un slot
prêt à recevoir des overrides de pack creators partenaires (TSR, ML,
Galtone, etc.). La cascade le lit déjà entre user (niv 1) et backline
(niv 3). Quand Phase 11 démarre, il suffit d'ajouter un compte studio
+ une UI dédiée pour écrire dans `studioUsages` — l'infrastructure
cascade est déjà là. Badge UI "🏷️ Studio (TSR)" déjà câblé Phase 7.79.3b
(lit `entry._usagesCuratedBy`).

### Dette résiduelle Phase 7.79.3 (résolue par solidification ou reportée)

- ~~**PresetCurationModal pas étendu**~~ ✅ **RÉSOLU par solidification
  2026-05-20** : la modale a été refactor en parité avec UsagesSection
  (édition tous catalog, badge cascade, bouton Restaurer, handleSave
  via saveUsagesForPreset). Cf section "Phase 7.79.3 solidification"
  en tête de CLAUDE.md.
- ~~**Tests E2E multi-device**~~ ✅ **RÉSOLU par solidification** : 13
  tests d'intégration end-to-end couvrent cascade + sync LWW +
  préparation Phase 11 + isolation profils.
- **Tombstones `shared.usagesOverrides`** (reporté) : pas de mécanisme v1.
  Si un device offline depuis longtemps a encore une entry localement,
  le merge LWW peut ressusciter l'override après DELETE. Acceptable v1
  (suppression rare). Phase ultérieure si rapporté.
- **UI Phase 11 studios** (reporté) : `shared.studioUsages` est ready-
  to-write mais aucune UI/account studio n'existe. Phase 11 complète
  quand TSR/JS/TJ/etc. acceptent de participer (démarche commerciale).
- **Test manuel multi-device** : non couvert par Vitest. À faire au
  retour Sébastien :
  1. Mac admin : Mon Profil → Mes appareils → ouvrir une fiche preset
     TSR → Modifier → ajouter un usage → Enregistrer → vérifier badge
     "⚙️ Backline" affiché
  2. iPhone (ou autre profil) : reload → vérifier que l'usage curé est
     visible avec badge "⚙️ Backline"
  3. iPhone (non-admin) : Modifier → ajouter un usage perso → vérifier
     badge "👤 Toi" (override perso visible que par soi)
  4. Cliquer "🔄 Restaurer la version par défaut" → vérifier que la
     fiche revient au niveau cascade suivant (Backline ou Catalog)
- **Charge curation admin** : si Sébastien cure 50 presets TSR/AA/JS
  via shared.usagesOverrides, ça représente ~50 entries × ~200 octets
  = 10 KB additionnel par push Firestore. Marge confortable.

---

## État précédent (2026-05-20 soir, Phase 7.79.3b livrée — Routing saveUsagesForPreset 4 niveaux + UI badges + bouton Restaurer)

**Backline v8.14.152 / SW backline-v252 / STATE_VERSION 10 / 1379 tests verts.**

### Phase 7.79.3b — Routing étendu + UI cascade (v8.14.152)

Deuxième sous-phase de la cascade 4 niveaux (cf Phase 7.79.3a pour les
helpers purs). 7.79.3b livre le routing `saveUsagesForPreset` étendu,
l'UI badges + boutons cascade dans UsagesSection (PresetBrowser +
BankEditor), et la synchronisation `window._usagesCascadeState` au boot
+ chaque mutation. **Fonctionnel local-only** : les overrides sont
écrits dans le state in-memory et persistés dans localStorage (via
useState standard), mais pas encore syncés vers Firestore — c'est
Phase 7.79.3c qui finalisera.

#### Routing `saveUsagesForPreset` étendu (preset-curation.js)

L'API précédente Phase 7.79.2 (ctx avec `findEntry`, `activeProfileId`,
`onProfiles`, `onToneNetPresets`) gagne 2 nouveaux paramètres :
- **`isAdmin`** : booléen pour décider profile vs shared sur catalog statique
- **`onShared`** : setter qui prend un reducer `(sh) => sh'` pour
  shared.usagesOverrides (Phase 7.79.3c câblera la sync Firestore)

Branches de routing (en ordre de priorité) :
1. `entry.src === 'custom'` → `profile.customPacks[].presets[].usages` (Phase 7.69 inchangé)
2. `entry.src === 'ToneNET'` → `shared.toneNetPresets[].usages` (Phase 7.53 inchangé)
3. **Catalog statique + isAdmin** → `shared.usagesOverrides[name]` (niveau 3, visible tous users)
4. **Catalog statique + !isAdmin** → `profile.usagesOverrides[name]` (niveau 1, visible user seul)

Pour les niveaux 3-4, écriture au format `{ usages, lastModified }` :
- `usages: [...]` → override actif
- `usages: null` → override "vide explicite" (stoppe la cascade,
  masque les usages du catalog)

#### Nouveau helper `removeUsagesOverride(name, ctx)`

Pour le bouton "Restaurer la version par défaut" — DELETE complètement
l'entry de la map (vs `saveUsagesForPreset(name, undefined)` qui écrit
`{ usages: null }`). La cascade reprend alors au niveau suivant. No-op
si `entry.src` ∈ {'custom', 'ToneNET'} (pas concerné par la cascade,
ces sources stockent leurs usages dans la donnée elle-même).

#### Tests Vitest preset-curation (+16 nouveaux)

- `saveUsagesForPreset routing étendu` × 9 : rétro-compat custom/ToneNET,
  catalog+admin → shared, catalog+!admin → profile, usages=undefined →
  `{ usages: null }`, admin sans onShared no-op, guessed=true no-op,
  findEntry null no-op, ctx null no-op
- `removeUsagesOverride` × 7 : admin→shared delete, !admin→profile
  delete, no-op si pas d'override, custom/ToneNET → no-op (cascade ne
  s'applique pas), guessed/null findEntry no-op

Total préset-curation : 24 (existants) + 16 (nouveaux) = 40 tests verts.

#### UI UsagesSection — Badge source + Bouton Restaurer

Dans `src/app/screens/PresetBrowser.jsx`, le composant `UsagesSection` :

- **Badge source au titre section** selon `entry._usagesSource`
  (annoté par Phase 7.79.3a findCatalogEntry) :
  - 👤 Toi (user override perso, visible que par lui)
  - 🏷️ Studio ({curatedBy}) — Phase 11 future
  - ⚙️ Backline (admin override partagé)
  - (Pas de badge si `_usagesSource === 'default'` ou absent — c'est
    le catalog brut)

- **Logique `editable` étendue** : avant 7.79.3b, seul `custom`/`ToneNET`
  + isAdmin pouvaient cliquer "Modifier". Désormais TOUS les users
  peuvent éditer TOUTE entry non-guessed. Le routing décide où sauver.

- **Nouveau bouton "🔄 Restaurer la version par défaut"** — affiché si :
  - `entry._usagesSource === 'user'` (user retire son override perso)
  - OU `entry._usagesSource === 'backline'` ET isAdmin (admin retire
    son admin override)
  - Sinon caché.

- **Hint d'édition adapté** selon entry.src + isAdmin pour clarifier
  où sera persisté l'override (custom → profile.customPacks, ToneNET
  → shared.toneNetPresets, catalog+admin → shared.usagesOverrides,
  catalog+user → profile.usagesOverrides).

13 nouvelles clés EN+ES (`cascade.source-user`, `.source-studio`,
`.source-studio-by`, `.source-backline`, `.source-*-tooltip`, `.restore`,
`.restore-tooltip`, `.edit-hint-user`, `.edit-hint-admin`).

#### Câblage main.jsx + chain props

- **Nouveau state** `sharedUsagesOverrides` (niveau 3) et
  `sharedStudioUsages` (niveau 2, slot Phase 11) en `useState`.
- **`useEffect` sync `window._usagesCascadeState`** au boot et à
  chaque mutation. findCatalogEntry (Phase 7.79.3a) lit ce state pour
  appliquer la cascade.
- **PresetBrowser** (route `screen === 'explore'`) : prop
  `onSaveUsages` étendue avec `isAdmin` + `onShared` adapter (forme
  fonctionnelle setState pour éviter closures stales). Prop
  `onRemoveOverride` ajoutée.
- **BankEditor** : nouvelle prop `onSharedUsagesOverrides` propagée
  depuis MonProfilScreen → MesAppareilsTab. Passée au PresetDetailInline
  pour câbler `onSaveUsages` + `onRemoveOverride`.

### Architecture livrée Phase 7.79.3b

```
src/main.jsx                              APP_VERSION 8.14.151 → 8.14.152
                                          +import removeUsagesOverride
                                          +state sharedUsagesOverrides
                                          +state sharedStudioUsages (slot Phase 11)
                                          +useEffect sync window._usagesCascadeState
                                          PresetBrowser onSaveUsages étendu
                                          + onRemoveOverride câblé
                                          MonProfilScreen +onSharedUsagesOverrides
public/sw.js                              CACHE backline-v251 → backline-v252
src/core/preset-curation.js               saveUsagesForPreset +isAdmin +onShared
                                          (4 branches routing)
                                          +removeUsagesOverride helper
src/core/preset-curation.test.js          +16 tests (9 saveUsagesForPreset
                                          étendu + 7 removeUsagesOverride)
src/app/screens/PresetBrowser.jsx         UsagesSection :
                                          +editable ouvert à tous catalog non-guessed
                                          +renderSourceBadge (badge cascade)
                                          +bouton "Restaurer" conditionnel
                                          +hint d'édition adapté src/isAdmin
src/app/components/BankEditor.jsx         +import removeUsagesOverride
                                          +prop onSharedUsagesOverrides
                                          PresetDetailInline reçoit onSaveUsages
                                          étendu + onRemoveOverride
src/app/screens/MesAppareilsTab.jsx       +prop onSharedUsagesOverrides
                                          propagée à 3× BankEditor
src/app/screens/MonProfilScreen.jsx       +prop onSharedUsagesOverrides
                                          propagée à MesAppareilsTab
src/i18n/en.js                            +cascade.* (12 clés)
src/i18n/es.js                            +cascade.* (12 clés)
```

### Conséquences Phase 7.79.3b

- **1379/1379 tests verts** (+16 nouveaux préset-curation).
- Bundle 2517.05 → 2523.72 KB (+6.67 KB pour UI + setters + i18n).
- Pas de bump STATE_VERSION (additif, fallback gracieux quand cascade
  state absent ou champs profile/shared absents).
- Pas de migration localStorage (les nouveaux champs `profile.usagesOverrides`
  et `shared.usagesOverrides` sont initialisés à `{}` au load via
  `useState(initDefault.shared?.usagesOverrides || {})`).
- **Effet utilisateur immédiat** : l'admin peut désormais cliquer
  "Modifier" sur n'importe quelle capture TSR/AA/JS/etc. depuis
  Explorer ou BankEditor pour ajouter/modifier des usages → écrit
  dans `shared.usagesOverrides` → visible immédiatement dans toutes
  les fiches via la cascade. Un beta-tester non-admin peut faire
  pareil en perso (sa version override). Phase 7.79.3c ajoute la
  sync Firestore pour propager entre devices.

### Dette résiduelle Phase 7.79.3b → 7.79.3c

- **Pas encore syncé Firestore** : les overrides sont en localStorage
  local seul. Multi-device ne propage pas. Phase 7.79.3c câble :
  - push `profile.usagesOverrides` via push profil habituel (Phase 5.7
    LWW per-profile)
  - pull `shared.usagesOverrides` via merge per-item LWW
    (`mergeUsagesOverridesLWW` Phase 7.79.3a)
  - syncHash étendu pour inclure `profile.usagesOverrides`
- **PresetCurationModal pas étendu** : la modale `PresetCurationModal`
  (utilisée par BankEditor au click pastille curation) n'a pas reçu
  le routing étendu Phase 7.79.3b. À évaluer : reste-t-elle utile en
  pratique ou rendue obsolète par UsagesSection inline ? Si gardée,
  même travail (props + branche routing). Non bloquant pour 7.79.3c.

---

## État précédent (2026-05-20 soir, Phase 7.79.3a livrée — Helpers cascade usages 4 niveaux + extension findCatalogEntry)

**Backline v8.14.151 / SW backline-v251 / STATE_VERSION 10 / 1363 tests verts.**

### Phase 7.79.3a — Helpers cascade usages (v8.14.151)

Première sous-phase de la cascade 4 niveaux validée 2026-05-19 soir
(cf "Idées en attente" Phase 7.79.3 historique). 7.79.3a livre les
helpers purs + l'extension `findCatalogEntry` qui lit la cascade.
Inert tant que `window._usagesCascadeState` n'est pas posé par main.jsx
(Phase 7.79.3c). Aucune régression : si pas de cascade state, comportement
identique à avant. **Phase 7.79.3b** (UI + routing) et **7.79.3c** (sync
Firestore + cabling main.jsx) suivent dans la foulée.

#### Helper pur `src/core/usages-cascade.js`

- **`resolveUsagesCascade(name, state)`** → `{ usages, source, curatedBy? }`
  - 4 niveaux de priorité : `profileOv` > `studioOv` > `backlineOv` > `catalogEntry.usages`
  - `state` accepte les 3 maps d'overrides + l'entry catalog brute
  - Override "vide explicite" (`usages: null`) STOP la cascade et retourne
    `null` — intentionnel : l'user a le dernier mot, sa "désactivation"
    écrase un niveau studio/backline/catalog
  - `source` ∈ {'user', 'studio', 'backline', 'default', null}
  - Defensive : inputs invalides → `{ usages: null, source: null }`

- **`mergeUsagesOverridesLWW(local, remote)`** : merge per-item LWW pour
  sync Firestore (pattern Phase 7.53.1 toneNetPresets) :
  - Présent des 2 côtés → garde plus grand `lastModified` (égalité → keep local)
  - Local-only → keep local
  - Remote-only → adopt remote
  - Override vide (`usages: null`) survit au merge (sa stamp gagne LWW si
    plus récente que le remote qui a des usages : []) → la cascade lira
    bien "vide explicite" sur tous les devices

- **`getUsageOverride(map, name)`** : lookup defensive sur map d'overrides.

28 tests Vitest dédiés (`usages-cascade.test.js`) :
- `getUsageOverride` × 4 : null safety, name vide, présent/absent
- `resolveUsagesCascade` × 11 : chaque niveau gagne, override vide explicite
  stoppe la cascade, entry sans usages, defensives inputs invalides,
  catalog usages non-Array, niveau présent sans champ usages → skip
- `mergeUsagesOverridesLWW` × 10 : local/remote plus récent, égalité,
  unions, ts manquant fallback 0, null/undefined inputs, override vide
  propagé
- Scénarios bout-en-bout × 3 : user > backline > catalog, sync 2 devices
  keys distinctes, sync conflit même preset

#### Extension `findCatalogEntry` dans `src/core/catalog.js`

- Split `_findCatalogEntryRaw` (lookup catalog brut sans cascade) +
  `findCatalogEntry` (applique cascade via `_applyUsagesCascade`).
- `_applyUsagesCascade` lit `window._usagesCascadeState` si présent et
  appelle `resolveUsagesCascade` pour résoudre les usages selon les 4
  niveaux. Annote l'entry avec `_usagesSource` ('user'|'studio'|'backline'|
  'default') et `_usagesCuratedBy` (pour studio Phase 11).
- **Rétro-compat garantie** : si pas de `window._usagesCascadeState`
  (Vitest, SSR, app pré-7.79.3), `findCatalogEntry` retourne l'entry
  brute exactement comme avant. Aucun call site existant n'a besoin
  d'être modifié.

### Architecture livrée Phase 7.79.3a

```
src/main.jsx                              APP_VERSION 8.14.150 → 8.14.151
public/sw.js                              CACHE backline-v250 → backline-v251
src/core/usages-cascade.js                NOUVEAU — getUsageOverride,
                                          resolveUsagesCascade,
                                          mergeUsagesOverridesLWW
src/core/usages-cascade.test.js           NOUVEAU — 28 tests
src/core/catalog.js                       +import resolveUsagesCascade
                                          +_applyUsagesCascade helper
                                          split findCatalogEntry en
                                          _findCatalogEntryRaw (interne)
                                          + findCatalogEntry (wrapper
                                          avec cascade)
```

### Conséquences Phase 7.79.3a (seul, sans 7.79.3b/c)

- **1363/1363 tests verts** (+28 nouveaux).
- Pas de bump STATE_VERSION (additif, optional, fallback gracieux).
- Pas de migration localStorage.
- **Effet utilisateur immédiat : aucun**. Phase 7.79.3a est de la
  plomberie pour Phase 7.79.3b (UI) et 7.79.3c (sync). Aucune cascade
  state n'est exposée par main.jsx en 7.79.3a → `findCatalogEntry`
  se comporte exactement comme avant.
- Bundle TBD (build à la fin de 7.79.3c).

---

## État précédent (2026-05-20 fin d'après-midi, Phase 7.83 livrée — compat guitare qualitative 3 niveaux)

**Backline v8.14.150 / SW backline-v250 / STATE_VERSION 10 / 1335 tests verts.**

### Phase 7.83 — Compatibilité guitare qualitative 3 niveaux (v8.14.150)

Audit Chrome MCP démo EN du 2026-05-20 (cf Phase 7.84) avait identifié
en problème 3 que les scores nus (84%, 64%, 52%, 49%…) suggèrent une
précision que le scoring V9 heuristique n'a pas, et ne disent pas au
visiteur quoi faire d'un "64%". Phase 7.83 bucketise en 3 niveaux
qualitatifs musicaux.

#### Helper pur — `src/core/scoring/compat-buckets.js`

- `bucketizeScore(score)` → `{id, emoji, threshold, color, bgColor, borderColor}`.
  Defensive : null/undefined/NaN/non-number → fallback 'compromise'.
- `groupByBucket(items)` → `{ideal, good, compromise}` en préservant
  l'ordre relatif d'origine au sein de chaque groupe.
- `COMPAT_LEVELS` : 3 niveaux exposés en constants pour réutilisation.
- **Seuils** validés Sébastien 2026-05-20 : 🟢 ideal (≥ 75) ·
  🟡 good (≥ 55) · 🟠 compromise (< 55).
- **Nommage musical** (choix UX) :
  - FR : 🟢 Mariage parfait · 🟡 Bon match · 🟠 Compromis
  - EN : 🟢 Perfect match · 🟡 Good match · 🟠 Compromise
  - ES : 🟢 Combinación perfecta · 🟡 Buena combinación · 🟠 Compromiso

12 tests Vitest dédiés (`compat-buckets.test.js`) : boundary seuils,
fallback defensive, ordre groupByBucket, structure COMPAT_LEVELS.

#### Refactor PresetBrowser — section "Guitares adaptées" en sections groupées

Avant Phase 7.83, la fiche dépliée affichait chaque guitare avec :
`[nom (type)] [jauge 60×4 couleur scoreColor] [score%]` listés par
ordre décroissant. Après : 3 sections empilées (Mariage parfait / Bon
match / Compromis) avec en-tête coloré, dot 8×8 + nom (type) + jauge
60×4 dans la couleur du bucket. Score brut accessible via `title` HTML
("Score : 87%") pour power-users qui veulent creuser.

Sections vides (count=0) sont skippées → si toutes les guitares
matchent en "Mariage parfait", on n'affiche pas d'en-tête "🟠 Compromis"
inutile.

#### Refactor PresetBrowser — liste presets : pastilles HB/SC/P90 sans chiffre

Avant : 3 pastilles colorées chiffrées `[92] [60] [72]` collées au bord
droit de chaque ligne preset, **sans en-tête** → se lisait comme une
note de qualité de la capture. Bruno avait remonté le doute.

Après :
- En-tête colonne `HB · SC · P90` ajouté à droite au-dessus de la
  liste (font-mono, 9px, uppercase, dim) → clarifie ce que sont
  ces 3 valeurs.
- 3 petits dots 10×10 colorés par bucket (sans chiffre visible).
  Title HTML `"HB — 92%"` au hover pour le détail brut.
- `scoreColor` / `scoreBg` import retiré (plus utilisé dans
  PresetBrowser après le refactor).

#### Aligner Phase 7.69.13 (MyCustomPresetsTab) sur 3 niveaux

Phase 7.69.13 (déc. 2024) avait introduit **4 niveaux** dans l'éditeur
de presets custom (Médiocre 50 / Moyen 75 / Bon 85 / Excellent 95).
Choix utilisateur 2026-05-20 : aligner sur les 3 niveaux Phase 7.83
pour cohérence cross-app.

`src/app/screens/MyCustomPresetsTab.jsx` :
- Import `bucketizeScore` + `COMPAT_LEVELS` depuis compat-buckets.
- `SCORE_LEVELS` 4 entrées → 3 entrées avec valeurs canoniques
  recalibrées : `compromise: 40` / `good: 65` / `ideal: 85`. Ces
  valeurs tombent au cœur de chaque range (vs anciens 50/75/85/95
  qui chevauchaient les seuils).
- `getLevelForScore` délègue à `bucketizeScore`.
- `getLevelColor` supprimé → la couleur vient désormais de
  `COMPAT_LEVELS[levelId].color`.
- Nouveau helper `getLevelLabel(levelId)` qui retourne la string
  i18n localisée (réutilise les clés `compat.*` de Phase 7.83).
- Rendu boutons : itère sur 3 SCORE_LEVELS, snap au value canonique
  au click, label localisé i18n FR/EN/ES.

Aucun test Vitest sur MyCustomPresetsTab ne touchait à `SCORE_LEVELS`
ou `getLevelForScore` (suite vérifie `inferCreator`, `flattenPresets`,
etc.). Refactor safe.

### Architecture livrée Phase 7.83

```
src/main.jsx                                APP_VERSION 8.14.149 → 8.14.150
public/sw.js                                CACHE backline-v249 → backline-v250
src/core/scoring/compat-buckets.js          NOUVEAU — bucketizeScore +
                                            groupByBucket + COMPAT_LEVELS
src/core/scoring/compat-buckets.test.js     NOUVEAU — 12 tests
src/app/screens/PresetBrowser.jsx           +import bucketizeScore/groupByBucket/
                                            COMPAT_LEVELS ; retrait scoreColor/Bg
                                            section "Guitares adaptées" :
                                            sections groupées par bucket +
                                            % en title HTML uniquement
                                            liste presets :
                                            en-tête colonne HB·SC·P90 +
                                            dots colorés sans chiffre +
                                            title hover "HB — 87%"
src/app/screens/MyCustomPresetsTab.jsx      SCORE_LEVELS 4→3 niveaux
                                            +getLevelLabel via t() partagé
                                            getLevelColor → COMPAT_LEVELS[].color
src/i18n/en.js                              +compat.ideal-match, .good-match,
                                            .compromise, .score-tooltip
                                            +preset-list.pickup-header
src/i18n/es.js                              +mêmes 5 clés en ES
```

### Conséquences Phase 7.83

- **1335/1335 tests verts** (+12 nouveaux compat-buckets).
- Bundle 2514.87 → 2517.05 KB (+2.18 KB pour helper + i18n +
  refactor sections).
- **Pas de bump SCORING_VERSION** (couche d'affichage pure, V9
  reste inchangé).
- **Pas de migration localStorage**.
- Cohérence cross-app : MyCustomPresetsTab + PresetBrowser
  partagent désormais les mêmes 3 niveaux + labels i18n.
- **Effet utilisateur** : un visiteur démo qui ouvre Explorer →
  ampli → fiche capture voit désormais "🟢 Mariage parfait
  (3) · Strat 61, Tele 63, Strat Pro II" au lieu de
  "Strat 61 92%, Tele 63 87%, Strat Pro II 85%, LP60 71%, …".
  Plus actionnable pour le débutant, désamorce le risque
  "score nu lu comme une note de qualité" côté créateurs de packs.

### Dette résiduelle Phase 7.83

- **GuitarSelect dropdown** : hors scope Phase 7.83 (n'affichait
  pas de % à la base, juste ★ binaire dans la liste des options).
  Pourrait ajouter une pastille couleur par option à l'avenir si
  utile.
- **Compatibility 87% de la fiche morceau** : un seul chiffre,
  un seul contexte — moins prioritaire, pas inclus. À envisager
  si retour beta.
- **Calibration empirique des seuils** : les seuils 75/55 sont
  basés sur intuition + précédent Phase 7.69.13. Pas calibré
  sur la distribution réelle du catalog actuel. Si retour
  utilisateur "trop de Compromis" ou "pas assez de Mariage
  parfait", ajuster `COMPAT_LEVELS.ideal.threshold` et/ou
  `COMPAT_LEVELS.good.threshold`.
- **Le scoring V9 brut reste accessible via title HTML** —
  intentionnel (power-users + diagnostic). Si on veut vraiment
  cacher les % bruts, supprimer ces title attributes.

---

## État précédent (2026-05-20 après-midi, Phase 7.84 livrée — i18n Explorer + 167 desc ampli EN)

**Backline v8.14.149 / SW backline-v249 / STATE_VERSION 10 / 1323 tests verts.**

### Phase 7.84 — i18n PresetDetailInline + 167 descriptions ampli EN (v8.14.149)

Audit Chrome MCP de la démo EN du 2026-05-20 (v8.14.148) avait
identifié 3 problèmes Explorer (cf section "Idées en attente" Phase
7.84 historiquement) :
1. Fiche capture (`PresetDetailInline`) restait 100% FR en mode EN
   (titres sections, descriptions ampli, libellés gain/style, badges
   installation, ~25 strings + 167 desc ampli).
2. Nom de ZIP brut `📁 TSR-Freeman-BE-DE-idSzii.zip` exposé dans la
   fiche (plomberie interne).
3. Scores nus en liste sans en-tête (couplé Phase 7.83).

#### Fix 1 — Wrapping i18n complet PresetBrowser

`src/app/screens/PresetBrowser.jsx` (composant racine + sous-composants
`PresetDetailInline`, `PresetList`, `UsagesSection` co-localisés) :
- `useLocale()` ajouté au composant racine → force re-render au switch
  de langue (pattern Phase 7.36+). Les 51 t() existants ne se
  re-rendraient pas sans ce hook (bug latent).
- ~30 nouvelles clés EN + ES ajoutées (`preset-detail.*`,
  `preset-list.*`, `usages.*`). Les ~12 clés `usages.*` de la
  `UsagesSection` (déjà appelées par t() mais sans entrées en.js/es.js)
  sont enfin présentes.
- Constantes locales `STYLE_LABELS` / `GAIN_LABELS` / `GAIN_SHORT` /
  `GAIN_STYLES` / `presetChar` regex output (~7 catégories) → toutes
  wrappées via t().
- Titres sections ("Infos ampli / preset", "Style & gain", "Morceaux
  mythiques — registre {register}", "Guitares adaptées") → t() /
  tFormat().
- Badges installation ("📦 Banque {bank}{slot}", "📦 Non installé",
  pareil Plug) → tFormat() / t().
- `PresetList` : "Modèle d'ampli", "Tous ({count})", "{count} preset(s)
  — clique pour voir la fiche" (tPlural), "Voir {n} de plus ({remaining}
  restants)" (tFormat).

#### Fix 2 — Descriptions ampli EN (data_context.js)

Choix utilisateur explicite 2026-05-20 : **traduire EN seulement,
documenter ES en dette**.

`src/data/data_context.js` `PRESET_CONTEXT` : champ `desc_en` ajouté à
chacune des **167 entries** ampli (Marshall, Fender, Vox, Mesa, Dumble,
Bogner, Soldano, Friedman, Diesel, ENGL, EVH, Peavey, Roland, Hiwatt,
Orange, Matchless, Cornford, Dr. Z, Music Man, Trainwreck, Tone King,
Mezzabarba, Two Rock, Carr, Benson, Bad Cat, Suhr, PRS, Sons, Talon,
Ironlung, ZWREK, Amp Nation, D13, Reinhardt, Rouge Plate, Laney
Supergroup/AOR/Lionheart/etc., 16 pédales standalone, etc.).

Volume : ~167 traductions de prose technique guitare (~50 mots
chacune en moyenne). Conservation des refs/emoji/desc FR intacts.

Lookup côté UI dans `PresetDetailInline` ligne ~386 :
```js
const loc = getLocale();
const desc = (loc === 'en' && ctx?.desc_en) ? ctx.desc_en : ctx?.desc;
```
Si `desc_en` absent (cas où une futur entry n'aurait pas été traduite)
→ fallback FR. ES → fallback FR par défaut (dette).

#### Fix 3 — Masquer le ZIP brut

`src/app/screens/PresetBrowser.jsx` ligne 383 : retrait du span
`📁 TSR-Freeman-BE-DE-idSzii.zip`. Redondant avec `info.pack` span
ligne 382, exposait du nom de fichier interne (plomberie).
Import `TSR_PACK_ZIPS` retiré (plus utilisé).

#### Problème 3 — reporté à Phase 7.83

Pas de tooltip "HB · SC · P90" ajouté sur les scores nus en liste.
Sera traité par Phase 7.83 (compatibilité guitare 3 niveaux qualitatifs)
qui suit immédiatement Phase 7.84.

### Architecture livrée Phase 7.84

```
src/main.jsx                              APP_VERSION 8.14.148 → 8.14.149
public/sw.js                              CACHE backline-v248 → backline-v249
src/app/screens/PresetBrowser.jsx         +useLocale + getLocale imports
                                          retrait import TSR_PACK_ZIPS
                                          PresetBrowser +useLocale() racine
                                          PresetDetailInline :
                                          +constantes wrappées t()
                                          +presetChar wrap t()
                                          +section titles via t()/tFormat
                                          +badges install via tFormat/t
                                          +span ZIP brut retiré
                                          +lookup desc/desc_en selon locale
                                          PresetList :
                                          +"Modèle d'ampli", "Tous (N)"
                                          +"{count} presets — clique" tPlural
                                          +"Voir N de plus" tFormat
src/data/data_context.js                  PRESET_CONTEXT : +desc_en sur
                                          167 entries (toutes)
src/i18n/en.js                            +~33 clés preset-detail.* +
                                          ~4 preset-list.* + ~13 usages.*
src/i18n/es.js                            +mêmes ~50 clés en ES
```

### Conséquences Phase 7.84

- **1323/1323 tests verts** (aucune régression, aucun nouveau test —
  la suite Vitest ne couvre pas l'UI Explorer en détail).
- Bundle 2481.35 → 2514.87 KB (+33.5 KB) :
  - ~5 KB pour le wrapping i18n + lookup desc_en
  - ~28 KB pour les 167 descriptions EN
  - ~50 nouvelles clés EN+ES (~7 KB)
  Acceptable, compromis sur la fluidité fiche EN avant Mail 3 Paul.
- **Pas de bump STATE_VERSION** (purement UI + data additive).
- **Pas de migration localStorage**.
- **Cohabitation** : un visiteur FR voit exactement ce qu'il voyait
  avant Phase 7.84 (les descs FR + libellés t() FR identiques).
  Un visiteur EN voit désormais la fiche entièrement en EN. Un
  visiteur ES voit la structure ES (titres sections, libellés,
  badges) mais les descriptions ampli restent FR (dette).
- **Bug latent corrigé** : avant Phase 7.84, les 51 t() existants de
  PresetBrowser ne se re-rendaient pas au switch de langue (pas de
  `useLocale()`). Le hook est désormais en place.
- **Mail 3 Paul Drew TSR** : prêt à envoyer (l'audit Explorer EN qui
  était le dernier blocker est résolu).

### Dette résiduelle Phase 7.84

- **Descriptions ampli ES non traduites** : 167 entries fallback FR
  en mode ES. À traduire si beta hispanophone (Francisco) consulte
  Explorer en pratique. ~3-4h prose dédiée.
- **JamScreen utilise PresetDetailInline** : pas de `useLocale()`
  dans JamScreen non plus → bug latent si user switch langue depuis
  JamScreen. Fix trivial (1 ligne) à faire si rapporté.
- **2 résidus i18n mineurs Phase 7.82** toujours en attente :
  `<html lang>` non synchronisé + `APP_TAGLINE` modale d'intro non
  wrappée. Cosmétique.
- **Bug #6 (preset Live absent)** : toujours reporté hors démo.

---

## État précédent (2026-05-20 midi, Phase 7.82.1 livrée — patch démo locale + 🎤 ListScreen)

**Backline v8.14.148 / SW backline-v248 / STATE_VERSION 10 / 1323 tests verts.**

### Phase 7.82.1 — Patch démo locale + 🎤 ListScreen (v8.14.148)

Suite Phase 7.82 livrée le matin (v8.14.147), Sébastien a constaté 2
choses lors du re-audit Chrome MCP :

1. **Bug #0 persistait** : démo démarrait toujours en FR malgré
   l'override Phase 7.82 dans `enterDemoMode`.
2. **Désactivation mode scène incomplète** : Phase 7.82 masquait le
   CTA HomeScreen mais le bouton 🎤 dans la barre du sélecteur de
   setlist (ListScreen) restait actif.

#### Fix 1 — Bug #0 (cause racine = cache `_cachedLocale` figé)

**Diagnostic** : Phase 7.82 utilisait `getLocale()` dans
`enterDemoMode`. Mais `getLocale()` retourne `_cachedLocale` en
priorité (Phase 7.41), figé au premier appel. Quand le visiteur
arrive sur `?demo=1` :
1. App mount → `useLocale()` à la racine appelle `getLocale()` →
   lit localStorage → pose `_cachedLocale = 'fr'` (ou autre)
2. useEffect auto-login → `enterDemoMode()` → `getLocale()` retourne
   le `_cachedLocale` figé, pas forcément aligné sur le locale réel
   que le visiteur exprime (LandingScreen sélecteur, localStorage
   posé manuellement, etc.)
3. `demoProfile.language = _cachedLocale` → potentiellement faux

**Fix Phase 7.82.1** dans `src/i18n/index.js` — 2 nouveaux helpers :

- **`detectFreshLocale()`** : re-lit `localStorage[backline_locale]`
  + fallback `navigator.language` sans toucher au cache module.
  Garantie de refléter la réalité actuelle, pas une valeur figée.
- **`forceDemoLocale(loc)`** : bascule l'i18n module
  (`_cachedLocale` + `_activeProfileLanguage` + clear `_tCache` +
  notify listeners) SANS déclencher `_profileLanguageUpdater` (qui
  écrirait dans `profile.language` → push Firestore via le profil
  curateur source).

Dans `src/main.jsx` `enterDemoMode` :
```js
const currentLocale = detectFreshLocale();
forceDemoLocale(currentLocale);
const demoProfile = { ...snap.profile, language: currentLocale };
```

`forceDemoLocale` est appelé AVANT `_setProfilesRaw` →
`setActiveProfileId` pour que les composants déjà mounted
(LandingScreen → modale d'intro juste après navigation) reflètent
immédiatement le bon locale, sans attendre que `bindActiveProfile`
se déclenche au re-render React.

#### Fix 2 — Gate `!isDemo` sur 🎤 ListScreen

`src/app/screens/ListScreen.jsx:414` : ajout du gate `!isDemo` sur
le bouton 🎤 (data-testid="list-screen-live"). Cohérence avec le
CTA HomeScreen masqué Phase 7.82. Le visiteur démo ne peut plus
entrer en LiveScreen (et donc plus tomber sur le bug #6 reporté).

#### Tests Vitest (+10 nouveaux)

`src/i18n/i18n.test.jsx` :
- **tPlural format plat × 1** (cohérent Phase 7.82 fix Bug #3) :
  `'list.songs-count'` retourne "1 song"/"5 songs" en EN, idem ES.
- **detectFreshLocale × 4** : localStorage prioritaire, fallback
  navigator.language, valeur invalide ignorée, bypass cache module.
- **forceDemoLocale × 5** : bascule getLocale, notifie listeners,
  ne déclenche PAS `_profileLanguageUpdater`, no-op si identique,
  rejette locales non supportés.

1323/1323 tests verts (1313 Phase 7.82 + 10 Phase 7.82.1).

### Architecture livrée Phase 7.82.1

```
src/main.jsx                       APP_VERSION 8.14.147 → 8.14.148
                                   +import detectFreshLocale, forceDemoLocale
                                   enterDemoMode : remplace getLocale() par
                                   detectFreshLocale() + forceDemoLocale()
public/sw.js                       CACHE backline-v247 → backline-v248
src/i18n/index.js                  +detectFreshLocale export (bypass cache)
                                   +forceDemoLocale export (bascule module
                                   sans toucher au profil curateur)
src/i18n/i18n.test.jsx             +10 tests Phase 7.82 + 7.82.1
src/app/screens/ListScreen.jsx     gate !isDemo sur bouton 🎤
                                   (cohérence Phase 7.82 HomeScreen)
```

### Conséquences Phase 7.82.1

- 1323/1323 tests verts ✅
- Bundle 2481.11 → 2481.35 KB (+0.24 KB pour 2 helpers + 10 tests).
- Pas de bump STATE_VERSION.
- Pas de migration localStorage.
- **Mail 3 Paul Drew enfin débloqué** (vrai cette fois).

### Validation audit démo EN — Chrome MCP 2026-05-20 (v8.14.148)

Re-audit de la démo publique en anglais après livraison Phase 7.82.1 :
- **Bug #0 confirmé corrigé** ✅ : `mybackline.app/?demo=1` avec
  `localStorage.backline_locale='en'` rend la démo en anglais, modale
  d'intro SplashPopup comprise. Le profil démo bundlé n'écrase plus la
  langue du visiteur.
- **Fix 2 confirmé complet** ✅ : le bouton 🎤 mode scène est masqué à
  la fois sur HomeScreen ET dans la barre du sélecteur de setlist
  (ListScreen) en mode démo.
- **Strings #1-5 confirmés traduits** ✅ (footer Mon Profil, "Bridge
  pickup", "8 songs", "Edit setlist", empty state Live).

### Dette résiduelle Phase 7.82 + 7.82.1

- **2 résidus i18n mineurs relevés à l'audit 2026-05-20** (non
  bloquants) :
  - `<html lang>` non synchronisé : l'attribut `lang` de `<html>`
    reste `"fr"` même quand l'UI rend en EN. Cosmétique (lecteurs
    d'écran / SEO), pas visible utilisateur. À synchroniser sur le
    locale effectif dans `setLocale` / `getLocale`.
  - Tagline modale d'intro non wrappée i18n : *"Le guide intelligent
    pour tes pédales et amplis modélisés"* (constante `APP_TAGLINE`
    de `core/branding.js`) reste FR dans le SplashPopup même en EN.
    Visible par un visiteur anglophone dès la modale. Une ligne à
    traduire (ou variante par locale dans branding.js).
- **Bug #6 (preset Live absent)** : reporté hors démo (mode scène
  désactivé en démo via Fix 2). Reste à investiguer pour les vrais
  profils si reporté en pratique. Hypothèse : `ToneXLiveBlock` lit
  `song?.aiCache?.result?.[device.presetResultKey]?.label` — vérifier
  que `aiC.preset_ann` / `preset_plug` sont bien remplis par
  `enrichAIResult` au moment du render Live (pas seulement par
  `findInBanks` qui matche par installation).
- **Phase 7.80.1** (audit responsive iPhone/iPad) toujours en
  attente. Effort 6-10h audit + 10-15h fixes.
- **Phase 7.79.3** (cascade 3 niveaux user > studio > backline >
  default) validée 2026-05-19 mais reportée. Effort ~5h.

---

## État précédent (2026-05-20 matin, Phase 7.82 livrée — fixes i18n mode démo + désactivation mode scène en démo)

**Backline v8.14.147 / SW backline-v247 / STATE_VERSION 10 / 1313 tests verts.**

### Phase 7.82 — Fixes i18n démo + mode scène off démo (v8.14.147)

Audit Chrome MCP de la démo publique en anglais (2026-05-19) avant
envoi du Mail 3 à Paul Drew (qui propose précisément le lien démo) :
6 problèmes dont 1 bloquant. Tous fixés dans cette release sauf
Bug #6 (preset LiveBlock manquant — neutralisé en démo via Décision
mode scène off, à corriger séparément pour les vrais profils).

#### Bug #0 (root, bloquant Mail 3) — démo démarrait toujours en FR

**Cause racine** : le profil démo bundlé (`src/data/demo-profile.json`)
a `profile.language = 'fr'` hérité du curateur. À l'entrée en mode
démo, `bindActiveProfile` (déclenché par `setActiveProfileId('demo')`)
écrasait `_activeProfileLanguage` avec `'fr'` → `getLocale()` ignorait
le locale détecté de la LandingScreen → UI 100% FR pour tout visiteur
EN/ES, à commencer par la modale d'intro (SplashPopup).

**Fix Option B** dans `src/main.jsx` `enterDemoMode` (ligne ~628) :
```js
const currentLocale = getLocale();
const demoProfile = { ...snap.profile, language: currentLocale };
_setProfilesRaw(prev => ({ ...prev, [demoProfile.id]: demoProfile }));
// ...
setActiveProfileId(demoProfile.id);
```

Lit le locale courant (priorité `_activeProfileLanguage` > localStorage
> `navigator.language`) avant d'injecter le profil démo. Respecte le
choix du visiteur fait sur la LandingScreen. `getLocale` ajouté aux
imports i18n.

#### Désactivation CTA Mode scène en profil démo (validée 2026-05-19)

Décision Sébastien : *"je pense qu'il faut désactiver le mode scène
en profil démo, ça n'apporte pas grand chose et c'est un territoire
de bugs potentiels"*. `HomeScreen.jsx` IIFE Live ligne ~467 :
```jsx
if (isDemo) return null;
```
Neutralise bugs #5 (i18n empty state) et #6 (preset Live absent
Back in Black / The Thrill Is Gone) côté démo. Le visiteur découvre
l'app, il n'est pas sur scène. Le bug #6 reste à investiguer pour
les vrais profils (preset résolu via une guitare sélectionnée non
pré-assignée dans le contexte Live démo).

#### Bug #1 — Footer Mon Profil 4 strings wrappées

`MonProfilScreen.jsx` lignes 404-414. 4 strings FR hardcodées
wrappées via `t()` :
- "Aide" → `profile.footer-help` (EN "Help" / ES "Ayuda")
- "💬 Envoyer un feedback" → `profile.footer-feedback`
- "Mise à jour" → `profile.footer-update`
- "Se déconnecter" → `profile.footer-logout`

#### Bug #2 — "Micro chevalet" dans SETTINGS — MY PICK

Cause : `localGuitarSettings` (`core/scoring/guitar.js`) retournait
une string FR composée non wrappable côté UI. Refactor : retourne
désormais un objet structuré `{pickupKey, pickupFallback, tone,
volume, mismatchKey, mismatchFallback}`. Les 2 call sites
(HomeScreen.jsx:659 + SongDetailCard.jsx:402) composent le texte
final avec `t(pickupKey, pickupFallback)` + format
`{pickup} · Tone {tone} · Volume {volume}{mismatch}`.

11 nouvelles clés EN/ES :
- `pickup.neck` / `.neck-pos5` / `.bridge` / `.bridge-or-pos4`
- `pickup.middle-or-neck` / `.choice-attack` / `.neck-or-bridge`
- `pickup.mismatch.hb-sc` / `.sc-hb` / `.p90` / `.p90-hb`
- `home.song.tone-label` + `volume-label`, idem `song-detail.*`

#### Bug #3 — "8 morceaux" en EN (cause racine = `tPlural` bug)

**Cause racine identifiée** : `tPlural` (`i18n/index.js`) cherchait
uniquement le format imbriqué via `key.split('.').reduce(...)`. Les
dicts en.js/es.js sont en format **plat** (la clé entière
`'list.songs-count'` est une key directe). Lookup undefined →
fallback inline FR utilisé même en EN. Affecte potentiellement
TOUS les `tPlural` du projet, pas que ce site.

Fix dans `i18n/index.js` (cohérent avec `lookup()`) :
```js
let node;
if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
  node = dict[key];
} else {
  node = key.split('.').reduce(...);
}
// + fallback FR si pas trouvé en EN/ES
```

#### Bug #4 — "Éditer la setlist" + clés `list.edit-*`

Les clés étaient déjà wrappées dans `ListScreen.jsx` mais
manquantes dans en.js/es.js. Ajoutées :
- `list.edit-songs` (EN "✏️ Edit setlist")
- `list.edit-done` (EN "✅ Done")
- `list.edit-setlist-title` (EN tooltip)

#### Bug #5 — "Pas de preset déterminé" wrappé

`src/devices/_shared/ToneXLiveBlock.jsx:62` : wrap via
`t('tonex-live.no-preset', 'Pas de preset déterminé pour ce morceau.')`.
Import `t` ajouté. Test `ToneXLiveBlock.test.jsx` ajusté pour ne
plus dépendre du texte exact (assertion data-testid seule) — évite
de casser selon le locale détecté par jsdom.

#### Bug #6 (reporté, hors démo) — preset Live manquant

`ToneXLiveBlock` affiche "no preset determined" pour Back in Black
+ The Thrill Is Gone alors que ces morceaux ont un preset visible
en vue Setlists. Cause probable : le LiveBlock résout via une
guitare sélectionnée pour le morceau, et aucune n'est pré-assignée
dans le contexte Live démo. **Neutralisé en démo** via désactivation
mode scène (Décision Phase 7.82). À investiguer séparément pour
les vrais profils si l'utilisateur reporte le bug en pratique.

### Architecture livrée Phase 7.82

```
src/main.jsx                                APP_VERSION 8.14.146 → 8.14.147
                                            +import getLocale d'i18n
                                            enterDemoMode override
                                            profile.language
public/sw.js                                CACHE backline-v246 → backline-v247
src/i18n/index.js                           tPlural supporte format plat
                                            + fallback FR (Bug #3 root)
src/i18n/en.js                              +20 clés Phase 7.82
src/i18n/es.js                              +20 clés Phase 7.82
src/app/screens/MonProfilScreen.jsx         4 strings footer wrappées
src/app/screens/HomeScreen.jsx              gate isDemo sur CTA Live
                                            composition i18n localGuitarSettings
src/app/screens/SongDetailCard.jsx          composition i18n localGuitarSettings
src/core/scoring/guitar.js                  localGuitarSettings retourne
                                            objet structuré
src/devices/_shared/ToneXLiveBlock.jsx      wrap empty state
src/devices/_shared/ToneXLiveBlock.test.jsx assertion data-testid seule
```

### Conséquences Phase 7.82

- **1313/1313 tests verts** (aucune régression structurelle).
- **Bundle** 2360 → 2481 KB (+121 KB pour traductions + refactor —
  prévu).
- **Pas de bump STATE_VERSION** (purement i18n + UI).
- **Pas de migration localStorage**.
- **Cohabitation pré/post-7.82** : un visiteur démo qui avait
  réussi à passer en EN manuellement via Mon Profil → Affichage
  voit désormais l'EN par défaut. Pas de friction observable.
- **Mail 3 Paul Drew débloqué** : peut être envoyé.

### Dette résiduelle Phase 7.82

- **Bug #6 (preset Live)** : à corriger pour les vrais profils si
  reporté. Investigation : `ToneXLiveBlock` lit
  `song?.aiCache?.result?.[device.presetResultKey]?.label` — à
  vérifier que le preset est bien résolu côté démo curé.
- **Audit responsive iPhone/iPad** (Phase 7.80.1) toujours en
  attente. Bouton OK SongSearchBar déborde 393px iPhone, version
  AppHeader tronquée, layout iPad "desktop tassé". Phase 7.80.1
  ~6-10h audit + 10-15h fixes.
- **Other tPlural sites** : le fix de Bug #3 corrige potentiellement
  d'autres compteurs ailleurs (deletes confirms, analyze count,
  empty-setlist-confirm). Pas de régression observée — la majorité
  utilisait déjà `count` interpolation depuis le fallback inline FR
  donc le rendu était cosmétiquement OK.

---

## État précédent (2026-05-19 nuit++, Phase 7.81 livrée — fix divergence aiCache Mac↔iPhone)

**Backline v8.14.146 / SW backline-v246 / STATE_VERSION 10 / 1313 tests verts.**

### Phase 7.81 — Fix divergence aiCache via rigSnapshot scope profil actif + LWW par ts (v8.14.146)

**Bug diagnostiqué 2026-05-19 nuit (~22h30 Paris)** par investigation
DevTools côté Mac + iPhone. Deux phénomènes distincts identifiés sur
le profil Sébastien (Mac + iPhone v8.14.145 active sur les deux) :

**Phénomène 1 — "manque 5" sur iPhone, Mac affiche tout analysé** :
sur la setlist "Ma Setlist", le bouton "🤖 Analyser/MAJ N" affichait
N=5 côté iPhone alors que Mac n'avait aucun manquant. Les 2 devices
avaient 29 entrées dans `profile.sebastien.aiCache` (identique).

**Phénomène 2 — analyses divergentes sur Cours samedi après-midi** :
Hells Bells (AC/DC) montrait `ref_amp: "Marshall JTM45 / JMP 50"` sur
Mac mais `"Marshall JTM45 / Super Lead"` sur iPhone. Preset_ann
diverge aussi (`13C TSR JTM Klone Lead` vs `13B TSR JTM Jumped`).
Mountain Climbing : ref_amp `undefined` sur Mac, présent sur iPhone.
2 fetchAI Gemini distincts persistants (LLM non déterministe), jamais
convergent.

### Cause racine 1 — `rigSnapshot` pollué par union all-rigs

Dump comparatif (2026-05-19 22:34) :

```
Mac myGuitars (12)  = iPhone myGuitars (12) : IDENTIQUES ✅
Mac rigSnapshot HB  = 22 guitares (avec sire_t3)
iPhone rigSnapshot HB = 21 guitares (sans sire_t3)
```

`computeRigSnapshot()` était calculé sur `allRigsGuitars` (union
de TOUS les profils, Phase 3.6 pour enrichir le prompt IA) et stocké
dans `aiCache.rigSnapshot`. Quand un AUTRE profil (Francisco, Bruno)
ajoute/perd une custom guitar (pollution myGuitars cross-profile
observée Phase 7.74.x — 4 occurrences en 7 jours), l'union diverge
entre devices → tous les `rigSnapshot` stockés deviennent stales →
`rigStale === true` côté un seul device → **faux positif "manque 5"**.

Effet collatéral non anticipé du Phase 3.6 (union all-rigs au prompt)
qui contaminait la détection rigStale conçue Phase 5.10.2.

### Cause racine 2 — LWW non-convergent (Phase 7.80.2 limite)

Phase 7.80.2 (livré 2026-05-19 soir) fixait l'écrasement aiCache via
adopt-en-bloc en introduisant un merge per-songId : *"Pour chaque
songId, garde la version avec le `sv` (SCORING_VERSION) le plus
élevé. Égalité ou local-only → keep local."*

Or `sv = 9` partout (V9 verrouillée). Donc quand 2 devices analysent
indépendamment le même morceau → égalité sv → **keep local des 2
côtés → divergence permanente**. Le merge LWW ne tranche jamais.

### Fix Phase 7.81 (2 changements couplés)

**Fix A — rigSnapshot scopé au rig du profil actif** :

- `src/app/screens/SongDetailCard.jsx` lignes 81+111 : `computeRigSnapshot(guitars || GUITARS)` au lieu de `computeRigSnapshot(allRigsGuitars || guitars)`.
- `src/app/screens/ListScreen.jsx` lignes 320+351 : idem.
- Le prompt `fetchAI` continue à recevoir `allRigsGuitars` (Phase 3.6
  préservée pour enrichir le contexte IA). Seule la détection stale
  bascule sur le rig actif (12 guitares Sébastien).

**Fix B — LWW par timestamp** :

- `src/app/utils/ai-helpers.js` `updateAiCache` : stamp `ts: Date.now()`
  à chaque write. `opts.ts` permet d'override pour les tests.
- `src/core/state.js` `mergeProfileLWW` section aiCache : LWW par `ts`
  en priorité. Fallback `sv` pour entries legacy sans ts (rétro-
  compat Phase 7.80.2). Égalité ts → keep local.
- `src/main.jsx` syncHash inclut `ts` (2 sites : profileHash +
  songDbWithProfileCache hash) → push Firestore se déclenche quand
  seul ts change après un nouveau fetchAI.

### Tests Phase 7.81 (+15 nouveaux Vitest)

`src/app/utils/ai-helpers.test.js` (+8) :
- `updateAiCache` stamp ts par défaut, opts.ts override, ts par
  appel.
- `computeRigSnapshot` ids triés joints par |, falsy → '', scénario
  bug rig actif vs union all-rigs.

`src/core/state.test.js` (+7) section "Phase 7.81 aiCache LWW par ts" :
- **Scénario bug** 2 devices analysés indépendamment HB → ts plus
  récent gagne.
- ts local plus récent → keep local.
- Égalité ts → keep local.
- Local sans ts (legacy) + remote avec ts → remote gagne.
- Local avec ts + remote sans ts → local gagne.
- Aucun ts (2 legacy) → fallback sv (Phase 7.80.2 préservée).
- Priorité ts sur sv (ts local plus récent gagne même si sv remote
  plus élevé).

1313/1313 tests verts (vs 1298 Phase 7.74.4).

### Architecture livrée Phase 7.81

```
src/main.jsx                        APP_VERSION 8.14.145 → 8.14.146
                                    syncHash inclut a.ts (profileHash +
                                    songDbWithProfileCache hash)
public/sw.js                        CACHE backline-v245 → backline-v246
src/app/utils/ai-helpers.js         updateAiCache stamp ts
src/app/screens/SongDetailCard.jsx  computeRigSnapshot(guitars)
                                    drop allRigsGuitars (2 sites)
src/app/screens/ListScreen.jsx      computeRigSnapshot(allGuitars)
                                    + computeRigSnapshot(guitars)
                                    drop allRigsGuitars (2 sites)
src/core/state.js                   mergeProfileLWW aiCache section :
                                    LWW par ts, fallback sv legacy
src/app/utils/ai-helpers.test.js    +8 tests Phase 7.81
src/core/state.test.js              +7 tests Phase 7.81
```

### Validation post-déploiement (2026-05-19 nuit)

- **Mac + iPhone reload PWA 2× → v8.14.146 actif** ✅
- **Mac : "🔄 Réinitialiser mes analyses" + "🤖 Analyser/MAJ 29"**
  sur setlist Arthur & Seb → 26 analyses réussies + 3 skips Gemini
  (JSON parsing erreurs non-déterministes : Smoke on the Water,
  Calling Elvis, 3e). Pushs WITH aiCache 393 → 616 KB, sous
  SAFE_LIMIT 980 KB ✅
- **iPhone reload → pull → convergence parfaite** :
  - Mac    : 32 aiCache entries, 26 with ts
  - iPhone : 32 aiCache entries, 26 with ts (identique ✅)
  - 6 entries sans ts = morceaux dans setlists autres qu'Arthur &
    Seb, non touchés par invalidation. Fonctionnent en fallback sv.
- **Validation visuelle Hells Bells + Mountain Climbing** :
  vues Mac et iPhone identiques (mêmes ref_amp, preset_ann,
  preset_plug) ✅

### Effet attendu pour les futurs cas

- **rigSnapshot stable** : pollution myGuitars cross-profile (Phase
  7.74.x) sur Bruno/Francisco/Arthur ne déclenchera plus de
  rigStale faux positif sur Sébastien (et vice-versa).
- **Convergence garantie** : 2 devices qui analysent indépendamment
  le même morceau convergeront en pull (le ts récent gagne).
- **Cohabitation legacy** : entries pré-7.81 sans ts continuent de
  fonctionner via fallback sv (jamais convergent si égalité sv,
  mais au moins pas écrasés). Régénérés naturellement à la prochaine
  analyse → ts présent → LWW propre.

### Dette résiduelle Phase 7.81

- **3 skips Gemini** (Smoke on the Water, Calling Elvis, 3e) :
  réponses JSON cassées non parsables par `safeParseJSON`. À
  relancer via "🤖 Analyser/MAJ 3" — Gemini répondra probablement
  correctement à un nouveau fetch.
- **6 entries sans ts résiduelles** : non bloquant, fonctionnent en
  fallback sv. Si jamais ces morceaux divergent (peu probable car
  pas re-fetchés indépendamment), un seul re-Analyser/MAJ ajoutera
  ts.
- **Pas de migration one-shot des aiCache pré-7.81** : décision
  délibérée pour éviter de coder une migration jetable. Coût :
  re-fetchAI naturel à l'ouverture de chaque morceau dont le
  rigSnapshot diverge du nouveau format. Acceptable vu Gemini free
  tier.

---

## État précédent (2026-05-19 nuit, Phase 7.74.4 livrée — fix pattern swap cg_*→standard + language delta 60s)

**Backline v8.14.145 / SW backline-v245 / STATE_VERSION 10 / 1298 tests verts.**

### Phase 7.74.4 — Couche 4 défense myGuitars + language delta élargi (v8.14.145)

**Bug observé 2026-05-19 ~21h** (4e occurrence pollution profile,
captures via wrapper Phase 7.74.5 sur Mac) :

```
local  : [11 standards Sébastien, cg_1779120397266 (Tele 51)]
remote : [11 standards Sébastien, sire_t7, sire_t3]
otherProfilesGuitars (Phase 7.74.1) : {sire_t7, ...} sans sire_t3
```

Phase 7.74.1 a filtré `sire_t7` (orphan, dans rig Francisco local)
mais pas `sire_t3`. Confirmation iPhone : `sire_t3` n'est dans le
rig d'AUCUN profil (Francisco actuel = `[sire_t7, cg_1779120671806]`,
Bruno/Arthur/Franck/Emmanuel n'ont pas Sire). **Pollution pure** :
sire_t3 a été ajouté à `sebastien.myGuitars` par un push antérieur
(iPhone session pré-correction probablement), sans trace dans aucun
profil actuel.

Conséquences chaînées :
- Couche 3 (drop ≥3 ou >50%) inopérante : drop = 1 (`cg_1779120397266`)
- Couche 1 orphan check inopérante : sire_t3 absent du rig d'aucun
  profil → pas dans `otherProfilesGuitars`
- Adoption merge → Tele 51 perdue, sire_t3 adopté
- Bonus : langue FR → EN basculée (delta merges > 5s seuil Phase 7.74)

### Fix Phase 7.74.4 (2 changements ciblés)

**Site 1 — `mergeProfileLWW` myGuitars section** : nouvelle Couche
4 après filter orphan. Si après filter le delta entre local et
nextGuitars est **"drop exactement 1 cg_* + add ≥1 standard"**,
c'est la signature d'une pollution résiduelle → keep local entier.

```js
const isSwapSuspect =
  droppedNow.length === 1 &&
  /^cg_/.test(droppedNow[0]) &&
  addedNow.length >= 1 &&
  addedNow.every((g) => !/^cg_/.test(g));
if (isSwapSuspect) {
  nextGuitars = localGuitars; // keep local
}
```

**Risque false-positive** : un user remplace explicitement sa custom
par une standard du catalog. Très rare (les customs existent
justement car absentes du catalog). Workaround : faire les 2 actions
sur des stamps séparés (add d'abord, remove ensuite — donne 2 merges
distincts qui passent).

**Site 2 — `mergeProfileLWW` language section** : seuil delta
élargi 5s → 60s. Les events de pollution observés étaient espacés
de plusieurs minutes (>5s), donc Phase 7.74 garde-fou language
inopérant. Au-delà de 60s, on considère le changement comme
intentionnel utilisateur.

### Approche explorée puis rejetée (union local+remote)

Initialement : étendre `guitarsByProfile` de `mergeProfilesLWW` à
l'union local+remote, pour couvrir le cas "Francisco a ajouté sire_t3
sur son device, local francisco stale". **Rejeté** : conflit
asymétrique — la pollution dans `remote.sebastien` contamine
`guitarsByProfile.sebastien` qui contamine ensuite l'orphan check
des autres profils. Le bug réel observé (sire_t3 dans aucun rig)
n'est pas couvert par cette approche. Le swap suspect cg_*→standard
le catch directement, plus simple et plus robuste.

### Tests Phase 7.74.4 (+9 nouveaux)

`src/core/state.test.js` :
- **Couche 4 swap suspect** × 6 :
  - SCÉNARIO BUG 4 reproduction exacte (Tele 51 + sire_t3, otherProfilesGuitars vide)
  - drop 1 cg_* + add 2 standards hors orphans → keep local
  - régression ajout SEUL standard (pas de drop) → adopté
  - régression drop standard (pas cg_*) + add standard → adopté
  - régression drop cg_* + add cg_* (custom→custom) → adopté
  - régression drop 2 cg_* + add 2 standards (drop ≤ 50%) → adopté
- **Language delta 60s** × 3 :
  - delta 30s + conflict → keep local (élargi vs 5s)
  - delta 70s + conflict → adopt remote (au-delà seuil)
  - régression delta < 5s → keep local (préservé)

Tests existants Phase 7.74 language ajustés pour le nouveau seuil
(10s → 100s pour test "long delta → adopt").

**1298/1298 tests verts** (vs 1289 Phase 7.80.2).

### Architecture livrée Phase 7.74.4

```
src/main.jsx                APP_VERSION 8.14.144 → 8.14.145
public/sw.js                CACHE backline-v244 → backline-v245
src/core/state.js           mergeProfileLWW :
                              +Couche 4 swap suspect cg_*→standard
                              +language delta 5s → 60s
src/core/state.test.js      +9 tests Phase 7.74.4
                            +2 tests legacy language ajustés
```

### Validation post-déploiement (2026-05-19 nuit)

- **Push origin main fait** (commit `e73ea99` sur main avec
  `dist/index.html` + `dist/sw.js` v8.14.145).
- **iPhone reload validé** : `JSON.parse(localStorage.tonex_guide_v2)
  .profiles.sebastien` = 12 guitares dont Tele 51 (`cg_1779120397266`),
  pas de sire_t3/sire_t7 polluants, language `fr`. Wrapper Phase
  7.74.5 actif (`✅ [Backline] Persistent merge logger active`).
- **Erreurs transitoires "Service Worker context closed" + firestore
  "Load failed"** observées au 1er reload iPhone — attendues au
  basculement SW v244 → v245 (fetch en cours tué par activation
  nouveau SW). Disparues au 2e reload.
- Aucun log forensique `[merge-defense]` capturé sur iPhone post-fix
  → état stable, pas de merge suspect en cours.

### Dette résiduelle Phase 7.74.4

- **Source de pollution non identifiée** : on a éliminé le state
  iPhone actuel comme source (12 guitares dont Tele 51, propre).
  Probable : session iPhone antérieure pré-correction OU Mac
  auto-pollution historique. Wrapper iPhone activé Phase 7.74.4
  (Sébastien a posé `localStorage.__backline_persist_logs = 'true'`)
  → catch en live au prochain épisode si récidive.
- **Surveillance 24-48h** : si aucune récidive observée, archiver
  la dette pollution myGuitars. Si récidive avec log forensique
  capturé (`window.__getMergeDebugLogs()` côté iPhone) → Phase
  7.74.5 ciblée selon le pattern observé.
- **Détection symétrique manquante** : le swap suspect catch
  "1 cg_* dropped → standard added". Mais le pattern inverse
  "1 standard dropped → cg_* added" n'est pas catché. Improbable
  en pratique (pollution = ajout de standards d'autres profils,
  pas ajout de customs d'un user inconnu). À ajouter si observé.
- **False-positive intentionnel non détecté** : si user remplace
  Tele 51 custom par sire_t3 standard légitimement, blocage. Le
  user devra splitter ses actions (add sire_t3 d'abord, ré-ouvrir
  l'app, remove Tele 51 après). Acceptable car cas extrêmement
  rare.

---

## État précédent (2026-05-19 fin de soirée, 30+ phases livrées — UX curation complète + JSON Maintenance + wrapper logger + fix sync aiCache)

**Backline v8.14.144 / SW backline-v244 / STATE_VERSION 10 / 1289 tests verts.**

### Session 2026-05-19 fin de soirée — 11 phases supplémentaires (suite Phase 7.74.x du matin)

Suite à la session du matin (7.74.x sync robustesse + régression
auto-repair contenue, cf section "État précédent"), 11 nouvelles
phases livrées en cascade fin de journée :

| Phase | Version | Sujet |
|---|---|---|
| 7.75 | 8.14.135 | Consolidation 4 tabs → 1 "Mes appareils" avec sections collapsables par device |
| 7.75.1 | 8.14.137 | Fix double-rendering banks tables dans Mes appareils (gated `!compact` + `restrictToDevice`) |
| 7.76 | 8.14.137 | Labels Sources nettoyés (studios par nom commercial, note "tous les packs ne sont pas encore intégrés") |
| 7.77 | 8.14.138 | Bouton "🔴 Résoudre les inconnus (N)" user — modale 5 actions (remap/manual/add/skip/clear) |
| 7.78 | 8.14.139 | Bouton "🟠 Curer les non-curés (N)" admin MVP — modale 2 sections (éditables custom/ToneNET + read-only catalog statique) |
| 7.78.1 | 8.14.140 | Réintègre Sauvegarde/Restauration JSON globale dans ⚙️ Admin → Maintenance (oubli Phase 7.73.1) |
| 7.74.5 | 8.14.141 | Wrapper console persistant pour surveillance pollution myGuitars (`localStorage.__backline_persist_logs`) |
| 7.79 | 8.14.142 | Pastille curation cliquable + modale info/édition usages (BankEditor + SongDetailCard) |
| 7.79.2 | 8.14.143 | Section "🎯 Usages curés" inline dans PresetDetailInline + bouton "💡 Reprendre morceaux mythiques de l'ampli" pour curation en 1 clic |
| **7.80.2** | **8.14.144** | **Fix critique sync aiCache Mac↔iPhone : merge per-songId dans mergeProfileLWW** |

### Phase 7.75 — Consolidation Mes appareils (v8.14.135)

**Avant** : 4 onglets séparés (Mes appareils toggle + 🎛 Pedale + 🎛
Anniversary + 🔌 Plug + 🎚️ TMP) = fouillis dans MonProfilScreen.

**Après** : un seul onglet "📱 Mes appareils" qui contient :
- Section 1 — Toggle des devices (déjà avant)
- Section 2 — Pour chaque device activé, une **section collapsable**
  avec BankEditor + CSV compact (ExportImportScreen `compact={true}`) +
  TMP Browser. Warning si Pedal + Anniversary tous deux activés
  (partagent `banksAnn`).

Net : passage de 11 onglets (7 pour non-admin) à 7 onglets.

### Phase 7.75.1 — Fix double-rendering banks tables (v8.14.137)

Bug rapporté par dump DOM : dans MesAppareilsTab consolidé Phase 7.75,
chaque section device affichait **2 tables read-only des banks**
(Anniversary + Plug) PLUS le BankEditor interactif. Cause :
`ExportImportScreen` rendait inconditionnellement un tableau read-only
lignes 564-583 (legacy code de l'écran standalone).

Fix : gating `!compact` + filtre `restrictToDevice` ('ann' ou 'plug')
pour cacher les tables read-only en mode compact MesAppareilsTab.

### Phase 7.76 — Labels Sources nettoyés (v8.14.137)

Sources renommées dans `core/sources.js` pour citer les studios par
leur nom commercial sans précision "64 packs / standalone" (mouvant) :

| Avant | Après |
|---|---|
| TSR — Pack 64 Studio Rats | The Studio Rats |
| ML — ML Sound Lab Essentials | ML Sound Lab |
| AA — Amalgam Audio (standalone) | Amalgam Audio |
| JS — Jason Sadites (standalone) | Jason Sadites |
| TJ — Tone Junkie TV (standalone) | Tone Junkie TV |
| WT — Worship Tutorials (standalone) | Worship Tutorials |
| Galtone — Galtone (standalone) | Galtone |

Descriptions partagent toutes la même note "(tous les packs ne sont
pas encore intégrés dans Backline)" pour clarifier la couverture
partielle. SOURCE_INFO révisé idem.

### Phase 7.77 — Résoudre les inconnus côté user (v8.14.138)

Bouton **"🔴 Résoudre (N)"** dans le header de chaque section device
de Mes appareils. N = count des presets unknown (status='unknown',
fallback `guessPresetInfo`) dans les banks du device.

Modale `ResolveUnknownsModal` réutilise la mécanique éprouvée Phase
7.69.x (import CSV unknowns) mais scopée sur les banks installées.
5 actions par preset :
- **Remapper** vers une fuzzy suggestion (`findCatalogSuggestions`)
- **Rechercher dans le catalog** (datalist autocomplete ~1028 noms)
- **Ajouter comme custom** (push dans `profile.customPacks["Mes presets"]`)
- **Laisser tel quel** (slot inchangé, preset reste 🔴)
- **Vider le slot** (action explicite)

Helper pur `detectUnknownsInBanks(banks)` + `applyResolutionsToBanks(banks, resolutions)`
dans `src/core/preset-curation.js`. 18 tests Vitest.

Bonus livré : **test régression Phase 7.77** `src/audit-factory-curation.test.js`
qui vérifie que **aucun preset factory (Pedal v2, Anniversary, Plug)
n'est en 🔴 unknown**. Cohérence catalog verrouillée (à la livraison
Phase 7.77 : Pedal v2 150 known + Anniversary 119 known + 31 curated-admin
Phase 7.52 + Plug 30 known).

### Phase 7.78 — Curer les non-curés côté admin MVP (v8.14.139)

Bouton **"🟠 Curer (N)"** admin only dans le header de chaque section
device. N = count des presets `status='known'` (catalog entry mais sans
`usages`) dans les banks du device.

Modale `CurateNonCuratedModal` avec 2 sections :
- **✏️ Éditables (custom + ToneNET)** : form usages `[{artist, songs?}]`
  par preset, datalist artist+song depuis songDb. Save → update
  `profile.customPacks` (custom) ou `shared.toneNetPresets` (ToneNET)
  + stamp lastModified pour LWW Firestore.
- **📦 Catalogs statiques (TSR/ML/AA/JS/TJ/WT/Galtone/Anniversary/Factory/...)** :
  read-only avec note "édite le source code (Phase 11 future :
  Studio-driven enrichment)".

Helper pur `detectAllNonCurated(banks)` qui retourne `{name, src, editable}`
+ `EDITABLE_SOURCES = new Set(['custom', 'ToneNET'])`. 6 tests Vitest.

### Phase 7.78.1 — Réintègre Sauvegarde JSON dans Maintenance (v8.14.140)

**Bug** : Phase 7.73.1 avait retiré le tab "📋 Export / Import" de Mon
Profil avec la promesse "JSON full state reste accessible via ⚙️
Admin → Maintenance" — mais jamais câblé. Conséquence : impossible
de faire une sauvegarde complète JSON depuis l'UI depuis Phase 7.73.1.

**Fix** : section "💾 Sauvegarde complète (JSON)" en tête de
MaintenanceTab avec 2 boutons :
- ⬇ Exporter JSON (full state : setlists + songDb + banks + profiles)
- 📂 Importer JSON (avec confirmation, REMPLACE tout le state local)

Câblé via props `fullState` + `onImportState` propagés
main.jsx → AdminScreen → MaintenanceTab.

### Phase 7.74.5 — Wrapper console persistant intégré (v8.14.141)

Helper `merge-debug-logger.js` installé au boot main.jsx. No-op si
`localStorage.__backline_persist_logs` absent. Si activé :
- Wrappe `console.warn` / `console.log` au boot (idempotent).
- Pour chaque msg contenant `[merge*` ou `SUSPECT`, persiste dans
  `localStorage.__backline_merge_logs` (max 50 entries, FIFO).
- Active aussi `window.__BACKLINE_MERGE_DEBUG = true`.
- Expose `window.__getMergeDebugLogs()` et `window.__clearMergeDebugLogs()`.

Activation user :
```js
localStorage.__backline_persist_logs = 'true';
// Puis reload. Plus besoin de re-coller le wrapper à chaque reload.
```

12 tests Vitest. Utilisé pour surveiller la pollution myGuitars
récurrente (3e occurrence observée 2026-05-19 — swap 1↔1 cg_*
non détecté par Couche 3 Phase 7.74).

### Phase 7.79 — Pastille cliquable + modale curation (v8.14.142)

Nouveau composant partagé `<CurationDot>` : pastille curation 6×6 px
cliquable avec tooltip enrichi.

Nouvelle modale `<PresetCurationModal>` unifiée (mode view/edit
inline) :
- Mode "view" : status (🔴/🟠/🔵) + amp/gain/style/scores/pack/usages
- Bouton "✏️ Modifier" admin only sur custom/ToneNET → toggle vers
  mode "edit" inline (form usages identique à 🟠 Curer)
- Save → update `profile.customPacks` ou `shared.toneNetPresets`
- Catalog statique : bouton désactivé + note Phase 11

Intégration : BankEditor (Mes appareils) + SongDetailCard (vue
dépliée setlist). Click pastille → modale.

### Phase 7.79.2 — Section usages inline dans PresetDetailInline (v8.14.143)

**Insight user 2026-05-19 soir** : *"pourquoi cliquer sur la modale
et ne pas intégrer un encart dans la vue du preset, d'autant plus
qu'il y a déjà des infos type morceaux mythiques qui pourraient
alimenter le curage"*.

`PresetDetailInline` (le drawer expandable rendu dans BankEditor +
Explorer + JamScreen) affichait déjà une section **"🎵 Morceaux
mythiques — registre [gain]"** (depuis Phase ancienne) qui filtre
les `refs` de l'ampli depuis `data_context.js` selon le gain du
preset. Format : `[{a: artiste, t: [titres]}]` = **exactement la
structure des `usages`** !

Sous-composant `<UsagesSection>` ajouté dans PresetDetailInline :
- Section "🎯 Usages curés (preset)" en lecture (read-only par défaut)
- Bouton "✏️ Modifier" admin only sur custom/ToneNET (toggle inline,
  pas de modale)
- Form usages avec datalist artist+song depuis songDb
- **Bouton "💡 Reprendre les morceaux mythiques de l'ampli (N artistes)"**
  qui pré-remplit le form en 1 clic depuis `ctx.refs` (data_context.js
  déjà filtrés par gain). Curation 10× plus rapide qu'à la main.
- Merge intelligent : si artist déjà présent dans le draft, fusion
  des songs sans doublon.

Helper centralisé `saveUsagesForPreset(name, usages, ctx)` dans
`core/preset-curation.js` qui route automatiquement selon `entry.src`
(custom → profile.customPacks, ToneNET → shared.toneNetPresets) avec
stamp lastModified profil/preset pour LWW Firestore. Réutilisé par
PresetCurationModal Phase 7.79 + BankEditor + PresetBrowser.

Surfaces livrées Phase 7.79.2 :
- **BankEditor** (Mes appareils, drawer slot) ✅ `onSaveUsages` câblé
- **PresetBrowser** (Explorer, fiche détail) ✅ `onSaveUsages` câblé
- **JamScreen** — `onSaveUsages` non propagé → mode lecture seule
  (acceptable, le user ne cure pas depuis Jam)

UX cohérente cross-écrans : la pastille curation cliquable Phase 7.79
ouvre la modale, MAIS quand le drawer est expand (click sur slot ou
sélection preset Explorer), tout est inline directement. Le user
peut curer sans modale superposée.

### Phase 7.80 (notée 2026-05-19) — Dettes critiques

1. **Phase 7.80.1 — Revue UX/UI responsive complète** (à investiguer)
   — audit systématique sur iPhone (PWA installée) + iPad portrait/
   paysage + Chrome DevTools responsive mode. Symptômes ponctuels
   observés : header tronqué iPhone, overflow inputs, modales scroll
   mobile. Effort ~6-10h audit + 10-15h fixes.

2. **Phase 7.80.2 — Fix sync aiCache Mac ↔ iPhone** ✅ **LIVRÉ 2026-05-19 soir (v8.14.144)**
   — Cause racine identifiée : `mergeProfileLWW` (state.js:805) faisait
   `merged = { ...remote }` adopt-en-bloc, qui écrasait `profile.aiCache`
   local avec un remote vide quand `remote.lastModified > local.lastModified`.
   Phase 7.74 Couche 2 avait ajouté un merge per-field pour myGuitars/
   language/customGuitars/customPacks mais avait oublié aiCache.
   Fix : merge per-songId avec sv (SCORING_VERSION) le plus élevé qui
   gagne (égalité → keep local). Union complète des analyses cross-device.
   8 tests Vitest ajoutés. Cf entrée détaillée en haut "Phase 7.80.2".

### Surveillance pollution myGuitars (3e occurrence 2026-05-19)

Pattern observé : swap 1↔1 `cg_*` entre Sébastien et un profil
beta-tester (Francisco). Tele 51 perdue + Sire T3 (Francisco's
guitare) gagnée. Phase 7.74 Couche 3 (defense drop ≥3) inopérante
sur ce pattern car drop = 1.

Wrapper console persistant Phase 7.74.5 activé sur Mac
(`localStorage.__backline_persist_logs = 'true'`). À activer aussi
sur iPhone via Safari Mac → Develop → iPhone.

Si re-occurrence avec log forensique → **Phase 7.74.4 ciblée**
(~1h dev) : étendre la défense au pattern "drop 1 `cg_*` + add 1
`cg_*` d'un autre profil" = swap suspect cross-profil.

### Phase 7.80.2 — Fix sync aiCache Mac ↔ iPhone (v8.14.144)

**Bug critique identifié 2026-05-19 soir** : analyses IA calculées
sur Mac ne descendaient pas sur iPhone et vice-versa. Sébastien
devait relancer le calcul sur chaque device. Très embêtant.

**Cause racine** (`src/core/state.js:805` `mergeProfileLWW`) :
```js
if (rts <= lts) return local;
const merged = { ...remote };  // ← adopt en bloc !
```

Quand `remote.lastModified > local.lastModified`, le merge adoptait
**TOUT l'objet remote**, incluant `aiCache`. Puis override per-field
uniquement pour `myGuitars` / `language` / `customGuitars` /
`customPacks` (Phase 7.74 Couche 2). `aiCache` était oublié →
adopté en bloc → écrasement possible.

**Scénario qui cassait** :
1. Mac : analyse IA → `setSongAiCache` stamp `profile.lastModified=T1`
2. Mac push à Firestore avec `aiCache` plein
3. iPhone : toggle un truc → re-stamp `lastModified=T2 > T1` → push
   avec `aiCache` vide localement
4. Mac pull → `rts > lts` → `merged.aiCache = {}` (vide) ← **PERTE**

**Fix Phase 7.80.2** : merge per-songId pour `aiCache`. Pour chaque
song présent dans local OU remote, garde la version avec le `sv`
(SCORING_VERSION) le plus élevé. Égalité ou local-only → keep
local. Remote-only → adopt remote. **Union complète des analyses
cross-device.**

8 tests Vitest dans `state.test.js` :
- Scénario bug Mac↔iPhone reproduit
- Local vide + remote plein → adopt remote
- Conflit sv → sv le plus élevé gagne
- Égalité sv → keep local
- Union per-songId (Mac analyse A + iPhone analyse B → 2 conservées)
- Remote plus ancien → return local entier (rien à merger)
- aiCache absent → mergedAi = {}
- aiCache null défensif

**Pas de bump STATE_VERSION** (correction logique pure).

### Récap fin de session 2026-05-19 fin de journée

| Métrique | Valeur |
|---|---|
| Phases livrées (session matinée + soirée) | 30+ phases dont 12 nouvelles soir |
| Tests Vitest | 1289/1289 verts |
| Versions déployées | v8.14.133 → v8.14.144 (12 releases) |
| Dettes notées | Phase 7.80.1 (responsive) ⏳ / 7.80.2 ✅ livré |
| Couverture catalog factory | 0% unknown sur Pedal v2 + Anniversary + Plug ✅ |
| Surveillance pollution active | Mac ✅ / iPhone à activer |
| **Bug bloquant fixé soir** | **Sync analyses IA Mac↔iPhone** ✅ |

---

## État précédent (2026-05-19 matinée, session 20 phases livrées — UX refonte + sync robustesse + régression auto-repair contenue)

**Backline v8.14.133 / SW backline-v233 / STATE_VERSION 10 / 1242 tests verts.**

### Phase 7.74.x récap final

| Sous-phase | Sujet | Version | Status |
|---|---|---|---|
| 7.74 | 4 couches sync robustesse (stamp + per-field LWW + defense drops ≥3 + dedup setlists) | 8.14.129 | ✅ Stable |
| 7.74.1 | Filter orphan-cross-profile myGuitars | 8.14.131 | ✅ Stable |
| 7.74.2 | Auto-repair orphans myGuitars (helper repairProfileGuitarsOrphans) | 8.14.132 | ⚠️ Désactivée (régression) |
| 7.74.2-revert | Désactivation auto-repair, opt-in via `window.__BACKLINE_AUTO_REPAIR_GUITARS = true` | 8.14.133 | ✅ Stable |

### Phase 7.74.2 régression (2026-05-19)

**Symptôme** : helper auto-repair a droppé les guitares custom d'AUTRES
profils (Francisco perdu 5, Bruno 6, Arthur 2, Emmanuel 3) sur Sébastien
Mac admin au boot v8.14.132.

**Cause racine** : les guitares custom des autres profils sont stockées
per-profile sur leur device d'origine. Leur metadata n'apparaît PAS
dans `shared.customGuitars` NI dans `profile.customGuitars` côté
Sébastien Mac. Phase 7.59.1 avait correctement skippé les `cg_*`
comme "soft orphans légitimes" — Phase 7.74.2 était trop strict en
les considérant comme orphans à drop.

**Limite intrinsèque structurelle** : sur un device admin (Sébastien
Mac), on ne PEUT PAS distinguer un vrai orphelin historique (Tele 51
ghost `cg_1778885069427`) d'un soft orphan légitime (guitare custom
d'un autre profil dont la metadata vit sur le device d'origine). Donc
auto-repair est structurellement risqué.

**Fix v8.14.133** : helper gardé pour tests, useEffect d'invocation
gated derrière flag opt-in `window.__BACKLINE_AUTO_REPAIR_GUITARS = true`.
En default, **NO auto-repair**. Le user qui veut nettoyer un orphan
spécifique doit le faire manuellement via snippet console.

**Récupération** : user a remis les guitares perdues via UI (switch
profil + Mon Profil → Guitares → toggle). Propagé via sync Mac → iPhone.

### Récap session 2026-05-19 (20 phases en cascade, 5 axes UX + robustesse)

#### Axe 1 — Refonte modèle presets custom + import CSV (Phase 7.69.x)

| Sous-phase | Sujet | Version |
|---|---|---|
| 7.69 | Refonte UX presets custom : src="custom" toujours, creator séparé, liste plate MyCustomPresetsTab, modale CSV unknowns interactive, vue admin AllUserPresetsTab | 8.14.112 |
| 7.69.1 | Fix parseCSV double-quoted (Excel re-export bug) | 8.14.113 |
| 7.69.2 | Fix detectUnknownPresets : tester `entry.guessed` au lieu de truthy | 8.14.114 |
| 7.69.3 | normalizePresetName : abréviations gain (cln/clr → clean, drv → drive) | 8.14.115 |
| 7.69.4 | Rename gen_catalog .js → .cjs + fix Drive path | — |
| 7.69.5 | findCatalogSuggestions : fuzzy match token-set + alias + strip prefix pack | 8.14.116 |
| 7.69.6 | 4e option modale CSV "Saisir…" avec datalist autocomplete + validation ✅/❌ | 8.14.117 |
| 7.69.7 | Tab admin Packs : import via listing texte (`unzip -l`), `shared.adminPacks` syncé | 8.14.118 |
| 7.69.8 | Fix amp inference (Marshall JCM800 strippé) + label pack admin via getSourceInfo | 8.14.119 |
| 7.69.9 | Enrichissement IA admin packs (raccord Explorer ampContext) | 8.14.120 |
| 7.69.10 | Wording option modale CSV : "Saisir…" → "Rechercher dans le catalog" | 8.14.121 |
| 7.69.11 | Dédup datalist catalog autocomplete (1355 → 1028 entries) | 8.14.122 |
| 7.69.12 | Modale CSV en 2 sections (À remapper / À ajouter) | 8.14.123 |
| 7.69.13 | Scores compatibilité qualitatifs (4 niveaux + auto-recalc depuis style) | 8.14.124 |

#### Axe 2 — UX setlists (Phase 7.71)

`ListScreen` : checkboxes + bouton "Cocher" + bouton "Retirer non-cochés"
+ bouton "Générer le récap" SUPPRIMÉS. Remplacé par mode édition
"✏️ Éditer la setlist / ✅ Terminer" qui révèle la corbeille 🗑 par
morceau. v8.14.125

#### Axe 3 — Mode admin séparé (Phase 7.72)

Mon Profil ~18 onglets admin → 11 onglets + nouvelle route `⚙️ Admin`
séparée avec 6 sous-onglets (Profils, Tous presets, Packs admin,
ToneNET, Maintenance, Clé API). NAV_ITEMS étendu `adminOnly: true`.
v8.14.126

#### Axe 4 — Mon compte + CSV device tabs (Phase 7.73.x)

- **7.73.0** : Tally feedback button (`https://tally.so/r/xXR1G5`)
  dans MonProfilScreen footer, pré-rempli `profile_name` + `app_version`.
  v8.14.127
- **7.73.1** : Import/Export CSV intégré directement dans tabs device
  (`pedale` / `ann` / `plug`) via `DeviceCSVPanel`. Tab "📋 Export /
  Import" retiré de Mon Profil. v8.14.128
- **7.73.2** : Mon compte Full scope (proposée roadmap, ~5-6h).

#### Axe 5 — Robustesse sync (Phase 7.74.x)

- **7.74** : 4 couches (stamp + per-field LWW + defense drops ≥3 +
  dedup setlists auto). v8.14.129
- **7.74.1** : Filter orphan-cross-profile myGuitars. v8.14.131
- **7.74.2** : Auto-repair orphans (régression observée + désactivée
  v8.14.133, opt-in only).

#### Axe 6 — Code couleur curation preset (Phase 7.70 + 7.70.1)

`BankEditor.jsx` + `SongDetailCard.jsx` vue dépliée : pastille 6×6px
+ tooltip selon taxonomie 5 catégories (Inconnu rouge / Connu jaune /
Curé perso bleu clair / Curé admin bleu moyen / Curé studio Phase 11
bleu foncé). v8.14.130

#### Roadmap proposée (à activer)

- **Phase 7.73.2** : onglet "👤 Mon compte" Full scope (5-6h)
- **Phase 7.75** : consolidation banks dans Mes appareils (paused
  à cause Phase 7.74.x debug — ~3-4h)
- **Phase 12** : séparer catalog GLOBAL vs possession USER

---

## État précédent (2026-05-19 après-midi, Phase 7.74 livrée — fix sync robustesse)

**Backline v8.14.129 / SW backline-v229 / STATE_VERSION 10 / 1220 tests verts.**

### Phase 7.74 — Fix cause racine pollution profile cross-mélange (v8.14.129)

Bug observé en prod plusieurs fois sur 7 jours (incident 2026-05-18) :
myGuitars perdait des entries Sébastien + gagnait des entries
Francisco (sire_t7/t3), language reset, banksAnn corrompu, setlists
dupliquées. Les protections défensives Phase 7.59 (snapshots manuels
+ sanity check au boot) ne détectaient pas le bug — il se manifeste
PENDANT l'usage, pas au load.

**Audit H1 (4 sites coupables identifiés)** : call sites onProfiles/
setProfiles qui oubliaient `lastModified: Date.now()`. Conséquence :
le merge LWW perd l'update si un autre device push entretemps avec
stamp récent.

| Site | Action | Criticité |
|---|---|---|
| `ProfilesAdmin.jsx:47` | Change password admin | 🔴 |
| `ProfilesAdmin.jsx:55` | Rename profile admin | 🟠 |
| `ProfileTab.jsx:52` | Delete custom guitar de tous profils | 🔴 |
| `MesAppareilsTab.jsx:25-31` | Toggle device → enabledDevices | 🔴 (cause probable banks corrompues) |

**Fix en 4 couches** (toutes livrées) :

#### Couche 1 — Helper `stampedProfileUpdate` + fix stamps manquants

Helper pur dans `core/state.js` qui force `lastModified: Date.now()`
sur le profil cible. Signature : `stampedProfileUpdate(profiles,
profileId, partial)` où `partial` est objet ou fonction `(cur) =>
partial`. Idempotent, immutable, null-safe.

Les 4 sites coupables refactorisés pour utiliser le helper (sauf
ProfileTab.jsx:52 qui est un cas multi-profil — boucle inline avec
stamp ciblé : ne stamp QUE les profils qui avaient effectivement
la guitare à drop, évite la saturation Firestore + conflicts LWW).

#### Couche 2 — `mergeProfileLWW` (singulier) per-field

Refacto `mergeProfilesLWW` (pluriel) : au lieu d'adopt-en-bloc du
profil remote, délègue à `mergeProfileLWW` (singulier) qui merge
per-field :

- **myGuitars** : adopt remote (avec garde-fou Couche 3)
- **language** : adopt remote (avec garde-fou Couche 3)
- **customGuitars** : union par id, remote overwrite sur conflit
- **customPacks** : union par name, remote overwrite
- **banksAnn, banksPlug, enabledDevices, availableSources,
  aiProvider, recoMode, guitarBias, tmpPatches, loginHistory,
  editedGuitars** : adopt remote en bloc (champs atomiques)

#### Couche 3 — Defense block adoption suspecte + logs forensique

Garde-fous dans `mergeProfileLWW` :

- **Drop myGuitars suspect** : si remote drop ≥3 guitares (ou >50%
  du local) → keep local. Cas Sébastien Mac : 5 guitares locales vs
  remote `['sire_t7', 'sire_t3']` (pollution Francisco) → drop 5
  guitares détecté → keep local préservé.
- **Language conflict short delta** : si remote.language ≠
  local.language ET delta stamp <5s → keep local. Anti-cycle (user
  ne change pas sa langue 2× en 5s).

Logs forensique via `window.__BACKLINE_MERGE_DEBUG = true` :
```
[merge-defense] sebastien SUSPECT myGuitars drop : remote drops 5 guitares (lp60,sg61,es335,strat61,tele63) — keeping local
```

#### Couche 4 — Dedup setlists aggressif automatique au merge

`mergeSetlistsLWW` applique désormais `dedupSetlists(out,
{mergeAcrossProfiles: true})` AUTOMATIQUEMENT après le LWW per-id.
Cas Sébastien observé : "Cours Franck B" avec id sl1 et profileIds
['sebastien'] côté local + même name avec id sl2 et profileIds
['sebastien', 'franck'] côté remote → fusion auto en une setlist
unique avec profileIds union + songIds union, songs préservés.

Stamp `lastModified` automatique sur les setlists qui ont absorbé
une autre (songIds.length ou profileIds.length augmenté) → propage
le clean via sync.

Plus besoin de bouton manuel "Fusionner setlists doublons" dans
MaintenanceTab (Phase 5.4) — fait au merge.

### Tests Phase 7.74 (+18 nouveaux Vitest)

- `stampedProfileUpdate` × 5 : stamp forcé, partial fonction, no-op
  si profileId inexistant, no-op si partial null, immutabilité.
- `mergeProfileLWW` × 10 : remote ancien → keep local, remote récent
  pas suspect → adopt, scénario bug Sébastien (drop 5 guitares →
  keep local), drop modéré → adopt, language short delta → keep
  local, language long delta → adopt, customGuitars union, customPacks
  union, local null, remote null.
- `mergeSetlistsLWW` Couche 4 × 3 : doublons name+profileIds divergents
  → fusion auto, pas de doublon → unchanged, stamp lastModified sur
  fusion.

1220/1220 verts (1202 + 18).

### Architecture livrée Phase 7.74

```
src/main.jsx                            APP_VERSION 8.14.128 → 8.14.129
public/sw.js                            CACHE backline-v228 → backline-v229
src/core/state.js                       +stampedProfileUpdate helper
                                        +mergeProfileLWW (singulier)
                                        mergeProfilesLWW (pluriel) délègue
                                        mergeSetlistsLWW : dedup aggressif
                                        intégré au retour
src/core/state.test.js                  +18 tests Phase 7.74
docs/SYNC.md                            +section Phase 7.74 invariants
                                        + entry historique régressions
src/app/screens/ProfilesAdmin.jsx       Fix stamps password + rename
src/app/screens/ProfileTab.jsx          Fix stamp delete custom guitar
                                        (multi-profil, ciblé sur ceux
                                        qui avaient la guitare)
src/app/screens/MesAppareilsTab.jsx     Fix stamp toggle device
                                        (suspect H1 critique)
```

### Conséquences Phase 7.74

- **1220/1220 tests verts** (+18 nouveaux).
- **Pas de bump STATE_VERSION** (changements purement merge-side,
  schéma identique).
- **Pas de migration localStorage**.
- **Bundle** ~2428 KB (peu de delta).
- **Cohabitation pré-7.74 / post-7.74** : un device pré-7.74 qui
  push sans stamp peut encore polluer. Mais l'autre device post-7.74
  qui pull bénéficie des garde-fous Couche 3 (drop suspect détecté
  → keep local). Donc effet bénéfique unilatéral dès le premier
  device upgradé.

### Dette résiduelle Phase 7.74

- **Instrumentation forensique laissée active** : `window.__BACKLINE_
  MERGE_DEBUG = true` permet de catch en live un cas de pollution
  active. À garder 1-2 semaines en observation puis évaluer si on
  laisse en permanence.
- **`stampedProfileUpdate` non câblé sur main.jsx existant** : les
  call sites main.jsx (setProfileField, setSongAiCache, etc.) sont
  déjà OK (stampent inline). Pas urgent de migrer vers le helper.
- **Test de garde structurelle** (audit grep automatisé qui détecte
  un futur `setProfiles` introduit sans stamp) : non implémenté
  Phase 7.74. À ajouter si nouvelle régression observée.
- **Phase 7.74 ne touche PAS `mergeSongDbPreservingLocalAiCache`** :
  le merge songDb a sa propre logique Phase 5.7.1. Pas inclus dans
  le scope.

---

## État précédent (2026-05-19 après-midi, session 16+ phases — UX refonte profil/admin)

**Backline v8.14.128 / SW backline-v228 / STATE_VERSION 10 / 1202 tests verts.**

### Récap session 2026-05-19 (16+ phases en cascade, 4 axes UX)

#### Axe 1 — Refonte modèle presets custom + import CSV (Phase 7.69.x)

| Sous-phase | Sujet | Version |
|---|---|---|
| 7.69 | Refonte UX presets custom : src="custom" toujours, creator séparé, liste plate MyCustomPresetsTab, modale CSV unknowns interactive, vue admin AllUserPresetsTab | 8.14.112 |
| 7.69.1 | Fix parseCSV double-quoted (Excel re-export bug) | 8.14.113 |
| 7.69.2 | Fix detectUnknownPresets : tester `entry.guessed` au lieu de truthy | 8.14.114 |
| 7.69.3 | normalizePresetName : abréviations gain (cln/clr → clean, drv → drive) | 8.14.115 |
| 7.69.4 | Rename gen_catalog .js → .cjs + fix Drive path | — |
| 7.69.5 | findCatalogSuggestions : fuzzy match token-set + alias + strip prefix pack | 8.14.116 |
| 7.69.6 | 4e option modale CSV "Saisir…" avec datalist autocomplete + validation ✅/❌ | 8.14.117 |
| 7.69.7 | Tab admin Packs : import via listing texte (`unzip -l`), `shared.adminPacks` syncé, AdminPacksTab | 8.14.118 |
| 7.69.8 | Fix amp inference (Marshall JCM800 strippé) + label pack admin via getSourceInfo | 8.14.119 |
| 7.69.9 | Enrichissement IA admin packs (raccord Explorer ampContext) | 8.14.120 |
| 7.69.10 | Wording option modale CSV : "Saisir…" → "Rechercher dans le catalog" | 8.14.121 |
| 7.69.11 | Dédup datalist catalog autocomplete (1355 → 1028 entries) | 8.14.122 |
| 7.69.12 | Modale CSV en 2 sections (À remapper / À ajouter) | 8.14.123 |
| 7.69.13 | Scores compatibilité qualitatifs (4 niveaux + auto-recalc depuis style) | 8.14.124 |

#### Axe 2 — UX setlists (Phase 7.71)

`ListScreen` :
- Supprimées : checkboxes par morceau, bouton "Cocher / Décocher", bouton
  "Retirer non-cochés", bouton "Générer le récap"
- Ajouté : bouton **"✏️ Éditer la setlist / ✅ Terminer"** qui révèle
  la corbeille 🗑 par morceau en mode édition
- État après : row morceau visuellement nettoyé (2 colonnes maxi),
  arrondi sur les 4 coins hors édition, undo toast Phase 5.4 préservé
- v8.14.125

#### Axe 3 — Mode admin séparé (Phase 7.72)

Avant : ~18 onglets dans une rangée scrollable pour l'admin.

Après :
- **🙂 Mon Profil** (commun à tous, ~10 onglets) : Guitares / Devices /
  Sources / Mes presets custom / Banks (par device enabled) / Affichage /
  Préférences IA / Mot de passe / [CSV intégré dans device tabs Phase 7.73.1]
- **⚙️ Admin** (nouvelle route gated `isAdmin`) : Profils / Tous presets
  users / Packs admin / ToneNET / Maintenance / Clé API partagée

Nouveau composant `AdminScreen.jsx`. Entrée NAV_ITEMS "⚙️ Admin" dans
AppHeader + AppNavBottom (réutilise mécanisme `adminOnly: true` Phase
7.29.3). Route `screen === 'admin'` gated `isAdmin` (URL hack defense).

v8.14.126

#### Axe 4 — Plan A Mon compte (Phase 7.73.0/.1, suite Phase 7.73.2 à venir)

**Phase 7.73.0** — Tally feedback (v8.14.127) :
- URL `https://tally.so/r/xXR1G5` stockée dans `core/branding.js`
- Helper `buildFeedbackUrl(profileName, appVersion)` qui pré-remplit
  les champs cachés Tally via URL params
- Bouton **"💬 Envoyer un feedback"** dans le footer MonProfilScreen
  (target=_blank, ouvre Tally avec `profile_name` + `app_version`
  pré-remplis)
- `window.__BACKLINE_APP_VERSION` exposé depuis main.jsx

**Phase 7.73.1** — CSV dans device tabs + retrait tab Export/Import
(v8.14.128) :
- Prop `restrictToDevice: 'ann'|'plug'` ajoutée à `ExportImportScreen`
  qui filtre les boutons export + le parsing CSV import + le scan
  presets inconnus
- Wrapper `DeviceCSVPanel` rendu en haut de chaque tab device
  (pedale/ann/plug) — accès CSV au plus proche du contexte
- Tab "📋 Export / Import" retiré de MonProfilScreen — JSON full
  state admin reste accessible via ⚙️ Admin → Maintenance
- Factory helper `makeOnAddCustomPresets(onProfiles, activeProfileId)`
  centralisé pour partager le callback Phase 7.69 entre 3 instances

#### Roadmap proposée même session (à activer)

- **Phase 7.70** : code couleur curation preset dans BankEditor (4
  catégories : inconnu/connu/curated admin/curated perso, 5e studio
  pour Phase 11)
- **Phase 7.73.2** : onglet "👤 Mon compte" complet (Full scope
  validé) — voir Idées en attente
- **Phase 12** : séparer catalog GLOBAL vs possession USER (granularité
  par pack individuel, `profile.ownedPacks`)

---

## État précédent (2026-05-19 matin, Phase 7.69 close — Refonte modèle filtrage presets + import CSV interactif + vue admin)

**Backline v8.14.112 / SW backline-v212 / STATE_VERSION 10 / 1163 tests verts.**

### Phase 7.69 — Refonte UX presets custom (v8.14.112)

Retour utilisateur 2026-05-19 sur Phase 7.67 : *"Pour moi ce n'est pas
clair et user friendly. Déjà il faut uniformiser les termes 'Mes
presets personnels' dans 'Sources' et onglet 'Mes presets custom'.
Pour moi, si on ajoute un preset custom (même si la source est AA,
TSR...), c'est un preset custom. Le fait même de cocher 'Mes presets
custom' dans source doit suffire à le prendre en compte dans le
scoring. Activer AA, TSR ou autres dans les sources revient à
activer des catalogues de presets curated (par moi ou par les
studios) mais ne doivent pas être liés au presets persos. Pour les
CSV, de mon point de vue, il faut expressément demander à
l'utilisateur, lors de l'import, lorsqu'un preset n'est pas
référencé en base : soit de l'ajouter comme custom preset, soit de
considérer la banque vide s'il ne veut pas renseigner le preset
custom. Je pense que dans la notion de 'pack' dans l'onglet Mes
presets custom est compliqué. Je listerais simplement dans une
liste unique, tous les presets saisis par l'utilisateur. Ce que je
veux en tant qu'admin c'est pouvoir avoir une vue sur tous les
presets saisis par les users et éventuellement les modifier."*

**4 sous-phases livrées en cascade** :

#### Sous-phase 1 — Modèle filtrage simplifié

Architecture corrigée : **un preset saisi par l'utilisateur est
TOUJOURS `src: "custom"` immuable**, peu importe sa provenance
réelle (TSR, AA, JS, ToneNET, etc.). Le champ `src` ne sert qu'au
filtrage `availableSources`. Un nouveau champ **`creator`** (séparé)
porte l'information de provenance pour l'affichage et l'éventuel
auto-tagging IA.

- Toggle "📦 Sources → Mes presets custom" = filtre unique pour
  TOUS les presets persos.
- Toggles "📦 Sources → AA / TSR / ML / JS / TJ / WT / Galtone /
  ToneNET" = filtres pour les **catalogues curated** (Anniversary
  Premium Phase 7.52, factory packs, etc.), pas pour les saisies user.

**`src/main.jsx`** useMemo customPacks (Phase 7.30) modifié :
- `src: "custom"` forcé toujours (jamais p.src).
- Nouveau champ `creator: p.creator || (p.src && p.src !== "custom" ? p.src : "")`.
- Migration silencieuse : un legacy preset avec `src: "AA"` (Phase 7.67)
  voit son `src` forcé à `"custom"` mais sa valeur initiale préservée
  dans `creator: "AA"`.

**`src/core/sources.js`** :
- `SOURCE_LABELS.custom` : "Mes presets personnels" → "Mes presets custom"
  (uniformisation avec le tab).
- `SOURCE_DESCRIPTIONS.custom` clarifiée : "Tous les presets que tu
  as documentés via le tab '📦 Mes presets custom' (peu importe leur
  provenance déclarée : TSR, AA, JS, ToneNET, etc.)."

#### Sous-phase 2 — MyCustomPresetsTab : liste plate sans notion de pack

Remplace `MyCustomPacksTab.jsx` (Phase 7.67) par
**`MyCustomPresetsTab.jsx`** (refonte complète) :
- **Liste plate** unique de tous les presets, triée alpha par nom.
  La notion de "pack" est invisible côté UI.
- Stockage interne : tous les nouveaux presets vont dans un pack
  technique `"Mes presets"` créé à la volée. Les packs legacy
  (Phase 7.67) restent visibles aplatis.
- Helper exporté `flattenPresets(customPacks)` : concatène +
  préserve `packIdx`/`presetIdx`/`packName` pour retrouver l'origine
  à l'édition/suppression.
- Dropdown **"Provenance (informatif)"** avec 11 choix fermés :
  vide / TSR / ML / AA / JS / TJ / WT / Galtone / ToneNET /
  Maison / Autre. Le user peut overrider.
- Helper exporté **`inferCreator(name)`** : regex sur le nom du
  preset pour auto-pré-remplir le creator. Différence vs
  `inferSource` Phase 7.67 : **pas de fallback Factory** ni `custom`
  (les patterns CL/DR/HG sont Factory ToneX, pas des saisies user
  → champ laissé vide pour que le user choisisse explicitement
  "Maison" ou "Autre").
- Constante exportée `DEFAULT_PACK_NAME = 'Mes presets'`.

#### Sous-phase 3 — Import CSV avec modale interactive presets inconnus

`src/app/screens/ExportImportScreen.jsx` étendu :
- Nouvelle fonction `detectUnknownPresets(importData)` : scanne les
  banks Anniversary + Plug du CSV importé, identifie tous les noms
  absents de `PRESET_CATALOG_MERGED`.
- Si ≥1 inconnu détecté → **modale obligatoire** avant overwrite
  des banks :
  - Liste tous les presets inconnus avec creator inféré.
  - Pour chaque preset, dropdown user : **"Ajouter comme custom"**
    (avec creator pré-suggéré) ou **"Laisser le slot vide"**.
  - Boutons de batch "Tout ajouter" / "Tout laisser vide" pour
    accélérer.
  - Validation → les "add" sont poussés via callback
    `onAddCustomPresets` dans le pack "Mes presets" du profil
    actif (créé à la volée). Les "skip" voient leur nom remplacé
    par "" dans `importData` (banques vides à ces slots).
- `MonProfilScreen` câble le callback :
  ```js
  onAddCustomPresets={(presets) => {
    onProfiles((p) => {
      const cur = p[activeProfileId];
      const packs = (cur.customPacks || []).slice();
      const defaultIdx = packs.findIndex((pk) => pk.name === 'Mes presets');
      if (defaultIdx >= 0) {
        // Merge dans le pack existant, dédup par nom
        const existing = packs[defaultIdx];
        const existingNames = new Set((existing.presets || []).map((pr) => pr.name));
        const newOnes = presets.filter((pr) => !existingNames.has(pr.name));
        packs[defaultIdx] = { ...existing, presets: [...(existing.presets || []), ...newOnes] };
      } else {
        packs.push({ name: 'Mes presets', presets: presets.slice() });
      }
      return { ...p, [activeProfileId]: { ...cur, customPacks: packs, lastModified: Date.now() } };
    });
  }}
  ```
- Aperçu détaillé des 5 premières banks rendu **après** résolution
  de la modale (`{importData && !unknownPresets && ...}`).

Effet pour Bruno (cas concret 2026-05-18) : à l'import de son CSV
contenant 34 presets non référencés (TSR custom captures), au lieu
du Phase 7.67 silencieux (banks remplies mais aucun preset en
catalog → recos ratées), il voit une modale explicite et choisit
en quelques clics quels presets ajouter comme custom.

#### Sous-phase 4 — Vue admin "👁 Tous les presets users"

Nouveau composant **`AllUserPresetsTab.jsx`** (admin only) :
- Tab `alluserpresets` dans MonProfilScreen, gated `profile.isAdmin`.
- Vue agrégée par profil : nom + badge ADMIN si applicable + count
  presets/packs.
- Tri par nombre de presets décroissant (visibilité top contributeurs
  beta-testeurs).
- Click sur un profil → réutilise `MyCustomPresetsTab` avec
  `activeProfileId={editingProfileId}` (override la cible des
  writes). L'admin peut donc éditer/supprimer un preset d'un autre
  profil sans switch de session (utile pour modération / correction
  d'usages mal saisis).
- Banner "Mode admin : les modifications s'appliquent au profil
  cible et seront synchronisées via Firestore" pour transparence.
- Bouton "← Retour à la liste" pour revenir à la vue agrégée.

### Architecture livrée Phase 7.69

```
src/main.jsx                                     APP_VERSION 8.14.111 → 8.14.112
                                                 useMemo customPacks : src=custom toujours,
                                                                       creator séparé
public/sw.js                                     CACHE backline-v211 → backline-v212
src/core/sources.js                              SOURCE_LABELS.custom uniformisé
                                                 SOURCE_DESCRIPTIONS.custom clarifiée
src/app/screens/MyCustomPresetsTab.jsx           NOUVEAU — liste plate, dropdown creator
                                                 informatif, src=custom forcé
src/app/screens/MyCustomPresetsTab.test.js       NOUVEAU — 22 tests (inferCreator,
                                                 CREATOR_OPTIONS×11, flattenPresets,
                                                 DEFAULT_PACK_NAME)
src/app/screens/MyCustomPacksTab.jsx             SUPPRIMÉ (Phase 7.67 obsolète)
src/app/screens/MyCustomPacksTab.test.js         SUPPRIMÉ (Phase 7.67 obsolète)
src/app/screens/AllUserPresetsTab.jsx            NOUVEAU — vue admin agrégée + édition
                                                 cross-profil via MyCustomPresetsTab override
src/app/screens/ExportImportScreen.jsx           +detectUnknownPresets, state
                                                 unknownPresets/unknownChoices, modale,
                                                 finalizeUnknownChoices, prop onAddCustomPresets
src/app/screens/MonProfilScreen.jsx              import AllUserPresetsTab + MyCustomPresetsTab
                                                 (au lieu de MyCustomPacksTab)
                                                 +tabBtn 'alluserpresets' gated isAdmin
                                                 +callback onAddCustomPresets vers
                                                  profile.customPacks "Mes presets"
```

### Conséquences Phase 7.69

- **1163/1163 tests verts** (Phase 7.67 → 7.69 : 22 tests
  `MyCustomPacksTab.test.js` supprimés + 22 tests
  `MyCustomPresetsTab.test.js` ajoutés = net 0).
- Pas de bump STATE_VERSION (additif sur `customPacks[].presets[i].creator`,
  rétro-compat via fallback `p.src !== 'custom'` au render).
- Pas de migration explicite : la migration est faite **à la volée**
  au render via le useMemo customPacks (legacy `src: "AA"` →
  `creator: "AA"` + `src: "custom"` forcé). Le legacy reste dans
  localStorage tant que le user n'a pas re-sauvegardé le preset ;
  acceptable car cohabitation safe.
- **Bundle** 2392.68 → 2400.08 KB (+7.4 KB pour AllUserPresetsTab +
  modale CSV + helpers).
- **Effet immédiat** :
  - Bruno cocher uniquement "Mes presets custom" dans Sources →
    ses 34 captures TSR sont prises en compte (au lieu d'avoir à
    cocher AA/TSR/etc. en plus).
  - À l'import CSV, modale interactive transparente : il choisit
    explicitement quels presets ajouter ou laisser vide.
  - Sébastien admin a une vue d'ensemble sur tous les presets
    saisis par tous les profils, et peut intervenir si besoin.

### Dette résiduelle Phase 7.69

- **Trilingue EN/ES** : ~15 nouvelles clés `mycustompresets.*` et
  `alluserpresets.*` + `import.unknown-*` avec fallbacks FR inline.
  Traductions à ajouter Phase 7.70 (~30 min).
- **Pas de migration purge legacy** : un preset legacy
  `src: "AA"` reste tel quel dans localStorage / Firestore tant que
  le user ne l'édite pas. Le render le traite via fallback. Si on
  veut nettoyer définitivement, ajouter un `migrateProfilePresetsToCustom`
  one-shot. Pas urgent.
- **Pas de bouton "exporter ma collection custom presets"** côté
  utilisateur (pour partager facilement entre devices ou avec
  Sébastien). Reporter si demandé.
- **Vue admin lecture-seule** sur banks/usages d'autres profils :
  Phase 7.69 permet l'édition presets uniquement. Si admin veut
  voir/modifier banks/setlists/profil complet d'un autre user,
  garder le mécanisme switchProfile Phase 7.63 (banner +
  loginHistory) existant.

---

## État précédent (2026-05-18, 10 phases livrées — Phase 7.67 close)

**Backline v8.14.111 / SW backline-v211 / STATE_VERSION 10 / 1163 tests verts.**

### Phase 7.67 — Édition rig par non-admin (autonomie beta-testeurs) (v8.14.111)

Suite à la session 2026-05-18 où Sébastien a dû faire 2 fix manuels via JS console DevTools pour Bruno (alignement banks + enrichissement 34 customs avec usages), workflow non-scalable. Phase 7.67 donne aux beta-testeurs non-admin l'autonomie pour configurer leur rig sans solliciter l'admin.

**3 changements parallèles livrés** :

1. **Custom guitars par non-admin** (`ProfileTab.jsx`) :
   - Retrait des gates `isAdmin` autour de `GuitarSearchAdd` (formulaire ajout via IA Gemini)
   - Retrait des gates `isAdmin` autour des boutons ✏️ (edit) et ✕ (delete) sur les custom guitars
   - Le user édite uniquement SES propres `profile.customGuitars` (per-profile, pas cross-profil)
   - Effet : Bruno peut désormais ajouter sa Schecter / Sire / Ibanez Gio directement via la recherche IA Gemini

2. **Nouveau tab "📦 Mes presets custom"** (`MyCustomPacksTab.jsx`, NOUVEAU) :
   - Accessible à TOUS les profils (admin et non-admin, gated `!isDemo`)
   - Édite directement `profile.customPacks` du profil actif (per-profile)
   - CRUD complet : liste des packs expandables, formulaire ajout/édition preset, suppression avec confirm
   - Form fields : nom + source (dropdown SOURCE_IDS étendu) + ampli (datalist knownAmps) + gain/style/channel + scores HB/SC/P90 + usages éditables avec autocomplete songDb + pack (existant ou nouveau)
   - Auto-suggest source via `inferSource` (regex sur nom) + amp/gain/style via `inferPresetInfo` (Phase 7.19)
   - Persiste avec stamp `lastModified` pour LWW Firestore

3. **Export/Import CSV au non-admin avec preview enrichie** (`ExportImportScreen.jsx`) :
   - Retrait du gate `isAdmin` sur le tab "📋 Export / Import"
   - Section JSON full state gated `isAdmin` (contient tous les profils)
   - Aperçu détaillé des 5 premières banks par device avant overwrite
   - Mode "Remplacer" stylé wine/destructive + warning + `window.confirm` supplémentaire

**SOURCE_IDS étendu** (8 → 13) : ajout `AA`, `JS`, `TJ`, `WT`, `Galtone` comme sources standalone (distinctes d'`Anniversary` qui reste la collection pré-installée). availableSources reste permissive (fallback true si clé absente).

### Tests Phase 7.67 (+23 nouveaux Vitest)

- `src/core/sources.test.js` : 1 test étendu pour les 13 SOURCE_IDS (incluant AA/JS/TJ/WT/Galtone)
- `src/app/screens/MyCustomPacksTab.test.js` (NOUVEAU) : 22 tests `inferSource` — TSR, AA, JS, TJ, ML, WT, Galtone, Factory (CL/DR/HG/LD/BS), custom fallback, priorités, edge cases (chaîne vide, null, whitespace)

1163/1163 tests verts globaux (1140 + 23).

### Architecture livrée Phase 7.67

```
src/main.jsx                            APP_VERSION 8.14.110 → 8.14.111
public/sw.js                            CACHE backline-v210 → backline-v211
src/core/sources.js                     SOURCE_IDS étendu +5 (AA/JS/TJ/WT/Galtone)
                                        +labels, descriptions, badges, info
src/core/sources.test.js                +tests SOURCE_IDS Phase 7.67
src/app/screens/ProfileTab.jsx          Retrait 3 gates isAdmin
src/app/screens/MyCustomPacksTab.jsx    NOUVEAU — CRUD presets + inferSource
src/app/screens/MyCustomPacksTab.test.js NOUVEAU — 22 tests inferSource
src/app/screens/MonProfilScreen.jsx     +tabBtn 'custompacks' + rendu
                                        Retrait gate isAdmin tab export
                                        +isAdmin prop ExportImportScreen
src/app/screens/ExportImportScreen.jsx  +prop isAdmin + section JSON gated
                                        +preview détaillée 5 banks/device
                                        +mode Replace destructive style + confirm
```

### Conséquences Phase 7.67

- **1163/1163 tests verts** (+23 nouveaux).
- Pas de bump STATE_VERSION (additif sur sources + UI).
- Pas de migration : profils existants gardent leurs customPacks/customGuitars tels quels.
- **Bundle** 2374.05 → 2392.68 KB (+18.6 KB pour MyCustomPacksTab + form).
- **Effet immédiat** : Bruno, Francisco, et futurs beta-testeurs configurent leur rig en autonomie. Plus besoin d'admin pour custom guitars, customPacks, import CSV. Workflow onboarding simplifié à la création profil + setlist initiale.

### Dette résiduelle Phase 7.67

- **Vision IA pour MyCustomPacksTab** : non implémentée (saisie manuelle). Le tab admin `PacksTab` garde l'extraction Vision. Si beta-testeur demande, Phase 7.67.1+.
- **Pas de partage cross-profil** : customs restent per-profile. Reporter Phase 11.1+ si pertinent.
- **Trilingue EN/ES** : ~30 nouvelles clés `mycustompacks.*` + `profile.tab.custom-packs` avec fallbacks FR inline. Traductions à ajouter (~20 min).
- **inferSource** : 8 patterns regex. Naming exotique non couvert → tombe sur 'custom' (le user peut override manuellement).

---

## État précédent (2026-05-18, Phases 7.65 + 7.65.1 + 7.47.1 + 7.65.x + 7.61 + 7.64 + 7.63 + 7.63.1 + 7.68 close — 9 phases livrées)

**Backline v8.14.110 / SW backline-v210 / STATE_VERSION 10 / 1140 tests verts.**

### Phase 7.68 — Aligner HomeScreen sur SongDetailCard (recos cohérentes Accueil ↔ Setlists) (v8.14.110)

Bug rapporté Bruno 2026-05-18 matin : *"pour un même morceau j'ai parfois des reco différentes entre la page de garde et quand je passe par le setlist."* Investigation menée Phase 7.68 (P2 du backlog).

**Cause racine identifiée** : divergence du flow `enrichAIResult` entre les 2 écrans.

`HomeScreen.handleSongConfirm` (cache-hit) faisait :
```js
const r = enrichAIResult({ ...existing.aiCache.result }, gType, cachedGId, banksAnn, banksPlug, undefined, existing);
```
→ aiCache.result **brut** (avec `preset_ann`, `preset_plug`, `ideal_preset`, `ideal_top3` cached) → spread → enrichAIResult.

`SongDetailCard.useEffect` (cache-hit) faisait :
```js
const cleaned2 = { ...song.aiCache.result, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null };
const recalc = enrichAIResult(cleaned2, gType, gId, banksAnn, banksPlug, undefined, song);
```
→ aiCache **nettoyé des presets** avant recompute → enrichAIResult repart à zéro pour ces champs.

**Conséquence pratique pour Bruno** :
- Sur l'Accueil avec recherche libre : il voyait les `preset_ann/plug/ideal_preset` **cached** (calculés à un instant T précédent, potentiellement avec un autre `gId` actif et/ou des banks/sources différentes).
- Sur Setlists vue dépliée : il voyait les `preset_ann/plug/ideal_preset` **recomputés** pour le `gId` courant + banks/sources actuels.

Recos différentes pour le même morceau selon le point d'entrée. Particulièrement visible *"si je ne choisis pas de guitare dans l'onglet setlist"* car les fallbacks `gId` étaient aussi divergents (Accueil : `cachedGId` brut ; Setlists : `savedGuitarId || ig[0] || ''` filtré rig actif).

**Fix Phase 7.68** dans `HomeScreen.handleSongConfirm` cache-hit :

1. **Cleanup presets cached avant enrichAIResult** : preset_ann/plug/ideal_preset/ideal_top3 remis à null pour que enrichAIResult recompute proprement avec le contexte actuel.
2. **Validation `cachedGId` in-rig** : si `cachedGId` n'existe pas dans `allGuitars` (rig actif), fallback sur `getIg(existing, allGuitars)[0]` (équivalent SongDetailCard ligne 57 : `savedGuitarId || ig[0] || ''`). Préserve la cohérence Phase 7.65.

### Architecture livrée Phase 7.68

```
src/main.jsx                            APP_VERSION 8.14.109 → 8.14.110
public/sw.js                            CACHE backline-v209 → backline-v210
src/app/screens/HomeScreen.jsx          +import getIg de song-helpers
                                        handleSongConfirm cache-hit :
                                        +cleanup preset_ann/plug/ideal_*
                                        +valid cachedGId in-rig + fallback ig[0]
                                        +recompute enrichAIResult propre
```

### Conséquences Phase 7.68

- **1140/1140 tests verts** (aucun nouveau — les helpers enrichAIResult sont déjà couverts, le fix est dans le flow d'appel HomeScreen).
- Pas de bump STATE_VERSION (purement display/render-time).
- Pas de migration : les aiCache existants restent valides, simplement re-cleanupés au render.
- **Bundle** 2373.88 → 2374.05 KB (+0.17 KB pour le commentaire + cleanup).
- **Effet immédiat post-reload v8.14.110** : pour tout morceau ouvert depuis l'Accueil, la reco est désormais identique à celle vue depuis Setlists vue dépliée. Cohérence complète entre les 2 points d'entrée.
- **✅ Validé Sébastien post-déploiement 2026-05-18 soir** : recos identiques sur Anniversary ET Plug entre Accueil et Setlists vue dépliée. Tests 2 (Phase 7.63 banner admin-switch) et 3 (Phase 7.64 family match Get Lucky Francisco) aussi validés dans la même séance.

### Dette résiduelle Phase 7.68

- **Tests Vitest dédiés** : pas ajoutés (le helper `enrichAIResult` est déjà bien testé, le fix est dans le flow d'appel React qui n'a pas de tests d'intégration). Si régression observée, ajouter un test sur `handleSongConfirm` mock.
- **HomeScreen ligne 510** (résiduelle Phase 7.65.1) — fallback `idealGuitarObj = idealGuitarCot || songResult.cot_step2_guitars?.[0]` qui peut laisser passer une guitare hors rig dans certains cas. Non touché Phase 7.68. À scoper Phase 7.65.2 si observé.
- **Bug investigation P2** (CLAUDE.md ligne 1419) marqué ✅ LIVRÉ avec Phase 7.68.

---

## État précédent (2026-05-18, Phases 7.65 + 7.65.1 + 7.47.1 + 7.65.x + 7.61 + 7.64 + 7.63 + 7.63.1 close — 8 phases livrées)

**Backline v8.14.109 / SW backline-v209 / STATE_VERSION 10 / 1140 tests verts.**

### Phase 7.63.1 — Réintroduire ProfileSelector dropdown dans AppHeader (v8.14.109)

Suite Phase 7.63, Sébastien rapporte que le banner admin-switch ne s'active jamais en pratique. Investigation : le composant `ProfileSelector.jsx` (dropdown switch profil dans le header) existe et est importé dans `main.jsx` ligne 330, **mais n'est jamais rendu**. Régression silencieuse du découpage Phase 7.22 (`AppHeader.jsx`) qui a remplacé le dropdown par un bouton avatar simple ouvrant directement `MonProfilScreen` via `onProfile`.

Conséquence : pas de flow `switchProfile` accessible par l'UI → Phase 7.63 banner inerte (le seul appel à `switchProfile` était le bouton "← Retour admin" du banner lui-même → catch-22). Sébastien switchait entre profils via logout + login password sur ProfilePicker (= `pickProfile`, pas `switchProfile`) — donc aucune entry `admin_switch` loguée et aucun banner.

**Fix Phase 7.63.1 (~30 min)** :

1. **`ProfileSelector.jsx`** : ajout d'un lien "⚙️ Mon Profil" en bas du dropdown (séparateur horizontal + bouton qui appelle `onSettings`). Préserve l'accès à `MonProfilScreen` (qui était l'unique action du bouton avatar simple).
2. **`AppHeader.jsx`** : rendu conditionnel — si `isAdmin && onSwitch` → `<ProfileSelector>` (dropdown switch profil + Mon Profil), sinon bouton avatar simple (comportement antérieur, pour les non-admins). Filtre interne du ProfileSelector (ligne 61) garde le `active?.isAdmin || p.id === activeProfileId` : un admin voit tous les profils, un non-admin (cas dégénéré improbable ici) ne voit que le sien.
3. **`main.jsx`** : `headerProps` étendu avec `onSwitch: switchProfile`, `onViewProfile`, `onUpgradePassword` (handler hashed → SHA-256+salt au login, Phase 7.28).

### Comportement post-déploiement

- **Admin Sébastien** : clic avatar header → dropdown avec liste tous profils (Bruno, Francisco, Arthur, Franck, etc.) + lien "⚙️ Mon Profil" en bas. Clic sur Bruno → si trusted device → `switchProfile('bruno')` direct → banner `AdminAsBanner` Phase 7.63 s'affiche + entry `admin_switch` dans `bruno.loginHistory`. Si pas trusted → modale password (workflow normal ProfileSelector Phase 7.18).
- **Non-admin Bruno** : clic avatar header → ouvre `MonProfilScreen` directement (pas de dropdown — Phase 7.29.6 préserve la confidentialité, Bruno ne voit pas les autres profils).

### Architecture livrée Phase 7.63.1

```
src/main.jsx                            APP_VERSION 8.14.108 → 8.14.109
                                        headerProps étendu : onSwitch
                                        (switchProfile), onViewProfile,
                                        onUpgradePassword
public/sw.js                            CACHE backline-v208 → backline-v209
src/app/components/AppHeader.jsx        +import ProfileSelector
                                        rendu conditionnel admin/non-admin
                                        (dropdown vs bouton simple)
src/app/components/ProfileSelector.jsx  +lien "⚙️ Mon Profil" en bas du
                                        dropdown (séparateur + bouton
                                        onSettings)
```

### Conséquences Phase 7.63.1

- **1140/1140 tests verts** (aucun nouveau test — purement UX, fonctionnalité déjà testée Phase 7.63).
- Pas de bump STATE_VERSION.
- Pas de migration.
- **Bundle** 2368.57 → 2373.88 KB (+5.3 KB pour ProfileSelector inline + Mon Profil link).
- **Effet immédiat** : le banner Phase 7.63 et le log loginHistory deviennent **vraiment activables** par le workflow de switch profil de l'admin.
- **✅ Validé Sébastien post-déploiement 2026-05-18 soir** : dropdown apparaît au clic avatar, switch sur profil non-admin déclenche banner copper + entry loginHistory bien visible côté beta-testeur.

### Dette résiduelle Phase 7.63.1

- **Le ProfileSelector demande encore le password au switch si le profil cible n'est pas trusted**. Workflow inchangé depuis Phase 7.18. Si Sébastien admin n'a jamais été trusted sur Bruno → password demandé. C'est strictement plus restrictif que ce que je promettais Phase 7.63 (qui assumait le switch direct), mais cohérent avec la sécurité existante. À discuter si besoin d'un switch admin SANS password (l'admin a déjà accès au password via le state, donc strictement pas une protection — juste de la friction).
- **Trilingue EN/ES** : nouveau key `profile-selector.settings` avec fallback FR "Mon Profil". Traductions complètes à ajouter (Phase 7.63 dette résiduelle déjà documentée).

---

## État précédent (2026-05-18, Phases 7.65 + 7.65.1 + 7.47.1 + 7.65.x + 7.61 + 7.64 + 7.63 close — 7 phases livrées)

**Backline v8.14.108 / SW backline-v208 / STATE_VERSION 10 / 1140 tests verts.**

### Phase 7.63 — Sécurité admin-switch profil (v8.14.108)

Quand l'admin (Sébastien) clique sur un autre profil dans le `ProfileSelector` dropdown, le switch était silencieux : pas de feedback visuel persistant, pas de trace pour le beta-testeur. Risques (sans incident effectif observé, mais préventif) :
- Confidentialité : admin voit rig/setlists/aiCache sans consentement.
- Sync concurrent : LWW per-profile peut écraser modifs beta-testeur si admin écrit après lui.
- Switch accidentel : click malheureux peut faire éditer dans le mauvais profil.

**Fix Phase 7.63 (Options 1+2 du plan, ~1h)** :

1. **Banner persistant `AdminAsBanner`** (`src/app/components/AdminAsBanner.jsx` — NOUVEAU) — sticky top, gradient copper/brass, affiché tant que l'admin est connecté sur un profil ≠ son admin d'origine. Bouton "← Retour admin" pour repasser sur le profil admin d'origine. Visible partout sauf `screen === 'live'` et `isDemo` (priorité au DemoBanner). Trilingue FR/EN/ES (11 clés `admin-as.*`).

2. **Log `admin_switch` dans `loginHistory`** : entry au format `{type: 'admin_switch', ts, adminId, adminName}` push dans `profile.loginHistory` du profil cible au moment du switch. Le beta-testeur peut consulter via Mon Profil → 🔐 Mot de passe → nouvelle section "Historique de connexion" (5 dernières entries). Format dual : `number` (login normal Phase 5.7+) + `object` (admin_switch Phase 7.63). UI rendu distinct : ✓ + horodatage pour login normal, 🔍 + nom admin + (mode admin) + horodatage pour admin_switch (couleur copper).

3. **`switchProfile` étendu** dans `main.jsx` :
   - Détecte si on switch DEPUIS un profil admin (currentProfile.isAdmin) OU si on est déjà en mode admin-as (`sessionStorage.tonex_admin_origin` posé).
   - Si admin → cible non-admin : pose `sessionStorage.tonex_admin_origin` + appel `recordAdminSwitch(profiles, targetId, adminProfile)`.
   - Si retour sur profil admin d'origine OU switch vers un autre admin : clear `sessionStorage.tonex_admin_origin`.
   - Switch entre 2 admins : pas de mode admin-as (pas de risque de confidentialité).

4. **Clear du marker** sur tous les sites de logout : `MonProfilScreen.onLogout`, `HomeScreen.onLogout`, `DemoBanner.onExit` — tous appellent désormais `sessionStorage.removeItem(ADMIN_ORIGIN_KEY)` en plus du clear `tonex_active_profile`.

5. **Helpers purs `recordAdminSwitch` + `isAdminAsMode`** dans `src/core/state.js` (16 tests Vitest).

### Tests Phase 7.63 (+16 nouveaux Vitest)

`src/core/state.test.js` :
- `recordAdminSwitch` × 8 : push entry, préservation existantes, cap 10, fallback adminId si name manquant, targetId inexistant → no-op, adminProfile sans id → no-op, immutabilité, loginHistory corrupted → init array.
- `isAdminAsMode` × 8 : admin sur non-admin → true (scénario Sébastien switch sur Bruno), admin sur soi → false, sans adminOriginId → false, adminOriginId pointe sur non-admin (defensive) → false, adminOriginId inexistant → false, admin sur autre admin → true, activeProfileId/profiles falsy → false.

1140/1140 tests verts globaux (1124 + 16).

### Architecture livrée Phase 7.63

```
src/main.jsx                            APP_VERSION 8.14.107 → 8.14.108
                                        +import ADMIN_ORIGIN_KEY,
                                          recordAdminSwitch, isAdminAsMode
                                        +import AdminAsBanner
                                        switchProfile : tracker admin origin
                                          + push loginHistory entry sur target
                                        +clear sessionStorage admin_origin
                                          sur 3 sites onLogout
                                        +<AdminAsBanner> au root JSX
                                          (gated isAdminAsMode + screen !==
                                          'live' + !isDemo)
public/sw.js                            CACHE backline-v207 → backline-v208
src/core/state.js                       +ADMIN_ORIGIN_KEY constant
                                        +recordAdminSwitch helper pur
                                        +isAdminAsMode helper pur
                                        +exports
src/core/state.test.js                  +16 tests Phase 7.63
src/app/components/AdminAsBanner.jsx    NOUVEAU — banner sticky top copper
src/app/screens/MonProfilScreen.jsx     +import getLocale
                                        PasswordTab : +section
                                        "Historique de connexion" qui rend
                                        loginHistory (dual format
                                        timestamp/admin_switch avec icône
                                        ✓ ou 🔍 différenciés)
src/app/screens/ProfilesAdmin.jsx       loginHistory display étendu
                                        (gère le format admin_switch)
```

### Conséquences Phase 7.63

- **1140/1140 tests verts** (+16 nouveaux).
- **Pas de bump STATE_VERSION** (additif sur `loginHistory[]` entries — coexistent number et object).
- **Pas de migration localStorage** : les loginHistory existants (avec timestamps purs) continuent à fonctionner. Les nouveaux entries `admin_switch` s'ajoutent au fur et à mesure.
- **Bundle** 2363.98 → 2366.55 KB (+2.6 KB pour banner + helpers + tests).
- **Cas-cible Sébastien post-déploiement** : switch sur Bruno via dropdown → banner copper "🔍 Connecté en tant que Bruno (mode admin) — tes modifs s'appliquent à son profil" + bouton "← Retour admin" → Bruno consulte son Mon Profil → 🔐 Mot de passe → section Historique → voit "🔍 Sébastien (mode admin) · 18/05/2026 22:30".

### Dette résiduelle Phase 7.63

- **Trilingue EN/ES** : 11 nouvelles clés `admin-as.*` + 4 nouvelles `password.*` / `profiles.*` ont des fallbacks FR inline. Traductions complètes à ajouter dans `i18n/en.js` et `es.js` (~10 min).
- **Option 3 (modale confirmation avant switch)** : non implémentée. Reporter sauf si Sébastien remonte des switchs accidentels.
- **Option 4 (demander password beta-testeur)** : volontairement écartée — friction max sans gain réel de sécurité (admin a déjà accès au password via state Firestore).
- **sessionStorage non-réactif** : `getItem(ADMIN_ORIGIN_KEY)` est lu dans le render JSX. Le re-render est triggéré par `setActiveProfileId` (qui se passe en même temps que le set du sessionStorage). Fonctionne en pratique car les 2 sont synchrones côté React. Si un jour le marker est modifié hors-flow React (par un autre tab/onglet), pas de re-render — pas observé en pratique.

---

## État précédent (2026-05-18, Phases 7.65 + 7.65.1 + 7.47.1 + 7.65.x + 7.61 + 7.64 close — 6 phases livrées)

**Backline v8.14.107 / SW backline-v207 / STATE_VERSION 10 / 1124 tests verts.**

### Phase 7.61 + 7.64 — Rename guitares + bonus family match (v8.14.107)

Promesse Francisco 17 mai soir "esta semana" honorée. Couplage des 2 phases pour 1 seul tour de validation.

**Phase 7.61 — Rename guitares vers noms complets + matchGuitarName tolérant** :

1. **`matchGuitarName` étendu** avec tokenize-set + stoplist + expand abbreviations (LP → les paul, JM → jazzmaster, JB → jazz bass). Gère :
   - Suffixe numeric : "61" matche "1961"
   - Prefix numeric : "60" matche "60s"
   - Substring ≥4 chars : "strat" matche "stratocaster"
   - Stoplist : marques (fender, gibson, sire…), qualificatifs (american, vintage, standard, ii…), abréviations (am, pro) — filtrés avant tokenize-set
   - Conserve les 2 paths legacy (exact match + substring) pour rétro-compat.
2. **11 guitares renommées** dans `core/guitars.js` vers noms marketing/PDF complets :
   - `lp60` : "Les Paul Standard 60" → "Gibson Les Paul Standard '60s"
   - `lp50p90` : "Les Paul Standard 50 P90" → "Gibson Les Paul Standard '50s P-90"
   - `sg_ebony` : "SG Standard Ebony" → "Gibson SG Standard Ebony"
   - `sg61` : "SG Standard 61" → "Gibson SG Standard '61"
   - `es335` : "ES-335" → "Gibson ES-335"
   - `strat61` : "Strat AM Vintage II 61" → "Fender Stratocaster American Vintage II 1961"
   - `strat_pro2` : "Strat AM Pro II" → "Fender Stratocaster American Professional II"
   - `strat_ec` : "Eric Clapton Strat" → "Fender Eric Clapton Signature Stratocaster"
   - `tele63` : "Telecaster AM Vintage II 63" → "Fender Telecaster American Vintage II 1963"
   - `tele_ultra` : "Telecaster Ultra" → "Fender Telecaster American Ultra"
   - `jazzmaster` : "Jazzmaster" → "Fender American Vintage II 1966 Jazzmaster"
   - `short` inchangé (badge ListScreen compact).
3. **Rétro-compat aiCache** garantie : les anciens noms (`cot_step2_guitars[].name = "Strat AM Vintage II 61"`) matchent encore les nouveaux via tokenize-set.
4. **Fix ellipses badges preset desktop** : `maxWidth: 220` hardcoded → `clamp(200px, 35vw, 500px)` responsive.
5. **Audit codes couleur badges vue repliée** : unification — tous les badges (slot, label, score%) prennent la même couleur basée sur le score (`scColorV`). Avant : badge slot en `deviceColor`, badge label+score en `scoreColor` — mélange confus rapporté par Sébastien.

**Phase 7.64 — Bonus family match Strat/Tele/LP** :

1. **Nouveau helper `getGuitarFamily(name)`** dans `core/scoring/guitar.js` retourne `'stratocaster' | 'telecaster' | 'les_paul' | 'sg' | 'es335' | 'jazzmaster' | 'jaguar' | 'mustang' | 'flying_v' | 'explorer' | 'firebird' | 'prs' | 'superstrat' | 'other'`. Match par substring sur le nom (couplé à Phase 7.61 nouveaux noms complets : `getGuitarFamily("Fender Stratocaster American Vintage II 1961") === 'stratocaster'` trivialement).
2. **Bonus dans `enrichAIResult`** : si `aiResult.ref_guitar` a une family connue (≠ 'other'), boost +15 pts sur chaque `cot_step2_guitars[i]` dont la family matche. Plafonné à 99. Re-tri par score décroissant. Si la nouvelle top est de la family ref_guitar, mise à jour de `aiResult.ideal_guitar`.
3. **Idempotent** : flag `_familyBoosted` posé après application — pas de double-boost si `enrichAIResult` appelé plusieurs fois (vue dépliée + vue repliée).
4. **Post-processing pur** : pas de bump SCORING_VERSION, les aiCache existants bénéficient au render dès reload v8.14.107.

### Tests Phase 7.61 + 7.64 (+47 nouveaux Vitest)

- `src/core/scoring/guitar-family.test.js` (NOUVEAU) — 38 tests : `getGuitarFamily` sur toutes les familles Fender/Gibson/PRS + scénarios bugs (Francisco Get Lucky, Stairway, Brown Sugar) + `matchGuitarName` tokenize-set (rétro-compat ancien aiCache, abréviations LP/SG/Strat/Tele, négatifs).
- `src/app/utils/ai-helpers.test.js` — 9 nouveaux tests sur `enrichAIResult` Phase 7.64 :
  - **Scénario bug Francisco Get Lucky** reproduit : ref_guitar Stratocaster + cot_step2 [Tele 88, Strat 78] → après bonus [Strat 93, Tele 88], ideal_guitar = Strat.
  - Stairway to Heaven : ref_guitar Les Paul + cot_step2 [SG 90, LP 82, ES 75] → après [LP 97, SG 90, ES 75].
  - Plusieurs guitares même family → toutes boostées, départage scoring V9.
  - ref_guitar family 'other' → pas de boost.
  - Aucune match → pas de re-tri.
  - Idempotent (double appel ne double pas).
  - Plafonné à 99.
  - cot_step2 vide/absent → no-op.
  - ref_guitar null → no-op.

1124/1124 tests verts globaux (1077 + 47).

### Architecture livrée Phase 7.61 + 7.64

```
src/main.jsx                            APP_VERSION 8.14.106 → 8.14.107
public/sw.js                            CACHE backline-v206 → backline-v207
src/core/scoring/guitar.js              matchGuitarName étendu tokenize-set
                                        +GUITAR_STOPWORDS Set
                                        +_expandGuitarAbbreviations,
                                          _tokenizeGuitarName,
                                          _significantTokens,
                                          _tokenMatch, _tokenSubsetMatch
                                        +getGuitarFamily export
src/core/scoring/index.js               re-export getGuitarFamily
src/core/guitars.js                     11 guitares renommées noms complets
src/app/utils/ai-helpers.js             +import getGuitarFamily
                                        enrichAIResult : +bonus family match
                                        avant return (idempotent _familyBoosted)
src/app/screens/ListScreen.jsx          fix ellipses badges desktop
                                          (maxWidth 220 → clamp responsive)
                                        audit couleurs badges : unifiedColor
                                          (scColorV partout)
src/core/scoring/guitar-family.test.js  NOUVEAU — 38 tests
src/app/utils/ai-helpers.test.js        +9 tests enrichAIResult Phase 7.64
```

### Conséquences Phase 7.61 + 7.64

- **1124/1124 tests verts** (1077 + 47 nouveaux).
- **Pas de bump STATE_VERSION** (purement post-processing + rename data).
- **Pas de migration localStorage** : rétro-compat aiCache historique via `matchGuitarName` tokenize-set.
- **Effet immédiat sur Francisco** post-reload v8.14.107 : à l'ouverture de "Get Lucky" (Daft Punk), le post-processing applique +15 sur la Squier Strat (family stratocaster matche ref_guitar) → la Strat passe devant la Sire T7 Telecaster. Workaround feedback IA explicite plus nécessaire.
- **Effet immédiat sur tous les profils avec guitares ambiguës** (Strat+Tele, LP+SG, etc.) : la family de `ref_guitar` est désormais respectée par le scoring.
- **Bundle** 2360.54 → 2363.98 KB (+3.4 KB pour les helpers + tests).

### Dette résiduelle Phase 7.61 / 7.64

- **Customs sans family identifiable** (Schecter, Ibanez Gio, etc.) restent en `'other'` → pas de boost. Le scoring V9 brut décide. C'est cohérent (l'IA n'a pas de référence "Schecter" comme family, juste comme nom).
- **Phase 7.64 ne couvre PAS l'autre direction** : si user dit "je veux jouer Get Lucky sur ma Tele" (feedback explicit), le bonus s'applique quand même sur la Strat. Le feedback override Phase 7.6 reste prioritaire (réécrit aiResult avant enrichAIResult).
- **`getGuitarFamily` étend la liste de familles si nouveau besoin** : superstrat est déjà couvert mais grossier ("Ibanez RG superstrat"). À affiner si user remonte un cas concret.

---

## État précédent (2026-05-18, Phases 7.65 + 7.65.1 + 7.47.1 + 7.65.x close — filtre rig actif + metadata factory PDF v2 + customs usages pin)

**Backline v8.14.106 / SW backline-v206 / STATE_VERSION 10 / 1077 tests verts.**

### Phase 7.65.x — Fix useMemo customPacks copie le champ `usages` (v8.14.106)

Bug rapporté Bruno : ses customs Mesa Mark IIC+ / Marshall JCM800 avec usages explicit (Metallica / Iron Maiden) ne sont pas pinnés par l'IA pour "For Whom the Bell Tolls" / "Fear of the Dark", alors que les customs dont le nom contient littéralement l'artiste (Blink-182, Dr. Stein) sont correctement pinnés.

**Cause racine** : l'useMemo `main.jsx` Phase 7.30 qui injecte `profile.customPacks` dans `PRESET_CATALOG_MERGED` ne copiait pas le champ `usages`. Donc tous les flows aval (prompt IA, post-process `findSlotByUsageMatch`) recevaient un catalog entry sans `usages` pour les customs. Le pin via PRIORITÉ 1 du prompt (Phase 7.34) ne fonctionnait jamais pour les customs ; seule la PRIORITÉ 2 (nom contient artiste/morceau littéralement) survivait.

**Fix** : 1 ligne effective dans l'useMemo + 8 tests Vitest dédiés. Voir section "Phase 7.65.x — ✅ LIVRÉE" plus bas pour le détail.

Aucune autre modif nécessaire — `buildInstalledSlotsSection`, `findSlotByUsageMatch`, `findCatalogEntryByUsages` sont corrects dans leur logique, leur input `entry.usages` était simplement toujours `undefined` pour les customs.

---

## État précédent (2026-05-18, Phases 7.65 + 7.65.1 + 7.47.1 close — filtre rig actif + metadata FACTORY_CATALOG conforme PDF v2)

**Backline v8.14.105 / SW backline-v205 / STATE_VERSION 10 / 1069 tests verts.**

### Phase 7.47.1 — FACTORY_CATALOG metadata conforme PDF v2 (v8.14.105)

Audit complet `FACTORY_CATALOG` vs `tone_models/TONEX_Pedal_Pre-loaded_Factory_Presets.pdf` v2 (2025/04/03). Phase 7.47 avait livré le mapping `FACTORY_BANKS_PEDALE_V2` correct (bank → slot → preset name) **mais** la metadata associée dans `FACTORY_CATALOG` (champ `amp`) était soit simplifiée (`"Mesa Mark"` au lieu de `"Mesa Boogie Mark III"`), soit carrément fausse (`STERPAN` amp = `"Fuzzy"` qui n'est pas un amp réel).

**Catégorie A — 4 vrais bugs corrigés** :
- **Bank 41A typo** : `DRVMASTR` → `DRVMSTR` (preset name PDF). Renommé clé `FACTORY_CATALOG` + valeur `FACTORY_BANKS_PEDALE_V2[41].A` + valeur `factory-banks.test.js PDF_V2_EXPECTED[41].A`.
- **STERPAN amp** : `"Fuzzy"` → `"Fender Super Six Reverb"` (PDF). `"Fuzzy"` n'était pas un amp réel — faussait `computeRefAmpScore` (30% du score V9) sur les morceaux qui invoquaient cet ampli.
- **HG 5051 (Amp)** : `"EVH 5150"` → `"Peavey 5150"` (PDF, cohérent avec `HG 5051` standard Bank 15 qui était déjà `Peavey 5150`). Confusion 2 marques différentes — EVH (récent, branding Eddie Van Halen 2018+) vs Peavey (original 5150 années 90 avec Eddie).
- **BS B15 amp** : `"Ampeg SVT"` → `"Ampeg B15"` (PDF). B15 et SVT sont 2 amplis Ampeg différents.

**Catégorie B — ~50 amp names alignés exactement sur PDF** (sans erreur métier, juste précision) :
- `Dumble ODS` → `Dumble Overdrive Special #0080`
- `Marshall Plexi` → `Marshall Super Lead MKII`
- `EVH 5150` → `EVH 5150 Stealth`
- `Fender Twin Reverb` → `Fender Twin Reverb '65`
- `Mesa Rectifier` → `Mesa Boogie Dual Rectifier 90s`
- `Dr. Z` → `Dr. Z Z Wreck`
- `Friedman BE-100` → `Friedman BE100` (hyphen)
- `Soldano SLO-100` → `Soldano SLO100`
- `Mesa Mark` → `Mesa Boogie Mark III` (Bank 10) / `Mesa Boogie Mark V` (Bank 17) — distinction !
- `Marshall JCM800` → `Marshall JCM 800` (avec espace)
- `Diezel` → `Diezel VH4`
- `Fender Princeton` → `Fender 65 Princeton Reverb`
- `ENGL` → `ENGL Fireball`
- `Roland JC-120` → `Roland JC120` (sans hyphen)
- `Orange` → `Orange Thunderverb 200` (Bank 20) / `Orange OR120` (Bank 30 AMBIENT) — distinction
- `Fender Deluxe Reverb` → `Fender 65 Deluxe Reverb`
- `Marshall` (générique) → `Marshall AFD100 Slash Signature` (Bank 23 GUNS — c'est un signature pack Slash, pas générique)
- `Mesa Boogie` → `Mesa Boogie Maverick` (Bank 24)
- `Fender Bassman` → `Fender '59 Bassman LTD`
- `Marshall JCM900` → `Marshall JCM 900`
- `EVH 5150` (Bank 31 AINTALK + Bank 33 1CHAIN) → `Fender EVH 5150III 50w` (différent — c'est la version 50w spécifique)
- `Marshall` (Bank 33 VOWELS) → `Marshall JMP 100W`
- `Fender` (générique × 3) → `Fender Super Reverb` / `Fender Pro Junior` / `Fender Hot Rod Deluxe` (3 amplis distincts pour Bank 32 SPRING4/MYBABY/BLKHOLE)
- `Dr. Z` (Bank 34 LUSH) → `DrZ Maz 18`
- `HG DUAL (Amp)` Bank 38C → `Mesa Boogie Dual Rectifier 2ch` (différent du 90s sur Bank 5)
- Variantes `(Amp)` Bank 35-39 alignées idem
- `Ampeg SVT` (générique × 3 bass) → `Ampeg SVT2 Pro` (Bank 45C) / `Ampeg SVT VR` (Bank 47A)
- `Marshall JCM800` (Bank 46A BS 800) → `Marshall JCM 800 Bass Amp`
- `Orange` (Bank 46C BS ORNG) → `Orange AD200`

**Reporter en dette résiduelle Phase 7.47.x** :
- **Catégorie C — Stomps standalone** (Banks 40-44, certains Banks 47-49) : code stocke la **character** PDF (`Stomp - Overdrive` / `Stomp - Distortion` / `Stomp - Fuzz`) dans le champ `amp:` au lieu du modèle pédale réel (Boss SD-1, Klon Centaur, Marshall DriveMaster, Fulltone OCD, Ibanez TS808, ProCo Rat, Tech21 SansAmp, EHX Big Muff, etc.). Ces presets ne fittent pas le scoring V9 amp-centric. Phase 8 (pédales modélisées) résoudra mieux avec un champ `pedal:` dédié. Reporter.
- **Catégorie D — Champ `toneModelName` absent** : le PDF a 2 colonnes nom (`PRESET NAME` ex. "CL DMBL" + `TONE MODEL NAME` ex. "Unique #80"). Le firmware ToneX affiche probablement le Tone Model Name sur l'écran de la pédale. Ajout du champ à chaque entry + tolérance `findCatalogEntry` (comme Phase 7.52.4 pour Anniversary Premium). À déclencher si un beta-tester remonte la confusion. Reporter.

### Architecture livrée Phase 7.47.1

```
src/main.jsx                                APP_VERSION 8.14.104 → 8.14.105
public/sw.js                                CACHE backline-v204 → backline-v205
src/data/data_catalogs.js                   FACTORY_BANKS_PEDALE_V2[41].A
                                            DRVMASTR → DRVMSTR
                                            FACTORY_CATALOG :
                                            +rename clé DRVMASTR → DRVMSTR
                                            +amp values alignées PDF v2
                                            (~50 entries amp-based, Cat A+B)
src/devices/tonex-pedal/factory-banks.test.js
                                            PDF_V2_EXPECTED[41].A
                                            DRVMASTR → DRVMSTR
```

### Conséquences Phase 7.47.1

- **1069/1069 tests verts** (snapshots V9 inchangés — les amp names ne sont pas dans les chaînes hardcodées des snapshots, le scoring V9 utilise les `scores` HB/SC/P90 toujours identiques).
- **Pas de bump STATE_VERSION** (additif sur metadata, schéma identique).
- **Pas de migration localStorage** : les `profile.banksPedale` existants gardent leurs preset names (`DRVMASTR` legacy reste résolvable via fallback `guessPresetInfo` si pas dans le catalog rénommé — ou re-clic "Reset factory" pour propager `DRVMSTR`).
- **Bundle** 2360.54 → 2361.29 KB (+0.75 KB pour commentaires + amp names plus longs).
- **Effet sur scoring V9** : `computeRefAmpScore` matche désormais plus précisément les recommandations IA qui mentionnent un ampli spécifique (`Mark III` vs `Mark V` distincts, `Peavey 5150` vs `EVH 5150` distincts, `Fender Pro Junior` vs `Fender Super Reverb` distincts, etc.). Amélioration nette de précision pour les morceaux dont l'IA retourne un `ref_amp` précis.
- **Bug Bruno (5C DR VX30 vs LD DUAL)** : indépendant de Phase 7.47.1 — c'est probablement du localStorage stale sur Bruno (banks initialisés pré-Phase 7.47). À traiter à part (reset manuel via console Firestore).

### Dette résiduelle Phase 7.47.x

- **Phase 7.47.2 (proposée) — Cat C stomps** : remplacer `Stomp - Overdrive` générique par modèle pédale réel + champ `pedal:` dédié. Couplé à Phase 8 (pédales modélisées) qui ajoutera une vraie base de données pédales avec scoring adapté.
- **Phase 7.47.3 (proposée) — Cat D toneModelName** : ajouter champ `toneModelName` à chaque entry `FACTORY_CATALOG`, étendre `findCatalogEntry` avec fallback toneModelName (réplique pattern Phase 7.52.4 pour Anniversary Premium). Utile pour cohérence cross-device (Bruno regarde "Super Double" sur son écran, Backline lui parle "LD DUAL" — un seul des deux est ambigu).
- **Cab name column PDF** : non importée dans `FACTORY_CATALOG` (champ `cab:` absent côté Factory, contrairement à `ANNIVERSARY_CATALOG` qui a un champ `cab` riche). Pas urgent — le scoring V9 ne lit pas `cab` pour les entries Factory. À envisager si Phase 8+ valorise la précision du cab.

---

## État précédent (2026-05-18, Phases 7.65 + 7.65.1 close — vue repliée + Raisonnement IA filtrés rig actif)

**Backline v8.14.104 / SW backline-v204 / STATE_VERSION 10 / 1069 tests verts.**

### Phase 7.65.1 — Filtre cot_step2_guitars + ideal_guitar sur rig actif (v8.14.104)

Suite Phase 7.65 (vue repliée ListScreen), Sébastien remonte un 2e
site qui leakait des guitares hors rig : la section **"🧠 Raisonnement
IA → Scoring guitares"** dans la vue dépliée (`SongDetailCard`) et
sur l'écran Accueil après recherche libre (`HomeScreen`). Ces sites
itéraient `aiC.cot_step2_guitars` brut → pour Bruno (rig HB-only)
sur "The Final Countdown" :

> Strat AM Vintage II 61 (SC) 92% — Norum joue 1965 Strat…
> Les Paul Standard 60 (HB) 85% — humbuckers 80s…
> Schecter C-1 Platinum (HB) 78% — solo confort.

Bug racine identique à Phase 7.65 : Phase 3.6 (union all-rigs au
prompt) → cot_step2 mentionne des guitares d'autres profils.

**Décision UX** (validée 2026-05-18) : **filtre strict** (drop des
entrées hors rig). Si toutes les top-N IA sont hors rig, la section
"Scoring guitares" se cache → l'IA n'a comparé que des guitares
inaccessibles, on ne ment pas. Trade-off vs option "afficher tout +
badge hors rig" : moins de contexte comparatif mais aucune confusion.

**Fix Phase 7.65.1 (purement d'affichage)** :

1. **Nouveau helper `filterCotGuitarsToRig(cotList, rigGuitars)`**
   dans `src/app/utils/display-guitar.js` (à côté de
   `resolveDisplayGuitar`). Retourne un nouveau tableau, immutable
   sur la source. Drop entries sans `name`, sans match rig, ou
   malformées.

2. **SongDetailCard "Scoring guitares"** (`src/app/screens/SongDetailCard.jsx`
   lignes 224-234) : `cotInRig = filterCotGuitarsToRig(...)` avant
   `.map`. Bloc englobant `(cot_step1 || cot_step2_guitars ||
   cot_step3_amp)` mis à jour → `(cot_step1 || cotInRig.length > 0
   || cot_step3_amp)` pour cacher TOUTE la section si rien à
   afficher. Le rendu cot_step2 utilise `cotInRig` et son `.length`.

3. **HomeScreen** (`src/app/screens/HomeScreen.jsx`) :
   - Bloc 543-569 "Raisonnement IA" : pareil, filtre via
     `cotInRigHS`.
   - Lignes 508-513 : ancien calcul `idealGuitarFromCollection +
     idealGuitarCot + idealGuitarObj + idealGuitarScore` (4 vars
     dont une — `idealGuitarObj` — fallback `cot_step2_guitars?.[0]`
     pouvant être hors rig) → remplacé par 3 lignes basées sur
     `resolveDisplayGuitar(songResult, allGuitars, { fallbackToFirst:
     false })`. Mode strict, cache la ligne si rien ne matche.
   - Ligne 578 (section "Recommandation idéale") : affiche
     `displayIdealGuitarName` au lieu de `songResult.ideal_guitar`
     brut. Si hors rig → ligne cachée (`displayIdealGuitarName ===
     null`).
   - Ligne 619 (section "Paramétrage — mon choix") : fallback
     `displayIdealGuitarName` au lieu de `songResult.ideal_guitar`.

### Tests Phase 7.65.1 (+7 nouveaux Vitest)

`src/app/utils/display-guitar.test.js` étendu pour
`filterCotGuitarsToRig` :
- **Scénario bug Bruno reproduit** : cotList [Strat, LP, Schecter]
  sur rig [Schecter, Ibanez] → garde Schecter uniquement, drop les
  2 hors rig.
- Ordre IA préservé quand plusieurs entries matchent.
- Toutes hors rig → `[]`.
- cotList vide/null/undefined → `[]`.
- rigGuitars vide/null → `[]`.
- Entries malformées (sans name / null / name vide) ignorées.
- **Immutabilité** : la liste source n'est jamais mutée.

22 tests verts dans `display-guitar.test.js` (15 Phase 7.65 + 7
Phase 7.65.1). Suite globale **1069 tests** (1062 + 7).

### Architecture livrée Phase 7.65.1

```
src/main.jsx                            APP_VERSION 8.14.103 → 8.14.104
public/sw.js                            CACHE backline-v203 → backline-v204
src/app/utils/display-guitar.js         +filterCotGuitarsToRig export
src/app/utils/display-guitar.test.js    +7 tests filterCotGuitarsToRig
src/app/screens/SongDetailCard.jsx      +import filterCotGuitarsToRig
                                        +IIFE wrap pour scope `cotInRig`
                                        bloc Section 2 Raisonnement
                                        IA : filtre cot_step2 + cache
                                        sous-bloc si vide + cache la
                                        section entière si tout vide
src/app/screens/HomeScreen.jsx          +import resolveDisplayGuitar,
                                        filterCotGuitarsToRig
                                        Refactor du bloc songResult
                                        (4 vars → 3) en utilisant
                                        resolveDisplayGuitar strict.
                                        3 sites mis à jour :
                                        Raisonnement IA, Reco idéale
                                        Guitare, Paramétrage choix.
```

### Conséquences Phase 7.65.1

- **1069 tests verts**.
- **Pas de bump STATE_VERSION** (purement display).
- **Pas de migration**.
- **Pas de modif aiCache** : les caches Bruno/autres restent
  valides. Filtrage au render → effet immédiat au reload v8.14.104.
- **Cas-cible Bruno post-fix** :
  - "The Final Countdown" vue dépliée → onglet Raisonnement IA
    "Scoring guitares" affiche uniquement Schecter 78%
    (raison : "Idéale pour le confort de jeu sur le solo
    technique"). Plus de Strat 92% ni LP 85%.
  - Si la cot_step2 IA ne mentionne AUCUNE guitare du rig → la
    sous-section "Scoring guitares" se cache complètement. Si en
    plus pas de cot_step1 ni cot_step3_amp → toute la section
    "🧠 Raisonnement IA" se cache.

### Dette résiduelle Phase 7.65.1

- **Textes IA en prose** (`song_desc`, `guitar_reason`,
  `cot_step3_amp`, `settings_preset`, `settings_guitar`) peuvent
  encore mentionner des guitares hors rig par leur nom (la prose
  est générée IA, non structurée). Pas filtrable mécaniquement.
  Acceptable car ces champs ne sont pas le vecteur principal du
  bug perçu — c'est le rendu tabulaire structuré (cot_step2) qui
  faisait le plus mal.
- **RecapScreen + LiveScreen + SynthesisScreen + JamScreen** :
  aucun n'a de rendu structuré de cot_step2_guitars (cf audit
  Phase 7.65). Pas touchés.
- **`localGuitarSongScore` est encore utilisé en pratique** quand
  l'IA pin une guitare du rig non listée dans cot_step2 (cas rare).
  Le score fallback `localGuitarSongScore` étant calculé
  localement, il ne fuite pas de guitare. Pas de risque ici.

---

## État précédent (2026-05-18, Phase 7.65 close — vue repliée ListScreen filtre guitare sur rig actif)

**Backline v8.14.103 / SW backline-v203 / STATE_VERSION 10 / 1062 tests verts.**

### Phase 7.65 — Vue repliée ListScreen filtre guitare sur rig actif (v8.14.103)

**Bug confirmé** sur le profil non-admin Bruno (rig = Schecter C-1
Platinum HB + Ibanez Gio miKro HB) : pour "The Final Countdown",
la vue repliée affichait `Strat AM Vintage II 61 (SC) 92%` — une
guitare du rig admin Sébastien, hors rig actif. Pour "For Whom the
Bell Tolls", aucune guitare affichée (nom hors catalog GUITARS).

**Cause racine** : Phase 3.6 (cf section "AI cache — guitar list")
fait que le prompt IA reçoit l'UNION des rigs de tous les profils.
Donc `aiCache.result.ideal_guitar` et `cot_step2_guitars[].name`
peuvent référencer une guitare absente du rig actif. Phase 7.32
avait déjà fixé ce problème dans la vue **dépliée**
(SongDetailCard.jsx via helper local `displayIdealGuitarName`).
La vue **repliée** (ListScreen → bloc badge guitare juste avant
SongCollapsedDeviceRows) n'avait pas ce filtrage : si `g` (résolu
depuis `gId = savedGId || ig[0]`) finissait par référencer une
guitare partagée via `setlist.guitars[songId]` (Phase 5.8 partage
de setlists entre profils), elle était affichée brute. Symétrique
côté fallback `aiC?.ideal_guitar` : nom string rendu tel quel.

**Fix Phase 7.65 (purement d'affichage, scoring V9 et aiCache
intacts)** :

1. **Nouveau helper `resolveDisplayGuitar(aiC, rigGuitars, options?)`**
   dans `src/app/utils/display-guitar.js`. Ordre de préférence :
   - Étape 1 : `aiC.ideal_guitar` matche le rig → cette guitare
     (score : cot_step2.score si présent, sinon
     `localGuitarSongScore`).
   - Étape 2 : premier `cot_step2_guitars[i]` dont `name` matche
     le rig → cette guitare (score : `cot.score`, fallback
     `localGuitarSongScore`).
   - Étape 3 : `fallbackToFirst: true` (défaut) → 1ère guitare du
     rig. `fallbackToFirst: false` → `null` (Phase 7.32 préserve
     son comportement "cache la ligne").
   - Source explicite (`'ideal' | 'cot' | 'fallback' | null`) pour
     que l'appelant marque ou non "idéal" dans l'UI.

2. **ListScreen vue repliée** (`src/app/screens/ListScreen.jsx`
   lignes ~662) : `g` validé `g && rig.some(r => r.id === g.id)`
   AVANT de l'utiliser ; sinon `resolveDisplayGuitar` (rig-in
   strict + fallback rig[0]). Plus aucune affichage de
   `aiC.ideal_guitar` brut.

3. **SongDetailCard** (DRY) : le bloc Phase 7.32 inline
   (lignes 137-150 avant fix) est remplacé par un appel
   `resolveDisplayGuitar(aiC, guitars, { fallbackToFirst: false })`
   qui préserve exactement le comportement Phase 7.32 (la ligne
   "Guitare" se cache si rien dans l'aiCache ne matche le rig).
   Edge case bug latent Phase 7.32 corrigé en passant : si
   `aiC.ideal_guitar` matche le rig mais n'a pas de cot entry, la
   ligne reste désormais visible (avant : disparaissait).

### Tests Phase 7.65 (15 nouveaux Vitest)

`src/app/utils/display-guitar.test.js` couvre :
- Étape 1 (match ideal_guitar) × 3 : match exact, match via
  `short`, fallback `localGuitarSongScore` si pas de cot entry.
- Étape 2 (cot_step2 dans le rig) × 2 dont **scénario bug Bruno
  reproduit** (ideal_guitar "Strat AM Vintage II 61" sur rig
  HB-only Schecter+Ibanez → bascule sur Schecter via cot match).
- Étape 3 (fallback rig[0]) × 3 : aiCache vide, cot toutes hors
  rig, aiC.cot_step2 absent.
- Option `fallbackToFirst: false` × 3 : null au lieu de rig[0],
  Étape 1 fonctionne quand même.
- Edge cases × 4 : rig vide, rigGuitars null, cot entries
  malformées (sans name / null / name vide), cot score 0 préservé.

Stub `window.__allGuitars` via `beforeAll/afterAll` pour que
`findGuitar` (core/guitars.js) résolve les guitares custom de test
(Schecter, Ibanez) qui ne sont pas dans le catalog statique.

### Architecture livrée Phase 7.65

```
src/main.jsx                            APP_VERSION 8.14.102 → 8.14.103
public/sw.js                            CACHE backline-v202 → backline-v203
src/app/utils/display-guitar.js         NOUVEAU — resolveDisplayGuitar
                                        helper pur (Étapes 1/2/3 +
                                        fallbackToFirst option)
src/app/utils/display-guitar.test.js    NOUVEAU — 15 tests Vitest
src/app/screens/ListScreen.jsx          +import resolveDisplayGuitar
                                        vue repliée : g validé in-rig
                                        avant usage, sinon helper
                                        + fallback rig[0]
src/app/screens/SongDetailCard.jsx      +import resolveDisplayGuitar
                                        bloc Phase 7.32 refactor →
                                        appel helper { fallbackToFirst:
                                        false } (DRY)
```

### Conséquences Phase 7.65

- **1062 tests verts** (1047 + 15 nouveaux).
- **Pas de bump STATE_VERSION** (purement UI display, scoring V9
  inchangé).
- **Pas de migration localStorage**.
- **Pas de modif aiCache** : les caches existants Bruno/autres
  restent valides. Le filtrage s'applique au render → effet
  immédiat au reload v8.14.103.
- **Cas-cible Bruno post-fix** :
  - "The Final Countdown" → badge devient
    `Schecter C-1 Platinum (HB)` (1ère cot_step2 dans rig) avec
    score cot ou fallback local, plus jamais
    `Strat AM Vintage II 61 (SC)`.
  - "For Whom the Bell Tolls" (ideal_guitar hors catalog) →
    badge affiche soit la première cot_step2 dans rig, soit
    `Schecter C-1 Platinum` en fallback rig[0] (avec marker
    `source: 'fallback'`).

### Dette résiduelle Phase 7.65

- **Fix B reporté Phase 7.66** : ne pas toucher au prompt fetchAI
  ni à `getAllRigsGuitars` Phase 7.65 — c'était délibéré. Le bug
  de fond reste : l'IA voit l'union all-rigs et peut proposer
  des guitares hors rig. Phase 7.66 (proposée, pas démarrée)
  réfléchira à passer le rig actif **uniquement** au prompt pour
  les profils non-admin (trade-off avec Phase 3.6 union pour
  enrichir le cache cross-profils).
- **Autres écrans audités** : RecapScreen (déjà OK, filtre via
  `findGuitarByAIName(aiG, guitars)` + drop si null),
  SynthesisScreen / JamScreen / LiveScreen (aucun affichage
  guitare basé sur aiCache.ideal_guitar). **HomeScreen ligne 510**
  a un fallback latent (`idealGuitarObj = idealGuitarCot ||
  songResult.cot_step2_guitars?.[0]`) qui pourrait laisser passer
  une guitare hors rig dans le rendu — à scope Phase 7.65.x si
  observé. Pas inclus dans ce commit (vue repliée ListScreen
  exclusivement).

---

## État précédent (2026-05-17, Phases 7.54.x → 7.62 close — sync stable + landing publique + snapshot démo balance pack creators + fix critique sync activeProfileId)

**Backline v8.14.102 / SW backline-v202 / STATE_VERSION 10 / 1047 tests verts.**

Session 2026-05-17 = **29 phases livrées en 34 deploys prod**.
Sync bilatérale Mac↔iPhone validée avec push WITH aiCache stable,
pin customs IA fonctionnel via post-processing tolérant, mode démo
durci, UI épurée. **Protections défensives Phase 7.59** ajoutées
suite à pollution profile cross-mélange observée. **Phase 7.60**
sort le premier morceau de la stratégie de conversion publique
(landing pour first-time visitors + ThanksScreen post-Tally).
**Phase 7.60.1** finalise le snapshot démo avec un balance 4 pack
creators à parité, en vue d'envoi à Paul Drew (TSR) et autres
peer-creators. **Phase 7.60.2** corrige le wording FR DemoBanner
("ta rig" → "ton matériel"). **Phase 7.62** fixe un bug
architectural critique : `activeProfileId` était synced via
Firestore et causait des bascules involontaires cross-device entre
beta-testeurs (manifesté Sébastien Mac ↔ Francisco iPhone le
17 mai soir).

**Premier feedback beta-tester Francisco reçu le 17 mai soir** :
3 retours qualitatifs en 1h (bug Get Lucky family match → Phase
7.64, knob settings chiffrés → Phase 9 promue validée 2 signaux
indépendants, pédales → Phase 8 validée par 2e mention). Réponse
combinée Sébastien envoyée, conversation positive et chaleureuse.

### Phase 7.60.1 — Snapshot démo balance 4 pack creators (v8.14.100)

Suite à un constat 2026-05-17 : le snapshot démo Phase 7.55-A avait
11 morceaux dont **8 recos AA + 1 JS + 2 fallback** (aucun TSR
visible). Lecture possible par un cofondateur TSR (Paul Drew) :
"Backline est AA-first". Signal involontaire à éviter avant l'envoi
DM démo.

**Démarche** : fine-tuning itératif de la setlist démo sur le profil
curateur `demo_1778839429588`. Tentatives :

- Voodoo Child (Hendrix) → pin AA MRSH SL100 (Hendrix usages
  explicit AA Premium gagne sur TSR Mars Super1100)
- For Whom the Bell Tolls → pin AA MES MKIICP (Metallica usages
  explicit AA gagne)
- Aces High (Iron Maiden) → pin AA MRSH JC800 (Marshall générique,
  scores HB AA Premium curés > TSR)
- Holy Wars (Megadeth) → pin AA PV 5050 LD (idem)

**Constat structurel** : la curation Phase 7.52 d'AA Premium a
optimisé les scores HB pour gagner par défaut sur metal/hard rock
générique. Seuls les artistes **sans AA Premium dans usages**
permettent à TSR de pin :
- **Tool / SOAD** (aucun AA Premium n'a Tool/SOAD) → Chop Suey
  (SOAD) pin `TSR Rectified - Vintage 2`, Schism (Tool) pin
  `TSR Rectified - Modern 1`.

**Setlist finale 8 morceaux (balance parfait 2-2-2-2)** :

| Style | Morceau | Reco |
|---|---|---|
| Hard rock | AC/DC — Back in Black | AA MRSH JT50 |
| Blues clean | B.B. King — The Thrill Is Gone | AA FNDR BFTWN |
| Rock | Eagles — Hotel California | JS Wrecked Z Push 1 |
| Blues SC | SRV — Pride and Joy | JS Sir Ombre Ult Push 1 |
| Hard rock | Deep Purple — Smoke on the Water | TJ 74 Purple Plexi |
| Jazz/blues | Robben Ford — Help the Poor | TJ DMBL ODS 124 LEAD 1 |
| Metal | SOAD — Chop Suey | TSR Rectified - Vintage 2 |
| Metal/prog | Tool — Schism | TSR Rectified - Modern 1 |

**Balance** : 2 AA / 2 JS / 2 TJ / 2 TSR = 25% chacun. Message
diversité 4 pack creators visible immédiatement par tout visiteur
démo. AA passe de 73% (Phase 7.55-A) à 25%.

**ToneX Plug retiré** du profil curateur démo (`enabledDevices`
passe de `['tonex-anniversary', 'tonex-plug']` à `['tonex-anniversary']`).
1 device suffit pour épurer les fiches du visiteur démo (1 colonne
reco au lieu de 2). Les visiteurs avec ToneX Plug pourront tester
via leur propre profil après onboard.

### Architecture livrée Phase 7.60.1

```
src/data/demo-profile.json   Re-exporté depuis le profil curateur
                             demo_1778839429588 avec :
                             - 8 morceaux setlist (vs 11 Phase 7.55-A)
                             - profile.enabledDevices = ['tonex-anniversary']
                               (Plug retiré)
                             - profileIds = ['demo', 'demo_1778839429588']
                               (curateur préservé Phase 7.52.16)
                             - 21 entries profile.aiCache (8 setlist
                               + reliquats des morceaux retirés en cours
                               de session)
src/main.jsx                 APP_VERSION 8.14.99 → 8.14.100
public/sw.js                 CACHE backline-v199 → backline-v200
```

### Conséquences Phase 7.60.1

- **1047/1047 tests verts** (snapshot ne casse aucun test, juste
  data).
- **Bundle** 2351.16 → 2360.22 KB (+9 KB pour snapshot enrichi).
- **Pas de bump STATE_VERSION** (v10 préservée).
- **Pas de migration** (snapshot data uniquement).
- **Cohabitation** : un client pré-7.60.1 reçoit le nouveau snapshot
  au prochain mount mode démo → 8 morceaux affichés. Pas de risque.

### Dette résiduelle Phase 7.60.1 → 7.61

- **Rename guitares vers noms complets** identifié pendant la
  session : `Strat AM Vintage II 61` → `Fender Stratocaster American
  Vintage II 1961` (et 10 autres). Avant rename, il faut **rendre
  `matchGuitarName` plus tolérant** (`src/core/scoring/guitar.js:212`)
  pour ne pas casser les aiCache existants qui contiennent les
  anciens noms dans `cot_step2_guitars[].name`. Risque rétro-compat :
  un aiCache historique avec `"Strat AM Vintage II 61"` dans
  cot_step2_guitars ne matcherait plus la guitare strat61 si `name`
  change. Solution Phase 7.61 : tokenize set words dans
  `matchGuitarName` (ex: "strat 1961" match "fender stratocaster
  american vintage ii 1961"), puis rename les 11 guitares, puis
  re-export snapshot démo.
- **Ellipses (...) sur badges preset en desktop** (ListScreen) :
  `maxWidth: 220` hardcoded ligne 620 → tronque en desktop alors
  qu'il y a 800+px dispo. Fix simple Phase 7.61 :
  `maxWidth: 'clamp(200px, 35vw, 500px)'` responsive.
- **Audit codes couleur badges vue repliée setlist** (rapporté
  2026-05-17 par Sébastien) : plusieurs systèmes de couleur se
  mélangent dans `SongCollapsedDeviceRows` / ListScreen vue repliée
  : `StatusDot` (couleur basée sur score + ideal), badge bank+slot
  (`badgeColor` dépendant du device), badge label preset (`scColorV`
  dépendant de quoi ?), badge score (couleur basée sur seuil score).
  Logique pas cohérente, sources de couleur hérités de phases
  différentes sans audit global. Sébastien ne comprend pas la règle
  → si le créateur ne pige pas, les visiteurs encore moins. Phase
  7.61 : audit complet + définir 1 règle claire et homogène (par
  exemple : tout le badge prend la même couleur basée sur
  `scoreLabel(sc)` qui retourne déjà une couleur cohérente cf
  Phase 7.50). Tester sur les 8 morceaux de la démo + sur une
  setlist Bruno-style pour valider visuellement.

### Phase 7.60.2 — Wording fix FR DemoBanner (v8.14.101)

Modif texte mineure sur `src/app/components/DemoBanner.jsx` :
*"Pour avoir ton propre profil avec ta rig"* → *"...avec ton
matériel"*. "Rig" est un anglicisme et "ta rig" est
grammaticalement bancal en FR. EN garde "your rig" (terme guitar
OK en anglais), ES inchangé ("tu equipo" déjà correct).

1 ligne modifiée + bump APP_VERSION + SW CACHE. Pas de modif data,
pas de bump STATE_VERSION.

### Phase 7.62 — Fix critique sync activeProfileId (v8.14.102, LIVRÉ 2026-05-17)

**Bug architectural latent** depuis Phase 5.x : `activeProfileId`
était synced via Firestore alors qu'il devrait être **LOCAL-only par
device**. Manifestation découverte 2026-05-17 le soir avec
multi-device cross-user (Sébastien Mac + Francisco iPhone) :
Sébastien Mac rebascule tout seul sur Francisco après pull
Firestore quand Francisco est actif sur son device.

**Cause précise** :
- `main.jsx:1118` `applyRemoteData` faisait
  `setActiveProfileId(data.activeProfileId)` au pull
- `firestore.js` `saveToFirestore` push contenait `c.activeProfileId`
  au top level
- Cycle ping-pong cross-device : A push activeProfileId='X', B pull
  → bascule sur X, B push activeProfileId='Y', A pull → bascule sur
  Y... selon le dernier writer

**Fix livré (3 changements défensifs)** :
1. `firestore.js` `prep()` : `delete c.activeProfileId` avant push
   (strippe pour TOUTES les call sites de saveToFirestore)
2. `main.jsx:1118` : retire le `setActiveProfileId(data.activeProfileId)`
   du pull (ignore la valeur remote, garde locale)
3. `main.jsx:1152` : retire `activeProfileId` du push initial
   (cosmétique, strippé en prep de toute façon)

**Cohabitation** : un client pre-7.62 peut encore push activeProfileId,
mais les clients post-7.62 ignorent au pull (no-op). Pas de bump
STATE_VERSION (additif/retrait sync, pas schéma).

**Effet attendu** : Sébastien Mac reste sur son profil Sébastien
peu importe ce que Francisco / Bruno font sur leurs devices. Pareil
inversement pour eux.

**Limite résiduelle non bloquante** : `activeProfileId` reste pourtant
visible dans le state Firestore historique tant qu'un client pre-7.62
n'a pas fait de modif (qui purgerait le champ via le nouveau prep()).
Sébastien peut forcer la purge en faisant 1 modif quelconque sur
chaque device après reload v8.14.102.

### Phase 7.65 — ✅ LIVRÉE 2026-05-18 (v8.14.103)

Bug rapporté par Bruno 2026-05-18 matin fixé le même jour. Voir
section "État actuel (2026-05-18)" en tête de CLAUDE.md pour le
détail (helper `resolveDisplayGuitar`, refactor ListScreen +
SongDetailCard DRY, 15 tests Vitest, audit RecapScreen /
SynthesisScreen / JamScreen / LiveScreen).

Notes design conservées pour référence :

- Helper partagé `src/app/utils/display-guitar.js` (préféré à un
  inlining dupliqué). 3 étapes : `ideal_guitar` matche rig → premier
  `cot_step2` matche rig → fallback rig[0] (option
  `fallbackToFirst: false` pour Phase 7.32 strict).
- HomeScreen ligne 510 a un fallback latent (`idealGuitarObj =
  idealGuitarCot || songResult.cot_step2_guitars?.[0]`) qui pourrait
  laisser passer une guitare hors rig — à scope **Phase 7.65.1** si
  observé, ~10 min même helper.

### Dette résiduelle Phase 7.66 — Prompt fetchAI passe rig profil actif (Fix B, plus profond, plus risqué)

Phase 7.65 (Fix A) traite le symptôme (l'affichage). Phase 7.66
(Fix B) traite la cause racine : le prompt IA reçoit l'union all-rigs
(Phase 3.6) et l'IA peut donc proposer une guitare hors rig actif
dans `ideal_guitar` ou `cot_step2_guitars[0]`.

**Solution proposée Phase 7.66** :

1. Modifier `getAllRigsGuitars` (dans `core/state.js`) ou le call
   site dans `fetchAI` pour passer uniquement le rig du profil actif
   (+ ses customs perso) au prompt.
2. **Risque rétro-compatibilité** : un profil non-admin qui ajoute
   une custom guitar devra attendre un recalcul pour la voir dans
   les recos (avant, l'union all-rigs lui donnait visibilité
   immédiate via les caches partagés Phase 3.6).
3. **Compensation** : ajouter un trigger automatique de recalcul
   `aiCache` à l'ajout d'une custom guitar (invalidation per-song)
   pour conserver l'esprit Phase 3.6 (custom guitars visibles dès
   ouverture). Couplé à Phase 7.67 (édition rig non-admin) si
   livrées ensemble.
4. Tests Vitest sur le cas "rig user contient Schecter+Ibanez,
   prompt IA ne mentionne PAS Strat AM Vintage II 61 (Sébastien)".
5. Validation manuelle sur profils Bruno et Francisco.

**Effort estimé** : ~2-3h dev + tests + deploy. Plus risqué que
Phase 7.65 car touche au cœur du prompt IA et casse partiellement
Phase 3.6.

**Décision actuelle** : Phase 7.65 (Fix A) livrée 2026-05-18 →
visuellement Bruno est débloqué. Phase 7.66 reportée après Phase
7.67 (édition rig non-admin). À déclencher quand au moins un autre
beta-tester non-admin remontre le même bug racine que Bruno
(signal d'urgence suffisant), ou si on observe en pratique des
recos hors-rig persistantes qui dégradent la confiance utilisateur
malgré le filtrage d'affichage Phase 7.65.

### Phase 7.67 — ✅ LIVRÉE 2026-05-18 (v8.14.111) — Édition rig par non-admin

Voir section "État actuel (2026-05-18)" en tête de CLAUDE.md pour le détail (3 changements : custom guitars non-admin, MyCustomPacksTab, Export/Import CSV non-admin + preview).

**Notes design conservées pour référence** :

### Dette résiduelle Phase 7.67 (historique) — Édition rig par non-admin (rapporté Bruno 2026-05-18)

Bruno demande explicitement : *"à voir pour l'utilisateur comment
ajouter ses presets manuellement, sans que cela soit trop fastidieux"*.

**Contexte** : Phase 7.29.4 gate les tabs admin (Sources, ToneNET,
Maintenance, ProfilesAdmin) et l'édition de custom guitars +
customPacks aux profils admin uniquement. Un beta-tester non-admin
peut consulter son rig mais pas l'éditer. C'est pénible pour un user
engagé qui veut affiner sa configuration sans solliciter l'admin.

**Solution proposée Phase 7.67** :

1. Permettre à un non-admin d'éditer SON propre `profile.myGuitars`
   (toggle des guitares dans le catalog standard) — déjà fait Phase
   7.29.4 (`ProfileTab` toggle ouvert) ?
2. Permettre à un non-admin d'éditer SES propres `profile.customPacks`
   (mais pas ceux des autres) — actuellement gated admin, à ouvrir.
3. Permettre à un non-admin d'éditer SES propres `profile.customGuitars`
   (mais pas le catalog `shared.customGuitars` partagé) — actuellement
   gated admin, à ouvrir avec garde-fou per-profile.
4. Wizard onboarding 3 étapes (Matériel / Guitares / Setlist) à la
   première connexion d'un profil non-admin sans devices ni guitares
   (cf Phase 7.48 T8 dette différée).

**Effort estimé** : ~3-4h dev + tests + UX validation. Couplé
potentiellement à Phase 7.66 (Fix B) qui ajoute un trigger recalc
automatique à l'ajout custom.

**Décision actuelle** : proposée, à activer si Bruno (ou autre
beta-tester) demande activement à éditer son rig pendant les
prochains jours. Sinon, reporter Phase 8+.

### Phase 7.47 V1 firmware — ❌ ABANDONNÉE 2026-05-18 soir

Décision Sébastien post-validation Phase 7.65.x + 7.68 : "j'ai
l'impression que tout le monde a updaté" → le firmware V1
historique pré-avril 2025 n'a plus de population d'utilisateurs
actifs identifiée. Bruno (qui était le seul cas suspect) tournait
finalement avec stale `profile.banksPedale` héritée pré-Phase 7.47,
pas un vrai V1 hardware.

Le placeholder `FACTORY_BANKS_PEDALE_V1 = {}` reste dans
`data_catalogs.js` comme no-op safe (le dropdown firmware
BankEditor reste désactivé pour V1, comportement attendu). Aucune
action à entreprendre.

À réactiver UNIQUEMENT si un futur beta-tester confirme un
hardware V1 (ToneX Pedal classique acheté pré-avril 2025 jamais
updaté) ET demande explicitement le support. Probabilité faible
— IK Multimedia pousse les updates firmware via leur software
companion automatiquement.

**Notes design conservées pour référence** :

Bruno rapporte un **décalage banks Factory Pedal** (VX30 éclaté sur
banks 5 et 6 au lieu d'être consolidé sur une bank, WRECK éclaté
sur banks 6-7, etc.). Hypothèse forte : **Bruno a un firmware V1**
(Pedal classique achetée avant avril 2025) — son mapping factory
réel diffère de `FACTORY_BANKS_PEDALE_V2` livré Phase 7.47.
**Réfuté ultérieurement** : Bruno avait juste un stale
`profile.banksPedale` héritée d'une session pré-Phase 7.47, fixé
par reset banks via console.

Phase 7.47 a livré V2 conforme PDF officiel 2025/04/03 et un
placeholder `FACTORY_BANKS_PEDALE_V1 = {}` (liste à fournir). Si
Bruno confirme V1 + envoie ses banks 0/25/49 (comme Francisco l'a
fait pour V2), c'est l'opportunité de **remplir le mapping V1
manquant** depuis un user réel. [Cf décision ci-dessus : abandonné.]

### Phase 7.68 — ✅ LIVRÉE 2026-05-18 (v8.14.110) — Bug investigation P2 (recos Accueil vs Setlists)

Voir section "État actuel (2026-05-18)" en tête de CLAUDE.md pour le détail (cleanup presets cached avant enrichAIResult dans `HomeScreen.handleSongConfirm` + validation `cachedGId` in-rig + fallback `ig[0]`).

**Notes design conservées pour référence** :

### Bug investigation P2 (historique) — Reco différentes Accueil vs Setlists (rapporté Bruno 2026-05-18)

Bruno rapporte : *"pour un même morceau j'ai parfois des reco
différentes entre la page de garde et quand je passe par le setlist.
En particulier si je ne choisis pas de guitare dans l'onglet
setlist."*

**Hypothèses à investiguer** :
- L'Accueil utilise un fallback différent (random guitare ? première
  du rig ?) quand `gId` est vide, vs Setlists qui attend une sélection
  explicite.
- Le `rigStale` Phase 7.48 T10 peut forcer un re-fetch dans un cas
  et pas dans l'autre (Accueil rebondit sur l'aiCache, Setlists
  recompute).
- Possiblement lié à la dérivation `effectiveGuitarBias` Phase 7.9 :
  une bias `style→guitar` peut s'appliquer différemment selon le
  contexte (Accueil avec recherche libre vs Setlists avec setlist
  contextuelle).

**Plan d'investigation** :
1. Reproduire le bug sur le profil Bruno (sans choisir de guitare
   explicite, comparer la reco Accueil pour "Self Esteem" vs reco
   Setlists pour le même morceau).
2. Logger `gId` initial dans les deux flows.
3. Décider du comportement canonique attendu (probablement : si
   `gId` vide → fallback `ideal_guitar` filtré rig actif Phase
   7.32).

**Effort estimé** : ~1-2h investigation + fix si bug confirmé.
Phase 7.65 livrée 2026-05-18 — peut maintenant être démarrée si
Bruno reconfirme le bug post-déploiement v8.14.103.

### Phase 7.65.x — ✅ LIVRÉE 2026-05-18 PM (v8.14.106) — Fix useMemo customPacks copie le champ `usages`

**Cause racine identifiée** : l'useMemo `main.jsx` Phase 7.30 (ligne ~690) qui synchronise `profile.customPacks` dans `PRESET_CATALOG_MERGED` **ne recopiait pas le champ `usages`**. Donc :
- `findCatalogEntry("Kirk & James - Gasoline v2")` retournait une entry sans `usages`.
- `buildInstalledSlotsSection` (Phase 7.52.1) ne sérialisait pas les usages au prompt IA.
- `findSlotByUsageMatch` (Phase 7.52.5) ne matchait jamais sur les customs (la logique du helper était correcte, mais l'input `entry.usages` était toujours `undefined`).

Le pattern qui fonctionnait pour Blink-182 et Dr. Stein passait par PRIORITÉ 2 du prompt Phase 7.34 ("capture dont le NOM mentionne explicitement l'artiste/morceau") — totalement indépendant de `usages`. Les autres customs (Kirk & James pour Metallica, Maiden Pack pour Fear of the Dark) tombaient au fallback scoring V9 standard.

**Fix Phase 7.65.x (1 ligne effective)** dans `src/main.jsx` useMemo :
```js
if (Array.isArray(p.usages) && p.usages.length > 0) entry.usages = p.usages;
```
Ajout conditionnel pour ne pas polluer le catalog avec un champ vide (cohérent avec le pattern Phase 7.53 ToneNET ligne ~517).

**Audit complet livré** :
- `buildInstalledSlotsSection` (`fetchAI.js`) : OK, lit `info.usages` via `findCatalogEntry`. Aucune modif nécessaire.
- `findSlotByUsageMatch` (`ai-helpers.js`) : OK, logique de match correcte (artist exact + title exact case-insensitive). Aucune modif.
- `findCatalogEntryByUsages` (`ai-helpers.js`) : OK, scan `PRESET_CATALOG_MERGED` correctement.
- Prompt Phase 7.34 strict mode : pas trop strict — la PRIORITÉ 1 "capture dont les usages contiennent l'artiste/titre" fonctionne dès que les usages arrivent au prompt.

**Tests Vitest Phase 7.65.x (+8 nouveaux dans `ai-helpers.test.js`)** :
- Scénario bug Bruno reproduit : `findSlotByUsageMatch(banks{48:{A:"Kirk & James - Gasoline v2"}}, "Metallica", "For Whom the Bell Tolls")` → bank 48 col A score 100.
- Scénario bug Bruno reproduit : `findSlotByUsageMatch(banks{40:{B:"Maiden Pack | Fear Of The Solo"}}, "Iron Maiden", "Fear of the Dark")` → bank 40 col B score 100.
- Custom usages artist seul (titre pas dans songs) → score 50.
- Custom SANS usages → null (fallback scoring V9 standard prend le relais).
- Régression Phase 7.55 (factory Anniversary Premium avec usages) → toujours OK.
- Mélange customs + factory → cherche correctement les 2.
- `findCatalogEntryByUsages` sur customs → remonte dans `ideal_top3` (catalog scan, indépendant des banks installées).
- `availableSources={custom:false}` → custom skippé.

Setup tests : seed direct de `PRESET_CATALOG_MERGED` dans `beforeEach` (simule l'useMemo CORRECT) + cleanup `afterEach`. 1077/1077 tests verts globaux (1069 + 8).

**Architecture livrée Phase 7.65.x** :
```
src/main.jsx                            APP_VERSION 8.14.105 → 8.14.106
                                        useMemo customPacks Phase 7.30 :
                                        +ajout conditionnel entry.usages
                                        depuis p.usages
public/sw.js                            CACHE backline-v205 → backline-v206
src/app/utils/ai-helpers.test.js        +import beforeEach/afterEach +
                                        PRESET_CATALOG_MERGED
                                        +describe "Phase 7.65.x (customs
                                        avec usages)" (8 tests)
```

**Conséquences Phase 7.65.x** :
- 1077/1077 tests verts.
- Pas de bump STATE_VERSION (fix logique additif, schéma identique).
- Pas de migration : les `profile.customPacks` existants (Bruno avec usages enrichis) sont déjà compatibles. Le fix les rend simplement exploitables.
- Effet immédiat sur Bruno post-reload v8.14.106 : prochaine analyse IA de "For Whom the Bell Tolls" devrait pin 48A Kirk & James (PRIORITÉ 1 usages match), et "Fear of the Dark" devrait pin 40B Maiden Pack.

**Note historique — Étape 1 résolue séparément 2026-05-18 PM (via JS console DevTools)** :
Sébastien (Chrome MCP en mode admin Bruno) a enrichi
`profile.customPacks` Bruno avec `usages: [{artist, songs?}]` sur
les 34 presets banks 38-49. Couverture complète :
- 48A `Kirk & James - Gasoline v2` → usages Metallica (11 songs
  dont For Whom the Bell Tolls, Master of Puppets, One, Battery)
- 48B `Blink-182 Mesa Boggie` → usages Blink-182 (7 songs)
- 49C `TSR Mars 800SL Cn1&2 HG` → usages Iron Maiden + Metallica
- 40A/B `Maiden Pack | Fear Of The Clean/Solo` → usages Iron Maiden
  (Fear of the Dark)
- 39C `80s Pack | Bark at Dr. Stein` → usages Helloween (Dr. Stein)
- 47A `MRSH SLAFD AFD Drive WRM CAB ScD` → usages Guns N' Roses
- Etc.

Pack renommé `Bruno — Banks 38-49 (mix Amalgam + TSR + Galtone +
ToneNET + Peavey 5050 + Iron Maiden Pack + Metallica Ride The
Lightning + Helloween)`. Persisté Firestore (stamp `lastModified`),
sync OK vers les autres devices Bruno au prochain pull.

**Validation expérimentale après resolve étape 1 (avant Phase 7.65.x)** : pattern observé "pin fonctionne quand nom contient artiste/morceau littéralement, échoue sinon" → confirmé que Phase 7.34 PRIORITÉ 2 fonctionnait mais PRIORITÉ 1 (usages) était brisée par l'absence de copie du champ. Phase 7.65.x corrige.

---

### Bug investigation historique post-Phase 7.65 — customPacks Bruno usages Metallica (étape 1 ✅ résolue 2026-05-18 PM, étapes 2-3 ✅ résolues Phase 7.65.x ci-dessus)

Bruno rapporte que pour **For Whom the Bell Tolls** (Metallica),
l'IA recommande **DR VX30** (Vox AC30, Factory Pedal) en preset
idéal **alors que** :
1. L'analyse IA raisonne correctement "Mesa Mark IIC+ ou JCM800
   modifié".
2. Bruno possède 48A `Kirk & James - Gasoline v2` (custom Mesa
   Triple Rectifier signature Metallica), 49C `TSR Mars 800SL Cn1&2
   HG` (custom Marshall JCM800), 49B `Silver Jubilee 2555 HG`
   (Marshall).

Phase 7.34 (anti cross-contamination) devrait précisément pinner
48A Kirk & James pour Metallica. Les 3 causes possibles identifiées
initialement :
- `profile.customPacks` de Bruno ne contient pas les metadata
  `usages` Metallica pour 48A (vérifier ses customPacks)
- Phase 7.34 strict mode filtre "Kirk & James" car ce nom ne mentionne
  pas "Metallica" littéralement
- Le post-processing Phase 7.55 `findSlotByUsageMatch` ne match pas
  faute de champ `usages` rempli côté customPack Bruno.

**Étape 1 — ✅ résolue 2026-05-18 PM via JS console DevTools** :
Sébastien (via Chrome MCP en mode admin Bruno) a enrichi
`profile.customPacks` Bruno avec `usages: [{artist, songs?}]` sur
les 34 presets banks 38-49. Couverture complète :
- 48A `Kirk & James - Gasoline v2` → usages Metallica (11 songs
  dont For Whom the Bell Tolls, Master of Puppets, One, Battery)
- 48B `Blink-182 Mesa Boggie` → usages Blink-182 (7 songs)
- 49C `TSR Mars 800SL Cn1&2 HG` → usages Iron Maiden + Metallica
- 40A/B `Maiden Pack | Fear Of The Clean/Solo` → usages Iron Maiden
  (Fear of the Dark)
- 39C `80s Pack | Bark at Dr. Stein` → usages Helloween (Dr. Stein)
- 47A `MRSH SLAFD AFD Drive WRM CAB ScD` → usages Guns N' Roses
- Etc.

Pack renommé `Bruno — Banks 38-49 (mix Amalgam + TSR + Galtone +
ToneNET + Peavey 5050 + Iron Maiden Pack + Metallica Ride The
Lightning + Helloween)`. Persisté Firestore (stamp `lastModified`),
sync OK vers les autres devices Bruno au prochain pull.

**Validation expérimentale après resolve étape 1** : re-fetch IA
des 6 morceaux setlist Bruno via "🤖 Analyser/MAJ 6". Pattern net
observé :
- **Pin custom fonctionne quand le nom du preset contient
  LITTÉRALEMENT l'artiste/morceau** :
  - All the Small Things (Blink-182) → 48B `Blink-182 Mesa Boggie`
    90% ✅ (nom contient "Blink-182")
  - Dr. Stein (Helloween) → 39C `80s Pack | Bark at Dr. Stein`
    96% ✅ (nom contient "Dr. Stein")
- **Pin custom échoue quand il doit passer UNIQUEMENT par les
  `usages`** :
  - For Whom the Bell Tolls (Metallica) → toujours 2B `HG 515S`
    Factory v2 92% ❌ (Kirk & James 48A pas pinné malgré usages
    explicit Metallica "For Whom the Bell Tolls")
  - Fear of the Dark (Iron Maiden) → toujours 2B `HG 515S` 94% ❌
    (Maiden Pack 40A/B pas pinné malgré usages Iron Maiden "Fear
    of the Dark")

Donc la cause racine restante est dans **le code Backline** :
soit Phase 7.34 strict (cause 2), soit findSlotByUsageMatch
(cause 3), soit useMemo Phase 7.31 qui ne copie pas
`pr.usages → catalog[name].usages`, soit
buildInstalledSlotsSection Phase 7.52.1 qui ne sérialise pas
les usages des customPacks au prompt.

**Étapes 2-3 — déléguées à Claude Code (prompt envoyé 2026-05-18 PM)** :
Claude Code va investiguer en local pour identifier le site exact
du bug (entre `main.jsx` useMemo Phase 7.31,
`src/app/utils/fetchAI.js` buildInstalledSlotsSection Phase 7.52.1,
`src/app/utils/ai-helpers.js` findSlotByUsageMatch Phase 7.55, et
fetchAI prompt Phase 7.34 strict mode). Phase 7.65.x à livrer
avec tests Vitest dédiés.

**Effort estimé livraison Claude Code** : ~1-2h (investigation +
fix + tests + bump APP_VERSION + commit).

### Pitfall renforcé — Pré-calcul aiCache depuis profil admin (preuve concrète Bruno 2026-05-18)

Le pitfall documenté dans BETA_TESTING.md section 6 ("Lancer
'Analyser/MAJ' depuis profil Sébastien admin → cache pollué") a une
**preuve concrète** depuis le 2026-05-18 : la vue repliée du profil
Bruno affiche "Strat AM Vintage II 61" pour The Final Countdown
alors que Bruno n'a que Schecter + Ibanez Gio dans son rig. La Strat
AM Vintage II 61 vient du rig admin Sébastien et était dans la liste
prompt union all-rigs (Phase 3.6) au moment du pré-calcul.

**Renforcement procédure onboarding** :
- TOUJOURS switcher sur le profil du beta-tester AVANT de lancer
  "🤖 Analyser/MAJ N" (déjà documenté en section 6, à durcir avec
  warning visuel optionnel "tu es admin, en mode 'Analyser/MAJ' tu
  pollues les caches du profil cible si tu n'es pas en bascule").
- En cas de pollution constatée, scope l'invalidation au profil
  affecté via Phase 7.33 ("🔄 Réinitialiser MES analyses" depuis
  le profil actif).

### Pitfall onboarding renforcé — Enrichir customPacks avec `usages` dès la création (2026-05-18 PM)

Au-delà du pré-calcul aiCache, la session 2026-05-18 PM a révélé
un 2e pitfall onboarding critique : créer les `profile.customPacks`
d'un beta-tester SANS le champ `usages: [{artist, songs?}]` rend
le pin custom Phase 7.31 / 7.55 strictement dépendant de la
présence littérale de l'artiste/morceau dans le NOM du preset.

**Conséquence pratique** : si le nom du preset est neutre (ex.
"Kirk & James - Gasoline v2" pour Metallica, "Maiden Pack | Fear
Of The Solo" pour Iron Maiden Fear of the Dark), le pin échoue
même quand l'IA a tout pour décider correctement (analyse de
l'ampli historique + capture dans le rig). C'était le cas de
Bruno avant 2026-05-18 PM.

**Procédure recommandée future** (à intégrer
BETA_ONBOARDING.md + workflow Vision IA Tab Packs) :
- À chaque création / import d'un customPack, vérifier que **chaque
  preset a un champ `usages`** quand le contexte le permet (capture
  signature artiste, capture dédiée morceau, capture sur album
  spécifique).
- Format `[{artist: "Metallica", songs: ["For Whom the Bell Tolls",
  ...]}, {artist: "Kirk Hammett"}, {artist: "James Hetfield"}]`.
- Peut être fait via Vision IA (extraction du nom du pack) ou
  manuel. Pour les ToneNET, Phase 7.53 a livré l'UI éditable côté
  profil utilisateur.
- Pour les customs admin-only (Galtone, Amalgam, etc.), penser à
  les enrichir lors de l'onboarding plutôt qu'après coup (évite
  un re-fetch IA correctif).

**Note technique** : Phase 7.65.x ✅ livrée 2026-05-18 PM
(v8.14.106) — l'useMemo `main.jsx` Phase 7.30 recopie désormais
le champ `usages` au passage `profile.customPacks` →
`PRESET_CATALOG_MERGED`, débloquant `buildInstalledSlotsSection`
(prompt PRIORITÉ 1) et `findSlotByUsageMatch` (post-process pin
de slot). À partir de v8.14.106, les `usages` enrichis suffisent
seuls — le code Backline les exploite correctement pour les
customs. Voir section "Phase 7.65.x — ✅ LIVRÉE" plus bas pour
le détail technique du fix.

### Phase 7.64 — ✅ LIVRÉE 2026-05-18 (v8.14.107) — Bonus family match Strat/Tele/LP

Livrée couplée à Phase 7.61 (rename guitares vers noms complets) pour 1 seul tour de validation IA. Voir section "État actuel (2026-05-18)" en tête de CLAUDE.md pour le détail (helper `getGuitarFamily`, bonus +15 dans `enrichAIResult` idempotent via flag `_familyBoosted`, 47 tests Vitest dont scénario Francisco Get Lucky reproduit).

**Notes design conservées pour référence** :

Francisco a écrit ce soir (17 mai, après ses tests post-weekend) :
*"En Daft Punk - Get Lucky la IA me elegía la Telecaster (Sire T7)*
*en lugar de la Squier Stratocaster, aunque Nile Rodgers toca Strat.*
*Quizá si simplificásemos por el tipo de guitarra se pueden evitar*
*estos errores. Como la meta es buscar el sonido original, la marca*
*o modelo no es vital — la familia importa más."*

**Constat** : il a raison. Le scoring V9 actuel
(`computeGuitarScoreV2` dans `src/core/scoring/guitar.js`) compare
les caractéristiques techniques (pickup type, body shape, scores
HB/SC/P90) mais n'a **pas de notion explicite de family**
(Stratocaster vs Telecaster vs Les Paul vs SG vs ES-335 vs
Jazzmaster). Conséquence : si la chanson originale est jouée sur
Strat et que le rig user a 2 guitares SC (Strat + Tele), le scoring
peut préférer la Tele pour des raisons secondaires.

**Solution proposée Phase 7.64** :

1. Helper `getGuitarFamily(name)` retourne `'stratocaster' | 'telecaster' | 'les_paul' | 'sg' | 'es335' | 'jazzmaster' | 'other'`
   via regex/keywords sur le nom (ou via `brand+name` pour les Sire/Squier/etc.).
2. Helper `getRefGuitarFamily(refGuitarName)` pareil sur le nom
   retourné par l'IA (`aiResult.ref_guitar`).
3. Dans `enrichAIResult` (post-processing, **pas** bump SCORING_VERSION) :
   bonus +15-20 pts sur les guitares du rig dont la family match
   `aiResult.ref_guitar`. Si plusieurs match family → départage par
   le scoring V9 standard.
4. Tests Vitest sur les cas types (Get Lucky → Strat ; Stairway →
   LP ; Brown Sugar → Strat ; etc.).
5. Validation manuelle sur rig Francisco (Sire T7 + Squier Strat)
   et Sébastien (LP + SG + Strat + Tele + ES-335).

**Bonus** : couplé à Phase 7.61 (rename guitares vers noms complets
"Fender Stratocaster American Vintage II 1961"), `getGuitarFamily`
devient trivial (match direct sur le nom).

**Couplage Phase 7.61 + 7.64** : à faire ensemble pour un seul tour
de validation IA. Effort estimé combiné : ~3-4h dev + tests + deploy.

**Workaround Francisco pré-Phase 7.64 (obsolète depuis 2026-05-18)** :
feedback IA explicite *"Prefiero la Squier Strat pour Get Lucky"*
via bouton 💬. Plus nécessaire — Phase 7.64 livrée le boost est
automatique.

### Phase 7.63 — ✅ LIVRÉE 2026-05-18 (v8.14.108) — Sécurité admin-switch profil

Options 1 (banner persistant) + 2 (log loginHistory) livrées. Voir section "État actuel (2026-05-18)" en tête de CLAUDE.md pour le détail.

**Notes design conservées pour référence** :

Rapporté 2026-05-17 par Sébastien (observation théorique, pas
d'incident effectif). Quand l'admin clique sur un autre profil
dans le ProfileSelector dropdown, `switchProfile` (`main.jsx:1267`)
fait `setActiveProfileId(id)` SANS demander de password. Toute
action ultérieure (toggle guitare, modif setlist, etc.) s'applique
au profil cible et part en push Firestore avec son `profileId`.

**Risques** :
- Confidentialité : admin voit tout le rig/setlists/aiCache du
  beta-testeur sans son consentement explicite
- Sync concurrent : si beta-testeur est connecté sur son device
  en même temps, LWW per-profile (Phase 5.7) peut écraser ses
  modifs récentes
- Switch accidentel : un click malheureux dans le dropdown peut
  faire changer de contexte sans avertissement

**3 améliorations possibles Phase 7.63** (par ordre coût/impact) :

1. **Banner persistant** *"🔍 Connecté en tant que Francisco
   (mode admin) — tes modifs s'appliquent à son profil"* en haut
   de tous les écrans. ~30 min. Le plus utile.
2. **Log dans loginHistory** : entry spéciale *"Sébastien (admin)
   connected as Francisco at 2026-05-17 22:30"* visible quand le
   beta-testeur consulte son loginHistory. ~30 min. Transparence.
3. **Modale de confirmation** *"Tu vas accéder à Francisco en
   mode admin. Continuer ?"* avant switch. ~1h. Évite switchs
   accidentels mais friction supplémentaire pour l'admin.
4. **Demander password** du beta-testeur pour switcher sur lui.
   ~2h. Respect vie privée max mais friction max aussi. Probably
   pas nécessaire — l'angle 1+2 suffit.

**Reco** : implémenter 1+2 ensemble dans Phase 7.63 (1h total),
les plus utiles. Reporter 3 et écarter 4.

### Phase 7.60 — Landing publique first-time visitors (v8.14.99)

Phase 7.60 = MVP V1 de la sous-phase 7.55.1 documentée dans "Idées
en attente". Servie aux visiteurs qui arrivent sur mybackline.app
sans aucun trusted device (donc jamais aux profils déjà connectés
sur leurs appareils — comportement legacy strictement préservé).

**Composant `src/app/screens/LandingScreen.jsx`** :
- Hero : icône Backline 64px + H1 "Backline — le copilote de ta
  ToneX" + sous-titre "Quel preset, quelle guitare, quels réglages
  — pour chaque morceau. L'IA fait le tri dans tes packs." + ligne
  italique "V1 dédiée ToneX (Pedal, Anniversary, Plug). Support
  Tone Master Pro en développement." (positionne le scope V1).
- 3 cards features statiques : 🔍 "Tu cherches un morceau" / 🎯
  "L'IA propose une reco" / 🎛️ "Tu joues, elle assiste". Grid
  responsive (auto-fit, minmax 220px).
- 2 CTAs principaux :
  - **Démo** (brass→copper gradient, le CTA fort) → `onDemoEnter`
    qui appelle `enterDemoMode()` (réutilise Phase 7.51.3).
  - **Beta** (style secondaire) → lien externe `target="_blank"`
    vers `TALLY_URL` constant (placeholder `https://tally.so/r/REPLACE_ME`
    à remplacer par Sébastien après création du formulaire Tally).
- Lien discret "J'ai déjà un compte" → `onShowPicker` → setScreen
  ("pick") → ProfilePickerScreen legacy.
- Footer micro : lien mailto studios + numéro de version.
- Trilingue FR/EN/ES dès J0 (15 nouvelles clés `landing.*`).

**Routing `src/main.jsx`** : l'auto-login `useEffect` Phase 7.51.3
gagne une nouvelle branche AVANT le check `profileCount>1` :
```js
} else if(trustedIds.length===0){
  setScreen("landing");
}
```
Si l'utilisateur a au moins 1 trusted device → auto-login direct
(legacy). Si aucun → landing. La condition `?demo=1` reste
prioritaire en tête de l'effect (Phase 7.51.3 inchangé).

Dispatch JSX :
```jsx
if(screen==="landing") return <div className="page-root">
  <LandingScreen onDemoEnter={enterDemoMode}
    onShowPicker={()=>setScreen("pick")}
    appVersion={APP_VERSION}/>
</div>;
```

**Conséquences** :
- Pour Sébastien (Mac + iPhone trusted) : aucun changement, jamais
  exposé à la landing.
- Pour un visiteur fresh sur `https://mybackline.app/` : voit la
  landing au lieu du ProfilePickerScreen "Qui joue aujourd'hui ?"
  qui demandait nom + password sans contexte.
- Bundle 2347.81 → 2348.18 KB (+0.37 KB pour LandingScreen + 15 i18n
  trilingues). Aucun GIF/MP4 inline → pas de gros impact taille.
- Pas de bump STATE_VERSION (purement UI publique).
- Pas de migration localStorage.
- 1047/1047 tests verts (aucun nouveau test Vitest dédié à
  LandingScreen — cohérent avec Phase 7.51 landing). Smoke-test
  manuel à faire post-déploiement (navigation privée pour simuler
  un device fresh).

**Action post-déploiement Sébastien** :
1. Créer le formulaire Tally (champs suggérés : nom, email,
   guitares principales, modèle ToneX, 5-10 morceaux prioritaires,
   "comment as-tu découvert Backline ?")
2. Récupérer l'URL `https://tally.so/r/XXXXXX`
3. Remplacer `TALLY_URL` dans `src/app/screens/LandingScreen.jsx`
4. Rebuild + redeploy

Tant que le placeholder est en place, le clic sur "Demander un
accès beta" ouvre une page 404 Tally → non bloquant pour le
déploiement initial, juste à corriger avant que les utilisateurs
n'arrivent en volume.

**Roadmap V2 (différée)** : remplacer les 3 cards statiques par des
GIF/MP4 enregistrés via OBS sur la démo curée (3 clips × ~500 KB
= +1.5 MB bundle inline). Effort estimé : ~6h production vidéo +
1h intégration. À déclencher après J+10 si les analytics (Phase
7.55.6) montrent un signal de conversion suffisant pour justifier
l'investissement.

**Sous-phases 7.55.x suivantes proposées** :
- 7.55.2 : bouton "Voir un exemple direct" dans la modale d'intro
  démo qui charge auto Highway to Hell (cf docs "Idées en attente")
- 7.55.4 : page studios `/studios` (B2B éditeurs de packs)
- 7.55.5 : formulaire Tally qualifiant enrichi (avec champ
  "comment as-tu découvert ?")
- 7.55.6 : analytics Cloudflare/Umami pour mesurer la conversion

### Phase 7.59 — Protections défensives pollution profile (v8.14.97)

Suite à un incident 2026-05-17 où Sébastien a constaté que son
profil avait perdu des guitares (Tele 51) et en avait gagné d'autres
(Sire T3 + T7, qui appartiennent à Francisco). Diagnostic confirmé :
`profile.sebastien.myGuitars` contenait `sire_t7` + `sire_t3` + son
`profile.aiCache` était vidé. Aucune repro identifiée — possiblement
race condition lors des switchs profil pour pré-calcul beta (Bruno,
Francisco, démo curateur) du même jour, OU `mergeProfilesLWW` LWW
per-profile entier adoptant un état remote pollué.

Le backup auto Phase 4.1 (MAX_BACKUPS=1, throttle 5 min) avait un
backup à 13:10:21 et la pollution stampée à 13:10:31 — backup
probablement déjà pollué. Restauration manuelle nécessaire.

#### Phase 7.59-A — Snapshots manuels (MaintenanceTab admin)

Stockage séparé `localStorage.tonex_guide_snapshots_manual` (vs
`tonex_guide_backups` rotation auto). Pas de limite MAX, pas de
throttle — l'admin contrôle.

Cas d'usage : sauvegarde explicite AVANT une opération risquée
(pré-calcul beta-testeur, switch profil, import CSV banks, etc.) →
restauration en 2 clics si pollution observée.

```
src/core/state.js  +helpers purs :
  createManualSnapshot(label) → { ok, id } ou { ok: false, error }
  listManualSnapshots() → array { id, time, label, data }
  restoreManualSnapshot(id) → boolean (écrit data dans LS_KEY)
  deleteManualSnapshot(id) → boolean
  LS_MANUAL_SNAPSHOTS_KEY = 'tonex_guide_snapshots_manual'
src/app/screens/MaintenanceTab.jsx
  +section "💾 Snapshots manuels" (admin only)
  +bouton "Créer un snapshot" avec window.prompt label
  +liste snapshots avec boutons Restaurer / ✕ Supprimer par ligne
```

#### Phase 7.59-B — Sanity check guitar orphelins au boot

`validateProfileGuitars(state, guitarsCatalog)` helper pur dans
`state.js`. Pour chaque profile.myGuitars, vérifie que chaque id
existe dans :
- `GUITARS` catalog standard (Sire ajoutées Phase 7.48 T11)
- `state.shared.customGuitars` (Phase 7.x migration shared)
- `profile.customGuitars` legacy v3-

Si un id n'est dans AUCUN des trois → guitar orphelin → log
`console.warn` au boot :
```
[backline-sanity] Pollution profile détectée — guitar ids orphelins:
  [{profileId: "sebastien", profileName: "Sébastien",
    orphanIds: ["sire_t7", "sire_t3"]}]
```

Non bloquant — diagnostic facilité. Au prochain incident, Sébastien
copie le log + contexte (qu'a-t-il fait ?) pour qu'on identifie la
cause racine.

### i18n complet

10 nouvelles clés EN/ES ajoutées pour la section snapshots manuels
(create, restore, delete, prompts, errors).

### Récap final session 2026-05-17

| Famille | Versions | Sujet |
|---------|----------|-------|
| 7.52.6 → 7.52.17 | 8.14.77-80 | Hotel California, snapshot curateur, auth Firebase |
| 7.53.x | 8.14.81-83 | ToneNET usages + LWW + UX flush |
| 7.55 catalog | 8.14.84 | findCatalogEntryByUsages ideal_top3 |
| 7.54.x | 8.14.85-87 | aiCache per-profile + drop shared + hash setlist |
| 7.56 | 8.14.88 | findSlotByName tolère format IA |
| 7.55-quickwins | 8.14.89 | F+B+G+7.52.18 mode démo |
| 7.55-A | 8.14.90 | Snapshot démo enrichi v10 |
| 7.57 | 8.14.91 | Retire éditeur BPM/tonalité |
| 7.58 | 8.14.92 | Strip profile.aiCache non-actifs au push |
| 7.58.1+i18n | 8.14.93 | Bump SAFE_LIMIT 980 KB + traductions EN/ES |
| 7.55.3 + G auto-open | 8.14.94-95 | Chips démo + bouton random + URL auto-open |
| 7.55.8-light | 8.14.96 | Modale 3 étapes + footer PathToTone clarifié |
| **7.59 A+B** | **8.14.97** | **Snapshots manuels admin + sanity check guitar orphelins** |

**6 bugs latents fixés** : 401 Firebase auth, effacement bloc
toneNetPresets, hash partiel setlists, écrasement Hotel California,
scale state local 1.7→2.3 MB → strip aiCache, pollution profile
cross-mélange (protections défensives ajoutées Phase 7.59 mais
cause racine non identifiée — repro pending).

**Backline v8.14.97 stable, prêt pour beta-testeurs.**

### Sous-phases additionnelles post-7.55-A (continued)

### Phase 7.55.3 + G auto-open (v8.14.94-95) — Mode démo "aha moment"

Phase 7.55.3 — chips suggérés + bouton random sur Accueil démo. Sous
le champ recherche grisé en mode démo, affiche :
- Label "Essaye :" + 4 chips morceaux (acdc_hth, bbking_thrill,
  deeppurple_smoke, pinkfloyd_wywh)
- Bouton "🎲 Au hasard" qui pioche parmi les 11 songs Demo Setlist

Click chip → `handleSongConfirm(title, artist)` extrait en useCallback
(réutilisé par SongSearchBar + chips + autoOpen). Charge la fiche
depuis l'aiCache du snapshot bundlé (zéro fetchAI).

Phase 7.55-G auto-open complété (v8.14.95). `useEffect` au mount
HomeScreen lit `window._demoPrefSongId` (exposé sur window par main.jsx
au boot via URL `?demo=1&song=X`) → trouve la song dans songDb → appelle
handleSongConfirm pour ouvrir la fiche automatiquement. Flag
`_demoSongAutoOpened.current` pour ne tourner qu'une fois.

Validation : `https://mybackline.app/?demo=1&song=acdc_hth` ouvre direct
la fiche Highway to Hell.

### Phase 7.55.8-light (v8.14.96) — Polish modale + footer

Cleanup cosmétique pour image pro avant retour Bruno/Francisco
lundi-mardi.

**Modale SplashPopup (Accueil mode démo)** : étape 4 "🤘 Rock'n'roll !"
supprimée. C'était décoratif, alourdissait le pitch sans valeur ajoutée.
La modale reste à 3 étapes : recherche / raisonnement IA / choix guitare.

**Footer AppFooter** : ajout d'une ligne intermédiaire entre le
copyright et le disclaimer marques :
```
© 2026 PathToTone · Made with 🎸 and ❤️
PathToTone édite Backline.                    ← NOUVEAU
Outil indépendant — ToneX™ est une marque...
```
Évite la confusion chez les visiteurs qui voyaient PathToTone sans
comprendre que c'est la société éditrice du produit Backline.

Traductions EN/ES :
- `common.footer-pathtotone` "PathToTone publishes Backline." / "PathToTone publica Backline."

### Sous-phases additionnelles post-7.55-A (continued)

### Sous-phases additionnelles post-7.55-A (continued)

**Phase 7.57 (v8.14.91)** — Retire éditeur BPM/tonalité de la fiche song
- Inputs BPM (number) + tonalité (text) supprimés de SongDetailCard
- L'IA Gemini retourne désormais `song_bpm` et `song_key` fiables dans
  `aiCache.result` (rarement faux)
- Affichage read-only ligne 175 (via `getSongInfo()`) suffit largement
- Data model `song.bpm` + `song.key` préservés pour rétro-compat
  setlists existantes + LiveScreen mode scène
- UI épurée. Bloc commenté plutôt que supprimé si besoin de ré-activer.

**Phase 7.58 (v8.14.92)** — Strip profile.aiCache des profils non-actifs au push
- Bug post-7.55-A : Mac push abort "Payload 2315 KB ≥ 1 MB" car
  profile.aiCache de plusieurs profils accumulés (Sébastien 50 + Bruno 6
  + demo curateur 11 + autres) gonflait le state au-delà de 1 MB
- Fix : `stripAiCacheForSync(state, options)` accepte
  `options.activeId || state.activeProfileId`. Au strip (branche
  compressed > seuil), en plus de strip `shared.songDb.aiCache`
  (déjà 0 Phase 7.54.1), strip aussi `profile.aiCache` des profils
  NON-ACTIFS. Le profil actif est préservé.
- Trade-off : si un autre profil se connecte sur son propre device et
  pull, il ne reçoit PAS les profile.aiCache calculés depuis le device
  de Sébastien (cas pré-calcul beta-testeur). Il doit re-fetcher
  localement. Pré-calculs admin restent disponibles via snapshot démo
  bundlé (Phase 7.51.4 / 7.55-A) pour les visiteurs démo.
- `stripAiCacheForSync` préserve l'identity du state si rien à strip
  (garde test "shared.songDb absent → état inchangé" vert).

**Phase 7.58.1 + i18n (v8.14.93)** — Bump SAFE_LIMIT + traductions EN/ES
- `SAFE_LIMIT` 800 KB → **980 KB** dans `firestore.js`. Le seuil 800 KB
  pour push WITH aiCache était trop conservatif pour les states v10
  avec profile.aiCache trilingue (~870 KB compressed pour 50 entries
  Sébastien). Firestore hard limit est 1024 KB. À 980 KB on garde
  ~70 KB de marge pour metadata Firestore (syncId + ts).
- Conséquence : Mac avec profile.aiCache à 872 KB compressed passe
  désormais en push WITH aiCache (au lieu de strip + abort à 1835 KB raw).
- i18n EN/ES complétées pour 8 strings manquantes (fallbacks FR inline
  avant) : `demo.banner-exit` + `demo.banner-exit-title` (Phase 7.55-B)
  + 6 clés ToneNET usages (`tonenet.usages-toggle`, `usages-hint`,
  `usage-artist`, `usage-remove`, `usage-song-add`, `usage-add`,
  Phase 7.53). Visiteurs anglophones/hispanophones voient désormais
  les bons textes.

### Validation finale (2026-05-17)

Push Mac v8.14.93 :
```
Pull WITH aiCache (compressed → 2097 KB)
Push WITH aiCache COMPRESSED (raw 2324 KB → compressed 872 KB)
[warning] Payload 872 KB approche la limite 1 MB
```

✅ Plus de strip, plus d'abort, propagation Mac→iPhone opérationnelle.
Warning "approche limite 1 MB" purement préventif (marge ~150 KB).

### Récap session 2026-05-17 finale

| Famille | Versions | Sujet |
|---------|----------|-------|
| 7.52.6 → 7.52.17 | 8.14.77-80 | Hotel California, snapshot curateur, auth Firebase |
| 7.53.x | 8.14.81-83 | ToneNET usages + LWW + UX flush |
| 7.55 catalog | 8.14.84 | findCatalogEntryByUsages ideal_top3 |
| 7.54.x | 8.14.85-87 | aiCache per-profile + drop shared + hash setlist |
| 7.56 | 8.14.88 | findSlotByName tolère format IA prefixé |
| 7.55-quickwins | 8.14.89 | F+B+G+7.52.18 mode démo |
| 7.55-A | 8.14.90 | Snapshot démo enrichi v10 (11/11 recos parfaites) |
| 7.57 | 8.14.91 | Retire éditeur BPM/tonalité |
| 7.58 | 8.14.92 | Strip profile.aiCache non-actifs au push |
| 7.58.1+i18n | 8.14.93 | Bump SAFE_LIMIT 980 KB + traductions EN/ES |
| 7.55.3 + G auto-open | 8.14.94-95 | Chips démo + bouton random + auto-open URL |
| **7.55.8-light** | **8.14.96** | **Modale 4 étapes → 3 + footer PathToTone clarifié** |

**5 bugs latents fixés** : 401 Firebase auth, effacement bloc
toneNetPresets, hash partiel setlists, écrasement Hotel California,
scale state local 1.7 MB → 2.3 MB → propagation Mac↔iPhone bloquée.

**Bilan** : Backline v8.14.93 stable, prêt pour Bruno + Francisco
lundi-mardi avec mode démo professionnel + sync bilatérale.

### Sous-phases additionnelles post-7.55-A — section originale

(Détails techniques des phases conservés ci-dessous pour référence.)

### Sous-phases livrées en supplément (post-7.56)

**Phase 7.55-quickwins (v8.14.89)** — 4 quick wins Batch 1 des
"Améliorations mode démo" :
- **F. Cap quota Gemini** sur mode démo : 7 sites fetchAI gated
  `isDemo` (HomeScreen ×2 rerunWithFeedback + add song, SetlistsScreen
  add song, MonProfilScreen add song, AddSongModal handleAdd, en plus
  des 4 déjà existants : SongDetailCard, ListScreen ×2, MaintenanceTab).
  Évite que wrapDemoGuard Phase 7.51.2 bloque setSongDb mais que
  fetchAI parte en arrière-plan consommer la clé Gemini partagée.
- **Phase 7.52.18** : `enterDemoMode` merge profileIds au lieu de
  remplacement bloc. Défense ultime contre snapshot externe avec
  profileIds=['demo'] seul (Phase 7.52.16 force déjà ['demo',
  origId] à l'export mais imports manuels peuvent bypass).
- **B. Bouton "✕ Quitter"** sur DemoBanner : sessionStorage clear +
  history.replaceState (remove ?demo=1) + setScreen("pick") + drop
  profil démo du state in-memory. Sortie explicite vs reload manuel.
- **G. URL paramétrable** `?demo=1&song=X&guitar=Y` : params captés
  dans `_demoPrefSongId` / `_demoPrefGuitarId` au boot + URL nettoyée.
  **Auto-open de la fiche reporté** (nécessite wiring ListScreen
  expandedId — Phase 7.55.2 future).

**Phase 7.55-A (v8.14.90)** — Re-export snapshot démo après refetch
sur curateur Mac v8.14.89 :
- Snapshot bundlé `src/data/demo-profile.json` version 9 → **10**
- `profile.aiCache` 11 entries (per-profile Phase 7.54)
- `shared.aiCache` 11 entries (fallback legacy v9 préservé)
- `profileIds: ['demo', 'demo_1778839429588']` (Phase 7.52.16)
- **11/11 recos optimales** :
  - AC/DC ×4 → AA MRSH JT50 Schaffer (usages explicit)
  - B.B. King → AA FNDR BFTWN Twin Reverb (usages)
  - Cream ×2 → AA MRSH SB100 Super Bass Plexi (usages)
  - Deep Purple → TJ 74 Purple Plexi
  - **Hotel California → JS Wrecked Z Push 1** (ref_guitarist
    "Joe Walsh / Don Felder" + Phase 7.52.6 substring match)
  - Led Zep → AA MRSH SL100 Super Lead 1969
  - Pink Floyd → AA HWTT CUT100 Hiwatt
- Bundle 2164.92 → 2334.13 KB (+169 KB pour profile.aiCache enrichi)

**Phase 7.53.2 (v8.14.83 — documenté seulement via commit)** — Fix
UX dans ToneNetTab édition usages : l'input "+ Morceau" était
uncontrolled, le texte tapé n'était pas ajouté à `usages[idx].songs`
tant que Enter pas pressé. Fix : input contrôlé via state
`songDrafts` + helper `flushSongDrafts()` appelé par addPreset /
saveEdit pour pousser drafts dans usages avant cleanUsages.
Placeholder mis à jour : "+ Morceau (Enter ou Sauver pour ajouter)".

**Phase 7.55-catalog (v8.14.84 — documenté seulement via commit)** —
`findCatalogEntryByUsages` dans ai-helpers.js : promeut les captures
catalog (incluant ToneNET tagué) dans `ideal_top3` + `ideal_preset`
quand usages match artist/title/refGuitarist, même si pas installé
dans les banks. Cas-cible : preset Laney ToneNET tagué Sabbath →
remonte dans la section "Recommandation idéale Preset" sans être
chargé dans une slot. Score 92 (titre exact) ou 80 (artiste seul).
Filtre availableSources respecté. 8 nouveaux tests Vitest.

### Phase 7.56 — `findSlotByName` tolère format prefixé

Phase 7.56 ajoutée après pré-calcul d'analyses pour Bruno (beta-testeur).
Bug observé : Gemini retournait `preset_ann_name = '48A "Kirk & James -
Gasoline v2"'` (format avec position + quotes) au lieu du nom seul →
`findSlotByName` Phase 7.31 ne matchait pas → fallback scoring V9 →
custom Galtone ignoré au profit d'un Factory HG MARK3.

```js
// AVANT : match exact case-insensitive
target = String(name).trim().toLowerCase();
// → '48a "kirk & james - gasoline v2"' ≠ 'kirk & james - gasoline v2'
// → no match → fallback V9 → factory wins

// APRÈS : strip prefix position + quotes
let target = String(name).trim();
target = target.replace(/^\s*\d{1,2}[ABC]\s+/i, '');  // strip "48A " ou "9c "
target = target.replace(/^["']/, '').replace(/["']$/, '');  // strip quotes
target = target.trim().toLowerCase();
```

### Effet validé sur Bruno

| Song | Avant Phase 7.56 | Après Phase 7.56 |
|------|------------------|------------------|
| For Whom the Bell Tolls (Metallica) | 9C HG MARK3 (factory) | **48A Kirk & James - Gasoline v2** ✅ |
| Fear of the Dark (Iron Maiden) | 6A HG VX30 (Vox AC30 ?!) | **49C TSR Mars 800SL Cn1&2 HG** ✅ |

### Cas non résolus par Phase 7.56 (non-déterminisme Gemini)

- **All the Small Things (Blink-182)** : Gemini renvoie
  `preset_ann_name: undefined` malgré présence de "Blink-182 Mesa Boggie"
  dans bank 48B + priorité 2 du prompt explicite. Gemini hallucine son
  fallback factory. **Workaround utilisateur** : donner un feedback IA
  explicite sur ce morceau pour forcer le pin.
- **Self Esteem (Offspring)** : pas de custom dédié Offspring dans les
  banks Bruno → fallback factory acceptable.

### Architecture livrée Phase 7.56

```
src/app/utils/ai-helpers.js
  findSlotByName : strip prefix "BB[C]\s+" (case-insensitive) +
                   strip quotes "..." ou '...' avant match
src/app/utils/ai-helpers.test.js  +9 tests Phase 7.56 :
  - legacy match (rétro-compat)
  - prefix "48A name" et "48A \"name\""
  - quotes doubles et simples
  - position 1-2 chiffres (9C, 48A)
  - case-insensitive sur position
  - falsy inputs → null
src/main.jsx APP_VERSION 8.14.87 → 8.14.88
public/sw.js CACHE backline-v187 → backline-v188
```

### Conséquences

- **1047/1047 tests verts** (+9 Phase 7.56)
- **Bundle** 2163.32 → 2163.43 KB (stable)
- **Pas de bump SCORING_VERSION** ni migration
- **Rétro-compat** : match exact toujours fonctionnel

### Workflow pré-calcul beta-testeurs (validé)

Procédure documentée pour pré-calculer les analyses IA d'un beta-testeur
avant son arrivée :

1. **Switcher sur leur profil** sur Mac (ProfileSelector déconnexion +
   reconnexion avec leur password). Indispensable car le fetch utilise
   leurs banks, sources, customPacks, recoMode.
2. Vérifier `profile.customPacks` non vide côté Mac (sinon l'IA n'a pas
   les metadata custom).
3. Setlists → setlist principale du beta-testeur → "🤖 Analyser/MAJ N"
4. Attendre ~30s-1min par morceau, vérifier 2-3 fiches.
5. Donner feedback IA explicite si non-déterminisme Gemini fait fail
   un pin custom (cas Blink-182 observé).
6. Switcher back sur Sébastien admin.
7. Beta-testeur reload sa PWA → profile.aiCache déjà rempli via sync
   Firestore (Phase 7.54 LWW per-profile).

### Famille Phase 7.54.x — Refonte sync aiCache

| Phase | Sujet | Version |
|-------|-------|---------|
| 7.54 | aiCache per-profile (STATE_VERSION 10) | 8.14.85 |
| 7.54.1 | Drop ALL shared.aiCache + skip merge isV10 | 8.14.86 |
| 7.54.2 | Hash setlist complet (fix latent Phase 5.7.3) | 8.14.87 |
| 7.56 | findSlotByName tolère format IA | 8.14.88 |

Refonte architecturale du sync aiCache pour casser un cercle vicieux
qui bloquait toute propagation des analyses Mac → iPhone depuis
plusieurs semaines. 3 sous-phases livrées en cascade après que
chacune ait révélé un nouveau couche du problème.

### Résultat final (validé sur Mac + iPhone)

| Métrique | Avant Phase 7.54 | Après 7.54.2 |
|----------|------------------|--------------|
| State local Mac (raw) | 1684 KB | **903 KB** |
| Push compressed | 922 KB ≥ seuil → strip aiCache | **382 KB WITH aiCache** |
| profile.aiCache (Sébastien) | n/a | **50 entries** |
| shared.songDb aiCache legacy | 148 | **0** |
| Propagation guitare per-song Mac→iPhone | ❌ silencieuse | ✅ 5-10s |
| Propagation analyses Mac→iPhone | ❌ strippées | ✅ avec aiCache |

### Phase 7.54 — aiCache per-profile (STATE_VERSION 9 → 10)

Phase 7.54 résout structurellement le bug de strip aiCache au push
Firestore. Le state Mac dépassait 800 KB compressed →
`stripAiCacheForSync` Phase 5.7.1 retirait l'aiCache du push → modifs
analyses Mac n'atterrissaient jamais sur iPhone. Cercle vicieux : drop
local → pull Firestore ré-injecte tous les aiCache via Phase 5.7.1
`mergeSongDbPreservingLocalAiCache`.

### Cause

Phase 3.6 (mai 2026) : aiCache stocké dans `shared.songDb[i].aiCache`
partagé entre tous les profils. État Mac contenait 148 aiCache (50
songs setlists Sébastien + 98 d'autres profils Bruno/Francisco/démo) →
1.68 MB raw → 922 KB compressed → > seuil 800 KB.

### Fix Phase 7.54 — Migration STATE_VERSION 9 → 10

Nouveau champ `profile.aiCache: {[songId]: aiCacheValue}` per-profile.
Lookup au render priorité `profile.aiCache` → fallback
`shared.songDb[i].aiCache` (rétro-compat legacy).

```
profile {
  ...,                                  // v9 inchangé
  aiCache: { [songId]: aiCache }        // v10 : per-profile
}
shared.songDb[i] {
  ...,
  aiCache?: ...                         // conservé en fallback legacy
                                        // (drop pour songs du profil
                                        // actif au moment de la migration)
}
```

### migrateV9toV10 (additif, idempotent)

1. Pose `profile.aiCache = {}` sur tous profils via `ensureProfilesV10`
2. Pour le **profil actif uniquement** (`activeProfileId`) :
   - Identifie songs dans ses setlists (profileIds inclut activeId)
   - Pour chaque song avec `shared.songDb[i].aiCache` : copie →
     `profile.aiCache[songId]` puis drop `shared.songDb[i].aiCache = null`
3. Les autres profils gardent shared.aiCache jusqu'à leur boot v10
4. Idempotente : preserve si profile.aiCache déjà plus récent (sv supérieur)

### Architecture livrée

```
src/core/state.js
  STATE_VERSION 9 → 10
  +ensureProfileV10 / ensureProfilesV10
  +migrateV9toV10
  +getProfileAiCache helper
  mergeProfilesLWW utilise ensureProfileV10
src/main.jsx
  +songDbWithProfileCache useMemo (dérivation au render)
  +setSongAiCache useCallback (écrit profile.aiCache)
  syncHash inclut profile.aiCache
  Batch rescore Phase 1 utilise songDbWithProfileCache + setSongAiCache
  Propagation aux 6 screens
src/app/screens/SongDetailCard.jsx
  +writeAiCache helper interne (route onAiCacheUpdate ou onSongDb)
  5 sites d'écriture adaptés (fetchAI, recoMode, feedback x3)
src/app/screens/ListScreen.jsx
  +prop onAiCacheUpdate (batch analyzeMissingAll, improveAll)
src/app/screens/SetlistsScreen.jsx, HomeScreen.jsx, RecapScreen.jsx,
  MonProfilScreen.jsx, MaintenanceTab.jsx
  +prop onAiCacheUpdate propagée
  Sites add song / wipe / recalcAll adaptés
src/app/components/AddSongModal.jsx
  +prop onAiCacheUpdate
src/core/state.test.js  +13 tests Phase 7.54
src/main.jsx APP_VERSION 8.14.84 → 8.14.85
public/sw.js CACHE backline-v184 → backline-v185
```

### Conséquences

- **1038/1038 tests verts** (+13 Phase 7.54)
- **Bundle** 2160.91 → 2163.32 KB (+2.4 KB)
- **STATE_VERSION 9 → 10** : additif, idempotent, rétrocompatible
- **Cohabitation v9/v10** : un device pré-7.54 ignore profile.aiCache,
  un device v10 reçoit v9 push, ensureProfileV10 pose aiCache={} à
  l'adoption.

### Effet attendu Mac + iPhone post-déploiement

1. Reload PWA Mac 2× → migration auto → 50 aiCache Sébastien dans
   profile.aiCache, shared.songDb allégé
2. Push Firestore → state allégé → compressed < 800 KB → push WITH
   aiCache (plus de strip)
3. iPhone reload 2× → pull → reçoit profile.aiCache Sébastien via
   mergeProfilesLWW → modifs Mac propagées
4. Beta-testeurs futurs : first boot v10 migre leur propre aiCache
   shared. État local ne contient QUE leurs analyses.

### Limites acceptées v1

- **Merge LWW grossier au profil** : modifs aiCache parallèles sur Mac
  vs iPhone → le LWW garde le profil le plus récent. Cas rare,
  acceptable.
- **Wipe "Invalider tous les caches" admin** wipe aussi shared.aiCache
  legacy en plus de profile.aiCache. Si d'autres profils ont des
  shared.aiCache, perdus côté curateur.

### Phase 7.54.1 — Drop ALL shared.aiCache + skip merge

**Bug observé immédiatement après Phase 7.54** : state Mac encore
2513 KB au reload. Le push restait `WITHOUT aiCache (compressed 923 KB
still ≥ 800 KB)`. Cause :

1. **Migration v9→v10 trop conservatrice** : ne droppait que les
   shared.aiCache du profil actif (50 caches Sébastien). Les 98 caches
   des autres profils (Bruno/Francisco/démo/Arthur) restaient en shared
   → ~1500 KB raw conservés inutilement.
2. **`mergeSongDbPreservingLocalAiCache` ré-injectait** au pull Firestore
   le `remote.shared.aiCache`. Cercle vicieux : drop local → pull → réinjection.

**Fix Phase 7.54.1** :

- `migrateV9toV10` étendu : drop ALL `shared.songDb.aiCache` (pas
  seulement profil actif). Les autres profils retrouvent leurs caches
  via leur propre `profile.aiCache` (sync per-profile via
  `mergeProfilesLWW` Phase 5.7) ET via leur propre migration v10 sur
  leur device.
- `mergeSongDbPreservingLocalAiCache` accepte nouveau param `options.isV10`.
  Si `true`, drop `remote.aiCache` au merge (legacy obsolète en v10).
  Sinon, comportement Phase 5.7.1 inchangé (rétro-compat).
- Call sites main.jsx (`applyRemoteData` + initial pull) → `isV10:true`.

**Trade-off accepté** : si un autre profil se connecte sur le Mac de
Sébastien, ses analyses doivent re-fetcher (pas dispo localement
avant sync via profile). En pratique : rare, compromise vs blocage
permanent du sync.

**v8.14.85 → v8.14.86, SW v186.**

### Phase 7.54.2 — Hash setlist complet (fix bug latent depuis Phase 5.7.3)

**Bug observé immédiatement après Phase 7.54.1** : Sébastien sélectionne
guitare LP P90 pour "Back in Black" sur Mac → iPhone reçoit setlist
avec `lastModified` identique mais `guitars: {}` (vide).

**Cause** : `_setSetlistsComposed.shallowHash` Phase 5.7.3 ne hashait
que `length + name + profileIds + songIds`. Le champ `guitars`
(mapping per-song gId) — ainsi que `notes`, `recoMode`, et tout autre
champ futur — n'était PAS dans le hash. Conséquence chaîne :

1. Mac click guitare → `onSetlists` modifie `setlist.guitars[songId]`
2. `shallowHash(prev) === shallowHash(next)` car guitars hors hash
3. → pas de stamp `lastModified` → setlists mise à jour localement
   mais avec `lastModified` ancien
4. Push à Firestore embarque la setlist avec guitars mais lastModified
   ancien
5. iPhone pull → `mergeSetlistsLWW` voit `remote.lastModified ===
   local.lastModified` → tiebreak keep local → modif Mac perdue côté
   iPhone

Bug latent depuis Phase 5.7.3 (mai 2026). Masqué auparavant par le
fait que d'autres modifs concurrentes (toggle guitare collection,
ajout setlist, etc.) re-stampaient régulièrement les setlists.
Phase 7.54.x a rendu le sync plus exigeant → bug émerge.

**Fix Phase 7.54.2** : remplacer `shallowHash` partiel par
`JSON.stringify` complet de la setlist (sans `lastModified`). Couvre
tous les champs présents et futurs.

```js
const shallowHash = (sl) => {
  if (!sl) return '';
  const { lastModified: _lm, ...rest } = sl;
  try { return JSON.stringify(rest); } catch { return String(rest); }
};
```

**v8.14.86 → v8.14.87, SW v187.**

### Validation finale (2026-05-17)

Test bilatéral confirmé :
- Mac : sélection guitare → `lastModified: 2026-05-17T09:54:39.653Z`,
  `guitars: {acdc_bib: "lp50p90"}`
- iPhone après reload + 5s : **MÊME** `lastModified` + **MÊME** `guitars`
- Sync stable, pas de strip, propagation bilatérale 5-10s

### Récap complet famille 7.54.x

| Phase | Sujet | Version |
|-------|-------|---------|
| 7.54 | aiCache per-profile (STATE_VERSION 10) | 8.14.85 |
| 7.54.1 | Drop ALL shared.aiCache + skip merge | 8.14.86 |
| 7.54.2 | Hash setlist complet (fix latent Phase 5.7.3) | 8.14.87 |

---

## État précédent (2026-05-16, Phase 7.53.1 close — LWW per-item toneNetPresets)

**Backline v8.14.82 / SW backline-v182 / STATE_VERSION 9 / 1017 tests verts.**

Phase 7.53.1 corrige un bug critique de sync découvert immédiatement
après Phase 7.53 : les presets ToneNET de Sébastien Mac ont disparu
(state local + Firestore tous deux à zéro).

### Cause du bug

`applyRemoteData` dans `src/main.jsx` faisait un **remplacement en
bloc** de `shared.toneNetPresets` au pull Firestore :

```js
if (data.shared.toneNetPresets) setToneNetPresets(prev => {
  if (JSON.stringify(data.shared.toneNetPresets) === JSON.stringify(prev)) return prev;
  return data.shared.toneNetPresets; // ← écrasement intégral
});
```

Scénario d'effacement vraisemblable :
1. Un autre device (iPhone par exemple) avait localement
   `toneNetPresets: []` (jamais saisi, ou state pré-Phase 5.x).
2. Ce device push à Firestore → `toneNetPresets: []` propagé.
3. Mac pull → `setToneNetPresets([])` → presets locaux Mac perdus.
4. Mac push à son tour le `[]` (cycle) → confirmation Firestore.
5. **Impossible de récupérer** : les backups locaux ont aussi été
   purgés plus tôt dans la session pour libérer la marge localStorage.

### Fix Phase 7.53.1

`mergeToneNetPresetsLWW(localPresets, remotePresets)` dans
`src/core/state.js` — merge per-item LWW par `id` du preset :

- **Présent des deux côtés** → garde celui au plus grand
  `lastModified` (égalité = keep local pour stabilité).
- **Local-only** → keep local (préserve une saisie pas encore
  propagée).
- **Remote-only** → adopte remote (nouveau preset d'un autre device).

`applyRemoteData` utilise désormais ce merge au lieu du remplacement
en bloc. `addPreset` et `saveEdit` dans `ToneNetTab.jsx` stampent
`lastModified = Date.now()` à chaque écriture pour le LWW.

### Limite acceptée (pas de tombstones v1)

Pas de mécanisme tombstone pour la suppression d'un preset ToneNET.
Si Mac supprime un preset et qu'iPhone n'a pas encore pull :
- iPhone garde le preset local (avec ancien `lastModified`)
- iPhone push à un moment → le preset réapparaît côté Firestore
- Mac pull → le preset réapparaît côté Mac

Comportement assumé v1 : la suppression ToneNET est rare. Si besoin,
v2 ajoutera `deletedToneNetPresetIds: {[id]: ts}` comme Phase 5.7 le
fait pour les setlists.

### Migration legacy

Presets existants sans `lastModified` → `ts=0` → un remote stampé
gagne toujours. Convergence éventuelle vers tous stampés à mesure
que les saves se font. Pas de bump STATE_VERSION (additif optionnel).

### Architecture livrée

```
src/core/state.js
  +mergeToneNetPresetsLWW (helper pur)
  +export
src/main.jsx
  +import mergeToneNetPresetsLWW
  applyRemoteData : setToneNetPresets utilise merge LWW au lieu
                    du replace en bloc
src/app/screens/ToneNetTab.jsx
  addPreset : stamp lastModified
  saveEdit : stamp lastModified
src/core/state.test.js  +10 tests Phase 7.53.1
  - local-only preserved (scenario du bug : remote=[])
  - local-only avec remote présent autre id
  - LWW remote plus récent gagne
  - LWW local plus récent gagne
  - égalité ts → keep local
  - legacy sans lastModified → ts=0 fallback
  - remote-only adopté
  - inputs falsy → []
  - items sans id ignorés
  - usages préservés au merge
src/main.jsx  APP_VERSION 8.14.81 → 8.14.82
public/sw.js  CACHE backline-v181 → backline-v182
```

### Conséquences

- **1017/1017 tests verts** (+10 nouveaux Phase 7.53.1).
- **Bundle** 2159.28 → 2159.76 KB (+0.5 KB).
- **Plus de récidive du bug d'effacement bloc.**
- **Pas de migration STATE_VERSION** (additif optionnel sur item).

### Action utilisateur

Sébastien doit ressaisir ses presets ToneNET perdus (la récup
n'était plus possible — Firestore vide aussi). Une fois ressaisis,
ils seront stampés `lastModified` et protégés par le LWW.

---

## État précédent (2026-05-16, Phase 7.53 close — édition usages ToneNET)

**Backline v8.14.81 / SW backline-v181 / STATE_VERSION 9 / 1007 tests verts.**

Phase 7.53 permet aux utilisateurs de tagger leurs propres presets
ToneNET avec des `usages: [{artist, songs?}]` exploités par le prompt
IA Phase 7.52.1 (PRIORITÉ 1) et le post-processing Phase 7.52.5/.6.

### Le problème résolu

Phase 7.52 avait curé 150 captures Anniversary Premium avec usages
explicits (artiste + morceaux ciblés). Mais cette curation est
**statique** côté code — l'utilisateur ne pouvait pas tagger ses
propres presets ToneNET de la même façon. Conséquence : un preset
téléchargé spécifique à un artiste (ex. Laney pour Black Sabbath
première période) restait générique aux yeux du prompt IA.

### Solution

Champ optionnel `usages?: [{artist, songs?}]` ajouté au modèle preset
ToneNET. UI dédiée dans **Mon Profil → 🌐 ToneNET** :
- Section "Usages artiste / morceau (optionnel)" collapsable sous le
  form d'édition de preset.
- Liste d'entrées avec input artiste + tags songs.
- Autocomplete via datalist (artistes + titres depuis songDb local).
- Tags songs ajoutés via Enter, retirables individuellement (×).
- Bouton "+ Ajouter un artiste".
- Compteur visible sur le toggle si usages présents.
- Badge `🎯` sur la card preset listant les artistes + nb songs.

### Propagation au catalog

Le useMemo dans `src/main.jsx` qui injecte ToneNET dans
`PRESET_CATALOG_MERGED` (et son fallback `_toneNetLookup`) recopie
désormais le champ `usages` user-défini → `findCatalogEntry(name)`
retourne la metadata avec usages → `buildInstalledSlotsSection`
Phase 7.52.1 les sérialise au prompt → PRIORITÉ 1 → pin direct.

### Cas-cible Sébastien

Edit ton preset Laney ToneNET :
```
usages:
  - artist: "Black Sabbath"
    songs: ["Paranoid", "Iron Man", "N.I.B.", "War Pigs"]
  - artist: "Tony Iommi"
```

Prochaine analyse IA de "Paranoid" :
- `findCatalogEntry("Laney ...")` retourne les usages user-définis
- Prompt IA voit le slot Laney avec `usages: [Black Sabbath
  (Paranoid, Iron Man, N.I.B., War Pigs); Tony Iommi]`
- PRIORITÉ 1 → pin direct sur ton Laney ToneNET (au lieu de AA ORNG
  120 Dimed qui était le pin par défaut Anniversary Premium)

### Helper `cleanUsages` (testable)

Extrait du composant et exporté pour testabilité :
- Strip artistes vides + dedup songs + retourne `undefined` si tout
  est vide (évite de polluer le preset avec `usages: []`).
- 8 tests Vitest couvrent : liste vide, artiste vide, artiste seul,
  trim + dedup, mix valides/invalides, songs string-y filtrées,
  entrées null tolérées, coerce artist non-string.

### Architecture livrée

```
src/app/screens/ToneNetTab.jsx
  +state local usages + showUsages (collapsable)
  +datalist artistes + titres (autocomplete depuis songDb)
  +UI section éditable usages (artiste + tags songs)
  +propagation usages dans addPreset/saveEdit/startEdit
  +affichage 🎯 sur card preset si usages présents
  +export helper cleanUsages
src/app/screens/MonProfilScreen.jsx
  prop songDb passée à ToneNetTab
src/main.jsx
  useMemo PRESET_CATALOG_MERGED ToneNET → recopie p.usages
  useEffect _toneNetLookup → recopie p.usages
src/app/screens/ToneNetTab.test.js  NOUVEAU — 8 tests cleanUsages
src/i18n/  +6 clés (tonenet.usages-toggle, .usages-hint, .usage-artist,
            .usage-remove, .usage-song-add, .usage-add)
            (FR inline, EN/ES à compléter Phase 7.54+)
src/main.jsx  APP_VERSION 8.14.80 → 8.14.81
public/sw.js  CACHE backline-v180 → backline-v181
```

### Conséquences

- **1007/1007 tests verts** (+8 nouveaux Phase 7.53).
- **Bundle** 2154.95 → 2159.28 KB (+4 KB pour UI + helper).
- **Pas de bump SCORING_VERSION** (V9 inchangé, purement prompt-side).
- **Pas de migration** (champ additif optionnel sur modèle existant).
- **Sync Firestore natif** : `toneNetPresets[i].usages` part en push
  via `shared.toneNetPresets` (déjà sync depuis Phase 5.x).
- **Effet immédiat** : à la prochaine analyse IA d'un morceau dont
  un preset ToneNET est tagué, le pin bascule sans invalidation
  cache (post-processing au render).

### Limites connues

- **Preset doit être installé dans les banks** (`banksAnn`/`banksPlug`)
  pour que le post-processing trouve un slot. Si le preset ToneNET
  est ajouté à la base mais pas chargé en bank, l'usage est inerte.
- **Pas de validation cross-référence** : si tu tagues "Paranoid"
  mais que le titre n'est dans aucune setlist, l'usage ne servira
  qu'au moment où Paranoid sera ajouté à une setlist analysée.
- **Surchage possible des recos Anniversary Premium** : si tu tagues
  Laney pour 50 morceaux, tu écrases la curation statique. C'est ton
  choix de power user.

### Action post-déploiement Sébastien

1. Reload PWA 2× pour activer v8.14.81 / SW v181.
2. Mon Profil → 🌐 ToneNET → édite ton preset Laney → tag
   "Black Sabbath" + songs Paranoid/Iron Man/N.I.B./War Pigs →
   Sauver.
3. Ouvre "Paranoid" dans ta setlist → reco bascule vers Laney
   ToneNET (si le slot est dans tes banks).
4. Si tu veux propager aux beta-testeurs via le snapshot démo,
   re-export après tagging (`buildDemoSnapshot` Phase 7.52.16
   préserve les usages — déjà testé).

---

## État précédent (2026-05-16, Phase 7.52.17 close — robustification auth Firebase)

**Backline v8.14.80 / SW backline-v180 / STATE_VERSION 9 / 999 tests verts.**

Phase 7.52.17 robustifie l'auth Firebase (`firebase-auth.js` Phase 7.30)
suite à un incident 2026-05-16 où Sébastien Mac s'est retrouvé en
mode 401 perpétuel sur tous les appels Firestore. Push échouait
silencieusement → modifs locales jamais propagées → autres devices
pull stale → écrasement des modifs locales (symptôme reverts).

### Cause de l'incident initial

Cache local `backline_anon_auth` contenait un `idToken` expiré et un
`refreshToken` devenu invalide. `ensureAuthToken` lisait le cache,
le check `Date.now() < expiresAt - 60_000` passait (timestamp futur),
retournait le token rejeté. Firestore répondait 401. Aucune
récupération automatique → reload manuel + `localStorage.removeItem`
nécessaires.

### Fix Phase 7.52.17 — 2 mécanismes

**1. Retry exponentiel sur `signUpAnonymously`** :
- Backoff 500ms → 1s → 2s sur 4 tentatives totales (3 retries).
- Couvre les 5xx transitoires, timeouts réseau, throttling Firebase.
- `console.warn` à chaque retry, `console.error` si tout échoue puis
  throw.

**2. Auto-recovery 401/403 dans `authedFetch`** :
- Si la 1ère réponse fetch est 401 ou 403, on présume token rejeté
  par Firestore.
- Clear `localStorage[backline_anon_auth]` + reset `_authPromise`
  + `ensureAuthToken` (qui refait un signUpAnonymously fresh).
- Retry une seule fois avec le nouveau token.
- Si la 2e réponse est OK → transparent pour le caller.
- Si toujours 401/403 → propage tel quel (pas de boucle infinie).

### Architecture livrée

```
src/app/utils/firebase-auth.js
  +signUpAnonymouslyOnce (helper interne, comportement précédent)
  +signUpAnonymously (wrapper avec retry exponentiel)
  authedFetch : auto-recovery 401/403 + retry une fois
src/app/utils/firebase-auth.test.js  NOUVEAU — 6 tests Vitest
  - signUp retry 3× avec backoff puis succès
  - signUp échec persistant après retries → throw
  - 401 → clear cache + retry token frais → OK
  - 403 → même comportement que 401
  - 200 direct → pas de retry signUp
  - 2e 401 après retry → propage tel quel (pas de boucle)
src/main.jsx              APP_VERSION 8.14.79 → 8.14.80
public/sw.js              CACHE backline-v179 → backline-v180
```

### Conséquences

- **999/999 tests verts** (+6 nouveaux Phase 7.52.17).
- **Bundle** 2154.34 → 2154.95 KB (+0.6 KB).
- **Pas de bump SCORING_VERSION** (V9 inchangé).
- **Rétrocompatible** : signature et comportement happy-path
  inchangés. Seuls les chemins d'erreur (5xx signUp, 401/403 Firestore)
  sont enrichis.
- **Sébastien iPhone + Bruno + Francisco + futurs** : au prochain
  reload, si leur cache auth se corrompt comme sur Mac aujourd'hui,
  la recovery automatique kick in sans intervention manuelle.

### Limite

Le retry consomme du quota Firebase Auth (jusqu'à 4 signUp anonyme
par échec extrême + 1 par 401 dans `authedFetch`). Free tier = 50K
DAU, marge confortable pour le volume actuel. Si l'app passe en
production large, surveiller via Cloud Console → Authentication →
Users.

---

## État précédent (2026-05-16, Phase 7.52.16 close — buildDemoSnapshot préserve curateur + re-export snapshot)

**Backline v8.14.79 / SW backline-v179 / STATE_VERSION 9 / 993 tests verts.**

Phase 7.52.16 livre le fix pérenne de Phase 7.52.15 côté code +
re-export du snapshot démo depuis le profil curateur
`demo_1778839429588` (qui contient désormais le patch
`ref_guitarist` pour Hotel California, fix manuel via console).

### Fix Phase 7.52.16

`buildDemoSnapshot` (`src/core/state.js`) écrit désormais
`profileIds: ['demo', origId]` au lieu de `['demo']` seul. Donc à
chaque nouvel export :
- Le profil démo bundlé (`'demo'`) garde l'accès via filtre Phase
  7.52.7 strict (`profileIds.includes('demo')`).
- Le profil curateur source garde son ownership (
  `profileIds.includes(origId)` côté `mySetlists`).
- Plus besoin d'éditer manuellement le JSON après export (Phase
  7.52.15 manuel obsolète).

### Snapshot re-exporté avec Hotel California fix

Le snapshot bundlé `src/data/demo-profile.json` est régénéré
depuis le profil curateur après avoir patché manuellement
`aiCache.result.ref_guitarist = "Don Felder / Joe Walsh"` sur la
song Hotel California (`c_1778428303601_rk4y`). Conséquence pour
tous les clients démo (Bruno, Francisco, futurs) au prochain reload :

- À l'ouverture de la fiche Hotel California, le post-processing
  Phase 7.52.6 trouve `JS Wrecked Z Push 1` (slot 19A) via
  substring match "Joe Walsh" dans `ref_guitarist` → score 50 →
  override `preset_ann` cached. Aucun re-fetch IA nécessaire (le
  post-processing s'applique au render).

### Pourquoi Hotel California a fallu être patché manuellement

L'aiCache historique de Hotel California sur le curateur avait
`ref_guitarist: undefined` (fetché avant la version actuelle du
prompt qui demande systématiquement ce champ). Le useEffect fetchAI
de SongDetailCard ne se re-déclenchait pas après invalidation
(sync Firestore rétablissait l'aiCache depuis un autre device,
plus rapidement que l'utilisateur ne pouvait réagir).

Solution pragmatique : injection directe du champ
`ref_guitarist: "Don Felder / Joe Walsh"` dans l'aiCache via
console DevTools, puis re-export du snapshot avec ce patch inclus.

### Architecture livrée

```
src/core/state.js              buildDemoSnapshot : profileIds=['demo']
                                → profileIds=['demo', origId] (Phase 7.52.16)
src/core/state.test.js         test setlists profileIds : assert
                                ['demo', curatorId] + nouveau test
                                pour curateur id non-démo
src/data/demo-profile.json     Re-exporté depuis demo_1778839429588
                                avec ref_guitarist patché sur Hotel
                                California ; profileIds patché à
                                ['demo', 'demo_1778839429588'] manuellement
                                (export pré-Phase 7.52.16, patch
                                équivalent appliqué)
src/main.jsx                   APP_VERSION 8.14.78 → 8.14.79
public/sw.js                   CACHE backline-v178 → backline-v179
```

### Conséquences

- **993/993 tests verts** (+1 nouveau Phase 7.52.16 : préservation
  curateur id non-démo ; +1 mise à jour test existant).
- **Bundle** 2138.88 → 2154.34 KB (+15.5 KB pour le snapshot
  re-exporté avec aiCache complet du curateur, vs ancien snapshot
  potentiellement partiel).
- **Pas de bump SCORING_VERSION** (V9 inchangé).
- **Pas de migration** (additif sur le snapshot, schéma identique).

### Action post-déploiement utilisateur

- **Sébastien Mac/iPhone** : reload PWA 2× pour v8.14.79.
- **Bruno, Francisco** : reload PWA 2× au prochain accès. À
  l'ouverture de Hotel California (s'ils l'ouvrent), reco bascule
  sur JS Wrecked Z Push 1 (19A). Pas d'action requise de leur part.
- **Profil curateur** sur Sébastien Mac : "Demo Setlist" reste
  visible (profileIds inclut son id).

### Entrée roadmap Phase 7.52.16 obsolète

L'entrée "Phase 7.52.16 (proposée) — enterDemoMode merge profileIds"
dans la section "Idées en attente" reste valide en théorie mais
plus prioritaire à implémenter : avec Phase 7.52.16 sur
buildDemoSnapshot, tout nouvel export sort déjà avec profileIds
préservé → l'override par id Phase 7.52.14 préserve naturellement
le curateur. Le merge dans enterDemoMode resterait utile pour des
cas exotiques (snapshot manuel sans curateur, etc.) mais
non-urgent.

---

## État précédent (2026-05-16, Phase 7.52.15 close — snapshot démo préserve curateur)

**Backline v8.14.78 / SW backline-v178 / STATE_VERSION 9 / 992 tests verts.**

Phase 7.52.15 corrige un bug d'écrasement de la "Demo Setlist" sur le
profil de curation Sébastien. Symptôme observé après plusieurs entrées
en mode démo : la "Demo Setlist" disparaissait du profil curateur
`demo_1778839429588` alors qu'elle existait toujours en localStorage.

### Cause

Le snapshot bundlé `src/data/demo-profile.json` avait
`profileIds: ["demo"]` uniquement (généré par `buildDemoSnapshot`
Phase 7.51.4 qui force ce profileIds au profit du profil démo bundlé).

Chaîne d'écrasement :
1. Sébastien curé la "Demo Setlist" sur son profil `demo_1778839429588`
   → `profileIds: ["demo_1778839429588"]` en local.
2. Export snapshot via Phase 7.51.4 → JSON bundle avec `profileIds:
   ["demo"]` (sans curateur).
3. Sébastien entre en mode démo via `?demo=1` ou carte ProfilePicker
   → `enterDemoMode` Phase 7.52.14 `force override par id` : la
   setlist locale est ÉCRASÉE par la version snapshot (même id
   `sl_1778840079421`) qui n'a que `["demo"]`.
4. Sébastien sort du mode démo → une action sur le curateur déclenche
   le persist localStorage → état pollué sauvegardé.
5. Résultat : `mySetlists` du curateur (filtre
   `profileIds.includes('demo_1778839429588')`) ne retourne plus la
   setlist.

### Fix Phase 7.52.15

`src/data/demo-profile.json` : `profileIds: ["demo",
"demo_1778839429588"]` — préserve l'id du curateur dans le snapshot
bundle. À chaque `enterDemoMode`, le `force override par id` injecte
désormais la setlist avec les deux profileIds, donc :
- Le profil démo bundlé (`'demo'`, isDemo:true) la voit en mode démo
  (filtre Phase 7.52.7 strict OK : profileIds inclut 'demo').
- Le profil curateur (`demo_1778839429588`) la voit en mode normal
  (filtre `mySetlists` OK : profileIds inclut son id).

### Léger compromis

L'id du curateur `demo_1778839429588` est désormais visible dans le
bundle prod (`dist/index.html`). C'est un id timestamp sans valeur
sensible, mais sache que si tu changes de profil curateur un jour,
il faudra mettre à jour ce JSON manuellement OU re-modifier
`buildDemoSnapshot` Phase 7.51.4 pour qu'il conserve le profileIds
source au lieu de forcer `['demo']`.

### Architecture livrée

```
src/data/demo-profile.json     Demo Setlist profileIds:
                                ["demo"] → ["demo", "demo_1778839429588"]
src/main.jsx                    APP_VERSION 8.14.77 → 8.14.78
public/sw.js                    CACHE backline-v177 → backline-v178
```

### Action post-déploiement

Sur les devices déjà polluées (Mac Sébastien) :
1. Reload PWA 2 fois pour activer v8.14.78.
2. Sur le profil curateur `demo_1778839429588`, lancer le patch
   console (cf historique chat) pour réajouter `demo_1778839429588`
   aux profileIds de la setlist locale.
3. OU plus simple : entrer dans le mode démo via `?demo=1`, ce qui
   re-déclenchera l'override par id avec le nouveau snapshot bundlé
   v8.14.78 (qui a maintenant le curateur dans profileIds). Sortir
   du mode démo → la "Demo Setlist" sera de nouveau visible côté
   curateur.

---

## État précédent (2026-05-16, Phase 7.52.6 close — match ref_guitarist, fin Phase 7.52)

**Backline v8.14.77 / SW backline-v177 / STATE_VERSION 9 / 992 tests verts.**

Phase 7.52.6 clôt la famille Phase 7.52 (livrée en cascade 7.52 → 7.52.14
sur 2 jours). Dernière dette résiduelle proposée Phase 7.52.5 traitée :
match `ref_guitarist` dans `findSlotByUsageMatch` pour couvrir les cas où
`usages.artist` est un GUITARISTE (ex. "Joe Walsh") alors que `song.artist`
est un GROUPE (ex. "Eagles").

### Bug fixé

Pré-7.52.6, `findSlotByUsageMatch` comparait strictement `song.artist`
à `u.artist` (égalité case-insensitive). Conséquence : sur Hotel
California (Eagles), aucun slot ne matchait via usages :
- `JS Wrecked Z Push 1` a `usages: [{artist: "Joe Walsh"}, {artist:
  "Brad Paisley"}]` → `"Eagles" !== "Joe Walsh"` → pas de pin.
- L'IA fallback sur un slot arbitraire (vu Phase 7.52.5 : `AA VX TB30
  BR Edge` Vox AC30, incohérent pour Eagles).

### Fix Phase 7.52.6

`findSlotByUsageMatch(banks, songArtist, songTitle, refGuitarist)` —
4e param optionnel. Logique étendue :

- **matchArtist** (Phase 7.52.5) reste : `u.artist === song.artist`.
- **matchGuitarist** (nouveau) : `refGuitarist.includes(u.artist)`
  case-insensitive, garde-fou `u.artist.length >= 4` pour éviter les
  faux matches sur termes courts ambigus (`U2` rejeté).
- Score : `(matchArtist OU matchGuitarist) ET matchTitle` = 100,
  sinon `(matchArtist OU matchGuitarist)` seul = 50.

`enrichAIResult` passe `aiResult.ref_guitarist` aux 2 call sites
(annUsage + plugUsage). `ref_guitarist` est une sortie scalaire du
prompt fetchAI (Phase 3+, ex. "Don Felder / Joe Walsh" pour Hotel
California, "Angus Young" pour AC/DC, "Eric Clapton" pour Cream).

### Effet attendu

| Morceau | aiResult.ref_guitarist | Match nouveau |
|---------|------------------------|---------------|
| Hotel California (Eagles) | "Don Felder / Joe Walsh" | JS Wrecked Z Push 1 (score 50) |
| Sweet Child O'Mine (GnR) | "Slash" | JS Brit Silver Dbl Crm OD (score 50) |
| Voodoo Child (Hendrix) | "Jimi Hendrix" | n/a (artist match Phase 7.52.5 déjà) |
| Cream — White Room | "Eric Clapton" | n/a (artist match Phase 7.52.5 déjà) |
| Anything avec ref_guitarist générique "various" (len 7) | matche si "various" en substring d'un u.artist ≥ 4 chars du catalog | risque faible |

### Architecture livrée

```
src/main.jsx                    APP_VERSION 8.14.76 → 8.14.77
public/sw.js                    CACHE backline-v176 → backline-v177
src/app/utils/ai-helpers.js     findSlotByUsageMatch :
                                  +4e param refGuitarist
                                  +matchGuitarist (substring case-insensitive)
                                  +garde-fou u.artist.length >= 4
                                enrichAIResult :
                                  passe aiResult.ref_guitarist aux 2 call sites
src/app/utils/ai-helpers.test.js  +8 tests Phase 7.52.6 (substring composé,
                                  guitariste seul, case-insensitive, regression
                                  null/undefined safe, refGuitarist seul,
                                  garde-fou length, score 100 combo)
```

### Conséquences

- **992/992 tests verts** (+8 nouveaux Phase 7.52.6).
- **Bundle** 2138.24 KB → 2138.86 KB (+0.6 KB).
- **Pas de bump SCORING_VERSION** (V9 inchangé, override d'affichage
  post-scoring).
- **Pas de migration** (signature étendue rétrocompatible — 4e param
  optionnel, comportement Phase 7.52.5 préservé si absent).
- **Cohabitation aiCache existants** : le post-processing s'applique
  à chaque render `enrichAIResult` → effet immédiat à l'ouverture
  du morceau, pas besoin d'invalider les caches.

### Phase 7.52 — Récap complet

| Sous-phase | Sujet |
|------------|-------|
| 7.52 | Catalog Anniversary Premium 150 captures curées |
| 7.52.1 | Usages catalog injectés au prompt IA |
| 7.52.2 | Fix sync iPhone via persistState retry-on-quota |
| 7.52.3 | Audit + correctif noms TSR/WT vs PDF |
| 7.52.4 | findCatalogEntry fallback toneModelName |
| 7.52.5 | Post-processing pin usages-match (titre exact) |
| 7.52.6 | Match ref_guitarist (Joe Walsh, Slash, etc.) ← **CLOS** |
| 7.52.7 | Filtre strict mySetlists en mode démo |
| 7.52.8 | Scroll reset au changement d'écran |
| 7.52.9 | stripDemoFromSetlists — fix pollution profileIds |
| 7.52.10 | Régression 7.52.9 : strip silencieux au boot |
| 7.52.11 | Fix push bloqué par justPulledRef (3s window) |
| 7.52.12 | Fix push annulé par cleanup useEffect |
| 7.52.13 | Logs debug enterDemoMode (laissés volontairement) |
| 7.52.14 | enterDemoMode force override snapshot par id |

**Phase 7.52 close**. Tag `phase-7.52-done` à poser au prochain
commit applicable. Prochaines pistes proposées : 7.53 (édition usages
ToneNET), 7.54 (aiCache per-profile), 9 (output IA enrichi inspiré
Ok_Ask2411). Cf section "Idées en attente" pour détails.

---

## État précédent (2026-05-16, Phases 7.52.7 → 7.52.14 close — session fix sync + mode démo)

**Backline v8.14.76 / SW backline-v176 / STATE_VERSION 9 / 984 tests verts.**

Session matinale 2026-05-16 : 8 phases livrées en cascade pour fixer
3 bugs interdépendants observés sur Mac + iPhone :
1. Mode démo affichait setlists Sébastien polluées (Cours Franck B avec
   'demo' dans profileIds)
2. Sync Mac → iPhone cassée (push Firestore ne se déclenchait pas)
3. Mode démo invisible après clean (Demo Setlist du snapshot pas appliquée)

| Phase | Sujet |
|-------|-------|
| 7.52.7 | Filtre strict mySetlists en mode démo (profileIds.includes('demo')) |
| 7.52.8 | Scroll reset au changement d'écran (header invisible login Mac) |
| 7.52.9 | stripDemoFromSetlists : retire 'demo' polluant de profileIds setlists non-démo |
| 7.52.10 | Régression 7.52.9 : strip silencieux au boot (option `{stamp:false}`) pour éviter loop LWW |
| 7.52.11 | Fix push bloqué par justPulledRef (3s window) via lastPulledHashRef |
| 7.52.12 | Push annulé par cleanup useEffect : move lastSyncHashRef après push success + retire cleanup clearTimeout |
| 7.52.13 | Logs debug temporaires enterDemoMode + mySetlists |
| 7.52.14 | enterDemoMode force override snapshot par id (fix Demo Setlist polluée localement) |

### Détail des fixes

**7.52.7 — Filtre strict mySetlists** : en mode démo (`profile.isDemo
=== true`), `mySetlists` filtre uniquement les setlists dont
`profileIds` inclut explicitement `'demo'`. Mode normal inchangé
(setlists "publiques" sans profileIds visibles à tous).

**7.52.8 — Scroll reset** : `useEffect([screen])` qui appelle
`window.scrollTo({top:0, behavior:'auto'})` à chaque changement
d'écran. Fix bug "header invisible après login Mac".

**7.52.9 + 7.52.10 — stripDemoFromSetlists** : helper pur
(`core/state.js`) qui retire `'demo'` du `profileIds` des setlists
non-démo. Pollution historique : Sébastien a switché un jour vers un
profil curateur nommé `'demo'` (avant Phase 7.51.4 rename) → toggle
partage Phase 5.8 a ajouté `'demo'` aux profileIds des setlists →
syncé Firestore → iPhone pulled.
Appliqué :
- Au boot via `_runFullChain` avec `{stamp: false}` — heal silencieux
  sans toucher `lastModified` (sinon loop LWW : Mac stampe au boot,
  push, iPhone stampe au boot, push, infini).
- Avant push Firestore via `saveToFirestore.prep` avec `{stamp: true}`
  — propage le clean via LWW.

**7.52.11 — Push autorisé post-pull** : `justPulledRef` (Phase 6.1.3)
bloquait tout push pendant 3s après pull, sans retry. Poll = 5s →
60% du temps bloquant. Fix : `lastPulledHashRef` snapshot le hash
juste après adoption pull. Si hash change ensuite (modif user), push
autorisé malgré justPulledRef true.

**7.52.12 — Push debounce préservé** : 2 bugs cumulés :
1. `lastSyncHashRef` updaté DÈS shouldBump=true (avant push) → au
   prochain useEffect re-run, shouldBump=false → push annulé.
2. Cleanup function du useEffect appelait `clearTimeout` à chaque
   re-render → annulait le `setTimeout(2s)` du debounce.
Fix : move `lastSyncHashRef.current = pushedHash` dans `.then()` du
saveToFirestore (post success). Retire le `return () => clearTimeout`
de la cleanup function (jamais utile, App ne s'unmount pas en
pratique).

**7.52.14 — enterDemoMode force snapshot** : le merge `!existingIds.
has(s.id)` original (Phase 7.51.3) skip l'ajout si la setlist existe
déjà en local. Mais le state Mac avait une vieille "Demo Setlist"
héritée du curateur historique avec `profileIds` polluée → snapshot
frais ne s'appliquait jamais → filtre strict 7.52.7 rejetait. Fix :
**override par id** — pour les ids présents dans `snap.setlists` ou
`snap.songs`, retire la version locale et injecte la version
snapshot fraîche. Idem pour songs (rig démo aiCache).

### Architecture livrée

```
src/main.jsx                APP_VERSION 8.14.69 → 8.14.76
                            ligne 477+ : profile derived (inchangé)
                            ligne 510+ : enterDemoMode force override
                                         par id (Phase 7.52.14)
                            ligne 664+ : mySetlists filtre strict mode
                                         démo (Phase 7.52.7)
                            ligne 786+ : lastPulledHashRef (Phase 7.52.11)
                            ligne 828+ : shouldBump SANS update
                                         lastSyncHashRef ici (Phase 7.52.12)
                            ligne 870+ : setTimeout(2s) avec update
                                         lastSyncHashRef dans .then()
                                         + no cleanup clearTimeout
                            ligne 927+ : applyRemoteData reset
                                         lastPulledHashRef au pull
                            useEffect scroll reset au changement screen
                            (Phase 7.52.8)
public/sw.js                CACHE backline-v169 → backline-v176
src/core/state.js           +stripDemoFromSetlists helper pur avec
                            option {stamp: true|false} (Phase 7.52.9+10)
                            _runFullChain applique {stamp: false} au load
src/app/utils/firestore.js  saveToFirestore.prep applique
                            stripDemoFromSetlists (avec stamp:true par
                            défaut) avant strip profils
src/core/state.test.js      +7 tests stripDemoFromSetlists + option
                            {stamp: false}
```

### Résultats

- ✅ **Sync Sébastien Mac ↔ iPhone bilatérale opérationnelle**
- ✅ **Mode démo public** affiche Demo Setlist (11 morceaux) sur tous
  les devices
- ✅ **Header visible** sans scroll après login Mac
- ✅ **Plus de loop LWW** infinie au boot
- ✅ **Push debounce 2s** non annulé par les polls
- ✅ **Pollution profileIds** nettoyée automatiquement au boot et au push
- ✅ **984/984 tests verts** (+7 nouveaux helpers stripDemoFromSetlists)

### Snapshot démo en prod

Demo Setlist 11 morceaux avec recos optimales Phase 7.52.5 :
- 4 AC/DC → AA MRSH JT50 I Drive BAL SCH CAB (Schaffer + JTM-50)
- 2 Cream → AA MRSH SB100 I Edge WRM CAB (Super Bass Plexi 1968)
- BB King The Thrill Is Gone → AA FNDR BFTWN NR Clean (Twin Reverb)
- Stairway → AA MRSH SL100 JU Dimed (Super Lead 1969)
- Wish You Were Here → AA HWTT CUT100 JU Crunch (Hiwatt)
- Hotel California, Smoke on the Water → fallbacks acceptables

### Dette résiduelle Phase 7.52.x

- **Phase 7.52.6** : ✅ livrée 2026-05-16 (cf section "État actuel"
  en haut). Phase 7.52 close.
- **Logs `[demo] Entered demo mode`** restant : utile pour debug
  futur, à laisser.

---

## État précédent (2026-05-16, Phases 7.52.7 + 7.52.8 + 7.52.9 close)

**Backline v8.14.71 / SW backline-v171 / STATE_VERSION 9 / 983 tests verts.**

3 fixes ce matin (2026-05-16) suite tests utilisateur :

### Phase 7.52.9 — Strip 'demo' des profileIds polluées (fix bug démo iPhone)

**Bug observé** : sur iPhone, en mode démo, Sébastien voyait "Cours
Franck B (46)" + "Tous les morceaux (46)" mais pas "Demo Setlist (11)".
Sur Mac OK. La setlist "Cours Franck B" avait `profileIds: ['sebastien',
'arthur_*', 'demo']` → passait le filtre strict Phase 7.52.7
(`profileIds.includes('demo')` est true). La Demo Setlist était bien
là aussi mais l'utilisateur n'a vu que la 1ère.

**Cause vraisemblable** : avant Phase 7.51.4 (qui renomme le profil
curateur en `demo_<timestamp>`), Sébastien avait un profil curateur
nommé exactement `'demo'`. Il a fait des actions (Phase 5.8 toggle
partage de setlist) qui ont ajouté `'demo'` aux profileIds de
plusieurs setlists existantes. La pollution a été syncée Firestore →
tirée sur iPhone.

**Fix Phase 7.52.9** : `stripDemoFromSetlists(state)` helper pur
(`src/core/state.js`) qui retire `'demo'` du `profileIds` des setlists
qui ne s'appellent pas "Demo Setlist". Appliqué :
1. **Au boot via `_runFullChain`** : heal défensif au load localStorage,
   chaque démarrage purge automatiquement les pollutions résiduelles.
2. **Avant push Firestore** dans `saveToFirestore.prep()`
   (`src/app/utils/firestore.js`) — empêche toute repollution Firestore
   depuis Mac.

Stamp `lastModified` sur les setlists modifiées → la sync LWW
Phase 5.7 propage le clean.

### Phase 7.52.8 — Scroll reset au changement d'écran

**Bug rapporté Mac** : après connexion (ProfilePicker → list), il
fallait scroller vers le haut pour voir le header. La page restait
scrollée au milieu.

**Fix** : `useEffect([screen])` qui appelle
`window.scrollTo({top: 0, behavior: 'auto'})` à chaque changement
d'écran. Effet : tu vois toujours header + nav + début du contenu
sans rescroller.

### Phase 7.52.7 — Filtre strict mySetlists en mode démo

**Bug iPhone** : setlists Sébastien sans `profileIds` ou avec
`profileIds: []` considérées "publiques" → visibles en mode démo.
**Fix** : en mode démo (`profile.isDemo === true`), filtre **strict**
— seulement les setlists dont `profileIds` est un Array et inclut
explicitement `'demo'`. Mode normal inchangé.

### Architecture livrée à fin Phase 7.52.9

```
src/main.jsx                    APP_VERSION 8.14.69 → 8.14.71
                                ligne 665 : mySetlists filtre strict
                                en mode démo (Phase 7.52.7)
                                +useEffect scroll reset (Phase 7.52.8)
public/sw.js                    CACHE backline-v169 → backline-v171
src/core/state.js               +stripDemoFromSetlists helper pur
                                _runFullChain applique au load
                                +export stripDemoFromSetlists
src/app/utils/firestore.js      saveToFirestore.prep() applique
                                stripDemoFromSetlists avant strip profils
src/core/state.test.js          +6 tests stripDemoFromSetlists
```

### Action post-déploiement utilisateur

**iPhone** (déjà fait par Sébastien manuellement via console) :
clean des setlists polluées via commande JS. **Demo Setlist visible**
après re-click "Mode démo" sur ProfilePicker.

**Mac** : reload PWA → v8.14.71 actif → au prochain push Firestore
(modif Sébastien), les setlists polluées sont automatiquement
strippées de 'demo' avant push → propagation propre vers tous les
devices.

### Dette résiduelle

- **Bug sync iPhone (rapporté brièvement)** : pas encore investigué
  séparément. Phase 7.52.9 + 7.52.7 peuvent aussi avoir un effet
  positif (moins de pollutions de profileIds → merge LWW plus
  prévisible). À re-vérifier après reload v8.14.71 sur les deux
  devices.



**Bug iPhone 2026-05-16** : Sébastien voyait "Cours Franck B" et autres
setlists Sébastien dans le mode démo iPhone (sur Mac OK car cleanup
récent). Cause : le filtre `mySetlists` (`main.jsx:665`) considérait
comme "publiques" les setlists sans `profileIds` ou avec `profileIds:
[]` → visibles à TOUS les profils, y compris 'demo'. Sur iPhone, des
setlists legacy non-stampées Phase 5.7 (`profileIds` absent ou null)
persistaient en localStorage → polluaient le mode démo.

**Fix Phase 7.52.7** : en mode démo (`profile.isDemo === true`), filtre
**strict** — seulement les setlists dont `profileIds` est un Array et
inclut explicitement `'demo'`. Le snapshot démo bundlé a bien
`profileIds: ['demo']` sur sa Demo Setlist, donc le filtre la garde.
Toute setlist legacy non-taggée ne polluera plus.

Mode normal (profil non-démo) : comportement Phase 5.7 inchangé
(les setlists "publiques" restent visibles à tous, ce qui est le
comportement attendu pour Sébastien sur ses anciennes setlists
historiques).

### Architecture livrée Phase 7.52.7

```
src/main.jsx                    APP_VERSION 8.14.68 → 8.14.69
                                ligne 665 : mySetlists useMemo
                                +branche profile.isDemo : filtre strict
public/sw.js                    CACHE backline-v168 → backline-v169
```

### Phase 7.52.5 livrée + snapshot démo regénéré (rappel)

Snapshot démo curé depuis profil curateur avec catalog Phase 7.52.4 +
post-processing Phase 7.52.5 actifs. 11 morceaux dont 9/11 recos
parfaites :

| Morceau | Reco pin |
|---------|----------|
| Highway to Hell, Back in Black, TNT, You Shook Me | `AA MRSH JT50 I Drive BAL SCH CAB` (Schaffer + JTM-50) |
| White Room, Sunshine of Your Love | `AA MRSH SB100 I Edge WRM CAB` (Super Bass Plexi 1968) |
| The Thrill Is Gone | `AA FNDR BFTWN NR Clean BAL CAB` (Twin Reverb) |
| Stairway to Heaven | `AA MRSH SL100 JU Dimed BAL CAB` (Super Lead 1969) |
| Wish You Were Here | `AA HWTT CUT100 JU Crunch BRI CAB` (Hiwatt) |
| Smoke on the Water | `AA FMAN B100D BE Drive BAL CAB` (Friedman, fallback) |
| Hotel California | `AA VX TB30 BR Edge BAL CAB` (Vox AC30, fallback) |



Phase 7.52.5 livrée + **snapshot démo regénéré** depuis le profil
curateur avec le catalog Phase 7.52.4 + post-processing Phase 7.52.5
actifs. Les 11 morceaux de la setlist démo affichent désormais les
recos optimales :

| Morceau | Reco pin |
|---------|----------|
| Highway to Hell, Back in Black, TNT, You Shook Me | `AA MRSH JT50 I Drive BAL SCH CAB` (Schaffer + JTM-50) |
| White Room, Sunshine of Your Love | `AA MRSH SB100 I Edge WRM CAB` (Super Bass Plexi 1968) |
| The Thrill Is Gone | `AA FNDR BFTWN NR Clean BAL CAB` (Twin Reverb) |
| Stairway to Heaven | `AA MRSH SL100 JU Dimed BAL CAB` (Super Lead 1969) |
| Wish You Were Here | `AA HWTT CUT100 JU Crunch BRI CAB` (Hiwatt) |
| Smoke on the Water | `AA FMAN B100D BE Drive BAL CAB` (Friedman, fallback) |
| Hotel California | `AA VX TB30 BR Edge BAL CAB` (Vox AC30, fallback) |

9/11 recos parfaites, 2 fallback acceptable (Smoke on the Water +
Hotel California — cf Phase 7.52.6 proposée pour fixer Hotel California
via match ref_guitarist).


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

### Phase 7.74.6 (proposée 2026-05-21) — Pollution profile 5e occurrence étendue à `banksAnn`

5e occurrence du pattern Phase 7.74.x observée 2026-05-20 fin d'aprem
sur `banksAnn` Sébastien (23C vidé + 18C Supergroupbass remplacé).
Déclencheur soupçonné : session Claude Cowork avec mode démo +
multi-switchs profil. **Protocole d'investigation complet dans
`docs/INVESTIGATION_POLLUTION_PROFILE.md`** — à exécuter via Cowork
en mode no-sync `?beta=1` lors d'une prochaine session pour identifier
la cause racine avant de coder un fix générique.

### Dette UX — Dates JJMMAA dans noms de fichiers export

**Demande Sébastien 2026-05-21** : les exports CSV / JSON utilisent
actuellement le format ISO `YYYY-MM-DD` dans les noms de fichiers
(ex: `backline_2026-05-21.json`). Sébastien préfère le format français
court **JJMMAA** (ex: `210526` pour 21 mai 2026), plus pratique pour
classement chronologique côté Mac.

**Sites concernés** :
- `src/app/utils/csv-helpers.js` ligne 12 : `exportJSON` →
  `backline_${new Date().toISOString().slice(0, 10)}.json`
- À auditer : autres exports CSV (snapshots manuels Phase 7.59-A,
  Maintenance JSON export, etc.) qui utilisent `new Date()` dans le
  filename

**Implémentation** :
```js
function formatDateJJMMAA(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aa = String(d.getFullYear()).slice(2);
  return `${dd}${mm}${aa}`;
}
```

Helper à exposer depuis `core/branding.js` ou nouveau `core/date-utils.js`.
Remplacer tous les `new Date().toISOString().slice(0, 10)` dans les
filenames d'export par cet helper.

**Effort estimé** : ~30 min (helper + grep/replace des call sites +
tests Vitest).

**Priorité** : faible. UX confort, pas bloquant. À grignoter
opportunistment lors d'une prochaine session courte.

### Phase 7.82 — ✅ LIVRÉE 2026-05-20 (cf section "État actuel" en haut)

Audit Chrome MCP démo en EN livré 2026-05-19, 6 problèmes identifiés.
Phase 7.82 livrée 2026-05-20 v8.14.147 : Bug #0 (locale démo) fixé,
mode scène désactivé en démo, strings #1-5 wrappés, fix `tPlural`
format plat (cause racine #3). Bug #6 reporté hors démo. Mail 3 Paul
Drew débloqué.

### Phase 7.84 — ✅ LIVRÉE 2026-05-20 (v8.14.149) — Explorer i18n + 167 desc ampli EN

Voir section "État actuel (2026-05-20 après-midi)" en haut de CLAUDE.md
pour le détail. Wrapping i18n PresetBrowser/PresetDetailInline/PresetList,
167 desc_en ajoutées dans data_context.js, ZIP brut masqué. Problème 3
(scores nus) reporté Phase 7.83.

**Notes design conservées pour référence** :

### Phase 7.84 (contexte design — livrée) — Explorer : i18n PresetDetailInline + polish fiche capture

**Contexte** : audit Chrome MCP de la démo EN du 2026-05-20 (v8.14.148),
en ouvrant une fiche capture TSR dans Explorer (search "Friedman" →
"TSR - Freeman BE DE - High Gain"). Le **catalogage lui-même est
exact et respectueux** (nom de capture fidèle, ampli correctement
identifié, description d'ampli connaisseuse, regroupement par ampli
source correct). Mais 3 problèmes d'affichage relevés, à corriger
avant tout showcase Explorer à un créateur de packs anglophone
(Paul Drew TSR, ou cible Phase 11).

#### Problème 1 (le plus gros) — fiche Explorer entièrement en français

Le composant `PresetDetailInline` (la fiche dépliée d'une capture
dans Explorer, BankEditor, JamScreen) **reste 100% en français en
mode EN**. Constaté en mode démo EN : titres de sections "INFOS
AMPLI / PRESET", "STYLE & GAIN", "MORCEAUX MYTHIQUES — REGISTRE
LEAD / HIGH GAIN", "GUITARES ADAPTÉES" ; descriptions d'ampli
("Le Friedman BE-100 (Brown Eye) est un modern classic…") ;
libellés gain/style ; boutons "Non installé". Aussi : les en-têtes
de l'écran Explorer lui-même — "MODÈLE D'AMPLI" et "N PRESETS —
CLIQUE POUR VOIR LA FICHE" — restent FR.

Le haut d'Explorer (catégories "Clean sounds", etc.) est bien
traduit, mais dès qu'on creuse (browse par ampli + fiche capture)
c'est un mur de français. Un visiteur anglophone qui explore
— et un créateur curieux ira voir comment SES captures sont
présentées — tombe sur une fiche FR. Ce n'est pas du catalogage
irrespectueux, c'est une dette i18n, mais ça fait paraître
l'Explorer inachevé. **Nettement plus gros que les résidus i18n
notés en dette Phase 7.82** (`<html lang>`, `APP_TAGLINE`).

Action : wrapper `t()` sur `PresetDetailInline` + les en-têtes de
`PresetBrowser`/Explorer. Volume : ~20-30 clés EN/ES. Les
descriptions d'ampli (issues de `data_context.js`) sont un cas à
part — soit les traduire, soit accepter qu'elles restent FR (gros
volume de prose). À trancher.

#### Problème 2 (mineur) — nom de ZIP brut exposé

La fiche capture affiche "📄 TSR-Freeman-BE-DE-idSzii.zip" — le
nom de fichier ZIP interne du pack (avec suffixe hash). Plomberie
interne visible. Soit le masquer, soit afficher un libellé propre
(nom de pack commercial). Cohérent avec Phase 7.76 (labels Sources
nettoyés).

#### Problème 3 (mineur) — scores non labellisés en liste

Dans les rangées de la liste Explorer, le triplet de scores coloré
(ex. "92 60 72") s'affiche **sans en-tête** → peut se lire comme
une note de qualité de la capture. Dans la fiche dépliée c'est
clair (section "Guitares adaptées" + jauges + %), mais pas dans la
liste. Ajouter un libellé discret (ex. "HB · SC · P90" en en-tête
de colonne) ou un tooltip. Couplé naturellement à Phase 7.83
ci-dessous (qui supprime carrément les scores nus au profit de
catégories).

**Effort estimé Phase 7.84** : ~2-3h (le gros est le wrapping i18n
de PresetDetailInline). Pas de bump STATE_VERSION. Priorité : à
faire avant d'inviter un créateur anglophone à explorer Explorer
en profondeur (Phase 11). Non bloquant pour le Mail 3 Paul (qui
reste un "30s look" sur le Home).

### Phase 7.83 — ✅ LIVRÉE 2026-05-20 (v8.14.150) — Compatibilité guitare qualitative 3 niveaux

Voir section "État actuel (2026-05-20 fin d'après-midi)" en haut de
CLAUDE.md pour le détail. Helper bucketizeScore + groupByBucket,
refactor PresetBrowser section "Guitares adaptées" en sections
groupées, refactor liste presets pastilles HB/SC/P90 sans chiffre +
en-tête colonne, aligned MyCustomPresetsTab sur 3 niveaux. 12 tests
Vitest. Nommage musical "Mariage parfait / Bon match / Compromis"
choisi vs sobre.

**Notes design conservées pour référence** :

### Phase 7.83 (contexte design — livrée) — Compatibilité guitare qualitative 3 niveaux dans Explorer

**Contexte** : la section "🎸 Guitares adaptées" de la fiche capture
Explorer (et le dropdown `GuitarSelect`) affiche chaque guitare avec
un **score brut en %** (84%, 64%, 52%, 51%, 50%, 49%…) + jauge,
trié décroissant.

**Problème** : le score brut suggère une précision que le scoring
V9 heuristique n'a pas — afficher "Strat Pro II 51%" vs "Strat 61
50%" laisse croire à un classement signifiant entre deux Strat
single-coil alors que c'est du bruit. Et "64%" ne dit pas à
l'utilisateur quoi faire : la cible (guitariste amateur un peu
perdu, type Francisco) ne sait pas si 64% est bon ou mauvais.

**Précédent interne** : Phase 7.69.13 a déjà introduit des "scores
compatibilité qualitatifs (4 niveaux)" — mais uniquement dans
l'éditeur de presets custom. Phase 7.83 étend la même logique
qualitative à l'affichage Explorer (cohérent, pas un nouveau
paradigme — aligner le nombre de niveaux serait idéal).

**Design proposé** :
- **3 niveaux** (4 réintroduit la granularité ; 2 perd le coup de
  projecteur "match parfait"). Nommage à trancher, garder le 3e
  niveau neutre/positif (pas "les moins adaptées" déprimant) :
  - Set musical : 🟢 Mariage parfait · 🟡 Bon match · 🟠 Compromis
  - Set sobre : 🟢 Idéal · 🟡 Adapté · 🟠 Dépannage
- **Format** : sections groupées avec un en-tête par niveau, les
  guitares listées dessous (plus scannable qu'un badge par ligne
  pour la cible).
- **Retirer le % de la vue par défaut**, garder pastille couleur
  (+ jauge éventuelle). Optionnel : révéler le % au tap/survol
  pour les power-users.
- **Caveat** : un seuil dur garde l'arbitraire 59%/61%, juste
  caché derrière un mot — mais 3 buckets absorbent le bruit et un
  mot ne donne pas l'illusion de mesure. Calibrer les seuils sur
  la **distribution réelle du catalog**, pas un exemple isolé.

**Bénéfice double** : (1) plus actionnable pour l'utilisateur
cible ; (2) désamorce le risque "score nu lu comme une note de
qualité" côté créateur de packs (un label "Compromis" se lit comme
un conseil de fit, "49%" comme une note — cf Phase 7.84 problème 3).

**Périmètre** : contextes liste-de-guitares — section "Guitares
adaptées" d'Explorer (`PresetDetailInline`) + probablement le
dropdown `GuitarSelect`. Le "Compatibility: 87%" de la fiche
morceau (un seul chiffre, une seule guitare) est un autre contexte,
moins prioritaire. **Pas de bump SCORING_VERSION** — le scoring V9
reste inchangé, c'est purement une couche d'affichage qui bucketise
les scores existants.

**Effort estimé** : ~3-4h (helper de bucketisation + UI sections
groupées + nommage i18n FR/EN/ES + calibration des seuils). Idéal
à coupler avec Phase 7.84 (les deux touchent `PresetDetailInline`).

### Phase 7.79.3 — ✅ LIVRÉE 2026-05-20 (v8.14.151 → 8.14.153, 3 sous-phases)

Cascade 4 niveaux usages livrée en 3 sous-phases :
- **Phase 7.79.3a** (v8.14.151) — Helpers purs cascade + extension findCatalogEntry
- **Phase 7.79.3b** (v8.14.152) — Routing saveUsagesForPreset 4 niveaux + UI badges + bouton Restaurer
- **Phase 7.79.3c** (v8.14.153) — Sync Firestore (push profile.usagesOverrides via push profil habituel,
  merge per-item LWW shared.usagesOverrides au pull) + syncHash + propagation multi-device

Voir section "État actuel" pour le détail technique. 44 tests Vitest
dédiés (28 cascade + 16 routing). `shared.studioUsages` est un slot
prêt pour Phase 11 Studio-driven.

**Notes design conservées pour référence** :

### Phase 7.79.3 (contexte design — livrée) — Cascade 3 niveaux user > studio > backline > default

**Contexte** : Phase 7.78 + 7.79 + 7.79.2 livrent la curation runtime
**uniquement** pour custom + ToneNET (`EDITABLE_SOURCES = {'custom',
'ToneNET'}`). Les catalogs statiques (TSR/AA/JS/TJ/WT/Galtone/ML/
Anniversary/Factory/PlugFactory) restent en mode lecture seule depuis
l'UI — l'admin doit éditer le code source pour les enrichir.

**Insight user 2026-05-19 soir** : *"je pense effectivement qu'il va
falloir prévoir 2 voire 3 curations : 1. User 2. Backline 3. Studio.
On verra laquelle gagne mais User doit passer devant je pense puis
Studio puis Backline"*.

**Design validé** : hiérarchie 3 niveaux avec cascade de résolution.

#### Architecture data

```
profile.usagesOverrides: {                 ← Niveau 1 (priorité max) — User perso
  [presetName]: {
    usages: [{artist, songs?}] | null,     // null = override "vide explicite"
    lastModified: number,
  }
}
shared.studioUsages: {                     ← Niveau 2 — Studio (Phase 11 future)
  [presetName]: {
    usages: [...] | null,
    curatedBy: studioId,                   // 'TSR', 'AA', 'JS', etc.
    lastModified: number,
  }
}
shared.usagesOverrides: {                  ← Niveau 3 — Backline admin runtime
  [presetName]: {
    usages: [...] | null,
    lastModified: number,
  }
}
// Niveau 4 : catalog.entry.usages (default code source, le moins prioritaire)
```

#### Cascade lecture

```js
resolveUsagesCascade(presetName) → { usages, source }
  // Itère niveaux 1→4, retourne le premier non-null
  1. profile.usagesOverrides[name]?.usages   → source='user'
  2. shared.studioUsages[name]?.usages       → source='studio' (+ curatedBy)
  3. shared.usagesOverrides[name]?.usages    → source='backline'
  4. catalog.entry.usages                     → source='default'
  // Si aucun non-null → null
```

Chaque écran qui affiche les usages reçoit aussi la `source` pour
afficher un badge subtil :
- 👤 *Toi* (user perso)
- 🏷️ *Studio (TSR)* (Phase 11)
- ⚙️ *Backline*
- 📦 *Catalog* (default, pas de badge ou badge discret)

#### Routing écriture

`saveUsagesForPreset(name, usages, ctx)` étendu — route selon `entry.src`
ET `ctx.isAdmin` :

| Entry.src | User non-admin | User admin |
|---|---|---|
| `custom` | profile.customPacks | profile.customPacks |
| `ToneNET` | shared.toneNetPresets | shared.toneNetPresets |
| Catalog statique (TSR/AA/JS/...) | **profile.usagesOverrides** | **shared.usagesOverrides** |

→ Bruno/Francisco peuvent curer TSR perso (priorité user).
→ Sébastien admin cure pour tout le monde via shared (niveau Backline).
→ Le user qui curé perso voit TOUJOURS sa curation user en priorité,
   même si l'admin Backline pousse une autre curation après.

#### Helpers à écrire

- `resolveUsagesCascade(entry, profileOv, studioOv, backlineOv)`
  retourne `{usages, source, curatedBy?}` — pure, testable.
- `mergeUsagesOverridesLWW(local, remote)` per-item LWW Firestore
  (pattern Phase 7.53.1 toneNetPresets).
- `saveUsagesOverride(name, usages, level, ctx)` écrit selon `level`
  ('user' | 'studio' | 'backline').
- Extension `findCatalogEntry` : lit `window._usagesOverridesLookup`
  (synchronisé depuis profile + shared au boot, pattern Phase 7.52.4
  `_toneNetLookup`) et merge usages dans l'entry retourné avec source
  badge.

#### UI dans UsagesSection (PresetDetailInline) et PresetCurationModal

- Affiche les usages résolus + **badge source** subtil à côté du titre
  de section ("🎯 Usages curés · 👤 Toi" ou "⚙️ Backline" etc.)
- Bouton "✏️ Modifier" disponible pour **TOUS les users** (admin ou non)
  sur les catalogs statiques — mais routé différemment :
  - Non-admin → écrit profile.usagesOverrides[name] (perso)
  - Admin → écrit shared.usagesOverrides[name] (Backline)
- Message info si user écrit par-dessus une curation existante d'un
  autre niveau :
  *"Ta curation perso prendra le pas sur la curation Backline (priorité
  user). Toi seul la verras."*
- Bouton secondaire "🔄 Restaurer Backline / Catalog" pour retirer
  l'override perso et hériter du niveau suivant dans la cascade.
- Distinction visuelle entre **"Ajouter usages"** (création) et
  **"Override existant"** (modifier ou retirer pour revenir au default).

#### Schéma localStorage

Additif sur `profile` (nouveau champ `usagesOverrides`) et `shared`
(nouveaux champs `usagesOverrides` et `studioUsages` — ce dernier
slot vide pour Phase 11). **Pas de bump STATE_VERSION** (champs
optionnels, pas de migration nécessaire — les profils existants
adoptent au pull Firestore via merge LWW).

#### Sync Firestore

- `profile.usagesOverrides` → push via push profil habituel (sync
  per-profile LWW Phase 5.7). Stamp `profile.lastModified` à chaque
  write d'override.
- `shared.usagesOverrides` → push via push shared habituel. Merge
  per-item LWW via `mergeUsagesOverridesLWW` au pull (pattern Phase
  7.53.1).
- `shared.studioUsages` → idem que shared.usagesOverrides (Phase 11
  future). Pas écrit par Backline actuellement.

#### syncHash

Ajouter `profile.usagesOverrides` dans le hash (sinon push ne se
déclenche pas au stamp). Pour shared, `lastModified` global stamping
suffit (déjà câblé). Cf Phase 7.46 pour le pattern.

#### Tests Vitest

- `resolveUsagesCascade` × 8 tests : tous niveaux non-null (chacun
  gagne), user gagne sur backline, backline gagne sur catalog, slot
  studio vide, niveau null explicite ne pas tomber sur le suivant
  (override "vide intentionnel"), entry null safe.
- `mergeUsagesOverridesLWW` × 4 tests : local plus récent, remote
  plus récent, local-only, remote-only.
- `saveUsagesOverride` routing × 6 tests : user non-admin → profile,
  user admin → shared, niveau explicite 'user'/'backline', stamp
  lastModified, null = retire l'override.

#### Effort estimé

~4-5h dev + ~30 min tests + ~15 min déploiement = ~5h total.

Découpage possible si besoin :
- **Phase 7.79.3a** : helpers cascade + extension `findCatalogEntry`
  + tests (~2h, purement backend)
- **Phase 7.79.3b** : UI badges + routing saveUsagesForPreset + boutons
  Modifier sur catalogs statiques + bouton "Restaurer" (~2h)
- **Phase 7.79.3c** : merge LWW Firestore + syncHash + propagation
  Mac↔iPhone + déploiement (~1h)

#### Trade-offs et limites

- **Volume Firestore** : si Sébastien cure 50 presets via Backline +
  beta-testeurs curent 10-20 chacun en perso, l'overhead localStorage
  reste modeste (~5-10 KB total). Pas de risque de saturation.
- **Conflit user vs Backline** : par design, l'override user gagne.
  Si Backline pousse une nouvelle curation officielle qui devrait
  écraser la perso, l'user doit explicitement cliquer "🔄 Restaurer
  Backline". C'est intentionnel — respect du choix user.
- **Visibilité admin** : l'admin Backline (Sébastien) ne voit PAS les
  curations user perso des beta-testeurs (par design — profile.usagesOverrides
  est per-profile, comme les analyses IA perso). Si besoin de vue
  admin "toutes les curations user" pour modération, ajouter une route
  Phase 7.79.4.
- **Phase 11 préparée** : `shared.studioUsages` slot est créé mais non
  écrit en MVP. Quand Phase 11 (Studio-driven) démarre, il suffit
  d'ajouter le compte studio + le routing studio → shared.studioUsages,
  la cascade fonctionne déjà.

#### Quand activer

Demain frais (2026-05-20) ou plus tard selon priorités. Le user a
explicitement validé le design 2026-05-19 soir mais a opté pour
**option B (documentation, livraison reportée)** car la soirée du
2026-05-19 était déjà bien chargée (11 phases livrées en cascade).

**Bénéficiaires immédiats à la livraison** :
- Sébastien admin : peut curer TSR/AA/JS/TJ/WT/Galtone/ML directement
  depuis l'UI Backline sans toucher au source code.
- Bruno + Francisco + futurs beta-testeurs : peuvent ajouter leurs
  curations perso sur les presets factory et catalog statique sans
  attendre l'admin.

### Phase 7.80 (à investiguer 2026-05-19) — 2 dettes critiques observées

**Dette 1 — Revue UX/UI responsive complète**

Audit complet du responsive design à mener. Identifié 2026-05-19 par
Sébastien : problèmes ponctuels d'affichage sur iPhone (header tronqué,
overflow inputs, boutons trop petits cf B-COSM-03 Phase 7.50) et iPad
portrait (layout desktop tassé). Auditer systématiquement chaque écran :
- HomeScreen (SongSearchBar overflow iPhone Phase 7.55.7)
- AppHeader (version label tronquée)
- ListScreen (badges desktop ellipsis vs mobile)
- BankEditor (sélecteurs A/B/C tactiles)
- SongDetailCard (sections empilées)
- LiveScreen (mode iPad portrait + paysage)
- MesAppareilsTab (sections device empilées, modales)
- Modales (ResolveUnknowns, CurateNonCurated, PresetCuration —
  particulièrement scroll mobile)
- Tabs MonProfilScreen / AdminScreen (scroll horizontal)

À faire idéalement avec :
- iPhone réel + Safari iOS (PWA installée)
- iPad Pro M4 réel
- Chrome DevTools responsive mode (375x667 / 390x844 / 412x915 / 834x1194)

Effort estimé : ~6-10h audit + ~10-15h fixes selon profondeur.
Trigger : à activer après stabilisation pollution myGuitars OU si
beta-testeurs remontent des cas concrets bloquants.

**Dette 2 — Sync analyses IA Mac ↔ iPhone défectueuse**

Symptôme observé 2026-05-19 : Sébastien rapporte que les analyses IA
calculées sur Mac ne descendent pas sur iPhone (et vice-versa). Il
doit relancer le calcul sur chaque device. Phase 7.54 (aiCache
per-profile via `profile.aiCache[songId]`) était censée résoudre ça
via stockage profil + sync Firestore standard.

Hypothèses à investiguer :
1. **Strip aiCache au push** : Phase 7.58 strip `profile.aiCache` des
   profils NON-ACTIFS au push si compressed > SAFE_LIMIT (980 KB
   Phase 7.58.1). Si état Sébastien dépasse encore le seuil après
   compression, son aiCache personnel pourrait être strippé.
2. **Merge LWW per-field** : Phase 7.74 Couche 2 `mergeProfileLWW`
   per-field — vérifier que `profile.aiCache` est bien dans la liste
   des champs adoptés (peut-être omis du merge → garde local toujours
   au lieu d'adopter remote).
3. **`stamp` lastModified manquant** : si écriture aiCache (cf
   `setSongAiCache` main.jsx Phase 7.54) ne stamp pas
   `profile.lastModified`, le merge LWW ne tranche pas en faveur du
   profil avec le nouveau cache.
4. **`syncHash` Phase 7.46** : vérifier que `profile.aiCache` est inclus
   dans le hash → sinon push ne se déclenche pas après nouvelle analyse.
5. **Régression Phase 7.54.x** : couche shared.aiCache legacy supprimée
   Phase 7.54.1 mais profile.aiCache pas correctement adopté au pull.

Diagnostic pratique :
1. Sur Mac : faire une analyse IA d'un morceau (ex Highway to Hell).
2. Console : `JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.aiCache['acdc_highway_to_hell']`
   → doit retourner l'objet aiCache.
3. Attendre ~5s (debounce push) → vérifier qu'un push Firestore
   s'est déclenché (log `[firestore] Push WITH aiCache` dans console).
4. iPhone : recharger, attendre pull initial (~5-10s).
5. Console iPhone (via Safari Mac → Develop → iPhone) :
   `JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.aiCache['acdc_highway_to_hell']`
   → doit retourner le même objet.
6. Si étape 5 vide → bug merge / pull. Si étape 3 absent → bug push
   (syncHash ou stamp).

Effort estimé : ~2-4h investigation + fix selon cause.
Trigger : prioritaire — affecte directement l'expérience principale
(coût Gemini ×2, friction utilisateur, défaut perçu critique sur
multi-device).

### Phase 7.73.2 (proposée 2026-05-19, Session A LIVRÉE 2026-05-23, Sessions B+C en attente) — Refonte Mon Profil

**Contexte** : Phase 7.72 a séparé Mon Profil / Admin. Phase 7.73.0+.1 ont
ajouté le bouton feedback Tally + intégré CSV dans device tabs.

**Validation user 2026-05-19** : Full scope OK sauf "BPM cible préféré"
et "Tuning par défaut" écartés. Bouton Tally feedback intégré dans
l'onglet (en plus du footer Phase 7.73.0).

**Structure finale validée 2026-05-23** : pivot vs proposition initiale
2026-05-19 :
- Ajout du tab "⚙️ Préférences" séparé (au lieu de tout fourrer dans
  Mon compte) → 2 tabs distincts au lieu d'1 fourre-tout
- Renommages "🎸 Guitares" → "🎸 Mes guitares", "📦 Sources" → "📦
  Mes sources" pour cohérence avec "Mes appareils" / "Mes presets
  custom"

**Plan de livraison en 3 sessions** :

| Session | Items | Effort | Status |
|---|---|---|---|
| **A — Refonte tabs + ⚙️ Préférences** | Tab "⚙️ Préférences" (Affichage + Préférences IA + 🎵 Préférences musicales NOUVEAU) + renommages "Mes guitares"/"Mes sources" + retrait tabs séparés display/reco | ~1h30 | ✅ LIVRÉE 2026-05-23 (v8.14.175) |
| **B — Cœur Mon compte** | Tab "👤 Mon compte" en premier : Identité (avatar+nom+bio+email) + Sécurité (migration PasswordTab) + Mes données (export/import perso) + retrait tab Password séparé | ~3h | ⏳ Pending |
| **C — Finitions** | Activité (stats read-only) + Communauté (partages reçus) + Aide (relance tuto + Tally + mailto + version + CHANGELOG) | ~2h | ⏳ Pending |

Cf section "État actuel" pour Session A détaillée. Sections B et C
documentées ci-dessous.

#### Composant `MonCompteTab.jsx` (premier tab MonProfilScreen)

Sections :

**👤 Identité**
- Avatar (photo, optionnel — réutilise `image-resize.js` Phase 7.29.9)
- Nom (édition)
- Bio courte (1-2 lignes, max 200 chars, optionnel)
- Email (optionnel — pour récupération password + contact admin)
- Badges read-only : ADMIN / BETA / DEMO selon profile

**🎵 Préférences musicales**
- Styles préférés (multi-select : blues/rock/hard_rock/jazz/metal/pop)
- Stocké dans `profile.preferredStyles: string[]`
- Pas de BPM cible ni tuning par défaut (écartés par user)

**🔐 Sécurité**
- Migration PasswordTab existante : changer mot de passe (current +
  next + confirm, hashPassword via WebCrypto Phase 7.28)
- Historique de connexion (5 dernières + admin_switch Phase 7.63)
- Trusted devices (vue + bouton "Révoquer cet appareil") — nouveau

**💾 Mes données**
- "⬇ Exporter mes données (JSON)" — filtré profil actif uniquement :
  rig + customPacks + customGuitars + banksAnn/Plug + toneNetPresets
  perso + aiCache perso + setlists où profileIds inclut moi
- "📂 Importer mes données" (JSON personnel)
- "🗑 Réinitialiser mon profil" (confirm + reset profile sauf id/name/
  password/loginHistory)

**📊 Activité (read-only)**
- Date d'inscription : depuis `loginHistory[0]` (extraction first timestamp)
- Nb setlists possédées (filter par profileIds)
- Nb morceaux analysés IA (count `profile.aiCache`)
- Nb feedbacks donnés (count cumulé `song.feedback[]` mes entries)
- Nb customs créés (count `profile.customPacks` flatten presets)

**🤝 Communauté**
- Partages reçus : "Sébastien a partagé X setlist avec toi"
  (filter setlists où profileIds inclut moi MAIS le owner principal
  est un autre profile)
- Vue read-only initialement, action "Retirer mon accès" plus tard

**💬 Aide**
- Bouton "🎓 Relancer le tutoriel" (relance OnboardingWizard via
  `window.setShowOnboarding(true)` — mécanisme existant Phase 1)
- Bouton "💬 Envoyer un feedback" (réutilise `buildFeedbackUrl` Phase
  7.73.0 — Tally pré-rempli profile_name + app_version)
- Bouton "📧 Contacter l'admin" (mailto pré-rempli)
- Version Backline affichée + lien CHANGELOG

#### Tab order après Phase 7.73.2

1. **👤 Mon compte** (NOUVEAU, premier tab — remplace position "🎸 Guitares")
2. 🎸 Guitares
3. 📱 Mes appareils
4. 📦 Sources
5. 📦 Mes presets custom
6. 🎛 Pedale ToneX / Ann / Plug (si device — CSV intégré Phase 7.73.1)
7. 🎚️ Patches TMP (si device)
8. 🎨 Affichage
9. 🎯 Préférences IA
10. ~~🔐 Mot de passe~~ (migré dans Mon compte → 🔐 Sécurité)

= 9 onglets (admin) ou 9 onglets (non-admin). Net -1 vs Phase 7.73.1.

#### Schema data extensions

- `profile.avatar: string` (data-URL JPEG via `resizeImageToDataUrl`,
  ~30 KB optimisé Phase 7.29.9). Déjà supporté en théorie (champ
  optional). Pas de bump STATE_VERSION.
- `profile.bio: string` (optionnel, max 200 chars)
- `profile.email: string` (optionnel)
- `profile.preferredStyles: string[]` (multi-select)

Tous additifs, optional, pas de bump STATE_VERSION ni migration.

#### Effort estimé

- Squelette + Identité (avatar + nom + bio + email) : ~1h
- Sécurité (migration PasswordTab) : ~30 min
- Mes données (export/import perso) : ~1h
- Activité (stats) : ~1h
- Communauté (partages reçus) : ~30 min
- Aide (relance tuto + Tally + mailto + version) : ~30 min
- Préférences musicales : ~30 min
- Wiring tab order + retrait PasswordTab : ~30 min

**Total : ~5-6h.**

**Décision actuelle** : proposée, à activer dans la prochaine session.
User a redéfini le scope plus tôt dans la session. Tous les helpers
nécessaires existent déjà (hashPassword, image-resize, buildFeedbackUrl).

### Phase 7.70 (proposée 2026-05-19) — Code couleur curation preset dans BankEditor

**Contexte** : Phase 7.69.x a livré le workflow d'import CSV avec
modale presets inconnus. Sébastien a constaté que la vue BankEditor
(Mon Profil → 🎛 Pedale / Ann / Plug) ne distingue pas visuellement
les presets selon leur statut de curation. Difficile de savoir d'un
coup d'œil : ce slot est-il bien renseigné côté metadata IA, ou
juste un nom brut sans pin direct possible ?

**Taxonomie en 4 catégories** (5e prévue Phase 11) :

| État | Couleur | Critère technique | Sémantique |
|------|---------|-------------------|------------|
| 🔴 Inconnu | rouge wine | `!entry \|\| entry.guessed === true` | Scoring V9 dégradé (fallback `guessPresetInfo` heuristique). Pas de pin IA possible. |
| 🟠 Connu non curated | brass clair / jaune | `entry && !entry.guessed && !entry.usages?.length` | Scoring V9 OK (amp/gain/style/scores) mais pas de pin direct artiste/morceau. |
| 🟢 Curated admin | vert accent | `entry.usages?.length > 0` ET `src` ∈ {Factory, FactoryV1, Anniversary, PlugFactory, TSR, ML} | Catalog statique curé par Sébastien. Pin direct IA PRIORITÉ 1. |
| 🔵 Curated perso | bleu/cyan | `entry.usages?.length > 0` ET `src === 'custom'` | Custom user enrichi Phase 7.69. Pin direct IA. |
| 🟣 Curated studio (Phase 11) | violet brass | nouveau flag `entry.curatedBy === 'studio'` | Quand TSR/ML/AA enrichira eux-mêmes. Inactif Phase 7.70. |

**3 décisions design retenues** (à valider au moment de coder) :
- ToneNET (`src === 'ToneNET'`) : traité comme **curated perso**
  si `usages?.length > 0`, sinon **connu non curated**. C'est le
  user qui les saisit/tague via tab ToneNET (Phase 7.53).
- Custom sans usages : traité comme **connu non curated**. La
  curation = `usages` set, point.
- Slot vide (`bank[slot] === ''`) : **pas de pastille**.

**Scope** :
- Phase 7.70 : `BankEditor.jsx` uniquement (pastille 6×6px + tooltip
  hover avec label de la catégorie).
- Phase 7.70.1 (optionnel) : étendre à `ListScreen` vue dépliée.

**Implémentation** :
- Helper pur `getPresetCurationStatus(name)` dans
  `src/core/catalog.js` → `'unknown' | 'known' | 'curated-admin' | 'curated-perso'`.
- Constante `CURATION_COLORS` (tokens.css ou module React partagé).
- ~6 tests Vitest sur le helper.

**Effort estimé** : ~1-2h dev.

**Décision actuelle** : design validé 2026-05-19 par Sébastien,
implémentation reportée à plus tard. À activer quand un autre
chantier prioritaire (Phase 8 pédales / Phase 9 knob settings /
Phase 11 studios) n'est pas en cours, ou si Sébastien remonte
explicitement le besoin pendant un test BankEditor.

### Phase 8 (validée 2026-05-17 — 2 signaux indépendants Francisco) — Recommandation pédales modélisées

**Status mis à jour 2026-05-17 soir** : promue de mention diffuse
("Phase 8+") à **dette validée par 2 signaux user** :

1. **Francisco commentaire Reddit initial** (2026-05-15) :
   *"¿Le pediste también pedales para usar con la pedalera
   AmpliTube?"* — 1ère mention.
2. **Francisco message 17 mai soir** : *"Piensa en los pedales.*
   *Se que tonex no trabaja con pedales excepto overdrive. Pero*
   *para sacar el tono de una guitarra es algo muy importante."* —
   2ème mention explicite, confirme l'importance perçue côté user.

**Scope envisagé Phase 8** :
- Recommander pédales modélisées (chorus, delay, reverb, phaser,
  flanger, tremolo, vibrato, etc.) pour chaque morceau
- Base de données pédales similaire à `PRESET_CATALOG_MERGED` mais
  pour les FX classiques (Boss CE-2, EHX Memory Man, Strymon Big
  Sky, etc.)
- Mapping morceau → pédales historiquement utilisées via prompt IA
  (et/ou catalog statique pour les cas iconiques)
- Affichage dans la fiche song : section "Pédales recommandées"
  séparée des recos preset capture
- Compatible AmpliTube (suggestion Francisco) : si user a AmpliTube,
  lister les noms équivalents AmpliTube de chaque pédale

**Effort estimé** : chantier majeur, ~20-40h dev :
- Construire base de données pédales (manual curation ou scraping)
- Étendre le prompt IA pour retourner `pedals_used: [{name, params}]`
- Schema localStorage extension (bump STATE_VERSION 10 → 11)
- UI section dédiée
- Tests Vitest

**Timing** : **après Phase 7.61 + 7.64 + 9** (les 3 dettes
prioritaires actuelles). Probably **fin juin / juillet** si
bandwidth.

**Dépendances ouvertes** :
- Bass Elliot (TSR_PACK_GROUPS.Bass) : étendre scoring aux basses
  (cf section "Catalog Anniversary Premium" de CLAUDE.md ligne 639+)
- Drive Pedal Pack 3, Jivey Drives, Jivey Drives 2 : packs TSR
  "pédale seule" qui ne fittent pas le modèle amp-centric V9
  actuel. Phase 8 pourrait ajouter `entry.kind: 'pedal'` qui shunte
  refAmpScore — réconcilier ces packs avec le scoring.



### Améliorations mode démo (proposées, à activer selon priorité)

État au 2026-05-17 : mode démo fonctionnel (URL `?demo=1` + carte
ProfilePicker, snapshot bundlé src/data/demo-profile.json avec 11
morceaux Demo Setlist curés). Mais le snapshot date du 2026-05-16
(Phase 7.52.16 re-export) AVANT les améliorations Phase 7.53 → 7.56.
Quelques axes pour améliorer la qualité perçue du mode démo :

#### A. Re-export snapshot avec améliorations récentes — ✅ LIVRÉE 2026-05-17 (Phase 7.55-A, v8.14.90)

**Trigger** : à activer si tu veux que les recos du mode démo
bénéficient des fixes des derniers jours.

**Pourquoi maintenant** : le snapshot bundlé contient un aiCache
calculé AVANT :
- Phase 7.53 (édition usages ToneNET) — possibilité de tagger
  certains presets ToneNET du curateur pour des morceaux précis
- Phase 7.55 (catalog usages-match dans ideal_top3) — applique au
  render donc déjà actif sur le snapshot existant ✅
- Phase 7.56 (findSlotByName tolère format IA prefixé) — n'aide que
  si l'IA retourne preset_ann_name avec format prefixé (cas
  observé sur custom packs)
- Phase 7.54.x (aiCache per-profile + drop shared) — neutre pour le
  mode démo (snapshot reste dans shared.songDb)

**Effet attendu après re-export** : pour les morceaux où Gemini
retourne `preset_ann_name` au format prefixé, le pin custom sera
honoré. Hotel California déjà OK via Phase 7.55. Les recos sont déjà
de bonne qualité dans le snapshot actuel — l'amélioration est
marginale.

**Étapes** :
1. Sur Mac, switch profil curateur (`demo_1778839429588`)
2. Mon Profil → 🎯 Préférences IA → "🔄 Réinitialiser mes analyses"
   (invalide les 11 aiCache curateur)
3. Setlists → "Demo Setlist" → "🤖 Analyser/MAJ 11"
4. Ouvrir 2-3 fiches pour valider les nouvelles recos
5. Switch sur Sébastien admin
6. Mon Profil → 🔧 Maintenance → "📦 Exporter snapshot démo" →
   dropdown sélectionne `demo_1778839429588 — Demo` → télécharge
7. Remplacer `src/data/demo-profile.json` par le fichier téléchargé
8. Bump APP_VERSION + SW CACHE, build, deploy

#### B. Bouton "Quitter le mode démo" explicite — ✅ LIVRÉE 2026-05-17 (Phase 7.55-quickwins, v8.14.89)

**Idée** : aujourd'hui, le visiteur démo doit reload sans `?demo=1`
ou switcher manuellement via ProfileSelector pour quitter. Ajouter
un bouton "Quitter le mode démo" sur DemoBanner ou dans Mon Profil
qui :
1. Restore activeProfileId à sessionStorage (s'il y avait un profil
   trusted précédent) OU bascule sur ProfilePicker
2. Strip le snapshot in-memory (drop le profil démo de profiles,
   drop ses setlists, drop ses songs)
3. Reload la page sans `?demo=1`

**Pourquoi** : UX plus claire. Aujourd'hui un visiteur démo qui
veut s'inscrire n'a pas de chemin évident de sortie.

**Trigger** : à activer si un beta-testeur ou visiteur signale la
confusion (pas encore observé).

#### C. Audit complet UX grisé en mode démo (effort ~1h)

**Idée** : Phase 7.51.3.1 a grisé `SongSearchBar`. D'autres inputs
en mode démo restent fonctionnels — tap → toast 🔒 mais sans signal
visuel préalable. À griser pour cohérence :
- Rename setlist (ListScreen inline rename)
- Création setlist (ListScreen "+ Nouvelle setlist")
- Ajout custom guitar (ProfileTab GuitarSearchAdd)
- Toggle partage setlist (ListScreen Phase 5.8 pills)
- Bouton "💬 Donner un feedback à l'IA" (SongDetailCard)
- Boutons "🔄 Réinitialiser mes analyses" + "🗑 Invalider tous
  les caches IA"

**Pourquoi** : tap → toast 🔒 fonctionne (Phase 7.51.2 wrapDemoGuard)
mais sans signal visuel l'utilisateur peut s'énerver de tester
plein de boutons et toujours recevoir un toast bloqué.

**Trigger** : à activer si un visiteur démo se plaint de la
confusion UX.

#### D. Tests E2E mode démo (effort ~3-4h, à automatiser)

**Idée** : Vitest + jsdom ne couvre pas le flow complet mode démo
(URL `?demo=1` → carte ProfilePicker → DemoBanner → ouverture fiche
song → tap bloqué → toast). Aujourd'hui smoke-test manuel
post-déploiement. Playwright/Cypress automatiserait.

**Trigger** : à activer si le mode démo casse régulièrement sur des
changements (pas encore observé — 2 releases sans casse depuis
Phase 7.51).

#### E. Tracker visiteurs démo (effort variable, dépend tech)

**Idée** : compteur de visiteurs uniques entrés en mode démo
(idem : combien ouvrent la fiche d'un morceau, combien restent
plus de 1 min, combien font une demande d'accès). Aujourd'hui : zéro
visibilité.

**Tech possibilités** :
- Plausible Analytics (privacy-friendly, ~9€/mois) — événements
  custom au `enterDemoMode` + `openSongDetail`
- Tracker maison via Firestore counter (gratuit mais code à écrire)
- Google Analytics (efficace mais privacy concerns)

**Trigger** : à activer après le post case-study J+10 sur Reddit si
le volume justifie. Avant ça, traffic trop faible pour analyser.

#### F. Limitation visiteurs démo simultanés — ✅ LIVRÉE 2026-05-17 (Phase 7.55-quickwins, v8.14.89)

Cap quota Gemini sur fetchAI mode démo : 7 sites fetchAI gated `isDemo`
via early-return (SongDetailCard, ListScreen ×2, MaintenanceTab existants
+ HomeScreen rerunWithFeedback + add song, SetlistsScreen add song,
MonProfilScreen add song, AddSongModal handleAdd). Évite que
`wrapDemoGuard` Phase 7.51.2 bloque setSongDb mais que fetchAI parte
en arrière-plan consommer la clé Gemini partagée.

#### F-historique. Limitation visiteurs démo simultanés (non urgent — design notes)

**Idée** : un visiteur démo n'a pas son propre profil utilisateur
côté Firestore (`isDemo: true` chargé in-memory). Tous les
visiteurs partagent les MÊMES aiCache du snapshot bundlé. Donc
aucune limite côté quota.

Mais s'ils tentent un fetchAI (bloqué Phase 7.51.2 mais à valider),
ça consommerait ta clé Gemini partagée. Sécurité défensive : ajouter
un cap sur les fetchAI déclenchés depuis profile.isDemo (déjà à 0
en théorie via wrapDemoGuard).

**Trigger** : à valider si Google Console montre des spikes de
quota Gemini suspects.

#### G. URL démo paramétrable — ⚠️ PARTIEL 2026-05-17 (Phase 7.55-quickwins, v8.14.89)

Params `?demo=1&song=X&guitar=Y` désormais captés au boot dans
`_demoPrefSongId` / `_demoPrefGuitarId` + URL nettoyée via
`history.replaceState`. **Auto-open de la fiche correspondante
REPORTÉ** (nécessite wiring ListScreen `setExpandedId` depuis main.jsx
au moment du mount post-`enterDemoMode`). À compléter dans Phase
7.55.2 (qui partage la même mécanique de pré-ouverture de fiche).

#### G-historique. URL démo paramétrable (design notes)

**Idée** : `?demo=1&song=acdc_hth&guitar=lp60` pour pré-ouvrir une
fiche précise. Permet à Sébastien de partager un lien spécifique
("Regarde la reco pour Hotel California sur ma démo") qui ouvre
direct la fiche.

**Trigger** : si demande explicite (utile pour cas studies dans
Reddit posts).

#### H. Mode démo avec rig configurable (effort ~2-3h)

**Idée** : permettre au visiteur démo de switcher entre 2-3 rigs
pré-configurés (ex. "Démo blues rock 70s — Sébastien", "Démo
metal — Bruno", "Démo single coil — Francisco") pour montrer que
l'app s'adapte à différents styles.

**Tech** : 3 snapshots bundlés, switch via dropdown sur DemoBanner.

**Trigger** : si signal qu'un seul rig démo (Sébastien) restreint
l'audience. Pas encore demandé.

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

### Phase 7.52.18 — ✅ LIVRÉE 2026-05-17 (Phase 7.55-quickwins, v8.14.89)

`enterDemoMode` merge profileIds (union snapshot + local) au lieu de
remplacement bloc. Défense ultime contre snapshot externe importé
manuellement avec profileIds=['demo'] seul. Le texte ci-dessous reste
en référence design.

### Phase 7.52.18 (contexte design — livrée)

**Statut** : Phase 7.52.16 (buildDemoSnapshot livré 2026-05-16) couvre
le cas le plus courant (futurs exports préservent automatiquement le
curateur source dans profileIds). Cette entrée reste valide pour les
cas exotiques (snapshot importé manuellement, snapshot ancien sans
curateur, etc.).

**Contexte** : Phase 7.52.15 a livré un fix court terme en éditant
manuellement le snapshot bundlé `src/data/demo-profile.json` pour
ajouter `demo_1778839429588` aux `profileIds` de la "Demo Setlist".
Phase 7.52.16 a généralisé via `buildDemoSnapshot`. Cette Phase 7.52.18
proposée serait la défense ultime côté `enterDemoMode`.

**Cause structurelle** : `enterDemoMode` (`src/main.jsx` Phase 7.52.14)
fait un **force override par id** des setlists du snapshot —
remplace le tableau `profileIds` local par celui du snapshot. Donc
la setlist locale du curateur perd son ownership à chaque entrée en
mode démo.

**Fix proposé Phase 7.52.16** : dans `enterDemoMode`, au lieu de
remplacer la setlist du snapshot, **merger les profileIds** :

```js
// AVANT (Phase 7.52.14) :
setSetlistsRaw(prev => {
  const snapIds = new Set((snap.setlists || []).map(s => s.id));
  const kept = (prev || []).filter(s => !snapIds.has(s.id));
  return [...kept, ...(snap.setlists || [])];
});

// APRÈS (Phase 7.52.16) :
setSetlistsRaw(prev => {
  const snapById = new Map((snap.setlists || []).map(s => [s.id, s]));
  const prevById = new Map((prev || []).map(s => [s.id, s]));
  const result = [];
  // Setlists existantes : merge profileIds si présent dans snapshot
  for (const local of (prev || [])) {
    const snapVer = snapById.get(local.id);
    if (snapVer) {
      const mergedIds = Array.from(new Set([
        ...(snapVer.profileIds || []),
        ...(local.profileIds || []),
      ]));
      result.push({ ...snapVer, profileIds: mergedIds });
    } else {
      result.push(local);
    }
  }
  // Setlists du snapshot pas encore en local
  for (const snapSl of (snap.setlists || [])) {
    if (!prevById.has(snapSl.id)) result.push(snapSl);
  }
  return result;
});
```

**Avantages** :
- Le curateur garde TOUJOURS son ownership de la "Demo Setlist"
  (et de toute setlist incluse dans le snapshot) — pas besoin
  d'éditer le JSON manuellement.
- Le profil démo bundlé (`'demo'`) garde son accès via
  `profileIds.includes('demo')`.
- Tout autre profil pré-listé dans le snapshot reste préservé.
- Rétro-compatible : si le snapshot a uniquement `['demo']`, le
  merge produit `['demo', curatorId]` automatiquement. Si le
  curateur n'a pas la setlist en local, on prend telle quelle.

**Inconvénient mineur** : un peu plus de code dans `enterDemoMode`
(8 lignes vs 4) + 1-2 tests Vitest à ajouter pour couvrir le merge.

**Effort estimé** : ~30 min (refacto + tests + commit).

**Décision actuelle** : proposée Phase 7.52.16. À activer si
Sébastien décide de re-curer le snapshot avec un autre profil
curateur (changement d'id) et trouve la maintenance manuelle du
JSON pénible. En attendant, Phase 7.52.15 suffit pour
`demo_1778839429588` (id stable).

### Phase 7.53.2 (validée 2026-05-24 — à livrer) — Tombstones ToneNET

**Contexte** : Phase 7.53.1 (2026-05-11) a livré le merge LWW
per-item sur `shared.toneNetPresets` (`mergeToneNetPresetsLWW`)
pour éviter l'effacement bloc qui avait vidé les presets ToneNET
Sébastien sur Firestore. Mais elle **n'a pas inclus de mécanisme
tombstone** — explicitement documenté comme limite v1 (cf Phase
7.53.1 section "Limite acceptée").

Conséquence observée 2026-05-24 :
- Mac purge 5 entries ToneNET → state local Mac propre
- Phase 7.73.2.6 (2026-05-24) corrige le push manquant → Firestore
  reçoit `toneNetPresets: []`
- iPhone garde 5 entries locales avec lastModified pas plus ancien
- iPhone pull → `mergeToneNetPresetsLWW(local=5, remote=0)` →
  **local-only keep** (pas de signal "remote a supprimé") → iPhone
  garde 5
- iPhone push (au moindre toggle) → Firestore réinjecte 5 →
  Mac pull → mergeLWW(local=0, remote=5) → adopt 5 → Mac réinjecte
- **Cycle infini**

Workaround Sébastien (manuel via console) : purger directement
chaque device, force-reload. Phase 7.73.2.6 fait que les pushs
suivants propagent correctement, donc cycle cassé après le 1er
clean manuel. Mais si à l'avenir 2 devices ajoutent un preset
SIMULTANÉMENT, puis l'un supprime, le bug peut revenir.

#### Design Phase 7.53.2

Pattern Phase 5.7 (setlists) :

- Nouveau champ `shared.deletedToneNetIds: {[id]: number}` —
  map id → timestamp de suppression
- À la suppression UI dans ToneNetTab : `setDeletedToneNetIds(prev =>
  ({ ...prev, [id]: Date.now() }))` + `setToneNetPresets(prev =>
  prev.filter(p => p.id !== id))`
- `mergeToneNetPresetsLWW(local, remote, mergedTombstones)` étendu :
  - Si `mergedTombstones[id]` ≥ `max(local.lastModified,
    remote.lastModified)` → **DROP** (le suppression gagne)
  - Sinon merge LWW per-item normal Phase 7.53.1
- `mergeDeletedToneNetIds(local, remote)` : union avec `max(ts)`
- `gcTombstones(map, maxAgeMs = 30j)` : purge entries >30j (pattern
  Phase 5.7 setlists ; appelé au boot via `_runFullChain`)
- Inclure `deletedToneNetIds` dans le syncHash (Phase 7.46) pour
  déclencher push sur suppression
- Inclure dans le push Firestore via `shared.deletedToneNetIds`

#### Migration STATE_VERSION

Additif (champ optional). Si STATE_VERSION reste 11 et le client
fait défaut à `{}` si absent → pas de bump nécessaire. Si on
préfère stamper proprement la migration → STATE_VERSION 11 → 12,
`migrateV11toV12(state)` ajoute `shared.deletedToneNetIds = {}`.

#### Tests Vitest

- `mergeDeletedToneNetIds` × 4 : union max(ts), local-only,
  remote-only, falsy inputs
- `mergeToneNetPresetsLWW` étendu × 6 : scénario Mac purge / iPhone
  garde → tombstone gagne, local plus récent que tombstone → keep,
  remote plus récent que tombstone → adopt, tombstone vs deux items
  → drop, tombstone manquant → comportement Phase 7.53.1 préservé,
  gcTombstones >30j drop
- Scénario bug 2026-05-24 reproduit : Mac purge avec tombstone,
  iPhone pull → 0 entries (cycle cassé)

#### Effort estimé

~1.5h dev + 30min tests + 15min déploiement = ~2h total.

Découpage possible :
- Phase 7.53.2a : helpers purs (mergeDeletedToneNetIds, extension
  mergeToneNetPresetsLWW, gcTombstones) + tests (~1h)
- Phase 7.53.2b : câblage main.jsx (setDeletedToneNetIds state,
  applyRemoteData merge, syncHash inclus, push Firestore) +
  UI ToneNetTab.handleDelete (~30min)
- Phase 7.53.2c : tests + déploiement (~30min)

#### Quand activer

**Validé pour livraison post-Phase 7.73.2.6** (session 2026-05-24).
À démarrer dès la prochaine session Backline.

---

### Phase 7.53 — ✅ LIVRÉE 2026-05-16 (cf section "État actuel" en haut de CLAUDE.md)

Édition usages artiste/morceau sur presets ToneNET implémentée. Le
texte ci-dessous est conservé comme contexte historique des décisions
de design.

### Phase 7.53 (contexte design — livrée)

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

### Phase 7.54 — ✅ LIVRÉE 2026-05-17 (cf section "État actuel" en haut)

aiCache per-profile (STATE_VERSION 10). Le texte ci-dessous reste comme
contexte design pour référence historique.

### Phase 7.54 (contexte design — livrée)

**Contexte** : aujourd'hui le `aiCache` est stocké dans
`shared.songDb[i].aiCache` (Phase 3.6 décision : "partagé entre
profils via dedup songDb par id"). Conséquence : quand un profil B
ouvre un morceau analysé par un profil A avec un rig différent,
`rigStale` détecte le mismatch (Phase 7.48 T10) et force une
ré-analyse fetchAI → **l'analyse de A est écrasée par celle de B**.

Cas d'usage Sébastien (2026-05-16) : "je veux que chaque profil
soit synchro entre tous ses devices c'est tout. Une fois qu'un
calcul est fait pour un profil donné, il doit retrouver ses calculs
sur tous les devices."

État actuel par cas :
- **Sébastien Mac ↔ Sébastien iPhone** : ✅ sync OK (même profil =
  même rig = même rigSnapshot, pas de rigStale)
- **Bruno Mac ↔ Bruno iPhone** : ✅ sync OK (même mécanisme)
- **Bruno consulte un morceau analysé par Sébastien** : ❌ re-fetchAI
  forcé → écrase l'analyse Sébastien dans `shared.songDb[i].aiCache`
- **Sébastien re-consulte après Bruno** : ❌ re-fetchAI forcé à
  nouveau (cycle), coût Gemini × 2 profils consultants

**Architecture cible** : déplacer aiCache de
`shared.songDb[i].aiCache` (partagé) vers `profile.aiCache[songId]`
(per-profile). Chaque profil garde ses propres analyses, isolées.
Sync via le state push existant (qui inclut `profiles` complet),
zéro modif sync nécessaire.

**Approche additive** (pas destructive) :
- Nouveau champ `profile.aiCache: { [songId]: { result, sv,
  rigSnapshot, gId, bestByGuitar, ts } }` initialisé `{}` au
  migrate v9 → v10.
- `shared.songDb[i].aiCache` **conservé** comme fallback (rétro-compat
  + analyses historiques préservées).
- Au render (SongDetailCard, HomeScreen, ListScreen) :
  - 1) Lookup `profile.aiCache[songId]` → si présent ET
    rigSnapshot match → cache hit.
  - 2) Sinon fallback `shared.songDb[i].aiCache` → si rigStale
    → fetchAI → écrit dans `profile.aiCache[songId]` (PAS dans
    shared.songDb).
  - 3) Sinon (pas de cache du tout) → fetchAI → écrit
    `profile.aiCache[songId]`.

**Effet par cas** :
- Sébastien Mac analyse "Highway to Hell" → écrit
  `profile.aiCache.acdc_hth` pour Sébastien → push → Sébastien
  iPhone pull → cache hit instantané. ✅
- Bruno consulte "Highway to Hell" → cache MISS dans son profile
  → fallback shared (Sébastien analyse) → rigStale Bruno → fetchAI
  Bruno → écrit dans **son** `profile.aiCache.acdc_hth`. **N'écrase
  plus l'analyse Sébastien** dans shared.songDb. ✅
- Sébastien re-consulte après Bruno → cache hit dans son profile
  → pas de re-fetchAI. ✅

**Migration STATE_VERSION 9 → 10** :
- Additif : `profile.aiCache = {}` pour tous profils existants.
- Aucune perte de données : `shared.songDb[i].aiCache` reste.
- Idempotent.

**Cleanup au boot** (optionnel) : pour les profils qui ont
`profile.aiCache[songId]`, retirer le aiCache correspondant de
`shared.songDb[i].aiCache` pour éviter duplication. Au pire, le
payload Firestore reste stable (1.69 MB localStorage Sébastien
inchangé).

**Effort estimé** : ~4-5h dev + 1-2h tests + 30 min déploiement.

**Architecture livraison Phase 7.54** :

```
src/core/state.js
  STATE_VERSION 9 → 10
  +migrateV9toV10 : profile.aiCache = {} pour chaque profile
  +ensureProfileV10 : pose aiCache = {} si absent
  +helpers : getProfileAiCache(profile, songId),
            setProfileAiCache(profiles, profileId, songId, aiCache),
            mergeProfileAiCache(prev, next) (LWW par sv)
src/app/utils/ai-helpers.js
  enrichAIResult :
    1) read profile.aiCache[songId] d'abord
    2) fallback shared.songDb[i].aiCache
    3) updateAiCache écrit dans profile.aiCache[songId]
                            (PAS shared.songDb)
src/app/screens/SongDetailCard.jsx
  rigStale check : compare avec profile.aiCache OU shared fallback
src/app/screens/HomeScreen.jsx, ListScreen.jsx, RecapScreen.jsx
  consume profile.aiCache via helper si présent
src/main.jsx
  push Firestore : profile.aiCache déjà inclus via profiles object
  (pas de modif sync requise)
src/core/state.test.js
  +tests migrateV9toV10 (idempotent, additif)
  +tests get/set/merge ProfileAiCache
```

**Risque sync** : aucun. `profile.aiCache` est déjà inclus dans le
push Firestore existant (qui sync tout l'objet `profiles`).
docs/SYNC.md à mettre à jour pour mentionner ce nouveau champ.

**Risque payload Firestore** : potentiel +50% si plusieurs profils
ont des analyses simultanées. Mitigation : `stripAiCacheForSync`
Phase 5.7.1 fonctionne déjà sur l'aiCache au sens large. Adapter
pour strip aussi `profile.aiCache` si payload > 800 KB.

**Quand activer** : à coupler avec Phase 7.53 (édition usages
ToneNET) qui donne aussi de l'autonomie per-profile. Si Sébastien
ajoute des beta-testeurs avec leur rig propre, Phase 7.54 devient
nécessaire pour ne pas écraser ses analyses.

**Décision actuelle** : **proposée Phase 7.54**, pas
d'implémentation immédiate. À activer quand un beta-testeur (Bruno,
Arthur, futurs) commence à utiliser activement Backline et que
Sébastien constate des analyses écrasées.

### Phase 9 (validée 2026-05-18 — 3 signaux indépendants, V2 design 2026-05-21) — Output IA enrichi avec réglages PRESET complets

> **✅ Famille Phase 9 CLOSE 2026-05-22 → 2026-05-23**
>
> | Sous-phase | Status | Version |
> |---|---|---|
> | 9.1 MVP table chiffrée | ✅ | 8.14.160 |
> | 9.2 N1 FX ON/OFF + type | ✅ | 8.14.172 |
> | 9.2 N2 sub-params (=9.7) | ✅ | 8.14.173 |
> | 9.3 EQ avancé 4-bandes | Reporté | — |
> | 9.4 ONE TWEAK | ✅ + 9.4.1 + 9.4.2 | 8.14.167 |
> | 9.5 Playing hints | ✅ + 9.5.1 + 9.5.2 | 8.14.169 |
> | 9.6 Déduplication conseils | ✅ + 9.6.1 + 9.6.2 | 8.14.172 |
> | 9.7 Refonte UI + sub-params N2 | ✅ | 8.14.173 |
> | 9.7.1 Honest framing post-capture | ✅ | 8.14.174 |
> | 9.7.2 Post-process clamp extrêmes | Reporté (si signal user) | — |
>
> Cf section "État actuel" en tête de CLAUDE.md pour Phase 7.73.2
> Session A (2026-05-23) qui suit.
>
> Le design V2 ci-dessous reste la référence historique pour les 4
> sous-phases livrées.

**Status** : 3 signaux indépendants user (Ok_Ask2411 peer-builder
2026-05-15 + Francisco 2026-05-17 EQ chiffrée + Bruno 2026-05-18
built-in FX). Cf BETA_TESTING.md sections 2 et 7.

**Revirement de design 2026-05-21** : la version V1 documentée
ici parlait de "knob settings de la capture" — formulation
incorrecte. **La capture (TONE MODEL) est une boîte noire
immuable** fournie par un studio/créateur. Ce qui est ajustable
par l'utilisateur, c'est tout ce qui vient **autour** dans le
PRESET TONEX. Distinction officielle du manuel
`tone_models/TONEX_Pedal_User_Manual_French.pdf` :

> *"Les TONEX PRESETS se composent des effets suivants, permettant
> de modifier n'importe quel TONE MODEL : Noise Gate, Compresseur,
> Modulation, TONE MODEL, EQ, Delay, Reverb."* (page 6)

Confirmé Sébastien 2026-05-21 : **Pedal classique, Anniversary,
Plug, One, One+ partagent les mêmes capacités de réglage preset**.
Phase 9 vise donc un design unifié, pas device-specific.

#### Chaîne PRESET officielle (manuel page 21)

```
Input
  → TRIM IN (global)
  → NOISE-GATE (PRE par défaut, déplaçable POST)
  → COMPRESSOR (PRE/POST)
  → MODULATION (PRE/POST)
  → DELAY (PRE/POST)
  → TONE EQ (PRE/POST)
  → ▓▓ TONE MODEL AMP ▓▓     ← BOÎTE NOIRE (capture immuable)
  → ▓▓ TONE MODEL CAB ▓▓     ← bypass possible
  → REVERB (POST AMP / LAST)
  → MASTER VOLUME (preset)
  → MAIN VOL (global)
  → Output
```

L'IA ne touche **jamais** aux internals de la capture. Elle génère
des recommandations pour ce qui est user-configurable :

**Niveau 1 — Boutons physiques (accès direct face avant)**
| Bouton | Range |
|---|---|
| GAIN | 0-10 (gain d'entrée du TONE MODEL) |
| BASS / MID / TREBLE | 0-10 (EQ shelf/bell post-AMP) |
| VOLUME | 0-10 (volume preset) |

**Niveau 2 — ALT (encoder PARAMETER maintenu, label vert ALT)**
| Bouton ALT | Range |
|---|---|
| REVERB MIX | 0-100% |
| COMPRESSOR THRESHLD | 0 à -40 dB |
| NOISE-GATE THRESHLD | -100 à 0 dB |
| PRESENCE | 0-10 |
| DEPTH (PROFONDEUR) | 0-10 |

**Niveau 3 — Paramètres complémentaires (menus profonds)**
- **TONE MODEL** : MODEL.VOL (0-10), MODEL.MIX (0-100% dry/wet)
- **GATE** : POWER, RELEASE (5-500ms), DEPTH (-20 à -100dB), POSITION (PRE/POST)
- **COMP** : POWER, GAIN (-30 à +10dB), ATTACK (1-51ms), POSITION (PRE/POST)
- **EQ avancé** : BASS HZ (75-600), MID Q (0.2-3.0), MID HZ (150-5000), TRBL HZ (1000-4000), POSITION (PRE/POST)
- **VIR** (si cab = VIR cabinet, optionnel power-user) : RESO (0-10), MIC1/2 (COND/DYN/RBN) avec X/Z (0-10), BLEND (-100% à +100%)
- **MOD** : POWER, TYPE (5 : Chorus/Tremolo/Phaser/Flanger/Rotary), POSITION (PRE/POST), sub-params par type :
  - CHORUS : SYNC, RATE (0.10-10 Hz), DEPTH (0-100%), LEVEL (0-10)
  - TREMOLO : SYNC, RATE, SHAPE (0-10), SPREAD (0-100%), LEVEL
  - PHASER : SYNC, RATE, DEPTH, LEVEL
  - FLANGER : SYNC, RATE, DEPTH, FEEDBACK (0-100%), LEVEL
  - ROTARY : SYNC, SPEED (0-400 RPM), RADIUS (0-300 mm), SPREAD, LEVEL
- **DELAY** : POWER, TYPE (2 : Digital/Tape), POSITION, TIME (0-1000 ms), FEEDBACK (0-100%), MODE (Normal/Ping.Pong), MIX (0-100%)
- **REVERB** : POWER, TYPE (6 : Spring 1-4 / Room / Plate), POSITION (POST AMP / LAST), TIME (0-10), PRE.DELAY (0-500 ms), COLOR (-10 à +10), MIX (0-100%)

**Niveau 4 — Config PRESET (toggles structurels)**
- AMP active/bypass (rare, mais possible)
- CAB active/bypass ← **critique pour le contexte d'écoute** (cf Phase 10)
- EXT.CTRL on/off, EXT.LEARN on/off

**Niveau 5 — Config GLOBALE (par device, pas par preset)** — hors scope Phase 9
- TRIM IN (-15 à +15 dB), MAIN VOL (-40 à +3 dB), BPM (40-240)

#### Couplage avec Phase 10 (cab_enabled selon contexte d'écoute)

Le toggle `CAB active/bypass` n'est pas un choix esthétique : il
dépend strictement du **contexte d'utilisation** (Phase 10) :
- **Casque** : CAB activé obligatoire (sinon bouillie aiguë).
- **Enceinte FRFR** (Headrush, Friedman ASM, Powercab+, ToneX Cab) :
  CAB activé obligatoire (l'enceinte est neutre).
- **Système de sonorisation / table de mixage / DI** : CAB activé
  (mixage attend du signal cabbed).
- **Ampli de puissance + cab physique guitare** (ex. Sébastien
  Marshall SV20h + SV112) : CAB **bypassé** obligatoire (sinon
  double filtrage cab = son boueux/criard).

Phase 10 pose `profile.outputContext ∈ {headphone, frfr, pa, ampWithCab, ampNoCab}`
et `song.outputContext` override par morceau. Phase 9.1 consomme
ce contexte dans le prompt → l'IA sort `cab_enabled: true/false`
cohérent. Phase 10 d'abord (~3h) → Phase 9.1 ensuite (~4h).

#### 5 sous-phases proposées

**Phase 9.1 — MVP "table chiffrée" (Niveau 1 + 2 + cab_enabled)**

L'IA retourne un objet JSON couvrant les 5 boutons principaux +
5 boutons ALT + `cab_enabled`. C'est ce qui est accessible sans
appuyer sur PARAMETER. Format proche Ok_Ask2411 :

```json
"preset_settings_v1": {
  "cab_enabled": true,
  "main": {
    "gain": 6.2,             // 0-10
    "bass": 4.5,
    "mid": 7.0,
    "treble": 5.3,
    "volume": 6.0
  },
  "alt": {
    "presence": 4.7,         // 0-10
    "depth": 5.0,            // 0-10
    "reverb_mix": 16,        // 0-100%
    "comp_threshold": -18,   // 0 à -40 dB
    "gate_threshold": -56    // -100 à 0 dB
  },
  "why": { "fr": "...", "en": "...", "es": "..." }
}
```

UI : nouvelle sous-section "🎛️ Réglages pédale" sous le preset
reco, table 11 lignes (param / value / why globale). Conserver
`settings_preset` prose en parallèle pour transition douce.

**Effort** : ~3-4h dev (prompt + UI + validation clamp + tests
Vitest). Couvre 90% du besoin pour 95% des morceaux.

**Phase 9.2 — FX blocks détaillés (Niveau 3)**

L'IA pilote on/off + type + sub-params des blocs Mod/Delay/Reverb/Gate/Comp.
Réponse directe au feedback Bruno (For Whom the Bell Tolls = Mod
OFF + Reverb mix bas + Gate threshold élevé).

```json
"fx_blocks": {
  "noise_gate": { "enabled": true,  "threshold": -56, "release": 140, "depth": -75, "position": "PRE" },
  "compressor": { "enabled": false, "threshold": -18, "gain": 0, "attack": 10, "position": "PRE" },
  "modulation": { "enabled": false, "type": "CHORUS", "position": "POST", "rate": 1.5, "depth": 30, "level": 5 },
  "delay":      { "enabled": false, "type": "TAPE",   "position": "POST", "time": 320, "feedback": 20, "mode": "NORMAL", "mix": 14 },
  "reverb":     { "enabled": true,  "type": "PLATE",  "position": "LAST", "time": 4.5, "pre_delay": 18, "color": 2, "mix": 16 }
}
```

UI : 5 sections expandables sous "🎛️ Réglages pédale", state on/off
visible, params en mode dépliable. Validation côté JS : clamp dans
les ranges + reject types hors enum.

**Effort** : ~4-5h dev (prompt extension lourd + UI + helper de
validation des ranges). À livrer après retour user sur 9.1.

**Phase 9.3 — EQ avancé + TONE MODEL fine-tuning**

```json
"eq_advanced": {
  "bass_hz": 100,            // 75-600
  "mid_q": 1.0,              // 0.2-3.0
  "mid_hz": 800,             // 150-5000
  "treble_hz": 2500,         // 1000-4000
  "position": "POST"         // PRE/POST
},
"tone_model_fine": {
  "model_vol": 7.5,          // 0-10 (volume du TONE MODEL AMP)
  "model_mix": 100           // 0-100% dry/wet, rarement <100
}
```

UI : section pliée par défaut "EQ avancé (power-user)". À activer
si retour user power-user explicite. VIR mic placement skip v1
(trop niche).

**Effort** : ~2h dev. Optionnel.

**Phase 9.4 — "ONE TWEAK TO FIX IT" (section pédagogique) ✅ LIVRÉE 2026-05-22 (v8.14.165)**

Voir section "État actuel" en tête de CLAUDE.md pour le détail.
Helper `clampTweaks` + 22 tests Vitest + section UI repliée sous
le toggle "Pourquoi ces valeurs ?" + prompt fetchAI ÉTAPE 7 étendu
avec consigne 6-8 tweaks adaptés au contexte (style/gain/pickup/
contexte d'écoute, pas canned list générique) + i18n FR/EN/ES.
**Notes design conservées pour référence** :

Section pliée par défaut, expandable sur scène pour ajustement
empirique post-écoute :

```json
"tweaks": [
  { "symptom_fr": "trop brillant sur FRFR",  "symptom_en": "too bright on FRFR",  "fix": "Treble -0.5 + Presence -0.3" },
  { "symptom_fr": "trop sombre sur cab",     "symptom_en": "too dark on cab",     "fix": "Treble +0.5 + Presence +0.3" },
  { "symptom_fr": "noyé dans le mix groupe", "symptom_en": "buried in band mix",  "fix": "Mid +0.5 + Volume +0.3" },
  { "symptom_fr": "trop boomy",              "symptom_en": "too boomy",           "fix": "Bass -0.5 + Depth -0.3" },
  { "symptom_fr": "trop fizzy high gain",    "symptom_en": "too fizzy on HG",     "fix": "Presence -0.5 + Gain -0.3" },
  { "symptom_fr": "pas assez tight",         "symptom_en": "not tight enough",    "fix": "Gain -0.3 + Gate threshold -10dB" }
]
```

UI : section "🔧 Si ça ne sonne pas tout à fait juste..." pliée
par défaut. 6-8 lignes "Si X → Fais Y". Réutilisable en répétition
ou live.

**Effort** : ~2h dev. Ratio impact/effort élevé.

**Phase 9.5 — Pickup + Playing technique (orthogonal pédale) ✅ LIVRÉE 2026-05-22 (v8.14.168)**

Voir section "État actuel" en tête de CLAUDE.md. Format final livré :
4 champs scalaires (`pickup`, `guitar_volume`, `guitar_tone`,
`stereo`), pas trilingue (universels). `picking_style` exclu pour
éviter duplication avec `settings_guitar` prose trilingue.
**Design original conservé pour référence** :

```json
"playing_hints": {
  "pickup": "Bridge HB",                    // ou Neck / Middle / Position 2-4
  "guitar_volume": "8-10",
  "guitar_tone": "10 (open)",
  "picking_style_fr": "Attaque agressive, palm-muted",
  "picking_style_en": "Aggressive right hand, palm-muted",
  "stereo": true
}
```

UI : sous-section "🎸 Conseils de jeu" sous `ideal_guitar`.
Fusionner si overlap avec `playingTipsBySong` Phase 3.8 TMP.

**Effort** : ~1-2h dev. Risque hallucination IA sur position de
pickup selon le type de guitare (HSS Strat ≠ SC Tele ≠ HH LP).
Validation : prompt list explicitement les pickups dispos sur la
guitare proposée.

#### Décisions de design validées 2026-05-21

1. **Couplage Phase 10 + Phase 9.1** : Phase 10 d'abord (pose
   `profile.outputContext` + `song.outputContext`) → Phase 9.1
   consomme ce contexte pour décider `cab_enabled` + adapter les
   knobs. Le cab on/off n'est pas un choix esthétique, c'est dicté
   par le matériel d'écoute.
2. **Pas de bump SCORING_VERSION** : Phase 9 ajoute des champs au
   prompt et à l'aiCache mais ne change pas le scoring V9. Les
   aiCache existants peuvent manquer ces champs → fallback UI
   gracieux (CTA "lance une nouvelle analyse").
3. **Coût Gemini acceptable** : prompt + output 9.1 alourdissent
   la requête de ~50-100 tokens (~$0.0001 par fetch). 9.2 + 9.3
   ajoutent ~200 tokens. Free tier confortable.
4. **Validation côté JS** : helper `clampPresetSettings(obj)` qui
   pour chaque champ vérifie le range officiel et `console.warn`
   si hors-bornes (Gemini hallucine parfois). 30 min de helper à
   coupler avec Phase 9.1. Couvre tous les ranges du manuel.
5. **i18n trilingue dès 9.1** : champ `why` retourné en objet
   `{fr, en, es}` comme les autres champs prose Phase 7.39.
   Cohérence + un seul prompt. `tweaks` également trilingues
   (Phase 9.4).

#### Ordre recommandé d'implémentation

1. **Phase 10 d'abord** (~3h) : pose `profile.outputContext` +
   override par morceau. Prérequis Phase 9.1.
2. **Phase 9.1** (~4h) : MVP table chiffrée. Couvre l'essentiel.
3. **Phase 9.4** (~2h) : "ONE TWEAK TO FIX IT". Ratio
   impact/effort élevé.
4. **Phase 9.2** (~5h) : FX blocks détaillés. Attendre retour
   user sur 9.1 avant.
5. **Phase 9.5** (~1-2h) : Pickup + playing hints. Bonus.
6. **Phase 9.3** (~2h) : EQ avancé + TONE MODEL fine. Skip ou
   plus tard si retour power-user.

**Total Phase 9 complète : ~13-15h** étalées sur plusieurs
sessions, idéalement avec retour user entre 9.1 et 9.2.

#### Source canonique

Tous les ranges et noms de paramètres viennent du manuel officiel
`tone_models/TONEX_Pedal_User_Manual_French.pdf` :
- Page 6 : définition PRESET et chaîne de blocs
- Page 21 : diagramme flux de signal complet
- Pages 22-28 : paramètres principaux / ALT / complémentaires
  avec ranges exacts
- Page 29 : Config PRESET (AMP/CAB bypass, EXT.CTRL)

Sébastien a confirmé 2026-05-21 que cette documentation s'applique
identiquement à Plug, Anniversary, One, One+. Pas de scope
device-specific à prévoir Phase 9.

**Décision actuelle (2026-05-21)** : design V2 validé Sébastien.
Implémentation reportée — autre urgence prioritaire annoncée.
À activer quand bandwidth permet.

### Phase 7.55 (proposée) — Blindage mode démo pour conversion publique

**Contexte** : Phase 7.51 (mai 2026) a livré l'infrastructure du mode
démo (foundations / guards runtime / accès UI + banner / outil
d'export admin) + Phase 7.51.4 + Phase 7.52.14-16 (override par id,
buildDemoSnapshot préserve curateur). Le mode démo *fonctionne
techniquement* — un visiteur peut entrer via `?demo=1` ou la carte
ProfilePicker et explorer une Demo Setlist de 11 morceaux pré-curée.

**Mais** : un audit UX en mode "visiteur first-time ToneX user"
mené 2026-05-17 a révélé que la **conversion** du mode démo est
faible parce que :
1. La home publique (`/`) ne *vend* pas l'app — elle affiche
   directement ProfilePickerScreen avec une carte démo discrète,
   aucune landing marketing au-dessus. Un visiteur Reddit/DM qui
   débarque sans contexte préalable ne comprend pas ce qu'il
   regarde et bounce probablement avant de cliquer "Mode démo".
2. La modale d'onboarding démo est bonne sur le problème ("tu
   scrolles, tu testes, tu perds du temps") mais ne *montre* pas
   immédiatement la valeur — il faut taper un morceau dans le
   champ recherche pour voir le "aha moment" (fiche reco
   complète avec banque/slot + conseils de réglage).
3. L'écran Accueil démo après la modale est un grand champ
   recherche vide — le visiteur ne sait pas quoi taper.
4. Le CTA "demande un accès" dans la bannière démo pointe sur un
   `mailto:` (Phase 7.51.3) — Phase 7.44 propose un formulaire
   structuré, à coupler.
5. Une seconde cible **studios de captures** (Studio Rats déjà en
   contact via Paul Phase 7.45, future ML Sound Lab / Galtone /
   Amalgam Audio etc.) n'a aucune page dédiée alors qu'elle a
   des questions complètement différentes des guitaristes
   ("comment mon pack est catalogué ? combien d'users l'ont ?").
6. Bugs responsive iPhone/iPad documentés (cf. sous-section
   "Bugs UI/UX responsive identifiés" plus bas).

**Cible utilisateur double et coexistante** :
- **Beta-testeurs guitaristes ToneX** (cible principale V1) :
  utilisateurs Pedal Anniversary / Plug avec ≥10 packs achetés,
  pain point "scroller dans 600+ presets en répète". Conversion
  attendue : visiteur → mode démo → demande d'accès → setup admin
  par Sébastien.
- **Studios de captures** (cible stratégique secondaire) :
  éditeurs de packs (Studio Rats, ML Sound Lab, Galtone, Amalgam
  Audio…) qui pourraient devenir partenaires/promouvoir l'app à
  leur clientèle. Pain point : visibilité de leurs packs dans le
  workflow utilisateur. Conversion attendue : page dédiée → contact
  établi → témoignage / co-marketing.

**Contrainte V1** : positionnement ToneX-only assumé (Pedal,
Anniversary, Plug, Cab). Tone Master Pro reste en R&D, non garanti.
Ne pas mentionner Quad Cortex / Kemper / NAM / Helix dans la
landing publique tant que la V1 n'est pas validée — risque
d'attirer des visiteurs déçus et de diluer le positionnement.

#### Sous-phase 7.55.1 (P0) — Landing publique au-dessus du picker

Aujourd'hui `/` rend `ProfilePickerScreen` directement. Phase
7.55.1 insère une **landing page marketing** servie à `/` pour
les visiteurs first-time (détection : aucun profil trusted dans
`tonex_trusted_devices` localStorage). Si profil trusted présent
→ skip landing → ProfilePicker (comportement actuel préservé
pour les utilisateurs récurrents).

Contenu landing :
- **H1** : "Backline — le copilote intelligent de ta ToneX"
- **Sous-titre** : "Quel preset, quelle guitare, quels réglages —
  pour chaque morceau. L'IA fait le tri dans tes 64 packs."
- **3 captures animées** (GIF/MP4, à produire avec OBS sur la
  démo curée) : (1) tape un morceau, (2) voit la reco avec
  banque/slot, (3) conseils de réglage micro/tone/volume.
- **Ligne d'assumption matérielle** : "V1 dédiée ToneX (Pedal,
  Anniversary, Plug, Cab). Support Tone Master Pro en
  développement."
- **2 CTAs principaux** :
  - "Essayer en mode démo" → click → set
    `_demoModeRequested = true` → `enterDemoMode()` (réutilise
    Phase 7.51.3).
  - "Demander un accès beta" → click → ouvre le formulaire
    Phase 7.44 (ou `mailto:` legacy si 7.44 pas implémenté).
- **Lien discret footer** : "Vous éditez des packs ?" →
  Sous-phase 7.55.4 (page studios).

Composants à créer :
- `src/app/screens/LandingScreen.jsx` : composant React avec
  hero + features + CTAs.
- `src/main.jsx` : router pour servir `<LandingScreen>` si
  `!hasTrustedDevice() && screen === 'picker'`.
- `src/i18n/{en,es}.js` : traductions complètes des copies
  landing (FR fallback inline).
- Assets visuels : 3 GIFs/MP4 à produire, à stocker en data-URI
  inline (vite-plugin-singlefile contrainte) ou hébergé GitHub
  Pages (`public/assets/landing/`).

**Coût estimé** : ~6-8h dev (composant + i18n + integration
router) + ~4-6h production assets vidéo. Pas de bump
STATE_VERSION (purement UI publique).

#### Sous-phase 7.55.2 (P0) — Pré-charger un exemple direct

Aujourd'hui modale d'intro démo affiche 4 étapes numérotées avec
emojis + bouton "C'est parti !" qui ferme la modale et amène sur
Accueil avec champ vide. Le "aha moment" arrive seulement après
taper "Highway to Hell" et cliquer la suggestion.

Phase 7.55.2 ajoute un **bouton secondaire** dans la modale
d'intro : "Voir un exemple direct". Click → ferme la modale +
charge automatiquement la fiche "Highway to Hell" comme si
l'utilisateur l'avait choisie. C'est l'écran le plus impressionnant
de l'app (titre + history + raisonnement IA + reco preset/guitare
+ banque/slot + conseils micro/tone) — il faut le mettre devant.

Implémentation : la modale d'intro vit dans `HomeScreen.jsx`
(composant `OnboardingWizard` Phase 1+). Ajouter un 2e CTA qui
appelle `onAddSong({ id: 'acdc_highway_to_hell', ... })` puis
ferme la modale. La fiche s'ouvrira automatiquement.

**Coût estimé** : ~1-2h dev. Trivial mais gros impact perçu.

#### Sous-phase 7.55.3 (P1) — Curiosité guidée sur Accueil démo

Aujourd'hui Accueil démo après fermeture de la modale d'intro =
grand vide avec champ "Titre, artiste…". Paralysant pour un
visiteur qui ne sait pas quoi chercher.

Phase 7.55.3 ajoute (uniquement en mode démo, gated par
`profile.isDemo`) :
- **4 chips de morceaux suggérés** sous le champ recherche :
  "Essaye : *Highway to Hell* · *The Thrill Is Gone* · *Smoke on
  the Water* · *Wish You Were Here*". Click sur un chip → charge
  la fiche correspondante.
- **Bouton "🎲 Tirer un morceau au hasard"** : pioche aléatoirement
  parmi les 11 morceaux de la Demo Setlist et charge la fiche.

Composants à modifier :
- `src/app/screens/HomeScreen.jsx` : props supplémentaires
  `isDemo` (déjà disponible Phase 7.51.3.1) + ajout de la section
  chips + bouton random.
- Aucune nouvelle dépendance, aucun nouveau state global.

**Coût estimé** : ~2h dev + smoke test.

#### Sous-phase 7.55.4 (P2) — Page dédiée aux studios de captures

Aujourd'hui aucune page ne parle aux éditeurs de packs. Paul (TSR)
a répondu cordialement Phase 7.45 mais sans page de "pitch
B2B" claire, un nouvel éditeur n'aura pas de raison de creuser.

Phase 7.55.4 ajoute `/studios` (route SPA, pas une vraie URL
serveur) avec :
- **Pitch dédié** : "Vos captures, intelligemment recommandées à
  des centaines d'utilisateurs ToneX par morceau qu'ils jouent."
- **Comment ça marche** : Backline catalogue les packs par
  éditeur + amp source + gain bucket. Le moteur de scoring V9
  cible les captures pertinentes selon le morceau + la guitare
  de l'utilisateur. L'utilisateur voit la banque/slot de SA pédale
  + le nom de TON pack.
- **Stats anonymisées** (futur, Phase 7.55.5+) : "X% des
  utilisateurs Backline ont au moins un de vos packs", "Top 3
  morceaux où vos captures sont recommandées".
- **Showcase** : screenshots de fiches morceau où un pack TSR /
  ML / autre est recommandé (avec accord du studio).
- **CTA** : "Devenir partenaire" → `mailto:sebastien.chemin@gmail.com`
  ou form Phase 7.44 avec champ "Je suis un studio".

Composants :
- `src/app/screens/StudiosScreen.jsx` : nouveau, similaire en
  structure à LandingScreen 7.55.1.
- Lien discret footer "Vous éditez des packs ?" → route
  `screen === 'studios'`.
- Pas de gating profil (publique).

**Coût estimé** : ~4-6h dev pour la page statique + ~2-3h
copywriting/design. Stats anonymisées = Phase ultérieure
(nécessite collecte télémétrie opt-in).

#### Sous-phase 7.55.5 (P1) — Formulaire "demande un accès" qualifiant

Aujourd'hui le lien dans la bannière démo (Phase 7.51.3) ouvre un
`mailto:` pré-rempli. Pour scaler au-delà de 10-20 testeurs, basculer
sur le formulaire Phase 7.44 (déjà documenté dans "Idées en
attente") avec **enrichissement spécifique mode démo** :
- Champ "Comment as-tu découvert Backline ?" (radio : Reddit /
  DM / Démo publique / Studio recommended / Autre).
- Champ "Tu testes en mode démo depuis combien de temps ?" (radio :
  <5 min / 5-15 min / >15 min). Premier signal qualitatif sur le
  fit.

Ces champs alimentent le rapport conversion mode démo (Sous-phase
7.55.7).

**Coût estimé** : ~1-2h supplémentaires en plus de Phase 7.44 si
les deux sont livrées ensemble.

#### Sous-phase 7.55.6 (P1) — Tracker l'engagement démo

Sébastien valide un concept → besoin de signaux quantitatifs.
Aucun analytics aujourd'hui. Phase 7.55.6 ajoute (privacy-friendly,
opt-out par défaut respectant les utilisateurs avec
`navigator.doNotTrack`) :

Évènements à tracker :
- Entrée landing publique (Phase 7.55.1)
- Click "Essayer en mode démo" → mode démo entered
- Click "Voir un exemple direct" (Phase 7.55.2)
- Recherche effectuée (terme + résultat trouvé / non trouvé)
- Click sur une fiche morceau depuis Setlists ou Explorer
- Scroll jusqu'au bloc "PARAMÉTRAGE — MON CHOIX"
- Click "Demande un accès"
- Temps passé en mode démo (mesure session)

**Options d'outils analytics** (audit 2026-05-17) classées du
plus simple au plus puissant :

| Outil | Coût | Effort setup | Privacy | Événements custom | Quand l'utiliser |
|-------|------|--------------|---------|-------------------|------------------|
| Cloudflare Web Analytics | gratuit | ~10 min | très bon (zéro cookie, pas de bandeau RGPD) | non | démarrage simple, juste compter les visiteurs et savoir d'où ils viennent |
| Plausible (cloud) | 9 $/mois pour 10K vues | ~10 min | très bon (RGPD-compliant par défaut) | oui (goals limités) | quand tu communiques sérieusement et veux un dashboard partageable |
| Umami (self-host) | gratuit (Vercel / Cloudflare Pages free tier) | ~30 min | excellent (tu maîtrises les données) | oui | meilleur trade-off Backline : aligné avec positionnement privacy |
| PostHog (cloud free) | gratuit jusqu'à 1M events/mois | ~1h | OK (configurable DNT, hosting EU dispo) | oui (funnels, session replays) | quand la beta scale et tu veux des funnels précis |

**À éviter** : Google Analytics (incompatible positionnement privacy
+ bandeau cookies obligatoire en EU + bundle lourd).

**Recommandation séquencée** :
- **Maintenant** : Cloudflare Web Analytics. 10 min de setup,
  gratuit, zéro maintenance — tu sais immédiatement si tu as 5
  ou 500 visiteurs/jour. Largement suffisant pour valider le
  signal de conversion brut.
- **Au lancement du post Reddit / DM studios** (couplé à Phase
  7.55.5 formulaire d'accès) : ajouter **Umami self-hosted sur
  Vercel** pour tracker les goals précis (entrée démo, click
  "demande un accès", scroll jusqu'à PARAMÉTRAGE). Les deux outils
  cohabitent : Cloudflare pour le macro, Umami pour les events.
- **Plus tard, si beta scale (≥100 visiteurs/sem)** : envisager
  PostHog pour les vrais funnels et session replays.

**Contraintes spécifiques Backline à respecter** :

1. **Single-file build (`vite-plugin-singlefile`)** : le plugin
   n'inline QUE les bundles produits par Vite. Un `<script
   src="https://plausible.io/...">` dans `index.html` reste
   chargé externe au runtime — aucun blocage technique. Le
   `<script>` doit être ajouté dans `index.html` côté source
   (avant le build) ou injecté dans `dist/index.html` après le
   build par script bash dans le workflow déploiement Phase 5.2.
2. **GitHub Pages** : aucun analytics server-side possible (pas
   d'accès aux logs nginx). Tout passe forcément par beacon
   côté client.
3. **PWA offline-first** : événements perdus si l'utilisateur
   joue sans réseau. Acceptable : la majorité des visites du
   mode démo seront en ligne par définition. Plus tard, on
   peut implémenter un buffer IndexedDB + flush au retour
   online si nécessaire.
4. **Mode démo vs profils trusted** : gate strictement sur
   `profile.isDemo === true`. Les sessions Sébastien/Bruno/
   Francisco/etc. = noise (on connaît déjà leur usage). Seuls
   les visiteurs démo doivent générer des événements.
5. **DNT (Do Not Track)** : par cohérence avec le ton privacy
   de Backline, no-op si `navigator.doNotTrack === '1'`.
   Cloudflare/Plausible/Umami respectent nativement. PostHog
   doit être configuré explicitement.
6. **Pas de bandeau cookies** : si tu choisis Cloudflare /
   Plausible / Umami, aucun cookie n'est posé → pas de banner
   consentement RGPD nécessaire. Si tu passes à PostHog en mode
   identifié (cookies de session pour les funnels cross-visite),
   il faut prévoir un banner — friction supplémentaire à éviter
   en démo publique.

Composant à créer (commun aux 4 options) :
- `src/app/utils/analytics.js` : helper `trackEvent(name, props)`
  qui no-op si :
  - `navigator.doNotTrack === '1'`
  - `profile?.isDemo !== true` (gate principal)
  - Mode `no-sync` activé (Phase 7.24) — cohérence "mode local
    = aucune télémétrie".
  Dispatch vers la stack analytics choisie (Plausible
  `plausible('event_name')` / Umami `umami.track('event_name',
  {props})` / PostHog `posthog.capture('event_name', {props})`).
- Câblage minimal : 1 call par événement listé plus haut.
- À tester localement avec un compte sandbox avant push prod.

**Setup Cloudflare Web Analytics (option recommandée pour
démarrer)** :
1. Créer un compte Cloudflare (gratuit).
2. Dashboard → Analytics & Logs → Web Analytics → Add a site.
3. Renseigner `mybackline.app` (même si Cloudflare n'est pas
   le DNS — Cloudflare accepte les sites externes).
4. Copier le `<script>` JS Snippet (~80 caractères) fourni.
5. Le coller dans `src/index.html` juste avant `</head>`
   (sera servi tel quel par vite-plugin-singlefile).
6. Bumper `APP_VERSION` + SW `CACHE`, build, deploy.
7. Stats apparaissent sous 24h dans le dashboard Cloudflare.

**Setup Umami self-hosted** :
1. Fork du repo `umami-software/umami` sur GitHub.
2. Deploy sur Vercel (1 clic depuis le repo) avec une DB
   Postgres provisionnée (Vercel Postgres free tier ou
   Supabase free tier).
3. Pointer un sous-domaine `stats.mybackline.app` vers le
   déploiement Vercel (CNAME record côté OVH).
4. Créer un website dans Umami, copier le script `<script
   async defer data-website-id="..." src="https://stats.mybackline.app/script.js"></script>`.
5. Coller dans `src/index.html`.
6. Build, deploy.

**Coût estimé total** : Cloudflare seul = ~10 min. Umami seul
= ~30 min setup + ~3-4h câblage events custom + ~1h tests.
Phase 7.55.6 complète (Cloudflare + Umami + helper analytics.js)
= ~5-6h.

#### Sous-phase 7.55.7 (P2) — Polish responsive mobile / iPad

Audit responsive 2026-05-17 a révélé :

**iPhone 393×852** :
- **Bug 1** : bouton OK du champ recherche `HomeScreen.SongSearchBar`
  déborde à droite. Layout `flex` sans wrap, OK posé après input
  full-width. Le bord droit du bouton sort de la viewport.
- **Bug 2** : version `v8.14.84` dans AppHeader tronquée à droite
  (label trop large).
- **Bug 3** : Accueil démo a beaucoup de vide noir au centre (header +
  bannière + Mode scène + champ recherche tassent contenu vers le
  bas). Optimiser le layout vertical mobile.

**iPad 11" portrait (834×1194)** :
- Layout = version desktop rétrécie. Pas pensé iPad.
- Champ recherche + OK rentrent ensemble (711 px pour 830 viewport)
  mais la mise en page paraît "desktop tassé", pas "iPad natif".

**iPad 11" / 13" — Mode scène** : non testé en condition réelle.
Phase 7.55.7 inclut un design dédié :
- Police XXL (titre morceau ~64-80pt, banque/preset ~48pt).
- Swipe gauche/droite entre morceaux (réutilise gestures Phase 4).
- Mode portrait + paysage adaptatif (orientation lock OFF).
- Wake Lock auto (déjà Phase 4) + indicateur visuel "🔒 écran
  verrouillé".
- Bouton fullscreen quit en haut à gauche, gros (cible touch 48×48
  min, ergonomie scène avec doigts moites).

Composants à toucher :
- `src/app/components/SongSearchBar.jsx` (ou inline `HomeScreen`) :
  flex wrap au-dessous d'un breakpoint, ou bouton OK en absolute
  positioned dans l'input.
- `src/app/components/AppHeader.jsx` : truncate version label
  via CSS ou cacher sur mobile.
- `src/app/screens/HomeScreen.jsx` : revoir layout vertical pour
  mobile (moins de vide central).
- `src/app/screens/LiveScreen.jsx` : refonte iPad-first.

**Coût estimé** : ~6-8h dev + tests sur iPad réel obligatoires
(Sébastien a iPad Pro M4 dans son setup).

#### Sous-phase 7.55.8 (P2) — Petits irritants visuels

Détails relevés lors de l'audit, à fixer en lot :
- Modale d'intro démo : étape 4 "Rock'n'roll !" décoratif, à
  supprimer ou fusionner avec étape 3.
- Carte "Mode démo" sur picker : badge "Sans compte" trop gros vs
  titre, équilibrer hiérarchie typographique.
- Footer "PathToTone" vs nom produit "Backline" : créer mini-page
  "À propos" expliquant que PathToTone = société éditrice, Backline
  = produit. Évite confusion légale et conversion.

**Coût estimé** : ~2h dev.

#### Risques et hors-scope explicite

- **Ne PAS exposer publiquement la liste des profils** dans la
  landing (Phase 7.29.6 a déjà fixé ce point sur ProfilePicker).
  S'assurer que la landing 7.55.1 ne fait pas d'appel Firestore
  pour des données users.
- **Ne PAS activer Stripe / pricing / tier payant** tant que le
  concept n'est pas validé (cible : 10-20 beta-testeurs actifs
  avec retours positifs).
- **Ne PAS supporter Kemper / Quad Cortex / Helix / NAM** tant
  que la V1 ToneX n'est pas validée. La landing 7.55.1 doit
  affirmer clairement le positionnement ToneX-only.
- **Ne PAS faire de mobile app native** (iOS/Android). Le PWA +
  responsive serré suffit largement pour valider le concept et
  les beta-testeurs.
- **GDPR / RGPD** : tout tracking analytics (Phase 7.55.6) doit
  respecter DNT + bandeau de consentement minimal (pas de
  cookies tiers si Plausible/Umami).

#### Ordre recommandé d'implémentation

1. **Phase 7.55.1 + 7.55.2** (P0) : landing + exemple direct.
   Highest ROI. À livrer ensemble (un commit "phase-7.55-landing").
2. **Phase 7.55.5** (P1) : formulaire qualifiant (combine Phase
   7.44 + enrichissement démo).
3. **Phase 7.55.3** (P1) : chips et random sur Accueil démo.
4. **Phase 7.55.6** (P1) : analytics pour mesurer l'impact des
   sous-phases précédentes.
5. **Phase 7.55.7** (P2) : polish responsive (en parallèle si un
   dev second se libère, ou en lot une fois 1-4 livrées).
6. **Phase 7.55.4** (P2) : page studios. À aligner avec le timing
   des contacts Paul TSR / autres éditeurs.
7. **Phase 7.55.8** (P2) : irritants visuels. À grignoter
   opportunistement.

#### Métriques de succès Phase 7.55

- Taux de conversion landing → entrée en mode démo : ≥30%
  (visiteurs first-time qui cliquent "Essayer démo").
- Temps moyen passé en mode démo : ≥3 minutes (vs probablement
  <1 min aujourd'hui sans landing).
- Taux de conversion mode démo → demande d'accès : ≥10% (1 sur
  10 visiteurs démo demande un compte).
- Taux de qualif des demandes reçues : ≥60% (au moins 6 sur 10
  demandes sont des ToneX users actifs avec ≥5 packs).
- Au moins 1 contact établi avec un studio (TSR / ML / Galtone /
  Amalgam) générant un témoignage public.

Métriques mesurées via Phase 7.55.6 analytics + reporting manuel
des demandes admin par Sébastien.

#### Décision actuelle

**Phase 7.55 proposée, pas implémentée.** À déclencher quand
Sébastien valide :
- Le positionnement ToneX-only V1 (vs attendre Tone Master Pro).
- L'opportunité d'investir 25-35h dev sur conversion publique
  (vs continuer à grandir organiquement via Reddit/DM).
- L'accord avec un outil analytics (Plausible / Umami / autre).

Idée enregistrée 2026-05-17 suite à un audit UX "first-time
ToneX user" mené par Claude (Cowork mode). Cf. session du même
jour pour les screenshots et observations détaillées.

### Phase 10 (validée 2026-05-18 — 1 signal Bruno) — Preset avec/sans cab × contexte d'écoute

> **✅ Phase 10 livrée 2026-05-21 nuit en 3 itérations (v8.14.160 → 8.14.162)** :
> - **v1** (8.14.160) : 5 valeurs outputContext (headphone/frfr/pa/ampWithCab/ampNoCab) + dictée cab_enabled selon contexte.
> - **v2** (8.14.161) : simplifiée à 3 valeurs (suppression ampWithCab + ampNoCab — cas marginaux). cab_enabled dicté par CAPTURE (AMP+CAB → false, AMP-only → true).
> - **v3** (8.14.162) : fix raisonnement erroné. cab_enabled TOUJOURS true sur les 3 contextes (pas de cab physique aval = bloc CAB firmware doit rester ON pour entendre la capture complète, manuel TONEX p.29).
>
> Cf section "État actuel" en tête de CLAUDE.md pour le détail. Le
> design original ci-dessous est conservé pour mémoire historique
> et comme base pour Phase 10.1 future si on enrichit
> `PRESET_CATALOG_MERGED` avec `hasCab` + on réintroduit `ampWithCab`.

**Contexte** : Bruno (beta-tester metal/punk) a rapporté en
soirée du 2026-05-18, après la livraison Phase 7.65.x :

> *"juste une autre remarque, il faudrait aussi pouvoir préciser
> je pense si on veut un preset avec ou sans cab. J'ai un mélange
> des deux pour gérer le cas où je joue au casque, je sors sur
> mon ampli pourri, je sors sur la table de mixage / enceintes
> FRFR. Et évidemment si l'IA me conseille un preset sans cab
> alors que je joue au casque c'est une bouillie sonore :)"*

**Diagnostic** : aujourd'hui le catalog `PRESET_CATALOG_MERGED`
(Factory + Anniversary + ToneNET + customPacks) n'a aucune notion
de la présence ou non d'une simulation de cab dans le tone model.
Le scoring V9 et le prompt IA traitent indifféremment :
- Une capture **avec cab modélisé** : sortie directe casque/FRFR
  OK, mais doublonne si branchée sur ampli avec cab physique →
  son boueux/criard.
- Une capture **sans cab** (amp-only) : nécessite un cab en aval
  (physique ou modélisé). Sur casque ou FRFR sans cab actif →
  bouillie aiguë inintelligible (signal saturé brut sans
  post-traitement).

Bruno (et probablement la majorité des utilisateurs ToneX
intermédiaires/avancés) maintient un mélange des deux dans ses
banks pour switcher selon le contexte d'écoute. L'IA recommande
sans tenir compte → 50% du temps elle propose un preset
inadapté au setup live.

**Cas-cibles concrets** :
- Bruno utilise les 3 contextes : casque (à la maison), ampli
  "pourri" (qui a son propre cab — probably un combo avec préamp
  bypassé), table de mixage / FRFR (en répétition).
- Sébastien : ToneX Cab (FRFR avec cab integré → tous presets
  marchent), Marshall SV20h + SV112 (cab physique → preset
  sans cab uniquement), Spark Neo (FRFR intégré → tous OK),
  Roland TH-5 casque (→ tous OK). 4 contextes possibles selon
  le matériel sélectionné.
- Francisco : ToneX Pedal + ampli physique combo ? À investiguer
  s'il rapporte le même cas.

**Solution proposée Phase 10** :

1. **Champ `hasCab: boolean`** sur chaque entry de
   `PRESET_CATALOG_MERGED` (Factory v2 + Anniversary + ToneNET +
   customPacks). Pour le PDF Factory v2, le champ "CAB NAME" (col
   8) signale la présence d'un cab (non-vide = `hasCab: true`,
   vide = `hasCab: false`). Banks 35-39 "(Amp)" + Banks 40-44
   stomps standalone + Banks 47-49 stomps bass = `hasCab: false`.
   Pour Anniversary Premium et ToneNET / customPacks, à déclarer
   lors de la curation. Vision IA tab Packs (Phase 7.x) peut
   inférer auto via l'image du pack.

2. **Champ `profile.outputContext`** ∈ `{headphone, frfr,
   ampWithCab, ampNoCab}` (4 valeurs explicites). Setting UI
   dans Mon Profil → 🎯 Préférences IA ou nouvel onglet 🔌
   Sortie audio. Default `frfr` (le cas le plus courant
   utilisateurs ToneX).

3. **Filtre `findCatalogEntry`** étendu : selon
   `profile.outputContext`, exclure ou pénaliser les entries
   incompatibles :
   - `headphone` ou `frfr` ou `ampWithCab` (cab physique aval) :
     priorité `hasCab` matchant le contexte. Sur `ampWithCab` :
     préférer `hasCab: false` (sinon doublon cab).
   - `ampNoCab` (préampli pur ou émulation cab désactivée aval) :
     priorité `hasCab: true`.

4. **Override par morceau** : champ `song.outputContext` (comme
   Phase 7.3 `song.recoMode`) pour les cas où Bruno veut tester
   un autre setup ponctuellement. UI 4 boutons compacts dans
   SongDetailCard.

5. **Prompt IA enrichi** : section "CONTEXTE D'ÉCOUTE" injectée
   dans `fetchAI` après "MODE RECO". Demande à Gemini de tenir
   compte du contexte dans son `preset_ann_name` /
   `preset_plug_name` retournés.

6. **Post-process Phase 7.55** étendu : `findCatalogEntryByUsages`
   et `findSlotByUsageMatch` filtrent `hasCab` selon
   `outputContext` avant de promouvoir dans `ideal_top3`.

7. **UI Mon Profil** : badge couleur sur chaque slot dans le tab
   Pedale ToneX (🔊 avec cab vs 📡 sans cab) pour aider
   l'utilisateur à mémoriser ses banks.

**Effort estimé** : ~6-10h dev. Découpage possible :
- 10A — `hasCab` champ catalog + parser PDF Factory v2 (2h)
- 10B — `profile.outputContext` setting + UI Mon Profil (2h)
- 10C — Filtre `findCatalogEntry` + override par morceau (2h)
- 10D — Prompt IA enrichi + tests Vitest (2h)
- 10E — UI badges visuels (2h)

**Pas de bump SCORING_VERSION** (additif, filtre côté display +
prompt). Pas de migration localStorage majeure (additif champ
optionnel sur entries + profile).

**Timing** : à intégrer après Phases prioritaires
(7.61/7.64/9/8/7.67). Phase 10 livrée probably juin-juillet
selon bande passante. **Signal** : 1 seul (Bruno) pour l'instant.
À promouvoir si Francisco ou autre beta-tester rapporte le même
cas — c'est probablement très répandu chez les utilisateurs ToneX
intermédiaires (la moitié des questions sur le sub r/tonex porte
sur "casque vs FRFR vs ampli physique").

**Décision actuelle** : proposée Phase 10. Pas d'implémentation
immédiate. À activer quand au moins 1 autre beta-tester ou
visiteur démo remontre le même cas (renforce signal cross-profil
comme Phase 8 et 9), OU si Bruno re-confirme en pratique que la
limitation gêne son usage quotidien après quelques jours d'usage
post-Phase 7.65.x.

### Phase 11 (pivot stratégique 2026-05-18 soir) — Enrichissement metadata via studios partenaires + protections Vision IA + fallbacks user

**Contexte** : la session 2026-05-18 (fix Bruno) a révélé que
le pin custom Phase 7.31 / 7.55 est strictement dépendant des
`usages: [{artist, songs?}]` dans `profile.customPacks`. Bruno
avait 34 customs sans usages → pin échoue. Enrichissement manuel
de Sébastien via JS console matin → 4 pins customs fonctionnent
(Blink-182, Helloween, Metallica, Iron Maiden) après livraison
Phase 7.65.x.

Mais ce workflow JS console n'est PAS scalable. Pour les futurs
beta-testeurs (Francisco, Paul Drew TSR, autres), il faut une
solution propre.

Pendant la conversation 2026-05-18 soir, Sébastien a fait
**l'insight stratégique clé** : *"la base 'communautaire'
pourrait surtout être enrichie par les studios (TSR, AA, ML et
autres) pour que leurs presets remontent en recos."*

Ce pivot change radicalement le modèle d'enrichissement metadata
de Backline.

#### Pourquoi c'est puissant — 5 raisons

1. **Alignement d'intérêts parfait** : les studios VEULENT que
   leurs presets sortent en recos. Plus leurs packs apparaissent
   dans les fiches Backline, plus les utilisateurs achètent leurs
   packs. C'est un jeu positive-sum, pas zero-sum.

2. **Qualité maximale absolue** : TSR sait EXACTEMENT quels
   artistes/morceaux leurs captures `TSR Mars 800SL Cn1&2 HG`
   ciblent. Un user lambda doit deviner. Les `usages` deviennent
   factual data fournis par la source primaire.

3. **Effort distribué et naturel** : 64 packs TSR × 1-2h par pack
   = ~100h pour Paul Drew sur plusieurs mois. Mais ce n'est PAS
   Sébastien qui paie cet effort — c'est TSR qui investit pour
   son propre marketing. Asymétrie élégante.

4. **Branding signal positif** : badge "Curated by The Studio
   Rats" sur les recos = pub gratuite pour studios, signal de
   qualité pour users Backline. Win-win.

5. **Modèle business affiliate viable** : Backline mesure combien
   d'achats packs viennent de ses recommandations (UTM tracking
   par studio). Sébastien monétise sans facturer les users —
   cohérent avec son positionnement "passion + Ko-fi + affiliate
   discrets" du DM IKM matin 2026-05-18 et DM Bruno soir
   2026-05-18.

#### Comparaison vs crowdsource users (approche initiale écartée)

| Critère | Crowdsource users | **Studio-driven** |
|---|---|---|
| Qualité metadata | Variable, dépend du user | **Excellente, source primaire** |
| Effort distribué | 100s users, redondance massive | **50 studios × 1-2h = 100h cumulé** |
| Vitesse acquisition | Lente, chicken & egg | **Rapide si studios accrochent** |
| Branding | Aucun pour user | **Visible et valuable pour studios** |
| Levier économique | Pas de monétisation | **Affiliate links mesurable** |
| Lock-in | Distribué (robuste) | Studio-par-studio (risque conflit) |

Studio-driven écrase crowdsource sur 5/6 dimensions.

#### Stratégie en 4 couches d'enrichissement

L'idée Phase 11 ne remplace pas tout le travail Sébastien — elle
le complète dans une architecture multi-couches qui couvre
~100% du catalog tonex écosystème :

**Couche 1 — Catalog statique enrichi par Sébastien (Phase 7.52 + extensions)**

Sébastien enrichit progressivement les 50-100 packs commerciaux
les plus populaires via Vision IA + validation manuelle. Le
résultat est dans `PRESET_CATALOG_MERGED` côté code, livré avec
chaque release Backline.

- Effort initial : ~50-100h sur plusieurs mois (1-2h par pack via
  Vision IA assistée)
- Coût Vision IA : ~$1-2 total (50 packs × ~$0.02 par extraction)
- Couverture estimée : 80% des banks user

**Couche 2 — Studio-driven (cœur Phase 11)**

Les studios partenaires (TSR, ML Sound Lab, JS, TJ, AA, WT,
Galtone, Amalgam, etc.) enrichissent EUX-MÊMES leurs packs avec
metadata `usages`. Effort distribué naturellement, qualité
source primaire.

- Effort dev Backline : ~6-10h (infrastructure studio account +
  format import + badge + tracking affiliate)
- Effort par studio partenaire : 1-2h par pack × leurs packs
- Coût Vision IA : 0 (les studios fournissent les data)
- Couverture estimée : +15% (top packs commerciaux)

**Couche 3 — Auto-IA enrichissement par nom (compromis intelligent)**

Pour les presets non-couverts par les studios partenaires : un
appel Gemini structured-output à partir du nom du preset + amp
source connu peut inférer des `usages` raisonnables. Genre
"Kirk & James" → l'IA reconnaît automatiquement Metallica.

- Effort dev : ~2-3h (prompt fetchAI dédié "preset enrichment")
- Limite : marche pour noms évocateurs, échoue sur noms neutres
- Coût : marginal (~$0.01 par enrichissement)
- Couverture estimée : +3%

**Couche 4 — Saisie manuelle assistée + Vision IA optionnelle pour long tail**

Pour les vrais cas custom user (5% restants, captures originales
ou packs très niche) : UI où l'utilisateur saisit lui-même le
nom + amp + usages. Vision IA optionnelle (rate-limitée) pour
ceux qui veulent booster via screenshots ToneX Control.

- Effort dev : ~3-4h (Phase 7.67 étendue + Vision IA modal)
- Couvre les cas que aucune des 3 couches précédentes ne touche

**Synthèse couverture estimée** :

| Couche | Effort | Couverture cumulée | Coût Vision IA |
|---|---|---|---|
| 1. Catalog statique (Sébastien) | 50-100h | 80% | ~$2 total |
| 2. Studio-driven | 6-10h dev + accords | 95% | 0 |
| 3. Auto-IA par nom | 2-3h dev | 98% | marginal |
| 4. User manual + Vision IA | 3-4h dev | 100% | rate-limité |
| **Total dev Backline** | **~15-20h** | **~100%** | **~$5-10 total** |

#### Opérationnalisation Phase 11 — 5 axes

**Axe 1 — Format d'import simple pour studios**

CSV/JSON Excel-friendly avec colonnes : `preset_name`, `amp`,
`gain`, `style`, `channel`, `scores_HB`, `scores_SC`, `scores_P90`,
`usages_artist`, `usages_songs` (séparé par virgules ou
sub-arrays JSON).

Le studio remplit dans Excel/Google Sheets, upload sur Backline
via un endpoint dédié (POST `/api/studio/packs/:pack_id/usages`
ou via UI). Ingestion automatique dans
`shared.publicPacks[studio_id].presets[].usages`.

Pas de jargon technique imposé aux studios — un Excel suffit.

**Axe 2 — Compte "Studio" dédié dans Backline**

Nouveau type de profil entre user standard et admin Backline :

- Permissions : édition uniquement de SES propres packs (filter
  par `pack.studio_id`)
- Pas accès aux profils users, aux tabs admin, aux logs Firestore
- Authentification via email confirmé (vérification que la
  personne représente bien le studio — process manuel léger
  Sébastien)

UI dédiée : `mybackline.app/studio` (nouvelle route gated par
`profile.studio_id != null`). Liste leurs packs, bouton
"enrichir metadata", éditeur batch.

**Axe 3 — Badge "Curated by [Studio Name]" sur les recos**

Affichage visible dans la fiche dépliée d'un morceau quand le
preset pinné a été enrichi par son studio :

```
Preset HG 800
✓ Installé — Banque 11B · 🏭 Pédale Factory (firmware v2)
🎯 Curated by The Studio Rats — metadata vérifiée par le créateur
```

Signal de qualité pour user + branding gratuit pour studio.

**Axe 4 — Lien d'affiliation tracking**

Chaque pack curated par un studio a un bouton "Acheter ce pack"
dans Backline qui redirige vers la page d'achat du studio avec
un paramètre UTM (`?utm_source=backline&utm_medium=preset_reco`)
ou un coupon code unique par studio (`BACKLINE10`).

Sébastien voit dans son tableau de bord :
- Nombre de clics par studio
- Conversion estimée (si les studios partagent les data)
- Négociation possible : commission 1-5% du revenu attribué à
  Backline

Cohérent avec position "affiliate discrets, pas SaaS" DM IKM +
DM Bruno.

**Axe 5 — Page publique "Studios partners"**

Route `mybackline.app/studios` qui liste :
- Studios déjà partenaires (badge "Active")
- Studios contactés en attente (badge "Pending")
- Form contact pour studios non-contactés ("Êtes-vous studio,
  contactez-nous")

Crée un effet FOMO ("TSR est déjà partenaire, on devrait y
être"). À coupler avec Phase 7.55.4 déjà documentée
("StudiosScreen — page dédiée éditeurs de packs").

#### Protections Vision IA (couche 4 user-facing)

Si on ouvre Vision IA aux non-admins (Phase 7.67 étendue + couche
4), 3 protections obligatoires avant le go live public :

**Protection 1 — Rate limiting par user (priorité 1)**

Limite stricte côté Backline : max **10 requêtes Vision IA / jour
/ profil**. Reset à minuit UTC. Largement suffisant pour onboarding
(5-12 screenshots pour 50 banks customs full). Bloque les abus.

- Implémentation : compteur `profile.visionIaQuota: { date, count }`
  localStorage + check avant chaque appel. ~30 min dev.
- Affichage UI : "8/10 analyses Vision IA utilisées aujourd'hui"
  sous le bouton Upload.

**Protection 2 — Hash dedup d'images (priorité 1, gros impact)**

Avant d'appeler Vision IA, calculer SHA-256 de l'image. Si hash
existe déjà dans `shared.visionIaCache`, retourner le résultat
caché sans appeler Gemini.

- Impact ÉNORME : si 10 users ont le même Maiden Pack (probable
  parmi metalleux), Sébastien paie 1 fois Vision IA pour les 10.
- Implémentation : 1h dev (helper crypto + cache Firestore
  partagé).
- Bénéfice connexe : alimente automatiquement les templates
  publics studios (Couche 2) avec les enrichissements générés par
  IA.

**Protection 3 — Validation image-side (priorité 2)**

Avant l'envoi à Vision IA, vérifier côté client :
- Dimensions cohérentes (largeur > 800px, ratio paysage 16:9 ou
  4:3)
- Taille raisonnable (< 5 MB, > 50 KB)
- Optionnel : OCR léger client-side (Tesseract.js, ~700KB
  bundle) pour détecter présence de mots-clés "BANK", "PRESET",
  "CL", "DR", "HG" — rejette les images non-pertinentes.

- Implémentation : 1-2h dev (sans OCR), +3h si on ajoute OCR
  client.
- Bénéfice : tue 95% des abuse cas.

**Coût estimé total Vision IA à différents volumes** :

| Volume | Requêtes/jour | Couvert ? | Coût payant |
|---|---|---|---|
| 50 users × 5 screenshots étalés sur 1 mois | ~8/jour | ✅ free tier | $0 |
| 500 users onboardés progressivement | ~80/jour | ✅ free tier | $0 |
| 1000 users en 1 mois (croissance virale) | ~165/jour | ✅ free tier | $0 |
| 5000 users en 1 semaine (cas extrême) | ~3500/jour | ❌ dépasse | ~$3-5/jour pendant le pic |

Au volume réaliste beta actuel (5-10 testeurs), free tier large.

#### Position défensive vs ToneNET et IK Multimedia

Cette section est cruciale : Backline studio-driven peut être
perçu comme concurrent à ToneNET (plateforme communautaire IK).
À anticiper.

**Niveau 1 — Pas concurrent direct (verticaux différents)**

| Dimension | ToneNET | Backline studio-driven |
|---|---|---|
| Fonction primaire | **Hosting** des fichiers .tonex + découverte libre | **Recommandation contextuelle** "quel preset pour ce morceau" |
| Question utilisateur | "Où trouver des captures ?" | "Quel preset pour mon morceau Get Lucky ?" |
| Hosting fichiers | Oui (terabytes) | Non (juste référence + bank/slot addressing) |
| Public cible | Tous utilisateurs ToneX | Utilisateurs ToneX avec setlist/répétition |
| Source du contenu | Uploads users (communauté) | Studios partenaires + Anniversary Premium + Factory + ToneNET integrated (Phase 7.53) |

Couches complémentaires de la chaîne de valeur. Backline UTILISE
ToneNET comme une des sources (Phase 7.53 déjà en place : user
peut tagger ses presets ToneNET dans Backline). Backline ne se
substitue pas — il propose une couche d'usage au-dessus.

Analogie : Spotify vs Tidal sur hosting, ou Last.fm vs Spotify
sur la découverte. Coexistence possible.

**Niveau 2 — Mais 3 zones de friction réelles à anticiper**

1. **Drive du traffic découverte** : si Backline devient le point
   d'entrée "par morceau", users commencent leur recherche par
   Backline au lieu de ToneNET directement. ToneNET perd des
   sessions de découverte libre — même si Backline lui redirige
   du traffic ciblé sur les téléchargements. Net effect dépend
   du ratio.

2. **Metadata structurée** : si Backline héberge des `usages:
   [{artist, songs}]` enrichis par les studios, c'est une valeur
   ajoutée que ToneNET (descriptions texte libre) n'offre pas.
   IK pourrait vouloir égaliser en ajoutant cette fonctionnalité
   à ToneNET — pas un mal en soi, mais ça crée une logique de
   concurrence directe sur ce vertical-là.

3. **Lien d'affiliation studios → contournement IK** : si
   Backline drive des achats vers les pages d'achat des studios
   (TheStudioRats.com etc.), ça contourne ToneNET comme canal
   d'acquisition. IK ne touche pas de commission. Zone la plus
   sensible.

**Position défensive recommandée si IK pose la question**

Affirmation propre à utiliser publiquement (ou en DM CM IKM) :

> *"Backline est un outil compagnon qui maximise la valeur
> d'usage de TONEX. Il pousse les utilisateurs à exploiter les
> 200+ presets qu'ils ont déjà au lieu des 3-5 qu'ils utilisent
> habituellement. Il drive du traffic vers ToneNET (référencement
> direct des presets community) et augmente la demande pour les
> packs Anniversary Premium et studios partenaires. Il n'héberge
> pas de fichiers .tonex, ne concurrence pas ToneNET sur le
> hosting, et n'attire pas d'utilisateurs hors écosystème TONEX."*

Cette position protège tant que :
- Respect des marques (Phase 7.44 disclaimer déjà en place)
- Pas de SaaS commercial sur le dos de TONEX (DM IKM matin)
- Référencement public de ToneNET comme source partenaire dans
  Backline (Phase 7.53)

**Risque long terme à anticiper**

Si Backline devient un standard de découverte par morceau et
signe plusieurs studios partenaires majeurs, IK pourrait :
- Lancer un "ToneNET Pro" concurrent avec metadata enrichies
  similaires
- Offre d'acquisition Backline (best case scenario Sébastien)
- Frictions : API ToneNET fermée, restrictions sur usage de
  noms IK, etc.

Science-fiction pour aujourd'hui (5-10 beta-testeurs). À
surveiller si le volume monte.

#### Pitch pour démarcher studios

Formulation alignée sur "complément ToneNET" :

> *"Backline ne remplace pas ToneNET — il indexe vos packs
> commerciaux + Anniversary Premium dans un contexte d'usage
> différent (recommandation par morceau pour répétition/live).
> Vos uploads ToneNET continuent normalement. Backline ajoute
> juste une couche metadata structurée que ToneNET n'a pas
> (usages artiste/morceau). Et ça drive des achats vers vos
> sites avec un tracking affiliate."*

Studios à prioriser pour démarche (déjà documenté dans
BETA_TESTING.md section 2.bis "Autres pack creators") :
1. Paul Drew (TSR) — déjà contacté, follow-up Mail 3 prêt 19-20 mai
2. Jason Sadites (JS) — fin mai (J+10 post-Paul)
3. Tone Junkie TV (TJ) — début juin (~J+20)
4. Amalgam Audio (AA) — mi-juin (~J+30)
5. Worship Tutorials (WT) — pas prioritaire (0 capture pinnée
   dans la démo actuelle)

#### Tone profile per-capture (Phase 11 + Phase 9 — ajout 2026-05-23)

**Origine** : conversation avec Sébastien 2026-05-23 post-Phase 9.7
sur les recos EQ. Question fondamentale : *"comment l'IA propose les
ajustements EQ etc. sachant que la capture a probablement déjà des
réglages physiques sur l'ampli ?"*

**Limitation actuelle du flow Phase 9** (admise honnêtement) :
- Une capture TONEX (TONE MODEL AMP+CAB) contient déjà FIGÉS les
  réglages physiques de l'ampli original au moment de la capture
  (gain/EQ/presence des potards du vrai ampli, type/distance/axis
  du micro, position cab). Le créateur de pack a calibré ces
  réglages POUR QUE LA CAPTURE SONNE BIEN telle quelle — c'est son
  métier.
- Les boutons preset_settings_v1 Phase 9.1 (BASS/MID/TREBLE/PRESENCE/
  DEPTH) sont des SETTINGS POST-CAPTURE qui s'additionnent
  par-dessus dans le firmware TONEX.
- L'IA Gemini ne connaît PAS le profil tonal interne de la capture
  proposée (mid-heavy ? scooped ? compressed déjà ? breakup
  easy ?). Elle propose donc des valeurs absolues (Mid 7.5, Treble
  6) en supposant implicitement que la capture est "neutre".
- En pratique : Mid +7.5 sur une capture déjà mid-rich peut sonner
  boueux. Treble +6 sur une capture déjà brillante peut sonner
  agressif.

**Mitigation Phase 9.7.1** (2026-05-23) : honest framing.
- Prompt ÉTAPE 7 étendu : "tu NE CONNAIS PAS le profil tonal de la
  capture. Privilégie des valeurs neutres autour de 5/5/5/5/5 sauf
  raison spécifique du morceau. Évite les extrêmes."
- UI : note italique sous la table "🎛️ Réglages pédale" : *"Point
  de départ — la capture intègre déjà les réglages physiques de
  l'ampli original. Affine à l'oreille avec les ajustements
  ci-dessous."*
- Le user comprend que c'est un point de départ + le vrai dialing
  passe par les tweaks Phase 9.4 (*"si trop boomy → Bass -0.5"*).

**Solution structurelle à long terme — Phase 11 Studio-driven** :

L'IA pourrait proposer des recos "delta" (à partir d'un défaut)
plutôt qu'absolues SI elle connaissait le profil tonal de chaque
capture. Seul le créateur du pack a cette info (il connaît ses
réglages physiques figés). D'où un nouvel axe Phase 11 :

**Schéma data — `tone_profile` per-capture** (ajout au catalog) :

```js
// Dans PRESET_CATALOG_MERGED ou shared.studioMetadata
{
  name: "TSR Mars 800SL Chnl 1 Drive",
  src: "TSR",
  // ... champs existants (amp, gain, style, scores HB/SC/P90, usages)
  tone_profile: {
    // Profil tonal estimé par le créateur du pack
    mid_character: 'rich',         // 'scooped' | 'neutral' | 'rich' | 'heavy'
    treble_character: 'balanced',  // 'dark' | 'balanced' | 'bright' | 'harsh'
    bass_character: 'tight',       // 'loose' | 'tight' | 'boomy' | 'thunderous'
    compression: 'breakup',        // 'clean' | 'breakup' | 'compressed' | 'saturated'
    breakup_threshold: 'medium',   // 'low' | 'medium' | 'high' — vitesse de saturation
    presence_emphasis: 'medium',   // 'low' | 'medium' | 'high'
    // Métadonnées optionnelles
    physical_settings_at_capture: {
      gain: 6,
      bass: 4,
      mid: 5,
      treble: 7,
      presence: 6,
      // ... potards réels du moment de la capture (info informationnelle)
    },
    curated_by: 'paul_drew_tsr',
    confidence: 'high',  // 'self_attested' | 'high' | 'medium' | 'low'
  }
}
```

**Caractéristiques tonales à capturer** (valeurs énum, simples à
remplir pour un créateur) :
- `mid_character` : scooped / neutral / rich / heavy
- `treble_character` : dark / balanced / bright / harsh
- `bass_character` : loose / tight / boomy / thunderous
- `compression` : clean / breakup / compressed / saturated
- `breakup_threshold` : low (sature tôt) / medium / high (clean longtemps)
- `presence_emphasis` : low / medium / high

**Bénéfice pour l'IA (Phase 9.7.2 hypothétique)** :

Le prompt fetchAI reçoit le `tone_profile` de la capture choisie (preset_ann_name / preset_plug_name) et peut alors proposer des recos en delta :

| Si la capture est… | L'IA propose pour Mid |
|---|---|
| `mid_character: 'scooped'` (vintage Plexi) | Mid 7.5 (compense pour percer le mix) |
| `mid_character: 'rich'` (JCM800 modifié) | Mid 5 (neutre, ne sur-charge pas) |
| `mid_character: 'heavy'` (Mesa) | Mid 4 (cut pour ouvrir le spectre) |

Idem pour treble/bass/compression. Les recos deviennent **réellement contextuelles** au profil de la capture choisie.

**Pourquoi Phase 11 Studio-driven est le seul chemin viable** :

1. **Seul le créateur connaît ses réglages physiques** : analyser
   un ML model TONEX pour en déduire ces caractéristiques est
   théoriquement possible (FFT + tests) mais demandé un effort
   d'ingénierie disproportionné (et chaque firmware update peut
   changer le format des ML models).
2. **Curation manuelle Sébastien hors-scale** : Sébastien ne peut
   pas écouter et catégoriser les 600+ captures de son catalog.
   Le créateur fait ça en 10 minutes par pack (il connaît).
3. **Alignement d'intérêts** : un pack creator (TSR, AA) qui
   enrichit ses captures avec `tone_profile` voit ses presets
   recommandés plus précisément → plus d'achats. Win-win.
4. **Slot prévu Phase 11** : `shared.studioMetadata` peut étendre
   l'infrastructure existante `shared.studioUsages` (Phase 7.79.3)
   pour porter aussi `tone_profile`. Pas de nouveau schéma à
   inventer.

**Effort estimé** (Phase 11 + Phase 9.7.2) :

- **Phase 11 — Schéma tone_profile** : ~1h (étendre clampStudioMetadata
  ou nouveau clampToneProfile + tests + sync).
- **Phase 11 — UI studio creator pour saisir tone_profile** : ~3-4h
  (form Mon Profil studio account avec 6 dropdowns énum).
- **Phase 9.7.2 — IA recos en delta** : ~2h (prompt étendu pour lire
  tone_profile de la capture choisie + adapter les recos).
- **Curation initiale** : 5-10 min par pack × 50 packs majeurs =
  4-8h de travail créateurs (distribué). Sébastien peut amorcer en
  curant les Anniversary Premium (150 captures déjà documentées
  dans son code).

**Total Backline dev** : ~6-7h. Curation = travail des studios
partenaires.

**Quand activer** :
- **Pas avant Phase 11 globale** (compte studio + UI dédiée). On
  ne peut pas demander à Paul Drew d'enrichir 64 packs sans
  infrastructure.
- **Pré-requis** : au moins 1 studio partenaire actif (Paul Drew
  TSR le plus probable). Sans pilote, pas de signal de validation
  côté créateur.
- **Activation conditionnelle Phase 9.7.2** : seulement si le
  pilote Studio-driven montre que le créateur accepte de fournir
  `tone_profile` en plus des usages.

**Décision actuelle (2026-05-23)** : design documenté. Pas
d'implémentation avant Phase 11 globale + signal pilote studio.
Phase 9.7.1 honest framing (livré 2026-05-23) suffit en attendant.

#### Synergies avec phases existantes

Phase 11 connecte avec plusieurs travaux déjà en cours :

- **Phase 7.45** (Paul Drew TSR) : déjà contacté, premier studio
  partenaire potentiel. Mail 3 follow-up Phase 11 servira aussi
  à introduire l'idée Studio-driven enrichment.
- **Phase 7.52** (Anniversary Premium curé) : Sébastien fait
  déjà partiellement la Couche 1 (catalog statique). Phase 11
  étend l'approche aux packs commerciaux des studios.
- **Phase 7.53** (ToneNET usages éditable par user) : UI
  existante peut être généralisée aux studio packs.
- **Phase 7.55.4** (StudiosScreen page dédiée éditeurs) : à
  coupler avec page "Studios partners" Phase 11 Axe 5.
- **Phase 7.67** (édition rig par non-admin) : Couche 4 Phase 11
  s'appuie dessus.
- **Phase 9** (knob settings chiffrés + FX intégrés) : les
  studios peuvent aussi enrichir les knob settings de chaque
  preset. Doublement valuable.
- **Phase 9.7.1** (honest framing point de départ — livré
  2026-05-23) : mitigation court terme. Phase 11 + `tone_profile`
  = solution structurelle long terme. Cf section "Tone profile
  per-capture" ci-dessus.
- **BETA_TESTING.md section 2.bis** (stratégie d'extension
  autres pack creators) : Phase 11 est l'opérationnalisation
  technique de ce qui est déjà documenté commercialement.

#### Mécanique de curation user → public (Phase 11.1)

L'enrichissement par les studios partenaires (Couche 2) est idéal
mais lent à mettre en place — il dépend des accords commerciaux
avec chaque studio. En attendant, et en parallèle, une approche
**user-contributed catalog avec admin curation** (pattern
Wikipedia / Last.fm / IMDB) permet à Sébastien de mutualiser le
travail d'enrichissement de ses beta-testeurs au bénéfice de tous.

**Architecture en 4 couches au lookup `findCatalogEntry(name)` :**

```
1. profile.customPacks (sa version perso, override)
2. shared.publicPacks (curé par Sébastien, partagé)        ← NIVEAU NOUVEAU
3. PRESET_CATALOG_MERGED (livré dans le code Backline)
4. guessPresetInfo (fallback heuristique)
```

Si le même preset existe à plusieurs niveaux, la version perso a
priorité (l'user peut overrider la version publique avec ses
propres usages).

**Mécanique de promotion user → public :**

1. **User ajoute un preset** dans `profile.customPacks` via le
   tab Phase 7.67. Champ optionnel "Contribuer au catalog
   communautaire ?" (case à cocher, par défaut activée).

2. **Si opt-in user** : le preset reçoit `curationStatus:
   'submitted'` et apparaît dans la **queue de curation admin**
   (nouveau tab Sébastien-only "🎯 Curation").

3. **Tab Curation admin** liste les presets soumis triés par :
   - **Fréquence** : combien d'users ont déclaré ce preset
     (5 users avec le même "TSR Mars 800SL Cn1&2 HG" → prio haute)
   - **Date** : plus récents en haut
   - **Source** : grouper par TSR / JS / etc. pour curer en batch

4. **Sébastien peut** :
   - **Promouvoir tel quel** : copie vers `shared.publicPacks`
     avec source identifiée → `curationStatus: 'curated'`
   - **Éditer puis promouvoir** : modifier usages / amp / scores
     avant de valider
   - **Fusionner versions** : si 3 users ont des usages
     divergents pour le même preset, UI side-by-side pour choisir
     la meilleure version
   - **Rejeter** : `curationStatus: 'rejected'` avec raison
     (mauvais usages, doublon, incohérent)

5. **Notification user** (optionnelle) : *"Ton enrichissement de
   Kirk & James a été ajouté au catalog public — merci pour la
   contribution !"*. Renforce engagement long terme.

**Modèle data :**

Côté `profile.customPacks` (extension) :
```js
{
  name, source, // existant
  presets: [
    {
      name, amp, gain, style, channel, scores, usages,
      curationStatus: 'private' | 'submitted' | 'curated' | 'rejected',
      contributedBy: profileId,
      curationDate: timestamp,
    },
    ...
  ]
}
```

Côté `shared.publicPacks` (nouvelle structure) :
```js
[
  {
    name: "TSR Mars 800SL Cn1&2 HG",
    source: 'TSR',
    amp: 'Marshall JCM800',
    gain: 'high',
    style: 'metal',
    scores: {HB:95, SC:60, P90:70},
    usages: [{artist:'Iron Maiden', songs:[...]}, {artist:'Metallica'}],
    curatedBy: 'sebastien',
    curationDate: 2026-05-20,
    contributors: ['bruno', 'francisco'],
  },
  ...
]
```

**Hiérarchie de sources avec priorité (combinée avec Couche 2 studios) :**

```
1. Sources studios partenaires (TSR, ML, AA, ...) si partenariat actif
   → "Curated by The Studio Rats" badge
   → Authoritative
2. Catalog communautaire curé par Sébastien (shared.publicPacks)
   → "Curated by Backline community" badge
   → Trustworthy
3. Catalog statique Backline (PRESET_CATALOG_MERGED)
   → Code-shipped, stable
4. Custom user perso (profile.customPacks)
   → Override local, pas partagé
```

Quand TSR signe partenariat plus tard, leur enrichissement TSR
écrase tout dans le catalog public pour les presets TSR.

**Bénéfices concrets :**

- Bruno enrichit 12 customs Phase 7.67 → tu cures 5-6 d'entre eux
  (les plus universels : Kirk & James pour Metallica, Maiden Pack
  pour Iron Maiden) → tous les futurs metalleux qui ont ces packs
  bénéficient automatiquement sans rien faire.
- Francisco ajoute des customs liés à son répertoire pop/rock
  espagnol que tu n'aurais jamais découvert → tu enrichis le
  catalog côté espagnol/latin.
- Toi : moins d'enrichissement manuel à grande échelle. Asymétrie
  travail/bénéfice 1:N.

**Risques + mitigations :**

1. **Charge curation Sébastien** : 50 users × 10 customs = 500
   presets à curer. Mitigations :
   - Priorisation automatique par fréquence (1 preset rapporté
     par 5+ users → prio haute, par 1 user → prio basse)
   - Auto-curation pour cas évidents (source identifiée + nom
     pattern connu → pré-curation 1-clic)
   - Délégation à 2-3 power users "curators" à long terme

2. **Conflits sémantiques** : 2 users avec versions divergentes
   pour le même preset. UI merge side-by-side nécessaire (Phase
   11.4).

3. **Pollution** : un user pourrait spammer. Validation Sébastien
   protège, mais effort. Option rate limiting par user (max 50
   submits/jour) si abus.

**Effort estimé curation user → public :**

- **Phase 11.1a** (curationStatus + opt-in + queue admin basique) :
  ~3h dev
- **Phase 11.1b** (promotion vers shared.publicPacks + lookup
  multi-couches) : ~3h dev
- **Phase 11.2** (consentement user + notifications post-curation) :
  ~1h dev
- **Phase 11.3** (priorisation auto par fréquence) : ~1h dev
- **Phase 11.4** (UI dedup/merge versions divergentes) : ~2-3h
  dev (optionnel, peut être différé)

**Total MVP curation** (sans dedup/merge) : ~7h dev.

**Recommandation séquencée Phase 11 globale :**

1. **Phase 7.67 d'abord** (~2h) : ouvrir édition user customs +
   custom guitars + Import/Export CSV. Les users commencent à
   enrichir leurs profils en autonomie. Pas encore de partage
   public — strictement perso.

2. **Phase 11.1 après quelques semaines** (~6h) : ajouter
   curationStatus + queue admin + promotion vers
   shared.publicPacks. Activer quand 3-5 users actifs ont commencé
   à enrichir.

3. **Phase 11.2/3** (~2h) : consentement explicite + notifications +
   priorisation auto par fréquence, polish UX.

4. **Phase 11.4 dedup/merge** : seulement si conflits sémantiques
   observés en pratique.

5. **En parallèle, démarche commerciale studios** (Phase 11
   Couche 2) : Mail 3 Paul Drew TSR (19-20 mai), JS fin mai, TJ
   début juin, AA mi-juin. Quand un studio signe partenariat,
   sa source écrase le catalog community pour ses propres packs.

Design qui scale : Phase 11.1 peut rester dormante tant que volume
bas, à activer quand croissance utilisateurs justifie le travail
de curation.

#### Décision actuelle Phase 11

**Validée mais pas implémentée immédiatement.** Effort total
estimé ~15-20h dev Backline (infrastructure studio + Vision IA
protections + UI) + démarches commerciales étalées sur 2-3 mois
(approche studios un par un).

Déclencheurs pour démarrer l'implémentation :
1. Paul Drew TSR répond positivement au Mail 3 (19-20 mai prévu)
   et signale intérêt à enrichir ses packs
2. OU au moins 2 studios contactés démontrent intérêt
3. OU au moins 1 beta-tester non-admin (Bruno, Francisco, futur)
   bloque effectivement sur le manque d'enrichissement de ses
   customs et exprime explicitement le besoin

Tant qu'aucun de ces 3 déclencheurs n'est atteint, focus reste
sur :
- Couche 1 (Sébastien enrichit Anniversary Premium + autres
  catalog statique)
- Phases livraison code priorité haute en cours (7.61, 7.64,
  7.65.x, 7.67)
- Démarche commerciale studios (Mail 3 Paul, démarcher JS/TJ)

**Note pour BUSINESS_PLAN.md** : ce pivot Studio-driven affecte
le modèle économique (canal affiliate viable). Doit être reflété
dans la doc business stratégique avec :
- Hypothèses revenus affiliate (X% × volume packs vendus via
  Backline)
- Couts d'acquisition studio (effort démarchage, support)
- Risque dépendance IK Multimedia (si concurrence ToneNET Pro
  émerge)

Idée enregistrée 2026-05-18 fin de soirée. Source : insight
Sébastien après discussion sur les 4 couches d'enrichissement
metadata + observation des coûts Vision IA + question pivot
"la base communautaire ne devrait pas être users mais studios".

### Phase 12 (proposée 2026-05-19) — Séparer catalog GLOBAL vs possession USER

**Contexte** : la notion actuelle `availableSources` mélange deux
concepts distincts :
- la **base de recommandation possible** (catalog global, tout ce
  qui existe dans l'écosystème ToneX : Factory + Anniversary +
  64 packs TSR + 5 packs Anniversary Premium + ToneNET public +
  custom packs admin)
- ce que l'**utilisateur possède réellement** (ex: 5 packs TSR
  achetés sur 64, 0 ML, 3 presets téléchargés ToneNET, custom
  packs persos)

Aujourd'hui `availableSources` est un toggle booléen par SOURCE
(TSR / AA / JS / TJ / ML / WT / Galtone / ToneNET / custom /
Factory / FactoryV1 / PlugFactory / Anniversary) — tout ou rien
par source. Un user qui n'a que 5 packs TSR sur 64 doit cocher
"TSR" et hériter de tout le catalog TSR comme s'il l'avait. Le
scoring V9 et l'IA traitent ces 64 packs comme dispos alors que
seulement 5 le sont vraiment.

**Architecture cible** :

| Concept | Stockage | Utilisation |
|---------|----------|-------------|
| Catalog GLOBAL | `PRESET_CATALOG_MERGED` (statique + shared.adminPacks + shared.toneNetPresets) | `ideal_preset` IA (= "rêve"), Explorer, suggestions hors collection |
| Possession USER | `profile.ownedPacks: {[packId]: true}` (per-profil) | `preset_ann`/`preset_plug` IA, scoring V9 local, filtrage Sources |

**3 niveaux de granularité possibles** (à trancher) :
- **A.** Par source entière (status quo, le moins de boulot)
- **B.** Par pack individuel (TSR-Mars-800SL, TSR-D13, etc.) —
  **recommandé** : c'est ce que les studios vendent et ce que
  l'user achète. Sweet spot.
- **C.** Par preset individuel — trop granulaire, ingérable

**Liste des packs disponibles à exposer** (sources possibles) :
- 64 packs TSR (`TSR_PACK_GROUPS` déjà défini Phase 7.14)
- 5 packs Anniversary Premium : AA / JS / TJ / ML / WT (Phase 7.52)
- ToneNET : pas de notion de pack, presets individuels (cocher
  séparément via tab ToneNET existant Phase 7.53)
- Factory : packs implicites (firmware v1 / v2 / Anniversary /
  Plug) — déjà gérés via `enabledDevices`
- Custom : packs persos user (`profile.customPacks` Phase 7.69)
  + packs admin partagés (`shared.adminPacks` Phase 7.69.7)

**Sous-phases proposées (additives, anti-régression)** :

#### Phase 12.1 — Schema additif + UI parallèle

- Nouveau champ `profile.ownedPacks: {[packId]: true}` (additif,
  pas de bump STATE_VERSION nécessaire si optional fallback).
- Migration silencieuse au boot : si `profile.ownedPacks` absent
  ET `availableSources.TSR === true`, pose `ownedPacks` avec tous
  les packs TSR cochés. Idem pour AA/JS/TJ/WT/Galtone/ML. Pas de
  destruction de `availableSources` — coexistence.
- Nouveau tab "📦 Ma collection" dans Mon Profil (parallèle à
  "Sources") : liste hiérarchique avec checkboxes par pack et
  groupes par source. Boutons "Tout cocher / Tout décocher" par
  source.
- Pas de changement scoring V9 → safe, snapshots verts.

#### Phase 12.2 — Basculer scoring V9 vers ownedPacks

- Refactor `isSourceAvailable` → `isPackAvailable(entry,
  ownedPacks, availableSources)` qui fait :
  - Si `entry.pack` connu : check `ownedPacks[entry.pack]`
  - Fallback : check `availableSources[entry.src]` (rétro-compat)
- Adapter `computeBestPresets`, `findCatalogEntryByUsages`,
  `findSlotByUsageMatch`, `analyzeDevice` Optimiser, etc.
- Tests Vitest sur le helper + cas régression.
- Bump SCORING_VERSION 9 → 10 OBLIGATOIRE car le filter change
  pour les aiCache existants → invalidation massive → re-fetch IA
  côté tous les profils. Coût Gemini significatif (free tier OK
  pour beta-testeurs actuels).

#### Phase 12.3 — Recos `ideal_preset` hors collection

- `ideal_preset` peut désormais pointer vers un preset hors
  `ownedPacks` du user.
- UI : badge **"📦 Pas dans tes packs"** sur le bloc reco idéale +
  lien d'achat (cohérent affiliate Phase 11 Studio-driven).
- `preset_ann`/`preset_plug` restent strictement dans les banks
  installées (déjà filtré par possession physique → no-op).

#### Phase 12.4 — Déprécier `availableSources`

- Quand `ownedPacks` est stable et tous les profils ont migré,
  retirer `availableSources` du schema. Cleanup code paths.

**Effort total estimé** : 12-17h.
- Phase 12.1 : 4-6h (schema, UI tab "Ma collection")
- Phase 12.2 : 3-4h (refactor scoring + bump V10)
- Phase 12.3 : 2-3h (UI badge + lien d'achat)
- Phase 12.4 : 3-4h (cleanup tests + déprécation)

**Risques** :
- Bump SCORING_VERSION 9 → 10 invalidera tous les aiCache existants
  → coût Gemini + désynchro temporaire. À coupler avec une
  communication beta-testeurs.
- Phase 11 (studio-driven enrichissement) pourrait introduire un
  nouveau champ `entry.pack` plus structuré → couplage à anticiper.

**Décision actuelle** : proposée. À activer après :
- Phase 11 si elle démarre (couplage data model packs)
- OU si un beta-tester remonte explicitement le manque de
  granularité (ex: "j'ai juste 2 packs TSR pas 64, pourquoi
  Backline me propose des SL760 que je n'ai pas ?")

Idée enregistrée 2026-05-19 après session import CSV Phase
7.69.x : Sébastien constate que pour ses propres 22 unknowns
détectés depuis ToneX_Anniversary_test.csv, beaucoup étaient
des packs qu'il ne possède PAS mais que `availableSources.TSR
=== true` faisait passer pour dispos.

### Phase 13 — ✅ CLOSE 2026-06-03 (sauf dette optionnelle 13.6/13.7) — Base ARTISTS (guitaristes/bassistes + setup historique)

**Status final** : 286 artistes dans la base (20 seed Phase 13.0 + Bertignac
manuel + 224 Cowork v1 + 41 Cowork v2). Sous-phases 13.0/13.1/13.1.1/13.2/13.4
toutes livrées (v9.7.15 → v9.7.28). 13.3 marquée NON-APPLICABLE
(optimisation théorique sans effet réel : le prompt n'envoyait pas
le catalog complet). 13.6/13.7 reportées en dette optionnelle.

Cf section "État actuel" en tête de CLAUDE.md pour le détail des
effets validés (Flipper, Bruno Blink-182) et l'architecture cascade
livrée. Le design original ci-dessous reste comme référence
historique.

---

**Contexte** : la curation actuelle des `usages` per-capture (Phase
7.52 Anniversary Premium curées + Phase 7.53 ToneNET + Phase 7.79.3
cascade) est artisanale et scale en O(N captures × N artistes). Pour
600+ captures du catalog total, seulement ~32 ont des `usages`
explicites → fallback scoring V9 standard pour le reste, sans pin
PRIORITÉ 1 prompt IA Phase 7.34/7.52.1.

**Pivot stratégique** : factoriser la curation. Plutôt qu'enrichir
chaque capture une par une, créer une **base ARTISTS** (guitaristes
+ bassistes) avec setup historique de référence. À partir de cette
base, on peut auto-inférer les `usages` de TOUTES les captures du
catalog (helper `inferUsagesFromAmp(amp, ARTISTS)` qui scanne les
artistes dont l'amp ∈ eras[].amps).

#### Bénéfices

1. **Anti-hallucination IA `ref_amp`** : si Gemini propose un ampli
   faux pour un artiste connu (cas Bruno : "Marshall Super100" pour
   Blink-182 alors que Mesa Boogie), post-process correctif côté
   code → fix racine sans re-fetch.
2. **Auto-enrichissement usages cross-catalog** : toute capture
   Marshall JTM45/Plexi/JCM800/etc. hérite auto des artistes qui
   les ont utilisés. ~80% du coût curation manuelle évité.
3. **Symétrie ampli pour Phase 7.64 family match** : aujourd'hui
   boost +15 côté guitare (Strat/Tele/LP family match). ARTISTS
   permet `if entry.amp ∈ ARTISTS[refGuitarist].amps → +15` côté
   ampli. Resout cas Paranoid (Sabbath Laney/Orange historique).
4. **Phase 8 basse first-class** : couvre gratuitement les
   bassistes (John Deacon → Precision + Rumble, etc.). Symétrie
   guitariste/bassiste pour `bass_recommendation` Phase 8.7+.
5. **Réduction tokens IA ~30-50%** :
   - **Input** : pré-filtrage catalog côté code selon artiste
     (~30 captures pertinentes vs 600 sérialisées) = -600 tokens
   - **Output** : `ref_amp`/`ref_guitar`/`ref_guitarist` sourcés
     ARTISTS, plus demandés à l'IA = -30% output trilingue
   - **Re-fetches** : post-process correctif évite les re-fetches
     dus aux hallucinations = -50% sur ces cycles
6. **Déterminisme** : factuels (amp/guitare/guitariste) sourcés
   ARTISTS, l'IA se concentre sur sa vraie valeur (prose
   contextuelle, scoring nuancé). Moins de variance entre fetches.

#### Garde-fous anti-dogmatique

- **SONG_HISTORY > ARTISTS** : si `SONG_HISTORY[songId].amp` défini,
  il écrase ARTISTS pour CE morceau. Granularité morceau bat
  granularité artiste. Cas Bonamassa (4 amplis différents selon
  morceaux) géré sans config complexe.
- **Boost dégressif** : si l'era a N amplis listés, boost = `+15/N`
  (mono-ampli historique = +15, 4 amplis = +3.75 chacun). Le
  scoring V9 garde le dernier mot.
- **Soft hint, pas override dur** : ARTISTS active surtout les
  `usages` du catalog statique + le contexte prompt. Le scoring V9
  brut reste primaire. ARTISTS ne fait que pousser dans la même
  direction quand le signal est cohérent.

#### Schéma data

```js
// src/data/artists.js — base livrée avec le code (Cowork seed)
ARTISTS_SEED = {
  angus_young: {
    name: "Angus Young",
    role: "guitarist",            // 'guitarist' | 'bassist' | 'multi'
    bands: ["AC/DC"],
    eras: [
      {
        period: "70s",
        years: [1973, 1979],
        guitars: ["Gibson SG Standard"],
        amps: ["Marshall Plexi 1959", "Marshall Super Lead 100W"],
        pedals: ["Schaffer Vega Diversity System"]
      },
      {
        period: "80s+",
        years: [1980, 2026],
        guitars: ["Gibson SG Standard"],
        amps: ["Marshall JTM45", "Marshall JCM800"],
        pedals: ["Schaffer Replica"]
      }
    ],
    notes: "Setup signature reconnaissable",
    sources: ["https://en.wikipedia.org/wiki/Angus_Young", "..."]
  }
}

// Cascade lookup pattern Phase 7.79.3 :
// 1. shared.artistsOverrides[id]    (admin edits runtime)
// 2. shared.artistsAutoEnrichments  (auto-enrich, status='accepted')
// 3. ARTISTS_SEED[id]               (livré code, Cowork seed)
```

#### Couverture cible — ~400 artistes (~100/décennie 60s-90s)

Décomposition (filtre qualité : Wikipedia EN >1000 mots OU
classement canonique RS250/GuitarWorld) :

| Décennie | Guitaristes | Bassistes | Total cible |
|---|---|---|---|
| 60s rock/blues | ~70 | ~30 | ~100 |
| 70s hard rock/prog | ~75 | ~25 | ~100 |
| 80s metal/glam/pop | ~80 | ~20 | ~100 |
| 90s grunge/alt | ~70 | ~30 | ~100 |
| Bonus jazz/funk | ~15 | ~15 | ~30 |

Après filtre qualité, output effectif probably **~300-350 artistes**
(certaines niches mid-tier exclues si docs trop pauvres).

Effort Cowork batch : ~4h cloud (10 sub-agents parallèles, 4
batches par décennie). Validation Sébastien : ~4-5h sur 4-5
sessions.

#### Plan d'exécution Phase 13

- **13.0** — Schema `src/data/artists.js` + helpers (`getArtist`,
  `findArtistsByBand`, `inferUsagesFromAmp`, `getEra`,
  `getCurrentEra`) + 20 artistes seed test (figures clés des 13
  morceaux SONG_HISTORY + bonus beta) + tests Vitest dédiés (~3h)
- **13.1** — Refacto prompt fetchAI : suppression
  `ref_amp/guitar/guitarist` de l'output (sourcés ARTISTS),
  injection setup historique dans le prompt. Pas de bump
  SCORING_VERSION (juste prompt). Rétrocompat aiCache : fallback
  ARTISTS lookup si champs absents (~2h)
- **13.2** — Boost amp family match V9 dégressif (anti-Bonamassa)
  + post-process correctif `ref_amp` hallucination (~2h)
- **13.3** — Helper pré-filtrage catalog selon artiste (réduction
  input prompt) (~1h)
- **13.4** — UI admin "🎭 Artistes" CRUD + sync Firestore
  `shared.artistsOverrides` LWW per-entry (~3h)
- **13.5** — Cowork seed extension ~400 artistes en 4-5 batches
  par décennie (~4h cloud + 4-5h validation Sébastien)
- **13.6** (optionnel) — Détection runtime queue `pendingArtists`
  + tab admin "🎭 En attente" + bouton "Lancer Cowork batch" :
  pour artistes 2000s+ / niches non-couverts par 13.5 (~2h)
- **13.7** (optionnel) — Workflow validation batch (~2h)

**Effort total** : ~14-16h dev + ~4-5h validation Sébastien base
initiale. 13.6/.7 = dette optionnelle si signal après usage.

#### Architecture batch différé vs runtime auto

**Choix retenu : batch différé** (Sébastien lance Cowork manuel
quand bandwidth). Pourquoi :
- Coûts Cowork prévisibles, app reste autonome
- Validation centralisée Sébastien > gating heuristique fragile
- Cohérent avec patterns existants (Phase 11 Studio-driven manuel,
  Phase 7.78 curation queue admin)
- Latence acceptable (~1-7j avant enrichissement nouveau artiste)
- fetchAI tourne sans bonus ARTISTS pendant la fenêtre → recos =
  qualité actuelle, pas dégradée

**Couplage Phase 11 Studio-driven** : ARTISTS sert de **vocabulaire
commun** quand TSR/AA/JS curent leurs packs. Studio dit "ma capture
Mesa Mark IIC+ vise Kirk Hammett" → ARTISTS confirme → `usages`
auto-générés.

#### Dette résiduelle Phase 13

- **Bundle impact** : ~400 artistes × ~500 bytes/artiste = ~+200 KB
  inline. Bundle actuel 2675 KB → 2875 KB (+7.5%). Acceptable mais
  à monitorer. Mitigation possible Phase 13.x : format compressé
  (keys courts `n`/`r`/`b`/`e`/etc. avec helper unpack) → -40%.
- **Sources URLs** : si stockées inline = ~+50 KB supplémentaire.
  Option : retirer du bundle (sources servent juste à la validation
  Sébastien, pas au runtime).
- **Maintenance long-terme** : artistes contemporains (2000s+,
  Synyster Gates, etc.) à ajouter via 13.6/13.7 ou batch annuel
  Cowork. Pas critique car couverture 60s-90s = ~95% morceaux
  beta-testeurs actuels.
- **Risque "effet Mathieu"** : on boost les artistes canon et on
  rate les morceaux moins connus. Mitigation : soft hint pas
  override, fallback scoring V9 préservé.

#### Quand activer

**13.0 démarré 2026-06-02** (cf section "État actuel"). Phases
suivantes selon priorité vs Phase 8 (basse) / Phase 9 (EQ) /
Phase 11 (Studio-driven).

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
