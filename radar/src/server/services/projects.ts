/**
 * Acquisition Manager : suivi des entreprises ciblées. Aucun message n'est jamais envoyé automatiquement :
 * l'outil enregistre les actions, il ne contacte personne.
 */
import { z } from 'zod';
import type { Db } from '../db/types';
import { queueAnalysis } from './companies';

export const PROJECT_STATUSES: Record<string, string> = {
  nouvelle: 'Nouvelle découverte',
  a_analyser: 'À analyser',
  interessante: 'Opportunité intéressante',
  a_contacter: 'À contacter',
  contact_effectue: 'Contact effectué',
  echange: 'Échange en cours',
  infos_demandees: 'Informations financières demandées',
  negociation: 'Négociation',
  due_diligence: 'Due diligence',
  offre: 'Offre formulée',
  acquise: 'Acquisition réalisée',
  refusee: 'Refusée',
  abandonnee: 'Abandonnée',
};

export const ProjectPatch = z.object({
  status: z.enum(Object.keys(PROJECT_STATUSES) as [string, ...string[]]).optional(),
  priority: z.number().int().min(1).max(3).optional(),
  asking_price: z.number().nonnegative().max(1e10).nullable().optional(),
  estimated_price: z.number().nonnegative().max(1e10).nullable().optional(),
  offer_price: z.number().nonnegative().max(1e10).nullable().optional(),
  next_action: z.string().max(500).nullable().optional(),
  next_action_at: z.string().max(25).nullable().optional(),
});

export const NoteInput = z.object({
  kind: z.enum(['note', 'action', 'rappel']).default('note'),
  content: z.string().trim().min(1).max(10000),
  due_at: z.string().max(25).nullable().optional(),
});

export const ContactInput = z.object({
  name: z.string().trim().min(1).max(150),
  role: z.string().max(150).nullable().optional(),
  organisation: z.string().max(150).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal('')),
  phone: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const now = () => new Date().toISOString();

export async function ensureProject(db: Db, companyId: number, userId: number): Promise<number> {
  const existing = await db.get<{ id: number }>('SELECT id FROM acquisition_projects WHERE company_id = ?', [companyId]);
  if (existing) return existing.id;
  if (!(await db.get('SELECT 1 FROM companies WHERE id = ?', [companyId]))) throw new Error('Entreprise introuvable');
  const valuation = await db.get<{ central: number | null }>('SELECT central FROM valuations WHERE company_id = ?', [companyId]);
  const r = await db.get<{ id: number }>("INSERT INTO acquisition_projects (company_id, status, estimated_price, owner_id, created_at, updated_at) VALUES (?, 'nouvelle', ?, ?, ?, ?) RETURNING id", [companyId, valuation?.central ?? null, userId, now(), now()]);
  await db.run("INSERT INTO acquisition_notes (project_id, user_id, kind, content, created_at) VALUES (?, ?, 'statut', 'Ajoutée à l''Acquisition Manager', ?)", [r!.id, userId, now()]);
  return r!.id;
}

export async function updateProject(db: Db, id: number, patch: z.infer<typeof ProjectPatch>, userId: number): Promise<void> {
  const prev = await db.get<{ status: string; company_id: number; asking_price: number | null }>('SELECT status, company_id, asking_price FROM acquisition_projects WHERE id = ?', [id]);
  if (!prev) throw new Error('Projet introuvable');
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  await db.run(`UPDATE acquisition_projects SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [...keys.map((k) => (patch[k] ?? null) as string | number | null), now(), id]);
  if (patch.status && patch.status !== prev.status) {
    await db.run("INSERT INTO acquisition_notes (project_id, user_id, kind, content, created_at) VALUES (?, ?, 'statut', ?, ?)", [id, userId, `Statut : ${PROJECT_STATUSES[prev.status] ?? prev.status} → ${PROJECT_STATUSES[patch.status]}`, now()]);
  }
  if (patch.asking_price !== undefined && patch.asking_price !== prev.asking_price) await queueAnalysis(db, prev.company_id); // le prix demandé entre dans le score
}

export async function listProjects(db: Db) {
  return db.all(
    `SELECT p.*, c.name, c.siren, c.commune_name, c.sector_id, s.economic_score, s.risk_score, s.reliability_score, s.data_status, v.low AS valuation_low, v.central AS valuation_central, v.high AS valuation_high,
     m.revenue, m.net_income, m.ebe, m.last_year, o.primary_type,
     (SELECT COUNT(*) FROM acquisition_notes n WHERE n.project_id = p.id AND n.kind = 'rappel' AND n.done_at IS NULL) AS open_reminders,
     (SELECT MIN(due_at) FROM acquisition_notes n WHERE n.project_id = p.id AND n.kind = 'rappel' AND n.done_at IS NULL) AS next_reminder
     FROM acquisition_projects p JOIN companies c ON c.id = p.company_id LEFT JOIN scoring_results s ON s.company_id = c.id
     LEFT JOIN valuations v ON v.company_id = c.id LEFT JOIN company_metrics m ON m.company_id = c.id LEFT JOIN acquisition_opportunities o ON o.company_id = c.id
     ORDER BY p.priority, p.updated_at DESC`,
  );
}

export async function projectDetail(db: Db, id: number) {
  const p = await db.get<Record<string, unknown>>('SELECT p.*, c.name, c.siren FROM acquisition_projects p JOIN companies c ON c.id = p.company_id WHERE p.id = ?', [id]);
  if (!p) return null;
  const [notes, contacts, documents, scenarios] = await Promise.all([
    db.all('SELECT n.*, u.name AS user_name FROM acquisition_notes n LEFT JOIN users u ON u.id = n.user_id WHERE n.project_id = ? ORDER BY n.created_at DESC', [id]),
    db.all('SELECT * FROM project_contacts WHERE project_id = ? ORDER BY name', [id]),
    db.all('SELECT id, filename, content_type, size, created_at FROM documents WHERE project_id = ? ORDER BY created_at DESC', [id]),
    db.all('SELECT id, name, params, results, created_at FROM financial_scenarios WHERE project_id = ? ORDER BY created_at DESC', [id]),
  ]);
  return { project: p, notes, contacts, documents, scenarios };
}

export async function upcomingReminders(db: Db) {
  return db.all(
    `SELECT n.id, n.content, n.due_at, p.id AS project_id, c.name, c.id AS company_id FROM acquisition_notes n JOIN acquisition_projects p ON p.id = n.project_id JOIN companies c ON c.id = p.company_id
     WHERE n.kind = 'rappel' AND n.done_at IS NULL ORDER BY n.due_at LIMIT 50`,
  );
}
