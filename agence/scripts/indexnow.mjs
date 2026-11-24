// Après une mise en ligne : envoie à IndexNow toutes les adresses du sitemap du site en production.
// Usage : node scripts/indexnow.mjs [https://www.signeetseine.fr]   (n'échoue jamais : IndexNow est un bonus).
import { readFileSync } from 'node:fs';

const base = (process.argv[2] || 'https://www.signeetseine.fr').replace(/\/+$/, '');
const key = readFileSync(new URL('../src/domain/indexnow.ts', import.meta.url), 'utf8').match(/INDEXNOW_KEY = '([0-9a-f]+)'/)?.[1];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  if (!key) throw new Error('clé introuvable dans src/domain/indexnow.ts');
  // Attend que la nouvelle version (et son fichier de clé) réponde.
  let ok = false;
  for (let i = 0; i < 12 && !ok; i++) {
    ok = (await fetch(`${base}/${key}.txt`).then((r) => r.text()).catch(() => '')).trim() === key;
    if (!ok) await wait(5000);
  }
  if (!ok) throw new Error(`fichier de clé injoignable : ${base}/${key}.txt`);
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/${key}.txt`, urlList }),
  });
  console.log(`IndexNow : ${urlList.length} adresse(s) envoyée(s), réponse ${res.status} ${res.status < 300 ? '(acceptée)' : await res.text()}`);
} catch (e) {
  console.log(`IndexNow non envoyé : ${e.message}`);
}
