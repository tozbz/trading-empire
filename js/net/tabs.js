/* Save protection across tabs / windows of the same browser (2.1).
 * Two copies of the game open at once used to autosave over each other (last writer wins), which could undo an
 * import, a cloud load or hours of play in the other window. Now:
 *  - when the game starts in one tab, every other running tab pauses and stops saving (one click to take over);
 *  - a tab still on the launch screen reloads the latest save before starting if another tab saved meanwhile;
 *  - replacing the save (import, cloud, restore, reset) tells the other tabs to stop.
 * Distribution / save safety only: the game rules are untouched. */
(function (TE) {
  'use strict';
  const SAVE_KEY = 'tradingEmpire.save.v1';
  const me = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ch = typeof BroadcastChannel === 'function' ? new BroadcastChannel('trading-empire-tabs') : null;
  const T = (TE.Tabs = { started: false, locked: false, stale: false });

  function lock(text) {
    if (T.locked) return;
    T.locked = true;
    if (TE.Save) TE.Save.disabled = true;
    if (TE.Loop) TE.Loop.paused = true;
    const show = () => {
      if (!TE.UI || !TE.UI.modal || !document.getElementById('modal-root')) return;
      TE.UI.modal({
        title: '<span class="up">PARTIE OUVERTE AILLEURS</span>', cls: 'modal-sm', locked: true,
        body: '<p>' + text + '</p><p class="dim small">Cet onglet est en pause et n’enregistre plus rien, pour ne pas écraser votre sauvegarde.</p>',
        buttons: [{ label: 'JOUER DANS CET ONGLET', cls: 'btn-primary', onClick: () => { location.reload(); return true; } }],
      });
    };
    show();
  }
  function onMessage(d) {
    if (!d || d.from === me) return;
    if (d.type === 'started') {
      if (T.started) lock('Le jeu vient d’être ouvert dans un autre onglet ou une autre fenêtre.');
      else T.stale = true;
    } else if (d.type === 'replaced') {
      if (T.started) lock('La sauvegarde a été remplacée dans un autre onglet (import, cloud ou restauration).');
      else T.stale = true;
    }
  }
  if (ch) ch.onmessage = (e) => onMessage(e.data);
  // fallback (and extra safety): another document wrote the save
  window.addEventListener('storage', (e) => {
    if (e.key !== SAVE_KEY && e.key !== null) return;
    if (T.started) lock('Une autre fenêtre du jeu enregistre la partie en même temps.');
    else T.stale = true;
  });

  T.markStarted = function () {
    T.started = true;
    if (ch) ch.postMessage({ type: 'started', from: me });
  };
  T.replaced = function () {
    if (ch) ch.postMessage({ type: 'replaced', from: me });
  };
})(window.TE);
