import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, Ctx } from '../../app/context';
import { PAGE_SIZE, idParam, page, pageNum, readForm } from './helpers';
import { ActionButton, Badge, Check, Csrf, Empty, F, Pager, Sel, TA, eur } from '../../web/admin/ui';
import { CONTACT_SOURCES, CONTACT_STATUSES, EVENT_KINDS, INVOICE_STATUSES, ORDER_STATUSES, QUOTE_STATUSES, REQUEST_STATUSES, isOneOf, labelOf } from '../../domain/statuses';
import type { ContactRow, RequestRow } from '../../repo/types';
import { formatDateTime, formatShortDate, isIsoDate } from '../../domain/dates';
import { toCsv } from '../../domain/text';
import { addContactEvent } from '../../services/requests';
import { audit } from '../../repo/settings';
import { PROJECT_TYPES } from '../../web/public/quote';
import { describeConfig, type PrintConfig, type PublicEstimate } from '../../domain/print';
import { formatEuros } from '../../domain/money';

export const crmRoutes = new Hono<AppEnv>();

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Nom requis.').max(120),
  company: z.string().trim().max(160),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().email('E-mail invalide.')]),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  postal_code: z.string().trim().max(10),
  city: z.string().trim().max(120),
  siren: z.string().trim().regex(/^(\d{9}|\d{14})?$/, 'SIREN (9 chiffres) ou SIRET (14 chiffres) invalide.'),
  customer_type: z.enum(['pro', 'particulier']),
  source: z.string().max(40),
  need: z.string().trim().max(1000),
  budget: z.string().trim().max(100),
  status: z.string().refine((v) => isOneOf(CONTACT_STATUSES, v), 'Statut invalide.'),
  next_action: z.string().trim().max(300),
  next_action_at: z.string().refine((v) => v === '' || isIsoDate(v), 'Date invalide.'),
  notes: z.string().trim().max(10000),
});

function ContactForm({ c, csrf, action }: { c: Partial<ContactRow>; csrf: string; action: string }) {
  return (
    <form method="post" action={action} class="panel">
      <Csrf token={csrf} />
      <div class="form-grid">
        <F label="Nom du contact" name="name" value={c.name} required max={120} />
        <F label="Entreprise" name="company" value={c.company} max={160} />
        <F label="E-mail" name="email" type="email" value={c.email} max={200} />
        <F label="Téléphone" name="phone" type="tel" value={c.phone} max={40} />
        <F label="Adresse" name="address" value={c.address} max={300} />
        <F label="Code postal" name="postal_code" value={c.postal_code} max={10} />
        <F label="Ville" name="city" value={c.city} max={120} />
        <F label="SIREN / SIRET" name="siren" value={c.siren} max={14} help="Obligatoire sur les factures aux professionnels." />
        <Sel label="Type de client" name="customer_type" value={c.customer_type ?? 'pro'} options={[['pro', 'Professionnel'], ['particulier', 'Particulier']]} />
        <Sel label="Source" name="source" value={c.source ?? ''} options={CONTACT_SOURCES} empty="—" />
        <Sel label="Statut commercial" name="status" value={c.status ?? 'nouveau'} options={CONTACT_STATUSES} />
        <F label="Budget estimé" name="budget" value={c.budget} max={100} />
        <F label="Prochaine action" name="next_action" value={c.next_action} max={300} />
        <F label="Date de la prochaine action" name="next_action_at" type="date" value={c.next_action_at ?? ''} />
        <TA label="Besoin" name="need" value={c.need} rows={2} max={1000} />
        <TA label="Notes internes" name="notes" value={c.notes} rows={4} max={10000} />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  );
}

