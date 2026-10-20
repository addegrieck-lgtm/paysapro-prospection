// Construit le serveur Node de production (dist/server/node.js) et vérifie que le code Workers
// ne dépend d'aucun module Node (il doit tourner dans le runtime Cloudflare).
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server/node.ts'],
  outfile: 'dist/server/node.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx',
  sourcemap: true,
  logLevel: 'info',
});

const worker = await build({
  entryPoints: ['src/server/worker.ts'],
  outfile: 'dist/worker/worker.js',
  bundle: true,
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['workerd', 'worker', 'browser'],
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx',
  metafile: true,
  logLevel: 'warning',
});
const nodeImports = Object.values(worker.metafile.inputs).flatMap((i) => i.imports).filter((i) => i.external && i.path.startsWith('node:'));
if (nodeImports.length) {
  console.error('Le code Workers importe des modules Node :', nodeImports.map((i) => i.path));
  process.exit(1);
}
console.log('Bundle Workers vérifié : aucun module Node.');
