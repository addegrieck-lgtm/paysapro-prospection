// EnrichmentEngine : enrichissement complet d'une entreprise, par étapes.
//
//   Company
//    ↓ 1. Données administratives        (API Recherche d'entreprises — SIRENE)
//    ↓ 2. Annuaire public                (OpenStreetMap : téléphone, site, e-mail, réseaux)
//    ↓ 3. Recherche du site officiel      (site connu, site OSM, ou domaines plausibles vérifiés par le contenu*)
//    ↓ 4. Coordonnées du site officiel    (accueil, contact, mentions légales*)
//    ↓ 5. Normalisation des téléphones    (PhoneNormalizer : +33…, type, fax)
//    ↓ 6. Vérification                    (PhoneVerificationEngine : confiance 0–100, numéros partagés)
//    ↓ 7. E-mails et réseaux sociaux      (uniquement ceux réellement trouvés)
//    ↓ 8. Score                           (+ ajout automatique au CRM si activé)
//    ↓ 9. Sources, historique, journal
// (* nécessite le relais web gratuit — VITE_WEB_PROXY_URL)
//
// Priorité des sources : Manuel > Source officielle > Site officiel > Source secondaire.
// Rien n'est jamais inventé : ni numéro, ni e-mail, ni site.
import type { CompanyEmail, CompanyPhone, CompanyWebsite, ContactEvidence, EnrichmentFound, Prospect } from '../domain/types';
import type { ContactSet, ProspectsApi } from './repository';
import type { Company, CompanyDataProvider } from '../providers/company/CompanyDataProvider';
import type { OpenStreetMapProvider } from '../providers/company/OpenStreetMapProvider';
import type { WebsiteProvider } from '../providers/company/WebsiteProvider';
import { newEmail, newPhone, newWebsite } from '../domain/contactSync';
import { applyStatus, mergeProspect } from '../domain/prospect';
import { domainOf } from '../domain/webContacts';
import { ProviderError } from '../providers/http';
import { ENRICHMENT_CONFIG } from '../config';

export interface EngineProviders {
  official: CompanyDataProvider;
  directory?: OpenStreetMapProvider | null;
  website?: WebsiteProvider | null;
}

export interface EngineOptions {
  force?: boolean;
  /** « Maximiser les téléphones » : toutes les sources configurées, même si une coordonnée est déjà connue */
  maxPhones?: boolean;
  signal?: AbortSignal;
}

export interface EngineResult {
  prospect: Prospect | null;
  outcome: 'enriched' | 'partial' | 'no_change' | 'not_found' | 'ambiguous' | 'failed' | 'skipped';
  found: EnrichmentFound;
  steps: string[];
  details: string[];
  error: string | null;
  /** Recherche par nom ambiguë : entreprises possibles (à choisir par l'utilisateur) */
  candidates?: Company[];
}

const emptyFound = (): EnrichmentFound => ({ phones: 0, verifiedPhones: 0, emails: 0, websites: 0, bySource: {} });

export class EnrichmentEngine {
  private api: ProspectsApi;
  private p: EngineProviders;

  constructor(api: ProspectsApi, providers: EngineProviders) {
    this.api = api;
    this.p = providers;
  }

  get providers(): EngineProviders {
    return this.p;
  }

  private fresh(at: string | null): boolean {
    return !!at && Date.now() - new Date(at).getTime() < ENRICHMENT_CONFIG.cacheDays * 86_400_000;
  }

