// Contexte de l'application : base ouverte, « API » locale, paramètres, rafraîchissement automatique.
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { openProspectingDB } from '../data/db';
import { ProspectsApi, defaultSettings } from '../data/repository';
import { EnrichmentQueue, type QueueProgress } from '../data/enrichmentQueue';
import { dbCache } from '../data/cache';
import { RechercheEntreprisesProvider } from '../providers/company/RechercheEntreprisesProvider';
import { OpenStreetMapProvider, localBusinessQuery } from '../providers/company/OpenStreetMapProvider';
import { WebsiteProvider } from '../providers/company/WebsiteProvider';
import { EnrichmentEngine } from '../data/enrichmentEngine';
import { ENRICHMENT_CONFIG } from '../config';
import type { CompanyDataProvider } from '../providers/company/CompanyDataProvider';
import type { Settings } from '../domain/types';
import { can, type Permission } from '../domain/access';
import { requestPersistentStorage } from '../pwa';
import { autoBackup } from '../data/cloudBackup';
import { OFFERS, PAYSAPRO_WORKSPACE, offerByWorkspace, type Offer } from '../domain/offers';
import { applyOfferLabels } from '../domain/offerLabels';

/** Espace de travail Paysapro (historique, un seul utilisateur). Une version en ligne en créera un par compte. */
export const LOCAL_WORKSPACE = PAYSAPRO_WORKSPACE;

const WORKSPACE_STORE = 'paysapro.workspace';

/** Espace choisi sur cet appareil (Paysapro par défaut). */
function storedWorkspace(): string {
  try {
    const w = localStorage.getItem(WORKSPACE_STORE);
    return OFFERS.some((o) => o.workspaceId === w) ? w! : LOCAL_WORKSPACE;
  } catch {
    return LOCAL_WORKSPACE;
  }
}

