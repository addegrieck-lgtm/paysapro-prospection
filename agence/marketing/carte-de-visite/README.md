# Carte de visite — SIGNE & SEINE

Format 85 × 55 mm, recto bleu Seine `#0E4A57`, verso crème `#F6F1E8`, accent orange brique `#C2410C` (vague et « & » uniquement).

- `maquette.png` : recto et verso côte à côte, rendu papier mat avec ombre portée.
- `carte-signe-et-seine.pdf` : fichier d'impression, 2 pages au format fini 85 × 55 mm (recto, verso), texte vectoriel, polices incorporées.
- `build.py` : source du design (logo, mise en page, QR code vers https://www.signeetseine.fr).
- `fonts/` : Josefin Sans et Inter (SIL Open Font License).

Régénérer : `pip install qrcode && python3 -I build.py`, ce qui produit `maquette.html` et `carte-impression.html` (fichiers non versionnés), à ouvrir dans Chromium pour la capture ou l'export PDF.

Avant l'envoi chez l'imprimeur : remplacer `[Prénom Nom]` dans `build.py`, puis demander à l'imprimeur s'il veut un fond perdu (en général 2 à 3 mm) et des traits de coupe.
