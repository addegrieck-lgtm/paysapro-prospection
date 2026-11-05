/** Distance orthodromique en kilomètres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Rectangle englobant un cercle (préfiltrage SQL avant calcul exact). */
export function boundingBox(lat: number, lon: number, km: number) {
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLon: lon - dLon, maxLon: lon + dLon };
}

/**
 * Lambert 93 (RGF93, EPSG:2154) → WGS84 (longitude, latitude en degrés).
 * Projection conique conforme sécante, paramètres officiels IGN ; l'écart RGF93/WGS84 (< 1 m) est négligé.
 */
export function lambert93ToWgs84(x: number, y: number): { lat: number; lon: number } {
  const e = 0.0818191910428158; // excentricité GRS80
  const n = 0.725607765053267;
  const C = 11754255.426096;
  const xs = 700000;
  const ys = 12655612.049876;
  const lon0 = (3 * Math.PI) / 180;
  const dx = x - xs;
  const dy = y - ys;
  const R = Math.sqrt(dx * dx + dy * dy);
  const gamma = Math.atan(dx / -dy);
  const lon = lon0 + gamma / n;
  const L = (-1 / n) * Math.log(Math.abs(R / C));
  let phi = 2 * Math.atan(Math.exp(L)) - Math.PI / 2;
  for (let i = 0; i < 20; i++) {
    const next = 2 * Math.atan(Math.pow((1 + e * Math.sin(phi)) / (1 - e * Math.sin(phi)), e / 2) * Math.exp(L)) - Math.PI / 2;
    if (Math.abs(next - phi) < 1e-12) {
      phi = next;
      break;
    }
    phi = next;
  }
  return { lat: (phi * 180) / Math.PI, lon: (lon * 180) / Math.PI };
}
