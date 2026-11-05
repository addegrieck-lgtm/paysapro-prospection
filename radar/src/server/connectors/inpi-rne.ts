/**
 * INPI — Registre national des entreprises (RNE), API officielle. Compte gratuit avec accès API sur demande.
 * Utilisé sur les entreprises suivies (opportunités et projets) pour lister les comptes annuels déposés et leur
 * confidentialité : explique l'absence de données financières (comptes déposés en mode confidentiel).
 */
import { eventStmt, recordSource } from '../services/companies';
import { emptyChunk, type ChunkResult, type Connector } from './types';

export const INPI_BASE = 'https://registre-national-entreprises.inpi.fr/api';

interface InpiBilan {
  id?: string;
  dateDepot?: string;
  dateCloture?: string;
  typeBilan?: string;
  confidentiality?: string;
  confidentialite?: string;
  deleted?: boolean;
}

export const inpiRne: Connector = {
  id: 'inpi-rne',
  label: 'INPI — Registre national des entreprises',
  description: 'Comptes annuels déposés (dates de clôture, confidentialité) et actes des entreprises suivies.',
  official: true,
  requiredSecrets: ['INPI_USERNAME', 'INPI_PASSWORD'],
  defaultEnabled: false,
  provides: ['Liste des comptes annuels déposés et leur confidentialité', 'Actes déposés'],
  license: "Conditions de réutilisation des données du RNE (licence INPI) — données des personnes physiques soumises au RGPD",
  termsUrl: 'https://data.inpi.fr/content/editorial/Acces_API_Entreprises',
  docsUrl: 'https://www.inpi.fr/sites/default/files/documentation_technique_api_formalites_v4.0.pdf',
  quotas: 'Volumétrie journalière limitée par compte (voir conditions INPI) ; usage limité aux entreprises suivies',
  keyProcedure:
    "1. Créer un compte sur https://data.inpi.fr ; 2. Demander l'accès à l'API « RNE » (formulaire « Accès API » dans l'espace personnel) ; 3. Une fois l'accès validé, définir les secrets INPI_USERNAME et INPI_PASSWORD (identifiants du compte).",
  limitations: ["Le détail chiffré des bilans n'est pas importé par ce connecteur (seulement la liste et la confidentialité des dépôts).", 'Accès API soumis à validation par l\'INPI.'],
  async planTasks() {
    return ['attachments'];
  },
  async runChunk(ctx, _task, cursor): Promise<ChunkResult> {
    const http = ctx.http({ minIntervalMs: 500 });
    const login = await http.json<{ token?: string }>(`${INPI_BASE}/sso/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ctx.secrets.INPI_USERNAME, password: ctx.secrets.INPI_PASSWORD }),
    });
    if (!login.token) throw new Error('INPI : authentification refusée (identifiants ou accès API à vérifier)');
    const lastId = (cursor as { lastId?: number } | null)?.lastId ?? 0;
    const cutoff = new Date(ctx.now().getTime() - 90 * 86400_000).toISOString();
    const rows = await ctx.db.all<{ id: number; siren: string }>(
      `SELECT c.id, c.siren FROM companies c
       WHERE c.id > ? AND (EXISTS (SELECT 1 FROM acquisition_opportunities o WHERE o.company_id = c.id) OR EXISTS (SELECT 1 FROM acquisition_projects p WHERE p.company_id = c.id))
         AND NOT EXISTS (SELECT 1 FROM source_records s WHERE s.source_id = 'inpi-rne' AND s.external_id = c.siren AND s.collected_at > ?)
       ORDER BY c.id LIMIT 15`,
      [lastId, cutoff],
    );
    const out: ChunkResult = { ...emptyChunk({ lastId }, rows.length < 15) };
    for (const r of rows) {
      out.cursor = { lastId: r.id };
      try {
        const data = await http.json<{ bilans?: InpiBilan[]; actes?: unknown[] }>(`${INPI_BASE}/companies/${r.siren}/attachments`, { headers: { Authorization: `Bearer ${login.token}` } });
        out.fetched++;
        const bilans = (data.bilans ?? []).filter((b) => !b.deleted);
        const url = `https://data.inpi.fr/entreprises/${r.siren}`;
        const stmts = bilans.map((b) =>
          eventStmt({
            companyId: r.id,
            type: 'depot_comptes',
            date: b.dateDepot ?? null,
            title: `Comptes ${b.dateCloture ? `clos le ${b.dateCloture}` : ''} déposés${/confid/i.test(b.confidentiality ?? b.confidentialite ?? '') ? ' (confidentiels)' : ''}`,
            details: { dateCloture: b.dateCloture ?? null, typeBilan: b.typeBilan ?? null, confidentialite: b.confidentiality ?? b.confidentialite ?? null },
            reference: `bilan:${r.siren}:${b.id ?? b.dateCloture}`,
            url,
            sourceId: 'inpi-rne',
          }),
        );
        if (stmts.length) await ctx.db.batch(stmts);
        const src = await recordSource(ctx.db, { sourceId: 'inpi-rne', externalId: r.siren, entityType: 'company', companyId: r.id, siren: r.siren, url, payload: { bilans, actes: (data.actes ?? []).length } });
        if (src.changed) out.updated++;
      } catch (e) {
        out.errors.push(`SIREN ${r.siren} : ${(e as Error).message}`);
      }
    }
    return out;
  },
};
