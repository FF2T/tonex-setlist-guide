# Backline — Cascade d'overrides d'usages (Phase 7.79.3)

> Document de référence Phase 7.79.3 (livrée 2026-05-20). Cascade
> 4 niveaux pour curer les `usages: [{artist, songs?}]` d'un preset
> sans toucher au code source du catalog.
>
> **À lire OBLIGATOIREMENT avant de toucher à `findCatalogEntry`, à
> `saveUsagesForPreset`, à `mergeUsagesOverridesLWW`, ou au pipeline
> `window._usagesCascadeState` de `main.jsx`.**

## Pourquoi la cascade

Avant Phase 7.79.3, le champ `usages` d'un preset était :
- **Soit hardcodé dans le code source** (catalog statique TSR / AA / JS /
  TJ / WT / Galtone / ML / Anniversary / Factory / PlugFactory)
- **Soit dans `profile.customPacks[].presets[].usages`** (custom user,
  Phase 7.69)
- **Soit dans `shared.toneNetPresets[].usages`** (ToneNET partagé,
  Phase 7.53)

Conséquence : pour enrichir un preset TSR ou AA avec un nouvel usage
artiste, il fallait éditer `src/data/anniversary-premium-catalog.js`
ou `src/data/data_catalogs.js` et redéployer Backline. Friction
admin + impossible pour les beta-testeurs en perso.

Phase 7.79.3 introduit la **cascade d'overrides** : un système 4 niveaux
qui permet à l'admin (et plus tard aux studios Phase 11) d'override les
usages d'un catalog statique au runtime, sans toucher au source. Et qui
permet aussi à un user non-admin de tagger ses propres overrides
prioritaires sans impacter les autres profils.

## Les 4 niveaux

```
findCatalogEntry(name) résout les usages via :

  ┌───────────────────────────────────────────────────────┐
  │ 1. profile.usagesOverrides[name]   (user perso)       │ ← priorité max
  │    → visible que par l'user qui l'a écrit             │
  └───────────────────────────────────────────────────────┘
                            ↓ si absent
  ┌───────────────────────────────────────────────────────┐
  │ 2. shared.studioUsages[name]       (studio Phase 11)  │
  │    → écrit par les pack creators partenaires          │
  └───────────────────────────────────────────────────────┘
                            ↓ si absent
  ┌───────────────────────────────────────────────────────┐
  │ 3. shared.usagesOverrides[name]    (Backline admin)   │
  │    → écrit par Sébastien admin, visible par tous      │
  └───────────────────────────────────────────────────────┘
                            ↓ si absent
  ┌───────────────────────────────────────────────────────┐
  │ 4. catalog.entry.usages             (default, hardcodé)│
  │    → src/data/*-catalog.js, code source               │
  └───────────────────────────────────────────────────────┘
```

**Règle d'or** : un override **"vide explicite"** (`usages: null` au
lieu de `usages: [...]`) STOPPE la cascade et retourne `null`. C'est
intentionnel : l'user a le dernier mot, sa désactivation écrase un
niveau studio/backline/catalog.

