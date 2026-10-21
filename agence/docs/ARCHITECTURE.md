# Architecture

## Choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Langage | TypeScript strict | sûreté, maintenance |
| Serveur web | [Hono](https://hono.dev) + JSX côté serveur | pages HTML rendues côté serveur (SEO, rapidité, aucun JS requis), même code sur Node et Cloudflare Workers |
| Base de données | SQLite (`node:sqlite`) ou Cloudflare D1, derrière une interface commune (`src/db/types.ts`) | gratuit, simple à sauvegarder, migrations versionnées (`src/db/migrations.ts`) |
| Validation | zod | validation serveur de tous les formulaires |
| Front | CSS écrit à la main, ~15 Ko de JS (esbuild), polices auto-hébergées (OFL) | performance (Core Web Vitals), direction artistique propre, CSP stricte |
| Fichiers privés | disque (Node) ou KV / R2 (Workers), interface `FileStorage` | jamais servis en direct |
| E-mails | API Brevo ou Resend via `fetch`, ou simulation | aucun SDK, fonctionne partout |
| Tests | Vitest (unitaires + intégration HTTP), Playwright + axe-core (recette navigateur) | |

Le dépôt contient aussi *Paysapro Prospection* (application React à la racine) : les deux projets sont totalement séparés
(dépendances, données, déploiement). Le lint racine ignore `agence/`.

## Arborescence

```
agence/
  src/
    app.tsx              assemblage : middlewares, routes, 404, erreurs
    app/                 contexte, sécurité (en-têtes, sessions, CSRF, anti-robots)
    db/                  adaptateurs SQLite / D1, migrations, données initiales
    domain/              règles métier pures et testées : argent/TVA, marges, calculateur d'impression, statuts, checklists, textes
    lib/                 crypto (PBKDF2, HMAC), limitation de débit, stockage, e-mails, lecture PDF
    repo/                accès aux données (lectures publiques, paramètres, numérotation)
    services/            cas d'usage : estimation, demandes de devis, devis, commandes et BAT
    routes/              public, SEO, client (liens sécurisés), admin/*
    web/                 gabarits JSX : site public, administration, documents, illustrations SVG
    client/              scripts navigateur (amélioration progressive)
    server/              points d'entrée Node et Cloudflare Workers
  public/assets/         CSS, polices, JS compilé
  tests/                 Vitest
  scripts/               build, création d'admin, recette e2e, accessibilité, contrôle des fuites
```

## Règles métier clés (et où elles sont)

- **Calculateur d’impression** (`src/domain/print.ts`) : recherche stricte de la variante exacte ; prix public seulement si vérifiée,
  non expirée, prix de vente validé et coût inchangé depuis ; `publicEstimate` ne contient que des prix de vente.
- **Marges** (`src/domain/margin.ts`) : marge brute, taux de marge (sur coûts) et taux de marque (sur prix) distincts.
- **Statuts des commandes** (`src/domain/statuses.ts → orderTransitionError`) : BAT accepté avant toute étape fournisseur, référence
  réelle pour « commande passée ».
- **Numérotation** : compteur atomique en base (`counters`) ; pour les factures, incrément et attribution dans le même lot atomique.
- **Sécurité** : `src/app/security.ts` (CSP, HSTS, sessions `HttpOnly`/`SameSite=Strict`, CSRF par jeton de session + contrôle d’origine,
  jeton de formulaire signé et pot de miel, limitation de débit par empreinte d’IP).

## Espace client

Pas de compte client : chaque devis, BAT et recette possède un lien contenant un jeton aléatoire de 256 bits, envoyé uniquement à
l’adresse du client. Périmètre volontairement limité (consultation et décision) pour rester sûr sans gestion de mots de passe.
