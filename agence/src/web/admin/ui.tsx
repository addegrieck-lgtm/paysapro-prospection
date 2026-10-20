import type { Child } from 'hono/jsx';
import type { Settings } from '../../domain/settings';
import type { AdminUser } from '../../app/context';
import { type Option, labelOf } from '../../domain/statuses';
import { centsToInput, formatEuros } from '../../domain/money';

const NAV: { group: string; items: [string, string][] }[] = [
  { group: 'Pilotage', items: [['/admin', 'Tableau de bord']] },
  {
    group: 'Commercial',
    items: [
      ['/admin/demandes', 'Demandes de devis'],
      ['/admin/crm', 'Contacts (CRM)'],
      ['/admin/devis', 'Devis'],
      ['/admin/factures', 'Factures'],
      ['/admin/abonnements', 'Abonnements'],
    ],
  },
  {
    group: 'Production',
    items: [
      ['/admin/commandes', 'Commandes d’impression'],
      ['/admin/projets', 'Projets web'],
    ],
  },
  {
    group: 'Catalogue & prix',
    items: [
      ['/admin/prestations', 'Prestations'],
      ['/admin/impression/produits', 'Produits imprimés'],
      ['/admin/impression/tarifs', 'Prix fournisseurs'],
      ['/admin/marges', 'Marges'],
    ],
  },
  {
    group: 'Contenus',
    items: [
      ['/admin/contenus/realisations', 'Réalisations'],
      ['/admin/contenus/articles', 'Blog'],
      ['/admin/contenus/faq', 'FAQ'],
      ['/admin/contenus/pages-locales', 'Pages locales'],
      ['/admin/contenus/redirections', 'Redirections'],
    ],
  },
  {
    group: 'Système',
    items: [
      ['/admin/parametres', 'Paramètres'],
      ['/admin/emails', 'E-mails envoyés'],
      ['/admin/compte', 'Mon compte'],
    ],
  },
];

const FLASH: Record<string, [string, 'success' | 'error' | 'info']> = {
  saved: ['Modifications enregistrées.', 'success'],
  created: ['Élément créé.', 'success'],
  deleted: ['Élément supprimé.', 'success'],
  sent: ['Envoyé.', 'success'],
  mailfail: ['Enregistré, mais l’e-mail n’a pas pu être envoyé (voir E-mails envoyés).', 'error'],
  status: ['Statut mis à jour.', 'success'],
  issued: ['Facture émise : elle n’est plus modifiable.', 'success'],
  verified: ['Prix marqué comme vérifié.', 'success'],
  validated: ['Prix de vente validé et publié.', 'success'],
};

export function AdminLayout(p: { s: Settings; user: AdminUser; title: string; path: string; csrf: string; flash?: string; error?: string; children: Child; actions?: Child; wide?: boolean }) {
  const isActive = (href: string) => (href === '/admin' ? p.path === '/admin' : p.path === href || p.path.startsWith(href + '/'));
  const flash = p.flash ? FLASH[p.flash] : undefined;
  return (
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{p.title} — Administration {p.s.agencyName}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/assets/css/admin.css" />
        <script type="module" src="/assets/js/admin.js"></script>
      </head>
      <body class="admin">
        <a href="#contenu" class="skip-link">Aller au contenu</a>
        <div class="admin-shell">
          <aside class="sidebar">
            <a href="/admin" class="sidebar-brand">
              <span class="mono">{p.s.agencyName.slice(0, 1)}</span>
              <span>
                {p.s.agencyName}
                <small>Administration</small>
              </span>
            </a>
            <details class="sidebar-toggle" open>
              <summary>Menu</summary>
              <nav aria-label="Administration">
                {NAV.map((g) => (
                  <div class="nav-group">
                    <p>{g.group}</p>
                    {g.items.map(([href, label]) => (
                      <a href={href} aria-current={isActive(href) ? 'page' : undefined}>
                        {label}
                      </a>
                    ))}
                  </div>
                ))}
              </nav>
            </details>
            <div class="sidebar-foot">
              <a href="/" target="_blank" rel="noopener">
                Voir le site ↗
              </a>
              <form method="post" action="/admin/deconnexion">
                <input type="hidden" name="_csrf" value={p.csrf} />
                <button type="submit" class="linkish">
                  Se déconnecter ({p.user.name})
                </button>
              </form>
            </div>
          </aside>
          <main id="contenu" class={`admin-main ${p.wide ? 'is-wide' : ''}`}>
            <header class="page-head">
              <h1>{p.title}</h1>
              {p.actions && <div class="page-actions">{p.actions}</div>}
            </header>
            {flash && <div class={`alert alert-${flash[1]}`}>{flash[0]}</div>}
            {p.error && <div class="alert alert-error">{p.error}</div>}
            {p.children}
          </main>
        </div>
      </body>
    </html>
  );
}

export function Csrf({ token }: { token: string }) {
  return <input type="hidden" name="_csrf" value={token} />;
}

export function Badge({ options, value, tone }: { options: readonly Option[]; value: string; tone?: string }) {
  return <span class={`badge badge-${tone ?? value}`}>{labelOf(options, value)}</span>;
}

