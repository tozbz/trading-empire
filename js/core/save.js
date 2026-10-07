/* Save system: localStorage autosave + backup slot, versioned migrations, default-merging,
 * compact candle storage, export / import strings, full reset. */
(function (TE) {
  'use strict';
  const KEY = 'tradingEmpire.save.v1';
  const BACKUP = 'tradingEmpire.backup.v1';
  const PREFIX = 'TE1:';
  const Save = (TE.Save = {});

  /* Migrations: index = version being migrated FROM. Add new entries when the format changes. */
  const MIGRATIONS = {
    // v1 (game 1.0 / 1.1) -> v2 (game 2.0): the living world. Everything new is additive; defaults are merged
    // afterwards, market assets are upgraded by TE.Market.init. Nothing is removed or renamed.
    1: (s) => {
      if (s.market && !s.market.ag) s.market.ag = {};
      if (s.profile) { s.profile.v2From = s.profile.v2From || (s.profile.prestige ? 'v1' : 'new'); }
      return s;
    },
  };

  const r6 = (x) => (typeof x === 'number' && isFinite(x) ? +x.toPrecision(6) : 0);
  const r3 = (x) => (typeof x === 'number' && isFinite(x) ? +x.toPrecision(3) : 0);
  function compactMarket(m) {
    if (!m) return m;
    const out = Object.assign({}, m, { assets: {} });
    Object.keys(m.assets).forEach((id) => {
      const a = m.assets[id];
      out.assets[id] = Object.assign({}, a, {
        c: a.c.slice(-300).map((k) => k.map(r6)),
        mc: a.mc.slice(-160).map((k) => k.map(r6)),
        marks: a.marks.slice(-30), botMarks: [], imp: a.imp.slice(-10),
      });
    });
    if (m.ag) {
      out.ag = {};
      Object.keys(m.ag).forEach((id) => { const st = m.ag[id]; if (st && st.x) out.ag[id] = { x: st.x.map(r3), wh: st.wh || null, cd: r6(st.cd || 0), init: st.init ? 1 : 0 }; });
    }
    return out;
  }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function mergeDefaults(target, defaults) {
    Object.keys(defaults).forEach((k) => {
      if (target[k] === undefined || target[k] === null && defaults[k] !== null) target[k] = clone(defaults[k]);
      else if (isObj(target[k]) && isObj(defaults[k])) mergeDefaults(target[k], defaults[k]);
    });
    return target;
  }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function sanitizeNum(o, keys) { keys.forEach((k) => { if (typeof o[k] !== 'number' || !isFinite(o[k])) o[k] = 0; }); }

  Save.serialize = function (state, savedAt) {
    const s = state || TE.state;
    const copy = Object.assign({}, s, { market: compactMarket(s.market), savedAt: savedAt || Date.now(), v: TE.SAVE_VERSION });
    return JSON.stringify(copy);
  };

  Save.validate = function (obj) {
    return obj && typeof obj === 'object' && obj.profile && obj.run && typeof obj.run.cash === 'number' && obj.settings;
  };

  Save.migrate = function (obj) {
    const englishLogs = !obj.profile || obj.profile.locale !== 'fr'; // checked before defaults are merged in
    let v = obj.v || 1;
    while (v < TE.SAVE_VERSION) {
      if (MIGRATIONS[v]) obj = MIGRATIONS[v](obj) || obj;
      v++;
    }
    obj.v = TE.SAVE_VERSION;
    // bring in any new fields
    const fresh = TE.State.create();
    mergeDefaults(obj.settings, fresh.settings);
    mergeDefaults(obj.profile, fresh.profile);
    const unl = obj.run.unlocked;
    mergeDefaults(obj.run, TE.State.createRun(obj.profile));
    if (unl && Object.keys(unl).length) obj.run.unlocked = unl;
    sanitizeNum(obj.run, ['cash', 'earnings', 'rep', 'time']);
    if (obj.run.cash < 0) obj.run.cash = 0;
    if (obj.run.fund) sanitizeNum(obj.run.fund, ['aum', 'nav', 'peak']);
    if (obj.run.fund && obj.run.fund.nav <= 0) obj.run.fund.nav = obj.run.fund.peak = 100;
    if (obj.market && obj.market.assets) {
      Object.keys(obj.market.assets).forEach((id) => {
        const a = obj.market.assets[id];
        if (!TE.Data.ASSET_MAP[id] || !(a.p > 0) || !Array.isArray(a.c)) { delete obj.market.assets[id]; return; }
        a.imp = a.imp || []; a.ev = a.ev || []; a.marks = a.marks || []; a.botMarks = []; a.mc = a.mc || [];
        if (!TE.Data.REGIMES[a.reg && a.reg.id]) a.reg = { id: 'range', t: 0, d: 20, drift: 0, flipDrift: 0, anchor: a.p };
      });
    }
    Object.keys(obj.run.unlocked).forEach((id) => { if (!TE.Data.ASSET_MAP[id]) delete obj.run.unlocked[id]; });
    if (!Object.keys(obj.run.unlocked).length) obj.run.unlocked = { NOVA: true };
    // French localisation: older saves stored some English display text in purely cosmetic logs
    // (news feed, fund log). Clear those logs once; no gameplay data is touched.
    if (englishLogs) {
      obj.run.news = [];
      obj.run.activity = [];
      if (obj.run.fund && Array.isArray(obj.run.fund.log)) obj.run.fund.log = [];
      obj.profile.locale = 'fr';
    }
    return obj;
  };

  Save.save = function (manual, savedAt) {
    if (!TE.state || Save.disabled) return false;
    try {
      const json = Save.serialize(undefined, savedAt);
      const prev = localStorage.getItem(KEY);
      if (prev && Math.random() < 0.2) localStorage.setItem(BACKUP, prev);
      localStorage.setItem(KEY, json);
      TE.state.savedAt = savedAt || Date.now();
      Save.lastSize = json.length;
      TE.Bus.emit('saved', { manual: !!manual, size: json.length });
      return true;
    } catch (e) {
      console.error('[Save] failed', e);
      TE.Bus.emit('save:error', e);
      return false;
    }
  };

  function parse(json) {
    let obj;
    try { obj = JSON.parse(json); } catch (e) { throw new Error('Données de sauvegarde illisibles.'); }
    if (!Save.validate(obj)) throw new Error('Structure de sauvegarde invalide');
    return Save.migrate(obj);
  }

  Save.load = function () {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
    if (!raw) return null;
    try { return parse(raw); } catch (e) {
      console.warn('[Save] main save corrupted, trying backup', e);
      try { const b = localStorage.getItem(BACKUP); return b ? parse(b) : null; } catch (e2) { return null; }
    }
  };
  Save.hasSave = function () { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };

  function checksum(str) { return (TE.U.hash(str) >>> 0).toString(36); }
  Save.exportString = function () {
    const json = Save.serialize();
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return PREFIX + checksum(b64) + ':' + b64;
  };
  Save.decode = function (str) {
    str = (str || '').trim();
    let b64 = str;
    if (str.indexOf(PREFIX) === 0) {
      const rest = str.slice(PREFIX.length);
      const i = rest.indexOf(':');
      const sum = rest.slice(0, i);
      b64 = rest.slice(i + 1);
      if (checksum(b64) !== sum) throw new Error('Somme de contrôle incorrecte : la sauvegarde est incomplète ou a été modifiée.');
    }
    let json;
    try { json = decodeURIComponent(escape(atob(b64))); } catch (e) { throw new Error('Ce texte n’est pas une sauvegarde TRADING EMPIRE valide.'); }
    return parse(json);
  };
  Save.importString = function (str) {
    const obj = Save.decode(str);
    Save.disabled = true;
    localStorage.setItem(KEY, JSON.stringify(obj));
    location.reload();
  };
  Save.download = function () {
    const blob = new Blob([Save.exportString()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trading-empire-' + TE.U.dateKey() + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  Save.reset = function () {
    Save.disabled = true;
    try { localStorage.removeItem(KEY); localStorage.removeItem(BACKUP); } catch (e) { /* ignore */ }
    location.reload();
  };
})(window.TE);
