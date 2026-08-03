/* Installation multi-plateforme (Android / PC / iOS) + enregistrement du service worker. */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const isHttp = location.protocol.startsWith('http');

  /* --- Enregistrement du service worker (mode hors-ligne + installable) --- */
  if ('serviceWorker' in navigator && isHttp) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
    });
  }

  /* --- Détection de l'état "déjà installé" --- */
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  /* --- Détection iOS (y compris iPad qui se présente comme un Mac tactile) --- */
  function isIOS() {
    const ua = navigator.userAgent || '';
    const iOSDevice = /iPad|iPhone|iPod/.test(ua);
    const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return iOSDevice || iPadOS;
  }

  let deferredPrompt = null;

  function showInstallBtn() {
    const btn = $('#installBtn');
    if (btn && !isStandalone()) btn.classList.remove('hidden');
  }
  function hideInstallBtn() {
    const btn = $('#installBtn');
    if (btn) btn.classList.add('hidden');
  }

  // Android / Chrome / Edge : événement natif d'installation.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBtn();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallBtn();
  });

  function init() {
    const btn = $('#installBtn');
    if (!btn) return;

    // Sur iOS, pas d'événement natif : on propose quand même l'installation manuelle.
    if (isIOS() && !isStandalone()) showInstallBtn();

    btn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch (e) { /* ignore */ }
        deferredPrompt = null;
        hideInstallBtn();
      } else if (isIOS()) {
        const help = $('#iosHelp');
        if (help) help.classList.remove('hidden');
      } else {
        alert("Pour installer : ouvre le menu de ton navigateur (⋮) puis choisis « Installer l'application » ou « Ajouter à l'écran d'accueil ».");
      }
    });

    const close = $('#iosClose');
    if (close) close.addEventListener('click', () => $('#iosHelp').classList.add('hidden'));

    if (isStandalone()) hideInstallBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
