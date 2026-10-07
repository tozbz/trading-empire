/* Daily Market Challenge: a 2-minute seeded trading session (same market for everyone on a given date). */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const STEP = 0.1, FEE = 0.0005, TICKS_PER_CANDLE = D.CANDLE_SEC / STEP;

  TE.DailyUI = {
    open() {
      const def = TE.Daily.asset();
      const path = TE.Market.simulatePath(def, TE.Daily.seed(), TE.Daily.DURATION, STEP);
      const a = { c: path.hist.slice(), n: path.hist.length, o: 0, h: 0, l: 0, p: 0, v: 0, marks: [], botMarks: [], mc: [], mk: 0 };
      const last = path.hist[path.hist.length - 1];
      a.p = a.o = a.h = a.l = last ? last[3] : def.price;
      const st = { t: -3, i: 0, cash: TE.Daily.START, pos: null, lev: 2, done: false, trades: 0, result: null };
      let raf = 0, lastNow = 0, chart = null;
      const els = {};
      const equity = () => st.cash + (st.pos ? Math.max(0, st.pos.margin + st.pos.side * (a.p - st.pos.entry) * st.pos.units) : 0);
      function openPos(side) {
        if (st.done || st.t < 0) return;
        if (st.pos && st.pos.side === side) return;
        if (st.pos) closePos();
        const margin = st.cash;
        if (margin < 1) return;
        const notional = margin * st.lev;
        const fee = notional * FEE;
        st.cash = 0;
        st.pos = { side, entry: a.p, units: (notional - fee) / a.p, margin: margin - fee / st.lev, lev: st.lev };
        st.pos.liq = side > 0 ? st.pos.entry * (1 - 0.98 / st.lev) : st.pos.entry * (1 + 0.98 / st.lev);
        a.marks.push({ n: a.n, p: a.p, t: side > 0 ? 'L' : 'S' });
        st.trades++;
        TE.Audio.play('open');
      }
      function closePos(liq) {
        if (!st.pos) return;
        const p = st.pos;
        const pnl = p.side * (a.p - p.entry) * p.units;
        const back = liq ? 0 : Math.max(0, p.margin + pnl - Math.abs(a.p * p.units) * FEE);
        st.cash += back;
        a.marks.push({ n: a.n, p: a.p, t: 'X', win: back > p.margin });
        TE.Audio.play(liq ? 'liquidation' : back > p.margin ? 'profit' : 'loss');
        if (liq) UI.FX.flash('red');
        st.pos = null;
      }
      function advance(dt) {
        st.t += dt;
        if (st.t < 0) return;
        const target = Math.min(path.ticks.length, Math.floor(st.t / STEP));
        while (st.i < target) {
          const price = path.ticks[st.i];
          if (st.i % TICKS_PER_CANDLE === 0 && st.i > 0) { a.c.push([a.o, a.h, a.l, a.p, a.v]); a.n++; a.o = a.h = a.l = a.p; a.v = 0; }
          a.p = price; if (price > a.h) a.h = price; if (price < a.l) a.l = price; a.v += Math.random() * 2;
          if (st.pos && ((st.pos.side > 0 && price <= st.pos.liq) || (st.pos.side < 0 && price >= st.pos.liq))) closePos(true);
          st.i++;
        }
        if (st.t >= TE.Daily.DURATION && !st.done) finish();
      }
      function finish() {
        st.done = true;
        closePos();
        const res = TE.Daily.submit(st.cash);
        st.result = res;
        TE.Audio.play(res.tier && res.tier.idx >= 3 ? 'milestone' : 'unlock');
        let html = '<div class="dl-res"><div class="dl-big ' + UI.dir(res.ret) + '">' + U.pct(res.ret, 2) + '</div><div>Capital final ' + U.money(st.cash) + ' · ' + st.trades + ' trade' + (st.trades > 1 ? 's' : '') + '</div>';
        html += res.tier ? '<div class="tier t-' + res.tier.cls + '">' + res.tier.name.toUpperCase() + '</div>' : '<div class="dim">Aucun palier : vous avez perdu de l’argent. Demain, un autre marché.</div>';
        if (res.reward) html += '<div class="gold">Récompense du jour : tous les revenus ' + U.mult(res.reward.mult) + ' pendant 10 minutes + ' + U.money(res.reward.cash) + ' · série de ' + res.reward.streak + ' jour' + (res.reward.streak > 1 ? 's' : '') + '</div>';
        else if (res.tier) html += '<div class="dim">Récompense déjà récupérée aujourd’hui — ce score compte quand même pour votre record.</div>';
        els.result.innerHTML = html + '</div>';
        els.result.hidden = false;
      }
      function onKey(e) {
        const k = e.key.toLowerCase();
        if (k === 'l') openPos(1); else if (k === 's') openPos(-1); else if (k === ' ') { e.preventDefault(); closePos(); }
        else if (k === '-' || k === '=') { const L = [1, 2, 5, 10]; let i = L.indexOf(st.lev); i = U.clamp(i + (k === '-' ? -1 : 1), 0, 3); st.lev = L[i]; }
      }
      function frame(now) {
        const dt = lastNow ? Math.min(0.25, (now - lastNow) / 1000) : 0;
        lastNow = now;
        advance(dt);
        const eq = equity();
        const ret = eq / TE.Daily.START - 1;
        UI.text(els.timer, st.t < 0 ? 'DÉPART DANS ' + Math.ceil(-st.t) : st.done ? 'TERMINÉ' : U.clock(TE.Daily.DURATION - st.t));
        UI.html(els.eq, 'Capital <b>' + U.money(eq) + '</b> <span class="' + UI.dir(ret) + '">' + U.pct(ret, 2) + '</span>');
        UI.html(els.pos, st.pos ? (st.pos.side > 0 ? '<span class="up">LONG</span>' : '<span class="down">SHORT</span>') + ' x' + st.pos.lev + ' @ ' + U.price(st.pos.entry) + ' · liq. ' + U.price(st.pos.liq) : '<span class="dim">Aucune position</span>');
        Array.from(els.lev.children).forEach((b) => UI.cls(b, 'on', +b.dataset.l === st.lev));
        chart.draw(true);
        if (!st.closed) raf = requestAnimationFrame(frame);
      }
      const m = UI.modal({
        title: 'DÉFI DE MARCHÉ QUOTIDIEN — ' + def.name.toUpperCase(), cls: 'modal-daily',
        body: (body) => {
          els.timer = h('span', { class: 'dl-timer' });
          els.eq = h('span', { class: 'dl-eq' });
          els.pos = h('span', { class: 'dl-pos' });
          body.appendChild(h('div', { class: 'dl-head' }, [els.timer, els.eq, els.pos]));
          const box = h('div', { class: 'chart-box dl-chart' });
          body.appendChild(box);
          els.lev = h('div', { class: 'seg' }, [1, 2, 5, 10].map((l) => h('button', { text: 'x' + l, data: { l: String(l) }, on: { click: () => { st.lev = l; } } })));
          body.appendChild(h('div', { class: 'dl-ctrl' }, [els.lev,
            h('button', { class: 'btn-trade long sm', html: '▲ LONG <kbd>L</kbd>', on: { click: () => openPos(1) } }),
            h('button', { class: 'btn-trade short sm', html: '▼ SHORT <kbd>S</kbd>', on: { click: () => openPos(-1) } }),
            h('button', { class: 'btn btn-ghost', html: 'FERMER <kbd>Espace</kbd>', on: { click: () => closePos() } })]));
          els.result = h('div', { class: 'dl-result', hidden: true });
          body.appendChild(els.result);
          body.appendChild(h('div', { class: 'dim small', text: 'Positions à 100 % du capital. Frais de 0,05 %. La même trajectoire de prix pour tous les joueurs aujourd’hui.' }));
          setTimeout(() => {
            chart = new TE.Chart(box, { zoom: 80, source: () => ({ a, def: Object.assign({}, def), tf: 1, lines: st.pos ? [{ kind: 'entry', price: st.pos.entry, color: getComputedStyle(document.body).getPropertyValue('--accent').trim(), dash: [], label: (st.pos.side > 0 ? 'LONG' : 'SHORT') + ' x' + st.pos.lev }, { kind: 'liq', price: st.pos.liq, color: getComputedStyle(document.body).getPropertyValue('--down').trim(), dash: [2, 3], label: 'LIQUIDATION' }] : [], ind: {} }) });
            raf = requestAnimationFrame(frame);
          }, 30);
        },
        buttons: [{ label: 'Quitter', cls: 'btn-ghost' }],
        onClose: () => { st.closed = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey, true); if (!st.done && st.t > 0) TE.Stats.add('dailyPlayed'); },
      });
      document.addEventListener('keydown', onKey, true);
      void m;
    },
  };
})(window.TE);
