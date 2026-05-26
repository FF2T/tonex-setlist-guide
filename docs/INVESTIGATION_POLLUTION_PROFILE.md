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

8 occurrences documentées :

| # | Date | Profil affecté | Champ corrompu | Symptôme | Phase fix tentative |
|---|---|---|---|---|---|
| 1 | 2026-05-18 | Sébastien | `myGuitars` | Perte Tele 51 + ajout Sire T3/T7 (autres profils) | 7.74.1 filter orphan |
| 2 | 2026-05-18 | Sébastien | `myGuitars` | Idem | 7.74.2 auto-repair (régression, désactivé) |
| 3 | 2026-05-19 | Sébastien | `myGuitars` | Swap 1↔1 cg_* avec Francisco | 7.74.4 Couche 4 swap suspect |
| 4 | 2026-05-19 | Sébastien | `myGuitars` | Idem (résidu pollution iPhone) | 7.74.4 idem |
| 5 | 2026-05-20 | Sébastien | `banksAnn` | Slot 23C vidé + 18C Supergroupbass remplacé | — (cause trouvée #6) |
| 6 | **2026-05-21** | **Sébastien** | **`banksAnn` + `banksPlug` + `language`** | 79/150 slots Ann + 7/30 Plug révertés vers une version périmée, langue FR→EN, propagé Mac+iPhone | **✅ CAUSE RACINE TROUVÉE → Phase 7.74.7** |
| 7 | **2026-05-21** | **Sébastien** | **`banksAnn` + `banksPlug`** | ~79 slots Ann + 7 slots Plug révertés, propagé Mac↔iPhone — MALGRÉ le fix 7.74.7 déployé (v8.14.157) | **✅ 2e CAUSE RACINE TROUVÉE → Phase 7.74.8** |
| 8 | **2026-05-21 soir** | **Sébastien** | **`banksAnn` + `banksPlug`** | 79/150 slots Ann révertés (23C vidé — signature occ #5), Mac ET iPhone corrompus — MALGRÉ 7.74.7 + 7.74.8 déployés (v8.14.162). Forensique : 3× `banksAnn mass-change` adoptés en bloc (15:52, 16:29, 20:25) | **✅ Phase 7.74.9 LIVRÉE (v8.14.164, STATE_VERSION 11) — timestamp dédié `banksModified` + hardening aiCache** |
| 9 | **2026-05-26** | **Sébastien** | **`language`** | Mac repassait régulièrement FR → EN. Banks intactes (Phase 7.74.9 tient). Forensique : pas de log dédié language (garde-fou délai 60s Phase 7.74.4 inopérant au-delà). | **✅ Phase 7.74.10 LIVRÉE (v8.14.226, STATE_VERSION 12) — timestamps dédiés `languageModified` / `enabledDevicesModified` / `availableSourcesModified` (pattern Phase 7.74.9 étendu)** |

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
// ⚠ isNoSyncMode() teste === '1' — la valeur DOIT être '1', pas 'true'.
localStorage.setItem('backline_no_sync', '1');
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

### Session 1 — 2026-05-21 (occurrence #6, capture live)

**Cause racine identifiée — aucune variante n'a eu besoin d'être jouée.**
La capture forensique de l'occurrence #6 a suffi.

**Constats de la capture** (`localStorage` Mac, profil Sébastien) :
- `banksAnn` : 79 slots / 150 divergents vs le CSV de référence —
  réversion en bloc vers une **version périmée** des banques de
  Sébastien (banks 0-17 d'un ancien layout). `banksPlug` : 7/30.
- `language` FR → EN. `sebastien.lastModified` = le **plus récent**
  des 7 profils → un pull Firestore ne pouvait PAS l'avoir corrompu
  (son local gagne le LWW). Donc : écriture/adoption locale.
- Les 14 `mergeLogs` du wrapper Phase 7.74.5 dataient tous du 19-20
  mai (saga `sire_t3/t7`). **Aucun log le jour de l'occurrence #6** :
  `banksAnn`/`banksPlug` n'ont aucune défense ni log dans
  `mergeProfileLWW` (adopt-en-bloc) → corruption invisible.
- Pendant la récupération : Mac corrigé à 11:30, re-corrompu à 11:50.
  Mac et iPhone re-stampés à 11:50:20 et 11:50:28 sur du contenu
  corrompu.

**Cause racine confirmée** : `recordLogin` (main.jsx) re-stampait
`lastModified = Date.now()` à **chaque boot/login**. Un login ne change
aucune donnée, mais le stamp rendait le profil « le plus récent » au
LWW. Tout appareil rechargé avec un contenu périmé devenait gagnant et
propageait son état stale. Les refreshs successifs de l'iPhone
(corrompu) l'ont re-stampé → il a écrasé la récupération du Mac. C'est
l'amplificateur commun aux 6 occurrences.

**Hypothèse confirmée** : ni H1/H2/H3/H4 stricto sensu — la cause est
un re-stamp gratuit à chaque login, indépendant du mode démo et de
l'admin-switch. (H1 « race condition LWW + stamp » est la plus proche.)

**Fix livré — Phase 7.74.7** (v8.14.157) :
1. `recordLogin` → `appendLoginEntry` : met à jour `loginHistory` sans
   toucher `lastModified`.
2. Log forensique `[merge-defense] SUSPECT banksAnn/Plug mass-change`
   dans `mergeProfileLWW` (≥10 slots adoptés en bloc) — log seul.
3. Tests Vitest + `docs/SYNC.md` section « Phase 7.74.7 ».

### Session 2 — 2026-05-21 (occurrence #7, capture live Chrome MCP)

**2e cause racine identifiée — le fix 7.74.7 était incomplet.**

Occurrence #7 survenue le 2026-05-21 (banques Anniversary + Plug
révertées) **alors que v8.14.157 — le fix 7.74.7 — était bien déployée
et active** sur les appareils. La conclusion de Session 1 (« recordLogin
= cause racine ») était donc partielle.

**Test décisif** (capture live via Chrome MCP, sans jouer les variantes
A/B/C/D) : un simple rechargement de `mybackline.app` re-stampe
`profile.sebastien.lastModified` à l'heure du boot — vérifié
`17:21:01` → reload → `17:30:24`. Reproductible à 100 %.

**Constats** :
- `appVersion` = 8.14.157 confirmée → le fix `recordLogin` tourne bien,
  `loginHistory` n'est plus touché au reload (dernier login 15:38,
  inchangé sur les reloads suivants).
- Pourtant `seb.lastModified` = heure du boot à chaque reload.
- Aucun log `[merge-defense]` au boot incriminé : le Mac gagne le LWW
  (son `lastModified` est le plus récent des 7 profils) → il n'adopte
  jamais, il **impose** ses banques corrompues à Firestore + iPhone.

**2e cause racine** : `loadState()` appelle `_runFullChain()` même sur
un state déjà-v10. `_runFullChain` exécute `migrateV9toV10()`, qui
re-stampe `profiles[activeId].lastModified = Date.now()`
**inconditionnellement** (bloc copie aiCache→profil actif), qu'une
migration réelle ait lieu ou non. Amplificateur plus systématique que
`recordLogin` : 100 % des boots vs seulement les logins.

**Fix livré — Phase 7.74.8** (v8.14.158) :
1. `migrateV9toV10` : flag `cacheMigrated` → `lastModified` re-stampé
   uniquement si une entrée aiCache est réellement déplacée
   shared→profile. State déjà-v10 stable → `lastModified` préservé.
2. 4 tests Vitest dédiés (`state.test.js`) + `docs/SYNC.md` section
   « Phase 7.74.8 ».
3. Banques de Sébastien restaurées depuis `ToneX_Anniversary_ref.csv` +
   `ToneX_Plug_ref.csv` (capture Chrome MCP, push Firestore confirmé).

**Dette résiduelle** : `setSongAiCache` (main.jsx) stampe encore
`profile.lastModified` sur une écriture aiCache réelle (fetchAI,
feedback, rescore). Amplificateur mineur (ne tourne pas à chaque boot).
Fix de fond possible : merger l'aiCache per-songId même dans la branche
`rts <= lts` de `mergeProfileLWW` (l'aiCache s'auto-arbitre déjà par son
`ts` per-entry, Phase 7.81) puis retirer ce stamp. Reporté.

### Session 3 — 2026-05-21 soir (occurrence #8, capture live Chrome MCP)

**Le canal de propagation lui-même est la cause — pas un amplificateur.**

Occurrence #8 : `banksAnn` Sébastien réverté vers une version périmée
(slot 23C vidé — signature occ #5), **Mac ET iPhone corrompus**, alors
que v8.14.162 (7.74.7 + 7.74.8) était bien déployée. L'iPhone était
corrompu sans avoir été ouvert dans la session : la version périmée
dormait dans son localStorage / sur Firestore depuis une session
antérieure.

**Capture forensique décisive** (`window.__getMergeDebugLogs()`, Mac) :
3 logs `[merge-defense] sebastien SUSPECT banksAnn mass-change :
adoption remote remplace 79 slots (log seul, pas de blocage)` aux
15:52, 16:29 et 20:25. Le log Phase 7.74.7 **détecte** mais ne **bloque
pas** — décision explicite à l'époque (« une réorg de banques est
légitime, bloquer ferait des faux positifs »).

**Cause racine** : `mergeProfileLWW` (`state.js:830`) adopte `banksAnn`
/ `banksPlug` **en bloc** (`merged = { ...remote }`) dès que
`remote.lastModified > local.lastModified`. `myGuitars` a 3 couches de
défense qui *gardent le local* sur changement suspect ; `banksAnn` /
`banksPlug` n'en ont aucune — seulement un log. Un appareil dont le
`lastModified` **global** devient le plus récent — pour n'importe
quelle raison : édition de sources, écriture aiCache via
`setSongAiCache` toujours stampante (`main.jsx:626`), etc. — impose
**toute** sa version des banks, même périmée. 79/150 slots remplacés
d'un coup n'est jamais une réorg utilisateur, c'est une pollution que
la défense regarde passer.

Les fixes 7.74.7 (`recordLogin`) et 7.74.8 (`migrateV9toV10`) ont fermé
deux *amplificateurs* de re-stamp, mais le **canal de propagation**
(adoption en bloc des banks) est resté ouvert. `lastModified` est un
timestamp **global au profil** : toute écriture sur n'importe quel
champ fait « gagner » le LWW à tous les champs, banks comprises.

**Fix retenu — Phase 7.74.9 ✅ LIVRÉE 2026-05-21 nuit (v8.14.164,
STATE_VERSION 11)** : timestamp dédié aux banks. Nouveau champ
`profile.banksModified`, stampé UNIQUEMENT lors d'une édition réelle
de `banksAnn`/`banksPlug` via `setProfileField` (`main.jsx`).
`mergeProfileLWW` n'adopte les banks remote que si
`remote.banksModified > local.banksModified` — sinon keep local. Une
vraie réorg propage normalement ; un appareil qui n'a fait qu'ouvrir
des morceaux ou éditer ses sources n'écrase plus jamais les banks. Le
log forensique du diff de slots est conservé mais reformulé
(`ADOPTED` vs `BLOCKED` selon la décision réelle).

Migration `migrateV10toV11` backfill `banksModified=0` pour tous les
profils existants (volontairement 0, pas `lastModified` — état neutre
qui ne fait gagner aucun appareil tant que personne n'a fait d'édition
réelle post-migration).

**Hardening secondaire livré** : `setSongAiCache` ne stamp plus
`lastModified` (une écriture aiCache n'est pas une modification du
profil au sens LWW per-field — l'aiCache s'auto-arbitre déjà via
`ts` per-entry, Phase 7.81). Conséquence : `mergeProfileLWW` merge
l'aiCache même dans la branche `rts <= lts` via le helper extrait
`mergeAiCachePerSongId(local, remote)` qui retourne
`{ merged, changed }`. Sans ça, une nouvelle analyse ne descendrait
plus jamais sur l'autre device puisque `setSongAiCache` ne fait plus
avancer `lastModified`.

Cf `docs/SYNC.md` section « Phase 7.74.9 » pour le détail technique
+ invariants associés. Tests Vitest dédiés dans
`src/core/state.test.js` : scénario bug #8 reproduit (remote.lastModified
récent + banksModified égal → banks local préservées) + scénario
récupération + 9 autres cas.

