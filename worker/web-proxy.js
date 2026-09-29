// Relais de lecture de sites web pour Paysapro Prospection — Cloudflare Worker (offre gratuite).
//
// Rôle : permettre à l'application (site statique) de lire la page d'accueil / contact / mentions légales du
// SITE D'UNE ENTREPRISE, ce que le navigateur interdit directement (CORS). Garde-fous :
//   • GET uniquement, pages HTML publiques (http/https) et plan du site (sitemap*.xml), 1,5 Mo maximum, 10 s maximum ;
//   • robots.txt respecté ; identification claire (User-Agent) ;
//   • moteurs de recherche, annuaires, réseaux sociaux et cartes REFUSÉS (leurs conditions l'interdisent) ;
//   • adresses privées / locales refusées (sécurité) ;
//   • seules les origines autorisées (ALLOWED_ORIGINS) peuvent l'appeler.
// Déploiement : voir worker/README.md.

const BLOCKED = /(^|\.)(google\.[a-z.]+|googleusercontent\.com|gstatic\.com|bing\.com|duckduckgo\.com|qwant\.com|yahoo\.[a-z.]+|pagesjaunes\.fr|pagesblanches\.fr|societe\.com|pappers\.fr|verif\.com|infogreffe\.fr|facebook\.com|instagram\.com|linkedin\.com|tiktok\.com|twitter\.com|x\.com|youtube\.com|openstreetmap\.org|yelp\.[a-z.]+|tripadvisor\.[a-z.]+|houzz\.[a-z.]+|travaux\.com|habitatpresto\.com|starofservice\.[a-z.]+)$/i;
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|.*\.local$|.*\.internal$)/i;
const UA = 'PaysaproProspection/1.0 (lecture des coordonnees publiques; +https://addegrieck-lgtm.github.io/paysapro-prospection/)';
const MAX_BYTES = 1_500_000;

function cors(origin, allowed) {
  const ok = !allowed || allowed === '*' || allowed.split(',').map((s) => s.trim()).includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

/** Lecture minimale de robots.txt : règles « Disallow » des sections « * » et PaysaproProspection. */
async function allowedByRobots(target, fetchImpl) {
  try {
    const res = await fetchImpl(`${target.origin}/robots.txt`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return true;
    const lines = (await res.text()).split(/\r?\n/);
    let applies = false;
    const disallow = [];
    for (const raw of lines) {
      const line = raw.split('#')[0].trim();
      const [k, ...rest] = line.split(':');
      const v = rest.join(':').trim();
      if (/^user-agent$/i.test(k)) applies = v === '*' || /paysapro/i.test(v);
      else if (applies && /^disallow$/i.test(k) && v) disallow.push(v);
    }
    return !disallow.some((rule) => target.pathname.startsWith(rule));
  } catch {
    return true;
  }
}

export async function handle(request, env = {}, fetchImpl = fetch) {
  const origin = request.headers.get('Origin') || '';
  const headers = cors(origin, env.ALLOWED_ORIGINS);
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'GET') return json({ ok: false, error: 'Méthode non autorisée' }, 405, headers);
  if (env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS !== '*' && headers['Access-Control-Allow-Origin'] === 'null') return json({ ok: false, error: 'Origine non autorisée' }, 403, headers);

  const raw = new URL(request.url).searchParams.get('url');
  let target;
  try {
    target = new URL(raw || '');
  } catch {
    return json({ ok: false, status: 400, url: raw, html: '', error: 'URL invalide' }, 400, headers);
  }
  if (!/^https?:$/.test(target.protocol) || PRIVATE.test(target.hostname)) return json({ ok: false, status: 400, url: raw, html: '', error: 'Adresse refusée' }, 400, headers);
  if (BLOCKED.test(target.hostname)) return json({ ok: false, status: 451, url: raw, html: '', error: 'Site non autorisé (annuaire, moteur de recherche ou réseau social)' }, 200, headers);
  if (!(await allowedByRobots(target, fetchImpl))) return json({ ok: false, status: 403, url: raw, html: '', error: 'Refusé par robots.txt' }, 200, headers);

  try {
    const res = await fetchImpl(target.toString(), {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.8','Accept-Language': 'fr-FR,fr;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    const type = res.headers.get('content-type') || '';
    // Pages HTML, plus le plan du site (sitemap*.xml) : il sert uniquement à repérer les pages contact / mentions
    const sitemap = /\/sitemap[^/]*\.xml$/i.test(target.pathname) && /xml/i.test(type);
    if (!res.ok || !(/text\/html|application\/xhtml/i.test(type) || sitemap)) return json({ ok: false, status: res.status, url: res.url || raw, html: '' }, 200, headers);
    const final = new URL(res.url || target.toString());
    if (BLOCKED.test(final.hostname)) return json({ ok: false, status: 451, url: final.toString(), html: '', error: 'Redirection vers un site non autorisé' }, 200, headers);
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size > MAX_BYTES ? MAX_BYTES : size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c.subarray(0, Math.min(c.length, bytes.length - offset)), offset);
      offset += c.length;
      if (offset >= bytes.length) break;
    }
    const html = new TextDecoder('utf-8').decode(bytes);
    return json({ ok: true, status: res.status, url: final.toString(), html }, 200, { ...headers, 'Cache-Control': 'public, max-age=86400' });
  } catch (e) {
    return json({ ok: false, status: 0, url: raw, html: '', error: e && e.name === 'TimeoutError' ? 'Délai dépassé' : 'Site injoignable' }, 200, headers);
  }
}

export default { fetch: (request, env) => handle(request, env) };
