# Lien avec Paysapro Prospection

Les deux logiciels se complètent :

| S&S Social Finder | Paysapro Prospection (espace Signe & Seine) |
|---|---|
| trouve les entreprises sur Instagram et Facebook | cherche leurs coordonnées (SIRENE, site, e-mail, téléphone) |
| deux scores : confiance et potentiel commercial | score « besoin d'une agence » et suivi e-mail |
| messages privés à envoyer à la main | campagnes e-mail, relances |

## Envoyer des prospects

1. Dans Social Finder : **Prospects** (ou une fiche) → **Envoyer vers Prospection**.
   - Sélection cochée, ou filtre par score (confiance ≥ 75 par défaut).
   - « Uniquement ceux jamais envoyés » évite de créer des doublons.
   - Jamais envoyés : données de démonstration, entreprises « Ne plus contacter » ou en opposition.
2. Téléchargez le fichier `vers-prospection-….csv`.
3. Dans Prospection : espace **Signe & Seine** → **Import → CSV** → choisissez le fichier.
   Les colonnes sont reconnues automatiquement ; Prospection signale les doublons.
4. Dans Prospection, lancez la recherche de coordonnées sur les fiches importées.

La fiche Social Finder affiche ensuite « Envoyée vers Prospection le … » et l'historique garde la trace de l'envoi.

## Contenu du fichier

| Colonne | Champ Prospection |
|---|---|
| Nom entreprise | Nom |
| Ville | Ville (uniquement si le profil la confirme) |
| Departement | Département |
| Activite | Activité |
| Site web | Site |
| Facebook / Instagram | Liens sociaux |
| URL source | Source (profil Instagram, sinon page Facebook) |
| SF Confiance, SF Commercial, SF Priorite, SF Opportunite, SF Statut, SF Decouvert le | *informatif, non importé* (Prospection n'a pas de champ pour ces scores) |

La liste des colonnes est définie une seule fois dans `social-finder/prospection-import.json`. Un test de chaque côté
garantit que le format reste compatible : `social-finder/backend/tests` (export) et
`tests/social-finder-import.test.ts` (import dans Prospection).
