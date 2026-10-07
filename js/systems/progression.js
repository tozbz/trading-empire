/* Progression: eras, feature unlocks, milestones, achievements, tutorial, records, autobuyers. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const P = (TE.Progress = {});
  const A = (TE.Achievements = {});

  /* ---------------- achievements ---------------- */
  A.count = () => Object.keys(TE.state.profile.achievements).length;
  A.has = (id) => !!TE.state.profile.achievements[id];
  A.check = function () {
    const s = TE.state;
    for (let i = 0; i < D.ACHIEVEMENTS.length; i++) {
      const a = D.ACHIEVEMENTS[i];
      if (s.profile.achievements[a.id]) continue;
      let ok = false;
      try { ok = a.check(s); } catch (e) { ok = false; }
      if (ok) A.unlock(a.id);
    }
  };
  A.unlock = function (id) {
    const s = TE.state;
    const a = D.ACH_MAP[id];
    if (!a || s.profile.achievements[id]) return;
    s.profile.achievements[id] = Date.now();
    TE.Fund.gainRep(3 * TE.Fund.eraScale());
    TE.Mods.dirty = true;
    TE.Bus.emit('achievement', a);
  };
  TE.Mods.addProvider((ctx) => {
    const n = A.count();
    if (n) ctx.eff('Achievements', n + ' succès', { stat: 'income.global', add: n * D.ACH_BONUS });
  });

  /* ---------------- eras ---------------- */
  P.era = () => D.ERAS[TE.state.run.era - 1];
  P.nextEra = () => D.ERAS[TE.state.run.era] || null;
  /** Content is gated by era: anything priced at an era's level only appears in that era. */
  D.eraOf = function (cost) {
    let e = 1;
    for (let i = 0; i < D.ERAS.length; i++) if (cost >= D.ERAS[i].at) e = D.ERAS[i].n;
    return e;
  };
  P.eraOk = (cost) => TE.state.run.era >= D.eraOf(cost);
  /** The crisis that must be survived to leave era e (null if none). */
  P.gateCrisis = (e) => D.CRISES.find((c) => c.era === e) || null;
  P.gateOpen = function (e) {
    const c = P.gateCrisis(e);
    return !c || !!TE.state.run.events.crisisDone[c.id];
  };
  /** Human-readable requirement for the next era. */
  P.nextEraStatus = function () {
    const s = TE.state;
    const n = P.nextEra();
    if (!n) return null;
    const c = P.gateCrisis(s.run.era);
    return { era: n, money: s.run.earnings >= P.eraReq(n), crisis: c, crisisOk: P.gateOpen(s.run.era) };
  };
  /** Earnings needed to enter an era (V2: `req`, slightly above the era's price level `at`). */
  P.eraReq = (era) => (era.req !== undefined ? era.req : era.at);
  function checkEra() {
    const s = TE.state;
    let e = s.run.era;
    while (D.ERAS[e] && s.run.earnings >= P.eraReq(D.ERAS[e]) && P.gateOpen(e)) e++;
    if (e > s.run.era) {
      s.run.era = e;
      TE.Stats.max('bestEra', e);
      TE.Mods.dirty = true;
      const era = D.ERAS[e - 1];
      TE.Events.news({ cat: 'EMPIRE', text: 'ÈRE ' + era.roman + ' — ' + era.name.toUpperCase() + '. ' + era.tag, impact: 'HIGH', dir: 1, empire: true });
      TE.Bus.emit('era', era);
    }
  }

  /* ---------------- features ---------------- */
  function checkFeatures() {
    const s = TE.state;
    D.FEATURES.forEach((f) => {
      if (s.profile.features[f.id]) return;
      let ok = false;
      try { ok = f.cond(s); } catch (e) { ok = false; }
      if (ok) {
        s.profile.features[f.id] = true;
        TE.Bus.emit('feature:unlock', f);
      }
    });
  }

  /* ---------------- milestones & records ---------------- */
  function checkMilestones(nw) {
    const s = TE.state;
    for (let i = 0; i < D.MILESTONES.length; i++) {
      const m = D.MILESTONES[i];
      if (nw < m.at) break;
      if (s.run.milestones[m.at]) continue;
      s.run.milestones[m.at] = 1;
      const first = !s.profile.milestonesSeen[m.at];
      s.profile.milestonesSeen[m.at] = 1;
      TE.Fund.gainRep(2 * TE.Fund.eraScale());
      TE.Bus.emit('milestone', { m, first });
      if (m.at === 1e6) TE.Stats.min('fastMillion', s.run.time);
    }
  }

  /* ---------------- tutorial ---------------- */
  P.tutorial = function () {
    const s = TE.state;
    if (!s.settings.tutorial) return null;
    for (let i = 0; i < D.TUTORIAL.length; i++) {
      const t = D.TUTORIAL[i];
      if (s.profile.tutorial[t.id]) continue;
      let done = false, show = false;
      try { done = t.done(s); show = t.show(s); } catch (e) { /* ignore */ }
      if (done) { s.profile.tutorial[t.id] = 1; continue; }
      if (show) return t;
    }
    return null;
  };
  P.skipTutorial = function () {
    D.TUTORIAL.forEach((t) => { TE.state.profile.tutorial[t.id] = 1; });
  };

  /* ---------------- asset flags (from upgrades) ---------------- */
  TE.Bus.on('mods:rebuilt', () => {
    const s = TE.state;
    if (!s || !s.market) return;
    Object.keys(TE.Mods.flags).forEach((f) => {
      if (f.indexOf('asset.') === 0) {
        const id = f.slice(6);
        if (!s.run.unlocked[id]) TE.Market.unlock(id);
      }
    });
  });

  /* ---------------- per-second tick ---------------- */
  P.tick1s = function () {
    const s = TE.state;
    checkEra();
    checkFeatures();
    // first time this era's markets are saturated: explain the wall once
    const sat = TE.Economy.saturation();
    if (sat > 0.85 && s.run.satWarned !== s.run.era) { s.run.satWarned = s.run.era; TE.Bus.emit('market:saturated', { sat, era: s.run.era }); }
    const nw = TE.Economy.netWorth();
    if (nw > s.run.peakNW) s.run.peakNW = nw;
    TE.Stats.max('maxNW', nw);
    checkMilestones(s.run.peakNW);
    const inc = TE.Economy.passive();
    TE.Stats.max('maxIncome', inc);
    // charter: free fund as soon as it is available
    if (TE.Prestige.perk('charter') && !TE.Fund.active() && TE.Fund.available()) TE.Fund.found(s.profile.fundName);
    // equity curve sampling
    s.run._nwT = (s.run._nwT || 0) + 1;
    if (s.run._nwT >= 5) {
      s.run._nwT = 0;
      s.run.nwHist.push(nw);
      if (s.run.nwHist.length > 360) s.run.nwHist.splice(0, s.run.nwHist.length - 360);
    }
    // autobuyers (Legacy perks)
    TE.Bots.autoBuy();
    TE.Upgrades.autoBuy();
    TE.Research.autoBuy();
    TE.Firm.autoBuy();
    // bot sparkline samples
    if ((s.run._spT = (s.run._spT || 0) + 1) >= 3) {
      s.run._spT = 0;
      TE.Bots.FLEET_IDS.forEach((id) => {
        const b = s.run.bots[id];
        if (b && (b.n || id === 'desk')) { b.spark.push(b.pnl); if (b.spark.length > 40) b.spark.shift(); }
      });
    }
  };
  void U;
})(window.TE);
