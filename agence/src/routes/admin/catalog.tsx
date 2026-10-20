import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, Ctx } from '../../app/context';
import { idParam, page, readForm } from './helpers';
import { ActionButton, Badge, Check, Csrf, Empty, F, Money, Sel, TA, eur } from '../../web/admin/ui';
import { PUBLISH_STATUSES, VARIANT_STATUSES, isOneOf } from '../../domain/statuses';
import type { ProductRow, ServiceRow, VariantFull } from '../../repo/types';
import { CATEGORY_LABELS, FAMILY_LABELS } from '../../web/content';
import { computeMargin, labourCost } from '../../domain/margin';
import { ttcOf } from '../../domain/money';
import { slugify, lines } from '../../domain/text';
import { formatDate, formatShortDate, isIsoDate, todayParis } from '../../domain/dates';
import { ATTRS, ATTR_LABELS, attrLabel, costChangedSinceValidation, effectiveStatus, parseOptions, saleTotal, suggestedSalePrice, supplierTotal, type Attr, type PrintOptions } from '../../domain/print';
import { safeOptions } from '../../web/public/pages';
import { audit } from '../../repo/settings';

export const catalogRoutes = new Hono<AppEnv>();

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [string, string][];
const PRICE_MODES = [
  ['fixed', 'Prix fixe'],
  ['from', 'À partir de'],
  ['quote', 'Sur devis'],
] as const;

const pct = (v: number | null) => (v == null ? '—' : `${String(v).replace('.', ',')} %`);

// ─── Prestations ───

catalogRoutes.get('/prestations', async (c) => {
  const rows = await c.get('deps').db.all<ServiceRow>('SELECT * FROM services ORDER BY category, sort_order, id');
  const s = c.get('settings');
  return page(
    c,
    'Prestations',
    <>
      <p class="muted">Les prix publiés sur le site viennent d’ici. Modifiez l’ordre d’affichage avec le champ « Ordre » (les plus petits d’abord).</p>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Prestation</th>
              <th>Catégorie</th>
              <th class="num">Prix HT</th>
              <th class="num">Prix TTC</th>
              <th class="num">Marge brute</th>
              <th>Statut</th>
              <th>Mis à jour</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = r.price_ht != null ? computeMargin(r.price_ht, { production: r.cost_production, supplier: r.cost_supplier, shipping: r.cost_shipping, external: r.cost_external, labour: labourCost(r.work_hours, s.internalHourlyCost) }) : null;
              return (
                <tr>
                  <td>{r.sort_order}</td>
                  <td>
                    <a href={`/admin/prestations/${r.id}`}>{r.name}</a>
                  </td>
                  <td>{CATEGORY_LABELS[r.category] ?? r.category}</td>
                  <td class="num">
                    {r.price_mode === 'quote' ? 'Sur devis' : `${r.price_mode === 'from' ? 'dès ' : ''}${eur(r.price_ht)}`}
                    {r.billing === 'monthly' ? '/mois' : ''}
                  </td>
                  <td class="num">{r.price_ht != null && r.price_mode !== 'quote' ? eur(s.vatMode === 'franchise' ? r.price_ht : ttcOf(r.price_ht, s.vatRate)) : '—'}</td>
                  <td class="num">{m ? `${eur(m.grossMargin)} (${pct(m.markRate)})` : '—'}</td>
                  <td>
                    <Badge options={PUBLISH_STATUSES} value={r.status} />
                  </td>
                  <td>{formatShortDate(r.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>,
    { actions: <a href="/admin/prestations/nouvelle" class="btn btn-primary">Nouvelle prestation</a> },
  );
});

function ServiceForm({ r, c, action }: { r: Partial<ServiceRow>; c: Ctx; action: string }) {
  const s = c.get('settings');
  const opts = safeOptions(r.options ?? '[]');
  return (
    <form method="post" action={action}>
      <Csrf token={c.get('csrf')} />
      <div class="panel">
        <h2>Présentation</h2>
        <div class="form-grid">
          <F label="Nom" name="name" value={r.name} required max={120} />
          <F label="Identifiant d’URL (slug)" name="slug" value={r.slug} max={80} help="Laissez vide pour le générer depuis le nom." />
          <Sel label="Catégorie" name="category" value={r.category ?? 'graphisme'} options={CATEGORIES} />
          <Sel label="Statut" name="status" value={r.status ?? 'draft'} options={PUBLISH_STATUSES} />
          <F label="Ordre d’affichage" name="sort_order" type="number" value={r.sort_order ?? 100} />
          <Check label="Mise en avant" name="featured" checked={!!r.featured} />
          <TA label="Résumé (une phrase)" name="summary" value={r.summary} rows={2} max={300} />
          <TA label="Description" name="description" value={r.description} rows={3} max={3000} />
          <TA label="Ce qui est inclus (une ligne par élément)" name="includes" value={r.includes} rows={5} max={3000} />
          <TA label="Conditions" name="conditions" value={r.conditions} rows={2} max={3000} />
          <TA label="Exclusions (ce qui n’est pas inclus)" name="exclusions" value={r.exclusions} rows={2} max={3000} help="Soyez explicite : impression, livraison, hébergement…" />
          <F label="Délai estimatif" name="lead_time" value={r.lead_time} max={160} />
          <F label="Nombre de révisions incluses" name="revisions" type="number" value={r.revisions ?? ''} help="Vide si non applicable." />
        </div>
      </div>
      <div class="panel">
        <h2>Prix et coûts</h2>
        <div class="form-grid">
          <Sel label="Affichage du prix" name="price_mode" value={r.price_mode ?? 'fixed'} options={PRICE_MODES} />
          <Sel label="Facturation" name="billing" value={r.billing ?? 'once'} options={[['once', 'Unique'], ['monthly', 'Mensuelle']]} />
          <Money label="Prix de vente HT" name="price_ht" cents={r.price_ht} help={`TTC calculé avec la TVA configurée (${s.vatMode === 'franchise' ? 'franchise en base' : `${s.vatRate} %`}). Vide si « sur devis ».`} />
          <Money label="Coût de production estimé HT" name="cost_production" cents={r.cost_production ?? 0} />
          <Money label="Coût fournisseur HT" name="cost_supplier" cents={r.cost_supplier ?? 0} />
          <Money label="Transport HT" name="cost_shipping" cents={r.cost_shipping ?? 0} />
          <Money label="Frais externes HT" name="cost_external" cents={r.cost_external ?? 0} help="Licences, banque d’images, sous-traitance…" />
          <F label="Temps de travail estimé (heures)" name="work_hours" value={String(r.work_hours ?? 0).replace('.', ',')} help={s.internalHourlyCost ? `Valorisé à ${eur(s.internalHourlyCost)}/h dans les coûts directs.` : 'Non valorisé (coût horaire interne à 0 dans les paramètres).'} />
          <div class="live-margin" data-live-margin data-hourly={String(s.internalHourlyCost)}></div>
        </div>
      </div>
      <div class="panel">
        <h2>Options payantes</h2>
        <p class="small muted">Une option par ligne, au format « Nom de l’option | prix HT » (ex. « Page supplémentaire | 90 »).</p>
        <TA label="Options" name="options" value={opts.map((o) => `${o.name} | ${(o.price_ht / 100).toFixed(2).replace('.', ',')}`).join('\n')} rows={4} max={3000} />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  );
}

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/, 'Identifiant invalide.'),
  category: z.string().refine((v) => v in CATEGORY_LABELS, 'Catégorie invalide.'),
  status: z.string().refine((v) => isOneOf(PUBLISH_STATUSES, v)),
  price_mode: z.enum(['fixed', 'from', 'quote']),
  billing: z.enum(['once', 'monthly']),
});

