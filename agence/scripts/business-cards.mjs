// Cartes de visite Signe & Seine : 3 rectos (web, impression, vitrine) et un verso commun.
// Usage : CHROMIUM_PATH=/chemin/chromium node scripts/business-cards.mjs  → marketing/cartes-de-visite/
// Format fini 85 × 55 mm, fond perdu 3 mm (fichier 91 × 61 mm), zone de sécurité 3 mm à l'intérieur du format fini.
// Variables : CARD_NAME / CARD_ROLE (nom et fonction au verso, facultatifs), AGENCY_PHONE.
// Le QR code (qr-site.svg) mène au site avec utm_source=carte-de-visite (visites mesurées dans l'administration).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'marketing/cartes-de-visite');
const fonts = `file://${root}/public/assets/fonts`;
const PHONE = process.env.AGENCY_PHONE ?? '06 47 41 42 24';
const CARD_NAME = process.env.CARD_NAME ?? '';
const CARD_ROLE = process.env.CARD_ROLE ?? '';
const QR = readFileSync(path.join(out, 'qr-site.svg'), 'utf8');

const ACCENT = '#C2410C';
const SEINE = '#0E4A57';
const INK = '#0F2F38';
const PAPER = '#F6F1E8';
const MIST = '#D8E6E8';

const css = `
@font-face{font-family:Josefin;src:url(${fonts}/josefin-sans-latin-wght-normal.woff2);font-weight:100 700}
@font-face{font-family:Inter;src:url(${fonts}/inter-tight-latin-wght-normal.woff2);font-weight:100 900}
@page{size:91mm 61mm;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:91mm;background:#fff}
.card{width:91mm;height:61mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;font-family:Inter;color:${INK}}
.abs{position:absolute}
.wm{font-family:Josefin;font-weight:600;letter-spacing:.17em;white-space:nowrap}.wm b{color:${ACCENT};font-weight:600}
.k{font-family:Inter;font-weight:600;letter-spacing:.14em;text-transform:uppercase}`;

const cliffs = (c, a, w) => `<svg width="${w}mm" height="${(w * 44) / 64}mm" viewBox="0 0 64 44" style="display:block">
<path fill="${c}" d="M2 34V9Q16 7 28 11Q38 14 42 19Q44 23 43 34H37Q37 25 32 25Q27 25 27 34Z"/><path fill="${c}" d="M49 34L51.5 15L54.5 34Z"/>
<path d="M2 40c5-3 10-3 15 0s10 3 15 0 10-3 15 0 10 3 15 0" stroke="${a}" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`;
const wordmark = (pt, color = INK, amp = ACCENT) => `<span class="wm" style="font-size:${pt}pt;color:${color}">SIGNE <b style="color:${amp}">&amp;</b> SEINE</span>`;
const waveLine = (color, w, sw = 0.5) =>
  `<svg width="${w}mm" height="3mm" viewBox="0 0 ${w} 3" preserveAspectRatio="none" style="display:block"><path d="M0 1.5 ${Array.from({ length: Math.ceil(w / 6) }, () => 'q1.5 -1.4 3 0 t3 0').join(' ')}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round"/></svg>`;

