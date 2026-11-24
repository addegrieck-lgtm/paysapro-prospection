# Cartes de visite — Signe & Seine

Générées par `scripts/business-cards.mjs` : `CHROMIUM_PATH=… node scripts/business-cards.mjs`
(variables facultatives `CARD_NAME` et `CARD_ROLE` pour ajouter un nom et une fonction au verso).

| Fichier | Contenu |
|---|---|
| `planche-presentation.png` | Les 3 rectos et le verso, pour choisir |
| `carte-1-web-recto-verso.pdf` | Recto « le web » : la carte est une fenêtre de navigateur ouverte sur le site |
| `carte-2-impression-recto-verso.pdf` | Recto « l'impression » : repères de coupe, gamme CMJN et tampon « Bon à tirer » |
| `carte-3-vitrine-recto-verso.pdf` | Recto « la vitrine » : enseigne, store, lettrage adhésif et pancarte « Ouvert » |
| `apercu-*.png` | Aperçus au format fini |
| `qr-site.svg` | QR code du verso (site, `utm_source=carte-de-visite`) |

## Fichiers d'impression
- PDF de 2 pages (page 1 recto, page 2 verso), **91 × 61 mm** : format fini 85 × 55 mm + 3 mm de fond perdu.
  Textes à 3 mm au moins à l'intérieur du trait de coupe.
- Couleurs en RVB : les imprimeurs en ligne les convertissent en CMJN. Les couleurs vives de la gamme CMJN
  (recto 2) seront légèrement plus sourdes à l'impression.
- Papier conseillé : **400 g couché mat, pelliculage mat ou soft-touch recto-verso** (voir `/impression/cartes-de-visite`).
- Le QR code a été vérifié à la lecture. Les visites qu'il apporte apparaissent avec la source « carte-de-visite »
  dans les statistiques de l'administration.
