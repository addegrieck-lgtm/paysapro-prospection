import { Hono } from 'hono';
import type { AppEnv } from '../../app/context';
import { PAGE_SIZE, idParam, page, pageNum, readForm } from './helpers';
import { ActionButton, Badge, Check, Csrf, Empty, F, Money, Pager, Sel, TA, eur } from '../../web/admin/ui';
import { ORDER_STATUSES, PROOF_STATUSES, isOneOf, labelOf, orderTransitionError } from '../../domain/statuses';
import type { ContactRow, OrderRow, ProductRow, ProofRow, QuoteRow } from '../../repo/types';
import { formatDateTime, formatShortDate, isIsoDate } from '../../domain/dates';
import { PREPRESS_CHECKLIST, checklistProgress, parseChecklist, type ChecklistState } from '../../domain/checklists';
import { orderEvent, orderGuardInput, sendProof, setOrderStatus } from '../../services/orders';
import { nextNumber } from '../../repo/settings';
import { randomToken } from '../../lib/crypto';
import { UPLOAD_LIMITS, safeFileName, sniffType } from '../../lib/storage';
import { readPdfInfo, type PdfInfo } from '../../lib/pdfinfo';
import { siteLink } from '../../services/requests';
import { OrderDocument } from '../../web/documents';
import { quoteLines } from '../../services/quotes';

export const orderRoutes = new Hono<AppEnv>();

