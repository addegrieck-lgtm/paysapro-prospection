# Fonctionnalités opérationnelles et limitations

État au moment de la livraison. « Testé » = couvert par les tests automatisés et/ou vérifié dans un navigateur.

## Opérationnel et testé

| Domaine | Fonctionnalité |
|---|---|
| Fondations | API Hono identique sur Cloudflare Workers (D1, KV, Cron) et Node (SQLite) ; migrations idempotentes ; interface React en français, responsive |
| Authentification | installation par jeton, connexion, rôles lecteur / analyste / admin, verrouillage, limitation, CSRF, audit |
| Données | 8 connecteurs + import CSV ; déduplication SIREN / SIRET ; provenance champ par champ ; historique des changements ; fusion des exercices sans mélange discordant |
| Veille | planification par source, lots bornés, curseurs de reprise, 3 tentatives, disjoncteur, rapport par source, statut partiel, alertes de source en erreur ; cron Cloudflare (vérifié dans workerd) et minuterie Node |
| Radars | à vendre (annonces actives), procédures (non clôturées), transmission (signaux avec preuve, indice 0-100), pistes cachées (règle explicite, jamais « à vendre ») |
| Procédures | classification des jugements, statuts ouverte / en cours / plan arrêté / plan de cession / clôturée, conversions, annulations, texte publié du mandataire |
| Analyse financière | 18 indicateurs avec formules, tendances, valorisation 6 méthodes, scénarios 3 × 5 ans, rendement entreprise vs TRI fonds propres |
| Scoring | 3 notes, pondérations configurables, « données insuffisantes », détail explicable par composante |
| Interface | 12 rubriques, fiche entreprise à 6 onglets, carte avec regroupement (milliers de points, rendu canvas), comparateur, recherche multicritère, recherches enregistrées |
| Acquisition Manager | statuts, prix, offre, notes, rappels, contacts, documents privés, simulations enregistrées ; aucun envoi automatique |
| RADAR AI | moteur local (classements, comparaisons, dossier d'acquisition, risques, prix maximal finançable, secteurs, questions au vendeur, avant signature) ; synthèse Claude facultative avec budget |
| Alertes | 12 types, déduplication, seuils configurables, lecture / non lues |
| Administration | sources, veille, secteurs et codes NAF ajoutés, paramètres, utilisateurs, imports, sauvegarde / restauration, RGPD (registre, demandes, effacement + opposition, purge), journal |
| Exports | CSV (Excel FR, `;`, BOM) et .xlsx, protégés contre l'injection de formules |

## Écrit mais non vérifié contre les services réels

Les appels aux API **réelles** (API Recherche d'entreprises, BODACC / Opendatasoft, geo.api.gouv.fr, INSEE Sirene,
INPI RNE, Pappers, Anthropic) n'ont pas pu être exécutés depuis l'environnement de développement : son réseau refusait
ces hôtes. Les connecteurs suivent la documentation publique et sont testés sur des réponses au format documenté ;
l'enchaînement complet a été vérifié jusqu'au point de connexion (erreurs réseau correctement journalisées, veille
déclarée partielle). **Première action recommandée** : lancer une veille et consulter *Administration →
Synchronisations → Tâches* ; un écart de format éventuel y apparaîtra clairement sans bloquer les autres sources.

## Limitations connues

- **Couverture des annonces de cession** : Bpifrance Transmission, Transentreprise, cabinets et sites d'annonces ne
  proposent pas d'API ouverte ; leurs annonces s'importent manuellement (CSV) ou via un flux RSS s'il existe.
- **Données financières publiques limitées** : beaucoup de TPE déposent des comptes confidentiels ; l'API Recherche
  d'entreprises ne fournit que CA et résultat net. EBE, capitaux propres, dettes nécessitent Pappers (payant), les
  liasses du vendeur (import) ou une future intégration des bilans saisis de l'INPI.
- **Pas de géocodage d'adresse dédié** : les coordonnées proviennent de l'annuaire (géocodage BAN) ou de l'INSEE ;
  sinon centre de la commune (affiché en pointillés).
- **Récurrence clientèle et dépendance aux clients** : non documentées publiquement ; la récurrence est une hypothèse
  sectorielle explicitement signalée (comptée pour moitié dans la couverture du score), la dépendance aux clients est
  « inconnue → risque moyen ».
- **Barèmes de valorisation de fonds de commerce** par activité non intégrés (multiples d'EBE paramétrables à la place).
- **Offre gratuite Cloudflare** : temps CPU et écritures D1 limités ; première veille complète du 76 étalée sur
  plusieurs jours ou à réaliser en mode Node (voir DEPLOIEMENT.md).
- **NAF 2025** : la classification utilise la NAF rév. 2 ; une table de passage sera nécessaire lors du basculement
  officiel de la nomenclature.
- **Doublons géographiques de libellés** : une entreprise connue uniquement par le BODACC garde le libellé de commune
  publié jusqu'à la vérification de son identité dans l'annuaire.

## Clés et autorisations nécessaires

| Pour | À obtenir | Obligatoire ? |
|---|---|---|
| Déploiement Cloudflare | jeton d'API Cloudflare (Workers, D1, KV) + Account ID | pour le mode Cloudflare |
| Premier compte | `SETUP_TOKEN` (choisi par vous, 16+ caractères) | oui |
| Découverte étendue | `INSEE_API_KEY` (gratuit) | non |
| Dépôts de comptes INPI | compte data.inpi.fr + accès API validé | non |
| Finances détaillées | `PAPPERS_API_TOKEN` (payant) | non |
| Synthèse IA externe | `ANTHROPIC_API_KEY` | non |
| Réseau | accès sortant aux hôtes listés dans SOURCES.md (si votre hébergement filtre le trafic) | oui pour la veille |
