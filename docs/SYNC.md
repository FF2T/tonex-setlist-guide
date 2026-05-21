# Backline — Sync Firestore : invariants et pièges

> Document de référence Phase 7.52.x (2026-05-16) après 3 régressions
> consécutives sur la sync bilatérale Mac ↔ iPhone.
>
> **À lire OBLIGATOIREMENT avant de toucher au `useEffect` persist de
> main.jsx, à `enterDemoMode`, à `saveToFirestore`, ou à `applyRemoteData`.**

## Vue d'ensemble

Backline synchronise son état entre devices via un seul document
Firestore (`sync/state`). Pas de SDK Firebase côté client — appels
REST via `authedFetch` (Phase 7.30 Anonymous Auth).

Flux :

```
┌────────────────┐
│ User action    │
│ (toggle guit,  │
│ add song, etc) │
└───────┬────────┘
        ▼
┌────────────────────────────────────────────────────────┐
│ setProfiles / setSetlists / setSongDb / setBanksAnn... │
│ → React state muté → re-render                         │
└───────┬────────────────────────────────────────────────┘
        ▼
┌────────────────────────────────────────────────────────┐
│ useEffect persist (main.jsx ~ligne 787)                │
│ ─ Calcule syncHash (Phase 7.46 : profile + setlists +  │
│   songDb + customGuitars + ...)                        │
│ ─ Si shouldBump = syncHash !== lastSyncHashRef         │
│   → écrit localStorage via persistState()              │
│   → setSyncStatus("syncing") + setTimeout(2000ms)      │
│   → saveToFirestore au timeout                         │
│   → .then() : setSyncStatus("synced") + UPDATE         │
│     lastSyncHashRef = pushedHash                       │
└────────────────────────────────────────────────────────┘
                       ▲
                       │ Poll 5s
                       │
┌──────────────────────┴─────────────────────────────────┐
│ useEffect poll Firestore (main.jsx ~ligne 1027)        │
│ ─ pollRemoteSyncId() → si nouveau remoteSid            │
│ ─ loadFromFirestore() → applyRemoteData(data)          │
│ ─ applyRemoteData :                                    │
│   - justPulledRef.current = true                        │
│   - lastPulledHashRef.current = null (Phase 7.52.11)   │
│   - setTimeout 3s → reset justPulled + lastPulled = null│
│   - mergeSongDb / mergeSetlistsLWW / mergeProfilesLWW  │
│   - setState multiples → trigger useEffect persist     │
└────────────────────────────────────────────────────────┘
```

## Les 3 refs critiques

### 1. `lastSyncHashRef` — hash du dernier état PUSHÉ avec succès

**Initialisé** : `useRef("")` au mount.

**Updaté** : **UNIQUEMENT** dans `.then()` de `saveToFirestore` après
le push successful. Phase 7.52.12 fix.

**Pourquoi pas avant ?** Si on update dès `shouldBump = true` (avant
le push effectif), le `useEffect` peut re-run dans la fenêtre 2s
debounce et calculer `shouldBump = false` → cleanup `clearTimeout`
→ push jamais fait. Bug pré-Phase 7.52.12.

**Code (main.jsx ligne ~870)** :
```js
const pushedHash = syncHash; // capture closure
firestoreDebounceRef.current = setTimeout(() => {
  saveToFirestore(state).then(() => {
    setSyncStatus("synced");
    lastSyncHashRef.current = pushedHash; // ← APRÈS push success
  }).catch(() => setSyncStatus("error"));
}, 2000);
```

### 2. `justPulledRef` — flag "viens de pull, soft-block push pendant 3s"

**Initialisé** : `useRef(false)`.

**Set à `true`** : dans `applyRemoteData` à chaque pull Firestore
(load initial + poll 5s).

**Reset à `false`** : `setTimeout(3000)` dans `applyRemoteData`.

**Effet sur `useEffect` persist** : si `justPulledRef.current === true`
ET hash inchangé depuis le pull → skip push (sinon écho infini pull
→ push → pull → ...).

