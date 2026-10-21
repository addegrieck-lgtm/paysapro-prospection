import type { Settings } from '../domain/settings';

/**
 * Données structurées de l'entreprise (schema.org), construites uniquement à partir des paramètres :
 * rien n'est publié s'il n'a pas été renseigné (adresse, téléphone, horaires…).
 */

const base = (s: Settings) => s.siteUrl.replace(/\/+$/, '');
export const businessId = (s: Settings) => `${base(s)}/#entreprise`;

function postalAddress(s: Settings) {
  if (!s.city) return undefined;
  return {
    '@type': 'PostalAddress',
    ...(s.streetAddress ? { streetAddress: s.streetAddress } : {}),
    ...(s.postalCode ? { postalCode: s.postalCode } : {}),
    addressLocality: s.city,
    ...(s.region ? { addressRegion: s.region } : {}),
    addressCountry: 'FR',
  };
}

/** Zones desservies : communes de la zone principale, puis départements / région, puis France (à distance). */
export function areaServed(s: Settings) {
  const admin = new Set(['Seine-Maritime', 'Eure', 'Normandie', 'Calvados', 'Manche', 'Orne']);
  return [
    ...s.serviceAreasPrimary.map((name) => ({ '@type': 'City', name })),
    ...s.serviceAreasSecondary.map((name) => ({ '@type': admin.has(name) ? 'AdministrativeArea' : 'City', name })),
    { '@type': 'Country', name: 'France' },
  ];
}

/** Référence compacte à l'entreprise (fournisseur d'un service). */
export function providerRef(s: Settings) {
  return {
    '@type': 'ProfessionalService',
    '@id': businessId(s),
    name: s.agencyName,
    url: `${base(s)}/`,
    ...(s.contactPhone ? { telephone: telHref(s.contactPhone).slice(4) } : {}),
    ...(postalAddress(s) ? { address: postalAddress(s) } : {}),
  };
}

export function businessJsonLd(s: Settings) {
  const sameAs = [s.googleBusinessUrl, ...s.socialUrls].filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': businessId(s),
    name: s.agencyName,
    description: s.tagline,
    url: `${base(s)}/`,
    logo: `${base(s)}/assets/img/logo-512.png`,
    image: `${base(s)}/assets/img/og-default.png`,
    ...(s.contactEmail ? { email: s.contactEmail } : {}),
    ...(s.contactPhone ? { telephone: telHref(s.contactPhone).slice(4) } : {}),
    ...(postalAddress(s) ? { address: postalAddress(s) } : {}),
    ...(s.latitude != null && s.longitude != null ? { geo: { '@type': 'GeoCoordinates', latitude: s.latitude, longitude: s.longitude } } : {}),
    ...(s.openingDays.length && s.opensAt && s.closesAt
      ? { openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: s.openingDays, opens: s.opensAt, closes: s.closesAt }] }
      : {}),
    areaServed: areaServed(s),
    knowsAbout: ['Création de sites internet', 'Référencement naturel et local', 'Identité visuelle', 'Impression professionnelle', 'Vitrophanie et signalétique'],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd(s: Settings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base(s)}/#site`,
    url: `${base(s)}/`,
    name: s.agencyName,
    inLanguage: 'fr-FR',
    publisher: { '@id': businessId(s) },
  };
}

/** « Gruchet-le-Valasse (76210) » */
export function localityLabel(s: Settings): string {
  return s.city ? `${s.city}${s.postalCode ? ` (${s.postalCode})` : ''}` : '';
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '').replace(/^0/, '+33')}`;
