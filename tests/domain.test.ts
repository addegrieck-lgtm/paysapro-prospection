import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv, detectDelimiter } from '../src/domain/csv';
import { autoDetectMapping, mapRow } from '../src/domain/mapping';
import { DedupeIndex } from '../src/domain/dedupe';
import { computeScore, priorityOf, SCORING_CONFIG } from '../src/domain/scoring';
import { matchesFilter, sortRows, describeFilter } from '../src/domain/filters';
import { anonymize, applyManualEdit, combineProspects, createProspect, mergeProspect, originFor, toRow, applyStatus } from '../src/domain/prospect';
import { renderTemplate, toInformal, builtInTemplates, variablesFor } from '../src/domain/templates';
import { contactReasons, prospectingAngle } from '../src/domain/insights';
import { can, assertCan, quotaAllows, PLAN_QUOTAS } from '../src/domain/access';
import { departmentFromPostalCode, normalizeDepartment, regionOfDepartment } from '../src/domain/geo';
import { normPhone, normUrl, titleCase } from '../src/domain/normalize';
import { googleSearchUrl, mailtoUrl } from '../src/domain/links';
import { computeKpis, funnel, byGeo, evolution } from '../src/domain/stats';

const ctx = { workspaceId: 'w1', user: 'test' };
const make = (input: Parameters<typeof createProspect>[0]) => createProspect(input, ctx, 'manual');

describe('CSV', () => {
  it('détecte le séparateur et gère BOM, guillemets et retours à la ligne', () => {
    const text = '﻿Nom;Ville;Note\r\n"Jardins ""Le Clos""";Rouen;"4,7"\r\n"Multi\nligne";Caen;\r\n\r\n';
    const p = parseCsv(text);
    expect(p.delimiter).toBe(';');
    expect(p.headers).toEqual(['Nom', 'Ville', 'Note']);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]).toEqual(['Jardins "Le Clos"', 'Rouen', '4,7']);
    expect(p.rows[1]![0]).toBe('Multi\nligne');
  });

  it('accepte la virgule comme séparateur', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(parseCsv('nom,ville\nA,"Rouen, centre"').rows[0]).toEqual(['A', 'Rouen, centre']);
  });

  it('écrit un CSV Excel (BOM, « ; », échappement, anti-formule)', () => {
    const csv = toCsv(['a', 'b'], [['x;y', '=SOMME(A1)'], [null, 42]]);
    expect(csv.startsWith('﻿a;b')).toBe(true);
    expect(csv).toContain('"x;y"');
    expect(csv).toContain("'=SOMME(A1)");
    expect(parseCsv(csv).rows[1]).toEqual(['', '42']);
  });
});

describe('Mapping des colonnes', () => {
  it('reconnaît automatiquement les colonnes usuelles', () => {
    const m = autoDetectMapping(['Raison sociale', 'SIRET', 'CP', 'Commune', 'Tél', 'E-mail', 'Site internet', 'google_rating', 'google_reviews', 'Code NAF']);
    expect(m).toEqual(['name', 'siret', 'postalCode', 'city', 'phone', 'email', 'website', 'googleRating', 'googleReviews', 'nafCode']);
  });

  it('normalise une ligne et signale sans inventer les valeurs illisibles', () => {
    const m = autoDetectMapping(['nom', 'siret', 'cp', 'ville', 'telephone', 'email', 'note', 'avis', 'activite']);
    const r = mapRow(['Jardin & Création', '123 456 789 00012', '76000', 'Rouen', '+33 6 12 34 56 78', 'pas-un-mail', '4,7', '87', 'Création et entretien de jardins'], m);
    expect(r.input).toMatchObject({ name: 'Jardin & Création', siret: '12345678900012', siren: '123456789', department: '76', phone: '0612345678', googleRating: 4.7, googleReviews: 87 });
    expect(r.input?.email).toBeUndefined();
    expect(r.errors[0]).toMatch(/E-mail illisible/);
    expect(r.input?.services).toEqual(['creation', 'entretien']);
  });

  it('rejette une ligne sans nom (import) mais accepte un SIREN seul (enrichissement)', () => {
    const m = autoDetectMapping(['siren', 'email']);
    expect(mapRow(['123456789', 'a@b.fr'], m).input).toBeNull();
    expect(mapRow(['123456789', 'a@b.fr'], m, false).input).toMatchObject({ siren: '123456789', email: 'a@b.fr' });
  });
});

