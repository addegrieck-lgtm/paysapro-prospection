# S&S Social Finder — Signe & Seine

Logiciel **local** (Windows, macOS, Linux) de découverte de prospects sur **Instagram et Facebook**, pour l'agence
Signe & Seine. Il trouve lui-même les entreprises à partir d'une ville et d'une activité, rapproche leurs profils,
calcule **deux scores indépendants** (confiance de l'identification /100 et potentiel commercial /100), prépare des
messages personnalisés et suit la prospection. L'envoi des messages reste **manuel**.

> Spécialisé dans la découverte sociale : pas d'enrichissement e-mail / téléphone (fonction de votre autre logiciel).

## Installation (Windows)

1. Installez **Python 3.12** depuis <https://www.python.org/downloads/> en cochant **« Add python.exe to PATH »**.
2. Téléchargez le dépôt (bouton *Code → Download ZIP* sur GitHub) et décompressez-le.
3. Double-cliquez sur **`social-finder\START.bat`**.
   La première fois, il crée un environnement Python et installe les dépendances (1 à 2 minutes),
   puis ouvre <http://127.0.0.1:8765> dans votre navigateur.
4. Pour arrêter : fermez la fenêtre noire.

Node.js n'est **pas** nécessaire : l'interface est livrée déjà construite (`frontend/dist`).
macOS / Linux : `./start.sh`.

## Premier usage (10 minutes)

1. **Sources & connecteurs** : créez une clé gratuite **Brave Search API** (procédure affichée dans l'écran) et
   cliquez « Tester ». Sans clé, la **recherche assistée** reste disponible (vous ouvrez les recherches préparées et
   collez les profils retenus).
2. **Paramètres → Signature** : votre nom et votre signature (utilisés dans les messages).
3. **Découverte sociale** : ville (ex. *Le Havre*), activité (*Restaurant*), réseaux, quantité → **LANCER LA RECHERCHE**.
   Suivez la progression en direct.
4. **Meilleurs prospects** : confiance ≥ 75 **et** potentiel ≥ 70. Ouvrez une fiche : détail des points, preuves,
   opportunités, puis **AI Message Studio** → *Générer*.
5. **File de prospection** : *Copier le message* → *Ouvrir le profil* → envoyez-le depuis Instagram / Facebook →
   *Marquer comme envoyé*.
6. Mettez à jour le statut (Réponse reçue, Intéressé…) depuis la fiche.

Pour découvrir l'interface sans clé : **Paramètres → Données → Charger la démo** (fiches fictives marquées « DÉMO »,
exclues des statistiques, supprimables en un clic).

## Ce qui fonctionne sans configuration

| Fonction | Sans clé | Avec configuration |
|---|---|---|
| Recherche assistée (requêtes préparées + ajout des profils) | ✅ | |
| Découverte automatique | ❌ (statut « aucune source », rien d'inventé) | Brave Search / Google Programmable Search |
| Vérification officielle des comptes Instagram pro | | API Meta (Business Discovery) |
| Double scoring, analyse, rapprochement, dédoublonnage | ✅ | |
| Diagnostic du site de l'entreprise, rayon géographique | ✅ (Internet requis) | |
| Messages personnalisés | ✅ modèles intégrés | Ollama (IA locale gratuite), API OpenAI-compatible, Anthropic |
| Suivi, campagnes, tableau de bord, CSV, sauvegardes, RGPD | ✅ | |

## Documentation

- [docs/AUDIT-ET-PLAN.md](docs/AUDIT-ET-PLAN.md) — audit du dépôt, choix techniques, compte rendu des phases
- [docs/SCORING.md](docs/SCORING.md) — les deux scores, critère par critère
- [docs/CONNECTEURS.md](docs/CONNECTEURS.md) — configurer Brave, Google, Meta, l'IA
- [docs/CONFORMITE.md](docs/CONFORMITE.md) — RGPD, conditions Meta, ce que le logiciel ne fait pas
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — modules, base de données, API, tests

## Données

Tout est dans `social-finder/data/` : base `social_finder.db`, `backups/`, `logs/app.log`.
Sauvegarde : *Paramètres → Données → Créer une sauvegarde*. Restauration : remplacez `data/social_finder.db`
par une sauvegarde, logiciel arrêté.

## Développement

```bash
cd social-finder/backend && python -m pytest -q          # tests (ou TESTS.bat)
cd social-finder/backend && uvicorn app.main:app --reload --port 8765
cd social-finder/frontend && npm install && npm run dev   # interface sur http://localhost:5174
cd social-finder/frontend && npm run build                # régénère frontend/dist (à committer)
```
