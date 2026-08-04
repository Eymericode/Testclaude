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

## Notes

- **Une entrée par compte Epic** (insensible à la casse) : republier met à jour tes stats.
- **Vie privée** : le pseudo et le score publiés sont **visibles publiquement** via `/top`.
- `ALLOW_ORIGIN` (wrangler.toml) restreint qui peut appeler le backend — mets l'URL de ton app, ou `*` pour tout autoriser.
- Limite restante : quelqu'un peut publier le pseudo Epic **d'un autre** joueur (les stats resteront réelles, mais ce n'est pas « son » compte). Empêcher totalement l'usurpation demanderait une connexion Epic (OAuth) — possible en évolution.
