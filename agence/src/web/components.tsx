import { PACKS } from './packs';
import type { Child } from 'hono/jsx';
import type { Settings } from '../domain/settings';
import type { FaqRow, ServiceRow } from '../repo/types';
import { formatEuros, ttcOf } from '../domain/money';
import { lines } from '../domain/text';

export function Price({ svc, s, size = 'md' }: { svc: Pick<ServiceRow, 'price_mode' | 'price_ht' | 'billing'>; s: Settings; size?: 'md' | 'lg' }) {
  if (svc.price_mode === 'quote' || svc.price_ht == null) {
    return (
      <p class={`price price-${size}`}>
        <span class="price-amount">Sur devis</span>
      </p>
    );
  }
  const per = svc.billing === 'monthly' ? ' / mois' : '';
  return (
    <p class={`price price-${size}`}>
      {svc.price_mode === 'from' && <span class="price-from">À partir de</span>}
      <span class="price-amount">
        {formatEuros(svc.price_ht, true)}
        <small> HT{per}</small>
      </span>
      <span class="price-ttc">
        {s.vatMode === 'franchise' ? 'TVA non applicable, art. 293 B du CGI' : `soit ${formatEuros(ttcOf(svc.price_ht, s.vatRate))} TTC${per}`}
      </span>
    </p>
  );
}

export function SectionHead({ eyebrow, title, intro, align = 'left', id }: { eyebrow?: string; title: Child; intro?: Child; align?: 'left' | 'center'; id?: string }) {
  return (
    <div class={`section-head ${align === 'center' ? 'center' : ''}`}>
      {eyebrow && <p class="eyebrow">{eyebrow}</p>}
      <h2 id={id}>{title}</h2>
      {intro && <p class="lead">{intro}</p>}
    </div>
  );
}

