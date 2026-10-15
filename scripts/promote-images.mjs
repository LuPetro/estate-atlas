import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { operationsRoot, configuration, environment } from './environment-paths.mjs';

export function validatePromotion(record, sha, run, attempt) {
  if (
    !/^[a-f0-9]{40}$/.test(sha || '') ||
    record?.commit !== sha ||
    record?.result !== 'success' ||
    !/^\d+$/.test(run || '') ||
    Number(run) < 1 ||
    !/^\d+$/.test(attempt || '') ||
    Number(attempt) < 1 ||
    record.runId !== Number(run) ||
    record.runAttempt !== Number(attempt) ||
    !/^sha256:[a-f0-9]{64}$/.test(record.apiImage || '') ||
    !/^sha256:[a-f0-9]{64}$/.test(record.webImage || '')
  )
    throw new Error('Prod requires the exact successful Dev commit, run, attempt and image IDs.');
  return { API_IMAGE: record.apiImage, WEB_IMAGE: record.webImage };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  try {
    if (environment !== 'production') throw new Error('Production context required.');
    const record = JSON.parse(
      await readFile(
        path.join(operationsRoot, '.local/environments/development/last-release.json'),
      ),
    );
    const images = validatePromotion(
      record,
      process.env.RELEASE_SHA,
      process.env.DEVELOPMENT_RUN_ID,
      process.env.DEVELOPMENT_RUN_ATTEMPT,
    );
    for (const id of Object.values(images)) {
      const result = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', id], {
        encoding: 'utf8',
      });
      if (result.status !== 0 || result.stdout.trim() !== id)
        throw new Error('A tested Dev image is missing; redeploy Dev first.');
    }
    const envFile = path.join(configuration, 'compose.env');
    let text = await readFile(envFile, 'utf8');
    for (const [key, value] of Object.entries(images)) {
      text = text.replace(new RegExp(`^${key}=.*(?:\\n|$)`, 'gm'), '');
      text = text.trimEnd() + `\n${key}=${value}\n`;
    }
    await writeFile(envFile, text, { mode: 0o600 });
    console.log('Prod will reuse the two tested Dev image IDs without rebuilding.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
