// Mise en ligne sur Cloudflare Workers, sans intervention manuelle :
//   1. crée (si besoin) la base D1 « agence-web » et l'espace KV « agence-web-fichiers » ;
//   2. génère wrangler.deploy.toml avec leurs identifiants (fichier non suivi par Git) ;
//   3. déploie le Worker ;
//   4. crée APP_SECRET s'il n'existe pas encore (jamais affiché), et définit ADMIN_SETUP_TOKEN si fourni.
// Variables requises : CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. Facultative : ADMIN_SETUP_TOKEN.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const WRANGLER = ['--yes', 'wrangler@4'];
const run = (args, input) => execFileSync('npx', [...WRANGLER, ...args], { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'inherit'] });
const json = (text) => JSON.parse(text.slice(text.search(/[[{]/)));

for (const v of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
  if (!process.env[v]) {
    console.error(`Variable manquante : ${v} (à ajouter dans les secrets GitHub du dépôt).`);
    process.exit(1);
  }
}

// 1. Base D1
const findDb = () => json(run(['d1', 'list', '--json'])).find((d) => d.name === 'agence-web');
let db = findDb();
if (!db) {
  console.log('Création de la base D1 « agence-web »…');
  run(['d1', 'create', 'agence-web']);
  db = findDb();
}
if (!db?.uuid) throw new Error('Base D1 introuvable après création.');
console.log(`Base D1 : ${db.uuid}`);

// 2. Espace KV des fichiers
const findKv = () => json(run(['kv', 'namespace', 'list'])).find((n) => n.title === 'agence-web-fichiers' || n.title.endsWith('agence-web-fichiers'));
let kv = findKv();
if (!kv) {
  console.log('Création de l’espace KV « agence-web-fichiers »…');
  run(['kv', 'namespace', 'create', 'agence-web-fichiers']);
  kv = findKv();
}
if (!kv?.id) throw new Error('Espace KV introuvable après création.');
console.log(`Espace KV : ${kv.id}`);

const base = readFileSync('wrangler.toml', 'utf8');
const config = base
  .replace(/database_id = "A_REMPLACER"/, `database_id = "${db.uuid}"`)
  .replace(/(binding = "FILES_KV"\s*\nid = )"A_REMPLACER"/, `$1"${kv.id}"`);
if (config.includes('A_REMPLACER')) throw new Error('wrangler.toml : identifiant non remplacé.');
writeFileSync('wrangler.deploy.toml', config);

// 3. Déploiement
const out = run(['deploy', '--config', 'wrangler.deploy.toml']);
console.log(out);

// 4. Secrets
const secrets = run(['secret', 'list', '--config', 'wrangler.deploy.toml']);
if (!secrets.includes('APP_SECRET')) {
  run(['secret', 'put', 'APP_SECRET', '--config', 'wrangler.deploy.toml'], randomBytes(32).toString('hex'));
  console.log('Secret APP_SECRET créé.');
}
if (process.env.ADMIN_SETUP_TOKEN) {
  run(['secret', 'put', 'ADMIN_SETUP_TOKEN', '--config', 'wrangler.deploy.toml'], process.env.ADMIN_SETUP_TOKEN);
  console.log('Jeton d’installation administrateur défini.');
}

const url = out.match(/https:\/\/[^\s]+workers\.dev/)?.[0];
console.log(url ? `\nSite en ligne : ${url}\nAdministration : ${url}/admin/installation` : '\nDéployé (adresse visible dans Cloudflare → Workers & Pages → agence-web).');
