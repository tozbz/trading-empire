/* News templates. {name} {sym} {product} {n} placeholders. up/down headlines move prices after a short delay.
 * French grammar: names are used without articles ("{name} : …"), {product} carries its own article. */
(function (TE) {
  'use strict';
  const D = TE.Data;

  D.NEWS = {
    stock: {
      up: ['{name} dévoile {product} : « une révolution »', '{name} pulvérise les attentes : bénéfices supérieurs de {n} %', 'Les analystes relèvent {sym} à ACHAT FORT',
        '{name} décroche un contrat public record', '{name} annonce un rachat d’actions de {n} milliards de dollars', 'Note interne : chez {name}, la demande « explose tous les compteurs »',
        'Le PDG de {name} achète des actions à titre personnel : « nous sommes sous-évalués »', '{name} s’associe à trois des plus grands constructeurs automobiles mondiaux'],
      down: ['Le PDG de {name} visé par une enquête pour irrégularités comptables', 'Défaut de fabrication : {name} rappelle {n}0 000 unités',
        'Un vendeur à découvert publie un rapport de 90 pages sur {sym}', '{name} reporte son lancement phare « sine die »', 'Un fournisseur clé rompt avec {name}',
        'Prévisions décevantes chez {name} : les analystes dégradent', 'Un incendie d’usine paralyse la production de {name}'],
    },
    crypto: {
      up: ['Une mystérieuse baleine accumule du {sym}', '{name} listé sur la plus grande plateforme d’échange au monde', 'Un grand réseau de paiement intègre {name}',
        'Activité record sur le réseau {name}', 'Un État souverain ajoute du {sym} à ses réserves', 'Mise à jour de {name} livrée sans bug (pour une fois)'],
      down: ['Plateforme {name} : « retraits inhabituels » signalés', 'Une faille de bridge siphonne {n}00 M$ de {sym}', 'Le régulateur qualifie {name} de titre financier non enregistré',
        'Le fondateur de {name} aperçu embarquant sur un aller simple', 'Les mineurs liquident leur {sym} après une hausse de difficulté', 'Le réseau {name} à l’arrêt pendant 6 heures'],
    },
    fx: {
      up: ['{sym} : des propos agressifs de la banque centrale soutiennent la devise', 'Excellents chiffres de l’emploi : {sym} grimpe', 'L’excédent commercial se creuse : {sym} recherché'],
      down: ['{sym} : une surprise accommodante pèse sur la devise', 'PMI décevant : {sym} recule', 'La crise politique frappe {sym}'],
    },
    commodity: {
      up: ['{name} : rupture d’approvisionnement chez un grand producteur', '{name} : demande record attendue', '{name} : les réserves stratégiques achètent massivement'],
      down: ['{name} : les stocks gonflent au-delà des attentes', '{name} : découverte d’un gisement géant', '{name} : la demande ralentit'],
    },
    index: {
      up: ['Saison des résultats exceptionnelle : {sym} s’envole', 'Plan de relance : les futures {sym} bondissent', 'Les gérants se repositionnent sur {sym}'],
      down: ['Craintes de récession : les futures {sym} chutent', 'Débâcle de la tech : {sym} recule', 'Envolée des taux obligataires : {sym} glisse'],
    },
    deriv: {
      up: ['Ruée sur les couvertures : {sym} recherché', 'Les teneurs d’options se couvrent en catastrophe : {sym} flambe'],
      down: ['Le calme revient sur les marchés : {sym} se dégonfle', 'Les vendeurs de volatilité inondent {sym}'],
    },
    exotic: {
      up: ['{name} : nouvelle route d’approvisionnement orbitale approuvée', '{name} : la demande des colonies double', '{name} : relevé en « investment grade » par les agences martiennes'],
      down: ['{name} : un lancement raté retarde les livraisons', '{name} : une tempête solaire endommage les infrastructures', '{name} : le tribunal spatial rejette ses revendications'],
    },
  };

  D.NEWS_FLAVOR = [
    'Un homme découvre les intérêts composés et refuse d’en dire plus.',
    'Les traders de futures sur le café affichent des taux de caféine record.',
    'Étude : 94 % des traders se pensent au-dessus de la moyenne.',
    'Un analyste prédit que les marchés vont « monter, baisser ou stagner ».',
    'Un hedge fund remplace son équipe de recherche par un golden retriever ; rendement inchangé.',
    'Les économistes tombent d’accord pour la première fois ; les marchés ne savent pas comment réagir.',
    'Un influenceur lance une formation pour devenir riche. Prix : tout ce que vous possédez.',
    'Le gouverneur de la banque centrale aperçu en train de sourire. Douze analystes publient une note.',
    'Un stagiaire vend accidentellement à découvert la machine à café du bureau.',
    'Sondage : 7 day traders sur 10 sont « à un trade » de la retraite.',
    'Panne de la Bourse attribuée à « un écureuil ». L’écureuil n’a pas souhaité réagir.',
    'Un nouvel ETF réplique la performance des autres ETF. Il se réplique aussi lui-même.',
    'Un milliardaire achète un yacht pour ranger son autre yacht.',
    'Le rapport trimestriel le confirme : la courbe est montée.',
    'Rumeur : quelqu’un, quelque part, aurait lu le prospectus en entier.',
    'Un trader baptise son nouveau-né « Haussier ». Recours déposé par le conjoint.',
    'Un robot aspirateur fait mieux que 80 % des gérants de fonds.',
    'Les marchés sont « prudemment optimistes » à l’idée d’être prudemment optimistes.',
    'Le cours de la tulipe reste historiquement stable. Pour l’instant.',
    'Les physiciens le confirment : l’argent ne se crée ni ne se perd, il se met à levier.',
  ];

  D.NEWS_EMPIRE = [
    { at: 1e6, text: 'Les forums de trading s’enflamment : un trader anonyme aurait transformé 100 $ en 1 M$.' },
    { at: 1e8, text: 'Une lettre spécialisée classe {fund} parmi « les fonds à suivre ».' },
    { at: 1e10, text: 'La presse financière dresse le portrait de {fund} : « la firme à la croissance la plus rapide dont personne n’avait entendu parler ».' },
    { at: 1e12, text: 'Une commission sénatoriale somme {fund} de « s’expliquer ». {fund} envoie un PowerPoint.' },
    { at: 1e14, text: 'Selon les analystes, {fund} intervient désormais dans un trade sur cinq dans le monde.' },
    { at: 1e16, text: 'Plusieurs pays indexent discrètement leur monnaie sur la performance de {fund}.' },
    { at: 1e18, text: '{fund} publie ses résultats trimestriels. Le PIB mondial est révisé en conséquence.' },
    { at: 1e21, text: 'Des historiens proposent de rebaptiser le siècle en l’honneur de {fund}.' },
    { at: 1e24, text: 'Des astronomes repèrent le logo de {fund} sur un essaim de Dyson. Personne n’est surpris.' },
    { at: 1e28, text: '{fund} rachète le concept même d’argent. Montant de l’opération non divulgué.' },
  ];
})(window.TE);
