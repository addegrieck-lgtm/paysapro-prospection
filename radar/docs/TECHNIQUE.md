# Documentation technique

## Architecture

```
radar/
├── src/server/
│   ├── worker.ts            point d'entrée Cloudflare (fetch + scheduled)
│   ├── node.ts              point d'entrée Node (même API, SQLite, veille par minuterie)
│   ├── app.ts               API Hono : sécurité, rôles, routes /api/*
│   ├── db/                  adaptateurs SQLite Node / D1 (même interface), migrations, initialisation
│   ├── domain/              moteurs purs, sans accès base : testés unitairement
│   │   ├── sectors.ts         classification NAF hiérarchique, tranches d'effectif, formes juridiques
│   │   ├── financial.ts       indicateurs (formules, données manquantes), tendances, EBE normatif
│   │   ├── valuation.ts       6 méthodes de valorisation, hypothèses paramétrables
│   │   ├── scenarios.ts       financement, projections 5 ans, seuil, délai de récupération, TRI
│   │   ├── scoring.ts         score économique / risque / fiabilité, garde-fou « données insuffisantes »
│   │   ├── proceedings.ts     classification des jugements BODACC, machine d'états des procédures
│   │   ├── opportunities.ts   radars A-D, signaux textuels explicites, indice de transmission
│   │   └── distress.ts        modes de reprise en difficulté, risques, checklists
│   ├── connectors/          un fichier par source + registre ; contrat planTasks / runChunk
│   ├── services/            écriture avec provenance, veille, analyse, recherche, alertes, projets,
│   │                        imports/exports, RGPD, assistant, authentification, réglages
│   └── lib/                 HTTP (quotas, nouvelles tentatives, budget), crypto, géodésie, CSV/XLSX, stockage
├── src/client/              React 19 + React Router 8 + Tailwind 4 (Vite), Leaflet + markercluster
├── tests/                   Vitest : domaine, connecteurs, orchestrateur, API
└── scripts/                 déploiement Cloudflare, veille en ligne de commande, création de compte
```

Choix techniques : **un seul Worker** (API + fichiers statiques + cron) plutôt que Pages + Worker, pour un déploiement
unique et des cookies same-origin ; **Hono** (compatible Workers et Node) ; **SQL paramétré** identique sur D1 et SQLite
(`node:sqlite`) ; **zod** pour toutes les entrées ; **WebCrypto** (PBKDF2, SHA-256) disponible des deux côtés ;
**fflate** pour produire les fichiers Excel sans dépendance lourde ; SDK officiel `@anthropic-ai/sdk` (facultatif).

## Modèle de données (D1 / SQLite)

Tables principales (`src/server/db/migrations.ts`) :

| Domaine | Tables |
|---|---|
| Entreprises | `companies` (SIREN unique), `establishments` (SIRET clé primaire), `company_identifiers`, `company_directors`, `company_contacts`, `business_assets` |
| Provenance et historique | `company_field_sources` (source, date, statut, confiance de chaque champ), `company_changes` (ancienne / nouvelle valeur), `source_records` (empreinte et extrait de chaque enregistrement source, unique par source × identifiant) |
| Finances | `company_financials` (un exercice par source, statut et confiance), `company_metrics` (dernières valeurs dénormalisées pour les filtres) |
| Juridique et marché | `company_events`, `legal_proceedings`, `sale_listings` (`is_offer` distingue annonce et cession réalisée), `transmission_signals` (preuve + URL) |
| Analyse | `scoring_results`, `valuations`, `acquisition_opportunities` (raisons explicables), `financial_scenarios`, `analysis_queue` |
| Veille | `sources`, `sync_runs`, `sync_jobs` (curseur de reprise, tentatives, journal), `alerts` (clé de déduplication) |
| Utilisateur | `users`, `sessions` (hachage du jeton), `saved_searches`, `acquisition_projects`, `acquisition_notes`, `project_contacts`, `documents` |
| Conformité | `audit_logs`, `data_requests`, `suppression_list`, `settings`, `rate_limits` |

Déduplication : SIREN (entreprises), SIRET (établissements), `(source_id, external_id)` (enregistrements),
`(source_id, reference)` (événements), `(company_id, fiscal_year, source_id)` (exercices).

