/* PORTFOLIO, FUND and EMPIRE views. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const S = () => TE.state;

  /* =============================== PORTFOLIO =============================== */
  const REASON_FR = { manual: 'MANUEL', sl: 'STOP LOSS', tp: 'TAKE PROFIT', trail: 'TRAILING', liq: 'LIQUIDATION', reverse: 'INVERSION' };
  const P = { log: true };
  function pfBuild(root) {
    root.innerHTML = '';
    P.kpi = {};
    const kpis = h('div', { class: 'kpis' });
    [['nw', 'Valeur nette', 'fn:nw'], ['cash', 'Liquidités', null], ['eq', 'Capital en positions', null], ['pnl', 'PnL manuel (partie)', null], ['wr', 'Taux de réussite (partie)', null], ['trades', 'Trades (partie)', null],
      ['fees', 'Frais payés', null], ['dd', 'Drawdown actuel', null], ['mdd', 'Drawdown maximal', null], ['exp', 'Exposition', null], ['streak', 'Meilleure série', 'fn:combo'], ['levw', 'Plus gros levier gagnant', null]]
      .forEach(([k, l, tip]) => { const el = UI.kv(l, tip); P.kpi[k] = el._v; kpis.appendChild(el); });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Portefeuille et risque' })]), kpis]));
    P.curve = h('canvas', { class: 'line-canvas' });
    const logT = h('label', { class: 'toggle' }, [h('input', { type: 'checkbox', checked: true, on: { change: (e) => { P.log = e.target.checked; } } }), h('span', { text: 'Échelle log.' })]);
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Courbe de capital (cette partie)' }), h('div', { class: 'card-tools' }, [logT])]), h('div', { class: 'line-box' }, [P.curve])]));
    P.expo = h('div', { class: 'expo' });
    P.recs = h('div', { class: 'kpis' });
    root.appendChild(h('div', { class: 'two-col' }, [
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Exposition par classe d’actifs' })]), P.expo]),
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Records de carrière' })]), P.recs]),
    ]));
    P.hist = h('div', { class: 'mk-table-wrap tall' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Historique des trades' }), h('span', { class: 'card-hr dim', text: '100 derniers trades' })]), P.hist]));
    P.hsig = '';
  }
  function nwDrawdown() {
    const hist = S().run.nwHist;
    let peak = 0, mdd = 0;
    hist.forEach((v) => { if (v > peak) peak = v; else if (peak > 0) mdd = Math.max(mdd, 1 - v / peak); });
    const nw = TE.Economy.netWorth();
    peak = Math.max(peak, nw);
    return { dd: peak > 0 ? Math.max(0, 1 - nw / peak) : 0, mdd };
  }
  function pfUpdate() {
    const s = S();
    if (!P.kpi) return;
    const rs = s.run.stats;
    const nw = TE.Economy.netWorth();
    UI.text(P.kpi.nw, U.money(nw));
    UI.text(P.kpi.cash, U.money(s.run.cash));
    UI.text(P.kpi.eq, U.money(TE.Trading.equity()));
    const pnl = (rs.manualProfit || 0) - (rs.manualLoss || 0);
    UI.text(P.kpi.pnl, U.smoney(pnl)); P.kpi.pnl.className = 'kv-v ' + UI.dir(pnl);
    UI.text(P.kpi.wr, rs.trades ? U.pct((rs.wins || 0) / rs.trades, 1, false) : '—');
    UI.text(P.kpi.trades, U.int(rs.trades || 0) + ' (' + U.int(rs.wins || 0) + ' G / ' + U.int(rs.losses || 0) + ' P)');
    UI.text(P.kpi.fees, U.money(rs.feesPaid || 0));
    const dd = nwDrawdown();
    UI.text(P.kpi.dd, U.pct(-dd.dd, 2)); P.kpi.dd.className = 'kv-v ' + (dd.dd > 0.05 ? 'down' : '');
    UI.text(P.kpi.mdd, U.pct(-dd.mdd, 2));
    let expo = 0;
    const byCls = {};
    Object.keys(s.run.account.positions).forEach((id) => { const p = s.run.account.positions[id]; expo += p.notional; const c = D.ASSET_MAP[id].cls; byCls[c] = (byCls[c] || 0) + p.side * p.notional; });
    UI.text(P.kpi.exp, nw > 0 ? U.mult(expo / nw) + ' VN' : '—');
    UI.text(P.kpi.streak, (s.profile.records.bestStreak || 0) + ' (actuelle : ' + s.run.account.combo + ')');
    UI.text(P.kpi.levw, 'x' + U.fmt(s.profile.records.maxLevWin || 1, { dec: 0 }));
    UI.lineChart(P.curve, s.run.nwHist.concat([nw]), { log: P.log, fmt: (v) => U.money(v) });
    // exposure bars
    const keys = Object.keys(byCls);
    const max = Math.max(1, ...keys.map((k) => Math.abs(byCls[k])));
    UI.html(P.expo, keys.length ? keys.map((k) => '<div class="ex-row"><span>' + D.ASSET_CLASSES[k].name + '</span><div class="ex-bar"><i class="' + (byCls[k] >= 0 ? 'up' : 'down') + '" style="width:' + (Math.abs(byCls[k]) / max * 100).toFixed(1) + '%"></i></div><b class="' + UI.dir(byCls[k]) + '">' + (byCls[k] >= 0 ? 'LONG ' : 'SHORT ') + U.money(Math.abs(byCls[k])) + '</b></div>').join('') : '<div class="dim small">Aucune exposition. Être neutre, c’est aussi une position.</div>');
    const rec = s.profile.records, ls = s.profile.stats;
    const recs = [['Meilleur trade', U.smoney(rec.bestTrade || 0)], ['Pire trade', U.smoney(rec.worstTrade || 0)], ['Meilleur rendement sur marge', U.pct(rec.bestPct || 0, 0)], ['Plus gros critique', '×' + U.fmt(rec.biggestCrit || 0, { dec: 0 })],
      ['Trades au total', U.int(ls.trades || 0)], ['Taux de réussite total', ls.trades ? U.pct((ls.wins || 0) / ls.trades, 1, false) : '—'], ['Liquidations', U.int(ls.liquidations || 0)], ['Plus longue position gagnante', U.dur(rec.longestWinHold || 0)]];
    UI.html(P.recs, recs.map((r) => '<div class="kv"><span class="kv-l">' + r[0] + '</span><span class="kv-v">' + r[1] + '</span></div>').join(''));
    // history
    const hist = s.run.account.history;
    const hs = hist.length ? hist[0].id + ':' + hist.length : '0';
    if (hs !== P.hsig) {
      P.hsig = hs;
      if (!hist.length) { P.hist.innerHTML = '<div class="empty">Aucun trade clôturé dans cette partie.</div>'; return; }
      P.hist.innerHTML = '<table class="tbl"><tr><th>Marché</th><th>Sens</th><th>Levier</th><th>Marge</th><th>Entrée → Sortie</th><th>PnL</th><th>Base</th><th>Bonus</th><th>Sur marge</th><th>Durée</th><th>Sortie</th></tr>' +
        hist.map((x) => '<tr><td>' + x.asset + '</td><td class="' + (x.side > 0 ? 'up' : 'down') + '">' + (x.side > 0 ? 'LONG' : 'SHORT') + '</td><td>x' + U.fmt(x.lev, { dec: 0 }) + '</td><td>' + U.money(x.margin) + '</td><td>' + U.price(x.entry) + ' → ' + U.price(x.exit) + '</td><td class="' + UI.dir(x.total) + '">' + U.smoney(x.total) + (x.crit ? ' <span class="gold">CRITIQUE</span>' : '') + '</td><td>' + U.smoney(x.net) + '</td><td class="gold">' + (x.bonus > 0 ? '+' + U.money(x.bonus) : '—') + '</td><td class="' + UI.dir(x.total) + '">' + U.pct(x.pct, 1) + '</td><td>' + U.dur(x.dur) + '</td><td class="dim">' + (REASON_FR[x.reason] || x.reason.toUpperCase()) + '</td></tr>').join('') + '</table>';
    }
  }
  UI.views.portfolio = { build: pfBuild, update: pfUpdate };

  /* =============================== FUND =============================== */
  const F = {};
  function fundBuild(root) {
    root.innerHTML = '';
    F.root = root;
    F.mode = null;
  }
  function fundSetup() {
    const s = S();
    const root = F.root;
    root.innerHTML = '';
    if (!TE.Fund.active()) {
      F.mode = 'found';
      const name = h('input', { class: 'inp big', type: 'text', maxlength: 32, value: s.profile.fundName || 'Empire Capital' });
      F.foundBtn = UI.costBtn('FONDER LE FONDS', () => {
        const ok = TE.Fund.found(name.value);
        if (ok) { F.mode = null; }
        return ok;
      }, 'big');
      F.foundProg = UI.pbar();
      F.foundLock = h('div', { class: 'dim' });
      root.appendChild(h('div', { class: 'card found' }, [
        h('div', { class: 'found-k', text: 'AGRÉMENT HEDGE FUND' }),
        h('h2', { text: 'Lancez votre propre hedge fund' }),
        h('p', { class: 'dim', html: 'Des investisseurs vont vous confier leur capital : les <b>actifs sous gestion</b> (AUM). Leur argent trade aux côtés de vos bots. Vous gardez une <b>commission de performance</b> sur les profits (le <b>20</b> du « 2 et 20 ») et des <b>frais de gestion</b> sur les actifs (le <b>2</b>).<br>Limitez les drawdowns : les investisseurs retirent leurs fonds quand les pertes dépassent leur tolérance. La réputation attire de plus gros investisseurs.' }),
        h('div', { class: 'found-row' }, [h('label', { class: 'op-lbl', text: 'NOM DU FONDS' }), name]),
        F.foundLock, F.foundProg, F.foundBtn,
      ]));
      return;
    }
    F.mode = 'fund';
    F.kpi = {};
    const kpis = h('div', { class: 'kpis' });
    [['aum', 'AUM', 'fn:aum'], ['cap', 'Capacité', 'stat:fund.capacity'], ['nav', 'VL (5 min)', null], ['dd', 'Drawdown / max', null], ['fees', 'Revenus des frais', null], ['perf', 'Commission de perf.', 'stat:fund.perf'],
      ['mgmt', 'Frais de gestion', 'stat:fund.mgmt'], ['hwm', 'High-water mark', 'fn:hwm'], ['clients', 'Clients', null], ['rep', 'Réputation', 'fn:rep'], ['flows', 'Souscriptions / retraits', 'stat:fund.inflow']]
      .forEach(([k, l, tip]) => { const el = UI.kv(l, tip); F.kpi[k] = el._v; kpis.appendChild(el); });
    F.util = UI.pbar();
    F.utilTxt = h('div', { class: 'small dim' });
    F.notes = h('div', { class: 'fund-notes', tip: 'fn:inflowfx', 'data-why': true });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: s.run.fund.name }), h('span', { class: 'card-hr dim', text: 'Hedge fund · fondé il y a ' + U.dur(s.run.time - s.run.fund.created) })]), kpis, F.util, F.utilTxt, F.notes]));
    F.nav = h('canvas', { class: 'line-canvas' });
    F.aumC = h('canvas', { class: 'line-canvas' });
    root.appendChild(h('div', { class: 'two-col' }, [
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Valeur liquidative par part' })]), h('div', { class: 'line-box' }, [F.nav])]),
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Actifs sous gestion' })]), h('div', { class: 'line-box' }, [F.aumC])]),
    ]));
    F.vip = h('div', { class: 'card vip', hidden: true });
    root.appendChild(F.vip);
    F.inv = h('div', {});
    F.flows = h('div', { class: 'flows' });
    root.appendChild(h('div', { class: 'two-col' }, [
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Base d’investisseurs' })]), F.inv]),
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Mouvements récents et motifs' })]), F.flows]),
    ]));
    F.vsig = ''; F.fsig = '';
  }
  function fundUpdate() {
    const s = S();
    if (!F.root) return;
    const want = TE.Fund.active() ? 'fund' : 'found';
    if (F.mode !== want) fundSetup();
    if (F.mode === 'found') {
      const avail = TE.Fund.available();
      F.foundProg._set(s.run.earnings / D.FUND_UNLOCK_EARN);
      UI.html(F.foundLock, avail ? 'Agrément réglementaire obtenu.' : 'Les régulateurs exigent un historique : <b>' + U.money(D.FUND_UNLOCK_EARN) + '</b> générés dans la partie (' + U.money(s.run.earnings) + ' pour l’instant).');
      const cost = TE.Fund.foundCost();
      F.foundBtn._set(avail ? 'FONDER LE FONDS' : 'VERROUILLÉ', cost, avail && TE.Economy.canAfford(cost), cost === 0 ? { costText: 'GRATUIT (Charte)' } : undefined);
      return;
    }
    const f = s.run.fund;
    const cap = TE.Fund.capacity();
    UI.text(F.kpi.aum, U.money(f.aum));
    UI.text(F.kpi.cap, U.money(cap));
    const r5 = TE.Fund.perfReturn(300);
    UI.text(F.kpi.nav, U.fmt(f.nav, { dec: 2 }) + ' (' + U.pct(r5, 2) + ')'); F.kpi.nav.className = 'kv-v ' + UI.dir(r5);
    const dd = TE.Fund.drawdown();
    UI.text(F.kpi.dd, U.pct(-dd, 2) + ' / ' + U.pct(-f.maxDD, 1)); F.kpi.dd.className = 'kv-v ' + (dd > 0.05 ? 'down' : '');
    const feeRate = TE.Bots.expected().fund + TE.Fund.mgmtIncome();
    UI.text(F.kpi.fees, U.money(feeRate) + '/s');
    UI.text(F.kpi.perf, U.pct(TE.Mods.get('fund.perf'), 0, false));
    UI.text(F.kpi.mgmt, U.pct(TE.Mods.get('fund.mgmt'), 1, false) + ' / an');
    const gap = TE.Fund.hwmGap();
    UI.text(F.kpi.hwm, gap > 0 ? U.money(gap) + ' à récupérer' : 'au plus haut');
    F.kpi.hwm.className = 'kv-v ' + (gap > 0 ? 'c-amber' : 'up');
    if (!F.notesT || performance.now() - F.notesT > 1000) {
      F.notesT = performance.now();
      const fx = TE.Fund.inflowFactors();
      UI.html(F.notes, fx.notes.length ? fx.notes.map((n) => '<div class="fn"><span>' + UI.esc(n[0]) + '</span><b class="' + n[2] + '">' + UI.esc(n[1]) + '</b></div>').join('') : '<div class="dim">Aucun facteur particulier : vos investisseurs regardent surtout la performance et le drawdown.</div>');
    }
    UI.text(F.kpi.clients, U.int(f.clients));
    UI.text(F.kpi.rep, U.int(s.run.rep) + ' · ' + TE.Fund.repTier(s.run.rep).tier.name);
    UI.text(F.kpi.flows, '+' + U.money(f.inflow) + ' / -' + U.money(f.outflow));
    F.util._set(cap > 0 ? f.aum / cap : 0);
    UI.html(F.utilTxt, f.aum >= cap * 0.995 ? '<span class="c-amber">FONDS FERMÉ</span> — capacité atteinte. Augmentez le capital des bots, les améliorations de capacité du fonds ou votre réputation pour accepter plus de capital.' : 'Utilisation ' + U.pct(cap > 0 ? f.aum / cap : 0, 1, false) + ' — ouvert aux nouveaux investisseurs.');
    UI.lineChart(F.nav, f.navHist.concat([f.nav]), { log: true, fmt: (v) => U.fmt(v) });
    UI.lineChart(F.aumC, f.aumHist.concat([f.aum]), { log: true, fmt: (v) => U.money(v), color: getComputedStyle(document.body).getPropertyValue('--violet') });
    // VIP
    const v = f.vip;
    const vsig = (v.offer ? 'o' + v.offer.client : '') + (v.active ? 'a' + v.active.client : '');
    if (vsig !== F.vsig) {
      F.vsig = vsig;
      F.vip.innerHTML = '';
      F.vip.hidden = !vsig;
      if (v.offer) {
        F.vip.appendChild(h('div', { class: 'card-h' }, [h('span', { text: '♛ Proposition de mandat VIP' }), F.vipT = h('span', { class: 'card-hr' })]));
        F.vip.appendChild(h('div', { class: 'vip-c', html: '<b>' + UI.esc(v.offer.client) + '</b> souhaite allouer <b class="up">' + U.money(v.offer.commit) + '</b>.<br>Mandat : ' + TE.Fund.vipText(v.offer) + '<br>Récompense : <b class="gold">' + U.money(v.offer.reward.cash) + '</b> + réputation. En cas d’échec : capital retiré, réputation -5 %.' }));
        F.vip.appendChild(h('div', { class: 'modal-btns' }, [h('button', { class: 'btn btn-ghost', text: 'Refuser', on: { click: () => TE.Fund.declineVip() } }), h('button', { class: 'btn btn-primary', text: 'Accepter le mandat', on: { click: () => TE.Fund.acceptVip() } })]));
      } else if (v.active) {
        F.vip.appendChild(h('div', { class: 'card-h' }, [h('span', { text: '♛ Mandat VIP en cours — ' + v.active.client }), F.vipT = h('span', { class: 'card-hr' })]));
        F.vip.appendChild(F.vipTxt = h('div', { class: 'vip-c' }));
        F.vip.appendChild(F.vipBar = UI.pbar());
      }
    }
    if (v.offer && F.vipT) UI.text(F.vipT, 'expire dans ' + Math.ceil(v.offer.left) + ' s');
    if (v.active && F.vipTxt) {
      const a = v.active;
      let prog = 0, txt = TE.Fund.vipText(a) + '<br>';
      if (a.type === 'return') { const r = f.nav / a.startNav - 1; prog = r / a.target; txt += 'VL ' + U.pct(r, 2) + ' / ' + U.pct(a.target, 0); }
      else if (a.type === 'steady') { prog = a.elapsed / a.dur; txt += 'Tenez bon…'; }
      else { const fe = f.perfFees + f.mgmtFees - a.fees0; prog = fe / a.target; txt += 'Frais ' + U.money(fe) + ' / ' + U.money(a.target); }
      txt += ' · drawdown max ' + U.pct(a.maxDD, 2, false) + ' / ' + U.pct(a.dd, 1, false);
      UI.html(F.vipTxt, txt);
      F.vipBar._set(prog);
      UI.text(F.vipT, U.clock(a.dur - a.elapsed) + ' restantes');
    }
    // investors
    const rows = D.INVESTOR_CLASSES.map((c) => {
      const amt = f.byClass[c.id] || 0;
      const locked = s.run.rep < c.rep || (c.era && s.run.era < c.era);
      return '<tr class="' + (locked ? 'dim' : '') + '"><td><i class="dot" style="background:' + c.color + '"></i>' + c.name + '</td><td>' + (locked ? 'Rép. ' + U.int(c.rep) + (c.era ? ' · Ère ' + D.ERAS[c.era - 1].roman : '') : U.money(amt)) + '</td><td>' + (f.aum > 0 && !locked ? U.pct(amt / f.aum, 1, false) : '—') + '</td><td>' + U.pct(c.tol, 0, false) + ' DD</td><td>' + (locked ? '🔒' : dd > c.tol ? '<span class="down">EN RETRAIT</span>' : '<span class="up">CONFIANTS</span>') + '</td></tr>';
    }).join('');
    const vipRow = f.byClass.vip ? '<tr><td><i class="dot" style="background:#ffd36b"></i>Mandats VIP</td><td>' + U.money(f.byClass.vip) + '</td><td>' + U.pct(f.byClass.vip / Math.max(1, f.aum), 1, false) + '</td><td>—</td><td class="gold">MANDAT</td></tr>' : '';
    UI.html(F.inv, '<table class="tbl"><tr><th>Catégorie</th><th>Capital</th><th>Part</th><th>Tolérance</th><th>Statut</th></tr>' + rows + vipRow + '</table>');
    const fs = f.log.length ? f.log[0].t + ':' + f.log.length : '';
    if (fs !== F.fsig) {
      F.fsig = fs;
      UI.html(F.flows, f.log.slice(0, 14).map((e) => {
        const out = e.amount < 0;
        return '<div class="flow' + (out ? ' out' : '') + '"><span class="dim">' + U.clock(e.t % 3600) + '</span><span>' + UI.esc(out ? 'RETRAITS' : e.who) + '</span><b class="up">' + (out ? '−' : '+') + U.money(Math.abs(e.amount)) + '</b>' + (e.why ? '<span class="flow-why">Motif : ' + UI.esc(e.why) + '</span>' : '') + '</div>';
      }).join('') || '<div class="dim small">En attente des premiers investisseurs…</div>');
    }
  }
  UI.views.fund = { build: fundBuild, update: fundUpdate };
  UI.tips.hwm = () => {
    const gap = TE.Fund.hwmGap();
    return '<div class="tt-title">High-water mark</div><div class="tt-big">' + (gap > 0 ? U.money(gap) : 'Au plus haut') + '</div>' +
      '<div class="tt-dim">Vos investisseurs ne paient la commission de performance que sur les gains au-delà de leurs pertes passées. ' +
      (gap > 0 ? 'Il reste ' + U.money(gap) + ' de pertes à regagner avant toute nouvelle commission (elles s’effacent progressivement avec le temps).' : 'Aucune perte à récupérer : chaque gain rapporte sa commission.') + '</div>';
  };
  UI.tips.inflowfx = () => {
    const fx = TE.Fund.inflowFactors();
    let html = '<div class="tt-title">Ce qui fait bouger vos investisseurs</div>';
    fx.notes.forEach((n) => { html += '<div class="tt-row"><span>' + UI.esc(n[0]) + '</span><span class="' + n[2] + '">' + UI.esc(n[1]) + '</span></div>'; });
    return html + '<div class="tt-dim">Ils réagissent aussi à la performance de la VL sur 5 minutes, au drawdown (selon leur tolérance), à la réputation et aux crises.</div>';
  };

  /* =============================== EMPIRE =============================== */
  const E = {};
  function empBuild(root) {
    root.innerHTML = '';
    E.root = root;
    E.kpi = {};
    const kpis = h('div', { class: 'kpis' });
    [['fv', 'Valeur de la firme', null], ['rank', 'Classement mondial', null], ['inf', 'Influence de marché', 'fn:inf'], ['pow', 'Puissance de marché', 'fn:inf'], ['div', 'Revenus des divisions', 'fn:sat'], ['acq', 'Acquisitions', null], ['off', 'Bureaux mondiaux', null]]
      .forEach(([k, l, tip]) => { const el = UI.kv(l, tip); E.kpi[k] = el._v; kpis.appendChild(el); });
    E.lock = h('div', { class: 'banner-inline', hidden: true });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Empire financier' })]), kpis, E.lock]));
    E.map = h('canvas', { class: 'map-canvas' });
    E.offices = h('div', { class: 'office-list' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Réseau mondial' }), h('span', { class: 'card-hr dim', text: 'ouvrez des bureaux pour étendre votre portée' })]), h('div', { class: 'map-box' }, [E.map]), E.offices]));
    E.divs = h('div', { class: 'item-grid' });
    E.divCard = h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Divisions' }), h('div', { class: 'card-tools' }, [E.buyMode = UI.buyModeSeg()])]), E.divs]);
    root.appendChild(E.divCard);
    E.vc = h('div', { class: 'card', hidden: true });
    root.appendChild(E.vc);
    E.acq = h('div', { class: 'item-grid' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Acquisitions' })]), E.acq]));
    E.board = h('div', {});
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Classement mondial' }), h('span', { class: 'card-hr dim', text: 'simulé · ' + U.int(D.RIVAL_POPULATION) + ' firmes' })]), E.board]));
    E.osig = E.dsig = E.asig = E.bsig = E.vsig = '';
    E.land = null;
  }
  function landDots() {
    const dots = [];
    D.WORLD_ROWS.forEach(([lat, ranges], ri) => {
      [0, 1].forEach((sub) => {
        const la = lat - sub * 2.6;
        for (let lon = -180; lon <= 180; lon += 3) {
          if (ranges.some((rg) => lon >= rg[0] && lon <= rg[1])) dots.push([lon, la]);
        }
      });
      void ri;
    });
    return dots;
  }
  function drawMap(now) {
    const cv = E.map;
    const r = cv.getBoundingClientRect();
    if (r.width < 50) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height;
    ctx.clearRect(0, 0, W, H);
    const mapW = W * 0.86;
    const px = (lon) => ((lon + 180) / 360) * mapW;
    const py = (lat) => ((80 - lat) / 136) * H;
    if (!E.land) E.land = landDots();
    const cs = getComputedStyle(document.body);
    const accent = cs.getPropertyValue('--accent').trim(), gold = cs.getPropertyValue('--gold').trim(), mute = cs.getPropertyValue('--mute').trim();
    ctx.fillStyle = mute;
    ctx.globalAlpha = 0.55;
    E.land.forEach(([lo, la]) => { ctx.fillRect(px(lo) - 1, py(la) - 1, 2, 2); });
    ctx.globalAlpha = 1;
    const emp = S().run.empire;
    const open = D.CITIES.filter((c) => emp.offices[c.id] && !c.offworld);
    const hq = D.CITY_MAP.nyc;
    const t = now / 1000;
    // network arcs
    open.forEach((c, i) => {
      if (c.hq) return;
      const x1 = px(hq.lon), y1 = py(hq.lat), x2 = px(c.lon), y2 = py(c.lat);
      const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.18 - 10;
      ctx.strokeStyle = accent; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
      const f = ((t * 0.35 + i * 0.17) % 1);
      const bx = (1 - f) * (1 - f) * x1 + 2 * (1 - f) * f * mx + f * f * x2;
      const by = (1 - f) * (1 - f) * y1 + 2 * (1 - f) * f * my + f * f * y2;
      ctx.globalAlpha = 1; ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    D.CITIES.filter((c) => !c.offworld).forEach((c) => {
      const isOpen = !!emp.offices[c.id];
      const x = px(c.lon), y = py(c.lat);
      if (isOpen) {
        const pulse = 4 + Math.sin(t * 3 + c.lat) * 1.5;
        ctx.fillStyle = c.hq ? gold : accent;
        ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, y, pulse + 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = c.hq ? gold : accent;
        ctx.fillText(c.name.toUpperCase(), x + 7, y - 6);
      } else {
        ctx.strokeStyle = mute; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke();
      }
    });
    // off-world column
    const ox = mapW + (W - mapW) / 2;
    D.CITIES.filter((c) => c.offworld).forEach((c, i) => {
      const y = H * (0.2 + i * 0.3);
      const isOpen = !!emp.offices[c.id];
      ctx.strokeStyle = isOpen ? accent : mute; ctx.globalAlpha = isOpen ? 0.9 : 0.4;
      ctx.beginPath(); ctx.ellipse(ox, y, 22, 8, -0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = isOpen ? gold : mute;
      ctx.beginPath(); ctx.arc(ox, y, isOpen ? 5 : 3, 0, Math.PI * 2); ctx.fill();
      const a = t * 1.2 + i;
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(ox + Math.cos(a) * 22, y + Math.sin(a) * 8, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = '9px "JetBrains Mono", monospace'; ctx.fillStyle = isOpen ? accent : mute; ctx.textAlign = 'center';
      ctx.fillText(c.short || c.name.split(' ')[0].toUpperCase(), ox, y + 20);
      ctx.textAlign = 'left';
    });
  }
  function empUpdate() {
    const s = S();
    if (!E.kpi) return;
    const active = TE.Empire.active();
    E.lock.hidden = active;
    if (!active) UI.html(E.lock, 'L’empire s’ouvre après <b>' + U.money(D.FEATURE_EARN.empire) + '</b> générés en une partie (' + U.money(s.run.earnings) + ' pour l’instant).');
    const emp = s.run.empire;
    UI.text(E.kpi.fv, U.money(TE.Empire.firmValue()));
    UI.text(E.kpi.rank, '#' + U.int(TE.Empire.rank()));
    UI.text(E.kpi.inf, U.pct(TE.Empire.influence(), 3, false) + ' · ' + TE.Empire.scaleOf(s.run.era).name.toLowerCase());
    UI.text(E.kpi.pow, U.fmt(TE.Empire.power(), { dec: 1 }) + ' · ' + U.money(TE.Empire.controlled()) + ' contrôlés');
    const ds = TE.Bots.expected().divSat || 0;
    UI.text(E.kpi.div, U.money(TE.Empire.divIncome()) + '/s' + (ds > 0.3 ? ' · réserve ' + U.pct(ds, 0, false) : ''));
    UI.text(E.kpi.acq, Object.keys(emp.acq).length + Object.keys(emp.rivalsBought).length + '');
    UI.text(E.kpi.off, (Object.keys(emp.offices).length - 1) + ' / ' + (D.CITIES.length - 1));
    // offices list
    const offs = D.CITIES.filter((c) => !c.hq && TE.Empire.officeAvailable(c));
    const osig = offs.map((c) => c.id + (emp.offices[c.id] ? 1 : 0)).join(',') + active;
    if (osig !== E.osig) {
      E.osig = osig;
      E.offices.innerHTML = '';
      E.offBtns = {};
      offs.forEach((c) => {
        const isOpen = !!emp.offices[c.id];
        const el = h('div', { class: 'office' + (isOpen ? ' open' : ''), tip: '<div class="tt-title">' + c.name + '</div><div class="tt-dim">' + c.desc + '</div>' + UI.effectLines(c.effects).map((t) => '<div>◆ ' + t + '</div>').join('') + '<div>◆ Influence de marché +5 %</div><div>◆ Capacité de marché +3 %</div>' }, [
          h('b', { text: c.name }), h('span', { class: 'small dim', text: UI.effectLines(c.effects).join(' · ') }),
          isOpen ? h('span', { class: 'gold small', text: '● OUVERT' }) : (E.offBtns[c.id] = UI.costBtn('OUVRIR', () => TE.Empire.openOffice(c.id), 'sm')),
        ]);
        E.offices.appendChild(el);
      });
    }
    offs.forEach((c) => { const b = E.offBtns[c.id]; if (b) b._set('OUVRIR', c.cost, active && TE.Economy.canAfford(c.cost)); });
    // divisions
    E.buyMode._update();
    const divs = D.DIVISIONS.filter((d) => TE.Empire.divUnlocked(d.id));
    E.divCard.hidden = !divs.length;
    const dsig = divs.map((d) => d.id).join(',');
    if (dsig !== E.dsig) {
      E.dsig = dsig;
      E.divs.innerHTML = '';
      E.dcards = {};
      divs.forEach((d) => {
        const c = {};
        c.el = h('div', { class: 'card item', style: '--uc:' + d.color }, [
          h('div', { class: 'it-h' }, [h('span', { class: 'it-ic', text: d.icon, style: 'color:' + d.color }), h('b', { text: d.name }), c.lvl = h('span', { class: 'it-count' })]),
          h('div', { class: 'dim small', text: d.desc }), c.info = h('div', { class: 'it-fx' }),
          c.buy = UI.costBtn('DÉVELOPPER', () => { const q = TE.Empire.divQuote(d.id); return TE.Empire.buyDiv(d.id, q.qty); }),
        ]);
        E.dcards[d.id] = c;
        E.divs.appendChild(c.el);
      });
    }
    divs.forEach((d) => {
      const c = E.dcards[d.id];
      const lvl = TE.Empire.divLevel(d.id);
      UI.text(c.lvl, 'Niv. ' + U.int(lvl));
      const wt = TE.Empire.divWorldText(d.id);
      UI.html(c.info, '<b class="up">' + U.money(TE.Empire.divIncomeOne(d.id)) + '/s</b> · ' + d.flavor(lvl) + ' · ×2 au niveau ' + (Math.floor(lvl / 25) + 1) * 25 + (wt ? '<br><span class="dim">Monde : ' + wt + '</span>' : ''));
      const q = TE.Empire.divQuote(d.id);
      c.buy._set('DÉVELOPPER ×' + q.qty, q.cost, q.afford);
    });
    // venture desk
    const vcOn = TE.Empire.vcActive();
    E.vc.hidden = !vcOn;
    if (vcOn) {
      const vc = emp.vc;
      const vsig = vc.pitches.map((p) => p.pid).join(',') + '|' + vc.deals.map((d) => d.pid).join(',');
      if (vsig !== E.vsig) {
        E.vsig = vsig;
        E.vc.innerHTML = '';
        E.vc.appendChild(h('div', { class: 'card-h' }, [h('span', { text: 'Desk de capital-risque' }), h('span', { class: 'card-hr dim', text: vc.deals.length + ' / ' + TE.Empire.vcSlots() + ' deals' })]));
        const pg = h('div', { class: 'vc-grid' });
        E.pBtns = {};
        vc.pitches.forEach((p) => {
          const b = UI.costBtn('INVESTIR', () => TE.Empire.vcInvest(p.pid), 'sm');
          E.pBtns[p.pid] = { b, p };
          const pf = TE.Empire.vcProfile(p);
          pg.appendChild(h('div', { class: 'vc-pitch', tip: '<div class="tt-title">Profil du deal</div><div class="tt-row"><span>Stade (' + p.stage + ')</span><span>' + pf.stage + '</span></div><div class="tt-row"><span>Hype ' + p.hype + '/5</span><span>' + pf.hype + '</span></div><div class="tt-row"><span>Secteur ' + p.sector + '</span><span>' + pf.sector + '</span></div><div class="tt-dim">Le stade fixe le risque et le potentiel, la hype amplifie l’écart entre faillite et licorne, le secteur réagit au cycle macro.</div>' }, [
            h('b', { text: p.name }), h('div', { class: 'small dim', text: p.sector + ' · ' + p.stage + ' · échéance dans ' + U.dur(p.matur) }), h('div', { class: 'small gold', text: '★'.repeat(p.hype) + '☆'.repeat(5 - p.hype) + ' hype' }),
            h('div', { class: 'vc-prof', text: pf.stage + ' · ' + pf.hype + ' · ' + pf.sector }),
            h('div', { class: 'vc-act' }, [b, h('button', { class: 'btn btn-ghost btn-xs', text: 'Passer', on: { click: () => TE.Empire.vcPass(p.pid) } })])]));
        });
        if (!vc.pitches.length) pg.appendChild(h('div', { class: 'dim small', text: 'Aucun pitch pour le moment. Les fondateurs peaufinent leurs présentations…' }));
        E.vc.appendChild(pg);
        E.dealsEl = h('div', { class: 'vc-deals' });
        E.vc.appendChild(E.dealsEl);
      }
      Object.keys(E.pBtns || {}).forEach((k) => { const x = E.pBtns[k]; x.b._set('INVESTIR', x.p.ask, TE.Economy.canAfford(x.p.ask) && vc.deals.length < TE.Empire.vcSlots()); });
      UI.html(E.dealsEl, vc.deals.map((d) => '<div class="vc-deal"><span>' + UI.esc(d.name) + '</span><span class="dim">' + U.money(d.invested) + '</span><div class="pbar thin"><i style="width:' + ((1 - d.left / d.matur) * 100).toFixed(1) + '%"></i></div><span class="dim">' + U.clock(d.left) + '</span></div>').join(''));
    }
    // acquisitions
    const acqs = D.ACQUISITIONS.filter((a) => TE.Empire.acqVisible(a));
    const asig = acqs.map((a) => a.id + (emp.acq[a.id] ? 1 : 0)).join(',') + active;
    if (asig !== E.asig) {
      E.asig = asig;
      E.acq.innerHTML = '';
      E.aBtns = {};
      acqs.forEach((a) => {
        const owned = !!emp.acq[a.id];
        const fx = UI.effectLines(a.effects);
        if (a.unlock) fx.unshift('Débloque la division : ' + D.DIV_MAP[a.unlock].name);
        E.acq.appendChild(h('div', { class: 'card item acq' + (owned ? ' owned' : '') }, [
          h('div', { class: 'it-h' }, [h('b', { text: a.name }), h('span', { class: 'tag', text: a.type })]),
          h('div', { class: 'dim small', text: a.desc }), h('div', { class: 'it-fx', html: fx.map((t) => '◆ ' + UI.esc(t)).join('<br>') }),
          owned ? h('div', { class: 'gold small', text: '✔ POSSÉDÉ' }) : (E.aBtns[a.id] = UI.costBtn('ACQUÉRIR', () => TE.Empire.buyAcq(a.id))),
        ]));
      });
    }
    acqs.forEach((a) => { const b = E.aBtns[a.id]; if (b) b._set(active ? 'ACQUÉRIR' : 'VERROUILLÉ', a.cost, active && TE.Economy.canAfford(a.cost)); });
    // leaderboard
    const rivals = TE.Empire.rivalList();
    const me = { me: true, name: (s.profile.fundName || 'Votre firme') + ' (VOUS)', value: TE.Empire.firmValue() };
    const all = rivals.map((x) => ({ def: x.def, name: x.def.name, value: x.value })).concat([me]).sort((a, b) => b.value - a.value);
    const myRank = TE.Empire.rank();
    const aboveNamed = rivals.filter((x) => x.value > me.value).length;
    const tailBetween = myRank - 1 - aboveNamed;
    let html = '<table class="tbl board"><tr><th>#</th><th>Firme</th><th>Style</th><th>Valeur</th><th></th></tr>';
    let rank = 1;
    all.slice(0, 14).forEach((x) => {
      const rk = x.me ? myRank : rank;
      if (!x.me) rank++;
      if (x.me && tailBetween > 0) rank += 0;
      const take = !x.me && TE.Empire.canTakeover({ value: x.value }) ? '<button class="btn btn-xs btn-danger" data-take="' + x.def.id + '">Racheter ' + U.money(TE.Empire.takeoverCost(x)) + '</button>' : '';
      let stTag = '';
      if (!x.me) {
        const st = TE.World.rivalState(x.def.id);
        if (st.k === 'trouble') stTag = '<span class="rv-state trouble">EN DIFFICULTÉ −35 %</span>';
        else if (st.k === 'campaign') stTag = '<span class="rv-state campaign">' + st.txt + '</span>';
      }
      const ai = !x.me && D.RIVAL_AI[x.def.id];
      html += '<tr class="' + (x.me ? 'me' : '') + '"><td>' + (x.me ? '#' + U.int(rk) : '#' + rk) + '</td><td>' + UI.esc(x.name) + stTag + '</td><td class="dim">' + (x.me ? 'Tout, à terme' : x.def.style + (ai ? ' · ' + ai.rep : '')) + '</td><td>' + U.money(x.value) + '</td><td>' + take + '</td></tr>';
    });
    html += '</table>';
    if (tailBetween > 0) html += '<div class="dim small">…et ' + U.int(tailBetween) + ' firmes plus petites sont encore devant vous dans la longue traîne.</div>';
    if (html !== E.bsig) {
      E.bsig = html;
      E.board.innerHTML = html;
      UI.$$('[data-take]', E.board).forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.take;
        UI.confirm({ title: 'OPA hostile', body: 'Racheter <b>' + D.RIVAL_MAP[id].name + '</b> ? Leur bonus : ' + UI.effectLines(D.RIVAL_MAP[id].effects).join(', ') + '.', yes: 'Lancer l’OPA', onYes: () => TE.Empire.takeover(id), optional: true });
      }));
    }
  }
  UI.views.empire = { build: empBuild, update: empUpdate, frame(now) { if (E.map && !E.root.hidden) { if (!E._lt || now - E._lt > 50) { E._lt = now; drawMap(now); } } } };
})(window.TE);
