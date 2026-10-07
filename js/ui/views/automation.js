/* BOTS (visible strategy fleets) and INFRASTRUCTURE views. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const S = () => TE.state;

  /* =============================== BOTS =============================== */
  const B = {};
  function botsBuild(root) {
    root.innerHTML = '';
    B.kpi = {};
    const kpis = h('div', { class: 'kpis' });
    [['inc', 'Revenu de la flotte', 'fn:income'], ['real', 'Réalisé (30 s)', null], ['units', 'Unités déployées', null], ['cap', 'Capital déployé', 'stat:bot.all.capital'], ['win', 'Taux de réussite', 'stat:bot.all.winrate'], ['speed', 'Vitesse des bots', 'stat:bot.all.speed'], ['profit', 'Mult. de profit', 'stat:bot.all.profit']]
      .forEach(([k, l, tip]) => { const el = UI.kv(l, tip); B.kpi[k] = el._v; kpis.appendChild(el); });
    B.risk = h('div', { class: 'seg', id: 'risk-seg' });
    B.buyMode = UI.buyModeSeg();
    B.auto = h('label', { class: 'toggle', hidden: true }, [h('input', { type: 'checkbox', on: { change: (e) => { S().settings.autoBuy.bots = e.target.checked; } } }), h('span', { text: 'Achat auto' })]);
    B.disabled = h('div', { class: 'banner-inline warn', hidden: true, text: 'Défi SANS BOTS : les bots de trading sont désactivés pour cette partie. Votre desk humain continue de trader.' });
    B.sat = UI.satMeter();
    root.appendChild(h('div', { class: 'card' }, [
      h('div', { class: 'card-h' }, [h('span', { text: 'Flotte de stratégies' }), h('div', { class: 'card-tools' }, [B.auto, B.buyMode])]),
      kpis,
      B.sat,
      h('div', { class: 'risk-row' }, [h('div', { class: 'op-lbl', text: 'APPÉTIT POUR LE RISQUE' }), B.risk, B.riskDesc = h('div', { class: 'dim small' })]),
      B.disabled,
    ]));
    B.mix = h('div', { class: 'mix-bar' });
    B.mixLegend = h('div', { class: 'mix-legend' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Profit par stratégie' }), h('span', { class: 'card-hr dim', text: '$/s attendus' })]), B.mix, B.mixLegend]));
    B.grid = h('div', { class: 'bot-grid' });
    root.appendChild(B.grid);
    B.sig = '';
  }
  function riskRender() {
    const s = S();
    const opts = [];
    const dial = TE.Mods.has('risk.dial');
    if (dial) opts.push('conservative');
    opts.push('balanced');
    if (dial) opts.push('aggressive');
    if (TE.Mods.has('risk.degenerate')) opts.push('degenerate');
    const sig = opts.join(',') + s.run.challenge;
    if (B.risk._sig !== sig) {
      B.risk._sig = sig;
      B.risk.innerHTML = '';
      if (s.run.challenge === 'noleverage') { B.risk.appendChild(h('button', { class: 'on', text: 'PRUDENT (verrouillé)' })); return; }
      opts.forEach((k) => B.risk.appendChild(h('button', { text: D.RISK_PROFILES[k].name.toUpperCase(), data: { k }, class: k === 'degenerate' ? 'danger' : '', on: { click: () => { s.run.risk = k; TE.Audio.play('click'); } } })));
    }
    Array.from(B.risk.children).forEach((b) => { if (b.dataset.k) UI.cls(b, 'on', b.dataset.k === s.run.risk); });
    UI.text(B.riskDesc, TE.Bots.riskProfile().desc + (dial ? '' : ' (d’autres profils se débloquent avec l’amélioration « Sélecteur de risque »)'));
  }
  function cardFor(id) {
    const def = D.BOT_MAP[id];
    const c = { id };
    c.el = h('div', { class: 'card bot-card', style: '--bc:' + def.color });
    c.name = h('div', { class: 'bc-name' }, [h('span', { class: 'bc-ic', text: def.icon }), h('b', { text: def.name }), c.grade = h('span', { class: 'grade' }), c.ver = h('span', { class: 'dim small' })]);
    c.count = h('div', { class: 'bc-count' });
    c.pause = h('button', { class: 'btn btn-ghost btn-xs', tip: 'Coupe-circuit : mettre en pause / relancer cette flotte', on: { click: () => {
      const st = TE.Bots.st(id); st.paused = !st.paused;
      if (st.paused && TE.Events.botBugged(id)) TE.Stats.add('killSwitch');
      TE.Audio.play('click');
    } } });
    if (id === 'desk') c.pause.hidden = true;
    c.el.appendChild(h('div', { class: 'bc-h' }, [c.name, h('div', { class: 'bc-hr' }, [c.count, c.pause])]));
    c.el.appendChild(h('div', { class: 'bc-desc dim', text: def.desc }));
    c.fit = h('div', { class: 'bc-fit' });
    c.el.appendChild(c.fit);
    c.expo = h('div', { class: 'bc-expo', tip: '<div class="tt-title">Exposition de la flotte</div><div class="tt-dim">Positions agrégées de la flotte par marché (LONG ▲ / SHORT ▼), capital des investisseurs du fonds compris. Les bots d’arbitrage restent neutres.</div>' });
    c.el.appendChild(c.expo);
    c.stats = h('div', { class: 'bc-stats' });
    c.el.appendChild(c.stats);
    c.ms = h('div', { class: 'bc-ms' });
    c.msBar = UI.pbar('thin');
    c.el.appendChild(h('div', {}, [c.ms, c.msBar]));
    c.spark = UI.spark(200, 34);
    c.trades = h('div', { class: 'bc-trades' });
    c.el.appendChild(h('div', { class: 'bc-bottom' }, [c.trades, h('div', { class: 'bc-spark' }, [c.spark])]));
    c.bug = h('div', { class: 'bc-bug', hidden: true, text: '🐞 BUG QUANT — cette flotte perd de l’argent. Mettez-la en pause !' });
    c.el.appendChild(c.bug);
    if (id !== 'desk') {
      c.buy = UI.costBtn('DÉPLOYER', () => {
        const q = quote(id);
        return TE.Bots.buy(id, q.qty);
      });
      c.el.appendChild(c.buy);
    } else {
      c.el.appendChild(h('button', { class: 'btn btn-ghost wide', text: 'Embaucher des traders dans EMPLOYÉS →', on: { click: () => UI.go('staff') } }));
    }
    return c;
  }
  function quote(id) {
    const def = D.BOT_MAP[id];
    return TE.Economy.quote(def.cost * TE.Bots.costMult(), def.growth, TE.Bots.count(id));
  }
  function botsUpdate() {
    const s = S();
    if (!B.grid) return;
    const exp = TE.Bots.expected();
    const passive = TE.Economy.passive();
    riskRender();
    B.buyMode._update();
    B.auto.hidden = !TE.Prestige.lperk('autobots');
    B.auto.firstChild.checked = !!s.settings.autoBuy.bots;
    B.disabled.hidden = !TE.Bots.disabled();
    B.sat._update();
    UI.text(B.kpi.inc, U.money(exp.total) + '/s');
    UI.text(B.kpi.real, U.smoney(TE.Economy.realizedBots()) + '/s');
    UI.text(B.kpi.units, U.int(TE.Bots.totalUnits()));
    UI.text(B.kpi.cap, U.money(TE.Bots.totalCap()) + (TE.Fund.active() ? ' + ' + U.money(TE.Fund.deployed()) + ' AUM' : ''));
    UI.text(B.kpi.win, U.pct(TE.Mods.get('bot.all.winrate'), 1));
    UI.text(B.kpi.speed, U.mult(TE.Mods.get('bot.all.speed')));
    UI.text(B.kpi.profit, U.mult(TE.Mods.get('bot.all.profit') * TE.Economy.globalMult()));
    // mix
    const rows = TE.Economy.breakdown().filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const tot = rows.reduce((a, x) => a + x.v, 0);
    const mixSig = rows.map((x) => x.id).join(',');
    if (B.mix._sig !== mixSig) {
      B.mix._sig = mixSig;
      B.mix.innerHTML = ''; B.mixLegend.innerHTML = '';
      B.mixParts = {};
      rows.forEach((x) => {
        const seg = h('i', { style: 'background:' + x.color, tip: x.name });
        const lg = h('div', { class: 'ml' }, [h('i', { class: 'dot', style: 'background:' + x.color }), h('span', { text: x.name }), h('b'), h('span', { class: 'dim' })]);
        B.mixParts[x.id] = { seg, lg };
        B.mix.appendChild(seg); B.mixLegend.appendChild(lg);
      });
      if (!rows.length) B.mixLegend.appendChild(h('div', { class: 'dim small', text: 'Déployez votre premier bot pour commencer à générer un revenu passif.' }));
    }
    rows.forEach((x) => {
      const p = B.mixParts[x.id];
      if (!p) return;
      p.seg.style.width = (x.v / tot * 100).toFixed(2) + '%';
      UI.text(p.lg.children[2], U.money(x.v) + '/s');
      UI.text(p.lg.children[3], U.pct(x.v / tot, 1, false));
    });
    // cards
    const ids = D.BOTS.filter((b) => TE.Bots.unlocked(b.id)).map((b) => b.id);
    if (TE.Bots.count('desk') > 0) ids.push('desk');
    const next = D.BOTS.find((b) => !TE.Bots.unlocked(b.id));
    const sig = ids.join(',') + '|' + (next ? next.id : '');
    if (sig !== B.sig) {
      B.sig = sig;
      B.grid.innerHTML = '';
      B.cards = {};
      ids.forEach((id) => { const c = cardFor(id); B.cards[id] = c; B.grid.appendChild(c.el); });
      if (next) {
        B.teaser = h('div', { class: 'card bot-card locked' }, [h('div', { class: 'bc-h' }, [h('div', { class: 'bc-name' }, [h('span', { class: 'bc-ic', text: '?' }), h('b', { text: 'Stratégie classifiée' })])]),
          h('div', { class: 'dim', html: 'Se débloque après <b>' + U.money(next.unlockEarn) + '</b> générés dans la partie.' }), UI.pbar()]);
        B.grid.appendChild(B.teaser);
      } else B.teaser = null;
    }
    if (B.teaser && next) B.teaser.lastChild._set(s.run.earnings / next.unlockEarn);
    ids.forEach((id) => updateCard(B.cards[id], exp, passive));
  }
  function updateCard(c, exp, passive) {
    const s = S();
    const id = c.id;
    const def = D.BOT_MAP[id];
    const st = TE.Bots.st(id);
    const n = TE.Bots.count(id);
    const x = TE.Bots.stats(id);
    if (id !== 'desk') {
      const g = TE.Bots.grade(id);
      UI.text(c.grade, g.name.toUpperCase());
      c.grade.style.color = g.color; c.grade.style.borderColor = g.color;
      const v = 1 + D.UPGRADES.filter((u) => u.bot === id && s.run.upgrades[u.id]).length;
      UI.text(c.ver, 'v' + v + '.0');
    } else { UI.text(c.grade, 'HUMAIN'); }
    UI.html(c.count, '<b>' + U.int(n) + '</b><span>' + (id === 'desk' ? 'traders' : 'unités') + '</span>');
    UI.text(c.pause, st.paused ? '▶ RELANCER' : '❚❚ PAUSE');
    UI.cls(c.el, 'paused', !!st.paused);
    const bugged = TE.Events.botBugged(id);
    UI.show(c.bug, bugged && !st.paused);
    UI.cls(c.el, 'bugged', bugged && !st.paused);
    // market fit
    const aff = x.env.aff;
    UI.html(c.fit, '<span class="dim">' + (def.fit || '') + '</span><span class="fit ' + (aff > 0.005 ? 'up' : aff < -0.005 ? 'down' : 'flat') + '">' + (aff > 0.005 ? '▲ FAVORABLE' : aff < -0.005 ? '▼ HOSTILE' : '■ NEUTRE') + ' ' + U.pct(aff, 1) + ' TR</span>');
    const ex = TE.Bots.exposure(id).slice(0, 4);
    UI.html(c.expo, ex.length ? '<span>EXPO.</span>' + ex.map((e) => '<span>' + e.asset + ' <b class="' + (e.v > 0 ? 'up' : 'down') + '">' + (e.v > 0 ? '▲' : '▼') + U.money(Math.abs(e.v)) + '</b></span>').join('') : (def.style === 'arb' && n > 0 ? '<span>EXPO. neutre (arbitrage)</span>' : ''));
    const inc = exp.byId[id] || 0;
    const share = passive > 0 ? inc / passive : 0;
    const tradesMin = 60 / x.interval;
    const cells = [
      ['Revenu', U.money(inc) + '/s', 'up', 'stat:bot.' + id + '.profit'],
      ['Part', U.pct(share, 1, false), '', null],
      ['Capital/unité', U.money(x.cap), '', 'stat:bot.' + id + '.capital'],
      ['Trades', tradesMin >= 10 ? U.fmt(tradesMin, { dec: 0 }) + '/min' : 'toutes les ' + x.interval.toFixed(1).replace('.', ',') + ' s', '', 'stat:bot.' + id + '.speed'],
      ['Réussite', U.pct(x.p, 1, false), '', 'stat:bot.' + id + '.winrate'],
      ['Gain / perte moy.', U.pct(x.win, 2) + ' / ' + U.pct(-x.loss, 2), '', 'stat:bot.' + id + '.win'],
      ['Avantage/trade', U.pct(x.evPct * x.lev, 3), x.evPct > 0 ? 'up' : 'down', null],
      ['Critique', U.pct(x.crit, 1, false), 'gold', 'stat:bot.all.crit'],
      ['PnL net', U.smoney(st.pnl), UI.dir(st.pnl), null],
      ['G / P', U.int(st.wins) + ' / ' + U.int(st.losses), '', null],
    ];
    if (!c.cells) {
      c.cells = cells.map((cl) => { const d = h('div', { tip: cl[3] || undefined }, [h('span', { text: cl[0] }), h('b')]); c.stats.appendChild(d); return d; });
    }
    cells.forEach((cl, i) => { UI.text(c.cells[i].children[1], cl[1]); c.cells[i].children[1].className = cl[2]; });
    // milestone
    if (id !== 'desk') {
      const ms = x.ms;
      if (ms.next) {
        const prev = D.BOT_MILESTONES.filter((m) => m.n <= n).pop();
        const from = prev ? prev.n : 0;
        UI.html(c.ms, 'Prochain palier : <b>' + ms.next.n + ' unités</b> → ' + (ms.next.profit ? 'profit ×' + ms.next.profit : 'vitesse ×' + ms.next.speed) + ' <span class="dim">(actuel : profit ' + U.mult(ms.profit) + ', vitesse ' + U.mult(ms.speed) + ')</span>');
        c.msBar._set((n - from) / (ms.next.n - from));
      } else { UI.html(c.ms, 'Tous les paliers sont atteints. <span class="gold">' + U.mult(ms.profit) + '</span>'); c.msBar._set(1); }
    } else {
      UI.html(c.ms, 'Profit du desk ' + U.mult(TE.Mods.get('staff.desk')) + ' — un junior compte pour 1, un senior pour 6.');
      c.msBar._set(0);
    }
    // recent trades
    const hist = st.hist.slice(-4).reverse();
    const tsig = hist.length ? hist[0].t + ':' + hist.length : '';
    if (c.trades._sig !== tsig) {
      c.trades._sig = tsig;
      c.trades.innerHTML = hist.map((e) => '<div class="bt ' + UI.dir(e.pnl) + '"><span>' + e.a + ' ' + (e.arb ? '⇋' : e.side > 0 ? '▲' : '▼') + '</span><span>' + U.pct(e.pct, 2) + '</span><b>' + U.smoney(e.pnl) + '</b>' + (e.crit ? '<i class="gold">×' + U.fmt(e.crit, { dec: 0 }) + '</i>' : '') + '</div>').join('') || '<div class="dim small">Aucun trade pour l’instant.</div>';
      c.spark._set(st.spark.concat([st.pnl]), st.pnl >= 0);
    }
    if (c.buy) {
      const q = quote(id);
      c.buy._set(TE.Bots.disabled() ? 'DÉSACTIVÉ' : 'DÉPLOYER ×' + U.int(q.qty), q.cost, q.afford && !TE.Bots.disabled());
    }
  }
  UI.views.bots = { build: botsBuild, update: botsUpdate };

  /* =============================== INFRASTRUCTURE =============================== */
  const I = {};
  function infraBuild(root) {
    root.innerHTML = '';
    I.kpi = {};
    const kpis = h('div', { class: 'kpis' });
    [['lat', 'Latence', 'stat:latency'], ['comp', 'Puissance de calcul', null], ['power', 'Puissance infra', 'stat:infra.power'], ['speed', 'Vitesse des bots', 'stat:bot.all.speed'], ['cap', 'Capital des bots', 'stat:bot.all.capital']]
      .forEach(([k, l, tip]) => { const el = UI.kv(l, tip); I.kpi[k] = el._v; kpis.appendChild(el); });
    I.buyMode = UI.buyModeSeg();
    I.room = h('div', { class: 'server-room' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Infrastructure' }), h('div', { class: 'card-tools' }, [I.buyMode])]), kpis, I.room]));
    I.list = h('div', { class: 'item-grid' });
    root.appendChild(I.list);
    I.sig = '';
  }
  function infraUpdate() {
    const s = S();
    if (!I.list) return;
    I.buyMode._update();
    UI.text(I.kpi.lat, TE.Firm.fmtLatency(TE.Firm.latency()));
    UI.text(I.kpi.comp, TE.Firm.fmtCompute(TE.Firm.compute()));
    UI.text(I.kpi.power, U.mult(TE.Mods.get('infra.power')));
    UI.text(I.kpi.speed, U.mult(TE.Mods.get('bot.all.speed')));
    UI.text(I.kpi.cap, U.mult(TE.Mods.get('bot.all.capital')));
    // server room lights
    let units = 0;
    D.INFRA.forEach((x, i) => { units += TE.Firm.infraCount(x.id) * (1 + i * 0.6); });
    const racks = Math.min(48, Math.ceil(units / 2));
    if (I.room._n !== racks) {
      I.room._n = racks;
      I.room.innerHTML = '';
      if (!racks) I.room.appendChild(h('div', { class: 'dim small', text: 'Votre « centre de données » est pour l’instant un portable posé sur un lit.' }));
      for (let i = 0; i < racks; i++) {
        const rack = h('div', { class: 'rack' });
        for (let j = 0; j < 6; j++) rack.appendChild(h('i', { style: 'animation-delay:' + (Math.random() * 2).toFixed(2) + 's;animation-duration:' + (0.6 + Math.random() * 1.8).toFixed(2) + 's' }));
        I.room.appendChild(rack);
      }
    }
    const items = D.INFRA.filter((x) => TE.Firm.infraUnlocked(x));
    const sig = items.map((x) => x.id).join(',');
    if (sig !== I.sig) {
      I.sig = sig;
      I.list.innerHTML = '';
      I.cards = {};
      items.forEach((x) => {
        const c = {};
        c.el = h('div', { class: 'card item' }, [
          h('div', { class: 'it-h' }, [h('span', { class: 'it-ic', text: x.icon }), h('b', { text: x.name }), c.count = h('span', { class: 'it-count' })]),
          h('div', { class: 'dim small', text: x.desc }),
          c.fx = h('div', { class: 'it-fx' }),
          c.buy = UI.costBtn('ACHETER', () => { const q = TE.Firm.infraQuote(x.id); return TE.Firm.buyInfra(x.id, q.qty); }),
        ]);
        I.cards[x.id] = c;
        I.list.appendChild(c.el);
      });
      const nx = D.INFRA.find((x) => !TE.Firm.infraUnlocked(x));
      if (nx) I.list.appendChild(h('div', { class: 'card item locked' }, [h('div', { class: 'it-h' }, [h('span', { class: 'it-ic', text: '?' }), h('b', { text: 'Matériel de nouvelle génération' })]), h('div', { class: 'dim small', text: 'Disponible à mesure que votre société grandit (' + U.money(nx.cost * 0.25) + ' générés).' })]));
    }
    const ip = TE.Mods.get('infra.power');
    items.forEach((x) => {
      const c = I.cards[x.id];
      const n = TE.Firm.infraCount(x.id);
      UI.text(c.count, x.max ? n + '/' + x.max : '×' + U.int(n));
      const per = x.effects.map((e) => (e.add !== undefined ? TE.Mods.describe({ stat: e.stat, add: e.add * ip }) : TE.Mods.describe(e))).join(' · ');
      const lat = x.latency !== 1 ? ' · latence ' + U.mult(x.latency) : '';
      UI.html(c.fx, '<span class="dim">Par unité :</span> ' + per + lat);
      const q = TE.Firm.infraQuote(x.id);
      if (q.maxed) c.buy._set('AU MAXIMUM', 0, false, { costText: '—' });
      else c.buy._set('ACHETER ×' + q.qty, q.cost, q.afford);
    });
  }
  UI.views.infra = { build: infraBuild, update: infraUpdate };
})(window.TE);
