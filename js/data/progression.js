/* Progression: eras, UI feature unlocks, net-worth milestones, tutorial, abilities, combo tiers. */
(function (TE) {
  'use strict';
  const D = TE.Data;

  /* at: price level of the era's content (an item costing ≥ at belongs to that era) — unchanged since v1.
   * req (V2): earnings needed in the run to ENTER the era. Slightly above `at`, so systems get a little more room
   * to breathe without moving any content between eras. */
  D.ERAS = [
    { n: 1, roman: 'I', name: 'Trader indépendant', at: 0, req: 0, tag: 'Un portable. Un graphique. Cent dollars.' },
    { n: 2, roman: 'II', name: 'Trader professionnel', at: 1e5, req: 1.4e5, tag: 'Du vrai capital. De vrais outils. De vrais risques.' },
    { n: 3, roman: 'III', name: 'Hedge Fund', at: 1e7, req: 1.5e7, tag: 'L’argent des autres. Vos règles.' },
    { n: 4, roman: 'IV', name: 'Finance institutionnelle', at: 1e10, req: 1.1e10, tag: 'Banques, bourses et toute la tuyauterie du capitalisme.' },
    { n: 5, roman: 'V', name: 'Empire financier mondial', at: 1e13, req: 1.15e13, tag: 'Chaque marché de la planète vous rend des comptes.' },
    { n: 6, roman: 'VI', name: 'Domination algorithmique', at: 1e16, req: 1.2e16, tag: 'Les machines tradent. Les machines, c’est vous qui les possédez.' },
    { n: 7, roman: 'VII', name: 'Singularité financière', at: 1e22, req: 2.5e22, tag: 'L’argent cesse d’être un nombre et devient une loi de la physique.' },
  ];

  /* Earnings (in the current run) that open the main panels — also used by the "next goal" indicator. */
  D.FEATURE_EARN = { bots: 40, infra: 150, research: 2000, staff: 22000, fund: 3e6, prestige: 2.6e8, empire: 1.3e9 };
  const FE = D.FEATURE_EARN;

  /* Navigation features, in display order. cond(s) -> unlocked. Unlocks persist in the profile. */
  D.FEATURES = [
    { id: 'market', name: 'Marché', icon: '◱', key: 1, cond: () => true },
    { id: 'office', name: 'Siège', icon: '⌂', key: 0, cond: (s) => s.run.earnings >= 40 || s.profile.prestige.p1 > 0 },
    { id: 'portfolio', name: 'Portefeuille', icon: '◧', key: 2, cond: (s) => (s.run.stats.trades || 0) >= 4 },
    { id: 'bots', name: 'Bots', icon: '⚙', key: 3, cond: (s) => s.run.earnings >= FE.bots },
    { id: 'upgrades', name: 'Améliorations', icon: '⬆', key: 4, cond: (s) => s.run.earnings >= 1 || s.run.cash >= 140 },
    { id: 'research', name: 'Recherche', icon: '⚗', key: 5, cond: (s) => s.run.earnings >= FE.research },
    { id: 'infra', name: 'Infrastructure', icon: '▦', key: 6, cond: (s) => s.run.earnings >= FE.infra },
    { id: 'staff', name: 'Employés', icon: '☺', key: 7, cond: (s) => s.run.earnings >= FE.staff },
    { id: 'fund', name: 'Fonds', icon: '◈', key: 8, cond: (s) => s.run.earnings >= FE.fund },
    { id: 'empire', name: 'Empire', icon: '♛', key: 9, cond: (s) => s.run.earnings >= FE.empire },
    { id: 'contracts', name: 'Contrats', icon: '✎', cond: (s) => s.run.earnings >= 25 },
    { id: 'evolution', name: 'Évolution', icon: '⟰', cond: (s) => s.run.earnings >= 1000 || s.profile.prestige.p1 > 0 },
    { id: 'achievements', name: 'Succès', icon: '★', cond: (s) => Object.keys(s.profile.achievements).length > 0 },
    { id: 'stats', name: 'Statistiques', icon: '≣', cond: (s) => (s.run.stats.trades || 0) >= 12 || s.profile.playtime > 420 },
    { id: 'prestige', name: 'Prestige', icon: 'α', cond: (s) => s.run.earnings >= FE.prestige || s.profile.prestige.p1 > 0 },
    { id: 'settings', name: 'Paramètres', icon: '⚙', cond: () => true, bottom: true },
  ];
  D.FEATURE_MAP = {};
  D.FEATURES.forEach((f) => { D.FEATURE_MAP[f.id] = f; });

  /* Net-worth milestones with celebration. */
  D.MILESTONES = [
    { at: 1e3, title: 'QUATRE CHIFFRES', sub: 'Vos premiers 1 000 $. Tout commence.' },
    { at: 1e4, title: 'CINQ CHIFFRES', sub: '10 000 $. Les graphiques commencent à avoir du sens.' },
    { at: 1e5, title: 'SIX CHIFFRES', sub: '100 000 $. Il est temps de passer pro.' },
    { at: 1e6, title: 'MILLIONNAIRE', sub: 'De 100 $ à 1 000 000 $.' },
    { at: 1e7, title: 'MULTIMILLIONNAIRE', sub: '10 M$. Les investisseurs vous appellent.' },
    { at: 1e8, title: 'CENTIMILLIONNAIRE', sub: '100 M$. On murmure votre nom dans les salles de marché.' },
    { at: 1e9, title: 'MILLIARDAIRE', sub: 'Un milliard de dollars. Vous pourriez vous arrêter là. Vous ne le ferez pas.' },
    { at: 1e10, title: 'CLUB DES DIX MILLIARDS', sub: 'Les institutions prennent désormais vos appels.' },
    { at: 1e11, title: 'CENTIMILLIARDAIRE', sub: 'Plus riche que le budget de la plupart des pays.' },
    { at: 1e12, title: 'BILLIONNAIRE', sub: 'Mille milliards. Le premier billionnaire de l’histoire.' },
    { at: 1e13, title: 'SOUVERAIN DES MARCHÉS', sub: '10 000 milliards. Les banques centrales vous consultent.' },
    { at: 1e15, title: 'BILLIARDAIRE', sub: 'Plus d’argent que le PIB de toute la planète.' },
    { at: 1e18, title: 'TRILLIONNAIRE', sub: 'Les nombres ne veulent plus rien dire. Sauf que si.' },
    { at: 1e21, title: 'TRILLIARDAIRE', sub: 'Votre fortune possède son propre champ gravitationnel.' },
    { at: 1e24, title: 'QUADRILLIONNAIRE', sub: 'Bug d’argent infini : confirmé.' },
    { at: 1e27, title: 'QUADRILLIARDAIRE', sub: 'Vous payez les étoiles avec votre petite monnaie.' },
    { at: 1e30, title: 'QUINTILLIONNAIRE', sub: 'La singularité est à portée de main.' },
    { at: 1e33, title: 'QUINTILLIARDAIRE', sub: 'L’argent est devenu une loi de la physique. La vôtre.' },
  ];

  /* Contextual, lightweight tutorial. show(s) / done(s) */
  D.TUTORIAL = [
    { id: 'long', anchor: '#btn-long', side: 'left', text: 'Le prix <b>monte</b> ? Ouvrez un <b>LONG</b> : vous gagnez quand il grimpe. <kbd>L</kbd>',
      show: (s) => true, done: (s) => (s.profile.stats.opens || 0) >= 1 },
    { id: 'close', anchor: '#pos-card', side: 'left', text: 'Votre PnL évolue en direct. <b>FERMEZ</b> la position pour l’encaisser. <kbd>Espace</kbd>',
      show: (s) => Object.keys(s.run.account.positions).length > 0, done: (s) => (s.profile.stats.trades || 0) >= 1 },
    { id: 'short', anchor: '#btn-short', side: 'left', text: 'Le prix <b>baisse</b> ? Un <b>SHORT</b> gagne quand il chute. <kbd>S</kbd>',
      show: (s) => (s.profile.stats.trades || 0) >= 1 && Object.keys(s.run.account.positions).length === 0, done: (s) => (s.profile.stats.shorts || 0) >= 1 || (s.profile.stats.trades || 0) >= 4 },
    { id: 'upgrades', anchor: '[data-nav="upgrades"]', side: 'right', text: 'Vous pouvez vous offrir une <b>amélioration</b>. Chacune rend tous vos trades meilleurs.',
      show: (s) => s.run.cash >= 15 && s.run.earnings > 0 && s.profile.features.upgrades, done: (s) => Object.keys(s.run.upgrades).length >= 1 },
    { id: 'leverage', anchor: '#lev-row', side: 'left', text: 'Le <b>levier</b> multiplie les gains <i>et</i> les pertes. Surveillez la ligne rouge de liquidation.',
      show: (s) => !!s.run.upgrades.lev2, done: (s) => (s.profile.records.maxLevUsed || 1) >= 2 },
    { id: 'bots', anchor: '[data-nav="bots"]', side: 'right', text: 'Les <b>bots</b> tradent pour vous, sans relâche. Déployez le premier.',
      show: (s) => s.profile.features.bots && s.run.cash >= 50, done: (s) => (s.profile.stats.botsBought || 0) >= 1 },
    { id: 'contracts', anchor: '[data-nav="contracts"]', side: 'right', text: 'Les <b>contrats</b> rapportent des bonus quand vous atteignez des objectifs.',
      show: (s) => s.profile.features.contracts, done: (s) => (s.profile.stats.contracts || 0) >= 1 || (s.profile.uiVisited && s.profile.uiVisited.contracts) },
    { id: 'research', anchor: '[data-nav="research"]', side: 'right', text: 'La <b>recherche</b> est en ligne. Dépensez vos points de recherche (RP) en technologies durables.',
      show: (s) => s.profile.features.research && s.run.research.rp >= 12, done: (s) => Object.keys(s.run.research.done).length >= 1 },
  ];

  /* Active abilities. */
  D.ABILITIES = [
    { id: 'focus', name: 'Concentration absolue', icon: '◎', key: 'Q', flag: 'ab.focus', cd: 90, dur: 20, desc: 'Profits manuels ×3 pendant 20 s.',
      mods: [{ stat: 'manual.profit', mult: 3 }] },
    { id: 'overclock', name: 'Overclocking', icon: '⚡', key: 'W', flag: 'ab.overclock', cd: 120, dur: 20, desc: 'Vitesse des bots ×2,5 pendant 20 s.',
      mods: [{ stat: 'bot.all.speed', mult: 2.5 }] },
    { id: 'liquidity', name: 'Injection de liquidités', icon: '⛁', key: 'E', flag: 'ab.liquidity', cd: 300, dur: 30, desc: 'Tous les revenus ×2 pendant 30 s et afflux de souscriptions.',
      mods: [{ stat: 'income.global', mult: 2 }] },
    { id: 'hype', name: 'Campagne de hype', icon: '📣', key: 'R', flag: 'ab.hype', cd: 150, dur: 20, desc: 'Fait grimper le marché sélectionné pendant 20 s.' },
    { id: 'shortreport', name: 'Rapport short', icon: '✂', key: 'T', flag: 'ab.shortreport', cd: 150, dur: 20, desc: 'Fait plonger le marché sélectionné pendant 20 s.' },
    { id: 'rate', name: 'Décision de taux', icon: '⚖', key: 'Y', flag: 'ab.rate', cd: 600, dur: 120, desc: 'Force un bull market pendant 120 s.' },
    { id: 'timedil', name: 'Dilatation temporelle', icon: '⧗', key: 'U', flag: 'ab.timedil', cd: 900, dur: 15, desc: 'La simulation tourne ×10 pendant 15 secondes réelles.' },
  ];
  D.ABILITY_MAP = {};
  D.ABILITIES.forEach((a) => { D.ABILITY_MAP[a.id] = a; });

  /* Win streak tiers (manual trading). mult applies to all income. */
  D.COMBO_TIERS = [
    { n: 3, mult: 1.05, name: 'CHAUD' },
    { n: 5, mult: 1.1, name: 'BRÛLANT' },
    { n: 10, mult: 1.25, name: 'EN FEU' },
    { n: 20, mult: 1.5, name: 'INARRÊTABLE' },
    { n: 35, mult: 2, name: 'DIVIN' },
    { n: 50, mult: 3, name: 'FAIS-MOI CONFIANCE' },
  ];

  D.REP_TIERS = [
    { at: 0, name: 'Inconnu' }, { at: 10, name: 'Talent local' }, { at: 50, name: 'Étoile montante' }, { at: 200, name: 'Respecté' },
    { at: 1000, name: 'Renommé' }, { at: 5000, name: 'Élite' }, { at: 25000, name: 'Légendaire' }, { at: 1e5, name: 'Systémique' },
    { at: 1e6, name: 'Mythique' }, { at: 1e7, name: 'Divin' },
  ];
})(window.TE);
