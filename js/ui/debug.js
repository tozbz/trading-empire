/* Developer tools. Disabled by default — only reachable with ?debug in the URL (never from the keyboard). */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const Dbg = (TE.Debug = { enabled: /[?&#]debug/.test(location.href) });

  Dbg.enable = function () {
    Dbg.enabled = true;
    UI.toast({ title: 'MODE DEBUG', text: 'Les outils de développement sont disponibles dans PARAMÈTRES.', kind: 'warn', icon: '⚙' });
    if (UI.viewEls.settings) UI.views.settings.onShow();
  };
  Dbg.addCash = (m) => { const s = TE.state; const v = Math.max(1000, s.run.cash) * (m || 10); TE.Economy.earn(v - s.run.cash, 'reward'); };
  Dbg.unlockAll = () => { D.FEATURES.forEach((f) => { TE.state.profile.features[f.id] = true; TE.state.profile.featuresSeen[f.id] = true; }); };
  Dbg.skip = function (sec) {
    // fast simulation: full detail, used for balance testing
    const steps = Math.floor(sec / TE.Loop.STEP);
    for (let i = 0; i < steps; i++) TE.Loop.step(TE.Loop.STEP);
  };
  /** Headless balance run: greedy buyer plays for `minutes`, logs a timeline. */
  Dbg.simulate = function (minutes, opts) {
    opts = opts || {};
    const log = [];
    const s = TE.state;
    const marks = [250, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e18, 1e20, 1e22];
    let mi = 0;
    if ((Dbg._lastClose || 0) > s.run.time) Dbg._lastClose = -99;
    for (let t = 0; t < minutes * 60; t += 1) {
      if (t > 0 && t % 300 === 0) log.push('   [' + U.dur(s.run.time) + '] cash ' + U.money(s.run.cash) + ' earned ' + U.money(s.run.earnings) + ' income ' + U.money(TE.Economy.passive()) + '/s bots ' + TE.Bots.totalUnits() + ' trades ' + (s.run.stats.trades || 0) + ' upg ' + Object.keys(s.run.upgrades).length + ' | spd ' + U.fmt(TE.Mods.get('bot.all.speed')) + ' cap ' + U.fmt(TE.Mods.get('bot.all.capital')) + ' prof ' + U.fmt(TE.Mods.get('bot.all.profit')) + ' glob ' + U.fmt(TE.Economy.globalMult()) + ' aum ' + U.money(TE.Fund.aum()) + ' div ' + U.money(TE.Empire.divIncome()) + '/s pb ' + Dbg.bestPayback() + ' sat ' + (TE.Economy.saturation() * 100).toFixed(0) + '% era ' + s.run.era);
      Dbg.skip(1);
      if (opts.trade) Dbg.autoTrade();
      if (opts.opps !== false && s.run.opp.cur) TE.Events.claimOpportunity(D.OPP_MAP[s.run.opp.cur.id].choice ? 'report' : undefined);
      Dbg.greedy(opts);
      while (mi < marks.length && s.run.earnings >= marks[mi]) { log.push(U.dur(s.run.time) + '  earned ' + U.money(marks[mi]) + '  income ' + U.money(TE.Economy.passive()) + '/s  bots ' + TE.Bots.totalUnits() + '  era ' + s.run.era); mi++; }
    }
    log.push('END ' + U.dur(s.run.time) + ' earned ' + U.money(s.run.earnings) + ' income ' + U.money(TE.Economy.passive()) + '/s');
    console.log(log.join('\n'));
    return log;
  };
  /** Payback (seconds) of the best next bot unit — the key balance metric. */
  Dbg.bestPayback = function () {
    let best = Infinity, who = '';
    D.BOTS.forEach((b) => {
      if (!TE.Bots.unlocked(b.id)) return;
      const x = TE.Bots.stats(b.id);
      const per = x.cap * x.lev * x.evPct * x.tps * x.profit * TE.Economy.globalMult();
      const pb = TE.Bots.cost(b.id, 1) / Math.max(1e-12, per);
      if (pb < best) { best = pb; who = b.id; }
    });
    return Math.round(best) + 's(' + who + ')';
  };
  /** Naive trend follower used by the balance simulation. */
  Dbg.autoTrade = function () {
    const s = TE.state;
    const id = s.run.activeAsset;
    const pos = s.run.account.positions[id];
    const R = TE.Market.regime(id);
    const dir = R.dir;
    // human-paced: at most one new position every ~25 seconds, ~65% directional accuracy
    if (!pos && dir !== 0 && s.run.time - (Dbg._lastClose || -99) > 25) {
      s.run.account.lev = TE.Trading.maxLev() > 5 ? 5 : TE.Trading.maxLev();
      TE.Trading.open(id, Math.random() < 0.65 ? dir : -dir);
    } else if (pos) {
      const u = TE.Trading.upnl(id) - pos.fees;
      if (u / pos.margin > 0.15 || u / pos.margin < -0.12 || (s.run.time - pos.opened > 40)) { TE.Trading.close(id, 'manual'); Dbg._lastClose = s.run.time; }
    }
  };
  /** Greedy purchaser for simulations: best income-per-cost bot, cheapest upgrade, research. */
  Dbg.greedy = function (opts) {
    const s = TE.state;
    for (let k = 0; k < 20; k++) {
      let did = false;
      const budget = s.run.cash * (opts && opts.spend ? opts.spend : 0.6);
      const ups = TE.Upgrades.list().filter((u) => u.cost <= budget);
      if (ups.length) { TE.Upgrades.buy(ups[0].id); did = true; }
      D.RESEARCH.filter((n) => TE.Research.canBuy(n)).forEach((n) => TE.Research.buy(n.id));
      let best = null, bs = 0;
      D.BOTS.forEach((b) => {
        if (!TE.Bots.unlocked(b.id)) return;
        const c = TE.Bots.cost(b.id, 1);
        if (c > budget) return;
        const x = TE.Bots.stats(b.id);
        const per = x.cap * x.lev * x.evPct * x.tps * x.profit * TE.Economy.globalMult();
        const sc = per / c;
        if (sc > bs) { bs = sc; best = b.id; }
      });
      if (best) { TE.Bots.buy(best, 1); did = true; }
      D.INFRA.forEach((x) => { if (TE.Firm.infraUnlocked(x)) { const q = U.geoCost(x.cost, x.growth === 1 ? 1.0000001 : x.growth, TE.Firm.infraCount(x.id), 1); if (q < s.run.cash * 0.3) TE.Firm.buyInfra(x.id, 1); } });
      D.STAFF.forEach((x) => { if (TE.Firm.staffAvailable(x) && TE.Firm.staffTotal() < TE.Firm.staffCap()) { const q = U.geoCost(x.cost * TE.Mods.get('staff.cost'), x.growth === 1 ? 1.0000001 : x.growth, TE.Firm.staffCount(x.id), 1); if (q < s.run.cash * 0.2) TE.Firm.hire(x.id, 1); } });
      const o = TE.Firm.nextOffice(); if (o && o.cost < s.run.cash * 0.3) TE.Firm.upgradeOffice();
      if (!TE.Fund.active() && TE.Fund.available() && s.run.cash > TE.Fund.foundCost() * 2) TE.Fund.found('Sim Capital');
      if (TE.Empire.active()) {
        D.ACQUISITIONS.forEach((a) => { if (!TE.Empire.owned(a.id) && a.cost < s.run.cash * 0.3) TE.Empire.buyAcq(a.id); });
        D.DIVISIONS.forEach((d) => { if (TE.Empire.divUnlocked(d.id)) { const c = U.geoCost(d.cost, d.growth, TE.Empire.divLevel(d.id), 1); if (c < s.run.cash * 0.3) TE.Empire.buyDiv(d.id, 1); } });
        D.CITIES.forEach((c) => { if (!TE.Empire.officeOpen(c.id) && c.cost < s.run.cash * 0.2) TE.Empire.openOffice(c.id); });
      }
      if (TE.Mods.dirty) TE.Mods.rebuild();
      if (!did) break;
    }
  };

  Dbg.panel = function () {
    // every use is recorded in the profile (shown in Statistiques): a debugged save stays recognisable
    const btn = (label, fn) => h('button', { class: 'btn btn-ghost btn-xs', text: label, on: { click: () => { TE.state.profile.debugUsed = (TE.state.profile.debugUsed || 0) + 1; fn(); UI.toast({ text: label + ' ✓', kind: 'warn', icon: '⚙', dur: 1200 }); } } });
    const evSel = h('select', { class: 'inp' }, D.EVENTS.map((e) => h('option', { value: e.id, text: e.name })));
    const crSel = h('select', { class: 'inp' }, D.CRISES.map((c) => h('option', { value: c.id, text: c.name })));
    const oppSel = h('select', { class: 'inp' }, D.OPPORTUNITIES.map((o) => h('option', { value: o.id, text: o.name })));
    return h('div', { class: 'card debug' }, [
      h('div', { class: 'card-h' }, [h('span', { text: '⚙ Outils de développement' })]),
      h('div', { class: 'btn-row' }, [btn('Liquidités ×10', () => Dbg.addCash(10)), btn('Liquidités ×1000', () => Dbg.addCash(1000)), btn('+1M RP', () => TE.Research.grant(1e6)), btn('+1000 rép.', () => { TE.state.run.rep += 1000; }),
        btn('Débloquer tous les panneaux', Dbg.unlockAll), btn('+100 α', () => { TE.state.profile.prestige.alpha += 100; TE.state.profile.prestige.alphaTotal += 100; TE.Mods.dirty = true; }),
        btn('Avancer de 60 s', () => Dbg.skip(60)), btn('Avancer de 10 min', () => Dbg.skip(600)), btn('Simuler 1 h hors ligne', () => { const r = TE.Offline.apply(3600); UI.toast({ text: 'Hors ligne : +' + U.money(r.cash) }); }),
        btn('Faire apparaître une opportunité', () => TE.Events.spawnOpportunity()), btn('Rendre la liquidation (P1) possible', () => { if (TE.state.run.earnings < 1e9) TE.Economy.earn(1e9, 'reward'); })]),
      h('div', { class: 'btn-row' }, [evSel, btn('Déclencher l’événement', () => TE.Events.trigger(evSel.value, { instant: true }))]),
      h('div', { class: 'btn-row' }, [oppSel, btn('Faire apparaître cette opportunité', () => TE.Events.spawnOpportunity(oppSel.value))]),
      h('div', { class: 'btn-row' }, [crSel, btn('Lancer la crise dans 5 s', () => { const ev = TE.state.run.events; ev.crisis = null; ev.crisisNext = { id: crSel.value, at: TE.state.run.time + D.CRISIS_MAP[crSel.value].warn + 5 }; delete ev.crisisDone[crSel.value]; })]),
    ]);
  };
})(window.TE);
