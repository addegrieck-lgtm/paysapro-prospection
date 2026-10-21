import type { Settings } from '../domain/settings';
import type { ContactRow, LineRow, QuoteRow, InvoiceRow, OrderRow } from '../repo/types';
import { computeTotals, formatEuros, lineTotal } from '../domain/money';
import { formatDate, formatDateTime } from '../domain/dates';
import { commitmentEnd } from '../domain/contracts';
import type { ContractTerms, SubscriptionRow } from '../services/contracts';

/** Bloc vendeur : uniquement les informations saisies dans les paramètres (rien n'est inventé). */
export function SellerBlock({ s, snapshot }: { s: Settings; snapshot?: Settings['legal'] & { agencyName?: string; email?: string; phone?: string } }) {
  const l = snapshot ?? s.legal;
  const email = snapshot?.email ?? s.contactEmail;
  const phone = snapshot?.phone ?? s.contactPhone;
  return (
    <div>
      <strong>{l.companyName || s.agencyName}</strong>
      {l.companyName && (snapshot?.agencyName ?? s.agencyName) !== l.companyName && <div>{snapshot?.agencyName ?? s.agencyName}</div>}
      {l.legalForm && (
        <div>
          {l.legalForm}
          {l.capital ? ` au capital de ${l.capital}` : ''}
        </div>
      )}
      {l.address && <div style="white-space:pre-line">{l.address}</div>}
      {(l.siret || l.siren) && <div>SIRET / SIREN : {l.siret || l.siren}</div>}
      {l.registry && <div>{l.registry}</div>}
      {l.vatNumber && <div>TVA intracommunautaire : {l.vatNumber}</div>}
      {email && <div>{email}</div>}
      {phone && <div>{phone}</div>}
    </div>
  );
}

export function CustomerBlock({ c }: { c: Pick<ContactRow, 'name' | 'company' | 'address' | 'postal_code' | 'city' | 'siren' | 'email'> }) {
  return (
    <div>
      <strong>{c.company || c.name}</strong>
      {c.company && <div>À l’attention de {c.name}</div>}
      {c.address && <div>{c.address}</div>}
      {(c.postal_code || c.city) && (
        <div>
          {c.postal_code} {c.city}
        </div>
      )}
      {c.siren && <div>SIREN / SIRET : {c.siren}</div>}
      {c.email && <div>{c.email}</div>}
    </div>
  );
}

