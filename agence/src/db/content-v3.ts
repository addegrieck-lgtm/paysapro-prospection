/**
 * Contenus ajoutés par la migration 3 (offre signalétique, pages locales, portfolio enrichi).
 * Partagés entre la migration (bases existantes) et les données initiales (bases neuves).
 * Aucun avis, chiffre ou client réel n'est inventé : les concepts restent identifiés comme tels.
 */

export interface LocalPageSeed {
  slug: string;
  city: string;
  title: string;
  intro: string;
  meta_description: string;
  body: string;
}

export const LOCAL_PAGES_V3: LocalPageSeed[] = [
  {
    slug: 'le-havre',
    city: 'Le Havre',
    title: 'Agence web et print au Havre',
    intro:
      'Sites internet, logos, supports imprimés et vitrophanie pour les commerces, artisans et entreprises du Havre. Le Havre fait partie de notre zone principale : nous nous y déplaçons pour les rendez-vous, les relevés de mesures et la pose de signalétique.',
    meta_description: 'Création de site internet, logo, flyers et vitrophanie pour les entreprises du Havre : rendez-vous sur place, pose de signalétique, devis gratuit.',
    body: `## Le Havre, dans notre zone d’intervention

Depuis Gruchet-le-Valasse, nous rejoignons Le Havre facilement pour rencontrer nos clients. Le Havre fait partie de notre **zone principale** : nous pouvons venir dans votre commerce, votre atelier ou vos bureaux pour comprendre votre activité, prendre des photos ou mesurer une vitrine avant de vous faire une proposition.

## Ce que nous faisons pour les entreprises havraises

- **Sites internet** pour les artisans et les indépendants de l’agglomération : un site clair, rapide sur mobile, qui présente vos réalisations et facilite les demandes de devis. Voir notre page [site internet pour artisans](/creation-site-internet-artisan).
- **Vitrophanie et enseignes** pour les commerces des rues commerçantes et des quartiers : lettrage de vitrine, horaires, microperforé, dépoli. Voir [vitrophanie de vitrine](/vitrophanie-vitrine-commerce).
- **Supports pour les entreprises de services** liées au port, à la logistique et à l’industrie : plaquettes de présentation, cartes de visite d’équipe, signalétique d’accueil, kakémonos pour les salons professionnels.
- **Référencement local** pour être trouvé sur les recherches « métier + Le Havre » et sur la carte Google. Voir [référencement local](/referencement-local-artisan).

## À savoir avant de poser une enseigne au Havre

Le centre-ville reconstruit par Auguste Perret est inscrit au patrimoine mondial de l’UNESCO et fait l’objet de règles de protection du patrimoine. L’installation ou la modification d’une enseigne, et parfois d’un habillage de façade, peut y nécessiter une autorisation particulière. **Renseignez-vous auprès de la mairie avant de commander** : nous vous fournissons les maquettes, les dimensions et les matériaux nécessaires pour constituer votre dossier, et nous adaptons le projet aux prescriptions si besoin.

## Comment se passe un projet avec une entreprise du Havre

1. Un premier échange par téléphone pour cerner votre besoin.
2. Un rendez-vous sur place si c’est utile (photos, mesures, découverte de votre local), ou en visioconférence.
3. Un devis détaillé, puis des maquettes à valider en ligne.
4. La mise en ligne du site, la livraison des supports imprimés ou la pose de la signalétique par notre poseur partenaire.

Déplacements : nous intervenons au Havre comme partout en France ; les frais de déplacement éventuels dépendent du projet et sont indiqués sur le devis.

## Et les communes voisines ?

Nous intervenons aussi à Montivilliers, Harfleur, Sainte-Adresse, Gonfreville-l’Orcher et dans l’ensemble de l’agglomération, ainsi qu’à Saint-Romain-de-Colbosc sur la route de Gruchet-le-Valasse. Consultez notre [zone d’intervention](/zone-intervention) pour la liste complète.`,
  },
  {
    slug: 'bolbec',
    city: 'Bolbec',
    title: 'Agence web et communication à Bolbec',
    intro:
      'Notre agence est installée à Gruchet-le-Valasse, commune voisine de Bolbec. Commerces du centre-ville, artisans et TPE bolbécais : nous venons vous voir rapidement pour votre site, votre logo, vos imprimés ou votre vitrine.',
    meta_description: 'Agence web et print voisine de Bolbec : sites internet, logos, flyers, cartes de visite et vitrophanie pour commerces et artisans. Rendez-vous sur place.',
    body: `## Une agence voisine de Bolbec

Gruchet-le-Valasse et Bolbec sont limitrophes : pour nous, Bolbec est littéralement **à côté**. Cela change beaucoup de choses pour votre projet. Un rendez-vous peut s’organiser rapidement, une mesure de vitrine se reprend sans difficulté, et nous pouvons passer récupérer des documents ou vous montrer des échantillons de papier.

## Pour les commerces du centre-ville

Les commerces de Bolbec vivent en grande partie de la clientèle de proximité. Une vitrine lisible et un bon référencement sur la carte Google font souvent la différence entre un passant qui entre et un passant qui continue sa route. Nous proposons :

- la **vitrophanie de vitrine** : nom, activité, horaires, QR code de réservation, adhésifs saisonniers ([en savoir plus](/vitrophanie-vitrine-commerce)) ;
- le **pack ouverture de commerce** pour une ouverture ou une reprise : vitrine, enseigne ou panneau, flyers, cartes de visite et fiche Google ([voir le pack](/vitrophanie-signaletique#pack-ouverture)) ;
- les **flyers et cartes de fidélité** pour vos opérations commerciales ([flyers](/flyers-depliants), [cartes de visite](/cartes-de-visite)).

## Pour les artisans et les entreprises de services

Plombiers, électriciens, menuisiers, couvreurs, paysagistes, garages, entreprises de nettoyage : nous créons des sites simples à mettre à jour, qui montrent vos chantiers et facilitent les demandes de devis. Nous pouvons aussi harmoniser votre image sur vos véhicules et vos panneaux de chantier, pour que l’on vous reconnaisse dans tout le secteur. Voir nos pages [site internet pour artisans](/creation-site-internet-artisan) et [site internet pour paysagistes](/creation-site-internet-paysagiste).

## Une ville au passé industriel et textile

Bolbec a longtemps été un centre textile important du Pays de Caux, et beaucoup d’entreprises locales ont une histoire familiale à raconter. Une identité visuelle peut s’appuyer sur cet ancrage : nous aimons construire des logos et des sites qui racontent d’où vient une entreprise, sans folklore ni clichés.

## Prendre rendez-vous

Appelez-nous ou écrivez-nous depuis la page [contact](/contact) : nous convenons d’un rendez-vous dans votre local ou dans un lieu qui vous arrange. Le devis est gratuit et sans engagement.

Déplacements : Bolbec est voisine de notre agence ; pour tout projet, les frais de déplacement éventuels dépendent de la prestation et sont indiqués sur le devis.

Nous intervenons aussi dans les communes voisines : Gruchet-le-Valasse, Lillebonne, Saint-Jean-de-la-Neuville, Raffetot, Nointot et l’ensemble de Caux Seine Agglo. Voir notre [zone d’intervention](/zone-intervention).`,
  },
  {
    slug: 'lillebonne',
    city: 'Lillebonne',
    title: 'Agence web et print à Lillebonne',
    intro:
      'Sites internet, identité visuelle, imprimés et signalétique pour les commerces, artisans et entreprises de Lillebonne et du bassin de Port-Jérôme. Nous sommes à quelques minutes, à Gruchet-le-Valasse, et nous nous déplaçons sur place.',
    meta_description: 'Création de site internet, logo, flyers, vitrophanie et signalétique à Lillebonne et Port-Jérôme-sur-Seine. Agence voisine, rendez-vous sur place, devis gratuit.',
    body: `## Lillebonne, à quelques minutes de notre agence

Lillebonne fait partie de notre **zone principale**. Depuis Gruchet-le-Valasse, nous y sommes en quelques minutes, ce qui permet de se rencontrer facilement, de photographier vos réalisations ou de relever les mesures d’une vitrine ou d’une façade avant de vous proposer un projet.

## Des commerces du centre aux entreprises de la zone industrielle

Le tissu économique de Lillebonne est varié : commerces et services du centre-ville, artisans du bâtiment, et nombreuses entreprises de services et de sous-traitance liées à la zone industrialo-portuaire de Port-Jérôme. Nous adaptons nos propositions à chacun :

- **Commerces et services de proximité** : [vitrophanie de vitrine](/vitrophanie-vitrine-commerce), horaires, flyers, cartes de visite, fiche Google bien renseignée.
- **Artisans** : [site internet d’artisan](/creation-site-internet-artisan) avec vos chantiers, panneaux de chantier et marquage de véhicule.
- **Entreprises de services à l’industrie** : site professionnel qui présente clairement vos métiers, vos références autorisées et vos offres d’emploi, plaquettes commerciales, signalétique d’accueil, supports pour les salons et forums de recrutement.

## Recruter localement grâce à votre site

Dans le bassin de Lillebonne et de Port-Jérôme, beaucoup d’entreprises cherchent à recruter. Une page « Nous rejoindre » claire, avec vos métiers, vos conditions et un formulaire simple, aide les candidats du secteur à vous trouver et à postuler. Nous pouvons l’intégrer à votre site et l’accompagner de supports imprimés pour les forums de l’emploi.

## Un patrimoine à respecter

Lillebonne est connue pour son théâtre gallo-romain, vestige de l’antique Juliobona, et pour son château. Aux abords des monuments protégés, l’installation d’une enseigne ou d’un habillage de façade peut être encadrée. Nous vous conseillons de vérifier les règles applicables auprès de la mairie avant toute commande ; nous vous fournissons maquettes et dimensions pour votre dossier.

## Comment travailler ensemble

1. Un appel ou un message depuis la page [contact](/contact).
2. Un rendez-vous à Lillebonne, dans votre local ou sur un chantier, si c’est utile.
3. Un devis clair, puis des maquettes à valider.
4. La livraison, la mise en ligne ou la pose par notre poseur partenaire.

Déplacements : Lillebonne est à quelques minutes de notre agence ; les frais de déplacement éventuels dépendent du projet et sont indiqués sur le devis.

Nous intervenons également à Port-Jérôme-sur-Seine, Saint-Antoine-la-Forêt, Tancarville, La Frénaye et dans tout le secteur. Voir notre [zone d’intervention](/zone-intervention).`,
  },
];

