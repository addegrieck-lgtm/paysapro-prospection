import type { Settings } from '../../domain/settings';
import type { FaqRow, PortfolioRow, ProductRow, ServiceRow } from '../../repo/types';
import { Layout } from '../layout';
import { businessJsonLd, websiteJsonLd } from '../seo';
import { ConceptBadge, ContactForm, FaqList, Process, SectionHead, ServiceCard, faqJsonLd } from '../components';
import { PACKS } from '../packs';
import { PackCard } from './packs';
import { CoastLine, HeroComposition, PortfolioVisual, ProductVisual, SeoMock } from '../illustrations';

const SERVICE_TILES: [string, string, string, string][] = [
  ['/creation-site-internet', 'Création de site', 'Des sites vitrines rapides, clairs et pensés pour le mobile.', '01'],
  ['/refonte-site-internet', 'Refonte', 'Moderniser votre site sans perdre votre visibilité.', '02'],
  ['/identite-visuelle-logo', 'Identité visuelle', 'Logo, couleurs, typographies : une marque cohérente.', '03'],
  ['/flyers-depliants', 'Flyers & dépliants', 'Des supports qui se lisent vite et donnent envie d’agir.', '04'],
  ['/cartes-de-visite', 'Cartes de visite', 'Classiques ou premium, avec la finition qui vous ressemble.', '05'],
  ['/affiches-brochures', 'Affiches & brochures', 'Grands formats, roll-ups, catalogues et livrets.', '06'],
  ['/reseaux-sociaux', 'Réseaux sociaux', 'Des visuels prêts à publier, aux bons formats.', '07'],
  ['/referencement-seo', 'Référencement SEO', 'Être trouvé par les clients de votre zone.', '08'],
  ['/maintenance-site-internet', 'Maintenance', 'Mises à jour, sauvegardes, petites modifications.', '09'],
  ['/vitrophanie-signaletique', 'Vitrophanie & signalétique', 'Vitrines, enseignes, panneaux de chantier et véhicules.', '10'],
];

const RIBBON = ['Sites internet', 'Logos & identité', 'Flyers', 'Cartes de visite', 'Vitrophanie', 'Enseignes & panneaux', 'Réseaux sociaux', 'Référencement local'];

