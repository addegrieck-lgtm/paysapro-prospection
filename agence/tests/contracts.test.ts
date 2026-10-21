import { describe, expect, it } from 'vitest';
import { adminSession, makeApp, req } from './helpers';
import { addMonths, commitmentEnd, discountedPrice, renewalNoticeWindow, terminationDate } from '../src/domain/contracts';
import { addDays, todayParis } from '../src/domain/dates';

describe('calculs des contrats d’abonnement', () => {
  it('ajoute des mois en respectant les fins de mois', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('applique la remise et calcule la fin d’engagement', () => {
    expect(discountedPrice(3900, 10)).toBe(3510);
    expect(discountedPrice(6900, 0)).toBe(6900);
    expect(commitmentEnd('2026-03-01', 12)).toBe('2027-02-28');
    expect(commitmentEnd('2026-03-01', 0)).toBeNull();
  });

  it('date de fin d’une résiliation : préavis, sans jamais écourter l’engagement', () => {
    // Sans engagement : un mois de préavis.
    expect(terminationDate('2026-05-10', '2026-01-01', 0, 1)).toBe('2026-06-09');
    // Pendant l'engagement : fin de la période initiale.
    expect(terminationDate('2026-05-10', '2026-01-01', 12, 1)).toBe('2026-12-31');
    // Juste avant la fin d'engagement : le préavis dépasse, il s'applique.
    expect(terminationDate('2026-12-15', '2026-01-01', 12, 1)).toBe('2027-01-14');
    // Après l'engagement : de mois en mois avec préavis.
    expect(terminationDate('2027-03-01', '2026-01-01', 12, 1)).toBe('2027-03-31');
  });

  it('fenêtre légale de l’avis de fin d’engagement (1 à 3 mois avant)', () => {
    expect(renewalNoticeWindow('2026-01-01', 12)).toEqual({ from: '2026-09-30', to: '2026-11-30' });
    expect(renewalNoticeWindow('2026-01-01', 0)).toBeNull();
  });
});

describe('contrats d’abonnement : parcours complet', () => {
  it('établissement avec remise, envoi, signature en ligne, résiliation en ligne', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const now = new Date().toISOString();
    const ct = await db.run("INSERT INTO contacts (name, email, customer_type, created_at, updated_at) VALUES ('Claire Martin', 'claire@example.com', 'particulier', ?, ?)", [now, now]);
    const start = todayParis();

    expect((await s.post('/admin/abonnements', { contact_id: String(ct.lastId), label: '', base_monthly_ht: '39', start_date: start, formula: 'engagement' })).headers.get('location')).toContain('erreur');
    const r = await s.post('/admin/abonnements', {
      contact_id: String(ct.lastId),
      service_slug: 'maintenance',
      label: 'Maintenance du site claire-martin.fr',
      base_monthly_ht: '39',
      start_date: start,
      formula: 'engagement',
      extra: '1 h de modifications par mois',
    });
    expect(r.status).toBe(303);
    const url = r.headers.get('location')!.split('?')[0]!;
    const sub = (await db.get<{ token: string; monthly_ht: number; discount_percent: number; commitment_months: number; status: string; contract_status: string; number: string; terms: string }>(
      'SELECT * FROM subscriptions',
    ))!;
    expect(sub).toMatchObject({ monthly_ht: 3510, discount_percent: 10, commitment_months: 12, status: 'en_attente', contract_status: 'a_signer' });
    expect(sub.number).toMatch(/^CTR-\d{4}-0001$/);
    expect(JSON.parse(sub.terms)).toMatchObject({ serviceName: 'Maintenance', extra: '1 h de modifications par mois' });

    // Contrat en attente : pas de revenu récurrent, rappel sur le tableau de bord.
    expect(await (await s.get('/admin')).text()).toContain('en attente de signature');
    const adminHtml = await (await s.get(url)).text();
    expect(adminHtml).toContain('Remise pour engagement de 12 mois');
    expect(adminHtml).toContain('Droit de rétractation');

    await s.post(`${url}/envoyer`);
    expect((await db.get<{ body: string }>("SELECT body FROM email_log WHERE kind = 'contrat'"))!.body).toContain(`/client/contrat/${sub.token}`);

    // Le client lit et signe.
    const base = `/client/contrat/${sub.token}`;
    const page = await (await req(app, base)).text();
    expect(page).toContain('Signer le contrat');
    expect(page).toContain('35,10');
    const form = (data: Record<string, string>) => ({ method: 'POST', body: new URLSearchParams(data), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect((await req(app, `${base}/signer`, form({ name: 'Claire Martin' }))).headers.get('location')).toBe(base);
    expect((await req(app, `${base}/signer`, form({ name: 'Claire Martin', agree: '1' }))).headers.get('location')).toBe(`${base}?ok=signe`);
    expect(await db.get('SELECT status, contract_status, signed_name FROM subscriptions')).toEqual({ status: 'actif', contract_status: 'signe', signed_name: 'Claire Martin' });
    const signed = await (await req(app, base)).text();
    expect(signed).toContain('Signé en ligne le');
    expect(signed).toContain('Résilier mon abonnement');

    // Résiliation en ligne pendant l'engagement : fin à la date de fin d'engagement.
    expect((await req(app, `${base}/resilier`, form({ name: 'Claire Martin', agree: '1' }))).headers.get('location')).toBe(`${base}?ok=resilie`);
    const ended = await db.get<{ contract_status: string; end_date: string }>('SELECT contract_status, end_date FROM subscriptions');
    expect(ended).toEqual({ contract_status: 'resiliation', end_date: addDays(addMonths(start, 12), -1) });
    expect(await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM email_log WHERE kind = 'contrat' AND subject LIKE '%résiliation%'")).toEqual({ n: 1 });

    // Une fois la date passée, le contrat est clos automatiquement.
    await db.run("UPDATE subscriptions SET end_date = '2000-01-01'");
    await s.get('/admin/abonnements');
    expect(await db.get('SELECT status, contract_status FROM subscriptions')).toEqual({ status: 'termine', contract_status: 'resilie' });
  });

  it('rappelle l’avis de fin d’engagement aux clients particuliers dans la fenêtre légale', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const now = new Date().toISOString();
    const ct = await db.run("INSERT INTO contacts (name, email, customer_type, created_at, updated_at) VALUES ('Luc Petit', 'luc@example.com', 'particulier', ?, ?)", [now, now]);
    // Engagement commencé il y a 10 mois : la fin est dans environ 2 mois.
    const start = addMonths(todayParis(), -10);
    await s.post('/admin/abonnements', { contact_id: String(ct.lastId), label: 'Maintenance', base_monthly_ht: '39', start_date: start, formula: 'engagement' });
    await db.run("UPDATE subscriptions SET contract_status = 'signe', status = 'actif', signed_at = ?, signed_name = 'Luc Petit'", [now]);
    expect(await (await s.get('/admin')).text()).toContain('Avis de fin d’engagement à envoyer');
    const id = (await db.get<{ id: number }>('SELECT id FROM subscriptions'))!.id;
    await s.post(`/admin/abonnements/${id}/avis-fin-engagement`);
    expect((await db.get<{ body: string }>("SELECT body FROM email_log WHERE subject LIKE '%fin de votre période%'"))!.body).toContain('L215-1');
    expect(await (await s.get('/admin')).text()).not.toContain('Avis de fin d’engagement à envoyer');
  });

  it('formule sans engagement au prix de base ; CGV à jour', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const now = new Date().toISOString();
    const ct = await db.run("INSERT INTO contacts (name, email, created_at, updated_at) VALUES ('Atelier Pro', 'pro@example.com', ?, ?)", [now, now]);
    await s.post('/admin/abonnements', { contact_id: String(ct.lastId), label: 'SEO local', base_monthly_ht: '149', start_date: todayParis(), formula: 'sans_engagement' });
    expect(await db.get('SELECT monthly_ht, discount_percent, commitment_months FROM subscriptions')).toEqual({ monthly_ht: 14900, discount_percent: 0, commitment_months: 0 });
    const cgv = await (await req(app, '/cgv')).text();
    expect(cgv).toContain('8. Abonnements');
    expect(cgv).toContain('14. Médiation');
  });
});
