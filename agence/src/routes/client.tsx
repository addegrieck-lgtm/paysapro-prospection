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
import { addContactEvent, checkUploads, storeFiles, type UploadedFile } from '../services/requests';
import { UPLOAD_LIMITS } from '../lib/storage';
import { BRIEF_MODULES, BRIEF_SECTIONS, briefProgress, parseModules, readSectionAnswers, visibleSections } from '../domain/brief';
import { type Brief, type BriefRow, modulesLabel, parseBrief, saveBrief, submitBrief } from '../services/briefs';
import { BriefDocument, BriefProgressBar, BriefQuestion, type BriefStep } from '../web/brief';

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

// ─── Cahier des charges ───

async function briefByToken(c: Ctx): Promise<Brief | null> {
  const token = c.req.param('token') ?? '';
  if (!TOKEN.test(token)) return null;
  const row = await c.get('deps').db.get<BriefRow>('SELECT * FROM briefs WHERE token = ?', [token]);
  return row ? parseBrief(row) : null;
}

function briefSteps(b: Pick<Brief, 'modules' | 'answers'>): BriefStep[] {
  return [
    { id: 'projet', title: 'Votre projet' },
    ...visibleSections(b.modules, b.answers).map((s) => ({ id: s.id, title: s.title, section: s })),
    { id: 'fin', title: 'Fichiers et envoi' },
  ];
}

