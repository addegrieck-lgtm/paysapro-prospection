import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../../app/context';
import { idParam, page, readForm, type FormData } from './helpers';
import { ActionButton, Badge, Csrf, Empty, F, Money, Sel, TA, eur } from '../../web/admin/ui';
import { SUBSCRIPTION_STATUSES, isOneOf } from '../../domain/statuses';
import { formatDate, formatDateTime, formatShortDate, isIsoDate, todayParis } from '../../domain/dates';
import { CONTRACT_STATUSES, FORMULA_LABELS, type Formula, discountedPrice, renewalNoticeWindow, terminationDate } from '../../domain/contracts';
import type { Settings } from '../../domain/settings';
import type { ContactRow, ServiceRow } from '../../repo/types';
import { ContractDocument } from '../../web/documents';
import {
  type ContractInput,
  type SubscriptionRow,
  closeEndedContracts,
  createContract,
  parseTerms,
  sendContract,
  sendRenewalNotice,
  terminateContract,
  updateContract,
} from '../../services/contracts';
import { siteLink } from '../../services/requests';

export const subscriptionRoutes = new Hono<AppEnv>();

/** Choix de la formule, avec le prix qui en découle pour chaque option. */
function FormulaFields({ s, formula, base }: { s: Settings; formula?: string; base?: number | null }) {
  return (
    <fieldset class="field field-wide">
      <legend>Formule</legend>
      <label class="check-line">
        <input type="radio" name="formula" value="sans_engagement" checked={formula !== 'engagement'} required /> <strong>Sans engagement</strong> — prix de base,
        résiliable à tout moment avec {s.subscriptionNoticeMonths} mois de préavis
      </label>
      <label class="check-line">
        <input type="radio" name="formula" value="engagement" checked={formula === 'engagement'} /> <strong>Engagement {s.subscriptionCommitmentMonths} mois</strong> — remise de{' '}
        {s.subscriptionDiscountPercent} %{base ? ` (soit ${eur(discountedPrice(base, s.subscriptionDiscountPercent))} HT / mois)` : ''}, puis de mois en mois
      </label>
      <small class="muted">Remise, durée et préavis se règlent dans Paramètres → Abonnements.</small>
    </fieldset>
  );
}

function ContractFields({ s, services, contacts, sub, extra }: { s: Settings; services: ServiceRow[]; contacts?: ContactRow[]; sub?: SubscriptionRow; extra?: string }) {
  return (
    <div class="form-grid">
      {contacts && (
        <Sel label="Client" name="contact_id" required value={String(sub?.contact_id ?? '')} options={contacts.map((x) => [String(x.id), `${x.name}${x.company ? ` — ${x.company}` : ''}`] as const)} empty="Choisir…" />
      )}
      <Sel
        label="Prestation"
        name="service_slug"
        value={sub?.service_slug ?? ''}
        options={services.map((x) => [x.slug, `${x.name}${x.price_ht != null ? ` (à partir de ${eur(x.price_ht)} HT / mois)` : ''}`] as const)}
        empty="Autre"
      />
      <F label="Libellé (vu par le client)" name="label" required max={160} value={sub?.label} placeholder="Ex. : Maintenance du site menuiserie-durand.fr" />
      <Money label="Prix mensuel HT sans engagement" name="base_monthly_ht" cents={sub?.base_monthly_ht ?? null} required help="La remise est calculée automatiquement si le client choisit l’engagement." />
      <F label="Date de début" name="start_date" type="date" required value={sub?.start_date ?? todayParis()} />
      <FormulaFields s={s} formula={sub?.formula} base={sub?.base_monthly_ht} />
      <TA label="Précisions propres à ce client (facultatif)" name="extra" rows={3} max={2000} value={extra} help="Ex. : 1 h de modifications par mois, intervention sous 2 jours ouvrés, site concerné, accès fournis." />
    </div>
  );
}

function readContract(f: FormData): Omit<ContractInput, 'contactId'> | null {
  const base = f.money('base_monthly_ht');
  const start = f.get('start_date');
  const formula = f.get('formula') as Formula;
  if (!f.get('label') || base == null || base <= 0 || !isIsoDate(start) || !(formula in FORMULA_LABELS)) return null;
  return { serviceSlug: f.get('service_slug').slice(0, 80), label: f.get('label').slice(0, 160), formula, baseMonthlyHt: base, startDate: start, extra: f.get('extra').slice(0, 2000) };
}

