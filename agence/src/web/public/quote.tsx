import { raw } from 'hono/html';
import type { Settings } from '../../domain/settings';
import type { ProductRow, ServiceRow } from '../../repo/types';
import { Layout, jsonForScript } from '../layout';
import { Notice, SpamGuard } from '../components';
import { ConfiguratorFields } from './print';
import { parseOptions, type PrintConfig } from '../../domain/print';
import { formatEuros } from '../../domain/money';
import { CATEGORY_LABELS } from '../content';
import { safeOptions } from './pages';
import { UPLOAD_LIMITS } from '../../lib/storage';

export const PROJECT_TYPES: [string, string, string][] = [
  ['site', 'Création de site internet', 'Un nouveau site vitrine ou professionnel'],
  ['refonte', 'Refonte de site', 'Moderniser un site existant'],
  ['impression', 'Impression', 'Flyers, cartes, affiches, brochures…'],
  ['graphisme', 'Création graphique', 'Logo, flyer, carte de visite, visuels'],
  ['seo', 'Référencement & visibilité', 'SEO local, fiche d’établissement'],
  ['maintenance', 'Maintenance', 'Mises à jour, sauvegardes, modifications'],
  ['signaletique', 'Vitrophanie & signalétique', 'Vitrine, enseigne, panneau, véhicule'],
  ['autre', 'Autre / plusieurs besoins', 'Pack ou besoin à préciser'],
];

export const SITE_PAGES = ['Accueil', 'Services / prestations', 'Réalisations', 'À propos', 'Contact', 'Tarifs', 'Blog / actualités', 'Prise de rendez-vous', 'Boutique en ligne'];
export const GOALS = ['Obtenir des demandes de devis', 'Recevoir des appels', 'Présenter mon activité', 'Vendre en ligne', 'Recruter', 'Autre'];
export const BUDGETS = ['Moins de 500 € HT', '500 à 1 000 € HT', '1 000 à 2 000 € HT', '2 000 à 5 000 € HT', 'Plus de 5 000 € HT', 'Je ne sais pas encore'];
export const DEADLINES = ['Dès que possible', 'Sous 1 mois', 'Sous 2 à 3 mois', 'Pas de date précise'];
export const AVAILABILITY = [['oui', 'Oui'], ['partiel', 'En partie'], ['non', 'Non']] as const;

export interface QuoteFormState {
  type?: string;
  service?: string;
  product?: string;
  config?: Partial<PrintConfig>;
  wantDesign?: boolean;
  values?: Record<string, string | string[]>;
  errors?: string[];
}

function Radios({ name, options, value, required }: { name: string; options: readonly (readonly [string, string])[]; value?: string; required?: boolean }) {
  return (
    <div class="chips">
      {options.map(([v, l]) => (
        <label class="chip">
          <input type="radio" name={name} value={v} checked={value === v} required={required} />
          <span>{l}</span>
        </label>
      ))}
    </div>
  );
}

