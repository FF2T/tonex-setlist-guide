# Backline — Stratégie beta testing

> Document de stratégie + journal des beta-testeurs. Complète
> `BETA_ONBOARDING.md` (procédure how-to) en gardant trace du **qui,
> quand, pourquoi, retours**.
>
> Dernière mise à jour : 2026-05-17.

## 1. Objectifs du beta testing

- **Validation produit** : confirmer que Backline résout un vrai
  problème ressenti par d'autres guitaristes que Sébastien.
- **Identifier les angles morts** : recos absurdes, friction UX,
  features manquantes que l'auteur ne voit pas par habitude.
- **Stress-test l'infrastructure** : Firestore sync multi-device,
  password hashing, prompts IA face à des univers musicaux variés
  (metal, punk, jazz, etc., pas que blues/rock 70s).
- **Construire du social proof** : 2-3 témoignages publiables pour le
  prochain post Reddit/forum (case study J+10).

## 2. Beta-testeurs actifs (état au 2026-05-17)

### Bruno (Reddit u/vegagravity) — onboardé J0, en pause J+1

- **Profil** : guitariste metal/punk/power metal, élève école de
  musique, en cours d'apprentissage. Parcours similaire à Sébastien :
  c'est son fils qui a démarré la guitare en premier.
- **Hardware** : Schecter C-1 Platinum (principale, HB), Ibanez Gio
  miKro GRGM21 (HB, guitare du fils), ToneX Pedal standard + ToneX
  Plug. **Pas d'Anniversary, pas de TMP.**
- **Sources** : Factory + PlugFactory (verrouillés) + custom (15
  presets identifiés dans ses banks 45-49 : mix Amalgam + TSR Mars
  800SL + Galtone Kirk & James + ToneNET communautaire pour AC/DC,
  Blink-182, Nirvana, etc.).
- **Setlist** : "Demo Backline" — All the Small Things (Blink-182),
  The Final Countdown (Europe), Dr. Stein (Helloween), Fear of the
  Dark (Iron Maiden), For Whom the Bell Tolls (Metallica), Self
  Esteem (The Offspring).
- **Mode reco** : `faithful` (privilégier l'authenticité historique).
- **Status** : onboardé via DM Reddit le 2026-05-14. Profil pré-
  configuré par Sébastien avec analyses IA pré-mâchées (6 morceaux).
  **Parti en week-end le 14, retour prévu lundi 18 mai (J+4).**
  Aucun retour d'usage réel encore. **DM J+4 prêt à envoyer le 18 mai**
  (3 questions courtes : ce qui marche / ce qui agace / recommanderait
  à autre guitariste metal).
- **Phases déclenchées par son profil** (cf CLAUDE.md) :
  - 7.31 : banks/customPacks dans le prompt IA + slot pinning
  - 7.32 : ideal_guitar filtrée sur rig profil actif + meilleur
    preset accessible affiché
  - 7.33 : bouton "Réinitialiser MES analyses" scoped profil actif
  - 7.34 : règle anti cross-contamination (Blink-182 Mesa Boggie ne
    déborde plus sur Offspring)
  - 7.35 : changement password possible par non-admin
- **Risques identifiés** : son profil metal/punk est l'opposé de la
  calibration blues/rock 70s de l'IA d'origine → utile pour stresser
  le système. Beta-tester le plus précieux pour le case study J+10.

### Francisco (Reddit u/Franxeskodi) — onboardé J+1, DM prêt à envoyer

- **Profil** : hispanophone (Espagne ?), a écrit *"Yo estoy en tu
  misma situación! A si que me vendría muy bien tener una app así 🙂"*
  sur le thread Reddit. Confirme l'universalité du problème "preset
  paralysis".
- **Hardware** confirmé via 2e commentaire :
  - **Guitares** : Sire Larry Carlton T7 (Telecaster, SC) + Squier
    Classic Vibe Strat (SC). Ajouté `Sire` à `GUITAR_BRANDS` en
    Phase 7.48 ticket T11.
  - **ToneX** : Pedal classique (3 boutons, pas Anniversary, pas
    Plug). **Version V2 CONFIRMÉE** (firmware post avril 2025) via
    son retour du 2026-05-15. Il a partagé 3 banks sample :
    - Banco 0 : CL DMBL / DR1 DMBL / DR2 DMBL → match exact
      `FACTORY_BANKS_PEDALE_V2[0]`
    - Banco 25 : CL ARCH / HG ARCH / LD ARCH → match exact
      `FACTORY_BANKS_PEDALE_V2[25]`
    - Banco 49 : BS XULTR / BS DOC / BS MUFF → match exact
      `FACTORY_BANKS_PEDALE_V2[49]` (les bass presets qui
      manquaient dans le mapping bugué pré-Phase 7.47)
    Aucune correction nécessaire sur son profil (V2 était bien la
    config par défaut au moment de la création).
- **Setlist** : "Mi banda" — 12 morceaux à confirmer (mix pop/rock
  espagnol probable, à vérifier au DM retour).
- **Question récurrente** : *"¿Le pediste también pedales para usar
  con la pedalera AmpliTube?"* — voudrait que l'app recommande des
  pédales AmpliTube en plus des captures ToneX. **Documenté Phase 8
  dans CLAUDE.md "Idées en attente"**.
- **Status** : profil créé, configuré (rig + setlist 12 morceaux),
  analyses IA pré-fetchées (11/12, Valerie à re-fetcher).
  Credentials : `Francisco` / `Francisco1505`. **DM ES envoyé**
  (2026-05-15, version complète avec instructions PWA + question
  V1/V2 incluse). Francisco a répondu rapidement avec sa config
  → V2 confirmée (cf section 7.bis). **Follow-up "reframe feedback"
  envoyé le 15 mai pour adresser son auto-évaluation "conocimientos
  limitados".** Silence depuis (J+2 au 17 mai). On attend.
- **Estimation** : ~70% qu'il aille jusqu'au bout (signal
  d'engagement fort : 2 commentaires détaillés + sa propre question
  proactive).

### Ok_Ask2411 (Reddit) — REVIREMENT : peer-builder authentique (2026-05-15)

- **Profil initial supposé** : commentaire vague *"Yes. Doing sth
  similar …. :)"*, classé "drop" pendant 24h faute de réponse.
