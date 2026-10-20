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
  agencyName: 'Atelier Sillage',
  tagline: 'Sites internet, identité visuelle et impression pour les entreprises qui veulent être vues.',
  nameConfirmed: false,
  accentColor: '#C2410C',
  siteUrl: '',
  contactEmail: '',
  contactPhone: '',
  serviceArea: 'Partout en France, à distance',
  openingHours: 'Du lundi au vendredi, 9 h – 18 h',
  notifyEmail: '',
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
