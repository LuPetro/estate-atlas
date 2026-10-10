import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { database, migrate } from '../apps/api/src/database';
import { createApp } from '../apps/api/src/app';
import { GeocodingError } from '../apps/api/src/geocoding';
const root = resolve('.local');
mkdirSync(root, { recursive: true });
const password = randomBytes(24).toString('hex');
const server = new EmbeddedPostgres({
  databaseDir: resolve(root, `e2e-postgres-${process.pid}`),
  user: 'estateatlas_e2e',
  password,
  port: 55434,
  persistent: false,
  authMethod: 'scram-sha-256',
  createPostgresUser: false,
  postgresFlags: ['-h', '127.0.0.1', '-k', root],
  onLog: () => {},
  onError: () => {},
});
await server.initialise();
await server.start();
await server.createDatabase('estateatlas_e2e');
const pool = database(`postgresql://estateatlas_e2e:${password}@127.0.0.1:55434/estateatlas_e2e`);
await migrate(pool);
// Third-party responses are deterministic, labeled fixtures in the isolated test server.
// No real user addresses or synthetic queries are sent to the public Photon service.
const app = await createApp(pool, {
  origin: 'http://localhost:3001',
  geocoder: async (query) => {
    if (query.includes('Ausfall'))
      throw new GeocodingError(
        503,
        'Adresssuche gerade nicht erreichbar. Du kannst den Pin auf der Karte setzen.',
      );
    if (!query.includes('Fixture')) return [];
    return [
      {
        label: 'Synthetischer Adresstreffer · Fixturestraße 1, 10115 Berlin, Deutschland',
        address: 'Fixturestraße 1, 10115 Berlin, Deutschland',
        country: 'DE',
        latitude: 52.532,
        longitude: 13.384,
        precision: 'building',
      },
    ];
  },
});
await app.listen({ host: '127.0.0.1', port: 4001 });
let stopping = false;
pool.on('error', (error) => {
  // EmbeddedPostgres also stops on process signals; idle connections can close
  // before our async shutdown reaches pool.end(). Do not dump connection data.
  if (!stopping)
    console.error(
      'E2E PostgreSQL connection failed:',
      (error as { code?: string }).code ?? 'UNKNOWN',
    );
});
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await app.close();
  await pool.end();
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
