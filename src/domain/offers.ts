// Offres prospectées. Chaque offre a son propre espace de travail : prospects, modèles, segments, campagnes,
// relances, statistiques et paramètres sont SÉPARÉS (toutes les tables sont déjà indexées par workspaceId).
//
//   • Paysapro AI — application de devis pour paysagistes (espace historique « local ») ;
//   • Signe & Seine — agence web & communication de Gruchet-le-Valasse : artisans du BTP, restauration,
//     commerces et beauté, services locaux.
//
// Fichier de données pur (aucun import d'exécution) : ajouter un secteur ou un code NAF ne demande pas d'autre code.

export type OfferId = 'paysapro' | 'agence';

export interface NafDef {
  code: string;
  /** Libellé officiel INSEE (nomenclature NAF rév. 2) */
  label: string;
  /** Métier tel qu'on le dit (« électricien ») : recherches web, variable {{metier}} des modèles */
  keyword: string;
}

export interface Sector {
  id: string;
  label: string;
  emoji: string;
  naf: NafDef[];
}

export interface Offer {
  id: OfferId;
  workspaceId: string;
  /** Nom de l'offre vendue (variable {{nom_saas}} / {{produit}}) */
  name: string;
  /** Sous-titre de l'espace (sélecteur, menu) */
  tagline: string;
  /** Cible, au pluriel : « paysagistes », « artisans, commerçants et restaurateurs » */
  audience: string;
  sectors: Sector[];
  /** Départements ciblés par défaut (score « zone ciblée », zone de recherche proposée) */
  defaultDepartments: string[];
  /** Les prestations paysagères (création, entretien, élagage…) ont un sens pour cette offre */
  landscapeServices: boolean;
  /** Couleurs du logo de l'espace */
  logo: { bg: string; fg: string };
}

export const PAYSAPRO_WORKSPACE = 'local';
export const AGENCE_WORKSPACE = 'signeetseine';

const LANDSCAPE: Sector = {
  id: 'paysage',
  label: 'Paysagistes',
  emoji: '🌿',
  naf: [
    { code: '81.30Z', label: "Services d'aménagement paysager", keyword: 'paysagiste' },
    { code: '01.30Z', label: 'Reproduction de plantes (pépinières)', keyword: 'pépinière' },
    { code: '43.12A', label: 'Travaux de terrassement courants', keyword: 'terrassement' },
    { code: '02.20Z', label: 'Exploitation forestière (élagage)', keyword: 'élagage' },
    { code: '47.76Z', label: 'Commerce de détail de fleurs, plantes', keyword: 'fleuriste' },
  ],
};