- **Revirement 2026-05-15** : il a finalement répondu avec un
  **screenshot complet de son outil "Gear Assistant"** appliqué à
  "Panama strat shawbucker". Output remarquablement structuré et
  plus détaillé que Backline sur plusieurs dimensions.
- **Son outil produit** (format extrait du retour) :
  1. **3 Preset Candidates** avec score (92/87/82) + Confidence
     level (High/Medium) + Collection (Factory/ToneX MAX)
  2. **Knob Settings chiffrés** : Gain 6.2, Bass 4.5, Mid 7.0,
     Treble 5.3, Presence 4.7, Volume 6.0 (échelle 0-10, format
     tabulaire avec "Why / Notes")
  3. **Built-In Effects** détaillés en sous-tables :
     - Noise Gate : Threshold -48 dB, Release 140 ms, Depth -75 dB
     - Reverb Plate : Time 1.8s, Pre Delay 18ms, Color 52%, Mix 16%
     - Delay Analog : Time 320ms, Feedback 20%, Mix 14%
  4. **Additional Hints** : Pickup Choice (Bridge Shawbucker),
     Guitar Volume (8.5-10), Picking Style (Aggressive right hand),
     Stereo enabled, Noise Gate Usage (Moderate)
  5. **Alternatives if Missing** : 3 fallbacks priorisés
  6. **"ONE TWEAK TO FIX IT"** — section conditionnelle :
     - Si trop brillant → Presence -0.5 à -1.0
     - Si trop sombre → Treble +0.5
     - Si trop boomy → Bass -0.5
     - Si buried in mix → Mid +0.5
     - Si trop fizzy (JB) → Presence -0.5 + Gain -0.3
     - Si pas tight enough (metal) → Gain -0.5 + Gate threshold +
- **Analyse comparative Backline ↔ Gear Assistant Ok_Ask** :

| Dimension | Backline | Gear Assistant Ok_Ask |
|---|---|---|
| Modèle d'usage | setlist-first (rig + 13 morceaux persistants) | query-first (re-tape à chaque session) |
| Output knobs | prose `settings_preset` | table chiffrée structurée |
| Built-in FX | non générés | Noise Gate/Reverb/Delay paramétrés |
| Conditional tweaks | absent | section "ONE TWEAK TO FIX IT" |
| Confidence levels | score numérique 0-100 | High/Medium/Low + score |
| Pickup recommendation | implicit dans `ideal_guitar` | explicit "Bridge Shawbucker" |
| Playing technique | absent | Picking style, Guitar volume |
| Multi-device routing | Pedal+Plug+Ann+TMP simultanés | single preset |
| Bank/slot localization | Bank+slot A/B/C | nom preset seul |
| Persistence | profile + setlist sync Firestore | session-only probable |
| Live mode | LiveScreen swipe + Wake Lock | non |
| Offline | PWA + SW stale-while-revalidate | non documenté |
| Pack creator integration | TSR/ML/Galtone/Amalgam/ToneNET | Factory + "ToneX MAX" mentionné |

- **Positionnement stratégique** : pas concurrents, **complémentaires**.
  Lui couvre l'angle "j'ai un morceau en tête, donne-moi le preset
  pile poil maintenant". Backline couvre "j'ai un rig + une setlist,
  prépare-moi pour la répétition de samedi". User journey différent.
- **Action décidée** : DM peer-builder, pas onboarding beta. Le
  traiter comme un confrère pas comme un user. Voir section
  Templates DM pour le draft.
- **Inspiration pour Backline** : 4 features à reprendre dans une
  Phase 9 potentielle (output enrichi). Documenté dans CLAUDE.md
  "Idées en attente".

## 2.bis Contacts externes (créateurs de packs)

### Paul Drew (co-fondateur The Studio Rats) — contact warm établi

- **Contexte** : Sébastien a 64/64 packs TSR achetés (CLAUDE.md
  user preferences). Envoi d'un email respectueux *"je suis fan de
  vos captures, voici comment Backline les met en valeur, pas de
  demande"* le 2026-05-14.
- **Réponse Paul** (~30 min plus tard) :
  > *"Thanks so much for your support! I'd love to see that working.
  > Let me know if there's any packs you need!"*
