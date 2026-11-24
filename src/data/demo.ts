// Données de démonstration : 100 entreprises FICTIVES, clairement marquées.
//
//  • nom préfixé « [DÉMO] » et champ `demo: true` (bandeau « DONNÉE DE DÉMONSTRATION » sur la fiche) ;
//  • aucun SIREN / SIRET (pour ne jamais coïncider avec une vraie entreprise) ;
//  • e-mails et sites en « example.com / example.org » (domaines réservés, jamais attribués) ;
//  • téléphones dans les tranches réservées à la fiction par l'ARCEP (01 99 00…, 06 39 98…) ;
//  • jamais contactables : exclues des campagnes et de la génération de messages.
import type { ImportLine } from './repository';
import type { ServiceTag } from '../domain/types';
import { SERVICES } from '../domain/referentials';
import { AGENCE_SECTORS, type OfferId } from '../domain/offers';

const PREFIX = ['Jardins', 'Paysages', 'Espaces Verts', 'Terre & Jardin', 'Horizon Vert', 'L’Atelier du Jardin', 'Vert Nature', 'Les Jardiniers', 'Arbre & Pierre', 'Au Fil des Saisons'];
const SUFFIX = ['du Val', 'des Collines', 'de la Côte', 'Création', 'Services', 'et Compagnie', 'du Bocage', 'des Marais', 'Concept', 'Prestige'];
const CITIES: [string, string, string][] = [
  ['Rouen', '76000', '76'], ['Le Havre', '76600', '76'], ['Dieppe', '76200', '76'], ['Caen', '14000', '14'], ['Évreux', '27000', '27'],
  ['Bordeaux', '33000', '33'], ['Mérignac', '33700', '33'], ['Toulon', '83000', '83'], ['Hyères', '83400', '83'], ['Marseille', '13001', '13'],
  ['Aix-en-Provence', '13100', '13'], ['Nantes', '44000', '44'], ['Rennes', '35000', '35'], ['Lyon', '69001', '69'], ['Annecy', '74000', '74'],
  ['Lille', '59000', '59'], ['Amiens', '80000', '80'], ['Toulouse', '31000', '31'], ['Montpellier', '34000', '34'], ['Versailles', '78000', '78'],
];

/** Générateur pseudo-aléatoire déterministe (mêmes données à chaque chargement). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Signe & Seine : commerces, artisans et restaurants fictifs de Seine-Maritime. */
const AGENCE_NAMES: Record<string, string[]> = {
  btp: ['Bâti', 'Rénov', 'Les Artisans', 'Toitures', 'Habitat', 'Atelier Bois', 'Élec', 'Thermi', 'Maçonnerie', 'Façades'],
  restauration: ['Le Comptoir', 'La Table', 'Le Bistrot', 'Au Fournil', 'La Crêperie', 'Le Relais', 'Chez Margot', 'La Marée', 'L’Escale', 'Le Bouchon'],
  commerce: ['Studio', 'L’Atelier', 'Institut', 'La Boutique', 'Fleurs', 'Instant Beauté', 'Mèche & Ciseaux', 'Le Panier', 'La Cave', 'Bijoux'],
  services: ['Garage', 'Taxi', 'Net & Clair', 'Auto-École', 'Photo', 'Immo', 'Pressing', 'Forme', 'Jardins', 'Services'],
};
const AGENCE_SUFFIX = ['du Port', 'de la Côte', 'du Caux', 'des Falaises', 'de la Vallée', 'du Marché', 'de la Seine', 'Normand', 'des Halles', 'du Centre'];
const AGENCE_CITIES: [string, string][] = [
  ['Gruchet-le-Valasse', '76210'], ['Bolbec', '76210'], ['Lillebonne', '76170'], ['Fécamp', '76400'], ['Yvetot', '76190'],
  ['Saint-Romain-de-Colbosc', '76430'], ['Le Havre', '76600'], ['Rouen', '76000'], ['Étretat', '76790'], ['Dieppe', '76200'],
];

