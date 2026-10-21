// Génère les icônes du site (PNG et favicon.ico) à partir du symbole des falaises, pour les navigateurs qui n'affichent pas
// le favicon SVG (Safari, anciens navigateurs, écran d'accueil iOS).
// Usage : node scripts/favicons.mjs  (à relancer si la couleur d'accent change ; même dessin que /favicon.svg dans src/routes/seo.ts)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = `${root}/public/assets/img`;
const ACCENT = process.env.AGENCY_ACCENT ?? '#C2410C';
const SEINE = '#0E4A57';

// rounded : coins arrondis transparents (onglets) ; sinon carré plein (iOS applique son propre masque).
const svg = (rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${SEINE}"/><g transform="translate(4 8)"><path fill="#fff" d="M2 34V9Q16 7 28 11Q38 14 42 19Q44 23 43 34H37Q37 25 32 25Q27 25 27 34Z"/><path fill="#fff" d="M49 34L51.5 15L54.5 34Z"/><path d="M2 41c5-3.4 10-3.4 15 0s10 3.4 15 0 10-3.4 15 0 10 3.4 15 0" stroke="${ACCENT}" stroke-width="3.6" fill="none" stroke-linecap="round"/></g></svg>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const render = async (size, rounded) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><style>*{margin:0}body{width:${size}px;height:${size}px;background:transparent}</style>${svg(rounded)}`);
  return page.screenshot({ omitBackground: true });
};

const icons = { 16: await render(16, true), 32: await render(32, true), 48: await render(48, true) };
writeFileSync(`${out}/apple-touch-icon.png`, await render(180, false));
await browser.close();

// favicon.ico : conteneur ICO avec images PNG (16, 32, 48 px), lu par tous les navigateurs actuels.
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(icons[s].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += icons[s].length;
});
writeFileSync(`${out}/favicon.ico`, Buffer.concat([header, ...sizes.map((s) => icons[s])]));
console.log('Icônes générées dans public/assets/img/');
