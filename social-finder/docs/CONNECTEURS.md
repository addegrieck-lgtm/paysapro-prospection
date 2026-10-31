# Configurer les sources

Tout se règle dans **Sources & connecteurs** (les clés restent dans la base locale, masquées à l'affichage).
Chaque carte affiche : statut, quota du jour, procédure, fonctionnalités, limites et lien vers la documentation.

## Source 1 — Moteurs de recherche (découverte)

Le moteur génère des requêtes comme `restaurant "Le Havre" site:instagram.com` (métier × ville × réseau, puis
synonymes et mots-clés), lit **titre, URL et extrait** de chaque résultat, garde les URL de profils Instagram et de
pages Facebook (publications, groupes, événements, annuaires ignorés) et en extrait nom, bio, abonnés, publications.
**Aucune page Facebook ou Instagram n'est téléchargée.**

| Connecteur | Coût | Configuration |
|---|---|---|
| **Brave Search API** (conseillé) | offre gratuite (crédit mensuel, 1 requête/s) | compte sur api-dashboard.search.brave.com → clé « Subscription token » |
| **Google Programmable Search** | 100 requêtes/jour gratuites ; accès des nouveaux comptes restreint par Google | moteur « tout le Web » sur programmablesearchengine.google.com (cx) + clé « Custom Search API » |
| **Relais Paysapro** | gratuit (Cloudflare) | adresse du relais déjà déployé avec `BRAVE_SEARCH_KEY` (voir `worker/README.md` à la racine) |

Si plusieurs sont actifs, le suivant prend le relais en cas de quota atteint ou de clé refusée.
Une **limite quotidienne** par source (modifiable) protège vos quotas. Le nombre d'entreprises obtenues dépend de
ce que les moteurs ont indexé : l'objectif de 50 à 100 par jour est une cible, pas une garantie.

**Reprise de campagne** : les requêtes déjà exécutées dans une campagne sont mémorisées et sautées.

## Source 2 — API officielles Meta (vérification, facultatif)

Usage : **vérifier** un compte Instagram professionnel découvert (nom, bio, site, abonnés, nombre et date des
publications) via *Business Discovery*, et lire une page Facebook si Meta vous accorde « Page Public Metadata Access ».
Les données ainsi lues sont marquées **Vérifié** et font monter le score de confiance.

Ces API **ne permettent pas** de lister les entreprises d'une ville, ni d'envoyer un premier message à une entreprise
qui ne vous a pas écrit.

Procédure :
1. Compte Instagram **professionnel** de Signe & Seine relié à sa page Facebook.
2. Application sur developers.facebook.com (type Entreprise), produits *Instagram Graph API* et *Facebook Login for Business*.
3. Explorateur de l'API Graph : jeton utilisateur avec `instagram_basic`, `pages_show_list`, `pages_read_engagement`
   (+ `business_management` si demandé) → jeton longue durée (60 jours) via l'outil de débogage des jetons.
4. Collez le jeton, **Tester** (permissions accordées/manquantes affichées), puis **Détecter mon compte Instagram**.
5. Le jeton expire : renouvelez-le tous les 60 jours (le statut passe en « À corriger »).

## Source 3 — Recherche assistée (toujours disponible)

Découverte sociale → **Recherche assistée** : les requêtes sont préparées avec des liens Google / Bing / DuckDuckGo.
Vous ouvrez, repérez les profils, collez leurs adresses (une par ligne, `url | nom | description` facultatif) :
le logiciel les dédoublonne, les rapproche et les évalue.

## Analyses complémentaires

- **Diagnostic du site** : une lecture de la page d'accueil du site indiqué dans le profil (jamais Meta).
- **Rayon géographique** : communes du même département dans le rayon, via geo.api.gouv.fr (API publique gratuite).

## Rédaction des messages (Paramètres → IA)

| Mode | Coût | Remarque |
|---|---|---|
| Modèles intégrés (défaut) | gratuit, hors ligne | 3 styles, variantes, personnalisés par métier et observations |
| **Ollama** | gratuit, local | installez ollama.com puis `ollama pull llama3.1` ; rien ne quitte l'ordinateur |
| API compatible OpenAI | selon fournisseur | fonctionne aussi avec LM Studio en local (`http://localhost:1234/v1`) |
| Anthropic | payant à l'usage | clé sur console.anthropic.com |

En cas d'échec de l'IA, les modèles intégrés prennent le relais automatiquement.
