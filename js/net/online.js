/* Live player counter (2.2). Each running game sends an anonymous heartbeat every minute: a random id created for
 * this page load only — no account, no device data. The server keeps it 10 minutes and answers with the number of
 * games seen in the last 2 minutes. Nothing is sent while the game is hidden, offline, paused in another tab or
 * still on the launch screen. */
(function (TE) {
  'use strict';
  const cfg = TE.CloudConfig || {};
  const O = (TE.Online = { count: null });
  if (!cfg.url || !cfg.key || !/^https?:$/.test(location.protocol)) return;
  const sid = window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  let last = 0;

  function render() {
    const host = document.querySelector('#status .st-r');
    if (!host || O.count === null) return;
    let el = document.getElementById('st-online');
    if (!el) {
      el = document.createElement('span');
      el.id = 'st-online';
      el.className = 'st-online';
      el.title = 'Parties ouvertes en ce moment (compteur anonyme)';
      host.insertBefore(el, host.firstChild);
    }
    el.textContent = '● ' + O.count + ' en ligne';
  }
  async function ping() {
    if (document.hidden || navigator.onLine === false) return;
    if (!TE.Cloud || !TE.Cloud.gameStarted || (TE.Tabs && TE.Tabs.locked)) return;
    last = Date.now();
    try {
      const res = await fetch(cfg.url + '/rest/v1/rpc/te_ping', {
        method: 'POST', cache: 'no-store',
        headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_sid: sid }),
      });
      if (res.ok) { O.count = await res.json(); render(); if (TE.Bus) TE.Bus.emit('online:count', O.count); }
    } catch (e) { /* offline: keep the last value */ }
  }
  setInterval(() => { if (Date.now() - last >= 60000) ping(); else render(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - last > 20000) ping(); });
})(window.TE);
