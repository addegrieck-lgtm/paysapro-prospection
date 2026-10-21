import { raw } from 'hono/html';
import type { Settings } from '../../domain/settings';
import type { FaqRow, PortfolioRow, ServiceRow } from '../../repo/types';
import { Layout, absoluteUrl } from '../layout';
import { areaServed, providerRef } from '../seo';
import { ConceptBadge, CtaBand, FaqList, Price, SectionHead, faqJsonLd } from '../components';
import { PortfolioVisual } from '../illustrations';
import { renderMarkdown } from '../../domain/text';
import { PageHero, PageVisual } from './pages';
import { PACKS, type PackDef } from '../packs';
import type { PackIcon } from '../packs/types';

const md = (text: string) => raw(renderMarkdown(text));
const toFaq = (faq: [string, string][]): FaqRow[] => faq.map(([question, answer], i) => ({ id: -i - 1, topic: 'page', question, answer, status: 'published', sort_order: i }));
/** « 1 890 € » → « 1890.00 » (null si le prix n'est pas encore fixé). */
const priceValue = (label: string) => {
  const n = Number(label.replace(/[^\d,]/g, '').replace(',', '.'));
  return label.includes('À COMPLÉTER') || !n ? null : n.toFixed(2);
};
const contactHref = (p: PackDef) => `/contact?pack=${p.slug}#formulaire`;
const signageHref = (p: PackDef) => `/devis-vitrophanie-signaletique?metier=${p.slug}`;

/** Pictogrammes des métiers (trait, couleur héritée). */
export function PackPicto({ icon, size = 44 }: { icon: PackIcon; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const };
  return (
    <svg class="pack-picto" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      {icon === 'restaurant' && (
        <g {...common}>
          <path d="M14 6v14a4 4 0 0 0 8 0V6M18 6v36" />
          <path d="M32 42V6c4 2 6 8 6 14s-2 8-6 8" />
        </g>
      )}
      {icon === 'jardin' && (
        <g {...common}>
          <path d="M24 42V22" />
          <path d="M24 26c-8 0-12-5-12-12 7 0 12 4 12 12zM24 22c0-8 5-13 13-13 0 8-5 13-13 13z" />
          <path d="M8 42h32" />
        </g>
      )}
      {icon === 'coiffure' && (
        <g {...common}>
          <circle cx="14" cy="34" r="5" />
          <circle cx="34" cy="34" r="5" />
          <path d="M17.5 30.5 36 8M30.5 30.5 12 8" />
        </g>
      )}
      {icon === 'batiment' && (
        <g {...common}>
          <path d="M6 22 24 8l18 14" />
          <path d="M11 19v23h26V19" />
          <path d="M20 42V30h8v12" />
        </g>
      )}
      {icon === 'boutique' && (
        <g {...common}>
          <path d="M8 18h32l-3-10H11z" />
          <path d="M10 18v24h28V18M20 42V30h8v12" />
        </g>
      )}
    </svg>
  );
}

/** Carte d'un pack (hub, accueil). */
export function PackCard({ p }: { p: PackDef }) {
  return (
    <a href={`/packs/${p.slug}`} class="packm-card" data-reveal>
      <PackPicto icon={p.icon} />
      <h3>{p.card.title}</h3>
      <p>{p.card.text}</p>
      <span class="link-arrow">Voir le pack</span>
    </a>
  );
}

