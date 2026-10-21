import type { Db } from './types';
import { LOCAL_PAGES_V3, PORTFOLIO_ENRICH_V3, PORTFOLIO_NEW_V3, SERVICES_V3 } from './content-v3';
import { POSTS_V5 } from './posts-v5';

/** Littéral SQL échappé (les migrations sont des instructions SQL brutes). */
const q = (v: string | number) => (typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);
const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

/** Titres SEO courts (≤ 60 caractères) des articles d'origine dont le titre est trop long, si aucun n'a été saisi. */
export const blogMetaStatements = (): string[] =>
  [
    ['visibilite-locale-par-ou-commencer', 'Visibilité locale : par où commencer ?'],
    ['flyer-points-a-verifier-avant-impression', 'Flyer : 8 points à vérifier avant impression'],
    ['site-vitrine-combien-de-pages', 'Site vitrine : combien de pages faut-il ?'],
  ].map(([slug, t]) => `UPDATE posts SET meta_title = ${q(t!)} WHERE slug = ${q(slug!)} AND meta_title = ''`);

/** Mise à jour des champs commerciaux d'un concept existant (sans écraser une saisie faite dans l'administration). */
export const portfolioEnrichStatements = (): string[] =>
  Object.entries(PORTFOLIO_ENRICH_V3).map(
    ([slug, e]) =>
      `UPDATE portfolio_items SET client_type = ${q(e.client_type)}, need = ${q(e.need)}, services = ${q(e.services)}, objectives = ${q(e.objectives)}, before_label = ${q(e.before_label)}, after_label = ${q(e.after_label)} WHERE slug = ${q(slug)} AND client_type = ''`,
  );

/**
 * Migrations versionnées. Chaque migration est une liste d'instructions SQL indépendantes
 * (compatible SQLite / Cloudflare D1). Ne JAMAIS modifier une migration déjà appliquée en production :
 * ajouter une nouvelle version à la fin du tableau.
 * Montants : entiers en centimes d'euro. Dates : texte ISO 8601.
 */