**Pourquoi ce flag ?** Phase 6.1.3 fix. Sans ce flag, après chaque pull
adoptant des données remote, notre état local change → `shouldBump =
true` → on push notre version (qui inclut l'adoption) → Firestore
reçoit ce push → autre device pull → boucle.

### 3. `lastPulledHashRef` — hash juste après adoption pull

**Initialisé** : `useRef(null)`.

**Set à `null`** : dans `applyRemoteData` (chaque nouveau pull).
**Set au hash actuel** : au PREMIER `useEffect` persist run après
le pull (quand `justPulledRef.current === true` et `lastPulledHashRef
.current === null`).

**Effet** : permet de distinguer "le useEffect se déclenche à cause
de l'adoption pull" (skip) vs "user a vraiment modifié après le
pull" (push autorisé malgré `justPulledRef = true`).

**Pourquoi ?** Phase 7.52.11 fix. Sans `lastPulledHashRef`, le flag
`justPulledRef` bloque TOUS les push pendant 3s, même les vraies
modifs user. Comme poll = 5s, 60% du temps en mode bloquant → si
user toggle pendant cette fenêtre, modif perdue (push jamais fait,
pas de retry).

**Code (main.jsx ligne ~852)** :
```js
if (justPulledRef.current) {
  if (lastPulledHashRef.current === null) {
    lastPulledHashRef.current = syncHash; // 1er run post-pull
    setSyncStatus("synced");
    return;
  }
  if (syncHash === lastPulledHashRef.current) {
    setSyncStatus("synced");
    return; // pas de modif user depuis pull
  }
  // sinon : user a modifié → fall-through pour push
}
```

## Les invariants du `useEffect` persist

### ❌ NE PAS faire (régressions observées)

1. **NE PAS update `lastSyncHashRef.current` avant le push successful.**
   Régression : push debounce annulé par re-render dans la fenêtre 2s.

2. **NE PAS mettre `return () => clearTimeout(firestoreDebounceRef.
   current);` dans la cleanup function du useEffect.** Régression :
   chaque re-render React annule le setTimeout 2s → push jamais fait.

3. **NE PAS bloquer tous les push quand `justPulledRef = true`.**
   Régression : modifs user perdues si faites dans fenêtre 3s.

4. **NE PAS stamp `lastModified = Date.now()` dans `stripDemoFromSet
   lists` au boot.** Régression : Mac stampe au boot, push, iPhone
   stampe au boot, push, loop LWW infinie.

### ✅ FAIRE

1. **Update `lastSyncHashRef` dans `.then()` du push** (capturer le
   `pushedHash` en closure).

2. **`clearTimeout(firestoreDebounceRef.current)` en début de branche
   `shouldBump = true`** seulement. Pas dans la cleanup.

3. **Permettre push si modif user post-pull** : check `lastPulledHash
   Ref` vs hash actuel.

4. **Strip silencieux au boot, stamp au push** : helper avec option
   `{stamp: true|false}`.

## Le hash `syncHash` — Phase 7.46

Le hash inclut **TOUS les champs LWW** qu'un user peut éditer pour que
toute modif déclenche `shouldBump = true` :

```js
const profileHash = Object.entries(profiles || {}).map(([id, p]) =>
  id
  + ":" + (p.myGuitars || []).slice().sort().join(',')
  + ":" + (p.customGuitars || []).map(g => g.id).slice().sort().join(',')
  + ":" + JSON.stringify(p.availableSources || {})
  + ":" + (p.enabledDevices || []).slice().sort().join(',')
  + ":" + (p.aiProvider || '')
  + ":" + JSON.stringify(p.banksAnn || {})
  + ":" + JSON.stringify(p.banksPlug || {})
  + ":" + (p.customPacks || []).map(...).join('|')
  + ":" + JSON.stringify(p.editedGuitars || {})
  + ":" + JSON.stringify(p.tmpPatches || {})
  + ":" + (p.recoMode || '')
  + ":" + JSON.stringify(p.guitarBias || {})
  + ":" + (p.language || '')
).join('|');

const syncHash = [
  songDb.map(s => s.id + ":" + (s.aiCache?.sv || 0) + ":" + ...).join(','),
  setlists.map(s => s.id + ":" + ...).join('|'),
  customGuitars.map(g => g.id).slice().sort().join(','),
  Object.keys(deletedSetlistIds || {}).slice().sort().join(','),
  profileHash,
  activeProfileId,
  theme,
].join('#');
```

**Pourquoi pas inclure `lastModified` ?** Parce que ces timestamps
mutent à chaque mergeLWW (pull adopte un profil avec lastModified
plus récent). Inclure ferait `shouldBump = true` à chaque pull, ce
qui n'est pas une "vraie modif user" → boucle.

**Champs exclus du hash** :
- `password`, `aiKeys` (stripés au push de toute façon)
- `loginHistory` (mute à chaque login, ne mérite pas un push)
- `lastModified` (cf ci-dessus)

## Le mode démo et la sync

Le mode démo (`profile.isDemo === true`) DOIT bloquer :

- `persistState(state)` (useEffect persist line ~849) :
  `if (isDemo) return;`
- `autoBackup()` : skippé via la même garde
- `saveToFirestore` : `setFirestoreDemoMode(true)` set
  `_isDemoMode = true` dans firestore.js → all calls early-return
- `loadFromFirestore`, `pollRemoteSyncId` : idem

**Pourquoi** ? Le profil démo est in-memory only (snapshot bundlé
src/data/demo-profile.json). Si on persistait, le visiteur démo
laisserait des traces localStorage qui pollueraient le profil normal
de l'utilisateur trusted sur l'appareil.

## Le merge LWW (Last-Write-Wins) — Phase 5.7

Lors d'un pull, `mergeSetlistsLWW(local, remote, tombstones)` compare
par `lastModified` per-record. Le plus récent gagne.

**Implication** : si on stamp un setlist avec `lastModified = Date.
now()` sans push immédiat, ça créé un déséquilibre — le state mémoire
est "frais" mais Firestore l'ignore (n'a pas reçu le push).

