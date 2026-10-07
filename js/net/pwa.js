/* PWA shell: service worker registration, discreet "new version" banner, install button.
 * Distribution only — no gameplay code. Does nothing on file:// (the game keeps working there as before). */
(function (TE) {
  'use strict';
  const P = (TE.PWA = { reg: null, waiting: null, installEvt: null, installed: false });
  P.supported = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
  P.standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  function showUpdate(worker) {
    P.waiting = worker;
    if (document.getElementById('pwa-update')) return;
    const el = document.createElement('div');
    el.id = 'pwa-update';
    el.className = 'pwa-update';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="pwa-u-t">NOUVELLE VERSION DISPONIBLE</span><button type="button" class="pwa-u-go">ACTUALISER</button><button type="button" class="pwa-u-x" aria-label="Plus tard">×</button>';
    el.querySelector('.pwa-u-go').addEventListener('click', P.applyUpdate);
    el.querySelector('.pwa-u-x').addEventListener('click', () => el.remove());
    document.body.appendChild(el);
  }

  /** Reload into the new version — only when the player asks, never during a prestige animation. */
  P.applyUpdate = function () {
    if (document.querySelector('canvas.of-dissolve')) { setTimeout(P.applyUpdate, 1500); return; }
    try { if (TE.state && TE.Save && !TE.Save.disabled) TE.Save.save(true); } catch (e) { /* keep going */ }
    const w = P.waiting || (P.reg && P.reg.waiting);
    if (!w) { location.reload(); return; }
    let done = false;
    const go = () => { if (!done) { done = true; location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', go);
    w.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(go, 4000);
  };

  function track(reg) {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); });
    });
  }

  if (P.supported) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js', { scope: './' }).then((reg) => {
        P.reg = reg;
        track(reg);
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      }).catch((e) => console.warn('[PWA] service worker non enregistré :', e && e.message));
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); P.installEvt = e; if (TE.Bus) TE.Bus.emit('pwa:installable'); });
  window.addEventListener('appinstalled', () => { P.installEvt = null; P.installed = true; if (TE.Bus) TE.Bus.emit('pwa:installed'); });
  P.canInstall = () => !!P.installEvt;
  P.install = async function () {
    if (!P.installEvt) return false;
    const evt = P.installEvt;
    evt.prompt();
    const r = await evt.userChoice.catch(() => null);
    P.installEvt = null;
    return !!(r && r.outcome === 'accepted');
  };
  /** Settings card: install the app, offline readiness, versions. */
  P.card = function () {
    const UI = TE.UI, h = UI.h;
    const card = h('div', { class: 'card', id: 'pwa-card' });
    const render = () => {
      card.innerHTML = '';
      card.appendChild(h('div', { class: 'card-h' }, [h('span', { text: 'Application' })]));
      const offline = P.supported && !!navigator.serviceWorker.controller;
      card.appendChild(h('div', { class: 'set-row' }, [h('span', { text: 'Installation' }), h('b', { text: P.standalone() ? 'Application installée' : P.canInstall() ? 'Installable' : 'Navigateur' })]));
      card.appendChild(h('div', { class: 'set-row' }, [h('span', { text: 'Jeu hors ligne' }), h('b', { class: offline ? 'up' : 'dim', text: offline ? 'Disponible sur cet appareil' : (P.supported ? 'Prêt après le prochain chargement' : 'Indisponible (fichier local)') })]));
      const ver = h('span', { class: 'dim', text: 'v' + TE.VERSION });
      card.appendChild(h('div', { class: 'set-row' }, [h('span', { text: 'Version' }), ver]));
      P.build().then((b) => { if (b && b.indexOf('__') !== 0) ver.textContent = 'v' + TE.VERSION + ' · build ' + b; });
      const row = h('div', { class: 'btn-row' });
      if (P.canInstall()) row.appendChild(h('button', { class: 'btn btn-primary', text: 'INSTALLER L’APPLICATION', on: { click: async () => { await P.install(); render(); } } }));
      if (P.supported) row.appendChild(h('button', { class: 'btn btn-ghost', text: 'Rechercher une mise à jour', on: { click: async () => {
        if (!P.reg) return;
        try { await P.reg.update(); } catch (e) { /* offline */ }
        setTimeout(() => { if (!(P.reg && (P.reg.waiting || P.reg.installing))) UI.toast({ text: 'Vous avez la dernière version.', kind: 'ok', icon: '✓' }); }, 1500);
      } } }));
      if (row.children.length) card.appendChild(row);
      if (!P.standalone() && !P.canInstall()) card.appendChild(h('div', { class: 'dim small', text: 'iPhone / iPad : bouton Partager → « Sur l’écran d’accueil ». Android / PC : menu du navigateur → « Installer l’application ».' }));
    };
    render();
    if (TE.Bus) { TE.Bus.on('pwa:installable', () => { if (card.isConnected) render(); }); TE.Bus.on('pwa:installed', () => { if (card.isConnected) render(); }); }
    return card;
  };

  /** Build id of the active service worker (for the settings panel). */
  P.build = function () {
    return new Promise((resolve) => {
      const c = P.supported && navigator.serviceWorker.controller;
      if (!c) { resolve(null); return; }
      const t = setTimeout(() => resolve(null), 800);
      navigator.serviceWorker.addEventListener('message', function on(ev) {
        if (ev.data && ev.data.type === 'BUILD') { clearTimeout(t); navigator.serviceWorker.removeEventListener('message', on); resolve(ev.data.build); }
      });
      c.postMessage({ type: 'GET_BUILD' });
    });
  };
})(window.TE);
