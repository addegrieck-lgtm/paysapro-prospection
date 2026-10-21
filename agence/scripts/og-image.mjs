// Génère l'image de partage (1200×630) et le logo carré (512×512) à partir des polices du site.
// Usage : node scripts/og-image.mjs  (à relancer si le nom ou la couleur de l'agence changent)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fonts = `file://${root}/public/assets/fonts`;
const NAME = process.env.AGENCY_NAME ?? 'Signe & Seine';
const INITIALS = process.env.AGENCY_INITIALS ?? 'SS';
const ACCENT = process.env.AGENCY_ACCENT ?? '#C2410C';
const LINE = process.env.AGENCY_LINE ?? 'Agence web & print · Gruchet-le-Valasse, Pays de Caux';

const css = `
@font-face{font-family:Fraunces;src:url(${fonts}/fraunces-latin-wght-normal.woff2)}
@font-face{font-family:Fraunces;font-style:italic;src:url(${fonts}/fraunces-latin-wght-italic.woff2)}
@font-face{font-family:Inter;src:url(${fonts}/inter-tight-latin-wght-normal.woff2)}
*{margin:0;box-sizing:border-box}body{background:#14110f}`;
const mark = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><rect x="1" y="1" width="38" height="38" rx="11" fill="#14110f"/>
<path d="M10 31c3.3-2.4 6.7-2.4 10 0s6.7 2.4 10 0" fill="none" stroke="${ACCENT}" stroke-width="2.4" stroke-linecap="round"/>
<text x="20" y="24" text-anchor="middle" font-family="Fraunces" font-size="14" font-weight="500" fill="#fff">${INITIALS}</text></svg>`;

const og = `<style>${css}
.c{width:1200px;height:630px;background:#f6f1e8;padding:80px 90px;display:flex;flex-direction:column;justify-content:space-between;font-family:Inter;color:#14110f;position:relative;overflow:hidden}
.c:after{content:"";position:absolute;right:-120px;bottom:-160px;width:520px;height:520px;border-radius:50%;background:${ACCENT};opacity:.12}
.top{display:flex;align-items:center;gap:22px;font-family:Fraunces;font-size:44px;font-weight:500}
h1{font-family:Fraunces;font-weight:450;font-size:76px;line-height:1.05;letter-spacing:-.02em;max-width:950px}
h1 em{color:${ACCENT}}p{font-size:28px;color:#4a433c}</style>
<div class="c"><div class="top">${mark(84)}<span>${NAME}</span></div>
<h1>Sites internet et imprimés qui font <em>venir des clients.</em></h1><p>${LINE}</p></div>`;
const logo = `<style>${css}body{background:transparent}</style>${mark(512)}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${root}/public/assets/img/og-default.png` });
await page.setViewportSize({ width: 512, height: 512 });
await page.setContent(logo);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${root}/public/assets/img/logo-512.png`, omitBackground: true });
await browser.close();
console.log('Images générées dans public/assets/img/');
