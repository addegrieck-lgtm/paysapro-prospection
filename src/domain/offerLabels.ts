// Vocabulaire commercial de l'espace actif. Paysapro vend un logiciel (démo, essai gratuit) ; l'agence vend des
// prestations (rendez-vous, devis). Les mêmes statuts et étapes servent aux deux : seuls les LIBELLÉS changent.
//
// Les tables de libellés (referentials, sales) sont mises à jour sur place au changement d'espace, avant le rendu :
// l'interface relit ces tables à chaque affichage, aucun écran n'a besoin de connaître l'offre.
import type { Offer } from './offers';
import type { Milestone, ProspectStatus, TaskType, TemplateCategory } from './types';
import { MILESTONE_LABEL, STATUSES, STATUS_LABEL, TASK_TYPES, TASK_TYPE_LABEL, TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABEL } from './referentials';
import { CALL_OUTCOMES, type CallOutcome } from './sales';

interface Vocabulary {
  statuses: Partial<Record<ProspectStatus, string>>;
  milestones: Partial<Record<Milestone, string>>;
  categories: Partial<Record<TemplateCategory, string>>;
  tasks: Partial<Record<TaskType, string>>;
  outcomes: Partial<Record<CallOutcome, string>>;
}

const AGENCE: Vocabulary = {
  statuses: { demo_scheduled: 'RDV programmé', demo_done: 'RDV réalisé', trial: 'Devis envoyé' },
  milestones: { demo: 'RDV', trial: 'Devis' },
  categories: { demo_invite: 'Proposition de rendez-vous', after_demo: 'Après rendez-vous', trial: 'Suivi du devis' },
  tasks: { demo: 'Rendez-vous' },
  outcomes: { demo: 'Rendez-vous à prévoir' },
};

// Libellés d'origine (Paysapro), pour revenir en arrière au changement d'espace
const ORIGINAL = {
  statuses: Object.fromEntries(STATUSES.map((s) => [s.id, s.label])),
  milestones: { ...MILESTONE_LABEL },
  categories: Object.fromEntries(TEMPLATE_CATEGORIES.map((c) => [c.id, c.label])),
  tasks: Object.fromEntries(TASK_TYPES.map((t) => [t.id, t.label])),
  outcomes: Object.fromEntries(CALL_OUTCOMES.map((o) => [o.id, o.label])),
} as Vocabulary;

export function vocabularyOf(offer: Pick<Offer, 'id'>): Vocabulary {
  if (offer.id !== 'agence') return ORIGINAL;
  return {
    statuses: { ...ORIGINAL.statuses, ...AGENCE.statuses },
    milestones: { ...ORIGINAL.milestones, ...AGENCE.milestones },
    categories: { ...ORIGINAL.categories, ...AGENCE.categories },
    tasks: { ...ORIGINAL.tasks, ...AGENCE.tasks },
    outcomes: { ...ORIGINAL.outcomes, ...AGENCE.outcomes },
  };
}

/** Applique le vocabulaire de l'offre à toutes les tables de libellés. */
export function applyOfferLabels(offer: Pick<Offer, 'id'>): void {
  const v = vocabularyOf(offer);
  for (const s of STATUSES) STATUS_LABEL[s.id] = s.label = v.statuses[s.id] ?? s.label;
  Object.assign(MILESTONE_LABEL, v.milestones);
  for (const c of TEMPLATE_CATEGORIES) TEMPLATE_CATEGORY_LABEL[c.id] = c.label = v.categories[c.id] ?? c.label;
  for (const t of TASK_TYPES) TASK_TYPE_LABEL[t.id] = t.label = v.tasks[t.id] ?? t.label;
  for (const o of CALL_OUTCOMES) o.label = v.outcomes[o.id] ?? o.label;
}
