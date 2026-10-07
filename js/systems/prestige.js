/* Prestige: three layers.
 *   1. LIQUIDATE EMPIRE  -> Alpha (α)          reset run
 *   2. MARKET LEGACY      -> Legacy shares (Λ)  reset run + α + α perks
 *   3. FINANCIAL SINGULARITY -> Cores (✦)       reset run + α + Λ (+ perks)
 */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data;
  const P = (TE.Prestige = {});
  const pr = () => TE.state.profile.prestige;

  P.perk = (id) => (TE.state ? pr().perks[id] || 0 : 0);
  P.lperk = (id) => (TE.state ? pr().lperks[id] || 0 : 0);
  P.sperk = (id) => (TE.state ? pr().sperks[id] || 0 : 0);

  /* ---------------- Alpha ---------------- */
  P.alphaFor = (L) => Math.floor(8 * Math.pow(Math.max(0, L) / 1e9, 0.3));
  P.alphaMult = function () {
    const ch = TE.state.run.challenge;
    const c = ch && D.CHALLENGE_MAP[ch];
    return c ? c.alphaMult : 1;
  };
  P.pendingAlphaBase = () => Math.max(0, P.alphaFor(pr().earnBank + TE.state.run.earnings) - (pr().alphaBase || 0));
  P.pendingAlpha = () => Math.floor(P.pendingAlphaBase() * P.alphaMult());
  P.alphaPower = () => (0.1 + 0.01 * P.perk('compounding')) * (1 + 0.25 * P.lperk('alphaamp'));
  P.alphaBonus = (total) => 1 + (total === undefined ? pr().alphaTotal : total) * P.alphaPower();
  P.canP1 = () => TE.state.run.earnings >= D.P1_MIN_EARN && P.pendingAlpha() >= 1;
  P.nextAlphaAt = function () {
    // earnings needed (this run) for one more alpha
    const have = P.alphaFor(pr().earnBank + TE.state.run.earnings);
    const target = Math.pow((have + 1) / 8, 1 / 0.3) * 1e9;
    return Math.max(0, target - pr().earnBank);
  };

  /* ---------------- Legacy ---------------- */
  P.legacyFor = (A) => Math.floor(2 * Math.sqrt(Math.max(0, A) / D.P2_MIN_ALPHA));
  P.pendingLegacy = function () {
    const base = Math.max(0, P.legacyFor(pr().alphaBank + pr().alphaTotal) - (pr().legacyBase || 0));
    return base * Math.pow(2, P.sperk('resonance'));
  };
  P.canP2 = () => pr().alphaTotal >= D.P2_MIN_ALPHA && P.pendingLegacy() >= 1;
  P.p2Visible = () => pr().p2 > 0 || pr().alphaTotal >= D.P2_MIN_ALPHA * 0.25 || pr().legacyTotal > 0;

  /* ---------------- Singularity ---------------- */
  P.pendingCores = function () {
    const e = TE.state.run.earnings;
    if (e < D.P3_MIN_EARN) return 0;
    return Math.floor(U.log10(e / D.P3_MIN_EARN) * 2 + 1);
  };
  P.canP3 = () => P.pendingCores() >= 1;
  P.p3Visible = () => pr().p3 > 0 || TE.state.run.era >= 7 || pr().coresTotal > 0;

  /* ---------------- turbo ---------------- */
  P.maxTurbo = function () {
    let t = 1;
    if (TE.state.run.era >= 6) t = 2;
    const a = D.ALPHA_PERKS.find((x) => x.id === 'turbo');
    t = Math.max(t, a.vals[P.perk('turbo')] || 1);
    const l = D.LEGACY_PERKS.find((x) => x.id === 'hypertime');
    t = Math.max(t, l.vals[P.lperk('hypertime')] || 1);
    if (P.sperk('chronoshift')) t = Math.max(t, 100);
    return t;
  };
  P.turboSteps = () => [1, 2, 5, 10, 25, 50, 100].filter((x) => x <= P.maxTurbo());

  /* ---------------- perks shop ---------------- */
  const LAYERS = {
    alpha: { list: () => D.ALPHA_PERKS, levels: () => pr().perks, cur: 'alpha' },
    legacy: { list: () => D.LEGACY_PERKS, levels: () => pr().lperks, cur: 'legacy' },
    sing: { list: () => D.SING_PERKS, levels: () => pr().sperks, cur: 'cores' },
  };
  P.perkCost = (def, lvl) => Math.ceil(def.base * Math.pow(def.growth, lvl));
  P.buyPerk = function (layer, id) {
    const L = LAYERS[layer];
    const def = L.list().find((x) => x.id === id);
    if (!def) return false;
    const lv = L.levels();
    const cur = lv[id] || 0;
    if (cur >= def.max) return false;
    const cost = P.perkCost(def, cur);
    if (pr()[L.cur] < cost) return false;
    pr()[L.cur] -= cost;
    lv[id] = cur + 1;
    TE.Mods.dirty = true;
    TE.Bus.emit('perk:buy', { layer, def, lvl: cur + 1 });
    return true;
  };

  /* ---------------- run reset ---------------- */
  function newRun(opts) {
    const s = TE.state;
    const old = s.run;
    const keepUp = {};
    if (P.perk('markets')) Object.keys(old.upgrades).forEach((k) => { if (k.indexOf('mk_') === 0) keepUp[k] = 1; });
    const keepRes = P.lperk('keepres') ? Object.assign({}, old.research.done) : null;
    const keepRefine = P.lperk('keepres') ? old.research.refine : 0;
    // close all positions at market (refund margin, ignore pnl)
    s.run = TE.State.createRun(s.profile);
    const r = s.run;
    r.challenge = opts && opts.challenge !== undefined ? opts.challenge : null;
    pr().nextChallenge = null;
    Object.assign(r.upgrades, keepUp);
    if (keepRes) { r.research.done = keepRes; r.research.refine = keepRefine; }
    // starting perks
    const seed = D.ALPHA_PERKS[0].vals[P.perk('seed')] || 100;
    const head = D.LEGACY_PERKS[7].vals[P.lperk('headstart')] || 0;
    r.cash = seed + head;
    const qs = D.ALPHA_PERKS[1].vals[P.perk('quickstart')];
    if (qs && r.challenge !== 'nobots') {
      ['auto', 'momentum', 'meanrev'].forEach((id, i) => { if (qs[i]) r.bots[id] = { n: qs[i], paused: false, pnl: 0, trades: 0, wins: 0, losses: 0, best: 0, worst: 0, hist: [], spark: [], t: 0, fees: 0, crits: 0 }; });
    }
    const lv = D.ALPHA_PERKS[5].vals[P.perk('leverage')];
    if (lv > 1 && r.challenge !== 'noleverage') {
      const map = { 2: 'lev2', 3: 'lev3', 5: 'lev5', 10: 'lev10', 20: 'lev20', 50: 'lev50' };
      Object.keys(map).forEach((k) => { if (+k <= lv) r.upgrades[map[k]] = 1; });
    }
    r.rep = D.ALPHA_PERKS[6].vals[P.perk('rep')] || 0;
    if (r.challenge === 'cryptoonly') { r.unlocked = { BITX: true }; r.activeAsset = 'BITX'; }
    r.peakNW = r.cash;
    TE.Mods.dirty = true;
    TE.Mods.rebuild();
    TE.Market.init();
    TE.Empire.initRivals();
    if (TE.World) TE.World.init();
  }

  P.doP1 = function (challenge) {
    if (!P.canP1()) return false;
    const s = TE.state;
    const p = pr();
    const base = P.pendingAlphaBase();
    const gain = P.pendingAlpha();
    const ch = s.run.challenge;
    if (ch && D.CHALLENGE_MAP[ch] && s.run.earnings >= D.CHALLENGE_MAP[ch].goal) {
      if (!p.challenges[ch]) TE.Bus.emit('challenge:complete', D.CHALLENGE_MAP[ch]);
      p.challenges[ch] = 1;
    }
    if (TE.World) TE.World.archiveRun(1, gain);
    p.alphaBase = (p.alphaBase || 0) + base;
    p.alpha += gain;
    p.alphaTotal += gain;
    p.earnBank += s.run.earnings;
    p.p1++;
    TE.Stats.add('prestiges1');
    const info = { layer: 1, gain, earnings: s.run.earnings };
    newRun({ challenge: challenge || null });
    TE.Bus.emit('prestige', info);
    return info;
  };

  P.doP2 = function () {
    if (!P.canP2()) return false;
    const s = TE.state;
    const p = pr();
    const gain = P.pendingLegacy();
    const prevAlpha = p.alphaTotal;
    if (TE.World) TE.World.archiveRun(2, gain);
    p.legacyBase = (p.legacyBase || 0) + P.legacyFor(p.alphaBank + p.alphaTotal) - (p.legacyBase || 0);
    p.legacy += gain;
    p.legacyTotal += gain;
    p.alphaBank += p.alphaTotal;
    p.p2++;
    // reset alpha layer
    const echo = 0.1 * P.lperk('echo');
    p.alpha = Math.floor(prevAlpha * echo);
    p.alphaTotal = p.alpha;
    p.alphaBase = 0;
    p.earnBank = 0;
    if (!P.sperk('eternalalpha')) p.perks = {};
    TE.Stats.add('prestiges2');
    const info = { layer: 2, gain, earnings: s.run.earnings };
    newRun({ challenge: null });
    TE.Bus.emit('prestige', info);
    return info;
  };

  P.doP3 = function () {
    if (!P.canP3()) return false;
    const s = TE.state;
    const p = pr();
    const gain = P.pendingCores();
    if (TE.World) TE.World.archiveRun(3, gain);
    p.cores += gain;
    p.coresTotal += gain;
    p.p3++;
    p.alpha = 0; p.alphaTotal = 0; p.alphaBase = 0; p.earnBank = 0;
    p.legacy = 0; p.legacyTotal = 0; p.legacyBase = 0; p.alphaBank = 0;
    if (!P.sperk('eternalalpha')) p.perks = {};
    if (!P.sperk('eternallegacy')) p.lperks = {};
    TE.Stats.add('prestiges3');
    const info = { layer: 3, gain, earnings: s.run.earnings };
    newRun({ challenge: null });
    TE.Bus.emit('prestige', info);
    return info;
  };

  /* ---------------- modifiers ---------------- */
  TE.Mods.addProvider((ctx) => {
    const p = pr();
    if (p.alphaTotal > 0) ctx.eff('Alpha (α)', U.int(p.alphaTotal) + ' α × ' + (P.alphaPower() * 100).toFixed(0) + U.NB + '%', { stat: 'income.global', add: p.alphaTotal * P.alphaPower() });
    if (p.legacyTotal > 0) ctx.eff('Legacy (Λ)', U.int(p.legacyTotal) + ' Λ', { stat: 'income.global', add: p.legacyTotal * 0.5 });
    if (p.coresTotal > 0) ctx.eff('Singularity (✦)', p.coresTotal + ' noyaux', { stat: 'income.global', mult: 3 }, p.coresTotal);
    D.ALPHA_PERKS.forEach((d) => { const l = p.perks[d.id] || 0; if (l && d.fx) d.fx(l).forEach((e) => ctx.eff('Alpha Perks', d.name + ' (niv. ' + l + ')', e)); });
    D.LEGACY_PERKS.forEach((d) => { const l = p.lperks[d.id] || 0; if (l && d.fx) d.fx(l).forEach((e) => ctx.eff('Legacy Perks', d.name + ' (niv. ' + l + ')', e)); });
    D.SING_PERKS.forEach((d) => { const l = p.sperks[d.id] || 0; if (l && d.fx) d.fx(l).forEach((e) => ctx.eff('Singularity Perks', d.name + ' (niv. ' + l + ')', e)); });
    Object.keys(p.challenges).forEach((id) => { const c = D.CHALLENGE_MAP[id]; if (c) c.reward.forEach((e) => ctx.eff('Challenges', c.name, e)); });
    // combo streak (manual trading)
    const combo = TE.state.run.account.combo;
    const m = TE.Trading.comboMult();
    if (m > 1) ctx.eff('Hot Streak', 'Série de ' + combo + ' trades gagnants', { stat: 'income.global', mult: m });
  });
})(window.TE);
