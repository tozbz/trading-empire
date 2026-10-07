/* V2 — aggregated market actors (retail, whales, momentum, value, hedge funds, market makers, HFT, institutions,
 * short sellers). Each group keeps one exposure per market (−1 short … +1 long). Groups move their exposure toward a
 * target built from signals the market already has (regime momentum, valuation, sentiment, news, macro, the player's
 * own flow). The change of exposure is order flow: it nudges prices, prints volume and drives market-maker liquidity.
 * Crowded positioning makes emergent short squeezes and liquidation cascades possible (rare, spectacular).
 * Runs at 2 Hz on a few hundred numbers: negligible CPU, tiny save footprint. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const A = (TE.Agents = {});
  const G = D.AGENT_GROUPS;
  const NG = G.length;
  const I = {}; G.forEach((g, i) => { I[g.id] = i; });
  const STEP = 0.5;
  const AG_K = 0.0028;      // price drift per unit of weighted exposure change, × √trend
  const FLOW_CAP = 0.002;   // max agent drift (log-return / s) — below a strong regime, so regimes stay in charge
  let acc = 0;

  function meta() {
    const w = TE.state.market;
    return w.agm || (w.agm = { whaleNext: 140, sqT: 0, squeezes: 0, cascades: 0 });
  }
  A.state = function (id) {
    const ag = TE.state.market.ag || (TE.state.market.ag = {});
    let st = ag[id];
    if (!st || !Array.isArray(st.x) || st.x.length !== NG) st = ag[id] = { x: new Array(NG).fill(0), wh: null, cd: 0 };
    return st;
  };

  /** Start a directed campaign (whale or rival) on a market. */
  A.campaign = function (id, dir, str, dur, who) {
    const st = A.state(id);
    const now = TE.state.market.t;
    st.wh = { dir: dir > 0 ? 1 : -1, str: U.clamp(str, 0.2, 1), until: now + dur, who: who || null, p0: TE.Market.mid(id) };
    return st.wh;
  };

  A.tick = function (dt) {
    acc += dt;
    while (acc >= STEP) { acc -= STEP; update(STEP); }
  };

  function update(h) {
    const s = TE.state;
    const w = s.market;
    const now = w.t;
    const m = meta();
    const sent = (w.sent - 50) / 50;
    const macro = TE.Market.macro();
    const mdir = (macro.up - macro.down) / 2;
    const crisis = !!(s.run.events.crisis && s.run.events.crisis.active);
    const att = TE.World ? TE.World.attention() / 100 : 0;
    const ids = Object.keys(s.run.unlocked);
    // whale scheduler
    m.whaleNext -= h;
    if (m.whaleNext <= 0) {
      m.whaleNext = U.range(110, 240);
      const id = U.weighted(ids.map((x) => [x, D.ASSET_MAP[x].sens]));
      if (id) {
        const a = TE.Market.asset(id);
        const val = a ? -Math.log(a.p / a.fair) : 0;
        const dir = Math.random() < 0.5 + U.clamp(val * 3, -0.3, 0.3) ? 1 : -1;
        A.campaign(id, dir, U.range(0.55, 1), U.range(40, 110));
        if (Math.random() < 0.45 && TE.World) TE.World.whaleNews(id, dir);
      }
    }
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k];
      const a = w.assets[id];
      const def = D.ASSET_MAP[id];
      if (!a || !def) continue;
      const st = A.state(id);
      const x = st.x;
      const cls = def.cls;
      const R = D.REGIMES[a.reg.id];
      const sig = D.BASE_SIGMA * def.vol;
      if (!(a.p20 > 0)) a.p20 = a.p;
      const r20 = Math.log(a.p / a.p20);
      a.p20 += (a.p - a.p20) * Math.min(1, h / 20);
      const lp = st.lp || a.p;
      st.lp = a.p;
      const trend = Math.tanh(a.mom / (sig * 1.2));
      const val = U.clamp(-Math.log(a.p / a.fair) * 6, -1, 1);
      const excess = Math.log(a.p / a.fair);
      const news = U.clamp(a.ns || 0, -1, 1);
      const pf = Math.tanh((a.pf || 0) * 3) * (0.7 + 0.6 * att);
      const panic = R.cls === 'panic', euph = R.cls === 'euphoria';
      const wh = st.wh && st.wh.until > now ? st.wh : null;
      if (st.wh && !wh) { if (st.wh.who && TE.World) TE.World.rivalCampaignEnd(id, st.wh); st.wh = null; }
      const hftSig = Math.tanh((a.p / lp - 1) / (sig * 0.35 + 1e-12));
      // targets
      const tg = new Array(NG);
      tg[I.retail] = 0.55 * sent + 0.7 * news + 0.35 * trend + 0.45 * pf + (def.meme ? 0.25 * sent : 0) + (euph ? 0.2 : 0) - (panic ? 0.3 : 0);
      tg[I.whale] = wh ? wh.dir * wh.str : 0.2 * val;
      tg[I.mom] = 0.95 * trend + 0.55 * pf;
      tg[I.value] = 0.9 * val + (panic ? 0.25 : 0) - (euph ? 0.2 : 0);
      tg[I.hedge] = 0.55 * news + 0.3 * trend + 0.3 * val - (Math.abs(sent) > 0.6 ? 0.5 * sent : 0);
      tg[I.hft] = 0.45 * hftSig;
      tg[I.inst] = 1.1 * mdir + 0.25 * val - (crisis ? 0.5 : 0);
      // short sellers pile in on excess valuations… and cover when the price runs against them
      const squeezed = r20 > 3 * sig * Math.sqrt(20);
      tg[I.short] = squeezed ? x[I.short] * 0.5 : -U.clamp(Math.max(0, excess) * 6 + (euph ? 0.35 : 0) + (sent > 0.5 ? sent - 0.5 : 0), 0, 1);
      // a market seen for the first time starts already positioned (no artificial burst of orders)
      if (!st.init) {
        for (let g = 0; g < NG; g++) if (g !== I.mm) x[g] = U.clamp(tg[g], -1, 1);
        st.init = 1;
        a.flow = 0;
        continue;
      }
      // flows of everybody but the market makers
      let flow = 0, vol = 0, others = 0;
      for (let g = 0; g < NG; g++) {
        if (g === I.mm) continue;
        const grp = G[g];
        const target = U.clamp(tg[g], -1, 1);
        const dx = (target - x[g]) * Math.min(1, grp.speed * h * (0.6 + 0.8 * Math.random()));
        x[g] += dx;
        const p = grp.pres[cls] || 1;
        flow += dx * grp.w * p;
        others += dx * p;
        vol += Math.abs(dx) * p;
      }
      // market makers absorb part of the net flow (inventory) and retreat when markets get scary
      const mmT = U.clamp(-others * 3 + x[I.mm] * 0.6, -1, 1);
      const dmm = (mmT - x[I.mm]) * Math.min(1, G[I.mm].speed * h);
      x[I.mm] += dmm;
      flow += dmm * G[I.mm].w * (G[I.mm].pres[cls] || 1);
      a.mmP = U.clamp(1.1 - (sent < -0.3 ? (-sent - 0.3) * 0.7 : 0) - (panic ? 0.35 : 0) - (crisis ? 0.25 : 0) - Math.max(0, (a.volRatio || 1) - 1.5) * 0.12, 0.4, 1.2);
      a.flow = U.clamp(AG_K * Math.sqrt(def.trend) * flow / h, -FLOW_CAP, FLOW_CAP);
      if (vol > 0.002) a.v += Math.min(8, vol * 6);
      // emergent squeezes and cascades
      if (now > (st.cd || 0) && now > m.sqT) {
        const shortCrowd = Math.max(0, -x[I.short]) * 0.6 + (Math.max(0, -x[I.retail]) + Math.max(0, -x[I.hedge]) + Math.max(0, -x[I.mom])) * 0.15;
        const longCrowd = (Math.max(0, x[I.retail]) + Math.max(0, x[I.mom]) + Math.max(0, x[I.hedge])) * 0.3 + Math.max(0, x[I.whale]) * 0.1;
        const thr = 2.4 * sig * Math.sqrt(20);
        if (shortCrowd > 0.5 && r20 > thr && (a.lq || 1) < 0.97 && Math.random() < 0.35) trigger(id, a, st, 'squeeze');
        else if (longCrowd > 0.62 && r20 < -thr && Math.random() < 0.3) trigger(id, a, st, 'cascade');
      }
    }
  }

  function trigger(id, a, st, kind) {
    const s = TE.state;
    const m = meta();
    const now = s.market.t;
    st.cd = now + 900;
    m.sqT = now + 240;
    const x = st.x;
    const pos = s.run.account.positions[id];
    const L = TE.Market.liquidity(id);
    let me = false;
    if (kind === 'squeeze') {
      TE.Market.forceRegime(id, 'squeeze', 12, 1.2);
      x[I.short] *= 0.15;
      x[I.retail] = U.clamp(x[I.retail] + 0.3, -1, 1);
      x[I.mom] = U.clamp(x[I.mom] + 0.3, -1, 1);
      me = (pos && pos.side > 0 && pos.notional / L > 0.08) || (a.pf || 0) > 0.12;
      m.squeezes++;
    } else {
      TE.Market.forceRegime(id, 'crash', 10, 1.1);
      [I.retail, I.mom, I.hedge].forEach((g) => { if (x[g] > 0) x[g] *= 0.3; });
      me = (pos && pos.side < 0 && pos.notional / L > 0.08) || (a.pf || 0) < -0.12;
      m.cascades++;
    }
    a.lq = Math.max(0.2, (a.lq || 1) * 0.6);
    TE.Bus.emit('market:' + kind, { id, me });
  }

  /** Positioning snapshot for the UI. */
  A.positioning = function (id) {
    const a = TE.Market.asset(id);
    const def = D.ASSET_MAP[id];
    if (!a || !def) return null;
    const st = A.state(id);
    const x = st.x;
    let longs = 0, shorts = 0;
    const groups = G.map((g, i) => {
      const v = x[i] * (g.pres[def.cls] || 1) * g.w;
      if (v > 0) longs += v; else shorts -= v;
      return { id: g.id, name: g.name, short: g.short, color: g.color, x: x[i], desc: g.desc };
    });
    const shortCrowd = Math.max(0, -x[I.short]) * 0.6 + (Math.max(0, -x[I.retail]) + Math.max(0, -x[I.hedge]) + Math.max(0, -x[I.mom])) * 0.15;
    const longCrowd = (Math.max(0, x[I.retail]) + Math.max(0, x[I.mom]) + Math.max(0, x[I.hedge])) * 0.3 + Math.max(0, x[I.whale]) * 0.1;
    const wh = st.wh && st.wh.until > TE.state.market.t ? st.wh : null;
    return { longs, shorts, net: longs - shorts, groups, squeeze: U.clamp(shortCrowd / 0.5, 0, 1.5), cascade: U.clamp(longCrowd / 0.62, 0, 1.5), mm: a.mmP || 1, lq: TE.Market.liqFactor(id), campaign: wh };
  };
  A.counts = () => meta();
})(window.TE);
