# Paysapro Prospection — documentation technique

Application **indépendante** de Paysapro AI, dédiée à la prospection B2B des entreprises de paysagisme françaises.
Coût logiciel : **0 €**. Aucune API payante, aucune base de leads, aucun CRM ni outil d'emailing payant.

---

## 1. Architecture

```
Import officiel SIRENE ─────────┐
Recherche d'entreprises ────────┤
Fichiers CSV / enrichissement ──┼─► Validation ─► Déduplication ─► File d'enrichissement ─► Enrichissement progressif
Saisie manuelle ────────────────┘      (SIRET > SIREN > nom+adresse > nom+tél.)   (API publique gratuite, 4 req/s, cache 30 j)
                                                                                      │
                                                                                      ▼
                                              Base prospects (IndexedDB, provenance champ par champ) ─► Score
                                                                                      │
                                                                                      ▼
            Recherche web assistée ◄── Fiche CRM (données enrichies, notes, relances, historique, statut)
                                                                                      │
                          Segments dynamiques ─► Campagnes (aperçu → validation) ─► Ma messagerie (mailto) / copier
                                                                                      │
                                                                                      ▼
                                                                   Dashboard & statistiques
```

| Couche | Emplacement | Rôle |
|---|---|---|
| Domaine (pur, testé) | `src/domain/` | types, scoring, déduplication, CSV, mapping, filtres, modèles, statistiques, permissions, quotas |
| Données | `src/data/` | base IndexedDB (`db.ts`), « API » locale (`repository.ts`), file d'enrichissement (`enrichmentQueue.ts`), cache, export, démo |
| Fournisseurs | `src/providers/` | `company/` : `CompanyDataProvider` (interface), `RechercheEntreprisesProvider`, `SireneProvider`, `CsvProvider`, `ManualProvider`, `GooglePlacesProvider` (désactivé) ; `http.ts` (limiteur, reprises) ; `ai.ts` (modèles / IA) ; `email.ts` (mailto) |
| Interface | `src/pages/`, `src/components/`, `src/app/` | React 19 + Tailwind 4, design system identique à Paysapro AI |

**Stack** : React 19, TypeScript 5.9, Vite 8, Tailwind 4, react-router 8 (HashRouter), `idb`, vite-plugin-pwa, Vitest + fake-indexeddb.
Même stack que Paysapro AI, mais **aucun code partagé à l'exécution** : les deux applications sont indépendantes.

### Pourquoi pas de serveur ?
Les données sont stockées dans le navigateur (IndexedDB). C'est gratuit, rapide, hors-ligne, et les données de prospection
ne quittent pas votre appareil (RGPD). Contreparties : un seul utilisateur, **sauvegardez régulièrement** (Paramètres → Sauvegarder).
Le passage à un serveur (Supabase, Cloudflare…) ne demande que de réimplémenter `ProspectsApi` (voir § 4).

---

## 2. Base de données

Base IndexedDB `paysapro-prospection`, version 4. Toutes les tables portent `workspace_id` (champ `workspaceId`) et sont indexées dessus.

Tables ajoutées en v3 (coordonnées multi-sources) : `company_phones`, `company_emails`, `company_websites` (index workspaceId,
prospectId, value = numéro +33 / e-mail / domaine ; champs de fraîcheur `foundAt` = premier vu, `lastSeenAt`, `lastCheckedAt`,
`currency` actuelle / ancienne, `feedback` ✓ / ✗, `matchScore` pour un site). Tables ajoutées en v4 (moteur auto-apprenant) :

| Table | Contenu | Index |
|---|---|---|
| `enrichment_strategy_stats` | par stratégie × champ × secteur × région × taille : essais, réussites, trouvées, vérifiées, confirmées, faux positifs, coût, durée, dernière utilisation — **aucune donnée personnelle** | workspaceId |
| `source_performance` | par source × secteur × champ : recherches, trouvées, vérifiées, faux positifs | workspaceId |
| `enrichment_feedback` | retours ✓ / ✗ et corrections de fiche : champ, ancienne / nouvelle valeur, source, stratégie, origine | workspaceId, prospectId |
| `enrichment_attempts` | trace de chaque stratégie exécutée : requête / cible, mode, exploration, résultats, trouvés, vérifiés, requêtes, durée, erreur (jamais le contenu des pages) | workspaceId, prospectId |
| `contact_history` | changements de valeur principale : ancienne → nouvelle, raison, source, date | workspaceId, prospectId |

Les trois dernières sont supprimées avec le prospect (suppression / anonymisation RGPD) ; les statistiques agrégées sont conservées.

| Table | Contenu | Index |
|---|---|---|
| `prospects` | fiches complètes (dont `fieldSources`, `enrichmentStatus`, `enrichedAt`, `enrichmentError`, `isHeadOffice`, `companyCategory`, `openEstablishments`, `employer`, `description`, `anonymized`) | workspaceId, siren, siret, nafCode, postalCode, department, status, enrichmentStatus, score |
| `enrichment_queue` *(v2)* | file d'enrichissement : pending, processing, completed, partial, failed (+ résultat, tentatives, erreur) | workspaceId, status, prospectId |
| `enrichment_logs` *(v2)* | journal : prospect_id, provider, status, started_at, completed_at, fields_updated, fields_confirmed, error | workspaceId, prospectId |
| `duplicate_candidates` *(v2)* | doublons potentiels : fiche A, fiche B, règle, statut (open / merged / ignored / kept_both) | workspaceId, status |
| `company_enrichment_cache` *(v2)* | réponses de l'API par SIREN / SIRET (ENRICHMENT_CACHE_DAYS) | — |
| `prospect_rows` | version compacte de chaque fiche (filtres / tri / recherche en mémoire) | workspaceId |
| `prospect_notes` | notes commerciales (texte, auteur, date) | prospectId, workspaceId |
| `prospect_activities` | historique / timeline | prospectId, workspaceId |
| `prospect_tasks` | relances | prospectId, workspaceId |
| `prospect_segments` | segments dynamiques (nom, description, filtres) | workspaceId |
| `prospect_campaigns` | campagnes + destinataires + exclus | workspaceId |
| `message_templates` | modèles de messages | workspaceId |
| `prospect_imports` | rapports d'import | workspaceId |
| `suppression_list` | liste de suppression RGPD | workspaceId |
| `settings` | paramètres (clé : workspaceId) | — |
| `data_cache` | cache des réponses SIRENE (7 jours) et dates d'import par département | — |

