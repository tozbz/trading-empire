/* CONTRACTS (+ daily challenge), ACHIEVEMENTS, STATISTICS, PRESTIGE and SETTINGS views. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const S = () => TE.state;

  /* =============================== CONTRACTS =============================== */
  const C = {};
  function ctBuild(root) {
    root.innerHTML = '';
    C.list = h('div', { class: 'contract-list' });
    C.info = h('span', { class: 'card-hr dim' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Contrats' }), C.info]),
      h('div', { class: 'dim small', text: 'Clients et partenaires vous fixent des objectifs. Atteignez-les pour gagner de l’argent, de la recherche, de la réputation ou des bonus temporaires. Les récompenses suivent vos revenus.' })]));
    root.appendChild(C.list);
    C.daily = h('div', { class: 'card daily' });
    root.appendChild(C.daily);
    C.sig = ''; C.dsig = '';
  }
  function progText(c) {
    switch (c.tpl) {
      case 'earn': case 'botprofit': case 'aum': case 'bigtrade': return U.money(Math.min(c.prog, c.target)) + ' / ' + U.money(c.target);
      case 'hold': return Math.floor(Math.min(c.prog, c.target)) + ' s / ' + c.target + ' s';
      default: return U.int(Math.min(c.prog, c.target)) + ' / ' + U.int(c.target);
    }
  }
  function ctUpdate() {
    const s = S();
    if (!C.list) return;
    const list = s.run.contracts.list;
    UI.text(C.info, list.length + ' / ' + TE.Contracts.slots() + ' actifs · ' + U.int(s.profile.stats.contracts || 0) + ' remplis');
    const sig = list.map((c) => c.cid).join(',');
    if (sig !== C.sig) {
      C.sig = sig;
      C.list.innerHTML = '';
      C.cards = {};
      if (!list.length) C.list.appendChild(h('div', { class: 'card empty', text: 'De nouveaux contrats sont en cours de négociation…' }));
      list.forEach((c) => {
        const x = {};
        x.el = h('div', { class: 'card contract' }, [
          h('div', { class: 'ct-h' }, [h('span', { class: 'ct-i', text: '✎' }), h('b', { text: TE.Contracts.title(c) }), x.timer = h('span', { class: 'ct-t' })]),
          x.bar = UI.pbar(), x.prog = h('div', { class: 'small' }),
          h('div', { class: 'ct-f' }, [h('span', { class: 'ct-r' }, ['Récompense : ', x.reward = h('b', { class: 'gold' })]), x.reroll = h('button', { class: 'btn btn-ghost btn-xs', text: '↻ Changer', tip: 'Remplacer ce contrat (recharge de 60 s)', on: { click: () => TE.Contracts.reroll(c.cid) } })]),
        ]);
        C.cards[c.cid] = x;
        C.list.appendChild(x.el);
      });
    }
    list.forEach((c) => {
      const x = C.cards[c.cid];
      if (!x) return;
      x.bar._set(c.prog / c.target);
      UI.text(x.prog, progText(c));
      UI.text(x.reward, TE.Contracts.rewardText(c.reward));
      UI.text(x.timer, c.deadline ? '⏱ ' + U.clock(c.deadline - s.run.time) : '');
      const cd = s.run.contracts.reroll - s.run.time;
      x.reroll.disabled = cd > 0;
      UI.text(x.reroll, cd > 0 ? '↻ ' + Math.ceil(cd) + ' s' : '↻ Changer');
    });
    // daily
    const best = TE.Daily.best();
    const claimed = TE.Daily.claimed();
    const dsig = TE.Daily.key() + '|' + best + '|' + claimed + '|' + s.profile.daily.streak;
    if (dsig !== C.dsig) {
      C.dsig = dsig;
      const asset = TE.Daily.asset();
      const tier = best !== undefined ? TE.Daily.tierOf(best) : null;
      C.daily.innerHTML = '';
      C.daily.appendChild(h('div', { class: 'card-h' }, [h('span', { text: 'Défi de marché quotidien' }), h('span', { class: 'card-hr', text: TE.Daily.key().replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') })]));
      C.daily.appendChild(h('div', { class: 'daily-body' }, [
        h('div', {}, [
          h('p', { class: 'dim', html: 'Le même marché pour tous les joueurs aujourd’hui. <b>' + TE.Daily.DURATION + ' secondes</b>, <b>' + U.money(TE.Daily.START, { dec: 0 }) + '</b>, levier jusqu’à x10. Battez votre meilleur rendement.' }),
          h('div', { class: 'small', html: 'Instrument du jour : <b>' + asset.name + '</b> (se comporte comme ' + asset.baseId + ')' }),
          h('div', { class: 'tiers', html: TE.Daily.TIERS.map((t) => '<span class="tier t-' + t.cls + '">' + t.name + ' ≥ ' + U.pct(t.min, 0) + ' → revenus ' + U.mult(t.mult) + ' (10 min)</span>').join('') }),
        ]),
        h('div', { class: 'daily-side' }, [
          h('div', { class: 'kv' }, [h('span', { class: 'kv-l', text: 'Meilleur aujourd’hui' }), h('span', { class: 'kv-v ' + (best !== undefined ? UI.dir(best) : ''), text: best !== undefined ? U.pct(best, 2) + (tier ? ' · ' + tier.name : '') : '—' })]),
          h('div', { class: 'kv' }, [h('span', { class: 'kv-l', text: 'Série' }), h('span', { class: 'kv-v', text: s.profile.daily.streak + ' jour' + (s.profile.daily.streak > 1 ? 's' : '') })]),
          h('div', { class: 'kv' }, [h('span', { class: 'kv-l', text: 'Récompense' }), h('span', { class: 'kv-v', text: claimed ? 'Récupérée aujourd’hui ✔' : 'Disponible' })]),
          h('button', { class: 'btn btn-primary big', text: best !== undefined ? '▶ REJOUER' : '▶ JOUER LE DÉFI DU JOUR', on: { click: () => TE.DailyUI.open() } }),
        ]),
      ]));
    }
  }
  UI.views.contracts = { build: ctBuild, update: ctUpdate };

  /* =============================== ACHIEVEMENTS =============================== */
  const A = {};
  function achBuild(root) {
    root.innerHTML = '';
    A.head = h('div', { class: 'card' });
    root.appendChild(A.head);
    A.body = h('div', {});
    root.appendChild(A.body);
    A.sig = '';
  }
  function achUpdate() {
    const s = S();
    if (!A.body) return;
    const n = TE.Achievements.count();
    const sig = String(n);
    if (sig === A.sig) return;
    A.sig = sig;
    A.head.innerHTML = '';
    A.head.appendChild(h('div', { class: 'card-h' }, [h('span', { text: 'Succès' }), h('span', { class: 'card-hr', html: '<b>' + n + '</b> / ' + D.ACHIEVEMENTS.length + ' · <span class="up">+' + Math.round(n * D.ACH_BONUS * 100) + ' % sur tous les revenus</span>' })]));
    const bar = UI.pbar(); bar._set(n / D.ACHIEVEMENTS.length);
    A.head.appendChild(bar);
    A.body.innerHTML = '';
    const cats = [];
    D.ACHIEVEMENTS.forEach((a) => { if (cats.indexOf(a.cat) < 0) cats.push(a.cat); });
    cats.forEach((cat) => {
      const items = D.ACHIEVEMENTS.filter((a) => a.cat === cat);
      const got = items.filter((a) => s.profile.achievements[a.id]).length;
      const grid = h('div', { class: 'ach-grid' });
      items.forEach((a) => {
        const un = s.profile.achievements[a.id];
        const hid = a.hidden && !un;
        grid.appendChild(h('div', { class: 'ach' + (un ? ' got' : '') + (hid ? ' hidden' : ''), tip: hid ? 'Succès caché. Continuez à jouer.' : '<div class="tt-title">' + a.name + '</div><div>' + a.desc + '</div>' + (un ? '<div class="tt-dim">Débloqué le ' + new Date(un).toLocaleString('fr-FR') + '</div>' : '') }, [
          h('div', { class: 'ach-i', text: un ? '★' : hid ? '?' : '☆' }), h('div', { class: 'ach-n', text: hid ? '???' : a.name }), h('div', { class: 'ach-d', text: hid ? 'Caché' : a.desc }),
        ]));
      });
      A.body.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: cat }), h('span', { class: 'card-hr dim', text: got + ' / ' + items.length })]), grid]));
    });
  }
  UI.views.achievements = { build: achBuild, update: achUpdate };

  /* =============================== STATISTICS =============================== */
  const St = {};
  function statBuild(root) { root.innerHTML = ''; St.root = root; St.t = 0; }
  function statUpdate(force) {
    const s = S();
    if (!St.root) return;
    if (!force && performance.now() - St.t < 1000) return;
    St.t = performance.now();
    const ls = s.profile.stats, rs = s.run.stats, rec = s.profile.records, pr = s.profile.prestige;
    const g = (o, k) => o[k] || 0;
    const sec = (title, rows) => '<div class="card"><div class="card-h"><span>' + title + '</span></div><div class="stat-list">' + rows.map((r) => '<div class="stat"><span>' + r[0] + '</span><b class="' + (r[2] || '') + '">' + r[1] + '</b></div>').join('') + '</div></div>';
    const wr = (o) => (g(o, 'trades') ? U.pct(g(o, 'wins') / g(o, 'trades'), 1, false) : '—');
    const avgWin = g(ls, 'wins') ? U.money(g(ls, 'manualProfit') / g(ls, 'wins')) : '—';
    const avgLoss = g(ls, 'losses') ? U.money(g(ls, 'manualLoss') / g(ls, 'losses')) : '—';
    const html = '<div class="stats-grid">' +
      sec('Carrière', [['Temps de jeu', U.dur(s.profile.playtime)], ['Argent généré (total)', U.money(g(ls, 'earned'))], ['Argent dépensé', U.money(g(ls, 'spent'))], ['Prestiges (α / Λ / ✦)', pr.p1 + ' / ' + pr.p2 + ' / ' + pr.p3],
        ['Succès', TE.Achievements.count() + ' / ' + D.ACHIEVEMENTS.length], ['Ère la plus haute', 'Ère ' + (D.ERAS[(rec.bestEra || 1) - 1] || D.ERAS[0]).roman], ['Meilleur classement mondial', rec.bestRank ? '#' + U.int(rec.bestRank) : '—'], ['Défis quotidiens joués', U.int(g(ls, 'dailyPlayed'))]]) +
      sec('Trading manuel (total)', [['Trades clôturés', U.int(g(ls, 'trades'))], ['Gagnants / perdants', U.int(g(ls, 'wins')) + ' / ' + U.int(g(ls, 'losses'))], ['Taux de réussite', wr(ls)], ['Gain moyen', avgWin, 'up'], ['Perte moyenne', avgLoss, 'down'],
        ['Profits de trading cumulés', U.money(g(ls, 'manualProfit')), 'up'], ['Pertes de trading cumulées', U.money(g(ls, 'manualLoss')), 'down'], ['Frais payés', U.money(g(ls, 'feesPaid'))], ['Liquidations', U.int(g(ls, 'liquidations'))], ['Profits critiques', U.int(g(ls, 'crits'))],
        ['SHORT ouverts', U.int(g(ls, 'shorts'))], ['Ordres exécutés', U.int(g(ls, 'ordersFilled'))]]) +
      sec('Records', [['Meilleur trade', U.smoney(rec.bestTrade || 0), 'up'], ['Pire trade', U.smoney(rec.worstTrade || 0), 'down'], ['Meilleur rendement sur marge', U.pct(rec.bestPct || 0, 0)], ['Meilleure série gagnante', U.int(rec.bestStreak || 0)],
        ['Plus gros levier gagnant', 'x' + U.fmt(rec.maxLevWin || 1, { dec: 0 })], ['Plus gros critique', '×' + U.fmt(rec.biggestCrit || 0, { dec: 0 })], ['Valeur nette record', U.money(rec.maxNW || 0)], ['Revenu record', U.money(rec.maxIncome || 0) + '/s'],
        ['AUM max', U.money(rec.maxAUM || 0)], ['Influence max', U.pct(rec.maxInfluence || 0, 3, false)], ['Drawdown max du fonds', U.pct(rec.maxDD || 0, 1, false)], ['Premier million le plus rapide', rec.fastMillion ? U.dur(rec.fastMillion) : '—']]) +
      sec('Automatisation et société', [['Bots déployés', U.int(g(ls, 'botsBought'))], ['Trades exécutés par les bots', U.fmt(g(ls, 'botTrades'), { dec: 0 })], ['Record de bots simultanés', U.int(rec.maxBots || 0)], ['Critiques des bots', U.int(g(ls, 'critsBot'))],
        ['Employés embauchés', U.int(g(ls, 'staffHired'))], ['Légendes recrutées', U.int(g(ls, 'legends'))], ['Recherches terminées', U.int(g(ls, 'researchDone'))], ['Améliorations achetées', U.int(g(ls, 'upgradesBought'))],
        ['Frais de fonds encaissés', U.money(g(ls, 'fees'))], ['Acquisitions', U.int(g(ls, 'acquisitions'))], ['Deals de capital-risque', U.int(g(ls, 'vcDeals'))], ['Meilleur multiple en capital-risque', '×' + U.fmt(rec.bestVC || 0, { dec: 1 })]]) +
      sec('Cette partie', [['Durée de la partie', U.dur(s.run.time)], ['Généré', U.money(s.run.earnings)], ['Ère', TE.Progress.era().name], ['Trades', U.int(g(rs, 'trades')) + ' (' + wr(rs) + ')'], ['Trades des bots', U.fmt(g(rs, 'botTrades'), { dec: 0 })],
        ['Événements vécus', U.int(g(rs, 'events'))], ['Contrats', U.int(g(rs, 'contracts'))], ['Opportunités saisies', U.int(g(rs, 'opportunities'))], ['Défi', s.run.challenge ? D.CHALLENGE_MAP[s.run.challenge].name : 'Aucun']]) +
      sec('Événements', [['Événements de marché', U.int(g(ls, 'events'))], ['Crises surmontées', U.int(g(ls, 'crisesSurvived'))], ['Crises terrassées', U.int(g(ls, 'crisisPerfect'))], ['Opportunités', U.int(g(ls, 'opportunities'))], ['Contrats', U.int(g(ls, 'contracts'))], ['Mandats VIP', U.int(g(ls, 'vipDone'))]]) +
      sec('Monde', [['Mentions dans les médias', U.int(g(ls, 'headlines'))], ['Attention maximale', U.int(rec.maxAtt || 0)], ['Ordres à impact MASSIF', U.int(g(ls, 'massiveOrders'))], ['Short squeezes provoqués', U.int(g(ls, 'squeezeMe'))],
        ['Cascades provoquées', U.int(g(ls, 'cascadeMe'))], ['Amendes reçues', U.int(g(ls, 'fines'))], ['Pertes de trading comptabilisées', U.money(g(ls, 'lost'))], ['Squeezes observés (monde)', U.int((s.market.agm || {}).squeezes || 0)]]
        .concat(s.profile.debugUsed ? [['Outils de développement utilisés', U.int(s.profile.debugUsed) + ' fois']] : [])) +
      '</div>';
    UI.html(St.root, html);
  }
  UI.views.stats = { build: statBuild, update: statUpdate };

  /* =============================== PRESTIGE =============================== */
  const P = { challenge: null };
  function prBuild(root) { root.innerHTML = ''; P.root = root; P.sig = ''; }
  function perkGrid(layer, list, levels, currency, sym) {
    const grid = h('div', { class: 'perk-grid' });
    list.forEach((d) => {
      const lvl = levels[d.id] || 0;
      const maxed = lvl >= d.max;
      const cost = TE.Prestige.perkCost(d, lvl);
      const can = !maxed && currency >= cost;
      grid.appendChild(h('div', { class: 'perk' + (maxed ? ' maxed' : '') + (lvl ? ' owned' : '') }, [
        h('div', { class: 'pk-h' }, [h('span', { class: 'pk-i', text: d.icon }), h('b', { text: d.name }), h('span', { class: 'pk-l', text: lvl + '/' + d.max })]),
        h('div', { class: 'small', text: lvl ? d.desc(lvl) : 'Niv. 1 : ' + d.desc(1) }),
        !maxed && lvl > 0 ? h('div', { class: 'small dim', text: 'Suivant : ' + d.desc(lvl + 1) }) : null,
        h('button', { class: 'btn-buy sm' + (can ? ' afford' : ''), disabled: !can, on: { click: () => { if (TE.Prestige.buyPerk(layer, d.id)) P.sig = ''; } } }, [h('span', { class: 'bb-l', text: maxed ? 'AU MAXIMUM' : lvl ? 'AMÉLIORER' : 'DÉBLOQUER' }), h('span', { class: 'bb-c', text: maxed ? '—' : U.int(cost) + ' ' + sym })]),
      ]));
    });
    return grid;
  }
  function prUpdate() {
    const s = S();
    if (!P.root) return;
    const pr = s.profile.prestige;
    const pa = TE.Prestige.pendingAlpha();
    const sig = [pa, pr.alpha, pr.legacy, pr.cores, TE.Prestige.canP1(), TE.Prestige.pendingLegacy(), TE.Prestige.pendingCores(), JSON.stringify(pr.perks), JSON.stringify(pr.lperks), JSON.stringify(pr.sperks), P.challenge, Math.floor(U.log10(s.run.earnings + 1) * 20), s.run.challenge].join('|');
    if (sig === P.sig) return;
    P.sig = sig;
    const root = P.root;
    root.innerHTML = '';
    // P1
    const cur = TE.Prestige.alphaBonus();
    const after = TE.Prestige.alphaBonus(pr.alphaTotal + pa);
    const can = TE.Prestige.canP1();
    const p1 = h('div', { class: 'card prestige p1' }, [
      h('div', { class: 'pr-k', text: 'PRESTIGE I' }),
      h('h2', { text: 'LIQUIDER L’EMPIRE' }),
      h('p', { class: 'dim', html: 'Vendez tout. Fermez chaque desk. Licenciez tout le monde (généreusement). En échange, vous gagnez de l’<b class="gold">Alpha (α)</b> : un savoir-faire permanent qui accélère toutes vos parties suivantes.<br>Chaque α gagné ajoute <b>+' + U.pct(TE.Prestige.alphaPower(), 0, false) + '</b> à tous vos revenus, pour toujours. Les α non dépensés achètent les avantages ci-dessous.' }),
      h('div', { class: 'pr-stats' }, [
        stat('Généré dans la partie', U.money(s.run.earnings)), stat('Alpha à la liquidation', '+' + U.int(pa) + ' α', 'gold'), stat('Bonus de revenus actuel', U.mult(cur)), stat('Bonus après', U.mult(after), 'up'),
        stat('Prochain alpha dans', '+' + U.money(Math.max(0, TE.Prestige.nextAlphaAt() - s.run.earnings))), stat('Condition', U.money(D.P1_MIN_EARN) + ' générés', s.run.earnings >= D.P1_MIN_EARN ? 'up' : 'down'),
      ]),
    ]);
    if (pr.p1 > 0 || TE.Prestige.canP1()) {
      const ch = h('div', { class: 'challenges' }, [h('div', { class: 'op-lbl', text: 'MODIFICATEUR DE LA PROCHAINE PARTIE (défi optionnel)' })]);
      const opts = [{ id: null, name: 'PARTIE STANDARD', icon: '◆', desc: 'Aucun modificateur.', alphaMult: 1 }].concat(D.CHALLENGES);
      opts.forEach((c) => {
        const done = c.id && pr.challenges[c.id];
        ch.appendChild(h('button', { class: 'chal' + (P.challenge === c.id ? ' on' : '') + (done ? ' done' : ''), on: { click: () => { P.challenge = c.id; P.sig = ''; } },
          tip: c.id ? '<div class="tt-title">' + c.name + '</div><div>' + c.desc + '</div><div class="tt-row"><span>Alpha</span><span class="gold">' + U.mult(c.alphaMult) + '</span></div><div class="tt-row"><span>Objectif</span><span>' + U.money(c.goal) + ' générés</span></div><div class="tt-row"><span>Récompense permanente</span><span class="c-up">' + c.rewardText + '</span></div>' : 'Une partie normale.' }, [
          h('span', { class: 'ch-i', text: c.icon }), h('b', { text: c.name }), h('span', { class: 'ch-m', text: c.alphaMult > 1 ? 'α ' + U.mult(c.alphaMult) : '' }), done ? h('span', { class: 'ch-d', text: '✔' }) : null,
        ]));
      });
      p1.appendChild(ch);
    }
    if (s.run.challenge) p1.appendChild(h('div', { class: 'banner-inline', html: 'Partie en cours : <b>' + D.CHALLENGE_MAP[s.run.challenge].name + '</b> — objectif ' + U.money(D.CHALLENGE_MAP[s.run.challenge].goal) + ' générés (' + U.pct(Math.min(1, s.run.earnings / D.CHALLENGE_MAP[s.run.challenge].goal), 0, false) + ').' }));
    p1.appendChild(h('button', { class: 'btn btn-prestige', disabled: !can, text: can ? 'LIQUIDER POUR +' + U.int(pa) + ' α' : 'NÉCESSITE ' + U.money(D.P1_MIN_EARN) + ' GÉNÉRÉS', on: { click: () => confirmP1() } }));
    root.appendChild(p1);
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Avantages Alpha' }), h('span', { class: 'card-hr gold', text: U.int(pr.alpha) + ' α disponibles' })]), perkGrid('alpha', D.ALPHA_PERKS, pr.perks, pr.alpha, 'α')]));
    // P2
    if (TE.Prestige.p2Visible()) {
      const pl = TE.Prestige.pendingLegacy();
      const p2 = h('div', { class: 'card prestige p2' }, [h('div', { class: 'pr-k', text: 'PRESTIGE II' }), h('h2', { text: 'LEGACY DE MARCHÉ' }),
        h('p', { class: 'dim', html: 'Fondez une dynastie. Réinitialise vos parties <b>et</b> tout votre Alpha (α et avantages Alpha). Rapporte du <b class="violet">Legacy (Λ)</b> : +50 % de revenus chacun, et de puissants avantages — achats automatiques, temps accéléré, amplification de l’Alpha.' }),
        h('div', { class: 'pr-stats' }, [stat('Alpha gagné depuis le dernier Legacy', U.int(pr.alphaTotal) + ' α'), stat('Legacy au reset', '+' + U.int(pl) + ' Λ', 'violet'), stat('Condition', U.int(D.P2_MIN_ALPHA) + ' α gagnés', pr.alphaTotal >= D.P2_MIN_ALPHA ? 'up' : 'down'), stat('Legacy possédé', U.int(pr.legacy) + ' Λ')]),
        h('button', { class: 'btn btn-prestige violet', disabled: !TE.Prestige.canP2(), text: TE.Prestige.canP2() ? 'ÉTABLIR UN LEGACY POUR +' + U.int(pl) + ' Λ' : 'NÉCESSITE ' + U.int(D.P2_MIN_ALPHA) + ' α GAGNÉS', on: { click: () => confirmP(2) } })]);
      root.appendChild(p2);
      root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Avantages Legacy' }), h('span', { class: 'card-hr violet', text: U.int(pr.legacy) + ' Λ disponibles' })]), perkGrid('legacy', D.LEGACY_PERKS, pr.lperks, pr.legacy, 'Λ')]));
    }
    // P3
    if (TE.Prestige.p3Visible()) {
      const pc = TE.Prestige.pendingCores();
      const p3 = h('div', { class: 'card prestige p3' }, [h('div', { class: 'pr-k', text: 'PRESTIGE III' }), h('h2', { text: 'SINGULARITÉ FINANCIÈRE' }),
        h('p', { class: 'dim', html: 'Effondrez toute l’économie en un point unique. Réinitialise <b>tout</b> — parties, α, Λ. Rapporte des <b class="magenta">noyaux de Singularité (✦)</b> : tous les revenus ×3 chacun, et des avantages qui défient la réalité.' }),
        h('div', { class: 'pr-stats' }, [stat('Noyaux à l’effondrement', '+' + U.int(pc) + ' ✦', 'magenta'), stat('Condition', U.money(D.P3_MIN_EARN) + ' en une partie', s.run.earnings >= D.P3_MIN_EARN ? 'up' : 'down'), stat('Noyaux possédés', U.int(pr.cores) + ' ✦')]),
        h('button', { class: 'btn btn-prestige magenta', disabled: !TE.Prestige.canP3(), text: TE.Prestige.canP3() ? 'EFFONDRER POUR +' + pc + ' ✦' : 'NÉCESSITE ' + U.money(D.P3_MIN_EARN), on: { click: () => confirmP(3) } })]);
      root.appendChild(p3);
      root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Avantages Singularité' }), h('span', { class: 'card-hr magenta', text: U.int(pr.cores) + ' ✦ disponibles' })]), perkGrid('sing', D.SING_PERKS, pr.sperks, pr.cores, '✦')]));
    }
  }
  function stat(l, v, cls) { return h('div', { class: 'pr-stat' }, [h('span', { text: l }), h('b', { class: cls || '', text: v })]); }
  function holdButton(label, onDone, cls) {
    const b = h('button', { class: 'btn btn-hold ' + (cls || '') }, [h('i'), h('span', { text: label })]);
    let t0 = 0, raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 1300);
      b.firstChild.style.width = (p * 100).toFixed(1) + '%';
      if (p >= 1) { stop(); onDone(); return; }
      raf = requestAnimationFrame(tick);
    };
    const start = () => { t0 = performance.now(); raf = requestAnimationFrame(tick); };
    const stop = () => { cancelAnimationFrame(raf); b.firstChild.style.width = '0%'; };
    b.addEventListener('mousedown', start); b.addEventListener('touchstart', start, { passive: true });
    ['mouseup', 'mouseleave', 'touchend'].forEach((e) => b.addEventListener(e, stop));
    return b;
  }
  function confirmP1() {
    const s = S();
    const pa = TE.Prestige.pendingAlpha();
    const pr = s.profile.prestige;
    UI.modal({
      title: '<span class="gold">LIQUIDER VOTRE EMPIRE</span>', cls: 'modal-prestige',
      body: (body, close) => {
        body.innerHTML = '<div class="lq-grid">' +
          '<div><span>Valeur nette actuelle</span><b>' + U.money(TE.Economy.netWorth()) + '</b></div><div><span>Généré dans la partie</span><b>' + U.money(s.run.earnings) + '</b></div>' +
          '<div><span>Alpha obtenu</span><b class="gold">+' + U.int(pa) + ' α</b></div><div><span>Bonus permanent estimé</span><b class="up">' + U.mult(TE.Prestige.alphaBonus(pr.alphaTotal + pa)) + '</b></div></div>' +
          '<div class="lq-cols"><div><div class="op-lbl">RÉINITIALISÉ</div>Liquidités, positions, bots, améliorations, recherche, infrastructure, employés, siège, fonds, empire, ère, attention et pression réglementaire.</div><div><div class="op-lbl">CONSERVÉ</div>Alpha et avantages, succès, statistiques, records et meilleurs temps, chronologie des parties, mémoire du monde, défis, paramètres.</div></div>' +
          (P.challenge ? '<div class="banner-inline warn">Prochaine partie : <b>' + D.CHALLENGE_MAP[P.challenge].name + '</b> — ' + D.CHALLENGE_MAP[P.challenge].desc + '</div>' : '');
        body.appendChild(holdButton('MAINTENIR POUR LIQUIDER', () => { close(); setTimeout(() => { TE.Office.dissolve('#ffd36b', () => { TE.Prestige.doP1(P.challenge); P.challenge = null; P.sig = ''; }); }, 120); }, 'gold'));
      },
      buttons: [{ label: 'Pas encore', cls: 'btn-ghost' }],
    });
  }
  function confirmP(layer) {
    const names = { 2: ['ÉTABLIR UN LEGACY DE MARCHÉ', 'Réinitialise les parties, tout l’Alpha et les avantages Alpha.', () => TE.Prestige.doP2()], 3: ['DÉCLENCHER LA SINGULARITÉ', 'Réinitialise les parties, l’Alpha ET le Legacy. Seuls les noyaux et les avantages Singularité survivent.', () => TE.Prestige.doP3()] };
    const n = names[layer];
    UI.modal({ title: n[0], cls: 'modal-prestige', body: (body, close) => {
      body.innerHTML = '<p class="dim">' + n[1] + '</p>';
      body.appendChild(holdButton('MAINTENIR POUR CONFIRMER', () => { close(); setTimeout(() => { TE.Office.dissolve(layer === 2 ? '#a77bff' : '#ff4fd8', () => { n[2](); P.sig = ''; }); }, 120); }, layer === 2 ? 'violet' : 'magenta'));
    }, buttons: [{ label: 'Annuler', cls: 'btn-ghost' }] });
  }
  UI.views.prestige = { build: prBuild, update: prUpdate, onShow() { P.sig = ''; } };

  /* =============================== SETTINGS =============================== */
  function setBuild(root) {
    root.innerHTML = '';
    const s = S();
    const st = s.settings;
    const toggle = (label, key, after) => h('label', { class: 'toggle' }, [h('input', { type: 'checkbox', checked: !!st[key], on: { change: (e) => { st[key] = e.target.checked; if (after) after(); } } }), h('span', { text: label })]);
    const select = (label, key, opts, after) => h('div', { class: 'set-row' }, [h('span', { text: label }), h('select', { class: 'inp', on: { change: (e) => { const v = e.target.value; st[key] = isNaN(+v) ? v : +v; if (after) after(); } } },
      opts.map(([v, l]) => h('option', { value: String(v), selected: String(st[key]) === String(v), text: l })))]);
    const applyBody = () => { document.body.className = 'theme-' + st.theme + (st.scanlines ? ' scan' : '') + (st.animations ? '' : ' no-anim'); if (UI.marketChart) { UI.marketChart.readColors(); UI.marketChart.draw(true); } };
    const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.volume, on: { input: (e) => { st.volume = +e.target.value; TE.Audio.setVolume(); } } });
    root.appendChild(h('div', { class: 'settings-grid' }, [
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Audio' })]),
        toggle('Effets sonores', 'sound', () => { TE.Audio.init(); TE.Audio.setVolume(); }), h('div', { class: 'set-row' }, [h('span', { text: 'Volume' }), vol]),
        h('button', { class: 'btn btn-ghost btn-xs', text: 'Tester le son', on: { click: () => { TE.Audio.init(); TE.Audio.resume(); TE.Audio.play('bigprofit'); } } })]),
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Affichage' })]),
        select('Thème', 'theme', [['cyber', 'Cyber (cyan)'], ['amber', 'Terminal (ambre)'], ['phosphor', 'Phosphore (vert)']], applyBody),
        select('Format des nombres', 'notation', [['standard', 'Standard (K, M, B, T, Qa…)'], ['scientific', 'Scientifique (1,23e15)'], ['engineering', 'Ingénieur (123e12)']], () => { TE.U.notation = st.notation; }),
        select('Rafraîchissement de l’interface', 'uiHz', [[5, '5 Hz (économie de batterie)'], [10, '10 Hz (par défaut)'], [20, '20 Hz'], [30, '30 Hz']]),
        toggle('Animations et effets', 'animations', applyBody), toggle('Lignes de balayage CRT', 'scanlines', applyBody), toggle('Afficher les trades des bots sur le graphique', 'botMarkers')]),
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Jeu' })]),
        toggle('Confirmations pour les actions facultatives', 'confirmations'), toggle('Astuces du tutoriel', 'tutorial'),
        select('Sauvegarde automatique', 'autosave', [[0, 'Désactivée'], [15, 'Toutes les 15 s'], [30, 'Toutes les 30 s'], [60, 'Toutes les 60 s'], [120, 'Toutes les 2 min']]),
        h('button', { class: 'btn btn-ghost btn-xs', text: 'Revoir les astuces du tutoriel', on: { click: () => { s.profile.tutorial = {}; st.tutorial = true; UI.toast({ text: 'Astuces du tutoriel réinitialisées.', kind: 'ok', icon: '✓' }); } } })]),
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Sauvegarde' })]),
        h('div', { class: 'btn-row' }, [
          h('button', { class: 'btn btn-primary', text: 'Sauvegarder', on: { click: () => { TE.Save.save(true); UI.toast({ text: 'Partie sauvegardée.', kind: 'ok', icon: '✓' }); } } }),
          h('button', { class: 'btn btn-ghost', text: 'Exporter', on: { click: () => exportModal() } }),
          h('button', { class: 'btn btn-ghost', text: 'Importer', on: { click: () => importModal() } }),
          h('button', { class: 'btn btn-danger', text: 'Réinitialiser la sauvegarde', on: { click: () => resetModal() } })]),
        h('div', { class: 'dim small', text: 'Sauvegarde automatique dans ce navigateur (localStorage). Exportez régulièrement pour garder une copie de secours.' }),
        safetyRow()]),
      TE.Cloud ? TE.Cloud.card() : null,
      TE.PWA ? TE.PWA.card() : null,
      h('div', { class: 'card about' }, [h('div', { class: 'card-h' }, [h('span', { text: 'À propos' })]),
        h('p', { html: '<b>TRADING EMPIRE</b> v' + TE.VERSION + ' — <i>Bâtir. Trader. Dominer.</i>' }),
        h('p', { class: 'dim small', text: 'Ceci est un jeu. Chaque marché, entreprise, cryptomonnaie, actualité et investisseur est fictif et simulé dans votre navigateur. Rien ici ne passe d’ordre réel, ne se connecte à un courtier ou à un wallet, ni n’utilise d’argent réel — et rien de tout cela n’est une méthode pour gagner de l’argent.' })]),
      TE.Debug && TE.Debug.enabled ? TE.Debug.panel() : null,
    ]));
  }
  function exportModal() {
    const str = TE.Save.exportString();
    UI.modal({ title: 'Exporter la sauvegarde', body: (body) => {
      const ta = h('textarea', { class: 'inp code', readonly: true, text: str });
      body.appendChild(ta);
      body.appendChild(h('div', { class: 'btn-row' }, [
        h('button', { class: 'btn btn-primary', text: 'Copier dans le presse-papiers', on: { click: () => { ta.select(); try { navigator.clipboard.writeText(str); } catch (e) { document.execCommand('copy'); } UI.toast({ text: 'Sauvegarde copiée.', kind: 'ok', icon: '✓' }); } } }),
        h('button', { class: 'btn btn-ghost', text: 'Télécharger (.txt)', on: { click: () => TE.Save.download() } })]));
      setTimeout(() => ta.select(), 50);
    }, buttons: [{ label: 'Fermer', cls: 'btn-ghost' }] });
  }
  function importModal() {
    UI.modal({ title: 'Importer une sauvegarde', body: (body) => {
      const ta = h('textarea', { class: 'inp code', placeholder: 'Collez votre sauvegarde ici (elle commence par TE1:)' });
      const err = h('div', { class: 'down small' });
      // 2.1: the exported .txt file can also be picked directly (handy on phones)
      const file = h('input', { type: 'file', accept: '.txt,text/plain', hidden: true, on: { change: () => {
        const f = file.files && file.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { ta.value = String(rd.result || '').trim(); err.textContent = ''; };
        rd.onerror = () => { err.textContent = 'Lecture du fichier impossible.'; };
        rd.readAsText(f);
      } } });
      body.appendChild(ta);
      body.appendChild(file);
      body.appendChild(err);
      body.appendChild(h('div', { class: 'btn-row' }, [
        h('button', { class: 'btn btn-ghost', text: 'Choisir un fichier .txt', on: { click: () => file.click() } }),
        h('button', { class: 'btn btn-danger', text: 'Importer et écraser la partie actuelle', on: { click: () => {
          try { TE.Save.decode(ta.value); } catch (e) { err.textContent = 'Sauvegarde invalide : ' + e.message; return; }
          UI.confirm({ title: 'Écraser la partie actuelle ?', body: 'Votre progression actuelle sera remplacée par la sauvegarde importée. Une copie de sécurité de la partie actuelle est gardée (PARAMÈTRES → Sauvegarde).', yes: 'Importer', danger: true, onYes: () => { try { TE.Save.importString(ta.value); } catch (e) { err.textContent = e.message; } } });
        } } })]));
    }, buttons: [{ label: 'Annuler', cls: 'btn-ghost' }] });
  }
  /** 2.1: the copy kept before the last import / cloud load / reset, with a one-click restore. */
  function safetyRow() {
    const c = TE.Save.safetyCopy ? TE.Save.safetyCopy() : null;
    if (!c || !c.json) return null;
    const when = new Date(c.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return h('div', { class: 'set-row safety-row' }, [h('span', { class: 'small', text: 'Copie de sécurité locale : ' + when + (c.reason ? ' (' + c.reason + ')' : '') }),
      h('button', { class: 'btn btn-ghost btn-xs', text: 'Restaurer', on: { click: () => UI.confirm({ title: 'Restaurer la copie de sécurité ?', body: 'La partie actuelle sera remplacée par la copie du ' + when + '. La partie actuelle devient à son tour la copie de sécurité.', yes: 'Restaurer', danger: true, onYes: () => { try { TE.Save.restoreSafetyCopy(); } catch (e) { UI.toast({ text: 'Copie illisible : ' + e.message, kind: 'bad', icon: '⚠' }); } } }) } })]);
  }
  function resetModal() {
    UI.modal({ title: '<span class="down">RÉINITIALISATION COMPLÈTE</span>', cls: 'modal-sm', body: (body) => {
      body.innerHTML = '<p>Cette action efface <b>tout</b> : parties, prestige, succès, statistiques. Tapez <b>EFFACER</b> pour confirmer.</p>';
      const inp = h('input', { class: 'inp', type: 'text', placeholder: 'EFFACER' });
      body.appendChild(inp);
      body.appendChild(h('button', { class: 'btn btn-danger', text: 'Tout effacer', on: { click: () => { const v = inp.value.trim().toUpperCase(); if (v === 'EFFACER' || v === 'RESET') TE.Save.reset(); else inp.classList.add('bad'); } } }));
    }, buttons: [{ label: 'Annuler', cls: 'btn-ghost' }] });
  }
  UI.views.settings = { build: setBuild, update() {}, onShow() { if (UI.viewEls.settings) setBuild(UI.viewEls.settings); } };
})(window.TE);
