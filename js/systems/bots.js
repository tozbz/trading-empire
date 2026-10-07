/* Bot fleets. Each fleet trades in batches on real (simulated) markets; outcomes depend on the
 * fleet's stats and on the regime of the market it picked. Large fleets diversify, but a common
 * shock per batch keeps returns realistically correlated. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const B = (TE.Bots = {});
  const CRIT_TABLE = [[5, 0.8], [10, 0.17], [50, 0.03]];
  const CRIT_AVG = 0.8 * 5 + 0.17 * 10 + 0.03 * 50;
  const FLEET_IDS = D.BOTS.map((b) => b.id).concat(['desk']);
  B.FLEET_IDS = FLEET_IDS;

  function evBase(def) { return def.winrate * def.win - (1 - def.winrate) * def.loss - def.fee; }
  B.baseCap = (def) => (def.income * def.interval) / evBase(def);

  B.st = function (id) {
    const r = TE.state.run.bots;
    return r[id] || (r[id] = { n: 0, paused: false, pnl: 0, trades: 0, wins: 0, losses: 0, best: 0, worst: 0, hist: [], spark: [], t: 0, fees: 0, crits: 0 });
  };
  B.count = (id) => {
    if (id === 'desk') { const st = TE.state.run.staff; return (st.junior || 0) + (st.senior || 0) * 6; }
    const b = TE.state.run.bots[id]; return b ? b.n : 0;
  };
  B.totalUnits = () => D.BOTS.reduce((s, b) => s + B.count(b.id), 0);
  B.disabled = () => TE.state.run.challenge === 'nobots';
  B.unlocked = function (id) {
    const def = D.BOT_MAP[id];
    if (!def) return false;
    return B.count(id) > 0 || (TE.state.run.earnings >= def.unlockEarn && TE.Progress.eraOk(def.cost));
  };
  B.costMult = () => TE.Mods.get('bot.cost');
  B.cost = (id, qty) => { const def = D.BOT_MAP[id]; return U.geoCost(def.cost * B.costMult(), def.growth, B.count(id), qty); };
  B.maxAffordable = (id, money) => { const def = D.BOT_MAP[id]; return U.geoMax(def.cost * B.costMult(), def.growth, B.count(id), money === undefined ? TE.state.run.cash : money); };

  B.buy = function (id, qty) {
    if (B.disabled() || !B.unlocked(id) || qty <= 0) return false;
    const cost = B.cost(id, qty);
    if (!TE.Economy.spend(cost)) return false;
    const st = B.st(id);
    const before = st.n;
    st.n += qty;
    B.invalidate();
    TE.Stats.add('botsBought', qty);
    TE.Stats.max('maxBots', B.totalUnits());
    TE.Stats.max('botTypes', D.BOTS.filter((b) => B.count(b.id) > 0).length);
    D.BOT_MILESTONES.forEach((m) => { if (before < m.n && st.n >= m.n) TE.Bus.emit('bot:milestone', { id, m }); });
    const g0 = B.gradeIdx(before), g1 = B.gradeIdx(st.n);
    if (g1 > g0) { TE.Bus.emit('bot:grade', { id, grade: D.BOT_GRADES[g1] }); TE.Stats.max('bestGrade', g1); }
    TE.Mods.dirty = true;
    TE.Bus.emit('bot:buy', { id, qty });
    return true;
  };

  B.gradeIdx = function (n) { let g = 0; D.BOT_GRADES.forEach((x, i) => { if (n >= x.min) g = i; }); return g; };
  B.grade = (id) => D.BOT_GRADES[B.gradeIdx(B.count(id))];
  B.milestone = function (id) {
    const n = B.count(id);
    let profit = 1, speed = 1, next = null;
    for (let i = 0; i < D.BOT_MILESTONES.length; i++) {
      const m = D.BOT_MILESTONES[i];
      if (n >= m.n) { if (m.profit) profit *= m.profit; if (m.speed) speed *= m.speed; } else if (!next) next = m;
    }
    return { profit, speed, next };
  };

  B.riskProfile = function () {
    const s = TE.state;
    if (s.run.challenge === 'noleverage') return D.RISK_PROFILES.conservative;
    return D.RISK_PROFILES[s.run.risk] || D.RISK_PROFILES.balanced;
  };

  /** Latency speed factor for latency-sensitive strategies. */
  B.latencyFactor = function (def) {
    if (!def.latency) return 1;
    const lat = TE.Firm ? TE.Firm.latency() : D.BASE_LATENCY;
    return Math.pow(D.BASE_LATENCY / Math.max(lat, 1e-9), 0.14);
  };
  B.computeFactor = function (def) {
    if (!def.compute) return 1;
    const c = TE.Firm ? TE.Firm.compute() : 0;
    return 1 + 0.12 * U.log10(1 + c);
  };

  /* Asset selection & regime affinity. */
  function affinityOf(def, cls) {
    let a = (def.aff && def.aff[cls]) || 0;
    if (a < 0) a *= 1 - TE.Mods.get('bot.adapt');
    return a;
  }
  function eligibleAssets() {
    const s = TE.state;
    return Object.keys(s.run.unlocked);
  }
  function pickAsset(def) {
    const ids = eligibleAssets();
    const scan = TE.Mods.get('bot.scanner');
    if (scan <= 0 || ids.length < 2) return U.pick(ids);
    const entries = ids.map((id) => [id, Math.exp(scan * 12 * affinityOf(def, TE.Market.regimeClass(id)))]);
    return U.weighted(entries);
  }
  /** Expected affinity & volatility scale across markets (matches pickAsset weighting). */
  function expectedEnv(def) {
    const ids = eligibleAssets();
    const scan = TE.Mods.get('bot.scanner');
    let tw = 0, aff = 0, vs = 0;
    for (let i = 0; i < ids.length; i++) {
      const cls = TE.Market.regimeClass(ids[i]);
      const a = affinityOf(def, cls);
      const w = scan > 0 ? Math.exp(scan * 12 * a) : 1;
      const asset = TE.Market.asset(ids[i]);
      tw += w; aff += w * a; vs += w * volScale(asset);
    }
    return tw ? { aff: aff / tw, vs: vs / tw } : { aff: 0, vs: 1 };
  }
  function volScale(a) { return a ? U.clamp(Math.sqrt(a.volRatio || 1), 0.6, 2.4) : 1; }

  /** Full computed stats for a fleet (fresh every call; cheap). */
  B.stats = function (id) {
    const def = D.BOT_MAP[id];
    const m = (k) => TE.Mods.get(k);
    const s = TE.state;
    const ms = id === 'desk' ? { profit: 1, speed: 1, next: null } : B.milestone(id);
    const grade = id === 'desk' ? D.BOT_GRADES[0] : B.grade(id);
    const risk = B.riskProfile();
    const ev = TE.Events ? TE.Events.botMods(id) : { win: 0, speed: 1 };
    const cap = B.baseCap(def) * m('bot.all.capital') * m('bot.' + id + '.capital');
    const speed = m('bot.all.speed') * m('bot.' + id + '.speed') * ms.speed * B.latencyFactor(def) * ev.speed;
    const interval = def.interval / Math.max(1e-6, speed);
    const winrate = def.winrate + m('bot.all.winrate') + m('bot.' + id + '.winrate') + (id === 'desk' ? 0 : risk.win) + ev.win;
    const win = def.win * m('bot.all.win') * m('bot.' + id + '.win');
    const loss = def.loss * m('bot.all.loss') * m('bot.' + id + '.loss');
    const fee = def.fee * m('bot.all.fee') * (s.run.challenge === 'highfees' ? 5 : 1);
    const crit = m('bot.all.crit') + m('bot.' + id + '.crit') + grade.crit;
    let profit = m('bot.all.profit') * m('bot.' + id + '.profit') * ms.profit * B.computeFactor(def);
    if (id === 'desk') profit = m('staff.desk') * m('bot.desk.profit') * m('staff.power');
    if (def.perMarket) profit *= 1 + def.perMarket * Math.max(0, Object.keys(s.run.unlocked).length - 1);
    if (TE.Mods.has('bot.synergy') && id !== 'desk') profit *= 1 + 0.01 * Math.floor(B.totalUnits() / 10);
    const lev = id === 'desk' ? 1 : risk.lev;
    const units = B.count(id);
    const env = expectedEnv(def);
    const p = U.clamp(winrate + env.aff, 0.03, 0.9);
    let evPct = p * win * env.vs - (1 - p) * loss * env.vs - fee;
    if (evPct > 0) evPct *= 1 + Math.min(0.9, crit) * (CRIT_AVG * m('crit.mult') - 1) * 0.8;
    evPct -= (risk.tail || 0) * m('bot.tail') * 0.2;
    const tps = 1 / interval;
    const g = TE.Economy.globalMult();
    const incomeProp = units * cap * lev * evPct * tps * profit * g;
    return { def, id, units, cap, capTotal: units * cap, speed, interval, winrate, p, win, loss, fee, crit, profit, lev, evPct, tps, env, ms, grade,
      incomeProp, risk };
  };

  B.totalCap = function () {
    let c = 0;
    if (B.disabled()) return 0;
    D.BOTS.forEach((b) => { const n = B.count(b.id); if (n) c += n * B.baseCap(b) * TE.Mods.get('bot.all.capital') * TE.Mods.get('bot.' + b.id + '.capital'); });
    return c;
  };

  /* ---------------- expected income (UI, offline, contracts) ---------------- */
  B._exp = { t: -1, total: 0, byId: {}, fund: 0 };
  /** Drop the cached expectation (and its saturation factor) — called whenever capital or modifiers change, so a big
   *  purchase can never be paid for a moment at the old, unsaturated rate (v1.1 bug). */
  B.invalidate = function () { B._exp.t = -1e12; };
  TE.Bus.on('mods:rebuilt', () => B.invalidate());
  B.expected = function (force) {
    const s = TE.state;
    const now = s.run.time;
    if (!force && Math.abs(now - B._exp.t) < 0.5) return B._exp;
    const byId = {};
    let total = 0, fund = 0, fundRate = 0;
    const totalCap = B.totalCap();
    const aum = TE.Fund ? TE.Fund.deployed() : 0;
    const perf = TE.Fund && TE.Fund.active() ? TE.Mods.get('fund.perf') : 0;
    FLEET_IDS.forEach((id) => {
      if (id !== 'desk' && B.disabled()) { byId[id] = 0; return; }
      const n = B.count(id);
      if (!n) { byId[id] = 0; return; }
      const st = B.st(id);
      if (st.paused) { byId[id] = 0; return; }
      const x = B.stats(id);
      let inc = x.incomeProp;
      if (id !== 'desk' && aum > 0 && totalCap > 0) {
        const share = aum * (x.capTotal / totalCap);
        const f = share * x.lev * x.evPct * x.tps * x.profit * TE.Economy.globalMult() * perf;
        if (f > 0) { inc += f; fund += f; fundRate += (x.capTotal / totalCap) * x.lev * x.evPct * x.tps; }
      }
      byId[id] = inc;
      total += inc;
    });
    // market saturation: raw strategy income is capped by the era's market capacity.
    // In-run income (everything except prestige bonuses) saturates against capacity;
    // prestige bonuses multiply the ceiling itself.
    const mg = TE.Fund ? TE.Fund.mgmtIncomeRaw() : 0;
    const ceil = TE.Economy.ceilingMult();
    const raw = (total + mg) / ceil;
    const W = TE.Economy.capacity();
    const f = W / (raw + W);
    Object.keys(byId).forEach((k) => { byId[k] *= f; });
    // empire divisions are real-economy businesses: they saturate separately, up to DIV_CAPACITY × capacity
    const divRaw = TE.Empire ? TE.Empire.divIncomeRaw() / ceil : 0;
    const Wd = W * TE.Economy.DIV_CAPACITY;
    const fd = Wd / (divRaw + Wd);
    B._exp = { t: now, total: total * f, byId, fund: fund * f, fundRate, raw, sat: raw / (raw + W), f, fd, divSat: divRaw / (divRaw + Wd) };
    TE.Economy._sat = f;
    TE.Economy._satDiv = fd;
    return B._exp;
  };

  /* ---------------- live trading ---------------- */
  function rollCrit() {
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < CRIT_TABLE.length; i++) { acc += CRIT_TABLE[i][1]; if (r < acc) return CRIT_TABLE[i][0]; }
    return 5;
  }

  B.tick = function (dt) {
    const s = TE.state;
    const totalCap = B.totalCap();
    const aum = TE.Fund ? TE.Fund.deployed() : 0;
    for (let f = 0; f < FLEET_IDS.length; f++) {
      const id = FLEET_IDS[f];
      if (id !== 'desk' && B.disabled()) continue;
      const n = B.count(id);
      if (!n) continue;
      const st = B.st(id);
      if (st.paused) continue;
      const x = B.stats(id);
      st.t += dt;
      if (st.t < x.interval) continue;
      const k = Math.min(1e9, Math.floor(st.t / x.interval));
      st.t -= k * x.interval;
      if (st.t > x.interval) st.t = 0;
      resolveBatch(id, x, k, totalCap, aum);
    }
  };

  function resolveBatch(id, x, k, totalCap, aum) {
    const s = TE.state;
    const def = x.def;
    const st = B.st(id);
    const assetId = pickAsset(def);
    const asset = TE.Market.asset(assetId);
    const cls = TE.Market.regimeClass(assetId);
    const aff = affinityOf(def, cls);
    const vs = volScale(asset);
    const p = U.clamp(x.winrate + aff, 0.03, 0.9);
    const N = x.units * k;
    // common shock: everyone in the batch trades the same market at the same moment
    const common = U.gauss() * 0.1 * (1 + (vs - 1) * 0.5) / Math.sqrt(Math.max(1, k * 0.25));
    let winFrac;
    if (N <= 24) {
      let w = 0;
      const pp = U.clamp(p + common, 0.01, 0.99);
      for (let i = 0; i < N; i++) if (Math.random() < pp) w++;
      winFrac = w / N;
    } else {
      winFrac = U.clamp(p + common + Math.sqrt((p * (1 - p)) / N) * U.gauss(), 0, 1);
    }
    const rw = x.win * vs * (1 + 0.2 * U.gauss() / Math.sqrt(Math.max(1, N * winFrac)));
    const rl = x.loss * vs * (1 + 0.2 * U.gauss() / Math.sqrt(Math.max(1, N * (1 - winFrac))));
    let pct = (winFrac * Math.max(0, rw) - (1 - winFrac) * Math.max(0, rl) - x.fee) * x.lev;
    // tail risk (degenerate profile, harvester blow-ups)
    let blowup = false;
    const tail = (x.risk.tail || 0) * TE.Mods.get('bot.tail');
    if (tail > 0 && Math.random() < 1 - Math.pow(1 - tail, k)) { pct -= 0.2 * x.lev / k; blowup = true; }
    const g = TE.Economy.globalMult() * TE.Economy.satFactor();
    const capUsed = x.capTotal * k;
    let pnl = capUsed * pct * x.profit * g;
    // critical trades: only the winning trades that actually crit are boosted, not the whole batch
    let crit = 0, boost = 1;
    if (pnl > 0 && x.crit > 0) {
      const nw = Math.max(1, Math.round(N * winFrac));
      const c = Math.min(0.9, x.crit);
      let nc = 0;
      if (nw <= 24) { for (let i = 0; i < nw; i++) if (Math.random() < c) nc++; }
      else nc = Math.max(0, Math.round(nw * c + Math.sqrt(nw * c * (1 - c)) * U.gauss()));
      if (nc > 0) {
        const cm = TE.Mods.get('crit.mult');
        crit = rollCrit() * cm;
        const avg = nc === 1 ? crit : (crit + (nc - 1) * CRIT_AVG * cm) / nc;
        boost = 1 + (nc / N) * (avg - 1);
        pnl *= boost;
        st.crits++;
        TE.Stats.add('critsBot');
        TE.Stats.max('biggestCrit', crit);
      }
    }
    // fund share
    let fee = 0;
    if (id !== 'desk' && aum > 0 && totalCap > 0 && TE.Fund) {
      fee = TE.Fund.onBatch(aum * (x.capTotal / totalCap) * k, pct, x.profit * g * boost);
    }
    pnl = U.cap(pnl);
    if (pnl >= 0) TE.Economy.earn(pnl, id); else TE.Economy.lose(-pnl, id);
    if (fee > 0) TE.Economy.earn(fee, 'fund');
    const total = pnl + fee;
    st.pnl += total;
    st.trades += N;
    const wins = Math.round(N * winFrac);
    st.wins += wins;
    st.losses += N - wins;
    if (total > st.best) st.best = total;
    if (total < st.worst) st.worst = total;
    TE.Stats.add('botTrades', N);
    // direction taken by the fleet on that market (coherent with its style and the regime)
    const side = def.style === 'trend' ? (D.REGIMES[asset.reg.id].dir >= 0 ? 1 : -1) : def.style === 'fade' ? (D.REGIMES[asset.reg.id].dir >= 0 ? -1 : 1) : Math.random() < 0.5 ? 1 : -1;
    // V2: aggregated exposure per fleet & market (representative layer — income still comes from the formulas above)
    const deployed = (x.capTotal + (id !== 'desk' && aum > 0 && totalCap > 0 ? aum * (x.capTotal / totalCap) : 0)) * x.lev;
    trackExposure(id, assetId, def.style === 'arb' ? 0 : side, deployed, k * x.interval);
    // their orders print volume on the market they trade
    const L = TE.Market.liquidity(assetId);
    if (L > 0) TE.Market.addVolume(assetId, Math.min(3, 0.4 * U.log10(1 + deployed * 0.02 / L)));
    const entry = { t: s.run.time, a: assetId, side, pnl: total, pct, n: N, w: wins, crit, blow: blowup, arb: def.style === 'arb' };
    st.hist.push(entry);
    if (st.hist.length > 14) st.hist.shift();
    if (s.settings.botMarkers && assetId === s.run.activeAsset && Math.random() < 0.6) TE.Market.addBotMark(assetId, side, def.color);
    TE.Bus.emit('bot:batch', { id, entry, def });
  }

  /* ---------------- V2: aggregated exposure ---------------- */
  function trackExposure(fleet, assetId, side, deployed, elapsed) {
    const r = TE.state.run;
    const ex = r.botExpo || (r.botExpo = {});
    const m = ex[fleet] || (ex[fleet] = {});
    const decay = Math.exp(-elapsed / 45);
    Object.keys(m).forEach((a) => { m[a] *= decay; if (Math.abs(m[a]) < 1e-9) delete m[a]; });
    if (side) m[assetId] = +(((m[assetId] || 0) + side * deployed * 0.35).toPrecision(4));
    const keys = Object.keys(m);
    if (keys.length > 6) { keys.sort((a, b) => Math.abs(m[a]) - Math.abs(m[b])); delete m[keys[0]]; }
  }
  /** Exposure of a fleet: [{asset, v}] sorted by size (signed notional). */
  B.exposure = function (fleet) {
    const m = (TE.state.run.botExpo || {})[fleet] || {};
    return Object.keys(m).map((a) => ({ asset: a, v: m[a] })).filter((x) => TE.state.run.unlocked[x.asset]).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  };
  /** Net exposure of all fleets on one market. */
  B.netOn = function (asset) {
    const ex = TE.state.run.botExpo || {};
    let v = 0; Object.keys(ex).forEach((f) => { v += ex[f][asset] || 0; });
    return v;
  };

  /** Legacy autobuyer: buy the most cost-efficient affordable fleet with up to 50% of cash. */
  B.autoBuy = function () {
    const s = TE.state;
    if (!TE.Prestige.lperk('autobots') || !s.settings.autoBuy.bots || B.disabled()) return;
    const budget = s.run.cash * 0.5;
    let best = null, bestScore = 0;
    D.BOTS.forEach((b) => {
      if (!B.unlocked(b.id)) return;
      const c = B.cost(b.id, 1);
      if (c > budget) return;
      const x = B.stats(b.id);
      const per = x.units > 0 ? x.incomeProp / x.units : x.cap * x.lev * x.evPct * x.tps * x.profit;
      const score = per / c;
      if (score > bestScore) { bestScore = score; best = b.id; }
    });
    if (best) B.buy(best, 1);
  };

  /* Mods provider: nothing static here (milestones applied directly in stats). */
})(window.TE);
