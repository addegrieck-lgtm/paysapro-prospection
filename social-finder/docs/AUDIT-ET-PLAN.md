# Audit, choix techniques et compte rendu des phases

## Phase 1 — Audit du dépôt existant

S&S Social Finder est un **logiciel autonome**, sans lien avec les autres projets présents dans ce dépôt :
aucun code, aucune donnée et aucun service partagés. Il ne reconstruit pas la recherche de coordonnées ni
l'enrichissement (fonctions de votre autre logiciel de prospection).

Contraintes relevées : pas de serveur payant, données locales, aucune collecte non autorisée sur Meta, un
utilisateur non développeur sous Windows.

**Choix** : un projet séparé `social-finder/` (comme `agence/`) avec la pile demandée — FastAPI + SQLite +
React/TypeScript/Vite/Tailwind — servi par un seul processus local lancé par `START.bat`. L'interface est livrée
construite pour éviter l'installation de Node.js. Les composants d'interface suivent l'approche shadcn/ui
(composants copiés localement, variantes Tailwind) sans dépendre de Radix, pour garder l'installation légère.
Les scores sont **déterministes** (règles versionnées) pour être transparents et reproductibles ; l'IA ne sert
qu'à la rédaction.

## Phases 2 à 8 — compte rendu

| Phase | Développé | Fonctionne réellement | Configuration externe | Tests |
|---|---|---|---|---|
| 2 Architecture | schéma SQLite (11 tables), paramètres, journal, connecteurs interchangeables, quotas | ✅ | — | tests API, persistance |
| 3 Découverte | génération des requêtes, 2 moteurs officiels avec bascule, reconnaissance des URL, lecture des extraits, rayon geo.api.gouv.fr, filtres, reprise de campagne, recherche assistée, liste de suppression | ✅ avec connecteur de test ; ✅ recherche assistée | clé Brave (gratuite) ou Google CSE | parsing, moteur, bascule de quota, absence de source, reprise |
| 3 Rapprochement | comparaison FB↔IG, fusion auto sur preuve forte, suggestions, fusion/séparation manuelles, historique, doublons de noms | ✅ | — | fusion auto, suggestion, split/merge |
| 4 Double scoring | confiance /100 et commercial /100, preuves, statuts, niveaux, priorité plafonnée, filtres, « Meilleurs prospects » | ✅ | — | règles, contradictions, bornes, reproductibilité |
| 5 Intelligence | analyse des opportunités, services recommandés, Message Studio (3 styles, 2 canaux, variantes, modèles personnalisés, IA facultative) | ✅ modèles ; IA si configurée | Ollama / OpenAI-compatible / Anthropic (facultatif) | hypothèse → question, styles, élisions |
| 6 Prospection | file (copier, ouvrir, envoyé, reporter, ignorer), statuts, relances, campagnes | ✅ | — | parcours complet par l'API + navigateur |
| 7 Tableau de bord | indicateurs, activité 14 jours, répartitions des deux scores, meilleurs prospects, activité récente, export CSV | ✅ | — | API + captures d'écran |
| 8 Finalisation | START.bat, start.sh, TESTS.bat, sauvegardes, RGPD (opposition, purge, effacement), documentation | ✅ (start.sh testé sur environnement vierge) | Python 3.10+ sur le PC | 37 tests pytest |

### Vérifié vs non vérifié dans cet environnement de développement

- Vérifié : tests automatisés, construction de l'interface, parcours complet dans Chromium (démo → message → file →
  envoi → recherche sans source), lancement à froid via `start.sh`.
- **Non vérifié ici** (pas de clé ni de poste Windows dans l'environnement de développement) : appels réels à Brave,
  Google CSE, Graph API Meta et geo.api.gouv.fr (codés d'après leurs documentations officielles, erreurs gérées et
  affichées), exécution de `START.bat` sous Windows. Premier test conseillé : bouton « Tester » de chaque connecteur.

## Prochaines étapes suggérées

1. Créer la clé Brave Search, lancer une recherche réelle « Restaurant — Le Havre » et ajuster si besoin les
   seuils de scoring (`backend/app/scoring/`) d'après vos retours terrain.
2. Configurer l'API Meta pour obtenir des données « Vérifiées » (dates de publication, site déclaré).
3. Installer Ollama pour des messages rédigés par une IA locale gratuite.
