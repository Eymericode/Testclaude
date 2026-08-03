/* Données Fortnite en direct via l'API publique fortnite-api.com.
   - Actualités et carte : accès libre (sans clé).
   - Boutique du jour : nécessite une clé API (réutilise celle saisie dans l'onglet Données/API). */
(function (global) {
  'use strict';

  const APIKEY_STORE = 'fortnite-tracker-apikey';
  const LANG = 'fr';
  const $ = (s) => document.querySelector(s);

  const getKey = () => (localStorage.getItem(APIKEY_STORE) || '').trim();

  async function getJSON(url, headers) {
    const res = await fetch(url, headers ? { headers } : undefined);
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  /* ---------- Récupération ---------- */
  async function fetchNews() {
    const json = await getJSON(`https://fortnite-api.com/v2/news/br?language=${LANG}`);
    const data = json.data || {};
    return data.motds || (data.news && data.news.motds) || [];
  }

  async function fetchMap() {
    const json = await getJSON(`https://fortnite-api.com/v1/map?language=${LANG}`);
    const data = json.data || {};
    return data.pois || [];
  }

  async function fetchShop() {
    const key = getKey();
    if (!key) {
      const e = new Error('NO_KEY');
      e.code = 'NO_KEY';
      throw e;
    }
    const json = await getJSON(`https://fortnite-api.com/v2/shop/br?language=${LANG}`, { Authorization: key });
    const data = json.data || {};
    // Structure défensive : selon la version, les entrées sont regroupées différemment.
    let entries = data.entries || [];
    if (!entries.length) {
      ['featured', 'daily', 'specialFeatured', 'specialDaily'].forEach((k) => {
        if (data[k] && Array.isArray(data[k].entries)) entries = entries.concat(data[k].entries);
      });
    }
    return entries;
  }

  /* ---------- Rendu ---------- */
  function imgOf(item) {
    const im = item && item.images;
    return (im && (im.icon || im.featured || im.smallIcon)) || '';
  }

  function renderShop(entries) {
    const box = $('#liveShop');
    const msg = $('#liveShopMsg');
    msg.textContent = '';
    const cards = [];
    entries.slice(0, 24).forEach((entry) => {
      const items = entry.items || (entry.bundle ? [] : []);
      const item = items[0];
      const name = (entry.bundle && entry.bundle.name) || (item && item.name) || entry.devName || 'Article';
      const img = (entry.newDisplayAsset && '') || imgOf(item) || (entry.bundle && entry.bundle.image) || '';
      const price = entry.finalPrice != null ? entry.finalPrice : entry.regularPrice;
      const rarity = item && item.rarity ? item.rarity.displayValue : '';
      cards.push(`<div class="live-card">
        ${img ? `<img src="${img}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
        <div class="body">
          <div class="rarity">${escapeHtml(rarity)}</div>
          <div class="name">${escapeHtml(name)}</div>
          ${price != null ? `<div class="price">${price} V-Bucks</div>` : ''}
        </div>
      </div>`);
    });
    box.innerHTML = cards.join('') || '<p class="live-loading">Aucun article trouvé.</p>';
  }

  function renderNews(motds) {
    const box = $('#liveNews');
    const cards = motds.slice(0, 8).map((n) => `<div class="live-card news-card">
      ${n.image ? `<img src="${n.image}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
      <div class="body">
        <div class="name">${escapeHtml(n.title || '')}</div>
        <div class="rarity" style="text-transform:none">${escapeHtml(n.body || '')}</div>
      </div>
    </div>`);
    box.innerHTML = cards.join('') || '<p class="live-loading">Pas d\'actualité pour le moment.</p>';
  }

  function renderMap(pois) {
    const box = $('#liveMap');
    const named = pois.filter((p) => p.name && p.name.trim());
    box.innerHTML = named.map((p) => `<span class="poi">📍 ${escapeHtml(p.name)}</span>`).join('')
      || '<p class="live-loading">Carte indisponible.</p>';
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function errorBox(container, message) {
    $(container).innerHTML = `<div class="live-card live-error"><div class="body"><div class="name">⚠️ Erreur</div><div class="rarity" style="text-transform:none">${escapeHtml(message)}</div></div></div>`;
  }

  /* ---------- Orchestration ---------- */
  let loading = false;
  async function refresh() {
    if (loading) return;
    loading = true;
    const btn = $('#refreshLive');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Chargement…'; }

    $('#liveNews').innerHTML = '<p class="live-loading">Chargement des actualités…</p>';
    $('#liveMap').innerHTML = '<p class="live-loading">Chargement de la carte…</p>';
    $('#liveShop').innerHTML = '<p class="live-loading">Chargement de la boutique…</p>';

    // Chaque bloc est indépendant : une erreur n'empêche pas les autres.
    await Promise.allSettled([
      fetchNews().then(renderNews).catch(() => errorBox('#liveNews', 'Actualités indisponibles (connexion ou API).')),
      fetchMap().then(renderMap).catch(() => errorBox('#liveMap', 'Carte indisponible.')),
      fetchShop().then(renderShop).catch((e) => {
        $('#liveShop').innerHTML = '';
        if (e.code === 'NO_KEY') {
          $('#liveShopMsg').innerHTML = '🔑 Pour voir la boutique du jour, ajoute ta clé API dans l\'onglet <strong>Données / API</strong> (gratuite). Les actualités et la carte fonctionnent sans clé.';
        } else if (e.status === 401 || e.status === 403) {
          $('#liveShopMsg').textContent = 'Clé API invalide pour la boutique.';
        } else {
          $('#liveShopMsg').textContent = 'Boutique indisponible pour le moment.';
        }
      }),
    ]);

    $('#liveUpdated').textContent = 'Dernière mise à jour : ' + new Date().toLocaleTimeString('fr-FR');
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Actualiser'; }
    loading = false;
  }

  function init() {
    if (!$('#refreshLive')) return;
    $('#refreshLive').addEventListener('click', refresh);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.LiveData = { refresh };
})(window);
