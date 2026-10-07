/* Prestige layers: perks for Alpha (α), Legacy (Λ) and Singularity cores (✦), plus challenge runs. */
(function (TE) {
  'use strict';
  const D = TE.Data;
  const M = (v) => TE.U.money(v, { dec: 0 });
  const X = (v) => TE.U.fmt(v);

  D.ALPHA_PERKS = [
    { id: 'seed', name: 'Capital d’amorçage', icon: '$', max: 8, base: 1, growth: 2.6,
      vals: [100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10], desc: (l) => 'Commencez chaque partie avec ' + M(D.ALPHA_PERKS[0].vals[l]) + '.' },
    { id: 'quickstart', name: 'Départ rapide', icon: '⚙', max: 5, base: 2, growth: 3,
      vals: [[0, 0, 0], [5, 0, 0], [10, 5, 0], [25, 10, 5], [50, 25, 10], [100, 50, 25]],
      desc: (l) => { const v = D.ALPHA_PERKS[1].vals[l]; return l === 0 ? 'Commencez avec des bots offerts.' : 'Commencez avec ' + v[0] + ' Auto-Traders, ' + v[1] + ' bots Momentum et ' + v[2] + ' bots de retour à la moyenne.'; } },
    { id: 'botiq', name: 'Intelligence des bots', icon: '◉', max: 10, base: 3, growth: 1.8, desc: (l) => 'Bots : +' + l + ' % de taux de réussite.', fx: (l) => [{ stat: 'bot.all.winrate', add: 0.01 * l }] },
    { id: 'overclock', name: 'Overclocking', icon: '⚡', max: 10, base: 2, growth: 1.7, desc: (l) => 'Bots : +' + 15 * l + ' % de vitesse.', fx: (l) => [{ stat: 'bot.all.speed', add: 0.15 * l }] },
    { id: 'trader', name: 'Légende du trading', icon: '★', max: 15, base: 2, growth: 1.9, desc: (l) => 'Profit manuel ×' + X(Math.pow(1.5, l)) + ', bonus max par trade +' + 2 * l + ' s.', fx: (l) => (l ? [{ stat: 'manual.profit', mult: Math.pow(1.5, l) }, { stat: 'manual.payout', add: 2 * l }] : []) },
    { id: 'leverage', name: 'Licence de levier', icon: 'x', max: 5, base: 3, growth: 3, vals: [1, 3, 5, 10, 20, 50], desc: (l) => (l ? 'Commencez avec un levier jusqu’à x' + D.ALPHA_PERKS[5].vals[l] + '.' : 'Commencez avec le levier déjà débloqué.') },
    { id: 'rep', name: 'Héritage de réputation', icon: '♛', max: 6, base: 4, growth: 3, vals: [0, 25, 100, 400, 1500, 6000, 25000], desc: (l) => 'Commencez avec ' + TE.U.int(D.ALPHA_PERKS[6].vals[l]) + ' de réputation.' },
    { id: 'offline', name: 'Équipe de nuit', icon: '☾', max: 5, base: 3, growth: 2.5, desc: (l) => 'Efficacité hors ligne +' + 12 * l + ' %, plafond hors ligne +' + 2 * l + ' h.',
      fx: (l) => [{ stat: 'offline.eff', add: 0.12 * l }, { stat: 'offline.cap', add: 7200 * l }] },
    { id: 'crit', name: 'Intuition critique', icon: '✦', max: 10, base: 3, growth: 1.9, desc: (l) => 'Chance de critique +' + l + ' % (bots +' + (0.2 * l).toFixed(1).replace('.', ',') + ' %), puissance des critiques +' + 20 * l + ' %.',
      fx: (l) => [{ stat: 'manual.crit', add: 0.01 * l }, { stat: 'bot.all.crit', add: 0.002 * l }, { stat: 'crit.mult', add: 0.2 * l }] },
    { id: 'markets', name: 'Mémoire des marchés', icon: '◱', max: 1, base: 15, growth: 1, desc: () => 'Les améliorations d’accès aux marchés survivent à la liquidation.' },
    { id: 'research', name: 'Mémoire institutionnelle', icon: '⚗', max: 5, base: 5, growth: 2.5, desc: (l) => 'Recherche ×' + X(Math.pow(1.5, l)) + '.', fx: (l) => (l ? [{ stat: 'research.rate', mult: Math.pow(1.5, l) }] : []) },
    { id: 'charter', name: 'Charte du fonds', icon: '◈', max: 1, base: 25, growth: 1, desc: () => 'Votre hedge fund est fondé gratuitement dès qu’il devient disponible.' },
    { id: 'compounding', name: 'Alpha composé', icon: 'α', max: 10, base: 10, growth: 2, desc: (l) => 'Chaque α rapporte +' + (10 + l) + ' % de revenus (base : 10 %).' },
    { id: 'contracts', name: 'Avocat d’affaires', icon: '✎', max: 5, base: 2, growth: 2.2, desc: (l) => 'Récompenses de contrats +' + 50 * l + ' %' + (l >= 3 ? ', +1 emplacement de contrat.' : '.'),
      fx: (l) => [{ stat: 'contract.reward', add: 0.5 * l }] },
    { id: 'radar', name: 'Radar à opportunités', icon: '◎', max: 5, base: 2, growth: 2.2, desc: (l) => 'Opportunités +' + 25 * l + ' % plus fréquentes, récompenses +' + 50 * l + ' %.',
      fx: (l) => [{ stat: 'opp.freq', add: 0.25 * l }, { stat: 'opp.reward', add: 0.5 * l }] },
    { id: 'cheapbots', name: 'Remise sur volume', icon: '%', max: 10, base: 3, growth: 2, desc: (l) => 'Coût des bots -' + 5 * l + ' %.', fx: (l) => (l ? [{ stat: 'bot.cost', mult: 1 - 0.05 * l }] : []) },
    { id: 'headhunter', name: 'Chasseur de têtes', icon: '☺', max: 5, base: 4, growth: 2.5, desc: (l) => 'Coût du personnel -' + 10 * l + ' %, capacité +' + 5 * l + ' employés.',
      fx: (l) => (l ? [{ stat: 'staff.cost', mult: 1 - 0.1 * l }, { stat: 'staff.cap', add: 5 * l }] : []) },
    { id: 'deepmarkets', name: 'Marchés profonds', icon: '≋', max: 10, base: 5, growth: 2, desc: (l) => 'Capacité de marché +' + 25 * l + ' % (relève tous les plafonds de saturation).', fx: (l) => (l ? [{ stat: 'alpha.capacity', add: 0.25 * l }] : []) },
    { id: 'turbo', name: 'Arbitrage temporel', icon: '⧗', max: 3, base: 50, growth: 6, vals: [1, 2, 5, 10], desc: (l) => (l ? 'Mode turbo jusqu’à ×' + [1, 2, 5, 10][l] + '.' : 'Débloque le mode turbo (vitesse de simulation).') },
  ];

  D.LEGACY_PERKS = [
    { id: 'dynasty', name: 'Fortune dynastique', icon: '♜', max: 25, base: 1, growth: 1.6, desc: (l) => 'Tous les revenus ×' + X(Math.pow(3, l)) + '.', fx: (l) => (l ? [{ stat: 'income.global', mult: Math.pow(3, l) }] : []) },
    { id: 'alphaamp', name: 'Amplificateur d’Alpha', icon: 'α', max: 10, base: 1, growth: 2, desc: (l) => 'Efficacité de l’Alpha +' + 25 * l + ' %.' },
    { id: 'autobots', name: 'Achat auto des bots', icon: '⚙', max: 1, base: 1, growth: 1, desc: () => 'Déploie automatiquement les bots les plus rentables (activable dans Bots).' },
    { id: 'autoupg', name: 'Achat auto des améliorations', icon: '⬆', max: 1, base: 2, growth: 1, desc: () => 'Achète automatiquement les améliorations abordables (activable dans Améliorations).' },
    { id: 'autores', name: 'Recherche automatique', icon: '⚗', max: 1, base: 2, growth: 1, desc: () => 'Lance automatiquement la technologie disponible la moins chère.' },
    { id: 'autofirm', name: 'Gestion auto de la société', icon: '▦', max: 1, base: 3, growth: 1, desc: () => 'Achète automatiquement de l’infrastructure et embauche du personnel.' },
    { id: 'keepres', name: 'Recherche conservée', icon: '⌘', max: 1, base: 4, growth: 1, desc: () => 'La recherche survit à la liquidation.' },
    { id: 'headstart', name: 'Longueur d’avance', icon: '▶', max: 3, base: 2, growth: 4, vals: [0, 1e6, 1e9, 1e12], desc: (l) => (l ? 'Commencez chaque partie avec ' + M(D.LEGACY_PERKS[7].vals[l]) + ' de liquidités en plus.' : 'Commencez chaque partie avec un énorme matelas de liquidités.') },
    { id: 'hypertime', name: 'Hyper-temps', icon: '⧗', max: 2, base: 5, growth: 5, vals: [0, 25, 50], desc: (l) => (l ? 'Mode turbo jusqu’à ×' + D.LEGACY_PERKS[8].vals[l] + '.' : 'Des modes turbo plus rapides.') },
    { id: 'echo', name: 'Écho d’Alpha', icon: '◌', max: 5, base: 3, growth: 3, desc: (l) => 'Après un reset Legacy, conservez ' + 10 * l + ' % de votre Alpha précédent.' },
  ];

  D.SING_PERKS = [
    { id: 'omni', name: 'Omnipotence', icon: '✺', max: 50, base: 1, growth: 1.5, desc: (l) => 'Tous les revenus ×' + X(Math.pow(10, l)) + '.', fx: (l) => (l ? [{ stat: 'income.global', mult: Math.pow(10, l) }] : []) },
    { id: 'timedil', name: 'Dilatation temporelle', icon: '⧗', max: 1, base: 1, growth: 1, desc: () => 'Capacité : la simulation tourne ×10 pendant 15 secondes.' },
    { id: 'eternalalpha', name: 'Alpha éternel', icon: 'α', max: 1, base: 2, growth: 1, desc: () => 'Les avantages Alpha survivent aux resets Legacy.' },
    { id: 'eternallegacy', name: 'Legacy éternel', icon: 'Λ', max: 1, base: 5, growth: 1, desc: () => 'Les avantages Legacy survivent à la Singularité.' },
    { id: 'chronoshift', name: 'Chronoshift', icon: '⏩', max: 1, base: 3, growth: 1, desc: () => 'Mode turbo jusqu’à ×100.' },
    { id: 'resonance', name: 'Résonance des noyaux', icon: '◎', max: 10, base: 2, growth: 2, desc: (l) => 'Gains de Legacy ×' + Math.pow(2, l) + '.' },
  ];

  D.CHALLENGES = [
    { id: 'noleverage', name: 'SANS LEVIER', icon: 'x1', alphaMult: 1.5, goal: 1e9, reward: [{ stat: 'manual.profit', mult: 2 }, { stat: 'income.global', add: 0.1 }],
      rewardText: 'Profit manuel ×2, +10 % sur tous les revenus (permanent).', desc: 'Levier bloqué à x1. Risque des bots bloqué sur Prudent.' },
    { id: 'cryptoonly', name: 'CRYPTO UNIQUEMENT', icon: '₿', alphaMult: 1.75, goal: 1e9, reward: [{ stat: 'bot.all.speed', add: 0.25 }, { stat: 'income.global', add: 0.1 }],
      rewardText: 'Vitesse des bots +25 %, +10 % sur tous les revenus (permanent).', desc: 'Seuls les marchés crypto existent. Vous commencez sur BitX.' },
    { id: 'extremevol', name: 'VOLATILITÉ EXTRÊME', icon: '≋', alphaMult: 1.5, goal: 1e9, reward: [{ stat: 'crit.mult', mult: 1.5 }, { stat: 'income.global', add: 0.1 }],
      rewardText: 'Puissance des critiques ×1,5, +10 % sur tous les revenus (permanent).', desc: 'Toute la volatilité ×2,5 et des événements deux fois plus fréquents.' },
    { id: 'bearmarket', name: 'OURS ÉTERNEL', icon: '▼', alphaMult: 2, goal: 1e9, reward: [{ stat: 'event.neg', mult: 0.8 }, { stat: 'income.global', add: 0.15 }],
      rewardText: 'Événements négatifs -20 %, +15 % sur tous les revenus (permanent).', desc: 'Le cycle macro reste bloqué en bear market.' },
    { id: 'highfees', name: 'FORTES FRICTIONS', icon: '%', alphaMult: 1.5, goal: 1e9, reward: [{ stat: 'bot.all.fee', mult: 0.75 }, { stat: 'income.global', add: 0.1 }],
      rewardText: 'Frais des bots -25 %, +10 % sur tous les revenus (permanent).', desc: 'Frais ×5 et spreads ×3.' },
    { id: 'nobots', name: 'SANS BOTS', icon: '☺', alphaMult: 3, goal: 1e8, reward: [{ stat: 'staff.desk', mult: 5 }, { stat: 'income.global', add: 0.25 }],
      rewardText: 'Desk humain ×5, +25 % sur tous les revenus (permanent).', desc: 'Les bots de trading sont désactivés. Il n’y a que vous et vos humains.' },
  ];
  D.CHALLENGE_MAP = {};
  D.CHALLENGES.forEach((c) => { D.CHALLENGE_MAP[c.id] = c; });

  D.P1_MIN_EARN = 1e9;     // run earnings needed to Liquidate
  D.P2_MIN_ALPHA = 5000;   // alpha earned (since last Legacy) needed for Market Legacy
  D.P3_MIN_EARN = 1e30;    // run earnings needed for the Singularity
})(window.TE);
