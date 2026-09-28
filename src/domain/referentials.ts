// Libellés métier : statuts CRM, prestations, tranches d'effectif INSEE, codes NAF.
import type { Milestone, ProspectStatus, ServiceTag, TaskPriority, TaskType, TemplateCategory } from './types';

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'accent' | 'danger';

export const STATUSES: { id: ProspectStatus; label: string; tone: Tone }[] = [
  { id: 'new', label: 'Nouveau', tone: 'neutral' },
  { id: 'to_qualify', label: 'À qualifier', tone: 'neutral' },
  { id: 'to_contact', label: 'À contacter', tone: 'info' },
  { id: 'contacted', label: 'Contacté', tone: 'info' },
  { id: 'replied', label: 'Réponse reçue', tone: 'accent' },
  { id: 'interested', label: 'Intéressé', tone: 'accent' },
  { id: 'demo_scheduled', label: 'Démo programmée', tone: 'warning' },
  { id: 'demo_done', label: 'Démo réalisée', tone: 'warning' },
  { id: 'trial', label: 'Essai', tone: 'warning' },
  { id: 'client', label: 'Client', tone: 'success' },
  { id: 'not_now', label: 'Pas maintenant', tone: 'neutral' },
  { id: 'not_interested', label: 'Pas intéressé', tone: 'neutral' },
  { id: 'do_not_contact', label: 'Ne plus contacter', tone: 'danger' },
];

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label])) as Record<ProspectStatus, string>;
export const STATUS_TONE = Object.fromEntries(STATUSES.map((s) => [s.id, s.tone])) as Record<ProspectStatus, Tone>;

/** Statuts « en cours » : une séquence commerciale est engagée. */
export const IN_PROGRESS: ProspectStatus[] = ['contacted', 'replied', 'interested', 'demo_scheduled', 'demo_done', 'trial'];

/** Étape du tunnel atteinte lorsqu'un prospect passe à ce statut. */
export const STATUS_MILESTONES: Partial<Record<ProspectStatus, Milestone[]>> = {
  contacted: ['contacted'],
  replied: ['contacted', 'replied'],
  interested: ['contacted', 'replied'],
  demo_scheduled: ['contacted', 'replied', 'demo'],
  demo_done: ['contacted', 'replied', 'demo'],
  trial: ['contacted', 'replied', 'demo', 'trial'],
  client: ['contacted', 'replied', 'demo', 'trial', 'client'],
};

export const MILESTONE_LABEL: Record<Milestone, string> = {
  contacted: 'Contactés',
  replied: 'Réponses',
  demo: 'Démos',
  trial: 'Essais',
  client: 'Clients',
};

export const SERVICES: { id: ServiceTag; label: string }[] = [
  { id: 'creation', label: 'Création de jardins' },
  { id: 'amenagement', label: 'Aménagement paysager' },
  { id: 'entretien', label: 'Entretien' },
  { id: 'terrassement', label: 'Terrassement' },
  { id: 'arrosage', label: 'Arrosage' },
  { id: 'clotures', label: 'Clôtures' },
  { id: 'terrasses', label: 'Terrasses' },
  { id: 'elagage', label: 'Élagage' },
  { id: 'haies', label: 'Taille de haies' },
  { id: 'maconnerie', label: 'Maçonnerie paysagère' },
  { id: 'piscine', label: 'Abords de piscine' },
  { id: 'engazonnement', label: 'Engazonnement' },
];
export const SERVICE_LABEL = Object.fromEntries(SERVICES.map((s) => [s.id, s.label])) as Record<ServiceTag, string>;

