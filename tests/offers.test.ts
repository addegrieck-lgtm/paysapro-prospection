import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { openProspectingDB } from '../src/data/db';
import { ProspectsApi, defaultSettings } from '../src/data/repository';
import { demoLines } from '../src/data/demo';
import { AGENCE_WORKSPACE, OFFERS, PAYSAPRO_WORKSPACE, nafKeyword, offerById, offerByWorkspace, offerNafCodes, searchTerm, sectorNafCodes } from '../src/domain/offers';
import { applyOfferLabels } from '../src/domain/offerLabels';
import { AGENCE_SCORING_CONFIG, computeScore } from '../src/domain/scoring';
import { createProspect } from '../src/domain/prospect';
import { NAF_LABELS, STATUS_LABEL, MILESTONE_LABEL } from '../src/domain/referentials';
import { OUTCOME, defaultSalesConfig, salesConfig } from '../src/domain/sales';
import { builtInTemplates, renderTemplate, variablesFor } from '../src/domain/templates';
import { contactReasons, prospectingAngle } from '../src/domain/insights';
import { buildQuery, STRATEGY_BY_ID } from '../src/domain/strategies';
import { googleSearchUrl } from '../src/domain/links';
import { deriveBackupKey, scopedBackupKey } from '../src/data/cloudBackup';
import { pageMentions } from '../src/domain/webContacts';

let n = 0;
async function setup(workspaceId: string) {
  const db = await openProspectingDB(`offers-${++n}-${Date.now()}`);
  return new ProspectsApi(db, { workspaceId, user: 'Adrien', role: 'owner' });
}

const agencyCtx = { workspaceId: AGENCE_WORKSPACE, user: 'Adrien' };
const NOW = new Date('2026-10-24T10:00:00Z');
const target = { targetDepartments: ['76'], now: NOW };

afterEach(() => applyOfferLabels(offerById('paysapro')));

describe('Offres et secteurs', () => {
  it('Signe & Seine : quatre secteurs, codes NAF valides, libellés et métiers connus', () => {
    const agence = offerById('agence');
    expect(agence.sectors.map((s) => s.id)).toEqual(['btp', 'restauration', 'commerce', 'services']);
    const codes = offerNafCodes(agence);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) {
      expect(c).toMatch(/^\d{2}\.\d{2}[A-Z]$/);
      expect(NAF_LABELS[c]).toBeTruthy();
      expect(nafKeyword(c)).toBeTruthy();
    }
    expect(sectorNafCodes(agence, ['restauration'])).toContain('56.10A');
    expect(sectorNafCodes(agence, ['btp'])).not.toContain('56.10A');
    expect(nafKeyword('43.21A')).toBe('électricien');
    // Le libellé d'origine des codes Paysapro est conservé
    expect(NAF_LABELS['81.30Z']).toBe("Services d'aménagement paysager");
  });

  it('chaque offre a son espace : Paysapro garde l’espace historique « local »', () => {
    expect(offerByWorkspace(PAYSAPRO_WORKSPACE).id).toBe('paysapro');
    expect(offerByWorkspace(AGENCE_WORKSPACE).id).toBe('agence');
    expect(offerByWorkspace('inconnu').id).toBe('paysapro');
    expect(new Set(OFFERS.map((o) => o.workspaceId)).size).toBe(OFFERS.length);
  });

  it('paramètres par défaut de l’agence : nom, Seine-Maritime, tous les métiers', () => {
    const s = defaultSettings(AGENCE_WORKSPACE);
    expect(s.saasName).toBe('Signe & Seine');
    expect(s.targetDepartments).toEqual(['76']);
    expect(s.nafCodes).toEqual(offerNafCodes(offerById('agence')));
    expect(defaultSettings(PAYSAPRO_WORKSPACE).nafCodes).toEqual(['81.30Z']);
    expect(defaultSettings(PAYSAPRO_WORKSPACE).targetDepartments).toEqual([]);
  });
});