Chaque enregistrement métier a `createdAt`, `updatedAt`, `createdBy`, `workspaceId`.

**Migrations** : dans `src/data/db.ts`, bloc `upgrade()`. Chaque version ajoute un bloc `if (oldVersion < N)` qui **crée** des
tables ou index — jamais de suppression. La version 1 crée le schéma initial. La version 2 ajoute les 4 tables d'enrichissement,
les index, et met à niveau chaque fiche existante (valeurs par défaut, provenance déduite de sa source, index compact recalculé)
sans perte (testé : `tests/enrichment.test.ts › Migration`). Les sauvegardes JSON de la version 1 restent restaurables.

**Provenance** (`fieldSources`) : pour chaque champ renseigné → `{ type: official_api | csv | manual | web | import, provider,
at, confidence: high | medium | low }` (équivalent de `field_source`, `field_updated_at`, `field_confidence`).

---

## 3. Isolation et permissions

- **Workspace** : chaque lecture vérifie `workspaceId` (un prospect d'un autre workspace est « introuvable », même par son id). Testé dans `tests/repository.test.ts`.
- **RBAC** (`src/domain/access.ts`) : rôles `owner`, `admin`, `sales`, `viewer` ; permissions
  `prospecting.view|create|edit|delete|import|export|campaign`. Contrôlées dans l'API (`assertCan`) et dans l'interface (`useCan`).
  Aujourd'hui : un seul utilisateur, propriétaire. Paramètres → Accès permet de prévisualiser un autre rôle.
- **Quotas** : `PLAN_QUOTAS` (FREE 100 prospects, PRO 5 000, BUSINESS 20 000, ENTERPRISE illimité) avec `prospects_limit`,
  `exports_limit`, `ai_generations_limit`, `campaign_limit`. Plan courant : ENTERPRISE (illimité). Rien n'est bloqué.

---

## 4. API

`ProspectsApi` (`src/data/repository.ts`) correspond aux routes REST de la spécification :

| Route | Méthode |
|---|---|
| `GET /api/prospects` | `listProspects({ filter, sort, page, pageSize })` → `{ items, total, page, pageSize }` |
| `GET /api/prospects/:id` | `getProspect(id)` |
| `POST /api/prospects` | `createProspect(input)` |
| `PATCH /api/prospects/:id` | `updateProspect(id, patch)`, `setStatus`, `logContact`, `setDoNotContact` |
| `DELETE /api/prospects/:id` | `deleteProspects(ids, suppress)` |
| `POST /api/prospects/import` | `importLines(lines, options)` |
| `GET /api/prospects/export` | `exportProspectsCsv(api, ids)` (`src/data/export.ts`) |
| `GET /api/prospects/stats` | `computeKpis`, `funnel`, `byGeo`, `evolution` (`src/domain/stats.ts`) sur `allRows()` |
| `POST /api/prospects/:id/note` | `addNote`, `updateNote`, `deleteNote` |
| `POST /api/prospects/:id/task` | `addTask`, `updateTask`, `completeTask`, `postponeTask`, `deleteTask` |
| `POST /api/prospects/:id/generate-message` | `generateMessageFor(id, templateId, useAI)` |
| `GET/POST/PATCH/DELETE /api/segments` | `listSegments`, `saveSegment`, `deleteSegment` |
| `POST /api/prospects/:id/enrich` | `enrichProspect(id, provider, { force })` ; `chooseCompany(id, siret, provider)` (choix parmi plusieurs entreprises) |
| `POST /api/prospects/enrich` (lot) | `EnrichmentQueue.add(ids, force)`, `start()`, `stop()`, `retryFailed()`, `cancel()` ; `enqueueEnrichment`, `queueJobs` |
| `GET /api/prospects/:id/enrichment-logs` | `enrichmentLogs(id)` |
| `GET/POST /api/duplicates` | `listDuplicates`, `scanDuplicates`, `mergeDuplicate(id, keepId)`, `resolveDuplicate(id, 'ignored' \| 'kept_both')` |
| `POST /api/prospects/:id/anonymize` | `anonymizeProspect(id)` |
| `GET /api/companies/search` | `RechercheEntreprisesProvider.search({ q, siren, siret, postalCode, commune, nafCodes, activeOnly })` |
| `POST /api/enrichment/company/:id` | `EnrichmentEngine.enrichCompany(id, { mode: 'fast' \| 'normal' \| 'max', force, onProgress })` |
| `POST /api/enrichment/batch` | `enrichmentBatch(filter, priority, 10 \| 100 \| 500 \| 1000)` puis `EnrichmentQueue.add(ids, force, mode)` |
| `GET /api/enrichment/status/:id` | `queueJobs()`, `QueueProgress` (abonnement `queue.subscribe`) |
| `GET /api/enrichment/history/:id` | `contactHistory(id)`, `attemptLogs(id)`, `enrichmentLogs(id)` |
| `POST /api/enrichment/feedback` | `contactFeedback(kind, contactId, 'correct' \| 'incorrect')` (+ correction de fiche via `updateProspect`) |
| `GET /api/enrichment/statistics` | `strategyStats()`, `sourcePerformance()`, `feedbackList()`, `allContacts()` |
| `GET /api/enrichment/strategies` | `strategyStats()` + catalogue `STRATEGIES` (`src/domain/strategies.ts`) |

**Performance** : les versions compactes (`prospect_rows`) sont chargées une fois en mémoire ; filtrer / trier / rechercher
100 000 lignes prend quelques dizaines de millisecondes, seule la page affichée (50 lignes) est rendue. Recherche avec
temporisation (200 ms), pages chargées à la demande (lazy loading), import par lots de 500 sans bloquer l'interface.
Test : 10 000 prospects importés puis filtrés en moins de 500 ms.

---

## 5. Import officiel SIRENE et recherche d'entreprises (gratuit)

Source : API publique **Recherche d'entreprises** (`recherche-entreprises.api.gouv.fr`, données SIRENE de l'INSEE + RNE) :
sans clé, sans compte, appelable depuis le navigateur. Il n'y a **pas** besoin de l'API SIRENE de l'INSEE (qui demande un
compte) : cette API publique en redistribue les données.

