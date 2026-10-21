import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../app/context';
import { allowRate, checkFormToken, formToken } from '../app/security';
import {
  portfolioBySlug,
  postBySlug,
  productBySlug,
  publishedFaqs,
  publishedLocalPages,
  publishedPortfolio,
  publishedPosts,
  publishedProducts,
  publishedServices,
  serviceBySlug,
  localPageBySlug,
} from '../repo/catalog';
import { HomePage } from '../web/public/home';
import {
  AboutPage,
  BlogList,
  BlogPost,
  ClientSpaceInfo,
  ContactPage,
  LocalPage,
  PortfolioDetail,
  PortfolioPage,
  PricingPage,
  ServicePage,
  SimpleMessage,
  SitePlan,
} from '../web/public/pages';
import { CatalogPage, ConfiguratorIndex, ProductPage } from '../web/public/print';
import { QuoteWizard, type QuoteFormState } from '../web/public/quote';
import { CookiesPage, LegalNotice, PrivacyPolicy, TermsPage } from '../web/public/legal';
import { SERVICE_PAGES } from '../web/content';
import { LANDING_PAGES } from '../web/landing';
import { packBySlug } from '../web/packs';
import { PackPage, PacksHub } from '../web/public/packs';
import { LandingPage, SIGNAGE_DESIGN, SIGNAGE_NEEDS, SIGNAGE_POSE, SignageQuotePage } from '../web/public/landing';
import { estimateFor } from '../services/estimate';
import { ATTRS, parseOptions, type PrintConfig, type PublicEstimate } from '../domain/print';
import { recordConversion } from '../services/analytics';
import { checkUploads, contactSchema, quoteSchema, submitContact, submitQuoteRequest, type UploadedFile } from '../services/requests';

export const publicRoutes = new Hono<AppEnv>();

const token = (c: Ctx) => formToken(c.get('deps').config.appSecret);

publicRoutes.get('/', async (c) => {
  const { db } = c.get('deps');
  const [offers, packs, portfolio, products, faqs] = await Promise.all([
    publishedServices(db, { slugs: ['site-essentiel', 'site-business', 'pack-flyer-carte', 'identite-visuelle-simple'] }),
    publishedServices(db, { categories: ['pack'] }),
    publishedPortfolio(db, { featured: true }),
    publishedProducts(db),
    publishedFaqs(db, ['general', 'impression']),
  ]);
  return c.html(<HomePage s={c.get('settings')} offers={offers} packs={packs} portfolio={portfolio} products={products} faqs={faqs.slice(0, 7)} formToken={await token(c)} />);
});

for (const def of SERVICE_PAGES) {
  publicRoutes.get(def.path, async (c) => {
    const { db } = c.get('deps');
    const [services, allProducts, faqs] = await Promise.all([
      publishedServices(db, { slugs: def.serviceSlugs }),
      publishedProducts(db),
      def.faqTopics.length ? publishedFaqs(db, def.faqTopics) : Promise.resolve([]),
    ]);
    const products = (def.productSlugs ?? []).map((slug) => allProducts.find((p) => p.slug === slug)).filter((p) => !!p);
    return c.html(<ServicePage s={c.get('settings')} def={def} services={services} products={products} faqs={faqs.slice(0, 4)} />);
  });
}

for (const def of LANDING_PAGES) {
  publicRoutes.get(def.path, async (c) => c.html(<LandingPage s={c.get('settings')} def={def} localPages={await publishedLocalPages(c.get('deps').db)} />));
}

// ─── Packs « Bien démarrer » par métier (hub à l'adresse historique /packs) ───
publicRoutes.get('/packs', async (c) => c.html(<PacksHub s={c.get('settings')} packs={await publishedServices(c.get('deps').db, { categories: ['pack'] })} />));
publicRoutes.get('/packs/:slug', async (c) => {
  const pack = packBySlug(c.req.param('slug'));
  if (!pack) return c.notFound();
  const item = await portfolioBySlug(c.get('deps').db, pack.portfolio.slug);
  return c.html(<PackPage s={c.get('settings')} p={pack} item={item ?? undefined} />);
});

publicRoutes.get('/tarifs', async (c) => c.html(<PricingPage s={c.get('settings')} services={await publishedServices(c.get('deps').db)} />));

publicRoutes.get('/realisations', async (c) => c.html(<PortfolioPage s={c.get('settings')} items={await publishedPortfolio(c.get('deps').db)} />));
publicRoutes.get('/etudes-de-cas', async (c) => c.html(<PortfolioPage s={c.get('settings')} items={await publishedPortfolio(c.get('deps').db, { caseStudies: true })} caseStudies />));
publicRoutes.get('/realisations/:slug', async (c) => {
  const { db } = c.get('deps');
  const item = await portfolioBySlug(db, c.req.param('slug'));
  if (!item) return c.notFound();
  const others = (await publishedPortfolio(db)).filter((x) => x.id !== item.id);
  return c.html(<PortfolioDetail s={c.get('settings')} item={item} others={others} base="realisations" />);
});
// Une étude de cas est une réalisation détaillée : une seule URL (évite le contenu dupliqué).
publicRoutes.get('/etudes-de-cas/:slug', (c) => c.redirect(`/realisations/${encodeURIComponent(c.req.param('slug'))}`, 301));

