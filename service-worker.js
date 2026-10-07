/* TRADING EMPIRE — service worker.
 *
 * Goals: the game opens offline after one visit, and a published update is never hidden behind an old cache.
 *  - Each deployment stamps a unique BUILD id below (see .github/workflows/pages.yml). A new id = a new worker:
 *    it pre-caches the files of that build, then waits. The page shows "NOUVELLE VERSION DISPONIBLE" and the
 *    player decides when to reload (never in the middle of a trade or a prestige).
 *  - Game files are served network-first (revalidated with the server), so an online player always runs the
 *    current files; the cache is only the offline fallback and is refreshed on every successful load.
 *  - Old build caches are deleted when the new worker activates. Saves are NOT stored here: they stay in
 *    localStorage (and in the optional cloud), untouched by the cache.
 */
'use strict';
const BUILD = '__BUILD_ID__';
const SHELL = 'te-shell-' + BUILD;
const FONTS = 'te-fonts-v1';
const NAV_TIMEOUT = 4000;
const ASSET_TIMEOUT = 8000;
const EXTRA = ['./', 'manifest.webmanifest', 'offline.html', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/icon.svg'];

/** Every local file referenced by index.html (scripts, stylesheets, icons, manifest): no hand-kept list. */
function shellUrls(html) {
  const out = new Set();
  const re = /\s(?:src|href)\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(u)) continue;
    out.add(u);
  }
  return [...out];
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    const res = await fetch('index.html', { cache: 'no-store' });
    if (!res.ok) throw new Error('index.html ' + res.status);
    const html = await res.clone().text();
    await cache.put('index.html', res.clone());
    await cache.put('./', res);
    // unique absolute URLs (cache.addAll rejects duplicates)
    const urls = [...new Set(shellUrls(html).concat(EXTRA.filter((u) => u !== './')).map((u) => new URL(u, self.registration.scope).href))];
    // all-or-nothing: a partial cache would make a broken offline game, so a failure keeps the previous worker
    await cache.addAll(urls.map((u) => new Request(u, { cache: 'no-store' })));
    // first install (no previous version running): take over right away
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('te-shell-') && k !== SHELL).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'GET_BUILD' && event.source) event.source.postMessage({ type: 'BUILD', build: BUILD });
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function networkFirst(request, isNav) {
  const cache = await caches.open(SHELL);
  try {
    // revalidate with the server (ETag) instead of trusting the HTTP cache: no stale file after a deploy
    const fresh = await withTimeout(fetch(isNav ? request.url : request, { cache: 'no-cache', credentials: 'same-origin' }), isNav ? NAV_TIMEOUT : ASSET_TIMEOUT);
    if (fresh && fresh.ok && fresh.type === 'basic') {
      const key = isNav ? 'index.html' : request;
      const copy = fresh.clone();
      (async () => {
        // keep one entry per file: drop the variants of other builds (?v=…-<build>) so the cache stays bounded
        if (!isNav) {
          const olds = await cache.keys(request, { ignoreSearch: true });
          await Promise.all(olds.filter((r) => r.url !== request.url).map((r) => cache.delete(r)));
        }
        await cache.put(key, copy);
      })().catch(() => {});
    }
    return fresh;
  } catch (e) {
    const hit = await cache.match(isNav ? 'index.html' : request);
    if (hit) return hit;
    if (isNav) return (await cache.match('offline.html')) || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    throw e;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(request);
  const net = fetch(request).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone()).catch(() => {}); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (!url.href.startsWith(self.registration.scope)) return;
    if (url.pathname.endsWith('/build.json')) return; // always live
    const isNav = req.mode === 'navigate';
    event.respondWith(networkFirst(req, isNav));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req));
  }
  // anything else (cloud save API…) goes straight to the network, never cached
});
