// Génère les visuels de la fiche Google Business Profile : logo carré, photo de couverture et visuels de prestations.
// Usage : CHROMIUM_PATH=/chemin/chromium node scripts/gbp-images.mjs  → marketing/google-business/
// Formats : logo 720×720 (Google le recadre en cercle), couverture 16:9 (1024×576 conseillé, rendu ×2),
// visuels 4:3 1200×900. JPG/PNG entre 10 Ko et 5 Mo.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'marketing/google-business');
const fonts = `file://${root}/public/assets/fonts`;
const NAME = process.env.AGENCY_NAME ?? 'Signe & Seine';
const PHONE = process.env.AGENCY_PHONE ?? '06 47 41 42 24';
const ACCENT = '#C2410C';
const SEINE = '#0E4A57';
const INK = '#0F2F38';
const PAPER = '#F6F1E8';

const css = `
@font-face{font-family:Josefin;src:url(${fonts}/josefin-sans-latin-wght-normal.woff2);font-weight:100 700}
@font-face{font-family:Inter;src:url(${fonts}/inter-tight-latin-wght-normal.woff2);font-weight:100 900}
*{margin:0;box-sizing:border-box}body{background:${PAPER}}
.wm{font-family:Josefin;font-weight:600;letter-spacing:.16em}.wm b{color:${ACCENT};font-weight:600}
.k{font-family:Inter;font-weight:600;font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:${ACCENT}}
h1{font-family:Josefin;font-weight:600;color:${INK};line-height:1.04}h1 em{color:${ACCENT};font-style:normal;font-weight:500}
p{font-family:Inter;color:#3c4a4e}`;
// Même pictogramme que le site (falaises + vague).
const cliffs = (c, a, w) => `<svg width="${w}" height="${Math.round((w * 44) / 64)}" viewBox="0 0 64 44">
<path fill="${c}" d="M2 34V9Q16 7 28 11Q38 14 42 19Q44 23 43 34H37Q37 25 32 25Q27 25 27 34Z"/><path fill="${c}" d="M49 34L51.5 15L54.5 34Z"/>
<path d="M2 40c5-3 10-3 15 0s10 3 15 0 10-3 15 0 10 3 15 0" stroke="${a}" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`;
const wordmark = (size, color = INK) => `<span class="wm" style="font-size:${size}px;color:${color}">${NAME.toUpperCase().replace('&', '<b>&amp;</b>')}</span>`;
const waves = (color, opacity, w, h) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="position:absolute;left:0;bottom:0;opacity:${opacity}">
${[0, 1, 2].map((i) => `<path d="M0 ${h * 0.35 + i * 26} ${Array.from({ length: Math.ceil(w / 120) + 1 }, (_, k) => `q30 -14 60 0 t60 0`).join(' ')}" stroke="${color}" stroke-width="5" fill="none"/>`).join('')}</svg>`;

// Carte de prestation 1200×900 : texte à gauche, illustration à droite, pied de page avec la marque.
const card = ({ kicker, title, text, art }) => `<style>${css}
.c{width:1200px;height:900px;background:${PAPER};position:relative;overflow:hidden;padding:84px 80px 0;display:grid;grid-template-columns:1fr 470px;gap:50px}
.t{display:flex;flex-direction:column;gap:30px;padding-top:40px}h1{font-size:72px}p{font-size:29px;line-height:1.4;max-width:540px}
.a{position:relative;height:600px}.f{position:absolute;left:0;right:0;bottom:0;height:130px;background:${SEINE};display:flex;align-items:center;justify-content:space-between;padding:0 80px}
.f p{color:#d8e6e8;font-size:24px}</style>
<div class="c"><div class="t"><span class="k">${kicker}</span><h1>${title}</h1><p>${text}</p></div><div class="a">${art}</div>
<div class="f"><div style="display:flex;gap:20px;align-items:center">${cliffs('#fff', ACCENT, 76)}${wordmark(30, '#fff')}</div><p>Gruchet-le-Valasse · Pays de Caux</p></div></div>`;

const shadow = 'box-shadow:0 2px 4px rgb(15 47 56/.08),0 24px 48px -20px rgb(15 47 56/.35)';
const bar = (w, c = '#d9d3c8', h = 14) => `<div style="height:${h}px;width:${w};border-radius:7px;background:${c}"></div>`;

const ART = {
  site: `<div style="position:absolute;top:30px;left:0;width:470px;height:420px;background:#fff;border-radius:18px;${shadow};overflow:hidden">
    <div style="height:44px;background:#ece6db;display:flex;gap:10px;align-items:center;padding:0 18px">${['#e0857a', '#e5bf6a', '#8fbf8a'].map((c) => `<i style="width:14px;height:14px;border-radius:50%;background:${c}"></i>`).join('')}</div>
    <div style="padding:30px;display:flex;flex-direction:column;gap:16px">${bar('55%', SEINE, 22)}${bar('85%')}${bar('70%')}
    <div style="display:flex;gap:12px;margin-top:6px"><div style="height:46px;width:150px;border-radius:10px;background:${ACCENT}"></div><div style="height:46px;width:120px;border-radius:10px;border:3px solid ${SEINE}"></div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px">${[0, 1, 2].map(() => `<div style="height:96px;border-radius:10px;background:#e8eef0"></div>`).join('')}</div></div></div>
    <div style="position:absolute;right:-10px;top:250px;width:170px;height:330px;background:#fff;border-radius:26px;border:8px solid ${INK};${shadow};padding:30px 16px;display:flex;flex-direction:column;gap:12px">${bar('70%', SEINE, 16)}${bar('100%')}${bar('85%')}<div style="height:36px;border-radius:8px;background:${ACCENT};margin-top:8px"></div><div style="height:90px;border-radius:8px;background:#e8eef0"></div></div>`,
  identite: `<div style="position:absolute;top:20px;left:10px;width:300px;height:300px;border-radius:66px;background:${SEINE};display:grid;place-items:center;${shadow}">${cliffs('#fff', ACCENT, 220)}</div>
    <div style="position:absolute;top:110px;left:270px;width:200px;height:200px;border-radius:30px;background:#fff;display:grid;place-items:center;${shadow}">${cliffs(SEINE, ACCENT, 140)}</div>
    <div style="position:absolute;top:370px;left:10px;display:flex;gap:16px">${[SEINE, ACCENT, INK, '#e8dccb', '#fff'].map((c) => `<div style="width:76px;height:110px;border-radius:12px;background:${c};${shadow}"></div>`).join('')}</div>
    <div style="position:absolute;top:520px;left:10px;font-family:Josefin;font-size:44px;color:${INK}">Aa <span style="font-family:Inter;font-size:30px;color:#67625a">Josefin · Inter</span></div>`,
  impression: `<div style="position:absolute;top:40px;left:40px;width:300px;height:424px;background:${SEINE};border-radius:6px;transform:rotate(-7deg);${shadow};padding:34px;display:flex;flex-direction:column;gap:14px">${cliffs('#fff', ACCENT, 110)}${bar('80%', '#fff', 20)}${bar('60%', '#9fc0c6')}${bar('70%', '#9fc0c6')}<div style="margin-top:auto;height:50px;border-radius:8px;background:${ACCENT}"></div></div>
    <div style="position:absolute;top:110px;left:190px;width:270px;height:382px;background:#fff;border-radius:6px;transform:rotate(5deg);${shadow};padding:30px;display:flex;flex-direction:column;gap:14px"><div style="height:150px;border-radius:6px;background:#e8dccb"></div>${bar('85%', INK, 18)}${bar('100%')}${bar('75%')}</div>
    <div style="position:absolute;top:470px;left:60px;width:300px;height:172px;background:#fff;border-radius:10px;transform:rotate(-3deg);${shadow};padding:26px;display:flex;gap:20px;align-items:center">${cliffs(SEINE, ACCENT, 80)}<div style="display:flex;flex-direction:column;gap:10px;flex:1">${bar('90%', INK, 14)}${bar('70%', '#d9d3c8', 10)}${bar('60%', '#d9d3c8', 10)}</div></div>`,
  vitrine: `<div style="position:absolute;top:20px;left:0;width:470px;height:560px;background:#e8dccb;border-radius:14px;${shadow};overflow:hidden">
    <div style="height:90px;background:${INK};display:grid;place-items:center;font-family:Josefin;font-weight:600;font-size:40px;letter-spacing:.14em;color:#fff">BOULANGERIE</div>
    <div style="position:absolute;top:120px;left:30px;right:30px;bottom:30px;background:linear-gradient(160deg,#cfe0e3,#a9c5ca);border:10px solid ${INK};border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px">
      <div style="font-family:Josefin;font-size:62px;font-weight:600;color:#fff;text-shadow:0 2px 0 rgb(15 47 56/.25)">Pain &amp; Co</div>
      <div style="font-family:Inter;font-size:24px;color:${INK};background:#fff;padding:8px 18px;border-radius:30px">Ouvert 7 h – 19 h</div>
      <div style="width:130px;height:130px;border-radius:50%;background:${ACCENT};display:grid;place-items:center;font-family:Inter;font-weight:700;font-size:24px;color:#fff;text-align:center;line-height:1.1">Fait<br>maison</div></div></div>`,
  zone: (() => {
    const towns = [['Fécamp', 300, 70], ['Goderville', 210, 190], ['Yvetot', 400, 175], ['Bolbec', 290, 290], ['Gruchet-le-Valasse', 335, 330, true], ['Lillebonne', 330, 410], ['St-Romain-de-Colbosc', 140, 390], ['Montivilliers', 70, 300], ['Le Havre', 50, 430], ['Port-Jérôme', 270, 470], ['Rives-en-Seine', 395, 440]];
    return `<div style="position:absolute;inset:10px 0 30px;border-radius:20px;background:#fff;${shadow};overflow:hidden">
      <svg width="470" height="560" viewBox="0 0 470 560" style="position:absolute;inset:0"><path d="M0 470 Q120 500 220 520 T470 470 V560 H0Z" fill="#cfe0e3"/><path d="M0 0 L250 0 Q120 120 30 220 L0 260Z" fill="#cfe0e3"/>
      <circle cx="${335}" cy="${330}" r="150" fill="${ACCENT}" opacity=".08"/></svg>
      ${towns.map(([n, x, y, me]) => `<div style="position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px">
        <i style="width:${me ? 26 : 14}px;height:${me ? 26 : 14}px;border-radius:50%;background:${me ? ACCENT : SEINE};border:4px solid #fff;box-shadow:0 0 0 2px ${me ? ACCENT : SEINE}"></i>
        <span style="font-family:Inter;font-size:${me ? 21 : 17}px;font-weight:${me ? 700 : 500};color:${INK};white-space:nowrap;background:rgb(255 255 255/.85);padding:0 4px;border-radius:4px">${n}</span></div>`).join('')}</div>`;
  })(),
  contact: `<div style="position:absolute;top:60px;left:0;width:470px;background:#fff;border-radius:22px;${shadow};padding:44px;display:flex;flex-direction:column;gap:26px">
    ${[['Appel ou SMS', PHONE], ['E-mail', 'contact@signeetseine.fr'], ['Horaires', 'Lun.–sam. · 8 h 30 – 20 h'], ['Devis', 'Gratuit · réponse sous 48 h ouvrées']].map(([k, v]) => `<div><div style="font-family:Inter;font-size:18px;letter-spacing:.12em;text-transform:uppercase;color:#67625a">${k}</div><div style="font-family:Josefin;font-weight:600;font-size:${v.length > 20 ? 30 : 38}px;color:${INK};margin-top:6px">${v}</div></div>`).join('<div style="height:2px;background:#ece6db"></div>')}</div>`,
  offres: `<div style="position:absolute;top:10px;left:0;width:470px;background:#fff;border-radius:22px;${shadow};padding:40px 40px 34px;display:flex;flex-direction:column;gap:22px">
    ${[['Site internet', 'dès 690 € HT'], ['Logo & identité', 'dès 199 € HT'], ['Flyer + carte de visite', '99 € HT'], ['Vitrine & enseigne', 'sur devis']].map(([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px"><span style="font-family:Inter;font-weight:600;font-size:25px;color:${INK}">${k}</span><span style="font-family:Josefin;font-weight:600;font-size:27px;color:${ACCENT};white-space:nowrap">${v}</span></div>`).join('<div style="height:2px;background:#ece6db"></div>')}
    <div style="margin-top:8px;height:64px;border-radius:32px;background:${ACCENT};display:grid;place-items:center;font-family:Inter;font-weight:700;font-size:24px;color:#fff">Devis gratuit · réponse sous 48 h</div></div>`,
};

const PHOTOS = [
  ['01-sites-internet', { kicker: 'Création de sites internet', title: 'Un site qui <em>travaille pour vous.</em>', text: 'Rapide, lisible sur mobile, bien placé sur Google. Pensé pour les artisans, commerces et indépendants.', art: ART.site }],
  ['02-identite-visuelle', { kicker: 'Logo & identité visuelle', title: 'Une image <em>qui vous ressemble.</em>', text: 'Logo, couleurs, typographies : une identité claire, déclinée sur tous vos supports.', art: ART.identite }],
  ['03-impression', { kicker: 'Impression', title: 'Flyers, cartes, <em>dépliants.</em>', text: 'Conception et impression de vos supports, livrés chez vous. Impressions incluses dans les packs.', art: ART.impression }],
  ['04-vitrophanie-signaletique', { kicker: 'Vitrophanie & signalétique', title: 'Une vitrine <em>qui se remarque.</em>', text: 'Lettrage adhésif, vitrines, panneaux : conception et pose dans le Pays de Caux.', art: ART.vitrine }],
  ['05-zone-intervention', { kicker: 'Zone d’intervention', title: 'Près de chez vous, <em>en Pays de Caux.</em>', text: 'Rendez-vous sur place du Havre à Yvetot, de Fécamp à Lillebonne. Partout en France à distance.', art: ART.zone }],
  ['post-01-presentation', { kicker: 'Agence web & print', title: 'Une image à la hauteur de <em>votre <span style="white-space:nowrap">savoir-faire.</span></em>', text: 'Site, logo, imprimés, vitrine : un seul interlocuteur et des prix affichés pour les artisans et commerces.', art: ART.offres }],
  ['06-devis-contact', { kicker: 'Parlons de votre projet', title: 'Un devis <em>clair et gratuit.</em>', text: 'Un échange simple pour comprendre votre besoin, puis une proposition chiffrée sans surprise.', art: ART.contact }],
];

const logo = `<style>${css}.l{width:720px;height:720px;background:${SEINE};display:grid;place-items:center}</style><div class="l">${cliffs('#fff', ACCENT, 430)}</div>`;

const cover = `<style>${css}
.c{width:1024px;height:576px;background:${SEINE};position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center}
.c p{color:#d8e6e8;font-size:22px;letter-spacing:.04em}.c h1{color:#fff;font-size:44px;max-width:760px}.c h1 em{color:#f0a57c}
.cl{position:absolute;bottom:0;opacity:.22}</style>
<div class="c">
<svg class="cl" style="left:-30px" width="380" height="170" viewBox="0 0 64 30"><path fill="#fff" d="M0 30V4Q16 2 28 6Q38 9 42 14Q44 18 43 30H37Q37 21 32 21Q27 21 27 30Z"/><path fill="#fff" d="M49 30L51.5 10L54.5 30Z"/></svg>
<svg class="cl" style="right:-20px;transform:scaleX(-1)" width="300" height="130" viewBox="0 0 64 30"><path fill="#fff" d="M0 30V4Q16 2 28 6Q38 9 42 14Q44 18 43 30Z"/></svg>
${waves(ACCENT, 0.55, 1024, 70)}
<div style="display:flex;align-items:center;gap:22px">${cliffs('#fff', ACCENT, 92)}${wordmark(40, '#fff')}</div>
<h1>Sites internet, identité visuelle, <em>impression &amp; vitrines.</em></h1>
<p>Agence web &amp; print · Gruchet-le-Valasse, Pays de Caux</p></div>`;

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const tmp = mkdtempSync(path.join(tmpdir(), 'gbp-'));
// Une page file:// (et non about:blank) est nécessaire pour charger les polices locales.
const shoot = async (html, width, height, file, scale = 1) => {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  writeFileSync(path.join(tmp, 'p.html'), `<!doctype html><meta charset="utf-8">${html}`);
  await page.goto(`file://${tmp}/p.html`);
  await page.evaluate(() => document.fonts.ready);
  const type = file.endsWith('.png') ? 'png' : 'jpeg';
  await page.screenshot({ path: path.join(out, file), type, ...(type === 'jpeg' ? { quality: 90 } : {}) });
  await page.close();
};
await shoot(logo, 720, 720, 'logo-720x720.png');
await shoot(cover, 1024, 576, 'couverture-2048x1152.jpg', 2);
for (const [file, data] of PHOTOS) await shoot(card(data), 1200, 900, `${file}.jpg`);
await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`Visuels générés dans ${path.relative(process.cwd(), out) || '.'}`);
