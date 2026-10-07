/* V2 — ÉVOLUTION view: see the road travelled. Era dioramas (rendered by the office engine), the run timeline,
 * this run vs your records, the history of past runs and the world's memory. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const S = () => TE.state;
  const V = {};
  const ERA_OFFICE = [0, 1, 2, 3, 5, 6, 7];
  const ERA_STORY = ['Un portable, un lit et cent dollars', 'Un vrai bureau, une vraie équipe', 'Une salle des marchés qui crie', 'Une tour et l’argent des institutions', 'Un réseau mondial, une citadelle', 'Une station en orbite, des machines partout', 'Une civilisation financière autour d’une étoile'];
  const thumbs = {};

  function clock(sec) {
    sec = Math.max(0, Math.round(sec));
    const hh = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (hh ? hh + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function build(root) {
    root.innerHTML = '';
    V.root = root;
    V.kpi = h('div', { class: 'ev-hero' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Évolution — votre ascension' }), V.runHr = h('span', { class: 'card-hr dim' })]), V.kpi]));
    V.path = h('div', { class: 'ev-path' });
    root.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Le chemin parcouru' }), h('span', { class: 'card-hr dim', text: 'chaque ère transforme votre siège' })]), V.path]));
    V.nextCard = h('div', { class: 'card ev-next' });
    root.appendChild(V.nextCard);
    V.tl = h('div', { class: 'tl' });
    V.cmp = h('div', {});
    V.mem = h('div', { class: 'mem-list' });
    V.runs = h('div', {});
    root.appendChild(h('div', { class: 'ev-cols' }, [
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Chronologie de la partie' }), V.tlHr = h('span', { class: 'card-hr dim' })]), V.tl]),
      h('div', {}, [
        h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Cette partie face à vos records' })]), V.cmp]),
        h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Parties précédentes' })]), V.runs]),
        h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Mémoire du monde' })]), V.mem]),
      ]),
    ]));
    V.psig = ''; V.tsig = ''; V.rsig = ''; V.t = 0;
  }
  function thumb(lvl) {
    if (thumbs[lvl]) return thumbs[lvl];
    const c = document.createElement('canvas');
    const W = 220, H = 120, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr;
    TE.Office.render(c.getContext('2d'), W, H, { lvl, thumb: true, fill: 0.35 + lvl * 0.08, dpr, t: 1.3 });
    thumbs[lvl] = c;
    return c;
  }
  function update(force) {
    const s = S();
    if (!V.root) return;
    const now = performance.now();
    if (!force && now - V.t < 700) return;
    V.t = now;
    const r = s.run, p = s.profile, pr = p.prestige;
    const runN = pr.p1 + pr.p2 + pr.p3 + 1;
    UI.text(V.runHr, 'Partie n° ' + runN + (r.challenge ? ' · défi ' + D.CHALLENGE_MAP[r.challenge].name : ''));
    const m = TE.World.memory();
    const pa = TE.Prestige.pendingAlpha();
    const kp = [
      ['Durée de la partie', clock(r.time), 'temps de jeu total ' + U.dur(p.playtime)],
      ['Ère', D.ERAS[r.era - 1].roman + ' — ' + D.ERAS[r.era - 1].name, 'record : ère ' + D.ERAS[(p.records.bestEra || 1) - 1].roman],
      ['Généré (partie)', U.money(r.earnings), 'au total : ' + U.money(p.stats.earned || 0)],
      ['Alpha estimée', '+' + U.int(pa) + ' α', 'record : +' + U.int(m.bestAlpha || 0) + ' α en une partie'],
      ['Puissance de marché', U.fmt(TE.Empire.power(), { dec: 1 }), TE.Empire.scaleOf(r.era).name],
      ['Paliers franchis', U.int((r.tl || []).length), U.int(pr.p1) + ' α · ' + U.int(pr.p2) + ' Λ · ' + U.int(pr.p3) + ' ✦'],
    ];
    UI.html(V.kpi, kp.map((x) => '<div class="ev-kpi"><span>' + x[0] + '</span><b>' + UI.esc(x[1]) + '</b><small>' + UI.esc(x[2]) + '</small></div>').join(''));
    // the path
    const tlk = {};
    (r.tl || []).forEach((e) => { tlk[e.k] = e; });
    const psig = r.era + '|' + Object.keys(tlk).filter((k) => k.indexOf('era_') === 0).join(',');
    if (psig !== V.psig) {
      V.psig = psig;
      V.path.innerHTML = '';
      D.ERAS.forEach((era, i) => {
        const reached = r.era >= era.n;
        const cur = r.era === era.n;
        const rec = (p.records.bestEra || 1) >= era.n;
        const e = tlk['era_' + era.n];
        const off = D.OFFICES[ERA_OFFICE[i]];
        const st = h('div', { class: 'ev-stage' + (cur ? ' cur' : reached ? ' done' : ' locked'), tip: '<div class="tt-title">Ère ' + era.roman + ' — ' + era.name + '</div><div class="tt-dim">' + era.tag + '</div><div class="tt-row"><span>Siège emblématique</span><span>' + off.name + '</span></div><div class="tt-row"><span>Seuil</span><span>' + U.money(TE.Progress.eraReq(era), { dec: 0 }) + ' générés</span></div>' }, [
          h('div', { class: 'es-n', text: 'ÈRE ' + era.roman + (cur ? ' · ICI' : '') }),
          thumb(ERA_OFFICE[i]),
          h('div', { class: 'es-t', text: era.name }),
          h('div', { class: 'es-s', text: reached ? (e ? 'atteinte à ' + clock(e.t) : era.n === 1 ? 'départ : ' + clock(0) : 'atteinte') : rec ? 'déjà atteinte lors d’une partie' : ERA_STORY[i] }),
        ]);
        V.path.appendChild(st);
      });
    }
    // next step
    const g = UI.nextGoal();
    const nextEarn = D.TIMELINE_EARN.find((x) => r.earnings < x[0]);
    UI.html(V.nextCard, '<div class="card-h"><span>Encore un palier</span></div>' + (g ? '<h3>' + UI.esc(g.label) + '</h3><div class="pbar"><i style="width:' + (U.clamp(g.p, 0, 1) * 100).toFixed(1) + '%"></i></div><div class="dim small">' + UI.esc(g.tip || '') + '</div>' : '<h3>Vous êtes au sommet.</h3>') +
      (nextEarn ? '<div class="small" style="margin-top:6px">Prochain cap de richesse : <b>' + nextEarn[1] + '</b> — encore ' + U.money(Math.max(0, nextEarn[0] - r.earnings)) + ' à générer.</div>' : ''));
    // timeline
    const tl = r.tl || [];
    const tsig = tl.length + ':' + (tl.length ? tl[tl.length - 1].k : '');
    if (tsig !== V.tsig) {
      V.tsig = tsig;
      UI.text(V.tlHr, tl.length + ' paliers');
      V.tl.innerHTML = tl.slice().reverse().map((e) => '<div class="tl-e t-' + (e.tag || '') + (e.rec ? ' rec' : '') + '"><span class="tl-t">' + clock(e.t) + '</span><span class="tl-x"><b>' + UI.esc(e.l) + '</b>' + (e.rec ? '<span class="rec">★ RECORD</span>' : '') + '</span></div>').join('') || '<div class="dim small">Les grands moments de la partie apparaîtront ici.</div>';
    }
    // comparison
    const best = p.best || {}, last = p.lastRun || {};
    let html = '<table class="cmp"><tr><th>Palier</th><th>Cette partie</th><th>Meilleur</th><th>Précédente</th></tr>';
    let shown = 0;
    D.RECORD_KEYS.forEach(([k, label]) => {
      const cur = tlk[k] ? tlk[k].t : null;
      if (cur === null && best[k] === undefined) return;
      shown++;
      const cls = cur === null ? 'dim' : best[k] !== undefined && cur <= best[k] ? 'best' : last[k] !== undefined && cur < last[k] ? 'faster' : last[k] !== undefined && cur > last[k] ? 'slower' : '';
      html += '<tr><td>' + label + '</td><td class="' + cls + '">' + (cur !== null ? clock(cur) : '—') + '</td><td>' + (best[k] !== undefined ? clock(best[k]) : '—') + '</td><td class="dim">' + (last[k] !== undefined ? clock(last[k]) : '—') + '</td></tr>';
    });
    html += '</table>';
    if (!shown) html = '<div class="dim small">Vos premiers records s’écriront pendant cette partie (premier million, ères, fonds…).</div>';
    UI.html(V.cmp, html);
    // runs history
    const runs = p.runs || [];
    const rsig = runs.length + ':' + (runs.length ? runs[runs.length - 1].at : '');
    if (rsig !== V.rsig) {
      V.rsig = rsig;
      if (!runs.length) {
        const pr = s.profile.prestige;
        V.runs.innerHTML = '<div class="dim small">' + (pr.p1 + pr.p2 + pr.p3 > 0
          ? 'Les parties jouées avant la version 2.0 n’ont pas d’historique détaillé. Votre prochaine Liquidation (α) apparaîtra ici.'
          : 'Aucune partie terminée. Votre première Liquidation (α) apparaîtra ici.') + '</div>';
      }
      else {
        const last20 = runs.slice(-20);
        const mx = Math.max(1, ...last20.map((x) => U.log10(1 + Math.max(0, x.gain || 0))));
        V.runs.innerHTML = '<div class="runs-bars">' + last20.map((x) => '<i class="l' + x.layer + '" style="height:' + Math.max(6, U.log10(1 + Math.max(0, x.gain || 0)) / mx * 100).toFixed(0) + '%" title="Partie ' + x.n + ' — +' + U.int(x.gain || 0) + ' ' + ['', 'α', 'Λ', '✦'][x.layer] + ' · ' + U.dur(x.dur) + ' · ère ' + D.ERAS[x.era - 1].roman + '"></i>').join('') + '</div>' +
          '<div class="mem-list">' + runs.slice(-4).reverse().map((x) => '<div><span>Partie ' + x.n + ' · ' + U.dur(x.dur) + ' · ère ' + D.ERAS[x.era - 1].roman + '</span><b class="' + ['', 'gold', 'violet', 'magenta'][x.layer] + '">+' + U.int(x.gain || 0) + ' ' + ['', 'α', 'Λ', '✦'][x.layer] + '</b></div>').join('') + '</div>';
      }
    }
    // world memory
    const rows = [];
    if (m.bigCrash) rows.push(['Plus gros krach observé', m.bigCrash.id + ' ' + U.pct(m.bigCrash.pct, 0) + ' en une minute']);
    if (m.squeezes) rows.push(['Short squeezes provoqués', U.int(m.squeezes) + (m.lastSqueeze ? ' (dernier : ' + m.lastSqueeze.id + ')' : '')]);
    if (m.bigOrder) rows.push(['Plus gros ordre', m.bigOrder.id + ' · ' + U.pct(m.bigOrder.x, 0, false) + ' de la liquidité']);
    if (p.records.bestTrade) rows.push(['Meilleur trade', U.money(p.records.bestTrade)]);
    if (m.rivals && m.rivals.length) rows.push(['Rivaux rachetés', m.rivals.join(', ')]);
    const cr = m.crises || {};
    const nCr = Object.keys(cr).length;
    if (nCr) rows.push(['Crises traversées', nCr + ' (dont ' + Object.keys(cr).filter((k) => cr[k] === 2).length + ' terrassées)']);
    if (p.stats.legendaryWins) rows.push(['Trades légendaires gagnés', U.int(p.stats.legendaryWins)]);
    if (p.records.bestRank) rows.push(['Meilleur classement mondial', '#' + U.int(p.records.bestRank)]);
    if (p.records.maxInfluence) rows.push(['Influence maximale', U.pct(p.records.maxInfluence, 2, false)]);
    UI.html(V.mem, rows.length ? rows.map((x) => '<div><span>' + x[0] + '</span><b>' + UI.esc(x[1]) + '</b></div>').join('') : '<div class="dim small">Le monde se souviendra de vos exploits.</div>');
  }
  UI.views.evolution = { build, update, onShow() { V.t = 0; V.psig = ''; } };
})(window.TE);