/** Reconnaît les prestations citées dans un texte libre (« création, entretien et élagage »). */
export function servicesFromText(text: string | null | undefined): ServiceTag[] {
  const t = (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (!t) return [];
  const rules: [ServiceTag, RegExp][] = [
    ['creation', /creation/],
    ['amenagement', /amenagement/],
    ['entretien', /entretien/],
    ['terrassement', /terrassement/],
    ['arrosage', /arrosage|irrigation/],
    ['clotures', /clotur/],
    ['terrasses', /terrasse/],
    ['elagage', /elagage|abattage/],
    ['haies', /haie/],
    ['maconnerie', /maconnerie|dallage|pavage/],
    ['piscine', /piscine/],
    ['engazonnement', /gazon|pelouse/],
  ];
  return rules.filter(([, re]) => re.test(t)).map(([id]) => id);
}

/** Tranches d'effectif salarié INSEE : code → [libellé, minimum]. */
export const HEADCOUNT_BANDS: Record<string, [string, number]> = {
  '00': ['0 salarié', 0],
  '01': ['1 ou 2 salariés', 1],
  '02': ['3 à 5 salariés', 3],
  '03': ['6 à 9 salariés', 6],
  '11': ['10 à 19 salariés', 10],
  '12': ['20 à 49 salariés', 20],
  '21': ['50 à 99 salariés', 50],
  '22': ['100 à 199 salariés', 100],
  '31': ['200 à 249 salariés', 200],
  '32': ['250 à 499 salariés', 250],
  '41': ['500 à 999 salariés', 500],
  '42': ['1 000 à 1 999 salariés', 1000],
  '51': ['2 000 à 4 999 salariés', 2000],
  '52': ['5 000 à 9 999 salariés', 5000],
  '53': ['10 000 salariés et plus', 10000],
};

export function headcountMin(band: string | null, headcount: number | null): number | null {
  if (headcount !== null && headcount >= 0) return headcount;
  if (!band) return null;
  return HEADCOUNT_BANDS[band]?.[1] ?? null;
}

export function headcountLabel(band: string | null, headcount: number | null): string {
  if (headcount !== null) return `${headcount} personne${headcount > 1 ? 's' : ''}`;
  if (band && HEADCOUNT_BANDS[band]) return HEADCOUNT_BANDS[band][0];
  return 'Non disponible';
}

export const NAF_LABELS: Record<string, string> = {
  '81.30Z': "Services d'aménagement paysager",
  '01.30Z': 'Reproduction de plantes (pépinières)',
  '43.12A': 'Travaux de terrassement courants',
  '02.20Z': 'Exploitation forestière (élagage)',
  '47.76Z': 'Commerce de détail de fleurs, plantes',
};

/** Codes NAF proposés dans les paramètres (81.30Z = cible par défaut). */
export const NAF_CHOICES = Object.keys(NAF_LABELS);

export function normalizeNaf(code: string | null | undefined): string | null {
  const c = (code ?? '').toUpperCase().replace(/\s/g, '');
  if (!c) return null;
  const m = /^(\d{2})\.?(\d{2})([A-Z])$/.exec(c);
  return m ? `${m[1]}.${m[2]}${m[3]}` : c;
}

export const TASK_TYPES: { id: TaskType; label: string }[] = [
  { id: 'follow_up', label: 'Relance' },
  { id: 'call', label: 'Appel' },
  { id: 'email', label: 'E-mail' },
  { id: 'demo', label: 'Démo' },
  { id: 'other', label: 'Autre' },
];
export const TASK_TYPE_LABEL = Object.fromEntries(TASK_TYPES.map((t) => [t.id, t.label])) as Record<TaskType, string>;
export const PRIORITY_LABEL: Record<TaskPriority, string> = { low: 'Basse', normal: 'Normale', high: 'Haute' };

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'first_contact', label: 'Premier contact' },
  { id: 'follow_up_1', label: 'Relance 1' },
  { id: 'follow_up_2', label: 'Relance 2' },
  { id: 'follow_up_3', label: 'Relance 3' },
  { id: 'demo_invite', label: 'Invitation démo' },
  { id: 'after_demo', label: 'Après démo' },
  { id: 'trial', label: 'Essai gratuit' },
  { id: 'reactivation', label: 'Réactivation' },
  { id: 'short', label: 'Message court (SMS / réseaux)' },
];
export const TEMPLATE_CATEGORY_LABEL = Object.fromEntries(TEMPLATE_CATEGORIES.map((t) => [t.id, t.label])) as Record<TemplateCategory, string>;
