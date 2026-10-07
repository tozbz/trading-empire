/* Tiny publish/subscribe bus used to decouple simulation and UI. */
(function (TE) {
  'use strict';
  const handlers = {};
  TE.Bus = {
    on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); return fn; },
    off(evt, fn) { const l = handlers[evt]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    emit(evt, data) {
      const l = handlers[evt];
      if (!l) return;
      for (let i = 0; i < l.length; i++) {
        try { l[i](data); } catch (e) { console.error('[Bus]', evt, e); }
      }
    },
  };
})(window.TE);
