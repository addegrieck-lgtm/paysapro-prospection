# Livrable SEO — phases 1 à 5

Site **Signe & Seine** (agence web, print et signalétique, Gruchet-le-Valasse).
Audit initial : [AUDIT-SEO.md](AUDIT-SEO.md).

Règles respectées sur l’ensemble du travail :

- Aucune URL existante supprimée. Seul changement d’adresse : `/etudes-de-cas/<slug>` redirige en **301** vers `/realisations/<slug>`.
- Aucun faux avis, aucune fausse statistique, aucun client inventé : les réalisations restent des **concepts de démonstration**, signalés comme tels.
- Le nom du fournisseur d’impression n’apparaît sur aucune page publique.
- Toute la signalétique est **sur devis**.

---

## 1. Ce qui a été fait, phase par phase

### Phase 2 — Corrections techniques

- **Coordonnées complètes** : nom, commune et code postal, téléphone, e-mail et horaires, sur le site et dans les données structurées. La rue n’est pas publiée.
- **Fiche entreprise pour Google** (JSON-LD `ProfessionalService`) : position GPS, horaires, zone desservie, téléphone au format international.
- **Données structurées des pages** : prestations (`Service`), fil d’Ariane (`BreadcrumbList`) et FAQ (`FAQPage`) sur les fiches d’impression et les nouvelles pages.
- **Adresses absolues** : URL canonique, `og:url` et fil d’Ariane.
- **Partage** : image de partage 1200 × 630, logo 512 px, balises Twitter.
- **Titres et descriptions** : réécrits à 60 et 160 caractères au plus, avec des H1 descriptifs.
- **Redirections** : HTTP vers HTTPS en production, `/etudes-de-cas/:slug` en 301.
- **Cache** : mise en cache des polices, styles et images.
- **Page contact** : localisation, bouton d’appel, carte OpenStreetMap chargée seulement au clic, avec la mention correspondante dans les pages confidentialité et cookies.
- **Administration → Paramètres** : section « Localisation et zone desservie ».

### Identité visuelle (entre les phases 2 et 3)

- **Logo** : symbole « falaises » (arche et aiguille au-dessus de la Seine) et nom en capitales Josefin Sans.
- **Palette** : bleu Seine, sable et ocre.
- **Accueil** :
  - accroche « Une image à la hauteur de votre savoir-faire » ;
  - panorama de falaises ;
  - ruban défilant des métiers ;
  - vitrine habillée dans l’illustration.

### Phase 3 — Vitrophanie & signalétique

- **Page `/vitrophanie-signaletique`** :
  - 9 types de supports ;
  - création, impression professionnelle et pose par le poseur partenaire ;
  - déroulement en 6 étapes ;
  - guide des matériaux ;
  - **pack ouverture de commerce** ;
  - zone de pose ;
  - FAQ de 7 questions.
- **Formulaire `/devis-vitrophanie-signaletique`** : choix des besoins, commune, dimensions, quantité, création, pose, délai, budget, **jusqu’à 5 photos** (type réel du fichier contrôlé) et coordonnées. La demande arrive dans le CRM avec le type « Vitrophanie & signalétique ».
- **Deux prestations sur devis** visibles dans les tarifs : « Vitrophanie & signalétique » et « Pack ouverture de commerce ».
- **Menu, pied de page et tuile d’accueil** ajoutés.

### Phase 4 — Pages SEO et SEO local

| Page | Mot-clé principal | Mots (contenu principal) |
|---|---|---|
| `/creation-site-internet-artisan` | création site internet artisan | ≈ 1 070 |
| `/creation-site-internet-paysagiste` | création site internet paysagiste | ≈ 940 |
| `/referencement-local-artisan` | référencement local artisan | ≈ 1 040 |
| `/vitrophanie-vitrine-commerce` | vitrophanie vitrine commerce | ≈ 1 030 |
| `/flyers-depliants` (renforcée) | création de flyers | ≈ 1 070 |
| `/cartes-de-visite` (renforcée) | création de cartes de visite | ≈ 1 060 |
| `/zone-intervention` | agence web Seine-Maritime / Pays de Caux | ≈ 880 |
| `/agence-web/le-havre` | agence web Le Havre | ≈ 440 |
| `/agence-web/bolbec` | agence web Bolbec | ≈ 420 |
| `/agence-web/lillebonne` | agence web Lillebonne | ≈ 430 |

