/**
 * Outils de test. Les réponses simulées reproduisent le FORMAT documenté des API (structure des champs) avec des
 * entreprises explicitement FICTIVES (SIREN 9990000xx). Elles ne sont utilisées que par les tests.
 */
import { openNodeDb } from '../src/server/db/sqlite-node';
import { prepareDatabase } from '../src/server/db/bootstrap';
import type { FetchLike } from '../src/server/lib/http';

export const S1 = '999000011';
export const S2 = '999000029';
export const S3 = '999000037';
export const S4 = '999000045';

export async function testDb() {
  const db = openNodeDb(':memory:');
  await prepareDatabase(db);
  return db;
}

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/** Faux fetch : chaque route est un préfixe d'URL associé à un gestionnaire ; les appels sont journalisés. */
export function fakeFetch(routes: [string, Handler][]): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (input: string, init?: RequestInit) => {
    calls.push(input);
    const u = new URL(input);
    for (const [prefix, h] of routes) if (input.startsWith(prefix)) return h(u, init);
    return new Response('not found', { status: 404 });
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export function reCompany(siren: string, o: Record<string, unknown> = {}) {
  return {
    siren,
    nom_complet: `ENTREPRISE FICTIVE ${siren}`,
    nom_raison_sociale: `ENTREPRISE FICTIVE ${siren}`,
    sigle: null,
    activite_principale: '81.30Z',
    categorie_entreprise: 'PME',
    date_creation: '1998-04-01',
    etat_administratif: 'A',
    nature_juridique: '5499',
    tranche_effectif_salarie: '03',
    annee_tranche_effectif_salarie: '2023',
    nombre_etablissements: 2,
    nombre_etablissements_ouverts: 1,
    siege: {
      siret: `${siren}00011`,
      adresse: '1 RUE FICTIVE 76000 ROUEN',
      code_postal: '76000',
      commune: '76540',
      libelle_commune: 'ROUEN',
      latitude: '49.44',
      longitude: '1.09',
      est_siege: true,
      etat_administratif: 'A',
      activite_principale: '81.30Z',
      date_creation: '1998-04-01',
      tranche_effectif_salarie: '03',
      liste_enseignes: ['JARDINS FICTIFS'],
    },
    matching_etablissements: [
      { siret: `${siren}00029`, adresse: '2 RUE FICTIVE 76600 LE HAVRE', code_postal: '76600', commune: '76351', libelle_commune: 'LE HAVRE', latitude: '49.49', longitude: '0.11', est_siege: false, etat_administratif: 'F' },
    ],
    dirigeants: [
      { type_dirigeant: 'personne physique', nom: 'TESTEUR', prenoms: 'Camille', annee_de_naissance: '1960', date_de_naissance: '1960-01', qualite: 'Gérant' },
      { type_dirigeant: 'personne morale', denomination: 'HOLDING FICTIVE', siren: '999000045', qualite: 'Associé' },
    ],
    finances: { '2022': { ca: 800000, resultat_net: 40000 }, '2023': { ca: 900000, resultat_net: 55000 } },
    complements: { est_entrepreneur_individuel: false },
    ...o,
  };
}

export function bodaccRecord(o: Record<string, unknown>) {
  return {
    id: 'A202400000001',
    dateparution: '2024-01-15',
    parution: '20240010',
    numeroannonce: 1,
    typeavis: 'annonce',
    typeavis_lib: 'Avis initial',
    familleavis: 'collective',
    familleavis_lib: 'Procédures collectives',
    numerodepartement: '76',
    tribunal: 'TRIBUNAL DE COMMERCE DE ROUEN',
    commercant: 'ENTREPRISE FICTIVE',
    ville: 'Rouen',
    cp: '76000',
    registre: [`${S1.slice(0, 3)} ${S1.slice(3, 6)} ${S1.slice(6)}`, S1],
    url_complete: 'https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:A202400000001',
    ...o,
  };
}
