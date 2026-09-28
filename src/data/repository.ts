// ProspectsApi : l'« API » du module, exécutée localement sur IndexedDB.
//
// Chaque méthode correspond à une route REST (GET /api/prospects, PATCH /api/prospects/:id…).
// Pour passer plus tard à un serveur (Supabase, Cloudflare…), il suffit de réimplémenter cette classe :
// les écrans ne changent pas. Isolation : toutes les lectures et écritures sont filtrées par workspaceId.
//
// Performance (100 000 prospects) : une version compacte de chaque fiche (ProspectRow) est gardée en
// mémoire ; filtres, recherche et tri s'y exécutent en quelques millisecondes et seule la page affichée
// est rendue. Les fiches complètes ne sont lues qu'à l'ouverture.
import type { DB } from './db';
import type {
  ActivityType,
  Campaign,
  CampaignRecipient,
  ExclusionReason,
  ImportReport,
  MessageTemplate,
  Page,
  Prospect,
  ProspectActivity,
  ProspectFilter,
  ProspectNote,
  ProspectQuery,
  ProspectRow,
  ProspectStatus,
  ProspectTask,
  Role,
  Segment,
  Settings,
  SourceKind,
  SuppressionEntry,
  SuppressionKind,
  TaskPriority,
  TaskType,
} from '../domain/types';
import { applyStatus, createProspect, finalize, mergeProspect, toRow, type MergeMode, type ProspectInput } from '../domain/prospect';
import { DedupeIndex, MATCH_LABEL } from '../domain/dedupe';
import { matchesFilter, sortRows, today } from '../domain/filters';
import { computeScore } from '../domain/scoring';
import { assertCan } from '../domain/access';
import { builtInTemplates } from '../domain/templates';
import { STATUS_LABEL, TEMPLATE_CATEGORIES } from '../domain/referentials';
import { normEmail, normPhone } from '../domain/normalize';
import { generateMessage, type MessageProvider } from '../providers/ai';
import { uid } from '../utils/id';

export interface RepoContext {
  workspaceId: string;
  user: string;
  role: Role;
}

export function defaultSettings(workspaceId: string): Settings {
  return {
    workspaceId,
    userName: 'Moi',
    role: 'owner',
    saasName: import.meta.env?.VITE_SAAS_NAME || 'Paysapro AI',
    senderName: '',
    signature: '',
    formality: 'vous',
    adminEmail: '',
    testMode: true,
    nafCodes: ['81.30Z'],
    targetDepartments: [],
    minScore: 0,
    dailyContactLimit: 50,
    timezone: 'Europe/Paris',
    averageDealValue: null,
    excludeIndividuals: false,
    emailProvider: 'mailto',
    onboarded: false,
  };
}

export interface ImportLine {
  line: number;
  input: ProspectInput | null;
  errors: string[];
}

export interface ImportOptions {
  source: SourceKind;
  label: string;
  /** create : nouveaux prospects ; enrich : complète uniquement des prospects existants */
  mode: 'create' | 'enrich';
  batchSize?: number;
  /** false : pas d'entrée dans l'historique (import découpé en plusieurs appels, cf. saveImportReport) */
  record?: boolean;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export class DailyLimitError extends Error {
  constructor(limit: number) {
    super(`Limite de sécurité atteinte : ${limit} contacts aujourd'hui. Modifiable dans Paramètres.`);
    this.name = 'DailyLimitError';
  }
}

const SOURCE_LABEL: Record<SourceKind, string> = {
  sirene: 'SIRENE (INSEE)',
  csv: 'import CSV',
  manual: 'saisie manuelle',
  demo: 'données de démonstration',
  enrichment: "fichier d'enrichissement",
};

const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

export class ProspectsApi {
  private rows: Map<string, ProspectRow> | null = null;
  private listeners = new Set<() => void>();
  readonly db: DB;
  ctx: RepoContext;

  constructor(db: DB, ctx: RepoContext) {
    this.db = db;
    this.ctx = ctx;
  }

  // ─────────────── Abonnement (rafraîchissement de l'interface) ───────────────

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  private now() {
    return new Date().toISOString();
  }

  private mine<T extends { workspaceId: string }>(x: T | undefined): T | undefined {
    return x && x.workspaceId === this.ctx.workspaceId ? x : undefined;
  }

  private async byWorkspace<S extends 'prospect_rows' | 'prospect_tasks' | 'prospect_segments' | 'prospect_campaigns' | 'message_templates' | 'prospect_imports' | 'suppression_list'>(store: S) {
    // (le typage générique d'idb ne sait pas exprimer « toutes ces tables ont un index workspaceId »)
    return this.db.getAllFromIndex(store, 'workspaceId', this.ctx.workspaceId as never);
  }

  // ─────────────── Paramètres ───────────────

  async getSettings(): Promise<Settings> {
    const s = await this.db.get('settings', this.ctx.workspaceId);
    return { ...defaultSettings(this.ctx.workspaceId), ...s };
  }

  async saveSettings(s: Settings): Promise<void> {
    await this.db.put('settings', { ...s, workspaceId: this.ctx.workspaceId });
    this.emit();
  }

