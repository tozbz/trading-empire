/* Research tree. Spend Research Points (RP). col = branch column, row = visual row. */
(function (TE) {
  'use strict';
  const D = TE.Data;

  D.RESEARCH_BRANCHES = [
    { id: 'trading', name: 'Trading', color: '#19e6ff' },
    { id: 'quant', name: 'Quant', color: '#3d8bff' },
    { id: 'automation', name: 'Automatisation', color: '#19f58c' },
    { id: 'infra', name: 'Infrastructure', color: '#ff9b3d' },
    { id: 'risk', name: 'Gestion du risque', color: '#ffd36b' },
    { id: 'finance', name: 'Finance', color: '#e8c15a' },
    { id: 'ai', name: 'Intelligence artif.', color: '#a77bff' },
    { id: 'influence', name: 'Influence', color: '#ff3d68' },
    { id: 'quantumf', name: 'Finance quantique', color: '#ff4fd8' },
  ];

  const R = [];
  const n = (id, br, row, name, cost, req, effects, desc) => R.push({ id, br, row, name, cost, req: req || [], effects, desc });

  // TRADING
  n('tr1', 'trading', 0, 'Psychologie du trading', 12, [], [{ stat: 'manual.profit', add: 0.5 }], 'Détachez-vous du résultat. Enfin, presque.');
  n('tr2', 'trading', 1, 'Maîtrise des chandeliers', 70, ['tr1'], [{ stat: 'manual.crit', add: 0.02 }], 'Dojis, marteaux et étoiles filantes.');
  n('tr3', 'trading', 2, 'Réflexes de scalpeur', 450, ['tr2'], [{ stat: 'manual.fee', mult: 0.75 }, { stat: 'spread', mult: 0.9 }], 'Doigts plus rapides, exécutions plus serrées.');
  n('tr4', 'trading', 3, 'Lecture du flux d’ordres', 3000, ['tr3'], [{ stat: 'manual.profit', mult: 2 }, { stat: 'manual.payout', add: 5 }], 'Voyez l’iceberg avant le Titanic.');
  n('tr5', 'trading', 4, 'Discipline du levier', 18000, ['tr4', 'rk2'], [{ stat: 'manual.mmr', mult: 0.5 }, { flag: 'liq.refund' }], 'Liquidation plus lointaine ; chaque liquidation rembourse 15 % de la marge.');
  n('tr6', 'trading', 5, 'Mandat de prop desk', 120000, ['tr5'], [{ stat: 'manual.desk', add: 60 }, { stat: 'manual.payout', add: 5 }], 'Taille du desk +60 s, bonus max par trade +5 s.');
  n('tr7', 'trading', 6, 'Observation des baleines', 900000, ['tr6'], [{ stat: 'manual.profit', mult: 3 }, { stat: 'manual.payout', add: 8 }], 'Suivez les plus gros poissons.');
  n('tr8', 'trading', 7, 'Trader légendaire', 7e6, ['tr7'], [{ stat: 'crit.mult', mult: 2 }, { stat: 'manual.crit', add: 0.03 }], 'On écrira des livres sur vous.');

  // QUANT
  n('qn1', 'quant', 0, 'Avantage statistique', 15, [], [{ stat: 'bot.all.winrate', add: 0.01 }], 'Bots : +1 % de taux de réussite.');
  n('qn2', 'quant', 1, 'Moteur de backtest', 90, ['qn1'], [{ stat: 'bot.all.winrate', add: 0.01 }], 'Bots : +1 % de taux de réussite.');
  n('qn3', 'quant', 2, 'Modèles factoriels', 600, ['qn2'], [{ stat: 'bot.all.win', add: 0.2 }], 'Trade gagnant moyen +20 %.');
  n('qn4', 'quant', 3, 'Classification des régimes', 3500, ['qn3'], [{ stat: 'bot.scanner', add: 1 }], 'Les bots orientent leurs trades vers les régimes favorables.');
  n('qn5', 'quant', 4, 'Calcul stochastique', 20000, ['qn4'], [{ stat: 'bot.all.loss', mult: 0.85 }], 'Trade perdant moyen -15 %.');
  n('qn6', 'quant', 5, 'Filtres de Kalman', 140000, ['qn5'], [{ stat: 'bot.all.winrate', add: 0.02 }], 'Bots : +2 % de taux de réussite.');
  n('qn7', 'quant', 6, 'Données alternatives', 1e6, ['qn6', 'ai2'], [{ stat: 'bot.all.win', add: 0.3 }, { stat: 'news.lead', add: 2 }, { flag: 'cal.range' }], 'Images satellites de parkings. Gain moyen +30 %, fourchette attendue des annonces du calendrier.');
  n('qn8', 'quant', 7, 'Microstructure de marché', 8e6, ['qn7', 'in3'], [{ stat: 'bot.hft.profit', mult: 3 }, { stat: 'bot.scalper.profit', mult: 3 }, { stat: 'alpha.capacity', add: 0.25 }], 'HFT et scalpeurs ×3, capacité de marché +25 %.');

  // AUTOMATION
  n('au1', 'automation', 0, 'Planification cron', 15, [], [{ stat: 'bot.all.speed', add: 0.1 }], 'Bots : +10 % de vitesse.');
  n('au2', 'automation', 1, 'Architecture événementielle', 110, ['au1'], [{ stat: 'bot.all.speed', add: 0.15 }], 'Bots : +15 % de vitesse.');
  n('au3', 'automation', 2, 'Exécution parallèle', 700, ['au2'], [{ stat: 'bot.all.speed', add: 0.25 }], 'Bots : +25 % de vitesse.');
  n('au4', 'automation', 3, 'Rééquilibrage auto', 4000, ['au3'], [{ stat: 'bot.all.capital', mult: 1.5 }], 'Capital des bots ×1,5.');
  n('au5', 'automation', 4, 'Systèmes auto-réparants', 25000, ['au4'], [{ stat: 'event.outage', mult: 0.25 }], 'Pannes et bugs 75 % moins pénalisants.');
  n('au6', 'automation', 5, 'Orchestration en essaim', 160000, ['au5', 'qn4'], [{ stat: 'bot.all.profit', mult: 2 }], 'Profit de tous les bots ×2.');
  n('au7', 'automation', 6, 'Opérations autonomes', 1.2e6, ['au6'], [{ stat: 'offline.eff', add: 0.25 }, { stat: 'offline.cap', add: 14400 }], 'Efficacité hors ligne +25 %, plafond hors ligne +4 h.');
  n('au8', 'automation', 7, 'Code auto-réplicant', 9e6, ['au7'], [{ stat: 'bot.all.capital', mult: 3 }], 'Capital des bots ×3.');

  // INFRA
  n('in1', 'infra', 0, 'Overclocking', 40, ['au1'], [{ stat: 'infra.power', add: 0.25 }], 'Tous les effets d’infrastructure +25 %.');
  n('in2', 'infra', 1, 'Kernel bypass', 300, ['in1'], [{ stat: 'latency', mult: 0.7 }], 'Latence -30 %.');
  n('in3', 'infra', 2, 'Accélération FPGA', 2500, ['in2', 'au3'], [{ stat: 'bot.hft.profit', mult: 1.5 }, { stat: 'bot.scalper.profit', mult: 1.5 }], 'HFT et scalpeurs ×1,5.');
  n('in4', 'infra', 3, 'Liaisons micro-ondes', 15000, ['in3'], [{ stat: 'bot.arb.profit', mult: 1.5 }, { stat: 'latency', mult: 0.7 }], 'Arbitrage ×1,5, latence -30 %.');
  n('in5', 'infra', 4, 'Refroidissement liquide', 90000, ['in4'], [{ stat: 'infra.power', add: 0.5 }], 'Tous les effets d’infrastructure +50 %.');
  n('in6', 'infra', 5, 'Calcul photonique', 700000, ['in5'], [{ stat: 'bot.all.speed', mult: 1.5 }], 'Vitesse des bots ×1,5.');
  n('in7', 'infra', 6, 'Réseau de relais orbitaux', 5e6, ['in6'], [{ stat: 'latency', mult: 0.3 }, { stat: 'bot.arb.profit', mult: 2 }], 'Latence -70 %, arbitrage ×2.');

  // RISK
  n('rk1', 'risk', 0, 'Dimensionnement des positions', 25, [], [{ stat: 'rep.loss', mult: 0.5 }], 'Réputation perdue lors des liquidations -50 %.');
  n('rk2', 'risk', 1, 'Value at Risk', 180, ['rk1'], [{ stat: 'bot.all.loss', mult: 0.9 }], 'Perte moyenne des bots -10 %.');
  n('rk3', 'risk', 2, 'Stress tests', 1200, ['rk2'], [{ stat: 'event.neg', mult: 0.75 }], 'Sévérité des événements négatifs -25 %.');
  n('rk4', 'risk', 3, 'Couverture des extrêmes', 8000, ['rk3'], [{ stat: 'bot.volharv.loss', mult: 0.6 }, { stat: 'bot.tail', mult: 0.5 }], 'Pertes extrêmes divisées par deux.');
  n('rk5', 'risk', 4, 'Contrôle du drawdown', 50000, ['rk4'], [{ stat: 'fund.withdraw', mult: 0.6 }], 'Retraits des investisseurs -40 %.');
  n('rk6', 'risk', 5, 'Antifragilité', 350000, ['rk5'], [{ stat: 'crisis.gain', add: 0.5 }], 'Revenus +50 % pendant les crises.');
  n('rk7', 'risk', 6, 'Couverture systémique', 3e6, ['rk6'], [{ stat: 'event.neg', mult: 0.6 }, { stat: 'bot.all.loss', mult: 0.85 }], 'Événements négatifs -40 %, pertes -15 %.');

  // FINANCE
  n('fi1', 'finance', 0, 'Pensée composée', 30, [], [{ stat: 'contract.reward', add: 0.5 }], 'Récompenses de contrats +50 %.');
  n('fi2', 'finance', 1, 'Pitch deck investisseurs', 250, ['fi1'], [{ stat: 'fund.inflow', add: 0.5 }, { stat: 'rep.gain', add: 0.25 }], 'Souscriptions +50 %, réputation +25 %.');
  n('fi3', 'finance', 2, 'Ingénierie des frais', 1800, ['fi2'], [{ stat: 'fund.perf', add: 0.05 }], 'Commission de performance +5 points.');
  n('fi4', 'finance', 3, 'Introduction de capital', 12000, ['fi3'], [{ stat: 'fund.capacity', add: 0.5 }], 'Capacité du fonds +50 %.');
  n('fi5', 'finance', 4, 'Produits structurés', 80000, ['fi4'], [{ stat: 'fund.mgmt', add: 0.01 }, { stat: 'fund.capacity', add: 0.25 }], 'Frais de gestion +1 point, capacité +25 %.');
  n('fi6', 'finance', 5, 'Too Big To Fail', 600000, ['fi5', 'rk5'], [{ stat: 'fund.withdraw', mult: 0.4 }, { stat: 'fund.capacity', add: 0.5 }], 'Trop gros pour faire faillite : retraits -60 %, capacité +50 %.');
  n('fi7', 'finance', 6, 'Thèse de capital-risque', 4e6, ['fi6'], [{ stat: 'vc.luck', add: 0.3 }], 'Vos paris de capital-risque aboutissent plus souvent.');
  n('fi8', 'finance', 7, 'Alchimie financière', 3e7, ['fi7'], [{ stat: 'div.all', mult: 3 }, { stat: 'alpha.capacity', add: 0.5 }], 'Toutes les divisions ×3, capacité de marché +50 %.');

  // AI
  n('ai1', 'ai', 1, 'Machine learning 101', 400, ['qn2'], [{ stat: 'research.rate', add: 0.3 }, { stat: 'bot.all.winrate', add: 0.005 }], 'Recherche +30 %, bots +0,5 % de taux de réussite.');
  n('ai2', 'ai', 2, 'Deep learning', 3500, ['ai1'], [{ stat: 'research.rate', add: 0.5 }, { stat: 'bot.ai.profit', mult: 2 }, { stat: 'bot.swarm.profit', mult: 2 }], 'Recherche +50 %, bots IA ×2.');
  n('ai3', 'ai', 3, 'Apprentissage par renforcement', 30000, ['ai2', 'au3'], [{ stat: 'bot.adapt', add: 0.5 }], 'Les bots souffrent 50 % moins des régimes défavorables.');
  n('ai4', 'ai', 4, 'Modèles Transformer', 250000, ['ai3'], [{ stat: 'news.lead', add: 3 }, { stat: 'research.rate', add: 0.5 }, { flag: 'ind.forecast' }, { flag: 'cal.consensus' }], 'Les news arrivent plus tôt ; prévision de tendance et consensus du calendrier offerts.');
  n('ai5', 'ai', 5, 'Recherche d’architecture neuronale', 2e6, ['ai4'], [{ stat: 'research.rate', mult: 2 }], 'Recherche ×2.');
  n('ai6', 'ai', 6, 'Trader général artificiel', 2e7, ['ai5'], [{ stat: 'bot.all.profit', mult: 3 }], 'Profit de tous les bots ×3.');
  n('ai7', 'ai', 7, 'Auto-amélioration récursive', 2e8, ['ai6'], [{ stat: 'research.rate', mult: 3 }, { stat: 'bot.all.profit', mult: 2 }], 'Recherche ×3, bots ×2.');

  // INFLUENCE
  n('if1', 'influence', 2, 'Relations presse', 3000, ['fi2'], [{ stat: 'rep.gain', add: 0.5 }], 'Gain de réputation +50 %.');
  n('if2', 'influence', 3, 'Lobbying', 30000, ['if1'], [{ stat: 'manual.fee', mult: 0.7 }, { stat: 'event.neg', mult: 0.85 }, { stat: 'reg.gain', mult: 0.85 }], 'Frais -30 %, événements négatifs -15 %, pression réglementaire -15 %.');
  n('if3', 'influence', 4, 'Ingénierie narrative', 300000, ['if2'], [{ flag: 'ab.hype' }, { flag: 'ab.shortreport' }], 'Capacités : Campagne de hype et Rapport short.');
  n('if4', 'influence', 5, 'Capture réglementaire', 3e6, ['if3'], [{ stat: 'event.neg', mult: 0.5 }, { stat: 'fund.withdraw', mult: 0.7 }, { stat: 'reg.gain', mult: 0.6 }], 'Événements négatifs -50 %, retraits -30 %, pression réglementaire -40 %.');
  n('if5', 'influence', 6, 'Murmureur de banque centrale', 3e7, ['if4'], [{ flag: 'ab.rate' }], 'Capacité : Décision de taux (force un bull market).');
  n('if6', 'influence', 7, 'Gravité de marché', 3e8, ['if5'], [{ stat: 'influence', mult: 2 }], 'Influence de marché ×2.');
  n('if7', 'influence', 8, 'Champ de distorsion de la réalité', 3e9, ['if6'], [{ stat: 'influence', mult: 2 }, { stat: 'income.global', mult: 2 }], 'Influence ×2, tous les revenus ×2.');

  // QUANTUM FINANCE
  n('qf1', 'quantumf', 3, 'Recuit quantique', 1e9, ['ai6', 'in6'], [{ stat: 'bot.all.speed', mult: 3 }], 'Vitesse des bots ×3.');
  n('qf2', 'quantumf', 4, 'Trading en superposition', 1e10, ['qf1'], [{ stat: 'bot.all.winrate', add: 0.05 }], 'Bots : +5 % de taux de réussite.');
  n('qf3', 'quantumf', 5, 'Marchés intriqués', 1e11, ['qf2'], [{ stat: 'bot.arb.profit', mult: 5 }, { stat: 'bot.quantum.profit', mult: 3 }], 'Arbitrage ×5, Trader quantique ×3.');
  n('qf4', 'quantumf', 6, 'Effondrement des probabilités', 1e12, ['qf3'], [{ stat: 'bot.all.crit', add: 0.05 }, { stat: 'manual.crit', add: 0.05 }], 'Chances de critique +5 % partout.');
  n('qf5', 'quantumf', 7, 'Couverture multi-mondes', 1e13, ['qf4'], [{ stat: 'bot.all.loss', mult: 0.5 }], 'Pertes des bots divisées par deux.');
  n('qf6', 'quantumf', 8, 'Théorie de l’arbitrage temporel', 1e14, ['qf5'], [{ stat: 'income.global', mult: 5 }], 'Tous les revenus ×5.');

  D.RESEARCH = R;
  D.RESEARCH_MAP = {};
  R.forEach((r) => { D.RESEARCH_MAP[r.id] = r; });

  /* Repeatable endgame research (keeps RP meaningful forever). */
  D.RESEARCH_REPEAT = { id: 'refine', name: 'Raffinement infini', base: 5e5, growth: 6, effect: 0.25,
    desc: 'Recherche répétable. Chaque niveau : +25 % sur tous les revenus (multiplicatif par niveau).' };
})(window.TE);
