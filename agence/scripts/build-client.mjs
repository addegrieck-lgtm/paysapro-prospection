// Compile les scripts navigateur (src/client) vers public/assets/js.
import { build } from 'esbuild';

await build({
  entryPoints: { site: 'src/client/site.ts', configurator: 'src/client/configurator.ts', quote: 'src/client/quote.ts', admin: 'src/client/admin.ts' },
  outdir: 'public/assets/js',
  bundle: true,
  format: 'esm',
  target: ['es2020', 'safari15'],
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});