Chaque page contient :

- une FAQ, avec ses données structurées (JSON-LD `FAQPage`) ;
- une section locale ;
- des liens vers les pages proches (maillage interne) ;
- un appel à l’action.

Les pages villes ont un **contenu propre** à chaque ville, pour ne pas être des copies l’une de l’autre :

- **Le Havre** : centre classé à l’UNESCO et règles d’enseigne, entreprises liées au port.
- **Bolbec** : commune voisine de Gruchet, commerces du centre, passé textile.
- **Lillebonne** : théâtre romain (Juliobona), entreprises du bassin de Port-Jérôme, recrutement local.

Les pages villes sont modifiables dans **Administration → Contenus → Pages locales**. Les communes qui ont une page publiée deviennent automatiquement des liens dans la liste des communes de la zone.

Flyers et cartes de visite : les deux pages existantes ont été **renforcées** plutôt que fusionnées, pour éviter qu’une troisième page leur fasse concurrence sur les mêmes recherches.

### Phase 5 — Portfolio commercial

- **Nouveaux champs** : type de client, besoin, prestations liées (liens vers les pages), objectifs (pas des résultats), légendes avant / après, témoignage, auteur et case « autorisation écrite ».
- **Protections dans l’administration** :
  - un concept ne peut pas afficher de témoignage ;
  - un témoignage ne peut pas être publié sans la case d’autorisation cochée.
- **Fiche projet** :
  - encadré (type de client, besoin, prestations) ;
  - **comparatif avant / après** avec curseur ;
  - objectifs, réponse, livrables ;
  - bandeau « Un projet comparable ? » ;
  - badge « Concept de démonstration » ou « Client réel ».
- **Deux nouveaux concepts** : **Fournil du Caux** (boulangerie, vitrine et pack ouverture) et **Jardins de la Valmont** (site de paysagiste).
- Les six concepts existants ont été enrichis : type de client, besoin, prestations, objectifs.

---

## 2. Fichiers créés ou modifiés

**Créés**

- `AUDIT-SEO.md` — audit (phase 1)
- `LIVRABLE-SEO.md` — ce document
- `src/web/seo.ts` — données structurées de l’entreprise, zone desservie, lien téléphone
- `src/web/landing.ts` — contenu des pages thématiques (vitrophanie, pages métiers, zone)
- `src/web/public/landing.tsx` — gabarit des pages thématiques et formulaire de devis signalétique
- `src/db/content-v3.ts` — pages villes, prestations sur devis, contenus du portfolio
- `scripts/og-image.mjs` — génération de l’image de partage et du logo 512 px
- `public/_headers` — cache des ressources statiques (Cloudflare)
- `public/assets/img/og-default.png`, `public/assets/img/logo-512.png`
- `public/assets/fonts/josefin-sans-latin-wght-normal.woff2`, `…-italic.woff2` (licence SIL OFL)
- `tests/pages-v3.test.ts` — tests des phases 3 à 5, dont la migration sur une base existante

**Modifiés**

- `src/domain/settings.ts` — coordonnées, zone, horaires structurés
- `src/db/migrations.ts` — migration 2 (coordonnées) et migration 3 (portfolio, prestations, pages villes), toutes deux non destructives
- `src/db/seed.ts` — enrichissement du portfolio sur une base neuve
- `src/app.tsx`, `src/app/context.ts`, `src/server/worker.ts`, `src/server/node.ts` — HTTPS et cache
- `src/app/security.ts` — CSP : carte OpenStreetMap
- `src/routes/public.tsx` — nouvelles pages, formulaire de devis signalétique, redirection 301
- `src/routes/seo.ts` — sitemap, favicon
- `src/routes/admin/settings.tsx` — section localisation
- `src/routes/admin/content.tsx` — champs du portfolio et contrôles
- `src/web/layout.tsx` — logo, menu, pied de page, balises de partage
- `src/web/components.tsx` — carte au clic
- `src/web/content.ts` — titres et descriptions, sections éditoriales flyers et cartes
- `src/web/illustrations.tsx` — vitrine, vitrine vierge, ancien site, site de paysagiste, panorama de falaises
- `src/web/public/home.tsx`, `pages.tsx`, `print.tsx`, `legal.tsx`, `quote.tsx`
- `src/client/site.ts` — carte au clic, curseur avant / après
- `public/assets/css/site.css`
- `scripts/a11y.mjs` — nouvelles pages contrôlées
- `tests/public.test.ts`, `tests/domain.test.ts`, `tests/admin.test.ts`
- `README.md`

