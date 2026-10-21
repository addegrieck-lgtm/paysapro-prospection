import { describe, expect, it } from 'vitest';
import { adminSession, makeApp, req } from './helpers';
import { BRIEF_SECTIONS, briefProgress, readSectionAnswers, visibleSections } from '../src/domain/brief';

const form = (data: Record<string, string | string[]>) => {
  const all = (k: string) => {
    const v = data[k];
    return v == null ? [] : Array.isArray(v) ? v : [v];
  };
  return { all, get: (k: string) => all(k).at(-1) ?? '' };
};

describe('questionnaire du cahier des charges', () => {
  it('n’affiche que les rubriques des prestations choisies, et la pose seulement pour la signalétique', () => {
    const ids = (m: Parameters<typeof visibleSections>[0], a = {}) => visibleSections(m, a).map((s) => s.id);
    expect(ids(['site'])).toEqual(['entreprise', 'clients', 'site_objectifs', 'site_contenu', 'site_fonctions', 'site_style', 'site_technique', 'organisation']);
    expect(ids(['identite'])).not.toContain('site_objectifs');
    expect(ids(['impression'])).not.toContain('impression_pose');
    expect(ids(['impression'], { supports_print: ['Flyers', 'Vitrophanie (vitrine)'] })).toContain('impression_pose');
    expect(ids(['impression'], { creation_print: 'J’ai déjà le fichier prêt, impression seule' })).not.toContain('impression_contenu');
  });

  it('n’accepte que les choix proposés et conserve les autres étapes', () => {
    const section = BRIEF_SECTIONS.find((s) => s.id === 'site_objectifs')!;
    const a = readSectionAnswers(section, form({ site_existant: 'Peut-être', objectifs: ['Vendre en ligne', '<script>'], objectifs__autre: 'Fidéliser' }), { activite: 'Menuisier' });
    expect(a.site_existant).toBe('');
    expect(a.objectifs).toEqual(['Vendre en ligne']);
    expect(a.objectifs__autre).toBe('Fidéliser');
    expect(a.activite).toBe('Menuisier');
  });

  it('calcule l’avancement sur les questions visibles', () => {
    const empty = briefProgress(['site'], {});
    expect(empty.answered).toBe(0);
    // Les questions conditionnelles (adresse du site actuel…) ne comptent que si elles s'affichent.
    const withSite = briefProgress(['site'], { site_existant: 'Oui' });
    expect(withSite.total).toBe(empty.total + 2);
    expect(withSite.answered).toBe(1);
  });
});

describe('cahier des charges : parcours complet', () => {
  it('création, envoi du lien, réponses du client, fichiers, envoi, restitution', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const now = new Date().toISOString();
    const ct = await db.run("INSERT INTO contacts (name, company, email, created_at, updated_at) VALUES ('Paul Durand', 'Menuiserie Durand', 'paul@example.com', ?, ?)", [now, now]);

    expect((await s.post('/admin/cahiers/nouveau', { contact_id: String(ct.lastId), title: '', modules: [] })).headers.get('location')).toContain('erreur');
    const created = await s.post('/admin/cahiers/nouveau', { contact_id: String(ct.lastId), title: 'Votre site et votre logo', modules: ['site', 'identite'] });
    expect(created.status).toBe(303);
    const adminUrl = created.headers.get('location')!.split('?')[0]!;
    const token = (await db.get<{ token: string }>('SELECT token FROM briefs'))!.token;
    const base = `/client/cahier/${token}`;

    // Envoi du lien par e-mail (mode « log ») : statut « envoyé ».
    await s.post(`${adminUrl}/envoyer`);
    expect(await db.get("SELECT status FROM briefs")).toEqual({ status: 'envoye' });
    expect((await db.get<{ body: string }>("SELECT body FROM email_log WHERE kind = 'cahier'"))!.body).toContain(base);

    // Le client ouvre le lien, ajuste les prestations (ajoute l'impression) et avance.
    const home = await (await req(app, base)).text();
    expect(home).toContain('Votre site et votre logo');
    expect(home).toContain('Étape 1 sur');
    const post = (data: Record<string, string | string[]>) => {
      const body = new URLSearchParams();
      for (const [k, v] of Object.entries(data)) for (const x of Array.isArray(v) ? v : [v]) body.append(k, x);
      return req(app, base, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    };
    let r = await post({ etape: 'projet', aller: 'suivant', modules: ['site', 'identite', 'impression'], projet_resume: 'Je lance mon activité.' });
    expect(r.headers.get('location')).toBe(`${base}?etape=entreprise`);
    r = await post({ etape: 'entreprise', aller: 'pause', entreprise_nom: 'Menuiserie Durand', anciennete: '2 à 10 ans' });
    expect(r.headers.get('location')).toBe(`${base}?etape=entreprise&ok=pause`);
    // En reprenant le lien, le client retrouve l'étape où il s'était arrêté, avec ses réponses.
    const resumed = await (await req(app, base)).text();
    expect(resumed).toContain('value="Menuiserie Durand"');
    r = await post({ etape: 'impression_supports', aller: 'suivant', supports_print: ['Vitrophanie (vitrine)'], creation_print: 'Création graphique complète' });
    expect(r.headers.get('location')).toBe(`${base}?etape=impression_contenu`);
    r = await post({ etape: 'impression_contenu', aller: 'suivant' });
    expect(r.headers.get('location')).toBe(`${base}?etape=impression_pose`);

    // Dernière étape : fichier joint puis envoi.
    const fd = new FormData();
    fd.append('etape', 'fin');
    fd.append('aller', 'envoyer');
    fd.append('fichiers', new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])], 'logo.png', { type: 'image/png' }));
    r = await req(app, base, { method: 'POST', body: fd });
    expect(r.status).toBe(303);
    const done = await db.get<{ status: string; files: string; answers: string }>('SELECT status, files, answers FROM briefs');
    expect(done!.status).toBe('termine');
    expect(JSON.parse(done!.files)).toHaveLength(1);
    expect(JSON.parse(done!.answers)).toMatchObject({ entreprise_nom: 'Menuiserie Durand', supports_print: ['Vitrophanie (vitrine)'] });

    // Après envoi : récapitulatif en lecture seule, plus de modification possible.
    const recap = await (await req(app, base)).text();
    expect(recap).toContain('bien été transmis');
    expect(recap).not.toContain('name="etape"');
    await post({ etape: 'entreprise', aller: 'suivant', entreprise_nom: 'Modifié' });
    expect((await db.get<{ answers: string }>('SELECT answers FROM briefs'))!.answers).not.toContain('Modifié');

    // Restitution dans l'administration (et sur la fiche contact).
    const adminHtml = await (await s.get(adminUrl)).text();
    expect(adminHtml).toContain('Menuiserie Durand');
    expect(adminHtml).toContain('Vitrophanie (vitrine)');
    expect(adminHtml).toContain('logo.png');
    expect(adminHtml).toContain('Complété par le client');
    expect(await (await s.get(`/admin/crm/${ct.lastId}`)).text()).toContain('Votre site et votre logo');
    expect(await (await s.get('/admin/cahiers')).text()).toContain('Votre site et votre logo');

    // Rouvrir pour le client.
    await s.post(`${adminUrl}/rouvrir`);
    expect(await (await req(app, base)).text()).toContain('name="etape"');
  });

  it('refuse un lien inconnu', async () => {
    const { app } = await makeApp();
    expect((await req(app, '/client/cahier/' + 'x'.repeat(43))).status).toBe(404);
  });
});
