import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../../app/context';
import { idParam, page, readForm } from './helpers';
import { ActionButton, Badge, Csrf, Empty, F, Sel } from '../../web/admin/ui';
import type { ContactRow } from '../../repo/types';
import { formatDateTime, formatShortDate } from '../../domain/dates';
import { BRIEF_MODULES, BRIEF_STATUSES, briefProgress, parseModules, visibleSections } from '../../domain/brief';
import { type BriefRow, createBrief, modulesLabel, parseBrief, sendBriefLink } from '../../services/briefs';
import { addContactEvent, siteLink } from '../../services/requests';
import { BriefDocument } from '../../web/brief';

export const briefRoutes = new Hono<AppEnv>();

function ModuleChecks({ selected }: { selected: string[] }) {
  return (
    <fieldset class="field field-wide">
      <legend>Prestations couvertes (le client pourra ajuster)</legend>
      {BRIEF_MODULES.map((m) => (
        <label class="check-line">
          <input type="checkbox" name="modules" value={m.id} checked={selected.includes(m.id)} /> {m.label} <span class="muted small">— {m.hint}</span>
        </label>
      ))}
    </fieldset>
  );
}

briefRoutes.get('/cahiers', async (c) => {
  const status = c.req.query('statut') ?? '';
  const rows = await c.get('deps').db.all<BriefRow & { cname: string; company: string }>(
    `SELECT b.*, ct.name AS cname, ct.company FROM briefs b JOIN contacts ct ON ct.id = b.contact_id
     ${BRIEF_STATUSES.some(([v]) => v === status) ? 'WHERE b.status = ?' : ''} ORDER BY b.updated_at DESC LIMIT 200`,
    BRIEF_STATUSES.some(([v]) => v === status) ? [status] : [],
  );
  return page(
    c,
    'Cahiers des charges',
    <>
      <form class="filters" method="get">
        <Sel label="Statut" name="statut" value={status} options={BRIEF_STATUSES} empty="Tous" />
        <button class="btn btn-outline">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <Empty>
          Aucun cahier des charges. Créez-en un pour un client : il reçoit un lien personnel et répond à un questionnaire guidé, adapté aux prestations choisies.
        </Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Cahier des charges</th>
                <th>Client</th>
                <th>Prestations</th>
                <th class="num">Avancement</th>
                <th>Statut</th>
                <th>Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const b = parseBrief(r);
                return (
                  <tr>
                    <td>
                      <a href={`/admin/cahiers/${b.id}`}>{b.title}</a>
                    </td>
                    <td>
                      {r.cname}
                      {r.company ? <span class="muted"> — {r.company}</span> : null}
                    </td>
                    <td>{modulesLabel(b.modules)}</td>
                    <td class="num">{briefProgress(b.modules, b.answers).percent} %</td>
                    <td>
                      <Badge options={BRIEF_STATUSES} value={b.status} />
                    </td>
                    <td>{formatShortDate(b.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>,
    { actions: <a href="/admin/cahiers/nouveau" class="btn btn-primary">Nouveau cahier des charges</a> },
  );
});

briefRoutes.get('/cahiers/nouveau', async (c) => {
  const contacts = await c.get('deps').db.all<ContactRow>('SELECT id, name, company FROM contacts ORDER BY name LIMIT 500');
  return page(
    c,
    'Nouveau cahier des charges',
    <form method="post" action="/admin/cahiers/nouveau" class="panel">
      <Csrf token={c.get('csrf')} />
      <div class="form-grid">
        <Sel label="Client" name="contact_id" required value={c.req.query('contact') ?? ''} options={contacts.map((x) => [String(x.id), `${x.name}${x.company ? ` — ${x.company}` : ''}`] as const)} empty="Choisir…" />
        <F label="Titre (vu par le client)" name="title" max={160} placeholder="Ex. : Création de votre site et de votre logo" />
        <ModuleChecks selected={[]} />
      </div>
      <p class="small muted">
        Le client ne crée aucun compte : il reçoit un lien personnel, répond étape par étape (ses réponses sont enregistrées au fur et à mesure) et peut joindre logo,
        photos et documents. Vous êtes prévenu lorsqu’il a terminé.
      </p>
      <div class="form-actions">
        <button class="btn btn-primary">Créer</button>
      </div>
    </form>,
    { error: c.req.query('erreur') ? 'Choisissez un client et au moins une prestation.' : undefined },
  );
});

briefRoutes.post('/cahiers/nouveau', async (c) => {
  const f = await readForm(c);
  const { db } = c.get('deps');
  const ct = await db.get<{ id: number }>('SELECT id FROM contacts WHERE id = ?', [f.int('contact_id') ?? 0]);
  const modules = parseModules(f.all('modules'));
  if (!ct || !modules.length) return c.redirect(`/admin/cahiers/nouveau?contact=${ct?.id ?? ''}&erreur=1`, 303);
  const title = f.get('title').slice(0, 160) || `Cahier des charges — ${modulesLabel(modules)}`;
  const id = await createBrief(c.get('deps'), ct.id, title, modules);
  return c.redirect(`/admin/cahiers/${id}?ok=created`, 303);
});

async function load(c: Ctx) {
  const row = await c.get('deps').db.get<BriefRow>('SELECT * FROM briefs WHERE id = ?', [idParam(c)]);
  if (!row) return null;
  const contact = (await c.get('deps').db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [row.contact_id]))!;
  return { b: parseBrief(row), contact };
}

briefRoutes.get('/cahiers/:id', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  const { b, contact } = data;
  const csrf = c.get('csrf');
  const link = siteLink(c.get('settings'), new URL(c.req.url).origin, `/client/cahier/${b.token}`);
  const progress = briefProgress(b.modules, b.answers);
  return page(
    c,
    b.title,
    <>
      <div class="cols no-print">
        <div class="panel">
          <h2>Lien du client</h2>
          <div class="copy-row">
            <input readonly value={link} aria-label="Lien du cahier des charges" />
            <button type="button" class="btn btn-outline btn-sm" data-copy={link}>
              Copier
            </button>
          </div>
          <div class="page-actions" style="margin-top:.75rem">
            <ActionButton
              action={`/admin/cahiers/${b.id}/envoyer`}
              csrf={csrf}
              label={b.sent_at ? 'Renvoyer le lien par e-mail' : 'Envoyer le lien par e-mail'}
              cls="btn-primary"
              confirm={`Envoyer le lien à ${contact.email || 'ce contact'} ?`}
            />
            <a class="btn btn-outline btn-sm" href={link} target="_blank" rel="noopener">
              Ouvrir comme le client ↗
            </a>
            <button type="button" class="btn btn-outline btn-sm" data-print>
              Imprimer / PDF
            </button>
          </div>
          <p class="small muted" style="margin-top:.75rem">
            Vous pouvez aussi copier le lien dans un SMS ou un message. Il est personnel : ne le publiez pas.
          </p>
        </div>
        <div class="panel">
          <h2>Suivi</h2>
          <dl class="kv">
            <dt>Client</dt>
            <dd>
              <a href={`/admin/crm/${contact.id}`}>{contact.name}</a>
              {contact.company ? ` — ${contact.company}` : ''}
            </dd>
            <dt>Statut</dt>
            <dd>
              <Badge options={BRIEF_STATUSES} value={b.status} />
            </dd>
            <dt>Avancement</dt>
            <dd>
              {progress.answered} / {progress.total} réponses ({progress.percent} %)
            </dd>
            <dt>Envoyé le</dt>
            <dd>{formatDateTime(b.sent_at)}</dd>
            <dt>Complété le</dt>
            <dd>{formatDateTime(b.submitted_at)}</dd>
          </dl>
          {b.status === 'termine' && (
            <ActionButton action={`/admin/cahiers/${b.id}/rouvrir`} csrf={csrf} label="Rouvrir pour le client" confirm="Le client pourra de nouveau modifier ses réponses. Continuer ?" />
          )}
        </div>
      </div>

      <div class="panel brief-admin-doc">
        <div class="panel-head">
          <h2>Réponses du client</h2>
          <span class="small muted no-print">Mis à jour le {formatDateTime(b.updated_at)}</span>
        </div>
        <p class="print-only">
          <strong>Client :</strong> {contact.name}
          {contact.company ? ` — ${contact.company}` : ''} · {contact.email} · {contact.phone}
        </p>
        <BriefDocument sections={visibleSections(b.modules, b.answers)} a={b.answers} modulesText={modulesLabel(b.modules)} />
        <section class="brief-doc-section">
          <h2>Fichiers joints</h2>
          {b.files.length ? (
            <ul>
              {b.files.map((f) => (
                <li>
                  <a href={`/admin/fichiers/${f.key}`}>{f.name}</a> <span class="muted small">({(f.size / 1024).toFixed(0)} Ko)</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">Aucun fichier.</p>
          )}
        </section>
      </div>

      <div class="cols no-print">
        <form method="post" action={`/admin/cahiers/${b.id}`} class="panel">
          <h2>Modifier</h2>
          <Csrf token={csrf} />
          <div class="form-grid">
            <F label="Titre (vu par le client)" name="title" value={b.title} required max={160} wide />
            <ModuleChecks selected={b.modules} />
          </div>
          <div class="form-actions">
            <button class="btn btn-outline">Enregistrer</button>
          </div>
        </form>
        <div class="panel">
          <h2>Supprimer</h2>
          <p class="small muted">Supprime le cahier des charges et ses réponses. Le lien du client ne fonctionnera plus.</p>
          <ActionButton action={`/admin/cahiers/${b.id}/supprimer`} csrf={csrf} label="Supprimer" cls="btn-danger" confirm="Supprimer définitivement ce cahier des charges ?" />
        </div>
      </div>
    </>,
    { wide: true },
  );
});

briefRoutes.post('/cahiers/:id', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  const f = await readForm(c);
  const modules = parseModules(f.all('modules'));
  if (!modules.length || !f.get('title')) return c.redirect(`/admin/cahiers/${data.b.id}`, 303);
  await c.get('deps').db.run('UPDATE briefs SET title = ?, modules = ?, updated_at = ? WHERE id = ?', [f.get('title').slice(0, 160), JSON.stringify(modules), new Date().toISOString(), data.b.id]);
  return c.redirect(`/admin/cahiers/${data.b.id}?ok=saved`, 303);
});

briefRoutes.post('/cahiers/:id/envoyer', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  const r = await sendBriefLink(c.get('deps'), c.get('settings'), data.b, data.contact, new URL(c.req.url).origin);
  return c.redirect(`/admin/cahiers/${data.b.id}?ok=${r.ok ? 'sent' : 'mailfail'}`, 303);
});

briefRoutes.post('/cahiers/:id/rouvrir', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  await c.get('deps').db.run("UPDATE briefs SET status = 'en_cours', step = 'fin', updated_at = ? WHERE id = ?", [new Date().toISOString(), data.b.id]);
  await addContactEvent(c.get('deps'), data.contact.id, 'note', `Cahier des charges rouvert pour modification : ${data.b.title}`, c.get('user')!.name);
  return c.redirect(`/admin/cahiers/${data.b.id}?ok=status`, 303);
});

briefRoutes.post('/cahiers/:id/supprimer', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  const { db, storage } = c.get('deps');
  for (const f of data.b.files) {
    await storage.delete(f.key).catch(() => undefined);
    await db.run('DELETE FROM files WHERE key = ?', [f.key]);
  }
  await db.run('DELETE FROM briefs WHERE id = ?', [data.b.id]);
  return c.redirect('/admin/cahiers?ok=deleted', 303);
});
