import { spawnSync } from 'node:child_process';
const result = spawnSync('pnpm', ['audit', '--prod', '--json'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('Dependency audit unavailable.');
  process.exit(1);
}
if (report.error || !report.metadata?.vulnerabilities || !report.advisories) {
  console.error('Dependency audit failed.');
  process.exit(1);
}
// These unpatched advisories are confined to private Expo build/preview tooling.
// Do not allow them to spread into web/API, or silence unknown future advisories.
const tooling = new Map([
  ['GHSA-86w9-cpqp-85rv', 'apps__mobile>expo>@expo/cli>node-forge'],
  ['GHSA-vfj7-8cjw-p6xm', 'apps__mobile>expo>@expo/metro>metro-file-map>micromatch>braces'],
]);
let failures = 0;
for (const issue of Object.values(report.advisories ?? {})) {
  const paths = issue.findings?.flatMap((finding) => finding.paths) ?? [];
  const id = issue.github_advisory_id ?? issue.url.split('/').pop();
  // Expo 57's CLI still requires Zod 3, which has no patched release. This is
  // private DevTools schema parsing, not application validation or a deployed API.
  // Keep this review limited to the exact locked version/path and one month.
  const isolatedZod =
    id === 'GHSA-mrhx-c7xc-m3w5' &&
    issue.module_name === 'zod' &&
    issue.findings?.length &&
    issue.findings.every((finding) => finding.version === '3.25.76') &&
    paths.length &&
    paths.every((path) => path === 'apps__mobile>expo>@expo/cli>zod') &&
    Date.now() < Date.UTC(2026, 10, 25);
  if (isolatedZod) {
    console.log(
      'Known isolated Expo DevTools advisory: GHSA-mrhx-c7xc-m3w5 (zod 3.25.76); no Zod 3 fix, review expires 2026-11-25. Do not expose Expo DevTools publicly.',
    );
  } else if (tooling.has(id) && paths.length && paths.every((path) => path === tooling.get(id))) {
    console.log(
      `Known isolated Expo tooling advisory: ${id} (${issue.module_name}); no published fix, native release review required.`,
    );
  } else {
    console.error(
      `Dependency advisory requires review: ${id} (${issue.module_name}, ${issue.severity})`,
    );
    failures++;
  }
}
if (!failures) console.log('No reported advisories in deployed web/API dependencies.');
process.exit(failures ? 1 : 0);
