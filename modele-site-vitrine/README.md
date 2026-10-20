# Modèle de site vitrine (tous métiers) + interface client

Un site vitrine professionnel, rapide et bien référencé, que **vous** adaptez avec Claude Code
et que **votre client** modifie lui-même depuis une interface simple (Pages CMS), sans toucher au code.

- Sections : bandeau d'accueil, points forts, services/tarifs, à propos, galerie, avis, FAQ, contact
  (formulaire, horaires, carte), mentions légales, page « merci », page 404.
- Le client peut changer tous les textes et les photos, les couleurs, le style d'écriture, afficher ou masquer chaque section,
  modifier ses coordonnées et ses horaires.
- Référencement : titre et description Google modifiables, fiche « entreprise locale » (schema.org) générée automatiquement.
- Mobile : bouton « Appeler » fixe en bas de l'écran.
- Exemples prêts : `plombier`, `restaurant`, `coiffeur`, `avocat`.

## 1. Installer une fois

Ce dossier doit devenir **son propre dépôt GitHub** (le CMS lit `.pages.yml` à la racine du dépôt) :

1. Créez un dépôt GitHub `modele-site-vitrine` et copiez-y le contenu de ce dossier.
2. Dans *Settings → General*, cochez **Template repository**.

## 2. Pour chaque nouveau client (≈ 30 min)

1. Sur GitHub : **Use this template → Create a new repository** (ex. `site-dupont-plomberie`).
2. Ouvrez-le avec Claude Code et demandez par exemple :
   > Adapte ce site pour « Boulangerie Martin », boulangerie artisanale à Nantes, 02 40 00 00 00,
   > ouverte du mardi au dimanche 7h–19h30. Thème terre, police classique. Services : pains au levain,
   > viennoiseries, pâtisseries, commandes pour événements. Rédige les textes et la FAQ.

   Claude suit `CLAUDE.md` : il modifie uniquement `src/content/*.json`, ce qui garde tout modifiable par le client.
   Pour partir d'un exemple : `npm run exemple -- restaurant`.
3. Ajoutez les photos du client dans `public/images/` (ou laissez-le les ajouter lui-même ensuite).
4. Vérifiez : `npm install`, `npm run dev`, puis `npm run check`.

## 3. Mettre en ligne (gratuit)

**Netlify** (recommandé, car le formulaire de contact fonctionne sans configuration) :
*Add new site → Import from GitHub* → choisissez le dépôt. Les réglages sont lus dans `netlify.toml`.
Ajoutez ensuite le nom de domaine du client (*Domain management*), puis dans *Site configuration → Environment variables*
ajoutez `SITE_URL = https://www.domaine-du-client.fr`.
Activez les notifications e-mail des formulaires : *Forms → Form notifications*.

Autres hébergeurs (Vercel, Cloudflare Pages) : commande `npm run build`, dossier `dist`. Pour le formulaire,
créez un formulaire gratuit sur Formspree et collez son adresse dans *Apparence & options → Formulaire → Adresse d'envoi*.

## 4. Donner l'accès au client

1. Allez sur **https://app.pagescms.org**, connectez-vous avec GitHub et autorisez l'accès au dépôt du client.
2. Ouvrez le dépôt → **Settings → Collaborators** → invitez l'e-mail du client.
3. Le client reçoit un lien, se connecte **sans compte GitHub** et voit ses onglets : *Page d'accueil*, *Services*,
   *Galerie photos*, *Avis clients*, *Questions fréquentes*, *Mon entreprise*, *Apparence & options*.
4. À chaque « Save », le site se met à jour tout seul en 1 à 2 minutes.

### Votre propre interface, à votre marque

Pages CMS est open source (licence MIT) : vous pouvez l'héberger vous-même (sur Vercel par exemple) sous votre
nom de domaine, du type `admin.votre-agence.fr`, avec votre logo. Tous vos clients se connectent alors au même endroit.

## Structure

| Fichier | Rôle |
|---|---|
| `src/content/*.json` | **le contenu**, modifié par le client |
| `.pages.yml` | les formulaires de l'interface client |
| `src/lib/contenu.ts` | lecture du contenu, thèmes de couleurs, polices |
| `src/pages/*.astro` | les pages (accueil, mentions légales, merci, 404) |
| `src/styles/global.css` | le design |
| `exemples/*.json` | contenus types par métier |

## Ajouter un métier d'exemple

Copiez `exemples/plombier.json` en `exemples/<metier>.json`, puis adaptez-le (ou demandez à Claude de le faire).
Il devient disponible avec `npm run exemple -- <metier>`.
