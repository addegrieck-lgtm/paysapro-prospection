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
