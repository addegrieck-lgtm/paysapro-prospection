// Modèle de données du module de prospection.
//
// Règle absolue : une donnée inconnue vaut `null` (affichée « Non disponible »), jamais une valeur inventée.
// Chaque enregistrement porte `workspaceId` : l'isolation est déjà en place pour une future version en ligne.

export type ID = string;
export type ISODate = string;

export type ProspectStatus =
  | 'new'
  | 'to_qualify'
  | 'to_contact'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'demo_scheduled'
  | 'demo_done'
  | 'trial'
  | 'client'
  | 'not_now'
  | 'not_interested'
  | 'do_not_contact';

/** Étapes du tunnel commercial : chacune est datée la première fois qu'elle est atteinte. */
export type Milestone = 'contacted' | 'replied' | 'demo' | 'trial' | 'client';

export type ServiceTag =
  | 'creation'
  | 'entretien'
  | 'amenagement'
  | 'terrassement'
  | 'arrosage'
  | 'clotures'
  | 'terrasses'
  | 'elagage'
  | 'haies'
  | 'maconnerie'
  | 'piscine'
  | 'engazonnement';

export type SourceKind = 'sirene' | 'csv' | 'manual' | 'demo' | 'enrichment' | 'search';

/** Provenance d'une donnée (champ par champ). */
export type FieldSourceType = 'official_api' | 'csv' | 'manual' | 'web' | 'import';
export type Confidence = 'high' | 'medium' | 'low';

export interface FieldSource {
  type: FieldSourceType;
  /** Fournisseur précis : « recherche-entreprises », nom du fichier CSV, « démo »… */
  provider: string;
  at: ISODate;
  confidence: Confidence;
}

export type EnrichmentStatus = 'none' | 'pending' | 'processing' | 'enriched' | 'partial' | 'failed';

interface Tracked {
  id: ID;
  workspaceId: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
  createdBy: string;
}

export interface Prospect extends Tracked {
  // Identité (SIRENE)
  name: string;
  tradeName: string | null;
  siren: string | null;
  siret: string | null;
  nafCode: string | null;
  activity: string | null;
  legalForm: string | null;
  /** true pour un entrepreneur individuel (personne physique : RGPD, minimisation) */
  individual: boolean | null;
  active: boolean | null;
  creationDate: string | null;
  /** Code de tranche d'effectif INSEE (« 02 » = 3 à 5 salariés), null si non renseigné */
  headcountBand: string | null;
  /** Effectif saisi manuellement (prioritaire sur la tranche) */
  headcount: number | null;
  // Localisation
  address: string | null;
  postalCode: string | null;
  city: string | null;
  department: string | null;
  region: string | null;
  // Coordonnées
  contactFirstName: string | null;
  contactLastName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  // Présence en ligne (saisie manuelle ou import autorisé)
  googleUrl: string | null;
  googleRating: number | null;
  googleReviews: number | null;
  googleCategory: string | null;
  googleCheckedAt: ISODate | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  tiktok: string | null;
  // Qualification
  services: ServiceTag[];
  interventionArea: string | null;
  // CRM
  status: ProspectStatus;
  owner: string | null;
  lastContactAt: ISODate | null;
  nextFollowUpAt: ISODate | null;
  milestones: Partial<Record<Milestone, ISODate>>;
  doNotContact: boolean;
  doNotContactReason: string | null;
  // Score (recalculé à chaque enregistrement)
  score: number;
  // Conformité : origine et fraîcheur de la donnée
  source: SourceKind;
  sourceUrl: string | null;
  dateCollected: ISODate;
  lastVerifiedAt: ISODate | null;
  /** Entreprise fictive (mode démo) — jamais contactable */
  demo: boolean;
  // Données administratives complémentaires (source officielle)
  isHeadOffice: boolean | null;
  companyCategory: string | null;
  openEstablishments: number | null;
  employer: boolean | null;
  description: string | null;
  // Enrichissement
  enrichmentStatus: EnrichmentStatus;
  enrichedAt: ISODate | null;
  enrichmentError: string | null;
  /** Provenance, date et confiance de chaque champ renseigné */
  fieldSources: Partial<Record<string, FieldSource>>;
  /** Données personnelles effacées (RGPD) */
  anonymized: boolean;
  // V2 — coordonnées vérifiées (résumé du meilleur numéro, détail dans company_phones)
  phoneConfidence: number | null;
  phoneStatus: ContactStatus | null;
  websiteVerified: boolean | null;
  latitude: number | null;
  longitude: number | null;
  /** Date de l'opposition (« Ne plus contacter ») */
  oppositionAt: ISODate | null;
  /** Date d'entrée dans le CRM actif (statut « À contacter ») */
  qualifiedAt: ISODate | null;
  /** Dernière recherche de coordonnées (annuaire, site) — cache ENRICHMENT_CACHE_DAYS */
  contactsCheckedAt: ISODate | null;
}

