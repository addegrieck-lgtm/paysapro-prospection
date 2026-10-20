import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../../app/context';
import { page, readForm, pageNum, PAGE_SIZE } from './helpers';
import { Badge, Check, Csrf, Empty, F, Money, Pager, Sel, TA } from '../../web/admin/ui';
import { missingLegalInfo, settingsSchema, type Settings } from '../../domain/settings';
import { saveSettings, audit } from '../../repo/settings';
import { formatDateTime } from '../../domain/dates';

export const settingsRoutes = new Hono<AppEnv>();

function SettingsForm({ s, c }: { s: Settings; c: Ctx }) {
  const l = s.legal;
  const missing = missingLegalInfo(s);
  return (
    <form method="post" action="/admin/parametres">
      <Csrf token={c.get('csrf')} />
      <div class="panel">
        <h2>Identité de l’agence</h2>
        <div class="form-grid">
          <F label="Nom de l’agence" name="agencyName" value={s.agencyName} required max={60} help="Utilisé partout : site, logo provisoire (initiales), e-mails, documents." />
          <Check label="Nom définitif (vérifié : disponibilité, marque, nom de domaine)" name="nameConfirmed" checked={s.nameConfirmed} />
          <F label="Signature (accroche)" name="tagline" value={s.tagline} max={140} wide />
          <F label="Couleur d’accent" name="accentColor" type="color" value={s.accentColor} help="Vérifiez le contraste avec le texte blanc des boutons." />
          <F label="Adresse du site (https://…)" name="siteUrl" type="url" value={s.siteUrl} max={200} help="Sert aux liens canoniques, au sitemap et aux liens des e-mails." />
          <F label="E-mail de contact public" name="contactEmail" type="email" value={s.contactEmail} max={200} />
          <F label="Téléphone public" name="contactPhone" type="tel" value={s.contactPhone} max={40} />
          <F label="Zone d’intervention" name="serviceArea" value={s.serviceArea} max={200} />
          <F label="Horaires" name="openingHours" value={s.openingHours} max={200} />
          <F label="E-mail des notifications internes" name="notifyEmail" type="email" value={s.notifyEmail} max={200} help="Reçoit les nouvelles demandes, acceptations de devis et de BAT." />
        </div>
      </div>
      <div class="panel" id="legal">
        <h2>Informations légales</h2>
        {missing.length > 0 ? (
          <div class="alert alert-warning">À compléter : {missing.join(', ')}. N’inventez aucune information : utilisez celles de votre immatriculation.</div>
        ) : (
          <div class="alert alert-success">Informations légales essentielles renseignées.</div>
        )}
        <div class="form-grid">
          <F label="Dénomination sociale ou nom de l’entrepreneur" name="legal.companyName" value={l.companyName} max={200} />
          <F label="Forme juridique" name="legal.legalForm" value={l.legalForm} max={120} help="Ex. : Entrepreneur individuel (EI), SASU, EURL…" />
          <F label="Capital social (sociétés)" name="legal.capital" value={l.capital} max={60} />
          <F label="SIREN" name="legal.siren" value={l.siren} max={20} />
          <F label="SIRET" name="legal.siret" value={l.siret} max={20} />
          <F label="Immatriculation (RCS / RNE + ville)" name="legal.registry" value={l.registry} max={160} />
          <F label="N° de TVA intracommunautaire" name="legal.vatNumber" value={l.vatNumber} max={30} />
          <TA label="Adresse du siège / de domiciliation" name="legal.address" value={l.address} rows={2} max={300} />
          <F label="Directeur de la publication" name="legal.publicationDirector" value={l.publicationDirector} max={120} />
          <F label="Hébergeur — nom" name="legal.hostName" value={l.hostName} max={200} />
          <F label="Hébergeur — adresse" name="legal.hostAddress" value={l.hostAddress} max={300} />
          <F label="Hébergeur — contact" name="legal.hostContact" value={l.hostContact} max={200} />
          <F label="Médiateur de la consommation — nom" name="legal.mediatorName" value={l.mediatorName} max={200} help="Obligatoire si vous vendez à des particuliers." />
          <F label="Médiateur — site web" name="legal.mediatorUrl" type="url" value={l.mediatorUrl} max={300} />
          <F label="Assurance RC professionnelle (assureur, couverture)" name="legal.insurance" value={l.insurance} max={300} />
          <F label="IBAN (affiché sur les factures)" name="legal.iban" value={l.iban} max={60} />
        </div>
      </div>
      <div class="panel">
        <h2>TVA, devis et paiement</h2>
        <div class="form-grid">
          <Sel label="Régime de TVA" name="vatMode" value={s.vatMode} options={[['normal', 'Assujetti à la TVA'], ['franchise', 'Franchise en base (art. 293 B du CGI)']]} />
          <F label="Taux de TVA (%)" name="vatRate" value={String(s.vatRate).replace('.', ',')} help="Taux normal : 20 %." />
          <F label="Validité des devis (jours)" name="quoteValidityDays" type="number" value={s.quoteValidityDays} />
          <F label="Délai de paiement (jours)" name="paymentTermsDays" type="number" value={s.paymentTermsDays} help="30 jours maximum par défaut entre professionnels (60 jours sur accord)." />
          <F label="Acompte par défaut (%)" name="depositPercent" type="number" value={s.depositPercent} />
          <F label="Taux des pénalités de retard" name="latePenaltyRate" value={s.latePenaltyRate} max={200} />
        </div>
      </div>
      <div class="panel">
        <h2>Impression et marges</h2>
        <div class="form-grid">
          <F label="Validité d’un prix fournisseur vérifié (jours)" name="supplierPriceValidityDays" type="number" value={s.supplierPriceValidityDays} help="Au-delà, le prix est considéré expiré et n’est plus affiché." />
          <F label="Coefficient suggéré sur l’impression (%)" name="printMarkupPercent" value={String(s.printMarkupPercent).replace('.', ',')} help="Simple suggestion affichée dans le référentiel ; jamais appliquée automatiquement." />
          <Money label="Coût horaire interne (pour valoriser le temps)" name="internalHourlyCost" cents={s.internalHourlyCost} help="0 = le temps de travail n’est pas compté dans les coûts directs." />
        </div>
      </div>
      <div class="panel">
        <h2>Mesure d’audience et Search Console</h2>
        <div class="form-grid">
          <Sel
            label="Outil de mesure d’audience"
            name="analyticsProvider"
            value={s.analyticsProvider}
            options={[
              ['none', 'Aucun'],
              ['plausible', 'Plausible (sans cookie, pas de bandeau requis)'],
              ['ga4', 'Google Analytics 4 (consentement requis : bandeau affiché)'],
            ]}
          />
          <F label="Plausible — domaine" name="plausibleDomain" value={s.plausibleDomain} max={200} />
          <F label="Google Analytics — ID de mesure (G-…)" name="ga4Id" value={s.ga4Id} max={40} />
          <F label="Google Search Console — code de vérification (balise meta)" name="searchConsoleToken" value={s.searchConsoleToken} max={200} help="Uniquement la valeur de l’attribut content." />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Enregistrer les paramètres</button>
      </div>
    </form>
  );
}

