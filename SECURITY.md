# Security policy

EstateAtlas stores private property information and documents. Please report security issues privately, especially authorization bypasses, account/session problems, exposed credentials, private-file access or data leaks.

## Report a vulnerability

If GitHub's **Security** tab offers **Report a vulnerability**, use that private reporting flow. If it is unavailable, open an issue titled **Security contact request**, with no technical details or sensitive attachments; the maintainer will arrange a private channel. Do not put a vulnerability reproduction in a public bug report.

In the private report, include the affected commit/release, steps to reproduce using synthetic accounts, impact, and a minimal suggested fix if available. Remove passwords, cookies, tokens, MFA secrets, database dumps, addresses and private documents. Do not access another person's data to demonstrate an issue; stop and report accidental access.

## Supported code

There is no long-term support release line yet. Report against the current `main` commit and identify the affected SHA. `dev` is the integration branch and may contain unreleased work. A green pipeline is not a security audit or a guarantee that a public installation is configured safely.

The maintainer reviews reports as capacity allows; no response or remediation deadline is promised. Coordinated disclosure should allow a fix and operator updates before technical details become public.

## Operators

Keep `.local/`, secrets and backups out of Git. Use HTTPS, verified email and MFA for public administration; restrict database access; maintain a separate protected backup. Never attach raw production logs or user exports to issues. See [self-hosting](docs/docker.md) and [public launch](docs/web-launch.md).

## Isolated development tooling

The dependency gate rejects advisories in deployed web/API dependencies. On 25 October 2026, Zod was updated to 4.6.7, Nodemailer to 10.1.4 and both Fast URI release lines to their patched versions after new advisory metadata blocked the release.

Expo 57's CLI still depends on Zod 3.25.76 for its DevTools schemas. No patched Zod 3 version is published for [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). A temporary exception is restricted to that exact version under `apps__mobile>expo>@expo/cli>zod` and expires on 25 November 2026. It does not apply to application validation or any other dependency path. Expo preview runs on localhost; do not expose Expo DevTools publicly. Review and remove the exception when a compatible patched Expo dependency is available. Existing narrowly scoped Expo tooling exceptions remain visible in audit output.
