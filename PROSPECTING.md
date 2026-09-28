# Paysapro Prospection — documentation technique

Application **indépendante** de Paysapro AI, dédiée à la prospection B2B des entreprises de paysagisme françaises.
Coût logiciel : **0 €**. Aucune API payante, aucune base de leads, aucun CRM ni outil d'emailing payant.

---

## 1. Architecture

```
SIRENE (API publique gratuite) ─┐
Fichiers CSV / enrichissement ──┼─► Import par lots ─► Déduplication ─► Scoring ─► Base prospects (IndexedDB)
Saisie manuelle ────────────────┘                                                     │
                                                                                      ▼
            Recherche Google manuelle ◄── Fiche CRM (notes, relances, historique, statut)
                                                                                      │
                          Segments dynamiques ─► Campagnes (aperçu → validation) ─► Ma messagerie (mailto) / copier
                                                                                      │
                                                                                      ▼
                                                                   Dashboard & statistiques
```

| Couche | Emplacement | Rôle |
|---|---|---|
| Domaine (pur, testé) | `src/domain/` | types, scoring, déduplication, CSV, mapping, filtres, modèles, statistiques, permissions, quotas |
| Données | `src/data/` | base IndexedDB (`db.ts`), « API » locale (`repository.ts`), export, démo |
| Fournisseurs | `src/providers/` | `DataProvider` (SIRENE, CSV, Manuel, Google Places désactivé), `MessageProvider` (modèles / IA), `EmailProvider` (mailto) |
| Interface | `src/pages/`, `src/components/`, `src/app/` | React 19 + Tailwind 4, design system identique à Paysapro AI |

**Stack** : React 19, TypeScript 5.9, Vite 8, Tailwind 4, react-router 8 (HashRouter), `idb`, vite-plugin-pwa, Vitest + fake-indexeddb.
Même stack que Paysapro AI, mais **aucun code partagé à l'exécution** : les deux applications sont indépendantes.

### Pourquoi pas de serveur ?
Les données sont stockées dans le navigateur (IndexedDB). C'est gratuit, rapide, hors-ligne, et les données de prospection
ne quittent pas votre appareil (RGPD). Contreparties : un seul utilisateur, **sauvegardez régulièrement** (Paramètres → Sauvegarder).
Le passage à un serveur (Supabase, Cloudflare…) ne demande que de réimplémenter `ProspectsApi` (voir § 4).

---

## 2. Base de données

Base IndexedDB `paysapro-prospection`, version 1. Toutes les tables portent `workspace_id` (champ `workspaceId`) et sont indexées dessus.

| Table | Contenu | Index |
|---|---|---|
| `prospects` | fiches complètes | workspaceId, siren, siret |
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
tables ou index — jamais de suppression. La version 1 crée tout le schéma.

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

**Performance** : les versions compactes (`prospect_rows`) sont chargées une fois en mémoire ; filtrer / trier / rechercher
100 000 lignes prend quelques dizaines de millisecondes, seule la page affichée (50 lignes) est rendue. Recherche avec
temporisation (200 ms), pages chargées à la demande (lazy loading), import par lots de 500 sans bloquer l'interface.
Test : 10 000 prospects importés puis filtrés en moins de 500 ms.

---

## 5. Import SIRENE (gratuit)

`src/providers/sirene.ts` — API publique **Recherche d'entreprises** (`recherche-entreprises.api.gouv.fr`, données INSEE) :
sans clé, sans compte, appelable depuis le navigateur.

- Filtre : `activite_principale` = codes NAF ciblés (défaut **81.30Z** — Services d'aménagement paysager ; configurable dans
  Paramètres), `etat_administratif=A`, un département à la fois.
