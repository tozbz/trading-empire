/* Events: random market events, economic crises (boss fights), timed opportunities, news feed,
 * temporary effects (buffs) and active abilities. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const Ev = (TE.Events = {});
  const run = () => TE.state.run;

  /* ======================= helpers ======================= */
  function unlockedIds() { return Object.keys(run().unlocked); }
  function hasClass(cls) { return unlockedIds().some((id) => D.ASSET_MAP[id].cls === cls); }
  function needsOk(n) {
    if (!n) return true;
    if (n === 'bots') return TE.Bots.totalUnits() > 0 && !TE.Bots.disabled();
    if (n === 'fund') return TE.Fund.active();
    if (n === 'staff') return TE.Firm.staffTotal() > 0;
    if (n === 'research') return TE.Research.active();
    return hasClass(n);
  }
  function resolveTargets(target) {
    const ids = unlockedIds();
    if (target === 'all') return ids;
    if (target.indexOf('cls:') === 0) { const c = target.slice(4); return ids.filter((id) => D.ASSET_MAP[id].cls === c); }
    if (target.indexOf('asset:') === 0) { const a = target.slice(6); return run().unlocked[a] ? [a] : []; }
    if (target === 'meme') {
      const memes = ids.filter((id) => D.ASSET_MAP[id].meme);
      const pool = memes.length ? memes : ids.filter((id) => D.ASSET_MAP[id].cls === 'crypto');
      return pool.length ? [U.pick(pool)] : [];
    }
    if (target.indexOf('pick:') === 0) {
      const spec = target.slice(5);
      const pool = spec === 'any' ? ids : ids.filter((id) => spec.split('|').indexOf(D.ASSET_MAP[id].cls) >= 0);
      return pool.length ? [U.pick(pool)] : [];
    }
    return [];
  }
  function fill(text, ctx) {
    return text.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined ? ctx[k] : m));
  }
  Ev.fill = fill;

  /* ======================= temps (timed effects) ======================= */
  Ev.addTemp = function (stat, eff, dur, label, cat) {
    const r = run();
    r.temps.push(Object.assign({ stat, until: r.time + dur, label: label || 'Effet', cat: cat || 'buff' }, eff));
  };
  function refreshTemps() {
    const r = run();
    const now = r.time;
    if (r.temps.length) r.temps = r.temps.filter((t) => t.until > now);
    TE.Mods.setTemps(r.temps);
  }

  /* ======================= random events ======================= */
  Ev.init = function () {
    const r = run();
    if (!TE.state.profile.stats.events && r.events.next < 150) r.events.next = 150;
  };
  function eligible(def) {
    if (def.era > run().era) return false;
    if (!needsOk(def.needs)) return false;
    if (resolveTargets(def.target).length === 0) return false;
    if (run().events.active.some((e) => e.id === def.id)) return false;
    return true;
  }
  Ev.trigger = function (id, opts) {
    const def = D.EVENT_MAP[id];
    if (!def) return false;
    const targets = resolveTargets(def.target);
    if (!targets.length && def.target !== 'all') return false;
    const r = run();
    const inst = { id, t: 0, dur: def.dur, lead: opts && opts.instant ? 0 : def.lead + TE.Mods.get('news.lead'), started: false, targets, botId: null };
    if (def.fx.botPick) {
      const owned = D.BOTS.filter((b) => TE.Bots.count(b.id) > 0);
      if (!owned.length) return false;
      inst.botId = U.pick(owned).id;
    }
    const a0 = targets[0] && D.ASSET_MAP[targets[0]];
    inst.ctx = { name: a0 ? a0.name : '', sym: a0 ? a0.id : '', bot: inst.botId ? D.BOT_MAP[inst.botId].name : '', fund: TE.state.profile.fundName || 'Empire Capital' };
    r.events.active.push(inst);
    Ev.news({ cat: def.tone === 'neg' ? 'ALERTE' : 'DERNIÈRE MINUTE', text: fill(def.head, inst.ctx), asset: def.target === 'all' ? null : targets[0],
      dir: def.tone === 'pos' ? 1 : def.tone === 'neg' ? -1 : 0, impact: 'HIGH', event: true, developing: inst.lead > 0, hitAt: r.time + Math.max(0, inst.lead) });
    TE.Bus.emit('event:incoming', { inst, def });
    if (inst.lead <= 0) startEvent(inst);
    return true;
  };
  function startEvent(inst) {
    const def = D.EVENT_MAP[inst.id];
    const fx = def.fx;
    const neg = TE.Mods.get('event.neg');
    inst.started = true;
    inst.t = 0;
    let targets = inst.targets;
    if (def.target !== 'all' && targets[0]) TE.Market.newsMark(targets[0], def.tone === 'pos' ? 1 : def.tone === 'neg' ? -1 : 0, def.name);
    if (fx.classes) targets = targets.filter((id) => fx.classes.indexOf(D.ASSET_MAP[id].cls) >= 0);
    if (fx.metalsOnly) targets = targets.filter((id) => id === 'GOLD' || id === 'SILVER');
    targets.forEach((id) => {
      const ad = D.ASSET_MAP[id];
      if (fx.vol || fx.volume) TE.Market.eventFx(id, { vol: fx.vol || 1, volume: fx.volume || 1 }, def.dur);
      if (fx.drift) TE.Market.impulse(id, fx.drift * Math.sqrt(ad.sens) * Math.max(0.3, ad.trend), def.dur, def.id);
      if (fx.jump) TE.Market.jump(id, fx.jump * Math.min(2.5, ad.sens * Math.max(0.35, ad.trend)));
      if (fx.jumpRandom) TE.Market.jump(id, (Math.random() < 0.5 ? -1 : 1) * fx.jumpRandom * Math.max(0.3, ad.trend));
      if (fx.regime) TE.Market.forceRegime(id, fx.regime, fx.regime === 'flash' || fx.regime === 'squeeze' ? undefined : Math.max(def.dur, 10));
      if (fx.meme) {
        const gain = ad.meme ? 9 : 1.2;
        TE.Market.forceRegime(id, 'bubble', def.dur * 0.7);
        TE.Market.impulse(id, Math.log(1 + gain) / (def.dur * 0.7), def.dur * 0.7, 'meme');
        inst.memeCrash = { id, at: def.dur * 0.7 };
      }
    });
    if (fx.mods) fx.mods.forEach((m) => {
      const isNeg = (m.mult !== undefined && m.mult < 1 && m.stat.indexOf('withdraw') < 0) || (m.add !== undefined && m.add < 0);
      const e = {};
      if (m.mult !== undefined) e.mult = isNeg ? 1 - (1 - m.mult) * neg : m.mult;
      if (m.add !== undefined) e.add = isNeg ? m.add * neg : m.add;
      Ev.addTemp(m.stat, e, def.dur, def.name, 'event');
    });
    if (fx.rep) TE.Fund.loseRepPct(-fx.rep * neg);
    TE.Stats.add('events');
    TE.Bus.emit('event:start', { inst, def });
  }
  function endEvent(inst) {
    TE.Bus.emit('event:end', { inst, def: D.EVENT_MAP[inst.id] });
  }
  function tickEvents(dt) {
    const r = run();
    const ev = r.events;
    for (let i = ev.active.length - 1; i >= 0; i--) {
      const inst = ev.active[i];
      if (!inst.started) {
        inst.lead -= dt;
        if (inst.lead <= 0) startEvent(inst);
        continue;
      }
      inst.t += dt;
      if (inst.memeCrash && inst.t >= inst.memeCrash.at) { TE.Market.forceRegime(inst.memeCrash.id, 'crash', 14, 2.2); inst.memeCrash = null; }
      if (inst.t >= inst.dur) { ev.active.splice(i, 1); endEvent(inst); }
    }
    ev.next -= dt * (r.challenge === 'extremevol' ? 2 : 1);
    if (ev.next <= 0 && !(ev.crisis && ev.crisis.active)) {
      ev.next = U.range(55, 120);
      const pool = D.EVENTS.filter(eligible).map((d) => [d.id, d.w]);
      if (pool.length) Ev.trigger(U.weighted(pool));
    }
  }

  /* ======================= crises ======================= */
  function tickCrisis(dt) {
    const r = run();
    const ev = r.events;
    // schedule
    if (!ev.crisis && !ev.crisisNext) {
      const def = D.CRISES.find((c) => c.era <= r.era && !ev.crisisDone[c.id]);
      if (def) {
        const enteredEra = ev.eraCrisisAt[r.era] || (ev.eraCrisisAt[r.era] = r.time);
        ev.crisisNext = { id: def.id, at: Math.max(r.time + 60, enteredEra + U.range(160, 280)) };
      }
    }
    if (!ev.crisis && ev.crisisNext) {
      const def = D.CRISIS_MAP[ev.crisisNext.id];
      if (r.time >= ev.crisisNext.at - def.warn) {
        ev.crisis = { id: def.id, active: false, warn: def.warn, t: 0, phase: 0, pnl: 0, liq0: TE.Stats.life('liquidations') };
        ev.crisisNext = null;
        Ev.news({ cat: 'AVERTISSEMENT', text: 'AVIS DE TEMPÊTE — ' + def.warnText, impact: 'HIGH', dir: -1, event: true });
        TE.Bus.emit('crisis:warning', def);
      }
    }
    const c = ev.crisis;
    if (!c) return;
    const def = D.CRISIS_MAP[c.id];
    if (!c.active) {
      c.warn -= dt;
      if (c.warn <= 0) {
        c.active = true;
        c.t = 0;
        c.income0 = Math.max(TE.Economy.refIncome(), 1);
        c.nav0 = TE.Fund.active() ? r.fund.nav : null;
        c.navPeak = c.nav0;
        c.maxDD = 0;
        TE.Market.forceMacro('crisis', def.dur);
        Ev.news({ cat: 'CRISE', text: def.name + ' — ' + def.intro, impact: 'HIGH', dir: -1, event: true });
        TE.Bus.emit('crisis:start', def);
      }
      return;
    }
    c.t += dt;
    let ph = 0;
    def.phases.forEach((p, i) => { if (c.t >= p.at) ph = i; });
    if (ph !== c.phase) { c.phase = ph; TE.Bus.emit('crisis:phase', { def, phase: def.phases[ph] }); }
    // fund drawdown during crisis
    if (TE.Fund.active() && c.nav0) {
      const nav = r.fund.nav;
      if (nav > c.navPeak) c.navPeak = nav;
      c.maxDD = Math.max(c.maxDD, 1 - nav / c.navPeak);
    }
    TE.state.market.macro.id = 'crisis';
    if (c.t >= def.dur) endCrisis(c, def);
  }
  function endCrisis(c, def) {
    const r = run();
    const ev = r.events;
    ev.crisis = null;
    ev.crisisDone[def.id] = 1;
    const g = Ev.crisisGoals(c, def);
    const ok = (g.dd.ok ? 1 : 0) + (g.profit.ok ? 1 : 0);
    TE.Stats.add('crisesSurvived');
    let mult = 1;
    if (ok === 2) {
      TE.Stats.add('crisisPerfect');
      const cb = TE.state.profile.records.crisesBeaten || (TE.state.profile.records.crisesBeaten = {});
      cb[def.id] = 1;
      mult = def.reward;
    } else if (ok === 1) mult = 1 + (def.reward - 1) / 2;
    if (mult > 1) {
      r.buffs.crisis = (r.buffs.crisis || 1) * mult;
      TE.Mods.dirty = true;
    }
    const cash = c.income0 * 240 * (ok === 2 ? 1 : ok === 1 ? 0.5 : 0.15);
    TE.Economy.earn(cash, 'reward');
    TE.Fund.gainRep(100 * TE.Fund.eraScale() * (1 + ok));
    TE.state.market.macro = { id: 'recovery', t: 0, d: 90 };
    TE.state.market.macroForce = null;
    Ev.news({ cat: 'MARCHÉS', text: def.name + ' : c’est terminé. Les marchés entrent en reprise.', impact: 'MED', dir: 1 });
    TE.Bus.emit('crisis:end', { def, goals: g, ok, mult, cash });
  }
  Ev.crisisGoals = function (c, def) {
    const fund = TE.Fund.active() && c.nav0;
    const nLiq = TE.Stats.life('liquidations') - c.liq0;
    const dd = fund ? { label: 'Drawdown du fonds sous ' + U.pct(def.ddGoal, 0, false), ok: c.maxDD <= def.ddGoal, val: U.pct(c.maxDD, 1, false) }
      : { label: 'Aucune liquidation', ok: nLiq === 0, val: nLiq + ' liq.' };
    const target = def.profitGoal * c.income0;
    const profit = { label: 'Gagnez ' + U.money(target) + ' pendant la crise', ok: c.pnl >= target, val: U.money(c.pnl), pct: U.clamp(c.pnl / target, 0, 1) };
    return { dd, profit };
  };
  Ev.crisis = () => run().events.crisis;
  Ev.crisisPhase = function () {
    const c = run().events.crisis;
    if (!c || !c.active) return null;
    return D.CRISIS_MAP[c.id].phases[c.phase];
  };
  Ev.crisisWithdraw = function () { const p = Ev.crisisPhase(); return p && p.withdraw ? p.withdraw : 0; };
  TE.Bus.on('earn', (e) => { const c = TE.state && run().events.crisis; if (c && c.active) c.pnl += e.amount; });
  TE.Bus.on('lose', (e) => { const c = TE.state && run().events.crisis; if (c && c.active) c.pnl -= e.amount; });

  /* ======================= world ctx / bot mods ======================= */
  Ev.applyWorldCtx = function (ctx) {
    const s = TE.state;
    if (!s) return;
    const r = s.run;
    const p = Ev.crisisPhase();
    if (p) {
      ctx.macroVol = p.vol;
      ctx.corr = p.corr;
      ctx.crisisDrift = p.drift;
      if (p.fxVol) ctx.clsVol.fx = p.fxVol / p.vol;
      ctx.safeHaven = true;
    }
    for (let i = 0; i < r.events.active.length; i++) {
      const inst = r.events.active[i];
      if (!inst.started) continue;
      const fx = D.EVENT_MAP[inst.id].fx;
      if (fx.corr) ctx.corr = Math.max(ctx.corr, fx.corr);
      if (fx.safeHaven) ctx.safeHaven = true;
    }
  };
  Ev.sentimentShift = function () {
    const r = run();
    let s = 0;
    for (let i = 0; i < r.events.active.length; i++) {
      const inst = r.events.active[i];
      if (!inst.started) continue;
      const fx = D.EVENT_MAP[inst.id].fx;
      if (fx.sent) s += fx.sent * (1 - inst.t / Math.max(1, inst.dur));
    }
    return s;
  };
  Ev.botMods = function (botId) {
    const r = run();
    let win = 0, speed = 1;
    const neg = TE.Mods.get('event.neg');
    for (let i = 0; i < r.events.active.length; i++) {
      const inst = r.events.active[i];
      if (!inst.started) continue;
      const fx = D.EVENT_MAP[inst.id].fx;
      if (fx.outage && botId !== 'desk') speed *= 1 - (1 - fx.outage) * neg * TE.Mods.get('event.outage');
      if (fx.botPick && inst.botId === botId) win += fx.botPick.add * neg * TE.Mods.get('event.outage');
    }
    const p = Ev.crisisPhase();
    if (p && p.botWin) win += p.botWin * neg;
    return { win, speed };
  };
  Ev.botBugged = function (botId) {
    return run().events.active.some((i) => i.started && i.botId === botId);
  };

  /* ======================= news ======================= */
  Ev.news = function (n) {
    const r = run();
    const item = Object.assign({ t: r.time, id: U.uid(), cat: 'MARCHÉS', impact: null, dir: 0 }, n);
    r.news.unshift(item);
    if (r.news.length > 40) r.news.length = 40;
    TE.Bus.emit('news', item);
    return item;
  };
  function marketNews() {
    const r = run();
    const ids = unlockedIds();
    if (!ids.length) return;
    const id = U.weighted(ids.map((x) => [x, D.ASSET_MAP[x].sens]));
    const def = D.ASSET_MAP[id];
    const macro = TE.Market.macro();
    const dir = Math.random() < 0.5 * macro.up / ((macro.up + macro.down) / 2) ? 1 : -1;
    const pool = (D.NEWS[def.cls] || D.NEWS.stock)[dir > 0 ? 'up' : 'down'];
    const text = fill(U.pick(pool), { name: def.name, sym: def.id, product: def.product || 'un nouveau produit phare', n: U.irange(2, 9) });
    const mag = U.range(0.4, 1);
    const impact = mag > 0.8 ? 'HIGH' : mag > 0.55 ? 'MED' : 'LOW';
    const rumor = Math.random() < 0.15;
    const real = !rumor || Math.random() < 0.5;
    const lead = U.range(5, 10) + TE.Mods.get('news.lead');
    const hitAt = r.time + lead;
    const k = mag * Math.sqrt(def.sens) * Math.max(0.3, def.trend);
    if (real) r.shocks.push({ at: hitAt, asset: id, drift: dir * 0.004 * k, dur: U.range(8, 16), dir });
    // V2: a false rumour still moves the crowd for a few seconds… until it is denied
    else r.shocks.push({ at: hitAt, asset: id, drift: dir * 0.0016 * k, dur: 8, dir, fake: true });
    const n = Ev.news({ cat: (D.ASSET_CLASSES[def.cls] || {}).tag || 'MARCHÉS', text: (rumor ? 'RUMEUR : ' : '') + text, asset: id, dir, impact, rumor, hitAt });
    if (rumor && TE.World) TE.World.addRumor({ asset: id, dir, real, mag, newsId: n.id, at: hitAt + U.range(11, 17) });
  }
  function tickNews(dt) {
    const r = run();
    r._newsT = (r._newsT === undefined ? 12 : r._newsT) - dt;
    if (r._newsT <= 0) {
      if (Math.random() < 0.72) marketNews();
      else Ev.news({ cat: 'INSOLITE', text: U.pick(D.NEWS_FLAVOR) });
      r._newsT = U.range(16, 34);
    }
    for (let i = r.shocks.length - 1; i >= 0; i--) {
      const sh = r.shocks[i];
      if (r.time >= sh.at) {
        r.shocks.splice(i, 1);
        if (r.unlocked[sh.asset]) {
          TE.Market.impulse(sh.asset, sh.drift, sh.dur, 'news');
          TE.Market.newsMark(sh.asset, sh.dir || Math.sign(sh.drift), 'NEWS');
          TE.Bus.emit('news:hit', { asset: sh.asset, dir: sh.dir || Math.sign(sh.drift) });
        }
      }
    }
    // the world notices you
    const nw = TE.Economy.netWorth();
    r.flags.empireNews = r.flags.empireNews || 0;
    const next = D.NEWS_EMPIRE[r.flags.empireNews];
    if (next && nw >= next.at) {
      r.flags.empireNews++;
      Ev.news({ cat: 'EMPIRE', text: fill(next.text, { fund: TE.state.profile.fundName || 'un trader anonyme' }), impact: 'HIGH', dir: 1, empire: true });
    }
  }

  /* ======================= opportunities ======================= */
  function oppEligible(o) { return o.era <= run().era && needsOk(o.needs); }
  Ev.spawnOpportunity = function (id, extra) {
    const r = run();
    const def = id ? D.OPP_MAP[id] : U.weighted(D.OPPORTUNITIES.filter(oppEligible).map((o) => [o, o.w]));
    if (!def) return;
    const cur = { id: def.id, left: 20, total: 20 };
    if (def.special === 'legendary') {
      const ids = unlockedIds();
      cur.asset = U.pick(ids);
      cur.text = def.text.replace('le marché signalé', cur.asset);
    }
    if (def.special === 'poach') {
      const l = D.LEGEND_MAP[extra && extra.legend];
      const rv = D.RIVAL_MAP[extra && extra.rival];
      if (!l || !rv) return;
      cur.legend = l.id; cur.rival = rv.id;
      cur.cost = TE.Economy.refIncome() * 150;
      cur.text = fill(def.text, { rival: rv.name, name: l.name }) + ' Contre-offre : ' + U.money(cur.cost) + '.';
      cur.left = cur.total = 25;
    }
    r.opp.cur = cur;
    TE.Bus.emit('opp:spawn', cur);
  };
  function poachResolve(cur, choice) {
    const r = run();
    const l = D.LEGEND_MAP[cur.legend];
    const rv = D.RIVAL_MAP[cur.rival];
    if (!l || !rv) return 'Rien à signaler.';
    if (choice === 'counter' && TE.Economy.spend(cur.cost)) {
      TE.Fund.gainRep(10 * TE.Fund.eraScale());
      return l.name + ' reste chez vous (contre-offre de ' + U.money(cur.cost) + ').';
    }
    r.legendsAway = r.legendsAway || {};
    r.legendsAway[l.id] = r.time + 300;
    TE.Mods.dirty = true;
    Ev.news({ cat: 'CONCURRENCE', text: l.name + ' rejoint temporairement ' + rv.name + '. Retour prévu dans 5 minutes.', impact: 'MED', dir: -1, rival: true });
    return l.name + ' part chez ' + rv.name + ' pendant 5 minutes : ses bonus sont suspendus.';
  }
  Ev.claimOpportunity = function (choice) {
    const r = run();
    const cur = r.opp.cur;
    if (!cur) return null;
    const def = D.OPP_MAP[cur.id];
    r.opp.cur = null;
    r.opp.next = U.range(70, 140) / TE.Mods.get('opp.freq');
    const ref = TE.Economy.refIncome();
    const rm = TE.Mods.get('opp.reward');
    const res = { def, text: '' };
    const rw = def.reward || {};
    if (def.special === 'legendary') {
      r.legendary = { asset: cur.asset, until: r.time + 30 };
      TE.Market.forceRegime(cur.asset, 'bull', 32, 3.2);
      r.activeAsset = cur.asset;
      res.text = 'Passez LONG sur ' + cur.asset + ' dans les 30 s : profits ×5 sur ce trade';
    } else if (def.special === 'poach') {
      res.text = poachResolve(cur, choice);
      res.bad = choice !== 'counter';
    } else if (def.choice) {
      if (choice === 'take') {
        const cash = ref * 300 * rm;
        TE.Economy.earn(cash, 'reward');
        if (Math.random() < 0.35) {
          TE.Fund.loseRepPct(0.15);
          if (TE.Fund.active()) { const f = r.fund; const w = f.aum * 0.1; f.aum -= w; f.outflow += w; }
          res.text = '+' + U.money(cash) + '… et les régulateurs l’ont découvert. Réputation -15 %.';
          res.bad = true;
          Ev.news({ cat: 'SCANDALE', text: 'Les régulateurs enquêtent sur des transactions suspectes chez ' + (TE.state.profile.fundName || 'une firme de trading en pleine croissance') + '.', impact: 'HIGH', dir: -1 });
        } else { TE.Stats.add('insiderClean'); res.text = '+' + U.money(cash) + '. Personne n’a rien vu. Cette fois-ci.'; }
        TE.Stats.add('manipulation');
      } else {
        const rep = 15 * TE.Fund.eraScale();
        TE.Fund.gainRep(rep);
        res.text = 'Votre intégrité est remarquée. Réputation +' + U.fmt(rep * TE.Mods.get('rep.gain')) + '.';
      }
    } else {
      if (rw.cash) { const v = ref * rw.cash * rm; TE.Economy.earn(v, 'reward'); res.text = '+' + U.money(v); }
      if (rw.cashRand) { const v = ref * U.range(rw.cashRand[0], rw.cashRand[1]) * rm; TE.Economy.earn(v, 'reward'); res.text = '+' + U.money(v); }
      if (rw.rp) { const v = Math.max(20, TE.Research.rate() * rw.rp * rm); TE.Research.grant(v); res.text = '+' + U.fmt(v) + ' RP'; }
      if (rw.buff) { Ev.addTemp(rw.buff.stat, rw.buff.mult !== undefined ? { mult: rw.buff.mult } : { add: rw.buff.add }, rw.buff.dur, rw.buff.label); res.text = rw.buff.label + ' : actif'; }
      if (rw.buff2) Ev.addTemp(rw.buff2.stat, rw.buff2.mult !== undefined ? { mult: rw.buff2.mult } : { add: rw.buff2.add }, rw.buff2.dur, rw.buff2.label);
      if (rw.staff) { TE.Firm.hire(rw.staff[0], rw.staff[1], true); res.text = '+' + rw.staff[1] + ' × ' + D.STAFF_MAP[rw.staff[0]].name + ' (gratuit)'; }
      if (rw.aum && TE.Fund.active()) { const v = TE.Fund.capacity() * rw.aum; TE.Fund.addInflow('hnw', v, 'Une personne très fortunée', 1); res.text = '+' + U.money(v) + ' d’AUM'; }
      if (rw.rep) { TE.Fund.gainRep(Math.max(5, TE.state.run.rep * rw.rep)); }
    }
    TE.Stats.add('opportunities');
    TE.Bus.emit('opp:claim', res);
    return res;
  };
  function tickOpp(dt) {
    const r = run();
    const o = r.opp;
    if (o.cur) {
      o.cur.left -= dt;
      if (o.cur.left <= 0) {
        const cur = o.cur;
        o.cur = null; o.next = U.range(70, 140) / TE.Mods.get('opp.freq');
        if (cur.id === 'poach') { const txt = poachResolve(cur, 'let'); TE.Bus.emit('opp:claim', { def: D.OPP_MAP.poach, text: txt, bad: true, expired: true }); }
        TE.Bus.emit('opp:expire');
      }
      return;
    }
    o.next -= dt;
    if (o.next <= 0) Ev.spawnOpportunity();
  }

  /* ======================= abilities ======================= */
  Ev.abilityUnlocked = function (a) {
    if (a.id === 'timedil') return TE.Prestige.sperk('timedil') > 0;
    return TE.Mods.has(a.flag);
  };
  Ev.abilityReady = (a) => (run().abilities[a.id] || 0) <= run().time;
  Ev.abilityLeft = (a) => Math.max(0, (run().abilities[a.id] || 0) - run().time);
  Ev.useAbility = function (id) {
    const a = D.ABILITY_MAP[id];
    const r = run();
    if (!a || !Ev.abilityUnlocked(a) || !Ev.abilityReady(a)) return false;
    r.abilities[id] = r.time + a.cd;
    if (a.mods) a.mods.forEach((m) => Ev.addTemp(m.stat, m.mult !== undefined ? { mult: m.mult } : { add: m.add }, a.dur, a.name, 'ability'));
    const act = r.activeAsset;
    const ad = D.ASSET_MAP[act];
    if (id === 'hype') { TE.Market.impulse(act, 0.005 * Math.max(0.4, ad.trend), a.dur, 'hype'); TE.Market.eventFx(act, { volume: 4 }, a.dur); TE.Stats.add('manipulation'); Ev.news({ cat: 'RÉSEAUX SOCIAUX', text: 'Les influenceurs ne parlent soudain plus que de ' + ad.name + '.', asset: act, dir: 1, impact: 'HIGH' }); }
    if (id === 'shortreport') { TE.Market.impulse(act, -0.005 * Math.max(0.4, ad.trend), a.dur, 'short'); TE.Market.eventFx(act, { volume: 4 }, a.dur); TE.Stats.add('manipulation'); Ev.news({ cat: 'ANALYSE', text: 'Un rapport short anonyme de 120 pages remet tout en question chez ' + ad.name + '.', asset: act, dir: -1, impact: 'HIGH' }); }
    if (id === 'rate') { TE.Market.forceMacro('bull', a.dur); TE.Stats.add('manipulation'); Ev.news({ cat: 'MONDE', text: 'Virage accommodant surprise de la banque centrale. Curieusement, c’était votre idée.', dir: 1, impact: 'HIGH' }); }
    if (id === 'liquidity' && TE.Fund.active()) TE.Fund.addInflow('inst', TE.Fund.capacity() * 0.1, 'Injection de liquidités', 1);
    if (id === 'timedil') TE.Loop.dilate(a.dur);
    TE.Bus.emit('ability:use', a);
    return true;
  };

  /* ======================= main tick ======================= */
  Ev.tick = function (dt) {
    tickEvents(dt);
    tickCrisis(dt);
    tickNews(dt);
    tickOpp(dt);
    refreshTemps();
  };

  /* crisis rewards are a run-long multiplier */
  TE.Mods.addProvider((ctx) => {
    const b = TE.state.run.buffs;
    if (b.crisis && b.crisis > 1) ctx.eff('Crisis Rewards', 'Crises surmontées', { stat: 'income.global', mult: b.crisis });
  });
})(window.TE);