**Cas Phase 7.52.9 raté** : `stripDemoFromSetlists` stampait
`lastModified` au boot → Mac stamps "now", iPhone stamps "now+epsilon"
→ chaque boot écrase l'autre. Loop infinie.

**Fix Phase 7.52.10** : option `{stamp: false}` au boot.

## Le `enterDemoMode` (Phase 7.51.3) — Phase 7.52.14 override

**Avant Phase 7.52.14** : `enterDemoMode` mergeait avec
`!existingIds.has(s.id)` (skip si id déjà présent). Risque : si une
vieille version polluée d'une setlist du snapshot existait localement,
le snapshot frais ne s'appliquait pas.

**Après Phase 7.52.14** : **force override par id**. Les setlists/songs
du snapshot écrasent systématiquement toute version locale même id.

```js
setSetlistsRaw(prev => {
  const snapIds = new Set((snap.setlists || []).map(s => s.id));
  const kept = (prev || []).filter(s => !snapIds.has(s.id));
  return [...kept, ...(snap.setlists || [])];
});
```

## Le `applyRemoteData.setActiveProfileId` — à surveiller

`applyRemoteData` (main.jsx ligne 976) fait :
```js
if (data.activeProfileId) setActiveProfileId(data.activeProfileId);
```

**Risque** : si un device push un état avec `activeProfileId = 'X'`
et un autre device pull, son `activeProfileId` local est remplacé
par 'X'. Cela peut causer des switch de profil inattendus.

**Atténuation** : en mode démo, le pull est skippé via `isDemoOrNoSync()`
dans `loadFromFirestore`. Donc OK pour le mode démo.

**Mais** : pour Sébastien sur 2 devices différents, si Mac a poussé
`activeProfileId = 'sebastien'` et iPhone le pull, OK car les 2 sont
sur Sébastien. Pas de problème pratique.

**Si jamais** un device push avec `activeProfileId` invalide (ex.
profil supprimé), le pull adopte cet id → `profile = profiles[id] ||
Object.values(profiles)[0]` (main.jsx ligne 477) fallback sur 1er
profil. Soft-fail OK.

## Workflow recommandé pour modif sync

Quand on touche au code sync (useEffect persist, applyRemoteData,
saveToFirestore, etc.) :

1. **Lire ce doc** avant de modifier
2. **Tester manuellement sur 2 devices** (Mac + iPhone via DevTools)
3. **Vérifier** :
   - Toggle Mac → ☁️ → ⏳ (2s) → ☁️
   - Reload iPhone → modif apparaît après ~5-10s
   - Modif iPhone → reload Mac → modif apparaît
4. **Surveiller les logs** :
   - `[firestore] Push WITH aiCache COMPRESSED` (Phase 6.1)
   - `[firestore] Pull WITH aiCache` au poll
   - `[rescore] Batch rescore N morceaux` (rescore local quand
     SCORING_VERSION change)
   - Pas de loop infinie (logs cycliques toutes les 2-5s)

## Référence rapide — fichiers concernés

