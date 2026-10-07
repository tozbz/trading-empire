/* Game loop: fixed-step simulation (10 Hz) decoupled from rendering, delta-time based,
 * background-tab safe (interval fallback + catch-up), turbo & time dilation, offline progress. */
(function (TE) {
  'use strict';
  const U = TE.U;
  const L = (TE.Loop = {});
  const STEP = 0.1;
  const MAX_STEPS_FRAME = 400;
  const FULL_SIM_CATCHUP = 60; // seconds simulated in full detail when catching up (beyond: offline rules)
  let last = 0, acc = 0, secAcc = 0, saveAcc = 0, running = false, dilation = 0, lastUi = 0;
  L.STEP = STEP;
  L.paused = false;

  L.speed = function () {
    const s = TE.state;
    const t = Math.min(s.settings.turbo || 1, TE.Prestige.maxTurbo());
    return t * (dilation > 0 ? 10 : 1);
  };
  L.dilate = function (sec) { dilation = Math.max(dilation, sec); };
  L.dilationLeft = () => dilation;

  L.step = function (dt) {
    const s = TE.state;
    if (TE.Mods.dirty) TE.Mods.rebuild();
    s.run.time += dt;
    TE.Market.tick(dt);
    if (TE.Agents) TE.Agents.tick(dt);
    TE.Trading.tick(dt);
    TE.Bots.tick(dt);
    TE.Fund.tick(dt);
    TE.Empire.tick(dt);
    TE.Research.tick(dt);
    TE.Events.tick(dt);
    secAcc += dt;
    if (secAcc >= 1) {
      secAcc -= 1;
      TE.Economy.secondTick();
      TE.Progress.tick1s();
      TE.Achievements.check();
      TE.Contracts.tick();
      TE.Empire.secondTick();
      if (TE.World) TE.World.tick1s();
    }
  };

  function frame(now) {
    if (!running) return;
    tick(now);
    requestAnimationFrame(frame);
  }
  /* V2: a tab left in the background follows the same rules as a closed game. The first minute keeps simulating
   * normally; after that the game goes dormant and the time away is credited with the offline efficiency and cap. */
  const HIDDEN_FULL = 60;
  let hiddenAt = 0, dormant = 0, dormantWall = 0;
  L.isDormant = () => dormant > 0 || dormantWall > 0;
  function wake() {
    if (!dormantWall) return;
    const sec = dormant;
    dormant = 0; dormantWall = 0;
    if (sec > 1) {
      const res = Offline.apply(sec);
      res.away = sec;
      TE.Bus.emit('caughtup', { sec, gained: res.cash, offline: true, res });
    }
  }
  function tick(now) {
    const s = TE.state;
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (document.hidden && hiddenAt && (now - hiddenAt) / 1000 > HIDDEN_FULL) {
      if (!dormantWall) { dormantWall = Date.now() - dt * 1000; TE.Save.save(false, dormantWall); }
      dormant += dt;
      return;
    }
    if (dormantWall) wake();
    s.profile.playtime += Math.min(dt, 5);
    if (dilation > 0) dilation = Math.max(0, dilation - dt);
    if (dt > 3) { L.catchUp(dt); dt = 0; }
    if (!L.paused) {
      acc += dt * L.speed();
      let steps = 0;
      while (acc >= STEP && steps < MAX_STEPS_FRAME) { L.step(STEP); acc -= STEP; steps++; }
      if (acc > STEP * 50) acc = 0; // never spiral
    }
    saveAcc += dt;
    if (s.settings.autosave > 0 && saveAcc >= s.settings.autosave) { saveAcc = 0; TE.Save.save(false); }
    if (!document.hidden && TE.UI.frame) {
      const hz = s.settings.uiHz || 10;
      TE.UI.frame(now, now - lastUi >= 1000 / hz);
      if (now - lastUi >= 1000 / hz) lastUi = now;
    }
  }

  L.start = function () {
    if (running) return;
    running = true;
    last = performance.now();
    if (document.hidden) hiddenAt = last; // opened in a background tab: same dormancy rules
    requestAnimationFrame(frame);
    // background fallback: rAF stops in hidden tabs, intervals keep (throttled) time flowing
    setInterval(() => { if (document.hidden) tick(performance.now()); }, 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { hiddenAt = 0; tick(performance.now()); }
      else { hiddenAt = performance.now(); TE.Save.save(false); }
    });
    window.addEventListener('beforeunload', () => { TE.Save.save(false, dormantWall || undefined); });
  };

  /** Large time gaps (computer asleep…): full detail for the first minute, then the same rules as offline progress. */
  L.catchUp = function (sec) {
    const full = Math.min(sec, FULL_SIM_CATCHUP);
    const n = Math.floor(full / STEP);
    for (let i = 0; i < n; i++) L.step(STEP);
    const rest = sec - full;
    let gained = 0, res = null;
    if (rest > 1) { res = Offline.apply(rest); res.away = rest; gained = res.cash; }
    if (sec > 30) TE.Bus.emit('caughtup', { sec, gained, offline: !!res, res });
  };

  /* ---------------- offline progress ---------------- */
  const Offline = (TE.Offline = {});
  Offline.apply = function (sec, eff, cap) {
    const s = TE.state;
    if (TE.Mods.dirty) TE.Mods.rebuild();
    const t = Math.min(sec, cap === undefined ? TE.Mods.get('offline.cap') : cap);
    const e = eff === undefined ? TE.Mods.get('offline.eff') : eff;
    const rate = TE.Economy.passive();
    const cash = U.cap(rate * t * e);
    if (cash > 0) TE.Economy.earn(cash, 'offline');
    const rp = TE.Research.rate() * t * e;
    if (rp > 0) TE.Research.grant(rp);
    // fund: management fees are part of passive(); AUM drifts with expected performance (kept simple)
    return { sec, counted: t, eff: e, cash, rp, rate };
  };
  /** Called at boot: computes time away since last save and grants progress. */
  Offline.onBoot = function () {
    const s = TE.state;
    const away = (Date.now() - (s.savedAt || Date.now())) / 1000;
    if (away < 20) return null;
    if (away > 86400) TE.Stats.add('longAway');
    const res = Offline.apply(away);
    res.away = away;
    return res;
  };
})(window.TE);
