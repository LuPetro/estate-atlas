import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { browserSecurity, connectionString } from './runtime-config';

describe('Docker runtime security', () => {
  it('keeps production cookie security enabled by default', () => {
    expect(
      browserSecurity({ NODE_ENV: 'production', WEB_ORIGIN: 'https://estate.example' }),
    ).toEqual({ origin: 'https://estate.example', production: true });
  });
  it('allows explicit HTTP only for a loopback browser origin', () => {
    expect(
      browserSecurity({
        NODE_ENV: 'production',
        WEB_ORIGIN: 'http://localhost:3000',
        ALLOW_LOCAL_HTTP: 'true',
      }).production,
    ).toBe(false);
    for (const origin of [
      'http://estate.example',
      'http://localhost.evil.example',
      'http://localhost:3000/path',
      'http://user@localhost:3000',
      'https://estate.example',
    ]) {
      expect(() => browserSecurity({ WEB_ORIGIN: origin, ALLOW_LOCAL_HTTP: 'true' })).toThrow();
    }
  });
  it('reads a mounted password file without putting its value in config or command arguments', async () => {
    const dir = await mkdtemp(resolve('.local/test-db-secret-'));
    try {
      const file = resolve(dir, 'password');
      await writeFile(file, 'synthetic fixture p@ss:/word\n', { mode: 0o600 });
      const url = new URL(
        await connectionString({ DATABASE_HOST: 'db', DATABASE_PASSWORD_FILE: file }),
      );
      expect(url.hostname).toBe('db');
      expect(url.username).toBe('estateatlas');
      expect(decodeURIComponent(url.password)).toBe('synthetic fixture p@ss:/word');
      expect(await connectionString({ DATABASE_URL: 'postgresql://fixture@localhost/test' })).toBe(
        'postgresql://fixture@localhost/test',
      );
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