publicRoutes.get('/a-propos', (c) => c.html(<AboutPage s={c.get('settings')} />));
publicRoutes.get('/espace-client', (c) => c.html(<ClientSpaceInfo s={c.get('settings')} />));

publicRoutes.get('/blog', async (c) => c.html(<BlogList s={c.get('settings')} posts={await publishedPosts(c.get('deps').db)} />));
publicRoutes.get('/blog/:slug', async (c) => {
  const { db } = c.get('deps');
  const post = await postBySlug(db, c.req.param('slug'));
  if (!post) return c.notFound();
  const others = (await publishedPosts(db, 4)).filter((p) => p.id !== post.id).slice(0, 3);
  return c.html(<BlogPost s={c.get('settings')} post={post} others={others} />);
});

publicRoutes.get('/agence-web/:slug', async (c) => {
  const page = await localPageBySlug(c.get('deps').db, c.req.param('slug'));
  if (!page) return c.notFound();
  return c.html(<LocalPage s={c.get('settings')} page={page} />);
});

publicRoutes.get('/mentions-legales', (c) => c.html(<LegalNotice s={c.get('settings')} />));
publicRoutes.get('/confidentialite', (c) => c.html(<PrivacyPolicy s={c.get('settings')} mailProvider={c.get('deps').mailer.provider} />));
publicRoutes.get('/cookies', (c) => c.html(<CookiesPage s={c.get('settings')} />));
publicRoutes.get('/cgv', (c) => c.html(<TermsPage s={c.get('settings')} />));
publicRoutes.get('/plan-du-site', async (c) => {
  const { db } = c.get('deps');
  const [posts, products, items, local] = await Promise.all([publishedPosts(db), publishedProducts(db), publishedPortfolio(db), publishedLocalPages(db)]);
  return c.html(<SitePlan s={c.get('settings')} posts={posts} products={products} items={items} local={local} />);
});

// ─── Impression ───

publicRoutes.get('/impression', async (c) => c.html(<CatalogPage s={c.get('settings')} products={await publishedProducts(c.get('deps').db)} />));
publicRoutes.get('/configurateur', async (c) => {
  const slug = c.req.query('produit');
  if (slug) return c.redirect(`/impression/${encodeURIComponent(slug)}#configurateur`);
  return c.html(<ConfiguratorIndex s={c.get('settings')} products={await publishedProducts(c.get('deps').db)} />);
});

publicRoutes.get('/impression/:slug', async (c) => {
  const { db } = c.get('deps');
  const s = c.get('settings');
  const product = await productBySlug(db, c.req.param('slug'));
  if (!product) return c.notFound();
  const q = c.req.query();
  const options = parseOptions(product.options);
  const design = product.design_service_slug ? await serviceBySlug(db, product.design_service_slug) : undefined;
  const wantDesign = q.creation === '1';
  let config: Partial<PrintConfig> = {};
  let estimate: PublicEstimate | null = null;
  let errors: string[] = [];
  // Sans JavaScript : le formulaire est envoyé en GET et l'estimation est calculée ici.
  if (options.quantity.length && q.quantity) {
    const r = await estimateFor(db, s, product, q, wantDesign);
    if (r.ok) {
      config = r.config;
      estimate = r.estimate;
    } else errors = r.errors;
  } else if (options.quantity.length) {
    const first: Record<string, string | number> = { quantity: options.quantity[0]! };
    for (const a of ATTRS) first[a] = (options[a] as string[] | undefined)?.[0] ?? '';
    const r = await estimateFor(db, s, product, first, false);
    if (r.ok) {
      config = r.config;
      estimate = r.estimate;
    }
  }
  const faqs = await publishedFaqs(db, ['impression']);
  return c.html(<ProductPage s={s} product={product} design={design} config={config} wantDesign={wantDesign} estimate={estimate} errors={errors} faqs={faqs} />);
});