| Sujet | Fichier |
|-------|---------|
| useEffect persist + sync push | `src/main.jsx` ligne ~787-900 |
| applyRemoteData (pull merge) | `src/main.jsx` ligne ~923-977 |
| Poll Firestore 5s | `src/main.jsx` ligne ~1027-1045 |
| enterDemoMode | `src/main.jsx` ligne ~510-534 |
| stripDemoFromSetlists | `src/core/state.js` |
| mergeSetlistsLWW | `src/core/state.js` |
| mergeProfilesLWW | `src/core/state.js` |
| mergeSongDbPreservingLocalAiCache | `src/core/state.js` |
| saveToFirestore | `src/app/utils/firestore.js` |
| loadFromFirestore | `src/app/utils/firestore.js` |
| Anonymous Auth tokens | `src/app/utils/firebase-auth.js` |

## Historique des régressions de sync (à ne pas reproduire)

| Phase | Bug | Cause | Fix |
|-------|-----|-------|-----|
| 6.1.1 | Boucle infinie pull→push→pull | `shared.lastModified` dans hash | Hash sans timestamps |
| 6.1.3 | Boucle plus subtile (adoption pull → push) | shouldBump=true post-adoption | `justPulledRef` 3s |
| 7.46 | Banks/customPacks pas syncés | Hash incomplet | Étendre hash à tous champs LWW |
| 7.52.2 | Modifs iPhone perdues | Quota localStorage saturé | `persistState` retry-on-quota + MAX_BACKUPS=1 |
| 7.52.9 | Demo Setlist polluée Firestore | stripDemoFromSetlists missing | Helper appliqué au boot + push |
| 7.52.10 | Loop LWW Mac↔iPhone | Stamp lastModified au boot | Option `{stamp: false}` |
| 7.52.11 | Toggle perdus pendant 3s post-pull | `justPulledRef` bloque tout | `lastPulledHashRef` distingue user vs pull |
| 7.52.12 | Push annulé par cleanup useEffect | clearTimeout dans cleanup + lastSyncHashRef updated avant push | Update dans `.then()` + retire cleanup |
| 7.52.14 | Demo Setlist polluée locale écrasait snapshot | Merge avec `!existingIds.has` | Force override par id |
| 7.74 | Pollution profile cross-mélange (myGuitars drop, banks corrompues, setlists dupliquées) | 4 causes : (1) stamp `lastModified` manquant sur 4 call sites (MesAppareilsTab toggle device, ProfilesAdmin password+rename, ProfileTab delete custom guitar) ; (2) `mergeProfilesLWW` adoptait remote en bloc sans per-field LWW ; (3) aucun garde-fou contre les drops massifs ; (4) `mergeSetlistsLWW` ne dédupliquait pas par name+profileIds divergents | (1) helper `stampedProfileUpdate` + fix 4 sites ; (2) `mergeProfileLWW` per-field ; (3) defense : block adoption si drop ≥3 guitares ou language conflict <5s ; (4) `dedupSetlists({mergeAcrossProfiles:true})` automatique au merge |

