import type { Deps } from '../app/context';
import type { Settings } from '../domain/settings';
import type { ContactRow } from '../repo/types';
import { randomToken } from '../lib/crypto';
import { nextNumber } from '../repo/settings';
import { serviceBySlug } from '../repo/catalog';
import { todayParis, formatDate } from '../domain/dates';
import { formatEuros } from '../domain/money';
import { type Formula, commitmentEnd, discountedPrice, terminationDate } from '../domain/contracts';
import { addContactEvent, siteLink } from './requests';

export interface SubscriptionRow {
  id: number;
  contact_id: number;
  service_slug: string;
  label: string;
  monthly_ht: number;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string;
  number: string | null;
  formula: string;
  base_monthly_ht: number | null;
  discount_percent: number;
  commitment_months: number;
  notice_months: number;
  terms: string;
  contract_status: string;
  token: string | null;
  sent_at: string | null;
  signed_at: string | null;
  signed_name: string | null;
  termination_requested_at: string | null;
  termination_by: string | null;
  renewal_notice_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Contenu de l'offre figé dans le contrat au moment où il est établi (une modification ultérieure du catalogue ne le change pas). */
export interface ContractTerms {
  serviceName: string;
  description: string;
  includes: string;
  exclusions: string;
  conditions: string;
  /** Précisions propres à ce client (volume de modifications, délai d'intervention, accès…). */
  extra: string;
}

export const parseTerms = (r: Pick<SubscriptionRow, 'terms'>): ContractTerms => ({ serviceName: '', description: '', includes: '', exclusions: '', conditions: '', extra: '', ...(JSON.parse(r.terms || '{}') as Partial<ContractTerms>) });

export interface ContractInput {
  contactId: number;
  serviceSlug: string;
  label: string;
  formula: Formula;
  baseMonthlyHt: number;
  startDate: string;
  extra: string;
}

async function termsFor(deps: Deps, slug: string, label: string, extra: string): Promise<ContractTerms> {
  const svc = slug ? await serviceBySlug(deps.db, slug, false) : undefined;
  return {
    serviceName: svc?.name ?? label,
    description: svc?.description ?? '',
    includes: svc?.includes ?? '',
    exclusions: svc?.exclusions ?? '',
    conditions: svc?.conditions ?? '',
    extra,
  };
}

/** Paramètres d'engagement et prix appliqués à une formule (valeurs des Paramètres au moment de l'établissement). */
function pricing(s: Settings, formula: Formula, base: number) {
  const engaged = formula === 'engagement';
  const discount = engaged ? s.subscriptionDiscountPercent : 0;
  return { discount, commitment: engaged ? s.subscriptionCommitmentMonths : 0, notice: s.subscriptionNoticeMonths, monthly: discountedPrice(base, discount) };
}

export async function createContract(deps: Deps, s: Settings, input: ContractInput): Promise<number> {
  const p = pricing(s, input.formula, input.baseMonthlyHt);
  const now = new Date().toISOString();
  const number = await nextNumber(deps.db, 'CTR', Number(input.startDate.slice(0, 4)));
  const r = await deps.db.run(
    `INSERT INTO subscriptions (contact_id, service_slug, label, monthly_ht, start_date, status, notes, number, formula, base_monthly_ht, discount_percent,
       commitment_months, notice_months, terms, contract_status, token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'en_attente', '', ?, ?, ?, ?, ?, ?, ?, 'a_signer', ?, ?, ?)`,
    [input.contactId, input.serviceSlug, input.label, p.monthly, input.startDate, number, input.formula, input.baseMonthlyHt, p.discount, p.commitment, p.notice,
      JSON.stringify(await termsFor(deps, input.serviceSlug, input.label, input.extra)), randomToken(32), now, now],
  );
  return r.lastId;
}

/** Modification d'un contrat non signé (formule, prix, date, précisions) : le contenu de l'offre est figé à nouveau. */
export async function updateContract(deps: Deps, s: Settings, sub: SubscriptionRow, input: Omit<ContractInput, 'contactId'>): Promise<boolean> {
  if (sub.contract_status !== 'a_signer') return false;
  const p = pricing(s, input.formula, input.baseMonthlyHt);
  await deps.db.run(
    `UPDATE subscriptions SET service_slug = ?, label = ?, monthly_ht = ?, start_date = ?, formula = ?, base_monthly_ht = ?, discount_percent = ?,
       commitment_months = ?, notice_months = ?, terms = ?, updated_at = ? WHERE id = ? AND contract_status = 'a_signer'`,
    [input.serviceSlug, input.label, p.monthly, input.startDate, input.formula, input.baseMonthlyHt, p.discount, p.commitment, p.notice,
      JSON.stringify(await termsFor(deps, input.serviceSlug, input.label, input.extra)), new Date().toISOString(), sub.id],
  );
  return true;
}

export async function sendContract(deps: Deps, s: Settings, sub: SubscriptionRow, contact: ContactRow, origin: string): Promise<{ ok: boolean; error?: string }> {
  if (!contact.email) return { ok: false, error: 'Ce contact n’a pas d’adresse e-mail.' };
  const link = siteLink(s, origin, `/client/contrat/${sub.token}`);
  const r = await deps.mailer.send({
    to: contact.email,
    subject: `${s.agencyName} — votre contrat ${sub.number} à signer`,
    kind: 'contrat',
    replyTo: s.contactEmail || undefined,
    text:
      `Bonjour ${contact.name},\n\nVoici votre contrat d’abonnement « ${sub.label} » (${formatEuros(sub.monthly_ht)} HT par mois) :\n${link}\n\n` +
      `Vous pouvez le lire, l’enregistrer en PDF et le signer en ligne. Ce lien vous permettra aussi, plus tard, de consulter ou de résilier votre abonnement.\n\n${s.agencyName}`,
  });
  if (!r.ok) return r;
  const now = new Date().toISOString();
  await deps.db.run('UPDATE subscriptions SET sent_at = ?, updated_at = ? WHERE id = ?', [now, now, sub.id]);
  await addContactEvent(deps, contact.id, 'email', `Contrat ${sub.number} envoyé pour signature.`);
  return { ok: true };
}

export async function signContract(deps: Deps, s: Settings, sub: SubscriptionRow, name: string, origin: string): Promise<boolean> {
  const now = new Date().toISOString();
  const r = await deps.db.run(
    "UPDATE subscriptions SET contract_status = 'signe', status = 'actif', signed_at = ?, signed_name = ?, updated_at = ? WHERE id = ? AND contract_status = 'a_signer'",
    [now, name, now, sub.id],
  );
  if (!r.changes) return false;
  await addContactEvent(deps, sub.contact_id, 'systeme', `Contrat ${sub.number} signé en ligne par ${name}.`, 'Client');
  if (s.notifyEmail) {
    await deps.mailer.send({ to: s.notifyEmail, subject: `Contrat signé : ${sub.number} — ${sub.label}`, kind: 'notification', text: `Signé par ${name}.\n\n${siteLink(s, origin, `/admin/abonnements/${sub.id}`)}` });
  }
  return true;
}

/** Résiliation (par le client en ligne ou enregistrée par l'agence) : date de fin calculée selon le préavis et l'engagement. */
export async function terminateContract(deps: Deps, s: Settings, sub: SubscriptionRow, by: string, origin: string, today = todayParis()): Promise<string | null> {
  if (sub.contract_status !== 'signe') return null;
  const end = terminationDate(today, sub.start_date, sub.commitment_months, sub.notice_months);
  const now = new Date().toISOString();
  const r = await deps.db.run(
    "UPDATE subscriptions SET contract_status = 'resiliation', end_date = ?, termination_requested_at = ?, termination_by = ?, updated_at = ? WHERE id = ? AND contract_status = 'signe'",
    [end, now, by, now, sub.id],
  );
  if (!r.changes) return null;
  await addContactEvent(deps, sub.contact_id, 'systeme', `Résiliation du contrat ${sub.number} demandée par ${by} : fin le ${formatDate(end)}.`, by);
  const contact = await deps.db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [sub.contact_id]);
  if (contact?.email) {
    await deps.mailer.send({
      to: contact.email,
      subject: `${s.agencyName} — confirmation de résiliation (${sub.number})`,
      kind: 'contrat',
      replyTo: s.contactEmail || undefined,
      text: `Bonjour ${contact.name},\n\nNous confirmons la résiliation de votre abonnement « ${sub.label} ». Il prendra fin le ${formatDate(end)} au soir ; les prestations et la facturation continuent jusqu’à cette date.\n\n${s.agencyName}`,
    });
  }
  if (s.notifyEmail) {
    await deps.mailer.send({ to: s.notifyEmail, subject: `Résiliation : ${sub.number} — ${sub.label}`, kind: 'notification', text: `Fin le ${formatDate(end)}.\n\n${siteLink(s, origin, `/admin/abonnements/${sub.id}`)}` });
  }
  return end;
}

