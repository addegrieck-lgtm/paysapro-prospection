/**
 * Reconstitution en base des procédures collectives d'une entreprise à partir de ses événements BODACC.
 * Retourne les changements (nouvelles procédures, changements de statut) pour les alertes.
 */
import type { Db, Statement } from '../db/types';
import { rebuildProceedings, type JudgmentInput, type ProcStatus, type ProcType } from '../domain/proceedings';

export interface ProcChange {
  kind: 'nouvelle' | 'statut';
  type: ProcType;
  from?: ProcStatus;
  to: ProcStatus;
  date: string | null;
  tribunal: string | null;
  reference: string;
}

export async function refreshProceedings(db: Db, companyId: number): Promise<ProcChange[]> {
  const events = await db.all<{ id: number; event_date: string | null; details: string | null; tribunal: string | null; url: string | null; reference: string }>(
    `SELECT id, event_date, details, tribunal, url, reference FROM company_events WHERE company_id = ? AND event_type = 'procedure'`,
    [companyId],
  );
  const judgments: (JudgmentInput & { eventId: number })[] = [];
  for (const e of events) {
    let d: { famille?: string; nature?: string; complement?: string; annule?: boolean } = {};
    try {
      d = e.details ? JSON.parse(e.details) : {};
    } catch {
      /* détail illisible : jugement ignoré */
    }
    if (d.annule) continue;
    judgments.push({ eventId: e.id, date: e.event_date, famille: d.famille ?? null, nature: d.nature ?? null, complement: d.complement ?? null, tribunal: e.tribunal, url: e.url, reference: e.reference });
  }
  const before = await db.all<{ type: ProcType; status: ProcStatus; opened_at: string | null }>('SELECT type, status, opened_at FROM legal_proceedings WHERE company_id = ?', [companyId]);
  const procs = rebuildProceedings(judgments);
  const now = new Date().toISOString();
  const stmts: Statement[] = [{ sql: 'DELETE FROM legal_proceedings WHERE company_id = ?', params: [companyId] }];
  for (const p of procs) {
    stmts.push({
      sql: `INSERT INTO legal_proceedings (company_id, type, status, opened_at, last_event_at, closed_at, closure_reason, tribunal, latest_nature, administrator, url, source_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bodacc', ?)`,
      params: [companyId, p.type, p.status, p.openedAt, p.lastEventAt, p.closedAt, p.closureReason, p.tribunal, p.latestNature, p.administrator, p.url, now],
    });
  }
  stmts.push({ sql: 'INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', params: [companyId, now] });
  await db.batch(stmts);
  // Rattachement des événements à leur procédure
  const saved = await db.all<{ id: number; opened_at: string | null; type: string }>('SELECT id, opened_at, type FROM legal_proceedings WHERE company_id = ?', [companyId]);
  const link: Statement[] = [];
  procs.forEach((p) => {
    const row = saved.find((s) => s.type === p.type && s.opened_at === p.openedAt);
    if (!row) return;
    for (const ref of p.references) link.push({ sql: "UPDATE company_events SET proceeding_id = ? WHERE company_id = ? AND source_id = 'bodacc' AND reference = ?", params: [row.id, companyId, ref] });
  });
  if (link.length) await db.batch(link);

  const changes: ProcChange[] = [];
  for (const p of procs) {
    const prev = before.find((b) => b.type === p.type && b.opened_at === p.openedAt);
    const ref = p.references[p.references.length - 1] ?? '';
    if (!prev) changes.push({ kind: 'nouvelle', type: p.type, to: p.status, date: p.openedAt, tribunal: p.tribunal, reference: ref });
    else if (prev.status !== p.status) changes.push({ kind: 'statut', type: p.type, from: prev.status, to: p.status, date: p.lastEventAt, tribunal: p.tribunal, reference: ref });
  }
  return changes;
}
