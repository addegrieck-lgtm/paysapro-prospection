import { z } from 'zod';

/**
 * Paramètres de l'agence, modifiables dans l'administration (Paramètres).
 * Aucune information légale n'est pré-remplie : elles doivent être saisies par l'exploitant.
 */
export const settingsSchema = z.object({
  agencyName: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(140),
  /** Nom affiché comme « provisoire » dans l'administration tant que non confirmé. */
  nameConfirmed: z.boolean(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  siteUrl: z.string().trim().max(200),
  contactEmail: z.string().trim().max(200),
  contactPhone: z.string().trim().max(40),
  serviceArea: z.string().trim().max(200),
  openingHours: z.string().trim().max(200),
  notifyEmail: z.string().trim().max(200),

  /** Localisation publique (NAP) : affichée sur le site et dans les données structurées. */
  streetAddress: z.string().trim().max(200),
  postalCode: z.string().trim().max(10),
  city: z.string().trim().max(80),
  department: z.string().trim().max(80),
  region: z.string().trim().max(80),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  /** Communes de la zone principale (déplacements, pose) puis zone secondaire. */
  serviceAreasPrimary: z.array(z.string().trim().min(1).max(80)).max(40),
  serviceAreasSecondary: z.array(z.string().trim().min(1).max(80)).max(20),
  /** Horaires structurés (données structurées) ; « openingHours » reste le texte affiché. */
  openingDays: z.array(z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/),
  googleBusinessUrl: z.string().trim().max(300),
  socialUrls: z.array(z.string().trim().url().max(300)).max(10),

  legal: z.object({
    companyName: z.string().trim().max(200),
    legalForm: z.string().trim().max(120),
    capital: z.string().trim().max(60),
    address: z.string().trim().max(300),
    siren: z.string().trim().max(20),
    siret: z.string().trim().max(20),
    registry: z.string().trim().max(160),
    vatNumber: z.string().trim().max(30),
    publicationDirector: z.string().trim().max(120),
    hostName: z.string().trim().max(200),
    hostAddress: z.string().trim().max(300),
    hostContact: z.string().trim().max(200),
    mediatorName: z.string().trim().max(200),
    mediatorUrl: z.string().trim().max(300),
    insurance: z.string().trim().max(300),
    iban: z.string().trim().max(60),
  }),

  vatMode: z.enum(['normal', 'franchise']),
  vatRate: z.number().min(0).max(30),
  quoteValidityDays: z.number().int().min(1).max(365),
  paymentTermsDays: z.number().int().min(0).max(60),
  latePenaltyRate: z.string().trim().max(200),
  depositPercent: z.number().int().min(0).max(100),
  /** Abonnements : remise accordée avec engagement, durée de l'engagement et préavis de résiliation (en mois). */
  subscriptionDiscountPercent: z.number().int().min(0).max(50),
  subscriptionCommitmentMonths: z.number().int().min(1).max(36),
  subscriptionNoticeMonths: z.number().int().min(0).max(3),

  supplierPriceValidityDays: z.number().int().min(1).max(365),
  printMarkupPercent: z.number().min(0).max(500),
  internalHourlyCost: z.number().int().min(0),

  analyticsProvider: z.enum(['none', 'plausible', 'ga4']),
  plausibleDomain: z.string().trim().max(200),
  ga4Id: z.string().trim().max(40),
  searchConsoleToken: z.string().trim().max(200),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  agencyName: 'Signe & Seine',
  tagline: 'Sites internet, identité visuelle, impression et vitrines pour les entreprises du Pays de Caux et d’ailleurs.',
  nameConfirmed: false,
  accentColor: '#C2410C',
  siteUrl: '',
  contactEmail: 'contact@signeetseine.fr',
  contactPhone: '06 47 41 42 24',
  serviceArea: 'Pays de Caux et Seine-Maritime — partout en France à distance',
  openingHours: 'Du lundi au samedi, 8 h 30 – 20 h',
  notifyEmail: 'contact@signeetseine.fr',
  streetAddress: '',
  postalCode: '76210',
  city: 'Gruchet-le-Valasse',
  department: 'Seine-Maritime',
  region: 'Normandie',
  // Centre de la commune (geo.api.gouv.fr) : à remplacer par la position exacte si une adresse est publiée.
  latitude: 49.5473,
  longitude: 0.5149,
  serviceAreasPrimary: ['Gruchet-le-Valasse', 'Bolbec', 'Lillebonne', 'Port-Jérôme-sur-Seine', 'Saint-Romain-de-Colbosc', 'Goderville', 'Fécamp', 'Yvetot', 'Rives-en-Seine', 'Montivilliers', 'Le Havre'],
  serviceAreasSecondary: ['Rouen', 'Seine-Maritime', 'Eure', 'Normandie'],
  openingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  opensAt: '08:30',
  closesAt: '20:00',
  googleBusinessUrl: 'https://share.google/Kuoatbjm9GEr1Pvi2',
  socialUrls: [],
  legal: {
    companyName: '',
    legalForm: '',
    capital: '',
    address: '',
    siren: '',
    siret: '',
    registry: '',
    vatNumber: '',
    publicationDirector: '',
    hostName: '',
    hostAddress: '',
    hostContact: '',
    mediatorName: '',
    mediatorUrl: '',
    insurance: '',
    iban: '',
  },
  vatMode: 'normal',
  vatRate: 20,
  quoteValidityDays: 30,
  paymentTermsDays: 30,
  latePenaltyRate: 'trois fois le taux d’intérêt légal en vigueur',
  depositPercent: 30,
  subscriptionDiscountPercent: 10,
  subscriptionCommitmentMonths: 12,
  subscriptionNoticeMonths: 1,
  supplierPriceValidityDays: 30,
  printMarkupPercent: 35,
  internalHourlyCost: 0,
  analyticsProvider: 'none',
  plausibleDomain: '',
  ga4Id: '',
  searchConsoleToken: '',
};

/** Fusionne les paramètres enregistrés avec les valeurs par défaut (champs ajoutés dans une version ultérieure). */
export function mergeSettings(stored: unknown): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Settings>;
  const merged = { ...DEFAULT_SETTINGS, ...s, legal: { ...DEFAULT_SETTINGS.legal, ...(s.legal ?? {}) } };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

/** Informations légales manquantes : affichées en alerte dans l'administration, bloquent l'émission des factures. */
export function missingLegalInfo(s: Settings): string[] {
  const m: string[] = [];
  const l = s.legal;
  if (!l.companyName) m.push('Dénomination ou nom de l’entrepreneur');
  if (!l.legalForm) m.push('Forme juridique / statut');
  if (!l.address) m.push('Adresse du siège ou de domiciliation');
  if (!l.siren && !l.siret) m.push('SIREN / SIRET');
  if (s.vatMode === 'normal' && !l.vatNumber) m.push('Numéro de TVA intracommunautaire (régime réel de TVA)');
  if (!l.publicationDirector) m.push('Directeur de la publication');
  if (!l.hostName) m.push('Hébergeur du site');
  if (!s.contactEmail) m.push('E-mail de contact public');
  return m;
}

/** Initiales pour le monogramme du logo provisoire. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/[\s'-]+/).filter(Boolean);
  if (!words.length) return 'A';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}
