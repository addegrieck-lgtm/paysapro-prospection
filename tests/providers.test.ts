import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { SireneProvider, sireneToInputs, type SireneSearchResponse, type SireneUniteLegale } from '../src/providers/company/SireneProvider';
import { ExternalAIProvider, TemplateMessageProvider, buildFacts, generateMessage, DoNotContactError } from '../src/providers/ai';
import { MailtoEmailProvider } from '../src/providers/email';
import { googlePlacesProvider } from '../src/providers/company';
import { openProspectingDB } from '../src/data/db';
import { ProspectsApi, defaultSettings } from '../src/data/repository';
import { createProspect } from '../src/domain/prospect';
import { builtInTemplates } from '../src/domain/templates';
import type { MessageTemplate } from '../src/domain/types';

// Données SYNTHÉTIQUES reprenant la forme exacte de l'API (aucune vraie entreprise).
function etab(over: Partial<SireneUniteLegale['siege']> = {}): SireneUniteLegale['siege'] {
  return {
    siret: '90000000100011',
    activite_principale: '81.30Z',
    adresse: '12 RUE DES LILAS 76000 ROUEN',
    code_postal: '76000',
    commune: '76540',
    libelle_commune: 'ROUEN',
    region: '28',
    date_creation: '2019-03-01',
    etat_administratif: 'A',
    est_siege: true,
    tranche_effectif_salarie: '02',
    liste_enseignes: null,
    nom_commercial: null,
    statut_diffusion_etablissement: 'O',
    ...over,
  };
}

function unite(over: Partial<SireneUniteLegale> = {}): SireneUniteLegale {
  const siege = etab();
  return {
    siren: '900000001',
    nom_complet: 'JARDINS FICTIFS DU TEST',
    nom_raison_sociale: 'JARDINS FICTIFS DU TEST',
    nature_juridique: '5499',
    date_creation: '2019-03-01',
    etat_administratif: 'A',
    statut_diffusion: 'O',
    tranche_effectif_salarie: '02',
    siege,
    matching_etablissements: [siege],
    complements: { est_entrepreneur_individuel: false },
    ...over,
  };
}

const opts = { department: '76', nafCodes: ['81.30Z'], excludeIndividuals: false };

describe('SIRENE : conversion', () => {
  it('convertit un établissement actif sans rien inventer', () => {
    const [p] = sireneToInputs(unite(), opts);
    expect(p).toMatchObject({
      name: 'Jardins Fictifs du Test',
      siren: '900000001',
      siret: '90000000100011',
      nafCode: '81.30Z',
      legalForm: 'SARL',
      address: '12 Rue DES LILAS'.length ? '12 RUE DES LILAS' : '',
      postalCode: '76000',
      city: 'Rouen',
      department: '76',
      region: '28',
      headcountBand: '02',
      active: true,
      sourceUrl: 'https://annuaire-entreprises.data.gouv.fr/entreprise/900000001',
    });
    expect(p!.phone).toBeUndefined();
    expect(p!.email).toBeUndefined();
  });

  it('écarte établissements fermés, autre NAF, autre département, diffusion partielle', () => {
    const u = unite({
      matching_etablissements: [
        etab({ siret: '1', etat_administratif: 'F' }),
        etab({ siret: '2', activite_principale: '68.20A' }),
        etab({ siret: '3', code_postal: '14000' }),
        etab({ siret: '4', statut_diffusion_etablissement: 'P' }),
        etab({ siret: '5' }),
      ],
    });
    expect(sireneToInputs(u, opts).map((x) => x.siret)).toEqual(['5']);
    expect(sireneToInputs(unite({ statut_diffusion: 'P' }), opts)).toEqual([]);
  });

  it('option : exclure les entrepreneurs individuels', () => {
    const ei = unite({ nature_juridique: '1000', complements: { est_entrepreneur_individuel: true } });
    expect(sireneToInputs(ei, { ...opts, excludeIndividuals: true })).toEqual([]);
    expect(sireneToInputs(ei, opts)[0]!.individual).toBe(true);
  });
});

