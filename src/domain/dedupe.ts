// Déduplication des prospects.
//
// Ordre de priorité : SIRET > SIREN > nom + adresse > nom + ville + téléphone  (correspondances « sûres »),
// puis téléphone seul (« à vérifier ») et nom + ville (sûre si rien ne se contredit, sinon « à vérifier »).
//  • sûre : c'est la même entreprise → la fiche existante est mise à jour / complétée ;
//  • à vérifier : aucune fusion automatique → un « doublon potentiel » est proposé
//    (Fusionner / Ignorer / Conserver les deux).
// Deux établissements d'une même entreprise (SIRET différents) et deux SIREN différents ne sont jamais fusionnés.
import type { DuplicateRule } from './types';
import { normEmail, normName, normPhone, normText } from './normalize';
import { domainOf } from './webContacts';

export type MatchRule = DuplicateRule;

export const MATCH_LABEL: Record<MatchRule, string> = {
  siret: 'même SIRET',
  siren: 'même SIREN',
  name_address: 'même nom et même adresse',
  name_phone: 'même nom, même ville et même téléphone',
  phone: 'même téléphone',
  name_city: 'même nom et même ville',
  website: 'même site web',
  email: 'même e-mail',
};

/** Correspondances assez sûres pour fusionner automatiquement. */
export const STRONG_RULES: MatchRule[] = ['siret', 'siren', 'name_address', 'name_phone'];

export interface DedupeKeys {
  id: string;
  siret: string | null;
  siren: string | null;
  phone: string | null;
  name: string;
  city: string | null;
  address: string | null;
  website?: string | null;
  email?: string | null;
}

export interface Match {
  id: string;
  rule: MatchRule;
  /** true : même entreprise (fusion automatique) ; false : doublon potentiel à vérifier */
  exact: boolean;
}

export class DedupeIndex {
  private bySiret = new Map<string, string>();
  private bySiren = new Map<string, { id: string; siret: string | null }[]>();
  private byPhone = new Map<string, string>();
  private byNamePhone = new Map<string, string>();
  private byNameCity = new Map<string, string>();
  private byNameAddress = new Map<string, string>();
  private sirenOf = new Map<string, string>();
  private details = new Map<string, { phone: string | null; address: string; city: string }>();
  private byDomain = new Map<string, string>();
  private byEmail = new Map<string, string>();

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
    const name = normName(k.name);
    this.details.set(k.id, { phone, address: normText(k.address), city: normText(k.city) });
    if (phone) {
      this.byPhone.set(phone, k.id);
      if (name) this.byNamePhone.set(`${name}|${phone}`, k.id);
    }
    if (name && k.city) this.byNameCity.set(`${name}|${normText(k.city)}`, k.id);
    if (name && k.address) this.byNameAddress.set(`${name}|${normText(k.address)}`, k.id);
    const domain = siteKey(k.website);
    if (domain) this.byDomain.set(domain, k.id);
    const email = normEmail(k.email);
    if (email) this.byEmail.set(email, k.id);
  }

  find(k: Omit<DedupeKeys, 'id'>, excludeId?: string): Match | null {
    const ok = (id: string | undefined): id is string => !!id && id !== excludeId;
    if (k.siret) {
      const id = this.bySiret.get(k.siret);
      if (ok(id)) return { id, rule: 'siret', exact: true };
    }
    const siren = k.siren ?? k.siret?.slice(0, 9) ?? null;
    if (siren) {
      const list = this.bySiren.get(siren) ?? [];
      // Un autre établissement (SIRET différent) de la même entreprise n'est pas un doublon.
      const hit = list.find((x) => ok(x.id) && (!k.siret || !x.siret || x.siret === k.siret));
      if (hit) return { id: hit.id, rule: 'siren', exact: true };
    }
    // Correspondances par nom / téléphone : jamais entre deux SIREN connus et différents.
    const compatible = (id: string | undefined): id is string => ok(id) && !(siren && this.sirenOf.has(id) && this.sirenOf.get(id) !== siren);
    const name = normName(k.name);
    const phone = normPhone(k.phone);
    if (name && k.address) {
      const id = this.byNameAddress.get(`${name}|${normText(k.address)}`);
      if (compatible(id)) return { id, rule: 'name_address', exact: true };
    }
    if (name && phone) {
      // Nom + ville + téléphone : même entreprise ; même nom et même téléphone dans une autre ville : à vérifier
      const id = this.byNamePhone.get(`${name}|${phone}`);
      if (compatible(id)) {
        const d = this.details.get(id);
        const sameCity = !k.city || !d?.city || normText(k.city) === d.city;
        return { id, rule: 'name_phone', exact: sameCity };
      }
    }
    if (phone) {
      const id = this.byPhone.get(phone);
      if (compatible(id)) return { id, rule: 'phone', exact: false };
    }
    if (name && k.city) {
      const id = this.byNameCity.get(`${name}|${normText(k.city)}`);
      if (compatible(id)) {
        // Même nom et même ville, sans adresse ni téléphone contradictoires : c'est la même entreprise
        // (ex. réimport d'un fichier sans SIRET). Sinon : doublon potentiel à vérifier.
        const d = this.details.get(id);
        const address = normText(k.address);
        const conflict = !!d && ((!!phone && !!d.phone && phone !== d.phone) || (!!address && !!d.address && address !== d.address));
        return { id, rule: 'name_city', exact: !conflict };
      }
    }
    // Même site ou même e-mail : jamais fusionné d'office (agences d'un même groupe, messagerie partagée…)
    const domain = siteKey(k.website);
    if (domain) {
      const id = this.byDomain.get(domain);
      if (compatible(id)) return { id, rule: 'website', exact: false };
    }
    const email = normEmail(k.email);
    if (email) {
      const id = this.byEmail.get(email);
      if (compatible(id)) return { id, rule: 'email', exact: false };
    }
    return null;
  }
}

// Domaines partagés par de nombreuses entreprises (plateformes, réseaux sociaux) : pas une clé de doublon
const SHARED_HOSTS = /(^|\.)(facebook|instagram|linkedin|google|wixsite|wix|jimdo|jimdofree|site123|webnode|blogspot|wordpress|pagesjaunes|business\.site|free|orange|wanadoo)\.[a-z.]+$/i;

function siteKey(url: string | null | undefined): string | null {
  const d = domainOf(url);
  return d && !SHARED_HOSTS.test(d) ? d : null;
}
