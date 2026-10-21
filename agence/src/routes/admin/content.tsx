import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../../app/context';
import { idParam, page, readForm, type FormData } from './helpers';
import { ActionButton, Badge, Check, Csrf, Empty, F, Money, Sel, TA, eur } from '../../web/admin/ui';
import { PUBLISH_STATUSES, SUBSCRIPTION_STATUSES, isOneOf } from '../../domain/statuses';
import { slugify, wordCount } from '../../domain/text';
import { formatShortDate, isIsoDate } from '../../domain/dates';
import type { ContactRow, ServiceRow } from '../../repo/types';

/**
 * Petit moteur générique d'édition de contenus (liste + formulaire), décrit par des champs.
 * Toutes les valeurs sont écrites avec des requêtes paramétrées ; les noms de colonnes proviennent
 * exclusivement des définitions ci-dessous (jamais de l'utilisateur).
 */
type FieldType = 'text' | 'textarea' | 'markdown' | 'number' | 'select' | 'checkbox' | 'date' | 'slug';
interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  max?: number;
  options?: readonly (readonly [string, string])[];
  help?: string;
  rows?: number;
}
interface Resource {
  path: string;
  table: string;
  title: string;
  singular: string;
  fields: FieldDef[];
  columns: { label: string; value: (r: Record<string, unknown>) => unknown }[];
  orderBy: string;
  slugFrom?: string;
  publicPath?: (r: Record<string, unknown>) => string | null;
  validate?: (data: Record<string, unknown>) => string | null;
  intro?: string;
}

const VISUALS = ['site-menuisier', 'site-sante', 'site-paysagiste', 'identite-cafe', 'print-salon', 'social-resto', 'brochure-gite', 'vitrine-commerce', 'site-agence'].map((v) => [v, v] as const);
const statusCol = { label: 'Statut', value: (r: Record<string, unknown>) => <Badge options={PUBLISH_STATUSES} value={String(r.status)} /> };

