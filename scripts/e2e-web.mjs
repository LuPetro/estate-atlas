import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Match the Docker runtime layout, including assets omitted by Next standalone.
const build = new URL('../apps/web/.next-e2e/', import.meta.url);
await cp(new URL('static/', build), new URL('standalone/apps/web/.next-e2e/static/', build), {
  recursive: true,
});
process.env.PORT = '3001';
process.env.HOSTNAME = '127.0.0.1';
await import(fileURLToPath(new URL('standalone/apps/web/server.js', build)));
