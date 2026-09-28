import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openProspectingDB } from '../src/data/db';
import { ProspectsApi, DailyLimitError, type RepoContext } from '../src/data/repository';
import { csvProvider } from '../src/providers/data';
import { exportProspectsCsv } from '../src/data/export';
import { parseCsv } from '../src/domain/csv';
import { demoLines } from '../src/data/demo';

let n = 0;
async function setup(ctx: Partial<RepoContext> = {}) {
  const db = await openProspectingDB(`test-${++n}-${Date.now()}`);
  const api = new ProspectsApi(db, { workspaceId: 'w1', user: 'Adrien', role: 'owner', ...ctx });
  return { db, api };
}

const CSV = `Raison sociale;SIRET;CP;Ville;Téléphone;Email;Site;Note;Avis
Jardin & Création;12345678900012;76000;Rouen;06 12 34 56 78;contact@jardin.fr;jardin.fr;4,7;87
Paysages du Nord;;59000;Lille;;;;;
JARDIN ET CREATION;;76000;Rouen;;;;;
Jardin & Création bis;12345678900012;76000;Rouen;;;;;
;;76000;Rouen;;;;;
Verts Horizons;98765432100019;33000;Bordeaux;0556000000;pas-mail;;;
`;

async function importCsv(api: ProspectsApi, text: string, mode: 'create' | 'enrich' = 'create') {
  const parsed = csvProvider.parse(text);
  return api.importLines(csvProvider.toLines(parsed, parsed.mapping, mode === 'create'), { source: mode === 'create' ? 'csv' : 'enrichment', label: 'test', mode, batchSize: 2 });
}

describe('Import CSV et déduplication', () => {
  it('importe, détecte les doublons (SIRET, nom + ville) et les lignes invalides', async () => {
    const { api } = await setup();
    const progress: number[] = [];
    const parsed = csvProvider.parse(CSV);
    const report = await api.importLines(csvProvider.toLines(parsed, parsed.mapping), { source: 'csv', label: 'test', mode: 'create', batchSize: 2, onProgress: (d) => progress.push(d) });
    expect(report).toMatchObject({ total: 6, added: 3, duplicates: 2, invalid: 1 });
    expect(progress).toEqual([2, 4, 6]);
    expect(report.errors.some((e) => /E-mail illisible/.test(e.message))).toBe(true);
    const page = await api.listProspects({ filter: {}, sort: 'score' });
    expect(page.total).toBe(3);
    const top = page.items[0]!;
    expect(top.name).toBe('Jardin & Création');
    expect(top.score).toBe(15 + 5 + 15 + 15 + 20 + 10);
    expect((await api.timeline(top.id)).map((a) => a.label)).toContain('Score calculé : 80');
  });

  it('un second import du même fichier ne crée aucun doublon', async () => {
    const { api } = await setup();
    await importCsv(api, CSV);
    const again = await importCsv(api, CSV);
    expect(again.added).toBe(0);
    expect((await api.listProspects({ filter: {} })).total).toBe(3);
  });

  it("fusionne un fichier d'enrichissement par SIREN / SIRET sans créer de fiche", async () => {
    const { api } = await setup();
    await importCsv(api, CSV);
    const enrich = `siren;email;site;google_url;google_rating;google_reviews;instagram\n987654321;hello@verts.fr;verts.fr;https://g.page/verts;4,9;140;instagram.com/verts\n111111111;x@y.fr;;;;;`;
    const report = await importCsv(api, enrich, 'enrich');
    expect(report).toMatchObject({ updated: 1, notFound: 1, added: 0 });
    const row = (await api.listProspects({ filter: { q: 'verts' } })).items[0]!;
    const p = (await api.getProspect(row.id))!;
    expect(p).toMatchObject({ email: 'hello@verts.fr', website: 'https://verts.fr', googleReviews: 140, instagram: 'https://instagram.com/verts' });
    expect(p.score).toBeGreaterThan(50);
  });

  it('traite 10 000 lignes par lots', async () => {
    const { api } = await setup();
    const lines = Array.from({ length: 10_000 }, (_, i) => ({ line: i + 2, errors: [], input: { name: `Entreprise ${i}`, siret: String(10_000_000_000_000 + i), postalCode: '76000', city: 'Rouen' } }));
    const report = await api.importLines(lines, { source: 'csv', label: 'gros', mode: 'create' });
    expect(report.added).toBe(10_000);
    const t = performance.now();
    const page = await api.listProspects({ filter: { departments: ['76'] }, sort: 'name', page: 2, pageSize: 50 });
    expect(page.total).toBe(10_000);
    expect(page.items).toHaveLength(50);
    const search = await api.listProspects({ filter: { q: 'Entreprise 4242' } });
    expect(search.items[0]!.name).toBe('Entreprise 4242');
    expect(performance.now() - t).toBeLessThan(500);
  }, 60_000);
});