| 7.74.7 | Pollution profile récurrente (6 occurrences) — `banksAnn`/`banksPlug` révertés vers une version périmée, propagés à tous les appareils | `recordLogin` re-stampait `lastModified=Date.now()` à CHAQUE boot/login. Un login ne change aucune donnée mais le stamp rendait le profil « le plus récent » → un appareil au contenu périmé, simplement rechargé, gagnait le LWW et propageait son état stale. `banksAnn`/`banksPlug` adoptés en bloc sans défense ni log → corruption invisible | `recordLogin` → `appendLoginEntry` (n'stampe plus `lastModified`) ; log forensique `[merge-defense] SUSPECT banksAnn/Plug mass-change` quand ≥10 slots adoptés en bloc |
| 7.74.8 | Pollution profile **occurrence #7** — banques Anniversary (~79 slots) + Plug (7 slots) révertées, propagées Mac↔iPhone, MALGRÉ le fix 7.74.7 déployé (v8.14.157) | `migrateV9toV10` — appelé par `_runFullChain` à CHAQUE chargement, même sur un state déjà-v10 — re-stampait `profile.lastModified=Date.now()` **inconditionnellement** sur le profil actif. `recordLogin` n'était qu'un amplificateur parmi deux ; celui-ci tourne à 100 % des boots | `migrateV9toV10` : flag `cacheMigrated`, ne stamper `lastModified` que si une migration aiCache shared→profile réelle a lieu |
| 7.74.9 | Pollution profile **occurrence #8** — `banksAnn` Sébastien réverté (79/150 slots, slot 23C vidé — signature occ #5), Mac ET iPhone corrompus, MALGRÉ 7.74.7 + 7.74.8 déployés (v8.14.162). Forensique : 3 logs `banksAnn mass-change : adoption remote remplace 79 slots` (log seul, pas de blocage) | `mergeProfileLWW` adoptait `banksAnn`/`banksPlug` **en bloc** via `merged={...remote}` dès que `remote.lastModified > local.lastModified`. Or `lastModified` est un timestamp **global au profil** : toute écriture (édition de sources, ouverture d'un morceau via `setSongAiCache` stampant, login, etc.) faisait gagner le LWW à TOUS les champs, banks comprises — y compris quand le device en question n'avait pas touché aux banks. La défense Phase 7.74.7 *détectait* mais ne *bloquait* pas | Timestamp dédié `profile.banksModified`, stampé UNIQUEMENT lors d'une édition réelle de `banksAnn`/`banksPlug` via `setProfileField`. `mergeProfileLWW` adopte les banks remote SEULEMENT si `remote.banksModified > local.banksModified` ; sinon keep local. Bonus hardening : `setSongAiCache` ne stamp plus `lastModified` (le merge aiCache per-songId auto-arbitre déjà via `ts` per-entry), et `mergeProfileLWW` merge l'aiCache même dans la branche `rts <= lts` |

Chaque ligne représente une régression réelle vécue en prod. La
prochaine session doit s'assurer qu'aucun fix ne ré-introduit un cas
ci-dessus.

## Phase 7.74.7 — `recordLogin` ne re-stampe plus `lastModified` (2026-05-21)

### La cause racine des 6 occurrences de pollution profile

`recordLogin` (main.jsx), appelé à chaque auto-login au boot, faisait :

```js
{ ...profile, loginHistory: h, lastModified: Date.now() }
```

`lastModified` et `loginHistory` sont tous deux **exclus du `syncHash`**
→ un login seul ne déclenche pas de push. MAIS le `lastModified` frais
ride sur le prochain push (déclenché par une autre modif) et, surtout,
fait gagner le LWW : `mergeProfileLWW` compare `lastModified`, donc un
profil au **contenu inchangé** mais fraîchement re-stampé est traité
comme « le plus récent ».

Conséquence : tout appareil rechargé avec un contenu périmé en
localStorage (vieille version des banques, etc.) devient « le plus
récent » et **propage le périmé** à tous les autres appareils. C'est
l'amplificateur commun aux 6 occurrences observées (mai 2026).

### Le fix

- **`recordLogin` → `appendLoginEntry(profiles, id)`** (helper pur
  `state.js`) : ajoute l'entrée dans `loginHistory` (cap 5) **sans
  toucher `lastModified`**. Un login n'est plus une « modif » au sens
  LWW. `loginHistory` se propage quand un vrai changement déclenche un
  push — comportement voulu (Phase 7.46 : un login ne mérite pas un
  push).
- **Log forensique banks** dans `mergeProfileLWW` : `banksAnn`/
  `banksPlug` restent adoptés en bloc (une réorg de banques est
  légitime, on ne bloque pas pour éviter les faux positifs), mais si
  l'adoption remplace ≥10 slots, on émet `[merge-defense] SUSPECT
  banksAnn/Plug mass-change` — capté par le wrapper persistant Phase
  7.74.5. Jusqu'ici ces champs étaient adoptés sans aucune trace.

### Invariant ajouté

Un helper qui met à jour un profil pour une raison qui **n'est pas une
modification de données utilisateur** (login, activité, marqueur UI)
ne DOIT PAS stamper `lastModified`. Le stamp est réservé aux vraies
mutations de contenu (banks, guitares, presets, langue…) — sinon le
LWW devient aveugle au contenu.

## Phase 7.74.8 — `migrateV9toV10` ne re-stampe plus `lastModified` à chaque boot (2026-05-21)

### Occurrence #7 — le fix 7.74.7 était incomplet

Phase 7.74.7 a corrigé `recordLogin`. Mais une **7e occurrence** est
survenue le 2026-05-21 (banques Anniversary + Plug de Sébastien
révertées), avec v8.14.157 confirmée active sur les appareils. Test
décisif en capture live : un simple rechargement re-stampe
`profile.sebastien.lastModified` à l'heure du boot — reproductible à
100 % des reloads.

### La cause racine restante

`loadState()` appelle `_runFullChain()` **même quand le state est déjà
en v10** (`state.js` : `if (d.version === STATE_VERSION) return
_runFullChain(d)` — les migrations sont idempotentes et servent aussi à
heal d'éventuels profils incomplets). `_runFullChain` exécute donc
`migrateV9toV10()` à chaque chargement. Et `migrateV9toV10`, dans le
bloc qui copie l'aiCache vers le profil actif, faisait :

```js
[activeId]: { ...profiles[activeId], aiCache: newProfileCache, lastModified: Date.now() }
```

→ le profil actif est re-stampé `Date.now()` à **chaque ouverture de
l'app**, qu'une migration ait réellement eu lieu ou non. C'était le 2e
amplificateur de la pollution — plus systématique que `recordLogin`
(100 % des boots, vs seulement les logins).

### Le fix

`migrateV9toV10` : un flag `cacheMigrated` passe à `true` uniquement
quand une entrée aiCache est réellement déplacée shared→profile. Le
stamp devient conditionnel :

```js
lastModified: cacheMigrated ? Date.now() : curProfile.lastModified
```

Sur un state déjà-v10 stable (cas de 100 % des reloads), `cacheMigrated`
est `false` → `lastModified` préservé → un reload ne fait plus « gagner »
l'appareil au LWW.

### Invariant renforcé

L'invariant 7.74.7 vaut **aussi pour les migrations**. `_runFullChain`
tourne à chaque chargement (y compris sur un state déjà à jour) pour
heal des profils incomplets — ces passes idempotentes ne DOIVENT JAMAIS
stamper `lastModified`. Seule une transformation de données réelle le
peut.

## Phase 7.74.9 — timestamp dédié aux banks + hardening aiCache (2026-05-21 nuit)

### Occurrence #8 — le canal de propagation lui-même est la cause

Phase 7.74.7 (`recordLogin`) et Phase 7.74.8 (`migrateV9toV10`) ont
fermé deux **amplificateurs** de re-stamp `lastModified`. Mais
**occurrence #8** est survenue le 2026-05-21 soir, MALGRÉ v8.14.162 en
place : `banksAnn` Sébastien réverté (79/150 slots, slot 23C vidé —
signature occ #5), Mac ET iPhone corrompus.

Capture forensique décisive (`window.__getMergeDebugLogs()`, Mac) :
3 logs `[merge-defense] sebastien SUSPECT banksAnn mass-change :
adoption remote remplace 79 slots (log seul, pas de blocage)` aux
15:52, 16:29 et 20:25. Le log Phase 7.74.7 **détectait** mais ne
**bloquait pas** — décision explicite à l'époque (« une réorg de
banques est légitime, bloquer ferait des faux positifs »).

### La cause racine restante

`mergeProfileLWW` (`state.js:830`) adoptait `banksAnn`/`banksPlug` **en
bloc** via `merged = { ...remote }` dès que `remote.lastModified >
local.lastModified`. Or `lastModified` est un timestamp **global au
profil** : n'importe quelle écriture — édition de sources, ouverture
d'un morceau via `setSongAiCache` stampant (`main.jsx:626`), login,
toggle device — fait gagner le LWW à **tous** les champs, banks
comprises. Un appareil qui n'a fait **aucune** édition de banks mais
a une écriture stampante sur autre chose impose **sa** version des
banks, même périmée. `myGuitars` a 3 couches de défense ; `banksAnn`/
`banksPlug` n'en ont aucune — seulement un log.

Les fixes 7.74.7 et 7.74.8 fermaient deux *amplificateurs* de
re-stamp ; le **canal de propagation** (adoption en bloc des banks
sur `lastModified` global) restait ouvert.

### Le fix — timestamp dédié `banksModified`

Nouveau champ optionnel `profile.banksModified: number`. **Stampé
UNIQUEMENT** lors d'une édition réelle de `banksAnn` ou `banksPlug`
via `setProfileField` (`main.jsx`) :

```js
if (field === 'banksAnn' || field === 'banksPlug') {
  next.banksModified = now;
}
```

`mergeProfileLWW` adopte les banks remote SEULEMENT si
`(remote.banksModified || 0) > (local.banksModified || 0)`. Sinon
keep local. Un appareil qui n'a fait qu'ouvrir des morceaux ou éditer
ses sources n'écrase plus jamais les banks d'un autre device.

Migration `migrateV10toV11` backfill `banksModified=0` (volontairement
0, pas `lastModified` — état neutre : tant que personne n'a fait
d'édition réelle post-migration, aucun appareil n'écrase l'autre ; la
première vraie édition propage correctement).

Le log forensique du diff de slots est **conservé** mais reformulé :
`mass-change ADOPTED` vs `mass-change BLOCKED` selon la décision réelle.

### Hardening secondaire — drop stamp lastModified de setSongAiCache

`setSongAiCache` ne stamp plus `lastModified`. Une écriture aiCache
(ouverture d'un morceau, rescore) n'est pas une « modification du
profil » au sens LWW per-field — elle se propage déjà via le merge
aiCache per-songId qui s'auto-arbitre via `ts` per-entry (Phase 7.81).

Conséquence indispensable : `mergeProfileLWW` merge l'aiCache même
dans la branche `rts <= lts` (qui retournait `local` tel quel). Le
helper extrait `mergeAiCachePerSongId(local, remote)` retourne
`{ merged, changed }` ; si `changed=true`, on retourne
`{ ...local, aiCache: merged }` au lieu de `local`. Sinon, identité.
Sans ce changement, une analyse faite sur un device ne descendrait
plus sur l'autre quand `lastModified` n'a pas avancé.

### Invariant renforcé

Les invariants 7.74.7 et 7.74.8 (« seule une transformation de
données réelle stamp `lastModified` ») étaient nécessaires mais pas
suffisants. **Nouvel invariant 7.74.9** : **un champ critique
sensible aux régressions massives doit avoir son propre
timestamp** — `lastModified` global est trop grossier pour servir de
critère LWW per-field. La défense « log seul » est inutile sur les
champs qui ne sont jamais modifiés à grande échelle légitimement
(les banks sont éditées slot par slot par l'UI, pas 79 slots d'un
coup) : sur ces champs, bloquer par un timestamp dédié est plus sûr
qu'observer passer la pollution.

## Phase 7.74 — invariants ajoutés (2026-05-19)

### Règle 1 : `lastModified` obligatoire sur tout write de profile

Tout call site qui mute un `profile.X` (myGuitars, customPacks, banks,
language, etc.) DOIT stamper `lastModified: Date.now()` sur le profil
modifié. Sinon le merge LWW perd l'update à la prochaine sync.

Helper standard : **`stampedProfileUpdate(profiles, profileId, partial)`**
dans `core/state.js`. Force le stamp même si l'appelant l'omet.

Exception : `loginHistory` est mis à jour via `recordLogin` (helper
dédié → `appendLoginEntry`). **Phase 7.74.7 — `recordLogin` ne stampe
PLUS `lastModified`** : un login ne change aucune donnée du profil, le
re-stamper rendait gratuitement le profil « le plus récent » au LWW
(cf section « Phase 7.74.7 » ci-dessous). `loginHistory` étant exclu du
`syncHash`, il se propage quand un autre champ déclenche un push — pas
tout seul, et c'est voulu.

### Règle 2 : `mergeProfileLWW` est per-field, pas en bloc

L'ancien `mergeProfilesLWW` (pluriel) faisait un adopt-en-bloc du
profil remote si `remote.lastModified > local.lastModified`. Refacto
Phase 7.74 : `mergeProfileLWW` (singulier) merge per-field avec garde-fous :

- `myGuitars` : adopt remote SAUF si drop ≥3 guitares (pollution
  cross-profil détectée) → keep local
- `language` : keep local si delta stamp <5s (anti-cycle)
- `customGuitars` : union par id, remote overwrite sur conflit
- `customPacks` : union par name, remote overwrite
- Autres champs (banks, enabledDevices, etc.) : adopt en bloc

### Règle 3 : `mergeSetlistsLWW` dedup automatiquement

Après le merge LWW per-id classique, appliquer `dedupSetlists(out,
{mergeAcrossProfiles: true})` pour fusionner les doublons par name
(profileIds union, songIds union, garde celle avec le plus de songs).
Stamp `lastModified` sur le survivant si fusion effective → propage le
clean via sync.

### Règle 4 : Debug forensique

Activer `window.__BACKLINE_MERGE_DEBUG = true` dans la console pour
voir les logs `[merge-defense] <profileId> SUSPECT <field> ...` à
chaque merge qui déclenche un garde-fou. Utile pour catcher une
pollution active en prod.
