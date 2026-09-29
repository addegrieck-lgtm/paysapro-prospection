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
  CompanyEmail,
  CompanyPhone,
  CompanyWebsite,
  ContactChange,
  ContactEvidence,
  DuplicateCandidate,
  DuplicateRule,
  EnrichmentAttempt,
  EnrichmentFeedback,
  EnrichmentJob,
  EnrichmentLog,
  EnrichmentMode,
  FeedbackType,
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
  SourcePerformance,
  StrategyStat,
  SuppressionEntry,
  SuppressionKind,
  TaskPriority,
  TaskType,
} from '../domain/types';
import { adminComplete, anonymize, applyManualEdit, applyStatus, combineProspects, createProspect, finalize, mergeProspect, originFor, toRow, upgradeProspect, type MergeMode, type ProspectInput } from '../domain/prospect';
import { DedupeIndex, MATCH_LABEL } from '../domain/dedupe';
import { applyEnrichment, type EnrichmentApplication } from '../domain/enrichment';
import { setScoringContext } from '../domain/scoring';
import { ProviderError } from '../providers/http';
import type { CompanyDataProvider, EnrichOutcome } from '../providers/company/CompanyDataProvider';
import { ENRICHMENT_CONFIG } from '../config';
import { CONTACT_STORES, LEARNING_PROSPECT_STORES, type ContactStore } from './db';
import { applyPrimaryContacts, contactKey, contactsFromFields, newEmail, newPhone, newWebsite, upsertContact, type ContactKind } from '../domain/contactSync';
import { addEvidence, rescore } from '../domain/contacts';
import { nationalPhone, phoneType, toE164 } from '../domain/phone';
import { applyFeedback, applyRun, emptyStat, segmentOf, statKey, type RunOutcome } from '../domain/learning';
import { STRATEGY_BY_ID } from '../domain/strategies';

type AnyContact = CompanyPhone | CompanyEmail | CompanyWebsite;
export type EnrichPriority = 'all' | 'no_phone' | 'no_email' | 'no_website' | 'priority' | 'new';
const LEARNING_STORES = ['enrichment_strategy_stats', 'source_performance', ...LEARNING_PROSPECT_STORES] as const;

export interface ContactSet {
  phones: CompanyPhone[];
  emails: CompanyEmail[];
  websites: CompanyWebsite[];
}