  async enrichCompany(prospectId: string, o: EngineOptions = {}): Promise<EngineResult> {
    const started = Date.now();
    const startedAt = new Date().toISOString();
    const settings = await this.api.getSettings();
    const enabled = settings.providers;
    const steps: string[] = [];
    const details: string[] = [];
    const found = emptyFound();
    let adminOutcome: EngineResult['outcome'] = 'skipped';
    let error: string | null = null;
    let candidates: Company[] | undefined;

    // 1. Données administratives
    if (enabled.official) {
      const r = await this.api.enrichProspect(prospectId, this.p.official, { force: o.force, signal: o.signal });
      steps.push(r.skipped ? 'Administratif (récent, conservé)' : 'Administratif');
      if (r.error) error = r.error;
      if (r.application) {
        adminOutcome = r.application.outcome === 'failed' ? 'failed' : r.application.outcome;
        details.push(...r.application.details);
      }
      if (r.outcome?.status === 'ambiguous') candidates = r.outcome.candidates;
    }

    let p = await this.api.getProspect(prospectId);
    if (!p) throw new Error('Prospect introuvable.');
    if (p.demo || p.anonymized) return { prospect: p, outcome: 'skipped', found, steps, details, error };

    const contactsFresh = this.fresh(p.contactsCheckedAt) && !o.force && !o.maxPhones;
    if (contactsFresh) {
      steps.push('Coordonnées (récentes, conservées)');
      return { prospect: p, outcome: adminOutcome === 'skipped' ? 'no_change' : adminOutcome, found, steps, details, error };
    }

    const now = new Date().toISOString();
    const incoming: ContactSet = { phones: [], emails: [], websites: [] };
    const socials: { facebook?: string; instagram?: string; linkedin?: string } = {};
    const count = (source: string) => (found.bySource[source] = (found.bySource[source] ?? 0) + 1);
    const addPhone = (raw: string, e: ContactEvidence, fax = false) => {
      const c = newPhone(p!, raw, e, now, fax);
      if (c) incoming.phones.push(c);
    };

    // 2. Annuaire public (OpenStreetMap)
    let websiteCandidate: string | null = p.website;
    if (enabled.directory && this.p.directory) {
      try {
        const m = await this.p.directory.match(p, o.signal);
        steps.push('Annuaire public (OpenStreetMap)');
        if (m) {
          const e: ContactEvidence = { kind: 'directory', provider: 'OpenStreetMap', url: m.place.url, at: now, matched: m.matched };
          m.place.phones.forEach((ph) => addPhone(ph, e));
          if (m.place.email) {
            const c = newEmail(p, m.place.email, e, now);
            if (c) incoming.emails.push(c);
          }
          if (m.place.website) {
            const c = newWebsite(p, m.place.website, e, now, false);
            if (c) incoming.websites.push(c);
            websiteCandidate ??= m.place.website;
          }
          if (m.place.facebook) socials.facebook = m.place.facebook;
          if (m.place.instagram) socials.instagram = m.place.instagram;
          details.push(`✓ Trouvée dans OpenStreetMap (${m.sure ? 'même SIRET' : 'nom et localisation concordants'})`);
        }
      } catch (e) {
        if (e instanceof ProviderError && e.kind === 'aborted') throw e;
        console.warn('[OpenStreetMap]', e);
        steps.push('Annuaire public : indisponible');
      }
    }

    // 3–4. Site officiel (relais web)
    if (enabled.website && this.p.website?.enabled) {
      try {
        let analysis = websiteCandidate ? await this.p.website.analyze(websiteCandidate, p, o.signal) : null;
        steps.push(websiteCandidate ? 'Site officiel' : 'Recherche du site officiel');
        if (!analysis?.verified && enabled.websiteDiscovery && (!websiteCandidate || !analysis)) {
          const discovered = await this.p.website.discover(p, o.signal);
          if (discovered) {
            analysis = discovered;
            details.push(`✓ Site officiel trouvé : ${domainOf(discovered.url)} (vérifié par son contenu)`);
          }
        }
        if (analysis) {
          const matched = [
            ...(analysis.identity.siret ? ['siret'] : analysis.identity.siren ? ['siren'] : []),
            ...(analysis.identity.name ? ['name'] : []),
            ...(analysis.identity.city ? ['city'] : []),
            ...(analysis.identity.postalCode ? ['postalCode'] : []),
            ...(analysis.verified ? ['website_verified'] : []),
          ];
          const provider = analysis.verified ? 'Site officiel' : 'Site web (non vérifié)';
          const site = newWebsite(p, analysis.url, { kind: 'website', provider, url: analysis.url, at: now, matched }, now, analysis.verified);
          if (site) incoming.websites.push(site);
          for (const ph of analysis.phones) {
            addPhone(ph.e164, { kind: 'website', provider, url: ph.pageUrl, at: now, matched: ph.fromTelLink ? [...matched, 'tel_link'] : matched }, ph.fax);
          }
          for (const em of analysis.emails) {
            // Un e-mail nominatif est une donnée personnelle : il n'est retenu que s'il vient d'un lien « mailto: » du site vérifié
            if (em.kind === 'nominative' && !(analysis.verified && em.fromMailto)) continue;
            const c = newEmail(p, em.email, { kind: 'website', provider, url: em.pageUrl, at: now, matched }, now);
            if (c) incoming.emails.push({ ...c, kind: em.kind });
          }
          if (analysis.verified) {
            for (const k of ['facebook', 'instagram', 'linkedin'] as const) if (analysis.socials[k]) socials[k] ??= analysis.socials[k]!;
          }
          if (analysis.ignoredThirdParty) details.push(`ℹ ${analysis.ignoredThirdParty} coordonnée(s) de tiers écartée(s) (hébergeur, webmaster, agence web…)`);
          if (analysis.ignoredListed) details.push(`ℹ ${analysis.ignoredListed} numéro(s) / e-mail(s) d'autres agences écartés (page listant plusieurs contacts)`);
          if (!analysis.verified) details.push('⚠ Site trouvé mais sans mention du SIREN ni du nom + commune : coordonnées « à vérifier »');
        }
      } catch (e) {
        if (e instanceof ProviderError && e.kind === 'aborted') throw e;
        console.warn('[Site web]', e);
        steps.push('Site officiel : indisponible');
      }
    }

    // 5–7. Normalisation, vérification (confiance, numéros partagés), fusion sans écraser les données manuelles
    const before = await this.api.contactsFor(p.id);
    const { prospect: merged, contacts, created } = await this.api.mergeContacts(p, incoming, now);
    p = merged;
    steps.push('Normalisation et vérification des coordonnées');
    const bySourceOf = (c: CompanyPhone | CompanyEmail | CompanyWebsite) => c.evidence[0]?.provider ?? 'Autre';
    for (const c of created.phones) count(bySourceOf(c));
    for (const c of created.emails) count(bySourceOf(c));
    for (const c of created.websites) count(bySourceOf(c));
    found.phones = contacts.phones.filter((c) => c.status !== 'rejected').length - before.phones.filter((c) => c.status !== 'rejected').length;
    found.verifiedPhones = contacts.phones.filter((c) => c.status === 'verified').length - before.phones.filter((c) => c.status === 'verified').length;
    found.emails = created.emails.length;
    found.websites = created.websites.length;
    for (const c of created.phones) details.push(`📞 ${c.display} — confiance ${c.confidence} % (${bySourceOf(c)})${c.shared ? ' ⚠ numéro partagé' : ''}`);
    for (const c of created.emails) details.push(`✉ ${c.display} (${bySourceOf(c)})`);
    for (const c of created.websites) details.push(`🌐 ${c.display} (${bySourceOf(c)})`);

    // Réseaux sociaux : uniquement les URL réellement trouvées, sans écraser une saisie manuelle
    if (Object.keys(socials).length) {
      p = mergeProspect(p, socials, 'fill', now, { type: 'web', provider: 'Présence web publique', at: now, confidence: 'medium' }).prospect;
    }

    // 8. Score (recalculé par finalize) + CRM automatique si activé
    if (settings.autoQualify && p.active && p.phoneStatus === 'verified' && !p.doNotContact && (p.status === 'new' || p.status === 'to_qualify')) {
      p = { ...applyStatus(p, 'to_contact', now), qualifiedAt: now };
      details.push('📇 Ajouté au CRM (À contacter) : entreprise active avec un téléphone vérifié');
    }
    p = { ...p, contactsCheckedAt: now };
    steps.push('Score');

    // 9. Historique et journal
    const summary = found.phones || found.emails || found.websites ? `Coordonnées : ${found.phones} téléphone(s), ${found.emails} e-mail(s), ${found.websites} site(s)` : 'Recherche de coordonnées : aucune nouvelle donnée publique trouvée';
    await this.api.saveEngineResult(p, summary, details, {
      provider: 'moteur',
      status: found.phones || found.emails || found.websites ? 'enriched' : adminOutcome === 'not_found' || adminOutcome === 'ambiguous' ? adminOutcome : 'no_change',
      startedAt,
      fieldsUpdated: [...(found.phones ? ['phone'] : []), ...(found.emails ? ['email'] : []), ...(found.websites ? ['website'] : [])],
      fieldsConfirmed: [],
      fromCache: false,
      error,
      durationMs: Date.now() - started,
      found,
      steps,
    });
    const outcome: EngineResult['outcome'] =
      found.phones || found.emails || found.websites ? (p.enrichmentStatus === 'partial' ? 'partial' : 'enriched') : adminOutcome === 'skipped' ? 'no_change' : adminOutcome;
    return { prospect: p, outcome, found, steps, details, error, candidates };
  }
}