describe('Déduplication', () => {
  const index = new DedupeIndex([
    { id: 'a', siret: '11111111100011', siren: '111111111', phone: '0235000000', name: 'Jardins du Val SARL', city: 'Rouen', address: '1 rue A' },
    { id: 'b', siret: null, siren: '222222222', phone: null, name: 'Paysages Nord', city: 'Lille', address: '5 place B' },
  ]);

  it('priorité SIRET > SIREN > nom + adresse > nom + téléphone, puis téléphone et nom + ville', () => {
    expect(index.find({ siret: '11111111100011', siren: null, phone: null, name: 'x', city: null, address: null })).toEqual({ id: 'a', rule: 'siret', exact: true });
    expect(index.find({ siret: null, siren: '222222222', phone: null, name: 'x', city: null, address: null })?.rule).toBe('siren');
    expect(index.find({ siret: null, siren: null, phone: null, name: 'Paysages Nord', city: 'Roubaix', address: '5 Place B' })).toEqual({ id: 'b', rule: 'name_address', exact: true });
    expect(index.find({ siret: null, siren: null, phone: '02 35 00 00 00', name: 'Jardins du Val', city: 'Caen', address: null })).toEqual({ id: 'a', rule: 'name_phone', exact: true });
    // Téléphone seul : doublon potentiel, jamais fusionné automatiquement
    expect(index.find({ siret: null, siren: null, phone: '+33 2 35 00 00 00', name: 'x', city: null, address: null })).toEqual({ id: 'a', rule: 'phone', exact: false });
    // Même nom + même ville sans contradiction : même entreprise (réimport sans SIRET)
    expect(index.find({ siret: null, siren: null, phone: null, name: 'JARDINS DU VAL', city: 'rouen', address: null })).toEqual({ id: 'a', rule: 'name_city', exact: true });
    // … mais avec une adresse différente : à vérifier
    expect(index.find({ siret: null, siren: null, phone: null, name: 'JARDINS DU VAL', city: 'rouen', address: '99 avenue Z' })).toEqual({ id: 'a', rule: 'name_city', exact: false });
  });

  it('même nom et même ville mais SIREN différents : entreprises distinctes', () => {
    expect(index.find({ siret: null, siren: '333333333', phone: null, name: 'Jardins du Val', city: 'Rouen', address: null })).toBeNull();
  });

  it("deux établissements d'une même entreprise ne sont pas des doublons", () => {
    expect(index.find({ siret: '11111111100029', siren: '111111111', phone: null, name: 'Autre', city: 'Caen', address: null })).toBeNull();
  });
});

describe('Scoring', () => {
  const now = new Date('2026-09-29');
  const admin = { siren: '123456789', siret: '12345678900011', nafCode: '81.30Z', address: '1 rue A', postalCode: '76000', city: 'Rouen', name: 'A', creationDate: '2025-02-01' };

  it('explique chaque point du score (+ et −)', () => {
    const r = computeScore(
      {
        ...admin,
        active: true,
        department: '76',
        phone: '0612345678',
        email: null,
        website: 'https://x.fr',
        googleUrl: 'https://maps.google.com/x',
        googleRating: 4.7,
        googleReviews: 84,
        headcount: 5,
        headcountBand: null,
        services: ['amenagement', 'entretien'],
        activity: null,
      },
      { targetDepartments: ['76'], now },
    );
    expect(r.reasons.map((x) => `+${x.points} ${x.label}`)).toEqual([
      '+15 Entreprise active',
      '+10 Téléphone disponible',
      '+10 Site web disponible',
      '+5 Présence Google',
      '+10 84 avis Google',
      '+5 Note Google 4,7',
      '+5 Effectif connu : 5 personne(s)',
      '+5 Effectif ≥ 3 personnes',
      '+5 Entreprise récente (2025)',
      '+5 Zone ciblée (76)',
      '+5 Services correspondants (création / aménagement)',
      '+5 Informations administratives complètes',
    ]);
    expect(r.score).toBe(85);
    expect(r.missing).toEqual(['E-mail', 'Réseaux sociaux inconnus']);
  });

  it('ne compte pas deux fois et plafonne à 100 ; configuration = 100 points', () => {
    expect(Object.values(SCORING_CONFIG).reduce((a, b) => a + b, 0) - SCORING_CONFIG.reviews20).toBe(100);
    const full = computeScore(
      { ...admin, active: true, department: '76', phone: '1', email: 'a@b.fr', website: 'w', googleUrl: 'g', googleRating: 5, googleReviews: 500, headcount: 50, headcountBand: '12', services: ['creation', 'amenagement', 'elagage'], activity: null, instagram: 'i' },
      { targetDepartments: ['76'], now },
    );
    expect(full.score).toBe(100);
    expect(full.reasons.filter((r) => r.label.includes('avis'))).toHaveLength(1);
    expect(full.missing).toEqual([]);
  });

  it('prospect sans données : 0, jamais de points inventés ; le NAF ne donne rien', () => {
    const r = computeScore({ phone: null, email: null, website: null, googleUrl: null, googleRating: null, googleReviews: null, headcount: null, headcountBand: null, services: [], activity: "Services d'aménagement paysager" }, { targetDepartments: [], now });
    expect(r.score).toBe(0);
    expect(r.missing).toContain('Statut administratif inconnu');
  });

  it('note ignorée avec moins de 5 avis ; tranche INSEE ≥ 3 comptée ; zone hors cible sans point', () => {
    expect(computeScore({ department: '33', phone: null, email: null, website: null, googleUrl: null, googleRating: 5, googleReviews: 2, headcount: null, headcountBand: '02', services: [], activity: null }, { targetDepartments: ['76'], now }).score).toBe(15);
  });

  it('niveaux de priorité', () => {
    expect(priorityOf(85).id).toBe('max');
    expect(priorityOf(60).id).toBe('high');
    expect(priorityOf(59).id).toBe('normal');
    expect(priorityOf(12).id).toBe('low');
  });
});

