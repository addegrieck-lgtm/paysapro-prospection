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

export interface WebSearchLink {
  label: string;
  url: string;
  hint: string;
}

/**
 * « Rechercher sur le web » : recherches construites automatiquement, ouvertes par l'utilisateur.
 * Aide à la recherche uniquement — aucune page n'est lue ni aspirée par l'application.
 */
export function webSearchLinks(p: Pick<Prospect, 'name' | 'tradeName' | 'city' | 'phone' | 'siret' | 'siren'>): WebSearchLink[] {
  const name = p.tradeName ?? p.name;
  const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const links: WebSearchLink[] = [{ label: `${name} + ville`, url: g([name, p.city, 'paysagiste'].filter(Boolean).join(' ')), hint: 'Site, fiche Google, avis' }];
  const phone = normPhone(p.phone);
  if (phone) links.push({ label: `${name} + téléphone`, url: g(`"${phone.replace(/(\d{2})(?=\d)/g, '$1 ')}" ${name}`), hint: 'Vérifier le numéro, trouver le site' });
  if (p.siret ?? p.siren) links.push({ label: `${name} + SIRET`, url: g(`${p.siret ?? p.siren} ${name}`), hint: 'Mentions légales du site, annuaires' });
  links.push({ label: 'Google Maps', url: googleMapsSearchUrl(p), hint: 'Fiche d’établissement, avis, horaires' });
  links.push({
    label: 'PagesJaunes',
    url: `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(name)}&ou=${encodeURIComponent(p.city ?? '')}`,
    hint: 'Téléphone, site',
  });
  links.push({ label: 'Réseaux sociaux', url: g(`${name} ${p.city ?? ''} (site:facebook.com OR site:instagram.com OR site:linkedin.com)`), hint: 'Facebook, Instagram, LinkedIn' });
  const annuaire = annuaireEntreprisesUrl(p.siren ?? p.siret?.slice(0, 9) ?? null);
  if (annuaire) links.push({ label: 'Annuaire des entreprises', url: annuaire, hint: 'Fiche officielle (data.gouv.fr)' });
  return links;
}

export function annuaireEntreprisesUrl(siren: string | null): string | null {
  return siren ? `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}` : null;
}
