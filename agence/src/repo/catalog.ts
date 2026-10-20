import type { Db, SqlValue } from '../db/types';
import type { FaqRow, LocalPageRow, PortfolioRow, PostRow, ProductRow, ServiceRow, VariantFull } from './types';

/** Lectures publiques : uniquement les contenus publiés. */

export async function publishedServices(db: Db, opts: { slugs?: string[]; categories?: string[] } = {}): Promise<ServiceRow[]> {
  const where = ["status = 'published'"];
  const params: SqlValue[] = [];
  if (opts.slugs?.length) {
    where.push(`slug IN (${opts.slugs.map(() => '?').join(',')})`);
    params.push(...opts.slugs);
  }
  if (opts.categories?.length) {
    where.push(`category IN (${opts.categories.map(() => '?').join(',')})`);
    params.push(...opts.categories);
  }
  const rows = await db.all<ServiceRow>(`SELECT * FROM services WHERE ${where.join(' AND ')} ORDER BY sort_order, id`, params);
  if (opts.slugs?.length) rows.sort((a, b) => opts.slugs!.indexOf(a.slug) - opts.slugs!.indexOf(b.slug));
  return rows;
}

export async function serviceBySlug(db: Db, slug: string, publishedOnly = true): Promise<ServiceRow | undefined> {
  return db.get<ServiceRow>(`SELECT * FROM services WHERE slug = ?${publishedOnly ? " AND status = 'published'" : ''}`, [slug]);
}

export async function publishedProducts(db: Db, family?: string): Promise<ProductRow[]> {
  return db.all<ProductRow>(
    `SELECT * FROM print_products WHERE status = 'published'${family ? ' AND family = ?' : ''} ORDER BY sort_order, id`,
    family ? [family] : [],
  );
}

export async function productBySlug(db: Db, slug: string, publishedOnly = true): Promise<ProductRow | undefined> {
  return db.get<ProductRow>(`SELECT * FROM print_products WHERE slug = ?${publishedOnly ? " AND status = 'published'" : ''}`, [slug]);
}

/** Variantes d'un produit — USAGE SERVEUR UNIQUEMENT (contient les coûts fournisseur). */
export async function variantsOf(db: Db, productId: number): Promise<VariantFull[]> {
  return db.all<VariantFull>('SELECT * FROM supplier_price_variants WHERE product_id = ? ORDER BY quantity', [productId]);
}

export async function publishedPortfolio(db: Db, opts: { featured?: boolean; caseStudies?: boolean } = {}): Promise<PortfolioRow[]> {
  const where = ["status = 'published'"];
  if (opts.featured) where.push('featured = 1');
  if (opts.caseStudies) where.push('is_case_study = 1');
  return db.all<PortfolioRow>(`SELECT * FROM portfolio_items WHERE ${where.join(' AND ')} ORDER BY sort_order, id`);
}

export async function portfolioBySlug(db: Db, slug: string): Promise<PortfolioRow | undefined> {
  return db.get<PortfolioRow>("SELECT * FROM portfolio_items WHERE slug = ? AND status = 'published'", [slug]);
}

export async function publishedPosts(db: Db, limit = 50): Promise<PostRow[]> {
  return db.all<PostRow>(
    "SELECT * FROM posts WHERE status = 'published' AND published_at <= ? ORDER BY published_at DESC LIMIT ?",
    [new Date().toISOString(), limit],
  );
}

export async function postBySlug(db: Db, slug: string): Promise<PostRow | undefined> {
  return db.get<PostRow>("SELECT * FROM posts WHERE slug = ? AND status = 'published' AND published_at <= ?", [slug, new Date().toISOString()]);
}

export async function publishedFaqs(db: Db, topics?: string[]): Promise<FaqRow[]> {
  if (!topics?.length) return db.all<FaqRow>("SELECT * FROM faqs WHERE status = 'published' ORDER BY sort_order, id");
  return db.all<FaqRow>(
    `SELECT * FROM faqs WHERE status = 'published' AND topic IN (${topics.map(() => '?').join(',')}) ORDER BY sort_order, id`,
    topics,
  );
}

export async function publishedLocalPages(db: Db): Promise<LocalPageRow[]> {
  return db.all<LocalPageRow>("SELECT * FROM local_pages WHERE status = 'published' ORDER BY city");
}

export async function localPageBySlug(db: Db, slug: string): Promise<LocalPageRow | undefined> {
  return db.get<LocalPageRow>("SELECT * FROM local_pages WHERE slug = ? AND status = 'published'", [slug]);
}