describe('Fiche prospect', () => {
  it('déduit département et région du code postal', () => {
    const p = make({ name: 'A', postalCode: '76000' });
    expect(p.department).toBe('76');
    expect(p.region).toBe('28');
  });

  it('fusion « fill » ne remplace jamais une donnée existante ; « overwrite » oui ; jamais par du vide', () => {
    const p = createProspect({ name: 'A', phone: '0611111111', email: null }, ctx, 'csv');
    const fill = mergeProspect(p, { phone: '0622222222', email: 'a@b.fr' }, 'fill', 'now');
    expect(fill.prospect.phone).toBe('0611111111');
    expect(fill.prospect.email).toBe('a@b.fr');
    const over = mergeProspect(p, { phone: '0622222222', email: null }, 'overwrite', 'now');
    expect(over.prospect.phone).toBe('0622222222');
    expect(over.changed).toEqual(['phone']);
  });

  it('provenance : chaque champ a une source ; une donnée manuelle n’est jamais remplacée automatiquement', () => {
    const p = createProspect({ name: 'A', phone: '0611111111', address: '1 rue A' }, ctx, 'manual');
    expect(p.fieldSources.phone).toMatchObject({ type: 'manual' });
    const api = originFor('sirene', '2026-09-29');
    const r = mergeProspect(p, { phone: '0622222222', address: '2 rue B', siren: '123456789' }, 'identity', '2026-09-29', api);
    expect(r.prospect.phone).toBe('0611111111');
    expect(r.prospect.address).toBe('1 rue A');
    expect(r.kept).toEqual(['phone', 'address']);
    expect(r.prospect.siren).toBe('123456789');
    expect(r.prospect.fieldSources.siren).toMatchObject({ type: 'official_api', provider: 'recherche-entreprises', at: '2026-09-29' });
    // Saisie manuelle : devient « Manuel », un champ vidé perd sa source
    const edited = applyManualEdit(r.prospect, { phone: null, email: 'x@y.fr' }, '2026-09-30', 'Adrien');
    expect(edited.prospect.fieldSources.phone).toBeUndefined();
    expect(edited.prospect.fieldSources.email).toMatchObject({ type: 'manual', provider: 'Adrien' });
  });

  it('source officielle : rafraîchit sa propre donnée, confirme les valeurs identiques', () => {
    const p = createProspect({ name: 'A', address: '1 rue A', nafCode: '81.30Z' }, ctx, 'sirene');
    const r = mergeProspect(p, { address: '3 rue C', nafCode: '81.30Z' }, 'identity', '2026-10-01', originFor('sirene', '2026-10-01'));
    expect(r.changed).toEqual(['address']);
    expect(r.confirmed).toEqual(['nafCode']);
    expect(r.prospect.fieldSources.nafCode?.at).toBe('2026-10-01');
  });

  it('anonymisation RGPD : données personnelles effacées, exclusion définitive', () => {
    const ei = createProspect({ name: 'Jean Dupont', individual: true, siren: '123456789', email: 'jean@x.fr', phone: '0611111111', city: 'Rouen', nafCode: '81.30Z' }, ctx, 'csv');
    const a = anonymize(ei, 'now');
    expect(a).toMatchObject({ name: 'Entreprise anonymisée', siren: null, email: null, phone: null, city: 'Rouen', nafCode: '81.30Z', doNotContact: true, anonymized: true });
    const sas = anonymize(createProspect({ name: 'Jardins SAS', individual: false, siren: '987654321', email: 'contact@j.fr', contactFirstName: 'Paul' }, ctx, 'csv'), 'now');
    expect(sas).toMatchObject({ name: 'Jardins SAS', siren: '987654321', email: null, contactFirstName: null });
  });

  it('fusion de deux fiches : les informations des deux sont conservées', () => {
    const a = createProspect({ name: 'A', siret: '12345678900011', phone: '0611111111' }, ctx, 'sirene');
    const b = applyStatus(createProspect({ name: 'A bis', email: 'a@a.fr', website: 'https://a.fr', services: ['entretien'] }, ctx, 'csv'), 'contacted', '2026-01-01');
    const m = combineProspects(a, b, 'now');
    expect(m).toMatchObject({ name: 'A', siret: '12345678900011', phone: '0611111111', email: 'a@a.fr', website: 'https://a.fr', services: ['entretien'] });
    expect(m.milestones.contacted).toBe('2026-01-01');
    expect(m.fieldSources.email).toMatchObject({ type: 'csv' });
  });

  it('les étapes du tunnel sont datées une seule fois', () => {
    let p = make({ name: 'A' });
    p = applyStatus(p, 'demo_scheduled', '2026-01-01');
    p = applyStatus(p, 'not_now', '2026-02-01');
    p = applyStatus(p, 'client', '2026-03-01');
    expect(p.milestones).toEqual({ contacted: '2026-01-01', replied: '2026-01-01', demo: '2026-01-01', trial: '2026-03-01', client: '2026-03-01' });
  });
});