Règles d'écriture (`services/companies.ts`) : une valeur vide n'efface jamais une valeur connue ; une valeur n'est
remplacée que par une source au moins aussi fiable (ou si l'ancienne a plus de 180 jours) ; chaque changement est
historisé ; un SIREN de la liste d'opposition n'est jamais réimporté.

Fusion des exercices multi-sources (`services/analysis.ts → loadFinancials`) : la source la plus fiable fait foi pour
un exercice ; une autre source ne complète ses champs manquants que si les chiffres d'affaires concordent (≤ 5 %) ;
sinon elle est écartée et le conflit est affiché.

## Veille (orchestrateur `services/sync.ts`)

1. `startRun` : une ou plusieurs tâches par source activée ; source sans clé → tâche « non interrogée ».
2. `tick` : lots bornés en temps et en requêtes, à tour de rôle entre sources ; curseur enregistré après chaque lot ;
   budget épuisé en cours de lot → progression conservée. Échec : 3 tentatives ; disjoncteur par source.
3. Réanalyse des entreprises modifiées (`analysis_queue`), alertes, recherches enregistrées, rapport
   (`sync_runs.summary` : lus / nouveaux / modifiés / erreurs / durée par source). Statut `partial` dès qu'une source
   activée n'a pas pu être interrogée.

## Moteurs de calcul

- **Indicateurs** : croissance, marges (brute, EBE, opérationnelle, nette), EBE (publié ou recalculé et marqué), ROCE,
  ROE, gearing, dette nette, capacité de remboursement, autonomie et dépendance financières, BFR (€ et jours), évolution
  des capitaux propres et de l'effectif, CA par salarié. Aucun indicateur sans ses données ; formule et entrées exposées.
- **Tendances** (3 à 5 exercices) : croissance régulière, stagnation, dégradation, redressement, rentabilité
  exceptionnelle, charges inhabituelles, fragilité, éléments non récurrents, pertes. La rentabilité est jugée sur les
  marges, jamais sur le niveau de CA.
- **Valorisation** : multiples d'EBE (par taille, ajustés récurrence / croissance / fragilité / dépendance au dirigeant),
  multiple de CA (secteurs pertinents, activité non déficitaire), actif net comptable, valeur des actifs, flux
  actualisés (3 exercices d'EBE positif et stable requis), fonds de commerce. Synthèse pondérée bas / central / haut,
  hypothèses et limites. Coefficients paramétrables, présentés comme hypothèses.
- **Scénarios** : besoin de financement (prix, frais, investissements, BFR, trésorerie), emprunt et annuité,
  projections sur 5 ans (lecture à 3 et 5 ans), couverture du service de la dette, seuil de rentabilité (si taux de
  marge connu), délai de récupération de l'apport, rendement de l'entreprise (résultat d'exploitation après impôt /
  investissement) distinct du TRI des fonds propres (après dette, valeur de revente à 5 ans).
- **Scoring** : composantes notées seulement si documentées ; score économique ramené vers 50 selon la couverture et
  non calculé sous 40 % ; risque : composante inconnue = risque moyen par prudence ; fiabilité : identité, comptes,
  fraîcheur, provenance officielle, géolocalisation.
- **Procédures** : rejouées chronologiquement (indépendant de l'ordre d'arrivée), avis d'annulation neutralisant
  l'annonce visée, conversions (redressement → liquidation), plans, plans de cession, clôtures (motif).

## Sécurité

- Sessions : jeton aléatoire 256 bits, seul son SHA-256 est stocké ; cookie HttpOnly, SameSite=Strict, Secure en
  production ; 14 jours ; invalidation au changement de mot de passe, à la désactivation et à la restauration.
- CSRF : en-tête `X-Requested-With: radar` obligatoire sur toute écriture + contrôle de l'origine.
- Mots de passe : PBKDF2-SHA256 100 000 itérations, sel 16 octets ; verrouillage progressif ; limitation par IP hachée.
- Entrées validées (zod), SQL paramétré, tailles limitées (corps 25 Mo, documents 20 Mo, imports 10 Mo / 20 000 lignes),
  types de fichiers en liste blanche, téléchargements en pièce jointe avec `nosniff`.
- Exports réservés aux analystes, limités à 20 par heure, journalisés, protégés contre l'injection de formules.
- Requêtes sortantes : adresses non publiques refusées, redirections revalidées, robots.txt respecté.
- En-têtes : CSP stricte (`default-src 'none'` pour l'API ; `public/_headers` pour l'interface), `frame-ancestors 'none'`.
- Secrets : variables d'environnement / secrets Cloudflare uniquement (`.env.example` sans valeur).

## Tests

`npm test` — 75 tests :
- `tests/domain.test.ts` : secteurs, indicateurs, tendances, procédures, valorisation, scénarios (annuité, TRI),
  scoring (données insuffisantes), radars, entreprises en difficulté ;
- `tests/connectors.test.ts` : chaque connecteur sur des réponses au format documenté (entreprises fictives),
  déduplication, historique, priorité des sources, liste d'opposition, Lambert 93, robots.txt, RSS ;
- `tests/sync.test.ts` : isolation des pannes, disjoncteur, statut partiel, reprise sur curseur, analyse, recherche,
  pondérations, fusion multi-sources ;
- `tests/api.test.ts` : installation, verrouillage, CSRF, hachages, rôles, exports, imports, Acquisition Manager,
  RADAR AI sans invention, sauvegarde / restauration, effacement RGPD.

Vérifications complémentaires réalisées : compilation du Worker (`wrangler deploy --dry-run`), exécution locale dans
`workerd` avec D1 (API, import, sauvegarde/restauration, cron), parcours navigateur complet (Playwright) sur ordinateur
et téléphone.
