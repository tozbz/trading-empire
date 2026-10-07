/* UI toolkit: element builder, text diffing, tooltips, toasts, modals, confirmations,
 * visual effects (floating numbers, flashes, banners, particles) and the tutorial coach mark. */
(function (TE) {
  'use strict';
  const U = TE.U;
  const UI = TE.UI;

  /* ---------------- element builder ---------------- */
  UI.h = function (tag, props, children) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else Object.assign(el.style, v); }
        else if (k === 'on') { for (const e in v) el.addEventListener(e, v[e]); }
        else if (k === 'tip') el.setAttribute('data-tip', v);
        else if (k === 'data') { for (const d in v) el.dataset[d] = v[d]; }
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children !== undefined && children !== null) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c === null || c === undefined || c === false) return;
        el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return el;
  };
  const h = UI.h;
  UI.$ = (sel, root) => (root || document).querySelector(sel);
  UI.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  UI.text = function (el, txt) { if (el && el._t !== txt) { el._t = txt; el.textContent = txt; } };
  UI.html = function (el, html) { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } };
  UI.cls = function (el, name, on) { if (el && el.classList.contains(name) !== !!on) el.classList.toggle(name, !!on); };
  UI.attr = function (el, k, v) { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };
  UI.show = function (el, on) { if (el && el.hidden === !!on) el.hidden = !on; };
  UI.dir = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
  UI.signed = (v) => (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + U.smoney(v);
  UI.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- reduced motion ---------------- */
  UI.anim = () => TE.state && TE.state.settings.animations;

  /* ---------------- tooltips ---------------- */
  UI.tips = {};
  const tipEl = () => document.getElementById('tooltip');
  let tipTarget = null, tipTimer = null, lastMouse = { x: 0, y: 0 };
  function tipContent(el) {
    const spec = el.getAttribute('data-tip');
    if (!spec) return '';
    if (spec.indexOf('stat:') === 0) return UI.statTip(spec.slice(5));
    if (spec.indexOf('fn:') === 0) {
      const parts = spec.slice(3).split('|');
      const fn = UI.tips[parts[0]];
      return fn ? fn(parts[1], el) : '';
    }
    return spec;
  }
  function placeTip() {
    const t = tipEl();
    if (!t || t.hidden) return;
    const pad = 14;
    const r = t.getBoundingClientRect();
    let x = lastMouse.x + pad, y = lastMouse.y + pad;
    if (x + r.width > window.innerWidth - 8) x = lastMouse.x - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = lastMouse.y - r.height - pad;
    t.style.transform = 'translate(' + Math.max(4, x) + 'px,' + Math.max(4, y) + 'px)';
  }
  function showTip(el) {
    const t = tipEl();
    const html = tipContent(el);
    if (!html) { hideTip(); return; }
    t.innerHTML = html;
    t.hidden = false;
    placeTip();
  }
  function hideTip() { const t = tipEl(); if (t) t.hidden = true; tipTarget = null; clearInterval(tipTimer); }
  UI.hideTip = hideTip;
  UI.initTooltips = function () {
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el === tipTarget) return;
      if (!el) { hideTip(); return; }
      tipTarget = el;
      showTip(el);
      clearInterval(tipTimer);
      tipTimer = setInterval(() => { if (tipTarget && document.body.contains(tipTarget)) showTip(tipTarget); else hideTip(); }, 400);
    });
    document.addEventListener('mousemove', (e) => { lastMouse.x = e.clientX; lastMouse.y = e.clientY; if (tipTarget) placeTip(); }, { passive: true });
    document.addEventListener('mousedown', () => { if (tipTarget && !tipTarget.closest('.keeptip')) hideTip(); });
    // V2 "POURQUOI ?": elements marked data-why open their explanation in a pinned panel (also works on touch screens)
    document.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-why]');
      if (!el) return;
      const html = tipContent(el);
      if (!html) return;
      hideTip();
      UI.modal({ title: '<span class="why-k">POURQUOI ?</span>', cls: 'modal-sm modal-why', body: '<div class="why-body">' + html + '</div>', buttons: [{ label: 'Fermer', cls: 'btn-ghost' }] });
    });
  };
  UI.tipContent = tipContent;

  /* ---------------- V2: one-time micro tutorials ---------------- */
  // one card at a time: tips that arrive together (e.g. an old save unlocking several systems) wait their turn
  const tipQ = [];
  UI.tipCard = function (tip) {
    let root = document.getElementById('tipcards');
    if (!root) { root = h('div', { id: 'tipcards' }); document.body.appendChild(root); }
    if (root.children.length) { if (tipQ.length < 4) tipQ.push(tip); return null; }
    const el = h('div', { class: 'tipcard' }, [
      h('div', { class: 'tc-k', text: 'ASTUCE' }), h('div', { class: 'tc-t', text: tip.title }), h('div', { class: 'tc-x', text: tip.text }),
      h('button', { class: 'btn btn-primary btn-xs', text: 'COMPRIS', on: { click: () => {
        el.classList.add('out');
        setTimeout(() => { el.remove(); if (tipQ.length) setTimeout(() => UI.tipCard(tipQ.shift()), 350); }, 300);
      } } }),
    ]);
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    return el;
  };
  /** Modifier breakdown tooltip: where does a value come from? */
  UI.statTip = function (stat) {
    const b = TE.Mods.breakdown(stat);
    const d = TE.Mods.def(stat);
    let html = '<div class="tt-title">' + UI.esc(b.label) + '</div><div class="tt-big">' + TE.Mods.fmtValue(stat, b.value) + '</div><div class="tt-sec">POURQUOI ?</div>';
    html += '<div class="tt-row tt-dim"><span>Base</span><span>' + (d.type === 'flat' ? TE.Mods.fmtValue(stat, b.base) : '×1') + '</span></div>';
    b.rows.forEach((r) => {
      html += '<div class="tt-row"><span>' + UI.esc(r.cat) + '</span><span class="' + (r.temp ? 'c-amber' : 'c-up') + '">' + r.txt + '</span></div>';
      r.items.slice(0, 6).forEach((it) => { html += '<div class="tt-sub"><span>' + UI.esc(it.src) + '</span><span>' + (it.txt || '') + '</span></div>'; });
      if (r.items.length > 6) html += '<div class="tt-sub"><span>+' + (r.items.length - 6) + ' autres</span><span></span></div>';
    });
    if (!b.rows.length) html += '<div class="tt-dim">Aucun bonus pour l’instant.</div>';
    return html;
  };

  /* ---------------- toasts ---------------- */
  UI.toast = function (opts) {
    if (typeof opts === 'string') opts = { text: opts };
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = h('div', { class: 'toast ' + (opts.kind || 'info') }, [
      opts.icon ? h('div', { class: 'toast-icon', text: opts.icon }) : null,
      h('div', { class: 'toast-body' }, [
        opts.title ? h('div', { class: 'toast-title', text: opts.title }) : null,
        h('div', { class: 'toast-text', html: opts.html || UI.esc(opts.text || '') }),
      ]),
    ]);
    el.addEventListener('click', () => dismiss());
    root.appendChild(el);
    while (root.children.length > 5) root.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    const t = setTimeout(dismiss, opts.dur || 4200);
    function dismiss() { clearTimeout(t); el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 300); }
    return el;
  };

  /* ---------------- modals ---------------- */
  UI.modal = function (opts) {
    const root = document.getElementById('modal-root');
    const box = h('div', { class: 'modal ' + (opts.cls || '') });
    const overlay = h('div', { class: 'modal-overlay' }, [box]);
    if (opts.title) box.appendChild(h('div', { class: 'modal-title', html: opts.title }));
    const body = h('div', { class: 'modal-body' });
    box.appendChild(body);
    if (typeof opts.body === 'function') opts.body(body, close);
    else if (opts.body) body.innerHTML = opts.body;
    if (opts.buttons && opts.buttons.length) {
      const row = h('div', { class: 'modal-btns' });
      opts.buttons.forEach((b) => {
        row.appendChild(h('button', { class: 'btn ' + (b.cls || ''), text: b.label, on: { click: () => { const keep = b.onClick && b.onClick(close); if (keep !== true) close(); } } }));
      });
      box.appendChild(row);
    }
    function close() {
      overlay.classList.add('out');
      setTimeout(() => overlay.remove(), 200);
      if (opts.onClose) opts.onClose();
      document.removeEventListener('keydown', onKey, true);
    }
    function onKey(e) { if (e.key === 'Escape' && !opts.locked) { e.stopPropagation(); close(); } }
    if (!opts.locked) overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);
    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('in'));
    return { close, box, body };
  };
  UI.modalOpen = () => !!document.querySelector('#modal-root .modal-overlay');
  UI.confirm = function (opts) {
    if (opts.optional && TE.state && !TE.state.settings.confirmations) { opts.onYes(); return; }
    UI.modal({
      title: opts.title || 'Confirmation', body: opts.body || '', cls: opts.cls || 'modal-sm',
      buttons: [{ label: opts.no || 'Annuler', cls: 'btn-ghost' }, { label: opts.yes || 'Confirmer', cls: opts.danger ? 'btn-danger' : 'btn-primary', onClick: () => opts.onYes() }],
    });
  };

  /* ---------------- effects ---------------- */
  const FX = (UI.FX = {});
  FX.float = function (x, y, text, cls, big) {
    if (!UI.anim()) return;
    const layer = document.getElementById('fx-layer');
    if (!layer || layer.children.length > 40) return;
    const el = h('div', { class: 'fx-float ' + (cls || '') + (big ? ' big' : ''), text });
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), big ? 1700 : 1200);
  };
  FX.floatFrom = function (el, text, cls, big) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    FX.float(r.left + r.width / 2 + U.range(-20, 20), r.top + U.range(-4, 6), text, cls, big);
  };
  FX.flash = function (kind) {
    if (!UI.anim()) return;
    const el = document.getElementById('screen-flash');
    if (!el) return;
    el.className = '';
    void el.offsetWidth;
    el.className = 'flash-' + kind;
  };
  FX.shake = function () {
    if (!UI.anim()) return;
    const app = document.getElementById('app');
    app.classList.remove('shake');
    void app.offsetWidth;
    app.classList.add('shake');
  };
  FX.pulse = function (el, cls) {
    if (!el || !UI.anim()) return;
    const c = cls || 'pulse';
    el.classList.remove(c);
    void el.offsetWidth;
    el.classList.add(c);
  };
  /** Top banner, e.g. NEW SYSTEM ONLINE. */
  // V2: banners are queued (several systems unlocking in the same second used to overlap)
  const bannerQ = [];
  let bannerBusy = false;
  FX.banner = function (title, sub, kind) {
    bannerQ.push([title, sub, kind]);
    if (bannerQ.length > 4) bannerQ.shift();
    if (!bannerBusy) nextBanner();
  };
  function nextBanner() {
    const x = bannerQ.shift();
    if (!x) { bannerBusy = false; return; }
    bannerBusy = true;
    const [title, sub, kind] = x;
    const root = document.getElementById('banner-root');
    const el = h('div', { class: 'banner ' + (kind || '') }, [h('div', { class: 'banner-k', text: kind === 'era' ? 'NOUVELLE ÈRE' : 'SYSTÈME EN LIGNE' }), h('div', { class: 'banner-t', text: title }), sub ? h('div', { class: 'banner-s', text: sub }) : null]);
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => { el.remove(); nextBanner(); }, 500); }, bannerQ.length ? 2200 : 3200);
  }
  /** Center-stage celebration (milestones, eras, prestige). */
  FX.stage = function (opts) {
    const root = document.getElementById('banner-root');
    const el = h('div', { class: 'stage ' + (opts.cls || '') }, [
      opts.kicker ? h('div', { class: 'stage-k', text: opts.kicker }) : null,
      h('div', { class: 'stage-t', text: opts.title }),
      opts.value ? h('div', { class: 'stage-v', text: opts.value }) : null,
      opts.sub ? h('div', { class: 'stage-s', text: opts.sub }) : null,
    ]);
    root.appendChild(el);
    el.addEventListener('click', () => done());
    requestAnimationFrame(() => el.classList.add('in'));
    if (opts.particles !== false) FX.burst(window.innerWidth / 2, window.innerHeight * 0.42, opts.color || '#19f58c', 70);
    const t = setTimeout(done, opts.dur || 2600);
    function done() { clearTimeout(t); el.classList.add('out'); setTimeout(() => el.remove(), 600); }
  };

  /* particles (canvas overlay) */
  const parts = [];
  let pctx = null, prunning = false;
  FX.burst = function (x, y, color, n) {
    if (!UI.anim()) return;
    const cv = document.getElementById('fx-canvas');
    if (!cv) return;
    if (!pctx) pctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== window.innerWidth * dpr) { cv.width = window.innerWidth * dpr; cv.height = window.innerHeight * dpr; }
    const glyphs = ['$', '$', '▲', '◆', '•'];
    for (let i = 0; i < (n || 40); i++) {
      const a = Math.random() * Math.PI * 2, sp = U.range(2, 9);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, life: U.range(50, 90), age: 0, g: U.pick(glyphs), c: color, s: U.range(10, 20) });
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
    if (!prunning) { prunning = true; requestAnimationFrame(stepParts); }
  };
  function stepParts() {
    const cv = document.getElementById('fx-canvas');
    const dpr = window.devicePixelRatio || 1;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age++; p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.985;
      const a = 1 - p.age / p.life;
      if (a <= 0) { parts.splice(i, 1); continue; }
      pctx.globalAlpha = a;
      pctx.fillStyle = p.c;
      pctx.font = '700 ' + p.s + 'px JetBrains Mono, monospace';
      pctx.fillText(p.g, p.x, p.y);
    }
    pctx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(stepParts);
    else { prunning = false; pctx.clearRect(0, 0, cv.width, cv.height); }
  }

  /* ---------------- smooth number display ---------------- */
  UI.Smooth = function () { this.v = null; };
  UI.Smooth.prototype.step = function (target, rate) {
    // snap on resets / huge drops: animating $100M down to $100 just looks like a glitch
    if (this.v === null || !isFinite(this.v) || !UI.anim() || (target >= 0 && target < this.v * 0.05)) { this.v = target; return target; }
    if (target <= 0 || this.v <= 0) { this.v += (target - this.v) * (rate || 0.35); }
    else { const lv = Math.log(this.v), lt = Math.log(target); this.v = Math.exp(lv + (lt - lv) * (rate || 0.35)); }
    if (Math.abs(this.v - target) <= Math.abs(target) * 1e-4 + 0.004) this.v = target;
    return this.v;
  };

  /* ---------------- coach mark (tutorial) ---------------- */
  let coachFor = null;
  UI.coach = function (step) {
    const el = document.getElementById('coach');
    if (!step) { el.hidden = true; coachFor = null; return; }
    const target = document.querySelector(step.anchor);
    if (!target || !target.offsetParent) { el.hidden = true; return; }
    if (coachFor !== step.id) {
      coachFor = step.id;
      el.innerHTML = '<div class="coach-text">' + step.text + '</div><button class="coach-x" title="Masquer l’astuce">✕</button>';
      el.querySelector('.coach-x').onclick = () => { TE.state.profile.tutorial[step.id] = 1; el.hidden = true; coachFor = null; };
    }
    el.hidden = false;
    const r = target.getBoundingClientRect();
    const w = el.offsetWidth, hh = el.offsetHeight;
    let x, y;
    el.dataset.side = step.side;
    if (step.side === 'right') { x = r.right + 12; y = r.top + r.height / 2 - hh / 2; }
    else if (step.side === 'left') { x = r.left - w - 14; y = r.top + r.height / 2 - hh / 2; }
    else { x = r.left + r.width / 2 - w / 2; y = r.bottom + 12; }
    if (x < 8) { x = r.left; y = r.bottom + 12; el.dataset.side = 'bottom'; }
    x = U.clamp(x, 8, window.innerWidth - w - 8);
    y = U.clamp(y, 8, window.innerHeight - hh - 8);
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  };
})(window.TE);
