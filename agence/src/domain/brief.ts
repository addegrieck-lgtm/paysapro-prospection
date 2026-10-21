/**
 * Cahier des charges client : questionnaire guidé, adapté aux prestations choisies (site, identité visuelle, impression).
 * Le questionnaire est décrit ici (données pures) ; l'affichage (espace client) et la restitution (administration)
 * s'appuient uniquement sur cette description. Ajouter une question = l'ajouter ici.
 */

export type BriefModule = 'site' | 'identite' | 'impression';

export const BRIEF_MODULES: { id: BriefModule; label: string; hint: string }[] = [
  { id: 'site', label: 'Site internet', hint: 'Création ou refonte de votre site' },
  { id: 'identite', label: 'Logo et identité visuelle', hint: 'Logo, couleurs, typographies et déclinaisons' },
  { id: 'impression', label: 'Impression et signalétique', hint: 'Flyers, cartes, brochures, vitrine, enseigne, véhicule' },
];

export type Answers = Record<string, string | string[]>;

/** Condition d'affichage : la réponse à `q` contient l'une des valeurs `in`. */
export interface ShowIf {
  q: string;
  in: string[];
}

export interface Question {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox';
  help?: string;
  placeholder?: string;
  options?: string[];
  /** Case « Autre » avec champ libre pour les choix multiples. */
  other?: boolean;
  showIf?: ShowIf;
}

export interface Section {
  id: string;
  module: BriefModule | 'commun';
  title: string;
  intro?: string;
  showIf?: ShowIf;
  questions: Question[];
}

const YES_NO = ['Oui', 'Non'];
const AMBIANCES = ['Sobre et élégant', 'Moderne et épuré', 'Chaleureux et artisanal', 'Coloré et dynamique', 'Haut de gamme', 'Technique et sérieux', 'Naturel', 'Ludique'];
const PHOTOS = ['J’ai des photos de bonne qualité', 'J’ai quelques photos, à compléter', 'Je n’ai pas de photos (banque d’images ou reportage photo à prévoir)'];