**Récupération** : Mac + iPhone tous deux corrompus → aucune copie
saine en mémoire. Restauration depuis snapshot manuel (Phase 7.59) ou
`ToneX_Anniversary_ref.csv` / `ToneX_Plug_ref.csv`.

### Session 4 — 2026-05-26 (occurrence #9, capture live Mac)

**Pattern Phase 7.74.9 étendu — `language` était la prochaine
victime.**

Occurrence #9 : Sébastien constate que sa langue Mac repasse
régulièrement FR → EN, alors que Mac est nominalement en FR.

**Capture forensique** (`localStorage` Mac, profil Sébastien,
2026-05-26 20:30) :
- `language: fr`, `banksModified: 23/05/2026 12:14:55`, banks 150/150
  intactes → **Phase 7.74.9 tient** côté banks.
- 50 merge logs en cache, 3 récents (16:29:21) montrent :
  - `banksAnn mass-change BLOCKED : remote.banksModified=0 <=
    local.banksModified=1779531295620, 79 slots préservés en local`
    → un device dormant continue à pousser un état pré-v11.
  - `orphan-cross-profile` détecté + filtré (sg61, sire_t7).
  - `swap pattern cg_*→standard` détecté.
- Mais aucun log dédié pour `language`. Le garde-fou Phase 7.74.4
  (`delta < 60s` → keep local) est inopérant au-delà — un device
  dormant qui a `language: en` + `lastModified` plus récent que 60s
  passe au-dessus.

