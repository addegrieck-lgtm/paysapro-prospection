# Guide d’administration (sans code)

Adresse : `https://votre-site/admin`. Tout se pilote depuis le menu de gauche.

## Au quotidien

1. **Tableau de bord** : la rubrique « À faire » liste ce qui demande une action (prix expirés, informations manquantes…),
   puis les chiffres clés, les relances du jour et les retards. Tous les chiffres viennent des données enregistrées.
2. **Demandes de devis** : chaque formulaire envoyé depuis le site arrive ici (avec ses fichiers). Le contact est créé ou
   mis à jour automatiquement dans le CRM. Pour une impression, une commande est créée au bon statut.
3. **Contacts (CRM)** : statut commercial (nouveau → à contacter → contacté → qualifié → devis envoyé → gagné / perdu),
   prochaine action et sa date (elle apparaîtra dans le tableau de bord), historique des échanges. Export CSV en haut à droite.

## Statistiques du site

*Pilotage → Statistiques du site* : visiteurs, provenance (Google, Facebook, accès direct, autres sites, liens suivis), pages vues,
pages d’arrivée, appareils, pays, et demandes de devis ou messages selon la provenance de la visite (aussi affichée sur chaque demande).
Mesure interne sans cookie ni service extérieur (aucun bandeau de consentement), robots et administrateur connecté exclus, conservation 13 mois.
Pour identifier un canal précis (fiche Google, QR code d’un flyer, signature e-mail), utilisez les liens avec `utm_source` proposés en bas de la page.

## Cahier des charges client

*Commercial → Cahiers des charges* (ou bouton « Cahier des charges » sur une fiche contact) : choisissez le client et les prestations
(site internet, logo et identité visuelle, impression et signalétique), puis envoyez le lien par e-mail ou copiez-le dans un SMS.
Le client répond étape par étape à un questionnaire guidé (choix à cocher, exemples, aide), peut ajuster les prestations, s'arrêter
et reprendre avec le même lien, et joindre logo, photos et documents. Vous êtes prévenu quand il a terminé ; ses réponses
s'affichent dans l'administration (bouton « Imprimer / PDF »). « Rouvrir pour le client » lui permet de modifier ses réponses.
Les questions se modifient dans `src/domain/brief.ts`.

## Faire un devis

1. Depuis une demande : *Préparer le devis* (les lignes sont préremplies : création, impression, livraison).
   Depuis un contact : *Créer un devis*.
2. Complétez chaque ligne : description, quantité, prix unitaire HT, TVA, et **coût unitaire** (interne, jamais montré au client).
   La synthèse à droite calcule la marge.
3. *Valider et envoyer par e-mail* : le numéro définitif est attribué (D-AAAA-0001), le client reçoit un lien personnel pour
   consulter et accepter. Un devis envoyé n’est plus modifiable : utilisez *Nouvelle version*.
4. Si le client signe sur papier : *Réponse reçue hors ligne* avec le nom du signataire et la preuve.

## Commande d’impression

Statuts dans l’ordre : demande reçue → … → BAT envoyé → BAT accepté → commande fournisseur à passer → commande fournisseur passée →
en production → expédié → livré → terminé. L’application **refuse** :
- toute étape fournisseur tant que le BAT n’est pas accepté par le client (si le BAT est requis) ;
- « Commande fournisseur passée » sans la référence et la date de la commande réellement passée chez l’imprimeur.

**BAT** : déposez le fichier (*Ajouter la version*), cochez chaque point de la checklist prépresse, puis *Envoyer ce BAT au client*.
Le client l’accepte ou demande des corrections depuis son lien ; déposez alors une nouvelle version.

Renseignez ensuite le coût fournisseur réel, le lien de suivi et la date de livraison estimée.

## Prix fournisseurs (impression)

*Catalogue & prix → Prix fournisseurs* : une ligne = une configuration **exacte** (format, papier, grammage, finition, impression,
option, délai, quantité). Pour qu’un prix apparaisse sur le site :
1. saisir le coût fournisseur constaté (et les frais de port s’il y en a) ;
2. *Marquer comme vérifié* avec la date et la source (ex. « panier compte HelloPrint du 20/10 ») ;
3. saisir le prix de vente puis *Valider le prix de vente*.

Si vous modifiez un coût, la ligne repasse « à vérifier » et disparaît du site : le prix public n’est jamais changé
automatiquement. Au-delà de la durée de validité (30 jours par défaut, réglable dans *Paramètres*), le prix expire.
Sans prix vérifié, le site affiche « Sur devis » : c’est normal.

## Factures

Depuis un devis accepté : *Créer la facture (brouillon)*. Vérifiez, puis *Émettre* : le numéro (F-AAAA-0001) est attribué sans
trou ni doublon et la facture devient définitive. Pour corriger une facture émise : *Créer un avoir*. Marquez-la payée à réception
du virement. L’émission est bloquée tant que les informations légales sont incomplètes.

Utilisez *Version imprimable / PDF* puis « Enregistrer au format PDF » de votre navigateur pour l’envoyer.

## Projets web

Fiche complète (brief, identité, textes, photos, arborescence, domaine, hébergement, préproduction, version, sauvegardes,
maintenance) avec checklists SEO et sécurité. *Demander la validation de la recette* envoie le lien au client ; le statut
« En ligne » n’est possible qu’après sa validation. **Ne saisissez jamais de mot de passe** dans une fiche (l’application les refuse).

## Modifier le site

- **Nom, couleurs, coordonnées, informations légales, TVA** : *Paramètres*.
- **Prestations et prix** : *Prestations* (statut Publié / Brouillon / Désactivé, ordre d’affichage, options payantes « Nom | prix »).
- **Produits imprimés** : options du configurateur, une valeur par ligne.
- **Réalisations, blog, FAQ, pages locales, redirections** : menu *Contenus*. Les pages locales exigent au moins 300 mots
  d’informations réellement propres au lieu.
