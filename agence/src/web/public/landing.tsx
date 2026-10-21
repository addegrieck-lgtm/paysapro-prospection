import { raw } from 'hono/html';
import type { Settings } from '../../domain/settings';
import type { FaqRow, LocalPageRow } from '../../repo/types';
import { Layout, absoluteUrl } from '../layout';
import { areaServed, providerRef } from '../seo';
import type { LandingDef, LandingSection } from '../landing';
import { CtaBand, FaqList, MapEmbed, Notice, SectionHead, SpamGuard, faqJsonLd } from '../components';
import { renderMarkdown } from '../../domain/text';
import { PageHero, PageVisual } from './pages';
import { BUDGETS, DEADLINES } from './quote';

const md = (text: string) => raw(renderMarkdown(text));

/** Communes de la zone principale ; celles qui ont une page locale publiée deviennent des liens. */
export function AreaChips({ s, localPages }: { s: Settings; localPages: LocalPageRow[] }) {
  const byCity = new Map(localPages.map((p) => [p.city.toLowerCase(), p.slug]));
  return (
    <ul class="area-chips">
      {s.serviceAreasPrimary.map((city) => {
        const slug = byCity.get(city.toLowerCase());
        return <li>{slug ? <a href={`/agence-web/${slug}`}>{city}</a> : city}</li>;
      })}
    </ul>
  );
}