// ─── Recto 1 : le web. La carte est une fenêtre de navigateur ouverte sur le site. ───
const rectoWeb = `<div class="card" style="background:${SEINE}">
  <div class="abs" style="left:0;right:0;top:0;height:15mm;background:${PAPER}"></div>
  <div class="abs" style="left:7.5mm;top:8.2mm;display:flex;gap:1.3mm">${['#E0857A', '#E5BF6A', '#8FBF8A'].map((c) => `<i style="display:block;width:2.1mm;height:2.1mm;border-radius:50%;background:${c}"></i>`).join('')}</div>
  <div class="abs" style="left:19mm;right:7.5mm;top:6.9mm;height:4.6mm;border-radius:2.3mm;background:#fff;display:flex;align-items:center;gap:1.4mm;padding:0 2.4mm;font-size:6.4pt;color:#3C4A4E">
    <svg width="2.1mm" height="2.6mm" viewBox="0 0 8 10"><rect x="0.5" y="4" width="7" height="5.5" rx="1" fill="${SEINE}"/><path d="M2 4V3a2 2 0 0 1 4 0v1" stroke="${SEINE}" stroke-width="1.2" fill="none"/></svg>
    <span>www.<b style="color:${INK};font-weight:700">signeetseine</b>.fr</span></div>
  <div class="abs" style="left:9mm;top:21mm;display:flex;align-items:center;gap:3mm">${cliffs('#fff', ACCENT, 15)}
    <div>${wordmark(12.5, '#fff', '#F0A57C')}<div style="font-size:6.6pt;color:${MIST};margin-top:1.2mm;letter-spacing:.02em">Agence web &amp; print · Pays de Caux</div></div></div>
  <div class="abs" style="left:9mm;top:40.5mm;display:flex;gap:1.6mm">${[38, 24, 30].map((w, i) => `<i style="display:block;height:1.3mm;width:${w * 0.42}mm;border-radius:.65mm;background:${i ? 'rgba(216,230,232,.35)' : 'rgba(216,230,232,.6)'}"></i>`).join('')}</div>
  <div class="abs" style="right:9mm;bottom:9.5mm;height:6.4mm;padding:0 3.6mm;border-radius:3.2mm;background:${ACCENT};color:#fff;font-weight:600;font-size:6.6pt;display:flex;align-items:center">Demander un devis</div>
  <svg class="abs" style="right:6.6mm;bottom:5.2mm" width="5mm" height="6mm" viewBox="0 0 10 12"><path d="M1 1v9.2l2.4-2.3 1.7 3.6 1.8-.8-1.7-3.5h3.4Z" fill="#fff" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/></svg>
</div>`;

// ─── Recto 2 : l'impression. La carte est un BAT, avec ses repères de coupe et sa gamme de couleurs. ───
// Repère de coupe en équerre à l'angle (x, y), tourné vers l'extérieur (sx, sy = ±1).
const corner = (x, y, sx, sy) =>
  `<svg class="abs" style="left:${x - 5}mm;top:${y - 5}mm" width="10mm" height="10mm" viewBox="-5 -5 10 10"><path d="M0 ${sy * -1.2} V${sy * -4.2} M${sx * -1.2} 0 H${sx * -4.2}" stroke="${INK}" stroke-width=".22"/></svg>`;
const reg = (size) => `<svg width="${size}mm" height="${size}mm" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3" fill="none" stroke="${INK}" stroke-width=".7"/><path d="M5 0v10M0 5h10" stroke="${INK}" stroke-width=".7"/></svg>`;
const rectoPrint = `<div class="card" style="background:${PAPER}">
  ${corner(11, 11, 1, 1)}${corner(80, 11, -1, 1)}${corner(11, 50, 1, -1)}${corner(80, 50, -1, -1)}
  <div class="abs" style="left:16mm;top:7.2mm;font-size:5pt;letter-spacing:.06em;color:#67625A">SIGNE-ET-SEINE_carte.pdf · 85 × 55 mm · CMJN</div>
  <div class="abs" style="left:11mm;right:11mm;top:15.5mm;display:flex;flex-direction:column;align-items:center;gap:2.4mm">
    ${cliffs(SEINE, ACCENT, 17)}${wordmark(14.5)}
    <div class="k" style="font-size:6pt;color:${ACCENT}">Graphisme · Impression · Web</div></div>
  <div class="abs" style="left:13mm;bottom:8mm;display:flex;align-items:center;gap:.9mm">
    ${['#00A0E3', '#E5007E', '#FFED00', '#1D1D1B'].map((c) => `<i style="display:block;width:2.6mm;height:2.6mm;background:${c}"></i>`).join('')}
    <span style="margin-left:.8mm">${reg(2.8)}</span></div>
  <div class="abs" style="right:9.5mm;bottom:8.6mm;transform:rotate(-9deg);border:.45mm solid ${ACCENT};border-radius:1.4mm;padding:1mm 2.2mm;color:${ACCENT};font-family:Josefin;font-weight:600;font-size:8.4pt;letter-spacing:.12em;background:rgba(246,241,232,.85)">BON À TIRER ✓</div>
</div>`;

