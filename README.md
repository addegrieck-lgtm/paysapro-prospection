# Paysapro Prospection

Outil de prospection B2B des entreprises de paysagisme françaises, pour vendre Paysapro AI.
Application indépendante, **100 % gratuite**, qui fonctionne dans le navigateur (ordinateur et téléphone) sans serveur ni abonnement.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrez l'adresse affichée (ex. http://localhost:5173).

## Premier usage (5 minutes)

1. **Paramètres** : votre nom, votre signature, votre adresse e-mail (mode test activé par défaut).
2. **Import → Démo** pour découvrir l'outil avec 100 entreprises fictives, ou directement
   **Import → SIRENE** : cochez vos départements puis *Importer* (gratuit, données officielles INSEE).
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

Documentation complète : [PROSPECTING.md](PROSPECTING.md).
