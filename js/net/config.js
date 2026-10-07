/* Public cloud-save configuration (browser-safe values only).
 * `key` is the Supabase PUBLISHABLE / anon key: it is designed to be public; every table is protected by
 * Row Level Security, so a player can only ever read or write their own saves. Never put a service_role /
 * secret key here. Leave both fields empty to ship a local-only build. */
(function (TE) {
  'use strict';
  TE.CloudConfig = {
    url: '',
    key: '',
  };
})(window.TE);
