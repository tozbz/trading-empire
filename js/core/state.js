/* Game state factories + stat helpers.
 * state = { v, settings, profile (persistent across prestige), run (reset on Liquidation), market (world, persistent) }
 */
(function (TE) {
  'use strict';
  const S = (TE.State = {});

  S.defaultSettings = () => ({
    sound: true, volume: 0.55, animations: true, uiHz: 10, notation: 'standard', confirmations: true, autosave: 30,
    theme: 'cyber', botMarkers: true, newsMarkers: true, tutorial: true, scanlines: true, turbo: 1, autoBuy: { bots: true, upgrades: true, research: true, firm: true },
  });

  S.createProfile = () => ({
    created: Date.now(),
    playtime: 0,
    features: { market: true, settings: true },
    featuresSeen: { market: true, settings: true },
    uiVisited: {},
    achievements: {},
    stats: {},
    records: {},
    tutorial: {},
    milestonesSeen: {},
    lastDaily: null,
    daily: { best: {}, streak: 0, lastDay: null, claimed: {} },
    prestige: {
      p1: 0, p2: 0, p3: 0,
      alpha: 0, alphaTotal: 0, earnBank: 0,       // α (unspent / earned since last Legacy) and earnings banked since last Legacy
      perks: {},
      legacy: 0, legacyTotal: 0, alphaBank: 0,    // Λ and α banked since last Singularity
      lperks: {},
      cores: 0, coresTotal: 0, sperks: {},
      challenges: {}, nextChallenge: null,
    },
    flags: {},
    locale: 'fr',
    // V2
    tips: {},          // one-time micro tutorials already shown
    memory: {},        // world memory: biggest crash witnessed, squeezes provoked, rivals bought…
    runs: [],          // short history of past runs (Evolution view)
    best: {},          // fastest run time per milestone key
    lastRun: {},       // milestone times of the previous run
  });

  S.createRun = (profile) => ({
    id: Math.random().toString(36).slice(2, 10),
    started: Date.now(),
    time: 0,               // run game-seconds
    era: 1,
    cash: 100,
    earnings: 0,           // monotonic total generated this run
    peakNW: 100,
    nwHist: [],
    incomeHist: [],
    account: { positions: {}, orders: [], history: [], sizePct: 1, lev: 1, combo: 0, nextId: 1 },
    activeAsset: 'NOVA',
    unlocked: { NOVA: true },
    bots: {},
    risk: 'balanced',
    autoBuy: {},
    upgrades: {},
    upgradesSeen: {},
    research: { rp: 0, rpTotal: 0, done: {}, refine: 0 },
    infra: {},
    staff: {},
    legends: {},
    office: 0,
    fund: null,
    rep: 0,
    empire: { acq: {}, div: {}, offices: { nyc: true }, vc: { pitches: [], deals: [], next: 20 }, rivalsBought: {} },
    rivals: null,
    events: { active: [], next: 70, crisis: null, crisisDone: {}, crisisNext: null, eraCrisisAt: {} },
    news: [],
    shocks: [],
    opp: { cur: null, next: 75 },
    contracts: { list: [], nextId: 1, reroll: 0, refill: 0 },
    temps: [],
    abilities: {},
    milestones: {},
    stats: {},
    buffs: {},
    challenge: profile && profile.prestige.nextChallenge ? profile.prestige.nextChallenge : null,
    activity: [],
    flags: {},
    loanAt: -999,
    // V2 — living world (all additive; older saves get these defaults)
    world: null,       // attention, regulators, calendar, rumours (created by TE.World)
    tl: [],            // run timeline (important milestones only)
    tlk: {},
    botExpo: {},       // aggregated exposure per fleet & market
    rivalAI: {},       // rival states (campaigns, trouble, overtakes)
    legendsAway: {},   // legends temporarily poached by a rival
    infScale: null,    // market scale used by influence (blends between eras)
  });

  S.create = () => {
    const profile = S.createProfile();
    return { v: TE.SAVE_VERSION, settings: S.defaultSettings(), profile, run: S.createRun(profile), market: null, savedAt: Date.now() };
  };

  /* ------- stat helpers (run + lifetime) ------- */
  const Stats = (TE.Stats = {
    add(k, v) {
      const s = TE.state; if (!s) return;
      const n = v === undefined ? 1 : v;
      s.run.stats[k] = (s.run.stats[k] || 0) + n;
      s.profile.stats[k] = (s.profile.stats[k] || 0) + n;
    },
    max(k, v) {
      const r = TE.state.profile.records;
      if (r[k] === undefined || v > r[k]) r[k] = v;
      const rr = TE.state.run.stats;
      const key = 'max_' + k;
      if (rr[key] === undefined || v > rr[key]) rr[key] = v;
    },
    min(k, v) {
      const r = TE.state.profile.records;
      if (r[k] === undefined || r[k] === 0 || v < r[k]) r[k] = v;
    },
    rec(k) { return TE.state.profile.records[k]; },
    run(k) { return TE.state.run.stats[k] || 0; },
    life(k) { return TE.state.profile.stats[k] || 0; },
  });
  void Stats;
})(window.TE);
