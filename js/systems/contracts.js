/* Contracts (dynamic objectives) and the seeded Daily Market Challenge. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const C = (TE.Contracts = {});
  const run = () => TE.state.run;

  function unlockedClasses() {
    const set = {};
    Object.keys(run().unlocked).forEach((id) => { set[D.ASSET_MAP[id].cls] = 1; });
    return Object.keys(set);
  }
  function botIncome() { return Math.max(1, TE.Bots.expected().total); }

  const TPL = [
    { id: 'wins', w: 3, make: () => ({ target: U.pick([3, 4, 5, 6]) }), title: (c) => 'Clôturez ' + c.target + ' trades manuels gagnants' },
    { id: 'shorts', w: 1.4, make: () => ({ target: U.pick([2, 3]) }), title: (c) => 'Clôturez ' + c.target + ' SHORT gagnants' },
    { id: 'earn', w: 3, make: () => { const T = U.pick([120, 180, 240]); return { target: TE.Economy.refIncome() * T * 1.3, time: T }; },
      title: (c) => 'Gagnez ' + U.money(c.target) + ' en ' + U.dur(c.time) },
    { id: 'botprofit', w: 2.5, ok: () => TE.Bots.totalUnits() > 0 && !TE.Bots.disabled(), make: () => ({ target: botIncome() * U.range(90, 160) }),
      title: (c) => 'Générez ' + U.money(c.target) + ' grâce aux bots' },
    { id: 'streak', w: 1.3, make: () => ({ target: U.pick([3, 4, 5]) }), title: (c) => 'Enchaînez ' + c.target + ' trades gagnants d’affilée' },
    { id: 'hold', w: 1.3, make: () => ({ target: U.pick([30, 45, 60, 90]) }), title: (c) => 'Gardez une position en profit pendant ' + U.dur(c.target) },
    { id: 'leverage', w: 1.4, ok: () => TE.Trading.maxLev() >= 3, make: () => { const t = TE.Trading.levTiers().filter((l) => l >= 3); return { target: 1, lev: t[Math.max(0, t.length - 2)] || 3 }; },
      title: (c) => 'Clôturez un trade gagnant avec un levier d’au moins x' + c.lev },
    { id: 'cls', w: 1.4, ok: () => unlockedClasses().length >= 2, make: () => ({ target: U.pick([2, 3]), cls: U.pick(unlockedClasses()) }),
      title: (c) => 'Clôturez ' + c.target + ' trades gagnants (' + D.ASSET_CLASSES[c.cls].name + ')' },
    { id: 'buybots', w: 2, ok: () => D.BOTS.some((b) => TE.Bots.unlocked(b.id)) && !TE.Bots.disabled(), make: () => {
      const pool = D.BOTS.filter((b) => TE.Bots.unlocked(b.id));
      const b = pool[Math.max(0, pool.length - 1 - U.irange(0, Math.min(1, pool.length - 1)))];
      return { bot: b.id, target: TE.Bots.count(b.id) + U.irange(3, 8) }; },
      title: (c) => 'Possédez ' + c.target + ' unités de ' + D.BOT_MAP[c.bot].name },
    { id: 'aum', w: 2, ok: () => TE.Fund.active() && TE.Fund.aum() > 0, make: () => ({ target: Math.min(TE.Fund.capacity(), TE.Fund.aum() * 1.4) * 1.0 }),
      title: (c) => 'Atteignez ' + U.money(c.target) + ' d’AUM' },
    { id: 'research', w: 1.2, ok: () => TE.Research.active(), make: () => ({ target: 1 }), title: () => 'Terminez un projet de recherche' },
    { id: 'bigtrade', w: 1.4, make: () => ({ target: TE.Economy.refIncome() * U.range(20, 45) }), title: (c) => 'Gagnez ' + U.money(c.target) + ' sur un seul trade manuel' },
    { id: 'crit', w: 0.7, make: () => ({ target: 1 }), title: () => 'Décrochez un profit critique sur un trade manuel' },
    { id: 'opps', w: 0.8, make: () => ({ target: 2 }), title: () => 'Saisissez 2 opportunités' },
  ];
  const TPL_MAP = {};
  TPL.forEach((t) => { TPL_MAP[t.id] = t; });

  C.slots = () => 3 + (TE.Prestige.perk('contracts') >= 3 ? 1 : 0);
  C.active = () => !!TE.state.profile.features.contracts;
  C.title = (c) => TPL_MAP[c.tpl].title(c);

  function makeReward() {
    const ref = TE.Economy.refIncome();
    const m = TE.Mods.get('contract.reward');
    // rewards are stored in seconds of income and re-evaluated at payout, so they never go stale
    const secs = U.range(30, 70);
    const r = { secs, cash: ref * secs * m };
    const roll = Math.random();
    if (roll < 0.25 && TE.Research.active()) r.rp = Math.max(25, TE.Research.rate() * 120 * m);
    else if (roll < 0.45) r.rep = 6 * TE.Fund.eraScale() * m;
    else if (roll < 0.58) r.buff = { stat: 'income.global', mult: 1.5, dur: 60 };
    return r;
  }
  function newContract(exclude) {
    const r = run();
    const used = r.contracts.list.map((c) => c.tpl).concat(exclude ? [exclude] : []);
    const pool = TPL.filter((t) => used.indexOf(t.id) < 0 && (!t.ok || t.ok())).map((t) => [t, t.w]);
    if (!pool.length) return null;
    const t = U.weighted(pool);
    const c = Object.assign({ cid: r.contracts.nextId++, tpl: t.id, prog: 0, created: r.time, reward: makeReward() }, t.make());
    if (c.time) c.deadline = r.time + c.time;
    if (t.id === 'buybots') c.prog = TE.Bots.count(c.bot);
    return c;
  }
  C.reroll = function (cid) {
    const r = run();
    if (r.time < r.contracts.reroll) return false;
    const i = r.contracts.list.findIndex((c) => c.cid === cid);
    if (i < 0) return false;
    const old = r.contracts.list[i];
    const n = newContract(old.tpl);
    if (!n) return false;
    r.contracts.list[i] = n;
    r.contracts.reroll = r.time + 60;
    TE.Bus.emit('contracts:changed');
    return true;
  };
  C.rewardCash = (rw) => Math.max(rw.cash, rw.secs ? TE.Economy.refIncome() * rw.secs * TE.Mods.get('contract.reward') : 0);
  C.rewardRP = (rw) => (rw.rp ? Math.max(rw.rp, TE.Research.rate() * 120 * TE.Mods.get('contract.reward')) : 0);
  function complete(c) {
    const r = run();
    r.contracts.list = r.contracts.list.filter((x) => x.cid !== c.cid);
    const rw = c.reward;
    rw.cash = C.rewardCash(rw);
    if (rw.rp) rw.rp = C.rewardRP(rw);
    TE.Economy.earn(rw.cash, 'reward');
    if (rw.rp) TE.Research.grant(rw.rp);
    if (rw.rep) TE.Fund.gainRep(rw.rep);
    if (rw.buff) TE.Events.addTemp(rw.buff.stat, { mult: rw.buff.mult }, rw.buff.dur, 'Bonus de contrat');
    TE.Stats.add('contracts');
    r.contracts.refill = r.time + 8;
    TE.Bus.emit('contract:done', c);
    TE.Bus.emit('contracts:changed');
  }
  C.rewardText = function (rw) {
    const parts = [U.money(C.rewardCash(rw))];
    if (rw.rp) parts.push(U.fmt(C.rewardRP(rw)) + ' RP');
    if (rw.rep) parts.push('+' + U.fmt(rw.rep) + ' de réputation');
    if (rw.buff) parts.push('Revenus ×1,5 (60 s)');
    return parts.join(' · ');
  };

  function bump(tpl, amount, filter) {
    const r = run();
    r.contracts.list.forEach((c) => {
      if (c.tpl !== tpl || c.done) return;
      if (filter && !filter(c)) return;
      c.prog += amount;
      if (c.prog >= c.target) { c.done = true; complete(c); }
    });
  }
  function setProg(tpl, value) {
    run().contracts.list.forEach((c) => {
      if (c.tpl !== tpl || c.done) return;
      c.prog = Math.max(c.prog, value);
      if (c.prog >= c.target) { c.done = true; complete(c); }
    });
  }

  TE.Bus.on('trade:close', (t) => {
    if (!TE.state) return;
    if (t.net > 0) {
      bump('wins', 1);
      if (t.side < 0) bump('shorts', 1);
      bump('cls', 1, (c) => c.cls === t.cls);
      bump('leverage', 1, (c) => t.lev >= c.lev - 1e-6);
      setProg('bigtrade', t.total);
      if (t.crit) bump('crit', 1);
    }
    setProg('streak', run().account.combo);
  });
  TE.Bus.on('earn', (e) => { if (TE.state) { bump('earn', e.amount); if (e.src && e.src !== 'manual' && e.src !== 'reward' && e.src !== 'vc') bump('botprofit', e.amount); } });
  TE.Bus.on('research:done', () => bump('research', 1));
  TE.Bus.on('opp:claim', () => bump('opps', 1));

  C.tick = function () {
    const r = run();
    if (!C.active()) return;
    // expire timed contracts
    r.contracts.list.forEach((c, i) => {
      if (c.deadline && r.time > c.deadline && !c.done) {
        const n = newContract(c.tpl);
        if (n) r.contracts.list[i] = n;
        TE.Bus.emit('contract:expired', c);
        TE.Bus.emit('contracts:changed');
      }
    });
    // polled progress
    r.contracts.list.forEach((c) => {
      if (c.tpl === 'buybots') setProg('buybots', TE.Bots.count(c.bot));
      if (c.tpl === 'aum') setProg('aum', TE.Fund.aum());
      if (c.tpl === 'hold') {
        let best = 0;
        const ps = r.account.positions;
        Object.keys(ps).forEach((id) => { const p = ps[id]; if (p.greenSince !== null) best = Math.max(best, r.time - p.greenSince); });
        setProg('hold', best);
      }
    });
    if (r.contracts.list.length < C.slots() && r.time >= r.contracts.refill) {
      const n = newContract();
      if (n) { r.contracts.list.push(n); TE.Bus.emit('contracts:changed'); TE.Bus.emit('contract:new', n); }
      r.contracts.refill = r.time + 6;
    }
  };

  /* ======================= DAILY MARKET CHALLENGE ======================= */
  const Daily = (TE.Daily = {});
  Daily.DURATION = 120;
  Daily.START = 10000;
  Daily.TIERS = [
    { name: 'Bronze', cls: 'bronze', min: 0, mult: 1.5 }, { name: 'Argent', cls: 'silver', min: 0.08, mult: 2 }, { name: 'Or', cls: 'gold', min: 0.2, mult: 3 }, { name: 'Diamant', cls: 'diamond', min: 0.45, mult: 5 },
  ];
  Daily.key = () => U.dateKey();
  Daily.seed = () => U.hash('TRADING-EMPIRE-DAILY-' + Daily.key());
  Daily.asset = function () {
    const rng = U.mulberry32(Daily.seed());
    const base = D.ASSETS[Math.floor(rng() * 12)];
    return Object.assign({}, base, { id: 'DLY', name: base.name, vol: Math.max(0.8, base.vol), trend: Math.max(0.9, base.trend), price: base.price, baseId: base.id });
  };
  Daily.tierOf = function (ret) {
    let t = null;
    Daily.TIERS.forEach((x, i) => { if (ret >= x.min) t = Object.assign({ idx: i + 1 }, x); });
    return t;
  };
  Daily.best = () => TE.state.profile.daily.best[Daily.key()];
  Daily.claimed = () => !!TE.state.profile.daily.claimed[Daily.key()];
  Daily.submit = function (finalEquity) {
    const p = TE.state.profile.daily;
    const key = Daily.key();
    const ret = finalEquity / Daily.START - 1;
    const prev = p.best[key];
    if (prev === undefined || ret > prev) p.best[key] = ret;
    TE.Stats.add('dailyPlayed');
    const tier = Daily.tierOf(ret);
    let reward = null;
    if (!p.claimed[key] && tier) {
      p.claimed[key] = 1;
      const y = new Date(); y.setDate(y.getDate() - 1);
      p.streak = p.lastDay === U.dateKey(y) ? p.streak + 1 : 1;
      p.lastDay = key;
      TE.Stats.max('dailyStreak', p.streak);
      const mult = tier.mult * (1 + Math.min(0.5, p.streak * 0.05));
      TE.Events.addTemp('income.global', { mult }, 600, 'Défi quotidien (' + tier.name + ')');
      const cash = TE.Economy.refIncome() * 120;
      TE.Economy.earn(cash, 'reward');
      reward = { mult, cash, tier, streak: p.streak };
    }
    if (tier) TE.Stats.max('dailyBestTier', tier.idx);
    // keep the record small
    const keys = Object.keys(p.best).sort();
    while (keys.length > 30) { const k = keys.shift(); delete p.best[k]; delete p.claimed[k]; }
    return { ret, tier, reward };
  };
})(window.TE);
