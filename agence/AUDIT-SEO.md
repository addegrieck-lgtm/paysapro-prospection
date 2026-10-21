# Audit SEO — site de l’agence

*Audit réalisé le 21/10/2026 sur la version en ligne (`https://agence-web.paysapro-prospection.workers.dev`) et sur le code du dossier `agence/`. Aucune modification de code n’a été faite à cette étape.*

**Méthode.**
- Exploration automatique des 47 URL du sitemap, de la page 404 et de la page de confirmation de devis :
  - balises, titres, liens, images, données structurées ;
  - volume de texte et signaux locaux ;
  - comparaison du texte entre pages (empreintes de 5 mots consécutifs).
- Mesure du poids et des en-têtes des ressources.
- Lecture du code : routing, gabarits, données.

**Limites.** Pas d’accès à la Search Console, à un outil de volumes de recherche ni à Google Business Profile.
- Aucun volume de recherche n’est donc cité : les priorités de mots-clés reposent sur l’intention et la concurrence locale probable, à confirmer avec Google Keyword Planner puis avec la Search Console après quelques semaines.
- Les performances sont estimées d’après les poids mesurés, pas d’après un test Lighthouse en conditions réelles.

---

## 0. Ce qu’il faut savoir sur le site (stack et contenu)

| Élément | Constat |
|---|---|
| Stack | TypeScript, serveur Hono avec rendu HTML côté serveur (JSX), Cloudflare Workers + base D1 (ou Node + SQLite) |
| Routing | `src/routes/public.tsx` (pages), `src/routes/seo.ts` (sitemap, robots, favicon, redirections) |
| Pages de prestations | Contenu éditorial dans `src/web/content.ts` (`SERVICE_PAGES`), gabarit unique `ServicePage` dans `src/web/public/pages.tsx` |
| Prix et offres | Base de données (`services`), modifiables dans l’administration |
| Portfolio, blog, FAQ, pages locales, redirections | Base de données, modifiables dans l’administration (`/admin/contenus/...`) |
| Gabarit commun, metas, JSON-LD, fil d’Ariane | `src/web/layout.tsx` |
| Nom, coordonnées, informations légales | *Administration → Paramètres* (une seule source, réutilisée partout) |
| Visuels | Illustrations SVG intégrées dans le HTML (`src/web/illustrations.tsx`) : aucune image bitmap sur le site |
| Système de demande de devis | `/devis` (assistant 6 étapes, pièces jointes PDF/PNG/JPG/WebP, anti-spam, CRM) |
| Pages locales | Mécanisme déjà présent : `/agence-web/<ville>`, publication refusée sous 300 mots (anti-« doorway ») |

**Constat principal : le site ne dit nulle part que l’agence est à Gruchet-le-Valasse.** Aucune page ne mentionne Gruchet-le-Valasse, Bolbec, Lillebonne, Le Havre, la Seine-Maritime, le Pays de Caux ni même la Normandie. La zone affichée est « Partout en France, à distance ». L’adresse, le téléphone et l’e-mail ne sont pas renseignés dans les paramètres : ils n’apparaissent donc nulle part. Le nom en ligne est encore le nom provisoire « Atelier Sillage ».

En l’état, le site n’a **aucune chance de se positionner sur des recherches locales**. C’est le chantier le plus important, devant toute la technique.

---

## 1. SEO technique

### 1.1 Balises title et meta description

| Constat | Détail | Gravité |
|---|---|---|
| Présence | Title et meta description présents sur 100 % des pages | ✔ |
| Doublons de title | `/realisations/atelier-chene-et-fil` = `/etudes-de-cas/atelier-chene-et-fil`, idem pour `les-pages-lentes` | Moyenne |
| Titles trop longs | 31 titles sur 47 dépassent 60 caractères, 16 dépassent 70 (ex. « Création d’affiches, brochures, roll-ups et supports imprimés \| Atelier Sillage » = 79). Google tronque vers 55-60 caractères | Moyenne |
| Suffixe de marque | « \| Atelier Sillage » (17 car.) consomme l’espace utile, et c’est un nom provisoire | Faible |
| Descriptions trop longues (> 160) | 14 pages : accueil (180), `/tarifs`, `/impression`, `/a-propos`, `/maintenance-site-internet` et les 10 fiches `/impression/*` (160-195) | Faible |
| Descriptions trop courtes (< 110) | Pages légales (normal), 5 fiches réalisations (71 à 107), `/plan-du-site` (25) | Faible |
| Aucun signal local | Aucun title ni aucune description ne contient un nom de lieu | **Forte** |

### 1.2 Hiérarchie des titres

- ✔ **Un seul H1 par page** sur les 47 pages, et une hiérarchie H2/H3 cohérente.
- ✘ **Les H1 des pages de prestations sont des slogans sans mot-clé** :
  - `/creation-site-internet` → « Un site internet qui travaille pour vous » ;
  - `/referencement-seo` → « Être trouvé par les clients qui vous cherchent » ;
  - `/flyers-depliants` → « Des flyers qui se lisent en trois secondes ».

  Le sujet de la page n’apparaît pas dans son H1. **Correction proposée** : H1 du type « Création de site internet *qui travaille pour vous* ». Le mot-clé est en clair et l’accroche reste en italique, ce qui garde la direction artistique.