function Section({ sec, n }: { sec: LandingSection; n: number }) {
  const tone = sec.tone ?? (n % 2 ? 'sand' : 'plain');
  return (
    <section class={`section ${tone === 'sand' ? 'section-sand' : tone === 'ink' ? 'section-ink' : ''}`} id={sec.id} aria-labelledby={`s-${n}`}>
      <div class="container">
        <div class={sec.cards ? '' : 'narrow-left'}>
          <SectionHead id={`s-${n}`} eyebrow={sec.eyebrow} title={sec.title} />
          {sec.body && <div class="prose landing-prose">{md(sec.body)}</div>}
        </div>
        {sec.cards && (
          <div class="feature-grid">
            {sec.cards.map(([t, d]) => (
              <div class="feature-card" data-reveal>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        )}
        {sec.cta && (
          <p class="mt-lg">
            <a href={sec.cta[0]} class={`btn ${tone === 'ink' ? 'btn-light' : 'btn-primary'}`}>
              {sec.cta[1]}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}

export function LandingPage({ s, def, localPages }: { s: Settings; def: LandingDef; localPages: LocalPageRow[] }) {
  const faqs: FaqRow[] = def.faq.map(([question, answer], i) => ({ id: -i - 1, topic: 'page', question, answer, status: 'published', sort_order: i }));
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
            serviceType: def.serviceType,
            description: def.metaDescription,
            provider: providerRef(s),
            areaServed: areaServed(s),
            url: absoluteUrl(s, def.path),
          },
          ...(faqs.length ? [faqJsonLd(faqs)] : []),
        ],
      }}
    >
      <PageHero eyebrow={def.eyebrow} h1={def.h1} h1em={def.h1em} intro={def.intro}>
        <PageVisual kind={def.visual} s={s} />
      </PageHero>
      <div class="container hero-ctas">
        <a href={def.cta[0]} class="btn btn-primary btn-lg">
          {def.cta[1]}
        </a>
        {def.secondary && (
          <a href={def.secondary[0]} class="btn btn-outline btn-lg">
            {def.secondary[1]}
          </a>
        )}
      </div>

      {def.sections.map((sec, i) => (
        <Section sec={sec} n={i} />
      ))}

      {def.local && (
        <section class="section" aria-labelledby="pres-de-chez-vous">
          <div class="container">
            <div class="narrow-left">
              <SectionHead id="pres-de-chez-vous" eyebrow="Près de chez vous" title={def.local.title} />
              <div class="prose landing-prose">{md(def.local.body)}</div>
            </div>
            <AreaChips s={s} localPages={localPages} />
            {def.map && s.latitude != null && s.longitude != null && <MapEmbed s={s} />}
            {def.path !== '/zone-intervention' && (
              <p>
                <a href="/zone-intervention" class="link-arrow">
                  Voir toute notre zone d’intervention
                </a>
              </p>
            )}
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section class="section section-sand">
          <div class="container narrow">
            <SectionHead eyebrow="Questions fréquentes" title={`${def.name} : vos questions`} align="center" />
            <FaqList faqs={faqs} />
          </div>
        </section>
      )}

      {def.links.length > 0 && (
        <section class="section section-tight">
          <div class="container">
            <p class="eyebrow">À découvrir aussi</p>
            <div class="related">
              {def.links.map(([href, label]) => (
                <a href={href} class="related-link">
                  <span>{label}</span>
                  <span aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
      <CtaBand title={def.ctaBand?.title} text={def.ctaBand?.text} href={def.cta[0]} label={def.cta[1]} />
    </Layout>
  );
}

// ─── Formulaire de devis vitrophanie & signalétique ───

export const SIGNAGE_NEEDS: [string, string][] = [
  ['vitrophanie', 'Vitrophanie / lettrage de vitrine'],
  ['microperfore', 'Adhésif microperforé'],
  ['depoli', 'Vitrophanie dépolie (intimité)'],
  ['horaires', 'Adhésif horaires et informations'],
  ['enseigne', 'Enseigne ou panneau de façade'],
  ['chantier', 'Panneau de chantier'],
  ['panneau', 'Panneau rigide (composite, PVC, alvéolaire)'],
  ['bache', 'Bâche publicitaire'],
  ['vehicule', 'Marquage de véhicule ou magnets'],
  ['kakemono', 'Kakémono / roll-up'],
  ['beachflag', 'Beach flag / chevalet de trottoir'],
  ['autocollants', 'Autocollants « intervention réalisée par »'],
  ['interieur', 'Signalétique intérieure'],
  ['pack-ouverture', 'Pack ouverture de commerce'],
  ['autre', 'Autre'],
];
export const SIGNAGE_DESIGN: [string, string][] = [
  ['fichiers', 'J’ai déjà mes fichiers prêts'],
  ['logo', 'J’ai un logo, le reste est à créer'],
  ['tout', 'Tout est à créer (logo compris)'],
];
export const SIGNAGE_POSE: [string, string][] = [
  ['partenaire', 'Pose par votre poseur partenaire'],
  ['moi', 'Je pose moi-même (livraison)'],
  ['conseil', 'Je ne sais pas, conseillez-moi'],
];

export function SignageQuotePage({ s, token, values = {}, errors = [] }: { s: Settings; token: string; values?: Record<string, string | string[]>; errors?: string[] }) {
  const v = (k: string) => (typeof values[k] === 'string' ? (values[k] as string) : '');
  const needs = Array.isArray(values.needs) ? values.needs : typeof values.needs === 'string' ? [values.needs] : [];
  const radio = (name: string, opts: [string, string][], def = '') => (
    <div class="chips">
      {opts.map(([val, label]) => (
        <label class="chip">
          <input type="radio" name={name} value={val} checked={(v(name) || def) === val} /> <span>{label}</span>
        </label>
      ))}
    </div>
  );
  return (
    <Layout
      s={s}
      meta={{
        title: 'Devis vitrophanie, enseigne et signalétique',
        description: 'Demandez un devis gratuit pour votre vitrophanie, enseigne, panneau de chantier, bâche ou marquage de véhicule : joignez des photos, réponse sous 48 h ouvrées.',
        path: '/devis-vitrophanie-signaletique',
        breadcrumbs: [
          { name: 'Vitrophanie & signalétique', path: '/vitrophanie-signaletique' },
          { name: 'Devis', path: '/devis-vitrophanie-signaletique' },
        ],
      }}
    >
      <PageHero
        eyebrow="Devis vitrophanie & signalétique"
        h1="Votre devis"
        h1em="à partir d’une photo."
        intro="Décrivez votre besoin et joignez des photos de votre vitrine, de votre façade ou de votre véhicule. Nous revenons vers vous sous 48 h ouvrées avec des questions, une proposition de maquette et un devis gratuit."
      />
      <section class="section section-tight">
        <div class="container narrow">
          {errors.length > 0 && (
            <Notice kind="error">
              <strong>Votre demande n’a pas pu être envoyée :</strong> {errors.join(' ')}
            </Notice>
          )}
          <form method="post" action="/devis-vitrophanie-signaletique" enctype="multipart/form-data" class="form form-card">
            <SpamGuard token={token} />
            <fieldset class="chips-field">
              <legend>Votre besoin *</legend>
              <div class="chips">
                {SIGNAGE_NEEDS.map(([val, label]) => (
                  <label class="chip">
                    <input type="checkbox" name="needs" value={val} checked={needs.includes(val)} /> <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div class="grid-2">
              <div class="field">
                <label for="sg-activity">Votre activité *</label>
                <input id="sg-activity" name="activity" required minlength={2} maxlength={200} value={v('activity')} placeholder="Ex. boulangerie, plombier, cabinet infirmier" />
              </div>
              <div class="field">
                <label for="sg-city">Commune du lieu de pose *</label>
                <input id="sg-city" name="city" required maxlength={120} value={v('city')} autocomplete="address-level2" />
              </div>
              <div class="field">
                <label for="sg-dimensions">Dimensions approximatives</label>
                <input id="sg-dimensions" name="dimensions" maxlength={300} value={v('dimensions')} placeholder="Ex. vitrine 2,40 m × 1,80 m + porte 0,90 m × 2 m" />
              </div>
              <div class="field">
                <label for="sg-quantity">Nombre de surfaces ou d’exemplaires</label>
                <input id="sg-quantity" name="quantity" maxlength={60} value={v('quantity')} placeholder="Ex. 2 vitrines, 3 panneaux" />
              </div>
            </div>
            <fieldset class="chips-field">
              <legend>Création graphique</legend>
              {radio('design', SIGNAGE_DESIGN, 'logo')}
            </fieldset>
            <fieldset class="chips-field">
              <legend>Pose</legend>
              {radio('pose', SIGNAGE_POSE, 'conseil')}
            </fieldset>
            <div class="grid-2">
              <div class="field">
                <label for="sg-deadline">Délai souhaité</label>
                <select id="sg-deadline" name="deadline">
                  <option value="">—</option>
                  {DEADLINES.map((d) => (
                    <option selected={v('deadline') === d}>{d}</option>
                  ))}
                </select>
              </div>
              <div class="field">
                <label for="sg-budget">Budget indicatif</label>
                <select id="sg-budget" name="budget">
                  <option value="">—</option>
                  {BUDGETS.map((d) => (
                    <option selected={v('budget') === d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div class="field">
              <label for="sg-files">Photos de la vitrine, de la façade ou du véhicule</label>
              <input id="sg-files" name="files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" />
              <p class="muted small">5 fichiers maximum, 10 Mo par fichier (JPG, PNG, WebP ou PDF). Une photo de face, prise de loin, nous aide beaucoup.</p>
            </div>
            <div class="field">
              <label for="sg-description">Votre projet en quelques mots *</label>
              <textarea id="sg-description" name="description" required minlength={10} maxlength={5000} rows={5}>
                {v('description')}
              </textarea>
            </div>
            <fieldset class="chips-field">
              <legend>Vos coordonnées</legend>
              <div class="grid-2">
                <div class="field">
                  <label for="sg-name">Nom et prénom *</label>
                  <input id="sg-name" name="name" required maxlength={120} autocomplete="name" value={v('name')} />
                </div>
                <div class="field">
                  <label for="sg-company">Entreprise</label>
                  <input id="sg-company" name="company" maxlength={160} autocomplete="organization" value={v('company')} />
                </div>
                <div class="field">
                  <label for="sg-email">E-mail *</label>
                  <input id="sg-email" name="email" type="email" required maxlength={200} autocomplete="email" inputmode="email" value={v('email')} />
                </div>
                <div class="field">
                  <label for="sg-phone">Téléphone</label>
                  <input id="sg-phone" name="phone" type="tel" maxlength={40} autocomplete="tel" inputmode="tel" value={v('phone')} />
                </div>
                <div class="field">
                  <label for="sg-postal">Code postal</label>
                  <input id="sg-postal" name="postal_code" maxlength={10} autocomplete="postal-code" value={v('postal_code')} />
                </div>
              </div>
            </fieldset>
            <div class="field-check">
              <input type="checkbox" id="sg-privacy" name="privacy" value="1" required />
              <label for="sg-privacy">
                J’accepte que mes données et mes photos soient utilisées pour étudier ma demande, conformément à la <a href="/confidentialite">politique de confidentialité</a>. *
              </label>
            </div>
            <div class="field-check">
              <input type="checkbox" id="sg-marketing" name="marketing" value="1" checked={v('marketing') === '1'} />
              <label for="sg-marketing">J’accepte de recevoir occasionnellement des conseils et offres (désinscription en un clic).</label>
            </div>
            <p class="form-foot">
              <button type="submit" class="btn btn-primary btn-lg">Envoyer ma demande</button>
              <span class="muted small">* champs obligatoires. Devis gratuit et sans engagement.</span>
            </p>
          </form>
        </div>
      </section>
    </Layout>
  );
}