export interface ServiceSeed {
  slug: string;
  category: string;
  name: string;
  summary: string;
  description: string;
  lead_time: string;
  includes: string;
  conditions: string;
  exclusions: string;
}

/** Prestations sur devis (aucun prix inventé). */
export const SERVICES_V3: ServiceSeed[] = [
  {
    slug: 'vitrophanie-signaletique',
    category: 'signaletique',
    name: 'Vitrophanie & signalétique',
    summary: 'Vitrines, enseignes, panneaux de chantier, bâches et véhicules : création, impression et pose.',
    description: 'Création des visuels, impression professionnelle sur adhésifs et panneaux adaptés, pose par notre poseur partenaire dans notre zone d’intervention ou livraison prête à poser.',
    lead_time: 'Selon le support et la pose',
    includes: 'Conseil sur le matériau et le sens de pose\nMaquette en situation sur photo de votre local\nBon à tirer avant fabrication\nImpression professionnelle\nPose par notre partenaire (zone d’intervention) ou livraison prête à poser',
    conditions: 'Devis établi à partir de vos photos et de vos mesures (relevé sur place dans notre zone). Les autorisations d’enseigne éventuelles restent à la charge du client.',
    exclusions: 'Dépose d’une ancienne enseigne, travaux d’électricité et nacelle éventuelle chiffrés séparément si nécessaires.',
  },
  {
    slug: 'pack-ouverture-commerce',
    category: 'pack',
    name: 'Pack ouverture de commerce',
    summary: 'Vitrine, enseigne, flyers, cartes et fiche Google : tout pour ouvrir avec une image cohérente.',
    description: 'Un ensemble ajusté à votre local : vitrophanie de vitrine et horaires, panneau ou enseigne, flyers d’ouverture, cartes de visite et fiche Google.',
    lead_time: 'Selon le contenu du pack',
    includes: 'Vitrophanie de vitrine et adhésif d’horaires\nPanneau ou enseigne de façade\nFlyers d’ouverture et cartes de visite assortis\nCréation ou optimisation de la fiche Google\nEn option : logo, site vitrine, kakémono',
    conditions: 'Contenu et prix définis sur devis selon votre local et vos besoins.',
    exclusions: 'Autorisations d’enseigne, frais de distribution des flyers et nom de domaine non inclus.',
  },
];

