// Base IndexedDB du module (sur l'appareil, sans serveur ni abonnement).
//
// « Migrations » : chaque évolution du schéma ajoute un bloc `if (oldVersion < N)` qui CRÉE des tables
// ou des index — jamais de suppression de données. Toutes les tables sont indexées par workspaceId.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Campaign,
  CompanyEmail,
  CompanyPhone,
  CompanyWebsite,
  ContactChange,
  DuplicateCandidate,
  EnrichmentAttempt,
  EnrichmentFeedback,
  EnrichmentJob,
  EnrichmentLog,
  ImportReport,
  MessageTemplate,
  Prospect,
  ProspectActivity,
  ProspectNote,
  ProspectRow,
  ProspectTask,
  Segment,
  Settings,
  SourcePerformance,
  StrategyStat,
  SuppressionEntry,
} from '../domain/types';
import { finalize, toRow, upgradeProspect } from '../domain/prospect';
import { applyPrimaryContacts, contactsFromFields } from '../domain/contactSync';

export interface CacheEntry {
  key: string;
  data: unknown;
  fetchedAt: string;
}

export interface ProspectingDB extends DBSchema {
  prospects: {
    key: string;
    value: Prospect;
    indexes: {
      workspaceId: string;
      siren: string;
      siret: string;
      nafCode: string;
      postalCode: string;
      department: string;
      status: string;
      enrichmentStatus: string;
      score: number;
      city: string;
      phone: string;
      email: string;
    };
  };
  prospect_rows: { key: string; value: ProspectRow; indexes: { workspaceId: string } };
  prospect_notes: { key: string; value: ProspectNote; indexes: { prospectId: string; workspaceId: string } };
  prospect_activities: { key: string; value: ProspectActivity; indexes: { prospectId: string; workspaceId: string } };
  prospect_tasks: { key: string; value: ProspectTask; indexes: { prospectId: string; workspaceId: string } };
  prospect_segments: { key: string; value: Segment; indexes: { workspaceId: string } };
  prospect_campaigns: { key: string; value: Campaign; indexes: { workspaceId: string } };
  message_templates: { key: string; value: MessageTemplate; indexes: { workspaceId: string } };
  prospect_imports: { key: string; value: ImportReport; indexes: { workspaceId: string } };
  suppression_list: { key: string; value: SuppressionEntry; indexes: { workspaceId: string } };
  settings: { key: string; value: Settings };
  /** Cache des données publiques (réponses SIRENE, dates d'import par département) */
  data_cache: { key: string; value: CacheEntry };
  // v2 — enrichissement
  /** Réponses de l'API Recherche d'entreprises par SIREN / SIRET (durée : ENRICHMENT_CACHE_DAYS) */
  company_enrichment_cache: { key: string; value: CacheEntry };
  enrichment_queue: { key: string; value: EnrichmentJob; indexes: { workspaceId: string; status: string; prospectId: string } };
  enrichment_logs: { key: string; value: EnrichmentLog; indexes: { workspaceId: string; prospectId: string } };
  duplicate_candidates: { key: string; value: DuplicateCandidate; indexes: { workspaceId: string; status: string } };
  // v3 — coordonnées multi-sources (plusieurs numéros / e-mails / sites par entreprise, avec preuves)
  company_phones: { key: string; value: CompanyPhone; indexes: { workspaceId: string; prospectId: string; value: string } };
  company_emails: { key: string; value: CompanyEmail; indexes: { workspaceId: string; prospectId: string; value: string } };
  company_websites: { key: string; value: CompanyWebsite; indexes: { workspaceId: string; prospectId: string; value: string } };
  // v4 — moteur auto-apprenant (statistiques agrégées sans donnée personnelle, retours, traces, historique)
  enrichment_strategy_stats: { key: string; value: StrategyStat; indexes: { workspaceId: string } };
  source_performance: { key: string; value: SourcePerformance; indexes: { workspaceId: string } };
  enrichment_feedback: { key: string; value: EnrichmentFeedback; indexes: { workspaceId: string; prospectId: string } };
  enrichment_attempts: { key: string; value: EnrichmentAttempt; indexes: { workspaceId: string; prospectId: string } };
  contact_history: { key: string; value: ContactChange; indexes: { workspaceId: string; prospectId: string } };
}

/** Tables rattachées à un prospect (supprimées avec lui : RGPD) */
export const LEARNING_PROSPECT_STORES = ['enrichment_feedback', 'enrichment_attempts', 'contact_history'] as const;

export const CONTACT_STORES = ['company_phones', 'company_emails', 'company_websites'] as const;
export type ContactStore = (typeof CONTACT_STORES)[number];

export const DB_NAME = 'paysapro-prospection';
export const DB_VERSION = 4;

export type DB = IDBPDatabase<ProspectingDB>;

export class StorageBlockedError extends Error {
  constructor() {
    super('La prospection est ouverte dans un autre onglet avec une ancienne version. Fermez-le puis réessayez.');
    this.name = 'StorageBlockedError';
  }
}