- ✘ Les H1 des fiches produit d’impression se limitent au nom du produit (« Flyers »). Proposé : « Impression de flyers ».

### 1.3 URLs et canonical

- ✔ **URLs propres**, en français, sans paramètres, avec redirection de la barre oblique finale (301).
- ✘ **Canonical relative** (`<link rel="canonical" href="/creation-site-internet">`).
  - Cause : l’« adresse du site » n’est pas renseignée dans les paramètres.
  - Une canonical doit être absolue.
  - Correction : renseigner l’adresse, et rendre le code robuste en utilisant l’origine de la requête quand le paramètre est vide.
- ✘ **Contenu dupliqué à 100 %** : chaque étude de cas existe sous deux URL (`/realisations/x` et `/etudes-de-cas/x`), chacune avec sa propre canonical. Correction : canonical des deux vers `/realisations/x`, ou redirection 301 de `/etudes-de-cas/x` vers `/realisations/x` en gardant la page liste `/etudes-de-cas`.
- ⚠ **Le site répond aussi en HTTP sans rediriger vers HTTPS** (`http://agence-web…workers.dev` → 200). HSTS n’est envoyé qu’en HTTPS. Correction : redirection 301 vers HTTPS dans l’application, ou « Always Use HTTPS » une fois le domaine personnalisé branché sur Cloudflare.
- ⚠ **Pas de domaine personnalisé.** Le site est sur `*.workers.dev`, sous-domaine technique peu crédible et lié au projet Paysapro. **À faire avant toute action SEO durable** : brancher le nom de domaine définitif, puis renseigner l’adresse du site dans les paramètres. Toutes les canonicals, le sitemap et le JSON-LD suivent automatiquement.

### 1.4 robots.txt et sitemap.xml

- ✔ robots.txt : `/admin`, `/client/`, `/api/` et `/devis/merci` exclus, sitemap déclaré.
- ✔ sitemap.xml : 47 URL, toutes en 200, aucune URL d’administration.
  - ✘ Les deux URL `/etudes-de-cas/x` en doublon y figurent (à retirer avec la correction 1.3).
  - Les `lastmod` n’existent que pour le blog et les produits (pas critique).
- ⚠ Les URL du sitemap utilisent l’adresse `workers.dev` : elles basculeront d’elles-mêmes sur le domaine définitif.

### 1.5 Open Graph et partage

- ✔ og:title, og:description, og:type et og:locale présents.
- ✘ **Pas d’`og:image`** : partagé sur Facebook, LinkedIn ou WhatsApp, le site s’affiche sans visuel. Correction : générer une image de partage 1200 × 630 px (une par défaut, une par grande rubrique).
- ✘ `og:url` absent tant que l’adresse du site n’est pas renseignée.
- ✘ Pas de balises `twitter:card`.

### 1.6 Images

- ✔ Le site n’a **aucune image bitmap** : toutes les illustrations sont des SVG intégrés, légers et nets. Elles ont un `role="img"` et un `aria-label` (équivalent du `alt`), ou sont marquées décoratives (`aria-hidden`).
- ✘ **Les moteurs de recherche ne valorisent pas les SVG intégrés comme des images** : le site est absent de Google Images. Or le portfolio et la future offre vitrophanie se vendent sur photo.
- Recommandation pour les futurs visuels réels (photos de vitrines, mockups, chantiers) :
  - fichiers WebP ou AVIF ;
  - `width`/`height` déclarés ;
  - `loading="lazy"` hors premier écran ;
  - `alt` descriptif (« Vitrophanie microperforée sur la vitrine d’une boulangerie »).

  Il n’existe aujourd’hui ni composant image ni chaîne d’optimisation : à prévoir en phase 2 ou 3.

### 1.7 Performances probables

| Ressource | Poids transféré | Commentaire |
|---|---|---|
| HTML de l’accueil | 10,7 Ko (Brotli) | Très léger |
| CSS | 10,5 Ko (Brotli), 1 fichier bloquant | Acceptable |
| JS | 1,1 Ko (`site.js`), chargé en `module`, non bloquant | ✔ |
| Polices | 3 fichiers WOFF2 : 36,6 + 44,9 + 45,7 Ko | 2 préchargées ; l’italique (titres) ne l’est pas → léger décalage visuel possible sur le H1 |
| Cache des ressources | `Cache-Control: max-age=0, must-revalidate` sur CSS, JS et polices | ✘ Chaque visite revalide. Correction : fichier `_headers` des ressources statiques Cloudflare (cache d’une semaine) |

Estimation : très bons Core Web Vitals probables (aucune image lourde, pas de JS bloquant). Le principal gain possible est le cache navigateur. **À confirmer** avec PageSpeed Insights sur le domaine définitif.

### 1.8 Responsive, accessibilité, HTTPS, 404

- ✔ **Responsive** : 15 pages × 3 formats (mobile, tablette, ordinateur) testés lors de la livraison, sans débordement horizontal. Champs ≥ 16 px (pas de zoom forcé sur iPhone).
- ✔ **Accessibilité** :
  - audit axe-core (WCAG 2.1 AA) sans défaut sérieux ni critique ;
  - lien d’évitement, `lang="fr"` ;
  - contraste corrigé ;
  - navigation au clavier, `aria-current` sur le menu.