export const MIGRATIONS: { version: number; name: string; statements: string[] }[] = [
  {
    version: 1,
    name: 'schema initial',
    statements: [
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,

      // ─── Administration ───
      `CREATE TABLE admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_login_at TEXT
      )`,
      `CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        csrf TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )`,
      `CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)`,
      `CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity TEXT,
        entity_id TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL)`,

      // ─── Catalogue des prestations ───
      `CREATE TABLE services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        price_mode TEXT NOT NULL DEFAULT 'fixed',
        price_ht INTEGER,
        billing TEXT NOT NULL DEFAULT 'once',
        lead_time TEXT NOT NULL DEFAULT '',
        revisions INTEGER,
        options TEXT NOT NULL DEFAULT '[]',
        includes TEXT NOT NULL DEFAULT '',
        conditions TEXT NOT NULL DEFAULT '',
        exclusions TEXT NOT NULL DEFAULT '',
        image TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        featured INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        cost_production INTEGER NOT NULL DEFAULT 0,
        cost_supplier INTEGER NOT NULL DEFAULT 0,
        cost_shipping INTEGER NOT NULL DEFAULT 0,
        cost_external INTEGER NOT NULL DEFAULT 0,
        work_hours REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // ─── Impression ───
      `CREATE TABLE print_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        family TEXT NOT NULL,
        name TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        supplier TEXT NOT NULL DEFAULT 'HelloPrint',
        supplier_url TEXT NOT NULL DEFAULT '',
        options TEXT NOT NULL DEFAULT '{}',
        options_checked_at TEXT,
        design_service_slug TEXT,
        visual TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE supplier_price_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES print_products(id) ON DELETE CASCADE,
        supplier TEXT NOT NULL,
        product_name TEXT NOT NULL,
        supplier_url TEXT NOT NULL DEFAULT '',
        format TEXT NOT NULL DEFAULT '',
        orientation TEXT NOT NULL DEFAULT '',
        paper TEXT NOT NULL DEFAULT '',
        weight TEXT NOT NULL DEFAULT '',
        finish TEXT NOT NULL DEFAULT '',
        printing TEXT NOT NULL DEFAULT '',
        extra TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL,
        delivery TEXT NOT NULL DEFAULT '',
        supplier_price_ht INTEGER,
        supplier_shipping_ht INTEGER,
        supplier_other_fees_ht INTEGER,
        currency TEXT NOT NULL DEFAULT 'EUR',
        lead_time_days INTEGER,
        verified_at TEXT,
        source TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'a_verifier',
        notes TEXT NOT NULL DEFAULT '',
        sale_print_ht INTEGER,
        sale_shipping_ht INTEGER,
        sale_other_ht INTEGER,
        sale_validated_at TEXT,
        cost_at_validation INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (product_id, format, orientation, paper, weight, finish, printing, extra, quantity, delivery)
      )`,
      `CREATE INDEX idx_variants_product ON supplier_price_variants(product_id, status)`,

      // ─── CRM ───
      `CREATE TABLE contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        postal_code TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        siren TEXT NOT NULL DEFAULT '',
        customer_type TEXT NOT NULL DEFAULT 'pro',
        source TEXT NOT NULL DEFAULT '',
        need TEXT NOT NULL DEFAULT '',
        budget TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'nouveau',
        last_contact_at TEXT,
        next_action TEXT NOT NULL DEFAULT '',
        next_action_at TEXT,
        notes TEXT NOT NULL DEFAULT '',
        consent_marketing INTEGER NOT NULL DEFAULT 0,
        consent_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_contacts_email ON contacts(email)`,
      `CREATE INDEX idx_contacts_status ON contacts(status)`,
      `CREATE TABLE contact_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE quote_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        service_slug TEXT NOT NULL DEFAULT '',
        product_slug TEXT NOT NULL DEFAULT '',
        answers TEXT NOT NULL DEFAULT '{}',
        print_config TEXT,
        estimate TEXT,
        files TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'nouvelle',
        created_at TEXT NOT NULL
      )`,

      // ─── Devis ───
      `CREATE TABLE quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT UNIQUE,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        request_id INTEGER REFERENCES quote_requests(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'brouillon',
        issue_date TEXT,
        valid_until TEXT,
        intro TEXT NOT NULL DEFAULT '',
        terms TEXT NOT NULL DEFAULT '',
        deposit_percent INTEGER NOT NULL DEFAULT 0,
        token TEXT NOT NULL UNIQUE,
        sent_at TEXT,
        decided_at TEXT,
        decided_name TEXT,
        client_comment TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE quote_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        kind TEXT NOT NULL DEFAULT 'service',
        description TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price_ht INTEGER NOT NULL,
        vat_rate REAL NOT NULL,
        unit_cost_ht INTEGER NOT NULL DEFAULT 0
      )`,

      // ─── Commandes d'impression & BAT ───
      `CREATE TABLE print_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT NOT NULL UNIQUE,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
        product_id INTEGER REFERENCES print_products(id) ON DELETE SET NULL,
        variant_id INTEGER REFERENCES supplier_price_variants(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'demande_recue',
        bat_required INTEGER NOT NULL DEFAULT 1,
        supplier TEXT NOT NULL DEFAULT '',
        supplier_order_ref TEXT NOT NULL DEFAULT '',
        supplier_ordered_at TEXT,
        supplier_cost_ht INTEGER,
        sale_total_ht INTEGER,
        tracking_url TEXT NOT NULL DEFAULT '',
        estimated_delivery TEXT,
        validated_proof_id INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
        from_status TEXT,
        to_status TEXT,
        note TEXT NOT NULL DEFAULT '',
        author TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE files (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL,
        owner_kind TEXT NOT NULL,
        owner_id INTEGER,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE proofs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        file_key TEXT NOT NULL,
        file_name TEXT NOT NULL,
        pdf_info TEXT,
        checklist TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'brouillon',
        token TEXT NOT NULL UNIQUE,
        sent_at TEXT,
        decided_at TEXT,
        decided_name TEXT,
        client_comment TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (order_id, version)
      )`,

      // ─── Projets web ───
      `CREATE TABLE web_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'brief',
        brief TEXT NOT NULL DEFAULT '',
        identity TEXT NOT NULL DEFAULT '',
        texts TEXT NOT NULL DEFAULT '',
        photos TEXT NOT NULL DEFAULT '',
        sitemap TEXT NOT NULL DEFAULT '',
        domain TEXT NOT NULL DEFAULT '',
        hosting TEXT NOT NULL DEFAULT '',
        staging_url TEXT NOT NULL DEFAULT '',
        production_url TEXT NOT NULL DEFAULT '',
        current_version TEXT NOT NULL DEFAULT '',
        seo_checklist TEXT NOT NULL DEFAULT '{}',
        security_checklist TEXT NOT NULL DEFAULT '{}',
        acceptance_status TEXT NOT NULL DEFAULT 'non_demandee',
        acceptance_token TEXT NOT NULL UNIQUE,
        acceptance_at TEXT,
        acceptance_name TEXT,
        acceptance_comment TEXT,
        due_date TEXT,
        delivered_at TEXT,
        maintenance_terms TEXT NOT NULL DEFAULT '',
        backups TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE project_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES web_projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,

      // ─── Facturation ───
      `CREATE TABLE invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT UNIQUE,
        type TEXT NOT NULL DEFAULT 'facture',
        original_invoice_id INTEGER REFERENCES invoices(id),
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'brouillon',
        customer TEXT NOT NULL DEFAULT '{}',
        seller TEXT,
        issue_date TEXT,
        service_date TEXT,
        due_date TEXT,
        operation_category TEXT NOT NULL DEFAULT 'services',
        notes TEXT NOT NULL DEFAULT '',
        total_ht INTEGER NOT NULL DEFAULT 0,
        total_vat INTEGER NOT NULL DEFAULT 0,
        total_ttc INTEGER NOT NULL DEFAULT 0,
        cost_ht INTEGER NOT NULL DEFAULT 0,
        paid_at TEXT,
        payment_method TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE invoice_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price_ht INTEGER NOT NULL,
        vat_rate REAL NOT NULL,
        unit_cost_ht INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        service_slug TEXT NOT NULL DEFAULT '',
        label TEXT NOT NULL,
        monthly_ht INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'actif',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // ─── Contenus ───
      `CREATE TABLE portfolio_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        is_concept INTEGER NOT NULL DEFAULT 1,
        client_label TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        challenge TEXT NOT NULL DEFAULT '',
        solution TEXT NOT NULL DEFAULT '',
        outcome TEXT NOT NULL DEFAULT '',
        deliverables TEXT NOT NULL DEFAULT '',
        visual TEXT NOT NULL DEFAULT '',
        accent TEXT NOT NULL DEFAULT '',
        is_case_study INTEGER NOT NULL DEFAULT 0,
        featured INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        published_at TEXT,
        meta_title TEXT NOT NULL DEFAULT '',
        meta_description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE faqs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL DEFAULT 'general',
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'published',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE local_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        city TEXT NOT NULL,
        title TEXT NOT NULL,
        intro TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        meta_description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE redirects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_path TEXT NOT NULL UNIQUE,
        to_path TEXT NOT NULL,
        code INTEGER NOT NULL DEFAULT 301,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE email_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        to_addr TEXT NOT NULL,
        subject TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        provider TEXT NOT NULL,
        error TEXT,
        body TEXT,
        created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    name: 'coordonnées de Signe & Seine (Gruchet-le-Valasse)',
    // Données fournies par l'exploitant le 21/10/2026. Chaque valeur n'est écrite que si le champ est vide
    // ou encore à sa valeur provisoire : une modification faite dans l'administration n'est jamais écrasée.
    statements: [
      `UPDATE settings SET value = json_set(value, '$.agencyName', 'Signe & Seine') WHERE key = 'site' AND json_extract(value, '$.agencyName') = 'Atelier Sillage'`,
      `UPDATE settings SET value = json_set(value, '$.tagline', 'Sites internet, identité visuelle, impression et vitrines pour les entreprises du Pays de Caux et d’ailleurs.') WHERE key = 'site' AND json_extract(value, '$.tagline') = 'Sites internet, identité visuelle et impression pour les entreprises qui veulent être vues.'`,
      `UPDATE settings SET value = json_set(value, '$.contactEmail', 'contact@signeetseine.fr') WHERE key = 'site' AND COALESCE(json_extract(value, '$.contactEmail'), '') = ''`,
      `UPDATE settings SET value = json_set(value, '$.notifyEmail', 'contact@signeetseine.fr') WHERE key = 'site' AND COALESCE(json_extract(value, '$.notifyEmail'), '') = ''`,
      `UPDATE settings SET value = json_set(value, '$.contactPhone', '06 47 41 42 24') WHERE key = 'site' AND COALESCE(json_extract(value, '$.contactPhone'), '') = ''`,
      `UPDATE settings SET value = json_set(value, '$.openingHours', 'Du lundi au samedi, 8 h 30 – 20 h') WHERE key = 'site' AND json_extract(value, '$.openingHours') IN ('Du lundi au vendredi, 9 h – 18 h', '')`,
      `UPDATE settings SET value = json_set(value, '$.serviceArea', 'Pays de Caux et Seine-Maritime — partout en France à distance') WHERE key = 'site' AND json_extract(value, '$.serviceArea') IN ('Partout en France, à distance', '')`,
    ],
  },
  {
    version: 3,
    name: 'vitrophanie & signalétique, pages locales, portfolio commercial',
    statements: [
      ...['client_type', 'need', 'services', 'objectives', 'before_label', 'after_label', 'testimonial', 'testimonial_author'].map(
        (col) => `ALTER TABLE portfolio_items ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`,
      ),
      `ALTER TABLE portfolio_items ADD COLUMN testimonial_authorized INTEGER NOT NULL DEFAULT 0`,
      ...portfolioEnrichStatements(),
      ...PORTFOLIO_NEW_V3.map(
        (p) => `INSERT OR IGNORE INTO portfolio_items (slug, title, category, is_concept, client_label, summary, challenge, solution, outcome, deliverables, visual, accent,
          is_case_study, featured, status, sort_order, client_type, need, services, objectives, before_label, after_label, created_at, updated_at)
          VALUES (${[p.slug, p.title, p.category, 1, 'Projet fictif — concept de démonstration', p.summary, p.challenge, p.solution, p.outcome, p.deliverables, p.visual, p.accent,
            p.is_case_study, p.featured, 'published', p.sort_order, p.client_type, p.need, p.services, p.objectives, p.before_label, p.after_label].map(q).join(', ')}, ${NOW}, ${NOW})`,
      ),
      ...SERVICES_V3.map(
        (s, i) => `INSERT OR IGNORE INTO services (slug, category, name, summary, description, price_mode, price_ht, billing, lead_time, revisions, options, includes,
          conditions, exclusions, status, featured, sort_order, created_at, updated_at)
          VALUES (${[s.slug, s.category, s.name, s.summary, s.description].map(q).join(', ')}, 'quote', NULL, 'once', ${q(s.lead_time)}, NULL, '[]',
          ${[s.includes, s.conditions, s.exclusions].map(q).join(', ')}, 'published', 0, ${300 + i * 10}, ${NOW}, ${NOW})`,
      ),
      ...LOCAL_PAGES_V3.map(
        (l) => `INSERT OR IGNORE INTO local_pages (slug, city, title, intro, body, meta_description, status, created_at, updated_at)
          VALUES (${[l.slug, l.city, l.title, l.intro, l.body, l.meta_description].map(q).join(', ')}, 'published', ${NOW}, ${NOW})`,
      ),
    ],
  },
  {
    version: 4,
    name: 'fiche Google Business et conditions de déplacement',
    // Données fournies par l'exploitant le 21/10/2026 : déplacements partout en France, frais selon le projet.
    statements: [
      `UPDATE settings SET value = json_set(value, '$.googleBusinessUrl', 'https://share.google/Kuoatbjm9GEr1Pvi2') WHERE key = 'site' AND COALESCE(json_extract(value, '$.googleBusinessUrl'), '') = ''`,
      `UPDATE local_pages SET body = replace(body, ${q('Conditions de déplacement au Havre : [À COMPLÉTER : frais de déplacement éventuels pour Le Havre].')}, ${q('Déplacements : nous intervenons au Havre comme partout en France ; les frais de déplacement éventuels dépendent du projet et sont indiqués sur le devis.')}) WHERE slug = 'le-havre'`,
      `UPDATE local_pages SET body = replace(body, ${q('Conditions de déplacement à Bolbec : [À COMPLÉTER : confirmer l’absence de frais de déplacement pour Bolbec].')}, ${q('Déplacements : Bolbec est voisine de notre agence ; pour tout projet, les frais de déplacement éventuels dépendent de la prestation et sont indiqués sur le devis.')}) WHERE slug = 'bolbec'`,
      `UPDATE local_pages SET body = replace(body, ${q('Conditions de déplacement à Lillebonne : [À COMPLÉTER : confirmer l’absence de frais de déplacement pour Lillebonne].')}, ${q('Déplacements : Lillebonne est à quelques minutes de notre agence ; les frais de déplacement éventuels dépendent du projet et sont indiqués sur le devis.')}) WHERE slug = 'lillebonne'`,
    ],
  },
  {
    version: 5,
    name: 'blog : 12 articles programmés (un par semaine)',
    // Publiés à leur date : un article dont published_at est dans le futur n'apparaît nulle part sur le site.
    // INSERT OR IGNORE : un article déjà créé ou modifié dans l'administration n'est jamais écrasé.
    statements: POSTS_V5.map(
      (p) => `INSERT OR IGNORE INTO posts (slug, title, excerpt, body, category, status, published_at, meta_title, meta_description, created_at, updated_at)
        VALUES (${[p.slug, p.title, p.excerpt, p.body, p.category, 'published', p.published_at, '', p.meta_description].map(q).join(', ')}, ${NOW}, ${NOW})`,
    ),
  },
  {
    version: 6,
    name: 'module caisse et paiement par carte (sur devis)',
    // INSERT OR IGNORE : une prestation déjà créée ou modifiée dans l'administration n'est jamais écrasée.
    statements: [
      `INSERT OR IGNORE INTO services (slug, category, name, summary, description, price_mode, price_ht, billing, lead_time, revisions, options, includes,
        conditions, exclusions, status, featured, sort_order, created_at, updated_at)
        VALUES ('module-caisse', 'accompagnement', 'Caisse et paiement par carte',
        ${q('Choix, installation, paramétrage et formation : une caisse conforme, prête à encaisser. Disponible seule ou en pack.')},
        ${q('Mise en service d’une solution de caisse et de paiement par carte existante et conforme, paramétrée à votre activité.')},
        'quote', NULL, 'once', ${q('Selon le catalogue et le matériel')}, NULL, '[]',
        ${q('Conseil sur la solution adaptée à votre activité\nOuverture du compte à votre nom\nCatalogue, prix et taux de TVA\nTicket à vos couleurs\nMise en service du paiement par carte\nFormation et justificatif de conformité remis')},
        ${q('Paramétrage de la TVA à valider avec votre expert-comptable. Compte de caisse au nom du client.')},
        ${q('Abonnement, commissions sur les paiements et matériel de la solution non inclus : facturés par l’éditeur et présentés avant engagement.')},
        'published', 0, 410, ${NOW}, ${NOW})`,
    ],
  },
  {
    version: 7,
    name: 'SEO : titres et descriptions dans les limites affichées par Google',
    // Ne modifie que des valeurs encore d'origine : une saisie faite dans l'administration est conservée.
    statements: [
      `UPDATE local_pages SET meta_description = ${q('Site internet, logo, flyers, vitrophanie et signalétique à Lillebonne et Port-Jérôme-sur-Seine. Agence voisine, rendez-vous sur place, devis gratuit.')} WHERE slug = 'lillebonne' AND meta_description = ${q('Création de site internet, logo, flyers, vitrophanie et signalétique à Lillebonne et Port-Jérôme-sur-Seine. Agence voisine, rendez-vous sur place, devis gratuit.')}`,
      ...blogMetaStatements(),
    ],
  },
  {
    version: 8,
    name: 'statistiques de visite internes (sans cookie)',
    // visitor : empreinte du jour (non réversible, change chaque jour). Conservation : voir ANALYTICS_RETENTION_DAYS.
    statements: [
      `CREATE TABLE page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        created_at TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER NOT NULL DEFAULT 200,
        entry INTEGER NOT NULL DEFAULT 0,
        medium TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        campaign TEXT NOT NULL DEFAULT '',
        referrer TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '',
        device TEXT NOT NULL DEFAULT '',
        visitor TEXT NOT NULL
      )`,
      `CREATE INDEX idx_page_views_day ON page_views(day)`,
      `CREATE INDEX idx_page_views_visitor ON page_views(day, visitor)`,
      `CREATE TABLE conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        created_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        ref_id INTEGER,
        medium TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        campaign TEXT NOT NULL DEFAULT '',
        landing TEXT NOT NULL DEFAULT '',
        visitor TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE INDEX idx_conversions_day ON conversions(day)`,
    ],
  },
  {
    version: 9,
    name: 'cahiers des charges remplis par les clients',
    statements: [
      `CREATE TABLE briefs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        title TEXT NOT NULL,
        modules TEXT NOT NULL DEFAULT '[]',
        answers TEXT NOT NULL DEFAULT '{}',
        files TEXT NOT NULL DEFAULT '[]',
        step TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'brouillon',
        token TEXT NOT NULL UNIQUE,
        sent_at TEXT,
        submitted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_briefs_contact ON briefs(contact_id)`,
    ],
  },
];

/** Applique les migrations manquantes, dans l'ordre. Idempotent. */
export async function migrate(db: Db): Promise<number[]> {
  await db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`);
  const done = new Set((await db.all<{ version: number }>('SELECT version FROM schema_migrations')).map((r) => r.version));
  const applied: number[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    await db.batch([
      ...m.statements.map((sql) => ({ sql })),
      { sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', params: [m.version, m.name, new Date().toISOString()] },
    ]);
    applied.push(m.version);
  }
  return applied;
}
