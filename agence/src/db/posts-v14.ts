/**
 * Articles de fin d'année ajoutés par la migration 14, publiés automatiquement à leur date
 * (un article dont `published_at` est dans le futur reste invisible sur le site, dans le blog et le sitemap).
 * Complètent l'article du 3/11 « préparer sa communication pour les fêtes » sans le répéter.
 * Aucun prix, client, chiffre ou avis réel n'est inventé.
 */
import type { PostSeed } from './posts-v5';

export const POSTS_V14: PostSeed[] = [
  {
    slug: 'carte-de-voeux-entreprise',
    meta_title: 'Carte de vœux d’entreprise : textes, format et calendrier',
    title: 'Carte de vœux d’entreprise : imprimée ou numérique, quoi écrire et quand l’envoyer',
    category: 'Impression',
    excerpt: 'Papier ou e-mail, exemples de textes pour artisans et commerçants, formats, calendrier d’envoi : tout pour réussir ses vœux professionnels sans y passer des heures.',
    meta_description: 'Carte de vœux professionnelle : papier ou numérique, exemples de textes pour artisans et TPE, format, papier et calendrier d’envoi.',
    published_at: '2026-11-26T08:00:00.000Z',
    body: `La carte de vœux est l’un des rares messages qu’un client lit sans se méfier : elle ne vend rien, elle remercie. Pour un artisan, un commerce ou une petite entreprise, c’est une occasion simple de rappeler son nom en début d’année, au moment où beaucoup de projets se décident. Encore faut-il qu’elle soit soignée, envoyée au bon moment et aux bonnes personnes.

## Papier ou numérique : que choisir ?

Les deux se défendent, et beaucoup d’entreprises combinent les deux.

**La carte imprimée** marque davantage. Elle se garde, se pose sur un bureau ou s’affiche au réfrigérateur, et elle montre que vous avez pris le temps. Elle convient particulièrement :

- aux clients particuliers chez qui vous êtes intervenu dans l’année ;
- à vos meilleurs clients professionnels, architectes, syndics, prescripteurs ;
- à vos fournisseurs et partenaires importants.

**La carte numérique** (une image dans un e-mail) coûte moins cher et part en quelques minutes. Elle convient pour une liste plus longue de contacts professionnels, ou en complément de la carte papier sur les réseaux sociaux et sur votre fiche Google.

Notre conseil : **une carte imprimée pour les 30 à 100 contacts qui comptent vraiment**, et la version numérique pour tous les autres.

## Le bon calendrier

- **Fin novembre à début décembre** : choisir le visuel, rédiger le texte, valider la liste des destinataires.
- **Avant mi-décembre** : envoyer les fichiers à l’impression. Les imprimeurs sont très sollicités en fin d’année ; comptez la création, une ou deux corrections, l’impression et la livraison.
- **Entre Noël et le jour de l’An** : écrire quelques mots à la main sur les cartes et préparer les enveloppes, pendant la période calme.
- **Du 2 au 15 janvier** : envoyer. Les vœux se présentent traditionnellement jusqu’à la fin janvier, mais une carte reçue dans les deux premières semaines est mieux remarquée.

Vous préférez souhaiter de bonnes fêtes plutôt qu’une bonne année ? Envoyez alors la carte avant le 15 décembre, pour qu’elle arrive avant les congés.

## Quoi écrire : des exemples prêts à adapter

Un bon texte de vœux est court, sincère et ne vend rien. Trois ou quatre lignes suffisent. Évitez les promotions et les tarifs : ils transforment le remerciement en publicité.

**Pour un artisan du bâtiment**

> Merci pour votre confiance cette année. Toute l’équipe vous souhaite une belle année 2027, pleine de projets réussis dans votre maison.

**Pour un commerce de proximité**

> Merci d’avoir poussé notre porte tout au long de l’année. Nous vous souhaitons de très belles fêtes et une année 2027 gourmande, et nous avons hâte de vous retrouver en boutique.

**Pour une entreprise de services à des professionnels**

> À l’heure de tourner la page de 2026, merci pour votre collaboration et votre confiance. Nous vous adressons nos meilleurs vœux de réussite pour 2027, à vous et à vos équipes.

**Pour une profession libérale ou du soin**

> Prenez soin de vous en 2027. Merci pour votre fidélité, et à très bientôt au cabinet.

Ajoutez si possible **un mot manuscrit et une signature** : quelques mots écrits à la main valent mieux qu’un long texte imprimé. Pour un client particulier, une référence au chantier ou à la commande (« en espérant que la nouvelle cuisine vous plaît toujours autant ») fait toute la différence.

## Le visuel : à votre image, pas un modèle générique

La carte doit être reconnaissable au premier coup d’œil comme la vôtre :

- **vos couleurs et votre logo**, discrètement, sans en faire une publicité ;
- **une photo qui vous ressemble** : votre équipe, votre boutique, une réalisation de l’année, un paysage du Pays de Caux ;
- **une typographie lisible**, surtout pour le texte au verso.

Un visuel préparé pour la carte se décline ensuite facilement en image pour l’e-mail, la publication sur les réseaux sociaux et la publication de votre fiche Google. Vous n’avez qu’un seul travail de création pour tous vos supports.

## Format, papier et enveloppe

- **Le format A6** (10,5 × 14,8 cm) est le plus courant. Il entre dans une enveloppe standard et se pose facilement sur un bureau.
- **Le format DL** (9,9 × 21 cm), plus allongé, se distingue et rentre dans une enveloppe longue.
- **Le papier** : un 350 ou 400 g couché mat donne une carte rigide, agréable en main, sur laquelle on peut écrire au stylo. Le brillant fait ressortir une photo, mais il accepte mal l’écriture.
- **Recto ou recto-verso ?** Le visuel au recto, le texte et vos coordonnées au verso : c’est le plus lisible.

Nos [flyers](/impression/flyers) existent justement en A6 et en DL sur papier épais : c’est le support que nous utilisons pour imprimer les cartes de vœux, avec une estimation de prix immédiate dans le configurateur. Pour une carte plus marquante, la dorure ou le vernis sélectif sont possibles sur devis, comme sur nos [cartes de visite premium](/impression/cartes-de-visite-premium).

## La version numérique, bien faite

Pour l’e-mail, quelques règles évitent que la carte finisse dans les indésirables :

- **une image légère** placée dans le corps du message, plutôt qu’un PDF en pièce jointe ;
- **un objet clair et personnel** : « Meilleurs vœux de la part de [votre entreprise] » ;
- **un texte de deux lignes** sous l’image, pour les messageries qui n’affichent pas les images ;
- **des destinataires avec qui vous êtes déjà en relation** (clients, fournisseurs, partenaires), en copie cachée ou par un outil d’envoi, jamais avec toutes les adresses visibles.

## Les erreurs les plus fréquentes

- Une carte trop chargée, où le logo et les coordonnées prennent toute la place.
- Une coquille dans le nom du client ou dans l’année : faites relire.
- Une carte envoyée fin janvier, quand tout le monde a déjà reçu les autres.
- Oublier ses meilleurs prescripteurs : l’architecte, le syndic ou le commerçant voisin qui vous recommande toute l’année.

---

Vous voulez une carte de vœux à vos couleurs, imprimée et prête à envoyer ? Nous créons le visuel, préparons la version numérique et imprimons les cartes pour les entreprises du Pays de Caux, de Bolbec à Fécamp, et partout en France à distance. Décrivez votre projet sur notre [formulaire de devis](/devis), ou relisez notre [calendrier de communication des fêtes](/blog/communication-fetes-fin-annee-commercants) pour le reste de votre fin d’année.`,
  },
  {
    slug: 'horaires-fetes-google-site-vitrine',
    meta_title: 'Horaires des fêtes : mettre à jour Google, site et vitrine',
    title: 'Horaires des fêtes : les mettre à jour sur Google, sur votre site et en vitrine',
    category: 'Référencement',
    excerpt: 'Horaires exceptionnels sur la fiche Google, bandeau sur le site, affichette en vitrine, répondeur : la liste pour que personne ne trouve porte close pendant les fêtes.',
    meta_description: 'Horaires exceptionnels des fêtes : mettre à jour sa fiche Google, son site, sa vitrine et son répondeur, étape par étape. Pour commerçants et artisans.',
    published_at: '2026-12-10T08:00:00.000Z',
    body: `Pendant les fêtes, les horaires de presque tous les commerces et artisans changent : ouvertures le dimanche, fermeture plus tôt le 24 et le 31 décembre, jours fériés, congés de début janvier. Le problème, ce n’est pas de changer d’horaires : c’est que **l’information ne suit pas partout**. Un client qui se déplace et trouve porte close alors que Google indiquait « ouvert » ne revient pas toujours, et il lui arrive de laisser un avis négatif.

Voici, dans l’ordre, tous les endroits à mettre à jour. Comptez une demi-heure en tout.

## Avant tout : fixer vos horaires sur une feuille

Notez pour chaque jour concerné, de début décembre à mi-janvier :

- les **dimanches d’ouverture** de décembre, s’il y en a ;
- les **24 et 31 décembre** (jeudis en 2026), souvent avec une fermeture anticipée ;
- les **25 décembre et 1er janvier** (vendredis), jours fériés ;
- vos **congés**, s’il y en a, avec la date exacte de réouverture ;
- pour un artisan : la période où vous ne répondez qu’aux urgences, et le numéro à appeler.

Cette feuille sera votre seule référence : vous recopierez exactement les mêmes informations partout, pour éviter les contradictions.

## 1. La fiche Google : les « horaires exceptionnels »

C’est la priorité absolue : c’est là que la plupart de vos clients regardent si vous êtes ouvert, directement dans les résultats de recherche ou sur Google Maps.

Ne modifiez pas vos horaires habituels : utilisez la fonction prévue pour cela.

1. Connectez-vous au compte Google qui gère votre fiche, puis recherchez le nom de votre établissement sur Google.
2. Dans le panneau de gestion de votre fiche, choisissez **Modifier le profil**, puis la rubrique **Horaires**.
3. Ouvrez **Horaires exceptionnels** et ajoutez chaque date concernée, avec ses horaires ou la mention « fermé ».
4. Enregistrez. La modification peut demander un peu de temps avant d’apparaître.

L’intitulé exact des menus change de temps en temps, mais la fonction existe toujours sous ce nom. Google vous propose parfois lui-même de « confirmer vos horaires des fêtes » : profitez-en.

Ajoutez ensuite une **publication** sur votre fiche, qui récapitule les horaires des fêtes en une image et deux lignes. Elle apparaît sur votre fiche et rassure ceux qui hésitent. Nous détaillons les autres réglages utiles dans notre article [fiche Google : 10 réglages pour Google Maps](/blog/fiche-google-reglages-pays-de-caux).

## 2. Votre site internet : un bandeau visible

Sur votre site, l’information doit être visible **sans chercher** :

- un **bandeau en haut de toutes les pages** : « Horaires des fêtes : fermeture à 16 h les 24 et 31 décembre, fermé les 25 décembre et 1er janvier » ;
- la **page contact** mise à jour, avec la date de réouverture si vous fermez ;
- pour un artisan, la **mention des délais** : « Les demandes de devis reçues pendant les congés seront traitées à partir du 5 janvier. »

Pensez à noter dans votre agenda la date où il faudra **retirer le bandeau**. Un message des fêtes encore en ligne en février donne l’impression d’un site abandonné. Si votre site est entretenu avec notre offre de [maintenance](/maintenance-site-internet), nous nous chargeons de l’ajouter et de le retirer.

## 3. La vitrine et la porte

Beaucoup de clients passent devant votre boutique avant de vérifier en ligne. Une affichette lisible sur la porte, à hauteur des yeux, reste indispensable :

- **gros caractères**, lisibles depuis le trottoir ;
- **uniquement les jours qui changent**, pas tout le calendrier de l’année ;
- **le moyen de vous joindre** ou le lien vers votre site, éventuellement avec un QR code.

Pour une présentation plus soignée qu’une feuille scotchée, un adhésif repositionnable ou électrostatique se pose et se retire sans traces, et se réutilise d’une année sur l’autre si vous ne mettez pas de dates. Voir notre page [vitrophanie de vitrine](/vitrophanie-vitrine-commerce).

## 4. Le téléphone et les e-mails

- **Le répondeur** : enregistrez un message avec vos horaires et votre date de réouverture. Pour un artisan, indiquez le numéro à joindre en cas d’urgence, s’il y en a un.
- **La réponse automatique** de votre messagerie, pendant les jours de fermeture, avec les mêmes informations.
- **La signature de vos e-mails** : une ligne en décembre suffit, par exemple « Fermeture du 26 décembre au 4 janvier inclus ».

## 5. Les autres plateformes

Faites ensuite le tour des endroits où vos horaires apparaissent aussi :

- votre **page Facebook**, qui affiche des horaires d’ouverture, et une publication épinglée sur vos réseaux sociaux ;
- les **annuaires** où vous êtes inscrit, comme PagesJaunes ;
- les fiches **Bing Places** et **Apple Business Connect**, si vous les avez créées : elles alimentent d’autres services de cartes que Google ;
- les **plateformes de réservation ou de commande** (restaurants, coiffeurs, instituts) : bloquez les créneaux fermés, sinon des clients réserveront quand même.

## 6. En janvier : tout remettre à jour

C’est l’étape oubliée. Début janvier, une fois les congés terminés :

1. Vérifiez sur Google que vos **horaires habituels** s’affichent bien à nouveau. Les horaires exceptionnels sont attachés à des dates : ils s’effacent d’eux-mêmes une fois passés, mais un horaire habituel modifié par erreur, lui, reste.
2. **Retirez le bandeau** du site, l’affichette et le message du répondeur.
3. Profitez du calme pour demander quelques **avis Google** à vos clients des fêtes : voir notre article [obtenir des avis Google sans les acheter](/blog/obtenir-avis-google-sans-les-acheter).

## La liste en un coup d’œil

1. Fixer les horaires de chaque jour concerné, sur une feuille.
2. Fiche Google : horaires exceptionnels et une publication.
3. Site : bandeau, page contact, délais de réponse.
4. Vitrine : affichette ou adhésif lisible.
5. Répondeur, réponse automatique, signature d’e-mail.
6. Facebook, annuaires, autres cartes, plateformes de réservation.
7. En janvier : tout vérifier et tout retirer.

---

Vous manquez de temps en décembre ? Nous pouvons nous charger de votre fiche Google, du bandeau sur votre site et de l’affichette de vitrine, pour les commerces et artisans du Pays de Caux, de Lillebonne à Fécamp. Écrivez-nous depuis notre [formulaire de devis](/devis), ou découvrez notre accompagnement en [référencement local](/referencement-local-artisan).`,
  },
];
