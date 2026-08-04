/*
 * Backend du classement (leaderboard) pour Your Fortnite tracker.
 *
 * Stockage : Cloudflare KV (un seul objet JSON "board" { pseudoMinuscule: entrée }).
 * Simple et suffisant pour un classement de taille modeste.
 *
 * Routes :
 *   GET  /            → santé
 *   POST /submit      → { name, score, kills, wins, matches, rank } : publie / met à jour un joueur
 *   GET  /top?limit=  → renvoie le top N trié par score décroissant
 *
 * Déploiement : voir README.md (nécessite un namespace KV lié à "LEADERBOARD").
 */

const MAX_NAME = 24;
const WIN_BONUS = 15;
const RANK_NAMES = ['Recrue', 'Combattant', 'Vétéran', 'Élite', 'As', 'Maître', 'Champion', 'Légende', 'Mythique', 'Immortel'];
const RANK_MIN = [0, 50, 150, 400, 800, 1500, 3000, 6000, 12000, 25000];
function rankNameFor(score) {
  let i = 0;
  for (let k = 0; k < RANK_MIN.length; k++) if (score >= RANK_MIN[k]) i = k;
  return RANK_NAMES[i];
}

/* Récupère et VÉRIFIE les stats réelles du joueur via l'API Epic (fortnite-api.com).
   Le score est ainsi calculé côté serveur : impossible à falsifier depuis le navigateur. */
async function fetchEpicStats(env, name, platform) {
  const key = env.FORTNITE_API_KEY;
  if (!key) throw { status: 500, msg: "Vérification Epic non configurée sur le serveur (secret FORTNITE_API_KEY manquant — voir README)." };
  const url = 'https://fortnite-api.com/v2/stats/br/v2?name=' + encodeURIComponent(name) + '&accountType=' + encodeURIComponent(platform || 'epic');
  let res;
  try { res = await fetch(url, { headers: { Authorization: key } }); }
  catch (e) { throw { status: 502, msg: "Impossible de contacter l'API Epic." }; }
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* non-JSON */ }
  const apiMsg = data && (data.error || data.message);
  if (res.status === 401) throw { status: 500, msg: 'Clé API Epic du serveur invalide.' };
  if (res.status === 403) throw { status: 403, msg: apiMsg || 'Stats Epic privées — rends-les publiques pour rejoindre le classement.' };
  if (res.status === 404) throw { status: 404, msg: apiMsg || 'Joueur Epic introuvable (pseudo ou plateforme incorrects).' };
  if (!res.ok) throw { status: 502, msg: 'Erreur API Epic ' + res.status + '.' };
  const acc = data && data.data && data.data.account;
  const all = data && data.data && data.data.stats && data.data.stats.all && data.data.stats.all.overall;
  if (!all) throw { status: 403, msg: 'Statistiques indisponibles (probablement privées).' };
  return {
    name: (acc && acc.name) || name,
    kills: Math.max(0, Math.floor(all.kills || 0)),
    wins: Math.max(0, Math.floor(all.wins || all.top1 || 0)),
    matches: Math.max(0, Math.floor(all.matches || 0)),
  };
}

