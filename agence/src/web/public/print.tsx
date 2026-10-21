import { raw } from 'hono/html';
import type { Settings } from '../../domain/settings';
import type { ProductRow, ServiceRow } from '../../repo/types';
import { Layout, jsonForScript } from '../layout';
import { CtaBand, FaqList, Notice, SectionHead, faqJsonLd } from '../components';
import type { FaqRow } from '../../repo/types';
import { ProductVisual } from '../illustrations';
import { FAMILY_LABELS, SERVICE_PAGES } from '../content';
import { ProductCard, PageHero } from './pages';
import { activeAttrs, attrLabel, parseOptions, type PrintConfig, type PrintOptions, type PublicEstimate } from '../../domain/print';
import { formatEuros } from '../../domain/money';

/** « Impression de flyers », « Impression d’affiches » (élision devant une voyelle). */
export function printTitle(name: string): string {
  const n = name.charAt(0).toLowerCase() + name.slice(1);
  return /^[aeiouyéèêàâîôûh]/i.test(n) ? `Impression d’${n}` : `Impression de ${n}`;
}
export const lcFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
/** Coupe un texte à la dernière fin de mot avant la longueur maximale. */
export const clip = (t: string, max: number) => (t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…');
/** Page de prestation qui présente la création graphique associée à un produit imprimé. */
const designPageFor = (slug: string | null) => SERVICE_PAGES.find((p) => slug && p.serviceSlugs.includes(slug));

export function CatalogPage({ s, products }: { s: Settings; products: ProductRow[] }) {
  const families = Object.keys(FAMILY_LABELS).filter((f) => products.some((p) => p.family === f));
  return (
    <Layout
      s={s}
      meta={{
        title: 'Catalogue d’impression professionnelle',
        description: 'Impression de flyers, cartes de visite, dépliants, affiches, brochures, roll-ups et étiquettes : configurez votre produit et obtenez une estimation détaillée.',
        path: '/impression',
        breadcrumbs: [{ name: 'Impression', path: '/impression' }],
      }}
    >
      <PageHero
        eyebrow="Impression professionnelle"
        h1="Vos supports imprimés,"
        h1em="du fichier à la livraison."
        intro="Choisissez un produit, configurez format, papier, finition et quantité. Nous vérifions votre fichier, vous envoyons un bon à tirer et suivons la fabrication jusqu’à la livraison."
      />
      <div class="container hero-ctas">
        <a href="/configurateur" class="btn btn-primary btn-lg">Ouvrir le configurateur</a>
        <a href="/devis?type=impression" class="btn btn-outline btn-lg">Demander un devis d’impression</a>
      </div>
      <section class="section section-tight">
        <div class="container">
          <div class="steps-inline">
            <div>
              <strong>1. Configuration</strong>
              <span>Format, papier, finition, quantité, délai.</span>
            </div>
            <div>
              <strong>2. Devis validé</strong>
              <span>Création, impression et livraison détaillées.</span>
            </div>
            <div>
              <strong>3. Bon à tirer</strong>
              <span>Rien n’est imprimé sans votre accord.</span>
            </div>
            <div>
              <strong>4. Livraison suivie</strong>
              <span>Numéro de suivi transmis à l’expédition.</span>
            </div>
          </div>
        </div>
      </section>
      {families.map((f) => (
        <section class="section section-tight">
          <div class="container">
            <h2 class="group-title">{FAMILY_LABELS[f]}</h2>
            <div class="product-grid">
              {products
                .filter((p) => p.family === f)
                .map((p) => (
                  <ProductCard product={p} s={s} />
                ))}
            </div>
          </div>
        </section>
      ))}
      {products.length === 0 && (
        <section class="section">
          <div class="container empty">
            <p>Le catalogue est en cours de mise à jour.</p>
            <a href="/devis?type=impression" class="btn btn-primary">Demander un devis d’impression</a>
          </div>
        </section>
      )}
      <CtaBand title="Un support qui n’est pas dans le catalogue ?" text="Autocollants spécifiques, enseignes, packagings… Décrivez votre besoin, nous trouvons la bonne solution." />
    </Layout>
  );
}

/** Champs du configurateur (boutons radio : fonctionne sans JavaScript). */
export function ConfiguratorFields({ options, config, prefix = '' }: { options: PrintOptions; config: Partial<PrintConfig>; prefix?: string }) {
  const attrs = activeAttrs(options);
  return (
    <>
      {attrs.map((a) => {
        const values = (options[a] as string[]) ?? [];
        const selected = config[a] || values[0];
        return (
          <fieldset class="chips-field">
            <legend>{attrLabel(a, options)}</legend>
            <div class="chips">
              {values.map((v) => (
                <label class="chip">
                  <input type="radio" name={`${prefix}${a}`} value={v} checked={v === selected} />
                  <span>{v}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      <div class="field">
        <label for={`${prefix}quantity`}>Quantité</label>
        <select id={`${prefix}quantity`} name={`${prefix}quantity`}>
          {options.quantity.map((q) => (
            <option value={String(q)} selected={q === Number(config.quantity ?? options.quantity[0])}>
              {q.toLocaleString('fr-FR')} exemplaire{q > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export function EstimateView({ est, s }: { est: PublicEstimate | null; s: Settings }) {
  if (!est) {
    return <p class="muted">Choisissez vos options puis cliquez sur « Calculer l’estimation ».</p>;
  }
  const row = (label: string, v: number | null, note?: string) => (
    <div class="est-row">
      <dt>
        {label}
        {note && <small>{note}</small>}
      </dt>
      <dd>{v == null ? 'Sur devis' : formatEuros(v)}</dd>
    </div>
  );
  return (
    <div class={`estimate est-${est.status}`}>
      <dl class="est-lines">
        {est.design && row('Création graphique', est.design.priceHt, est.design.fromPrice ? 'à partir de' : est.design.name)}
        {row('Impression', est.printHt)}
        {row('Livraison', est.shippingHt)}
        {est.otherHt ? row('Autres frais', est.otherHt) : null}
      </dl>
      <dl class="est-total">
        <div class="est-row">
          <dt>Total HT</dt>
          <dd>{est.totalHt == null ? 'Sur devis' : formatEuros(est.totalHt)}</dd>
        </div>
        <div class="est-row">
          <dt>{est.vatMode === 'franchise' ? 'TVA non applicable (art. 293 B du CGI)' : `TVA ${String(est.vatRate).replace('.', ',')} %`}</dt>
          <dd>{est.vat == null ? '—' : formatEuros(est.vat)}</dd>
        </div>
        <div class="est-row est-grand">
          <dt>Total TTC</dt>
          <dd>{est.totalTtc == null ? 'Sur devis' : formatEuros(est.totalTtc)}</dd>
        </div>
      </dl>
      <p class="est-message">{est.message}</p>
      {est.leadTimeDays ? <p class="small muted">Délai de fabrication et livraison indicatif : {est.leadTimeDays} jours ouvrés après validation du BAT.</p> : null}
      {est.alternatives.length > 0 && (
        <div class="alternatives">
          <p class="small strong">Configurations disponibles avec un prix confirmé :</p>
          <ul>
            {est.alternatives.map((alt) => (
              <li>
                <a href={`?${new URLSearchParams(Object.entries(alt.config).map(([k, v]) => [k, String(v)])).toString()}#configurateur`} data-alt={JSON.stringify(alt.config)}>
                  {[alt.config.format, alt.config.paper, alt.config.weight, alt.config.finish, alt.config.printing, alt.config.extra].filter(Boolean).join(' · ')} —{' '}
                  {alt.config.quantity.toLocaleString('fr-FR')} ex.
                </a>{' '}
                : {formatEuros(alt.totalHt)} HT
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.vatMode === 'normal' ? null : null}
    </div>
  );
}

export function ProductPage(p: {
  s: Settings;
  product: ProductRow;
  design: ServiceRow | undefined;
  config: Partial<PrintConfig>;
  wantDesign: boolean;
  estimate: PublicEstimate | null;
  errors: string[];
  faqs: FaqRow[];
  embedded?: boolean;
}) {
  const { s, product } = p;
  const options = parseOptions(product.options);
  const configurable = options.quantity.length > 0;
  const quoteParams = new URLSearchParams({ type: 'impression', produit: product.slug });
  if (configurable) {
    for (const [k, v] of Object.entries(p.config)) if (v !== '' && v != null) quoteParams.set(k, String(v));
    if (p.wantDesign) quoteParams.set('creation', '1');
  }
  const content = (
    <>
      <section class="page-hero page-hero-sm">
        <div class="container product-hero">
          <div>
            <p class="eyebrow">Impression · {FAMILY_LABELS[product.family] ?? ''}</p>
            <h1>{printTitle(product.name)}</h1>
            <p class="hero-lead">{product.summary}</p>
            <p>{product.description}</p>
          </div>
          <div class="product-hero-visual">
            <ProductVisual visual={product.visual} accent={s.accentColor} />
          </div>
        </div>
      </section>
      <section class="section section-tight" id="configurateur">
        <div class="container">
          {!configurable ? (
            <div class="config-empty">
              <h2>Produit sur mesure</h2>
              <p>
                Ce produit dépend de nombreux paramètres (dimensions, matériau, quantité). Décrivez votre besoin : nous vous envoyons une proposition
                chiffrée sous 48 h ouvrées.
              </p>
              <a href={`/devis?${quoteParams.toString()}`} class="btn btn-primary btn-lg">Décrire mon besoin</a>
            </div>
          ) : (
            <div class="configurator" data-configurator data-product={product.slug}>
              <form method="get" action={`/impression/${product.slug}#configurateur`} class="config-form">
                <h2 class="h3">Configurez votre produit</h2>
                {!product.options_checked_at && (
                  <Notice kind="warning">Options indicatives : la configuration exacte (format, papier, pliage) sera confirmée lors de l’établissement du devis.</Notice>
                )}
                {p.errors.length > 0 && <Notice kind="error">{p.errors.join(' ')}</Notice>}
                <ConfiguratorFields options={options} config={p.config} />
                <div class="field-check field-design">
                  <input type="checkbox" id="creation" name="creation" value="1" checked={p.wantDesign} />
                  <label for="creation">
                    J’ai besoin de la création graphique
                    {p.design && (
                      <small>
                        {p.design.name} :{' '}
                        {p.design.price_mode === 'quote' || p.design.price_ht == null
                          ? 'sur devis'
                          : `${p.design.price_mode === 'from' ? 'à partir de ' : ''}${formatEuros(p.design.price_ht)} HT`}
                      </small>
                    )}
                  </label>
                </div>
                <button type="submit" class="btn btn-outline js-hide">Calculer l’estimation</button>
              </form>
              <aside class="config-summary" aria-live="polite">
                <h2 class="h3">Estimation</h2>
                <div data-estimate>
                  <EstimateView est={p.estimate} s={s} />
                </div>
                <a href={`/devis?${quoteParams.toString()}`} class="btn btn-primary btn-block btn-lg" data-quote-link>
                  Demander ce devis
                </a>
                <p class="small muted">
                  Estimation indicative, sans engagement. Le devis définitif est validé par nos soins avant envoi. Aucun paiement n’est demandé en ligne.
                </p>
              </aside>
              <script type="application/json" id="print-options">
                {raw(jsonForScript({ slug: product.slug, options }))}
              </script>
            </div>
          )}
        </div>
      </section>
      {!p.embedded && (
        <section class="section section-tight">
          <div class="container">
            <p class="eyebrow">Pour aller plus loin</p>
            <div class="related">
              {designPageFor(product.design_service_slug) && (
                <a href={designPageFor(product.design_service_slug)!.path} class="related-link">
                  <span>Faire créer votre visuel : {lcFirst(designPageFor(product.design_service_slug)!.name)}</span>
                  <span aria-hidden="true">→</span>
                </a>
              )}
              <a href="/impression" class="related-link">
                <span>Tous les supports du catalogue d’impression</span>
                <span aria-hidden="true">→</span>
              </a>
              <a href="/realisations" class="related-link">
                <span>Voir des exemples de réalisations</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>
      )}
      {!p.embedded && p.faqs.length > 0 && (
        <section class="section">
          <div class="container narrow">
            <SectionHead title="Questions fréquentes sur l’impression" align="center" />
            <FaqList faqs={p.faqs} />
          </div>
        </section>
      )}
    </>
  );
  if (p.embedded) return content;
  return (
    <Layout
      s={s}
      meta={{
        title: printTitle(product.name),
        description: clip(`${printTitle(product.name)} : ${lcFirst(product.summary)} Estimation détaillée, BAT avant impression, livraison suivie.`, 158),
        path: `/impression/${product.slug}`,
        breadcrumbs: [
          { name: 'Impression', path: '/impression' },
          { name: product.name, path: `/impression/${product.slug}` },
        ],
        scripts: ['configurator'],
        jsonLd: p.faqs.length ? [faqJsonLd(p.faqs)] : [],
      }}
    >
      {content}
    </Layout>
  );
}

export function ConfiguratorIndex({ s, products }: { s: Settings; products: ProductRow[] }) {
  const configurable = products.filter((p) => parseOptions(p.options).quantity.length > 0);
  const custom = products.filter((p) => parseOptions(p.options).quantity.length === 0);
  return (
    <Layout
      s={s}
      meta={{
        title: 'Configurateur d’impression en ligne',
        description: 'Configurez vos flyers, cartes de visite, affiches, brochures et roll-ups : estimation détaillée de la création, de l’impression et de la livraison.',
        path: '/configurateur',
        breadcrumbs: [{ name: 'Configurateur', path: '/configurateur' }],
      }}
    >
      <PageHero eyebrow="Configurateur" h1="Quel support souhaitez-vous" h1em="imprimer ?" intro="Choisissez un produit pour accéder à sa configuration détaillée et à l’estimation de prix." />
      <section class="section section-tight">
        <div class="container">
          <div class="picker-grid">
            {configurable.map((p) => (
              <a href={`/impression/${p.slug}#configurateur`} class="picker">
                <ProductVisual visual={p.visual} accent={s.accentColor} />
                <span class="picker-name">{p.name}</span>
                <span class="link-arrow">Configurer</span>
              </a>
            ))}
          </div>
          {custom.length > 0 && (
            <>
              <h2 class="group-title mt-lg">Sur mesure</h2>
              <div class="picker-grid">
                {custom.map((p) => (
                  <a href={`/impression/${p.slug}`} class="picker">
                    <ProductVisual visual={p.visual} accent={s.accentColor} />
                    <span class="picker-name">{p.name}</span>
                    <span class="link-arrow">Décrire mon besoin</span>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
