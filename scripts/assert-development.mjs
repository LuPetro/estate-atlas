import { pathToFileURL } from 'node:url';
import { appendFile } from 'node:fs/promises';

export async function assertDevelopment(sha, request) {
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Invalid release SHA.');
  const data = await request(
    `/actions/workflows/development.yml/runs?head_sha=${sha}&branch=main&per_page=100`,
  );
  const runs = (data.workflow_runs || [])
    .filter(
      (run) =>
        run.head_sha === sha &&
        run.head_branch === 'main' &&
        ['workflow_run', 'workflow_dispatch'].includes(run.event) &&
        run.head_repository?.full_name === 'LuPetro/estate-atlas' &&
        run.path?.split('@')[0] === '.github/workflows/development.yml',
    )
    .sort((a, b) => b.id - a.id);
  const run = runs[0];
  if (
    !run ||
    !Number.isSafeInteger(run.id) ||
    !Number.isSafeInteger(run.run_attempt) ||
    run.run_attempt < 1 ||
    run.status !== 'completed' ||
    run.conclusion !== 'success'
  )
    throw new Error('The latest Dev deployment for this commit must succeed before Prod.');
  const jobs = await request(
    `/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
  );
  if (
    !jobs.jobs?.some(
      (job) =>
        job.name === 'deploy-development' &&
        job.head_sha === sha &&
        job.status === 'completed' &&
        job.conclusion === 'success',
    )
  )
    throw new Error('The Dev deployment job must actually succeed, not be skipped.');
  const latest = await request(`/actions/runs/${run.id}`);
  if (
    latest.run_attempt !== run.run_attempt ||
    latest.status !== 'completed' ||
    latest.conclusion !== 'success'
  )
    throw new Error('Dev changed during authorization; wait for the latest attempt.');
  return run;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.GH_TOKEN) throw new Error('GitHub read token is missing.');
    const run = await assertDevelopment(process.env.RELEASE_SHA, async (suffix) => {
      const response = await fetch(`https://api.github.com/repos/LuPetro/estate-atlas${suffix}`, {
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`GitHub Dev check failed (HTTP ${response.status}).`);
      return response.json();
    });
    if (process.env.GITHUB_OUTPUT)
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `run_id=${run.id}\nrun_attempt=${run.run_attempt}\n`,
      );
    console.log(`Verified Dev run ${run.id}, attempt ${run.run_attempt}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
