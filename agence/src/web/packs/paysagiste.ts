import type { PackDef } from './types';

export const paysagiste: PackDef = {
  slug: 'paysagiste',
  metier: 'Paysagiste',
  activity: 'Paysagiste',
  icon: 'jardin',
  visual: 'site-paysage',
  keyword: 'communication paysagiste création entreprise',
  metaTitle: 'Pack communication pour lancer son entreprise de paysage',
  metaDescription: 'Vous créez votre entreprise de paysage ? Site avec galerie avant/après, logo, flyers de saison, fiche Google, panneaux de chantier et utilitaire floqué.',
  card: {
    title: 'Paysagiste, entretien de jardins',
    text: 'Galerie avant/après, demandes de devis détaillées, flyers de saison, utilitaire floqué et panneaux de chantier.',
  },

  eyebrow: 'Pack Bien démarrer · Paysagiste',
  h1: 'Vous lancez votre entreprise de paysage ?',
  h1em: 'Que vos jardins parlent pour vous.',
  intro:
    'Vous savez créer et entretenir de beaux jardins. Il reste à le faire savoir aux particuliers et aux professionnels de votre secteur, avec une image sérieuse dès le premier devis. Ce pack rassemble les outils dont un paysagiste a besoin pour remplir son carnet de commandes.',
  stakes: {
    title: 'Les enjeux d’un paysagiste qui démarre',
    body: `Le métier de paysagiste a une particularité : **les clients achètent sur photo**. Avant d’accepter un devis pour une terrasse, une haie ou un aménagement complet, un particulier veut voir ce que vous avez déjà réalisé. Sans réalisations à montrer, il se tourne vers une entreprise plus installée, même plus chère.

Au démarrage, il faut donc construire très vite une **vitrine crédible** : un nom et un logo qui inspirent confiance, quelques chantiers bien photographiés, des prestations clairement présentées. Il faut aussi séparer deux activités qui ne se vendent pas de la même façon : la **création** (projets ponctuels, budgets plus élevés, décision réfléchie) et l’**entretien** (contrats réguliers, clientèle fidèle, souvent proche géographiquement).

Enfin, l’activité est saisonnière. Les demandes d’aménagement arrivent au printemps, la taille et les plantations à l’automne. Une communication bien calée sur les saisons évite les creux d’activité.`,
  },
  mistakes: {
    title: 'Les erreurs fréquentes des paysagistes qui démarrent',
    items: [
      ['Pas de photos « avant »', 'On pense à photographier le jardin terminé, rarement le terrain de départ. Or c’est le comparatif avant/après qui convainc.'],
      ['Un utilitaire anonyme', 'Le véhicule stationne devant chaque chantier pendant des jours. Sans marquage, cette visibilité est perdue.'],
      ['Des devis demandés sans informations', 'Un simple « contactez-nous » oblige à multiplier les déplacements pour chiffrer. Un formulaire qui demande surface et photos fait gagner du temps.'],
      ['Une zone d’intervention floue', 'Accepter des chantiers trop loin mange la rentabilité. Afficher clairement votre secteur attire les bons clients.'],
      ['Communiquer seulement quand le carnet est vide', 'Les flyers d’automne se préparent en été. Anticiper les saisons lisse l’activité sur l’année.'],
    ],
  },

  base: {
    priceFrom: '1 790 €',
    intro: 'Le pack de base donne à votre entreprise de paysage une présence professionnelle complète, de la carte de visite à la fiche Google.',
    site: {
      title: 'Un site de paysagiste',
      items: [
        'Page d’accueil construite autour de grandes photos de jardins',
        'Une page par prestation : création, entretien, taille et élagage, clôtures, terrasses et allées',
        'Galerie de réalisations, organisée par type de projet',
        'Formulaire de demande de visite (surface, type de travaux, photos du terrain)',
        'Zone d’intervention clairement indiquée',
        'Page « Entretien » qui présente vos formules régulières',
      ],
    },
    graphic: {
      title: 'L’identité et les supports',
      items: [
        'Logo, ou mise au propre de votre logo existant, lisible sur un véhicule et un panneau',
        'Couleurs et typographies cohérentes avec votre approche (naturelle, contemporaine, haut de gamme…)',
        'Cartes de visite',
        'Flyer de présentation et flyer de saison (entretien d’automne, taille d’hiver)',
        'Modèle d’en-tête de devis et de facture à vos couleurs',
      ],
    },
    prints: [
      ['Cartes de visite', '500 exemplaires'],
      ['Flyers de présentation ou de saison', '1 000 exemplaires'],
    ],
    google: [
      'Création de la fiche Google Business Profile avec zone desservie (adresse masquée si vous travaillez de chez vous)',
      'Catégories adaptées (paysagiste, entretien de jardins…) et liste de vos services',
      'Photos de chantiers et description sans jargon',
      'Lien direct pour demander un avis en fin de chantier',
    ],
  },

  options: {
    intro: 'Pour aller plus loin, ces options s’ajoutent au pack. Elles sont chiffrées sur devis selon l’ampleur de votre activité.',
    items: [
      { name: 'Galerie avant / après', text: 'Comparatifs interactifs de vos chantiers, avec curseur, pour montrer la transformation d’un jardin.' },
      { name: 'Demande de devis détaillée', text: 'Formulaire en plusieurs étapes : type de projet, surface, accès au terrain, budget, photos jointes.' },
      { name: 'Page zone d’intervention', text: 'Une page qui décrit vos secteurs, vos délais de déplacement et vos communes prioritaires pour l’entretien.' },
      { name: 'Panneaux de chantier', text: 'Panneaux rigides à planter ou fixer sur la clôture pendant les travaux, avec votre nom et votre numéro.' },
      { name: 'Flocage du véhicule utilitaire', text: 'Marquage adhésif ou magnets de votre utilitaire, pour être identifié dans tout le secteur.' },
      {
        name: 'Logiciel de gestion PaysaPro',
        text: 'Solution complémentaire, indépendante du pack : un logiciel de gestion pensé pour les entreprises du paysage. Nous pouvons vous le présenter si vous souhaitez organiser votre activité au-delà de la communication.',
      },
    ],
  },

  signage: {
    intro: 'Un paysagiste communique surtout là où il travaille : sur la route et devant les chantiers. Nos recommandations :',
    items: [
      ['Flocage de l’utilitaire', 'Nom, métier, téléphone et site lisibles à distance, sur les côtés et l’arrière du véhicule.'],
      ['Panneaux de chantier', 'Posés pendant la durée des travaux, ils transforment chaque chantier en publicité de quartier.'],
      ['Bâche', 'Pour une clôture de chantier, un salon ou un stand sur un marché aux plantes.'],
    ],
    needs: ['vehicule', 'chantier', 'bache'],
  },

  extra: [
    {
      eyebrow: 'Les photos',
      title: 'Constituer une galerie de chantiers, même en démarrant',
      body: `Vous n’avez pas encore de nombreux chantiers à montrer ? C’est normal au démarrage. Voici comment construire une galerie convaincante en quelques mois :

- **Photographiez chaque terrain avant d’intervenir**, sous un angle que vous pourrez reproduire à la fin.
- **Faites une photo en cours de chantier** : terrassement, pose de bordures, plantation. Elle montre votre sérieux et votre méthode.
- **Revenez quelques mois plus tard** quand les végétaux ont pris : un jardin se juge dans la durée.
- **Demandez l’accord écrit du client** avant toute publication, sans adresse ni élément permettant d’identifier sa maison.

Nous trions et retouchons légèrement vos photos (cadrage, lumière) sans jamais modifier la réalité du travail réalisé.`,
    },
    {
      eyebrow: 'Entretien',
      title: 'Les contrats d’entretien, socle de votre activité',
      body: `L’entretien régulier assure une activité stable entre deux chantiers de création. Il se vend différemment : le client cherche un professionnel **fiable, ponctuel et proche de chez lui**. Votre site doit présenter clairement vos formules (passages ponctuels ou réguliers, tonte, taille, ramassage des feuilles) et votre secteur.

Si votre entreprise est déclarée pour les services à la personne, certains petits travaux de jardinage chez les particuliers peuvent ouvrir droit à un avantage fiscal pour vos clients. C’est un argument fort, à présenter prudemment et uniquement si vous y êtes réellement habilité : nous ajoutons alors un lien vers la source officielle.`,
    },
  ],

  steps: [
    ['Rendez-vous de lancement', 'Échange sur vos prestations, votre secteur et vos premiers chantiers, sur un chantier ou à distance.', 'Sous une semaine'],
    ['Identité', 'Logo ou mise au propre, couleurs, déclinaison sur le véhicule et les panneaux.', '1 à 2 semaines'],
    ['Site et galerie', 'Rédaction des prestations, tri des photos, mise en ligne du site et du formulaire de demande de visite.', '3 à 4 semaines après réception des contenus'],
    ['Fiche Google et imprimés', 'Fiche avec zone desservie, bons à tirer et impression des cartes et flyers.', '1 à 2 semaines après validation des BAT'],
    ['Véhicule et panneaux', 'Maquette sur photo de votre utilitaire, fabrication et pose par notre partenaire.', 'Selon la fabrication et la date de pose'],
  ],

  portfolio: {
    slug: 'jardins-de-la-valmont',
    text: 'Concept de démonstration : le site d’un paysagiste fictif, avec galerie avant/après et formulaire de demande de visite.',
  },

  faq: [
    ['Je n’ai pas encore de réalisations, que montrer sur le site ?', 'Vos prestations, votre méthode, vos engagements et, si vous en avez, des chantiers réalisés en tant que salarié avec l’accord de votre ancien employeur. La galerie s’enrichit ensuite chantier après chantier.'],
    ['Faut-il séparer création et entretien sur le site ?', 'Oui : ce sont deux demandes différentes. Une page par activité permet au client de trouver directement ce qu’il cherche et améliore votre visibilité sur chaque type de recherche.'],
    ['Le flocage abîme-t-il la peinture du véhicule ?', 'Un adhésif adapté, posé et retiré correctement, n’abîme pas une peinture d’origine en bon état. Pour un véhicule en location, les magnets amovibles sont souvent préférables.'],
    ['Qu’est-ce que PaysaPro ?', 'Un logiciel de gestion destiné aux entreprises du paysage, proposé en complément et indépendamment du pack. Il n’est pas nécessaire pour profiter du pack ; nous vous le présentons seulement si vous le souhaitez.'],
    ['Comment être trouvé dans les communes voisines ?', 'Grâce à la zone desservie de votre fiche Google, à une page qui décrit vos secteurs réels et aux avis de vos clients. Nous évitons les pages copiées-collées par commune, pénalisées par Google.'],
    ['Pouvez-vous préparer mes flyers de saison chaque année ?', 'Oui. Nous gardons vos gabarits et pouvons mettre à jour vos flyers d’automne ou de printemps chaque saison, avec une nouvelle impression.'],
  ],

  local: {
    title: 'Paysagistes du Pays de Caux et d’ailleurs',
    body: `Entre les grands jardins des maisons cauchoises, les propriétés autour de Bolbec et Lillebonne et les terrains plus urbains du Havre ou de Fécamp, les paysagistes de notre secteur ont beaucoup à montrer. Basés à Gruchet-le-Valasse, nous venons volontiers vous rencontrer sur un chantier pour photographier votre travail et prendre les mesures de votre utilitaire. Pour les entreprises du paysage installées hors de Normandie, tout le pack se gère à distance.`,
  },

  links: [
    ['/creation-site-internet-paysagiste', 'Site internet pour paysagistes'],
    ['/vitrophanie-signaletique', 'Marquage de véhicule et panneaux de chantier'],
    ['/referencement-local-artisan', 'Référencement local'],
    ['/flyers-depliants', 'Flyers de saison'],
    ['/identite-visuelle-logo', 'Création de logo'],
  ],
};
