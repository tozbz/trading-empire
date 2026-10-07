/* Hedge fund: AUM, capacity, investor classes, inflows/withdrawals, NAV & drawdown, fees, reputation, VIP mandates. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const F = (TE.Fund = {});

  F.eraScale = () => Math.pow(3, (TE.state.run.era || 1) - 1);
  F.gainRep = function (x) {
    if (!(x > 0)) return;
    const s = TE.state;
    s.run.rep = U.cap(s.run.rep + x * TE.Mods.get('rep.gain'));
  };
  F.loseRepPct = function (pct) {
    const s = TE.state;
    s.run.rep = Math.max(0, s.run.rep * (1 - pct * TE.Mods.get('rep.loss')));
  };
  F.repTier = function (rep) {
    let t = D.REP_TIERS[0], idx = 0;
    D.REP_TIERS.forEach((x, i) => { if (rep >= x.at) { t = x; idx = i; } });
    return { tier: t, idx, next: D.REP_TIERS[idx + 1] || null };
  };

  F.active = () => !!(TE.state.run.fund && TE.state.run.fund.founded);
  F.available = () => TE.state.run.earnings >= D.FUND_UNLOCK_EARN;
  F.foundCost = () => (TE.Prestige.perk('charter') ? 0 : D.FUND_FOUND_COST);
  F.found = function (name) {
    const s = TE.state;
    if (F.active() || !F.available()) return false;
    if (!TE.Economy.spend(F.foundCost())) return false;
    name = (name || s.profile.fundName || 'Empire Capital').toString().slice(0, 32).trim() || 'Empire Capital';
    s.profile.fundName = name;
    s.run.fund = {
      founded: true, name, aum: 0, byClass: {}, nav: 100, peak: 100, maxDD: 0, inflow: 0, outflow: 0, perfFees: 0, mgmtFees: 0,
      clients: 0, navHist: [100], aumHist: [0], peakAum: 0, created: s.run.time, log: [], vip: { offer: null, active: null, next: 90 }, sampleT: 0, navRef: [],
    };
    TE.Stats.add('fundsFounded');
    // friends & family seed money
    const seed = F.capacity() * 0.15;
    if (seed > 0) addInflow('retail', seed, 'Friends & family seed round', U.irange(5, 20));
    TE.Mods.dirty = true;
    TE.Bus.emit('fund:founded', name);
    return true;
  };
  F.capacity = function () {
    if (!TE.state.run.fund) return 0;
    const rep = TE.state.run.rep;
    return TE.Bots.totalCap() * D.FUND_BASE_CAP * TE.Mods.get('fund.capacity') * (1 + 0.1 * U.log10(1 + rep));
  };
  F.aum = () => (F.active() ? TE.state.run.fund.aum : 0);
  F.deployed = function () { return F.active() ? Math.min(TE.state.run.fund.aum, F.capacity()) : 0; };
  F.drawdown = function () { const f = TE.state.run.fund; return f ? Math.max(0, 1 - f.nav / f.peak) : 0; };
  F.mgmtIncomeRaw = function () {
    if (!F.active()) return 0;
    return (TE.state.run.fund.aum * TE.Mods.get('fund.mgmt')) / D.FUND_YEAR * TE.Economy.globalMult();
  };
  F.mgmtIncome = () => F.mgmtIncomeRaw() * TE.Economy.satFactor();
  F.perfReturn = function (sec) {
    const f = TE.state.run.fund;
    if (!f || f.navHist.length < 2) return 0;
    const back = Math.max(1, Math.round((sec || 300) / 5));
    const i = Math.max(0, f.navHist.length - 1 - back);
    return f.nav / f.navHist[i] - 1;
  };

  function scaleClasses(f, factor) {
    for (const k in f.byClass) f.byClass[k] *= factor;
  }
  function addInflow(cls, amount, who, clients, reason) {
    const f = TE.state.run.fund;
    const before = f.aum;
    f.aum = U.cap(f.aum + amount);
    f.byClass[cls] = (f.byClass[cls] || 0) + amount;
    f.inflow += amount;
    f.clients += clients || 1;
    if (f.aum > f.peakAum) f.peakAum = f.aum;
    TE.Stats.max('maxAUM', f.aum);
    if (cls === 'sovereign') TE.Stats.add('sovereignIn');
    if (TE.Bots.invalidate) TE.Bots.invalidate();
    const entry = { t: TE.state.run.time, cls, amount, who, why: reason || '' };
    f.log.unshift(entry);
    if (f.log.length > 30) f.log.length = 30;
    TE.Bus.emit('fund:inflow', entry);
    if (amount >= Math.max(1, before) * 0.015 || cls === 'sovereign' || cls === 'planetary') TE.Bus.emit('fund:note', Object.assign({ kind: 'in' }, entry));
  }
  F.addInflow = addInflow;
  /** Investors pull a fraction of their capital at once (scandal, regulator…). */
  F.forceOutflow = function (pct, reason) {
    const f = TE.state.run.fund;
    if (!f || !(f.aum > 0)) return 0;
    const w = f.aum * U.clamp(pct, 0, 0.9);
    const before = f.aum;
    f.aum -= w;
    scaleClasses(f, f.aum / before);
    f.outflow += w;
    logOut(f, w, reason);
    TE.Bus.emit('fund:note', { kind: 'out', amount: w, why: reason, t: TE.state.run.time });
    return w;
  };
  function logOut(f, amount, why) {
    f.log.unshift({ t: TE.state.run.time, cls: 'out', amount: -amount, who: 'Retraits', why });
    if (f.log.length > 30) f.log.length = 30;
  }
  /** Losses still to be recouped before any performance fee is charged (the fund's high-water mark, in $). */
  F.hwmGap = () => { const f = TE.state.run.fund; return f && f.lossCF > 0 ? f.lossCF : 0; };

  /* Bots trade investor capital thousands of times per second, so raw returns are huge. NAV (what investors
   * see and react to) is put on a human scale: its expected drift is about NAV_DRIFT per second, while its
   * swings keep the sign and relative size of the real trading results. */
  const NAV_DRIFT = 0.0008;
  F.navScale = function () {
    const r = TE.Bots.expected().fundRate || 0;
    return r > NAV_DRIFT ? NAV_DRIFT / r : 1;
  };
  /** Called by bot batches: investor capital traded (all k trades), raw return pct, player multiplier.
   *  Performance fees are charged on trading profit after any loss carry-forward (a dollar high-water mark). */
  F.onBatch = function (aumAmount, pct, playerMult) {
    const f = TE.state.run.fund;
    if (!f || f.aum <= 0) return 0;
    const raw = aumAmount * pct;
    let fee = 0;
    if (raw < 0) f.lossCF = (f.lossCF || 0) - raw;
    else if (raw > 0) {
      const recouped = Math.min(f.lossCF || 0, raw);
      f.lossCF = (f.lossCF || 0) - recouped;
      fee = (raw - recouped) * TE.Mods.get('fund.perf');
    }
    const before = f.aum;
    const ret = U.clamp(((raw - fee) / before) * F.navScale(), -0.2, 0.2);
    f.aum = before * (1 + ret);
    scaleClasses(f, 1 + ret);
    f.nav *= 1 + ret;
    if (f.nav > f.peak) f.peak = f.nav;
    const dd = 1 - f.nav / f.peak;
    if (dd > f.maxDD) f.maxDD = dd;
    TE.Stats.max('maxDD', dd);
    if (f.aum > f.peakAum) { f.peakAum = f.aum; TE.Stats.max('maxAUM', f.aum); }
    const income = fee * playerMult;
    f.perfFees += income;
    TE.Stats.add('fees', income);
    return income;
  };

  /** V2: multipliers on investor inflows by class, with a readable list of what moves them. */
  F.inflowFactors = function () {
    const s = TE.state;
    const sent = s.market.sent;
    const att = TE.World ? TE.World.attention() : 0;
    const reg = TE.World ? TE.World.reg() : 0;
    const scandal = s.run.world && s.run.time - (s.run.world.scandalT || -999) < 180;
    const dd = F.drawdown();
    const perf = F.perfReturn(300);
    const stable = dd < 0.02 && perf >= 0 && s.run.fund && s.run.fund.navHist.length > 12;
    const greed = sent > 60 ? 1 + (sent - 60) / 60 : 1;
    const fear = sent < 40 ? Math.max(0.55, 1 - (40 - sent) / 60) : 1;
    const visib = 1 + att / 250;
    const regF = reg > 50 ? Math.max(0.2, 1 - (reg - 50) / 100 * 1.5) : 1;
    const byClass = {};
    D.INVESTOR_CLASSES.forEach((c) => {
      const spec = c.id === 'retail' || c.id === 'hnw';
      const insti = c.id === 'inst' || c.id === 'sovereign' || c.id === 'planetary' || c.id === 'family';
      let k = fear * (spec ? greed * visib : 1) * (insti ? regF * (stable ? 1.3 : 1) : 1);
      if (scandal) k *= 0.5;
      byClass[c.id] = k;
    });
    const notes = [];
    if (greed > 1.05) notes.push(['Avidité du marché (' + Math.round(sent) + ')', 'Particuliers et grandes fortunes ' + U.mult(greed), 'up']);
    if (fear < 0.98) notes.push(['Peur du marché (' + Math.round(sent) + ')', 'Souscriptions ' + U.mult(fear) + (sent < 30 ? ', rachats paniqués' : ''), 'down']);
    if (att > 10) notes.push(['Visibilité médiatique', 'Particuliers ' + U.mult(visib), 'up']);
    if (stable) notes.push(['Stabilité (drawdown < 2 %)', 'Institutionnels ×1,30', 'up']);
    if (regF < 1) notes.push(['Pression réglementaire ' + Math.round(reg) + ' %', 'Institutionnels ' + U.mult(regF), 'down']);
    if (scandal) notes.push(['Scandale récent', 'Souscriptions ×0,50, retraits accrus', 'down']);
    return { byClass, notes };
  };
  function inflowReason(c, perf, stable, sent, att) {
    const r = [];
    if (perf > 0.01) r.push('performance solide (' + U.pct(perf, 1) + ' en 5 min)');
    else if (perf >= 0 && TE.state.run.fund && TE.state.run.fund.nav >= TE.state.run.fund.peak * 0.999) r.push('VL au plus haut');
    if (stable && c.id !== 'retail') r.push('faible drawdown');
    if (sent > 70 && (c.id === 'retail' || c.id === 'hnw')) r.push('euphorie des marchés');
    if (att > 40 && (c.id === 'retail' || c.id === 'hnw')) r.push('votre visibilité médiatique');
    if (!r.length) r.push('réputation : ' + F.repTier(TE.state.run.rep).tier.name.toLowerCase());
    const t = r.slice(0, 2).join(' et ');
    return t.charAt(0).toUpperCase() + t.slice(1) + '.';
  }
  function outflowReason(why, dd, sent, crisis) {
    const parts = [];
    const tot = Object.keys(why).reduce((a, k) => a + why[k], 0) || 1;
    const add = (k, txt) => { if (why[k] / tot > 0.2) parts.push(txt); };
    add('dd', 'drawdown de ' + U.pct(dd, 1, false));
    add('crisis', crisis ? 'crise en cours' : 'crise');
    add('fear', 'panique du marché (peur ' + Math.round(sent) + ')');
    add('reg', 'pression réglementaire');
    add('scandal', 'scandale');
    add('vip', 'mandat VIP en drawdown');
    if (!parts.length) parts.push('prises de bénéfices');
    const t = parts.slice(0, 2).join(' + ');
    return t.charAt(0).toUpperCase() + t.slice(1) + '.';
  }

  F.tick = function (dt) {
    const s = TE.state;
    const f = s.run.fund;
    if (!f || !f.founded) return;
    if (!(f.nav > 0) || !isFinite(f.nav) || !isFinite(f.peak)) { f.nav = f.peak = 100; f.navHist = [100]; }
    if (f.lossCF) f.lossCF *= Math.exp(-dt / 120); // old losses are gradually forgiven
    const cap = F.capacity();
    // management fee (from AUM to you)
    const mg = (f.aum * TE.Mods.get('fund.mgmt')) / D.FUND_YEAR * dt;
    if (mg > 0 && f.aum > 0) {
      const before = f.aum;
      f.aum -= mg;
      scaleClasses(f, f.aum / before);
      const inc = mg * TE.Economy.globalMult() * TE.Economy.satFactor();
      f.mgmtFees += inc;
      TE.Stats.add('fees', inc);
      TE.Economy.earn(inc, 'fund');
    }
    // over capacity: excess capital is returned to investors (the fund is "closed")
    if (f.aum > cap * 1.02 && cap > 0) {
      const before = f.aum;
      const excess = f.aum - cap;
      f.aum = cap;
      scaleClasses(f, f.aum / before);
      f.returned = (f.returned || 0) + excess;
    }
    // inflows — V2: investors also read the mood of the market, your reputation, the regulators and your stability
    const room = cap - f.aum;
    const perf = F.perfReturn(300);
    const perfF = perf >= 0 ? 1 + Math.min(1.5, perf * 4) : 0.4;
    const crisis = s.run.events.crisis && s.run.events.crisis.active;
    const dd = F.drawdown();
    const sent = s.market.sent;
    const att = TE.World ? TE.World.attention() : 0;
    const reg = TE.World ? TE.World.reg() : 0;
    const scandal = s.run.world && s.run.time - (s.run.world.scandalT || -999) < 180;
    const stable = dd < 0.02 && perf >= 0 && f.navHist.length > 12;
    const fx = F.inflowFactors();
    if (room > cap * 0.005 && !crisis) {
      D.INVESTOR_CLASSES.forEach((c) => {
        if (s.run.rep < c.rep || (c.era && s.run.era < c.era)) return;
        const k = fx.byClass[c.id] || 1;
        const rate = c.rate * TE.Mods.get('fund.inflow') * perfF * (1 + 0.15 * U.log10(1 + s.run.rep)) * k;
        if (Math.random() < Math.min(0.9, rate * dt)) {
          let ticket = cap * U.range(c.ticket[0], c.ticket[1]) * Math.min(3, Math.sqrt(TE.Mods.get('fund.inflow')));
          ticket = Math.min(ticket, Math.max(0, cap - f.aum));
          if (ticket > 0) {
            const clients = U.irange(c.clients[0], c.clients[1]);
            const who = c.id === 'retail' ? U.int(clients) + ' ' + U.pick(c.names) : U.pick(c.names);
            addInflow(c.id, ticket, who, clients, inflowReason(c, perf, stable, sent, att));
          }
        }
      });
    }
    // withdrawals on drawdown, crises, panic, regulators and scandals
    const cw = crisis ? TE.Events.crisisWithdraw() : 0;
    const fear = sent < 30 ? 0.0015 * (30 - sent) / 30 : 0;
    let out = 0;
    const why = f._why || (f._why = { dd: 0, crisis: 0, fear: 0, reg: 0, scandal: 0, vip: 0 });
    D.INVESTOR_CLASSES.forEach((c) => {
      const amt = f.byClass[c.id] || 0;
      if (amt <= 0) return;
      let rate = 0;
      const rDD = dd > c.tol ? c.wspeed * ((dd - c.tol) / c.tol) : 0;
      const rFear = c.id === 'retail' || c.id === 'hnw' ? fear : 0;
      const rReg = reg >= 70 && (c.id === 'inst' || c.id === 'sovereign' || c.id === 'planetary') ? 0.001 : 0;
      const rSc = scandal ? 0.002 : 0;
      rate = rDD + cw + rFear + rReg + rSc;
      if (rate <= 0) return;
      const w = amt * Math.min(0.5, rate * TE.Mods.get('fund.withdraw') * dt);
      f.byClass[c.id] = amt - w;
      out += w;
      why.dd += w * rDD / rate; why.crisis += w * cw / rate; why.fear += w * rFear / rate; why.reg += w * rReg / rate; why.scandal += w * rSc / rate;
    });
    if (f.byClass.vip && dd > 0.15) { const w = f.byClass.vip * Math.min(0.5, 0.02 * dt); f.byClass.vip -= w; out += w; why.vip += w; }
    if (out > 0) {
      f.aum = Math.max(0, f.aum - out);
      f.outflow += out;
      f._outAcc = (f._outAcc || 0) + out;
      f._outNote = (f._outNote || 0) + out;
      if (f.peakAum > 0 && f.aum < f.peakAum * 0.5 && f._outAcc > f.peakAum * 0.3) TE.Stats.add('bankRun');
      if (out > f.aum * 0.002) F.loseRepPct(0.002 * dt * 10);
    }
    f._noteT = (f._noteT || 0) + dt;
    if (f._noteT >= 5) {
      f._noteT = 0;
      if (f._outNote > Math.max(1, f.aum) * 0.005) {
        const reason = outflowReason(why, dd, sent, crisis);
        logOut(f, f._outNote, reason);
        TE.Bus.emit('fund:note', { kind: 'out', amount: f._outNote, why: reason, t: s.run.time });
      }
      f._outNote = 0;
      Object.keys(why).forEach((k) => { why[k] = 0; });
    }
    // reputation from fund performance
    if (f.nav >= f.peak * 0.999 && f.aum > 0) F.gainRep(0.04 * F.eraScale() * dt);
    if (dd > 0.12) F.loseRepPct(0.004 * dt);
    // sampling
    f.sampleT += dt;
    if (f.sampleT >= 5) {
      f.sampleT = 0;
      f.navHist.push(f.nav);
      f.aumHist.push(f.aum);
      if (f.navHist.length > 240) f.navHist.shift();
      if (f.aumHist.length > 240) f.aumHist.shift();
      f._outAcc = Math.max(0, (f._outAcc || 0) * 0.9);
    }
    vipTick(dt);
  };

  /* ---------------- VIP mandates ---------------- */
  function vipTick(dt) {
    const s = TE.state;
    const f = s.run.fund;
    const v = f.vip;
    if (v.active) {
      const a = v.active;
      a.elapsed += dt;
      const ddSince = Math.max(0, 1 - f.nav / Math.max(a.peakNav, f.nav));
      if (f.nav > a.peakNav) a.peakNav = f.nav;
      if (ddSince > a.maxDD) a.maxDD = ddSince;
      let done = false, ok = false;
      if (a.maxDD > a.dd) { done = true; ok = false; }
      else if (a.type === 'return' && f.nav / a.startNav - 1 >= a.target) { done = true; ok = true; }
      else if (a.type === 'fees' && f.perfFees + f.mgmtFees - a.fees0 >= a.target) { done = true; ok = true; }
      else if (a.elapsed >= a.dur) { done = true; ok = a.type === 'steady'; }
      if (done) {
        v.active = null;
        if (ok) {
          TE.Economy.earn(a.reward.cash, 'reward');
          F.gainRep(a.reward.rep);
          if (f.byClass.vip) { f.byClass.inst = (f.byClass.inst || 0) + f.byClass.vip; f.byClass.vip = 0; }
          TE.Stats.add('vipDone');
          TE.Bus.emit('vip:done', { a, ok: true });
        } else {
          const w = Math.min(f.aum, f.byClass.vip || 0);
          f.aum -= w; f.byClass.vip = 0; f.outflow += w;
          F.loseRepPct(0.05);
          TE.Bus.emit('vip:done', { a, ok: false });
        }
        v.next = U.range(150, 260);
      }
      return;
    }
    if (v.offer) {
      v.offer.left -= dt;
      if (v.offer.left <= 0) { v.offer = null; v.next = U.range(90, 160); }
      return;
    }
    v.next -= dt;
    if (v.next <= 0 && f.aum > 0) {
      const cap = F.capacity();
      const type = U.weighted([['return', 3], ['steady', 2], ['fees', 2]]);
      const dur = Math.round(U.range(120, 240) / 10) * 10;
      const o = { client: U.pick(D.VIP_CLIENTS), type, dur, left: 45, commit: cap * U.range(0.12, 0.3), dd: 0, target: 0,
        reward: { cash: TE.Economy.refIncome() * U.range(200, 400), rep: 25 * F.eraScale() } };
      if (type === 'return') { o.target = Math.round(U.range(4, 12)) / 100; o.dd = Math.round(U.range(3, 6)) / 100; }
      if (type === 'steady') { o.dd = Math.round(U.range(1.5, 3) * 10) / 1000; }
      if (type === 'fees') { o.target = (TE.Bots.expected().fund + F.mgmtIncome()) * dur * U.range(0.9, 1.15); o.dd = 0.08; }
      v.offer = o;
      TE.Bus.emit('vip:offer', o);
    }
  }
  F.vipText = function (o) {
    if (o.type === 'return') return 'Faites progresser la VL de ' + U.pct(o.target, 0) + ' en ' + U.dur(o.dur) + ' sans dépasser ' + U.pct(o.dd, 0, false) + ' de drawdown.';
    if (o.type === 'steady') return 'Maintenez le drawdown sous ' + U.pct(o.dd, 1, false) + ' pendant ' + U.dur(o.dur) + '.';
    return 'Encaissez ' + U.money(o.target) + ' de frais en ' + U.dur(o.dur) + ' (drawdown max ' + U.pct(o.dd, 0, false) + ').';
  };
  F.acceptVip = function () {
    const f = TE.state.run.fund;
    if (!f || !f.vip.offer || f.vip.active) return false;
    const o = f.vip.offer;
    f.vip.offer = null;
    f.aum += o.commit;
    f.byClass.vip = (f.byClass.vip || 0) + o.commit;
    f.inflow += o.commit;
    f.clients += 1;
    f.vip.active = Object.assign({}, o, { elapsed: 0, startNav: f.nav, peakNav: f.nav, maxDD: 0, fees0: f.perfFees + f.mgmtFees });
    TE.Bus.emit('vip:accept', o);
    return true;
  };
  F.declineVip = function () {
    const f = TE.state.run.fund;
    if (!f || !f.vip.offer) return;
    f.vip.offer = null;
    f.vip.next = U.range(90, 160);
  };

  /* reputation provides a soft bonus to capacity (applied in F.capacity) — no Mods provider needed */
})(window.TE);