const RESOURCES: Resource[] = [
  {
    path: 'realisations',
    table: 'portfolio_items',
    title: 'Réalisations',
    singular: 'réalisation',
    intro: 'Signalez toujours un projet fictif comme « concept » : il est alors présenté avec la mention « Concept de démonstration ». N’ajoutez de vraies références qu’avec l’accord écrit du client.',
    orderBy: 'sort_order, id',
    slugFrom: 'title',
    publicPath: (r) => `/realisations/${r.slug}`,
    fields: [
      { name: 'title', label: 'Titre', type: 'text', required: true, max: 120 },
      { name: 'slug', label: 'Identifiant d’URL', type: 'slug', max: 80 },
      { name: 'category', label: 'Catégorie', type: 'text', required: true, max: 60 },
      { name: 'is_concept', label: 'Projet fictif / concept de démonstration', type: 'checkbox' },
      { name: 'client_label', label: 'Mention client', type: 'text', max: 160, help: 'Ex. « Projet fictif — concept de démonstration » ou nom du client réel (avec son accord).' },
      { name: 'summary', label: 'Résumé', type: 'textarea', max: 400, rows: 2 },
      { name: 'client_type', label: 'Type de client', type: 'text', max: 120, help: 'Ex. « Artisan plombier », « Boulangerie (ouverture) ».' },
      { name: 'need', label: 'Besoin principal (une phrase)', type: 'text', max: 200 },
      { name: 'services', label: 'Prestations réalisées (une par ligne : /chemin | Libellé)', type: 'textarea', max: 1500, rows: 4, help: 'Ex. « /vitrophanie-vitrine-commerce | Vitrophanie de vitrine ». Chaque ligne devient un lien vers la page de la prestation.' },
      { name: 'objectives', label: 'Objectifs (un par ligne)', type: 'textarea', max: 1500, rows: 3, help: 'Les objectifs du projet, pas des résultats : n’indiquez de résultats que s’ils sont réels et mesurés.' },
      { name: 'before_label', label: 'Légende « avant »', type: 'text', max: 200, help: 'Remplie avec la légende « après », elle active le comparatif avant / après.' },
      { name: 'after_label', label: 'Légende « après »', type: 'text', max: 200 },
      { name: 'challenge', label: 'Le besoin', type: 'textarea', max: 3000 },
      { name: 'solution', label: 'Notre réponse', type: 'textarea', max: 3000 },
      { name: 'deliverables', label: 'Livrables (un par ligne)', type: 'textarea', max: 2000 },
      { name: 'outcome', label: 'Résultats', type: 'textarea', max: 2000, help: 'N’indiquez que des résultats réels et vérifiables.' },
      { name: 'testimonial', label: 'Témoignage du client (réel uniquement)', type: 'textarea', max: 1200, rows: 3, help: 'Jamais pour un concept. Recopiez mot pour mot les propos du client.' },
      { name: 'testimonial_author', label: 'Auteur du témoignage', type: 'text', max: 160, help: 'Ex. « Marie D., gérante » (selon ce que le client a autorisé).' },
      { name: 'testimonial_authorized', label: 'J’ai l’autorisation écrite du client de publier ce témoignage et son nom', type: 'checkbox' },
      { name: 'visual', label: 'Visuel', type: 'select', options: VISUALS },
      { name: 'accent', label: 'Couleur d’accent (#RRGGBB)', type: 'text', max: 7 },
      { name: 'is_case_study', label: 'Afficher aussi dans les études de cas', type: 'checkbox' },
      { name: 'featured', label: 'Mettre en avant sur l’accueil', type: 'checkbox' },
      { name: 'status', label: 'Statut', type: 'select', options: PUBLISH_STATUSES },
      { name: 'sort_order', label: 'Ordre', type: 'number' },
    ],
    columns: [
      { label: 'Ordre', value: (r) => r.sort_order },
      { label: 'Catégorie', value: (r) => r.category },
      { label: 'Concept', value: (r) => (r.is_concept ? 'Oui' : 'Non') },
      statusCol,
    ],
    validate: (d) => {
      if (d.accent && !/^#[0-9a-fA-F]{6}$/.test(String(d.accent))) return 'Couleur invalide (format #RRGGBB).';
      if (d.is_concept && String(d.testimonial ?? '').trim()) return 'Un projet fictif (concept) ne peut pas afficher de témoignage.';
      if (String(d.testimonial ?? '').trim() && !d.testimonial_authorized) return 'Cochez l’autorisation écrite du client avant de publier un témoignage (ou laissez le champ vide).';
      return null;
    },
  },
  {
    path: 'articles',
    table: 'posts',
    title: 'Blog',
    singular: 'article',
    orderBy: 'COALESCE(published_at, created_at) DESC',
    slugFrom: 'title',
    publicPath: (r) => `/blog/${r.slug}`,
    intro: 'Mise en forme : ## titre, ### sous-titre, - liste, **gras**, *italique*, [lien](https://…). Le HTML n’est pas accepté.',
    fields: [
      { name: 'title', label: 'Titre', type: 'text', required: true, max: 160 },
      { name: 'slug', label: 'Identifiant d’URL', type: 'slug', max: 80 },
      { name: 'category', label: 'Catégorie', type: 'text', max: 60 },
      { name: 'excerpt', label: 'Chapô (résumé)', type: 'textarea', max: 400, rows: 2, required: true },
      { name: 'body', label: 'Contenu', type: 'markdown', max: 40000, rows: 18, required: true },
      { name: 'meta_title', label: 'Titre SEO (facultatif)', type: 'text', max: 70 },
      { name: 'meta_description', label: 'Méta-description (facultative)', type: 'text', max: 160 },
      { name: 'published_at', label: 'Date de publication', type: 'date' },
      { name: 'status', label: 'Statut', type: 'select', options: PUBLISH_STATUSES },
    ],
    columns: [
      { label: 'Publication', value: (r) => formatShortDate(r.published_at as string) },
      { label: 'Catégorie', value: (r) => r.category },
      statusCol,
    ],
    validate: (d) => (d.status === 'published' && !d.published_at ? 'Indiquez une date de publication.' : null),
  },
  {
    path: 'faq',
    table: 'faqs',
    title: 'FAQ',
    singular: 'question',
    orderBy: 'topic, sort_order, id',
    fields: [
      { name: 'question', label: 'Question', type: 'text', required: true, max: 200 },
      { name: 'answer', label: 'Réponse', type: 'textarea', required: true, max: 2000, rows: 4 },
      { name: 'topic', label: 'Thème', type: 'select', options: [['general', 'Général (accueil, packs)'], ['impression', 'Impression']] },
      { name: 'status', label: 'Statut', type: 'select', options: PUBLISH_STATUSES },
      { name: 'sort_order', label: 'Ordre', type: 'number' },
    ],
    columns: [
      { label: 'Thème', value: (r) => r.topic },
      { label: 'Ordre', value: (r) => r.sort_order },
      statusCol,
    ],
  },
  {
    path: 'pages-locales',
    table: 'local_pages',
    title: 'Pages locales',
    singular: 'page locale',
    orderBy: 'city',
    slugFrom: 'title',
    publicPath: (r) => `/agence-web/${r.slug}`,
    intro:
      'Créez une page locale uniquement si elle apporte une information réelle et propre au lieu (clients accompagnés sur place, déplacements, particularités locales). Une page ne peut être publiée qu’avec au moins 300 mots de contenu original. Ne dupliquez pas la même page pour plusieurs villes.',
    fields: [
      { name: 'city', label: 'Ville / zone', type: 'text', required: true, max: 80 },
      { name: 'title', label: 'Titre', type: 'text', required: true, max: 120 },
      { name: 'slug', label: 'Identifiant d’URL', type: 'slug', max: 80 },
      { name: 'intro', label: 'Introduction', type: 'textarea', max: 600, rows: 2 },
      { name: 'body', label: 'Contenu (mise en forme comme le blog)', type: 'markdown', max: 20000, rows: 14 },
      { name: 'meta_description', label: 'Méta-description', type: 'text', max: 160 },
      { name: 'status', label: 'Statut', type: 'select', options: PUBLISH_STATUSES },
    ],
    columns: [
      { label: 'Ville', value: (r) => r.city },
      { label: 'Mots', value: (r) => wordCount(String(r.body ?? '')) },
      statusCol,
    ],
    validate: (d) => (d.status === 'published' && wordCount(String(d.body ?? '')) < 300 ? 'Publication refusée : au moins 300 mots de contenu original sont nécessaires.' : null),
  },
  {
    path: 'redirections',
    table: 'redirects',
    title: 'Redirections',
    singular: 'redirection',
    orderBy: 'from_path',
    intro: 'Redirigez les anciennes adresses (ex. après une refonte) vers les nouvelles pages, pour ne pas perdre les visiteurs ni le référencement.',
    fields: [
      { name: 'from_path', label: 'Ancienne adresse (chemin)', type: 'text', required: true, max: 300, help: 'Ex. /ancienne-page' },
      { name: 'to_path', label: 'Nouvelle adresse', type: 'text', required: true, max: 300, help: 'Chemin (/nouvelle-page) ou URL complète.' },
      { name: 'code', label: 'Type', type: 'select', options: [['301', '301 — définitive'], ['302', '302 — temporaire']] },
    ],
    columns: [
      { label: 'Vers', value: (r) => r.to_path },
      { label: 'Code', value: (r) => r.code },
    ],
    validate: (d) => {
      const from = String(d.from_path);
      const to = String(d.to_path);
      if (!/^\/[^\s?#]*$/.test(from) || from.startsWith('/admin') || from === '/') return 'Ancienne adresse invalide (chemin commençant par /, hors /admin).';
      if (!/^(\/[^\s]*|https?:\/\/\S+)$/.test(to)) return 'Nouvelle adresse invalide.';
      if (from === to) return 'Les deux adresses sont identiques.';
      return null;
    },
  },
];

const titleOf = (_res: Resource, r: Record<string, unknown>) => String(r.title ?? r.question ?? r.from_path ?? `#${r.id}`);

function ResourceForm({ res, r, c, action }: { res: Resource; r: Record<string, unknown>; c: Ctx; action: string }) {
  return (
    <form method="post" action={action} class="panel">
      <Csrf token={c.get('csrf')} />
      <div class="form-grid">
        {res.fields.map((f) => {
          const v = r[f.name];
          switch (f.type) {
            case 'textarea':
            case 'markdown':
              return <TA label={f.label} name={f.name} value={v == null ? '' : String(v)} rows={f.rows ?? 4} required={f.required} max={f.max} help={f.help} />;
            case 'select':
              return <Sel label={f.label} name={f.name} value={v == null ? f.options![0]![0] : String(v)} options={f.options!} help={f.help} />;
            case 'checkbox':
              return <Check label={f.label} name={f.name} checked={!!v} help={f.help} />;
            case 'date':
              return <F label={f.label} name={f.name} type="date" value={v ? String(v).slice(0, 10) : ''} help={f.help} />;
            case 'number':
              return <F label={f.label} name={f.name} type="number" value={v == null ? 100 : Number(v)} help={f.help} />;
            case 'slug':
              return <F label={f.label} name={f.name} value={v == null ? '' : String(v)} max={f.max} help="Vide = généré depuis le titre. Lettres minuscules, chiffres et tirets." />;
            default:
              return <F label={f.label} name={f.name} value={v == null ? '' : String(v)} required={f.required} max={f.max} help={f.help} />;
          }
        })}
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  );
}

function collect(res: Resource, f: FormData): { data: Record<string, unknown>; error: string | null } {
  const data: Record<string, unknown> = {};
  for (const fd of res.fields) {
    const raw = f.get(fd.name);
    switch (fd.type) {
      case 'checkbox':
        data[fd.name] = f.bool(fd.name) ? 1 : 0;
        break;
      case 'number':
        data[fd.name] = fd.name === 'code' ? Number(raw) : (f.int(fd.name) ?? 100);
        break;
      case 'date':
        data[fd.name] = isIsoDate(raw) ? `${raw}T08:00:00.000Z` : null;
        break;
      case 'select':
        data[fd.name] = fd.options!.some((o) => o[0] === raw) ? (fd.name === 'code' ? Number(raw) : raw) : fd.options![0]![0];
        break;
      default:
        data[fd.name] = fd.max ? raw.slice(0, fd.max) : raw;
    }
    if (fd.required && !String(data[fd.name] ?? '').trim()) return { data, error: `Le champ « ${fd.label} » est obligatoire.` };
  }
  if (res.slugFrom) {
    const slug = String(data.slug || slugify(String(data[res.slugFrom] ?? '')));
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) return { data, error: 'Identifiant d’URL invalide.' };
    data.slug = slug;
  }
  return { data, error: res.validate?.(data) ?? null };
}

export const contentRoutes = new Hono<AppEnv>();

for (const res of RESOURCES) {
  const base = `/contenus/${res.path}`;
  contentRoutes.get(base, async (c) => {
    const rows = await c.get('deps').db.all<Record<string, unknown>>(`SELECT * FROM ${res.table} ORDER BY ${res.orderBy}`);
    return page(
      c,
      res.title,
      <>
        {res.intro && <p class="muted">{res.intro}</p>}
        {rows.length === 0 ? (
          <Empty>Aucun élément.</Empty>
        ) : (
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>Titre</th>
                  {res.columns.map((col) => (
                    <th>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr>
                    <td>
                      <a href={`/admin${base}/${r.id}`}>{titleOf(res, r)}</a>
                    </td>
                    {res.columns.map((col) => (
                      <td>{col.value(r) as never}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>,
      { actions: <a class="btn btn-primary" href={`/admin${base}/nouveau`}>Ajouter : {res.singular}</a> },
    );
  });

  contentRoutes.get(`${base}/nouveau`, (c) => page(c, `Nouveau : ${res.singular}`, <ResourceForm res={res} r={{ is_concept: 1, status: 'draft' }} c={c} action={`/admin${base}/nouveau`} />));

  const save = async (c: Ctx, id: number | null) => {
    const f = await readForm(c);
    const { data, error } = collect(res, f);
    if (error) return page(c, id ? `Modifier : ${res.singular}` : `Nouveau : ${res.singular}`, <ResourceForm res={res} r={{ ...data, id }} c={c} action={id ? `/admin${base}/${id}` : `/admin${base}/nouveau`} />, { error, status: 422 });
    const cols = Object.keys(data);
    const now = new Date().toISOString();
    const { db } = c.get('deps');
    try {
      if (id) {
        await db.run(`UPDATE ${res.table} SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [...cols.map((k) => data[k] as string | number | null), now, id]);
        return c.redirect(`/admin${base}/${id}?ok=saved`, 303);
      }
      const r = await db.run(`INSERT INTO ${res.table} (${cols.join(', ')}, created_at, updated_at) VALUES (${cols.map(() => '?').join(', ')}, ?, ?)`, [...cols.map((k) => data[k] as string | number | null), now, now]);
      return c.redirect(`/admin${base}/${r.lastId}?ok=created`, 303);
    } catch {
      return page(c, 'Doublon', <ResourceForm res={res} r={{ ...data, id }} c={c} action={id ? `/admin${base}/${id}` : `/admin${base}/nouveau`} />, { error: 'Un élément avec le même identifiant existe déjà.', status: 409 });
    }
  };

  contentRoutes.post(`${base}/nouveau`, (c) => save(c, null));
  contentRoutes.get(`${base}/:id`, async (c) => {
    const r = await c.get('deps').db.get<Record<string, unknown>>(`SELECT * FROM ${res.table} WHERE id = ?`, [idParam(c)]);
    if (!r) return c.notFound();
    const pub = res.publicPath && r.status === 'published' ? res.publicPath(r) : null;
    return page(
      c,
      titleOf(res, r),
      <>
        <ResourceForm res={res} r={r} c={c} action={`/admin${base}/${r.id}`} />
        <ActionButton action={`/admin${base}/${r.id}/supprimer`} csrf={c.get('csrf')} label="Supprimer" cls="btn-danger" confirm="Supprimer définitivement cet élément ?" />
      </>,
      { actions: pub ? <a class="btn btn-outline" href={pub} target="_blank">Voir sur le site</a> : undefined },
    );
  });
  contentRoutes.post(`${base}/:id`, (c) => save(c, idParam(c)));
  contentRoutes.post(`${base}/:id/supprimer`, async (c) => {
    await c.get('deps').db.run(`DELETE FROM ${res.table} WHERE id = ?`, [idParam(c)]);
    return c.redirect(`/admin${base}?ok=deleted`, 303);
  });
}

// ─── Abonnements (maintenance, SEO…) ───

contentRoutes.get('/abonnements', async (c) => {
  const { db } = c.get('deps');
  const rows = await db.all<{ id: number; label: string; monthly_ht: number; start_date: string; end_date: string | null; status: string; name: string; contact_id: number }>(
    'SELECT s.*, ct.name FROM subscriptions s JOIN contacts ct ON ct.id = s.contact_id ORDER BY s.status, s.start_date DESC',
  );
  const contacts = await db.all<ContactRow>('SELECT id, name, company FROM contacts ORDER BY name LIMIT 500');
  const services = await db.all<ServiceRow>("SELECT slug, name, price_ht FROM services WHERE billing = 'monthly' ORDER BY sort_order");
  const mrr = rows.filter((r) => r.status === 'actif').reduce((s, r) => s + r.monthly_ht, 0);
  return page(
    c,
    'Abonnements',
    <>
      <p>
        Revenu mensuel récurrent (abonnements actifs) : <strong>{eur(mrr)} HT</strong>
      </p>
      {rows.length === 0 ? (
        <Empty>Aucun abonnement enregistré.</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Client</th>
                <th>Abonnement</th>
                <th class="num">Mensuel HT</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr>
                  <td>
                    <a href={`/admin/crm/${r.contact_id}`}>{r.name}</a>
                  </td>
                  <td>{r.label}</td>
                  <td class="num">{eur(r.monthly_ht)}</td>
                  <td>{formatShortDate(r.start_date)}</td>
                  <td>{formatShortDate(r.end_date)}</td>
                  <td>
                    <Badge options={SUBSCRIPTION_STATUSES} value={r.status} />
                  </td>
                  <td>
                    <form method="post" action={`/admin/abonnements/${r.id}/statut`} class="inline-form">
                      <Csrf token={c.get('csrf')} />
                      <select name="status" aria-label="Statut">
                        {SUBSCRIPTION_STATUSES.map(([v, l]) => (
                          <option value={v} selected={v === r.status}>
                            {l}
                          </option>
                        ))}
                      </select>{' '}
                      <button class="btn btn-outline btn-sm">OK</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form method="post" action="/admin/abonnements" class="panel" id="nouveau" style="margin-top:1.25rem">
        <Csrf token={c.get('csrf')} />
        <h2>Nouvel abonnement</h2>
        <div class="form-grid">
          <Sel label="Client" name="contact_id" required value={c.req.query('contact') ?? ''} options={contacts.map((x) => [String(x.id), `${x.name}${x.company ? ` — ${x.company}` : ''}`] as const)} empty="Choisir…" />
          <Sel label="Prestation" name="service_slug" options={services.map((x) => [x.slug, x.name] as const)} empty="Autre" />
          <F label="Libellé" name="label" required max={160} />
          <Money label="Montant mensuel HT" name="monthly_ht" cents={null} required />
          <F label="Date de début" name="start_date" type="date" required />
          <F label="Date de fin (facultatif)" name="end_date" type="date" />
          <TA label="Notes (durée d’engagement, préavis…)" name="notes" rows={2} max={2000} />
        </div>
        <div class="form-actions">
          <button class="btn btn-primary">Ajouter</button>
        </div>
      </form>
    </>,
  );
});

contentRoutes.post('/abonnements', async (c) => {
  const f = await readForm(c);
  const { db } = c.get('deps');
  const ct = await db.get<{ id: number }>('SELECT id FROM contacts WHERE id = ?', [f.int('contact_id') ?? 0]);
  const amount = f.money('monthly_ht');
  const start = f.get('start_date');
  const end = f.get('end_date');
  if (!ct || !f.get('label') || amount == null || amount <= 0 || !isIsoDate(start) || (end && !isIsoDate(end))) {
    return page(c, 'Abonnement', <div class="panel"><p>Client, libellé, montant et date de début sont obligatoires.</p><a class="btn btn-outline" href="/admin/abonnements">Retour</a></div>, { status: 422 });
  }
  const now = new Date().toISOString();
  await db.run('INSERT INTO subscriptions (contact_id, service_slug, label, monthly_ht, start_date, end_date, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
    ct.id, f.get('service_slug').slice(0, 80), f.get('label').slice(0, 160), amount, start, end || null, 'actif', f.get('notes').slice(0, 2000), now, now,
  ]);
  return c.redirect('/admin/abonnements?ok=created', 303);
});

contentRoutes.post('/abonnements/:id/statut', async (c) => {
  const f = await readForm(c);
  if (isOneOf(SUBSCRIPTION_STATUSES, f.get('status'))) await c.get('deps').db.run('UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?', [f.get('status'), new Date().toISOString(), idParam(c)]);
  return c.redirect('/admin/abonnements?ok=status', 303);
});
