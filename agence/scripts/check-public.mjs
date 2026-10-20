// Vérifie qu'aucune donnée sensible ne se trouve dans les ressources publiques ni dans le code envoyé au navigateur :
// secrets, clés, coûts fournisseur, marges. À lancer avant chaque déploiement (aussi exécuté par la CI).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  [/supplier_price|supplier_shipping|supplier_other|cost_at_validation|unit_cost|cost_production|cost_supplier/i, 'champ de coût interne'],
  [/APP_SECRET\s*[:=]\s*['"][^'"]{8,}/, 'secret applicatif'],
  [/(BREVO|RESEND)_API_KEY\s*[:=]\s*['"][^'"]{8,}/, 'clé d’API e-mail'],
  [/xkeysib-[a-z0-9]{20,}|re_[A-Za-z0-9]{20,}/, 'clé d’API e-mail (format Brevo/Resend)'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'clé privée'],
  [/password_hash|pbkdf2\$/, 'empreinte de mot de passe'],
];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = [...walk('public'), ...walk('src/client')].filter((f) => /\.(js|ts|css|html|json|svg|txt|webmanifest)$/.test(f));
let problems = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const [re, label] of FORBIDDEN) {
    // Le script de l'administration contient les NOMS des champs de coût (calcul de marge en direct), jamais de valeurs.
    if (label === 'champ de coût interne' && /admin\.(js|ts)$/.test(f)) continue;
    if (re.test(text)) {
      console.error(`✘ ${f} : ${label}`);
      problems++;
    }
  }
}
// Les fichiers de secrets locaux ne doivent jamais être suivis par Git.
const gitignore = readFileSync('.gitignore', 'utf8');
for (const must of ['.env', '.dev.vars', 'data']) {
  if (!gitignore.split(/\r?\n/).includes(must)) {
    console.error(`✘ .gitignore : « ${must} » absent`);
    problems++;
  }
}
console.log(problems ? `${problems} problème(s).` : `✔ ${files.length} fichiers publics / navigateur vérifiés : aucune donnée sensible.`);
process.exit(problems ? 1 : 0);
