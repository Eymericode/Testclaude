# 🎯 Fortnite Stats Tracker

Une application web simple pour **suivre tes statistiques Fortnite** (kills moyens, K/D, taux de Victory Royale, dégâts…) et **recevoir des conseils personnalisés pour progresser**.

Aucune installation, aucun serveur : tout tourne dans ton navigateur et tes données restent chez toi.

## ✨ Fonctionnalités

- **Ajout de matchs** : mode, kills, assists, classement, dégâts, notes.
- **Tableau de bord** : moyenne de kills/match, K/D, taux de victoire, Top 10 %, dégâts moyens, records.
- **Graphiques** : évolution des kills et des dégâts, répartition des classements, kills moyens par mode.
- **Suivi hebdomadaire 📅** : stats de la semaine en cours, **comparaison avec la semaine précédente** (deltas ▲/▼), **objectifs personnels** (kills/match, matchs, victoires, dégâts) avec barres de progression, et graphique semaine par semaine.
- **Coach intégré 🧠** : analyse tes performances et te donne des conseils concrets (duels, rotation, placement, objectifs).
- **Filtres** : par mode de jeu et par période (7 / 30 jours, 20 derniers matchs).
- **Sauvegarde** : export / import de tes données en JSON.
- **API Epic (optionnel)** : récupère automatiquement tes stats via [fortnite-api.com](https://fortnite-api.com).

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

## 🌐 Mettre en ligne (GitHub Pages)

1. Pousse le dépôt sur GitHub.
2. Repo → *Settings → Pages* → Source : branche principale, dossier `/root`.
3. Ton app sera accessible à `https://<utilisateur>.github.io/<repo>/`.

## 📁 Structure

```
index.html          Structure de l'application
css/styles.css      Thème et mise en page
js/charts.js        Mini-librairie de graphiques (canvas, sans dépendance)
js/api.js           Intégration optionnelle fortnite-api.com
js/app.js           Logique : stockage, stats, coach, rendu
```

---

Bon jeu, et surtout : **un match enregistré = un match analysé pour progresser** 💪
