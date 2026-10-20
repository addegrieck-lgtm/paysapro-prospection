import type { Deps } from '../app/context';
import type { Settings } from '../domain/settings';
import type { ContactRow, LineRow, QuoteRow, RequestRow, VariantFull } from '../repo/types';
import { randomToken } from '../lib/crypto';
import { nextNumber } from '../repo/settings';
import { addDays, todayParis } from '../domain/dates';
import { addContactEvent, siteLink } from './requests';
import { describeConfig, findExactVariant, parseOptions, type PrintConfig } from '../domain/print';
import { productBySlug, serviceBySlug, variantsOf } from '../repo/catalog';
import { computeTotals, formatEuros } from '../domain/money';

export type NewLine = Omit<LineRow, 'id' | 'position'> & { kind: string };

/** Lignes proposées à partir d'une demande : prix de VENTE + coûts internes (jamais visibles du client). */
export async function linesFromRequest(deps: Deps, s: Settings, r: RequestRow): Promise<NewLine[]> {
  const { db } = deps;
  const out: NewLine[] = [];
  const answers = JSON.parse(r.answers) as Record<string, unknown>;
  if (r.product_slug) {
    const product = await productBySlug(db, r.product_slug, false);
    const config = r.print_config ? (JSON.parse(r.print_config) as PrintConfig) : null;
    if (product) {
      const options = parseOptions(product.options);
      if (answers.want_design === '1' && product.design_service_slug) {
        const d = await serviceBySlug(db, product.design_service_slug, false);
        if (d) out.push(serviceLine(d, s));
      }
      const v = config ? findExactVariant(await variantsOf(db, product.id), config, options) : undefined;
      const desc = `Impression — ${product.name}${config ? `\n${describeConfig(config, options)}` : ''}`;
      out.push({ kind: 'print', description: desc, quantity: 1, unit_price_ht: v?.sale_print_ht ?? 0, vat_rate: s.vatRate, unit_cost_ht: v?.supplier_price_ht ?? 0 });
      out.push({ kind: 'shipping', description: 'Livraison', quantity: 1, unit_price_ht: v?.sale_shipping_ht ?? 0, vat_rate: s.vatRate, unit_cost_ht: v?.supplier_shipping_ht ?? 0 });
      if (v?.sale_other_ht || v?.supplier_other_fees_ht) {
        out.push({ kind: 'fees', description: 'Autres frais', quantity: 1, unit_price_ht: v.sale_other_ht ?? 0, vat_rate: s.vatRate, unit_cost_ht: v.supplier_other_fees_ht ?? 0 });
      }
    }
  } else if (r.service_slug) {
    const svc = await serviceBySlug(db, r.service_slug, false);
    if (svc) out.push(serviceLine(svc, s));
    const opts = Array.isArray(answers.service_options) ? (answers.service_options as string[]) : [];
    const svcOptions = svc ? (JSON.parse(svc.options) as { name: string; price_ht: number }[]) : [];
    for (const o of opts) {
      const [slug, name] = o.split('::');
      const found = slug === svc?.slug ? svcOptions.find((x) => x.name === name) : undefined;
      if (found) out.push({ kind: 'option', description: `Option : ${found.name}`, quantity: 1, unit_price_ht: found.price_ht, vat_rate: s.vatRate, unit_cost_ht: 0 });
    }
  }
  return out;
}

export function serviceLine(svc: { name: string; description: string; price_ht: number | null; cost_production: number; cost_supplier: number; cost_shipping: number; cost_external: number; work_hours: number }, s: Settings): NewLine {
  return {
    kind: 'service',
    description: `${svc.name}${svc.description ? `\n${svc.description}` : ''}`,
    quantity: 1,
    unit_price_ht: svc.price_ht ?? 0,
    vat_rate: s.vatRate,
    unit_cost_ht: svc.cost_production + svc.cost_supplier + svc.cost_shipping + svc.cost_external + Math.round(svc.work_hours * s.internalHourlyCost),
  };
}

export function variantLines(v: VariantFull, productName: string, s: Settings): NewLine[] {
  const config = `${[v.format, v.paper, v.weight, v.finish, v.printing, v.extra, v.delivery].filter(Boolean).join(' · ')} — ${v.quantity.toLocaleString('fr-FR')} ex.`;
  return [
    { kind: 'print', description: `Impression — ${productName}\n${config}`, quantity: 1, unit_price_ht: v.sale_print_ht ?? 0, vat_rate: s.vatRate, unit_cost_ht: v.supplier_price_ht ?? 0 },
    { kind: 'shipping', description: 'Livraison', quantity: 1, unit_price_ht: v.sale_shipping_ht ?? 0, vat_rate: s.vatRate, unit_cost_ht: v.supplier_shipping_ht ?? 0 },
  ];
}