- **Conséquences code** déclenchées par cet échange :
  - **Phase 7.44** : disclaimer marques tierces dans AppFooter
    ("ToneX™ est une marque d'IK Multimedia SpA. Autres marques
    citées appartiennent à leurs propriétaires respectifs.")
  - **Phase 7.45** : reframing prompt `settings_preset` +
    `settings_guitar` IA pour éviter le ton "le preset gagne à...
    être corrigé" (lecture possible vexante pour pack creator).
    Désormais : "le preset est calibré correctement par son
    créateur, tu peux l'adapter à ton matériel" + interdiction de
    formulations défensives.
- **Follow-up envoyé le 14 mai (mail 2)** : Sébastien a envoyé un
  follow-up direct demandant son rig pour créer un profil pré-
  configuré (guitares principales + ToneX hardware + 5-10 morceaux),
  10 min de setup. Mail incluait aussi un teaser technique : exemple
  concret du pin `TSR Mars 800SL HG` slot 49C sur "Fear of the Dark"
  (Iron Maiden) vs Factory JCM800, illustration que les captures
  studio TSR battent les factory génériques quand correctement
  proposées. Et acknowledgment de son offre packs ("I'm fully
  covered, all 64 of yours").
- **Status au 2026-05-17 (J+3)** : silence de Paul depuis. Pas
  inquiétant — son 1er reply était sur 30 min mais cofondateur
  entreprise occupé. Règle empirique : **attendre J+5-7** avant
  follow-up pour ne pas paraître pressing.
- **Mail 3 follow-up prêt** (à envoyer entre 19-20 mai) : pivote sur
  "no pressure on the rig" + propose la démo publique
  https://mybackline.app/?demo=1 (Phase 7.60 livrée le 17 mai) comme
  alternative low-friction 30s. Mentionne 2 pins TSR visibles dans
  la démo (Chop Suey → TSR Rectified Vintage 2, Schism → TSR
  Rectified Modern 1). Cf section 7.bis pour le transcript complet
  du draft.
- **Rig pressenti** (via Gemini search) : Nick Huber Krautster III,
  Friedman Vintage S HSS, Fender Ancho Poblano Strat, Gibson Murphy
  Lab R9, PRS McCarty avec Ron Ellis pickups. **Guitares haut-de-
  gamme/custom non-standard** — à voir si `GUITAR_BRANDS` couvre
  Nick Huber/Friedman ou s'il faudra les ajouter (Phase 7.51+) si
  Paul finit par envoyer son rig.
- **Enjeu stratégique** : Paul a une audience guitariste large via
  TSR. Un retour positif de sa part pourrait débloquer un crédit
  social significatif. **Garder l'angle "showcase respectueux" sans
  pousser pour reco/partnership** (CLAUDE.md règle anti
  cross-contamination respectueuse).

### Autres pack creators — stratégie d'extension (à décider 2026-05-17)

Suite à la livraison Phase 7.60.1 (snapshot démo balance 4 pack
creators : AA 25% + JS 25% + TJ 25% + TSR 25%), Sébastien envisage
d'étendre l'approche "showcase respectueux" type Paul Drew (TSR)
aux autres créateurs visibles dans la démo. Réflexion en cours.

#### Reco priorisation

1. **Jason Sadites (JS)** — priorité haute
   - 2 captures pinnées dans la démo : `JS Sir Ombre Ult Push 1`
     (Pride and Joy SRV) + `JS Wrecked Z Push 1` (Hotel California
     Eagles)
   - Profil indépendant créateur très actif sur YouTube/forums →
     plus accessible qu'un studio corporate
   - Risque faible : approche identique à Paul, "no ask, just
     wanted to share"
   - Timing recommandé : **viser fin mai (J+10 post-Paul mail 2)**
     pour étaler les contacts dans le temps

2. **Tone Junkie TV (TJ)** — priorité moyenne
   - 2 captures pinnées : `TJ 74 Purple Plexi` (Smoke on the Water)
     + `TJ DMBL ODS 124 LEAD 1` (Help the Poor Robben Ford)
   - Catalog Phase 7.52 a usages explicites Brian May, Beatles,
     Pete Townshend → couvre une niche British classic
   - Timing : **viser début juin** (~J+20 post-Paul)

3. **Amalgam Audio (AA)** — priorité basse, sensible
   - 50% des recos démo (dominance Marshall/Fender/Hiwatt blues-rock
     70s)
   - Risque "vous me piquez tous mes packs" si pas approché
     délicatement : mentionner explicitement que AA est le pack
     creator le plus représenté dans la démo, par construction
     scoring honnête
   - Timing : **viser mi-juin** (~J+30 post-Paul)

4. **Worship Tutorials (WT)** — pas prioritaire
   - 0 capture pinnée dans la démo actuelle
   - Niche worship (Lincoln Brewster, Hillsong) hors corps des
     morceaux démo
   - Pas de raison technique de contacter avant d'avoir un beta-
     tester worship qui le demande

#### Principes pour les contacts JS/TJ/AA

- **Messages personnalisés**, pas template uniforme (chaque pack
  creator a sa spécificité — citer le slot précis qu'on a vu pinné)
- **Étaler dans le temps** (1 contact / 1-2 semaines max) pour ne
  pas paraître spammy ni saturer le pipeline follow-ups
- **Garder l'angle "showcase respectueux"** Phase 7.45 : disclaimer
  marques en footer + reframing prompt "le preset est calibré
  correctement par son créateur, tu peux l'adapter à ton matériel"
- **No ask** : pas de partnership, pas de tarif spécial, juste
  "voici ce que je construis avec vos captures"
- Si réponse positive → proposer profil pré-configuré comme Paul
  (mais accepter qu'il dise "pas le temps" comme on a vu)

#### Risques à anticiper

- **Asymétrie attention** : si 4 contacts simultanés et 2 répondent
  positivement → 2 follow-ups + 2 onboardings + management de la
  charge cognitive. Limite proposée : **1 contact actif à la fois**
  (donc attendre Paul avant JS, etc.)
- **Dilution effet "I built around YOUR captures"** : si TSR voit
  qu'on contacte tous, l'unicité perçue baisse. Conséquence :
  formuler chaque contact pour souligner ce qui est **spécifique**
  à ce créateur dans Backline
- **Spam apparent** : Reddit DM batch = mauvais signal. Préférer
  email direct (site web, contact form) ou DM forum spécialisé

#### Décision en attente

Sébastien hésite — pas décidé entre attendre la réponse Paul J+5-7
avant d'engager JS, ou démarrer JS dès maintenant en parallèle.
Argument pour parallèle : si Paul ne répond jamais (~50% probabilité
réaliste), on a perdu 1-2 semaines sans engager le réseau. Argument
contre : on découpe l'attention.

À trancher dans les prochains jours selon retour Paul.

## 3. Beta-testeurs internes

### Arthur (admin, 13 ans, fils de Sébastien)

- Compte admin Backline depuis Phase 7.x.
- Utilisateur quotidien : utilise Backline pour préparer ses
  morceaux AC/DC (TNT, Thunderstruck, Highway To Hell, You Shook Me,
  Back in Black). Beta-testeur historique implicite.
- Hardware : Gibson SG '61 + Epiphone ES-339 + Epiphone LP Modern,
  Fender Junior Blues + Spark 40, ToneX Anniversary.

### Franck, Emmanuel (admins, amis)

- Comptes admin créés mais usage occasionnel. Pas testeurs actifs.

## 4. Stratégie de recrutement (2 semaines)

### J0-J7 : capitaliser sur l'existant

- ✅ Bruno onboardé (J0, parti en week-end J+1).
- ✅ Francisco onboardé (J+1, profil prêt, DM à envoyer).
- ✅ Ok_Ask2411 DM envoyé, silence confirmé → drop.
- ✅ Paul Drew (TSR) email envoyé, réponse warm reçue, DM rig en attente.
- ⏳ **Éditer le post Reddit original** avec un EDIT visible mentionnant
  que l'app est publique et que 2 beta-testeurs sont en cours.

### J7-J14 : récolter feedback Bruno + préparer le case study

- ⏳ **DM Bruno à J+3-5** pour ses premiers retours :
  > Salut Bruno, quelle a été ton expérience après quelques jours ?
  > 3 questions : (1) qu'est-ce qui marche bien ? (2) qu'est-ce qui
  > t'agace ? (3) recommanderais-tu à un autre guitariste metal ? Si
  > oui, je peux poster un quote anonyme dans mon prochain post
  > Reddit, ou tu peux y répondre toi-même.
- ⏳ **Préparer le case study J+10** : screenshots anonymisés des
  recos Bruno, quote (avec son accord), GIF 30s du workflow.

### J10 : post case-study Reddit

Titre suggéré : `Built an AI setlist assistant for ToneX, here's
what I learned working with the first beta tester (metal/punk, 3
Amalgam packs)`

Format gagnant :
- Image en haut (le screenshot recos).
- Histoire en 4 paragraphes courts.
- CTA bas : "MP me for a configured profile".

### J10-J14 : élargir aux autres canaux

- Forum officiel IK Multimedia ToneX (https://forum.ikmultimedia.com).
- Facebook groups "ToneX Users" (3-4 actifs, ~5-20k membres chacun).
- Discord ToneX s'il existe.
- YouTube : vidéo démo 2 min (optionnel selon temps dispo).

## 5. Templates DM (réutilisables)

### Template FR (français)

```
Salut !
Le lien de l'app : https://mybackline.app/
Au premier ouvrage, tu verras un écran de connexion. Tape :
- Nom du profil : <son_prénom>
- Mot de passe : <celui que tu as créé>
Coche "Mémoriser sur cet appareil" pour ne plus le retaper.
L'app fonctionne offline une fois ouverte. Tu peux l'installer en
PWA (Safari iOS → Partager → "Sur l'écran d'accueil" ; Chrome
desktop → barre URL → icône installer).
N'importe quel feedback est bienvenu, par retour de ce message.
```

### Template ES (espagnol) — pour Franxeskodi et co.

```
¡Hola! La beta está abierta — https://mybackline.app/ funciona en
cualquier navegador.

Si quieres que te prepare un perfil con tus datos (guitarras +
setlist), envíame por DM : (1) tus guitarras principales (2) tu
modelo de ToneX (Pedal estándar, Anniversary, One, Plug…) (3) 5-15
canciones prioritarias. Te lo configuro en 10 min.

La app está solo en francés por ahora (Chrome traduce muy bien al
español, sin problema), pero si los menús te resultan un problema
dímelo.

Saludos,
Seb
```

### Template EN (anglais) — pour futurs testeurs anglophones

```
Hey!
The beta is open at https://mybackline.app/ — works in any browser.

If you want me to set up a profile with your data (guitars +
setlist), DM me: (1) your main guitars (2) your ToneX model (Pedal
classic, Anniversary, One, Plug…) (3) 5-15 priority songs. I'll
configure it in 10 min.

App is in French for now (Chrome translates well to English), but
let me know if the menus are an issue.

Cheers,
Seb
```

### Template EN peer-builder (pour Ok_Ask2411 et confrères)

```
Whoa, that output format is excellent — the chiffrage knobs +
"ONE TWEAK TO FIX IT" especially. That conditional tweak section
is gold, that's exactly the empirical adjustment loop every
guitarist does in rehearsal.

Backline goes in a different direction:
- Setlist-first (persistent rig + 13 songs pre-computed for a
  rehearsal/gig)
- Multi-device routing (Pedal + Plug + Anniversary + TMP slots
  with bank/slot A/B/C addressing)
- Offline PWA + Firestore sync across iPhone/iPad/Mac
- LiveScreen with swipe + auto Wake Lock for stage use

Yours fills a clear ad-hoc query gap that mine doesn't cover —
"I'm noodling on Panama right now, what do I dial in?". My users
typically come with a fixed setlist, not free-form queries.

A few questions if you're up for it:
- What's your stack? GPT custom action, Claude project, self-hosted
  with an LLM API?
- Do you persist anything across sessions or is it fully stateless?
- Have you thought about pack creator integration (TSR/ML/Galtone)
  or are you Factory-only for now?

No pitch attached. Just curious how you got to that output format,
it's clearly the result of iteration.

Backline if you're curious: https://mybackline.app (FR for now,
Chrome translates). No login needed to peek, beta accounts on
demand.

Cheers,
Seb
```

## 6. Process onboarding validé (depuis Bruno)

Procédure validée empiriquement, à intégrer/synchroniser avec
`BETA_ONBOARDING.md` si évolution :

1. Créer profil non-admin via ProfilesAdmin (password initial fort).
2. **Switcher sur le profil du beta** via ProfileSelector avant de
   configurer ses banks/sources/customPacks — sinon les données
   atterrissent sur le profil admin.
3. Cocher ses devices + sources + custom guitars (sous son profil).
4. Pour les banks user (captures custom) : passer par 📦 Packs Vision
   IA OU saisie JS console directe + ajout dans `profile.customPacks`
   pour que la metadata soit reconnue par `findCatalogEntry`.
5. Définir son `recoMode` (`faithful` typique pour metal/punk,
   `balanced` par défaut).
6. Créer une setlist avec 5-15 morceaux + cocher son profil dans
   "Partager :".
7. Re-switch sur profil admin Sébastien.
8. Pre-fetcher l'IA sur ses morceaux via "🤖 Analyser/MAJ N" en étant
   sur SON profil actif (pas en admin) pour utiliser SON contexte
   (banks, sources, recoMode, guitarBias).
9. Vérifier sync ☁️ verte avant d'envoyer le DM.

**Pitfalls** observés sur Bruno (à éviter) :
- Lancer "Analyser/MAJ" depuis profil Sébastien admin → cache pollué
  avec ses guitares + sources Anniversary. Re-faire depuis profil
  Bruno.
- Imposer `guitarBias` manuels sur 4 styles en présupposant le rig
  du beta → court-circuite l'auto-derive Phase 7.7. Laisser
  "Pas d'override" par défaut.

## 7. Retours qualitatifs collectés (journal)

### 2026-05-14 — Bruno onboardé

Pas encore de retour. Parti en week-end le 14, retour prévu lundi
J+3-4. À mettre à jour quand Bruno donne ses impressions par DM
Reddit ou via le bouton 💬 in-app.

### 2026-05-14 — Échange Paul Drew (TSR)

Email envoyé respectueux, réponse warm en ~30 min :
*"Thanks so much for your support! I'd love to see that working.
Let me know if there's any packs you need!"*

Pas de demande explicite côté Paul. DM follow-up préparé pour lui
proposer un profil pré-configuré. En attente.

Phases code déclenchées préventivement par cet échange :
- Phase 7.44 : disclaimer marques tierces (AppFooter)
- Phase 7.45 : reframing prompt IA pour éviter ton défensif sur
  les presets (lecture pack creator)

### 2026-05-15 — Francisco confirme V2 + warm response

Retour de Francisco au DM initial :

> *"Muchas gracias compañero!! Esta tarde la cobraré un rato e
> intentaré darte feedback aunque mis conocimientos de guitarra y
> sonidos es muy limitado. He mirado mi toneX pedal actualmente y
> está es la configuración que tengo: Banco 0: A- CL DMBL B- DR1
> DMBL C- DR2 DMBL Banco 25: A- CL ARCH B- HG ARCH C- LD ARCH
> Banco 49: A- BS XULTR B- BS DOC C- BS MUFF Si necesitas
> cualquier otra información dímela Mil gracias!!!"*

Signaux positifs :
- Engagement confirmé ("Esta tarde la cobraré un rato")
- Promet du feedback malgré son auto-évaluation guitare limitée
- Réactivité (réponse rapide + détail des 3 banks demandées
  spontanément)
- Ton chaleureux ("compañero", "mil gracias")

Confirmation technique : V2 validée. Pas de rectification profil
nécessaire.

À noter : son auto-évaluation "conocimientos limitados" est un
signal précieux — il représente le segment cible "guitariste
amateur qui galère avec la sélection de presets, pas un power
user IKM". Son retour qualitatif vaudra plus que celui d'un
expert (qui sait déjà ce qu'il cherche).

### 2026-05-15 — Francisco profil configuré (premier passage)

2 commentaires Reddit en ES :
1. *"¿Le pediste también pedales para usar con la pedalera
   AmpliTube?"* — feature request AmpliTube (documenté Phase 8
   "Idées en attente" CLAUDE.md)
2. Rig détaillé : Sire Larry Carlton T7 + Squier CV Strat + ToneX
   Pedal 3 boutons. Setlist 12 morceaux "Mi banda".

Profil créé/configuré côté admin. DM ES prêt à envoyer après 3
micro-fixes (Sire brand + Valerie aiCache + reload SW).

Phases code déclenchées par sa configuration :
- Phase 7.47 (par Claude Code parallèle) : split
  `FACTORY_BANKS_PEDALE` en V1/V2, ajout source `FactoryV1`,
  dropdown firmware dans BankEditor. Configuration V2 par défaut
  (post avril 2025). V1 placeholder vide (liste à fournir).
- Phase 7.48 (8 tickets dont T11 Sire ajoutée à GUITAR_BRANDS) :
  fix UX + IA suite à son rig.

### 2026-05-15 — Décision drop Ok_Ask2411 (annulée le même jour)

48h sans aucune réponse au reply Reddit ni au DM envoyé. Signal
trop faible pour justifier de l'énergie supplémentaire. Drop décidé.

**Revirement quelques heures plus tard** : il a finalement répondu
avec un screenshot complet de son outil "Gear Assistant" appliqué
à "Panama strat shawbucker" (Van Halen). C'est un peer-builder
authentique avec un outil fonctionnel et un format de sortie
remarquable (cf section 2 son entrée mise à jour).

**Reclassification** : pas beta-tester, pas drop, **peer-builder
confrère**. DM peer rédigé (cf section 5 Template EN peer-builder).

**4 features inspirantes pour Backline** documentées dans CLAUDE.md
"Idées en attente" Phase 9 :
1. Knob settings en table chiffrée (vs prose actuelle)
2. Built-in FX params (Noise Gate/Reverb/Delay) générés par l'IA
3. Section "ONE TWEAK TO FIX IT" conditionnelle
4. Pickup choice + Playing technique recommendations explicites

Useful stats récupérées du sub r/tonex au passage :
- 5,1k visiteurs hebdo / 160 contributions hebdo
- Flairs disponibles incluant "TONEX Pedal" (meilleur que
  "Discussion" pour le futur post case study J+10)

### 2026-05-17 — Session 7.60 + 7.60.1 (landing publique + snapshot démo balance pack creators)

Grosse session orientée préparation envoi démo à Paul Drew (TSR).
27 phases livrées en 32 deploys prod cette session (cumul depuis
2026-05-15 sur Backline v8.14.97 → v8.14.101). Voir CLAUDE.md
section "État actuel" pour détails techniques.

**Phase 7.60** (v8.14.99) — Première brique stratégie conversion
publique :
- `LandingScreen` servie aux first-time visitors (aucun trusted
  device) au lieu du ProfilePicker cryptique
- Hero + 3 features cards + 2 CTAs (Mode démo + Demander accès
  beta via Tally) + lien "J'ai déjà un compte"
- `ThanksScreen` branded post-Tally redirect `?thanks=1`
- Forms Tally bilingues : FR `RGbBVd`, EN `68WQyO`, popup embed
  (script chargé paresseusement, jamais pour profils trusted)
- Sébastien doit configurer le redirect URL `https://mybackline.app/?thanks=1`
  sur ses 2 forms Tally (settings After form submission)
- SW gated PROD only (évite que le SW prod pollue le dev server)

**Phase 7.60.1** (v8.14.100) — Snapshot démo finalisé balance 4
pack creators pour envoi Paul :
- Setlist passe de 11 morceaux (8 AA + 1 JS + 2 fallback) à 8
  morceaux balance parfait **2-2-2-2** : AA (Back in Black, Thrill
  Is Gone) + JS (Hotel California, Pride and Joy SRV) + TJ (Smoke
  on the Water, Help the Poor Robben Ford) + TSR (Chop Suey,
  Schism)
- ToneX Plug retiré du profil curateur démo (1 device suffit pour
  épurer les fiches)
- Constat structurel découvert pendant le fine-tuning : la
  curation Phase 7.52 d'AA Premium a optimisé les scores HB pour
  gagner par défaut sur metal/hard rock générique. Seuls les
  artistes **sans AA Premium dans usages** permettent à TSR de pin
  (Tool/SOAD = Chop Suey + Schism).

**Phase 7.60.2** (v8.14.101) — Wording fix DemoBanner FR : "ta rig"
→ "ton matériel" (anglicisme + grammaire bancale).

**Status mails Paul** : mail 2 envoyé le 14 mai, silence J+3 au 17
mai. Mail 3 follow-up draft archivé (section 7.bis ci-dessous) à
envoyer entre 19 et 20 mai si silence persiste.

**Décision en attente** : faut-il étendre l'approche à Jason
Sadites (JS) / Tone Junkie TV (TJ) / Amalgam Audio (AA) en
parallèle, ou attendre la réponse Paul d'abord ? Réflexion
documentée section 2.bis (Autres pack creators).

## 7.bis Transcript des échanges externes clés

### Email Sébastien → Paul Drew (TSR) — 2026-05-14

Angle : showcase respectueux, "no ask, just curious". Sébastien
client (64/64 packs TSR achetés), Backline expose comment les
captures TSR brillent quand assignées au bon morceau.

Pas de demande de partenariat. Pas de demande de tarif spécial.
Juste *"voici ce que je construis avec vos captures, j'avais envie
que tu saches"*.

### Réponse Paul → Sébastien — 2026-05-14 (~30 min après l'envoi)

> *"Thanks so much for your support! I'd love to see that working.
> Let me know if there's any packs you need!"*

Lecture stratégique : Paul est un humain accessible, ouverture
implicite à un test mais aucun engagement formel. **Pas de
follow-up commercial**, juste lui montrer ce qu'on fait quand
il aura le temps.

### Mail 2 Sébastien → Paul Drew (TSR) — 2026-05-14 (envoyé)

Follow-up envoyé le même jour que sa réponse warm. Propose un
profil pré-configuré (10 min de setup) + teaser technique concret
+ acknowledgment de son offre de packs (déjà 64/64).

> *"Hi Paul,
>
> Thanks for the warm reply — that genuinely made my day!
>
> I'd love to set up a profile for you so you see the app at its
> best (rather than starting from a blank account). If you tell me
> in a quick reply : (1) your main guitars (2) the ToneX hardware
> model you reach for most - ToneX Pedal, Anniversary... (3) 5-10
> songs you'd typically rehearse with, I'll have it ready in 10
> minutes, pre-configured with your rig, your usual setlist, and
> the AI analyses pre-cached.
>
> Quick technical note for context : the AI prompt now lists all
> installed captures by name and reasons about which one matches a
> song best. When I tested it on Iron Maiden's "Fear of the Dark"
> with your Mars 800SL HG in slot 49C, it correctly pinned your
> capture over the factory JCM800, exactly because your studio
> capture is more authentic than a generic one. That's the kind of
> moment I hoped to enable.
>
> About the offer to send packs, that's genuinely kind, but I
> already own all 64 (I'm a fan-boy with no boundaries). Honestly,
> the best gift would be your candid feedback after a session with
> the app. If something feels wrong about how a TSR capture is
> presented or recommended, I'd love to know.
>
> Cheers
> Sébastien"*

Choix structurels notables :
- Open avec "thanks for the warm reply" + "made my day" : matche
  son énergie warm
- Demande rig FORMATÉE (3 numéros) → réduit la friction "qu'est-ce
  que je dois lui envoyer ?"
- Teaser technique précis (Fear of the Dark + Mars 800SL HG 49C
  > factory JCM800) : prouve que ça marche concrètement, donne envie
- Acknowledge l'offre packs sans accepter : "I'm a fan-boy with no
  boundaries" = humour auto-dérisoire désamorçant
- Reframe le "best gift" en feedback honnête : repositionne Paul
  comme expert dont l'opinion compte, pas comme fournisseur

### Mail 3 Sébastien → Paul Drew (draft, à envoyer J+5-7 si silence)

Si Paul n'a pas répondu au mail 2 d'ici le 19-20 mai (J+5-7 post-
mail 2), envoi d'un follow-up plus court qui RELÂCHE la pression
sur la demande de rig et propose la démo publique comme alternative
low-friction.

> *"Hi Paul,
>
> No pressure on the rig info — I know it can take a moment to
> gather.
>
> In the meantime, the public demo is now live if you'd like a
> quick 30-second look: https://mybackline.app/?demo=1. It runs on
> a generic blues/rock setlist (my own rig), so it's a "what does
> this app actually do" view rather than personalized to your work.
>
> Your TSR Anniversary Premium captures still surface where they
> belong: Chop Suey (System of a Down → TSR Rectified - Vintage 2),
> Schism (Tool → TSR Rectified - Modern 1). Two examples among the
> 30 TSR captures wired into the scoring engine.
>
> Still very interested in your candid feedback if you ever get a
> minute. No hurry, no expectation.
>
> Cheers,
> Seb"*

Logique des changements vs mail 2 :
- Open "No pressure on the rig info" : direct acknowledge silence
  sans pointer, lui retire la culpabilité, lui rend la main
- Propose la démo PUBLIQUE Phase 7.60 comme alternative 30s vs
  5 min de rig
- Mentionne 2 pins TSR (Chop Suey + Schism) visibles directement
  dans la démo → vérifiable en 30s, callback au teaser Fear of the
  Dark du mail 2 (qui n'est PAS dans la démo, c'était un test
  interne)
- Ferme avec "no hurry, no expectation" : laisse la porte ouverte
  sans pression

À envoyer entre **19 et 20 mai 2026** si silence persiste.

### Commentaires Reddit Francisco (u/Franxeskodi)

Commentaire 1 (parmi les 28 du thread original) :
> *"Yo estoy en tu misma situación! A si que me vendría muy bien
> tener una app así 🙂"*

Commentaire 2 (en réponse à mon DM initial) :
> *"Tengo una consulta — ¿le pediste también pedales para usar con
> la pedalera AmpliTube? Tengo Sire Larry Carlton T7 y Squier CV
> Strat, ToneX Pedal de 3 botones. Mi setlist 'Mi banda' tiene 12
> canciones [liste]."*

Feature request AmpliTube → Phase 8 backlog.

### DM Sébastien → Francisco (2026-05-15, envoyé après config profil)

Version complète envoyée incluant credentials + instructions PWA +
guide d'usage + question V1/V2 + apostille sur AmpliTube + PS sur
la traduction AI ES :

> *"Hola Francisco! Tu perfil ya está listo. Aquí tienes el acceso :
> 🔗 URL : https://mybackline.app/
> 👤 Usuario : Francisco
> 🔐 Contraseña : Francisco1505
>
> Lo que vas a encontrar al entrar :
> - Tu setlist 'Mi banda' con tus 12 canciones, todas ya pre-
>   analizadas por la AI
> - Tus 2 guitarras (Larry Carlton T7 + Squier CV Strat) configuradas
> - Tu ToneX Pedal seleccionado como único dispositivo
> - Modo reco 'Equilibrado' (mezcla fidelidad al original +
>   versatilidad para tu rig de single coils)
> - La app en español por defecto (puedes cambiar en Mi Perfil →
>   🎨 Visualización)
>
> Cómo usar :
> 1. En la setlist, haz click en cualquier canción
> 2. Verás la guitarra recomendada (Larry Carlton o Squier según el
>    morceau), el preset sugerido en tu ToneX Pedal (banco + slot),
>    y el razonamiento de la AI
> 3. Si una recomendación no te convence, hay un botón '💬 Dar
>    feedback a la AI' en cada canción — eso me ayuda muchísimo
> 4. Si quieres relanzar todos los análisis después de modificar tu
>    perfil, hay un botón '🔄 Reiniciar mis análisis' en Mi Perfil →
>    🎯 Preferencias AI
>
> La app funciona offline después de la primera apertura. Puedes
> instalarla como app real (Safari iOS → Compartir → 'Añadir a
> pantalla de inicio' ; Chrome desktop → barra URL → icono instalar).
>
> Una pregunta opcional para mejorar tu configuración : IK Multimedia
> sacó una actualización de los presets factory en abril de 2025 —
> hay dos versiones del pedal en circulación. ¿Podrías echar un
> vistazo a tu ToneX Pedal y decirme qué presets tienes en :
> - Banco 0 : A / B / C
> - Banco 25 : A / B / C
> - Banco 49 : A / B / C
> (30 segundos via tu ToneX Editor o leyendo directamente en el
> pedal.) Es para confirmar que la versión que tengo configurada
> coincide con tu pedal real. Si te complica, no pasa nada —
> configurarás manualmente los presets que difieran después.
>
> Tu sugerencia sobre AmpliTube (poder sugerir también pedales para
> acercar el sonido al original) está anotada en mi roadmap como
> Fase 8 potencial. Buena idea — gracias.
>
> Cualquier comentario es bienvenido, sin filtros. Eso es lo que
> realmente me sirve.
>
> ¡Hasta pronto!
> Seb
>
> ---
> PS : escribo en español con ayuda de AI (mi lengua materna es el
> francés) — si algo suena raro o ves una traducción mejor en la
> app, dímelo sin problema."*

Choix structurels notables :
- Crédentiels en haut (action principale claire)
- Liste exhaustive de ce qui est pré-configuré (rassure : pas de
  setup attendu)
- 4 étapes "cómo usar" courtes (réduit l'anxiété première utilisation)
- Question V1/V2 framée comme "opcional para mejorar" + escape clause
  "si te complica, no pasa nada" (limite la friction)
- AmpliTube remerciement explicite (validation de sa contribution)
- PS sur la traduction AI = honnêteté désarmante + invite à
  corriger les ES bizarres (transforme limite linguistique en
  contribution utilisateur)

### Réponse Francisco → Sébastien (2026-05-15)

> *"Muchas gracias compañero!! Esta tarde la cobraré un rato e
> intentaré darte feedback aunque mis conocimientos de guitarra y
> sonidos es muy limitado. He mirado mi toneX pedal actualmente y
> está es la configuración que tengo: Banco 0: A- CL DMBL B- DR1
> DMBL C- DR2 DMBL Banco 25: A- CL ARCH B- HG ARCH C- LD ARCH
> Banco 49: A- BS XULTR B- BS DOC C- BS MUFF Si necesitas
> cualquier otra información dímela Mil gracias!!!"*

Signaux : engagement confirmé, V2 validée par match exact des
banks avec `FACTORY_BANKS_PEDALE_V2`, ton chaleureux, auto-
évaluation "conocimientos limitados" (segment cible).

### Follow-up Sébastien → Francisco (2026-05-15, envoyé)

DM court de relance pour adresser son auto-évaluation "conocimientos
limitados" et débloquer la friction du feedback :

> *"¡Hola Francisco!
>
> Justamente : yo tampoco me considero un experto del sonido. Empecé
> Backline porque me sentía perdido eligiendo presets para mis
> canciones, y necesitaba una herramienta para ayudarme. Tu situación
> es exactamente la que tenía en mente cuando lo construí — si te
> resulta útil, eso ya valida muchas decisiones que tomé.
>
> Al revés : tu feedback es lo que más me sirve. No necesita ser
> técnico — 'esta reco no me convence', 'no entiendo este botón',
> 'tardé en encontrar X', 'prefiero el sonido del banco 0A aunque la
> app recomiende otro' — todo eso vale oro. Justamente porque no eres
> un power-user, ves cosas que un experto ya no ve.
>
> Sin presión, tómate tu tiempo. Cuando tengas un momento esta tarde
> o cuando sea.
>
> Un abrazo,
> Seb"*

Intention :
- "Justamente" reprend directement son auto-évaluation et la retourne
  en miroir
- Origine personnelle de Backline (Sébastien aussi "perdu") → crée un
  lien d'égalité, pas position d'expert
- Validation explicite "si te resulta útil, eso ya valida..." → lui
  donne un rôle concret
- Reframe du feedback : 4 exemples très concrets de retours
  "non-techniques" qui valent gold → débloque la peur du "je ne
  saurais pas quoi dire de pertinent"
- "Justamente porque no eres un power-user, ves cosas que un experto
  ya no ve" → reframe sa "limite" en superpouvoir
- "Sin presión" + "cuando sea" → désamorce toute culpabilité de
  délai

**Envoyé 2026-05-15** après la réception de sa première réponse.
En attente de son test "esta tarde".

### Commentaire Reddit Bruno (u/vegagravity)

Conversation entamée en commentaire public puis basculée en DM
pour échange détaillé du rig (Schecter, Ibanez, banks customs 45-49,
6 morceaux choisis pour la démo).

### Commentaire Reddit Ok_Ask2411 (initial)

> *"Yes. Doing sth similar …. :)"*

Pas de follow-up à mon reply ni au DM pendant 48h. Drop initialement
décidé.

### Reply Ok_Ask2411 (revirement 2026-05-15)

Screenshot complet de son output "Gear Assistant" pour query
*"Panama strat shawbucker"*. Tables structurées : Preset Candidates
(3, avec scores 92/87/82 + Confidence High/Medium), Knob Settings
chiffrés, Built-In Effects (Gate/Reverb/Delay paramétrés),
Additional Hints (pickup, playing style, stereo), Alternatives,
section "ONE TWEAK TO FIX IT" conditionnelle.

Préset cités factory : "B HG 800 Gold Class", "B HG GUNS Highly
Destructive", "Thunder Luck" (ToneX MAX), "A DR 800 Golden Driver",
"VOWELS Plexi on a Horse", "Curly Rhythm" — match le catalog
Backline pour la plupart, ce qui suggère qu'il utilise une source
de données similaire (PDF factory IK Multimedia ou ToneNET community).

Verbatim conclusion : *"Source presets verified from uploaded ToneX
preset catalogs."* — il a clairement chargé un catalog en contexte
LLM (probablement RAG ou GPT custom avec knowledge files).

**Reclassification** : peer-builder confrère.

### Reply Sébastien → Ok_Ask2411 (2026-05-15, envoyé)

Version finale envoyée sur Reddit, plus courte et directe que le
template Template EN peer-builder de la section 5 :

> *"Whoa, that output format is excellent — the chiffrage knobs +
> the 'ONE TWEAK TO FIX IT' section especially. Backline goes in
> a different direction (persistent rig + setlist, multi-device
> routing, offline PWA), but yours fills a clear ad-hoc query gap.
> Curious about your stack — GPT custom? Claude project?
> Self-hosted?"*

Intention :
- Compliment authentique sur les 2 features les plus distinctives
- Reframe rapide de l'angle Backline (3 différenciants en 1 phrase)
  pour qu'il comprenne qu'on n'est pas concurrents
- Question stack ouverte (3 options listées) pour faciliter sa
  réponse sans le forcer à exposer tout son tech stack
- Pas de pitch produit, pas de "tu devrais essayer Backline", juste
  curiosité peer-to-peer
- Ton bilingue subtil ("chiffrage" gardé en français — clin d'œil)

En attente de sa réponse. Si silence → c'est OK, le ballon est dans
son camp et la signal a été envoyé respectueusement. S'il répond
avec son stack → ouvrir une vraie conversation tech (RAG, knowledge
files, prompt structure, etc.) qui peut nourrir Phase 9.

## 8. Analytics Reddit (post r/tonex original)

- **URL** : https://www.reddit.com/r/tonex/comments/1tbxoug/
- **Date** : 2026-05-13
- **Engagement** :
  - 1,9k vues en 24h (post "le plus populaire de tous les temps" de
    l'auteur sur le sub)
  - 28 commentaires
  - 0 upvotes nets (47% upvote ratio — sous le seuil neutre)
  - 6 réponses de l'OP (Sébastien)
- **Pays** : USA 37%, France 8.8%, UK 8.7%, Other 45%.
- **Pic d'audience** : H+1 après publication, décay rapide sur 48h
  (pattern Reddit standard).

### Leçons tirées

- Le format "survey" + mention "AI-powered" + absence de screenshot
  initial déclenche un réflexe défensif chez une frange de la
  communauté (drive-by "No" et hostilités "AI slop", "vibe coded").
- L'engagement positif vient des commentaires longs (Bruno,
  Franxeskodi, Ok_Ask2411, ikmultimedia, Franck-Catalan-style) — pas
  des votes.
- **Ne pas crossposter ce post tel quel** (ratio < 50% se propage).
- **Format gagnant prochain post** : retour d'expérience, screenshot
  en haut, histoire personnelle, CTA clair, pas de "would you use
  this?" en titre.

## 9. Canaux non-Reddit à explorer

| Canal | Audience estimée | Effort entrée | Priorité |
|---|---|---|---|
| Forum officiel IK Multimedia | Heavy users qualifiés | Modéré (rules à respecter) | Haute |
| Facebook groups "ToneX Users" | 5-20k membres chacun, 3-4 groupes | Faible (juste poster) | Moyenne |
| Discord ToneX (à vérifier existence) | Inconnu | Faible | Moyenne |
| YouTube (vidéo démo 2 min) | Très large mais effort production | Élevé | Basse |
| r/guitar, r/gearslutz crosspost | Vaste mais hors-niche | Moyen | Basse |

## 10. Mesures de succès (par scénario)

### Si scénario hobby (5-10 testeurs)

- Bruno + Franxeskodi + 2-3 autres beta utilisent l'app dans la
  semaine de leur onboarding.
- Au moins 2 reviennent l'utiliser organiquement (sans relance) sur
  J+30.

### Si scénario validation produit (toutes scenarios confondus)

- 20+ utilisateurs actifs hebdo à 3 mois.
- 3+ témoignages publiables.
- 1+ contact spontané de la part d'un acteur de l'écosystème (vendeur
  de packs, blog guitar, équipe IKM).

---

**Note pour Claude Code** : ce fichier est journal + stratégie. Pas
de code/architecture. Le mettre à jour quand un beta-testeur est
ajouté, retiré, ou quand un retour qualitatif arrive. Compléter la
section 7 (journal) au fil des retours.

**Note pour reprise de session** : ce fichier est le point d'entrée
pour reprendre une discussion avec Claude sur le beta-testing. Lire
en plus :
- `CLAUDE.md` — architecture + phases déjà livrées (sections "État
  actuel" récentes)
- `BETA_ONBOARDING.md` — procédure how-to générique
- `BETA_CREDENTIALS.md` — passwords des comptes beta (gitignored)
- `BUSINESS_PLAN.md` — vision long terme + scénarios (gitignored)
