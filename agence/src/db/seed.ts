import type { Db, Statement } from './types';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { PrintOptions } from '../domain/print';
import { portfolioEnrichStatements } from './migrations';

/**
 * Données initiales, insérées UNE SEULE FOIS (base vide). Tout est ensuite modifiable dans l'administration.
 *  • Tarifs des prestations : ceux fournis par l'exploitant (prix de départ indicatifs).
 *  • Catalogue d'impression : options relevées sur les fiches publiques HelloPrint le 20/10/2026.
 *  • Prix fournisseur : seules quelques configurations dont le prix était affiché avec sa configuration complète
 *    sont importées, avec le statut « à vérifier » : elles ne sont PAS publiées tant qu'elles n'ont pas été
 *    confirmées manuellement et qu'un prix de vente n'a pas été validé.
 *  • Réalisations : concepts fictifs, clairement identifiés comme tels.
 */

const SEED_DATE = '2026-10-20';
const OBSERVED_SOURCE = 'Lecture de la fiche publique HelloPrint le 20/10/2026 (prix HT affiché pour cette configuration exacte). À confirmer manuellement avant publication.';

type Service = {
  slug: string;
  category: 'graphisme' | 'web' | 'recurrent' | 'pack' | 'accompagnement';
  name: string;
  summary: string;
  description: string;
  price_mode: 'fixed' | 'from' | 'quote';
  price_ht: number | null;
  billing?: 'once' | 'monthly';
  lead_time: string;
  revisions: number | null;
  options?: { name: string; price_ht: number }[];
  includes: string;
  conditions: string;
  exclusions: string;
  featured?: boolean;
};

const PRINT_EXCLUSION = 'Impression, livraison et frais d’expédition non inclus : ils sont chiffrés séparément selon le support choisi.';

