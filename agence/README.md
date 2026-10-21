# Agence web & communication

Site public premium + back-office complet pour une agence de services numériques destinée aux indépendants, artisans, commerçants et TPE :
sites internet, refontes, identité visuelle, flyers, cartes de visite, supports imprimés, réseaux sociaux, SEO, maintenance et packs.

> **Projet indépendant de Paysapro AI / Paysapro Prospection.** Il vit dans ce dossier `agence/`, avec ses propres dépendances,
> sa propre base de données et son propre déploiement. Aucune donnée, aucun compte et aucune ressource Cloudflare n’est partagé.

Nom : **Signe & Seine** (Gruchet-le-Valasse) — modifiable dans *Administration → Paramètres* (le logo provisoire, le favicon, les e-mails
et les documents suivent automatiquement).

## Ce qui est livré

| Domaine | Contenu |
|---|---|
| Site public | 25+ pages : accueil, 10 pages de prestations, packs, tarifs, catalogue d’impression, configurateur, devis en 6 étapes, réalisations, études de cas, à propos, contact, blog, mentions légales, confidentialité, cookies, CGV, espace client, plan du site, 404 |
| Impression | Catalogue (flyers, cartes, cartes premium, dépliants, affiches, brochures, roll-up, étiquettes, autocollants, bâches), configurateur avec estimation séparant création / impression / livraison / HT / TVA / TTC, recherche **stricte** de la variante exacte (aucune extrapolation) |
| Prix fournisseurs | Référentiel `supplier_price_variants` : vérification datée et sourcée, expiration paramétrable, validation explicite du prix de vente, alerte si le coût change (le prix public n’est jamais modifié automatiquement) |
| Commercial | Demandes de devis, CRM (statuts, historique, relances, export CSV protégé), devis (lignes, coûts internes, marge, envoi, acceptation en ligne, versions), factures (numérotation continue atomique, avoirs, mentions légales figées), abonnements |
| Production | Commandes d’impression (16 statuts, garde-fous BAT et commande fournisseur réelle), BAT versionnés avec checklist prépresse obligatoire et lecture indicative des PDF, projets web (checklists SEO/sécurité, recette client avant mise en ligne, journal) |
| Pilotage | Tableau de bord sur données réelles : prospects, devis, commandes, factures, CA, coûts directs, marge brute, abonnements, retards, alertes |
| SEO | URLs propres, titres et descriptions uniques, canoniques, sitemap XML, robots.txt, JSON-LD exact (aucune adresse ni avis inventés), fil d’Ariane, redirections administrables, pages locales protégées contre le contenu creux, 404 utile |
| Sécurité | CSP stricte sans script en ligne, sessions HttpOnly/SameSite=Strict, CSRF, limitation de débit, pot de miel + jeton signé, validation serveur (zod), contrôle du type réel des fichiers, fichiers privés, journal d’audit, aucun secret dans le code |

## Démarrer en local

```bash
cd agence
npm install
cp .env.example .env        # facultatif en local
npm run dev                 # http://localhost:3000
npm run admin:create        # crée votre compte administrateur
```

Administration : http://localhost:3000/admin

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | développement (rechargement automatique) |
| `npm run build` | vérification TypeScript + scripts navigateur + serveur de production + contrôle du bundle Cloudflare |
| `npm start` | serveur de production Node (`dist/`) |
| `npm test` | tests automatisés (domaine, site public, administration, parcours complet) |
| `npm run test:e2e` | recette HTTP de bout en bout contre un serveur lancé (`BASE_URL`, `SETUP_TOKEN`) |
| `npm run check:public` | vérifie l’absence de données sensibles dans les ressources publiques |
| `node scripts/a11y.mjs` | accessibilité (axe-core) et responsive sur mobile, tablette, ordinateur (`BASE_URL`) |
| `npm run admin:create` | crée un administrateur ou réinitialise un mot de passe |
| `CHROMIUM_PATH=/chemin/chromium node scripts/og-image.mjs` | régénère l’image de partage (1200×630) et le logo 512 px |

## Documentation

- [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) — mise en ligne (Cloudflare gratuit ou serveur Node)
- [docs/SERVICES-EXTERNES.md](docs/SERVICES-EXTERNES.md) — services à configurer et leur coût
- [docs/CHECKLIST-PRODUCTION.md](docs/CHECKLIST-PRODUCTION.md) — à vérifier avant d’ouvrir au public
- [docs/GUIDE-ADMINISTRATION.md](docs/GUIDE-ADMINISTRATION.md) — utilisation quotidienne, sans code
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — choix techniques et organisation du code
