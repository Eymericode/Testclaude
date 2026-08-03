/* Intégration optionnelle avec l'API publique fortnite-api.com.
   Nécessite une clé gratuite (https://dash.fortnite-api.com) et, pour les stats,
   un compte Epic dont les stats sont publiques (Paramètres Epic → Confidentialité). */
(function (global) {
  const STATS = 'https://fortnite-api.com/v2/stats/br/v2';
  const SHOP = 'https://fortnite-api.com/v2/shop/br';

  /* Requête générique avec gestion fine des erreurs (réseau, CORS, HTTP, message de l'API). */
  async function request(url, apiKey) {
    let res;
    try {
      res = await fetch(url, apiKey ? { headers: { Authorization: apiKey } } : undefined);
    } catch (e) {
      // Échec avant même une réponse HTTP = pas de réseau ou blocage CORS du navigateur.
      throw new Error(
        "Impossible de joindre l'API (pas de connexion internet, ou requête bloquée par le navigateur). " +
        "Ce n'est pas forcément ta clé — réessaie avec une bonne connexion."
      );
    }

    let json = null;
    try { json = await res.json(); } catch (e) { /* corps non-JSON */ }
    const apiMsg = json && (json.error || json.message);

    if (res.ok) return json;

    if (res.status === 401 || res.status === 403) {
      throw new Error('Clé API invalide ou non autorisée' + (apiMsg ? ' — ' + apiMsg : '') + '.');
    }
    if (res.status === 404) {
      throw new Error(apiMsg || 'Joueur introuvable ou stats privées. Rends tes stats publiques (Paramètres Epic → Confidentialité).');
    }
    if (res.status === 429) {
      throw new Error('Trop de requêtes (limite de l\'API atteinte). Réessaie dans une minute.');
    }
    throw new Error('Erreur API ' + res.status + (apiMsg ? ' — ' + apiMsg : '') + '.');
  }

  /* Valide UNIQUEMENT la clé (endpoint boutique : nécessite la clé, pas de pseudo). */
  async function testKey(apiKey) {
    if (!apiKey) throw new Error('Clé API manquante.');
    await request(SHOP + '?language=fr', apiKey);
    return true;
  }

  /* Récupère les stats d'un joueur (nécessite clé + pseudo + stats publiques). */
  async function fetchStats({ apiKey, name, platform }) {
    if (!apiKey) throw new Error('Clé API manquante.');
    if (!name) throw new Error('Pseudo Epic manquant.');

    const url = STATS + '?name=' + encodeURIComponent(name) + '&accountType=' + encodeURIComponent(platform || 'epic');
    const json = await request(url, apiKey);
    const data = (json && json.data) || {};

    if (!data.stats || !data.stats.all || !data.stats.all.overall) {
      throw new Error('Compte trouvé, mais aucune statistique disponible (elles sont probablement privées). Active les stats publiques côté Epic.');
    }
    return normalize(data);
  }

  /* Transforme la réponse de l'API en un résumé simple. */
  function normalize(data) {
    const all = (data && data.stats && data.stats.all && data.stats.all.overall) || {};
    return {
      name: data && data.account ? data.account.name : '',
      matches: all.matches || 0,
      wins: all.wins || 0,
      kills: all.kills || 0,
      deaths: all.deaths || 0,
      kd: all.kd != null ? all.kd : 0,
      winRate: all.winRate != null ? all.winRate : 0,
      killsPerMatch: all.killsPerMatch != null ? all.killsPerMatch : (all.matches ? all.kills / all.matches : 0),
      top1: all.top1 || all.wins || 0,
      top10: all.top10 || 0,
      top25: all.top25 || 0,
      minutesPlayed: all.minutesPlayed || 0,
      score: all.score || 0,
    };
  }

  /* ---------- API officielle Epic via backend (proxy Cloudflare Worker) ---------- */

  function cleanBase(u) {
    return (u || '').trim().replace(/\/+$/, '');
  }

  /* Vérifie que le backend répond et que l'OAuth fonctionne (GET /). */
  async function pingBackend(backendUrl) {
    const base = cleanBase(backendUrl);
    if (!base) throw new Error('URL du backend manquante.');
    let res;
    try {
      res = await fetch(base + '/', { method: 'GET' });
    } catch (e) {
      throw new Error("Backend injoignable (URL incorrecte, non déployé, ou bloqué par le navigateur).");
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok || !data || data.ok !== true) {
      const msg = (data && data.error) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  /* Interroge un endpoint de l'API Epic à travers le backend, et renvoie le JSON brut. */
  async function queryBackend(backendUrl, path) {
    const base = cleanBase(backendUrl);
    if (!base) throw new Error('URL du backend manquante.');
    let p = (path || '').trim();
    if (!p.startsWith('/')) p = '/' + p;
    let res;
    try {
      res = await fetch(base + '/api' + p, { method: 'GET' });
    } catch (e) {
      throw new Error('Backend injoignable.');
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
    if (!res.ok) {
      throw new Error((data && data.error) || ('Erreur ' + res.status), { cause: data });
    }
    return data;
  }

  global.FortniteAPI = { fetchStats, testKey, pingBackend, queryBackend };
})(window);