describe('CRUD, notes, historique', () => {
  it('création, modification (score recalculé), suppression', async () => {
    const { api } = await setup();
    const p = await api.createProspect({ name: 'Test Paysage', postalCode: '14000' });
    expect(p.department).toBe('14');
    expect(p.score).toBe(0);
    const u = await api.updateProspect(p.id, { website: 'https://test.fr', phone: '0231000000' }, 'Site ajouté');
    expect(u.score).toBe(30);
    const labels = (await api.timeline(p.id)).map((a) => a.label);
    expect(labels).toEqual(expect.arrayContaining(['Site ajouté', 'Score recalculé : 0 → 30']));
    const note = await api.addNote(p.id, 'Rappeler après 17 h');
    await api.updateNote(note.id, 'Rappeler après 18 h');
    expect((await api.notesFor(p.id))[0]).toMatchObject({ text: 'Rappeler après 18 h', author: 'Adrien' });
    await api.deleteNote(note.id);
    expect(await api.notesFor(p.id)).toHaveLength(0);
    await api.deleteProspects([p.id]);
    expect(await api.getProspect(p.id)).toBeUndefined();
    expect(await api.timeline(p.id)).toHaveLength(0);
  });

  it('statuts : étapes du tunnel et contact enregistré', async () => {
    const { api } = await setup();
    const p = await api.createProspect({ name: 'A', email: 'a@a.fr' });
    const c = await api.logContact(p.id, 'call', 'Appel');
    expect(c.status).toBe('contacted');
    expect(c.lastContactAt).not.toBeNull();
    const d = await api.setStatus(p.id, 'demo_scheduled');
    expect(Object.keys(d.milestones).sort()).toEqual(['contacted', 'demo', 'replied']);
  });
});

describe('Relances', () => {
  it('créer, reporter, terminer ; la prochaine relance suit les tâches ouvertes', async () => {
    const { api } = await setup();
    const p = await api.createProspect({ name: 'A' });
    const due = new Date(Date.now() + 86_400_000).toISOString();
    const t = await api.addTask(p.id, { type: 'call', dueAt: due, priority: 'high', note: 'Appeler' });
    expect((await api.getProspect(p.id))!.nextFollowUpAt).toBe(due);
    await api.postponeTask(t.id, 7);
    const moved = (await api.listTasks())[0]!;
    expect(new Date(moved.dueAt).getTime()).toBeGreaterThan(new Date(due).getTime());
    await api.completeTask(t.id);
    expect((await api.getProspect(p.id))!.nextFollowUpAt).toBeNull();
    await api.deleteTask(t.id);
    expect(await api.listTasks()).toHaveLength(0);
  });
});

describe('Ne plus contacter / liste de suppression', () => {
  it('bloque contacts, relances, messages et la réimportation', async () => {
    const { api } = await setup();
    await importCsv(api, CSV);
    const row = (await api.listProspects({ filter: { q: 'jardin' } })).items.find((r) => r.siret)!;
    await api.addTask(row.id, { type: 'call', dueAt: new Date().toISOString(), priority: 'normal', note: '' });
    const p = await api.setDoNotContact(row.id, true, 'Opposition par téléphone');
    expect(p.status).toBe('do_not_contact');
    expect(await api.listTasks()).toHaveLength(0);
    await expect(api.logContact(row.id, 'email', 'x')).rejects.toThrow(/Ne plus contacter/);
    await expect(api.addTask(row.id, { type: 'call', dueAt: new Date().toISOString(), priority: 'normal', note: '' })).rejects.toThrow();
    await expect(api.setStatus(row.id, 'contacted')).rejects.toThrow();
    const templates = await api.listTemplates();
    await expect(api.generateMessageFor(row.id, templates[0]!.id, false)).rejects.toThrow(/Ne plus contacter/);
    // Masqué par défaut, visible sur demande, information conservée
    expect((await api.listProspects({ filter: { q: 'jardin & creation' } })).total).toBe(0);
    expect((await api.listProspects({ filter: { statuses: ['do_not_contact'] } })).total).toBe(1);
    // Supprimé à la demande (RGPD) → ne revient pas à la réimportation
    await api.deleteProspects([row.id], true);
    const again = await importCsv(api, CSV);
    expect(again.excluded).toBeGreaterThanOrEqual(1);
    expect((await api.listProspects({ filter: { includeDoNotContact: true } })).items.some((r) => r.siret === '12345678900012')).toBe(false);
  });
});