export const SEED_SERVICES: Service[] = [
  // ─── Création graphique ───
  {
    slug: 'flyer-personnalise', category: 'graphisme', name: 'Flyer personnalisé',
    summary: 'Un flyer conçu sur mesure pour votre offre, prêt pour l’impression.',
    description: 'Conception graphique d’un flyer à votre image : hiérarchie claire, message commercial lisible en trois secondes, fichier préparé selon les contraintes de l’imprimeur (fond perdu, marges, profil colorimétrique).',
    price_mode: 'fixed', price_ht: 6900, lead_time: '5 jours ouvrés après réception des éléments', revisions: 2,
    options: [{ name: 'Second visuel (verso entièrement différent)', price_ht: 2900 }, { name: 'Série de révisions supplémentaire', price_ht: 2000 }],
    includes: 'Création recto ou recto-verso\nFormats A6, A5, A4 ou DL\nFichier PDF prêt à imprimer\nFichier image pour le web et les réseaux',
    conditions: 'Textes, logo et photos fournis par le client. Révisions au-delà du nombre inclus sur devis.',
    exclusions: PRINT_EXCLUSION + ' Achat de photos de banque d’images non inclus.',
    featured: true,
  },
  {
    slug: 'carte-de-visite-personnalisee', category: 'graphisme', name: 'Carte de visite personnalisée',
    summary: 'Une carte de visite soignée, cohérente avec votre identité.',
    description: 'Création d’une carte de visite recto-verso : mise en page de vos coordonnées, déclinaison de votre logo, choix typographique. Fichier conforme aux exigences de l’imprimeur.',
    price_mode: 'fixed', price_ht: 4900, lead_time: '4 jours ouvrés après réception des éléments', revisions: 2,
    options: [{ name: 'Déclinaison pour un collaborateur supplémentaire', price_ht: 1500 }],
    includes: 'Création recto-verso\nFormat standard 85 × 55 mm ou portrait\nFichier PDF prêt à imprimer',
    conditions: 'Logo fourni en haute définition par le client (sinon, voir l’offre Identité visuelle).',
    exclusions: PRINT_EXCLUSION,
  },
  {
    slug: 'pack-flyer-carte', category: 'pack', name: 'Pack flyer + carte de visite',
    summary: 'Le duo indispensable pour démarrer, avec une identité cohérente.',
    description: 'Conception d’un flyer et d’une carte de visite harmonisés : mêmes couleurs, même typographie, message cohérent.',
    price_mode: 'fixed', price_ht: 9900, lead_time: '7 jours ouvrés après réception des éléments', revisions: 2,
    includes: 'Création d’un flyer (recto ou recto-verso)\nCréation d’une carte de visite recto-verso\nFichiers PDF prêts à imprimer',
    conditions: 'Textes, logo et photos fournis par le client.',
    exclusions: PRINT_EXCLUSION,
    featured: true,
  },
  {
    slug: 'identite-visuelle-simple', category: 'graphisme', name: 'Identité visuelle simple',
    summary: 'Un logo et ses déclinaisons pour être reconnu au premier coup d’œil.',
    description: 'Création d’un logo et d’une mini-charte : couleurs, typographies, versions du logo (couleur, monochrome, petit format). Une base solide pour tous vos supports.',
    price_mode: 'fixed', price_ht: 19900, lead_time: '10 jours ouvrés', revisions: 3,
    options: [{ name: 'Proposition de logo supplémentaire', price_ht: 6000 }, { name: 'Charte graphique détaillée (guide PDF)', price_ht: 9000 }],
    includes: 'Questionnaire de marque\n2 pistes de logo\nLogo final en couleur, monochrome et icône\nPalette de couleurs et typographies\nFichiers SVG, PNG et PDF',
    conditions: 'Cession des droits d’exploitation du logo final à réception du paiement complet, selon les CGV.',
    exclusions: 'Dépôt de marque (INPI) non inclus. Achat de polices commerciales éventuelles non inclus.',
    featured: true,
  },
  {
    slug: 'visuel-reseaux-sociaux', category: 'graphisme', name: 'Visuel réseaux sociaux',
    summary: 'Un visuel prêt à publier, aux bons formats.',
    description: 'Création d’un visuel pour Instagram, Facebook ou LinkedIn, décliné aux formats carré, portrait et story.',
    price_mode: 'fixed', price_ht: 3900, lead_time: '3 jours ouvrés', revisions: 1,
    options: [{ name: 'Lot de 4 visuels sur le même thème', price_ht: 11900 }],
    includes: 'Un visuel décliné en 3 formats\nFichiers PNG / JPG optimisés',
    conditions: 'Textes fournis par le client.',
    exclusions: 'Publication, gestion de compte et achat d’espace publicitaire non inclus.',
  },
  {
    slug: 'depliant-personnalise', category: 'graphisme', name: 'Dépliant personnalisé',
    summary: 'Un dépliant 2, 3 ou 4 volets pour présenter vos services en détail.',
    description: 'Conception d’un dépliant : architecture des volets, rédaction de la mise en page, préparation du fichier selon le type de pliage.',
    price_mode: 'quote', price_ht: null, lead_time: 'Selon le nombre de volets', revisions: 2,
    includes: 'Maquette de pliage\nCréation de toutes les faces\nFichier PDF prêt à imprimer',
    conditions: 'Prix selon le nombre de volets et la quantité de contenu.',
    exclusions: PRINT_EXCLUSION,
  },
  {
    slug: 'affiche-personnalisee', category: 'graphisme', name: 'Affiche ou grand format',
    summary: 'Affiches, roll-ups et visuels grand format lisibles de loin.',
    description: 'Création d’une affiche, d’un kakémono ou d’un visuel grand format, avec une attention particulière à la lisibilité à distance.',
    price_mode: 'quote', price_ht: null, lead_time: 'Selon le format', revisions: 2,
    includes: 'Création du visuel\nFichier aux dimensions et à la résolution demandées par l’imprimeur',
    conditions: 'Prix selon le format et la complexité.',
    exclusions: PRINT_EXCLUSION,
  },
  {
    slug: 'brochure-personnalisee', category: 'graphisme', name: 'Brochure ou livret',
    summary: 'Catalogue, plaquette ou livret de présentation multipages.',
    description: 'Mise en page d’une brochure agrafée : chemin de fer, gabarits de pages, intégration de vos textes et photos.',
    price_mode: 'quote', price_ht: null, lead_time: 'Selon le nombre de pages', revisions: 2,
    includes: 'Chemin de fer\nMise en page complète\nFichier PDF prêt à imprimer',
    conditions: 'Prix selon le nombre de pages et l’état des contenus fournis.',
    exclusions: PRINT_EXCLUSION + ' Rédaction et photographie non incluses.',
  },
  {
    slug: 'creation-graphique-sur-mesure', category: 'graphisme', name: 'Création graphique sur mesure',
    summary: 'Étiquettes, autocollants, bâches, supports promotionnels…',
    description: 'Pour tout support qui sort des formats standards : nous étudions la demande et vous adressons un devis.',
    price_mode: 'quote', price_ht: null, lead_time: 'Sur devis', revisions: 2,
    includes: 'Étude du besoin\nCréation du visuel\nFichier conforme aux contraintes du fabricant',
    conditions: 'Sur devis.',
    exclusions: PRINT_EXCLUSION,
  },

  // ─── Sites internet ───
  {
    slug: 'site-essentiel', category: 'web', name: 'Site Essentiel',
    summary: 'Un site vitrine clair et rapide pour être trouvé et contacté.',
    description: 'Un site vitrine professionnel, pensé pour le mobile, qui présente votre activité et transforme les visiteurs en demandes de contact.',
    price_mode: 'from', price_ht: 69000, lead_time: '3 à 4 semaines après réception des contenus', revisions: 2,
    options: [{ name: 'Page supplémentaire', price_ht: 9000 }, { name: 'Rédaction des textes (par page)', price_ht: 8000 }],
    includes: 'Jusqu’à 5 pages\nDesign sur mesure, adapté au mobile\nFormulaire de contact protégé\nOptimisation technique du référencement (balises, sitemap, vitesse)\nPages mentions légales, confidentialité et cookies\nMise en ligne et formation de prise en main',
    conditions: 'Textes et photos fournis par le client. Planning démarré à réception de l’acompte et des contenus.',
    exclusions: 'Nom de domaine et hébergement non inclus (facturés séparément ou souscrits directement par le client). Photos de banque d’images, rédaction et maintenance non incluses.',
    featured: true,
  },
  {
    slug: 'site-business', category: 'web', name: 'Site Business',
    summary: 'Un site plus complet pour développer votre activité et vos demandes de devis.',
    description: 'Pour les entreprises qui veulent détailler leurs services, montrer leurs réalisations et générer des demandes qualifiées.',
    price_mode: 'from', price_ht: 119000, lead_time: '4 à 6 semaines après réception des contenus', revisions: 3,
    options: [{ name: 'Page supplémentaire', price_ht: 9000 }, { name: 'Blog / actualités administrables', price_ht: 25000 }],
    includes: 'Jusqu’à 10 pages\nPages de services détaillées\nGalerie de réalisations\nFormulaire de devis multi-étapes\nOptimisation SEO technique et locale de base\nStatistiques de visite respectueuses du consentement\nFormation de prise en main',
    conditions: 'Textes et photos fournis par le client.',
    exclusions: 'Nom de domaine et hébergement non inclus. Rédaction, photographie et maintenance non incluses.',
    featured: true,
  },
  {
    slug: 'pack-visibilite', category: 'pack', name: 'Pack Visibilité',
    summary: 'Site, présence locale et supports imprimés : un lancement cohérent.',
    description: 'Le Site Essentiel, accompagné de la mise en place de votre présence locale et de vos supports de communication de base.',
    price_mode: 'from', price_ht: 139000, lead_time: '4 à 6 semaines', revisions: 2,
    includes: 'Site Essentiel (jusqu’à 5 pages)\nCréation ou optimisation de la fiche d’établissement Google\nCréation d’un flyer et d’une carte de visite assortis\nConseils de démarrage pour les réseaux sociaux',
    conditions: 'Le client reste propriétaire de ses comptes (Google, réseaux sociaux, nom de domaine).',
    exclusions: 'Impression des supports, nom de domaine et hébergement non inclus. Aucun positionnement dans Google ne peut être garanti.',
    featured: true,
  },
  {
    slug: 'refonte-site', category: 'web', name: 'Refonte de site',
    summary: 'Moderniser un site existant sans perdre son référencement.',
    description: 'Audit de l’existant, nouvelle structure, nouveau design et plan de redirections pour préserver votre visibilité.',
    price_mode: 'quote', price_ht: null, lead_time: 'Selon l’audit', revisions: 3,
    includes: 'Audit du site actuel (contenus, technique, référencement)\nNouvelle arborescence\nNouveau design responsive\nPlan de redirections des anciennes adresses\nMise en ligne accompagnée',
    conditions: 'Accès à l’hébergement et au nom de domaine actuels nécessaires.',
    exclusions: 'Migration de boutique en ligne et de données complexes sur devis spécifique.',
  },

  // ─── Services récurrents ───
  {
    slug: 'maintenance', category: 'recurrent', name: 'Maintenance', billing: 'monthly',
    summary: 'Mises à jour, sauvegardes et surveillance de votre site.',
    description: 'Votre site reste à jour, sauvegardé et surveillé. En cas de problème, nous intervenons.',
    price_mode: 'from', price_ht: 3900, lead_time: 'Mensuel, sans engagement au-delà de la durée prévue au contrat', revisions: null,
    includes: 'Mises à jour de sécurité\nSauvegarde régulière\nSurveillance de disponibilité\nRapport mensuel',
    conditions: 'Durée et préavis précisés au contrat.',
    exclusions: 'Modifications de contenus, nouvelles fonctionnalités et hébergement non inclus.',
  },
  {
    slug: 'maintenance-modifications', category: 'recurrent', name: 'Maintenance et petites modifications', billing: 'monthly',
    summary: 'La maintenance, plus vos petites mises à jour de contenus.',
    description: 'Tout le contenu de l’offre Maintenance, avec un temps mensuel pour vos petites modifications (textes, photos, horaires…).',
    price_mode: 'from', price_ht: 6900, lead_time: 'Mensuel', revisions: null,
    includes: 'Tout le contenu de l’offre Maintenance\nPetites modifications de contenus (volume précisé au contrat)\nIntervention sous 2 jours ouvrés',
    conditions: 'Le temps non utilisé n’est pas reportable, sauf mention contraire au contrat.',
    exclusions: 'Création de nouvelles pages ou fonctionnalités sur devis.',
    featured: true,
  },
  {
    slug: 'seo-local', category: 'recurrent', name: 'Accompagnement SEO local', billing: 'monthly',
    summary: 'Gagner en visibilité dans votre zone, mois après mois.',
    description: 'Suivi et amélioration de votre visibilité locale : fiche d’établissement, contenus, cohérence de vos coordonnées, suivi des positions et de la Search Console.',
    price_mode: 'from', price_ht: 14900, lead_time: 'Mensuel — résultats progressifs', revisions: null,
    includes: 'Audit de départ\nOptimisation de la fiche d’établissement\nAméliorations de contenus du site\nSuivi mensuel des indicateurs\nRapport et recommandations',
    conditions: 'Le référencement naturel produit des effets progressifs ; aucun classement ne peut être garanti.',
    exclusions: 'Publicité payante (Google Ads) et achat de liens non inclus.',
  },
  {
    slug: 'accompagnement-numerique', category: 'accompagnement', name: 'Accompagnement numérique',
    summary: 'Un regard extérieur pour choisir vos outils et prioriser vos actions.',
    description: 'Séances de conseil pour structurer votre présence en ligne : choix des outils, priorités, prise en main.',
    price_mode: 'quote', price_ht: null, lead_time: 'Selon vos disponibilités', revisions: null,
    includes: 'Diagnostic de votre présence en ligne\nPlan d’action priorisé\nSéances de prise en main',
    conditions: 'Format et durée définis ensemble.',
    exclusions: 'Mise en œuvre technique facturée séparément si nécessaire.',
  },
];

