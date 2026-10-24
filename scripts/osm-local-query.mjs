// Requête Overpass « commerces et artisans d'un département » (espace Signe & Seine).
// Doit rester identique à localBusinessQuery() de src/providers/company/OpenStreetMapProvider.ts (vérifié par les tests).
export function localBusinessQuery(departments) {
  const deps = departments.filter((d) => /^(\d{2}|2[AB]|97\d)$/.test(d));
  const area = `area["ref:INSEE"~"^(${(deps.length ? deps : ['76']).join('|')})$"]["admin_level"="6"]->.d;`;
  return `[out:json][timeout:180];
${area}
(
  nwr["craft"]["name"](area.d);
  nwr["shop"]["name"](area.d);
  nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|driving_school|car_wash|taxi)$"]["name"](area.d);
  nwr["tourism"~"^(hotel|guest_house|chalet|motel)$"]["name"](area.d);
  nwr["leisure"~"^(fitness_centre|sports_centre)$"]["name"](area.d);
  nwr["office"~"^(estate_agent|construction_company|tradesman|company)$"]["name"](area.d);
);
out tags center;`;
}
