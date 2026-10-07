/* Trading bots (strategy fleets).
 * income: calibrated expected $/s per unit at base stats (used to derive capital per unit).
 * winrate / win / loss are per-trade probabilities and returns on deployed capital. fee is round-trip cost.
 * aff: winrate adjustment by regime class (calm, trend_up, trend_down, range, volatile, euphoria, panic, trap).
 */
(function (TE) {
  'use strict';
  const D = TE.Data;

  D.BOTS = [
    { id: 'auto', name: 'Auto-Trader I', icon: '⚙', color: '#8ea3bf', cost: 50, growth: 1.13, income: 0.35, interval: 6,
      winrate: 0.6, win: 0.015, loss: 0.012, fee: 0.0006, aff: {}, style: 'random', unlockEarn: 40,
      desc: 'Une tâche planifiée avec un compte de courtage. Petits trades fréquents, globalement inoffensif.', fit: 'Aucune préférence de régime.' },
    { id: 'momentum', name: 'Bot Momentum', icon: '↗', color: '#19e6ff', cost: 1000, growth: 1.14, income: 2.8, interval: 5,
      winrate: 0.57, win: 0.025, loss: 0.018, fee: 0.0006, style: 'trend', unlockEarn: 600,
      aff: { trend_up: 0.09, trend_down: 0.09, euphoria: 0.07, panic: 0.06, range: -0.08, calm: -0.04, trap: -0.07 },
      desc: 'Achète la force, vend la faiblesse. Se régale des tendances, saigne dans les marchés hachés.', fit: 'Excelle en tendance · peine en range' },
    { id: 'meanrev', name: 'Bot de retour à la moyenne', icon: '⇄', color: '#6cf0a0', cost: 25000, growth: 1.14, income: 25, interval: 4,
      winrate: 0.62, win: 0.012, loss: 0.01, fee: 0.0006, style: 'fade', unlockEarn: 12000,
      aff: { range: 0.10, calm: 0.06, trap: 0.08, trend_up: -0.07, trend_down: -0.07, euphoria: -0.09, panic: -0.08 },
      desc: 'Joue contre les excès et parie sur un retour à la moyenne. Déteste les tendances qui s’emballent.', fit: 'Excelle en range et sur les pièges · peine en tendance' },
    { id: 'breakout', name: 'Bot Breakout', icon: '⇪', color: '#ffb627', cost: 7e5, growth: 1.15, income: 200, interval: 7,
      winrate: 0.47, win: 0.04, loss: 0.02, fee: 0.0006, style: 'trend', unlockEarn: 3e5,
      aff: { volatile: 0.08, euphoria: 0.06, panic: 0.06, trend_up: 0.03, trend_down: 0.03, range: -0.06, calm: -0.03, trap: -0.10 },
      desc: 'Attend la compression, puis bondit sur la cassure. Peu de trades gagnants, mais de gros gains.', fit: 'Excelle dans la volatilité · déteste les pièges' },
    { id: 'scalper', name: 'Bot de Scalping', icon: '✂', color: '#ff7ac8', cost: 2e7, growth: 1.15, income: 1667, interval: 1.2,
      winrate: 0.62, win: 0.004, loss: 0.003, fee: 0.0004, style: 'random', latency: true, unlockEarn: 8e6,
      aff: { calm: 0.05, range: 0.06, volatile: -0.05, panic: -0.08 },
      desc: 'Des centaines de micro-trades. Vit et meurt par les frais et la latence.', fit: 'Excelle en marché calme · sensible aux frais et à la latence' },
    { id: 'arb', name: 'Bot d’Arbitrage', icon: '⇋', color: '#a77bff', cost: 6e8, growth: 1.15, income: 12000, interval: 2,
      winrate: 0.85, win: 0.003, loss: 0.005, fee: 0.0003, style: 'arb', latency: true, perMarket: 0.05, unlockEarn: 2.5e8,
      aff: {},
      desc: 'Exploite les écarts de prix entre plateformes. Chaque nouveau marché est une nouvelle opportunité.', fit: '+5 % de profit par marché débloqué · sensible à la latence' },
    { id: 'volharv', name: 'Moissonneur de volatilité', icon: '≋', color: '#e8c15a', cost: 2e10, growth: 1.16, income: 6.7e4, interval: 8,
      winrate: 0.9, win: 0.008, loss: 0.03, fee: 0.0005, style: 'fade', unlockEarn: 8e9,
      aff: { calm: 0.04, range: 0.05, panic: -0.25, volatile: -0.12 },
      desc: 'Vend de la prime d’options. Gagne neuf fois sur dix. La dixième fait très mal.', fit: 'Excelle au calme · risque extrême en panique' },
    { id: 'hft', name: 'Moteur HFT', icon: 'ϟ', color: '#19f58c', cost: 7e11, growth: 1.16, income: 3.5e5, interval: 0.4,
      winrate: 0.6, win: 0.0012, loss: 0.001, fee: 0.0001, style: 'random', latency: true, unlockEarn: 2.5e11,
      aff: { volatile: 0.04, panic: 0.03 },
      desc: 'Market making à la microseconde et arbitrage de latence. Exige une infrastructure sérieuse.', fit: 'Extrêmement sensible à la latence et aux frais' },
    { id: 'ai', name: 'Trader IA', icon: '◉', color: '#3d8bff', cost: 2.5e13, growth: 1.17, income: 1.67e6, interval: 3,
      winrate: 0.62, win: 0.018, loss: 0.014, fee: 0.0005, style: 'adaptive', compute: true, unlockEarn: 1e13,
      aff: { trend_up: 0.05, trend_down: 0.05, range: 0.05, euphoria: 0.04, panic: 0.04, calm: 0.03, volatile: 0.03, trap: 0.02 },
      desc: 'Prévisionniste neuronal qui adapte sa stratégie au régime en cours.', fit: 'S’adapte à tous les régimes · profite de la puissance de calcul' },
    { id: 'swarm', name: 'Essaim neuronal', icon: '⁂', color: '#00ffd5', cost: 9e14, growth: 1.17, income: 7.5e6, interval: 1.5,
      winrate: 0.63, win: 0.011, loss: 0.009, fee: 0.0003, style: 'adaptive', compute: true, unlockEarn: 3.5e14,
      aff: { trend_up: 0.05, trend_down: 0.05, range: 0.05, euphoria: 0.05, panic: 0.05, calm: 0.04, volatile: 0.04, trap: 0.03 },
      desc: 'Dix mille micro-agents qui votent à chaque tick. Alpha émergent.', fit: 'S’adapte à tous les régimes · profite de la puissance de calcul' },
    { id: 'quantum', name: 'Trader quantique', icon: '⟁', color: '#ff4fd8', cost: 3.3e16, growth: 1.18, income: 3.3e7, interval: 1,
      winrate: 0.68, win: 0.014, loss: 0.011, fee: 0.0003, style: 'adaptive', compute: true, unlockEarn: 1.2e16,
      aff: { trend_up: 0.06, trend_down: 0.06, range: 0.06, euphoria: 0.06, panic: 0.06, calm: 0.06, volatile: 0.06, trap: 0.06 },
      desc: 'Évalue simultanément tous les trades possibles et garde la bonne ligne temporelle.', fit: 'Positif dans tous les régimes' },
    { id: 'singularity', name: 'Moteur de Singularité', icon: '✺', color: '#ffffff', cost: 1.2e18, growth: 1.18, income: 1.2e8, interval: 0.5,
      winrate: 0.75, win: 0.018, loss: 0.01, fee: 0.0002, style: 'adaptive', compute: true, unlockEarn: 4e17,
      aff: { trend_up: 0.08, trend_down: 0.08, range: 0.08, euphoria: 0.08, panic: 0.08, calm: 0.08, volatile: 0.08, trap: 0.08 },
      desc: 'Une intelligence économique auto-améliorante. Elle ne prédit plus les marchés : elle les écrit.', fit: 'Domine tous les régimes' },
  ];

  /* Human trading desk — driven by staff (juniors / seniors), shown alongside bots. */
  D.DESK = { id: 'desk', name: 'Desk de traders humains', icon: '☺', color: '#ffd36b', income: 30, interval: 6,
    winrate: 0.57, win: 0.02, loss: 0.016, fee: 0.0006, style: 'trend', staff: true,
    aff: { trend_up: 0.04, trend_down: 0.04, range: 0.02, panic: -0.03 },
    desc: 'Vos traders. Caféinés, émotifs, étonnamment rentables.', fit: 'Intuition humaine' };

  D.BOT_MAP = {};
  D.BOTS.forEach((b, i) => { b.tier = i + 1; D.BOT_MAP[b.id] = b; });
  D.BOT_MAP.desk = D.DESK;

  /* Unit-count milestones — the "one more and everything explodes" moments. */
  D.BOT_MILESTONES = [
    { n: 10, profit: 2 }, { n: 25, profit: 2 }, { n: 50, speed: 2 }, { n: 75, profit: 2 }, { n: 100, profit: 3 },
    { n: 150, profit: 2 }, { n: 200, speed: 2 }, { n: 250, profit: 3 }, { n: 300, profit: 2 }, { n: 400, profit: 4 },
    { n: 500, speed: 2 }, { n: 600, profit: 3 }, { n: 700, profit: 3 }, { n: 800, profit: 4 }, { n: 900, profit: 5 },
    { n: 1000, profit: 10 },
  ];

  /* Fleet grades (earned through gameplay — never random). */
  D.BOT_GRADES = [
    { id: 'common', name: 'Commun', min: 0, crit: 0, color: '#8ea3bf' },
    { id: 'rare', name: 'Rare', min: 25, crit: 0.005, color: '#3d8bff' },
    { id: 'epic', name: 'Épique', min: 100, crit: 0.01, color: '#a77bff' },
    { id: 'legendary', name: 'Légendaire', min: 250, crit: 0.02, color: '#ffb627' },
    { id: 'quantum', name: 'Quantique', min: 500, crit: 0.04, color: '#ff4fd8' },
  ];

  /* Risk appetite profiles for the whole fleet. */
  D.RISK_PROFILES = {
    conservative: { name: 'Prudent', lev: 0.5, win: 0.01, tail: 0, desc: 'Exposition divisée par deux, +1 % de taux de réussite. Courbe de capital lisse.' },
    balanced: { name: 'Équilibré', lev: 1, win: 0, tail: 0, desc: 'Exposition standard.' },
    aggressive: { name: 'Agressif', lev: 2, win: -0.01, tail: 0, desc: 'Exposition doublée, -1 % de taux de réussite. Variations plus fortes.' },
    degenerate: { name: 'Dégénéré', lev: 4, win: -0.03, tail: 0.0025, desc: 'Exposition ×4, -3 % de taux de réussite, explosions occasionnelles. Ceci n’est pas un conseil financier.' },
  };
})(window.TE);
