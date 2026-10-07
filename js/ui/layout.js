/* App shell: header stats, progressive navigation, ticker tape, side panel, status bar,
 * keyboard shortcuts and all feedback (toasts, floats, sounds) wired to game events. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const S = () => TE.state;

  UI.active = 'market';
  const refs = {};
  const smooth = { nw: new UI.Smooth(), cash: new UI.Smooth(), ps: new UI.Smooth() };

  /* ======================= HEADER ======================= */
  const HSTATS = [
    { id: 'nw', label: 'Valeur nette', big: true, tip: 'fn:nw', show: () => true },
    { id: 'cash', label: 'Liquidités', tip: 'fn:cash', show: () => true },
    { id: 'ps', label: 'Profit / s', tip: 'fn:income', show: () => S().run.earnings > 0 || TE.Bots.totalUnits() > 0 },
    { id: 'pnl', label: 'PnL ouvert', tip: 'fn:pnl', show: () => TE.Trading.openCount() > 0 || (S().profile.stats.trades || 0) > 0 },
    { id: 'aum', label: 'AUM', tip: 'fn:aum', show: () => TE.Fund.active() },
    { id: 'rep', label: 'Réputation', tip: 'fn:rep', show: () => S().run.rep >= 1 || TE.Fund.active() },
    { id: 'inf', label: 'Influence', tip: 'fn:inf', show: () => TE.Empire.influence() > 0 },
    { id: 'rp', label: 'Recherche', tip: 'stat:research.rate', show: () => TE.Research.active() },
    { id: 'alpha', label: 'Alpha', tip: 'fn:alpha', show: () => S().profile.prestige.alphaTotal > 0 || S().profile.features.prestige },
    { id: 'era', label: 'Ère', tip: 'fn:era', show: () => true },
  ];
  function buildHeader() {
    const top = document.getElementById('topbar');
    top.innerHTML = '';
    top.appendChild(h('div', { class: 'brand', tip: 'TRADING EMPIRE — une simulation de marchés fictifs. Aucun argent réel, aucun ordre réel.' }, [
      h('div', { class: 'logo' }, [h('span', { class: 'logo-mark', text: '◢' }), h('span', { class: 'logo-a', text: 'TRADING' }), h('span', { class: 'logo-b', text: 'EMPIRE' })]),
      h('div', { class: 'brand-sub', id: 'brand-sub', text: 'Trader indépendant' }),
    ]));
    const row = h('div', { class: 'hstats', id: 'hstats' });
    HSTATS.forEach((st) => {
      const el = h('div', { class: 'hs' + (st.big ? ' hs-big' : ''), tip: st.tip, hidden: true, data: { hs: st.id }, 'data-why': true }, [
        h('div', { class: 'hs-l', text: st.label }), h('div', { class: 'hs-v', text: '—' }), h('div', { class: 'hs-s', text: '' }),
      ]);
      refs['hs_' + st.id] = { el, v: el.children[1], s: el.children[2] };
      row.appendChild(el);
    });
    top.appendChild(row);
    const tools = h('div', { class: 'htools' }, [
      h('div', { class: 'goal', id: 'goal', tip: 'fn:goal', 'data-why': true }, [h('span', { class: 'goal-k', text: 'OBJECTIF' }), h('b', { class: 'goal-t' }), h('div', { class: 'goal-bar' }, [h('i')])]),
      h('div', { class: 'combo', id: 'combo', hidden: true, tip: 'fn:combo' }),
      h('button', { class: 'icon-btn', id: 'btn-sound', tip: 'Son activé / coupé (M)', on: { click: () => UI.toggleSound() } }),
      h('button', { class: 'icon-btn', tip: 'Sauvegarder maintenant (Ctrl+S)', text: '⤓', on: { click: () => { TE.Save.save(true); UI.toast({ text: 'Partie sauvegardée.', kind: 'ok', icon: '✓', dur: 1600 }); } } }),
      h('button', { class: 'icon-btn', tip: 'Raccourcis clavier (?)', text: '⌨', on: { click: () => UI.showShortcuts() } }),
    ]);
    top.appendChild(tools);
  }
  function updateHeader() {
    const s = S();
    const nw = TE.Economy.netWorth();
    const set = (id, v, sub, cls) => {
      const r = refs['hs_' + id];
      UI.text(r.v, v);
      UI.text(r.s, sub || '');
      if (cls !== undefined) { r.v.className = 'hs-v ' + cls; }
    };
    HSTATS.forEach((st) => {
      const r = refs['hs_' + st.id];
      const vis = st.show();
      if (vis && r.el.hidden) { r.el.hidden = false; UI.FX.pulse(r.el, 'appear'); }
      else if (!vis && !r.el.hidden) r.el.hidden = true;
    });
    set('nw', U.money(smooth.nw.step(nw)), 'pic ' + U.money(s.run.peakNW));
    set('cash', U.money(smooth.cash.step(s.run.cash)), 'généré ' + U.money(s.run.earnings));
    const ps = TE.Economy.passive();
    const real = TE.Economy.realized();
    const sat = TE.Economy.saturation();
    set('ps', U.money(smooth.ps.step(ps)) + '/s', 'réal. ' + U.smoney(real) + '/s' + (sat > 0.5 ? ' · sat. ' + U.pct(sat, 0, false) : ''));
    let upnl = 0;
    const pos = s.run.account.positions;
    Object.keys(pos).forEach((id) => { upnl += TE.Trading.upnl(id) - pos[id].fees; });
    set('pnl', (upnl > 0 ? '▲ ' : upnl < 0 ? '▼ ' : '') + U.smoney(upnl), TE.Trading.openCount() + ' pos. · série ' + s.run.account.combo, UI.dir(upnl));
    if (TE.Fund.active()) set('aum', U.money(TE.Fund.aum()), 'cap. ' + U.money(TE.Fund.capacity()));
    const rt = TE.Fund.repTier(s.run.rep);
    set('rep', U.int(s.run.rep), rt.tier.name);
    const inf = TE.Empire.influence();
    set('inf', U.pct(inf, inf < 0.0001 ? 5 : inf < 0.01 ? 3 : 2, false), 'du marché mondial');
    if (TE.Research.active()) set('rp', U.fmt(s.run.research.rp, { dec: 0 }) + ' RP', '+' + U.fmt(TE.Research.rate()) + '/s');
    const pa = TE.Prestige.pendingAlpha();
    set('alpha', U.int(s.profile.prestige.alpha) + ' α', pa > 0 ? '+' + U.int(pa) + ' en attente' : U.mult(TE.Prestige.alphaBonus()) + ' revenus');
    const era = TE.Progress.era();
    set('era', era.roman + ' · ' + era.name, 'rang mondial #' + U.int(TE.Empire.rank()));
    UI.text(document.getElementById('brand-sub'), era.name);
    // combo
    const c = s.run.account.combo;
    const tier = TE.Trading.comboTier(c);
    const ce = document.getElementById('combo');
    if (tier) {
      ce.hidden = false;
      UI.html(ce, '<b>' + tier.name + '</b> ' + c + ' VICTOIRES · ' + U.mult(TE.Trading.comboMult()));
    } else ce.hidden = true;
    UI.text(document.getElementById('btn-sound'), s.settings.sound ? '♪' : '✕');
    // next big progression
    const g = UI.nextGoal();
    const ge = document.getElementById('goal');
    if (ge) {
      UI.show(ge, !!g);
      if (g) { UI.text(ge.children[1], g.label); ge.children[2].firstChild.style.width = (U.clamp(g.p, 0, 1) * 100).toFixed(1) + '%'; UI.cls(ge, 'ready', g.p >= 1); }
    }
  }
  /** The next major step of the run (feature, era or prestige) with its progress. */
  UI.nextGoal = function () {
    const s = S();
    const e = s.run.earnings;
    const cands = [];
    Object.keys(D.FEATURE_EARN).forEach((id) => {
      if (s.profile.features[id]) return;
      const f = D.FEATURE_MAP[id];
      cands.push({ at: D.FEATURE_EARN[id], label: f.name, p: e / D.FEATURE_EARN[id], tip: 'Nouveau panneau : ' + f.name + ' à ' + U.money(D.FEATURE_EARN[id], { dec: 0 }) + ' générés.' });
    });
    const st = TE.Progress.nextEraStatus();
    if (st) {
      const req = TE.Progress.eraReq(st.era);
      let p = e / req;
      if (st.crisis && !st.crisisOk && p >= 1) p = 0.99;
      cands.push({ at: req, label: 'Ère ' + st.era.roman, p, tip: 'Ère ' + st.era.roman + ' — ' + st.era.name + ' : ' + U.money(req, { dec: 0 }) + ' générés' + (st.crisis ? ' et survivre à « ' + st.crisis.name + ' »' : '') + '.' });
    } else if (!TE.Prestige.canP3()) cands.push({ at: D.P3_MIN_EARN, label: 'Singularité', p: U.log10(Math.max(1, e)) / 30, tip: 'Singularité financière : ' + U.money(D.P3_MIN_EARN) + ' générés dans la partie.' });
    if (!s.profile.prestige.p1 && !TE.Prestige.canP1()) cands.push({ at: D.P1_MIN_EARN, label: 'Prestige α', p: e / D.P1_MIN_EARN, tip: 'Première liquidation possible à ' + U.money(D.P1_MIN_EARN, { dec: 0 }) + ' générés.' });
    if (TE.Prestige.canP1() && !s.profile.prestige.p1) return { label: 'Liquider (+' + U.int(TE.Prestige.pendingAlpha()) + ' α)', p: 1, tip: 'Votre première liquidation est possible : l’Alpha accélère toutes vos parties suivantes.' };
    if (!cands.length) return null;
    cands.sort((a, b) => a.at - b.at);
    return cands[0];
  };
  UI.tips.goal = () => {
    const g = UI.nextGoal();
    if (!g) return '';
    return '<div class="tt-title">Prochaine grande étape</div><div class="tt-big">' + UI.esc(g.label) + '</div><div class="pbar"><i style="width:' + (U.clamp(g.p, 0, 1) * 100).toFixed(1) + '%"></i></div><div class="tt-dim">' + UI.esc(g.tip || '') + '</div>';
  };

  /* ======================= NAV ======================= */
  function buildNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = '';
    const top = h('div', { class: 'nav-top' });
    const bottom = h('div', { class: 'nav-bottom' });
    D.FEATURES.forEach((f) => {
      const b = h('button', { class: 'nav-btn', data: { nav: f.id }, hidden: true, tip: f.key ? f.name + ' (Maj+' + f.key + ')' : f.name, on: { click: () => UI.go(f.id) } }, [
        h('span', { class: 'nav-ic', text: f.icon }), h('span', { class: 'nav-lb', text: f.name }), h('span', { class: 'nav-badge' }),
      ]);
      refs['nav_' + f.id] = b;
      (f.bottom ? bottom : top).appendChild(b);
    });
    nav.appendChild(top);
    nav.appendChild(bottom);
  }
  function navBadge(id) {
    const s = S();
    if (!s.profile.featuresSeen[id]) return 'NEUF';
    switch (id) {
      case 'upgrades': { const n = TE.Upgrades.list().filter((u) => TE.Economy.canAfford(u.cost)).length; return n ? String(n) : ''; }
      case 'research': { const n = D.RESEARCH.filter((r) => TE.Research.canBuy(r)).length; return n ? String(n) : ''; }
      case 'fund': return s.run.fund && s.run.fund.vip.offer ? '!' : TE.Fund.available() && !TE.Fund.active() ? '!' : '';
      case 'prestige': return TE.Prestige.canP1() ? 'α' : '';
      case 'contracts': return '';
      default: return '';
    }
  }
  function updateNav() {
    const s = S();
    D.FEATURES.forEach((f) => {
      const b = refs['nav_' + f.id];
      const on = !!s.profile.features[f.id];
      if (on && b.hidden) { b.hidden = false; if (!s.profile.featuresSeen[f.id]) UI.FX.pulse(b, 'nav-new'); }
      UI.cls(b, 'active', UI.active === f.id);
      const badge = b.children[2];
      const t = on ? navBadge(f.id) : '';
      UI.text(badge, t);
      UI.cls(badge, 'show', !!t);
      UI.cls(badge, 'new', t === 'NEUF');
    });
  }
  UI.go = function (id) {
    const s = S();
    if (!s.profile.features[id]) return;
    if (UI.active === id && UI.viewEls[id]) return;
    TE.Audio.play('click');
    UI.active = id;
    s.profile.featuresSeen[id] = true;
    s.profile.uiVisited[id] = 1;
    Object.keys(UI.viewEls).forEach((k) => { UI.viewEls[k].hidden = k !== id; });
    ensureView(id);
    UI.viewEls[id].hidden = false;
    const v = UI.views[id];
    if (v && v.onShow) v.onShow();
    if (v && v.update) v.update(true);
    document.getElementById('main').scrollTop = 0;
    updateNav();
  };
  UI.viewEls = {};
  function ensureView(id) {
    if (UI.viewEls[id]) return;
    const el = h('section', { class: 'view view-' + id, data: { view: id } });
    document.getElementById('main').appendChild(el);
    UI.viewEls[id] = el;
    const v = UI.views[id];
    if (v && v.build) v.build(el);
  }

  /* ======================= TICKER ======================= */
  let tickerSig = '';
  function buildTicker() {
    const s = S();
    const ids = Object.keys(s.run.unlocked).sort((a, b) => D.ASSET_MAP[a].order - D.ASSET_MAP[b].order);
    const sig = ids.join(',');
    if (sig === tickerSig) return;
    tickerSig = sig;
    const track = document.querySelector('#ticker .ticker-track');
    track.innerHTML = '';
    refs.ticker = [];
    const make = () => {
      const g = h('div', { class: 'ticker-group' });
      ids.forEach((id) => {
        const el = h('span', { class: 'tk', on: { click: () => { s.run.activeAsset = id; UI.go('market'); } } }, [h('b', { text: id }), h('span', { class: 'tk-p' }), h('span', { class: 'tk-c' })]);
        refs.ticker.push({ id, p: el.children[1], c: el.children[2] });
        g.appendChild(el);
      });
      g.appendChild(h('span', { class: 'tk tk-sep', html: '◆ <b>P&amp;A</b> <span class="tk-fg"></span>' }));
      g.appendChild(h('span', { class: 'tk tk-sep', html: '◆ <b>MACRO</b> <span class="tk-mc"></span>' }));
      return g;
    };
    let reps = Math.max(2, Math.ceil(12 / Math.max(1, ids.length)));
    for (let i = 0; i < reps; i++) track.appendChild(make());
    track.style.setProperty('--shift', (-100 / reps).toFixed(4) + '%');
    track.style.animationDuration = Math.max(20, ids.length * 4.5) + 's';
    updateTicker();
  }
  function updateTicker() {
    (refs.ticker || []).forEach((r) => {
      const ch = TE.Market.change(r.id, 300);
      UI.text(r.p, U.price(TE.Market.mid(r.id)));
      UI.text(r.c, (ch >= 0 ? '▲ ' : '▼ ') + U.pct(ch, 2));
      r.c.className = 'tk-c ' + UI.dir(ch);
    });
    const fg = Math.round(TE.Market.sentiment());
    UI.$$('.tk-fg').forEach((e) => UI.text(e, fg + ' ' + TE.Market.sentimentLabel(fg)));
    UI.$$('.tk-mc').forEach((e) => UI.text(e, TE.Market.macro().name.toUpperCase()));
  }

  /* ======================= SIDE PANEL ======================= */
  function gaugeSvg() {
    return '<svg viewBox="0 0 200 112" class="gauge"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="var(--down)"/><stop offset="0.5" stop-color="var(--amber)"/><stop offset="1" stop-color="var(--up)"/></linearGradient></defs>' +
      '<path d="M16 100 A84 84 0 0 1 184 100" fill="none" stroke="var(--line)" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M16 100 A84 84 0 0 1 184 100" fill="none" stroke="url(#gg)" stroke-width="12" stroke-linecap="round" opacity="0.85"/>' +
      '<g class="gauge-needle"><line x1="100" y1="100" x2="100" y2="30" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="100" r="6" fill="var(--text)"/></g>' +
      '<text x="16" y="111" class="gauge-t">PEUR</text><text x="184" y="111" text-anchor="end" class="gauge-t">AVIDITÉ</text></svg>';
  }
  /* V2: side cards can be folded (secondary information stays one click away). */
  function foldable(id, title, right, body, defaultFolded) {
    const s = S();
    s.settings.fold = s.settings.fold || {};
    if (s.settings.fold[id] === undefined && defaultFolded) s.settings.fold[id] = true;
    const head = h('div', { class: 'card-h fold-h', title: 'Replier / déplier' }, [h('span', { class: 'fold-t' }, [h('i', { class: 'fold-ic', text: '▾' }), title]), right || null]);
    const card = h('section', { class: 'card side-card sc-' + id + (s.settings.fold[id] ? ' folded' : ''), id: 'sc-' + id }, [head].concat(body));
    head.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('[data-tip]') && !e.target.closest('.fold-t')) return;
      s.settings.fold[id] = !s.settings.fold[id];
      card.classList.toggle('folded', !!s.settings.fold[id]);
    });
    return card;
  }
  const NEWS_FILTERS = [['all', 'TOUT'], ['market', 'MARCHÉ'], ['rumor', 'RUMEURS'], ['macro', 'MACRO'], ['firm', 'SOCIÉTÉ'], ['odd', 'INSOLITE']];
  let newsFilter = 'all';
  function buildSide() {
    const side = document.getElementById('side');
    side.innerHTML = '';
    const pulse = foldable('pulse', 'Pouls du marché', h('span', { class: 'card-hr', id: 'macro-lbl', tip: 'fn:macro' }), [
      h('div', { class: 'pulse-body' }, [h('div', { class: 'gauge-wrap', html: gaugeSvg(), tip: 'fn:sentiment', 'data-why': true }), h('div', { class: 'pulse-val' }, [h('div', { class: 'pv-n', id: 'fg-n' }), h('div', { class: 'pv-l', id: 'fg-l' }), h('div', { class: 'pv-fx small', id: 'fg-fx' })])]),
    ]);
    const opp = h('section', { class: 'card side-card sc-opp', id: 'opp', hidden: true });
    const events = h('section', { class: 'card side-card sc-events', id: 'events-card', hidden: true }, [h('div', { class: 'card-h' }, [h('span', { text: 'Événements de marché' })]), h('div', { class: 'ev-list', id: 'ev-list' })]);
    const cal = foldable('cal', 'Calendrier financier', h('span', { class: 'card-hr dim', id: 'cal-hr' }), [h('div', { class: 'cal-list', id: 'cal-list' })]);
    cal.hidden = true;
    const nf = h('div', { class: 'seg mini news-filter', id: 'news-filter' }, NEWS_FILTERS.map(([k, l]) => h('button', { class: k === newsFilter ? 'on' : '', text: l, data: { f: k }, on: { click: (e) => { newsFilter = k; UI.$$('#news-filter button').forEach((b) => b.classList.toggle('on', b === e.target)); renderNews(true); } } })));
    const news = foldable('news', 'Fil d’actualités', h('span', { class: 'card-hr live-dot', text: 'DIRECT' }), [nf, h('div', { class: 'news-list', id: 'news-list' })]);
    const world = foldable('world', 'Le monde vous regarde', null, [
      h('div', { class: 'wd-row', tip: 'fn:att', 'data-why': true }, [h('span', { class: 'wd-l', text: 'ATTENTION' }), h('div', { class: 'wd-bar att' }, [h('i', { id: 'wd-att-bar' })]), h('b', { id: 'wd-att' })]),
      h('div', { class: 'wd-row', tip: 'fn:reg', 'data-why': true }, [h('span', { class: 'wd-l', text: 'RÉGULATEURS' }), h('div', { class: 'wd-bar reg' }, [h('i', { id: 'wd-reg-bar' })]), h('b', { id: 'wd-reg' })]),
      h('div', { class: 'wd-note small', id: 'wd-note' }),
    ]);
    world.hidden = true;
    const act = foldable('activity', 'Activité', h('div', { class: 'seg mini', id: 'act-filter' }, ['all', 'trades', 'bots', 'firm'].map((f) => h('button', { class: f === 'all' ? 'on' : '', text: { all: 'TOUT', trades: 'TRADES', bots: 'BOTS', firm: 'SOCIÉTÉ' }[f], on: { click: (e) => setActFilter(f, e.target) } }))), [
      h('div', { class: 'act-list', id: 'act-list' }),
    ], true);
    [pulse, opp, events, cal, news, world, act].forEach((x) => side.appendChild(x));
    renderNews(true);
  }
  let actFilter = 'all';
  function setActFilter(f, btn) {
    actFilter = f;
    UI.$$('#act-filter button').forEach((b) => b.classList.toggle('on', b === btn));
    UI.$$('#act-list .act').forEach((el) => { el.hidden = f !== 'all' && el.dataset.k !== f; });
  }
  UI.activity = function (kind, html, val) {
    const list = document.getElementById('act-list');
    if (!list) return;
    const s = S();
    const el = h('div', { class: 'act act-' + kind, data: { k: kind === 'trade' ? 'trades' : kind === 'bot' ? 'bots' : 'firm' } }, [
      h('span', { class: 'act-t', text: U.clock(s.run.time % 3600) }),
      h('span', { class: 'act-x', html }),
      val !== undefined ? h('span', { class: 'act-v ' + UI.dir(val), text: (val > 0 ? '+' : val < 0 ? '-' : '') + U.money(Math.abs(val)) }) : null,
    ]);
    if (actFilter !== 'all' && el.dataset.k !== actFilter) el.hidden = true;
    list.insertBefore(el, list.firstChild);
    while (list.children.length > 60) list.lastChild.remove();
  };
  /* display names for news categories (also covers English categories stored by older saves) and impact levels */
  const NEWS_CAT_FR = { MARKETS: 'MARCHÉS', BREAKING: 'DERNIÈRE MINUTE', ALERT: 'ALERTE', WARNING: 'AVERTISSEMENT', CRISIS: 'CRISE', OFFBEAT: 'INSOLITE',
    SCANDAL: 'SCANDALE', SOCIAL: 'RÉSEAUX SOCIAUX', RESEARCH: 'ANALYSE', GLOBAL: 'MONDE', EQUITIES: 'ACTIONS', COMMODITIES: 'MATIÈRES PREMIÈRES', FX: 'FOREX',
    DERIVATIVES: 'DÉRIVÉS', FRONTIER: 'FRONTIÈRE' };
  const IMPACT_FR = { HIGH: 'IMPACT FORT', MED: 'IMPACT MOYEN', LOW: 'IMPACT FAIBLE' };
  let newsSig = '';
  const MACRO_CATS = ['CALENDRIER', 'MONDE', 'AVERTISSEMENT', 'CRISE', 'FUITE', 'MARCHÉS'];
  const FIRM_CATS = ['EMPIRE', 'SCANDALE', 'SOCIÉTÉ', 'CONCURRENCE', 'RÉGULATEUR', 'VOUS'];
  function newsKind(n) {
    const k = {};
    if (n.cat === 'INSOLITE' || n.cat === 'OFFBEAT') { k.odd = 1; return k; }
    if (n.rumor || n.follow) k.rumor = 1;
    if (n.me || n.empire || n.rival || n.reg || FIRM_CATS.indexOf(n.cat) >= 0) k.firm = 1;
    if (n.cal || (!n.asset && (n.event || MACRO_CATS.indexOf(n.cat) >= 0))) k.macro = 1;
    if (n.asset && !k.firm) k.market = 1;
    return k;
  }
  let newsRows = [];
  function renderNews(force) {
    const s = S();
    const list = document.getElementById('news-list');
    if (!list) return;
    const all = s.run.news.filter((n) => newsFilter === 'all' || newsKind(n)[newsFilter]);
    const items = all.slice(0, 14);
    const sig = newsFilter + '|' + items.map((n) => n.id).join(',');
    if (!force && sig === newsSig) { updateNewsTimers(); return; }
    newsSig = sig;
    const tags = TE.Mods.has('ind.news');
    list.innerHTML = '';
    newsRows = [];
    if (!items.length) list.appendChild(h('div', { class: 'dim small empty', text: 'Rien dans cette catégorie pour l’instant.' }));
    items.forEach((n) => {
      const kd = newsKind(n);
      const cls = (n.event ? 'news-ev' : n.empire ? 'news-emp' : '') + (kd.odd ? ' news-odd' : '') + (n.me ? ' news-me' : '') + (n.follow ? ' news-' + n.follow : '') + (n.reg ? ' news-reg' : '');
      let tag = '';
      if (n.me) tag += '<span class="ntag me">VOUS</span>';
      if (tags && n.asset && n.dir) tag += '<span class="ntag ' + (n.dir > 0 ? 'up' : 'down') + '">' + (n.dir > 0 ? '▲ HAUSSIER' : '▼ BAISSIER') + (n.impact ? ' · ' + (IMPACT_FR[n.impact] || n.impact) : '') + '</span>';
      if (n.rumor) tag += '<span class="ntag rumor">NON CONFIRMÉ</span>';
      if (n.follow === 'confirm') tag += '<span class="ntag up">CONFIRMÉ</span>';
      if (n.follow === 'deny') tag += '<span class="ntag down">DÉMENTI</span>';
      const el = h('div', { class: 'news ' + cls, html: '<div class="news-h"><span class="ncat">' + UI.esc(NEWS_CAT_FR[n.cat] || n.cat) + (n.asset ? ' · ' + n.asset : '') + '</span><span class="nt">' + U.clock(n.t % 3600) + '</span></div><div class="news-x">' + UI.esc(n.text) + '</div>' + tag + '<span class="ntag hit" hidden></span>' });
      if (n.asset) { el.classList.add('clickable'); el.addEventListener('click', () => { if (s.run.unlocked[n.asset]) { s.run.activeAsset = n.asset; UI.go('market'); } }); }
      list.appendChild(el);
      if (n.hitAt !== undefined) newsRows.push({ n, el, hit: el.querySelector('.ntag.hit') });
    });
    updateNewsTimers();
  }
  /** "IMPACT DANS 7 s" … then a short IMPACT flash when the move starts. */
  function updateNewsTimers() {
    const t = S().run.time;
    newsRows.forEach((r) => {
      const left = r.n.hitAt - t;
      if (left > 0.05) { r.hit.hidden = false; UI.text(r.hit, 'IMPACT DANS ' + Math.ceil(left) + ' s'); r.hit.className = 'ntag hit soon'; }
      else if (left > -4) { r.hit.hidden = false; UI.text(r.hit, '⚡ IMPACT'); r.hit.className = 'ntag hit now'; UI.cls(r.el, 'news-hit', true); }
      else if (!r.hit.hidden) { r.hit.hidden = true; UI.cls(r.el, 'news-hit', false); }
    });
  }
  UI.renderNews = renderNews;
  /* calendar */
  let calSig = '';
  function updateCalendar() {
    const s = S();
    const w = s.run.world;
    const card = document.getElementById('sc-cal');
    if (!card) return;
    const on = !!(w && w.calOn);
    UI.show(card, on && (w.cal.length > 0));
    if (!on || !w.cal.length) return;
    const list = document.getElementById('cal-list');
    const views = w.cal.map((ev) => TE.World.calView(ev));
    const sig = w.cal.map((e) => e.uid + (e.leaked ? 'L' : '')).join(',') + TE.Mods.has('cal.consensus') + TE.Mods.has('cal.range');
    if (sig !== calSig) {
      calSig = sig;
      list.innerHTML = '';
      views.forEach((v, i) => {
        const ev = w.cal[i];
        const extra = [];
        if (v.cons) extra.push('<span class="' + (v.cons.dir > 0 ? 'up' : 'down') + '">Consensus ' + (v.cons.dir > 0 ? 'haussier' : 'baissier') + ' ' + U.pct(v.cons.p, 0, false) + '</span>');
        if (v.range) extra.push('Surprise attendue : ' + v.range);
        if (v.leaked) extra.push('<span class="' + (v.leaked > 0 ? 'up' : 'down') + '">FUITE : ' + (v.leaked > 0 ? 'favorable' : 'défavorable') + '</span>');
        if (!extra.length) extra.push('<span class="dim">Issue inconnue — le consensus se débloque avec « Flux de sentiment des news »</span>');
        const el = h('div', { class: 'cal' + (ev.asset ? ' clickable' : ''), on: { click: () => { if (ev.asset && s.run.unlocked[ev.asset]) { s.run.activeAsset = ev.asset; UI.go('market'); } } } }, [
          h('div', { class: 'cal-h' }, [h('span', { class: 'cal-i', text: v.icon }), h('b', { text: v.name }), h('span', { class: 'cal-t', data: { i: String(i) } })]),
          h('div', { class: 'cal-x small', html: extra.join(' · ') }),
        ]);
        list.appendChild(el);
      });
    }
    UI.$$('.cal-t', list).forEach((el) => { const v = views[+el.dataset.i]; if (v) { UI.text(el, 'dans ' + U.clock(v.left)); UI.cls(el, 'soon', v.left < 15); } });
    UI.text(document.getElementById('cal-hr'), w.cal.length + ' annonce' + (w.cal.length > 1 ? 's' : ''));
  }
  /* world: attention & regulators */
  function updateWorld() {
    const s = S();
    const w = s.run.world;
    const card = document.getElementById('sc-world');
    if (!card || !w) return;
    const vis = w.att >= 3 || w.reg >= 3 || s.run.earnings >= 1e5 || s.profile.prestige.p1 > 0;
    UI.show(card, vis);
    if (!vis) return;
    const lv = TE.World.attLevel(w.att);
    document.getElementById('wd-att-bar').style.width = w.att.toFixed(1) + '%';
    UI.text(document.getElementById('wd-att'), Math.round(w.att) + ' · ' + lv.lvl.name);
    const rb = document.getElementById('wd-reg-bar');
    rb.style.width = w.reg.toFixed(1) + '%';
    rb.className = w.reg >= 70 ? 'hi' : w.reg >= 30 ? 'mid' : '';
    UI.text(document.getElementById('wd-reg'), U.pct(w.reg / 100, 0, false));
    const lc = TE.World.levCap();
    const note = lc < Infinity ? '<span class="down">RESTRICTION : levier limité à x' + lc + ' (' + U.clock(w.restrict.until - s.run.time) + ')</span>'
      : w.reg >= 30 ? '<span class="c-amber">Contrôles possibles — réduisez la pression (conformité, risk managers, lobbying).</span>'
      : '<span class="dim">' + UI.esc(lv.lvl.desc) + '</span>';
    UI.html(document.getElementById('wd-note'), note);
  }
  function updateSide() {
    const s = S();
    const sent = TE.Market.sentiment();
    const needle = document.querySelector('.gauge-needle');
    if (needle) needle.setAttribute('transform', 'rotate(' + ((sent / 100) * 180 - 90).toFixed(1) + ' 100 100)');
    UI.text(document.getElementById('fg-n'), Math.round(sent));
    const fl = document.getElementById('fg-l');
    UI.text(fl, TE.Market.sentimentLabel(sent));
    fl.className = 'pv-l ' + (sent < 40 ? 'down' : sent > 60 ? 'up' : 'flat');
    const fx = UI.sentimentEffects(sent);
    UI.text(document.getElementById('fg-fx'), fx[0][0] + ' : ' + fx[0][1]);
    const m = s.market.macro;
    const md = D.MACRO[m.id] || D.MACRO.neutral;
    UI.html(document.getElementById('macro-lbl'), '<span class="macro ' + m.id + '">' + md.name.toUpperCase() + '</span>');
    // events
    const evs = s.run.events.active;
    const ec = document.getElementById('events-card');
    UI.show(ec, evs.length > 0);
    if (evs.length) {
      const html = evs.map((inst) => {
        const def = D.EVENT_MAP[inst.id];
        const t = inst.started ? def.dur - inst.t : inst.lead;
        const pct = inst.started ? 1 - inst.t / def.dur : 1;
        return '<div class="ev ev-' + def.tone + (inst.started ? '' : ' incoming') + '"><div class="ev-h"><span class="ev-i">' + def.icon + '</span><b>' + def.name + '</b><span class="ev-t">' + (inst.started ? U.clock(t) : 'dans ' + Math.ceil(t) + ' s') + '</span></div><div class="ev-d">' + UI.esc(TE.Events.fill(def.desc, inst.ctx)) + '</div><div class="ev-bar"><i style="width:' + (pct * 100).toFixed(1) + '%"></i></div></div>';
      }).join('');
      UI.html(document.getElementById('ev-list'), html);
    }
    renderNews(false);
    updateOpp();
    updateCrisisBar();
    updateCalendar();
    updateWorld();
  }

  /* ---------------- opportunity card ---------------- */
  let oppSig = '';
  function updateOpp() {
    const s = S();
    const el = document.getElementById('opp');
    const cur = s.run.opp.cur;
    if (!cur) { if (!el.hidden) el.hidden = true; oppSig = ''; return; }
    const def = D.OPP_MAP[cur.id];
    if (oppSig !== cur.id + cur.total) {
      oppSig = cur.id + cur.total;
      el.innerHTML = '';
      el.appendChild(h('div', { class: 'opp-h' }, [h('span', { class: 'opp-i', text: def.icon }), h('b', { text: def.name }), h('span', { class: 'opp-t', id: 'opp-t' })]));
      el.appendChild(h('div', { class: 'opp-x', text: cur.text || def.text }));
      const btns = h('div', { class: 'opp-btns' });
      if (def.choice) def.options.forEach((o) => btns.appendChild(h('button', { class: 'btn ' + (o.risk ? 'btn-danger' : 'btn-ghost'), text: o.label, on: { click: () => UI.claimOpp(o.id) } })));
      else btns.appendChild(h('button', { class: 'btn btn-primary', html: 'SAISIR <kbd>O</kbd>', on: { click: () => UI.claimOpp() } }));
      el.appendChild(btns);
      el.appendChild(h('div', { class: 'opp-bar' }, [h('i', { id: 'opp-bar' })]));
      el.hidden = false;
      UI.FX.pulse(el, 'appear');
    }
    UI.text(document.getElementById('opp-t'), Math.ceil(cur.left) + ' s');
    const bar = document.getElementById('opp-bar');
    if (bar) bar.style.width = (cur.left / cur.total * 100).toFixed(1) + '%';
  }
  UI.claimOpp = function (choice) {
    const s = S();
    if (!s.run.opp.cur) return;
    const def = D.OPP_MAP[s.run.opp.cur.id];
    if (def.choice && !choice) return;
    const el = document.getElementById('opp');
    const r = el.getBoundingClientRect();
    const res = TE.Events.claimOpportunity(choice);
    if (!res) return;
    UI.FX.burst(r.left + r.width / 2, r.top + r.height / 2, res.bad ? '#ff3d68' : '#ffd36b', 40);
    TE.Audio.play(res.bad ? 'loss' : 'bigprofit');
    UI.toast({ title: def.name, text: res.text, kind: res.bad ? 'bad' : 'gold', icon: def.icon });
    UI.activity('firm', '<b>' + def.name + '</b> ' + UI.esc(res.text));
    updateOpp();
  };

  /* ---------------- crisis bar ---------------- */
  function updateCrisisBar() {
    const s = S();
    const bar = document.getElementById('crisisbar');
    const c = s.run.events.crisis;
    if (!c) { if (!bar.hidden) { bar.hidden = true; document.body.classList.remove('in-crisis'); } return; }
    const def = D.CRISIS_MAP[c.id];
    bar.hidden = false;
    document.body.classList.toggle('in-crisis', !!c.active);
    if (!c.active) {
      UI.html(bar, '<div class="cb-warn"><span class="cb-blink">⚠ AVIS DE TEMPÊTE</span><b>' + def.name + '</b> imminente — ' + Math.ceil(c.warn) + ' s. <span class="dim">Réduisez le levier, placez vos stops, pensez aux couvertures.</span></div>');
      return;
    }
    const ph = def.phases[c.phase];
    const g = TE.Events.crisisGoals(c, def);
    const left = def.dur - c.t;
    const hp = 1 - c.t / def.dur;
    UI.html(bar, '<div class="cb-row"><span class="cb-name">☠ ' + def.name + '</span><span class="cb-ph">PHASE ' + (c.phase + 1) + '/' + def.phases.length + ' — ' + ph.name.toUpperCase() + '</span>' +
      '<div class="cb-hp"><i style="width:' + (hp * 100).toFixed(1) + '%"></i><span>SURVIVRE ' + U.clock(left) + '</span></div>' +
      '<span class="cb-goal ' + (g.dd.ok ? 'ok' : 'ko') + '">' + (g.dd.ok ? '✔' : '✖') + ' ' + g.dd.label + ' <b>' + g.dd.val + '</b></span>' +
      '<span class="cb-goal ' + (g.profit.ok ? 'ok' : '') + '">' + (g.profit.ok ? '✔' : '◌') + ' ' + g.profit.label + ' <b>' + g.profit.val + '</b></span>' +
      '<span class="cb-rw">Récompense : revenus ' + U.mult(def.reward) + '</span></div>');
  }

  /* ======================= STATUS BAR ======================= */
  function buildStatus() {
    const st = document.getElementById('status');
    st.innerHTML = '';
    st.appendChild(h('div', { class: 'st-l' }, [h('span', { class: 'st-dot' }), h('span', { text: 'BOURSE SIMULÉE — marchés fictifs, aucun argent réel' })]));
    st.appendChild(h('div', { class: 'st-m', id: 'st-m' }));
    st.appendChild(h('div', { class: 'st-r' }, [h('span', { id: 'st-turbo' }), h('span', { id: 'st-save', class: 'st-save' }), h('span', { class: 'dim', text: 'v' + TE.VERSION }), h('button', { class: 'st-btn', html: 'Raccourcis <kbd>?</kbd>', on: { click: () => UI.showShortcuts() } })]));
  }
  let savedFlash = 0;
  function updateStatus() {
    const s = S();
    UI.text(document.getElementById('st-m'), 'LATENCE ' + TE.Firm.fmtLatency(TE.Firm.latency()) + ' · CALCUL ' + TE.Firm.fmtCompute(TE.Firm.compute()) + ' · TICK 10 Hz · ' + Object.keys(s.run.unlocked).length + ' MARCHÉS · TEMPS DE JEU ' + U.dur(s.profile.playtime));
    const ago = Math.round((Date.now() - s.savedAt) / 1000);
    const se = document.getElementById('st-save');
    UI.text(se, Date.now() - savedFlash < 1500 ? '✓ Sauvegardé' : 'Sauvegardé ' + (ago < 5 ? 'à l’instant' : 'il y a ' + U.dur(ago)));
    UI.cls(se, 'flash', Date.now() - savedFlash < 1500);
    const tz = document.getElementById('st-turbo');
    const max = TE.Prestige.maxTurbo();
    if (max > 1) {
      const steps = TE.Prestige.turboSteps();
      const sig = steps.join(',') + '|' + s.settings.turbo;
      if (tz._sig !== sig) {
        tz._sig = sig;
        tz.innerHTML = '';
        tz.appendChild(h('span', { class: 'dim', text: 'TURBO ' }));
        steps.forEach((x) => tz.appendChild(h('button', { class: 'turbo-b' + (s.settings.turbo === x ? ' on' : ''), text: '×' + x, on: { click: () => { s.settings.turbo = x; tz._sig = ''; } } })));
      }
    } else if (tz.innerHTML) tz.innerHTML = '';
    const dl = TE.Loop.dilationLeft();
    document.body.classList.toggle('dilated', dl > 0);
  }

  /* ======================= KEYBOARD ======================= */
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kseq = [], typed = '';
  function onKey(e) {
    const s = S();
    if (!s) return;
    const tag = (e.target.tagName || '').toLowerCase();
    kseq.push(e.key); if (kseq.length > KONAMI.length) kseq.shift();
    if (kseq.join(',') === KONAMI.join(',')) { TE.Stats.add('konami'); UI.toast({ title: 'CODE D’INITIÉ ACCEPTÉ', text: 'Bien essayé. Tous les revenus +0 % (mais vous gagnez un succès).', kind: 'gold', icon: '↑↑↓↓' }); kseq = []; }
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    // (V2: the developer tools are no longer reachable by typing a word — only with ?debug in the URL)
    if (e.key.length === 1) { typed = (typed + e.key.toLowerCase()).slice(-12); if (typed.endsWith('stonks')) { TE.Stats.add('stonks'); UI.FX.stage({ kicker: '📈', title: 'STONKS', sub: 'Ça ne fait que monter.', dur: 1600 }); typed = ''; } }
    if (UI.modalOpen()) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); TE.Save.save(true); UI.toast({ text: 'Partie sauvegardée.', kind: 'ok', icon: '✓', dur: 1600 }); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.shiftKey && /^Digit[0-9]$/.test(e.code)) {
      const n = +e.code.slice(5);
      const f = D.FEATURES.find((x) => x.key === n);
      if (f) { e.preventDefault(); UI.go(f.id); }
      return;
    }
    const k = e.key.toLowerCase();
    const id = s.run.activeAsset;
    switch (k) {
      case 'l': TE.Trading.open(id, 1); break;
      case 's': TE.Trading.open(id, -1); break;
      case ' ': e.preventDefault(); if (s.run.account.positions[id]) TE.Trading.close(id, 'manual'); else if (TE.Trading.openCount()) TE.Trading.close(Object.keys(s.run.account.positions)[0], 'manual'); break;
      case 'x': if (TE.Trading.openCount()) TE.Trading.closeAll(); break;
      case '1': case '2': case '3': case '4': s.run.account.sizePct = [0.1, 0.25, 0.5, 1][+k - 1]; break;
      case '-': case '=': case '+': {
        const tiers = TE.Trading.levTiers();
        let i = tiers.indexOf(s.run.account.lev); if (i < 0) i = 0;
        i = U.clamp(i + (k === '-' ? -1 : 1), 0, tiers.length - 1);
        s.run.account.lev = tiers[i];
        break;
      }
      case '[': case ']': {
        const ids = Object.keys(s.run.unlocked).sort((a, b) => D.ASSET_MAP[a].order - D.ASSET_MAP[b].order);
        let i = ids.indexOf(id); i = (i + (k === ']' ? 1 : -1) + ids.length) % ids.length;
        s.run.activeAsset = ids[i];
        break;
      }
      case 'o': UI.claimOpp(); break;
      case 'm': UI.toggleSound(); break;
      case 'b': { const m = TE.Economy.BUY_MODES; s.run.buyMode = m[(m.indexOf(s.run.buyMode || 1) + 1) % m.length]; break; }
      case '?': case 'h': UI.showShortcuts(); break;
      default: {
        const ab = D.ABILITIES.find((a) => a.key.toLowerCase() === k);
        if (ab) TE.Events.useAbility(ab.id);
      }
    }
  }
  UI.toggleSound = function () {
    const s = S();
    s.settings.sound = !s.settings.sound;
    TE.Audio.init(); TE.Audio.resume(); TE.Audio.setVolume();
    TE.Audio.play('click');
  };
  UI.showShortcuts = function () {
    const rows = [['L', 'Ouvrir / renforcer un LONG sur le marché sélectionné'], ['S', 'Ouvrir / renforcer un SHORT'], ['Espace', 'Fermer la position'], ['X', 'Fermer toutes les positions'],
      ['1 – 4', 'Taille de position 10 % / 25 % / 50 % / 100 %'], ['- / =', 'Baisser / monter le levier'], ['[ / ]', 'Marché précédent / suivant'], ['O', 'Saisir l’opportunité'],
      ['Q W E R T Y U', 'Capacités'], ['B', 'Changer le mode d’achat (×1 ×10 ×25 ×100 MAX)'], ['Maj + 1–9', 'Changer de panneau'], ['Maj + 0', 'Vue Siège'], ['M', 'Couper le son'], ['Ctrl + S', 'Sauvegarder'], ['Molette / glisser', 'Zoomer / déplacer le graphique'], ['Double-clic sur le graphique', 'Revenir au direct']];
    UI.modal({ title: 'Raccourcis clavier', cls: 'modal-sm', body: '<div class="kb-list">' + rows.map((r) => '<div class="kb"><kbd>' + r[0] + '</kbd><span>' + r[1] + '</span></div>').join('') + '</div>', buttons: [{ label: 'Fermer', cls: 'btn-ghost' }] });
  };

  /* ======================= FEEDBACK WIRING ======================= */
  function wire() {
    const B = TE.Bus;
    B.on('trade:open', (t) => {
      TE.Audio.play('open');
      UI.activity('trade', '<b>' + t.id + '</b> ' + (t.side > 0 ? '<span class="up">LONG</span>' : '<span class="down">SHORT</span>') + ' x' + t.lev + ' · marge ' + U.money(t.margin));
    });
    B.on('trade:close', (t) => {
      const anchor = document.getElementById('pos-card') || document.getElementById('hstats');
      const big = Math.abs(t.total) > Math.max(1, TE.Economy.netWorth() * 0.08);
      if (t.reason === 'liq') {
        TE.Audio.play('liquidation');
        UI.FX.flash('red'); UI.FX.shake();
        UI.FX.float(window.innerWidth / 2 - 120, window.innerHeight * 0.38, 'LIQUIDÉ', 'down', true);
        UI.toast({ title: 'LIQUIDÉ — ' + t.asset, text: 'Marge perdue : ' + U.money(-t.net) + '. Votre réputation en prend un coup.', kind: 'bad', icon: '☠' });
      } else if (t.crit) {
        TE.Audio.play('crit');
        UI.FX.flash('gold');
        UI.FX.floatFrom(anchor, 'CRITIQUE ×' + U.fmt(t.crit, { dec: 0 }), 'gold', true);
        UI.FX.floatFrom(anchor, U.smoney(t.total), 'up', true);
        const r = anchor.getBoundingClientRect();
        UI.FX.burst(r.left + r.width / 2, r.top + 20, '#ffd36b', 60);
      } else if (t.net > 0) {
        TE.Audio.play(big ? 'bigprofit' : 'profit');
        UI.FX.floatFrom(anchor, U.smoney(t.total), 'up', big);
        if (big) UI.FX.flash('green');
      } else {
        TE.Audio.play('loss');
        UI.FX.floatFrom(anchor, U.smoney(t.total), 'down', big);
        if (big) UI.FX.flash('red');
      }
      const tag = { sl: ' [SL]', tp: ' [TP]', trail: ' [TRAIL]', liq: ' [LIQ]', reverse: ' [INV]' }[t.reason] || '';
      UI.activity('trade', '<b>' + t.asset + '</b> ' + (t.side > 0 ? 'LONG' : 'SHORT') + ' fermé ' + U.pct(t.pct, 1) + tag + (t.crit ? ' <span class="gold">CRITIQUE ×' + U.fmt(t.crit, { dec: 0 }) + '</span>' : ''), t.total);
      if (t.legendary && t.net > 0) UI.FX.stage({ kicker: 'TRADE LÉGENDAIRE', title: U.smoney(t.total), sub: 'On racontera encore cette histoire dans les salles de marché.', color: '#ffd36b' });
    });
    B.on('trade:fail', (msg) => { TE.Audio.play('deny'); UI.toast({ text: msg, kind: 'warn', icon: '!', dur: 2200 }); });
    let botNoteT = {};
    B.on('bot:batch', (b) => {
      const e = b.entry;
      const now = performance.now();
      const ref = Math.max(1, TE.Economy.passive());
      const notable = e.crit || e.blow || Math.abs(e.pnl) > ref * 4;
      if (!notable && (botNoteT[b.id] && now - botNoteT[b.id] < 6000)) return;
      if (!notable && Math.random() > 0.35) return;
      botNoteT[b.id] = now;
      const label = e.arb ? 'ARB' : e.side > 0 ? 'LONG' : 'SHORT';
      UI.activity('bot', '<span style="color:' + b.def.color + '">' + b.def.icon + '</span> ' + b.def.name + ' · ' + e.a + ' ' + label + ' ' + U.pct(e.pct, 2) + (e.n > 1 ? ' <span class="dim">(' + U.int(e.w) + 'G/' + U.int(e.n - e.w) + 'P)</span>' : '') +
        (e.crit ? ' <span class="gold">CRITIQUE ×' + U.fmt(e.crit, { dec: 0 }) + '</span>' : '') + (e.blow ? ' <span class="down">EXPLOSION</span>' : ''), e.pnl);
      if (e.crit) TE.Audio.play('crit');
      if (e.blow) { UI.toast({ title: 'EXPLOSION', text: 'La flotte « ' + b.def.name + ' » a subi une perte extrême : ' + U.money(-e.pnl), kind: 'bad', icon: '☠' }); UI.FX.flash('red'); }
    });
    B.on('bot:milestone', (x) => {
      const def = D.BOT_MAP[x.id];
      TE.Audio.play('unlock');
      UI.toast({ title: def.name + ' ×' + x.m.n, text: x.m.profit ? 'Profit de la flotte ×' + x.m.profit + ' !' : 'Vitesse de la flotte ×' + x.m.speed + ' !', kind: 'gold', icon: '⚡' });
      UI.FX.flash('gold');
    });
    B.on('bot:grade', (x) => UI.toast({ title: D.BOT_MAP[x.id].name + ' → ' + x.grade.name.toUpperCase(), text: 'Flotte promue au grade ' + x.grade.name + ' (+' + U.pct(x.grade.crit, 1, false) + ' de critique).', kind: 'gold', icon: '◆' }));
    B.on('bot:buy', () => TE.Audio.play('buy'));
    B.on('upgrade:buy', (u) => { TE.Audio.play('buy'); UI.activity('firm', 'Amélioration : <b>' + UI.esc(u.name) + '</b>'); });
    B.on('infra:buy', () => TE.Audio.play('buy'));
    B.on('staff:hire', () => TE.Audio.play('buy'));
    B.on('legend:hire', (l) => { TE.Audio.play('achievement'); UI.FX.stage({ kicker: 'RECRUE LÉGENDAIRE', title: l.name, sub: '« ' + l.quote + ' »', color: '#ffb627' }); });
    B.on('office:upgrade', (o) => { TE.Audio.play('milestone'); UI.FX.stage({ kicker: 'NOUVEAU SIÈGE', title: o.name.toUpperCase(), sub: o.desc, color: '#19e6ff' }); });
    B.on('research:done', (n) => { TE.Audio.play('research'); UI.activity('firm', 'Recherche terminée : <b>' + UI.esc(n.name) + '</b>'); UI.toast({ title: 'RECHERCHE TERMINÉE', text: n.name, kind: 'violet', icon: '⚗', dur: 2600 }); });
    B.on('feature:unlock', (f) => {
      if (f.id === 'market' || f.id === 'settings') return;
      TE.Audio.play('unlock');
      UI.FX.banner(f.name.toUpperCase(), featureBlurb(f.id));
      updateNav();
      if (f.id === 'office' || f.id === 'evolution') TE.World.tip(f.id);
    });
    B.on('asset:unlocked', (id) => {
      const d = D.ASSET_MAP[id];
      UI.toast({ title: 'NOUVEAU MARCHÉ — ' + id, text: d.name + ' · ' + d.desc, kind: 'info', icon: '◱' });
      TE.Events.news({ cat: 'MARCHÉS', text: d.name + ' (' + id + ') est désormais négociable sur votre desk.', asset: id, impact: 'LOW' });
      buildTicker();
    });
    B.on('achievement', (a) => {
      TE.Audio.play('achievement');
      UI.toast({ title: 'SUCCÈS — ' + a.name, text: a.desc + '  (+2 % sur tous les revenus)', kind: 'gold', icon: '★' });
    });
    B.on('milestone', (x) => {
      if (x.first) { TE.Audio.play('milestone'); UI.FX.stage({ kicker: 'CAP FRANCHI', title: x.m.title, value: U.money(x.m.at, { dec: 0 }), sub: x.m.sub, color: '#19f58c' }); }
      else UI.toast({ title: x.m.title, text: U.money(x.m.at, { dec: 0 }) + ' atteints.', kind: 'ok', icon: '◆', dur: 2500 });
    });
    B.on('era', (era) => {
      TE.Audio.play('milestone');
      UI.FX.stage({ kicker: 'ÈRE ' + era.roman, title: era.name.toUpperCase(), sub: era.tag, cls: 'stage-era', dur: 3400, color: '#19e6ff' });
    });
    B.on('event:incoming', (x) => {
      if (x.inst.lead > 0) UI.toast({ title: '⚠ EN APPROCHE — ' + x.def.name, text: TE.Events.fill(x.def.desc, x.inst.ctx), kind: x.def.tone === 'neg' ? 'warn' : 'info', icon: x.def.icon, dur: 3800 });
    });
    B.on('event:start', (x) => {
      TE.Audio.play('alert');
      UI.activity('firm', '<b>ÉVÉNEMENT</b> ' + x.def.icon + ' ' + x.def.name);
      if (x.def.id === 'quant_bug') UI.toast({ title: 'BUG QUANT — ' + x.inst.ctx.bot, text: 'Mettez la flotte en pause dans BOTS pour stopper l’hémorragie !', kind: 'bad', icon: '🐞' });
    });
    B.on('market:saturated', () => {
      TE.Audio.play('alert');
      const canP1 = TE.Prestige.canP1();
      UI.toast({ title: 'MARCHÉS SATURÉS', kind: 'warn', icon: '≋', dur: 9000,
        text: 'Vos stratégies se disputent désormais les mêmes opportunités : de nouveaux bots rapportent peu. Débloquez des marchés, achetez des améliorations de capacité, survivez à la crise de l’ère pour avancer' + (canP1 ? ', ou LIQUIDEZ pour gagner de l’α.' : '.') + ' (Survolez la jauge de saturation dans BOTS.)' });
    });
    /* ---------- V2: the living world ---------- */
    B.on('tip', (x) => { if (S().settings.tutorial !== false) UI.tipCard(x.tip); });
    B.on('trade:impact', (e) => {
      if (e.label === 'IMPORTANT' || e.label === 'MASSIF') {
        if (UI.marketChart) UI.marketChart.flashImpact(e.id, e.side, e.pct);
        if (e.kind === 'open' || e.kind === 'close') UI.activity('trade', '<b>' + e.id + '</b> impact ' + e.label + ' · prix ' + U.pct(e.side * e.pct, 2) + ' · glissement ' + U.pct(e.slip, 2, false));
        if (e.label === 'MASSIF') UI.FX.shake();
      }
    });
    B.on('world:news', (x) => {
      if (!x.me) return;
      TE.Audio.play('alert');
      UI.toast({ title: 'ON PARLE DE VOUS', text: x.n.text, kind: 'violet', icon: '◉', dur: 5200 });
      UI.FX.pulse(document.getElementById('sc-news'), 'pulse');
    });
    B.on('world:att', (x) => { if (x.idx >= 2) UI.toast({ title: 'ATTENTION DU MARCHÉ — ' + x.lvl.name.toUpperCase(), text: x.lvl.desc, kind: 'info', icon: '◉', dur: 5000 }); });
    B.on('world:regLevel', (x) => { TE.Audio.play('alert'); UI.toast({ title: x.lvl >= 2 ? 'RÉGULATEURS EN ALERTE' : 'LES RÉGULATEURS S’INTÉRESSENT À VOUS', text: x.lvl >= 2 ? 'Pression réglementaire élevée : amendes et scandales deviennent possibles.' : 'Au-delà de 30 % de pression, des contrôles peuvent tomber.', kind: x.lvl >= 2 ? 'bad' : 'warn', icon: '⚖', dur: 6000 }); UI.FX.pulse(document.getElementById('sc-world'), 'pulse'); });
    B.on('world:reg', (x) => {
      TE.Audio.play('alert');
      const t = x.act.id === 'fine' ? 'Amende : ' + U.money(x.amount) + ' et réputation -3 %.' : x.act.id === 'restrict' ? 'Levier limité à x10 pendant 2 minutes.' : x.act.id === 'scandal' ? 'Réputation -8 %, les investisseurs retirent des fonds.' : x.act.id === 'audit' ? 'Contrôle en cours.' : 'Les régulateurs demandent des explications.';
      UI.toast({ title: 'RÉGULATEUR — ' + x.act.name, text: t, kind: x.act.id === 'inquiry' ? 'warn' : 'bad', icon: '⚖', dur: 6500 });
      if (x.act.id === 'fine' || x.act.id === 'scandal') UI.FX.flash('red');
    });
    B.on('world:restrictEnd', () => UI.toast({ title: 'RESTRICTION LEVÉE', text: 'Vous pouvez de nouveau utiliser tout votre levier.', kind: 'ok', icon: '⚖', dur: 3000 }));
    B.on('market:squeeze', (e) => {
      TE.Audio.play('crit');
      if (e.me) UI.FX.stage({ kicker: 'SHORT SQUEEZE — ' + e.id, title: 'LA BALEINE, C’EST VOUS', sub: 'Les vendeurs à découvert sont forcés de racheter. Le marché s’emballe.', color: '#19f58c' });
      else UI.toast({ title: 'SHORT SQUEEZE — ' + e.id, text: 'Les vendeurs à découvert rachètent en catastrophe : hausse violente.', kind: 'gold', icon: '⇈', dur: 5000 });
    });
    B.on('market:cascade', (e) => {
      TE.Audio.play('alert');
      if (e.me) UI.FX.stage({ kicker: 'CASCADE DE LIQUIDATIONS — ' + e.id, title: 'EFFET DOMINO', sub: 'Vos ventes ont fait sauter les acheteurs à levier.', color: '#ff3d68', cls: 'stage-crisis' });
      else UI.toast({ title: 'CASCADE DE LIQUIDATIONS — ' + e.id, text: 'Les LONG à levier sautent en chaîne : chute brutale.', kind: 'bad', icon: '⇊', dur: 5000 });
    });
    B.on('rival:overtook', (r) => UI.toast({ title: 'DÉPASSÉ PAR ' + r.name.toUpperCase(), text: r.name + ' vous passe devant au classement mondial.', kind: 'warn', icon: '▼', dur: 4500 }));
    B.on('rival:attack', (x) => { TE.Audio.play('alert'); UI.toast({ title: 'ATTAQUE — ' + x.rival.name, text: x.rival.name + ' prend position contre vous sur ' + x.id + '.', kind: 'bad', icon: '⚔', dur: 5500 }); });
    B.on('rival:trouble', (r) => UI.toast({ title: r.name + ' EN DIFFICULTÉ', text: 'Rachat possible avec 35 % de décote pendant 5 minutes (EMPIRE).', kind: 'gold', icon: '◆', dur: 6000 }));
    let fundNoteT = 0;
    B.on('fund:note', (x) => {
      const now = performance.now();
      if (now - fundNoteT < 9000) return;
      fundNoteT = now;
      if (x.kind === 'in') UI.toast({ title: (D.INVESTOR_MAP[x.cls] ? D.INVESTOR_MAP[x.cls].name.toUpperCase() : 'INVESTISSEUR') + ' +' + U.money(x.amount), text: x.who + ' — Motif : ' + (x.why || '—'), kind: 'violet', icon: '◈', dur: 4800 });
      else UI.toast({ title: 'RETRAITS −' + U.money(x.amount), text: 'Motif : ' + (x.why || '—'), kind: 'bad', icon: '◈', dur: 5200 });
    });
    B.on('calendar:resolve', (x) => { if (x.asset && x.asset === S().run.activeAsset) TE.Audio.play('alert'); });
    B.on('timeline', (e) => { if (e.rec) UI.toast({ title: 'NOUVEAU RECORD', text: e.l + ' en ' + U.dur(e.t) + ' (meilleur temps toutes parties confondues).', kind: 'gold', icon: '⟰', dur: 4500 }); });
    B.on('crisis:warning', (def) => { TE.Audio.play('alert'); UI.toast({ title: 'AVIS DE TEMPÊTE', text: def.name + ' approche. ' + def.warnText, kind: 'warn', icon: '⚠', dur: 6000 }); });
    B.on('crisis:start', (def) => { TE.Audio.play('crisis'); UI.FX.flash('red'); UI.FX.stage({ kicker: 'CRISE ÉCONOMIQUE', title: def.name, sub: def.intro + ' Tenez ' + U.dur(def.dur) + '.', cls: 'stage-crisis', color: '#ff3d68', dur: 3200 }); });
    B.on('crisis:phase', (x) => { TE.Audio.play('alert'); UI.toast({ title: 'PHASE — ' + x.phase.name.toUpperCase(), text: 'Volatilité ' + U.mult(x.phase.vol) + ', corrélations ' + U.pct(x.phase.corr, 0, false) + '.', kind: 'bad', icon: '☠' }); });
    B.on('crisis:end', (x) => {
      TE.Audio.play(x.ok === 2 ? 'milestone' : 'unlock');
      UI.modal({ title: x.def.name + ' — ' + (x.ok === 2 ? 'TERRASSÉE' : x.ok === 1 ? 'SURMONTÉE' : 'SURMONTÉE (DE JUSTESSE)'), cls: 'modal-sm', body:
        '<div class="crisis-res">' + ['dd', 'profit'].map((k) => '<div class="cr-g ' + (x.goals[k].ok ? 'ok' : 'ko') + '">' + (x.goals[k].ok ? '✔ ' : '✖ ') + x.goals[k].label + ' <b>' + x.goals[k].val + '</b></div>').join('') +
        '<div class="cr-r">Récompense : <b class="up">' + U.money(x.cash) + '</b>' + (x.mult > 1 ? ' et <b class="gold">tous les revenus ' + U.mult(x.mult) + '</b> pour le reste de la partie' : '') + '.</div></div>',
        buttons: [{ label: 'Continuer', cls: 'btn-primary' }] });
    });
    B.on('opp:spawn', () => TE.Audio.play('opportunity'));
    B.on('fund:founded', (name) => { TE.Audio.play('milestone'); UI.FX.stage({ kicker: 'HEDGE FUND FONDÉ', title: name.toUpperCase(), sub: 'Les investisseurs peuvent désormais confier leur capital à vos stratégies. Les frais sont pour vous.', color: '#a77bff' }); });
    B.on('fund:inflow', (e) => {
      UI.activity('firm', 'Nouvel investisseur : ' + UI.esc(e.who) + ' <span class="dim">(' + D.INVESTOR_MAP[e.cls].name + ')</span>', e.amount);
      if (e.cls === 'inst' || e.cls === 'sovereign' || e.cls === 'planetary') UI.toast({ title: 'NOUVEL INVESTISSEUR', text: e.who + ' engage ' + U.money(e.amount), kind: 'violet', icon: '◈' });
    });
    B.on('vip:offer', (o) => UI.toast({ title: 'PROPOSITION DE MANDAT VIP', text: o.client + ' souhaite allouer ' + U.money(o.commit) + '. Voir le panneau FONDS.', kind: 'violet', icon: '♛' }));
    B.on('vip:done', (x) => UI.toast({ title: x.ok ? 'MANDAT VIP REMPLI' : 'MANDAT VIP ÉCHOUÉ', text: x.ok ? x.a.client + ' est ravi. +' + U.money(x.a.reward.cash) : x.a.client + ' a retiré son capital.', kind: x.ok ? 'gold' : 'bad', icon: '♛' }));
    B.on('contract:done', (c) => { TE.Audio.play('profit'); UI.toast({ title: 'CONTRAT REMPLI', text: TE.Contracts.title(c) + ' — ' + TE.Contracts.rewardText(c.reward), kind: 'ok', icon: '✎' }); UI.activity('firm', 'Contrat rempli : ' + UI.esc(TE.Contracts.title(c)), c.reward.cash); });
    B.on('acq:buy', (a) => { TE.Audio.play('milestone'); UI.FX.stage({ kicker: 'ACQUISITION FINALISÉE', title: a.name.toUpperCase(), sub: a.desc, color: '#ff4fd8' }); });
    B.on('office:open', (c) => { TE.Audio.play('unlock'); UI.toast({ title: 'BUREAU OUVERT — ' + c.name, text: c.desc, kind: 'info', icon: '◉' }); });
    B.on('rival:passed', (r) => { TE.Audio.play('unlock'); UI.toast({ title: 'DÉPASSÉ : ' + r.name, text: 'Vous êtes désormais plus gros que ' + r.name + '. Classement mondial : #' + U.int(TE.Empire.rank()) + '.', kind: 'gold', icon: '▲' }); });
    B.on('rival:bought', (r) => { TE.Audio.play('milestone'); UI.FX.stage({ kicker: 'OPA HOSTILE', title: r.name.toUpperCase(), sub: 'Leurs desks, leurs clients, leur alpha. Tout est à vous.', color: '#ff4fd8' }); });
    B.on('vc:exit', (x) => {
      if (x.m >= 10) { TE.Audio.play('bigprofit'); UI.toast({ title: x.m >= 50 ? 'LICORNE ! ×' + x.m : 'BELLE SORTIE ×' + x.m, text: x.d.name + ' a rapporté ' + U.money(x.payout), kind: 'gold', icon: '✦' }); }
      UI.activity('firm', 'Sortie de capital-risque : ' + UI.esc(x.d.name) + ' ×' + U.fmt(x.m), x.payout - x.d.invested);
    });
    B.on('prestige', (info) => {
      TE.Audio.play('prestige');
      const names = { 1: ['EMPIRE LIQUIDÉ', '+' + U.int(info.gain) + ' α'], 2: ['LEGACY DE MARCHÉ', '+' + U.int(info.gain) + ' Λ'], 3: ['SINGULARITÉ FINANCIÈRE', '+' + U.int(info.gain) + ' ✦'] };
      const n = names[info.layer];
      document.getElementById('app').classList.add('prestige-fx');
      setTimeout(() => document.getElementById('app').classList.remove('prestige-fx'), 1600);
      UI.FX.stage({ kicker: n[0], title: n[1], sub: 'Une nouvelle partie commence. Tout ira plus vite désormais.', cls: 'stage-prestige', dur: 3600, color: '#ffd36b' });
      UI.rebuildAll();
    });
    B.on('challenge:complete', (c) => UI.toast({ title: 'DÉFI RÉUSSI — ' + c.name, text: c.rewardText, kind: 'gold', icon: '★', dur: 6000 }));
    B.on('saved', () => { savedFlash = Date.now(); });
    B.on('save:error', () => UI.toast({ text: 'Échec de la sauvegarde (stockage plein ou bloqué).', kind: 'bad', icon: '!' }));
    B.on('caughtup', (x) => UI.toast({ title: 'DE RETOUR DANS LA PARTIE', dur: 6000, text: U.dur(x.sec) + ' en arrière-plan' + (x.gained ? ' : +' + U.money(x.gained) : '') + (x.offline && x.res ? ' (règles hors ligne : efficacité ' + U.pct(x.res.eff, 0, false) + (x.res.away > x.res.counted + 1 ? ', plafonnée à ' + U.dur(x.res.counted) : '') + ')' : '') + '.', kind: 'info', icon: '⧗' }));
    B.on('family:loan', () => UI.toast({ title: 'LA BANQUE DE MAMAN', text: 'Maman vous a viré 100 $. Encore. « Fais attention cette fois, mon trésor. »', kind: 'info', icon: '♥' }));
    B.on('macro', (id) => { if (id !== 'crisis') UI.activity('firm', 'MACRO → <b>' + D.MACRO[id].name.toUpperCase() + '</b>'); });
    B.on('ability:use', (a) => { TE.Audio.play('unlock'); UI.toast({ title: a.name.toUpperCase(), text: a.desc, kind: 'info', icon: a.icon, dur: 2000 }); });
    B.on('perk:buy', () => TE.Audio.play('buy'));
    B.on('div:milestone', (x) => UI.toast({ title: D.DIV_MAP[x.id].name + ' — niveau ' + x.lvl, text: 'Revenus de la division ×2 !', kind: 'gold', icon: '⚡' }));
    B.on('news', (n) => { if (n.asset && n.asset === S().run.activeAsset && n.impact === 'HIGH') UI.FX.pulse(document.querySelector('.sc-news'), 'pulse'); });
  }
  function featureBlurb(id) {
    return ({
      upgrades: 'Des améliorations permanentes pour votre trading.', bots: 'Des stratégies automatiques qui tradent pour vous.', portfolio: 'Positions, historique et risque en un coup d’œil.',
      contracts: 'Des objectifs avec des récompenses bonus.', research: 'Un arbre technologique alimenté par les points de recherche.', infra: 'Du matériel qui accélère vos bots.',
      staff: 'Embauchez traders, quants et ingénieurs.', fund: 'Gérez l’argent des autres. Encaissez le 2 et 20.', empire: 'Acquisitions, divisions et domination mondiale.',
      achievements: 'Chaque succès : +2 % sur tous les revenus.', stats: 'Tous les chiffres de votre carrière.', prestige: 'Liquidez l’empire contre de l’Alpha permanent.',
      office: 'Votre société prend vie : équipes, serveurs, légendes.', evolution: 'Votre ascension, palier par palier.',
    })[id] || '';
  }

  /* ======================= INIT / FRAME ======================= */
  UI.rebuildAll = function () {
    Object.keys(UI.viewEls).forEach((k) => { UI.viewEls[k].remove(); });
    UI.viewEls = {};
    tickerSig = '';
    buildTicker();
    if (!S().profile.features[UI.active]) UI.active = 'market';
    const id = UI.active;
    UI.active = null;
    UI.go(id);
    const list = document.getElementById('act-list'); if (list) list.innerHTML = '';
    renderNews(true);
  };
  UI.init = function () {
    document.body.className = 'theme-' + S().settings.theme + (S().settings.scanlines ? ' scan' : '') + (S().settings.animations ? '' : ' no-anim');
    buildHeader();
    buildNav();
    buildSide();
    buildStatus();
    buildTicker();
    UI.initTooltips();
    wire();
    document.addEventListener('keydown', onKey);
    const start = S().profile.uiView && S().profile.features[S().profile.uiView] ? S().profile.uiView : 'market';
    UI.active = null;
    UI.go(start);
    UI.update();
  };
  let slow = 0;
  UI.update = function () {
    updateHeader();
    updateSide();
    updateStatus();
    if (++slow % 3 === 0) { updateNav(); updateTicker(); buildTicker(); }
    const v = UI.views[UI.active];
    if (v && v.update) v.update(false);
    S().profile.uiView = UI.active;
    UI.coach(TE.Progress.tutorial());
  };
  UI.frame = function (now, doUpdate) {
    if (doUpdate) UI.update();
    const v = UI.views[UI.active];
    if (v && v.frame) v.frame(now);
  };
})(window.TE);