const monthlyServices = (c: Ctx) => c.get('deps').db.all<ServiceRow>("SELECT slug, name, price_ht FROM services WHERE billing = 'monthly' ORDER BY sort_order");

subscriptionRoutes.get('/abonnements', async (c) => {
  const { db } = c.get('deps');
  await closeEndedContracts(c.get('deps'));
  const rows = await db.all<SubscriptionRow & { name: string }>(
    "SELECT s.*, ct.name FROM subscriptions s JOIN contacts ct ON ct.id = s.contact_id ORDER BY CASE s.status WHEN 'en_attente' THEN 0 WHEN 'actif' THEN 1 WHEN 'suspendu' THEN 2 ELSE 3 END, s.start_date DESC",
  );
  const contacts = await db.all<ContactRow>('SELECT id, name, company FROM contacts ORDER BY name LIMIT 500');
  const services = await monthlyServices(c);
  const mrr = rows.filter((r) => r.status === 'actif').reduce((s, r) => s + r.monthly_ht, 0);
  const s = c.get('settings');
  return page(
    c,
    'Abonnements et contrats',
    <>
      <p>
        Revenu mensuel récurrent (abonnements actifs) : <strong>{eur(mrr)} HT</strong>
      </p>
      {rows.length === 0 ? (
        <Empty>Aucun abonnement. Établissez un contrat ci-dessous : le client le signe en ligne et l’abonnement devient actif.</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Client</th>
                <th>Abonnement</th>
                <th>Formule</th>
                <th class="num">Mensuel HT</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Contrat</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr>
                  <td>
                    <a href={`/admin/crm/${r.contact_id}`}>{r.name}</a>
                  </td>
                  <td>
                    <a href={`/admin/abonnements/${r.id}`}>{r.label}</a>
                    {r.number && <div class="small muted">{r.number}</div>}
                  </td>
                  <td>{r.formula ? (r.formula === 'engagement' ? `${r.commitment_months} mois (−${r.discount_percent} %)` : 'Sans engagement') : <span class="muted">—</span>}</td>
                  <td class="num">{eur(r.monthly_ht)}</td>
                  <td>{formatShortDate(r.start_date)}</td>
                  <td>{formatShortDate(r.end_date)}</td>
                  <td>{r.contract_status ? <Badge options={CONTRACT_STATUSES} value={r.contract_status} /> : <span class="muted small">Sans contrat</span>}</td>
                  <td>
                    <Badge options={SUBSCRIPTION_STATUSES} value={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form method="post" action="/admin/abonnements" class="panel" id="nouveau" style="margin-top:1.25rem">
        <Csrf token={c.get('csrf')} />
        <h2>Nouveau contrat d’abonnement</h2>
        <ContractFields s={s} services={services} contacts={contacts} sub={c.req.query('contact') ? ({ contact_id: Number(c.req.query('contact')) } as SubscriptionRow) : undefined} />
        <div class="form-actions">
          <button class="btn btn-primary">Établir le contrat</button>
        </div>
      </form>
    </>,
    { error: c.req.query('erreur') ? 'Client, libellé, prix, date de début et formule sont obligatoires.' : undefined },
  );
});

subscriptionRoutes.post('/abonnements', async (c) => {
  const f = await readForm(c);
  const ct = await c.get('deps').db.get<{ id: number }>('SELECT id FROM contacts WHERE id = ?', [f.int('contact_id') ?? 0]);
  const input = readContract(f);
  if (!ct || !input) return c.redirect('/admin/abonnements?erreur=1#nouveau', 303);
  const id = await createContract(c.get('deps'), c.get('settings'), { ...input, contactId: ct.id });
  return c.redirect(`/admin/abonnements/${id}?ok=created`, 303);
});

async function load(c: Ctx) {
  const sub = await c.get('deps').db.get<SubscriptionRow>('SELECT * FROM subscriptions WHERE id = ?', [idParam(c)]);
  if (!sub) return null;
  const contact = (await c.get('deps').db.get<ContactRow>('SELECT * FROM contacts WHERE id = ?', [sub.contact_id]))!;
  return { sub, contact };
}

subscriptionRoutes.get('/abonnements/:id', async (c) => {
  await closeEndedContracts(c.get('deps'));
  const data = await load(c);
  if (!data) return c.notFound();
  const { sub, contact } = data;
  const s = c.get('settings');
  const csrf = c.get('csrf');
  const today = todayParis();
  const statusForm = (
    <form method="post" action={`/admin/abonnements/${sub.id}/statut`} class="inline-form">
      <Csrf token={csrf} />
      <select name="status" aria-label="Statut">
        {SUBSCRIPTION_STATUSES.map(([v, l]) => (
          <option value={v} selected={v === sub.status}>
            {l}
          </option>
        ))}
      </select>{' '}
      <button class="btn btn-outline btn-sm">OK</button>
    </form>
  );

  // Abonnement saisi avant les contrats : simple suivi, avec possibilité d'établir un contrat.
  if (!sub.formula) {
    return page(
      c,
      sub.label,
      <div class="panel">
        <p>
          Abonnement suivi sans contrat : {eur(sub.monthly_ht)} HT / mois depuis le {formatDate(sub.start_date)} pour{' '}
          <a href={`/admin/crm/${contact.id}`}>{contact.name}</a>.
        </p>
        {sub.notes && <p class="small" style="white-space:pre-line">{sub.notes}</p>}
        <p>Statut : {statusForm}</p>
        <a class="btn btn-primary" href={`/admin/abonnements?contact=${contact.id}#nouveau`}>
          Établir un contrat pour ce client
        </a>
      </div>,
    );
  }

  const link = siteLink(s, new URL(c.req.url).origin, `/client/contrat/${sub.token}`);
  const terms = parseTerms(sub);
  const noticeWindow = contact.customer_type === 'particulier' && sub.contract_status === 'signe' ? renewalNoticeWindow(sub.start_date, sub.commitment_months) : null;
  const noticeDue = noticeWindow && !sub.renewal_notice_at && today >= noticeWindow.from;
  return page(
    c,
    `${sub.label} — ${sub.number}`,
    <>
      <div class="cols no-print">
        <div class="panel">
          <h2>Contrat</h2>
          <dl class="kv">
            <dt>Client</dt>
            <dd>
              <a href={`/admin/crm/${contact.id}`}>{contact.name}</a>
              {contact.company ? ` — ${contact.company}` : ''} ({contact.customer_type === 'particulier' ? 'particulier' : 'professionnel'})
            </dd>
            <dt>Contrat</dt>
            <dd>
              <Badge options={CONTRACT_STATUSES} value={sub.contract_status} />
            </dd>
            <dt>Abonnement</dt>
            <dd>{statusForm}</dd>
            <dt>Formule</dt>
            <dd>{sub.formula === 'engagement' ? `Engagement ${sub.commitment_months} mois, remise ${sub.discount_percent} %` : 'Sans engagement'}</dd>
            <dt>Prix</dt>
            <dd>{eur(sub.monthly_ht)} HT / mois</dd>
            <dt>Envoyé le</dt>
            <dd>{formatDateTime(sub.sent_at)}</dd>
            <dt>Signé le</dt>
            <dd>{sub.signed_at ? `${formatDateTime(sub.signed_at)} par ${sub.signed_name}` : '—'}</dd>
            {sub.end_date && (
              <>
                <dt>Fin</dt>
                <dd>{formatDate(sub.end_date)}</dd>
              </>
            )}
          </dl>
          {noticeDue && (
            <div class="alert alert-error" style="margin-top:.75rem">
              Client particulier : l’avis de fin d’engagement doit être envoyé au plus tard le {formatDate(noticeWindow!.to)} (art. L215-1 du Code de la consommation).
            </div>
          )}
          {noticeWindow && sub.renewal_notice_at && <p class="small muted">Avis de fin d’engagement envoyé le {formatDateTime(sub.renewal_notice_at)}.</p>}
        </div>
        <div class="panel">
          <h2>Lien du client</h2>
          <div class="copy-row">
            <input readonly value={link} aria-label="Lien du contrat" />
            <button type="button" class="btn btn-outline btn-sm" data-copy={link}>
              Copier
            </button>
          </div>
          <p class="small muted">Le client y lit et signe son contrat, puis peut le consulter ou le résilier en ligne.</p>
          <div class="page-actions" style="margin-top:.75rem">
            {sub.contract_status === 'a_signer' && (
              <ActionButton
                action={`/admin/abonnements/${sub.id}/envoyer`}
                csrf={csrf}
                label={sub.sent_at ? 'Renvoyer par e-mail' : 'Envoyer pour signature'}
                cls="btn-primary"
                confirm={`Envoyer le contrat à ${contact.email || 'ce contact'} ?`}
              />
            )}
            {noticeWindow && (
              <ActionButton
                action={`/admin/abonnements/${sub.id}/avis-fin-engagement`}
                csrf={csrf}
                label={sub.renewal_notice_at ? 'Renvoyer l’avis de fin d’engagement' : 'Envoyer l’avis de fin d’engagement'}
                cls={noticeDue ? 'btn-primary' : 'btn-outline'}
              />
            )}
            {sub.contract_status === 'signe' && (
              <ActionButton
                action={`/admin/abonnements/${sub.id}/resilier`}
                csrf={csrf}
                label="Enregistrer une résiliation"
                cls="btn-danger"
                confirm={`Résiliation demandée aujourd’hui : fin le ${formatDate(terminationDate(today, sub.start_date, sub.commitment_months, sub.notice_months))}. Confirmer ?`}
              />
            )}
            <button type="button" class="btn btn-outline btn-sm" data-print>
              Imprimer / PDF
            </button>
          </div>
        </div>
      </div>

      <ContractDocument s={s} sub={sub} terms={terms} contact={contact} />

      {sub.contract_status === 'a_signer' && (
        <form method="post" action={`/admin/abonnements/${sub.id}`} class="panel no-print" style="margin-top:1.25rem">
          <Csrf token={csrf} />
          <h2>Modifier le contrat (avant signature)</h2>
          <ContractFields s={s} services={await monthlyServices(c)} sub={sub} extra={terms.extra} />
          <div class="form-actions">
            <button class="btn btn-outline">Enregistrer</button>
          </div>
        </form>
      )}
    </>,
    { wide: true },
  );
});

subscriptionRoutes.post('/abonnements/:id', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  const input = readContract(await readForm(c));
  if (!input || !(await updateContract(c.get('deps'), c.get('settings'), data.sub, input))) return c.redirect(`/admin/abonnements/${data.sub.id}`, 303);
  return c.redirect(`/admin/abonnements/${data.sub.id}?ok=saved`, 303);
});

subscriptionRoutes.post('/abonnements/:id/envoyer', async (c) => {
  const data = await load(c);
  if (!data || data.sub.contract_status !== 'a_signer') return c.notFound();
  const r = await sendContract(c.get('deps'), c.get('settings'), data.sub, data.contact, new URL(c.req.url).origin);
  return c.redirect(`/admin/abonnements/${data.sub.id}?ok=${r.ok ? 'sent' : 'mailfail'}`, 303);
});

subscriptionRoutes.post('/abonnements/:id/avis-fin-engagement', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  const r = await sendRenewalNotice(c.get('deps'), c.get('settings'), data.sub, data.contact, new URL(c.req.url).origin);
  return c.redirect(`/admin/abonnements/${data.sub.id}?ok=${r.ok ? 'sent' : 'mailfail'}`, 303);
});

subscriptionRoutes.post('/abonnements/:id/resilier', async (c) => {
  const data = await load(c);
  if (!data) return c.notFound();
  await terminateContract(c.get('deps'), c.get('settings'), data.sub, c.get('user')!.name, new URL(c.req.url).origin);
  return c.redirect(`/admin/abonnements/${data.sub.id}?ok=status`, 303);
});

subscriptionRoutes.post('/abonnements/:id/statut', async (c) => {
  const f = await readForm(c);
  if (isOneOf(SUBSCRIPTION_STATUSES, f.get('status'))) await c.get('deps').db.run('UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?', [f.get('status'), new Date().toISOString(), idParam(c)]);
  return c.redirect(`/admin/abonnements/${idParam(c)}?ok=status`, 303);
});
