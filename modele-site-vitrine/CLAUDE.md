# Modèle de site vitrine multi-métiers

Site statique Astro dont **tout le contenu** est dans `src/content/*.json`, modifiable par le client
dans Pages CMS (configuration : `.pages.yml`). Aucune base de données, aucun serveur.

## Règles pour adapter le site à un client

- Le contenu (textes, coordonnées, couleurs, sections affichées) se change **uniquement** dans `src/content/*.json`,
  jamais en dur dans les fichiers `.astro` : sinon le client ne pourrait plus le modifier.
- Pour ajouter un champ modifiable : 1) l'ajouter au JSON, 2) à l'interface de type dans `src/lib/contenu.ts`,
  3) à `.pages.yml` (même `name`), 4) l'afficher dans la page. Les quatre doivent rester synchronisés.
- Écrire tous les textes en français, ton adapté au métier, sans promesses invérifiables (pas de faux avis :
  laisser `avis.liste` vide si le client n'en fournit pas).
- `entreprise.categorie` doit être un type schema.org listé dans `.pages.yml`.
- Images : fichiers dans `public/images/`, référencés par `/images/nom.jpg`.
- Vérifier avant de livrer : `npm run check` (0 erreur) puis `npm run build`.

## Commandes

- `npm run dev` : aperçu local
- `npm run exemple -- <plombier|restaurant|coiffeur|avocat>` : pré-remplit le contenu d'un métier
- `npm run check` / `npm run build` : vérification et version finale (`dist/`)