export const AGENCE_SECTORS: Sector[] = [
  {
    id: 'btp',
    label: 'Artisans du BTP',
    emoji: '🏗️',
    naf: [
      { code: '43.99C', label: 'Travaux de maçonnerie générale et gros œuvre de bâtiment', keyword: 'maçon' },
      { code: '43.22A', label: "Travaux d'installation d'eau et de gaz", keyword: 'plombier' },
      { code: '43.22B', label: "Travaux d'installation d'équipements thermiques et de climatisation", keyword: 'chauffagiste' },
      { code: '43.21A', label: "Travaux d'installation électrique dans tous locaux", keyword: 'électricien' },
      { code: '43.32A', label: 'Travaux de menuiserie bois et PVC', keyword: 'menuisier' },
      { code: '43.32B', label: 'Travaux de menuiserie métallique et serrurerie', keyword: 'serrurier' },
      { code: '43.91B', label: 'Travaux de couverture par éléments', keyword: 'couvreur' },
      { code: '43.91A', label: 'Travaux de charpente', keyword: 'charpentier' },
      { code: '43.34Z', label: 'Travaux de peinture et vitrerie', keyword: 'peintre en bâtiment' },
      { code: '43.31Z', label: 'Travaux de plâtrerie', keyword: 'plaquiste' },
      { code: '43.33Z', label: 'Travaux de revêtement des sols et des murs', keyword: 'carreleur' },
      { code: '43.29A', label: "Travaux d'isolation", keyword: 'isolation' },
      { code: '43.39Z', label: 'Autres travaux de finition', keyword: 'rénovation' },
      { code: '43.12A', label: 'Travaux de terrassement courants et travaux préparatoires', keyword: 'terrassement' },
      { code: '41.20A', label: 'Construction de maisons individuelles', keyword: 'constructeur de maisons' },
    ],
  },
  {
    id: 'restauration',
    label: 'Restauration & métiers de bouche',
    emoji: '🍽️',
    naf: [
      { code: '56.10A', label: 'Restauration traditionnelle', keyword: 'restaurant' },
      { code: '56.10C', label: 'Restauration de type rapide', keyword: 'restauration rapide' },
      { code: '56.10B', label: 'Cafétérias et autres libres-services', keyword: 'cafétéria' },
      { code: '56.30Z', label: 'Débits de boissons', keyword: 'bar' },
      { code: '56.21Z', label: 'Services des traiteurs', keyword: 'traiteur' },
      { code: '10.71C', label: 'Boulangerie et boulangerie-pâtisserie', keyword: 'boulangerie' },
      { code: '10.71D', label: 'Pâtisserie', keyword: 'pâtisserie' },
      { code: '10.13B', label: 'Charcuterie', keyword: 'charcuterie' },
      { code: '47.22Z', label: 'Commerce de détail de viandes et de produits à base de viande en magasin spécialisé', keyword: 'boucherie' },
      { code: '55.10Z', label: 'Hôtels et hébergement similaire', keyword: 'hôtel' },
      { code: '55.20Z', label: 'Hébergement touristique et autre hébergement de courte durée', keyword: 'gîte' },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerces & beauté',
    emoji: '💇',
    naf: [
      { code: '96.02A', label: 'Coiffure', keyword: 'coiffeur' },
      { code: '96.02B', label: 'Soins de beauté', keyword: 'institut de beauté' },
      { code: '96.04Z', label: 'Entretien corporel', keyword: 'spa' },
      { code: '47.76Z', label: 'Commerce de détail de fleurs, plantes, graines, engrais, animaux de compagnie et aliments pour ces animaux en magasin spécialisé', keyword: 'fleuriste' },
      { code: '47.71Z', label: "Commerce de détail d'habillement en magasin spécialisé", keyword: 'boutique de vêtements' },
      { code: '47.24Z', label: 'Commerce de détail de pain, pâtisserie et confiserie en magasin spécialisé', keyword: 'chocolatier' },
      { code: '47.25Z', label: 'Commerce de détail de boissons en magasin spécialisé', keyword: 'cave à vin' },
      { code: '47.29Z', label: 'Autres commerces de détail alimentaires en magasin spécialisé', keyword: 'épicerie fine' },
      { code: '47.75Z', label: 'Commerce de détail de parfumerie et de produits de beauté en magasin spécialisé', keyword: 'parfumerie' },
      { code: '47.77Z', label: "Commerce de détail d'articles d'horlogerie et de bijouterie en magasin spécialisé", keyword: 'bijouterie' },
      { code: '47.59B', label: "Commerce de détail d'autres équipements du foyer", keyword: 'magasin de décoration' },
      { code: '47.78C', label: 'Autres commerces de détail spécialisés divers', keyword: 'boutique' },
    ],
  },
  {
    id: 'services',
    label: 'Services locaux',
    emoji: '🔧',
    naf: [
      { code: '45.20A', label: 'Entretien et réparation de véhicules automobiles légers', keyword: 'garage automobile' },
      { code: '49.32Z', label: 'Transports de voyageurs par taxis', keyword: 'taxi' },
      { code: '81.21Z', label: 'Nettoyage courant des bâtiments', keyword: 'entreprise de nettoyage' },
      { code: '81.30Z', label: "Services d'aménagement paysager", keyword: 'paysagiste' },
      { code: '85.53Z', label: 'Enseignement de la conduite', keyword: 'auto-école' },
      { code: '93.13Z', label: 'Activités des centres de culture physique', keyword: 'salle de sport' },
      { code: '74.20Z', label: 'Activités photographiques', keyword: 'photographe' },
      { code: '68.31Z', label: 'Agences immobilières', keyword: 'agence immobilière' },
      { code: '96.01B', label: 'Blanchisserie-teinturerie de détail', keyword: 'pressing' },
    ],
  },
];

export const OFFERS: Offer[] = [
  {
    id: 'paysapro',
    workspaceId: PAYSAPRO_WORKSPACE,
    name: 'Paysapro AI',
    tagline: 'Logiciel de devis pour paysagistes',
    audience: 'paysagistes',
    sectors: [LANDSCAPE],
    defaultDepartments: [],
    landscapeServices: true,
    logo: { bg: '#1f5c44', fg: '#8fcf9f' },
  },
  {
    id: 'agence',
    workspaceId: AGENCE_WORKSPACE,
    name: 'Signe & Seine',
    tagline: 'Agence web & communication',
    audience: 'artisans, commerçants et restaurateurs',
    sectors: AGENCE_SECTORS,
    defaultDepartments: ['76'],
    landscapeServices: false,
    logo: { bg: '#1d3a5f', fg: '#f2c14e' },
  },
];

export function offerByWorkspace(workspaceId: string | null | undefined): Offer {
  return OFFERS.find((o) => o.workspaceId === workspaceId) ?? OFFERS[0]!;
}

export function offerById(id: OfferId): Offer {
  return OFFERS.find((o) => o.id === id)!;
}

/** Codes NAF de l'offre (sans doublon, dans l'ordre des secteurs). */
export function offerNafCodes(o: Offer): string[] {
  return Array.from(new Set(o.sectors.flatMap((s) => s.naf.map((n) => n.code))));
}

/** Codes NAF de plusieurs secteurs (sans doublon). */
export function sectorNafCodes(o: Offer, sectorIds: string[]): string[] {
  return Array.from(new Set(o.sectors.filter((s) => sectorIds.includes(s.id)).flatMap((s) => s.naf.map((n) => n.code))));
}

const ALL_NAF: NafDef[] = [...LANDSCAPE.naf, ...AGENCE_SECTORS.flatMap((s) => s.naf)];

/** Libellés NAF de toutes les offres (le premier libellé rencontré fait foi). */
export const OFFER_NAF_LABELS: Record<string, string> = {};
for (const n of ALL_NAF) OFFER_NAF_LABELS[n.code] ??= n.label;

/** Métier courant d'un code NAF (« 43.21A » → « électricien »), null si inconnu. */
export function nafKeyword(code: string | null | undefined): string | null {
  return (code && ALL_NAF.find((n) => n.code === code)?.keyword) || null;
}

/** Secteur de l'offre auquel appartient un code NAF. */
export function sectorOfNaf(o: Offer, code: string | null | undefined): Sector | null {
  return (code && o.sectors.find((s) => s.naf.some((n) => n.code === code))) || null;
}

/** Mot-clé de recherche web d'une fiche : son métier, ou « paysagiste » dans l'espace Paysapro. */
export function searchTerm(p: { nafCode?: string | null; workspaceId?: string | null }): string | null {
  return nafKeyword(p.nafCode) ?? (offerByWorkspace(p.workspaceId).id === 'paysapro' ? 'paysagiste' : null);
}
