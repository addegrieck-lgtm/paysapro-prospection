import { makeApp, req } from '../tests/helpers';
const { app } = await makeApp();
const paths = ['/', '/creation-site-internet', '/refonte-site-internet', '/flyers-depliants', '/cartes-de-visite', '/affiches-brochures', '/identite-visuelle-logo', '/reseaux-sociaux', '/referencement-seo', '/maintenance-site-internet', '/packs', '/realisations', '/realisations/atelier-chene-et-fil', '/etudes-de-cas', '/etudes-de-cas/les-pages-lentes', '/tarifs', '/impression', '/impression/flyers', '/impression/autocollants', '/configurateur', '/devis', '/a-propos', '/contact', '/blog', '/blog/site-vitrine-combien-de-pages', '/mentions-legales', '/confidentialite', '/cookies', '/cgv', '/espace-client', '/plan-du-site', '/sitemap.xml', '/robots.txt', '/favicon.svg', '/nexiste-pas'];
for (const p of paths) {
  const r = await req(app, p);
  const t = await r.text();
  console.log(r.status, p, t.length, (t.match(/<title>([^<]*)/) ?? [])[1] ?? '');
}