interface AppContextValue {
  /** Offre prospectée dans l'espace actif (Paysapro AI ou Signe & Seine) */
  offer: Offer;
  /** Change d'espace : prospects, modèles, campagnes et paramètres de l'autre offre */
  switchWorkspace: (workspaceId: string) => void;
  api: ProspectsApi;
  /** Source officielle gratuite utilisée pour l'enrichissement */
  companyProvider: CompanyDataProvider;
  queue: EnrichmentQueue;
  engine: EnrichmentEngine;
  settings: Settings;
  reloadSettings: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: (error: string | null) => ReactNode }) {
  const [value, setValue] = useState<AppContextValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState(storedWorkspace);
  const apiRef = useRef<{ offer: Offer; switchWorkspace: (w: string) => void; api: ProspectsApi; companyProvider: CompanyDataProvider; queue: EnrichmentQueue; engine: EnrichmentEngine } | null>(null);

  const switchWorkspace = useCallback((w: string) => {
    if (!OFFERS.some((o) => o.workspaceId === w)) return;
    try {
      localStorage.setItem(WORKSPACE_STORE, w);
    } catch {
      // navigation privée : le choix vaut pour cette session uniquement
    }
    apiRef.current = null;
    setValue(null); // écran de chargement le temps d'ouvrir l'autre espace
    setWorkspaceId(w);
  }, []);

  const reloadSettings = useCallback(async () => {
    const refs = apiRef.current;
    if (!refs) return;
    const settings = await refs.api.getSettings();
    refs.api.ctx = { ...refs.api.ctx, role: settings.role, user: settings.userName || 'Moi' };
    setValue({ ...refs, settings, reloadSettings });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let started: EnrichmentQueue | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        const offer = offerByWorkspace(workspaceId);
        applyOfferLabels(offer); // vocabulaire de l'offre (RDV / devis pour l'agence) avant le premier rendu
        const db = await openProspectingDB();
        const stored = await db.get('settings', workspaceId);
        const settings = { ...defaultSettings(workspaceId), ...stored };
        const api = new ProspectsApi(db, { workspaceId, user: settings.userName || 'Moi', role: settings.role });
        await api.getSettings(); // contexte de score (départements ciblés)
        const companyProvider = new RechercheEntreprisesProvider({ cache: dbCache(db, 'company_enrichment_cache') });
        // Annuaire OpenStreetMap : paysagistes de France (instantané livré) ou commerces et artisans des départements ciblés
        const departments = settings.targetDepartments.length ? settings.targetDepartments : offer.defaultDepartments;
        const directory =
          offer.id === 'agence'
            ? new OpenStreetMapProvider({ cache: dbCache(db, 'data_cache'), cacheDays: 30, snapshotUrl: null, query: localBusinessQuery(departments), cacheKey: `osm:local:${[...departments].sort().join(',')}`, timeoutMs: 120_000 })
            : new OpenStreetMapProvider({ cache: dbCache(db, 'data_cache'), cacheDays: 30 });
        const website = new WebsiteProvider(ENRICHMENT_CONFIG.webProxyUrl, { cache: dbCache(db, 'company_enrichment_cache'), cacheDays: ENRICHMENT_CONFIG.cacheDays });
        const engine = new EnrichmentEngine(api, { official: companyProvider, directory, website });
        const queue = new EnrichmentQueue(api, engine);
        apiRef.current = { offer, switchWorkspace, api, companyProvider, queue, engine };
        await api.listTemplates(); // modèles intégrés au premier lancement
        if (!cancelled) setValue({ offer, switchWorkspace, api, companyProvider, queue, engine, settings, reloadSettings });
        // Une file d'enrichissement interrompue (onglet fermé) reprend automatiquement.
        // Seule l'instance active démarre la file (jamais deux files en parallèle sur les mêmes entreprises).
        if (cancelled) return;
        started = queue;
        const progress = await queue.refresh();
        if (progress.pending > 0 && !cancelled) void queue.start();
        void requestPersistentStorage();
        // Sauvegarde en ligne (si activée) : une fois par jour, à l'ouverture puis toutes les heures tant que l'onglet reste ouvert
        const backup = () => void autoBackup(api).catch((e) => console.warn('Sauvegarde en ligne :', e));
        backup();
        timer = setInterval(backup, 3_600_000);
      } catch (e) {
        console.error(e);
        if (!cancelled)
          setError(e instanceof Error && e.name === 'StorageBlockedError' ? e.message : "Impossible d'ouvrir le stockage local. Désactivez la navigation privée puis rechargez la page.");
      }
    })();
    return () => {
      cancelled = true;
      started?.stop();
      clearInterval(timer);
    };
  }, [reloadSettings, switchWorkspace, workspaceId]);

  if (!value) return <>{fallback(error)}</>;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp hors AppProvider');
  return v;
}

export function useCan(permission: Permission): boolean {
  return can(useApp().settings.role, permission);
}

/** Progression de la file d'enrichissement (mise à jour en direct). */
export function useQueueProgress(): QueueProgress {
  const { queue } = useApp();
  const [p, setP] = useState<QueueProgress>(queue.getProgress());
  useEffect(() => queue.subscribe(setP), [queue]);
  return p;
}

/** Numéro de version des données : change à chaque écriture (pour rafraîchir les écrans). */
export function useRevision(): number {
  const { api } = useApp();
  const ref = useRef(0);
  return useSyncExternalStore(
    useCallback(
      (cb) =>
        api.subscribe(() => {
          ref.current++;
          cb();
        }),
      [api],
    ),
    () => ref.current,
  );
}

/** Charge une donnée asynchrone et la recharge quand les données changent. */
export function useQuery<T>(load: (api: ProspectsApi) => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; error: string | null } {
  const { api } = useApp();
  const revision = useRevision();
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: string | null }>({ data: undefined, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    load(api)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((e: unknown) => alive && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Erreur' })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, revision, ...deps]);
  return state;
}

export function useDebounced<T>(value: T, delay = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
