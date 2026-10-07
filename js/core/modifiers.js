/* Modifier engine.
 * Every bonus in the game (upgrades, research, staff, prestige, events...) is an effect on a named stat.
 * Within a category, additive bonuses sum; categories multiply together. This gives readable tooltips:
 *   Bot Speed ×3.42 = Upgrades +25% · Research ×1.80 · Infrastructure +40% · Alpha +22%
 */
(function (TE) {
  'use strict';
  const U = TE.U;

  const DEFS = {};
  const def = (stat, o) => { DEFS[stat] = Object.assign({ type: 'mult', base: o && o.type === 'flat' ? 0 : 1 }, o); };

  def('income.global', { label: 'Tous les revenus' });
  def('manual.profit', { label: 'Profit des trades manuels' });
  def('manual.fee', { label: 'Frais manuels', inverse: true, min: 0.02 });
  def('manual.access', { label: 'Accès à la profondeur de marché' });
  def('manual.desk', { label: 'Taille du desk (s de revenu)', type: 'flat', unit: 's' });
  def('manual.payout', { label: 'Bonus max par trade (s de revenu)', type: 'flat', base: 20, unit: 's' });
  def('manual.crit', { label: 'Chance de critique manuel', type: 'flat', base: 0.02, pct: true, max: 0.3 });
  def('manual.mmr', { label: 'Marge de maintenance', inverse: true, min: 0.05 });
  def('manual.slots', { label: 'Emplacements de position', type: 'flat', base: 1 });
  def('spread', { label: 'Spreads', inverse: true, min: 0.05 });
  def('crit.mult', { label: 'Puissance des critiques', max: 4 });
  def('combo.power', { label: 'Puissance des séries' });
  def('bot.all.capital', { label: 'Capital des bots' });
  def('bot.all.speed', { label: 'Vitesse des bots' });
  def('bot.all.winrate', { label: 'Taux de réussite des bots', type: 'flat', pct: true });
  def('bot.all.win', { label: 'Gain moyen des bots' });
  def('bot.all.loss', { label: 'Perte moyenne des bots', inverse: true, min: 0.1 });
  def('bot.all.fee', { label: 'Frais des bots', inverse: true, min: 0.02 });
  def('bot.all.crit', { label: 'Chance de critique des bots', type: 'flat', base: 0.005, pct: true, max: 0.15 });
  def('bot.all.profit', { label: 'Profit des bots' });
  def('bot.scanner', { label: 'Routage par régime', type: 'flat' });
  def('bot.adapt', { label: 'Adaptation au régime', type: 'flat', pct: true, max: 1 });
  def('bot.tail', { label: 'Risque extrême', inverse: true, min: 0.05 });
  def('bot.cost', { label: 'Coût des bots', inverse: true, min: 0.05 });
  def('staff.desk', { label: 'Profit du desk humain' });
  def('staff.power', { label: 'Efficacité du personnel' });
  def('staff.cost', { label: 'Coût du personnel', inverse: true, min: 0.05 });
  def('staff.cap', { label: 'Capacité de personnel en plus', type: 'flat' });
  def('research.rate', { label: 'Vitesse de recherche' });
  def('infra.power', { label: 'Puissance de l’infrastructure' });
  def('latency', { label: 'Latence', inverse: true, min: 1e-9 });
  def('fund.capacity', { label: 'Capacité du fonds' });
  def('fund.perf', { label: 'Commission de performance', type: 'flat', base: 0.2, pct: true, max: 0.9 });
  def('fund.mgmt', { label: 'Frais de gestion', type: 'flat', base: 0.02, pct: true, max: 0.2 });
  def('fund.inflow', { label: 'Souscriptions des investisseurs' });
  def('fund.withdraw', { label: 'Retraits des investisseurs', inverse: true, min: 0.02 });
  def('rep.gain', { label: 'Gain de réputation' });
  def('rep.loss', { label: 'Perte de réputation', inverse: true, min: 0.05 });
  def('offline.eff', { label: 'Efficacité hors ligne', type: 'flat', base: 0.5, pct: true, max: 2 });
  def('offline.cap', { label: 'Plafond hors ligne', type: 'flat', base: 7200, unit: 's' });
  def('opp.freq', { label: 'Fréquence des opportunités' });
  def('opp.reward', { label: 'Récompenses des opportunités' });
  def('event.neg', { label: 'Sévérité des événements négatifs', inverse: true, min: 0.05 });
  def('event.outage', { label: 'Sévérité des pannes', inverse: true, min: 0.05 });
  def('contract.reward', { label: 'Récompenses de contrats' });
  def('div.all', { label: 'Revenus des divisions' });
  def('influence', { label: 'Influence de marché' });
  def('news.lead', { label: 'Avance sur les news', type: 'flat', unit: 's' });
  def('vc.luck', { label: 'Chance en capital-risque', type: 'flat' });
  def('crisis.gain', { label: 'Bonus de revenus en crise', type: 'flat', pct: true });
  def('macro.bull', { label: 'Biais bull market', type: 'flat' });
  def('alpha.capacity', { label: 'Capacité de marché' });
  // V2 — living world
  def('reg.gain', { label: 'Pression réglementaire subie', inverse: true, min: 0.1 });
  def('att.gain', { label: 'Visibilité médiatique' });

  /* Modifier categories are internal keys (the saturation ceiling selects some of them by name);
   * this table only translates them for tooltips. */
  const CAT_LABEL = {
    Upgrades: 'Améliorations', Research: 'Recherche', Infrastructure: 'Infrastructure', Staff: 'Personnel', Headquarters: 'Siège',
    Legends: 'Légendes', Achievements: 'Succès', 'Alpha (α)': 'Alpha (α)', 'Legacy (Λ)': 'Legacy (Λ)', 'Singularity (✦)': 'Singularité (✦)',
    'Alpha Perks': 'Avantages Alpha', 'Legacy Perks': 'Avantages Legacy', 'Singularity Perks': 'Avantages Singularité', Challenges: 'Défis',
    'Hot Streak': 'Série gagnante', 'Crisis Rewards': 'Récompenses de crise', Acquisitions: 'Acquisitions', 'Global Offices': 'Bureaux mondiaux',
    Divisions: 'Divisions',
  };
  Object.defineProperty(TE, 'CAT_LABEL', { value: CAT_LABEL });
  const BOT_STATS = { capital: 'Capital', speed: 'Vitesse', winrate: 'Taux de réussite', win: 'Gain moyen', loss: 'Perte moyenne', profit: 'Profit', crit: 'Chance de critique' };
  function defineBot(id, name) {
    Object.keys(BOT_STATS).forEach((k) => {
      const key = 'bot.' + id + '.' + k;
      if (DEFS[key]) return;
      const label = BOT_STATS[k] + ' (' + name + ')';
      if (k === 'winrate' || k === 'crit') def(key, { label, type: 'flat', pct: true });
      else if (k === 'loss') def(key, { label, inverse: true, min: 0.1 });
      else def(key, { label });
    });
  }

  const Mods = (TE.Mods = {
    DEFS,
    providers: [],
    perm: {},
    flags: {},
    temp: {},
    tempList: [],
    dirty: true,

    init() {
      TE.Data.BOTS.forEach((b) => defineBot(b.id, b.name));
      defineBot('desk', 'Desk humain');
      TE.Data.DIVISIONS.forEach((d) => { if (!DEFS['div.' + d.id]) def('div.' + d.id, { label: 'Revenus (' + d.name + ')' }); });
    },
    def(stat) { return DEFS[stat] || (DEFS[stat] = { type: 'mult', base: 1, label: stat }); },
    /** fn(ctx) — phase 0 providers run first; phase 1 providers may ctx.peek() phase-0 results. */
    addProvider(fn, phase) { this.providers.push({ fn, phase: phase || 0 }); },

    rebuild() {
      const perm = {};
      const flags = {};
      const self = this;
      const ctx = {
        eff(cat, src, e, count) {
          if (!e) return;
          const n = count === undefined ? 1 : count;
          if (e.flag) { flags[e.flag] = e.v !== undefined ? e.v : true; return; }
          if (!e.stat || n === 0) return;
          const entry = perm[e.stat] || (perm[e.stat] = { cats: {} });
          const c = entry.cats[cat] || (entry.cats[cat] = { add: 0, mult: 1, items: [] });
          let txt;
          if (e.add !== undefined) { c.add += e.add * n; txt = self.fmtAdd(e.stat, e.add * n); }
          if (e.mult !== undefined) { c.mult *= Math.pow(e.mult, n); txt = U.mult(Math.pow(e.mult, n)); }
          c.items.push({ src: src + (n !== 1 ? ' ×' + U.fmt(n, { int: true }) : ''), txt });
        },
        flag(name, v) { flags[name] = v === undefined ? true : v; },
        peek(stat) { return compute(self.def(stat), perm[stat], null); },
      };
      this.providers.filter((p) => p.phase === 0).forEach((p) => { try { p.fn(ctx); } catch (err) { console.error('[Mods] provider', err); } });
      this.providers.filter((p) => p.phase !== 0).forEach((p) => { try { p.fn(ctx); } catch (err) { console.error('[Mods] provider', err); } });
      Object.keys(perm).forEach((k) => { perm[k].value = compute(this.def(k), perm[k], null); });
      this.perm = perm;
      this.flags = flags;
      this.dirty = false;
      TE.Bus.emit('mods:rebuilt');
    },

    /** Temporary effects: [{stat, add?, mult?, label}] rebuilt every tick by Events/Abilities. */
    setTemps(list) {
      const t = {};
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.stat) continue;
        const o = t[e.stat] || (t[e.stat] = { add: 0, mult: 1, items: [] });
        if (e.add !== undefined) o.add += e.add;
        if (e.mult !== undefined) o.mult *= e.mult;
        o.items.push(e);
      }
      this.temp = t;
      this.tempList = list;
    },

    get(stat) {
      const d = DEFS[stat] || this.def(stat);
      const p = this.perm[stat];
      let v = p ? p.value : d.base;
      const t = this.temp[stat];
      if (t) {
        if (d.type === 'flat') v = (v + t.add) * t.mult;
        else v = v * Math.max(0.01, 1 + t.add) * t.mult;
        if (d.min !== undefined && v < d.min) v = d.min;
        if (d.max !== undefined && v > d.max) v = d.max;
      }
      return v;
    },
    /** Multiplier contributed by a subset of categories only (e.g. prestige layers). */
    catFactor(stat, cats) {
      const p = this.perm[stat];
      if (!p) return 1;
      let add = 0, mult = 1;
      cats.forEach((c) => { const x = p.cats[c]; if (x) { add += x.add; mult *= x.mult; } });
      return Math.max(1e-9, 1 + add) * mult;
    },
    /** V2 "what if": evaluate fn() as if extra effects were owned (list of {cat, e, n}); nothing is kept.
     *  Only the touched stats are recomputed, so it stays cheap enough for UI previews. */
    whatIf(list, fn) {
      const saved = {};
      const touched = [];
      list.forEach((x) => {
        const e = x && x.e;
        if (!e || !e.stat) return;
        const k = e.stat;
        if (!(k in saved)) {
          saved[k] = this.perm[k];
          const src = this.perm[k];
          const entry = { cats: {} };
          if (src) Object.keys(src.cats).forEach((c) => { entry.cats[c] = { add: src.cats[c].add, mult: src.cats[c].mult, items: src.cats[c].items }; });
          this.perm[k] = entry;
          touched.push(k);
        }
        const n = x.n === undefined ? 1 : x.n;
        const c = this.perm[k].cats[x.cat] || (this.perm[k].cats[x.cat] = { add: 0, mult: 1, items: [] });
        if (e.add !== undefined) c.add += e.add * n;
        if (e.mult !== undefined) c.mult *= Math.pow(e.mult, n);
      });
      touched.forEach((k) => { this.perm[k].value = compute(this.def(k), this.perm[k]); });
      let out;
      try { out = fn(); } finally {
        touched.forEach((k) => { if (saved[k] === undefined) delete this.perm[k]; else this.perm[k] = saved[k]; });
      }
      return out;
    },
    /** Per-category contributions of a stat: [{key, label, add, mult}]. */
    catsOf(stat) {
      const p = this.perm[stat];
      if (!p) return [];
      return Object.keys(p.cats).map((k) => ({ key: k, label: CAT_LABEL[k] || k, add: p.cats[k].add, mult: p.cats[k].mult, items: p.cats[k].items }));
    },
    has(flag) { return !!this.flags[flag]; },
    flag(flag) { return this.flags[flag]; },

    fmtAdd(stat, a) {
      const d = this.def(stat);
      if (d.type === 'flat') {
        if (d.pct) return (a >= 0 ? '+' : '') + (a * 100).toFixed(Math.abs(a) < 0.01 ? 2 : 1).replace('.', ',') + U.NB + '%';
        if (d.unit === 's') return (a >= 0 ? '+' : '') + U.fmt(a, { dec: 0 }) + U.NB + 's';
        return (a >= 0 ? '+' : '') + U.fmt(a, { dec: 2 });
      }
      return (a >= 0 ? '+' : '') + U.fmt(a * 100, { dec: 0 }) + U.NB + '%';
    },
    fmtValue(stat, v) {
      const d = this.def(stat);
      if (v === undefined) v = this.get(stat);
      if (d.type === 'flat') {
        if (d.pct) return (v * 100).toFixed(v < 0.1 ? 2 : 1).replace('.', ',') + U.NB + '%';
        if (d.unit === 's') return U.fmt(v, { dec: 0 }) + U.NB + 's';
        return U.fmt(v, { dec: 2 });
      }
      return U.mult(v);
    },
    /** Human description of a raw effect. */
    describe(e) {
      if (!e) return '';
      if (e.flag) return '';
      const d = this.def(e.stat);
      if (e.mult !== undefined) {
        if (d.inverse && e.mult < 1) return d.label + ' -' + Math.round((1 - e.mult) * 100) + U.NB + '%';
        return d.label + ' ' + U.mult(e.mult);
      }
      if (e.add !== undefined) return d.label + ' ' + this.fmtAdd(e.stat, e.add);
      return '';
    },
    /** Breakdown for tooltips. */
    breakdown(stat) {
      const d = this.def(stat);
      const p = this.perm[stat];
      const rows = [];
      if (p) {
        Object.keys(p.cats).forEach((cat) => {
          const c = p.cats[cat];
          let txt;
          if (d.type === 'flat') {
            txt = this.fmtAdd(stat, c.add);
            if (c.mult !== 1) txt += (c.add ? ' · ' : '') + U.mult(c.mult);
          } else {
            txt = '';
            if (c.add) txt = this.fmtAdd(stat, c.add);
            if (c.mult !== 1) txt += (txt ? ' · ' : '') + U.mult(c.mult);
            if (!txt) txt = '+0' + U.NB + '%';
          }
          rows.push({ cat: CAT_LABEL[cat] || cat, txt, items: c.items });
        });
      }
      const t = this.temp[stat];
      if (t) {
        let txt = '';
        if (t.add) txt += this.fmtAdd(stat, t.add);
        if (t.mult !== 1) txt += (txt ? ' · ' : '') + U.mult(t.mult);
        rows.push({ cat: 'Effets actifs', txt, items: t.items.map((e) => ({ src: e.label || 'Effet', txt: e.mult !== undefined ? U.mult(e.mult) : this.fmtAdd(stat, e.add) })), temp: true });
      }
      return { label: d.label, base: d.base, type: d.type, value: this.get(stat), rows };
    },
  });

  function compute(d, entry) {
    let v;
    if (d.type === 'flat') {
      v = d.base;
      let m = 1;
      if (entry) Object.keys(entry.cats).forEach((k) => { v += entry.cats[k].add; m *= entry.cats[k].mult; });
      v *= m;
    } else {
      // percentage bonuses add up across all sources; explicit ×N effects multiply
      let add = 0, mult = 1;
      if (entry) Object.keys(entry.cats).forEach((k) => { const c = entry.cats[k]; add += c.add; mult *= c.mult; });
      v = d.base * Math.max(0.01, 1 + add) * mult;
    }
    if (d.min !== undefined && v < d.min) v = d.min;
    if (d.max !== undefined && v > d.max) v = d.max;
    if (!isFinite(v)) v = v > 0 ? U.CAP : d.base;
    return v;
  }
})(window.TE);
