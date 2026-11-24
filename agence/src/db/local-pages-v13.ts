/**
 * Pages villes, migration 13 (Search Console du 24/11/2026, 3 derniers mois) :
 * - Bolbec est la ville la mieux placée (« agence de référencement bolbec » 8,4 ; « création site internet bolbec » 14,4 ;
 *   « agence web bolbec » 15,1) : la page est enrichie (création de site, référencement, questions fréquentes) ;
 * - Le Havre, Lillebonne et Saint-Romain-de-Colbosc reçoivent le même traitement que Fécamp et Yvetot (migration 12) :
 *   titre « création de site » et section dédiée.
 * Chaque section est insérée avant un titre existant (ancre). Aucun client, chiffre ou avis n'est inventé.
 */

export interface LocalSectionInsert {
  slug: string;
  /** Titre de la section ajoutée : sert aussi à ne jamais l'insérer deux fois. */
  heading: string;
  section: string;
  /** Titre existant avant lequel la section est insérée. */
  anchor: string;
}

export interface LocalTitleUpdate {
  slug: string;
  oldTitle: string;
  title: string;
  oldMeta: string;
  meta: string;
}

export const BOLBEC_SITE_SECTION = `## Création de site internet à Bolbec

Nous créons des sites internet pour les entreprises de Bolbec : site vitrine de quelques pages pour un artisan, site de commerce avec horaires et actualités, refonte d’un site devenu lent ou illisible sur téléphone. Chaque site est conçu d’abord pour le mobile et rédigé avec les mots que vos clients utilisent vraiment, comme « électricien Bolbec » ou « coiffeur Bolbec ».

Un site créé pour une entreprise bolbécaise comprend :

- une page d’accueil qui dit en quelques secondes ce que vous faites et où vous intervenez ;
- une page par prestation importante, pour être trouvé sur des recherches précises ;
- vos réalisations en photos, que nous pouvons prendre lors d’un passage à Bolbec ;
- un formulaire de contact protégé et un numéro de téléphone cliquable ;
- les mentions légales, la politique de confidentialité et la gestion des cookies.

Les prix de départ sont affichés sur la page [tarifs](/tarifs) et la démarche est détaillée sur [création de site internet](/creation-site-internet).

## Référencement à Bolbec : être trouvé sur Google

Quand quelqu’un cherche « plombier Bolbec » ou « restaurant Bolbec », Google affiche d’abord une carte avec quelques fiches d’établissement, puis les sites. Le référencement local travaille ces deux niveaux :

- **la fiche Google Business Profile** : catégorie juste, zone desservie (Bolbec, Gruchet-le-Valasse, Lillebonne, Lintot, Nointot…), horaires, photos, publications régulières et réponses aux avis ;
- **le site** : titres et textes qui nomment votre métier et votre secteur, pages rapides, données structurées, coordonnées identiques à celles de la fiche ;
- **la cohérence en ligne** : même nom, même adresse et même téléphone sur les annuaires et les réseaux sociaux.

Nous ne promettons pas de première place : personne ne peut la garantir honnêtement. Nous suivons chaque mois vos positions et les contacts venus de Google, et nous vous montrons ce qui progresse. Voir notre page [référencement naturel et local](/referencement-seo).

`;

export const BOLBEC_FAQ_SECTION = `## Questions fréquentes des entreprises de Bolbec

**Pouvez-vous reprendre un site existant ?** Oui. Nous commençons par regarder votre site actuel : vitesse, affichage sur téléphone, référencement. Nous vous disons ensuite s’il vaut mieux l’améliorer ou le refaire ([refonte de site internet](/refonte-site-internet)).

**En combien de temps devient-on visible sur Google ?** Une fiche Google bien remplie peut progresser en quelques semaines. Pour un site, comptez généralement plusieurs mois, selon la concurrence sur votre métier dans le secteur de Bolbec.

**Faut-il se déplacer jusqu’à l’agence ?** Non. Gruchet-le-Valasse touche Bolbec : c’est nous qui venons dans votre commerce, votre atelier ou sur un chantier.

**Pouvez-vous aussi faire les flyers et la vitrine ?** Oui. Site, logo, imprimés et vitrophanie sont réalisés par la même équipe, pour une image cohérente du site à la devanture.

`;