// ─── V2 : coordonnées multi-sources ───

export type PhoneType = 'landline' | 'mobile' | 'fax' | 'unknown';
export type PhoneRole = 'primary' | 'secondary' | 'mobile' | 'fax';
/** 🟢 vérifié (fortement associé) · 🟠 à vérifier · ⚪ non vérifié · rejeté par l'utilisateur */
export type ContactStatus = 'verified' | 'to_verify' | 'unverified' | 'rejected';
export type ContactSourceKind = 'manual' | 'official' | 'website' | 'directory' | 'import' | 'social';

/** Une source où la donnée a été trouvée. */
export interface ContactEvidence {
  kind: ContactSourceKind;
  /** « Site officiel », « OpenStreetMap », « Import CSV (fichier.csv) », « Saisie manuelle »… */
  provider: string;
  url: string | null;
  at: ISODate;
  /** Éléments concordants constatés sur la source (SIRET, nom, ville, adresse, domaine) */
  matched: string[];
  /** Stratégie de recherche qui a produit la donnée (apprentissage) */
  strategy?: StrategyId;
  /** Confiance de la donnée au moment de sa découverte (précision des stratégies) */
  score?: number;
}

interface CompanyContact {
  id: ID;
  workspaceId: ID;
  prospectId: ID;
  /** Valeur normalisée (clé de déduplication) */
  value: string;
  display: string;
  evidence: ContactEvidence[];
  confidence: number;
  confidenceReasons: string[];
  status: ContactStatus;
  isPrimary: boolean;
  /** Saisi ou validé par l'utilisateur : jamais remplacé automatiquement */
  manual: boolean;
  /** Même valeur trouvée chez une autre entreprise */
  shared: boolean;
  foundAt: ISODate;
  verifiedAt: ISODate | null;
  updatedAt: ISODate;
  /** Fraîcheur : dernière fois que la donnée a été revue sur une source */
  lastSeenAt?: ISODate;
  /** Dernière vérification (réenrichissement de l'entreprise) */
  lastCheckedAt?: ISODate;
  /** current : actuelle · historical : n'apparaît plus sur la page où elle avait été trouvée */
  currency?: 'current' | 'historical';
  /** Retour de l'utilisateur (✓ correct / ✗ incorrect) — alimente l'apprentissage */
  feedback?: FeedbackType | null;
}

export interface CompanyPhone extends CompanyContact {
  /** Format interne +33XXXXXXXXX */
  e164: string;
  type: PhoneType;
  role: PhoneRole;
}

export interface CompanyEmail extends CompanyContact {
  kind: 'generic' | 'nominative' | 'unknown';
}

export interface CompanyWebsite extends CompanyContact {
  /** Le site correspond à l'entreprise (score de correspondance ≥ seuil « probable ») */
  verified: boolean;
  /** Score de correspondance du site avec l'entreprise (0–100, voir domain/identity.ts) */
  matchScore?: number;
}

/** Version compacte d'un prospect, gardée en mémoire pour filtrer 100 000 lignes instantanément. */
export interface ProspectRow {
  id: ID;
  workspaceId: ID;
  name: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  department: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  googleUrl: string | null;
  googleRating: number | null;
  googleReviews: number | null;
  headcountMin: number | null;
  nafCode: string | null;
  services: ServiceTag[];
  activity: string | null;
  siren: string | null;
  siret: string | null;
  creationDate: string | null;
  status: ProspectStatus;
  score: number;
  owner: string | null;
  lastContactAt: ISODate | null;
  nextFollowUpAt: ISODate | null;
  milestones: Partial<Record<Milestone, ISODate>>;
  doNotContact: boolean;
  demo: boolean;
  createdAt: ISODate;
  active: boolean | null;
  hasSocial: boolean;
  enrichmentStatus: EnrichmentStatus;
  enrichedAt: ISODate | null;
  phoneConfidence: number | null;
  phoneStatus: ContactStatus | null;
  headcountBand: string | null;
  /** Texte normalisé pour la recherche instantanée */
  search: string;
}

