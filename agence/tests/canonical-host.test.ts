import { describe, expect, it } from 'vitest';
import { makeApp } from './helpers';
import { getSettings, saveSettings } from '../src/repo/settings';

const config = { appSecret: 'test-secret-test-secret-test-secret-123', production: false, setupToken: 'x', canonicalHost: 'www.example.fr' };

describe('Adresse du site enregistrée sans « www »', () => {
  it('canonical, sitemap et données structurées utilisent le domaine principal, l’administration garde la valeur saisie', async () => {
    const { app, db } = await makeApp({ config });
    await saveSettings(db, { ...(await getSettings(db)), siteUrl: 'https://example.fr' });
    const home = await (await app.request('https://www.example.fr/')).text();
    expect(home).toContain('<link rel="canonical" href="https://www.example.fr/"');
    expect(home).not.toContain('"https://example.fr/');
    const sitemap = await (await app.request('https://www.example.fr/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>https://www.example.fr/tarifs</loc>');
    expect(sitemap).not.toContain('<loc>https://example.fr');
    expect((await getSettings(db)).siteUrl).toBe('https://example.fr');
  });

  it('une adresse sur un autre domaine reste telle quelle', async () => {
    const { app, db } = await makeApp({ config });
    await saveSettings(db, { ...(await getSettings(db)), siteUrl: 'https://autre-domaine.fr' });
    expect(await (await app.request('https://www.example.fr/')).text()).toContain('<link rel="canonical" href="https://autre-domaine.fr/"');
  });
});
