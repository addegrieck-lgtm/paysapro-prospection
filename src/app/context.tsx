// Contexte de l'application : base ouverte, « API » locale, paramètres, rafraîchissement automatique.
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { openProspectingDB } from '../data/db';
import { ProspectsApi, defaultSettings } from '../data/repository';
import { EnrichmentQueue, type QueueProgress } from '../data/enrichmentQueue';
import { dbCache } from '../data/cache';
import { RechercheEntreprisesProvider } from '../providers/company/RechercheEntreprisesProvider';
import { OpenStreetMapProvider } from '../providers/company/OpenStreetMapProvider';
import { WebsiteProvider } from '../providers/company/WebsiteProvider';
import { EnrichmentEngine } from '../data/enrichmentEngine';
import { ENRICHMENT_CONFIG } from '../config';
import type { CompanyDataProvider } from '../providers/company/CompanyDataProvider';
import type { Settings } from '../domain/types';
import { can, type Permission } from '../domain/access';
import { requestPersistentStorage } from '../pwa';

/** Espace de travail local (un seul utilisateur). Une version en ligne en créera un par compte. */
export const LOCAL_WORKSPACE = 'local';

interface AppContextValue {
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
  const apiRef = useRef<{ api: ProspectsApi; companyProvider: CompanyDataProvider; queue: EnrichmentQueue; engine: EnrichmentEngine } | null>(null);

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
    (async () => {
      try {
        const db = await openProspectingDB();
        const stored = await db.get('settings', LOCAL_WORKSPACE);
        const settings = { ...defaultSettings(LOCAL_WORKSPACE), ...stored };
        const api = new ProspectsApi(db, { workspaceId: LOCAL_WORKSPACE, user: settings.userName || 'Moi', role: settings.role });
        await api.getSettings(); // contexte de score (départements ciblés)
        const companyProvider = new RechercheEntreprisesProvider({ cache: dbCache(db, 'company_enrichment_cache') });
        const directory = new OpenStreetMapProvider({ cache: dbCache(db, 'data_cache'), cacheDays: 30 });
        const website = new WebsiteProvider(ENRICHMENT_CONFIG.webProxyUrl, { cache: dbCache(db, 'company_enrichment_cache'), cacheDays: ENRICHMENT_CONFIG.cacheDays });
        const engine = new EnrichmentEngine(api, { official: companyProvider, directory, website });
        const queue = new EnrichmentQueue(api, engine);
        apiRef.current = { api, companyProvider, queue, engine };
        await api.listTemplates(); // modèles intégrés au premier lancement
        if (!cancelled) setValue({ api, companyProvider, queue, engine, settings, reloadSettings });
        // Une file d'enrichissement interrompue (onglet fermé) reprend automatiquement.
        // Seule l'instance active démarre la file (jamais deux files en parallèle sur les mêmes entreprises).
        if (cancelled) return;
        started = queue;
        const progress = await queue.refresh();
        if (progress.pending > 0 && !cancelled) void queue.start();
        void requestPersistentStorage();
      } catch (e) {
        console.error(e);
        if (!cancelled)
          setError(e instanceof Error && e.name === 'StorageBlockedError' ? e.message : "Impossible d'ouvrir le stockage local. Désactivez la navigation privée puis rechargez la page.");
      }
    })();
    return () => {
      cancelled = true;
      started?.stop();
    };
  }, [reloadSettings]);

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
