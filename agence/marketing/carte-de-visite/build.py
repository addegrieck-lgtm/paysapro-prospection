"""Génère la carte de visite SIGNE & SEINE (85 × 55 mm).

Sorties :
  carte-impression.html  -> 2 pages 85 × 55 mm (recto, verso), à imprimer en PDF
  maquette.html          -> recto + verso côte à côte, rendu « papier mat 400 g »

Usage : python3 -I build.py  (nécessite `pip install qrcode`)
"""
import base64
from pathlib import Path

import qrcode

ROOT = Path(__file__).parent
FONTS = ROOT / "fonts"

BLEU = "#0E4A57"
ORANGE = "#C2410C"
CREME = "#F6F1E8"
BLANC = "#FFFFFF"

URL = "https://www.signeetseine.fr"

# 1 mm = 6 unités : la carte fait 510 × 330.
W, H = 510, 330


def font_face(family, file, weight):
    data = base64.b64encode((FONTS / file).read_bytes()).decode()
    fmt = "truetype" if file.endswith(".ttf") else "opentype"
    return (
        f"@font-face{{font-family:'{family}';font-weight:{weight};"
        f"src:url(data:font/{file.rsplit('.', 1)[1]};base64,{data}) format('{fmt}');}}"
    )


FONT_CSS = "\n".join(
    [
        font_face("Josefin Sans", "JosefinSans-Light.ttf", 300),
        font_face("Josefin Sans", "JosefinSans-Regular.ttf", 400),
        font_face("Josefin Sans", "JosefinSans-SemiBold.ttf", 600),
        font_face("Inter", "Inter-Light.otf", 300),
        font_face("Inter", "Inter-Regular.otf", 400),
        font_face("Inter", "Inter-Medium.otf", 500),
    ]
)


def qr_path():
    q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(URL)
    q.make()
    m = q.get_matrix()
    d = "".join(
        f"M{x} {y}h1v1h-1z" for y, row in enumerate(m) for x, v in enumerate(row) if v
    )
    return len(m), d


# Symbole : falaise + arche (Porte d'Aval), aiguille, vague. viewBox 0 0 120 76.
def symbole(couleur, accent):
    return f"""
    <path fill="{couleur}" fill-rule="evenodd" d="
      M6 58 L6 23 L36 16.5 L60 20.5 Q69 22.5 73.5 30 L83 58 Z
      M55 58 L56.5 45 Q58 35.5 65.5 35.5 Q73 36 75.2 46 L77.2 58 Z"/>
    <path fill="{couleur}" d="M91 58 L94.4 27 Q95.3 24.5 96.2 27 L99.6 58 Z"/>
    <path fill="none" stroke="{accent}" stroke-width="2.6" stroke-linecap="round"
      d="M6 67 q7.5 -6 15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0"/>"""


ICONES = {
    "tel": '<path d="M4.5 2.5h3l1.5 3.6-1.9 1.2a8.6 8.6 0 0 0 4.6 4.6l1.2-1.9 3.6 1.5v3a1.5 1.5 0 0 1-1.6 1.5A13.5 13.5 0 0 1 3 4.1 1.5 1.5 0 0 1 4.5 2.5z"/>',
    "mail": '<rect x="2.5" y="4.5" width="15" height="11" rx="1.2"/><path d="M3 5.2l7 5.6 7-5.6"/>',
    "web": '<circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2.2 2.1 3.2 4.6 3.2 7.5s-1 5.4-3.2 7.5c-2.2-2.1-3.2-4.6-3.2-7.5s1-5.4 3.2-7.5z"/>',
    "lieu": '<path d="M10 17.8s-5.6-5.4-5.6-9.6a5.6 5.6 0 0 1 11.2 0c0 4.2-5.6 9.6-5.6 9.6z"/><circle cx="10" cy="8.2" r="2"/>',
}


def recto():
    # Symbole 120×76 mis à l'échelle 1.05, centré, puis nom et accroche.
    s = 1.15
    sw, sh = 120 * s, 76 * s
    sx, sy = (W - sw) / 2, 58
    return f"""
  <svg class="carte" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="{W}" height="{H}" fill="{BLEU}"/>
    <g transform="translate({sx:.2f} {sy}) scale({s})">{symbole(BLANC, ORANGE)}</g>
    <text x="{W / 2 + 4.5}" y="{sy + sh + 38:.1f}" text-anchor="middle"
      font-family="Josefin Sans" font-weight="600" font-size="25" letter-spacing="9"
      fill="{BLANC}">SIGNE <tspan fill="{ORANGE}">&amp;</tspan> SEINE</text>
    <text x="{W / 2 + 1.4}" y="{sy + sh + 66:.1f}" text-anchor="middle"
      font-family="Inter" font-weight="300" font-size="12" letter-spacing="2.8"
      fill="{BLANC}" fill-opacity="0.82">Agence web &amp; print · Pays de Caux</text>
  </svg>"""