describe('Segments et campagnes', () => {
  it('segment dynamique sauvegardé, recalculé à chaque lecture', async () => {
    const { api } = await setup();
    await importCsv(api, CSV);
    const seg = await api.saveSegment({ name: 'Seine-Maritime', description: '', filter: { departments: ['76'] } });
    expect(await api.countMatching(seg.filter)).toBe(1);
    await api.createProspect({ name: 'Nouveau', postalCode: '76600' });
    expect(await api.countMatching((await api.getSegment(seg.id))!.filter)).toBe(2);
    await api.deleteSegment(seg.id);
    expect(await api.listSegments()).toHaveLength(0);
  });

  it('campagne : exclusions affichées, validation obligatoire, limite quotidienne, mode test', async () => {
    const { api } = await setup();
    await importCsv(api, CSV);
    await api.importLines(demoLines(5), { source: 'demo', label: 'démo', mode: 'create' });
    await api.createProspect({ name: 'Sans mail', postalCode: '76000' });
    const tpl = (await api.listTemplates())[0]!;
    expect(tpl.category).toBe('first_contact');
    const preview = await api.previewCampaign({ includeDoNotContact: true });
    expect(preview.counts.recipients).toBe(1);
    expect(preview.counts.demo).toBe(5);
    expect(preview.counts.noEmail).toBe(3);

    const test = await api.createCampaign({ name: 'Test', segmentId: null, filter: {}, templateId: tpl.id, testMode: true });
    expect(test.recipients[0]!.body).toContain('Paysapro AI');
    await expect(api.markRecipient(test.id, test.recipients[0]!.prospectId, 'sent')).rejects.toThrow(/Validez/);
    await api.validateCampaign(test.id);
    await api.markRecipient(test.id, test.recipients[0]!.prospectId, 'sent');
    expect((await api.getProspect(test.recipients[0]!.prospectId))!.status).toBe('new'); // mode test : prospect inchangé

    const s = await api.getSettings();
    await api.saveSettings({ ...s, dailyContactLimit: 0 });
    const real = await api.validateCampaign((await api.createCampaign({ name: 'Réelle', segmentId: null, filter: {}, templateId: tpl.id, testMode: false })).id);
    await expect(api.markRecipient(real.id, real.recipients[0]!.prospectId, 'sent')).rejects.toBeInstanceOf(DailyLimitError);
    await api.saveSettings({ ...s, dailyContactLimit: 50 });
    const done = await api.markRecipient(real.id, real.recipients[0]!.prospectId, 'sent');
    expect(done.status).toBe('done');
    expect((await api.getProspect(real.recipients[0]!.prospectId))!.status).toBe('contacted');
  });
});

describe('Export', () => {
  it('exporte toutes les colonnes, pour une sélection', async () => {
    const { api } = await setup();
    await importCsv(api, CSV);
    const ids = await api.matchingIds({ departments: ['76'] });
    const csv = await exportProspectsCsv(api, ids);
    const parsed = parseCsv(csv);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.headers).toEqual(expect.arrayContaining(['Entreprise', 'SIRET', 'Score', 'Source', 'Date de collecte', 'Ne plus contacter']));
    expect(parsed.rows[0]![parsed.headers.indexOf('Téléphone')]).toBe('0612345678');
  });
});

describe('Permissions et isolation', () => {
  it('un rôle « Lecture seule » ne peut ni créer, ni importer, ni exporter', async () => {
    const { api } = await setup({ role: 'viewer' });
    await expect(api.createProspect({ name: 'X' })).rejects.toThrow(/non autorisée/);
    await expect(importCsv(api, CSV)).rejects.toThrow(/non autorisée/);
    await expect(exportProspectsCsv(api, [])).rejects.toThrow(/non autorisée/);
    expect((await api.listProspects({ filter: {} })).total).toBe(0);
  });

  it('un commercial ne peut pas supprimer', async () => {
    const { api } = await setup({ role: 'sales' });
    const p = await api.createProspect({ name: 'X' });
    await expect(api.deleteProspects([p.id])).rejects.toThrow(/non autorisée/);
  });

  it("aucune fuite entre workspaces partageant la même base", async () => {
    const { db, api } = await setup();
    const other = new ProspectsApi(db, { workspaceId: 'w2', user: 'B', role: 'owner' });
    const p = await api.createProspect({ name: 'Secret' });
    await api.addNote(p.id, 'confidentiel');
    await api.saveSegment({ name: 'S', description: '', filter: {} });
    expect((await other.listProspects({ filter: {} })).total).toBe(0);
    expect(await other.getProspect(p.id)).toBeUndefined();
    expect(await other.listSegments()).toHaveLength(0);
    await expect(other.updateProspect(p.id, { name: 'Piraté' })).rejects.toThrow(/introuvable/);
    await other.deleteProspects([p.id]);
    expect(await api.getProspect(p.id)).toBeDefined();
  });
});

describe('Sauvegarde', () => {
  it('export puis restauration complète', async () => {
    const { api } = await setup();
    await importCsv(api, CSV);
    const custom = await api.saveTemplate({ name: 'Mon modèle', category: 'first_contact', subject: 'S', body: 'B' });
    await api.listTemplates();
    const backup = await api.exportBackup();
    expect(backup.templates.some((t) => t.id === custom.id)).toBe(true);
    const { api: fresh } = await setup();
    await fresh.restoreBackup(JSON.parse(JSON.stringify(backup)));
    expect((await fresh.listProspects({ filter: {} })).total).toBe(3);
    expect(await fresh.listTemplates()).toHaveLength(backup.templates.length);
  });
});
