import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../../app/context';
import { PAGE_SIZE, idParam, page, pageNum, readForm } from './helpers';
import { ActionButton, Badge, Csrf, Empty, F, Pager, Sel, TA, eur } from '../../web/admin/ui';
import { INVOICE_STATUSES, isOneOf } from '../../domain/statuses';
import type { ContactRow, InvoiceRow, LineRow, QuoteRow } from '../../repo/types';
import { computeTotals } from '../../domain/money';
import { addDays, formatShortDate, isIsoDate, todayParis } from '../../domain/dates';
import { missingLegalInfo } from '../../domain/settings';
import { InvoiceDocument, OPERATION_CATEGORIES } from '../../web/documents';
import { audit } from '../../repo/settings';
import { addContactEvent } from '../../services/requests';

export const invoiceRoutes = new Hono<AppEnv>();

const EINVOICE_NOTE = (
  <div class="alert alert-warning">
    <strong>Réforme de la facturation électronique.</strong> Depuis le 1er septembre 2026, toutes les entreprises doivent pouvoir <em>recevoir</em> des factures
    électroniques via une plateforme agréée ; l’<em>émission</em> au format électronique sera obligatoire pour les TPE/PME au 1er septembre 2027 (factures entre
    entreprises assujetties), avec e-reporting pour les ventes aux particuliers. Ce module produit des factures imprimables (PDF) : avant la date applicable à
    votre entreprise, raccordez-vous à une plateforme agréée et vérifiez les mentions obligatoires avec votre expert-comptable.
  </div>
);

function snapshotCustomer(c: ContactRow) {
  return JSON.stringify({ name: c.name, company: c.company, address: c.address, postal_code: c.postal_code, city: c.city, siren: c.siren, email: c.email, customer_type: c.customer_type });
}

async function createInvoice(c: Ctx, contactId: number, lines: Omit<LineRow, 'id'>[], opts: { quoteId?: number | null; type?: 'facture' | 'avoir'; originalId?: number | null; notes?: string }) {
  const { db } = c.get('deps');
  const ct = (await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [contactId]))!;
  const now = new Date().toISOString();
  const r = await db.run(
    `INSERT INTO invoices (type, original_invoice_id, contact_id, quote_id, status, customer, notes, created_at, updated_at) VALUES (?, ?, ?, ?, 'brouillon', ?, ?, ?, ?)`,
    [opts.type ?? 'facture', opts.originalId ?? null, contactId, opts.quoteId ?? null, snapshotCustomer(ct), opts.notes ?? '', now, now],
  );
  await db.batch(
    lines.map((l, i) => ({
      sql: 'INSERT INTO invoice_lines (invoice_id, position, description, quantity, unit_price_ht, vat_rate, unit_cost_ht) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [r.lastId, i + 1, l.description, l.quantity, l.unit_price_ht, l.vat_rate, l.unit_cost_ht],
    })),
  );
  return r.lastId;
}

