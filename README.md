# 🎯 Your Fortnite tracker

Une application web simple pour **suivre tes statistiques Fortnite** (kills moyens, K/D, taux de Victory Royale, dégâts…) et **recevoir des conseils personnalisés pour progresser**.

Aucune installation, aucun serveur : tout tourne dans ton navigateur et tes données restent chez toi.

## ✨ Fonctionnalités

- **Ajout de matchs** : mode, kills, assists, classement, dégâts, notes.
- **Tableau de bord** : moyenne de kills/match, K/D, taux de victoire, Top 10 %, dégâts moyens, records.
- **Fortnite en direct 📡** : boutique du jour, actualités Battle Royale et lieux de la carte actuelle, récupérés en temps réel.
- **Graphiques** : évolution des kills et des dégâts, répartition des classements, kills moyens par mode.
- **Suivi hebdomadaire 📅** : stats de la semaine en cours, **comparaison avec la semaine précédente** (deltas ▲/▼), **objectifs personnels** (kills/match, matchs, victoires, dégâts) avec barres de progression, et graphique semaine par semaine.
- **Rappels des jours de jeu 🔔** : choisis les jours où tu joues + une heure, et l'app t'envoie une **notification** pour penser à noter tes matchs et travailler ton objectif.
- **Coach intégré 🧠** : analyse tes performances et te donne des conseils concrets (duels, rotation, placement, objectifs).
- **Filtres** : par mode de jeu et par période (7 / 30 jours, 20 derniers matchs).
- **Sauvegarde** : export / import de tes données en JSON.
- **API Epic (optionnel)** : récupère automatiquement tes stats via [fortnite-api.com](https://fortnite-api.com).

## 📲 Disponible sur tous les appareils

L'app est une **PWA (Progressive Web App)** : un seul code qui fonctionne partout, installable comme une vraie application.

| Appareil | Comment installer |
|----------|-------------------|
| **Android** (Chrome, Edge…) | Ouvre l'URL → un bouton **« Installer l'app »** apparaît (ou menu ⋮ → *Installer l'application*). |
| **PC / Mac / Linux** (Chrome, Edge) | Icône d'installation dans la barre d'adresse, ou bouton **« Installer l'app »**. |
| **iPhone / iPad** (Safari) | Bouton **Partager** → **Sur l'écran d'accueil**. |

Une fois installée, l'app s'ouvre en plein écran, garde tes données, et **fonctionne même hors-ligne** (grâce au service worker qui met l'app en cache). Seules les données « En direct » nécessitent internet.

> 👉 Pour que l'installation et les notifications marchent, l'app doit être **hébergée** (http/https), pas ouverte en `file://`. Voir « Mettre en ligne » ci-dessous.

## 🚀 Utilisation

1. Ouvre simplement le fichier `index.html` dans ton navigateur (double-clic).
2. Va dans l'onglet **Ajouter** et enregistre tes matchs après chaque partie.
3. Consulte le **Tableau de bord** et l'onglet **Coach** pour voir où t'améliorer.

Tes données sont sauvegardées automatiquement dans le `localStorage` de ton navigateur.

## 🔌 Connexion à ton compte Epic (optionnel)

Pour récupérer automatiquement tes stats globales :

1. Crée un compte gratuit sur [dash.fortnite-api.com](https://dash.fortnite-api.com) et récupère ta **clé API**.
2. Dans Fortnite / Epic Games, mets tes statistiques en **public** : *Paramètres → Compte et confidentialité → Rendre les statistiques publiques*.
3. Dans l'app, onglet **Données / API**, colle ta clé et ton pseudo Epic, puis clique sur *Récupérer mes stats*.

> ⚠️ Epic ne fournit pas d'API officielle publique pour les stats par match. L'API communautaire renvoie tes stats **cumulées**. Pour un suivi match par match et les conseils, ajoute tes parties manuellement (c'est rapide, ~10 secondes par match).

## 📡 Fortnite en direct

Onglet **En direct** : affiche en temps réel via [fortnite-api.com](https://fortnite-api.com) :

- **Boutique du jour** (skins, pioches… avec prix en V-Bucks) — *nécessite ta clé API* (la même que l'onglet Données/API ; elle est mémorisée).
- **Actualités Battle Royale** — accès libre, sans clé.
- **Lieux de la carte actuelle** — accès libre, sans clé.

Un bouton **🔄 Actualiser** recharge les données. Chaque bloc est indépendant : si l'un échoue (réseau, API), les autres s'affichent quand même.

> ℹ️ Il n'existe pas d'API publique en temps réel pour ta **partie en cours** (Epic ne l'expose pas). « En direct » concerne les infos du jeu (boutique, news, carte), pas ta position dans une partie.

## 📱 Installer sur iPhone / iPad (comme une app)

L'app est une **PWA** : tu peux l'ajouter à ton écran d'accueil et l'utiliser comme une vraie application (plein écran, icône, notifications).

**Sur iPad Pro / iPhone (Safari) :**
1. Héberge l'app (GitHub Pages, voir plus bas) et ouvre l'URL dans **Safari**.
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. Lance l'app depuis l'icône : elle s'ouvre en plein écran, sans barre du navigateur.

> Les notifications de rappel fonctionnent sur iOS **16.4+** une fois l'app ajoutée à l'écran d'accueil et les notifications autorisées.

**Vraie app native iOS ?** Pour une app publiée sur l'App Store développée *depuis* l'iPad, utilise **Swift Playgrounds** (Apple) : c'est une réécriture en SwiftUI. La PWA ci-dessus reste la solution la plus rapide et couvre l'essentiel des besoins.

## 🔔 Rappels & notifications

Onglet **Rappels** : coche tes jours de jeu (Lun→Dim), choisis une heure et un message, puis *Activer les rappels*. Le navigateur te demandera l'autorisation d'envoyer des notifications.

**Important — les notifications ont besoin de conditions précises :**

1. **Autorisation** accordée (le navigateur la demande au premier clic).
2. **Site servi en http/https** — ça ne marche **pas** en ouvrant le fichier en `file://`. Deux options :
   - **Local** : dans le dossier du projet, lance `npx http-server` (ou `python3 -m http.server`) puis ouvre `http://localhost:8080`.
   - **En ligne** : héberge sur GitHub Pages (voir ci-dessous) — recommandé.
3. **App ouverte ou installée** : la notification part quand l'onglet est ouvert (même en arrière-plan) ou quand tu as *installé* l'app (PWA : menu du navigateur → « Installer l'application »). Sur mobile, installe-la sur l'écran d'accueil.

> 💡 Pour des notifications même **app complètement fermée**, il faut un serveur push (Web Push + VAPID). C'est une évolution possible si tu héberges un petit backend — dis-le moi si tu veux l'ajouter.

Un bouton **Tester la notification** permet de vérifier que tout est en place.

## 📦 Déploiement complet

Pour tout mettre en place (app + backends optionnels) dans l'ordre, suis le guide unique : **[DEPLOIEMENT.md](DEPLOIEMENT.md)**.

## 🌐 Mettre en ligne (un lien pour tous les appareils)

Il te faut une **URL** pour installer et utiliser l'app sur n'importe quel téléphone/PC. Deux options simples et gratuites :

### Option 1 — GitHub Pages (le dépôt est déjà sur GitHub)

1. Sur GitHub : repo → **Settings → Pages**.
2. **Source** : *Deploy from a branch*.
3. **Branch** : choisis la branche (ex. `main` ou la branche de dev) et dossier **`/ (root)`**, puis *Save*.
4. Après ~1 minute, ton app est en ligne à `https://<utilisateur>.github.io/<repo>/`.
5. Ouvre cette URL sur ton téléphone et installe l'app (voir tableau ci-dessus).

### Option 2 — Netlify / Vercel (glisser-déposer, le plus rapide)

1. Va sur [app.netlify.com/drop](https://app.netlify.com/drop).
2. Glisse-dépose le dossier du projet.
3. Tu obtiens instantanément une URL `https://…netlify.app` accessible partout.

> Les deux servent l'app en **https**, ce qui active l'installation PWA, le mode hors-ligne et les notifications sur tous les appareils.

## 📁 Structure

```
index.html          Structure de l'application
manifest.json       Manifeste PWA (installation sur écran d'accueil)
icon.svg            Icône de l'app (vectorielle)
apple-touch-icon.png Icône pour l'écran d'accueil iOS/iPad (180px)
icon-192.png        Icône PWA Android/PC (192px)
icon-512.png        Icône PWA Android/PC (512px)
sw.js               Service worker (mode hors-ligne + notifications)
js/pwa.js           Installation multi-plateforme + enregistrement du SW
css/styles.css      Thème et mise en page
js/charts.js        Mini-librairie de graphiques (canvas, sans dépendance)
js/api.js           Intégration optionnelle fortnite-api.com (stats Epic)
js/live.js          Données Fortnite en direct (boutique, news, carte)
js/reminders.js     Rappels des jours de jeu (notifications)
js/app.js           Logique : stockage, stats, hebdo, coach, rendu
```

---

Bon jeu, et surtout : **un match enregistré = un match analysé pour progresser** 💪
