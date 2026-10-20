import { z } from 'zod';
import type { Deps } from '../app/context';
import type { Settings } from '../domain/settings';
import type { PrintConfig, PublicEstimate } from '../domain/print';
import { describeConfig, parseOptions } from '../domain/print';
import { ALLOWED_UPLOADS, UPLOAD_LIMITS, safeFileName, sniffType } from '../lib/storage';
import { randomToken } from '../lib/crypto';
import { nextNumber } from '../repo/settings';
import { productBySlug, serviceBySlug } from '../repo/catalog';
import { estimateFor } from './estimate';
import { PROJECT_TYPES } from '../web/public/quote';
import { formatEuros } from '../domain/money';

/** Lien absolu : adresse du site configurée, sinon origine de la requête. */
export function siteLink(s: Settings, origin: string, path: string): string {
  return (s.siteUrl ? s.siteUrl.replace(/\/+$/, '') : origin) + path;
}

const str = (max: number) => z.string().trim().max(max).optional().default('');

export const quoteSchema = z.object({
  type: z.enum(PROJECT_TYPES.map((t) => t[0]) as [string, ...string[]], { message: 'Choisissez une prestation.' }),
  service: str(80),
  activity: z.string().trim().min(2, 'Indiquez votre activité.').max(200),
  description: z.string().trim().min(10, 'Décrivez votre projet en quelques mots (10 caractères minimum).').max(5000),
  pages: z.array(z.string().max(60)).max(20).optional().default([]),
  has_site: str(10),
  site_url: str(300),
  goal: str(100),
  has_domain: str(20),
  texts: str(10),
  photos: str(10),
  budget: str(60),
  deadline: str(60),
  product: str(80),
  want_design: str(2),
  service_options: z.array(z.string().max(200)).max(30).optional().default([]),
  options_notes: str(2000),
  customer_type: z.enum(['pro', 'particulier']).default('pro'),
  name: z.string().trim().min(2, 'Indiquez votre nom.').max(120),
  company: str(160),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(200),
  phone: z.string().trim().max(40).regex(/^[0-9+().\s-]*$/, 'Numéro de téléphone invalide.').optional().default(''),
  postal_code: str(10),
  city: str(120),
  contact_pref: str(20),
  privacy: z.literal('1', { message: 'Vous devez accepter la politique de confidentialité.' }),
  marketing: str(2),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

export interface UploadedFile {
  name: string;
  bytes: Uint8Array;
}

export interface StoredFileRef {
  key: string;
  name: string;
  type: string;
  size: number;
}

/** Contrôle des pièces jointes : nombre, taille, et type RÉEL (signature du fichier). */
export function checkUploads(files: UploadedFile[]): { ok: true; files: (UploadedFile & { type: keyof typeof ALLOWED_UPLOADS })[] } | { ok: false; error: string } {
  const real = files.filter((f) => f.bytes.length > 0);
  if (real.length > UPLOAD_LIMITS.maxFiles) return { ok: false, error: `${UPLOAD_LIMITS.maxFiles} fichiers maximum.` };
  let total = 0;
  const out: (UploadedFile & { type: keyof typeof ALLOWED_UPLOADS })[] = [];
  for (const f of real) {
    if (f.bytes.length > UPLOAD_LIMITS.maxFileBytes) return { ok: false, error: `« ${f.name.slice(0, 60)} » dépasse ${UPLOAD_LIMITS.maxFileBytes / 1024 / 1024} Mo.` };
    total += f.bytes.length;
    const type = sniffType(f.bytes);
    if (!type) return { ok: false, error: `« ${f.name.slice(0, 60)} » : format non accepté (PDF, PNG, JPG ou WebP uniquement).` };
    out.push({ ...f, type });
  }
  if (total > UPLOAD_LIMITS.maxTotalBytes) return { ok: false, error: 'Taille totale des fichiers trop importante.' };
  return { ok: true, files: out };
}

/** Retrouve un contact par e-mail ou le crée. Ne remplace jamais des informations existantes par du vide. */
export async function upsertContact(
  deps: Deps,
  c: { name: string; company: string; email: string; phone: string; postal_code: string; city: string; customer_type: string; need: string; budget: string; source: string; marketing: boolean },
): Promise<{ id: number; created: boolean }> {
  const { db } = deps;
  const now = new Date().toISOString();
  const existing = await db.get<{ id: number }>('SELECT id FROM contacts WHERE lower(email) = ? ORDER BY id LIMIT 1', [c.email.toLowerCase()]);
  if (existing) {
    await db.run(
      `UPDATE contacts SET
        phone = CASE WHEN ? <> '' THEN ? ELSE phone END,
        company = CASE WHEN company = '' THEN ? ELSE company END,
        postal_code = CASE WHEN postal_code = '' THEN ? ELSE postal_code END,
        city = CASE WHEN city = '' THEN ? ELSE city END,
        need = ?, budget = CASE WHEN ? <> '' THEN ? ELSE budget END,
        status = CASE WHEN status IN ('perdu', 'gagne') THEN 'a_contacter' ELSE status END,
        consent_marketing = CASE WHEN ? = 1 THEN 1 ELSE consent_marketing END,
        consent_at = CASE WHEN ? = 1 THEN ? ELSE consent_at END,
        updated_at = ?
       WHERE id = ?`,
      [c.phone, c.phone, c.company, c.postal_code, c.city, c.need, c.budget, c.budget, c.marketing ? 1 : 0, c.marketing ? 1 : 0, now, now, existing.id],
    );
    return { id: existing.id, created: false };
  }
  const r = await db.run(
    `INSERT INTO contacts (name, company, email, phone, postal_code, city, customer_type, source, need, budget, status, consent_marketing, consent_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nouveau', ?, ?, ?, ?)`,
    [c.name, c.company, c.email, c.phone, c.postal_code, c.city, c.customer_type, c.source, c.need, c.budget, c.marketing ? 1 : 0, c.marketing ? now : null, now, now],
  );
  return { id: r.lastId, created: true };
}

export async function addContactEvent(deps: Deps, contactId: number, kind: string, body: string, author = 'Système'): Promise<void> {
  await deps.db.run('INSERT INTO contact_events (contact_id, kind, body, author, created_at) VALUES (?, ?, ?, ?, ?)', [contactId, kind, body, author, new Date().toISOString()]);
}

export async function storeFiles(deps: Deps, files: (UploadedFile & { type: keyof typeof ALLOWED_UPLOADS })[], ownerKind: string, ownerId: number | null): Promise<StoredFileRef[]> {
  const out: StoredFileRef[] = [];
  for (const f of files) {
    const key = randomToken(18);
    const name = safeFileName(f.name, f.type);
    await deps.storage.put(key, f.bytes, f.type);
    await deps.db.run('INSERT INTO files (key, name, type, size, owner_kind, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      key,
      name,
      f.type,
      f.bytes.length,
      ownerKind,
      ownerId,
      new Date().toISOString(),
    ]);
    out.push({ key, name, type: f.type, size: f.bytes.length });
  }
  return out;
}

export interface QuoteResult {
  requestId: number;
  contactId: number;
  orderNumber: string | null;
  estimate: PublicEstimate | null;
}

/** Traitement complet d'une demande de devis validée. */
export async function submitQuoteRequest(deps: Deps, s: Settings, input: QuoteInput, rawPrint: Record<string, unknown>, files: (UploadedFile & { type: keyof typeof ALLOWED_UPLOADS })[], origin: string): Promise<QuoteResult> {
  const { db } = deps;
  const typeLabel = PROJECT_TYPES.find((t) => t[0] === input.type)?.[1] ?? input.type;
  const service = input.service ? await serviceBySlug(db, input.service) : undefined;

  // Impression : configuration et estimation recalculées côté serveur (jamais celles du navigateur).
  let config: PrintConfig | null = null;
  let estimate: PublicEstimate | null = null;
  let configIssue: string | null = null;
  const product = input.type === 'impression' && input.product ? await productBySlug(db, input.product) : undefined;
  if (product && parseOptions(product.options).quantity.length) {
    const r = await estimateFor(db, s, product, rawPrint, input.want_design === '1');
    if (r.ok) {
      config = r.config;
      estimate = r.estimate;
    } else configIssue = r.errors.join(' ');
  }

  const contact = await upsertContact(deps, {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    postal_code: input.postal_code,
    city: input.city,
    customer_type: input.customer_type,
    need: `${typeLabel}${service ? ` — ${service.name}` : ''}${product ? ` — ${product.name}` : ''}`,
    budget: input.budget,
    source: 'site_devis',
    marketing: input.marketing === '1',
  });

  const answers = { ...input, service_name: service?.name ?? '', product_name: product?.name ?? '', config_issue: configIssue };
  const now = new Date().toISOString();
  const req = await db.run(
    `INSERT INTO quote_requests (contact_id, kind, service_slug, product_slug, answers, print_config, estimate, files, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'nouvelle', ?)`,
    [contact.id, input.type, input.service, product?.slug ?? '', JSON.stringify(answers), config ? JSON.stringify(config) : null, estimate ? JSON.stringify(estimate) : null, now],
  );
  const stored = await storeFiles(deps, files, 'request', req.lastId);
  if (stored.length) await db.run('UPDATE quote_requests SET files = ? WHERE id = ?', [JSON.stringify(stored), req.lastId]);

  // Commande d'impression créée au statut correspondant à la réalité de la demande.
  let orderNumber: string | null = null;
  if (product) {
    const status = !product.options_checked_at || configIssue || !config ? 'configuration_a_confirmer' : estimate?.status === 'priced' ? 'demande_recue' : 'prix_a_verifier';
    orderNumber = await nextNumber(db, 'CMD', new Date().getFullYear());
    const desc = config ? `${product.name} — ${describeConfig(config, parseOptions(product.options))}` : `${product.name} — configuration à préciser`;
    const o = await db.run(
      `INSERT INTO print_orders (number, contact_id, product_id, description, config, status, bat_required, supplier, sale_total_ht, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      [orderNumber, contact.id, product.id, desc, JSON.stringify({ ...config, want_design: input.want_design === '1', request_id: req.lastId }), status, product.supplier, estimate?.totalHt ?? null, '', now, now],
    );
    await db.run('INSERT INTO order_events (order_id, from_status, to_status, note, author, created_at) VALUES (?, NULL, ?, ?, ?, ?)', [
      o.lastId,
      status,
      `Créée depuis la demande de devis n° ${req.lastId}`,
      'Système',
      now,
    ]);
  }

  await addContactEvent(deps, contact.id, 'systeme', `Demande de devis reçue (${typeLabel}) — n° ${req.lastId}${orderNumber ? `, commande ${orderNumber}` : ''}.`);

  // E-mails transactionnels : accusé de réception au prospect + notification interne.
  const est =
    estimate && estimate.totalHt != null
      ? `\nEstimation indicative : ${formatEuros(estimate.totalHt)} HT (${estimate.vatMode === 'franchise' ? 'TVA non applicable' : `${formatEuros(estimate.totalTtc!)} TTC`}). Le devis définitif vous sera transmis après vérification.\n`
      : '';
  await deps.mailer.send({
    to: input.email,
    subject: `${s.agencyName} — nous avons bien reçu votre demande de devis`,
    kind: 'confirmation',
    replyTo: s.contactEmail || undefined,
    text: `Bonjour ${input.name},

Merci pour votre demande (${typeLabel}). Nous l’étudions et revenons vers vous sous 48 h ouvrées.
${est}
Récapitulatif :
- Activité : ${input.activity}
- Projet : ${input.description.slice(0, 500)}${input.description.length > 500 ? '…' : ''}
${product ? `- Produit : ${product.name}${config ? ` (${describeConfig(config, parseOptions(product.options))})` : ''}\n` : ''}
Cet e-mail est un accusé de réception automatique : il ne constitue ni un devis ni une commande.

${s.agencyName}${s.contactPhone ? `\n${s.contactPhone}` : ''}`,
  });
  if (s.notifyEmail) {
    await deps.mailer.send({
      to: s.notifyEmail,
      subject: `Nouvelle demande de devis : ${typeLabel} — ${input.name}${input.company ? ` (${input.company})` : ''}`,
      kind: 'notification',
      text: `Nouvelle demande n° ${req.lastId}.\n\nVoir dans l’administration : ${siteLink(s, origin, `/admin/demandes/${req.lastId}`)}\n`,
    });
  }
  return { requestId: req.lastId, contactId: contact.id, orderNumber, estimate };
}

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom.').max(120),
  company: str(160),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(200),
  phone: z.string().trim().max(40).regex(/^[0-9+().\s-]*$/, 'Numéro de téléphone invalide.').optional().default(''),
  message: z.string().trim().min(10, 'Votre message est trop court.').max(5000),
  privacy: z.literal('1', { message: 'Vous devez accepter la politique de confidentialité.' }),
});

export async function submitContact(deps: Deps, s: Settings, input: z.infer<typeof contactSchema>, origin: string): Promise<number> {
  const contact = await upsertContact(deps, {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    postal_code: '',
    city: '',
    customer_type: 'pro',
    need: input.message.slice(0, 200),
    budget: '',
    source: 'site_contact',
    marketing: false,
  });
  await addContactEvent(deps, contact.id, 'email', `Message reçu via le formulaire de contact :\n${input.message}`);
  await deps.mailer.send({
    to: input.email,
    subject: `${s.agencyName} — message bien reçu`,
    kind: 'confirmation',
    replyTo: s.contactEmail || undefined,
    text: `Bonjour ${input.name},\n\nNous avons bien reçu votre message et vous répondons sous 48 h ouvrées.\n\n${s.agencyName}`,
  });
  if (s.notifyEmail) {
    await deps.mailer.send({
      to: s.notifyEmail,
      subject: `Nouveau message : ${input.name}${input.company ? ` (${input.company})` : ''}`,
      kind: 'notification',
      text: `${input.message}\n\nFiche contact : ${siteLink(s, origin, `/admin/crm/${contact.id}`)}`,
    });
  }
  return contact.id;
}