invoiceRoutes.get('/factures', async (c) => {
  const { db } = c.get('deps');
  const status = c.req.query('statut') ?? '';
  const p = pageNum(c);
  const ok = isOneOf(INVOICE_STATUSES, status);
  const rows = await db.all<InvoiceRow & { name: string }>(
    `SELECT i.*, ct.name FROM invoices i JOIN contacts ct ON ct.id = i.contact_id ${ok ? 'WHERE i.status = ?' : ''} ORDER BY COALESCE(i.issue_date, i.created_at) DESC, i.id DESC LIMIT ? OFFSET ?`,
    [...(ok ? [status] : []), PAGE_SIZE + 1, (p - 1) * PAGE_SIZE],
  );
  const today = todayParis();
  return page(
    c,
    'Factures',
    <>
      {EINVOICE_NOTE}
      <form class="filters" method="get">
        <Sel label="Statut" name="statut" value={status} options={INVOICE_STATUSES} empty="Toutes" />
        <button class="btn btn-outline">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <Empty>Aucune facture. Créez-la depuis un devis accepté ou une fiche contact.</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Client</th>
                <th>Émise le</th>
                <th>Échéance</th>
                <th class="num">Total HT</th>
                <th class="num">Total TTC</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE_SIZE).map((i) => (
                <tr class={i.status === 'emise' && i.due_date && i.due_date < today ? 'row-warn' : ''}>
                  <td>
                    <a href={`/admin/factures/${i.id}`}>{i.number ?? `Brouillon n° ${i.id}`}</a> {i.type === 'avoir' && <span class="tag">avoir</span>}
                  </td>
                  <td>{i.name}</td>
                  <td>{formatShortDate(i.issue_date)}</td>
                  <td>{i.type === 'facture' ? formatShortDate(i.due_date) : '—'}</td>
                  <td class="num">{eur(i.type === 'avoir' ? -i.total_ht : i.total_ht)}</td>
                  <td class="num">{eur(i.type === 'avoir' ? -i.total_ttc : i.total_ttc)}</td>
                  <td>
                    <Badge options={INVOICE_STATUSES} value={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={p} hasMore={rows.length > PAGE_SIZE} base={`/admin/factures${status ? `?statut=${status}` : ''}`} />
    </>,
    { actions: <a class="btn btn-primary" href="/admin/factures/nouvelle">Nouvelle facture</a> },
  );
});

invoiceRoutes.get('/factures/nouvelle', async (c) => {
  const contacts = await c.get('deps').db.all<ContactRow>('SELECT id, name, company FROM contacts ORDER BY name LIMIT 500');
  return page(
    c,
    'Nouvelle facture',
    <form method="post" action="/admin/factures/nouvelle" class="panel">
      <Csrf token={c.get('csrf')} />
      <div class="form-grid">
        <Sel label="Client" name="contact_id" required value={c.req.query('contact') ?? ''} options={contacts.map((x) => [String(x.id), `${x.name}${x.company ? ` — ${x.company}` : ''}`] as const)} empty="Choisir…" />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Créer le brouillon</button>
      </div>
    </form>,
  );
});

invoiceRoutes.post('/factures/nouvelle', async (c) => {
  const f = await readForm(c);
  const ct = await c.get('deps').db.get<{ id: number }>('SELECT id FROM contacts WHERE id = ?', [f.int('contact_id') ?? 0]);
  if (!ct) return c.redirect('/admin/factures/nouvelle', 303);
  const id = await createInvoice(c, ct.id, [], {});
  return c.redirect(`/admin/factures/${id}?ok=created`, 303);
});

invoiceRoutes.post('/factures/depuis-devis/:id', async (c) => {
  const { db } = c.get('deps');
  const q = await db.get<QuoteRow>("SELECT * FROM quotes WHERE id = ? AND status = 'accepte'", [idParam(c)]);
  if (!q) return c.notFound();
  const lines = await db.all<LineRow>('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY position', [q.id]);
  const id = await createInvoice(c, q.contact_id, lines, { quoteId: q.id, notes: `Selon devis ${q.number} accepté.` });
  return c.redirect(`/admin/factures/${id}?ok=created`, 303);
});

async function load(c: Ctx) {
  const { db } = c.get('deps');
  const inv = await db.get<InvoiceRow>('SELECT * FROM invoices WHERE id = ?', [idParam(c)]);
  if (!inv) return null;
  const lines = await db.all<LineRow>('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY position, id', [inv.id]);
  const original = inv.original_invoice_id ? await db.get<InvoiceRow>('SELECT * FROM invoices WHERE id = ?', [inv.original_invoice_id]) : undefined;
  return { inv, lines, original };
}

invoiceRoutes.get('/factures/:id', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  const { inv, lines, original } = data;
  const s = c.get('settings');
  const csrf = c.get('csrf');
  const draft = inv.status === 'brouillon';
  const missing = missingLegalInfo(s);
  const ct = await c.get('deps').db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [inv.contact_id]);
  const warnings: string[] = [];
  if (ct?.customer_type === 'pro' && !ct.siren) warnings.push('Client professionnel sans SIREN/SIRET : complétez sa fiche (mention requise sur les factures entre entreprises).');
  if (ct && (!ct.address || !ct.city)) warnings.push('Adresse du client incomplète.');
  const label = inv.type === 'avoir' ? 'Avoir' : 'Facture';
  return page(
    c,
    inv.number ? `${label} ${inv.number}` : `${label} — brouillon n° ${inv.id}`,
    <>
      {draft && missing.length > 0 && (
        <div class="alert alert-error">
          Émission impossible : informations légales manquantes ({missing.join(', ')}). <a href="/admin/parametres#legal">Compléter les paramètres</a>.
        </div>
      )}
      {draft && warnings.map((w) => <div class="alert alert-warning">{w}</div>)}
      <div class="cols cols-3">
        <div>
          {draft && (
            <form method="post" action={`/admin/factures/${inv.id}`} class="panel">
              <Csrf token={csrf} />
              <div class="form-grid">
                <F label="Date de la prestation / livraison" name="service_date" type="date" value={inv.service_date ?? ''} />
                <Sel label="Nature de l’opération" name="operation_category" value={inv.operation_category} options={OPERATION_CATEGORIES} />
                <TA label="Mentions complémentaires" name="notes" value={inv.notes} rows={2} max={3000} />
              </div>
              <h2 style="margin-top:1rem">Lignes</h2>
              <div class="table-wrap">
                <table class="data lines-table">
                  <thead>
                    <tr>
                      <th>Désignation</th>
                      <th>Qté</th>
                      <th>PU HT (€)</th>
                      <th>TVA %</th>
                      <th>Coût unit. HT (€, interne)</th>
                      <th>Suppr.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...lines, null, null].map((l, i) => (
                      <tr>
                        <td style="min-width:260px">
                          <input type="hidden" name="line_id" value={l ? String(l.id) : ''} />
                          <textarea name="line_description" rows={2} maxlength={2000}>
                            {l?.description ?? ''}
                          </textarea>
                        </td>
                        <td style="width:80px">
                          <input name="line_quantity" value={l ? String(l.quantity).replace('.', ',') : ''} />
                        </td>
                        <td style="width:120px">
                          <input name="line_price" value={l ? (l.unit_price_ht / 100).toFixed(2).replace('.', ',') : ''} />
                        </td>
                        <td style="width:80px">
                          <input name="line_vat" value={String(l?.vat_rate ?? s.vatRate).replace('.', ',')} />
                        </td>
                        <td style="width:120px">
                          <input name="line_cost" value={l ? (l.unit_cost_ht / 100).toFixed(2).replace('.', ',') : ''} />
                        </td>
                        <td>
                          <input type="checkbox" name="line_delete" value={String(i)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div class="form-actions">
                <button class="btn btn-primary">Enregistrer le brouillon</button>
              </div>
            </form>
          )}
          <div class="panel">
            <div class="panel-head">
              <h2>Document</h2>
              <a class="btn btn-outline btn-sm" href={`/admin/factures/${inv.id}/document`} target="_blank">Version imprimable / PDF</a>
            </div>
            <InvoiceDocument s={s} invoice={{ ...inv, ...(draft ? { customer: ct ? snapshotCustomer(ct) : inv.customer } : {}) }} lines={lines} original={original} />
          </div>
        </div>
        <div>
          <div class="panel">
            <h2>Statut</h2>
            <p>
              <Badge options={INVOICE_STATUSES} value={inv.status} />
            </p>
            <dl class="kv">
              <dt>Client</dt>
              <dd>{ct ? <a href={`/admin/crm/${ct.id}`}>{ct.name}</a> : '—'}</dd>
              <dt>Coûts directs (interne)</dt>
              <dd>{eur(draft ? lines.reduce((sum, l) => sum + Math.round(l.quantity * l.unit_cost_ht), 0) : inv.cost_ht)}</dd>
            </dl>
            {draft && (
              <div class="form-actions">
                <ActionButton
                  action={`/admin/factures/${inv.id}/emettre`}
                  csrf={csrf}
                  label={`Émettre ${inv.type === 'avoir' ? 'l’avoir' : 'la facture'}`}
                  cls="btn-primary"
                  confirm="Une fois émise, la facture reçoit un numéro définitif et ne peut plus être modifiée ni supprimée (correction par avoir uniquement). Continuer ?"
                />
                <ActionButton action={`/admin/factures/${inv.id}/supprimer`} csrf={csrf} label="Supprimer le brouillon" cls="btn-danger" confirm="Supprimer ce brouillon ?" />
              </div>
            )}
            {inv.status === 'emise' && inv.type === 'facture' && (
              <form method="post" action={`/admin/factures/${inv.id}/payee`} class="form-grid" style="margin-top:1rem">
                <Csrf token={csrf} />
                <F label="Date du paiement" name="paid_at" type="date" value={todayParis()} required />
                <F label="Moyen de paiement" name="payment_method" value="Virement" max={60} />
                <div class="form-actions">
                  <button class="btn btn-primary btn-sm">Marquer comme payée</button>
                </div>
              </form>
            )}
            {inv.status !== 'brouillon' && inv.type === 'facture' && (
              <div class="form-actions">
                <ActionButton action={`/admin/factures/${inv.id}/avoir`} csrf={csrf} label="Créer un avoir" confirm="Créer un avoir (brouillon) reprenant les lignes de cette facture ?" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    { wide: true },
  );
});

const num = (v: string) => {
  const s = v.replace(/\s/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};

invoiceRoutes.post('/factures/:id', async (c) => {
  const data = await load(c);
  if (!data || data.inv.status !== 'brouillon') return c.notFound();
  const f = await readForm(c);
  const ids = f.all('line_id');
  const descs = f.all('line_description');
  const qtys = f.all('line_quantity');
  const prices = f.all('line_price');
  const vats = f.all('line_vat');
  const costs = f.all('line_cost');
  const del = new Set(f.all('line_delete').map(Number));
  const lines: Omit<LineRow, 'id'>[] = [];
  let invalid = false;
  ids.forEach((_, i) => {
    if (del.has(i)) return;
    const desc = (descs[i] ?? '').trim();
    if (!desc && !(prices[i] ?? '').trim()) return;
    const qty = num(qtys[i] || '1');
    const price = num(prices[i] ?? '');
    const vat = num(vats[i] ?? '');
    const cost = num(costs[i] || '0');
    if (!desc || qty == null || qty <= 0 || price == null || price < 0 || vat == null || vat < 0 || vat > 30 || cost == null || cost < 0) {
      invalid = true;
      return;
    }
    lines.push({ position: lines.length + 1, description: desc.slice(0, 2000), quantity: qty, unit_price_ht: Math.round(price * 100), vat_rate: vat, unit_cost_ht: Math.round(cost * 100) });
  });
  if (invalid) return page(c, 'Lignes invalides', <div class="panel"><p>Une ligne est incomplète ou invalide : rien n’a été enregistré.</p><a class="btn btn-outline" href={`/admin/factures/${data.inv.id}`}>Retour</a></div>, { status: 422 });
  const sd = f.get('service_date');
  const cat = isOneOf(OPERATION_CATEGORIES, f.get('operation_category')) ? f.get('operation_category') : 'services';
  const { db } = c.get('deps');
  await db.batch([
    { sql: 'UPDATE invoices SET service_date = ?, operation_category = ?, notes = ?, updated_at = ? WHERE id = ?', params: [isIsoDate(sd) ? sd : null, cat, f.get('notes').slice(0, 3000), new Date().toISOString(), data.inv.id] },
    { sql: 'DELETE FROM invoice_lines WHERE invoice_id = ?', params: [data.inv.id] },
    ...lines.map((l) => ({
      sql: 'INSERT INTO invoice_lines (invoice_id, position, description, quantity, unit_price_ht, vat_rate, unit_cost_ht) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [data.inv.id, l.position, l.description, l.quantity, l.unit_price_ht, l.vat_rate, l.unit_cost_ht],
    })),
  ]);
  return c.redirect(`/admin/factures/${data.inv.id}?ok=saved`, 303);
});

/** Émission : numérotation continue sans doublon (compteur atomique), document figé (vendeur, client, totaux). */
invoiceRoutes.post('/factures/:id/emettre', async (c) => {
  const data = await load(c);
  if (!data || data.inv.status !== 'brouillon') return c.notFound();
  const s = c.get('settings');
  const { db } = c.get('deps');
  const fail = (msg: string) => page(c, 'Émission impossible', <div class="panel"><p>{msg}</p><a class="btn btn-outline" href={`/admin/factures/${data.inv.id}`}>Retour</a></div>, { status: 422 });
  const missing = missingLegalInfo(s);
  if (missing.length) return fail(`Informations légales manquantes : ${missing.join(', ')}.`);
  if (!data.lines.length) return fail('La facture ne contient aucune ligne.');
  const ct = await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [data.inv.contact_id]);
  if (!ct) return fail('Client introuvable.');
  const today = todayParis();
  const totals = computeTotals(data.lines, s.vatMode);
  const cost = data.lines.reduce((sum, l) => sum + Math.round(l.quantity * l.unit_cost_ht), 0);
  const prefix = data.inv.type === 'avoir' ? 'A' : 'F';
  const counter = `${prefix}-${today.slice(0, 4)}`;
  const seller = JSON.stringify({ ...s.legal, agencyName: s.agencyName, email: s.contactEmail, phone: s.contactPhone, vatMode: s.vatMode, paymentTermsDays: s.paymentTermsDays, latePenaltyRate: s.latePenaltyRate });
  // Incrément du compteur ET attribution du numéro dans un même lot atomique : aucun numéro sauté, aucun doublon.
  await db.batch([
    { sql: 'INSERT OR IGNORE INTO counters (name, value) VALUES (?, 0)', params: [counter] },
    { sql: "UPDATE counters SET value = value + 1 WHERE name = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'brouillon')", params: [counter, data.inv.id] },
    {
      sql: `UPDATE invoices SET number = ? || printf('%04d', (SELECT value FROM counters WHERE name = ?)), status = 'emise', issue_date = ?, due_date = ?, service_date = COALESCE(service_date, ?),
            seller = ?, customer = ?, total_ht = ?, total_vat = ?, total_ttc = ?, cost_ht = ?, updated_at = ? WHERE id = ? AND status = 'brouillon'`,
      params: [`${counter}-`, counter, today, data.inv.type === 'avoir' ? null : addDays(today, s.paymentTermsDays), today, seller, snapshotCustomer(ct), totals.ht, totals.vat, totals.ttc, cost, new Date().toISOString(), data.inv.id],
    },
  ]);
  const issued = await db.get<{ number: string | null }>('SELECT number FROM invoices WHERE id = ?', [data.inv.id]);
  const number = issued?.number;
  const r = { changes: number ? 1 : 0 };
  if (!r.changes) return fail('La facture a déjà été émise.');
  await addContactEvent(c.get('deps'), ct.id, 'systeme', `${data.inv.type === 'avoir' ? 'Avoir' : 'Facture'} ${number} émis(e) : ${eur(totals.ttc)} TTC.`, c.get('user')!.name);
  await audit(db, c.get('user')!.id, 'emission-facture', 'invoice', data.inv.id);
  return c.redirect(`/admin/factures/${data.inv.id}?ok=issued`, 303);
});

invoiceRoutes.post('/factures/:id/payee', async (c) => {
  const f = await readForm(c);
  const d = f.get('paid_at');
  if (!isIsoDate(d)) return c.redirect(`/admin/factures/${idParam(c)}`, 303);
  await c.get('deps').db.run("UPDATE invoices SET status = 'payee', paid_at = ?, payment_method = ?, updated_at = ? WHERE id = ? AND status = 'emise' AND type = 'facture'", [d, f.get('payment_method').slice(0, 60), new Date().toISOString(), idParam(c)]);
  return c.redirect(`/admin/factures/${idParam(c)}?ok=status`, 303);
});

invoiceRoutes.post('/factures/:id/avoir', async (c) => {
  const data = await load(c);
  if (!data || data.inv.status === 'brouillon' || data.inv.type !== 'facture') return c.notFound();
  const id = await createInvoice(c, data.inv.contact_id, data.lines, { type: 'avoir', originalId: data.inv.id, notes: `Avoir sur la facture n° ${data.inv.number}.` });
  return c.redirect(`/admin/factures/${id}?ok=created`, 303);
});

invoiceRoutes.post('/factures/:id/supprimer', async (c) => {
  await c.get('deps').db.run("DELETE FROM invoices WHERE id = ? AND status = 'brouillon'", [idParam(c)]);
  return c.redirect('/admin/factures?ok=deleted', 303);
});

invoiceRoutes.get('/factures/:id/document', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  return page(
    c,
    data.inv.number ?? 'Brouillon',
    <>
      <div class="doc-toolbar">
        <button type="button" class="btn btn-primary" data-print>
          Imprimer / enregistrer en PDF
        </button>
        <a class="btn btn-outline" href={`/admin/factures/${data.inv.id}`}>Retour</a>
      </div>
      <InvoiceDocument s={c.get('settings')} invoice={data.inv} lines={data.lines} original={data.original} />
    </>,
  );
});
