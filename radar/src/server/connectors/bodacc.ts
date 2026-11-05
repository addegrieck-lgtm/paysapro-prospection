/**
 * BODACC — Bulletin officiel des annonces civiles et commerciales (DILA), jeu de données ouvert
 * « annonces-commerciales » sur la plateforme Opendatasoft de la DILA. Gratuit, sans clé.
 *
 * Tâches (par famille d'annonces) :
 *  - collective : procédures collectives (sauvegarde, redressement, liquidation, plans, clôtures…)
 *  - vente      : ventes et cessions de fonds (cessions RÉALISÉES : jamais présentées comme « à vendre »)
 *  - radiation  : radiations du RCS
 *
 * Synchronisation incrémentale par date de parution, avec une marge de 7 jours pour absorber les publications
 * tardives ; la déduplication repose sur l'identifiant de l'annonce.
 */
import type { Db, Statement } from '../db/types';
import { PROC_STATUS_LABELS, PROC_TYPE_LABELS } from '../domain/proceedings';
import { eventStmt, recordSource, sirenFromText, upsertCompany, type Provenance } from '../services/companies';
import { refreshProceedings } from '../services/proceedings';
import { raiseAlert } from '../services/alerts';
import { emptyChunk, type ChunkResult, type Connector, type ConnectorContext } from './types';

export const BODACC_URL = 'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records';
const PAGE = 100;
const FAMILIES = { collective: 'collective', vente: 'vente', radiation: 'radiation' } as const;
type Family = keyof typeof FAMILIES;

export interface BodaccRecord {
  id: string;
  dateparution: string;
  parution?: string | null;
  numeroannonce?: number | string | null;
  typeavis?: string | null;
  typeavis_lib?: string | null;
  familleavis: string;
  familleavis_lib?: string | null;
  numerodepartement?: string | null;
  tribunal?: string | null;
  commercant?: string | null;
  ville?: string | null;
  cp?: string | null;
  registre?: string[] | string | null;
  listepersonnes?: unknown;
  listeetablissements?: unknown;
  jugement?: unknown;
  acte?: unknown;
  listeprecedentproprietaire?: unknown;
  parutionavisprecedent?: unknown;
  url_complete?: string | null;
}

/** Les champs structurés sont publiés sous forme de texte JSON : décodage tolérant. */
export function parseMaybeJson<T = Record<string, unknown>>(v: unknown): T | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export function sirenOf(rec: BodaccRecord): string | null {
  const reg = Array.isArray(rec.registre) ? rec.registre.join(',') : rec.registre;
  return sirenFromText(reg ?? null);
}

function personName(p: Record<string, unknown> | null | undefined): string | null {
  if (!p) return null;
  const d = p.denomination ?? p.nomCommercial;
  if (typeof d === 'string' && d.trim()) return d.trim();
  const nom = typeof p.nom === 'string' ? p.nom : '';
  const prenom = typeof p.prenom === 'string' ? p.prenom : '';
  return `${nom} ${prenom}`.trim() || null;
}

function firstPerson(list: unknown): Record<string, unknown> | null {
  const l = parseMaybeJson<Record<string, unknown>>(list);
  if (!l) return null;
  const p = (l as { personne?: unknown }).personne ?? l;
  return (Array.isArray(p) ? p[0] : p) as Record<string, unknown> | null;
}

export function bodaccUrl(rec: BodaccRecord): string {
  return rec.url_complete || `https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:${encodeURIComponent(rec.id)}`;
}

export function buildWhere(family: string, departments: string[], since: string): string {
  const deps = departments.map((d) => `numerodepartement="${d.replace(/[^0-9AB]/gi, '')}"`).join(' OR ');
  return `(${deps}) AND familleavis="${family}" AND dateparution>=date'${since}'`;
}

const prov = (at: string, url: string): Provenance => ({ sourceId: 'bodacc', status: 'officielle', confidence: 70, collectedAt: at, url });

