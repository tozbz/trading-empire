/* Firm systems: upgrades, research tree, infrastructure, staff, headquarters, legendary hires. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;

  /* =============================== UPGRADES =============================== */
  const Up = (TE.Upgrades = {});
  Up.owned = (id) => !!TE.state.run.upgrades[id];
  Up.reqMet = function (u) {
    const s = TE.state, r = u.req || {};
    if (!TE.Progress.eraOk(u.cost)) return false;
    if (r.earn !== undefined && s.run.earnings < r.earn) return false;
    if (r.up && !Up.owned(r.up)) return false;
    if (r.bot && TE.Bots.count(r.bot[0]) < r.bot[1]) return false;
    if (r.fund && !(TE.Fund && TE.Fund.active())) return false;
    if (r.empire && !(TE.Empire && TE.Empire.active())) return false;
    if (r.era && s.run.era < r.era) return false;
    if (r.staff && TE.Firm.staffTotal() < r.staff) return false;
    if (r.staffId && (s.run.staff[r.staffId[0]] || 0) < r.staffId[1]) return false;
    // challenge filters
    const ch = s.run.challenge;
    if (ch === 'noleverage' && u.effects.some((e) => e.flag && e.flag.indexOf('lev.') === 0)) return false;
    if (ch === 'nobots' && (u.cat === 'bots' || u.cat === 'automation')) return false;
    if (ch === 'cryptoonly' && u.cat === 'markets' && u.effects.some((e) => e.flag && D.ASSET_MAP[e.flag.slice(6)] && D.ASSET_MAP[e.flag.slice(6)].cls !== 'crypto')) return false;
    return true;
  };
  Up.visible = function (u) {
    const s = TE.state;
    if (Up.owned(u.id) || !Up.reqMet(u)) return false;
    if (s.run.upgradesSeen[u.id]) return true;
    if (Math.max(s.run.earnings, s.run.cash) >= u.cost * 0.15 || u.cost <= 200) { s.run.upgradesSeen[u.id] = 1; return true; }
    return false;
  };
  Up.list = () => D.UPGRADES.filter(Up.visible).sort((a, b) => a.cost - b.cost);
  Up.buy = function (id) {
    const u = D.UPGRADE_MAP[id];
    if (!u || !Up.visible(u)) return false;
    if (!TE.Economy.spend(u.cost)) return false;
    TE.state.run.upgrades[id] = 1;
    TE.Stats.add('upgradesBought');
    TE.Mods.dirty = true;
    TE.Bus.emit('upgrade:buy', u);
    return true;
  };
  Up.autoBuy = function () {
    const s = TE.state;
    if (!TE.Prestige.lperk('autoupg') || !s.settings.autoBuy.upgrades) return;
    const list = Up.list();
    for (let i = 0; i < list.length; i++) { if (list[i].cost <= s.run.cash * 0.6) { Up.buy(list[i].id); return; } }
  };
  TE.Mods.addProvider((ctx) => {
    const s = TE.state;
    Object.keys(s.run.upgrades).forEach((id) => {
      const u = D.UPGRADE_MAP[id];
      if (u) u.effects.forEach((e) => ctx.eff('Upgrades', u.name, e));
    });
  });

  /* =============================== RESEARCH =============================== */
  const R = (TE.Research = {});
  R.active = () => !!TE.state.profile.features.research;
  R.rate = function () {
    if (!R.active()) return 0;
    const inc = Math.max(0, TE.Economy.passive());
    return (0.15 + 0.12 * Math.pow(inc, 0.4)) * TE.Mods.get('research.rate');
  };
  R.done = (id) => !!TE.state.run.research.done[id];
  const ROW_ERA = [1, 1, 1, 2, 2, 3, 4, 5, 6];
  R.eraReq = (n) => (n.br === 'quantumf' ? 6 : ROW_ERA[Math.min(n.row, ROW_ERA.length - 1)]);
  R.reqsDone = (n) => n.req.every((r) => R.done(r)) && TE.state.run.era >= R.eraReq(n);
  R.cost = (n) => n.cost;
  R.canBuy = (n) => !R.done(n.id) && R.reqsDone(n) && TE.state.run.research.rp >= n.cost;
  R.buy = function (id) {
    const n = D.RESEARCH_MAP[id];
    const rs = TE.state.run.research;
    if (!n || !R.canBuy(n)) return false;
    rs.rp -= n.cost;
    rs.done[id] = 1;
    TE.Stats.add('researchDone');
    TE.Stats.max('researchRun', Object.keys(rs.done).length);
    TE.Mods.dirty = true;
    TE.Bus.emit('research:done', n);
    return true;
  };
  R.refineCost = () => D.RESEARCH_REPEAT.base * Math.pow(D.RESEARCH_REPEAT.growth, TE.state.run.research.refine || 0);
  R.refineVisible = () => Object.keys(TE.state.run.research.done).length >= 20;
  R.buyRefine = function () {
    const rs = TE.state.run.research;
    const c = R.refineCost();
    if (!R.refineVisible() || rs.rp < c) return false;
    rs.rp -= c;
    rs.refine = (rs.refine || 0) + 1;
    TE.Mods.dirty = true;
    TE.Bus.emit('research:refine', rs.refine);
    return true;
  };
  R.tick = function (dt) {
    if (!R.active()) return;
    const rs = TE.state.run.research;
    const g = R.rate() * dt;
    rs.rp = U.cap(rs.rp + g);
    rs.rpTotal = U.cap(rs.rpTotal + g);
  };
  R.grant = function (amount) {
    if (!R.active()) return;
    const rs = TE.state.run.research;
    rs.rp = U.cap(rs.rp + amount); rs.rpTotal = U.cap(rs.rpTotal + amount);
  };
  R.autoBuy = function () {
    const s = TE.state;
    if (!TE.Prestige.lperk('autores') || !s.settings.autoBuy.research) return;
    const avail = D.RESEARCH.filter((n) => R.canBuy(n)).sort((a, b) => a.cost - b.cost);
    if (avail.length) R.buy(avail[0].id);
  };
  TE.Bus.on('trade:close', () => { if (R.active()) R.grant(Math.max(1, R.rate() * 4)); });
  TE.Mods.addProvider((ctx) => {
    const rs = TE.state.run.research;
    Object.keys(rs.done).forEach((id) => {
      const n = D.RESEARCH_MAP[id];
      if (n) n.effects.forEach((e) => ctx.eff('Research', n.name, e));
    });
    if (rs.refine) ctx.eff('Research', D.RESEARCH_REPEAT.name + ' ' + rs.refine, { stat: 'income.global', mult: Math.pow(1 + D.RESEARCH_REPEAT.effect, rs.refine) });
  });

  /* =============================== FIRM: infra / staff / HQ / legends =============================== */
  const F = (TE.Firm = {});

  // ---- infrastructure
  F.infraCount = (id) => TE.state.run.infra[id] || 0;
  F.infraQuote = function (id) {
    const x = D.INFRA_MAP[id];
    return TE.Economy.quote(x.cost, x.growth === 1 ? 1.0000001 : x.growth, F.infraCount(id), x.max);
  };
  F.infraUnlocked = function (x) {
    const s = TE.state;
    const i = D.INFRA.indexOf(x);
    if (F.infraCount(x.id) > 0) return true;
    if (!TE.Progress.eraOk(x.cost)) return false;
    if (i === 0) return true;
    const prev = D.INFRA[i - 1];
    return F.infraCount(prev.id) > 0 || Math.max(s.run.earnings, s.run.cash) >= x.cost * 0.25;
  };
  F.buyInfra = function (id, qty) {
    const x = D.INFRA_MAP[id];
    if (!x || !F.infraUnlocked(x)) return false;
    const owned = F.infraCount(id);
    if (x.max) qty = Math.min(qty, x.max - owned);
    if (qty <= 0) return false;
    const cost = U.geoCost(x.cost, x.growth === 1 ? 1.0000001 : x.growth, owned, qty);
    if (!TE.Economy.spend(cost)) return false;
    TE.state.run.infra[id] = owned + qty;
    TE.Stats.add('infraBought', qty);
    TE.Stats.min('minLatency', F.latency());
    TE.Mods.dirty = true;
    TE.Bus.emit('infra:buy', { id, qty });
    return true;
  };
  F.latency = function () {
    let l = D.BASE_LATENCY;
    D.INFRA.forEach((x) => { const n = F.infraCount(x.id); if (n && x.latency !== 1) l *= Math.pow(x.latency, n); });
    return l * TE.Mods.get('latency');
  };
  F.compute = function () {
    let c = 0;
    D.INFRA.forEach((x) => { c += F.infraCount(x.id) * x.compute; });
    return c * TE.Mods.get('infra.power');
  };
  F.fmtLatency = function (ms) {
    if (ms >= 1) return ms.toFixed(ms >= 100 ? 0 : 1).replace('.', ',') + ' ms';
    if (ms >= 0.001) return (ms * 1000).toFixed(ms >= 0.1 ? 0 : 1) + ' µs';
    if (ms >= 1e-6) return (ms * 1e6).toFixed(1).replace('.', ',') + ' ns';
    return (ms * 1e9).toFixed(1).replace('.', ',') + ' ps';
  };
  F.fmtCompute = function (tf) {
    if (tf < 1) return (tf * 1000).toFixed(0) + ' GFLOPS';
    if (tf < 1e3) return tf.toFixed(1).replace('.', ',') + ' TFLOPS';
    if (tf < 1e6) return (tf / 1e3).toFixed(1).replace('.', ',') + ' PFLOPS';
    if (tf < 1e9) return (tf / 1e6).toFixed(1).replace('.', ',') + ' EFLOPS';
    return U.fmt(tf / 1e9) + ' ZFLOPS';
  };

  // ---- staff
  F.staffCount = (id) => TE.state.run.staff[id] || 0;
  F.staffTotal = function () { let t = 0; const st = TE.state.run.staff; for (const k in st) t += st[k]; return t; };
  F.staffCap = () => D.OFFICES[TE.state.run.office].cap + Math.floor(TE.Mods.get('staff.cap'));
  F.staffAvailable = function (x) {
    const s = TE.state;
    if (x.req === 'fund' && !(TE.Fund && TE.Fund.active())) return false;
    if (F.staffCount(x.id) > 0) return true;
    if (!TE.Progress.eraOk(x.cost)) return false;
    return Math.max(s.run.earnings, s.run.cash) >= x.cost * 0.3;
  };
  F.staffQuote = function (id) {
    const x = D.STAFF_MAP[id];
    const room = F.staffCap() - F.staffTotal();
    const max = x.max !== undefined ? Math.min(x.max, F.staffCount(id) + room) : F.staffCount(id) + room;
    return TE.Economy.quote(x.cost * TE.Mods.get('staff.cost'), x.growth === 1 ? 1.0000001 : x.growth, F.staffCount(id), max);
  };
  F.hire = function (id, qty, free) {
    const x = D.STAFF_MAP[id];
    if (!x || !F.staffAvailable(x)) return false;
    const room = F.staffCap() - F.staffTotal();
    let q = Math.min(qty, room);
    if (x.max !== undefined) q = Math.min(q, x.max - F.staffCount(id));
    if (q <= 0) return false;
    if (!free) {
      const cost = U.geoCost(x.cost * TE.Mods.get('staff.cost'), x.growth === 1 ? 1.0000001 : x.growth, F.staffCount(id), q);
      if (!TE.Economy.spend(cost)) return false;
    }
    TE.state.run.staff[id] = F.staffCount(id) + q;
    TE.Bots.invalidate();
    TE.Stats.add('staffHired', q);
    TE.Stats.max('maxStaff', F.staffTotal());
    TE.Mods.dirty = true;
    TE.Bus.emit('staff:hire', { id, qty: q });
    return true;
  };

  // ---- headquarters
  F.office = () => D.OFFICES[TE.state.run.office];
  F.nextOffice = () => D.OFFICES[TE.state.run.office + 1] || null;
  F.officeEraOk = () => { const n = F.nextOffice(); return !!n && TE.Progress.eraOk(n.cost); };
  F.upgradeOffice = function () {
    const n = F.nextOffice();
    if (!n || !TE.Progress.eraOk(n.cost) || !TE.Economy.spend(n.cost)) return false;
    TE.state.run.office++;
    TE.Stats.max('bestOffice', TE.state.run.office);
    TE.Mods.dirty = true;
    TE.Bus.emit('office:upgrade', n);
    return true;
  };

  // ---- legends
  F.legendVisible = (l) => !l.hidden || TE.state.run.rep >= l.rep * 0.5 || TE.state.run.legends[l.id];
  F.legendAvailable = (l) => TE.state.run.rep >= l.rep && TE.Progress.eraOk(l.cost);
  F.hireLegend = function (id) {
    const l = D.LEGEND_MAP[id];
    const s = TE.state;
    if (!l || s.run.legends[id] || !F.legendAvailable(l)) return false;
    if (!TE.Economy.spend(l.cost)) return false;
    s.run.legends[id] = 1;
    TE.Stats.add('legends');
    TE.Mods.dirty = true;
    TE.Bus.emit('legend:hire', l);
    return true;
  };

  F.autoBuy = function () {
    const s = TE.state;
    if (!TE.Prestige.lperk('autofirm') || !s.settings.autoBuy.firm) return;
    const budget = s.run.cash * 0.25;
    let best = null, bc = Infinity, kind = null;
    D.INFRA.forEach((x) => {
      if (!F.infraUnlocked(x) || (x.max && F.infraCount(x.id) >= x.max)) return;
      const c = U.geoCost(x.cost, x.growth === 1 ? 1.0000001 : x.growth, F.infraCount(x.id), 1);
      if (c <= budget && c < bc) { bc = c; best = x.id; kind = 'infra'; }
    });
    D.STAFF.forEach((x) => {
      if (!F.staffAvailable(x) || F.staffTotal() >= F.staffCap() || (x.max && F.staffCount(x.id) >= x.max)) return;
      const c = U.geoCost(x.cost * TE.Mods.get('staff.cost'), x.growth === 1 ? 1.0000001 : x.growth, F.staffCount(x.id), 1);
      if (c <= budget && c < bc) { bc = c; best = x.id; kind = 'staff'; }
    });
    const n = F.nextOffice();
    if (n && F.staffTotal() >= F.staffCap() && n.cost <= s.run.cash * 0.5) { F.upgradeOffice(); return; }
    if (kind === 'infra') F.buyInfra(best, 1); else if (kind === 'staff') F.hire(best, 1);
  };

  // phase-1 providers (they read infra.power / staff.power computed by phase-0 providers)
  TE.Mods.addProvider((ctx) => {
    const s = TE.state;
    const ip = ctx.peek('infra.power');
    D.INFRA.forEach((x) => {
      const n = s.run.infra[x.id] || 0;
      if (!n) return;
      x.effects.forEach((e) => {
        if (e.add !== undefined) ctx.eff('Infrastructure', x.name, { stat: e.stat, add: e.add * ip }, n);
        else ctx.eff('Infrastructure', x.name, e, n);
      });
    });
    const sp = ctx.peek('staff.power');
    D.STAFF.forEach((x) => {
      const n = s.run.staff[x.id] || 0;
      if (!n) return;
      x.effects.forEach((e) => {
        if (e.add !== undefined) ctx.eff('Staff', x.name, { stat: e.stat, add: e.add * sp }, n);
        else if (e.stat === 'income.global') ctx.eff('Staff', x.name, e, n);
        else ctx.eff('Staff', x.name, { stat: e.stat, mult: Math.pow(e.mult, sp) }, n);
      });
    });
  }, 1);
  TE.Mods.addProvider((ctx) => {
    const s = TE.state;
    const o = D.OFFICES[s.run.office];
    if (o && o.mult !== 1) ctx.eff('Headquarters', o.name, { stat: 'income.global', mult: o.mult });
    Object.keys(s.run.legends).forEach((id) => {
      const l = D.LEGEND_MAP[id];
      if (s.run.legendsAway && s.run.legendsAway[id] > s.run.time) return; // poached for a while by a rival
      if (l) l.effects.forEach((e) => ctx.eff('Legends', l.name, e));
    });
  });
})(window.TE);
