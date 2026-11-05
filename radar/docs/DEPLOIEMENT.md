# Guide de déploiement

Deux modes, même code, même base de données SQL :

| | Cloudflare Workers (recommandé pour l'accès à distance) | Serveur Node (poste personnel ou VPS) |
|---|---|---|
| Base | Cloudflare D1 | SQLite intégré à Node (`DATABASE_PATH`) |
| Documents | KV (`FILES_KV`) ou R2 (`FILES`) | disque (`FILES_DIR`) |
| Veille | Cron Triggers : lancement à 4 h 17 UTC, une étape toutes les 15 min | lancement à 4 h 17 (heure locale), une étape toutes les 2 min |
| Coût | offre gratuite possible (voir limites ci-dessous) | gratuit |

## 1. Cloudflare Workers

### Ce qui est déployé
Un seul Worker `normandie-business-radar` qui sert :
- l'API `/api/*` (Hono) ;
- l'interface React compilée (Workers Static Assets, dossier `dist/client`, en-têtes de sécurité dans `public/_headers`) ;
- les tâches planifiées (`[triggers] crons` dans `wrangler.toml`).

### Mise en ligne automatique (GitHub Actions, sans ligne de commande)
1. Créez un compte Cloudflare gratuit.
2. *My Profile → API Tokens → Create Token* → modèle **« Edit Cloudflare Workers »**, en ajoutant les droits
   **D1 : Edit** et **Workers KV Storage : Edit**. Notez le jeton et votre **Account ID** (page d'accueil du tableau de bord).
3. Dans le dépôt GitHub : *Settings → Secrets and variables → Actions* → ajoutez :
   - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (obligatoires) ;
   - `RADAR_SETUP_TOKEN` : une chaîne aléatoire d'au moins 16 caractères (jeton de création du premier compte) ;
   - facultatifs : `INSEE_API_KEY`, `INPI_USERNAME`, `INPI_PASSWORD`, `PAPPERS_API_TOKEN`, `ANTHROPIC_API_KEY`.
4. *Actions → « Radar — mise en ligne Cloudflare » → Run workflow.* Le script `scripts/cf-deploy.mjs` crée la base D1 et
   l'espace KV s'ils n'existent pas, compile, déploie et définit les secrets (`APP_SECRET` est généré automatiquement et
   n'est jamais affiché).
5. Ouvrez l'adresse `https://normandie-business-radar.<votre-sous-domaine>.workers.dev`, saisissez le jeton
   d'installation, créez le compte administrateur, puis lancez la première synchronisation.

### En ligne de commande
```bash
cd radar
export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… SETUP_TOKEN=…
npm ci && npm run deploy
```
Secret supplémentaire plus tard : `npx wrangler@4 secret put INSEE_API_KEY --config wrangler.deploy.toml`.

### Tester localement dans le moteur Workers
```bash
printf 'APP_SECRET=%s\nSETUP_TOKEN=jeton-local-a-changer\nENVIRONMENT=development\n' "$(openssl rand -hex 32)" > .dev.vars
npm run build && npx wrangler@4 dev --local --test-scheduled
# déclencher la veille : POST http://localhost:8787/cdn-cgi/local/explorer/api/local/scheduled?worker=normandie-business-radar  {"cron":"17 4 * * *"}
```

### Limites de l'offre gratuite Cloudflare (à connaître)
- **Temps CPU par invocation** très limité sur l'offre gratuite : les étapes de veille sont bornées (45 requêtes,
  25 s d'horloge) et reprennent sur curseur, mais l'analyse de milliers d'entreprises peut dépasser ce budget. Pour une
  veille complète et rapide du département, l'offre **Workers Paid** (≈ 5 $/mois) ou le **mode Node** (gratuit) est
  conseillé. Sans abonnement, vous pouvez aussi lancer `npm run sync` sur votre ordinateur puis restaurer la sauvegarde
  JSON dans l'instance en ligne (Administration → Sauvegarde).
- **D1 gratuit** : 5 Go, 5 millions de lignes lues et 100 000 lignes écrites par jour. Chaque entreprise importée écrit
  une vingtaine de lignes (provenance champ par champ) : la première synchronisation complète du 76 s'étale donc sur
  plusieurs jours en offre gratuite ; les veilles suivantes ne réécrivent que les changements.
- **Taille du Worker** : environ 410 Ko compressés (limite gratuite : 3 Mo).

### Sauvegardes et restauration
- *Administration → Sauvegarde* : fichier JSON complet (hors documents).
- Cloudflare D1 **Time Travel** : restauration de la base à un instant des 30 derniers jours
  (`npx wrangler@4 d1 time-travel restore normandie-business-radar --timestamp=…`).
- Export SQL brut : `npx wrangler@4 d1 export normandie-business-radar --remote --output=radar.sql`.

### Fond de carte
Par défaut : tuiles OpenStreetMap (`tile.openstreetmap.org`), destinées à un usage léger, avec attribution obligatoire.
Pour un usage soutenu, choisissez un fournisseur de tuiles (Administration → Paramètres → Fond de carte) et ajoutez son
domaine à `img-src` dans `public/_headers`.

## 2. Serveur Node (poste personnel ou VPS)

```bash
cd radar
npm ci
cp .env.example .env   # APP_SECRET (32+ caractères), SETUP_TOKEN, chemins, clés facultatives
npm run build
NODE_ENV=production npm start
```
- Écoute sur `127.0.0.1:8788` par défaut (`HOST`, `PORT` pour changer). Derrière un proxy HTTPS (Caddy, Nginx),
  définissez `TRUST_PROXY=1`.
- En production (`NODE_ENV=production`), les cookies de session sont marqués `Secure` : servez l'application en HTTPS.
- Sauvegarde : copie du fichier `data/radar.db` (+ `data/files/`) ou export JSON depuis l'administration.
- Après une recompilation de l'interface (`npm run build`), redémarrez le serveur.

## 3. Comptes et rôles
| Rôle | Droits |
|---|---|
| lecteur | consultation de toutes les rubriques, RADAR AI, alertes, recherches enregistrées |
| analyste | + Acquisition Manager (écriture), exports CSV / Excel, saisie du site internet |
| admin | + administration complète (sources, veille, paramètres, utilisateurs, imports, sauvegarde, RGPD, journal) |

Mots de passe : 12 caractères minimum (lettres et chiffres), hachés en PBKDF2-SHA256. Verrouillage progressif après
5 échecs, limitation à 10 tentatives / 15 min par adresse IP.