type Product = {
  slug: string;
  family: string;
  name: string;
  summary: string;
  description: string;
  supplier_url: string;
  options: PrintOptions;
  optionsChecked: boolean;
  design_service_slug: string;
  visual: string;
  status: 'published' | 'draft';
};

const DELIVERY = ['Standard', 'Rapide', 'Express'];

export const SEED_PRODUCTS: Product[] = [
  {
    slug: 'flyers', family: 'flyers', name: 'Flyers',
    summary: 'Le support le plus efficace pour annoncer une offre, un événement ou une ouverture.',
    description: 'Flyers imprimés en quadrichromie, du format de poche A6 au A4. Papiers couchés mat ou brillant, offset ou recyclé, plusieurs grammages.',
    supplier_url: 'https://www.helloprint.com/fr-fr/flyersclassiques',
    options: {
      format: ['A6 (105 × 148 mm)', 'A5 (148 × 210 mm)', 'A4 (210 × 297 mm)', 'DL (99 × 210 mm)'],
      orientation: ['Portrait', 'Paysage'],
      paper: ['Couché brillant', 'Couché mat', 'Offset sans bois', 'Recyclé'],
      weight: ['90 g', '115 g', '135 g', '170 g', '250 g', '300 g', '350 g', '400 g'],
      printing: ['Recto', 'Recto-verso'],
      delivery: DELIVERY,
      quantity: [25, 50, 100, 250, 500, 1000, 2500, 5000],
      nonPricing: ['orientation'],
    },
    optionsChecked: true, design_service_slug: 'flyer-personnalise', visual: 'flyer', status: 'published',
  },
  {
    slug: 'cartes-de-visite', family: 'cartes', name: 'Cartes de visite',
    summary: 'Format classique ou portrait, papiers épais, finitions mates, brillantes ou soft-touch.',
    description: 'Cartes de visite en 300 à 450 g, avec pelliculage, vernis ou soft-touch, coins carrés ou arrondis.',
    supplier_url: 'https://www.helloprint.com/fr-fr/cartedevisiteclassique',
    options: {
      format: ['Classique 85 × 55 mm', 'Portrait 55 × 85 mm', 'Carré 55 × 55 mm'],
      paper: ['Couché mat', 'Couché brillant', 'Éco-responsable'],
      weight: ['300 g', '350 g', '400 g', '450 g'],
      finish: ['Sans finition', 'Pelliculage mat recto-verso', 'Pelliculage brillant recto-verso', 'Vernis UV recto-verso', 'Pelliculage soft-touch recto-verso'],
      printing: ['Recto', 'Recto-verso'],
      extra: ['Coins carrés', 'Coins arrondis'],
      labels: { extra: 'Coins' },
      delivery: DELIVERY,
      quantity: [50, 100, 250, 500, 1000, 2500],
    },
    optionsChecked: true, design_service_slug: 'carte-de-visite-personnalisee', visual: 'cartes', status: 'published',
  },
  {
    slug: 'cartes-de-visite-premium', family: 'cartes', name: 'Cartes de visite premium',
    summary: 'Dorure, vernis sélectif et papiers de création pour une première impression mémorable.',
    description: 'Cartes 85 × 55 mm avec finition exclusive (vernis sélectif ou dorure), sur papiers épais de création.',
    supplier_url: 'https://www.helloprint.com/fr-fr/cartesdevisitefinitionluxe',
    options: {
      format: ['85 × 55 mm paysage', '55 × 85 mm portrait'],
      paper: ['400 g couché mat', '350 g Kingboard non couché', '300 g Tintoretto touch non couché'],
      finish: ['Vernis sélectif', 'Dorure or', 'Dorure argent', 'Dorure cuivre', 'Dorure or rose'],
      printing: ['Recto', 'Recto-verso'],
      extra: ['Finition exclusive au recto', 'Finition exclusive recto-verso'],
      labels: { extra: 'Application de la finition' },
      delivery: DELIVERY,
      quantity: [500, 1000, 2000, 5000],
    },
    optionsChecked: true, design_service_slug: 'carte-de-visite-personnalisee', visual: 'cartes-premium', status: 'published',
  },
  {
    slug: 'depliants', family: 'depliants', name: 'Dépliants',
    summary: 'De 2 à 4 volets pour présenter vos services, tarifs ou menus en détail.',
    description: 'Dépliants pliés en usine : pli simple, roulé, accordéon ou croisé. La configuration exacte (format, papier) est confirmée lors du devis.',
    supplier_url: 'https://www.helloprint.com/fr-fr/depliantslivresplies',
    options: {
      format: ['DL (99 × 210 mm fermé)', 'A5', 'A4'],
      extra: ['1 pli — 2 volets', '2 plis roulés — 3 volets', '2 plis accordéon — 3 volets', '3 plis roulés — 4 volets', '3 plis accordéon — 4 volets', '2 plis croisés — 4 volets'],
      labels: { extra: 'Pliage' },
      paper: ['Papier mat', 'Papier recyclé'],
      printing: ['Recto-verso'],
      quantity: [100, 250, 500, 1000, 2500],
    },
    optionsChecked: false, design_service_slug: 'depliant-personnalise', visual: 'depliant', status: 'published',
  },
  {
    slug: 'affiches', family: 'affiches', name: 'Affiches',
    summary: 'Du A4 au A0 pour vos vitrines, salons et événements.',
    description: 'Affiches papier couché, en intérieur, avec ou sans pelliculage. Pour l’extérieur, demandez-nous conseil.',
    supplier_url: 'https://www.helloprint.com/fr-fr/affiches',
    options: {
      format: ['A4 (210 × 297 mm)', 'A3 (297 × 420 mm)', 'A2 (420 × 594 mm)', 'A1 (594 × 841 mm)', 'A0 (841 × 1189 mm)', 'B2 (500 × 700 mm)', 'B1 (700 × 1000 mm)'],
      orientation: ['Portrait', 'Paysage'],
      paper: ['Couché brillant', 'Couché mat'],
      weight: ['135 g', '170 g', '250 g'],
      finish: ['Sans finition', 'Pelliculage brillant recto', 'Pelliculage mat recto'],
      printing: ['Recto', 'Recto-verso'],
      delivery: DELIVERY,
      quantity: [1, 2, 5, 10, 25, 50, 100, 250, 500],
      nonPricing: ['orientation'],
    },
    optionsChecked: true, design_service_slug: 'affiche-personnalisee', visual: 'affiche', status: 'published',
  },
  {
    slug: 'brochures', family: 'brochures', name: 'Brochures agrafées',
    summary: 'Catalogues, plaquettes et livrets de 8 à 48 pages, reliure 2 agrafes.',
    description: 'Brochures piquées (2 agrafes métal), papier intérieur au choix, couverture identique ou plus épaisse.',
    supplier_url: 'https://www.helloprint.com/fr-fr/livrets',
    options: {
      format: ['A4 (210 × 297 mm)', 'A5 (148 × 210 mm)', 'A6 (105 × 148 mm)', 'Carré 210 × 210 mm', 'Carré 148 × 148 mm'],
      paper: ['Couché brillant', 'Couché satiné', 'Offset sans bois', 'Recyclé'],
      weight: ['90 g', '135 g', '170 g', '250 g'],
      finish: ['Couverture identique à l’intérieur', 'Couverture 170 g', 'Couverture 250 g', 'Couverture 300 g'],
      extra: ['8 pages', '12 pages', '16 pages', '20 pages', '24 pages', '28 pages', '32 pages', '36 pages', '40 pages', '44 pages', '48 pages'],
      labels: { weight: 'Grammage intérieur', finish: 'Couverture', extra: 'Nombre de pages (couverture incluse)' },
      delivery: DELIVERY,
      quantity: [25, 50, 100, 250, 500, 1000],
    },
    optionsChecked: true, design_service_slug: 'brochure-personnalisee', visual: 'brochure', status: 'published',
  },
  {
    slug: 'roll-up', family: 'complementaires', name: 'Roll-up (kakémono)',
    summary: 'Le stand prêt en 30 secondes pour salons, accueils et événements.',
    description: 'Kakémono enrouleur livré avec sa structure et son sac de transport. Plusieurs largeurs et modèles de structure.',
    supplier_url: 'https://www.helloprint.com/fr-fr/kakemonorollupbudget',
    options: {
      format: ['80 × 200 cm', '85 × 200 cm', '100 × 200 cm', '120 × 200 cm'],
      extra: ['Structure Budget argentée', 'Structure Budget noire', 'Structure Premium argentée', 'Structure Deluxe argentée'],
      paper: ['PVC standard', 'Polyester haute définition', 'Éco — sans PVC'],
      labels: { extra: 'Structure', paper: 'Matériau' },
      delivery: DELIVERY,
      quantity: [1, 2, 3, 5, 10],
    },
    optionsChecked: true, design_service_slug: 'affiche-personnalisee', visual: 'rollup', status: 'published',
  },
  {
    slug: 'etiquettes-rouleau', family: 'complementaires', name: 'Étiquettes en rouleau',
    summary: 'Pour vos produits, bocaux, emballages et conditionnements.',
    description: 'Étiquettes adhésives en rouleau, rondes, carrées, rectangulaires ou ovales. Taille exacte confirmée lors du devis.',
    supplier_url: 'https://www.helloprint.com/fr-fr/etiquette-autocollant-rouleau',
    options: {
      format: ['Rondes', 'Carrées', 'Rectangulaires', 'Ovales'],
      paper: ['Plastique blanc', 'Transparent', 'Papier'],
      finish: ['Polypropylène brillant', 'Polypropylène mat', 'Natureflex biodégradable'],
      labels: { format: 'Forme', paper: 'Aspect', finish: 'Matériau' },
      quantity: [100, 250, 500, 1000, 2000, 5000],
    },
    optionsChecked: false, design_service_slug: 'creation-graphique-sur-mesure', visual: 'etiquettes', status: 'published',
  },
  {
    slug: 'autocollants', family: 'complementaires', name: 'Autocollants',
    summary: 'Ronds, carrés, ovales ou découpés à la forme de votre visuel.',
    description: 'Autocollants vinyle, papier, transparent ou kraft. Produit sur mesure : décrivez votre besoin, nous revenons vers vous avec une proposition chiffrée.',
    supplier_url: 'https://www.helloprint.com/fr-fr/impressions-stickers',
    options: { quantity: [] },
    optionsChecked: false, design_service_slug: 'creation-graphique-sur-mesure', visual: 'stickers', status: 'published',
  },
  {
    slug: 'baches-banderoles', family: 'complementaires', name: 'Bâches et banderoles',
    summary: 'Bâches sur mesure, barrières de chantier, banderoles d’événement.',
    description: 'Formats sur mesure, matériaux adaptés à l’usage (micro-perforé, ignifugé, intérieur ou extérieur). Produit sur devis.',
    supplier_url: 'https://www.helloprint.com/fr-fr/banderole-publicitaire',
    options: { quantity: [] },
    optionsChecked: false, design_service_slug: 'creation-graphique-sur-mesure', visual: 'bache', status: 'published',
  },
];