describe('SIRENE : import par département, pagination, cache', () => {
  it('parcourt les pages, puis réutilise le cache', async () => {
    const db = await openProspectingDB(`sirene-${Date.now()}`);
    const page = (n: number): SireneSearchResponse => ({
      results: [unite({ siren: `90000000${n}`, siege: etab({ siret: `90000000${n}00011` }), matching_etablissements: [etab({ siret: `90000000${n}00011` })] })],
      total_results: 2,
      page: n,
      per_page: 25,
      total_pages: 2,
    });
    const fetchImpl = vi.fn(async (url: string) => {
      const n = Number(new URL(url).searchParams.get('page'));
      expect(url).toContain('activite_principale=81.30Z');
      expect(url).toContain('departement=76');
      expect(url).toContain('etat_administratif=A');
      return { ok: true, status: 200, json: async () => page(n) };
    });
    const provider = new SireneProvider({ fetchImpl, db, minDelayMs: 0 });
    const api = new ProspectsApi(db, { workspaceId: 'w', user: 'u', role: 'owner' });
    const run = () =>
      provider.run({
        departments: ['76'],
        nafCodes: ['81.30Z'],
        excludeIndividuals: false,
        onBatch: async (inputs) => {
          await api.importLines(inputs.map((input, i) => ({ line: i, input, errors: [] })), { source: 'sirene', label: 'SIRENE', mode: 'create' });
        },
      });
    expect(await run()).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((await api.listProspects({ filter: {} })).total).toBe(2);
    // Deuxième passage : cache, et mise à jour (pas de doublon)
    expect(await run()).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((await api.listProspects({ filter: {} })).total).toBe(2);
    expect(Object.keys(await provider.lastImports())).toEqual(['76']);
    const p = await api.getProspect((await api.listProspects({ filter: {} })).items[0]!.id);
    expect(p!.source).toBe('sirene');
    expect(p!.lastVerifiedAt).not.toBeNull();
  });

  it('réessaie après une erreur 429', async () => {
    let calls = 0;
    const provider = new SireneProvider({
      minDelayMs: 0,
      fetchImpl: async () => (++calls === 1 ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ results: [], total_results: 0, page: 1, per_page: 25, total_pages: 0 }) }),
    });
    vi.useFakeTimers();
    const pending = provider.fetchPage('https://x/search?page=1', 7);
    await vi.advanceTimersByTimeAsync(1100);
    await expect(pending).resolves.toMatchObject({ results: [] });
    vi.useRealTimers();
    expect(calls).toBe(2);
  });
});

describe('IA optionnelle', () => {
  const settings = { ...defaultSettings('w'), saasName: 'Paysapro AI', signature: 'Adrien' };
  const tpl = { ...builtInTemplates()[0]!, id: 't', workspaceId: 'w', createdAt: '', updatedAt: '', createdBy: '', builtIn: true } as MessageTemplate;
  const prospect = createProspect({ name: 'Jardin Concept', city: 'Rouen', googleReviews: 87, googleRating: 4.8, website: 'https://jc.fr', services: ['amenagement'] }, { workspaceId: 'w', user: 'u' }, 'manual');

  it("n'envoie à l'IA que les données connues", () => {
    expect(buildFacts(prospect)).toEqual({ entreprise: 'Jardin Concept', ville: 'Rouen', departement: undefined, prestations: ['Aménagement paysager'], nombre_avis: 87, note_google: 4.8, site_internet: true } as never);
    const facts = buildFacts(createProspect({ name: 'Vide' }, { workspaceId: 'w', user: 'u' }, 'manual'));
    expect(facts).toEqual({ entreprise: 'Vide' });
  });

  it('sans IA configurée : modèle dynamique, le module fonctionne', async () => {
    const ai = new ExternalAIProvider('');
    expect(ai.configured).toBe(false);
    const msg = await generateMessage({ prospect, template: tpl, settings }, true, ai);
    expect(msg.provider).toBe('template');
    expect(msg.body).toContain('Paysapro AI');
    expect(msg.body).toContain('aménagement paysager');
    expect(msg.body).not.toContain('{{');
  });

  it('avec IA : appel du proxy avec le prompt de conformité, puis repli si erreur', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
      const payload = JSON.parse(init.body);
      expect(payload.system).toMatch(/N'invente jamais/);
      expect(payload.facts.nombre_avis).toBe(87);
      return { ok: true, status: 200, json: async () => ({ subject: 'Objet IA', body: 'Bonjour, message IA.' }) };
    });
    const ai = new ExternalAIProvider('https://proxy.example/ai', fetchImpl);
    expect(await generateMessage({ prospect, template: tpl, settings }, true, ai)).toMatchObject({ provider: 'ai', subject: 'Objet IA' });
    const broken = new ExternalAIProvider('https://proxy.example/ai', async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const fb = await generateMessage({ prospect, template: tpl, settings }, true, broken);
    expect(fb.provider).toBe('template');
    expect(fb.warnings[0]).toMatch(/IA indisponible/);
  });

  it('tutoiement configurable', async () => {
    const msg = await new TemplateMessageProvider().generate({ prospect, template: tpl, settings: { ...settings, formality: 'tu' } });
    expect(msg.body).toContain("t'intéresse");
  });

  it('refuse « Ne plus contacter » et les données de démonstration', async () => {
    await expect(generateMessage({ prospect: { ...prospect, doNotContact: true }, template: tpl, settings }, false)).rejects.toBeInstanceOf(DoNotContactError);
    await expect(generateMessage({ prospect: { ...prospect, demo: true }, template: tpl, settings }, false)).rejects.toThrow(/démonstration/);
  });
});

describe('Fournisseurs optionnels', () => {
  it('e-mail : mailto par défaut, pas d’envoi groupé', async () => {
    const opened: string[] = [];
    const mail = new MailtoEmailProvider((u) => opened.push(u));
    await mail.sendEmail({ to: 'a@b.fr', subject: 'S', body: 'B' });
    expect(opened[0]).toBe('mailto:a@b.fr?subject=S&body=B');
    await expect(mail.sendBulk()).rejects.toThrow(/Envoi groupé impossible/);
    expect(await mail.getOpenStatus()).toBeNull();
  });

  it('Google Places est désactivé par défaut', async () => {
    expect(googlePlacesProvider.enabled).toBe(false);
    await expect(googlePlacesProvider.search()).rejects.toThrow();
  });
});
