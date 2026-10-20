// Captures d'écran (recette visuelle) : node scripts/screens.mjs <url> <dossier> [chemins...]
import { chromium } from 'playwright';
const [base, out, ...paths] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const sizes = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 } };
const which = (process.env.SIZES || 'desktop,mobile').split(',');
for (const name of which) {
  const ctx = await browser.newContext({ viewport: sizes[name], deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-visible')));
    await page.waitForTimeout(300);
    const file = `${out}/${name}${p.replace(/[^a-z0-9]+/gi, '_') || '_home'}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(name, p, overflow ? 'DÉBORDEMENT HORIZONTAL' : 'ok', errors.splice(0).join(' | '));
  }
  await ctx.close();
}
await browser.close();