- ✔ **Mixed content** : aucun (ressources en chemins relatifs).
- ✔ **404 personnalisée** (code 404, `noindex`, liens vers les pages utiles).

### 1.9 Liens et maillage interne

- ✔ **Aucun lien interne cassé** (tous les liens du contenu testés).
- ✔ Pas de page orpheline : `/plan-du-site` n’est lié que depuis le pied de page, ce qui suffit.
- ✘ **Maillage faible vers les fiches produit d’impression.** Chaque fiche `/impression/x` ne contient qu’un lien dans son contenu (vers `/devis`), sans lien vers la page de prestation correspondante ni vers les réalisations.
- ✘ **Les fiches réalisations ne renvoient vers aucune page de prestation**, ni les pages de prestations vers les réalisations correspondantes.
- ✘ Les articles de blog renvoient peu vers les prestations (1 lien chacun).

---

## 2. Données structurées (JSON-LD)

Syntaxe valide sur toutes les pages (JSON correctement formé, aucun bloc invalide).

| Type | Où | Qualité |
|---|---|---|
| `ProfessionalService` | Accueil | ✘ Minimal : nom et description seulement. **Pas d’adresse, de téléphone, de `geo`, d’`url`, de `logo` ni d’`image`**, et `areaServed` = « France » au lieu des communes cibles |
| `LocalBusiness` | — | ✘ Absent (`ProfessionalService` en est un sous-type : il suffit de le compléter) |
| `WebSite` | — | ✘ Absent |
| `Organization` | — | Couvert par `ProfessionalService` une fois complété (`logo`, `sameAs` vers la fiche Google et les réseaux) |
| `Service` | 10 pages de prestations | ✔ Présent avec `offers` quand le prix est fixe. ✘ `provider` sans adresse, `areaServed` = France |
| `FAQPage` | Accueil et pages de prestations avec FAQ | ✔ Présent et cohérent avec la FAQ visible. ✘ Absent des fiches produit d’impression, qui affichent pourtant une FAQ |
| `BreadcrumbList` | Toutes les pages internes | ✔ Présent. ✘ **URLs `item` relatives (`"/creation-site-internet"`)** : Google exige des URL absolues (même cause qu’en 1.3) |
| `BlogPosting` | Articles | ✔ Correct. Manquent `image` et `author` de type `Person` (optionnel) |
| `aggregateRating` / avis | — | ✔ Volontairement absent : aucun avis réel à ce jour (ne jamais en inventer) |

---

## 3. Contenu

### 3.1 Pages trop courtes (texte principal, hors menu et pied de page)

| Page | Mots | Commentaire |
|---|---|---|
| `/configurateur` | 57 | Page outil : acceptable si elle reste hors des requêtes informationnelles |
| `/cookies` | 63 | Normal (page légale) |
| `/contact` | 116 | ✘ Aucune adresse, aucun téléphone, aucune carte, aucune zone détaillée |
| `/etudes-de-cas` | 103 | ✘ Page liste presque vide |
| `/realisations/*` | 130 à 200 | ✘ Fiches trop maigres pour se positionner et pour convaincre (traité en phase 5) |
| `/impression/autocollants`, `/impression/baches-banderoles` | ~180 | ✘ Produits sur mesure sans contenu explicatif |
| Autres fiches `/impression/*` | 275 à 330 | ✘ L’essentiel du texte vient des options du configurateur |
| Articles de blog | 280 à 350 | Moyen : à étoffer progressivement |

### 3.2 Contenu dupliqué ou quasi dupliqué entre pages de prestations

Une grande partie du texte des pages de prestations vient de blocs communs : processus en 4 étapes, appel à l’action, cartes d’offres partagées, FAQ générale.

| Page | Mots | Part commune avec les autres prestations | Texte propre estimé |
|---|---|---|---|
| `/packs` | 614 | **84 %** | ~100 mots |
| `/cartes-de-visite` | 632 | 69 % | ~195 |
| `/reseaux-sociaux` | 370 | 58 % | ~155 |
| `/creation-site-internet` | 840 | 56 % | ~370 |
| `/flyers-depliants` | 623 | 55 % | ~280 |
| `/referencement-seo` | 528 | 53 % | ~250 |
| `/maintenance-site-internet` | 407 | 51 % | ~200 |
| `/affiches-brochures` | 583 | 50 % | ~290 |
| `/identite-visuelle-logo` | 429 | 49 % | ~220 |
| `/refonte-site-internet` | 399 | 30 % | ~280 |

**Lecture.** Aucune page n’est un doublon, mais le texte propre à chaque sujet est de **100 à 370 mots**. C’est trop peu face à des concurrents locaux qui publient des pages de 800 à 1 500 mots. Les blocs communs ne sont pas pénalisants en soi : il faut surtout **ajouter du contenu spécifique** (problèmes du public visé, étapes concrètes, exemples, erreurs à éviter, FAQ propre, section locale).

`/realisations/x` et `/etudes-de-cas/x` sont des **doublons exacts** (similarité 100 %) : voir 1.3.

### 3.3 Cannibalisation de mots-clés

