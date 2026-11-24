# Le double scoring

Chaque entreprise a **deux scores sur 100, calculés séparément et jamais mélangés**. Le calcul est fait par des
règles déterministes (`backend/app/scoring/`) : mêmes informations → mêmes scores. Chaque point est enregistré avec
sa justification, sa source et son statut :

| Statut | Signification |
|---|---|
| **Vérifié** | lu via l'API officielle Meta ou saisi/validé par vous |
| **Constaté** | lu dans l'extrait indexé d'un moteur de recherche ou sur le site (peut dater) |
| **Hypothèse** | déduction plausible, non prouvée |
| **Inconnu** | information indisponible : **0 point** |
| **Contradiction** | information contraire : **points retirés** |

L'IA n'intervient jamais dans les scores.

## A. Score de confiance — « Ces profils correspondent-ils vraiment à cette entreprise ? »

| Critère | Max | Règles principales |
|---|---|---|
| Nom commercial | 25 | 25 : même nom sur Instagram et Facebook (≥ 85 %) · 20 : nom dans le titre du site · 15 : nom cohérent avec l'identifiant · 8 : partiellement · −10 : noms différents entre réseaux |
| Localisation | 20 | 20 : la ville recherchée apparaît · 12 : seulement le département (nom, n°, code postal) · 8 : seulement la région · −10 : autre grande ville hors zone ou code postal d'un autre département |
| Activité | 20 | 20 : un terme du métier dans le nom, la description ou la catégorie · 12 : seulement dans l'identifiant · −10 : le profil évoque un autre métier · 0 : seul le moteur l'a associé |
| Description | 10 | 10 : la bio cite l'activité ou la ville · 7 : bio professionnelle (horaires, devis, réservation…) · 4 : bio peu informative · 0 : pas de bio |
| Liens croisés FB/IG | 15 | 15 : la page Facebook déclare/mentionne le compte Instagram (API ou extrait), ou l'inverse, ou le site renvoie aux deux · 6 (hypothèse) : même identifiant sur les deux réseaux · 0 : un seul réseau |
| Autres indices | 10 | +4 profil confirmé par l'API Meta · +3 domaine du site = nom · +4 le site renvoie au profil · +2 lieu fréquenté (« étaient ici ») · +2 sélection manuelle (recherche assistée) |

| Score | Niveau | Action |
|---|---|---|
| 90–100 | Très fiable | Priorité |
| 75–89 | Fiable | Prospect exploitable |
| 50–74 | À vérifier | Validation manuelle |
| 0–49 | Incertain | Ne pas contacter sans vérification |

Pour faire monter un score « À vérifier » : fiche → **Vérifier** (API Meta + site) ou **crayon** sur un profil pour
compléter ce que vous avez constaté vous-même (marqué « saisie manuelle »).

## B. Score de potentiel commercial — « Est-ce une opportunité pour Signe & Seine ? »

| Critère | Max | Règles principales |
|---|---|---|
| Besoin en communication / visibilité | 25 | Abonnés Instagram (< 300 : 12, < 1 000 : 9, < 3 000 : 5, sinon 1) · publications (< 20 : 8, < 60 : 5) · « J'aime » Facebook (< 300 : 10…) |
| Site Internet (création / refonte) | 20 | 6 par défaut constaté (pas de HTTPS, pas mobile, copyright ≥ 4 ans, technologie dépassée, sans nom de domaine) · 12 : site injoignable · 10 : page de liens (Linktree…) · 12 : aucun site sur un profil vérifié par l'API · **6 (hypothèse)** : aucun site trouvé dans les extraits · 2 : site sans défaut |
| Présence sociale perfectible | 15 | Dernière publication > 90 j : 7 (> 30 j : 3) · bio absente/courte (API) : 5 · < 30 publications : 4 · un seul réseau trouvé (hypothèse) : 3 |
| Identité visuelle / graphisme | 15 | Lancement, nouvelle adresse, inauguration : 10 · nom différent selon le réseau : 4 · identifiant éloigné du nom : 3 · site sans domaine : 3 · métier où l'image compte (hypothèse) : 4 |
| Pertinence des services | 15 | Référentiel par métier (restaurant, boutique 15 · coiffeur, institut 14 · … · santé, photographe 8) |
| Activité réelle et actuelle | 10 | Dernière publication ≤ 30 j : 10, ≤ 90 j : 7, ≤ 1 an : 3 · compte alimenté (date inconnue) : 4 · lieu fréquenté : 3 · site en ligne : 2 · « fermé définitivement » : −10 et exclusion |

| Score | Niveau | Action |
|---|---|---|
| 85–100 | Excellent potentiel | Priorité élevée |
| 70–84 | Bon potentiel | À contacter |
| 50–69 | Potentiel moyen | À étudier |
| 0–49 | Faible potentiel | Priorité basse |

L'absence de site n'est **jamais** traitée comme une preuve de mauvais marketing : sans vérification officielle,
elle vaut 6 points « hypothèse » et le message la formule en question (« peut-être en avez-vous déjà un ? »).

## C. Priorité combinée

`Priorité = confiance × 0,60 + commercial × 0,40`, et **si la confiance est < 50, la priorité est plafonnée à la
confiance** : un fort potentiel ne compense jamais une identification incertaine.
« Meilleurs prospects » = confiance ≥ 75 **et** commercial ≥ 70, classés par priorité.
