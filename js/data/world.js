/* V2 — the living financial world: market actors, attention levels, regulators, financial calendar,
 * rumour follow-ups, player-driven headlines, rival personalities, micro-tutorials, run timeline.
 * Placeholders: {name} {sym} {fund} {who} {pct} {rival} {side}. French phrasing avoids articles before names. */
(function (TE) {
  'use strict';
  const D = TE.Data;

  /* ---------------- aggregated market actors ----------------
   * w: weight of the group's flow on prices · speed: how fast it adjusts its exposure (per second)
   * pres: presence by asset class (multiplies the weight) */
  D.AGENT_GROUPS = [
    { id: 'retail', name: 'Particuliers', short: 'PART.', color: '#8ea3bf', w: 0.8, speed: 0.32,
      pres: { crypto: 1.6, stock: 1.1, index: 0.6, fx: 0.4, commodity: 0.6, deriv: 0.5, exotic: 1 }, desc: 'Très sensibles au sentiment, aux grosses news et aux mouvements spectaculaires.' },
    { id: 'whale', name: 'Baleines', short: 'BAL.', color: '#19e6ff', w: 1.3, speed: 0.07,
      pres: { crypto: 1.6, stock: 1, index: 0.7, fx: 0.6, commodity: 1, deriv: 0.8, exotic: 1.2 }, desc: 'Lentes, mais capables de déplacer un marché à elles seules.' },
    { id: 'mom', name: 'Fonds momentum', short: 'MOM.', color: '#19f58c', w: 1, speed: 0.22,
      pres: { crypto: 1.2, stock: 1.1, index: 1, fx: 0.8, commodity: 1, deriv: 1, exotic: 1 }, desc: 'Suivent les tendances fortes — y compris celles que vous créez.' },
    { id: 'value', name: 'Fonds value', short: 'VAL.', color: '#e8c15a', w: 0.9, speed: 0.07,
      pres: { crypto: 0.4, stock: 1.3, index: 1.1, fx: 0.7, commodity: 1, deriv: 0.6, exotic: 0.8 }, desc: 'Achètent quand le prix tombe sous la juste valeur, vendent les excès.' },
    { id: 'hedge', name: 'Hedge funds', short: 'HF', color: '#a77bff', w: 1, speed: 0.14,
      pres: { crypto: 0.9, stock: 1.1, index: 1, fx: 1.1, commodity: 1, deriv: 1.3, exotic: 1 }, desc: 'Jouent les news, puis se retournent aux extrêmes de sentiment.' },
    { id: 'mm', name: 'Teneurs de marché', short: 'MM', color: '#6cf0a0', w: 0.55, speed: 0.5,
      pres: { crypto: 0.8, stock: 1, index: 1.2, fx: 1.4, commodity: 1, deriv: 1.1, exotic: 1 }, desc: 'Fournissent la liquidité. Ils élargissent les spreads et se retirent dans la panique.' },
    { id: 'hft', name: 'HFT', short: 'HFT', color: '#ff7ac8', w: 0.45, speed: 0.9,
      pres: { crypto: 1, stock: 1.1, index: 1.3, fx: 1.2, commodity: 0.8, deriv: 1, exotic: 0.8 }, desc: 'Amplifient les micro-mouvements et génèrent beaucoup de volume.' },
    { id: 'inst', name: 'Institutionnels', short: 'INST.', color: '#3d8bff', w: 1.2, speed: 0.04,
      pres: { crypto: 0.5, stock: 1.2, index: 1.5, fx: 1.3, commodity: 0.9, deriv: 0.8, exotic: 1 }, desc: 'Suivent le cycle macro, lentement mais massivement.' },
    { id: 'short', name: 'Vendeurs à découvert', short: 'SHORT', color: '#ff3d68', w: 0.9, speed: 0.09,
      pres: { crypto: 1, stock: 1.3, index: 0.7, fx: 0.4, commodity: 0.8, deriv: 0.9, exotic: 1 }, desc: 'S’accumulent quand les prix deviennent excessifs. Forcés de racheter, ils déclenchent les squeezes.' },
  ];
  D.AGENT_MAP = {};
  D.AGENT_GROUPS.forEach((g, i) => { g.i = i; D.AGENT_MAP[g.id] = g; });

  /* ---------------- market attention (how much the financial world watches you) ---------------- */
  D.ATT_LEVELS = [
    { at: 0, name: 'Discret', desc: 'Personne ne parle de vous.' },
    { at: 15, name: 'Remarqué', desc: 'Le fil d’actualités commence à évoquer « un trader anonyme ».' },
    { at: 40, name: 'Sous les projecteurs', desc: 'Le nom de votre firme apparaît dans les médias.' },
    { at: 70, name: 'Incontournable', desc: 'Concurrents, médias et régulateurs réagissent à chacun de vos gestes.' },
  ];

  /* ---------------- regulators ---------------- */
  D.REG_ACTIONS = [
    { id: 'inquiry', min: 30, w: 4, name: 'DEMANDE D’INFORMATIONS', relief: 6 },
    { id: 'audit', min: 40, w: 3, name: 'CONTRÔLE RÉGLEMENTAIRE', relief: 12 },
    { id: 'restrict', min: 50, w: 2.5, name: 'RESTRICTION TEMPORAIRE', relief: 18 },
    { id: 'fine', min: 60, w: 2, name: 'AMENDE', relief: 26 },
    { id: 'scandal', min: 78, w: 1.2, name: 'SCANDALE', relief: 32 },
  ];

  /* ---------------- financial calendar ---------------- */
  D.CALENDAR = [
    { id: 'earnings', cls: 'stock', name: 'RÉSULTATS {sym}', icon: '▤', w: 3, kind: 'asset',
      up: '{name} publie des résultats supérieurs aux attentes (+{pct}).', down: '{name} manque le consensus : chiffre d’affaires en baisse de {pct}.' },
    { id: 'rate', name: 'DÉCISION DE TAUX', icon: '⚖', w: 2, kind: 'macro',
      up: 'La banque centrale surprend par une baisse de taux. Les actifs risqués s’envolent.', down: 'Hausse de taux plus forte que prévu. Les marchés encaissent le choc.' },
    { id: 'cpi', name: 'RAPPORT D’INFLATION', icon: '%', w: 2, kind: 'macro',
      up: 'Inflation plus faible qu’attendu : soulagement sur les marchés.', down: 'Inflation plus forte qu’attendu : les marchés se crispent.' },
    { id: 'jobs', name: 'CHIFFRES DE L’EMPLOI', icon: '☺', w: 1.6, kind: 'classes', classes: ['fx', 'index'],
      up: 'Créations d’emplois record : devises et indices réagissent.', down: 'Le marché de l’emploi déçoit : devises et indices reculent.' },
    { id: 'inventory', cls: 'commodity', name: 'STOCKS — {sym}', icon: '⛽', w: 1.6, kind: 'asset',
      up: '{name} : stocks en forte baisse, l’offre se resserre (+{pct}).', down: '{name} : stocks bien plus élevés que prévu ({pct}).' },
    { id: 'netupgrade', cls: 'crypto', name: 'MISE À JOUR RÉSEAU — {sym}', icon: '⟳', w: 1.6, kind: 'asset',
      up: 'Mise à jour du réseau {name} réussie : le marché applaudit (+{pct}).', down: 'Mise à jour du réseau {name} ratée : bug critique ({pct}).' },
    { id: 'frontier', cls: 'exotic', name: 'RAPPORT ORBITAL — {sym}', icon: '◌', w: 1.4, kind: 'asset',
      up: '{name} : rendement d’extraction record (+{pct}).', down: '{name} : incident sur la chaîne d’approvisionnement orbitale ({pct}).' },
  ];
  D.CAL_MAP = {};
  D.CALENDAR.forEach((c) => { D.CAL_MAP[c.id] = c; });

  /* ---------------- rumour follow-ups ---------------- */
  D.RUMOR_FOLLOW = {
    confirm: ['CONFIRMÉ — {name} confirme l’information. Deuxième vague sur {sym}.', 'CONFIRMÉ — Des sources officielles valident la rumeur sur {sym}.', 'CONFIRMÉ — {name} publie un communiqué : la rumeur était fondée.'],
    deny: ['DÉMENTI — {name} dément formellement. {sym} se retourne.', 'DÉMENTI — « Aucune opération en cours », assure {name}. Retournement sur {sym}.', 'DÉMENTI — La rumeur sur {sym} était infondée. Les spéculateurs débouclent.'],
  };

  /* ---------------- headlines caused by the player ---------------- */
  D.PLAYER_NEWS = {
    accum_anon: ['MOUVEMENT INHABITUEL — Une baleine accumule massivement {sym}.', 'MOUVEMENT INHABITUEL — Un acheteur mystère rafle tout le carnet de {sym}.'],
    accum_named: ['{fund} prend une position majeure sur {sym}.', '{fund} accumule {sym} : les desks s’alignent.'],
    short_anon: ['Une importante position SHORT fait trembler {sym}.', 'Un vendeur massif et anonyme pèse sur {sym}.'],
    short_named: ['{fund} parie massivement contre {sym}.', '{fund} ouvre un énorme SHORT sur {sym} : les acheteurs reculent.'],
    volume: ['{who} aurait généré plus de {pct} du volume de {sym} sur les dernières minutes.'],
    exposure: ['EXPOSITION — {who} détiendrait une position géante sur {sym}. Les marchés s’interrogent.'],
    squeeze: ['SHORT SQUEEZE — Plusieurs fonds forcés de racheter leurs positions sur {sym}.'],
    squeeze_me: ['SHORT SQUEEZE — Plusieurs fonds forcés de racheter leurs positions sur {sym}. {who} est à la manœuvre.'],
    cascade: ['CASCADE DE LIQUIDATIONS — Les positions LONG à levier sautent en chaîne sur {sym}.'],
    cascade_me: ['CASCADE DE LIQUIDATIONS — {sym} s’effondre. {who} vendait massivement.'],
    reg: ['RÉGULATEUR — {who} : l’activité récente attire l’attention.', 'RÉGULATEUR — {who} : le gendarme des marchés surveille de près vos ordres.'],
    whale: ['MOUVEMENT INHABITUEL — Une baleine {side} massivement {sym}.'],
  };

  /* ---------------- rival personalities (by rival id) ---------------- */
  D.RIVAL_AI = {
    helix: { aggr: 0.45, risk: 3, fav: ['fx', 'index', 'commodity'], rep: 'Prudent et systématique' },
    titan: { aggr: 0.7, risk: 4, fav: ['stock', 'crypto'], rep: 'Agressif sur les actions' },
    apex: { aggr: 0.35, risk: 2, fav: ['index', 'fx'], rep: 'Teneur de marché discret' },
    meridianp: { aggr: 0.5, risk: 3, fav: ['stock', 'commodity', 'index'], rep: 'Diversifié' },
    obsidian: { aggr: 0.75, risk: 5, fav: ['crypto', 'stock'], rep: 'Prédateur haute fréquence' },
    silverheron: { aggr: 0.3, risk: 2, fav: ['index', 'stock'], rep: 'Gestionnaire conservateur' },
    blackstone: { aggr: 0.6, risk: 3, fav: ['stock', 'index', 'commodity', 'deriv'], rep: 'Présent partout' },
    northstar: { aggr: 0.4, risk: 2, fav: ['fx', 'index', 'commodity'], rep: 'Capital patient et souverain' },
    ouroboros: { aggr: 0.85, risk: 6, fav: ['crypto', 'exotic', 'deriv'], rep: 'IA autonome et imprévisible' },
    martian: { aggr: 0.6, risk: 4, fav: ['exotic'], rep: 'Bourse interplanétaire' },
    entity: { aggr: 0.95, risk: 7, fav: ['exotic', 'deriv', 'crypto'], rep: '???' },
  };
  D.RIVAL_NEWS = {
    open: ['{rival} ouvre une importante position {side} sur {sym}.', '{rival} se positionne {side} sur {sym} : les volumes s’envolent.'],
    attack: ['{rival} attaque la position de {fund} sur {sym}.'],
    win: ['{rival} engrange un gros gain sur {sym} ({pct}).'],
    loss: ['{rival} subit de lourdes pertes sur {sym} ({pct}).'],
    trouble: ['{rival} ferme un desk entier après la crise.', '{rival} en difficulté : les investisseurs retirent leurs capitaux.'],
    overtake: ['{rival} dépasse {fund} au classement mondial.'],
    poach: ['{rival} tente de débaucher {name} avec un pont d’or.'],
  };

  /* ---------------- one-time micro-explanations ---------------- */
  D.TIPS = {
    impact: { title: 'IMPACT DE MARCHÉ', text: 'Votre ordre représente une part importante de la liquidité disponible. Il peut déplacer le prix — et vous payez un glissement à l’exécution. Regardez l’estimation d’impact avant de valider.' },
    calendar: { title: 'CALENDRIER FINANCIER', text: 'Une annonce majeure aura lieu dans moins d’une minute. Préparez vos positions : le marché réagira au moment de la publication.' },
    rumor: { title: 'RUMEUR À SUIVRE', text: 'Les rumeurs sont désormais confirmées ou démenties une vingtaine de secondes plus tard. Une confirmation relance le mouvement ; un démenti le retourne.' },
    attention: { title: 'LE MARCHÉ VOUS REGARDE', text: 'Vos gros ordres sont remarqués. Plus votre attention de marché est élevée, plus les médias, les concurrents et les régulateurs réagissent à ce que vous faites.' },
    regulator: { title: 'PRESSION RÉGLEMENTAIRE', text: 'Les régulateurs s’intéressent à vous. Au-delà de 30 %, des contrôles, restrictions ou amendes deviennent possibles. La conformité, les risk managers et le lobbying réduisent la pression.' },
    squeeze: { title: 'SQUEEZE ET CASCADES', text: 'Quand trop de vendeurs à découvert (ou d’acheteurs à levier) sont pris à contre-pied, le marché peut s’emballer. Surveillez le positionnement des acteurs sous le graphique.' },
    office: { title: 'VOTRE SIÈGE', text: 'Votre société prend vie dans la vue SIÈGE : chaque employé, serveur et recrue légendaire y apparaît. Cliquez sur une zone pour ouvrir le panneau correspondant.' },
    evolution: { title: 'ÉVOLUTION', text: 'La vue ÉVOLUTION retrace votre ascension : chaque grand palier est enregistré, et vous pouvez comparer cette partie à vos records.' },
    highlev: { title: 'LEVIER EXTRÊME', text: 'Au-delà de x100, la liquidation se déclenche à quelques fractions de pourcent et peut coûter plus que la marge : vous perdez le mouvement réel × le notionnel. Le levier n’augmente pas la taille maximale, seulement le risque.' },
  };

  /* ---------------- run timeline: keys recorded once per run ---------------- */
  D.TIMELINE_EARN = [[1e3, 'Premier 1 000 $'], [1e4, 'Premiers 10 000 $'], [1e5, 'Premiers 100 000 $'], [1e6, 'Premier million'], [1e7, 'Premiers 10 M$'], [1e8, 'Premiers 100 M$'],
    [1e9, 'Premier milliard'], [1e10, '10 milliards'], [1e12, 'Mille milliards'], [1e15, 'Un billiard'], [1e18, 'Un trillion'], [1e21, 'Un trilliard'], [1e24, 'Un quadrillion'], [1e27, 'Un quadrilliard'], [1e30, 'Un quintillion']];
  /* best-time keys compared across runs (label, key) */
  D.RECORD_KEYS = [['earn_1e6', 'Premier million'], ['earn_1e9', 'Premier milliard'], ['era_2', 'Trader professionnel'], ['era_3', 'Hedge Fund'], ['era_4', 'Institutionnel'],
    ['era_5', 'Empire mondial'], ['era_6', 'Domination algorithmique'], ['era_7', 'Singularité'], ['fund', 'Fonds créé'], ['empire', 'Empire ouvert'], ['p1', 'Liquidation possible']];
})(window.TE);