describe('Filtres et tri', () => {
  const rows = [
    toRow(make({ name: 'Alpha Jardins', postalCode: '76000', city: 'Rouen', phone: '0611111111', website: 'https://a.fr', googleReviews: 120, googleUrl: 'g' })),
    toRow(make({ name: 'Beta Paysage', postalCode: '33000', city: 'Bordeaux', siren: '123456789' })),
    toRow({ ...make({ name: 'Gamma', postalCode: '76600', city: 'Le Havre' }), doNotContact: true }),
  ];

  it('recherche instantanée par nom, SIREN, ville, téléphone', () => {
    expect(rows.filter((r) => matchesFilter(r, { q: 'alpha' })).length).toBe(1);
    expect(rows.filter((r) => matchesFilter(r, { q: '123456789' }))[0]!.name).toBe('Beta Paysage');
    expect(rows.filter((r) => matchesFilter(r, { q: 'bordeaux' })).length).toBe(1);
    expect(rows.filter((r) => matchesFilter(r, { q: '06 11 11' })).length).toBe(1);
  });

  it('filtres combinés et exclusion par défaut des « Ne plus contacter »', () => {
    expect(rows.filter((r) => matchesFilter(r, { departments: ['76'] })).length).toBe(1);
    expect(rows.filter((r) => matchesFilter(r, { departments: ['76'], includeDoNotContact: true })).length).toBe(2);
    expect(rows.filter((r) => matchesFilter(r, { hasWebsite: 'no' })).map((r) => r.name)).toEqual(['Beta Paysage']);
    expect(rows.filter((r) => matchesFilter(r, { reviewsMin: 100, regions: ['28'] })).length).toBe(1);
    expect(rows.filter((r) => matchesFilter(r, { scoreMin: 80 })).length).toBe(0);
  });

  it('tri par score puis nom, inconnus en fin de liste', () => {
    expect(sortRows(rows, 'score')[0]!.name).toBe('Alpha Jardins');
    expect(sortRows(rows, 'reviews').map((r) => r.googleReviews)).toEqual([120, null, null]);
    expect(describeFilter({ scoreMin: 80, departments: ['76'], hasWebsite: 'no' })).toBe('Score ≥ 80 · Dép. 76 · Sans site');
  });
});

describe('Modèles de messages', () => {
  const settings = { saasName: 'Paysapro AI', signature: 'Adrien' };

  it('supprime les lignes dont une variable est inconnue (aucune invention)', () => {
    const vars = variablesFor(make({ name: 'Jardin Concept', city: 'Rouen' }), settings);
    const out = renderTemplate('Bonjour {{prenom|}},\nVous avez {{nombre_avis}} avis.\nÀ {{ville}}, {{nom_saas}}.\n{{signature}}', vars);
    expect(out).toBe('Bonjour,\nÀ Rouen, Paysapro AI.\nAdrien');
  });

  it('modèles intégrés : 8 catégories + message court ; tutoiement', () => {
    expect(builtInTemplates()).toHaveLength(9);
    expect(toInformal('Si le sujet vous intéresse, je peux vous montrer')).toBe("Si le sujet t'intéresse, je peux te montrer");
  });
});

