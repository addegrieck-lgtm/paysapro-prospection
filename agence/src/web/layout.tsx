import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';
import type { Settings } from '../domain/settings';
import { initials } from '../domain/settings';

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
}

/** JSON pour <script type="application/ld+json"> : « < » échappé pour empêcher toute sortie de balise. */
export function jsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function absoluteUrl(s: Settings, path: string): string {
  const base = s.siteUrl.replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export function Logo({ s, size = 34 }: { s: Settings; size?: number }) {
  return (
    <span class="logo">
      <svg class="logo-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <rect x="1" y="1" width="38" height="38" rx="11" fill="var(--ink)" />
        <path d="M11 31.5c6-2.2 12-2.2 18 0" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" />
        <text x="20" y="24" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="14" font-weight="500" fill="#fff">
          {initials(s.agencyName)}
        </text>
      </svg>
      <span class="logo-name">{s.agencyName}</span>
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
                  <span>Packs professionnels</span>
                  <small>Plusieurs prestations, un seul interlocuteur.</small>
                </a>
                <a href="/tarifs" class="mega-link">Voir tous les tarifs →</a>
              </div>
            </div>
          </details>
          <a href="/impression" aria-current={current('/impression')}>Impression</a>
          <a href="/realisations" aria-current={current('/realisations')}>Réalisations</a>
          <a href="/tarifs" aria-current={current('/tarifs')}>Tarifs</a>
          <a href="/a-propos" aria-current={current('/a-propos')}>L’agence</a>
          <a href="/blog" aria-current={current('/blog')}>Blog</a>
        </nav>
        <div class="header-actions">
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
                <p class="mega-title">Agence</p>
                <a href="/packs">Packs</a>
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
                  <a href={`tel:${s.contactPhone.replace(/\s/g, '')}`}>{s.contactPhone}</a>
                </li>
              )}
              <li>{s.serviceArea}</li>
              {s.openingHours && <li>{s.openingHours}</li>}
            </ul>
          </div>
          <div>
            <p class="footer-title">Sites internet</p>
            <a href="/creation-site-internet">Création de site</a>
            <a href="/refonte-site-internet">Refonte</a>
            <a href="/referencement-seo">Référencement SEO</a>
            <a href="/maintenance-site-internet">Maintenance</a>
            <a href="/packs">Packs professionnels</a>
          </div>
          <div>
            <p class="footer-title">Graphisme & impression</p>
            <a href="/identite-visuelle-logo">Identité visuelle</a>
            <a href="/flyers-depliants">Flyers & dépliants</a>
            <a href="/cartes-de-visite">Cartes de visite</a>
            <a href="/affiches-brochures">Affiches & brochures</a>
            <a href="/reseaux-sociaux">Réseaux sociaux</a>
            <a href="/impression">Catalogue d’impression</a>
            <a href="/configurateur">Configurateur</a>
          </div>
          <div>
            <p class="footer-title">L’agence</p>
            <a href="/a-propos">À propos</a>
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
        {s.siteUrl && <meta property="og:url" content={canonical} />}
        <meta name="theme-color" content="#F6F3EE" />
        {s.searchConsoleToken && <meta name="google-site-verification" content={s.searchConsoleToken} />}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preload" href="/assets/fonts/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
        <link rel="preload" href="/assets/fonts/fraunces-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
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