---

## 3. Tous les placeholders `[À COMPLÉTER]`

### Affichés sur le site

| Où | Placeholder | Comment le modifier |
|---|---|---|
| `/vitrophanie-signaletique` (section « Pose dans le Pays de Caux ») | rayon d’intervention pour la pose et frais de déplacement | Me le donner (texte dans `src/web/landing.ts`) |
| `/vitrophanie-vitrine-commerce` (section locale) | rayon d’intervention pour la pose et frais de déplacement | Idem |
| `/zone-intervention` (section « Notre zone ») | rayon couvert sans frais, frais au-delà, délais de pose habituels | Idem |
| `/zone-intervention` (FAQ) | rayon couvert sans frais et frais au-delà | Idem |
| `/agence-web/le-havre` | frais de déplacement éventuels pour Le Havre | Administration → Contenus → Pages locales |
| `/agence-web/bolbec` | confirmer l’absence de frais de déplacement pour Bolbec | Idem |
| `/agence-web/lillebonne` | confirmer l’absence de frais de déplacement pour Lillebonne | Idem |

### Informations manquantes, non affichées tant qu’elles sont vides

Elles sont à saisir dans *Administration → Paramètres*.

- [À COMPLÉTER : adresse de rue] : facultative, à laisser vide si vous ne recevez pas de public.
- [À COMPLÉTER : lien de la fiche Google Business Profile] : alimente le lien `sameAs` des données structurées.
- [À COMPLÉTER : liens des réseaux sociaux].
- [À COMPLÉTER : nom de domaine définitif] (champ « Adresse du site ») : sert aux URL canoniques, au sitemap et aux liens des e-mails.
- [À COMPLÉTER : position GPS exacte] : c’est actuellement le centre de Gruchet-le-Valasse.
- [À COMPLÉTER : informations légales] (SIRET, forme juridique, hébergeur…) : déjà signalées par l’alerte de l’administration.
- [À COMPLÉTER : nom définitif confirmé] : case « Nom définitif » dans Paramètres, après vérification INPI et du nom de domaine.

### À fournir plus tard (portfolio)

- [À COMPLÉTER : premières réalisations réelles], avec l’accord écrit des clients. Dans la fiche, décocher « concept ».
- [À COMPLÉTER : témoignages réels], avec autorisation écrite. Champ « Témoignage » et case « autorisation » dans la fiche.

---

## 4. Visuels et maquettes à produire

Les illustrations actuelles sont des **dessins vectoriels de démonstration**. Pour crédibiliser le site, il faudra les remplacer progressivement par de vraies images.

**Priorité haute**

1. **Photo de vous** (portrait professionnel) pour la page *À propos* et la fiche Google.
2. **Photos de vraies poses de vitrophanie**, avant et après, sous le même angle, dès les premiers chantiers. Elles alimentent le comparatif avant / après.
3. **Mises en situation sur photo** pour les premiers clients : vitrine, véhicule, panneau de chantier. Elles servent pour les devis et pour le portfolio.
4. **Captures de vrais sites livrés** : ordinateur et téléphone.

**Priorité moyenne**

5. **Photos de supports imprimés réels** : flyers, cartes, kakémono, sur fond neutre et en lumière naturelle.
6. **Photo de l’utilitaire marqué** aux couleurs de Signe & Seine, si vous en avez un. C’est un bon support pour la fiche Google.
7. **Photos d’ambiance locale** prises par vous : Gruchet-le-Valasse, abbaye du Valasse, falaises, centre de Bolbec, Lillebonne. Elles serviront pour les pages villes et les réseaux sociaux. Pas d’images de banque présentées comme les vôtres.

