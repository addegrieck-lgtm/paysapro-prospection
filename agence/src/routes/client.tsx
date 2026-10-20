import { Hono } from 'hono';
import type { Child } from 'hono/jsx';
import type { AppEnv, Ctx } from '../app/context';
import { allowRate } from '../app/security';
import { Layout } from '../web/layout';
import { Notice } from '../web/components';
import { QuoteDocument } from '../web/documents';
import type { ContactRow, OrderRow, ProjectRow, ProofRow, QuoteRow } from '../repo/types';
import { decideQuote, quoteLines } from '../services/quotes';
import { decideProof } from '../services/orders';
import { formatDate, formatDateTime, todayParis } from '../domain/dates';
import { ACCEPTANCE_STATUSES, ORDER_STATUSES, PROJECT_STATUSES, labelOf } from '../domain/statuses';
import { addContactEvent } from '../services/requests';

/**
 * Espace client « sans compte » : chaque document est accessible par un lien personnel contenant
 * un jeton aléatoire de 256 bits (non devinable), envoyé uniquement à l'adresse e-mail du client.
 */
export const clientRoutes = new Hono<AppEnv>();

const TOKEN = /^[A-Za-z0-9_-]{40,64}$/;

function Shell({ c, title, children }: { c: Ctx; title: string; children: Child }) {
  return (
    <Layout s={c.get('settings')} meta={{ title, description: title, path: new URL(c.req.url).pathname, noindex: true }}>
      <section class="section section-tight">
        <div class="container narrow">{children}</div>
      </section>
    </Layout>
  );
}

const notFound = (c: Ctx) =>
  c.html(
    <Shell c={c} title="Lien invalide">
      <h1>Lien invalide ou expiré</h1>
      <p>Ce lien ne correspond à aucun document. Vérifiez qu’il a été copié en entier, ou contactez-nous.</p>
      <a href="/contact" class="btn btn-primary">Nous contacter</a>
    </Shell>,
    404,
  );

function DecisionForm({ action, acceptLabel, acceptText, refuseLabel, refuseHelp }: { action: string; acceptLabel: string; acceptText: string; refuseLabel: string; refuseHelp: string }) {
  return (
    <div class="cols-client">
      <form method="post" action={action} class="form form-card">
        <input type="hidden" name="decision" value="accepte" />
        <h2 class="h3">{acceptLabel}</h2>
        <div class="field">
          <label for="acc-name">Votre nom et prénom *</label>
          <input id="acc-name" name="name" required maxlength={120} autocomplete="name" />
        </div>
        <div class="field-check">
          <input type="checkbox" id="acc-ok" name="agree" value="1" required />
          <label for="acc-ok">{acceptText}</label>
        </div>
        <button class="btn btn-primary">{acceptLabel}</button>
      </form>
      <form method="post" action={action} class="form form-card">
        <input type="hidden" name="decision" value="refuse" />
        <h2 class="h3">{refuseLabel}</h2>
        <div class="field">
          <label for="ref-name">Votre nom et prénom *</label>
          <input id="ref-name" name="name" required maxlength={120} autocomplete="name" />
        </div>
        <div class="field">
          <label for="ref-comment">{refuseHelp} *</label>
          <textarea id="ref-comment" name="comment" rows={4} required minlength={5} maxlength={3000}></textarea>
        </div>
        <button class="btn btn-outline">{refuseLabel}</button>
      </form>
    </div>
  );
}

async function readDecision(c: Ctx) {
  const b = await c.req.parseBody();
  const decision = b.decision === 'accepte' ? ('accepte' as const) : ('refuse' as const);
  const name = String(b.name ?? '').trim().slice(0, 120);
  const comment = String(b.comment ?? '').trim().slice(0, 3000);
  const ok = name.length >= 2 && (decision === 'refuse' ? comment.length >= 5 : b.agree === '1');
  return { decision, name, comment, ok };
}

// ─── Devis ───