function Select({ id, name, options, value, placeholder = 'Choisir…' }: { id: string; name: string; options: string[]; value?: string; placeholder?: string }) {
  return (
    <select id={id} name={name}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option value={o} selected={value === o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function QuoteWizard(p: { s: Settings; services: ServiceRow[]; products: ProductRow[]; token: string; state: QuoteFormState }) {
  const { s, state } = p;
  const v = (k: string) => {
    const x = state.values?.[k];
    return Array.isArray(x) ? x[0] ?? '' : x ?? '';
  };
  const many = (k: string) => {
    const x = state.values?.[k];
    return Array.isArray(x) ? x : x ? [x] : [];
  };
  const type = state.type ?? '';
  const groups = ['web', 'pack', 'graphisme', 'recurrent', 'accompagnement'];
  const selectedService = p.services.find((x) => x.slug === state.service);
  const productsData = p.products.map((pr) => ({ slug: pr.slug, name: pr.name, options: parseOptions(pr.options), design: pr.design_service_slug }));
  return (
    <Layout
      s={s}
      meta={{
        title: 'Demande de devis gratuit',
        description: 'Décrivez votre projet en quelques étapes : site internet, impression, création graphique ou référencement. Devis gratuit sous 48 h ouvrées.',
        path: '/devis',
        breadcrumbs: [{ name: 'Demande de devis', path: '/devis' }],
        scripts: ['quote'],
      }}
    >
      <section class="page-hero page-hero-sm">
        <div class="container narrow">
          <p class="eyebrow">Devis gratuit · sans engagement</p>
          <h1>
            Décrivez votre projet, <em>on s’occupe du reste.</em>
          </h1>
          <p class="hero-lead">Six étapes courtes. Comptez 3 minutes. Réponse sous 48 h ouvrées.</p>
        </div>
      </section>
      <section class="section section-tight">
        <div class="container narrow">
          {state.errors?.length ? (
            <Notice kind="error">
              <strong>Votre demande n’a pas pu être envoyée :</strong>
              <ul>
                {state.errors.map((e) => (
                  <li>{e}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
          <form method="post" action="/devis" enctype="multipart/form-data" class="wizard form" data-wizard novalidate>
            <SpamGuard token={p.token} />
            <ol class="wizard-progress" aria-hidden="true">
              {['Prestation', 'Besoin', 'Options', 'Fichiers', 'Coordonnées', 'Récapitulatif'].map((l, i) => (
                <li data-step-dot={i + 1}>
                  <span>{i + 1}</span>
                  <small>{l}</small>
                </li>
              ))}
            </ol>

            <fieldset class="step" data-step="1">
              <legend>
                <span class="step-num">Étape 1 sur 6</span> Quelle prestation vous intéresse ?
              </legend>
              <div class="type-grid">
                {PROJECT_TYPES.map(([val, label, hint]) => (
                  <label class="type-card">
                    <input type="radio" name="type" value={val} checked={type === val} required />
                    <span class="type-label">{label}</span>
                    <small>{hint}</small>
                  </label>
                ))}
              </div>
              <div class="field">
                <label for="q-service">Offre précise (facultatif)</label>
                <select id="q-service" name="service">
                  <option value="">Je ne sais pas encore / plusieurs</option>
                  {groups.map((g) => {
                    const list = p.services.filter((x) => x.category === g);
                    return list.length ? (
                      <optgroup label={CATEGORY_LABELS[g] ?? g}>
                        {list.map((x) => (
                          <option value={x.slug} selected={state.service === x.slug}>
                            {x.name}
                            {x.price_ht != null && x.price_mode !== 'quote' ? ` — ${x.price_mode === 'from' ? 'dès ' : ''}${formatEuros(x.price_ht, true)} HT${x.billing === 'monthly' ? '/mois' : ''}` : ' — sur devis'}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>
              </div>
            </fieldset>

            <fieldset class="step" data-step="2">
              <legend>
                <span class="step-num">Étape 2 sur 6</span> Parlez-nous de votre besoin
              </legend>
              <div class="field">
                <label for="q-activity">Votre activité *</label>
                <input id="q-activity" name="activity" required maxlength={200} value={v('activity')} placeholder="Ex. : plombier chauffagiste à Nantes, salon de coiffure, cabinet d’architecte…" />
              </div>
              <div class="field">
                <label for="q-description">Décrivez votre projet *</label>
                <textarea id="q-description" name="description" required minlength={10} maxlength={5000} rows={5} placeholder="Ce que vous souhaitez, pour quand, et tout ce qui vous semble utile.">
                  {v('description')}
                </textarea>
              </div>
              <div class="conditional" data-show-for="site refonte">
                <p class="conditional-title">Pour votre site internet</p>
                <fieldset class="chips-field">
                  <legend>Pages souhaitées</legend>
                  <div class="chips">
                    {SITE_PAGES.map((pg) => (
                      <label class="chip">
                        <input type="checkbox" name="pages" value={pg} checked={many('pages').includes(pg)} />
                        <span>{pg}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div class="grid-2">
                  <div class="field">
                    <label>Avez-vous déjà un site ?</label>
                    <Radios name="has_site" options={[['oui', 'Oui'], ['non', 'Non']]} value={v('has_site')} />
                  </div>
                  <div class="field">
                    <label for="q-site-url">Adresse du site actuel</label>
                    <input id="q-site-url" name="site_url" type="url" inputmode="url" maxlength={300} value={v('site_url')} placeholder="https://" />
                  </div>
                  <div class="field">
                    <label for="q-goal">Objectif principal</label>
                    <Select id="q-goal" name="goal" options={GOALS} value={v('goal')} />
                  </div>
                  <div class="field">
                    <label>Nom de domaine existant ?</label>
                    <Radios name="has_domain" options={[['oui', 'Oui'], ['non', 'Non'], ['ne_sait_pas', 'Je ne sais pas']]} value={v('has_domain')} />
                  </div>
                  <div class="field">
                    <label>Textes disponibles ?</label>
                    <Radios name="texts" options={AVAILABILITY} value={v('texts')} />
                  </div>
                  <div class="field">
                    <label>Photos disponibles ?</label>
                    <Radios name="photos" options={AVAILABILITY} value={v('photos')} />
                  </div>
                </div>
              </div>
              <div class="grid-2">
                <div class="field">
                  <label for="q-budget">Budget indicatif</label>
                  <Select id="q-budget" name="budget" options={BUDGETS} value={v('budget')} />
                </div>
                <div class="field">
                  <label for="q-deadline">Délai souhaité</label>
                  <Select id="q-deadline" name="deadline" options={DEADLINES} value={v('deadline')} />
                </div>
              </div>
            </fieldset>

            <fieldset class="step" data-step="3">
              <legend>
                <span class="step-num">Étape 3 sur 6</span> Options
              </legend>
              <div class="conditional" data-show-for="impression">
                <p class="conditional-title">Votre impression</p>
                <div class="field">
                  <label for="q-product">Produit</label>
                  <select id="q-product" name="product" data-product-select>
                    <option value="">Choisir un produit…</option>
                    {p.products.map((pr) => (
                      <option value={pr.slug} selected={state.product === pr.slug}>
                        {pr.name}
                      </option>
                    ))}
                  </select>
                </div>
                {p.products.map((pr) => {
                  const o = parseOptions(pr.options);
                  const active = state.product === pr.slug;
                  return (
                    <div class="product-options" data-product-options={pr.slug} hidden={!active}>
                      {o.quantity.length ? (
                        <fieldset disabled={!active} class="plain-fieldset">
                          <ConfiguratorFields options={o} config={active ? state.config ?? {} : {}} prefix="print_" />
                        </fieldset>
                      ) : (
                        <p class="muted">Produit sur mesure : précisez dimensions, matériau et quantité dans la description (étape 2).</p>
                      )}
                    </div>
                  );
                })}
                <div class="field-check">
                  <input type="checkbox" id="q-creation" name="want_design" value="1" checked={!!state.wantDesign} />
                  <label for="q-creation">J’ai besoin de la création graphique (sinon, je fournis un fichier prêt à imprimer)</label>
                </div>
                <div class="estimate-box" data-wizard-estimate hidden>
                  <p class="small strong">Estimation indicative</p>
                  <div data-estimate></div>
                </div>
                <noscript>
                  <p class="small muted">Activez JavaScript pour afficher les options de chaque produit, ou utilisez le <a href="/configurateur">configurateur</a>.</p>
                </noscript>
              </div>
              <div class="conditional" data-show-for="site refonte graphisme seo maintenance autre">
                <p class="conditional-title">Options payantes (facultatif)</p>
                {p.services.filter((x) => safeOptions(x.options).length).length === 0 ? (
                  <p class="muted">Aucune option à sélectionner.</p>
                ) : (
                  p.services
                    .filter((x) => safeOptions(x.options).length)
                    .map((x) => (
                      <fieldset class="chips-field" data-service-options={x.slug} hidden={selectedService ? selectedService.slug !== x.slug : false}>
                        <legend>{x.name}</legend>
                        <div class="chips">
                          {safeOptions(x.options).map((o) => (
                            <label class="chip">
                              <input type="checkbox" name="service_options" value={`${x.slug}::${o.name}`} checked={many('service_options').includes(`${x.slug}::${o.name}`)} />
                              <span>
                                {o.name} (+{formatEuros(o.price_ht)} HT)
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))
                )}
              </div>
              <div class="field">
                <label for="q-options-notes">Précisions sur les options</label>
                <textarea id="q-options-notes" name="options_notes" rows={3} maxlength={2000}>
                  {v('options_notes')}
                </textarea>
              </div>
            </fieldset>

            <fieldset class="step" data-step="4">
              <legend>
                <span class="step-num">Étape 4 sur 6</span> Fichiers utiles (facultatif)
              </legend>
              <p class="muted">
                Logo, photos, fichier à imprimer, cahier des charges… Formats acceptés : PDF, PNG, JPG, WebP. {UPLOAD_LIMITS.maxFiles} fichiers maximum,{' '}
                {UPLOAD_LIMITS.maxFileBytes / 1024 / 1024} Mo par fichier.
              </p>
              <div class="field">
                <label for="q-files" class="dropzone">
                  <span>Choisir des fichiers</span>
                  <small>ou glissez-les ici</small>
                </label>
                <input id="q-files" name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" data-files />
                <ul class="file-list" data-file-list></ul>
              </div>
              <p class="small muted">Vous pourrez aussi nous transmettre vos fichiers plus tard. Les fichiers volumineux peuvent être envoyés par un service de transfert.</p>
            </fieldset>

            <fieldset class="step" data-step="5">
              <legend>
                <span class="step-num">Étape 5 sur 6</span> Vos coordonnées
              </legend>
              <div class="field">
                <label>Vous êtes *</label>
                <Radios name="customer_type" options={[['pro', 'Un professionnel'], ['particulier', 'Un particulier']]} value={v('customer_type') || 'pro'} required />
              </div>
              <div class="grid-2">
                <div class="field">
                  <label for="q-name">Nom et prénom *</label>
                  <input id="q-name" name="name" required maxlength={120} autocomplete="name" value={v('name')} />
                </div>
                <div class="field">
                  <label for="q-company">Entreprise</label>
                  <input id="q-company" name="company" maxlength={160} autocomplete="organization" value={v('company')} />
                </div>
                <div class="field">
                  <label for="q-email">E-mail *</label>
                  <input id="q-email" name="email" type="email" required maxlength={200} autocomplete="email" inputmode="email" value={v('email')} />
                </div>
                <div class="field">
                  <label for="q-phone">Téléphone</label>
                  <input id="q-phone" name="phone" type="tel" maxlength={40} autocomplete="tel" inputmode="tel" value={v('phone')} />
                </div>
                <div class="field">
                  <label for="q-postal">Code postal</label>
                  <input id="q-postal" name="postal_code" maxlength={10} autocomplete="postal-code" inputmode="numeric" value={v('postal_code')} />
                </div>
                <div class="field">
                  <label for="q-city">Ville</label>
                  <input id="q-city" name="city" maxlength={120} autocomplete="address-level2" value={v('city')} />
                </div>
              </div>
              <div class="field">
                <label>Comment préférez-vous être recontacté ?</label>
                <Radios name="contact_pref" options={[['email', 'Par e-mail'], ['telephone', 'Par téléphone'], ['indifferent', 'Indifférent']]} value={v('contact_pref') || 'email'} />
              </div>
            </fieldset>

            <fieldset class="step" data-step="6">
              <legend>
                <span class="step-num">Étape 6 sur 6</span> Récapitulatif
              </legend>
              <div class="recap" data-recap>
                <p class="muted">Vérifiez vos informations avant d’envoyer.</p>
              </div>
              <div class="field-check">
                <input type="checkbox" id="q-privacy" name="privacy" value="1" required />
                <label for="q-privacy">
                  J’accepte que mes données soient utilisées pour traiter ma demande de devis, conformément à la{' '}
                  <a href="/confidentialite" target="_blank">politique de confidentialité</a>. *
                </label>
              </div>
              <div class="field-check">
                <input type="checkbox" id="q-marketing" name="marketing" value="1" />
                <label for="q-marketing">J’accepte de recevoir occasionnellement des conseils et actualités de l’agence par e-mail (facultatif, désinscription à tout moment).</label>
              </div>
              <Notice>
                Une estimation automatique reste <strong>indicative</strong> : votre devis définitif est vérifié et validé par nos soins avant envoi. Aucun
                paiement n’est demandé en ligne.
              </Notice>
            </fieldset>

            <div class="wizard-nav">
              <button type="button" class="btn btn-outline" data-prev hidden>
                ← Précédent
              </button>
              <button type="button" class="btn btn-primary" data-next hidden>
                Continuer →
              </button>
              <button type="submit" class="btn btn-primary btn-lg" data-submit>
                Envoyer ma demande
              </button>
            </div>
          </form>
          <script type="application/json" id="quote-data">
            {raw(jsonForScript({ products: productsData }))}
          </script>
        </div>
      </section>
    </Layout>
  );
}