settingsRoutes.get('/parametres', (c) => page(c, 'Paramètres', <SettingsForm s={c.get('settings')} c={c} />));

settingsRoutes.post('/parametres', async (c) => {
  const f = await readForm(c);
  const cur = c.get('settings');
  const dec = (k: string) => Number(f.get(k).replace(',', '.'));
  const legal = Object.fromEntries(Object.keys(cur.legal).map((k) => [k, f.get(`legal.${k}`)])) as Settings['legal'];
  legal.siren = legal.siren.replace(/\s/g, '');
  legal.siret = legal.siret.replace(/\s/g, '');
  const candidate = {
    agencyName: f.get('agencyName'),
    tagline: f.get('tagline'),
    nameConfirmed: f.bool('nameConfirmed'),
    accentColor: f.get('accentColor') || cur.accentColor,
    siteUrl: f.get('siteUrl').replace(/\/+$/, ''),
    contactEmail: f.get('contactEmail'),
    contactPhone: f.get('contactPhone'),
    serviceArea: f.get('serviceArea'),
    openingHours: f.get('openingHours'),
    notifyEmail: f.get('notifyEmail'),
    legal,
    vatMode: f.get('vatMode'),
    vatRate: dec('vatRate'),
    quoteValidityDays: dec('quoteValidityDays'),
    paymentTermsDays: dec('paymentTermsDays'),
    latePenaltyRate: f.get('latePenaltyRate'),
    depositPercent: dec('depositPercent'),
    supplierPriceValidityDays: dec('supplierPriceValidityDays'),
    printMarkupPercent: dec('printMarkupPercent'),
    internalHourlyCost: f.money('internalHourlyCost') ?? 0,
    analyticsProvider: f.get('analyticsProvider'),
    plausibleDomain: f.get('plausibleDomain'),
    ga4Id: f.get('ga4Id'),
    searchConsoleToken: f.get('searchConsoleToken'),
  };
  const parsed = settingsSchema.safeParse(candidate);
  const errors: string[] = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`);
  const emailOk = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (!emailOk(candidate.contactEmail) || !emailOk(candidate.notifyEmail)) errors.push('Adresse e-mail invalide.');
  if (candidate.siteUrl && !/^https?:\/\/[^\s/]+$/.test(candidate.siteUrl)) errors.push('Adresse du site invalide (ex. https://www.exemple.fr, sans chemin).');
  if (legal.siren && !/^\d{9}$/.test(legal.siren)) errors.push('SIREN : 9 chiffres.');
  if (legal.siret && !/^\d{14}$/.test(legal.siret)) errors.push('SIRET : 14 chiffres.');
  if (candidate.ga4Id && !/^G-[A-Z0-9]+$/.test(candidate.ga4Id)) errors.push('ID Google Analytics invalide (G-XXXXXXX).');
  if (candidate.analyticsProvider === 'ga4' && !candidate.ga4Id) errors.push('Renseignez l’ID Google Analytics.');
  if (candidate.analyticsProvider === 'plausible' && !candidate.plausibleDomain) errors.push('Renseignez le domaine Plausible.');
  if (candidate.searchConsoleToken && !/^[\w-]+$/.test(candidate.searchConsoleToken)) errors.push('Code Search Console invalide.');
  if (errors.length || !parsed.success) {
    return page(c, 'Paramètres', <SettingsForm s={{ ...cur, ...(candidate as unknown as Settings) }} c={c} />, { error: `Paramètres non enregistrés : ${errors.join(' ; ')}`, status: 422 });
  }
  await saveSettings(c.get('deps').db, parsed.data);
  await audit(c.get('deps').db, c.get('user')!.id, 'modification-parametres');
  return c.redirect('/admin/parametres?ok=saved', 303);
});

settingsRoutes.get('/emails', async (c) => {
  const { db, mailer } = c.get('deps');
  const p = pageNum(c);
  const rows = await db.all<{ id: number; to_addr: string; subject: string; kind: string; status: string; provider: string; error: string | null; body: string | null; created_at: string }>(
    'SELECT * FROM email_log ORDER BY id DESC LIMIT ? OFFSET ?',
    [PAGE_SIZE + 1, (p - 1) * PAGE_SIZE],
  );
  const opts = [
    ['envoye', 'Envoyé'],
    ['simule', 'Simulé (non envoyé)'],
    ['echec', 'Échec'],
  ] as const;
  return page(
    c,
    'E-mails envoyés',
    <>
      <div class={`alert ${mailer.provider === 'log' ? 'alert-warning' : ''}`}>
        Service d’envoi : <strong>{mailer.provider === 'log' ? 'aucun (mode simulation : les e-mails ne partent pas)' : mailer.provider}</strong>. Seuls des e-mails
        transactionnels sont envoyés (accusés de réception, devis, BAT, recette) : aucune campagne commerciale.
      </div>
      {rows.length === 0 ? (
        <Empty>Aucun e-mail.</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Destinataire</th>
                <th>Objet</th>
                <th>Type</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE_SIZE).map((r) => (
                <tr>
                  <td class="nowrap">{formatDateTime(r.created_at)}</td>
                  <td>{r.to_addr}</td>
                  <td>
                    {r.subject}
                    {r.body && (
                      <details>
                        <summary class="small">Voir le contenu (simulation)</summary>
                        <pre style="white-space:pre-wrap;font-size:.8rem">{r.body}</pre>
                      </details>
                    )}
                    {r.error && <div class="small" style="color:var(--err)">{r.error}</div>}
                  </td>
                  <td>{r.kind}</td>
                  <td>
                    <Badge options={opts} value={r.status} tone={r.status === 'envoye' ? 'envoye-ok' : r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={p} hasMore={rows.length > PAGE_SIZE} base="/admin/emails" />
    </>,
  );
});
