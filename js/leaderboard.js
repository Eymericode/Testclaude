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

  /* Récupère la config OAuth Epic depuis le backend (pour construire l'URL de connexion). */
  async function epicConfig(backendUrl) {
    const base = clean(backendUrl);
    if (!base) throw new Error('URL du backend manquante.');
    let res;
    try { res = await fetch(base + '/epic/config'); }
    catch (e) { throw new Error('Backend injoignable.'); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok || !data) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }

  /* Envoie le code d'autorisation Epic au backend, qui vérifie l'identité et publie. */
  async function epicPublish(backendUrl, code) {
    const base = clean(backendUrl);
    if (!base) throw new Error('URL du backend manquante.');
    let res;
    try {
      res = await fetch(base + '/epic/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code }),
      });
    } catch (e) { throw new Error('Backend injoignable.'); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok || !data || data.ok !== true) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }

  global.Leaderboard = { submit, top, epicConfig, epicPublish };
})(window);