**Cause racine confirmée** : `language` n'avait pas de timestamp
dédié (contrairement à `banksModified` Phase 7.74.9). Le merge LWW
adoptait `language` remote dès que `remote.lastModified >
local.lastModified` (au-delà du délai 60s), même quand le device
remote n'avait jamais changé sa langue mais avait juste fait une
écriture innocente qui re-stampait son `lastModified`.

**Fix livré — Phase 7.74.10** (v8.14.226, STATE_VERSION 12) :
1. 3 nouveaux timestamps dédiés : `languageModified`,
   `enabledDevicesModified`, `availableSourcesModified` (champs LWW
   sensibles qui peuvent être manipulés involontairement par cycle
   de sync entre devices dormants).
2. `mergeProfileLWW` étendu : adopte chacun de ces champs UNIQUEMENT
   si `remote.{field}Modified > local.{field}Modified`. Sinon keep
   local. Log forensique ADOPTED/BLOCKED.
3. `setProfileField` (main.jsx) + `stampedProfileUpdate` (state.js)
   + `_profileLanguageUpdater` (i18n) + `ProfileTab.updateProfile`
   stampent automatiquement le timestamp dédié selon le field écrit.
4. Garde-fou Phase 7.74.4 `delta < 60s` pour `language` retiré
   (devenu redondant avec le timestamp dédié, et trop court de toute
   façon).
