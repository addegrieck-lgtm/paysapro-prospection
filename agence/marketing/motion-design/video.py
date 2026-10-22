"""Film de présentation Signe & Seine : 30 s, 1920 × 1080, 25 i/s, MP4 H.264 sans son.

Suit le storyboard de PROMPT.md : vague → logo → marée → 4 métiers → littoral → signature.
L'animation est une page SVG pilotée par render(t) ; chaque image est capturée par Chromium et encodée par ffmpeg.

Usage : python3 video.py            -> signe-et-seine-30s.mp4
        python3 video.py --apercu   -> apercu-video.png (planche d'images clés)
"""
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT.parent / "carte-de-visite"))
from build import BASE_CSS, BLANC, BLEU, CREME, ORANGE  # noqa: E402

FPS, DUREE = 25, 30
W, H = 1920, 1080

FALAISE = "M6 58 L6 23 L36 16.5 L60 20.5 Q69 22.5 73.5 30 L83 58 Z M55 58 L56.5 45 Q58 35.5 65.5 35.5 Q73 36 75.2 46 L77.2 58 Z"
AIGUILLE = "M91 58 L94.4 27 Q95.3 24.5 96.2 27 L99.6 58 Z"
LOGO_T = "translate(720 230) scale(4)"


def falaises(id_, couleur, extra=""):
    return f"""<g id="{id_}" transform="{LOGO_T}" {extra}>
      <path class="cl" d="{FALAISE}" fill="{couleur}" fill-rule="evenodd" stroke="{couleur}" stroke-width="0.5" stroke-linejoin="round"/>
      <path class="cl" d="{AIGUILLE}" fill="{couleur}" stroke="{couleur}" stroke-width="0.5" stroke-linejoin="round"/></g>"""


def barres(lignes, couleur):
    return "".join(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(h / 2, 4)}" fill="{couleur}" opacity="{o}"/>'
        for x, y, w, h, o in lignes
    )


def feuille(id_, x, y, w, h, rot):
    """Feuille imprimée crème, centrée en (x, y)."""
    l = [
        (-w * .38, -h * .38, w * .5, h * .06, 1),
        (-w * .38, -h * .24, w * .7, h * .025, .45),
        (-w * .38, -h * .19, w * .6, h * .025, .45),
        (-w * .38, -h * .05, w * .76, h * .3, .14),
        (-w * .38, h * .32, w * .3, h * .05, .9),
    ]
    return f"""<g id="{id_}" data-x="{x}" data-y="{y}" data-r="{rot}">
      <rect x="{-w / 2}" y="{-h / 2}" width="{w}" height="{h}" rx="3" fill="{CREME}"/>{barres(l, BLEU)}</g>"""


# Littoral simplifié (projection approximative : x = 500 + (lon - 0,1) × 907, y = 180 + (49,8 - lat) × 1400).
COTE = [(1130, 662), (1000, 650), (900, 640), (836, 628), (700, 630), (600, 625), (530, 618), (509, 614),
        (497, 596), (500, 560), (520, 500), (548, 430), (575, 360), (591, 306), (640, 280), (700, 255),
        (745, 236), (820, 215), (900, 195), (1000, 172), (1080, 160)]
VILLES = [("Le Havre", 509, 614, 490, 656, "end"), ("Étretat", 591, 306, 568, 300, "end"),
          ("Fécamp", 745, 236, 745, 205, "middle")]