export async function createQuote(deps: Deps, s: Settings, contactId: number, opts: { requestId?: number | null; title?: string; lines?: NewLine[] }): Promise<number> {
  const { db } = deps;
  const now = new Date().toISOString();
  const r = await db.run(
    `INSERT INTO quotes (contact_id, request_id, title, status, intro, terms, deposit_percent, token, created_at, updated_at) VALUES (?, ?, ?, 'brouillon', '', '', ?, ?, ?, ?)`,
    [contactId, opts.requestId ?? null, opts.title ?? '', s.depositPercent, randomToken(32), now, now],
  );
  await insertLines(deps, r.lastId, opts.lines ?? [], 0);
  if (opts.requestId) await db.run("UPDATE quote_requests SET status = 'en_cours' WHERE id = ? AND status = 'nouvelle'", [opts.requestId]);
  return r.lastId;
}

export async function insertLines(deps: Deps, quoteId: number, lines: NewLine[], startPos: number): Promise<void> {
  await deps.db.batch(
    lines.map((l, i) => ({
      sql: 'INSERT INTO quote_lines (quote_id, position, kind, description, quantity, unit_price_ht, vat_rate, unit_cost_ht) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      params: [quoteId, startPos + i + 1, l.kind, l.description, l.quantity, l.unit_price_ht, l.vat_rate, l.unit_cost_ht],
    })),
  );
}

export async function quoteLines(deps: Deps, quoteId: number): Promise<LineRow[]> {
  return deps.db.all<LineRow>('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY position, id', [quoteId]);
}

/** Commande d'impression liée à la demande d'origine d'un devis (s'il y en a une). */
async function linkedOrder(deps: Deps, q: QuoteRow): Promise<{ id: number; status: string } | undefined> {
  const byQuote = await deps.db.get<{ id: number; status: string }>('SELECT id, status FROM print_orders WHERE quote_id = ?', [q.id]);
  if (byQuote) return byQuote;
  if (!q.request_id) return undefined;
  return deps.db.get<{ id: number; status: string }>("SELECT id, status FROM print_orders WHERE json_extract(config, '$.request_id') = ?", [q.request_id]);
}

async function moveOrder(deps: Deps, q: QuoteRow, to: string, note: string, onlyFrom: string[]) {
  const o = await linkedOrder(deps, q);
  if (!o || !onlyFrom.includes(o.status)) return;
  const now = new Date().toISOString();
  await deps.db.batch([
    { sql: 'UPDATE print_orders SET status = ?, quote_id = ?, updated_at = ? WHERE id = ?', params: [to, q.id, now, o.id] },
    { sql: 'INSERT INTO order_events (order_id, from_status, to_status, note, author, created_at) VALUES (?, ?, ?, ?, ?, ?)', params: [o.id, o.status, to, note, 'Système', now] },
  ]);
}

/**
 * Finalise un devis : numéro définitif, dates, statut « envoyé ». Envoie l'e-mail si demandé.
 * Retourne l'état de l'envoi pour l'afficher honnêtement.
 */
export async function sendQuote(deps: Deps, s: Settings, quoteId: number, origin: string, viaEmail: boolean, author: string): Promise<{ ok: boolean; error?: string; mailed: boolean }> {
  const { db } = deps;
  const q = await db.get<QuoteRow>('SELECT * FROM quotes WHERE id = ?', [quoteId]);
  if (!q || q.status !== 'brouillon') return { ok: false, error: 'Seul un brouillon peut être envoyé.', mailed: false };
  const lines = await quoteLines(deps, quoteId);
  if (!lines.length) return { ok: false, error: 'Le devis ne contient aucune ligne.', mailed: false };
  if (lines.some((l) => l.unit_price_ht <= 0 && l.kind !== 'shipping')) return { ok: false, error: 'Une ligne a un prix nul : complétez-la ou supprimez-la avant l’envoi.', mailed: false };
  const contact = await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [q.contact_id]);
  if (!contact) return { ok: false, error: 'Contact introuvable.', mailed: false };
  if (viaEmail && !contact.email) return { ok: false, error: 'Le contact n’a pas d’adresse e-mail.', mailed: false };

  const today = todayParis();
  const number = q.number ?? (await nextNumber(db, 'D', Number(today.slice(0, 4))));
  const validUntil = addDays(today, s.quoteValidityDays);
  const t = computeTotals(lines, s.vatMode);
  let mailed = false;
  if (viaEmail) {
    const link = siteLink(s, origin, `/client/devis/${q.token}`);
    const res = await deps.mailer.send({
      to: contact.email,
      subject: `${s.agencyName} — votre devis ${number}`,
      kind: 'devis',
      replyTo: s.contactEmail || undefined,
      text: `Bonjour ${contact.name},

Veuillez trouver votre devis ${number}${q.title ? ` (${q.title})` : ''} : ${formatEuros(t.ht)} HT${s.vatMode === 'normal' ? `, soit ${formatEuros(t.ttc)} TTC` : ''}.
Il est valable jusqu’au ${new Date(`${validUntil}T12:00:00Z`).toLocaleDateString('fr-FR')}.

Consulter et accepter le devis en ligne :
${link}

Ce lien est personnel : merci de ne pas le transférer.

${s.agencyName}`,
    });
    if (!res.ok) return { ok: false, error: `L’e-mail n’a pas pu être envoyé (${res.error}). Le devis reste en brouillon.`, mailed: false };
    mailed = true;
  }
  const now = new Date().toISOString();
  await db.run("UPDATE quotes SET number = ?, status = 'envoye', issue_date = ?, valid_until = ?, sent_at = ?, updated_at = ? WHERE id = ?", [number, today, validUntil, now, now, quoteId]);
  await db.run("UPDATE contacts SET status = CASE WHEN status IN ('gagne') THEN status ELSE 'devis_envoye' END, last_contact_at = ?, updated_at = ? WHERE id = ?", [now, now, contact.id]);
  await addContactEvent(deps, contact.id, 'systeme', `Devis ${number} ${mailed ? 'envoyé par e-mail' : 'marqué comme transmis'} (${formatEuros(t.ht)} HT).`, author);
  await moveOrder(deps, { ...q, number }, 'devis_envoye', `Devis ${number} envoyé`, ['demande_recue', 'configuration_a_confirmer', 'prix_a_verifier', 'devis_en_preparation']);
  return { ok: true, mailed };
}

