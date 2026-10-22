# Voix off : enregistrement et intégration

**Aucune voix off n'est fournie dans ce dossier.** Aucun outil de synthèse vocale de qualité n'était disponible localement, et une voix robotique aurait desservi la marque. La vidéo est prête à la recevoir : il suffit de déposer le fichier et de relancer le rendu.

## 1. Le texte et son calage

À lire de façon posée et assurée, sans précipitation. Les temps viennent de `src/config/voix-off.json` ; c'est ce fichier qui pilote aussi les sous-titres.

| Début | Fin | Phrase |
|---|---|---|
| 0,8 s | 3,8 s | Aujourd’hui, votre entreprise ne doit pas simplement exister. |
| 4,0 s | 6,4 s | Elle doit marquer les esprits. |
| 8,0 s | 13,5 s | Chez Signe & Seine, nous transformons vos idées en une présence digitale qui inspire confiance. |
| 19,0 s | 27,0 s | Création de sites internet, référencement naturel et identité visuelle : chaque détail est pensé pour vous démarquer. |
| 30,5 s | 35,0 s | Parce que votre savoir-faire mérite une image à sa hauteur. |
| 40,5 s | 45,5 s | Signe & Seine. Votre image, votre ambition, une nouvelle dimension. |
| 46,6 s | 48,6 s | Parlons de votre projet. |

Prononciation : « Signe et Seine ».

## 2. Trois façons de l'obtenir

1. **Voix humaine (recommandé pour une publicité premium).** Un comédien voix off (plateformes Fiverr, Voice123, Malt), environ 50 à 200 € pour 50 s, droits d'usage publicitaire inclus. Envoyez-lui ce fichier et la vidéo sans voix (`signe-et-seine-50s-16x9.mp4`) comme guide de calage.
2. **Vous-même**, au smartphone, dans une pièce calme et meublée (pas de salle de bain) : téléphone à 20 cm, légèrement de côté. Nettoyage possible avec Adobe Podcast Enhance (gratuit).
3. **Voix de synthèse**, par exemple ElevenLabs (voix française « narration »). Vérifiez que votre formule autorise l'usage commercial, et ne présentez jamais une voix de synthèse comme celle d'une personne réelle.

## 3. Intégrer la voix

1. Exportez **une seule piste** de 50 s, calée sur le tableau ci-dessus (silence au début inclus), en WAV 48 kHz ou en MP3.
2. Déposez-la sous le nom `public/audio/voix-off.wav` (ou `.mp3`, `.m4a`).
3. Relancez : `npm run render -- Pub-16x9 Pub-9x16`

Les compositions `Pub-16x9` et `Pub-9x16` détectent automatiquement le fichier, ajoutent la voix et baissent la musique (volume 0,45). Sans fichier, elles sortent avec la musique seule.

Si la lecture réelle s'écarte du calage, modifiez les temps dans `src/config/voix-off.json` (les sous-titres suivent), et si besoin les durées des scènes dans `src/config/timeline.ts`.
