import { spawn, execFileSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { access, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Only synthetic data in a dedicated clone/project. No deployment configuration is read.
const root = fileURLToPath(new URL('../', import.meta.url));
const screenshots = process.argv.includes('--screenshots');
if (process.argv.slice(2).some((arg) => arg !== '--screenshots'))
  throw new Error('Usage: node scripts/check-self-hosting.mjs [--screenshots]');
await mkdir(path.join(root, '.local'), { recursive: true });
const temp = await mkdtemp(path.join(root, '.local/self-hosting-check-'));
const checkout = path.join(temp, 'checkout');
const project = `ea-selfhost-${randomBytes(6).toString('hex')}`;
const log = path.join(temp, 'commands.log');
const logFd = openSync(log, 'wx', 0o600);
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const env = Object.fromEntries(
  [
    'PATH',
    'HOME',
    'USER',
    'TMPDIR',
    'DOCKER_HOST',
    'DOCKER_CONTEXT',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
  ]
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);
Object.assign(env, {
  EA_ENVIRONMENT: 'local',
  EA_OPERATIONS_ROOT: checkout,
  COMPOSE_PROJECT_NAME: project,
  API_IMAGE: `${project}-api:check`,
  WEB_IMAGE: `${project}-web:check`,
});
let active;
let interrupted = false;
let cleaningUp = false;
const stop = () => {
  interrupted = true;
  if (active?.pid) {
    try {
      process.kill(-active.pid, 'SIGTERM');
    } catch {
      /* child already exited */
    }
  }
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

function run(command, args, cwd = checkout) {
  if (interrupted && !cleaningUp) return Promise.reject(new Error('Check interrupted.'));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', logFd, logFd],
      detached: true,
    });
    active = child;
    const timer = setTimeout(
      () => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* child already exited */
        }
      },
      25 * 60 * 1000,
    );
    child.on('error', (error) => {
      clearTimeout(timer);
      active = undefined;
      reject(error);
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      active = undefined;
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args[0] || ''} failed (${signal || code}); inspect ${log}`));
    });
  });
}
const compose = (...args) => run('./scripts/docker', args);
const checks = [];
const report = { revision, project, result: 'failed', checks, screenshots, log };
let initialized = false;
let failure;

try {
  console.log(`Checking committed ${revision.slice(0, 12)} in an isolated Docker project.`);
  await run('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', root, checkout], root);
  await run('git', ['checkout', '--quiet', '--detach', revision]);
  for (const file of ['node_modules', '.local', '.env']) {
    const exists = await access(path.join(checkout, file)).then(
      () => true,
      () => false,
    );
    assert.equal(exists, false, `Fresh clone unexpectedly contains ${file}`);
  }
  checks.push('clean clone without host dependencies, configuration or user data');
  console.log('Installing only the clone-local Node runtime; no host application dependencies.');
  await run('./scripts/bootstrap.sh', ['--runtime-only']);
  assert.equal(
    await access(path.join(checkout, '.local/tools')).then(
      () => true,
      () => false,
    ),
    false,
  );
  await compose('config', '--quiet');

  const ports = [];
  const reservations = [];
  for (let i = 0; i < 2; i++) {
    const server = createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    ports.push(server.address().port);
    reservations.push(server);
  }
  for (const server of reservations) await new Promise((resolve) => server.close(resolve));
  const [webPort, apiPort] = ports;
  const web = `http://localhost:${webPort}`;
  const api = `http://localhost:${apiPort}`;
  await writeFile(
    path.join(checkout, '.local/docker/compose.env'),
    [
      `WEB_ORIGIN=${web}`,
      `ACCOUNT_PUBLIC_URL=${web}`,
      `NEXT_PUBLIC_API_URL=${api}`,
      `WEB_PORT=${webPort}`,
      `API_PORT=${apiPort}`,
      'ALLOW_LOCAL_HTTP=true',
      'ANALYSIS_ENABLED=false',
      'ACCOUNT_REQUIRE_VERIFICATION=false',
    ].join('\n') + '\n',
    { mode: 0o600 },
  );
  const plan = JSON.parse(
    execFileSync('./scripts/docker', ['config', '--format', 'json'], {
      cwd: checkout,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', logFd],
    }),
  );
  assert.equal(plan.name, project, 'Compose must select only the temporary project');
  assert.ok(
    Object.values(plan.volumes).every(
      (volume) => !volume.external && volume.name.startsWith(`${project}_`),
    ),
  );
  assert.equal(plan.services.api.image, env.API_IMAGE);
  assert.equal(plan.services.web.image, env.WEB_IMAGE);
  assert.ok(
    ['api', 'web'].every((name) =>
      plan.services[name].ports.every((port) => port.host_ip === '127.0.0.1'),
    ),
  );
  initialized = true;
  checks.push('isolated project, images, volumes and loopback ports');
  console.log('Building API/Web sequentially and starting the temporary localhost stack.');
  await compose('up', '-d', '--build', '--wait', '--wait-timeout', '180');
  checks.push('Docker build and all service healthchecks');
  for (const service of ['api', 'web']) {
    await compose(
      'exec',
      '-T',
      service,
      'node',
      '-e',
      "const fs=require('fs');for(const f of ['LICENSE','THIRD_PARTY_NOTICES.md'])if(!fs.readFileSync(f,'utf8').trim())process.exit(1)",
    );
  }
  checks.push('license and third-party notices included in runtime images');

  let token;
  async function request(
    endpoint,
    { status = 200, method = 'GET', data, authenticated = false, origin } = {},
  ) {
    const response = await fetch(`${api}${endpoint}`, {
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, status, `${method} ${endpoint} returned an unexpected status`);
    return response;
  }
  assert.equal((await (await request('/health')).json()).status, 'ok');
  const home = await fetch(web, { signal: AbortSignal.timeout(15000) });
  assert.equal(home.status, 200);
  assert.match(await home.text(), /EstateAtlas/);
  const cors = await request('/auth/me', { status: 401, origin: web });
  assert.equal(cors.headers.get('access-control-allow-origin'), web);
  await request('/properties', { status: 401 });
  checks.push('Web/API health, exact browser CORS and anonymous portfolio denial');

  const email = `synthetic-docs-${randomBytes(5).toString('hex')}@example.test`;
  const password = randomBytes(24).toString('hex');
  const account = await (
    await request('/auth/register', {
      method: 'POST',
      status: 201,
      data: { name: 'Synthetic Demo', email, password },
    })
  ).json();
  token = account.token;
  assert.equal(typeof token, 'string');
  assert.deepEqual(await (await request('/properties', { authenticated: true })).json(), []);
  const fixtures = await (
    await request('/properties/test-data', {
      method: 'POST',
      status: 201,
      authenticated: true,
    })
  ).json();
  assert.ok(fixtures.length > 0 && fixtures.every((item) => item.isTestData === true));
  checks.push('open signup, authenticated empty portfolio and explicit synthetic data');

  if (screenshots) {
    console.log('Capturing the real interface using the temporary synthetic account.');
    const { chromium, expect } = await import('@playwright/test');
    const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1200 },
        locale: 'de-DE',
        serviceWorkers: 'block',
      });
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        return [web, api].includes(url.origin) ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      await page.goto(web);
      await page.evaluate(() => document.fonts.ready);
      const images = path.join(root, 'docs/images');
      await mkdir(images, { recursive: true });
      await page.screenshot({
        path: path.join(images, 'sign-in-desktop.png'),
        animations: 'disabled',
      });
      await page.getByLabel('E-Mail-Adresse').fill(email);
      await page.getByLabel('Passwort', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Portfolioübersicht' })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.locator('.property-card').first()).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: 'Alle gefilterten Immobilien auf der Karte anzeigen',
        }),
      ).toBeEnabled({ timeout: 30000 });
      await page.locator('.leaflet-overlay-pane path').first().waitFor({ state: 'attached' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: path.join(images, 'portfolio-desktop.png'),
        animations: 'disabled',
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: path.join(images, 'portfolio-mobile.png'),
        animations: 'disabled',
      });
      checks.push('browser login and synthetic desktop/mobile screenshots');
    } finally {
      await browser.close();
    }
  }

  console.log('Restarting the stack to verify database and session persistence.');
  await compose('stop');
  await compose('up', '-d', '--wait', '--wait-timeout', '180');
  const persisted = await (await request('/properties', { authenticated: true })).json();
  assert.deepEqual(persisted.map((item) => item.id).sort(), fixtures.map((item) => item.id).sort());
  await request('/auth/logout', { method: 'POST', status: 204, authenticated: true });
  await request('/properties', { status: 401, authenticated: true });
  checks.push('PostgreSQL/session persistence across restart and logout revocation');
  report.result = 'success';
} catch (error) {
  failure = error;
  report.error = error.message;
} finally {
  cleaningUp = true;
  if (initialized) {
    console.log('Removing only the temporary check project and its synthetic database volume.');
    try {
      await compose('down', '--volumes', '--remove-orphans');
    } catch (error) {
      report.result = 'failed';
      failure ||= error;
      report.cleanupError = error.message;
    }
  }
  closeSync(logFd);
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  if (report.result === 'success') await rm(checkout, { recursive: true, force: true });
  report.checkedAt = new Date().toISOString();
  await writeFile(
    path.join(root, '.local/self-hosting-result.json'),
    JSON.stringify(report, null, 2) + '\n',
    { mode: 0o600 },
  );
}
if (failure) throw failure;
console.log(
  `Fresh-checkout Docker check passed (${checks.length} checks). Report: .local/self-hosting-result.json`,
);
