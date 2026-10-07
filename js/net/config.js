/* Public cloud-save configuration (browser-safe values only).
 * `key` is the Supabase PUBLISHABLE / anon key: it is designed to be public; every table is protected by
 * Row Level Security, so a player can only ever read or write their own saves. Never put a service_role /
 * secret key here. Leave both fields empty to ship a local-only build. */
(function (TE) {
  'use strict';
  TE.CloudConfig = {
    url: 'https://mxyfsjwucyqmpzjczfbf.supabase.co',
    key: 'sb_publishable_LCPqm_e0_9KWnrbPv_Mt6w_D516irFZ',
  };
})(window.TE);