// ─── Recto 3 : la vitrine. Une devanture avec son enseigne, son lettrage adhésif et sa pancarte « Ouvert ». ───
const rectoVitrine = `<div class="card" style="background:${INK}">
  <div class="abs" style="left:0;right:0;top:0;height:16.5mm;background:${INK};display:flex;align-items:center;justify-content:center;gap:2.6mm;padding-top:2.4mm">
    ${cliffs('#fff', ACCENT, 9)}${wordmark(12, '#fff', '#F0A57C')}</div>
  <div class="abs" style="left:0;right:0;top:16.5mm;height:2.2mm;background:repeating-linear-gradient(90deg,${ACCENT} 0 5mm,#F6F1E8 5mm 10mm)"></div>
  <div class="abs" style="left:6.5mm;right:6.5mm;top:21mm;bottom:6mm;border-radius:.6mm;background:linear-gradient(155deg,#3F7F8A 0%,#21606B 50%,#164B55 100%);overflow:hidden">
    <div class="abs" style="left:-6mm;top:-10mm;width:9mm;height:60mm;background:rgba(255,255,255,.12);transform:rotate(28deg)"></div>
    <div class="abs" style="left:7mm;top:-10mm;width:3mm;height:60mm;background:rgba(255,255,255,.09);transform:rotate(28deg)"></div>
    <div class="abs" style="left:5mm;top:6.5mm;font-family:Josefin;font-weight:600;font-size:12.5pt;line-height:1.05;color:#fff">Agence web<br><span style="color:#F0A57C">&amp;</span> print</div>
    <div class="abs" style="left:5mm;bottom:5.4mm;font-size:6.1pt;color:${MIST};font-weight:600;letter-spacing:.02em">Sites · Logos · Impression · Vitrines</div>
    <div class="abs" style="right:7.5mm;top:0;width:.25mm;height:5mm;background:${INK}"></div>
    <div class="abs" style="right:12.5mm;top:0;width:.25mm;height:5mm;background:${INK}"></div>
    <div class="abs" style="right:5mm;top:4.6mm;width:13mm;height:6.4mm;border-radius:1.2mm;background:${ACCENT};color:#fff;font-weight:700;font-size:6.6pt;letter-spacing:.12em;display:flex;align-items:center;justify-content:center;transform:rotate(-4deg)">OUVERT</div>
  </div>
</div>`;

// ─── Verso commun : ce que l'on fait, comment nous joindre, QR code vers le site. ───
const SERVICES = ['Sites internet & référencement', 'Logos & identité visuelle', 'Flyers, cartes & impression', 'Vitrophanie & signalétique'];
const verso = `<div class="card" style="background:${PAPER}">
  <div class="abs" style="left:9mm;top:8.6mm;right:33mm">
    <div style="display:flex;align-items:center;gap:1.8mm">${cliffs(SEINE, ACCENT, 7)}${wordmark(8)}</div>
    ${CARD_NAME ? `<div style="margin-top:2.4mm;font-family:Josefin;font-weight:600;font-size:9.5pt">${CARD_NAME}</div>${CARD_ROLE ? `<div style="font-size:6.2pt;color:#67625A;margin-top:.4mm">${CARD_ROLE}</div>` : ''}` : ''}
    <ul style="list-style:none;margin-top:${CARD_NAME ? 2.2 : 3.4}mm;display:flex;flex-direction:column;gap:${CARD_NAME ? 0.7 : 1}mm">
      ${SERVICES.map((s) => `<li style="display:flex;align-items:center;gap:1.6mm;font-size:6.3pt;font-weight:500"><i style="display:block;width:1.3mm;height:1.3mm;border-radius:50%;background:${ACCENT};flex:none"></i>${s}</li>`).join('')}
    </ul></div>
  <div class="abs" style="left:9mm;bottom:10.2mm;right:33mm">
    <div style="font-family:Josefin;font-weight:600;font-size:10pt;letter-spacing:.03em;color:${INK}">${PHONE}</div>
    <div style="font-size:6.2pt;margin-top:.6mm;color:#3C4A4E;line-height:1.45">contact@signeetseine.fr<br><b style="color:${INK}">www.signeetseine.fr</b> · Gruchet-le-Valasse</div></div>
  <div class="abs" style="right:8mm;top:9mm;width:22mm;display:flex;flex-direction:column;align-items:center;gap:1.4mm">
    <div class="k" style="font-size:5.4pt;color:${ACCENT}">Devis gratuit</div>
    <div style="width:22mm;height:22mm;padding:1.8mm;background:#fff;border-radius:1.6mm">${QR.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    <div style="font-size:5.4pt;color:#67625A">Scannez pour voir nos réalisations</div></div>
  <div class="abs" style="left:0;right:0;bottom:4.6mm">${waveLine(ACCENT, 91, 0.55)}</div>
</div>`;

