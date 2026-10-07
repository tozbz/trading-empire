/* TRADING EMPIRE — namespace bootstrap.
 * Everything lives under a single global: window.TE
 * Scripts are classic (non-module) so the game runs straight from file://
 */
(function () {
  'use strict';
  const TE = (window.TE = window.TE || {});
  TE.VERSION = '2.1.1'; // 2.1: web distribution (PWA, offline, cloud save), same save format v2 · 2.1.1: UI / contract fixes
  TE.SAVE_VERSION = 2;
  TE.Data = TE.Data || {};
  TE.UI = TE.UI || {};
  TE.UI.views = TE.UI.views || {};
  TE.state = null; // live game state, set at boot
})();