**Import officiel** (Import & enrichissement → *Officiel*, `src/providers/company/SireneProvider.ts`) :
- Filtres : codes NAF (défaut **81.30Z**, Paramètres), département, région (ajoute ses départements), codes postaux (au lieu des
  départements), commune, **actives uniquement**, **sièges uniquement**, tranche d'effectif minimale, date de création (après / avant),
  exclusion des entrepreneurs individuels.
- Limites respectées : 25 résultats par page, 10 000 par requête (d'où le découpage par département ou code postal),
  ~7 requêtes/s autorisées → **4 par seconde** (limiteur partagé), reprises automatiques sur 429 / 5xx / délai dépassé.
- **Cache** : chaque page est gardée 7 jours ; un import interrompu reprend sans re-télécharger.
- Établissements à **diffusion publique** uniquement (diffusion partielle respectée). Les dirigeants ne sont **jamais** conservés.
- Les fiches importées sont déjà « enrichies » administrativement (statut *Enrichi* ou *Partiellement enrichi*).
- Réimport : même SIRET → mise à jour de l'identité fournie par la source officielle ; **vos saisies manuelles ne sont jamais écrasées**.
- Volume : toute la France représente plusieurs dizaines de milliers d'établissements (≈ 10 à 20 min).

**Recherche d'entreprises** (onglet *Rechercher*) : par nom, SIREN, SIRET, code postal, commune, NAF, actives uniquement ;
cochez les établissements puis *Ajouter au CRM* (déduplication automatique).

---

## 6. Enrichissement automatique (gratuit)

### Comment ça marche
1. **Identification** (`RechercheEntreprisesProvider.enrich`) : par **SIRET** (établissement exact, confiance haute), sinon
   **SIREN** (siège), sinon **nom + code postal / commune** — accepté seulement si une seule entreprise correspond clairement
   (confiance moyenne, signalé « à vérifier ») ; s'il y en a plusieurs, l'utilisateur choisit dans la liste proposée.
2. **Récupération** : raison sociale, nom commercial, SIREN, SIRET, NAF, activité, forme juridique, statut actif / fermé,
   siège, date de création, tranche d'effectif, catégorie d'entreprise, nombre d'établissements, caractère employeur,
   adresse, code postal, commune, département, région.
3. **Comparaison et fusion** (`applyEnrichment`, `mergeProspect`) :
   - champ vide → complété ;
   - champ fourni précédemment par la même source officielle → mis à jour si la valeur a changé ;
   - champ identique → **confirmé** (date de vérification rafraîchie) ;
   - champ saisi **manuellement**, importé par CSV ou trouvé sur le web → **conservé** (jamais remplacé automatiquement) ;
   - correspondance par nom → on complète seulement les champs vides.
4. **Provenance** : chaque champ écrit reçoit sa source, sa date et sa confiance (affichées sous chaque valeur de la fiche).
5. **Statut** : *Non enrichi*, *En cours*, *Enrichi* (données administratives complètes), *Partiellement enrichi*, *Échec*
   (introuvable, ambigu, source indisponible), avec la date du dernier enrichissement.
6. **Historique** : entrée « Enrichissement automatique » dans la timeline (« ✓ SIREN confirmé », « ✓ Adresse mise à jour »…)
   et une ligne dans `enrichment_logs`.
7. **Doublons** : si le SIREN / SIRET obtenu existe déjà sur une autre fiche, un doublon potentiel est proposé.

### Où
- Fiche prospect : **Enrichir automatiquement** / **Réenrichir** (+ « Forcer le réenrichissement » qui ignore le cache).
- Liste des prospects : icône ✨ sur chaque ligne, **Enrichir la sélection**.
- Import & enrichissement : **Enrichir les non traités**, **Relancer les échecs**.

### File d'attente (`src/data/enrichmentQueue.ts`)
Import → validation → déduplication → **file** → enrichissement progressif → base → statistiques. La file est enregistrée
(elle reprend si l'onglet est fermé), traite un prospect à la fois via le limiteur (4 req/s), par lots de 50, sans bloquer
l'interface ; statuts `pending`, `processing`, `completed`, `partial`, `failed` ; progression affichée (enrichis, partiels,
sans nouvelle donnée, échecs) ; pause, reprise, annulation, relance des échecs. Erreur temporaire : 3 essais par prospect
(en plus des reprises HTTP), puis échec. Introuvable : échec définitif (complétez le SIREN).

### Limites, erreurs, cache
- 429 → attente (en-tête Retry-After ou 1 s, 2 s, 4 s…) → nouvel essai ; 500 / délai dépassé (15 s) → nouvel essai ;
  404 → introuvable ; nombre d'essais borné (jamais de boucle infinie).
- Messages utilisateur clairs (« Impossible de récupérer les données actuellement. Le prospect reste enregistré… ») ;
  le détail technique est journalisé dans la console et dans `enrichment_logs`.
- Cache `company_enrichment_cache` : une entreprise interrogée depuis moins de `ENRICHMENT_CACHE_DAYS` (30 j) n'est pas
  réinterrogée ; un prospect enrichi récemment est ignoré sauf « Forcer ».

### Enrichissement commercial (étape 2 — sans service payant)
Téléphone, e-mail, site, fiche Google, avis, note, Facebook, Instagram, LinkedIn, description, services, zone d'intervention :
**jamais présents dans les sources officielles**. Ils proviennent :
- d'un **CSV** (onglet *Compléter* : fichier d'enrichissement retrouvé par SIRET, SIREN, nom + adresse, nom + téléphone) ;
- d'une **saisie manuelle** (« Compléter manuellement ») après **Rechercher sur le web** : recherches préparées « nom + ville »,
  « nom + téléphone », « nom + SIRET », Google Maps, PagesJaunes, réseaux sociaux, Annuaire des entreprises — ouvertes par
  l'utilisateur, **aucun scraping**.
La fiche affiche clairement ce que l'application connaît (✓) et ce qui manque (⚠ … non trouvé). Rien n'est jamais inventé :
donnée absente → « Non disponible ». Depuis la V2, une partie de ces coordonnées est aussi recherchée **automatiquement**
dans des sources publiques gratuites : voir § 6 bis.

---

## 6 bis. Moteur V2 — recherche, coordonnées et téléphones professionnels

