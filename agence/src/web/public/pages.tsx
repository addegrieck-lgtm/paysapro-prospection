import { raw } from 'hono/html';
import type { Settings } from '../../domain/settings';
import type { FaqRow, LocalPageRow, PortfolioRow, PostRow, ProductRow, ServiceRow } from '../../repo/types';
import { Layout, absoluteUrl } from '../layout';
import { CATEGORY_LABELS, SERVICE_PAGES, type ServicePageDef, type VisualKind } from '../content';
import { ConceptBadge, ContactForm, CtaBand, FaqList, Notice, Price, Process, SectionHead, ServiceCard, faqJsonLd } from '../components';
import { BrochureMock, BrowserMock, HeroComposition, IdentityBoard, MaintenanceMock, PortfolioVisual, PrintComposition, ProductVisual, SeoMock, SocialMock } from '../illustrations';
import { formatEuros, ttcOf } from '../../domain/money';
import { formatDate } from '../../domain/dates';
import { lines, renderMarkdown } from '../../domain/text';

function PageVisual({ kind, s }: { kind: VisualKind; s: Settings }) {
  const a = s.accentColor;
  switch (kind) {
    case 'site':
      return <BrowserMock accent={a} />;
    case 'site-sante':
      return <BrowserMock accent="#2D6A4F" title="Cabinet Mouvement" variant="sante" />;
    case 'print':
      return <PrintComposition accent={a} />;
    case 'identity':
      return <IdentityBoard />;
    case 'social':
      return <SocialMock accent={a} />;
    case 'brochure':
      return <BrochureMock />;
    case 'cards':
      return <ProductVisual visual="cartes" accent={a} />;
    case 'seo':
      return <SeoMock accent={a} />;
    case 'maintenance':
      return <MaintenanceMock accent={a} />;
    default:
      return <HeroComposition accent={a} />;
  }
}

function PageHero({ eyebrow, h1, h1em, intro, children }: { eyebrow: string; h1: string; h1em?: string; intro: string; children?: unknown }) {
  return (
    <section class="page-hero">
      <div class="container page-hero-grid">
        <div>
          <p class="eyebrow">{eyebrow}</p>
          <h1>
            {h1} {h1em && <em>{h1em}</em>}
          </h1>
          <p class="hero-lead">{intro}</p>
        </div>
        {children ? <div class="page-hero-visual">{children as never}</div> : null}
      </div>
    </section>
  );
}

