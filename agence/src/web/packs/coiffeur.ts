import type { PackDef } from './types';

export const coiffeur: PackDef = {
  slug: 'coiffeur',
  metier: 'Coiffeur & institut',
  activity: 'Salon de coiffure / institut de beauté',
  icon: 'coiffure',
  visual: 'print',
  keyword: 'communication ouverture salon de coiffure',
  metaTitle: 'Communication pour ouvrir un salon de coiffure',
  metaDescription: 'Ouvrir un salon de coiffure ou un institut de beauté : site avec tarifs et rendez-vous en ligne, logo, cartes de rendez-vous, fidélité et vitrine décorative.',
  card: {
    title: 'Coiffeur, institut de beauté',
    text: 'Rendez-vous en ligne, tarifs clairs, cartes de rendez-vous et de fidélité, chèques cadeaux et vitrine qui reflète votre style.',
  },

  eyebrow: 'Pack Bien démarrer · Coiffure & beauté',
  h1: 'Vous ouvrez votre salon ou votre institut ?',
  h1em: 'Que votre style se voie de la rue.',
  intro:
    'Dans la coiffure et la beauté, on choisit un salon pour une ambiance autant que pour une compétence. Ce pack donne à votre établissement une image soignée et cohérente, et simplifie la prise de rendez-vous pour vos clientes et clients dès l’ouverture.',
  stakes: {
    title: 'Ce qui fait venir les premiers clients d’un salon',
    body: `Ouvrir un salon de coiffure ou un institut, c’est convaincre des clients d’en quitter un autre, souvent après des années de fidélité. Ce changement ne se fait pas sur un coup de tête : la personne regarde **votre univers** (vitrine, photos, réseaux sociaux), **vos tarifs**, et la facilité pour **réserver un créneau** qui lui convient.

Votre image doit donc être immédiatement lisible : haut de gamme ou accessible, spécialiste de la couleur, du barbier, de l’onglerie ou des soins du visage. Un logo, une vitrine et des supports qui racontent la même chose rassurent et donnent envie d’essayer.

La prise de rendez-vous est l’autre point clé. Un client qui ne peut réserver qu’en appelant pendant vos heures d’ouverture, alors que vous avez les mains occupées, réservera ailleurs. Une solution de rendez-vous en ligne, intégrée à votre site et à votre fiche Google, travaille pour vous le soir et le dimanche.`,
  },
  mistakes: {
    title: 'Les erreurs fréquentes à l’ouverture d’un salon',
    items: [
      ['Des tarifs introuvables', 'Le client n’ose pas appeler pour demander un prix. Une page tarifs claire, par prestation, lève ce frein ; l’affichage des prix est d’ailleurs une obligation en salon.'],
      ['Un téléphone qui sonne pendant les soins', 'Sans réservation en ligne, vous interrompez vos prestations ou vous manquez des appels.'],
      ['Une vitrine trop chargée ou totalement occultée', 'Affiches de marques, prix scotchés, ou à l’inverse vitrine opaque : le passant ne perçoit pas votre ambiance.'],
      ['Des photos d’inspiration trouvées en ligne', 'Utiliser les réalisations des autres est trompeur et risqué juridiquement. Vos propres photos, même simples, sont plus convaincantes.'],
      ['Aucun moyen de faire revenir', 'Sans carte de rendez-vous ni fidélité, le client satisfait oublie de reprendre rendez-vous au bon moment.'],
    ],
  },

  base: {
    priceFrom: '1 790 €',
    intro: 'Le pack de base installe votre image et votre présence en ligne, avec les supports du quotidien d’un salon.',
    site: {
      title: 'Le site internet de votre salon ou institut',
      items: [
        'Page d’accueil qui montre l’ambiance du salon et vos spécialités',
        'Page des prestations et tarifs, par catégorie (coupe, couleur, soins, épilation, ongles…)',
        'Galerie de réalisations et photos du lieu',
        'Présentation de l’équipe',
        'Bouton de prise de rendez-vous (téléphone, ou outil en ligne en option)',
        'Infos pratiques : horaires, accès, stationnement, produits utilisés',
      ],
    },
    graphic: {
      title: 'L’identité et les supports',
      items: [
        'Logo, ou mise au propre de votre logo, pensé pour la vitrine et les réseaux sociaux',
        'Univers graphique : couleurs, typographies, style des visuels',
        'Cartes de visite',
        'Flyer d’ouverture avec offre de bienvenue',
        'Affiche des tarifs pour l’intérieur du salon',
      ],
    },
    prints: [
      ['Cartes de visite', '500 exemplaires'],
      ['Flyers d’ouverture', '1 000 exemplaires'],
      ['Affiche des tarifs', '5 exemplaires'],
    ],
    google: [
      'Création ou reprise de la fiche Google Business Profile du salon',
      'Catégories (salon de coiffure, institut de beauté, barbier…), horaires et services',
      'Photos du salon, de la vitrine et de réalisations',
      'Lien de prise de rendez-vous et lien pour demander des avis',
    ],
  },

  options: {
    intro: 'Ces options complètent le pack selon votre organisation. Les outils de rendez-vous sont des solutions existantes que nous intégrons et paramétrons, pas des développements sur mesure.',
    items: [
      { name: 'Prise de rendez-vous en ligne', text: 'Intégration d’un outil de réservation existant sur votre site et votre fiche Google : prestations, durées, collaborateurs, rappels automatiques.' },
      { name: 'Page tarifs détaillée', text: 'Une grille complète et facile à mettre à jour, avec durées et prestations combinées.' },
      { name: 'Galerie de réalisations', text: 'Une galerie organisée par style ou par prestation, alimentée au fil de vos créations.' },
      { name: 'Cartes de rendez-vous', text: 'Cartes au format carte de visite avec emplacement pour la date du prochain rendez-vous.' },
      { name: 'Cartes de fidélité', text: 'Cartes à tamponner aux couleurs du salon, avec la récompense de votre choix.' },
      { name: 'Chèques cadeaux', text: 'Chèques numérotés et personnalisés, avec talon, pour les fêtes et les anniversaires.' },
      { name: 'Caisse et paiement par carte', text: 'Caisse conforme avec prestations et produits sur le même ticket, ventes par collaborateur et terminal de paiement. Aussi disponible seule.', href: '/caisse-paiement-carte' },
    ],
  },

  signage: {
    intro: 'La vitrine d’un salon montre votre style avant même que le client entre. Nous recommandons le plus souvent :',
    items: [
      ['Vitrophanie décorative', 'Un motif, une illustration ou un visuel qui exprime l’univers du salon, sans masquer l’intérieur.'],
      ['Lettrage du nom et des spécialités', 'Nom, spécialités et horaires découpés en adhésif, lisibles depuis le trottoir d’en face.'],
      ['Adhésif dépoli pour l’intimité', 'Pour les postes de soin, de shampoing ou les cabines, une bande dépolie préserve l’intimité sans assombrir.'],
    ],
    needs: ['vitrophanie', 'depoli', 'horaires'],
  },

  extra: [
    {
      eyebrow: 'Les tarifs',
      title: 'Présenter vos prix sans faire fuir',
      body: `Afficher ses prix, en salon comme en ligne, est à la fois une obligation et un argument commercial. Bien présentés, ils rassurent :

- **regroupez par famille** (coupe femme, homme, enfant ; couleur ; soins ; forfaits) plutôt qu’une liste interminable ;
- **indiquez ce que comprend chaque prix** (shampoing, brushing, longueur des cheveux) pour éviter les mauvaises surprises au moment de payer ;
- **mettez en avant quelques forfaits** qui simplifient le choix ;
- **gardez la même grille** sur le site, en salon et sur l’affichage visible de l’extérieur.

Pour les règles exactes d’affichage des prix des prestations, renseignez-vous auprès de la DDPP ou de votre organisation professionnelle : nous intégrons ensuite ces contraintes à la mise en page.`,
    },
    {
      eyebrow: 'Fidéliser',
      title: 'Du premier rendez-vous à la cliente fidèle',
      body: `Dans un salon, la rentabilité vient des clients qui reviennent. Trois supports simples y contribuent : la **carte de rendez-vous** remise en fin de prestation, la **carte de fidélité** qui récompense la régularité, et les **chèques cadeaux** qui vous amènent de nouveaux clients par l’intermédiaire des anciens.

Côté numérique, les rappels automatiques de l’outil de rendez-vous réduisent les oublis, et les avis Google déposés après une première visite réussie rassurent les suivants. Nous vous fournissons un petit support de comptoir avec le QR code de votre fiche.`,
    },
  ],

  steps: [
    ['Rendez-vous de lancement', 'Visite du salon ou échange à distance : univers souhaité, prestations, clientèle, date d’ouverture.', 'Sous une semaine'],
    ['Identité et vitrine', 'Logo et univers graphique, maquette de la vitrine sur photo de votre façade.', '1 à 2 semaines'],
    ['Site, tarifs et rendez-vous', 'Rédaction, mise en ligne du site, paramétrage de l’outil de rendez-vous si vous le choisissez.', '3 à 4 semaines après réception des contenus'],
    ['Fiche Google et imprimés', 'Fiche avec services et photos, impression des cartes, flyers et affiche des tarifs.', '1 à 2 semaines après validation des BAT'],
    ['Pose et ouverture', 'Pose de la vitrophanie par notre partenaire, vérification des liens de réservation, premières demandes d’avis.', 'Selon la fabrication et la date de pose'],
  ],

  portfolio: {
    slug: 'studio-meche',
    text: 'Concept de démonstration : flyer d’ouverture et cartes de rendez-vous pour un salon de coiffure fictif.',
  },

  faq: [
    ['Quel outil de prise de rendez-vous choisir ?', 'Plusieurs solutions existent, avec des fonctions et des tarifs différents (abonnement, commission, nombre de collaborateurs). Nous vous aidons à comparer selon votre salon, puis nous l’intégrons à votre site et à votre fiche Google. Nous ne citons pas de marque sans votre accord.'],
    ['Faut-il afficher tous mes prix sur le site ?', 'Ce n’est pas toujours obligatoire en ligne, mais c’est fortement recommandé : un client qui connaît vos tarifs réserve plus facilement. Les prix doivent en revanche être affichés au salon.'],
    ['Puis-je publier des photos de mes clientes ?', 'Oui, avec leur accord écrit. Nous vous fournissons un modèle d’autorisation simple. Évitez les photos d’inspiration trouvées sur internet : elles ne vous appartiennent pas.'],
    ['La vitrophanie décorative se change-t-elle facilement ?', 'Oui. Nous pouvons prévoir une base permanente (nom, horaires) et un décor saisonnier facile à retirer, pour les fêtes ou une nouvelle collection.'],
    ['Je reprends un salon existant, faut-il tout changer ?', 'Pas forcément. Nous faisons le point sur ce qui fonctionne (nom connu, fiche Google, avis) et sur ce qui doit évoluer, pour ne pas perdre la clientèle existante.'],
    ['Proposez-vous les chèques cadeaux numérotés ?', 'Oui, avec numérotation et talon pour votre suivi. Nous vous conseillons sur les mentions utiles (validité, prestations concernées).'],
  ],

  local: {
    title: 'Salons et instituts du Pays de Caux',
    body: `Vous installez votre salon à Gruchet-le-Valasse, dans le centre de Bolbec ou de Lillebonne, au Havre ou à Fécamp ? Nous venons voir votre local pour imaginer la vitrine avec vous, prendre les mesures et quelques photos de l’espace. Vous ouvrez dans une autre région ? Le pack se déroule entièrement à distance : visioconférence, maquettes en ligne et imprimés livrés au salon.`,
  },

  links: [
    ['/vitrophanie-vitrine-commerce', 'Vitrophanie de vitrine'],
    ['/cartes-de-visite', 'Cartes de visite et de rendez-vous'],
    ['/identite-visuelle-logo', 'Logo et identité visuelle'],
    ['/creation-site-internet', 'Création de site internet'],
    ['/reseaux-sociaux', 'Visuels pour les réseaux sociaux'],
  ],
};
