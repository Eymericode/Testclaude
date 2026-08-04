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
      const name = cleanText(body.name, MAX_NAME);
      if (!name) return json(env, { error: 'Pseudo requis.' }, 400);

      const entry = {
        name: name,
        score: num(body.score),
        kills: num(body.kills),
        wins: num(body.wins),
        matches: num(body.matches),
        rank: cleanText(body.rank, 20),
        ts: Date.now(),
      };
      const board = await readBoard(env);
      board[name.toLowerCase()] = entry; // une entrée par pseudo (insensible à la casse)
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
