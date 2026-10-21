"""Visuels de la Page Facebook Signe & Seine, avec le symbole de la carte de visite.

Sorties (dans ce dossier) :
  photo-profil-720x720.png   Facebook l'affiche en cercle : le symbole tient dans le cercle inscrit.
  couverture-1640x924.png    Le contenu reste dans la bande centrale, visible sur ordinateur et sur mobile.

Usage : python3 -I build.py  (nécessite `pip install qrcode playwright` et Chromium)
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT.parent / "carte-de-visite"))
from build import BASE_CSS, BLANC, BLEU, CREME, ORANGE, symbole  # noqa: E402

PROFIL = f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}</style></head><body>
<svg width="720" height="720" viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg">
  <rect width="720" height="720" fill="{BLEU}"/>
  <g transform="translate(158 205) scale(3.6)">{symbole(BLANC, ORANGE)}</g>
</svg></body></html>"""

W, H = 1640, 924
VAGUE = " ".join("q22.5 -9 45 0" if i == 0 else "t45 0" for i in range(40))
COUVERTURE = f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}</style></head><body>
<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="{W}" height="{H}" fill="{CREME}"/>
  <g transform="translate({W / 2 - 120 * 1.7 / 2} 288) scale(1.7)">{symbole(BLEU, ORANGE)}</g>
  <text x="{W / 2 + 9}" y="492" text-anchor="middle" font-family="Josefin Sans" font-weight="600"
    font-size="64" letter-spacing="18" fill="{BLEU}">SIGNE <tspan fill="{ORANGE}">&amp;</tspan> SEINE</text>
  <text x="{W / 2 + 2}" y="560" text-anchor="middle" font-family="Josefin Sans" font-weight="400"
    font-size="25" letter-spacing="5" fill="{BLEU}">SITES INTERNET · IDENTITÉ VISUELLE · IMPRESSION · VITROPHANIE</text>
  <text x="{W / 2 + 1}" y="612" text-anchor="middle" font-family="Inter" font-weight="300"
    font-size="24" letter-spacing="2" fill="{BLEU}" fill-opacity="0.75">Agence web &amp; print · Gruchet-le-Valasse · Pays de Caux</text>
  <path fill="none" stroke="{ORANGE}" stroke-width="3" stroke-linecap="round" stroke-opacity="0.9"
    d="M-10 {H - 184} {VAGUE}"/>
</svg></body></html>"""


def rendre(html, sortie, w, h):
    tmp = ROOT / "_rendu.html"
    tmp.write_text(html, encoding="utf-8")
    try:
        page = navigateur.new_page(viewport={"width": w, "height": h})
        page.goto(tmp.as_uri())
        page.wait_for_timeout(300)
        page.screenshot(path=str(ROOT / sortie))
        page.close()
    finally:
        tmp.unlink()


if __name__ == "__main__":
    chromium = Path("/opt/pw-browsers/chromium")
    with sync_playwright() as p:
        navigateur = p.chromium.launch(**({"executable_path": str(chromium)} if chromium.is_file() else {}))
        rendre(PROFIL, "photo-profil-720x720.png", 720, 720)
        rendre(COUVERTURE, "couverture-1640x924.png", W, H)
        navigateur.close()
    print("ok")
