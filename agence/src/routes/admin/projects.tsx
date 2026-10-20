import { Hono } from 'hono';
import type { AppEnv } from '../../app/context';
import { idParam, page, readForm } from './helpers';
import { ActionButton, Badge, Csrf, Empty, F, Sel, TA } from '../../web/admin/ui';
import { ACCEPTANCE_STATUSES, PROJECT_STATUSES, isOneOf } from '../../domain/statuses';
import type { ContactRow, ProjectRow, QuoteRow } from '../../repo/types';
import { formatDateTime, formatShortDate, isIsoDate, todayParis } from '../../domain/dates';
import { SECURITY_CHECKLIST, SEO_CHECKLIST, checklistProgress, parseChecklist, type ChecklistItem, type ChecklistState } from '../../domain/checklists';
import { randomToken } from '../../lib/crypto';
import { addContactEvent, siteLink } from '../../services/requests';

export const projectRoutes = new Hono<AppEnv>();

const SECRET_HINT = /(mot de passe|password|passwd|mdp|api[_ -]?key|token|secret)\s*[:=]/i;

projectRoutes.get('/projets', async (c) => {
  const rows = await c.get('deps').db.all<ProjectRow & { cname: string; company: string }>(
    "SELECT p.*, ct.name AS cname, ct.company FROM web_projects p JOIN contacts ct ON ct.id = p.contact_id ORDER BY CASE WHEN p.status = 'archive' THEN 1 ELSE 0 END, p.due_date IS NULL, p.due_date",
  );
  const today = todayParis();
  return page(
    c,
    'Projets web',
    rows.length === 0 ? (
      <Empty>Aucun projet. Créez-en un depuis une fiche contact, une demande ou un devis accepté.</Empty>
    ) : (
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Projet</th>
              <th>Client</th>
              <th>Statut</th>
              <th>Recette</th>
              <th>Livraison prévue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const late = p.due_date && p.due_date < today && ['brief', 'conception', 'developpement', 'recette'].includes(p.status);
              return (
                <tr class={late ? 'row-warn' : ''}>
                  <td>
                    <a href={`/admin/projets/${p.id}`}>{p.name}</a>
                  </td>
                  <td>
                    {p.cname}
                    {p.company ? <div class="small muted">{p.company}</div> : null}
                  </td>
                  <td>
                    <Badge options={PROJECT_STATUSES} value={p.status} />
                  </td>
                  <td>
                    <Badge options={ACCEPTANCE_STATUSES} value={p.acceptance_status} />
                  </td>
                  <td class="nowrap">
                    {formatShortDate(p.due_date)} {late ? <strong>(en retard)</strong> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ),
    { actions: <a href="/admin/projets/nouveau" class="btn btn-primary">Nouveau projet</a> },
  );
});

projectRoutes.get('/projets/nouveau', async (c) => {
  const { db } = c.get('deps');
  const contacts = await db.all<ContactRow>('SELECT id, name, company FROM contacts ORDER BY name LIMIT 500');
  return page(
    c,
    'Nouveau projet web',
    <form method="post" action="/admin/projets/nouveau" class="panel">
      <Csrf token={c.get('csrf')} />
      <input type="hidden" name="quote_id" value={c.req.query('devis') ?? ''} />
      <div class="form-grid">
        <F label="Nom du projet" name="name" required max={160} />
        <Sel label="Client" name="contact_id" required value={c.req.query('contact') ?? ''} options={contacts.map((x) => [String(x.id), `${x.name}${x.company ? ` — ${x.company}` : ''}`] as const)} empty="Choisir…" />
        <F label="Livraison prévue" name="due_date" type="date" />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Créer</button>
      </div>
    </form>,
  );
});

projectRoutes.post('/projets/nouveau', async (c) => {
  const f = await readForm(c);
  const { db } = c.get('deps');
  const ct = await db.get<{ id: number }>('SELECT id FROM contacts WHERE id = ?', [f.int('contact_id') ?? 0]);
  if (!ct || !f.get('name')) return c.redirect('/admin/projets/nouveau', 303);
  const q = f.int('quote_id') ? await db.get<QuoteRow>('SELECT id, title, intro FROM quotes WHERE id = ? AND contact_id = ?', [f.int('quote_id')!, ct.id]) : undefined;
  const now = new Date().toISOString();
  const due = f.get('due_date');
  const r = await db.run(
    'INSERT INTO web_projects (contact_id, quote_id, name, brief, acceptance_token, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [ct.id, q?.id ?? null, f.get('name').slice(0, 160), q ? `${q.title}\n${q.intro}`.trim() : '', randomToken(32), isIsoDate(due) ? due : null, now, now],
  );
  await db.run('INSERT INTO project_events (project_id, kind, body, author, created_at) VALUES (?, ?, ?, ?, ?)', [r.lastId, 'systeme', 'Projet créé.', c.get('user')!.name, now]);
  return c.redirect(`/admin/projets/${r.lastId}?ok=created`, 303);
});

function Checklist({ name, items, state, disabled }: { name: string; items: ChecklistItem[]; state: ChecklistState; disabled?: boolean }) {
  const prog = checklistProgress(items, state);
  return (
    <>
      <p class="small">
        {prog.done}/{prog.total} points vérifiés
      </p>
      <div class="progress">
        <span style={`width:${Math.round((prog.done / prog.total) * 100)}%`}></span>
      </div>
      <ul class="checklist">
        {items.map((i) => (
          <li>
            <label>
              <input type="checkbox" name={name} value={i.key} checked={!!state[i.key]?.done} disabled={disabled} />
              <span>
                {i.label}
                {state[i.key]?.done && (
                  <small>
                    {state[i.key]!.by} — {formatShortDate(state[i.key]!.at)}
                  </small>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

projectRoutes.get('/projets/:id', async (c) => {
  const { db } = c.get('deps');
  const p = await db.get<ProjectRow>('SELECT * FROM web_projects WHERE id = ?', [idParam(c)]);
  if (!p) return c.notFound();
  const ct = await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [p.contact_id]);
  const events = await db.all<{ kind: string; body: string; author: string; created_at: string }>('SELECT * FROM project_events WHERE project_id = ? ORDER BY created_at DESC, id DESC', [p.id]);
  const csrf = c.get('csrf');
  const seo = parseChecklist(p.seo_checklist);
  const sec = parseChecklist(p.security_checklist);
  const link = siteLink(c.get('settings'), new URL(c.req.url).origin, `/client/projet/${p.acceptance_token}`);
  const T = (label: string, name: keyof ProjectRow, help?: string) => <TA label={label} name={name} value={String(p[name] ?? '')} rows={3} max={10000} help={help} />;
  return page(
    c,
    p.name,
    <div class="cols cols-3">
      <div>
        <form method="post" action={`/admin/projets/${p.id}`} class="panel">
          <Csrf token={csrf} />
          <div class="alert alert-warning">
            Ne saisissez jamais de mot de passe, clé d’API ou jeton dans cette fiche : conservez-les dans un gestionnaire de mots de passe. Côté code, utilisez des
            variables d’environnement.
          </div>
          <div class="form-grid">
            <F label="Nom du projet" name="name" value={p.name} required max={160} />
            <Sel label="Statut" name="status" value={p.status} options={PROJECT_STATUSES} />
            <F label="Livraison prévue" name="due_date" type="date" value={p.due_date ?? ''} />
            <F label="Version en cours" name="current_version" value={p.current_version} max={60} />
            <F label="Nom de domaine" name="domain" value={p.domain} max={200} />
            <F label="Hébergement (prestataire, offre)" name="hosting" value={p.hosting} max={300} />
            <F label="URL de préproduction" name="staging_url" type="url" value={p.staging_url} max={300} />
            <F label="URL de production" name="production_url" type="url" value={p.production_url} max={300} />
            {T('Brief client', 'brief')}
            {T('Identité visuelle (couleurs, typographies, logo)', 'identity')}
            {T('Textes (état, responsable, liens)', 'texts')}
            {T('Photos (sources, licences)', 'photos', 'Indiquez la licence de chaque image utilisée (usage commercial autorisé).')}
            {T('Arborescence', 'sitemap')}
            {T('Sauvegardes (outil, fréquence, dernier test de restauration)', 'backups')}
            {T('Conditions de maintenance', 'maintenance_terms')}
          </div>
          <h3 style="margin-top:1.25rem">Checklist SEO</h3>
          <Checklist name="seo" items={SEO_CHECKLIST} state={seo} />
          <h3 style="margin-top:1.25rem">Checklist sécurité</h3>
          <Checklist name="sec" items={SECURITY_CHECKLIST} state={sec} />
          <div class="form-actions">
            <button class="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </div>
      <div>
        <div class="panel">
          <h2>Client</h2>
          {ct && (
            <p>
              <a href={`/admin/crm/${ct.id}`}>{ct.name}</a>
              {ct.company ? ` — ${ct.company}` : ''}
            </p>
          )}
          {p.quote_id && (
            <p>
              <a href={`/admin/devis/${p.quote_id}`}>Devis associé</a>
            </p>
          )}
        </div>
        <div class="panel">
          <h2>Recette client</h2>
          <p>
            <Badge options={ACCEPTANCE_STATUSES} value={p.acceptance_status} />
          </p>
          {p.acceptance_at && (
            <p class="small">
              Réponse le {formatDateTime(p.acceptance_at)} par {p.acceptance_name}
              {p.acceptance_comment ? ` : « ${p.acceptance_comment} »` : ''}
            </p>
          )}
          <p class="small muted">
            La mise en production ne doit intervenir qu’après validation de la recette par le client. Renseignez l’URL de préproduction, puis demandez la validation.
          </p>
          <ActionButton action={`/admin/projets/${p.id}/recette`} csrf={csrf} label={p.acceptance_status === 'en_attente' ? 'Renvoyer la demande de recette' : 'Demander la validation de la recette'} cls="btn-primary" confirm="Envoyer au client la demande de validation ?" />
          {p.acceptance_status !== 'non_demandee' && (
            <div class="copy-row" style="margin-top:.75rem">
              <input readonly value={link} aria-label="Lien de recette" />
              <button type="button" class="btn btn-outline btn-sm" data-copy={link}>
                Copier
              </button>
            </div>
          )}
        </div>
        <div class="panel">
          <h2>Historique des modifications</h2>
          <form method="post" action={`/admin/projets/${p.id}/journal`} class="form-grid">
            <Csrf token={csrf} />
            <TA label="Entrée du journal (modification, livraison, échange…)" name="body" rows={2} required max={3000} />
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
                {e.body}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    { wide: true },
  );
});

function mergeChecklist(items: ChecklistItem[], prev: ChecklistState, checked: Set<string>, by: string): ChecklistState {
  const now = new Date().toISOString();
  const next: ChecklistState = {};
  for (const it of items) if (checked.has(it.key)) next[it.key] = prev[it.key]?.done ? prev[it.key]! : { done: true, at: now, by };
  return next;
}

projectRoutes.post('/projets/:id', async (c) => {
  const { db } = c.get('deps');
  const p = await db.get<ProjectRow>('SELECT * FROM web_projects WHERE id = ?', [idParam(c)]);
  if (!p) return c.notFound();
  const f = await readForm(c);
  const textFields = ['brief', 'identity', 'texts', 'photos', 'sitemap', 'backups', 'maintenance_terms', 'domain', 'hosting'] as const;
  if (textFields.some((k) => SECRET_HINT.test(f.get(k)))) {
    return page(c, 'Enregistrement refusé', <div class="panel"><p>Un champ semble contenir un mot de passe, une clé ou un jeton. Retirez-le : ces secrets ne doivent pas être stockés ici.</p><a class="btn btn-outline" href={`/admin/projets/${p.id}`}>Retour</a></div>, { status: 422 });
  }
  const status = isOneOf(PROJECT_STATUSES, f.get('status')) ? f.get('status') : p.status;
  if (status === 'en_ligne' && p.status !== 'en_ligne' && p.acceptance_status !== 'validee') {
    return page(c, 'Mise en production refusée', <div class="panel"><p>La recette doit être validée par le client avant la mise en ligne.</p><a class="btn btn-outline" href={`/admin/projets/${p.id}`}>Retour</a></div>, { status: 409 });
  }
  const urls = ['staging_url', 'production_url'].map((k) => f.get(k));
  if (urls.some((u) => u && !/^https?:\/\//i.test(u))) return c.redirect(`/admin/projets/${p.id}`, 303);
  const due = f.get('due_date');
  const by = c.get('user')!.name;
  const now = new Date().toISOString();
  await db.run(
    `UPDATE web_projects SET name=?, status=?, due_date=?, current_version=?, domain=?, hosting=?, staging_url=?, production_url=?, brief=?, identity=?, texts=?, photos=?, sitemap=?, backups=?, maintenance_terms=?,
     seo_checklist=?, security_checklist=?, delivered_at = CASE WHEN ? = 'en_ligne' AND delivered_at IS NULL THEN ? ELSE delivered_at END, updated_at=? WHERE id=?`,
    [
      f.get('name').slice(0, 160) || p.name, status, isIsoDate(due) ? due : null, f.get('current_version').slice(0, 60), f.get('domain').slice(0, 200), f.get('hosting').slice(0, 300), urls[0]!.slice(0, 300), urls[1]!.slice(0, 300),
      ...['brief', 'identity', 'texts', 'photos', 'sitemap', 'backups', 'maintenance_terms'].map((k) => f.get(k).slice(0, 10000)),
      JSON.stringify(mergeChecklist(SEO_CHECKLIST, parseChecklist(p.seo_checklist), new Set(f.all('seo')), by)),
      JSON.stringify(mergeChecklist(SECURITY_CHECKLIST, parseChecklist(p.security_checklist), new Set(f.all('sec')), by)),
      status, now, now, p.id,
    ],
  );
  const changes: string[] = [];
  if (status !== p.status) changes.push(`Statut : ${PROJECT_STATUSES.find((x) => x[0] === p.status)?.[1]} → ${PROJECT_STATUSES.find((x) => x[0] === status)?.[1]}`);
  if (f.get('current_version') !== p.current_version) changes.push(`Version : ${f.get('current_version') || '—'}`);
  if (changes.length) await db.run('INSERT INTO project_events (project_id, kind, body, author, created_at) VALUES (?, ?, ?, ?, ?)', [p.id, 'systeme', changes.join('\n'), by, now]);
  return c.redirect(`/admin/projets/${p.id}?ok=saved`, 303);
});

projectRoutes.post('/projets/:id/journal', async (c) => {
  const f = await readForm(c);
  if (f.get('body')) await c.get('deps').db.run('INSERT INTO project_events (project_id, kind, body, author, created_at) VALUES (?, ?, ?, ?, ?)', [idParam(c), 'note', f.get('body').slice(0, 3000), c.get('user')!.name, new Date().toISOString()]);
  return c.redirect(`/admin/projets/${idParam(c)}?ok=saved`, 303);
});

projectRoutes.post('/projets/:id/recette', async (c) => {
  const deps = c.get('deps');
  const s = c.get('settings');
  const p = await deps.db.get<ProjectRow>('SELECT * FROM web_projects WHERE id = ?', [idParam(c)]);
  if (!p) return c.notFound();
  const ct = await deps.db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [p.contact_id]);
  const fail = (msg: string) => page(c, 'Demande impossible', <div class="panel"><p>{msg}</p><a class="btn btn-outline" href={`/admin/projets/${p.id}`}>Retour</a></div>, { status: 422 });
  if (!p.staging_url) return fail('Renseignez d’abord l’URL de préproduction.');
  if (!ct?.email) return fail('Le client n’a pas d’adresse e-mail.');
  const res = await deps.mailer.send({
    to: ct.email,
    subject: `${s.agencyName} — votre site est prêt pour la recette`,
    kind: 'recette',
    replyTo: s.contactEmail || undefined,
    text: `Bonjour ${ct.name},

La version de préproduction de votre site « ${p.name} » est prête :
${p.staging_url}

Merci de la parcourir (textes, liens, formulaires, affichage sur mobile), puis de valider la recette ou de nous indiquer les corrections :
${siteLink(s, new URL(c.req.url).origin, `/client/projet/${p.acceptance_token}`)}

La mise en ligne n’interviendra qu’après votre validation.

${s.agencyName}`,
  });
  if (!res.ok) return fail(`E-mail non envoyé (${res.error}).`);
  const now = new Date().toISOString();
  await deps.db.run("UPDATE web_projects SET acceptance_status = 'en_attente', status = CASE WHEN status IN ('brief', 'conception', 'developpement') THEN 'recette' ELSE status END, updated_at = ? WHERE id = ?", [now, p.id]);
  await deps.db.run('INSERT INTO project_events (project_id, kind, body, author, created_at) VALUES (?, ?, ?, ?, ?)', [p.id, 'systeme', 'Demande de validation de la recette envoyée au client.', c.get('user')!.name, now]);
  await addContactEvent(deps, ct.id, 'systeme', `Recette du projet « ${p.name} » demandée.`, c.get('user')!.name);
  return c.redirect(`/admin/projets/${p.id}?ok=sent`, 303);
});