crmRoutes.get('/crm', async (c) => {
  const { db } = c.get('deps');
  const q = (c.req.query('q') ?? '').trim();
  const status = c.req.query('statut') ?? '';
  const p = pageNum(c);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    where.push('(name LIKE ? OR company LIKE ? OR email LIKE ? OR phone LIKE ?)');
    const like = `%${q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like, like);
  }
  if (isOneOf(CONTACT_STATUSES, status)) {
    where.push('status = ?');
    params.push(status);
  }
  const rows = await db.all<ContactRow>(
    `SELECT * FROM contacts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE + 1, (p - 1) * PAGE_SIZE],
  );
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { statut: status } : {}) }).toString();
  return page(
    c,
    'Contacts (CRM)',
    <>
      <form class="filters" method="get">
        <div class="field">
          <label for="q">Rechercher</label>
          <input id="q" name="q" value={q} placeholder="Nom, entreprise, e-mail…" />
        </div>
        <Sel label="Statut" name="statut" value={status} options={CONTACT_STATUSES} empty="Tous" />
        <button class="btn btn-outline">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <Empty>Aucun contact pour le moment. Les demandes envoyées depuis le site apparaîtront ici automatiquement.</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Entreprise</th>
                <th>Besoin</th>
                <th>Statut</th>
                <th>Dernier contact</th>
                <th>Prochaine action</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE_SIZE).map((r) => (
                <tr>
                  <td>
                    <a href={`/admin/crm/${r.id}`}>{r.name}</a>
                    <div class="small muted">{r.email}</div>
                  </td>
                  <td>{r.company}</td>
                  <td class="small">{r.need.slice(0, 80)}</td>
                  <td>
                    <Badge options={CONTACT_STATUSES} value={r.status} />
                  </td>
                  <td class="nowrap">{formatShortDate(r.last_contact_at)}</td>
                  <td class="small">
                    {r.next_action} {r.next_action_at ? <span class="muted">({formatShortDate(r.next_action_at)})</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={p} hasMore={rows.length > PAGE_SIZE} base={`/admin/crm${qs ? '?' + qs : ''}`} />
    </>,
    {
      actions: (
        <>
          <a href="/admin/crm/export.csv" class="btn btn-outline">Exporter en CSV</a>
          <a href="/admin/crm/nouveau" class="btn btn-primary">Nouveau contact</a>
        </>
      ),
    },
  );
});

/** Export CSV protégé (session administrateur requise). */
crmRoutes.get('/crm/export.csv', async (c) => {
  const { db } = c.get('deps');
  const rows = await db.all<ContactRow>('SELECT * FROM contacts ORDER BY id');
  const csv = toCsv(
    ['ID', 'Nom', 'Entreprise', 'E-mail', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'SIREN', 'Type', 'Source', 'Besoin', 'Budget', 'Statut', 'Dernier contact', 'Prochaine action', 'Date prochaine action', 'Consentement prospection', 'Créé le'],
    rows.map((r) => [
      r.id, r.name, r.company, r.email, r.phone, r.address, r.postal_code, r.city, r.siren, r.customer_type,
      labelOf(CONTACT_SOURCES, r.source), r.need, r.budget, labelOf(CONTACT_STATUSES, r.status), r.last_contact_at ?? '', r.next_action, r.next_action_at ?? '',
      r.consent_marketing ? 'oui' : 'non', r.created_at,
    ]),
  );
  await audit(db, c.get('user')!.id, 'export-csv-contacts');
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
  });
});

crmRoutes.get('/crm/nouveau', (c) => page(c, 'Nouveau contact', <ContactForm c={{ source: 'telephone' }} csrf={c.get('csrf')} action="/admin/crm/nouveau" />));

