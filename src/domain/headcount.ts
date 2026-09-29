// Tranches d'effectif proposées à la recherche, alignées sur les tranches officielles INSEE.
export const HEADCOUNT_BUCKETS: { id: string; label: string; bands: string[] }[] = [
  { id: '0', label: '0 salarié', bands: ['00'] },
  { id: '1-5', label: '1 à 5', bands: ['01', '02'] },
  { id: '6-9', label: '6 à 9', bands: ['03'] },
  { id: '10-19', label: '10 à 19', bands: ['11'] },
  { id: '20-49', label: '20 à 49', bands: ['12'] },
  { id: '50+', label: '50 et plus', bands: ['21', '22', '31', '32', '41', '42', '51', '52', '53'] },
];

export function bandsOf(bucketIds: string[]): string[] {
  return HEADCOUNT_BUCKETS.filter((b) => bucketIds.includes(b.id)).flatMap((b) => b.bands);
}
