/* Cloud save & multi-device sync (optional). Distribution layer only: no gameplay code.
 *
 * Principles
 *  - The local save (localStorage) stays the reference: the game is fully playable offline and without account.
 *  - The cloud keeps one save per account (+ up to 5 previous versions on the server).
 *  - Two saves are NEVER merged. When local and cloud diverge, the player chooses, with both summaries side by side.
 *  - Every cloud write is revision-checked by the server (RPC te_push_save): a device that loaded revision 34 cannot
 *    silently overwrite revision 35 written by another device — it gets a conflict instead.
 *  - Before the local save is replaced by a cloud save, a copy of it is kept (TE.Save.keepSafetyCopy).
 *  - Sync: when the local save changed, every 5 minutes while playing, after important moments (prestige, era,
 *    headquarters, fund), when the page is hidden, and when the connection comes back — never more than once a minute.
 *  - Auth: Supabase e-mail sign-in (6-digit code, or the magic link in the same e-mail). Plain REST calls, no SDK.
 *  - Privacy: only the e-mail address (auth), the save itself, a random device id and a coarse device label
 *    ("Ordinateur · Chrome"). No tracking, no fingerprinting. */
(function (TE) {
  'use strict';
  const C = (TE.Cloud = {});
  const cfg = TE.CloudConfig || {};
  const SAVE_KEY = 'tradingEmpire.save.v1';
  const LS_AUTH = 'tradingEmpire.auth.v1';
  const LS_SYNC = 'tradingEmpire.sync.v1';
  const LS_DEVICE = 'tradingEmpire.device.v1';
  const SLOT = 0;
  const PERIOD = 5 * 60 * 1000;
  const MIN_GAP = 60 * 1000;
  const HIDE_GAP = 20 * 1000;

  C.enabled = () => !!(cfg.url && cfg.key);
  C.status = C.enabled() ? 'off' : 'disabled';
  C.detail = '';
  C.gameStarted = false;
  let session = null;
  let busy = false;
  let lastPush = 0;
  let pushTimer = 0;
  let pendingConflict = null;
  let choiceOpen = false;

  /* ---------------- small helpers ---------------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function jget(k, d) { try { const v = lsGet(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { return lsSet(k, JSON.stringify(v)); }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (t) => { try { return new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(t); } };
  const money = (v) => (TE.U && TE.U.money ? TE.U.money(v || 0) : String(v));
  const dur = (s) => (TE.U && TE.U.dur ? TE.U.dur(s || 0) : Math.round(s || 0) + ' s');

  function randomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; });
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  /** Random id of this installation (no hardware data). */
  C.deviceId = function () {
    let d = lsGet(LS_DEVICE);
    if (!d) { d = randomId(); lsSet(LS_DEVICE, d); }
    return d;
  };
  /** Coarse, human-readable label shown in conflict dialogs ("Mobile · Chrome"). */
  C.deviceLabel = function () {
    const ua = navigator.userAgent || '';
    const kind = /iPad|Tablet/i.test(ua) ? 'Tablette' : /Mobi|Android|iPhone/i.test(ua) ? 'Mobile' : 'Ordinateur';
    const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
    const app = (TE.PWA && TE.PWA.standalone && TE.PWA.standalone()) ? ' (app)' : '';
    return kind + ' · ' + br + app;
  };

  async function sha256(str) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return 'h32-' + (TE.U.hash(str) >>> 0).toString(16) + '-' + str.length;
  }
  function toB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function fromB64(b64) { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }
  /** gzip + base64 when the browser can (≈ 5× smaller), plain JSON otherwise. The local TE1 format is untouched. */
  async function pack(json) {
    if (typeof CompressionStream === 'function') {
      try {
        const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
        return { enc: 'gz64', data: toB64(new Uint8Array(await new Response(stream).arrayBuffer())) };
      } catch (e) { /* fall back */ }
    }
    return { enc: 'json', data: json };
  }
  async function unpack(enc, data) {
    if (enc === 'json') return data;
    if (enc === 'gz64') {
      if (typeof DecompressionStream !== 'function') throw new Error('Ce navigateur ne sait pas lire cette sauvegarde compressée.');
      const stream = new Blob([fromB64(data)]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream).text();
    }
    throw new Error('Format de sauvegarde cloud inconnu.');
  }

  /* ---------------- HTTP ---------------- */
  function netError(e) { const x = new Error('Connexion impossible'); x.net = true; x.cause = e; return x; }
  async function http(method, path, body, opts) {
    opts = opts || {};
    const headers = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (opts.auth !== false) {
      const t = await accessToken();
      if (!t) { const e = new Error('Session expirée : reconnectez-vous.'); e.auth = true; throw e; }
      headers.Authorization = 'Bearer ' + t;
    }
    if (opts.prefer) headers.Prefer = opts.prefer;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), opts.timeout || 25000) : 0;
    let res;
    try {
      res = await fetch(cfg.url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl ? ctl.signal : undefined, cache: 'no-store' });
    } catch (e) { throw netError(e); } finally { if (tm) clearTimeout(tm); }
    const txt = await res.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!res.ok) {
      const msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('Erreur ' + res.status);
      const err = new Error(msg);
      err.status = res.status;
      if (res.status === 401) err.auth = true;
      throw err;
    }
    return data;
  }

  /* ---------------- auth (Supabase GoTrue REST) ---------------- */
  function storeSession(d) {
    if (!d || !d.access_token || !d.refresh_token) return null;
    const exp = d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600);
    session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: exp, user: d.user ? { id: d.user.id, email: d.user.email } : (session && session.user) || null };
    jset(LS_AUTH, session);
    return session;
  }
  let refreshing = null;
  async function accessToken() {
    if (!session) return null;
    if (session.expires_at - 90 > Date.now() / 1000) return session.access_token;
    if (!refreshing) {
      refreshing = (async () => {
        try {
          const d = await http('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token }, { auth: false });
          storeSession(d);
        } catch (e) {
          if (!e.net) { session = null; lsDel(LS_AUTH); setStatus('off'); }
          throw e;
        } finally { refreshing = null; }
      })();
    }
    await refreshing;
    return session ? session.access_token : null;
  }
  C.loggedIn = () => !!(session && session.refresh_token);
  C.email = () => (session && session.user && session.user.email) || '';
  C.userId = () => (session && session.user && session.user.id) || null;

  /** Sends the sign-in e-mail (6-digit code + magic link back to this page). Creates the account if needed. */
  C.sendCode = async function (email) {
    const redirect = location.href.split('#')[0].split('?')[0];
    await http('POST', '/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect), { email: String(email).trim(), create_user: true }, { auth: false });
  };
  C.verifyCode = async function (email, code) {
    const d = await http('POST', '/auth/v1/verify', { type: 'email', email: String(email).trim(), token: String(code).replace(/\s+/g, '') }, { auth: false });
    if (!storeSession(d)) throw new Error('Connexion refusée.');
    afterLogin();
  };
  C.logout = async function () {
    const t = session && session.access_token;
    session = null;
    lsDel(LS_AUTH);
    setStatus('off');
    if (t) { try { await fetch(cfg.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: cfg.key, Authorization: 'Bearer ' + t } }); } catch (e) { /* offline: the token simply expires */ } }
  };
  /** Magic link landing: the tokens arrive in the URL fragment. Read them once, then clean the address bar. */
  function readMagicLink() {
    const h = location.hash || '';
    if (h.indexOf('access_token=') < 0 && h.indexOf('error_description=') < 0) return;
    const p = new URLSearchParams(h.slice(1));
    if (p.get('access_token')) {
      storeSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: +p.get('expires_at') || 0, expires_in: +p.get('expires_in') || 3600 });
      C.justLoggedIn = true;
    } else C.linkError = p.get('error_description') || 'Lien de connexion invalide ou expiré.';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  }
  async function loadUser() {
    if (!session || (session.user && session.user.id)) return;
    try { const u = await http('GET', '/auth/v1/user'); if (u && u.id) { session.user = { id: u.id, email: u.email }; jset(LS_AUTH, session); } } catch (e) { /* later */ }
  }

  /* ---------------- sync bookkeeping (per account, per device) ---------------- */
  function syncState() { const all = jget(LS_SYNC, {}); return (C.userId() && all[C.userId()]) || null; }
  function saveSync(patch) {
    const uid = C.userId();
    if (!uid) return;
    const all = jget(LS_SYNC, {});
    all[uid] = Object.assign({}, all[uid] || {}, patch, { at: Date.now() });
    jset(LS_SYNC, all);
  }
  C.syncInfo = syncState;

  /** Short description of a save, shown in the conflict dialog and stored next to the cloud save. */
  function summarize() {
    const s = TE.state;
    if (!s || !s.run) return {};
    const era = (TE.Data.ERAS || [])[s.run.era - 1] || {};
    let nw = 0;
    try { nw = TE.Economy.netWorth(); } catch (e) { nw = s.run.cash || 0; }
    const pr = s.profile.prestige || {};
    return { nw, era: s.run.era, eraName: era.name || '', earned: s.run.earnings || 0, playtime: Math.round(s.profile.playtime || 0), runTime: Math.round(s.run.time || 0), p1: pr.p1 || 0, p2: pr.p2 || 0, p3: pr.p3 || 0, savedAt: s.savedAt || Date.now(), version: TE.VERSION };
  }
  C.summarize = summarize;

  /* ---------------- status indicator ---------------- */
  const LABEL = { disabled: '', off: '', idle: '☁ Synchronisé', pending: '☁ À synchroniser', syncing: '☁ Synchronisation…', offline: '⚠ Hors ligne', conflict: '⚠ Conflit', error: '⚠ Erreur cloud' };
  function setStatus(st, detail) {
    C.status = st;
    C.detail = detail || '';
    renderIndicator();
    if (TE.Bus) TE.Bus.emit('cloud:status', { status: st, detail: C.detail });
  }
  function indicatorText() {
    if (!C.enabled()) return '';
    if (!C.loggedIn()) return navigator.onLine === false ? '⚠ Hors ligne · local' : '';
    return LABEL[C.status] || '';
  }
  function renderIndicator() {
    const txt = indicatorText();
    const cls = 'cloud-ind cl-' + C.status;
    const title = C.loggedIn() ? ('Sauvegarde cloud : ' + (C.detail || txt) + ' — ' + C.email()) : 'Mode local';
    const host = document.querySelector('#status .st-r');
    if (host) {
      let el = document.getElementById('st-cloud');
      if (!el) {
        el = document.createElement('button');
        el.id = 'st-cloud';
        el.type = 'button';
        el.addEventListener('click', openSettings);
        host.insertBefore(el, host.firstChild);
      }
      el.className = cls;
      el.textContent = txt;
      el.title = title;
      el.hidden = !txt;
    }
    // phones: the status bar is hidden, so a tiny pill (only when it carries information)
    let pill = document.getElementById('cloud-pill');
    if (!pill && document.getElementById('app')) {
      pill = document.createElement('button');
      pill.id = 'cloud-pill';
      pill.type = 'button';
      pill.addEventListener('click', openSettings);
      document.body.appendChild(pill);
    }
    if (pill) { pill.className = cls; pill.textContent = txt; pill.title = title; pill.hidden = !txt || C.status === 'idle'; }
    // refresh the settings card, but never while the player is typing an e-mail / code in it
    const card = document.getElementById('cloud-card');
    if (card && card.isConnected && (C.loggedIn() || card.dataset.mode !== 'out')) renderCard(card);
  }
  function openSettings() { if (TE.UI && TE.UI.go) TE.UI.go('settings'); }
  setInterval(() => { if (document.getElementById('app') && !document.getElementById('st-cloud')) renderIndicator(); }, 2000);

  function fail(e) {
    if (e && e.net) setStatus('offline', 'connexion indisponible — la partie continue en local');
    else if (e && e.auth) setStatus('off', e.message);
    else setStatus('error', (e && e.message) || 'erreur inconnue');
  }

  /* ---------------- server calls ---------------- */
  const META = 'revision,updated_at,checksum,device_id,device_label,game_version,save_version,summary,size';
  async function remoteMeta() {
    const rows = await http('GET', '/rest/v1/saves?slot=eq.' + SLOT + '&select=' + META);
    return (rows && rows[0]) || null;
  }
  async function remoteFull() {
    const rows = await http('GET', '/rest/v1/saves?slot=eq.' + SLOT + '&select=' + META + ',payload,encoding');
    return (rows && rows[0]) || null;
  }
  C.backups = async function () {
    return http('GET', '/rest/v1/save_backups?slot=eq.' + SLOT + '&select=id,revision,updated_at,archived_at,checksum,device_label,game_version,summary,size&order=revision.desc,id.desc');
  };
  async function backupFull(id) {
    const rows = await http('GET', '/rest/v1/save_backups?id=eq.' + encodeURIComponent(id) + '&select=id,revision,checksum,payload,encoding,summary');
    return (rows && rows[0]) || null;
  }

  /** Local save exactly as stored (the string that is uploaded). */
  function localJson() { return lsGet(SAVE_KEY); }

  /** Upload the local save. base = cloud revision this device is based on; force = player chose to overwrite. */
  async function push(opts) {
    opts = opts || {};
    if (!C.enabled() || !C.loggedIn() || busy) return 'skip';
    if (pendingConflict && !opts.force) return 'conflict';
    busy = true;
    setStatus('syncing');
    try {
      // while playing, write the current state first (never before the game started: offline progress needs the old timestamp)
      if (C.gameStarted && TE.state && TE.Save && !TE.Save.disabled) TE.Save.save(false);
      const json = localJson();
      if (!json) { setStatus('idle', 'aucune partie locale'); return 'empty'; }
      const cs = await sha256(json);
      const st = syncState() || {};
      if (!opts.force && opts.base === undefined && cs === st.checksum) { setStatus('idle', 'à jour'); lastPush = Date.now(); return 'same'; }
      const base = opts.base !== undefined ? opts.base : (st.rev || 0);
      const packed = await pack(json);
      const res = await http('POST', '/rest/v1/rpc/te_push_save', {
        p_slot: SLOT, p_base_revision: base, p_force: !!(opts.force || st.forceNext), p_payload: packed.data, p_encoding: packed.enc,
        p_checksum: cs, p_size: json.length, p_game_version: TE.VERSION, p_save_version: TE.SAVE_VERSION,
        p_device_id: C.deviceId(), p_device_label: C.deviceLabel(), p_summary: summarize(),
      });
      lastPush = Date.now();
      if (res && res.status === 'conflict') {
        pendingConflict = res;
        setStatus('conflict', 'une autre version a été enregistrée depuis un autre appareil');
        announceConflict();
        return 'conflict';
      }
      pendingConflict = null;
      saveSync({ rev: res.revision, checksum: cs, forceNext: false, cloudAt: res.updated_at });
      setStatus('idle', 'révision ' + res.revision + ' · ' + fmtDate(Date.now()));
      return 'ok';
    } catch (e) {
      fail(e);
      return 'error';
    } finally { busy = false; }
  }
  C.pushNow = () => push({});

  /** Replace the local save by a cloud save (current or one of the backups), keeping a safety copy first. */
  async function useRemote(row, backupId) {
    setStatus('syncing', 'téléchargement…');
    const full = backupId ? await backupFull(backupId) : await remoteFull();
    if (!full) throw new Error('Sauvegarde cloud introuvable.');
    const json = await unpack(full.encoding, full.payload);
    if ((await sha256(json)) !== full.checksum) throw new Error('Sauvegarde cloud corrompue (somme de contrôle) : rien n’a été modifié.');
    const obj = JSON.parse(json);
    if (!TE.Save.validate(obj)) throw new Error('Sauvegarde cloud invalide : rien n’a été modifié.');
    if (!TE.Save.keepSafetyCopy(backupId ? 'avant restauration cloud' : 'avant chargement cloud')) throw new Error('Espace de stockage insuffisant pour garder une copie de la partie locale : opération annulée.');
    TE.Save.disabled = true; // the running game must not overwrite what is being written
    if (!lsSet(SAVE_KEY, json)) { TE.Save.disabled = false; throw new Error('Écriture locale impossible : rien n’a été modifié.'); }
    if (backupId) {
      // a restored backup becomes the newest version at the next sync; the current cloud save is archived first
      const cur = row || (await remoteMeta());
      saveSync({ rev: cur ? cur.revision : 0, checksum: null, forceNext: true });
    } else saveSync({ rev: full.revision, checksum: full.checksum, forceNext: false });
    pendingConflict = null;
    location.reload();
  }

  /* ---------------- reconciliation & choices ---------------- */
  function sumHtml(title, sm, when, device, tag) {
    sm = sm || {};
    return '<div class="cc-col' + (tag ? ' cc-best' : '') + '"><div class="cc-k">' + esc(title) + (tag ? ' <span class="cc-tag">' + esc(tag) + '</span>' : '') + '</div>' +
      '<div class="cc-when">' + esc(when ? fmtDate(when) : '—') + '</div>' +
      '<div class="cc-nw">' + esc(money(sm.nw)) + '</div><div class="cc-sub">valeur nette</div>' +
      '<div class="cc-row"><span>Ère</span><b>' + esc(sm.era ? sm.era + (sm.eraName ? ' — ' + sm.eraName : '') : '—') + '</b></div>' +
      '<div class="cc-row"><span>Temps de jeu</span><b>' + esc(dur(sm.playtime)) + '</b></div>' +
      '<div class="cc-row"><span>Prestiges</span><b>' + esc((sm.p1 || 0) + ' α · ' + (sm.p2 || 0) + ' Λ · ' + (sm.p3 || 0) + ' ✦') + '</b></div>' +
      (device ? '<div class="cc-row"><span>Appareil</span><b>' + esc(device) + '</b></div>' : '') + '</div>';
  }
  /** Ask the player which save to keep. kind: 'cloud-newer' | 'conflict' | 'first' | 'cloud-only'. Resolves 'cloud' | 'local' | 'later'. */
  function askChoice(kind, row, local) {
    return new Promise((resolve) => {
      if (choiceOpen) { resolve('later'); return; }
      choiceOpen = true;
      const cs = row.summary || {};
      const ls = local || {};
      const cloudWhen = row.updated_at;
      const localWhen = ls.savedAt;
      const cloudAhead = (cs.playtime || 0) > (ls.playtime || 0);
      const cloudRecent = new Date(cloudWhen).getTime() > (localWhen || 0);
      const titles = {
        'cloud-newer': 'SAUVEGARDE CLOUD PLUS RÉCENTE',
        conflict: 'CONFLIT DE SAUVEGARDE',
        first: 'UNE PARTIE EXISTE DÉJÀ DANS LE CLOUD',
        'cloud-only': 'PARTIE TROUVÉE DANS LE CLOUD',
      };
      const intro = {
        'cloud-newer': 'Une version plus récente a été enregistrée depuis un autre appareil.',
        conflict: 'Cette partie et la sauvegarde cloud ont toutes les deux avancé séparément. Elles ne peuvent pas être fusionnées : choisissez celle à garder.',
        first: 'Ce compte a déjà une sauvegarde. Choisissez la partie à garder sur cet appareil.',
        'cloud-only': 'Ce compte a une sauvegarde. Voulez-vous la charger ici ?',
      };
      const cloudTag = cloudAhead ? 'PLUS AVANCÉE' : cloudRecent ? 'PLUS RÉCENTE' : '';
      const localTag = !cloudAhead && (ls.playtime || 0) > (cs.playtime || 0) ? 'PLUS AVANCÉE' : !cloudRecent && localWhen ? 'PLUS RÉCENTE' : '';
      let picked = false;
      const pick = (v) => { if (picked) return; picked = true; choiceOpen = false; resolve(v); };
      TE.UI.modal({
        title: '<span class="' + (kind === 'conflict' ? 'down' : 'up') + '">' + titles[kind] + '</span>', cls: 'modal-cloud', locked: true,
        body: '<p class="dim">' + intro[kind] + '</p><div class="cc-grid">' + sumHtml('Cloud', cs, cloudWhen, row.device_label, cloudTag) + sumHtml('Cet appareil', ls, localWhen, C.deviceLabel(), localTag) + '</div>' +
          '<p class="dim small">Rien n’est perdu : la partie non choisie est conservée (version précédente dans le cloud, ou copie de sécurité locale dans PARAMÈTRES).</p>',
        buttons: kind === 'cloud-only' ? [
          { label: 'CHARGER LA PARTIE CLOUD', cls: 'btn-primary', onClick: () => { pick('cloud'); } },
          { label: 'Nouvelle partie locale', cls: 'btn-ghost', onClick: () => { pick('later'); } },
        ] : [
          { label: 'UTILISER LE CLOUD', cls: 'btn-primary', onClick: () => { pick('cloud'); } },
          { label: 'GARDER LA LOCALE', cls: 'btn-ghost', onClick: () => { pick('local'); } },
          { label: 'Décider plus tard', cls: 'btn-ghost', onClick: () => { pick('later'); } },
        ],
      });
    });
  }

  async function applyChoice(choice, row) {
    if (choice === 'cloud') { await useRemote(row); return; }
    if (choice === 'local') { await push({ base: row.revision, force: true }); return; }
    pendingConflict = row;
    setStatus('conflict', 'en attente de votre choix — synchronisation suspendue');
  }

  /** Compare local and cloud; push, or ask the player. mode: 'boot' (before the game starts) | 'live'. */
  async function reconcile(mode) {
    if (!C.enabled() || !C.loggedIn()) return 'none';
    if (navigator.onLine === false) { setStatus('offline', 'la partie continue en local'); return 'offline'; }
    setStatus('syncing', 'vérification…');
    await loadUser();
    let row;
    try { row = await remoteMeta(); } catch (e) { fail(e); return 'error'; }
    if (mode === 'live' && C.gameStarted && TE.state && TE.Save && !TE.Save.disabled) TE.Save.save(false);
    const json = localJson();
    const st = syncState();
    if (!row) {
      if (json) { pendingConflict = null; await push({ base: 0 }); } else setStatus('idle', 'aucune sauvegarde');
      return 'pushed';
    }
    const lcs = json ? await sha256(json) : null;
    if (lcs && lcs === row.checksum) { pendingConflict = null; saveSync({ rev: row.revision, checksum: lcs, forceNext: false }); setStatus('idle', 'révision ' + row.revision); return 'same'; }
    if (st && st.rev === row.revision) {
      pendingConflict = null;
      if (lcs && lcs !== st.checksum) await push({ base: row.revision }); else setStatus('idle', 'révision ' + row.revision);
      return 'pushed';
    }
    const localChanged = !st || !lcs || lcs !== st.checksum;
    const kind = !json ? 'cloud-only' : (st && !localChanged ? 'cloud-newer' : st ? 'conflict' : 'first');
    const choice = await askChoice(kind, row, json ? summarize() : null);
    try { await applyChoice(choice, row); } catch (e) { fail(e); if (TE.UI) TE.UI.toast({ title: 'SAUVEGARDE CLOUD', text: e.message, kind: 'bad', icon: '⚠', dur: 7000 }); }
    return choice;
  }
  C.reconcile = reconcile;

  function announceConflict() {
    if (!TE.UI || !TE.UI.toast) return;
    TE.UI.toast({ title: '⚠ CONFLIT DE SAUVEGARDE', html: 'Une autre version de votre partie a été enregistrée depuis un autre appareil. <b>Ouvrez PARAMÈTRES → Sauvegarde cloud</b> pour choisir.', kind: 'warn', icon: '☁', dur: 9000 });
  }
  C.resolveConflict = async function () {
    let row;
    try { row = await remoteMeta(); } catch (e) { fail(e); return; }
    if (!row) { pendingConflict = null; await push({ base: 0 }); return; }
    if (TE.state && TE.Save && !TE.Save.disabled) TE.Save.save(false);
    const choice = await askChoice('conflict', row, summarize());
    try { await applyChoice(choice, row); } catch (e) { fail(e); TE.UI.toast({ title: 'SAUVEGARDE CLOUD', text: e.message, kind: 'bad', icon: '⚠', dur: 7000 }); }
  };
  C.restoreBackup = async function (id) {
    try { await useRemote(null, id); } catch (e) { fail(e); TE.UI.toast({ title: 'RESTAURATION', text: e.message, kind: 'bad', icon: '⚠', dur: 7000 }); }
  };

  /* ---------------- boot gate & scheduling ---------------- */
  /** Called by main.js when the player presses ENTER: checks the cloud first (max ~6 s), then launches. */
  C.gate = function (launch) {
    if (!C.enabled() || !C.loggedIn()) { launch(); C.started(); return; }
    const btn = document.getElementById('boot-enter');
    if (btn) { btn.textContent = '[ VÉRIFICATION DE LA SAUVEGARDE CLOUD… ]'; btn.disabled = true; }
    let launched = false;
    const go = () => { if (launched) return; launched = true; launch(); C.started(); };
    const t = setTimeout(() => { if (!choiceOpen) go(); }, 6000);
    reconcile('boot').then((r) => { clearTimeout(t); if (r !== 'cloud') go(); }, () => { clearTimeout(t); go(); });
  };
  C.started = function () {
    C.gameStarted = true;
    renderIndicator();
  };
  function afterLogin() {
    setStatus('syncing', 'connexion réussie');
    if (TE.UI && TE.UI.toast) TE.UI.toast({ title: 'SAUVEGARDE CLOUD ACTIVÉE', text: 'Connecté : ' + C.email(), kind: 'ok', icon: '☁' });
    loadUser().then(() => reconcile(C.gameStarted ? 'live' : 'boot'));
  }
  function schedule(delay) {
    if (!C.loggedIn() || !C.gameStarted) return;
    clearTimeout(pushTimer);
    const wait = Math.max(delay || 0, lastPush + MIN_GAP - Date.now());
    pushTimer = setTimeout(() => { push({}); }, Math.max(1000, wait));
  }
  // periodic sync while playing
  setInterval(() => {
    if (!C.loggedIn() || !C.gameStarted || busy || pendingConflict || navigator.onLine === false) return;
    if (Date.now() - lastPush >= PERIOD) push({});
  }, 15000);
  // important moments
  if (TE.Bus) {
    ['prestige', 'era', 'office:upgrade', 'fund:founded'].forEach((ev) => TE.Bus.on(ev, () => schedule(3000)));
    TE.Bus.on('saved', (e) => { if (e && e.manual) schedule(1500); });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && C.loggedIn() && C.gameStarted && !pendingConflict && Date.now() - lastPush > HIDE_GAP) push({});
  });
  window.addEventListener('online', () => { if (C.loggedIn() && C.gameStarted) reconcile('live'); });
  window.addEventListener('offline', () => { if (C.loggedIn()) setStatus('offline', 'la partie continue en local'); else renderIndicator(); });

  /* ---------------- settings card ---------------- */
  let cardStep = { email: '', sent: false, msg: '', err: '' };
  function renderCard(card) {
    const UI = TE.UI;
    const h = UI.h;
    card.innerHTML = '';
    card.dataset.mode = C.loggedIn() ? 'in' : 'out';
    card.appendChild(h('div', { class: 'card-h' }, [h('span', { text: 'Sauvegarde cloud' }), h('span', { class: 'card-hr dim', text: C.loggedIn() ? (LABEL[C.status] || '') : 'mode local' })]));
    if (!C.enabled()) {
      card.appendChild(h('p', { class: 'dim small', text: 'La synchronisation cloud n’est pas configurée sur cette version. La partie est sauvegardée dans ce navigateur : utilisez Exporter / Importer pour la déplacer.' }));
      return;
    }
    if (!C.loggedIn()) {
      card.appendChild(h('p', { class: 'dim small', html: '<b>Mode local</b> : la partie reste dans ce navigateur. Activez la synchronisation pour retrouver la même partie sur tous vos appareils (PC, téléphone, tablette). Aucun mot de passe : un code vous est envoyé par e-mail.' }));
      if (C.linkError) card.appendChild(h('div', { class: 'down small', text: C.linkError }));
      const email = h('input', { class: 'inp', type: 'email', placeholder: 'votre@email.fr', value: cardStep.email, autocomplete: 'email' });
      const sendBtn = h('button', { class: 'btn btn-primary', text: cardStep.sent ? 'Renvoyer le code' : 'ACTIVER LA SYNCHRONISATION', on: { click: async () => {
        const v = email.value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { cardStep.err = 'Adresse e-mail invalide.'; renderCard(card); return; }
        cardStep.email = v; cardStep.err = ''; cardStep.msg = 'Envoi…'; renderCard(card);
        try { await C.sendCode(v); cardStep.sent = true; cardStep.msg = 'E-mail envoyé à ' + v + '. Saisissez le code à 6 chiffres (ou cliquez sur le lien de l’e-mail sur cet appareil).'; }
        catch (e) { cardStep.msg = ''; cardStep.err = e.net ? 'Pas de connexion Internet.' : (e.status === 429 ? 'Trop de demandes : réessayez dans quelques minutes.' : e.message); }
        renderCard(card);
      } } });
      card.appendChild(h('div', { class: 'cloud-row' }, [email, sendBtn]));
      if (cardStep.sent) {
        const code = h('input', { class: 'inp cloud-code', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: 'Code reçu', maxlength: 10 });
        card.appendChild(h('div', { class: 'cloud-row' }, [code, h('button', { class: 'btn btn-primary', text: 'SE CONNECTER', on: { click: async () => {
          cardStep.err = ''; cardStep.msg = 'Vérification…'; renderCard(card);
          try { await C.verifyCode(cardStep.email, code.value); cardStep = { email: '', sent: false, msg: '', err: '' }; }
          catch (e) { cardStep.msg = ''; cardStep.err = e.net ? 'Pas de connexion Internet.' : 'Code invalide ou expiré.'; }
          renderCard(card);
        } } })]));
      }
      if (cardStep.msg) card.appendChild(h('div', { class: 'small up', text: cardStep.msg }));
      if (cardStep.err) card.appendChild(h('div', { class: 'small down', text: cardStep.err }));
      return;
    }
    const st = syncState() || {};
    card.appendChild(h('div', { class: 'set-row' }, [h('span', { text: 'Compte' }), h('b', { text: C.email() || '…' })]));
    card.appendChild(h('div', { class: 'set-row' }, [h('span', { text: 'État' }), h('span', { class: 'cl-' + C.status, text: (LABEL[C.status] || '—') + (C.detail ? ' — ' + C.detail : '') })]));
    card.appendChild(h('div', { class: 'set-row' }, [h('span', { text: 'Dernière synchronisation' }), h('span', { text: st.at ? fmtDate(st.at) + (st.rev ? ' · révision ' + st.rev : '') : 'jamais' })]));
    card.appendChild(h('div', { class: 'dim small', text: 'Synchronisation automatique : toutes les 5 minutes de jeu, après un prestige, un changement d’ère ou de siège, et quand vous quittez l’application. Appareil : ' + C.deviceLabel() + '.' }));
    const row = h('div', { class: 'btn-row' });
    if (pendingConflict || C.status === 'conflict') row.appendChild(h('button', { class: 'btn btn-danger', text: 'RÉSOUDRE LE CONFLIT', on: { click: () => C.resolveConflict() } }));
    row.appendChild(h('button', { class: 'btn btn-primary', text: 'Synchroniser maintenant', on: { click: () => { if (pendingConflict) C.resolveConflict(); else reconcile('live'); } } }));
    row.appendChild(h('button', { class: 'btn btn-ghost', text: 'Versions précédentes', on: { click: () => backupsModal() } }));
    row.appendChild(h('button', { class: 'btn btn-ghost', text: 'Se déconnecter', on: { click: () => UI.confirm({ title: 'Se déconnecter ?', body: 'La partie reste sur cet appareil et dans le cloud. La synchronisation s’arrête jusqu’à la prochaine connexion.', yes: 'Se déconnecter', onYes: () => C.logout() }) } }));
    card.appendChild(row);
  }
  C.card = function () {
    const card = TE.UI.h('div', { class: 'card', id: 'cloud-card' });
    renderCard(card);
    return card;
  };
  async function backupsModal() {
    const UI = TE.UI;
    UI.modal({ title: 'Versions précédentes (cloud)', cls: 'modal-cloud', body: (body) => {
      body.innerHTML = '<p class="dim small">Le cloud garde votre sauvegarde actuelle et jusqu’à 5 versions précédentes. Restaurer remplace la partie de cet appareil (une copie de sécurité locale est gardée) ; la version actuelle du cloud est archivée à la synchronisation suivante.</p><div class="bk-list dim">Chargement…</div>';
      const list = body.querySelector('.bk-list');
      Promise.all([remoteMeta(), C.backups()]).then(([cur, rows]) => {
        list.innerHTML = '';
        list.classList.remove('dim');
        const line = (r, current) => {
          const sm = r.summary || {};
          const el = UI.h('div', { class: 'bk-row' + (current ? ' cur' : '') }, [
            UI.h('div', { class: 'bk-t', html: '<b>' + esc(fmtDate(r.updated_at)) + '</b> · révision ' + esc(r.revision) + (current ? ' <span class="cc-tag">ACTUELLE</span>' : '') + '<br><span class="dim small">' + esc(money(sm.nw)) + ' · ère ' + esc(sm.era || '—') + ' · ' + esc(dur(sm.playtime)) + ' de jeu · ' + esc(r.device_label || '') + '</span>' }),
            current ? null : UI.h('button', { class: 'btn btn-ghost btn-xs', text: 'Restaurer', on: { click: () => UI.confirm({ title: 'Restaurer cette version ?', body: 'La partie de cet appareil sera remplacée par la version du ' + fmtDate(r.updated_at) + '. Une copie de sécurité locale est gardée.', yes: 'Restaurer', danger: true, onYes: () => C.restoreBackup(r.id) }) } }),
          ]);
          list.appendChild(el);
        };
        if (cur) line(cur, true);
        (rows || []).forEach((r) => line(r, false));
        if (!cur && !(rows || []).length) list.textContent = 'Aucune sauvegarde dans le cloud pour l’instant.';
      }).catch((e) => { list.textContent = e.net ? 'Pas de connexion Internet.' : e.message; });
    }, buttons: [{ label: 'Fermer', cls: 'btn-ghost' }] });
  }

  /* ---------------- init ---------------- */
  if (C.enabled()) {
    session = jget(LS_AUTH, null);
    readMagicLink();
    if (C.loggedIn()) setStatus(navigator.onLine === false ? 'offline' : 'pending');
    if (C.justLoggedIn) setTimeout(() => { if (TE.UI && TE.UI.toast) TE.UI.toast({ title: 'SAUVEGARDE CLOUD ACTIVÉE', text: 'Connexion réussie. Vos sauvegardes seront synchronisées.', kind: 'ok', icon: '☁' }); }, 1500);
  }
})(window.TE);
