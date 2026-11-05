# Guide de configuration des sources

Chaque source est un connecteur indépendant (`src/server/connectors/`), activable dans *Administration → Sources*.
Une source en panne n'arrête jamais les autres ; une source qui échoue 3 fois sans aucun succès pendant une veille est
suspendue pour cette veille (« disjoncteur ») et la veille est déclarée **partielle**. Les clés sont des secrets du
serveur : jamais dans le code, jamais en base, jamais renvoyées à l'interface (seule leur présence est affichée).

**Aucune authentification, aucun paywall ni aucune protection technique n'est contourné.** Les plateformes sans API
ni flux ne sont pas aspirées : leurs annonces s'importent manuellement (CSV).

> État de vérification : les connecteurs sont écrits d'après la documentation publique de chaque service et testés
> sur des réponses au format documenté. Leur exécution contre les services réels n'a pas pu être faite depuis
> l'environnement de développement (accès réseau à ces hôtes refusé) : lors de la première veille, consultez
> *Administration → Synchronisations* ; toute différence de format apparaîtra dans le journal des tâches.

## Sources fonctionnant sans clé (fonctionnement minimal gratuit)

### API Recherche d'entreprises — `recherche-entreprises` (activée par défaut)
- **Service** : annuaire officiel de l'État (DINUM), agrège SIRENE (INSEE), RNE (INPI) et comptes publiés.
- **Données** : identité, établissements géolocalisés, tranche d'effectif, dirigeants (nom, qualité), chiffre
  d'affaires et résultat net publiés.
- **Conditions** : Licence Ouverte Etalab 2.0 — https://www.data.gouv.fr/dataservices/api-recherche-dentreprises/
- **Quotas** : 7 requêtes / s ; 25 résultats / page ; 10 000 résultats maximum par recherche.
- **Tâches** : une par code NAF suivi × département (`naf:81.30Z:76`), plus `enrich` (vérification de l'identité des
  entreprises connues par le BODACC ou non vérifiées depuis 30 jours).
- **Minimisation** : la date et l'année de naissance des dirigeants, renvoyées par l'API, ne sont pas conservées.

### BODACC — `bodacc` (activée par défaut)
- **Service** : annonces commerciales de la DILA, jeu de données ouvert sur Opendatasoft.
- **Familles** : `collective` (procédures collectives), `vente` (ventes et cessions de fonds **réalisées**),
  `radiation`.
- **Conditions** : Licence Ouverte Etalab 2.0 — https://www.bodacc.fr/pages/donnees-ouvertes/
- **Quotas** : 100 enregistrements / appel, 10 000 par requête (pagination par date de parution).
- **Historique initial** réglable (*Paramètres → Synchronisation → bodaccBackfillYears*) : 5 ans pour les procédures,
  2 ans pour les ventes, 1 an pour les radiations. Synchronisation incrémentale ensuite (marge de 7 jours).
- Le mandataire / liquidateur n'est affiché que tel qu'il figure dans le texte publié du jugement.

### Référentiel des communes — `geo-communes` (activée par défaut)
- **Service** : API Découpage administratif (geo.api.gouv.fr), Licence Ouverte. 50 requêtes / s.
- Communes, codes postaux, population, centre géographique (positionnement approximatif signalé comme tel).

### Sites internet publics — `website` (activée par défaut)
- Lit la **page d'accueil** des sites connus (saisis, importés), 1 requête / s, `robots.txt` respecté, redirections
  revalidées, adresses non publiques refusées.
- Détecte des expressions **explicites** (« recherche un repreneur », « affaire à céder », « départ à la retraite »…)
  et conserve l'extrait et l'URL comme preuve. L'absence de signal ne signifie rien.

### Flux RSS / Atom — `rss` (à configurer)
- Ajoutez les flux (un par ligne, `Libellé | https://…`) dans *Sources → Flux RSS*. N'ajoutez que des flux publiés pour
  être syndiqués et dont les conditions permettent la réutilisation.
- Une entrée est retenue si elle concerne un département suivi (code postal, nom du département ou d'une commune) et
  contient un vocabulaire de cession.

### Import manuel (CSV) — `import-manuel`
*Administration → Imports* (modèles téléchargeables) :
- **annonces** : annonces consultées sur Bpifrance Transmission, Transentreprise (CCI / CMA), cabinets de cession,
  presse… (aucune de ces plateformes ne propose d'API publique de réutilisation : leurs annonces ne sont pas aspirées) ;
- **comptes** : liasses transmises par un vendeur, comptes consultés ailleurs (statut « déclarative » par défaut) ;
- **entreprises** : liste de SIREN à suivre ;
- **signaux** : signaux publics de transmission avec preuve.

## Sources nécessitant une clé (facultatives)

### INSEE — API Sirene — `insee-sirene`
- **Apport** : découverte sans plafond de 10 000 résultats, coordonnées des établissements (Lambert 93 converties),
  historique d'activité. Les personnes en diffusion partielle sont ignorées.
- **Clé (gratuite)** : 1. compte sur https://portail-api.insee.fr/ ; 2. créer une application ; 3. souscrire à
  l'API Sirene (plan public) ; 4. copier la clé dans le secret `INSEE_API_KEY`.
- **Quotas** : 30 requêtes / minute (espacement automatique de 2,1 s).

### INPI — Registre national des entreprises — `inpi-rne`
- **Apport** : liste des comptes annuels déposés et leur **confidentialité** (explique l'absence de chiffres).
  Le détail chiffré des bilans n'est pas importé par ce connecteur.
- **Accès** : compte sur https://data.inpi.fr puis demande d'accès API (validation par l'INPI) ; secrets
  `INPI_USERNAME`, `INPI_PASSWORD`.
- Interrogé uniquement pour les entreprises suivies (opportunités et projets), au plus une fois tous les 90 jours.

### Pappers — `pappers` (payant)
- **Apport** : agrégats financiers détaillés (EBE, résultat d'exploitation, capitaux propres, dettes, trésorerie).
- **Clé** : https://www.pappers.fr/api → secret `PAPPERS_API_TOKEN`. Le fonctionnement minimal n'en dépend pas.
- **Plafond quotidien** : `sync.maxPappersPerDay` (0 par défaut = désactivé), entreprises suivies uniquement.

### RADAR AI — modèle externe (facultatif)
- Secret `ANTHROPIC_API_KEY`, puis *Paramètres → RADAR AI* : `provider: "anthropic"`, budget mensuel en dollars
  (suivi d'après les tarifs publics du modèle, 4 $ / 20 $ par million de jetons pour `claude-opus-5-5`).
- Le modèle ne reçoit que la question, la réponse locale et les données utilisées ; consigne stricte de ne rien ajouter.
  Sans clé ou au-delà du budget, le moteur local répond.

## Sources citées dans le cahier des charges non intégrées en automatique

| Source | Raison | Alternative |
|---|---|---|
| Bpifrance Transmission | pas d'API publique de réutilisation | import CSV des annonces consultées |
| Chambres de commerce (Transentreprise) et de métiers | idem | import CSV ; flux RSS si une chambre en publie |
| Sites spécialisés de cession | conditions d'utilisation interdisant généralement l'extraction | flux RSS proposés par l'éditeur, import CSV |
| Annonces légales (hors BODACC) | sites de journaux d'annonces légales sans API ouverte | le BODACC reprend les annonces commerciales légales |
| DATA INPI (bilans saisis détaillés) | accès conventionné, mapping des liasses non réalisé | API Recherche d'entreprises (CA, résultat), Pappers, import des comptes |
