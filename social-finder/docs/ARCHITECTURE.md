# Architecture technique

```
social-finder/
├── START.bat / start.sh / TESTS.bat
├── backend/            Python 3.10+ · FastAPI · SQLite (sqlite3 standard) · httpx
│   ├── app/
│   │   ├── main.py              API + service de l'interface (frontend/dist) sur 127.0.0.1:8765
│   │   ├── db.py                schéma SQLite, sessions (WAL)
│   │   ├── settings_store.py    paramètres et clés (masquées à l'affichage)
│   │   ├── referentials.py      régions, départements, grandes villes, 17 métiers (synonymes, pertinence, services)
│   │   ├── social_urls.py       reconnaissance des URL de profils, lecture titre/extrait (abonnés, bio, mentions)
│   │   ├── connectors/          search_engines (Brave, Google CSE) · meta (Graph API) · website · geo · base (quotas)
│   │   ├── discovery/           queries (génération) · engine (tâche de fond) · matching (FB↔IG)
│   │   ├── scoring/             facts · confidence · commercial · common (niveaux, priorité)
│   │   ├── analysis.py          opportunités, services, recommandation
│   │   ├── ai/                  messages (modèles, styles, règles) · providers (Ollama, OpenAI-compatible, Anthropic)
│   │   ├── repo.py              profils, entreprises, fusion/séparation, recalcul, liste de suppression
│   │   ├── demo.py              données fictives marquées DÉMO
│   │   └── api/                 routes (companies.py, main_routes.py)
│   └── tests/                   37 tests (pytest) : parsing, scores, rapprochement, moteur, API, RGPD
└── frontend/           React 19 · TypeScript · Vite · Tailwind CSS 4 · lucide-react
    ├── src/components/ui        composants à la manière de shadcn/ui (locaux, sans dépendance Radix)
    ├── src/pages                Tableau de bord, Découverte, Prospects, Fiche, File, Campagnes, Correspondances, Studio, Sources, Paramètres
    └── dist/                    interface construite, livrée dans le dépôt (Node inutile pour l'utilisateur)
```

## Modèle de données

| Table | Rôle |
|---|---|
| `companies` | entreprise : nom, activité, ville confirmée, zone recherchée, statut, notes, 2 scores + détail JSON, priorité, analyse, démo |
| `profiles` | profil Instagram / page Facebook (unique par réseau + identifiant), données lues, source, vérification API |
| `match_suggestions` / `match_history` | correspondances à valider, journal des rapprochements, fusions, séparations, rejets |
| `messages` | brouillons et messages envoyés (canal, style, fournisseur, date d'envoi) |
| `events` | historique des actions par entreprise |
| `campaigns` / `searches` | campagnes (critères), recherches (statistiques, journal, requêtes effectuées) |
| `suppression_list` | oppositions |
| `api_usage` | quotas journaliers par connecteur |
| `settings`, `message_templates` | paramètres, modèles personnalisés |

## Déroulement d'une recherche

`POST /api/searches` → thread de fond `Job` : lieux (ville + communes du rayon) → requêtes → connecteur disponible
(bascule sur le suivant en cas de quota) → pour chaque résultat : URL de profil ? liste de suppression ? profil connu ?
→ création de l'entreprise → vérification Meta (si configurée) → diagnostic du site → scores → rapprochement FB/IG
(fusion auto sur preuve forte, sinon suggestion) → filtres → arrêt à l'objectif ou à l'épuisement des requêtes.
L'interface interroge `GET /api/searches/{id}` toutes les 1,2 s.

## API

Documentation interactive : <http://127.0.0.1:8765/docs> (générée par FastAPI).
