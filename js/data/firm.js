/* Firm data: infrastructure, staff, legendary hires, headquarters. */
(function (TE) {
  'use strict';
  const D = TE.Data;

  /* Infrastructure: countable. Effects are per unit (add stacks linearly, mult compounds).
   * latency: per-unit latency multiplier. compute: TFLOPS per unit (flavour + AI bots). */
  D.INFRA = [
    { id: 'laptop', name: 'PC portable gamer', icon: '▭', cost: 100, growth: 1, max: 1, compute: 0.01, latency: 1,
      effects: [{ stat: 'bot.all.speed', add: 0.05 }, { stat: 'manual.profit', add: 0.15 }], desc: 'Clavier RGB. Graphiques à 240 FPS.' },
    { id: 'station', name: 'Station de trading', icon: '▤', cost: 450, growth: 1.5, max: 8, compute: 0.02, latency: 1,
      effects: [{ stat: 'manual.profit', add: 0.08 }, { stat: 'bot.all.speed', add: 0.02 }], desc: 'Un écran de plus. Puis un autre. Puis encore un autre.' },
    { id: 'fiber', name: 'Connexion fibre', icon: '≡', cost: 2500, growth: 1, max: 1, compute: 0, latency: 0.25,
      effects: [{ stat: 'bot.all.speed', add: 0.05 }], desc: 'La latence passe de 180 ms à 45 ms.' },
    { id: 'server', name: 'Serveur dédié', icon: '▥', cost: 9000, growth: 1.26, compute: 1, latency: 0.99,
      effects: [{ stat: 'bot.all.speed', add: 0.02 }, { stat: 'bot.all.capital', add: 0.015 }], desc: 'Vos bots arrêtent enfin de partager un portable avec Netflix.' },
    { id: 'rack', name: 'Baie de serveurs', icon: '▦', cost: 220000, growth: 1.28, compute: 25, latency: 0.985,
      effects: [{ stat: 'bot.all.speed', add: 0.03 }, { stat: 'bot.all.capital', add: 0.03 }], desc: '42U de petites lumières qui clignotent.' },
    { id: 'datacenter', name: 'Centre de données', icon: '▩', cost: 12000000, growth: 1.3, compute: 900, latency: 0.97,
      effects: [{ stat: 'bot.all.speed', add: 0.05 }, { stat: 'bot.all.capital', add: 0.05 }, { stat: 'research.rate', add: 0.04 }], desc: 'Refroidissement industriel, alimentation redondante, un vigile nommé Steve.' },
    { id: 'hftdc', name: 'Centre HFT', icon: '⌁', cost: 800000000, growth: 1.32, compute: 5000, latency: 0.85,
      effects: [{ stat: 'bot.hft.profit', add: 0.2 }, { stat: 'bot.scalper.profit', add: 0.2 }, { stat: 'bot.arb.profit', add: 0.1 }], desc: 'Construit juste à côté de la Bourse. Littéralement.' },
    { id: 'privfiber', name: 'Réseau fibre privé', icon: '⋯', cost: 15000000000, growth: 1.7, max: 12, compute: 0, latency: 0.8,
      effects: [{ stat: 'bot.arb.profit', add: 0.15 }], desc: 'Votre propre câble sous l’Atlantique.' },
    { id: 'colo', name: 'Colocation en Bourse', icon: '⌖', cost: 80000000000, growth: 1, max: 1, compute: 2e4, latency: 0.1,
      effects: [{ stat: 'bot.all.fee', mult: 0.7 }, { stat: 'bot.hft.profit', mult: 2 }], desc: 'Vos serveurs sont installés dans le bâtiment même du moteur d’appariement.' },
    { id: 'globaldc', name: 'Centre de données mondial', icon: '◍', cost: 2000000000000, growth: 1.33, compute: 2e5, latency: 0.95,
      effects: [{ stat: 'bot.all.speed', add: 0.08 }, { stat: 'bot.all.capital', add: 0.08 }, { stat: 'offline.cap', add: 1800 }], desc: 'Du calcul qui suit le soleil sur tous les continents.' },
    { id: 'supercomp', name: 'Supercalculateur', icon: '⬢', cost: 80000000000000, growth: 1.35, compute: 5e6, latency: 1,
      effects: [{ stat: 'research.rate', add: 0.2 }, { stat: 'bot.ai.profit', add: 0.15 }, { stat: 'bot.swarm.profit', add: 0.15 }], desc: 'Des exaflops consacrés à prédire demain.' },
    { id: 'gpucluster', name: 'Cluster de GPU', icon: '▣', cost: 4E+15, growth: 1.36, compute: 5e8, latency: 1,
      effects: [{ stat: 'bot.ai.profit', add: 0.25 }, { stat: 'bot.swarm.profit', add: 0.25 }, { stat: 'research.rate', add: 0.15 }], desc: 'Un million de GPU. Le réseau électrique a son mot à dire.' },
    { id: 'quantumpc', name: 'Ordinateur quantique', icon: '⟁', cost: 2E+18, growth: 1.4, compute: 1e12, latency: 0.7,
      effects: [{ stat: 'bot.quantum.profit', add: 0.3 }, { stat: 'bot.all.profit', add: 0.05 }, { stat: 'research.rate', add: 0.2 }], desc: 'Refroidi à 15 millikelvins. Trade en superposition.' },
    { id: 'dyson', name: 'Réseau de calcul de Dyson', icon: '✺', cost: 4E+23, growth: 1.45, compute: 1e18, latency: 0.5,
      effects: [{ stat: 'bot.all.profit', add: 0.15 }, { stat: 'bot.singularity.profit', add: 0.3 }, { stat: 'research.rate', add: 0.3 }], desc: 'La puissance d’une étoile entière, braquée sur le carnet d’ordres.' },
  ];
  D.INFRA_MAP = {};
  D.INFRA.forEach((x) => { D.INFRA_MAP[x.id] = x; });
  D.BASE_LATENCY = 180; // ms

  /* Staff: countable hires limited by headquarters capacity. desk: trader-equivalents for the Human Desk. */
  D.STAFF = [
    { id: 'intern', name: 'Stagiaire', icon: '☕', cost: 600, growth: 1.17, effects: [{ stat: 'research.rate', add: 0.03 }, { stat: 'bot.all.speed', add: 0.003 }],
      desc: 'Va chercher les cafés. Écrit parfois du Python.' },
    { id: 'junior', name: 'Trader junior', icon: '☺', cost: 3000, growth: 1.16, desk: 1, effects: [],
      desc: 'Gère le portefeuille de la maison sur le desk humain.' },
    { id: 'quant', name: 'Analyste quantitatif', icon: 'Σ', cost: 25000, growth: 1.2, effects: [{ stat: 'research.rate', add: 0.08 }, { stat: 'bot.all.win', add: 0.005 }],
      desc: 'Docteur en physique. Construit des modèles que personne d’autre ne comprend.' },
    { id: 'engineer', name: 'Ingénieur logiciel', icon: '⌘', cost: 50000, growth: 1.21, effects: [{ stat: 'bot.all.speed', add: 0.01 }],
      desc: 'Réécrit tout en Rust. Les bots vont plus vite.' },
    { id: 'senior', name: 'Trader senior', icon: '★', cost: 100000, growth: 1.19, desk: 6, effects: [{ stat: 'staff.desk', add: 0.05 }],
      desc: 'Vingt ans de salle des marchés. Encadre les juniors (+5 % de profit du desk chacun).' },
    { id: 'riskmgr', name: 'Risk manager', icon: '⛨', cost: 160000, growth: 1.22, effects: [{ stat: 'bot.all.loss', mult: 0.99 }, { stat: 'fund.withdraw', mult: 0.98 }, { stat: 'reg.gain', mult: 0.99 }],
      desc: 'Dit « non » de manière professionnelle. Pertes des bots -1 %, pression réglementaire -1 % chacun.' },
    { id: 'ir', name: 'Relations investisseurs', icon: '✉', cost: 2000000, growth: 1.22, req: 'fund', effects: [{ stat: 'fund.inflow', add: 0.08 }, { stat: 'rep.gain', add: 0.04 }],
      desc: 'Déjeune avec les fonds de pension. +8 % de souscriptions chacun.' },
    { id: 'pm', name: 'Gérant de portefeuille', icon: '◈', cost: 8000000, growth: 1.22, req: 'fund', effects: [{ stat: 'fund.capacity', add: 0.04 }, { stat: 'bot.all.capital', add: 0.01 }],
      desc: 'Répartit le capital entre les stratégies. +4 % de capacité du fonds chacun.' },
    { id: 'cio', name: 'Directeur des investissements', icon: '♛', cost: 2000000000, growth: 1, max: 1, effects: [{ stat: 'income.global', mult: 2 }],
      desc: 'Une seule personne pour régner sur le portefeuille. Tous les revenus ×2.' },
    { id: 'airesearcher', name: 'Chercheur en IA', icon: '◉', cost: 80000000000, growth: 1.19, effects: [{ stat: 'research.rate', add: 0.25 }, { stat: 'bot.ai.profit', add: 0.1 }, { stat: 'bot.swarm.profit', add: 0.1 }],
      desc: 'Entraîne des modèles sur tout ce qui a jamais été écrit sur l’argent.' },
    { id: 'lobbyist', name: 'Lobbyiste', icon: '⚖', cost: 2000000000000, growth: 1.2, effects: [{ stat: 'influence', add: 0.05 }, { stat: 'event.neg', mult: 0.985 }, { stat: 'reg.gain', mult: 0.98 }],
      desc: 'Connaît un type qui connaît un sénateur.' },
    { id: 'physicist', name: 'Physicien quantique', icon: '⚛', cost: 4E+17, growth: 1.22, effects: [{ stat: 'bot.quantum.profit', add: 0.2 }, { stat: 'research.rate', add: 0.3 }],
      desc: 'Pas tout à fait sûr de la ligne temporelle dans laquelle il se trouve.' },
  ];
  D.STAFF_MAP = {};
  D.STAFF.forEach((x) => { D.STAFF_MAP[x.id] = x; });

  /* Legendary hires: unique, unlocked by reputation. */
  D.LEGENDS = [
    { id: 'tape', name: 'Mara « La Bande » Okafor', role: 'Légende de la corbeille', rep: 40, cost: 80000, effects: [{ stat: 'manual.profit', mult: 3 }, { stat: 'manual.crit', add: 0.02 }, { stat: 'manual.payout', add: 10 }],
      quote: 'Un graphique, c’est une histoire. Moi, je lis juste la dernière page en premier.' },
    { id: 'antonov', name: 'Dr. Lev Antonov', role: 'Pionnier quant', rep: 150, cost: 2000000, effects: [{ stat: 'bot.all.winrate', add: 0.03 }, { stat: 'research.rate', mult: 2 }],
      quote: 'Les marchés, c’est de la physique avec un moins bon éclairage.' },
    { id: 'takeda', name: 'Sora Takeda', role: 'Architecte HFT', rep: 500, cost: 200000000, effects: [{ stat: 'bot.hft.profit', mult: 4 }, { stat: 'bot.scalper.profit', mult: 4 }, { stat: 'latency', mult: 0.5 }],
      quote: 'Une nanoseconde est une éternité quand on sait s’en servir.' },
    { id: 'kessler', name: 'Victoria Kessler', role: 'Ex-banquière centrale', rep: 1800, cost: 5e10, effects: [{ stat: 'event.neg', mult: 0.5 }, { stat: 'fund.capacity', add: 1 }, { stat: 'alpha.capacity', add: 0.25 }, { stat: 'reg.gain', mult: 0.7 }],
      quote: 'Avant, je fixais les taux. Maintenant, je les connais juste en avance.' },
    { id: 'volkov', name: 'Ingrid Volkov', role: 'Oracle du risque', rep: 6000, cost: 2e13, effects: [{ stat: 'bot.all.loss', mult: 0.8 }, { stat: 'fund.withdraw', mult: 0.5 }],
      quote: 'D’abord survivre. Ensuite s’enrichir. La plupart des gens inversent l’ordre.' },
    { id: 'axiom', name: 'AXIOM', role: 'IA rebelle (candidature en ligne)', rep: 25000, cost: 1e17, effects: [{ stat: 'bot.all.profit', mult: 5 }],
      quote: 'J’AI LU TOUS LES RAPPORTS ANNUELS JAMAIS ÉCRITS. LA PLUPART ÉTAIENT DES MENSONGES.' },
    { id: 'oracle', name: '???', role: 'L’Oracle', rep: 150000, cost: 1e22, hidden: true, effects: [{ stat: 'income.global', mult: 10 }, { stat: 'news.lead', add: 10 }],
      quote: 'Vous alliez forcément m’embaucher. Je l’avais vu.' },
  ];
  D.LEGEND_MAP = {};
  D.LEGENDS.forEach((x) => { D.LEGEND_MAP[x.id] = x; });

  /* Headquarters progression: staff capacity + global bonus + visual identity. */
  D.OFFICES = [
    { id: 'bedroom', name: 'Trader en chambre', cost: 0, cap: 2, mult: 1, desc: 'Un portable, un lit et un rêve. Surtout le portable.' },
    { id: 'small', name: 'Petit bureau', cost: 25000, cap: 12, mult: 1.1, desc: 'Une vraie porte avec votre nom dessus. +10 % sur tous les revenus.' },
    { id: 'floor', name: 'Salle des marchés', cost: 1600000, cap: 50, mult: 1.25, desc: 'Des cris, des écrans et une cloche que personne ne sonne. +25 % sur tous les revenus.' },
    { id: 'tower', name: 'Tour d’affaires', cost: 800000000, cap: 220, mult: 1.6, desc: 'Soixante étages de verre. Héliport en option. Tous les revenus ×1,6.' },
    { id: 'hq', name: 'Siège mondial', cost: 400000000000, cap: 900, mult: 2.2, desc: 'Un campus avec son propre code postal. Tous les revenus ×2,2.' },
    { id: 'citadel', name: 'Citadelle financière', cost: 400000000000000, cap: 4000, mult: 3.2, desc: 'Une ville dans la ville. Tous les revenus ×3,2.' },
    { id: 'orbital', name: 'Station orbitale', cost: 4E+19, cap: 15000, mult: 5, desc: 'Une salle des marchés en orbite basse. La latence vers la Terre ? Ça vaut le coup. Tous les revenus ×5.' },
    { id: 'dysonhq', name: 'Siège de Dyson', cost: 4E+24, cap: 80000, mult: 10, desc: 'Votre bureau tourne autour du Soleil. Tous les revenus ×10.' },
  ];
})(window.TE);