/** API publique d'estimation : ne renvoie que des prix de vente. */
publicRoutes.post('/api/print/estimate', async (c) => {
  if (!(await allowRate(c, 'estimate', 120, 60))) return c.json({ error: 'Trop de requêtes, réessayez dans une minute.' }, 429);
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Requête invalide.' }, 400);
  }
  const slug = typeof body.product === 'string' ? body.product : '';
  const product = slug ? await productBySlug(c.get('deps').db, slug) : undefined;
  if (!product) return c.json({ error: 'Produit introuvable.' }, 404);
  const config = (body.config && typeof body.config === 'object' ? body.config : {}) as Record<string, unknown>;
  const r = await estimateFor(c.get('deps').db, c.get('settings'), product, config, body.wantDesign === true);
  if (!r.ok) return c.json({ error: r.errors.join(' ') }, 422);
  return c.json({ config: r.config, estimate: r.estimate });
});

// ─── Formulaires ───

async function guard(c: Ctx, body: Record<string, unknown>, scope: string, limit: number): Promise<string | null> {
  if (typeof body.website_url === 'string' && body.website_url.trim()) return 'spam';
  const t = await checkFormToken(c.get('deps').config.appSecret, body._ft);
  if (t === 'too_fast' || t === 'invalid') return 'spam';
  if (t === 'expired') return 'Le formulaire a expiré : rechargez la page et réessayez.';
  if (!(await allowRate(c, scope, limit, 3600))) return 'Trop de demandes envoyées depuis votre connexion. Réessayez dans une heure ou écrivez-nous directement.';
  return null;
}

function flatten(body: Record<string, unknown>, arrays: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (arrays.includes(k)) out[k] = (Array.isArray(v) ? v : [v]).filter((x) => typeof x === 'string');
    else out[k] = Array.isArray(v) ? v[v.length - 1] : v;
  }
  return out;
}

publicRoutes.get('/contact', async (c) => {
  const pack = c.req.query('pack');
  const values = pack && (packBySlug(pack) || pack === 'autre-metier' || pack === 'caisse') ? { pack } : undefined;
  return c.html(<ContactPage s={c.get('settings')} token={await token(c)} sent={c.req.query('envoye') === '1'} values={values} />);
});

publicRoutes.post('/contact', async (c) => {
  const body = flatten(await c.req.parseBody({ all: true }), []);
  const g = await guard(c, body, 'contact', 5);
  if (g === 'spam') return c.redirect('/contact?envoye=1', 303); // aucun indice donné aux robots
  const values = Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  if (g) return c.html(<ContactPage s={c.get('settings')} token={await token(c)} error={g} values={values} />, 429);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return c.html(<ContactPage s={c.get('settings')} token={await token(c)} error={parsed.error.issues.map((i) => i.message).join(' ')} values={values} />, 422);
  }
  const contactId = await submitContact(c.get('deps'), c.get('settings'), parsed.data, new URL(c.req.url).origin);
  await recordConversion(c, 'contact', contactId);
  return c.redirect('/contact?envoye=1', 303);
});

async function renderWizard(c: Ctx, state: QuoteFormState, status: 200 | 422 | 429 = 200) {
  const { db } = c.get('deps');
  const [services, products] = await Promise.all([publishedServices(db), publishedProducts(db)]);
  return c.html(<QuoteWizard s={c.get('settings')} services={services} products={products} token={await token(c)} state={state} />, status);
}

publicRoutes.get('/devis', async (c) => {
  const q = c.req.query();
  const { db } = c.get('deps');
  let type = q.type ?? '';
  const service = q.prestation ? await serviceBySlug(db, q.prestation) : undefined;
  if (!type && service) {
    type = service.category === 'web' ? (service.slug === 'refonte-site' ? 'refonte' : 'site') : service.category === 'recurrent' ? (service.slug === 'seo-local' ? 'seo' : 'maintenance') : service.category === 'pack' ? 'autre' : 'graphisme';
  }
  if (q.produit) type = 'impression';
  const config: Partial<PrintConfig> = {};
  for (const a of ATTRS) if (q[a]) config[a] = q[a];
  if (q.quantity) config.quantity = Number(q.quantity);
  return renderWizard(c, { type, service: service?.slug, product: q.produit, config, wantDesign: q.creation === '1' });
});

publicRoutes.post('/devis', async (c) => {
  const raw = await c.req.parseBody({ all: true });
  const body = flatten(raw, ['pages', 'service_options', 'files']);
  const values: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string') values[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) values[k] = v as string[];
  }
  const printRaw: Record<string, unknown> = {};
  for (const a of [...ATTRS, 'quantity']) if (typeof body[`print_${a}`] === 'string') printRaw[a] = body[`print_${a}`];
  const state: QuoteFormState = {
    type: typeof body.type === 'string' ? body.type : '',
    service: typeof body.service === 'string' ? body.service : '',
    product: typeof body.product === 'string' ? body.product : '',
    config: printRaw as Partial<PrintConfig>,
    wantDesign: body.want_design === '1',
    values,
  };
  const g = await guard(c, body, 'devis', 5);
  if (g === 'spam') return c.redirect('/devis/merci', 303);
  if (g) return renderWizard(c, { ...state, errors: [g] }, 429);

  const parsed = quoteSchema.safeParse(body);
  const errors = parsed.success ? [] : parsed.error.issues.map((i) => i.message);

  const fileList = (Array.isArray(raw.files) ? raw.files : raw.files ? [raw.files] : []).filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f);
  const uploads: UploadedFile[] = [];
  for (const f of fileList) uploads.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  const files = checkUploads(uploads);
  if (!files.ok) errors.push(files.error);

  if (!parsed.success || !files.ok) return renderWizard(c, { ...state, errors: [...new Set(errors)] }, 422);
  const sent = await submitQuoteRequest(c.get('deps'), c.get('settings'), parsed.data, printRaw, files.files, new URL(c.req.url).origin);
  await recordConversion(c, 'devis', sent.requestId);
  return c.redirect('/devis/merci', 303);
});