clientRoutes.get('/devis/:token', async (c) => {
  const token = c.req.param('token');
  if (!TOKEN.test(token)) return notFound(c);
  const { db } = c.get('deps');
  const q = await db.get<QuoteRow>("SELECT * FROM quotes WHERE token = ? AND status <> 'brouillon'", [token]);
  if (!q) return notFound(c);
  const contact = (await db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [q.contact_id]))!;
  const lines = await quoteLines(c.get('deps'), q.id);
  const expired = q.status === 'envoye' && !!q.valid_until && q.valid_until < todayParis();
  const msg = c.req.query('ok');
  return c.html(
    <Shell c={c} title={`Devis ${q.number}`}>
      <p class="eyebrow">Espace client</p>
      <h1>Votre devis {q.number}</h1>
      {msg === 'accepte' && <Notice kind="success">Merci ! Votre acceptation a bien été enregistrée. Nous revenons vers vous rapidement pour la suite.</Notice>}
      {msg === 'refuse' && <Notice>Votre réponse a bien été enregistrée. Merci pour votre retour.</Notice>}
      {q.status === 'accepte' && !msg && <Notice kind="success">Devis accepté le {formatDate(q.decided_at)}.</Notice>}
      {q.status === 'annule' && <Notice kind="warning">Ce devis a été remplacé ou annulé. Une version à jour vous a peut-être été adressée.</Notice>}
      {(expired || q.status === 'expire') && <Notice kind="warning">Ce devis a expiré le {formatDate(q.valid_until)}. Contactez-nous pour obtenir une version à jour.</Notice>}
      <div class="doc-wrap">
        <QuoteDocument s={c.get('settings')} quote={q} lines={lines} contact={contact} />
      </div>
      <p class="small muted">Pour conserver ce devis, utilisez la fonction « Imprimer » de votre navigateur puis « Enregistrer au format PDF ».</p>
      {q.status === 'envoye' && !expired && (
        <DecisionForm
          action={`/client/devis/${token}`}
          acceptLabel="Accepter le devis"
          acceptText="J’accepte ce devis et les conditions générales de vente (bon pour accord). Aucun paiement n’est prélevé en ligne : la facture d’acompte vous sera transmise."
          refuseLabel="Refuser ou demander une modification"
          refuseHelp="Dites-nous ce qui ne convient pas"
        />
      )}
    </Shell>,
  );
});

clientRoutes.post('/devis/:token', async (c) => {
  const token = c.req.param('token');
  if (!TOKEN.test(token)) return notFound(c);
  if (!(await allowRate(c, 'client-decision', 20, 3600))) return c.text('Trop de tentatives.', 429);
  const q = await c.get('deps').db.get<QuoteRow>('SELECT * FROM quotes WHERE token = ?', [token]);
  if (!q) return notFound(c);
  const d = await readDecision(c);
  if (!d.ok) return c.redirect(`/client/devis/${token}`, 303);
  const r = await decideQuote(c.get('deps'), c.get('settings'), q.id, d.decision, d.name, d.comment, `Client (${d.name})`);
  if (!r.ok) return c.html(<Shell c={c} title="Action impossible"><Notice kind="warning">{r.error}</Notice><a class="btn btn-outline" href={`/client/devis/${token}`}>Retour au devis</a></Shell>, 409);
  return c.redirect(`/client/devis/${token}?ok=${d.decision}`, 303);
});

// ─── Bon à tirer ───

async function proofByToken(c: Ctx) {
  const token = c.req.param('token') ?? '';
  if (!TOKEN.test(token)) return null;
  return c.get('deps').db.get<ProofRow>("SELECT * FROM proofs WHERE token = ? AND status IN ('envoye', 'accepte', 'refuse', 'remplace')", [token]);
}

