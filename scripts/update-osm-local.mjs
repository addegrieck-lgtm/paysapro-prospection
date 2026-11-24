// Instantané OpenStreetMap des commerces et artisans d'un ou plusieurs départements (espace Signe & Seine) :
//
//   npm run osm:local            → public/data/osm-local-76.json
//   npm run osm:local -- 76 27   → un fichier par département
//
// Lancé automatiquement à chaque mise en ligne (.github/workflows/deploy.yml) : l'application lit ce fichier au lieu
// d'interroger Overpass en direct (serveur souvent saturé). En cas d'échec, l'application garde la requête en direct.
// Données © les contributeurs OpenStreetMap, licence ODbL : attribution affichée dans l'application.
import { mkdirSync, writeFileSync } from 'node:fs';
import { localBusinessQuery } from './osm-local-query.mjs';

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
// Seuls les champs utiles au rapprochement et aux coordonnées professionnelles sont conservés.
const KEEP = ['name', 'craft', 'shop', 'amenity', 'tourism', 'leisure', 'office', 'phone', 'mobile', 'contact:phone', 'contact:mobile', 'email', 'contact:email', 'website', 'contact:website', 'url', 'contact:facebook', 'contact:instagram', 'ref:FR:SIRET', 'addr:postcode', 'addr:city', 'addr:street', 'addr:housenumber'];

async function fetchOverpass(query) {
  for (const url of SERVERS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        process.stdout.write(`${url} (essai ${attempt})… `);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PaysaproProspection/1.0 (instantane mensuel OSM)' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(330_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        console.log(`${json.elements.length} éléments`);
        return json;
      } catch (e) {
        console.log(`échec (${e.message})`);
        await new Promise((r) => setTimeout(r, 5000 * attempt));
      }
    }
  }
  throw new Error('Aucun serveur Overpass disponible : réessayez plus tard.');
}

const departments = process.argv.slice(2).filter((a) => /^(\d{2}|2[AB]|97\d)$/.test(a));
let failed = 0;
for (const dep of departments.length ? departments : ['76']) {
  try {
    const data = await fetchOverpass(localBusinessQuery([dep]));
    const elements = data.elements
      .filter((e) => e.tags?.name)
      .map((e) => ({ type: e.type, id: e.id, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: Object.fromEntries(Object.entries(e.tags).filter(([k]) => KEEP.includes(k))) }));
    // Garde-fou : une réponse vide ou tronquée (serveur saturé) ne produit pas d'instantané.
    if (elements.length < 200) throw new Error(`seulement ${elements.length} établissements reçus`);
    mkdirSync('public/data', { recursive: true });
    const file = `public/data/osm-local-${dep}.json`;
    writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), attribution: '© les contributeurs OpenStreetMap', license: 'ODbL 1.0 — https://www.openstreetmap.org/copyright', elements }));
    const phones = elements.filter((e) => e.tags.phone || e.tags['contact:phone'] || e.tags['contact:mobile'] || e.tags.mobile).length;
    console.log(`${file} : ${elements.length} établissements, dont ${phones} avec téléphone.`);
  } catch (e) {
    failed++;
    console.error(`Département ${dep} : ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
