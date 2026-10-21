import type { PackDef } from './types';

export const artisanBatiment: PackDef = {
  slug: 'artisan-batiment',
  metier: 'Artisan du bâtiment',
  activity: 'Artisan du bâtiment',
  icon: 'batiment',
  visual: 'site',
  keyword: 'communication création entreprise artisan bâtiment',
  metaTitle: 'Pack communication pour artisan du bâtiment qui démarre',
  metaDescription: 'Vous créez votre entreprise du bâtiment ? Logo, site avec réalisations et demande de devis, fiche Google, panneaux de chantier, véhicule floqué et autocollants.',
  card: {
    title: 'Artisan du bâtiment',
    text: 'Plombier, électricien, maçon, couvreur, menuisier : logo, site avec réalisations, fiche Google, véhicule floqué et panneaux de chantier.',
  },

  eyebrow: 'Pack Bien démarrer · Artisan du bâtiment',
  h1: 'Vous créez votre entreprise du bâtiment ?',
  h1em: 'Inspirez confiance dès le premier devis.',
  intro:
    'Après des années comme salarié ou compagnon, vous vous installez à votre compte. Les clients ne vous connaissent pas encore sous votre propre nom : ce pack vous donne une image d’entreprise sérieuse, visible sur la route, sur les chantiers et sur Google.',
  stakes: {
    title: 'Ce que regarde un client avant de confier ses travaux',
    body: `Faire entrer un artisan chez soi, c’est un acte de confiance. Avant de signer un devis de plusieurs milliers d’euros, le particulier se pose des questions simples : cette entreprise est-elle **sérieuse**, **assurée**, **joignable** ? A-t-elle déjà fait ce genre de travaux ? Sera-t-elle encore là en cas de problème ?

Une entreprise qui démarre doit répondre à ces questions sans historique. C’est là que la communication joue un rôle concret : un nom et un logo professionnels, un **devis à en-tête propre**, des mentions d’assurance claires, un véhicule identifié et une fiche Google complète donnent l’image d’une entreprise établie, même au premier chantier.

Le bouche-à-oreille fera le reste, à condition de lui donner un support : un site où vos premiers clients peuvent envoyer leurs proches, et des avis qui s’accumulent chantier après chantier.`,
  },
  mistakes: {
    title: 'Les erreurs fréquentes à l’installation',
    items: [
      ['Un devis sur papier libre', 'Un devis sans logo, sans mentions complètes ni assurance indiquée donne une impression d’amateurisme, même si votre travail est excellent.'],
      ['Des certifications affichées sans justificatif', 'Afficher un label que l’on n’a pas, ou plus, est trompeur et dangereux. Seules les qualifications réelles et à jour doivent apparaître.'],
      ['Aucune trace des chantiers', 'Les premiers chantiers sont rarement photographiés. Ce sont pourtant eux qui alimenteront votre site et vos réseaux.'],
      ['Un numéro personnel partout', 'Mélanger numéro privé et professionnel complique l’organisation et brouille votre image. Un numéro dédié, affiché partout de la même façon, simplifie tout.'],
      ['Attendre d’être débordé pour communiquer', 'Le carnet se remplit vite au démarrage grâce au réseau, puis se vide. Une présence en ligne installée tôt prend le relais.'],
    ],
  },

  base: {
    priceFrom: '[À COMPLÉTER : prix du pack artisan du bâtiment]',
    intro: 'Le pack de base installe votre entreprise dans le paysage local : identité, site, imprimés et fiche Google.',
    site: {
      title: 'Un site d’artisan du bâtiment',
      items: [
        'Page d’accueil avec votre métier, votre secteur et un bouton d’appel visibles immédiatement',
        'Une page par grand type de travaux (rénovation, dépannage, installation, neuf…)',
        'Page réalisations, alimentée au fil des chantiers',
        'Formulaire de demande de devis avec description des travaux et photos',
        'Page « Garanties » : assurance décennale, qualifications et labels réellement détenus',
        'Zone d’intervention et délais habituels',
      ],
    },
    graphic: {
      title: 'L’identité et les supports',
      items: [
        'Logo, ou mise au propre de votre logo, lisible sur un véhicule, un panneau et un tampon',
        'Devis et factures à en-tête, avec les mentions d’assurance mises en page',
        'Cartes de visite',
        'Flyer de présentation de l’entreprise',
        'Tampon ou étiquette au nom de l’entreprise, selon vos besoins',
      ],
    },
    prints: [
      ['Cartes de visite', '[À COMPLÉTER : quantité]'],
      ['Flyers de présentation', '[À COMPLÉTER : quantité]'],
      ['Autocollants à votre nom', '[À COMPLÉTER : quantité]'],
    ],
    google: [
      'Création de la fiche Google Business Profile avec zone desservie',
      'Catégorie principale précise (plombier, électricien, couvreur…) et services détaillés',
      'Photos de chantiers, du véhicule et de l’équipe',
      'Carte ou lien pour demander un avis à la fin de chaque chantier',
    ],
  },

  options: {
    intro: 'Selon votre métier et votre organisation, ajoutez ces options. Elles sont chiffrées sur devis.',
    items: [
      { name: 'Page réalisations enrichie', text: 'Chantiers présentés avec photos avant/après, type de travaux et commune (avec l’accord du client).', price: 'Sur devis' },
      { name: 'Demande de devis détaillée', text: 'Formulaire en plusieurs étapes adapté à votre métier : type de travaux, surface, urgence, photos.', price: 'Sur devis' },
      { name: 'Mise en avant des certifications et assurances', text: 'Bloc dédié avec vos qualifications, labels et assurance, liens vers les organismes et documents à jour.', price: 'Sur devis' },
      { name: 'Panneaux de chantier', text: 'Panneaux rigides avec votre nom, métier et numéro, à installer pendant toute la durée des travaux.', price: 'Sur devis' },
      { name: 'Flocage du véhicule', text: 'Marquage complet ou partiel de votre utilitaire, ou magnets amovibles.', price: 'Sur devis' },
      { name: 'Autocollants « intervention réalisée par »', text: 'Petits autocollants à poser sur une chaudière, un tableau électrique ou un chauffe-eau : le client retrouve votre numéro au prochain besoin.', price: '[À COMPLÉTER : tarif]' },
    ],
  },

  signage: {
    intro: 'Pour un artisan du bâtiment, la meilleure publicité se trouve sur la route et devant les chantiers :',
    items: [
      ['Flocage de l’utilitaire', 'Votre véhicule devient un panneau publicitaire mobile, lisible à l’arrêt comme en circulation.'],
      ['Panneaux de chantier', 'Votre nom devant chaque maison rénovée : les voisins savent à qui s’adresser.'],
      ['Autocollants d’intervention', 'Discrets, ils restent des années sur l’équipement installé.'],
      ['Plaque ou enseigne d’atelier', 'Si vous avez un dépôt ou un atelier, pour être repéré par les clients et les fournisseurs.'],
    ],
    needs: ['vehicule', 'chantier', 'autocollants', 'panneau'],
  },

  extra: [
    {
      eyebrow: 'Confiance',
      title: 'Assurances, qualifications, labels : afficher ce qui rassure',
      body: `Les artisans du bâtiment doivent indiquer leur **assurance professionnelle obligatoire** (notamment la garantie décennale pour les travaux concernés) sur leurs devis et leurs factures, avec les coordonnées de l’assureur et la couverture géographique. Nous intégrons ces mentions à vos modèles de documents.

Sur le site, une page « Garanties » présente clairement :

- votre **assurance** et ce qu’elle couvre ;
- vos **qualifications** professionnelles et vos labels, par exemple ceux qui permettent à vos clients de bénéficier de certaines aides à la rénovation énergétique, **uniquement s’ils sont réellement détenus et en cours de validité** ;
- votre **expérience** : années de métier, formations, spécialités.

Nous ne publions jamais un logo de label sans justificatif. Pour les règles exactes de mention de votre assurance et l’utilisation des labels, référez-vous à votre assureur et aux organismes concernés.`,
    },
    {
      eyebrow: 'Sur le terrain',
      title: 'Faire de chaque chantier une source de nouveaux clients',
      body: `Un chantier dure parfois plusieurs semaines. Pendant ce temps, voisins, passants et autres artisans voient votre véhicule et votre panneau. Ce sont souvent eux qui vous appelleront ensuite.

Pour en profiter : un **numéro unique et bien lisible** sur tous les supports, l’adresse de votre site sur le véhicule, et un **QR code** sur le panneau de chantier qui mène à vos réalisations. En fin de chantier, l’autocollant posé sur l’installation et la demande d’avis Google prolongent la relation. Pensez aussi à photographier chaque chantier terminé : c’est la matière première de votre site.`,
    },
  ],

  steps: [
    ['Rendez-vous de lancement', 'Échange sur votre métier, votre secteur, vos qualifications et vos premiers chantiers.', '[À COMPLÉTER : délai]'],
    ['Identité et documents', 'Logo ou mise au propre, modèle de devis et de facture, cartes de visite.', '[À COMPLÉTER : délai]'],
    ['Site et fiche Google', 'Rédaction des pages métiers, formulaire de devis, page garanties, fiche Google avec zone desservie.', '[À COMPLÉTER : délai]'],
    ['Imprimés', 'Bons à tirer, impression des cartes, flyers et autocollants.', '[À COMPLÉTER : délai]'],
    ['Véhicule, panneaux et autocollants', 'Simulation du marquage sur les photos de votre véhicule, fabrication des panneaux et autocollants, pose par notre partenaire.', '[À COMPLÉTER : délai]'],
  ],

  portfolio: {
    slug: 'atelier-chene-et-fil',
    text: 'Concept de démonstration : le site d’un menuisier-ébéniste fictif, organisé par type d’ouvrage, avec un formulaire de devis guidé.',
  },

  faq: [
    ['Je suis micro-entrepreneur, ce pack est-il adapté ?', 'Oui. Le pack s’adapte au statut et au budget : l’essentiel est d’avoir une image claire, une fiche Google et des documents professionnels. Nous ajustons le périmètre lors du premier rendez-vous.'],
    ['Que doit contenir mon modèle de devis ?', 'Vos coordonnées complètes, numéro SIRET, mentions d’assurance obligatoires, détail des travaux et des prix, conditions de paiement et durée de validité. Nous mettons en page le modèle ; faites valider les mentions par votre expert-comptable.'],
    ['Puis-je afficher le nom de mes anciens employeurs ou chantiers ?', 'Vous pouvez évoquer votre expérience. Pour montrer des photos de chantiers réalisés en tant que salarié, demandez l’accord de l’entreprise et des clients concernés.'],
    ['Combien coûte le flocage d’un utilitaire ?', 'Cela dépend du véhicule, de la surface couverte et de l’adhésif. Envoyez-nous le modèle et des photos de chaque côté pour un devis précis.'],
    ['Je n’ai pas encore de label, est-ce un problème ?', 'Non. Mettez en avant votre assurance, votre expérience et vos premiers chantiers. Les labels pourront être ajoutés au site dès que vous les obtenez.'],
    ['Comment obtenir mes premiers avis Google ?', 'Demandez-les systématiquement à la fin des chantiers réussis, avec un lien direct. Jamais d’avis achetés ou rédigés par des proches : c’est interdit et facilement repéré.'],
    ['Pouvez-vous aussi créer mes réseaux sociaux ?', 'Oui : nous préparons vos pages avec votre identité et des gabarits pour publier vos chantiers rapidement.'],
  ],

  local: {
    title: 'Artisans qui s’installent dans le Pays de Caux',
    body: `De nombreux artisans se lancent chaque année autour de Gruchet-le-Valasse, Bolbec, Lillebonne, Fécamp et dans l’agglomération du Havre. Nous vous rencontrons à votre dépôt, sur un chantier ou à votre domicile pour faire le point, photographier votre véhicule et vos premiers travaux. Installé dans une autre région ? Nous menons le pack à distance, et vos supports sont livrés chez vous.`,
  },

  links: [
    ['/creation-site-internet-artisan', 'Site internet pour artisans'],
    ['/referencement-local-artisan', 'Référencement local des artisans'],
    ['/vitrophanie-signaletique', 'Panneaux de chantier et marquage de véhicule'],
    ['/cartes-de-visite', 'Cartes de visite'],
    ['/identite-visuelle-logo', 'Création de logo'],
  ],
};