describe('Intelligence commerciale', () => {
  it('raisons factuelles uniquement', () => {
    const p = make({ name: 'A', googleReviews: 87, googleRating: 4.8, website: 'https://a.fr', services: ['amenagement'] });
    expect(contactReasons(p)).toEqual([
      'Forte présence locale : 87 avis Google (note 4,8).',
      'Site internet actif : entreprise déjà présente en ligne.',
      'Activité orientée création / aménagement extérieur (projets à chiffrer).',
    ]);
    expect(contactReasons(make({ name: 'Vide' }))).toEqual([]);
  });

  it("l'angle est expliqué par les données utilisées", () => {
    expect(prospectingAngle(make({ name: 'A', googleReviews: 87 }))).toEqual({ angle: 'Suivi client', why: ['87 avis Google : beaucoup de clients particuliers à suivre.'] });
    expect(prospectingAngle(make({ name: 'B' })).angle).toBe('Professionnalisation');
  });
});

describe('Permissions et quotas', () => {
  it('RBAC', () => {
    expect(can('owner', 'prospecting.delete')).toBe(true);
    expect(can('sales', 'prospecting.delete')).toBe(false);
    expect(can('sales', 'prospecting.campaign')).toBe(true);
    expect(can('viewer', 'prospecting.export')).toBe(false);
    expect(() => assertCan('viewer', 'prospecting.edit')).toThrow(/non autorisée/);
  });

  it('quotas prêts mais illimités pour le propriétaire', () => {
    expect(quotaAllows('prospects_limit', 1_000_000)).toBe(true);
    expect(quotaAllows('prospects_limit', 100, 'FREE')).toBe(false);
    expect(PLAN_QUOTAS.PRO.prospects_limit).toBe(5000);
  });
});

describe('Géographie, normalisation, liens', () => {
  it('départements', () => {
    expect(departmentFromPostalCode('20167')).toBe('2A');
    expect(departmentFromPostalCode('20200')).toBe('2B');
    expect(departmentFromPostalCode('97400')).toBe('974');
    expect(normalizeDepartment('Seine-Maritime')).toBe('76');
    expect(normalizeDepartment('6')).toBe('06');
    expect(regionOfDepartment('33')).toBe('75');
  });

  it('normalisation', () => {
    expect(normPhone('+33 (0)2 35 12 34 56')).toBe('0235123456');
    expect(normPhone('12 34')).toBeNull();
    expect(normPhone('+33 2 35 12 34 56')).toBe('0235123456');
    expect(normUrl('www.jardins.fr/')).toBe('https://www.jardins.fr');
    expect(normUrl('non')).toBeNull();
    expect(titleCase("JARDINS DE L'EURE SARL")).toBe("Jardins de l'Eure SARL");
  });

  it('recherche Google et mailto construits dynamiquement', () => {
    expect(googleSearchUrl({ name: 'Jardin Concept', tradeName: null, city: 'Rouen' })).toBe('https://www.google.com/search?q=Jardin%20Concept%20Rouen%20paysagiste');
    expect(mailtoUrl('a@b.fr', 'Objet é', 'Ligne 1\nLigne 2')).toBe('mailto:a@b.fr?subject=Objet%20%C3%A9&body=Ligne%201%0ALigne%202');
  });
});

describe('Statistiques', () => {
  it('KPI, tunnel et géographie calculés depuis les données', () => {
    const now = new Date();
    const a = applyStatus(make({ name: 'A', postalCode: '76000' }), 'client', now.toISOString());
    const b = applyStatus(make({ name: 'B', postalCode: '76000' }), 'contacted', now.toISOString());
    const c = make({ name: 'C', postalCode: '33000' });
    const rows = [a, b, c].map(toRow);
    const k = computeKpis(rows, [], 1200);
    expect(k).toMatchObject({ total: 3, contacted: 2, clients: 1, conversionRate: 50, potentialValue: 2 * 1200 });
    expect(funnel(k).map((s) => s.count)).toEqual([3, 2, 1, 1, 1, 1]);
    expect(byGeo(rows, 'department')[0]).toMatchObject({ code: '76', label: 'Seine-Maritime', total: 2, clients: 1, conversionRate: 50 });
    const ev = evolution(rows, 'contacted', 'day', now);
    expect(ev).toHaveLength(30);
    expect(ev[29]!.count).toBe(2);
  });
});
