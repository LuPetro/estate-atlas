import { describe, it, expect } from 'vitest';
import { access, copyFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { documentationErrors } from './check-docs.mjs';

describe('documentation checks', () => {
  it('checks relative images, encoded paths and root paths without following external links', async () => {
    const root = await mkdtemp(path.resolve('.local/doc-links-'));
    try {
      await mkdir(path.join(root, 'docs'));
      await writeFile(
        path.join(root, 'README.md'),
        '[Guide](docs/guide.md#setup)\n[Space](docs/a%20b.txt)\n',
      );
      await writeFile(path.join(root, 'docs/a b.txt'), 'fixture');
      await writeFile(
        path.join(root, 'docs/guide.md'),
        '[Root](/README.md)\n[Mail](mailto:fixture@example.test)\n[Web](https://example.test/missing)\n[Anchor](#setup)\n```md\n[Ignored](missing.md)\n```\n',
      );
      expect(await documentationErrors(root)).toEqual([]);
      await writeFile(
        path.join(root, 'docs/broken.md'),
        '![Missing](missing.png)\n[Escaped](../../outside.md)\n',
      );
      expect(await documentationErrors(root)).toHaveLength(2);
      await mkdir(path.join(root, '.local'));
      await writeFile(path.join(root, '.local/ignored.md'), '[Private](missing.md)');
      expect(await documentationErrors(root)).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects unknown bootstrap flags before creating any toolchain state', () => {
    const result = spawnSync('bash', ['scripts/bootstrap.sh', '--unknown'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage:');
  });

  it('runtime-only bootstrap does not install pnpm or host application dependencies', async () => {
    const root = await mkdtemp(path.resolve('.local/runtime-bootstrap-'));
    try {
      await mkdir(path.join(root, 'scripts'));
      await mkdir(path.join(root, '.local/node/bin'), { recursive: true });
      await copyFile('scripts/bootstrap.sh', path.join(root, 'scripts/bootstrap.sh'));
      await writeFile(path.join(root, '.local/node/bin/node'), '#!/bin/sh\nexit 0\n', {
        mode: 0o755,
      });
      const result = spawnSync('bash', ['scripts/bootstrap.sh', '--runtime-only'], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Project-local Node is ready');
      expect(
        await access(path.join(root, '.local/tools')).then(
          () => true,
          () => false,
        ),
      ).toBe(false);
      expect(
        await access(path.join(root, 'node_modules')).then(
          () => true,
          () => false,
        ),
      ).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
