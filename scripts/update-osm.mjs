// Met à jour l'instantané OpenStreetMap des entreprises du paysage en France (public/data/osm-paysagistes.json).
//
//   npm run osm:update
//
// Données © les contributeurs OpenStreetMap, licence ODbL (https://www.openstreetmap.org/copyright) :
// l'attribution est obligatoire (affichée dans l'application) et ce fichier dérivé reste sous ODbL.
// Une seule requête, avec serveurs de secours ; à relancer de temps en temps (ex. une fois par mois).
import { writeFileSync, mkdirSync } from 'node:fs';

const QUERY = `[out:json][timeout:300];
area["ISO3166-1"="FR"][admin_level=2]->.fr;
(
  nwr["craft"~"^(gardener|landscaper)$"](area.fr);
  nwr["name"~"paysag|espaces? verts",i]["craft"](area.fr);
  nwr["name"~"paysag|espaces? verts",i]["office"](area.fr);
  nwr["name"~"paysag|espaces? verts",i]["shop"](area.fr);
);
out tags center;`;

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function fetchOverpass() {
  for (const url of SERVERS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        process.stdout.write(`${url} (essai ${attempt})… `);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PaysaproProspection/1.0 (mise a jour annuelle OSM)' },
          body: `data=${encodeURIComponent(QUERY)}`,
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

// « --from fichier.json » : réutilise une réponse Overpass déjà téléchargée (serveurs saturés)
const fromIdx = process.argv.indexOf('--from');
const data = fromIdx > 0 ? JSON.parse((await import('node:fs')).readFileSync(process.argv[fromIdx + 1], 'utf8')) : await fetchOverpass();
// Seuls les champs utiles au rapprochement et aux coordonnées professionnelles sont conservés.
const KEEP = ['name', 'craft', 'office', 'shop', 'phone', 'mobile', 'contact:phone', 'contact:mobile', 'email', 'contact:email', 'website', 'contact:website', 'url', 'contact:facebook', 'contact:instagram', 'ref:FR:SIRET', 'addr:postcode', 'addr:city', 'addr:street', 'addr:housenumber'];
const relevant = (t) => /^(gardener|landscaper)$/.test(t.craft ?? '') || (/paysag|espaces? verts/i.test(t.name) && (t.craft || t.office || t.shop));
const elements = data.elements
  .filter((e) => e.tags?.name && relevant(e.tags))
  .map((e) => ({
    type: e.type,
    id: e.id,
    lat: e.lat ?? e.center?.lat,
    lon: e.lon ?? e.center?.lon,
    tags: Object.fromEntries(Object.entries(e.tags).filter(([k]) => KEEP.includes(k))),
  }));
// Garde-fou : une réponse vide ou tronquée (serveur saturé) n'écrase jamais l'instantané existant.
if (elements.length < 100) {
  console.error(`Seulement ${elements.length} entreprises reçues : instantané existant conservé. Réessayez plus tard.`);
  process.exit(1);
}
mkdirSync('public/data', { recursive: true });
writeFileSync(
  'public/data/osm-paysagistes.json',
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    attribution: '© les contributeurs OpenStreetMap',
    license: 'ODbL 1.0 — https://www.openstreetmap.org/copyright',
    elements,
  }),
);
const phones = elements.filter((e) => e.tags.phone || e.tags['contact:phone'] || e.tags['contact:mobile'] || e.tags.mobile).length;
console.log(`public/data/osm-paysagistes.json : ${elements.length} entreprises, dont ${phones} avec téléphone.`);