def verso():
    n, d = qr_path()
    qr_size = 72  # 12 mm
    qx, qy = W - 36 - qr_size, H - 46 - qr_size
    m = 36
    lignes = [
        ("tel", "06 47 41 42 24"),
        ("mail", "contact@signeetseine.fr"),
        ("web", "www.signeetseine.fr"),
        ("lieu", "Gruchet-le-Valasse (76)"),
    ]
    y0, pas = 150, 27
    contacts = "".join(
        f"""
    <g transform="translate({m} {y0 + i * pas - 11.5})" fill="none" stroke="{BLEU}"
      stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
      <g transform="scale(0.78)">{ICONES[k]}</g></g>
    <text x="{m + 26}" y="{y0 + i * pas}" font-family="Inter" font-weight="400"
      font-size="14" letter-spacing="0.2" fill="{BLEU}">{t}</text>"""
        for i, (k, t) in enumerate(lignes)
    )
    return f"""
  <svg class="carte" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="{W}" height="{H}" fill="{CREME}"/>
    <text x="{m}" y="{m + 24}" font-family="Josefin Sans" font-weight="600"
      font-size="23" letter-spacing="2.2" fill="{BLEU}">[Prénom Nom]</text>
    <text x="{m}" y="{m + 48}" font-family="Inter" font-weight="400" font-size="12"
      letter-spacing="0.5" fill="{BLEU}" fill-opacity="0.75">Fondateur · Création web &amp; graphique</text>
    <line x1="{m}" x2="{m + 28}" y1="{m + 68}" y2="{m + 68}" stroke="{BLEU}"
      stroke-opacity="0.35" stroke-width="1"/>
    {contacts}
    <g transform="translate({qx} {qy}) scale({qr_size / n})" fill="{BLEU}"
      shape-rendering="crispEdges"><path d="{d}"/></g>
    <path fill="none" stroke="{ORANGE}" stroke-width="1.6" stroke-linecap="round"
      stroke-opacity="0.9"
      d="M-4 {H - 17} {' '.join(f'q{10.5} -4 21 0' if i == 0 else 't21 0' for i in range(26))}"/>
  </svg>"""


BASE_CSS = f"""{FONT_CSS}
*{{margin:0;padding:0;box-sizing:border-box}}
svg text{{font-kerning:normal}}"""


def page_impression():
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Carte SIGNE &amp; SEINE — impression</title>
<style>{BASE_CSS}
@page{{size:85mm 55mm;margin:0}}
.carte{{display:block;width:85mm;height:55mm;page-break-after:always}}
</style></head><body>{recto()}{verso()}</body></html>"""


# Grain papier mat : bruit fractal très léger, multiplié sur la carte.
GRAIN = (
    "data:image/svg+xml;utf8,"
    "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>"
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/>"
    "<feColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .55 0'/></filter>"
    "<rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"
)


def page_maquette():
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Carte SIGNE &amp; SEINE — maquette</title>
<style>{BASE_CSS}
html,body{{height:100%}}
body{{background:#E6E3DE radial-gradient(ellipse at 50% 40%,#EFEDE9 0%,#E2DFD9 70%,#D9D5CE 100%);
  display:flex;align-items:center;justify-content:center;min-height:100vh}}
.scene{{display:flex;gap:120px;padding:120px}}
.papier{{position:relative;width:{W * 1.5}px;height:{H * 1.5}px;border-radius:3px;overflow:hidden;
  box-shadow:0 1px 1px rgba(40,35,28,.18),0 3px 6px rgba(40,35,28,.12),
    0 14px 28px -6px rgba(40,35,28,.22),0 30px 60px -20px rgba(40,35,28,.18)}}
.papier .carte{{display:block;width:100%;height:100%}}
.papier::after{{content:"";position:absolute;inset:0;background:url("{GRAIN}");
  mix-blend-mode:multiply;opacity:.16;pointer-events:none}}
.papier::before{{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
  box-shadow:inset 0 0 0 .5px rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.06)}}
</style></head><body><div class="scene">
<div class="papier">{recto()}</div>
<div class="papier">{verso()}</div>
</div></body></html>"""


if __name__ == "__main__":
    (ROOT / "carte-impression.html").write_text(page_impression(), encoding="utf-8")
    (ROOT / "maquette.html").write_text(page_maquette(), encoding="utf-8")
    print("ok")
