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

      const score = Math.round(v.kills + v.wins * WIN_BONUS);
      const entry = {
        name: v.name,
        score: score,
        kills: v.kills,
        wins: v.wins,
        matches: v.matches,
        rank: rankNameFor(score),
        verified: true,
        ts: Date.now(),
      };
      const board = await readBoard(env);
      board[v.name.toLowerCase()] = entry; // une entrée par compte Epic (insensible à la casse)
      await env.LEADERBOARD.put('board', JSON.stringify(board));
      return json(env, { ok: true, entry: entry });
    }

    if (url.pathname === '/top' && request.method === 'GET') {
      const limit = Math.min(100, Math.max(1, num(url.searchParams.get('limit')) || 50));
      const board = await readBoard(env);
      const players = Object.values(board)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);
      return json(env, { count: players.length, players: players });
    }

    return json(env, { error: 'Route inconnue.' }, 404);
  },
};
