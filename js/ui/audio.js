/* Procedural sound effects with the Web Audio API — no audio files. */
(function (TE) {
  'use strict';
  const A = (TE.Audio = {});
  let ctx = null, master = null, lastPlay = {};

  A.init = function () {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.connect(ctx.destination);
      A.setVolume();
    } catch (e) { ctx = null; }
  };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  A.setVolume = function () {
    if (!master || !TE.state) return;
    master.gain.value = TE.state.settings.sound ? TE.state.settings.volume * 0.5 : 0;
  };
  function enabled() { return ctx && TE.state && TE.state.settings.sound && TE.state.settings.volume > 0; }

  function tone(freq, dur, opts) {
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const vol = opts.vol || 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = opts.filter;
      o.connect(f); node = f;
    }
    node.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function noise(dur, opts) {
    opts = opts || {};
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass'; f.frequency.value = opts.freq || 1200;
    const g = ctx.createGain();
    g.gain.value = opts.vol || 0.15;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(ctx.currentTime + (opts.delay || 0));
  }

  const SOUNDS = {
    click: () => tone(1800, 0.03, { type: 'square', vol: 0.05, filter: 3000 }),
    open: () => { tone(520, 0.07, { type: 'triangle', vol: 0.18 }); tone(780, 0.08, { type: 'triangle', vol: 0.14, delay: 0.05 }); },
    profit: () => { tone(660, 0.09, { type: 'triangle', vol: 0.2 }); tone(990, 0.14, { type: 'triangle', vol: 0.18, delay: 0.07 }); },
    bigprofit: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.16, delay: i * 0.06 })); },
    loss: () => { tone(330, 0.16, { type: 'sawtooth', vol: 0.09, to: 220, filter: 1200 }); },
    liquidation: () => { tone(160, 0.5, { type: 'sawtooth', vol: 0.18, to: 60, filter: 900 }); noise(0.35, { freq: 400, vol: 0.2, type: 'lowpass' }); },
    crit: () => { [784, 988, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.16, { type: 'square', vol: 0.07, delay: i * 0.045, filter: 5000 })); },
    buy: () => { tone(880, 0.05, { type: 'triangle', vol: 0.12 }); tone(1320, 0.06, { type: 'triangle', vol: 0.1, delay: 0.035 }); },
    deny: () => tone(200, 0.08, { type: 'square', vol: 0.06, filter: 800 }),
    achievement: () => { [659, 831, 988, 1319].forEach((f, i) => tone(f, 0.22, { type: 'sine', vol: 0.18, delay: i * 0.08 })); },
    unlock: () => { tone(440, 0.4, { type: 'sine', vol: 0.12, to: 1760 }); noise(0.3, { freq: 3000, vol: 0.05, type: 'highpass' }); },
    milestone: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.16, delay: i * 0.09 })); tone(1568, 0.6, { type: 'sine', vol: 0.1, delay: 0.5 }); },
    alert: () => { tone(880, 0.1, { type: 'square', vol: 0.07, filter: 2500 }); tone(880, 0.1, { type: 'square', vol: 0.07, delay: 0.16, filter: 2500 }); },
    opportunity: () => { tone(1200, 0.08, { type: 'sine', vol: 0.15 }); tone(1600, 0.12, { type: 'sine', vol: 0.12, delay: 0.08 }); },
    crisis: () => { tone(110, 1.2, { type: 'sawtooth', vol: 0.12, to: 90, filter: 600 }); tone(116, 1.2, { type: 'sawtooth', vol: 0.1, to: 95, filter: 600 }); },
    prestige: () => { tone(80, 1.6, { type: 'sawtooth', vol: 0.15, to: 1200, filter: 2000 }); noise(1.2, { freq: 600, vol: 0.12, type: 'lowpass' }); [523, 784, 1047, 1568].forEach((f, i) => tone(f, 0.6, { type: 'sine', vol: 0.12, delay: 1.2 + i * 0.1 })); },
    research: () => { tone(740, 0.12, { type: 'sine', vol: 0.12 }); tone(1110, 0.18, { type: 'sine', vol: 0.12, delay: 0.09 }); },
  };

  A.play = function (name) {
    if (!enabled()) return;
    const now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < 60) return;
    lastPlay[name] = now;
    try { SOUNDS[name] && SOUNDS[name](); } catch (e) { /* ignore */ }
  };
})(window.TE);
