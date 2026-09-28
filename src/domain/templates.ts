// Modèles de messages et moteur de variables.
//
// Règle anti-invention : une ligne qui utilise une variable inconnue pour ce prospect est SUPPRIMÉE
// du message (au lieu d'afficher un vide ou une donnée devinée). `{{var|repli}}` utilise le repli.
import type { MessageTemplate, Prospect, Settings, TemplateCategory } from './types';
import { SERVICE_LABEL } from './referentials';

export const VARIABLES = [
  { key: 'prenom', label: 'Prénom du contact' },
  { key: 'entreprise', label: 'Nom de l’entreprise' },
  { key: 'ville', label: 'Ville' },
  { key: 'nombre_avis', label: "Nombre d'avis Google" },
  { key: 'note_google', label: 'Note Google' },
  { key: 'site', label: 'Site internet' },
  { key: 'activite', label: 'Activité / prestations' },
  { key: 'nom_saas', label: 'Nom du SaaS' },
  { key: 'signature', label: 'Signature' },
] as const;

export type VariableKey = (typeof VARIABLES)[number]['key'];

export function variablesFor(p: Prospect, s: Pick<Settings, 'saasName' | 'signature'>): Record<VariableKey, string | null> {
  const fr = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);
  const activity = p.services.length ? p.services.slice(0, 3).map((x) => SERVICE_LABEL[x].toLowerCase()).join(', ') : (p.activity?.toLowerCase() ?? null);
  return {
    prenom: p.contactFirstName,
    entreprise: p.tradeName ?? p.name,
    ville: p.city,
    nombre_avis: p.googleReviews !== null ? fr(p.googleReviews) : null,
    note_google: p.googleRating !== null ? fr(p.googleRating) : null,
    site: p.website?.replace(/^https?:\/\/(www\.)?/, '') ?? null,
    activite: activity,
    nom_saas: s.saasName || null,
    signature: s.signature || null,
  };
}

const VAR_RE = /\{\{\s*([a-zé_]+)\s*(?:\|([^}]*))?\}\}/gi;

function norm(key: string) {
  return key.toLowerCase().replace('é', 'e');
}