/** Prix observés pour des configurations EXACTES (statut « à vérifier », non publiés). Montants HT en centimes. */
const OBSERVED_VARIANTS: { product: string; attrs: Partial<Record<string, string>>; quantity: number; price: number; note: string }[] = [
  { product: 'flyers', attrs: { format: 'A5 (148 × 210 mm)', paper: 'Couché brillant', weight: '135 g', printing: 'Recto-verso', delivery: 'Standard' }, quantity: 500, price: 3299, note: 'Conditionnement « Pas de lot ». Frais de port à confirmer.' },
  { product: 'cartes-de-visite', attrs: { format: 'Classique 85 × 55 mm', paper: 'Couché mat', weight: '350 g', finish: 'Sans finition', printing: 'Recto-verso', extra: 'Coins carrés', delivery: 'Standard' }, quantity: 250, price: 1829, note: 'Frais de port à confirmer.' },
  { product: 'cartes-de-visite', attrs: { format: 'Classique 85 × 55 mm', paper: 'Couché mat', weight: '350 g', finish: 'Sans finition', printing: 'Recto-verso', extra: 'Coins carrés', delivery: 'Standard' }, quantity: 50, price: 1479, note: 'Prix lu dans la grille des quantités de la même configuration. Frais de port à confirmer.' },
  { product: 'affiches', attrs: { format: 'A2 (420 × 594 mm)', paper: 'Couché brillant', weight: '135 g', finish: 'Sans finition', printing: 'Recto', delivery: 'Standard' }, quantity: 100, price: 4949, note: 'Frais de port à confirmer.' },
  { product: 'brochures', attrs: { format: 'A4 (210 × 297 mm)', paper: 'Couché brillant', weight: '170 g', finish: 'Couverture identique à l’intérieur', extra: '8 pages', delivery: 'Standard' }, quantity: 500, price: 24599, note: 'Reliure 2 agrafes. Frais de port à confirmer.' },
  { product: 'roll-up', attrs: { format: '85 × 200 cm', extra: 'Structure Budget argentée', paper: 'PVC standard', delivery: 'Standard' }, quantity: 1, price: 3749, note: 'L’option de livraison sélectionnée n’était pas indiquée sur la page : à confirmer.' },
];