**Priorité basse**

8. **Planche de logo** en vectoriel (SVG ou PDF) pour l’imprimeur et la vitrophanie de votre propre véhicule ou local.

Une fois des images réelles disponibles, il faudra ajouter dans l’administration un champ image pour chaque réalisation. Le portfolio n’accepte aujourd’hui que les visuels vectoriels intégrés. C’est une évolution simple à prévoir.

---

## 5. Actions hors site, par priorité

1. **Choisir le nom de domaine** (par exemple `signeetseine.fr`), le brancher sur Cloudflare, puis renseigner « Adresse du site » dans Paramètres.
2. **Créer la fiche Google Business Profile** :
   - catégorie principale « Concepteur de sites Web » ;
   - catégories secondaires « Graphiste », « Service d’impression » et une catégorie liée aux enseignes, à choisir dans la liste proposée par Google ;
   - adresse masquée et **zone desservie** sur les communes de la zone principale ;
   - horaires du lundi au samedi, 8 h 30 – 20 h ;
   - nom, adresse et téléphone **strictement identiques** au site ;
   - vraies photos ;
   - une publication toutes les une à deux semaines.
3. **Google Search Console** :
   - vérifier le domaine (code dans Paramètres) ;
   - soumettre `/sitemap.xml` ;
   - demander l’indexation des nouvelles pages.
4. **Bing Webmaster Tools** : importer la propriété depuis la Search Console.
5. **Avis Google** :
   - lien court dans l’e-mail de livraison et sur la facture ;
   - demande systématique après chaque projet ;
   - réponse à chaque avis ;
   - jamais d’avis achetés ou rédigés vous-même.
6. **Mêmes coordonnées partout**, au caractère près :
   - PagesJaunes, annuaire de la CCI Seine Estuaire, Apple Business Connect, Bing Places ;
   - annuaires de Caux Seine Agglo et de Gruchet-le-Valasse, s’ils existent ;
   - page LinkedIn, page Facebook.
7. **Partenaires** : liens réciproques légitimes avec le poseur partenaire et avec des artisans clients, par exemple un lien « site réalisé par » si le client l’accepte.
8. **Réseau local** :
   - clubs d’entreprises du territoire ;
   - commerçants des centres-villes de Bolbec et Lillebonne, en proposant la maquette de vitrine sur photo ;
   - événements locaux.
9. **Vitrophanie de votre propre véhicule ou local**, aux couleurs de Signe & Seine. C’est à la fois une vitrine et un premier « avant / après » réel.

---

## 6. Commandes de vérification et de mise en ligne

```bash
cd agence
npm install
npm run typecheck        # vérification TypeScript
npm test                 # 81 tests automatisés (domaine, site, administration, phases 3 à 5)
npm run build            # compilation + contrôle du bundle Cloudflare Workers
npm run check:public     # aucune donnée sensible dans les ressources publiques

# Accessibilité et responsive (serveur lancé localement)
npm start &              # ou : npm run dev
BASE_URL=http://localhost:3000 node scripts/a11y.mjs

# Régénérer l'image de partage et le logo 512 px (si le nom ou la couleur changent)
CHROMIUM_PATH=/chemin/vers/chromium node scripts/og-image.mjs
```

**Mise en ligne** :

1. Fusionner la branche dans `main` (pull request).
2. Lancer le workflow GitHub Actions **« Agence — mise en ligne Cloudflare »**.
3. Les migrations 2 et 3 s’appliquent automatiquement au démarrage. Elles n’écrasent aucune donnée saisie dans l’administration.

**Après la mise en ligne, contrôler** :

- le [test des résultats enrichis](https://search.google.com/test/rich-results) sur l’accueil, `/vitrophanie-signaletique` et une fiche d’impression ;
- l’affichage de la carte sur `/contact` (clic sur « Afficher la carte ») ;
- l’envoi d’une demande test depuis `/devis-vitrophanie-signaletique`, avec une photo ;
- la redirection `/etudes-de-cas/les-pages-lentes` → `/realisations/les-pages-lentes`.