export const BRIEF_SECTIONS: Section[] = [
  // ─── Commun ───
  {
    id: 'entreprise',
    module: 'commun',
    title: 'Votre entreprise',
    intro: 'Quelques questions pour bien comprendre votre activité. Répondez simplement, avec vos mots : il n’y a pas de mauvaise réponse.',
    questions: [
      { id: 'entreprise_nom', type: 'text', label: 'Nom de l’entreprise, tel qu’il doit apparaître', placeholder: 'Ex. : Menuiserie Durand' },
      {
        id: 'activite',
        type: 'textarea',
        label: 'Votre activité en quelques phrases',
        help: 'Ce que vous faites, pour qui, et ce qui vous distingue.',
        placeholder: 'Ex. : Menuisier depuis 15 ans, je fabrique et pose des cuisines et escaliers sur mesure en bois massif, pour les particuliers du Pays de Caux.',
      },
      { id: 'anciennete', type: 'radio', label: 'Depuis quand existe votre entreprise ?', options: ['En cours de création', 'Moins de 2 ans', '2 à 10 ans', 'Plus de 10 ans'] },
      {
        id: 'zone',
        type: 'radio',
        label: 'Où se trouvent vos clients ?',
        options: ['Dans ma commune et alentours', 'Dans le département', 'Dans la région', 'Partout en France', 'Aussi à l’étranger'],
      },
      { id: 'zone_detail', type: 'text', label: 'Communes ou secteurs principaux', placeholder: 'Ex. : Bolbec, Lillebonne, Le Havre' },
      {
        id: 'points_forts',
        type: 'textarea',
        label: 'Vos 3 points forts',
        help: 'Ce que vos clients apprécient le plus chez vous.',
        placeholder: 'Ex. : devis sous 48 h, travail soigné, artisan certifié RGE',
      },
    ],
  },
  {
    id: 'clients',
    module: 'commun',
    title: 'Vos clients',
    questions: [
      { id: 'cible_type', type: 'checkbox', label: 'Vous travaillez pour…', options: ['Des particuliers', 'Des professionnels', 'Des collectivités ou associations'] },
      {
        id: 'cible_profil',
        type: 'textarea',
        label: 'Décrivez votre client type',
        help: 'Âge, situation, ce qu’il recherche, ce qui le décide à vous choisir.',
        placeholder: 'Ex. : propriétaires de 35 à 60 ans qui rénovent leur maison et veulent du sur-mesure durable.',
      },
      {
        id: 'canaux',
        type: 'checkbox',
        label: 'Comment vos clients vous trouvent-ils aujourd’hui ?',
        options: ['Bouche-à-oreille', 'Recherche Google', 'Fiche Google (Maps)', 'Réseaux sociaux', 'Annuaires (PagesJaunes…)', 'Flyers ou presse locale', 'Salons et événements', 'Passage devant mon local'],
        other: true,
      },
      {
        id: 'concurrents',
        type: 'textarea',
        label: 'Concurrents ou confrères que vous connaissez',
        help: 'Leur nom ou leur site. Dites ce que vous faites mieux qu’eux, si vous le savez.',
      },
    ],
  },

  // ─── Site internet ───
  {
    id: 'site_objectifs',
    module: 'site',
    title: 'Votre site : les objectifs',
    questions: [
      { id: 'site_existant', type: 'radio', label: 'Avez-vous déjà un site internet ?', options: YES_NO },
      { id: 'site_url', type: 'text', label: 'Son adresse', placeholder: 'https://…', showIf: { q: 'site_existant', in: ['Oui'] } },
      {
        id: 'site_avis',
        type: 'textarea',
        label: 'Ce qui vous plaît, et ce qui ne vous plaît plus, dans ce site',
        showIf: { q: 'site_existant', in: ['Oui'] },
      },
      {
        id: 'objectifs',
        type: 'checkbox',
        label: 'À quoi doit servir votre site ?',
        help: 'Cochez tout ce qui compte pour vous.',
        options: [
          'Être trouvé sur Google',
          'Présenter mon activité et rassurer',
          'Recevoir des demandes de devis',
          'Prendre des rendez-vous en ligne',
          'Vendre en ligne',
          'Montrer mes réalisations',
          'Informer (horaires, actualités)',
          'Recruter',
        ],
        other: true,
      },
      {
        id: 'action_visiteur',
        type: 'radio',
        label: 'Après avoir visité votre site, le visiteur doit surtout…',
        options: ['M’appeler', 'Demander un devis', 'Réserver un rendez-vous', 'Acheter en ligne', 'Venir sur place'],
      },
    ],
  },
  {
    id: 'site_contenu',
    module: 'site',
    title: 'Votre site : les pages et le contenu',
    questions: [
      {
        id: 'pages',
        type: 'checkbox',
        label: 'Quelles pages souhaitez-vous ?',
        help: 'Les mentions légales et la politique de confidentialité sont toujours incluses.',
        options: ['Accueil', 'Qui sommes-nous', 'Une page par prestation', 'Réalisations / galerie', 'Tarifs', 'Avis clients', 'Actualités / blog', 'Questions fréquentes', 'Contact et plan d’accès'],
        other: true,
      },
      {
        id: 'prestations_liste',
        type: 'textarea',
        label: 'Listez vos prestations ou produits à présenter',
        placeholder: 'Ex. : cuisines sur mesure, escaliers, dressings, parquets, fenêtres bois',
      },
      {
        id: 'textes',
        type: 'radio',
        label: 'Pour les textes du site…',
        options: ['Je fournis tous les textes', 'Je donne les grandes lignes, vous rédigez', 'Vous rédigez tout (après un échange)'],
      },
      { id: 'photos_site', type: 'radio', label: 'Pour les photos…', options: PHOTOS },
      { id: 'langues', type: 'checkbox', label: 'Langues du site', options: ['Français', 'Anglais'], other: true },
    ],
  },
  {
    id: 'site_fonctions',
    module: 'site',
    title: 'Votre site : les fonctionnalités',
    questions: [
      {
        id: 'fonctions',
        type: 'checkbox',
        label: 'De quoi avez-vous besoin ?',
        options: [
          'Formulaire de contact',
          'Demande de devis détaillée',
          'Prise de rendez-vous',
          'Boutique en ligne',
          'Paiement en ligne',
          'Galerie photos',
          'Avis Google affichés',
          'Carte et plan d’accès',
          'Inscription à une newsletter',
          'Bouton d’appel ou WhatsApp',
          'Documents à télécharger',
          'Liens vers mes réseaux sociaux',
        ],
        other: true,
      },
      { id: 'boutique_produits', type: 'text', label: 'Combien de produits à vendre, environ ?', showIf: { q: 'fonctions', in: ['Boutique en ligne'] } },
      {
        id: 'outils',
        type: 'textarea',
        label: 'Outils que vous utilisez déjà et qu’il faudrait relier au site',
        help: 'Agenda en ligne, logiciel de devis, caisse, plateforme de réservation…',
      },
      {
        id: 'gestion',
        type: 'radio',
        label: 'Après la mise en ligne…',
        options: ['Je veux modifier moi-même textes et photos', 'Je préfère que vous fassiez les modifications (forfait)', 'Les deux'],
      },
    ],
  },
  {
    id: 'site_style',
    module: 'site',
    title: 'Votre site : le style',
    questions: [
      { id: 'site_ambiance', type: 'checkbox', label: 'Quelle ambiance pour votre site ?', options: AMBIANCES },
      {
        id: 'sites_aimes',
        type: 'textarea',
        label: '2 ou 3 sites que vous aimez, et pourquoi',
        help: 'Même hors de votre métier : une couleur, une mise en page, une façon de présenter.',
        placeholder: 'Adresse du site + ce qui vous plaît',
      },
      { id: 'sites_pas_aimes', type: 'textarea', label: 'Ce que vous ne voulez surtout pas', placeholder: 'Ex. : trop de texte, couleurs criardes, animations' },
      {
        id: 'charte',
        type: 'radio',
        label: 'Avez-vous déjà un logo et des couleurs ?',
        options: ['Oui, à respecter', 'Oui, mais à moderniser', 'Non, il faut les créer'],
      },
    ],
  },
  {
    id: 'site_technique',
    module: 'site',
    title: 'Votre site : nom de domaine et référencement',
    intro: 'Si vous ne savez pas répondre, cochez « Je ne sais pas » : nous nous en occupons.',
    questions: [
      { id: 'domaine', type: 'radio', label: 'Nom de domaine (adresse du site)', options: ['J’en ai déjà un', 'Il faut le réserver', 'Je ne sais pas'] },
      { id: 'domaine_nom', type: 'text', label: 'Lequel ?', placeholder: 'Ex. : menuiserie-durand.fr', showIf: { q: 'domaine', in: ['J’en ai déjà un'] } },
      { id: 'domaine_souhait', type: 'text', label: 'Adresse souhaitée (si vous avez une idée)', placeholder: 'Ex. : menuiserie-durand.fr', showIf: { q: 'domaine', in: ['Il faut le réserver'] } },
      { id: 'emails', type: 'radio', label: 'Adresses e-mail professionnelles (contact@…)', options: ['J’en ai déjà', 'À créer', 'Pas besoin'] },
      {
        id: 'mots_cles',
        type: 'textarea',
        label: 'Que tapent vos clients sur Google pour trouver une entreprise comme la vôtre ?',
        placeholder: 'Ex. : menuisier Bolbec, escalier sur mesure Le Havre, cuisine bois Pays de Caux',
      },
      { id: 'fiche_google', type: 'radio', label: 'Avez-vous une fiche Google (Google Maps) ?', options: ['Oui', 'Non', 'Je ne sais pas'] },
    ],
  },

  // ─── Identité visuelle ───
  {
    id: 'identite_image',
    module: 'identite',
    title: 'Votre identité : votre image',
    questions: [
      { id: 'nom_definitif', type: 'radio', label: 'Le nom de l’entreprise est-il définitif ?', options: ['Oui', 'Il peut encore évoluer', 'Nous cherchons aussi un nom'] },
      { id: 'slogan', type: 'text', label: 'Slogan ou phrase d’accroche (si vous en avez une)', placeholder: 'Ex. : Le bois, sur mesure' },
      { id: 'logo_existant', type: 'radio', label: 'Votre logo actuel', options: ['Je n’ai pas de logo', 'Il est à moderniser', 'Il est à refaire entièrement'] },
      { id: 'logo_garder', type: 'textarea', label: 'Ce que vous voulez garder de votre logo actuel', showIf: { q: 'logo_existant', in: ['Il est à moderniser'] } },
      {
        id: 'valeurs',
        type: 'checkbox',
        label: 'Les valeurs que votre image doit transmettre',
        options: ['Confiance', 'Savoir-faire', 'Proximité', 'Qualité haut de gamme', 'Prix accessibles', 'Modernité', 'Tradition', 'Écologie', 'Rapidité', 'Convivialité'],
        other: true,
      },
      { id: 'trois_mots', type: 'text', label: '3 mots que vos clients devraient associer à votre entreprise', placeholder: 'Ex. : solide, chaleureux, précis' },
    ],
  },
  {
    id: 'identite_style',
    module: 'identite',
    title: 'Votre identité : le style',
    questions: [
      {
        id: 'style_logo',
        type: 'radio',
        label: 'Quel type de logo vous attire ?',
        help: 'Pas d’idée ? Choisissez « Conseillez-moi ».',
        options: ['Le nom seul, joliment dessiné', 'Un symbole et le nom', 'Un badge ou emblème', 'Conseillez-moi'],
      },
      { id: 'identite_ambiance', type: 'checkbox', label: 'Ambiance recherchée', options: AMBIANCES },
      { id: 'couleurs_aimees', type: 'text', label: 'Couleurs souhaitées', placeholder: 'Ex. : vert sapin, bois, crème' },
      { id: 'couleurs_exclues', type: 'text', label: 'Couleurs à éviter', placeholder: 'Ex. : rouge (couleur de mon concurrent)' },
      { id: 'logos_aimes', type: 'textarea', label: 'Logos que vous aimez (n’importe quelle marque), et pourquoi' },
      { id: 'identite_eviter', type: 'textarea', label: 'Ce que vous ne voulez surtout pas', placeholder: 'Ex. : un dessin de maison, trop de détails' },
    ],
  },
  {
    id: 'identite_declinaisons',
    module: 'identite',
    title: 'Votre identité : les déclinaisons',
    questions: [
      {
        id: 'supports_identite',
        type: 'checkbox',
        label: 'Où votre logo sera-t-il utilisé ?',
        options: ['Cartes de visite', 'Devis et factures', 'Signature e-mail', 'Site internet', 'Réseaux sociaux', 'Véhicule', 'Vitrine ou enseigne', 'Vêtements de travail', 'Tampon', 'Emballages'],
        other: true,
      },
      {
        id: 'charte_complete',
        type: 'radio',
        label: 'Souhaitez-vous un guide d’utilisation (couleurs, typographies, règles) ?',
        options: ['Oui, une charte graphique complète', 'Non, le logo et ses couleurs suffisent', 'Je ne sais pas'],
      },
    ],
  },

  // ─── Impression et signalétique ───
  {
    id: 'impression_supports',
    module: 'impression',
    title: 'Impression : vos supports',
    questions: [
      {
        id: 'supports_print',
        type: 'checkbox',
        label: 'De quels supports avez-vous besoin ?',
        options: [
          'Flyers',
          'Cartes de visite',
          'Dépliants',
          'Affiches',
          'Brochure ou catalogue',
          'Roll-up ou kakémono',
          'Bâche',
          'Autocollants ou étiquettes',
          'Vitrophanie (vitrine)',
          'Enseigne ou panneau',
          'Marquage de véhicule',
        ],
        other: true,
      },
      {
        id: 'usage_print',
        type: 'textarea',
        label: 'À quoi serviront-ils ?',
        placeholder: 'Ex. : distribution en boîtes aux lettres, salon de l’habitat en mars, ouverture du magasin',
      },
      {
        id: 'quantites',
        type: 'textarea',
        label: 'Quantités et formats envisagés',
        help: 'Une estimation suffit, nous vous conseillerons.',
        placeholder: 'Ex. : 2 000 flyers A5 recto-verso, 500 cartes de visite',
      },
      {
        id: 'creation_print',
        type: 'radio',
        label: 'Pour la mise en page…',
        options: ['Création graphique complète', 'Adaptation d’un document existant', 'J’ai déjà le fichier prêt, impression seule'],
      },
    ],
  },
  {
    id: 'impression_contenu',
    module: 'impression',
    title: 'Impression : le contenu',
    showIf: { q: 'creation_print', in: ['Création graphique complète', 'Adaptation d’un document existant'] },
    questions: [
      { id: 'messages_print', type: 'textarea', label: 'Les messages à faire passer', placeholder: 'Ex. : -10 % sur la pose jusqu’au 30 juin, nos 3 prestations, devis gratuit' },
      {
        id: 'infos_print',
        type: 'checkbox',
        label: 'Informations à faire figurer',
        options: ['Logo', 'Téléphone', 'E-mail', 'Adresse', 'Site internet', 'QR code', 'Horaires', 'Réseaux sociaux', 'Plan d’accès', 'Prix ou offre'],
      },
      { id: 'photos_print', type: 'radio', label: 'Pour les photos…', options: PHOTOS },
      { id: 'finitions', type: 'checkbox', label: 'Finitions souhaitées', options: ['Papier épais / premium', 'Pelliculage mat (toucher doux)', 'Vernis sélectif', 'Papier recyclé', 'Pas de préférence, conseillez-moi'] },
    ],
  },
  {
    id: 'impression_pose',
    module: 'impression',
    title: 'Signalétique : le lieu et la pose',
    intro: 'Des photos du lieu ou du véhicule nous aideront beaucoup : vous pourrez les ajouter à la dernière étape.',
    showIf: { q: 'supports_print', in: ['Vitrophanie (vitrine)', 'Enseigne ou panneau', 'Marquage de véhicule', 'Bâche'] },
    questions: [
      { id: 'adresse_pose', type: 'text', label: 'Adresse du lieu', placeholder: 'Rue, code postal, commune' },
      {
        id: 'dimensions',
        type: 'textarea',
        label: 'Dimensions (largeur × hauteur) des vitres, murs ou panneaux',
        help: 'Mesures approximatives : nous vérifierons sur place.',
        placeholder: 'Ex. : vitrine 240 × 180 cm, porte 90 × 210 cm',
      },
      { id: 'vehicule', type: 'text', label: 'Véhicule à marquer (marque, modèle, couleur)', showIf: { q: 'supports_print', in: ['Marquage de véhicule'] } },
      { id: 'pose', type: 'radio', label: 'Pour la pose…', options: ['Je souhaite que vous la réalisiez', 'Je pose moi-même', 'À discuter'] },
      {
        id: 'contraintes',
        type: 'textarea',
        label: 'Contraintes à connaître',
        help: 'Copropriété, autorisation de la mairie, hauteur, accès, bâtiment classé…',
      },
    ],
  },

  // ─── Commun (fin) ───
  {
    id: 'organisation',
    module: 'commun',
    title: 'Budget et délais',
    intro: 'Votre budget nous aide à vous proposer la solution la plus adaptée : il reste entre nous.',
    questions: [
      {
        id: 'budget',
        type: 'radio',
        label: 'Budget envisagé pour l’ensemble du projet',
        options: ['Moins de 500 €', '500 à 1 500 €', '1 500 à 3 000 €', '3 000 à 6 000 €', 'Plus de 6 000 €', 'Je ne sais pas encore'],
      },
      { id: 'echeance', type: 'radio', label: 'Pour quand ?', options: ['Dès que possible', 'Dans le mois', 'Dans 2 à 3 mois', 'Pas de date précise'] },
      { id: 'date_cle', type: 'text', label: 'Une date à ne pas manquer ?', placeholder: 'Ex. : ouverture le 15 mars, salon en avril' },
      { id: 'decideur', type: 'text', label: 'Qui valide les propositions de votre côté ?', placeholder: 'Nom et rôle' },
      { id: 'contact_prefere', type: 'checkbox', label: 'Comment préférez-vous échanger ?', options: ['Téléphone', 'E-mail', 'Rendez-vous sur place', 'Visio'] },
      { id: 'remarques', type: 'textarea', label: 'Autre chose à nous dire ?', help: 'Une idée, une crainte, une question : tout est utile.' },
    ],
  },
];

