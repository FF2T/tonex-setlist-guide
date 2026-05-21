# Backline — Protocole d'investigation pollution profile (Phase 7.74.6)

> Document de protocole reproductibilité pour le bug de pollution profile
> récurrent (5 occurrences observées depuis Phase 7.74.x, mai 2026).
> Destiné à être exécuté par **Claude Cowork** (ou Sébastien en manuel)
> dans une session dédiée pour identifier la cause racine.
>
> Créé 2026-05-21 après 5e occurrence (`banksAnn` Sébastien : 23C vidé +
> 18C remplacé), déclencheur soupçonné = session Cowork avec mode démo
> + multi-switchs profil.

## Historique du bug

5 occurrences documentées :

| # | Date | Profil affecté | Champ corrompu | Symptôme | Phase fix tentative |
|---|---|---|---|---|---|
| 1 | 2026-05-18 | Sébastien | `myGuitars` | Perte Tele 51 + ajout Sire T3/T7 (autres profils) | 7.74.1 filter orphan |
| 2 | 2026-05-18 | Sébastien | `myGuitars` | Idem | 7.74.2 auto-repair (régression, désactivé) |
| 3 | 2026-05-19 | Sébastien | `myGuitars` | Swap 1↔1 cg_* avec Francisco | 7.74.4 Couche 4 swap suspect |
| 4 | 2026-05-19 | Sébastien | `myGuitars` | Idem (résidu pollution iPhone) | 7.74.4 idem |
| 5 | **2026-05-20** | **Sébastien** | **`banksAnn`** | Slot 23C vidé + 18C Supergroupbass remplacé | **À INVESTIGUER** |

**Pattern commun** : le profil Sébastien (admin) perd des données qui
sont remplacées par celles d'un autre profil (Francisco, Bruno, curateur
démo selon les cas). Phase 7.74.4 a ajouté une défense Couche 4 sur
`myGuitars` (swap suspect `cg_*→standard`) mais la cause racine n'est
toujours pas identifiée — la 5e occurrence est sur `banksAnn`, hors
scope de la défense actuelle.

## Hypothèses cause racine