Pour DELETE complètement un override et reprendre la cascade au niveau
suivant : utiliser `removeUsagesOverride` (DELETE l'entry de la map)
au lieu de `saveUsagesForPreset(name, undefined)` (écrit
`{ usages: null }`).

## Architecture

### 3 fichiers clés

```
src/core/usages-cascade.js          Helpers purs (resolveUsagesCascade,
                                    mergeUsagesOverridesLWW, getUsageOverride)
src/core/preset-curation.js         Routing setter (saveUsagesForPreset,
                                    removeUsagesOverride)
src/core/catalog.js                 findCatalogEntry + _applyUsagesCascade
                                    (lit window._usagesCascadeState)
```

### Pipeline runtime

```
1. main.jsx maintient le state cascade dans React useState :
   - sharedUsagesOverrides    (niveau 3, Backline admin)
   - sharedStudioUsages       (niveau 2, slot Phase 11)
   - profile.usagesOverrides  (niveau 1, per-profile via setProfiles)

2. useEffect sync window._usagesCascadeState à chaque mutation :
   window._usagesCascadeState = {
     profileOv: profile.usagesOverrides,
     studioOv: sharedStudioUsages,
     backlineOv: sharedUsagesOverrides,
   }

3. findCatalogEntry(name) appelle _applyUsagesCascade qui lit
   window._usagesCascadeState et applique resolveUsagesCascade.

4. L'entry retournée a 2 champs annotés :
   - entry.usages              : résolus selon cascade
   - entry._usagesSource       : 'user' | 'studio' | 'backline' | 'default'
   - entry._usagesCuratedBy?   : pour 'studio' (Phase 11)
```

## Routing de saveUsagesForPreset

`saveUsagesForPreset(name, usages, ctx)` route selon `entry.src` +
`isAdmin` :

| entry.src | isAdmin | Destination | Niveau cascade |
|---|---|---|---|
| `custom` | any | `profile.customPacks[].presets[].usages` | n/a (pas cascade) |
| `ToneNET` | any | `shared.toneNetPresets[].usages` | n/a (pas cascade) |
| Catalog statique (TSR/AA/JS/...) | `true` | `shared.usagesOverrides[name]` | **niveau 3** |
| Catalog statique | `false` | `profile.usagesOverrides[name]` | **niveau 1** |

Avec `usages: undefined` :
- custom/ToneNET → DELETE le champ `usages` de la donnée
- Catalog statique → écrit `{ usages: null, lastModified }` (override
  "vide explicite")

## Sync Firestore (Phase 5.7 + 7.79.3c)

- **`profile.usagesOverrides`** (niveau 1, per-profile) : sync via
  push profil habituel (Phase 5.7 LWW per-profile). Inclus dans
  `profileHash` du syncHash pour déclencher push à la modif.
- **`shared.usagesOverrides`** (niveau 3) + **`shared.studioUsages`**
  (niveau 2) : sync via state.shared standard. Inclus dans
  syncHash global. **Merge per-item LWW** au pull via
  `mergeUsagesOverridesLWW` (pattern Phase 7.53.1 toneNetPresets) :
  - Présent des 2 côtés → garde plus grand `lastModified`
  - Égalité ts → keep local (anti-thrashing)
  - Local-only → keep local
  - Remote-only → adopt remote

**Pas de tombstones v1** : pour DELETE un override, écrire `{ usages: null }`
(via `saveUsagesForPreset(name, undefined)` sur catalog statique). Si
besoin de DELETE complet pour reprendre la cascade au niveau précédent,
utiliser `removeUsagesOverride` qui delete l'entry localement et la LWW
propage le delete au prochain push (`mergeUsagesOverridesLWW` sur une
key absente d'un côté → adopt l'autre, donc le delete s'efface si l'autre
device a encore l'entry — TODO Phase ultérieure : tombstones).

## Cas d'usage typiques

### 1. Admin Sébastien enrichit un preset TSR

1. Mac : Explorer → fiche `TSR Mars 800SL Cn1&2 HG` → "✏️ Modifier"
2. Ajouter `{artist: 'Iron Maiden', songs: ['Fear of the Dark']}`
3. Save → `saveUsagesForPreset(name, [...], { isAdmin: true,
   onShared: setSharedUsagesOverrides })`
4. → écrit dans `shared.usagesOverrides['TSR Mars 800SL Cn1&2 HG']`
5. Push Firestore en ~5s
6. iPhone reload → pull → merge LWW → tous les profils voient désormais
   l'usage avec badge "⚙️ Backline"

### 2. Bruno (non-admin) override perso

1. iPhone : Explorer → même preset
2. Bruno voit "⚙️ Backline" (l'override admin) avec usage Iron Maiden
3. Bruno préfère le pin sur Metallica → "✏️ Modifier" → édite
4. Save → `saveUsagesForPreset(name, [...], { isAdmin: false,
   activeProfileId: 'bruno', onProfiles: setProfiles })`
5. → écrit dans `profile.bruno.usagesOverrides[name]`
6. Bruno voit "👤 Toi" sur la fiche (niveau 1 prend la priorité)
7. Les autres profils continuent de voir "⚙️ Backline" (override admin
   visible seulement par Bruno côté niveau 1)

### 3. Bruno restaure la version Backline

1. Bruno clique "🔄 Restaurer la version par défaut"
2. → `removeUsagesOverride(name, { isAdmin: false, activeProfileId: 'bruno',
   onProfiles: setProfiles })`
3. DELETE l'entry de `profile.bruno.usagesOverrides`
4. Cascade reprend au niveau 3 (Backline) → badge "⚙️ Backline" réaffiché

### 4. Phase 11 future : studio TSR enrichit ses packs

(slot prêt, pas encore implémenté V1)

1. Paul Drew se connecte au compte studio TSR sur Backline
2. UI dédiée (à concevoir Phase 11) → enrichit metadata de ses 64 packs
3. → écrit dans `shared.studioUsages['TSR Mars 800SL...']` avec
   `curatedBy: 'TSR'`
4. Sync Firestore → tous les users Backline voient badge "🏷️ Studio (TSR)"
5. La cascade place l'override studio en niveau 2 (au-dessus de
   Backline admin, au-dessous de user perso)

## Pièges à éviter

### Piège 1 : modifier `findCatalogEntry` sans gérer la cascade

`findCatalogEntry` est un wrapper qui appelle `_findCatalogEntryRaw`
puis `_applyUsagesCascade`. **Ne jamais** réécrire `findCatalogEntry`
pour court-circuiter `_applyUsagesCascade` — toute la cascade casse.

Si tu as besoin du catalog brut sans la cascade (rare, debugging),
exporter et utiliser `_findCatalogEntryRaw` (pas exporté pour
l'instant, à exposer si vrai besoin).

### Piège 2 : oublier de sync `window._usagesCascadeState`

Le `useEffect` de main.jsx (~ligne 533) doit poser
`window._usagesCascadeState` à chaque mutation des 3 maps. Si on ajoute
un nouveau setter qui mute `profile.usagesOverrides` sans déclencher
ce useEffect (deps array correct), la cascade ne se met pas à jour →
`findCatalogEntry` retourne du contenu stale.

### Piège 3 : `usages: undefined` ≠ `usages: null`

- `saveUsagesForPreset(name, undefined, ctx)` sur catalog statique →
  écrit `{ usages: null, lastModified }` (override vide explicite, STOP
  cascade)
- `removeUsagesOverride(name, ctx)` → DELETE l'entry (cascade reprend
  au niveau suivant)

Ne pas confondre. L'UI "🔄 Restaurer" doit toujours appeler
`removeUsagesOverride`, jamais `saveUsagesForPreset` avec undefined.

### Piège 4 : routing custom/ToneNET vs catalog statique

`saveUsagesForPreset` route automatiquement selon `entry.src`. Mais les
sources custom/ToneNET stockent leur `usages` DANS la donnée
(`profile.customPacks[].presets[].usages` ou `shared.toneNetPresets[].usages`),
pas dans la cascade. Donc pour ces sources :
- `_usagesSource` n'est jamais 'user', 'backline' ou 'studio' (puisque
  pas d'override dans la cascade)
- Le bouton "🔄 Restaurer" est caché (canRemoveOverride=false)
- `removeUsagesOverride` est no-op pour custom/ToneNET

### Piège 5 : tests Node vs jsdom

`_applyUsagesCascade` early-return si `typeof window === 'undefined'`.
Les tests `.test.js` tournent en env Node (pas jsdom). Pour tester
l'intégration cascade + findCatalogEntry, stubber `globalThis.window`
au beforeAll (cf `src/core/usages-cascade.integration.test.js`).

Les tests unitaires purs de `resolveUsagesCascade` etc. n'ont pas
besoin de ce stub (ils ne passent pas par findCatalogEntry).

## Tests de référence

- `src/core/usages-cascade.test.js` (28 tests) — helpers purs unitaires
- `src/core/preset-curation.test.js` (40 tests, dont 16 routing 7.79.3b) —
  routing saveUsagesForPreset + removeUsagesOverride
- `src/core/usages-cascade.integration.test.js` (13 tests) — scénarios
  end-to-end : cascade complète via findCatalogEntry, sync LWW multi-device,
  préparation Phase 11 studio, isolation entre profils non-admin

## Lien Phase 11 (Studio-driven)

Phase 11 (cf "Idées en attente" CLAUDE.md) doit ajouter :
- Un compte "studio" séparé (entre user standard et admin Backline)
- Une UI dédiée pour les pack creators (TSR, ML, AA, JS, TJ, WT, Galtone...)
- Un routing `saveUsagesForPreset` cinquième branche : `entry.src ∈
  studio.ownedPacks` + login studio → `shared.studioUsages[name]` avec
  `curatedBy: studio.id`
- Badge UI "🏷️ Studio (TSR)" déjà câblé Phase 7.79.3b (lit `_usagesCuratedBy`)

Le slot `shared.studioUsages` est prêt à recevoir. La cascade
fonctionne déjà niveau 2. Aucun refactor cascade nécessaire pour
Phase 11 — c'est juste un ajout de routing et de UI.
