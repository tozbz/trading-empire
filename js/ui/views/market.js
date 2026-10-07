/* MARKET — the trading desk: chart, order entry, positions, orders, history, abilities, fleet summary. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const S = () => TE.state;
  const r = {};
  let chart = null;
  let lastPrice = 0, structSig = '', bottomTab = 'positions', ordType = 'limit', ordSide = 1;

  function chartPrefs() {
    const s = S();
    if (!s.settings.chart) s.settings.chart = { sma: true, bb: true, rsi: true, tf: 1 };
    return s.settings.chart;
  }

  function source() {
    const s = S();
    const id = s.run.activeAsset;
    const a = TE.Market.asset(id);
    if (!a) return null;
    const def = D.ASSET_MAP[id];
    const cs = getComputedStyle(document.body);
    const col = (k) => cs.getPropertyValue(k).trim();
    const lines = [];
    const pos = s.run.account.positions[id];
    if (pos) {
      const u = TE.Trading.upnl(id) - pos.fees;
      lines.push({ kind: 'entry', price: pos.entry, color: col('--accent'), dash: [], label: (pos.side > 0 ? 'LONG' : 'SHORT') + ' x' + fmtLev(pos.lev) + '  ' + U.smoney(u) + '  ' + U.pct(u / pos.margin, 1) });
      const liq = TE.Trading.liqPrice(pos);
      if (liq > 0) lines.push({ kind: 'liq', price: liq, color: col('--down'), dash: [2, 3], label: 'LIQUIDATION' });
      if (pos.sl) lines.push({ kind: 'sl', price: pos.sl, color: col('--amber'), label: 'STOP LOSS ⇕', drag: 'sl' });
      if (pos.tp) lines.push({ kind: 'tp', price: pos.tp, color: col('--up'), label: 'TAKE PROFIT ⇕', drag: 'tp' });
      if (pos.trail) lines.push({ kind: 'trail', price: pos.side > 0 ? pos.best * (1 - pos.trail) : pos.best * (1 + pos.trail), color: col('--amber'), dash: [1, 3], label: 'TRAILING STOP' });
    }
    s.run.account.orders.forEach((o) => {
      if (o.asset !== id) return;
      lines.push({ kind: 'order', price: o.price, color: col('--violet'), dash: [8, 4], label: (o.side > 0 ? 'ACHAT ' : 'VENTE ') + ORD_TYPE[o.type] + (o.oco ? ' (OCO)' : '') });
    });
    const p = chartPrefs();
    const lg = s.run.legendary && s.run.legendary.asset === id && s.run.time < s.run.legendary.until;
    return {
      a, def, lines, tf: p.tf || 1, botMarks: s.settings.botMarkers,
      ind: {
        sma: TE.Mods.has('ind.sma') && p.sma, bb: TE.Mods.has('ind.bb') && p.bb, rsi: TE.Mods.has('ind.rsi') && p.rsi,
        regime: TE.Mods.has('ind.regime') ? TE.Market.regimeView(id) : null,
        forecast: TE.Mods.has('ind.forecast') ? TE.Market.forecast(id) : null,
      },
      overlay: lg ? { color: col('--gold') } : null,
    };
  }
  const ORD_TYPE = { limit: 'LIMITE', stop: 'STOP' };
  const TAB_FR = { positions: 'Positions', orders: 'Ordres', history: 'Historique' };
  const REASON_FR = { manual: 'MANUEL', sl: 'STOP LOSS', tp: 'TAKE PROFIT', trail: 'TRAILING', liq: 'LIQUIDATION', reverse: 'INVERSION' };
  function fmtLev(l) { return l >= 1000 ? U.fmt(l, { dec: 0 }) : String(Math.round(l)); }

  /* ======================= BUILD ======================= */
  function build(root) {
    root.innerHTML = '';
    r.assets = h('div', { class: 'mk-assets', id: 'mk-assets' });
    // chart card
    r.title = h('div', { class: 'mk-title' });
    r.price = h('div', { class: 'mk-price' });
    r.chg = h('div', { class: 'mk-chg' });
    r.regime = h('div', { class: 'mk-regime' });
    r.liq = h('div', { class: 'mk-liq', tip: 'fn:liq', 'data-why': true });
    r.tf = h('div', { class: 'seg mini' });
    [[1, '2s'], [5, '10s'], [15, '30s']].forEach(([v, l]) => r.tf.appendChild(h('button', { text: l, data: { tf: String(v) }, tip: 'Durée des bougies', on: { click: () => { chartPrefs().tf = v; chart.setTf(v); } } })));
    r.ind = h('div', { class: 'seg mini', id: 'ind-toggles' });
    const chartBox = h('div', { class: 'chart-box' });
    const chartCard = h('div', { class: 'card mk-chart' }, [
      h('div', { class: 'mk-chart-h' }, [h('div', { class: 'mk-head-l' }, [r.title, r.price, r.chg, r.regime, r.liq]), h('div', { class: 'mk-head-r' }, [r.ind, r.tf])]),
      chartBox,
    ]);
    // order card
    r.order = h('div', { class: 'card mk-order' });
    // bottom
    r.bottomTabs = h('div', { class: 'seg tabs' });
    [['positions', 'Positions'], ['orders', 'Ordres'], ['history', 'Historique']].forEach(([k, l]) => r.bottomTabs.appendChild(h('button', { text: l, data: { t: k }, on: { click: () => { bottomTab = k; renderBottom(true); } } })));
    r.bottomBody = h('div', { class: 'mk-table-wrap' });
    r.closeAll = h('button', { class: 'btn btn-ghost btn-xs', html: 'Tout fermer <kbd>X</kbd>', on: { click: () => TE.Trading.closeAll() } });
    const posCard = h('div', { class: 'card mk-pos' }, [h('div', { class: 'card-h' }, [r.bottomTabs, r.closeAll]), r.bottomBody]);
    r.abil = h('div', { class: 'abilities', id: 'abilities' });
    r.fleet = h('div', { class: 'fleet-mini' });
    r.loan = h('button', { class: 'btn btn-ghost loan', hidden: true, html: '☎ Appeler maman <span class="dim">(+100 $)</span>', on: { click: () => TE.Trading.familyLoan() } });
    r.actors = h('div', { class: 'actors', tip: 'fn:actors', 'data-why': true });
    const sideCard = h('div', { class: 'card mk-desk' }, [
      h('div', { class: 'card-h' }, [h('span', { text: 'Desk' }), h('button', { class: 'link', text: 'Bots →', on: { click: () => UI.go('bots') } })]),
      r.actors, r.abil, r.fleet, r.loan,
    ]);
    root.appendChild(h('div', { class: 'mk-grid' }, [r.assets, chartCard, r.order, posCard, sideCard]));
    chart = new TE.Chart(chartBox, {
      source,
      zoom: 96,
      onDragLine: (which, price) => {
        const id = S().run.activeAsset;
        if (which === 'sl') TE.Trading.setSL(id, price);
        if (which === 'tp') TE.Trading.setTP(id, price);
      },
    });
    chart.tf = chartPrefs().tf || 1;
    UI.marketChart = chart;
    structSig = '';
    renderAssets(true);
    renderOrderPanel(true);
    renderBottom(true);
  }

  /* ---------------- asset strip ---------------- */
  let assetSig = '';
  function renderAssets(force) {
    const s = S();
    const ids = Object.keys(s.run.unlocked).sort((a, b) => D.ASSET_MAP[a].order - D.ASSET_MAP[b].order);
    const sig = ids.join(',');
    if (force || sig !== assetSig) {
      assetSig = sig;
      r.assets.innerHTML = '';
      r.chips = {};
      let lastCls = null;
      ids.forEach((id) => {
        const d = D.ASSET_MAP[id];
        if (lastCls && lastCls !== d.cls) r.assets.appendChild(h('span', { class: 'chip-sep' }));
        lastCls = d.cls;
        const chip = h('button', { class: 'chip', style: '--cc:' + D.ASSET_CLASSES[d.cls].color, tip: '<div class="tt-title">' + d.name + ' (' + id + ')</div><div class="tt-dim">' + D.ASSET_CLASSES[d.cls].name + ' · ' + d.desc + '</div>', on: { click: () => { s.run.activeAsset = id; TE.Audio.play('click'); } } }, [
          h('span', { class: 'chip-s', text: id }), h('span', { class: 'chip-p' }), h('span', { class: 'chip-c' }), h('i', { class: 'chip-dot' }),
        ]);
        r.chips[id] = chip;
        r.assets.appendChild(chip);
      });
    }
    ids.forEach((id) => {
      const c = r.chips[id];
      const ch = TE.Market.change(id, 300);
      UI.cls(c, 'on', id === s.run.activeAsset);
      UI.text(c.children[1], U.price(TE.Market.mid(id)));
      UI.text(c.children[2], U.pct(ch, 2));
      c.children[2].className = 'chip-c ' + UI.dir(ch);
      const pos = s.run.account.positions[id];
      c.children[3].className = 'chip-dot' + (pos ? (pos.side > 0 ? ' long' : ' short') : '');
    });
  }

  /* ---------------- order panel ---------------- */
  function sig() {
    const s = S();
    const id = s.run.activeAsset;
    const pos = s.run.account.positions[id];
    return [id, pos ? pos.side : 0, TE.Trading.levTiers().join('.'), TE.Mods.has('ord.sltp'), TE.Mods.has('ord.trail'), TE.Mods.has('ord.limit'), TE.Mods.has('ord.stop'), TE.Mods.has('ord.oco'), !!(pos && pos.legendary)].join('|');
  }
  function renderOrderPanel(force) {
    const s = S();
    const sg = sig();
    if (!force && sg === structSig) return;
    structSig = sg;
    const id = s.run.activeAsset;
    const def = D.ASSET_MAP[id];
    const acct = s.run.account;
    const pos = acct.positions[id];
    const el = r.order;
    el.innerHTML = '';
    r.o = {};
    el.appendChild(h('div', { class: 'card-h' }, [h('span', { text: 'Passage d’ordre' }), h('span', { class: 'card-hr dim', text: D.ASSET_CLASSES[def.cls].name })]));
    r.o.bidask = h('div', { class: 'op-bidask' });
    el.appendChild(r.o.bidask);
    // size
    const sizeSeg = h('div', { class: 'seg' });
    [0.1, 0.25, 0.5, 1].forEach((p, i) => sizeSeg.appendChild(h('button', { text: p * 100 + '\u202f%', data: { p: String(p) }, tip: 'Taille : ' + p * 100 + ' % de la marge disponible (' + (i + 1) + ')', on: { click: () => { acct.sizePct = p; TE.Audio.play('click'); } } })));
    r.o.sizeSeg = sizeSeg;
    r.o.sizeInfo = h('div', { class: 'op-info' });
    r.o.impact = h('div', { class: 'op-impact', tip: 'fn:liq', 'data-why': true });
    el.appendChild(h('div', { class: 'op-row' }, [h('div', { class: 'op-lbl', html: 'TAILLE <span class="dim">1-4</span>' }), sizeSeg]));
    el.appendChild(r.o.sizeInfo);
    el.appendChild(r.o.impact);
    // leverage
    const tiers = TE.Trading.levTiers();
    const levSeg = h('div', { class: 'seg lev', id: 'lev-row' });
    tiers.forEach((l) => levSeg.appendChild(h('button', { text: 'x' + fmtLev(l), data: { l: String(l) }, on: { click: () => { acct.lev = l; TE.Audio.play('click'); } } })));
    r.o.levSeg = levSeg;
    r.o.levInfo = h('div', { class: 'op-info' });
    el.appendChild(h('div', { class: 'op-row' }, [h('div', { class: 'op-lbl', html: 'LEVIER <span class="dim">- =</span>' }), levSeg]));
    el.appendChild(r.o.levInfo);
    // buttons
    // with a position open, the icon tells what the button does: + reinforce, ⇄ flip
    const longIc = pos ? (pos.side > 0 ? '+' : '⇄') : '▲';
    const shortIc = pos ? (pos.side < 0 ? '+' : '⇄') : '▼';
    const tipL = pos ? (pos.side > 0 ? 'Renforcer votre position LONG (L)' : 'Inverser : fermer le SHORT et ouvrir un LONG (L)') : 'Ouvrir un LONG : vous gagnez quand le prix monte (L)';
    const tipS = pos ? (pos.side < 0 ? 'Renforcer votre position SHORT (S)' : 'Inverser : fermer le LONG et ouvrir un SHORT (S)') : 'Ouvrir un SHORT : vous gagnez quand le prix baisse (S)';
    r.o.long = h('button', { class: 'btn-trade long', id: 'btn-long', tip: tipL, on: { click: () => TE.Trading.open(S().run.activeAsset, 1) } }, [h('span', { class: 'bt-a', text: longIc }), h('span', { class: 'bt-l', text: 'LONG' }), h('kbd', { text: 'L' }), h('span', { class: 'bt-p' })]);
    r.o.short = h('button', { class: 'btn-trade short', id: 'btn-short', tip: tipS, on: { click: () => TE.Trading.open(S().run.activeAsset, -1) } }, [h('span', { class: 'bt-a', text: shortIc }), h('span', { class: 'bt-l', text: 'SHORT' }), h('kbd', { text: 'S' }), h('span', { class: 'bt-p' })]);
    el.appendChild(h('div', { class: 'op-trade' }, [r.o.long, r.o.short]));
    // position card
    r.o.pos = h('div', { class: 'pos-card' + (pos ? ' has ' + (pos.side > 0 ? 'long' : 'short') : '') + (pos && pos.legendary ? ' legendary' : ''), id: 'pos-card' });
    el.appendChild(r.o.pos);
    if (pos) {
      r.o.pos.appendChild(h('div', { class: 'pc-h' }, [h('span', { class: 'pc-side ' + (pos.side > 0 ? 'up' : 'down'), text: (pos.side > 0 ? '▲ LONG ' : '▼ SHORT ') + id }), h('span', { class: 'pc-lev' }), h('span', { class: 'pc-dur' })]));
      r.o.upnl = h('div', { class: 'pc-pnl' });
      r.o.pos.appendChild(r.o.upnl);
      r.o.grid = h('div', { class: 'pc-grid' });
      r.o.pos.appendChild(r.o.grid);
      r.o.close = h('button', { class: 'btn-close', html: 'FERMER LA POSITION <kbd>Espace</kbd>', on: { click: () => TE.Trading.close(S().run.activeAsset, 'manual') } });
      r.o.pos.appendChild(r.o.close);
    } else {
      r.o.pos.appendChild(h('div', { class: 'pc-empty', html: 'Aucune position ouverte sur <b>' + id + '</b>.<br><span class="dim">Lisez la tendance, puis passez LONG ou SHORT.</span>' }));
    }
    // risk orders
    if (pos && TE.Mods.has('ord.sltp')) {
      const box = h('div', { class: 'op-risk' });
      const mk = (kind, label, pcts) => {
        const input = h('input', { type: 'text', class: 'inp', placeholder: 'prix', on: { change: (e) => { const v = U.parseNum(e.target.value); if (kind === 'sl') TE.Trading.setSL(S().run.activeAsset, v); else TE.Trading.setTP(S().run.activeAsset, v); } } });
        const quick = h('div', { class: 'seg mini' });
        pcts.forEach((p) => quick.appendChild(h('button', { text: (kind === 'sl' ? '-' : '+') + p + '\u202f%', on: { click: () => {
          const ps = S().run.account.positions[S().run.activeAsset];
          if (!ps) return;
          const f = kind === 'sl' ? 1 - (ps.side * p) / 100 : 1 + (ps.side * p) / 100;
          const price = ps.entry * f;
          if (kind === 'sl') TE.Trading.setSL(S().run.activeAsset, price); else TE.Trading.setTP(S().run.activeAsset, price);
        } } })));
        quick.appendChild(h('button', { text: '✕', tip: 'Effacer', on: { click: () => { if (kind === 'sl') TE.Trading.setSL(S().run.activeAsset, 0); else TE.Trading.setTP(S().run.activeAsset, 0); } } }));
        r.o[kind] = input;
        return h('div', { class: 'op-row' }, [h('div', { class: 'op-lbl ' + (kind === 'sl' ? 'c-amber' : 'up'), text: label }), input, quick]);
      };
      box.appendChild(mk('sl', 'STOP', [1, 2, 5]));
      box.appendChild(mk('tp', 'OBJECTIF', [1, 3, 8]));
      if (TE.Mods.has('ord.trail')) {
        const tseg = h('div', { class: 'seg mini' });
        [0, 0.01, 0.02, 0.05].forEach((p) => tseg.appendChild(h('button', { text: p ? p * 100 + '\u202f%' : 'NON', data: { p: String(p) }, on: { click: () => TE.Trading.setTrail(S().run.activeAsset, p) } })));
        r.o.trail = tseg;
        box.appendChild(h('div', { class: 'op-row' }, [h('div', { class: 'op-lbl c-amber', text: 'TRAILING' }), tseg]));
      }
      box.appendChild(h('div', { class: 'op-hint dim', text: 'Astuce : faites glisser les lignes SL / TP directement sur le graphique.' }));
      el.appendChild(box);
    }
    // pending orders (expert: folded by default)
    if (TE.Mods.has('ord.limit') || TE.Mods.has('ord.stop')) {
      const st = S().settings;
      const box = h('details', { class: 'op-pending adv' });
      if (st.advOrders) box.open = true;
      box.addEventListener('toggle', () => { st.advOrders = box.open; });
      box.appendChild(h('summary', { class: 'op-lbl', text: 'ORDRES AVANCÉS (limite, stop, OCO)' }));
      const typeSeg = h('div', { class: 'seg mini' });
      if (TE.Mods.has('ord.limit')) typeSeg.appendChild(h('button', { text: 'LIMITE', data: { v: 'limit' }, on: { click: () => { ordType = 'limit'; } } }));
      if (TE.Mods.has('ord.stop')) typeSeg.appendChild(h('button', { text: 'STOP', data: { v: 'stop' }, on: { click: () => { ordType = 'stop'; } } }));
      if (!TE.Mods.has('ord.limit')) ordType = 'stop';
      const sideSeg = h('div', { class: 'seg mini' }, [
        h('button', { text: 'ACHAT', data: { v: '1' }, on: { click: () => { ordSide = 1; } } }), h('button', { text: 'VENTE', data: { v: '-1' }, on: { click: () => { ordSide = -1; } } }),
      ]);
      const price = h('input', { type: 'text', class: 'inp', placeholder: 'prix de déclenchement' });
      const pick = h('button', { class: 'btn btn-ghost btn-xs', text: '⌖', tip: 'Choisir le prix sur le graphique', on: { click: () => { chart.pickMode = (p) => { price.value = U.price(p); }; chart.draw(true); } } });
      const place = h('button', { class: 'btn btn-primary btn-xs', text: 'PLACER', on: { click: () => {
        const v = U.parseNum(price.value);
        if (!(v > 0)) { UI.toast({ text: 'Saisissez un prix valide.', kind: 'warn', icon: '!' }); return; }
        if (TE.Trading.placeOrder({ asset: S().run.activeAsset, type: ordType, side: ordSide, price: v })) { price.value = ''; TE.Audio.play('click'); }
      } } });
      r.o.typeSeg = typeSeg; r.o.sideSeg = sideSeg;
      box.appendChild(h('div', { class: 'op-row' }, [h('div', { class: 'op-lbl', text: 'EN ATTENTE' }), typeSeg, sideSeg]));
      box.appendChild(h('div', { class: 'op-row' }, [price, pick, place]));
      if (TE.Mods.has('ord.oco')) {
        box.appendChild(h('div', { class: 'op-row' }, [h('button', { class: 'btn btn-ghost btn-xs wide', tip: 'Place un STOP ACHAT au-dessus et un STOP VENTE en dessous. Le premier déclenché annule l’autre.', text: 'ENCADREMENT OCO ±1,5 % (attraper la cassure)', on: { click: () => { const p = TE.Market.mid(S().run.activeAsset); TE.Trading.placeOCO(S().run.activeAsset, p * 1.015, p * 0.985); } } })]));
      }
      el.appendChild(box);
    }
    r.o.foot = h('div', { class: 'op-foot dim' });
    el.appendChild(r.o.foot);
  }
  function updateOrderPanel() {
    const s = S();
    const id = s.run.activeAsset;
    const acct = s.run.account;
    const pos = acct.positions[id];
    const mid = TE.Market.mid(id);
    const bid = TE.Market.bid(id), ask = TE.Market.ask(id);
    const dec = U.priceDec(mid);
    UI.html(r.o.bidask, '<span>VENTE <b class="down">' + U.price(bid, dec) + '</b></span><span>ACHAT <b class="up">' + U.price(ask, dec) + '</b></span><span>SPREAD <b>' + U.pct(TE.Market.spread(id), 3, false) + '</b></span>');
    Array.from(r.o.sizeSeg.children).forEach((b) => UI.cls(b, 'on', +b.dataset.p === acct.sizePct));
    const avail = TE.Trading.availableMargin(id);
    const margin = avail * acct.sizePct;
    const lev = acct.lev;
    UI.html(r.o.sizeInfo, 'Marge <b>' + U.money(margin) + '</b> · Notionnel <b>' + U.money(margin * lev) + '</b> · Frais ' + U.money(margin * lev * TE.Trading.feeRate()));
    // V2: impact preview before validation
    const est = TE.Market.impactEst(id, margin * lev);
    UI.html(r.o.impact, '<span class="op-lbl">IMPACT ESTIMÉ</span><b class="imp imp-' + est.lvl + '">' + est.label + '</b><span>' + U.pct(est.pct, est.pct < 0.001 ? 3 : 2, false) + ' · glissement ≈ ' + U.pct(est.slip, est.slip < 0.001 ? 3 : 2, false) + '</span>' +
      (est.lvl === 'hi' ? '<em class="down">Votre ordre va déplacer le marché.</em>' : est.lvl === 'mid' ? '<em class="c-amber">Ordre visible : le prix va réagir.</em>' : ''));
    Array.from(r.o.levSeg.children).forEach((b) => UI.cls(b, 'on', +b.dataset.l === lev));
    const liqMove = TE.Trading.liqDistance(lev);
    UI.html(r.o.levInfo, lev > 1 ? 'Liquidation après un mouvement défavorable de <b class="down">' + U.pct(-liqMove, liqMove < 0.0001 ? 4 : liqMove < 0.01 ? 2 : 1) + '</b>' + (lev > TE.Trading.EXTREME_LEV ? '<br><span class="down">Levier extrême : liquidation au prix réel, la perte peut dépasser la marge.</span>' : '') : '<span class="dim">Sans levier : quasiment aucun risque de liquidation.</span>');
    UI.text(r.o.long.children[3], U.price(ask, dec));
    UI.text(r.o.short.children[3], U.price(bid, dec));
    if (pos && r.o.upnl) {
      const u = TE.Trading.upnl(id) - pos.fees;
      const pct = u / pos.margin;
      UI.html(r.o.upnl, '<span class="' + UI.dir(u) + '">' + (u >= 0 ? '▲ ' : '▼ ') + U.smoney(u) + '</span><small class="' + UI.dir(u) + '">' + U.pct(pct, 2) + ' sur la marge</small>');
      const liq = TE.Trading.liqPrice(pos);
      const dist = pos.side > 0 ? mid / liq - 1 : liq / mid - 1;
      const cells = [
        ['Taille', U.money(pos.notional)], ['Entrée', U.price(pos.entry, dec)], ['Prix', U.price(mid, dec)], ['Marge', U.money(pos.margin)],
        ['Liq.', liq > 0 ? U.price(liq, dec) : '—', dist < 0.05 ? 'down' : ''], ['Dist. liq.', liq > 0 ? U.pct(dist, 1, false) : '∞', dist < 0.05 ? 'down' : ''],
        ['Frais', U.money(pos.fees)], ['Bonus', U.mult(TE.Trading.profitMult() * (pos.legendary ? 5 : 1)) + (u > 0 ? ' → +' + U.money(Math.min(u * (TE.Trading.profitMult() * (pos.legendary ? 5 : 1) - 1), TE.Trading.payoutCap() * (pos.legendary ? 5 : 1))) : ''), 'gold'],
      ];
      UI.html(r.o.grid, cells.map((c) => '<div><span>' + c[0] + '</span><b class="' + (c[2] || '') + '">' + c[1] + '</b></div>').join(''));
      const hdr = r.o.pos.firstChild;
      UI.text(hdr.children[1], 'x' + fmtLev(pos.lev));
      UI.text(hdr.children[2], U.dur(s.run.time - pos.opened));
      UI.cls(r.o.pos, 'danger', dist < 0.03 && liq > 0);
      if (r.o.sl && document.activeElement !== r.o.sl) r.o.sl.value = pos.sl ? U.price(pos.sl, dec) : '';
      if (r.o.tp && document.activeElement !== r.o.tp) r.o.tp.value = pos.tp ? U.price(pos.tp, dec) : '';
      if (r.o.trail) Array.from(r.o.trail.children).forEach((b) => UI.cls(b, 'on', +b.dataset.p === (pos.trail || 0)));
    }
    if (r.o.typeSeg) Array.from(r.o.typeSeg.children).forEach((b) => UI.cls(b, 'on', b.dataset.v === ordType));
    if (r.o.sideSeg) Array.from(r.o.sideSeg.children).forEach((b) => UI.cls(b, 'on', +b.dataset.v === ordSide));
    UI.html(r.o.foot, '<span data-tip="stat:manual.access">Position max <b>' + U.money(TE.Trading.maxNotional(id)) + '</b> de notionnel</span> · <span data-tip="stat:manual.payout">Bonus max par trade <b class="gold">' + U.money(TE.Trading.payoutCap()) + '</b></span> · <span data-tip="stat:manual.profit">Bonus <b>' + U.mult(TE.Trading.profitMult()) + '</b></span> · Emplacements ' + TE.Trading.openCount() + '/' + TE.Trading.slots() + ' · Frais ' + U.pct(TE.Trading.feeRate(), 3, false));
    // price flash on chart header
    const ch = TE.Market.change(id, 300);
    const def = D.ASSET_MAP[id];
    UI.html(r.title, '<b>' + id + '</b><span>' + def.name + '</span>');
    UI.text(r.price, U.price(mid, dec));
    r.price.className = 'mk-price ' + (mid > lastPrice ? 'tick-up' : mid < lastPrice ? 'tick-down' : '');
    lastPrice = mid;
    UI.html(r.chg, '<span class="' + UI.dir(ch) + '">' + (ch >= 0 ? '▲ ' : '▼ ') + U.pct(ch, 2) + '</span><small>5 min</small>');
    if (TE.Mods.has('ind.regime')) {
      const rv = TE.Market.regimeView(id);
      r.regime.hidden = false;
      UI.html(r.regime, '<span class="rg rg-' + rv.cls + '" data-tip="' + UI.esc('<div class="tt-title">' + rv.name + '</div><div class="tt-dim">' + rv.hint + '</div>') + '">' + rv.name.toUpperCase() + '</span>');
    } else r.regime.hidden = true;
    const lf = TE.Market.liqFactor(id);
    UI.html(r.liq, '<span class="lq-l">LIQUIDITÉ</span><span class="lq-bar"><i style="width:' + Math.min(100, lf / 1.3 * 100).toFixed(0) + '%" class="' + (lf < 0.6 ? 'lo' : lf < 0.85 ? 'mid' : '') + '"></i></span>');
    updateActors(id);
    // indicator toggles
    const indSig = ['sma', 'bb', 'rsi'].map((k) => TE.Mods.has('ind.' + k)).join() + s.settings.botMarkers;
    if (r.ind._sig !== indSig) {
      r.ind._sig = indSig;
      r.ind.innerHTML = '';
      [['sma', 'MM'], ['bb', 'BB'], ['rsi', 'RSI']].forEach(([k, l]) => {
        if (!TE.Mods.has('ind.' + k)) return;
        r.ind.appendChild(h('button', { text: l, data: { k }, on: { click: () => { chartPrefs()[k] = !chartPrefs()[k]; chart.draw(true); } } }));
      });
      if (TE.Bots.totalUnits() > 0) r.ind.appendChild(h('button', { text: 'BOTS', data: { k: 'bots' }, tip: 'Afficher les trades des bots sur le graphique', on: { click: () => { s.settings.botMarkers = !s.settings.botMarkers; } } }));
    }
    Array.from(r.ind.children).forEach((b) => UI.cls(b, 'on', b.dataset.k === 'bots' ? s.settings.botMarkers : !!chartPrefs()[b.dataset.k]));
    Array.from(r.tf.children).forEach((b) => UI.cls(b, 'on', +b.dataset.tf === (chartPrefs().tf || 1)));
  }

  /* ---------------- V2: market actors on the selected market ---------------- */
  let actT = 0;
  function updateActors(id) {
    const now = performance.now();
    if (now - actT < 450) return;
    actT = now;
    const p = TE.Agents.positioning(id);
    if (!p) return;
    const tot = Math.max(0.05, p.longs + p.shorts);
    const lp = p.longs / tot * 100;
    const risks = [];
    if (p.squeeze > 0.75) risks.push('<span class="rk ' + (p.squeeze >= 1 ? 'hot' : '') + '">⇈ SQUEEZE ' + U.pct(Math.min(1, p.squeeze), 0, false) + '</span>');
    if (p.cascade > 0.75) risks.push('<span class="rk ' + (p.cascade >= 1 ? 'hot' : '') + '">⇊ CASCADE ' + U.pct(Math.min(1, p.cascade), 0, false) + '</span>');
    if (p.mm < 0.8) risks.push('<span class="rk">MM EN RETRAIT</span>');
    let camp = '';
    if (p.campaign) camp = '<div class="ac-camp small">' + (p.campaign.who ? '⚔ ' + UI.esc((D.RIVAL_MAP[p.campaign.who] || {}).name || 'Un rival') : '🐋 Une baleine') + (p.campaign.dir > 0 ? ' achète' : ' vend') + ' massivement</div>';
    const top = p.groups.slice().sort((a, b) => Math.abs(b.x) - Math.abs(a.x)).slice(0, 3)
      .map((g) => '<span class="ac-g" style="--gc:' + g.color + '">' + g.short + ' <b class="' + (g.x > 0 ? 'up' : 'down') + '">' + (g.x > 0 ? '▲' : '▼') + U.pct(Math.abs(g.x), 0, false) + '</b></span>').join('');
    UI.html(r.actors, '<div class="ac-h"><span class="op-lbl">ACTEURS DU MARCHÉ</span><span class="ac-net ' + (p.net > 0.05 ? 'up' : p.net < -0.05 ? 'down' : 'dim') + '">' + (p.net > 0.05 ? 'ACHETEURS' : p.net < -0.05 ? 'VENDEURS' : 'ÉQUILIBRÉ') + '</span></div>' +
      '<div class="ac-bar"><i class="s" style="width:' + (100 - lp).toFixed(1) + '%"></i><i class="l" style="width:' + lp.toFixed(1) + '%"></i></div>' +
      '<div class="ac-top">' + top + '</div>' + (risks.length ? '<div class="ac-risk">' + risks.join('') + '</div>' : '') + camp);
  }

  /* ---------------- bottom: positions / orders / history ---------------- */
  let bottomSig = '';
  function renderBottom(force) {
    const s = S();
    const acct = s.run.account;
    Array.from(r.bottomTabs.children).forEach((b) => {
      UI.cls(b, 'on', b.dataset.t === bottomTab);
      const n = b.dataset.t === 'positions' ? TE.Trading.openCount() : b.dataset.t === 'orders' ? acct.orders.length : 0;
      b.textContent = TAB_FR[b.dataset.t] + (n ? ' (' + n + ')' : '');
    });
    r.closeAll.hidden = bottomTab !== 'positions' || TE.Trading.openCount() < 1;
    const sg = bottomTab + '|' + Object.keys(acct.positions).join(',') + '|' + acct.orders.map((o) => o.oid).join(',') + '|' + (acct.history[0] ? acct.history[0].id + acct.history[0].t : '');
    if (!force && sg === bottomSig) { updateBottomValues(); return; }
    bottomSig = sg;
    const body = r.bottomBody;
    body.innerHTML = '';
    if (bottomTab === 'positions') {
      const ids = Object.keys(acct.positions);
      if (!ids.length) { body.appendChild(h('div', { class: 'empty', text: 'Aucune position ouverte.' })); return; }
      const t = h('table', { class: 'tbl' });
      t.appendChild(h('tr', {}, ['Marché', 'Sens', 'Taille', 'Levier', 'Entrée', 'Prix', 'Liq.', 'PnL', 'Sur marge', 'Durée', ''].map((x) => h('th', { text: x }))));
      r.posRows = {};
      ids.forEach((id) => {
        const tr = h('tr', { class: 'clickable', on: { click: () => { s.run.activeAsset = id; } } });
        for (let i = 0; i < 10; i++) tr.appendChild(h('td'));
        tr.appendChild(h('td', {}, [h('button', { class: 'btn btn-ghost btn-xs', text: 'Fermer', on: { click: (e) => { e.stopPropagation(); TE.Trading.close(id, 'manual'); } } })]));
        r.posRows[id] = tr;
        t.appendChild(tr);
      });
      body.appendChild(t);
      updateBottomValues();
    } else if (bottomTab === 'orders') {
      if (!acct.orders.length) { body.appendChild(h('div', { class: 'empty', html: TE.Mods.has('ord.limit') ? 'Aucun ordre en attente.' : 'Les ordres limites et stop se débloquent avec les améliorations.' })); return; }
      const t = h('table', { class: 'tbl' });
      t.appendChild(h('tr', {}, ['Marché', 'Type', 'Sens', 'Déclencheur', 'Distance', 'Taille', 'Levier', ''].map((x) => h('th', { text: x }))));
      acct.orders.forEach((o) => {
        const mid = TE.Market.mid(o.asset);
        t.appendChild(h('tr', {}, [h('td', { text: o.asset }), h('td', { text: ORD_TYPE[o.type] + (o.oco ? ' · OCO' : '') }), h('td', { class: o.side > 0 ? 'up' : 'down', text: o.side > 0 ? 'ACHAT' : 'VENTE' }),
          h('td', { text: U.price(o.price) }), h('td', { text: U.pct(o.price / mid - 1, 2) }), h('td', { text: o.sizePct * 100 + ' %' }), h('td', { text: 'x' + o.lev }),
          h('td', {}, [h('button', { class: 'btn btn-ghost btn-xs', text: 'Annuler', on: { click: () => TE.Trading.cancelOrder(o.oid) } })])]));
      });
      body.appendChild(t);
    } else {
      const hist = acct.history.slice(0, 30);
      if (!hist.length) { body.appendChild(h('div', { class: 'empty', text: 'Aucun trade clôturé pour l’instant.' })); return; }
      const t = h('table', { class: 'tbl' });
      t.appendChild(h('tr', {}, ['Marché', 'Sens', 'Levier', 'Entrée → Sortie', 'PnL', 'Sur marge', 'Gliss.', 'Durée', 'Sortie'].map((x) => h('th', { text: x }))));
      hist.forEach((x) => {
        t.appendChild(h('tr', {}, [h('td', { text: x.asset }), h('td', { class: x.side > 0 ? 'up' : 'down', text: x.side > 0 ? 'LONG' : 'SHORT' }), h('td', { text: 'x' + fmtLev(x.lev) }),
          h('td', { text: U.price(x.entry) + ' → ' + U.price(x.exit) }), h('td', { class: UI.dir(x.total), html: U.smoney(x.total) + (x.crit ? ' <span class="gold">×' + U.fmt(x.crit, { dec: 0 }) + '</span>' : '') + (x.gap ? ' <span class="down" title="Perte au-delà de la marge">GAP</span>' : '') }),
          h('td', { class: UI.dir(x.total), text: U.pct(x.pct, 1) }), h('td', { class: 'dim', text: x.slip ? U.pct(x.slip, 2, false) : '—' }), h('td', { text: U.dur(x.dur) }), h('td', { class: 'dim', text: REASON_FR[x.reason] || x.reason.toUpperCase() })]));
      });
      body.appendChild(t);
    }
  }
  function updateBottomValues() {
    if (bottomTab !== 'positions' || !r.posRows) return;
    const s = S();
    Object.keys(r.posRows).forEach((id) => {
      const p = s.run.account.positions[id];
      if (!p) return;
      const tr = r.posRows[id];
      const u = TE.Trading.upnl(id) - p.fees;
      const liq = TE.Trading.liqPrice(p);
      const vals = [id, p.side > 0 ? 'LONG' : 'SHORT', U.money(p.notional), 'x' + fmtLev(p.lev), U.price(p.entry), U.price(TE.Market.mid(id)), liq > 0 ? U.price(liq) : '—', U.smoney(u), U.pct(u / p.margin, 1), U.dur(s.run.time - p.opened)];
      vals.forEach((v, i) => UI.text(tr.children[i], v));
      tr.children[1].className = p.side > 0 ? 'up' : 'down';
      tr.children[7].className = tr.children[8].className = UI.dir(u);
      UI.cls(tr, 'sel', id === s.run.activeAsset);
    });
  }

  /* ---------------- desk: abilities + fleet ---------------- */
  let abilSig = '';
  function renderDesk() {
    const s = S();
    const unlocked = D.ABILITIES.filter((a) => TE.Events.abilityUnlocked(a));
    const sg = unlocked.map((a) => a.id).join(',');
    if (sg !== abilSig) {
      abilSig = sg;
      r.abil.innerHTML = '';
      r.abilBtns = {};
      if (!unlocked.length) r.abil.appendChild(h('div', { class: 'dim small', text: 'Les capacités se débloquent via les améliorations et la recherche.' }));
      unlocked.forEach((a) => {
        const b = h('button', { class: 'ability', tip: '<div class="tt-title">' + a.name + ' <kbd>' + a.key + '</kbd></div><div>' + a.desc + '</div><div class="tt-dim">Recharge : ' + U.dur(a.cd) + '</div>', on: { click: () => TE.Events.useAbility(a.id) } }, [
          h('span', { class: 'ab-i', text: a.icon }), h('span', { class: 'ab-n', text: a.name }), h('kbd', { text: a.key }), h('span', { class: 'ab-cd' }),
        ]);
        r.abilBtns[a.id] = b;
        r.abil.appendChild(b);
      });
    }
    unlocked.forEach((a) => {
      const b = r.abilBtns[a.id];
      const left = TE.Events.abilityLeft(a);
      UI.cls(b, 'cooling', left > 0);
      b.style.setProperty('--cd', (left / a.cd * 360).toFixed(0) + 'deg');
      UI.text(b.children[3], left > 0 ? Math.ceil(left) + ' s' : '');
    });
    // fleet summary
    const rows = TE.Economy.breakdown().sort((a, b) => b.v - a.v).slice(0, 5);
    const tot = TE.Economy.passive();
    const html = rows.length ? '<div class="fm-tot">Revenu passif <b class="up">' + U.money(tot) + '/s</b></div>' + rows.map((x) => '<div class="fm-row"><span><i class="dot" style="background:' + x.color + '"></i>' + UI.esc(x.name) + '</span><b>' + U.money(x.v) + '/s</b><div class="fm-bar"><i style="width:' + (tot > 0 ? Math.max(2, x.v / tot * 100) : 0).toFixed(1) + '%;background:' + x.color + '"></i></div></div>').join('')
      : '<div class="dim small">' + (s.profile.features.bots ? 'Aucun bot déployé. Les bots tradent pendant que vous surveillez le graphique.' : 'Gagnez de l’argent en tradant. L’automatisation viendra ensuite.') + '</div>';
    UI.html(r.fleet, html);
    UI.show(r.loan, TE.Trading.canFamilyLoan());
  }

  TE.UI.views.market = {
    build,
    update() {
      if (!r.order) return;
      renderAssets(false);
      renderOrderPanel(false);
      updateOrderPanel();
      renderBottom(false);
      renderDesk();
    },
    frame() { if (chart) chart.draw(false); },
    onShow() { if (chart) { chart.readColors(); chart.resize(); chart.draw(true); } },
  };
})(window.TE);
