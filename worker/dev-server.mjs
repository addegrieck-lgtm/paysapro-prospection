// Relais web en local (tests, ou usage sur votre ordinateur sans Cloudflare) :
//   node worker/dev-server.mjs          → http://localhost:8787
// Puis dans .env.local : VITE_WEB_PROXY_URL=http://localhost:8787
import { createServer } from 'node:http';
import { handle } from './web-proxy.js';

const PORT = Number(process.env.PORT || 8787);

createServer(async (req, res) => {
  const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers });
  const response = await handle(request, { ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*' });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`Relais web Paysapro : http://localhost:${PORT}`));
