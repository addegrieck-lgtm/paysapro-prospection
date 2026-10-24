# Paysapro Prospection

Outil de prospection B2B des entreprises de paysagisme françaises, pour vendre Paysapro AI.
Application indépendante, **100 % gratuite**, qui fonctionne dans le navigateur (ordinateur et téléphone) sans serveur ni abonnement.

## Deux espaces : Paysapro AI et Signe & Seine

Le sélecteur en haut du menu (ou en haut de l’écran sur téléphone) bascule entre deux espaces **entièrement séparés**
(prospects, segments, campagnes, relances, modèles, statistiques, paramètres, sauvegarde en ligne) :

| | Paysapro AI | Signe & Seine |
|---|---|---|
| Ce qu’on vend | le logiciel de devis pour paysagistes | l’agence web & communication (site, fiche Google, logo, imprimés) |
| Cibles | paysagistes (NAF 81.30Z) | 🏗️ artisans du BTP, 🍽️ restauration & métiers de bouche, 💇 commerces & beauté, 🔧 services locaux (47 codes NAF, `src/domain/offers.ts`) |
| Zone par défaut | à choisir | Seine-Maritime (76) |
| Score | entreprise équipée et joignable | **besoin d’une agence** (aucun site trouvé +20, pas de fiche Google +10 ou peu d’avis +5, créée depuis moins d’un an +15 / 1 à 3 ans +10, aucun réseau social +5) **+ joignable** (active, téléphone, e-mail, employeur, zone, fiche complète) |
| Vocabulaire | démo, essai | rendez-vous, devis envoyé |

Une absence ne compte dans le score Signe & Seine que si elle a été **constatée** : « aucun site » après la recherche
de coordonnées (Enrichir), « pas de fiche Google » après vérification (bouton *Pas de fiche Google* sur la fiche).

### Enrichissement

Sources gratuites : SIRENE, OpenStreetMap (instantané de la Seine-Maritime régénéré à chaque mise en ligne,
`npm run osm:local`), lecture du site de l'entreprise via le relais, avec un **diagnostic du site** (pas de HTTPS,
pas adapté au téléphone, copyright ancien, site gratuit sans nom de domaine → « site à moderniser », +10 au score
Signe & Seine). Facultatif, avec une clé posée sur le relais : **recherche web** (Brave Search) et **fiches Google**
(Google Places). Voir [worker/README.md](worker/README.md#services-facultatifs--recherche-web-et-fiches-google).

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrez l'adresse affichée (ex. http://localhost:5173).

## Premier usage (5 minutes)

1. **Paramètres** : votre nom, votre signature, votre adresse e-mail (mode test activé par défaut).
2. **Dashboard → 🔎 Trouver des prospects** : choisissez une zone (commencez par un code postal ou un département),
   *Lancer la recherche* : entreprises officielles (SIRENE), puis recherche automatique des coordonnées professionnelles
   disponibles (OpenStreetMap, sites officiels via le relais gratuit — voir [worker/README.md](worker/README.md)).
   Ou **Import → Démo** pour découvrir l'outil avec 100 entreprises fictives.
3. **Prospects** : filtrez, ouvrez une fiche, cliquez **Google** pour vérifier sa présence, puis **Modifier / enrichir**
   (site, e-mail, téléphone, avis). Le score se recalcule.
4. **Segments** → **Campagnes** : aperçu, validation, puis *Ouvrir dans mon e-mail* pour chaque message.
5. **Relances** chaque matin ; **Statistiques** pour suivre la conversion.

Pensez à **sauvegarder** (Paramètres → Données) : les données restent sur l'appareil.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | développement |
| `npm run build` | vérification TypeScript + version de production (`dist/`) |
| `npm test` | tests |
| `npm run lint` | ESLint |
| `npm run osm:update` | met à jour l'instantané OpenStreetMap (entreprises du paysage, ODbL) |
| `npm run osm:local` | instantané OpenStreetMap des commerces et artisans de la Seine-Maritime (`-- 76 27` pour d'autres départements) |

Documentation complète : [PROSPECTING.md](PROSPECTING.md).

---

**Projet distinct dans ce dépôt :** [`agence/`](agence/README.md) — site et back-office de l’agence web & communication
(serveur Hono + SQLite/Cloudflare D1). Aucune donnée ni infrastructure n’est partagée avec Paysapro Prospection.