| Pages en concurrence | Risque | Résolution proposée |
|---|---|---|
| `/flyers-depliants` (création) ↔ `/impression/flyers` (impression) | Moyen : les deux titles parlent d’« impression » | `/flyers-depliants` → « **création** de flyers » ; `/impression/flyers` → « **impression** de flyers ». Liens croisés entre les deux |
| `/cartes-de-visite` ↔ `/impression/cartes-de-visite` ↔ `/impression/cartes-de-visite-premium` | Moyen | Même logique : création ↔ impression ↔ finitions premium |
| `/affiches-brochures` ↔ `/impression/affiches`, `/impression/brochures`, `/impression/roll-up` | Moyen | La page de prestation cible la conception, les fiches ciblent l’impression |
| `/creation-site-internet` ↔ futures pages « artisans » et « paysagistes » | **Fort si mal fait** | La page générale cible « création de site internet » + local ; chaque page métier cible son métier, avec un contenu réellement différent |
| `/referencement-seo` ↔ future page « référencement local pour artisans » | Fort | `/referencement-seo` = SEO global (technique, contenus, suivi). Nouvelle page = fiche Google, avis, pack local, NAP, pour les artisans |
| Pack Visibilité existant (`/packs`) ↔ « Pack visibilité » demandé en phase 3 | **Conflit de nom** | Renommer la nouvelle offre (ex. « Pack ouverture de commerce ») ou étendre le pack existant : **à valider** |
| `/realisations/x` ↔ `/etudes-de-cas/x` | Doublon exact | Voir 1.3 |
| `/blog/visibilite-locale-par-ou-commencer` ↔ `/referencement-seo` | Faible | Intention informationnelle ≠ commerciale ; ajouter un lien de l’article vers la prestation |

### 3.4 Intentions de recherche non couvertes

| Intention | Exemple de requête | Statut |
|---|---|---|
| Agence locale | « agence web Gruchet-le-Valasse », « agence web Pays de Caux », « agence web Le Havre » | ✘ Aucune page, aucun signal local |
| Site par métier | « création site internet artisan », « site internet paysagiste », « site plombier » | ✘ Absent |
| Référencement local | « référencement local artisan », « fiche Google Business artisan » | ✘ Mentionné seulement |
| Vitrophanie / vitrine | « vitrophanie vitrine », « adhésif microperforé vitrine », « lettrage vitrine » | ✘ Absent |
| Signalétique | « panneau de chantier personnalisé », « enseigne commerce », « panneau Dibond » | ✘ Absent (seuls roll-up et bâches existent, sans pose) |
| Véhicules | « marquage véhicule utilitaire », « magnet véhicule » | ✘ Absent |
| Zone d’intervention | « … près de Bolbec / Lillebonne / Fécamp » | ✘ Absent |
| Prix | « prix site internet artisan », « combien coûte une carte de visite » | ✔ Partiellement couvert par `/tarifs` (à relier aux pages métier) |
| Ouverture de commerce | « communication ouverture commerce », « kit ouverture boutique » | ✘ Absent (cible du futur pack) |

---

## 4. SEO local

### 4.1 Cohérence du NAP (nom, adresse, téléphone)

| Élément | Où il devrait apparaître | Aujourd’hui |
|---|---|---|
| Nom | Logo, pied de page, mentions, JSON-LD, Google Business Profile | « Atelier Sillage » = **nom provisoire**, à confirmer : [À COMPLÉTER : nom définitif de l’agence] |
| Adresse | Pied de page, contact, mentions légales, JSON-LD | **Absente** : [À COMPLÉTER : adresse postale exacte, 76210 Gruchet-le-Valasse] |
| Téléphone | En-tête mobile (bouton d’appel), pied de page, contact, JSON-LD | **Absent** : [À COMPLÉTER : numéro de téléphone] |
| E-mail | Pied de page, contact | **Absent** : [À COMPLÉTER : e-mail professionnel] |
| Horaires | Contact, JSON-LD (`openingHoursSpecification`) | Texte générique « 9 h – 18 h » : [À COMPLÉTER : horaires réels, et accueil sur rendez-vous ou non] |

**Bonne nouvelle.** L’architecture prévoit déjà une source unique : *Administration → Paramètres* alimente le pied de page, la page contact, les mentions légales et le JSON-LD. Une fois ces champs remplis, le NAP sera **identique partout par construction**.

En phase 2, il faudra ajouter dans les paramètres :
- **code postal**, **ville** et **coordonnées GPS** distincts (le champ adresse est aujourd’hui un bloc de texte libre) ;
- **liste des communes desservies** ;
- **lien de la fiche Google Business Profile**.

### 4.2 Zone d’intervention et signaux locaux

- ✘ Zone affichée : « Partout en France, à distance ». À remplacer par une formulation à trois niveaux :
  1. **Zone principale** (déplacement et pose) : Gruchet-le-Valasse, Bolbec, Lillebonne, Port-Jérôme-sur-Seine, Saint-Romain-de-Colbosc, Goderville, Fécamp, Yvetot, Rives-en-Seine, Montivilliers, Le Havre.
  2. **Zone secondaire** : Rouen, Seine-Maritime, Eure, Normandie.
  3. **France entière** pour tout ce qui se fait à distance (site, SEO, graphisme, impression livrée).