export interface PortfolioEnrichment {
  client_type: string;
  need: string;
  services: string; // chemins de pages de prestations, un par ligne : « /chemin | Libellé »
  objectives: string;
  before_label: string;
  after_label: string;
}

/** Champs commerciaux ajoutés aux concepts existants. */
export const PORTFOLIO_ENRICH_V3: Record<string, PortfolioEnrichment> = {
  'atelier-chene-et-fil': {
    client_type: 'Artisan menuisier-ébéniste',
    need: 'Être trouvé et recevoir des demandes de devis qualifiées',
    services: '/creation-site-internet-artisan | Site internet pour artisans\n/referencement-local-artisan | Référencement local\n/vitrophanie-signaletique | Panneaux de chantier',
    objectives: 'Présenter les réalisations par type d’ouvrage\nRecevoir des demandes de devis avec dimensions et photos\nApparaître sur « menuisier + commune » dans le secteur',
    before_label: 'Avant : une page Facebook peu tenue et aucune présentation des ouvrages',
    after_label: 'Après : un site organisé par type d’ouvrage, avec un formulaire de devis guidé',
  },
  'les-pages-lentes': {
    client_type: 'Café-librairie (commerce de proximité)',
    need: 'Créer une marque reconnaissable de la rue au comptoir',
    services: '/identite-visuelle-logo | Logo et identité visuelle\n/vitrophanie-vitrine-commerce | Vitrophanie de vitrine\n/cartes-de-visite | Cartes de fidélité',
    objectives: 'Une identité lisible sur l’enseigne comme sur un tampon\nUne déclinaison simple sur les supports du quotidien',
    before_label: '',
    after_label: '',
  },
  'studio-meche': {
    client_type: 'Salon de coiffure (ouverture)',
    need: 'Annoncer l’ouverture et faire revenir les clientes',
    services: '/flyers-depliants | Flyers\n/cartes-de-visite | Cartes de visite et de rendez-vous\n/vitrophanie-signaletique | Pack ouverture de commerce',
    objectives: 'Faire connaître l’ouverture dans le quartier\nFaciliter la prise du rendez-vous suivant',
    before_label: '',
    after_label: '',
  },
  'cabinet-mouvement': {
    client_type: 'Cabinet de kinésithérapie',
    need: 'Rendre les informations pratiques accessibles sur mobile',
    services: '/refonte-site-internet | Refonte de site\n/referencement-seo | Référencement',
    objectives: 'Horaires et prise de rendez-vous trouvés en un clic\nConserver les visites existantes grâce aux redirections',
    before_label: 'Avant : un site illisible sur téléphone, horaires introuvables',
    after_label: 'Après : informations pratiques en tête de page, contrastes renforcés',
  },
  'le-comptoir-du-marche': {
    client_type: 'Restaurant',
    need: 'Publier régulièrement sans y passer des heures',
    services: '/reseaux-sociaux | Visuels pour les réseaux sociaux',
    objectives: 'Une identité reconnaissable dans le fil d’actualité\nDes gabarits réutilisables en quelques minutes',
    before_label: '',
    after_label: '',
  },
  'gite-des-trois-sources': {
    client_type: 'Gîte et chambres d’hôtes',
    need: 'Présenter le lieu et ses activités aux visiteurs',
    services: '/affiches-brochures | Brochures\n/creation-site-internet | Site internet',
    objectives: 'Un document agréable à feuilleter, à laisser dans les chambres et à envoyer',
    before_label: '',
    after_label: '',
  },
};

