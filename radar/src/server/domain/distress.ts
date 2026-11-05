/**
 * Analyse spécifique des entreprises en difficulté et checklists de due diligence.
 * Contenu informatif : il ne remplace pas l'avis d'un avocat, d'un administrateur judiciaire ou d'un expert-comptable.
 * Règle : aucune hypothèse automatique sur la reprise ou l'exclusion des dettes et des contrats — le jugement
 * arrêtant le plan, l'ordonnance du juge-commissaire ou l'acte de cession en décident ; le point est toujours
 * présenté « à vérifier ».
 */
import type { ProcStatus, ProcType } from './proceedings';

export interface AcquisitionMode {
  key: 'titres' | 'fonds' | 'actifs' | 'branche' | 'contrats' | 'clientele';
  label: string;
  applicability: 'possible' | 'a_verifier' | 'peu_probable';
  explanation: string;
  points: string[];
}

export interface DistressAnalysis {
  context: string;
  modes: AcquisitionMode[];
  risks: { key: string; label: string; detail: string }[];
  checklist: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "Informations générales sur le droit des entreprises en difficulté (Code de commerce, livre VI). Les modalités exactes (périmètre cédé, contrats et salariés repris, sûretés) sont fixées par le tribunal ou le juge-commissaire : à faire valider par un avocat et auprès de l'administrateur ou du liquidateur désigné.";

export function analyzeDistress(proc: { type: ProcType; status: ProcStatus } | null, ctx: { isIndividual: boolean | null; headcount: number | null }): DistressAnalysis {
  const t = proc?.type;
  const liq = t === 'liquidation';
  const rj = t === 'redressement';
  const sauv = t === 'sauvegarde' || t === 'conciliation';
  const modes: AcquisitionMode[] = [
    {
      key: 'titres',
      label: 'Rachat de titres',
      applicability: ctx.isIndividual ? 'peu_probable' : liq ? 'peu_probable' : sauv ? 'possible' : 'a_verifier',
      explanation: ctx.isIndividual
        ? "Entreprise individuelle : pas de titres, seule la reprise du fonds ou des actifs est envisageable."
        : liq
          ? "En liquidation, la société est vouée à disparaître : la reprise porte sur l'activité ou les actifs, pas sur les titres."
          : "L'acquéreur reprend la société avec l'ensemble de son passif : le passif déclaré et le plan en cours doivent être analysés précisément.",
      points: ['Passif déclaré à la procédure et échéancier du plan', 'Garanties d\'actif et de passif (rarement obtenues en contexte de difficulté)', 'Accord des associés cédants'],
    },
    {
      key: 'fonds',
      label: 'Rachat du fonds de commerce',
      applicability: rj || liq ? 'possible' : 'a_verifier',
      explanation: rj || liq
        ? "Possible dans le cadre d'un plan de cession (offre déposée auprès de l'administrateur ou du liquidateur dans le délai fixé) ou d'une cession d'actifs autorisée par le juge-commissaire."
        : 'Cession amiable du fonds possible hors procédure ; en sauvegarde, une cession partielle relève du plan.',
      points: ['Droit au bail : transférabilité et accord éventuel du bailleur à vérifier', 'Éléments incorporels : clientèle, nom commercial, site internet, numéros de téléphone', 'Matériel inclus et état réel'],
    },
    {
      key: 'actifs',
      label: "Rachat d'actifs isolés",
      applicability: liq ? 'possible' : 'a_verifier',
      explanation: liq
        ? 'En liquidation, les actifs (matériel, véhicules, stocks, marques) peuvent être vendus séparément, souvent aux enchères ou de gré à gré sur autorisation du juge-commissaire.'
        : 'Possible ponctuellement avec autorisation ; plus fréquent en liquidation.',
      points: ['Inventaire et prisée des actifs', 'Sûretés et gages inscrits sur les biens', 'Coûts d\'enlèvement, de remise en état et de remise en service'],
    },
    {
      key: 'branche',
      label: "Reprise d'une branche d'activité",
      applicability: rj || liq ? 'possible' : 'a_verifier',
      explanation: "Un plan de cession peut porter sur une branche complète et autonome d'activité ; le périmètre est défini dans l'offre et arrêté par le tribunal.",
      points: ['Autonomie réelle de la branche (personnel, clients, moyens)', 'Salariés rattachés à la branche'],
    },
    {
      key: 'contrats',
      label: 'Reprise de contrats',
      applicability: 'a_verifier',
      explanation:
        "Les contrats ne sont jamais repris automatiquement : en plan de cession, le tribunal détermine ceux qui sont cédés (contrats nécessaires au maintien de l'activité) ; hors plan, l'accord du cocontractant est en principe requis.",
      points: ['Liste des contrats visés dans l\'offre', 'Clauses d\'incessibilité ou intuitu personae', 'Contrats de crédit-bail et de location'],
    },
    {
      key: 'clientele',
      label: 'Reprise de clientèle',
      applicability: 'a_verifier',
      explanation: "La clientèle suit le fonds ; sa conservation dépend de la continuité du service et des relations personnelles avec l'ancien dirigeant. Le transfert de fichiers clients contenant des données personnelles doit respecter le RGPD.",
      points: ['Chiffre d\'affaires par client et concentration', 'Engagements de non-concurrence', 'Base légale du transfert des fichiers clients'],
    },
  ];

  const risks = [
    { key: 'dettes', label: 'Dettes', detail: rj || liq ? 'Le sort du passif dépend du mode de reprise : à vérifier dans le jugement ou l\'acte de cession (charges éventuellement transmises, sûretés).' : 'En reprise de titres, l\'acquéreur supporte l\'ensemble du passif existant.' },
    { key: 'social', label: 'Passif social', detail: ctx.headcount ? `Environ ${ctx.headcount} salarié(s) (tranche INSEE) : contrats repris selon le plan ou le Code du travail, congés payés et ancienneté à chiffrer.` : 'Effectif à confirmer : contrats repris, congés payés, ancienneté.' },
    { key: 'litiges', label: 'Litiges', detail: 'Litiges en cours (clients, fournisseurs, prud\'hommes, administration) à recenser auprès de l\'administrateur ou du liquidateur.' },
    { key: 'contrats', label: 'Contrats en cours', detail: 'Bail, crédit-bail, locations, contrats clients et fournisseurs : transférabilité à vérifier un par un.' },
    { key: 'fiscal', label: 'Obligations fiscales et sociales', detail: 'Situation vis-à-vis des impôts et de l\'URSSAF, solidarité éventuelle du cessionnaire selon le mode de cession.' },
    { key: 'materiel', label: 'Matériel vétuste', detail: 'Visite physique indispensable : âge, entretien, conformité et coût de remplacement.' },
    { key: 'dirigeant', label: 'Dépendance au dirigeant', detail: 'Savoir-faire et relations clients concentrés sur l\'ancien dirigeant : prévoir une transition si possible.' },
    { key: 'clientele', label: 'Perte de clientèle', detail: 'La procédure collective, une fois publiée, peut faire fuir clients et fournisseurs : vérifier le carnet de commandes actuel.' },
    { key: 'relance', label: 'Coûts de remise en activité', detail: 'Reconstitution des stocks, BFR, réembauches, communication auprès des clients, remise à niveau du matériel.' },
  ];

  const checklist = [
    'Obtenir le jugement d\'ouverture et identifier l\'administrateur, le mandataire ou le liquidateur (BODACC, greffe du tribunal de commerce).',
    "Demander le dossier de présentation (data room) et la date limite de dépôt des offres de reprise.",
    'Obtenir les trois derniers bilans, la situation comptable récente et le carnet de commandes.',
    'Lister les actifs (inventaire, prisée), les sûretés inscrites et les biens en crédit-bail ou en location.',
    'Lister les contrats nécessaires à l\'activité et vérifier leur transférabilité (bail, fournisseurs clés, clients).',
    'Recenser les salariés (registre du personnel, contrats, ancienneté, congés) et les postes repris dans l\'offre.',
    'Identifier les litiges et contentieux en cours.',
    'Vérifier autorisations, agréments, certifications et assurances nécessaires à l\'exploitation.',
    'Vérifier la propriété des éléments incorporels : marque, nom de domaine, logiciels, fichiers clients (RGPD).',
    'Chiffrer le besoin de financement total : prix, frais, BFR, investissements, trésorerie de démarrage.',
    "Préparer une offre conforme (périmètre, prix, emplois maintenus, garanties de financement, modalités).",
    'Faire relire l\'offre par un avocat ; vérifier les restrictions applicables aux dirigeants et à leurs proches.',
  ];

  const context = !proc
    ? 'Aucune procédure collective en cours connue.'
    : `${t === 'liquidation' ? 'Liquidation judiciaire' : t === 'redressement' ? 'Redressement judiciaire' : t === 'sauvegarde' ? 'Procédure de sauvegarde' : 'Procédure'} — statut : ${proc.status.replace('_', ' ')}.`;
  return { context, modes, risks, checklist, disclaimer: DISCLAIMER };
}

/** Informations à demander au vendeur et points à vérifier avant de signer (reprise amiable). */
export const SELLER_REQUESTS = [
  'Liasses fiscales complètes des 3 à 5 derniers exercices et situation intermédiaire de l\'exercice en cours',
  'Détail du chiffre d\'affaires par client (concentration, top 10) et par activité',
  'Contrats clients récurrents (durée, préavis, clause de changement de contrôle)',
  'Rémunération et avantages du dirigeant (pour retraiter l\'EBE)',
  'Registre du personnel, contrats de travail, ancienneté, accords collectifs',
  'Bail commercial (durée restante, loyer, clause de cession) et état des locaux',
  'Liste et état du matériel, véhicules, crédits-baux',
  'Endettement : tableaux d\'amortissement, cautions et garanties données',
  'Litiges en cours ou menaces de litiges',
  'Certifications, assurances, autorisations d\'exercice',
  'Carnet de commandes et devis en cours',
  'Raisons de la cession et disponibilité du cédant pour accompagner la transition',
];

export const BEFORE_SIGNING = [
  'Audit comptable et financier (retraitement de l\'EBE, qualité des créances, stocks)',
  'Audit juridique (statuts, contrats, propriété intellectuelle, conformité RGPD)',
  'Audit social (contrats, risques prud\'homaux, URSSAF)',
  'Audit fiscal (contrôles récents, crédits d\'impôt)',
  'Garantie d\'actif et de passif et son plafond, avec garantie bancaire si possible',
  'Clause de non-concurrence et accompagnement du cédant',
  'Conditions suspensives (financement, agrément du bailleur, accord des partenaires clés)',
  'Plan de financement validé par la banque et prévisionnel sur 3 ans',
];
