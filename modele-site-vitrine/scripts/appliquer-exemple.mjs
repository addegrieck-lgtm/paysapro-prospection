// Remplit le site avec un exemple de métier : npm run exemple -- restaurant
// Chaque clé de exemples/<nom>.json remplace le fichier src/content/<clé>.json
// (pour « apparence », seules les options présentes dans l'exemple sont modifiées).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dossier = new URL('../exemples/', import.meta.url);
const contenu = new URL('../src/content/', import.meta.url);
const disponibles = readdirSync(dossier).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const nom = process.argv[2];

if (!disponibles.includes(nom)) {
  console.log(`Usage : npm run exemple -- <métier>\nExemples disponibles : ${disponibles.join(', ')}`);
  process.exit(nom ? 1 : 0);
}

const exemple = JSON.parse(readFileSync(new URL(`${nom}.json`, dossier), 'utf8'));
for (const [cle, valeur] of Object.entries(exemple)) {
  const fichier = new URL(`${cle}.json`, contenu);
  const donnees = cle === 'apparence' ? { ...JSON.parse(readFileSync(fichier, 'utf8')), ...valeur } : valeur;
  writeFileSync(fichier, JSON.stringify(donnees, null, 2) + '\n');
  console.log(`✓ src/content/${cle}.json`);
}
console.log(`Exemple « ${nom} » appliqué. Lancez npm run dev pour le voir.`);