/** Avis de fin d'engagement aux clients particuliers (art. L215-1 du Code de la consommation). */
export async function sendRenewalNotice(deps: Deps, s: Settings, sub: SubscriptionRow, contact: ContactRow, origin: string): Promise<{ ok: boolean; error?: string }> {
  const end = commitmentEnd(sub.start_date, sub.commitment_months);
  if (!end || !contact.email) return { ok: false, error: 'Pas d’engagement ou pas d’adresse e-mail.' };
  const link = siteLink(s, origin, `/client/contrat/${sub.token}`);
  const r = await deps.mailer.send({
    to: contact.email,
    subject: `${s.agencyName} — fin de votre période d’engagement le ${formatDate(end)}`,
    kind: 'contrat',
    replyTo: s.contactEmail || undefined,
    text:
      `Bonjour ${contact.name},\n\nVotre période d’engagement pour l’abonnement « ${sub.label} » (contrat ${sub.number}) se termine le ${formatDate(end)}.\n\n` +
      `Sans démarche de votre part, l’abonnement se poursuivra ensuite de mois en mois, aux mêmes conditions, et restera résiliable à tout moment avec un préavis de ${sub.notice_months} mois.\n` +
      `Si vous ne souhaitez pas le poursuivre, vous pouvez le résilier dès maintenant, en ligne : ${link}\n\n` +
      `Conformément à l’article L215-1 du Code de la consommation, vous pouvez mettre fin au contrat à tout moment à compter de la date de reconduction si cette information ne vous avait pas été adressée.\n\n${s.agencyName}`,
  });
  if (!r.ok) return r;
  const now = new Date().toISOString();
  await deps.db.run('UPDATE subscriptions SET renewal_notice_at = ?, updated_at = ? WHERE id = ?', [now, now, sub.id]);
  await addContactEvent(deps, contact.id, 'email', `Avis de fin d’engagement envoyé (contrat ${sub.number}).`);
  return { ok: true };
}

/** Les résiliations arrivées à échéance passent au statut « résilié / terminé ». */
export async function closeEndedContracts(deps: Deps, today = todayParis()): Promise<void> {
  await deps.db.run("UPDATE subscriptions SET contract_status = 'resilie', status = 'termine', updated_at = ? WHERE contract_status = 'resiliation' AND end_date < ?", [
    new Date().toISOString(),
    today,
  ]);
}
