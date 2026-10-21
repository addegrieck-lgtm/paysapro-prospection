/**
 * Contrats d'abonnement (maintenance, référencement…) : deux formules.
 *  • Sans engagement : durée indéterminée, résiliable à tout moment avec le préavis.
 *  • Engagement : durée initiale (12 mois par défaut) avec une remise sur le prix mensuel, puis reconduction tacite de mois
 *    en mois, résiliable avec le préavis. Une résiliation pendant l'engagement prend effet à la fin de la période initiale.
 * Fonctions pures (testées dans tests/contracts.test.ts).
 */
import { addDays } from './dates';

export type Formula = 'sans_engagement' | 'engagement';

export const FORMULA_LABELS: Record<Formula, string> = {
  sans_engagement: 'Sans engagement',
  engagement: 'Avec engagement (prix remisé)',
};

/** Ajoute des mois à une date AAAA-MM-JJ (fin de mois respectée : 31 janvier + 1 mois = 28/29 février). */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Prix mensuel HT après remise (centimes, arrondi au centime). */
export const discountedPrice = (baseCents: number, discountPercent: number) => Math.round((baseCents * (100 - discountPercent)) / 100);

/** Dernier jour de la période d'engagement (null sans engagement). */
export function commitmentEnd(start: string, commitmentMonths: number): string | null {
  return commitmentMonths > 0 ? addDays(addMonths(start, commitmentMonths), -1) : null;
}

/**
 * Date de fin effective d'une résiliation demandée le `requestDate` : au plus tôt la fin du préavis, et jamais avant
 * la fin de la période d'engagement. Le contrat prend fin le soir de cette date.
 */
export function terminationDate(requestDate: string, start: string, commitmentMonths: number, noticeMonths: number): string {
  const afterNotice = addDays(addMonths(requestDate, noticeMonths), -1);
  const end = commitmentEnd(start, commitmentMonths);
  const candidates = [afterNotice, end ?? afterNotice, addDays(start, -1)];
  return candidates.sort().at(-1)!;
}

/**
 * Clients particuliers (art. L215-1 du Code de la consommation) : ils doivent être informés par écrit, au plus tôt
 * 3 mois et au plus tard 1 mois avant la fin de la période d'engagement, de la possibilité de ne pas reconduire.
 * Retourne la fenêtre d'envoi, ou null si l'information n'est pas due.
 */
export function renewalNoticeWindow(start: string, commitmentMonths: number): { from: string; to: string } | null {
  const end = commitmentEnd(start, commitmentMonths);
  if (!end) return null;
  return { from: addMonths(end, -3), to: addMonths(end, -1) };
}

export const CONTRACT_STATUSES = [
  ['a_signer', 'À signer'],
  ['signe', 'Signé'],
  ['resiliation', 'Résiliation demandée'],
  ['resilie', 'Résilié'],
] as const satisfies readonly (readonly [string, string])[];