orderRoutes.get('/commandes', async (c) => {
  const { db } = c.get('deps');
  const status = c.req.query('statut') ?? '';
  const p = pageNum(c);
  const ok = isOneOf(ORDER_STATUSES, status);
  const rows = await db.all<OrderRow & { name: string; company: string }>(
    `SELECT o.*, ct.name, ct.company FROM print_orders o JOIN contacts ct ON ct.id = o.contact_id
     ${ok ? 'WHERE o.status = ?' : "WHERE o.status NOT IN ('termine', 'annule')"} ORDER BY o.updated_at DESC LIMIT ? OFFSET ?`,
    [...(ok ? [status] : []), PAGE_SIZE + 1, (p - 1) * PAGE_SIZE],
  );
  return page(
    c,
    'Commandes d’impression',
    <>
      <form class="filters" method="get">
        <Sel label="Statut" name="statut" value={status} options={ORDER_STATUSES} empty="En cours (non terminées)" />
        <button class="btn btn-outline">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <Empty>Aucune commande. Les demandes d’impression du site créent automatiquement une commande au statut « Demande reçue ».</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Produit</th>
                <th>Statut</th>
                <th>Réf. fournisseur</th>
                <th>Livraison estimée</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE_SIZE).map((o) => (
                <tr>
                  <td>
                    <a href={`/admin/commandes/${o.id}`}>{o.number}</a>
                  </td>
                  <td>
                    {o.name}
                    {o.company ? <div class="small muted">{o.company}</div> : null}
                  </td>
                  <td class="small">{o.description}</td>
                  <td>
                    <Badge options={ORDER_STATUSES} value={o.status} />
                  </td>
                  <td>{o.supplier_order_ref || '—'}</td>
                  <td class="nowrap">{formatShortDate(o.estimated_delivery)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={p} hasMore={rows.length > PAGE_SIZE} base={`/admin/commandes${status ? `?statut=${status}` : ''}`} />
    </>,
    { actions: <a href="/admin/commandes/nouvelle" class="btn btn-primary">Nouvelle commande</a> },
  );
});

orderRoutes.get('/commandes/nouvelle', async (c) => {
  const { db } = c.get('deps');
  const contactId = Number(c.req.query('contact') ?? 0);
  const contacts = await db.all<ContactRow>('SELECT id, name, company FROM contacts ORDER BY name LIMIT 500');
  const products = await db.all<ProductRow>('SELECT id, name FROM print_products ORDER BY sort_order');
  return page(
    c,
    'Nouvelle commande d’impression',
    <form method="post" action="/admin/commandes/nouvelle" class="panel">
      <Csrf token={c.get('csrf')} />
      <div class="form-grid">
        <Sel label="Client" name="contact_id" required value={contactId ? String(contactId) : ''} options={contacts.map((x) => [String(x.id), `${x.name}${x.company ? ` — ${x.company}` : ''}`] as const)} empty="Choisir…" />
        <Sel label="Produit" name="product_id" options={products.map((x) => [String(x.id), x.name] as const)} empty="Autre / sur mesure" />
        <TA label="Description (format, papier, finition, quantité…)" name="description" required rows={3} max={1000} />
        <Check label="BAT obligatoire avant impression" name="bat_required" checked help="Recommandé. Décochez uniquement si le client fournit un fichier qu’il a lui-même validé par écrit." />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Créer la commande</button>
      </div>
    </form>,
  );
});

orderRoutes.post('/commandes/nouvelle', async (c) => {
  const f = await readForm(c);
  const { db } = c.get('deps');
  const ct = await db.get<{ id: number }>('SELECT id FROM contacts WHERE id = ?', [f.int('contact_id') ?? 0]);
  const desc = f.get('description').slice(0, 1000);
  if (!ct || !desc) return c.redirect('/admin/commandes/nouvelle', 303);
  const product = f.int('product_id') ? await db.get<ProductRow>('SELECT * FROM print_products WHERE id = ?', [f.int('product_id')!]) : undefined;
  const number = await nextNumber(db, 'CMD', new Date().getFullYear());
  const now = new Date().toISOString();
  const r = await db.run(
    `INSERT INTO print_orders (number, contact_id, product_id, description, config, status, bat_required, supplier, created_at, updated_at) VALUES (?, ?, ?, ?, '{}', 'demande_recue', ?, ?, ?, ?)`,
    [number, ct.id, product?.id ?? null, desc, f.bool('bat_required') ? 1 : 0, product?.supplier ?? '', now, now],
  );
  await orderEvent(c.get('deps'), r.lastId, 'Commande créée manuellement.', c.get('user')!.name);
  return c.redirect(`/admin/commandes/${r.lastId}?ok=created`, 303);
});

orderRoutes.get('/commandes/:id', async (c) => {
  const { db } = c.get('deps');
  const s = c.get('settings');
  const o = await db.get<OrderRow>('SELECT * FROM print_orders WHERE id = ?', [idParam(c)]);
  if (!o) return c.notFound();
  const [ct, events, proofs, quotes] = await Promise.all([
    db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [o.contact_id]),
    db.all<{ from_status: string | null; to_status: string | null; note: string; author: string; created_at: string }>('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC, id DESC', [o.id]),
    db.all<ProofRow>('SELECT * FROM proofs WHERE order_id = ? ORDER BY version DESC', [o.id]),
    db.all<QuoteRow>("SELECT id, number, title, status FROM quotes WHERE contact_id = ? AND number IS NOT NULL ORDER BY id DESC", [o.contact_id]),
  ]);
  const guard = await orderGuardInput(c.get('deps'), o);
  const csrf = c.get('csrf');
  const origin = new URL(c.req.url).origin;
  return page(
    c,
    `Commande ${o.number}`,
    <div class="cols cols-3">
      <div>
        <div class="panel">
          <div class="panel-head">
            <h2>{o.description}</h2>
            <Badge options={ORDER_STATUSES} value={o.status} />
          </div>
          <form method="post" action={`/admin/commandes/${o.id}/statut`} class="form-grid">
            <Csrf token={csrf} />
            <div class="field">
              <label for="f-status">Nouveau statut</label>
              <select id="f-status" name="status">
                {ORDER_STATUSES.map(([v, l]) => {
                  const err = orderTransitionError(v, guard);
                  return (
                    <option value={v} selected={v === o.status} disabled={!!err && v !== o.status}>
                      {l}
                      {err && v !== o.status ? ' (indisponible)' : ''}
                    </option>
                  );
                })}
              </select>
              <small class="help">Les étapes fournisseur exigent un BAT accepté (si prévu) et, à partir de « Commande fournisseur passée », la référence réelle de la commande.</small>
            </div>
            <F label="Note (facultatif)" name="note" max={500} />
            <div class="form-actions">
              <button class="btn btn-primary btn-sm">Changer le statut</button>
            </div>
          </form>
        </div>
        <form method="post" action={`/admin/commandes/${o.id}`} class="panel">
          <Csrf token={csrf} />
          <h2>Fournisseur et livraison</h2>
          <div class="form-grid">
            <F label="Fournisseur" name="supplier" value={o.supplier} max={120} />
            <F label="N° de commande fournisseur" name="supplier_order_ref" value={o.supplier_order_ref} max={120} help="À renseigner uniquement après avoir réellement passé la commande." />
            <F label="Date de la commande fournisseur" name="supplier_ordered_at" type="date" value={o.supplier_ordered_at?.slice(0, 10) ?? ''} />
            <Money label="Coût fournisseur réel HT" name="supplier_cost_ht" cents={o.supplier_cost_ht} help="Impression + transport + frais, d’après la confirmation fournisseur." />
            <Money label="Prix de vente total HT" name="sale_total_ht" cents={o.sale_total_ht} />
            <F label="Lien de suivi du colis" name="tracking_url" type="url" value={o.tracking_url} max={500} />
            <F label="Livraison estimée" name="estimated_delivery" type="date" value={o.estimated_delivery ?? ''} />
            <Sel label="Devis associé" name="quote_id" value={o.quote_id ? String(o.quote_id) : ''} options={quotes.map((q) => [String(q.id), `${q.number} ${q.title}`] as const)} empty="—" />
            <Check label="BAT obligatoire" name="bat_required" checked={!!o.bat_required} />
            <TA label="Notes internes" name="notes" value={o.notes} rows={3} max={5000} />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm">Enregistrer</button>
            <a class="btn btn-outline btn-sm" href={`/admin/commandes/${o.id}/bon`} target="_blank">Bon de commande</a>
          </div>
        </form>
        <div class="panel">
          <h2>Bons à tirer (BAT)</h2>
          {o.bat_required ? null : <div class="alert alert-warning">BAT non requis pour cette commande.</div>}
          <form method="post" action={`/admin/commandes/${o.id}/bat`} enctype="multipart/form-data" class="form-grid">
            <Csrf token={csrf} />
            <div class="field field-wide">
              <label for="f-file">Nouvelle version du visuel (PDF, PNG, JPG ou WebP, 10 Mo max.)</label>
              <input id="f-file" type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.webp" />
            </div>
            <div class="form-actions">
              <button class="btn btn-outline btn-sm">Ajouter la version</button>
            </div>
          </form>
          {proofs.map((p) => {
            const state = parseChecklist(p.checklist);
            const prog = checklistProgress(PREPRESS_CHECKLIST, state);
            const info = p.pdf_info ? (JSON.parse(p.pdf_info) as PdfInfo) : null;
            const link = siteLink(s, origin, `/client/bat/${p.token}`);
            return (
              <fieldset style="margin-top:1rem">
                <legend>
                  Version {p.version} — <Badge options={PROOF_STATUSES} value={p.status} />
                </legend>
                <p>
                  <a href={`/admin/fichiers/${p.file_key}`}>{p.file_name}</a> · ajouté le {formatDateTime(p.created_at)}
                  {p.sent_at && ` · envoyé le ${formatDateTime(p.sent_at)}`}
                  {p.decided_at && ` · ${p.status === 'accepte' ? 'accepté' : 'refusé'} le ${formatDateTime(p.decided_at)} par ${p.decided_name}`}
                </p>
                {p.client_comment && <div class="alert">Commentaire du client : {p.client_comment}</div>}
                {info && (
                  <p class="small muted">
                    Lecture automatique (indicative) : {info.pages ?? '?'} page(s) · format {info.trimBoxMm ? `${info.trimBoxMm[0]} × ${info.trimBoxMm[1]} mm (TrimBox)` : info.mediaBoxMm ? `${info.mediaBoxMm[0]} × ${info.mediaBoxMm[1]} mm (MediaBox)` : 'non déterminé'}
                    {info.bleedBoxMm ? ` · BleedBox ${info.bleedBoxMm[0]} × ${info.bleedBoxMm[1]} mm` : ' · fond perdu non déclaré'} · polices :{' '}
                    {info.fonts == null ? 'non déterminé' : `${info.embeddedFonts}/${info.fonts} incorporée(s)`}. Ces valeurs ne remplacent pas la vérification manuelle.
                  </p>
                )}
                <form method="post" action={`/admin/bat/${p.id}/checklist`}>
                  <Csrf token={csrf} />
                  <p class="small">
                    Checklist prépresse : {prog.done}/{prog.total}
                  </p>
                  <div class="progress">
                    <span style={`width:${Math.round((prog.done / prog.total) * 100)}%`}></span>
                  </div>
                  <ul class="checklist">
                    {PREPRESS_CHECKLIST.map((it) => (
                      <li>
                        <label>
                          <input type="checkbox" name="check" value={it.key} checked={!!state[it.key]?.done} disabled={p.status !== 'brouillon'} />
                          <span>
                            {it.label}
                            {state[it.key]?.done && <small>Vérifié par {state[it.key]!.by} le {formatDateTime(state[it.key]!.at)}</small>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {p.status === 'brouillon' && (
                    <div class="form-actions">
                      <button class="btn btn-outline btn-sm">Enregistrer la checklist</button>
                    </div>
                  )}
                </form>
                {p.status === 'brouillon' && (
                  <div class="form-actions">
                    <ActionButton action={`/admin/bat/${p.id}/envoyer`} csrf={csrf} label={prog.complete ? 'Envoyer ce BAT au client' : 'Checklist incomplète'} cls="btn-primary" confirm="Envoyer ce BAT au client pour validation ?" />
                  </div>
                )}
                {p.status === 'envoye' && (
                  <div class="copy-row">
                    <input readonly value={link} aria-label="Lien de validation du BAT" />
                    <button type="button" class="btn btn-outline btn-sm" data-copy={link}>
                      Copier le lien
                    </button>
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
      </div>
      <div>
        <div class="panel">
          <h2>Client</h2>
          {ct && (
            <dl class="kv">
              <dt>Nom</dt>
              <dd>
                <a href={`/admin/crm/${ct.id}`}>{ct.name}</a>
              </dd>
              <dt>E-mail</dt>
              <dd>{ct.email || '—'}</dd>
              <dt>Téléphone</dt>
              <dd>{ct.phone || '—'}</dd>
            </dl>
          )}
          <dl class="kv" style="margin-top:.75rem">
            <dt>Coût fournisseur</dt>
            <dd>{eur(o.supplier_cost_ht)}</dd>
            <dt>Vente HT</dt>
            <dd>{eur(o.sale_total_ht)}</dd>
            <dt>Fichier validé</dt>
            <dd>{o.validated_proof_id ? proofs.filter((p) => p.id === o.validated_proof_id).map((p) => <a href={`/admin/fichiers/${p.file_key}`}>{p.file_name} (v{p.version})</a>) : '—'}</dd>
            <dt>Suivi</dt>
            <dd>{o.tracking_url ? <a href={o.tracking_url} rel="noopener" target="_blank">Suivre le colis</a> : '—'}</dd>
          </dl>
        </div>
        <div class="panel">
          <h2>Historique et échanges</h2>
          <form method="post" action={`/admin/commandes/${o.id}/note`} class="form-grid">
            <Csrf token={csrf} />
            <TA label="Ajouter une note / un échange client" name="note" rows={2} required max={2000} />
            <div class="form-actions">
              <button class="btn btn-outline btn-sm">Ajouter</button>
            </div>
          </form>
          <ul class="timeline" style="margin-top:1rem">
            {events.map((e) => (
              <li>
                <time>
                  {formatDateTime(e.created_at)} · {e.author}
                </time>
                {e.to_status ? `${e.from_status ? labelOf(ORDER_STATUSES, e.from_status) + ' → ' : ''}${labelOf(ORDER_STATUSES, e.to_status)}` : ''}
                {e.note ? `${e.to_status ? ' — ' : ''}${e.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    { wide: true },
  );
});

orderRoutes.post('/commandes/:id/statut', async (c) => {
  const f = await readForm(c);
  const to = f.get('status');
  const err = await setOrderStatus(c.get('deps'), idParam(c), to, f.get('note'), c.get('user')!.name);
  if (err) return page(c, 'Changement de statut refusé', <div class="panel"><p>{err}</p><a class="btn btn-outline" href={`/admin/commandes/${idParam(c)}`}>Retour à la commande</a></div>, { status: 409 });
  return c.redirect(`/admin/commandes/${idParam(c)}?ok=status`, 303);
});

orderRoutes.post('/commandes/:id', async (c) => {
  const f = await readForm(c);
  const { db } = c.get('deps');
  const id = idParam(c);
  const o = await db.get<OrderRow>('SELECT * FROM print_orders WHERE id = ?', [id]);
  if (!o) return c.notFound();
  const orderedAt = f.get('supplier_ordered_at');
  const est = f.get('estimated_delivery');
  const tracking = f.get('tracking_url');
  if ((orderedAt && !isIsoDate(orderedAt)) || (est && !isIsoDate(est)) || (tracking && !/^https?:\/\//i.test(tracking))) {
    return page(c, 'Valeurs invalides', <div class="panel"><p>Vérifiez les dates et le lien de suivi (http/https).</p><a class="btn btn-outline" href={`/admin/commandes/${id}`}>Retour</a></div>, { status: 422 });
  }
  // On ne peut pas retirer la référence fournisseur d'une commande déjà déclarée passée.
  const passed = ORDER_STATUSES.findIndex((x) => x[0] === o.status) >= ORDER_STATUSES.findIndex((x) => x[0] === 'commande_passee') && o.status !== 'annule';
  if (passed && (!f.get('supplier_order_ref') || !orderedAt)) {
    return page(c, 'Valeurs invalides', <div class="panel"><p>Cette commande est déclarée passée chez le fournisseur : sa référence et sa date sont obligatoires.</p><a class="btn btn-outline" href={`/admin/commandes/${id}`}>Retour</a></div>, { status: 422 });
  }
  const qid = f.int('quote_id');
  await db.run(
    `UPDATE print_orders SET supplier = ?, supplier_order_ref = ?, supplier_ordered_at = ?, supplier_cost_ht = ?, sale_total_ht = ?, tracking_url = ?, estimated_delivery = ?, quote_id = ?, bat_required = ?, notes = ?, updated_at = ? WHERE id = ?`,
    [f.get('supplier').slice(0, 120), f.get('supplier_order_ref').slice(0, 120), orderedAt || null, f.money('supplier_cost_ht'), f.money('sale_total_ht'), tracking.slice(0, 500), est || null, qid, f.bool('bat_required') ? 1 : 0, f.get('notes').slice(0, 5000), new Date().toISOString(), id],
  );
  if (f.get('supplier_order_ref') !== o.supplier_order_ref) await orderEvent(c.get('deps'), id, `Référence fournisseur : ${f.get('supplier_order_ref') || '(retirée)'}`, c.get('user')!.name);
  if (tracking && tracking !== o.tracking_url) await orderEvent(c.get('deps'), id, `Lien de suivi ajouté.`, c.get('user')!.name);
  return c.redirect(`/admin/commandes/${id}?ok=saved`, 303);
});

orderRoutes.post('/commandes/:id/note', async (c) => {
  const f = await readForm(c);
  if (f.get('note')) await orderEvent(c.get('deps'), idParam(c), f.get('note'), c.get('user')!.name);
  return c.redirect(`/admin/commandes/${idParam(c)}?ok=saved`, 303);
});

orderRoutes.post('/commandes/:id/bat', async (c) => {
  const { db, storage } = c.get('deps');
  const id = idParam(c);
  const o = await db.get<OrderRow>('SELECT * FROM print_orders WHERE id = ?', [id]);
  if (!o) return c.notFound();
  const f = await readForm(c);
  const file = f.raw.file;
  const back = (msg: string) => page(c, 'Fichier refusé', <div class="panel"><p>{msg}</p><a class="btn btn-outline" href={`/admin/commandes/${id}`}>Retour</a></div>, { status: 422 });
  if (!file || typeof file === 'string' || Array.isArray(file)) return back('Aucun fichier reçu.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > UPLOAD_LIMITS.maxFileBytes) return back('Fichier trop volumineux (10 Mo maximum).');
  const type = sniffType(bytes);
  if (!type) return back('Format non accepté (PDF, PNG, JPG ou WebP).');
  const key = randomToken(18);
  const name = safeFileName(file.name, type);
  await storage.put(key, bytes, type);
  const v = await db.get<{ v: number }>('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM proofs WHERE order_id = ?', [id]);
  const now = new Date().toISOString();
  await db.batch([
    { sql: 'INSERT INTO files (key, name, type, size, owner_kind, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', params: [key, name, type, bytes.length, 'proof', id, now] },
    {
      sql: "INSERT INTO proofs (order_id, version, file_key, file_name, pdf_info, checklist, status, token, created_at) VALUES (?, ?, ?, ?, ?, '{}', 'brouillon', ?, ?)",
      params: [id, v!.v, key, name, type === 'application/pdf' ? JSON.stringify(readPdfInfo(bytes)) : null, randomToken(32), now],
    },
  ]);
  await orderEvent(c.get('deps'), id, `Visuel version ${v!.v} ajouté (${name}).`, c.get('user')!.name);
  if (['demande_recue', 'configuration_a_confirmer', 'prix_a_verifier', 'devis_en_preparation', 'devis_envoye', 'devis_accepte'].includes(o.status)) {
    await setOrderStatus(c.get('deps'), id, 'visuel_en_preparation', '', c.get('user')!.name);
  }
  return c.redirect(`/admin/commandes/${id}?ok=created`, 303);
});

orderRoutes.post('/bat/:id/checklist', async (c) => {
  const { db } = c.get('deps');
  const p = await db.get<ProofRow>('SELECT * FROM proofs WHERE id = ?', [idParam(c)]);
  if (!p) return c.notFound();
  if (p.status !== 'brouillon') return c.redirect(`/admin/commandes/${p.order_id}`, 303);
  const f = await readForm(c);
  const checked = new Set(f.all('check'));
  const prev = parseChecklist(p.checklist);
  const next: ChecklistState = {};
  const now = new Date().toISOString();
  for (const it of PREPRESS_CHECKLIST) {
    if (checked.has(it.key)) next[it.key] = prev[it.key]?.done ? prev[it.key]! : { done: true, at: now, by: c.get('user')!.name };
  }
  await db.run('UPDATE proofs SET checklist = ? WHERE id = ?', [JSON.stringify(next), p.id]);
  return c.redirect(`/admin/commandes/${p.order_id}?ok=saved`, 303);
});

orderRoutes.post('/bat/:id/envoyer', async (c) => {
  const p = await c.get('deps').db.get<ProofRow>('SELECT * FROM proofs WHERE id = ?', [idParam(c)]);
  if (!p) return c.notFound();
  const r = await sendProof(c.get('deps'), c.get('settings'), p.id, new URL(c.req.url).origin, c.get('user')!.name);
  if (!r.ok) return page(c, 'Envoi du BAT impossible', <div class="panel"><p>{r.error}</p><a class="btn btn-outline" href={`/admin/commandes/${p.order_id}`}>Retour</a></div>, { status: 422 });
  return c.redirect(`/admin/commandes/${p.order_id}?ok=sent`, 303);
});

orderRoutes.get('/commandes/:id/bon', async (c) => {
  const { db } = c.get('deps');
  const o = await db.get<OrderRow>('SELECT * FROM print_orders WHERE id = ?', [idParam(c)]);
  if (!o) return c.notFound();
  const ct = (await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [o.contact_id]))!;
  const lines = o.quote_id ? await quoteLines(c.get('deps'), o.quote_id) : [];
  return page(
    c,
    `Bon de commande ${o.number}`,
    <>
      <div class="doc-toolbar">
        <button type="button" class="btn btn-primary" data-print>
          Imprimer / enregistrer en PDF
        </button>
        <a class="btn btn-outline" href={`/admin/commandes/${o.id}`}>Retour</a>
      </div>
      <OrderDocument s={c.get('settings')} order={o} contact={ct} lines={lines} />
    </>,
  );
});