/** Comparatif visuel : pack de base / options métier / recommandé vitrine. */
function Compare({ p }: { p: PackDef }) {
  return (
    <div class="pack-compare">
      <article class="pc-col">
        <p class="pc-kicker">1 · Pack de base</p>
        <h3>L’essentiel pour démarrer</h3>
        <p class="pc-price">
          À partir de <strong>{p.base.priceFrom}</strong> HT
        </p>
        <ul class="checks">
          <li>{p.base.site.title}</li>
          <li>Logo, cartes de visite, flyers et supports du métier</li>
          <li>Impressions incluses</li>
          <li>Fiche Google Business Profile</li>
        </ul>
        <a href="#pack-de-base" class="link-arrow">
          Détail du pack
        </a>
      </article>
      <article class="pc-col">
        <p class="pc-kicker">2 · Options métier</p>
        <h3>À ajouter selon vos besoins</h3>
        <p class="pc-price">Sur devis · certaines offertes selon la prestation</p>
        <ul class="pc-list">
          {p.options.items.map((o) => (
            <li>{o.name}</li>
          ))}
        </ul>
        <a href="#options" class="link-arrow">
          Voir les options
        </a>
      </article>
      <article class="pc-col pc-recommended">
        <p class="pc-badge">Recommandé pour ce métier</p>
        <p class="pc-kicker">3 · Vitrine & signalétique</p>
        <h3>Être vu depuis la rue</h3>
        <p class="pc-price">Sur devis · pose par notre partenaire</p>
        <ul class="pc-list">
          {p.signage.items.map(([t]) => (
            <li>{t}</li>
          ))}
        </ul>
        <a href={signageHref(p)} class="btn btn-primary btn-sm">
          Demander un devis pour ma vitrine
        </a>
      </article>
    </div>
  );
}