export function Kpi({ label, value, hint, href, tone }: { label: string; value: Child; hint?: Child; href?: string; tone?: 'warn' | 'good' }) {
  const body = (
    <>
      <span class="kpi-label">{label}</span>
      <span class="kpi-value">{value}</span>
      {hint && <span class="kpi-hint">{hint}</span>}
    </>
  );
  return href ? (
    <a href={href} class={`kpi ${tone ? `kpi-${tone}` : ''}`}>
      {body}
    </a>
  ) : (
    <div class={`kpi ${tone ? `kpi-${tone}` : ''}`}>{body}</div>
  );
}

export function F(p: { label: string; name: string; value?: string | number | null; type?: string; required?: boolean; help?: Child; placeholder?: string; max?: number; step?: string; wide?: boolean; readonly?: boolean }) {
  const id = `f-${p.name}`;
  return (
    <div class={`field ${p.wide ? 'field-wide' : ''}`}>
      <label for={id}>
        {p.label}
        {p.required ? ' *' : ''}
      </label>
      <input
        id={id}
        name={p.name}
        type={p.type ?? 'text'}
        value={p.value == null ? '' : String(p.value)}
        required={p.required}
        placeholder={p.placeholder}
        maxlength={p.max}
        step={p.step}
        readonly={p.readonly}
        inputmode={p.type === 'money' ? 'decimal' : undefined}
      />
      {p.help && <small class="help">{p.help}</small>}
    </div>
  );
}

/** Champ montant en euros (stocké en centimes). */
export function Money(p: { label: string; name: string; cents: number | null | undefined; required?: boolean; help?: Child }) {
  const id = `f-${p.name}`;
  return (
    <div class="field">
      <label for={id}>
        {p.label}
        {p.required ? ' *' : ''}
      </label>
      <div class="input-suffix">
        <input id={id} name={p.name} value={centsToInput(p.cents)} inputmode="decimal" pattern="-?[0-9 ]+([.,][0-9]{1,2})?" required={p.required} placeholder="0,00" />
        <span>€</span>
      </div>
      {p.help && <small class="help">{p.help}</small>}
    </div>
  );
}

export function TA(p: { label: string; name: string; value?: string | null; rows?: number; help?: Child; required?: boolean; max?: number }) {
  const id = `f-${p.name}`;
  return (
    <div class="field field-wide">
      <label for={id}>
        {p.label}
        {p.required ? ' *' : ''}
      </label>
      <textarea id={id} name={p.name} rows={p.rows ?? 4} required={p.required} maxlength={p.max}>
        {p.value ?? ''}
      </textarea>
      {p.help && <small class="help">{p.help}</small>}
    </div>
  );
}

export function Sel(p: { label: string; name: string; options: readonly (readonly [string, string])[]; value?: string | null; help?: Child; empty?: string; required?: boolean }) {
  const id = `f-${p.name}`;
  return (
    <div class="field">
      <label for={id}>
        {p.label}
        {p.required ? ' *' : ''}
      </label>
      <select id={id} name={p.name} required={p.required}>
        {p.empty != null && <option value="">{p.empty}</option>}
        {p.options.map(([v, l]) => (
          <option value={v} selected={v === (p.value ?? '')}>
            {l}
          </option>
        ))}
      </select>
      {p.help && <small class="help">{p.help}</small>}
    </div>
  );
}

export function Check(p: { label: string; name: string; checked?: boolean; help?: Child }) {
  return (
    <div class="field field-check">
      <label>
        <input type="checkbox" name={p.name} value="1" checked={p.checked} /> {p.label}
      </label>
      {p.help && <small class="help">{p.help}</small>}
    </div>
  );
}

export const eur = (c: number | null | undefined) => (c == null ? '—' : formatEuros(c));

export function Empty({ children }: { children: Child }) {
  return <div class="empty">{children}</div>;
}

export function Pager({ page, hasMore, base }: { page: number; hasMore: boolean; base: string }) {
  if (page <= 1 && !hasMore) return null;
  const sep = base.includes('?') ? '&' : '?';
  return (
    <nav class="pager">
      {page > 1 && <a href={`${base}${sep}page=${page - 1}`}>← Précédent</a>}
      <span>Page {page}</span>
      {hasMore && <a href={`${base}${sep}page=${page + 1}`}>Suivant →</a>}
    </nav>
  );
}

/** Formulaire POST minimal (un bouton) avec jeton CSRF. */
export function ActionButton(p: { action: string; csrf: string; label: string; confirm?: string; cls?: string; fields?: Record<string, string> }) {
  return (
    <form method="post" action={p.action} class="inline-form" data-confirm={p.confirm}>
      <Csrf token={p.csrf} />
      {Object.entries(p.fields ?? {}).map(([k, v]) => (
        <input type="hidden" name={k} value={v} />
      ))}
      <button type="submit" class={`btn ${p.cls ?? 'btn-outline'} btn-sm`}>
        {p.label}
      </button>
    </form>
  );
}

export function LoginShell({ title, children }: { title: string; children: Child }) {
  return (
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{title}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/assets/css/admin.css" />
      </head>
      <body class="admin login-page">
        <main class="login-card">{children}</main>
      </body>
    </html>
  );
}
