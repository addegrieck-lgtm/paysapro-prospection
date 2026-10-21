import { describe, expect, it } from 'vitest';
import { adminSession, makeApp, req } from './helpers';
import { formToken } from '../src/app/security';
import { classifyOrigin, deviceOf, isBot, isTrackedPath } from '../src/domain/analytics';

const SECRET = 'test-secret-test-secret-test-secret-123';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const q = (s = '') => new URLSearchParams(s);
const own = ['www.exemple.fr'];

describe('provenance des visites', () => {
  it('classe moteurs de recherche, réseaux sociaux, sites, accès direct et navigation interne', () => {
    expect(classifyOrigin('https://www.google.fr/', q(), own)).toMatchObject({ medium: 'recherche', source: 'Google', entry: true });
    expect(classifyOrigin('https://duckduckgo.com/', q(), own)).toMatchObject({ medium: 'recherche', source: 'DuckDuckGo' });
    expect(classifyOrigin('https://l.facebook.com/', q(), own)).toMatchObject({ medium: 'reseaux', source: 'Facebook' });
    expect(classifyOrigin('https://www.pagesjaunes.fr/annuaire', q(), own)).toMatchObject({ medium: 'site', source: 'pagesjaunes.fr', referrer: 'pagesjaunes.fr' });
    expect(classifyOrigin(undefined, q(), own)).toMatchObject({ medium: 'direct', entry: true });
    expect(classifyOrigin('https://www.exemple.fr/tarifs', q(), own)).toMatchObject({ entry: false });
    // Domaine sans « www » : même site.
    expect(classifyOrigin('https://exemple.fr/tarifs', q(), own)).toMatchObject({ entry: false });
  });

  it('les liens suivis (utm) et les publicités priment sur le site d’origine', () => {
    expect(classifyOrigin('https://www.google.com/', q('utm_source=Fiche-Google&utm_medium=fiche&utm_campaign=gbp'), own)).toMatchObject({
      medium: 'campagne',
      source: 'fiche-google',
      campaign: 'gbp',
      entry: true,
    });
    expect(classifyOrigin(undefined, q('utm_source=google&utm_medium=cpc'), own)).toMatchObject({ medium: 'publicite' });
    expect(classifyOrigin('https://www.google.com/', q('gclid=abc'), own)).toMatchObject({ medium: 'publicite', source: 'Google Ads' });
  });

  it('reconnaît appareils, robots et pages mesurées', () => {
    expect(deviceOf(IPHONE)).toBe('mobile');
    expect(deviceOf(DESKTOP)).toBe('ordinateur');
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('tablette');
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(isBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot(DESKTOP)).toBe(false);
    expect(isTrackedPath('/tarifs')).toBe(true);
    expect(isTrackedPath('/admin/crm')).toBe(false);
    expect(isTrackedPath('/sitemap.xml')).toBe(false);
  });
});

describe('statistiques du site', () => {
  const visit = (app: Awaited<ReturnType<typeof makeApp>>['app'], path: string, ua: string, referer?: string) =>
    req(app, path, { headers: { 'user-agent': ua, accept: 'text/html', 'cf-ipcountry': 'FR', ...(referer ? { referer } : {}) } });

  it('enregistre les visites humaines avec leur provenance, ignore robots et administrateurs', async () => {
    const { app, db } = await makeApp();
    await visit(app, '/tarifs?utm_source=flyer', IPHONE);
    await visit(app, '/contact', IPHONE, 'http://localhost/tarifs');
    await visit(app, '/', DESKTOP, 'https://www.google.fr/');
    await visit(app, '/', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)');
    await visit(app, '/page-qui-n-existe-pas', DESKTOP);
    const rows = await db.all<{ path: string; entry: number; medium: string; source: string; device: string; country: string; status: number }>(
      'SELECT path, entry, medium, source, device, country, status FROM page_views ORDER BY id',
    );
    expect(rows).toEqual([
      { path: '/tarifs', entry: 1, medium: 'campagne', source: 'flyer', device: 'mobile', country: 'FR', status: 200 },
      { path: '/contact', entry: 0, medium: 'direct', source: '', device: 'mobile', country: 'FR', status: 200 },
      { path: '/', entry: 1, medium: 'recherche', source: 'Google', device: 'ordinateur', country: 'FR', status: 200 },
      { path: '/page-qui-n-existe-pas', entry: 1, medium: 'direct', source: 'Accès direct', device: 'ordinateur', country: 'FR', status: 404 },
    ]);
    // Même personne le même jour : une seule empreinte ; aucune adresse IP stockée.
    const visitors = await db.all<{ visitor: string }>('SELECT DISTINCT visitor FROM page_views');
    expect(visitors).toHaveLength(2);
    expect(JSON.stringify(await db.all('SELECT * FROM page_views'))).not.toContain('203.0.113.7');

    const s = await adminSession(app, db);
    await s.get('/admin/statistiques');
    expect(await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM page_views')).toEqual({ n: 4 });
  });

  it('attribue une demande à la provenance de la visite et l’affiche dans l’administration', async () => {
    const { app, db } = await makeApp();
    await visit(app, '/', DESKTOP, 'https://www.google.fr/');
    const body = new URLSearchParams({ _ft: await formToken(SECRET, Date.now() - 10_000), name: 'Léa Visite', email: 'lea@example.com', message: 'Bonjour, un site ?', privacy: '1' });
    const r = await req(app, '/contact', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': DESKTOP } });
    expect(r.status).toBe(303);
    expect(await db.get('SELECT kind, medium, source, landing FROM conversions')).toEqual({ kind: 'contact', medium: 'recherche', source: 'Google', landing: '/' });

    const s = await adminSession(app, db);
    const html = await (await s.get('/admin/statistiques?periode=7')).text();
    expect(html).toContain('Statistiques du site');
    expect(html).toContain('Google');
    expect(html).toContain('Demandes reçues selon la provenance');
    expect(html).toContain('utm_source=fiche-google');
    expect((await s.get('/admin/statistiques?periode=365')).status).toBe(200);
    expect(await (await s.get('/admin')).text()).toContain('Visiteurs du site (7 jours)');
  });
});
