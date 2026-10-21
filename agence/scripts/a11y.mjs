// Contrôles d'accessibilité (axe-core, WCAG A/AA) et d'affichage responsive (débordement horizontal).
//   BASE_URL=http://localhost:3000 node scripts/a11y.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const PAGES = ['/', '/creation-site-internet', '/flyers-depliants', '/tarifs', '/impression', '/impression/cartes-de-visite', '/configurateur', '/devis', '/realisations', '/realisations/les-pages-lentes', '/contact', '/blog/visibilite-locale-par-ou-commencer', '/cgv', '/mentions-legales', '/vitrophanie-signaletique', '/devis-vitrophanie-signaletique', '/creation-site-internet-artisan', '/creation-site-internet-paysagiste', '/referencement-local-artisan', '/vitrophanie-vitrine-commerce', '/zone-intervention', '/agence-web/le-havre', '/realisations/fournil-du-caux', '/packs', '/packs/restaurant', '/packs/coiffeur', '/nexiste-pas'];
const VIEWPORTS = { mobile: { width: 375, height: 812 }, tablette: { width: 820, height: 1180 }, ordinateur: { width: 1440, height: 900 } };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let problems = 0;
for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  // bypassCSP : uniquement pour injecter l'outil d'audit (la CSP du site interdit, à juste titre, les scripts en ligne).
  const page = await (await browser.newContext({ viewport, bypassCSP: true })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-visible')));
    await page.waitForTimeout(1200); // fin des animations d'apparition avant de mesurer les contrastes
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('a.btn, button.btn, .chip span, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select')]
        .filter((e) => e.offsetParent !== null)
        .filter((e) => e.getBoundingClientRect().height < 40).length,
    );
    let violations = [];
    if (name !== 'tablette') {
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })));
      violations = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    }
    const okPage = overflow <= 0 && violations.length === 0 && errors.length === 0;
    if (!okPage) problems++;
    console.log(`${okPage ? '✔' : '✘'} [${name}] ${p}${overflow > 0 ? ` — débordement ${overflow}px` : ''}${small ? ` — ${small} cible(s) < 40px` : ''}${violations.length ? ` — ${violations.map((v) => `${v.id}×${v.n} (${v.sample})`).join(', ')}` : ''}${errors.length ? ` — erreurs JS : ${errors.splice(0).join(' | ')}` : ''}`);
  }
}
await browser.close();
console.log(problems ? `\n${problems} page(s) à corriger.` : '\nAccessibilité (axe, niveau sérieux/critique) et responsive : conformes.');
process.exit(problems ? 1 : 0);
