import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { releaseErrors } from './production-check.mjs';
import { encryptFile, decryptFile } from './recovery-kit.mjs';
const env = {
  PUBLIC_DOMAIN: 'app.estateatlas.at',
  WEB_ORIGIN: 'https://app.estateatlas.at',
  ACCOUNT_PUBLIC_URL: 'https://app.estateatlas.at',
  NEXT_PUBLIC_API_URL: '/api',
  ALLOW_LOCAL_HTTP: 'false',
  TRUST_PROXY: '1',
  ACCOUNT_REQUIRE_VERIFICATION: 'true',
  SMTP_HOST: 'smtp.fixture.invalid',
  SMTP_FROM: 'Fixture <noreply@estateatlas.at>',
  SMTP_USER: 'fixture',
  SMTP_PORT: '587',
  ACME_EMAIL: 'fixture@estateatlas.at',
  OPS_ALERT_EMAIL: 'fixture@estateatlas.at',
  OFFSITE_BACKUP_CONFIRMED: 'true',
  SMTP_DELIVERY_CONFIRMED: 'true',
  UPTIME_MONITOR_CONFIRMED: 'true',
  MAX_PROPERTIES_PER_ACCOUNT: '100',
  MAX_ACCOUNT_STORAGE_MB: '250',
  MAX_TOTAL_STORAGE_MB: '2048',
  AUDIT_RETENTION_DAYS: '180',
};
const site = {
  operator: 'Synthetic release fixture',
  address: 'Synthetic address',
  supportEmail: 'fixture@estateatlas.at',
  privacyEmail: 'fixture@estateatlas.at',
  hostingProvider: 'Synthetic host',
  hostingRegion: 'Synthetic region',
  legalNotice: 'Synthetic operator text',
  privacyNotice: 'Synthetic privacy text',
  terms: 'Synthetic terms',
  reviewed: true,
};
describe('web launch gates', () => {
  it('lists missing setup and accepts complete synthetic configuration without contacting providers', () => {
    expect(releaseErrors({}, {})).not.toHaveLength(0);
    expect(releaseErrors(env, site)).toEqual([]);
    expect(
      releaseErrors(
        { ...env, OFFSITE_BACKUP_CONFIRMED: 'false', UPTIME_MONITOR_CONFIRMED: 'false' },
        site,
      ),
    ).toEqual([]);
  });
  it('blocks unsafe cookies, unverified signup, placeholder domains and unlimited public AI', () => {
    for (const change of [
      { ALLOW_LOCAL_HTTP: 'true' },
      { ACCOUNT_REQUIRE_VERIFICATION: 'false' },
      { TRUST_PROXY: 'true' },
      { PUBLIC_DOMAIN: 'example.com' },
      { SMTP_ALLOW_INSECURE: 'true' },
      {
        ANALYSIS_ENABLED: 'true',
        ANALYSIS_USER_DAILY_LIMIT: '0',
        ANALYSIS_GLOBAL_DAILY_LIMIT: '0',
      },
    ])
      expect(releaseErrors({ ...env, ...change }, site)).not.toHaveLength(0);
    expect(releaseErrors(env, { ...site, reviewed: false })).not.toHaveLength(0);
    expect(
      releaseErrors(env, {
        ...site,
        address: 'Wien, Österreich (vollständige ladungsfähige Anschrift noch einzutragen)',
      }),
    ).not.toHaveLength(0);
  });
});
it('encrypts recovery data, authenticates before use, and removes incomplete plaintext on wrong keys or tampering', async () => {
  const dir = await mkdtemp(path.resolve('.local/recovery-fixture-'));
  try {
    const plain = path.join(dir, 'fixture.tar'),
      encrypted = path.join(dir, 'fixture.eab'),
      recovered = path.join(dir, 'recovered.tar');
    const content = Buffer.alloc(130000, 'synthetic backup fixture');
    await writeFile(plain, content);
    await encryptFile(plain, encrypted, 'synthetic passphrase 1234567890');
    expect((await stat(encrypted)).mode & 0o077).toBe(0);
    await decryptFile(encrypted, recovered, 'synthetic passphrase 1234567890');
    expect(await readFile(recovered)).toEqual(content);
    const wrong = path.join(dir, 'wrong.tar');
    await expect(decryptFile(encrypted, wrong, 'wrong synthetic passphrase')).rejects.toThrow();
    await expect(stat(wrong)).rejects.toThrow();
    const changed = await readFile(encrypted);
    changed[60] ^= 1;
    await writeFile(encrypted, changed);
    await expect(
      decryptFile(encrypted, wrong, 'synthetic passphrase 1234567890'),
    ).rejects.toThrow();
    await expect(stat(wrong)).rejects.toThrow();
    await expect(
      encryptFile(plain, recovered, 'synthetic passphrase 1234567890'),
    ).rejects.toThrow();
    expect(await readFile(recovered)).toEqual(content);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
