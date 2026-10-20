import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../../app/context';
import { PAGE_SIZE, idParam, page, pageNum, readForm } from './helpers';
import { ActionButton, Badge, Csrf, Empty, F, Money, Pager, Sel, TA, eur } from '../../web/admin/ui';
import { QUOTE_STATUSES, isOneOf } from '../../domain/statuses';
import type { ContactRow, LineRow, ProductRow, QuoteRow, RequestRow, ServiceRow, VariantFull } from '../../repo/types';
import { computeTotals, lineTotal } from '../../domain/money';
import { computeMargin } from '../../domain/margin';
import { formatDate, formatShortDate } from '../../domain/dates';
import { QuoteDocument } from '../../web/documents';
import { createQuote, decideQuote, duplicateQuote, insertLines, linesFromRequest, quoteLines, sendQuote, serviceLine, variantLines } from '../../services/quotes';
import { siteLink } from '../../services/requests';
import { audit } from '../../repo/settings';

export const quoteRoutes = new Hono<AppEnv>();

const KINDS = [
  ['service', 'Prestation'],
  ['option', 'Option'],
  ['design', 'Création graphique'],
  ['print', 'Impression'],
  ['shipping', 'Livraison'],
  ['fees', 'Autres frais'],
] as const;

quoteRoutes.get('/devis', async (c) => {
  const { db } = c.get('deps');
  const status = c.req.query('statut') ?? '';
  const p = pageNum(c);
  const ok = isOneOf(QUOTE_STATUSES, status);
  const rows = await db.all<QuoteRow & { name: string; company: string; ht: number }>(
    `SELECT q.*, ct.name, ct.company, COALESCE((SELECT SUM(ROUND(quantity * unit_price_ht)) FROM quote_lines WHERE quote_id = q.id), 0) AS ht
     FROM quotes q JOIN contacts ct ON ct.id = q.contact_id ${ok ? 'WHERE q.status = ?' : ''} ORDER BY q.updated_at DESC LIMIT ? OFFSET ?`,
    [...(ok ? [status] : []), PAGE_SIZE + 1, (p - 1) * PAGE_SIZE],
  );
  return page(
    c,
    'Devis',
    <>
      <form class="filters" method="get">
        <Sel label="Statut" name="statut" value={status} options={QUOTE_STATUSES} empty="Tous" />
        <button class="btn btn-outline">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <Empty>Aucun devis. Créez-en un depuis une demande de devis ou une fiche contact.</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Client</th>
                <th>Objet</th>
                <th class="num">Total HT</th>
                <th>Validité</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE_SIZE).map((q) => (
                <tr>
                  <td>
                    <a href={`/admin/devis/${q.id}`}>{q.number ?? `Brouillon n° ${q.id}`}</a>
                  </td>
                  <td>
                    {q.name}
                    {q.company ? <div class="small muted">{q.company}</div> : null}
                  </td>
                  <td>{q.title}</td>
                  <td class="num">{eur(q.ht)}</td>
                  <td class="nowrap">{formatShortDate(q.valid_until)}</td>
                  <td>
                    <Badge options={QUOTE_STATUSES} value={q.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={p} hasMore={rows.length > PAGE_SIZE} base={`/admin/devis${status ? `?statut=${status}` : ''}`} />
    </>,
  );
});

quoteRoutes.get('/devis/nouveau', async (c) => {
  const { db } = c.get('deps');
  const reqId = Number(c.req.query('demande') ?? 0);
  const contactId = Number(c.req.query('contact') ?? 0);
  const req = reqId ? await db.get<RequestRow>('SELECT * FROM quote_requests WHERE id = ?', [reqId]) : undefined;
  const contact = await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [req?.contact_id ?? contactId]);
  if (!contact) return page(c, 'Nouveau devis', <Empty>Ouvrez d’abord une fiche contact ou une demande de devis, puis cliquez sur « Créer un devis ».</Empty>);
  return page(
    c,
    'Nouveau devis',
    <form method="post" action="/admin/devis/nouveau" class="panel">
      <Csrf token={c.get('csrf')} />
      <input type="hidden" name="contact_id" value={String(contact.id)} />
      {req && <input type="hidden" name="request_id" value={String(req.id)} />}
      <p>
        Client : <strong>{contact.name}</strong>
        {contact.company ? ` — ${contact.company}` : ''}
        {req ? ` · à partir de la demande n° ${req.id}` : ''}
      </p>
      {req && <p class="muted small">Les lignes seront préremplies à partir de la demande (prestation, options, configuration d’impression). Vérifiez chaque prix avant l’envoi.</p>}
      <div class="form-grid">
        <F label="Objet du devis" name="title" required max={200} value={req ? (JSON.parse(req.answers) as { service_name?: string; product_name?: string }).service_name || (JSON.parse(req.answers) as { product_name?: string }).product_name || '' : ''} />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Créer le brouillon</button>
      </div>
    </form>,
  );
});

quoteRoutes.post('/devis/nouveau', async (c) => {
  const f = await readForm(c);
  const deps = c.get('deps');
  const contactId = f.int('contact_id') ?? 0;
  const contact = await deps.db.get<{ id: number }>('SELECT id FROM contacts WHERE id = ?', [contactId]);
  if (!contact) return c.notFound();
  const reqId = f.int('request_id');
  const req = reqId ? await deps.db.get<RequestRow>('SELECT * FROM quote_requests WHERE id = ? AND contact_id = ?', [reqId, contactId]) : undefined;
  const lines = req ? await linesFromRequest(deps, c.get('settings'), req) : [];
  const id = await createQuote(deps, c.get('settings'), contactId, { requestId: req?.id ?? null, title: f.get('title').slice(0, 200), lines });
  return c.redirect(`/admin/devis/${id}?ok=created`, 303);
});

async function loadQuote(c: Ctx) {
  const { db } = c.get('deps');
  const q = await db.get<QuoteRow>('SELECT * FROM quotes WHERE id = ?', [idParam(c)]);
  if (!q) return null;
  const contact = (await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [q.contact_id]))!;
  const lines = await quoteLines(c.get('deps'), q.id);
  return { q, contact, lines };
}

