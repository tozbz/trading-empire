/* Empire: acquisitions, divisions, global offices, rivals & ranking, market influence, venture desk. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const E = (TE.Empire = {});
  const WORLD_CAP = 3e14;

  const emp = () => TE.state.run.empire;
  E.active = () => !!TE.state.profile.features.empire && TE.state.run.earnings >= D.FEATURE_EARN.empire;

  /* ---------------- acquisitions ---------------- */
  E.owned = (id) => !!emp().acq[id];
  E.acqVisible = (a) => E.owned(a.id) || (TE.Progress.eraOk(a.cost) && Math.max(TE.state.run.earnings, TE.state.run.cash) >= a.cost * 0.05);
  E.buyAcq = function (id) {
    const a = D.ACQ_MAP[id];
    if (!a || E.owned(id) || !E.active() || !TE.Progress.eraOk(a.cost)) return false;
    if (!TE.Economy.spend(a.cost)) return false;
    emp().acq[id] = 1;
    if (a.unlock && !emp().div[a.unlock]) emp().div[a.unlock] = 1;
    TE.Stats.add('acquisitions');
    TE.Mods.dirty = true;
    TE.Bus.emit('acq:buy', a);
    return true;
  };

  /* ---------------- divisions ---------------- */
  E.divLevel = (id) => emp().div[id] || 0;
  E.divUnlocked = (id) => E.divLevel(id) > 0;
  E.divQuote = (id) => { const d = D.DIV_MAP[id]; return TE.Economy.quote(d.cost, d.growth, E.divLevel(id)); };
  E.buyDiv = function (id, qty) {
    const d = D.DIV_MAP[id];
    if (!d || !E.divUnlocked(id) || qty <= 0) return false;
    const cost = U.geoCost(d.cost, d.growth, E.divLevel(id), qty);
    if (!TE.Economy.spend(cost)) return false;
    const before = E.divLevel(id);
    emp().div[id] = before + qty;
    if (Math.floor(before / 25) !== Math.floor((before + qty) / 25)) TE.Bus.emit('div:milestone', { id, lvl: before + qty });
    TE.Mods.dirty = true;
    TE.Bus.emit('div:buy', { id, qty });
    return true;
  };
  E.divMilestone = (lvl) => Math.pow(2, Math.floor(lvl / 25));
  E.divIncomeOne = (id) => E.divIncomeOneRaw(id) * TE.Economy.divSatFactor();
  E.divIncomeRaw = function () {
    let t = 0;
    D.DIVISIONS.forEach((d) => { if (E.divLevel(d.id)) t += E.divIncomeOneRaw(d.id); });
    return t;
  };
  E.divIncomeOneRaw = function (id) {
    const d = D.DIV_MAP[id];
    const lvl = E.divLevel(id);
    if (!lvl) return 0;
    let v = d.income * lvl * E.divMilestone(lvl) * TE.Mods.get('div.all') * TE.Mods.get('div.' + id) * TE.Economy.globalMult();
    return v * E.divWorldFactor(id);
  };
  /** V2: divisions live in the world — the bank earns on rates (macro), exchanges on traded volume,
   *  market makers on volatility and wider spreads. */
  const BANK_MACRO = { neutral: 1, bull: 0.92, bear: 1.18, recovery: 1.08, crisis: 0.85 };
  E.divWorldFactor = function (id) {
    const d = D.DIV_MAP[id];
    if (!d) return 1;
    if (id === 'bank') return BANK_MACRO[TE.state.market.macro.id] || 1;
    if (d.activity) return 0.5 + 0.5 * U.clamp(TE.Market.volumeIndex(), 0.3, 3);
    if (d.volatility) {
      const act = TE.Market.activityIndex();
      return (0.4 + 0.6 * Math.pow(act, 1.5)) * (1 + 0.25 * Math.max(0, E.spreadIndex() - 1));
    }
    return 1;
  };
  let spreadCache = { t: -1, v: 1 };
  E.spreadIndex = function () {
    const s = TE.state;
    if (Math.abs(s.run.time - spreadCache.t) < 2) return spreadCache.v;
    let sum = 0, n = 0;
    Object.keys(s.run.unlocked).forEach((id) => { const def = D.ASSET_MAP[id]; if (def) { sum += TE.Market.spread(id) / (def.spread * TE.Mods.get('spread')); n++; } });
    spreadCache = { t: s.run.time, v: n ? sum / n : 1 };
    return spreadCache.v;
  };
  E.divWorldText = function (id) {
    const d = D.DIV_MAP[id];
    const f = E.divWorldFactor(id);
    if (id === 'bank') return 'Cycle des taux (' + (D.MACRO[TE.state.market.macro.id] || D.MACRO.neutral).name + ') ' + U.mult(f);
    if (d.activity) return 'Volume traité ' + U.mult(f);
    if (d.volatility) return 'Volatilité et spreads ' + U.mult(f);
    return '';
  };
  E.divIncome = function () {
    let t = 0;
    D.DIVISIONS.forEach((d) => { if (E.divLevel(d.id)) t += E.divIncomeOne(d.id); });
    return t;
  };
  E.divBreakdown = () => D.DIVISIONS.filter((d) => E.divLevel(d.id)).map((d) => ({ id: d.id, name: d.name, v: E.divIncomeOne(d.id), color: d.color }));

  /* ---------------- global offices ---------------- */
  E.officeOpen = (id) => !!emp().offices[id];
  E.officeAvailable = (c) => (!c.era || TE.state.run.era >= c.era) && TE.Progress.eraOk(c.cost);
  E.openOffice = function (id) {
    const c = D.CITY_MAP[id];
    if (!c || E.officeOpen(id) || !E.active() || !E.officeAvailable(c)) return false;
    if (!TE.Economy.spend(c.cost)) return false;
    emp().offices[id] = 1;
    TE.Stats.max('offices', Object.keys(emp().offices).length - 1);
    if (c.offworld) TE.Stats.add('offworld');
    TE.Mods.dirty = true;
    TE.Bus.emit('office:open', c);
    return true;
  };

  /* ---------------- rivals & ranking ---------------- */
  E.initRivals = function () {
    const r = TE.state.run;
    if (r.rivals) return;
    r.rivals = {};
    D.RIVALS.forEach((x) => { r.rivals[x.id] = x.value * U.range(0.85, 1.15); });
  };
  E.rivalList = function () {
    const r = TE.state.run;
    E.initRivals();
    return D.RIVALS.filter((x) => (!x.era || r.era >= x.era) && !emp().rivalsBought[x.id]).map((x) => ({ def: x, value: r.rivals[x.id] }));
  };
  E.firmValue = () => TE.Economy.netWorth() + E.divIncome() * 120 + TE.Fund.aum() * 0.02;
  function normCdf(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }
  E.rank = function () {
    const v = Math.max(1, E.firmValue());
    const above = E.rivalList().filter((x) => x.value > v).length;
    const z = (U.log10(v) - 5) / 1.6;
    const tail = Math.floor(D.RIVAL_POPULATION * (1 - normCdf(z)));
    return 1 + above + tail;
  };
  E.canTakeover = (x) => E.active() && E.firmValue() > x.value;
  E.takeoverCost = (x) => x.value * 1.5 * (x.def && TE.World && TE.World.rivalTrouble(x.def.id) ? 0.65 : 1);
  E.takeover = function (id) {
    const x = E.rivalList().find((r) => r.def.id === id);
    if (!x || !E.canTakeover(x)) return false;
    if (!TE.Economy.spend(E.takeoverCost(x))) return false;
    emp().rivalsBought[id] = 1;
    TE.Stats.add('rivalsBought');
    TE.Stats.add('acquisitions');
    TE.Mods.dirty = true;
    TE.Bus.emit('rival:bought', x.def);
    return true;
  };

  /* ---------------- influence ---------------- */
  /* V2: the market scale grows with the eras (planetary market in era VI, stellar economy in era VII), but it expands
   * gradually over ~30 min of play instead of jumping: your influence never collapses in a single tick, and your
   * absolute market power (capital you control) keeps rising. */
  E.SCALES = [{ from: 1, name: 'Marché mondial', cap: WORLD_CAP }, { from: 6, name: 'Marché interplanétaire', cap: WORLD_CAP * 1e3 }, { from: 7, name: 'Économie stellaire', cap: WORLD_CAP * 1e6 }];
  E.scaleOf = function (era) { let sc = E.SCALES[0]; E.SCALES.forEach((x) => { if (era >= x.from) sc = x; }); return sc; };
  E.worldCapTarget = () => E.scaleOf(TE.state.run.era).cap;
  E.worldCap = function () {
    const r = TE.state.run;
    const target = E.worldCapTarget();
    const sc = r.infScale;
    if (!sc || sc.to !== target) {
      // first call of a new scale: blend from the scale we had
      const from = sc ? E.blendCap(sc) : target;
      r.infScale = { from, to: target, t0: r.time };
    }
    return E.blendCap(r.infScale);
  };
  E.blendCap = function (sc) {
    const k = U.clamp((TE.state.run.time - sc.t0) / 1800, 0, 1);
    if (!(sc.from > 0) || !(sc.to > 0)) return sc.to || WORLD_CAP;
    return Math.exp(Math.log(sc.from) * (1 - k) + Math.log(sc.to) * k);
  };
  E.controlled = function () { return (TE.Economy.netWorth() + TE.Fund.aum() + E.divIncome() * 300) * TE.Mods.get('influence'); };
  E.influence = function () {
    const s = TE.state;
    if (s.run.earnings < 1e8) return 0;
    const controlled = E.controlled();
    return controlled / (controlled + E.worldCap());
  };
  /** Absolute market power on a log scale (monotonic with the capital you control). */
  E.power = function () { const c = E.controlled(); return c > 1 ? U.log10(c) : 0; };

  /* ---------------- venture desk ---------------- */
  E.vcActive = () => E.divLevel('vc') > 0;
  E.vcSlots = () => 3 + Math.floor(E.divLevel('vc') / 10);
  /* V2: stage, hype and sector really shape the deal (they used to be decorative). */
  const VC_STAGES = {
    'Pré-amorçage': { zero: 1.25, big: 1.6, ask: 0.6, mat: 1.25, txt: 'très risqué, gros potentiel' },
    'Amorçage': { zero: 1.1, big: 1.25, ask: 0.8, mat: 1.1, txt: 'risqué' },
    'Série A': { zero: 0.9, big: 0.9, ask: 1.1, mat: 0.95, txt: 'équilibré' },
    'Série B': { zero: 0.7, big: 0.6, ask: 1.4, mat: 0.85, txt: 'plus sûr, potentiel limité' },
  };
  E.VC_STAGES = VC_STAGES;
  const VC_SECTOR_MACRO = {
    FinTech: { bull: 1.25, bear: 0.8 }, IA: { bull: 1.25, bear: 0.8 }, Crypto: { bull: 1.35, bear: 0.7 },
    Climat: { bear: 1.1 }, BioTech: { bear: 1.1 }, 'Grand public': { recovery: 1.15, bear: 0.9 }, DeepTech: {}, Spatial: {},
  };
  E.vcSectorFactor = function (sector) {
    const m = VC_SECTOR_MACRO[sector] || {};
    let f = m[TE.state.market.macro.id] || 1;
    if (sector === 'Spatial' && TE.state.run.era >= 5) f *= 1.3;
    return f;
  };
  /** Readable risk profile of a pitch (shown on the card). */
  E.vcProfile = function (p) {
    const st = VC_STAGES[p.stage] || VC_STAGES['Série A'];
    const sf = E.vcSectorFactor(p.sector);
    return { stage: st.txt, hype: p.hype >= 4 ? 'forte volatilité du résultat' : p.hype <= 2 ? 'résultat plus prévisible' : 'volatilité moyenne', sector: sf > 1.02 ? 'conjoncture favorable ' + U.mult(sf) : sf < 0.98 ? 'conjoncture défavorable ' + U.mult(sf) : 'conjoncture neutre' };
  };
  function makePitch() {
    const base = U.pick(D.VC_PREFIX).replace('{n}', U.pick(D.VC_NOUN));
    const name = base.charAt(0).toUpperCase() + base.slice(1) + U.pick(D.VC_SUFFIX);
    const stage = U.pick(Object.keys(VC_STAGES));
    const st = VC_STAGES[stage];
    const hype = Math.round(U.range(1, 5));
    return { pid: U.uid(), name, sector: U.pick(D.VC_SECTORS), ask: TE.Economy.refIncome() * U.range(30, 140) * st.ask * (0.75 + 0.1 * hype), matur: Math.round(U.range(90, 240) * st.mat),
      stage, hype };
  }
  E.vcInvest = function (pid) {
    const vc = emp().vc;
    const p = vc.pitches.find((x) => x.pid === pid);
    if (!p || vc.deals.length >= E.vcSlots()) return false;
    if (!TE.Economy.spend(p.ask)) return false;
    vc.pitches = vc.pitches.filter((x) => x.pid !== pid);
    vc.deals.push(Object.assign({}, p, { left: p.matur, invested: p.ask }));
    TE.Stats.add('vcDeals');
    TE.Bus.emit('vc:invest', p);
    return true;
  };
  E.vcPass = function (pid) { const vc = emp().vc; vc.pitches = vc.pitches.filter((x) => x.pid !== pid); };
  function resolveDeal(d) {
    const luck = TE.Mods.get('vc.luck');
    const st = VC_STAGES[d.stage] || VC_STAGES['Série A'];
    const hype = d.hype || 3;
    const zeroK = st.zero * (0.8 + 0.1 * hype);
    const bigK = st.big * (0.6 + 0.2 * hype);
    const entries = D.VC_OUTCOMES.map(([m, w], i) => [m, i === 0 ? w * zeroK * (1 - Math.min(0.6, luck * 0.6)) : m >= 10 ? w * bigK * (1 + luck * 2) : w]);
    const m = U.weighted(entries) * E.vcSectorFactor(d.sector);
    const payout = d.invested * m;
    if (payout > 0) TE.Economy.earn(payout, 'vc');
    TE.Stats.max('bestVC', m);
    TE.Bus.emit('vc:exit', { d, m, payout });
  }

  E.tick = function (dt) {
    const s = TE.state;
    // division income
    const inc = E.divIncome();
    if (inc > 0) TE.Economy.earn(inc * dt, 'div');
    // rivals grow
    if (s.run.rivals) {
      const crisis = s.run.events.crisis && s.run.events.crisis.active;
      D.RIVALS.forEach((x) => {
        if (crisis) s.run.rivals[x.id] *= Math.exp(-0.002 * dt);
        else s.run.rivals[x.id] *= Math.exp(x.growth * dt * (0.5 + Math.random()));
      });
    }
    // venture desk
    if (E.vcActive()) {
      const vc = emp().vc;
      vc.next -= dt;
      if (vc.next <= 0) {
        vc.next = U.range(60, 120);
        if (vc.pitches.length < 2) vc.pitches.push(makePitch());
      }
      for (let i = vc.deals.length - 1; i >= 0; i--) {
        const d = vc.deals[i];
        d.left -= dt;
        if (d.left <= 0) { vc.deals.splice(i, 1); resolveDeal(d); }
      }
    }
  };
  E.secondTick = function () {
    E.initRivals();
    const inf = E.influence();
    TE.Stats.max('maxInfluence', inf);
    const r = E.rank();
    const rec = TE.state.profile.records;
    if (!rec.bestRank || r < rec.bestRank) rec.bestRank = r;
    if (E._lastRank && r < E._lastRank) {
      const passed = D.RIVALS.find((x) => {
        const v = TE.state.run.rivals[x.id];
        const fv = E.firmValue();
        return v < fv && v > E._lastFv && !emp().rivalsBought[x.id];
      });
      if (passed) TE.Bus.emit('rival:passed', passed);
    }
    E._lastRank = r;
    E._lastFv = E.firmValue();
  };

  /* ---------------- modifiers ---------------- */
  TE.Mods.addProvider((ctx) => {
    const e = TE.state.run.empire;
    Object.keys(e.acq).forEach((id) => { const a = D.ACQ_MAP[id]; if (a) a.effects.forEach((x) => ctx.eff('Acquisitions', a.name, x)); });
    Object.keys(e.rivalsBought).forEach((id) => { const r = D.RIVAL_MAP[id]; if (r) r.effects.forEach((x) => ctx.eff('Acquisitions', r.name, x)); });
    Object.keys(e.offices).forEach((id) => {
      const c = D.CITY_MAP[id];
      if (!c || c.hq) return;
      c.effects.forEach((x) => ctx.eff('Global Offices', c.name, x));
      ctx.eff('Global Offices', c.name, { stat: 'influence', add: 0.05 });
      ctx.eff('Global Offices', c.name, { stat: 'alpha.capacity', add: 0.03 });
    });
    D.DIVISIONS.forEach((d) => {
      const lvl = e.div[d.id] || 0;
      if (lvl && d.effects) d.effects.forEach((x) => ctx.eff('Divisions', d.name, x, lvl));
    });
  });
})(window.TE);