export function LinesTable({ lines, vatMode }: { lines: Pick<LineRow, 'description' | 'quantity' | 'unit_price_ht' | 'vat_rate'>[]; vatMode: 'normal' | 'franchise' }) {
  const t = computeTotals(lines, vatMode);
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Désignation</th>
            <th style="text-align:right">Qté</th>
            <th style="text-align:right">Prix unitaire HT</th>
            {vatMode === 'normal' && <th style="text-align:right">TVA</th>}
            <th style="text-align:right">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr>
              <td style="white-space:pre-line">{l.description}</td>
              <td style="text-align:right">{String(l.quantity).replace('.', ',')}</td>
              <td style="text-align:right">{formatEuros(l.unit_price_ht)}</td>
              {vatMode === 'normal' && <td style="text-align:right">{String(l.vat_rate).replace('.', ',')} %</td>}
              <td style="text-align:right">{formatEuros(lineTotal(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table class="totals">
        <tbody>
          <tr>
            <td>Total HT</td>
            <td style="text-align:right">{formatEuros(t.ht)}</td>
          </tr>
          {vatMode === 'normal' ? (
            t.byRate.map((r) => (
              <tr>
                <td>
                  TVA {String(r.rate).replace('.', ',')} % (base {formatEuros(r.base)})
                </td>
                <td style="text-align:right">{formatEuros(r.vat)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colspan={2}>TVA non applicable, art. 293 B du CGI</td>
            </tr>
          )}
          <tr class="grand">
            <td>Total TTC</td>
            <td style="text-align:right">{formatEuros(t.ttc)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

export function QuoteDocument({ s, quote, lines, contact }: { s: Settings; quote: QuoteRow; lines: LineRow[]; contact: ContactRow }) {
  const t = computeTotals(lines, s.vatMode);
  const deposit = quote.deposit_percent ? Math.round((t.ttc * quote.deposit_percent) / 100) : 0;
  return (
    <article class="doc">
      <div class="doc-head">
        <SellerBlock s={s} />
        <div style="text-align:right">
          <h1>Devis</h1>
          {quote.number ? <div>N° {quote.number}</div> : <div class="doc-draft">BROUILLON — NON ENVOYÉ</div>}
          <div>Date : {formatDate(quote.issue_date)}</div>
          <div>Valable jusqu’au : {formatDate(quote.valid_until)}</div>
        </div>
      </div>
      <div class="doc-parties">
        <div>
          <h3>Client</h3>
          <CustomerBlock c={contact} />
        </div>
        <div>
          <h3>Objet</h3>
          <div>{quote.title || 'Prestation'}</div>
        </div>
      </div>
      {quote.intro && <p style="white-space:pre-line">{quote.intro}</p>}
      <LinesTable lines={lines} vatMode={s.vatMode} />
      <div class="doc-legal">
        {quote.deposit_percent > 0 && (
          <p>
            Acompte de {quote.deposit_percent} % à la commande, soit {formatEuros(deposit)} TTC. Solde à la livraison.
          </p>
        )}
        <p>
          Paiement par virement, à {s.paymentTermsDays} jours à compter de la date de facture.
          {contact.customer_type === 'pro' && ` Pénalités de retard : ${s.latePenaltyRate} ; indemnité forfaitaire pour frais de recouvrement : 40 €.`}
        </p>
        <p>Devis gratuit. Les impressions ne sont lancées qu’après validation du bon à tirer (BAT) par le client.</p>
        {quote.terms && <p style="white-space:pre-line">{quote.terms}</p>}
        <p>Conditions générales de vente : disponibles sur le site, page « CGV ».</p>
        {s.legal.mediatorName && contact.customer_type === 'particulier' && <p>Médiateur de la consommation : {s.legal.mediatorName}.</p>}
        {quote.decided_at && quote.status === 'accepte' && (
          <p>
            <strong>
              Accepté le {formatDate(quote.decided_at)} par {quote.decided_name}.
            </strong>
          </p>
        )}
      </div>
    </article>
  );
}

export const OPERATION_CATEGORIES = [
  ['services', 'Prestation de services'],
  ['biens', 'Livraison de biens'],
  ['mixte', 'Mixte (biens et services)'],
] as const;

export function InvoiceDocument({ s, invoice, lines, original }: { s: Settings; invoice: InvoiceRow; lines: LineRow[]; original?: InvoiceRow }) {
  const customer = JSON.parse(invoice.customer || '{}') as ContactRow & { customer_type?: string };
  const seller = invoice.seller ? (JSON.parse(invoice.seller) as Settings['legal'] & { agencyName: string; email: string; phone: string; vatMode: 'normal' | 'franchise'; paymentTermsDays: number; latePenaltyRate: string; iban: string }) : null;
  const vatMode = seller?.vatMode ?? s.vatMode;
  const isCredit = invoice.type === 'avoir';
  return (
    <article class="doc">
      <div class="doc-head">
        <SellerBlock s={s} snapshot={seller ?? undefined} />
        <div style="text-align:right">
          <h1>{isCredit ? 'Avoir' : 'Facture'}</h1>
          {invoice.number ? <div>N° {invoice.number}</div> : <div class="doc-draft">BROUILLON — SANS VALEUR</div>}
          <div>Date d’émission : {formatDate(invoice.issue_date)}</div>
          {invoice.service_date && <div>Date de la prestation / livraison : {formatDate(invoice.service_date)}</div>}
          {!isCredit && <div>Échéance : {formatDate(invoice.due_date)}</div>}
        </div>
      </div>
      <div class="doc-parties">
        <div>
          <h3>Client</h3>
          <CustomerBlock c={customer} />
        </div>
        <div>
          <h3>Nature de l’opération</h3>
          <div>{OPERATION_CATEGORIES.find((o) => o[0] === invoice.operation_category)?.[1]}</div>
          {isCredit && original && <div>Avoir sur la facture n° {original.number}</div>}
        </div>
      </div>
      <LinesTable lines={lines} vatMode={vatMode} />
      <div class="doc-legal">
        {invoice.notes && <p style="white-space:pre-line">{invoice.notes}</p>}
        {!isCredit && (
          <>
            <p>
              Paiement par virement{seller?.iban ? ` — IBAN : ${seller.iban}` : ''}. Pas d’escompte pour paiement anticipé.
            </p>
            {customer.customer_type !== 'particulier' && (
              <p>
                En cas de retard de paiement : pénalités au taux de {seller?.latePenaltyRate ?? s.latePenaltyRate} et indemnité forfaitaire pour frais de recouvrement
                de 40 € (art. L441-10 et D441-5 du Code de commerce).
              </p>
            )}
          </>
        )}
        {invoice.status === 'payee' && invoice.paid_at && <p><strong>Acquittée le {formatDate(invoice.paid_at)}.</strong></p>}
      </div>
    </article>
  );
}

export function OrderDocument({ s, order, contact, lines }: { s: Settings; order: OrderRow; contact: ContactRow; lines: LineRow[] }) {
  return (
    <article class="doc">
      <div class="doc-head">
        <SellerBlock s={s} />
        <div style="text-align:right">
          <h1>Bon de commande</h1>
          <div>N° {order.number}</div>
          <div>Date : {formatDate(order.created_at)}</div>
        </div>
      </div>
      <div class="doc-parties">
        <div>
          <h3>Client</h3>
          <CustomerBlock c={contact} />
        </div>
        <div>
          <h3>Produit</h3>
          <div>{order.description}</div>
        </div>
      </div>
      {lines.length > 0 ? <LinesTable lines={lines} vatMode={s.vatMode} /> : <p>Montants : voir le devis associé.</p>}
      <div class="doc-legal">
        <p>La fabrication est lancée uniquement après acceptation du bon à tirer (BAT) par le client.</p>
        <p>Signature du client, précédée de la mention « Bon pour accord » :</p>
        <div style="height:70px;border:1px dashed #bbb;margin-top:6px"></div>
      </div>
    </article>
  );
}

/** Contrat d'abonnement : formule, prix, durée, préavis et résiliation. Le contenu de l'offre est celui figé dans le contrat. */
export function ContractDocument({ s, sub, terms, contact }: { s: Settings; sub: SubscriptionRow; terms: ContractTerms; contact: ContactRow }) {
  const engaged = sub.formula === 'engagement';
  const end = commitmentEnd(sub.start_date, sub.commitment_months);
  const base = sub.base_monthly_ht ?? sub.monthly_ht;
  const vat = s.vatMode === 'normal' ? Math.round((sub.monthly_ht * s.vatRate) / 100) : 0;
  const list = (t: string) =>
    t.trim() ? (
      <ul>
        {t
          .split('\n')
          .filter((x) => x.trim())
          .map((x) => (
            <li>{x}</li>
          ))}
      </ul>
    ) : null;
  const consumer = contact.customer_type === 'particulier';
  const notice = sub.notice_months === 0 ? 'sans préavis' : `avec un préavis de ${sub.notice_months} mois`;
  return (
    <article class="doc">
      <div class="doc-head">
        <SellerBlock s={s} />
        <div style="text-align:right">
          <h1>Contrat d’abonnement</h1>
          <div>N° {sub.number}</div>
          <div>Début : {formatDate(sub.start_date)}</div>
        </div>
      </div>
      <div class="doc-parties">
        <div>
          <h3>Client</h3>
          <CustomerBlock c={contact} />
        </div>
        <div>
          <h3>Formule</h3>
          <div>
            <strong>{engaged ? `Engagement de ${sub.commitment_months} mois — remise de ${sub.discount_percent} %` : 'Sans engagement'}</strong>
          </div>
          <div>{sub.label}</div>
        </div>
      </div>

      <h2>Article 1 — Objet</h2>
      <p>
        Le présent contrat définit les conditions dans lesquelles {s.legal.companyName || s.agencyName} (« le Prestataire ») fournit au Client la prestation
        récurrente « {terms.serviceName} ». {terms.description}
      </p>

      <h2>Article 2 — Prestations</h2>
      {terms.includes ? (
        <>
          <p>Sont inclus :</p>
          {list(terms.includes)}
        </>
      ) : null}
      {terms.exclusions && <p>Exclusions : {terms.exclusions}</p>}
      {terms.extra && <p style="white-space:pre-line">Précisions : {terms.extra}</p>}
      <p>
        Le Prestataire est tenu à une obligation de moyens. Les travaux non prévus au présent article font l’objet d’un devis distinct, accepté par le Client
        avant toute réalisation.
      </p>

      <h2>Article 3 — Prix et facturation</h2>
      <table>
        <tbody>
          {engaged && (
            <tr>
              <td>Prix mensuel sans engagement</td>
              <td style="text-align:right">{formatEuros(base)} HT</td>
            </tr>
          )}
          {engaged && (
            <tr>
              <td>Remise pour engagement de {sub.commitment_months} mois</td>
              <td style="text-align:right">− {sub.discount_percent} %</td>
            </tr>
          )}
          <tr>
            <td>
              <strong>Prix mensuel</strong>
            </td>
            <td style="text-align:right">
              <strong>{formatEuros(sub.monthly_ht)} HT</strong>
            </td>
          </tr>
          {s.vatMode === 'normal' ? (
            <tr>
              <td>Soit, TVA {String(s.vatRate).replace('.', ',')} % incluse</td>
              <td style="text-align:right">{formatEuros(sub.monthly_ht + vat)} TTC</td>
            </tr>
          ) : (
            <tr>
              <td colspan={2}>TVA non applicable, art. 293 B du CGI.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p>
        L’abonnement est facturé chaque mois, en début de mois, et payable par virement à {s.paymentTermsDays} jours à compter de la date de facture. Le premier mois
        est facturé au prorata à compter de la date de début.
        {contact.customer_type === 'pro' && ` Tout retard de paiement entraîne des pénalités au taux de ${s.latePenaltyRate} et une indemnité forfaitaire de 40 € pour frais de recouvrement.`}{' '}
        En cas d’impayé persistant après relance restée sans effet pendant 15 jours, le Prestataire peut suspendre les prestations.
      </p>
      {engaged && (
        <p>
          La remise est accordée en contrepartie de l’engagement. Elle reste acquise après la période d’engagement, tant que le contrat se poursuit.
        </p>
      )}

      <h2>Article 4 — Durée</h2>
      {engaged ? (
        <p>
          Le contrat prend effet le {formatDate(sub.start_date)} pour une durée initiale de {sub.commitment_months} mois, soit jusqu’au {formatDate(end)} inclus. À
          l’issue de cette période, il se poursuit par tacite reconduction de mois en mois, aux mêmes conditions.
        </p>
      ) : (
        <p>Le contrat prend effet le {formatDate(sub.start_date)} pour une durée indéterminée, sans durée minimale.</p>
      )}

      <h2>Article 5 — Résiliation</h2>
      <p>
        {engaged
          ? `Le Client peut résilier le contrat à tout moment, ${notice}. Pendant la période d’engagement, la résiliation prend effet au plus tôt le ${formatDate(end)} ; ensuite, elle prend effet à l’issue du préavis.`
          : `Le Client peut résilier le contrat à tout moment, ${notice}. La résiliation prend effet à l’issue du préavis.`}{' '}
        La résiliation se fait en ligne, depuis le lien personnel du contrat (bouton « Résilier mon abonnement »), par e-mail
        {s.contactEmail ? ` à ${s.contactEmail}` : ''} ou par courrier. Une confirmation indiquant la date de fin est adressée au Client.
      </p>
      <p>
        Le Prestataire peut résilier le contrat avec le même préavis, ou sans préavis en cas de manquement grave du Client non corrigé dans les 15 jours suivant
        une mise en demeure.
      </p>
      {consumer && engaged && (
        <p>
          Conformément à l’article L215-1 du Code de la consommation, le Prestataire informe le Client, au plus tôt trois mois et au plus tard un mois avant le{' '}
          {formatDate(end)}, de la possibilité de ne pas reconduire le contrat. À défaut, le Client peut y mettre fin gratuitement à tout moment à compter de la
          date de reconduction.
        </p>
      )}

      {consumer && (
        <p>
          Droit de rétractation : le Client consommateur dispose de 14 jours à compter de la signature pour se rétracter, sans motif, par tout moyen écrit. S’il
          demande que la prestation commence avant la fin de ce délai, il reste redevable du montant correspondant au service fourni jusqu’à sa rétractation.
        </p>
      )}

      <h2>Article 6 — Obligations du Client</h2>
      <p>
        Le Client fournit les accès nécessaires (hébergement, nom de domaine, outils concernés) et les informations utiles à la prestation, et reste responsable
        des contenus qu’il publie. Il informe le Prestataire de toute intervention d’un tiers sur les éléments couverts par le contrat.
      </p>

      <h2>Article 7 — Dispositions générales</h2>
      <p>
        Les conditions générales de vente du Prestataire, disponibles sur son site (page « CGV »), s’appliquent pour tout ce qui n’est pas prévu au présent
        contrat ; en cas de contradiction, le contrat prévaut. Le contrat est soumis au droit français.
        {consumer && s.legal.mediatorName && ` Médiateur de la consommation : ${s.legal.mediatorName}${s.legal.mediatorUrl ? ` (${s.legal.mediatorUrl})` : ''}.`}
      </p>

      <div class="doc-legal">
        {sub.signed_at ? (
          <p>
            <strong>
              Signé en ligne le {formatDateTime(sub.signed_at)} par {sub.signed_name} (nom saisi et case « lu et approuvé » cochée).
            </strong>
          </p>
        ) : (
          <p class="doc-draft">EN ATTENTE DE SIGNATURE</p>
        )}
        {sub.termination_requested_at && sub.end_date && (
          <p>
            <strong>
              Résiliation demandée le {formatDate(sub.termination_requested_at)} : fin du contrat le {formatDate(sub.end_date)}.
            </strong>
          </p>
        )}
      </div>
    </article>
  );
}
