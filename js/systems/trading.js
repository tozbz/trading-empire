/* Manual trading: positions with leverage, margin & liquidation, SL / TP / trailing stops,
 * pending limit / stop / OCO orders, win streaks and critical profits. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const T = (TE.Trading = {});
  const BASE_FEE = 0.001;
  const BASE_MMR = 0.005;
  const CRIT_TABLE = [[5, 0.8], [10, 0.17], [50, 0.03]];
  let manualWindow = []; // [time, profit]

  const acct = () => TE.state.run.account;
  const run = () => TE.state.run;

  T.levTiers = function () {
    if (run().challenge === 'noleverage') return [1];
    const cap = TE.World && TE.World.levCap ? TE.World.levCap() : Infinity;
    return D.LEV_TIERS.filter((l) => (l === 1 || TE.Mods.has('lev.' + l)) && l <= cap);
  };
  T.maxLev = () => { const t = T.levTiers(); return t[t.length - 1]; };
  T.feeRate = () => BASE_FEE * TE.Mods.get('manual.fee') * (run().challenge === 'highfees' ? 5 : 1);
  T.slots = () => Math.max(1, Math.floor(TE.Mods.get('manual.slots')));
  /** Maintenance margin (fraction of notional). Up to x100 it is the classic 0.5 %; beyond, it never exceeds half of
   *  the initial margin, so extreme leverage stays technically viable — with a liquidation a hair's breadth away. */
  T.mmr = (lev) => Math.min(BASE_MMR, 0.5 / Math.max(1, lev || 1)) * TE.Mods.get('manual.mmr');
  /** Price move (fraction) that liquidates a fresh position at this leverage. */
  T.liqDistance = (lev) => Math.max(0, 1 / Math.max(1, lev) - T.mmr(lev));
  T.EXTREME_LEV = 100;
  /** Liquidity limit: the largest notional a single position may reach on this market. */
  T.maxNotional = function (id) {
    const def = D.ASSET_MAP[id];
    const depth = def.depth * TE.Mods.get('manual.access');
    const desk = TE.Mods.get('manual.desk') * TE.Economy.capBase();
    return Math.max(depth, desk);
  };
  T.availableMargin = function (id, lev) {
    const pos = acct().positions[id];
    const L = lev || acct().lev || 1;
    const room = Math.max(0, T.maxNotional(id) - (pos ? pos.notional : 0)) / L;
    return Math.max(0, Math.min(run().cash, room));
  };
  /** Largest payout (base + bonus) a single winning trade may earn, before crits. */
  T.payoutCap = () => TE.Mods.get('manual.payout') * TE.Economy.capBase();
  T.profitMult = () => TE.Mods.get('manual.profit') * TE.Economy.globalMult();
  T.exitPrice = (id, side) => (side > 0 ? TE.Market.bid(id) : TE.Market.ask(id));
  T.entryPrice = (id, side) => (side > 0 ? TE.Market.ask(id) : TE.Market.bid(id));
  T.upnl = function (id, pos) {
    pos = pos || acct().positions[id];
    if (!pos) return 0;
    return pos.side * (T.exitPrice(id, pos.side) - pos.entry) * pos.units;
  };
  T.liqPrice = function (pos) {
    const buf = (pos.margin - T.mmr(pos.lev) * pos.notional) / pos.units;
    return pos.side > 0 ? pos.entry - buf : pos.entry + buf;
  };
  T.equity = function () {
    const ps = acct().positions;
    let e = 0;
    for (const id in ps) e += Math.max(0, ps[id].margin + T.upnl(id, ps[id]));
    return e;
  };
  T.openCount = () => Object.keys(acct().positions).length;
  T.comboTier = function (n) {
    let t = null;
    D.COMBO_TIERS.forEach((x) => { if (n >= x.n) t = x; });
    return t;
  };
  T.comboMult = function () {
    const t = T.comboTier(acct().combo);
    if (!t) return 1;
    return 1 + (t.mult - 1) * TE.Mods.get('combo.power');
  };
  let windowRun = null;
  T.manualRate = function () {
    const now = run().time;
    if (windowRun !== run().id) { windowRun = run().id; manualWindow = []; }
    manualWindow = manualWindow.filter((x) => now - x[0] < 300 && x[0] <= now);
    let s = 0; manualWindow.forEach((x) => { s += x[1]; });
    return s / 300;
  };

  function fail(msg) { TE.Bus.emit('trade:fail', msg); return false; }

  /** Open / add / reverse. opts: { sizePct, lev, margin, src } */
  T.open = function (id, side, opts) {
    opts = opts || {};
    const s = TE.state;
    const a = acct();
    if (!s.run.unlocked[id]) return fail('Marché verrouillé');
    let pos = a.positions[id];
    if (pos && pos.side !== side) {
      T.close(id, 'reverse');
      pos = null;
    }
    if (!pos && T.openCount() >= T.slots()) return fail('Aucun emplacement libre (' + T.slots() + ' max) : fermez d’abord une position');
    const tiers = T.levTiers();
    let lev = opts.lev || a.lev || 1;
    if (tiers.indexOf(lev) < 0) lev = tiers.filter((l) => l <= lev).pop() || 1;
    const avail = T.availableMargin(id, lev);
    if (avail <= 0.01 && pos) return fail('La position a atteint la limite de liquidité du marché (' + U.money(T.maxNotional(id)) + ' de notionnel)');
    let margin = opts.margin !== undefined ? Math.min(opts.margin, avail) : avail * (opts.sizePct || a.sizePct || 1);
    const fr = T.feeRate();
    // biggest margin this trade could have used (market size cap and cash): the win streak counts trades of a
    // meaningful size relative to THIS, so it keeps working once the position cap is far below the cash pile
    const maxMargin = Math.max(1e-9, Math.min(avail, s.run.cash / (1 + lev * fr)));
    if (margin * (1 + lev * fr) > s.run.cash) margin = s.run.cash / (1 + lev * fr);
    if (!(margin > 0.01)) return fail(s.run.cash < 1 ? 'Liquidités insuffisantes' : 'Taille de position trop faible');
    const notional = margin * lev;
    // V2: large orders walk the book — you fill about half of your own market impact (slippage)
    const est = TE.Market.impactEst(id, notional);
    const price = T.entryPrice(id, side) * (1 + side * est.slip);
    const fee = notional * fr;
    s.run.cash = Math.max(0, s.run.cash - margin - fee);
    TE.Stats.add('feesPaid', fee);
    const units = notional / price;
    const impact = TE.Market.applyImpact(id, side, notional, 'player');
    const regCls = TE.Market.regimeClass(id);
    if (pos) {
      const nu = pos.units + units;
      pos.entry = (pos.entry * pos.units + price * units) / nu;
      pos.units = nu;
      pos.margin += margin;
      pos.notional += notional;
      pos.fees += fee;
      pos.lev = pos.notional / pos.margin;
    } else {
      pos = a.positions[id] = {
        id: a.nextId++, side, units, entry: price, margin, notional, lev, fees: fee, opened: s.run.time, regAtOpen: regCls,
        sl: null, tp: null, trail: null, best: price, greenSince: null, sawCrash: false, legendary: false,
        marginShare: margin / maxMargin,
      };
      const lg = s.run.legendary;
      if (lg && lg.asset === id && side > 0 && s.run.time < lg.until) { pos.legendary = true; s.run.legendary = null; }
    }
    TE.Stats.add('opens');
    if (side < 0) TE.Stats.add('shorts');
    TE.Stats.max('maxLevUsed', lev);
    const h = new Date().getHours();
    if (h >= 2 && h < 5) TE.Stats.add('nightTrades');
    TE.Market.addMarker(id, side > 0 ? 'L' : 'S', price);
    TE.Bus.emit('trade:open', { id, side, margin, lev, price, notional, slip: est.slip, impact });
    TE.Bus.emit('trade:impact', { id, side, notional, x: est.x, pct: impact, slip: est.slip, kind: 'open', lev, label: est.label });
    return true;
  };

  function rollCrit() {
    const chance = TE.Mods.get('manual.crit');
    if (Math.random() >= chance) return 0;
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < CRIT_TABLE.length; i++) { acc += CRIT_TABLE[i][1]; if (r < acc) return CRIT_TABLE[i][0] * TE.Mods.get('crit.mult'); }
    return 5;
  }

  /** Close a position. reason: manual | sl | tp | trail | liq | reverse */
  T.close = function (id, reason) {
    const s = TE.state;
    const a = acct();
    const pos = a.positions[id];
    if (!pos) return false;
    reason = reason || 'manual';
    // V2: the closing order also walks the book (slippage) and moves the price the other way
    const rawExit = T.exitPrice(id, pos.side);
    const closeNotional = Math.abs(rawExit * pos.units);
    const est = TE.Market.impactEst(id, closeNotional);
    const price = rawExit * (1 - pos.side * est.slip);
    const def = D.ASSET_MAP[id];
    const dur = s.run.time - pos.opened;
    const gross = pos.side * (price - pos.entry) * pos.units;
    let closeFee = 0, net, total = 0, bonus = 0, crit = 0, capped = false, gap = 0;

    if (reason === 'liq') {
      if (pos.lev > T.EXTREME_LEV) {
        // beyond x100 the liquidation fills at the real market price: losses can exceed the margin (gap)
        closeFee = Math.abs(price * pos.units) * T.feeRate();
        TE.Stats.add('feesPaid', closeFee);
        const settle = pos.margin + gross - closeFee;
        if (settle >= 0) s.run.cash = U.cap(s.run.cash + settle);
        else { gap = Math.min(s.run.cash, -settle); s.run.cash -= gap; }
        net = settle >= 0 ? gross - closeFee : -pos.margin - gap;
      } else {
        net = -pos.margin;
        let refund = 0;
        if (TE.Mods.has('liq.refund')) { refund = pos.margin * 0.15; s.run.cash += refund; }
        net += refund;
      }
      total = net;
      TE.Economy.debit(-net, 'manual');
      TE.Stats.add('liquidations');
      a.combo = 0;
      const rep = s.run.rep;
      const loss = Math.max(1, rep * 0.05) * TE.Mods.get('rep.loss');
      s.run.rep = Math.max(0, rep - loss);
      if (pos.side < 0 && TE.Market.asset(id).reg.id === 'squeeze') TE.Stats.add('squeezed');
      TE.Mods.dirty = true;
    } else {
      closeFee = Math.abs(price * pos.units) * T.feeRate();
      TE.Stats.add('feesPaid', closeFee);
      const settle = Math.max(0, pos.margin + gross - closeFee);
      s.run.cash = U.cap(s.run.cash + settle);
      net = gross - pos.fees - closeFee;
      total = net;
      if (net < 0) TE.Economy.debit(-net, 'manual');
      if (net > 0) {
        // base profit counts as earnings, then apply multipliers as an "alpha bonus"
        TE.Economy.credit(net);
        crit = rollCrit();
        let mult = T.profitMult();
        if (pos.legendary) mult *= 5;
        const totalMult = mult * (crit || 1);
        // a critical hit can break through the bonus cap, but by at most ×3
        const cap = T.payoutCap() * Math.min(crit || 1, 3) * (pos.legendary ? 5 : 1);
        const want = net * (totalMult - 1);
        bonus = Math.min(want, cap);
        capped = want > bonus + 1e-9;
        if (bonus > 0) TE.Economy.earn(bonus, 'manual');
        total = net + Math.max(0, bonus);
        if (crit) { TE.Stats.add('crits'); TE.Stats.max('biggestCrit', crit); }
      }
    }
    // streak (only meaningful positions count)
    const meaningful = pos.marginShare >= 0.04 && dur >= 3;
    if (reason !== 'liq') {
      if (net > 0 && meaningful) { a.combo++; TE.Stats.max('bestStreak', a.combo); TE.Mods.dirty = true; }
      else if (net < 0) { if (a.combo) TE.Mods.dirty = true; a.combo = 0; }
    }
    // stats & records
    TE.Stats.add('trades');
    const pct = total / Math.max(1e-9, pos.margin);
    if (net > 0) {
      TE.Stats.add('wins');
      TE.Stats.add('manualProfit', total);
      if (pos.side < 0) TE.Stats.add('shortWins');
      TE.Stats.max('bestTrade', total);
      TE.Stats.max('bestPct', pct);
      TE.Stats.max('maxLevWin', Math.round(pos.lev));
      if (dur >= 300) TE.Stats.max('longestWinHold', dur);
      const cw = s.profile.records.classesWon || (s.profile.records.classesWon = {});
      cw[def.cls] = true;
      const clsNow = TE.Market.regimeClass(id);
      if (pos.side < 0 && (clsNow === 'panic' || pos.regAtOpen === 'panic')) TE.Stats.add('bigShort');
      if (pos.side > 0 && pos.regAtOpen === 'panic') TE.Stats.add('buyDip');
      if (pos.side > 0 && def.cls === 'crypto' && pos.sawCrash) TE.Stats.add('hodl');
      if (pos.side > 0 && def.meme && price / pos.entry - 1 >= 0.4) TE.Stats.add('tulip');
      if (pos.legendary) TE.Stats.add('legendaryWins');
      if (windowRun !== s.run.id) { windowRun = s.run.id; manualWindow = []; }
      manualWindow.push([s.run.time, total]);
      // reputation for good trades (scaled by era)
      TE.Fund.gainRep(0.4 * Math.min(3, 1 + pct) * TE.Fund.eraScale());
    } else if (net < 0) {
      TE.Stats.add('losses');
      TE.Stats.add('manualLoss', -total);
      const r = s.profile.records;
      if (r.worstPct === undefined || pct < r.worstPct) r.worstPct = pct;
      if (r.worstTrade === undefined || total < r.worstTrade) r.worstTrade = total;
    }
    if (dur < 2 && reason === 'manual') TE.Stats.add('paperHands');
    if (reason === 'sl') TE.Stats.add('slHits');
    if (reason === 'tp') TE.Stats.add('tpHits');
    const rec = { id: pos.id, asset: id, side: pos.side, entry: pos.entry, exit: price, lev: pos.lev, margin: pos.margin, net, total, bonus, crit, capped, pct, reason, t: s.run.time, dur };
    if (gap > 0) rec.gap = gap;
    if (est.slip > 0.0001) rec.slip = est.slip;
    a.history.unshift(rec);
    if (a.history.length > 100) a.history.length = 100;
    const cImp = TE.Market.applyImpact(id, -pos.side, closeNotional, 'player');
    TE.Bus.emit('trade:impact', { id, side: -pos.side, notional: closeNotional, x: est.x, pct: cImp, slip: est.slip, kind: reason === 'liq' ? 'liq' : 'close', lev: pos.lev, label: est.label });
    delete a.positions[id];
    TE.Market.addMarker(id, 'X', price, { win: net > 0 });
    TE.Bus.emit('trade:close', Object.assign({ cls: def.cls, legendary: pos.legendary }, rec));
    return rec;
  };

  T.closeAll = function () { Object.keys(acct().positions).forEach((id) => T.close(id, 'manual')); };

  T.setSL = function (id, price) { const p = acct().positions[id]; if (p && TE.Mods.has('ord.sltp')) p.sl = price > 0 ? price : null; };
  T.setTP = function (id, price) { const p = acct().positions[id]; if (p && TE.Mods.has('ord.sltp')) p.tp = price > 0 ? price : null; };
  T.setTrail = function (id, pct) {
    const p = acct().positions[id];
    if (!p || !TE.Mods.has('ord.trail')) return;
    p.trail = pct > 0 ? pct : null;
    p.best = T.exitPrice(id, p.side);
  };

  /* ---------------- pending orders ---------------- */
  T.placeOrder = function (o) {
    const a = acct();
    if (a.orders.length >= 8) return fail('Trop d’ordres en attente (8 max)');
    const need = o.type === 'limit' ? 'ord.limit' : 'ord.stop';
    if (!TE.Mods.has(need)) return fail('Type d’ordre verrouillé');
    a.orders.push(Object.assign({ oid: a.nextId++, created: run().time, sizePct: a.sizePct, lev: a.lev }, o));
    TE.Bus.emit('order:placed', o);
    return true;
  };
  T.placeOCO = function (id, upPrice, downPrice) {
    if (!TE.Mods.has('ord.oco')) return fail('Ordres OCO verrouillés');
    const g = 'oco' + acct().nextId;
    T.placeOrder({ asset: id, type: 'stop', side: 1, price: upPrice, oco: g });
    T.placeOrder({ asset: id, type: 'stop', side: -1, price: downPrice, oco: g });
  };
  T.cancelOrder = function (oid) {
    const a = acct();
    a.orders = a.orders.filter((o) => o.oid !== oid);
    TE.Bus.emit('order:cancel', oid);
  };

  function checkOrders() {
    const a = acct();
    if (!a.orders.length) return;
    const filled = [];
    for (let i = 0; i < a.orders.length; i++) {
      const o = a.orders[i];
      if (!run().unlocked[o.asset]) continue;
      const ask = TE.Market.ask(o.asset), bid = TE.Market.bid(o.asset);
      let hit = false;
      if (o.type === 'limit') hit = o.side > 0 ? ask <= o.price : bid >= o.price;
      else hit = o.side > 0 ? ask >= o.price : bid <= o.price;
      if (hit) filled.push(o);
    }
    filled.forEach((o) => {
      if (!a.orders.some((x) => x.oid === o.oid)) return;
      a.orders = a.orders.filter((x) => x.oid !== o.oid && (!o.oco || x.oco !== o.oco));
      const ok = T.open(o.asset, o.side, { sizePct: o.sizePct, lev: o.lev });
      if (ok) { TE.Stats.add('ordersFilled'); TE.Bus.emit('order:filled', o); }
    });
  }

  /* ---------------- tick ---------------- */
  T.tick = function (dt) {
    const s = TE.state;
    const a = acct();
    // influence: your own positions push prices your way
    const inf = TE.Empire ? TE.Empire.influence() : 0;
    const ids = Object.keys(a.positions);
    Object.keys(s.run.unlocked).forEach((id) => { const as = TE.Market.asset(id); if (as) as.inf = 0; });
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const pos = a.positions[id];
      if (!pos) continue;
      const as = TE.Market.asset(id);
      if (inf > 0.0005 && as) as.inf += pos.side * 0.0012 * Math.sqrt(inf) * D.ASSET_MAP[id].trend;
      const bid = TE.Market.bid(id), ask = TE.Market.ask(id);
      const exit = pos.side > 0 ? bid : ask;
      // liquidation is checked on the mark (mid) price, like a real exchange: the spread alone never liquidates you
      const liq = T.liqPrice(pos);
      const mark = TE.Market.mid(id);
      if ((pos.side > 0 && mark <= liq) || (pos.side < 0 && mark >= liq)) { T.close(id, 'liq'); continue; }
      if (pos.sl && ((pos.side > 0 && exit <= pos.sl) || (pos.side < 0 && exit >= pos.sl))) { T.close(id, 'sl'); continue; }
      if (pos.tp && ((pos.side > 0 && exit >= pos.tp) || (pos.side < 0 && exit <= pos.tp))) { T.close(id, 'tp'); continue; }
      if (pos.trail) {
        if (pos.side > 0) { if (exit > pos.best) pos.best = exit; if (exit <= pos.best * (1 - pos.trail)) { T.close(id, 'trail'); continue; } }
        else { if (exit < pos.best) pos.best = exit; if (exit >= pos.best * (1 + pos.trail)) { T.close(id, 'trail'); continue; } }
      }
      const u = pos.side * (exit - pos.entry) * pos.units - pos.fees;
      if (u > 0) { if (pos.greenSince === null) pos.greenSince = s.run.time; } else pos.greenSince = null;
      if (as && (as.reg.id === 'crash' || as.reg.id === 'panic' || as.reg.id === 'flash')) pos.sawCrash = true;
    }
    checkOrders();
  };

  /** Emergency cash when broke (the Bank of Mom). */
  T.canFamilyLoan = function () {
    const s = TE.state;
    return TE.Economy.netWorth() < 15 && T.openCount() === 0 && s.run.time - s.run.loanAt > 120 && TE.Economy.passive() < 0.5;
  };
  T.familyLoan = function () {
    if (!T.canFamilyLoan()) return false;
    const s = TE.state;
    s.run.loanAt = s.run.time;
    s.run.cash += 100;
    TE.Stats.add('familyLoans');
    TE.Bus.emit('family:loan');
    return true;
  };
})(window.TE);
