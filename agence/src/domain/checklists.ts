/** Checklists de contrôle : prépresse (BAT), SEO et sécurité (projets web). */

export interface ChecklistItem {
  key: string;
  label: string;
  help?: string;
}

export const PREPRESS_CHECKLIST: ChecklistItem[] = [
  { key: 'dimensions', label: 'Dimensions finales conformes au format commandé', help: 'Comparer avec le gabarit du fournisseur.' },
  { key: 'bleed', label: 'Fond perdu présent (généralement 2 à 3 mm selon le fournisseur)' },
  { key: 'safety', label: 'Marges de sécurité respectées (textes et logos hors zone de coupe)' },
  { key: 'resolution', label: 'Images à 300 dpi à la taille d’impression' },
  { key: 'color', label: 'Profil colorimétrique adapté (CMJN ou profil demandé par l’imprimeur)' },
  { key: 'fonts', label: 'Polices incorporées ou vectorisées' },
  { key: 'spelling', label: 'Orthographe relue' },
  { key: 'contact', label: 'Coordonnées vérifiées (téléphone, e-mail, adresse, site)' },
  { key: 'sides', label: 'Recto / verso : ordre et orientation des pages vérifiés' },
  { key: 'supplier', label: 'Contraintes du fournisseur vérifiées (format de fichier, nombre de pages, finitions)' },
];

export const SEO_CHECKLIST: ChecklistItem[] = [
  { key: 'titles', label: 'Titres et méta-descriptions uniques sur chaque page' },
  { key: 'headings', label: 'Un seul H1 par page, hiérarchie des titres cohérente' },
  { key: 'urls', label: 'URLs propres et lisibles' },
  { key: 'canonical', label: 'Balises canoniques' },
  { key: 'sitemap', label: 'Sitemap XML généré et déclaré' },
  { key: 'robots', label: 'robots.txt vérifié (préproduction bloquée, production ouverte)' },
  { key: 'schema', label: 'Données structurées exactes (LocalBusiness, etc.)' },
  { key: 'images', label: 'Images compressées (WebP/AVIF), textes alternatifs renseignés' },
  { key: 'cwv', label: 'Core Web Vitals contrôlés (PageSpeed Insights)' },
  { key: '404', label: 'Page 404 utile et redirections des anciennes URLs' },
  { key: 'gsc', label: 'Google Search Console configurée' },
  { key: 'gbp', label: 'Fiche d’établissement Google vérifiée (si pertinent)' },
];

export const SECURITY_CHECKLIST: ChecklistItem[] = [
  { key: 'https', label: 'HTTPS actif et redirection HTTP → HTTPS' },
  { key: 'updates', label: 'CMS, extensions et dépendances à jour' },
  { key: 'admin', label: 'Accès administrateur : mots de passe forts, double authentification si possible' },
  { key: 'secrets', label: 'Aucun secret dans le code ou le dépôt Git (variables d’environnement)' },
  { key: 'backups', label: 'Sauvegardes automatiques testées (restauration vérifiée)' },
  { key: 'forms', label: 'Formulaires protégés (anti-spam, validation serveur)' },
  { key: 'headers', label: 'En-têtes de sécurité (CSP, HSTS, X-Frame-Options…)' },
  { key: 'legal', label: 'Mentions légales, confidentialité et cookies conformes' },
  { key: 'consent', label: 'Aucun traceur non essentiel avant consentement' },
];

export type ChecklistState = Record<string, { done: boolean; at?: string; by?: string }>;

export function parseChecklist(json: string | null | undefined): ChecklistState {
  try {
    const v = JSON.parse(json || '{}');
    return v && typeof v === 'object' ? (v as ChecklistState) : {};
  } catch {
    return {};
  }
}

export function checklistProgress(items: ChecklistItem[], state: ChecklistState): { done: number; total: number; complete: boolean } {
  const done = items.filter((i) => state[i.key]?.done).length;
  return { done, total: items.length, complete: done === items.length };
}
