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

Chaque ligne représente une régression réelle vécue en prod. La
prochaine session doit s'assurer qu'aucun fix ne ré-introduit un cas
ci-dessus.
