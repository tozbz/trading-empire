/* Fund & Empire data: investors, VIP mandates, acquisitions, divisions, global offices, rivals, ventures, world map. */
(function (TE) {
  'use strict';
  const D = TE.Data;

  /* ---------------- FUND ---------------- */
  D.FUND_FOUND_COST = 2.5e6;
  D.FUND_UNLOCK_EARN = 8e6;
  D.FUND_YEAR = 300; // seconds per fund "year" (accelerated time)
  D.FUND_BASE_CAP = 1.5; // fund capacity = bot capital × this × mods

  D.INVESTOR_CLASSES = [
    { id: 'retail', name: 'Particuliers', rep: 0, rate: 1 / 9, ticket: [0.004, 0.012], tol: 0.06, wspeed: 0.08, clients: [40, 400], color: '#8ea3bf',
      names: ['particuliers via votre appli', 'abonnés d’un YouTubeur finance', 'membres d’un forum de trading', 'épargnants d’un robo-advisor'] },
    { id: 'hnw', name: 'Grandes fortunes', rep: 60, rate: 1 / 20, ticket: [0.015, 0.04], tol: 0.10, wspeed: 0.05, clients: [1, 4], color: '#19e6ff',
      names: ['Un chirurgien à la retraite', 'Un pionnier de la crypto', 'Une fondatrice tech qui vient de revendre sa boîte', 'Un chef étoilé', 'Une sportive professionnelle', 'Un romancier reclus'] },
    { id: 'family', name: 'Family offices', rep: 250, rate: 1 / 38, ticket: [0.04, 0.09], tol: 0.14, wspeed: 0.03, clients: [1, 1], color: '#6cf0a0',
      names: ['Le family office Van der Berg', 'Castellano Holdings', 'Le trust Okonkwo', 'Lindqvist Family Capital', 'La maison Aranda'] },
    { id: 'inst', name: 'Institutionnels', rep: 1000, rate: 1 / 60, ticket: [0.08, 0.16], tol: 0.09, wspeed: 0.02, clients: [1, 1], color: '#a77bff',
      names: ['La caisse de retraite des enseignants des Grands Lacs', 'Le fonds de pension Glacier Nordique', 'Pacific Mutual Life', 'La fondation de l’université d’Harbor', 'Le groupe Assurances Alpines'] },
    { id: 'sovereign', name: 'Fonds souverains', rep: 5000, rate: 1 / 110, ticket: [0.18, 0.35], tol: 0.2, wspeed: 0.015, clients: [1, 1], color: '#ffb627',
      names: ['Le fonds souverain du royaume d’Azurie', 'Le fonds pétrolier de Norvalis', 'Le Trésor de la République de Méridia', 'L’autorité d’investissement Gulf Horizon'] },
    { id: 'planetary', name: 'Retraites planétaires', rep: 80000, rate: 1 / 140, ticket: [0.3, 0.5], tol: 0.25, wspeed: 0.01, clients: [1, 1], color: '#ff4fd8', era: 6,
      names: ['La caisse de retraite coloniale martienne', 'Le trust de retraite des travailleurs lunaires', 'La mutuelle des mineurs de la Ceinture'] },
  ];
  D.INVESTOR_MAP = {};
  D.INVESTOR_CLASSES.forEach((c) => { D.INVESTOR_MAP[c.id] = c; });

  D.VIP_CLIENTS = ['Le family office du prince Kaveh', 'La veuve Henderson', 'Une baleine crypto anonyme', 'La banque privée Gnome & Cie',
    'Le trust d’une rockstar retraitée', 'Un fondateur de la Silicon Valley', 'La fondation du monastère', 'Un milliardaire masqué', 'Le Trésor royal d’Azurie',
    'Le Dr Félix Moreau (prix Nobel)', 'Le ministère de la Finance insolite', 'Un robot très patient'];

  /* ---------------- ACQUISITIONS ---------------- */
  D.ACQUISITIONS = [
    { id: 'pixeltrade', name: 'PixelTrade', type: 'Appli de trading grand public', cost: 1.5e9, effects: [{ stat: 'fund.inflow', add: 0.5 }, { stat: 'rep.gain', add: 0.25 }], desc: 'Trading sans commission ! (Vos clients sont le produit.)' },
    { id: 'swiftfill', name: 'Swiftfill Brokerage', type: 'Courtier', cost: 6e9, effects: [{ stat: 'manual.fee', mult: 0.5 }, { stat: 'bot.all.fee', mult: 0.7 }], desc: 'Possédez le courtier, fixez les frais.' },
    { id: 'northwind', name: 'Northwind Data', type: 'Fournisseur de données', cost: 1.5e10, effects: [{ stat: 'research.rate', mult: 1.5 }, { stat: 'news.lead', add: 3 }, { flag: 'cal.range' }, { flag: 'cal.consensus' }], desc: 'Chaque prix, chaque tick, partout. Un poil avant tout le monde — y compris le consensus et la fourchette des annonces.' },
    { id: 'coldline', name: 'Coldline Fiber', type: 'Infrastructure', cost: 4e10, effects: [{ stat: 'latency', mult: 0.5 }, { stat: 'bot.hft.profit', mult: 2 }], desc: 'Possède la moitié des câbles sous-marins que vous louez.' },
    { id: 'meridian', name: 'Meridian Bank', type: 'Banque', cost: 8e10, unlock: 'bank', effects: [], desc: 'Une banque de 140 ans. Livrée avec halls en marbre et une division.' },
    { id: 'omnix', name: 'OmniX Exchange', type: 'Bourse', cost: 3e11, unlock: 'exchange', effects: [{ stat: 'bot.all.fee', mult: 0.8 }, { stat: 'manual.fee', mult: 0.8 }, { stat: 'alpha.capacity', add: 0.25 }], desc: 'C’est vous la banque, désormais. Et la banque gagne toujours.' },
    { id: 'lattice', name: 'Lattice Market Makers', type: 'Market maker', cost: 8e11, unlock: 'mm', effects: [{ stat: 'spread', mult: 0.7 }, { stat: 'alpha.capacity', add: 0.25 }], desc: 'Cotez à l’achat et à la vente sur tous les marchés de la planète.' },
    { id: 'foundry', name: 'Foundry Ventures', type: 'Capital-risque', cost: 2e12, unlock: 'vc', effects: [], desc: 'Sand Hill Road, version maléfique.' },
    { id: 'atlas', name: 'Atlas Reinsurance', type: 'Assureur', cost: 2e13, effects: [{ stat: 'event.neg', mult: 0.7 }, { stat: 'bot.tail', mult: 0.5 }], desc: 'Assure les assureurs. Et maintenant, vous.' },
    { id: 'sigma', name: 'Sigma Clearing House', type: 'Chambre de compensation', cost: 8e13, effects: [{ flag: 'liq.refund' }, { stat: 'fund.withdraw', mult: 0.8 }, { stat: 'reg.gain', mult: 0.9 }], desc: 'Chaque trade de la planète se règle chez vous.' },
    { id: 'prometheus', name: 'Laboratoire IA Prometheus', type: 'Recherche en IA', cost: 5e14, unlock: 'ailab', effects: [], desc: 'A volé le feu aux dieux. Vole désormais l’alpha aux marchés.' },
    { id: 'ratings', name: 'Agence de notation Triple-A', type: 'Agence de notation', cost: 3e15, effects: [{ stat: 'rep.gain', mult: 2 }, { stat: 'fund.inflow', mult: 2 }, { stat: 'reg.gain', mult: 0.85 }], desc: 'Bonne nouvelle : vous êtes noté AAA. Par vous-même.' },
    { id: 'newsnet', name: 'GlobalNewsNet', type: 'Médias', cost: 2e16, effects: [{ stat: 'news.lead', add: 5 }, { stat: 'influence', mult: 1.5 }, { stat: 'alpha.capacity', add: 0.25 }, { stat: 'att.gain', mult: 1.25 }], desc: 'Vous ne lisez plus l’actualité. Vous l’écrivez. Vos coups d’éclat font la une.' },
    { id: 'orbitalclear', name: 'Orbital Clearing Corp', type: 'Finance spatiale', cost: 5e18, unlock: 'orbital', effects: [], desc: 'La chambre de compensation de la ceinture d’astéroïdes.' },
    { id: 'centralbank', name: 'Une petite banque centrale', type: 'Autorité monétaire', cost: 1e21, effects: [{ stat: 'macro.bull', add: 1 }, { stat: 'div.all', mult: 2 }], desc: 'La politique monétaire, en tant que service.' },
    { id: 'chronos', name: 'Institut Chronos', type: 'Recherche temporelle', cost: 1e24, unlock: 'temporal', effects: [], desc: 'Ils affirment avoir inventé le voyage dans le temps. Leurs rendements confirment.' },
    { id: 'dysonworks', name: 'Dyson Works', type: 'Ingénierie stellaire', cost: 1e27, effects: [{ stat: 'div.all', mult: 5 }, { stat: 'income.global', mult: 2 }], desc: 'Construit des mégastructures. Accepte les paiements en étoiles.' },
  ];
  D.ACQ_MAP = {};
  D.ACQUISITIONS.forEach((a) => { D.ACQ_MAP[a.id] = a; });

  /* ---------------- DIVISIONS (empire income streams) ---------------- */
  D.DIVISIONS = [
    { id: 'bank', name: 'Banque de détail Meridian', icon: '⌂', cost: 5e10, growth: 1.12, income: 5e6, color: '#e8c15a',
      flavor: (lvl) => 'Dépôts : ' + TE.U.money(lvl * 2.5e11), desc: 'Empruntez court, prêtez long, encaissez l’écart. Solide comme un roc.' },
    { id: 'exchange', name: 'Bourse OmniX', icon: '⇅', cost: 2e11, growth: 1.13, income: 1.4e7, color: '#19e6ff', activity: true,
      flavor: (lvl) => 'Volume quotidien : ' + TE.U.money(lvl * 4e12), desc: 'Des frais sur chaque trade de votre plateforme. Marchés plus actifs = plus de revenus.' },
    { id: 'mm', name: 'Market making Lattice', icon: '⇵', cost: 6e11, growth: 1.13, income: 3.5e7, color: '#6cf0a0', volatility: true,
      flavor: (lvl) => TE.U.int(lvl * 1200) + ' carnets cotés', desc: 'Capte le spread. La volatilité multiplie les revenus.' },
    { id: 'vc', name: 'Foundry Ventures', icon: '✦', cost: 1.5e12, growth: 1.14, income: 6e7, color: '#ff7ac8',
      flavor: (lvl) => (3 + Math.floor(lvl / 10)) + ' places de deals', desc: 'Frais de gestion du fonds de capital-risque. Tous les 10 niveaux : +1 place de deal.' },
    { id: 'ailab', name: 'Laboratoire IA Prometheus', icon: '◉', cost: 5e14, growth: 1.15, income: 5e9, color: '#a77bff',
      effects: [{ stat: 'research.rate', add: 0.05 }, { stat: 'bot.ai.profit', add: 0.03 }, { stat: 'bot.swarm.profit', add: 0.03 }],
      flavor: (lvl) => TE.U.int(lvl * 4) + ' modèles de pointe', desc: 'Vend des licences de modèles au monde entier. Chaque niveau : recherche +5 %, bots IA +3 %.' },
    { id: 'orbital', name: 'Bourse orbitale', icon: '◌', cost: 5e18, growth: 1.16, income: 2e13, color: '#00ffd5', activity: true,
      flavor: (lvl) => TE.U.int(lvl * 3) + ' habitats cotés', desc: 'Chaque caillou du système solaire, négociable.' },
    { id: 'temporal', name: 'Desk d’arbitrage temporel', icon: '⧗', cost: 1e24, growth: 1.17, income: 2e18, color: '#ff4fd8', volatility: true,
      flavor: (lvl) => 'Δt = ' + (lvl * 0.7).toFixed(1).replace('.', ',') + ' jours', desc: 'Achète hier, vend demain. Les physiciens sont furieux.' },
  ];
  D.DIV_MAP = {};
  D.DIVISIONS.forEach((d) => { D.DIV_MAP[d.id] = d; });

  /* ---------------- GLOBAL OFFICES (world map) ---------------- */
  D.CITIES = [
    { id: 'nyc', name: 'New York', lat: 40.7, lon: -74, cost: 0, hq: true, effects: [], desc: 'Siège social.' },
    { id: 'london', name: 'Londres', lat: 51.5, lon: -0.1, cost: 3e9, effects: [{ stat: 'income.global', add: 0.1 }, { stat: 'fund.inflow', add: 0.2 }], desc: 'La capitale mondiale du Forex.' },
    { id: 'chicago', name: 'Chicago', lat: 41.9, lon: -87.6, cost: 8e9, effects: [{ stat: 'manual.access', mult: 2 }, { stat: 'bot.all.speed', add: 0.1 }], desc: 'Corbeilles de futures et fibre rapide.' },
    { id: 'tokyo', name: 'Tokyo', lat: 35.7, lon: 139.7, cost: 2e10, effects: [{ stat: 'bot.all.capital', add: 0.2 }], desc: 'Carry traders et géants discrets.' },
    { id: 'hongkong', name: 'Hong Kong', lat: 22.3, lon: 114.2, cost: 5e10, effects: [{ stat: 'bot.all.profit', add: 0.2 }], desc: 'La porte d’entrée des capitaux asiatiques.' },
    { id: 'singapore', name: 'Singapour', lat: 1.35, lon: 103.8, cost: 1.2e11, effects: [{ stat: 'fund.capacity', add: 0.2 }], desc: 'Le carrefour de la richesse en Orient.' },
    { id: 'frankfurt', name: 'Francfort', lat: 50.1, lon: 8.7, cost: 3e11, effects: [{ stat: 'div.all', add: 0.25 }], desc: 'Le cœur bancaire de l’Europe.' },
    { id: 'zurich', name: 'Zurich', lat: 47.4, lon: 8.5, cost: 8e11, effects: [{ stat: 'fund.withdraw', mult: 0.8 }, { stat: 'fund.capacity', add: 0.25 }], desc: 'Argent discret, coffres profonds.' },
    { id: 'dubai', name: 'Dubaï', lat: 25.2, lon: 55.3, cost: 2e12, effects: [{ stat: 'fund.inflow', add: 0.5 }], desc: 'L’argent souverain en numéro abrégé.' },
    { id: 'shanghai', name: 'Shanghai', lat: 31.2, lon: 121.5, cost: 2e13, effects: [{ stat: 'bot.all.capital', add: 0.3 }], desc: 'L’autre moitié de l’économie mondiale.' },
    { id: 'mumbai', name: 'Bombay', lat: 19.1, lon: 72.9, cost: 6e13, effects: [{ stat: 'research.rate', add: 0.3 }], desc: 'Des ingénieurs. Tellement d’ingénieurs.' },
    { id: 'saopaulo', name: 'São Paulo', lat: -23.5, lon: -46.6, cost: 2e14, effects: [{ stat: 'income.global', add: 0.15 }], desc: 'Le moteur financier de l’Amérique latine.' },
    { id: 'lagos', name: 'Lagos', lat: 6.5, lon: 3.4, cost: 6e14, effects: [{ stat: 'div.all', add: 0.3 }], desc: 'Le marché à la croissance la plus rapide de la planète.' },
    { id: 'sydney', name: 'Sydney', lat: -33.9, lon: 151.2, cost: 2e15, effects: [{ stat: 'offline.eff', add: 0.1 }, { stat: 'income.global', add: 0.1 }], desc: 'Le premier marché à ouvrir chaque jour.' },
    { id: 'toronto', name: 'Toronto', lat: 43.7, lon: -79.4, cost: 6e15, effects: [{ stat: 'rep.gain', add: 0.3 }], desc: 'Des géants de la retraite et de l’alpha au sirop d’érable.' },
    { id: 'luna', name: 'Base lunaire Tycho', short: 'LUNE', offworld: true, slot: 0, cost: 1e20, era: 6, effects: [{ stat: 'income.global', mult: 2 }], desc: 'De l’hélium-3 et 1,3 seconde de latence vers la Terre.' },
    { id: 'mars', name: 'Colonie martienne Arès', short: 'MARS', offworld: true, slot: 1, cost: 1e23, era: 6, effects: [{ stat: 'income.global', mult: 3 }], desc: 'La première salle des marchés interplanétaire.' },
    { id: 'ceres', name: 'Station Cérès', short: 'CÉRÈS', offworld: true, slot: 2, cost: 1e26, era: 7, effects: [{ stat: 'income.global', mult: 5 }], desc: 'La chambre de compensation de la ceinture d’astéroïdes.' },
  ];
  D.CITY_MAP = {};
  D.CITIES.forEach((c) => { D.CITY_MAP[c.id] = c; });

  /* ---------------- RIVALS (simulated leaderboard) ---------------- */
  D.RIVALS = [
    { id: 'helix', name: 'Helix Capital', value: 4e9, growth: 0.00022, era: 1, effects: [{ stat: 'fund.capacity', add: 0.5 }], style: 'Macro systématique' },
    { id: 'titan', name: 'Titan Quant', value: 2.5e10, growth: 0.0002, era: 1, effects: [{ stat: 'bot.all.winrate', add: 0.02 }], style: 'Actions quant' },
    { id: 'apex', name: 'Apex Markets', value: 1.2e11, growth: 0.0002, era: 1, effects: [{ stat: 'bot.all.capital', mult: 1.5 }], style: 'Market making' },
    { id: 'meridianp', name: 'Meridian Partners', value: 6e11, growth: 0.00018, era: 1, effects: [{ stat: 'div.all', mult: 1.5 }], style: 'Multi-stratégies' },
    { id: 'obsidian', name: 'Obsidian Quant', value: 3e12, growth: 0.00018, era: 1, effects: [{ stat: 'bot.hft.profit', mult: 3 }], style: 'HFT' },
    { id: 'silverheron', name: 'Silver Heron AM', value: 1.5e13, growth: 0.00016, era: 1, effects: [{ stat: 'fund.inflow', mult: 2 }], style: 'Gestion d’actifs' },
    { id: 'blackstone', name: 'Blackstone Dynamics', value: 8e13, growth: 0.00015, era: 1, effects: [{ stat: 'income.global', mult: 1.5 }], style: 'Tout' },
    { id: 'northstar', name: 'Northstar Sovereign', value: 4e14, growth: 0.00014, era: 1, effects: [{ stat: 'fund.capacity', add: 1 }], style: 'Capital souverain' },
    { id: 'ouroboros', name: 'Collectif IA Ouroboros', value: 5e16, growth: 0.00025, era: 5, effects: [{ stat: 'bot.all.profit', mult: 3 }], style: 'IA autonome' },
    { id: 'martian', name: 'Autorité des marchés martiens', value: 1e20, growth: 0.00022, era: 6, effects: [{ stat: 'div.all', mult: 3 }], style: 'Interplanétaire' },
    { id: 'entity', name: 'L’Entité', value: 1e24, growth: 0.0003, era: 7, effects: [{ stat: 'income.global', mult: 5 }], style: '???' },
  ];
  D.RIVAL_MAP = {};
  D.RIVALS.forEach((r) => { D.RIVAL_MAP[r.id] = r; });
  D.RIVAL_POPULATION = 9600;

  /* ---------------- VENTURE ---------------- */
  /* French startup names: patterns with {n} (plural nouns; only gender-invariant adjectives, so no agreement issues) */
  D.VC_PREFIX = ['Uber pour {n}', '{n} par IA', '{n} quantiques', 'Décentralisation des {n}', '{n} sur blockchain', 'Smart {n}', 'Métavers des {n}', '{n} Hyperloop',
    '{n} en abonnement', '{n} neutres en carbone', 'Gamification des {n}', '{n} autonomes', '{n} holographiques', '{n} à la demande'];
  D.VC_NOUN = ['chiens', 'grille-pain', 'cuillères', 'lessives', 'cours de yoga', 'chaussettes', 'déclarations d’impôts', 'plantes vertes', 'places de parking', 'matelas',
    'avocats', 'sandwichs', 'mamies', 'prévisions météo', 'kombuchas', 'terrains lunaires', 'nuages', 'obsèques', 'vélos', 'frigos', 'dentistes', 'abeilles', 'parapluies', 'pigeons'];
  D.VC_SUFFIX = ['', '', '', ' as a Service', ' 2.0', ' DAO', ' Pro', ' X', ' Labs', '.ai'];
  D.VC_SECTORS = ['FinTech', 'BioTech', 'DeepTech', 'Grand public', 'Climat', 'Spatial', 'IA', 'Crypto'];
  /* outcome distribution: [multiple, weight] */
  D.VC_OUTCOMES = [[0, 55], [0.5, 15], [1.5, 14], [3, 10], [10, 4.9], [50, 1], [500, 0.1]];

  /* ---------------- WORLD MAP (coarse land ranges per latitude row, degrees) ---------------- */
  D.WORLD_ROWS = [
    [78, [[-120, -65], [-70, -20], [12, 28], [50, 65], [90, 110], [135, 150]]],
    [73, [[-125, -70], [-58, -20], [52, 60], [70, 140], [140, 160]]],
    [68, [[-165, -140], [-140, -65], [-52, -25], [15, 30], [30, 180]]],
    [63, [[-165, -60], [-50, -42], [-22, -14], [5, 30], [30, 180]]],
    [58, [[-158, -135], [-135, -95], [-78, -60], [-6, -2], [5, 25], [25, 160]]],
    [53, [[-130, -56], [-10, 2], [3, 40], [40, 140], [155, 162]]],
    [48, [[-125, -53], [-5, 40], [40, 135], [140, 145]]],
    [43, [[-124, -70], [-9, 3], [8, 28], [40, 132], [140, 145]]],
    [38, [[-122, -76], [-9, -1], [12, 26], [26, 75], [75, 122], [126, 129], [132, 141]]],
    [33, [[-118, -80], [-10, 32], [35, 60], [60, 122], [130, 135]]],
    [28, [[-115, -81], [-15, 34], [35, 62], [68, 122]]],
    [23, [[-110, -97], [-84, -75], [-16, 36], [39, 59], [70, 120]]],
    [18, [[-105, -88], [-17, 38], [42, 55], [73, 85], [95, 110], [120, 125]]],
    [13, [[-92, -83], [-17, 43], [75, 80], [98, 109], [120, 125]]],
    [8, [[-83, -60], [-13, 48], [80, 81], [100, 104], [122, 126]]],
    [3, [[-80, -50], [8, 42], [95, 118]]],
    [-2, [[-80, -45], [9, 41], [100, 120], [132, 150]]],
    [-7, [[-79, -35], [12, 40], [106, 115], [138, 150]]],
    [-12, [[-77, -37], [13, 40], [44, 50], [130, 142]]],
    [-17, [[-72, -39], [12, 38], [44, 50], [122, 146]]],
    [-22, [[-70, -41], [14, 35], [44, 48], [114, 150]]],
    [-27, [[-70, -48], [15, 32], [114, 153]]],
    [-32, [[-71, -52], [18, 30], [116, 152]]],
    [-37, [[-72, -57], [140, 150], [174, 178]]],
    [-42, [[-73, -63], [145, 148], [170, 175]]],
    [-48, [[-75, -66], [167, 170]]],
  ];
})(window.TE);
