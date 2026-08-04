# 🚀 Guide de déploiement — Your Fortnite tracker

Ce guide regroupe **tout**, dans l'ordre. Chaque partie est **indépendante** : fais seulement celles dont tu as besoin.

| Partie | Ce que ça débloque | Obligatoire ? |
|--------|--------------------|---------------|
| 1. App en ligne (GitHub Pages) | Utiliser/installer l'app partout | ✅ recommandé |
| 2. Clé fortnite-api.com | Stats Epic, « En direct », Synchro | ⭐ pour les stats |
| 3. Backend API Epic officielle (`epic-proxy/`) | API Ecosystem d'Epic (avancé) | ⬜ optionnel |
| 4. Backend Classement (`leaderboard/`) | Classement entre joueurs + anti-triche | ⬜ optionnel |
| 5. Connexion Epic (OAuth) | Anti-usurpation du classement | ⬜ optionnel |

**Prérequis généraux :** [Node.js](https://nodejs.org) installé. Comptes selon les parties : GitHub, Cloudflare (gratuit), fortnite-api.com (gratuit), Portail Développeur Epic.

---

## 1) Mettre l'app en ligne — GitHub Pages

L'app est 100 % statique : aucun build.

1. Sur GitHub : dépôt → **Settings → Pages**.
2. **Source** : *Deploy from a branch* → **Branch** : `main` (ou ta branche) + dossier **`/ (root)`** → **Save**.
3. Après ~1 min : `https://eymericode.github.io/Testclaude/`.
4. Ouvre le lien, puis installe l'app (**Partager → Sur l'écran d'accueil** sur iOS, ou bouton **📲 Installer** sur Android/PC).

➡️ À ce stade, tu peux déjà tout utiliser **en saisie manuelle**, sans aucun backend.

---

## 2) Clé fortnite-api.com — stats, En direct, Synchro

Rien à déployer : ça se configure **dans l'app**.

1. Crée un compte sur **[dash.fortnite-api.com](https://dash.fortnite-api.com)** → copie ta **clé API**.
2. Dans Fortnite : **Paramètres → Compte et confidentialité** → active les **statistiques publiques** (sinon l'API renvoie « stats privées »).
3. Dans l'app → **Données / API** : colle ta **clé** + ton **pseudo Epic** + ta **plateforme**.
   - Bouton **🔍 Tester ma clé** pour vérifier la clé seule.
   - **Récupérer mes stats** puis onglet **Synchro** pour l'auto-suivi.

---

## 3) Backend API Epic officielle (avancé) — `epic-proxy/`

Optionnel. Proxy sécurisé (OAuth2 client_credentials) vers l'API Ecosystem d'Epic.

```bash
cd epic-proxy
npx wrangler login
npx wrangler secret put EPIC_CLIENT_ID
npx wrangler secret put EPIC_CLIENT_SECRET
npx wrangler deploy
```

- Récupère l'URL du Worker (`https://epic-proxy.xxxx.workers.dev`).
- Vérifie : ouvre l'URL → `{ "ok": true }`.
- Dans l'app → **Données / API** → section **API officielle Epic** → colle l'URL → **Tester la connexion**.
- Détails et URLs configurables : `epic-proxy/README.md`.

---

## 4) Backend Classement — `leaderboard/`

Optionnel. Classement partagé entre joueurs, avec **anti-triche** (score vérifié via Epic côté serveur).

```bash
cd leaderboard
npx wrangler login

# a) Base de données KV (stockage du classement)
npx wrangler kv namespace create LEADERBOARD
#   → copie l'"id" renvoyé et colle-le dans leaderboard/wrangler.toml
#     (bloc [[kv_namespaces]], champ id)

# b) Clé fortnite-api.com pour la vérification anti-triche (celle de la partie 2)
npx wrangler secret put FORTNITE_API_KEY

# c) Déploie
npx wrangler deploy
```

- Récupère l'URL du Worker (`https://fn-leaderboard.xxxx.workers.dev`).
- Vérifie : ouvre l'URL → `{ "ok": true, "message": "Classement opérationnel." }`.
- Dans l'app → onglet **Classement** → colle l'URL + ton **pseudo Epic** + plateforme → **📤 Publier**.
- Détails : `leaderboard/README.md`.

> Astuce : dans `leaderboard/wrangler.toml`, mets `ALLOW_ORIGIN` sur l'URL de ton app pour restreindre l'accès.

---

## 5) Connexion Epic (OAuth) — anti-usurpation du classement

Optionnel, en plus de la partie 4. C'est **Epic** qui certifie l'identité du joueur.

1. **Portail Développeur Epic** : crée une application + des identifiants **OAuth** (client_id + client_secret).
2. Déclare la **Redirect URL** = l'URL **exacte** de ton app : `https://eymericode.github.io/Testclaude/`.
3. Configure le Worker du classement :

   Dans `leaderboard/wrangler.toml`, ajoute sous `[vars]` :
   ```toml
   EPIC_REDIRECT_URI = "https://eymericode.github.io/Testclaude/"
   EPIC_OAUTH_CLIENT_ID = "ton_client_id"
   ```
   Puis le secret + redéploiement :
   ```bash
   cd leaderboard
   npx wrangler secret put EPIC_OAUTH_CLIENT_SECRET
   npx wrangler deploy
   ```
4. Vérifie : ouvre `https://fn-leaderboard.xxxx.workers.dev/epic/config` → `"configured": true`.
5. Dans l'app → onglet **Classement** → **🔐 Se connecter avec Epic**.

> ⚠️ Les URLs Epic par défaut (`authorize` / `token` / `userInfo`) sont dans `leaderboard/wrangler.toml` (commentées). Si la doc Epic en indique d'autres, décommente-les et ajuste, puis redéploie.

---

## Récapitulatif des URLs à retenir

| Élément | Où le coller dans l'app |
|--------|-------------------------|
| App | `https://eymericode.github.io/Testclaude/` |
| Clé fortnite-api.com | Données / API → Clé API |
| URL `epic-proxy` | Données / API → API officielle Epic |
| URL `leaderboard` | Classement → URL du backend |

## Coûts

Tout est **gratuit** dans les limites généreuses des offres gratuites (GitHub Pages, Cloudflare Workers + KV, fortnite-api.com). Aucune carte bancaire requise pour un usage personnel/entre amis.

## Dépannage rapide

- **404 sur l'app** → Pages pas encore activé (partie 1) ou dépôt privé (rends-le public).
- **« stats privées » (403)** → active les stats publiques dans Fortnite (partie 2).
- **« clé invalide » (401)** → régénère la clé sur dash.fortnite-api.com.
- **Endpoint déprécié (410)** → l'app est déjà à jour ; vide le cache (rafraîchis 2×).
- **Backend injoignable** → vérifie l'URL du Worker et que `wrangler deploy` a réussi.
- **`configured: false`** (OAuth) → il manque `EPIC_REDIRECT_URI` / `EPIC_OAUTH_CLIENT_ID` / le secret.
