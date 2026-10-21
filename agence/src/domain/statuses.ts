/** Libellés et règles de statuts (CRM, devis, commandes d'impression, BAT, projets, factures). */

export type Option = readonly [value: string, label: string];

export const CONTACT_STATUSES = [
  ['nouveau', 'Nouveau'],
  ['a_contacter', 'À contacter'],
  ['contacte', 'Contacté'],
  ['qualifie', 'Qualifié'],
  ['devis_envoye', 'Devis envoyé'],
  ['gagne', 'Gagné'],
  ['perdu', 'Perdu'],
] as const satisfies readonly Option[];

export const CONTACT_SOURCES = [
  ['site_devis', 'Site — demande de devis'],
  ['site_contact', 'Site — formulaire de contact'],
  ['telephone', 'Téléphone'],
  ['recommandation', 'Recommandation'],
  ['reseaux_sociaux', 'Réseaux sociaux'],
  ['salon', 'Salon / événement'],
  ['prospection', 'Prospection directe'],
  ['autre', 'Autre'],
] as const satisfies readonly Option[];

export const EVENT_KINDS = [
  ['note', 'Note'],
  ['appel', 'Appel'],
  ['email', 'E-mail'],
  ['rdv', 'Rendez-vous'],
  ['systeme', 'Système'],
] as const satisfies readonly Option[];

export const QUOTE_STATUSES = [
  ['brouillon', 'Brouillon'],
  ['envoye', 'Envoyé'],
  ['accepte', 'Accepté'],
  ['refuse', 'Refusé'],
  ['expire', 'Expiré'],
  ['annule', 'Annulé'],
] as const satisfies readonly Option[];

export const REQUEST_STATUSES = [
  ['nouvelle', 'Nouvelle'],
  ['en_cours', 'En cours de traitement'],
  ['traitee', 'Traitée'],
  ['archivee', 'Archivée'],
] as const satisfies readonly Option[];

/** Statuts des commandes d'impression, dans l'ordre du processus. */
export const ORDER_STATUSES = [
  ['demande_recue', 'Demande reçue'],
  ['configuration_a_confirmer', 'Configuration à confirmer'],
  ['prix_a_verifier', 'Prix fournisseur à vérifier'],
  ['devis_en_preparation', 'Devis en préparation'],
  ['devis_envoye', 'Devis envoyé'],
  ['devis_accepte', 'Devis accepté'],
  ['visuel_en_preparation', 'Visuel en préparation'],
  ['bat_envoye', 'BAT envoyé'],
  ['bat_accepte', 'BAT accepté'],
  ['commande_a_passer', 'Commande fournisseur à passer'],
  ['commande_passee', 'Commande fournisseur passée'],
  ['en_production', 'En production'],
  ['expedie', 'Expédié'],
  ['livre', 'Livré'],
  ['termine', 'Terminé'],
  ['annule', 'Annulé'],
] as const satisfies readonly Option[];

export type OrderStatus = (typeof ORDER_STATUSES)[number][0];

export const PROOF_STATUSES = [
  ['brouillon', 'En préparation (non envoyé)'],
  ['envoye', 'Envoyé au client'],
  ['accepte', 'Accepté par le client'],
  ['refuse', 'Refusé — corrections demandées'],
  ['remplace', 'Remplacé par une version plus récente'],
] as const satisfies readonly Option[];

export const PROJECT_STATUSES = [
  ['brief', 'Brief'],
  ['conception', 'Conception'],
  ['developpement', 'Développement'],
  ['recette', 'Recette client'],
  ['valide', 'Validé par le client'],
  ['en_ligne', 'En ligne'],
  ['maintenance', 'Maintenance'],
  ['archive', 'Archivé'],
] as const satisfies readonly Option[];

export const ACCEPTANCE_STATUSES = [
  ['non_demandee', 'Non demandée'],
  ['en_attente', 'En attente du client'],
  ['validee', 'Validée par le client'],
  ['refusee', 'Corrections demandées'],
] as const satisfies readonly Option[];

export const INVOICE_STATUSES = [
  ['brouillon', 'Brouillon'],
  ['emise', 'Émise — en attente de paiement'],
  ['payee', 'Payée'],
] as const satisfies readonly Option[];

export const SUBSCRIPTION_STATUSES = [
  ['en_attente', 'En attente de signature'],
  ['actif', 'Actif'],
  ['suspendu', 'Suspendu'],
  ['termine', 'Terminé'],
] as const satisfies readonly Option[];

export const VARIANT_STATUSES = [
  ['verifie', 'Vérifié'],
  ['a_verifier', 'À vérifier'],
  ['expire', 'Expiré'],
] as const satisfies readonly Option[];

export const PUBLISH_STATUSES = [
  ['published', 'Publié'],
  ['draft', 'Brouillon'],
  ['disabled', 'Désactivé'],
] as const satisfies readonly Option[];

export function labelOf(options: readonly Option[], value: string | null | undefined): string {
  return options.find((o) => o[0] === value)?.[1] ?? value ?? '';
}

export function isOneOf<T extends readonly Option[]>(options: T, value: unknown): value is T[number][0] {
  return typeof value === 'string' && options.some((o) => o[0] === value);
}

const ORDER_INDEX = new Map<string, number>(ORDER_STATUSES.map(([v], i) => [v, i]));

export interface OrderGuardInput {
  bat_required: boolean;
  hasAcceptedProof: boolean;
  hasSentProof: boolean;
  supplierOrderRef: string;
  supplierOrderedAt: string | null;
}

/**
 * Règles de cohérence d'une commande d'impression. Retourne la raison du refus, ou null si le statut est permis.
 *  • « BAT envoyé » exige un BAT réellement envoyé ; « BAT accepté » un BAT accepté par le client.
 *  • Aucune étape fournisseur sans BAT accepté (quand le BAT est prévu).
 *  • « Commande fournisseur passée » et suivantes exigent la référence de commande fournisseur réelle.
 */
export function orderTransitionError(to: string, o: OrderGuardInput): string | null {
  const idx = ORDER_INDEX.get(to);
  if (idx === undefined) return 'Statut inconnu.';
  if (to === 'annule') return null;
  if (to === 'bat_envoye' && !o.hasSentProof && !o.hasAcceptedProof) return 'Aucun BAT n’a été envoyé au client.';
  if (o.bat_required && idx >= ORDER_INDEX.get('bat_accepte')! && !o.hasAcceptedProof) {
    return 'Le BAT doit être accepté par le client avant cette étape.';
  }
  if (idx >= ORDER_INDEX.get('commande_passee')! && (!o.supplierOrderRef.trim() || !o.supplierOrderedAt)) {
    return 'Renseignez la référence et la date de la commande passée chez le fournisseur.';
  }
  return null;
}

export const ACTIVE_ORDER_STATUSES = ORDER_STATUSES.map((s) => s[0]).filter((s) => !['termine', 'annule', 'livre'].includes(s));