export function ServicePage(p: { s: Settings; def: ServicePageDef; services: ServiceRow[]; products: ProductRow[]; faqs: FaqRow[] }) {
  const { s, def } = p;
  const pageFaqs: FaqRow[] = [
    ...def.faq.map(([question, answer], i) => ({ id: -i - 1, topic: 'page', question, answer, status: 'published', sort_order: i })),
    ...p.faqs,
  ];
  const offers = p.services
    .filter((x) => x.price_ht != null && x.price_mode !== 'quote')
    .map((x) => ({
      '@type': 'Offer',
      name: x.name,
      priceCurrency: 'EUR',
      price: (x.price_ht! / 100).toFixed(2),
      priceSpecification: { '@type': 'PriceSpecification', price: (x.price_ht! / 100).toFixed(2), priceCurrency: 'EUR', valueAddedTaxIncluded: false, ...(x.price_mode === 'from' ? { minPrice: (x.price_ht! / 100).toFixed(2) } : {}) },
    }));
  const related = def.related.map((path) => SERVICE_PAGES.find((x) => x.path === path)).filter(Boolean) as ServicePageDef[];
  return (
    <Layout
      s={s}
      meta={{
        title: def.metaTitle,
        description: def.metaDescription,
        path: def.path,
        breadcrumbs: [{ name: def.name, path: def.path }],
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: def.name,
            description: def.metaDescription,
            provider: { '@type': 'Organization', name: s.agencyName, ...(s.siteUrl ? { url: absoluteUrl(s, '/') } : {}) },
            areaServed: { '@type': 'Country', name: 'France' },
            ...(offers.length ? { offers } : {}),
          },
          ...(pageFaqs.length ? [faqJsonLd(pageFaqs)] : []),
        ],
      }}
    >
      <PageHero eyebrow={def.eyebrow} h1={def.h1} h1em={def.h1em} intro={def.intro}>
        <PageVisual kind={def.visual} s={s} />
      </PageHero>
      <div class="container hero-ctas">
        <a href={`/devis?prestation=${p.services[0]?.slug ?? ''}`} class="btn btn-primary btn-lg">Obtenir mon devis gratuit</a>
        {def.productSlugs?.length ? (
          <a href={`/impression/${def.productSlugs[0]}`} class="btn btn-outline btn-lg">Configurer l’impression</a>
        ) : (
          <a href="/realisations" class="btn btn-outline btn-lg">Voir des réalisations</a>
        )}
      </div>

      <section class="section">
        <div class="container">
          <div class="benefits">
            {def.benefits.map(([t, d]) => (
              <div class="benefit" data-reveal>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {p.services.length > 0 && (
        <section class="section section-sand" aria-labelledby="offres">
          <div class="container">
            <SectionHead id="offres" eyebrow="Offres et tarifs" title="Choisissez la formule adaptée." intro="Prix de départ indicatifs hors taxes. Le devis définitif est établi après échange sur votre besoin." />
            <div class={`cards cards-${Math.min(p.services.length, 3)}`}>
              {p.services.map((svc) => (
                <ServiceCard svc={svc} s={s} />
              ))}
            </div>
          </div>
        </section>
      )}

      {def.details?.length ? (
        <section class="section">
          <div class="container">
            <div class="detail-cols">
              {def.details.map((d) => (
                <div>
                  <h2 class="h3">{d.title}</h2>
                  <ul class="checks">
                    {d.items.map((i) => (
                      <li>{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {p.products.length > 0 && (
        <section class="section" aria-labelledby="impression">
          <div class="container">
            <SectionHead id="impression" eyebrow="Impression" title="Imprimer avec nous" intro="Configurez votre support : les prix d’impression et de livraison sont indiqués séparément de la création graphique." />
            <div class="product-grid">
              {p.products.map((pr) => (
                <ProductCard product={pr} s={s} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section class="section section-sand">
        <div class="container">
          <SectionHead eyebrow="Déroulement" title="Comment se passe votre projet" align="center" />
          <Process steps={def.steps} />
        </div>
      </section>

      {pageFaqs.length > 0 && (
        <section class="section">
          <div class="container narrow">
            <SectionHead eyebrow="Questions fréquentes" title={`${def.name} : vos questions`} align="center" />
            <FaqList faqs={pageFaqs} />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section class="section section-tight">
          <div class="container">
            <p class="eyebrow">À découvrir aussi</p>
            <div class="related">
              {related.map((r) => (
                <a href={r.path} class="related-link">
                  <span>{r.name}</span>
                  <span aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
      <CtaBand />
    </Layout>
  );
}

export function ProductCard({ product, s }: { product: ProductRow; s: Settings }) {
  return (
    <a href={`/impression/${product.slug}`} class="card product-card" data-reveal>
      <div class="product-visual">
        <ProductVisual visual={product.visual} accent={s.accentColor} />
      </div>
      <div class="product-body">
        <h3>{product.name}</h3>
        <p class="muted">{product.summary}</p>
        <span class="link-arrow">Configurer</span>
      </div>
    </a>
  );
}

export function PricingPage(p: { s: Settings; services: ServiceRow[] }) {
  const { s } = p;
  const order = ['web', 'pack', 'graphisme', 'recurrent', 'accompagnement'];
  const groups = order.map((cat) => [cat, p.services.filter((x) => x.category === cat)] as const).filter(([, list]) => list.length);
  return (
    <Layout
      s={s}
      meta={{
        title: 'Tarifs : sites internet, création graphique, maintenance et SEO',
        description: 'Tous nos tarifs de départ : sites internet, identité visuelle, flyers, cartes de visite, maintenance et référencement. Prix HT, ce qui est inclus et ce qui ne l’est pas.',
        path: '/tarifs',
        breadcrumbs: [{ name: 'Tarifs', path: '/tarifs' }],
      }}
    >
      <PageHero eyebrow="Tarifs" h1="Des prix clairs," h1em="sans astérisque caché." intro="Prix de départ indicatifs, hors taxes. Pour chaque prestation : ce qui est inclus, le délai, le nombre de révisions, les options et ce qui reste à prévoir." />
      <section class="section section-tight">
        <div class="container">
          <Notice>
            Les prix de <strong>création graphique</strong> n’incluent jamais l’impression ni la livraison, chiffrées séparément dans le{' '}
            <a href="/configurateur">configurateur d’impression</a>. Les sites n’incluent pas le nom de domaine ni l’hébergement.
            {s.vatMode === 'franchise' ? ' TVA non applicable, art. 293 B du CGI.' : ` Prix TTC calculés avec une TVA de ${String(s.vatRate).replace('.', ',')} %.`}
          </Notice>
        </div>
      </section>
      {groups.map(([cat, list]) => (
        <section class="section section-tight">
          <div class="container">
            <h2 class="group-title">{CATEGORY_LABELS[cat] ?? cat}</h2>
            <div class="price-table">
              {list.map((svc) => {
                const opts = safeOptions(svc.options);
                return (
                  <article class="price-row" id={svc.slug}>
                    <div class="price-row-main">
                      <h3>{svc.name}</h3>
                      <p>{svc.description}</p>
                      {lines(svc.includes).length > 0 && (
                        <ul class="checks checks-compact">
                          {lines(svc.includes).map((i) => (
                            <li>{i}</li>
                          ))}
                        </ul>
                      )}
                      <dl class="meta-list">
                        {svc.lead_time && (
                          <div>
                            <dt>Délai estimatif</dt>
                            <dd>{svc.lead_time}</dd>
                          </div>
                        )}
                        {svc.revisions != null && (
                          <div>
                            <dt>Révisions incluses</dt>
                            <dd>{svc.revisions}</dd>
                          </div>
                        )}
                      </dl>
                      {opts.length > 0 && (
                        <div class="options-list">
                          <p class="small strong">Options</p>
                          <ul>
                            {opts.map((o) => (
                              <li>
                                {o.name} : <strong>+{formatEuros(o.price_ht)} HT</strong>
                                {s.vatMode === 'normal' && <span class="muted"> ({formatEuros(ttcOf(o.price_ht, s.vatRate))} TTC)</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(svc.conditions || svc.exclusions) && (
                        <details class="conditions">
                          <summary>Conditions et exclusions</summary>
                          {svc.conditions && <p>{svc.conditions}</p>}
                          {svc.exclusions && (
                            <p>
                              <strong>Non inclus : </strong>
                              {svc.exclusions}
                            </p>
                          )}
                        </details>
                      )}
                    </div>
                    <div class="price-row-side">
                      <Price svc={svc} s={s} size="lg" />
                      <a href={`/devis?prestation=${svc.slug}`} class="btn btn-primary btn-block">Demander un devis</a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ))}
      <CtaBand title="Besoin d’un chiffrage précis ?" />
    </Layout>
  );
}

export function safeOptions(json: string): { name: string; price_ht: number }[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((o) => o && typeof o.name === 'string' && Number.isInteger(o.price_ht)) : [];
  } catch {
    return [];
  }
}

export function PortfolioPage(p: { s: Settings; items: PortfolioRow[]; caseStudies?: boolean }) {
  const { s } = p;
  const cs = !!p.caseStudies;
  return (
    <Layout
      s={s}
      meta={{
        title: cs ? 'Études de cas' : 'Réalisations et portfolio',
        description: cs
          ? 'Études de cas détaillées : problématique, démarche et livrables. Projets de démonstration clairement identifiés.'
          : 'Sites internet, identités visuelles, flyers, cartes de visite et brochures : découvrez notre travail à travers des projets de démonstration.',
        path: cs ? '/etudes-de-cas' : '/realisations',
        breadcrumbs: [{ name: cs ? 'Études de cas' : 'Réalisations', path: cs ? '/etudes-de-cas' : '/realisations' }],
      }}
    >
      <PageHero
        eyebrow={cs ? 'Études de cas' : 'Réalisations'}
        h1={cs ? 'Du problème à la solution,' : 'Notre travail,'}
        h1em={cs ? 'étape par étape.' : 'en images.'}
        intro={
          cs
            ? 'Chaque étude détaille la problématique, la démarche et les livrables. Aucun résultat chiffré n’est revendiqué pour les projets de démonstration.'
            : 'Notre agence démarre : les projets ci-dessous sont des concepts de démonstration, réalisés pour illustrer notre savoir-faire. Les entreprises présentées sont fictives.'
        }
      />
      <section class="section section-tight">
        <div class="container">
          {p.items.length === 0 ? (
            <div class="empty">
              <p>Aucune réalisation publiée pour le moment.</p>
              <a href="/devis" class="btn btn-primary">Parlez-nous de votre projet</a>
            </div>
          ) : (
            <div class="work-grid work-grid-2">
              {p.items.map((w) => (
                <a href={`/${cs ? 'etudes-de-cas' : 'realisations'}/${w.slug}`} class="work-card" data-reveal>
                  <div class="work-visual">
                    <PortfolioVisual visual={w.visual} accent={w.accent || s.accentColor} title={w.title} />
                  </div>
                  <div class="work-body">
                    <p class="work-cat">
                      {w.category} {w.is_concept ? <ConceptBadge /> : null}
                    </p>
                    <h2 class="h3">{w.title}</h2>
                    <p class="muted">{w.summary}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
          {!cs && (
            <p class="center mt-lg">
              <a href="/etudes-de-cas" class="link-arrow">Lire les études de cas détaillées</a>
            </p>
          )}
        </div>
      </section>
      <CtaBand title="Votre projet pourrait être le prochain" />
    </Layout>
  );
}

export function PortfolioDetail(p: { s: Settings; item: PortfolioRow; others: PortfolioRow[]; base: 'realisations' | 'etudes-de-cas' }) {
  const { s, item } = p;
  const label = p.base === 'realisations' ? 'Réalisations' : 'Études de cas';
  return (
    <Layout
      s={s}
      meta={{
        title: `${item.title} — ${item.category}${item.is_concept ? ' (concept)' : ''}`,
        description: item.summary,
        path: `/${p.base}/${item.slug}`,
        breadcrumbs: [
          { name: label, path: `/${p.base}` },
          { name: item.title, path: `/${p.base}/${item.slug}` },
        ],
      }}
    >
      <section class="page-hero">
        <div class="container narrow">
          <p class="work-cat">
            {item.category} {item.is_concept ? <ConceptBadge /> : null}
          </p>
          <h1>{item.title}</h1>
          <p class="hero-lead">{item.summary}</p>
          {item.is_concept ? (
            <Notice>
              <strong>{item.client_label || 'Projet fictif — concept de démonstration'}.</strong> Ce projet a été réalisé pour illustrer notre démarche ; il ne
              s’agit pas d’un client réel.
            </Notice>
          ) : null}
        </div>
      </section>
      <div class="container">
        <div class="case-visual">
          <PortfolioVisual visual={item.visual} accent={item.accent || s.accentColor} title={item.title} />
        </div>
      </div>
      <section class="section">
        <div class="container narrow case-body">
          {item.challenge && (
            <div>
              <h2>Le besoin</h2>
              <p>{item.challenge}</p>
            </div>
          )}
          {item.solution && (
            <div>
              <h2>Notre réponse</h2>
              <p>{item.solution}</p>
            </div>
          )}
          {lines(item.deliverables).length > 0 && (
            <div>
              <h2>Livrables</h2>
              <ul class="checks">
                {lines(item.deliverables).map((d) => (
                  <li>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {item.outcome && (
            <div>
              <h2>{item.is_concept ? 'Et sur un vrai projet ?' : 'Résultats'}</h2>
              <p>{item.outcome}</p>
            </div>
          )}
        </div>
      </section>
      {p.others.length > 0 && (
        <section class="section section-sand">
          <div class="container">
            <SectionHead title="Autres réalisations" />
            <div class="work-grid">
              {p.others.slice(0, 3).map((w) => (
                <a href={`/realisations/${w.slug}`} class="work-card">
                  <div class="work-visual">
                    <PortfolioVisual visual={w.visual} accent={w.accent || s.accentColor} title={w.title} />
                  </div>
                  <div class="work-body">
                    <p class="work-cat">{w.category}</p>
                    <h3>{w.title}</h3>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
      <CtaBand />
    </Layout>
  );
}

export function AboutPage({ s }: { s: Settings }) {
  return (
    <Layout
      s={s}
      meta={{
        title: 'À propos de l’agence',
        description: `${s.agencyName} accompagne les indépendants, artisans, commerçants et TPE dans leur communication : site internet, identité visuelle, impression et visibilité locale.`,
        path: '/a-propos',
        breadcrumbs: [{ name: 'À propos', path: '/a-propos' }],
      }}
    >
      <PageHero eyebrow="L’agence" h1="Une agence à taille humaine," h1em="pour les entreprises à taille humaine." intro={`${s.agencyName} est une agence de communication numérique et imprimée, créée pour offrir aux petites entreprises le niveau de soin des grandes marques, avec des prix lisibles.`} />
      <section class="section">
        <div class="container narrow prose">
          <h2>Pourquoi cette agence</h2>
          <p>
            Beaucoup de petites entreprises jonglent entre un site vieillissant, des flyers commandés en urgence et des réseaux sociaux tenus « quand on a
            le temps ». Chaque support est fait séparément, par des prestataires différents, et l’ensemble manque de cohérence.
          </p>
          <p>
            Nous réunissons sous un même toit la création de sites, l’identité visuelle, les supports imprimés et la visibilité locale. Un seul
            interlocuteur, une seule identité, des supports qui se répondent.
          </p>
          <h2>Nos engagements</h2>
          <ul class="checks">
            <li>
              <strong>Transparence des prix</strong> : prix de départ publiés, création, impression et livraison toujours séparées.
            </li>
            <li>
              <strong>Honnêteté</strong> : pas de faux avis, pas de fausses références, pas de promesse de première place sur Google.
            </li>
            <li>
              <strong>Validation systématique</strong> : rien n’est imprimé sans BAT validé, rien n’est mis en ligne sans votre recette.
            </li>
            <li>
              <strong>Propriété</strong> : votre nom de domaine, vos comptes et vos fichiers vous appartiennent.
            </li>
            <li>
              <strong>Respect des données</strong> : aucun traceur publicitaire, aucune prospection sans votre accord.
            </li>
          </ul>
          <h2>Pour qui ?</h2>
          <p>
            Artisans, commerçants, professions libérales, indépendants, associations et petites entreprises de tous secteurs, partout en France. Nous
            travaillons à distance, par téléphone, visioconférence et e-mail.
          </p>
        </div>
      </section>
      <section class="section section-sand">
        <div class="container">
          <SectionHead eyebrow="Méthode" title="Comment nous travaillons" align="center" />
          <Process />
        </div>
      </section>
      <CtaBand />
    </Layout>
  );
}

export function ContactPage({ s, token, sent, error, values }: { s: Settings; token: string; sent?: boolean; error?: string; values?: Record<string, string> }) {
  return (
    <Layout
      s={s}
      meta={{
        title: 'Contact',
        description: `Contactez ${s.agencyName} pour votre site internet, votre identité visuelle ou vos impressions. Réponse sous 48 h ouvrées.`,
        path: '/contact',
        breadcrumbs: [{ name: 'Contact', path: '/contact' }],
      }}
    >
      <PageHero eyebrow="Contact" h1="Parlons de" h1em="votre projet." intro="Une question, un projet, un besoin urgent ? Écrivez-nous : nous répondons sous 48 h ouvrées. Pour un chiffrage, le formulaire de devis est plus rapide." />
      <section class="section section-tight">
        <div class="container split">
          <div>
            <ul class="contact-list">
              {s.contactEmail && (
                <li>
                  <span>E-mail</span>
                  <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>
                </li>
              )}
              {s.contactPhone && (
                <li>
                  <span>Téléphone</span>
                  <a href={`tel:${s.contactPhone.replace(/\s/g, '')}`}>{s.contactPhone}</a>
                </li>
              )}
              <li>
                <span>Zone d’intervention</span>
                {s.serviceArea}
              </li>
              {s.openingHours && (
                <li>
                  <span>Horaires</span>
                  {s.openingHours}
                </li>
              )}
            </ul>
            <div class="aside-card">
              <p class="strong">Besoin d’un prix ?</p>
              <p class="muted">Le formulaire de devis vous guide en 6 étapes et nous donne toutes les informations utiles.</p>
              <a href="/devis" class="btn btn-primary">Demander un devis</a>
            </div>
          </div>
          <div class="form-card">
            {sent ? (
              <Notice kind="success">
                <strong>Merci, votre message a bien été envoyé.</strong> Nous vous répondons sous 48 h ouvrées.
              </Notice>
            ) : (
              <>
                {error && <Notice kind="error">{error}</Notice>}
                <ContactForm token={token} subjectDefault={values?.message ?? ''} />
              </>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function BlogList({ s, posts }: { s: Settings; posts: PostRow[] }) {
  return (
    <Layout
      s={s}
      meta={{
        title: 'Blog : conseils site internet, impression et visibilité locale',
        description: 'Conseils pratiques pour les petites entreprises : sites internet, supports imprimés, identité visuelle et référencement local.',
        path: '/blog',
        breadcrumbs: [{ name: 'Blog', path: '/blog' }],
      }}
    >
      <PageHero eyebrow="Blog" h1="Conseils pratiques," h1em="sans jargon." intro="Des articles courts et concrets pour vous aider à mieux communiquer, que vous travailliez avec nous ou non." />
      <section class="section section-tight">
        <div class="container">
          {posts.length === 0 ? (
            <div class="empty">
              <p>Aucun article publié pour le moment.</p>
            </div>
          ) : (
            <div class="post-grid">
              {posts.map((post) => (
                <a href={`/blog/${post.slug}`} class="card post-card" data-reveal>
                  <p class="post-meta">
                    {post.category && <span>{post.category}</span>}
                    <time datetime={post.published_at ?? ''}>{formatDate(post.published_at)}</time>
                  </p>
                  <h2 class="h3">{post.title}</h2>
                  <p class="muted">{post.excerpt}</p>
                  <span class="link-arrow">Lire l’article</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

export function BlogPost({ s, post, others }: { s: Settings; post: PostRow; others: PostRow[] }) {
  return (
    <Layout
      s={s}
      meta={{
        title: post.meta_title || post.title,
        description: post.meta_description || post.excerpt,
        path: `/blog/${post.slug}`,
        ogType: 'article',
        breadcrumbs: [
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` },
        ],
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            datePublished: post.published_at,
            dateModified: post.updated_at,
            author: { '@type': 'Organization', name: s.agencyName },
            publisher: { '@type': 'Organization', name: s.agencyName },
            ...(s.siteUrl ? { mainEntityOfPage: absoluteUrl(s, `/blog/${post.slug}`) } : {}),
          },
        ],
      }}
    >
      <article>
        <header class="page-hero">
          <div class="container narrow">
            <p class="post-meta">
              {post.category && <span>{post.category}</span>}
              <time datetime={post.published_at ?? ''}>{formatDate(post.published_at)}</time>
            </p>
            <h1>{post.title}</h1>
            <p class="hero-lead">{post.excerpt}</p>
          </div>
        </header>
        <div class="container narrow prose">{raw(renderMarkdown(post.body))}</div>
      </article>
      {others.length > 0 && (
        <section class="section">
          <div class="container narrow">
            <p class="eyebrow">À lire aussi</p>
            <div class="related">
              {others.map((o) => (
                <a href={`/blog/${o.slug}`} class="related-link">
                  <span>{o.title}</span>
                  <span aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
      <CtaBand />
    </Layout>
  );
}

export function LocalPage({ s, page }: { s: Settings; page: LocalPageRow }) {
  return (
    <Layout
      s={s}
      meta={{
        title: page.title,
        description: page.meta_description || page.intro,
        path: `/agence-web/${page.slug}`,
        breadcrumbs: [{ name: page.title, path: `/agence-web/${page.slug}` }],
      }}
    >
      <PageHero eyebrow={page.city} h1={page.title} intro={page.intro} />
      <section class="section section-tight">
        <div class="container narrow prose">{raw(renderMarkdown(page.body))}</div>
      </section>
      <CtaBand />
    </Layout>
  );
}

export function SimpleMessage({ s, title, text, path, noindex = true, status }: { s: Settings; title: string; text: string; path: string; noindex?: boolean; status?: 'success' | 'error' }) {
  return (
    <Layout s={s} meta={{ title, description: text, path, noindex }}>
      <section class="page-hero">
        <div class="container narrow center">
          {status === 'success' && <div class="big-check" aria-hidden="true">✓</div>}
          <h1>{title}</h1>
          <p class="hero-lead">{text}</p>
          <div class="btn-row center-row">
            <a href="/" class="btn btn-primary">Retour à l’accueil</a>
            <a href="/realisations" class="btn btn-outline">Voir nos réalisations</a>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function NotFoundPage({ s, path }: { s: Settings; path: string }) {
  return (
    <Layout s={s} meta={{ title: 'Page introuvable', description: 'Cette page n’existe pas ou a été déplacée.', path, noindex: true }}>
      <section class="page-hero">
        <div class="container narrow">
          <p class="eyebrow">Erreur 404</p>
          <h1>
            Cette page s’est <em>égarée.</em>
          </h1>
          <p class="hero-lead">L’adresse a peut-être changé. Voici les pages les plus utiles :</p>
          <div class="related">
            {[
              ['/devis', 'Demander un devis gratuit'],
              ['/tarifs', 'Consulter nos tarifs'],
              ['/creation-site-internet', 'Création de site internet'],
              ['/impression', 'Catalogue d’impression'],
              ['/realisations', 'Réalisations'],
              ['/contact', 'Nous contacter'],
            ].map(([href, label]) => (
              <a href={href} class="related-link">
                <span>{label}</span>
                <span aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function ClientSpaceInfo({ s }: { s: Settings }) {
  return (
    <Layout
      s={s}
      meta={{
        title: 'Espace client',
        description: 'Consultez et validez vos devis, bons à tirer et recettes de site via vos liens sécurisés.',
        path: '/espace-client',
        breadcrumbs: [{ name: 'Espace client', path: '/espace-client' }],
      }}
    >
      <PageHero eyebrow="Espace client" h1="Vos documents," h1em="en un clic sécurisé." intro="Pas de mot de passe à retenir : chaque devis, bon à tirer (BAT) ou recette de site vous est envoyé par e-mail avec un lien personnel et sécurisé." />
      <section class="section section-tight">
        <div class="container narrow prose">
          <h2>Ce que vous pouvez faire</h2>
          <ul class="checks">
            <li>Consulter votre devis et l’accepter en ligne</li>
            <li>Examiner votre bon à tirer et l’approuver ou demander des corrections</li>
            <li>Valider la recette de votre site avant sa mise en ligne</li>
            <li>Suivre l’avancement de votre commande</li>
          </ul>
          <h2>Vous avez perdu votre lien ?</h2>
          <p>
            Pour votre sécurité, nous ne renvoyons les liens qu’à l’adresse e-mail associée à votre dossier. Écrivez-nous depuis cette adresse via la{' '}
            <a href="/contact">page contact</a> en précisant votre numéro de devis ou de commande.
          </p>
          <p class="muted small">Ne transférez pas vos liens : toute personne qui en dispose peut consulter le document concerné.</p>
        </div>
      </section>
    </Layout>
  );
}

export function SitePlan({ s, posts, products, items, local }: { s: Settings; posts: PostRow[]; products: ProductRow[]; items: PortfolioRow[]; local: LocalPageRow[] }) {
  const main: [string, string][] = [
    ['/', 'Accueil'],
    ...SERVICE_PAGES.map((p) => [p.path, p.name] as [string, string]),
    ['/tarifs', 'Tarifs'],
    ['/impression', 'Catalogue d’impression'],
    ['/configurateur', 'Configurateur'],
    ['/devis', 'Demande de devis'],
    ['/realisations', 'Réalisations'],
    ['/etudes-de-cas', 'Études de cas'],
    ['/a-propos', 'À propos'],
    ['/contact', 'Contact'],
    ['/blog', 'Blog'],
    ['/espace-client', 'Espace client'],
    ['/mentions-legales', 'Mentions légales'],
    ['/confidentialite', 'Politique de confidentialité'],
    ['/cookies', 'Gestion des cookies'],
    ['/cgv', 'Conditions générales de vente'],
  ];
  return (
    <Layout s={s} meta={{ title: 'Plan du site', description: 'Toutes les pages du site.', path: '/plan-du-site', breadcrumbs: [{ name: 'Plan du site', path: '/plan-du-site' }] }}>
      <section class="page-hero">
        <div class="container">
          <h1>Plan du site</h1>
        </div>
      </section>
      <section class="section section-tight">
        <div class="container detail-cols">
          <div>
            <h2 class="h3">Pages</h2>
            <ul class="plain-list">
              {main.map(([h, l]) => (
                <li>
                  <a href={h}>{l}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 class="h3">Impression</h2>
            <ul class="plain-list">
              {products.map((p) => (
                <li>
                  <a href={`/impression/${p.slug}`}>{p.name}</a>
                </li>
              ))}
            </ul>
            <h2 class="h3">Réalisations</h2>
            <ul class="plain-list">
              {items.map((p) => (
                <li>
                  <a href={`/realisations/${p.slug}`}>{p.title}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 class="h3">Articles</h2>
            <ul class="plain-list">
              {posts.map((p) => (
                <li>
                  <a href={`/blog/${p.slug}`}>{p.title}</a>
                </li>
              ))}
            </ul>
            {local.length > 0 && (
              <>
                <h2 class="h3">Zones</h2>
                <ul class="plain-list">
                  {local.map((p) => (
                    <li>
                      <a href={`/agence-web/${p.slug}`}>{p.title}</a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export { PageHero };
