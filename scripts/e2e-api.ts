import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { database, migrate } from '../apps/api/src/database';
import { createApp } from '../apps/api/src/app';
import { encryptSecret, base32 } from '../apps/api/src/account-security';
import { hashPassword } from '../apps/api/src/auth';
import type { AccountMail } from '../apps/api/src/account-runtime';
import { randomUUID } from 'node:crypto';
import { GeocodingError } from '../apps/api/src/geocoding';
import { fixtureProvider } from '../tests/fixtures/analysis';
import { AnalysisRunner } from '../apps/api/src/analysis/runner';
const analysis = {
  config: { enabled: true, reason: null, models: ['fixture-model'], defaultModel: 'fixture-model' },
  provider: {
    id: 'test-fixture',
    async research(...args: Parameters<ReturnType<typeof fixtureProvider>['research']>) {
      const report = await fixtureProvider(2500).research(...args);
      // Labeled scenario only in this isolated test server, never production.
      if (args[0].address.includes('TESTDATEN Diagnose')) {
        report.research.candidates = report.research.candidates.map((c) => ({
          ...c,
          currency: 'JPY',
        }));
      }
      return report;
    },
  },
  userDailyLimit: 5,
  globalDailyLimit: 100,
};

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
const mailFixtures: AccountMail[] = [];
const accountKey = randomBytes(32);
const app = await createApp(pool, {
  registrationLimit: 100, // Multiple synthetic browser accounts share the same fixture-runner IP.
  accounts: {
    publicUrl: 'http://localhost:3001',
    verificationRequired: false,
    encryptionKey: accountKey,
    mail: async (mail) => {
      mailFixtures.push(mail);
    },
  },
  origin: 'http://localhost:3001',
  analysis,
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
// Fixture helpers exist only in this isolated test server, never in production.
app.get('/__fixtures/mail', async (req) => {
  const email = (req.query as { email?: string }).email;
  return mailFixtures.filter((m) => m.to === email);
});
await pool.query(
  'INSERT INTO users(id,email,name,password_hash,role,mfa_secret) VALUES($1,$2,$3,$4,$5,$6)',
  [
    randomUUID(),
    'admin-browser@example.test',
    'Synthetic browser admin',
    await hashPassword('Browser fixture password 1234'),
    'admin',
    encryptSecret(base32(Buffer.from('12345678901234567890')), accountKey),
  ],
);
await app.listen({ host: '127.0.0.1', port: 4001 });
let stopping = false;
const runner = new AnalysisRunner(pool, analysis);
let workerBusy = false;
const worker = setInterval(async () => {
  if (workerBusy || stopping) return;
  workerBusy = true;
  try {
    await runner.tick();
  } finally {
    workerBusy = false;
  }
}, 500);
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
  clearInterval(worker);
  runner.stop();
  while (workerBusy) await new Promise((resolve) => setTimeout(resolve, 30));
  await app.close();
  await pool.end();
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
