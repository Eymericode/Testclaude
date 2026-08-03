/* Intégration optionnelle avec l'API publique fortnite-api.com.
   Nécessite une clé gratuite (https://dash.fortnite-api.com) et un compte Epic
   dont les stats sont publiques (Paramètres Epic → Confidentialité). */
(function (global) {
  const BASE = 'https://fortnite-api.com/v2/stats/br/v2';

  async function fetchStats({ apiKey, name, platform }) {
    if (!apiKey) throw new Error('Clé API manquante.');
    if (!name) throw new Error('Pseudo Epic manquant.');

    const url = `${BASE}?name=${encodeURIComponent(name)}&accountType=${encodeURIComponent(platform || 'epic')}`;
    const res = await fetch(url, { headers: { Authorization: apiKey } });

    if (res.status === 401 || res.status === 403) throw new Error('Clé API invalide ou non autorisée.');
    if (res.status === 404) throw new Error("Joueur introuvable ou stats privées. Rends tes stats publiques dans les paramètres Epic.");
    if (!res.ok) throw new Error(`Erreur API (${res.status}).`);

    const json = await res.json();
    return normalize(json.data);
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

  global.FortniteAPI = { fetchStats };
})(window);