async function saveService(c: Ctx, id: number | null) {
  const f = await readForm(c);
  const name = f.get('name');
  const base = { name, slug: f.get('slug') || slugify(name), category: f.get('category'), status: f.get('status'), price_mode: f.get('price_mode'), billing: f.get('billing') };
  const parsed = serviceSchema.safeParse(base);
  const price = f.money('price_ht');
  const errors: string[] = parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  if (base.price_mode !== 'quote' && (price == null || price <= 0)) errors.push('Indiquez un prix HT (ou choisissez « Sur devis »).');
  const options: { name: string; price_ht: number }[] = [];
  for (const line of lines(f.get('options'))) {
    const [n, p] = line.split('|').map((x) => x.trim());
    const cents = p ? Number(p.replace(/\s/g, '').replace(',', '.')) : NaN;
    if (!n || !Number.isFinite(cents) || cents < 0) errors.push(`Option invalide : « ${line} ».`);
    else options.push({ name: n.slice(0, 120), price_ht: Math.round(cents * 100) });
  }
  const hours = Number(f.get('work_hours').replace(',', '.') || '0');
  if (!Number.isFinite(hours) || hours < 0) errors.push('Temps de travail invalide.');
  const costs = ['cost_production', 'cost_supplier', 'cost_shipping', 'cost_external'].map((k) => f.money(k) ?? 0);
  if (costs.some((x) => x < 0)) errors.push('Les coûts ne peuvent pas être négatifs.');
  const { db } = c.get('deps');
  if (errors.length) {
    const r = id ? await db.get<ServiceRow>('SELECT * FROM services WHERE id = ?', [id]) : undefined;
    return page(c, id ? 'Modifier la prestation' : 'Nouvelle prestation', <ServiceForm r={{ ...r, ...base, price_ht: price } as Partial<ServiceRow>} c={c} action={id ? `/admin/prestations/${id}` : '/admin/prestations/nouvelle'} />, { error: errors.join(' '), status: 422 });
  }
  const now = new Date().toISOString();
  const values = [
    base.slug, base.category, name, f.get('summary').slice(0, 300), f.get('description').slice(0, 3000), base.price_mode, base.price_mode === 'quote' ? null : price, base.billing, f.get('lead_time').slice(0, 160),
    f.int('revisions'), JSON.stringify(options), f.get('includes').slice(0, 3000), f.get('conditions').slice(0, 3000), f.get('exclusions').slice(0, 3000), base.status, f.bool('featured') ? 1 : 0, f.int('sort_order') ?? 100,
    ...costs, hours,
  ];
  try {
    if (id) {
      await db.run(
        `UPDATE services SET slug=?, category=?, name=?, summary=?, description=?, price_mode=?, price_ht=?, billing=?, lead_time=?, revisions=?, options=?, includes=?, conditions=?, exclusions=?, status=?, featured=?, sort_order=?,
         cost_production=?, cost_supplier=?, cost_shipping=?, cost_external=?, work_hours=?, updated_at=? WHERE id=?`,
        [...values, now, id],
      );
      await audit(db, c.get('user')!.id, 'modification-prestation', 'service', id);
      return c.redirect(`/admin/prestations/${id}?ok=saved`, 303);
    }
    const r = await db.run(
      `INSERT INTO services (slug, category, name, summary, description, price_mode, price_ht, billing, lead_time, revisions, options, includes, conditions, exclusions, status, featured, sort_order,
       cost_production, cost_supplier, cost_shipping, cost_external, work_hours, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...values, now, now],
    );
    return c.redirect(`/admin/prestations/${r.lastId}?ok=created`, 303);
  } catch {
    return page(c, 'Erreur', <div class="panel"><p>Cet identifiant d’URL est déjà utilisé par une autre prestation.</p><a class="btn btn-outline" href="/admin/prestations">Retour</a></div>, { status: 409 });
  }
}

catalogRoutes.get('/prestations/nouvelle', (c) => page(c, 'Nouvelle prestation', <ServiceForm r={{}} c={c} action="/admin/prestations/nouvelle" />));
catalogRoutes.post('/prestations/nouvelle', (c) => saveService(c, null));
catalogRoutes.get('/prestations/:id', async (c) => {
  const r = await c.get('deps').db.get<ServiceRow>('SELECT * FROM services WHERE id = ?', [idParam(c)]);
  if (!r) return c.notFound();
  return page(c, r.name, <ServiceForm r={r} c={c} action={`/admin/prestations/${r.id}`} />, {
    actions: r.status === 'published' ? <a class="btn btn-outline" href={`/tarifs#${r.slug}`} target="_blank">Voir sur le site</a> : undefined,
  });
});
catalogRoutes.post('/prestations/:id', (c) => saveService(c, idParam(c)));