5. Migration `migrateV11toV12` backfill les 3 timestamps à 0 pour
   tous profils existants (état neutre, aucun appareil ne gagne
   tant qu'aucun n'a fait d'édition réelle post-migration).
6. 7 nouveaux tests Vitest dédiés + 2 tests legacy retirés.

**Pattern complet désormais** : `banksAnn`/`banksPlug` (Phase
7.74.9) + `language`/`enabledDevices`/`availableSources` (Phase
7.74.10) sont tous protégés par leur propre timestamp dédié. Seul
une édition réelle propage la modification entre devices. Un device
dormant qui re-stampe son `lastModified` pour une raison innocente
ne peut plus écraser ces 5 champs.

## Liens

- Phase 7.74.4 (origine défense Couche 4 myGuitars) : `CLAUDE.md` section "État précédent (2026-05-19 nuit)"
- Phase 7.74.5 (wrapper logs persistants) : `src/app/utils/merge-debug-logger.js`
- `mergeProfileLWW` + `stampedProfileUpdate` (cœur du merge) : `src/core/state.js`
- Phase 7.63 admin-switch + AdminAsBanner : `src/app/components/AdminAsBanner.jsx`
- Phase 7.52.14 enterDemoMode force override : `src/main.jsx` `enterDemoMode`