SVG = f"""
<svg id="s" xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs><clipPath id="clipMaree"><path id="mareeClip"/></clipPath>
    <clipPath id="clipLettrage"><rect id="lettrageMasque" x="700" y="300" width="0" height="300"/></clipPath></defs>
  <rect width="{W}" height="{H}" fill="{CREME}"/>
  {falaises("logoBleu", BLEU)}
  <path id="maree" fill="{BLEU}"/>
  <g clip-path="url(#clipMaree)">{falaises("logoBlanc", BLANC)}</g>

  <g id="titre" opacity="0">
    <text id="nom" x="960" y="650" text-anchor="middle" font-family="Josefin Sans" font-weight="600" font-size="66"
      fill="{BLANC}">SIGNE <tspan id="esp" fill="{ORANGE}">&amp;</tspan> SEINE</text>
    <text id="accroche" x="962" y="722" text-anchor="middle" font-family="Inter" font-weight="300" font-size="30"
      letter-spacing="5" fill="{BLANC}" opacity="0">Agence web &amp; print · Pays de Caux</text>
  </g>

  <!-- 1. Sites internet -->
  <g id="svc1" opacity="0">
    <rect id="cadre" fill="none" stroke="{CREME}" stroke-width="3.5"/>
    <line id="barreNav" stroke="{CREME}" stroke-width="2.5" opacity=".7"/>
    <g id="blocs"></g>
  </g>
  <!-- 2. Identité visuelle -->
  <g id="svc2" opacity="0">
    <circle id="f1" r="38" fill="{CREME}"/>
    <path id="f2" d="M0 -44 L40 30 L-40 30 Z" fill="{BLANC}"/>
    <rect id="f3" x="-32" y="-32" width="64" height="64" fill="{CREME}" opacity=".85"/>
    <g id="carte">
      <g id="carteRecto"><rect x="740" y="300" width="440" height="280" rx="8" fill="none" stroke="{CREME}" stroke-width="3"/>
        <g transform="translate(888 372) scale(1.2)"><path d="{FALAISE}" fill="{BLANC}" fill-rule="evenodd"/><path d="{AIGUILLE}" fill="{BLANC}"/>
        <path d="M6 67 q7.5 -6 15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0" fill="none" stroke="{ORANGE}" stroke-width="2.6" stroke-linecap="round"/></g>
        <text x="960" y="540" text-anchor="middle" font-family="Josefin Sans" font-weight="600" font-size="22" letter-spacing="7" fill="{BLANC}">SIGNE <tspan fill="{ORANGE}">&amp;</tspan> SEINE</text></g>
      <g id="carteVerso" opacity="0"><rect x="740" y="300" width="440" height="280" rx="8" fill="{CREME}"/>
        {barres([(776, 336, 190, 18, 1), (776, 366, 230, 9, .5), (776, 430, 150, 9, .7), (776, 452, 190, 9, .7),
                  (776, 474, 170, 9, .7), (776, 496, 160, 9, .7), (1088, 474, 56, 56, .9)], BLEU)}
        <path d="M740 556 q11 -6 22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0"
          fill="none" stroke="{ORANGE}" stroke-width="2"/></g>
    </g>
  </g>
  <!-- 3. Impression -->
  <g id="svc3" opacity="0">
    {feuille("affiche", 740, 440, 300, 420, -6)}
    {feuille("flyer", 960, 455, 250, 354, 3)}
    <g id="depliant" data-x="1110" data-y="470">
      {"".join(f'''<g class="volet" data-i="{i}"><rect x="0" y="-150" width="120" height="300" fill="{CREME}"/>
        {barres([(14, -128, 70, 12, .9), (14, -102, 92, 6, .45), (14, -88, 80, 6, .45), (14, -60, 92, 90, .14), (14, 50, 60, 8, .7)], BLEU)}
        <line x1="0" y1="-150" x2="0" y2="150" stroke="{BLEU}" stroke-opacity=".18" stroke-width="2"/></g>''' for i in range(3))}
    </g>
  </g>
  <!-- 4. Vitrophanie -->
  <g id="svc4" opacity="0">
    <rect x="640" y="220" width="640" height="460" fill="none" stroke="{CREME}" stroke-width="3.5"/>
    <path d="M640 220 h640 v54 {' '.join('a20 20 0 0 1 -40 0' for _ in range(16))} Z" fill="{CREME}" opacity=".9"/>
    <rect x="700" y="320" width="520" height="290" fill="{BLANC}" opacity=".07" stroke="{CREME}" stroke-width="2.5"/>
    <g clip-path="url(#clipLettrage)">
      <text x="960" y="450" text-anchor="middle" font-family="Josefin Sans" font-weight="600" font-size="76" letter-spacing="16" fill="{BLANC}">OUVERT</text>
      <text x="960" y="505" text-anchor="middle" font-family="Inter" font-weight="400" font-size="26" letter-spacing="3" fill="{BLANC}" opacity=".85">du mardi au samedi</text>
      <line x1="900" x2="1020" y1="545" y2="545" stroke="{BLANC}" stroke-width="2" opacity=".6"/>
    </g>
    <g id="raclette"><rect x="-7" y="300" width="14" height="330" rx="4" fill="{CREME}"/><rect x="-3" y="610" width="6" height="70" fill="{CREME}" opacity=".8"/></g>
  </g>

  <text id="metier" x="962" y="830" text-anchor="middle" font-family="Josefin Sans" font-weight="400" font-size="54"
    letter-spacing="14" fill="{BLANC}" opacity="0"></text>

  <!-- Littoral -->
  <g id="carteLittoral" opacity="0">
    <polyline id="cote" points="{' '.join(f'{x},{y}' for x, y in COTE)}" fill="none" stroke="{ORANGE}" stroke-width="4"
      stroke-linecap="round" stroke-linejoin="round"/>
    <g id="villes" opacity="0">
      {"".join(f'<circle cx="{x}" cy="{y}" r="5" fill="{BLANC}"/><text x="{lx}" y="{ly}" text-anchor="{a}" font-family="Inter" font-size="24" fill="{CREME}" opacity=".8">{n}</text>' for n, x, y, lx, ly, a in VILLES)}
    </g>
    <g id="gruchet" opacity="0">
      <circle id="onde" cx="863" cy="530" r="10" fill="none" stroke="{BLANC}" stroke-width="2.5"/>
      <circle cx="863" cy="530" r="9" fill="{BLANC}"/>
      <text x="888" y="539" font-family="Inter" font-weight="500" font-size="26" fill="{BLANC}">Gruchet-le-Valasse</text>
    </g>
    <g id="baseLittoral" opacity="0">
      <text x="1240" y="420" font-family="Josefin Sans" font-weight="400" font-size="38" letter-spacing="7" fill="{BLANC}">BASÉ À</text>
      <text x="1240" y="472" font-family="Josefin Sans" font-weight="600" font-size="38" letter-spacing="5" fill="{BLANC}">GRUCHET-LE-VALASSE</text>
      <text x="1240" y="540" font-family="Inter" font-weight="300" font-size="28" fill="{BLANC}" opacity=".85">J’interviens dans tout le Pays de Caux</text>
    </g>
  </g>

  <text id="coord" x="961" y="745" text-anchor="middle" font-family="Inter" font-weight="400" font-size="34"
    letter-spacing="3" fill="{BLANC}" opacity="0">06 47 41 42 24  ·  signeetseine.fr</text>

  <path id="vague" fill="none" stroke="{ORANGE}" stroke-linecap="round"/>
</svg>"""

