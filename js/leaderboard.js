/* Communication avec le backend du classement (Cloudflare Worker). */
(function (global) {
  'use strict';

  const clean = (u) => (u || '').trim().replace(/\/+$/, '');

  async function submit(backendUrl, payload) {
    const base = clean(backendUrl);
    if (!base) throw new Error('URL du backend manquante.');
    let res;
    try {
      res = await fetch(base + '/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error('Backend injoignable (URL incorrecte, non déployé, ou bloqué).');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok || !data || data.ok !== true) {
      throw new Error((data && data.error) || ('HTTP ' + res.status));
    }
    return data;
  }

  async function top(backendUrl, limit) {
    const base = clean(backendUrl);
    if (!base) throw new Error('URL du backend manquante.');
    let res;
    try {
      res = await fetch(base + '/top?limit=' + (limit || 50));
    } catch (e) {
      throw new Error('Backend injoignable.');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return (data && data.players) || [];
  }

  global.Leaderboard = { submit, top };
})(window);
