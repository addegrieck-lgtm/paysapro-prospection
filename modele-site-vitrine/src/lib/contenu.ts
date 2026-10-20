// Point d'entrée unique du contenu : les fichiers JSON de src/content sont modifiés
// par le client depuis l'interface d'administration (Pages CMS, voir .pages.yml).
// Les types sont déclarés ici (et non déduits des JSON) pour qu'une liste vidée par le client ne casse rien.
import entrepriseJson from '../content/entreprise.json';
import apparenceJson from '../content/apparence.json';
import accueilJson from '../content/accueil.json';
import servicesJson from '../content/services.json';
import galerieJson from '../content/galerie.json';
import avisJson from '../content/avis.json';
import faqJson from '../content/faq.json';

export interface Entreprise {
  nom: string;
  metier: string;
  slogan: string;
  logo: string;
  categorie: string;
  telephone: string;
  email: string;
  adresse: string;
  code_postal: string;
  ville: string;
  zone_intervention: string;
  horaires: { jours: string; heures: string }[];
  reseaux: { facebook: string; instagram: string; linkedin: string; google: string };
  seo: { titre: string; description: string };
  legal: {
    raison_sociale: string;
    forme_capital: string;
    siret: string;
    rcs_rm: string;
    tva: string;
    responsable_publication: string;
    hebergeur: string;
  };
}

export interface Apparence {
  theme: string;
  couleur_perso: string;
  police: string;
  sections: Record<'points_forts' | 'services' | 'apropos' | 'galerie' | 'avis' | 'faq' | 'contact', boolean>;
  formulaire: { actif: boolean; adresse_envoi: string };
  carte: boolean;
  barre_appel_mobile: boolean;
}

export interface Accueil {
  hero: { titre: string; sous_titre: string; image: string; bouton_principal: string; bouton_secondaire: string };
  points_forts: { titre: string; texte: string }[];
  apropos: { titre: string; texte: string; image: string; chiffres: { valeur: string; libelle: string }[] };
}

export interface Photo {
  image: string;
  legende?: string;
}

export const entreprise = entrepriseJson as Entreprise;
export const apparence = apparenceJson as Apparence;
export const accueil = accueilJson as Accueil;
export const services = servicesJson as {
  titre: string;
  intro: string;
  liste: { titre: string; description: string; prix: string; image: string }[];
};
export const galerie = galerieJson as { titre: string; photos: Photo[] };
export const avis = avisJson as {
  titre: string;
  note_globale: string;
  lien_avis: string;
  liste: { nom: string; note: number; texte: string }[];
};
export const faq = faqJson as { titre: string; questions: { question: string; reponse: string }[] };

const THEMES: Record<string, { primaire: string; accent: string }> = {
  bleu: { primaire: '#1f5f99', accent: '#f2a541' },
  vert: { primaire: '#2f7d4f', accent: '#e0b84a' },
  terre: { primaire: '#9a5b34', accent: '#3d6b5a' },
  bordeaux: { primaire: '#7a1f35', accent: '#c9a46a' },
  anthracite: { primaire: '#2d3340', accent: '#e4572e' },
  rose: { primaire: '#b8456f', accent: '#2d3340' },
  orange: { primaire: '#d35f1e', accent: '#24486b' },
};

const POLICES: Record<string, { titres: string; texte: string }> = {
  moderne: { titres: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', texte: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  classique: { titres: 'Georgia, "Times New Roman", serif', texte: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  elegante: { titres: '"Palatino Linotype", Palatino, "Book Antiqua", serif', texte: '"Palatino Linotype", Palatino, Georgia, serif' },
  arrondie: { titres: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif', texte: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Variables CSS du thème choisi par le client (couleur personnalisée prioritaire). */
export function variablesTheme(): string {
  const theme = THEMES[apparence.theme] ?? THEMES.bleu;
  const police = POLICES[apparence.police] ?? POLICES.moderne;
  const primaire = HEX.test(apparence.couleur_perso) ? apparence.couleur_perso : theme.primaire;
  return [
    `--primaire:${primaire}`,
    `--accent:${theme.accent}`,
    `--police-titres:${police.titres}`,
    `--police-texte:${police.texte}`,
  ].join(';');
}

/** Découpe un texte saisi par le client en paragraphes (ligne vide = nouveau paragraphe). */
export function paragraphes(texte: string | undefined): string[] {
  return (texte ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/** Lien « tel: » au format international à partir d'un numéro français saisi librement. */
export function lienTelephone(numero: string): string {
  const chiffres = numero.replace(/[^\d+]/g, '');
  return 'tel:' + (chiffres.startsWith('0') ? '+33' + chiffres.slice(1) : chiffres);
}

export const adresseComplete = [entreprise.adresse, `${entreprise.code_postal} ${entreprise.ville}`.trim()]
  .filter(Boolean)
  .join(', ');

export const photos: Photo[] = galerie.photos.filter((p) => p.image);

/** Une section s'affiche si elle est cochée par le client ET qu'elle a du contenu. */
export const visible = {
  points_forts: apparence.sections.points_forts && accueil.points_forts.length > 0,
  services: apparence.sections.services && services.liste.length > 0,
  apropos: apparence.sections.apropos && paragraphes(accueil.apropos.texte).length > 0,
  galerie: apparence.sections.galerie && photos.length > 0,
  avis: apparence.sections.avis && avis.liste.length > 0,
  faq: apparence.sections.faq && faq.questions.length > 0,
  contact: apparence.sections.contact,
};

export const menu = [
  visible.services && { href: '/#services', libelle: services.titre },
  visible.apropos && { href: '/#apropos', libelle: 'À propos' },
  visible.galerie && { href: '/#galerie', libelle: galerie.titre },
  visible.avis && { href: '/#avis', libelle: 'Avis' },
  visible.faq && { href: '/#faq', libelle: 'FAQ' },
  visible.contact && { href: '/#contact', libelle: 'Contact' },
].filter((lien): lien is { href: string; libelle: string } => Boolean(lien));