JS = r"""
const $ = id => document.getElementById(id);
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2; };
const out = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const mix = (A, B, k) => Object.fromEntries(Object.keys(A).map(key => [key, lerp(A[key], B[key], k)]));

const LARGE = {x0: -40, x1: 1960, yc: 498, A: 10, lam: 170, sw: 4};
const LOGO  = {x0: 744, x1: 1164, yc: 498, A: 12, lam: 120, sw: 10.4};
const BAS   = {x0: -40, x1: 1960, yc: 965, A: 8, lam: 170, sw: 3.5};

function vague(t) {
  let s, p = 1, op = 1;
  if (t < 3) { s = LARGE; p = out(t / 2.6); }
  else if (t < 5) s = mix(LARGE, LOGO, ease((t - 3) / 2));
  else if (t < 10.1) s = LOGO;
  else if (t < 11) s = mix(LOGO, BAS, ease((t - 10.1) / .9));
  else if (t < 25.3) { s = BAS; op = 1 - seg(t, 20.7, 21.2); }
  else { s = LOGO; p = out((t - 25.3) / .9); }
  const xe = s.x0 + (s.x1 - s.x0) * p, ph = 1.3 * t;
  let d = '';
  for (let x = s.x0; x <= xe + .01; x += 4) {
    const y = s.yc - s.A * Math.sin(2 * Math.PI * (x - s.x0) / s.lam - ph + Math.PI * 0);
    d += (d ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  const v = $('vague');
  v.setAttribute('d', p > 0.002 ? d : 'M0 0');
  v.setAttribute('stroke-width', s.sw);
  v.setAttribute('opacity', p > 0.002 ? op : 0);
}

function maree(t) {
  const L = lerp(1140, -90, ease(seg(t, 7, 8.7)));
  let d = `M0 1080 L0 ${L}`;
  for (let x = 0; x <= 1920; x += 20) d += ` L${x} ${(L + 22 * Math.sin(2 * Math.PI * x / 460 + 2.4 * t)).toFixed(1)}`;
  d += ' L1920 1080 Z';
  $('maree').setAttribute('d', d);
  $('mareeClip').setAttribute('d', d);
}

let longueurs = null;
function logo(t) {
  const cls = document.querySelectorAll('.cl');
  if (!longueurs) longueurs = [...cls].map(e => e.getTotalLength());
  const trace = ease(seg(t, 3.3, 5.4)), rempl = ease(seg(t, 4.9, 6.1));
  cls.forEach((e, i) => {
    const L = longueurs[i % 2];
    e.setAttribute('stroke-dasharray', `${L} ${L}`);
    e.setAttribute('stroke-dashoffset', L * (1 - trace));
    e.setAttribute('fill-opacity', rempl);
  });
  // Sortie après la présentation, retour pour la signature finale.
  const sortie = ease(seg(t, 10.1, 10.7)), retour = out(seg(t, 25.1, 25.9));
  const op = t < 25 ? 1 - sortie : retour, dy = t < 25 ? -40 * sortie : 30 * (1 - retour);
  for (const id of ['logoBleu', 'logoBlanc']) {
    $(id).setAttribute('opacity', op);
    $(id).setAttribute('transform', `translate(0 ${dy}) translate(720 230) scale(4)`);
  }
  if (t >= 25) cls.forEach(e => { e.setAttribute('stroke-dashoffset', 0); e.setAttribute('fill-opacity', 1); });
}

function titre(t) {
  const g = $('titre'), nom = $('nom');
  if (t < 25) {
    const ent = ease(seg(t, 8.4, 9.7)), sortie = ease(seg(t, 10.1, 10.7));
    g.setAttribute('opacity', clamp(seg(t, 8.4, 9.1)) * (1 - sortie));
    g.setAttribute('transform', `translate(0 ${-40 * sortie})`);
    nom.setAttribute('letter-spacing', lerp(2, 22, ent));
    $('esp').setAttribute('fill-opacity', ease(seg(t, 9.2, 9.7)));
    $('accroche').setAttribute('opacity', .85 * ease(seg(t, 9.5, 10)));
  } else {
    const k = out(seg(t, 25.7, 26.5));
    g.setAttribute('opacity', k);
    g.setAttribute('transform', `translate(0 ${20 * (1 - k)})`);
    nom.setAttribute('letter-spacing', 22);
    $('esp').setAttribute('fill-opacity', 1);
    $('accroche').setAttribute('opacity', 0);
  }
  const c = out(seg(t, 26.4, 27.1));
  $('coord').setAttribute('opacity', c);
  $('coord').setAttribute('transform', `translate(0 ${15 * (1 - c)})`);
}

// Fenêtre d'un métier : entrée 0,45 s, sortie 0,35 s.
function fenetre(t, a, b) {
  return {l: t - a, op: out(seg(t, a, a + .45)) * (1 - ease(seg(t, b - .35, b))), actif: t > a && t < b,
          dy: 24 * (1 - out(seg(t, a, a + .45)))};
}

const METIERS = [['SITES INTERNET', 10.7, 13.2], ['IDENTITÉ VISUELLE', 13.2, 15.7],
                 ['IMPRESSION', 15.7, 18.2], ['VITROPHANIE', 18.2, 20.7]];

function metier(t) {
  const m = METIERS.find(([, a, b]) => t > a && t < b), el = $('metier');
  if (!m) { el.setAttribute('opacity', 0); return; }
  const [nom, a, b] = m, k = out(seg(t, a + .25, a + .7));
  el.textContent = nom;
  el.setAttribute('opacity', k * (1 - ease(seg(t, b - .35, b))));
  el.setAttribute('transform', `translate(0 ${18 * (1 - k)})`);
}

const BLOCS = [[.08, .2, .42, .07, 1], [.08, .33, .62, .035, .55], [.08, .39, .48, .035, .55],
               [.08, .49, .24, .085, 1], [.08, .66, .25, .22, .18], [.375, .66, .25, .22, .18], [.67, .66, .25, .22, .18]];
function svc1(t) {
  const f = fenetre(t, 10.7, 13.2), g = $('svc1');
  g.setAttribute('opacity', f.op); g.setAttribute('transform', `translate(0 ${f.dy})`);
  if (!f.actif) return;
  const m = ease(seg(f.l, 1.55, 2.1));
  const w = lerp(700, 250, m), h = lerp(430, 470, m), x = 960 - w / 2, y = 430 - h / 2, haut = lerp(46, 34, m);
  const cadre = $('cadre'), per = 2 * (w + h);
  Object.entries({x, y, width: w, height: h, rx: lerp(14, 34, m)}).forEach(([k, v]) => cadre.setAttribute(k, v));
  const tr = ease(seg(f.l, 0, .6));
  cadre.setAttribute('stroke-dasharray', `${per} ${per}`); cadre.setAttribute('stroke-dashoffset', per * (1 - tr));
  const nav = $('barreNav');
  Object.entries({x1: x, x2: x + w, y1: y + haut, y2: y + haut}).forEach(([k, v]) => nav.setAttribute(k, v));
  nav.setAttribute('opacity', .7 * ease(seg(f.l, .4, .7)));
  const ih = h - haut;
  $('blocs').innerHTML = BLOCS.map(([bx, by, bw, bh, o], i) => {
    const k = out(seg(f.l, .5 + i * .12, .85 + i * .12));
    const col = o >= 1 ? '#F6F1E8' : '#FFFFFF';
    return `<rect x="${x + bx * w}" y="${y + haut + by * ih}" width="${bw * w * k}" height="${bh * ih}" rx="${Math.min(bh * ih / 2, 5)}" fill="${col}" opacity="${o * k}"/>`;
  }).join('');
}

function svc2(t) {
  const f = fenetre(t, 13.2, 15.7), g = $('svc2');
  g.setAttribute('opacity', f.op); g.setAttribute('transform', `translate(0 ${f.dy})`);
  if (!f.actif) return;
  const c = ease(seg(f.l, 0, .75)), fond = 1 - seg(f.l, .65, .95);
  [['f1', -360, -150], ['f2', 380, -120], ['f3', 20, 230]].forEach(([id, dx, dy], i) => {
    const e = $(id);
    e.setAttribute('transform', `translate(${960 + dx * (1 - c)} ${440 + dy * (1 - c)}) rotate(${(1 - c) * (i ? 90 : 0)}) scale(${lerp(1, .4, c)})`);
    e.setAttribute('opacity', fond);
  });
  const apparait = ease(seg(f.l, .7, 1.05)), flip = seg(f.l, 1.4, 2.0);
  const sx = Math.abs(Math.cos(Math.PI * ease(flip)));
  $('carte').setAttribute('opacity', apparait);
  $('carte').setAttribute('transform', `translate(960 440) scale(${Math.max(sx, .002)} 1) translate(-960 -440)`);
  $('carteRecto').setAttribute('opacity', ease(flip) < .5 ? 1 : 0);
  $('carteVerso').setAttribute('opacity', ease(flip) < .5 ? 0 : 1);
}

function svc3(t) {
  const f = fenetre(t, 15.7, 18.2), g = $('svc3');
  g.setAttribute('opacity', f.op); g.setAttribute('transform', `translate(0 ${f.dy})`);
  if (!f.actif) return;
  ['affiche', 'flyer'].forEach((id, i) => {
    const e = $(id), k = out(seg(f.l, i * .25, .7 + i * .25));
    const x = +e.dataset.x + 700 * (1 - k), r = +e.dataset.r + 14 * (1 - k);
    e.setAttribute('transform', `translate(${x} ${e.dataset.y}) rotate(${r})`);
    e.setAttribute('opacity', k);
  });
  const d = $('depliant'), k = out(seg(f.l, .5, 1.2));
  d.setAttribute('transform', `translate(${+d.dataset.x + 700 * (1 - k)} ${d.dataset.y}) rotate(-2)`);
  d.setAttribute('opacity', k);
  document.querySelectorAll('.volet').forEach(v => {
    const i = +v.dataset.i, o = i === 0 ? 1 : ease(seg(f.l, 1.1 + (i - 1) * .3, 1.45 + (i - 1) * .3));
    v.setAttribute('transform', `translate(${i * 120 * (i === 0 ? 1 : 1)} 0) scale(${Math.max(o, .002)} 1)`);
    v.setAttribute('opacity', i === 0 ? 1 : (o > .01 ? 1 : 0));
  });
}

function svc4(t) {
  const f = fenetre(t, 18.2, 20.7), g = $('svc4');
  g.setAttribute('opacity', f.op); g.setAttribute('transform', `translate(0 ${f.dy})`);
  if (!f.actif) return;
  const k = ease(seg(f.l, .55, 1.6)), x = lerp(700, 1220, k);
  $('lettrageMasque').setAttribute('width', x - 700);
  $('raclette').setAttribute('transform', `translate(${x} 0)`);
  $('raclette').setAttribute('opacity', out(seg(f.l, .35, .55)) * (1 - seg(f.l, 1.6, 1.9)));
}

let longueurCote = null;
function littoral(t) {
  const a = 20.7, b = 25.1, g = $('carteLittoral'), l = t - a;
  g.setAttribute('opacity', (t > a ? 1 : 0) * (1 - ease(seg(t, b - .4, b))));
  if (t <= a || t >= b) return;
  const cote = $('cote');
  if (!longueurCote) longueurCote = cote.getTotalLength();
  cote.setAttribute('stroke-dasharray', `${longueurCote} ${longueurCote}`);
  cote.setAttribute('stroke-dashoffset', longueurCote * (1 - ease(seg(l, 0, 1.6))));
  $('villes').setAttribute('opacity', ease(seg(l, 1.2, 1.8)));
  $('gruchet').setAttribute('opacity', out(seg(l, 1.6, 2.1)));
  const p = ((l - 1.6) % 1.2 + 1.2) % 1.2 / 1.2;
  $('onde').setAttribute('r', lerp(10, 46, out(p)));
  $('onde').setAttribute('opacity', l > 1.6 ? .7 * (1 - p) : 0);
  const k = out(seg(l, 2.1, 2.8));
  $('baseLittoral').setAttribute('opacity', k);
  $('baseLittoral').setAttribute('transform', `translate(${30 * (1 - k)} 0)`);
}

window.render = t => { maree(t); logo(t); titre(t); svc1(t); svc2(t); svc3(t); svc4(t); metier(t); littoral(t); vague(t); };
"""

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}
html,body{{margin:0;background:{CREME};overflow:hidden}}</style></head>
<body>{SVG}<script>{JS}</script></body></html>"""


def main():
    apercu = "--apercu" in sys.argv
    tmp = ROOT / "_video.html"
    tmp.write_text(HTML, encoding="utf-8")
    chromium = Path("/opt/pw-browsers/chromium")
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch(**({"executable_path": str(chromium)} if chromium.is_file() else {}))
            page = nav.new_page(viewport={"width": W, "height": H})
            page.goto(tmp.as_uri())
            page.evaluate("document.fonts.ready")
            if apercu:
                temps = [1.5, 4.5, 6.5, 8.0, 9.9, 12.0, 14.0, 15.3, 17.2, 19.6, 23.5, 29.0]
                for i, t in enumerate(temps):
                    page.evaluate(f"render({t})")
                    page.screenshot(path=str(ROOT / f"_k{i:02d}.png"))
                nav.close()
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(ROOT / "_k%02d.png"), "-vf",
                                "scale=640:-1,tile=3x4:padding=8:color=white", "-frames:v", "1",
                                str(ROOT / "apercu-video.png")], check=True)
                for f in ROOT.glob("_k*.png"):
                    f.unlink()
                return
            sortie = ROOT / "signe-et-seine-30s.mp4"
            ff = subprocess.Popen(
                ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "png",
                 "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
                 "-movflags", "+faststart", str(sortie)], stdin=subprocess.PIPE)
            for i in range(FPS * DUREE):
                page.evaluate(f"render({i / FPS})")
                ff.stdin.write(page.screenshot(type="png"))
            ff.stdin.close()
            ff.wait()
            nav.close()
    finally:
        tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
