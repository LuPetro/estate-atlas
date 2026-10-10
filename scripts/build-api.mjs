import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const pkg = JSON.parse(
  await readFile(new URL('../apps/api/package.json', import.meta.url), 'utf8'),
);
await build({
  entryPoints: [new URL('../apps/api/src/server.ts', import.meta.url).pathname],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  outfile: new URL('../apps/api/dist/server.mjs', import.meta.url).pathname,
  external: Object.keys(pkg.dependencies).filter((n) => !n.startsWith('@estate-atlas/')),
  logLevel: 'info',
});