async function saveContact(c: Ctx, id: number | null) {
  const f = await readForm(c);
  const data = Object.fromEntries(['name', 'company', 'email', 'phone', 'address', 'postal_code', 'city', 'siren', 'customer_type', 'source', 'need', 'budget', 'status', 'next_action', 'next_action_at', 'notes'].map((k) => [k, f.get(k)]));
  data.siren = (data.siren ?? '').replace(/\s/g, '');
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) {
    return page(c, id ? 'Modifier le contact' : 'Nouveau contact', <ContactForm c={data as Partial<ContactRow>} csrf={c.get('csrf')} action={id ? `/admin/crm/${id}` : '/admin/crm/nouveau'} />, {
      error: parsed.error.issues.map((i) => i.message).join(' '),
      status: 422,
    });
  }
  const d = parsed.data;
  const { db } = c.get('deps');
  const now = new Date().toISOString();
  const vals = [d.name, d.company, d.email, d.phone, d.address, d.postal_code, d.city, d.siren, d.customer_type, d.source, d.need, d.budget, d.status, d.next_action, d.next_action_at || null, d.notes];
  if (id) {
    const before = await db.get<{ status: string }>('SELECT status FROM contacts WHERE id = ?', [id]);
    await db.run(
      `UPDATE contacts SET name=?, company=?, email=?, phone=?, address=?, postal_code=?, city=?, siren=?, customer_type=?, source=?, need=?, budget=?, status=?, next_action=?, next_action_at=?, notes=?, updated_at=? WHERE id=?`,
      [...vals, now, id],
    );
    if (before && before.status !== d.status) await addContactEvent(c.get('deps'), id, 'systeme', `Statut : ${labelOf(CONTACT_STATUSES, before.status)} → ${labelOf(CONTACT_STATUSES, d.status)}`, c.get('user')!.name);
    return c.redirect(`/admin/crm/${id}?ok=saved`, 303);
  }
  const r = await db.run(
    `INSERT INTO contacts (name, company, email, phone, address, postal_code, city, siren, customer_type, source, need, budget, status, next_action, next_action_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...vals, now, now],
  );
  return c.redirect(`/admin/crm/${r.lastId}?ok=created`, 303);
}

crmRoutes.post('/crm/nouveau', (c) => saveContact(c, null));
crmRoutes.post('/crm/:id', (c) => saveContact(c, idParam(c)));

crmRoutes.get('/crm/:id', async (c) => {
  const { db } = c.get('deps');
  const id = idParam(c);
  const ct = await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [id]);
  if (!ct) return c.notFound();
  const [events, requests, quotes, orders, invoices, projects] = await Promise.all([
    db.all<{ id: number; kind: string; body: string; author: string; created_at: string }>('SELECT * FROM contact_events WHERE contact_id = ? ORDER BY created_at DESC', [id]),
    db.all<RequestRow>('SELECT * FROM quote_requests WHERE contact_id = ? ORDER BY created_at DESC', [id]),
    db.all<{ id: number; number: string | null; title: string; status: string; created_at: string }>('SELECT id, number, title, status, created_at FROM quotes WHERE contact_id = ? ORDER BY created_at DESC', [id]),
    db.all<{ id: number; number: string; status: string; description: string }>('SELECT id, number, status, description FROM print_orders WHERE contact_id = ? ORDER BY created_at DESC', [id]),
    db.all<{ id: number; number: string | null; type: string; status: string; total_ttc: number }>('SELECT id, number, type, status, total_ttc FROM invoices WHERE contact_id = ? ORDER BY created_at DESC', [id]),
    db.all<{ id: number; name: string; status: string }>('SELECT id, name, status FROM web_projects WHERE contact_id = ? ORDER BY created_at DESC', [id]),
  ]);
  const csrf = c.get('csrf');
  return page(
    c,
    ct.name + (ct.company ? ` — ${ct.company}` : ''),
    <div class="cols cols-3">
      <div>
        <ContactForm c={ct} csrf={csrf} action={`/admin/crm/${id}`} />
        <div class="panel">
          <h2>Historique des échanges</h2>
          <form method="post" action={`/admin/crm/${id}/evenement`} class="form-grid">
            <Csrf token={csrf} />
            <Sel label="Type" name="kind" options={EVENT_KINDS.filter((k) => k[0] !== 'systeme')} value="note" />
            <TA label="Contenu" name="body" rows={3} required max={5000} />
            <div class="form-actions">
              <button class="btn btn-outline">Ajouter à l’historique</button>
            </div>
          </form>
          <ul class="timeline" style="margin-top:1rem">
            {events.map((e) => (
              <li>
                <time>
                  {formatDateTime(e.created_at)} · {labelOf(EVENT_KINDS, e.kind)} · {e.author}
                </time>
                {e.body}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <div class="panel">
          <h2>Actions</h2>
          <div class="page-actions">
            <a class="btn btn-primary btn-sm" href={`/admin/devis/nouveau?contact=${id}`}>Créer un devis</a>
            <a class="btn btn-outline btn-sm" href={`/admin/commandes/nouvelle?contact=${id}`}>Commande d’impression</a>
            <a class="btn btn-outline btn-sm" href={`/admin/projets/nouveau?contact=${id}`}>Projet web</a>
            <a class="btn btn-outline btn-sm" href={`/admin/abonnements?contact=${id}#nouveau`}>Abonnement</a>
          </div>
          <dl class="kv" style="margin-top:1rem">
            <dt>Créé le</dt>
            <dd>{formatDateTime(ct.created_at)}</dd>
            <dt>Dernier contact</dt>
            <dd>{formatDateTime(ct.last_contact_at)}</dd>
            <dt>Prospection</dt>
            <dd>{ct.consent_marketing ? `Consentement donné le ${formatShortDate(ct.consent_at)}` : 'Pas de consentement : aucune communication commerciale'}</dd>
          </dl>
        </div>
        <div class="panel">
          <h2>Demandes</h2>
          {requests.length ? (
            <ul>
              {requests.map((r) => (
                <li>
                  <a href={`/admin/demandes/${r.id}`}>Demande n° {r.id}</a> — {PROJECT_TYPES.find((t) => t[0] === r.kind)?.[1] ?? r.kind} ({formatShortDate(r.created_at)})
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">Aucune.</p>
          )}
          <h2>Devis</h2>
          {quotes.length ? (
            <ul>
              {quotes.map((q) => (
                <li>
                  <a href={`/admin/devis/${q.id}`}>{q.number ?? `Brouillon n° ${q.id}`}</a> {q.title} <Badge options={QUOTE_STATUSES} value={q.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">Aucun.</p>
          )}
          <h2>Commandes</h2>
          {orders.length ? (
            <ul>
              {orders.map((o) => (
                <li>
                  <a href={`/admin/commandes/${o.id}`}>{o.number}</a> <Badge options={ORDER_STATUSES} value={o.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">Aucune.</p>
          )}
          <h2>Projets web</h2>
          {projects.length ? (
            <ul>
              {projects.map((p) => (
                <li>
                  <a href={`/admin/projets/${p.id}`}>{p.name}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">Aucun.</p>
          )}
          <h2>Factures</h2>
          {invoices.length ? (
            <ul>
              {invoices.map((i) => (
                <li>
                  <a href={`/admin/factures/${i.id}`}>{i.number ?? `Brouillon n° ${i.id}`}</a> {i.type === 'avoir' ? '(avoir)' : ''} {eur(i.total_ttc)} TTC <Badge options={INVOICE_STATUSES} value={i.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">Aucune.</p>
          )}
        </div>
        <div class="panel">
          <h2>Données personnelles</h2>
          <p class="small muted">Suppression définitive (droit à l’effacement). Impossible si le contact a des devis, commandes ou factures (obligations de conservation).</p>
          <ActionButton action={`/admin/crm/${id}/supprimer`} csrf={csrf} label="Supprimer ce contact" cls="btn-danger" confirm="Supprimer définitivement ce contact et son historique ?" />
        </div>
      </div>
    </div>,
  );
});

crmRoutes.post('/crm/:id/evenement', async (c) => {
  const id = idParam(c);
  const f = await readForm(c);
  const kind = f.get('kind');
  const body = f.get('body').slice(0, 5000);
  if (!body || !isOneOf(EVENT_KINDS, kind)) return c.redirect(`/admin/crm/${id}`, 303);
  await addContactEvent(c.get('deps'), id, kind, body, c.get('user')!.name);
  if (kind !== 'note') await c.get('deps').db.run('UPDATE contacts SET last_contact_at = ?, updated_at = ? WHERE id = ?', [new Date().toISOString(), new Date().toISOString(), id]);
  return c.redirect(`/admin/crm/${id}?ok=saved`, 303);
});

crmRoutes.post('/crm/:id/supprimer', async (c) => {
  const id = idParam(c);
  const { db } = c.get('deps');
  const linked = await db.get<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM quotes WHERE contact_id = ?) + (SELECT COUNT(*) FROM print_orders WHERE contact_id = ?) + (SELECT COUNT(*) FROM invoices WHERE contact_id = ?)
       + (SELECT COUNT(*) FROM web_projects WHERE contact_id = ?) + (SELECT COUNT(*) FROM subscriptions WHERE contact_id = ?) AS n`,
    [id, id, id, id, id],
  );
  if (linked?.n) return c.redirect(`/admin/crm/${id}`, 303);
  const files = await db.all<{ key: string }>("SELECT key FROM files WHERE owner_kind = 'request' AND owner_id IN (SELECT id FROM quote_requests WHERE contact_id = ?)", [id]);
  for (const f of files) await c.get('deps').storage.delete(f.key);
  await db.batch([
    { sql: "DELETE FROM files WHERE owner_kind = 'request' AND owner_id IN (SELECT id FROM quote_requests WHERE contact_id = ?)", params: [id] },
    { sql: 'DELETE FROM quote_requests WHERE contact_id = ?', params: [id] },
    { sql: 'DELETE FROM contacts WHERE id = ?', params: [id] },
  ]);
  await audit(db, c.get('user')!.id, 'suppression-contact', 'contact', id);
  return c.redirect('/admin/crm?ok=deleted', 303);
});

// ─── Demandes de devis ───

crmRoutes.get('/demandes', async (c) => {
  const { db } = c.get('deps');
  const status = c.req.query('statut') ?? '';
  const p = pageNum(c);
  const rows = await db.all<RequestRow & { name: string; company: string }>(
    `SELECT r.*, ct.name, ct.company FROM quote_requests r LEFT JOIN contacts ct ON ct.id = r.contact_id
     ${isOneOf(REQUEST_STATUSES, status) ? 'WHERE r.status = ?' : "WHERE r.status <> 'archivee'"} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...(isOneOf(REQUEST_STATUSES, status) ? [status] : []), PAGE_SIZE + 1, (p - 1) * PAGE_SIZE],
  );
  return page(
    c,
    'Demandes de devis',
    <>
      <form class="filters" method="get">
        <Sel label="Statut" name="statut" value={status} options={REQUEST_STATUSES} empty="Non archivées" />
        <button class="btn btn-outline">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <Empty>Aucune demande. Elles arrivent ici depuis le formulaire de devis du site.</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>N°</th>
                <th>Reçue le</th>
                <th>Contact</th>
                <th>Prestation</th>
                <th>Estimation</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE_SIZE).map((r) => {
                const est = r.estimate ? (JSON.parse(r.estimate) as PublicEstimate) : null;
                return (
                  <tr>
                    <td>
                      <a href={`/admin/demandes/${r.id}`}>{r.id}</a>
                    </td>
                    <td class="nowrap">{formatDateTime(r.created_at)}</td>
                    <td>
                      {r.name}
                      {r.company ? <div class="small muted">{r.company}</div> : null}
                    </td>
                    <td>{PROJECT_TYPES.find((t) => t[0] === r.kind)?.[1] ?? r.kind}</td>
                    <td class="num">{est?.totalHt != null ? `${formatEuros(est.totalHt)} HT` : est ? 'Sur devis' : '—'}</td>
                    <td>
                      <Badge options={REQUEST_STATUSES} value={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={p} hasMore={rows.length > PAGE_SIZE} base={`/admin/demandes${status ? `?statut=${status}` : ''}`} />
    </>,
  );
});

const ANSWER_LABELS: Record<string, string> = {
  activity: 'Activité',
  description: 'Description du projet',
  service_name: 'Offre choisie',
  pages: 'Pages souhaitées',
  has_site: 'Site existant',
  site_url: 'Adresse du site actuel',
  goal: 'Objectif commercial',
  has_domain: 'Nom de domaine existant',
  texts: 'Textes disponibles',
  photos: 'Photos disponibles',
  budget: 'Budget indicatif',
  deadline: 'Délai souhaité',
  product_name: 'Produit',
  want_design: 'Création graphique souhaitée',
  service_options: 'Options choisies',
  options_notes: 'Précisions sur les options',
  customer_type: 'Type de client',
  postal_code: 'Code postal',
  city: 'Ville',
  contact_pref: 'Préférence de contact',
  marketing: 'Accepte la prospection',
  config_issue: 'Problème de configuration',
};

crmRoutes.get('/demandes/:id', async (c) => {
  const { db } = c.get('deps');
  const r = await db.get<RequestRow>('SELECT * FROM quote_requests WHERE id = ?', [idParam(c)]);
  if (!r) return c.notFound();
  const ct = r.contact_id ? await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [r.contact_id]) : undefined;
  const answers = JSON.parse(r.answers) as Record<string, unknown>;
  const files = JSON.parse(r.files) as { key: string; name: string; size: number }[];
  const config = r.print_config ? (JSON.parse(r.print_config) as PrintConfig) : null;
  const est = r.estimate ? (JSON.parse(r.estimate) as PublicEstimate) : null;
  const order = await db.get<{ id: number; number: string }>("SELECT id, number FROM print_orders WHERE json_extract(config, '$.request_id') = ?", [r.id]);
  const csrf = c.get('csrf');
  return page(
    c,
    `Demande n° ${r.id}`,
    <div class="cols cols-3">
      <div>
        <div class="panel">
          <h2>{PROJECT_TYPES.find((t) => t[0] === r.kind)?.[1] ?? r.kind}</h2>
          <dl class="kv">
            {Object.entries(ANSWER_LABELS).map(([k, label]) => {
              const v = answers[k];
              const text = Array.isArray(v) ? v.join(', ') : v === '1' ? 'Oui' : typeof v === 'string' ? v : '';
              return text ? (
                <>
                  <dt>{label}</dt>
                  <dd>{text}</dd>
                </>
              ) : null;
            })}
          </dl>
        </div>
        {config && (
          <div class="panel">
            <h2>Configuration d’impression</h2>
            <p>{describeConfig(config)}</p>
            {est && (
              <p>
                Estimation affichée au client : {est.totalHt != null ? `${formatEuros(est.totalHt)} HT` : 'sur devis'} — <span class="muted">{est.message}</span>
              </p>
            )}
            {order && (
              <p>
                Commande créée : <a href={`/admin/commandes/${order.id}`}>{order.number}</a>
              </p>
            )}
          </div>
        )}
        <div class="panel">
          <h2>Fichiers joints</h2>
          {files.length ? (
            <ul>
              {files.map((f) => (
                <li>
                  <a href={`/admin/fichiers/${f.key}`}>{f.name}</a> <span class="muted small">({(f.size / 1024).toFixed(0)} Ko)</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">Aucun fichier.</p>
          )}
        </div>
      </div>
      <div>
        <div class="panel">
          <h2>Contact</h2>
          {ct ? (
            <dl class="kv">
              <dt>Nom</dt>
              <dd>
                <a href={`/admin/crm/${ct.id}`}>{ct.name}</a>
              </dd>
              <dt>Entreprise</dt>
              <dd>{ct.company || '—'}</dd>
              <dt>E-mail</dt>
              <dd>{ct.email ? <a href={`mailto:${ct.email}`}>{ct.email}</a> : '—'}</dd>
              <dt>Téléphone</dt>
              <dd>{ct.phone ? <a href={`tel:${ct.phone}`}>{ct.phone}</a> : '—'}</dd>
            </dl>
          ) : (
            <p class="muted">Contact supprimé.</p>
          )}
        </div>
        <div class="panel">
          <h2>Traitement</h2>
          <p>
            Reçue le {formatDateTime(r.created_at)} — <Badge options={REQUEST_STATUSES} value={r.status} />
          </p>
          <div class="page-actions">
            {ct && <a class="btn btn-primary btn-sm" href={`/admin/devis/nouveau?demande=${r.id}`}>Préparer le devis</a>}
            {ct && r.kind === 'site' && <a class="btn btn-outline btn-sm" href={`/admin/projets/nouveau?contact=${ct.id}&demande=${r.id}`}>Créer le projet web</a>}
          </div>
          <form method="post" action={`/admin/demandes/${r.id}/statut`} class="form-grid" style="margin-top:1rem">
            <Csrf token={csrf} />
            <Sel label="Changer le statut" name="status" options={REQUEST_STATUSES} value={r.status} />
            <div class="form-actions">
              <button class="btn btn-outline btn-sm">Mettre à jour</button>
            </div>
          </form>
        </div>
      </div>
    </div>,
  );
});

crmRoutes.post('/demandes/:id/statut', async (c) => {
  const f = await readForm(c);
  const st = f.get('status');
  if (isOneOf(REQUEST_STATUSES, st)) await c.get('deps').db.run('UPDATE quote_requests SET status = ? WHERE id = ?', [st, idParam(c)]);
  return c.redirect(`/admin/demandes/${idParam(c)}?ok=status`, 303);
});

/** Téléchargement des fichiers privés : administrateurs uniquement, toujours en pièce jointe. */
crmRoutes.get('/fichiers/:key', async (c) => {
  const key = c.req.param('key');
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(key)) return c.notFound();
  const meta = await c.get('deps').db.get<{ name: string; type: string }>('SELECT name, type FROM files WHERE key = ?', [key]);
  const file = meta ? await c.get('deps').storage.get(key) : null;
  if (!meta || !file) return c.notFound();
  return c.body(file.body as Uint8Array<ArrayBuffer>, 200, {
    'Content-Type': meta.type,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
});

export { Check };
