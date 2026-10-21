import { PACKS } from './packs';
import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';
import type { Settings } from '../domain/settings';
import { localityLabel, telHref } from './seo';

export interface Crumb {
  name: string;
  path: string;
}

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  jsonLd?: object[];
  breadcrumbs?: Crumb[];
  scripts?: string[];
  bodyClass?: string;
  ogType?: string;
  /** Image de partage propre à la page (chemin), sinon l'image par défaut. */
  ogImage?: string;
}

const OG_IMAGE = '/assets/img/og-default.png';

/** JSON pour <script type="application/ld+json"> : « < » échappé pour empêcher toute sortie de balise. */
export function jsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** URL absolue. L'adresse du site vient des paramètres, sinon de l'origine de la requête (voir app.tsx). */
export function absoluteUrl(s: Settings, path: string): string {
  const base = s.siteUrl.replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

/** Symbole de la marque : les falaises du Pays de Caux (arche et aiguille) au-dessus de la Seine. */
export function CliffMark({ width = 48 }: { width?: number }) {
  return (
    <svg class="logo-mark" width={width} height={Math.round((width * 44) / 64)} viewBox="0 0 64 44" aria-hidden="true">
      <path fill="currentColor" d="M2 34V9Q16 7 28 11Q38 14 42 19Q44 23 43 34H37Q37 25 32 25Q27 25 27 34Z" />
      <path fill="currentColor" d="M49 34L51.5 15L54.5 34Z" />
      <path d="M2 40c5-3 10-3 15 0s10 3 15 0 10-3 15 0 10 3 15 0" stroke="var(--accent)" stroke-width="2.6" fill="none" stroke-linecap="round" />
    </svg>
  );
}

export function Logo({ s, size = 34 }: { s: Settings; size?: number }) {
  return (
    <span class="logo">
      <CliffMark width={Math.round(size * 1.45)} />
      <span class="logo-name">
        {s.agencyName.split(/(\s*&\s*)/).map((part) => (part.trim() === '&' ? <span class="amp">&amp;</span> : part))}
      </span>
    </span>
  );
}

const NAV_SERVICES: { group: string; items: [string, string, string][] }[] = [
  {
    group: 'Sites internet',
    items: [
      ['/creation-site-internet', 'Création de site', 'Vitrine, sur mesure, rapide'],
      ['/refonte-site-internet', 'Refonte de site', 'Moderniser sans perdre son trafic'],
      ['/referencement-seo', 'Référencement SEO', 'Visibilité locale et technique'],
      ['/maintenance-site-internet', 'Maintenance', 'Mises à jour et sauvegardes'],
    ],
  },
  {
    group: 'Création graphique',
    items: [
      ['/identite-visuelle-logo', 'Identité visuelle & logo', 'Être reconnu au premier regard'],
      ['/flyers-depliants', 'Flyers & dépliants', 'Conception et impression'],
      ['/cartes-de-visite', 'Cartes de visite', 'Classiques ou premium'],
      ['/affiches-brochures', 'Affiches & brochures', 'Grands formats et multipages'],
      ['/reseaux-sociaux', 'Réseaux sociaux', 'Visuels prêts à publier'],
      ['/vitrophanie-signaletique', 'Vitrophanie & signalétique', 'Vitrines, enseignes, panneaux'],
    ],
  },
];

function Header({ s, path }: { s: Settings; path: string }) {
  const current = (p: string) => (path === p || (p !== '/' && path.startsWith(p + '/')) ? 'page' : undefined);
  return (
    <header class="site-header">
      <div class="container header-inner">
        <a href="/" class="brand" aria-label={`${s.agencyName} — accueil`}>
          <Logo s={s} />
        </a>
        <nav class="main-nav" aria-label="Navigation principale">
          <details class="nav-menu">
            <summary>Prestations</summary>
            <div class="mega">
              {NAV_SERVICES.map((g) => (
                <div class="mega-col">
                  <p class="mega-title">{g.group}</p>
                  <ul>
                    {g.items.map(([href, label, hint]) => (
                      <li>
                        <a href={href} aria-current={current(href)}>
                          <span>{label}</span>
                          <small>{hint}</small>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div class="mega-col mega-feature">
                <p class="mega-title">Pour aller vite</p>
                <a href="/packs" class="mega-card">
                  <span>Packs Bien démarrer</span>
                  <small>Tout le marketing pour ouvrir votre activité, par métier.</small>
                </a>
                {PACKS.map((p) => (
                  <a href={`/packs/${p.slug}`} class="mega-link">
                    {p.metier} →
                  </a>
                ))}
                <a href="/caisse-paiement-carte" class="mega-link">
                  Module caisse seul →
                </a>
                <a href="/tarifs" class="mega-link">Voir tous les tarifs →</a>
              </div>
            </div>
          </details>
          <a href="/packs" aria-current={current('/packs')}>Packs</a>
          <a href="/impression" aria-current={current('/impression')}>Impression</a>
          <a href="/realisations" aria-current={current('/realisations')}>Réalisations</a>
          <a href="/tarifs" aria-current={current('/tarifs')}>Tarifs</a>
          <a href="/a-propos" aria-current={current('/a-propos')}>L’agence</a>
          <a href="/blog" aria-current={current('/blog')}>Blog</a>
        </nav>
        <div class="header-actions">
          {s.contactPhone && (
            <a href={telHref(s.contactPhone)} class="header-call" aria-label={`Appeler le ${s.contactPhone}`}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor" />
              </svg>
              <span>{s.contactPhone}</span>
            </a>
          )}
          <a href="/contact" class="link-quiet hide-sm">Contact</a>
          <a href="/devis" class="btn btn-primary btn-sm">Devis gratuit</a>
          <details class="mobile-nav">
            <summary aria-label="Ouvrir le menu">
              <span class="burger" aria-hidden="true"><i></i><i></i></span>
            </summary>
            <div class="mobile-panel">
              {NAV_SERVICES.map((g) => (
                <div>
                  <p class="mega-title">{g.group}</p>
                  {g.items.map(([href, label]) => (
                    <a href={href}>{label}</a>
                  ))}
                </div>
              ))}
              <div>
                <p class="mega-title">Packs Bien démarrer</p>
                <a href="/packs">Tous les packs</a>
                {PACKS.map((p) => (
                  <a href={`/packs/${p.slug}`}>{p.metier}</a>
                ))}
                <a href="/caisse-paiement-carte">Module caisse seul</a>
              </div>
              <div>
                <p class="mega-title">Agence</p>
                <a href="/impression">Impression</a>
                <a href="/configurateur">Configurateur d’impression</a>
                <a href="/realisations">Réalisations</a>
                <a href="/tarifs">Tarifs</a>
                <a href="/a-propos">L’agence</a>
                <a href="/blog">Blog</a>
                <a href="/contact">Contact</a>
              </div>
              <a href="/devis" class="btn btn-primary btn-block">Obtenir mon devis gratuit</a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function Footer({ s }: { s: Settings }) {
  const year = new Date().getFullYear();
  return (
    <footer class="site-footer">
      <div class="container">
        <div class="footer-cta">
          <p class="footer-cta-title">Un projet, une question ?</p>
          <p>Réponse sous 48 h ouvrées, devis gratuit et sans engagement.</p>
          <div class="btn-row">
            <a href="/devis" class="btn btn-light">Obtenir mon devis gratuit</a>
            <a href="/contact" class="btn btn-ghost-light">Nous écrire</a>
          </div>
        </div>
        <div class="footer-grid">
          <div class="footer-brand">
            <Logo s={s} />
            <p>{s.tagline}</p>
            <ul class="footer-contact">
              {s.contactEmail && (
                <li>
                  <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>
                </li>
              )}
              {s.contactPhone && (
                <li>
                  <a href={telHref(s.contactPhone)}>{s.contactPhone}</a>
                </li>
              )}
              {s.city && (
                <li>
                  {s.streetAddress ? `${s.streetAddress}, ` : ''}
                  {localityLabel(s)}
                  {s.department ? `, ${s.department}` : ''}
                </li>
              )}
              <li>{s.serviceArea}</li>
              {s.openingHours && <li>{s.openingHours}</li>}
              {s.googleBusinessUrl && (
                <li>
                  <a href={s.googleBusinessUrl} rel="noopener" target="_blank">
                    Notre fiche Google et vos avis
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <p class="footer-title">Sites internet</p>
            <a href="/creation-site-internet">Création de site</a>
            <a href="/refonte-site-internet">Refonte</a>
            <a href="/referencement-seo">Référencement SEO</a>
            <a href="/maintenance-site-internet">Maintenance</a>

            <a href="/creation-site-internet-artisan">Site internet pour artisans</a>
            <a href="/creation-site-internet-paysagiste">Site internet pour paysagistes</a>
            <a href="/referencement-local-artisan">Référencement local des artisans</a>
          </div>
          <div>
            <p class="footer-title">Graphisme & impression</p>
            <a href="/identite-visuelle-logo">Identité visuelle</a>
            <a href="/flyers-depliants">Flyers & dépliants</a>
            <a href="/cartes-de-visite">Cartes de visite</a>
            <a href="/affiches-brochures">Affiches & brochures</a>
            <a href="/reseaux-sociaux">Réseaux sociaux</a>
            <a href="/vitrophanie-signaletique">Vitrophanie & signalétique</a>
            <a href="/vitrophanie-vitrine-commerce">Vitrines de commerce</a>
            <a href="/impression">Catalogue d’impression</a>
            <a href="/configurateur">Configurateur</a>
          </div>
          <div>
            <p class="footer-title">Packs Bien démarrer</p>
            <a href="/packs">Tous les packs</a>
            {PACKS.map((p) => (
              <a href={`/packs/${p.slug}`}>{p.card.title}</a>
            ))}
            <a href="/caisse-paiement-carte">Caisse et paiement par carte</a>
          </div>
          <div>
            <p class="footer-title">L’agence</p>
            <a href="/a-propos">À propos</a>
            <a href="/zone-intervention">Zone d’intervention</a>
            <a href="/realisations">Réalisations</a>
            <a href="/etudes-de-cas">Études de cas</a>
            <a href="/tarifs">Tarifs</a>
            <a href="/blog">Blog</a>
            <a href="/contact">Contact</a>
            <a href="/espace-client">Espace client</a>
          </div>
        </div>
        <div class="footer-legal">
          <p>
            © {year} {s.legal.companyName || s.agencyName}. Prix indiqués hors taxes sauf mention contraire.
            {s.vatMode === 'franchise' ? ' TVA non applicable, art. 293 B du CGI.' : ''}
          </p>
          <nav aria-label="Informations légales">
            <a href="/mentions-legales">Mentions légales</a>
            <a href="/confidentialite">Confidentialité</a>
            <a href="/cookies">Cookies</a>
            <a href="/cgv">CGV</a>
            <a href="/plan-du-site">Plan du site</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav class="breadcrumbs container" aria-label="Fil d’Ariane">
      <ol>
        <li>
          <a href="/">Accueil</a>
        </li>
        {items.map((b, i) => (
          <li>{i === items.length - 1 ? <span aria-current="page">{b.name}</span> : <a href={b.path}>{b.name}</a>}</li>
        ))}
      </ol>
    </nav>
  );
}

/** Bandeau de consentement : n'apparaît QUE si un outil de mesure soumis à consentement est configuré. */
function ConsentBanner({ s }: { s: Settings }) {
  if (s.analyticsProvider !== 'ga4') return null;
  return (
    <div class="consent" id="consent" hidden data-provider="ga4" data-id={s.ga4Id} role="dialog" aria-labelledby="consent-title" aria-live="polite">
      <p id="consent-title" class="consent-title">Mesure d’audience</p>
      <p>
        Avec votre accord, nous utilisons Google Analytics pour mesurer la fréquentation du site. Aucun traceur n’est déposé si vous refusez.{' '}
        <a href="/cookies">En savoir plus</a>
      </p>
      <div class="btn-row">
        <button type="button" class="btn btn-outline btn-sm" data-consent="refuse">Refuser</button>
        <button type="button" class="btn btn-outline btn-sm" data-consent="accept">Accepter</button>
      </div>
    </div>
  );
}

export function Layout(props: { s: Settings; meta: PageMeta; children: Child }) {
  const { s, meta } = props;
  const fullTitle = meta.path === '/' ? `${s.agencyName} — ${meta.title}` : `${meta.title} | ${s.agencyName}`;
  const canonical = absoluteUrl(s, meta.path);
  const jsonLd: object[] = [...(meta.jsonLd ?? [])];
  if (meta.breadcrumbs?.length) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ name: 'Accueil', path: '/' }, ...meta.breadcrumbs].map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: absoluteUrl(s, b.path),
      })),
    });
  }
  return (
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{fullTitle}</title>
        <meta name="description" content={meta.description} />
        {meta.noindex ? <meta name="robots" content="noindex, nofollow" /> : <link rel="canonical" href={canonical} />}
        <meta property="og:type" content={meta.ogType ?? 'website'} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:site_name" content={s.agencyName} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={absoluteUrl(s, meta.ogImage ?? OG_IMAGE)} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`${s.agencyName} — ${s.tagline}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#F6F3EE" />
        {s.searchConsoleToken && <meta name="google-site-verification" content={s.searchConsoleToken} />}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preload" href="/assets/fonts/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
        <link rel="preload" href="/assets/fonts/josefin-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
        <link rel="apple-touch-icon" href="/assets/img/logo-512.png" />
        <link rel="stylesheet" href="/assets/css/site.css" />
        <style>{raw(`:root{--accent:${s.accentColor}}`)}</style>
        {jsonLd.map((d) => (
          <script type="application/ld+json">{raw(jsonForScript(d))}</script>
        ))}
        {s.analyticsProvider === 'plausible' && s.plausibleDomain && (
          <script defer data-domain={s.plausibleDomain} src="https://plausible.io/js/script.js"></script>
        )}
        <script type="module" src="/assets/js/site.js"></script>
        {(meta.scripts ?? []).map((src) => (
          <script type="module" src={`/assets/js/${src}.js`}></script>
        ))}
      </head>
      <body class={meta.bodyClass}>
        <a href="#contenu" class="skip-link">Aller au contenu</a>
        <Header s={s} path={meta.path} />
        {meta.breadcrumbs?.length ? <Breadcrumbs items={meta.breadcrumbs} /> : null}
        <main id="contenu">{props.children}</main>
        <Footer s={s} />
        <ConsentBanner s={s} />
      </body>
    </html>
  );
}