export function HomePage(p: {
  s: Settings;
  offers: ServiceRow[];
  packs: ServiceRow[];
  portfolio: PortfolioRow[];
  products: ProductRow[];
  faqs: FaqRow[];
  formToken: string;
}) {
  const { s } = p;
  return (
    <Layout
      s={s}
      meta={{
        title: s.city ? `Agence web & print à ${s.city}` : 'Agence web et print pour TPE',
        description: `${s.agencyName}${s.city ? `, agence web et print à ${s.city} (Pays de Caux)` : ''} : sites internet, logos, flyers, cartes de visite et vitrines pour artisans et TPE. Devis gratuit.`,
        path: '/',
        jsonLd: [businessJsonLd(s), websiteJsonLd(s), ...(p.faqs.length ? [faqJsonLd(p.faqs)] : [])],
      }}
    >
      <section class="hero">
        <div class="container hero-grid">
          <div class="hero-copy">
            <p class="eyebrow">Agence web & communication{s.city ? ` · ${s.city}, Pays de Caux` : ''}</p>
            <h1>
              Une image à la hauteur de <em>votre savoir-faire.</em>
            </h1>
            <p class="hero-lead">
              Site internet, logo, flyers, cartes de visite, visibilité locale : nous créons une communication claire et cohérente pour les artisans,
              commerçants et TPE, avec des prix affichés et un interlocuteur unique.
              {s.city ? ` Basés à ${s.city}, nous nous déplaçons dans le Pays de Caux et travaillons à distance partout en France.` : ''}
            </p>
            <div class="btn-row">
              <a href="/devis" class="btn btn-primary btn-lg">Obtenir mon devis gratuit</a>
              <a href="/realisations" class="btn btn-outline btn-lg">Découvrir nos réalisations</a>
            </div>
            <ul class="hero-proof">
              <li>Réponse sous 48 h ouvrées</li>
              <li>Prix de départ affichés</li>
              <li>Rien n’est imprimé sans votre accord</li>
            </ul>
          </div>
          <HeroComposition accent={s.accentColor} />
        </div>
        <CoastLine />
      </section>

      <div class="ribbon" aria-label="Nos métiers">
        <div class="ribbon-track">
          {[0, 1].map((dup) => (
            <ul aria-hidden={dup ? 'true' : undefined}>
              {RIBBON.map((w) => (
                <li>{w}</li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <section class="section" aria-labelledby="prestations">
        <div class="container">
          <SectionHead
            id="prestations"
            eyebrow="Prestations"
            title={<>Tout ce qu’il faut pour être <em>vu</em>, compris et contacté.</>}
            intro="Du site internet aux supports imprimés, chaque prestation peut être commandée seule ou combinée dans un pack."
          />
          <div class="tiles">
            {SERVICE_TILES.map(([href, title, text, n]) => (
              <a href={href} class="tile" data-reveal>
                <span class="tile-num">{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span class="tile-arrow" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section class="section section-sand" aria-labelledby="offres">
        <div class="container">
          <SectionHead
            id="offres"
            eyebrow="Offres principales"
            title="Des prix de départ clairs, avant même de nous parler."
            intro="Chaque offre précise ce qui est inclus, le délai et le nombre de révisions. Le devis définitif est toujours validé avec vous avant tout engagement."
          />
          <div class="cards cards-4">
            {p.offers.map((svc) => (
              <ServiceCard svc={svc} s={s} />
            ))}
          </div>
          <p class="center mt-lg">
            <a href="/tarifs" class="link-arrow">Voir tous les tarifs et conditions</a>
          </p>
        </div>
      </section>

      {p.portfolio.length > 0 && (
        <section class="section" aria-labelledby="realisations">
          <div class="container">
            <div class="split-head">
              <SectionHead
                id="realisations"
                eyebrow="Réalisations"
                title="Notre façon de travailler, en images."
                intro="Ces projets sont des concepts de démonstration réalisés pour illustrer notre démarche : les entreprises présentées sont fictives."
              />
              <a href="/realisations" class="btn btn-outline">Toutes les réalisations</a>
            </div>
            <div class="work-grid">
              {p.portfolio.slice(0, 3).map((w) => (
                <a href={`/realisations/${w.slug}`} class="work-card" data-reveal>
                  <div class="work-visual">
                    <PortfolioVisual visual={w.visual} accent={w.accent || s.accentColor} title={w.title} />
                  </div>
                  <div class="work-body">
                    <p class="work-cat">
                      {w.category} {w.is_concept ? <ConceptBadge /> : null}
                    </p>
                    <h3>{w.title}</h3>
                    <p class="muted">{w.summary}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section class="section section-sand" aria-labelledby="methode">
        <div class="container">
          <SectionHead id="methode" eyebrow="Méthode" title="Un processus simple, en quatre étapes." align="center" />
          <Process />
        </div>
      </section>

      <section class="section section-ink" aria-labelledby="impression">
        <div class="container">
          <div class="split">
            <div>
              <p class="eyebrow">Impression professionnelle</p>
              <h2 id="impression">
                Configurez votre impression, <em>sans mauvaise surprise.</em>
              </h2>
              <p class="lead">
                Flyers, cartes de visite, dépliants, affiches, brochures, roll-ups : choisissez le format, le papier, la finition et la quantité. Nous
                fabriquons avec un imprimeur professionnel et nous suivons la commande jusqu’à la livraison.
              </p>
              <ul class="price-split">
                <li>
                  <strong>Création graphique</strong>
                  <span>chiffrée à part, si vous en avez besoin</span>
                </li>
                <li>
                  <strong>Impression</strong>
                  <span>selon la configuration exacte choisie</span>
                </li>
                <li>
                  <strong>Livraison</strong>
                  <span>toujours indiquée séparément</span>
                </li>
              </ul>
              <div class="btn-row">
                <a href="/configurateur" class="btn btn-light btn-lg">Configurer mon impression</a>
                <a href="/impression" class="btn btn-ghost-light btn-lg">Voir le catalogue</a>
              </div>
            </div>
            <div class="product-mini-grid">
              {p.products.slice(0, 4).map((pr) => (
                <a href={`/impression/${pr.slug}`} class="product-mini" data-reveal>
                  <ProductVisual visual={pr.visual} accent={s.accentColor} />
                  <span>{pr.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section class="section" aria-labelledby="seo">
        <div class="container split split-reverse">
          <div class="seo-visual" data-reveal>
            <SeoMock accent={s.accentColor} />
          </div>
          <div>
            <p class="eyebrow">SEO & visibilité locale</p>
            <h2 id="seo">
              Être trouvé par les clients <em>de votre zone.</em>
            </h2>
            <p class="lead">
              Un beau site ne suffit pas s’il est invisible. Nous travaillons les fondations techniques, votre fiche d’établissement et des contenus
              réellement utiles, puis nous mesurons les progrès chaque mois.
            </p>
            <ul class="checks">
              <li>Site rapide, bien structuré et compris par les moteurs de recherche</li>
              <li>Fiche d’établissement complète et coordonnées cohérentes</li>
              <li>Pages locales uniquement lorsqu’elles apportent une vraie valeur</li>
              <li>Aucune promesse de « première place » : des indicateurs suivis honnêtement</li>
            </ul>
            <a href="/referencement-seo" class="btn btn-outline">Découvrir l’accompagnement SEO</a>
          </div>
        </div>
      </section>

      <section class="section section-sand" aria-labelledby="packs">
        <div class="container">
          <SectionHead
            id="packs"
            eyebrow="Packs Bien démarrer"
            title="Vous ouvrez ou relancez votre activité ?"
            intro="Un pack par métier, avec tout le marketing nécessaire pour bien commencer : site, identité, imprimés, fiche Google et une vitrine qui se voit."
          />
          <div class="packm-grid">
            {PACKS.map((pk) => (
              <PackCard p={pk} />
            ))}
          </div>
          <p class="mt-lg">
            <a href="/packs" class="link-arrow">Découvrir les packs Bien démarrer</a>
          </p>
        </div>
      </section>

      {p.faqs.length > 0 && (
        <section class="section" aria-labelledby="faq">
          <div class="container narrow">
            <SectionHead id="faq" eyebrow="Questions fréquentes" title="Vos questions, nos réponses." align="center" />
            <FaqList faqs={p.faqs} />
          </div>
        </section>
      )}

      <section class="section section-sand" aria-labelledby="contact">
        <div class="container split">
          <div>
            <p class="eyebrow">Contact</p>
            <h2 id="contact">Une question avant de vous lancer ?</h2>
            <p class="lead">Écrivez-nous en quelques lignes : nous vous répondons sous 48 h ouvrées, sans engagement.</p>
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
            </ul>
          </div>
          <div class="form-card">
            <ContactForm token={p.formToken} compact />
          </div>
        </div>
      </section>
    </Layout>
  );
}
