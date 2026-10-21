/** Contenu éditorial des pages de prestations (textes de présentation ; les prix viennent de la base). */

export type VisualKind = 'site' | 'site-sante' | 'print' | 'identity' | 'social' | 'brochure' | 'cards' | 'seo' | 'maintenance' | 'packs';

export interface ServicePageDef {
  path: string;
  name: string;
  h1: string;
  h1em: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  intro: string;
  visual: VisualKind;
  benefits: [string, string][];
  serviceSlugs: string[];
  productSlugs?: string[];
  details?: { title: string; items: string[] }[];
  steps?: [string, string][];
  faq: [string, string][];
  faqTopics: string[];
  related: string[];
}

export const SERVICE_PAGES: ServicePageDef[] = [
  {
    path: '/creation-site-internet',
    name: 'Création de site internet',
    h1: 'Création de site internet',
    h1em: 'qui travaille pour vous.',
    metaTitle: 'Création de site internet en Pays de Caux',
    metaDescription: 'Création de sites vitrines rapides et adaptés au mobile pour artisans, commerçants et TPE, depuis Gruchet-le-Valasse. Devis gratuit sous 48 h.',
    eyebrow: 'Sites internet',
    intro: 'Un site clair, rapide et pensé pour le mobile, qui explique ce que vous faites, rassure vos visiteurs et les amène à vous contacter. Conçu sur mesure, sans gabarit générique.',
    visual: 'site',
    benefits: [
      ['Pensé pour le mobile', 'La majorité de vos visiteurs arrivent depuis un téléphone : chaque page est conçue d’abord pour eux.'],
      ['Rapide et bien construit', 'Pages légères, images optimisées, code propre : un site agréable à visiter et bien compris par les moteurs de recherche.'],
      ['Orienté contact', 'Appels à l’action visibles, formulaire de contact protégé, numéro cliquable : le parcours vers la prise de contact est évident.'],
      ['Vous restez propriétaire', 'Nom de domaine à votre nom, accès fournis, formation de prise en main incluse.'],
    ],
    serviceSlugs: ['site-essentiel', 'site-business', 'pack-visibilite'],
    details: [
      {
        title: 'Inclus dans tous nos sites',
        items: [
          'Design sur mesure à vos couleurs',
          'Adaptation au mobile et à la tablette',
          'Balises de référencement, sitemap et données structurées',
          'Formulaire protégé contre le spam',
          'Mentions légales, politique de confidentialité et gestion des cookies',
          'Mise en ligne et formation',
        ],
      },
      {
        title: 'À prévoir à côté',
        items: [
          'Nom de domaine et hébergement (nous vous indiquons leur coût avant de commencer)',
          'Rédaction des textes et photos, si vous ne les fournissez pas',
          'Maintenance, si vous souhaitez déléguer les mises à jour',
        ],
      },
    ],
    faq: [
      ['Combien de pages faut-il ?', 'Pour la plupart des indépendants, 4 à 5 pages suffisent pour démarrer : accueil, services, réalisations, à propos et contact. Nous vous conseillons selon votre activité.'],
      ['Pourrai-je modifier mon site moi-même ?', 'Selon la solution retenue, vous pourrez modifier vos textes et photos, ou nous confier ces modifications via l’offre de maintenance avec petites modifications.'],
      ['Combien de temps faut-il ?', 'Comptez 3 à 6 semaines selon l’offre, à partir de la réception de l’acompte et de vos contenus.'],
    ],
    faqTopics: ['general'],
    related: ['/refonte-site-internet', '/referencement-seo', '/maintenance-site-internet'],
  },
  {
    path: '/refonte-site-internet',
    name: 'Refonte de site internet',
    h1: 'Refonte de site internet',
    h1em: 'sans repartir de zéro.',
    metaTitle: 'Refonte de site internet sans perte de SEO',
    metaDescription: 'Refonte de site pour petites entreprises : audit, nouveau design adapté au mobile et redirections pour garder votre référencement. Pays de Caux et à distance.',
    eyebrow: 'Sites internet',
    intro: 'Votre site a vieilli, s’affiche mal sur mobile ou ne génère plus de contacts ? Nous partons de l’existant pour conserver ce qui fonctionne et préserver votre visibilité.',
    visual: 'site-sante',
    benefits: [
      ['Audit de départ', 'Contenus, pages les plus visitées, problèmes techniques : nous savons ce qu’il faut garder avant de toucher à quoi que ce soit.'],
      ['Visibilité préservée', 'Chaque ancienne adresse est redirigée vers la bonne nouvelle page pour ne pas perdre le trafic acquis.'],
      ['Un design actuel', 'Lisible, accessible, adapté au mobile et cohérent avec votre identité.'],
    ],
    serviceSlugs: ['refonte-site', 'maintenance'],
    steps: [
      ['Audit', 'Analyse du site actuel, de ses contenus et de ses statistiques si vous y avez accès.'],
      ['Nouvelle structure', 'Arborescence repensée, pages fusionnées ou créées selon les besoins réels.'],
      ['Design et intégration', 'Nouveau design, intégration sur un environnement de test que vous validez.'],
      ['Bascule', 'Mise en ligne, redirections, vérification de l’indexation dans la Search Console.'],
    ],
    faq: [
      ['Vais-je perdre mon référencement ?', 'Une refonte mal préparée peut faire chuter la visibilité. Notre plan de redirections et la vérification après mise en ligne limitent ce risque, sans pouvoir garantir un classement.'],
      ['Pouvez-vous reprendre un site WordPress ou Wix ?', 'Oui. Nous étudions l’existant et vous recommandons de rester sur la même solution ou d’en changer, avec les avantages et inconvénients de chaque option.'],
    ],
    faqTopics: [],
    related: ['/creation-site-internet', '/referencement-seo', '/maintenance-site-internet'],
  },
  {
    path: '/flyers-depliants',
    name: 'Flyers et dépliants',
    h1: 'Création de flyers et dépliants',
    h1em: 'lisibles en trois secondes.',
    metaTitle: 'Création de flyers et dépliants',
    metaDescription: 'Conception de flyers et dépliants qui se lisent vite, fichiers prêts à imprimer, impression professionnelle en option. Agence en Pays de Caux, devis gratuit.',
    eyebrow: 'Création graphique & impression',
    intro: 'Un flyer efficace dit une seule chose, clairement. Nous concevons votre support, préparons le fichier pour l’imprimeur et gérons l’impression si vous le souhaitez.',
    visual: 'print',
    benefits: [
      ['Message clair', 'Hiérarchie visuelle, accroche forte, appel à l’action évident.'],
      ['Fichier prêt à imprimer', 'Fond perdu, marges, résolution et couleurs contrôlés selon une checklist de prépresse.'],
      ['Prix transparents', 'La création, l’impression et la livraison sont toujours chiffrées séparément.'],
    ],
    serviceSlugs: ['flyer-personnalise', 'depliant-personnalise', 'pack-flyer-carte'],
    productSlugs: ['flyers', 'depliants'],
    faq: [
      ['Quel format choisir ?', 'Le A5 est le plus polyvalent. Le A6 convient aux offres courtes et aux comptoirs ; le DL tient dans une enveloppe ; le A4 est adapté aux informations détaillées.'],
      ['Quel grammage ?', '135 à 170 g pour une distribution en grande quantité, 250 g et plus pour un support plus rigide et qualitatif.'],
    ],
    faqTopics: ['impression'],
    related: ['/cartes-de-visite', '/affiches-brochures', '/impression'],
  },
  {
    path: '/cartes-de-visite',
    name: 'Cartes de visite',
    h1: 'Création de cartes de visite',
    h1em: 'qu’on garde en poche.',
    metaTitle: 'Création de cartes de visite',
    metaDescription: 'Cartes de visite créées à votre image, classiques ou premium (soft-touch, dorure, coins arrondis), impression professionnelle en option. Devis gratuit.',
    eyebrow: 'Création graphique & impression',
    intro: 'Un support que vos clients gardent en poche. Nous le concevons à votre image et vous conseillons sur le papier et la finition qui lui donneront le bon toucher.',
    visual: 'cards',
    benefits: [
      ['Cohérente avec votre marque', 'Même typographie, mêmes couleurs que vos autres supports.'],
      ['Lisible et utile', 'Les informations essentielles, sans surcharge : nom, métier, téléphone, e-mail, site.'],
      ['Finitions au choix', 'Pelliculage mat ou brillant, soft-touch, coins arrondis, dorure ou vernis sélectif selon le modèle.'],
    ],
    serviceSlugs: ['carte-de-visite-personnalisee', 'pack-flyer-carte', 'identite-visuelle-simple'],
    productSlugs: ['cartes-de-visite', 'cartes-de-visite-premium'],
    faq: [
      ['Mat ou brillant ?', 'Le mat est sobre et facile à annoter ; le brillant fait ressortir les couleurs ; le soft-touch donne un toucher velouté plus haut de gamme.'],
      ['Puis-je avoir plusieurs noms avec le même modèle ?', 'Oui, la déclinaison pour un collaborateur supplémentaire est proposée en option.'],
    ],
    faqTopics: ['impression'],
    related: ['/identite-visuelle-logo', '/flyers-depliants', '/impression'],
  },
  {
    path: '/affiches-brochures',
    name: 'Affiches et brochures',
    h1: 'Affiches et brochures',
    h1em: 'pensées pour être lues.',
    metaTitle: 'Création d’affiches et de brochures',
    metaDescription: 'Conception d’affiches, brochures, catalogues et roll-ups pour vitrines, salons et événements, avec impression suivie jusqu’à la livraison. Sur devis.',
    eyebrow: 'Création graphique & impression',
    intro: 'Une affiche se lit de loin, une brochure se feuillette : chaque support a ses règles. Nous concevons vos grands formats et documents multipages, puis gérons leur fabrication.',
    visual: 'brochure',
    benefits: [
      ['Lisibilité à distance', 'Tailles de texte, contrastes et hiérarchie adaptés au format et à la distance de lecture.'],
      ['Mise en page éditoriale', 'Chemin de fer, gabarits de pages, rythme : une brochure agréable à parcourir.'],
      ['Fabrication suivie', 'BAT, commande, suivi de livraison : vous êtes informé à chaque étape.'],
    ],
    serviceSlugs: ['affiche-personnalisee', 'brochure-personnalisee', 'creation-graphique-sur-mesure'],
    productSlugs: ['affiches', 'brochures', 'roll-up', 'baches-banderoles'],
    faq: [
      ['Mes affiches seront-elles exposées en extérieur ?', 'Dites-le-nous : le papier standard convient à l’intérieur ; pour l’extérieur, des matériaux spécifiques sont nécessaires et chiffrés sur devis.'],
    ],
    faqTopics: ['impression'],
    related: ['/flyers-depliants', '/identite-visuelle-logo', '/impression'],
  },
  {
    path: '/identite-visuelle-logo',
    name: 'Identité visuelle et logo',
    h1: 'Logo et identité visuelle',
    h1em: 'qui vous ressemblent vraiment.',
    metaTitle: 'Création de logo et identité visuelle',
    metaDescription: 'Création de logo et d’identité visuelle pour artisans et TPE : pistes argumentées, déclinaisons, couleurs et typographies. Fichiers SVG, PNG et PDF.',
    eyebrow: 'Création graphique',
    intro: 'Un logo n’est pas un dessin isolé : c’est le point de départ de tous vos supports. Nous partons de votre métier, de vos clients et de vos valeurs pour construire une identité simple, durable et déclinable.',
    visual: 'identity',
    benefits: [
      ['Une démarche, pas un hasard', 'Questionnaire de marque, analyse de votre secteur, deux pistes argumentées.'],
      ['Déclinable partout', 'Versions couleur, monochrome et icône : du site internet au tampon.'],
      ['Fichiers professionnels', 'SVG, PNG et PDF, prêts pour le web et l’impression.'],
    ],
    serviceSlugs: ['identite-visuelle-simple', 'pack-flyer-carte', 'carte-de-visite-personnalisee'],
    steps: [
      ['Questionnaire', 'Votre activité, vos clients, ce que vous voulez transmettre.'],
      ['Deux pistes', 'Deux directions différentes, présentées et argumentées.'],
      ['Affinage', 'La piste retenue est ajustée selon vos retours (révisions incluses).'],
      ['Livraison', 'Logo final, déclinaisons, palette et typographies.'],
    ],
    faq: [
      ['Serai-je propriétaire de mon logo ?', 'Les droits d’exploitation du logo final vous sont cédés à réception du paiement complet, dans les conditions précisées dans nos CGV.'],
      ['Faites-vous le dépôt de marque ?', 'Non, le dépôt auprès de l’INPI n’est pas inclus. Nous vous recommandons de vérifier la disponibilité du nom avant de lancer la création.'],
    ],
    faqTopics: [],
    related: ['/cartes-de-visite', '/flyers-depliants', '/creation-site-internet'],
  },
  {
    path: '/reseaux-sociaux',
    name: 'Visuels pour les réseaux sociaux',
    h1: 'Visuels pour les réseaux sociaux',
    h1em: 'reconnaissables au premier coup d’œil.',
    metaTitle: 'Visuels pour les réseaux sociaux',
    metaDescription: 'Visuels Instagram, Facebook et LinkedIn aux formats carré, portrait et story, avec gabarits réutilisables pour publier régulièrement sans y passer des heures.',
    eyebrow: 'Création graphique',
    intro: 'Publier régulièrement est plus facile avec des visuels prêts à l’emploi. Nous créons vos publications et des gabarits cohérents avec votre identité.',
    visual: 'social',
    benefits: [
      ['Aux bons formats', 'Carré, portrait et story : chaque visuel est décliné pour chaque usage.'],
      ['Cohérence', 'Un style reconnaissable dans le fil d’actualité de vos abonnés.'],
      ['Gain de temps', 'Des gabarits réutilisables pour vos annonces récurrentes.'],
    ],
    serviceSlugs: ['visuel-reseaux-sociaux', 'identite-visuelle-simple'],
    faq: [
      ['Publiez-vous à ma place ?', 'Non, la publication et la gestion de vos comptes ne sont pas incluses. Nous vous livrons des visuels prêts à publier.'],
    ],
    faqTopics: [],
    related: ['/identite-visuelle-logo', '/flyers-depliants', '/referencement-seo'],
  },
  {
    path: '/referencement-seo',
    name: 'Référencement SEO',
    h1: 'Référencement naturel et local',
    h1em: 'pour être trouvé près de chez vous.',
    metaTitle: 'Référencement naturel (SEO) en Normandie',
    metaDescription: 'Référencement naturel et local : technique, contenus, fiche Google, suivi mensuel, sans promesse de classement irréaliste. Pays de Caux, Le Havre, à distance.',
    eyebrow: 'Visibilité',
    intro: 'Le référencement naturel consiste à rendre votre site compréhensible et utile, pour les visiteurs comme pour les moteurs de recherche. Nous travaillons la technique, les contenus et votre présence locale, et nous mesurons les progrès.',
    visual: 'seo',
    benefits: [
      ['Technique solide', 'Vitesse, balises, données structurées, sitemap, indexation : les fondations.'],
      ['Visibilité locale', 'Fiche d’établissement, cohérence de vos coordonnées, pages réellement utiles pour votre zone.'],
      ['Suivi honnête', 'Des indicateurs mesurés chaque mois, sans promesse de première place.'],
    ],
    serviceSlugs: ['seo-local', 'site-business', 'pack-visibilite'],
    details: [
      {
        title: 'Ce que nous ne faisons pas',
        items: [
          'Garantir une position dans Google : personne ne le peut honnêtement',
          'Créer des centaines de pages quasi identiques pour chaque ville',
          'Acheter des liens ou publier de faux avis',
        ],
      },
    ],
    faq: [
      ['En combien de temps voit-on des résultats ?', 'Le SEO produit des effets progressifs, généralement sur plusieurs mois. Le rapport mensuel vous permet de suivre l’évolution.'],
      ['Faut-il une fiche Google ?', 'Pour une activité locale, une fiche d’établissement à jour est souvent l’un des leviers les plus efficaces.'],
    ],
    faqTopics: [],
    related: ['/creation-site-internet', '/maintenance-site-internet', '/packs'],
  },
  {
    path: '/maintenance-site-internet',
    name: 'Maintenance de site internet',
    h1: 'Maintenance de site internet',
    h1em: 'pour garder l’esprit tranquille.',
    metaTitle: 'Maintenance de site internet',
    metaDescription: 'Mises à jour de sécurité, sauvegardes, surveillance et petites modifications de votre site internet. Un interlocuteur unique, en Pays de Caux ou à distance.',
    eyebrow: 'Sites internet',
    intro: 'Un site non maintenu devient lent, vulnérable et finit par tomber en panne. Nous nous occupons des mises à jour, des sauvegardes et de la surveillance pour que vous puissiez vous concentrer sur votre métier.',
    visual: 'maintenance',
    benefits: [
      ['Sécurité', 'Mises à jour régulières des composants et surveillance des incidents.'],
      ['Sauvegardes', 'Copies régulières de votre site, pour pouvoir le restaurer en cas de problème.'],
      ['Un interlocuteur', 'Une question, une modification : vous savez à qui vous adresser.'],
    ],
    serviceSlugs: ['maintenance', 'maintenance-modifications'],
    faq: [
      ['Maintenez-vous les sites que vous n’avez pas créés ?', 'Oui, après un audit de départ pour vérifier l’état du site et sa technologie.'],
      ['Y a-t-il un engagement ?', 'La durée et le préavis sont précisés au contrat, avant toute signature.'],
    ],
    faqTopics: [],
    related: ['/creation-site-internet', '/refonte-site-internet', '/referencement-seo'],
  },
  {
    path: '/packs',
    name: 'Packs professionnels',
    h1: 'Packs communication',
    h1em: 'plusieurs besoins, un seul interlocuteur.',
    metaTitle: 'Packs communication pour TPE',
    metaDescription: 'Packs regroupant site internet, identité visuelle et supports imprimés pour lancer ou relancer votre activité, avec un seul devis et un seul planning.',
    eyebrow: 'Packs',
    intro: 'Les packs regroupent des prestations complémentaires pour une communication cohérente, avec un seul devis et un seul planning.',
    visual: 'packs',
    benefits: [
      ['Cohérence', 'Tous vos supports partagent la même identité.'],
      ['Simplicité', 'Un devis, un planning, un interlocuteur.'],
      ['Transparence', 'Ce qui est inclus et ce qui ne l’est pas (impression, hébergement) est toujours précisé.'],
    ],
    serviceSlugs: ['pack-flyer-carte', 'pack-visibilite', 'site-business'],
    faq: [
      ['Puis-je composer mon propre pack ?', 'Oui : décrivez vos besoins dans le formulaire de devis, nous vous proposons une combinaison adaptée.'],
    ],
    faqTopics: ['general'],
    related: ['/tarifs', '/creation-site-internet', '/identite-visuelle-logo'],
  },
];

export const pageByPath = (path: string) => SERVICE_PAGES.find((p) => p.path === path);

export const FAMILY_LABELS: Record<string, string> = {
  flyers: 'Flyers',
  cartes: 'Cartes de visite',
  depliants: 'Dépliants',
  affiches: 'Affiches',
  brochures: 'Brochures et livrets',
  complementaires: 'Grands formats et produits complémentaires',
};

export const CATEGORY_LABELS: Record<string, string> = {
  web: 'Sites internet',
  graphisme: 'Création graphique',
  pack: 'Packs',
  recurrent: 'Services récurrents',
  accompagnement: 'Accompagnement',
};
