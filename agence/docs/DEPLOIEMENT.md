# Mise en ligne

Deux options, le même code. Choisissez **A** si vous voulez un coût nul et aucune maintenance de serveur.

| | A. Cloudflare Workers (recommandé) | B. Serveur Node (VPS) |
|---|---|---|
| Coût d’hébergement | 0 € dans les limites de l’offre gratuite | environ 4 à 7 € HT/mois (VPS d’entrée de gamme) |
| Base de données | Cloudflare D1 (SQLite géré) | SQLite (fichier) |
| Fichiers privés (pièces jointes, BAT) | Cloudflare R2 (bucket privé) | dossier sur le disque du serveur |
| Sauvegardes | Time Travel D1 (restauration à un instant passé : 7 jours en offre gratuite, 30 en offre payante) + export `wrangler d1 export` | à mettre en place (voir § Sauvegardes) |
| Mises à jour système | aucune | à votre charge (sécurité du serveur) |

> Ce projet est **distinct** du relais Paysapro (`worker/` à la racine du dépôt) : ne réutilisez ni son Worker, ni son stockage KV.

---

## A. Cloudflare Workers + D1 + R2

Prérequis : un compte Cloudflare (gratuit) et Node.js 22 sur votre ordinateur.

```bash
cd agence
npm install
npx wrangler@4 login

# 1. Base de données
npx wrangler@4 d1 create agence-web
#    → copiez la valeur « database_id » affichée dans wrangler.toml (à la place de A_REMPLACER)

# 2. Bucket privé pour les fichiers
npx wrangler@4 r2 bucket create agence-web-fichiers

# 3. Secrets (jamais dans un fichier du dépôt)
openssl rand -hex 32 | npx wrangler@4 secret put APP_SECRET
npx wrangler@4 secret put ADMIN_SETUP_TOKEN     # un jeton long et aléatoire, à usage unique

# 4. Construction des scripts navigateur puis déploiement
npm run build
npx wrangler@4 deploy
```

5. Ouvrez `https://agence-web.<votre-sous-domaine>.workers.dev/admin/installation`, saisissez le jeton et créez votre compte.
   Supprimez ensuite le jeton : `npx wrangler@4 secret delete ADMIN_SETUP_TOKEN`.
6. Nom de domaine : *Workers & Pages → agence-web → Settings → Domains & Routes → Add custom domain*.
7. Dans *Administration → Paramètres*, renseignez l’adresse du site (`https://www.votre-domaine.fr`) et les informations légales.

Les migrations de base de données s’appliquent automatiquement au premier appel. Vérifié localement avec `wrangler dev` (D1 et R2
simulés) : la recette complète `scripts/e2e.mjs` passe sur ce runtime.

E-mails : voir [SERVICES-EXTERNES.md](SERVICES-EXTERNES.md), puis
```bash
npx wrangler@4 secret put BREVO_API_KEY
# dans wrangler.toml, [vars] : MAIL_PROVIDER = "brevo", MAIL_FROM = "contact@votre-domaine.fr", MAIL_FROM_NAME = "Nom de l’agence"
npx wrangler@4 deploy
```

Test local du mode Cloudflare : créez `agence/.dev.vars` (ignoré par Git) avec `APP_SECRET=…`, `ADMIN_SETUP_TOKEN=…`,
`ENVIRONMENT=development`, puis `npx wrangler@4 dev`.

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
