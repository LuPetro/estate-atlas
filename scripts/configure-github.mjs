import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// Deliberately separate from CI: pull requests never receive administration credentials.
const config = JSON.parse(
  await readFile(new URL('../config/github-branches.json', import.meta.url), 'utf8'),
);
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify(config, null, 2));
  console.log('Review this policy, then run with --apply using an authenticated GitHub CLI.');
} else {
  const gh = process.env.GH_BIN || 'gh';
  const request = (method, suffix, body) => {
    const args = ['api', '--method', method, `repos/${config.repository}${suffix}`];
    if (body !== undefined) args.push('--input', '-');
    const output = execFileSync(gh, args, {
      input: body === undefined ? undefined : JSON.stringify(body),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim() ? JSON.parse(output) : null;
  };
  const repository = request('GET', '');
  if (!repository.permissions?.admin)
    throw new Error('Repository administration permission is required.');
  const failures = [];
  const apply = (label, run) => {
    try {
      run();
      console.log(`${label}: applied`);
    } catch (error) {
      failures.push(label);
      console.error(`${label}: ${String(error.stderr || error.message).trim()}`);
    }
  };
  for (const branch of config.branches) {
    // A missing branch is an error, rather than creating one from an unintended ref.
    request('GET', `/branches/${branch}`);
    apply(`${branch} protection`, () =>
      request('PUT', `/branches/${branch}/protection`, config.protection),
    );
  }
  for (const [environment, branch] of Object.entries(config.environments)) {
    apply(`${environment} deployment branch`, () => {
      const current = request('GET', `/environments/${environment}`);
      if (
        current.protection_rules?.some((rule) =>
          ['required_reviewers', 'wait_timer'].includes(rule.type),
        )
      )
        throw new Error(
          'Existing reviewer/wait policies need to be retained in GitHub Settings; refusing to replace them.',
        );
      request('PUT', `/environments/${environment}`, {
        deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      });
      const policies = request(
        'GET',
        `/environments/${environment}/deployment-branch-policies`,
      ).branch_policies;
      if (!policies.some((policy) => policy.name === branch && policy.type === 'branch'))
        request('POST', `/environments/${environment}/deployment-branch-policies`, {
          name: branch,
          type: 'branch',
        });
      for (const policy of policies)
        if (policy.name !== branch || policy.type !== 'branch')
          request('DELETE', `/environments/${environment}/deployment-branch-policies/${policy.id}`);
    });
  }
  apply('Repository merge settings', () =>
    request('PATCH', '', { allow_update_branch: true, delete_branch_on_merge: false }),
  );
  apply('Read-only workflow tokens', () =>
    request('PUT', '/actions/permissions/workflow', {
      default_workflow_permissions: 'read',
      can_approve_pull_request_reviews: false,
    }),
  );
  if (failures.length) {
    console.error('Some policies could not be applied. The repository visibility was not changed.');
    process.exitCode = 1;
  }
}
