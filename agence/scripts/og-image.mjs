// Génère l'image de partage (1200×630) et le logo carré (512×512) à partir des polices du site.
// Usage : node scripts/og-image.mjs  (à relancer si le nom ou la couleur de l'agence changent)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fonts = `file://${root}/public/assets/fonts`;
const NAME = process.env.AGENCY_NAME ?? 'Signe & Seine';
const ACCENT = process.env.AGENCY_ACCENT ?? '#C2410C';
const SEINE = '#0E4A57';
const LINE = process.env.AGENCY_LINE ?? 'Agence web & print · Gruchet-le-Valasse, Pays de Caux';

const css = `
@font-face{font-family:Josefin;src:url(${fonts}/josefin-sans-latin-wght-normal.woff2);font-weight:100 700}
@font-face{font-family:Inter;src:url(${fonts}/inter-tight-latin-wght-normal.woff2);font-weight:100 900}
*{margin:0;box-sizing:border-box}body{background:transparent}`;
const cliffs = (c, a, w) => `<svg width="${w}" height="${Math.round((w * 44) / 64)}" viewBox="0 0 64 44">
<path fill="${c}" d="M2 34V9Q16 7 28 11Q38 14 42 19Q44 23 43 34H37Q37 25 32 25Q27 25 27 34Z"/><path fill="${c}" d="M49 34L51.5 15L54.5 34Z"/>
<path d="M2 40c5-3 10-3 15 0s10 3 15 0 10-3 15 0 10 3 15 0" stroke="${a}" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`;
const wordmark = (c) => NAME.toUpperCase().replace('&', `<span style="color:${ACCENT === c ? '#fff' : ACCENT}">&amp;</span>`);

const og = `<style>${css}
.c{width:1200px;height:630px;background:#f6f1e8;padding:76px 90px;display:flex;flex-direction:column;justify-content:space-between;font-family:Inter;color:#0f2f38;position:relative;overflow:hidden}
.top{display:flex;align-items:center;gap:24px;font-family:Josefin;font-weight:600;font-size:40px;letter-spacing:.16em;padding-top:6px}
h1{font-family:Josefin;font-weight:600;font-size:74px;line-height:1.04;max-width:980px;position:relative}
h1 em{color:${ACCENT};font-style:normal;font-weight:500}p{font-size:28px;color:#3c4a4e;position:relative}
.coast{position:absolute;left:0;right:0;bottom:0;opacity:.16}</style>
<div class="c"><svg class="coast" viewBox="0 0 1200 140" preserveAspectRatio="none" width="1200" height="90"><path fill="${SEINE}" d="M700 140V60Q800 44 930 52L1060 62Q1110 70 1122 96V140H1090Q1090 104 1062 104Q1034 104 1034 140Z"/><path fill="${SEINE}" d="M1150 140L1162 80L1174 140Z"/></svg>
<div class="top">${cliffs(SEINE, ACCENT, 104)}<span>${wordmark('#0f2f38')}</span></div>
<h1>Sites internet et imprimés qui font <em>venir des clients.</em></h1><p>${LINE}</p></div>`;
const logo = `<style>${css}.l{width:512px;height:512px;border-radius:112px;background:${SEINE};display:grid;place-items:center}</style><div class="l">${cliffs('#fff', ACCENT, 380)}</div>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 630 });
const tmp = mkdtempSync(path.join(tmpdir(), 'og-'));
// Une page file:// (et non about:blank) est nécessaire pour charger les polices locales.
const show = async (html) => {
  writeFileSync(path.join(tmp, 'p.html'), `<!doctype html><meta charset="utf-8">${html}`);
  await page.goto(`file://${tmp}/p.html`);
};
await show(og);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${root}/public/assets/img/og-default.png` });
await page.setViewportSize({ width: 512, height: 512 });
await show(logo);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${root}/public/assets/img/logo-512.png`, omitBackground: true });
await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log('Images générées dans public/assets/img/');