const asList = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

export const isShown = (cond: ShowIf | undefined, a: Answers) => !cond || asList(a[cond.q]).some((v) => cond.in.includes(v));

/** Étapes visibles pour les prestations choisies et les réponses déjà données. */
export function visibleSections(modules: BriefModule[], a: Answers): Section[] {
  return BRIEF_SECTIONS.filter((s) => (s.module === 'commun' || modules.includes(s.module)) && isShown(s.showIf, a));
}

const filled = (v: string | string[] | undefined) => asList(v).some((x) => x.trim() !== '');

/** Avancement : questions visibles ayant une réponse / questions visibles. */
export function briefProgress(modules: BriefModule[], a: Answers): { answered: number; total: number; percent: number } {
  let answered = 0;
  let total = 0;
  for (const s of visibleSections(modules, a)) {
    for (const q of s.questions) {
      if (!isShown(q.showIf, a)) continue;
      total++;
      if (filled(a[q.id])) answered++;
    }
  }
  return { answered, total, percent: total ? Math.round((answered / total) * 100) : 0 };
}

export const parseModules = (raw: string | string[] | undefined): BriefModule[] =>
  BRIEF_MODULES.map((m) => m.id).filter((id) => asList(raw).includes(id));

/**
 * Lit les réponses d'une étape envoyée par le client : seules les questions de l'étape sont acceptées, les choix doivent
 * appartenir à la liste proposée (sauf « Autre », saisi dans un champ libre). Les réponses des autres étapes sont conservées.
 */