clientRoutes.get('/cahier/:token', async (c) => {
  const b = await briefByToken(c);
  if (!b) return notFound(c);
  const s = c.get('settings');
  const base = `/client/cahier/${b.token}`;
  const contact = await c.get('deps').db.get<{ name: string }>('SELECT name FROM contacts WHERE id = ?', [b.contact_id]);
  const steps = briefSteps(b);
  const progress = briefProgress(b.modules, b.answers);
  const sections = visibleSections(b.modules, b.answers);

  if (b.status === 'termine') {
    return c.html(
      <Shell c={c} title="Votre cahier des charges">
        <p class="eyebrow">Espace client</p>
        <h1>{b.title}</h1>
        <Notice kind="success">
          Merci ! Votre cahier des charges nous a bien été transmis{b.submitted_at ? ` le ${formatDate(b.submitted_at)}` : ''}. Nous l’étudions et revenons vers vous
          rapidement. Pour modifier une réponse, contactez-nous{s.contactEmail ? ` à ${s.contactEmail}` : ''}.
        </Notice>
        <BriefDocument sections={sections} a={b.answers} modulesText={modulesLabel(b.modules)} showEmpty={false} />
        <p class="small muted">Pour conserver une copie, utilisez la fonction « Imprimer » de votre navigateur puis « Enregistrer au format PDF ».</p>
      </Shell>,
    );
  }

  const wanted = c.req.query('etape') ?? b.step;
  const current = Math.max(0, steps.findIndex((x) => x.id === wanted));
  const step = steps[current]!;
  const msg = c.req.query('ok');
  const error = c.req.query('erreur');
  return c.html(
    <Shell c={c} title="Votre cahier des charges">
      <p class="eyebrow">Cahier des charges · {s.agencyName}</p>
      <h1>{b.title}</h1>
      {msg === 'pause' && (
        <Notice kind="success">
          Vos réponses sont enregistrées. Pour reprendre plus tard, rouvrez simplement le lien reçu par e-mail : vous retrouverez le cahier là où vous l’avez laissé.
        </Notice>
      )}
      {error && <Notice kind="warning">{error}</Notice>}
      <BriefProgressBar steps={steps} current={current} percent={progress.percent} />
      <form method="post" action={base} enctype="multipart/form-data" class="form brief-form">
        <input type="hidden" name="etape" value={step.id} />
        <fieldset class="step">
          <legend>
            <span class="step-num">
              Étape {current + 1} sur {steps.length}
            </span>{' '}
            {step.title}
          </legend>
          {step.id === 'projet' && (
            <>
              <p>
                Bonjour{contact ? ` ${contact.name}` : ''}, ce questionnaire nous permet de préparer votre projet sans rien oublier. La plupart des réponses sont à cocher ;
                si une question ne vous parle pas, <strong>laissez-la vide</strong>, nous en parlerons ensemble.
              </p>
              <p class="small muted">Comptez 15 à 20 minutes. Vos réponses sont enregistrées à chaque étape : vous pouvez vous arrêter et reprendre plus tard avec le même lien.</p>
              <fieldset class="chips-field">
                <legend>Ce que nous allons préparer ensemble (vous pouvez ajuster)</legend>
                <div class="type-grid">
                  {BRIEF_MODULES.map((m) => (
                    <label class="type-card">
                      <input type="checkbox" name="modules" value={m.id} checked={b.modules.includes(m.id)} />
                      <span class="type-label">{m.label}</span>
                      <small>{m.hint}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div class="field">
                <label for="q-projet_resume">Votre projet en une ou deux phrases</label>
                <textarea id="q-projet_resume" name="projet_resume" rows={3} maxlength={2000} placeholder="Ex. : je m’installe à mon compte en avril et j’ai besoin d’un logo, de cartes de visite et d’un site simple.">
                  {String(b.answers.projet_resume ?? '')}
                </textarea>
              </div>
            </>
          )}
          {step.section && (
            <>
              {step.section.intro && <p class="muted">{step.section.intro}</p>}
              {step.section.questions.map((q) => (
                <BriefQuestion q={q} a={b.answers} />
              ))}
            </>
          )}
          {step.id === 'fin' && (
            <>
              <p>
                Dernière étape ! Ajoutez si vous le souhaitez votre logo actuel, des photos (de vos réalisations, de votre local, de votre véhicule…) ou tout document
                utile. Vérifiez ensuite vos réponses ci-dessous, puis envoyez votre cahier des charges.
              </p>
              <div class="field">
                <label for="f-fichiers">Fichiers (PDF, JPG, PNG ou WebP · {UPLOAD_LIMITS.maxFiles} fichiers de 10 Mo maximum par envoi)</label>
                <input type="file" id="f-fichiers" name="fichiers" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" />
              </div>
              {b.files.length > 0 && (
                <ul class="small">
                  {b.files.map((f) => (
                    <li>{f.name}</li>
                  ))}
                </ul>
              )}
              <p class="small">
                Avancement : {progress.answered} réponses sur {progress.total} questions ({progress.percent} %). Ce n’est pas grave s’il reste des questions vides.
              </p>
            </>
          )}
        </fieldset>
        {/* Le bouton principal est le premier du formulaire : la touche Entrée passe à l'étape suivante (ordre visuel fixé en CSS). */}
        <div class="wizard-nav brief-nav">
          {step.id === 'fin' ? (
            <button class="btn btn-primary" name="aller" value="envoyer" data-submit>
              Envoyer mon cahier des charges
            </button>
          ) : (
            <button class="btn btn-primary" name="aller" value="suivant" data-submit>
              Suivant →
            </button>
          )}
          {step.id === 'fin' && (
            <button class="btn btn-outline" name="aller" value="fichiers">
              Ajouter les fichiers
            </button>
          )}
          <button class="brief-pause" name="aller" value="pause">
            Enregistrer et finir plus tard
          </button>
          {current > 0 && (
            <button class="btn btn-outline brief-prev" name="aller" value="precedent">
              ← Précédent
            </button>
          )}
        </div>
      </form>
      {step.id === 'fin' && (
        <div class="brief-recap">
          <h2 class="h3">Vos réponses</h2>
          <BriefDocument sections={sections} a={b.answers} modulesText={modulesLabel(b.modules)} edit={(id) => `${base}?etape=${id}`} />
        </div>
      )}
    </Shell>,
  );
});

clientRoutes.post('/cahier/:token', async (c) => {
  const b = await briefByToken(c);
  if (!b) return notFound(c);
  const base = `/client/cahier/${b.token}`;
  if (b.status === 'termine') return c.redirect(base, 303);
  if (!(await allowRate(c, 'client-cahier', 300, 3600))) return c.text('Trop de tentatives.', 429);
  const deps = c.get('deps');
  const raw = (await c.req.parseBody({ all: true })) as Record<string, string | File | (string | File)[]>;
  const all = (k: string) => {
    const v = raw[k];
    return (Array.isArray(v) ? v : v == null ? [] : [v]).filter((x): x is string => typeof x === 'string');
  };
  const form = { all, get: (k: string) => (all(k).at(-1) ?? '').trim() };
  const stepId = form.get('etape');
  const go = form.get('aller');

  let { answers, modules, files } = b;
  if (stepId === 'projet') {
    modules = parseModules(all('modules'));
    answers = { ...answers, projet_resume: form.get('projet_resume').slice(0, 2000) };
    if (!modules.length) return c.redirect(`${base}?etape=projet&erreur=${encodeURIComponent('Choisissez au moins une prestation.')}`, 303);
  } else if (stepId === 'fin') {
    const uploads: UploadedFile[] = [];
    const list = (Array.isArray(raw.fichiers) ? raw.fichiers : raw.fichiers ? [raw.fichiers] : []).filter((f): f is File => typeof f !== 'string');
    for (const f of list) uploads.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    const checked = checkUploads(uploads);
    if (!checked.ok) return c.redirect(`${base}?etape=fin&erreur=${encodeURIComponent(checked.error)}`, 303);
    if (files.length + checked.files.length > 20) return c.redirect(`${base}?etape=fin&erreur=${encodeURIComponent('20 fichiers maximum au total.')}`, 303);
    if (checked.files.length) files = [...files, ...(await storeFiles(deps, checked.files, 'brief', b.id))];
  } else {
    const section = BRIEF_SECTIONS.find((x) => x.id === stepId);
    if (section) answers = readSectionAnswers(section, form, answers);
  }

  // Les étapes visibles peuvent changer selon les réponses : la navigation se fait sur la liste à jour.
  const steps = briefSteps({ modules, answers });
  const index = Math.max(0, steps.findIndex((x) => x.id === stepId));
  const target = go === 'precedent' ? steps[Math.max(0, index - 1)]! : go === 'suivant' ? steps[Math.min(steps.length - 1, index + 1)]! : steps[index]!;
  await saveBrief(deps, b, { answers, modules, files, step: target.id, status: 'en_cours' });

  if (go === 'envoyer') {
    await submitBrief(deps, c.get('settings'), { ...b, answers, modules, files }, new URL(c.req.url).origin);
    return c.redirect(base, 303);
  }
  if (go === 'pause') return c.redirect(`${base}?etape=${target.id}&ok=pause`, 303);
  return c.redirect(`${base}?etape=${target.id}`, 303);
});
