# Publicité cinématique Signe & Seine (Remotion)

Film publicitaire de 50 s et ses déclinaisons, entièrement procédural : React + TypeScript, CSS 3D, SVG, rendu par Remotion.
Projet autonome : il a ses propres dépendances et ne touche ni au site de l'agence (`agence/src`) ni à l'appli de prospection.

## Livrables (`out/`, après rendu)

| Fichier | Format | Durée | Contenu |
|---|---|---|---|
| `signe-et-seine-50s-16x9.mp4` | 1920 × 1080 | 50 s | Version principale pour le site, musique (+ voix off si fournie) |
| `signe-et-seine-50s-9x16.mp4` | 1080 × 1920 | 50 s | Reels, TikTok, Shorts : composition repensée pour le vertical |
| `signe-et-seine-15s-16x9.mp4` | 1920 × 1080 | 15 s | Publicité, prospection |
| `signe-et-seine-15s-9x16.mp4` | 1080 × 1920 | 15 s | Stories, Reels courts |
| `signe-et-seine-50s-16x9-sous-titres.mp4` | 1920 × 1080 | 50 s | Sans voix off, sous-titres incrustés + musique |
| `sous-titres-50s.srt` | — | — | Sous-titres séparés pour YouTube, Facebook, LinkedIn |

Tout est en H.264 / AAC, yuv420p, 25 i/s, lisible partout.

## Installation

Prérequis : Node 18+ (testé avec Node 22), Python 3 + numpy (musique), ffmpeg n'est pas requis.

```bash
cd agence/marketing/video-cinematique
npm install
npx remotion browser ensure   # télécharge le navigateur de rendu (une fois)
```

## Commandes

```bash
npm run studio                 # aperçu interactif dans le navigateur (timeline, lecture, réglages)
npm run render                 # rend les 5 déclinaisons + le SRT dans out/
npm run render -- Pub-15s-9x16 # rend une seule composition
npm run musique                # régénère la bande sonore
npm run typecheck
```

Compter environ 1 à 2 s de calcul par seconde de vidéo et par cœur. Le nombre de processus se règle avec `CONCURRENCY=8 npm run render`.

## Modifier sans toucher aux animations

| Quoi | Où |
|---|---|
| Textes à l'écran, durées des scènes, version courte | `src/config/timeline.ts` |
| Texte et calage de la voix off (pilote aussi les sous-titres) | `src/config/voix-off.json` |
| Couleurs, polices, adresse du site, téléphone, QR code | `src/config/brand.ts` |
| Logo | `src/components/Logo.tsx` (pictogramme officiel du site, tracés inchangés) |
| Sites d'exemple montrés sur les écrans | `src/components/Website.tsx` |
| Mots-clés et indicateurs SEO | `src/scenes/Referencement.tsx` |
| Musique (accords, impacts, montées) | `scripts/musique.py` |

Après modification, relancer `npm run render`. Si les durées changent, reporter les nouveaux instants dans `scripts/musique.py` (`COUPES`) et relancer `npm run musique`.

## Architecture

```
src/
  index.ts, Root.tsx        5 compositions (formats × durées × options)
  Film.tsx                  assemble les scènes selon la timeline, transitions, sous-titres, audio
  config/                   brand.ts, timeline.ts, voix-off.json
  scenes/                   Manifeste, Transformation, Referencement, Identite, Signature
  components/               logo, atmosphère (fond, particules 3D, ligne de lumière, grain),
                            titres animés, appareils CSS 3D, sites d'exemple, QR code
scripts/                    musique.py, render-all.sh, srt.mjs
public/                     polices du site, grain, audio, éléments de marque (brand/)
```

Chaque scène reçoit sa durée et adapte ses animations : la même scène sert à la version 50 s et à la version 15 s. Chaque scène lit aussi le format et recompose sa mise en page en vertical (appareils empilés, graphe en colonne, planche de marque sur deux colonnes).

## Storyboard

| Temps | Scène | À l'écran |
|---|---|---|
| 0–7 s | Manifeste | Noir, ligne de lumière, particules, caméra qui avance, révélation du logo par balayage lumineux. « Votre entreprise mérite d’être vue autrement. » |
| 7–18 s | Transformation | Studio sombre, ordinateur et smartphone en orbite, trois sites d'exemple (artisan, services, commerce) qui s'enchaînent. « Des sites qui inspirent confiance. » |
| 18–29 s | Référencement | Grille lumineuse, mots-clés reliés aux pages du site, courbe de visibilité et indicateurs SEO, sans aucun chiffre. « Une visibilité pensée pour vous démarquer. » |
| 29–39 s | Identité visuelle | Balayage de lumière ; logo, typographies, palette, carte de visite, flyer et site flottent puis se rangent en planche de marque sur le temps fort de 33 s. « Une image professionnelle. Une stratégie cohérente. » |
| 39–50 s | Signature | Les particules convergent, la lumière révèle le logo, recul de caméra. « SIGNE & SEINE », « Création web • SEO • Identité visuelle », « Donnons une nouvelle dimension à votre entreprise. », puis « Parlons de votre projet. », signeetseine.fr et QR code. |

## Choix et limites

- **3D en CSS plutôt qu'en Three.js.** Le rendu se fait sans carte graphique. Les transformations CSS 3D (perspective, orbite, profondeur, reflets en dégradé) donnent des écrans parfaitement nets et un rendu rapide. Un moteur WebGL aurait demandé un rendu logiciel lent, pour un gain visuel faible sur des objets plats (écrans, cartes, interfaces).
- **Marque.** Couleurs, polices (Josefin Sans, Inter Tight) et pictogramme viennent du site en ligne. L'adresse affichée, **signeetseine.fr**, est l'adresse canonique du site, vérifiée en ligne le 22/10/2026. Le bleu nuit et la lumière bleutée sont dérivés du bleu Seine `#0E4A57`. L'orange `#C2410C` reste réservé à la vague et au « & ».
- **Honnêteté du contenu.** Aucun faux témoignage, client, classement ou chiffre de résultat. Les sites montrés sont des modèles génériques (« Votre menuiserie »…). Le graphe de visibilité n'a pas d'axe chiffré. Les indicateurs sont une liste de bonnes pratiques.
- **Musique.** Elle est composée par `scripts/musique.py` (nappes, pulsation, impacts calés sur les scènes) : c'est une création originale, sans droits tiers. Elle sert de bande provisoire fonctionnelle. Pour une diffusion publicitaire, on peut la remplacer par une piste sous licence : déposer `public/audio/musique-50s.wav` et `musique-15s.wav`, puis relancer le rendu.
- **Voix off.** Elle n'est pas fournie : voir [VOIX-OFF.md](VOIX-OFF.md). La vidéo l'intègre automatiquement dès qu'un fichier est déposé.