/** Acceptation (par le client en ligne, ou enregistrée par l'agence avec une preuve écrite). */
export async function decideQuote(deps: Deps, s: Settings, quoteId: number, decision: 'accepte' | 'refuse', name: string, comment: string, author: string): Promise<{ ok: boolean; error?: string }> {
  const { db } = deps;
  const q = await db.get<QuoteRow>('SELECT * FROM quotes WHERE id = ?', [quoteId]);
  if (!q || q.status !== 'envoye') return { ok: false, error: 'Ce devis n’est plus en attente de réponse.' };
  if (decision === 'accepte' && q.valid_until && q.valid_until < todayParis()) {
    await db.run("UPDATE quotes SET status = 'expire', updated_at = ? WHERE id = ?", [new Date().toISOString(), quoteId]);
    return { ok: false, error: 'Ce devis a expiré. Contactez-nous pour en obtenir une version à jour.' };
  }
  const now = new Date().toISOString();
  await db.run('UPDATE quotes SET status = ?, decided_at = ?, decided_name = ?, client_comment = ?, updated_at = ? WHERE id = ?', [decision, now, name.slice(0, 120), comment.slice(0, 2000), now, quoteId]);
  await addContactEvent(deps, q.contact_id, 'systeme', `Devis ${q.number} ${decision === 'accepte' ? 'ACCEPTÉ' : 'refusé'} par ${name}${comment ? ` — « ${comment.slice(0, 500)} »` : ''}.`, author);
  if (decision === 'accepte') {
    await db.run("UPDATE contacts SET status = 'gagne', updated_at = ? WHERE id = ?", [now, q.contact_id]);
    await moveOrder(deps, q, 'devis_accepte', `Devis ${q.number} accepté par ${name}`, ['devis_envoye', 'devis_en_preparation', 'prix_a_verifier', 'configuration_a_confirmer', 'demande_recue']);
  }
  if (s.notifyEmail) {
    await deps.mailer.send({ to: s.notifyEmail, subject: `Devis ${q.number} ${decision === 'accepte' ? 'accepté' : 'refusé'}`, kind: 'notification', text: `${name} a ${decision === 'accepte' ? 'accepté' : 'refusé'} le devis ${q.number}.${comment ? `\nCommentaire : ${comment}` : ''}` });
  }
  return { ok: true };
}

/** Nouvelle version d'un devis déjà envoyé : copie en brouillon, l'ancien est annulé. */
export async function duplicateQuote(deps: Deps, s: Settings, quoteId: number): Promise<number | null> {
  const { db } = deps;
  const q = await db.get<QuoteRow>('SELECT * FROM quotes WHERE id = ?', [quoteId]);
  if (!q) return null;
  const lines = await quoteLines(deps, quoteId);
  const id = await createQuote(deps, s, q.contact_id, { requestId: q.request_id, title: q.title, lines: lines.map((l) => ({ ...l, kind: l.kind ?? 'service' })) });
  await db.run('UPDATE quotes SET intro = ?, terms = ?, deposit_percent = ? WHERE id = ?', [q.intro, q.terms, q.deposit_percent, id]);
  if (q.status === 'envoye') await db.run("UPDATE quotes SET status = 'annule', updated_at = ? WHERE id = ?", [new Date().toISOString(), quoteId]);
  return id;
}