export function PackPage({ s, p, item }: { s: Settings; p: PackDef; item?: PortfolioRow }) {
  const faqs = toFaq(p.faq);
  const name = `Pack Bien démarrer — ${p.metier}`;
  return (
    <Layout
      s={s}
      meta={{
        title: p.metaTitle,
        description: p.metaDescription,
        path: `/packs/${p.slug}`,
        breadcrumbs: [
          { name: 'Packs Bien démarrer', path: '/packs' },
          { name: p.metier, path: `/packs/${p.slug}` },
        ],
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name,
            serviceType: `Communication pour ${p.metier.toLowerCase()} : site internet, identité visuelle, impression et signalétique`,
            description: p.metaDescription,
            provider: providerRef(s),
            areaServed: areaServed(s),
            url: absoluteUrl(s, `/packs/${p.slug}`),
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name,
              itemListElement: [
                {
                  '@type': 'Offer',
                  itemOffered: { '@type': 'Service', name: `${name} : pack de base` },
                  ...(priceValue(p.base.priceFrom)
                    ? { priceSpecification: { '@type': 'PriceSpecification', minPrice: priceValue(p.base.priceFrom), priceCurrency: 'EUR', valueAddedTaxIncluded: false } }
                    : {}),
                },
                ...p.options.items.map((o) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: o.name } })),
                { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Vitrine et signalétique (sur devis)' } },
              ],
            },
          },
          faqJsonLd(faqs),
        ],
      }}
    >
      <PageHero eyebrow={p.eyebrow} h1={p.h1} h1em={p.h1em} intro={p.intro}>
        <PageVisual kind={p.visual} s={s} />
      </PageHero>
      <div class="container hero-ctas">
        <a href={contactHref(p)} class="btn btn-primary btn-lg">
          Je lance mon activité
        </a>
        <a href="#comparatif" class="btn btn-outline btn-lg">
          Voir le contenu du pack
        </a>
      </div>

      {/* 1. Enjeux et erreurs fréquentes */}
      <section class="section" aria-labelledby="enjeux">
        <div class="container">
          <div class="narrow-left">
            <SectionHead id="enjeux" eyebrow="Les enjeux" title={p.stakes.title} />
            <div class="prose landing-prose">{md(p.stakes.body)}</div>
          </div>
          <h3 class="group-title mt-lg">{p.mistakes.title}</h3>
          <div class="feature-grid">
            {p.mistakes.items.map(([t, d]) => (
              <div class="feature-card feature-warn" data-reveal>
                <h4>{t}</h4>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparatif */}
      <section class="section section-sand" id="comparatif" aria-labelledby="comparatif-titre">
        <div class="container">
          <SectionHead id="comparatif-titre" eyebrow="Le pack en un coup d’œil" title="Une base solide, des options métier, une vitrine qui se voit." align="center" />
          <Compare p={p} />
        </div>
      </section>

      {/* 2. Pack de base */}
      <section class="section" id="pack-de-base" aria-labelledby="base-titre">
        <div class="container">
          <div class="narrow-left">
            <SectionHead id="base-titre" eyebrow="1 · Le pack de base" title={`Ce que comprend le pack ${p.metier.toLowerCase()}`} intro={p.base.intro} />
          </div>
          <div class="base-grid">
            <div class="base-block">
              <h3>{p.base.site.title}</h3>
              <ul class="checks">
                {p.base.site.items.map((i) => (
                  <li>{i}</li>
                ))}
              </ul>
            </div>
            <div class="base-block">
              <h3>{p.base.graphic.title}</h3>
              <ul class="checks">
                {p.base.graphic.items.map((i) => (
                  <li>{i}</li>
                ))}
              </ul>
            </div>
            <div class="base-block">
              <h3>Impressions incluses</h3>
              <table class="base-prints">
                <tbody>
                  {p.base.prints.map(([what, qty]) => (
                    <tr>
                      <th scope="row">{what}</th>
                      <td>{qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p class="muted small">Quantités indicatives, ajustables sur le devis. Bon à tirer validé avant toute impression.</p>
            </div>
            <div class="base-block">
              <h3>Fiche Google Business Profile</h3>
              <ul class="checks">
                {p.base.google.map((i) => (
                  <li>{i}</li>
                ))}
              </ul>
            </div>
          </div>
          <p class="pc-price mt-lg">
            Pack de base : à partir de <strong>{p.base.priceFrom}</strong> HT. Nom de domaine et hébergement à prévoir à côté.
          </p>
        </div>
      </section>

      {/* 3. Options métier */}
      <section class="section section-sand" id="options" aria-labelledby="options-titre">
        <div class="container">
          <div class="narrow-left">
            <SectionHead id="options-titre" eyebrow="2 · Les options métier" title={`Options métier : ${p.metier.toLowerCase()}`} intro={p.options.intro} />
          </div>
          <div class="option-list">
            {p.options.items.map((o) => (
              <div class="option-row">
                <div>
                  <h3>{o.name}</h3>
                  <p>{o.text}</p>
                </div>
                {o.href && (
                  <a href={o.href} class="link-arrow option-link">
                    En savoir plus
                  </a>
                )}
              </div>
            ))}
          </div>
          <p class="option-note">Toutes les options sont sur devis. Selon la prestation demandée, certaines peuvent être offertes : nous vous l’indiquons sur votre devis.</p>
        </div>
      </section>

      {/* 4. Recommandé : vitrine & signalétique */}
      <section class="section section-ink" aria-labelledby="vitrine-titre">
        <div class="container">
          <div class="narrow-left">
            <SectionHead id="vitrine-titre" eyebrow="3 · Recommandé pour ce métier" title="Vitrine & signalétique" intro={p.signage.intro} />
          </div>
          <div class="feature-grid feature-grid-ink">
            {p.signage.items.map(([t, d]) => (
              <div class="feature-card">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <p class="mt-lg">Sur devis uniquement, à partir de photos de votre local ou de votre véhicule. Pose réalisée par notre poseur partenaire dans notre zone d’intervention.</p>
          <p>
            <a href={signageHref(p)} class="btn btn-light">
              Demander un devis pour ma vitrine
            </a>
          </p>
        </div>
      </section>

      {/* Approfondissements propres au métier */}
      {p.extra.map((e, i) => (
        <section class={`section ${i % 2 ? 'section-sand' : ''}`}>
          <div class="container">
            <div class="narrow-left">
              <SectionHead eyebrow={e.eyebrow} title={e.title} />
              <div class="prose landing-prose">{md(e.body)}</div>
            </div>
          </div>
        </section>
      ))}

      {/* 5. Déroulé */}
      <section class="section section-sand" aria-labelledby="deroule">
        <div class="container">
          <SectionHead id="deroule" eyebrow="Déroulé" title="Comment se passe le pack, étape par étape" align="center" />
          <ol class="pack-steps">
            {p.steps.map(([t, d, delay], i) => (
              <li>
                <span class="pack-step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                  <p class="pack-step-delay">Délai indicatif : {delay}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. Concept du portfolio */}
      {item && (
        <section class="section" aria-labelledby="exemple">
          <div class="container">
            <a href={`/realisations/${item.slug}`} class="pack-example">
              <div class="work-visual">
                <PortfolioVisual visual={item.visual} accent={item.accent || s.accentColor} title={item.title} />
              </div>
              <div>
                <p class="eyebrow" id="exemple">
                  Exemple
                </p>
                <h2 class="h3">
                  {item.title} {item.is_concept ? <ConceptBadge /> : null}
                </h2>
                <p>{p.portfolio.text}</p>
                <span class="link-arrow">Voir le projet</span>
              </div>
            </a>
          </div>
        </section>
      )}

      {/* 7. FAQ */}
      <section class="section section-sand">
        <div class="container narrow">
          <SectionHead eyebrow="Questions fréquentes" title={`Pack ${p.metier.toLowerCase()} : vos questions`} align="center" />
          <FaqList faqs={faqs} />
        </div>
      </section>

      {/* 8. Local */}
      <section class="section" aria-labelledby="local">
        <div class="container narrow-left">
          <SectionHead id="local" eyebrow="Près de chez vous" title={p.local.title} />
          <div class="prose landing-prose">{md(p.local.body)}</div>
          <p>
            <a href="/zone-intervention" class="link-arrow">
              Notre zone d’intervention
            </a>
          </p>
        </div>
      </section>

      {/* Maillage */}
      <section class="section section-tight">
        <div class="container">
          <p class="eyebrow">Les prestations du pack en détail</p>
          <div class="related">
            {p.links.map(([href, label]) => (
              <a href={href} class="related-link">
                <span>{label}</span>
                <span aria-hidden="true">→</span>
              </a>
            ))}
            <a href="/packs" class="related-link">
              <span>Tous les packs Bien démarrer</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* 9. CTA */}
      <CtaBand title="Prêt à lancer votre activité ?" text="Parlez-nous de votre projet : nous vous répondons sous 48 h ouvrées avec une proposition adaptée." href={contactHref(p)} label="Je lance mon activité" />
    </Layout>
  );
}

const HUB_FAQ: [string, string][] = [
  ['À qui s’adressent les packs Bien démarrer ?', 'Aux entrepreneurs qui créent, reprennent ou relancent une activité et veulent une communication complète et cohérente dès le départ : site, identité, imprimés, fiche Google et, si besoin, vitrine.'],
  ['Mon métier n’est pas dans la liste, que faire ?', 'Contactez-nous : la méthode est la même pour une boulangerie, une boutique, un cabinet ou une entreprise de services. Nous composons un pack adapté à votre activité.'],
  ['Peut-on retirer un élément du pack de base ?', 'Oui. Si vous avez déjà un logo ou un site, nous ajustons le pack et son prix à ce qui vous manque réellement.'],
  ['Les impressions sont-elles vraiment incluses ?', 'Oui, pour les supports et quantités indiqués dans chaque pack. Des quantités supplémentaires ou d’autres supports peuvent être ajoutés sur devis.'],
  ['La vitrine et la signalétique sont-elles comprises ?', 'Non : elles sont proposées en complément, sur devis uniquement, car elles dépendent de votre local ou de votre véhicule. La pose est assurée par notre poseur partenaire.'],
];

export function PacksHub({ s, packs: generic }: { s: Settings; packs: ServiceRow[] }) {
  const faqs = toFaq(HUB_FAQ);
  return (
    <Layout
      s={s}
      meta={{
        title: 'Packs Bien démarrer : communication par métier',
        description: 'Packs de communication par métier pour ouvrir ou relancer son activité : restaurant, paysagiste, coiffeur, artisan du bâtiment. Site, logo, imprimés, fiche Google.',
        path: '/packs',
        breadcrumbs: [{ name: 'Packs Bien démarrer', path: '/packs' }],
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Packs Bien démarrer',
            itemListElement: PACKS.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: `Pack Bien démarrer — ${p.metier}`, url: absoluteUrl(s, `/packs/${p.slug}`) })),
          },
          faqJsonLd(faqs),
        ],
      }}
    >
      <PageHero
        eyebrow="Packs Bien démarrer"
        h1="Vous ouvrez ou relancez votre activité ?"
        h1em="Tout votre marketing, prêt pour le jour J."
        intro="Un pack par métier, qui réunit ce dont vous avez vraiment besoin pour démarrer : site internet adapté à votre activité, identité et imprimés, fiche Google, et une vitrine qui se voit. Un seul interlocuteur, un seul planning."
      >
        <PageVisual kind="packs" s={s} />
      </PageHero>

      <section class="section section-tight" aria-labelledby="metiers">
        <div class="container">
          <SectionHead id="metiers" eyebrow="Choisissez votre métier" title="Des packs pensés pour chaque activité" />
          <div class="packm-grid">
            {PACKS.map((p) => (
              <PackCard p={p} />
            ))}
            <a href="/contact?pack=autre-metier#formulaire" class="packm-card packm-other">
              <PackPicto icon="boutique" />
              <h3>Un autre métier ?</h3>
              <p>Boulangerie, boutique, cabinet, entreprise de services : nous composons un pack adapté à votre activité.</p>
              <span class="link-arrow">Nous en parler</span>
            </a>
          </div>
        </div>
      </section>

      <section class="section section-tight" aria-labelledby="caisse-seule">
        <div class="container">
          <a href="/caisse-paiement-carte" class="module-banner">
            <div>
              <p class="eyebrow" id="caisse-seule">
                Module seul
              </p>
              <h2 class="h3">Vous avez juste besoin d’une caisse ?</h2>
              <p>Caisse conforme et paiement par carte : choix, installation, paramétrage et formation, sans prendre de pack.</p>
            </div>
            <span class="btn btn-primary">Découvrir le module caisse</span>
          </a>
        </div>
      </section>

      <section class="section section-sand" aria-labelledby="concept">
        <div class="container">
          <SectionHead id="concept" eyebrow="Le principe" title="Trois niveaux, clairement séparés" align="center" />
          <div class="pack-compare">
            <article class="pc-col">
              <p class="pc-kicker">1 · Pack de base</p>
              <h3>L’essentiel, inclus</h3>
              <p>Un site adapté à votre métier, votre logo ou sa mise au propre, cartes de visite, flyers et supports propres à votre activité, impressions incluses et fiche Google Business Profile.</p>
            </article>
            <article class="pc-col">
              <p class="pc-kicker">2 · Options métier</p>
              <h3>Selon votre organisation</h3>
              <p>Réservation ou rendez-vous en ligne, menu à jour, galerie avant/après, carte de fidélité, panneaux de chantier… Les outils en ligne sont des solutions existantes que nous intégrons pour vous.</p>
            </article>
            <article class="pc-col pc-recommended">
              <p class="pc-badge">Souvent décisif</p>
              <p class="pc-kicker">3 · Vitrine & signalétique</p>
              <h3>Être vu depuis la rue</h3>
              <p>Vitrophanie, enseigne, flocage de véhicule, panneaux : ce dont votre métier a besoin, sur devis, posé par notre partenaire.</p>
            </article>
          </div>
        </div>
      </section>

      {generic.length > 0 && (
        <section class="section" aria-labelledby="packs-transversaux">
          <div class="container">
            <SectionHead id="packs-transversaux" eyebrow="Pour tous les métiers" title="Nos packs transversaux" intro="Vous avez déjà une partie de vos supports ? Ces packs couvrent un besoin précis, quel que soit votre métier." />
            <div class="pack-grid">
              {generic.map((svc) => (
                <article class="pack">
                  <div>
                    <h3>{svc.name}</h3>
                    <p class="muted">{svc.summary}</p>
                  </div>
                  <Price svc={svc} s={s} size="lg" />
                  <a href={`/devis?prestation=${svc.slug}`} class="btn btn-outline">
                    Demander ce pack
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section class="section section-sand">
        <div class="container narrow">
          <SectionHead eyebrow="Questions fréquentes" title="Les packs Bien démarrer : vos questions" align="center" />
          <FaqList faqs={faqs} />
        </div>
      </section>

      <CtaBand title="Vous lancez votre activité ?" text="Dites-nous votre métier et votre date d’ouverture : nous vous proposons le pack adapté." href="/contact#formulaire" label="Je lance mon activité" />
    </Layout>
  );
}