function cors(env, extra) {
  return Object.assign(
    {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
    extra || {}
  );
}
function json(env, obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: cors(env, { 'Content-Type': 'application/json; charset=utf-8' }),
  });
}
function cleanText(s, max) {
  return String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || MAX_NAME);
}
function num(n) {
  n = Number(n);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function readBoard(env) {
  const raw = await env.LEADERBOARD.get('board');
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}

/* ---------- Connexion Epic (OAuth2 authorization_code) ----------
   Empêche l'usurpation : c'est Epic qui certifie l'identité du joueur.
   URLs par défaut à VÉRIFIER dans le Portail Développeur Epic (surchargeables). */
const OAUTH_DEFAULTS = {
  AUTHORIZE_URL: 'https://www.epicgames.com/id/authorize',
  TOKEN_URL: 'https://api.epicgames.dev/epic/oauth/v2/token',
  ACCOUNT_URL: 'https://api.epicgames.dev/epic/oauth/v2/userInfo',
  SCOPE: 'basic_profile',
};

async function epicExchange(env, code) {
  const clientId = env.EPIC_OAUTH_CLIENT_ID;
  const clientSecret = env.EPIC_OAUTH_CLIENT_SECRET;
  const redirect = env.EPIC_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirect) {
    throw { status: 500, msg: 'Connexion Epic non configurée (client id/secret/redirect — voir README).' };
  }
  const tokenUrl = env.EPIC_TOKEN_URL || OAUTH_DEFAULTS.TOKEN_URL;
  const body = 'grant_type=authorization_code&code=' + encodeURIComponent(code) +
    '&redirect_uri=' + encodeURIComponent(redirect);
  let res;
  try {
    res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(clientId + ':' + clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
    });
  } catch (e) { throw { status: 502, msg: "Échange OAuth impossible (contact Epic)." }; }
  const text = await res.text();
  let tok = null;
  try { tok = JSON.parse(text); } catch (e) { /* non-JSON */ }
  if (!res.ok || !tok) throw { status: 401, msg: 'Connexion Epic refusée : ' + text.slice(0, 150) };

  const accountId = tok.account_id || tok.sub || tok.accountId;
  let displayName = tok.displayName || tok.display_name || '';
  const accessToken = tok.access_token;
  if (!displayName && accessToken) {
    try {
      const ir = await fetch(env.EPIC_ACCOUNT_URL || OAUTH_DEFAULTS.ACCOUNT_URL, { headers: { Authorization: 'Bearer ' + accessToken } });
      const itxt = await ir.text();
      let info = null;
      try { info = JSON.parse(itxt); } catch (e) { /* non-JSON */ }
      if (info) displayName = info.displayName || info.display_name || info.preferred_username || info.name || '';
    } catch (e) { /* ignore */ }
  }
  if (!accountId) throw { status: 502, msg: 'Réponse OAuth Epic inattendue (identifiant de compte manquant).' };
  return { accountId: String(accountId), displayName: displayName };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    if (!env.LEADERBOARD) return json(env, { error: 'KV "LEADERBOARD" non configuré (voir README).' }, 500);

    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '') {
      return json(env, { ok: true, message: 'Classement opérationnel.' });
    }

    if (url.pathname === '/submit' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json(env, { error: 'Corps JSON invalide.' }, 400); }
      const inName = cleanText(body.name, MAX_NAME);
      const platform = (cleanText(body.platform, 8) || 'epic').toLowerCase();
      if (!inName) return json(env, { error: 'Pseudo Epic requis.' }, 400);

      // Anti-triche : on récupère les VRAIES stats via Epic et on calcule le score ici.
      let v;
      try {
        v = await fetchEpicStats(env, inName, platform);
      } catch (e) {
        return json(env, { error: e.msg || 'Vérification Epic échouée.' }, e.status || 400);
      }

      const board = await readBoard(env);
      // Anti-usurpation : un pseudo réservé via connexion Epic ne peut pas être écrasé par /submit.
      const claimed = Object.values(board).some((e) => e.epicVerified && (e.name || '').toLowerCase() === v.name.toLowerCase());
      if (claimed) return json(env, { error: 'Ce pseudo est réservé par un joueur connecté avec Epic. Connecte-toi avec Epic pour le revendiquer.' }, 409);

      const score = Math.round(v.kills + v.wins * WIN_BONUS);
      const entry = {
        name: v.name,
        score: score,
        kills: v.kills,
        wins: v.wins,
        matches: v.matches,
        rank: rankNameFor(score),
        verified: true,
        epicVerified: false,
        ts: Date.now(),
      };
      board[v.name.toLowerCase()] = entry;
      await env.LEADERBOARD.put('board', JSON.stringify(board));
      return json(env, { ok: true, entry: entry });
    }

    // Config publique pour construire l'URL de connexion Epic côté navigateur.
    if (url.pathname === '/epic/config' && request.method === 'GET') {
      return json(env, {
        clientId: env.EPIC_OAUTH_CLIENT_ID || '',
        redirectUri: env.EPIC_REDIRECT_URI || '',
        authorizeUrl: env.EPIC_AUTHORIZE_URL || OAUTH_DEFAULTS.AUTHORIZE_URL,
        scope: env.EPIC_SCOPE || OAUTH_DEFAULTS.SCOPE,
        configured: !!(env.EPIC_OAUTH_CLIENT_ID && env.EPIC_REDIRECT_URI),
      });
    }

    // Retour de connexion Epic : échange le code, vérifie l'identité, publie le score.
    if (url.pathname === '/epic/publish' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json(env, { error: 'Corps JSON invalide.' }, 400); }
      const code = cleanText(body.code, 512);
      if (!code) return json(env, { error: "Code d'autorisation manquant." }, 400);

      let identity;
      try { identity = await epicExchange(env, code); } catch (e) { return json(env, { error: e.msg || 'Connexion Epic échouée.' }, e.status || 400); }
      const dispName = cleanText(identity.displayName, MAX_NAME);
      if (!dispName) return json(env, { error: 'Nom de compte Epic introuvable.' }, 502);

      // Récupère les vraies stats (score calculé serveur), identité certifiée par Epic.
      let v;
      try { v = await fetchEpicStats(env, dispName, 'epic'); } catch (e) { return json(env, { error: e.msg || 'Stats indisponibles.' }, e.status || 400); }

      const score = Math.round(v.kills + v.wins * WIN_BONUS);
      const entry = {
        name: v.name, accountId: identity.accountId,
        score: score, kills: v.kills, wins: v.wins, matches: v.matches,
        rank: rankNameFor(score), verified: true, epicVerified: true, ts: Date.now(),
      };
      const board = await readBoard(env);
      // Nettoie une éventuelle entrée non certifiée au même nom, puis stocke par compte Epic.
      const dupKey = (v.name || '').toLowerCase();
      if (board[dupKey] && !board[dupKey].epicVerified) delete board[dupKey];
      board['epic:' + identity.accountId] = entry;
      await env.LEADERBOARD.put('board', JSON.stringify(board));
      return json(env, { ok: true, entry: entry });
    }

    if (url.pathname === '/top' && request.method === 'GET') {
      const limit = Math.min(100, Math.max(1, num(url.searchParams.get('limit')) || 50));
      const board = await readBoard(env);
      // Dédoublonnage par pseudo : on privilégie les comptes certifiés Epic, puis le meilleur score.
      const byName = {};
      Object.values(board).forEach((e) => {
        const k = (e.name || '').toLowerCase();
        const cur = byName[k];
        if (!cur || (e.epicVerified && !cur.epicVerified) || (e.epicVerified === cur.epicVerified && (e.score || 0) > (cur.score || 0))) {
          byName[k] = e;
        }
      });
      const players = Object.values(byName)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);
      return json(env, { count: players.length, players: players });
    }

    return json(env, { error: 'Route inconnue.' }, 404);
  },
};
