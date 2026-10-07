/* V2 — SIÈGE: an isometric, living view of the firm (Canvas 2D, no dependency).
 * Eight different headquarters (the game's OFFICES), aggregated staff avatars (1 avatar = N employees at scale),
 * unique legends, server racks from the infrastructure, a bot screen wall, and many small reactions to the game:
 * wins, losses, liquidations, bot crits, breaking news, crises, outages, the coffee machine, VIP meetings,
 * legendary hires, headquarters upgrades and prestige. Zones are clickable and open the matching panel.
 * Renders only while visible (≤ 30 FPS, 1 FPS with animations off), never when the tab is hidden. */
(function (TE) {
  'use strict';
  const U = TE.U, D = TE.Data, UI = TE.UI, h = UI.h;
  const O = (TE.Office = {});
  const TW = 64, TH = 32;
  const S = () => TE.state;

  /* ---------------- roles: colours and where they sit ---------------- */
  const ROLES = {
    intern: { c: '#8ea3bf', z: ['cafe', 'desk'], n: 'Stagiaires' },
    junior: { c: '#3d8bff', z: ['desk'], n: 'Traders juniors' },
    senior: { c: '#19e6ff', z: ['desk'], n: 'Traders seniors' },
    quant: { c: '#a77bff', z: ['lab', 'desk'], n: 'Quants' },
    engineer: { c: '#19f58c', z: ['eng', 'lab', 'desk'], n: 'Ingénieurs' },
    riskmgr: { c: '#ff3d68', z: ['risk', 'desk'], n: 'Risk managers' },
    ir: { c: '#ff7ac8', z: ['board', 'desk'], n: 'Relations investisseurs' },
    pm: { c: '#e8c15a', z: ['board', 'desk'], n: 'Gérants' },
    cio: { c: '#ffffff', z: ['exec', 'board', 'desk'], n: 'Directeur des investissements' },
    airesearcher: { c: '#00ffd5', z: ['lab', 'desk'], n: 'Chercheurs IA' },
    lobbyist: { c: '#ffb627', z: ['board', 'exec', 'desk'], n: 'Lobbyistes' },
    physicist: { c: '#ff4fd8', z: ['lab', 'desk'], n: 'Physiciens' },
  };
  O.ROLES = ROLES;
  const ZONE_NAV = { desk: 'staff', lab: 'research', eng: 'infra', risk: 'staff', board: 'fund', exec: 'empire', cafe: 'staff', servers: 'infra', wall: 'bots', player: 'market' };
  const ZONE_NAME = { desk: 'Salle des marchés', lab: 'Laboratoire de recherche', eng: 'Ingénierie', risk: 'Desk risques', board: 'Salle du conseil', exec: 'Direction', cafe: 'Espace café', servers: 'Salle serveurs', wall: 'Mur des bots', player: 'Votre poste' };
  const RNG = (seed) => U.mulberry32(seed);

  /* ---------------- the eight headquarters (same order as D.OFFICES) ---------------- */
  const LEVELS = [
    { w: 6, h: 5, theme: 'home', player: [1, 1], zones: [{ k: 'desk', x: 3, y: 3, w: 3, h: 1 }], decor: [{ t: 'bed', x: 3, y: 0, w: 2, h: 2 }, { t: 'plant', x: 0, y: 4 }, { t: 'shelf', x: 0, y: 0 }] },
    { w: 9, h: 7, theme: 'office', player: [1, 1], zones: [{ k: 'desk', x: 3, y: 0, w: 6, h: 4 }, { k: 'servers', x: 0, y: 4, w: 2, h: 3 }, { k: 'cafe', x: 6, y: 5, w: 3, h: 2 }], decor: [{ t: 'plant', x: 2, y: 6 }, { t: 'plant', x: 0, y: 0 }] },
    { w: 13, h: 10, theme: 'floor', player: [1, 1], zones: [{ k: 'desk', x: 4, y: 0, w: 9, h: 6 }, { k: 'servers', x: 0, y: 4, w: 3, h: 4 }, { k: 'lab', x: 4, y: 7, w: 5, h: 3 }, { k: 'risk', x: 10, y: 7, w: 3, h: 3 }, { k: 'cafe', x: 0, y: 8, w: 3, h: 2 }], decor: [{ t: 'plant', x: 3, y: 0 }], wall: true },
    { w: 17, h: 13, theme: 'tower', player: [1, 1], zones: [{ k: 'desk', x: 4, y: 0, w: 9, h: 6 }, { k: 'servers', x: 0, y: 4, w: 3, h: 5 }, { k: 'lab', x: 4, y: 7, w: 6, h: 3 }, { k: 'eng', x: 11, y: 7, w: 3, h: 3 }, { k: 'risk', x: 0, y: 10, w: 3, h: 3 }, { k: 'board', x: 14, y: 0, w: 3, h: 4 }, { k: 'exec', x: 14, y: 5, w: 3, h: 4 }, { k: 'cafe', x: 11, y: 11, w: 3, h: 2 }], decor: [{ t: 'plant', x: 3, y: 12 }, { t: 'plant', x: 16, y: 12 }], wall: true },
    // Siège mondial: a campus — tree-lined walkway and a scrolling stock ticker along the walls
    { w: 19, h: 14, theme: 'hq', sig: 'campus', player: [1, 1], zones: [{ k: 'desk', x: 4, y: 0, w: 11, h: 6 }, { k: 'servers', x: 0, y: 3, w: 3, h: 6 }, { k: 'lab', x: 4, y: 7, w: 7, h: 3 }, { k: 'eng', x: 12, y: 7, w: 3, h: 3 }, { k: 'risk', x: 0, y: 10, w: 3, h: 4 }, { k: 'board', x: 16, y: 0, w: 3, h: 5 }, { k: 'exec', x: 16, y: 6, w: 3, h: 4 }, { k: 'cafe', x: 12, y: 11, w: 4, h: 3 }],
      decor: [{ t: 'plant', x: 3, y: 13 }, { t: 'globe', x: 17, y: 12 }, { t: 'tree', x: 4.6, y: 6 }, { t: 'tree', x: 7.6, y: 6 }, { t: 'tree', x: 10.6, y: 6 }, { t: 'tree', x: 13.6, y: 6 }], wall: true, map: true },
    // Citadelle financière: a city in the city — monumental columns and a glowing seal on the trading floor
    { w: 21, h: 16, theme: 'citadel', sig: 'citadel', player: [1, 1], zones: [{ k: 'desk', x: 4, y: 0, w: 12, h: 8 }, { k: 'servers', x: 0, y: 3, w: 3, h: 8 }, { k: 'lab', x: 4, y: 9, w: 8, h: 3 }, { k: 'eng', x: 13, y: 9, w: 4, h: 3 }, { k: 'risk', x: 0, y: 12, w: 3, h: 4 }, { k: 'board', x: 18, y: 0, w: 3, h: 6 }, { k: 'exec', x: 18, y: 7, w: 3, h: 5 }, { k: 'cafe', x: 13, y: 13, w: 5, h: 3 }],
      decor: [{ t: 'globe', x: 19, y: 14 }, { t: 'plant', x: 3, y: 15 }, { t: 'column', x: 3.3, y: 1.2 }, { t: 'column', x: 3.3, y: 5.2 }, { t: 'column', x: 3.3, y: 9.2 }, { t: 'column', x: 17.2, y: 1.2 }, { t: 'column', x: 17.2, y: 5.2 }, { t: 'column', x: 12.4, y: 13.2 }], wall: true, map: true },
    // Station orbitale: portholes on the Earth, light rings on the deck, structural beams
    { w: 21, h: 16, theme: 'orbit', sig: 'orbit', player: [1, 1], zones: [{ k: 'desk', x: 4, y: 0, w: 12, h: 8 }, { k: 'servers', x: 0, y: 3, w: 3, h: 8 }, { k: 'lab', x: 4, y: 9, w: 8, h: 3 }, { k: 'eng', x: 13, y: 9, w: 4, h: 3 }, { k: 'risk', x: 0, y: 12, w: 3, h: 4 }, { k: 'board', x: 18, y: 0, w: 3, h: 6 }, { k: 'exec', x: 18, y: 7, w: 3, h: 5 }, { k: 'cafe', x: 13, y: 13, w: 5, h: 3 }], decor: [{ t: 'holo', x: 19, y: 14 }], wall: true, map: true },
    { w: 23, h: 17, theme: 'dyson', player: [1, 1], zones: [{ k: 'desk', x: 4, y: 0, w: 13, h: 8 }, { k: 'servers', x: 0, y: 3, w: 3, h: 9 }, { k: 'lab', x: 4, y: 10, w: 8, h: 3 }, { k: 'eng', x: 14, y: 10, w: 4, h: 3 }, { k: 'risk', x: 0, y: 13, w: 3, h: 4 }, { k: 'board', x: 19, y: 0, w: 4, h: 6 }, { k: 'exec', x: 19, y: 7, w: 4, h: 6 }, { k: 'cafe', x: 14, y: 14, w: 5, h: 3 }], decor: [{ t: 'core', x: 20, y: 14 }], wall: true, map: true },
  ];
  O.LEVELS = LEVELS;
  const THEMES = {
    home: { floor: ['#101521', '#0d121b'], wall: '#161d2b', wall2: '#121825', trim: '#3d8bff', desk: '#3a2c22', deskTop: '#5a4532', glow: '#19e6ff', sky: 'night' },
    office: { floor: ['#0f141d', '#0c1118'], wall: '#151c28', wall2: '#111723', trim: '#19e6ff', desk: '#202a38', deskTop: '#2c394c', glow: '#19e6ff', sky: 'street' },
    floor: { floor: ['#0d1119', '#0a0e15'], wall: '#141b27', wall2: '#101622', trim: '#19e6ff', desk: '#1b2533', deskTop: '#283649', glow: '#19e6ff', sky: 'city' },
    tower: { floor: ['#0c1018', '#090d14'], wall: '#131a26', wall2: '#0f1520', trim: '#a77bff', desk: '#1a2331', deskTop: '#263346', glow: '#19e6ff', sky: 'high' },
    hq: { floor: ['#0b0f17', '#080c12'], wall: '#121925', wall2: '#0e141e', trim: '#ffd36b', desk: '#1a2230', deskTop: '#283447', glow: '#19e6ff', sky: 'high' },
    citadel: { floor: ['#0a0e16', '#070b11'], wall: '#111824', wall2: '#0d131d', trim: '#ffd36b', desk: '#182130', deskTop: '#24314a', glow: '#00ffd5', sky: 'aerial' },
    orbit: { floor: ['#0a0c16', '#07080f'], wall: '#10131f', wall2: '#0c0f19', trim: '#00ffd5', desk: '#161c2c', deskTop: '#222c44', glow: '#00ffd5', sky: 'space' },
    dyson: { floor: ['#120d0a', '#0d0907'], wall: '#1a120c', wall2: '#140e09', trim: '#ffb627', desk: '#20160f', deskTop: '#33241a', glow: '#ffd36b', sky: 'sun' },
  };

  /* ---------------- projection ---------------- */
  const P = (x, y, z) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 - (z || 0) });
  function poly(ctx, pts, fill, stroke) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
    const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
    const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  /** Isometric box: footprint (x,y,w,d) in tiles, base z and height hh in px. */
  function box(ctx, x, y, w, d, z, hh, top, left, right, stroke) {
    const a = P(x, y, z + hh), b = P(x + w, y, z + hh), c = P(x + w, y + d, z + hh), e = P(x, y + d, z + hh);
    const b0 = P(x + w, y, z), c0 = P(x + w, y + d, z), e0 = P(x, y + d, z);
    poly(ctx, [e0, c0, c, e], left, stroke);
    poly(ctx, [c0, b0, b, c], right, stroke);
    poly(ctx, [a, b, c, e], top, stroke);
  }

  /* ---------------- scene: furniture & seats from the level + game state ---------------- */
  function buildScene(lvl) {
    const L = LEVELS[lvl];
    const sc = { lvl, L, th: THEMES[L.theme], items: [], seats: {}, zones: [], racks: [], screens: [], cafe: null, board: null };
    // zones
    L.zones.forEach((z) => {
      const zone = Object.assign({ seats: [], label: ZONE_NAME[z.k], nav: ZONE_NAV[z.k] }, z);
      sc.zones.push(zone);
      if (z.k === 'desk' || z.k === 'lab' || z.k === 'eng' || z.k === 'risk') {
        for (let r = 0; r < z.h; r += 2) {
          for (let c = 0; c < z.w; c++) {
            const dx = z.x + c, dy = z.y + r;
            sc.items.push({ t: 'desk', k: z.k, x: dx + 0.08, y: dy + 0.12, mon: lvl >= 2 ? (z.k === 'desk' ? Math.min(3, 1 + Math.floor(lvl / 2)) : 2) : 1 });
            zone.seats.push({ x: dx + 0.5, y: dy + 1.05 });
          }
        }
      } else if (z.k === 'board') {
        sc.items.push({ t: 'table', x: z.x + 0.6, y: z.y + 0.7, w: z.w - 1.2, d: z.h - 1.4 });
        sc.board = { x: z.x + z.w / 2, y: z.y + z.h / 2 };
        for (let i = 0; i < z.h - 1; i++) { zone.seats.push({ x: z.x + 0.35, y: z.y + 1 + i }); zone.seats.push({ x: z.x + z.w - 0.35, y: z.y + 1 + i }); }
      } else if (z.k === 'exec') {
        sc.items.push({ t: 'execdesk', x: z.x + 0.6, y: z.y + 0.4 });
        sc.items.push({ t: 'sofa', x: z.x + 0.3, y: z.y + z.h - 1.1, w: z.w - 0.6 });
        zone.seats.push({ x: z.x + 1.3, y: z.y + 1.5 });
        for (let i = 0; i < z.w - 1; i++) zone.seats.push({ x: z.x + 0.8 + i, y: z.y + z.h - 0.4 });
        for (let i = 0; i < z.h - 3; i++) zone.seats.push({ x: z.x + z.w - 0.5, y: z.y + 2.2 + i });
      } else if (z.k === 'cafe') {
        sc.items.push({ t: 'coffee', x: z.x + 0.1, y: z.y + 0.1 });
        sc.cafe = { x: z.x + 0.5, y: z.y + 0.6 };
        sc.items.push({ t: 'cafetable', x: z.x + z.w - 1.2, y: z.y + z.h - 1.2 });
        for (let i = 0; i < z.w - 1; i++) zone.seats.push({ x: z.x + 1.2 + i, y: z.y + 1.2 });
        zone.seats.push({ x: z.x + z.w - 0.6, y: z.y + z.h - 0.2 });
      } else if (z.k === 'servers') {
        for (let c = 0; c < z.w; c += 2) for (let r = 0; r < z.h; r++) sc.racks.push({ x: z.x + c + 0.15, y: z.y + r + 0.1 });
      }
      sc.seats[z.k] = (sc.seats[z.k] || []).concat(zone.seats);
    });
    // decor
    L.decor.forEach((d) => sc.items.push(Object.assign({ deco: true }, d)));
    // player's own desk
    sc.items.push({ t: 'pdesk', x: L.player[0] + 0.05, y: L.player[1] + 0.1 });
    sc.player = { x: L.player[0] + 0.5, y: L.player[1] + 1.05 };
    sc.zones.push({ k: 'player', x: L.player[0], y: L.player[1], w: 1, h: 2, label: ZONE_NAME.player, nav: 'market', seats: [] });
    // bot screen wall on the back wall
    if (L.wall) sc.wall = { x0: 4, x1: Math.min(L.w - 1, 4 + Math.max(4, Math.floor(L.w * 0.45))) };
    return sc;
  }

  /* ---------------- population: aggregated avatars ---------------- */
  const STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  function populate(sc) {
    const s = S();
    const st = s.run.staff;
    const byZone = {};
    Object.keys(ROLES).forEach((r) => {
      const n = st[r] || 0;
      if (!n) return;
      const z = ROLES[r].z.find((k) => (sc.seats[k] || []).length) || 'desk';
      (byZone[z] = byZone[z] || []).push({ r, n });
    });
    const people = [];
    const labels = [];
    Object.keys(byZone).forEach((z) => {
      const seats = sc.seats[z] || [];
      if (!seats.length) return;
      const list = byZone[z];
      const total = list.reduce((a, x) => a + x.n, 0);
      let ratio = 1;
      for (let i = 0; i < STEPS.length; i++) { ratio = STEPS[i]; if (Math.ceil(total / ratio) <= seats.length) break; }
      let si = 0;
      const rng = RNG(z.length * 977 + sc.lvl);
      list.forEach((x) => {
        const k = Math.max(1, Math.round(x.n / ratio));
        for (let i = 0; i < k && si < seats.length; i++, si++) people.push({ r: x.r, c: ROLES[x.r].c, x: seats[si].x, y: seats[si].y, ph: rng() * 6.28, z });
      });
      const zone = sc.zones.find((q) => q.k === z);
      if (zone) labels.push({ zone, total, ratio, roles: list });
    });
    // interns wander between their seat and the coffee machine
    people.forEach((p) => { if (p.r === 'intern' && sc.cafe) p.walker = true; });
    // legends: unique avatars near the direction
    const legs = Object.keys(s.run.legends || {}).filter((id) => D.LEGEND_MAP[id]);
    const execSeats = (sc.seats.exec || []).slice(1);
    legs.forEach((id, i) => {
      const l = D.LEGEND_MAP[id];
      // without a direction floor, legends stand around your own desk
      const seat = execSeats.length ? execSeats[i % execSeats.length] : { x: Math.min(sc.L.w - 0.4, sc.player.x + 0.9 + (i % 3) * 0.7), y: Math.min(sc.L.h - 0.3, sc.player.y + 0.7 + Math.floor(i / 3) * 0.8) };
      const away = s.run.legendsAway && s.run.legendsAway[id] > s.run.time;
      const initials = l.name.replace(/[“”«»"'.?]/g, '').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('') || '?';
      people.push({ r: 'legend', id, c: '#ffd36b', x: seat.x + (execSeats.length ? 0 : 0), y: seat.y, ph: i, legend: l, initials, away });
    });
    return { people, labels };
  }

  /* ---------------- live effects (fed by the event bus even when the view is hidden) ---------------- */
  const FX = { cheer: 0, slump: 0, liq: 0, breaking: 0, breakingText: '', crit: 0, critColor: '#ffd36b', legend: null, upgrade: 0, money: [], confetti: [] };
  O.FX = FX;
  const now = () => performance.now() / 1000;
  TE.Bus.on('trade:close', (t) => {
    if (!TE.state) return;
    if (t.reason === 'liq') FX.liq = now();
    else if (t.net > 0) { FX.cheer = now(); FX.money.push({ t: now(), v: t.total }); if (Math.abs(t.total) > Math.max(1, TE.Economy.netWorth() * 0.05)) burst(30); }
    else FX.slump = now();
    if (FX.money.length > 6) FX.money.shift();
  });
  TE.Bus.on('bot:batch', (b) => { if (b.entry && b.entry.crit) { FX.crit = now(); FX.critColor = b.def.color || '#ffd36b'; } });
  TE.Bus.on('news', (n) => { if (n && n.impact === 'HIGH') { FX.breaking = now(); FX.breakingText = (n.text || '').slice(0, 64); } });
  TE.Bus.on('legend:hire', (l) => { FX.legend = { id: l.id, t: now() }; });
  TE.Bus.on('office:upgrade', () => { FX.upgrade = now(); });
  function burst(n) { for (let i = 0; i < n; i++) FX.confetti.push({ x: 0, y: 0, vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 4, t: now(), c: ['#19f58c', '#19e6ff', '#ffd36b', '#ff7ac8'][i % 4] }); }

  /* ---------------- drawing primitives ---------------- */
  function drawFloor(ctx, sc, t) {
    const L = sc.L, th = sc.th;
    for (let x = 0; x < L.w; x++) {
      for (let y = 0; y < L.h; y++) {
        poly(ctx, [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], (x + y) % 2 ? th.floor[0] : th.floor[1], 'rgba(120,150,190,0.06)');
      }
    }
    // zone tints
    sc.zones.forEach((z) => {
      if (z.k === 'player') return;
      const col = { desk: '25,230,255', lab: '167,123,255', eng: '25,245,140', risk: '255,61,104', board: '255,122,200', exec: '255,211,107', cafe: '255,182,39', servers: '61,139,255' }[z.k] || '120,150,190';
      poly(ctx, [P(z.x, z.y), P(z.x + z.w, z.y), P(z.x + z.w, z.y + z.h), P(z.x, z.y + z.h)], 'rgba(' + col + ',0.045)', 'rgba(' + col + ',0.18)');
    });
    if (L.sig === 'citadel' || L.sig === 'orbit') { ctx.save(); poly(ctx, [P(0, 0), P(L.w, 0), P(L.w, L.h), P(0, L.h)]); ctx.clip(); }
    if (L.sig === 'citadel') {
      // the citadel's seal, inlaid in the trading floor
      const c = P(10, 4);
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.5);
      ctx.strokeStyle = 'rgba(255,211,107,' + (0.28 + 0.08 * Math.sin(t * 0.9)) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 170, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,255,213,0.22)';
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + t * 0.05; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); ctx.lineTo(Math.cos(a) * 150, Math.sin(a) * 150); ctx.stroke(); }
      ctx.restore(); ctx.lineWidth = 1;
    } else if (L.sig === 'orbit') {
      // light rings on the deck of the station
      const c = P(L.w / 2, L.h / 2);
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.5);
      for (let k = 0; k < 3; k++) {
        const r = 120 + k * 110 + ((t * 18) % 110);
        ctx.strokeStyle = 'rgba(0,255,213,' + Math.max(0, 0.22 - (r - 120) / 1600) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore(); ctx.lineWidth = 1;
    }
    if (L.sig === 'citadel' || L.sig === 'orbit') ctx.restore();
    if (O.hover && O.hover.zone) {
      const z = O.hover.zone;
      poly(ctx, [P(z.x, z.y), P(z.x + z.w, z.y), P(z.x + z.w, z.y + z.h), P(z.x, z.y + z.h)], 'rgba(25,230,255,' + (0.1 + 0.05 * Math.sin(t * 5)) + ')', 'rgba(25,230,255,0.7)');
    }
  }
  function drawWalls(ctx, sc, t, st) {
    const L = sc.L, th = sc.th;
    const WH = 92;
    // back-left wall (along y at x=0) and back-right wall (along x at y=0)
    poly(ctx, [P(0, 0), P(0, L.h), P(0, L.h, WH), P(0, 0, WH)], th.wall2, 'rgba(120,150,190,0.12)');
    poly(ctx, [P(0, 0), P(L.w, 0), P(L.w, 0, WH), P(0, 0, WH)], th.wall, 'rgba(120,150,190,0.12)');
    // windows with an outside view that changes with the HQ
    const win = (x0, x1) => {
      const a = P(x0, 0, WH - 16), b = P(x1, 0, WH - 16), c = P(x1, 0, 22), d = P(x0, 0, 22);
      ctx.save();
      poly(ctx, [a, b, c, d], skyFill(ctx, th.sky, a, c, t), 'rgba(25,230,255,0.25)');
      ctx.clip();
      drawSky(ctx, th.sky, a, b, c, d, t, sc);
      ctx.restore();
    };
    if (L.theme === 'home') win(1.2, 2.8);
    else if (L.theme === 'office') { win(3.2, 5.2); win(6.2, 8.4); }
    else if (L.sig === 'orbit') {
      // round portholes on the Earth + structural ribs
      for (let xc = 1.5; xc < L.w - 0.5; xc += 3) { if (sc.wall && xc + 1 > sc.wall.x0 && xc - 1 < sc.wall.x1) continue; porthole(ctx, P(xc, 0, 56), t, xc); }
      ctx.strokeStyle = 'rgba(0,255,213,0.16)'; ctx.lineWidth = 3;
      for (let x = 3; x < L.w; x += 3) { const a = P(x, 0, 0), b = P(x, 0, WH); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      for (let y = 3; y < L.h; y += 3) { const a = P(0, y, 0), b = P(0, y, WH); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.lineWidth = 1;
    } else { const n = Math.floor(L.w / 4); for (let i = 0; i < n; i++) { const x0 = 0.6 + i * 4; if (sc.wall && x0 + 3 > sc.wall.x0 && x0 < sc.wall.x1) continue; win(x0, Math.min(L.w - 0.4, x0 + 3)); } }
    if (L.sig === 'campus') {
      // scrolling stock ticker along the top of the back wall
      const a = P(0, 0, WH - 4), b = P(L.w, 0, WH - 4), c = P(L.w, 0, WH - 15), d = P(0, 0, WH - 15);
      poly(ctx, [a, b, c, d], '#05070b', 'rgba(255,211,107,0.5)');
      ctx.save(); poly(ctx, [a, b, c, d]); ctx.clip();
      ctx.translate(d.x, d.y); ctx.transform(1, 0.5, 0, 1, 0, 0);
      ctx.font = '700 8px "JetBrains Mono", monospace'; ctx.fillStyle = '#ffd36b';
      const txt = tickerText();
      const tw = ctx.measureText(txt).width + 40, len = L.w * TW / 2, off = (t * 28) % tw;
      for (let x = -off; x < len; x += tw) ctx.fillText(txt, x, -2);
      ctx.restore();
    }
    // left wall: logo / map
    const lg = P(0, 2.5, 60);
    ctx.save();
    ctx.translate(lg.x, lg.y);
    ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.font = '700 12px "Chakra Petch", sans-serif';
    ctx.fillStyle = th.trim;
    ctx.globalAlpha = 0.85;
    ctx.fillText('◢ ' + ((TE.state.profile.fundName || 'TRADING EMPIRE') + '').toUpperCase().slice(0, 22), 0, 0);
    ctx.restore();
    // trim lights
    ctx.strokeStyle = th.trim; ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 1.5); ctx.lineWidth = 2;
    ctx.beginPath(); const t1 = P(0, L.h, WH), t2 = P(0, 0, WH), t3 = P(L.w, 0, WH); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
    // bot screen wall
    if (sc.wall) drawBotWall(ctx, sc, t, st);
    if (L.map) drawMapWall(ctx, sc, t);
  }
  function skyFill(ctx, sky, a, c) {
    const g = ctx.createLinearGradient(0, a.y, 0, c.y);
    const cols = { night: ['#0b1430', '#1b1240'], street: ['#0c1a33', '#16233a'], city: ['#0a1630', '#172447'], high: ['#06102a', '#1b2c55'], aerial: ['#0d1f3d', '#2a3d63'], space: ['#000', '#04060f'], sun: ['#3b1a05', '#7a3b0a'] }[sky] || ['#0b1430', '#132040'];
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    return g;
  }
  function drawSky(ctx, sky, a, b, c, d, t, sc) {
    const minX = Math.min(a.x, d.x), maxX = Math.max(b.x, c.x);
    const top = Math.min(a.y, b.y), bot = Math.max(c.y, d.y);
    const rng = RNG(sc.lvl * 131 + Math.round(minX));
    if (sky === 'space' || sky === 'sun') {
      for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + rng() * 0.6) + ')'; ctx.fillRect(minX + rng() * (maxX - minX), top + rng() * (bot - top), 1.2, 1.2); }
      if (sky === 'space') { const ex = minX + (maxX - minX) * 0.6, ey = bot - 6; const g = ctx.createRadialGradient(ex, ey, 2, ex, ey, 40); g.addColorStop(0, '#3d8bff'); g.addColorStop(0.6, '#0a3a7a'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 40, 0, Math.PI * 2); ctx.fill(); }
      else { const ex = minX + (maxX - minX) * 0.5, ey = top + (bot - top) * 0.55; const g = ctx.createRadialGradient(ex, ey, 2, ex, ey, 60); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.3, '#ffb627'); g.addColorStop(1, 'rgba(255,120,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 60, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    const n = sky === 'night' ? 6 : sky === 'street' ? 8 : 14;
    const hMax = sky === 'high' || sky === 'aerial' ? 0.55 : 0.8;
    for (let i = 0; i < n; i++) {
      const bx = minX + (i / n) * (maxX - minX);
      const bw = (maxX - minX) / n * (0.6 + rng() * 0.5);
      const bh = (bot - top) * (0.25 + rng() * hMax);
      ctx.fillStyle = sky === 'aerial' ? 'rgba(20,30,50,0.9)' : 'rgba(8,12,22,0.95)';
      ctx.fillRect(bx, bot - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,211,107,0.55)';
      for (let k = 0; k < 6; k++) if (rng() < 0.5) ctx.fillRect(bx + 2 + rng() * (bw - 4), bot - bh + 3 + rng() * (bh - 6), 1.5, 1.5);
    }
  }
  function porthole(ctx, c, t, seed) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#273041'; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,255,213,0.55)'; ctx.stroke();
    ctx.clip();
    const rng = RNG(Math.round(seed * 100));
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + rng() * 0.6) + ')'; ctx.fillRect(-22 + rng() * 44, -22 + rng() * 44, 1.2, 1.2); }
    // the Earth's limb, slowly drifting past
    const ex = 8 + Math.sin(t * 0.05 + seed) * 6;
    const g = ctx.createRadialGradient(ex, 44, 12, ex, 44, 50);
    g.addColorStop(0, '#3d8bff'); g.addColorStop(0.72, '#0a3a7a'); g.addColorStop(0.86, 'rgba(0,255,213,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, 44, 50, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); ctx.lineWidth = 1;
  }
  let tkCache = { t: -1, s: '' };
  function tickerText() {
    const tn = Math.floor(now());
    if (tkCache.t === tn) return tkCache.s;
    const s = S();
    const parts = Object.keys(s.run.unlocked).slice(0, 12).map((id) => {
      const a = s.market.assets[id];
      if (!a || !a.c || !a.c.length) return '';
      const ref = a.c.length > 30 ? a.c[a.c.length - 30][3] : a.p;
      const ch = ref > 0 ? (a.p / ref - 1) * 100 : 0;
      return id + ' ' + U.fmt(a.p) + ' ' + (ch >= 0 ? '▲' : '▼') + Math.abs(ch).toFixed(1) + ' %';
    }).filter(Boolean);
    tkCache = { t: tn, s: parts.join('   ·   ') || 'TRADING EMPIRE' };
    return tkCache.s;
  }
  function drawBotWall(ctx, sc, t, st) {
    const w = sc.wall;
    const rows = st.fleets;
    const n = Math.max(1, Math.min(6, rows.length || 1));
    const span = (w.x1 - w.x0) / n;
    const crit = now() - FX.crit < 0.8;
    const brk = now() - FX.breaking < 4;
    for (let i = 0; i < n; i++) {
      const x0 = w.x0 + i * span + 0.1, x1 = w.x0 + (i + 1) * span - 0.1;
      const a = P(x0, 0, 82), b = P(x1, 0, 82), c = P(x1, 0, 40), d = P(x0, 0, 40);
      const f = rows[i];
      let col = f ? f.color : sc.th.glow;
      if (st.outage) col = '#30121a';
      poly(ctx, [a, b, c, d], '#03060b', 'rgba(25,230,255,0.4)');
      ctx.save(); poly(ctx, [a, b, c, d]); ctx.clip();
      // a tiny sparkline per fleet
      ctx.strokeStyle = col; ctx.globalAlpha = st.outage ? 0.25 : 0.9; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const px = a.x + (b.x - a.x) * k / 12, py = a.y + (b.y - a.y) * k / 12;
        const yy = py + 26 + Math.sin(t * 2 + k * 0.9 + i) * 6 - (f ? Math.min(14, f.share * 30) : 0) * k / 12;
        if (k) ctx.lineTo(px, yy); else ctx.moveTo(px, yy);
      }
      ctx.stroke();
      if (brk) { ctx.fillStyle = 'rgba(255,61,104,' + (0.25 + 0.15 * Math.sin(t * 12)) + ')'; ctx.fillRect(Math.min(a.x, d.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) + 4, 60); }
      if (crit && f && f.color === FX.critColor) { ctx.fillStyle = 'rgba(255,211,107,0.35)'; ctx.fillRect(Math.min(a.x, d.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) + 4, 60); }
      ctx.restore();
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
      if (f) {
        const lp = P(x0 + 0.1, 0, 46);
        ctx.save(); ctx.translate(lp.x, lp.y); ctx.transform(1, 0.5, 0, 1, 0, 0);
        ctx.font = '700 7px "JetBrains Mono", monospace'; ctx.fillStyle = col;
        ctx.fillText(brk ? 'BREAKING' : f.short, 0, 0); ctx.restore();
      }
    }
  }
  function drawMapWall(ctx, sc, t) {
    const L = sc.L;
    const y0 = Math.max(3, L.h - 7), y1 = y0 + 4;
    const a = P(0, y0, 80), b = P(0, y1, 80), c = P(0, y1, 36), d = P(0, y0, 36);
    poly(ctx, [a, b, c, d], '#020509', 'rgba(25,230,255,0.35)');
    ctx.save(); poly(ctx, [a, b, c, d]); ctx.clip();
    const offices = Object.keys(S().run.empire.offices || {}).length;
    const rng = RNG(77);
    for (let i = 0; i < 40; i++) {
      const u = rng(), v = rng();
      const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u + (d.y - a.y) * v;
      const lit = i < offices * 2;
      ctx.fillStyle = lit ? 'rgba(25,230,255,' + (0.6 + 0.4 * Math.sin(t * 3 + i)) + ')' : 'rgba(72,86,107,0.6)';
      ctx.fillRect(px, py, lit ? 2.5 : 1.5, lit ? 2.5 : 1.5);
    }
    ctx.restore();
  }

  function drawDesk(ctx, it, sc, t, st) {
    const th = sc.th;
    box(ctx, it.x, it.y, 0.84, 0.6, 0, 14, th.deskTop, shade(rgbHex(th.desk), 0.8), shade(rgbHex(th.desk), 1.05), 'rgba(0,0,0,0.25)');
    // monitors on the back edge
    const n = it.mon || 1;
    const glow = it.k === 'lab' ? '#a77bff' : it.k === 'eng' ? '#19f58c' : it.k === 'risk' ? '#ff3d68' : th.glow;
    for (let i = 0; i < n; i++) {
      const mx = it.x + 0.12 + i * (0.62 / n);
      let col = glow;
      if (st.outage) col = Math.sin(t * 9 + mx * 7) > 0.6 ? '#40101c' : '#12080c';
      else if (now() - FX.breaking < 4 && it.k === 'desk') col = Math.sin(t * 10 + i) > 0 ? '#ff3d68' : '#5a1020';
      else if (st.crisis) col = '#ff3d68';
      const a = P(mx, it.y + 0.08, 30), b = P(mx + 0.62 / n - 0.05, it.y + 0.08, 30), c = P(mx + 0.62 / n - 0.05, it.y + 0.08, 16), d = P(mx, it.y + 0.08, 16);
      poly(ctx, [a, b, c, d], '#05080d', '#0d1622');
      ctx.globalAlpha = st.outage ? 0.5 : 0.55 + 0.25 * Math.sin(t * 2.2 + mx * 3 + it.y);
      poly(ctx, [{ x: a.x + 1, y: a.y + 1 }, { x: b.x - 1, y: b.y + 1 }, { x: c.x - 1, y: c.y - 1 }, { x: d.x + 1, y: d.y - 1 }], col);
      ctx.globalAlpha = 1;
    }
  }
  function rgbHex(c) { return c; }
  function drawRack(ctx, r, sc, t, st, idx) {
    box(ctx, r.x, r.y, 0.7, 0.8, 0, 46, '#1b2433', '#0d131c', '#121a26', 'rgba(25,230,255,0.15)');
    // LEDs on the front-left face
    for (let k = 0; k < 6; k++) {
      const p = P(r.x + 0.15 + (k % 2) * 0.32, r.y + 0.8, 8 + Math.floor(k / 2) * 12);
      const on = Math.sin(t * (3 + (idx % 5)) + k * 1.7 + idx) > -0.2;
      let col = k % 3 === 0 ? '#19e6ff' : k % 3 === 1 ? '#19f58c' : '#ffb627';
      if (st.outage) col = Math.sin(t * 6 + k) > 0 ? '#ff3d68' : '#330910';
      if (now() - FX.crit < 0.6) col = FX.critColor;
      ctx.fillStyle = col; ctx.globalAlpha = on ? 0.95 : 0.2;
      ctx.fillRect(p.x - 2, p.y - 1, 5, 2);
    }
    ctx.globalAlpha = 1;
  }
  function drawProp(ctx, it, sc, t, st) {
    const th = sc.th;
    switch (it.t) {
      case 'desk': drawDesk(ctx, it, sc, t, st); break;
      case 'pdesk': {
        box(ctx, it.x, it.y, 0.9, 0.62, 0, 15, '#2e2414', '#5a4012', '#6e5018', 'rgba(255,211,107,0.4)');
        const mons = Math.min(3, 1 + sc.lvl);
        for (let i = 0; i < mons; i++) {
          const mx = it.x + 0.08 + i * (0.74 / mons);
          const a = P(mx, it.y + 0.08, 34), b = P(mx + 0.74 / mons - 0.04, it.y + 0.08, 34), c = P(mx + 0.74 / mons - 0.04, it.y + 0.08, 18), d = P(mx, it.y + 0.08, 18);
          poly(ctx, [a, b, c, d], '#05080d', '#3a2c10');
          const up = st.lastDir >= 0;
          ctx.globalAlpha = 0.75; poly(ctx, [{ x: a.x + 1, y: a.y + 1 }, { x: b.x - 1, y: b.y + 1 }, { x: c.x - 1, y: c.y - 1 }, { x: d.x + 1, y: d.y - 1 }], up ? '#19f58c' : '#ff3d68'); ctx.globalAlpha = 1;
        }
        break;
      }
      case 'table': box(ctx, it.x, it.y, it.w, it.d, 0, 13, '#2b2235', '#17121e', '#1e1828', 'rgba(255,122,200,0.3)'); break;
      case 'execdesk': box(ctx, it.x, it.y, 1.6, 0.7, 0, 15, '#2e2414', '#4a3612', '#5a4216', 'rgba(255,211,107,0.45)'); break;
      case 'sofa': box(ctx, it.x, it.y, it.w, 0.6, 0, 9, '#3a1e30', '#24121e', '#2c1726', 'rgba(255,122,200,0.25)'); break;
      case 'coffee': {
        box(ctx, it.x, it.y, 0.6, 0.5, 0, 26, '#2a2f38', '#14181e', '#1b2028', 'rgba(255,182,39,0.4)');
        const p = P(it.x + 0.3, it.y + 0.5, 18);
        ctx.fillStyle = st.coffee ? (Math.sin(t * 8) > 0 ? '#ff3d68' : '#40101c') : '#19f58c';
        ctx.fillRect(p.x - 2, p.y - 2, 4, 3);
        if (st.coffee) { // broken machine: smoke and an annoyed queue
          for (let k = 0; k < 4; k++) { const ph = (t * 0.7 + k * 0.25) % 1; const sp = P(it.x + 0.3, it.y + 0.25, 30 + ph * 40); ctx.globalAlpha = 0.5 * (1 - ph); ctx.fillStyle = '#7d8ca1'; ctx.beginPath(); ctx.arc(sp.x + Math.sin(t * 2 + k) * 4, sp.y, 4 + ph * 6, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
          const lp = P(it.x + 0.3, it.y + 0.25, 72);
          ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.fillStyle = '#ff3d68'; ctx.textAlign = 'center'; ctx.fillText('EN PANNE', lp.x, lp.y); ctx.textAlign = 'left';
        }
        break;
      }
      case 'cafetable': box(ctx, it.x, it.y, 0.7, 0.7, 0, 12, '#262c36', '#12161c', '#181d25', 'rgba(255,182,39,0.25)'); break;
      case 'bed': box(ctx, it.x, it.y, it.w, it.h, 0, 10, '#2b3550', '#151b2a', '#1a2133', 'rgba(61,139,255,0.3)'); box(ctx, it.x + 0.1, it.y + 0.1, 0.5, it.h - 0.2, 10, 5, '#d6e2f0', '#7d8ca1', '#9aa9bd'); break;
      case 'shelf': box(ctx, it.x, it.y, 0.5, 0.9, 0, 34, '#2a2f38', '#14181e', '#1b2028', 'rgba(120,150,190,0.2)'); break;
      case 'plant': {
        box(ctx, it.x + 0.3, it.y + 0.3, 0.4, 0.4, 0, 9, '#3a2a1c', '#22180f', '#2a1e13');
        const p = P(it.x + 0.5, it.y + 0.5, 22);
        ctx.fillStyle = '#19a85c'; ctx.beginPath(); ctx.arc(p.x, p.y, 8 + Math.sin(t + it.x) * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#19f58c'; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(p.x - 3, p.y - 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        break;
      }
      case 'globe': case 'holo': {
        box(ctx, it.x + 0.2, it.y + 0.2, 0.6, 0.6, 0, 10, '#1b2433', '#0d131c', '#121a26');
        const p = P(it.x + 0.5, it.y + 0.5, 34);
        ctx.strokeStyle = it.t === 'holo' ? '#00ffd5' : '#19e6ff'; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 14, 14, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 14 * Math.abs(Math.cos(t)), 14, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 14, 4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
        break;
      }
      case 'tree': {
        box(ctx, it.x + 0.25, it.y + 0.25, 0.5, 0.5, 0, 8, '#2a3a2a', '#152015', '#1b281b', 'rgba(25,245,140,0.25)');
        const tr = P(it.x + 0.5, it.y + 0.5, 8);
        ctx.fillStyle = '#4a3420'; ctx.fillRect(tr.x - 1.5, tr.y - 22, 3, 22);
        const p = P(it.x + 0.5, it.y + 0.5, 38);
        ctx.fillStyle = '#127a45'; ctx.beginPath(); ctx.arc(p.x, p.y, 14 + Math.sin(t * 0.8 + it.x) * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#19a85c'; ctx.beginPath(); ctx.arc(p.x - 4, p.y - 5, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#19f58c'; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(p.x - 6, p.y - 8, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        break;
      }
      case 'column': {
        box(ctx, it.x - 0.05, it.y - 0.05, 0.5, 0.5, 0, 6, '#2a3346', '#151b27', '#1a2231', 'rgba(255,211,107,0.35)');
        box(ctx, it.x, it.y, 0.4, 0.4, 6, 80, '#273041', '#1a2130', '#222b3c', 'rgba(255,211,107,0.12)');
        box(ctx, it.x - 0.06, it.y - 0.06, 0.52, 0.52, 86, 6, '#ffd36b', '#8a6a24', '#b08a34', 'rgba(255,211,107,0.6)');
        const g = P(it.x + 0.2, it.y + 0.4, 46);
        ctx.fillStyle = 'rgba(0,255,213,' + (0.35 + 0.25 * Math.sin(t * 1.4 + it.y)) + ')'; ctx.fillRect(g.x - 1, g.y - 30, 2, 60);
        break;
      }
      case 'core': {
        const p = P(it.x + 0.5, it.y + 0.5, 40);
        const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34);
        g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, '#ffd36b'); g.addColorStop(1, 'rgba(255,140,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 34 + Math.sin(t * 2) * 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffb627'; ctx.globalAlpha = 0.6;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(p.x, p.y, 30 + k * 6, 9 + k * 2, t * 0.3 + k, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
        break;
      }
      default: break;
    }
  }
  /** A small isometric person. state: '', 'cheer', 'slump', 'panic', 'away'. */
  function drawPerson(ctx, p, t, state, scale) {
    const s = scale || 1;
    const base = P(p.x, p.y, 0);
    let bob = Math.sin(t * 3 + p.ph) * 0.8;
    let lift = 0, tilt = 0;
    if (state === 'cheer') { lift = Math.abs(Math.sin(t * 9 + p.ph)) * 7; }
    if (state === 'panic') { tilt = Math.sin(t * 20 + p.ph) * 1.6; }
    if (state === 'slump') { bob = 2.5; }
    const x = base.x + tilt, y = base.y - lift;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(base.x, base.y + 1, 7 * s, 3.2 * s, 0, 0, Math.PI * 2); ctx.fill();
    // body
    const bw = 10 * s, bh = 13 * s;
    ctx.fillStyle = state === 'away' ? '#2a3140' : p.c;
    ctx.globalAlpha = state === 'away' ? 0.5 : 1;
    roundRect(ctx, x - bw / 2, y - bh - 3 * s + bob, bw, bh, 3 * s);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(ctx, x - bw / 2, y - bh / 2 - 3 * s + bob, bw, bh / 2, 3 * s); ctx.fill();
    // head
    ctx.fillStyle = state === 'panic' ? '#ffb3c0' : '#e9d3c0';
    ctx.beginPath(); ctx.arc(x, y - bh - 7 * s + bob, 4.4 * s, 0, Math.PI * 2); ctx.fill();
    if (state === 'cheer') { ctx.strokeStyle = p.c; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x - 4 * s, y - bh - 2 * s); ctx.lineTo(x - 8 * s, y - bh - 10 * s); ctx.moveTo(x + 4 * s, y - bh - 2 * s); ctx.lineTo(x + 8 * s, y - bh - 10 * s); ctx.stroke(); ctx.lineWidth = 1; }
    ctx.globalAlpha = 1;
  }
  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + hh - r); ctx.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function drawLegend(ctx, p, t) {
    const base = P(p.x, p.y, 0);
    // golden aura
    const g = ctx.createRadialGradient(base.x, base.y - 14, 2, base.x, base.y - 14, 22);
    g.addColorStop(0, 'rgba(255,211,107,0.35)'); g.addColorStop(1, 'rgba(255,211,107,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(base.x, base.y - 14, 22, 0, Math.PI * 2); ctx.fill();
    drawPerson(ctx, p, t, p.away ? 'away' : '', 1.15);
    ctx.font = '700 7.5px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = p.away ? '#7d8ca1' : '#05070b';
    ctx.beginPath(); ctx.arc(base.x, base.y - 13, 0.01, 0, 1);
    ctx.fillText(p.initials, base.x, base.y - 10);
    ctx.fillStyle = '#ffd36b'; ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.fillText((p.away ? '✖ ' : '★ ') + p.legend.name.split(' ')[0].replace(/[«»"]/g, ''), base.x, base.y - 36);
    ctx.textAlign = 'left';
  }

  /* ---------------- frame ---------------- */
  O.cam = { zoom: 1, panX: 0, panY: 0 };
  function sceneBounds(sc) {
    const L = sc.L;
    const pts = [P(0, 0, 96), P(L.w, 0, 96), P(0, L.h, 96), P(L.w, L.h), P(0, L.h), P(L.w, 0)];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    return { x0, x1, y0, y1 };
  }
  /** Draw a full scene into ctx (W×H css px). opts: {lvl, thumb, t} */
  O.render = function (ctx, W, H, opts) {
    const s = S();
    opts = opts || {};
    const lvl = opts.lvl !== undefined ? opts.lvl : s.run.office;
    const sc = O.scene(lvl);
    const t = opts.t !== undefined ? opts.t : now();
    const thumb = !!opts.thumb;
    const st = thumb ? { fleets: [], outage: false, crisis: false, coffee: false, lastDir: 1 } : worldState();
    const b = sceneBounds(sc);
    const pad = thumb ? 6 : 26;
    const fit = Math.min((W - pad * 2) / (b.x1 - b.x0), (H - pad * 2 - (thumb ? 0 : 30)) / (b.y1 - b.y0));
    const zoom = thumb ? fit : fit * O.cam.zoom;
    const ox = W / 2 - ((b.x0 + b.x1) / 2) * zoom + (thumb ? 0 : O.cam.panX);
    const oy = H / 2 - ((b.y0 + b.y1) / 2) * zoom + (thumb ? 0 : O.cam.panY + 10);
    const dpr = opts.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy);
    O._view = { zoom, ox, oy, sc };
    drawFloor(ctx, sc, t);
    drawWalls(ctx, sc, t, st);
    // drawables sorted by depth
    const pop = thumb ? (opts.pop || samplePop(sc, opts.fill || 0.6)) : populate(sc);
    const list = [];
    sc.items.forEach((it) => list.push({ d: (it.x + (it.w || 0.8) / 2) + (it.y + (it.d || it.h || 0.6) / 2), f: () => drawProp(ctx, it, sc, t, st) }));
    const nr = thumb ? Math.round(sc.racks.length * (opts.fill || 0.6)) : rackCount(sc);
    sc.racks.slice(0, nr).forEach((r, i) => list.push({ d: r.x + r.y + 0.8, f: () => drawRack(ctx, r, sc, t, st, i) }));
    const tNow = now();
    pop.people.forEach((p) => {
      let state = '';
      if (!thumb) {
        if (st.crisis) state = 'panic';
        if (tNow - FX.liq < 2.5) state = 'panic';
        if (tNow - FX.slump < 2) state = 'slump';
        if (tNow - FX.cheer < 1.8 && (p.z === 'desk' || p.r === 'legend')) state = 'cheer';
      }
      let px = p.x, py = p.y;
      if (p.walker && sc.cafe && !thumb) {
        const cyc = (t * 0.05 + p.ph / 6.28) % 1;
        const k = cyc < 0.4 ? 0 : cyc < 0.5 ? (cyc - 0.4) / 0.1 : cyc < 0.85 ? 1 : 1 - (cyc - 0.85) / 0.15;
        px = p.x + (sc.cafe.x + 0.6 - p.x) * k; py = p.y + (sc.cafe.y + 0.9 - p.y) * k;
      }
      const q = Object.assign({}, p, { x: px, y: py });
      list.push({ d: px + py + 0.05, f: () => (p.r === 'legend' ? drawLegend(ctx, q, t) : drawPerson(ctx, q, t, state)) });
    });
    // the player at their own desk
    list.push({ d: sc.player.x + sc.player.y + 0.05, f: () => drawPerson(ctx, { x: sc.player.x, y: sc.player.y, c: '#ffd36b', ph: 0 }, t, thumb ? '' : tNow - FX.cheer < 1.8 ? 'cheer' : tNow - FX.slump < 2 ? 'slump' : tNow - FX.liq < 2.5 ? 'panic' : '') });
    // VIP in the boardroom
    if (!thumb && st.vip && sc.board) list.push({ d: sc.board.x + sc.board.y + 0.2, f: () => { const q = { x: sc.board.x, y: sc.board.y + 0.4, c: '#ffd36b', ph: 1 }; drawPerson(ctx, q, t, '', 1.1); const p = P(q.x, q.y, 0); ctx.font = '700 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd36b'; ctx.fillText('♛ VIP', p.x, p.y - 38); ctx.textAlign = 'left'; } });
    list.sort((a, b2) => a.d - b2.d);
    list.forEach((x) => x.f());
    if (!thumb) {
      drawLabels(ctx, sc, pop, t);
      drawOverlays(ctx, sc, t, st, W, H, zoom, ox, oy, dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
  function drawLabels(ctx, sc, pop, t) {
    pop.labels.forEach((lb) => {
      const z = lb.zone;
      const p = P(z.x + z.w / 2, z.y + z.h / 2, 58);
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const txt = '×' + U.int(lb.total) + (lb.ratio > 1 ? '  (1 = ' + lb.ratio + ')' : '');
      const w = ctx.measureText(txt).width + 12;
      ctx.fillStyle = 'rgba(6,9,14,0.82)'; roundRect(ctx, p.x - w / 2, p.y - 11, w, 16, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(25,230,255,0.45)'; ctx.stroke();
      ctx.fillStyle = '#d6e2f0'; ctx.fillText(txt, p.x, p.y + 1);
      ctx.textAlign = 'left';
    });
    // floating money above the player's desk
    const tn = now();
    FX.money = FX.money.filter((m) => tn - m.t < 2);
    FX.money.forEach((m, i) => {
      const age = tn - m.t;
      const p = P(sc.player.x, sc.player.y, 50 + age * 30 + i * 8);
      ctx.globalAlpha = 1 - age / 2; ctx.font = '700 12px "JetBrains Mono", monospace'; ctx.fillStyle = '#19f58c'; ctx.textAlign = 'center';
      ctx.fillText(U.smoney(m.v), p.x, p.y); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    });
    // confetti
    FX.confetti = FX.confetti.filter((c) => tn - c.t < 1.6);
    FX.confetti.forEach((c) => {
      const age = tn - c.t;
      const p0 = P(sc.player.x, sc.player.y, 40);
      ctx.fillStyle = c.c; ctx.globalAlpha = 1 - age / 1.6;
      ctx.fillRect(p0.x + c.vx * age * 30, p0.y + c.vy * age * 30 + 40 * age * age, 3, 3);
    });
    ctx.globalAlpha = 1;
    // legendary arrival: spotlight on the newcomer
    if (FX.legend && tn - FX.legend.t < 4) {
      const pl = pop.people.find((p) => p.id === FX.legend.id);
      if (pl) {
        const p = P(pl.x, pl.y, 0);
        const k = 1 - (tn - FX.legend.t) / 4;
        const g = ctx.createRadialGradient(p.x, p.y - 60, 4, p.x, p.y, 70);
        g.addColorStop(0, 'rgba(255,211,107,' + 0.5 * k + ')'); g.addColorStop(1, 'rgba(255,211,107,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 140); ctx.lineTo(p.x + 8, p.y - 140); ctx.lineTo(p.x + 40, p.y + 8); ctx.lineTo(p.x - 40, p.y + 8); ctx.closePath(); ctx.fill();
      }
    }
  }
  function drawOverlays(ctx, sc, t, st, W, H, zoom, ox, oy, dpr) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (st.crisis) {
      ctx.fillStyle = 'rgba(255,61,104,' + (0.06 + 0.05 * Math.sin(t * 3)) + ')';
      ctx.fillRect(0, 0, W, H);
      // rotating alarm beams
      for (let k = 0; k < 2; k++) {
        const ang = t * 2 + k * Math.PI;
        const cx = k ? W * 0.85 : W * 0.15, cy = 30;
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 160);
        g.addColorStop(0, 'rgba(255,61,104,0.35)'); g.addColorStop(1, 'rgba(255,61,104,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 160, ang, ang + 0.5); ctx.closePath(); ctx.fill();
      }
    }
    const tn = now();
    if (tn - FX.liq < 1.5) { ctx.fillStyle = 'rgba(255,61,104,' + 0.35 * (1 - (tn - FX.liq) / 1.5) + ')'; ctx.fillRect(0, 0, W, H); }
    if (tn - FX.upgrade < 2.2) {
      const k = (tn - FX.upgrade) / 2.2;
      ctx.fillStyle = 'rgba(25,230,255,' + 0.35 * (1 - k) + ')'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(25,230,255,' + (1 - k) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, H * k); ctx.lineTo(W, H * k); ctx.stroke(); ctx.lineWidth = 1;
    }
  }
  function rackCount(sc) {
    let u = 0;
    D.INFRA.forEach((x, i) => { u += TE.Firm.infraCount(x.id) * (i < 2 ? 0.25 : i < 4 ? 0.6 : 1 + i * 0.35); });
    return Math.min(sc.racks.length, Math.ceil(u / 2));
  }
  O.rackTotal = function () { let u = 0; D.INFRA.forEach((x, i) => { u += TE.Firm.infraCount(x.id) * (i < 2 ? 0.25 : i < 4 ? 0.6 : 1 + i * 0.35); }); return Math.ceil(u / 2); };
  function samplePop(sc, fill) {
    const people = [];
    const roles = { desk: ['junior', 'senior'], lab: ['quant', 'airesearcher'], eng: ['engineer'], risk: ['riskmgr'], board: ['ir', 'pm'], exec: ['cio'], cafe: ['intern'] };
    Object.keys(sc.seats).forEach((z) => {
      const seats = sc.seats[z];
      const n = Math.round(seats.length * fill);
      for (let i = 0; i < n; i++) { const r = roles[z] ? roles[z][i % roles[z].length] : 'junior'; people.push({ r, c: ROLES[r].c, x: seats[i].x, y: seats[i].y, ph: i }); }
    });
    return { people, labels: [] };
  }
  function worldState() {
    const s = S();
    const ev = s.run.events.active.filter((i) => i.started);
    const has = (id) => ev.some((i) => i.id === id);
    const outage = ev.some((i) => D.EVENT_MAP[i.id] && D.EVENT_MAP[i.id].fx.outage);
    const fleets = TE.Economy.breakdown().filter((x) => x.v > 0 && D.BOT_MAP[x.id]).sort((a, b) => b.v - a.v).slice(0, 6);
    const tot = fleets.reduce((a, x) => a + x.v, 0) || 1;
    const lastTrade = s.run.account.history[0];
    return {
      outage, coffee: has('coffee'), crisis: !!(s.run.events.crisis && s.run.events.crisis.active),
      vip: !!(s.run.fund && s.run.fund.vip && (s.run.fund.vip.active || s.run.fund.vip.offer)),
      fleets: fleets.map((f) => ({ color: f.color, share: f.v / tot, short: (D.BOT_MAP[f.id].name || '').toUpperCase().slice(0, 9) })),
      lastDir: lastTrade ? lastTrade.total : 1,
    };
  }
  const sceneCache = {};
  O.scene = function (lvl) { return sceneCache[lvl] || (sceneCache[lvl] = buildScene(lvl)); };

  /* ---------------- picking: screen → tile → zone ---------------- */
  O.pick = function (mx, my) {
    const v = O._view;
    if (!v) return null;
    const wx = (mx - v.ox) / v.zoom, wy = (my - v.oy) / v.zoom;
    // inverse projection on the floor (z = 0)
    const gx = (wy / (TH / 2) + wx / (TW / 2)) / 2;
    const gy = (wy / (TH / 2) - wx / (TW / 2)) / 2;
    const sc = v.sc;
    let best = null;
    sc.zones.forEach((z) => { if (gx >= z.x && gx <= z.x + z.w && gy >= z.y && gy <= z.y + z.h) { if (!best || z.k === 'player') best = z; } });
    if (!best && sc.wall && gy < 0.8 && gx >= sc.wall.x0 && gx <= sc.wall.x1) best = { k: 'wall', label: ZONE_NAME.wall, nav: 'bots', x: sc.wall.x0, y: 0, w: sc.wall.x1 - sc.wall.x0, h: 0.6 };
    return best ? { zone: best, gx, gy } : null;
  };

  /* ---------------- prestige: the headquarters dissolves ---------------- */
  O.dissolve = function (color, done) {
    if (!UI.anim()) { done(); return; }
    const cv = h('canvas', { class: 'of-dissolve' });
    document.body.appendChild(cv);
    const W = window.innerWidth, H = window.innerHeight, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    O.render(off.getContext('2d'), W, H, { t: now() });
    const cols = 48, rows = Math.ceil(48 * H / W);
    const cw = W / cols, ch = H / rows;
    const bits = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) bits.push({ i, j, d: Math.random() * 0.6 + (j / rows) * 0.5, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 3 });
    const t0 = performance.now();
    // the prestige itself must never wait for an animation frame (hidden tab = no frames)
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
      setTimeout(() => { cv.style.transition = 'opacity 0.6s'; cv.style.opacity = '0'; setTimeout(() => cv.remove(), 650); }, 60);
    };
    setTimeout(finish, 2600);
    const step = () => {
      if (finished) return;
      const k = (performance.now() - t0) / 1700;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(2,3,6,' + Math.min(0.9, k * 1.3) + ')'; ctx.fillRect(0, 0, W, H);
      bits.forEach((b) => {
        const kk = Math.max(0, (k - b.d) / 0.6);
        if (kk >= 1) return;
        ctx.globalAlpha = 1 - kk;
        const x = b.i * cw + b.vx * kk * 80, y = b.j * ch + b.vy * kk * 120;
        if (kk <= 0) ctx.drawImage(off, b.i * cw, b.j * ch, cw, ch, x, y, cw + 0.5, ch + 0.5);
        else { ctx.fillStyle = color; ctx.fillRect(x + cw * 0.3, y + ch * 0.3, cw * 0.4 * (1 - kk), ch * 0.4 * (1 - kk)); }
      });
      ctx.globalAlpha = 1;
      if (k < 1.25) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
  };
})(window.TE);