  // ─────────────── GET /api/prospects ───────────────

  async allRows(): Promise<ProspectRow[]> {
    if (!this.rows) {
      const list = await this.byWorkspace('prospect_rows');
      this.rows = new Map(list.map((r) => [r.id, r]));
    }
    return Array.from(this.rows.values());
  }

  async listProspects(q: ProspectQuery): Promise<Page<ProspectRow>> {
    assertCan(this.ctx.role, 'prospecting.view');
    const pageSize = q.pageSize ?? 50;
    const page = Math.max(1, q.page ?? 1);
    let rows = await this.allRows();
    if (q.ids) {
      const set = new Set(q.ids);
      rows = rows.filter((r) => set.has(r.id));
    }
    const filtered = sortRows(
      rows.filter((r) => matchesFilter(r, q.filter)),
      q.sort,
    );
    return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize };
  }

  /** Identifiants correspondant à un filtre (sélection « tout », segments, campagnes, export). */
  async matchingIds(filter: ProspectFilter, sort?: ProspectQuery['sort']): Promise<string[]> {
    return sortRows((await this.allRows()).filter((r) => matchesFilter(r, filter)), sort).map((r) => r.id);
  }

  async countMatching(filter: ProspectFilter): Promise<number> {
    return (await this.allRows()).filter((r) => matchesFilter(r, filter)).length;
  }

  // ─────────────── GET /api/prospects/:id ───────────────

  async getProspect(id: string): Promise<Prospect | undefined> {
    assertCan(this.ctx.role, 'prospecting.view');
    return this.mine(await this.db.get('prospects', id));
  }

  async getProspects(ids: string[]): Promise<Prospect[]> {
    const tx = this.db.transaction('prospects');
    const list = await Promise.all(ids.map((id) => tx.store.get(id)));
    return list.filter((p): p is Prospect => !!this.mine(p));
  }

  private activity(prospectId: string, type: ActivityType, label: string, at = this.now()): ProspectActivity {
    return { id: uid(), workspaceId: this.ctx.workspaceId, prospectId, type, label, at, by: this.ctx.user };
  }

  private async write(prospects: Prospect[], activities: ProspectActivity[]) {
    const tx = this.db.transaction(['prospects', 'prospect_rows', 'prospect_activities'], 'readwrite');
    const ops: Promise<unknown>[] = [];
    for (const p of prospects) {
      ops.push(tx.objectStore('prospects').put(p), tx.objectStore('prospect_rows').put(toRow(p)));
    }
    for (const a of activities) ops.push(tx.objectStore('prospect_activities').put(a));
    await Promise.all(ops);
    await tx.done;
    if (this.rows) for (const p of prospects) this.rows.set(p.id, toRow(p));
  }

  // ─────────────── POST /api/prospects ───────────────