/** Traite une annonce : entreprise (création minimale si inconnue), événement, procédures, cessions, alertes. */
export async function ingestBodacc(db: Db, rec: BodaccRecord, at: string, runId: number | null): Promise<{ created: boolean; updated: boolean; skipped?: string }> {
  const siren = sirenOf(rec);
  const url = bodaccUrl(rec);
  const person = firstPerson(rec.listepersonnes);
  const name = rec.commercant?.trim() || personName(person);
  if (!siren) {
    await recordSource(db, { sourceId: 'bodacc', externalId: rec.id, entityType: 'announcement', url, publishedAt: rec.dateparution, payload: rec });
    return { created: false, updated: false, skipped: `Annonce ${rec.id} sans SIREN exploitable` };
  }
  const company = await upsertCompany(db, { siren, name: name ?? undefined, commune_name: rec.ville ?? undefined, postal_code: rec.cp ?? undefined }, prov(at, url));
  if (!company) return { created: false, updated: false, skipped: `SIREN ${siren} exclu (liste d'opposition)` };
  const src = await recordSource(db, { sourceId: 'bodacc', externalId: rec.id, entityType: 'announcement', companyId: company.id, siren, url, publishedAt: rec.dateparution, payload: rec });
  const typeAvis = (rec.typeavis_lib ?? rec.typeavis ?? '').toLowerCase();
  const stmts: Statement[] = [];
  const precedent = parseMaybeJson<{ numeroParution?: string | number; numeroAnnonce?: string | number }>(rec.parutionavisprecedent);

  if (rec.familleavis === 'collective') {
    const j = parseMaybeJson<{ famille?: string; nature?: string; date?: string; complementJugement?: string }>(rec.jugement) ?? {};
    const isAnnulation = typeAvis.includes('annulation');
    stmts.push(
      eventStmt({
        companyId: company.id,
        type: 'procedure',
        date: j.date ?? rec.dateparution,
        title: isAnnulation ? `Annulation d'annonce : ${j.nature ?? 'jugement'}` : j.nature || j.famille || 'Jugement',
        details: { famille: j.famille ?? null, nature: j.nature ?? null, complement: j.complementJugement ?? null, typeavis: rec.typeavis_lib ?? null, parution: rec.parution ?? null, numeroannonce: rec.numeroannonce ?? null, dateparution: rec.dateparution, annule: isAnnulation || undefined },
        tribunal: rec.tribunal ?? null,
        reference: rec.id,
        url,
        sourceId: 'bodacc',
        sourceRecordId: src.id,
      }),
    );
    await db.batch(stmts);
    // Avis d'annulation : neutralise l'annonce visée
    if (isAnnulation && precedent?.numeroParution && precedent?.numeroAnnonce) {
      const target = await db.all<{ id: number; details: string }>(`SELECT id, details FROM company_events WHERE company_id = ? AND source_id = 'bodacc' AND event_type = 'procedure'`, [company.id]);
      for (const t of target) {
        const d = parseMaybeJson<Record<string, unknown>>(t.details) ?? {};
        if (String(d.parution) === String(precedent.numeroParution) && String(d.numeroannonce) === String(precedent.numeroAnnonce)) {
          await db.run('UPDATE company_events SET details = ? WHERE id = ?', [JSON.stringify({ ...d, annule: true }), t.id]);
        }
      }
    }
    const changes = await refreshProceedings(db, company.id);
    for (const c of changes) {
      const label = PROC_TYPE_LABELS[c.type];
      if (c.kind === 'nouvelle') {
        const type = c.type === 'liquidation' ? 'nouvelle_liquidation' : c.type === 'redressement' ? 'nouveau_redressement' : c.type === 'sauvegarde' ? 'nouvelle_sauvegarde' : 'changement_procedure';
        await raiseAlert(db, { type, severity: c.type === 'liquidation' ? 'critique' : 'attention', companyId: company.id, title: `${label} : ${name ?? siren}`, message: `${rec.tribunal ?? 'Tribunal non précisé'} — publié au BODACC le ${rec.dateparution}`, dedupeKey: `proc:${company.id}:${c.type}:${c.date}`, runId });
      } else {
        await raiseAlert(db, { type: 'changement_procedure', severity: c.to === 'cloturee' ? 'info' : 'attention', companyId: company.id, title: `${label} : ${PROC_STATUS_LABELS[c.from!]} → ${PROC_STATUS_LABELS[c.to]} (${name ?? siren})`, message: `BODACC du ${rec.dateparution}`, dedupeKey: `procst:${company.id}:${c.type}:${c.to}:${c.reference}`, runId });
      }
    }
  } else if (rec.familleavis === 'vente') {
    const acte = parseMaybeJson<Record<string, unknown>>(rec.acte) ?? {};
    const vente = (acte.vente ?? acte) as Record<string, unknown>;
    const descriptif = typeof vente.descriptif === 'string' ? vente.descriptif : null;
    const prev = firstPerson(rec.listeprecedentproprietaire);
    const prevSiren = sirenFromText(JSON.stringify((prev as { numeroImmatriculation?: unknown } | null)?.numeroImmatriculation ?? prev ?? ''));
    const etab = parseMaybeJson<Record<string, unknown>>(rec.listeetablissements);
    const origine = JSON.stringify(etab ?? {}).match(/"origineFonds"\s*:\s*"([^"]+)"/)?.[1] ?? null;
    stmts.push(
      eventStmt({ companyId: company.id, type: 'vente', date: rec.dateparution, title: 'Acquisition / cession de fonds publiée', details: { descriptif, origineFonds: origine, precedentProprietaire: personName(prev), precedentSiren: prevSiren }, tribunal: rec.tribunal ?? null, reference: rec.id, url, sourceId: 'bodacc', sourceRecordId: src.id }),
    );
    await db.batch(stmts);
    // Le cédant : cession réalisée (signal public de transmission / cession partielle)
    if (prevSiren && prevSiren !== siren) {
      const seller = await upsertCompany(db, { siren: prevSiren, name: personName(prev) ?? undefined }, prov(at, url));
      if (seller) {
        await db.batch([
          eventStmt({ companyId: seller.id, type: 'vente', date: rec.dateparution, title: `Cession de fonds à ${name ?? siren}`, details: { descriptif, acquereur: name, acquereurSiren: siren }, tribunal: rec.tribunal ?? null, reference: `${rec.id}:cedant`, url, sourceId: 'bodacc', sourceRecordId: src.id }),
          {
            sql: `INSERT INTO sale_listings (company_id, source_id, external_id, kind, status, is_offer, title, description, commune_name, department, url, published_at, collected_at)
                  VALUES (?, 'bodacc', ?, 'fonds_de_commerce', 'realisee', 0, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_id, external_id) DO NOTHING`,
            params: [seller.id, rec.id, `Cession réalisée : ${personName(prev) ?? prevSiren} → ${name ?? siren}`, descriptif, rec.ville ?? null, rec.numerodepartement ?? null, url, rec.dateparution, at],
          },
          {
            sql: `INSERT INTO transmission_signals (company_id, signal_type, strength, evidence, evidence_url, source_id, detected_at) VALUES (?, 'cession_fonds_realisee', 2, ?, ?, 'bodacc', ?)
                  ON CONFLICT(company_id, signal_type, source_id) DO UPDATE SET evidence = excluded.evidence, evidence_url = excluded.evidence_url, detected_at = excluded.detected_at`,
            params: [seller.id, `Cession d'un fonds publiée au BODACC le ${rec.dateparution}${descriptif ? ` : ${descriptif.slice(0, 200)}` : ''}`, url, at],
          },
          { sql: 'INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', params: [seller.id, at] },
        ]);
        await raiseAlert(db, { type: 'nouvelle_transmission', severity: 'info', companyId: seller.id, title: `Cession de fonds publiée : ${personName(prev) ?? prevSiren}`, message: `Acquéreur : ${name ?? siren} — BODACC du ${rec.dateparution}`, dedupeKey: `vente:${rec.id}`, runId });
      }
    }
  } else if (rec.familleavis === 'radiation') {
    stmts.push(eventStmt({ companyId: company.id, type: 'radiation', date: rec.dateparution, title: 'Radiation du registre du commerce', details: { typeavis: rec.typeavis_lib ?? null }, tribunal: rec.tribunal ?? null, reference: rec.id, url, sourceId: 'bodacc', sourceRecordId: src.id }));
    stmts.push({ sql: 'INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', params: [company.id, at] });
    await db.batch(stmts);
  }
  return { created: company.created, updated: src.isNew || src.changed };
}

function isoDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86400_000).toISOString().slice(0, 10);
}

export const bodacc: Connector = {
  id: 'bodacc',
  label: 'BODACC — annonces commerciales',
  description: 'Procédures collectives (sauvegarde, redressement, liquidation, plans, clôtures), ventes et cessions de fonds, radiations. Source officielle de la DILA.',
  official: true,
  requiredSecrets: [],
  defaultEnabled: true,
  provides: ['Jugements des procédures collectives (date, tribunal, nature, mandataire publié)', 'Cessions de fonds réalisées (cédant, acquéreur)', 'Radiations', 'Lien vers chaque annonce officielle'],
  license: 'Licence Ouverte Etalab 2.0 — réutilisation libre avec mention de la source (DILA, BODACC)',
  termsUrl: 'https://www.bodacc.fr/pages/donnees-ouvertes/',
  docsUrl: 'https://bodacc-datadila.opendatasoft.com/explore/dataset/annonces-commerciales/api/',
  quotas: 'API Opendatasoft : 100 enregistrements par appel, 10 000 par requête (pagination par date de parution) ; quotas journaliers des appels anonymes appliqués par la plateforme',
  limitations: [
    "Les ventes et cessions publiées sont des cessions déjà réalisées : elles ne signalent pas une entreprise à vendre.",
    'Le SIREN est extrait du champ « registre » : une annonce sans numéro exploitable est conservée mais non rattachée.',
    'Les coordonnées du mandataire ne sont affichées que si elles figurent dans le texte officiel du jugement.',
  ],
  async planTasks() {
    return Object.keys(FAMILIES);
  },
  async runChunk(ctx: ConnectorContext, task: string, cursor: unknown): Promise<ChunkResult> {
    if (!(task in FAMILIES)) return { ...emptyChunk(), errors: [`Tâche inconnue : ${task}`] };
    const family = task as Family;
    const backfill = ctx.settings.sync.bodaccBackfillYears[family] ?? 1;
    const lastDate = ctx.config[`lastDate_${family}`] as string | undefined;
    const c = (cursor as { since?: string; offset?: number; maxDate?: string } | null) ?? {};
    const since = c.since ?? (lastDate ? isoDaysAgo(new Date(lastDate), 7) : isoDaysAgo(ctx.now(), Math.round(backfill * 365.25)));
    let offset = c.offset ?? 0;
    let maxDate = c.maxDate ?? lastDate ?? since;
    const http = ctx.http({ minIntervalMs: 250 });
    const at = ctx.now().toISOString();
    const runId = (ctx.config.__runId as number | undefined) ?? null;
    const out: ChunkResult = { ...emptyChunk({ since, offset, maxDate }, false) };
    let curSince = since;
    for (let i = 0; i < 3; i++) {
      const params = new URLSearchParams({ where: buildWhere(family, ctx.departments, curSince), order_by: 'dateparution', limit: String(PAGE), offset: String(offset) });
      let data: { total_count: number; results: BodaccRecord[] };
      try {
        data = await http.json<{ total_count: number; results: BodaccRecord[] }>(`${BODACC_URL}?${params}`);
      } catch (e) {
        if ((e as Error).name === 'BudgetExhausted' && i > 0) return out; // progression conservée
        throw e;
      }
      out.fetched += data.results.length;
      for (const rec of data.results) {
        try {
          const r = await ingestBodacc(ctx.db, rec, at, runId);
          if (r.skipped) out.errors.push(r.skipped);
          else if (r.created) out.created++;
          else if (r.updated) out.updated++;
          if (rec.dateparution > maxDate) maxDate = rec.dateparution;
        } catch (e) {
          out.errors.push(`Annonce ${rec.id} : ${(e as Error).message}`);
        }
      }
      if (data.results.length < PAGE) {
        out.done = true;
        out.cursor = null;
        out.configPatch = { [`lastDate_${family}`]: maxDate };
        return out;
      }
      offset += PAGE;
      // Plafond Opendatasoft (offset + limit ≤ 10 000) : on repart de la dernière date vue
      if (offset + PAGE > 10000) {
        curSince = data.results[data.results.length - 1]!.dateparution;
        offset = 0;
      }
      out.cursor = { since: curSince, offset, maxDate };
    }
    return out;
  },
};
