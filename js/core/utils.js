/* Utilities: math, RNG, number/time formatting, geometric cost helpers. */
(function (TE) {
  'use strict';
  const U = (TE.U = {});

  /* ---------------- math ---------------- */
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.CAP = 1e300;
  U.safe = (v, fb = 0) => (typeof v === 'number' && isFinite(v) ? v : fb);
  U.cap = (v) => (v > U.CAP ? U.CAP : v < -U.CAP ? -U.CAP : v);
  U.sum = (arr, fn) => { let s = 0; for (let i = 0; i < arr.length; i++) s += fn ? fn(arr[i]) : arr[i]; return s; };
  U.log10 = (v) => Math.log(v) / Math.LN10;

  /* ---------------- RNG ---------------- */
  U.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.range = (a, b, rng) => a + (b - a) * (rng || Math.random)();
  U.irange = (a, b, rng) => Math.floor(a + (b - a + 1) * (rng || Math.random)());
  U.chance = (p, rng) => (rng || Math.random)() < p;
  let spare = null;
  U.gauss = function (rng) {
    if (!rng && spare !== null) { const s = spare; spare = null; return s; }
    const r = rng || Math.random;
    let u = 0, v = 0;
    while (u === 0) u = r();
    v = r();
    const m = Math.sqrt(-2 * Math.log(u));
    if (!rng) spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  };
  U.pick = (arr, rng) => arr[Math.floor((rng || Math.random)() * arr.length)];
  /** entries: [[item, weight], ...] */
  U.weighted = function (entries, rng) {
    const r = rng || Math.random;
    let tot = 0;
    for (let i = 0; i < entries.length; i++) tot += Math.max(0, entries[i][1]);
    if (tot <= 0) return entries.length ? entries[0][0] : null;
    let x = r() * tot;
    for (let i = 0; i < entries.length; i++) { x -= Math.max(0, entries[i][1]); if (x <= 0) return entries[i][0]; }
    return entries[entries.length - 1][0];
  };
  U.shuffle = function (arr, rng) {
    const r = rng || Math.random;
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };
  U.uid = () => Math.random().toString(36).slice(2, 10);

  /* ---------------- number formatting (French display: 1 234,56 · 1,25 M$ · +3,20 %) ---------------- */
  const NB = '\u00a0'; // no-break space: thousands separator and number/unit spacing
  U.NB = NB;
  const dec2fr = (s) => s.replace('.', ',');
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc',
    'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg', 'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OcVg', 'NoVg', 'Tg'];
  U.SUFFIXES = SUF;
  U.notation = 'standard'; // standard | scientific | engineering

  function mant(m) { return m < 100 ? m.toFixed(2) : m.toFixed(1); }
  function sci(a) {
    let e = Math.floor(Math.log10(a));
    let m = a / Math.pow(10, e);
    if (m >= 9.995) { m /= 10; e++; }
    return dec2fr(m.toFixed(2)) + 'e' + e;
  }
  function eng(a) {
    let e = Math.floor(Math.log10(a));
    e -= ((e % 3) + 3) % 3;
    let m = a / Math.pow(10, e);
    if (m >= 999.5) { m /= 1000; e += 3; }
    return dec2fr(mant(m)) + 'e' + e;
  }
  U.commas = function (x, dec) {
    const s = x.toFixed(dec || 0);
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    return parts.join(',');
  };
  /** Parse a number typed by the player: accepts "1 234,5", "1234.5", "1,234.5". */
  U.parseNum = function (str) {
    let t = String(str || '').replace(/[\s\u00a0\u202f$]/g, '');
    if (t.indexOf(',') >= 0 && t.indexOf('.') >= 0) t = t.replace(/,/g, '');
    else t = t.replace(',', '.');
    return parseFloat(t);
  };
  /** Generic abbreviated number. opt.dec = decimals below 1000, opt.int = integer below 1000 */
  U.fmt = function (n, opt) {
    if (n === Infinity) return '∞';
    if (n === -Infinity) return '-∞';
    if (typeof n !== 'number' || n !== n) return '—';
    const neg = n < 0;
    const a = Math.abs(n);
    let s;
    const dec = opt && opt.dec !== undefined ? opt.dec : 2;
    if (a < 1000 && !(a >= 999.995 && dec >= 2)) {
      s = opt && opt.int ? String(Math.round(a)) : dec2fr(a.toFixed(dec));
    } else if (U.notation === 'scientific' && a >= 1e6) {
      s = sci(a);
    } else if (U.notation === 'engineering' && a >= 1e6) {
      s = eng(a);
    } else {
      let e = Math.floor(Math.log10(a) / 3);
      let m = a / Math.pow(10, e * 3);
      if (m < 1) { e--; m *= 1000; }
      if (parseFloat(mant(m)) >= 1000) { e++; m /= 1000; }
      s = e >= SUF.length ? sci(a) : dec2fr(mant(m)) + NB + SUF[e];
    }
    return (neg ? '-' : '') + s;
  };
  U.int = (n) => (Math.abs(n) < 1e6 ? U.commas(Math.round(n)) : U.fmt(n));
  /** "1,25 M$" when abbreviated, "95,25 $" otherwise */
  const cur = (body) => body + (/[A-Za-z]$/.test(body) ? '$' : NB + '$');
  U.money = function (n, opt) {
    if (typeof n !== 'number' || n !== n) return '—' + NB + '$';
    return (n < 0 ? '-' : '') + cur(U.fmt(Math.abs(n), opt));
  };
  /** signed money with explicit + */
  U.smoney = (n, opt) => (n > 0 ? '+' : n < 0 ? '-' : '') + cur(U.fmt(Math.abs(n), opt));
  /** f is a fraction (0.1428 => +14.28%) */
  U.pct = function (f, dec, signed) {
    if (typeof f !== 'number' || f !== f) return '—';
    const d = dec === undefined ? 2 : dec;
    const v = f * 100;
    const body = Math.abs(v) >= 10000 ? U.fmt(Math.abs(v), { dec: 0 }) : dec2fr(Math.abs(v).toFixed(d));
    const sign = v < 0 ? '-' : signed === false ? '' : v > 0 ? '+' : '';
    return sign + body + NB + '%';
  };
  U.mult = (m) => '×' + (m >= 1000 ? U.fmt(m) : m >= 100 ? m.toFixed(0) : dec2fr(m >= 10 ? m.toFixed(1) : m.toFixed(2)));
  U.arrow = (v) => (v > 0 ? '▲' : v < 0 ? '▼' : '■');
  U.price = function (p, dec) {
    if (typeof p !== 'number' || !isFinite(p)) return '—';
    if (dec !== undefined) return U.commas(p, dec);
    const a = Math.abs(p);
    if (a >= 1e9) return U.fmt(p);
    if (a >= 10000) return U.commas(p, 1);
    if (a >= 100) return U.commas(p, 2);
    if (a >= 10) return dec2fr(p.toFixed(3));
    if (a >= 1) return dec2fr(p.toFixed(4));
    if (a >= 0.01) return dec2fr(p.toFixed(5));
    return dec2fr(p.toPrecision(4));
  };
  U.priceDec = function (p) {
    const a = Math.abs(p);
    if (a >= 10000) return 1; if (a >= 100) return 2; if (a >= 10) return 3; if (a >= 1) return 4; return 5;
  };

  /* ---------------- time formatting ---------------- */
  U.dur = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (d > 0) return d + NB + 'j ' + h + NB + 'h';
    if (h > 0) return h + NB + 'h ' + String(m).padStart(2, '0') + NB + 'min';
    if (m > 0) return m + NB + 'min ' + String(s).padStart(2, '0') + NB + 's';
    return s + NB + 's';
  };
  U.clock = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };
  U.dateKey = function (d) {
    d = d || new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  };

  /* ---------------- geometric cost (log-space, overflow safe) ---------------- */
  function logGeoSum(r, k) { // log((r^k - 1)/(r - 1))
    if (r === 1) return Math.log(k);
    const lk = k * Math.log(r);
    if (lk > 40) return lk - Math.log(r - 1);
    return Math.log((Math.exp(lk) - 1) / (r - 1));
  }
  U.geoCost = function (base, r, owned, k) {
    if (k <= 0) return 0;
    return Math.exp(Math.log(base) + owned * Math.log(r) + logGeoSum(r, k));
  };
  U.geoMax = function (base, r, owned, money, limit) {
    if (!(money > 0)) return 0;
    let k;
    if (r === 1) k = Math.floor(money / base);
    else {
      const lgFirst = Math.log(base) + owned * Math.log(r);
      const lx = Math.log(money) + Math.log(r - 1) - lgFirst;
      const v = lx > 35 ? lx : Math.log1p(Math.exp(lx));
      k = Math.floor(v / Math.log(r) + 1e-9);
    }
    if (limit !== undefined) k = Math.min(k, limit);
    while (k > 0 && U.geoCost(base, r, owned, k) > money * (1 + 1e-9)) k--;
    return Math.max(0, k);
  };
})(window.TE);
