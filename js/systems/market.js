/* Market simulation: regime-switching log-price process with momentum, mean reversion,
 * macro cycles, correlated shocks, event impulses, sentiment and OHLCV candles.
 * V2: effective liquidity, market impact & slippage, real volume (player / actors / bots), agent flows. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const M = (TE.Market = {});
  const CANDLE_CAP = 720;
  const MACRO_CAP = 480;
  const MACRO_EVERY = Math.round(D.MACRO_CANDLE / D.CANDLE_SEC);

  M.createWorld = () => ({ t: 0, macro: { id: 'neutral', t: 0, d: 120 }, macroForce: null, sent: 50, assets: {}, ag: {} });

  function newAsset(def, rng) {
    const p = def.price * Math.exp(U.gauss(rng) * 0.04);
    return {
      p, fair: def.price, o: p, h: p, l: p, v: 0, ct: 0, c: [], n: 0,
      mc: [], mo: p, mh: p, ml: p, mv: 0, mk: 0,
      reg: { id: 'range', t: 0, d: 20, drift: 0, flipDrift: 0, anchor: p },
      mom: 0, imp: [], ev: [], evVol: 1, evVolume: 1, inf: 0, marks: [], botMarks: [], volRatio: 1,
      ...v2Fields(),
    };
  }
  /** V2 per-asset fields (also used to upgrade older saves). */
  function v2Fields() {
    return { lq: 1, flow: 0, pf: 0, pv: 0, mpv: 0, ns: 0, mmP: 1, vr: 1, vb: 1, pvE: 0, vE: 1, p20: 0 };
  }
  M.upgradeAsset = function (a) {
    const f = v2Fields();
    Object.keys(f).forEach((k) => { if (a[k] === undefined || (typeof f[k] === 'number' && !isFinite(a[k]))) a[k] = f[k]; });
    return a;
  };

  function regimeNet(R) { return R === D.REGIMES.bull_trap ? -1 : R === D.REGIMES.bear_trap ? 1 : R.dir; }

  function startRegime(a, def, id, rng, dur) {
    const R = D.REGIMES[id];
    const k = def.trend * U.range(0.7, 1.3, rng);
    a.reg = { id, t: 0, d: dur || U.range(R.dur[0], R.dur[1], rng), drift: R.drift * k, flipDrift: (R.flipDrift || 0) * k, anchor: a.p };
  }

  function nextRegime(a, def, ctx, rng) {
    const cur = D.REGIMES[a.reg.id];
    const macro = ctx.macro;
    const clsBias = D.REGIME_CLASS_BIAS[def.cls] || {};
    const b = Math.log(a.p / a.fair);
    const entries = [];
    Object.keys(cur.next).forEach((id) => {
      const R = D.REGIMES[id];
      let w = cur.next[id];
      const net = regimeNet(R);
      if (net > 0) w *= macro.up * Math.exp(-2.5 * b);
      if (net < 0) w *= macro.down * Math.exp(2.5 * b);
      if (clsBias[id] !== undefined) w *= clsBias[id];
      if (ctx.sent > 78 && (id === 'bubble' || id === 'crash' || id === 'bull_trap' || id === 'euphoria')) w *= 1.5;
      if (ctx.sent < 22 && (id === 'capitulation' || id === 'bear_trap' || id === 'accum')) w *= 1.5;
      if (def.fear && (id === 'bubble' || id === 'euphoria' || id === 'bull')) w *= 0.3;
      entries.push([id, w]);
    });
    if (!entries.length) entries.push(['range', 1]);
    startRegime(a, def, U.weighted(entries, rng), rng);
  }

  /** One simulation step for one asset. ctx: world context for this tick. */
  function stepAsset(a, def, dt, ctx, rng) {
    a.reg.t += dt;
    if (a.reg.t >= a.reg.d) nextRegime(a, def, ctx, rng);
    const R = D.REGIMES[a.reg.id];
    const frac = a.reg.t / a.reg.d;
    let drift = a.reg.drift;
    if (R.flip && frac > R.flip) drift = a.reg.flipDrift;
    if (R.accel) drift *= 1 + R.accel * frac * frac;
    if (R.decay) drift *= 1 - frac;
    const lr = Math.log(a.p / a.reg.anchor);
    if (R.mr) drift -= R.mr * lr;
    drift += a.mom * 0.22 * R.mom;
    drift -= 0.00005 * Math.log(a.p / a.fair);
    const beta = def.beta;
    drift += ctx.macroDrift * beta * (def.cls === 'fx' ? 0.3 : 1);
    drift += ctx.crisisDrift * beta;
    if (def.fear) {
      drift += ((50 - ctx.sent) / 50) * 0.004;
      drift -= 0.004 * Math.max(0, Math.log(a.p / a.fair));
    }
    if (ctx.safeHaven && beta < 0) drift += 0.0012;
    // V2: fear sends money to safe havens
    if (ctx.sent < 35 && beta < 0) drift += 0.0003 * (35 - ctx.sent) / 35;
    // impulses (news, events, abilities)
    for (let i = a.imp.length - 1; i >= 0; i--) {
      const im = a.imp[i];
      drift += im.d;
      im.left -= dt;
      if (im.left <= 0) a.imp.splice(i, 1);
    }
    // event vol / volume multipliers
    let ev = 1, evv = 1;
    for (let i = a.ev.length - 1; i >= 0; i--) {
      const e = a.ev[i];
      ev *= e.vol || 1; evv *= e.volume || 1;
      e.left -= dt;
      if (e.left <= 0) a.ev.splice(i, 1);
    }
    a.evVol = ev; a.evVolume = evv;
    drift += a.inf;
    // V2: aggregated market actors push prices (set at 2 Hz by TE.Agents), liquidity recovers, player flow memory fades
    if (a.flow) drift += a.flow;
    if (a.lq !== undefined) {
      if (a.lq < 1) a.lq += (1 - a.lq) * Math.min(1, dt / 28);
      if (a.pf) { a.pf *= Math.exp(-dt / 60); if (Math.abs(a.pf) < 1e-5) a.pf = 0; }
      if (a.ns) { a.ns *= Math.exp(-dt / 40); if (Math.abs(a.ns) < 1e-4) a.ns = 0; }
    }
    const clsVol = ctx.clsVol[def.cls] || 1;
    const sigma = D.BASE_SIGMA * def.vol * R.vol * ctx.macroVol * ev * ctx.globalVol * clsVol;
    a.volRatio = R.vol * ev * ctx.macroVol * clsVol;
    const corr = ctx.corr;
    const common = beta < 0 ? -ctx.common : ctx.common;
    const z = corr > 0.01 ? corr * common + Math.sqrt(1 - corr * corr) * U.gauss(rng) : U.gauss(rng);
    let ret = drift * dt + sigma * Math.sqrt(dt) * z;
    if (ret > 0.4) ret = 0.4; else if (ret < -0.4) ret = -0.4;
    a.p *= Math.exp(ret);
    const floor = def.price * 2e-4;
    if (a.p < floor) a.p = floor;
    a.mom += (ret / dt - a.mom) * Math.min(1, dt / 6);
    // fair value slowly wanders
    a.fair *= Math.exp(0.0006 * Math.sqrt(dt) * U.gauss(rng));
    // OHLCV
    if (a.p > a.h) a.h = a.p;
    if (a.p < a.l) a.l = a.p;
    const zAbs = Math.abs(ret) / (sigma * Math.sqrt(dt) + 1e-12);
    a.v += R.volm * evv * (0.55 + 0.45 * Math.min(zAbs, 6)) * dt * U.range(0.6, 1.4, rng);
    a.ct += dt;
    if (a.ct >= D.CANDLE_SEC) closeCandle(a);
  }

  function closeCandle(a) {
    // 6th field (optional): share of the candle's volume generated by the player
    const pv = a.pv || 0;
    const share = pv > 0 && a.v > 0 ? Math.min(1, Math.round(pv / a.v * 100) / 100) : 0;
    a.c.push(share > 0 ? [a.o, a.h, a.l, a.p, a.v, share] : [a.o, a.h, a.l, a.p, a.v]);
    a.n++;
    if (a.c.length > CANDLE_CAP + 60) a.c.splice(0, a.c.length - CANDLE_CAP);
    // V2 volume statistics: fast / slow activity and the player's share of recent volume
    if (a.vr !== undefined) {
      const rate = a.v / D.CANDLE_SEC;
      a.vr += (rate - a.vr) * 0.12;
      a.vb += (Math.min(rate, a.vb * 4) - a.vb) * 0.004;
      if (!(a.vb > 0.05)) a.vb = 0.05;
      a.pvE += (pv - a.pvE) * 0.07;
      a.vE += (a.v - a.vE) * 0.07;
    }
    // macro candle aggregation
    if (a.mk === 0) { a.mo = a.o; a.mh = a.h; a.ml = a.l; a.mv = 0; a.mpv = 0; }
    if (a.h > a.mh) a.mh = a.h;
    if (a.l < a.ml) a.ml = a.l;
    a.mv += a.v;
    a.mpv = (a.mpv || 0) + pv;
    a.mk++;
    if (a.mk >= MACRO_EVERY) {
      const ms = a.mpv > 0 && a.mv > 0 ? Math.min(1, Math.round(a.mpv / a.mv * 100) / 100) : 0;
      a.mc.push(ms > 0 ? [a.mo, a.mh, a.ml, a.p, a.mv, ms] : [a.mo, a.mh, a.ml, a.p, a.mv]);
      if (a.mc.length > MACRO_CAP + 40) a.mc.splice(0, a.mc.length - MACRO_CAP);
      a.mk = 0;
    }
    a.o = a.h = a.l = a.p;
    a.v = 0;
    a.pv = 0;
    a.ct = 0;
  }

  /* ---------------- world ---------------- */
  M.ctx = { macro: D.MACRO.neutral, macroDrift: 0, macroVol: 1, crisisDrift: 0, corr: 0.15, common: 0, sent: 50, globalVol: 1, clsVol: {}, safeHaven: false };

  function buildCtx(w, rng) {
    const s = TE.state;
    const c = M.ctx;
    const macro = D.MACRO[w.macro.id] || D.MACRO.neutral;
    c.macro = macro;
    c.macroDrift = macro.drift;
    c.macroVol = macro.vol;
    c.sent = w.sent;
    c.common = U.gauss(rng);
    c.corr = macro.corr || 0.15;
    c.crisisDrift = 0;
    c.globalVol = s && s.run.challenge === 'extremevol' ? 2.5 : 1;
    c.clsVol = {};
    c.safeHaven = false;
    if (TE.Events) TE.Events.applyWorldCtx(c);
    return c;
  }

  function nextMacro(w, rng) {
    const s = TE.state;
    const cur = D.MACRO[w.macro.id] || D.MACRO.neutral;
    if (s && s.run.challenge === 'bearmarket') { w.macro = { id: 'bear', t: 0, d: 120 }; return; }
    const bull = TE.Mods ? TE.Mods.get('macro.bull') : 0;
    const entries = Object.keys(cur.next).map((id) => [id, cur.next[id] * (id === 'bull' || id === 'recovery' ? 1 + bull : 1)]);
    const id = U.weighted(entries, rng);
    const m = D.MACRO[id];
    w.macro = { id, t: 0, d: U.range(m.dur[0], m.dur[1], rng) };
    TE.Bus.emit('macro', id);
  }

  M.tick = function (dt) {
    const s = TE.state;
    const w = s.market;
    w.t += dt;
    if (w.macroForce) {
      w.macroForce.left -= dt;
      if (w.macroForce.left <= 0) { w.macroForce = null; w.macro = { id: 'neutral', t: 0, d: 60 }; }
    } else if (!(s.run.events.crisis && s.run.events.crisis.active)) {
      w.macro.t += dt;
      if (w.macro.t >= w.macro.d) nextMacro(w);
    }
    const ctx = buildCtx(w);
    let sumMom = 0, sumVol = 0, n = 0;
    const ids = Object.keys(s.run.unlocked);
    for (let i = 0; i < ids.length; i++) {
      const def = D.ASSET_MAP[ids[i]];
      const a = w.assets[ids[i]];
      if (!def || !a) continue;
      stepAsset(a, def, dt, ctx);
      if (!def.fear) { sumMom += a.mom / Math.max(0.2, def.trend); sumVol += a.volRatio; n++; }
    }
    if (n) {
      const avgMom = sumMom / n, avgVol = sumVol / n;
      let target = 50 + ctx.macro.sent + 30 * Math.tanh(avgMom * 420) - 12 * (avgVol - 1) + (TE.Events ? TE.Events.sentimentShift() : 0);
      target = U.clamp(target, 2, 98);
      w.sent += (target - w.sent) * Math.min(1, dt / 8);
    }
  };

  /** Ensure the asset exists in the world, with pre-generated history. */
  M.ensure = function (id) {
    const w = TE.state.market;
    if (w.assets[id]) return w.assets[id];
    const def = D.ASSET_MAP[id];
    const a = newAsset(def);
    startRegime(a, def, U.pick(['bull', 'range', 'accum', 'bear', 'lowvol']));
    // warm-up history (~12 minutes) so charts are never empty
    const ctx = { macro: D.MACRO.neutral, macroDrift: 0, macroVol: 1, crisisDrift: 0, corr: 0, common: 0, sent: 50, globalVol: 1, clsVol: {}, safeHaven: false };
    for (let i = 0; i < 1440; i++) stepAsset(a, def, 0.5, ctx);
    a.c = a.c.slice(-CANDLE_CAP);
    w.assets[id] = a;
    return a;
  };

  M.unlock = function (id, silent) {
    const s = TE.state;
    if (!D.ASSET_MAP[id]) return false;
    if (s.run.challenge === 'cryptoonly' && D.ASSET_MAP[id].cls !== 'crypto') return false;
    if (s.run.unlocked[id]) return false;
    M.ensure(id);
    s.run.unlocked[id] = true;
    if (!silent) TE.Bus.emit('asset:unlocked', id);
    return true;
  };

  M.init = function () {
    const s = TE.state;
    if (!s.market) s.market = M.createWorld();
    if (!s.market.ag) s.market.ag = {};
    Object.keys(s.market.assets).forEach((id) => M.upgradeAsset(s.market.assets[id]));
    Object.keys(s.run.unlocked).forEach((id) => M.ensure(id));
    if (!s.run.unlocked[s.run.activeAsset]) s.run.activeAsset = Object.keys(s.run.unlocked)[0];
  };

  /** First-run nicety: make the very first market readable (a clean uptrend). */
  M.scriptStart = function (id) {
    const a = TE.state.market.assets[id];
    const def = D.ASSET_MAP[id];
    if (a && def) startRegime(a, def, 'bull', null, 55);
  };

  /* ---------------- queries ---------------- */
  M.asset = (id) => TE.state.market.assets[id];
  M.def = (id) => D.ASSET_MAP[id];
  M.mid = (id) => { const a = TE.state.market.assets[id]; return a ? a.p : 0; };
  M.spread = function (id) {
    const def = D.ASSET_MAP[id], a = M.asset(id);
    let sp = def.spread * TE.Mods.get('spread');
    if (a) {
      const cls = D.REGIMES[a.reg.id].cls; if (cls === 'panic') sp *= 2; else if (cls === 'volatile') sp *= 1.4; sp *= Math.min(3, a.evVol);
      // V2: thin or consumed liquidity and retreating market makers widen the spread
      sp *= U.clamp(1 / Math.sqrt(Math.max(0.05, (a.lq || 1) * (a.mmP || 1))), 0.85, 2.2);
    }
    if (TE.state.run.challenge === 'highfees') sp *= 3;
    return sp;
  };
  M.bid = (id) => M.mid(id) * (1 - M.spread(id) / 2);
  M.ask = (id) => M.mid(id) * (1 + M.spread(id) / 2);
  M.change = function (id, sec) {
    const a = M.asset(id);
    if (!a || !a.c.length) return 0;
    const back = Math.max(1, Math.round((sec || 300) / D.CANDLE_SEC));
    const i = Math.max(0, a.c.length - back);
    return a.p / a.c[i][0] - 1;
  };
  M.regime = (id) => { const a = M.asset(id); return a ? D.REGIMES[a.reg.id] : null; };
  M.regimeClass = (id) => { const r = M.regime(id); return r ? r.cls : 'range'; };
  /** Regime as seen by the detector: traps look like trends until they flip. */
  M.regimeView = function (id) {
    const a = M.asset(id);
    if (!a) return null;
    const R = D.REGIMES[a.reg.id];
    const frac = a.reg.t / a.reg.d;
    let shown = R, conf;
    if (R.flip && frac < R.flip && a.reg.id !== 'flash') { shown = R.dir > 0 ? D.REGIMES.bull : D.REGIMES.bear; conf = 0.55 + 0.2 * frac; }
    else conf = U.clamp(0.62 + 0.35 * Math.min(1, frac * 2), 0, 0.97);
    return { name: shown.name, cls: shown.cls, conf, left: a.reg.d - a.reg.t, hint: shown.hint };
  };
  /** Probability that price is higher in ~10s, from the hidden drift (with noise). */
  M.forecast = function (id) {
    const a = M.asset(id), def = D.ASSET_MAP[id];
    if (!a) return 0.5;
    const R = D.REGIMES[a.reg.id];
    const frac = a.reg.t / a.reg.d;
    let drift = a.reg.drift;
    if (R.flip && frac > R.flip - 0.08) drift = a.reg.flipDrift;
    if (R.accel) drift *= 1 + R.accel * frac * frac;
    for (let i = 0; i < a.imp.length; i++) drift += a.imp[i].d;
    drift += a.inf + (a.flow || 0);
    const sigma = D.BASE_SIGMA * def.vol * R.vol * a.evVol;
    const zz = (drift * 10) / (sigma * Math.sqrt(10) + 1e-12);
    const p = 0.5 * (1 + Math.tanh(zz * 0.9));
    a._fc = a._fc === undefined ? p : a._fc + (p - a._fc) * 0.15;
    return a._fc;
  };
  M.sentiment = () => (TE.state && TE.state.market ? TE.state.market.sent : 50);
  M.sentimentLabel = function (v) {
    if (v < 20) return 'PEUR EXTRÊME'; if (v < 40) return 'PEUR'; if (v <= 60) return 'NEUTRE'; if (v <= 80) return 'AVIDITÉ'; return 'AVIDITÉ EXTRÊME';
  };
  M.macro = () => D.MACRO[TE.state.market.macro.id] || D.MACRO.neutral;
  M.activityIndex = function () {
    const s = TE.state; let sum = 0, n = 0;
    Object.keys(s.run.unlocked).forEach((id) => { const a = s.market.assets[id]; if (a) { sum += a.volRatio; n++; } });
    return n ? sum / n : 1;
  };
  /** V2: traded volume vs its usual level, averaged over unlocked markets (player, actors and bots all count). */
  M.volumeIndex = function () {
    const s = TE.state; let sum = 0, n = 0;
    Object.keys(s.run.unlocked).forEach((id) => { const a = s.market.assets[id]; if (a && a.vb > 0) { sum += U.clamp(a.vr / a.vb, 0.2, 4); n++; } });
    return n ? sum / n : 1;
  };

  /* ---------------- V2: liquidity, market impact & slippage ----------------
   * Effective liquidity L ($ of notional the book absorbs before moving a lot) scales with the market's depth and with
   * the size of your desk, so a 100 $ trader is a minnow while a late-game desk can become the whale.
   * Impact of an order of notional N: I = 5 % × (N / L)^0.8 (capped at 20 %). You fill at about half the impact
   * (slippage); the price moves by I, and half of the move fades over ~25 s. */
  const LIQ_REF = 6000;
  M.LIQ_DEPTH_K = 40;
  M.LIQ_DESK_K = 8;
  const IMPACT_K = 0.05;
  const VOL_K = 40;
  const REG_LIQ = { calm: 1.15, trend_up: 1, trend_down: 0.95, range: 1.05, volatile: 0.75, euphoria: 0.9, panic: 0.55, trap: 0.95 };
  const MACRO_LIQ = { neutral: 1, bull: 1.05, bear: 0.9, recovery: 0.95, crisis: 0.55 };
  /** Dynamic part of liquidity (1 = normal). */
  M.liqFactor = function (id) {
    const a = M.asset(id);
    if (!a) return 1;
    const s = TE.state;
    let f = (a.lq || 1) * (REG_LIQ[D.REGIMES[a.reg.id].cls] || 1) * (MACRO_LIQ[s.market.macro.id] || 1) / Math.sqrt(Math.max(1, a.evVol || 1)) * (a.mmP || 1);
    const sent = s.market.sent;
    if (sent < 30) f *= 0.7 + 0.01 * sent;
    return U.clamp(f, 0.12, 1.6);
  };
  M.liquidityBase = function (id) {
    const def = D.ASSET_MAP[id];
    const acc = TE.Mods.get('manual.access');
    const desk = TE.Economy ? TE.Mods.get('manual.desk') * TE.Economy.capBase() : 0;
    return Math.max(def.depth * acc * M.LIQ_DEPTH_K, desk * M.LIQ_DESK_K * Math.pow(def.depth / LIQ_REF, 0.8));
  };
  M.liquidity = (id) => M.liquidityBase(id) * M.liqFactor(id);
  M.impactPct = (x) => (x > 0 ? Math.min(0.2, IMPACT_K * Math.pow(x, 0.8)) : 0);
  M.IMPACT_LEVELS = [[0.0005, 'MINIME', 'lo'], [0.005, 'FAIBLE', 'lo'], [0.02, 'IMPORTANT', 'mid'], [Infinity, 'MASSIF', 'hi']];
  M.impactLabel = function (pct) { for (let i = 0; i < M.IMPACT_LEVELS.length; i++) if (pct < M.IMPACT_LEVELS[i][0]) return M.IMPACT_LEVELS[i]; return M.IMPACT_LEVELS[3]; };
  /** Preview for an order of `notional` on `id`: {x, pct, slip, label, lvl}. */
  M.impactEst = function (id, notional) {
    const L = M.liquidity(id);
    const x = L > 0 ? notional / L : 0;
    const pct = M.impactPct(x);
    const lb = M.impactLabel(pct);
    return { x, pct, slip: pct / 2, label: lb[1], lvl: lb[2], L };
  };
  /** Executes the price impact of an order (side ±1). Returns the impact actually applied (fraction). */
  M.applyImpact = function (id, side, notional, src) {
    const a = M.asset(id);
    if (!a || !(notional > 0)) return 0;
    const L = M.liquidity(id);
    const x = notional / Math.max(1e-9, L);
    const I = M.impactPct(x);
    if (I > 1e-7) {
      a.p *= Math.exp(side * I);
      if (a.p > a.h) a.h = a.p;
      if (a.p < a.l) a.l = a.p;
      a.imp.push({ d: (-side * I * 0.5) / 25, left: 25, src: 'impact' });
      if (a.imp.length > 40) a.imp.splice(0, a.imp.length - 40);
    }
    a.lq = Math.max(0.2, (a.lq || 1) - Math.min(0.6, x * 0.6));
    const vol = VOL_K * x;
    a.v += vol;
    if (src === 'player') { a.pv = (a.pv || 0) + vol; a.pf = (a.pf || 0) + side * Math.min(2, x); }
    return I;
  };
  /** Extra traded volume (units of normal activity). */
  M.addVolume = function (id, units) { const a = M.asset(id); if (a && units > 0) a.v += Math.min(40, units); };
  /** Player's share of the recent volume on an asset (≈ last minute). */
  M.playerShare = function (id) { const a = M.asset(id); return a && a.vE > 0 ? U.clamp(a.pvE / a.vE, 0, 1) : 0; };
  /** News / announcement impact marker on the chart. */
  M.newsMark = function (id, dir, label) { M.addMarker(id, 'N', M.mid(id), { d: dir || 0, lb: label || '' }); };

  /* ---------------- actions (events, abilities, influence) ---------------- */
  M.impulse = function (id, drift, dur, src) {
    const a = M.asset(id);
    if (a) a.imp.push({ d: drift, left: dur, src: src || '' });
  };
  M.eventFx = function (id, fx, dur) {
    const a = M.asset(id);
    if (a) a.ev.push({ vol: fx.vol || 1, volume: fx.volume || 1, left: dur });
  };
  M.jump = function (id, pct) {
    const a = M.asset(id);
    if (!a) return;
    a.p *= 1 + pct;
    if (a.p > a.h) a.h = a.p;
    if (a.p < a.l) a.l = a.p;
    a.v += 30;
  };
  M.forceRegime = function (id, regId, dur, boost) {
    const a = M.asset(id), def = D.ASSET_MAP[id];
    if (!a || !def || !D.REGIMES[regId]) return;
    startRegime(a, def, regId, null, dur);
    if (boost) { a.reg.drift *= boost; a.reg.flipDrift *= boost; }
  };
  M.forceMacro = function (id, dur) {
    const w = TE.state.market;
    w.macro = { id, t: 0, d: dur };
    w.macroForce = { left: dur };
    TE.Bus.emit('macro', id);
  };
  M.addMarker = function (id, type, price, extra) {
    const a = M.asset(id);
    if (!a) return;
    a.marks.push(Object.assign({ n: a.n, p: price, t: type }, extra || {}));
    if (a.marks.length > 80) a.marks.splice(0, a.marks.length - 80);
  };
  M.addBotMark = function (id, side, color) {
    const a = M.asset(id);
    if (!a) return;
    a.botMarks.push({ n: a.n, s: side, c: color });
    if (a.botMarks.length > 120) a.botMarks.splice(0, a.botMarks.length - 120);
  };

  /* ---------------- standalone simulator (daily challenge) ---------------- */
  M.simulatePath = function (assetDef, seed, seconds, step) {
    const rng = U.mulberry32(seed);
    const a = newAsset(assetDef, rng);
    a.p = assetDef.price; a.o = a.h = a.l = a.p;
    startRegime(a, assetDef, U.pick(['range', 'accum', 'lowvol'], rng), rng);
    const ctx = { macro: D.MACRO.neutral, macroDrift: 0, macroVol: 1, crisisDrift: 0, corr: 0, common: 0, sent: 50, globalVol: 1, clsVol: {}, safeHaven: false };
    // pre-history (60 candles)
    for (let i = 0; i < 120 / step; i++) stepAsset(a, assetDef, step, ctx, rng);
    const hist = a.c.slice();
    const ticks = [];
    const regimes = [];
    a.c = [];
    for (let t = 0; t < seconds; t += step) {
      stepAsset(a, assetDef, step, ctx, rng);
      ticks.push(a.p);
      regimes.push(a.reg.id);
    }
    return { hist, ticks, regimes };
  };
})(window.TE);
