// Liens d'action gratuits : recherche Google manuelle, appel, e-mail via la messagerie de l'utilisateur.
import type { Prospect } from './types';
import { normPhone } from './normalize';

/** Recherche Google construite dynamiquement : « nom + ville + paysagiste » (aucun scraping). */
export function googleSearchUrl(p: Pick<Prospect, 'name' | 'tradeName' | 'city'>): string {
  const q = [p.tradeName ?? p.name, p.city, 'paysagiste'].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function googleMapsSearchUrl(p: Pick<Prospect, 'name' | 'tradeName' | 'city'>): string {
  const q = [p.tradeName ?? p.name, p.city].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

export function telUrl(phone: string | null): string | null {
  const n = normPhone(phone);
  return n ? `tel:${n}` : null;
}

/** Lien « Ouvrir dans mon e-mail » (destinataire, objet, corps pré-remplis). */
export function mailtoUrl(to: string, subject: string, body: string): string {
  const params = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`].join('&');
  return `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?${params}`;
}

export function annuaireEntreprisesUrl(siren: string | null): string | null {
  return siren ? `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}` : null;
}
