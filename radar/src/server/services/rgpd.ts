/**
 * Conformité RGPD : durées de conservation configurables, traitement des demandes (suppression, opposition),
 * registre des traitements. Les données d'entreprises (personnes morales) ne sont pas des données personnelles,
 * mais les entrepreneurs individuels et les dirigeants personnes physiques le sont : minimisation (pas de date de
 * naissance, pas de coordonnées personnelles), finalité limitée à l'étude d'opportunités de reprise.
 */
import type { Db } from '../db/types';
import { getSettings } from './settings';

const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

export async function purgeExpired(db: Db): Promise<Record<string, number>> {
  const r = (await getSettings(db)).retention;
  const out: Record<string, number> = {};
  out.audit_logs = (await db.run('DELETE FROM audit_logs WHERE created_at < ?', [daysAgo(r.auditLogsDays)])).changes;
  out.sync_runs = (await db.run("DELETE FROM sync_runs WHERE started_at < ? AND status != 'running'", [daysAgo(r.syncJobsDays)])).changes;
  out.alerts = (await db.run('DELETE FROM alerts WHERE created_at < ?', [daysAgo(r.alertsDays)])).changes;
  out.source_payloads = (await db.run('UPDATE source_records SET payload = NULL WHERE collected_at < ? AND payload IS NOT NULL', [daysAgo(r.sourcePayloadDays)])).changes;
  // Entreprises inactives : ni opportunité, ni projet, ni mise à jour depuis la durée fixée
  out.companies = (
    await db.run(
      `DELETE FROM companies WHERE updated_at < ? AND id NOT IN (SELECT company_id FROM acquisition_opportunities) AND id NOT IN (SELECT company_id FROM acquisition_projects)`,
      [daysAgo(r.inactiveCompanyDays)],
    )
  ).changes;
  out.rate_limits = (await db.run('DELETE FROM rate_limits WHERE window_start < ?', [Math.floor(Date.now() / 1000) - 86400])).changes;
  return out;
}

/** Suppression d'une entreprise et de toutes ses données, avec opposition à toute réimportation. */
export async function eraseCompany(db: Db, siren: string, reason: string): Promise<boolean> {
  const c = await db.get<{ id: number }>('SELECT id FROM companies WHERE siren = ?', [siren]);
  const now = new Date().toISOString();
  await db.batch([
    { sql: 'INSERT INTO suppression_list (siren, reason, created_at) VALUES (?, ?, ?) ON CONFLICT(siren) DO UPDATE SET reason = excluded.reason', params: [siren, reason.slice(0, 500), now] },
    { sql: 'DELETE FROM source_records WHERE siren = ?', params: [siren] },
    ...(c ? [{ sql: 'DELETE FROM companies WHERE id = ?', params: [c.id] }] : []),
  ]);
  return !!c;
}

export const PROCESSING_REGISTER = {
  responsable: "L'utilisateur exploitant de l'instance (usage personnel / professionnel)",
  finalite: "Identification, analyse et suivi d'opportunités de reprise ou d'acquisition d'entreprises en Normandie.",
  base_legale: "Intérêt légitime (art. 6.1.f RGPD) : étude d'opportunités d'investissement à partir de données publiques d'entreprises.",
  categories_personnes: ['Dirigeants et mandataires sociaux (personnes physiques)', 'Entrepreneurs individuels', 'Contacts professionnels saisis dans l\'Acquisition Manager', 'Utilisateurs de l\'outil'],
  categories_donnees: [
    'Identité professionnelle publiée aux registres (nom, prénoms, qualité)',
    'Coordonnées professionnelles publiées par l\'entreprise',
    'Informations légales et financières publiées (BODACC, comptes publiés)',
    'Notes et documents saisis par l\'utilisateur',
  ],
  donnees_exclues: ['Date et année de naissance des dirigeants (fournies par certaines API, non conservées)', 'Données de santé, situation familiale, intentions personnelles', 'Personnes en diffusion partielle au répertoire SIRENE'],
  sources: 'Sources publiques officielles (SIRENE, RNE, BODACC), sites publics des entreprises, imports de l\'utilisateur — voir Administration → Sources.',
  destinataires: 'Uniquement les utilisateurs authentifiés de l\'instance. Aucun envoi automatique de message. Modèle d\'IA externe facultatif (désactivé par défaut).',
  duree_conservation: 'Configurable (Administration → Paramètres → Conservation) ; purge automatique quotidienne.',
  droits: "Demandes d'accès, de rectification, d'effacement et d'opposition enregistrées dans Administration → RGPD ; l'effacement inscrit le SIREN sur une liste d'opposition empêchant toute réimportation.",
  securite: 'Mots de passe hachés (PBKDF2), sessions HttpOnly, rôles, journal d\'audit, secrets hors du code, exports réservés et journalisés, limitation des requêtes.',
};