  async createProspect(input: ProspectInput, source: SourceKind = 'manual'): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.create');
    if (!input.name?.trim()) throw new Error('Le nom de l’entreprise est obligatoire.');
    const p = createProspect(input, { workspaceId: this.ctx.workspaceId, user: this.ctx.user }, source);
    if (await this.isSuppressed(p)) {
      p.doNotContact = true;
      p.doNotContactReason = 'Présent dans la liste de suppression';
      Object.assign(p, finalize(p));
    }
    await this.write([p], [this.activity(p.id, 'created', `Prospect créé (${SOURCE_LABEL[source]})`), this.activity(p.id, 'score', `Score calculé : ${p.score}`)]);
    this.emit();
    return p;
  }

  // ─────────────── PATCH /api/prospects/:id ───────────────

  async updateProspect(id: string, patch: ProspectInput, label = 'Fiche modifiée'): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const existing = await this.getProspect(id);
    if (!existing) throw new Error('Prospect introuvable.');
    const now = this.now();
    // Une saisie manuelle peut aussi VIDER un champ : on applique le patch tel quel.
    const next = finalize({ ...existing, ...patch, updatedAt: now });
    const acts = [this.activity(id, 'updated', label, now)];
    if (next.score !== existing.score) acts.push(this.activity(id, 'score', `Score recalculé : ${existing.score} → ${next.score}`, now));
    await this.write([next], acts);
    this.emit();
    return next;
  }

  async setStatus(id: string, status: ProspectStatus): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const existing = await this.getProspect(id);
    if (!existing) throw new Error('Prospect introuvable.');
    if (existing.doNotContact && status !== 'do_not_contact') {
      throw new Error('Ce prospect est marqué « Ne plus contacter ». Retirez d’abord cette exclusion.');
    }
    const now = this.now();
    const next = applyStatus(existing, status, now);
    await this.write([next], [this.activity(id, 'status', `Statut : ${STATUS_LABEL[existing.status]} → ${STATUS_LABEL[status]}`, now)]);
    this.emit();
    return next;
  }

  /** Enregistre un contact (appel, e-mail, message) : date du dernier contact + passage à « Contacté ». */
  async logContact(id: string, channel: 'call' | 'email' | 'message', label: string): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const p = await this.getProspect(id);
    if (!p) throw new Error('Prospect introuvable.');
    if (p.doNotContact) throw new Error('Ce prospect est marqué « Ne plus contacter ».');
    await this.assertDailyLimit();
    const now = this.now();
    let next: Prospect = { ...p, lastContactAt: now, updatedAt: now };
    if (['new', 'to_qualify', 'to_contact', 'not_now'].includes(p.status)) next = applyStatus(next, 'contacted', now);
    else next = applyStatus(next, next.status, now);
    await this.write([next], [this.activity(id, channel, label, now)]);
    this.emit();
    return next;
  }

  async contactsToday(): Promise<number> {
    const t = today();
    const acts = await this.db.getAllFromIndex('prospect_activities', 'workspaceId', this.ctx.workspaceId);
    return acts.filter((a) => (a.type === 'email' || a.type === 'call' || a.type === 'message') && a.at.slice(0, 10) === t).length;
  }

  private async assertDailyLimit() {
    const s = await this.getSettings();
    if ((await this.contactsToday()) >= s.dailyContactLimit) throw new DailyLimitError(s.dailyContactLimit);
  }

  async setDoNotContact(id: string, on: boolean, reason = 'Demande du prospect'): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const p = await this.getProspect(id);
    if (!p) throw new Error('Prospect introuvable.');
    const now = this.now();
    let next: Prospect;
    if (on) {
      next = finalize({ ...p, doNotContact: true, doNotContactReason: reason, status: 'do_not_contact', nextFollowUpAt: null, updatedAt: now });
      await this.addSuppressionFor(next, reason);
      // Les relances en cours sont annulées
      const tasks = await this.tasksFor(id);
      await Promise.all(tasks.filter((t) => !t.done).map((t) => this.db.delete('prospect_tasks', t.id)));
    } else {
      await this.removeSuppressionFor(p);
      next = finalize({ ...p, doNotContact: false, doNotContactReason: null, status: 'to_qualify', updatedAt: now });
    }
    await this.write([next], [this.activity(id, 'do_not_contact', on ? `Ne plus contacter : ${reason}` : 'Exclusion retirée')]);
    this.emit();
    return next;
  }

  // ─────────────── DELETE /api/prospects/:id ───────────────

  /** Suppression définitive (RGPD). `suppress` : empêche sa réimportation (liste de suppression). */
  async deleteProspects(ids: string[], suppress = false): Promise<number> {
    assertCan(this.ctx.role, 'prospecting.delete');
    const prospects = await this.getProspects(ids);
    if (suppress) for (const p of prospects) await this.addSuppressionFor(p, 'Suppression à la demande (RGPD)');
    const stores = ['prospects', 'prospect_rows', 'prospect_notes', 'prospect_activities', 'prospect_tasks'] as const;
    const tx = this.db.transaction(stores, 'readwrite');
    for (const p of prospects) {
      await tx.objectStore('prospects').delete(p.id);
      await tx.objectStore('prospect_rows').delete(p.id);
      for (const s of ['prospect_notes', 'prospect_activities', 'prospect_tasks'] as const) {
        const keys = await tx.objectStore(s).index('prospectId').getAllKeys(p.id);
        for (const k of keys) await tx.objectStore(s).delete(k);
      }
    }
    await tx.done;
    prospects.forEach((p) => this.rows?.delete(p.id));
    this.emit();
    return prospects.length;
  }

  // ─────────────── Liste de suppression ───────────────

  private suppressionKeys(p: Pick<Prospect, 'siren' | 'siret' | 'email' | 'phone'>): { kind: SuppressionKind; value: string }[] {
    const keys: { kind: SuppressionKind; value: string }[] = [];
    if (p.siret) keys.push({ kind: 'siret', value: p.siret });
    else if (p.siren) keys.push({ kind: 'siren', value: p.siren });
    const email = normEmail(p.email);
    if (email) keys.push({ kind: 'email', value: email });
    const phone = normPhone(p.phone);
    if (phone) keys.push({ kind: 'phone', value: phone });
    return keys;
  }

  async listSuppression(): Promise<SuppressionEntry[]> {
    return (await this.byWorkspace('suppression_list')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addSuppression(kind: SuppressionKind, value: string, reason: string): Promise<void> {
    const v = kind === 'email' ? normEmail(value) : kind === 'phone' ? normPhone(value) : value.replace(/\D/g, '');
    if (!v) throw new Error('Valeur invalide.');
    const existing = (await this.listSuppression()).some((e) => e.kind === kind && e.value === v);
    if (existing) return;
    const now = this.now();
    await this.db.put('suppression_list', { id: uid(), workspaceId: this.ctx.workspaceId, createdAt: now, updatedAt: now, createdBy: this.ctx.user, kind, value: v, reason });
    this.emit();
  }

  async removeSuppression(id: string): Promise<void> {
    const e = this.mine(await this.db.get('suppression_list', id));
    if (e) await this.db.delete('suppression_list', id);
    this.emit();
  }

  private async addSuppressionFor(p: Prospect, reason: string) {
    for (const k of this.suppressionKeys(p)) await this.addSuppression(k.kind, k.value, reason);
  }

  private async removeSuppressionFor(p: Prospect) {
    const keys = new Set(this.suppressionKeys(p).map((k) => `${k.kind}:${k.value}`));
    const list = await this.listSuppression();
    await Promise.all(list.filter((e) => keys.has(`${e.kind}:${e.value}`)).map((e) => this.db.delete('suppression_list', e.id)));
  }

  private async suppressionSet(): Promise<Set<string>> {
    return new Set((await this.listSuppression()).map((e) => `${e.kind}:${e.value}`));
  }

  private matchesSuppression(set: Set<string>, p: Pick<Prospect, 'siren' | 'siret' | 'email' | 'phone'>): boolean {
    if (p.siren && set.has(`siren:${p.siren}`)) return true;
    if (p.siret && set.has(`siren:${p.siret.slice(0, 9)}`)) return true;
    return this.suppressionKeys(p).some((k) => set.has(`${k.kind}:${k.value}`));
  }

  async isSuppressed(p: Pick<Prospect, 'siren' | 'siret' | 'email' | 'phone'>): Promise<boolean> {
    return this.matchesSuppression(await this.suppressionSet(), p);
  }

  // ─────────────── POST /api/prospects/import ───────────────

  async importLines(lines: ImportLine[], opts: ImportOptions): Promise<ImportReport> {
    assertCan(this.ctx.role, 'prospecting.import');
    const started = this.now();
    const report: ImportReport = {
      id: uid(),
      workspaceId: this.ctx.workspaceId,
      createdAt: started,
      updatedAt: started,
      createdBy: this.ctx.user,
      source: opts.source,
      label: opts.label,
      total: lines.length,
      added: 0,
      updated: 0,
      duplicates: 0,
      invalid: 0,
      excluded: 0,
      notFound: 0,
      errors: [],
      finishedAt: null,
    };
    const rows = await this.allRows();
    const index = new DedupeIndex(rows.map((r) => ({ id: r.id, siret: r.siret, siren: r.siren, phone: r.phone, name: r.name, city: r.city, address: null })));
    const suppressed = await this.suppressionSet();
    const ctx = { workspaceId: this.ctx.workspaceId, user: this.ctx.user };
    const batchSize = opts.batchSize ?? 500;
    const mergeMode: MergeMode = opts.mode === 'enrich' ? 'overwrite' : opts.source === 'sirene' ? 'identity' : 'fill';
    const pushError = (line: number, message: string) => {
      if (report.errors.length < 500) report.errors.push({ line, message });
    };

    for (let start = 0; start < lines.length; start += batchSize) {
      if (opts.signal?.aborted) break;
      const batch = lines.slice(start, start + batchSize);
      const now = this.now();
      const pending = new Map<string, Prospect>();
      const touched = new Set<string>();
      const activities: ProspectActivity[] = [];

      // Lecture groupée des fiches existantes qui vont être fusionnées
      const matches = batch.map((l) => (l.input ? index.find({ siret: l.input.siret ?? null, siren: l.input.siren ?? null, phone: l.input.phone ?? null, name: l.input.name ?? '', city: l.input.city ?? null, address: l.input.address ?? null }) : null));
      const toLoad = Array.from(new Set(matches.filter((m) => m && !pending.has(m.id)).map((m) => m!.id)));
      (await this.getProspects(toLoad)).forEach((p) => pending.set(p.id, p));

      batch.forEach((l, i) => {
        if (!l.input) {
          report.invalid++;
          pushError(l.line, l.errors.join(' · ') || 'Ligne invalide');
          return;
        }
        l.errors.forEach((e) => pushError(l.line, `${e} (valeur ignorée)`));
        const input = l.input;
        if (this.matchesSuppression(suppressed, { siren: input.siren ?? null, siret: input.siret ?? null, email: input.email ?? null, phone: input.phone ?? null })) {
          report.excluded++;
          return;
        }
        // Une ligne précédente du même lot a pu créer la fiche : on relance la recherche.
        const match = matches[i] ?? index.find({ siret: input.siret ?? null, siren: input.siren ?? null, phone: input.phone ?? null, name: input.name ?? '', city: input.city ?? null, address: input.address ?? null });
        const existing = match ? pending.get(match.id) : undefined;
        if (match && existing) {
          const { prospect, changed } = mergeProspect(existing, input, match.exact ? mergeMode : opts.mode === 'enrich' ? 'overwrite' : 'fill', now);
          if (opts.source === 'sirene') prospect.lastVerifiedAt = now;
          pending.set(prospect.id, prospect);
          report.duplicates++;
          if (changed.length) {
            report.updated++;
            touched.add(prospect.id);
            const label = opts.mode === 'enrich' ? `Enrichi (${SOURCE_LABEL[opts.source]}) : ${changed.length} champ(s)` : `Mis à jour (${SOURCE_LABEL[opts.source]}, ${MATCH_LABEL[match.rule]})`;
            activities.push(this.activity(prospect.id, opts.mode === 'enrich' ? 'enriched' : 'imported', label, now));
            if (prospect.score !== existing.score) activities.push(this.activity(prospect.id, 'score', `Score recalculé : ${existing.score} → ${prospect.score}`, now));
          } else if (opts.source === 'sirene') touched.add(prospect.id);
          return;
        }
        if (opts.mode === 'enrich') {
          report.notFound++;
          pushError(l.line, 'Aucun prospect correspondant (SIREN / SIRET / téléphone / nom + ville)');
          return;
        }
        const p = createProspect({ ...input, lastVerifiedAt: opts.source === 'sirene' ? now : (input.lastVerifiedAt ?? null) }, { ...ctx, now }, opts.source);
        if (!p.name) {
          report.invalid++;
          pushError(l.line, 'Nom de l’entreprise manquant');
          return;
        }
        pending.set(p.id, p);
        touched.add(p.id);
        index.add({ id: p.id, siret: p.siret, siren: p.siren, phone: p.phone, name: p.name, city: p.city, address: p.address });
        report.added++;
        activities.push(this.activity(p.id, 'imported', `Prospect importé depuis ${SOURCE_LABEL[opts.source]}`, now));
        activities.push(this.activity(p.id, 'score', `Score calculé : ${p.score}`, now));
      });

      await this.write(
        Array.from(touched, (id) => pending.get(id)!),
        activities,
      );
      opts.onProgress?.(Math.min(lines.length, start + batch.length), lines.length);
      await yieldToUI();
    }
    report.finishedAt = this.now();
    if (opts.record !== false) await this.db.put('prospect_imports', report);
    this.emit();
    return report;
  }

  /** Enregistre le rapport global d'un import réalisé en plusieurs lots (SIRENE). */
  async saveImportReport(r: Omit<ImportReport, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<ImportReport> {
    const now = this.now();
    const report: ImportReport = { ...r, id: uid(), workspaceId: this.ctx.workspaceId, createdAt: now, updatedAt: now, createdBy: this.ctx.user, finishedAt: now };
    await this.db.put('prospect_imports', report);
    this.emit();
    return report;
  }

  async listImports(): Promise<ImportReport[]> {
    return (await this.byWorkspace('prospect_imports')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ─────────────── Notes : POST /api/prospects/:id/notes ───────────────

  async notesFor(prospectId: string): Promise<ProspectNote[]> {
    const list = await this.db.getAllFromIndex('prospect_notes', 'prospectId', prospectId);
    return list.filter((n) => n.workspaceId === this.ctx.workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addNote(prospectId: string, text: string): Promise<ProspectNote> {
    assertCan(this.ctx.role, 'prospecting.edit');
    if (!text.trim()) throw new Error('La note est vide.');
    const now = this.now();
    const note: ProspectNote = { id: uid(), workspaceId: this.ctx.workspaceId, createdAt: now, updatedAt: now, createdBy: this.ctx.user, prospectId, text: text.trim(), author: this.ctx.user };
    await this.db.put('prospect_notes', note);
    await this.db.put('prospect_activities', this.activity(prospectId, 'note', 'Note ajoutée', now));
    this.emit();
    return note;
  }

  async updateNote(id: string, text: string): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const n = this.mine(await this.db.get('prospect_notes', id));
    if (!n) throw new Error('Note introuvable.');
    await this.db.put('prospect_notes', { ...n, text: text.trim(), updatedAt: this.now() });
    this.emit();
  }

  async deleteNote(id: string): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const n = this.mine(await this.db.get('prospect_notes', id));
    if (n) await this.db.delete('prospect_notes', id);
    this.emit();
  }

  async timeline(prospectId: string): Promise<ProspectActivity[]> {
    const list = await this.db.getAllFromIndex('prospect_activities', 'prospectId', prospectId);
    return list.filter((a) => a.workspaceId === this.ctx.workspaceId).sort((a, b) => b.at.localeCompare(a.at));
  }

  // ─────────────── Relances : POST /api/prospects/:id/tasks ───────────────

  async listTasks(): Promise<ProspectTask[]> {
    return (await this.byWorkspace('prospect_tasks')).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  async tasksFor(prospectId: string): Promise<ProspectTask[]> {
    const list = await this.db.getAllFromIndex('prospect_tasks', 'prospectId', prospectId);
    return list.filter((t) => t.workspaceId === this.ctx.workspaceId).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  /** La « prochaine relance » d'un prospect = la plus proche de ses tâches ouvertes. */
  private async syncNextFollowUp(prospectId: string) {
    const p = await this.getProspect(prospectId);
    if (!p) return;
    const next = (await this.tasksFor(prospectId)).find((t) => !t.done)?.dueAt ?? null;
    if (next !== p.nextFollowUpAt) await this.write([{ ...p, nextFollowUpAt: next }], []);
  }

  async addTask(prospectId: string, t: { type: TaskType; dueAt: string; priority: TaskPriority; note: string }): Promise<ProspectTask> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const p = await this.getProspect(prospectId);
    if (!p) throw new Error('Prospect introuvable.');
    if (p.doNotContact) throw new Error('Ce prospect est marqué « Ne plus contacter » : aucune relance possible.');
    const now = this.now();
    const task: ProspectTask = { id: uid(), workspaceId: this.ctx.workspaceId, createdAt: now, updatedAt: now, createdBy: this.ctx.user, prospectId, prospectName: p.name, ...t, done: false, doneAt: null };
    await this.db.put('prospect_tasks', task);
    await this.db.put('prospect_activities', this.activity(prospectId, 'task_created', `Relance programmée le ${new Date(t.dueAt).toLocaleDateString('fr-FR')}`, now));
    await this.syncNextFollowUp(prospectId);
    this.emit();
    return task;
  }

  async updateTask(id: string, patch: Partial<Pick<ProspectTask, 'type' | 'dueAt' | 'priority' | 'note'>>): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const t = this.mine(await this.db.get('prospect_tasks', id));
    if (!t) throw new Error('Relance introuvable.');
    await this.db.put('prospect_tasks', { ...t, ...patch, updatedAt: this.now() });
    await this.syncNextFollowUp(t.prospectId);
    this.emit();
  }

  async completeTask(id: string): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const t = this.mine(await this.db.get('prospect_tasks', id));
    if (!t) throw new Error('Relance introuvable.');
    const now = this.now();
    await this.db.put('prospect_tasks', { ...t, done: true, doneAt: now, updatedAt: now });
    await this.db.put('prospect_activities', this.activity(t.prospectId, 'task_done', 'Relance terminée', now));
    await this.syncNextFollowUp(t.prospectId);
    this.emit();
  }

  async postponeTask(id: string, days: number): Promise<void> {
    const t = this.mine(await this.db.get('prospect_tasks', id));
    if (!t) throw new Error('Relance introuvable.');
    const base = new Date(Math.max(Date.now(), new Date(t.dueAt).getTime()));
    base.setDate(base.getDate() + days);
    await this.updateTask(id, { dueAt: base.toISOString() });
  }

  async deleteTask(id: string): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const t = this.mine(await this.db.get('prospect_tasks', id));
    if (!t) return;
    await this.db.delete('prospect_tasks', id);
    await this.syncNextFollowUp(t.prospectId);
    this.emit();
  }

  // ─────────────── Segments : /api/segments ───────────────

  async listSegments(): Promise<Segment[]> {
    return (await this.byWorkspace('prospect_segments')).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  async getSegment(id: string): Promise<Segment | undefined> {
    return this.mine(await this.db.get('prospect_segments', id));
  }

  async saveSegment(s: Pick<Segment, 'name' | 'description' | 'filter'> & { id?: string }): Promise<Segment> {
    assertCan(this.ctx.role, 'prospecting.edit');
    if (!s.name.trim()) throw new Error('Donnez un nom au segment.');
    const now = this.now();
    const existing = s.id ? await this.getSegment(s.id) : undefined;
    const seg: Segment = {
      id: existing?.id ?? uid(),
      workspaceId: this.ctx.workspaceId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      createdBy: existing?.createdBy ?? this.ctx.user,
      name: s.name.trim(),
      description: s.description.trim(),
      filter: { ...s.filter, q: s.filter.q || undefined },
    };
    await this.db.put('prospect_segments', seg);
    this.emit();
    return seg;
  }

  async deleteSegment(id: string): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.edit');
    if (await this.getSegment(id)) await this.db.delete('prospect_segments', id);
    this.emit();
  }

  // ─────────────── Modèles de messages ───────────────

  async listTemplates(): Promise<MessageTemplate[]> {
    let list = await this.byWorkspace('message_templates');
    if (list.length === 0) {
      const now = this.now();
      list = builtInTemplates().map((t) => ({ ...t, id: uid(), workspaceId: this.ctx.workspaceId, createdAt: now, updatedAt: now, createdBy: 'system', builtIn: true }));
      const tx = this.db.transaction('message_templates', 'readwrite');
      await Promise.all(list.map((t) => tx.store.put(t)));
      await tx.done;
    }
    const order = TEMPLATE_CATEGORIES.map((c) => c.id);
    return list.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name, 'fr'));
  }

  async saveTemplate(t: Pick<MessageTemplate, 'name' | 'category' | 'subject' | 'body'> & { id?: string }): Promise<MessageTemplate> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const now = this.now();
    const existing = t.id ? this.mine(await this.db.get('message_templates', t.id)) : undefined;
    const tpl: MessageTemplate = {
      id: existing?.id ?? uid(),
      workspaceId: this.ctx.workspaceId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      createdBy: existing?.createdBy ?? this.ctx.user,
      builtIn: existing?.builtIn ?? false,
      name: t.name.trim() || 'Sans titre',
      category: t.category,
      subject: t.subject,
      body: t.body,
    };
    await this.db.put('message_templates', tpl);
    this.emit();
    return tpl;
  }

  async deleteTemplate(id: string): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.edit');
    if (this.mine(await this.db.get('message_templates', id))) await this.db.delete('message_templates', id);
    this.emit();
  }

  // ─────────────── POST /api/prospects/:id/generate-message ───────────────

  async generateMessageFor(prospectId: string, templateId: string, useAI: boolean, ai?: MessageProvider) {
    const p = await this.getProspect(prospectId);
    if (!p) throw new Error('Prospect introuvable.');
    const template = this.mine(await this.db.get('message_templates', templateId));
    if (!template) throw new Error('Modèle introuvable.');
    const msg = await generateMessage({ prospect: p, template, settings: await this.getSettings() }, useAI, ai);
    await this.db.put('prospect_activities', this.activity(prospectId, 'message', `Message préparé (${template.name}${msg.provider === 'ai' ? ', IA' : ''})`));
    return msg;
  }

  // ─────────────── Campagnes ───────────────

  async listCampaigns(): Promise<Campaign[]> {
    return (await this.byWorkspace('prospect_campaigns')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.mine(await this.db.get('prospect_campaigns', id));
  }

  /** Aperçu avant création : destinataires retenus et exclus (avec la raison). */
  async previewCampaign(filter: ProspectFilter) {
    const ids = await this.matchingIds({ ...filter, includeDoNotContact: true }, 'score');
    const prospects = await this.getProspects(ids);
    const suppressed = await this.suppressionSet();
    const included: Prospect[] = [];
    const excluded: Campaign['excluded'] = [];
    let missingData = 0;
    for (const p of prospects) {
      let reason: ExclusionReason | null = null;
      if (p.demo) reason = 'demo';
      else if (p.doNotContact || p.status === 'do_not_contact') reason = 'do_not_contact';
      else if (this.matchesSuppression(suppressed, p)) reason = 'suppression';
      else if (p.status === 'client') reason = 'client';
      else if (!p.email) reason = 'no_email';
      if (reason) excluded.push({ prospectId: p.id, name: p.name, reason });
      else {
        included.push(p);
        if (!p.city || !(p.services.length || p.activity)) missingData++;
      }
    }
    const count = (r: ExclusionReason) => excluded.filter((e) => e.reason === r).length;
    return {
      included,
      excluded,
      counts: {
        total: prospects.length,
        recipients: included.length,
        excluded: excluded.length,
        doNotContact: count('do_not_contact') + count('suppression'),
        noEmail: count('no_email'),
        demo: count('demo'),
        clients: count('client'),
        missingData,
      },
    };
  }

  async createCampaign(input: { name: string; segmentId: string | null; filter: ProspectFilter; templateId: string; testMode: boolean }): Promise<Campaign> {
    assertCan(this.ctx.role, 'prospecting.campaign');
    const template = this.mine(await this.db.get('message_templates', input.templateId));
    if (!template) throw new Error('Choisissez un modèle de message.');
    const settings = await this.getSettings();
    const preview = await this.previewCampaign(input.filter);
    const recipients: CampaignRecipient[] = [];
    for (const p of preview.included) {
      const msg = await generateMessage({ prospect: p, template, settings }, false);
      recipients.push({ prospectId: p.id, name: p.name, email: p.email, phone: p.phone, subject: msg.subject, body: msg.body, state: 'pending', sentAt: null });
    }
    const now = this.now();
    const c: Campaign = {
      id: uid(),
      workspaceId: this.ctx.workspaceId,
      createdAt: now,
      updatedAt: now,
      createdBy: this.ctx.user,
      name: input.name.trim() || 'Campagne',
      segmentId: input.segmentId,
      templateId: input.templateId,
      status: 'draft',
      testMode: input.testMode,
      recipients,
      excluded: preview.excluded,
      validatedAt: null,
    };
    await this.db.put('prospect_campaigns', c);
    this.emit();
    return c;
  }

  async saveCampaign(c: Campaign): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.campaign');
    if (c.workspaceId !== this.ctx.workspaceId) throw new Error('Campagne introuvable.');
    await this.db.put('prospect_campaigns', { ...c, updatedAt: this.now() });
    this.emit();
  }

  /** Validation manuelle obligatoire avant tout envoi. */
  async validateCampaign(id: string): Promise<Campaign> {
    const c = await this.getCampaign(id);
    if (!c) throw new Error('Campagne introuvable.');
    const next: Campaign = { ...c, status: 'validated', validatedAt: this.now() };
    await this.saveCampaign(next);
    return next;
  }

  /**
   * Marque un message comme envoyé par l'utilisateur (depuis sa messagerie).
   * En mode test, le prospect n'est pas modifié (le message part vers l'adresse de l'administrateur).
   */
  async markRecipient(campaignId: string, prospectId: string, state: CampaignRecipient['state']): Promise<Campaign> {
    const c = await this.getCampaign(campaignId);
    if (!c) throw new Error('Campagne introuvable.');
    if (c.status === 'draft') throw new Error('Validez la campagne avant d’envoyer les messages.');
    const r = c.recipients.find((x) => x.prospectId === prospectId);
    if (!r) throw new Error('Destinataire introuvable.');
    if (state === 'sent' && !c.testMode) {
      const p = await this.getProspect(prospectId);
      if (!p || p.doNotContact) throw new Error('Ce prospect ne peut plus être contacté.');
      await this.logContact(prospectId, 'email', `E-mail envoyé (campagne « ${c.name} »)`);
    }
    if (state === 'replied' && !c.testMode) {
      const p = await this.getProspect(prospectId);
      if (p && !['replied', 'interested', 'demo_scheduled', 'demo_done', 'trial', 'client'].includes(p.status)) await this.setStatus(prospectId, 'replied');
    }
    const recipients = c.recipients.map((x) => (x.prospectId === prospectId ? { ...x, state, sentAt: state === 'sent' ? this.now() : x.sentAt } : x));
    const done = recipients.every((x) => x.state !== 'pending' && x.state !== 'opened');
    const next: Campaign = { ...c, recipients, status: done ? 'done' : 'running' };
    await this.saveCampaign(next);
    return next;
  }

  async deleteCampaign(id: string): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.campaign');
    if (await this.getCampaign(id)) await this.db.delete('prospect_campaigns', id);
    this.emit();
  }

  // ─────────────── Divers ───────────────

  /** Recalcule tous les scores (après une évolution des règles). */
  async rescoreAll(onProgress?: (done: number, total: number) => void): Promise<number> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const ids = (await this.allRows()).map((r) => r.id);
    let changed = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const batch = await this.getProspects(ids.slice(i, i + 500));
      const updated = batch.filter((p) => computeScore(p).score !== p.score).map((p) => finalize(p));
      changed += updated.length;
      await this.write(updated, updated.map((p) => this.activity(p.id, 'score', `Score recalculé : ${p.score}`)));
      onProgress?.(Math.min(ids.length, i + 500), ids.length);
      await yieldToUI();
    }
    this.emit();
    return changed;
  }

  /** Efface toutes les données de ce workspace (sauf paramètres). */
  async clearWorkspace(onlyDemo = false): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.delete');
    const rows = await this.allRows();
    const ids = rows.filter((r) => !onlyDemo || r.demo).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) await this.deleteProspects(ids.slice(i, i + 500));
    if (!onlyDemo) {
      for (const s of ['prospect_segments', 'prospect_campaigns', 'prospect_imports', 'suppression_list'] as const) {
        const list = await this.byWorkspace(s);
        await Promise.all(list.map((x) => this.db.delete(s, x.id)));
      }
    }
    this.emit();
  }

  /** Sauvegarde JSON complète du workspace (à conserver : les données ne sont que sur cet appareil). */
  async exportBackup() {
    const w = this.ctx.workspaceId;
    const get = <S extends 'prospects' | 'prospect_notes' | 'prospect_activities' | 'prospect_tasks' | 'prospect_segments' | 'prospect_campaigns' | 'message_templates' | 'prospect_imports' | 'suppression_list'>(s: S) =>
      this.db.getAllFromIndex(s, 'workspaceId', w as never);
    return {
      app: 'paysapro-prospection',
      version: 1,
      exportedAt: this.now(),
      settings: await this.getSettings(),
      prospects: await get('prospects'),
      notes: await get('prospect_notes'),
      activities: await get('prospect_activities'),
      tasks: await get('prospect_tasks'),
      segments: await get('prospect_segments'),
      campaigns: await get('prospect_campaigns'),
      templates: await get('message_templates'),
      imports: await get('prospect_imports'),
      suppression: await get('suppression_list'),
    };
  }

  async restoreBackup(data: Awaited<ReturnType<ProspectsApi['exportBackup']>>): Promise<void> {
    assertCan(this.ctx.role, 'prospecting.import');
    if (data?.app !== 'paysapro-prospection') throw new Error("Ce fichier n'est pas une sauvegarde de Paysapro Prospection.");
    const w = this.ctx.workspaceId;
    const own = <T extends { workspaceId: string }>(list: T[] = []) => list.map((x) => ({ ...x, workspaceId: w }));
    await this.clearWorkspace();
    await this.db.put('settings', { ...data.settings, workspaceId: w });
    const prospects = own(data.prospects);
    for (let i = 0; i < prospects.length; i += 500) await this.write(prospects.slice(i, i + 500), []);
    const put = async <S extends 'prospect_notes' | 'prospect_activities' | 'prospect_tasks' | 'prospect_segments' | 'prospect_campaigns' | 'message_templates' | 'prospect_imports' | 'suppression_list'>(s: S, list: ProspectingValue<S>[]) => {
      const tx = this.db.transaction(s, 'readwrite');
      await Promise.all(list.map((x) => tx.store.put(x)));
      await tx.done;
    };
    const existingTemplates = await this.byWorkspace('message_templates');
    await Promise.all(existingTemplates.map((t) => this.db.delete('message_templates', t.id)));
    await put('prospect_notes', own(data.notes));
    await put('prospect_activities', own(data.activities));
    await put('prospect_tasks', own(data.tasks));
    await put('prospect_segments', own(data.segments));
    await put('prospect_campaigns', own(data.campaigns));
    await put('message_templates', own(data.templates));
    await put('prospect_imports', own(data.imports));
    await put('suppression_list', own(data.suppression));
    this.rows = null;
    this.emit();
  }
}

type ProspectingValue<S extends string> = S extends 'prospect_notes'
  ? ProspectNote
  : S extends 'prospect_activities'
    ? ProspectActivity
    : S extends 'prospect_tasks'
      ? ProspectTask
      : S extends 'prospect_segments'
        ? Segment
        : S extends 'prospect_campaigns'
          ? Campaign
          : S extends 'message_templates'
            ? MessageTemplate
            : S extends 'prospect_imports'
              ? ImportReport
              : SuppressionEntry;
