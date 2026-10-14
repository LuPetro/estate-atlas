import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const pkg = JSON.parse(
  await readFile(new URL('../apps/api/package.json', import.meta.url), 'utf8'),
);
await build({
  entryPoints: [
    'server',
    'migrate',
    'worker',
    'reprocess-analysis',
    'bootstrap-admin',
    'recover-admin',
    'maintenance',
    'monitor',
  ].map((name) => new URL(`../apps/api/src/${name}.ts`, import.meta.url).pathname),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  outdir: new URL('../apps/api/dist/', import.meta.url).pathname,
  outExtension: { '.js': '.mjs' },
  external: Object.keys(pkg.dependencies).filter((n) => !n.startsWith('@estate-atlas/')),
  logLevel: 'info',
});