> Recherche automatique des coordonnées professionnelles **disponibles** : tous les numéros ne sont pas publics, aucun
> taux de 100 % n'est promis. Coût obligatoire : **0 €**.

### Parcours
**Dashboard → 🔎 Trouver des prospects** (`src/components/FindProspects.tsx`, `src/data/searchEngine.ts`) : activité
(paysagiste NAF 81.30Z, autre NAF, recherche libre), zone (France, région, département, code postal, ville), entreprises
actives, établissements pertinents, filtres avancés (effectif 0 / 1–5 / 6–9 / 10–19 / 20–49 / 50+, siège / secondaire,
date de création). Une recherche sur plusieurs départements demande **toujours une confirmation** (jamais de lancement massif
par erreur). Résultats normalisés → dédoublonnés (SIRET > SIREN > nom + adresse > nom + ville + téléphone) → file
d'enrichissement.

### EnrichmentEngine (`src/data/enrichmentEngine.ts`) — `enrichCompany(id, { force, maxPhones })`
1. **Administratif** : API Recherche d'entreprises (voir § 6), cache 30 jours.
2. **Annuaire public — OpenStreetMap** (`OpenStreetMapProvider`) : instantané livré avec l'application
   (`public/data/osm-paysagistes.json`, ≈ 900 entreprises du paysage dont ≈ 500 avec téléphone), rapprochement **local**
   (aucune requête par entreprise) : SIRET / SIREN = sûr ; sinon nom très proche (≥ 0,75) + même code postal / commune ou
   < 3 km ; jamais si ambigu ou si le SIREN diffère. Serveur Overpass en secours seulement (souvent saturé : 30 s max, puis
   source en pause 15 min pour ne jamais bloquer la file). Mise à jour : `npm run osm:update` (garde-fou : une réponse vide
   n'écrase jamais l'instantané). Données © les contributeurs OpenStreetMap, licence ODbL (attribution affichée sur la fiche).
3. **Site officiel** (`WebsiteProvider`, via le relais gratuit, voir plus bas) : accueil + jusqu'à 3 pages contact /
   mentions légales. Si aucun site n'est connu, quelques domaines plausibles (`jardins-du-val.fr`…) sont testés ; un site
   n'est retenu que si son contenu mentionne le **SIREN / SIRET**, ou le **nom + la commune / le code postal**.
4. **Garde-fous contre les faux positifs** (mesurés en test réel, voir plus bas) :
   - **page listant plusieurs agences** (> 3 numéros ou e-mails, ex. un groupe national) : seuls les numéros / e-mails les
     plus proches d'une mention de la commune ou du code postal de l'établissement sont retenus ;
   - **coordonnées de tiers** dans les mentions légales (hébergeur, webmaster, « réalisé par », agence web…) : écartées —
     c'est le dernier intitulé du bloc qui décide (« Hébergeur : … Tél » → tiers ; « Éditeur : … Tél » → entreprise) ;
   - **e-mail sans lien avec l'entreprise** (adresse d'un thème WordPress, d'un fournisseur…) : retenu seulement s'il
     utilise le domaine du site, une messagerie grand public (gmail, orange…) ou un domaine contenant le nom ;
   - e-mail nominatif retenu seulement s'il est publié en lien `mailto:` sur le site vérifié ; aucun e-mail n'est jamais
     construit ou deviné ;
   - numéro présent sur plusieurs fiches : « ⚠ Numéro partagé » (−30).
5. **Normalisation** (`src/domain/phone.ts`) : format interne `+33…`, affichage `06 12 34 56 78`, type fixe / mobile / fax,
   numéros spéciaux exclus.
