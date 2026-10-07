/* V2 — SIÈGE view: the isometric headquarters (rendered by TE.Office) + HUD, roster and navigation. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const S = () => TE.state;
  const V = {};

  function build(root) {
    root.innerHTML = '';
    V.root = root;
    V.canvas = h('canvas', { class: 'of-canvas' });
    V.tipEl = h('div', { class: 'of-zone-tip', hidden: true });
    V.title = h('div', { class: 'of-title' });
    V.chips = h('div', { class: 'of-side' });
    V.wrap = h('div', { class: 'of-wrap' }, [V.canvas, h('div', { class: 'of-hud' }, [V.title, V.chips]), V.tipEl]);
    root.appendChild(h('div', { class: 'card' }, [
      h('div', { class: 'card-h' }, [h('span', { text: 'Siège' }), h('div', { class: 'card-tools' }, [
        h('button', { class: 'btn btn-ghost btn-xs', text: '⟲ Recentrer', tip: 'Recentrer la vue (double-clic)', on: { click: () => { TE.Office.cam = { zoom: 1, panX: 0, panY: 0 }; } } }),
        h('button', { class: 'btn btn-ghost btn-xs', text: '+', tip: 'Zoomer', on: { click: () => zoom(1.15) } }),
        h('button', { class: 'btn btn-ghost btn-xs', text: '−', tip: 'Dézoomer', on: { click: () => zoom(1 / 1.15) } }),
      ])]),
      V.wrap,
      h('div', { class: 'dim small', text: 'Cliquez sur une zone pour ouvrir le panneau correspondant · molette : zoom · glisser : déplacer. 1 avatar représente 1 employé au début, puis des groupes (×N) quand votre société grandit.' }),
    ]));
    V.roster = h('div', { class: 'of-roster' });
    V.next = h('div', { class: 'of-next' });
    root.appendChild(h('div', { class: 'two-col' }, [
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Effectif visible' }), V.rosterHr = h('span', { class: 'card-hr dim' })]), V.roster]),
      h('div', { class: 'card' }, [h('div', { class: 'card-h' }, [h('span', { text: 'Prochain siège' })]), V.next]),
    ]));
    bind();
    V.sig = ''; V.nsig = '';
    V.last = 0;
  }
  function zoom(f) { const c = TE.Office.cam; c.zoom = U.clamp(c.zoom * f, 0.55, 2.8); }
  function bind() {
    const cv = V.canvas;
    let drag = null, moved = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1 / 1.12 : 1.12); }, { passive: false });
    cv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, px: TE.Office.cam.panX, py: TE.Office.cam.panY }; moved = false; });
    window.addEventListener('mouseup', () => { drag = null; cv.classList.remove('dragging'); });
    cv.addEventListener('mousemove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        TE.Office.cam.panX = drag.px + dx; TE.Office.cam.panY = drag.py + dy;
      }
      const p = pos(e);
      const hit = TE.Office.pick(p.x, p.y);
      TE.Office.hover = hit;
      cv.classList.toggle('hover', !!hit);
      if (hit && !drag) {
        V.tipEl.hidden = false;
        V.tipEl.style.left = p.x + 'px'; V.tipEl.style.top = p.y + 'px';
        UI.html(V.tipEl, hit.zone.label + '<span>' + zoneSummary(hit.zone) + ' · cliquer pour ouvrir</span>');
      } else V.tipEl.hidden = true;
    });
    cv.addEventListener('mouseleave', () => { TE.Office.hover = null; V.tipEl.hidden = true; });
    cv.addEventListener('click', (e) => {
      if (moved) return;
      const p = pos(e);
      const hit = TE.Office.pick(p.x, p.y);
      if (hit && hit.zone.nav && S().profile.features[hit.zone.nav]) UI.go(hit.zone.nav);
      else if (hit && hit.zone.nav) UI.toast({ text: hit.zone.label + ' : ce panneau n’est pas encore débloqué.', kind: 'info', icon: '⌂', dur: 2000 });
    });
    cv.addEventListener('dblclick', () => { TE.Office.cam = { zoom: 1, panX: 0, panY: 0 }; });
    let tStart = null;
    cv.addEventListener('touchstart', (e) => { if (e.touches.length === 1) tStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: TE.Office.cam.panX, py: TE.Office.cam.panY }; }, { passive: true });
    cv.addEventListener('touchmove', (e) => { if (tStart && e.touches.length === 1) { TE.Office.cam.panX = tStart.px + e.touches[0].clientX - tStart.x; TE.Office.cam.panY = tStart.py + e.touches[0].clientY - tStart.y; } }, { passive: true });
    cv.addEventListener('touchend', () => { tStart = null; });
  }
  function zoneSummary(z) {
    const s = S();
    const st = s.run.staff;
    const roles = Object.keys(TE.Office.ROLES).filter((r) => TE.Office.ROLES[r].z[0] === z.k || (z.k === 'desk' && (r === 'junior' || r === 'senior')));
    const n = roles.reduce((a, r) => a + (st[r] || 0), 0);
    switch (z.k) {
      case 'desk': return U.int((st.junior || 0) + (st.senior || 0)) + ' traders · desk humain ' + U.money((TE.Bots.expected().byId.desk || 0)) + '/s';
      case 'servers': return 'latence ' + TE.Firm.fmtLatency(TE.Firm.latency()) + ' · ' + TE.Firm.fmtCompute(TE.Firm.compute());
      case 'wall': return U.int(TE.Bots.totalUnits()) + ' bots · ' + U.money(TE.Bots.expected().total) + '/s';
      case 'lab': return U.int(n) + ' chercheurs · ' + U.fmt(TE.Research.rate()) + ' RP/s';
      case 'board': return TE.Fund.active() ? 'AUM ' + U.money(TE.Fund.aum()) : 'fonds non créé';
      case 'exec': return Object.keys(s.run.legends).length + ' légende(s) · ' + (TE.Empire.active() ? 'empire actif' : 'empire à venir');
      case 'player': return 'retour au marché';
      default: return U.int(n) + ' employé(s)';
    }
  }
  function update() {
    const s = S();
    if (!V.root) return;
    const o = TE.Firm.office();
    const lvl = s.run.office;
    const infra = D.INFRA.reduce((a, x) => a + TE.Firm.infraCount(x.id), 0);
    UI.html(V.title, '<div class="k">NIVEAU ' + (lvl + 1) + ' / ' + D.OFFICES.length + '</div><b>' + UI.esc(o.name) + '</b><span>' + U.int(TE.Firm.staffTotal()) + ' / ' + U.int(TE.Firm.staffCap()) + ' employés · ' + Object.keys(s.run.legends).length + ' légende(s) · ' + U.int(infra) + ' équipements · ' + U.int(TE.Bots.totalUnits()) + ' bots</span>');
    // alert chips
    const chips = [];
    const ev = s.run.events.active.filter((i) => i.started);
    if (s.run.events.crisis && s.run.events.crisis.active) chips.push('<div class="of-chip alert">☠ CRISE : ' + UI.esc(D.CRISIS_MAP[s.run.events.crisis.id].name) + '</div>');
    if (ev.some((i) => D.EVENT_MAP[i.id] && D.EVENT_MAP[i.id].fx.outage)) chips.push('<div class="of-chip alert">⚠ PANNE : serveurs dégradés</div>');
    if (ev.some((i) => i.id === 'coffee')) chips.push('<div class="of-chip alert">☕ MACHINE À CAFÉ EN PANNE</div>');
    if (s.run.fund && s.run.fund.vip && (s.run.fund.vip.active || s.run.fund.vip.offer)) chips.push('<div class="of-chip">♛ <b>VIP</b> en salle du conseil</div>');
    chips.push('<div class="of-chip">Revenu <b>' + U.money(TE.Economy.passive()) + '/s</b></div>');
    UI.html(V.chips, chips.join(''));
    // roster
    const st = s.run.staff;
    const roles = Object.keys(TE.Office.ROLES).filter((r) => st[r] > 0);
    const sig = roles.map((r) => r + st[r]).join(',') + '|' + Object.keys(s.run.legends).join(',');
    if (sig !== V.sig) {
      V.sig = sig;
      V.roster.innerHTML = '';
      if (!roles.length && !Object.keys(s.run.legends).length) V.roster.appendChild(h('div', { class: 'dim small', text: 'Personne d’autre que vous pour l’instant. Embauchez dans EMPLOYÉS : ils apparaîtront ici.' }));
      roles.forEach((r) => V.roster.appendChild(h('div', { class: 'of-role', on: { click: () => UI.go('staff') } }, [h('i', { style: 'background:' + TE.Office.ROLES[r].c }), h('span', { text: (D.STAFF_MAP[r] || {}).name || TE.Office.ROLES[r].n }), h('b', { text: '×' + U.int(st[r]) })])));
      Object.keys(s.run.legends).forEach((id) => { const l = D.LEGEND_MAP[id]; if (l) V.roster.appendChild(h('div', { class: 'of-role of-legend', on: { click: () => UI.go('staff') } }, [h('i', { style: 'background:#ffd36b;box-shadow:0 0 8px #ffd36b' }), h('span', { text: '★ ' + l.name })])); });
    }
    UI.text(V.rosterHr, U.int(TE.Firm.staffTotal()) + ' employés');
    // next HQ
    const nx = TE.Firm.nextOffice();
    const nsig = (nx ? nx.id : 'max') + TE.Firm.officeEraOk();
    if (nsig !== V.nsig) {
      V.nsig = nsig;
      V.next.innerHTML = '';
      if (nx) {
        V.next.appendChild(h('div', {}, [h('b', { text: nx.name }), h('div', { class: 'dim small', text: nx.desc }), h('div', { class: 'small', text: nx.cap + ' places · tous les revenus ' + U.mult(nx.mult) + (TE.Firm.officeEraOk() ? '' : ' · disponible dans une ère suivante') })]));
        V.nbtn = UI.costBtn('EMMÉNAGER', () => TE.Firm.upgradeOffice());
        V.next.appendChild(V.nbtn);
      } else { V.nbtn = null; V.next.appendChild(h('div', { class: 'gold', text: 'Vous possédez le siège le plus impressionnant du système solaire.' })); }
    }
    if (V.nbtn && nx) V.nbtn._set(TE.Firm.officeEraOk() ? 'EMMÉNAGER' : 'ÈRE SUIVANTE REQUISE', nx.cost, TE.Firm.officeEraOk() && TE.Economy.canAfford(nx.cost));
  }
  function frame(nowMs) {
    if (!V.canvas || V.root.hidden || document.hidden) return;
    const anim = UI.anim();
    const minDt = anim ? 33 : 1000;
    if (nowMs - V.last < minDt) return;
    V.last = nowMs;
    const r = V.wrap.getBoundingClientRect();
    if (r.width < 50) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(r.width), H = Math.round(r.height);
    if (V.canvas.width !== Math.round(W * dpr) || V.canvas.height !== Math.round(H * dpr)) { V.canvas.width = Math.round(W * dpr); V.canvas.height = Math.round(H * dpr); }
    const t0 = performance.now();
    TE.Office.render(V.canvas.getContext('2d'), W, H, { dpr, t: anim ? nowMs / 1000 : 0 });
    V.cost = (V.cost || 0) * 0.9 + (performance.now() - t0) * 0.1;
  }
  UI.views.office = { build, update, frame, onShow() { V.last = 0; } };
  UI.officeCost = () => V.cost || 0;
})(window.TE);
