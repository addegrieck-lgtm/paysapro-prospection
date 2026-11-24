import { describe, expect, it } from 'vitest';
import { adminSession, makeApp } from './helpers';

type Db = Awaited<ReturnType<typeof makeApp>>['db'];
const now = () => new Date().toISOString();

async function contact(db: Db, name = 'Marie Test') {
  return (await db.run('INSERT INTO contacts (name, email, created_at, updated_at) VALUES (?, ?, ?, ?)', [name, 'marie@example.com', now(), now()])).lastId;
}
async function demande(db: Db, contactId: number) {
  return (await db.run("INSERT INTO quote_requests (contact_id, kind, created_at) VALUES (?, 'site', ?)", [contactId, now()])).lastId;
}
async function devis(db: Db, contactId: number, status: string, requestId: number | null = null) {
  return (await db.run('INSERT INTO quotes (contact_id, request_id, status, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [contactId, requestId, status, `t${Math.random()}`, now(), now()])).lastId;
}
const n = async (db: Db, sql: string, p: (string | number)[] = []) => (await db.get<{ n: number }>(sql, p))!.n;

describe('administration : suppressions', () => {
  it('supprime une demande depuis sa fiche, avec ses pièces jointes, sans toucher au contact ni au devis préparé', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const ct = await contact(db);
    const r = await demande(db, ct);
    await db.run("INSERT INTO files (key, name, type, size, owner_kind, owner_id, created_at) VALUES ('cle-fichier-test-1234', 'plan.pdf', 'application/pdf', 10, 'request', ?, ?)", [r, now()]);
    await db.run("INSERT INTO conversions (day, created_at, kind, ref_id) VALUES ('2026-11-24', ?, 'devis', ?)", [now(), r]);
    const q = await devis(db, ct, 'envoye', r);
    expect((await s.get(`/admin/demandes/${r}`)).status).toBe(200);
    expect(await (await s.get(`/admin/demandes/${r}`)).text()).toContain('Supprimer cette demande');

    const res = await s.post(`/admin/demandes/${r}/supprimer`);
    expect(res.headers.get('location')).toBe('/admin/demandes?ok=deleted');
    expect(await n(db, 'SELECT COUNT(*) AS n FROM quote_requests WHERE id = ?', [r])).toBe(0);
    expect(await n(db, "SELECT COUNT(*) AS n FROM files WHERE owner_kind = 'request' AND owner_id = ?", [r])).toBe(0);
    expect(await n(db, "SELECT COUNT(*) AS n FROM conversions WHERE kind = 'devis' AND ref_id = ?", [r])).toBe(0);
    expect(await n(db, 'SELECT COUNT(*) AS n FROM contacts WHERE id = ?', [ct])).toBe(1);
    expect(await db.get('SELECT request_id FROM quotes WHERE id = ?', [q])).toEqual({ request_id: null });
  });

  it('supprime plusieurs demandes cochées dans la liste', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const ct = await contact(db);
    const [a, b, keep] = [await demande(db, ct), await demande(db, ct), await demande(db, ct)];
    expect(await (await s.get('/admin/demandes')).text()).toContain('Supprimer la sélection');
    await s.post('/admin/demandes/supprimer', { ids: [String(a), String(b)] });
    expect(await db.all('SELECT id FROM quote_requests ORDER BY id')).toEqual([{ id: keep }]);
    expect((await s.post('/admin/demandes/supprimer', {})).headers.get('location')).toBe('/admin/demandes?erreur=aucun');
    expect((await s.post('/admin/demandes/supprimer', { ids: [String(keep)] }, { csrf: false })).status).toBe(403);
    expect(await n(db, 'SELECT COUNT(*) AS n FROM quote_requests')).toBe(1);
  });

  it('supprime un message de l’historique d’un contact, et seulement de ce contact', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const ct = await contact(db);
    const other = await contact(db, 'Autre');
    const e = (await db.run("INSERT INTO contact_events (contact_id, kind, body, created_at) VALUES (?, 'email', 'Message reçu via le formulaire', ?)", [ct, now()])).lastId;
    expect(await (await s.get(`/admin/crm/${ct}`)).text()).toContain(`/admin/crm/${ct}/evenement/${e}/supprimer`);
    await s.post(`/admin/crm/${other}/evenement/${e}/supprimer`);
    expect(await n(db, 'SELECT COUNT(*) AS n FROM contact_events WHERE id = ?', [e])).toBe(1);
    await s.post(`/admin/crm/${ct}/evenement/${e}/supprimer`);
    expect(await n(db, 'SELECT COUNT(*) AS n FROM contact_events WHERE id = ?', [e])).toBe(0);
  });

  it('explique pourquoi un contact avec un devis ne peut pas être supprimé', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const ct = await contact(db);
    await devis(db, ct, 'envoye');
    const res = await s.post(`/admin/crm/${ct}/supprimer`);
    expect(res.headers.get('location')).toBe(`/admin/crm/${ct}?erreur=lie`);
    expect(await (await s.get(`/admin/crm/${ct}?erreur=lie`)).text()).toContain('Suppression impossible');
  });

  it('supprime les devis non conclus, jamais un devis accepté ou rattaché à une facture', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const ct = await contact(db);
    const refuse = await devis(db, ct, 'refuse');
    const accepte = await devis(db, ct, 'accepte');
    const annuleFacture = await devis(db, ct, 'annule');
    await db.run("INSERT INTO invoices (contact_id, quote_id, status, created_at, updated_at) VALUES (?, ?, 'brouillon', ?, ?)", [ct, annuleFacture, now(), now()]);
    expect(await (await s.get(`/admin/devis/${refuse}`)).text()).toContain('Supprimer ce devis');
    await s.post(`/admin/devis/${refuse}/supprimer`);
    await s.post(`/admin/devis/${accepte}/supprimer`);
    expect((await s.post(`/admin/devis/${annuleFacture}/supprimer`)).headers.get('location')).toBe(`/admin/devis/${annuleFacture}?erreur=devis-lie`);
    expect(await db.all('SELECT id FROM quotes ORDER BY id')).toEqual([{ id: accepte }, { id: annuleFacture }]);
  });
});
