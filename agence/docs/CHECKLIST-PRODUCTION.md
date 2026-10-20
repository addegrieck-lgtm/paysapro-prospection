# Checklist de mise en production

Cochez chaque point avant d’ouvrir le site au public.

## Identité et contenus
- [ ] Nom définitif choisi et vérifié (recherche INPI, disponibilité du domaine et des réseaux sociaux), puis case « Nom définitif » cochée dans *Paramètres*
- [ ] Couleur d’accent vérifiée (contraste suffisant avec le texte blanc des boutons)
- [ ] Textes des pages relus ; aucune promesse impossible (classement Google, délais non tenables)
- [ ] Réalisations : uniquement des concepts signalés comme tels, ou de vrais projets **avec l’accord écrit du client**
- [ ] Aucun avis, logo client ou chiffre inventé
- [ ] Prestations et prix vérifiés dans *Catalogue & prix → Prestations* (options, exclusions, délais, révisions)

## Informations légales
- [ ] *Paramètres → Informations légales* complètes : dénomination, forme, adresse, SIREN/SIRET, immatriculation, TVA intracommunautaire (ou franchise en base), directeur de la publication, hébergeur
- [ ] Régime de TVA correct (franchise en base / assujetti) et taux vérifié
- [ ] Médiateur de la consommation désigné (obligatoire pour vendre à des particuliers)
- [ ] Assurance RC professionnelle souscrite et renseignée
- [ ] CGV, mentions légales et politique de confidentialité **relues par un professionnel** (les modèles fournis sont une base de travail)
- [ ] Facturation : mentions vérifiées avec l’expert-comptable ; plateforme agréée de facturation électronique choisie selon le calendrier applicable

## Impression
- [ ] Options de chaque produit vérifiées chez le fournisseur (date renseignée dans « Options vérifiées le »)
- [ ] Prix fournisseurs saisis **pour des configurations exactes**, marqués « vérifiés » avec leur source
- [ ] Prix de vente validés (marges contrôlées dans *Marges*)
- [ ] Les 6 prix importés automatiquement (statut « à vérifier ») ont été confirmés, corrigés ou supprimés
- [ ] Durée de validité des prix fournisseurs adaptée (*Paramètres*)

## Technique
- [ ] `APP_SECRET` aléatoire (32+ caractères) défini en secret / variable d’environnement
- [ ] `ADMIN_SETUP_TOKEN` supprimé après création du compte administrateur
- [ ] Mot de passe administrateur long et unique (gestionnaire de mots de passe)
- [ ] HTTPS actif, redirection du domaine nu vers `www` (ou l’inverse)
- [ ] Adresse du site renseignée dans *Paramètres* (canoniques, sitemap, liens des e-mails)
- [ ] E-mails : fournisseur configuré, domaine authentifié (SPF, DKIM, DMARC), test d’envoi réussi (*E-mails envoyés* : statut « Envoyé »)
- [ ] E-mail de notification interne renseigné
- [ ] Sauvegardes en place **et restauration testée**
- [ ] `npm test`, `npm run build` et `npm run check:public` passent
- [ ] Recette de bout en bout sur l’environnement de production : `BASE_URL=https://… SETUP_TOKEN=… node scripts/e2e.mjs` (sur une base vierge, avant la création du compte réel), ou parcours manuel équivalent
- [ ] Contrôle accessibilité/responsive : `BASE_URL=https://… node scripts/a11y.mjs`

## SEO et mesure
- [ ] Google Search Console : propriété vérifiée, sitemap `https://…/sitemap.xml` soumis
- [ ] PageSpeed Insights / Core Web Vitals contrôlés sur mobile
- [ ] Fiche d’établissement Google (si pertinent), avec des informations exactes uniquement
- [ ] Mesure d’audience : Plausible (sans bandeau) ou Google Analytics (bandeau de consentement : vérifier qu’aucun cookie `_ga` n’est déposé avant « Accepter »)
- [ ] Redirections des anciennes adresses en place si le domaine avait déjà un site

## Après l’ouverture
- [ ] Envoyer une vraie demande de devis et suivre tout le parcours (devis, acceptation, BAT, commande, facture)
- [ ] Vérifier chaque semaine le tableau de bord : relances, prix expirés, retards
