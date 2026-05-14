# Onboarding d'un beta testeur — Backline

Procédure pour ouvrir l'app à un nouveau beta testeur en mode partagé
(synchronisation Firestore activée). Pour un beta isolé sans Firestore,
utiliser plutôt l'URL `https://mybackline.app/?beta=1`.

## 1. Créer son profil (côté admin)

1. Login en admin (toi) sur `https://mybackline.app/`.
2. Avatar header → **Mon Profil → 👥 Profils**.
3. Section "+ Nouvel utilisateur" en bas :
   - Nom : prénom ou pseudo court (sera visible dans le grid des
     trusted profiles + dans le ProfileSelector des autres admins).
   - Mot de passe : générer quelque chose de robuste (~12 chars, mix
     lettres/chiffres). Le password est hashé SHA-256+salt avant
     stockage (Phase 7.28), pas en clair.
   - Cliquer "Créer".
4. **Le profil est `isAdmin: false` par défaut.** Si tu veux le
   promouvoir admin plus tard, le bouton ☆ Admin / ★ Admin permet le
   toggle (garde-fou anti dernier-admin actif).

## 2. Préparer son setup (recommandé — sinon il démarre vide)

Toujours en admin :

1. Avatar header → **Mon Profil → 🎯 Préférences IA** → "🗑 Invalider
   tous les caches IA" si tu veux qu'il reparte avec des analyses
   fraîches sur ses guitares (sinon il hérite des analyses faites sur
   les tiennes).
2. **Mon Profil → 🔑 Clé API → "🔑 Partager la clé"** : pousse ta clé
   Gemini vers Firestore `config/apikeys.gemini`. Sans ça, ses fetch
   IA échoueront ("Clé API manquante").

Puis bascule temporairement sous son profil pour configurer ses
guitares + ses devices :

3. Avatar header → ProfileSelector → choisir son profil → entrer son
   password (que tu connais).
4. **Mon Profil → 🎸 Guitares** : cocher ses guitares (depuis le
   catalogue Gibson/Fender/Epiphone/etc.). Il ne pourra pas en
   **ajouter** de nouvelles s'il n'est pas admin (verrou Phase 7.29.4),
   mais il peut **cocher** celles qui existent déjà dans le catalog
   shared.
5. **Mon Profil → 📱 Mes appareils** : cocher ses devices ToneX
   Pedal / Anniversary / Plug / TMP.
6. **Mon Profil → 📦 Sources** : décocher ce qu'il n'a pas comme
   packs de presets (TSR, ML, Factory, Anniversary, PlugFactory).
   Verrou auto : les sources cochées-matériel ne peuvent pas être
   décochées.
7. Repasse sous ton profil admin (ProfileSelector → toi → ton
   password).

## 3. Créer une setlist initiale pour lui

Pour qu'il voie quelque chose au premier login (sinon "Tous les
morceaux" est vide à cause du filtre Phase 7.29.5) :

1. Sous **ton** profil admin, **Setlists → Nouvelle setlist** avec un
   nom évocateur (ex. "Démo Backline" ou "Mes morceaux").
2. Y ajouter quelques morceaux (3-5 du catalog partagé).
3. Mode édition → section "Partager :" → cocher son profil.
4. La setlist devient visible pour lui (mais aussi pour toi).

Alternativement : ne rien préparer, et lui montrer au premier appel
comment créer sa setlist et ajouter ses premiers morceaux (la
SongSearchBar IA détecte les titres + artistes auto).

## 4. Lui envoyer

Email/message type :

> Salut !
>
> Le lien de l'app : https://mybackline.app/
>
> Au premier ouvrage, tu verras un écran de connexion. Tape :
> - Nom du profil : **<son_prénom>**
> - Mot de passe : **<celui que tu as créé>**
>
> Coche "Mémoriser sur cet appareil" pour ne plus le retaper.
>
> L'app fonctionne offline une fois ouverte. Tu peux l'installer en
> PWA (Safari iOS → Partager → "Sur l'écran d'accueil" ; Chrome
> desktop → barre URL → icône installer).
>
> N'importe quel feedback est bienvenu, par retour de ce message.

## 5. Ce qu'il pourra faire (utile à lui dire)

- ✅ Créer ses propres setlists (mode édition Setlists → ✏️)
- ✅ Ajouter des morceaux via la barre de recherche IA accueil
- ✅ Choisir le mode reco par morceau (⚖️ Équilibré / 🎯 Fidèle /
  🎨 Interprétation)
- ✅ Donner du feedback à l'IA sur un morceau (drawer fiche morceau →
  💬 Donner un feedback)
- ✅ Cocher ses guitares et ses sources
- ✅ Utiliser le mode scène live 🎤

## 6. Ce qu'il ne pourra PAS faire (par design)

- ❌ Voir les morceaux des autres profils (filtre visibility Phase
  7.29.5)
- ❌ Ajouter / éditer / supprimer une guitare du catalog shared
- ❌ Ajouter un preset ToneNET (pollue shared)
- ❌ Accéder à l'optimiseur des banks (Phase 7.29.3)
- ❌ Accéder à Maintenance, Export/Import, gestion des profils, Clé API
- ❌ Voir les noms des autres profils dans le ProfilePicker au boot
  (Phase 7.29.6)

## 7. Ce que tu peux observer côté admin

- Mon Profil → 👥 Profils → carte du beta → "Dernières connexions"
  (5 derniers logins datés)
- Setlists → tab "Morceaux" → tu vois ses morceaux ajoutés (l'admin
  voit tout le songDb partagé)
- Mes Setlists où il est dans `profileIds` → tu vois ce qu'il met
  dedans

## 8. Trade-offs connus à garder en tête

- `song.feedback[]`, `song.notes`, `song.recoMode` sont partagés.
  Si le beta tombe sur un de tes morceaux (en le retapant dans la
  search bar et que le dédup le retrouve), il voit tes feedbacks
  dessus. À adresser un jour avec des annotations per-profile si
  besoin.
- Le beta peut **ajouter** des morceaux au songDb partagé (dédup
  auto via title+artist normalisés). Il ne peut pas en supprimer
  via l'UI courante.

## 9. Révoquer un beta

- Avatar header → **Mon Profil → 👥 Profils → bouton "Supprimer"**
  sur sa carte. Le profil est retiré de tous les devices au
  prochain pull Firestore.
- Note : ses morceaux/setlists qu'il aurait pu créer restent dans
  le songDb partagé (à nettoyer manuellement via MaintenanceTab →
  "Dédupliquer la base").
