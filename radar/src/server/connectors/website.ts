/**
 * Sites internet publics des entreprises : lecture de la page d'accueil uniquement, robots.txt respecté,
 * 1 requête par seconde. Détecte des signaux PUBLICS et EXPLICITES (recherche de repreneur, affaire à céder,
 * départ à la retraite annoncé par l'entreprise elle-même…) en conservant l'extrait et l'URL comme preuve.
 * Aucune page protégée, aucun formulaire, aucun contournement.
 */
import { detectTextSignals } from '../domain/opportunities';
import { recordSource } from '../services/companies';
import { raiseAlert } from '../services/alerts';
import { emptyChunk, type ChunkResult, type Connector } from './types';
import type { FetchLike } from '../lib/http';
import { USER_AGENT } from '../lib/http';

/** Refuse les adresses non publiques (protection SSRF lorsque l'outil tourne sur un serveur). */
export function safePublicUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return null; // pas d'adresse IP littérale
  if (u.port && !['80', '443'].includes(u.port)) return null;
  return u;
}

/** Interprétation minimale de robots.txt (groupe « * » et groupe propre à l'outil). */
export function robotsAllows(robots: string, path: string, agent = 'normandiebusinessradar'): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1]!.toLowerCase();
    const v = m[2]!.trim();
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
    } else if ((k === 'allow' || k === 'disallow') && cur) {
      lastWasAgent = false;
      if (v) cur.rules.push({ allow: k === 'allow', path: v });
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
  const group = mine ?? groups.find((g) => g.agents.includes('*'));
  if (!group) return true;
  let best: { allow: boolean; path: string } | null = null;
  for (const r of group.rules) {
    const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    if (new RegExp(`^${pattern}`).test(path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return best ? best.allow : true;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Requête GET suivant au plus 3 redirections, chacune revalidée (pas de redirection vers une adresse non publique). */
async function getPublic(fetchFn: FetchLike, start: URL, accept: string): Promise<Response> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetchFn(url.href, { headers: { 'User-Agent': USER_AGENT, Accept: accept }, redirect: 'manual' });
    if (res.status < 300 || res.status >= 400) return res;
    const loc = res.headers.get('location');
    const next = loc ? safePublicUrl(new URL(loc, url).href) : null;
    if (!next) throw new Error('Redirection vers une adresse refusée');
    url = next;
  }
  throw new Error('Trop de redirections');
}

export async function fetchPublicPage(fetchFn: FetchLike, raw: string): Promise<{ ok: boolean; url: string; text?: string; reason?: string }> {
  const u = safePublicUrl(raw);
  if (!u) return { ok: false, url: raw, reason: 'Adresse non publique ou invalide' };
  try {
    const robots = await getPublic(fetchFn, new URL('/robots.txt', u.origin), 'text/plain').catch(() => null);
    if (robots?.ok && !robotsAllows(await robots.text(), u.pathname || '/')) return { ok: false, url: u.href, reason: 'Lecture refusée par robots.txt' };
    const res = await getPublic(fetchFn, u, 'text/html,text/plain');
    if (!res.ok) return { ok: false, url: u.href, reason: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html') && !type.includes('text')) return { ok: false, url: u.href, reason: 'Contenu non HTML' };
    const html = (await res.text()).slice(0, 500_000);
    return { ok: true, url: res.url || u.href, text: htmlToText(html) };
  } catch (e) {
    return { ok: false, url: u.href, reason: (e as Error).message };
  }
}

export const website: Connector = {
  id: 'website',
  label: 'Sites internet publics des entreprises',
  description: "Lecture de la page d'accueil des sites connus : présence en ligne et signaux de transmission publiés par l'entreprise elle-même.",
  official: false,
  requiredSecrets: [],
  defaultEnabled: true,
  provides: ['Site joignable ou non', 'Signaux explicites de cession / transmission avec extrait et lien'],
  license: "Lecture ponctuelle de pages publiques, robots.txt respecté ; seuls de courts extraits sont conservés comme preuve",
  termsUrl: 'https://www.cnil.fr/fr/la-reutilisation-des-donnees-publiquement-accessibles-en-ligne-des-fins-de-demarchage-commercial',
  docsUrl: '',
  quotas: "1 requête par seconde ; nombre de sites par étape configurable",
  limitations: ["Seule la page d'accueil est lue.", "Seules des expressions explicites sont détectées : l'absence de signal ne signifie rien."],
  async planTasks() {
    return ['homepages'];
  },
  async runChunk(ctx): Promise<ChunkResult> {
    const limit = ctx.settings.sync.websiteChecksPerTick;
    const cutoff = new Date(ctx.now().getTime() - 30 * 86400_000).toISOString();
    const rows = await ctx.db.all<{ id: number; siren: string; name: string; website: string }>(
      `SELECT id, siren, name, website FROM companies c WHERE website IS NOT NULL AND website != ''
       AND NOT EXISTS (SELECT 1 FROM source_records s WHERE s.source_id = 'website' AND s.external_id = c.siren AND s.collected_at > ?)
       ORDER BY id LIMIT ?`,
      [cutoff, limit],
    );
    const out: ChunkResult = { ...emptyChunk(null, rows.length < limit) };
    const at = ctx.now().toISOString();
    for (const r of rows) {
      const page = await fetchPublicPage(ctx.fetch, r.website);
      out.fetched++;
      const signals = page.ok && page.text ? detectTextSignals(page.text) : [];
      await recordSource(ctx.db, { sourceId: 'website', externalId: r.siren, entityType: 'page', companyId: r.id, siren: r.siren, url: page.url, payload: { ok: page.ok, reason: page.reason ?? null, signals } });
      if (!page.ok) {
        out.errors.push(`${r.name} (${r.website}) : ${page.reason}`);
        continue;
      }
      for (const s of signals) {
        const res = await ctx.db.run(
          `INSERT INTO transmission_signals (company_id, signal_type, strength, evidence, evidence_url, source_id, detected_at) VALUES (?, ?, ?, ?, ?, 'website', ?)
           ON CONFLICT(company_id, signal_type, source_id) DO UPDATE SET evidence = excluded.evidence, evidence_url = excluded.evidence_url`,
          [r.id, s.type, s.strength, s.excerpt, page.url, at],
        );
        if (res.changes) {
          out.created++;
          await raiseAlert(ctx.db, { type: 'nouveau_signal', severity: 'attention', companyId: r.id, title: `${s.label} : ${r.name}`, message: `« ${s.excerpt} » — ${page.url}`, dedupeKey: `sig:${r.id}:${s.type}:website` });
        }
      }
      await ctx.db.run('INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', [r.id, at]);
    }
    return out;
  },
};
