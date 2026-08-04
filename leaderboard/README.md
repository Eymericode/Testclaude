# 🏅 Backend du classement (leaderboard)

Petit backend qui stocke le **classement partagé** des joueurs de *Your Fortnite tracker*.
Tourne sur **Cloudflare Workers** (gratuit) avec un stockage **KV**.

Chaque joueur qui clique « Publier mon score » envoie son **pseudo + score** ici ; l'app affiche ensuite le **top des joueurs**.

## Déploiement

Prérequis : un compte Cloudflare (gratuit) et Node.

```bash
cd leaderboard

# Connexion
npx wrangler login

# 1) Crée le namespace KV (stockage du classement)
npx wrangler kv namespace create LEADERBOARD
#   → copie l'"id" renvoyé...

# 2) ...et colle-le dans wrangler.toml (champ id du bloc [[kv_namespaces]])

# 3) Clé API Epic pour la vérification anti-triche (récupérée sur dash.fortnite-api.com)
npx wrangler secret put FORTNITE_API_KEY

# 4) Déploie
npx wrangler deploy
```

Wrangler affiche l'URL de ton Worker, ex. `https://fn-leaderboard.<sous-domaine>.workers.dev`.

## Vérifier

Ouvre cette URL → tu dois voir :

```json
{ "ok": true, "message": "Classement opérationnel." }
```

## Brancher l'app

Dans *Your Fortnite tracker* → onglet **Classement** :
- colle l'URL du Worker,
- choisis ton **pseudo public**,
- clique **Publier mon score**.

Le classement se remplit au fur et à mesure que des joueurs publient.

## Endpoints

| Méthode | Route | Rôle |
|--------|-------|------|
| GET | `/` | Santé |
| POST | `/submit` | Publie un joueur `{ name, platform }` — le serveur **vérifie via Epic** et calcule le score |
| GET | `/top?limit=50` | Top des joueurs, triés par score |

## 🛡️ Anti-triche

Le client n'envoie **que le pseudo Epic** (+ plateforme). Le serveur :
1. appelle l'API Epic (fortnite-api.com) avec **sa** clé (`FORTNITE_API_KEY`),
2. récupère les **vraies** stats du joueur,
3. **calcule le score côté serveur** (`kills + victoires × 15`).

→ Impossible de gonfler son score depuis le navigateur. Seuls les comptes Epic aux **stats publiques** peuvent rejoindre le classement.

## 🔐 Connexion Epic (anti-usurpation) — optionnel

Sans connexion, quelqu'un peut publier le **pseudo d'un autre**. Avec la connexion Epic, c'est **Epic** qui certifie l'identité.

### Mise en place

1. Dans le **Portail Développeur Epic**, crée une application et des identifiants **OAuth** (client_id + client_secret).
2. Déclare la **Redirect URL** = l'URL exacte de ton app, ex. `https://eymericode.github.io/Testclaude/`.
3. Configure le Worker :
   ```bash
   # variables (wrangler.toml [vars]) : EPIC_REDIRECT_URI, EPIC_OAUTH_CLIENT_ID
   #   puis le secret :
   npx wrangler secret put EPIC_OAUTH_CLIENT_SECRET
   npx wrangler deploy
   ```
4. Vérifie : `GET /epic/config` doit renvoyer `"configured": true`.

### Fonctionnement

- L'app redirige le joueur vers Epic → il se connecte → Epic renvoie un `code` à ton app.
- L'app envoie ce `code` au Worker (`POST /epic/publish`) → le Worker l'échange contre l'identité **certifiée** (compte + pseudo), récupère les stats, calcule le score, et publie une entrée **`epicVerified`**.
- Un pseudo `epicVerified` ne peut plus être écrasé via `/submit` (anti-usurpation).

> ⚠️ Les URLs Epic par défaut (`EPIC_TOKEN_URL`, `EPIC_ACCOUNT_URL`, `EPIC_AUTHORIZE_URL`) sont des valeurs de base **à confirmer dans la doc Epic** ; surcharge-les dans `wrangler.toml` si nécessaire.

## Notes

- **Une entrée par compte Epic** (insensible à la casse) : republier met à jour tes stats.
- Le classement privilégie les comptes **certifiés Epic** en cas de même pseudo.
- **Vie privée** : le pseudo et le score publiés sont **visibles publiquement** via `/top`.
- `ALLOW_ORIGIN` (wrangler.toml) restreint qui peut appeler le backend — mets l'URL de ton app, ou `*` pour tout autoriser.
- Limite restante : quelqu'un peut publier le pseudo Epic **d'un autre** joueur (les stats resteront réelles, mais ce n'est pas « son » compte). Empêcher totalement l'usurpation demanderait une connexion Epic (OAuth) — possible en évolution.
