/**
 * Articles de blog ajoutés par la migration 5 : un article par semaine, publié automatiquement à sa date
 * (un article dont `published_at` est dans le futur reste invisible sur le site, dans le blog et le sitemap).
 * Prix repris des offres publiées ; aucun client, chiffre ou avis réel n'est inventé.
 */

export interface PostSeed {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  meta_description: string;
  published_at: string;
  body: string;
}

export const POSTS_V5: PostSeed[] = [
  {
    slug: 'prix-site-internet-artisan',
    title: 'Combien coûte un site internet pour un artisan en 2026 ?',
    category: 'Sites internet',
    excerpt: 'De quelques centaines à plusieurs milliers d’euros : ce qui fait vraiment varier le prix d’un site, et les frais à prévoir après la mise en ligne.',
    meta_description: 'Prix d’un site internet pour artisan en 2026 : ce qui fait varier le tarif, frais annuels à prévoir, pièges à éviter. Exemples de tarifs détaillés.',
    published_at: '2026-10-27T08:00:00.000Z',
    body: `« Combien coûte un site ? » C’est souvent la première question, et la réponse honnête est : ça dépend de ce que le site doit faire pour vous. Voici de quoi y voir clair avant de demander des devis.

## Les trois grandes familles de prix

**Le site « fait soi-même » (0 à 30 € par mois).** Les créateurs de sites en ligne permettent de publier quelque chose rapidement. Le coût est faible, mais le temps passé est le vôtre : choix du modèle, rédaction, photos, réglages techniques. Le résultat ressemble souvent à des milliers d’autres sites, et l’abonnement court tant que le site existe.

**Le site vitrine réalisé par un professionnel (quelques centaines à 2 000 € environ).** C’est le cas de la plupart des artisans : 5 à 10 pages qui présentent l’activité, les réalisations, la zone d’intervention et un formulaire de demande de devis. Le design est adapté à votre métier, le site est rapide sur mobile et les bases du référencement sont posées.

**Le site sur mesure avec fonctions avancées (au-delà).** Réservation en ligne, espace client, boutique, catalogue de plusieurs centaines de produits : chaque fonction ajoute du temps de développement et de test.

## Ce qui fait vraiment varier le prix

- **Le nombre de pages.** Une page par service important est utile ; dix pages presque identiques ne le sont pas. Notre article [Site vitrine : combien de pages faut-il vraiment ?](/blog/site-vitrine-combien-de-pages) vous aide à faire le tri.
- **Qui écrit les textes.** Rédiger des textes clairs, qui répondent aux questions des clients et contiennent les bons mots-clés, prend du temps. Si vous les fournissez, le prix baisse ; si le prestataire les rédige, il augmente, mais le résultat est souvent meilleur pour Google.
- **Les photos.** De vraies photos de vos chantiers valent mieux que des images de banque. Prévoyez de photographier vos réalisations dès maintenant.
- **Les fonctions.** Formulaire de devis en plusieurs étapes, galerie filtrable, blog administrable : chacune a un coût.
- **Le référencement local.** Un site bien construit techniquement est une base, mais apparaître dans votre secteur demande aussi une fiche Google soignée et des contenus locaux.

## Exemple concret : nos tarifs

Pour donner des ordres de grandeur réels, voici nos offres (prix hors taxes) :

- **Site Essentiel** : à partir de **690 € HT**, jusqu’à 5 pages, design sur mesure adapté au mobile, formulaire protégé, optimisation technique du référencement, pages légales et formation.
- **Site Business** : à partir de **1 190 € HT**, jusqu’à 10 pages, services détaillés, galerie de réalisations et formulaire de devis en plusieurs étapes.
- **Pack Visibilité** : à partir de **1 390 € HT**, le Site Essentiel avec la fiche Google, un flyer et une carte de visite assortis.

Le détail de chaque offre est sur la page [création de site internet](/creation-site-internet) et sur nos [tarifs](/tarifs).

## Les frais à prévoir après la mise en ligne

Le prix de création n’est pas le seul coût. Chaque année, comptez :

- **le nom de domaine** (votre adresse en .fr) : quelques euros à une vingtaine d’euros par an ;
- **l’hébergement** : de quelques euros à quelques dizaines d’euros par mois selon la solution ;
- **la maintenance**, si vous ne voulez pas vous en occuper : mises à jour de sécurité, sauvegardes, surveillance. Notre offre [maintenance](/maintenance-site-internet) commence à 39 € HT par mois ;
- **le temps** pour ajouter vos nouvelles réalisations : une heure par mois suffit souvent.

## Les pièges à éviter

1. **Le site « gratuit » avec abonnement de 36 mois.** Certaines offres affichent zéro euro de création, puis engagent sur un abonnement élevé pendant plusieurs années. Faites le calcul sur la durée totale.
2. **Le nom de domaine au nom du prestataire.** Il doit être enregistré à votre nom, avec vos propres accès. Sinon, changer de prestataire devient un casse-tête.
3. **La promesse de « première place sur Google ».** Personne ne peut la garantir honnêtement.
4. **Le devis sans détail.** Un bon devis précise le nombre de pages, qui fournit les textes et les photos, le nombre d’allers-retours de corrections et ce qui n’est pas inclus.

## En résumé

Pour un artisan, un site vitrine professionnel se situe le plus souvent entre 700 et 2 000 € HT, plus quelques dizaines d’euros par an pour le domaine et l’hébergement. Le bon budget est celui qui correspond à ce que le site doit vous rapporter : des appels et des demandes de devis.

---

Vous voulez un chiffrage précis pour votre activité ? Décrivez votre projet dans notre [formulaire de devis](/devis) : réponse sous 48 h ouvrées, sans engagement. Pour les métiers du bâtiment, voyez aussi notre page [site internet pour artisans](/creation-site-internet-artisan).`,
  },
  {
    slug: 'communication-fetes-fin-annee-commercants',
    title: 'Commerçants du Pays de Caux : préparer sa communication pour les fêtes',
    category: 'Conseils',
    excerpt: 'Vitrine, fiche Google, flyers, réseaux sociaux : un calendrier simple pour être prêt avant décembre sans y passer ses soirées.',
    meta_description: 'Préparer la communication de fin d’année d’un commerce : calendrier, vitrine, horaires sur Google, flyers et réseaux sociaux. Conseils pour le Pays de Caux.',
    published_at: '2026-11-03T08:00:00.000Z',
    body: `Novembre et décembre représentent une part importante du chiffre d’affaires de nombreux commerces. Pourtant, la communication des fêtes se prépare souvent dans l’urgence, entre deux livraisons. Voici un calendrier réaliste pour un commerce de proximité, à Bolbec, Lillebonne, Fécamp ou ailleurs.

## Début novembre : décider du message

Avant de produire quoi que ce soit, répondez à trois questions :

- **Qu’est-ce que je veux vendre en priorité ?** Coffrets, bons cadeaux, produits de saison, prestations à offrir.
- **À qui ?** Clients habitués, nouveaux habitants, entreprises qui cherchent des cadeaux pour leurs salariés.
- **Qu’est-ce qui change dans mon organisation ?** Horaires élargis, ouvertures exceptionnelles le dimanche, fermeture entre Noël et le jour de l’An, date limite de commande.

Ces réponses donnent le contenu de tous vos supports. Écrivez-les sur une feuille : elle servira de référence pour la vitrine, les flyers, la fiche Google et les réseaux.

## Mi-novembre : commander les supports imprimés

Les imprimeurs sont très sollicités en fin d’année. Pour être tranquille, envoyez vos fichiers **trois à quatre semaines avant la date où vous en avez besoin**, le temps de la création, des corrections, de l’impression et de la livraison.

Les supports les plus utiles pour un commerce :

- **un flyer** pour annoncer les horaires des fêtes, les produits phares et la date limite de commande, à glisser dans chaque sac et à déposer chez les commerçants voisins (voir [flyers et dépliants](/flyers-depliants)) ;
- **des cartes ou bons cadeaux** à votre image, beaucoup plus valorisants qu’un ticket griffonné ;
- **une affiche** pour la vitrine ou le comptoir.

Avant d’envoyer les fichiers, gardez sous la main notre liste des [points à vérifier avant impression](/blog/flyer-points-a-verifier-avant-impression).

## Fin novembre : habiller la vitrine

La vitrine est votre premier support de communication, et elle travaille même quand le magasin est fermé. Pour les fêtes, plusieurs solutions existent :

- **des adhésifs repositionnables ou électrostatiques**, qui se retirent sans laisser de traces en janvier ;
- **un lettrage temporaire** annonçant les horaires exceptionnels ou les produits de saison ;
- **un décor imprimé** cohérent avec vos couleurs habituelles plutôt qu’un assortiment de décorations dépareillées.

Pour une pose avant le premier week-end de décembre, prenez contact début novembre. Nous détaillons les options sur notre page [vitrophanie pour vitrines de commerce](/vitrophanie-vitrine-commerce).

## Dès que vos horaires sont connus : la fiche Google

C’est l’étape la plus oubliée, et la plus agaçante pour les clients : se déplacer et trouver porte close alors que Google indiquait « ouvert ».

Dans votre fiche d’établissement Google, utilisez les **horaires exceptionnels** pour chaque jour qui change : dimanches de décembre, 24 et 31 décembre, jours fériés, congés de début janvier. Ajoutez aussi une **publication** qui annonce vos produits de fêtes, avec une photo de la vitrine ou des coffrets.

## Décembre : publier régulièrement, simplement

Sur les réseaux sociaux, la régularité compte plus que la perfection. Un rythme de deux publications par semaine en décembre suffit :

- une photo des nouveautés ou des coffrets ;
- un rappel de la date limite de commande ;
- les coulisses : préparation des commandes, emballages, équipe ;
- le rappel des horaires exceptionnels la dernière semaine.

Préparez quelques visuels à vos couleurs à l’avance : il ne restera qu’à changer la photo et le texte. Nous pouvons créer ces gabarits pour vous (voir [réseaux sociaux](/reseaux-sociaux)).

## Janvier : remercier et préparer la suite

Profitez du calme de janvier pour :

- **remercier** vos clients sur les réseaux et en magasin ;
- **demander des avis Google** aux clients fidèles, qui sont souvent ravis de rendre service ;
- **retirer les adhésifs de fêtes** et vérifier que votre vitrine habituelle est toujours en bon état ;
- **noter ce qui a marché**, pour faire encore plus simple l’an prochain.

## Le calendrier en un coup d’œil

1. Début novembre : message, produits phares, horaires.
2. Mi-novembre : envoi des fichiers à l’impression.
3. Fin novembre : pose de la vitrine de fêtes.
4. Dès que possible : horaires exceptionnels sur Google.
5. Décembre : deux publications par semaine.
6. Janvier : remerciements, avis, bilan.

---

Vous voulez déléguer tout ou partie de cette préparation ? Nous intervenons dans tout le Pays de Caux, du Havre à Yvetot. Décrivez votre projet sur notre [formulaire de devis](/devis) ou consultez nos [packs pour commerçants](/packs).`,
  },
  {
    slug: 'fiche-google-reglages-pays-de-caux',
    title: 'Fiche Google : 10 réglages pour apparaître sur Google Maps dans le Pays de Caux',
    category: 'Référencement',
    excerpt: 'Catégorie, zone desservie, horaires, photos, publications : les réglages qui font la différence dans les résultats locaux.',
    meta_description: 'Optimiser sa fiche d’établissement Google (Google Business Profile) : 10 réglages concrets pour apparaître sur Google Maps au Havre, à Bolbec ou à Fécamp.',
    published_at: '2026-11-10T08:00:00.000Z',
    body: `Quand quelqu’un tape « plombier Bolbec » ou « fleuriste Lillebonne », Google affiche d’abord une carte avec trois établissements. Pour une entreprise locale, être dans ces trois résultats vaut souvent plus qu’une première place dans les liens classiques. La bonne nouvelle : la fiche d’établissement Google (Google Business Profile) est gratuite, et beaucoup de concurrents la remplissent à moitié.

Voici les dix réglages que nous vérifions en priorité.

## 1. Revendiquer et valider la fiche

Une fiche peut exister sans que vous l’ayez créée. Cherchez le nom de votre entreprise sur Google Maps : si elle apparaît, revendiquez-la ; sinon, créez-la sur business.google.com. Google demande ensuite une validation (vidéo, appel ou courrier selon les cas). Sans validation, vos modifications ne sont pas publiées.

## 2. Choisir la bonne catégorie principale

C’est le réglage le plus important. La catégorie principale doit décrire votre métier, pas ce que vous aimeriez faire : « Plombier », « Électricien », « Salon de coiffure », « Paysagiste ». Ajoutez ensuite quelques catégories secondaires pour vos autres activités réelles, sans en abuser.

## 3. Adresse visible ou zone desservie

Si vous recevez des clients dans un local, affichez l’adresse. Si vous vous déplacez chez eux (artisans du bâtiment, paysagistes, dépanneurs), **masquez l’adresse** et déclarez une **zone desservie** : les communes où vous intervenez vraiment, par exemple Gruchet-le-Valasse, Bolbec, Lillebonne, Saint-Romain-de-Colbosc ou Le Havre.

## 4. Des coordonnées identiques partout

Nom, adresse et téléphone doivent être écrits **exactement de la même façon** sur la fiche, sur votre site, sur vos factures et dans les annuaires. Les incohérences brouillent Google comme les clients. Gardez le vrai nom de votre entreprise : ajouter des mots-clés dans le nom (« Dupont Plomberie pas cher Le Havre ») est contraire aux règles de Google et peut entraîner la suspension de la fiche.

## 5. Des horaires exacts, y compris exceptionnels

Horaires habituels, mais aussi jours fériés, congés et ouvertures exceptionnelles. Un client qui trouve porte close alors que Google indiquait « ouvert » ne revient pas, et le signale parfois dans un avis.

## 6. Une description utile

Vous disposez de 750 caractères. Expliquez ce que vous faites, pour qui, où, et ce qui vous distingue. Écrivez pour un humain : une liste de mots-clés répétés n’aide pas et fait mauvaise impression.

## 7. Les services ou produits

La rubrique services permet de lister vos prestations avec une courte description. C’est l’occasion de mentionner ce que vos clients cherchent vraiment : « remplacement de chauffe-eau », « taille de haies », « coupe enfant ».

## 8. De vraies photos, régulièrement

Logo, photo de couverture, puis surtout **de vraies photos** : vous au travail, votre local, votre véhicule, vos réalisations avant et après. Évitez les images de banque. Ajouter quelques photos chaque mois montre que l’entreprise est active.

## 9. Les publications

Les publications sont de courts messages avec une photo : une réalisation récente, une offre de saison, une actualité. Une publication par semaine ou toutes les deux semaines suffit. Chaque article de votre blog peut devenir une publication avec un lien vers votre site.

## 10. Les avis, et vos réponses

Le nombre, la note et la régularité des avis comptent, tout comme vos réponses. Demandez un avis à chaque client satisfait et répondez à tous, y compris aux critiques. Nous y consacrons un article complet : [comment obtenir des avis Google sans les acheter](/blog/obtenir-avis-google-sans-les-acheter).

## Et le site internet dans tout ça ?

La fiche et le site travaillent ensemble. Le lien vers votre site doit figurer sur la fiche, et votre site doit reprendre les mêmes coordonnées, mentionner les communes où vous intervenez et détailler vos services. Google croise les deux.

## Ce qu’il ne faut pas faire

- créer plusieurs fiches pour la même entreprise, une par ville ;
- déclarer une fausse adresse (domiciliation, boîte postale) pour apparaître dans une commune ;
- acheter des avis ou en écrire soi-même ;
- changer de nom ou de catégorie toutes les semaines.

## Combien de temps avant de voir des résultats ?

Une fiche bien remplie peut progresser en quelques semaines, mais la concurrence, la distance avec la personne qui cherche et le nombre d’avis jouent beaucoup. C’est un travail régulier plutôt qu’un réglage unique.

---

Vous préférez qu’on s’en occupe ? La création ou l’optimisation de la fiche est incluse dans notre Pack Visibilité, et suivie chaque mois dans notre [accompagnement SEO local](/referencement-local-artisan). Pour démarrer, demandez un [devis gratuit](/devis).`,
  },
  {
    slug: 'obtenir-avis-google-sans-les-acheter',
    title: 'Comment obtenir des avis Google sans les acheter ?',
    category: 'Référencement',
    excerpt: 'Quand demander, comment demander, comment répondre : une méthode simple et légale pour récolter des avis réguliers.',
    meta_description: 'Obtenir plus d’avis Google pour une petite entreprise : quand et comment les demander, répondre aux avis négatifs, ce qui est interdit.',
    published_at: '2026-11-17T08:00:00.000Z',
    body: `Avant d’appeler une entreprise qu’il ne connaît pas, un client regarde ses avis. Une note correcte, des avis récents et des réponses du gérant rassurent. Pourtant, beaucoup de petites entreprises ont deux ou trois avis seulement, alors que leurs clients sont satisfaits. La raison est simple : personne ne leur a demandé.

## Ce qui est interdit (et pourquoi c’est risqué)

Commençons par ce qu’il ne faut jamais faire :

- **acheter des avis**, ou payer une plateforme qui en « génère » ;
- **écrire des avis soi-même**, ou les faire écrire par des proches qui ne sont pas clients ;
- **offrir une contrepartie** (remise, cadeau, participation à un tirage au sort) en échange d’un avis ;
- **ne solliciter que les clients contents** en filtrant à l’avance ceux qui risquent d’être critiques.

Ces pratiques sont contraires aux règles de Google, qui peut supprimer les avis, afficher un avertissement sur la fiche, voire la suspendre. En France, les faux avis relèvent aussi des pratiques commerciales trompeuses sanctionnées par le Code de la consommation. Le jeu n’en vaut pas la chandelle.

## Le bon moment pour demander

Le meilleur moment, c’est **quand le client vient d’exprimer sa satisfaction** : à la fin d’un chantier, à la livraison d’une commande, quand il vous remercie au téléphone. Plus vous attendez, moins il pense à le faire.

## La bonne façon de demander

Simplement, directement, à l’oral d’abord :

> « Ça m’aiderait beaucoup si vous laissiez un petit avis sur Google. Je vous envoie le lien par SMS, ça prend une minute. »

Puis envoyez **le lien direct** vers le formulaire d’avis. Vous le trouvez dans votre fiche Google, rubrique « Demander des avis ». Ce lien évite au client de chercher votre fiche, ce qui fait abandonner beaucoup de gens.

Vous pouvez aussi placer ce lien :

- dans la signature de vos e-mails ;
- sur la facture ou le message de fin de chantier ;
- sur une carte de remerciement remise en main propre, avec un **QR code** ;
- sur un petit adhésif près de la caisse, pour un commerce.

## Un rythme plutôt qu’une campagne

Dix avis la même semaine, puis plus rien pendant un an, paraît moins naturel qu’un avis de temps en temps, chaque mois. Prenez l’habitude de demander à **chaque** client satisfait, sans exception. Au bout d’un an, la différence est nette.

## Répondre à tous les avis

Répondre montre que l’entreprise est présente et attentive. Pour un avis positif, quelques mots personnalisés suffisent : remerciez, rappelez le type de travaux, souhaitez une bonne continuation.

Pour un avis négatif :

1. **ne répondez pas à chaud** : attendez le lendemain ;
2. **remerciez** pour le retour, même s’il est injuste ;
3. **expliquez factuellement**, sans vous justifier longuement ni révéler d’informations privées ;
4. **proposez une solution** ou un échange par téléphone.

Votre réponse est lue par les futurs clients bien plus que par l’auteur de l’avis. Une réponse calme et professionnelle à une critique rassure souvent davantage qu’une série d’avis parfaits.

## Et si un avis est faux ou injurieux ?

Si un avis ne respecte pas les règles de Google (propos injurieux, avis d’un concurrent, personne qui n’a jamais été client), vous pouvez le **signaler** depuis votre fiche. Google l’examine, sans garantie de suppression. En attendant, répondez sobrement.

## Les avis et le référencement local

Le nombre d’avis, leur note et leur régularité font partie des éléments que Google prend en compte pour classer les entreprises locales. Mais leur premier rôle reste de convaincre : entre deux artisans à égale distance, le client choisit souvent celui dont les avis décrivent des travaux proches des siens.

Pour le reste des réglages de votre fiche, voir notre article [Fiche Google : 10 réglages pour apparaître sur Google Maps](/blog/fiche-google-reglages-pays-de-caux).

## La méthode en résumé

1. Récupérez le lien direct de demande d’avis.
2. Demandez à l’oral, au bon moment, puis envoyez le lien.
3. Placez le lien et un QR code sur vos supports.
4. Demandez à chaque client, chaque mois.
5. Répondez à tous les avis, calmement.

---

Nous pouvons créer une carte de remerciement avec QR code à vos couleurs, ou intégrer la demande d’avis dans votre suivi client : voir nos [cartes de visite](/cartes-de-visite) et notre [référencement local pour artisans](/referencement-local-artisan).`,
  },
  {
    slug: 'vitrophanie-quel-adhesif-choisir',
    title: 'Vitrophanie : quel adhésif choisir pour sa vitrine (et combien de temps ça tient) ?',
    category: 'Vitrophanie & signalétique',
    excerpt: 'Lettrage découpé, impression, microperforé, dépoli, électrostatique : les différents adhésifs et leur durée de vie, pour choisir sans se tromper.',
    meta_description: 'Vitrophanie : différences entre vinyle monomère, polymère et coulé, microperforé, dépoli. Durée de vie, pose intérieure ou extérieure, réglementation.',
    published_at: '2026-11-24T08:00:00.000Z',
    body: `Une vitrine bien habillée attire l’œil, annonce vos horaires et votre activité, et travaille jour et nuit. Mais derrière le mot « vitrophanie » se cachent des matériaux très différents. Le bon choix dépend de ce que vous voulez afficher, pendant combien de temps, et de l’exposition de votre vitrine.

## Les grandes familles d’adhésifs

### Le lettrage découpé

Des lettres et logos découpés dans un vinyle de couleur unie : nom du commerce, horaires, téléphone, site internet. C’est la solution la plus classique et la plus lisible. Le rendu est net, sans fond, et la vitrine reste transparente autour des lettres.

### L’adhésif imprimé

Pour une photo, un dégradé ou un visuel en plusieurs couleurs. L’impression est souvent protégée par un film de lamination, qui limite les rayures et la décoloration au soleil.

### Le microperforé

Un adhésif percé de petits trous : de l’extérieur, on voit le visuel ; de l’intérieur, on voit encore la rue. Il permet d’habiller toute une vitrine sans s’enfermer. En contrepartie, l’image est un peu moins éclatante et la vue vers l’extérieur légèrement assombrie.

### Le dépoli (effet verre sablé)

Il imite le verre sablé. Idéal pour préserver l’intimité (cabinet, salon de soins, bureau) tout en laissant passer la lumière. On peut y découper un logo ou des motifs.

### L’électrostatique et le repositionnable

Ils tiennent sans colle, ou avec une colle très légère, et se retirent sans trace. Parfaits pour une décoration de saison ou une promotion temporaire.

## Monomère, polymère, coulé : la question de la durée

Les vinyles se distinguent aussi par leur fabrication, qui détermine leur stabilité dans le temps :

- **le vinyle monomère** : économique, adapté aux usages courts (promotion, événement) ; il peut se rétracter et se décoller sur les bords avec le temps ;
- **le vinyle polymère** : plus stable, c’est le choix courant pour une vitrine permanente ;
- **le vinyle coulé** : le plus stable et le plus souple, utilisé pour les applications longues et les surfaces difficiles.

À titre d’ordre de grandeur, un monomère convient pour quelques mois à un ou deux ans, un polymère pour plusieurs années, un coulé pour les durées les plus longues. Les durées réelles dépendent du fabricant, de l’orientation de la vitrine (plein sud ou non), de la pose intérieure ou extérieure et de l’entretien. Méfiez-vous des promesses chiffrées sans précision sur le matériau.

## Pose intérieure ou extérieure ?

- **À l’intérieur**, l’adhésif est protégé de la pluie, du nettoyage et des dégradations. Le visuel est imprimé « en miroir » pour être lu de l’extérieur. C’est souvent le meilleur choix pour la durée.
- **À l’extérieur**, les couleurs sont plus franches (pas de reflet du verre), mais l’adhésif est exposé aux intempéries et aux grattages.

## Les questions à se poser avant de commander

1. **Que doit lire un passant en trois secondes ?** Le nom et l’activité d’abord, puis les horaires et le téléphone.
2. **Combien de temps doit tenir la vitrophanie ?** Une saison ou plusieurs années.
3. **Faut-il préserver la vue ou l’intimité ?** Microperforé ou dépoli selon le cas.
4. **La vitrine est-elle très exposée au soleil ?** Cela oriente vers un matériau plus résistant et une lamination.
5. **Êtes-vous locataire ?** Vérifiez ce que prévoit votre bail et prévoyez un adhésif qui se retire proprement.

## Et la réglementation ?

Une inscription posée sur la vitrine et qui signale votre activité peut être considérée comme une **enseigne**. Dans de nombreuses communes, notamment celles qui ont un règlement local de publicité, ou près de monuments historiques, une autorisation préalable de la mairie est nécessaire. Renseignez-vous auprès du service urbanisme avant la pose : c’est rapide et cela évite une dépose forcée.

## Entretien

Nettoyez avec une eau savonneuse douce et une raclette souple, sans produit abrasif ni grattoir sur les bords. Évitez le nettoyeur haute pression sur un adhésif posé à l’extérieur.

## Combien ça coûte ?

Le prix dépend de la surface, du matériau, de l’impression éventuelle et de la pose. Un simple lettrage horaires et téléphone coûte bien moins qu’une vitrine entièrement habillée en microperforé. Le plus fiable est de partir de photos et de mesures de votre vitrine.

---

Nous concevons et posons la vitrophanie dans tout le Pays de Caux. Envoyez quelques photos de votre vitrine sur notre page [devis vitrophanie et signalétique](/devis-vitrophanie-signaletique) : nous revenons vers vous avec une proposition de maquette. Plus d’informations sur [vitrophanie et signalétique](/vitrophanie-signaletique).`,
  },
  {
    slug: 'flyer-ou-depliant-que-choisir',
    title: 'Flyer ou dépliant : lequel choisir pour faire connaître son entreprise ?',
    category: 'Impression',
    excerpt: 'Formats, contenu, distribution et budget : comment choisir entre un flyer et un dépliant selon ce que vous voulez dire.',
    meta_description: 'Flyer ou dépliant ? Différences, formats courants (A5, A6, 3 volets), quel contenu mettre, distribution et budget pour une petite entreprise.',
    published_at: '2026-12-01T08:00:00.000Z',
    body: `Flyer, prospectus, tract, dépliant, plaquette : les mots se mélangent. Pourtant, choisir le bon support change beaucoup, à la fois pour le budget et pour l’efficacité. La question à se poser est simple : **avez-vous un message à faire passer, ou une offre à expliquer ?**

## Le flyer : un message, une action

Le flyer est une feuille simple, imprimée en recto ou en recto-verso. Les formats les plus courants sont l’**A6** (105 × 148 mm), l’**A5** (148 × 210 mm) et le format long type DL (environ 99 × 210 mm).

Il sert à faire passer **un message court** et à déclencher **une action** :

- l’ouverture d’un commerce ;
- une offre de saison ;
- un événement (portes ouvertes, salon, marché) ;
- un rappel de vos services avec votre numéro, pour les boîtes aux lettres.

Un bon flyer se lit en quelques secondes : un titre fort, une image, deux ou trois arguments, et **une seule** action claire (appeler, venir, scanner un QR code).

## Le dépliant : expliquer et rassurer

Le dépliant est une feuille pliée qui forme plusieurs volets. Le plus courant est l’**A4 plié en trois** (format fini proche du DL), mais il existe aussi des plis en deux, en accordéon ou roulés.

Il permet de **présenter une offre complète** :

- la liste de vos prestations avec leurs détails ;
- vos tarifs ou vos formules ;
- votre méthode de travail, vos garanties, vos qualifications ;
- quelques réalisations, une carte de votre zone d’intervention.

C’est un support qu’on garde : le client le range dans un tiroir et le ressort au moment de faire appel à vous. Il convient bien aux artisans, aux prestataires de services et aux structures qui ont plusieurs activités.

## Comment choisir ?

- **Annoncer une ouverture ou une offre** : flyer.
- **Distribuer en grand nombre en boîtes aux lettres** : flyer.
- **Présenter toutes vos prestations** : dépliant.
- **Laisser un document après un rendez-vous ou avec un devis** : dépliant.
- **Poser sur un comptoir** : les deux.

En pratique, beaucoup d’entreprises ont besoin des deux : un dépliant de présentation durable, et des flyers ponctuels pour les opérations.

## Le contenu : ce qu’on oublie souvent

- **Vos coordonnées complètes**, identiques à celles du site et de la fiche Google.
- **Votre zone d’intervention** : « Bolbec, Lillebonne et alentours » rassure un client local.
- **Un QR code** vers votre site, votre fiche Google ou votre formulaire de devis.
- **Une date de validité** pour toute offre promotionnelle.
- **Une relecture par une autre personne** : un numéro de téléphone faux annule toute la campagne.

Avant l’impression, passez par notre liste des [points à vérifier sur un flyer](/blog/flyer-points-a-verifier-avant-impression).

## La distribution

Un support bien conçu mais mal distribué ne sert à rien. Quelques pistes :

- **en main propre**, sur les marchés, les salons, à la sortie d’un chantier : le contact humain double l’impact ;
- **chez les commerçants partenaires**, avec leur accord ;
- **en boîtes aux lettres**, en respectant les autocollants « Stop Pub » ;
- **avec chaque commande ou chaque devis**.

Ciblez les quartiers ou les communes où vous voulez vraiment travailler, plutôt que de distribuer au hasard.

## Le papier et la finition

Pour un flyer distribué en grand nombre, un papier de grammage moyen suffit. Pour un dépliant ou un flyer qu’on veut garder, un papier plus épais et une finition mate ou satinée donnent une impression de qualité. Un papier recyclé est aussi un message en soi.

## Et le budget ?

Le coût se décompose en trois parties : la **création graphique**, l’**impression** (qui dépend fortement de la quantité) et la **livraison**. Chez nous, la création d’un flyer est à **69 € HT**, et le pack flyer + carte de visite à **99 € HT** ; le dépliant est sur devis selon le nombre de volets. Vous pouvez estimer l’impression avec notre [configurateur](/configurateur).

---

Vous hésitez encore ? Décrivez votre activité et votre objectif dans notre [formulaire de devis](/devis), nous vous conseillerons le support adapté. Voir aussi [flyers et dépliants](/flyers-depliants) et nos [impressions](/impression).`,
  },
  {
    slug: 'logo-soi-meme-ou-graphiste',
    title: 'Créer son logo soi-même ou passer par un graphiste : ce que ça change vraiment',
    category: 'Identité visuelle',
    excerpt: 'Générateurs en ligne, modèles gratuits, intelligence artificielle ou graphiste : avantages, limites et pièges juridiques à connaître.',
    meta_description: 'Faire son logo soi-même ou avec un graphiste ? Comparatif honnête : coût, qualité, droits d’utilisation, dépôt de marque à l’INPI, fichiers à récupérer.',
    published_at: '2026-12-08T08:00:00.000Z',
    body: `Quand on se lance, le logo arrive vite dans la liste des choses à faire. Et la tentation est grande de le régler en une soirée avec un outil en ligne. Parfois, c’est une bonne solution de départ. Souvent, cela coûte plus cher plus tard. Voici de quoi décider en connaissance de cause.

## Les solutions « faites maison »

### Les modèles d’outils de mise en page

Les outils de création en ligne proposent des milliers de modèles de logos. On choisit, on change le nom, on télécharge. C’est rapide et gratuit ou presque.

Les limites :

- **votre logo ressemble à celui d’autres entreprises** qui ont choisi le même modèle, parfois dans le même métier ;
- **les droits sont limités** : les licences de ces outils interdisent généralement de déposer comme marque un logo construit à partir de leurs éléments de bibliothèque. Lisez les conditions avant de vous engager ;
- **les fichiers fournis** ne sont pas toujours adaptés à l’impression grand format, à la broderie ou au marquage d’un véhicule.

### Les générateurs automatiques et l’intelligence artificielle

Ils produisent des propositions en quelques secondes. Utiles pour explorer des pistes, ils donnent rarement un résultat directement exploitable : détails illisibles en petit, textes déformés, image impossible à vectoriser proprement, et questions ouvertes sur l’originalité et les droits.

## Ce qu’apporte un graphiste

Un graphiste ne se contente pas de « dessiner joli ». Son travail commence par des questions :

- Qui sont vos clients ? Que doivent-ils ressentir ?
- Qui sont vos concurrents, et comment vous en distinguer ?
- Où le logo sera-t-il utilisé : enseigne, véhicule, vêtements, réseaux sociaux, tampon ?

Il livre ensuite un logo **pensé pour tous ces usages** :

- une **version couleur**, une **version monochrome** et une **icône** pour les petits formats (favicon, photo de profil) ;
- une **palette de couleurs** et des **typographies** cohérentes ;
- des **fichiers vectoriels** (SVG, PDF) qui s’agrandissent sans perte, indispensables pour un véhicule ou une enseigne.

## La question des droits

C’est le point le plus sous-estimé. Un logo est une œuvre : celui qui l’a créé détient des droits d’auteur. Pour l’utiliser librement, vous avez besoin d’une **cession des droits d’exploitation** écrite, qui précise les usages, la durée et le territoire. Un graphiste sérieux la prévoit dans son devis ou ses conditions générales.

Ensuite, si vous voulez protéger votre nom et votre logo contre un concurrent, il faut **déposer une marque**. En France, le dépôt se fait à l’INPI ; le dépôt en ligne coûte 190 € pour une classe de produits ou services, plus un supplément par classe supplémentaire (vérifiez les tarifs à jour sur le site de l’INPI). Avant le dépôt, faites une recherche d’antériorité : un nom déjà déposé dans votre secteur peut vous obliger à tout changer.

## Combien coûte un logo professionnel ?

Les écarts sont énormes, de quelques dizaines à plusieurs milliers d’euros. Pour une petite entreprise locale, une identité simple et bien faite est accessible. Notre offre **Identité visuelle simple** est à **199 € HT** : questionnaire de marque, deux pistes de logo, trois séries de corrections, logo final en couleur, monochrome et icône, palette, typographies, et fichiers SVG, PNG et PDF. La cession des droits d’exploitation est prévue dans nos conditions générales.

## Comment savoir si votre logo actuel fait l’affaire ?

Faites ces quatre tests :

1. **En très petit** (2 cm de large) : le logo reste-t-il lisible ?
2. **En noir et blanc** : fonctionne-t-il sans couleur ?
3. **De loin** : sur un véhicule à 20 mètres, comprend-on le nom ?
4. **À côté des concurrents** : se distingue-t-il ?

S’il passe ces tests et que vous en possédez les fichiers vectoriels et les droits, inutile de le changer. Sinon, mieux vaut le refaire **avant** de l’imprimer sur un véhicule, une enseigne et mille cartes de visite.

## Notre conseil

- Vous testez une activité, sans enseigne ni véhicule : un logo simple fait vous-même peut suffire quelques mois.
- Vous vous installez pour durer, avec véhicule, vitrine ou site : investissez dans une identité professionnelle dès le départ. Refaire tous les supports plus tard coûte bien plus cher que le logo lui-même.

---

Découvrez notre offre [identité visuelle et logo](/identite-visuelle-logo), ou demandez un [devis](/devis). Pour les entreprises qui démarrent, nos [packs « Bien démarrer »](/packs) regroupent logo, cartes de visite et premiers supports.`,
  },
  {
    slug: 'site-absent-de-google-pourquoi',
    title: 'Pourquoi votre site n’apparaît pas sur Google (et comment le vérifier)',
    category: 'Référencement',
    excerpt: 'Site trop récent, page bloquée, contenu trop léger, concurrence : les causes les plus fréquentes et les vérifications à faire vous-même.',
    meta_description: 'Votre site n’apparaît pas sur Google ? Les causes fréquentes (indexation, noindex, contenu, concurrence) et les vérifications simples avec la Search Console.',
    published_at: '2026-12-15T08:00:00.000Z',
    body: `Vous avez un site, mais quand vous tapez votre métier et votre ville, il n’apparaît nulle part. C’est l’une des frustrations les plus fréquentes chez les petites entreprises. Avant de tout refaire, il faut distinguer deux situations très différentes : **le site n’est pas du tout dans Google**, ou **il y est, mais trop loin** dans les résultats.

## Première vérification : le site est-il indexé ?

Tapez dans Google : \`site:votredomaine.fr\` (en remplaçant par votre adresse, sans « www » ni « https »).

- **Aucun résultat** : Google ne connaît pas votre site, ou n’a pas le droit de l’afficher. C’est un problème technique, souvent simple à corriger.
- **Des résultats** : le site est indexé. Le problème est alors son **classement**, ce qui demande un travail de fond.

## Si le site n’est pas indexé

### Il est tout récent

Un nouveau site, sur un nouveau nom de domaine, peut mettre plusieurs jours à quelques semaines avant d’apparaître. Vous pouvez accélérer les choses en le déclarant dans la **Google Search Console** et en y envoyant votre **sitemap** (le plan du site destiné aux moteurs).

### Il est bloqué par une consigne technique

Pendant la construction, beaucoup de sites sont volontairement cachés aux moteurs. Si personne n’a retiré cette consigne à la mise en ligne, Google respecte l’interdiction. Les coupables habituels :

- une balise \`noindex\` dans les pages ;
- un fichier \`robots.txt\` qui bloque tout le site ;
- une case « demander aux moteurs de ne pas indexer ce site » restée cochée dans l’outil de gestion ;
- un site protégé par un mot de passe.

La Search Console signale ces blocages dans le rapport d’indexation des pages.

### Aucun lien ne mène au site

Google découvre les sites en suivant des liens. Ajoutez votre site sur votre **fiche d’établissement Google**, vos réseaux sociaux et les annuaires où vous êtes inscrit.

## Si le site est indexé mais mal classé

### Les pages ne disent pas clairement ce que vous faites, ni où

Une page d’accueil qui annonce « Bienvenue sur notre site » et « Qualité et savoir-faire » ne dit pas à Google que vous êtes couvreur à Lillebonne. Chaque page importante doit avoir un **titre précis**, mentionner votre **métier**, vos **services** et votre **zone d’intervention**, avec de vrais paragraphes de texte.

### Le contenu est trop léger

Trois lignes par page et une galerie de photos sans légende donnent peu d’éléments à comprendre. Décrivez vos prestations, vos méthodes, vos délais, les questions que posent vos clients. Pour savoir combien de pages prévoir, voir [Site vitrine : combien de pages faut-il vraiment ?](/blog/site-vitrine-combien-de-pages).

### Le site est lent ou difficile à utiliser sur mobile

La majorité des recherches locales se font sur téléphone. Un site lent ou illisible sur mobile perd des visiteurs, et Google en tient compte.

### La concurrence est forte

Sur une recherche comme « agence immobilière Le Havre », des dizaines d’entreprises se battent pour les mêmes places, souvent depuis des années. Viser des recherches plus précises (« rénovation de salle de bains à Bolbec ») donne des résultats plus rapides.

### La fiche Google n’est pas travaillée

Pour les recherches locales, la carte avec trois établissements passe souvent **avant** les sites. Sans fiche optimisée, vous laissez cette place aux concurrents. Voir notre article sur [les 10 réglages de la fiche Google](/blog/fiche-google-reglages-pays-de-caux).

## Mettre en place la Google Search Console

C’est l’outil gratuit de Google pour suivre votre site. Il vous montre :

- les pages indexées, et les raisons pour lesquelles certaines ne le sont pas ;
- les recherches qui affichent votre site, avec le nombre d’affichages et de clics ;
- les problèmes d’utilisation sur mobile et les erreurs techniques.

La mise en place prend quelques minutes : déclarer le domaine, valider la propriété, envoyer le sitemap.

## Ce qu’il ne faut pas faire

- répéter vos mots-clés en boucle dans les textes ;
- acheter des liens en masse ;
- créer une page presque identique pour chaque commune voisine ;
- croire une offre qui « garantit la première place ».

## Combien de temps pour progresser ?

Un blocage technique se corrige en un jour, et l’effet se voit en quelques semaines. Améliorer un classement prend généralement plusieurs mois de travail régulier : contenus, fiche Google, avis, liens locaux.

---

Vous voulez un diagnostic ? Nous vérifions l’indexation, les blocages techniques et les contenus de votre site dans notre [accompagnement référencement](/referencement-seo). Si le site est à reprendre, voyez notre offre de [refonte de site](/refonte-site-internet), conçue pour ne pas perdre la visibilité existante.`,
  },
  {
    slug: 'nom-de-domaine-email-professionnel-artisan',
    title: 'Nom de domaine et adresse e-mail professionnelle : le guide pour les artisans',
    category: 'Sites internet',
    excerpt: 'Choisir son adresse en .fr, l’enregistrer à son nom, créer une adresse contact@ : les étapes et les pièges à éviter.',
    meta_description: 'Choisir et enregistrer son nom de domaine .fr, créer une adresse e-mail professionnelle : guide simple pour artisans et commerçants, pièges à éviter.',
    published_at: '2026-12-22T08:00:00.000Z',
    body: `Une adresse e-mail en « @gmail.com » ou « @orange.fr » fonctionne, mais elle ne fait pas le même effet qu’une adresse « contact@votre-entreprise.fr ». Le nom de domaine, c’est l’adresse de votre site et de vos e-mails. Il coûte peu, mais il se choisit et se gère avec soin, car il vous suivra pendant des années.

## Qu’est-ce qu’un nom de domaine ?

C’est l’adresse que l’on tape pour accéder à votre site : \`votre-entreprise.fr\`. Il se compose d’un **nom** (votre-entreprise) et d’une **extension** (.fr, .com, .bzh…). On ne l’achète pas définitivement : on le **loue**, en général à l’année, auprès d’un **bureau d’enregistrement** (registrar).

## Bien choisir son nom

- **Reprenez le nom de votre entreprise.** C’est ce que vos clients chercheront.
- **Faites court et simple à dicter.** Imaginez-vous l’épeler au téléphone : évitez les doubles lettres ambiguës, les chiffres et les orthographes inhabituelles.
- **Pas besoin de mots-clés.** Mettre « plombier-le-havre » dans l’adresse n’apporte presque rien au référencement aujourd’hui, et vous enferme si vous changez de secteur.
- **Le tiret est permis,** et peut aider à la lecture (\`signe-et-seine.fr\`), mais il complique la dictée. Si vous hésitez, réservez les deux versions.

## Quelle extension ?

Pour une entreprise qui travaille en France, le **.fr** est le choix naturel : il est reconnu et inspire confiance. Le .com reste utile si vous visez l’international, ou pour protéger votre nom. Les extensions régionales existent, mais elles sont moins connues du grand public.

## Vérifier avant de réserver

1. **La disponibilité** du nom, chez n’importe quel bureau d’enregistrement.
2. **Les marques existantes** : un nom de domaine peut porter atteinte à une marque déposée. Une recherche sur la base de l’INPI évite les mauvaises surprises.
3. **Les réseaux sociaux** : le même nom est-il libre sur les plateformes que vous utiliserez ?

## Le piège n°1 : un domaine qui n’est pas à votre nom

C’est l’erreur la plus fréquente, et la plus coûteuse. Un prestataire enregistre le domaine **à son nom** pour vous « simplifier la vie ». Le jour où vous voulez changer de prestataire, récupérer le domaine devient compliqué, voire impossible.

La règle : **le titulaire du domaine doit être votre entreprise**, et vous devez disposer des **accès au compte** du bureau d’enregistrement. Chez nous, c’est le cas pour chaque client : le domaine est enregistré à votre nom.

## Le piège n°2 : laisser expirer le domaine

Un domaine non renouvelé est désactivé : le site et les e-mails cessent de fonctionner. Après un délai, il peut être racheté par quelqu’un d’autre. Activez le **renouvellement automatique** et vérifiez que l’adresse e-mail de contact du compte est une adresse que vous consultez.

## Créer son adresse e-mail professionnelle

Avec un nom de domaine, vous pouvez créer des adresses comme \`contact@\`, \`devis@\` ou \`prenom@\`. Plusieurs solutions existent :

- **la messagerie incluse** dans certaines offres de bureau d’enregistrement ou d’hébergement : économique, suffisante pour démarrer ;
- **les suites bureautiques en ligne** des grands éditeurs : messagerie, agenda et stockage partagés, sur abonnement mensuel par utilisateur.

Dans tous les cas, vous pourrez consulter vos e-mails sur votre téléphone, comme aujourd’hui.

## Les réglages qui évitent les spams

Pour que vos devis n’arrivent pas dans les indésirables de vos clients, trois réglages techniques doivent être faits sur le domaine : **SPF**, **DKIM** et **DMARC**. Ils prouvent que les e-mails envoyés à votre nom viennent bien de vous. Votre prestataire ou votre fournisseur de messagerie vous guide ; c’est une opération de quelques minutes, à faire une seule fois.

## Combien ça coûte ?

- **Le domaine** : de quelques euros à une vingtaine d’euros par an pour un .fr, selon le bureau d’enregistrement.
- **La messagerie** : parfois incluse, sinon quelques euros par mois et par adresse.

C’est l’un des investissements les plus rentables pour votre image.

## Et ensuite ?

Une fois le domaine réservé, utilisez-le **partout** de la même façon : site, e-mails, fiche Google, cartes de visite, véhicule, devis et factures. La cohérence de vos coordonnées compte pour les clients comme pour Google (voir [Visibilité locale : par où commencer ?](/blog/visibilite-locale-par-ou-commencer)).

---

Nous pouvons vous accompagner dans la réservation du domaine et la création de vos adresses, en même temps que votre site : voir [création de site internet](/creation-site-internet) ou demandez un [devis](/devis).`,
  },
  {
    slug: 'cartes-de-visite-bien-choisir',
    title: 'Cartes de visite : papier, finitions, quantité… comment bien choisir',
    category: 'Impression',
    excerpt: 'Format, grammage, pelliculage, QR code, contenu : tout ce qu’il faut savoir pour commander des cartes de visite qui donnent envie de vous appeler.',
    meta_description: 'Bien choisir ses cartes de visite : format 85 × 55 mm, grammage, finitions (mat, soft touch, vernis), contenu, QR code et quantité à commander.',
    published_at: '2026-12-29T08:00:00.000Z',
    body: `À l’heure du téléphone, la carte de visite reste un réflexe pour beaucoup de clients, surtout dans l’artisanat et le commerce. Elle se glisse dans un portefeuille, se colle sur le frigo, se transmet à un voisin. Encore faut-il qu’elle donne une bonne image et qu’on y trouve vite l’information.

## Le format

En France, le format standard est le **85 × 55 mm**. C’est celui qui rentre dans les porte-cartes et les portefeuilles. Les formats carrés ou à coins arrondis se remarquent davantage, mais se rangent moins bien : à réserver aux métiers créatifs ou à une image très affirmée.

## Le papier

Le papier fait une grande partie de l’impression générale. Une carte trop fine paraît bon marché.

- **Autour de 350 g/m²** : le standard, rigide et agréable en main.
- **Papiers plus épais** : effet haut de gamme, apprécié pour les métiers de conseil, l’artisanat d’art ou le luxe.
- **Papiers recyclés ou texturés** : une touche naturelle qui convient bien aux paysagistes, aux producteurs ou aux métiers du bois.

## Les finitions

- **Le pelliculage mat** : sobre, protège des traces et de l’usure ; c’est le choix le plus courant.
- **Le pelliculage brillant** : couleurs vives, mais reflets et traces de doigts plus visibles.
- **Le toucher velours (soft touch)** : un effet doux qu’on remarque en prenant la carte.
- **Le vernis sélectif** : brillance sur une partie seulement, par exemple le logo.
- **La dorure** : à réserver à une image haut de gamme, avec modération.

Une finition n’est pas une obligation : un beau papier mat bien imprimé suffit souvent.

## Le contenu : l’essentiel, lisible

Au recto :

- votre **logo** et le **nom de l’entreprise** ;
- votre **nom** et votre **fonction** ;
- votre **activité** en quelques mots, si le nom ne la dit pas (« Plomberie – chauffage ») ;

Au verso, ou sous le nom :

- le **téléphone** (en gros : c’est l’information la plus utilisée) ;
- l’**e-mail** et le **site internet** ;
- l’**adresse** ou la **zone d’intervention** ;
- éventuellement un **QR code**.

Utilisez une taille de texte suffisante : en dessous de 7 points, beaucoup de gens ne lisent plus sans lunettes.

## Le QR code : vers où ?

Un QR code doit mener quelque part d’utile :

- votre **site** ou une page précise (vos réalisations, votre formulaire de devis) ;
- votre **fiche Google**, pour l’itinéraire ou… un avis ;
- un **fichier contact** qui s’enregistre directement dans le téléphone.

Testez-le avec plusieurs téléphones avant l’impression, et prévoyez une taille d’au moins 2 cm.

## Combien en commander ?

Le prix unitaire baisse fortement avec la quantité, mais une carte avec des informations périmées finit à la poubelle. En pratique :

- **250 cartes** pour démarrer ou si vos coordonnées risquent de changer ;
- **500 à 1 000 cartes** pour une activité installée, qui en distribue à chaque intervention.

Pensez aussi à une version par collaborateur : seuls le nom, la fonction et le numéro changent.

## Les erreurs fréquentes

1. Un numéro de téléphone ou une adresse e-mail avec une faute de frappe.
2. Des informations différentes de celles du site ou de la fiche Google.
3. Un logo pixelisé, récupéré sur une capture d’écran.
4. Des textes trop près du bord, coupés à la découpe.
5. Trop d’informations : la carte devient illisible.

Notre liste des [points à vérifier avant impression](/blog/flyer-points-a-verifier-avant-impression) s’applique aussi aux cartes de visite.

## Budget

La création d’une carte de visite personnalisée est à **49 € HT** chez nous, et le pack flyer + carte de visite à **99 € HT**. L’impression est chiffrée à part, selon le papier, la finition et la quantité : vous pouvez l’estimer avec notre [configurateur](/configurateur).

---

Voir notre page [cartes de visite](/cartes-de-visite), ou demandez un [devis](/devis). Si vous n’avez pas encore de logo, commencez par notre offre [identité visuelle](/identite-visuelle-logo) : vos cartes seront déclinées directement.`,
  },
  {
    slug: 'marquage-vehicule-utilitaire-artisan',
    title: 'Marquage de véhicule utilitaire : prix, durée de vie et règles à respecter',
    category: 'Vitrophanie & signalétique',
    excerpt: 'Lettrage, covering partiel ou complet, magnets : les options pour transformer votre utilitaire en support publicitaire, et ce que dit la réglementation.',
    meta_description: 'Marquage de véhicule utilitaire pour artisan : lettrage, covering, magnets, durée de vie, vitres, règles du Code de la route. Conseils pour un marquage lisible.',
    published_at: '2027-01-05T08:00:00.000Z',
    body: `Votre utilitaire passe des heures sur les routes du Pays de Caux et reste garé devant les chantiers de vos clients. C’est un panneau publicitaire mobile, vu par des milliers de personnes chaque mois. Encore faut-il qu’il soit lisible, durable et conforme.

## Les différentes options

### Le lettrage simple

Des lettres et un logo découpés dans un vinyle de couleur, posés sur la carrosserie : nom de l’entreprise, métier, téléphone, site internet. C’est la solution la plus économique, et souvent la plus efficace si elle est bien pensée.

### Le marquage partiel

Un visuel imprimé qui couvre une partie du véhicule (flancs, arrière), combiné au lettrage. Il permet d’ajouter une photo, des couleurs fortes, une identité plus marquée.

### Le covering complet

Le véhicule est entièrement habillé d’un film imprimé ou de couleur. L’impact est maximal, mais c’est la solution la plus coûteuse, et elle demande un véhicule en bon état de carrosserie.

### Les magnets

Des panneaux aimantés amovibles, à poser sur les portières. Pratiques pour un véhicule personnel utilisé aussi pour le travail, ou un véhicule de location. Ils ne tiennent que sur des surfaces métalliques planes et doivent être retirés régulièrement pour éviter les traces.

## Ce qu’il faut afficher

Un véhicule se regarde quelques secondes, souvent en mouvement. Allez à l’essentiel :

1. **Le métier**, en gros : « Plomberie – Chauffage », « Paysagiste ».
2. **Le nom** de l’entreprise et le logo.
3. **Le téléphone**, très lisible, sur les côtés **et** à l’arrière (c’est l’arrière qu’on regarde dans les embouteillages).
4. **Le site internet** ou un repère simple pour vous retrouver.
5. Éventuellement la **zone d’intervention**.

Évitez les listes de dix prestations en petits caractères : personne ne les lira. Un QR code n’a de sens que sur l’arrière, pour quelqu’un qui est garé derrière vous.

## Les règles à respecter

### Les vitres

Le Code de la route encadre strictement ce qui peut être posé sur les vitres :

- **le pare-brise et les vitres latérales avant** doivent laisser passer suffisamment de lumière : pas d’adhésif ni de film teinté au-delà de ce qu’autorise la réglementation ;
- **la lunette arrière et les vitres latérales arrière** peuvent recevoir un adhésif (souvent microperforé), à condition que le véhicule dispose de **deux rétroviseurs extérieurs**.

### Les éléments de sécurité

Les plaques d’immatriculation, les feux, les catadioptres et la caméra de recul ne doivent jamais être recouverts.

### Les mentions

Pour un artisan qui utilise son propre véhicule, aucune autorisation n’est nécessaire pour y afficher son entreprise. Certaines professions réglementées (transport, taxi, ambulance, par exemple) ont en revanche des obligations spécifiques. N’affichez que des labels et qualifications que vous détenez réellement et à jour.

### Les véhicules en location longue durée

Vérifiez votre contrat : beaucoup de loueurs autorisent le marquage à condition qu’il soit retiré proprement à la restitution, sans abîmer la peinture. Les films de qualité se retirent bien, s’ils ne sont pas restés trop longtemps au soleil.

## Durée de vie

Comme pour la vitrophanie, tout dépend du film. Un film coulé de qualité, posé sur une carrosserie propre, tient plusieurs années ; un film économique peut se décoller ou se rétracter plus vite, notamment sur les formes arrondies. Le lavage au rouleau ou au jet haute pression trop proche abîme les bords : préférez un lavage doux.

## Combien ça coûte ?

Le prix dépend de la surface couverte, de l’impression, du modèle de véhicule et du temps de pose. Un lettrage simple sur les deux flancs et l’arrière coûte nettement moins qu’un covering complet. Le plus fiable : envoyer le modèle exact du véhicule et des photos de chaque côté.

## Nos conseils

- **Faites une maquette** sur une photo de votre véhicule avant de valider.
- **Contrastez** : texte clair sur fond foncé, ou l’inverse.
- **Pensez à l’ensemble** : le véhicule doit ressembler à vos cartes de visite, votre site et vos panneaux de chantier.

---

Nous concevons et posons le marquage de véhicules dans le Pays de Caux. Envoyez des photos de votre utilitaire depuis notre page [devis vitrophanie et signalétique](/devis-vitrophanie-signaletique). Pour une entreprise qui démarre, notre [pack artisan du bâtiment](/packs/artisan-batiment) inclut logo, véhicule et panneaux de chantier.`,
  },
  {
    slug: 'panneau-de-chantier-mentions-obligatoires',
    title: 'Panneau de chantier : mentions obligatoires et conseils pour être vu',
    category: 'Vitrophanie & signalétique',
    excerpt: 'Panneau de permis de construire obligatoire et panneau publicitaire de l’entreprise : ce que dit la loi, et comment faire de chaque chantier une vitrine.',
    meta_description: 'Panneau de chantier : mentions obligatoires du panneau de permis de construire, dimensions, durée d’affichage, et panneau publicitaire de l’artisan. Conseils.',
    published_at: '2027-01-12T08:00:00.000Z',
    body: `Sur un chantier, on parle souvent de « panneau de chantier » pour deux choses différentes : le **panneau d’affichage de l’autorisation d’urbanisme**, obligatoire, et le **panneau publicitaire de l’entreprise**, facultatif mais très utile. Faisons le point sur les deux.

## 1. Le panneau d’affichage du permis : obligatoire

Dès qu’un permis de construire, un permis d’aménager, un permis de démolir ou une déclaration préalable est accordé, le **bénéficiaire** (en général le propriétaire, le maître d’ouvrage) doit l’afficher sur le terrain. C’est lui qui en est responsable, mais l’artisan est souvent sollicité pour le fournir ou le poser.

### Le format

Le Code de l’urbanisme impose un panneau **rectangulaire**, dont les **dimensions sont supérieures à 80 centimètres**, installé de façon à être **visible et lisible depuis la voie publique** ou les espaces ouverts au public.

### Les mentions

Le panneau indique notamment :

- le **nom** ou la raison sociale du bénéficiaire ;
- la **date** et le **numéro** de l’autorisation ;
- la **nature du projet** et la superficie du terrain ;
- l’**adresse de la mairie** où le dossier peut être consulté ;
- selon le projet, la **surface de plancher** et la **hauteur** des constructions par rapport au sol naturel ;
- les **mentions relatives aux recours** des tiers (délai de recours et obligation de notification).

La liste exacte dépend du type d’autorisation : vérifiez-la auprès de la mairie ou sur le site officiel de l’administration avant d’imprimer.

### La durée

Le panneau doit rester en place **pendant toute la durée du chantier**. L’affichage fait aussi courir le délai de recours des tiers : un affichage absent, incomplet ou illisible peut fragiliser l’autorisation. Prendre des photos datées du panneau en place est une précaution utile.

## 2. Le panneau de l’entreprise : une publicité gratuite

Chaque chantier est vu par les voisins, les passants, les automobilistes. Un panneau aux couleurs de votre entreprise transforme ce passage en contacts. Les voisins d’un chantier sont souvent… les prochains clients.

### Ce qu’il faut y mettre

Comme pour un véhicule, le panneau se lit de loin et en quelques secondes :

1. le **métier** en gros caractères ;
2. le **nom** et le **logo** de l’entreprise ;
3. le **téléphone**, très lisible ;
4. le **site internet** ;
5. éventuellement un **QR code** vers vos réalisations, pour les piétons.

Les labels et qualifications n’ont leur place que si vous les détenez réellement et à jour.

### L’autorisation du client

Le panneau est posé chez votre client : demandez toujours son **accord**. La plupart l’acceptent volontiers, surtout si le panneau est propre et discret. Prévoyez-le dans votre devis ou vos conditions.

### Les règles d’affichage

Un panneau publicitaire temporaire sur un terrain privé est généralement toléré pendant la durée des travaux, mais les règles locales de publicité peuvent l’encadrer, en particulier dans les secteurs protégés. En cas de doute, un appel au service urbanisme de la commune suffit.

## Les matériaux

- **Le polypropylène alvéolaire** (type Akylux) : léger, économique, facile à fixer sur un grillage ou une barrière ; idéal pour des chantiers courts et nombreux.
- **Le PVC** : rigide, bon rendu d’impression, pour un usage de quelques mois.
- **L’aluminium composite** (type Dibond) : très rigide et durable, il résiste aux intempéries et se réutilise d’un chantier à l’autre.
- **La bâche** : pour les grands formats sur échafaudage ou palissade.

Prévoyez des **œillets** ou des **perçages** pour la fixation, et une impression résistante aux UV.

## Les dimensions

Pour le panneau de l’entreprise, il n’y a pas de format imposé. Des formats autour de 60 × 80 cm ou 80 × 120 cm sont courants : assez grands pour être lus depuis la rue, assez petits pour se transporter dans un utilitaire.

## Un ensemble cohérent

Panneau de chantier, véhicule, vêtements de travail, cartes de visite, site internet : tout doit se ressembler. Le client qui voit votre panneau, puis votre utilitaire, puis votre site, reconnaît immédiatement la même entreprise. Voir aussi notre article sur le [marquage de véhicule utilitaire](/blog/marquage-vehicule-utilitaire-artisan).

---

Nous concevons et imprimons vos panneaux de chantier, et les déclinons de votre identité visuelle. Demandez un devis sur notre page [vitrophanie et signalétique](/devis-vitrophanie-signaletique), ou découvrez notre [pack artisan du bâtiment](/packs/artisan-batiment).`,
  },
];
