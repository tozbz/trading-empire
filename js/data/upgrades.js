/* One-time upgrades. Effects use the modifier engine:
 *   { stat, add }  additive % within the "Upgrades" category
 *   { stat, mult } multiplicative factor
 *   { flag }       feature flag (indicators, orders, assets, leverage tiers, abilities...)
 * req: { earn, up, bot:[id,n], fund, empire, era, flag }
 */
(function (TE) {
  'use strict';
  const D = TE.Data;
  const U = [];
  const add = (o) => U.push(o);

  /* ---------------- TRADING (manual) ---------------- */
  add({ id: 'lev2', cat: 'trading', name: 'Compte sur marge', cost: 40, req: { earn: 1 }, effects: [{ flag: 'lev.2' }], desc: 'Débloque le levier x2. Les gains comme les pertes doublent.' });
  add({ id: 'journal', cat: 'trading', name: 'Journal de trading', cost: 15, req: { earn: 1 }, effects: [{ stat: 'manual.profit', add: 0.8 }], desc: 'Notez chaque trade. Tirez-en des leçons. Enfin, en général.' });
  add({ id: 'sma', cat: 'trading', name: 'Moyennes mobiles', cost: 60, req: { earn: 10 }, effects: [{ flag: 'ind.sma' }], desc: 'Superpose les SMA 20 et 50. Quand la rapide croise la lente, il se passe des choses.' });
  add({ id: 'lev3', cat: 'trading', name: 'Levier x3', cost: 100, req: { up: 'lev2' }, effects: [{ flag: 'lev.3' }], desc: 'Débloque le levier x3.' });
  add({ id: 'sltp', cat: 'trading', name: 'Ordres de protection', cost: 120, req: { earn: 60 }, effects: [{ flag: 'ord.sltp' }], desc: 'Ordres Stop Loss et Take Profit. Déplacez les lignes directement sur le graphique.' });
  add({ id: 'patterns', cat: 'trading', name: 'Figures chartistes 101', cost: 150, req: { up: 'journal' }, effects: [{ stat: 'manual.profit', add: 0.8 }], desc: 'Tête-épaules, tasse avec anse et autres friandises.' });
  add({ id: 'lev5', cat: 'trading', name: 'Levier x5', cost: 350, req: { up: 'lev3' }, effects: [{ flag: 'lev.5' }], desc: 'Débloque le levier x5. Les lignes de liquidation se rapprochent.' });
  add({ id: 'bollinger', cat: 'trading', name: 'Bandes de Bollinger', cost: 500, req: { up: 'sma' }, effects: [{ flag: 'ind.bb' }], desc: 'Enveloppe de volatilité. Les resserrements précèdent les explosions.' });
  add({ id: 'monitor2', cat: 'trading', name: 'Deuxième écran', cost: 800, req: { earn: 400 }, effects: [{ stat: 'manual.slots', add: 1 }], desc: 'Gardez des positions sur deux marchés à la fois.' });
  add({ id: 'broker', cat: 'trading', name: 'Courtier discount', cost: 1000, req: { earn: 500 }, effects: [{ stat: 'manual.fee', mult: 0.65 }, { stat: 'bot.all.fee', mult: 0.85 }], desc: 'Frais manuels -35 %, frais des bots -15 %.' });
  add({ id: 'focus', cat: 'trading', name: 'Concentration absolue', cost: 1500, req: { earn: 800 }, effects: [{ flag: 'ab.focus' }], desc: 'Capacité : profits manuels ×3 pendant 20 secondes.' });
  add({ id: 'rsi', cat: 'trading', name: 'Oscillateur RSI', cost: 2000, req: { up: 'bollinger' }, effects: [{ flag: 'ind.rsi' }], desc: 'Sous-panneau surachat / survente.' });
  add({ id: 'lucky', cat: 'trading', name: 'Graphiques porte-bonheur', cost: 2500, req: { earn: 1500 }, effects: [{ stat: 'manual.crit', add: 0.02 }], desc: '+2 % de chances de profit critique sur les trades manuels.' });
  add({ id: 'lev10', cat: 'trading', name: 'Levier x10', cost: 3000, req: { up: 'lev5' }, effects: [{ flag: 'lev.10' }], desc: 'Débloque le levier x10. Là, on commence à trader.' });
  add({ id: 'proacct', cat: 'trading', name: 'Compte Pro', cost: 5000, req: { earn: 2500 }, effects: [{ stat: 'manual.access', mult: 4 }], desc: 'Profondeur de marché ×4 : positions maximales plus grandes.' });
  add({ id: 'regime', cat: 'trading', name: 'Détecteur de régime', cost: 6000, req: { up: 'rsi' }, effects: [{ flag: 'ind.regime' }], desc: 'Affiche le régime de marché en cours sur le graphique.' });
  add({ id: 'hothand', cat: 'trading', name: 'Main chaude', cost: 8000, req: { earn: 4000 }, effects: [{ stat: 'combo.power', add: 0.25 }], desc: 'Bonus de séries gagnantes +25 % plus puissants.' });
  add({ id: 'tape', cat: 'trading', name: 'Lecture du carnet', cost: 12000, req: { up: 'patterns' }, effects: [{ stat: 'manual.profit', mult: 2 }, { stat: 'manual.payout', add: 5 }], desc: 'Lisez le flux d’ordres comme un roman.' });
  add({ id: 'trail', cat: 'trading', name: 'Trailing Stops', cost: 15000, req: { up: 'sltp', earn: 8000 }, effects: [{ flag: 'ord.trail' }], desc: 'Des stops qui suivent le prix et sécurisent vos gains.' });
  add({ id: 'deskline', cat: 'trading', name: 'Ligne de capital maison', cost: 20000, req: { earn: 10000 }, effects: [{ stat: 'manual.desk', add: 60 }, { stat: 'manual.payout', add: 8 }], desc: 'Taille du desk +60 s de revenu (positions plus grandes) et bonus max par trade +8 s.' });
  add({ id: 'newsai', cat: 'trading', name: 'Flux de sentiment des news', cost: 25000, req: { earn: 12000 }, effects: [{ flag: 'ind.news' }, { flag: 'cal.consensus' }], desc: 'Étiquette chaque titre comme haussier ou baissier avec son impact attendu, et affiche le consensus des annonces du calendrier.' });
  add({ id: 'monitor3', cat: 'trading', name: 'Desk multi-actifs', cost: 40000, req: { up: 'monitor2' }, effects: [{ stat: 'manual.slots', add: 1 }], desc: '+1 position simultanée.' });
  add({ id: 'lev20', cat: 'trading', name: 'Levier x20', cost: 60000, req: { up: 'lev10' }, effects: [{ flag: 'lev.20' }], desc: 'Débloque le levier x20.' });
  add({ id: 'limit', cat: 'trading', name: 'Ordres limites', cost: 90000, req: { earn: 40000 }, effects: [{ flag: 'ord.limit' }], desc: 'Entrez à votre prix, pas à celui du marché.' });
  add({ id: 'stoporders', cat: 'trading', name: 'Ordres stop d’entrée', cost: 150000, req: { up: 'limit' }, effects: [{ flag: 'ord.stop' }], desc: 'Entrez automatiquement sur les cassures.' });
  add({ id: 'psych', cat: 'trading', name: 'Psychologie des marchés', cost: 250000, req: { up: 'tape' }, effects: [{ stat: 'manual.profit', mult: 2 }, { stat: 'manual.crit', add: 0.02 }, { stat: 'manual.payout', add: 8 }], desc: 'La peur et l’avidité ne sont que des données d’entrée.' });
  add({ id: 'vipbroker', cat: 'trading', name: 'Courtage VIP', cost: 500000, req: { up: 'broker' }, effects: [{ stat: 'manual.fee', mult: 0.6 }, { stat: 'spread', mult: 0.75 }], desc: 'Frais manuels -40 %, spreads -25 %.' });
  add({ id: 'oco', cat: 'trading', name: 'Encadrements OCO', cost: 700000, req: { up: 'stoporders' }, effects: [{ flag: 'ord.oco' }], desc: 'Encadrements OCO (l’un annule l’autre) : attrapez la cassure dans les deux sens.' });
  add({ id: 'lev50', cat: 'trading', name: 'Levier x50', cost: 1500000, req: { up: 'lev20' }, effects: [{ flag: 'lev.50' }], desc: 'Débloque le levier x50. Les traders Forex vous saluent.' });
  add({ id: 'flowstate', cat: 'trading', name: 'État de flow', cost: 2000000, req: { up: 'hothand' }, effects: [{ stat: 'combo.power', add: 0.5 }], desc: 'Bonus de séries gagnantes +50 % plus puissants.' });
  add({ id: 'prime', cat: 'trading', name: 'Prime Brokerage', cost: 3000000, req: { up: 'proacct' }, effects: [{ stat: 'manual.access', mult: 5 }, { stat: 'manual.desk', add: 60 }], desc: 'Profondeur de marché ×5 et taille du desk +60 s de revenu.' });
  add({ id: 'forecast', cat: 'trading', name: 'Modèle de prévision de tendance', cost: 5000000, req: { up: 'regime' }, effects: [{ flag: 'ind.forecast' }], desc: 'Affiche une prévision probabiliste de direction à court terme.' });
  add({ id: 'sniper', cat: 'trading', name: 'Entrées de sniper', cost: 8000000, req: { up: 'lucky' }, effects: [{ stat: 'crit.mult', mult: 1.5 }], desc: 'Profits critiques ×1,5 plus puissants.' });
  add({ id: 'monitor5', cat: 'trading', name: 'Centre de commandement', cost: 12000000, req: { up: 'monitor3' }, effects: [{ stat: 'manual.slots', add: 2 }], desc: '+2 positions simultanées.' });
  add({ id: 'instinct', cat: 'trading', name: 'Instinct de tueur', cost: 30000000, req: { up: 'psych' }, effects: [{ stat: 'manual.profit', mult: 3 }, { stat: 'manual.payout', add: 10 }], desc: 'Vous sentez l’odeur du sang dans le carnet d’ordres.' });
  add({ id: 'lev100', cat: 'trading', name: 'Levier x100', cost: 100000000, req: { up: 'lev50' }, effects: [{ flag: 'lev.100' }], desc: 'Débloque le levier x100. Un mouvement de 1 % change tout.' });
  add({ id: 'darkpool', cat: 'trading', name: 'Accès aux dark pools', cost: 800000000, req: { up: 'prime' }, effects: [{ stat: 'manual.access', mult: 5 }, { stat: 'manual.desk', add: 120 }], desc: 'Profondeur de marché ×5, taille du desk +120 s de revenu.' });
  add({ id: 'blackswanradar', cat: 'trading', name: 'Radar à cygnes noirs', cost: 1e10, req: { up: 'sniper' }, effects: [{ stat: 'manual.crit', add: 0.03 }, { stat: 'bot.all.crit', add: 0.005 }], desc: '+3 % de chances de critique manuel, +0,5 % pour les bots.' });
  add({ id: 'legendint', cat: 'trading', name: 'Intuition légendaire', cost: 5e10, req: { up: 'instinct' }, effects: [{ stat: 'manual.profit', mult: 3 }, { stat: 'crit.mult', mult: 2 }, { stat: 'manual.payout', add: 15 }], desc: 'Profits manuels ×3, critiques ×2, bonus max par trade +15 s.' });
  add({ id: 'lev250', cat: 'trading', name: 'Levier x250', cost: 2e11, req: { up: 'lev100' }, effects: [{ flag: 'lev.250' }], desc: 'Débloque le levier x250.' });
  add({ id: 'zenmaster', cat: 'trading', name: 'Maître zen', cost: 1e13, req: { up: 'flowstate' }, effects: [{ stat: 'combo.power', add: 0.75 }, { stat: 'manual.profit', mult: 4 }, { stat: 'manual.payout', add: 10 }], desc: 'Bonus de séries +75 %, profits manuels ×4, bonus max par trade +10 s.' });
  add({ id: 'lev1000', cat: 'trading', name: 'Levier x1000', cost: 1e14, req: { up: 'lev250' }, effects: [{ flag: 'lev.1000' }], desc: 'Qu’est-ce qui pourrait mal tourner ?' });
  add({ id: 'globalliq', cat: 'trading', name: 'Réseau de liquidité mondial', cost: 1e15, req: { up: 'darkpool' }, effects: [{ stat: 'manual.access', mult: 10 }, { stat: 'manual.desk', add: 240 }, { stat: 'alpha.capacity', add: 0.5 }], desc: 'Profondeur de marché ×10, taille du desk +240 s de revenu, capacité de marché +50 %.' });
  add({ id: 'invisiblehand', cat: 'trading', name: 'La Main invisible', cost: 1e17, req: { up: 'legendint' }, effects: [{ stat: 'manual.profit', mult: 5 }, { stat: 'manual.payout', add: 15 }], desc: 'Adam Smith aimerait vous dire un mot.' });
  add({ id: 'lev1e4', cat: 'trading', name: 'Levier x10 000', cost: 1e20, req: { up: 'lev1000' }, effects: [{ flag: 'lev.10000' }], desc: 'Les risk managers ont quitté le bâtiment.' });
  add({ id: 'precog', cat: 'trading', name: 'Précognition', cost: 1e22, req: { up: 'invisiblehand' }, effects: [{ stat: 'manual.profit', mult: 10 }, { stat: 'manual.crit', add: 0.05 }, { stat: 'manual.payout', add: 20 }], desc: 'Vous clôturez vos trades avant de les ouvrir.' });
  add({ id: 'lev1e6', cat: 'trading', name: 'Levier x1 000 000', cost: 1e26, req: { up: 'lev1e4' }, effects: [{ flag: 'lev.1000000' }], desc: 'La réalité n’est qu’une suggestion.' });

  /* ---------------- MARKETS (new assets) ---------------- */
  const mk = (id, name, cost, assets, req, desc) =>
    add({ id, cat: 'markets', name, cost, req, effects: assets.map((a) => ({ flag: 'asset.' + a })), desc: desc + ' Débloque : ' + assets.join(', ') + '.' });
  mk('mk_bitx', 'Compte crypto', 300, ['BITX'], { earn: 120 }, 'Bienvenue dans la volatilité 24 h/24.');
  mk('mk_gold', 'Desk matières premières', 3000, ['GOLD'], { earn: 1200 }, 'Tradez la valeur refuge par excellence.');
  mk('mk_eurusd', 'Compte Forex', 10000, ['EURUSD'], { earn: 4000 }, 'Petits mouvements, levier énorme.');
  mk('mk_equities', 'Extension actions', 60000, ['QDYN', 'HYPR'], { earn: 25000 }, 'Deux nouvelles actions aux personnalités très différentes.');
  mk('mk_alts', 'Accès aux altcoins', 150000, ['ETHX', 'MOON'], { up: 'mk_bitx', earn: 60000 }, 'Au-delà de BitX commence la folie.');
  mk('mk_index', 'Futures sur indices', 500000, ['US500', 'TECH100'], { earn: 200000 }, 'Tradez des économies entières.');
  mk('mk_meme', 'Casino des memecoins', 1000000, ['DOGL'], { up: 'mk_alts' }, 'Much volatilité. Very risque.');
  mk('mk_metals', 'Métaux précieux II', 1200000, ['SILVER'], { up: 'mk_gold' }, 'Encore plus de choses brillantes.');
  mk('mk_energy', 'Marchés de l’énergie', 2000000, ['OIL', 'URAN'], { earn: 8e5 }, 'La géopolitique, baril par baril.');
  mk('mk_fx2', 'Majeures Forex', 4000000, ['USDJPY', 'GBPUSD'], { up: 'mk_eurusd', earn: 1.5e6 }, 'Carry trades et psychodrames de banques centrales.');
  mk('mk_zenith', 'Géants de la tech', 10000000, ['ZNTH'], { up: 'mk_equities' }, 'L’action que tout le monde possède.');
  mk('mk_world', 'Accès à l’indice mondial', 250000000, ['WORLD'], { up: 'mk_index' }, 'La planète entière en un seul ticker.');
  mk('mk_volx', 'Produits de volatilité', 1200000000, ['VOLX'], { era: 3 }, 'Tradez la peur elle-même.');
  mk('mk_qtc', 'Crypto quantique', 2e11, ['QTC'], { up: 'mk_alts', era: 4 }, 'L’argent post-quantique.');
  mk('mk_synth', 'Produits synthétiques', 2e12, ['SYNTH'], { era: 4 }, 'Des paniers d’alpha fabriqués par des machines.');
  mk('mk_orbital', 'Bourse des ressources orbitales', 2e14, ['ORBX', 'HE3'], { era: 5 }, 'Des droits miniers au-delà de l’atmosphère.');
  mk('mk_climate', 'Marchés énergie & climat', 1e17, ['ECRD', 'CLMT'], { era: 5 }, 'Mettez un prix sur la planète elle-même.');
  mk('mk_quantum', 'Bourse des actifs quantiques', 1e19, ['QBIT'], { era: 6 }, 'Les heures de calcul comme matière première.');
  mk('mk_mars', 'Liaison Bourse martienne', 1e21, ['MARS'], { era: 6 }, 'Des actions interplanétaires, latence lumière incluse.');
  mk('mk_temporal', 'Futures temporels', 1e24, ['TMPX'], { era: 7 }, 'Tradez la semaine prochaine. Dès aujourd’hui.');
  mk('mk_dyson', 'Marché obligataire de Dyson', 1e27, ['DYSN'], { era: 7 }, 'Une dette garantie par une étoile.');

  /* ---------------- AUTOMATION (global bot upgrades) ---------------- */
  add({ id: 'riskdial', cat: 'automation', name: 'Sélecteur de risque', cost: 300, req: { bot: ['auto', 1] }, effects: [{ flag: 'risk.dial' }], desc: 'Choisissez l’appétit pour le risque de votre flotte : Prudent, Équilibré ou Agressif.' });
  add({ id: 'backtest', cat: 'automation', name: 'Framework de backtest', cost: 2000, req: { bot: ['auto', 5] }, effects: [{ stat: 'bot.all.winrate', add: 0.015 }], desc: 'Tous les bots : +1,5 % de taux de réussite.' });
  add({ id: 'cloudvm', cat: 'automation', name: 'Machines virtuelles cloud', cost: 4000, req: { bot: ['auto', 8] }, effects: [{ stat: 'bot.all.speed', add: 0.15 }], desc: 'Tous les bots tradent 15 % plus vite.' });
  add({ id: 'smartrouter', cat: 'automation', name: 'Routeur d’ordres intelligent', cost: 15000, req: { bot: ['momentum', 5] }, effects: [{ stat: 'bot.all.fee', mult: 0.6 }], desc: 'Frais des bots -40 %.' });
  add({ id: 'overclock_ab', cat: 'automation', name: 'Protocole d’overclocking', cost: 25000, req: { earn: 12000, bot: ['auto', 10] }, effects: [{ flag: 'ab.overclock' }], desc: 'Capacité : vitesse des bots ×2,5 pendant 20 secondes.' });
  add({ id: 'riskparity', cat: 'automation', name: 'Parité des risques', cost: 40000, req: { bot: ['momentum', 10] }, effects: [{ stat: 'bot.all.loss', mult: 0.9 }], desc: 'Perte moyenne des bots -10 %.' });
  add({ id: 'portopt', cat: 'automation', name: 'Optimiseur de portefeuille', cost: 100000, req: { bot: ['meanrev', 5] }, effects: [{ stat: 'bot.all.capital', mult: 1.5 }], desc: 'Capital des bots ×1,5.' });
  add({ id: 'yolo', cat: 'automation', name: 'Mode YOLO', cost: 200000, req: { up: 'riskdial', earn: 80000 }, effects: [{ flag: 'risk.degenerate' }], desc: 'Débloque le profil de risque Dégénéré. Ceci n’est pas un conseil financier.' });
  add({ id: 'scanner', cat: 'automation', name: 'Scanner de marché', cost: 700000, req: { earn: 300000 }, effects: [{ stat: 'bot.scanner', add: 1 }], desc: 'Les bots orientent leurs trades vers les marchés dont le régime convient à leur stratégie.' });
  add({ id: 'ensemble', cat: 'automation', name: 'Modèles d’ensemble', cost: 8000000, req: { bot: ['breakout', 10] }, effects: [{ stat: 'bot.all.winrate', add: 0.015 }, { stat: 'bot.all.win', add: 0.1 }], desc: 'Taux de réussite +1,5 %, gain moyen +10 %.' });
  add({ id: 'execalgo', cat: 'automation', name: 'Algos d’exécution (VWAP/TWAP)', cost: 2e8, req: { bot: ['scalper', 5] }, effects: [{ stat: 'bot.all.fee', mult: 0.6 }, { stat: 'spread', mult: 0.8 }], desc: 'Frais des bots -40 %, spreads -20 %.' });
  add({ id: 'botfarm', cat: 'automation', name: 'Orchestrateur de fermes de bots', cost: 6e8, req: { bot: ['scalper', 10] }, effects: [{ stat: 'bot.all.capital', mult: 2 }], desc: 'Capital des bots ×2.' });
  add({ id: 'scanner2', cat: 'automation', name: 'Scanner multi-marchés', cost: 3e9, req: { up: 'scanner' }, effects: [{ stat: 'bot.scanner', add: 1.5 }], desc: 'Routage par régime bien plus efficace pour tous les bots.' });
  add({ id: 'alphagen', cat: 'automation', name: 'Chaîne de génération d’alpha', cost: 1e12, req: { bot: ['volharv', 5] }, effects: [{ stat: 'bot.all.profit', mult: 2 }], desc: 'Profit de tous les bots ×2.' });
  add({ id: 'synergy', cat: 'automation', name: 'Synergie de flotte', cost: 3e13, req: { bot: ['hft', 5] }, effects: [{ flag: 'bot.synergy' }], desc: 'Chaque flotte gagne +1 % de profit par tranche de 10 bots possédés au total.' });
  add({ id: 'selfopt', cat: 'automation', name: 'Code auto-optimisant', cost: 1e16, req: { bot: ['ai', 5] }, effects: [{ stat: 'bot.all.profit', mult: 3 }], desc: 'Profit de tous les bots ×3.' });
  add({ id: 'zerofee', cat: 'automation', name: 'Compensation sans frais', cost: 1e17, req: { era: 5 }, effects: [{ stat: 'bot.all.fee', mult: 0.4 }, { stat: 'manual.fee', mult: 0.4 }], desc: 'Tous les frais -60 %.' });
  add({ id: 'hyperscale', cat: 'automation', name: 'Déploiement hyperscale', cost: 1e18, req: { bot: ['swarm', 5] }, effects: [{ stat: 'bot.all.capital', mult: 3 }], desc: 'Capital des bots ×3.' });
  add({ id: 'autonomous', cat: 'automation', name: 'Économie autonome', cost: 1e20, req: { bot: ['quantum', 5] }, effects: [{ stat: 'bot.all.profit', mult: 5 }], desc: 'Profit de tous les bots ×5.' });
  add({ id: 'omnibot', cat: 'automation', name: 'Agents omniprésents', cost: 1e24, req: { bot: ['singularity', 5] }, effects: [{ stat: 'bot.all.profit', mult: 10 }], desc: 'Profit de tous les bots ×10.' });

  /* ---------------- STAFF / FIRM ---------------- */
  add({ id: 'espresso', cat: 'firm', name: 'Machine à expresso', cost: 40000, req: { staff: 1 }, effects: [{ stat: 'research.rate', add: 0.25 }], desc: 'Le carburant des quants. Recherche +25 %.' });
  add({ id: 'compliance', cat: 'firm', name: 'Département conformité', cost: 60000, req: { staff: 2, earn: 30000 }, effects: [{ stat: 'reg.gain', mult: 0.7 }], desc: 'Des juristes relisent chaque gros ordre. Pression réglementaire subie -30 %.' });
  add({ id: 'compliance2', cat: 'firm', name: 'Programme de conformité mondial', cost: 3e9, req: { up: 'compliance', era: 3 }, effects: [{ stat: 'reg.gain', mult: 0.6 }, { stat: 'rep.loss', mult: 0.8 }], desc: 'Audits internes, formations, signalements. Pression réglementaire -40 %, pertes de réputation -20 %.' });
  add({ id: 'bonuspool', cat: 'firm', name: 'Enveloppe de bonus', cost: 700000, req: { staffId: ['junior', 3] }, effects: [{ stat: 'staff.desk', mult: 2 }], desc: 'Profit du desk humain ×2. Les traders ne sont motivés que par une seule chose.' });
  add({ id: 'training', cat: 'firm', name: 'Programme de formation', cost: 8000000, req: { staff: 15 }, effects: [{ stat: 'staff.power', add: 0.25 }], desc: 'Tous les bonus du personnel +25 %.' });
  add({ id: 'culture', cat: 'firm', name: 'Culture de la performance', cost: 5e9, req: { staffId: ['senior', 5] }, effects: [{ stat: 'staff.desk', mult: 3 }], desc: 'Profit du desk humain ×3.' });
  add({ id: 'campus', cat: 'firm', name: 'Campus quant', cost: 1e13, req: { staffId: ['quant', 25] }, effects: [{ stat: 'research.rate', mult: 2 }, { stat: 'staff.power', add: 0.25 }], desc: 'Recherche ×2, bonus du personnel +25 %.' });
  add({ id: 'deskempire', cat: 'firm', name: 'Réseau mondial de desks', cost: 1e15, req: { staffId: ['senior', 25] }, effects: [{ stat: 'staff.desk', mult: 10 }], desc: 'Profit du desk humain ×10.' });

  /* ---------------- FUND ---------------- */
  add({ id: 'fu_prime', cat: 'fund', name: 'Relation prime broker', cost: 12000000, req: { fund: true }, effects: [{ stat: 'fund.capacity', add: 0.5 }], desc: 'Capacité du fonds +50 %.' });
  add({ id: 'fu_ir', cat: 'fund', name: 'Équipe relations investisseurs', cost: 20000000, req: { fund: true }, effects: [{ stat: 'fund.inflow', add: 1 }], desc: 'Souscriptions des investisseurs +100 %.' });
  add({ id: 'fu_lockup', cat: 'fund', name: 'Périodes de blocage', cost: 50000000, req: { fund: true }, effects: [{ stat: 'fund.withdraw', mult: 0.5 }], desc: 'Retraits des investisseurs -50 %.' });
  add({ id: 'fu_hwm', cat: 'fund', name: 'Clause de high-water mark', cost: 150000000, req: { fund: true }, effects: [{ stat: 'fund.perf', add: 0.05 }], desc: 'Vos investisseurs acceptent une commission plus élevée car ils ne la paient que sur les gains au-delà du plus haut historique (visible dans FONDS). Commission de performance +5 points.' });
  add({ id: 'fu_roadshow', cat: 'fund', name: 'Roadshow marketing', cost: 400000000, req: { fund: true }, effects: [{ stat: 'rep.gain', add: 0.5 }, { stat: 'fund.inflow', add: 0.5 }], desc: 'Gain de réputation +50 %, souscriptions +50 %.' });
  add({ id: 'fu_liquidity', cat: 'fund', name: 'Injection de liquidités', cost: 500000000, req: { fund: true }, effects: [{ flag: 'ab.liquidity' }], desc: 'Capacité : tous les revenus ×2 pendant 30 secondes et afflux d’investisseurs.' });
  add({ id: 'fu_inst', cat: 'fund', name: 'Part institutionnelle', cost: 1500000000, req: { fund: true, era: 3 }, effects: [{ stat: 'fund.capacity', add: 1 }], desc: 'Capacité du fonds +100 %.' });
  add({ id: 'fu_3and30', cat: 'fund', name: '3 et 30', cost: 10000000000, req: { up: 'fu_hwm' }, effects: [{ stat: 'fund.mgmt', add: 0.01 }, { stat: 'fund.perf', add: 0.1 }], desc: 'Frais de gestion +1 point, commission de performance +10 points. Les investisseurs râlent, puis paient.' });
  add({ id: 'fu_feeder', cat: 'fund', name: 'Fonds nourriciers mondiaux', cost: 1e12, req: { up: 'fu_inst' }, effects: [{ stat: 'fund.capacity', add: 1.5 }], desc: 'Capacité du fonds +150 %.' });
  add({ id: 'fu_sovereign', cat: 'fund', name: 'Mandats souverains', cost: 1e13, req: { up: 'fu_feeder' }, effects: [{ stat: 'fund.inflow', add: 2 }], desc: 'Souscriptions des investisseurs +200 %.' });
  add({ id: 'fu_multistrat', cat: 'fund', name: 'Plateforme multi-stratégies', cost: 1e15, req: { up: 'fu_feeder', era: 5 }, effects: [{ stat: 'fund.capacity', add: 3 }], desc: 'Capacité du fonds +300 %.' });
  add({ id: 'fu_permanent', cat: 'fund', name: 'Véhicule à capital permanent', cost: 1e18, req: { up: 'fu_multistrat' }, effects: [{ stat: 'fund.withdraw', mult: 0.25 }, { stat: 'fund.capacity', add: 3 }], desc: 'Retraits -75 %, capacité +300 %.' });
  add({ id: 'fu_perfx', cat: 'fund', name: 'Suprématie de la performance', cost: 1e19, req: { up: 'fu_3and30', era: 6 }, effects: [{ stat: 'fund.perf', add: 0.15 }], desc: 'Commission de performance +15 points. 50 %, ça paraît juste, non ?' });
  add({ id: 'fu_planetary', cat: 'fund', name: 'Mandat de retraite planétaire', cost: 1e21, req: { up: 'fu_permanent' }, effects: [{ stat: 'fund.capacity', add: 6 }], desc: 'Capacité du fonds +600 %.' });

  /* ---------------- EMPIRE ---------------- */
  add({ id: 'em_synergy', cat: 'empire', name: 'Synergies de groupe', cost: 2e11, req: { empire: true }, effects: [{ stat: 'div.all', mult: 2 }], desc: 'Revenus de toutes les divisions ×2.' });
  add({ id: 'em_lobby', cat: 'empire', name: 'Bureau de lobbying', cost: 1e12, req: { empire: true }, effects: [{ stat: 'influence', mult: 1.5 }, { stat: 'event.neg', mult: 0.85 }, { stat: 'reg.gain', mult: 0.8 }], desc: 'Influence ×1,5, événements négatifs -15 %, pression réglementaire -20 %.' });
  add({ id: 'em_vertical', cat: 'empire', name: 'Intégration verticale', cost: 5e12, req: { empire: true }, effects: [{ stat: 'div.all', mult: 2 }, { stat: 'bot.all.fee', mult: 0.8 }, { stat: 'alpha.capacity', add: 0.25 }], desc: 'Divisions ×2, frais des bots -20 %, capacité de marché +25 %.' });
  add({ id: 'em_media', cat: 'empire', name: 'Empire médiatique', cost: 5e13, req: { empire: true }, effects: [{ stat: 'rep.gain', mult: 2 }, { stat: 'news.lead', add: 4 }, { stat: 'att.gain', mult: 1.25 }], desc: 'Gain de réputation ×2. Les titres vous parviennent 4 s plus tôt et vos coups d’éclat font plus de bruit.' });
  add({ id: 'em_monopoly', cat: 'empire', name: 'Monopole naturel', cost: 1e16, req: { empire: true, era: 5 }, effects: [{ stat: 'div.all', mult: 3 }, { stat: 'alpha.capacity', add: 0.5 }], desc: 'Revenus de toutes les divisions ×3, capacité de marché +50 %.' });
  add({ id: 'em_central', cat: 'empire', name: 'Banque centrale de l’ombre', cost: 1e19, req: { empire: true, era: 6 }, effects: [{ stat: 'div.all', mult: 5 }, { stat: 'macro.bull', add: 1 }], desc: 'Divisions ×5. Les bull markets deviennent bien plus probables.' });
  add({ id: 'em_galactic', cat: 'empire', name: 'Holding galactique', cost: 1e27, req: { empire: true, era: 7 }, effects: [{ stat: 'income.global', mult: 10 }], desc: 'Tous les revenus ×10.' });

  /* ---------------- GENERATED: per-bot upgrades ---------------- */
  const BOT_UPG_NAMES = {
    auto: ['Planificateur cron', 'Meilleures graines aléatoires', 'Fichiers de config', 'Tests unitaires', 'Dockerisé', 'Cluster Kubernetes', 'Scripts auto-actualisés'],
    momentum: ['Croisement d’EMA', 'Confirmation par le volume', 'Fenêtre adaptative', 'Filtre de force de tendance', 'Synchro multi-unités de temps', 'Logique de pyramidage', 'Singularité de tendance'],
    meanrev: ['Bandes de z-score', 'Tests de cointégration', 'Modèle d’Ornstein-Uhlenbeck', 'Estimateur de demi-vie', 'Filtre de régime', 'Moteur de paires', 'Puits gravitationnel'],
    breakout: ['Canaux de Donchian', 'Filtre de faux breakouts', 'Détecteur de compression', 'Déséquilibre du carnet', 'Allumage du momentum', 'Chasseur de gaps', 'Entrée à l’horizon des événements'],
    scalper: ['Graphiques en ticks', 'Gestion de la file d’attente', 'Modèle de microprix', 'Collecte de rabais', 'Annulations sous la milliseconde', 'Renifleur d’icebergs', 'Réflexes à la picoseconde'],
    arb: ['Chemins triangulaires', 'Routage multi-plateformes', 'Cartographie de latence', 'Arbitrage de taux de financement', 'Grille d’arbitrage statistique', 'Matrice de basis trades', 'Oracle de prix universel'],
    volharv: ['Couverture delta', 'Gamma scalping', 'Modèle de surface de volatilité', 'Assurance contre les extrêmes', 'Trades de dispersion', 'Swaps de variance', 'Alchimie de la volatilité'],
    hft: ['Passerelle d’ordres FPGA', 'Carte réseau kernel bypass', 'Matching co-localisé', 'Carnet d’ordres prédictif', 'Arbitrage de latence', 'Synchro d’horloge à la nanoseconde', 'Vitesse de la lumière'],
    ai: ['Feature store', 'Prévisionniste Transformer', 'Politique par renforcement', 'Salle d’entraînement synthétique', 'Marchés en auto-jeu', 'Stratégies émergentes', 'Alignement de l’IA (sur le profit)'],
    swarm: ['Consensus d’essaim', 'Routage par esprit de ruche', 'Élagage évolutionnaire', 'Mémoire collective', 'Signaux stigmergiques', 'Intuition distribuée', 'Supra-esprit'],
    quantum: ['Correction d’erreurs quantiques', 'Ordres superposés', 'Couvertures intriquées', 'Exécutions par effet tunnel', 'Bouclier de décohérence', 'Backtests multivers', 'Effet observateur'],
    singularity: ['Auto-amélioration récursive', 'Noyau de simulation économique', 'Moteur de réalité prédictive', 'Boucle d’inférence causale', 'Prix post-pénurie', 'Flux d’ordres omniscient', 'Le Trade final'],
  };
  const TEMPLATE = [
    { n: 1, cost: 8, fx: (id) => [{ stat: 'bot.' + id + '.winrate', add: 0.02 }], txt: '+2 % de taux de réussite' },
    { n: 10, cost: 60, fx: (id) => [{ stat: 'bot.' + id + '.profit', mult: 2 }], txt: 'profit ×2' },
    { n: 25, cost: 700, fx: (id) => [{ stat: 'bot.' + id + '.speed', add: 0.5 }], txt: 'vitesse +50 %' },
    { n: 50, cost: 2e4, fx: (id) => [{ stat: 'bot.' + id + '.loss', mult: 0.8 }, { stat: 'bot.' + id + '.profit', mult: 1.5 }], txt: 'pertes -20 %, profit ×1,5' },
    { n: 100, cost: 1e6, fx: (id) => [{ stat: 'bot.' + id + '.profit', mult: 3 }], txt: 'profit ×3' },
    { n: 200, cost: 1e9, fx: (id) => [{ stat: 'bot.' + id + '.win', add: 0.25 }, { stat: 'bot.' + id + '.crit', add: 0.02 }], txt: 'gain moyen +25 %, critique +2 %' },
    { n: 300, cost: 1e12, fx: (id) => [{ stat: 'bot.' + id + '.profit', mult: 5 }], txt: 'profit ×5' },
  ];
  D.BOTS.forEach((b) => {
    const names = BOT_UPG_NAMES[b.id];
    TEMPLATE.forEach((t, i) => {
      add({ id: 'b_' + b.id + '_' + i, cat: 'bots', bot: b.id, name: names[i], cost: b.cost * t.cost, req: { bot: [b.id, t.n] },
        effects: t.fx(b.id), desc: b.name + ' : ' + t.txt + '.' });
    });
  });

  D.UPGRADES = U;
  D.UPGRADE_MAP = {};
  U.forEach((u) => { D.UPGRADE_MAP[u.id] = u; });
  D.UPGRADE_CATS = {
    trading: { name: 'Trading', color: '#19e6ff' },
    markets: { name: 'Marchés', color: '#ffb627' },
    automation: { name: 'Automatisation', color: '#19f58c' },
    bots: { name: 'Réglage des bots', color: '#6cf0a0' },
    firm: { name: 'Société', color: '#ffd36b' },
    fund: { name: 'Fonds', color: '#a77bff' },
    empire: { name: 'Empire', color: '#ff4fd8' },
  };
})(window.TE);
