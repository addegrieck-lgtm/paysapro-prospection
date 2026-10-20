# Mise en ligne

Deux options, le même code. Choisissez **A** si vous voulez un coût nul et aucune maintenance de serveur.

| | A. Cloudflare Workers (recommandé) | B. Serveur Node (VPS) |
|---|---|---|
| Coût d’hébergement | 0 € dans les limites de l’offre gratuite | environ 4 à 7 € HT/mois (VPS d’entrée de gamme) |
| Base de données | Cloudflare D1 (SQLite géré) | SQLite (fichier) |
| Fichiers privés (pièces jointes, BAT) | Cloudflare KV (privé, sans carte bancaire) | dossier sur le disque du serveur |
| Sauvegardes | Time Travel D1 (restauration à un instant passé : 7 jours en offre gratuite, 30 en offre payante) + export `wrangler d1 export` | à mettre en place (voir § Sauvegardes) |
| Mises à jour système | aucune | à votre charge (sécurité du serveur) |

> Ce projet est **distinct** du relais Paysapro (`worker/` à la racine du dépôt) : ne réutilisez ni son Worker, ni son stockage KV.

---

## A. Cloudflare Workers + D1 + KV (en un clic depuis GitHub)

Aucune carte bancaire n’est nécessaire : base D1 et stockage KV de l’offre gratuite (les fichiers privés vont dans KV ; R2 reste
utilisable en liant un bucket `FILES`).

### Une seule fois : donner l’accès à GitHub

1. **Jeton Cloudflare** : dash.cloudflare.com → icône profil → *My Profile* → *API Tokens* → *Create Token* →
   modèle **« Edit Cloudflare Workers »** → *Use template*. Dans *Permissions*, ajoutez une ligne **Account › D1 › Edit**.
   *Account Resources* : votre compte. *Continue to summary* → *Create Token* → copiez le jeton (affiché une seule fois).
2. **Identifiant de compte** : dash.cloudflare.com → *Workers & Pages* → colonne de droite « Account ID » → copiez-le.
3. **Secrets GitHub** : dépôt → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*, trois fois :
   - `CLOUDFLARE_API_TOKEN` = le jeton de l’étape 1
   - `CLOUDFLARE_ACCOUNT_ID` = l’identifiant de l’étape 2
   - `AGENCE_SETUP_TOKEN` = une longue phrase secrète de votre choix (servira une seule fois à créer votre compte administrateur)

### Mettre en ligne (et à chaque mise à jour)

Dépôt GitHub → onglet **Actions** → **« Agence — mise en ligne Cloudflare »** → **Run workflow**.
Le workflow teste, construit, crée si besoin la base D1 et l’espace KV, déploie, et génère `APP_SECRET` (jamais affiché).
L’adresse du site s’affiche à la fin du journal de l’étape « Déployer sur Cloudflare » :
`https://agence-web.<votre-sous-domaine>.workers.dev`.

### Ensuite

1. Ouvrez `https://agence-web.<votre-sous-domaine>.workers.dev/admin/installation`, saisissez la phrase `AGENCE_SETUP_TOKEN`
   et créez votre compte. Supprimez ensuite le secret `AGENCE_SETUP_TOKEN` dans GitHub, et dans Cloudflare :
   *Workers & Pages → agence-web → Settings → Variables and Secrets* → supprimer `ADMIN_SETUP_TOKEN`.
2. Nom de domaine : *Workers & Pages → agence-web → Settings → Domains & Routes → Add custom domain*.
3. *Administration → Paramètres* : adresse du site et informations légales.

E-mails (voir [SERVICES-EXTERNES.md](SERVICES-EXTERNES.md)) : dans Cloudflare, *agence-web → Settings → Variables and Secrets* :
ajoutez le secret `BREVO_API_KEY`, puis dans `wrangler.toml` (section `[vars]`) `MAIL_PROVIDER = "brevo"`, `MAIL_FROM` et `MAIL_FROM_NAME`,
et relancez le workflow.

Sauvegardes : D1 Time Travel (restauration à un instant passé : 7 jours en offre gratuite) et export `npx wrangler@4 d1 export agence-web --remote --output sauvegarde.sql`.

### Depuis votre ordinateur (alternative)

```bash
cd agence && npm ci && npm run build
export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… ADMIN_SETUP_TOKEN=…
node scripts/cf-deploy.mjs
```

Test local du mode Cloudflare : `agence/.dev.vars` (ignoré par Git) avec `APP_SECRET=…`, `ADMIN_SETUP_TOKEN=…`,
`ENVIRONMENT=development`, puis `npx wrangler@4 dev`. La recette `scripts/e2e.mjs` passe sur ce runtime.

---

## B. Serveur Node.js (VPS Debian/Ubuntu)

Prérequis : Node.js ≥ 22.13, un reverse proxy HTTPS (Caddy recommandé : certificat automatique).

```bash
git clone <votre dépôt> && cd <dépôt>/agence
npm ci
cp .env.example .env     # puis remplir APP_SECRET (openssl rand -hex 32), TRUST_PROXY=1, e-mails…
chmod 600 .env
npm run build
npm run admin:create     # crée le compte administrateur
npm start                # écoute sur le port 3000
```

Service systemd (`/etc/systemd/system/agence.service`) :

```ini
[Unit]
Description=Agence web
After=network.target

[Service]
WorkingDirectory=/srv/agence/agence
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning dist/server/node.js
Restart=always
User=agence
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Caddy (`/etc/caddy/Caddyfile`) :

```
www.votre-domaine.fr {
  reverse_proxy localhost:3000
}
votre-domaine.fr {
  redir https://www.votre-domaine.fr{uri} permanent
}
```

Autres hébergeurs Node compatibles : tout service offrant un **disque persistant** (la base SQLite et les fichiers y sont stockés).

### Sauvegardes (option B)

À planifier chaque nuit (cron) et à tester en restauration :

```bash
sqlite3 data/agence.db ".backup 'sauvegardes/agence-$(date +%F).db'"
tar czf sauvegardes/fichiers-$(date +%F).tgz data/uploads
```

Copiez ensuite ces fichiers hors du serveur (stockage externe chiffré).

---

## Mises à jour

```bash
git pull
cd agence && npm ci && npm test && npm run build
# A : npx wrangler@4 deploy      B : sudo systemctl restart agence
```

Les migrations sont versionnées (`src/db/migrations.ts`) et appliquées automatiquement au démarrage : n’en modifiez jamais
une déjà déployée, ajoutez-en une nouvelle.

## Intégration continue

`.github/workflows/agence.yml` exécute à chaque modification du dossier `agence/` : vérification TypeScript, tests, construction,
contrôle des ressources publiques. Le déploiement reste manuel (aucun secret n’est stocké dans GitHub).
