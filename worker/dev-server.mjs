// Relais web en local (tests, ou usage sur votre ordinateur sans Cloudflare) :
//   node worker/dev-server.mjs          → http://localhost:8787
// Puis dans .env.local : VITE_WEB_PROXY_URL=http://localhost:8787
// La sauvegarde en ligne y est simulée en mémoire (perdue à l'arrêt du serveur).
import { createServer } from 'node:http';
import { handle } from './web-proxy.js';

const PORT = Number(process.env.PORT || 8787);
const memory = new Map();
const BACKUPS = {
  async put(key, value, options) {
    memory.set(key, { value, metadata: options?.metadata ?? null });
  },
  async getWithMetadata(key) {
    return memory.get(key) ?? { value: null, metadata: null };
  },
};

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body });
  const response = await handle(request, { ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*', BACKUPS });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`Relais web Paysapro : http://localhost:${PORT}`));
