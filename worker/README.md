# Relais web gratuit (Cloudflare Worker)

Ce relais permet à Paysapro Prospection de lire les **coordonnées publiées par chaque entreprise sur son propre site**
(accueil, contact, mentions légales). Sans lui, tout fonctionne, mais cette source est désactivée.

- **Coût : 0 €** (offre gratuite Cloudflare Workers : 100 000 requêtes / jour, sans carte bancaire).
- **Garde-fous** : pages HTML publiques uniquement, `robots.txt` respecté, 1 requête par seconde côté application,
  moteurs de recherche, annuaires et réseaux sociaux **refusés**, adresses privées refusées, origines limitées.

> **Déjà en place** : `https://paysapro-relais.paysapro-prospection.workers.dev`, déployé avec
> `npx wrangler@4 deploy --config worker/wrangler.toml` (nom, origines autorisées et stockage KV `BACKUPS` des sauvegardes en ligne y sont décrits)
> (même commande pour une mise à jour) ; adresse renseignée par défaut dans `.github/workflows/deploy.yml`.

## Déployer (10 minutes)

1. Créez un compte gratuit sur https://dash.cloudflare.com/sign-up (aucune carte bancaire).
2. *Workers & Pages* → *Create* → *Create Worker* → nommez-le `paysapro-relais` → *Deploy*.
3. *Edit code* : remplacez tout le contenu par celui de `worker/web-proxy.js`, puis *Deploy*.
4. *Settings* → *Variables and Secrets* → ajoutez `ALLOWED_ORIGINS` =
   `https://addegrieck-lgtm.github.io` (ajoutez `,http://localhost:5195` pour le développement).
5. Copiez l'adresse du Worker (ex. `https://paysapro-relais.votre-nom.workers.dev`).
6. Dans le dépôt GitHub : *Settings* → *Secrets and variables* → *Actions* → onglet *Variables* →
   *New repository variable* : `VITE_WEB_PROXY_URL` = l'adresse du Worker. Relancez le déploiement
   (ou faites un nouveau commit). En local : ajoutez la même ligne dans `.env.local`.

## En local, sans Cloudflare

```bash
node worker/dev-server.mjs
```

puis `VITE_WEB_PROXY_URL=http://localhost:8787` dans `.env.local`.

## Services facultatifs : recherche web et fiches Google

Le relais peut aussi appeler deux API **officielles** pour l'enrichissement. Leurs clés restent sur le relais
(secrets Cloudflare) : elles ne sont jamais dans l'application. Sans clé, ces services sont simplement ignorés.

| Service | Secret du relais | Ce que ça apporte | Où créer la clé |
|---|---|---|---|
| Recherche web (`GET /search`) | `BRAVE_SEARCH_KEY` | trouve le site officiel et les pages Facebook / Instagram | https://brave.com/search/api/ (offre gratuite limitée) |
| Fiches Google (`GET /places`) | `GOOGLE_PLACES_KEY` | note, nombre d'avis, site, téléphone, lien de la fiche | Google Cloud → activer **Places API (New)** → *Identifiants* → clé d'API, restreinte à cette API |

Google facture au-delà d'un quota gratuit mensuel : fixez un **plafond de dépenses / de quota** dans Google Cloud.
Les conditions de Google Maps Platform encadrent la conservation des données de fiches : vérifiez qu'elles
conviennent à votre usage (l'outil enregistre le lien, la note et le nombre d'avis sur la fiche prospect).

### Mise en place sans ligne de commande

1. Dans le dépôt GitHub : *Settings* → *Secrets and variables* → *Actions* → *New repository secret*, ajoutez
   `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` (compte qui héberge `paysapro-relais`, s'ils n'y sont pas déjà),
   puis `BRAVE_SEARCH_KEY` et / ou `GOOGLE_PLACES_KEY`.
2. Onglet *Actions* → **Relais — mise à jour** → *Run workflow* : le relais est redéployé et les clés lui sont envoyées.
3. Dans l'application, *Paramètres → Moteur d'enrichissement* indique « clé configurée sur le relais » après le
   premier enrichissement.

En ligne de commande : `npx wrangler@4 secret put BRAVE_SEARCH_KEY --config worker/wrangler.toml` (idem pour
`GOOGLE_PLACES_KEY`), puis `npx wrangler@4 deploy --config worker/wrangler.toml`.
