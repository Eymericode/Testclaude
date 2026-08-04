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

# 3) Déploie
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
| POST | `/submit` | Publie/actualise un joueur `{ name, score, kills, wins, matches, rank }` |
| GET | `/top?limit=50` | Top des joueurs, triés par score |

## Notes

- **Une entrée par pseudo** (insensible à la casse) : republier met à jour ton score.
- **Vie privée** : le pseudo et le score publiés sont **visibles publiquement** via `/top`.
- `ALLOW_ORIGIN` (wrangler.toml) restreint qui peut appeler le backend — mets l'URL de ton app, ou `*` pour tout autoriser.
- Pas d'authentification : n'importe qui connaissant l'URL peut publier. Pour un usage entre amis c'est suffisant ; pour aller plus loin on pourrait ajouter une clé ou une vérification via l'API Epic.
