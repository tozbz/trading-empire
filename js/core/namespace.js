/* TRADING EMPIRE — namespace bootstrap.
 * Everything lives under a single global: window.TE
 * Scripts are classic (non-module) so the game runs straight from file://
 */
(function () {
  'use strict';
  const TE = (window.TE = window.TE || {});
  TE.VERSION = '2.0.0'; // 2.0: living financial world (save format v2, v1 saves migrate automatically)
  TE.SAVE_VERSION = 2;
  TE.Data = TE.Data || {};
  TE.UI = TE.UI || {};
  TE.UI.views = TE.UI.views || {};
  TE.state = null; // live game state, set at boot
})();