- ✘ Aucun title, H1 ou paragraphe ne contient de lieu.
- ✘ **Pas de carte sur la page contact.**
  - Recommandation : carte OpenStreetMap chargée seulement au clic, ce qui évite tout traceur et tout bandeau cookies ; ou carte illustrée de la zone en SVG, avec un lien « Itinéraire ».
  - Google Maps intégré dépose des cookies : à éviter sans consentement.
- ✘ Pas de bouton d’appel (`tel:`) visible sur mobile, faute de téléphone renseigné.

### 4.3 Recommandation sur les pages locales (anti-doorway)

**Ne pas créer une page par ville** au texte identique. À la place :
1. **Une page `/zone-intervention` solide**, environ 1 000 mots. Elle explique :
   - où l’agence se déplace (rendez-vous, prises de mesures, photos de vitrine, pose avec le poseur partenaire) ;
   - ce qui se fait à distance ;
   - les délais et conditions de déplacement : [À COMPLÉTER : rayon et éventuels frais de déplacement] ;
   - une présentation sobre du territoire (Pays de Caux, Caux Seine Agglo, estuaire de la Seine) et des types d’entreprises accompagnées (artisans du bâtiment, commerces de centre-bourg, paysagistes, restauration) ;
   - une carte illustrée et la liste des communes.
2. **Des mentions locales naturelles** dans chaque page de prestation (une section « Près de chez vous » propre au sujet). Exemple : pour la vitrophanie, « prise de mesures sur place à Bolbec, Lillebonne ou Fécamp » ; pour le site internet, « rendez-vous à Gruchet-le-Valasse ou en visio ».
3. **Au plus 2 ou 3 pages villes**, et seulement si vous pouvez fournir un contenu réellement spécifique : clients réels, déplacements réguliers, connaissance du tissu commercial.
   - Candidates : **Le Havre** (plus grand bassin, requêtes « agence web Le Havre ») et **Bolbec–Lillebonne / Port-Jérôme** (proximité immédiate, tissu artisanal et industriel).
   - Le mécanisme existe déjà (`/agence-web/<ville>`, refus sous 300 mots) ; il suffira d’écrire le contenu dans l’administration.
   - **Décision à prendre par vous.**

---

## 5. Stratégie de mots-clés

*Sans données de volume (voir la méthode). « Intention » : C = commerciale (veut acheter), I = informationnelle (se renseigne), L = locale (cherche un prestataire proche), N = navigationnelle.*

### 5.1 Pages existantes

| Page | Mot-clé principal | Mots-clés secondaires | Intention |
|---|---|---|---|
| `/` (accueil) | agence web Pays de Caux | agence web Gruchet-le-Valasse · agence de communication Bolbec · création site internet et impression Seine-Maritime · agence web Lillebonne | L + C |
| `/creation-site-internet` | création site internet | création site vitrine · création site internet Le Havre · création site internet Bolbec · site internet TPE Normandie · prix site vitrine | C + L |
| `/refonte-site-internet` | refonte site internet | refaire son site internet · moderniser site web · refonte site sans perdre référencement · refonte site Le Havre | C |
| `/referencement-seo` | référencement naturel | agence SEO Le Havre · référencement site internet Seine-Maritime · audit SEO · optimisation Google | C + L |
| `/maintenance-site-internet` | maintenance site internet | maintenance WordPress · mise à jour site web · sauvegarde site internet · contrat de maintenance site | C |
| `/identite-visuelle-logo` | création de logo | création logo artisan · identité visuelle entreprise · charte graphique TPE · graphiste Pays de Caux | C + L |
| `/flyers-depliants` | création de flyers | création flyer professionnel · conception dépliant · flyer commerce · graphiste flyer Bolbec | C |
| `/cartes-de-visite` | création carte de visite | carte de visite professionnelle · carte de visite artisan · carte de visite originale · carte de visite premium | C |
| `/affiches-brochures` | création d’affiches et brochures | conception brochure entreprise · affiche événement · plaquette commerciale · catalogue produits | C |
| `/reseaux-sociaux` | visuels réseaux sociaux | création visuel Instagram · templates réseaux sociaux entreprise · graphiste réseaux sociaux | C |
| `/packs` | pack communication entreprise | pack site internet et logo · pack création entreprise · kit communication TPE | C |
| `/tarifs` | prix création site internet | tarif site vitrine · prix logo · prix carte de visite · tarif agence web | C + I |
| `/impression` | impression professionnelle | imprimerie en ligne · impression flyers et cartes de visite · imprimeur Pays de Caux | C + L |
| `/impression/flyers` | impression flyers | imprimer des flyers · flyer A5 · flyer recto verso · flyers pas cher | C |
| `/impression/cartes-de-visite` | impression cartes de visite | imprimer cartes de visite · carte de visite 350 g · carte de visite pelliculée | C |
| `/impression/*` (autres) | impression + produit (« impression affiche A2 », « roll-up personnalisé », « étiquettes adhésives rouleau », « bâche publicitaire ») | formats, matières, quantités | C |
| `/realisations` | réalisations agence web | exemples de sites internet · portfolio graphiste · exemples de logos | I + N |
| `/contact` | contact agence web Gruchet-le-Valasse | agence web Bolbec contact · téléphone · adresse | N + L |
| `/a-propos` | agence web locale Pays de Caux | graphiste et développeur web Normandie · agence de communication indépendante | N |
| `/blog/*` | une question par article (« combien de pages pour un site vitrine », « vérifier un flyer avant impression », « visibilité locale par où commencer ») | variantes de la question | I |

