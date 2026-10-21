import type { PackDef } from './types';

export const restaurant: PackDef = {
  slug: 'restaurant',
  metier: 'Restaurant',
  activity: 'Restaurant',
  icon: 'restaurant',
  visual: 'social',
  keyword: 'communication ouverture restaurant',
  metaTitle: 'Communication pour l’ouverture d’un restaurant',
  metaDescription: 'Pack « Bien démarrer » pour ouvrir un restaurant : site avec menu, logo, cartes, flyers, fiche Google, réservation en ligne et vitrine. Pays de Caux et France.',
  card: {
    title: 'Restaurant, café, traiteur',
    text: 'Site avec menu à jour, fiche Google, cartes et flyers d’ouverture, réservation en ligne et vitrine qui donne faim.',
  },

  eyebrow: 'Pack Bien démarrer · Restaurant',
  h1: 'Vous ouvrez votre restaurant ?',
  h1em: 'Faites-le savoir dès le premier service.',
  intro:
    'Entre les travaux, les fournisseurs et le recrutement, la communication passe souvent en dernier. Pourtant, les premières semaines décident de la réputation d’un restaurant. Ce pack réunit tout ce qu’il faut pour être trouvé, choisi et réservé dès l’ouverture.',
  stakes: {
    title: 'Ce qui se joue à l’ouverture d’un restaurant',
    body: `Un client qui hésite entre deux adresses fait presque toujours la même chose : il cherche le restaurant sur son téléphone, regarde les photos, **lit la carte et les prix**, vérifie les horaires, puis réserve ou passe son chemin. Si votre carte n’est pas en ligne, si vos horaires sont faux ou si vos photos datent des travaux, il choisira l’établissement d’en face.

L’ouverture est aussi le moment où le bouche-à-oreille se forme. Les premiers clients parlent de vous, laissent les premiers avis et partagent des photos. Une identité claire (nom lisible, logo, couleurs, ton) aide à ce que l’on se souvienne de vous et qu’on vous recommande.

Enfin, un restaurant a des **obligations d’affichage** que la communication doit intégrer : affichage des menus et des prix à l’extérieur pendant le service, information sur les allergènes, origine des viandes, mention « fait maison » si vous l’utilisez. Nous en tenons compte dans la conception de vos supports ; pour le détail réglementaire, la DDPP de votre département reste la référence.`,
  },
  mistakes: {
    title: 'Les erreurs fréquentes à l’ouverture',
    items: [
      ['La carte en PDF illisible sur téléphone', 'Un menu scanné ou un PDF de quatre pages à zoomer décourage. Une carte en ligne, lisible et à jour, se consulte en dix secondes.'],
      ['La fiche Google créée trop tard', 'Sans fiche, vous n’apparaissez pas sur la carte quand on cherche « restaurant » autour de soi. Elle doit être prête avant l’ouverture, avec horaires et photos.'],
      ['Des horaires différents partout', 'Site, fiche Google, porte d’entrée et réseaux sociaux affichent des horaires contradictoires : le client appelle en plein service ou trouve porte close.'],
      ['Une vitrine muette', 'De l’extérieur, on ne sait ni quel type de cuisine vous proposez ni si c’est ouvert. Le menu affiché et quelques mots sur la vitre suffisent souvent à faire entrer.'],
      ['Tout miser sur une plateforme', 'Dépendre uniquement d’une application de réservation ou de livraison, c’est leur céder la relation client et une commission. Votre site reste votre canal direct.'],
    ],
  },

  base: {
    priceFrom: '[À COMPLÉTER : prix du pack restaurant]',
    intro: 'Le pack de base couvre l’essentiel pour ouvrir avec une image professionnelle et être trouvé en ligne.',
    site: {
      title: 'Un site de restaurant',
      items: [
        'Page d’accueil avec ambiance, type de cuisine, adresse et horaires visibles immédiatement',
        'Carte et menus lisibles sur téléphone (texte, pas un PDF scanné)',
        'Page « Infos pratiques » : accès, stationnement, terrasse, accessibilité, moyens de paiement',
        'Bouton d’appel et de réservation (par téléphone, ou outil en ligne en option)',
        'Galerie de photos de la salle et des plats',
        'Mentions sur les allergènes et la provenance, selon vos informations',
      ],
    },
    graphic: {
      title: 'L’identité et les supports',
      items: [
        'Logo, ou mise au propre de votre logo existant (versions couleur, noir et blanc, réduite)',
        'Palette de couleurs et typographies, cohérentes avec votre cuisine et votre salle',
        'Cartes de visite du restaurant',
        'Flyer d’ouverture (annonce, offre de lancement, plan d’accès)',
        'Maquette de la carte des plats et de l’affichage extérieur des menus',
      ],
    },
    prints: [
      ['Cartes de visite', '[À COMPLÉTER : quantité]'],
      ['Flyers d’ouverture', '[À COMPLÉTER : quantité]'],
      ['Affichage extérieur du menu', '[À COMPLÉTER : quantité]'],
    ],
    google: [
      'Création ou reprise de la fiche Google Business Profile',
      'Catégorie de cuisine, horaires du service, lien vers la carte et la réservation',
      'Premières photos (salle, façade, plats) et description',
      'Lien court pour demander des avis à vos premiers clients',
    ],
  },

  options: {
    intro: 'Selon votre concept et votre organisation, vous pouvez ajouter les options suivantes. Les outils en ligne sont des solutions existantes que nous intégrons et configurons pour vous, pas des développements sur mesure.',
    items: [
      { name: 'Menu en ligne facile à mettre à jour', text: 'Vous changez le plat du jour ou la carte de saison vous-même, en quelques minutes, sans nous solliciter.', price: 'Sur devis' },
      { name: 'QR code menu', text: 'Un QR code sur les tables et en vitrine qui ouvre directement votre carte à jour.', price: '[À COMPLÉTER : tarif]' },
      { name: 'Réservation en ligne', text: 'Intégration d’un outil de réservation existant sur votre site et votre fiche Google, avec vos créneaux et votre capacité.', price: 'Sur devis' },
      { name: 'Click & collect ou livraison', text: 'Intégration d’une solution de commande à emporter, ou liens vers les plateformes de livraison que vous utilisez.', price: 'Sur devis' },
      { name: 'Carte des plats imprimée', text: 'Mise en page et impression de la carte, au format et sur le papier adaptés à votre salle.', price: 'Sur devis' },
      { name: 'Sets de table', text: 'Sets en papier personnalisés : une surface de communication que chaque client a sous les yeux.', price: 'Sur devis' },
      { name: 'Chevalet de terrasse', text: 'Panneau stop-trottoir avec votre menu du jour ou votre offre, réutilisable.', price: 'Sur devis' },
      { name: 'Carte de fidélité', text: 'Carte à tamponner aux couleurs du restaurant, pour faire revenir les habitués.', price: '[À COMPLÉTER : tarif]' },
    ],
  },

  signage: {
    intro: 'Pour un restaurant, la façade travaille à chaque passage. Voici ce que nous recommandons le plus souvent, selon votre local :',
    items: [
      ['Vitrophanie avec horaires et menu', 'Nom, type de cuisine et horaires de service lisibles depuis la rue, et un emplacement prévu pour le menu affiché.'],
      ['Enseigne ou panneau de façade', 'Pour être repéré de loin, de jour comme de nuit selon l’éclairage disponible.'],
      ['Beach flag ou chevalet', 'Un signal visible depuis la route ou la place, surtout si votre entrée est en retrait.'],
      ['Adhésif dépoli', 'Pour préserver l’intimité des tables en bord de vitre, sans assombrir la salle.'],
    ],
    needs: ['vitrophanie', 'horaires', 'enseigne', 'beachflag', 'depoli'],
  },

  extra: [
    {
      eyebrow: 'Le menu',
      title: 'Votre carte, le cœur de votre communication',
      body: `Dans un restaurant, la carte n’est pas un simple document : c’est votre principal argument. Nous la travaillons à la fois **sur le site, sur la table et en vitrine**, avec la même hiérarchie :

- les **plats signatures** mis en avant, plutôt qu’une liste uniforme ;
- des **intitulés courts et appétissants**, avec une ligne de description quand elle aide à choisir ;
- des **prix lisibles**, alignés et sans signes superflus ;
- les **informations obligatoires** (allergènes, provenance) intégrées proprement, sans alourdir la lecture ;
- une **version en ligne** que vous pouvez mettre à jour vous-même si vous choisissez l’option menu en ligne.

Une carte de saison ou un menu du jour qui change souvent ? Nous prévoyons un gabarit simple pour l’ardoise, le chevalet et les réseaux sociaux, afin de garder la même identité sans repasser par un graphiste à chaque changement.`,
    },
    {
      eyebrow: 'Après l’ouverture',
      title: 'Les premières semaines : avis, photos et habitués',
      body: `Les premiers avis Google pèsent lourd. Plutôt que d’attendre, prévoyez dès l’ouverture une façon simple de les demander : un petit carton glissé avec l’addition, ou le QR code de votre fiche sur le comptoir. Répondez à chaque avis, y compris aux critiques, avec sobriété.

Remplacez rapidement les photos de travaux par de vraies photos de service : salle pleine, plats dressés, équipe en cuisine. La carte de fidélité et les publications régulières sur les réseaux (plat du jour, soirée à thème) aident ensuite à transformer les curieux de l’ouverture en habitués.`,
    },
  ],

  steps: [
    ['Rendez-vous de lancement', 'Visite du local ou échange à distance : concept, cuisine, clientèle visée, date d’ouverture.', '[À COMPLÉTER : délai]'],
    ['Identité et carte', 'Logo ou mise au propre, couleurs, mise en page de la carte et des menus affichés.', '[À COMPLÉTER : délai]'],
    ['Site et fiche Google', 'Rédaction, photos, mise en ligne du site ; création de la fiche avec horaires et photos.', '[À COMPLÉTER : délai]'],
    ['Imprimés et vitrine', 'Bons à tirer, impression des cartes et flyers, pose de la vitrophanie par notre partenaire.', '[À COMPLÉTER : délai]'],
    ['Ouverture et suivi', 'Vérification des horaires partout, premières demandes d’avis, ajustements après les premiers services.', '[À COMPLÉTER : délai]'],
  ],

  portfolio: {
    slug: 'le-comptoir-du-marche',
    text: 'Concept de démonstration : des gabarits de publications pour un restaurant fictif, pour annoncer le menu du jour et les soirées sans y passer des heures.',
  },

  faq: [
    ['Combien de temps avant l’ouverture faut-il nous contacter ?', 'Le plus tôt possible : idéalement dès que le nom et le local sont choisis. La fiche Google, le site et les imprimés doivent être prêts avant le premier service. Le planning est fixé ensemble selon votre date d’ouverture.'],
    ['Pourrai-je modifier la carte moi-même ?', 'Oui avec l’option menu en ligne : vous mettez à jour vos plats et vos prix depuis un téléphone. Sans cette option, nous faisons les modifications pour vous.'],
    ['Quel outil de réservation utiliser ?', 'Il en existe plusieurs, avec des modèles de prix différents (abonnement ou commission). Nous vous aidons à choisir selon votre capacité et votre clientèle, puis nous l’intégrons à votre site et à votre fiche Google.'],
    ['Faut-il vraiment un site si je suis sur les plateformes de réservation ?', 'Oui : les plateformes sont utiles pour être découvert, mais votre site est le seul canal où le client réserve chez vous sans intermédiaire. Il renforce aussi votre fiche Google.'],
    ['Le menu affiché en vitrine est-il obligatoire ?', 'Les restaurants doivent afficher à l’extérieur, pendant le service, les menus et une sélection de prix. Nous prévoyons cet affichage dans la vitrine ; vérifiez les règles exactes auprès de la DDPP.'],
    ['Pouvez-vous gérer nos réseaux sociaux ?', 'Nous créons des gabarits de publications à vos couleurs (plat du jour, événement, nouveauté) pour que vous publiiez rapidement. La publication régulière peut aussi faire l’objet d’un accompagnement.'],
    ['Reprenez-vous un restaurant existant ?', 'Oui. Pour une reprise, nous partons de l’existant : ancien nom, fiche Google, avis. Il est souvent préférable de faire évoluer la fiche plutôt que d’en créer une nouvelle.'],
  ],

  local: {
    title: 'Ouvrir un restaurant dans le Pays de Caux',
    body: `Centre-bourg de Gruchet-le-Valasse, place de Bolbec, rues de Lillebonne, quartiers du Havre ou front de mer de Fécamp : nous accompagnons les restaurateurs qui s’installent dans le Pays de Caux, avec un rendez-vous dans votre salle pour comprendre l’ambiance, mesurer la vitrine et prendre les premières photos. Vous ouvrez ailleurs en France ? Le pack se réalise entièrement à distance, et les imprimés sont livrés à votre adresse.`,
  },

  links: [
    ['/creation-site-internet', 'Création de site internet'],
    ['/vitrophanie-vitrine-commerce', 'Vitrophanie de vitrine'],
    ['/flyers-depliants', 'Flyers d’ouverture'],
    ['/reseaux-sociaux', 'Visuels pour les réseaux sociaux'],
    ['/referencement-local-artisan', 'Référencement local'],
  ],
};