// ─── Devis vitrophanie & signalétique (formulaire dédié avec photos) ───

publicRoutes.get('/devis-vitrophanie-signaletique', async (c) => {
  const besoin = c.req.query('besoin');
  const values: Record<string, string | string[]> = besoin && SIGNAGE_NEEDS.some(([v]) => v === besoin) ? { needs: [besoin] } : {};
  // Depuis une page pack : métier et besoins typiques pré-remplis.
  const pack = packBySlug(c.req.query('metier'));
  if (pack) Object.assign(values, { activity: pack.activity, needs: pack.signage.needs, description: `Pack Bien démarrer — ${pack.metier} : offre vitrine & signalétique recommandée. ` });
  return c.html(<SignageQuotePage s={c.get('settings')} token={await token(c)} values={values} />);
});

publicRoutes.post('/devis-vitrophanie-signaletique', async (c) => {
  const raw = await c.req.parseBody({ all: true });
  const body = flatten(raw, ['needs', 'files']);
  const values: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string') values[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) values[k] = v as string[];
  }
  const render = async (errors: string[], status: 422 | 429) => c.html(<SignageQuotePage s={c.get('settings')} token={await token(c)} values={values} errors={errors} />, status);
  const g = await guard(c, body, 'devis', 5);
  if (g === 'spam') return c.redirect('/devis/merci', 303);
  if (g) return render([g], 429);

  const pick = (opts: [string, string][], v: unknown) => opts.find(([k]) => k === v)?.[1] ?? '';
  const needs = ((body.needs as string[] | undefined) ?? []).map((n) => pick(SIGNAGE_NEEDS, n)).filter(Boolean);
  const txt = (k: string, max: number) => (typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : '');
  const errors: string[] = [];
  if (!needs.length) errors.push('Cochez au moins un besoin.');
  const details = [
    `Besoin : ${needs.join(', ') || '—'}`,
    `Lieu de pose : ${txt('city', 120) || '—'}`,
    txt('dimensions', 300) && `Dimensions : ${txt('dimensions', 300)}`,
    txt('quantity', 60) && `Quantité : ${txt('quantity', 60)}`,
    `Création graphique : ${pick(SIGNAGE_DESIGN, body.design) || '—'}`,
    `Pose : ${pick(SIGNAGE_POSE, body.pose) || '—'}`,
  ].filter(Boolean);
  const message = txt('description', 4000);
  const parsed = quoteSchema.safeParse({
    ...body,
    type: 'signaletique',
    description: message.length >= 10 ? `${message}\n\n${details.join('\n')}` : message,
    service: 'vitrophanie-signaletique',
    customer_type: 'pro',
  });
  if (!parsed.success) errors.push(...parsed.error.issues.map((i) => i.message));
  if (!txt('city', 120)) errors.push('Indiquez la commune du lieu de pose.');

  const fileList = (Array.isArray(raw.files) ? raw.files : raw.files ? [raw.files] : []).filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f);
  const uploads: UploadedFile[] = [];
  for (const f of fileList) uploads.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  const files = checkUploads(uploads);
  if (!files.ok) errors.push(files.error);

  if (errors.length || !parsed.success || !files.ok) return render([...new Set(errors)], 422);
  const sent = await submitQuoteRequest(c.get('deps'), c.get('settings'), parsed.data, {}, files.files, new URL(c.req.url).origin);
  await recordConversion(c, 'devis', sent.requestId);
  return c.redirect('/devis/merci', 303);
});

publicRoutes.get('/devis/merci', (c) =>
  c.html(
    <SimpleMessage
      s={c.get('settings')}
      title="Demande envoyée, merci !"
      text="Nous avons bien reçu votre demande. Un accusé de réception est envoyé à l’adresse indiquée ; nous revenons vers vous sous 48 h ouvrées avec des questions ou un devis détaillé."
      path="/devis/merci"
      status="success"
    />,
  ),
);