const RECTOS = [
  ['1-web', rectoWeb],
  ['2-impression', rectoPrint],
  ['3-vitrine', rectoVitrine],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const tmp = mkdtempSync(path.join(tmpdir(), 'cdv-'));
const open = async (body, viewport, scale = 1) => {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  writeFileSync(path.join(tmp, 'p.html'), `<!doctype html><meta charset="utf-8"><style>${css}</style>${body}`);
  await page.goto(`file://${tmp}/p.html`);
  await page.evaluate(() => document.fonts.ready);
  return page;
};
const MM = 96 / 25.4;
const W = Math.round(91 * MM);
const H = Math.round(61 * MM);
const previews = {};
for (const [name, recto] of [...RECTOS, ['verso', verso]]) {
  // Aperçu PNG du format fini (fond perdu retiré), 4× pour la netteté.
  const page = await open(recto, { width: W, height: H }, 4);
  const file = path.join(out, `apercu-${name}.png`);
  await page.screenshot({ path: file, clip: { x: 3 * MM, y: 3 * MM, width: 85 * MM, height: 55 * MM } });
  previews[name] = file;
  await page.close();
}
for (const [name, recto] of RECTOS) {
  // PDF d'impression : page 1 recto, page 2 verso, 91 × 61 mm avec fond perdu.
  const page = await open(recto + verso, { width: W, height: H });
  await page.pdf({ path: path.join(out, `carte-${name}-recto-verso.pdf`), width: '91mm', height: '61mm', printBackground: true, pageRanges: '1-2' });
  await page.close();
}
// Planche de présentation : les 3 rectos et le verso.
const img = (f) => `file://${f}`;
const board = `<div style="width:1600px;background:#E9E2D6;padding:70px 80px;font-family:Inter;color:${INK};display:grid;grid-template-columns:680px 680px;justify-content:center;gap:56px 80px">
  ${[['Recto 1 — Le web', '1-web'], ['Recto 2 — L’impression', '2-impression'], ['Recto 3 — La vitrine', '3-vitrine'], ['Verso commun', 'verso']]
    .map(([t, k]) => `<figure style="margin:0"><img src="${img(previews[k])}" style="width:100%;border-radius:10px;box-shadow:0 2px 4px rgb(15 47 56/.1),0 30px 50px -24px rgb(15 47 56/.45)"><figcaption style="margin-top:16px;font-size:20px;font-weight:600;letter-spacing:.04em">${t}</figcaption></figure>`)
    .join('')}</div>`;
const bp = await open(board, { width: 1600, height: 900 });
await bp.screenshot({ path: path.join(out, 'planche-presentation.png'), fullPage: true });
await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`Cartes générées dans ${path.relative(process.cwd(), out) || '.'}`);