### 5.2 Pages à créer

| Page (URL proposée) | Mot-clé principal | Mots-clés secondaires | Intention |
|---|---|---|---|
| `/vitrophanie-signaletique` | vitrophanie et signalétique commerce | vitrophanie vitrine · adhésif microperforé · lettrage vitrine · vitrophanie Lillebonne · signalétique Le Havre | C + L |
| `/vitrophanie-signaletique` (sections ou ancres) | panneau de chantier personnalisé | panneau Dibond · enseigne de façade · bâche publicitaire avec pose · marquage véhicule utilitaire · magnet véhicule | C |
| `/devis-vitrophanie-signaletique` (formulaire) | devis vitrophanie | devis enseigne · devis panneau chantier · devis marquage véhicule | C |
| `/creation-site-internet-artisan` | création site internet artisan | site internet plombier · site électricien · site menuisier · site artisan Seine-Maritime · site artisan Bolbec | C + L |
| `/creation-site-internet-paysagiste` | création site internet paysagiste | site web paysagiste · site entreprise espaces verts · photos chantiers jardin site · site paysagiste Normandie | C + L |
| `/referencement-local-artisan` | référencement local artisan | fiche Google Business artisan · avis Google artisan · apparaître sur Google Maps · SEO local Pays de Caux | C + L |
| `/zone-intervention` | agence web Seine-Maritime | agence web Bolbec · Lillebonne · Fécamp · Yvetot · Le Havre · Port-Jérôme-sur-Seine | L |
| `/agence-web/le-havre` (optionnelle) | agence web Le Havre | création site internet Le Havre · graphiste Le Havre · vitrophanie Le Havre | L |
| `/agence-web/bolbec-lillebonne` (optionnelle) | agence web Bolbec | création site Lillebonne · Port-Jérôme-sur-Seine · communication commerce Bolbec | L |

> **Point à valider : « Création de flyers et cartes de visite » (phase 4, page 4).**
>
> Deux pages existent déjà (`/flyers-depliants` et `/cartes-de-visite`). Les fusionner ferait perdre une URL ; en créer une troisième créerait de la cannibalisation.
>
> **Proposition** : renforcer `/flyers-depliants` en page « Création de flyers » (mot-clé principal) et `/cartes-de-visite` en page « Création de cartes de visite ». Chacune atteint 900 mots ou plus, avec des liens croisés et un renvoi vers le pack flyer + carte.

### 5.3 Packs « Bien démarrer » (phase 6) : répartition des mots-clés

Les packs visent l’intention **« j’ouvre / je lance mon activité »** (métier + ouverture ou création). Les pages prestations visent l’intention **« je cherche une prestation »**. Chaque mot-clé n’a qu’une page cible.

| Page | Mot-clé principal | Variantes naturelles (dont locales) | Page à ne pas concurrencer, et sa cible |
|---|---|---|---|
| `/packs` | pack communication création d’entreprise | pack ouverture d’activité · communication par métier · lancer son activité Pays de Caux | — |
| `/packs/restaurant` | communication ouverture restaurant | ouvrir un restaurant · menu en ligne · carte des plats · restaurant Bolbec, Le Havre, Fécamp | `/vitrophanie-vitrine-commerce` (vitrophanie vitrine) · `/creation-site-internet` (création de site, générique) |
| `/packs/paysagiste` | communication paysagiste création d’entreprise | lancer son entreprise de paysage · flocage utilitaire paysagiste · flyers entretien de jardin · Pays de Caux | `/creation-site-internet-paysagiste` (création site internet paysagiste) |
| `/packs/coiffeur` | communication ouverture salon de coiffure | ouverture institut de beauté · cartes de fidélité salon · prise de rendez-vous en ligne · Lillebonne, Bolbec | `/vitrophanie-vitrine-commerce` · `/cartes-de-visite` |
| `/packs/artisan-batiment` | communication création entreprise artisan bâtiment | s’installer artisan · panneau de chantier · flocage véhicule artisan · devis à en-tête | `/creation-site-internet-artisan` (création site internet artisan) · `/referencement-local-artisan` (référencement local artisan) |

**Arbitrage.** L’exemple « site internet paysagiste » proposé pour le pack paysagiste aurait concurrencé directement la page `/creation-site-internet-paysagiste` (phase 4). Le pack vise donc la **création d’entreprise** (« lancer son entreprise de paysage », « communication paysagiste »), et la page prestation garde « création site internet paysagiste ».

**Garde-fous appliqués :**

- **Titres et H1 des packs** formulés autour de l’ouverture (« Vous ouvrez votre restaurant ? »), jamais autour d’une prestation seule.
- **Liens croisés avec des ancres distinctes** : la page prestation renvoie vers « Pack Bien démarrer — Paysagiste », et le pack renvoie vers « Site internet pour paysagistes ».
- **Contenu propre à chaque pack** : un test automatique refuse toute phrase de plus de 50 caractères présente dans deux packs.
- **À surveiller dans la Search Console**, une fois en ligne : si une requête affiche alternativement deux de ces pages, renforcer l’ancrage de la page cible et retirer le terme de l’autre.