type Portfolio = {
  slug: string; title: string; category: string; summary: string; challenge: string; solution: string; outcome: string;
  deliverables: string; visual: string; accent: string; is_case_study: number; featured: number;
};

export const SEED_PORTFOLIO: Portfolio[] = [
  {
    slug: 'atelier-chene-et-fil', title: 'Atelier Chêne & Fil', category: 'Site internet',
    summary: 'Site vitrine pour un menuisier-ébéniste fictif : mettre en valeur le savoir-faire et faciliter les demandes de devis.',
    challenge: 'Un artisan dont le travail se vend sur photo, mais dont les clients potentiels ne trouvent ni ses réalisations ni un moyen simple de demander un devis.',
    solution: 'Une page d’accueil construite autour des réalisations, une page par type d’ouvrage (cuisines, escaliers, agencement), et un formulaire de devis guidé qui demande les dimensions et des photos de la pièce.',
    outcome: 'Concept de démonstration : aucun résultat client n’est revendiqué. Indicateurs que nous suivrions sur un vrai projet : demandes de devis via le formulaire, appels depuis mobile, positions sur « menuisier + ville ».',
    deliverables: 'Arborescence\nMaquettes mobile et ordinateur\nIntégration\nFormulaire de devis guidé',
    visual: 'site-menuisier', accent: '#8A5A3B', is_case_study: 1, featured: 1,
  },
  {
    slug: 'les-pages-lentes', title: 'Les Pages Lentes', category: 'Identité visuelle',
    summary: 'Identité visuelle d’un café-librairie fictif : un logo chaleureux, lisible en enseigne comme sur un tampon.',
    challenge: 'Créer une marque qui évoque à la fois le café et la lecture, déclinable sur une enseigne, des gobelets et des marque-pages.',
    solution: 'Un monogramme inspiré d’un livre ouvert formant une tasse, une palette encre et papier, et une typographie à empattements pour le ton littéraire.',
    outcome: 'Concept de démonstration réalisé pour illustrer notre démarche d’identité visuelle.',
    deliverables: 'Logo et variantes\nPalette et typographies\nDéclinaisons : enseigne, carte de fidélité, marque-page',
    visual: 'identite-cafe', accent: '#2F4858', is_case_study: 1, featured: 1,
  },
  {
    slug: 'studio-meche', title: 'Studio Mèche', category: 'Impression',
    summary: 'Flyer d’ouverture et cartes de visite pour un salon de coiffure fictif.',
    challenge: 'Annoncer une ouverture avec une offre de lancement, sans surcharger le support.',
    solution: 'Un flyer A5 recto-verso : l’offre au recto, les informations pratiques et un plan au verso. Cartes de visite assorties avec rappel de rendez-vous au dos.',
    outcome: 'Concept de démonstration.',
    deliverables: 'Flyer A5 recto-verso\nCarte de visite / carte de rendez-vous\nFichiers prêts à imprimer',
    visual: 'print-salon', accent: '#B4436C', is_case_study: 0, featured: 1,
  },
  {
    slug: 'cabinet-mouvement', title: 'Cabinet Mouvement', category: 'Refonte de site',
    summary: 'Refonte du site d’un cabinet de kinésithérapie fictif : clarté des informations pratiques et accessibilité.',
    challenge: 'Un ancien site difficile à lire sur mobile, où les patients cherchaient en vain les horaires et le moyen de prendre rendez-vous.',
    solution: 'Informations pratiques en tête de page, contrastes renforcés, plan de redirections des anciennes pages pour ne pas perdre les visites existantes.',
    outcome: 'Concept de démonstration.',
    deliverables: 'Audit de l’existant\nNouvelle arborescence\nDesign accessible\nPlan de redirections',
    visual: 'site-sante', accent: '#2D6A4F', is_case_study: 0, featured: 0,
  },
  {
    slug: 'le-comptoir-du-marche', title: 'Le Comptoir du Marché', category: 'Réseaux sociaux',
    summary: 'Gabarits de publications pour un restaurant fictif : menu du jour, événements et nouveautés.',
    challenge: 'Publier régulièrement sans y passer des heures, avec une identité reconnaissable dans le fil d’actualité.',
    solution: 'Trois gabarits réutilisables (menu, événement, coulisses) aux formats carré, portrait et story.',
    outcome: 'Concept de démonstration.',
    deliverables: '3 gabarits déclinés en 3 formats\nGuide d’utilisation',
    visual: 'social-resto', accent: '#C2410C', is_case_study: 0, featured: 0,
  },
  {
    slug: 'gite-des-trois-sources', title: 'Gîte des Trois Sources', category: 'Brochure',
    summary: 'Brochure de présentation d’un gîte rural fictif, remise aux visiteurs et envoyée aux offices de tourisme.',
    challenge: 'Présenter les chambres, les activités alentour et les tarifs dans un document agréable à feuilleter.',
    solution: 'Une brochure A5 de 12 pages, avec un chemin de fer clair : accueil, chambres, table d’hôtes, alentours, infos pratiques.',
    outcome: 'Concept de démonstration.',
    deliverables: 'Chemin de fer\nMise en page 12 pages\nFichier prêt à imprimer',
    visual: 'brochure-gite', accent: '#4D7C0F', is_case_study: 0, featured: 0,
  },
];