clientRoutes.get('/bat/:token', async (c) => {
  const p = await proofByToken(c);
  if (!p) return notFound(c);
  const { db } = c.get('deps');
  const o = (await db.get<OrderRow>('SELECT * FROM print_orders WHERE id = ?', [p.order_id]))!;
  const msg = c.req.query('ok');
  const isImage = !p.file_name.toLowerCase().endsWith('.pdf');
  return c.html(
    <Shell c={c} title={`BAT — commande ${o.number}`}>
      <p class="eyebrow">Bon à tirer · version {p.version}</p>
      <h1>Validation de votre visuel</h1>
      <p>
        Commande <strong>{o.number}</strong> — {o.description}
      </p>
      {msg === 'accepte' && <Notice kind="success">Merci ! Votre BAT est validé. Nous lançons la fabrication et vous tenons informé(e).</Notice>}
      {msg === 'refuse' && <Notice>Vos demandes de corrections ont bien été transmises. Vous recevrez une nouvelle version.</Notice>}
      {p.status === 'remplace' && <Notice kind="warning">Cette version a été remplacée par une version plus récente : consultez le dernier e-mail reçu.</Notice>}
      {p.status === 'accepte' && !msg && <Notice kind="success">Version acceptée le {formatDateTime(p.decided_at)} par {p.decided_name}.</Notice>}
      <div class="proof-view">
        {isImage ? (
          <img src={`/client/bat/${p.token}/fichier`} alt={`Bon à tirer, version ${p.version}`} />
        ) : (
          <iframe src={`/client/bat/${p.token}/fichier`} title={`Bon à tirer, version ${p.version}`} style="width:100%;height:70vh;border:1px solid var(--line);border-radius:12px"></iframe>
        )}
        <p>
          <a href={`/client/bat/${p.token}/fichier?telecharger=1`} class="link-arrow">Télécharger le fichier</a>
        </p>
      </div>
      {p.status === 'envoye' && (
        <>
          <Notice kind="warning">
            Vérifiez attentivement : textes, orthographe, numéros de téléphone, adresses, couleurs et recto-verso. <strong>Après validation, le support sera imprimé tel quel.</strong>
          </Notice>
          <DecisionForm
            action={`/client/bat/${p.token}`}
            acceptLabel="Valider le BAT — bon pour impression"
            acceptText="J’ai vérifié le visuel et j’autorise son impression en l’état (textes, coordonnées et mise en page)."
            refuseLabel="Demander des corrections"
            refuseHelp="Décrivez précisément les corrections"
          />
        </>
      )}
    </Shell>,
  );
});