export const LE_HAVRE_SITE_SECTION = `## Création de site internet au Havre

Pour les artisans, commerces et indépendants du Havre, nous créons des sites vitrines rapides, pensés d’abord pour le téléphone et rédigés avec les recherches réelles de vos clients, comme « menuisier Le Havre » ou « restaurant Le Havre ». Dans une agglomération aussi concurrentielle, un site ne suffit pas toujours : nous travaillons aussi votre [fiche Google et le référencement local](/referencement-local-artisan) pour vous rendre visible dans votre quartier et sur la carte. Les prix de départ sont sur la page [tarifs](/tarifs).

`;

export const LILLEBONNE_SITE_SECTION = `## Création de site internet et référencement à Lillebonne

Nous créons des sites internet pour les entreprises de Lillebonne et de Port-Jérôme-sur-Seine : site vitrine d’artisan, site de commerce, site professionnel d’entreprise de services. Chaque site est rapide, lisible sur téléphone et rédigé avec les mots que vos clients tapent dans Google. Le [référencement local](/referencement-local-artisan) fait partie de la démarche : fiche Google complète, zone desservie, coordonnées identiques partout, pour que l’on vous trouve sur « votre métier + Lillebonne ». Les prix de départ sont sur la page [tarifs](/tarifs).

`;

export const SAINT_ROMAIN_SITE_SECTION = `## Création de site internet à Saint-Romain-de-Colbosc

Nous créons des sites vitrines pour les artisans, commerces et entreprises de Saint-Romain-de-Colbosc : quelques pages claires, rapides sur téléphone, qui présentent vos prestations, vos réalisations et toutes les communes où vous intervenez. Nous y associons le [référencement local](/referencement-local-artisan) (fiche Google, zone desservie, coordonnées cohérentes) pour être trouvé sur « votre métier + Saint-Romain » comme au Havre ou à Montivilliers. Les prix de départ sont sur la page [tarifs](/tarifs).

`;

export const LOCAL_SECTIONS_V13: LocalSectionInsert[] = [
  { slug: 'bolbec', heading: '## Création de site internet à Bolbec', section: BOLBEC_SITE_SECTION, anchor: '## Pour les commerces du centre-ville' },
  { slug: 'bolbec', heading: '## Questions fréquentes des entreprises de Bolbec', section: BOLBEC_FAQ_SECTION, anchor: '## Prendre rendez-vous' },
  { slug: 'le-havre', heading: '## Création de site internet au Havre', section: LE_HAVRE_SITE_SECTION, anchor: '## À savoir avant de poser une enseigne au Havre' },
  { slug: 'lillebonne', heading: '## Création de site internet et référencement à Lillebonne', section: LILLEBONNE_SITE_SECTION, anchor: '## Recruter localement grâce à votre site' },
  {
    slug: 'saint-romain-de-colbosc',
    heading: '## Création de site internet à Saint-Romain-de-Colbosc',
    section: SAINT_ROMAIN_SITE_SECTION,
    anchor: '## Artisans : être identifiés sur tout le secteur',
  },
];

export const LOCAL_TITLES_V13: LocalTitleUpdate[] = [
  {
    slug: 'le-havre',
    oldTitle: 'Agence web et print au Havre',
    title: 'Création de site internet et agence web au Havre',
    oldMeta: 'Création de site internet, logo, flyers et vitrophanie pour les entreprises du Havre : rendez-vous sur place, pose de signalétique, devis gratuit.',
    meta: 'Création de site internet, référencement local, logo, flyers et vitrophanie au Havre : agence web du Pays de Caux, rendez-vous sur place, devis gratuit.',
  },
  {
    slug: 'lillebonne',
    oldTitle: 'Agence web et print à Lillebonne',
    title: 'Agence web, création de site et référencement à Lillebonne',
    oldMeta: 'Site internet, logo, flyers, vitrophanie et signalétique à Lillebonne et Port-Jérôme-sur-Seine. Agence voisine, rendez-vous sur place, devis gratuit.',
    meta: 'Agence web voisine de Lillebonne : création de site internet, référencement Google, logos, flyers et vitrophanie pour commerces et artisans.',
  },
  {
    slug: 'saint-romain-de-colbosc',
    oldTitle: 'Agence web et print à Saint-Romain-de-Colbosc',
    title: 'Création de site et agence web à Saint-Romain-de-Colbosc',
    oldMeta: 'Site internet, logo, flyers, vitrophanie et marquage de véhicules à Saint-Romain-de-Colbosc : agence voisine, rendez-vous sur place, devis gratuit.',
    meta: 'Création de site internet, référencement, logo, flyers et marquage de véhicules à Saint-Romain-de-Colbosc : agence voisine, devis gratuit.',
  },
];
