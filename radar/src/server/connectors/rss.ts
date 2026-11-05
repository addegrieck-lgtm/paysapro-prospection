/**
 * Flux RSS / Atom configurables (annonces de cession, publications professionnelles, annonces légales…).
 * Seuls les flux publiés pour être syndiqués sont lus ; aucune page web n'est aspirée.
 * Une entrée est retenue si elle concerne un département suivi (code postal, nom du département ou d'une commune
 * connue) ET contient un vocabulaire de cession ou de transmission.
 */
import { detectTextSignals } from '../domain/opportunities';
import { classifySector } from '../domain/sectors';
import { sirenFromText, upsertCompany } from '../services/companies';
import { raiseAlert } from '../services/alerts';
import { htmlToText, safePublicUrl } from './website';
import { emptyChunk, type ChunkResult, type Connector } from './types';

export interface FeedItem {
  id: string;
  title: string;
  link: string | null;
  description: string;
  published: string | null;
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1]!.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim() : null;
};

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const atomLink = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? null;
    const link = tag(b, 'link') || atomLink;
    const title = htmlToText(tag(b, 'title') ?? '');
    const description = htmlToText(tag(b, 'description') ?? tag(b, 'summary') ?? tag(b, 'content') ?? '');
    const date = tag(b, 'pubDate') ?? tag(b, 'published') ?? tag(b, 'updated') ?? tag(b, 'dc:date');
    const parsed = date ? new Date(date) : null;
    const id = tag(b, 'guid') ?? tag(b, 'id') ?? link ?? title;
    if (!title && !description) continue;
    items.push({ id: id.slice(0, 500), title, link, description, published: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null });
  }
  return items;
}

const DEP_NAMES: Record<string, string[]> = { '76': ['seine-maritime', 'seine maritime'], '27': ['eure'], '14': ['calvados'], '50': ['manche'], '61': ['orne'] };
const CESSION = /\b(c[ée]der|cession|[àa] reprendre|reprise d['’]entreprise|fonds de commerce|transmission|repreneur|vend(?:s|re) (?:mon|notre|son) (?:entreprise|affaire|fonds))\b/i;

export function guessListingKind(text: string): string {
  const t = text.toLowerCase();
  if (/fonds de commerce|droit au bail/.test(t)) return 'fonds_de_commerce';
  if (/titres|parts sociales|actions/.test(t)) return 'titres';
  if (/client[eè]le|portefeuille/.test(t)) return 'clientele';
  if (/mat[ée]riel|actifs|[ée]quipements/.test(t)) return 'actifs';
  if (/soci[ée]t[ée]|entreprise/.test(t)) return 'societe';
  return 'autre';
}

export function relevantToDepartments(text: string, departments: string[], communeNames: string[]): boolean {
  const t = text.toLowerCase();
  for (const d of departments) {
    if (new RegExp(`\\b${d}\\d{3}\\b`).test(t)) return true;
    if ((DEP_NAMES[d] ?? []).some((n) => t.includes(n))) return true;
    if (new RegExp(`\\(${d}\\)`).test(t)) return true;
  }
  return communeNames.some((c) => c.length > 3 && new RegExp(`\\b${c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t));
}

export const rss: Connector = {
  id: 'rss',
  label: 'Flux RSS / Atom (annonces et publications)',
  description: "Flux d'annonces de cession ou de publications professionnelles que vous choisissez (CCI, CMA, presse économique, sites d'annonces proposant un flux).",
  official: false,
  requiredSecrets: [],
  defaultEnabled: false,
  needsConfig: true,
  provides: ['Annonces de cession (entreprise à vendre)', 'Signaux de transmission publiés dans la presse professionnelle'],
  license: 'Selon les conditions de chaque éditeur de flux (vérifier avant ajout) ; seuls le titre, le résumé et le lien sont conservés',
  termsUrl: '',
  docsUrl: '',
  quotas: 'Un appel par flux et par veille',
  limitations: ["Les plateformes d'annonces sans flux ni API (ex. Bpifrance Transmission, Transentreprise) ne sont pas aspirées : utiliser l'import manuel des annonces.", 'Le prix et le CA ne sont pas extraits automatiquement des textes libres.'],
  async planTasks(ctx) {
    const feeds = (ctx.config.feeds as { url: string; label?: string }[] | undefined) ?? [];
    return feeds.map((_, i) => `feed:${i}`);
  },
  async runChunk(ctx, task): Promise<ChunkResult> {
    const feeds = (ctx.config.feeds as { url: string; label?: string }[] | undefined) ?? [];
    const feed = feeds[Number(task.replace('feed:', ''))];
    if (!feed) return { ...emptyChunk(), errors: [`Flux introuvable : ${task}`] };
    const u = safePublicUrl(feed.url);
    if (!u) return { ...emptyChunk(), errors: [`Adresse de flux refusée : ${feed.url}`] };
    const http = ctx.http({ minIntervalMs: 1000 });
    const res = await http.request(u.href, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
    if (!res.ok) throw new Error(`Flux ${feed.label ?? u.hostname} : HTTP ${res.status}`);
    const items = parseFeed(await res.text());
    const communes = (await ctx.db.all<{ name: string }>(`SELECT name FROM communes WHERE department IN (${ctx.departments.map(() => '?').join(',')})`, ctx.departments)).map((c) => c.name);
    const at = ctx.now().toISOString();
    const out: ChunkResult = { ...emptyChunk(), fetched: items.length };
    for (const it of items) {
      const text = `${it.title} ${it.description}`;
      if (!CESSION.test(text) || !relevantToDepartments(text, ctx.departments, communes)) continue;
      const siren = sirenFromText(text);
      let companyId: number | null = null;
      if (siren) companyId = (await upsertCompany(ctx.db, { siren }, { sourceId: 'rss', status: 'declarative', confidence: 40, collectedAt: at, url: it.link }))?.id ?? null;
      const r = await ctx.db.run(
        `INSERT INTO sale_listings (company_id, source_id, external_id, kind, status, is_offer, title, description, department, sector_id, url, published_at, collected_at)
         VALUES (?, 'rss', ?, ?, 'active', 1, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_id, external_id) DO UPDATE SET title = excluded.title, description = excluded.description, collected_at = excluded.collected_at`,
        [companyId, `${u.hostname}:${it.id}`, guessListingKind(text), it.title.slice(0, 300), it.description.slice(0, 2000), ctx.departments[0] ?? null, classifySector(null, text).sectorId, it.link, it.published, at],
      );
      if (r.changes) {
        out.created++;
        await raiseAlert(ctx.db, { type: 'nouvelle_vente', severity: 'positif', companyId, title: `Annonce de cession : ${it.title.slice(0, 120)}`, message: `${feed.label ?? u.hostname}${it.link ? ` — ${it.link}` : ''}`, dedupeKey: `rss:${u.hostname}:${it.id}` });
      }
      if (companyId) {
        for (const s of detectTextSignals(text)) {
          await ctx.db.run(
            `INSERT OR IGNORE INTO transmission_signals (company_id, signal_type, strength, evidence, evidence_url, source_id, detected_at) VALUES (?, ?, ?, ?, ?, 'rss', ?)`,
            [companyId, s.type, s.strength, s.excerpt, it.link, at],
          );
        }
        await ctx.db.run('INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', [companyId, at]);
      }
    }
    return out;
  },
};