clientRoutes.get('/bat/:token/fichier', async (c) => {
  const p = await proofByToken(c);
  if (!p) return c.text('Introuvable', 404);
  const file = await c.get('deps').storage.get(p.file_key);
  if (!file) return c.text('Introuvable', 404);
  const download = c.req.query('telecharger') === '1';
  return c.body(file.body as Uint8Array<ArrayBuffer>, 200, {
    'Content-Type': file.type,
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(p.file_name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
});

clientRoutes.post('/bat/:token', async (c) => {
  const p = await proofByToken(c);
  if (!p) return notFound(c);
  if (!(await allowRate(c, 'client-decision', 20, 3600))) return c.text('Trop de tentatives.', 429);
  const d = await readDecision(c);
  if (!d.ok) return c.redirect(`/client/bat/${p.token}`, 303);
  const r = await decideProof(c.get('deps'), c.get('settings'), p, d.decision, d.name, d.comment);
  if (!r.ok) return c.html(<Shell c={c} title="Action impossible"><Notice kind="warning">{r.error}</Notice></Shell>, 409);
  return c.redirect(`/client/bat/${p.token}?ok=${d.decision}`, 303);
});

// ─── Recette de site ───

clientRoutes.get('/projet/:token', async (c) => {
  const token = c.req.param('token');
  if (!TOKEN.test(token)) return notFound(c);
  const { db } = c.get('deps');
  const p = await db.get<ProjectRow>("SELECT * FROM web_projects WHERE acceptance_token = ? AND acceptance_status <> 'non_demandee'", [token]);
  if (!p) return notFound(c);
  const orders = await db.all<OrderRow>('SELECT number, status, description, tracking_url FROM print_orders WHERE contact_id = ? AND status NOT IN (\'annule\') ORDER BY created_at DESC LIMIT 5', [p.contact_id]);
  const msg = c.req.query('ok');
  return c.html(
    <Shell c={c} title={`Projet ${p.name}`}>
      <p class="eyebrow">Espace client · projet</p>
      <h1>{p.name}</h1>
      {msg === 'accepte' && <Notice kind="success">Merci ! La recette est validée. Nous planifions la mise en ligne avec vous.</Notice>}
      {msg === 'refuse' && <Notice>Vos remarques ont bien été transmises.</Notice>}
      <dl class="meta-list" style="margin:1.5rem 0">
        <div>
          <dt>Étape</dt>
          <dd>{labelOf(PROJECT_STATUSES, p.status)}</dd>
        </div>
        <div>
          <dt>Recette</dt>
          <dd>{labelOf(ACCEPTANCE_STATUSES, p.acceptance_status)}</dd>
        </div>
        {p.due_date && (
          <div>
            <dt>Livraison prévue</dt>
            <dd>{formatDate(p.due_date)}</dd>
          </div>
        )}
      </dl>
      {p.staging_url && (
        <p>
          <a href={p.staging_url} target="_blank" rel="noopener" class="btn btn-outline">Ouvrir la version de préproduction ↗</a>
        </p>
      )}
      {orders.length > 0 && (
        <>
          <h2 class="h3">Vos commandes d’impression</h2>
          <ul class="plain-list">
            {orders.map((o) => (
              <li>
                {o.number} — {labelOf(ORDER_STATUSES, o.status)}
                {o.tracking_url && (
                  <>
                    {' '}
                    · <a href={o.tracking_url} rel="noopener" target="_blank">suivi du colis</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {p.acceptance_status === 'en_attente' && (
        <DecisionForm
          action={`/client/projet/${token}`}
          acceptLabel="Valider la recette"
          acceptText="J’ai vérifié le site en préproduction et j’autorise sa mise en ligne."
          refuseLabel="Signaler des corrections"
          refuseHelp="Listez les corrections à apporter"
        />
      )}
    </Shell>,
  );
});

clientRoutes.post('/projet/:token', async (c) => {
  const token = c.req.param('token');
  if (!TOKEN.test(token)) return notFound(c);
  if (!(await allowRate(c, 'client-decision', 20, 3600))) return c.text('Trop de tentatives.', 429);
  const { db } = c.get('deps');
  const p = await db.get<ProjectRow>("SELECT * FROM web_projects WHERE acceptance_token = ? AND acceptance_status = 'en_attente'", [token]);
  if (!p) return c.redirect(`/client/projet/${token}`, 303);
  const d = await readDecision(c);
  if (!d.ok) return c.redirect(`/client/projet/${token}`, 303);
  const now = new Date().toISOString();
  await db.run("UPDATE web_projects SET acceptance_status = ?, acceptance_at = ?, acceptance_name = ?, acceptance_comment = ?, status = CASE WHEN ? = 'validee' THEN 'valide' ELSE status END, updated_at = ? WHERE id = ?", [
    d.decision === 'accepte' ? 'validee' : 'refusee', now, d.name, d.comment, d.decision === 'accepte' ? 'validee' : 'refusee', now, p.id,
  ]);
  await db.run('INSERT INTO project_events (project_id, kind, body, author, created_at) VALUES (?, ?, ?, ?, ?)', [p.id, 'systeme', `Recette ${d.decision === 'accepte' ? 'VALIDÉE' : 'refusée'} par ${d.name}${d.comment ? ` : ${d.comment}` : ''}`, 'Client', now]);
  await addContactEvent(c.get('deps'), p.contact_id, 'systeme', `Recette du projet « ${p.name} » ${d.decision === 'accepte' ? 'validée' : 'refusée'} par ${d.name}.`, 'Client');
  const s = c.get('settings');
  if (s.notifyEmail) await c.get('deps').mailer.send({ to: s.notifyEmail, subject: `Recette ${d.decision === 'accepte' ? 'validée' : 'refusée'} : ${p.name}`, kind: 'notification', text: `${d.name} : ${d.comment || '(sans commentaire)'}` });
  return c.redirect(`/client/projet/${token}?ok=${d.decision}`, 303);
});
