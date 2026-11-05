/**
 * Procédures collectives : classification des jugements publiés au BODACC et reconstitution de l'état de chaque
 * procédure. L'état est recalculé en rejouant tous les jugements connus dans l'ordre chronologique : le résultat ne
 * dépend donc pas de l'ordre d'arrivée des annonces.
 *
 * Statuts :
 *  - ouverte          : jugement d'ouverture publié, aucun jugement ultérieur connu
 *  - en_cours         : procédure ouverte ayant connu des étapes ultérieures (dépôt des créances, prolongation…)
 *  - plan_arrete      : plan de sauvegarde ou de redressement arrêté (l'entreprise poursuit son activité)
 *  - cession_arretee  : plan de cession arrêté par le tribunal (actifs / activité cédés à un repreneur)
 *  - cloturee         : procédure terminée (clôture, fin, conversion en une autre procédure)
 */
export type ProcType = 'sauvegarde' | 'redressement' | 'liquidation' | 'conciliation' | 'retablissement' | 'autre';
export type ProcStatus = 'ouverte' | 'en_cours' | 'plan_arrete' | 'cession_arretee' | 'cloturee';
export type JudgmentKind =
  | 'ouverture'
  | 'conversion_liquidation'
  | 'plan'
  | 'plan_cession'
  | 'modification_plan'
  | 'resolution_plan'
  | 'cloture'
  | 'fin_procedure'
  | 'depot'
  | 'autre';

export interface JudgmentInput {
  date: string | null; // AAAA-MM-JJ
  famille?: string | null;
  nature?: string | null;
  complement?: string | null;
  tribunal?: string | null;
  url?: string | null;
  reference: string;
}