- Limites de la source respectées : 25 résultats par page, 10 000 maximum par requête (d'où le découpage par département),
  ~7 requêtes/s autorisées → l'application en fait **4 par seconde** et réessaie après une erreur 429.
- **Cache** : chaque page est gardée 7 jours ; un import interrompu reprend sans re-télécharger.
- Seuls les **établissements actifs**, du NAF ciblé, situés dans le département et à **diffusion publique** (statut « O ») sont
  retenus. Les entreprises en diffusion partielle sont ignorées. Les données sur les dirigeants ne sont **pas** conservées.
- Option : exclure les entrepreneurs individuels (personnes physiques).
- Réimport : les fiches existantes (même SIRET) sont mises à jour (identité officielle rafraîchie, `lastVerifiedAt` mis à jour),
  vos enrichissements manuels sont conservés.
- **SIRENE ne fournit ni téléphone, ni e-mail, ni site, ni avis** : les fiches importées affichent « Non disponible » et
  démarrent avec un score faible. C'est normal : l'enrichissement se fait ensuite (Google manuel, CSV).
- Volume : toute la France représente plusieurs dizaines de milliers d'établissements (≈ 10 à 20 min).

Remplacer la source : implémenter l'interface `DataProvider` et fournir une conversion vers `ProspectInput`.
`VITE_SIRENE_API_URL` permet de changer l'URL si l'API déménage.

---

## 6. Import CSV et enrichissement

Import → onglet **CSV**, en 4 étapes : fichier → analyse (lignes, colonnes reconnues, lignes invalides, doublons potentiels)
→ correspondances (modifiables) → import avec progression et rapport final (ajoutés, mis à jour, doublons, invalides, exclus).

- UTF-8 avec ou sans BOM, séparateur `,` `;` ou tabulation détecté automatiquement, guillemets et retours à la ligne gérés.
- Colonnes reconnues automatiquement (synonymes français/anglais) : nom, nom commercial, SIREN, SIRET, adresse, CP, ville,
  département, téléphone, e-mail, site, Google URL / note / avis, effectif (nombre ou tranche INSEE), NAF, activité,
  prestations, date de création, prénom / nom du contact, Facebook, Instagram, LinkedIn, TikTok, URL source.
- Une valeur illisible (e-mail mal formé, téléphone incomplet…) est **ignorée et signalée**, jamais corrigée au hasard.
- **Enrichissement** (onglet *Enrichir*) : le fichier complète des prospects existants retrouvés par SIRET, SIREN, téléphone
  ou nom + ville ; une valeur fournie remplace l'ancienne, une cellule vide ne supprime rien, aucune fiche n'est créée.

Exemple de fichier d'enrichissement :

```csv
siren;email;site;google_url;google_rating;google_reviews;telephone;instagram;facebook;linkedin
123456789;contact@exemple.fr;www.exemple.fr;https://maps.google.com/?cid=…;4,7;87;0235000000;;;
```

### Déduplication (`src/domain/dedupe.ts`)
Priorité **SIRET > SIREN > téléphone > nom + ville > nom + adresse** (noms normalisés : accents, casse, formes juridiques).
- SIRET / SIREN : même entreprise → mise à jour.
- Téléphone / nom : doublon probable → la fiche existante est seulement **complétée**, jamais écrasée.
- Deux établissements d'une même entreprise (SIRET différents) ne sont pas des doublons ; deux SIREN différents ne sont
  jamais fusionnés, même avec un nom et une ville identiques.
- Aucune suppression automatique.

---

## 7. Scoring (`src/domain/scoring.ts`)

Score sur 100, recalculé à chaque modification, entièrement local :

| Critère | Points |
|---|---|
| Téléphone disponible | +15 |
| E-mail disponible | +5 |
| Site internet | +15 |
| Présence Google renseignée (URL, note ou avis) | +15 |
| Plus de 20 avis Google / plus de 50 avis | +10 / +20 (un seul palier) |
| Note Google ≥ 4,5 (avec au moins 5 avis) | +10 |
| Effectif ≥ 3 (saisi ou tranche INSEE) | +10 |
| Activité de création / aménagement (prestations renseignées) | +5 |
| Au moins 2 prestations | +5 |

Pas de double comptage : le site compte une fois quelle que soit sa source ; les avis sont un palier unique ; le code NAF ne
donne aucun point (tous les prospects l'ont). La fiche affiche « Pourquoi ce score ? » ligne par ligne et les critères à vérifier.

Priorités (catégories internes, pas un jugement sur l'entreprise) : 🔥 80–100 maximale · 🟠 60–79 élevée · 🟡 40–59 normale · ⚪ 0–39 faible.
Paramètres → Données → *Recalculer les scores* après une évolution des règles.

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

Aucun scraping de Google Maps, aucune API Google payante. Chaque fiche propose **Rechercher sur Google**
(`nom + ville + paysagiste`, URL construite dynamiquement) et **Chercher sur Maps** ; vous reportez ensuite dans la fiche
(Modifier / enrichir) l'URL, la note, le nombre d'avis, la catégorie, et cochez « Vérifié sur Google aujourd'hui ».
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
- Une donnée n'est jamais présentée comme vérifiée si elle ne l'est pas (« Non disponible » sinon).
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
| `VITE_SIRENE_API_URL` | URL de l'API SIRENE | `https://recherche-entreprises.api.gouv.fr` |

Il n'y a ni `DATABASE_URL` (base locale) ni `AI_API_KEY` (la clé vit dans le proxy, jamais dans ce code).

## 15. Tests

`npm test` — 57 tests (Vitest) : import CSV, import SIRENE (pagination, cache, filtres, 429), déduplication, scoring,
filtres, segments, création / modification / suppression, export, permissions, isolation des workspaces, relances,
modèles, « Ne plus contacter », génération avec et sans IA, sauvegarde / restauration, 10 000 lignes.

## 16. Évolutions préparées

Serveur et multi-utilisateur (réimplémenter `ProspectsApi` ; `workspaceId` et RBAC déjà en place), `EmailProvider`
transactionnel (Resend, Brevo…), téléphonie, CRM externe, Google Places, IA avancée (analyse des réponses, « 20 prospects à
contacter aujourd'hui »), marketplace de leads et prospection premium via les quotas par plan.
