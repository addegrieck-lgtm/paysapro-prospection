import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { api, qs } from '../api';
import { useApp } from '../App';
import { FilterPanel, useFilters } from '../components/Filters';
import { Card, ErrorBox, Loading, Notice, OppBadge, PageHeader, ScoreCell } from '../components/ui';
import { OPP_HEX, OPP_LETTER, OPP_SHORT } from '../lib/format';

// [id, lat, lon, nom, secteur, type, score, risque, approx, commune]
type Point = [number, number, number, string, string | null, string | null, number | null, number | null, 0 | 1, string | null];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function haversine(a: [number, number], b: [number, number]) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export default function MapPage() {
  const { meta } = useApp();
  const f = useFilters();
  const query = { ...f.values };
  delete query.communeCenter;
  delete query.sort;
  delete query.page;
  const key = JSON.stringify(query);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Point | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    let alive = true;
    setPoints(null);
    api
      .get<{ points: Point[] }>(`/map${qs(query)}`)
      .then((r) => alive && setPoints(r.points))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = L.map(mapEl.current, { preferCanvas: true, zoomControl: true }).setView([49.65, 0.95], 9);
    L.tileLayer(meta.map.tileUrl, { attribution: meta.map.attribution, maxZoom: 19, className: 'tiles-dim' }).addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, [meta.map]);

  useEffect(() => {
    const m = map.current;
    if (!m || !points) return;
    layer.current?.remove();
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (cl) => L.divIcon({ html: `<div>${cl.getChildCount()}</div>`, className: 'marker-cluster-radar', iconSize: L.point(40, 40) }),
    });
    const icons = new Map<string, L.DivIcon>();
    const iconFor = (type: string | null, approx: boolean) => {
      const k = `${type}:${approx}`;
      if (!icons.has(k)) {
        icons.set(k, L.divIcon({ className: '', html: `<div class="marker-pin${approx ? ' approx' : ''}" style="background:${type ? OPP_HEX[type] : '#4b5873'}">${type ? OPP_LETTER[type] : ''}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }));
      }
      return icons.get(k)!;
    };
    const markers = points.map((p) => {
      const mk = L.marker([p[1], p[2]], { icon: iconFor(p[5], p[8] === 1), title: p[3], keyboard: true });
      mk.on('click', () => setSelected(p));
      mk.bindTooltip(esc(p[3]), { direction: 'top', offset: [0, -10] });
      return mk;
    });
    group.addLayers(markers);
    group.addTo(m);
    layer.current = group;
    if (points.length && (f.values.communes || f.values.radiusKm || f.values.q)) m.fitBounds(group.getBounds(), { maxZoom: 14, padding: [30, 30] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  const nearby = useMemo(() => {
    if (!selected || !points) return [];
    return points
      .filter((p) => p[0] !== selected[0] && p[5])
      .map((p) => ({ p, d: haversine([selected[1], selected[2]], [p[1], p[2]]) }))
      .filter((x) => x.d <= 15)
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
  }, [selected, points]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of points ?? []) c[p[5] ?? 'aucun'] = (c[p[5] ?? 'aucun'] ?? 0) + 1;
    return c;
  }, [points]);

  return (
    <div className="fade-in">
      <PageHeader title="Carte du 76" subtitle="Entreprises géolocalisées (adresse officielle géocodée, ou centre de la commune en pointillés lorsque l'adresse n'est pas géocodée)." />
      <FilterPanel f={f} />
      <ErrorBox error={error} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative overflow-hidden rounded-xl border border-ink-700">
          <div ref={mapEl} className="h-[68vh] min-h-[420px] w-full" role="application" aria-label="Carte des entreprises" />
          {!points && (
            <div className="absolute inset-0 z-[500] grid place-items-center bg-ink-900/60">
              <Loading label="Chargement des entreprises…" />
            </div>
          )}
          <div className="absolute bottom-3 left-3 z-[500] rounded-lg border border-ink-600 bg-ink-850/95 px-3 py-2 text-[11px]">
            {Object.entries(OPP_SHORT).map(([k, l]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-semibold text-white" style={{ background: OPP_HEX[k] }}>
                  {OPP_LETTER[k]}
                </span>
                {l} <span className="ml-auto pl-3 tabular text-fog-400">{counts[k] ?? 0}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full bg-[#4b5873]" />
              Sans signal <span className="ml-auto pl-3 tabular text-fog-400">{counts.aucun ?? 0}</span>
            </div>
          </div>
        </div>
        <Card title={selected ? 'Fiche rapide' : 'Sélection'}>
          {selected ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-semibold text-fog-50">{selected[3]}</div>
                <div className="text-xs text-fog-400">
                  {[selected[9], meta.sectors.find((s) => s.id === selected[4])?.label].filter(Boolean).join(' · ')}
                  {selected[8] === 1 && ' · position approximative (commune)'}
                </div>
              </div>
              <OppBadge type={selected[5]} />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  Score éco.
                  <br />
                  <ScoreCell value={selected[6]} />
                </div>
                <div>
                  Risque
                  <br />
                  <ScoreCell value={selected[7]} kind="risk" />
                </div>
              </div>
              <Link to={`/entreprises/${selected[0]}`} className="inline-block text-volt-300 hover:underline">
                Ouvrir la fiche complète →
              </Link>
              <div>
                <div className="mb-1 text-xs font-medium text-fog-300">Opportunités à moins de 15 km</div>
                {nearby.length ? (
                  <ul className="space-y-1 text-xs">
                    {nearby.map(({ p, d }) => (
                      <li key={p[0]} className="flex justify-between gap-2">
                        <button className="truncate text-left text-fog-100 hover:text-volt-300" onClick={() => (setSelected(p), map.current?.setView([p[1], p[2]], 14))}>
                          <span style={{ color: OPP_HEX[p[5]!] }}>●</span> {p[3]}
                        </button>
                        <span className="tabular text-fog-500">{d.toFixed(1)} km</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-fog-500">Aucune dans ce périmètre.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-fog-400">Cliquez sur un marqueur pour afficher la fiche rapide et les opportunités à proximité.</p>
          )}
          {points && <p className="mt-4 text-[11px] text-fog-500">{points.length.toLocaleString('fr-FR')} entreprise(s) géolocalisée(s) affichée(s).</p>}
          {points?.length === 0 && (
            <div className="mt-2">
              <Notice>Aucune entreprise géolocalisée pour ces filtres.</Notice>
            </div>
          )}
        </Card>
      </div>
      <p className="mt-2 text-[11px] text-fog-500">Fond de carte : {meta.map.attribution}. Le serveur de tuiles par défaut d'OpenStreetMap est destiné à un usage léger ; pour un usage soutenu, configurez un fournisseur de tuiles dans l'administration.</p>
    </div>
  );
}
