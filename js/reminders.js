/* Rappels des jours de jeu via les notifications du navigateur.
   Fonctionne quand l'app est ouverte (onglet actif ou en arrière-plan) ou
   installée en PWA. Requiert : permission accordée + site servi en http/https. */
(function (global) {
  'use strict';

  const KEY = 'fortnite-tracker-reminders';
  const LAST_KEY = 'fortnite-tracker-last-notif';
  const CHECK_INTERVAL = 30000; // 30 s

  let settings = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : { days: [], time: '19:00', message: '', enabled: false };
    } catch (e) {
      return { days: [], time: '19:00', message: '', enabled: false };
    }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }
  const getLast = () => localStorage.getItem(LAST_KEY);
  const setLast = (v) => localStorage.setItem(LAST_KEY, v);
  const todayStr = (d) => {
    const x = d || new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* Décision pure : faut-il notifier maintenant ? (testable) */
  function shouldNotify(now, s, last) {
    if (!s || !s.enabled) return false;
    if (!Array.isArray(s.days) || !s.days.includes(now.getDay())) return false;
    const parts = (s.time || '19:00').split(':');
    const target = new Date(now);
    target.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
    if (now < target) return false;
    if (last === todayStr(now)) return false;
    return true;
  }

  const supported = () => 'Notification' in global;

  async function showNotif(title, opts) {
    if (!supported() || Notification.permission !== 'granted') return false;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) {
          await reg.showNotification(title, opts);
          return true;
        }
      }
    } catch (e) { /* on retombe sur l'API simple */ }
    try {
      new Notification(title, opts);
      return true;
    } catch (e) {
      return false;
    }
  }

  function fire() {
    const title = '🎯 Fortnite Stats Tracker';
    const body = settings.message && settings.message.trim()
      ? settings.message.trim()
      : "C'est ton jour de jeu ! Pense à noter tes matchs et à viser ton objectif de la semaine 💪";
    showNotif(title, { body, icon: 'icon.svg', badge: 'icon.svg', tag: 'fn-daily' });
    setLast(todayStr());
  }

  function check() {
    if (shouldNotify(new Date(), settings, getLast())) fire();
  }

  async function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* ignore */ }
    }
  }

  /* ---------- Rendu / UI ---------- */
  function renderStatus() {
    const box = $('#reminderStatus');
    if (!box) return;
    const perm = supported() ? Notification.permission : 'unsupported';
    let line;
    if (!settings.enabled) {
      line = `<div class="status-line off">⚪ Rappels désactivés.</div>`;
    } else if (perm === 'granted') {
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const list = settings.days.slice().sort().map((d) => dayNames[d]).join(', ') || 'aucun jour';
      line = `<div class="status-line on">🟢 Rappels actifs — ${list} à ${settings.time}.</div>`;
    } else {
      line = `<div class="status-line off">🟠 Rappels activés mais notifications non autorisées.</div>`;
    }
    box.innerHTML = line;

    // Bannière d'information sur le contexte
    const banner = $('#notifBanner');
    if (banner) {
      let msg = '';
      if (!supported()) {
        msg = 'Ton navigateur ne supporte pas les notifications.';
      } else if (location.protocol === 'file:') {
        msg = "⚠️ Tu as ouvert l'app en local (file://). Les notifications nécessitent un site en http/https (ex. GitHub Pages, ou lance un petit serveur local). Voir le README.";
      } else if (Notification.permission === 'denied') {
        msg = 'Les notifications sont bloquées pour ce site. Ré-autorise-les dans les paramètres du navigateur.';
      }
      banner.textContent = msg;
      banner.classList.toggle('hidden', !msg);
    }
  }

  function readForm() {
    settings.days = $$('#dayPicker input:checked').map((i) => Number(i.value));
    settings.time = $('#reminderTime').value || '19:00';
    settings.message = $('#reminderMessage').value || '';
  }

  function fillForm() {
    $$('#dayPicker input').forEach((i) => { i.checked = settings.days.includes(Number(i.value)); });
    $('#reminderTime').value = settings.time || '19:00';
    $('#reminderMessage').value = settings.message || '';
  }

  async function enable(e) {
    if (e) e.preventDefault();
    readForm();
    if (!settings.days.length) {
      alert('Choisis au moins un jour de jeu.');
      return;
    }
    if (!supported()) {
      renderStatus();
      return;
    }
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    settings.enabled = true;
    save();
    if (perm === 'granted') {
      await registerSW();
      check();
    }
    renderStatus();
  }

  function disable() {
    settings.enabled = false;
    save();
    renderStatus();
  }

  async function test() {
    if (!supported()) { alert("Ton navigateur ne supporte pas les notifications."); return; }
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    if (perm !== 'granted') { renderStatus(); return; }
    await registerSW();
    await showNotif('🎯 Test — Fortnite Stats Tracker', {
      body: 'Parfait, les notifications fonctionnent ! 🎮',
      icon: 'icon.svg',
      tag: 'fn-test',
    });
  }

  function init() {
    if (!$('#reminderForm')) return; // panneau absent
    fillForm();
    renderStatus();
    $('#reminderForm').addEventListener('submit', enable);
    $('#disableReminders').addEventListener('click', disable);
    $('#testNotif').addEventListener('click', test);

    // Planificateur : vérifie à l'ouverture, périodiquement, et au retour sur l'onglet
    check();
    setInterval(check, CHECK_INTERVAL);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposé pour les tests
  global.Reminders = { shouldNotify, todayStr };
})(window);