export function ServiceCard({ svc, s, showIncludes = true }: { svc: ServiceRow; s: Settings; showIncludes?: boolean }) {
  const inc = lines(svc.includes).slice(0, 5);
  return (
    <article class={`card service-card ${svc.featured ? 'is-featured' : ''}`} data-reveal>
      <div class="card-top">
        <h3>{svc.name}</h3>
        <p class="muted">{svc.summary}</p>
      </div>
      <Price svc={svc} s={s} />
      {showIncludes && inc.length > 0 && (
        <ul class="checks">
          {inc.map((i) => (
            <li>{i}</li>
          ))}
        </ul>
      )}
      <dl class="meta-list">
        {svc.lead_time && (
          <div>
            <dt>Délai</dt>
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
      <div class="card-actions">
        <a class="btn btn-block" href={`/devis?prestation=${svc.slug}`}>
          Demander un devis
        </a>
        <a class="link-arrow" href={`/tarifs#${svc.slug}`}>
          Détail et conditions
        </a>
      </div>
    </article>
  );
}

export function FaqList({ faqs }: { faqs: FaqRow[] }) {
  if (!faqs.length) return null;
  return (
    <div class="faq">
      {faqs.map((f) => (
        <details class="faq-item">
          <summary>
            <span>{f.question}</span>
            <i aria-hidden="true"></i>
          </summary>
          <div class="faq-answer">
            <p>{f.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

export function faqJsonLd(faqs: FaqRow[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  };
}

export const PROCESS_STEPS: [string, string][] = [
  ['Échange', 'Vous décrivez votre besoin en quelques minutes. Nous revenons vers vous sous 48 h ouvrées avec des questions précises ou un devis.'],
  ['Proposition', 'Un devis détaillé : ce qui est inclus, ce qui ne l’est pas, le délai et le nombre de révisions. Aucun engagement avant votre signature.'],
  ['Création', 'Nous concevons, vous commentez. Les révisions incluses sont utilisées pour ajuster jusqu’à ce que le résultat vous ressemble.'],
  ['Validation & livraison', 'Vous validez le bon à tirer ou la recette du site. Rien n’est imprimé ni mis en ligne sans votre accord.'],
];

export function Process({ steps = PROCESS_STEPS }: { steps?: [string, string][] }) {
  return (
    <ol class="process">
      {steps.map(([t, d], i) => (
        <li data-reveal>
          <span class="process-num">{String(i + 1).padStart(2, '0')}</span>
          <h3>{t}</h3>
          <p>{d}</p>
        </li>
      ))}
    </ol>
  );
}

export function CtaBand({ title = 'Parlons de votre projet', text = 'Devis gratuit, réponse sous 48 h ouvrées, sans engagement.', href = '/devis', label = 'Obtenir mon devis gratuit' }: { title?: string; text?: string; href?: string; label?: string }) {
  return (
    <section class="section">
      <div class="container">
        <div class="cta-band" data-reveal>
          <div>
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
          <div class="btn-row">
            <a href={href} class="btn btn-primary btn-lg">{label}</a>
            <a href="/contact" class="btn btn-outline btn-lg">Poser une question</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ConceptBadge() {
  return <span class="badge badge-concept" title="Projet fictif réalisé pour illustrer notre savoir-faire">Concept de démonstration</span>;
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warning' | 'success' | 'error'; children: Child }) {
  return (
    <div class={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** Champ caché anti-robots (pot de miel) + jeton signé du formulaire. */
export function SpamGuard({ token }: { token: string }) {
  return (
    <>
      <input type="hidden" name="_ft" value={token} />
      <div class="hp" aria-hidden="true">
        <label>
          Ne pas remplir
          <input type="text" name="website_url" tabindex={-1} autocomplete="off" />
        </label>
      </div>
    </>
  );
}

export function ContactForm({ token, compact = false, subjectDefault = '', pack = '' }: { token: string; compact?: boolean; subjectDefault?: string; pack?: string }) {
  return (
    <form method="post" action="/contact" class={`form ${compact ? 'form-compact' : ''}`} id="formulaire" data-enhance>
      <SpamGuard token={token} />
      <div class="grid-2">
        <div class="field">
          <label for="cf-name">Nom et prénom *</label>
          <input id="cf-name" name="name" required maxlength={120} autocomplete="name" />
        </div>
        <div class="field">
          <label for="cf-company">Entreprise</label>
          <input id="cf-company" name="company" maxlength={160} autocomplete="organization" />
        </div>
        <div class="field">
          <label for="cf-email">E-mail *</label>
          <input id="cf-email" name="email" type="email" required maxlength={200} autocomplete="email" inputmode="email" />
        </div>
        <div class="field">
          <label for="cf-phone">Téléphone</label>
          <input id="cf-phone" name="phone" type="tel" maxlength={40} autocomplete="tel" inputmode="tel" />
        </div>
      </div>
      {!compact && (
        <div class="field">
          <label for="cf-pack">Votre projet concerne</label>
          <select id="cf-pack" name="pack">
            <option value="">— Choisir (facultatif)</option>
            {PACKS.map((p) => (
              <option value={p.slug} selected={pack === p.slug}>
                Pack Bien démarrer — {p.metier}
              </option>
            ))}
            <option value="autre-metier" selected={pack === 'autre-metier'}>
              Pack Bien démarrer — autre métier
            </option>
          </select>
        </div>
      )}
      <div class="field">
        <label for="cf-message">Votre message *</label>
        <textarea id="cf-message" name="message" required minlength={10} maxlength={5000} rows={compact ? 4 : 6}>
          {subjectDefault}
        </textarea>
      </div>
      <div class="field-check">
        <input type="checkbox" id="cf-consent" name="privacy" value="1" required />
        <label for="cf-consent">
          J’accepte que mes données soient utilisées pour répondre à ma demande, conformément à la <a href="/confidentialite">politique de confidentialité</a>. *
        </label>
      </div>
      <p class="form-foot">
        <button type="submit" class="btn btn-primary">Envoyer le message</button>
        <span class="muted small">* champs obligatoires. Aucune prospection commerciale sans votre accord.</span>
      </p>
    </form>
  );
}

/**
 * Carte de localisation sans traceur : la carte OpenStreetMap n'est chargée qu'au clic du visiteur
 * (aucune requête vers un tiers avant son action). Sans JavaScript, un lien ouvre la carte.
 */
export function MapEmbed({ s }: { s: Settings }) {
  const lat = s.latitude!;
  const lon = s.longitude!;
  const bbox = [lon - 0.13, lat - 0.06, lon + 0.13, lat + 0.06].map((n) => n.toFixed(4)).join(',');
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`;
  return (
    <div class="map-card" data-map={embed} data-map-title={`Carte : ${s.agencyName}, ${s.city}`}>
      <div class="map-placeholder">
        <p class="strong">{s.city}{s.department ? `, ${s.department}` : ''}</p>
        <p class="muted small">La carte est fournie par OpenStreetMap et ne se charge qu’à votre demande.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-outline btn-sm" data-map-load>Afficher la carte</button>
          <a href={link} class="link-arrow" rel="noopener" target="_blank">Ouvrir dans OpenStreetMap</a>
        </div>
      </div>
    </div>
  );
}