const FAQS: { topic: string; question: string; answer: string }[] = [
  { topic: 'general', question: 'Combien coûte un site internet pour une petite entreprise ?', answer: 'Notre Site Essentiel démarre à 690 € HT pour un site vitrine jusqu’à 5 pages. Le prix final dépend du nombre de pages, des fonctionnalités et des contenus à produire. Le nom de domaine et l’hébergement sont facturés à part : nous vous indiquons leur coût avant de commencer.' },
  { topic: 'general', question: 'Quels sont les délais ?', answer: 'Comptez environ 5 jours ouvrés pour un flyer, 10 pour une identité visuelle et 3 à 6 semaines pour un site. Le délai démarre à réception de l’acompte et de vos contenus (textes, photos, logo).' },
  { topic: 'general', question: 'Je n’ai ni textes ni photos, est-ce un problème ?', answer: 'Non. Nous pouvons vous guider avec un questionnaire, rédiger vos textes en option, ou vous orienter vers des photos libres de droits adaptées à un usage commercial.' },
  { topic: 'general', question: 'Serai-je propriétaire de mon site et de mon nom de domaine ?', answer: 'Oui. Le nom de domaine est enregistré à votre nom et vous disposez des accès. Les conditions de cession des droits sont précisées dans nos conditions générales de vente.' },
  { topic: 'general', question: 'Comment se passe le paiement ?', answer: 'Un acompte est demandé à la signature du devis, le solde à la livraison. Le paiement s’effectue par virement, selon les modalités indiquées sur la facture. Aucun paiement n’est prélevé sans votre accord.' },
  { topic: 'general', question: 'Pouvez-vous garantir la première place sur Google ?', answer: 'Non, et personne ne le peut honnêtement. Nous mettons en place les bonnes pratiques techniques et locales qui améliorent votre visibilité, et nous suivons les résultats avec vous.' },
  { topic: 'impression', question: 'Le prix affiché comprend-il l’impression ?', answer: 'Nous séparons toujours trois éléments : la création graphique, l’impression et la livraison. Le configurateur détaille chaque montant. Lorsqu’un tarif n’est pas encore vérifié auprès de l’imprimeur, nous l’indiquons « sur devis » plutôt que d’afficher un prix approximatif.' },
  { topic: 'impression', question: 'Qu’est-ce qu’un BAT ?', answer: 'Le « bon à tirer » est l’aperçu final de votre support. Rien n’est imprimé tant que vous ne l’avez pas validé. Vous le recevez par lien sécurisé et pouvez l’accepter ou demander des corrections.' },
  { topic: 'impression', question: 'Puis-je fournir mon propre fichier ?', answer: 'Oui. Nous vérifions alors les points techniques (format, fond perdu, résolution, polices) avant impression et vous signalons tout problème.' },
];

