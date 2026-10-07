/* Achievements. Each unlocked achievement grants +2% to all income. hidden: shown as ??? until unlocked. */
(function (TE) {
  'use strict';
  const D = TE.Data;
  const A = [];
  const st = (s, k) => s.profile.stats[k] || 0;
  const rec = (s, k) => s.profile.records[k] || 0;
  const add = (id, cat, name, desc, check, hidden) => A.push({ id, cat, name, desc, check, hidden: !!hidden });

  // ---- Trading
  add('first_blood', 'Trading', 'Premier sang', 'Clôturez votre premier trade gagnant.', (s) => st(s, 'wins') >= 1);
  add('ten_wins', 'Trading', 'On prend le coup de main', 'Clôturez 10 trades gagnants.', (s) => st(s, 'wins') >= 10);
  add('hundred_wins', 'Trading', 'Aguerri', 'Clôturez 100 trades gagnants.', (s) => st(s, 'wins') >= 100);
  add('thousand_trades', 'Trading', 'Pilier du desk', 'Clôturez 1 000 trades manuels.', (s) => st(s, 'trades') >= 1000);
  add('short_seller', 'Trading', 'Vendeur à découvert', 'Clôturez un SHORT gagnant.', (s) => st(s, 'shortWins') >= 1);
  add('diamond_hands', 'Trading', 'Mains de diamant', 'Gardez une position 5 minutes et clôturez-la en profit.', (s) => rec(s, 'longestWinHold') >= 300);
  add('paper_hands', 'Trading', 'Mains de papier', 'Clôturez un trade moins de 2 secondes après l’avoir ouvert.', (s) => st(s, 'paperHands') >= 1, true);
  add('liquidated', 'Trading', 'Liquidé', 'Faites-vous liquider. Tout le monde y passe une fois.', (s) => st(s, 'liquidations') >= 1);
  add('liquidated10', 'Trading', 'Fan des appels de marge', 'Faites-vous liquider 10 fois.', (s) => st(s, 'liquidations') >= 10, true);
  add('lev10', 'Trading', 'Sous levier', 'Clôturez un trade gagnant avec un levier de x10 ou plus.', (s) => rec(s, 'maxLevWin') >= 10);
  add('lev100', 'Trading', 'Qu’est-ce qui pourrait mal tourner ?', 'Clôturez un trade gagnant à x100 ou plus.', (s) => rec(s, 'maxLevWin') >= 100);
  add('lev1000', 'Trading', 'Ce n’est absolument pas du casino', 'Clôturez un trade gagnant à x1000 ou plus.', (s) => rec(s, 'maxLevWin') >= 1000);
  add('streak5', 'Trading', 'En feu', 'Enchaînez une série de 5 trades gagnants.', (s) => rec(s, 'bestStreak') >= 5);
  add('streak10', 'Trading', 'Inarrêtable', 'Enchaînez une série de 10 trades gagnants.', (s) => rec(s, 'bestStreak') >= 10);
  add('streak25', 'Trading', 'Fais-moi confiance', 'Enchaînez une série de 25 trades gagnants.', (s) => rec(s, 'bestStreak') >= 25);
  add('crit1', 'Trading', 'Coup critique', 'Décrochez un profit critique.', (s) => st(s, 'crits') + st(s, 'critsBot') >= 1);
  add('crit50', 'Trading', 'Jackpot', 'Décrochez un profit critique ×50.', (s) => rec(s, 'biggestCrit') >= 50);
  add('bigfish', 'Trading', 'Gros poisson', 'Gagnez 1 000 $ sur un seul trade.', (s) => rec(s, 'bestTrade') >= 1e3);
  add('whale', 'Trading', 'Baleine', 'Gagnez 1 M$ sur un seul trade.', (s) => rec(s, 'bestTrade') >= 1e6);
  add('leviathan', 'Trading', 'Léviathan', 'Gagnez 1 milliard de dollars sur un seul trade.', (s) => rec(s, 'bestTrade') >= 1e9);
  add('kraken', 'Trading', 'Kraken', 'Gagnez 1 000 milliards de dollars sur un seul trade.', (s) => rec(s, 'bestTrade') >= 1e12);
  add('doubleup', 'Trading', 'Quitte ou double', 'Faites +100 % sur la marge d’un seul trade.', (s) => rec(s, 'bestPct') >= 1);
  add('tenbagger', 'Trading', 'Ten-bagger', 'Faites +1 000 % sur la marge d’un seul trade.', (s) => rec(s, 'bestPct') >= 10);
  add('bagholder', 'Trading', 'Porteur de valises', 'Clôturez un trade à -50 % ou pire sur la marge.', (s) => rec(s, 'worstPct') <= -0.5, true);
  add('sl_saved', 'Trading', 'Risque maîtrisé', 'Faites-vous sortir par votre propre Stop Loss.', (s) => st(s, 'slHits') >= 1);
  add('tp_hit', 'Trading', 'Planifiez votre trade', 'Atteignez un Take Profit.', (s) => st(s, 'tpHits') >= 1);
  add('diversified', 'Trading', 'Diversifié', 'Gagnez des trades dans 5 classes d’actifs différentes.', (s) => Object.keys(s.profile.records.classesWon || {}).length >= 5);
  add('pip_hunter', 'Trading', 'Chasseur de pips', 'Clôturez un trade Forex gagnant.', (s) => !!(s.profile.records.classesWon || {}).fx);
  add('big_short', 'Trading', 'The Big Short', 'Clôturez un SHORT gagnant pendant un krach ou une panique.', (s) => st(s, 'bigShort') >= 1);
  add('buy_dip', 'Trading', 'Acheter le creux', 'Gagnez sur un LONG ouvert pendant un krach, une panique ou une capitulation.', (s) => st(s, 'buyDip') >= 1);
  add('squeeze_victim', 'Trading', 'Essoré', 'Faites-vous liquider sur un SHORT pendant un short squeeze.', (s) => st(s, 'squeezed') >= 1, true);
  add('bank_of_mom', 'Trading', 'La banque de maman', 'Acceptez un prêt familial.', (s) => st(s, 'familyLoans') >= 1, true);
  add('limit_master', 'Trading', 'Chasseur patient', 'Faites exécuter 10 ordres limites ou stop.', (s) => st(s, 'ordersFilled') >= 10);

  // ---- Wealth
  const nw = [[1e3, 'nw_1k', 'Quatre chiffres'], [1e5, 'nw_100k', 'Six chiffres'], [1e6, 'nw_1m', 'Millionnaire'], [1e9, 'nw_1b', 'Milliardaire'],
    [1e12, 'nw_1t', 'Billionnaire'], [1e15, 'nw_1qa', 'Billiardaire'], [1e18, 'nw_1qi', 'Trillionnaire'], [1e24, 'nw_1sp', 'Bug d’argent infini'], [1e30, 'nw_1no', 'Post-pénurie']];
  nw.forEach(([v, id, name]) => add(id, 'Fortune', name, 'Atteignez une valeur nette de ' + TE.U.money(v, { dec: 0 }) + '.', (s) => rec(s, 'maxNW') >= v));
  const inc = [[1, 'inc_1', 'Revenu passif'], [1e3, 'inc_1k', 'Adieu le salaire'], [1e6, 'inc_1m', 'Planche à billets'],
    [1e9, 'inc_1b', 'Lance à incendie'], [1e12, 'inc_1t', 'Niagara'], [1e15, 'inc_1qa', 'Big Bang'], [1e20, 'inc_1e20', 'Mort thermique']];
  inc.forEach(([v, id, name]) => add(id, 'Fortune', name, 'Générez ' + TE.U.money(v, { dec: 0 }) + '/s de revenu passif.', (s) => rec(s, 'maxIncome') >= v));
  add('speedrun', 'Fortune', 'Speedrunner', 'Atteignez 1 M$ en moins de 12 minutes de partie.', (s) => rec(s, 'fastMillion') > 0 && rec(s, 'fastMillion') <= 720, true);

  // ---- Bots
  add('first_bot', 'Automatisation', 'L’automatisation commence', 'Déployez votre premier bot.', (s) => st(s, 'botsBought') >= 1);
  add('bots10', 'Automatisation', 'Botnet', 'Possédez 10 bots.', (s) => rec(s, 'maxBots') >= 10);
  add('bots100', 'Automatisation', 'La Machine', 'Possédez 100 bots.', (s) => rec(s, 'maxBots') >= 100);
  add('bots500', 'Automatisation', 'Skynet Lite', 'Possédez 500 bots.', (s) => rec(s, 'maxBots') >= 500);
  add('bots2000', 'Automatisation', 'Gelée grise', 'Possédez 2 000 bots.', (s) => rec(s, 'maxBots') >= 2000);
  add('fullstack', 'Automatisation', 'Quant full stack', 'Possédez au moins un exemplaire des 8 premiers types de bots.', (s) => rec(s, 'botTypes') >= 8);
  add('grade_epic', 'Automatisation', 'Code épique', 'Faites passer une flotte au grade Épique.', (s) => rec(s, 'bestGrade') >= 2);
  add('grade_legend', 'Automatisation', 'Code légendaire', 'Faites passer une flotte au grade Légendaire.', (s) => rec(s, 'bestGrade') >= 3);
  add('grade_quantum', 'Automatisation', 'Suprématie quantique', 'Faites passer une flotte au grade Quantique.', (s) => rec(s, 'bestGrade') >= 4);
  add('bot_crit', 'Automatisation', 'Chance de machine', 'Un bot décroche un profit critique.', (s) => st(s, 'critsBot') >= 1);
  add('kill_switch', 'Automatisation', 'Coupe-circuit', 'Mettez en pause un bot pendant qu’il bugue.', (s) => st(s, 'killSwitch') >= 1, true);
  add('million_trades', 'Automatisation', 'Un million de trades', 'Vos bots exécutent 1 000 000 de trades.', (s) => st(s, 'botTrades') >= 1e6);
  add('billion_trades', 'Automatisation', 'Quatre millions de trades par seconde', 'Vos bots exécutent 1 000 milliards de trades.', (s) => st(s, 'botTrades') >= 1e12);

  // ---- Firm
  add('first_research', 'Société', 'Curieux', 'Terminez votre première recherche.', (s) => st(s, 'researchDone') >= 1);
  add('research25', 'Société', 'Think tank', 'Terminez 25 projets de recherche.', (s) => st(s, 'researchDone') >= 25);
  add('research_all', 'Société', 'Omniscient', 'Terminez tout l’arbre de recherche en une seule partie.', (s) => rec(s, 'researchRun') >= TE.Data.RESEARCH.length);
  add('battlestation', 'Société', 'Poste de combat', 'Possédez 8 stations de trading.', (s) => (s.run.infra.station || 0) >= 8);
  add('serverfarm', 'Société', 'Ferme de serveurs', 'Possédez 10 centres de données.', (s) => (s.run.infra.datacenter || 0) >= 10);
  add('lightspeed', 'Société', 'Vitesse de la lumière', 'Descendez sous 1 microseconde de latence.', (s) => rec(s, 'minLatency') > 0 && rec(s, 'minLatency') < 0.001);
  add('quantum_pc', 'Société', 'Saut quantique', 'Construisez un ordinateur quantique.', (s) => (s.run.infra.quantumpc || 0) >= 1);
  add('first_hire', 'Société', 'Première embauche', 'Embauchez votre premier employé.', (s) => st(s, 'staffHired') >= 1);
  add('staff100', 'Société', 'Grande entreprise', 'Comptez 100 employés.', (s) => rec(s, 'maxStaff') >= 100);
  add('staff1000', 'Société', 'Mégacorporation', 'Comptez 1 000 employés.', (s) => rec(s, 'maxStaff') >= 1000);
  add('legend', 'Société', 'Chasseur de légendes', 'Embauchez un employé légendaire.', (s) => st(s, 'legends') >= 1);
  add('office_tower', 'Société', 'Skyline', 'Emménagez dans une tour d’affaires.', (s) => rec(s, 'bestOffice') >= 3);
  add('office_citadel', 'Société', 'La Citadelle', 'Bâtissez une citadelle financière.', (s) => rec(s, 'bestOffice') >= 5);

  // ---- Fund
  add('founder', 'Fonds', 'Fondateur', 'Fondez votre propre hedge fund.', (s) => st(s, 'fundsFounded') >= 1);
  add('aum1b', 'Fonds', 'Un milliard sous gestion', 'Atteignez 1 milliard de dollars d’AUM.', (s) => rec(s, 'maxAUM') >= 1e9);
  add('aum1t', 'Fonds', 'Club des mille milliards', 'Atteignez 1 000 milliards de dollars d’AUM.', (s) => rec(s, 'maxAUM') >= 1e12);
  add('aum1qa', 'Fonds', 'Système bancaire de l’ombre', 'Atteignez 1 billiard de dollars d’AUM.', (s) => rec(s, 'maxAUM') >= 1e15);
  add('two_twenty', 'Fonds', '2 et 20', 'Encaissez 1 M$ de frais de fonds.', (s) => st(s, 'fees') >= 1e6);
  add('sovereign', 'Fonds', 'Confiance souveraine', 'Un fonds souverain investit chez vous.', (s) => st(s, 'sovereignIn') >= 1);
  add('bank_run', 'Fonds', 'Panique bancaire', 'Perdez la moitié de vos AUM à cause des retraits.', (s) => st(s, 'bankRun') >= 1, true);
  add('vip_done', 'Fonds', 'Gants blancs', 'Remplissez un mandat VIP.', (s) => st(s, 'vipDone') >= 1);

  // ---- Empire
  add('acquirer', 'Empire', 'Acquéreur', 'Réalisez votre première acquisition.', (s) => st(s, 'acquisitions') >= 1);
  add('conglomerate', 'Empire', 'Conglomérat', 'Réalisez 8 acquisitions.', (s) => st(s, 'acquisitions') >= 8);
  add('hostile', 'Empire', 'OPA hostile', 'Rachetez une firme rivale.', (s) => st(s, 'rivalsBought') >= 1);
  add('unicorn', 'Empire', 'Chasseur de licornes', 'Un deal de capital-risque rapporte ×50 ou plus.', (s) => rec(s, 'bestVC') >= 50);
  add('decacorn', 'Empire', 'Décacorne', 'Un deal de capital-risque rapporte ×500.', (s) => rec(s, 'bestVC') >= 500, true);
  add('global5', 'Empire', 'Présence mondiale', 'Ouvrez 5 bureaux internationaux.', (s) => rec(s, 'offices') >= 5);
  add('offworld', 'Empire', 'Interplanétaire', 'Ouvrez un bureau hors de la Terre.', (s) => st(s, 'offworld') >= 1);
  add('top100', 'Empire', 'Top 100', 'Entrez dans le top 100 du classement mondial.', (s) => rec(s, 'bestRank') > 0 && rec(s, 'bestRank') <= 100);
  add('top10', 'Empire', 'Top 10', 'Entrez dans le top 10.', (s) => rec(s, 'bestRank') > 0 && rec(s, 'bestRank') <= 10);
  add('number_one', 'Empire', 'Numéro un', 'Devenez la plus grande firme financière de la planète.', (s) => rec(s, 'bestRank') === 1);
  add('mover', 'Empire', 'Faiseur de marché', 'Atteignez 1 % d’influence de marché.', (s) => rec(s, 'maxInfluence') >= 0.01);
  add('systemic', 'Empire', 'D’importance systémique', 'Atteignez 10 % d’influence de marché.', (s) => rec(s, 'maxInfluence') >= 0.10);
  add('tbtf', 'Empire', 'Too Big To Fail', 'Trop gros pour tomber : atteignez 50 % d’influence de marché.', (s) => rec(s, 'maxInfluence') >= 0.5);
  add('the_economy', 'Empire', 'L’économie, c’est vous', 'Atteignez 90 % d’influence de marché.', (s) => rec(s, 'maxInfluence') >= 0.9);

  // ---- Events
  add('storm_chaser', 'Événements', 'Chasseur de tempêtes', 'Vivez 25 événements de marché.', (s) => st(s, 'events') >= 25);
  add('crisis1', 'Événements', 'Survivant de crise', 'Survivez à une crise économique.', (s) => st(s, 'crisesSurvived') >= 1);
  add('crisis_perfect', 'Événements', 'Tueur de boss', 'Remplissez tous les objectifs d’une crise.', (s) => st(s, 'crisisPerfect') >= 1);
  add('crisis_all', 'Événements', 'Toutes les tempêtes', 'Triomphez de 5 crises différentes.', (s) => Object.keys(s.profile.records.crisesBeaten || {}).length >= 5);
  add('opportunist', 'Événements', 'Opportuniste', 'Saisissez 10 opportunités.', (s) => st(s, 'opportunities') >= 10);
  add('golden_touch', 'Événements', 'Toucher d’or', 'Encaissez un profit sur un trade légendaire.', (s) => st(s, 'legendaryWins') >= 1);
  add('contractor', 'Événements', 'Prestataire', 'Remplissez 10 contrats.', (s) => st(s, 'contracts') >= 10);
  add('contractor100', 'Événements', 'Mercenaire', 'Remplissez 100 contrats.', (s) => st(s, 'contracts') >= 100);
  add('daily1', 'Événements', 'Train-train quotidien', 'Jouez un défi de marché quotidien.', (s) => st(s, 'dailyPlayed') >= 1);
  add('daily_gold', 'Événements', 'Journée en or', 'Obtenez Or ou mieux à un défi quotidien.', (s) => rec(s, 'dailyBestTier') >= 3);
  add('daily_streak', 'Événements', 'Animal d’habitude', 'Enchaînez le défi quotidien 5 jours de suite.', (s) => rec(s, 'dailyStreak') >= 5);

  // ---- Prestige
  add('p1', 'Prestige', 'Table rase', 'Liquidez votre empire pour la première fois.', (s) => s.profile.prestige.p1 >= 1);
  add('p1x10', 'Prestige', 'Fondateur en série', 'Liquidez 10 fois.', (s) => s.profile.prestige.p1 >= 10);
  add('alpha1000', 'Prestige', 'Alpha du Centaure', 'Cumulez 1 000 Alpha au total.', (s) => s.profile.prestige.alphaTotal >= 1000);
  add('p2', 'Prestige', 'Dynastie', 'Établissez un Legacy de marché.', (s) => s.profile.prestige.p2 >= 1);
  add('p3', 'Prestige', 'Singularité', 'Atteignez la Singularité financière.', (s) => s.profile.prestige.p3 >= 1);
  add('challenger', 'Prestige', 'Challenger', 'Terminez une partie de défi.', (s) => Object.keys(s.profile.prestige.challenges).length >= 1);
  add('masochist', 'Prestige', 'Masochiste', 'Terminez le défi SANS BOTS.', (s) => !!s.profile.prestige.challenges.nobots, true);

  // ---- Secret / fun
  add('sec', 'Secrets', 'L’AMF aimerait connaître votre position', 'Manipulez les marchés une fois de trop.', (s) => st(s, 'manipulation') >= 10, true);
  add('night_owl', 'Secrets', 'Oiseau de nuit', 'Tradez entre 2 h et 5 h du matin.', (s) => st(s, 'nightTrades') >= 1, true);
  add('touch_grass', 'Secrets', 'Va toucher de l’herbe', 'Revenez après plus de 24 heures d’absence.', (s) => st(s, 'longAway') >= 1, true);
  add('konami', 'Secrets', 'Code d’initié', 'Vous connaissez le code.', (s) => st(s, 'konami') >= 1, true);
  add('stonks', 'Secrets', 'Stonks', 'Ça ne fait que monter.', (s) => st(s, 'stonks') >= 1, true);
  add('hodl', 'Secrets', 'HODL', 'Gardez un LONG crypto pendant tout un krach et clôturez quand même dans le vert.', (s) => st(s, 'hodl') >= 1, true);
  add('tulip', 'Secrets', 'Tulipomanie', 'Clôturez un LONG au sommet d’une bulle (+40 % ou plus sur un memecoin).', (s) => st(s, 'tulip') >= 1, true);
  add('loyal', 'Secrets', 'Client fidèle', 'Jouez 10 heures au total.', (s) => s.profile.playtime >= 36000, true);
  add('insider_taken', 'Secrets', 'Fais-moi confiance (version légale)', 'Suivez un tuyau anonyme et passez entre les gouttes.', (s) => st(s, 'insiderClean') >= 1, true);

  // ---- V2: the living world
  add('headline', 'Monde', 'À la une', 'Faites parler de vous dans le fil d’actualités.', (s) => st(s, 'headlines') >= 1);
  add('spotlight', 'Monde', 'Sous les projecteurs', 'Atteignez 70 d’attention de marché.', (s) => rec(s, 'maxAtt') >= 70);
  add('massive', 'Monde', 'Marché trop petit', 'Passez un ordre à l’impact MASSIF.', (s) => st(s, 'massiveOrders') >= 1);
  add('whale_me', 'Monde', 'La baleine, c’est moi', 'Provoquez un short squeeze.', (s) => st(s, 'squeezeMe') >= 1);
  add('cascade_me', 'Monde', 'Effet domino', 'Déclenchez une cascade de liquidations.', (s) => st(s, 'cascadeMe') >= 1, true);
  add('fined', 'Monde', 'Le prix de la gloire', 'Recevez une amende des régulateurs.', (s) => st(s, 'fines') >= 1, true);

  D.ACHIEVEMENTS = A;
  D.ACH_MAP = {};
  A.forEach((a) => { D.ACH_MAP[a.id] = a; });
  D.ACH_BONUS = 0.02;
})(window.TE);