export function openProspectingDB(name = DB_NAME): Promise<DB> {
  let rejectBlocked: (e: Error) => void = () => undefined;
  const blocked = new Promise<never>((_, reject) => (rejectBlocked = reject));
  const opening = openDB<ProspectingDB>(name, DB_VERSION, {
    blocked() {
      rejectBlocked(new StorageBlockedError());
    },
    blocking() {
      void opening.then((db) => db.close());
    },
    upgrade(db, oldVersion, _newVersion, tx) {
      // Migration 1 — création du schéma initial
      if (oldVersion < 1) {
        const prospects = db.createObjectStore('prospects', { keyPath: 'id' });
        prospects.createIndex('workspaceId', 'workspaceId');
        prospects.createIndex('siren', 'siren');
        prospects.createIndex('siret', 'siret');
        db.createObjectStore('prospect_rows', { keyPath: 'id' }).createIndex('workspaceId', 'workspaceId');
        for (const store of ['prospect_notes', 'prospect_activities', 'prospect_tasks'] as const) {
          const s = db.createObjectStore(store, { keyPath: 'id' });
          s.createIndex('prospectId', 'prospectId');
          s.createIndex('workspaceId', 'workspaceId');
        }
        for (const store of ['prospect_segments', 'prospect_campaigns', 'message_templates', 'prospect_imports', 'suppression_list'] as const) {
          db.createObjectStore(store, { keyPath: 'id' }).createIndex('workspaceId', 'workspaceId');
        }
        db.createObjectStore('settings', { keyPath: 'workspaceId' });
        db.createObjectStore('data_cache', { keyPath: 'key' });
      }
      // Migration 2 — enrichissement automatique : nouvelles tables, index, mise à niveau des fiches (sans perte)
      if (oldVersion < 2) {
        const prospects = tx.objectStore('prospects');
        for (const idx of ['nafCode', 'postalCode', 'department', 'status', 'enrichmentStatus', 'score'] as const) prospects.createIndex(idx, idx);
        db.createObjectStore('company_enrichment_cache', { keyPath: 'key' });
        const queue = db.createObjectStore('enrichment_queue', { keyPath: 'id' });
        queue.createIndex('workspaceId', 'workspaceId');
        queue.createIndex('status', 'status');
        queue.createIndex('prospectId', 'prospectId');
        const logs = db.createObjectStore('enrichment_logs', { keyPath: 'id' });
        logs.createIndex('workspaceId', 'workspaceId');
        logs.createIndex('prospectId', 'prospectId');
        const dups = db.createObjectStore('duplicate_candidates', { keyPath: 'id' });
        dups.createIndex('workspaceId', 'workspaceId');
        dups.createIndex('status', 'status');
      }
      // Migration 3 — coordonnées multi-sources (téléphones, e-mails, sites) + index de recherche
      if (oldVersion < 3) {
        const prospects = tx.objectStore('prospects');
        for (const idx of ['city', 'phone', 'email'] as const) prospects.createIndex(idx, idx);
        for (const store of CONTACT_STORES) {
          const s = db.createObjectStore(store, { keyPath: 'id' });
          s.createIndex('workspaceId', 'workspaceId');
          s.createIndex('prospectId', 'prospectId');
          s.createIndex('value', 'value');
        }
      }
      // Données existantes (v1 / v2) : un seul passage, sans perte — nouveaux champs par défaut, provenance
      // déduite de la source, score recalculé, index compact recalculé, numéros / e-mails / sites recopiés
      // dans les tables de coordonnées avec leur provenance.
      if (oldVersion >= 1 && oldVersion < 3) {
        const rows = tx.objectStore('prospect_rows');
        const stores = { phones: tx.objectStore('company_phones'), emails: tx.objectStore('company_emails'), websites: tx.objectStore('company_websites') };
        void tx
          .objectStore('prospects')
          .openCursor()
          .then(async function step(cursor): Promise<void> {
            if (!cursor) return;
            const now = new Date().toISOString();
            const upgraded = finalize(upgradeProspect(cursor.value));
            const seeded = contactsFromFields(upgraded, now);
            const synced = applyPrimaryContacts(upgraded, seeded.phones, seeded.emails, seeded.websites);
            const p = finalize(synced.prospect);
            await cursor.update(p);
            await rows.put(toRow(p));
            for (const c of synced.phones) await stores.phones.put(c);
            for (const c of synced.emails) await stores.emails.put(c);
            for (const c of synced.websites) await stores.websites.put(c);
            return step(await cursor.continue());
          });
      }
      // Migration 4 — moteur auto-apprenant : nouvelles tables uniquement (aucune donnée existante modifiée)
      if (oldVersion < 4) {
        for (const store of ['enrichment_strategy_stats', 'source_performance'] as const) db.createObjectStore(store, { keyPath: 'id' }).createIndex('workspaceId', 'workspaceId');
        for (const store of LEARNING_PROSPECT_STORES) {
          const s = db.createObjectStore(store, { keyPath: 'id' });
          s.createIndex('workspaceId', 'workspaceId');
          s.createIndex('prospectId', 'prospectId');
        }
      }
      // Migration 5 (exemple futur) : if (oldVersion < 5) { … createIndex / createObjectStore … }
    },
  });
  const p = Promise.race([opening, blocked]);
  p.catch(() => undefined);
  return p;
}
