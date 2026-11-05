// Mise en ligne de Normandie Business Radar sur Cloudflare Workers, sans manipulation manuelle :
//   1. crée (si besoin) la base D1 « normandie-business-radar » et l'espace KV des documents ;
//   2. génère wrangler.deploy.toml avec leurs identifiants (fichier non suivi par Git) ;
//   3. compile l'interface et déploie le Worker (API + interface + tâches planifiées) ;
//   4. crée APP_SECRET s'il n'existe pas (jamais affiché) et transmet les secrets facultatifs fournis.
// Variables requises : CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
// Facultatives : SETUP_TOKEN, INSEE_API_KEY, INPI_USERNAME, INPI_PASSWORD, PAPPERS_API_TOKEN, ANTHROPIC_API_KEY.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const NAME = 'normandie-business-radar';
const KV_TITLE = `${NAME}-documents`;
const WRANGLER = ['--yes', 'wrangler@4'];
const run = (args, input) => execFileSync('npx', [...WRANGLER, ...args], { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'inherit'] });
const json = (text) => JSON.parse(text.slice(text.search(/[[{]/)));

for (const v of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
  if (!process.env[v]) {
    console.error(`Variable manquante : ${v} (à ajouter dans les secrets GitHub du dépôt ou dans l'environnement).`);
    process.exit(1);
  }
}

const findDb = () => json(run(['d1', 'list', '--json'])).find((d) => d.name === NAME);
let db = findDb();
if (!db) {
  console.log(`Création de la base D1 « ${NAME} »…`);
  run(['d1', 'create', NAME]);
  db = findDb();
}
if (!db?.uuid) throw new Error('Base D1 introuvable après création.');
console.log(`Base D1 : ${db.uuid}`);

const findKv = () => json(run(['kv', 'namespace', 'list'])).find((n) => n.title === KV_TITLE || n.title.endsWith(KV_TITLE));
let kv = findKv();
if (!kv) {
  console.log(`Création de l'espace KV « ${KV_TITLE} »…`);
  run(['kv', 'namespace', 'create', KV_TITLE]);
  kv = findKv();
}
if (!kv?.id) throw new Error('Espace KV introuvable après création.');
console.log(`Espace KV : ${kv.id}`);

const config = readFileSync('wrangler.toml', 'utf8')
  .replace(/database_id = "A_REMPLACER"/, `database_id = "${db.uuid}"`)
  .replace(/(binding = "FILES_KV"\s*\nid = )"A_REMPLACER"/, `$1"${kv.id}"`);
if (config.includes('A_REMPLACER')) throw new Error('wrangler.toml : identifiant non remplacé.');
writeFileSync('wrangler.deploy.toml', config);

console.log('Compilation de l’interface…');
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });

const out = run(['deploy', '--config', 'wrangler.deploy.toml']);
console.log(out);

const secrets = run(['secret', 'list', '--config', 'wrangler.deploy.toml']);
const put = (name, value) => run(['secret', 'put', name, '--config', 'wrangler.deploy.toml'], value);
if (!secrets.includes('APP_SECRET')) {
  put('APP_SECRET', randomBytes(32).toString('hex'));
  console.log('Secret APP_SECRET créé.');
}
for (const name of ['SETUP_TOKEN', 'INSEE_API_KEY', 'INPI_USERNAME', 'INPI_PASSWORD', 'PAPPERS_API_TOKEN', 'ANTHROPIC_API_KEY']) {
  if (process.env[name]) {
    put(name, process.env[name]);
    console.log(`Secret ${name} défini.`);
  }
}
const url = out.match(/https:\/\/[^\s]+workers\.dev/)?.[0];
console.log(url ? `\nEn ligne : ${url}\nPremière connexion : ${url} (jeton d'installation = secret SETUP_TOKEN)` : '\nDéployé (adresse visible dans Cloudflare → Workers & Pages).');
