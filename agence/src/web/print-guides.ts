/**
 * Guides propres à chaque fiche d'impression (/impression/<slug>) : à quoi sert le support, comment le choisir,
 * les erreurs fréquentes. Sans eux, les fiches partageaient l'essentiel de leur texte (configurateur et FAQ communs).
 * Markdown simple (## titres, listes, **gras**, [liens](/chemin)). Aucun prix ni délai : ils viennent de la base.
 */

export interface PrintGuide {
  title: string;
  body: string;
}

export const PRINT_GUIDES: Record<string, PrintGuide> = {
  flyers: {
    title: 'Bien choisir son flyer',
    body: `**Le format dépend de l’usage.** Le A6 se glisse dans une poche ou un sac : c’est le format des distributions en boîtes aux lettres et des comptoirs. Le A5 laisse la place à une offre détaillée ou à un menu court. Le DL (99 × 210 mm) tient dans une enveloppe et dans les présentoirs. Le A4 sert surtout d’affichette ou de fiche tarifaire.

**Le papier se choisit selon la durée de vie du flyer.** Un 135 g couché suffit pour une distribution ponctuelle ; un 250 à 350 g donne une sensation de qualité pour un flyer conservé (carte de fidélité, menu à emporter, tarifs). Le couché brillant fait ressortir les photos, le mat est plus lisible et accepte l’écriture, le recyclé valorise une démarche responsable.

**Les erreurs les plus fréquentes :** un texte trop long, des coordonnées incomplètes au verso, une photo de basse résolution, ou un texte placé trop près du bord de coupe. Nous vérifions ces points avant chaque impression et vous envoyons un BAT à valider. Pour vérifier vous-même votre fichier, voir notre article [flyer : 8 points à vérifier avant impression](/blog/flyer-points-a-verifier-avant-impression).

Vous n’avez pas encore de visuel ? Voir la [création de flyers et dépliants](/flyers-depliants).`,
  },
  'cartes-de-visite': {
    title: 'Une carte de visite qui dure',
    body: `**Le grammage fait la première impression.** En dessous de 300 g, une carte se plie dans un portefeuille. De 350 à 450 g, elle paraît nettement plus solide en main, sans surcoût important.

**La finition protège et donne le ton.** Le pelliculage mat est le choix le plus courant : sobre, anti-traces, agréable au toucher. Le pelliculage brillant fait ressortir une photo ou des couleurs vives. Le soft-touch, au toucher velouté, est apprécié des métiers du soin, de la beauté et du conseil. Une carte sans finition reste possible pour écrire dessus (rendez-vous, carte de fidélité à tamponner).

**Recto seul ou recto-verso ?** Le verso est un espace précieux : prestations, horaires, QR code vers votre site ou votre fiche Google, plan d’accès. Il est rarement utile de le laisser blanc.

**Le format portrait ou carré** permet de se distinguer, mais vérifiez qu’il entre dans les porte-cartes de vos clients. Pour une carte vraiment marquante, voir les [cartes de visite premium](/impression/cartes-de-visite-premium) ; pour la création, la page [cartes de visite](/cartes-de-visite).`,
  },
  'cartes-de-visite-premium': {
    title: 'Dorure, vernis sélectif, papiers de création : à quoi s’attendre',
    body: `**La dorure à chaud** dépose une fine feuille métallique (or, argent, cuivre, or rose) sur une partie du visuel : logo, nom ou motif. Elle accroche la lumière et se remarque immédiatement. Elle fonctionne mieux sur des éléments assez épais : un texte trop fin peut se boucher.

**Le vernis sélectif** ajoute une brillance en léger relief sur une zone précise, par contraste avec un fond mat. C’est une finition discrète, appréciée pour mettre en valeur un logo sans ajouter de couleur.

**Les papiers de création** (non couchés, texturés, très épais) changent la sensation en main : la carte paraît artisanale et haut de gamme. Ils absorbent davantage l’encre : les couleurs sont plus douces qu’avec un papier couché, ce que nous anticipons dans le fichier.

**À qui s’adressent-elles ?** Aux métiers où l’image compte autant que le service : artisans d’art, architectes, décorateurs, cavistes, restaurants gastronomiques, professions du bien-être. Le fichier demande une préparation particulière (un calque séparé pour la dorure ou le vernis) : nous nous en chargeons et vous montrons le rendu sur le BAT.`,
  },
  depliants: {
    title: 'Pli roulé, accordéon ou croisé : comment choisir',
    body: `**Le pli simple (2 volets)** convient à une présentation courte : une carte de restaurant, une invitation, un programme. **Le pli roulé (3 volets)**, le plus classique, se lit comme un petit livret : couverture, intérieur sur trois volets, contact au dos. **Le pli accordéon** se déplie d’un geste et permet une lecture continue, idéale pour un parcours, une frise ou des étapes. **Le pli croisé** donne une grande surface une fois ouvert, pratique pour un plan ou une carte.

**Le format fermé DL** (99 × 210 mm) est le plus répandu : il tient dans les présentoirs des offices de tourisme, des mairies et des commerces. Le A5 et le A4 conviennent à des contenus plus riches, comme une plaquette commerciale ou un catalogue de prestations.

**Construire le parcours de lecture :** la couverture donne envie d’ouvrir, l’intérieur détaille, le dernier volet conclut avec vos coordonnées et un appel à l’action. Une erreur fréquente : placer le contact sur le volet qui se replie à l’intérieur, invisible quand le dépliant est posé.

Pour la mise en page, voir la [création de flyers et dépliants](/flyers-depliants).`,
  },
  affiches: {
    title: 'Une affiche lisible de loin',
    body: `**Choisir le format selon la distance de lecture.** Un A4 ou un A3 se lit à un ou deux mètres : vitrine, panneau d’affichage, comptoir. Un A2 ou un B2 se voit depuis le trottoir d’en face. Un A1, un A0 ou un B1 conviennent aux halls, salons et grands événements.

**Trois éléments suffisent :** un titre très visible, une image forte, l’information pratique (date, lieu, prix, QR code). Une affiche se regarde en quelques secondes, souvent en marchant : tout ce qui dépasse ces trois éléments est rarement lu.

**Le papier :** le couché brillant fait ressortir les photos, le couché mat évite les reflets derrière une vitrine ou sous un éclairage direct. Ces affiches papier sont prévues pour l’intérieur ou derrière une vitre ; pour un affichage extérieur exposé à la pluie, une [bâche](/impression/baches-banderoles) ou un [adhésif de vitrine](/vitrophanie-vitrine-commerce) sera plus durable.

**Pour un fichier net en grand format,** les photos doivent être de bonne qualité : une image prise sur un site internet est presque toujours trop petite. Nous vérifions la résolution avant impression et vous le signalons si besoin. Création : [affiches et brochures](/affiches-brochures).`,
  },
  brochures: {
    title: 'Préparer une brochure ou un catalogue',
    body: `**Le nombre de pages est toujours un multiple de 4** : une feuille pliée en deux et agrafée au centre donne quatre pages. Une brochure de 8, 12, 16 ou 24 pages se prépare donc en conséquence ; une page blanche « de trop » se transforme facilement en page de notes, de contacts ou de partenaires.

**La couverture plus épaisse** (170 à 300 g) donne de la tenue à un catalogue ou un livret consulté souvent : elle résiste mieux aux manipulations et se distingue au toucher. Pour un programme ou un livret distribué en nombre, une couverture identique à l’intérieur reste économique.

**Le format :** le A4 pour un catalogue produits ou un rapport, le A5 pour une plaquette de présentation ou un livret d’accueil, le carré pour un portfolio ou un lookbook, le A6 pour un guide de poche.

**Usages fréquents :** catalogue de produits, livret d’accueil de gîte ou de chambre d’hôtes, plaquette d’entreprise, programme culturel ou sportif, carte des vins. Nous préparons la mise en page, la pagination et le fond perdu de chaque page ; voir [affiches et brochures](/affiches-brochures).`,
  },
  'roll-up': {
    title: 'Kakémono enrouleur : bien choisir sa structure',
    body: `**Le roll-up, ou kakémono enrouleur,** se déroule de sa base et tient debout grâce à un mât : il se monte en moins d’une minute, sans outil, et se range dans son sac de transport. C’est le support de base des salons professionnels, forums de l’emploi, accueils d’entreprise, marchés et événements sportifs.

**La structure fait la différence dans le temps.** Une structure d’entrée de gamme convient à quelques utilisations par an. Si le roll-up sort chaque semaine ou voyage souvent, une structure plus robuste (premium ou deluxe) résiste mieux aux montages répétés et permet parfois de changer le visuel sans racheter la structure.

**La largeur :** 80 ou 85 cm pour un stand étroit ou un accueil, 100 à 120 cm pour un stand plus large ou un fond de photo.

**Le visuel se lit de haut en bas :** le logo et le message principal dans le tiers supérieur, à hauteur des yeux ; le bas, souvent masqué par une table ou des visiteurs, ne doit porter aucune information importante. Un QR code au niveau de la poitrine permet de prendre vos coordonnées sans brochure. Le matériau polyester rend les couleurs plus nettes ; la version sans PVC convient aux démarches responsables.`,
  },
  'etiquettes-rouleau': {
    title: 'Étiquettes de produits : forme, matériau et usage',
    body: `**Le rouleau est adapté aux volumes réguliers** : pots, bocaux, bouteilles, boîtes, sachets. Les étiquettes se décollent vite à la main et peuvent être posées à l’étiqueteuse si vous en utilisez une.

**Le matériau dépend du produit et de son environnement :**

- le **plastique blanc** (polypropylène) résiste à l’humidité, au réfrigérateur et aux manipulations : idéal pour les produits frais, les cosmétiques et les bouteilles ;
- le **transparent** laisse voir le contenu ou la couleur du flacon, pour un rendu « sans étiquette » ;
- le **papier** convient aux produits secs et aux emballages kraft ; il est plus sensible à l’eau ;
- le **Natureflex biodégradable** accompagne les marques engagées dans une démarche zéro plastique.

**Pensez aux mentions obligatoires** propres à votre activité (dénomination, ingrédients, allergènes, poids, date, coordonnées du producteur…). Elles relèvent de votre responsabilité : nous les mettons en page de façon lisible, mais leur contenu est à vérifier selon la réglementation de vos produits.

Producteurs, épiceries, brasseurs, artisans des métiers de bouche du Pays de Caux et de la côte, de Fécamp à Bolbec : nous pouvons créer l’étiquette avec vous et vérifier son rendu sur un échantillon de votre emballage.`,
  },
  autocollants: {
    title: 'Autocollants : quel support pour quel usage',
    body: `**Les autocollants à l’unité ou en planche** servent à personnaliser : logo sur un emballage, sceau de fermeture d’un sac, sticker offert avec une commande, QR code d’avis client sur un comptoir, marquage de matériel.

**Le matériau se choisit selon l’endroit où il sera collé :**

- le **vinyle** résiste à l’eau et aux UV : vitres, véhicules, matériel, objets utilisés dehors ;
- le **papier** est économique pour un usage intérieur et de courte durée (fermeture de sachets, étiquetage ponctuel) ;
- le **transparent** fait apparaître le logo seul sur une vitre ou un flacon ;
- le **kraft** donne un aspect naturel aux emballages de produits artisanaux.

**La découpe à la forme** suit le contour de votre logo ou de votre visuel, pour un rendu plus soigné qu’un simple rond ou carré. Le fichier doit alors prévoir un tracé de découpe : nous le préparons.

Pour un adhésif de grande taille sur une vitrine ou un véhicule, il s’agit plutôt de [vitrophanie ou de marquage](/vitrophanie-signaletique), posé par un professionnel.`,
  },
  'baches-banderoles': {
    title: 'Bâches et banderoles : matériau, fixation, réglementation',
    body: `**Le matériau dépend de l’emplacement :**

- la **bâche PVC pleine** est la plus courante : solide, lisible de loin, pour une façade, une clôture ou un événement ;
- la **bâche micro-perforée** laisse passer le vent : indispensable sur une barrière de chantier, une clôture exposée ou un échafaudage, où une bâche pleine ferait voile ;
- la **bâche ignifugée** (classée au feu) est souvent exigée dans les salles, les salons et les lieux recevant du public.

**La fixation se prévoit dès le devis :** œillets à intervalles réguliers pour des colliers ou des sandows, fourreaux pour passer une barre, renfort des bords pour les grandes dimensions.

**Lisible de loin, donc simple :** un nom, une activité, un téléphone ou un site. Pour une bâche de chantier, ajoutez le métier et une photo de réalisation : c’est une publicité visible par tous les passants pendant des semaines.

**Avant de poser une bâche publicitaire durable** sur une façade ou en bord de route, renseignez-vous auprès de la mairie : la publicité extérieure et les enseignes sont encadrées par des règles locales. Pour un panneau de chantier rigide ou une enseigne, voir [vitrophanie et signalétique](/vitrophanie-signaletique).`,
  },
};