function agencyDemoLines(count: number): ImportLine[] {
  const r = rng(76210);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)]!;
  const now = new Date();
  const lines: ImportLine[] = [];
  for (let i = 0; i < count; i++) {
    const [city, cp] = pick(AGENCE_CITIES);
    const sector = pick(AGENCE_SECTORS);
    const naf = pick(sector.naf);
    const name = `[DÉMO] ${pick(AGENCE_NAMES[sector.id]!)} ${pick(AGENCE_SUFFIX)} ${i + 1}`;
    const slug = `demo-${sector.id}-${i + 1}`;
    const hasSite = r() < 0.4;
    const hasGoogle = r() < 0.6;
    const reviews = hasGoogle ? Math.floor(r() ** 2 * 120) : null;
    const phonePrefix = r() < 0.5 ? '019900' : '063998';
    const year = now.getFullYear() - Math.floor(r() ** 1.5 * 20);
    lines.push({
      line: i + 1,
      errors: [],
      input: {
        name,
        address: `${Math.floor(r() * 120) + 1} rue du Général-de-Gaulle (adresse fictive)`,
        postalCode: cp,
        city,
        department: '76',
        phone: r() < 0.8 ? `${phonePrefix}${String(1000 + i).slice(-4)}` : null,
        email: r() < 0.45 ? `contact@${slug}.example.com` : null,
        website: hasSite ? `https://${slug}.example.org` : null,
        googleUrl: hasGoogle ? `https://www.example.com/fiche-google-fictive/${slug}` : null,
        googleReviews: reviews,
        googleRating: hasGoogle && reviews ? Math.round((3.6 + r() * 1.4) * 10) / 10 : null,
        // Démonstration : recherche de coordonnées et vérification Google considérées comme faites
        contactsCheckedAt: now.toISOString(),
        googleCheckedAt: now.toISOString(),
        headcount: r() < 0.6 ? Math.floor(r() ** 2 * 10) : null,
        nafCode: naf.code,
        activity: naf.label,
        services: [],
        creationDate: `${year}-0${1 + Math.floor(r() * 9)}-15`,
        active: true,
        demo: true,
        sourceUrl: null,
      },
    });
  }
  return lines;
}

export function demoLines(count = 100, offer: OfferId = 'paysapro'): ImportLine[] {
  if (offer === 'agence') return agencyDemoLines(count);
  const r = rng(76);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)]!;
  const lines: ImportLine[] = [];
  for (let i = 0; i < count; i++) {
    const [city, cp, dept] = pick(CITIES);
    const name = `[DÉMO] ${pick(PREFIX)} ${pick(SUFFIX)} ${i + 1}`;
    const slug = `demo-paysagiste-${i + 1}`;
    const hasSite = r() < 0.55;
    const hasGoogle = r() < 0.7;
    const reviews = hasGoogle ? Math.floor(r() ** 2 * 160) : null;
    const services = Array.from(new Set(Array.from({ length: Math.floor(r() * 4) }, () => pick(SERVICES).id))) as ServiceTag[];
    const phonePrefix = r() < 0.5 ? '019900' : '063998';
    lines.push({
      line: i + 1,
      errors: [],
      input: {
        name,
        address: `${Math.floor(r() * 120) + 1} rue des Tilleuls (adresse fictive)`,
        postalCode: cp,
        city,
        department: dept,
        phone: r() < 0.8 ? `${phonePrefix}${String(1000 + i).slice(-4)}` : null,
        email: r() < 0.45 ? `contact@${slug}.example.com` : null,
        website: hasSite ? `https://${slug}.example.org` : null,
        googleUrl: hasGoogle ? `https://www.example.com/fiche-google-fictive/${slug}` : null,
        googleReviews: reviews,
        googleRating: hasGoogle && reviews ? Math.round((3.6 + r() * 1.4) * 10) / 10 : null,
        headcount: r() < 0.6 ? Math.floor(r() ** 2 * 14) + 1 : null,
        nafCode: '81.30Z',
        activity: "Services d'aménagement paysager",
        services,
        creationDate: `${2004 + Math.floor(r() * 22)}-0${1 + Math.floor(r() * 9)}-15`,
        active: true,
        demo: true,
        sourceUrl: null,
      },
    });
  }
  return lines;
}