quoteRoutes.get('/devis/:id', async (c) => {
  const data = await loadQuote(c);
  if (!data) return c.notFound();
  const { q, contact, lines } = data;
  const s = c.get('settings');
  const { db } = c.get('deps');
  const csrf = c.get('csrf');
  const editable = q.status === 'brouillon';
  const totals = computeTotals(lines, s.vatMode);
  const cost = lines.reduce((sum, l) => sum + Math.round(l.quantity * l.unit_cost_ht), 0);
  const m = computeMargin(totals.ht, cost);
  const services = editable ? await db.all<ServiceRow>("SELECT * FROM services WHERE status <> 'disabled' ORDER BY category, sort_order") : [];
  const variants = editable
    ? await db.all<VariantFull & { pname: string }>("SELECT v.*, p.name AS pname FROM supplier_price_variants v JOIN print_products p ON p.id = v.product_id WHERE v.sale_print_ht IS NOT NULL ORDER BY p.sort_order, v.quantity")
    : [];
  const clientLink = siteLink(s, new URL(c.req.url).origin, `/client/devis/${q.token}`);
  return page(
    c,
    q.number ? `Devis ${q.number}` : `Devis — brouillon n° ${q.id}`,
    <>
      <div class="cols cols-3">
        <div>
          {editable ? (
            <form method="post" action={`/admin/devis/${q.id}`} class="panel">
              <Csrf token={csrf} />
              <div class="form-grid">
                <F label="Objet" name="title" value={q.title} max={200} wide />
                <TA label="Introduction (affichée sur le devis)" name="intro" value={q.intro} rows={2} max={3000} />
                <TA label="Conditions particulières" name="terms" value={q.terms} rows={2} max={3000} />
                <F label="Acompte demandé (%)" name="deposit_percent" type="number" value={q.deposit_percent} />
              </div>
              <h2 style="margin-top:1.25rem">Lignes</h2>
              <p class="small muted">Le coût unitaire est interne : il n’apparaît jamais sur le devis du client. Cochez « Suppr. » pour retirer une ligne.</p>
              <div class="table-wrap">
                <table class="data lines-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Désignation</th>
                      <th>Qté</th>
                      <th>PU HT (€)</th>
                      <th>TVA %</th>
                      <th>Coût unit. HT (€)</th>
                      <th>Suppr.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...lines, ...Array.from({ length: 2 }, () => null)].map((l, i) => (
                      <tr>
                        <td>
                          <input type="hidden" name="line_id" value={l ? String(l.id) : ''} />
                          <select name="line_kind">
                            {KINDS.map(([v, lab]) => (
                              <option value={v} selected={(l?.kind ?? 'service') === v}>
                                {lab}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style="min-width:260px">
                          <textarea name="line_description" rows={2} maxlength={2000}>
                            {l?.description ?? ''}
                          </textarea>
                        </td>
                        <td style="width:80px">
                          <input name="line_quantity" value={l ? String(l.quantity).replace('.', ',') : ''} inputmode="decimal" />
                        </td>
                        <td style="width:120px">
                          <input name="line_price" value={l ? (l.unit_price_ht / 100).toFixed(2).replace('.', ',') : ''} inputmode="decimal" />
                        </td>
                        <td style="width:80px">
                          <input name="line_vat" value={String(l?.vat_rate ?? s.vatRate).replace('.', ',')} inputmode="decimal" />
                        </td>
                        <td style="width:120px">
                          <input name="line_cost" value={l ? (l.unit_cost_ht / 100).toFixed(2).replace('.', ',') : ''} inputmode="decimal" />
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
          ) : (
            <div class="panel">
              <p class="muted small">Ce devis n’est plus modifiable (statut : {QUOTE_STATUSES.find((x) => x[0] === q.status)?.[1]}). Créez une nouvelle version pour le corriger.</p>
            </div>
          )}
          <div class="panel">
            <div class="panel-head">
              <h2>Aperçu client</h2>
              <a href={`/admin/devis/${q.id}/document`} class="btn btn-outline btn-sm" target="_blank">Version imprimable / PDF</a>
            </div>
            <QuoteDocument s={s} quote={q} lines={lines} contact={contact} />
          </div>
        </div>
        <div>
          <div class="panel">
            <h2>Synthèse interne</h2>
            <dl class="kv">
              <dt>Client</dt>
              <dd>
                <a href={`/admin/crm/${contact.id}`}>{contact.name}</a>
              </dd>
              <dt>Statut</dt>
              <dd>
                <Badge options={QUOTE_STATUSES} value={q.status} />
              </dd>
              <dt>Total HT</dt>
              <dd>{eur(totals.ht)}</dd>
              <dt>Total TTC</dt>
              <dd>{eur(totals.ttc)}</dd>
              <dt>Coûts directs</dt>
              <dd>{eur(cost)}</dd>
              <dt>Marge brute estimée</dt>
              <dd>{eur(m.grossMargin)}</dd>
              <dt>Taux de marge</dt>
              <dd>{m.marginRate == null ? '—' : `${String(m.marginRate).replace('.', ',')} %`}</dd>
              <dt>Taux de marque</dt>
              <dd>{m.markRate == null ? '—' : `${String(m.markRate).replace('.', ',')} %`}</dd>
              {q.sent_at && (
                <>
                  <dt>Envoyé le</dt>
                  <dd>{formatDate(q.sent_at)}</dd>
                </>
              )}
              {q.decided_at && (
                <>
                  <dt>Réponse</dt>
                  <dd>
                    {formatDate(q.decided_at)} par {q.decided_name}
                    {q.client_comment ? ` — « ${q.client_comment} »` : ''}
                  </dd>
                </>
              )}
            </dl>
          </div>
          {editable && (
            <div class="panel">
              <h2>Ajouter du catalogue</h2>
              <form method="post" action={`/admin/devis/${q.id}/ajouter`} class="form-grid">
                <Csrf token={csrf} />
                <Sel label="Prestation" name="service" options={services.map((x) => [x.slug, x.name] as const)} empty="—" />
                <Sel
                  label="Impression (prix de vente renseigné)"
                  name="variant"
                  options={variants.map((v) => [String(v.id), `${v.pname} · ${[v.format, v.paper, v.weight, v.finish, v.printing, v.extra].filter(Boolean).join(' · ')} · ${v.quantity} ex.${v.status !== 'verifie' ? ' (non vérifié)' : ''}`] as const)}
                  empty="—"
                />
                <div class="form-actions">
                  <button class="btn btn-outline btn-sm">Ajouter</button>
                </div>
              </form>
            </div>
          )}
          <div class="panel">
            <h2>Actions</h2>
            {editable && (
              <>
                <p class="small muted">L’envoi attribue le numéro définitif. Relisez le devis : il ne sera plus modifiable ensuite.</p>
                <div class="page-actions">
                  <ActionButton action={`/admin/devis/${q.id}/envoyer`} csrf={csrf} label="Valider et envoyer par e-mail" cls="btn-primary" confirm="Valider définitivement ce devis et l’envoyer au client ?" fields={{ mode: 'email' }} />
                  <ActionButton action={`/admin/devis/${q.id}/envoyer`} csrf={csrf} label="Valider sans e-mail (transmis autrement)" confirm="Valider ce devis ? Vous le transmettrez vous-même au client." fields={{ mode: 'manual' }} />
                  <ActionButton action={`/admin/devis/${q.id}/supprimer`} csrf={csrf} label="Supprimer le brouillon" cls="btn-danger" confirm="Supprimer ce brouillon ?" />
                </div>
              </>
            )}
            {q.status === 'envoye' && (
              <>
                <p class="small">Lien client sécurisé :</p>
                <div class="copy-row">
                  <input readonly value={clientLink} aria-label="Lien client" />
                  <button type="button" class="btn btn-outline btn-sm" data-copy={clientLink}>
                    Copier
                  </button>
                </div>
                <form method="post" action={`/admin/devis/${q.id}/decision`} class="form-grid" style="margin-top:1rem" data-confirm="Enregistrer cette réponse du client ?">
                  <Csrf token={csrf} />
                  <Sel label="Réponse reçue hors ligne" name="decision" options={[['accepte', 'Accepté (signé)'], ['refuse', 'Refusé']]} />
                  <F label="Nom du signataire" name="name" required max={120} />
                  <TA label="Preuve / commentaire" name="comment" rows={2} max={2000} help="Ex. : devis signé reçu par e-mail le…" />
                  <div class="form-actions">
                    <button class="btn btn-outline btn-sm">Enregistrer</button>
                  </div>
                </form>
              </>
            )}
            {q.status === 'accepte' && (
              <div class="page-actions">
                <ActionButton action={`/admin/factures/depuis-devis/${q.id}`} csrf={csrf} label="Créer la facture (brouillon)" cls="btn-primary" />
                <a class="btn btn-outline btn-sm" href={`/admin/projets/nouveau?contact=${contact.id}&devis=${q.id}`}>Créer le projet web</a>
              </div>
            )}
            {q.status !== 'brouillon' && (
              <div class="page-actions" style="margin-top:.75rem">
                <ActionButton action={`/admin/devis/${q.id}/dupliquer`} csrf={csrf} label="Nouvelle version (copie)" confirm={q.status === 'envoye' ? 'Le devis actuel sera annulé et remplacé par une copie modifiable. Continuer ?' : undefined} />
                {q.status === 'envoye' && <ActionButton action={`/admin/devis/${q.id}/annuler`} csrf={csrf} label="Annuler le devis" cls="btn-danger" confirm="Annuler ce devis ?" />}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    { wide: true },
  );
});

/** Lecture d'un nombre décimal « 1,5 » ou « 1.5 ». */
const num = (v: string) => {
  const s = v.replace(/\s/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};

quoteRoutes.post('/devis/:id', async (c) => {
  const data = await loadQuote(c);
  if (!data) return c.notFound();
  if (data.q.status !== 'brouillon') return c.redirect(`/admin/devis/${data.q.id}`, 303);
  const f = await readForm(c);
  const ids = f.all('line_id');
  const kinds = f.all('line_kind');
  const descs = f.all('line_description');
  const qtys = f.all('line_quantity');
  const prices = f.all('line_price');
  const vats = f.all('line_vat');
  const costs = f.all('line_cost');
  const del = new Set(f.all('line_delete').map(Number));
  const lines: Omit<LineRow, 'id'>[] = [];
  const errors: string[] = [];
  ids.forEach((_, i) => {
    if (del.has(i)) return;
    const desc = (descs[i] ?? '').trim();
    if (!desc && !(prices[i] ?? '').trim()) return; // ligne vide
    const qty = num(qtys[i] ?? '1') ?? NaN;
    const price = num(prices[i] ?? '');
    const vat = num(vats[i] ?? '');
    const cost = num(costs[i] || '0');
    if (!desc || !(qty > 0) || price == null || vat == null || vat < 0 || vat > 30 || cost == null || cost < 0) {
      errors.push(`Ligne ${i + 1} incomplète ou invalide.`);
      return;
    }
    lines.push({ position: lines.length + 1, kind: isOneOf(KINDS, kinds[i]) ? kinds[i] : 'service', description: desc.slice(0, 2000), quantity: qty, unit_price_ht: Math.round(price * 100), vat_rate: vat, unit_cost_ht: Math.round(cost * 100) });
  });
  if (errors.length) return c.redirect(`/admin/devis/${data.q.id}?erreur=lignes`, 303);
  const dep = Math.min(100, Math.max(0, f.int('deposit_percent') ?? 0));
  const { db } = c.get('deps');
  await db.batch([
    { sql: 'UPDATE quotes SET title = ?, intro = ?, terms = ?, deposit_percent = ?, updated_at = ? WHERE id = ?', params: [f.get('title').slice(0, 200), f.get('intro').slice(0, 3000), f.get('terms').slice(0, 3000), dep, new Date().toISOString(), data.q.id] },
    { sql: 'DELETE FROM quote_lines WHERE quote_id = ?', params: [data.q.id] },
    ...lines.map((l) => ({
      sql: 'INSERT INTO quote_lines (quote_id, position, kind, description, quantity, unit_price_ht, vat_rate, unit_cost_ht) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      params: [data.q.id, l.position, l.kind ?? 'service', l.description, l.quantity, l.unit_price_ht, l.vat_rate, l.unit_cost_ht],
    })),
  ]);
  return c.redirect(`/admin/devis/${data.q.id}?ok=saved`, 303);
});

quoteRoutes.post('/devis/:id/ajouter', async (c) => {
  const data = await loadQuote(c);
  if (!data || data.q.status !== 'brouillon') return c.notFound();
  const f = await readForm(c);
  const { db } = c.get('deps');
  const s = c.get('settings');
  const add = [];
  const svc = f.get('service') ? await db.get<ServiceRow>('SELECT * FROM services WHERE slug = ?', [f.get('service')]) : undefined;
  if (svc) add.push(serviceLine(svc, s));
  const v = f.int('variant') ? await db.get<VariantFull>('SELECT * FROM supplier_price_variants WHERE id = ?', [f.int('variant')!]) : undefined;
  if (v) {
    const product = await db.get<ProductRow>('SELECT * FROM print_products WHERE id = ?', [v.product_id]);
    add.push(...variantLines(v, product?.name ?? v.product_name, s));
  }
  await insertLines(c.get('deps'), data.q.id, add, data.lines.length);
  return c.redirect(`/admin/devis/${data.q.id}?ok=saved`, 303);
});

quoteRoutes.post('/devis/:id/envoyer', async (c) => {
  const f = await readForm(c);
  const r = await sendQuote(c.get('deps'), c.get('settings'), idParam(c), new URL(c.req.url).origin, f.get('mode') === 'email', c.get('user')!.name);
  if (!r.ok) {
    const data = await loadQuote(c);
    if (!data) return c.notFound();
    return page(c, 'Envoi impossible', <div class="panel"><p>{r.error}</p><a class="btn btn-outline" href={`/admin/devis/${idParam(c)}`}>Retour au devis</a></div>, { status: 422 });
  }
  await audit(c.get('deps').db, c.get('user')!.id, 'envoi-devis', 'quote', idParam(c));
  return c.redirect(`/admin/devis/${idParam(c)}?ok=sent`, 303);
});

quoteRoutes.post('/devis/:id/decision', async (c) => {
  const f = await readForm(c);
  const d = f.get('decision') === 'accepte' ? 'accepte' : 'refuse';
  const name = f.get('name');
  if (!name) return c.redirect(`/admin/devis/${idParam(c)}`, 303);
  const r = await decideQuote(c.get('deps'), c.get('settings'), idParam(c), d, name, `[Enregistré par l’agence] ${f.get('comment')}`, c.get('user')!.name);
  if (!r.ok) return page(c, 'Action impossible', <div class="panel"><p>{r.error}</p><a class="btn btn-outline" href={`/admin/devis/${idParam(c)}`}>Retour</a></div>, { status: 409 });
  return c.redirect(`/admin/devis/${idParam(c)}?ok=status`, 303);
});

quoteRoutes.post('/devis/:id/dupliquer', async (c) => {
  const id = await duplicateQuote(c.get('deps'), c.get('settings'), idParam(c));
  return id ? c.redirect(`/admin/devis/${id}?ok=created`, 303) : c.notFound();
});

quoteRoutes.post('/devis/:id/annuler', async (c) => {
  await c.get('deps').db.run("UPDATE quotes SET status = 'annule', updated_at = ? WHERE id = ? AND status = 'envoye'", [new Date().toISOString(), idParam(c)]);
  return c.redirect(`/admin/devis/${idParam(c)}?ok=status`, 303);
});

quoteRoutes.post('/devis/:id/supprimer', async (c) => {
  await c.get('deps').db.run("DELETE FROM quotes WHERE id = ? AND status = 'brouillon'", [idParam(c)]);
  return c.redirect('/admin/devis?ok=deleted', 303);
});

quoteRoutes.get('/devis/:id/document', async (c) => {
  const data = await loadQuote(c);
  if (!data) return c.notFound();
  return page(
    c,
    `Devis ${data.q.number ?? 'brouillon'}`,
    <>
      <div class="doc-toolbar">
        <button type="button" class="btn btn-primary" data-print>
          Imprimer / enregistrer en PDF
        </button>
        <a class="btn btn-outline" href={`/admin/devis/${data.q.id}`}>Retour</a>
      </div>
      <QuoteDocument s={c.get('settings')} quote={data.q} lines={data.lines} contact={data.contact} />
    </>,
  );
});

export { Money, lineTotal };
