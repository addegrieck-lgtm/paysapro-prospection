// Déduplication des prospects.
//
// Ordre de priorité : SIRET > SIREN > téléphone > nom + ville > nom + adresse.
//  • « exact » (SIRET / SIREN) : c'est la même entreprise → mise à jour de la fiche existante ;
//  • « probable » (téléphone / nom) : très probablement la même → la fiche existante est seulement complétée,
//    jamais écrasée ni supprimée.
// Deux établissements d'une même entreprise (même SIREN, SIRET différents) ne sont PAS des doublons.
import { normName, normPhone, normText } from './normalize';

export type MatchRule = 'siret' | 'siren' | 'phone' | 'name_city' | 'name_address';

export const MATCH_LABEL: Record<MatchRule, string> = {
  siret: 'même SIRET',
  siren: 'même SIREN',
  phone: 'même téléphone',
  name_city: 'même nom et même ville',
  name_address: 'même nom et même adresse',
};

export interface DedupeKeys {
  id: string;
  siret: string | null;
  siren: string | null;
  phone: string | null;
  name: string;
  city: string | null;
  address: string | null;
}

export interface Match {
  id: string;
  rule: MatchRule;
  exact: boolean;
}

export class DedupeIndex {
  private bySiret = new Map<string, string>();
  private bySiren = new Map<string, { id: string; siret: string | null }[]>();
  private byPhone = new Map<string, string>();
  private byNameCity = new Map<string, string>();
  private byNameAddress = new Map<string, string>();
  private sirenOf = new Map<string, string>();

  constructor(items: DedupeKeys[] = []) {
    items.forEach((i) => this.add(i));
  }

  add(k: DedupeKeys): void {
    if (k.siret) this.bySiret.set(k.siret, k.id);
    const siren = k.siren ?? k.siret?.slice(0, 9) ?? null;
    if (siren) {
      this.sirenOf.set(k.id, siren);
      const list = this.bySiren.get(siren) ?? [];
      if (!list.some((x) => x.id === k.id)) list.push({ id: k.id, siret: k.siret });
      this.bySiren.set(siren, list);
    }
    const phone = normPhone(k.phone);
    if (phone) this.byPhone.set(phone, k.id);
    const name = normName(k.name);
    if (name && k.city) this.byNameCity.set(`${name}|${normText(k.city)}`, k.id);
    if (name && k.address) this.byNameAddress.set(`${name}|${normText(k.address)}`, k.id);
  }

  find(k: Omit<DedupeKeys, 'id'>): Match | null {
    if (k.siret) {
      const id = this.bySiret.get(k.siret);
      if (id) return { id, rule: 'siret', exact: true };
    }
    const siren = k.siren ?? k.siret?.slice(0, 9) ?? null;
    if (siren) {
      const list = this.bySiren.get(siren) ?? [];
      // Un autre établissement (SIRET différent) de la même entreprise n'est pas un doublon.
      const hit = list.find((x) => !k.siret || !x.siret || x.siret === k.siret);
      if (hit) return { id: hit.id, rule: 'siren', exact: true };
    }
    // Correspondances approximatives : jamais entre deux SIREN connus et différents (entreprises distinctes).
    const compatible = (id: string | undefined): id is string => !!id && !(siren && this.sirenOf.has(id) && this.sirenOf.get(id) !== siren);
    const phone = normPhone(k.phone);
    if (phone) {
      const id = this.byPhone.get(phone);
      if (compatible(id)) return { id, rule: 'phone', exact: false };
    }
    const name = normName(k.name);
    if (name && k.city) {
      const id = this.byNameCity.get(`${name}|${normText(k.city)}`);
      if (compatible(id)) return { id, rule: 'name_city', exact: false };
    }
    if (name && k.address) {
      const id = this.byNameAddress.get(`${name}|${normText(k.address)}`);
      if (compatible(id)) return { id, rule: 'name_address', exact: false };
    }
    return null;
  }
}
