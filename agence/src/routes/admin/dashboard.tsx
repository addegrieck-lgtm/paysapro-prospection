import { Hono } from 'hono';
import type { AppEnv } from '../../app/context';
import { page, readForm } from './helpers';
import { Csrf, Kpi, eur } from '../../web/admin/ui';
import { missingLegalInfo } from '../../domain/settings';
import { addDays, todayParis, formatShortDate } from '../../domain/dates';
import { ACTIVE_ORDER_STATUSES, ORDER_STATUSES, labelOf } from '../../domain/statuses';
import { computeMargin } from '../../domain/margin';
import { effectiveStatus, costChangedSinceValidation, type VariantRow } from '../../domain/print';
import { hashPassword, passwordProblem, verifyPassword } from '../../lib/crypto';
import { audit } from '../../repo/settings';
import { renewalNoticeWindow } from '../../domain/contracts';
import { closeEndedContracts } from '../../services/contracts';

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get('/', async (c) => {
  const { db, mailer } = c.get('deps');
  const s = c.get('settings');
  const today = todayParis();
  const year = today.slice(0, 4);
  const n = async (sql: string, params: (string | number)[] = []) => (await db.get<{ n: number }>(sql, params))?.n ?? 0;
  const active = ACTIVE_ORDER_STATUSES.map(() => '?').join(',');

  await closeEndedContracts(c.get('deps'));
  const contractsToSign = await n("SELECT COUNT(*) AS n FROM subscriptions WHERE contract_status = 'a_signer'");
  const renewalNotices = (
    await db.all<{ id: number; label: string; start_date: string; commitment_months: number }>(
      `SELECT s.id, s.label, s.start_date, s.commitment_months FROM subscriptions s JOIN contacts ct ON ct.id = s.contact_id
       WHERE ct.customer_type = 'particulier' AND s.contract_status = 'signe' AND s.commitment_months > 0 AND s.renewal_notice_at IS NULL`,
    )
  ).filter((r) => {
    const w = renewalNoticeWindow(r.start_date, r.commitment_months);
    return w && today >= w.from;
  });
  const weekVisitors = await n('SELECT COUNT(*) AS n FROM (SELECT DISTINCT day, visitor FROM page_views WHERE status = 200 AND day > ?)', [addDays(today, -7)]);
  const [contacts, newContacts, newRequests, quotesPending, quotesAccepted, ordersActive, invoicesOpen, invoicesOverdue, subs] = await Promise.all([
    n('SELECT COUNT(*) AS n FROM contacts'),
    n("SELECT COUNT(*) AS n FROM contacts WHERE status IN ('nouveau', 'a_contacter')"),
    n("SELECT COUNT(*) AS n FROM quote_requests WHERE status = 'nouvelle'"),
    n("SELECT COUNT(*) AS n FROM quotes WHERE status = 'envoye'"),
    n("SELECT COUNT(*) AS n FROM quotes WHERE status = 'accepte' AND substr(decided_at, 1, 4) = ?", [year]),
    n(`SELECT COUNT(*) AS n FROM print_orders WHERE status IN (${active})`, ACTIVE_ORDER_STATUSES),
    db.get<{ n: number; total: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(total_ttc), 0) AS total FROM invoices WHERE status = 'emise' AND type = 'facture'"),
    n("SELECT COUNT(*) AS n FROM invoices WHERE status = 'emise' AND type = 'facture' AND due_date < ?", [today]),
    db.get<{ n: number; mrr: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(monthly_ht), 0) AS mrr FROM subscriptions WHERE status = 'actif'"),
  ]);

  // Chiffre d'affaires facturé (factures émises ou payées, avoirs déduits) et coûts directs enregistrés.
  const revenue = await db.get<{ ht: number; cost: number }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'avoir' THEN -total_ht ELSE total_ht END), 0) AS ht,
            COALESCE(SUM(CASE WHEN type = 'avoir' THEN -cost_ht ELSE cost_ht END), 0) AS cost
     FROM invoices WHERE status IN ('emise', 'payee') AND substr(issue_date, 1, 4) = ?`,
    [year],
  );
  const supplierCosts = await n(`SELECT COALESCE(SUM(supplier_cost_ht), 0) AS n FROM print_orders WHERE supplier_ordered_at IS NOT NULL AND substr(supplier_ordered_at, 1, 4) = ?`, [year]);
  const margin = computeMargin(revenue?.ht ?? 0, revenue?.cost ?? 0);

  const lateProjects = await db.all<{ id: number; name: string; due_date: string }>(
    "SELECT id, name, due_date FROM web_projects WHERE due_date < ? AND status IN ('brief', 'conception', 'developpement', 'recette') ORDER BY due_date",
    [today],
  );
  const lateOrders = await db.all<{ id: number; number: string; estimated_delivery: string; status: string }>(
    `SELECT id, number, estimated_delivery, status FROM print_orders WHERE estimated_delivery < ? AND status IN ('commande_passee', 'en_production', 'expedie') ORDER BY estimated_delivery`,
    [today],
  );
  const actions = await db.all<{ id: number; name: string; company: string; next_action: string; next_action_at: string }>(
    "SELECT id, name, company, next_action, next_action_at FROM contacts WHERE next_action_at IS NOT NULL AND next_action_at <= ? AND status NOT IN ('gagne', 'perdu') ORDER BY next_action_at LIMIT 10",
    [today],
  );
  const variants = await db.all<VariantRow & { id: number }>('SELECT * FROM supplier_price_variants');
  const now = new Date();
  const toVerify = variants.filter((v) => effectiveStatus(v, now, s.supplierPriceValidityDays) === 'a_verifier').length;
  const expired = variants.filter((v) => effectiveStatus(v, now, s.supplierPriceValidityDays) === 'expire').length;
  const costChanged = variants.filter((v) => costChangedSinceValidation(v)).length;
  const missing = missingLegalInfo(s);
  const pendingOrders = await db.all<{ id: number; number: string; status: string; description: string }>(
    `SELECT id, number, status, description FROM print_orders WHERE status IN (${active}) ORDER BY updated_at DESC LIMIT 8`,
    ACTIVE_ORDER_STATUSES,
  );

  return page(
    c,
    'Tableau de bord',
    <>
      {(!s.nameConfirmed || missing.length > 0 || mailer.provider === 'log' || toVerify + expired + costChanged + contractsToSign + renewalNotices.length > 0) && (
        <div class="panel">
          <h2>À faire</h2>
          <ul>
            {!s.nameConfirmed && (
              <li>
                Le nom « {s.agencyName} » est <strong>provisoire</strong>. <a href="/admin/parametres">Le confirmer ou le changer</a>.
              </li>
            )}
            {missing.length > 0 && (
              <li>
                Informations légales manquantes ({missing.length}) : {missing.join(', ')}. <a href="/admin/parametres#legal">Compléter</a> — l’émission de factures est
                bloquée tant qu’elles manquent.
              </li>
            )}
            {mailer.provider === 'log' && (
              <li>
                Aucun service d’e-mail n’est configuré : les e-mails sont simulés et visibles dans <a href="/admin/emails">E-mails envoyés</a> (voir la documentation de
                déploiement).
              </li>
            )}
            {renewalNotices.map((r) => (
              <li>
                <strong>Avis de fin d’engagement à envoyer</strong> (client particulier, obligation légale) : <a href={`/admin/abonnements/${r.id}`}>{r.label}</a>
              </li>
            ))}
            {contractsToSign > 0 && (
              <li>
                {contractsToSign} contrat(s) d’abonnement en attente de signature. <a href="/admin/abonnements">Voir</a>
              </li>
            )}
            {toVerify > 0 && (
              <li>
                {toVerify} prix fournisseur à vérifier. <a href="/admin/impression/tarifs?statut=a_verifier">Voir</a>
              </li>
            )}
            {expired > 0 && (
              <li>
                <strong>{expired} prix fournisseur expiré(s)</strong> (vérification de plus de {s.supplierPriceValidityDays} jours) : ils ne sont plus affichés au public.{' '}
                <a href="/admin/impression/tarifs?statut=expire">Revérifier</a>
              </li>
            )}
            {costChanged > 0 && (
              <li>
                <strong>{costChanged} coût(s) fournisseur modifié(s)</strong> depuis la validation du prix de vente : décision requise.{' '}
                <a href="/admin/impression/tarifs?statut=cout_modifie">Décider</a>
              </li>
            )}
          </ul>
        </div>
      )}
      <div class="grid-kpi">
        <Kpi label="Visiteurs du site (7 jours)" value={weekVisitors} hint="Provenance, pages, appareils" href="/admin/statistiques" />
        <Kpi label="Prospects (total)" value={contacts} hint={`${newContacts} à traiter`} href="/admin/crm" />
        <Kpi label="Nouvelles demandes de devis" value={newRequests} href="/admin/demandes" tone={newRequests ? 'warn' : undefined} />
        <Kpi label="Devis en attente de réponse" value={quotesPending} href="/admin/devis?statut=envoye" />
        <Kpi label={`Devis acceptés (${year})`} value={quotesAccepted} href="/admin/devis?statut=accepte" />
        <Kpi label="Commandes d’impression en cours" value={ordersActive} href="/admin/commandes" />
        <Kpi label="Factures à suivre" value={invoicesOpen?.n ?? 0} hint={`${eur(invoicesOpen?.total ?? 0)} TTC · ${invoicesOverdue} en retard`} href="/admin/factures?statut=emise" tone={invoicesOverdue ? 'warn' : undefined} />
        <Kpi label={`CA facturé HT (${year})`} value={eur(revenue?.ht ?? 0)} hint="Factures émises, avoirs déduits" href="/admin/factures" />
        <Kpi label={`Coûts directs facturés (${year})`} value={eur(revenue?.cost ?? 0)} hint={`Dont commandes fournisseur passées : ${eur(supplierCosts)}`} />
        <Kpi label={`Marge brute estimée (${year})`} value={eur(margin.grossMargin)} hint={margin.markRate == null ? 'Aucune facture' : `Taux de marque ${String(margin.markRate).replace('.', ',')} %`} href="/admin/marges" />
        <Kpi label="Abonnements actifs" value={subs?.n ?? 0} hint={`${eur(subs?.mrr ?? 0)} HT / mois`} href="/admin/abonnements" />
        <Kpi label="Projets ou commandes en retard" value={lateProjects.length + lateOrders.length} tone={lateProjects.length + lateOrders.length ? 'warn' : 'good'} />
      </div>
      <p class="small muted">
        Toutes les statistiques sont calculées à partir des données enregistrées. La marge brute exclut frais généraux, cotisations et impôts.
      </p>
      <div class="cols">
        <div class="panel">
          <h2>Relances prévues (aujourd’hui ou en retard)</h2>
          {actions.length === 0 ? (
            <p class="muted">Aucune relance en attente.</p>
          ) : (
            <ul>
              {actions.map((a) => (
                <li>
                  <a href={`/admin/crm/${a.id}`}>{a.name}</a>
                  {a.company ? ` (${a.company})` : ''} — {a.next_action || 'Relancer'} <span class="muted">({formatShortDate(a.next_action_at)})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div class="panel">
          <h2>Retards</h2>
          {lateProjects.length + lateOrders.length === 0 ? (
            <p class="muted">Aucun retard.</p>
          ) : (
            <ul>
              {lateProjects.map((p) => (
                <li>
                  Projet <a href={`/admin/projets/${p.id}`}>{p.name}</a> — livraison prévue le {formatShortDate(p.due_date)}
                </li>
              ))}
              {lateOrders.map((o) => (
                <li>
                  Commande <a href={`/admin/commandes/${o.id}`}>{o.number}</a> ({labelOf(ORDER_STATUSES, o.status)}) — livraison estimée le {formatShortDate(o.estimated_delivery)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div class="panel">
        <h2>Commandes d’impression en cours</h2>
        {pendingOrders.length === 0 ? (
          <p class="muted">Aucune commande en cours.</p>
        ) : (
          <ul>
            {pendingOrders.map((o) => (
              <li>
                <a href={`/admin/commandes/${o.id}`}>{o.number}</a> — {labelOf(ORDER_STATUSES, o.status)} — <span class="muted">{o.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>,
  );
});

// ─── Mon compte ───

function AccountForm({ csrf }: { csrf: string }) {
  return (
    <div class="panel" style="max-width:520px">
      <h2>Changer de mot de passe</h2>
      <form method="post" action="/admin/compte" class="form-grid">
        <Csrf token={csrf} />
        <div class="field field-wide">
          <label for="current">Mot de passe actuel</label>
          <input id="current" name="current" type="password" required autocomplete="current-password" />
        </div>
        <div class="field field-wide">
          <label for="pw">Nouveau mot de passe (12 caractères minimum, lettres et chiffres)</label>
          <input id="pw" name="password" type="password" required minlength={12} autocomplete="new-password" />
        </div>
        <div class="field field-wide">
          <label for="pw2">Confirmation</label>
          <input id="pw2" name="password2" type="password" required minlength={12} autocomplete="new-password" />
        </div>
        <div class="form-actions">
          <button class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

dashboardRoutes.get('/compte', (c) => page(c, 'Mon compte', <AccountForm csrf={c.get('csrf')} />));
dashboardRoutes.post('/compte', async (c) => {
  const f = await readForm(c);
  const { db } = c.get('deps');
  const user = c.get('user')!;
  const row = await db.get<{ password_hash: string }>('SELECT password_hash FROM admin_users WHERE id = ?', [user.id]);
  if (!row || !(await verifyPassword(f.get('current'), row.password_hash))) return page(c, 'Mon compte', <AccountForm csrf={c.get('csrf')} />, { error: 'Mot de passe actuel incorrect.', status: 422 });
  const pw = f.get('password');
  const problem = passwordProblem(pw) ?? (pw !== f.get('password2') ? 'Les mots de passe ne correspondent pas.' : null);
  if (problem) return page(c, 'Mon compte', <AccountForm csrf={c.get('csrf')} />, { error: problem, status: 422 });
  await db.run('UPDATE admin_users SET password_hash = ? WHERE id = ?', [await hashPassword(pw), user.id]);
  // Les autres sessions de ce compte sont fermées.
  await db.run('DELETE FROM sessions WHERE user_id = ? AND csrf <> ?', [user.id, c.get('csrf')]);
  await audit(db, user.id, 'changement-mot-de-passe');
  return c.redirect('/admin/compte?ok=saved', 303);
});