export function renderTemplate(text: string, vars: Record<string, string | null>): string {
  const lines = text.split('\n').flatMap((line) => {
    let missing = false;
    const out = line.replace(VAR_RE, (_m, key: string, fallback?: string) => {
      const v = vars[norm(key)];
      if (v) return v;
      if (fallback !== undefined) return fallback;
      missing = true;
      return '';
    });
    return missing ? [] : [out.replace(/[ \t]+([,.!?;:])/g, '$1').replace(/[ \t]{2,}/g, ' ')];
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function templateVariablesUsed(text: string): string[] {
  return Array.from(text.matchAll(VAR_RE), (m) => norm(m[1]!));
}

type Builtin = Pick<MessageTemplate, 'name' | 'category' | 'subject' | 'body'>;

const V: Record<TemplateCategory, Builtin> = {
  first_contact: {
    name: 'Premier contact',
    category: 'first_contact',
    subject: 'Un outil de devis pensé pour les paysagistes',
    body: `Bonjour {{prenom|}},

Je me permets de vous contacter car je développe {{nom_saas}}, un outil spécialement pensé pour les entreprises de paysagisme.
Votre activité ({{activite}}) correspond exactement aux entreprises pour lesquelles je l'ai conçu.

L'objectif est de simplifier la création de devis, le suivi des clients et la gestion commerciale, directement depuis le chantier.

Si le sujet vous intéresse, je peux vous montrer rapidement comment cela fonctionne.

Bonne journée,
{{signature}}`,
  },
  follow_up_1: {
    name: 'Relance 1',
    category: 'follow_up_1',
    subject: 'Re : {{nom_saas}} pour {{entreprise}}',
    body: `Bonjour {{prenom|}},

Je reviens vers vous au sujet de mon précédent message sur {{nom_saas}}.
Est-ce que simplifier vos devis et le suivi de vos clients est un sujet pour vous en ce moment ?

Une démonstration prend une quinzaine de minutes.

Bonne journée,
{{signature}}`,
  },
  follow_up_2: {
    name: 'Relance 2',
    category: 'follow_up_2',
    subject: '{{entreprise}} : 15 minutes pour découvrir {{nom_saas}} ?',
    body: `Bonjour {{prenom|}},

Je me permets une dernière relance : {{nom_saas}} permet de préparer un devis paysagiste sur place, avec photos et mesures, puis de l'envoyer au client pour signature.

Si ce n'est pas le bon moment, dites-le-moi simplement et je ne vous relancerai pas.

{{signature}}`,
  },
  follow_up_3: {
    name: 'Relance 3',
    category: 'follow_up_3',
    subject: 'Je clôture mon suivi',
    body: `Bonjour {{prenom|}},

Sans retour de votre part, je clôture mon suivi pour ne pas vous importuner.
Si le sujet devient d'actualité, vous pouvez me répondre à tout moment.

Belle continuation à {{entreprise}},
{{signature}}`,
  },
  demo_invite: {
    name: 'Invitation démo',
    category: 'demo_invite',
    subject: 'Démonstration de {{nom_saas}}',
    body: `Bonjour {{prenom|}},

Merci pour votre retour. Je vous propose une démonstration de {{nom_saas}} d'environ 15 minutes, en visio ou par téléphone.
Quels jours vous conviendraient le mieux cette semaine ou la suivante ?

{{signature}}`,
  },
  after_demo: {
    name: 'Après démo',
    category: 'after_demo',
    subject: 'Suite à notre démonstration',
    body: `Bonjour {{prenom|}},

Merci pour le temps accordé aujourd'hui.
Comme convenu, vous pouvez essayer {{nom_saas}} gratuitement avec vos propres chantiers. Je reste disponible pour toute question.

{{signature}}`,
  },
  trial: {
    name: 'Essai gratuit',
    category: 'trial',
    subject: 'Votre essai de {{nom_saas}}',
    body: `Bonjour {{prenom|}},

Comment se passe votre essai de {{nom_saas}} ?
Si un point vous bloque (catalogue, devis, envoi au client), je peux vous aider en quelques minutes.

{{signature}}`,
  },
  reactivation: {
    name: 'Réactivation',
    category: 'reactivation',
    subject: 'Des nouvelles de {{nom_saas}}',
    body: `Bonjour {{prenom|}},

Nous avions échangé il y a quelque temps au sujet de {{nom_saas}}. L'outil a beaucoup évolué depuis.
Seriez-vous ouvert à un nouvel échange rapide ?

{{signature}}`,
  },
  short: {
    name: 'Message court',
    category: 'short',
    subject: '',
    body: `Bonjour, je développe {{nom_saas}}, un outil de devis pensé pour les paysagistes. Seriez-vous d'accord pour une démo de 15 min ? {{signature}}`,
  },
};

export function builtInTemplates(): Builtin[] {
  return Object.values(V);
}

/** Tutoiement : adaptation automatique des formules du vouvoiement. */
export function toInformal(text: string): string {
  const rules: [RegExp, string][] = [
    [/Je me permets de vous contacter/g, 'Je me permets de te contacter'],
    [/\bvous intéresse\b/g, "t'intéresse"],
    [/\bvous montrer\b/g, 'te montrer'],
    [/\bvous importuner\b/g, "t'importuner"],
    [/\bvous relancerai\b/g, 'te relancerai'],
    [/\bvous pouvez\b/gi, 'tu peux'],
    [/\bvous propose\b/g, 'te propose'],
    [/\bvous conviendraient\b/g, 'te conviendraient'],
    [/\bvous aider\b/g, "t'aider"],
    [/\bvous bloque\b/g, 'te bloque'],
    [/\bSeriez-vous\b/g, 'Serais-tu'],
    [/\bvotre essai\b/gi, 'ton essai'],
    [/\bvotre retour\b/g, 'ton retour'],
    [/\bvotre part\b/g, 'ta part'],
    [/\bvos propres\b/g, 'tes propres'],
    [/\bvos devis\b/g, 'tes devis'],
    [/\bvos clients\b/g, 'tes clients'],
    [/\bvous\b/g, 'toi'],
    [/\bvotre\b/g, 'ton'],
    [/\bvos\b/g, 'tes'],
    [/dites-le-moi/g, 'dis-le-moi'],
  ];
  return rules.reduce((t, [re, s]) => t.replace(re, s), text);
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
