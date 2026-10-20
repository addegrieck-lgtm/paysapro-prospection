import type { Db } from './types';

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