// ─── Produits imprimés ───

catalogRoutes.get('/impression/produits', async (c) => {
  const { db } = c.get('deps');
  const rows = await db.all<ProductRow & { nv: number; nok: number }>(
    "SELECT p.*, (SELECT COUNT(*) FROM supplier_price_variants v WHERE v.product_id = p.id) AS nv, (SELECT COUNT(*) FROM supplier_price_variants v WHERE v.product_id = p.id AND v.status = 'verifie') AS nok FROM print_products p ORDER BY sort_order, id",
  );
  return page(
    c,
    'Produits imprimés',
    <>
      <p class="muted">Les options proposées dans le configurateur public. Ne proposez que des options réellement disponibles chez le fournisseur.</p>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Produit</th>
              <th>Famille</th>
              <th>Fournisseur</th>
              <th>Options vérifiées le</th>
              <th class="num">Variantes (vérifiées)</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>{r.sort_order}</td>
                <td>
                  <a href={`/admin/impression/produits/${r.id}`}>{r.name}</a>
                </td>
                <td>{FAMILY_LABELS[r.family] ?? r.family}</td>
                <td>{r.supplier}</td>
                <td>{r.options_checked_at ? formatShortDate(r.options_checked_at) : <span class="badge badge-a_verifier">À confirmer</span>}</td>
                <td class="num">
                  <a href={`/admin/impression/tarifs?produit=${r.id}`}>
                    {r.nv} ({r.nok})
                  </a>
                </td>
                <td>
                  <Badge options={PUBLISH_STATUSES} value={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>,
    { actions: <a class="btn btn-primary" href="/admin/impression/produits/nouveau">Nouveau produit</a> },
  );
});

const VISUALS = ['flyer', 'cartes', 'cartes-premium', 'depliant', 'affiche', 'brochure', 'rollup', 'etiquettes', 'stickers', 'bache'].map((v) => [v, v] as const);

function ProductForm({ r, c, action }: { r: Partial<ProductRow>; c: Ctx; action: string }) {
  const o = parseOptions(r.options ?? '{}');
  return (
    <form method="post" action={action}>
      <Csrf token={c.get('csrf')} />
      <div class="panel">
        <div class="form-grid">
          <F label="Nom" name="name" value={r.name} required max={120} />
          <F label="Identifiant d’URL" name="slug" value={r.slug} max={80} help="Vide = généré depuis le nom." />
          <Sel label="Famille" name="family" value={r.family ?? 'flyers'} options={Object.entries(FAMILY_LABELS)} />
          <Sel label="Statut" name="status" value={r.status ?? 'draft'} options={PUBLISH_STATUSES} />
          <F label="Ordre" name="sort_order" type="number" value={r.sort_order ?? 100} />
          <Sel label="Visuel" name="visual" value={r.visual ?? 'flyer'} options={VISUALS} />
          <F label="Fournisseur" name="supplier" value={r.supplier ?? 'HelloPrint'} max={80} />
          <F label="URL de la fiche fournisseur (interne)" name="supplier_url" type="url" value={r.supplier_url} max={500} />
          <F label="Prestation de création associée (slug)" name="design_service_slug" value={r.design_service_slug ?? ''} max={80} />
          <F label="Options vérifiées chez le fournisseur le" name="options_checked_at" type="date" value={r.options_checked_at ?? ''} help="Vide = « options indicatives, à confirmer lors du devis » affiché au public." />
          <TA label="Résumé" name="summary" value={r.summary} rows={2} max={300} />
          <TA label="Description" name="description" value={r.description} rows={3} max={2000} />
        </div>
      </div>
      <div class="panel">
        <h2>Options du configurateur</h2>
        <p class="small muted">Une valeur par ligne. Laissez vide un attribut qui ne s’applique pas. Sans aucune quantité, le produit est présenté « sur mesure » (sans configurateur).</p>
        <div class="form-grid">
          {ATTRS.map((a) => (
            <div class="field">
              <label for={`opt-${a}`}>{ATTR_LABELS[a]}</label>
              <textarea id={`opt-${a}`} name={`opt_${a}`} rows={4}>
                {((o[a] as string[] | undefined) ?? []).join('\n')}
              </textarea>
              <input name={`label_${a}`} value={o.labels?.[a] ?? ''} placeholder="Libellé personnalisé (facultatif)" aria-label={`Libellé personnalisé pour ${ATTR_LABELS[a]}`} />
              <label class="small">
                <input type="checkbox" name="non_pricing" value={a} checked={o.nonPricing?.includes(a)} /> Sans effet sur le prix
              </label>
            </div>
          ))}
          <div class="field">
            <label for="opt-quantity">Quantités (une par ligne)</label>
            <textarea id="opt-quantity" name="opt_quantity" rows={4}>
              {o.quantity.join('\n')}
            </textarea>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  );
}

async function saveProduct(c: Ctx, id: number | null) {
  const f = await readForm(c);
  const name = f.get('name');
  const slug = f.get('slug') || slugify(name);
  const errors: string[] = [];
  if (name.length < 2) errors.push('Nom requis.');
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) errors.push('Identifiant d’URL invalide.');
  if (!(f.get('family') in FAMILY_LABELS)) errors.push('Famille invalide.');
  const options: PrintOptions = { quantity: [] };
  const labels: Partial<Record<Attr, string>> = {};
  for (const a of ATTRS) {
    const vals = [...new Set(lines(f.get(`opt_${a}`)).map((v) => v.slice(0, 120)))];
    if (vals.length) options[a] = vals;
    if (f.get(`label_${a}`)) labels[a] = f.get(`label_${a}`).slice(0, 60);
  }
  if (Object.keys(labels).length) options.labels = labels;
  const np = f.all('non_pricing').filter((a): a is Attr => (ATTRS as readonly string[]).includes(a));
  if (np.length) options.nonPricing = np;
  for (const q of lines(f.get('opt_quantity'))) {
    const n = Number(q.replace(/\s/g, ''));
    if (!Number.isInteger(n) || n <= 0) errors.push(`Quantité invalide : ${q}`);
    else options.quantity.push(n);
  }
  options.quantity = [...new Set(options.quantity)].sort((a, b) => a - b);
  const checked = f.get('options_checked_at');
  const url = f.get('supplier_url');
  if (url && !/^https?:\/\//.test(url)) errors.push('URL fournisseur invalide.');
  const status = isOneOf(PUBLISH_STATUSES, f.get('status')) ? f.get('status') : 'draft';
  const visual = VISUALS.some((v) => v[0] === f.get('visual')) ? f.get('visual') : 'flyer';
  if (errors.length) return page(c, 'Produit', <div class="panel"><p>{errors.join(' ')}</p><a class="btn btn-outline" href={id ? `/admin/impression/produits/${id}` : '/admin/impression/produits'}>Retour (les modifications non enregistrées sont perdues)</a></div>, { status: 422 });
  const { db } = c.get('deps');
  const now = new Date().toISOString();
  const vals = [slug, f.get('family'), name.slice(0, 120), f.get('summary').slice(0, 300), f.get('description').slice(0, 2000), f.get('supplier').slice(0, 80), url.slice(0, 500), JSON.stringify(options), isIsoDate(checked) ? checked : null, f.get('design_service_slug').slice(0, 80) || null, visual, status, f.int('sort_order') ?? 100];
  try {
    if (id) {
      await db.run('UPDATE print_products SET slug=?, family=?, name=?, summary=?, description=?, supplier=?, supplier_url=?, options=?, options_checked_at=?, design_service_slug=?, visual=?, status=?, sort_order=?, updated_at=? WHERE id=?', [...vals, now, id]);
      return c.redirect(`/admin/impression/produits/${id}?ok=saved`, 303);
    }
    const r = await db.run('INSERT INTO print_products (slug, family, name, summary, description, supplier, supplier_url, options, options_checked_at, design_service_slug, visual, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [...vals, now, now]);
    return c.redirect(`/admin/impression/produits/${r.lastId}?ok=created`, 303);
  } catch {
    return page(c, 'Erreur', <div class="panel"><p>Identifiant d’URL déjà utilisé.</p></div>, { status: 409 });
  }
}

catalogRoutes.get('/impression/produits/nouveau', (c) => page(c, 'Nouveau produit', <ProductForm r={{}} c={c} action="/admin/impression/produits/nouveau" />));
catalogRoutes.post('/impression/produits/nouveau', (c) => saveProduct(c, null));
catalogRoutes.get('/impression/produits/:id', async (c) => {
  const r = await c.get('deps').db.get<ProductRow>('SELECT * FROM print_products WHERE id = ?', [idParam(c)]);
  if (!r) return c.notFound();
  return page(c, r.name, <ProductForm r={r} c={c} action={`/admin/impression/produits/${r.id}`} />, {
    actions: (
      <>
        <a class="btn btn-outline" href={`/admin/impression/tarifs?produit=${r.id}`}>Prix fournisseurs</a>
        {r.supplier_url && <a class="btn btn-outline" href={r.supplier_url} target="_blank" rel="noopener noreferrer">Fiche fournisseur ↗</a>}
      </>
    ),
  });
});
catalogRoutes.post('/impression/produits/:id', (c) => saveProduct(c, idParam(c)));

// ─── Référentiel des prix fournisseurs (supplier_price_variants) ───

const VARIANT_FILTERS = [...VARIANT_STATUSES, ['cout_modifie', 'Coût modifié depuis validation'], ['sans_prix_vente', 'Sans prix de vente validé']] as const;

catalogRoutes.get('/impression/tarifs', async (c) => {
  const { db } = c.get('deps');
  const s = c.get('settings');
  const productId = Number(c.req.query('produit') ?? 0);
  const filter = c.req.query('statut') ?? '';
  const products = await db.all<ProductRow>('SELECT id, name, options FROM print_products ORDER BY sort_order');
  const all = await db.all<VariantFull>(`SELECT * FROM supplier_price_variants ${productId ? 'WHERE product_id = ?' : ''} ORDER BY product_id, format, paper, weight, finish, printing, extra, delivery, quantity`, productId ? [productId] : []);
  const now = new Date();
  const rows = all.filter((v) => {
    const st = effectiveStatus(v, now, s.supplierPriceValidityDays);
    if (filter === 'cout_modifie') return costChangedSinceValidation(v);
    if (filter === 'sans_prix_vente') return v.sale_validated_at == null;
    return isOneOf(VARIANT_STATUSES, filter) ? st === filter : true;
  });
  return page(
    c,
    'Prix fournisseurs',
    <>
      <div class="alert">
        Données <strong>confidentielles</strong> (jamais exposées au public). Un prix n’est affiché sur le site que si : la variante est <em>vérifiée</em> depuis moins de{' '}
        {s.supplierPriceValidityDays} jours (paramétrable), un prix de vente a été validé, et le coût n’a pas changé depuis cette validation. Ne saisissez que des prix
        réellement constatés (devis, compte fournisseur, fiche produit) : jamais d’estimation.
      </div>
      <form class="filters" method="get">
        <Sel label="Produit" name="produit" value={productId ? String(productId) : ''} options={products.map((p) => [String(p.id), p.name] as const)} empty="Tous" />
        <Sel label="Filtre" name="statut" value={filter} options={VARIANT_FILTERS} empty="Toutes les variantes" />
        <button class="btn btn-outline">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <Empty>Aucune variante pour ce filtre.</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Configuration</th>
                <th class="num">Qté</th>
                <th class="num">Coût fournisseur HT</th>
                <th class="num">Vente HT</th>
                <th class="num">Marge</th>
                <th>Statut</th>
                <th>Vérifié le</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const st = effectiveStatus(v, now, s.supplierPriceValidityDays);
                const cost = supplierTotal(v);
                const sale = saleTotal(v);
                const m = cost != null && sale != null ? computeMargin(sale, cost) : null;
                const changed = costChangedSinceValidation(v);
                return (
                  <tr class={changed || st === 'expire' ? 'row-warn' : ''}>
                    <td>{products.find((p) => p.id === v.product_id)?.name ?? v.product_name}</td>
                    <td class="small">
                      <a href={`/admin/impression/tarifs/${v.id}`}>{[v.format, v.orientation, v.paper, v.weight, v.finish, v.printing, v.extra, v.delivery].filter(Boolean).join(' · ') || '(défaut)'}</a>
                    </td>
                    <td class="num">{v.quantity.toLocaleString('fr-FR')}</td>
                    <td class="num">{cost == null ? 'Non renseigné' : eur(cost)}</td>
                    <td class="num">{sale == null ? '—' : eur(sale)}</td>
                    <td class="num">{m ? pct(m.markRate) : '—'}</td>
                    <td>
                      <Badge options={VARIANT_STATUSES} value={st} />
                      {changed && <div class="small"><strong>Coût modifié : décision requise</strong></div>}
                      {v.sale_validated_at == null && <div class="small muted">Non publié</div>}
                    </td>
                    <td>{formatShortDate(v.verified_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>,
    { actions: <a class="btn btn-primary" href={`/admin/impression/tarifs/nouveau${productId ? `?produit=${productId}` : ''}`}>Ajouter une variante</a>, wide: true },
  );
});

function VariantForm({ v, c, action, products }: { v: Partial<VariantFull>; c: Ctx; action: string; products: ProductRow[] }) {
  const product = products.find((p) => p.id === v.product_id);
  const o = product ? parseOptions(product.options) : undefined;
  return (
    <form method="post" action={action} class="panel">
      <Csrf token={c.get('csrf')} />
      <h2>Configuration exacte</h2>
      <p class="small muted">Les valeurs doivent correspondre exactement aux options du produit (sinon le configurateur ne trouvera pas cette variante). Laissez vide les attributs « sans effet sur le prix ».</p>
      <div class="form-grid">
        <Sel label="Produit" name="product_id" required value={v.product_id ? String(v.product_id) : ''} options={products.map((p) => [String(p.id), p.name] as const)} empty="Choisir…" />
        {ATTRS.map((a) => {
          const vals = (o?.[a] as string[] | undefined) ?? [];
          return vals.length && !o?.nonPricing?.includes(a) ? (
            <Sel label={attrLabel(a, o)} name={a} value={(v[a] as string) ?? ''} options={vals.map((x) => [x, x] as const)} empty="—" />
          ) : (
            <F label={attrLabel(a, o)} name={a} value={(v[a] as string) ?? ''} max={120} help={o ? 'Non utilisé par ce produit : laisser vide.' : undefined} />
          );
        })}
        {o?.quantity.length ? (
          <Sel label="Quantité" name="quantity" required value={v.quantity ? String(v.quantity) : ''} options={o.quantity.map((q) => [String(q), q.toLocaleString('fr-FR')] as const)} empty="Choisir…" />
        ) : (
          <F label="Quantité" name="quantity" type="number" required value={v.quantity ?? ''} />
        )}
      </div>
      <h2 style="margin-top:1.25rem">Coûts fournisseur (confidentiels)</h2>
      <div class="form-grid">
        <Money label="Prix fournisseur HT" name="supplier_price_ht" cents={v.supplier_price_ht} help="Vide = inconnu (affiché « sur devis »)." />
        <Money label="Frais de livraison HT" name="supplier_shipping_ht" cents={v.supplier_shipping_ht} />
        <Money label="Autres frais HT" name="supplier_other_fees_ht" cents={v.supplier_other_fees_ht} />
        <F label="Délai indicatif (jours ouvrés)" name="lead_time_days" type="number" value={v.lead_time_days ?? ''} />
        <F label="Source de la valeur" name="source" value={v.source} max={500} help="Ex. : devis n° …, compte fournisseur, fiche produit consultée le …" />
        <F label="URL de la fiche fournisseur" name="supplier_url" type="url" value={v.supplier_url ?? product?.supplier_url ?? ''} max={500} />
        <TA label="Notes internes" name="notes" value={v.notes} rows={2} max={2000} />
      </div>
      <h2 style="margin-top:1.25rem">Prix de vente au client</h2>
      <p class="small muted">Saisie libre : enregistrer ne publie rien. La publication nécessite l’action « Valider le prix de vente ».</p>
      <div class="form-grid">
        <Money label="Impression — vente HT" name="sale_print_ht" cents={v.sale_print_ht} />
        <Money label="Livraison — vente HT" name="sale_shipping_ht" cents={v.sale_shipping_ht} />
        <Money label="Autres frais — vente HT" name="sale_other_ht" cents={v.sale_other_ht} />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  );
}

catalogRoutes.get('/impression/tarifs/nouveau', async (c) => {
  const products = await c.get('deps').db.all<ProductRow>('SELECT * FROM print_products ORDER BY sort_order');
  const pid = Number(c.req.query('produit') ?? 0);
  return page(c, 'Nouvelle variante de prix', <VariantForm v={{ product_id: pid || undefined }} c={c} action="/admin/impression/tarifs/nouveau" products={products} />);
});

async function saveVariant(c: Ctx, id: number | null) {
  const f = await readForm(c);
  const { db } = c.get('deps');
  const product = await db.get<ProductRow>('SELECT * FROM print_products WHERE id = ?', [f.int('product_id') ?? 0]);
  const errors: string[] = [];
  if (!product) errors.push('Produit requis.');
  const qty = f.int('quantity');
  if (!qty || qty <= 0) errors.push('Quantité invalide.');
  const money = ['supplier_price_ht', 'supplier_shipping_ht', 'supplier_other_fees_ht', 'sale_print_ht', 'sale_shipping_ht', 'sale_other_ht'].map((k) => (f.get(k) ? f.money(k) : null));
  if (money.some((m, i) => (f.get(['supplier_price_ht', 'supplier_shipping_ht', 'supplier_other_fees_ht', 'sale_print_ht', 'sale_shipping_ht', 'sale_other_ht'][i]!) && m == null) || (m != null && m < 0))) errors.push('Montant invalide.');
  const url = f.get('supplier_url');
  if (url && !/^https?:\/\//.test(url)) errors.push('URL invalide.');
  if (errors.length) return page(c, 'Variante', <div class="panel"><p>{errors.join(' ')}</p><a class="btn btn-outline" href={id ? `/admin/impression/tarifs/${id}` : '/admin/impression/tarifs/nouveau'}>Retour</a></div>, { status: 422 });
  const o = parseOptions(product!.options);
  const attrs = ATTRS.map((a) => (o.nonPricing?.includes(a) ? '' : f.get(a).slice(0, 120)));
  const now = new Date().toISOString();
  try {
    if (id) {
      const before = await db.get<VariantFull>('SELECT * FROM supplier_price_variants WHERE id = ?', [id]);
      if (!before) return c.notFound();
      const costChanged = [before.supplier_price_ht, before.supplier_shipping_ht, before.supplier_other_fees_ht].join('|') !== money.slice(0, 3).join('|');
      const saleChanged = [before.sale_print_ht, before.sale_shipping_ht, before.sale_other_ht].join('|') !== money.slice(3).join('|');
      await db.run(
        `UPDATE supplier_price_variants SET product_id=?, product_name=?, supplier=?, supplier_url=?, format=?, orientation=?, paper=?, weight=?, finish=?, printing=?, extra=?, delivery=?, quantity=?,
         supplier_price_ht=?, supplier_shipping_ht=?, supplier_other_fees_ht=?, sale_print_ht=?, sale_shipping_ht=?, sale_other_ht=?, lead_time_days=?, source=?, notes=?,
         status = CASE WHEN ? THEN 'a_verifier' ELSE status END,
         sale_validated_at = CASE WHEN ? THEN NULL ELSE sale_validated_at END,
         updated_at=? WHERE id=?`,
        [product!.id, product!.name, product!.supplier, url, ...attrs, qty, ...money, f.int('lead_time_days'), f.get('source').slice(0, 500), f.get('notes').slice(0, 2000), costChanged ? 1 : 0, saleChanged ? 1 : 0, now, id],
      );
      // Un coût modifié repasse la variante « à vérifier » ; le prix de vente public n'est jamais modifié automatiquement.
      return c.redirect(`/admin/impression/tarifs/${id}?ok=saved`, 303);
    }
    const r = await db.run(
      `INSERT INTO supplier_price_variants (product_id, product_name, supplier, supplier_url, format, orientation, paper, weight, finish, printing, extra, delivery, quantity,
       supplier_price_ht, supplier_shipping_ht, supplier_other_fees_ht, sale_print_ht, sale_shipping_ht, sale_other_ht, lead_time_days, source, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'a_verifier', ?, ?)`,
      [product!.id, product!.name, product!.supplier, url, ...attrs, qty, ...money, f.int('lead_time_days'), f.get('source').slice(0, 500), f.get('notes').slice(0, 2000), now, now],
    );
    return c.redirect(`/admin/impression/tarifs/${r.lastId}?ok=created`, 303);
  } catch {
    return page(c, 'Doublon', <div class="panel"><p>Une variante identique (mêmes attributs et quantité) existe déjà pour ce produit.</p><a class="btn btn-outline" href="/admin/impression/tarifs">Retour</a></div>, { status: 409 });
  }
}

catalogRoutes.post('/impression/tarifs/nouveau', (c) => saveVariant(c, null));

catalogRoutes.get('/impression/tarifs/:id', async (c) => {
  const { db } = c.get('deps');
  const s = c.get('settings');
  const v = await db.get<VariantFull>('SELECT * FROM supplier_price_variants WHERE id = ?', [idParam(c)]);
  if (!v) return c.notFound();
  const products = await db.all<ProductRow>('SELECT * FROM print_products ORDER BY sort_order');
  const csrf = c.get('csrf');
  const now = new Date();
  const st = effectiveStatus(v, now, s.supplierPriceValidityDays);
  const cost = supplierTotal(v);
  const sale = saleTotal(v);
  const m = cost != null && sale != null ? computeMargin(sale, cost) : null;
  const changed = costChangedSinceValidation(v);
  return page(
    c,
    `Variante de prix n° ${v.id}`,
    <div class="cols cols-3">
      <VariantForm v={v} c={c} action={`/admin/impression/tarifs/${v.id}`} products={products} />
      <div>
        <div class="panel">
          <h2>Vérification</h2>
          <p>
            <Badge options={VARIANT_STATUSES} value={st} /> {v.verified_at ? `le ${formatDate(v.verified_at)}` : ''}
          </p>
          {v.source && <p class="small">Source : {v.source}</p>}
          <p class="small muted">Marquez « vérifié » uniquement après avoir constaté ce prix pour cette configuration exacte chez le fournisseur.</p>
          <form method="post" action={`/admin/impression/tarifs/${v.id}/verifier`} class="form-grid" data-confirm="Confirmez-vous avoir vérifié ce prix chez le fournisseur, pour cette configuration exacte ?">
            <Csrf token={csrf} />
            <F label="Date de vérification" name="verified_at" type="date" value={todayParis()} required />
            <F label="Source (preuve)" name="source" value={v.source} required max={500} />
            <div class="form-actions">
              <button class="btn btn-primary btn-sm" disabled={v.supplier_price_ht == null}>Marquer comme vérifié</button>
            </div>
          </form>
          {v.supplier_price_ht == null && <p class="small">Renseignez d’abord le prix fournisseur.</p>}
          {st !== 'expire' && <ActionButton action={`/admin/impression/tarifs/${v.id}/expirer`} csrf={csrf} label="Marquer comme expiré" />}
        </div>
        <div class="panel">
          <h2>Prix de vente</h2>
          <dl class="kv">
            <dt>Coût fournisseur total HT</dt>
            <dd>{eur(cost)}</dd>
            <dt>Prix suggéré (+{s.printMarkupPercent} %)</dt>
            <dd>{cost == null ? '—' : `${eur(suggestedSalePrice(cost, s.printMarkupPercent))} (suggestion, non appliquée)`}</dd>
            <dt>Vente totale HT</dt>
            <dd>{eur(sale)}</dd>
            <dt>Marge brute</dt>
            <dd>{m ? eur(m.grossMargin) : '—'}</dd>
            <dt>Taux de marge</dt>
            <dd>{m ? pct(m.marginRate) : '—'}</dd>
            <dt>Taux de marque</dt>
            <dd>{m ? pct(m.markRate) : '—'}</dd>
            <dt>Publié</dt>
            <dd>{v.sale_validated_at ? `Validé le ${formatDate(v.sale_validated_at)} (coût de référence ${eur(v.cost_at_validation)})` : 'Non'}</dd>
          </dl>
          {changed && (
            <div class="alert alert-warning" style="margin-top:.75rem">
              Le coût fournisseur ({eur(cost)}) a changé depuis la validation ({eur(v.cost_at_validation)}). Le prix public n’a pas été modifié et n’est plus affiché :
              ajustez le prix de vente si besoin, puis validez-le à nouveau.
            </div>
          )}
          <div class="form-actions">
            <ActionButton
              action={`/admin/impression/tarifs/${v.id}/valider`}
              csrf={csrf}
              label="Valider le prix de vente"
              cls="btn-primary"
              confirm="Publier ce prix de vente sur le site (si la variante est vérifiée) ?"
            />
            {v.sale_validated_at && <ActionButton action={`/admin/impression/tarifs/${v.id}/depublier`} csrf={csrf} label="Retirer du site" />}
            <ActionButton action={`/admin/impression/tarifs/${v.id}/supprimer`} csrf={csrf} label="Supprimer" cls="btn-danger" confirm="Supprimer cette variante ?" />
          </div>
        </div>
      </div>
    </div>,
    { wide: true },
  );
});

catalogRoutes.post('/impression/tarifs/:id', (c) => saveVariant(c, idParam(c)));

catalogRoutes.post('/impression/tarifs/:id/verifier', async (c) => {
  const f = await readForm(c);
  const d = f.get('verified_at');
  const src = f.get('source');
  if (!isIsoDate(d) || d > todayParis() || !src) return page(c, 'Vérification refusée', <div class="panel"><p>Date (non future) et source obligatoires.</p><a class="btn btn-outline" href={`/admin/impression/tarifs/${idParam(c)}`}>Retour</a></div>, { status: 422 });
  await c.get('deps').db.run("UPDATE supplier_price_variants SET status = 'verifie', verified_at = ?, source = ?, updated_at = ? WHERE id = ? AND supplier_price_ht IS NOT NULL", [`${d}T12:00:00.000Z`, src.slice(0, 500), new Date().toISOString(), idParam(c)]);
  await audit(c.get('deps').db, c.get('user')!.id, 'verification-prix', 'variant', idParam(c));
  return c.redirect(`/admin/impression/tarifs/${idParam(c)}?ok=verified`, 303);
});

catalogRoutes.post('/impression/tarifs/:id/expirer', async (c) => {
  await c.get('deps').db.run("UPDATE supplier_price_variants SET status = 'expire', updated_at = ? WHERE id = ?", [new Date().toISOString(), idParam(c)]);
  return c.redirect(`/admin/impression/tarifs/${idParam(c)}?ok=status`, 303);
});

catalogRoutes.post('/impression/tarifs/:id/valider', async (c) => {
  const { db } = c.get('deps');
  const v = await db.get<VariantFull>('SELECT * FROM supplier_price_variants WHERE id = ?', [idParam(c)]);
  if (!v) return c.notFound();
  const fail = (m: string) => page(c, 'Validation impossible', <div class="panel"><p>{m}</p><a class="btn btn-outline" href={`/admin/impression/tarifs/${v.id}`}>Retour</a></div>, { status: 422 });
  if (effectiveStatus(v, new Date(), c.get('settings').supplierPriceValidityDays) !== 'verifie') return fail('La variante doit d’abord être vérifiée (et non expirée).');
  if (v.sale_print_ht == null || v.sale_print_ht <= 0) return fail('Renseignez le prix de vente de l’impression.');
  const cost = supplierTotal(v);
  if (cost == null) return fail('Coût fournisseur inconnu.');
  await db.run('UPDATE supplier_price_variants SET sale_validated_at = ?, cost_at_validation = ?, updated_at = ? WHERE id = ?', [new Date().toISOString(), cost, new Date().toISOString(), v.id]);
  await audit(db, c.get('user')!.id, 'validation-prix-vente', 'variant', v.id);
  return c.redirect(`/admin/impression/tarifs/${v.id}?ok=validated`, 303);
});

catalogRoutes.post('/impression/tarifs/:id/depublier', async (c) => {
  await c.get('deps').db.run('UPDATE supplier_price_variants SET sale_validated_at = NULL, cost_at_validation = NULL, updated_at = ? WHERE id = ?', [new Date().toISOString(), idParam(c)]);
  return c.redirect(`/admin/impression/tarifs/${idParam(c)}?ok=status`, 303);
});

catalogRoutes.post('/impression/tarifs/:id/supprimer', async (c) => {
  await c.get('deps').db.run('DELETE FROM supplier_price_variants WHERE id = ?', [idParam(c)]);
  return c.redirect('/admin/impression/tarifs?ok=deleted', 303);
});

// ─── Marges ───

catalogRoutes.get('/marges', async (c) => {
  const { db } = c.get('deps');
  const s = c.get('settings');
  const services = await db.all<ServiceRow>("SELECT * FROM services WHERE status <> 'disabled' ORDER BY category, sort_order");
  const variants = await db.all<VariantFull & { pname: string }>('SELECT v.*, p.name AS pname FROM supplier_price_variants v JOIN print_products p ON p.id = v.product_id WHERE v.supplier_price_ht IS NOT NULL AND v.sale_print_ht IS NOT NULL ORDER BY p.sort_order, v.quantity');
  return page(
    c,
    'Marges',
    <>
      <div class="panel">
        <h2>Définitions</h2>
        <ul class="small">
          <li>
            <strong>Marge brute estimée</strong> = prix de vente HT − coûts directs HT (production, fournisseur, transport, frais externes
            {s.internalHourlyCost ? `, temps de travail valorisé à ${eur(s.internalHourlyCost)}/h` : ''}).
          </li>
          <li>
            <strong>Taux de marge</strong> = marge brute ÷ coûts directs × 100 (si coûts &gt; 0).
          </li>
          <li>
            <strong>Taux de marque</strong> = marge brute ÷ prix de vente HT × 100 (si prix &gt; 0).
          </li>
          <li>Les frais généraux, cotisations sociales et impôts ne sont pas inclus.</li>
        </ul>
      </div>
      <h2>Prestations</h2>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Prestation</th>
              <th class="num">Prix HT</th>
              <th class="num">Coûts directs</th>
              <th class="num">Marge brute</th>
              <th class="num">Taux de marge</th>
              <th class="num">Taux de marque</th>
              <th>Mise à jour</th>
            </tr>
          </thead>
          <tbody>
            {services.map((r) => {
              const costs = { production: r.cost_production, supplier: r.cost_supplier, shipping: r.cost_shipping, external: r.cost_external, labour: labourCost(r.work_hours, s.internalHourlyCost) };
              const m = r.price_ht != null && r.price_mode !== 'quote' ? computeMargin(r.price_ht, costs) : null;
              return (
                <tr>
                  <td>
                    <a href={`/admin/prestations/${r.id}`}>{r.name}</a>
                  </td>
                  <td class="num">{r.price_mode === 'quote' ? 'Sur devis' : eur(r.price_ht)}</td>
                  <td class="num">{eur(m?.directCosts ?? null)}</td>
                  <td class="num">{eur(m?.grossMargin ?? null)}</td>
                  <td class="num">{pct(m?.marginRate ?? null)}</td>
                  <td class="num">{pct(m?.markRate ?? null)}</td>
                  <td>{formatShortDate(r.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h2 style="margin-top:1.5rem">Impressions (variantes avec prix de vente)</h2>
      {variants.length === 0 ? (
        <Empty>Aucune variante n’a encore à la fois un coût fournisseur et un prix de vente.</Empty>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Variante</th>
                <th class="num">Vente HT</th>
                <th class="num">Coût HT</th>
                <th class="num">Marge brute</th>
                <th class="num">Taux de marge</th>
                <th class="num">Taux de marque</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const m = computeMargin(saleTotal(v)!, supplierTotal(v)!);
                return (
                  <tr class={costChangedSinceValidation(v) ? 'row-warn' : ''}>
                    <td class="small">
                      <a href={`/admin/impression/tarifs/${v.id}`}>
                        {v.pname} · {[v.format, v.paper, v.weight, v.finish, v.printing, v.extra].filter(Boolean).join(' · ')} · {v.quantity} ex.
                      </a>
                    </td>
                    <td class="num">{eur(saleTotal(v))}</td>
                    <td class="num">{eur(supplierTotal(v))}</td>
                    <td class="num">{eur(m.grossMargin)}</td>
                    <td class="num">{pct(m.marginRate)}</td>
                    <td class="num">{pct(m.markRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>,
    { wide: true },
  );
});
