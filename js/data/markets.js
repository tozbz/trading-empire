/* Market data: asset classes, assets, regimes, macro cycles.
 * Units: drift is log-return per second, vol is a multiplier on the base sigma (0.0022 / sqrt(s)).
 */
(function (TE) {
  'use strict';
  const D = TE.Data;

  D.CANDLE_SEC = 2;          // one base candle = 2 seconds of game time
  D.MACRO_CANDLE = 30;       // one macro candle = 15 base candles (30s)
  D.BASE_SIGMA = 0.0022;

  D.ASSET_CLASSES = {
    stock: { name: 'Actions', tag: 'ACTIONS', color: '#3ec8ff' },
    crypto: { name: 'Crypto', tag: 'CRYPTO', color: '#ffb02e' },
    fx: { name: 'Forex', tag: 'FOREX', color: '#6cf0a0' },
    commodity: { name: 'Matières premières', tag: 'MATIÈRES PREMIÈRES', color: '#e8c15a' },
    index: { name: 'Indices', tag: 'MARCHÉS', color: '#b48cff' },
    deriv: { name: 'Dérivés', tag: 'DÉRIVÉS', color: '#ff7ac8' },
    exotic: { name: 'Frontière', tag: 'FRONTIÈRE', color: '#00ffd5' },
  };

  /* depth: base max margin ($) a single manual position may use on this market.
   * product: used by news headlines, written with its French article. */
  D.ASSETS = [
    { id: 'NOVA', name: 'NOVA Corp.', cls: 'stock', price: 100, vol: 1.15, trend: 1.5, depth: 2500, spread: 0.0006, beta: 1, sens: 1, product: 'une batterie à électrolyte solide',
      desc: 'La coqueluche du stockage d’énergie. Tendances nettes et mouvements indulgents : le marché idéal pour apprendre.' },
    { id: 'BITX', name: 'BitX', cls: 'crypto', price: 42000, vol: 2.2, trend: 2.0, depth: 4000, spread: 0.0010, beta: 1.4, sens: 1.5,
      desc: 'La crypto originelle. Tendances violentes, mèches brutales, drame 24 h/24.' },
    { id: 'GOLD', name: 'Or (spot)', cls: 'commodity', price: 2350, vol: 0.45, trend: 0.5, depth: 6000, spread: 0.0003, beta: -0.5, sens: 0.7,
      desc: 'Lent et régulier. S’envole quand le monde panique.' },
    { id: 'EURUSD', name: 'EUR/USD', cls: 'fx', price: 1.085, vol: 0.18, trend: 0.22, depth: 10000, spread: 0.00008, beta: 0.15, sens: 0.6,
      desc: 'Le marché le plus liquide de la planète. Mouvements minuscules : taillé pour le levier.' },
    { id: 'QDYN', name: 'Quantum Dynamics', cls: 'stock', price: 340, vol: 1.5, trend: 1.4, depth: 6000, spread: 0.0007, beta: 1.3, sens: 1.4, product: 'un qubit à température ambiante',
      desc: 'Puces quantiques. Portée par la hype, sujette aux gaps, adorée des traders momentum.' },
    { id: 'HYPR', name: 'Hyperion Industries', cls: 'stock', price: 58, vol: 0.8, trend: 0.9, depth: 6000, spread: 0.0005, beta: 0.9, sens: 1.1, product: 'un moteur-fusée réutilisable',
      desc: 'Conglomérat aérospatial. Suit ses résultats, tendances propres.' },
    { id: 'ETHX', name: 'Etherium-X', cls: 'crypto', price: 3200, vol: 2.5, trend: 2.2, depth: 7000, spread: 0.0011, beta: 1.5, sens: 1.6,
      desc: 'La monnaie programmable. Suit BitX, en plus épicé.' },
    { id: 'MOON', name: 'MoonCoin', cls: 'crypto', price: 0.42, vol: 3.8, trend: 3.4, depth: 4000, spread: 0.0030, beta: 1.8, sens: 2.6, meme: true,
      desc: 'Spéculation pure. Des envolées et des cratères. Surtout des cratères.' },
    { id: 'US500', name: 'Indice US500', cls: 'index', price: 5400, vol: 0.6, trend: 0.7, depth: 15000, spread: 0.0002, beta: 1, sens: 0.8,
      desc: 'Cinq cents entreprises, un seul ticker. Tendances douces.' },
    { id: 'TECH100', name: 'Indice TECH100', cls: 'index', price: 19800, vol: 0.85, trend: 0.95, depth: 15000, spread: 0.0002, beta: 1.2, sens: 1,
      desc: 'Indice chargé en tech. Plus rapide et plus lunatique que l’US500.' },
    { id: 'SILVER', name: 'Argent', cls: 'commodity', price: 29.4, vol: 0.9, trend: 0.8, depth: 8000, spread: 0.0004, beta: -0.2, sens: 0.9,
      desc: 'Le petit frère hyperactif de l’or.' },
    { id: 'DOGL', name: 'DogeLord', cls: 'crypto', price: 0.081, vol: 4.6, trend: 4.0, depth: 5000, spread: 0.0040, beta: 2, sens: 3, meme: true,
      desc: 'Des mèmes, encore des mèmes. Extrêmement manipulable. Much wow.' },
    { id: 'OIL', name: 'Pétrole brut', cls: 'commodity', price: 78, vol: 1.3, trend: 1.2, depth: 12000, spread: 0.0004, beta: 0.6, sens: 1.6,
      desc: 'La géopolitique en baril. Très sensible aux actualités.' },
    { id: 'URAN', name: 'Uranium', cls: 'commodity', price: 92, vol: 1.6, trend: 1.5, depth: 10000, spread: 0.0007, beta: 0.4, sens: 1.4,
      desc: 'Le carburant de la renaissance nucléaire. Tendances longues et explosives.' },
    { id: 'USDJPY', name: 'USD/JPY', cls: 'fx', price: 151.2, vol: 0.22, trend: 0.25, depth: 20000, spread: 0.00008, beta: 0.25, sens: 0.8,
      desc: 'Le chouchou du carry trade. Gare aux interventions de la banque centrale.' },
    { id: 'GBPUSD', name: 'GBP/USD', cls: 'fx', price: 1.27, vol: 0.25, trend: 0.28, depth: 20000, spread: 0.0001, beta: 0.2, sens: 0.8,
      desc: 'Le « Cable ». Un peu plus sauvage que l’EUR/USD.' },
    { id: 'ZNTH', name: 'Zenith Systems', cls: 'stock', price: 1240, vol: 1.1, trend: 1.1, depth: 25000, spread: 0.0004, beta: 1.1, sens: 1.2, product: 'un système d’exploitation qui s’écrit tout seul',
      desc: 'Méga-capitalisation logicielle. Tout le monde en a. Tout le monde.' },
    { id: 'WORLD', name: 'Indice Mondial', cls: 'index', price: 8800, vol: 0.5, trend: 0.6, depth: 40000, spread: 0.00015, beta: 1, sens: 0.7,
      desc: 'Le marché actions de toute la planète en un seul instrument.' },
    { id: 'VOLX', name: 'Futures de volatilité', cls: 'deriv', price: 18, vol: 2.2, trend: 1.0, depth: 30000, spread: 0.0008, beta: -2.5, sens: 1.5, fear: true,
      desc: 'L’indice de la peur. Dort pendant des siècles, puis explose quand les marchés paniquent.' },
    { id: 'QTC', name: 'QuantumCoin', cls: 'crypto', price: 777, vol: 3.0, trend: 2.6, depth: 30000, spread: 0.0012, beta: 1.6, sens: 1.8,
      desc: 'Cryptomonnaie post-quantique. Impiratable, paraît-il.' },
    { id: 'SYNTH', name: 'Panier Alpha synthétique', cls: 'deriv', price: 1000, vol: 0.9, trend: 1.2, depth: 60000, spread: 0.0003, beta: 0.5, sens: 1,
      desc: 'Un panier assemblé par une machine avec tout ce qui marchait hier.' },
    { id: 'ORBX', name: 'Ressources Orbitales', cls: 'exotic', price: 4200, vol: 1.4, trend: 1.4, depth: 100000, spread: 0.0005, beta: 0.6, sens: 1.3,
      desc: 'Platine extrait des astéroïdes et immobilier en orbite.' },
    { id: 'HE3', name: 'Futures Hélium-3', cls: 'exotic', price: 12500, vol: 1.8, trend: 1.6, depth: 100000, spread: 0.0006, beta: 0.5, sens: 1.5,
      desc: 'Le carburant de fusion lunaire. Le pétrole du XXIIe siècle.' },
    { id: 'ECRD', name: 'Crédits Énergie', cls: 'exotic', price: 640, vol: 1.0, trend: 1.1, depth: 100000, spread: 0.0003, beta: 0.4, sens: 1,
      desc: 'Quotas énergétiques planétaires, échangés au térawatt.' },
    { id: 'CLMT', name: 'Contrats Climat', cls: 'exotic', price: 210, vol: 1.2, trend: 1.3, depth: 100000, spread: 0.0004, beta: 0.3, sens: 1.4,
      desc: 'Des futures sur la température mondiale. Couvrez-vous contre la météo. Littéralement.' },
    { id: 'QBIT', name: 'Futures Qubit', cls: 'exotic', price: 99000, vol: 2.2, trend: 2.0, depth: 100000, spread: 0.0005, beta: 0.8, sens: 1.6,
      desc: 'Contrats à terme sur des heures de calcul quantique. Existent à deux prix à la fois.' },
    { id: 'MARS', name: 'Composite Bourse de Mars', cls: 'exotic', price: 31000, vol: 1.3, trend: 1.3, depth: 100000, spread: 0.0004, beta: 0.7, sens: 1.2,
      desc: 'La bourse de la planète rouge. Latence lumière de 20 minutes non incluse.' },
    { id: 'TMPX', name: 'Futures d’arbitrage temporel', cls: 'exotic', price: 1.0, vol: 3.4, trend: 2.8, depth: 100000, spread: 0.0008, beta: 0, sens: 2,
      desc: 'Contrats réglés aux prix de la semaine prochaine. Paraît-il.' },
    { id: 'DYSN', name: 'Obligations Essaim de Dyson', cls: 'exotic', price: 10000, vol: 0.7, trend: 0.9, depth: 100000, spread: 0.0002, beta: 0.3, sens: 0.8,
      desc: 'Dette notée AAA, adossée à une étoile. Littéralement.' },
  ];
  D.ASSET_MAP = {};
  D.ASSETS.forEach((a, i) => { a.order = i; D.ASSET_MAP[a.id] = a; });

  /* Market regimes. cls is used by bots for regime affinity. */
  D.REGIMES = {
    accum: { name: 'Accumulation', cls: 'calm', drift: 0.00012, vol: 0.55, mr: 0.035, mom: 0.2, volm: 0.7, dur: [25, 50], dir: 1,
      next: { bull: 3, squeeze: 0.7, range: 1, bear_trap: 0.8, lowvol: 0.6 }, hint: 'Achats discrets. Précède souvent un breakout.' },
    bull: { name: 'Tendance haussière', cls: 'trend_up', drift: 0.0012, vol: 0.9, mr: 0, mom: 1, volm: 1.1, dur: [30, 70], dir: 1,
      next: { euphoria: 1.4, range: 2, bull_trap: 1, bear: 0.9, highvol: 0.7, lowvol: 0.7 }, hint: 'Plus hauts et plus bas ascendants. Festin pour les suiveurs de tendance.' },
    bear: { name: 'Tendance baissière', cls: 'trend_down', drift: -0.0012, vol: 1.0, mr: 0, mom: 1, volm: 1.2, dur: [30, 70], dir: -1,
      next: { panic: 1, range: 2, bear_trap: 1.2, bull: 0.8, capitulation: 0.6, accum: 0.6 }, hint: 'Sommets descendants. Chaque rebond se fait vendre.' },
    range: { name: 'Range', cls: 'range', drift: 0, vol: 0.7, mr: 0.05, mom: 0, volm: 0.85, dur: [30, 60], dir: 0,
      next: { bull: 1.5, bear: 1.5, lowvol: 1, highvol: 0.6, accum: 0.6 }, hint: 'Le marché fait du surplace. Jouez les bornes à contre-courant.' },
    highvol: { name: 'Forte volatilité', cls: 'volatile', drift: 0, vol: 2.0, mr: 0.01, mom: 0.3, volm: 1.6, dur: [15, 35], dir: 0,
      next: { range: 1, bull: 1, bear: 1, panic: 0.5, squeeze: 0.4 }, hint: 'Grandes bougies dans les deux sens. Réduisez la taille.' },
    lowvol: { name: 'Faible volatilité', cls: 'calm', drift: 0, vol: 0.35, mr: 0.07, mom: 0, volm: 0.5, dur: [20, 45], dir: 0,
      next: { bull: 1.5, bear: 1.5, squeeze: 0.5, highvol: 0.6 }, hint: 'Le ressort se comprime. La volatilité se contracte avant d’exploser.' },
    euphoria: { name: 'Euphorie', cls: 'euphoria', drift: 0.0025, vol: 1.4, mr: 0, mom: 1.3, volm: 1.8, dur: [15, 35], dir: 1,
      next: { bubble: 1, range: 1, crash: 0.6, bull_trap: 0.8 }, hint: 'Tout le monde est un génie. Pour l’instant.' },
    panic: { name: 'Panique', cls: 'panic', drift: -0.003, vol: 2.3, mr: 0, mom: 1, volm: 2.4, dur: [10, 25], dir: -1,
      next: { capitulation: 1.2, bear_trap: 1, range: 0.7, bear: 0.5 }, hint: 'On vend d’abord, on réfléchit ensuite.' },
    bull_trap: { name: 'Piège haussier', cls: 'trap', drift: 0.0018, flip: 0.45, flipDrift: -0.0028, vol: 1.2, mr: 0, mom: 0.5, volm: 1.3, dur: [25, 45], dir: 1,
      next: { bear: 2, panic: 0.6, range: 1 }, hint: 'Ça ressemble à un breakout. Ça n’en est pas un.' },
    bear_trap: { name: 'Piège baissier', cls: 'trap', drift: -0.0018, flip: 0.45, flipDrift: 0.0028, vol: 1.2, mr: 0, mom: 0.5, volm: 1.3, dur: [25, 45], dir: -1,
      next: { bull: 2, squeeze: 0.6, range: 1 }, hint: 'Les vendeurs à découvert s’entassent juste avant le retournement.' },
    bubble: { name: 'Bulle', cls: 'euphoria', drift: 0.0018, accel: 3, vol: 1.3, mr: 0, mom: 1.2, volm: 2, dur: [30, 55], dir: 1,
      next: { crash: 4, flash: 0.5 }, hint: 'Parabolique. Ça finit toujours de la même façon.' },
    crash: { name: 'Krach', cls: 'panic', drift: -0.006, vol: 2.6, mr: 0, mom: 1, volm: 3, dur: [10, 22], dir: -1,
      next: { capitulation: 2, panic: 1, bear_trap: 0.8 }, hint: 'La gravité gagne toujours.' },
    flash: { name: 'Flash Crash', cls: 'panic', drift: -0.065, flip: 0.15, flipDrift: 0.011, vol: 2.2, mr: 0, mom: 0, volm: 4, dur: [8, 14], dir: -1,
      next: { range: 1, highvol: 1, bull: 0.5 }, hint: 'Une falaise, puis un rebond. Clignez des yeux et c’est fini.' },
    squeeze: { name: 'Short Squeeze', cls: 'euphoria', drift: 0.007, vol: 1.9, mr: 0, mom: 1, volm: 3, dur: [8, 16], dir: 1,
      next: { highvol: 1, bull_trap: 1, range: 1 }, hint: 'Les vendeurs à découvert doivent racheter. Hausse violente.' },
    capitulation: { name: 'Capitulation', cls: 'panic', drift: -0.004, decay: true, vol: 2.1, mr: 0, mom: 0.6, volm: 3.5, dur: [10, 20], dir: -1,
      next: { accum: 3, bear_trap: 1 }, hint: 'Les derniers vendeurs jettent l’éponge. C’est ici que se forment les creux.' },
  };
  /* class-specific weight adjustments for regime selection */
  D.REGIME_CLASS_BIAS = {
    fx: { bubble: 0.05, crash: 0.2, flash: 0.3, squeeze: 0.15, euphoria: 0.4, panic: 0.5, capitulation: 0.4 },
    crypto: { bubble: 2, crash: 1.6, squeeze: 1.5, euphoria: 1.5, flash: 1.4, panic: 1.3 },
    index: { bubble: 0.5, squeeze: 0.3, flash: 0.6 },
    commodity: { squeeze: 0.7 },
    deriv: {},
    exotic: { bubble: 1.4, euphoria: 1.2 },
    stock: {},
  };
  D.REGIME_CLASS_LABEL = {
    calm: 'Calme', trend_up: 'Haussier', trend_down: 'Baissier', range: 'Range', volatile: 'Volatil', euphoria: 'Euphorique', panic: 'Panique', trap: 'Piège',
  };

  D.MACRO = {
    neutral: { name: 'Neutre', drift: 0, vol: 1, dur: [90, 180], next: { bull: 1, bear: 0.8, neutral: 0.3 }, up: 1, down: 1, sent: 0 },
    bull: { name: 'Bull Market', drift: 0.00025, vol: 0.9, dur: [120, 300], next: { neutral: 1, bear: 0.35 }, up: 1.45, down: 0.7, sent: 12 },
    bear: { name: 'Bear Market', drift: -0.00025, vol: 1.2, dur: [90, 220], next: { neutral: 0.8, recovery: 0.6, bull: 0.2 }, up: 0.7, down: 1.45, sent: -12 },
    recovery: { name: 'Reprise', drift: 0.0004, vol: 1.1, dur: [60, 120], next: { bull: 1, neutral: 1 }, up: 1.3, down: 0.8, sent: 4 },
    crisis: { name: 'CRISE', drift: -0.0008, vol: 2, dur: [60, 60], next: { recovery: 1 }, up: 0.3, down: 2.2, sent: -35, corr: 0.85 },
  };

  D.LEV_TIERS = [1, 2, 3, 5, 10, 20, 50, 100, 250, 1000, 10000, 1000000];
})(window.TE);