const POSTS: { slug: string; title: string; excerpt: string; category: string; body: string }[] = [
  {
    slug: 'flyer-points-a-verifier-avant-impression',
    title: 'Flyer : 8 points à vérifier avant de l’envoyer à l’impression',
    category: 'Impression',
    excerpt: 'Fond perdu, résolution, couleurs, relecture… La liste de contrôle qui évite les mauvaises surprises à la livraison.',
    body: `Un flyer raté coûte deux fois : le prix de l’impression, et l’occasion manquée. Voici les vérifications que nous faisons systématiquement avant tout bon à tirer.

## 1. Le format final
Le fichier doit correspondre exactement au format commandé (par exemple 148 × 210 mm pour un A5). Un fichier au mauvais format sera recadré ou déformé.

## 2. Le fond perdu
Les couleurs et images qui touchent le bord doivent dépasser de quelques millimètres (souvent 2 à 3 mm, selon l’imprimeur). Sans cette marge, un liseré blanc peut apparaître après la découpe.

## 3. Les marges de sécurité
À l’inverse, les textes et logos doivent rester à distance du bord. La découpe a une tolérance : un numéro de téléphone collé au bord risque d’être coupé.

## 4. La résolution des images
Une photo doit être en 300 dpi à sa taille d’impression. Une image récupérée sur un site web est souvent trop légère et apparaîtra floue.

## 5. Les couleurs
Les imprimeurs travaillent généralement en CMJN. Un fichier en RVB est converti, ce qui peut ternir certaines couleurs vives. Mieux vaut le savoir avant.

## 6. Les polices
Elles doivent être incorporées dans le PDF ou vectorisées. Sinon, l’imprimeur risque de les remplacer par une police par défaut.

## 7. La relecture
Faites relire par quelqu’un qui n’a pas écrit le texte. Vérifiez en priorité les coordonnées : téléphone, e-mail, adresse, site.

## 8. Le recto-verso
Vérifiez l’ordre des pages et leur orientation : un verso à l’envers est une erreur fréquente.

---

Dans notre processus, ces contrôles font partie de la **checklist de prépresse** remplie avant chaque BAT. Rien n’est imprimé sans votre validation.`,
  },
  {
    slug: 'site-vitrine-combien-de-pages',
    title: 'Site vitrine : combien de pages faut-il vraiment ?',
    category: 'Sites internet',
    excerpt: 'Plus de pages ne veut pas dire plus de clients. Comment construire une arborescence utile pour une petite entreprise.',
    body: `La question revient dans presque tous nos premiers échanges. La bonne réponse dépend moins d’un chiffre que de ce que vos clients cherchent.

## La base : 4 à 5 pages
Pour la plupart des indépendants et artisans, une structure simple suffit pour démarrer :

- **Accueil** : qui vous êtes, ce que vous faites, où, et comment vous contacter.
- **Services** : ce que vous proposez, pour qui, et ce qui est inclus.
- **Réalisations** : la preuve en images de votre travail.
- **À propos** : votre parcours, votre façon de travailler.
- **Contact** : formulaire, téléphone, zone d’intervention, horaires.

## Quand ajouter des pages
Une page supplémentaire est utile quand elle répond à une recherche précise. Un plombier qui fait aussi de la rénovation de salle de bains gagne à avoir une page dédiée à ce service : elle peut se positionner sur cette recherche et rassure le visiteur qui la cherche.

## Ce qu’il vaut mieux éviter
Multiplier les pages presque identiques pour chaque ville voisine. Les moteurs de recherche les repèrent, et elles n’apportent rien au visiteur. Une page locale n’a de sens que si elle contient des informations réellement propres au lieu.

## Les pages obligatoires
Mentions légales, politique de confidentialité et, si vous utilisez des traceurs, gestion des cookies. Elles ne comptent pas dans la vitrine, mais elles sont indispensables.

---

Vous hésitez sur votre structure ? Décrivez votre activité dans notre [formulaire de devis](/devis) : nous vous proposons une arborescence adaptée.`,
  },
  {
    slug: 'visibilite-locale-par-ou-commencer',
    title: 'Visibilité locale : par où commencer quand on a peu de temps ?',
    category: 'Référencement',
    excerpt: 'Fiche d’établissement, site, avis, réseaux sociaux : un ordre de priorité réaliste pour une petite entreprise.',
    body: `Quand on dirige une petite entreprise, le temps consacré à la communication est compté. Voici l’ordre dans lequel nous recommandons généralement d’agir.

## 1. La fiche d’établissement Google
C’est souvent le premier contact avec vos clients locaux. Vérifiez qu’elle est revendiquée, que les horaires, le téléphone et la catégorie sont exacts, et ajoutez de vraies photos.

## 2. Des coordonnées cohérentes partout
Même nom, même adresse, même téléphone sur votre site, votre fiche et les annuaires où vous êtes présent. Les incohérences sèment le doute, chez les clients comme chez les moteurs de recherche.

## 3. Un site clair, rapide et lisible sur mobile
Votre site doit répondre en quelques secondes à trois questions : que faites-vous, où, et comment vous joindre.

## 4. Les avis clients
Demandez simplement à vos clients satisfaits de laisser un avis, et répondez à tous, y compris aux critiques. N’achetez jamais d’avis et n’en rédigez pas vous-même : c’est interdit et contre-productif.

## 5. Les réseaux sociaux, avec régularité
Mieux vaut une publication par semaine pendant un an qu’une rafale le premier mois. Des gabarits réutilisables font gagner beaucoup de temps.

---

Notre **accompagnement SEO local** suit cet ordre de priorité et mesure les progrès chaque mois, sans promesse de classement.`,
  },
];

