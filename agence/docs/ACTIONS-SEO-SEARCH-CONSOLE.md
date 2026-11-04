# Signe & Seine — actions SEO suite à Search Console (4 novembre 2026)

Analyse des requêtes sur les 3 derniers mois, puis ce qui a été modifié sur le site et ce qu'il vous reste à faire.
Audit complet : [../AUDIT-SEO.md](../AUDIT-SEO.md) · Travaux précédents : [../LIVRABLE-SEO.md](../LIVRABLE-SEO.md).

## 1. Diagnostic

| Requête | Impressions | Position | Lecture |
|---|---|---|---|
| agence web bolbec | 11 | **16,8** | 🟢 Page 2 : la plus proche de la page 1 |
| référencement site internet bolbec | 17 | **18,6** | 🟢 Page 2 |
| référencement bolbec | 19 | **19,1** | 🟢 Page 2 |
| agence de création de site internet fécamp | 11 | 37,4 | 🟠 Page 4 |
| référencement naturel normandie | 15 | 38,6 | 🟠 Page 4 |
| agence web fécamp | **24** | 46,8 | 🟠 La recherche la plus fréquente, mais en page 5 |
| création site internet yvetot | 12 | 65,7 | 🔴 Page 7 |
| référencement naturel seine et marne | 11 | 73,4 | ⚪ Hors zone : Google confond « Seine » et Seine-et-Marne |
| création site internet fécamp | 15 | 80,5 | 🔴 Page 8 |
| référencement site artisan | 10 | 96,3 | 🔴 Page 10 |

À retenir :

- **Bolbec**, commune voisine de Gruchet-le-Valasse, est le point fort.
- **Fécamp** est la ville la plus recherchée, mais Google ne vous y associe pas encore. Sa page n'existe que depuis le 22/10/2026, et son texte ne contenait ni « site internet » ni « référencement ».
- Toutes ces recherches sont **locales**. Google y affiche d'abord la carte et les fiches Google Business.

## 2. Ce qui a été modifié sur le site (fait)

| Page | Avant | Après |
|---|---|---|
| `/agence-web/bolbec` | Agence web et communication à Bolbec | **Agence web, création de site et référencement à Bolbec** |
| `/agence-web/fecamp` | Agence web et print à Fécamp | **Création de site internet et agence web à Fécamp**, avec une nouvelle section « Création de site internet à Fécamp » (site, référencement local, lien vers la page référencement) |
| `/agence-web/yvetot` | Agence web et print à Yvetot | **Création de site internet et agence web à Yvetot** |
| `/referencement-local-artisan` | Référencement local pour artisans et TPE | **Référencement local d'artisans et TPE en Normandie** |
| Accueil (description) | … (Pays de Caux) … | … (**Pays de Caux, Seine-Maritime**) : sites internet, **référencement** … |
| 10 articles de blog programmés | Titres de 68 à 83 caractères, coupés par Google | Titre Google de 60 caractères au plus |

La migration 12 applique ces changements à la base en ligne au démarrage. **Une page ou un article que vous avez déjà
modifié dans l'administration n'est pas touché.**

## 3. À faire par vous

### A. Mettre en ligne (2 min)

GitHub → dépôt `paysapro-prospection` → onglet **Actions** → « Agence — mise en ligne Cloudflare » → **Run workflow**.
Si elle a déjà été lancée pour vous, vérifiez simplement qu'elle est verte.

### B. Search Console : demander la réindexation (5 min)

*Inspection de l'URL* → **Demander une indexation** :

- https://www.signeetseine.fr/agence-web/fecamp
- https://www.signeetseine.fr/agence-web/bolbec
- https://www.signeetseine.fr/agence-web/yvetot
- https://www.signeetseine.fr/referencement-local-artisan
- https://www.signeetseine.fr/

### C. Fiche Google Business Profile : l'action n°1 pour « agence web Fécamp / Bolbec »

- **Catégorie principale** : Concepteur de sites Web. **Secondaires** : Agence de marketing internet, Imprimeur, Graphiste.
- **Zone desservie** : Gruchet-le-Valasse, Bolbec, Lillebonne, Fécamp, Yvetot, Le Havre, Saint-Romain-de-Colbosc.
- **Site** : https://www.signeetseine.fr. Les images prêtes à l'emploi se génèrent avec `agence/scripts/gbp-images.mjs`.
- **Une publication par semaine**, par exemple le lien vers l'article de blog de la semaine.
- **Demander un avis** à chaque client satisfait. Ne jamais acheter d'avis.

### D. Annuaires locaux : même nom, même adresse, même téléphone partout

En priorité : PagesJaunes, annuaire de la CCI Seine Estuaire,
office de tourisme Fécamp / Caux Seine, clubs d'entreprises de Bolbec et de Fécamp.

### E. Un premier client à Fécamp

Une réalisation réelle à Fécamp, ajoutée à la page Fécamp, sera le meilleur signal possible pour Google.

## 4. Quand refaire le point

Fin novembre, puis fin décembre (*Performances* → 28 jours). Objectifs :

- « agence web bolbec » et « référencement bolbec » en **page 1** (position inférieure à 10) ;
- « agence web fécamp » sous la position 20 ;
- une première apparition de la fiche Google dans la carte.
