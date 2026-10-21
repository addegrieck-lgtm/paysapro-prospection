/**
 * Pages thématiques (offres et pages SEO) : contenu éditorial rendu par `LandingPage`.
 * Les corps de section sont écrits en Markdown simple (## titres, listes, **gras**, [liens](/chemin)).
 * Règles : aucun faux avis, aucune statistique inventée, aucun nom de fournisseur ; les informations
 * manquantes sont signalées par « [À COMPLÉTER : …] ».
 */
import type { VisualKind } from './content';

export interface LandingSection {
  id?: string;
  eyebrow?: string;
  title: string;
  body?: string;
  /** Cartes (titre, texte) affichées sous le texte. */
  cards?: [string, string][];
  tone?: 'plain' | 'sand' | 'ink';
  /** Bouton en fin de section. */
  cta?: [string, string];
}

export interface LandingDef {
  path: string;
  /** Nom court : fil d'Ariane, liens, données structurées. */
  name: string;
  serviceType: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  h1em: string;
  intro: string;
  visual: VisualKind;
  cta: [string, string];
  secondary?: [string, string];
  sections: LandingSection[];
  /** Section « près de chez vous » : texte puis liste des communes de la zone principale. */
  local?: { title: string; body: string };
  faq: [string, string][];
  links: [string, string][];
  ctaBand?: { title: string; text: string };
  /** Affiche la carte (chargée au clic) dans la section locale. */
  map?: boolean;
}

const VITRO_QUOTE = '/devis-vitrophanie-signaletique';