describe('Score Signe & Seine (besoin d’une agence + joignable)', () => {
  const base = { name: 'Le Comptoir', nafCode: '56.10A', department: '76', active: true, phone: '0235000000' };

  it('l’absence de site ne compte qu’après la recherche de coordonnées', () => {
    const p = createProspect(base, agencyCtx, 'manual');
    const before = computeScore(p, target);
    expect(before.reasons.some((r) => /Aucun site/.test(r.label))).toBe(false);
    expect(before.missing).toContain('Site web (lancer la recherche de coordonnées)');
    const after = computeScore({ ...p, contactsCheckedAt: NOW.toISOString() }, target);
    expect(after.reasons).toContainEqual({ points: AGENCE_SCORING_CONFIG.noWebsite, label: 'Aucun site internet trouvé' });
    expect(after.reasons.some((r) => /Aucun réseau social/.test(r.label))).toBe(true);
    expect(after.score).toBeGreaterThan(before.score);
  });

  it('un site existant ne rapporte rien (refonte possible), contrairement à Paysapro', () => {
    const agency = computeScore(createProspect({ ...base, website: 'https://comptoir.fr' }, agencyCtx, 'manual'), target);
    expect(agency.missing).toContain('A déjà un site (refonte possible)');
    const paysapro = computeScore(createProspect({ ...base, website: 'https://comptoir.fr' }, { workspaceId: PAYSAPRO_WORKSPACE, user: 'A' }, 'manual'), target);
    expect(paysapro.reasons.some((r) => r.label === 'Site web disponible')).toBe(true);
  });

  it('Google : pas de fiche (vérifiée) > peu d’avis > fiche active', () => {
    const p = createProspect(base, agencyCtx, 'manual');
    expect(computeScore(p, target).missing).toContain('Présence Google (à vérifier)');
    expect(computeScore({ ...p, googleCheckedAt: NOW.toISOString() }, target).reasons).toContainEqual({ points: AGENCE_SCORING_CONFIG.noGoogle, label: 'Pas de fiche Google' });
    expect(computeScore({ ...p, googleReviews: 4 }, target).reasons).toContainEqual({ points: AGENCE_SCORING_CONFIG.fewReviews, label: "Peu d'avis Google (4)" });
    expect(computeScore({ ...p, googleReviews: 80 }, target).missing).toContain('Fiche Google déjà active (80 avis)');
  });

  it('entreprise récente : moins d’un an, puis 1 à 3 ans', () => {
    const p = createProspect(base, agencyCtx, 'manual');
    expect(computeScore({ ...p, creationDate: '2026-03-01' }, target).reasons.find((r) => /moins d'un an/.test(r.label))?.points).toBe(AGENCE_SCORING_CONFIG.recent1);
    expect(computeScore({ ...p, creationDate: '2024-06-01' }, target).reasons.find((r) => /récente/.test(r.label))?.points).toBe(AGENCE_SCORING_CONFIG.recent3);
    expect(computeScore({ ...p, creationDate: '2015-06-01' }, target).reasons.some((r) => /récente|moins d'un an/.test(r.label))).toBe(false);
  });

  it('le barème complet vaut 100 et une fiche idéale l’atteint', () => {
    const C = AGENCE_SCORING_CONFIG;
    expect(C.active + C.phone + C.email + C.noWebsite + C.noGoogle + C.noSocial + C.recent1 + C.employer + C.targetZone + C.complete).toBe(100);
    const ideal = createProspect(
      {
        ...base,
        email: 'contact@comptoir.fr',
        siren: '123456789',
        siret: '12345678900012',
        address: '1 rue du Port',
        postalCode: '76400',
        city: 'Fécamp',
        creationDate: '2026-05-01',
        headcount: 2,
        contactsCheckedAt: NOW.toISOString(),
        googleCheckedAt: NOW.toISOString(),
      },
      agencyCtx,
      'manual',
    );
    expect(computeScore(ideal, target).score).toBe(100);
  });

  it('pourquoi / angle : uniquement des constats', () => {
    const p = createProspect({ ...base, creationDate: '2026-02-01', contactsCheckedAt: NOW.toISOString() }, agencyCtx, 'manual');
    expect(prospectingAngle(p, NOW).angle).toBe('Pack Bien démarrer');
    expect(contactReasons(p, NOW)[0]).toMatch(/créée en 2026/);
    const old = { ...p, creationDate: '2010-01-01' };
    expect(prospectingAngle(old, NOW).angle).toBe('Création de site');
    expect(prospectingAngle({ ...old, website: 'https://x.fr' }, NOW).angle).toBe('Refonte & référencement');
  });
});

describe('Espace Signe & Seine : données séparées, modèles et vocabulaire', () => {
  it('les prospects d’un espace sont invisibles dans l’autre ; chaque espace a ses modèles', async () => {
    const db = await openProspectingDB(`offers-shared-${Date.now()}`);
    const paysapro = new ProspectsApi(db, { workspaceId: PAYSAPRO_WORKSPACE, user: 'A', role: 'owner' });
    const agence = new ProspectsApi(db, { workspaceId: AGENCE_WORKSPACE, user: 'A', role: 'owner' });
    await paysapro.createProspect({ name: 'Jardins du Nord' });
    await agence.createProspect({ name: 'Boulangerie du Port', nafCode: '10.71C' });
    expect((await paysapro.allRows()).map((r) => r.name)).toEqual(['Jardins du Nord']);
    expect((await agence.allRows()).map((r) => r.name)).toEqual(['Boulangerie du Port']);
    const tA = await agence.listTemplates();
    const tP = await paysapro.listTemplates();
    expect(tA.some((t) => t.name === 'Premier contact — sans site internet')).toBe(true);
    expect(tP.some((t) => t.name === 'Premier contact')).toBe(true);
    expect(tP.some((t) => /sans site/.test(t.name))).toBe(false);
    expect((await agence.getSettings()).saasName).toBe('Signe & Seine');
  });

  it('modèles agence : variable {{metier}}, ligne supprimée si le site est inconnu', () => {
    const p = createProspect({ name: 'Elec 76', nafCode: '43.21A', city: 'Bolbec' }, agencyCtx, 'manual');
    const vars = variablesFor(p, { saasName: 'Signe & Seine', signature: 'Adrien' });
    expect(vars.metier).toBe('électricien');
    const sansSite = builtInTemplates('agence').find((t) => t.name === 'Premier contact — sans site internet')!;
    const body = renderTemplate(sansSite.body, vars);
    expect(body).toContain('un électricien sur leur téléphone');
    expect(body).toContain('Elec 76 à Bolbec');
    expect(body).not.toMatch(/\{\{/);
    const avecSite = builtInTemplates('agence').find((t) => t.name === 'Premier contact — site existant')!;
    expect(renderTemplate(avecSite.body, vars)).not.toContain("J'ai consulté votre site");
  });

  it('vocabulaire : RDV et devis pour l’agence, démo et essai pour Paysapro', () => {
    applyOfferLabels(offerById('agence'));
    expect(STATUS_LABEL.demo_scheduled).toBe('RDV programmé');
    expect(STATUS_LABEL.trial).toBe('Devis envoyé');
    expect(MILESTONE_LABEL.demo).toBe('RDV');
    expect(OUTCOME.demo.label).toBe('Rendez-vous à prévoir');
    applyOfferLabels(offerById('paysapro'));
    expect(STATUS_LABEL.demo_scheduled).toBe('Démo programmée');
    expect(STATUS_LABEL.trial).toBe('Essai');
    expect(MILESTONE_LABEL.demo).toBe('Démos');
  });

  it('assistant commercial : contenu par défaut de l’agence, prix repris du site', () => {
    const cfg = salesConfig({ sales: undefined, workspaceId: AGENCE_WORKSPACE });
    expect(cfg.productName).toBe('Signe & Seine');
    expect(cfg.offers.find((o) => o.id === 'site-essentiel')?.price).toBe('à partir de 690 € HT');
    expect(cfg.emails.some((e) => e.id === 'aftercall')).toBe(true); // modèle proposé après « E-mail demandé »
    expect(defaultSalesConfig(PAYSAPRO_WORKSPACE).productName).toBe('Paysapro AI');
    expect(salesConfig({ sales: undefined }).productName).toBe('Paysapro AI');
  });

  it('démonstration agence : 100 entreprises fictives de Seine-Maritime, métiers de l’offre', () => {
    const lines = demoLines(100, 'agence');
    const codes = offerNafCodes(offerById('agence'));
    expect(lines).toHaveLength(100);
    for (const l of lines) {
      expect(l.input!.demo).toBe(true);
      expect(l.input!.department).toBe('76');
      expect(codes).toContain(l.input!.nafCode);
      expect(l.input!.siren ?? null).toBeNull();
    }
  });
});

describe('Recherche : métier de la fiche', () => {
  it('requêtes web et recherche Google utilisent le métier (plus « paysagiste » partout)', () => {
    const def = STRATEGY_BY_ID.get('web_name_city_activity')!;
    const c = { name: 'Elec 76', city: 'Bolbec', address: null, postalCode: '76210', nafCode: '43.21A', workspaceId: AGENCE_WORKSPACE };
    expect(buildQuery(def, c)).toBe('"Elec 76" "Bolbec" électricien');
    expect(buildQuery(def, { ...c, nafCode: null })).toBeNull(); // jamais de mot-clé inventé
    expect(buildQuery(def, { ...c, nafCode: null, workspaceId: PAYSAPRO_WORKSPACE })).toBe('"Elec 76" "Bolbec" paysagiste');
    expect(searchTerm({ nafCode: '81.30Z', workspaceId: AGENCE_WORKSPACE })).toBe('paysagiste');
    expect(decodeURIComponent(googleSearchUrl({ name: 'Le Comptoir', tradeName: null, city: 'Fécamp', nafCode: '56.10A', workspaceId: AGENCE_WORKSPACE }))).toContain('Le Comptoir Fécamp restaurant');
  });

  it('vérification d’un site : le métier courant compte comme activité concordante', () => {
    const company = { siren: null, siret: null, name: 'Martin', city: 'Yvetot', postalCode: '76190', activity: "Travaux d'installation d'eau et de gaz", nafCode: '43.22A' };
    expect(pageMentions('<h1>Martin, plombier à Yvetot</h1>', company).activity).toBe(true);
    expect(pageMentions('<h1>Martin, boulanger à Yvetot</h1>', company).activity).toBe(false);
  });
});

describe('Sauvegarde en ligne : une adresse par espace', () => {
  it('Paysapro garde l’adresse historique, Signe & Seine a la sienne', async () => {
    const k = await deriveBackupKey('mon jardin secret 2026');
    expect((await scopedBackupKey(k, PAYSAPRO_WORKSPACE)).id).toBe(k.id);
    const agence = await scopedBackupKey(k, AGENCE_WORKSPACE);
    expect(agence.id).toMatch(/^[0-9a-f]{64}$/);
    expect(agence.id).not.toBe(k.id);
    expect(agence.key).toEqual(k.key);
    expect((await scopedBackupKey(k, AGENCE_WORKSPACE)).id).toBe(agence.id); // stable
  });

  it('un espace de test inconnu n’est pas séparé (compatibilité)', async () => {
    const k = await deriveBackupKey('mon jardin secret 2026');
    expect((await scopedBackupKey(k, 'w1')).id).toBe(k.id);
    await setup('w1'); // ouverture de base sans erreur
  });
});
