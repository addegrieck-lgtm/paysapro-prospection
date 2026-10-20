import type { Settings } from '../domain/settings';
import type { ContactRow, LineRow, QuoteRow, InvoiceRow, OrderRow } from '../repo/types';
import { computeTotals, formatEuros, lineTotal } from '../domain/money';
import { formatDate } from '../domain/dates';

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