### 5.4 Module caisse et paiement par carte

| Page | Mot-clé principal | Variantes naturelles (dont locales) | Page à ne pas concurrencer |
|---|---|---|---|
| `/caisse-paiement-carte` | installation caisse enregistreuse | paramétrage caisse · caisse enregistreuse restaurant, coiffure, boulangerie · terminal de paiement carte commerce · caisse conforme · Pays de Caux | aucune (sujet nouveau) ; les packs n’en parlent qu’en option, avec un lien |

**Choix rédactionnels :**

- Aucune marque n’est citée.
- La page présente l’installation de **solutions existantes conformes** (certificat ou attestation de l’éditeur, loi de finances 2026).
- Le **module seul** est mis en avant dès le H1 et le premier bouton.

### 5.5 Limites de titres et descriptions (appliquées le 21/10/2026)

- **Titres ≤ 60 caractères** : au-delà, Google les coupe. Le nom de l’agence n’est ajouté au titre que s’il tient dans la limite.
- **Méta-descriptions entre 70 et 160 caractères.**
- **Un seul H1 par page, URL canonique absolue, titres uniques.**
- Le test `tests/seo-limits.test.ts` vérifie ces règles sur **toutes les pages du sitemap** à chaque modification.
- Les valeurs stockées en base (titres d’articles d’origine, description de la page Lillebonne) sont corrigées par la migration 7, sans écraser une saisie faite dans l’administration.

> **Point d’attention : domaine non relié.** Le site déclare `https://www.signeetseine.fr` comme adresse canonique, mais ce domaine affiche encore la page « Site en construction » d’OVH. Tant que le domaine n’est pas relié à Cloudflare, Google est renvoyé vers une page vide. Relier le domaine est **la priorité SEO n° 1**.

## 6. Plan d’action priorisé

Impact : ●●● fort · ●● moyen · ● faible. Effort : S (< 1 h) · M (demi-journée) · L (1 jour ou plus).

| # | Problème | Impact | Effort | Fichier concerné | Correction proposée |
|---|---|---|---|---|---|
| 1 | Aucun NAP, aucune adresse, nom provisoire | ●●● | S + vous | *Administration → Paramètres* ; `src/domain/settings.ts` | Remplir nom, adresse, téléphone, e-mail, horaires. Ajouter les champs code postal, ville, GPS, communes desservies et lien Google Business |
| 2 | Aucun signal local dans les titles, H1 et contenus | ●●● | M | `src/web/content.ts`, `src/web/public/home.tsx`, `pages.tsx` | Mentions locales naturelles, section « Près de chez vous » propre à chaque prestation |
| 3 | JSON-LD `ProfessionalService` pauvre | ●●● | S | `src/web/public/home.tsx` (`organizationJsonLd`) | Adresse `PostalAddress`, `geo`, `telephone`, `url`, `logo`, `image`, `areaServed` = liste des communes (`City`) et départements, `openingHoursSpecification`, `sameAs` ; plus un bloc `WebSite` |
| 4 | Canonical et `BreadcrumbList` en URL relatives | ●●● | S | `src/web/layout.tsx` | URL absolues (adresse du site, sinon origine de la requête) ; `og:url` toujours présent |
| 5 | Domaine `workers.dev`, pas de domaine définitif | ●●● | S + vous | Cloudflare | Brancher le domaine, puis renseigner l’adresse du site |
| 6 | Doublons `/etudes-de-cas/x` = `/realisations/x` | ●● | S | `src/routes/public.tsx`, `src/routes/seo.ts` | Redirection 301 vers `/realisations/x` et retrait du sitemap (la page liste `/etudes-de-cas` reste) |
| 7 | H1 slogans sans mot-clé | ●● | S | `src/web/content.ts` | H1 = mot-clé + accroche en italique |
| 8 | Titles trop longs, descriptions > 160 | ●● | S | `content.ts`, `print.tsx`, `pages.tsx`, `layout.tsx` | Titles ≤ 60 caractères, suffixe de marque court, descriptions de 120 à 155 caractères avec lieu quand c’est pertinent |
| 9 | Pas de page zone d’intervention ni de carte | ●●● | M | nouvelle route + `pages.tsx` | Page `/zone-intervention`, carte sans traceur sur `/contact`, bouton d’appel |
| 10 | Pages de prestations trop courtes | ●●● | L | `content.ts` + gabarit | Phase 4 : 900 à 1 500 mots spécifiques, FAQ propre, erreurs à éviter, exemples |
| 11 | Intentions non couvertes (artisans, paysagistes, SEO local, vitrophanie) | ●●● | L | nouvelles pages | Phases 3 et 4 |
| 12 | Pas d’`og:image` ni de `twitter:card` | ●● | M | `layout.tsx` + image 1200 × 630 | Image de partage par défaut, puis par rubrique |
| 13 | HTTP non redirigé vers HTTPS | ●● | S | `src/app.tsx` (middleware) | Redirection 301 vers HTTPS en production |
| 14 | Cache navigateur nul sur CSS, JS et polices | ● | S | `public/_headers` | `Cache-Control: public, max-age=604800` sur `/assets/*` |
| 15 | Maillage pauvre (fiches impression, réalisations, blog) | ●● | M | `print.tsx`, `pages.tsx` | Liens prestation ↔ fiche impression ↔ réalisation ↔ article |
| 16 | `FAQPage` absent des fiches impression qui ont une FAQ | ● | S | `print.tsx` | Ajouter le bloc `FAQPage` |
| 17 | Fiches réalisations maigres | ●● | L | phase 5 | Fiches restructurées, avant/après, mises en situation |
| 18 | Pas de composant image optimisé pour les futures photos | ●● | M | `components.tsx` | Composant image (WebP/AVIF, dimensions, `loading="lazy"`, alt obligatoire) |
| 19 | Police italique des titres non préchargée | ● | S | `layout.tsx` | Préchargement sur les pages où le H1 contient de l’italique (accueil, prestations) |
| 20 | Descriptions trop courtes des fiches réalisations | ● | S | données (admin) | Réécrites en phase 5 |

