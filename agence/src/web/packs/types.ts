/**
 * Packs « Bien démarrer » par métier.
 * Chaque métier est décrit dans UN fichier de données (`src/web/packs/<metier>.ts`) puis déclaré
 * dans `src/web/packs/index.ts`. Le gabarit (`src/web/public/packs.tsx`) est commun : ajouter un métier
 * (boulangerie, boutique…) ne demande aucun code supplémentaire.
 *
 * Règles de contenu : aucun prix, quantité ou délai inventé (placeholder « [À COMPLÉTER : …] »),
 * aucun avis ni chiffre fictif, aucune marque d'outil tiers citée, texte propre à chaque métier.
 */
import type { VisualKind } from '../content';

export type PackIcon = 'restaurant' | 'jardin' | 'coiffure' | 'batiment' | 'boutique';

export interface PackOption {
  name: string;
  text: string;
  /** « Sur devis » ou tarif (placeholder tant qu'il n'est pas fixé). */
  price: string;
}

export interface PackDef {
  /** Identifiant d'URL : /packs/<slug>. */
  slug: string;
  /** Nom du métier au singulier, pour les titres courts (« Restaurant »). */
  metier: string;
  /** Activité pré-remplie dans le formulaire de devis signalétique. */
  activity: string;
  icon: PackIcon;
  visual: VisualKind;
  /** Mot-clé principal visé (documenté dans AUDIT-SEO.md). */
  keyword: string;
  metaTitle: string;
  metaDescription: string;
  /** Carte du hub, de l'accueil et du menu. */
  card: { title: string; text: string };

  // 1. Accroche, enjeux, erreurs fréquentes
  eyebrow: string;
  h1: string;
  h1em: string;
  intro: string;
  stakes: { title: string; body: string };
  mistakes: { title: string; items: [string, string][] };

  // 2. Pack de base
  base: {
    /** Prix « à partir de », HT. */
    priceFrom: string;
    intro: string;
    site: { title: string; items: string[] };
    graphic: { title: string; items: string[] };
    /** [support, quantité indicative] */
    prints: [string, string][];
    google: string[];
  };

  // 3. Options métier (intégrations de solutions existantes, pas de développement sur mesure)
  options: { intro: string; items: PackOption[] };

  // 4. Offre recommandée vitrine & signalétique (sur devis, pose par partenaire)
  signage: {
    intro: string;
    items: [string, string][];
    /** Besoins cochés dans le formulaire de devis signalétique (valeurs de SIGNAGE_NEEDS). */
    needs: string[];
  };

  /** Approfondissement propre au métier (Markdown). */
  extra: { eyebrow: string; title: string; body: string }[];

  // 5. Déroulé : [étape, description, délai indicatif]
  steps: [string, string, string][];

  // 6. Concept du portfolio
  portfolio: { slug: string; text: string };

  // 7. FAQ
  faq: [string, string][];

  // 8. Section locale (reformulée pour chaque métier)
  local: { title: string; body: string };

  /** Pages prestations liées (maillage). */
  links: [string, string][];
}