**H1 — Race condition `mergeProfileLWW` + stamp `lastModified`** :
Le merge LWW per-field décide adoption remote vs keep local en
comparant `profile.lastModified`. Si un stamp parasite met
`remote.lastModified > local.lastModified` au moment d'un swap profil,
le merge adopt les champs remote (incluant les banks d'un autre profil).

**H2 — Stamp parasite admin-switch (Phase 7.63)** : quand Sébastien
admin switch vers un autre profil via le dropdown ProfileSelector, le
`activeProfileId` change mais est-ce que le stamp `lastModified`
s'applique correctement ? Possible que le stamp soit posé sur le
profil source au lieu du profil cible.

**H3 — `enterDemoMode` Phase 7.52.14 force override par id** : à
l'entrée en mode démo, le snapshot bundlé override les setlists/songs/
profiles par id. À la sortie (DemoBanner "✕ Quitter" Phase 7.55-quickwins),
le state in-memory peut contenir des résidus du profil démo + curateur
qui se persistent dans localStorage et polluent le profil Sébastien.

**H4 — Combo H2 + H3** : la séquence "mode démo → exit → switch
curateur → modifs → retour admin" cumule les deux, augmentant la
probabilité de pollution.

## Prérequis safety AVANT la session

⚠ **CRITIQUE** : éviter de polluer la prod Firestore pendant l'investigation.

### Étape 0a — Snapshot manuel "investigation-start"

Côté Sébastien admin :
1. Mon Profil → 🔧 Maintenance → "💾 Snapshots manuels"
2. "Créer un snapshot" → label : `investigation-start-2026-MM-DD`

### Étape 0b — Activer mode no-sync isolé

Pour la session investigation, utiliser `https://mybackline.app/?beta=1`.
Active automatiquement le mode no-sync (Phase 7.25) → icône 🔒 dans le
header → **zéro push/pull Firestore** pendant la session.

Sinon, manuellement :
```js
localStorage.setItem('backline_no_sync', 'true');
location.reload();
```

### Étape 0c — Activer logs forensique

Console DevTools :
```js
localStorage.setItem('__backline_persist_logs', 'true');
window.__BACKLINE_MERGE_DEBUG = true;
location.reload();
```

Le wrapper Phase 7.74.5 capture désormais tous les `console.warn`/`log`
matching `[merge*` ou `SUSPECT` dans `localStorage.__backline_merge_logs`
(max 50 entries FIFO). Accessible via `window.__getMergeDebugLogs()`.

### Étape 0d — Snapshot état initial

Capturer l'état banksAnn pré-investigation :
```js
const before = {
  banksAnn: JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.banksAnn,
  myGuitars: JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.myGuitars,
  language: JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.language,
  activeProfileId: JSON.parse(localStorage.tonex_guide_v2).activeProfileId,
};
console.log('AVANT INVESTIGATION', JSON.stringify(before, null, 2));
```

Copier le output console pour comparaison à la fin.

## Variantes de reproduction

Pour chaque variante, exécuter dans cet ordre, puis comparer l'état
final à l'état initial via le snippet de l'étape 0d. Si pollution
détectée → variante = cause confirmée. Sinon → variante innocente.

### Variante A — `enterDemoMode` enter/exit (test H3)

Hypothèse testée : sortie du mode démo persiste des résidus.

1. Entrer en mode démo :
   - Soit click "Mode démo" sur ProfilePicker
   - Soit `enterDemoMode()` via console (si exposée — sinon recharger
     avec `?demo=1`)
2. Exécuter 5-10 actions in-démo :
   - Click 2-3 chips morceaux sur HomeScreen
   - Ouvrir 2-3 fiches morceau via search
   - Switcher locale FR → EN → ES → FR via Mon Profil → 🎨 Affichage
   - Tap "🎲 Au hasard" sur HomeScreen (Phase 7.55.3)
3. Sortir du mode démo via DemoBanner "✕ Quitter"
4. Vérifier état :
```js
const after = JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.banksAnn;
console.log('APRÈS VARIANTE A', JSON.stringify(after));
```
5. Comparer `after` vs `before.banksAnn` :
   - Identique → variante A innocente
   - Différent → variante A coupable, capturer logs : `window.__getMergeDebugLogs()`

### Variante B — Admin-switch profil + modifs (test H2)

Hypothèse testée : admin-switch stamp parasite sur profil source.

1. Header avatar → dropdown → switch sur un autre profil admin (Arthur
   ou Franck, profils internes existants). Si le ProfileSelector demande
   password, fournir le password connu.
2. Banner copper `AdminAsBanner` apparaît → "🔍 Connecté en tant que…"
3. Mon Profil → Mes appareils → tab Anniversary (ou Pedal selon
   enabledDevices) → modifier 1-2 slots via BankEditor :
   - Click sur un slot avec preset existant
   - Click "Modifier" → choisir un autre preset → Save
   - Refaire sur un autre slot
4. Click "← Retour admin" sur AdminAsBanner pour revenir sur Sébastien
5. Vérifier état Sébastien :
```js
const after = JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.banksAnn;
console.log('APRÈS VARIANTE B', JSON.stringify(after));
```
6. Vérifier aussi que les modifs sont bien sur le profil cible :
```js
const targetBanks = JSON.parse(localStorage.tonex_guide_v2).profiles.arthur.banksAnn;
console.log('Banks cible (devrait avoir les modifs)', JSON.stringify(targetBanks));
```
7. Comparer :
   - Sébastien banks intactes + target banks modifiées → variante B innocente
   - Sébastien banks polluées → variante B coupable ⚠

### Variante C — Combo démo + admin-switch (test H4)

Hypothèse testée : combo séquence (la plus probable selon observation
2026-05-20).

1. Entrer en mode démo (Variante A étape 1)
2. Sortir du mode démo (Variante A étape 3)
3. Header avatar → switch sur `demo_1778839429588` (curateur démo)
4. Mon Profil → Mes appareils → modifier 1-2 slots Anniversary du
   curateur
5. Retour admin Sébastien
6. Vérifier état Sébastien :
```js
const after = JSON.parse(localStorage.tonex_guide_v2).profiles.sebastien.banksAnn;
console.log('APRÈS VARIANTE C', JSON.stringify(after));
```

### Variante D — Stress test (optionnel)

Si A/B/C ne reproduisent pas, tester une session intensive :

1. Mode démo enter
2. 10 actions in-démo random
3. Mode démo exit
4. Switch sur profil 1
5. 3 modifs banks
6. Retour admin
7. Switch sur profil 2
8. 3 modifs guitares
9. Retour admin
10. Mode démo enter à nouveau
11. Sortie
12. Vérifier Sébastien

Le but : reproduire la complexité réelle de la session du 2026-05-20.

## Analyse des logs forensique

Si une variante reproduit le bug, lancer :

```js
const logs = window.__getMergeDebugLogs();
console.log(JSON.stringify(logs, null, 2));
```

Chercher des patterns :
- `[merge-defense] sebastien SUSPECT myGuitars drop` → Couche 3 Phase
  7.74 a détecté un drop suspect (mais c'est sur myGuitars, pas banks)
- `[merge*] adopting remote profile` → adoption en bloc d'un profil
- `[merge*] activeProfileId change` → switch profil
- Timestamps `lastModified` incohérents

Reporter les logs entiers dans ce doc avec timestamp + variante
reproduite, en bas de fichier (section "Résultats d'investigation").

## Cleanup post-session

```js
// Restaurer l'état initial via snapshot manuel
// Mon Profil → 🔧 Maintenance → Snapshots manuels →
// "investigation-start-2026-MM-DD" → Restaurer

// Désactiver mode no-sync
localStorage.removeItem('backline_no_sync');

// Désactiver logs forensique
localStorage.removeItem('__backline_persist_logs');
delete window.__BACKLINE_MERGE_DEBUG;
location.reload();
```

## Résultats d'investigation

> Section à compléter au fur et à mesure des sessions.

### Session 1 — Date TBD

- Variante reproduisant le bug : TBD
- Logs forensique capturés : TBD
- Hypothèse confirmée : TBD
- Phase 7.74.7 fix proposé : TBD

## Liens

- Phase 7.74.4 (origine défense Couche 4 myGuitars) : `CLAUDE.md` section "État précédent (2026-05-19 nuit)"
- Phase 7.74.5 (wrapper logs persistants) : `src/app/utils/merge-debug-logger.js`
- `mergeProfileLWW` + `stampedProfileUpdate` (cœur du merge) : `src/core/state.js`
- Phase 7.63 admin-switch + AdminAsBanner : `src/app/components/AdminAsBanner.jsx`
- Phase 7.52.14 enterDemoMode force override : `src/main.jsx` `enterDemoMode`