---

## 7. Hors site (à faire par vous, aucun code)

Par ordre de priorité :

1. **Choisir et fixer le nom définitif** (vérification INPI, disponibilité du nom de domaine), puis **brancher le domaine** sur le site.
2. **Google Business Profile** (business.google.com) :
   - catégorie principale « Agence de conception de sites Web » ou « Concepteur de sites Web » ; secondaires « Graphiste », « Service d’impression », « Agence de marketing » ;
   - si vous ne recevez pas de public à l’adresse : la masquer et déclarer une **zone desservie** (les communes de la zone principale) ;
   - NAP strictement identique au site ;
   - lien vers le site, horaires, description sans mots-clés en série, vraies photos (vous, vos supports, vos poses de vitrophanie dès les premiers chantiers) ;
   - **publications régulières** (une par semaine ou toutes les deux semaines).
3. **Google Search Console** :
   - valider le domaine ;
   - coller le code de vérification dans *Paramètres* ;
   - soumettre `/sitemap.xml` ;
   - suivre requêtes et indexation.
4. **Bing Webmaster Tools** : importer la propriété depuis la Search Console (2 minutes).
5. **Stratégie d’avis Google**, sans jamais en acheter ni en écrire :
   - demander un avis à chaque projet livré (lien court de la fiche dans l’e-mail de livraison et sur la facture) ;
   - répondre à tous les avis ;
   - viser la régularité plutôt que le volume.
6. **Cohérence NAP externe** : même nom, même adresse, même téléphone, au caractère près, partout :
   - **PagesJaunes** (fiche gratuite) ;
   - **CCI Seine Estuaire** (annuaire des entreprises) ;
   - **Chambre de Métiers et de l’Artisanat de Normandie**, si votre statut le permet ;
   - **annuaires d’entreprises de Caux Seine Agglo et de votre commune**, s’ils existent ;
   - **Apple Plans** (Apple Business Connect), **Bing Places** ;
   - fiche LinkedIn entreprise, page Facebook.
7. **Réseau local** :
   - clubs d’entreprises du territoire ;
   - partenariats croisés (lien mutuel légitime) avec votre imprimeur, votre poseur et des artisans clients ;
   - événements locaux.
8. **Une fois de vrais clients obtenus** :
   - remplacer les concepts par de vraies réalisations (avec accord écrit) ;
   - demander un lien « site réalisé par » en pied de page de leur site (avec `rel` adapté), à leur discrétion.

---

## 8. Questions à valider avant la phase 2

1. **Nom définitif de l’agence**, ou garder « Atelier Sillage » provisoirement ?
2. **Coordonnées** : adresse à afficher, ou masquée (zone desservie seulement) ? Téléphone, e-mail, horaires ?
3. **Domaine** : avez-vous déjà un nom de domaine ?
4. **Pages villes** : on en crée (Le Havre, Bolbec–Lillebonne) ou on se limite à `/zone-intervention` ?
5. **Pack** : renommer le nouveau pack (ex. « Pack ouverture de commerce ») ou fusionner avec le « Pack Visibilité » existant ?
6. **Flyers et cartes de visite** : d’accord pour renforcer les deux pages existantes plutôt que d’en créer une nouvelle ?
7. **Études de cas en double** : d’accord pour rediriger `/etudes-de-cas/x` vers `/realisations/x` ?
8. **Rayon et frais de déplacement** pour la prise de mesures et la pose (mention sur la page zone d’intervention) ?

---

## Récapitulatif des placeholders identifiés à ce stade

- [À COMPLÉTER : nom définitif de l’agence]
- [À COMPLÉTER : adresse postale exacte, 76210 Gruchet-le-Valasse]
- [À COMPLÉTER : numéro de téléphone]
- [À COMPLÉTER : e-mail professionnel]
- [À COMPLÉTER : horaires réels / accueil sur rendez-vous]
- [À COMPLÉTER : coordonnées GPS de l’adresse (latitude, longitude)]
- [À COMPLÉTER : nom de domaine définitif]
- [À COMPLÉTER : lien de la fiche Google Business Profile]
- [À COMPLÉTER : liens des réseaux sociaux de l’agence]
- [À COMPLÉTER : SIREN/SIRET, forme juridique, TVA (déjà demandés par l’administration)]
- [À COMPLÉTER : rayon et éventuels frais de déplacement]
