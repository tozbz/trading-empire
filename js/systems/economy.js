/* Economy: cash flow, income rates, net worth, global multipliers, buy-mode helpers. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const E = (TE.Economy = {});
  let flowAcc = 0, flowBots = 0;

  E.globalMult = function () {
    let g = TE.Mods.get('income.global');
    const c = TE.state.run.events.crisis;
    if (c && c.active) g *= 1 + TE.Mods.get('crisis.gain');
    return g;
  };

  E.earn = function (amount, src) {
    if (!(amount > 0)) return;
    const s = TE.state;
    amount = U.cap(amount);
    s.run.cash = U.cap(s.run.cash + amount);
    s.run.earnings = U.cap(s.run.earnings + amount);
    TE.Stats.add('earned', amount);
    flowAcc += amount;
    if (src && src !== 'manual' && src !== 'reward') flowBots += amount;
    TE.Bus.emit('earn', { amount, src });
  };
  /** Count income that already landed in cash (e.g. a position settlement) toward earnings. */
  E.credit = function (amount) {
    if (!(amount > 0)) return;
    const s = TE.state;
    s.run.earnings = U.cap(s.run.earnings + amount);
    TE.Stats.add('earned', amount);
    flowAcc += amount;
    TE.Bus.emit('earn', { amount, src: 'manual' });
  };
  /** Count a loss that was already settled in cash (e.g. a losing manual trade) — keeps crisis PnL honest. */
  E.debit = function (amount, src) {
    if (!(amount > 0)) return;
    flowAcc -= amount;
    TE.Stats.add('lost', amount);
    TE.Bus.emit('lose', { amount, src: src || 'manual', settled: true });
  };
  E.lose = function (amount, src) {
    if (!(amount > 0)) return;
    const s = TE.state;
    const taken = Math.min(s.run.cash, amount);
    s.run.cash -= taken;
    flowAcc -= taken;
    if (src && src !== 'manual') flowBots -= taken;
    TE.Bus.emit('lose', { amount: taken, src });
  };
  E.spend = function (amount) {
    const s = TE.state;
    if (!(amount >= 0) || amount > s.run.cash * (1 + 1e-9) || !isFinite(amount)) return false;
    s.run.cash = Math.max(0, s.run.cash - amount);
    TE.Stats.add('spent', amount);
    return true;
  };
  E.canAfford = (amount) => isFinite(amount) && amount <= TE.state.run.cash * (1 + 1e-9);

  E.netWorth = function () {
    const s = TE.state;
    return s.run.cash + (TE.Trading ? TE.Trading.equity() : 0);
  };

  /* ---------------- market capacity (saturation) ----------------
   * Each era's markets can only absorb so much capital. Raw strategy income R is mapped to
   * R·W/(R+W): growth is free while R << W, then saturates. Global multipliers apply on top. */
  /* Calibrated so that clearing era n takes ~30 min in the run that first reaches it,
   * given the Alpha earned by the previous run (prestige multiplies every ceiling). */
  // V2: −10 % from era II on (era I untouched so the first minutes stay as lively as before); era VII −70 % so the
  // road to the Singularity stays a long-term goal (it only matters after the first Legacy)
  const ERA_CAPACITY = [5e3, 1.8e4, 2.7e5, 2.7e7, 1.8e9, 2.7e13, 0.3e20];
  E.ERA_CAPACITY = ERA_CAPACITY;
  E.capacityParts = function () {
    const s = TE.state;
    const base = ERA_CAPACITY[Math.max(0, Math.min(ERA_CAPACITY.length - 1, s.run.era - 1))];
    const markets = Object.keys(s.run.unlocked).length;
    const mk = 1 + 0.08 * Math.max(0, markets - 1);
    const mods = TE.Mods.get('alpha.capacity');
    return { base, markets, mk, mods, total: base * mk * mods };
  };
  E.capacity = () => E.capacityParts().total;
  /** Part of the global multiplier that comes from prestige layers: it raises the saturation ceiling. */
  const PRESTIGE_CATS = ['Alpha (α)', 'Legacy (Λ)', 'Singularity (✦)', 'Alpha Perks', 'Legacy Perks', 'Singularity Perks', 'Challenges'];
  const CEILING_CATS = PRESTIGE_CATS.concat(['Hot Streak', 'Crisis Rewards']);
  E.CEILING_CATS = CEILING_CATS;
  E.prestigeMult = function () { return Math.max(1, TE.Mods.catFactor('income.global', PRESTIGE_CATS)); };
  /** Multipliers that sit on top of the saturation ceiling: prestige, crisis rewards, streaks, timed buffs. */
  E.ceilingMult = function () {
    let m = Math.max(1, TE.Mods.catFactor('income.global', CEILING_CATS));
    const t = TE.Mods.temp['income.global'];
    if (t) m *= Math.max(0.01, 1 + t.add) * t.mult;
    const c = TE.state.run.events.crisis;
    if (c && c.active) m *= 1 + TE.Mods.get('crisis.gain');
    return m;
  };
  E.satFactor = function () {
    TE.Bots.expected();
    return E._sat === undefined ? 1 : E._sat;
  };
  /** Empire divisions have their own, smaller pool: at most this fraction of the trading capacity. */
  E.DIV_CAPACITY = 0.5;
  E.divSatFactor = function () {
    TE.Bots.expected();
    return E._satDiv === undefined ? 1 : E._satDiv;
  };
  E.saturation = function () { return TE.Bots.expected().sat || 0; };

  /** Expected passive income per second (bots + desk + fund fees + divisions), after saturation. */
  E.passive = function () {
    const b = TE.Bots.expected();
    const f = TE.Fund ? TE.Fund.mgmtIncome() : 0;
    const d = TE.Empire ? TE.Empire.divIncome() : 0;
    return b.total + f + d;
  };
  E.breakdown = function () {
    const b = TE.Bots.expected();
    const rows = [];
    D.BOTS.concat([D.DESK]).forEach((def) => { const v = b.byId[def.id]; if (v) rows.push({ id: def.id, name: def.name, v, color: def.color }); });
    const f = TE.Fund ? TE.Fund.mgmtIncome() : 0;
    if (f) rows.push({ id: 'mgmt', name: 'Frais de gestion', v: f, color: '#a77bff' });
    if (TE.Empire) TE.Empire.divBreakdown().forEach((r) => rows.push(r));
    return rows;
  };

  /** Realized income rolling average ($/s over last 30s). */
  E.realized = function () {
    const h = TE.state.run.incomeHist;
    if (!h.length) return 0;
    let s = 0; for (let i = 0; i < h.length; i++) s += h[i];
    return s / h.length;
  };
  E.realizedBots = () => E._botsRate || 0;
  E.secondTick = function () {
    const s = TE.state;
    s.run.incomeHist.push(flowAcc);
    if (s.run.incomeHist.length > 30) s.run.incomeHist.shift();
    E._botsHist = E._botsHist || [];
    E._botsHist.push(flowBots);
    if (E._botsHist.length > 30) E._botsHist.shift();
    E._botsRate = E._botsHist.reduce((a, b) => a + b, 0) / E._botsHist.length;
    flowAcc = 0; flowBots = 0;
  };

  /** Early-game floor so rewards are never tiny before bots exist. Bounded: no runaway from hoarded cash. */
  function floor(k) {
    return 1.5 + Math.min(TE.state.run.cash, 2e4) * k;
  }
  /** Base for liquidity / payout limits: passive income (never realized income, to avoid feedback loops). */
  E.capBase = function () { return Math.max(E.passive(), floor(0.02)); };
  /** Reference income used to scale rewards (contracts, opportunities, VIP, ventures). */
  E.refIncome = function () {
    const m = TE.Trading ? Math.max(0, TE.Trading.manualRate()) * 0.5 : 0;
    return Math.max(E.passive(), floor(0.004) + Math.min(m, 50));
  };

  /* ---------------- V2: theoretical vs effective gains ----------------
   * Raw production = what strategies would earn without saturation. A "×2 on all income" bought inside a run doubles
   * the raw production, but the market capacity absorbs part of it: the effective gain is smaller. */
  E.rawProduction = function () {
    const x = TE.Bots.expected();
    const divRaw = TE.Empire ? TE.Empire.divIncomeRaw() : 0;
    return (x.raw || 0) * E.ceilingMult() + divRaw;
  };
  /** Compare passive income now and with extra effects: {base, after, gain, theo, satLoss}. cat = modifier category. */
  E.whatIf = function (effects, cat, n) {
    const B = TE.Bots;
    const list = (effects || []).filter((e) => e && e.stat).map((e) => ({ cat: cat || 'Upgrades', e, n }));
    const base = E.passive(), rawB = E.rawProduction();
    if (!list.length) return { base, after: base, gain: 0, theo: 0, satLoss: 0 };
    const saveExp = B._exp, saveSat = E._sat, saveDiv = E._satDiv;
    let after = base, rawA = rawB;
    try {
      TE.Mods.whatIf(list, () => { B._exp = { t: -1e12, byId: {} }; after = E.passive(); rawA = E.rawProduction(); });
    } finally { B._exp = saveExp; E._sat = saveSat; E._satDiv = saveDiv; }
    const gain = base > 0 ? after / base - 1 : 0;
    const theo = rawB > 0 ? rawA / rawB - 1 : 0;
    return { base, after, gain, theo, satLoss: Math.max(0, theo - gain) };
  };
  /** "Pourquoi ?" — decomposition of the passive income from the modifier engine (no duplicated formulas). */
  E.explainIncome = function () {
    const x = TE.Bots.expected();
    const g = E.globalMult();
    const raw = E.rawProduction();
    const cats = TE.Mods.catsOf('income.global');
    const ceilCats = CEILING_CATS;
    let addIn = 0, addCeil = 0;
    const adds = [], mults = [];
    cats.forEach((c) => {
      const ceil = ceilCats.indexOf(c.key) >= 0;
      if (c.add) { adds.push({ label: c.label, add: c.add, ceil }); if (ceil) addCeil += c.add; else addIn += c.add; }
      if (c.mult !== 1) mults.push({ label: c.label, mult: c.mult, ceil });
    });
    const t = TE.Mods.temp['income.global'];
    const c = TE.state.run.events.crisis;
    return {
      base: raw / Math.max(1e-12, g), raw, global: g, ceil: E.ceilingMult(), adds, addTotal: addIn + addCeil, mults,
      temp: t ? Math.max(0.01, 1 + t.add) * t.mult : 1, tempItems: t ? t.items : [],
      crisis: c && c.active ? 1 + TE.Mods.get('crisis.gain') : 1,
      f: x.f === undefined ? 1 : x.f, fd: x.fd === undefined ? 1 : x.fd, sat: x.sat || 0, passive: E.passive(),
    };
  };

  /* ---------------- buy modes ---------------- */
  E.BUY_MODES = [1, 10, 25, 100, 'max'];
  /** Generic geometric purchase quote: returns {qty, cost, afford}. */
  E.quote = function (base, growth, owned, maxCount) {
    const s = TE.state;
    const mode = s.run.buyMode || 1;
    const limit = maxCount !== undefined ? Math.max(0, maxCount - owned) : undefined;
    if (limit === 0) return { qty: 0, cost: Infinity, afford: false, maxed: true };
    if (mode === 'max') {
      let q = U.geoMax(base, growth, owned, s.run.cash, limit);
      if (q < 1) { q = 1; return { qty: 1, cost: U.geoCost(base, growth, owned, 1), afford: false }; }
      return { qty: q, cost: U.geoCost(base, growth, owned, q), afford: true };
    }
    let q = mode;
    if (limit !== undefined) q = Math.min(q, limit);
    const cost = U.geoCost(base, growth, owned, q);
    return { qty: q, cost, afford: E.canAfford(cost) };
  };
})(window.TE);