export const LANDING_PAGES: LandingDef[] = [
  // ─── Phase 3 : offre vitrophanie & signalétique ───
  {
    path: '/vitrophanie-signaletique',
    name: 'Vitrophanie & signalétique',
    serviceType: 'Vitrophanie, enseignes et signalétique',
    metaTitle: 'Vitrophanie et signalétique en Pays de Caux',
    metaDescription: 'Vitrophanie, lettrage de vitrine, enseignes, panneaux de chantier, bâches et marquage de véhicules : création, impression et pose. Devis gratuit.',
    eyebrow: 'Vitrophanie & signalétique',
    h1: 'Vitrophanie et signalétique',
    h1em: 'pour être vu depuis la rue.',
    intro:
      'Votre vitrine, votre façade, votre chantier et votre véhicule sont vos premiers supports de communication. Nous les concevons, les faisons imprimer sur des matériaux professionnels et organisons la pose avec notre poseur partenaire.',
    visual: 'storefront',
    cta: [VITRO_QUOTE, 'Demander un devis avec photos'],
    secondary: ['/vitrophanie-vitrine-commerce', 'Habiller une vitrine de commerce'],
    sections: [
      {
        id: 'realisations-possibles',
        eyebrow: 'Ce que nous réalisons',
        title: 'Du lettrage de vitrine au panneau de chantier',
        body:
          'Chaque support est **conçu sur mesure** à partir de vos dimensions réelles et de votre identité visuelle. Tous nos travaux de signalétique sont établis **sur devis** : le prix dépend des surfaces, du matériau, de la finition et de la pose.',
        cards: [
          ['Vitrophanie et lettrage adhésif', 'Logo, nom, activité, numéro de téléphone découpés à la forme ou imprimés en couleur, posés sur l’extérieur ou l’intérieur de la vitre.'],
          ['Adhésif microperforé', 'Un visuel plein vu de la rue, tout en gardant la vue vers l’extérieur depuis l’intérieur du local.'],
          ['Vitrophanie dépolie (effet sablé)', 'Pour préserver l’intimité d’un cabinet, d’un bureau ou d’une salle de soin sans perdre la lumière.'],
          ['Horaires et informations pratiques', 'Horaires d’ouverture, moyens de paiement, accès, QR code vers votre site ou votre fiche Google.'],
          ['Enseignes et panneaux de façade', 'Panneaux rigides en composite aluminium (type Dibond), PVC expansé ou plaques, avec fixations adaptées au support.'],
          ['Panneaux de chantier', 'Votre nom, votre métier et votre numéro visibles sur chaque chantier : le panneau le plus rentable pour un artisan.'],
          ['Bâches publicitaires', 'Bâches avec œillets pour façade, clôture ou événement ; version microperforée pour les emplacements exposés au vent.'],
          ['Marquage de véhicule et magnets', 'Lettrage adhésif sur utilitaire ou voiture, ou magnets amovibles si le véhicule sert aussi en dehors du travail.'],
          ['Kakémonos, roll-up et signalétique intérieure', 'Pour un salon, un accueil ou un parcours client : fléchage, plaques de porte, supports d’accueil.'],
        ],
      },
      {
        eyebrow: 'Un seul interlocuteur',
        title: 'Création, impression professionnelle et pose',
        tone: 'sand',
        body: `Vous n’avez pas à coordonner un graphiste, un imprimeur et un poseur : nous prenons en charge l’ensemble du projet.

- **La création** : nous partons de votre logo et de vos couleurs, ou nous créons votre [identité visuelle](/identite-visuelle-logo) si vous n’en avez pas encore. Chaque visuel est pensé pour être lu de loin, en quelques secondes.
- **L’impression professionnelle** : vos supports sont fabriqués par un imprimeur spécialisé, sur des adhésifs et des panneaux adaptés à l’usage (intérieur, extérieur, durée de pose, surface plane ou courbe).
- **La pose** : elle est réalisée par **notre poseur partenaire**, dans notre zone d’intervention. En dehors de cette zone, nous livrons les adhésifs prêts à poser, avec les conseils de pose.

Vous validez une maquette, puis un **bon à tirer (BAT)** avant toute fabrication : rien n’est imprimé sans votre accord écrit.`,
      },
      {
        eyebrow: 'Déroulement',
        title: 'Comment se passe un projet de vitrophanie',
        body: `1. **Vous nous envoyez votre demande avec des photos** de la vitrine, de la façade ou du véhicule (le formulaire de devis accepte jusqu’à 5 photos).
2. **Nous relevons les mesures** : sur place dans notre zone, ou à partir de vos cotes si vous êtes plus loin.
3. **Nous vous proposons une maquette en situation** : votre futur habillage est simulé sur la photo de votre local, pour juger du rendu avant de vous engager.
4. **Vous validez le devis puis le BAT**, avec les dimensions exactes, les couleurs et le matériau.
5. **Fabrication** par notre imprimeur partenaire.
6. **Pose** par notre poseur partenaire, ou livraison des adhésifs prêts à poser.

Le délai total dépend du support, de la fabrication et de la disponibilité de la pose : il est indiqué noir sur blanc sur votre devis.`,
      },
      {
        eyebrow: 'Bien choisir',
        title: 'Quel support pour quel usage ?',
        tone: 'sand',
        body: `Le bon matériau dépend de l’endroit, de la durée et de la surface. Voici les repères que nous utilisons pour vous conseiller :

- **Adhésif monomère** : économique, adapté aux surfaces planes et aux affichages de courte ou moyenne durée (promotion, événement, vitrine saisonnière).
- **Adhésif polymère** : plus stable dans le temps, pour une vitrophanie permanente ou un marquage de véhicule sur surfaces peu galbées.
- **Adhésif coulé** : pour les véhicules aux formes très courbes.
- **Microperforé** : visuel plein côté rue, vision conservée de l’intérieur. Idéal pour une grande vitrine exposée.
- **Dépoli** : intimité et lumière, très utilisé en cabinet médical, en agence ou en salle de réunion.
- **Composite aluminium** : rigide et durable en extérieur, la référence pour une enseigne ou une plaque professionnelle.
- **PVC expansé et polypropylène alvéolaire** : légers et économiques, pour un affichage intérieur ou temporaire (panneau de chantier, panneau de vente).

La tenue réelle dépend du film, de l’exposition et de l’entretien : elle est précisée sur le devis selon le matériau retenu.`,
      },
      {
        id: 'pack-ouverture',
        eyebrow: 'Pack',
        title: 'Pack ouverture de commerce',
        tone: 'ink',
        body: `Vous ouvrez ou reprenez une boutique, un salon, un restaurant ou un cabinet ? Le pack regroupe tout ce qu’il faut pour être **visible dès le premier jour**, avec une image cohérente de la vitrine jusqu’aux supports imprimés :

- vitrophanie de vitrine (nom, activité, logo) et adhésif d’horaires ;
- panneau ou enseigne de façade ;
- flyers d’ouverture et cartes de visite assortis ;
- création ou optimisation de votre fiche Google, pour être trouvé sur la carte ;
- en option : création du logo, site internet vitrine, kakémono.

Le contenu du pack est ajusté à votre local et à votre budget. **Prix sur devis**, après échange sur votre projet.`,
        cta: [`${VITRO_QUOTE}?besoin=pack-ouverture`, 'Demander le pack ouverture'],
      },
    ],
    local: {
      title: 'Pose dans le Pays de Caux, livraison partout en France',
      body: `Basés à Gruchet-le-Valasse, nous intervenons avec notre poseur partenaire dans les communes de notre zone principale : relevé des mesures, maquette sur photo et pose sur place. Pour les autres départements, nous concevons vos supports à distance et vous livrons des adhésifs prêts à poser.

Conditions de déplacement : [À COMPLÉTER : rayon d’intervention pour la pose et frais de déplacement éventuels].`,
    },
    faq: [
      ['La vitrophanie abîme-t-elle la vitre ?', 'Non. Un adhésif adapté se retire sans endommager le verre. Selon l’ancienneté de la pose, il peut rester un peu de colle, qui s’enlève avec un produit adapté. Nous vous indiquons la méthode de retrait au moment de la pose.'],
      ['Faut-il poser à l’intérieur ou à l’extérieur de la vitre ?', 'Une pose intérieure protège l’adhésif des intempéries et des dégradations ; une pose extérieure rend les couleurs plus vives et évite les reflets. Nous vous conseillons selon l’exposition de votre vitrine et le type de visuel.'],
      ['Puis-je poser l’adhésif moi-même ?', 'Oui pour les petits formats et les lettrages simples : nous livrons les adhésifs avec un film de transfert et des conseils de pose. Pour les grandes surfaces, le microperforé ou les véhicules, la pose par notre partenaire évite les bulles et les plis.'],
      ['Combien coûte une vitrophanie ?', 'Le prix dépend de la surface, du matériau, de l’impression (découpe ou couleur) et de la pose. Tous nos travaux de signalétique sont établis sur devis gratuit : envoyez-nous des photos et des mesures approximatives pour un chiffrage rapide.'],
      ['Faut-il une autorisation pour une enseigne ?', 'Souvent oui : l’installation ou la modification d’une enseigne peut nécessiter une déclaration ou une autorisation auprès de la mairie, en particulier en secteur protégé ou si la commune a un règlement local de publicité. Renseignez-vous auprès de votre mairie avant la commande ; nous vous fournissons les visuels et les dimensions pour votre dossier.'],
      ['Pouvez-vous reprendre mon logo existant ?', 'Oui. Envoyez-le-nous dans le meilleur format disponible (idéalement vectoriel : PDF, SVG, AI ou EPS). S’il n’existe qu’en image basse définition, nous pouvons le redessiner ou vous proposer une refonte.'],
      ['Faites-vous le marquage des véhicules ?', 'Oui : lettrage adhésif, visuel imprimé ou magnets amovibles. Indiquez le modèle et l’année du véhicule et joignez des photos de chaque côté pour que nous préparions la maquette aux bonnes dimensions.'],
    ],
    links: [
      ['/packs', 'Packs Bien démarrer par métier'],
      ['/vitrophanie-vitrine-commerce', 'Vitrophanie de vitrine pour commerces'],
      ['/identite-visuelle-logo', 'Création de logo et identité visuelle'],
      ['/flyers-depliants', 'Création de flyers'],
      ['/affiches-brochures', 'Affiches, bâches et roll-up'],
      ['/zone-intervention', 'Notre zone d’intervention'],
    ],
    ctaBand: { title: 'Votre vitrine mérite mieux qu’une affiche scotchée', text: 'Envoyez-nous une photo : nous vous proposons une maquette en situation et un devis gratuit.' },
  },

  // ─── Phase 4 : pages métiers et SEO local ───
  {
    path: '/creation-site-internet-artisan',
    name: 'Site internet pour artisans',
    serviceType: 'Création de site internet pour artisans',
    metaTitle: 'Création de site internet pour artisan',
    metaDescription: 'Site internet pour artisans du bâtiment et de l’habitat : réalisations en photos, demandes de devis, visibilité locale. Pays de Caux et Seine-Maritime.',
    eyebrow: 'Sites internet · Artisans',
    h1: 'Création de site internet',
    h1em: 'pour les artisans.',
    intro:
      'Plombier, électricien, menuisier, maçon, couvreur, peintre ou chauffagiste : vos futurs clients vous cherchent sur leur téléphone avant de décrocher. Nous créons des sites simples à parcourir, qui montrent votre travail et donnent envie de vous appeler.',
    visual: 'site',
    cta: ['/devis?type=site', 'Demander un devis pour mon site'],
    secondary: ['/realisations/atelier-chene-et-fil', 'Voir un exemple de site d’artisan'],
    sections: [
      {
        eyebrow: 'Le constat',
        title: 'Un bon artisan qu’on ne trouve pas perd des chantiers',
        body: `Le bouche-à-oreille reste votre meilleur commercial. Mais aujourd’hui, la personne à qui l’on a donné votre nom tape presque toujours votre entreprise dans Google avant de vous appeler. Si elle ne trouve rien, ou une page datée qui ne s’affiche pas sur mobile, elle passe au suivant.

Un site d’artisan n’a pas besoin d’être compliqué. Il doit répondre en quelques secondes à quatre questions : **quel est votre métier, où intervenez-vous, à quoi ressemble votre travail, et comment vous joindre.** Tout le reste est secondaire.`,
      },
      {
        eyebrow: 'Ce que contient votre site',
        title: 'Les pages qui comptent pour un artisan',
        cards: [
          ['Une page d’accueil claire', 'Votre métier, votre secteur et un bouton d’appel visibles dès l’ouverture, sur téléphone comme sur ordinateur.'],
          ['Vos prestations détaillées', 'Une page par grand type d’intervention (rénovation de salle de bain, dépannage, pose de menuiseries…) : c’est ce qui vous fait apparaître sur des recherches précises.'],
          ['Vos réalisations en photos', 'Des chantiers avant et après, présentés simplement. C’est la preuve la plus convaincante de votre savoir-faire.'],
          ['Un formulaire de devis guidé', 'Le client précise son besoin, ses dimensions et peut joindre des photos : vous rappelez avec les bonnes informations.'],
          ['Votre zone d’intervention', 'Les communes où vous vous déplacez, pour rassurer le client et être trouvé sur « votre métier + votre ville ».'],
          ['Vos garanties et qualifications', 'Assurance décennale, qualifications et labels que vous détenez réellement, affichés avec leurs justificatifs.'],
        ],
      },
      {
        eyebrow: 'Notre méthode',
        title: 'Un site fait pour votre emploi du temps',
        body: `Vous êtes sur les chantiers toute la journée : nous avons organisé la création de votre site pour qu’elle vous prenne le moins de temps possible.

1. **Un échange de 30 à 45 minutes**, par téléphone ou sur place dans le Pays de Caux, pour comprendre votre activité, vos clients et votre secteur.
2. **Nous rédigeons les textes avec vous** à partir de cet échange : vous relisez et corrigez, vous n’écrivez pas.
3. **Vous nous envoyez vos photos de chantier** au fil de l’eau, depuis votre téléphone. Nous les trions, les recadrons et les allégeons.
4. **Vous validez une maquette**, puis le site est mis en ligne avec votre nom de domaine.
5. **Nous vous montrons comment ajouter un chantier** en quelques minutes, ou nous le faisons pour vous avec l’offre de [maintenance](/maintenance-site-internet).

Le site est construit pour être rapide, lisible sur mobile et conforme aux obligations légales (mentions légales, données personnelles, cookies).`,
      },
      {
        eyebrow: 'Visibilité',
        title: 'Être trouvé par les clients de votre secteur',
        body: `Un site seul ne suffit pas à apparaître sur Google. Pour un artisan, la recherche locale fonctionne surtout grâce à trois éléments complémentaires :

- **Votre fiche Google** (Google Business Profile) : c’est elle qui apparaît sur la carte quand un client cherche « plombier près de chez moi ». Nous la créons ou l’optimisons et la relions à votre site.
- **Des pages qui parlent de vos vraies prestations et de votre vraie zone**, sans répéter le même texte pour chaque ville.
- **Les avis de vos clients**, que vous sollicitez après chaque chantier réussi. Nous vous donnons un lien direct et une petite carte à remettre en fin d’intervention.

Nous détaillons cette démarche sur la page [référencement local pour artisans](/referencement-local-artisan). Aucun prestataire sérieux ne peut garantir une première position : nous nous engageons sur le travail réalisé et vous montrons chaque mois ce qui progresse.`,
      },
      {
        eyebrow: 'Au-delà du site',
        title: 'Une image cohérente, du site au camion',
        tone: 'sand',
        body: `Votre site est souvent la deuxième chose que voit un client. La première, c’est votre véhicule, votre panneau de chantier ou votre carte de visite. Nous pouvons harmoniser l’ensemble : [logo](/identite-visuelle-logo), [cartes de visite](/cartes-de-visite), [marquage de véhicule et panneaux de chantier](/vitrophanie-signaletique). Un client qui retrouve le même logo sur le camion, le devis et le site vous identifie plus vite et vous fait davantage confiance.`,
      },
    ],
    local: {
      title: 'Des artisans du Pays de Caux, rencontrés sur place',
      body: `Nous sommes installés à Gruchet-le-Valasse et nous nous déplaçons pour rencontrer les artisans de Bolbec, Lillebonne, Port-Jérôme-sur-Seine, Fécamp, Yvetot, Le Havre et des communes voisines. Un rendez-vous dans votre atelier ou sur un chantier permet souvent de faire les photos dont votre site a besoin. Pour les artisans du reste de la France, tout se fait à distance, par téléphone et visioconférence.`,
    },
    faq: [
      ['Combien coûte un site internet d’artisan ?', 'Nos tarifs de départ sont affichés sur la page [tarifs](/tarifs) : le Site Essentiel couvre les besoins de la plupart des artisans (jusqu’à 5 pages). Le devis précise ce qui est inclus avant tout engagement. Le nom de domaine et l’hébergement sont à prévoir à côté, et nous vous indiquons leur coût.'],
      ['Je n’ai pas de photos de mes chantiers, est-ce un problème ?', 'Non. Le site peut être mis en ligne avec quelques photos et s’enrichir au fil des chantiers. Nous vous donnons des conseils simples pour photographier votre travail avec un téléphone : lumière, cadrage, avant et après.'],
      ['Puis-je afficher mes certifications et labels ?', 'Oui, à condition qu’ils soient en cours de validité et vérifiables. Nous affichons uniquement les qualifications que vous détenez réellement, avec si possible le lien vers l’organisme.'],
      ['Faut-il un site si j’ai déjà une page Facebook ?', 'Une page Facebook est utile, mais elle ne vous appartient pas et elle est mal référencée sur des recherches comme « électricien + ville ». Le site reste votre vitrine principale ; les réseaux renvoient vers lui.'],
      ['Combien de temps faut-il pour créer le site ?', 'Comptez généralement 3 à 6 semaines, selon la rapidité de réception de vos photos et de vos validations. Le planning est précisé sur le devis.'],
      ['Pourrai-je modifier mon site moi-même ?', 'Oui pour ajouter des réalisations ou modifier des textes simples. Si vous préférez ne pas vous en occuper, l’offre de maintenance inclut les petites modifications.'],
    ],
    links: [
      ['/packs/artisan-batiment', 'Pack Bien démarrer — artisan du bâtiment'],
      ['/creation-site-internet', 'Création de site internet'],
      ['/referencement-local-artisan', 'Référencement local pour artisans'],
      ['/creation-site-internet-paysagiste', 'Site internet pour paysagistes'],
      ['/vitrophanie-signaletique', 'Panneaux de chantier et marquage de véhicule'],
      ['/zone-intervention', 'Notre zone d’intervention'],
    ],
    ctaBand: { title: 'Parlons de votre site d’artisan', text: 'Un échange de 30 minutes suffit pour vous proposer une structure et un devis clair.' },
  },
  {
    path: '/creation-site-internet-paysagiste',
    name: 'Site internet pour paysagistes',
    serviceType: 'Création de site internet pour paysagistes',
    metaTitle: 'Création de site internet pour paysagiste',
    metaDescription: 'Site internet pour paysagistes et entreprises d’espaces verts : galerie de jardins, création et entretien, demandes de devis. Normandie et partout en France.',
    eyebrow: 'Sites internet · Paysagistes',
    h1: 'Un site internet de paysagiste',
    h1em: 'qui donne envie de jardin.',
    intro:
      'Le métier de paysagiste se vend en images. Votre site doit montrer vos jardins sous leur meilleur jour, expliquer clairement ce que vous faites (création, entretien, élagage, clôtures…) et faciliter la demande de visite ou de devis.',
    visual: 'site-paysage',
    cta: ['/devis?type=site', 'Demander un devis pour mon site'],
    secondary: ['/realisations/jardins-de-la-valmont', 'Voir le concept « Jardins de la Valmont »'],
    sections: [
      {
        eyebrow: 'Pourquoi un site dédié',
        title: 'Vos clients choisissent un paysagiste sur photo',
        body: `Avant de demander un devis pour un aménagement de jardin, un particulier regarde des réalisations. Il cherche un style qui lui plaît, une entreprise qui semble sérieuse et une zone d’intervention qui couvre sa commune. Un professionnel (syndic, collectivité, entreprise) cherche plutôt des références d’entretien et une capacité à intervenir régulièrement.

Un site de paysagiste réussi parle à ces deux publics, sans les mélanger : **la création de jardins** d’un côté, avec de grandes photos et des projets racontés ; **l’entretien** de l’autre, avec des formules claires et un formulaire de demande de visite.`,
      },
      {
        eyebrow: 'Structure conseillée',
        title: 'Ce que nous mettons en avant sur un site de paysagiste',
        cards: [
          ['Une galerie de jardins soignée', 'Des projets présentés avec avant/après, plans ou croquis quand vous en avez, et quelques lignes sur les choix de végétaux et de matériaux.'],
          ['Vos prestations, une par page', 'Création de jardin, terrasse et allées, clôtures, engazonnement, plantations, taille et élagage, entretien régulier.'],
          ['Les saisons', 'Une page ou un bloc qui explique quand planter, quand tailler, quand prévoir un aménagement : utile au client et bon pour la visibilité.'],
          ['Un formulaire de demande de visite', 'Le client indique la surface approximative, le type de travaux et peut joindre des photos de son terrain.'],
          ['Votre zone d’intervention', 'Les communes couvertes et, si c’est votre cas, les secteurs où vous proposez des contrats d’entretien.'],
          ['Les informations utiles', 'Selon votre situation, les avantages fiscaux liés à certains services à la personne, présentés avec prudence et un lien vers la source officielle.'],
        ],
      },
      {
        eyebrow: 'Les photos',
        title: 'Des images qui travaillent pour vous',
        body: `Sur un site de paysagiste, la qualité des photos compte plus que la quantité de texte. Nous vous aidons à constituer une galerie efficace :

- **Photographier avant le chantier**, sous le même angle que la photo finale : le comparatif avant/après est le format le plus parlant.
- **Revenir quelques mois plus tard**, quand les plantations ont pris : un jardin se juge aussi dans la durée.
- **Privilégier la lumière douce** du matin ou de fin de journée et éviter les ciels blancs.
- **Montrer les détails** : un joint de pavage propre, une bordure nette, un massif bien composé.

Nous trions, recadrons et optimisons vos photos pour qu’elles restent belles sans ralentir le site sur mobile. Si vous le souhaitez, nous pouvons aussi organiser une séance photo sur vos chantiers du Pays de Caux.`,
      },
      {
        eyebrow: 'Visibilité',
        title: 'Être trouvé par les particuliers de votre secteur',
        tone: 'sand',
        body: `Les recherches de paysagiste sont très locales : « paysagiste + commune », « entretien de jardin près de chez moi », « élagage + ville ». Pour y apparaître, le site travaille avec votre **fiche Google** et vos **avis clients**. Nous rédigeons des pages qui décrivent votre vrai périmètre d’intervention, sans créer de pages copiées-collées pour chaque commune, une pratique que Google pénalise.

Pour aller plus loin, consultez notre démarche de [référencement local](/referencement-local-artisan), valable pour les paysagistes comme pour tous les métiers de terrain.`,
      },
      {
        eyebrow: 'Cohérence',
        title: 'Du site au véhicule et au panneau de chantier',
        body: `Votre camion et vos panneaux sont vus par tout le voisinage pendant la durée d’un chantier. Un [marquage de véhicule et un panneau de chantier](/vitrophanie-signaletique) assortis à votre site, avec un numéro bien lisible et l’adresse de votre site, transforment chaque chantier en publicité locale. Nous pouvons aussi créer vos [flyers](/flyers-depliants) de saison (entretien d’automne, taille d’hiver) et vos [cartes de visite](/cartes-de-visite).`,
      },
    ],
    local: {
      title: 'Paysagistes de Normandie et d’ailleurs',
      body: `Le Pays de Caux compte beaucoup de jardins de maisons individuelles et de propriétés avec de grands terrains : un contexte idéal pour montrer des créations et des contrats d’entretien. Nous rencontrons volontiers les paysagistes de notre zone principale, sur place ou sur un chantier. Pour les entreprises d’espaces verts du reste de la France, nous travaillons entièrement à distance.`,
    },
    faq: [
      ['Mon activité est très saisonnière, le site doit-il changer selon les saisons ?', 'Il peut mettre en avant des prestations différentes selon la période (plantations à l’automne, taille en hiver, entretien au printemps). Avec l’offre de maintenance, nous faisons ces mises à jour pour vous.'],
      ['Puis-je montrer des jardins de particuliers ?', 'Oui, avec l’accord des propriétaires et sans adresse précise ni élément permettant de les identifier. Nous vous fournissons un modèle d’autorisation simple à faire signer.'],
      ['Faut-il parler des avantages fiscaux sur le site ?', 'Seulement si votre entreprise y ouvre réellement droit pour les prestations concernées. Nous présentons l’information prudemment, avec un lien vers la source officielle, et vous la faites valider par votre comptable.'],
      ['Combien coûte un site de paysagiste ?', 'Les prix de départ sont indiqués sur la page [tarifs](/tarifs). Une galerie importante ou un formulaire spécifique peuvent faire évoluer le devis, qui est toujours détaillé avant engagement.'],
      ['Pouvez-vous gérer mes publications sur les réseaux sociaux ?', 'Nous créons des [gabarits de publications](/reseaux-sociaux) à vos couleurs pour publier facilement vos chantiers. La publication régulière reste de votre côté ou peut faire l’objet d’un accompagnement.'],
    ],
    links: [
      ['/packs/paysagiste', 'Pack Bien démarrer — paysagiste'],
      ['/creation-site-internet', 'Création de site internet'],
      ['/creation-site-internet-artisan', 'Site internet pour artisans'],
      ['/referencement-local-artisan', 'Référencement local'],
      ['/vitrophanie-signaletique', 'Marquage de véhicule et panneaux'],
      ['/realisations', 'Toutes nos réalisations'],
    ],
    ctaBand: { title: 'Montrons vos plus beaux jardins', text: 'Envoyez-nous quelques photos de chantiers : nous vous proposons une structure de site et un devis gratuit.' },
  },
  {
    path: '/referencement-local-artisan',
    name: 'Référencement local pour artisans',
    serviceType: 'Référencement local (SEO local)',
    metaTitle: 'Référencement local pour artisans et TPE',
    metaDescription: 'Apparaître sur Google Maps et dans les recherches locales : fiche Google, avis clients, pages locales utiles. Méthode transparente, sans promesse de classement.',
    eyebrow: 'Référencement · Local',
    h1: 'Référencement local',
    h1em: 'pour les artisans et les TPE.',
    intro:
      'Quand un client cherche « électricien Bolbec » ou « couvreur près de chez moi », Google affiche d’abord une carte avec trois entreprises. Notre travail : vous donner toutes les chances d’y figurer, avec une méthode claire et des actions que vous comprenez.',
    visual: 'seo',
    cta: ['/devis?type=seo', 'Demander un diagnostic gratuit'],
    secondary: ['/referencement-seo', 'Notre offre de référencement'],
    sections: [
      {
        eyebrow: 'Comment ça marche',
        title: 'Les trois piliers de la visibilité locale',
        body: `Google classe les entreprises locales selon trois grands critères, qu’il décrit lui-même publiquement : **la pertinence** (votre fiche et votre site correspondent-ils à la recherche ?), **la distance** (êtes-vous proche de la personne qui cherche ?) et **la notoriété** (avis, mentions de votre entreprise sur le web, ancienneté).

La distance, vous n’y pouvez rien. Sur les deux autres critères, il y a presque toujours beaucoup à gagner, en particulier pour les artisans dont la fiche a été créée rapidement il y a des années et jamais complétée.`,
      },
      {
        eyebrow: 'Notre démarche',
        title: 'Ce que nous faisons, dans l’ordre',
        cards: [
          ['1. Diagnostic', 'État de votre fiche Google, cohérence de vos coordonnées sur le web, recherches sur lesquelles vous apparaissez ou non, comparaison avec les entreprises affichées.'],
          ['2. Fiche Google complète', 'Catégories adaptées à votre métier, description, zone desservie, horaires, services, photos réelles de vos chantiers.'],
          ['3. Coordonnées cohérentes', 'Nom, adresse et téléphone identiques au caractère près sur votre site, Google, PagesJaunes, les annuaires professionnels et vos réseaux.'],
          ['4. Site optimisé', 'Pages de prestations claires, zone d’intervention, données structurées, vitesse et lisibilité sur mobile.'],
          ['5. Avis clients', 'Un lien court et une carte à remettre en fin de chantier pour demander un avis, et des réponses à chaque avis.'],
          ['6. Suivi mensuel', 'Un point simple sur les actions faites et l’évolution de votre visibilité, à partir des données de votre fiche et de la Search Console.'],
        ],
      },
      {
        eyebrow: 'Les avis',
        title: 'Les avis clients : honnêtes, réguliers, et toujours avec une réponse',
        tone: 'sand',
        body: `Les avis comptent pour Google et encore plus pour vos futurs clients. La règle est simple : **demander un avis à chaque client satisfait**, au bon moment (à la fin du chantier, quand le résultat est visible), avec un lien direct qui évite de chercher votre fiche.

Ce que nous ne ferons jamais, et que nous vous déconseillons fermement : acheter des avis, en rédiger soi-même ou en faire écrire par des proches. C’est contraire aux règles de Google, interdit par la réglementation sur les pratiques commerciales trompeuses, et facilement repérable.

Répondez à tous les avis, y compris aux critiques : une réponse calme et factuelle rassure davantage qu’une note parfaite.`,
      },
      {
        eyebrow: 'Pages locales',
        title: 'Une page par ville ? Seulement si elle a quelque chose à dire',
        body: `Beaucoup de sites créent des dizaines de pages « plombier à [ville] » au texte identique. Google les considère comme des pages satellites et peut pénaliser tout le site.

Nous procédons autrement : une page qui décrit **votre vraie zone d’intervention**, et des pages locales uniquement pour les secteurs où vous avez un contenu propre (chantiers réalisés, contraintes locales, délais de déplacement). C’est ce que nous appliquons à notre propre site, avec notre [zone d’intervention](/zone-intervention).`,
      },
      {
        eyebrow: 'Diagnostic',
        title: 'Les erreurs que nous corrigeons le plus souvent',
        tone: 'sand',
        body: `Sur les fiches et les sites d’artisans que nous analysons, les mêmes problèmes reviennent régulièrement. Ils sont simples à corriger et ont souvent un effet rapide :

- **Une catégorie principale trop vague** sur la fiche Google (« Entreprise de construction » au lieu de « Plombier » ou « Électricien »).
- **Des coordonnées différentes** d’un site à l’autre : ancien numéro sur un annuaire, adresse incomplète, nom commercial écrit de trois façons.
- **Aucune photo récente**, ou seulement le logo : une fiche sans photos de chantiers inspire peu confiance.
- **Des horaires absents ou faux**, qui font appeler le client au mauvais moment.
- **Un site qui ne cite jamais les communes desservies** ni les prestations précises, et ne peut donc pas apparaître sur ces recherches.
- **Des avis sans réponse** depuis des mois, parfois depuis des années.

Le diagnostic gratuit vous indique lesquels de ces points vous concernent, par ordre de priorité.`,
      },
      {
        eyebrow: 'Transparence',
        title: 'Ce que nous promettons, et ce que nous ne promettons pas',
        body: `Personne ne contrôle le classement de Google. Une agence qui vous garantit la première place vous ment ou parle d’annonces payantes. Nous nous engageons sur **un travail précis, daté et vérifiable** : fiche complétée, coordonnées corrigées, pages créées, demandes d’avis mises en place. Et nous vous montrons chaque mois ce qui évolue, sans jargon.

Les tarifs de l’accompagnement sont affichés sur la page [référencement SEO](/referencement-seo) et sur la page [tarifs](/tarifs).`,
      },
    ],
    local: {
      title: 'Une connaissance du terrain dans le Pays de Caux',
      body: `Nous connaissons les communes de notre secteur, leurs zones d’activité et la façon dont les habitants y cherchent un artisan. Pour une entreprise de Bolbec, Lillebonne, Fécamp ou Yvetot, nous pouvons faire le point sur place, téléphone en main, sur ce que voient vraiment vos clients.`,
    },
    faq: [
      ['Combien de temps faut-il pour voir des résultats ?', 'Les corrections de la fiche Google peuvent produire un effet en quelques semaines ; le travail sur le site et les avis se mesure plutôt sur plusieurs mois. Nous ne donnons pas de délai garanti, mais un suivi mensuel de l’évolution.'],
      ['Je n’ai pas d’adresse où recevoir des clients, puis-je avoir une fiche Google ?', 'Oui. Une entreprise qui se déplace chez ses clients peut masquer son adresse et déclarer une zone desservie. C’est le cas de la plupart des artisans.'],
      ['Faut-il payer Google pour apparaître sur la carte ?', 'Non. La fiche d’établissement est gratuite. Les annonces payantes existent, mais elles sont distinctes du référencement naturel.'],
      ['Que faire d’un avis négatif injuste ?', 'Répondre poliment, factuellement et sans s’emporter. Si l’avis enfreint les règles de Google (insulte, faux client, contenu hors sujet), il peut être signalé ; Google décide seul de le retirer.'],
      ['Puis-je faire ce travail moi-même ?', 'En grande partie, oui. Notre diagnostic vous donne une liste d’actions concrètes ; vous pouvez les réaliser vous-même ou nous les confier.'],
    ],
    links: [
      ['/packs/artisan-batiment', 'Pack Bien démarrer — artisan du bâtiment'],
      ['/referencement-seo', 'Référencement naturel et local'],
      ['/creation-site-internet-artisan', 'Site internet pour artisans'],
      ['/creation-site-internet-paysagiste', 'Site internet pour paysagistes'],
      ['/blog/visibilite-locale-par-ou-commencer', 'Visibilité locale : par où commencer ?'],
      ['/zone-intervention', 'Notre zone d’intervention'],
    ],
    ctaBand: { title: 'Où en est votre visibilité locale ?', text: 'Demandez un diagnostic gratuit : nous vous indiquons les trois actions les plus utiles pour votre entreprise.' },
  },
  {
    path: '/vitrophanie-vitrine-commerce',
    name: 'Vitrophanie de vitrine pour commerces',
    serviceType: 'Vitrophanie et habillage de vitrine',
    metaTitle: 'Vitrophanie de vitrine pour commerces',
    metaDescription: 'Habillage de vitrine pour boutiques, restaurants, salons et cabinets : lettrage, horaires, microperforé, dépoli. Maquette sur photo et pose dans le Pays de Caux.',
    eyebrow: 'Vitrophanie · Commerces',
    h1: 'Une vitrine de commerce',
    h1em: 'qui fait entrer.',
    intro:
      'Votre vitrine travaille pour vous chaque jour, même quand le magasin est fermé. Bien habillée, elle dit en un coup d’œil ce que vous vendez, quand vous êtes ouvert et pourquoi pousser la porte.',
    visual: 'storefront',
    cta: ['/devis-vitrophanie-signaletique?besoin=vitrophanie', 'Demander une maquette sur photo'],
    secondary: ['/vitrophanie-signaletique', 'Toute la signalétique'],
    sections: [
      {
        eyebrow: 'Les bases',
        title: 'Ce qu’une vitrine doit dire en trois secondes',
        body: `Un passant regarde une vitrine quelques secondes, souvent en marchant ou depuis sa voiture. Dans ce laps de temps, il doit comprendre :

- **qui vous êtes** : votre nom et votre logo, lisibles de l’autre côté de la rue ;
- **ce que vous faites** : votre activité en un ou deux mots (« Boulangerie — Pâtisserie », « Coiffure mixte », « Fleuriste ») ;
- **si c’est ouvert** : vos horaires, à hauteur des yeux près de la porte ;
- **comment vous joindre ou réserver** : téléphone, site, QR code vers votre page de réservation.

Tout ce qui s’ajoute à ces informations doit être pesé : une vitrine surchargée se lit moins bien qu’une vitrine sobre.`,
      },
      {
        eyebrow: 'Selon votre commerce',
        title: 'Des solutions adaptées à chaque activité',
        cards: [
          ['Boutiques et commerces de bouche', 'Lettrage du nom et de l’activité, bandeau de produits, horaires et moyens de paiement près de l’entrée.'],
          ['Restaurants et cafés', 'Nom, type de cuisine, horaires du service, QR code vers la carte ou la réservation, adhésif de terrasse.'],
          ['Salons de coiffure et instituts', 'Dépoli partiel pour l’intimité des clients, logo découpé, prestations phares, prise de rendez-vous en ligne.'],
          ['Cabinets et professions libérales', 'Vitrophanie dépolie ou sablée, plaque professionnelle et horaires, dans le respect des règles de votre profession.'],
          ['Agences et bureaux', 'Microperforé grand format pour une image forte côté rue, en gardant la lumière et la vue depuis l’intérieur.'],
          ['Opérations ponctuelles', 'Ouverture, soldes, fête des mères, rentrée : des adhésifs temporaires faciles à retirer.'],
        ],
      },
      {
        eyebrow: 'Les matériaux',
        title: 'Lettrage, impression, microperforé ou dépoli ?',
        tone: 'sand',
        body: `Le choix dépend de l’effet recherché et de la durée :

- **Lettrage découpé** : des lettres et un logo en adhésif de couleur unie, sans fond. Élégant, très lisible, idéal pour un nom et une activité.
- **Adhésif imprimé** : pour une photo, un dégradé ou un logo en plusieurs couleurs.
- **Microperforé** : couvre toute une surface vitrée d’un visuel, tout en laissant voir à travers depuis l’intérieur. Parfait pour une grande vitrine qui manque d’impact.
- **Dépoli** : imite le verre sablé. Il préserve l’intimité sans assombrir le local.

Nous vous conseillons aussi sur le **sens de pose** (intérieur ou extérieur de la vitre) et sur la durée : un habillage permanent n’utilise pas le même adhésif qu’une opération de quelques semaines. Les détails techniques figurent sur notre page [vitrophanie et signalétique](/vitrophanie-signaletique).`,
      },
      {
        eyebrow: 'À éviter',
        title: 'Les erreurs les plus courantes sur une vitrine',
        body: `Une vitrine qui ne fonctionne pas souffre rarement d’un manque d’idées, plus souvent d’un excès. Les erreurs que nous rencontrons le plus :

- **Trop d’informations** : liste complète des produits, promotions superposées, affichettes ajoutées au fil des années. Le passant ne retient rien.
- **Un nom illisible de loin** : lettres trop fines, trop petites ou d’une couleur qui se confond avec l’intérieur du magasin.
- **Des horaires absents ou écrits à la main**, qui donnent une impression de négligence.
- **Une vitrine entièrement occultée** sans raison : le client ne voit plus l’intérieur et n’ose pas entrer. Le microperforé ou un habillage partiel règlent le problème.
- **Des adhésifs décolorés ou décollés** laissés en place : mieux vaut une vitrine sobre qu’un habillage abîmé.

Notre approche : partir de ce que le passant doit comprendre, puis enlever tout ce qui ne sert pas ce message.`,
      },
      {
        eyebrow: 'Avant de vous engager',
        title: 'La maquette sur photo de votre vitrine',
        body: `Il est difficile d’imaginer le rendu d’une vitrophanie à partir d’un fichier à plat. Nous partons donc d’une **photo de votre façade** et y intégrons le projet à l’échelle : vous voyez votre future vitrine avant de valider quoi que ce soit.

Envoyez-nous une photo prise de face, d’un peu loin, avec les dimensions approximatives des vitres. Nous vous répondons avec une proposition de maquette et un devis gratuit. La pose est réalisée par notre poseur partenaire dans notre zone d’intervention.`,
        cta: ['/devis-vitrophanie-signaletique?besoin=vitrophanie', 'Envoyer une photo de ma vitrine'],
      },
      {
        eyebrow: 'Ouverture',
        title: 'Vous ouvrez votre commerce ?',
        tone: 'ink',
        body: `Le **pack ouverture de commerce** réunit vitrophanie, horaires, enseigne ou panneau, flyers d’ouverture, cartes de visite et fiche Google, avec une image cohérente du premier coup. Il est établi sur devis, selon votre local. [Découvrir le pack ouverture](/vitrophanie-signaletique#pack-ouverture).`,
      },
    ],
    local: {
      title: 'Des vitrines habillées dans le Pays de Caux',
      body: `Centre-ville de Bolbec, rues commerçantes de Lillebonne, quartiers du Havre, commerces de Fécamp ou d’Yvetot : nous nous déplaçons pour relever les mesures et organiser la pose. Pour les commerces plus éloignés, nous préparons les adhésifs à partir de vos mesures et vous les livrons prêts à poser.

Conditions de déplacement : [À COMPLÉTER : rayon d’intervention pour la pose et frais de déplacement éventuels].`,
    },
    faq: [
      ['Ai-je besoin d’une autorisation pour habiller ma vitrine ?', 'Une simple vitrophanie à l’intérieur de la vitre est rarement soumise à autorisation, mais certaines communes encadrent les enseignes et la publicité (règlement local de publicité, secteur protégé). Renseignez-vous auprès de votre mairie ; nous vous fournissons visuels et dimensions pour votre dossier.'],
      ['Combien de temps tient une vitrophanie ?', 'Cela dépend de l’adhésif choisi, de l’exposition au soleil et de l’entretien. Nous choisissons le film en fonction de la durée souhaitée et l’indiquons sur le devis.'],
      ['Puis-je changer ma vitrine à chaque saison ?', 'Oui. Nous pouvons prévoir une base permanente (nom, logo, horaires) et des adhésifs temporaires, faciles à retirer, pour vos opérations saisonnières.'],
      ['Comment nettoyer une vitre habillée ?', 'Avec de l’eau savonneuse et une raclette souple, sans produit abrasif ni grattoir sur l’adhésif. Nous vous remettons les consignes d’entretien à la pose.'],
      ['Quel est le prix d’un habillage de vitrine ?', 'Il dépend de la surface, du type d’adhésif, de la création et de la pose. Chaque projet est chiffré sur devis gratuit, à partir de vos photos et de vos mesures.'],
    ],
    links: [
      ['/packs/coiffeur', 'Pack Bien démarrer — coiffeur et institut'],
      ['/packs/restaurant', 'Pack Bien démarrer — restaurant'],
      ['/vitrophanie-signaletique', 'Vitrophanie et signalétique'],
      ['/identite-visuelle-logo', 'Création de logo'],
      ['/flyers-depliants', 'Flyers d’ouverture'],
      ['/realisations/fournil-du-caux', 'Concept : la vitrine du Fournil du Caux'],
      ['/zone-intervention', 'Notre zone d’intervention'],
    ],
    ctaBand: { title: 'Montrez-nous votre vitrine', text: 'Une photo suffit pour recevoir une maquette en situation et un devis gratuit.' },
  },
  {
    path: '/zone-intervention',
    name: 'Zone d’intervention',
    serviceType: 'Agence web, graphisme, impression et signalétique',
    metaTitle: 'Zone d’intervention : Pays de Caux et France',
    metaDescription: 'Agence web et print basée à Gruchet-le-Valasse : déplacements à Bolbec, Lillebonne, Le Havre, Fécamp, Yvetot et dans le Pays de Caux, à distance partout en France.',
    eyebrow: 'Zone d’intervention',
    h1: 'Basés à Gruchet-le-Valasse,',
    h1em: 'au service de tout le Pays de Caux.',
    intro:
      'Nous rencontrons les entreprises de notre secteur sur place, et nous accompagnons celles du reste de la France à distance, avec la même méthode et les mêmes engagements.',
    visual: 'seo',
    cta: ['/contact', 'Nous contacter'],
    secondary: ['/devis', 'Demander un devis'],
    sections: [
      {
        eyebrow: 'Notre ancrage',
        title: 'Une agence au cœur du Pays de Caux',
        body: `Signe & Seine est installée à **Gruchet-le-Valasse**, entre Bolbec et Lillebonne, à proximité de l’abbaye du Valasse. Ce point de départ nous place à quelques minutes des principales communes de Caux Seine Agglo et à une distance raisonnable du Havre, de Fécamp et d’Yvetot.

Être proches, c’est pouvoir **venir voir votre local, votre vitrine ou vos chantiers**, prendre des photos, relever des mesures et échanger de vive voix. Pour beaucoup de projets (une vitrophanie, un site d’artisan, une identité visuelle), ce rendez-vous sur place fait gagner du temps à tout le monde.`,
      },
      {
        eyebrow: 'Sur place',
        title: 'Ce que nous faisons lors d’un déplacement',
        cards: [
          ['Premier rendez-vous', 'Comprendre votre activité, vos clients et vos supports actuels, dans votre local ou sur un chantier.'],
          ['Photos et repérage', 'Photos de vos réalisations, de votre équipe ou de votre façade, pour le site et les maquettes.'],
          ['Relevé des mesures', 'Dimensions des vitrines, façades et emplacements de panneaux avant toute fabrication.'],
          ['Pose de signalétique', 'Organisation de la pose avec notre poseur partenaire : vitrophanie, panneaux, enseignes, marquage.'],
          ['Présentation et formation', 'Remise des fichiers, présentation du site et prise en main de votre espace.'],
          ['Point de suivi', 'Un échange régulier pour les accompagnements de visibilité locale.'],
        ],
      },
      {
        eyebrow: 'Notre zone',
        title: 'Les communes où nous nous déplaçons',
        tone: 'sand',
        body: `**Zone principale** : Gruchet-le-Valasse, Bolbec, Lillebonne, Port-Jérôme-sur-Seine, Saint-Romain-de-Colbosc, Goderville, Fécamp, Yvetot, Rives-en-Seine, Montivilliers et Le Havre, ainsi que les communes situées entre elles.

**Zone élargie** : Rouen et le reste de la Seine-Maritime, l’Eure et la Normandie, pour des projets qui le justifient (pose de signalétique importante, séance photo, accompagnement suivi).

**Partout en France** : sites internet, identité visuelle, supports imprimés et référencement se gèrent très bien à distance. Les supports imprimés sont livrés à votre adresse.

Conditions de déplacement : [À COMPLÉTER : rayon couvert sans frais, frais de déplacement au-delà, délais de pose habituels].`,
      },
      {
        eyebrow: 'Organisation',
        title: 'Comment nous organisons nos déplacements',
        body: `Nous regroupons autant que possible les rendez-vous d’un même secteur sur une même journée : un passage à Fécamp, Goderville ou Yvetot peut ainsi être planifié rapidement, sans attendre. Pour un relevé de mesures ou une pose, nous convenons d’un créneau qui ne gêne pas votre activité, par exemple avant l’ouverture d’un commerce ou en fin de journée.

Avant chaque déplacement, nous vous demandons quelques photos et les informations utiles (dimensions approximatives, accès, stationnement, horaires d’ouverture). Cela évite les allers-retours et permet d’arriver avec une première proposition ou des échantillons adaptés.

Pour les poses de signalétique, le délai dépend de la fabrication des supports et de la disponibilité de notre poseur partenaire. Il vous est indiqué sur le devis, et nous vous confirmons la date de pose dès que les supports sont prêts.

Notre secteur combine des centres-villes commerçants (Bolbec, Lillebonne, Fécamp, Yvetot), des zones d’activité et une agglomération plus dense autour du Havre. Les besoins y sont différents : vitrines et commerces de proximité d’un côté, artisans et entreprises de services de l’autre, entreprises liées au port et à l’industrie autour de Port-Jérôme et du Havre. Nos pages [site internet pour artisans](/creation-site-internet-artisan), [vitrophanie de vitrine](/vitrophanie-vitrine-commerce) et [référencement local](/referencement-local-artisan) détaillent ce que nous proposons à chacun.`,
      },
      {
        eyebrow: 'À distance',
        title: 'Comment nous travaillons avec les entreprises éloignées',
        body: `1. **Un premier appel ou une visioconférence** pour comprendre votre besoin.
2. **Un devis détaillé** envoyé par e-mail, à valider en ligne.
3. **Des maquettes et des bons à tirer** consultables depuis un lien sécurisé, sans compte à créer.
4. **Des échanges réguliers** par téléphone ou par e-mail, aux horaires qui vous conviennent.
5. **La livraison** des fichiers, du site en ligne ou des supports imprimés à votre adresse.

Pour la signalétique, nous préparons les adhésifs et panneaux à partir de vos mesures et de vos photos, et vous les livrons prêts à poser, avec les consignes de pose.`,
      },
    ],
    local: {
      title: 'Les communes de notre zone principale',
      body: `Certaines communes disposent d’une page dédiée, avec ce que nous y faisons concrètement. Cliquez sur leur nom pour la consulter.`,
    },
    faq: [
      ['Vous déplacez-vous gratuitement ?', 'Conditions de déplacement : [À COMPLÉTER : rayon couvert sans frais et frais au-delà]. Elles sont toujours indiquées sur le devis avant tout engagement.'],
      ['Recevez-vous des clients à votre adresse ?', 'Nous nous déplaçons chez vous ou échangeons par téléphone et visioconférence. Pour un rendez-vous, contactez-nous afin de convenir du lieu le plus pratique.'],
      ['Travaillez-vous avec des entreprises hors de Normandie ?', 'Oui. Sites internet, logos, supports imprimés et référencement se gèrent entièrement à distance. Seule la pose de signalétique est réservée à notre zone d’intervention.'],
      ['Comment vous joindre ?', 'Par téléphone ou par e-mail : nos coordonnées et nos horaires figurent sur la page [contact](/contact) et en bas de chaque page.'],
    ],
    links: [
      ['/creation-site-internet-artisan', 'Site internet pour artisans'],
      ['/vitrophanie-vitrine-commerce', 'Vitrophanie de vitrine'],
      ['/referencement-local-artisan', 'Référencement local'],
      ['/contact', 'Nous contacter'],
    ],
    map: true,
    ctaBand: { title: 'Un projet près de chez vous ?', text: 'Appelez-nous ou écrivez-nous : nous convenons d’un rendez-vous sur place ou à distance.' },
  },
];

export const landingByPath = (path: string) => LANDING_PAGES.find((p) => p.path === path);
