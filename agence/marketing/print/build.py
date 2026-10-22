"""Flyer A5 recto-verso et brochure A5 4 pages Signe & Seine.

Sorties (dans ce dossier) :
  flyer-a5.pdf              2 pages, 154 × 216 mm = A5 + 3 mm de fond perdu
  brochure-a5-4-pages.pdf   4 pages dans l'ordre de lecture (couverture, intérieur gauche, intérieur droit, dos)
  apercu-flyer.png, apercu-brochure.png   pages coupées au format fini, pour validation

Les tarifs reprennent ceux du site (agence/src/db/seed.ts) : à mettre à jour ici s'ils changent.
Usage : python3 build.py  (nécessite `pip install qrcode playwright` et Chromium)
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT.parent / "carte-de-visite"))
from build import BASE_CSS, BLANC, BLEU, CREME, ORANGE, qr_path, symbole  # noqa: E402

TEL = "06 47 41 42 24"
MAIL = "contact@signeetseine.fr"
WEB = "www.signeetseine.fr"


def logo(couleur, largeur_mm):
    return (
        f'<svg viewBox="0 0 120 76" style="width:{largeur_mm}mm;display:block">'
        f"{symbole(couleur, ORANGE)}</svg>"
    )


def marque(couleur, taille_pt):
    return (
        f'<div class="marque" style="color:{couleur};font-size:{taille_pt}pt">'
        f'SIGNE <span class="esp">&amp;</span> SEINE</div>'
    )


def vague(opacite=1, epaisseur=1.6):
    d = "M-6 15 " + " ".join("q12 -7 24 0" if i == 0 else "t24 0" for i in range(42))
    return (
        f'<svg class="vague" viewBox="0 0 924 30" preserveAspectRatio="none">'
        f'<path d="{d}" fill="none" stroke="{ORANGE}" stroke-width="{epaisseur}" '
        f'stroke-opacity="{opacite}" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>'
    )


def qr(couleur, taille_mm):
    n, d = qr_path()
    return (
        f'<svg viewBox="0 0 {n} {n}" style="width:{taille_mm}mm;height:{taille_mm}mm;display:block" '
        f'shape-rendering="crispEdges"><path fill="{couleur}" d="{d}"/></svg>'
    )


# Icônes au trait, grille 24.
ICO = {
    "web": '<rect x="3" y="4.5" width="18" height="13" rx="1.5"/><path d="M3 8h18M8 21h8M12 17.5V21"/>',
    "identite": '<path d="M12 3l7 7-7 11-7-11z"/><circle cx="12" cy="11" r="1.6"/><path d="M12 3v6.4"/>',
    "impression": '<path d="M7 8V3.5h10V8M7 17H4.5A1.5 1.5 0 0 1 3 15.5v-6A1.5 1.5 0 0 1 4.5 8h15A1.5 1.5 0 0 1 21 9.5v6a1.5 1.5 0 0 1-1.5 1.5H17"/><rect x="7" y="13" width="10" height="7.5"/>',
    "vitrine": '<path d="M3.5 9.5L5 4h14l1.5 5.5M3.5 9.5h17M4.5 9.5V20h15V9.5"/><path d="M8 20v-6h8v6"/>',
    "tel": '<path d="M5.5 3.5h3.2l1.6 3.9-2 1.3a9.4 9.4 0 0 0 5 5l1.3-2 3.9 1.6v3.2a1.6 1.6 0 0 1-1.7 1.6A14.7 14.7 0 0 1 3.9 5.2a1.6 1.6 0 0 1 1.6-1.7z"/>',
    "mail": '<rect x="3" y="5.5" width="18" height="13" rx="1.4"/><path d="M3.6 6.3L12 13l8.4-6.7"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3z"/>',
    "lieu": '<path d="M12 21.4s-6.7-6.5-6.7-11.5a6.7 6.7 0 0 1 13.4 0c0 5-6.7 11.5-6.7 11.5z"/><circle cx="12" cy="9.8" r="2.4"/>',
}


def ico(nom, couleur, taille_mm=6.5):
    return (
        f'<svg viewBox="0 0 24 24" class="ico" style="width:{taille_mm}mm;height:{taille_mm}mm" fill="none" '
        f'stroke="{couleur}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">{ICO[nom]}</svg>'
    )


def contacts(couleur):
    lignes = [("tel", TEL), ("mail", MAIL), ("globe", WEB), ("lieu", "Gruchet-le-Valasse (76)")]
    return "".join(
        f'<div class="contact">{ico(k, couleur, 4.6)}<span>{t}</span></div>' for k, t in lignes
    )


CSS = f"""{BASE_CSS}
@page{{size:154mm 216mm;margin:0}}
body{{font-family:Inter;color:{BLEU};-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.page{{width:154mm;height:216mm;position:relative;overflow:hidden;padding:13mm;break-after:page;
  display:flex;flex-direction:column}}
.bleu{{background:{BLEU};color:{BLANC}}}.creme{{background:{CREME}}}.blanc{{background:#FFFDF9}}
.marque{{font-family:'Josefin Sans';font-weight:600;letter-spacing:.32em;white-space:nowrap}}
.esp{{color:{ORANGE}}}
.kicker{{font-family:'Josefin Sans';font-weight:400;font-size:8pt;letter-spacing:.28em;text-transform:uppercase}}
h1,h2,h3{{font-family:'Josefin Sans';font-weight:600;line-height:1.08}}
h1{{font-size:30pt;letter-spacing:.01em}}h2{{font-size:19pt}}h3{{font-size:11.5pt;letter-spacing:.02em}}
p{{font-size:9.5pt;line-height:1.5;font-weight:400}}
.doux{{opacity:.78}}.petit{{font-size:7pt;line-height:1.4}}
.vague{{position:absolute;left:0;width:100%;height:5mm}}
.ico{{flex:none;display:block}}
.contact{{display:flex;align-items:center;gap:3mm;font-size:10pt;margin:0 0 2.6mm}}
.filet{{width:9mm;height:0;border-top:.3mm solid currentColor;opacity:.4}}
"""


# ─── Flyer ───────────────────────────────────────────────────────────────────

SERVICES = [
    ("web", "Sites internet", "Sites vitrines rapides, pensés pour le mobile et Google."),
    ("identite", "Identité visuelle", "Logo, couleurs, cartes de visite : une image reconnaissable."),
    ("impression", "Impression", "Flyers, dépliants, affiches, roll-up, étiquettes."),
    ("vitrine", "Vitrophanie", "Habillage de vitrines, lettrage adhésif, signalétique."),
]

FLYER_RECTO = f"""
<section class="page bleu">
  <div style="display:flex;align-items:center;gap:4mm">{logo(BLANC, 15)}{marque(BLANC, 10)}</div>
  <div style="margin-top:22mm">
    <div class="kicker" style="opacity:.8">Agence web &amp; print · Pays de Caux</div>
    <h1 style="margin-top:5mm">Votre activité<br>mérite d’être vue.</h1>
    <p style="margin-top:6mm;max-width:105mm;font-size:10.5pt;opacity:.88">Sites internet, identité visuelle, impression
      et vitrophanie pour les artisans, commerçants et indépendants du Pays de Caux.</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm 9mm;margin-top:16mm">
    {"".join(f'''<div>{ico(k, BLANC, 7.5)}<h3 style="margin-top:3mm">{t}</h3>
      <p style="margin-top:1.5mm;font-size:8.5pt;opacity:.8">{d}</p></div>''' for k, t, d in SERVICES)}
  </div>
  <div style="margin-top:auto;margin-bottom:6mm;display:flex;justify-content:space-between;align-items:baseline">
    <div class="marque" style="font-size:13pt;letter-spacing:.12em">{TEL}</div>
    <div style="font-size:10pt;opacity:.85">{WEB.removeprefix("www.")}</div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:10mm">{vague()}</div>
</section>"""

OFFRES = [
    ("Pack flyer + carte de visite", "Création assortie, 2 allers-retours", "99 € HT"),
    ("Identité visuelle", "Logo et ses déclinaisons", "199 € HT"),
    ("Site Essentiel", "Site vitrine jusqu’à 5 pages", "dès 690 € HT"),
    ("Pack Visibilité", "Site + fiche Google + flyer + carte", "dès 1 390 € HT"),
    ("Vitrophanie", "D’après photos de votre vitrine", "sur devis"),
]

ETAPES = [
    ("On en parle", "Vos besoins, votre budget, vos délais."),
    ("Devis clair", "Un prix détaillé, sans surprise."),
    ("Création", "Maquettes, ajustements, validation."),
    ("Livraison", "Mise en ligne ou impression."),
]


def liste_offres(couleur_trait):
    return "".join(
        f"""<div style="display:flex;justify-content:space-between;align-items:baseline;gap:4mm;
          padding:2.6mm 0;border-bottom:.25mm solid {couleur_trait}">
          <div><h3>{t}</h3><div style="font-size:8pt;margin-top:.8mm" class="doux">{d}</div></div>
          <div style="font-family:'Josefin Sans';font-weight:600;font-size:11pt;white-space:nowrap">{p}</div></div>"""
        for t, d, p in OFFRES
    )


def liste_etapes():
    return "".join(
        f"""<div><div style="font-family:'Josefin Sans';font-weight:300;font-size:20pt;line-height:1">0{i + 1}</div>
          <h3 style="margin-top:2mm;font-size:10pt">{t}</h3><p class="doux" style="font-size:8pt;margin-top:1mm">{d}</p></div>"""
        for i, (t, d) in enumerate(ETAPES)
    )


FLYER_VERSO = f"""
<section class="page creme">
  <div class="kicker">Pour bien démarrer</div>
  <h2 style="margin-top:3mm">Des offres claires,<br>à prix connus d’avance.</h2>
  <div style="margin-top:6mm">{liste_offres("rgba(14,74,87,.18)")}</div>
  <div class="kicker" style="margin-top:9mm">Comment ça se passe</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin-top:4mm">{liste_etapes()}</div>
  <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end">
    <div style="margin-bottom:-2.6mm">{contacts(BLEU)}</div>
    <div style="text-align:center">{qr(BLEU, 20)}<div class="petit doux" style="margin-top:1.5mm">Voir le site</div></div>
  </div>
  <p class="petit doux" style="margin-top:4mm;margin-bottom:6mm">Prix HT. Impression, nom de domaine
    et hébergement non inclus sauf mention contraire. Détail des offres sur {WEB}.</p>
  <div style="position:absolute;left:0;right:0;bottom:10mm">{vague(.9)}</div>
</section>"""

# ─── Brochure A5 4 pages ─────────────────────────────────────────────────────

B_COUVERTURE = f"""
<section class="page bleu" style="align-items:center;justify-content:center;text-align:center">
  <div style="margin-top:-8mm">{logo(BLANC, 52)}</div>
  <div style="margin-top:12mm">{marque(BLANC, 17)}</div>
  <div class="kicker" style="margin-top:6mm;opacity:.82;font-family:Inter;font-weight:300;letter-spacing:.22em">
    Agence web &amp; print · Pays de Caux</div>
  <div class="kicker" style="position:absolute;bottom:26mm;left:0;right:0;opacity:.7">
    Sites internet · Identité visuelle · Impression · Vitrophanie</div>
  <div style="position:absolute;left:0;right:0;bottom:12mm">{vague()}</div>
</section>"""

ATOUTS = [
    ("Un seul interlocuteur", "Vous parlez à la personne qui conçoit votre projet, du premier échange à la livraison."),
    ("Proche de chez vous", "Basé à Gruchet-le-Valasse, je me déplace dans tout le Pays de Caux pour vous rencontrer."),
    ("Du web à l’imprimé", "Site, logo, flyers, vitrine : tous vos supports parlent d’une seule voix."),
]

B_INTERIEUR_G = f"""
<section class="page creme">
  <div class="kicker">Signe &amp; Seine</div>
  <h2 style="margin-top:3mm">Bonjour, je suis Adrien.</h2>
  <p style="margin-top:6mm;font-size:10.5pt">J’ai créé Signe &amp; Seine pour donner aux artisans, commerçants et indépendants du Pays de
    Caux une communication à la hauteur de leur savoir-faire : simple, soignée et efficace.</p>
  <p style="margin-top:3.5mm;font-size:10.5pt">Un site qui inspire confiance, un logo qu’on reconnaît, une vitrine qui attire l’œil :
    je m’occupe de tout, avec des prix annoncés à l’avance.</p>
  <div style="margin-top:12mm;display:flex;flex-direction:column;gap:8mm">
    {"".join(f'''<div style="display:flex;gap:4mm"><div style="width:1.2mm;flex:none;background:{BLEU};opacity:.85"></div>
      <div><h3 style="font-size:12.5pt">{t}</h3><p class="doux" style="margin-top:1.5mm;font-size:9.5pt">{d}</p></div></div>''' for t, d in ATOUTS)}
  </div>
  <div class="kicker" style="margin-top:auto">Comment ça se passe</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin-top:4mm;margin-bottom:2mm">{liste_etapes()}</div>
</section>"""

PRESTATIONS = [
    ("web", "Sites internet", "Sites vitrines et refontes, pensés pour le mobile et le référencement local. Maintenance et suivi possibles.",
     "Site Essentiel dès 690 € HT · Site Business dès 1 190 € HT"),
    ("identite", "Identité visuelle", "Logo et déclinaisons, couleurs, typographies, cartes de visite et papeterie.",
     "Identité visuelle simple 199 € HT"),
    ("impression", "Impression", "Flyers, dépliants, brochures, affiches, roll-up, étiquettes : création et suivi de fabrication.",
     "Pack flyer + carte de visite 99 € HT"),
    ("vitrine", "Vitrophanie", "Habillage de vitrines, horaires, lettrage adhésif et signalétique, d’après photos de votre local.",
     "Sur devis"),
]

B_INTERIEUR_D = f"""
<section class="page blanc">
  <div class="kicker">Ce que je fais pour vous</div>
  <h2 style="margin-top:3mm">Tout pour être vu,<br>en ligne comme en vitrine.</h2>
  <div style="margin-top:9mm;display:flex;flex-direction:column;gap:8.5mm">
    {"".join(f'''<div style="display:flex;gap:5mm">{ico(k, BLEU, 9)}<div><h3 style="font-size:12.5pt">{t}</h3>
      <p style="margin-top:1.5mm;font-size:9.5pt" class="doux">{d}</p>
      <div style="margin-top:2mm;font-size:8.8pt;font-weight:500">{prix}</div></div></div>''' for k, t, d, prix in PRESTATIONS)}
  </div>
  <div style="margin-top:auto;padding:5mm;border:.3mm solid rgba(14,74,87,.25);border-radius:2mm">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:4mm">
      <h3>Pack Visibilité</h3><div style="font-family:'Josefin Sans';font-weight:600;font-size:11pt">dès 1 390 € HT</div></div>
    <p class="doux" style="margin-top:1.2mm;font-size:8.5pt">Site Essentiel, fiche Google, flyer et carte de visite assortis :
      tout pour lancer ou relancer votre activité.</p>
  </div>
  <p class="petit doux" style="margin-top:3mm">Prix HT. Impression, nom de domaine et hébergement non inclus sauf mention contraire.</p>
</section>"""

B_DOS = f"""
<section class="page bleu">
  <div style="margin-top:14mm">{logo(BLANC, 20)}</div>
  <h2 style="margin-top:9mm;font-size:24pt">Parlons de<br>votre projet.</h2>
  <p style="margin-top:5mm;max-width:100mm;opacity:.85">Un appel ou un message suffit : je vous réponds rapidement et
    je vous envoie un devis détaillé.</p>
  <div style="margin-top:10mm">{contacts(BLANC)}</div>
  <div style="margin-top:8mm;display:flex;align-items:center;gap:5mm">
    <div style="background:{CREME};padding:2.5mm;border-radius:1.5mm">{qr(BLEU, 20)}</div>
    <p style="font-size:8.5pt;opacity:.8">Scannez pour voir<br>les réalisations et les tarifs.</p>
  </div>
  <div style="margin-top:auto;margin-bottom:12mm">{marque(BLANC, 9)}
    <div style="font-size:7.5pt;opacity:.7;margin-top:1.5mm">J’interviens à Bolbec, Lillebonne, Fécamp, Yvetot, Le Havre et dans tout le Pays de Caux.</div></div>
  <div style="position:absolute;left:0;right:0;bottom:10mm">{vague()}</div>
</section>"""


def document(titre, pages):
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{titre}</title>
<style>{CSS}</style></head><body>{"".join(pages)}</body></html>"""


def apercu(titre, pages, colonnes):
    cartes = "".join(f'<div class="trim">{p}</div>' for p in pages)
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{titre}</title>
<style>{CSS}
body{{background:#E4E1DB;padding:16mm;display:grid;grid-template-columns:repeat({colonnes},148mm);gap:12mm;width:max-content}}
.trim{{width:148mm;height:210mm;overflow:hidden;box-shadow:0 1mm 2mm rgba(40,35,28,.15),0 6mm 14mm -4mm rgba(40,35,28,.3)}}
.trim .page{{margin:-3mm}}
</style></head><body>{cartes}</body></html>"""


SORTIES = [
    ("flyer-a5", "Flyer Signe & Seine", [FLYER_RECTO, FLYER_VERSO], 2),
    ("brochure-a5-4-pages", "Brochure Signe & Seine", [B_COUVERTURE, B_INTERIEUR_G, B_INTERIEUR_D, B_DOS], 4),
]

if __name__ == "__main__":
    chromium = Path("/opt/pw-browsers/chromium")
    tmp = ROOT / "_rendu.html"
    with sync_playwright() as p:
        nav = p.chromium.launch(**({"executable_path": str(chromium)} if chromium.is_file() else {}))
        try:
            for nom, titre, pages, colonnes in SORTIES:
                page = nav.new_page(device_scale_factor=2)
                tmp.write_text(document(titre, pages), encoding="utf-8")
                page.goto(tmp.as_uri())
                page.wait_for_timeout(400)
                page.pdf(path=str(ROOT / f"{nom}.pdf"), prefer_css_page_size=True, print_background=True)
                tmp.write_text(apercu(titre, pages, colonnes), encoding="utf-8")
                page.goto(tmp.as_uri())
                page.wait_for_timeout(400)
                apercu_nom = "apercu-" + nom.split("-")[0] + ".png"
                page.locator("body").screenshot(path=str(ROOT / apercu_nom))
                page.close()
        finally:
            tmp.unlink(missing_ok=True)
            nav.close()
    print("ok")
