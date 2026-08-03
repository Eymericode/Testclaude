/*
 * Proxy sécurisé vers l'API officielle Fortnite Ecosystem (Epic Games).
 *
 * Rôle : garder le client_secret côté serveur (jamais dans le navigateur),
 * gérer l'authentification OAuth2 (client_credentials) et transmettre les
 * requêtes à l'API Epic en ajoutant le jeton d'accès, avec les en-têtes CORS
 * nécessaires pour que l'app puisse l'appeler depuis le navigateur.
 *
 * Déploiement : Cloudflare Workers (voir README.md).
 *
 * Secrets à définir (wrangler secret put …) :
 *   - EPIC_CLIENT_ID
 *   - EPIC_CLIENT_SECRET
 * Variables optionnelles (wrangler.toml [vars]) :
 *   - ALLOW_ORIGIN    (origine autorisée, ex: https://eymericode.github.io)
 *   - EPIC_TOKEN_URL  (surcharge de l'URL du jeton OAuth, si la doc diffère)
 *   - EPIC_API_BASE   (surcharge de la base de l'API Ecosystem)
 */

const DEFAULTS = {
  // ⚠️ Valeurs par défaut — vérifie-les dans la doc officielle Epic et surcharge
  //    via wrangler.toml si nécessaire (EPIC_TOKEN_URL / EPIC_API_BASE).
  TOKEN_URL: 'https://api.epicgames.dev/epic/oauth/v2/token',
  // Base SANS numéro de version : le chemin que tu passes (ex: /v1/stats/...)
  // contrôle la version, ce qui évite tout doublon.
  API_BASE: 'https://api.fortnite.com/ecosystem',
};

// Cache du jeton dans l'isolat du Worker (évite un échange OAuth à chaque appel).
let cachedToken = null; // { value, expiresAt }

function b64(str) {
  // btoa est disponible dans l'environnement Workers.
  return btoa(str);
}

async function getToken(env) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30000) return cachedToken.value;

  const tokenUrl = env.EPIC_TOKEN_URL || DEFAULTS.TOKEN_URL;
  const clientId = env.EPIC_CLIENT_ID;
  const clientSecret = env.EPIC_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('EPIC_CLIENT_ID / EPIC_CLIENT_SECRET non configurés (voir README).');
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + b64(clientId + ':' + clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error('OAuth ' + res.status + ' : ' + text.slice(0, 300));
  }
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Réponse OAuth non-JSON : ' + text.slice(0, 200)); }

  const ttl = data.expires_in ? data.expires_in * 1000 : 3600000;
  cachedToken = { value: data.access_token, expiresAt: now + ttl };
  return cachedToken.value;
}

function corsHeaders(env, extra) {
  return Object.assign(
    {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
    extra || {}
  );
}

function json(env, obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: corsHeaders(env, { 'Content-Type': 'application/json; charset=utf-8' }),
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    // Point de santé : GET / → vérifie que le backend et l'OAuth fonctionnent.
    if (url.pathname === '/' || url.pathname === '') {
      try {
        await getToken(env);
        return json(env, { ok: true, message: 'Backend Epic opérationnel (OAuth OK).', apiBase: env.EPIC_API_BASE || DEFAULTS.API_BASE });
      } catch (e) {
        return json(env, { ok: false, error: e.message }, 500);
      }
    }

    // Proxy authentifié : tout ce qui suit /api est transmis à l'API Epic.
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.slice('/api'.length) + url.search; // ex: /v1/... ?name=...
      try {
        const token = await getToken(env);
        const base = env.EPIC_API_BASE || DEFAULTS.API_BASE;
        const upstream = base.replace(/\/$/, '') + path;
        const res = await fetch(upstream, { headers: { Authorization: 'Bearer ' + token } });
        const body = await res.text();
        return new Response(body, {
          status: res.status,
          headers: corsHeaders(env, {
            'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
          }),
        });
      } catch (e) {
        return json(env, { error: e.message }, 502);
      }
    }

    return json(env, { error: 'Route inconnue. Utilise GET / (santé) ou /api/<endpoint Epic>.' }, 404);
  },
};
