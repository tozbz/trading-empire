/* Shared UI components: tooltips content, buy-mode selector, cost buttons, sparklines, line charts. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const S = () => TE.state;

  /* ---------------- tooltip content ---------------- */
  const row = (a, b, cls) => '<div class="tt-row"><span>' + a + '</span><span class="' + (cls || '') + '">' + b + '</span></div>';
  const title = (t, big) => '<div class="tt-title">' + t + '</div>' + (big ? '<div class="tt-big">' + big + '</div>' : '');
  const pct0 = (f, d) => U.pct(f, d === undefined ? 0 : d, false);
  UI.tips.nw = () => {
    const s = S();
    return title('Valeur nette', U.money(TE.Economy.netWorth())) + row('Liquidités', U.money(s.run.cash)) + row('Capital des positions ouvertes', U.money(TE.Trading.equity())) +
      row('Pic de la partie', U.money(s.run.peakNW)) + row('Généré pendant la partie', U.money(s.run.earnings)) + row('Généré au total', U.money(s.profile.stats.earned || 0)) +
      '<div class="tt-dim">Les AUM appartiennent à vos investisseurs et ne comptent pas dans votre valeur nette.</div>';
  };
  UI.tips.cash = () => title('Liquidités', U.money(S().run.cash)) + '<div class="tt-dim">À dépenser en améliorations, bots et infrastructure — ou à utiliser comme marge de trading.</div>';
  /* "POURQUOI ?" — how the passive income is built, straight from the modifier engine. */
  UI.whyIncome = function () {
    const x = TE.Economy.explainIncome();
    let html = '';
    html += row('Stratégies, desk, fonds et divisions (×1)', U.money(x.base) + '/s', 'tt-dim');
    if (x.adds.length) {
      html += row('Bonus additifs', '+' + U.fmt(x.addTotal * 100, { dec: 0 }) + U.NB + '%', 'c-up');
      x.adds.sort((a, b) => b.add - a.add).slice(0, 6).forEach((a) => { html += '<div class="tt-sub"><span>' + UI.esc(a.label) + (a.ceil ? ' ◆' : '') + '</span><span>+' + U.fmt(a.add * 100, { dec: 0 }) + U.NB + '%</span></div>'; });
    }
    x.mults.sort((a, b) => b.mult - a.mult).slice(0, 8).forEach((m) => { html += row(UI.esc(m.label) + (m.ceil ? ' ◆' : ''), U.mult(m.mult), m.mult >= 1 ? 'c-up' : 'c-down'); });
    if (x.temp !== 1) html += row('Effets actifs', U.mult(x.temp), 'c-amber');
    if (x.crisis !== 1) html += row('Bonus de crise', U.mult(x.crisis), 'c-amber');
    html += row('Production brute (avant saturation)', U.money(x.raw) + '/s', 'tt-strong');
    const satLoss = x.raw > 0 ? x.passive / x.raw - 1 : 0;
    if (satLoss < -0.005) html += row('Saturation du marché', U.pct(satLoss, 0), satLoss < -0.5 ? 'c-down' : 'c-amber');
    html += row('= Revenu passif final', U.money(x.passive) + '/s', 'tt-strong');
    html += '<div class="tt-dim">◆ = multiplicateur de plafond (prestige, crises, série) : il relève la saturation au lieu de la subir.</div>';
    return html;
  };
  UI.tips.income = () => {
    let html = title('Profit attendu par seconde', U.money(TE.Economy.passive()) + '/s');
    html += '<div class="tt-sec">POURQUOI ?</div>' + UI.whyIncome();
    const rows = TE.Economy.breakdown().sort((a, b) => b.v - a.v);
    const tot = rows.reduce((a, r) => a + Math.max(0, r.v), 0) || 1;
    if (rows.length) html += '<div class="tt-sec">SOURCES</div>';
    rows.slice(0, 8).forEach((r) => { html += row('<i class="dot" style="background:' + r.color + '"></i>' + UI.esc(r.name), U.money(r.v) + '/s · ' + pct0(r.v / tot)); });
    if (!rows.length) html += '<div class="tt-dim">Aucun revenu passif pour l’instant. Déployez des bots !</div>';
    html += row('Réalisé (moyenne 30 s, trading compris)', U.smoney(TE.Economy.realized()) + '/s', 'tt-dim');
    return html + '<div class="tt-dim">Cliquez pour épingler cette explication.</div>';
  };
  /** Theoretical vs effective gain of a set of effects (upgrades, research, staff…). */
  UI.gainInfo = function (effects, cat, n) {
    const touches = (effects || []).some((e) => e.stat && /^(income\.global|bot\.|staff\.(desk|power)|div\.|alpha\.capacity|fund\.(perf|mgmt|capacity))/.test(e.stat));
    if (!touches || TE.Economy.passive() <= 0) return null;
    const w = TE.Economy.whatIf(effects, cat, n);
    if (!(w.theo > 0.0005) && !(w.gain > 0.0005)) return null;
    return w;
  };
  UI.gainHtml = function (w, short) {
    if (!w) return '';
    const sat = w.theo > 0.002 && w.gain < w.theo * 0.8;
    if (short) return '<span class="gain' + (sat ? ' sat' : '') + '" data-tip="' + UI.esc(UI.gainTip(w)) + '">' + (sat ? 'Gain réel ≈ ' : '≈ ') + U.pct(w.gain, w.gain < 0.1 ? 1 : 0) + ' de revenu' + (sat ? ' <i>(saturation)</i>' : '') + '</span>';
    return UI.gainTip(w);
  };
  UI.gainTip = function (w) {
    return '<div class="tt-title">Impact sur votre revenu passif</div>' + row('Bonus théorique', U.pct(w.theo, 1), 'c-up') + row('Gain effectif estimé', U.pct(w.gain, 1), w.gain < w.theo * 0.8 ? 'c-amber' : 'c-up') +
      row('Absorbé par la saturation', U.pct(-w.satLoss, 1), w.satLoss > 0.01 ? 'c-down' : 'tt-dim') + row('Revenu passif', U.money(w.base) + '/s → ' + U.money(w.after) + '/s') +
      '<div class="tt-dim">Les multiplicateurs internes à la partie augmentent la production brute, mais la capacité de marché de l’ère en absorbe une partie. Le prestige, les crises et les séries relèvent le plafond lui-même.</div>';
  };
  /* world tooltips */
  UI.tips.att = () => {
    const a = TE.World.attention(), lv = TE.World.attLevel(a);
    let html = title('Attention du marché', Math.round(a) + ' — ' + lv.lvl.name) + '<div class="tt-dim">' + lv.lvl.desc + '</div>';
    html += row('Monte avec', 'gros ordres, positions dominantes, hype, squeezes, acquisitions, influence');
    html += row('Effets', a >= 40 ? 'votre nom dans les médias, particuliers attirés, rivaux plus agressifs' : 'mentions anonymes, peu d’effets');
    if (lv.next) html += row('Palier suivant', lv.next.name + ' à ' + lv.next.at);
    return html + '<div class="tt-dim">À distinguer de la réputation : la réputation mesure la crédibilité de votre société, l’attention mesure à quel point le monde vous regarde.</div>';
  };
  UI.tips.reg = () => {
    const r = TE.World.reg();
    let html = title('Pression réglementaire', U.pct(r / 100, 0, false));
    html += row('Seuil des contrôles', '30 %', r >= 30 ? 'c-amber' : 'tt-dim');
    html += row('Monte avec', 'manipulation (hype, rapport short, tuyau), ordres massifs, positions dominantes, influence, forte attention');
    html += row('Risques au-delà de 30 %', 'demande d’informations, contrôle, restriction de levier, amende, scandale');
    html += row('Réduction subie', U.mult(TE.Mods.get('reg.gain')), TE.Mods.get('reg.gain') < 1 ? 'c-up' : 'tt-dim');
    const lc = TE.World.levCap();
    if (lc < Infinity) html += row('Restriction active', 'levier max x' + lc, 'c-down');
    return html + '<div class="tt-dim">Département conformité, risk managers, lobbying, recherche Influence et certaines acquisitions réduisent la pression.</div>';
  };
  UI.tips.liq = (id) => {
    id = id || S().run.activeAsset;
    const L = TE.Market.liquidity(id), f = TE.Market.liqFactor(id);
    const est = TE.Market.impactEst(id, TE.Trading.maxNotional(id));
    let html = title('Liquidité de ' + id, U.money(L)) + row('État du carnet', pct0(f), f < 0.7 ? 'c-down' : f > 1.05 ? 'c-up' : '');
    html += row('Impact d’une position maximale', U.pct(est.pct, 2, false) + ' · ' + est.label, est.lvl === 'hi' ? 'c-down' : est.lvl === 'mid' ? 'c-amber' : 'c-up');
    html += '<div class="tt-dim">La liquidité effective dépend de la profondeur du marché, de la taille de votre desk, du régime, du cycle macro, des événements, de la peur et des teneurs de marché. Un gros ordre la consomme ; elle revient en ~30 s.</div>';
    return html;
  };
  UI.tips.sat = () => {
    const E = TE.Economy, x = TE.Bots.expected(), c = E.capacityParts();
    const sat = x.sat || 0;
    let html = title('Saturation du marché', pct0(sat, 1));
    html += '<div class="tt-dim">Les marchés de chaque ère ne peuvent absorber qu’une quantité limitée de capital. Plus vos stratégies grossissent, plus elles se disputent les mêmes opportunités : les revenus tendent vers la capacité du marché × vos multiplicateurs de plafond, et chaque bot supplémentaire rapporte de moins en moins.</div>';
    html += row('Capacité de base (ère ' + TE.Progress.era().roman + ')', U.money(c.base) + '/s');
    html += row('Marchés débloqués (' + c.markets + ')', U.mult(c.mk));
    html += row('Bonus de capacité', U.mult(c.mods), c.mods > 1 ? 'c-up' : '');
    html += row('= Capacité du marché', U.money(c.total) + '/s', 'tt-strong');
    html += row('Multiplicateur de plafond', U.mult(E.ceilingMult()), 'c-up');
    html += '<div class="tt-dim">Plafond : le prestige (α, Λ, ✦, avantages, défis), les récompenses de crise, les séries gagnantes et les bonus temporaires multiplient le plafond lui-même.</div>';
    html += row('Revenus des stratégies avant saturation', U.money(x.raw * E.ceilingMult()) + '/s', 'tt-dim');
    html += row('Après saturation', U.money(x.total + (TE.Fund ? TE.Fund.mgmtIncome() : 0)) + '/s');
    if (TE.Empire.active()) html += row('Réserve des divisions (max ' + pct0(E.DIV_CAPACITY) + ' de la capacité)', pct0(x.divSat || 0) + ' utilisés');
    return html + '<div class="tt-dim">Pour aller plus loin : débloquez des marchés, achetez tout ce qui augmente la « capacité de marché » (améliorations, recherche, empire), survivez à la crise de l’ère pour passer à la suivante, ou liquidez pour gagner de l’α.</div>';
  };
  UI.tips.pnl = () => {
    const s = S();
    let html = title('Positions ouvertes');
    const ps = s.run.account.positions;
    const ids = Object.keys(ps);
    if (!ids.length) html += '<div class="tt-dim">Aucune position ouverte.</div>';
    ids.forEach((id) => { const u = TE.Trading.upnl(id) - ps[id].fees; html += row(id + ' ' + (ps[id].side > 0 ? 'LONG' : 'SHORT') + ' x' + Math.round(ps[id].lev), U.smoney(u), UI.dir(u)); });
    html += row('Série gagnante', s.run.account.combo + (TE.Trading.comboMult() > 1 ? ' (' + U.mult(TE.Trading.comboMult()) + ' sur tous les revenus)' : ''));
    return html;
  };
  UI.tips.aum = () => {
    const f = S().run.fund;
    if (!f) return '';
    return title('Actifs sous gestion (AUM)', U.money(f.aum)) + row('Capacité', U.money(TE.Fund.capacity())) + row('Déployés', U.money(TE.Fund.deployed())) +
      row('Commission de perf.', pct0(TE.Mods.get('fund.perf'))) + row('Frais de gestion', pct0(TE.Mods.get('fund.mgmt'), 1) + '/an') + row('Drawdown', pct0(TE.Fund.drawdown(), 2), TE.Fund.drawdown() > 0.05 ? 'c-down' : '') +
      '<div class="tt-dim">L’argent des investisseurs trade aux côtés de vos bots. Vous gardez une commission de performance sur les profits et des frais de gestion sur les actifs.</div>';
  };
  UI.tips.rep = () => {
    const s = S();
    const t = TE.Fund.repTier(s.run.rep);
    return title('Réputation', U.int(s.run.rep) + ' — ' + t.tier.name) + (t.next ? row('Palier suivant', t.next.name + ' à ' + U.int(t.next.at)) : '') +
      row('Multiplicateur de gain', U.mult(TE.Mods.get('rep.gain'))) + '<div class="tt-dim">Se gagne avec les trades gagnants, les contrats, les succès, la performance du fonds et les crises surmontées. Se perd avec les liquidations, les scandales et les drawdowns. Débloque des investisseurs et des recrues légendaires.</div>';
  };
  UI.tips.inf = () => {
    const sc = TE.Empire.scaleOf(S().run.era);
    const cap = TE.Empire.worldCap(), tgt = TE.Empire.worldCapTarget();
    let html = title('Influence de marché', U.pct(TE.Empire.influence(), 4, false));
    html += row('Échelle de marché', sc.name + (cap < tgt * 0.99 ? ' (en expansion)' : ''));
    html += row('Taille du marché', U.money(cap));
    html += row('Capital que vous contrôlez', U.money(TE.Empire.controlled()), 'c-up');
    html += row('Puissance de marché', U.fmt(TE.Empire.power(), { dec: 1 }) + ' (log₁₀ du capital contrôlé)', 'c-up');
    html += row('Multiplicateur d’influence', U.mult(TE.Mods.get('influence')));
    return html + '<div class="tt-dim">La part du marché que vous contrôlez. À chaque nouvelle échelle (marché interplanétaire, économie stellaire), le marché s’agrandit progressivement : votre part se redistribue, mais votre puissance absolue ne cesse de grandir. Avec une forte influence, vos positions poussent les prix en votre faveur.</div>';
  };
  UI.tips.alpha = () => {
    const p = S().profile.prestige;
    return title('Alpha (α)', U.int(p.alpha) + ' disponibles') + row('Gagné (total)', U.int(p.alphaTotal)) + row('Bonus de revenus', U.mult(TE.Prestige.alphaBonus()), 'c-up') +
      row('En attente (à la liquidation)', '+' + U.int(TE.Prestige.pendingAlpha())) + '<div class="tt-dim">Chaque α gagné ajoute +' + pct0(TE.Prestige.alphaPower()) + ' à tous les revenus, pour toujours. Dépensez vos α en avantages dans PRESTIGE.</div>';
  };
  UI.tips.era = () => {
    const s = S();
    const e = TE.Progress.era(), st = TE.Progress.nextEraStatus();
    let html = title('Ère ' + e.roman + ' — ' + e.name) + '<div class="tt-dim">' + e.tag + '</div>';
    if (st) {
      const n = st.era;
      html += '<div class="tt-title" style="margin-top:8px">Ère suivante : ' + n.roman + ' — ' + n.name + '</div>';
      html += row((st.money ? '✓ ' : '✗ ') + 'Générer ' + U.money(TE.Progress.eraReq(n)) + ' dans la partie', U.money(s.run.earnings), st.money ? 'c-up' : '');
      html += '<div class="pbar"><i style="width:' + Math.min(100, s.run.earnings / TE.Progress.eraReq(n) * 100).toFixed(1) + '%"></i></div>';
      if (st.crisis) {
        const ev = s.run.events;
        let when = '';
        if (!st.crisisOk) {
          if (ev.crisis && ev.crisis.id === st.crisis.id) when = ev.crisis.active ? ' — EN COURS' : ' — imminente';
          else if (ev.crisisNext && ev.crisisNext.id === st.crisis.id) when = ' — attendue dans ~' + U.dur(Math.max(0, ev.crisisNext.at - s.run.time));
          else when = ' — elle frappera pendant cette ère';
        }
        html += row((st.crisisOk ? '✓ ' : '✗ ') + 'Survivre : ' + st.crisis.name, st.crisisOk ? 'surmontée' : 'à venir', st.crisisOk ? 'c-up' : 'c-amber');
        if (when) html += '<div class="tt-dim">Chaque ère se termine par une crise de marché' + when + '. Survivez-y (quel que soit le résultat) pour débloquer l’ère suivante ; remplissez ses objectifs pour un bonus de plafond permanent.</div>';
      }
    } else html += '<div class="tt-dim">Ère finale. La Singularité vous attend.</div>';
    const sat = TE.Economy.saturation();
    if (sat > 0.5) html += row('Saturation du marché', pct0(sat), sat > 0.8 ? 'c-down' : 'c-amber');
    return html + row('Classement mondial', '#' + U.int(TE.Empire.rank()));
  };
  UI.tips.combo = () => {
    let html = title('Série gagnante', S().run.account.combo + ' victoires');
    D.COMBO_TIERS.forEach((t) => { html += row(t.n + '+ victoires — ' + t.name, U.mult(1 + (t.mult - 1) * TE.Mods.get('combo.power')), S().run.account.combo >= t.n ? 'c-up' : 'tt-dim'); });
    return html + '<div class="tt-dim">Les trades manuels gagnants consécutifs boostent TOUS les revenus. Un trade perdant ou une liquidation remet la série à zéro. Les positions minuscules ne comptent pas.</div>';
  };
  UI.tips.macro = () => {
    const m = TE.Market.macro();
    const w = S().market.macro;
    return title('Cycle macro', m.name) + (w.id !== 'crisis' ? row('Restant', U.dur(Math.max(0, w.d - w.t))) : '') +
      '<div class="tt-dim">Le cycle mondial influence tous les marchés : les bull markets favorisent les hausses, les bear markets les baisses.</div>';
  };
  UI.sentimentEffects = function (v) {
    const fx = [];
    if (v > 78) fx.push(['Bulles, krachs et pièges haussiers', 'plus probables', 'c-amber']);
    if (v > 60) { fx.push(['Particuliers', 'achètent davantage', 'c-up']); fx.push(['Souscriptions spéculatives (fonds)', U.mult(1 + (v - 60) / 60), 'c-up']); }
    if (v < 40) { fx.push(['Souscriptions au fonds', U.mult(Math.max(0.55, 1 - (40 - v) / 60)), 'c-down']); }
    if (v < 35) fx.push(['Valeurs refuges (Or, Argent, VOLX)', 'achetées', 'c-up']);
    if (v < 30) { fx.push(['Teneurs de marché', 'se retirent : spreads plus larges, liquidité réduite', 'c-down']); fx.push(['Particuliers', 'rachats paniqués du fonds', 'c-down']); }
    if (v < 22) fx.push(['Capitulations et points bas', 'plus probables', 'c-amber']);
    if (!fx.length) fx.push(['Zone neutre', 'pas d’effet particulier', 'tt-dim']);
    return fx;
  };
  UI.tips.sentiment = () => {
    const v = TE.Market.sentiment();
    let html = title('Peur & Avidité', Math.round(v) + ' — ' + TE.Market.sentimentLabel(v));
    html += '<div class="tt-sec">CONSÉQUENCES ACTUELLES</div>';
    UI.sentimentEffects(v).forEach((f) => { html += row(f[0], f[1], f[2]); });
    return html + '<div class="tt-dim">Calculé à partir des tendances, de la volatilité, du cycle macro et des événements.</div>';
  };
  UI.tips.actors = (id) => {
    id = id || S().run.activeAsset;
    const p = TE.Agents.positioning(id);
    if (!p) return '';
    let html = title('Acteurs du marché — ' + id);
    p.groups.forEach((g) => { html += row('<i class="dot" style="background:' + g.color + '"></i>' + g.name, (g.x > 0.02 ? 'LONG ' : g.x < -0.02 ? 'SHORT ' : 'NEUTRE ') + pct0(Math.abs(g.x)), g.x > 0.02 ? 'c-up' : g.x < -0.02 ? 'c-down' : 'tt-dim'); });
    html += row('Risque de short squeeze', pct0(Math.min(1, p.squeeze)), p.squeeze > 0.8 ? 'c-amber' : 'tt-dim');
    html += row('Risque de cascade de liquidations', pct0(Math.min(1, p.cascade)), p.cascade > 0.8 ? 'c-amber' : 'tt-dim');
    html += row('Présence des teneurs de marché', pct0(p.mm), p.mm < 0.8 ? 'c-down' : '');
    if (p.campaign) html += row('Campagne en cours', (p.campaign.who ? (D.RIVAL_MAP[p.campaign.who] || {}).name || 'Rival' : 'Baleine') + ' · ' + (p.campaign.dir > 0 ? 'achat' : 'vente'), 'c-amber');
    return html + '<div class="tt-dim">Groupes agrégés (pas des individus). Leur positionnement suit les tendances, la valorisation, le sentiment, les news… et vos propres ordres.</div>';
  };
  UI.tips.regime = (id) => {
    const R = D.REGIMES[id];
    return R ? title(R.name) + '<div class="tt-dim">' + R.hint + '</div>' : '';
  };

  /* ---------------- market saturation meter ---------------- */
  UI.satMeter = function () {
    const el = h('div', { class: 'sat-meter', tip: 'fn:sat' }, [
      h('div', { class: 'sat-h' }, [h('span', { class: 'op-lbl', text: 'SATURATION DU MARCHÉ' }), h('b', { class: 'sat-v' }), h('span', { class: 'sat-cap dim small' })]),
      h('div', { class: 'sat-bar' }, [h('i')]),
      h('div', { class: 'sat-hint small' }),
    ]);
    const v = el.querySelector('.sat-v'), cap = el.querySelector('.sat-cap'), bar = el.querySelector('.sat-bar i'), hint = el.querySelector('.sat-hint');
    el._update = function () {
      const sat = TE.Economy.saturation();
      // progressive UI: the meter appears once markets start to fill up
      if (!el._shown && sat < 0.2 && S().run.era < 2) { el.hidden = true; return; }
      el._shown = true; el.hidden = false;
      const lvl = sat > 0.8 ? 'hi' : sat > 0.5 ? 'mid' : 'lo';
      UI.text(v, pct0(sat, sat > 0.995 ? 1 : 0) + (sat > 0.8 ? ' ▲' : ''));
      v.className = 'sat-v sat-' + lvl;
      UI.text(cap, 'capacité ' + U.money(TE.Economy.capacity() * TE.Economy.ceilingMult()) + '/s');
      bar.style.width = (sat * 100).toFixed(1) + '%';
      bar.className = 'sat-' + lvl;
      UI.text(hint, sat > 0.8 ? 'Vos stratégies se disputent désormais les mêmes opportunités : de nouveaux bots rapportent peu. Débloquez des marchés, achetez des améliorations de capacité, survivez à la crise de l’ère' + (TE.Prestige.canP1() ? ' — ou LIQUIDEZ pour gagner de l’α.' : '.')
        : sat > 0.5 ? 'Les marchés s’encombrent : chaque nouveau bot rapporte un peu moins que le précédent.' : 'Il reste beaucoup de place sur ces marchés. Passez à l’échelle !');
      UI.cls(hint, 'c-down', sat > 0.8);
    };
    return el;
  };

  /* ---------------- buy mode selector ---------------- */
  UI.buyModeSeg = function () {
    const el = h('div', { class: 'seg buymode', tip: 'Quantité à acheter (B pour changer)' });
    TE.Economy.BUY_MODES.forEach((m) => {
      el.appendChild(h('button', { text: m === 'max' ? 'MAX' : '×' + m, data: { m: String(m) }, on: { click: () => { S().run.buyMode = m; TE.Audio.play('click'); } } }));
    });
    el._update = () => { const cur = String(S().run.buyMode || 1); Array.from(el.children).forEach((b) => UI.cls(b, 'on', b.dataset.m === cur)); };
    el._update();
    return el;
  };

  /* ---------------- cost button ---------------- */
  UI.costBtn = function (label, onClick, extraCls) {
    const b = h('button', { class: 'btn-buy ' + (extraCls || ''), on: { click: (e) => { if (b.disabled) { TE.Audio.play('deny'); return; } if (onClick(e) !== false) UI.FX.pulse(b, 'bought'); } } }, [
      h('span', { class: 'bb-l', text: label }), h('span', { class: 'bb-c' }), h('i', { class: 'bb-p' }),
    ]);
    b._set = function (lbl, cost, afford, opts) {
      opts = opts || {};
      UI.text(b.children[0], lbl);
      UI.text(b.children[1], opts.costText !== undefined ? opts.costText : U.money(cost));
      b.disabled = !afford;
      UI.cls(b, 'afford', !!afford);
      const pct = cost > 0 && isFinite(cost) ? Math.min(1, S().run.cash / cost) : 0;
      b.children[2].style.width = (afford ? 100 : pct * 100).toFixed(1) + '%';
    };
    return b;
  };

  /* ---------------- sparkline (SVG) ---------------- */
  UI.sparkPath = function (vals, w, hgt) {
    if (!vals || vals.length < 2) return '';
    let mn = Infinity, mx = -Infinity;
    vals.forEach((v) => { if (v < mn) mn = v; if (v > mx) mx = v; });
    const rg = mx - mn || 1;
    return vals.map((v, i) => (i ? 'L' : 'M') + (i / (vals.length - 1) * w).toFixed(1) + ' ' + (hgt - ((v - mn) / rg) * (hgt - 2) - 1).toFixed(1)).join(' ');
  };
  UI.spark = function (w, hgt) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt);
    svg.setAttribute('class', 'spark');
    svg.setAttribute('preserveAspectRatio', 'none');
    const p = document.createElementNS(ns, 'path');
    svg.appendChild(p);
    svg._set = (vals, up) => { p.setAttribute('d', UI.sparkPath(vals, w, hgt)); svg.setAttribute('class', 'spark ' + (up === undefined ? '' : up ? 'up' : 'down')); };
    return svg;
  };

  /* ---------------- line chart (canvas) ---------------- */
  UI.lineChart = function (canvas, series, opts) {
    opts = opts || {};
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    if (r.width < 10) return;
    if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height;
    ctx.clearRect(0, 0, W, H);
    const vals = series.filter((v) => isFinite(v));
    if (vals.length < 2) { ctx.fillStyle = '#4d5b6e'; ctx.font = '11px JetBrains Mono, monospace'; ctx.fillText('Collecte des données…', 8, H / 2); return; }
    const log = opts.log && vals.every((v) => v > 0);
    const tr = (v) => (log ? Math.log10(v) : v);
    let mn = Infinity, mx = -Infinity;
    vals.forEach((v) => { const t = tr(v); if (t < mn) mn = t; if (t > mx) mx = t; });
    if (mx - mn < 1e-9) { mx += 1; mn -= 1; }
    const padL = 4, padR = 58, padT = 8, padB = 8;
    const x = (i) => padL + (i / (vals.length - 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (tr(v) - mn) / (mx - mn)) * (H - padT - padB);
    const cs = getComputedStyle(document.body);
    const col = opts.color || (vals[vals.length - 1] >= vals[0] ? cs.getPropertyValue('--up') : cs.getPropertyValue('--down'));
    ctx.strokeStyle = 'rgba(120,150,190,0.08)';
    ctx.fillStyle = '#7f8ea3';
    ctx.font = '10px JetBrains Mono, monospace';
    for (let i = 0; i <= 3; i++) {
      const yy = padT + i / 3 * (H - padT - padB);
      ctx.beginPath(); ctx.moveTo(padL, yy + 0.5); ctx.lineTo(W - padR, yy + 0.5); ctx.stroke();
      const v = mx - i / 3 * (mx - mn);
      ctx.fillText(opts.fmt ? opts.fmt(log ? Math.pow(10, v) : v) : U.fmt(log ? Math.pow(10, v) : v), W - padR + 6, yy + 4);
    }
    ctx.beginPath();
    vals.forEach((v, i) => { if (i) ctx.lineTo(x(i), y(v)); else ctx.moveTo(x(i), y(v)); });
    ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.lineTo(x(vals.length - 1), H - padB); ctx.lineTo(x(0), H - padB); ctx.closePath();
    ctx.globalAlpha = 0.08; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
  };

  /* ---------------- misc ---------------- */
  UI.pbar = function (cls) { const el = h('div', { class: 'pbar ' + (cls || '') }, [h('i')]); el._set = (p) => { el.firstChild.style.width = (U.clamp(p, 0, 1) * 100).toFixed(1) + '%'; }; return el; };
  UI.kv = function (label, tip) { const el = h('div', { class: 'kv', tip }, [h('span', { class: 'kv-l', text: label }), h('span', { class: 'kv-v' })]); el._v = el.children[1]; return el; };
  UI.effectsText = function (effects) {
    return effects.map((e) => (e.flag ? '' : TE.Mods.describe(e))).filter(Boolean).join(' · ');
  };
})(window.TE);
