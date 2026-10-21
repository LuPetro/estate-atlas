import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { developmentSource } from './assert-development.mjs';
import { approvedRun } from './assert-release-ci.mjs';
import { validatePromotion } from './promote-images.mjs';

describe('separate development and production branches', () => {
  it.each(['merge', 'squash'])(
    'matches tested source after a normal %s into main and rejects changed source',
    async (mode) => {
      const dir = await mkdtemp(path.resolve('.local/branch-policy-'));
      const git = (...args) =>
        execFileSync(
          'git',
          [
            '-c',
            'user.name=Synthetic branch fixture',
            '-c',
            'user.email=fixture@example.invalid',
            ...args,
          ],
          { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        ).trim();
      try {
        git('init', '-b', 'main');
        await writeFile(path.join(dir, 'app.txt'), 'Synthetic stable source');
        git('add', '.');
        git('commit', '-m', 'Synthetic base');
        git('switch', '-c', 'dev');
        await writeFile(path.join(dir, 'app.txt'), 'Synthetic source tested on Dev');
        git('commit', '-am', 'Synthetic Dev change');
        const tested = git('rev-parse', 'HEAD');
        git('update-ref', 'refs/remotes/origin/dev', tested);
        git('switch', 'main');
        if (mode === 'merge') git('merge', '--no-ff', 'dev', '-m', 'Synthetic release merge');
        else {
          git('merge', '--squash', 'dev');
          git('commit', '-m', 'Synthetic squash release');
        }
        const release = git('rev-parse', 'HEAD');
        expect(release).not.toBe(tested);
        expect(developmentSource(release, dir)).toBe(tested);
        await writeFile(path.join(dir, 'app.txt'), 'Synthetic untested change');
        git('commit', '-am', 'Synthetic untested main change');
        expect(() => developmentSource(git('rev-parse', 'HEAD'), dir)).toThrow('identical source');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it('accepts push checks only from the workflow belonging to that branch', () => {
    const sha = 'a'.repeat(40);
    const run = {
      id: 1,
      run_attempt: 1,
      head_sha: sha,
      head_branch: 'dev',
      event: 'push',
      head_repository: { full_name: 'LuPetro/estate-atlas' },
      path: '.github/workflows/development.yml',
      status: 'completed',
      conclusion: 'success',
    };
    expect(approvedRun({ workflow_runs: [run] }, sha, 'dev')).toEqual(run);
    expect(() => approvedRun({ workflow_runs: [run] }, sha, 'main')).toThrow();
    expect(() =>
      approvedRun({ workflow_runs: [{ ...run, event: 'pull_request' }] }, sha, 'dev'),
    ).toThrow();
  });

  it('promotes immutable images across different commit IDs only with the same full source tree', () => {
    const main = 'a'.repeat(40),
      dev = 'b'.repeat(40),
      tree = 'c'.repeat(40);
    const record = {
      commit: dev,
      branch: 'dev',
      tree,
      result: 'success',
      runId: 10,
      runAttempt: 1,
      apiImage: 'sha256:' + 'd'.repeat(64),
      webImage: 'sha256:' + 'e'.repeat(64),
    };
    expect(validatePromotion(record, main, '10', '1', dev, tree).API_IMAGE).toBe(record.apiImage);
    expect(() => validatePromotion(record, main, '10', '1', dev, 'f'.repeat(40))).toThrow();
    expect(() => validatePromotion(record, main, '10', '2', dev, tree)).toThrow();
  });
});