export interface ProspectNote extends Tracked {
  prospectId: ID;
  text: string;
  author: string;
}

export type ActivityType =
  | 'imported'
  | 'created'
  | 'updated'
  | 'enriched'
  | 'score'
  | 'status'
  | 'note'
  | 'email'
  | 'call'
  | 'message'
  | 'task_created'
  | 'task_done'
  | 'do_not_contact'
  | 'merged'
  | 'anonymized';

export interface ProspectActivity {
  id: ID;
  workspaceId: ID;
  prospectId: ID;
  type: ActivityType;
  label: string;
  at: ISODate;
  by: string;
  /** Détail (ex. « ✓ SIREN confirmé », « ✓ Adresse mise à jour ») */
  details?: string[];
}

// ─── Enrichissement ───

export type QueueJobStatus = 'pending' | 'processing' | 'completed' | 'partial' | 'failed';

export interface EnrichmentJob {
  id: ID;
  workspaceId: ID;
  prospectId: ID;
  status: QueueJobStatus;
  /** Résultat détaillé une fois traité */
  outcome: 'enriched' | 'partial' | 'no_change' | 'not_found' | 'ambiguous' | 'error' | null;
  force: boolean;
  /** retry_count */
  attempts: number;
  /** last_error */
  error: string | null;
  /** next_retry_at : erreur temporaire, nouvel essai différé */
  nextRetryAt: ISODate | null;
  /** Ancien mode « Maximiser les téléphones » (= mode « max ») */
  maxPhones: boolean;
  /** Rapide / Normal / Maximum contact (budget de recherche) */
  mode?: EnrichmentMode;
  result: EnrichmentFound | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Ce qu'un enrichissement a trouvé (statistiques de performance). */
export interface EnrichmentFound {
  phones: number;
  verifiedPhones: number;
  emails: number;
  websites: number;
  /** Nouvelles données par source (« Site officiel », « OpenStreetMap »…) */
  bySource: Record<string, number>;
}

export interface EnrichmentLog {
  id: ID;
  workspaceId: ID;
  prospectId: ID;
  provider: string;
  status: 'enriched' | 'partial' | 'no_change' | 'not_found' | 'ambiguous' | 'failed';
  startedAt: ISODate;
  completedAt: ISODate;
  fieldsUpdated: string[];
  fieldsConfirmed: string[];
  fromCache: boolean;
  error: string | null;
  durationMs?: number;
  found?: EnrichmentFound;
  /** Étapes exécutées (administratif, annuaire, site, contacts…) */
  steps?: string[];
  mode?: EnrichmentMode;
  /** Stratégies exécutées, dans l'ordre choisi par le moteur */
  strategies?: StrategyId[];
  /** Requêtes consommées */
  requests?: number;
  /** complete : coordonnées trouvées · budget : budget atteint · exhausted : plus de piste · fresh : récent */
  stoppedBy?: 'complete' | 'budget' | 'exhausted' | 'fresh';
}

export type DuplicateRule = 'siret' | 'siren' | 'name_address' | 'name_phone' | 'phone' | 'name_city' | 'website' | 'email';

export interface DuplicateCandidate {
  id: ID;
  workspaceId: ID;
  prospectIdA: ID;
  prospectIdB: ID;
  rule: DuplicateRule;
  status: 'open' | 'merged' | 'ignored' | 'kept_both';
  createdAt: ISODate;
  resolvedAt: ISODate | null;
}

export type TaskType = 'call' | 'email' | 'follow_up' | 'demo' | 'other';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface ProspectTask extends Tracked {
  prospectId: ID;
  prospectName: string;
  type: TaskType;
  dueAt: ISODate;
  priority: TaskPriority;
  note: string;
  done: boolean;
  doneAt: ISODate | null;
}

export type Presence = 'any' | 'yes' | 'no';

/** Filtres de la base (aussi utilisés pour les segments dynamiques). */
export interface ProspectFilter {
  q?: string;
  regions?: string[];
  departments?: string[];
  city?: string;
  scoreMin?: number | null;
  scoreMax?: number | null;
  statuses?: ProspectStatus[];
  ratingMin?: number | null;
  reviewsMin?: number | null;
  headcountMin?: number | null;
  hasPhone?: Presence;
  hasWebsite?: Presence;
  hasEmail?: Presence;
  hasGoogle?: Presence;
  hasSocial?: Presence;
  active?: Presence;
  enrichment?: EnrichmentStatus[];
  /** Niveau du meilleur téléphone */
  phoneStatus?: ('verified' | 'to_verify' | 'unverified')[];
  /** Tranches d'effectif INSEE */
  headcountBands?: string[];
  services?: ServiceTag[];
  nafCodes?: string[];
  createdAfter?: string | null;
  createdBefore?: string | null;
  lastContactBefore?: string | null;
  lastContactAfter?: string | null;
  followUpDue?: boolean;
  neverContacted?: boolean;
  includeDoNotContact?: boolean;
  demo?: Presence;
}

export type SortKey = 'score' | 'reviews' | 'rating' | 'name' | 'department' | 'lastContact' | 'nextFollowUp' | 'created';

export interface ProspectQuery {
  filter: ProspectFilter;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  ids?: ID[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Segment extends Tracked {
  name: string;
  description: string;
  filter: ProspectFilter;
}

export type TemplateCategory =
  | 'first_contact'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'follow_up_3'
  | 'demo_invite'
  | 'after_demo'
  | 'trial'
  | 'reactivation'
  | 'short';

export interface MessageTemplate extends Tracked {
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  builtIn: boolean;
}

export type RecipientState = 'pending' | 'opened' | 'sent' | 'replied' | 'skipped';

export interface CampaignRecipient {
  prospectId: ID;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  body: string;
  state: RecipientState;
  sentAt: ISODate | null;
}

export type CampaignStatus = 'draft' | 'validated' | 'running' | 'done';

export interface Campaign extends Tracked {
  name: string;
  segmentId: ID | null;
  templateId: ID;
  status: CampaignStatus;
  testMode: boolean;
  recipients: CampaignRecipient[];
  excluded: { prospectId: ID; name: string; reason: ExclusionReason }[];
  validatedAt: ISODate | null;
}

export type ExclusionReason = 'do_not_contact' | 'suppression' | 'no_email' | 'demo' | 'client';

export type SuppressionKind = 'siren' | 'siret' | 'email' | 'phone';

export interface SuppressionEntry extends Tracked {
  kind: SuppressionKind;
  value: string;
  reason: string;
}

export interface ImportReport extends Tracked {
  source: SourceKind;
  label: string;
  total: number;
  added: number;
  updated: number;
  duplicates: number;
  invalid: number;
  excluded: number;
  /** Enrichissement : lignes qui ne correspondent à aucun prospect existant */
  notFound: number;
  /** Doublons potentiels créés (à vérifier) */
  candidates?: number;
  errors: { line: number; message: string }[];
  finishedAt: ISODate | null;
}

export type Role = 'owner' | 'admin' | 'sales' | 'viewer';

export interface Settings {
  workspaceId: ID;
  userName: string;
  role: Role;
  saasName: string;
  senderName: string;
  signature: string;
  formality: 'vous' | 'tu';
  adminEmail: string;
  testMode: boolean;
  nafCodes: string[];
  targetDepartments: string[];
  minScore: number;
  dailyContactLimit: number;
  timezone: string;
  /** Valeur moyenne d'un client (€) pour la « valeur potentielle » ; null = non configurée */
  averageDealValue: number | null;
  excludeIndividuals: boolean;
  emailProvider: 'mailto';
  onboarded: boolean;
  /** Ajoute automatiquement au CRM (statut « À contacter ») les prospects actifs avec un téléphone vérifié */
  autoQualify: boolean;
  /** Sources activées pour l'enrichissement */
  providers: { official: boolean; directory: boolean; website: boolean; websiteDiscovery: boolean };
  /** Part d'exploration du moteur auto-apprenant (0,2 = 20 % des choix testent des stratégies moins connues) */
  exploration?: number;
  /** Assistant commercial : base de connaissances, scripts, tarifs, liens, image (absent = contenu par défaut) */
  sales?: import('./sales').SalesConfig;
}

// ─── Moteur auto-apprenant : stratégies, statistiques, retours ───

export type EnrichmentMode = 'fast' | 'normal' | 'max';
export type ContactField = 'phone' | 'email' | 'website';
export type FeedbackType = 'correct' | 'incorrect';

/** Identifiants des stratégies de recherche (catalogue : domain/strategies.ts) */
export type StrategyId =
  | 'osm_directory'
  | 'site_known'
  | 'site_deep'
  | 'domain_name'
  | 'domain_trade'
  | 'domain_name_city'
  | 'domain_name_dept'
  | 'domain_activity'
  | `web_${string}`;

/** Segment d'apprentissage : les performances diffèrent selon le secteur, la région et la taille. */
export interface Segment3 {
  sector: string;
  region: string;
  size: string;
}

/**
 * enrichment_strategy_stats — une ligne par stratégie × champ × segment (secteur, région, taille).
 * Aucune donnée personnelle : uniquement des compteurs.
 */
export interface StrategyStat {
  id: ID;
  workspaceId: ID;
  strategyId: StrategyId;
  field: ContactField;
  sector: string;
  region: string;
  size: string;
  /** Essais où le champ était recherché */
  attempts: number;
  /** Essais ayant produit au moins une donnée nouvelle */
  successes: number;
  /** Données nouvelles produites */
  found: number;
  /** Dont confiance ≥ 80 à la découverte */
  verified: number;
  /** Confirmées par l'utilisateur (✓) alors qu'elles étaient sous 80 */
  confirmedLow: number;
  /** Confirmées par l'utilisateur (toutes) */
  confirmed: number;
  /** Déclarées incorrectes (✗ ou corrigées à la main) */
  falsePositive: number;
  /** Dont faux positifs parmi les données « vérifiées » (≥ 80) */
  falsePositiveVerified: number;
  sumConfidence: number;
  /** Requêtes consommées (coût) */
  sumCost: number;
  sumMs: number;
  lastUsedAt: ISODate;
}

/** source_performance — performance par source (OpenStreetMap, site officiel…) × secteur × champ. */
export interface SourcePerformance {
  id: ID;
  workspaceId: ID;
  source: string;
  sector: string;
  field: ContactField;
  attempts: number;
  found: number;
  verified: number;
  falsePositive: number;
  lastUpdated: ISODate;
}

/** enrichment_feedback — retour utilisateur sur une coordonnée trouvée. */
export interface EnrichmentFeedback {
  id: ID;
  workspaceId: ID;
  prospectId: ID;
  field: ContactField;
  oldValue: string | null;
  newValue: string | null;
  source: string | null;
  strategy: StrategyId | null;
  feedbackType: FeedbackType;
  /** « ✓ / ✗ sur la fiche », « correction manuelle de la fiche »… */
  origin: string;
  createdAt: ISODate;
}

/** enrichment_attempts — trace de chaque stratégie exécutée (vue technique). Pas de contenu de page. */
export interface EnrichmentAttempt {
  id: ID;
  workspaceId: ID;
  prospectId: ID;
  strategyId: StrategyId;
  provider: string;
  /** Requête ou cible (domaines testés, URL analysée) */
  query: string;
  mode: EnrichmentMode;
  /** true : choisie par exploration (20 %), false : meilleure stratégie connue */
  explored: boolean;
  expectedValue: number;
  targeted: ContactField[];
  timestamp: ISODate;
  resultCount: number;
  phonesFound: number;
  emailsFound: number;
  websitesFound: number;
  verified: number;
  requests: number;
  executionMs: number;
  error: string | null;
}

/** contact_history — changement de la valeur principale d'une fiche (ancienne → nouvelle, pourquoi). */
export interface ContactChange {
  id: ID;
  workspaceId: ID;
  prospectId: ID;
  field: ContactField;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  source: string | null;
  changedAt: ISODate;
}
