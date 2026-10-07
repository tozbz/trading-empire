/* UPGRADES, RESEARCH tree and STAFF / headquarters views. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const S = () => TE.state;

  const FLAG_TEXT = {
    'lev.': 'Débloque le levier x', 'ind.sma': 'Graphique : SMA 20 / 50', 'ind.bb': 'Graphique : bandes de Bollinger', 'ind.rsi': 'Graphique : panneau RSI', 'ind.regime': 'Graphique : classification des régimes',
    'ind.forecast': 'Graphique : prévision de direction à 10 s', 'ind.news': 'Fil d’actualités : étiquettes haussier / baissier', 'ord.sltp': 'Stop Loss et Take Profit', 'ord.trail': 'Trailing stops',
    'ord.limit': 'Ordres limites', 'ord.stop': 'Ordres stop d’entrée', 'ord.oco': 'Encadrements OCO', 'risk.dial': 'Profils de risque pour les bots', 'risk.degenerate': 'Profil de risque Dégénéré',
    'ab.focus': 'Capacité : Concentration absolue', 'ab.overclock': 'Capacité : Overclocking', 'ab.liquidity': 'Capacité : Injection de liquidités', 'ab.hype': 'Capacité : Campagne de hype',
    'ab.shortreport': 'Capacité : Rapport short', 'ab.rate': 'Capacité : Décision de taux', 'bot.synergy': 'Bonus de synergie de flotte', 'liq.refund': 'Les liquidations remboursent 15 %',
  };
  function flagText(f) {
    if (f.indexOf('lev.') === 0) return 'Débloque le levier x' + U.fmt(+f.slice(4), { dec: 0 });
    if (f.indexOf('asset.') === 0) return 'Nouveau marché : ' + f.slice(6);
    return FLAG_TEXT[f] || f;
  }
  UI.effectLines = function (effects) {
    return effects.map((e) => (e.flag ? flagText(e.flag) : TE.Mods.describe(e))).filter(Boolean);
  };

  /* =============================== UPGRADES =============================== */
  const Up = { filter: 'all' };
  /* V2: filters by what an upgrade actually does (built from its effects, not from a hand-made list). */
  const UP_FILTERS = [['all', 'TOUT'], ['trading', 'TRADING'], ['bots', 'BOTS'], ['capacity', 'CAPACITÉ'], ['fund', 'FONDS'], ['research', 'RECHERCHE'], ['risk', 'RISQUE'], ['influence', 'INFLUENCE'], ['unlock', 'DÉBLOCAGES'], ['afford', 'ABORDABLE']];
  UI.effectMatch = function (effects, cat, f) {
    if (f === 'all') return true;
    const st = effects.map((e) => e.stat || '');
    const has = (re) => st.some((x) => re.test(x));
    switch (f) {
      case 'trading': return cat === 'trading' || has(/^(manual\.|spread|crit\.|combo)/);
      case 'bots': return cat === 'bots' || cat === 'automation' || has(/^bot\./);
      case 'capacity': return has(/^(alpha\.capacity|fund\.capacity|staff\.cap|manual\.access|manual\.desk)$/);
      case 'fund': return cat === 'fund' || has(/^fund\./);
      case 'research': return has(/^research\.rate$/);
      case 'risk': return has(/loss|tail|^event\.|withdraw|^reg\.|mmr/) || effects.some((e) => e.flag === 'ord.sltp' || e.flag === 'ord.trail' || e.flag === 'liq.refund');
      case 'influence': return has(/^(influence|rep\.|news\.lead|macro\.bull|att\.gain|reg\.)/);
      case 'unlock': return effects.some((e) => e.flag);
      default: return true;
    }
  };
  const gainCache = {};
  function cachedGain(key, effects, cat) {
    const now = performance.now();
    const c = gainCache[key];
    if (c && now - c.t < 2500) return c.w;
    const w = UI.gainInfo(effects, cat);
    gainCache[key] = { t: now, w };
    return w;
  }
  function upBuild(root) {
    root.innerHTML = '';
    Up.filters = h('div', { class: 'seg upg-filters' });
    UP_FILTERS.forEach(([k, l]) => Up.filters.appendChild(h('button', { text: l, data: { c: k }, on: { click: () => { Up.filter = k; Up.sig = ''; } } })));
    Up.auto = h('label', { class: 'toggle', hidden: true }, [h('input', { type: 'checkbox', on: { change: (e) => { S().settings.autoBuy.upgrades = e.target.checked; } } }), h('span', { text: 'Achat auto' })]);
    Up.count = h('span', { class: 'card-hr dim' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Améliorations' }), Up.count]), h('div', { class: 'filters' }, [Up.filters, Up.auto]),
      h('div', { class: 'dim small', text: 'Sous chaque amélioration de revenus : le gain réel estimé maintenant, saturation comprise. Survolez-le pour voir le bonus théorique.' })]));
    Up.grid = h('div', { class: 'upg-grid' });
    root.appendChild(Up.grid);
    Up.owned = h('details', { class: 'card owned' }, [h('summary', { text: 'Améliorations achetées' }), Up.ownedList = h('div', { class: 'owned-list' })]);
    root.appendChild(Up.owned);
    Up.sig = '';
  }
  function upUpdate() {
    const s = S();
    if (!Up.grid) return;
    const list = TE.Upgrades.list();
    Array.from(Up.filters.children).forEach((b) => {
      UI.cls(b, 'on', b.dataset.c === Up.filter);
      const n = b.dataset.c === 'all' ? list.length : list.filter((u) => b.dataset.c === 'afford' ? TE.Economy.canAfford(u.cost) : UI.effectMatch(u.effects, u.cat, b.dataset.c)).length;
      b.disabled = n === 0 && b.dataset.c !== 'all';
    });
    Up.auto.hidden = !TE.Prestige.lperk('autoupg');
    Up.auto.firstChild.checked = !!s.settings.autoBuy.upgrades;
    let shown = list.filter((u) => Up.filter === 'afford' ? TE.Economy.canAfford(u.cost) : UI.effectMatch(u.effects, u.cat, Up.filter));
    shown = shown.slice(0, 60);
    const sig = shown.map((u) => u.id).join(',');
    UI.text(Up.count, Object.keys(s.run.upgrades).length + ' possédées · ' + list.length + ' disponibles');
    if (sig !== Up.sig) {
      Up.sig = sig;
      Up.grid.innerHTML = '';
      Up.cards = {};
      if (!shown.length) Up.grid.appendChild(h('div', { class: 'empty card', text: 'Rien à acheter pour le moment. Continuez à grandir : de nouvelles améliorations apparaissent au fil de votre progression.' }));
      shown.forEach((u) => {
        const cat = D.UPGRADE_CATS[u.cat];
        const c = {};
        c.btn = UI.costBtn('ACHETER', () => TE.Upgrades.buy(u.id));
        c.gain = h('div', { class: 'upg-gain' });
        c.el = h('div', { class: 'card upg', style: '--uc:' + cat.color }, [
          h('div', { class: 'upg-h' }, [h('span', { class: 'tag', text: cat.name }), h('b', { text: u.name })]),
          h('div', { class: 'upg-fx', html: UI.effectLines(u.effects).map((t) => '<div>◆ ' + UI.esc(t) + '</div>').join('') }),
          c.gain,
          h('div', { class: 'dim small', text: u.desc }),
          c.btn,
        ]);
        Up.cards[u.id] = c;
        Up.grid.appendChild(c.el);
      });
      const owned = Object.keys(s.run.upgrades).map((id) => D.UPGRADE_MAP[id]).filter(Boolean);
      Up.ownedList.innerHTML = owned.map((u) => '<span class="owned-item" title="' + UI.esc(UI.effectLines(u.effects).join(' · ')) + '">' + UI.esc(u.name) + '</span>').join('');
    }
    shown.forEach((u) => {
      const c = Up.cards[u.id];
      if (!c) return;
      c.btn._set('ACHETER', u.cost, TE.Economy.canAfford(u.cost));
      UI.html(c.gain, UI.gainHtml(cachedGain('u:' + u.id, u.effects, 'Upgrades'), true));
    });
  }
  UI.views.upgrades = { build: upBuild, update: upUpdate };

  /* =============================== RESEARCH =============================== */
  const R = {};
  const NW = 172, NH = 76, GX = 20, GY = 26;
  function resBuild(root) {
    root.innerHTML = '';
    R.kpi = {};
    const kpis = h('div', { class: 'kpis' });
    [['rp', 'Points de recherche', null], ['rate', 'RP / s', 'stat:research.rate'], ['done', 'Recherches terminées', null]].forEach(([k, l, tip]) => { const el = UI.kv(l, tip); R.kpi[k] = el._v; kpis.appendChild(el); });
    R.auto = h('label', { class: 'toggle', hidden: true }, [h('input', { type: 'checkbox', on: { change: (e) => { S().settings.autoBuy.research = e.target.checked; } } }), h('span', { text: 'Recherche auto' })]);
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Laboratoire de recherche' }), h('div', { class: 'card-tools' }, [R.auto])]), kpis,
      h('div', { class: 'dim small', text: 'Les points de recherche proviennent de vos revenus, de vos quants et de chaque trade clôturé. Les technologies restent acquises pour toute la partie.' })]));
    const cols = D.RESEARCH_BRANCHES.length;
    const maxRow = Math.max.apply(null, D.RESEARCH.map((n) => n.row)) + 1;
    const W = cols * (NW + GX), H = maxRow * (NH + GY) + 40;
    R.tree = h('div', { class: 'tree', style: 'width:' + W + 'px;height:' + H + 'px' });
    const ns = 'http://www.w3.org/2000/svg';
    R.svg = document.createElementNS(ns, 'svg');
    R.svg.setAttribute('class', 'tree-lines');
    R.svg.setAttribute('width', W); R.svg.setAttribute('height', H);
    R.tree.appendChild(R.svg);
    const colOf = {};
    D.RESEARCH_BRANCHES.forEach((b, i) => {
      colOf[b.id] = i;
      R.tree.appendChild(h('div', { class: 'tree-col', style: 'left:' + i * (NW + GX) + 'px;width:' + NW + 'px;--brc:' + b.color, text: b.name.toUpperCase() }));
    });
    const pos = (n) => ({ x: colOf[n.br] * (NW + GX), y: 34 + n.row * (NH + GY) });
    R.nodes = {};
    R.lines = [];
    D.RESEARCH.forEach((n) => {
      const p = pos(n);
      n.req.forEach((rid) => {
        const par = D.RESEARCH_MAP[rid];
        const pp = pos(par);
        const x1 = pp.x + NW / 2, y1 = pp.y + NH, x2 = p.x + NW / 2, y2 = p.y;
        const path = document.createElementNS(ns, 'path');
        const my = (y1 + y2) / 2;
        path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2);
        path.setAttribute('class', 'tl' + (par.br !== n.br ? ' cross' : ''));
        R.svg.appendChild(path);
        R.lines.push({ path, a: rid, b: n.id });
      });
    });
    D.RESEARCH.forEach((n) => {
      const p = pos(n);
      const br = D.RESEARCH_BRANCHES[colOf[n.br]];
      const el = h('button', { class: 'rnode', style: 'left:' + p.x + 'px;top:' + p.y + 'px;width:' + NW + 'px;height:' + NH + 'px;--brc:' + br.color, tip: 'fn:research|' + n.id,
        on: { click: () => { if (TE.Research.buy(n.id)) UI.FX.pulse(el, 'bought'); else TE.Audio.play('deny'); } } }, [
        h('div', { class: 'rn-name', text: n.name }), h('div', { class: 'rn-fx', text: UI.effectLines(n.effects).join(' · ') }), h('div', { class: 'rn-cost', text: U.fmt(n.cost, { dec: 0 }) + ' RP' }),
        h('span', { class: 'rn-era', hidden: true, text: 'ÈRE ' + D.ERAS[TE.Research.eraReq(n) - 1].roman }),
        h('span', { class: 'rec-badge', hidden: true, text: '★ RECOMMANDÉ' }),
      ]);
      R.nodes[n.id] = el;
      R.tree.appendChild(el);
    });
    root.appendChild(h('div', { class: 'card tree-wrap' }, [R.tree]));
    R.refine = h('div', { class: 'card refine', hidden: true }, [
      h('div', { class: 'card-h' }, [h('span', { text: D.RESEARCH_REPEAT.name }), R.refLvl = h('span', { class: 'card-hr' })]),
      h('div', { class: 'dim small', text: D.RESEARCH_REPEAT.desc }),
      R.refBtn = UI.costBtn('RECHERCHER', () => TE.Research.buyRefine()),
    ]);
    root.appendChild(R.refine);
  }
  UI.tips.research = (id) => {
    const n = D.RESEARCH_MAP[id];
    if (!n) return '';
    const done = TE.Research.done(id);
    let html = '<div class="tt-title">' + n.name + '</div><div class="tt-dim">' + n.desc + '</div>';
    UI.effectLines(n.effects).forEach((t) => { html += '<div class="tt-row"><span>◆ ' + UI.esc(t) + '</span></div>'; });
    if (n.req.length) html += '<div class="tt-row"><span>Prérequis</span><span>' + n.req.map((r) => (TE.Research.done(r) ? '✔ ' : '✖ ') + D.RESEARCH_MAP[r].name).join(', ') + '</span></div>';
    const er = TE.Research.eraReq(n);
    if (er > 1) html += '<div class="tt-row"><span>Ère</span><span class="' + (S().run.era >= er ? '' : 'c-amber') + '">' + (S().run.era >= er ? '✔ ' : '✖ ') + 'Ère ' + D.ERAS[er - 1].roman + ' — ' + D.ERAS[er - 1].name + '</span></div>';
    html += '<div class="tt-row"><span>Coût</span><span class="' + (done ? 'c-up' : '') + '">' + (done ? 'RECHERCHÉ' : U.fmt(n.cost, { dec: 0 }) + ' RP') + '</span></div>';
    const aff = UI.affects(n.effects);
    if (aff) html += '<div class="tt-row"><span>Affecte actuellement</span><span class="c-up">' + aff + '</span></div>';
    if (!done) { const w = UI.gainInfo(n.effects, 'Research'); if (w) html += '<div class="tt-sec">IMPACT RÉEL</div>' + UI.gainTip(w).replace(/<div class="tt-title">[^<]*<\/div>/, ''); }
    if (R.rec === id) html += '<div class="tt-dim gold">★ Recommandé : meilleur gain de revenu par RP parmi les recherches disponibles.</div>';
    return html;
  };
  /** Which of YOUR owned fleets (or systems) an effect list touches right now. */
  UI.affects = function (effects) {
    const out = [];
    const passive = Math.max(1e-9, TE.Economy.passive());
    const by = TE.Bots.expected().byId || {};
    effects.forEach((e) => {
      const m = /^bot\.([a-z]+)\./.exec(e.stat || '');
      if (m && m[1] !== 'all' && TE.Bots.count(m[1]) > 0) {
        const def = D.BOT_MAP[m[1]];
        out.push(def.name + ' (' + U.pct((by[m[1]] || 0) / passive, 0, false) + ' de vos revenus)');
      } else if (m && m[1] === 'all' && TE.Bots.totalUnits() > 0) out.push('tous vos bots');
      if (/^div\./.test(e.stat || '') && TE.Empire.divIncome() > 0) out.push('vos divisions');
      if (/^fund\./.test(e.stat || '') && TE.Fund.active()) out.push('votre fonds');
      if (/^manual\./.test(e.stat || '')) out.push('votre trading manuel');
    });
    return out.filter((x, i) => out.indexOf(x) === i).slice(0, 2).join(', ');
  };
  /** Best available research by passive-income gain per RP (refreshed every few seconds). */
  function recompute() {
    let best = null, bs = 0;
    D.RESEARCH.forEach((n) => {
      if (TE.Research.done(n.id) || !TE.Research.reqsDone(n)) return;
      const w = UI.gainInfo(n.effects, 'Research');
      const sc = w ? w.gain / Math.max(1, n.cost) : 0;
      if (sc > bs) { bs = sc; best = n.id; }
    });
    R.rec = best;
  }
  function resUpdate() {
    const s = S();
    if (!R.tree) return;
    const rs = s.run.research;
    UI.text(R.kpi.rp, U.fmt(rs.rp, { dec: 0 }) + ' RP');
    UI.text(R.kpi.rate, '+' + U.fmt(TE.Research.rate()) + '/s');
    UI.text(R.kpi.done, Object.keys(rs.done).length + ' / ' + D.RESEARCH.length);
    R.auto.hidden = !TE.Prestige.lperk('autores');
    R.auto.firstChild.checked = !!s.settings.autoBuy.research;
    const now = performance.now();
    if (!R.recT || now - R.recT > 3000) { R.recT = now; recompute(); }
    D.RESEARCH.forEach((n) => {
      const el = R.nodes[n.id];
      const done = TE.Research.done(n.id);
      const avail = !done && TE.Research.reqsDone(n);
      UI.cls(el, 'done', done);
      UI.cls(el, 'avail', avail);
      UI.cls(el, 'afford', avail && rs.rp >= n.cost);
      UI.cls(el, 'locked', !done && !avail);
      UI.cls(el, 'rec', R.rec === n.id && avail);
      el.querySelector('.rec-badge').hidden = !(R.rec === n.id && avail);
      el.querySelector('.rn-era').hidden = done || s.run.era >= TE.Research.eraReq(n);
      if (avail) el.style.setProperty('--prog', Math.min(100, rs.rp / n.cost * 100).toFixed(1) + '%');
    });
    R.lines.forEach((l) => { l.path.setAttribute('class', l.path.getAttribute('class').replace(/ on/g, '') + (TE.Research.done(l.a) ? ' on' : '')); });
    const vis = TE.Research.refineVisible();
    R.refine.hidden = !vis;
    if (vis) {
      UI.text(R.refLvl, 'Niveau ' + (rs.refine || 0) + ' · revenus ' + U.mult(Math.pow(1 + D.RESEARCH_REPEAT.effect, rs.refine || 0)));
      const c = TE.Research.refineCost();
      R.refBtn._set('RECHERCHER LE NIVEAU ' + ((rs.refine || 0) + 1), c, rs.rp >= c, { costText: U.fmt(c, { dec: 0 }) + ' RP' });
      R.refBtn.children[2].style.width = Math.min(100, rs.rp / c * 100).toFixed(1) + '%';
    }
  }
  UI.views.research = { build: resBuild, update: resUpdate };

  /* =============================== STAFF =============================== */
  const St = {};
  function staffBuild(root) {
    root.innerHTML = '';
    St.hq = h('div', { class: 'card hq' });
    root.appendChild(St.hq);
    St.buyMode = UI.buyModeSeg();
    St.cap = h('span', { class: 'card-hr' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Équipe' }), h('div', { class: 'card-tools' }, [St.cap, St.buyMode])]),
      h('div', { class: 'dim small', text: 'L’effectif est limité par votre siège. Les juniors et les seniors tradent sur le desk humain ; tous les autres renforcent votre société.' })]));
    St.grid = h('div', { class: 'item-grid' });
    root.appendChild(St.grid);
    St.legends = h('div', { class: 'legend-grid' });
    St.legCard = h('div', { class: 'card', hidden: true }, [h('div', { class: 'card-h' }, [h('span', { text: 'Recrues légendaires' }), h('span', { class: 'card-hr dim', text: 'débloquées par la réputation' })]), St.legends]);
    root.appendChild(St.legCard);
    St.sig = ''; St.lsig = ''; St.hqSig = '';
  }
  function hqVisual(idx) {
    let html = '<div class="skyline">';
    const heights = [8, 14, 22, 34, 46, 58, 70, 82];
    for (let i = 0; i <= idx; i++) html += '<div class="bld b' + i + '" style="height:' + heights[i] + 'px"></div>';
    return html + '</div>';
  }
  function staffUpdate() {
    const s = S();
    if (!St.grid) return;
    const o = TE.Firm.office(), nx = TE.Firm.nextOffice();
    const hqSig = s.run.office + '';
    if (St.hqSig !== hqSig) {
      St.hqSig = hqSig;
      St.hq.innerHTML = '';
      St.hq.appendChild(h('div', { class: 'card-h' }, [h('span', { text: 'Siège' }), h('div', { class: 'card-tools' }, [h('span', { class: 'card-hr', text: 'Niveau ' + (s.run.office + 1) + ' / ' + D.OFFICES.length }), h('button', { class: 'link', text: 'Voir le siège →', on: { click: () => UI.go('office') } })])]));
      St.hq.appendChild(h('div', { class: 'hq-body' }, [h('div', { class: 'hq-vis', html: hqVisual(s.run.office) }), h('div', { class: 'hq-info' }, [
        h('div', { class: 'hq-name', text: o.name }), h('div', { class: 'dim', text: o.desc }), St.capBar = UI.pbar(), St.capTxt = h('div', { class: 'small' }),
        nx ? h('div', { class: 'hq-next' }, [h('span', { html: 'Suivant : <b>' + nx.name + '</b> — ' + nx.cap + ' employés, tous les revenus ' + U.mult(nx.mult) }), St.hqGain = h('div'), St.hqBtn = UI.costBtn('EMMÉNAGER', () => TE.Firm.upgradeOffice())]) : h('div', { class: 'gold', text: 'Vous possédez le bâtiment le plus impressionnant du système solaire.' }),
      ])]));
    }
    if (nx && St.hqGain && (!St.hqGainT || performance.now() - St.hqGainT > 2500)) {
      St.hqGainT = performance.now();
      UI.html(St.hqGain, UI.gainHtml(UI.gainInfo([{ stat: 'income.global', mult: nx.mult / o.mult }], 'Headquarters'), true));
    }
    const used = TE.Firm.staffTotal(), cap = TE.Firm.staffCap();
    St.capBar._set(used / cap);
    UI.text(St.capTxt, U.int(used) + ' / ' + U.int(cap) + ' postes occupés');
    UI.text(St.cap, U.int(used) + ' / ' + U.int(cap) + ' employés');
    if (St.hqBtn && nx) St.hqBtn._set('EMMÉNAGER', nx.cost, TE.Economy.canAfford(nx.cost));
    St.buyMode._update();
    const items = D.STAFF.filter((x) => TE.Firm.staffAvailable(x));
    const sig = items.map((x) => x.id).join(',');
    if (sig !== St.sig) {
      St.sig = sig;
      St.grid.innerHTML = '';
      St.cards = {};
      items.forEach((x) => {
        const c = {};
        c.el = h('div', { class: 'card item' }, [
          h('div', { class: 'it-h' }, [h('span', { class: 'it-ic', text: x.icon }), h('b', { text: x.name }), c.count = h('span', { class: 'it-count' })]),
          h('div', { class: 'dim small', text: x.desc }), c.fx = h('div', { class: 'it-fx' }), c.gain = h('div'),
          c.buy = UI.costBtn('EMBAUCHER', () => { const q = TE.Firm.staffQuote(x.id); return TE.Firm.hire(x.id, q.qty); }),
        ]);
        St.cards[x.id] = c;
        St.grid.appendChild(c.el);
      });
    }
    const sp = TE.Mods.get('staff.power');
    items.forEach((x) => {
      const c = St.cards[x.id];
      UI.text(c.count, '×' + U.int(TE.Firm.staffCount(x.id)) + (x.max ? ' / ' + x.max : ''));
      const per = x.desk ? 'Desk humain : +' + x.desk + ' équivalent' + (x.desk > 1 ? 's' : '') + ' trader' : '';
      const fx = x.effects.map((e) => (e.add !== undefined ? TE.Mods.describe({ stat: e.stat, add: e.add * sp }) : TE.Mods.describe(e))).join(' · ');
      UI.html(c.fx, '<span class="dim">Chacun :</span> ' + [per, fx].filter(Boolean).join(' · '));
      const geff = x.desk ? [{ stat: 'staff.desk', add: 0 }] : x.effects.map((e) => (e.add !== undefined ? { stat: e.stat, add: e.add * sp } : e));
      if (!x.desk) UI.html(c.gain, UI.gainHtml(cachedGain('s:' + x.id, geff, 'Staff'), true));
      const q = TE.Firm.staffQuote(x.id);
      if (q.maxed) c.buy._set(TE.Firm.staffTotal() >= TE.Firm.staffCap() ? 'COMPLET — AGRANDIR LE SIÈGE' : 'AU MAXIMUM', 0, false, { costText: '—' });
      else c.buy._set('EMBAUCHER ×' + q.qty, q.cost, q.afford);
    });
    // legends
    const legs = D.LEGENDS.filter((l) => TE.Firm.legendVisible(l));
    St.legCard.hidden = !(s.run.rep >= 10 || TE.Firm.staffTotal() > 0);
    const lsig = legs.map((l) => l.id + (s.run.legends[l.id] ? 1 : 0) + (TE.Firm.legendAvailable(l) ? 1 : 0) + (s.run.legendsAway && s.run.legendsAway[l.id] > s.run.time ? 'a' : '')).join(',');
    if (lsig !== St.lsig) {
      St.lsig = lsig;
      St.legends.innerHTML = '';
      St.lcards = {};
      legs.forEach((l) => {
        const hired = !!s.run.legends[l.id];
        const avail = TE.Firm.legendAvailable(l);
        const away = hired && s.run.legendsAway && s.run.legendsAway[l.id] > s.run.time;
        const initials = l.name.replace(/[“”«»"'.]/g, '').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('');
        const c = {};
        c.el = h('div', { class: 'legend' + (hired ? ' hired' : avail ? '' : ' locked') + (away ? ' away' : '') }, [
          h('div', { class: 'lg-face', text: avail || hired ? initials : '?' }),
          h('div', { class: 'lg-body' }, [h('b', { text: avail || hired ? l.name : '???' }), h('div', { class: 'dim small', text: l.role }), h('div', { class: 'lg-q', text: avail || hired ? '« ' + l.quote + ' »' : 'Nécessite ' + U.int(l.rep) + ' de réputation.' }),
            h('div', { class: 'lg-fx', text: UI.effectLines(l.effects).join(' · ') }),
            hired ? h('div', { class: away ? 'down small' : 'gold small', text: away ? '✖ DÉBAUCHÉE PAR UN RIVAL — revient bientôt' : '✔ DANS VOTRE ÉQUIPE' }) : (c.btn = UI.costBtn('RECRUTER', () => TE.Firm.hireLegend(l.id)))]),
        ]);
        St.lcards[l.id] = c;
        St.legends.appendChild(c.el);
      });
    }
    legs.forEach((l) => { const c = St.lcards[l.id]; if (c && c.btn) c.btn._set(TE.Firm.legendAvailable(l) ? 'RECRUTER' : 'RÉP. ' + U.int(l.rep), l.cost, TE.Firm.legendAvailable(l) && TE.Economy.canAfford(l.cost)); });
  }
  UI.views.staff = { build: staffBuild, update: staffUpdate };
})(window.TE);