export async function seedIfEmpty(db: Db): Promise<boolean> {
  const done = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'seeded'");
  if (done) return false;
  const now = new Date().toISOString();
  const st: Statement[] = [];
  st.push({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', params: ['site', JSON.stringify(DEFAULT_SETTINGS)] });

  SEED_SERVICES.forEach((s, i) => {
    st.push({
      sql: `INSERT INTO services (slug, category, name, summary, description, price_mode, price_ht, billing, lead_time, revisions, options, includes,
            conditions, exclusions, status, featured, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)`,
      params: [s.slug, s.category, s.name, s.summary, s.description, s.price_mode, s.price_ht, s.billing ?? 'once', s.lead_time, s.revisions,
        JSON.stringify(s.options ?? []), s.includes, s.conditions, s.exclusions, s.featured ? 1 : 0, (i + 1) * 10, now, now],
    });
  });

  SEED_PRODUCTS.forEach((p, i) => {
    st.push({
      sql: `INSERT INTO print_products (slug, family, name, summary, description, supplier, supplier_url, options, options_checked_at, design_service_slug,
            visual, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'HelloPrint', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [p.slug, p.family, p.name, p.summary, p.description, p.supplier_url, JSON.stringify(p.options), p.optionsChecked ? SEED_DATE : null,
        p.design_service_slug, p.visual, p.status, (i + 1) * 10, now, now],
    });
  });

  for (const v of OBSERVED_VARIANTS) {
    const p = SEED_PRODUCTS.find((x) => x.slug === v.product)!;
    const a = (k: string) => v.attrs[k] ?? '';
    st.push({
      sql: `INSERT INTO supplier_price_variants (product_id, supplier, product_name, supplier_url, format, orientation, paper, weight, finish, printing, extra,
            quantity, delivery, supplier_price_ht, supplier_shipping_ht, supplier_other_fees_ht, currency, verified_at, source, status, notes, created_at, updated_at)
            VALUES ((SELECT id FROM print_products WHERE slug = ?), 'HelloPrint', ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'EUR', NULL, ?, 'a_verifier', ?, ?, ?)`,
      params: [v.product, p.name, p.supplier_url, a('format'), a('paper'), a('weight'), a('finish'), a('printing'), a('extra'), v.quantity, a('delivery'),
        v.price, OBSERVED_SOURCE, v.note, now, now],
    });
  }

  SEED_PORTFOLIO.forEach((p, i) => {
    st.push({
      sql: `INSERT INTO portfolio_items (slug, title, category, is_concept, client_label, summary, challenge, solution, outcome, deliverables, visual, accent,
            is_case_study, featured, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, 1, 'Projet fictif — concept de démonstration', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
      params: [p.slug, p.title, p.category, p.summary, p.challenge, p.solution, p.outcome, p.deliverables, p.visual, p.accent, p.is_case_study, p.featured, (i + 1) * 10, now, now],
    });
  });

  // Champs commerciaux des concepts (la migration 3 s'exécute avant ces données sur une base neuve).
  for (const sql of portfolioEnrichStatements()) st.push({ sql });

  FAQS.forEach((f, i) => {
    st.push({
      sql: `INSERT INTO faqs (topic, question, answer, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, 'published', ?, ?, ?)`,
      params: [f.topic, f.question, f.answer, (i + 1) * 10, now, now],
    });
  });

  POSTS.forEach((p, i) => {
    const date = `2026-10-${String(13 + i * 3).padStart(2, '0')}T09:00:00.000Z`;
    st.push({
      sql: `INSERT INTO posts (slug, title, excerpt, body, category, status, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
      params: [p.slug, p.title, p.excerpt, p.body, p.category, date, now, now],
    });
  });

  st.push({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?)', params: ['seeded', now] });
  await db.batch(st);
  return true;
}
