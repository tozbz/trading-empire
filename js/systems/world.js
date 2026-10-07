/* V2 — the world reacts: market attention, regulators, headlines caused by the player, rumour follow-ups,
 * financial calendar, living rivals, run timeline & world memory, run history and records. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const W = (TE.World = {});
  const run = () => TE.state.run;
  const prof = () => TE.state.profile;

  W.fresh = () => ({ att: 0, reg: 0, attLvl: 0, regLvl: 0, ncd: {}, ncdG: 0, cal: [], calNext: 45, calOn: false, rum: [], restrict: null, regT: 25, rivT: 80,
    scandalT: -999, expo: {}, lastNews: null, newsMe: 0, sq: 0 });
  W.st = function () {
    const r = run();
    if (!r.world || typeof r.world !== 'object') r.world = W.fresh();
    const f = W.fresh();
    Object.keys(f).forEach((k) => { if (r.world[k] === undefined) r.world[k] = f[k]; });
    return r.world;
  };

  /* =============================== tips (one-time micro explanations) =============================== */
  W.tip = function (id) {
    const p = prof();
    p.tips = p.tips || {};
    if (p.tips[id] || !D.TIPS[id]) return;
    p.tips[id] = 1;
    TE.Bus.emit('tip', { id, tip: D.TIPS[id] });
  };

  /* =============================== attention =============================== */
  W.attention = () => (TE.state && TE.state.run && TE.state.run.world ? TE.state.run.world.att : 0);
  W.attLevel = function (v) {
    if (v === undefined) v = W.attention();
    let idx = 0;
    D.ATT_LEVELS.forEach((l, i) => { if (v >= l.at) idx = i; });
    return { idx, lvl: D.ATT_LEVELS[idx], next: D.ATT_LEVELS[idx + 1] || null };
  };
  W.addAtt = function (x) {
    if (!(x > 0)) return;
    const w = W.st();
    w.att = U.clamp(w.att + x * TE.Mods.get('att.gain'), 0, 100);
  };
  /** Who the press talks about: anonymous until the firm is in the spotlight. */
  W.who = function (cap) {
    const name = TE.state.profile.fundName || 'Empire Capital';
    if (W.attention() >= 40 && (TE.Fund.active() || run().earnings >= 1e7)) return name;
    return cap ? 'Un trader anonyme' : 'un trader anonyme';
  };

  /* =============================== regulators =============================== */
  W.reg = () => (TE.state && TE.state.run && TE.state.run.world ? TE.state.run.world.reg : 0);
  W.addReg = function (x) {
    if (!(x > 0)) return;
    const w = W.st();
    w.reg = U.clamp(w.reg + x * TE.Mods.get('reg.gain'), 0, 100);
  };
  W.levCap = function () {
    const w = TE.state && TE.state.run && TE.state.run.world;
    return w && w.restrict && w.restrict.until > run().time ? w.restrict.lev : Infinity;
  };
  function regAct() {
    const w = W.st();
    const pool = D.REG_ACTIONS.filter((a) => w.reg >= a.min).map((a) => [a, a.w]);
    const act = U.weighted(pool);
    if (!act) return;
    const who = W.who(true), whoIn = W.who(false); // sentence start / mid-sentence
    let text = '', amount = 0;
    if (act.id === 'inquiry') text = 'RÉGULATEUR — Demande d’informations adressée à ' + whoIn + ' sur ses ordres récents.';
    else if (act.id === 'audit') {
      if (TE.Fund.active()) { TE.Events.trigger('audit', { instant: true }); text = ''; }
      else { w.restrict = { lev: 10, until: run().time + 90 }; text = 'RÉGULATEUR — Restriction temporaire : levier limité à x10 pour ' + whoIn + '.'; }
    } else if (act.id === 'restrict') {
      w.restrict = { lev: 10, until: run().time + 120 };
      text = 'RÉGULATEUR — Restriction temporaire : levier limité à x10 pendant 2 minutes.';
    } else if (act.id === 'fine') {
      amount = Math.min(run().cash * 0.08, TE.Economy.refIncome() * U.range(60, 180) * (w.reg / 100));
      if (amount > 0) TE.Economy.lose(amount, 'fine');
      TE.Fund.loseRepPct(0.03);
      TE.Stats.add('fines');
      text = 'AMENDE — ' + who + ' sanctionné pour manipulation de marché : ' + U.money(amount) + '.';
    } else if (act.id === 'scandal') {
      TE.Fund.loseRepPct(0.08);
      w.scandalT = run().time;
      if (TE.Fund.active()) TE.Fund.forceOutflow(0.05, 'Scandale réglementaire');
      text = 'SCANDALE — Une enquête vise ' + whoIn + '. Les investisseurs s’inquiètent.';
    }
    w.reg = Math.max(0, w.reg - act.relief);
    if (text) TE.Events.news({ cat: 'RÉGULATEUR', text, impact: 'HIGH', dir: -1, me: true, reg: true });
    TE.Bus.emit('world:reg', { act, amount });
  }

  /* =============================== headlines caused by the player =============================== */
  function cool(key, sec) {
    const w = W.st();
    const t = run().time;
    if ((w.ncd[key] || -1e9) > t || w.ncdG > t) return false;
    w.ncd[key] = t + sec;
    w.ncdG = t + 20;
    return true;
  }
  W.pnews = function (kind, id, extra) {
    const def = id ? D.ASSET_MAP[id] : null;
    const list = D.PLAYER_NEWS[kind];
    if (!list) return null;
    const w = W.st();
    const ctx = Object.assign({ sym: def ? def.id : '', name: def ? def.name : '', fund: TE.state.profile.fundName || 'Empire Capital', who: W.who(true) }, extra || {});
    const text = TE.Events.fill(U.pick(list), ctx);
    const me = kind !== 'whale' && kind !== 'squeeze' && kind !== 'cascade';
    const n = TE.Events.news({ cat: kind === 'reg' ? 'RÉGULATEUR' : me ? 'VOUS' : 'MARCHÉS', text, asset: id || null, dir: extra && extra.dir || 0, impact: 'HIGH', me });
    if (me) { w.newsMe++; W.mark('headline', 'Première mention dans les médias', { tag: 'monde' }); TE.Stats.add('headlines'); }
    TE.Bus.emit('world:news', { kind, id, n, me });
    return n;
  };
  W.whaleNews = function (id, dir) {
    if (!cool('whale:' + id, 120)) return;
    W.pnews('whale', id, { side: dir > 0 ? 'accumule' : 'liquide', dir });
    const a = TE.Market.asset(id);
    if (a) a.ns = U.clamp((a.ns || 0) + dir * 0.35, -1.5, 1.5);
  };

  /* =============================== rumours with follow-up =============================== */
  W.addRumor = function (r) {
    const w = W.st();
    w.rum.push(Object.assign({ at: run().time + U.range(14, 22) }, r));
    if (w.rum.length > 6) w.rum.shift();
    W.tip('rumor');
  };
  function tickRumors() {
    const w = W.st();
    const t = run().time;
    for (let i = w.rum.length - 1; i >= 0; i--) {
      const r = w.rum[i];
      if (t < r.at) continue;
      w.rum.splice(i, 1);
      const def = D.ASSET_MAP[r.asset];
      if (!def || !run().unlocked[r.asset]) continue;
      const k = r.mag * Math.sqrt(def.sens) * Math.max(0.3, def.trend);
      const text = TE.Events.fill(U.pick(r.real ? D.RUMOR_FOLLOW.confirm : D.RUMOR_FOLLOW.deny), { name: def.name, sym: def.id });
      const dir = r.real ? r.dir : -r.dir;
      TE.Market.impulse(r.asset, dir * 0.0026 * k, 10, r.real ? 'confirm' : 'deny');
      TE.Market.newsMark(r.asset, dir, r.real ? 'CONFIRMÉ' : 'DÉMENTI');
      const a = TE.Market.asset(r.asset);
      if (a) a.ns = U.clamp((a.ns || 0) + dir * 0.5, -1.5, 1.5);
      TE.Events.news({ cat: r.real ? 'CONFIRMÉ' : 'DÉMENTI', text, asset: r.asset, dir, impact: 'HIGH', follow: r.real ? 'confirm' : 'deny', hitAt: t });
    }
  }

  /* =============================== financial calendar =============================== */
  function calEligible(c) {
    const ids = Object.keys(run().unlocked);
    if (c.kind === 'asset') return ids.some((id) => D.ASSET_MAP[id].cls === c.cls);
    if (c.kind === 'classes') return ids.some((id) => c.classes.indexOf(D.ASSET_MAP[id].cls) >= 0);
    return true;
  }
  function schedule(first) {
    const w = W.st();
    const pool = D.CALENDAR.filter(calEligible).filter((c) => c.kind !== 'asset' || !w.cal.some((e) => e.type === c.id)).map((c) => [c, c.w]);
    const c = U.weighted(pool);
    if (!c) return;
    let asset = null;
    if (c.kind === 'asset') {
      const ids = Object.keys(run().unlocked).filter((id) => D.ASSET_MAP[id].cls === c.cls);
      asset = U.pick(ids);
    }
    const cons = Math.random() < 0.5 ? 1 : -1;
    const conf = U.range(0.56, 0.82);
    const dir = Math.random() < conf ? cons : -cons;
    const ev = { uid: U.uid(), type: c.id, asset, at: run().time + (first ? 55 : U.range(80, 210)), cons, conf, dir, mag: U.range(0.35, 1), leaked: false };
    w.cal.push(ev);
    w.cal.sort((a, b) => a.at - b.at);
    if (first) W.tip('calendar');
  }
  W.calName = function (ev) {
    const c = D.CAL_MAP[ev.type];
    const def = ev.asset ? D.ASSET_MAP[ev.asset] : null;
    return TE.Events.fill(c.name, { sym: def ? def.id : '', name: def ? def.name : '' });
  };
  /** What the player can see about an upcoming announcement. */
  W.calView = function (ev) {
    const t = run().time;
    const c = D.CAL_MAP[ev.type];
    const v = { name: W.calName(ev), icon: c.icon, left: Math.max(0, ev.at - t), asset: ev.asset, leaked: ev.leaked ? ev.dir : 0 };
    if (TE.Mods.has('cal.consensus')) v.cons = { dir: ev.cons, p: ev.conf };
    if (TE.Mods.has('cal.range')) v.range = ev.mag > 0.75 ? 'FORTE' : ev.mag > 0.5 ? 'MODÉRÉE' : 'FAIBLE';
    return v;
  };
  function resolveCal(ev) {
    const c = D.CAL_MAP[ev.type];
    const dir = ev.dir;
    const mag = ev.mag;
    const t = run().time;
    let pct = 0, asset = ev.asset;
    if (c.kind === 'asset' && asset && run().unlocked[asset]) {
      const def = D.ASSET_MAP[asset];
      const j = dir * (0.012 + 0.03 * mag) * Math.min(2.2, def.sens * Math.max(0.35, def.trend));
      TE.Market.jump(asset, j);
      if (mag > 0.6) TE.Market.forceRegime(asset, dir > 0 ? 'bull' : 'bear', 25);
      TE.Market.eventFx(asset, { volume: 5 }, 12);
      pct = j;
    } else if (c.kind === 'macro') {
      Object.keys(run().unlocked).forEach((id) => {
        const def = D.ASSET_MAP[id];
        if (def.cls === 'fx') { TE.Market.jump(id, dir * 0.004 * mag * (Math.random() < 0.5 ? 1 : -1)); return; }
        if (['stock', 'index', 'crypto', 'exotic'].indexOf(def.cls) < 0) return;
        TE.Market.impulse(id, dir * 0.0011 * mag * Math.max(0.3, def.beta), 40, 'cal');
        TE.Market.eventFx(id, { vol: 1.4, volume: 3 }, 20);
      });
      TE.state.market.sent = U.clamp(TE.state.market.sent + dir * 9 * mag, 2, 98);
      asset = null;
    } else if (c.kind === 'classes') {
      Object.keys(run().unlocked).forEach((id) => {
        const def = D.ASSET_MAP[id];
        if (c.classes.indexOf(def.cls) < 0) return;
        TE.Market.jump(id, dir * 0.008 * mag * Math.max(0.5, def.sens));
        TE.Market.eventFx(id, { volume: 4 }, 10);
      });
      asset = null;
    }
    const def = ev.asset ? D.ASSET_MAP[ev.asset] : null;
    const text = TE.Events.fill(dir > 0 ? c.up : c.down, { name: def ? def.name : '', sym: def ? def.id : '', pct: U.pct(Math.abs(pct || 0.01 + 0.04 * mag), 1, false) });
    if (asset) TE.Market.newsMark(asset, dir, 'ANNONCE');
    TE.Events.news({ cat: 'CALENDRIER', text: W.calName(ev) + ' — ' + text, asset, dir, impact: mag > 0.7 ? 'HIGH' : 'MED', cal: true, hitAt: t });
    TE.Bus.emit('calendar:resolve', { ev, dir, asset });
  }
  function tickCal() {
    const w = W.st();
    const r = run();
    if (!w.calOn) {
      if (r.earnings >= 2500 || TE.state.profile.prestige.p1 > 0 && r.time > 60) { w.calOn = true; w.calNext = 1; w.calFirst = true; }
      else return;
    }
    const t = r.time;
    w.calNext -= 1;
    if (w.calNext <= 0 && w.cal.length < 3) { schedule(w.calFirst); w.calFirst = false; w.calNext = U.range(60, 130); }
    const lead = TE.Mods.get('news.lead');
    for (let i = w.cal.length - 1; i >= 0; i--) {
      const ev = w.cal[i];
      if (!ev.leaked && lead >= 2 && ev.at - t <= lead && ev.at > t) {
        ev.leaked = true;
        TE.Events.news({ cat: 'FUITE', text: 'FUITE — ' + W.calName(ev) + ' : nos sources annoncent un résultat ' + (ev.dir > 0 ? 'FAVORABLE' : 'DÉFAVORABLE') + '.', asset: ev.asset, dir: ev.dir, impact: 'MED', hitAt: ev.at });
      }
      if (t >= ev.at) { w.cal.splice(i, 1); resolveCal(ev); }
    }
  }

  /* =============================== living rivals =============================== */
  const rai = () => run().rivalAI || (run().rivalAI = {});
  W.rivalTrouble = function (id) { const x = rai()[id]; return !!(x && x.trouble && x.trouble > run().time); };
  W.rivalState = function (id) {
    const x = rai()[id] || {};
    const t = run().time;
    if (x.trouble > t) return { k: 'trouble', txt: 'EN DIFFICULTÉ', left: x.trouble - t };
    const st = TE.state.market.ag;
    let camp = null;
    Object.keys(st || {}).forEach((aid) => { const wh = st[aid] && st[aid].wh; if (wh && wh.who === id && wh.until > TE.state.market.t) camp = { asset: aid, dir: wh.dir }; });
    if (camp) return { k: 'campaign', txt: (camp.dir > 0 ? 'LONG ' : 'SHORT ') + camp.asset, camp };
    return { k: 'idle', txt: '' };
  };
  function rivalTick() {
    const w = W.st();
    const r = run();
    if (!r.rivals || r.earnings < 1e6) return;
    // overtake detection (only once you are in the same league)
    const fv = TE.Empire.firmValue();
    TE.Empire.rivalList().forEach((x) => {
      const st = rai()[x.def.id] || (rai()[x.def.id] = {});
      const above = x.value > fv;
      if (st.above === false && above && fv > x.value * 0.5 && r.earnings >= 1e8) {
        const text = TE.Events.fill(U.pick(D.RIVAL_NEWS.overtake), { rival: x.def.name, fund: TE.state.profile.fundName || 'votre firme' });
        TE.Events.news({ cat: 'CONCURRENCE', text, impact: 'MED', dir: -1, rival: true });
        TE.Bus.emit('rival:overtook', x.def);
      }
      st.above = above;
    });
    w.rivT -= 1;
    if (w.rivT > 0) return;
    w.rivT = U.range(45, 100);
    const list = TE.Empire.rivalList().filter((x) => !W.rivalTrouble(x.def.id));
    if (!list.length) return;
    const pick = U.weighted(list.map((x) => [x, (D.RIVAL_AI[x.def.id] || { aggr: 0.5 }).aggr]));
    const ai = D.RIVAL_AI[pick.def.id] || { aggr: 0.5, risk: 3, fav: ['stock'] };
    // legend poaching (late game)
    if (r.era >= 4 && ai.aggr >= 0.6 && Math.random() < 0.12 && !r.opp.cur) {
      const legs = Object.keys(r.legends).filter((id) => !(r.legendsAway && r.legendsAway[id] > r.time));
      if (legs.length) { TE.Events.spawnOpportunity('poach', { legend: U.pick(legs), rival: pick.def.id }); return; }
    }
    // a campaign on a favourite market — sometimes against the player's big position
    let ids = Object.keys(r.unlocked).filter((id) => ai.fav.indexOf(D.ASSET_MAP[id].cls) >= 0);
    if (!ids.length) ids = Object.keys(r.unlocked);
    let id = U.pick(ids), dir = 0, attack = false;
    const big = Object.keys(r.account.positions).map((pid) => ({ pid, p: r.account.positions[pid] })).find((x) => x.p.notional / TE.Market.liquidity(x.pid) > 0.12);
    if (big && W.attention() > 50 && ai.aggr > 0.5 && Math.random() < 0.35) { id = big.pid; dir = -big.p.side; attack = true; }
    if (!dir) {
      const a = TE.Market.asset(id);
      const R = TE.Market.regime(id);
      dir = R && R.dir ? (Math.random() < 0.6 ? R.dir : -R.dir) : (a && a.p > a.fair ? -1 : 1);
    }
    TE.Agents.campaign(id, dir, 0.35 + 0.55 * ai.aggr, U.range(60, 150), pick.def.id);
    const text = TE.Events.fill(U.pick(attack ? D.RIVAL_NEWS.attack : D.RIVAL_NEWS.open), { rival: pick.def.name, side: dir > 0 ? 'LONG' : 'SHORT', sym: id, fund: TE.state.profile.fundName || 'votre firme' });
    TE.Events.news({ cat: 'CONCURRENCE', text, asset: id, dir, impact: attack ? 'HIGH' : 'MED', rival: true, me: attack });
    if (attack) TE.Bus.emit('rival:attack', { rival: pick.def, id });
  }
  W.rivalCampaignEnd = function (id, wh) {
    const r = run();
    if (!r.rivals || r.rivals[wh.who] === undefined) return;
    const ai = D.RIVAL_AI[wh.who] || { risk: 3 };
    const def = D.RIVAL_MAP[wh.who];
    const move = TE.Market.mid(id) / (wh.p0 || TE.Market.mid(id)) - 1;
    const pnl = wh.dir * move * ai.risk;
    r.rivals[wh.who] *= 1 + U.clamp(pnl * 0.4, -0.3, 0.3);
    if (Math.abs(pnl) > 0.08 && def) {
      const text = TE.Events.fill(U.pick(pnl > 0 ? D.RIVAL_NEWS.win : D.RIVAL_NEWS.loss), { rival: def.name, sym: id, pct: U.pct(pnl, 0) });
      TE.Events.news({ cat: 'CONCURRENCE', text, asset: id, impact: 'LOW', rival: true });
    }
  };
  function crisisRivals() {
    const r = run();
    if (!r.rivals) return;
    let told = 0;
    TE.Empire.rivalList().forEach((x) => {
      if (Math.random() > 0.25) return;
      r.rivals[x.def.id] *= 0.6;
      rai()[x.def.id] = Object.assign(rai()[x.def.id] || {}, { trouble: r.time + 300 });
      if (told++ < 2) {
        TE.Events.news({ cat: 'CONCURRENCE', text: TE.Events.fill(U.pick(D.RIVAL_NEWS.trouble), { rival: x.def.name }), impact: 'MED', rival: true });
        TE.Bus.emit('rival:trouble', x.def);
      }
    });
  }

  /* =============================== timeline, memory, records =============================== */
  W.mark = function (key, label, extra) {
    const r = run();
    if (!r.tl) r.tl = [];
    r.tlk = r.tlk || {};
    if (r.tlk[key]) return false;
    r.tlk[key] = 1;
    const e = Object.assign({ t: Math.round(r.time), k: key, l: label }, extra || {});
    r.tl.push(e);
    if (r.tl.length > 90) r.tl.splice(1, r.tl.length - 90);
    // records: best (fastest) run time for comparable keys
    const p = prof();
    p.best = p.best || {};
    if (D.RECORD_KEYS.some((x) => x[0] === key)) {
      if (p.best[key] === undefined || e.t < p.best[key]) { if (p.best[key] !== undefined) e.rec = true; p.best[key] = e.t; }
    }
    TE.Bus.emit('timeline', e);
    return true;
  };
  W.init = function () {
    const s = TE.state;
    W.st();
    const r = s.run;
    if (!r.tl || !r.tl.length) {
      r.tl = []; r.tlk = {};
      const pr = s.profile.prestige;
      if (r.time > 30 && r.earnings > 0) {
        // a run started before 2.0: its past milestones have no date — mark them as known (no fake times, no fake records)
        D.TIMELINE_EARN.forEach(([v]) => { if (r.earnings >= v) r.tlk['earn_' + v.toExponential(0).replace('+', '')] = 1; });
        for (let n = 2; n <= r.era; n++) r.tlk['era_' + n] = 1;
        if (TE.Bots.totalUnits() > 0) r.tlk.bot = 1;
        if (TE.Firm.staffTotal() > 0) r.tlk.staff = 1;
        if (Object.keys((r.research && r.research.done) || {}).length) r.tlk.research = 1;
        if (TE.Fund.active()) r.tlk.fund = 1;
        if (s.profile.features.empire) r.tlk.empire = 1;
        if (TE.Prestige.canP1()) r.tlk.p1 = 1;
        W.mark('start', 'Partie reprise depuis une sauvegarde antérieure — Ère ' + D.ERAS[r.era - 1].roman + ', ' + U.money(r.earnings, { dec: 1 }) + ' déjà générés', { tag: 'start' });
        return;
      }
      const seedPerk = TE.Prestige.perk('seed') || TE.Prestige.lperk('headstart');
      W.mark('start', (pr.p1 || pr.p2 || pr.p3 ? 'Nouvelle partie — ' : '') + 'Capital initial : ' + U.money(r.cash, { dec: 0 }) + (seedPerk ? ' (départ accéléré)' : ''), { tag: 'start' });
    }
  };
  function mem() { const p = prof(); return p.memory || (p.memory = {}); }
  W.memory = mem;
  /** Called by the prestige system right before the run is wiped. */
  W.archiveRun = function (layer, gain) {
    const s = TE.state;
    const r = s.run;
    const p = s.profile;
    p.runs = p.runs || [];
    const times = {};
    (r.tl || []).forEach((e) => { if (D.RECORD_KEYS.some((x) => x[0] === e.k)) times[e.k] = e.t; });
    p.runs.push({ n: (p.prestige.p1 + p.prestige.p2 + p.prestige.p3) + 1, layer, dur: Math.round(r.time), era: r.era, earned: r.earnings, gain, at: Date.now(), nw: r.peakNW, times });
    if (p.runs.length > 24) p.runs.splice(0, p.runs.length - 24);
    p.lastRun = times;
    const m = mem();
    m.bestAlpha = Math.max(m.bestAlpha || 0, layer === 1 ? gain : 0);
  };

  /* =============================== per-second world tick =============================== */
  let crashT = 0, volT = 0;
  W.tick1s = function () {
    const s = TE.state;
    const r = s.run;
    const w = W.st();
    // attention: drifts toward a floor set by influence and by how much of a market you hold
    const inf = TE.Empire.influence();
    let dom = 0, domId = null;
    Object.keys(r.account.positions).forEach((id) => {
      const p = r.account.positions[id];
      const sh = p.notional / Math.max(1e-9, TE.Market.liquidity(id));
      if (sh > dom) { dom = sh; domId = id; }
    });
    const floor = U.clamp(70 * Math.sqrt(inf) + 40 * Math.min(1, dom / 0.5), 0, 85);
    if (w.att > floor) w.att -= (w.att - floor) * 0.006;
    else w.att += (floor - w.att) * 0.03;
    TE.Stats.max('maxAtt', Math.round(w.att));
    const lv = W.attLevel(w.att).idx;
    if (lv > w.attLvl) { w.attLvl = lv; TE.Bus.emit('world:att', { idx: lv, lvl: D.ATT_LEVELS[lv] }); if (lv >= 1) W.tip('attention'); }
    else if (lv < w.attLvl && w.att < D.ATT_LEVELS[w.attLvl].at - 6) w.attLvl = lv;
    // regulators
    w.reg = Math.max(0, w.reg - w.reg * 0.0022 - 0.01);
    if (dom > 0.2) W.addReg(0.22 * dom);
    if (inf > 0.05) W.addReg(0.05 * inf);
    if (w.att > 70) W.addReg(0.03);
    const rl = w.reg >= 70 ? 2 : w.reg >= 30 ? 1 : 0;
    if (rl > w.regLvl) { w.regLvl = rl; W.tip('regulator'); if (rl === 2 || Math.random() < 0.6) W.pnews('reg', null); TE.Bus.emit('world:regLevel', { lvl: rl }); }
    else if (rl < w.regLvl && w.reg < (w.regLvl === 2 ? 62 : 24)) w.regLvl = rl;
    w.regT -= 1;
    if (w.regT <= 0) {
      w.regT = 25;
      if (w.reg >= 30 && Math.random() < Math.pow((w.reg - 30) / 70, 1.4) * 0.4) regAct();
    }
    if (w.restrict && w.restrict.until <= r.time) { w.restrict = null; TE.Bus.emit('world:restrictEnd'); }
    if (r.legendsAway) Object.keys(r.legendsAway).forEach((id) => {
      if (r.legendsAway[id] <= r.time) {
        delete r.legendsAway[id];
        TE.Mods.dirty = true;
        const l = D.LEGEND_MAP[id];
        if (l) TE.Events.news({ cat: 'SOCIÉTÉ', text: l.name + ' est de retour dans votre équipe.', impact: 'LOW', dir: 1 });
      }
    });
    // headlines about the player's footprint
    if (domId && dom > 0.3) {
      const p = r.account.positions[domId];
      w.expo[domId] = (w.expo[domId] || 0) + 1;
      if (w.expo[domId] >= 30 && cool('expo:' + domId, 240)) W.pnews('exposure', domId, { dir: p.side });
    } else if (domId) w.expo[domId] = 0;
    if (++volT >= 5) {
      volT = 0;
      Object.keys(r.unlocked).forEach((id) => {
        const sh = TE.Market.playerShare(id);
        if (sh > 0.12 && cool('vol:' + id, 300)) W.pnews('volume', id, { pct: U.pct(sh, 0, false), who: W.who(true) });
      });
    }
    tickRumors();
    tickCal();
    rivalTick();
    // timeline milestones
    D.TIMELINE_EARN.forEach(([v, l]) => { if (r.earnings >= v) W.mark('earn_' + v.toExponential(0).replace('+', ''), l, { tag: 'argent' }); });
    [[0.01, '1 %'], [0.1, '10 %'], [0.5, '50 %']].forEach(([v, l]) => { if (inf >= v) W.mark('inf_' + v, 'Influence de marché : ' + l, { tag: 'monde' }); });
    if (TE.Prestige.canP1()) W.mark('p1', 'Liquidation possible : +' + U.int(TE.Prestige.pendingAlpha()) + ' α en jeu', { tag: 'prestige' });
    // world memory: the biggest crash ever witnessed (60 s move on an unlocked market)
    if (++crashT >= 5) {
      crashT = 0;
      const m = mem();
      Object.keys(r.unlocked).forEach((id) => {
        const ch = TE.Market.change(id, 60);
        if (ch < -0.08 && (!m.bigCrash || ch < m.bigCrash.pct)) m.bigCrash = { id, pct: ch, at: Date.now(), era: r.era };
      });
    }
  };

  /* =============================== reactions to the game's events =============================== */
  TE.Bus.on('trade:impact', (e) => {
    if (!TE.state || !e) return;
    const x = e.x || 0;
    if (x > 0.01) W.addAtt(Math.min(25, 30 * Math.pow(x, 0.7)));
    if (x > 0.2) W.addReg(6 * x);
    if (x >= 0.05 && e.kind === 'open') W.tip('impact');
    if (e.lev > 100 && e.kind === 'open') W.tip('highlev');
    if (e.kind === 'open' && x >= 0.12 && cool('acc:' + e.id, 150)) {
      const named = W.attention() >= 40 && (TE.Fund.active() || run().earnings >= 1e7);
      W.pnews((e.side > 0 ? 'accum' : 'short') + (named ? '_named' : '_anon'), e.id, { dir: e.side });
    }
    if (x >= 0.15) { const m = mem(); if (!m.bigOrder || x > m.bigOrder.x) m.bigOrder = { id: e.id, x, pct: e.pct, at: Date.now() }; }
    if (e.label === 'MASSIF') TE.Stats.add('massiveOrders');
  });
  TE.Bus.on('ability:use', (a) => {
    if (!TE.state) return;
    if (a.id === 'hype' || a.id === 'shortreport') { W.addAtt(12); W.addReg(10); }
    if (a.id === 'rate') { W.addAtt(8); W.addReg(6); }
  });
  TE.Bus.on('opp:claim', (res) => {
    if (!TE.state || !res || !res.def) return;
    if (res.def.id === 'insider' && /\+/.test(res.text || '') && !/intégrité/.test(res.text || '')) W.addReg(res.bad ? 20 : 12);
    if (res.def.special === 'legendary') W.addAtt(6);
  });
  TE.Bus.on('market:squeeze', (e) => {
    if (!TE.state) return;
    W.tip('squeeze');
    W.pnews(e.me ? 'squeeze_me' : 'squeeze', e.id, { dir: 1, who: W.who(true) });
    if (e.me) {
      W.addAtt(15); W.addReg(12); TE.Stats.add('squeezeMe');
      const m = mem(); m.squeezes = (m.squeezes || 0) + 1; m.lastSqueeze = { id: e.id, at: Date.now(), era: run().era };
      W.mark('squeeze', 'Short squeeze provoqué sur ' + e.id, { tag: 'monde' });
    }
  });
  TE.Bus.on('market:cascade', (e) => {
    if (!TE.state) return;
    W.tip('squeeze');
    W.pnews(e.me ? 'cascade_me' : 'cascade', e.id, { dir: -1, who: W.who(true) });
    if (e.me) { W.addAtt(12); W.addReg(10); TE.Stats.add('cascadeMe'); }
  });
  TE.Bus.on('trade:close', (t) => {
    if (!TE.state) return;
    if (t.legendary && t.net > 0) W.addAtt(8);
    if (t.reason === 'liq') W.mark('liq', 'Première liquidation (' + t.asset + ')', { tag: 'trading' });
  });
  TE.Bus.on('acq:buy', (a) => { if (TE.state) { W.addAtt(4); W.mark('acq', 'Première acquisition : ' + a.name, { tag: 'empire' }); } });
  TE.Bus.on('rival:bought', (r) => {
    if (!TE.state) return;
    W.addAtt(8);
    const m = mem(); m.rivals = m.rivals || []; if (m.rivals.indexOf(r.name) < 0) m.rivals.push(r.name);
    W.mark('rival_' + r.id, 'OPA hostile : ' + r.name, { tag: 'empire' });
  });
  TE.Bus.on('crisis:end', (x) => {
    if (!TE.state) return;
    crisisRivals();
    const m = mem(); m.crises = m.crises || {}; m.crises[x.def.id] = Math.max(m.crises[x.def.id] || 0, x.ok);
    W.mark('crisis_' + x.def.id, 'Crise surmontée : ' + x.def.name + (x.ok === 2 ? ' (terrassée)' : ''), { tag: 'crise' });
  });
  TE.Bus.on('era', (era) => { if (TE.state) W.mark('era_' + era.n, 'Ère ' + era.roman + ' — ' + era.name, { tag: 'ere', era: era.n }); });
  TE.Bus.on('bot:buy', () => { if (TE.state) W.mark('bot', 'Premier bot déployé', { tag: 'auto' }); });
  TE.Bus.on('staff:hire', () => { if (TE.state) W.mark('staff', 'Premier employé', { tag: 'societe' }); });
  TE.Bus.on('research:done', () => { if (TE.state) W.mark('research', 'Première recherche', { tag: 'societe' }); });
  TE.Bus.on('fund:founded', (name) => { if (TE.state) W.mark('fund', name + ' fondé', { tag: 'fonds' }); });
  TE.Bus.on('fund:inflow', (e) => {
    if (TE.state && (e.cls === 'inst' || e.cls === 'sovereign' || e.cls === 'planetary')) W.mark('inst', 'Premier investisseur institutionnel', { tag: 'fonds' });
  });
  TE.Bus.on('office:upgrade', (o) => { if (TE.state) W.mark('office_' + o.id, 'Nouveau siège : ' + o.name, { tag: 'siege', office: TE.state.run.office }); });
  TE.Bus.on('legend:hire', (l) => { if (TE.state) W.mark('legend_' + l.id, 'Recrue légendaire : ' + l.name, { tag: 'societe' }); });
  TE.Bus.on('feature:unlock', (f) => { if (TE.state && f.id === 'empire') W.mark('empire', 'L’empire s’ouvre', { tag: 'empire' }); });
  TE.Bus.on('news', (n) => {
    // headlines move the crowd's opinion on that market (retail, hedge funds)
    if (!TE.state || !n || !n.asset || !n.dir) return;
    const a = TE.Market.asset(n.asset);
    if (a) a.ns = U.clamp((a.ns || 0) + n.dir * (n.impact === 'HIGH' ? 0.55 : n.impact === 'MED' ? 0.35 : 0.2), -1.5, 1.5);
  });
})(window.TE);
