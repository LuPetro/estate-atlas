import { pathToFileURL } from 'node:url';

const repository = 'LuPetro/estate-atlas';
const workflows = { main: 'main.yml', dev: 'development.yml' };
export const requiredJobs = [
  'Workflow and security checks',
  'Types and API tests',
  'Web build and browser tests',
  'Native Android and iOS',
  'Required checks',
].map((name) => `checks / ${name}`);

export function approvedRun(data, sha, branch = 'main') {
  if (!Object.hasOwn(workflows, branch)) throw new Error('Invalid release branch.');
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid release SHA.');
  if (!Array.isArray(data?.workflow_runs)) throw new Error('Invalid GitHub workflow response.');
  const runs = data.workflow_runs
    .filter(
      (run) =>
        run.head_sha === sha &&
        run.head_branch === branch &&
        run.event === 'push' &&
        run.head_repository?.full_name === repository &&
        run.path?.split('@')[0] === `.github/workflows/${workflows[branch]}`,
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
  ) {
    throw new Error(
      'The latest push CI run for this main commit must be completed and successful.',
    );
  }
  return run;
}

export async function assertReleaseCi(sha, request, branch = 'main') {
  if (!Object.hasOwn(workflows, branch)) throw new Error('Invalid release branch.');
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid release SHA.');
  // Do not filter by success: a newer failed or pending run must block an older green run.
  const data = await request(
    `/actions/workflows/${workflows[branch]}/runs?head_sha=${sha}&branch=${branch}&event=push&per_page=100`,
  );
  const run = approvedRun(data, sha, branch);
  const jobs = await request(
    `/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
  );
  if (
    !Array.isArray(jobs?.jobs) ||
    !requiredJobs.every((name) =>
      jobs.jobs.some(
        (job) =>
          job.name === name &&
          job.head_sha === sha &&
          job.status === 'completed' &&
          job.conclusion === 'success',
      ),
    )
  )
    throw new Error('Every required verify job must actually succeed in this CI attempt.');
  const latest = await request(`/actions/runs/${run.id}`);
  if (
    latest.run_attempt !== run.run_attempt ||
    latest.status !== 'completed' ||
    latest.conclusion !== 'success'
  ) {
    throw new Error('The CI run changed during approval; wait for its latest attempt.');
  }
  return run;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const sha = process.env.RELEASE_SHA ?? '';
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid release SHA.');
    if (!process.env.GH_TOKEN) throw new Error('GitHub read token is missing.');
    const run = await assertReleaseCi(
      sha,
      async (suffix) => {
        const response = await fetch(`https://api.github.com/repos/${repository}${suffix}`, {
          headers: {
            Authorization: `Bearer ${process.env.GH_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`GitHub CI check failed (HTTP ${response.status}).`);
        return response.json();
      },
      process.env.RELEASE_BRANCH ?? 'main',
    );
    console.log(`Verified CI run ${run.id}, attempt ${run.run_attempt}, for ${sha}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