export interface PortfolioSeed extends PortfolioEnrichment {
  slug: string;
  title: string;
  category: string;
  summary: string;
  challenge: string;
  solution: string;
  outcome: string;
  deliverables: string;
  visual: string;
  accent: string;
  is_case_study: number;
  featured: number;
  sort_order: number;
}

/** Nouveaux concepts de démonstration (entreprises fictives). */
export const PORTFOLIO_NEW_V3: PortfolioSeed[] = [
  {
    slug: 'fournil-du-caux',
    title: 'Fournil du Caux',
    category: 'Vitrophanie & signalétique',
    summary: 'Habillage de vitrine et pack ouverture pour une boulangerie fictive : être repérée depuis la rue dès le premier jour.',
    challenge: 'Une boulangerie qui ouvre dans un local dont la vitrine est vierge : les passants ne savent ni ce qu’on y vend, ni quand c’est ouvert. Il faut une image forte, lisible depuis l’autre trottoir, et des supports d’ouverture cohérents.',
    solution: 'Un lettrage blanc du nom au-dessus de la vitrine, l’activité en grandes capitales sur le vitrage, une vague ocre reprise du logo, les horaires à hauteur des yeux près de la porte et un store en bandes aux couleurs de la marque. Les flyers d’ouverture et les cartes de fidélité reprennent exactement les mêmes codes.',
    outcome: 'Concept de démonstration : aucun résultat client n’est revendiqué. Sur un vrai projet, nous suivrions la fréquentation les premières semaines, les retours des clients sur la vitrine et l’utilisation des cartes de fidélité.',
    deliverables: 'Maquette de vitrine en situation\nLettrage et vitrophanie imprimée\nAdhésif d’horaires\nFlyers d’ouverture\nCartes de fidélité',
    visual: 'vitrine-commerce',
    accent: '#C2410C',
    is_case_study: 1,
    featured: 1,
    sort_order: 5,
    client_type: 'Boulangerie (ouverture de commerce)',
    need: 'Être repérée depuis la rue et annoncer l’ouverture',
    services: '/vitrophanie-vitrine-commerce | Vitrophanie de vitrine\n/vitrophanie-signaletique | Pack ouverture de commerce\n/flyers-depliants | Flyers d’ouverture\n/cartes-de-visite | Cartes de fidélité',
    objectives: 'Rendre l’activité lisible depuis l’autre trottoir\nAfficher clairement les horaires\nDonner une image cohérente de la vitrine aux imprimés',
    before_label: 'Avant : une vitrine vierge, sans nom ni horaires',
    after_label: 'Après : nom, activité, horaires et couleurs de la marque visibles de loin',
  },
  {
    slug: 'jardins-de-la-valmont',
    title: 'Jardins de la Valmont',
    category: 'Site internet',
    summary: 'Site vitrine pour un paysagiste fictif : une galerie de jardins avant/après et une demande de visite simplifiée.',
    challenge: 'Un paysagiste dont les plus beaux jardins ne sont visibles que sur son téléphone. Les particuliers demandent des exemples avant de le contacter, et les demandes arrivent sans information sur le terrain.',
    solution: 'Une page d’accueil construite autour de grandes photos de jardins, une page par prestation (création, entretien, taille, clôtures), une galerie avant/après et un formulaire de demande de visite qui demande la surface approximative et des photos du terrain.',
    outcome: 'Concept de démonstration : aucun résultat client n’est revendiqué. Sur un vrai projet, nous suivrions le nombre de demandes de visite, leur qualité et les recherches locales sur lesquelles le site apparaît.',
    deliverables: 'Arborescence et textes\nGalerie avant/après\nFormulaire de demande de visite\nFiche Google optimisée\nMarquage de véhicule assorti (proposition)',
    visual: 'site-paysagiste',
    accent: '#5B8C3A',
    is_case_study: 1,
    featured: 0,
    sort_order: 15,
    client_type: 'Paysagiste (création et entretien de jardins)',
    need: 'Montrer ses réalisations et recevoir des demandes de visite qualifiées',
    services: '/creation-site-internet-paysagiste | Site internet pour paysagistes\n/referencement-local-artisan | Référencement local\n/vitrophanie-signaletique | Marquage de véhicule',
    objectives: 'Mettre en valeur les jardins réalisés\nSéparer clairement création et entretien\nRecevoir des demandes avec surface et photos du terrain',
    before_label: 'Avant : des photos de chantiers dispersées sur un téléphone',
    after_label: 'Après : une galerie organisée par type de jardin, avec comparatifs avant/après',
  },
];