6. **Vérification / confiance** (`src/domain/contacts.ts`) : base par source (manuel 100, officiel 70, site 55, import 50,
   annuaire 45, réseau social 35) + concordances (SIRET/SIREN +25, site vérifié +15, adresse +10, nom +10, ville +10,
   code postal +5, lien d'appel +5) + 10 par source concordante supplémentaire (max +20) − 30 si partagé.
   Statut : 🟢 **Vérifié** ≥ 80, 🟠 **À vérifier** ≥ 50, ⚪ **Non vérifié** en dessous. Chaque numéro affiche ses raisons
   (« Confiance 96 % · Sources concordantes : 2 »).
7. **Fusion** (`mergeContacts`) : tables `company_phones`, `company_emails`, `company_websites` (plusieurs valeurs par
   entreprise, rôle Principal / Mobile / Secondaire / Fax, source, URL, date). **Une saisie manuelle n'est jamais remplacée** ;
   un numéro non vérifié (< 50) ne devient jamais le numéro principal de la fiche.
8. **Qualification automatique** (option, désactivée par défaut) : entreprise active + téléphone vérifié → « À contacter ».

### File d'enrichissement
Un seul traitement à la fois, même avec plusieurs onglets (verrou navigateur `navigator.locks`) ; chaque tâche est relue
avant traitement (jamais traitée deux fois) ; erreurs temporaires → `next_retry_at` (1 min, 2 min, 4 min), 3 essais ;
compteurs en direct (téléphones trouvés / vérifiés, e-mails, sites, taux). Boutons : **⚡ Enrichir la sélection**,
**⚡ Enrichir tous les prospects**, **📞 Maximiser les téléphones**, **🚀 Enrichir** (fiche).

### Relais web gratuit (`worker/`)
Un navigateur ne peut pas lire un autre site (CORS). Le relais (Cloudflare Worker, offre gratuite) lit **uniquement** des
pages HTML publiques d'entreprises : robots.txt respecté, moteurs de recherche / annuaires / réseaux sociaux / adresses
privées refusés, origines autorisées limitées (`ALLOWED_ORIGINS`), aucun contournement (ni CAPTCHA, ni proxy, ni anti-bot).
Sans relais (`VITE_WEB_PROXY_URL` vide), l'étape « site officiel » est simplement désactivée. Déploiement : `worker/README.md`.
Test en local : `node worker/dev-server.mjs` puis `VITE_WEB_PROXY_URL=http://localhost:8787` dans `.env.local`.

### Écran « Performance » (`/performance`)
Taux de téléphones trouvés et vérifiés, sources les plus efficaces, temps moyen, erreurs.

### Test réel (29/09/2026, 72 entreprises NAF 81.30Z, relais local — chiffres après correction des faux positifs)
| Échantillon | Entreprises | Avec téléphone | Téléphones (dont 🟢) | E-mails | Sites |
|---|---|---|---|---|---|
| La Rochelle 17000 | 18 | 7 (39 %) | 9 (8) | 5 | 6 |
| Rouen 76000 | 14 | 1 (7 %) | 1 (1) | 1 | 1 |
| Bordeaux 33000 | 40 | 6 (15 %) | 8 (8) | 5 | 6 |

Temps moyen 4,8 s par entreprise (médiane 4,0 s, max 20 s), 0 erreur. Chaque numéro a été contrôlé à la main : 3 types de
faux positifs trouvés au premier passage (page de 37 agences d'un groupe national, numéros de l'hébergeur et du webmaster
dans les mentions légales, e-mail d'un thème WordPress) — tous corrigés par les garde-fous du point 4 et couverts par des
tests. Les micro-entreprises sans site ni fiche OpenStreetMap restent sans téléphone : c'est la limite des sources gratuites.

---

## 6 ter. Moteur auto-apprenant (EnrichmentOrchestrator)

> Recherche automatique des coordonnées professionnelles disponibles. L'IA ne fait que chercher, extraire, comparer,
> vérifier, noter et CHOISIR ses recherches : elle n'invente jamais un numéro, un e-mail, un site ni une source.
> Aucune IA payante : l'apprentissage repose sur des statistiques, des pondérations et vos retours.

### Architecture (modules)
| Module | Fichier |
|---|---|
| EnrichmentOrchestrator | `src/data/enrichmentEngine.ts` — boucle adaptative, budgets, arrêt, progression, apprentissage |
| CompanyIdentityEngine + score de site | `src/domain/identity.ts` |
| Catalogue des stratégies | `src/domain/strategies.ts` |
| StrategyLearningEngine (estimations, choix, exploration, mises à jour) | `src/domain/learning.ts` |
| WebsiteDiscoveryEngine, WebsiteCrawler, ContactPageDetector | `src/providers/company/WebsiteProvider.ts` |
| PhoneDiscovery / EmailDiscovery (extraction, contexte, tiers, agences) | `src/domain/phone.ts`, `src/domain/webContacts.ts` |
| ContactVerification / ConfidenceScoring / FalsePositiveDetector | `src/domain/contacts.ts`, `src/domain/identity.ts`, `src/domain/webContacts.ts` |
| WebSearchEngine, WebResultAnalyzer, repli A → B → C | `src/providers/search/WebSearchProvider.ts` |
| SourcePerformance, Feedback, Logger, historique | `src/data/repository.ts` (tables v4) |
| CacheEngine, RateLimitEngine, retry | `src/data/cache.ts`, `src/providers/http.ts`, file `src/data/enrichmentQueue.ts` |

### Algorithme (pour chaque entreprise)
1. **Identification** (SIRENE) → identité de référence : SIREN, SIRET, raison sociale, nom commercial, adresse, commune, NAF.
2. **Champs manquants** : téléphone et e-mail sont « trouvés » à partir de 90 % de confiance (ou saisie manuelle), le site à
   partir d'une correspondance « probable » (70). Ce qui est déjà sûr n'est jamais recherché (site ✓ téléphone ✓ e-mail ✗ →
   on cherche l'e-mail). En mode **Maximum contact**, téléphones et e-mails restent recherchés (plusieurs numéros pertinents).
3. **Choix de la stratégie** parmi celles possibles (prérequis, mode, pas déjà faite) :
   `valeur attendue = Σ P(trouver) × précision × valeur du champ − coût`, estimées sur l'historique du segment le plus précis
   qui a au moins 10 essais (secteur × région × taille → secteur × région → secteur → global → estimation a priori).
   **80 %** : la meilleure valeur attendue ; **20 %** (réglable, Paramètres) : exploration de la stratégie la moins essayée.
4. **Exécution** avec provenance complète (page, stratégie, concordances). Une source en panne n'arrête rien (statut « partiel »).
5. **Arrêt** : tout est trouvé (≥ 90 %), ou budget du mode atteint, ou plus aucune piste. Entreprise difficile (rien trouvé
   au bout du budget) : rallonge de 50 %, une fois (sauf Rapide).
6. **Vérification** : recoupement des sources (+10 par source concordante), numéros partagés (−30), données disparues de leur
   page lors d'un réenrichissement → « ancienne » (−20, conservée), faux positifs (tiers, autres agences, homonymes).
7. **Enregistrement** : jamais d'écrasement d'une saisie manuelle (manuel > vérifié > découvert), historique des valeurs remplacées.
8. **Apprentissage** : statistiques par stratégie et par source, trace de chaque stratégie.

### Stratégies
Annuaire OpenStreetMap · site connu (accueil, contact, mentions légales) · exploration approfondie (plan du site, devis,
à propos, services — modes Normal et Maximum) · domaines plausibles : raison sociale, nom commercial, nom + commune,
nom + activité (« martin-paysage.fr » — Maximum) · 10 requêtes web (« "Nom" "Ville" », « … téléphone », « … email »,
« … contact », « … paysagiste », « "Nom" "Adresse" », « … "mentions légales" », « … devis », « … "06" », « … "0X" ») qui
ne s'activent que si un fournisseur de recherche **autorisé** est branché (aucun par défaut : pas de récupération de Google).

### Budgets par mode
| Mode | Stratégies max | Requêtes max | Durée max |
|---|---|---|---|
| Rapide | 3 | 10 | 25 s |
| Normal | 6 | 24 | 60 s |
| Maximum contact | 14 | 60 | 150 s |

### Score de correspondance d'un site (0–100, réglable : `WEBSITE_POINTS`, `CONFIDENCE_BANDS`)
SIREN / SIRET 70 · nom 30 · commune 20 · code postal 15 · rue 15 · numéro déjà connu 25 · activité 10 · domaine formé sur
le nom 10 · mentions légales 5. 95–100 très forte · 85–94 forte · 70–84 probable · 50–69 incertaine · < 50 faible. Un nom
seul (même avec activité et domaine) plafonne à « incertaine » : un homonyme d'une autre ville n'est jamais retenu.

### Comment le moteur apprend (sans « faux machine learning »)
- **Trouvé ≠ correct** : `précision = (vérifiées − faux positifs parmi elles + confirmées sous 80 %) / trouvées`.
- **Vos retours** : ✓ Correct (confirmée, 100 %), ✗ Incorrect (écartée), ☆ principale. Chaque retour est rattaché à la
  stratégie et à la source qui avaient trouvé la donnée, dans le segment de l'entreprise ; un changement d'avis annule
  l'ancien retour (jamais de double comptage).
- **Signaux CRM (règle explicite)** : une valeur principale trouvée automatiquement puis remplacée ou effacée à la main
  compte comme incorrecte — sauf un téléphone remplacé par un numéro d'un autre type (fixe ↔ mobile), considéré comme un
  numéro supplémentaire. Aucun autre événement n'est interprété.
- Les statistiques changent **réellement** l'ordre des recherches, les stratégies lancées, l'arrêt et le budget (testé :
  `tests/learning.test.ts › l'apprentissage change réellement l'ordre des recherches`).
- Données d'apprentissage : compteurs agrégés uniquement (stratégie, source, champ, secteur, région, taille, résultats).

### Écrans
- **Fiche** : 🚀 ENRICHIR (Rapide / Normal / Maximum contact), Réenrichir, progression en temps réel (Identification ✓,
  Recherche du site ✓…), résumé Téléphone / E-mail / Site avec statut et confiance, sources, dernière vérification,
  ✓ / ✗ / ☆ sur chaque coordonnée, « d'où vient cette donnée ? », historique des coordonnées, notification de fin.
- **Prospects** : ⚡ Enrichir un lot (10 / 100 / 500 / 1000 ; priorité : sans téléphone, sans e-mail, sans site,
  prioritaires, nouveaux ; mode), ⚡ Enrichir tous, 📞 Maximum contact.
- **Performance** : couverture et précision (Verified Contact Rate, téléphone / e-mail / site vérifiés, précision mesurée et
  estimée, faux positifs, recherches par entreprise, erreurs de source), 🧠 Performance de l'IA (meilleures et faibles
  stratégies, tableau des stratégies et des sources), 📈 Apprentissage (évolution hebdomadaire, corrections, stratégies
  nouvelles / délaissées, avant / après), 🔧 vue technique (administrateur).

### Test réel du moteur auto-apprenant (29/09/2026, mêmes 72 entreprises qu'en V2, mode Maximum contact, relais local)
| Échantillon | Entreprises | Avec téléphone | Téléphones (dont 🟢) | E-mails | Sites confirmés |
|---|---|---|---|---|---|
| La Rochelle 17000 | 18 | 7 (39 %) | 9 (6) | 6 | 7 |
| Rouen 76000 | 14 | 1 (7 %) | 1 (1) | 1 | 1 |
| Bordeaux 33000 | 40 | 6 (15 %) | 8 (8) | 5 | 6 |

9,9 s par entreprise en moyenne (max 26 s), 3,9 stratégies par entreprise, 0 erreur, 0 plantage. Chaque numéro vérifié à la
main. Par rapport à la V2 : bon site trouvé pour Creat'Nature (creatnature.fr, qui confirme les 2 numéros OpenStreetMap),
+1 e-mail, +1 site ; moins de numéros « 🟢 » à La Rochelle car la pénalité « numéro partagé » s'applique désormais réellement
(correction d'un plafond mal placé). Un nouveau faux positif détecté (numéro de l'hébergeur sur 3 lignes dans des mentions
légales) a été corrigé et testé ; le ✗ de l'utilisateur l'a bien compté contre l'exploration approfondie dans le segment
paysage / Nouvelle-Aquitaine. Les stratégies « domaine nom + commune » et « nom + activité » n'ont rien trouvé sur ces
72 entreprises : le moteur les délaisse (encore testées par l'exploration).

### Brancher plus tard un service (sans réécrire le moteur)
Recherche web : implémenter `WebSearchProvider` (clé éventuelle côté relais, jamais dans l'application) et le passer à
`EnrichmentEngine` (`search`). Vérification d'e-mail / de téléphone, jeux de données publics supplémentaires, LLM (classement
de pages, désambiguïsation) : même principe — un fournisseur facultatif ; s'il est indisponible, le moteur classique continue.

---

## 7. Import CSV

Import & enrichissement → onglet **CSV**, en 4 étapes : fichier → analyse (lignes, colonnes reconnues, lignes invalides, doublons
potentiels) → correspondances « Colonne fichier → Champ application » (corrigeables) → import avec progression et rapport final
(ajoutés, mis à jour, doublons, invalides, exclus, doublons potentiels à vérifier).

- UTF-8 avec ou sans BOM, séparateur `,` `;` ou tabulation détecté automatiquement, guillemets et retours à la ligne gérés.
- Colonnes reconnues automatiquement (synonymes français/anglais) : nom, nom commercial, SIREN, SIRET, adresse, CP, ville,
  département, téléphone, e-mail, site, Google URL / note / avis, effectif (nombre ou tranche INSEE), NAF, activité,
  prestations, date de création, prénom / nom du contact, Facebook, Instagram, LinkedIn, TikTok, URL source.
- Une valeur illisible (e-mail mal formé, téléphone incomplet…) est **ignorée et signalée**, jamais corrigée au hasard.
- Chaque champ importé a pour source « Import CSV (nom du fichier) ».

Exemple de fichier d'enrichissement (onglet *Compléter*) :

```csv
siren;email;site;google_url;google_rating;google_reviews;telephone;instagram;facebook;linkedin
123456789;contact@exemple.fr;www.exemple.fr;https://maps.google.com/?cid=…;4,7;87;0235000000;;;
```

### Déduplication (`src/domain/dedupe.ts`, page *Doublons*)
Priorité **SIRET > SIREN > nom + adresse > nom + téléphone** (noms normalisés : accents, casse, formes juridiques) :
correspondance sûre → la fiche existante est mise à jour / complétée (jamais deux fois la même entreprise).
- Même nom + même ville sans contradiction (adresse, téléphone) → même entreprise ; avec contradiction → doublon potentiel.
- Même téléphone seul → **doublon potentiel** (`duplicate_candidates`), jamais fusionné d'office.
- Page **Doublons** : **Fusionner** (en choisissant la fiche conservée : les informations des deux fiches, notes, relances et
  historique sont regroupées), **Ignorer**, **Conserver les deux** ; « Analyser toute la base » recherche les doublons existants.
- Deux établissements d'une même entreprise (SIRET différents) ou deux SIREN différents ne sont jamais fusionnés.

---

## 7 bis. Scoring (`src/domain/scoring.ts`)

Score sur 100, recalculé à chaque modification, **configurable dans le code** (`SCORING_CONFIG`), critères objectifs uniquement :

| Critère | Points |
|---|---|
| Entreprise active (source officielle) | +15 |
| Téléphone disponible | +10 |
| E-mail disponible | +15 |
| Site web disponible | +10 |
| Présence Google renseignée | +5 |
| Plus de 20 avis / plus de 50 avis | +5 / +10 (un seul palier) |
| Note ≥ 4,5 (au moins 5 avis) | +5 |
| Effectif connu / effectif ≥ 3 | +5 / +5 |
| Entreprise récente (≤ 3 ans) | +5 |
| Zone géographique ciblée (Paramètres → départements ciblés) | +5 |
| Services correspondants (création / aménagement ou ≥ 2 prestations) | +5 |
| Informations administratives complètes | +5 |

La fiche affiche « Pourquoi ce score ? » : les points gagnés (+) et ce qui manque (−, ex. « Réseaux sociaux inconnus »).
Pas de double comptage ; le code NAF ne donne aucun point. Modifier les départements ciblés recalcule les scores.
Priorités (catégories internes) : 🔥 80–100 · 🟠 60–79 · 🟡 40–59 · ⚪ 0–39. Filtres rapides : Score 80+, 60+, 40+, Tous.

---

## 8. CRM

- **Statuts** : Nouveau, À qualifier, À contacter, Contacté, Réponse reçue, Intéressé, Démo programmée, Démo réalisée, Essai,
  Client, Pas maintenant, Pas intéressé, Ne plus contacter.
- **Étapes du tunnel** (contacté, réponse, démo, essai, client) datées la première fois qu'elles sont atteintes → tunnel et
  évolution exacts même si le statut change ensuite.
- **Historique** : import, score, modifications, statuts, notes, contacts, relances.
- **Notes** : ajouter, modifier, supprimer (auteur, date, heure).
- **Relances** : aujourd'hui / demain / cette semaine / plus tard / en retard ; terminer, reporter, modifier, supprimer.
  La « prochaine relance » d'une fiche = sa plus proche relance ouverte.
- **Notifications internes** (cloche) : relances dues, prioritaires jamais contactés, réponses à traiter.
- **Pourquoi contacter cette entreprise ?** : 2–3 faits tirés de la fiche. **Angle de prospection** (gain de temps, devis,
  suivi client, organisation, relances, gestion commerciale, professionnalisation) avec « Pourquoi cet angle ? ».

## 9. Segments et campagnes

- **Segments** dynamiques sauvegardés (nom, description, filtres, nombre de prospects recalculé, date de création) ;
  suggestions prêtes à l'emploi (prioritaires, sans site, > 50 avis, Normandie, 76, à relancer…) ; « Enregistrer comme
  segment » depuis les filtres de la liste.
- **Campagnes** : segment → aperçu (destinataires, exclus, « Ne plus contacter », sans e-mail, données manquantes) →
  messages générés → **validation manuelle** → chaque message s'ouvre dans votre messagerie ; vous l'envoyez vous-même puis
  le marquez « envoyé ». **Aucun envoi automatique en masse.**
- **Limite de sécurité** : 50 contacts/jour par défaut (Paramètres), avertissement avant campagne, blocage au-delà.
- **Mode test** (activé par défaut) : tous les messages s'ouvrent adressés à votre adresse ; les prospects ne sont pas modifiés.

## 10. Messages, modèles et IA (optionnelle)

- **Sans IA (défaut, gratuit)** : `TemplateMessageProvider` remplit les modèles. Variables : `{{prenom}}`, `{{entreprise}}`,
  `{{ville}}`, `{{nombre_avis}}`, `{{note_google}}`, `{{site}}`, `{{activite}}`, `{{nom_saas}}`, `{{signature}}`.
  **Une ligne dont une variable est inconnue est retirée** ; `{{var|repli}}` fournit une valeur de repli.
- Modèles fournis et modifiables : Premier contact, Relance 1/2/3, Invitation démo, Après démo, Essai gratuit, Réactivation,
  Message court (SMS / réseaux). Vouvoiement ou tutoiement (Paramètres).
- **Copier-coller** : copier l'objet, le message, l'e-mail, le téléphone. **Ouvrir dans mon e-mail** : `mailto:` pré-rempli.
- **IA** : `ExternalAIProvider` n'est actif que si `VITE_AI_ENDPOINT` est défini. Il n'envoie que les **faits connus** de la
  fiche (`buildFacts`) et le prompt de conformité `AI_SYSTEM_PROMPT` (aucune invention, pas de promesse financière,
  120 mots max, tutoiement configurable). En cas d'échec, repli automatique sur le modèle. Sans configuration, l'interface
  affiche « IA non configurée » et tout fonctionne.

Exemple de proxy gratuit (Cloudflare Worker ; la clé reste côté serveur, dans les secrets du Worker) :

```js
// worker.js — déployé avec `wrangler deploy`, secret : wrangler secret put ANTHROPIC_API_KEY
export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': 'https://VOTRE-DOMAINE', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const { system, facts, context } = await req.json();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: JSON.stringify({ faits: facts, contexte: context }) }],
      }),
    });
    const data = await r.json();
    const text = data.content?.[0]?.text ?? '{}';
    return new Response(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1), { headers: { ...cors, 'content-type': 'application/json' } });
  },
};
```
Le fournisseur d'IA est facturé à l'usage : c'est la seule brique payante possible, et elle est facultative.

## 11. Google Business — version gratuite

Aucun scraping de Google Maps, aucune API Google payante. Chaque fiche propose **Rechercher sur le web** (nom + ville,
nom + téléphone, nom + SIRET, Google Maps, PagesJaunes, réseaux sociaux, Annuaire des entreprises — URL construites
dynamiquement, ouvertes par vous) ; vous reportez ensuite dans la fiche (Compléter manuellement) l'URL, la note, le nombre
d'avis, la catégorie, et cochez « Vérifié sur Google aujourd'hui » : ces champs prennent la source « Manuel ».
`GooglePlacesProvider` existe mais est **désactivé** (payant, nécessiterait un proxy). Paramètres affiche « Connexion Google : Non connecté ».

## 12. Conformité (RGPD, France)

- Chaque prospect a `source`, `sourceUrl`, `dateCollected`, `lastVerifiedAt` (affichés dans la fiche et exportés).
- Données minimales : identité de l'entreprise et coordonnées professionnelles ; pas de dirigeants, pas de données sensibles.
- **Ne plus contacter** : exclusion des campagnes, messages, relances et contacts ; statut affiché ; information conservée ;
  coordonnées ajoutées à la **liste de suppression**.
- **Droit d'opposition / suppression** : suppression définitive d'une fiche avec ajout facultatif à la liste de suppression →
  jamais réimportée. Liste gérable dans Paramètres (e-mail, téléphone, SIREN, SIRET).
- **Données de démonstration** : 100 entreprises fictives marquées `[DÉMO]` / « DONNÉE DE DÉMONSTRATION », sans SIREN,
  e-mails en `example.com`, téléphones des plages réservées à la fiction (ARCEP) — jamais contactables.
- Une donnée n'est jamais présentée comme vérifiée si elle ne l'est pas (« Non disponible » sinon) ; la provenance et la
  confiance de chaque champ sont visibles.
- **Données d'entreprise vs données personnelles** : SIREN, NAF, adresse d'une société sont des données d'entreprise ; le nom,
  l'adresse et les identifiants d'un **entrepreneur individuel**, ainsi que le prénom / nom / e-mail / téléphone / réseaux d'un
  contact, sont des **données personnelles** (signalé sur la fiche). Qu'une donnée soit publique ne la rend pas librement
  réutilisable : informez la personne de l'origine des données au premier contact et respectez son opposition.
- **Anonymisation** (fiche → Anonymiser) : efface les données personnelles, notes et relances (et pour un entrepreneur
  individuel : nom, adresse, SIREN / SIRET), conserve les données statistiques non personnelles, exclut définitivement le
  prospect et ajoute ses coordonnées à la liste de suppression.
- Rappel : la prospection B2B par e-mail est possible sans consentement préalable si le message concerne l'activité
  professionnelle du destinataire, qu'il est informé et peut s'opposer simplement (lien ou réponse). Pour les entrepreneurs
  individuels, vous traitez des données de personnes physiques : information et droit d'opposition s'appliquent.

## 13. Configuration

Paramètres → Prospection : nom du SaaS, signature, vouvoiement / tutoiement, mode test + adresse, contacts max / jour,
panier moyen, fuseau horaire, codes NAF ciblés, départements ciblés, score minimum, exclusion des entrepreneurs individuels,
fournisseurs (données, e-mail, IA, Google), rôle, liste de suppression, sauvegarde / restauration, recalcul des scores.

## 14. Variables d'environnement

Toutes facultatives (`.env.example`). Toute variable `VITE_*` est visible dans le navigateur : **aucun secret**.

| Variable | Rôle | Défaut |
|---|---|---|
| `VITE_SAAS_NAME` | nom du SaaS dans les messages | `Paysapro AI` |
| `VITE_AI_ENDPOINT` | URL de votre proxy IA | vide = IA non configurée |
| `VITE_RECHERCHE_ENTREPRISES_API_URL` (ou `VITE_SIRENE_API_URL`) | URL de l'API publique | `https://recherche-entreprises.api.gouv.fr` |
| `VITE_ENRICHMENT_CACHE_DAYS` | durée du cache d'enrichissement (jours) | `30` |
| `VITE_ENRICHMENT_BATCH_SIZE` | prospects lus par lot dans la file | `50` |
| `VITE_ENRICHMENT_RATE_LIMIT` | requêtes par seconde vers l'API | `4` |
| `VITE_WEB_PROXY_URL` | URL de votre relais web gratuit (lecture des sites d'entreprises, § 6 bis) | vide = étape « site officiel » désactivée |

Il n'y a ni `DATABASE_URL` (base locale) ni `AI_API_KEY` (la clé vit dans le proxy, jamais dans ce code).

## 15. Tests

`npm test` — 121 tests (Vitest). Moteur auto-apprenant (`tests/learning.test.ts`) : score de site (bonne entreprise ≠ homonyme,
nom seul insuffisant), domaines et requêtes par stratégie, précision « trouvé ≠ correct », stratégie forte privilégiée /
faible explorée, segments, retours et changement d'avis, découverte du site puis téléphone + e-mail (hébergeur écarté),
enrichissement partiel (seul le champ manquant), modes Maximum / Rapide, homonyme refusé, relais en panne (partiel, sans
plantage), apprentissage qui change l'ordre des recherches, recherche web avec repli A → B, doublons par site / e-mail,
parcours complet entreprise → CRM → ✗ / ✓ → statistiques → correction → historique → RGPD, donnée devenue « ancienne ». V2 : normalisation des téléphones, confiance, extraction depuis un site (dont groupe
multi-agences, hébergeur / webmaster, e-mail de thème, texte encodé), relais web (refus, robots.txt, origines),
OpenStreetMap (lecture, rapprochement, cache), coordonnées multi-sources, moteur complet, file (nouvel essai différé), export.
Socle : import CSV (valide, incorrect, colonnes manquantes), import SIRENE (pagination, cache, filtres, 429),
recherche (SIREN, SIRET, nom, code postal), enrichissement (complet, partiel, introuvable, ambigu, API indisponible, API limitée,
timeout, cache / forcer), file d'attente (succès, échec, relance, reprise, limiteur), déduplication et fusion, provenance et
protection des saisies manuelles, scoring, filtres, segments, CRUD, export, permissions, isolation des workspaces (y compris
file, journaux, doublons), relances, modèles, « Ne plus contacter », anonymisation, IA avec / sans clé, sauvegarde, migration v1 → v2, 10 000 lignes.

## 16. Évolutions préparées

Serveur et multi-utilisateur (réimplémenter `ProspectsApi` ; `workspaceId` et RBAC déjà en place), `EmailProvider`
transactionnel (Resend, Brevo…), téléphonie, CRM externe, Google Places, IA avancée (analyse des réponses, « 20 prospects à
contacter aujourd'hui »), marketplace de leads et prospection premium via les quotas par plan.