export interface ClassifiedJudgment {
  kind: JudgmentKind;
  procType: ProcType | null; // type de procédure concerné (null = non déterminable)
  closureReason: string | null;
  administrator: string | null;
  label: string;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function detectType(t: string): ProcType | null {
  if (/liquidation/.test(t)) return 'liquidation';
  if (/redressement/.test(t)) return 'redressement';
  if (/sauvegarde/.test(t)) return 'sauvegarde';
  if (/conciliation/.test(t)) return 'conciliation';
  if (/retablissement professionnel/.test(t)) return 'retablissement';
  return null;
}

/** Extrait, tel que publié, le passage désignant le mandataire, l'administrateur ou le liquidateur. */
export function extractAdministrator(complement: string | null | undefined): string | null {
  if (!complement) return null;
  const m = complement.match(/(?:d[ée]sign(?:ant|e|é)|nomm(?:ant|é))\s+(?:en qualit[ée] de\s+)?((?:mandataire|liquidateur|administrateur|commissaire)[^.]{3,240})/i)
    ?? complement.match(/((?:mandataire judiciaire|liquidateur(?: judiciaire)?|administrateur judiciaire|commissaire à l'exécution du plan)\s*:?\s+[^.]{3,240})/i);
  return m ? m[1]!.replace(/\s+/g, ' ').trim() : null;
}

export function classifyJudgment(j: Pick<JudgmentInput, 'famille' | 'nature' | 'complement'>): ClassifiedJudgment {
  const nature = j.nature ?? '';
  const famille = j.famille ?? '';
  const t = fold(`${nature} ${famille}`);
  const full = fold(`${nature} ${famille} ${j.complement ?? ''}`);
  const label = nature || famille || 'Jugement';
  const administrator = extractAdministrator(j.complement);
  const base = { label, administrator };

  // Ordre des tests : du plus spécifique au plus général.
  if (/resolution du plan/.test(t)) {
    return { ...base, kind: 'resolution_plan', procType: /liquidation/.test(full) ? 'liquidation' : detectType(t), closureReason: null };
  }
  if (/conversion|prononcant la liquidation|prononce la liquidation/.test(t) && /liquidation/.test(t)) {
    return { ...base, kind: 'conversion_liquidation', procType: 'liquidation', closureReason: null };
  }
  if (/cloture/.test(t)) {
    const reason = /insuffisance d.actif/.test(full)
      ? "Clôture pour insuffisance d'actif"
      : /extinction du passif/.test(full)
        ? 'Clôture pour extinction du passif'
        : 'Clôture de la procédure';
    return { ...base, kind: 'cloture', procType: detectType(t), closureReason: reason };
  }
  if (/mettant fin|met fin|fin de la procedure|fin a la procedure/.test(t)) {
    return { ...base, kind: 'fin_procedure', procType: detectType(t), closureReason: 'Fin de la procédure' };
  }
  if (/plan de cession|arretant le plan de cession|arrete le plan de cession/.test(t)) {
    return { ...base, kind: 'plan_cession', procType: detectType(t), closureReason: null };
  }
  if (/modifi\w* le plan|modification du plan/.test(t)) {
    return { ...base, kind: 'modification_plan', procType: detectType(t), closureReason: null };
  }
  if (/arretant le plan|arrete le plan|homologu/.test(t)) {
    return { ...base, kind: 'plan', procType: detectType(t), closureReason: null };
  }
  if (/ouverture|prononcant|prononce/.test(t)) {
    return { ...base, kind: 'ouverture', procType: detectType(t) ?? 'autre', closureReason: null };
  }
  if (/avis de depot|depot de l.etat|etat des creances|projet de repartition/.test(t)) {
    return { ...base, kind: 'depot', procType: detectType(full), closureReason: null };
  }
  return { ...base, kind: 'autre', procType: detectType(t), closureReason: null };
}

export interface ProceedingState {
  type: ProcType;
  status: ProcStatus;
  openedAt: string | null;
  lastEventAt: string | null;
  closedAt: string | null;
  closureReason: string | null;
  tribunal: string | null;
  latestNature: string;
  administrator: string | null;
  url: string | null;
  references: string[];
}

const OPEN_STATES: ProcStatus[] = ['ouverte', 'en_cours', 'plan_arrete', 'cession_arretee'];

/**
 * Reconstitue les procédures d'une entreprise à partir de ses jugements.
 * Une entreprise peut avoir connu plusieurs procédures successives (ex. sauvegarde clôturée puis liquidation).
 */
export function rebuildProceedings(judgments: JudgmentInput[]): ProceedingState[] {
  const sorted = [...judgments].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.reference.localeCompare(b.reference));
  const procs: ProceedingState[] = [];
  const current = (type?: ProcType | null) => {
    for (let i = procs.length - 1; i >= 0; i--) {
      const p = procs[i]!;
      if (OPEN_STATES.includes(p.status) && (!type || p.type === type)) return p;
    }
    return undefined;
  };
  const touch = (p: ProceedingState, j: JudgmentInput, c: ClassifiedJudgment) => {
    p.lastEventAt = j.date ?? p.lastEventAt;
    p.latestNature = c.label;
    p.tribunal = j.tribunal ?? p.tribunal;
    p.administrator = c.administrator ?? p.administrator;
    p.url = j.url ?? p.url;
    p.references.push(j.reference);
  };
  const open = (type: ProcType, j: JudgmentInput, c: ClassifiedJudgment) => {
    const p: ProceedingState = {
      type,
      status: 'ouverte',
      openedAt: j.date,
      lastEventAt: j.date,
      closedAt: null,
      closureReason: null,
      tribunal: j.tribunal ?? null,
      latestNature: c.label,
      administrator: c.administrator,
      url: j.url ?? null,
      references: [j.reference],
    };
    procs.push(p);
    return p;
  };
  const close = (p: ProceedingState, j: JudgmentInput, reason: string) => {
    p.status = 'cloturee';
    p.closedAt = j.date;
    p.closureReason = reason;
  };

  for (const j of sorted) {
    const c = classifyJudgment(j);
    switch (c.kind) {
      case 'ouverture': {
        const type = c.procType ?? 'autre';
        const existing = current(type);
        if (existing) touch(existing, j, c); // annonce rectificative ou doublon de publication
        else open(type, j, c);
        break;
      }
      case 'conversion_liquidation':
      case 'resolution_plan': {
        const prev = current();
        if (c.procType === 'liquidation' || c.kind === 'conversion_liquidation') {
          if (prev && prev.type !== 'liquidation') {
            touch(prev, j, c);
            close(prev, j, c.kind === 'resolution_plan' ? 'Résolution du plan et liquidation judiciaire' : 'Convertie en liquidation judiciaire');
          }
          const liq = current('liquidation');
          if (liq) touch(liq, j, c);
          else open('liquidation', j, c);
        } else if (prev) {
          touch(prev, j, c);
          prev.status = 'en_cours';
        }
        break;
      }
      case 'plan':
      case 'modification_plan': {
        const p = current(c.procType) ?? current();
        if (p) {
          touch(p, j, c);
          if (p.status !== 'cession_arretee') p.status = 'plan_arrete';
        }
        break;
      }
      case 'plan_cession': {
        const p = current(c.procType) ?? current();
        if (p) {
          touch(p, j, c);
          p.status = 'cession_arretee';
        } else {
          open(c.procType ?? 'redressement', j, c).status = 'cession_arretee';
        }
        break;
      }
      case 'cloture':
      case 'fin_procedure': {
        const p = current(c.procType) ?? current();
        if (p) {
          touch(p, j, c);
          close(p, j, c.closureReason ?? 'Clôture');
        }
        break;
      }
      case 'depot':
      case 'autre': {
        const p = current(c.procType) ?? current();
        if (p) {
          touch(p, j, c);
          if (p.status === 'ouverte') p.status = 'en_cours';
        }
        break;
      }
    }
  }
  return procs;
}

export const PROC_TYPE_LABELS: Record<ProcType, string> = {
  sauvegarde: 'Sauvegarde',
  redressement: 'Redressement judiciaire',
  liquidation: 'Liquidation judiciaire',
  conciliation: 'Conciliation',
  retablissement: 'Rétablissement professionnel',
  autre: 'Autre procédure',
};

export const PROC_STATUS_LABELS: Record<ProcStatus, string> = {
  ouverte: 'Ouverte',
  en_cours: 'En cours',
  plan_arrete: 'Plan arrêté',
  cession_arretee: 'Plan de cession arrêté',
  cloturee: 'Clôturée',
};

export function isActiveStatus(s: ProcStatus): boolean {
  return s !== 'cloturee';
}
