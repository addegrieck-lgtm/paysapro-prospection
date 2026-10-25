import { Hono } from 'hono';
import type { AppEnv } from '../../app/context';
import { page } from './helpers';
import { Kpi } from '../../web/admin/ui';
import { addDays, formatDateTime, formatShortDate, todayParis } from '../../domain/dates';
import { DEVICE_LABELS, MEDIUM_LABELS, type Device, type Medium } from '../../domain/analytics';
import { purgeAnalytics } from '../../services/analytics';

export const statsRoutes = new Hono<AppEnv>();

const PERIODS = [
  [7, '7 jours'],
  [30, '30 jours'],
  [90, '3 mois'],
  [365, '12 mois'],
] as const;

const nf = new Intl.NumberFormat('fr-FR');
const pct = (part: number, total: number) => (total ? `${String(Math.round((part / total) * 1000) / 10).replace('.', ',')} %` : '—');

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  if (!code) return 'Inconnu';
  try {
    regionNames ??= new Intl.DisplayNames(['fr'], { type: 'region' });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const sourceLabel = (medium: string, source: string) =>
  medium === 'direct' ? 'Accès direct' : medium === 'inconnu' ? 'Inconnue' : source || MEDIUM_LABELS[medium as Medium] || medium;

interface Row {
  label: string;
  value: number;
  hint?: string;
  href?: string;
}

/** Tableau classé avec barre de proportion (une seule teinte, valeur et pourcentage toujours écrits). */
function Ranking({ title, col, rows, total, unit, empty }: { title: string; col: string; rows: Row[]; total: number; unit: string; empty: string }) {
  return (
    <div class="panel">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p class="muted">{empty}</p>
      ) : (
        <table class="data stat-table">
          <thead>
            <tr>
              <th scope="col">{col}</th>
              <th scope="col" class="num">
                {unit}
              </th>
              <th scope="col" class="num">
                Part
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>
                  <span class="stat-label">{r.href ? <a href={r.href}>{r.label}</a> : r.label}</span>
                  {r.hint && <span class="small muted"> · {r.hint}</span>}
                  <span class="stat-bar" aria-hidden="true">
                    <span style={`width:${total ? Math.max(1, Math.round((r.value / total) * 100)) : 0}%`}></span>
                  </span>
                </td>
                <td class="num">{nf.format(r.value)}</td>
                <td class="num">{pct(r.value, total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Histogramme des visiteurs : une barre par jour (par mois sur 12 mois), infobulle au survol, tableau équivalent. */
function TrafficChart({ points, unitLabel }: { points: { key: string; label: string; visitors: number; views: number }[]; unitLabel: string }) {
  const max = Math.max(1, ...points.map((p) => p.visitors));
  const step = 12;
  const h = 120;
  const w = points.length * step;
  const total = points.reduce((a, p) => a + p.visitors, 0);
  return (
    <div class="panel">
      <div class="panel-head">
        <h2>Visiteurs par {unitLabel}</h2>
        <span class="small muted">Maximum : {nf.format(max)}</span>
      </div>
      <svg class="stat-chart" viewBox={`0 0 ${w} ${h + 2}`} preserveAspectRatio="none" role="img" aria-label={`Visiteurs par ${unitLabel} : ${nf.format(total)} au total sur la période`}>
        <line x1="0" x2={w} y1={h + 1} y2={h + 1} class="stat-axis" />
        {points.map((p, i) => {
          const bh = p.visitors ? Math.max(2, Math.round((p.visitors / max) * (h - 4))) : 0;
          return (
            <g class="stat-col">
              <rect x={i * step} y="0" width={step} height={h + 2} class="stat-hit">
                <title>{`${p.label} : ${p.visitors} visiteur${p.visitors > 1 ? 's' : ''}, ${p.views} page${p.views > 1 ? 's' : ''} vue${p.views > 1 ? 's' : ''}`}</title>
              </rect>
              {bh > 0 && <rect x={i * step + 2} y={h - bh} width={step - 4} height={bh} rx="2" class="stat-mark" />}
            </g>
          );
        })}
      </svg>
      <div class="stat-axis-labels small muted">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
      <details class="small">
        <summary>Voir en tableau</summary>
        <table class="data">
          <thead>
            <tr>
              <th scope="col">{unitLabel === 'mois' ? 'Mois' : 'Jour'}</th>
              <th scope="col" class="num">
                Visiteurs
              </th>
              <th scope="col" class="num">
                Pages vues
              </th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr>
                <td>{p.label}</td>
                <td class="num">{p.visitors}</td>
                <td class="num">{p.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

statsRoutes.get('/statistiques', async (c) => {
  const { db } = c.get('deps');
  const s = c.get('settings');
  const days = PERIODS.find(([d]) => String(d) === c.req.query('periode'))?.[0] ?? 30;
  const to = todayParis();
  const from = addDays(to, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  const range = [from, to];
  // Purge des mesures trop anciennes, de temps en temps (sans tâche planifiée).
  if (Math.random() < 0.1) await purgeAnalytics(c);

  const one = async (sql: string, params: string[]) => (await db.get<{ n: number }>(sql, params))?.n ?? 0;
  const visitorsSql = 'SELECT COUNT(*) AS n FROM (SELECT DISTINCT day, visitor FROM page_views WHERE status = 200 AND day BETWEEN ? AND ?)';
  const [visitors, prevVisitors, views, visits, requests, prevRequests, messages] = await Promise.all([
    one(visitorsSql, range),
    one(visitorsSql, [prevFrom, prevTo]),
    one('SELECT COUNT(*) AS n FROM page_views WHERE status = 200 AND day BETWEEN ? AND ?', range),
    one('SELECT COUNT(*) AS n FROM page_views WHERE status = 200 AND entry = 1 AND day BETWEEN ? AND ?', range),
    one("SELECT COUNT(*) AS n FROM conversions WHERE kind = 'devis' AND day BETWEEN ? AND ?", range),
    one("SELECT COUNT(*) AS n FROM conversions WHERE kind = 'devis' AND day BETWEEN ? AND ?", [prevFrom, prevTo]),
    one("SELECT COUNT(*) AS n FROM conversions WHERE kind = 'contact' AND day BETWEEN ? AND ?", range),
  ]);

  // Courbe : par jour (par mois sur 12 mois), jours sans visite inclus.
  const monthly = days > 90;
  const bucket = monthly ? 'substr(day, 1, 7)' : 'day';
  const series = await db.all<{ k: string; visitors: number; views: number }>(
    `SELECT ${bucket} AS k, COUNT(DISTINCT day || visitor) AS visitors, COUNT(*) AS views FROM page_views WHERE status = 200 AND day BETWEEN ? AND ? GROUP BY k`,
    range,
  );
  const byKey = new Map(series.map((r) => [r.k, r]));
  const keys: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = monthly ? d.slice(0, 7) : d;
    if (keys.at(-1) !== k) keys.push(k);
  }
  const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const points = keys.map((k) => ({
    key: k,
    label: monthly ? monthFmt.format(new Date(`${k}-15T12:00:00Z`)) : formatShortDate(k),
    visitors: byKey.get(k)?.visitors ?? 0,
    views: byKey.get(k)?.views ?? 0,
  }));

  const [sources, mediums, pages, landings, devices, countries, convBySource, recent] = await Promise.all([
    db.all<{ medium: string; source: string; n: number }>(
      'SELECT medium, source, COUNT(*) AS n FROM page_views WHERE status = 200 AND entry = 1 AND day BETWEEN ? AND ? GROUP BY medium, source ORDER BY n DESC LIMIT 15',
      range,
    ),
    db.all<{ medium: string; n: number }>('SELECT medium, COUNT(*) AS n FROM page_views WHERE status = 200 AND entry = 1 AND day BETWEEN ? AND ? GROUP BY medium ORDER BY n DESC', range),
    db.all<{ path: string; n: number; v: number }>(
      'SELECT path, COUNT(*) AS n, COUNT(DISTINCT day || visitor) AS v FROM page_views WHERE status = 200 AND day BETWEEN ? AND ? GROUP BY path ORDER BY n DESC LIMIT 15',
      range,
    ),
    db.all<{ path: string; n: number }>('SELECT path, COUNT(*) AS n FROM page_views WHERE status = 200 AND entry = 1 AND day BETWEEN ? AND ? GROUP BY path ORDER BY n DESC LIMIT 10', range),
    db.all<{ device: string; n: number }>('SELECT device, COUNT(*) AS n FROM page_views WHERE status = 200 AND entry = 1 AND day BETWEEN ? AND ? GROUP BY device ORDER BY n DESC', range),
    db.all<{ country: string; n: number }>('SELECT country, COUNT(*) AS n FROM page_views WHERE status = 200 AND entry = 1 AND day BETWEEN ? AND ? GROUP BY country ORDER BY n DESC LIMIT 10', range),
    db.all<{ medium: string; source: string; devis: number; contact: number }>(
      `SELECT medium, source, SUM(kind = 'devis') AS devis, SUM(kind = 'contact') AS contact FROM conversions WHERE day BETWEEN ? AND ?
       GROUP BY medium, source ORDER BY devis + contact DESC LIMIT 15`,
      range,
    ),
    db.all<{ created_at: string; medium: string; source: string; campaign: string; path: string; device: string; country: string }>(
      'SELECT created_at, medium, source, campaign, path, device, country FROM page_views WHERE status = 200 AND entry = 1 ORDER BY id DESC LIMIT 25',
    ),
  ]);
  const notFound = await db.all<{ path: string; n: number }>(
    'SELECT path, COUNT(*) AS n FROM page_views WHERE status = 404 AND day BETWEEN ? AND ? GROUP BY path ORDER BY n DESC LIMIT 10',
    range,
  );
  const visitsBySource = new Map(sources.map((r) => [`${r.medium}|${r.source}`, r.n]));

  const trend = (now: number, before: number) => {
    if (!before) return now ? 'Nouvelle période de mesure' : 'Aucune donnée sur la période précédente';
    const d = Math.round(((now - before) / before) * 100);
    return `${d >= 0 ? '+' : ''}${d} % par rapport aux ${days} jours précédents`;
  };
  const base = (s.siteUrl || new URL(c.req.url).origin).replace(/\/+$/, '');

  return page(
    c,
    'Statistiques du site',
    <>
      <nav class="filters" aria-label="Période">
        {PERIODS.map(([d, label]) => (
          <a href={`/admin/statistiques?periode=${d}`} class={`btn ${d === days ? '' : 'btn-outline'}`} aria-current={d === days ? 'page' : undefined}>
            {label}
          </a>
        ))}
        <span class="small muted" style="align-self:center">
          Du {formatShortDate(from)} au {formatShortDate(to)}
        </span>
      </nav>

      <div class="grid-kpi">
        <Kpi label="Visiteurs" value={nf.format(visitors)} hint={trend(visitors, prevVisitors)} />
        <Kpi label="Visites" value={nf.format(visits)} hint="Arrivées sur le site (une personne peut venir plusieurs fois)" />
        <Kpi label="Pages vues" value={nf.format(views)} hint={visits ? `${String(Math.round((views / visits) * 10) / 10).replace('.', ',')} pages par visite` : undefined} />
        <Kpi label="Demandes de devis" value={nf.format(requests)} hint={trend(requests, prevRequests)} href="/admin/demandes" />
        <Kpi label="Messages (contact)" value={nf.format(messages)} href="/admin/crm" />
        <Kpi label="Taux de conversion" value={pct(requests + messages, visits)} hint="Demandes et messages / visites" />
      </div>

      <TrafficChart points={points} unitLabel={monthly ? 'mois' : 'jour'} />

      <div class="cols">
        <Ranking
          title="D’où viennent les visiteurs"
          col="Provenance"
          unit="visites"
          total={visits}
          rows={sources.map((r) => ({ label: sourceLabel(r.medium, r.source), value: r.n, hint: r.medium === 'direct' ? undefined : MEDIUM_LABELS[r.medium as Medium] }))}
          empty="Aucune visite enregistrée sur la période."
        />
        <Ranking
          title="Par type de provenance"
          col="Type"
          unit="visites"
          total={visits}
          rows={mediums.map((r) => ({ label: MEDIUM_LABELS[r.medium as Medium] ?? r.medium, value: r.n }))}
          empty="Aucune visite enregistrée sur la période."
        />
      </div>

      <div class="panel">
        <h2>Demandes reçues selon la provenance</h2>
        {convBySource.length === 0 ? (
          <p class="muted">Aucune demande de devis ni message sur la période.</p>
        ) : (
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th scope="col">Provenance de la visite</th>
                  <th scope="col" class="num">
                    Demandes de devis
                  </th>
                  <th scope="col" class="num">
                    Messages
                  </th>
                  <th scope="col" class="num">
                    Taux de conversion
                  </th>
                </tr>
              </thead>
              <tbody>
                {convBySource.map((r) => {
                  const v = visitsBySource.get(`${r.medium}|${r.source}`) ?? 0;
                  return (
                    <tr>
                      <td>{sourceLabel(r.medium, r.source)}</td>
                      <td class="num">{r.devis}</td>
                      <td class="num">{r.contact}</td>
                      <td class="num">{pct(r.devis + r.contact, v)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div class="cols">
        <Ranking
          title="Pages les plus vues"
          col="Page"
          unit="vues"
          total={views}
          rows={pages.map((r) => ({ label: r.path, value: r.n, hint: `${r.v} visiteur${r.v > 1 ? 's' : ''}`, href: r.path }))}
          empty="Aucune page vue sur la période."
        />
        <Ranking
          title="Pages d’arrivée"
          col="Page"
          unit="visites"
          total={visits}
          rows={landings.map((r) => ({ label: r.path, value: r.n, href: r.path }))}
          empty="Aucune visite enregistrée sur la période."
        />
      </div>

      <div class="cols">
        <Ranking
          title="Appareils"
          col="Appareil"
          unit="visites"
          total={visits}
          rows={devices.map((r) => ({ label: DEVICE_LABELS[r.device as Device] ?? r.device, value: r.n }))}
          empty="Aucune visite enregistrée sur la période."
        />
        <Ranking
          title="Pays"
          col="Pays"
          unit="visites"
          total={visits}
          rows={countries.map((r) => ({ label: countryName(r.country), value: r.n }))}
          empty="Aucune visite enregistrée sur la période."
        />
      </div>

      <div class="panel">
        <h2>Dernières visites</h2>
        {recent.length === 0 ? (
          <p class="muted">Aucune visite pour le moment. Les visites apparaissent ici dès qu’une personne ouvre le site (vos propres visites, lorsque vous êtes connecté, ne sont pas comptées).</p>
        ) : (
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Provenance</th>
                  <th scope="col">Page d’arrivée</th>
                  <th scope="col">Appareil</th>
                  <th scope="col">Pays</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>
                      {sourceLabel(r.medium, r.source)}
                      {r.campaign && <span class="small muted"> · {r.campaign}</span>}
                    </td>
                    <td>{r.path}</td>
                    <td>{DEVICE_LABELS[r.device as Device] ?? r.device}</td>
                    <td>{countryName(r.country)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {notFound.length > 0 && (
        <Ranking
          title="Pages introuvables demandées (liens cassés)"
          col="Adresse demandée"
          unit="vues"
          total={notFound.reduce((a, r) => a + r.n, 0)}
          rows={notFound.map((r) => ({ label: r.path, value: r.n, hint: 'à rediriger dans Contenus → Redirections' }))}
          empty=""
        />
      )}

      <div class="panel">
        <h2>Savoir précisément d’où viennent vos clients</h2>
        <p>
          Ajoutez une étiquette aux liens que vous diffusez : la provenance apparaît alors en clair ci-dessus (« Campagne »). Exemples prêts à copier :
        </p>
        <ul class="small stat-links">
          <li>
            Fiche Google (champ « Site Web ») : <code>{`${base}/?utm_source=fiche-google&utm_medium=fiche`}</code>
          </li>
          <li>
            QR code d’un flyer : <code>{`${base}/?utm_source=flyer&utm_medium=print&utm_campaign=flyer-2026`}</code>
          </li>
          <li>
            Signature e-mail : <code>{`${base}/?utm_source=signature-email&utm_medium=email`}</code>
          </li>
          <li>
            Page Facebook ou Instagram : <code>{`${base}/?utm_source=facebook&utm_medium=social`}</code>
          </li>
        </ul>
        <p class="small muted">
          Mesure interne, sans cookie et sans service extérieur : aucun bandeau de consentement n’est nécessaire. Les visiteurs sont comptés une fois par jour
          (empreinte anonyme renouvelée chaque jour), les robots (y compris les requêtes venues de centres de données : Amazon, Google Cloud, Microsoft, OVH…) et vos propres visites sont exclus, les pages introuvables (404) ne comptent pas comme des visites, les données sont conservées 13 mois. Les mots-clés tapés
          dans Google ne sont jamais transmis aux sites : consultez-les dans Google Search Console.
        </p>
      </div>
    </>,
    { wide: true },
  );
});