export function readSectionAnswers(section: Section, form: { get: (k: string) => string; all: (k: string) => string[] }, previous: Answers): Answers {
  const next: Answers = { ...previous };
  for (const q of section.questions) {
    if (q.type === 'checkbox') {
      const picked = form.all(q.id).filter((v) => q.options?.includes(v));
      next[q.id] = picked;
    } else if (q.type === 'radio') {
      const v = form.get(q.id);
      next[q.id] = q.options?.includes(v) ? v : '';
    } else {
      next[q.id] = form.get(q.id).slice(0, q.type === 'textarea' ? 4000 : 300);
    }
    if (q.other) next[`${q.id}__autre`] = form.get(`${q.id}__autre`).slice(0, 300);
  }
  return next;
}

/** Réponse lisible (choix + « Autre »), vide si aucune réponse. */
export function answerText(q: Question, a: Answers): string {
  const parts = asList(a[q.id]).filter((x) => x.trim() !== '');
  const other = q.other ? String(a[`${q.id}__autre`] ?? '').trim() : '';
  if (other) parts.push(`Autre : ${other}`);
  return parts.join(q.type === 'checkbox' ? ' · ' : ' ');
}

export const BRIEF_STATUSES = [
  ['brouillon', 'Pas encore envoyé'],
  ['envoye', 'Envoyé au client'],
  ['en_cours', 'En cours de remplissage'],
  ['termine', 'Complété par le client'],
] as const satisfies readonly (readonly [string, string])[];