const CONTACT_STORE_OF: Record<ContactKind, ContactStore> = { phone: 'company_phones', email: 'company_emails', website: 'company_websites' };
const CONTACT_LABEL: Record<ContactKind, string> = { phone: 'Téléphone', email: 'E-mail', website: 'Site' };
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
    autoQualify: false,
    providers: { official: true, directory: true, website: true, websiteDiscovery: true },
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
  /** Identifiants des fiches créées ou mises à jour (pour les enrichir ensuite) */
  onWritten?: (ids: string[]) => void;
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
  search: 'la recherche d’entreprises (données publiques)',
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

  private async byWorkspace<
    S extends
      | 'prospect_rows'
      | 'prospect_tasks'
      | 'prospect_segments'
      | 'prospect_campaigns'
      | 'message_templates'
      | 'prospect_imports'
      | 'suppression_list'
      | 'enrichment_queue'
      | 'enrichment_logs'
      | 'duplicate_candidates'
      | ContactStore
      | (typeof LEARNING_STORES)[number],
  >(store: S) {
    // (le typage générique d'idb ne sait pas exprimer « toutes ces tables ont un index workspaceId »)
    return this.db.getAllFromIndex(store, 'workspaceId', this.ctx.workspaceId as never);
  }

  // ─────────────── Paramètres ───────────────

  async getSettings(): Promise<Settings> {
    const s = { ...defaultSettings(this.ctx.workspaceId), ...(await this.db.get('settings', this.ctx.workspaceId)) };
    setScoringContext({ targetDepartments: s.targetDepartments });
    return s;
  }

  async saveSettings(s: Settings): Promise<void> {
    await this.db.put('settings', { ...s, workspaceId: this.ctx.workspaceId });
    setScoringContext({ targetDepartments: s.targetDepartments });
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

  /**
   * POST /api/enrichment/batch — les N entreprises à enrichir en priorité (filtres actuels) : sans téléphone,
   * sans e-mail, sans site, prospects prioritaires (score) ou nouveaux. Jamais les fiches de démonstration
   * ni les « Ne plus contacter ». Par défaut : jamais enrichies d'abord, puis meilleur score.
   */
  async enrichmentBatch(filter: ProspectFilter, priority: EnrichPriority, limit: number): Promise<string[]> {
    let rows = (await this.allRows()).filter((r) => matchesFilter(r, filter) && !r.demo && !r.doNotContact);
    if (priority === 'no_phone') rows = rows.filter((r) => !r.phone);
    if (priority === 'no_email') rows = rows.filter((r) => !r.email);
    if (priority === 'no_website') rows = rows.filter((r) => !r.website);
    rows.sort((a, b) =>
      priority === 'new' ? b.createdAt.localeCompare(a.createdAt) : priority === 'priority' ? b.score - a.score : Number(!!a.enrichedAt) - Number(!!b.enrichedAt) || b.score - a.score,
    );
    return rows.slice(0, limit).map((r) => r.id);
  }

  async countMatching(filter: ProspectFilter): Promise<number> {
    return (await this.allRows()).filter((r) => matchesFilter(r, filter)).length;
  }

  // ─────────────── GET /api/prospects/:id ───────────────

  async getProspect(id: string): Promise<Prospect | undefined> {
    assertCan(this.ctx.role, 'prospecting.view');
    const p = this.mine(await this.db.get('prospects', id));
    return p ? upgradeProspect(p) : undefined;
  }

  async getProspects(ids: string[]): Promise<Prospect[]> {
    const tx = this.db.transaction('prospects');
    const list = await Promise.all(ids.map((id) => tx.store.get(id)));
    return list.filter((p): p is Prospect => !!this.mine(p)).map(upgradeProspect);
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
    await this.syncFieldContacts([p]);
    this.emit();
    return p;
  }

  // ─────────────── PATCH /api/prospects/:id ───────────────

  async updateProspect(id: string, patch: ProspectInput, label = 'Fiche modifiée'): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const existing = await this.getProspect(id);
    if (!existing) throw new Error('Prospect introuvable.');
    const now = this.now();
    // Une saisie manuelle peut aussi VIDER un champ ; chaque champ modifié devient de source « Manuel ».
    const { prospect: next, changed } = applyManualEdit(existing, patch, now, this.ctx.user);
    const acts = [this.activity(id, 'updated', changed.length ? `${label} (${changed.length} champ(s))` : label, now)];
    if (next.score !== existing.score) acts.push(this.activity(id, 'score', `Score recalculé : ${existing.score} → ${next.score}`, now));
    await this.write([next], acts);
    const contactFields = (['phone', 'email', 'website'] as const).filter((k) => changed.includes(k));
    if (contactFields.length) {
      for (const f of contactFields) await this.correctionSignal(existing, f, next[f], now);
      await this.syncFieldContacts([next]);
    }
    this.emit();
    return (await this.getProspect(id)) ?? next;
  }

  /**
   * Signal CRM « donnée corrigée » (règle explicite, documentée) : quand l'utilisateur remplace ou efface À LA MAIN
   * une valeur principale trouvée automatiquement, l'ancienne est comptée comme INCORRECTE pour la stratégie qui
   * l'avait trouvée — sauf un téléphone remplacé par un numéro d'un autre type (fixe ↔ mobile), considéré comme
   * un numéro supplémentaire. L'ancienne valeur est conservée dans l'historique.
   */
  private async correctionSignal(before: Prospect, field: ContactKind, newValue: string | null, now: string) {
    const oldValue = before[field];
    if (!oldValue || oldValue === newValue) return;
    await this.logChange(before.id, field, oldValue, newValue, newValue ? 'Correction manuelle' : 'Valeur effacée à la main', 'Saisie manuelle', now);
    if (before.fieldSources[field]?.type === 'manual') return; // l'utilisateur corrige sa propre saisie : pas un signal
    if (field === 'phone' && newValue) {
      const a = toE164(oldValue);
      const b = toE164(newValue);
      if (a && b && phoneType(a) !== phoneType(b)) return;
    }
    const key = contactKey(field, oldValue);
    const c = (await this.contactsFor(before.id))[`${field === 'phone' ? 'phones' : field === 'email' ? 'emails' : 'websites'}`].find((x) => x.value === key);
    if (!c || c.manual || c.status === 'rejected') return;
    await this.recordContactFeedback(before, field, c, 'incorrect', newValue ? 'correction manuelle de la fiche' : 'valeur effacée de la fiche', newValue);
    await this.db.put(CONTACT_STORE_OF[field], { ...c, status: 'rejected', isPrimary: false, feedback: 'incorrect', updatedAt: now } as never);
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
      next = finalize({ ...p, doNotContact: true, doNotContactReason: reason, status: 'do_not_contact', nextFollowUpAt: null, oppositionAt: now, updatedAt: now });
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
    const stores = ['prospects', 'prospect_rows', 'prospect_notes', 'prospect_activities', 'prospect_tasks', 'enrichment_queue', 'enrichment_logs', 'duplicate_candidates', ...CONTACT_STORES, ...LEARNING_PROSPECT_STORES] as const;
    const tx = this.db.transaction(stores, 'readwrite');
    const removed = new Set(prospects.map((p) => p.id));
    for (const p of prospects) {
      await tx.objectStore('prospects').delete(p.id);
      await tx.objectStore('prospect_rows').delete(p.id);
      // (les statistiques d'apprentissage, agrégées et sans donnée personnelle, sont conservées)
      for (const s of ['prospect_notes', 'prospect_activities', 'prospect_tasks', 'enrichment_queue', 'enrichment_logs', ...CONTACT_STORES, ...LEARNING_PROSPECT_STORES] as const) {
        const keys = await tx.objectStore(s).index('prospectId').getAllKeys(p.id);
        for (const k of keys) await tx.objectStore(s).delete(k);
      }
    }
    if (removed.size) {
      const dups = await tx.objectStore('duplicate_candidates').index('workspaceId').getAll(this.ctx.workspaceId);
      for (const d of dups) if (removed.has(d.prospectIdA) || removed.has(d.prospectIdB)) await tx.objectStore('duplicate_candidates').delete(d.id);
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
    const index = new DedupeIndex(rows.map((r) => ({ id: r.id, siret: r.siret, siren: r.siren, phone: r.phone, name: r.name, city: r.city, address: r.address, website: r.website, email: r.email })));
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
      const candidates: DuplicateCandidate[] = [];

      // Lecture groupée des fiches existantes qui vont être fusionnées
      const matches = batch.map((l) => (l.input ? index.find({ siret: l.input.siret ?? null, siren: l.input.siren ?? null, phone: l.input.phone ?? null, name: l.input.name ?? '', city: l.input.city ?? null, address: l.input.address ?? null, website: l.input.website ?? null, email: l.input.email ?? null }) : null));
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
        const match = matches[i] ?? index.find({ siret: input.siret ?? null, siren: input.siren ?? null, phone: input.phone ?? null, name: input.name ?? '', city: input.city ?? null, address: input.address ?? null, website: input.website ?? null, email: input.email ?? null });
        const existing = match ? pending.get(match.id) : undefined;
        const origin = originFor(opts.source, now, opts.source === 'csv' || opts.source === 'enrichment' ? opts.label : undefined);
        if (match && existing && match.exact) {
          const { prospect, changed } = mergeProspect(existing, input, mergeMode, now, origin);
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
          pushError(l.line, match ? `Correspondance incertaine (${MATCH_LABEL[match.rule]}) : ajoutez le SIREN ou le SIRET pour enrichir cette fiche` : 'Aucun prospect correspondant (SIRET / SIREN / nom + adresse / nom + téléphone)');
          return;
        }
        const p = createProspect({ ...input, lastVerifiedAt: opts.source === 'sirene' ? now : (input.lastVerifiedAt ?? null) }, { ...ctx, now }, opts.source, origin);
        if (!p.name) {
          report.invalid++;
          pushError(l.line, 'Nom de l’entreprise manquant');
          return;
        }
        pending.set(p.id, p);
        touched.add(p.id);
        index.add({ id: p.id, siret: p.siret, siren: p.siren, phone: p.phone, name: p.name, city: p.city, address: p.address, website: p.website, email: p.email });
        report.added++;
        // Correspondance incertaine (même téléphone, même nom + ville) : doublon potentiel à vérifier, jamais fusionné d'office
        if (match && !match.exact) {
          report.candidates = (report.candidates ?? 0) + 1;
          candidates.push(this.candidate(match.id, p.id, match.rule, now));
        }
        activities.push(this.activity(p.id, 'imported', `Prospect importé depuis ${SOURCE_LABEL[opts.source]}`, now));
        activities.push(this.activity(p.id, 'score', `Score calculé : ${p.score}`, now));
      });

      const written = Array.from(touched, (id) => pending.get(id)!);
      await this.write(written, activities);
      await this.syncFieldContacts(written);
      opts.onWritten?.(written.map((p) => p.id));
      if (candidates.length) {
        const tx = this.db.transaction('duplicate_candidates', 'readwrite');
        await Promise.all(candidates.map((c) => tx.store.put(c)));
        await tx.done;
      }
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

  // ─────────────── POST /api/prospects/:id/enrich ───────────────

  /** Le prospect a-t-il été enrichi récemment (cache ENRICHMENT_CACHE_DAYS) ? */
  isFreshlyEnriched(p: Pick<Prospect, 'enrichedAt' | 'enrichmentError'>, now = Date.now()): boolean {
    return !!p.enrichedAt && !p.enrichmentError && now - new Date(p.enrichedAt).getTime() < ENRICHMENT_CONFIG.cacheDays * 86_400_000;
  }

  /** Statut d'enrichissement « au repos » d'une fiche (hors file d'attente). */
  private settledStatus(p: Prospect): Prospect['enrichmentStatus'] {
    if (!p.enrichedAt) return 'none';
    if (p.enrichmentError) return 'failed';
    return adminComplete(p) ? 'enriched' : 'partial';
  }

  /**
   * Enrichit un prospect depuis la source officielle gratuite.
   * Ne remplace jamais une donnée manuelle, enregistre la source de chaque champ, journalise l'opération.
   * Les erreurs réseau sont transformées en message clair : le prospect reste enregistré.
   */
  async enrichProspect(
    id: string,
    provider: CompanyDataProvider,
    opts: { force?: boolean; signal?: AbortSignal } = {},
  ): Promise<{ application: EnrichmentApplication | null; outcome: EnrichOutcome | null; skipped: boolean; error: string | null }> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const p = await this.getProspect(id);
    if (!p) throw new Error('Prospect introuvable.');
    if (p.demo) throw new Error('Donnée de démonstration : entreprise fictive, elle ne peut pas être enrichie.');
    if (p.anonymized) throw new Error('Prospect anonymisé : il ne peut plus être enrichi.');
    if (!opts.force && this.isFreshlyEnriched(p)) {
      if (p.enrichmentStatus === 'pending' || p.enrichmentStatus === 'processing') {
        await this.write([{ ...p, enrichmentStatus: this.settledStatus(p) }], []);
        this.emit();
      }
      return { application: null, outcome: null, skipped: true, error: null };
    }
    const startedAt = this.now();
    let outcome: EnrichOutcome;
    try {
      outcome = await provider.enrich(p, { force: opts.force, signal: opts.signal });
    } catch (e) {
      const message = e instanceof ProviderError ? e.message : 'Impossible de récupérer les données actuellement. Le prospect reste enregistré : vous pourrez relancer l’enrichissement plus tard.';
      console.error('[enrichissement]', id, e);
      if (e instanceof ProviderError && e.kind === 'aborted') throw e;
      const failed: Prospect = { ...p, enrichmentStatus: 'failed', enrichmentError: message, enrichedAt: this.now() };
      await this.write([failed], [this.activity(id, 'enriched', 'Enrichissement automatique : échec', startedAt)]);
      await this.log({ prospectId: id, provider: provider.id, status: 'failed', startedAt, fieldsUpdated: [], fieldsConfirmed: [], fromCache: false, error: e instanceof ProviderError ? e.detail : String(e) });
      this.emit();
      return { application: null, outcome: null, skipped: false, error: message };
    }
    const now = this.now();
    const application = applyEnrichment(p, outcome, now);
    const act = this.activity(id, 'enriched', outcome.status === 'found' ? 'Enrichissement automatique' : 'Enrichissement automatique : entreprise non identifiée', now);
    act.details = application.details;
    const acts = [act];
    if (application.prospect.score !== p.score) acts.push(this.activity(id, 'score', `Score recalculé : ${p.score} → ${application.prospect.score}`, now));
    await this.write([application.prospect], acts);
    await this.log({
      prospectId: id,
      provider: provider.id,
      status: application.outcome,
      startedAt,
      fieldsUpdated: application.fieldsUpdated,
      fieldsConfirmed: application.fieldsConfirmed,
      fromCache: outcome.fromCache,
      error: application.prospect.enrichmentError,
    });
    // Le SIREN / SIRET récupéré peut révéler un doublon déjà présent
    if (outcome.status === 'found') await this.detectDuplicatesOf(application.prospect);
    this.emit();
    return { application, outcome, skipped: false, error: null };
  }

  /** L'utilisateur choisit la bonne entreprise parmi plusieurs candidates (recherche par nom ambiguë). */
  async chooseCompany(id: string, siret: string, provider: CompanyDataProvider) {
    const p = await this.getProspect(id);
    if (!p) throw new Error('Prospect introuvable.');
    const now = this.now();
    const origin = { ...originFor('manual', now, 'Choix parmi les données publiques'), confidence: 'high' as const };
    const { prospect } = mergeProspect(p, { siret, siren: siret.slice(0, 9) }, 'overwrite', now, origin);
    await this.write([prospect], []);
    return this.enrichProspect(id, provider, { force: true });
  }

  private async log(l: Omit<EnrichmentLog, 'id' | 'workspaceId' | 'completedAt'>) {
    await this.db.put('enrichment_logs', { ...l, id: uid(), workspaceId: this.ctx.workspaceId, completedAt: this.now() });
  }

  async enrichmentLogs(prospectId: string): Promise<EnrichmentLog[]> {
    const list = await this.db.getAllFromIndex('enrichment_logs', 'prospectId', prospectId);
    return list.filter((l) => l.workspaceId === this.ctx.workspaceId).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  // ─────────────── File d'attente d'enrichissement (persistée) ───────────────

  async queueJobs(): Promise<EnrichmentJob[]> {
    return (await this.byWorkspace('enrichment_queue')).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Ajoute des prospects à la file (sans doublon de tâche en attente). Renvoie le nombre ajouté. */
  async enqueueEnrichment(ids: string[], force = false, modeOrMax: EnrichmentMode | boolean = 'normal'): Promise<number> {
    const mode: EnrichmentMode = modeOrMax === true ? 'max' : modeOrMax === false ? 'normal' : modeOrMax;
    const maxPhones = mode === 'max';
    assertCan(this.ctx.role, 'prospecting.edit');
    const jobs = await this.queueJobs();
    const waiting = new Set(jobs.filter((j) => j.status === 'pending' || j.status === 'processing').map((j) => j.prospectId));
    const rows = new Map((await this.allRows()).map((r) => [r.id, r]));
    const now = this.now();
    const add = ids.filter((id) => !waiting.has(id) && rows.has(id) && !rows.get(id)!.demo);
    const tx = this.db.transaction('enrichment_queue', 'readwrite');
    await Promise.all(
      add.map((prospectId) =>
        tx.store.put({
          id: uid(),
          workspaceId: this.ctx.workspaceId,
          prospectId,
          status: 'pending',
          outcome: null,
          force,
          maxPhones,
          mode,
          attempts: 0,
          error: null,
          nextRetryAt: null,
          result: null,
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );
    await tx.done;
    // Statut visible dans la liste
    for (let i = 0; i < add.length; i += 500) {
      const batch = await this.getProspects(add.slice(i, i + 500));
      await this.write(batch.map((p) => ({ ...p, enrichmentStatus: 'pending' as const })), []);
    }
    this.emit();
    return add.length;
  }

  async saveJob(job: EnrichmentJob): Promise<void> {
    await this.db.put('enrichment_queue', { ...job, updatedAt: this.now() });
  }

  /** Relance les échecs (ils repassent « en attente »). */
  async retryFailedJobs(): Promise<number> {
    const failed = (await this.queueJobs()).filter((j) => j.status === 'failed');
    await Promise.all(failed.map((j) => this.saveJob({ ...j, status: 'pending', error: null, force: true, nextRetryAt: null, attempts: 0 })));
    this.emit();
    return failed.length;
  }

  /** Vide l'historique de la file (tâches terminées). */
  async clearFinishedJobs(): Promise<void> {
    const done = (await this.queueJobs()).filter((j) => j.status !== 'pending' && j.status !== 'processing');
    await Promise.all(done.map((j) => this.db.delete('enrichment_queue', j.id)));
    this.emit();
  }

  /** Annule les tâches en attente (le statut des prospects revient à l'état précédent connu). */
  async cancelPendingJobs(): Promise<void> {
    const pending = (await this.queueJobs()).filter((j) => j.status === 'pending' || j.status === 'processing');
    await Promise.all(pending.map((j) => this.db.delete('enrichment_queue', j.id)));
    const prospects = await this.getProspects(pending.map((j) => j.prospectId));
    await this.write(
      prospects.map((p) => ({ ...p, enrichmentStatus: this.settledStatus(p) })),
      [],
    );
    this.emit();
  }

  // ─────────────── Coordonnées multi-sources (company_phones / company_emails / company_websites) ───────────────

  async contactsFor(prospectId: string): Promise<ContactSet> {
    const get = async <S extends ContactStore>(s: S) => (await this.db.getAllFromIndex(s, 'prospectId', prospectId as never)).filter((c) => c.workspaceId === this.ctx.workspaceId);
    const [phones, emails, websites] = await Promise.all([get('company_phones'), get('company_emails'), get('company_websites')]);
    const order = <T extends { isPrimary: boolean; confidence: number }>(l: T[]) => l.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.confidence - a.confidence);
    return { phones: order(phones as CompanyPhone[]), emails: order(emails as CompanyEmail[]), websites: order(websites as CompanyWebsite[]) };
  }

  private async saveContacts(prospectId: string, set: ContactSet) {
    const tx = this.db.transaction(CONTACT_STORES, 'readwrite');
    const pairs: [ContactStore, (CompanyPhone | CompanyEmail | CompanyWebsite)[]][] = [
      ['company_phones', set.phones],
      ['company_emails', set.emails],
      ['company_websites', set.websites],
    ];
    for (const [store, list] of pairs) {
      const keep = new Set(list.map((c) => c.id));
      const existing = await tx.objectStore(store).index('prospectId').getAll(prospectId);
      for (const e of existing) if (!keep.has(e.id)) await tx.objectStore(store).delete(e.id);
      for (const c of list) await tx.objectStore(store).put(c as never);
    }
    await tx.done;
  }

  /** Autres entreprises (même workspace) possédant ce numéro : « ⚠ Numéro partagé ». */
  private async otherPhoneOwners(e164: string, prospectId: string): Promise<CompanyPhone[]> {
    return (await this.db.getAllFromIndex('company_phones', 'value', e164)).filter((c) => c.workspaceId === this.ctx.workspaceId && c.prospectId !== prospectId && c.status !== 'rejected');
  }

  /**
   * Fusionne des coordonnées trouvées (ou issues des champs de la fiche) avec celles déjà connues,
   * détecte les numéros partagés, recalcule la confiance, puis recopie les valeurs principales sur la fiche.
   * Ne remplace jamais une saisie manuelle. Renvoie la fiche mise à jour (non enregistrée).
   */
  async mergeContacts(p: Prospect, incoming: Partial<ContactSet> = {}, now = this.now(), reason = 'Enrichissement automatique'): Promise<{ prospect: Prospect; contacts: ContactSet; created: ContactSet }> {
    const current = await this.contactsFor(p.id);
    const fromFields = contactsFromFields(p, now);
    const created: ContactSet = { phones: [], emails: [], websites: [] };
    const merge = <T extends CompanyPhone | CompanyEmail | CompanyWebsite>(list: T[], add: T[], out: T[]) => {
      let l = list;
      for (const c of add) {
        const r = upsertContact(l, c, now);
        l = r.list;
        if (r.created) out.push(c);
      }
      return l;
    };
    let phones = merge(current.phones, [...fromFields.phones, ...(incoming.phones ?? [])], created.phones);
    const emails = merge(current.emails, [...fromFields.emails, ...(incoming.emails ?? [])], created.emails);
    const websites = merge(current.websites, [...fromFields.websites, ...(incoming.websites ?? [])], created.websites);
    // Numéro partagé par plusieurs entreprises : jamais attribué d'office, confiance réduite partout
    phones = await Promise.all(
      phones.map(async (ph) => {
        const others = await this.otherPhoneOwners(ph.value, p.id);
        const shared = others.length > 0;
        if (shared) {
          for (const o of others.filter((x) => !x.shared)) {
            await this.db.put('company_phones', rescore({ ...o, shared: true, updatedAt: now }));
            await this.refreshSummary(o.prospectId);
          }
        }
        return shared === ph.shared ? ph : rescore({ ...ph, shared, updatedAt: now });
      }),
    );
    const synced = applyPrimaryContacts(p, phones, emails, websites);
    const contacts = { phones: synced.phones, emails: synced.emails, websites: synced.websites };
    await this.saveContacts(p.id, contacts);
    // Historique : une valeur principale remplacée est conservée (ancienne → nouvelle, raison, source)
    for (const f of ['phone', 'email', 'website'] as const) {
      if (p[f] && synced.prospect[f] !== p[f]) await this.logChange(p.id, f, p[f], synced.prospect[f], reason, synced.prospect.fieldSources[f]?.provider ?? null, now);
    }
    return { prospect: finalize(synced.prospect), contacts, created };
  }

  private async logChange(prospectId: string, field: ContactKind, oldValue: string | null, newValue: string | null, reason: string, source: string | null, now = this.now()) {
    await this.db.put('contact_history', { id: uid(), workspaceId: this.ctx.workspaceId, prospectId, field, oldValue, newValue, reason, source, changedAt: now });
  }

  /**
   * Fraîcheur : toutes les coordonnées de l'entreprise sont « vérifiées » à cette date ; celles qui n'apparaissent
   * plus sur la page où elles avaient été trouvées deviennent « anciennes » (conservées, confiance −20).
   */
  async refreshContactFreshness(prospectId: string, now: string, historicalIds: string[] = []): Promise<void> {
    const c = await this.contactsFor(prospectId);
    const old = new Set(historicalIds);
    const touch = <T extends AnyContact>(l: T[]) => l.map((x) => (old.has(x.id) ? rescore({ ...x, currency: 'historical' as const, lastCheckedAt: now }) : { ...x, lastCheckedAt: now }));
    await this.saveContacts(prospectId, { phones: touch(c.phones), emails: touch(c.emails), websites: touch(c.websites) });
  }

  /** Recalcule le résumé (téléphone principal, confiance) d'une autre fiche après un changement de ses numéros. */
  private async refreshSummary(prospectId: string) {
    const p = await this.getProspect(prospectId);
    if (!p) return;
    const c = await this.contactsFor(prospectId);
    const synced = applyPrimaryContacts(p, c.phones, c.emails, c.websites);
    await this.saveContacts(prospectId, { phones: synced.phones, emails: synced.emails, websites: synced.websites });
    await this.write([finalize(synced.prospect)], []);
  }

  /** Après une écriture de fiches (import, saisie) : leurs téléphones / e-mails / sites rejoignent les tables de coordonnées. */
  private async syncFieldContacts(prospects: Prospect[]) {
    const withContacts = prospects.filter((p) => !p.demo && (p.phone || p.email || p.website));
    const updated: Prospect[] = [];
    for (const p of withContacts) {
      const { prospect } = await this.mergeContacts(p);
      if (prospect.phoneConfidence !== p.phoneConfidence || prospect.phoneStatus !== p.phoneStatus || prospect.phone !== p.phone || prospect.email !== p.email || prospect.website !== p.website)
        updated.push(prospect);
    }
    if (updated.length) await this.write(updated, []);
  }

  /** « Définir comme principal » : la coordonnée est validée par l'utilisateur (confiance 100). */
  async setPrimaryContact(kind: ContactKind, contactId: string): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const store = CONTACT_STORE_OF[kind];
    const c = this.mine(await this.db.get(store, contactId));
    if (!c) throw new Error('Coordonnée introuvable.');
    const p = await this.getProspect(c.prospectId);
    if (!p) throw new Error('Prospect introuvable.');
    const now = this.now();
    await this.recordContactFeedback(p, kind, c, 'correct', 'définie comme principale');
    const validated = rescore({ ...c, manual: true, feedback: 'correct', status: 'unverified', evidence: addEvidence(c.evidence, { kind: 'manual', provider: `Validé par ${this.ctx.user}`, url: null, at: now, matched: [] }), updatedAt: now } as CompanyPhone);
    await this.db.put(store, validated as never);
    const value = kind === 'phone' ? nationalPhone((validated as CompanyPhone).e164) : kind === 'email' ? validated.value : validated.display;
    const fiche: Prospect = { ...p, [kind]: value, fieldSources: { ...p.fieldSources, [kind]: originFor('manual', now, `Validé par ${this.ctx.user}`) } };
    const { prospect } = await this.mergeContacts(fiche, {}, now);
    await this.write([prospect], [this.activity(p.id, 'updated', `${CONTACT_LABEL[kind]} principal validé : ${validated.display}`, now)]);
    this.emit();
    return prospect;
  }

  /**
   * « ✓ Correct » : l'utilisateur confirme la coordonnée (confiance 100, jamais remplacée automatiquement).
   * Le retour est enregistré et compte pour la stratégie qui l'avait trouvée.
   */
  async confirmContact(kind: ContactKind, contactId: string): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const store = CONTACT_STORE_OF[kind];
    const c = this.mine(await this.db.get(store, contactId));
    if (!c) throw new Error('Coordonnée introuvable.');
    const p = await this.getProspect(c.prospectId);
    if (!p) throw new Error('Prospect introuvable.');
    const now = this.now();
    await this.recordContactFeedback(p, kind, c, 'correct', '✓ sur la fiche');
    const confirmed = rescore({ ...c, manual: true, feedback: 'correct', status: 'unverified', evidence: addEvidence(c.evidence, { kind: 'manual', provider: `Confirmé par ${this.ctx.user}`, url: null, at: now, matched: [] }), updatedAt: now } as CompanyPhone);
    await this.db.put(store, confirmed as never);
    const { prospect } = await this.mergeContacts(p, {}, now);
    await this.write([prospect], [this.activity(p.id, 'updated', `${CONTACT_LABEL[kind]} confirmé : ${c.display}`, now)]);
    this.emit();
    return prospect;
  }

  /** POST /api/enrichment/feedback — ✓ correct / ✗ incorrect sur une coordonnée trouvée. */
  async contactFeedback(kind: ContactKind, contactId: string, type: FeedbackType): Promise<Prospect> {
    return type === 'correct' ? this.confirmContact(kind, contactId) : this.rejectContact(kind, contactId);
  }

  /** « ✗ Incorrect » : la coordonnée ne correspond pas à l'entreprise ; elle ne sera plus proposée. */
  async rejectContact(kind: ContactKind, contactId: string): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const store = CONTACT_STORE_OF[kind];
    const c = this.mine(await this.db.get(store, contactId));
    if (!c) throw new Error('Coordonnée introuvable.');
    const p = await this.getProspect(c.prospectId);
    if (!p) throw new Error('Prospect introuvable.');
    const now = this.now();
    await this.recordContactFeedback(p, kind, c, 'incorrect', '✗ sur la fiche');
    await this.db.put(store, { ...c, status: 'rejected', manual: false, isPrimary: false, feedback: 'incorrect', updatedAt: now } as never);
    let fiche: Prospect = p;
    if (contactKey(kind, p[kind]) === c.value) {
      fiche = { ...p, [kind]: null, fieldSources: { ...p.fieldSources } };
      delete fiche.fieldSources[kind];
    }
    const { prospect } = await this.mergeContacts(fiche, {}, now);
    if (p[kind] && prospect[kind] !== p[kind]) await this.logChange(p.id, kind, p[kind], prospect[kind], `Coordonnée déclarée incorrecte (${c.display})`, 'Retour utilisateur', now);
    await this.write([prospect], [this.activity(p.id, 'updated', `${CONTACT_LABEL[kind]} écarté : ${c.display}`, now)]);
    this.emit();
    return prospect;
  }

  /** Ajoute une coordonnée saisie à la main (confiance 100). */
  async addManualContact(prospectId: string, kind: ContactKind, value: string): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const p = await this.getProspect(prospectId);
    if (!p) throw new Error('Prospect introuvable.');
    const now = this.now();
    const e: ContactEvidence = { kind: 'manual', provider: 'Saisie manuelle', url: null, at: now, matched: [] };
    const c = kind === 'phone' ? newPhone(p, value, e, now) : kind === 'email' ? newEmail(p, value, e, now) : newWebsite(p, value, e, now);
    if (!c) throw new Error(kind === 'phone' ? 'Numéro invalide.' : kind === 'email' ? 'Adresse e-mail invalide.' : 'Adresse de site invalide.');
    const incoming: Partial<ContactSet> = kind === 'phone' ? { phones: [c as CompanyPhone] } : kind === 'email' ? { emails: [c as CompanyEmail] } : { websites: [c as CompanyWebsite] };
    const { prospect } = await this.mergeContacts(p, incoming, now);
    await this.write([prospect], [this.activity(p.id, 'updated', `${CONTACT_LABEL[kind]} ajouté manuellement : ${c.display}`, now)]);
    this.emit();
    return prospect;
  }

  /**
   * « 📇 Ajouter au CRM » : les prospects passent au statut « À contacter » (CRM actif).
   * Jamais pour un prospect « Ne plus contacter », une donnée de démonstration ou un prospect déjà en cours.
   */
  async addToCrm(ids: string[]): Promise<number> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const now = this.now();
    const eligible = (await this.getProspects(ids)).filter((p) => !p.doNotContact && !p.demo && ['new', 'to_qualify', 'not_now'].includes(p.status));
    for (let i = 0; i < eligible.length; i += 500) {
      const batch = eligible.slice(i, i + 500);
      await this.write(
        batch.map((p) => ({ ...applyStatus(p, 'to_contact', now), qualifiedAt: now })),
        batch.map((p) => this.activity(p.id, 'status', `Ajouté au CRM : ${STATUS_LABEL[p.status]} → ${STATUS_LABEL.to_contact}`, now)),
      );
    }
    this.emit();
    return eligible.length;
  }

  /** Enregistre le résultat du moteur d'enrichissement : fiche, entrée d'historique détaillée, journal. */
  async saveEngineResult(p: Prospect, label: string, details: string[], log: Omit<EnrichmentLog, 'id' | 'workspaceId' | 'completedAt' | 'prospectId'>): Promise<void> {
    const act = this.activity(p.id, 'enriched', label);
    act.details = details;
    const before = await this.getProspect(p.id);
    const acts = [act];
    const final = finalize(p);
    if (before && before.score !== final.score) acts.push(this.activity(p.id, 'score', `Score recalculé : ${before.score} → ${final.score}`));
    if (before && before.status !== final.status) acts.push(this.activity(p.id, 'status', `Statut : ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[final.status]}`));
    await this.write([final], acts);
    await this.log({ ...log, prospectId: p.id });
    this.emit();
  }

  /** Journaux d'enrichissement du workspace (écran « Performance »). */
  async allEnrichmentLogs(): Promise<EnrichmentLog[]> {
    return this.byWorkspace('enrichment_logs') as Promise<EnrichmentLog[]>;
  }

  /** Tous les téléphones / e-mails / sites du workspace (statistiques de performance). */
  async allContacts(): Promise<ContactSet> {
    const [phones, emails, websites] = await Promise.all([this.byWorkspace('company_phones'), this.byWorkspace('company_emails'), this.byWorkspace('company_websites')]);
    return { phones: phones as CompanyPhone[], emails: emails as CompanyEmail[], websites: websites as CompanyWebsite[] };
  }

  // ─────────────── Moteur auto-apprenant (GET /api/enrichment/strategies, /statistics, /history) ───────────────

  /** GET /api/enrichment/strategies — statistiques par stratégie × champ × segment. */
  async strategyStats(): Promise<StrategyStat[]> {
    return this.byWorkspace('enrichment_strategy_stats') as Promise<StrategyStat[]>;
  }

  async sourcePerformance(): Promise<SourcePerformance[]> {
    return this.byWorkspace('source_performance') as Promise<SourcePerformance[]>;
  }

  async feedbackList(): Promise<EnrichmentFeedback[]> {
    return ((await this.byWorkspace('enrichment_feedback')) as EnrichmentFeedback[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Traces des stratégies exécutées (vue technique), les plus récentes d'abord. */
  async attemptLogs(prospectId?: string): Promise<EnrichmentAttempt[]> {
    const list = prospectId ? (await this.db.getAllFromIndex('enrichment_attempts', 'prospectId', prospectId)).filter((a) => a.workspaceId === this.ctx.workspaceId) : ((await this.byWorkspace('enrichment_attempts')) as EnrichmentAttempt[]);
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /** GET /api/enrichment/history/:id — changements de valeur principale (ancienne → nouvelle). */
  async contactHistory(prospectId: string): Promise<ContactChange[]> {
    return (await this.db.getAllFromIndex('contact_history', 'prospectId', prospectId)).filter((c) => c.workspaceId === this.ctx.workspaceId).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  }

  /**
   * Enregistre le résultat d'un enrichissement dans l'apprentissage (une transaction) : statistiques par stratégie
   * et par source, pour le segment de l'entreprise, et une trace par stratégie exécutée.
   */
  async recordLearning(p: Prospect, runs: RunOutcome[], attempts: Omit<EnrichmentAttempt, 'id' | 'workspaceId' | 'prospectId'>[]): Promise<void> {
    const seg = segmentOf(p);
    const now = this.now();
    const w = this.ctx.workspaceId;
    const tx = this.db.transaction(['enrichment_strategy_stats', 'source_performance', 'enrichment_attempts'], 'readwrite');
    const statStore = tx.objectStore('enrichment_strategy_stats');
    const touched = new Map<string, StrategyStat>();
    for (const r of runs) {
      for (const f of r.targeted) {
        const id = `${w}|${statKey(r.strategyId, f, seg)}`;
        if (touched.has(id)) continue;
        const s = await statStore.get(id);
        if (s) touched.set(id, s);
      }
    }
    for (const r of runs) applyRun(touched, r, seg, w, now);
    for (const s of touched.values()) await statStore.put(s);
    const srcStore = tx.objectStore('source_performance');
    for (const r of runs) {
      const def = STRATEGY_BY_ID.get(r.strategyId);
      if (!def) continue;
      for (const f of r.targeted) {
        const id = `${w}|${def.source}|${seg.sector}|${f}`;
        const s: SourcePerformance = (await srcStore.get(id)) ?? { id, workspaceId: w, source: def.source, sector: seg.sector, field: f, attempts: 0, found: 0, verified: 0, falsePositive: 0, lastUpdated: now };
        const items = r.produced[f] ?? [];
        await srcStore.put({ ...s, attempts: s.attempts + 1, found: s.found + items.length, verified: s.verified + items.filter((c) => c >= 80).length, lastUpdated: now });
      }
    }
    for (const a of attempts) await tx.objectStore('enrichment_attempts').put({ ...a, id: uid(), workspaceId: w, prospectId: p.id });
    await tx.done;
  }

  /**
   * Retour utilisateur → apprentissage : la stratégie (et la source) qui avait trouvé la coordonnée gagne une
   * confirmation ou un faux positif, dans le segment de l'entreprise. Un changement d'avis annule l'ancien retour.
   */
  private async recordContactFeedback(p: Prospect, kind: ContactKind, c: AnyContact, type: FeedbackType, origin: string, newValue: string | null = null) {
    const previous = c.feedback ?? null;
    if (previous === type) return;
    const now = this.now();
    const w = this.ctx.workspaceId;
    const seg = segmentOf(p);
    const byStrategy = c.evidence.filter((e) => e.strategy);
    const tx = this.db.transaction(['enrichment_strategy_stats', 'source_performance', 'enrichment_feedback'], 'readwrite');
    const statStore = tx.objectStore('enrichment_strategy_stats');
    const srcStore = tx.objectStore('source_performance');
    for (const e of byStrategy) {
      const id = `${w}|${statKey(e.strategy!, kind, seg)}`;
      const s = (await statStore.get(id)) ?? emptyStat(w, e.strategy!, kind, seg, now);
      await statStore.put(applyFeedback(s, type, e.score ?? c.confidence, previous));
      const def = STRATEGY_BY_ID.get(e.strategy!);
      const sp = def ? await srcStore.get(`${w}|${def.source}|${seg.sector}|${kind}`) : undefined;
      if (sp) await srcStore.put({ ...sp, falsePositive: Math.max(0, sp.falsePositive + (type === 'incorrect' ? 1 : 0) - (previous === 'incorrect' ? 1 : 0)), lastUpdated: now });
    }
    await tx.objectStore('enrichment_feedback').put({
      id: uid(),
      workspaceId: w,
      prospectId: p.id,
      field: kind,
      oldValue: c.display,
      newValue,
      source: c.evidence.find((e) => e.kind !== 'manual')?.provider ?? null,
      strategy: byStrategy[0]?.strategy ?? null,
      feedbackType: type,
      origin,
      createdAt: now,
    });
    await tx.done;
  }

  // ─────────────── Doublons potentiels ───────────────

  private candidate(a: string, b: string, rule: DuplicateRule, now: string): DuplicateCandidate {
    return { id: uid(), workspaceId: this.ctx.workspaceId, prospectIdA: a, prospectIdB: b, rule, status: 'open', createdAt: now, resolvedAt: null };
  }

  async listDuplicates(status: DuplicateCandidate['status'] | 'all' = 'open'): Promise<DuplicateCandidate[]> {
    const list = await this.byWorkspace('duplicate_candidates');
    return list.filter((c) => status === 'all' || c.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private async pairExists(a: string, b: string): Promise<boolean> {
    return (await this.listDuplicates('all')).some((c) => (c.prospectIdA === a && c.prospectIdB === b) || (c.prospectIdA === b && c.prospectIdB === a));
  }

  private async detectDuplicatesOf(p: Prospect) {
    const rows = (await this.allRows()).filter((r) => r.id !== p.id);
    const index = new DedupeIndex(rows.map((r) => ({ id: r.id, siret: r.siret, siren: r.siren, phone: r.phone, name: r.name, city: r.city, address: r.address, website: r.website, email: r.email })));
    const m = index.find({ siret: p.siret, siren: p.siren, phone: p.phone, name: p.name, city: p.city, address: p.address, website: p.website, email: p.email });
    if (m && !(await this.pairExists(m.id, p.id))) await this.db.put('duplicate_candidates', this.candidate(m.id, p.id, m.rule, this.now()));
  }

  /** Analyse toute la base à la recherche de doublons (SIRET, SIREN, nom + adresse, nom + téléphone, téléphone, nom + ville). */
  async scanDuplicates(): Promise<number> {
    const rows = await this.allRows();
    const existing = await this.listDuplicates('all');
    const known = new Set(existing.flatMap((c) => [`${c.prospectIdA}|${c.prospectIdB}`, `${c.prospectIdB}|${c.prospectIdA}`]));
    const index = new DedupeIndex();
    const now = this.now();
    const found: DuplicateCandidate[] = [];
    for (const r of rows) {
      const keys = { siret: r.siret, siren: r.siren, phone: r.phone, name: r.name, city: r.city, address: r.address, website: r.website, email: r.email };
      const m = index.find(keys, r.id);
      if (m && !known.has(`${m.id}|${r.id}`)) {
        found.push(this.candidate(m.id, r.id, m.rule, now));
        known.add(`${m.id}|${r.id}`);
        known.add(`${r.id}|${m.id}`);
      }
      index.add({ id: r.id, ...keys });
    }
    const tx = this.db.transaction('duplicate_candidates', 'readwrite');
    await Promise.all(found.map((c) => tx.store.put(c)));
    await tx.done;
    this.emit();
    return found.length;
  }

  async resolveDuplicate(id: string, resolution: 'ignored' | 'kept_both'): Promise<void> {
    const c = this.mine(await this.db.get('duplicate_candidates', id));
    if (!c) throw new Error('Doublon introuvable.');
    await this.db.put('duplicate_candidates', { ...c, status: resolution, resolvedAt: this.now() });
    this.emit();
  }

  /** Fusionne deux fiches : `keepId` est conservée et complétée ; notes, relances et historique sont regroupés. */
  async mergeDuplicate(candidateId: string, keepId: string): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.edit');
    const c = this.mine(await this.db.get('duplicate_candidates', candidateId));
    if (!c) throw new Error('Doublon introuvable.');
    const otherId = c.prospectIdA === keepId ? c.prospectIdB : c.prospectIdA;
    const [keep, other] = await Promise.all([this.getProspect(keepId), this.getProspect(otherId)]);
    if (!keep || !other) throw new Error('Une des deux fiches n’existe plus.');
    const now = this.now();
    const merged = combineProspects(keep, other, now);
    const stores = ['prospect_notes', 'prospect_activities', 'prospect_tasks'] as const;
    const tx = this.db.transaction([...stores, 'duplicate_candidates'], 'readwrite');
    for (const s of stores) {
      const items = await tx.objectStore(s).index('prospectId').getAll(otherId);
      for (const it of items) await tx.objectStore(s).put({ ...it, prospectId: keepId, ...('prospectName' in it ? { prospectName: merged.name } : {}) } as never);
    }
    const all = await tx.objectStore('duplicate_candidates').index('workspaceId').getAll(this.ctx.workspaceId);
    for (const d of all) {
      if (d.id === c.id) await tx.objectStore('duplicate_candidates').put({ ...d, status: 'merged', resolvedAt: now });
      else if (d.status === 'open' && (d.prospectIdA === otherId || d.prospectIdB === otherId)) await tx.objectStore('duplicate_candidates').put({ ...d, status: 'merged', resolvedAt: now });
    }
    await tx.done;
    // Les téléphones / e-mails / sites des deux fiches sont regroupés (preuves cumulées, pas de doublon)
    const otherContacts = await this.contactsFor(otherId);
    const moved = (<T extends CompanyPhone | CompanyEmail | CompanyWebsite>(l: T[]) => l.map((x) => ({ ...x, id: uid(), prospectId: keepId, isPrimary: false })));
    await this.saveContacts(otherId, { phones: [], emails: [], websites: [] });
    await this.db.delete('prospects', otherId);
    await this.db.delete('prospect_rows', otherId);
    this.rows?.delete(otherId);
    const { prospect: final } = await this.mergeContacts(merged, { phones: moved(otherContacts.phones), emails: moved(otherContacts.emails), websites: moved(otherContacts.websites) }, now);
    await this.write([final], [this.activity(keepId, 'merged', `Fusionné avec « ${other.name} » (${MATCH_LABEL[c.rule]})`, now)]);
    this.emit();
    return final;
  }

  // ─────────────── RGPD : anonymisation ───────────────

  /** Efface les données personnelles, conserve les données d'entreprise utiles aux statistiques, exclut définitivement. */
  async anonymizeProspect(id: string): Promise<Prospect> {
    assertCan(this.ctx.role, 'prospecting.delete');
    const p = await this.getProspect(id);
    if (!p) throw new Error('Prospect introuvable.');
    await this.addSuppressionFor(p, 'Anonymisation (RGPD)');
    const now = this.now();
    const next = anonymize(p, now);
    const tx = this.db.transaction(['prospect_notes', 'prospect_tasks', ...CONTACT_STORES, ...LEARNING_PROSPECT_STORES], 'readwrite');
    for (const s of ['prospect_notes', 'prospect_tasks', ...CONTACT_STORES, ...LEARNING_PROSPECT_STORES] as const) {
      const keys = await tx.objectStore(s).index('prospectId').getAllKeys(id);
      for (const k of keys) await tx.objectStore(s).delete(k);
    }
    await tx.done;
    await this.write([{ ...next, phoneConfidence: null, phoneStatus: null, websiteVerified: null }], [this.activity(id, 'anonymized', 'Données personnelles anonymisées (RGPD)', now)]);
    this.emit();
    return next;
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
      for (const s of ['prospect_segments', 'prospect_campaigns', 'prospect_imports', 'suppression_list', 'enrichment_queue', 'enrichment_logs', 'duplicate_candidates', ...CONTACT_STORES, ...LEARNING_STORES] as const) {
        const list = await this.byWorkspace(s);
        await Promise.all(list.map((x) => this.db.delete(s, x.id)));
      }
    }
    this.emit();
  }

  /** Sauvegarde JSON complète du workspace (à conserver : les données ne sont que sur cet appareil). */
  async exportBackup() {
    const w = this.ctx.workspaceId;
    const get = <
      S extends
        | 'prospects'
        | 'prospect_notes'
        | 'prospect_activities'
        | 'prospect_tasks'
        | 'prospect_segments'
        | 'prospect_campaigns'
        | 'message_templates'
        | 'prospect_imports'
        | 'suppression_list'
        | 'enrichment_logs'
        | 'duplicate_candidates',
    >(
      s: S,
    ) => this.db.getAllFromIndex(s, 'workspaceId', w as never);
    return {
      app: 'paysapro-prospection',
      version: 2,
      enrichmentLogs: await get('enrichment_logs'),
      duplicates: await get('duplicate_candidates'),
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
    const prospects = own(data.prospects).map(upgradeProspect);
    for (let i = 0; i < prospects.length; i += 500) await this.write(prospects.slice(i, i + 500), []);
    await this.syncFieldContacts(prospects);
    const put = async <
      S extends
        | 'prospect_notes'
        | 'prospect_activities'
        | 'prospect_tasks'
        | 'prospect_segments'
        | 'prospect_campaigns'
        | 'message_templates'
        | 'prospect_imports'
        | 'suppression_list'
        | 'enrichment_logs'
        | 'duplicate_candidates',
    >(
      s: S,
      list: ProspectingValue<S>[],
    ) => {
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
    await put('enrichment_logs', own(data.enrichmentLogs ?? []));
    await put('duplicate_candidates', own(data.duplicates ?? []));
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
              : S extends 'enrichment_logs'
                ? EnrichmentLog
                : S extends 'duplicate_candidates'
                  ? DuplicateCandidate
                  : SuppressionEntry;
