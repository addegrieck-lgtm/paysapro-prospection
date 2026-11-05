# Normandie Business Radar

Outil personnel d'intelligence économique pour **détecter, analyser, classer et suivre des opportunités de reprise
d'entreprises en Seine-Maritime (76)** — extensible aux autres départements (27, 14, 50, 61…) par simple réglage.

Projet **distinct** des autres dossiers du dépôt (application Paysapro, `agence/`, `social-finder/`) : aucune donnée ni
infrastructure partagée.

> **Règle absolue : aucune entreprise fictive.** Le tableau de bord n'affiche que des données issues de sources
> vérifiables (chaque champ garde sa source, sa date, son statut et sa confiance). Sans données, l'outil affiche un
> état vide et propose la synchronisation. Une note n'est attribuée que si les données le permettent
> (« données insuffisantes » sinon).

## Ce que fait l'outil

| Rubrique | Contenu |
|---|---|
| Vue générale | Compteurs, **TOP OPPORTUNITÉS** (score économique, risque et fiabilité affichés séparément), découvertes, répartitions, état des sources |
| Carte du 76 | Leaflet + OpenStreetMap, regroupement des marqueurs, filtres, fiche rapide, opportunités à moins de 15 km |
| Toutes les entreprises | Recherche multicritère (≈ 30 filtres, rayon autour d'une commune), recherches enregistrées avec alerte, exports CSV / Excel |
| Opportunités à vendre | Annonces de cession (flux RSS, imports) et cessions réalisées publiées au BODACC (distinguées) |
| Transmissions potentielles | Signaux publics vérifiables (avec preuve) et pistes de prospection (jamais présentées comme « à vendre ») |
| Procédures judiciaires | Sauvegarde / redressement / liquidation reconstituées jugement par jugement : ouverte, en cours, plan arrêté, plan de cession, clôturée |
| Analyse financière | Indicateurs (formules et données utilisées), tendances 3-5 ans, valorisation multi-méthodes, scénarios prudent / central / optimiste à 3 et 5 ans |
| Comparateur | Jusqu'à 6 entreprises côte à côte |
| Acquisition Manager | 13 statuts, prix demandé / estimé / offre, notes, actions, rappels, contacts, documents, simulations enregistrées |
| RADAR AI | Assistant en français fondé sur les seules données de l'outil (moteur local gratuit ; synthèse par Claude facultative avec plafond de dépense) |
| Alertes | Veille quotidienne : nouvelles procédures, annonces, signaux, évolutions financières, scores élevés, sources en erreur |
| Administration | Sources, synchronisations et journal, secteurs, pondérations, paramètres, utilisateurs et rôles, imports, sauvegarde / restauration, RGPD, audit |

## Démarrage local (5 minutes, gratuit)

Prérequis : Node.js ≥ 22.13.

```bash
cd radar
npm install
cp .env.example .env          # puis renseignez SETUP_TOKEN (16 caractères minimum)
npm run build                 # compile l'interface
npm start                     # http://localhost:8788
```

1. Ouvrez http://localhost:8788 : saisissez le **jeton d'installation** (`SETUP_TOKEN`) et créez le compte administrateur
   (sans `SETUP_TOKEN` en développement, un jeton temporaire est affiché dans la console).
2. **Vue générale → Lancer la première synchronisation.** La veille interroge l'annuaire officiel (SIRENE / RNE), le
   BODACC et le référentiel des communes, puis calcule scores, valorisations et opportunités.
3. Pour une veille complète d'un coup, en ligne de commande : `npm run sync` (rapport d'exécution détaillé).

Développement avec rechargement : `npm run dev` (API sur 8788, interface Vite sur http://localhost:5280).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | API + interface en mode développement |
| `npm run build` | vérification TypeScript + compilation de l'interface (`dist/client`) |
| `npm start` | serveur Node (API + interface compilée + veille planifiée à 4 h 17) |
| `npm test` | 75 tests (calculs financiers, procédures, scoring, connecteurs, orchestrateur, API, sécurité) |
| `npm run sync [-- source]` | veille complète en ligne de commande |
| `npm run user:create -- email "Nom" admin` | création d'un compte (mot de passe demandé de façon interactive) |
| `npm run deploy` | mise en ligne Cloudflare (voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)) |

## Documentation

- [Guide de déploiement (Cloudflare et serveur Node)](docs/DEPLOIEMENT.md)
- [Guide de configuration des sources (clés, quotas, conditions)](docs/SOURCES.md)
- [Documentation technique (architecture, modèle de données, moteurs, sécurité)](docs/TECHNIQUE.md)
- [Fonctionnalités opérationnelles et limitations](docs/FONCTIONNALITES.md)
- [`.env.example`](.env.example) — aucune valeur secrète

## Avertissement

Les scores, valorisations et scénarios sont des **outils d'aide à l'analyse** fondés sur des données publiques et des
hypothèses paramétrables. Ils ne constituent ni une évaluation professionnelle, ni un conseil en investissement, ni une
promesse de rendement. Toute acquisition nécessite un audit (comptable, juridique, social, fiscal) et l'avis de
professionnels.
