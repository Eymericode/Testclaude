# 🔐 Backend Epic (proxy officiel)

Petit backend qui permet à *Your Fortnite tracker* d'utiliser l'**API officielle Fortnite Ecosystem** d'Epic Games, **sans exposer ton `client_secret`** dans le navigateur.

Il tourne sur **Cloudflare Workers** (gratuit) et fait 3 choses :
1. Garde ton `client_id` / `client_secret` **côté serveur** (secrets).
2. Gère l'authentification **OAuth2 (client_credentials)** et met le jeton en cache.
3. Transmet tes requêtes à l'API Epic avec le jeton, et ajoute les en-têtes **CORS** pour que l'app puisse l'appeler.

## 1) Créer des identifiants Epic

1. Va sur le **Portail Développeur Epic** (dev.epicgames.com) et crée/ouvre une organisation.
2. Crée les identifiants d'application (**client_id** + **client_secret**) autorisés pour l'API Fortnite Ecosystem.
3. Note-les précieusement (le secret ne s'affiche qu'une fois).

## 2) Déployer le backend (Cloudflare Workers, gratuit)

Prérequis : un compte Cloudflare (gratuit) et Node installé.

```bash
cd epic-proxy

# Connexion à Cloudflare
npx wrangler login

# Enregistre tes secrets (ils NE vont PAS dans le code)
npx wrangler secret put EPIC_CLIENT_ID
npx wrangler secret put EPIC_CLIENT_SECRET

# Déploie
npx wrangler deploy
```

À la fin, Wrangler affiche l'URL de ton Worker, par exemple :
`https://epic-proxy.<ton-sous-domaine>.workers.dev`

## 3) Vérifier

Ouvre cette URL dans ton navigateur. Tu dois voir :

```json
{ "ok": true, "message": "Backend Epic opérationnel (OAuth OK)." }
```

- `ok: true` → l'OAuth fonctionne, tes identifiants sont bons. 🎉
- `ok: false` avec un message → corrige selon l'erreur (identifiants, URL du jeton…).

## 4) Brancher l'app

Dans *Your Fortnite tracker* → onglet **Données / API** → section **API officielle Epic** :
- colle l'URL de ton Worker,
- clique **Tester la connexion**,
- puis utilise **Interroger l'API Epic** pour voir la réponse brute des stats.

> Les endpoints exacts de l'API Ecosystem (chemin des stats joueur, format de la
> réponse) sont dans la doc officielle. Si un chemin diffère, tu peux surcharger
> `EPIC_TOKEN_URL` / `EPIC_API_BASE` dans `wrangler.toml`, puis redéployer.

## Configuration (wrangler.toml)

| Variable | Rôle |
|----------|------|
| `ALLOW_ORIGIN` | Origine autorisée à appeler le backend (ton app). `*` pour tout autoriser. |
| `EPIC_TOKEN_URL` | (optionnel) URL du jeton OAuth si différente de la valeur par défaut. |
| `EPIC_API_BASE` | (optionnel) Base de l'API Ecosystem si différente. |
| `EPIC_CLIENT_ID` / `EPIC_CLIENT_SECRET` | **Secrets** (via `wrangler secret put`), jamais dans le fichier. |

## Sécurité

- Le `client_secret` reste **uniquement** dans les secrets Cloudflare — il n'est jamais envoyé au navigateur.
- Restreins `ALLOW_ORIGIN` à l'URL de ton app pour éviter que d'autres sites utilisent ton backend.
