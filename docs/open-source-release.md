# Open-source publication checklist

Preparing the repository, publishing its source, and launching a public hosted instance are separate steps. GitHub visibility is an owner decision. Do not infer publication from a successful pipeline or a private Dev deployment.

## Repository preparation

The owner confirmed MIT on 2026-10-22. The [license text](../LICENSE) and all workspace manifests use MIT; third-party terms remain in [their notices](../THIRD_PARTY_NOTICES.md). Repository publication remains a separate owner decision.

On 2026-10-23 the owner instructed the maintainer to carry out the source-publication plan. The release targets `main` through [PR #4](https://github.com/LuPetro/estate-atlas/pull/4), with final branch checks required before changing visibility. Hosted production deployment and public signup remain subject to the web-launch requirements below.

- [x] Owner selects the source license; add the unmodified license text and matching workspace metadata.
- [x] README explains the product, local start, native limitations and contribution path.
- [x] Self-hosting, development and maintainer deployment guides are separated.
- [x] Contributor/PR guidance, issue forms, security reporting and bundled-asset notices are present.
- [x] Generate and inspect the synthetic desktop/mobile previews from the fresh-install check.
- [x] Pass the fresh-checkout Docker check for the committed onboarding code; retain its local report.
- [ ] Pass documentation links, workflow validation, full-history secret scanning and both branch pipelines.

## Publication review, 2026-10-23

The initial review covered all 54 reachable commits, all 714 unique historical file blobs, and the complete tracked path inventory. Both the Git-history scan and a second scan of the extracted historical text blobs reported no secrets. Binary assets are the bundled fonts, generated application icons and five historical screenshot versions; those screenshots were visually inspected and contain only the labeled synthetic portfolio or the signed-out interface. No database dump or private upload is tracked. Deployment documentation includes operational paths and the public server address; those are not credentials.

All 64 completed Actions runs available at review time were downloaded and inspected; no workflow artifacts were retained on GitHub. The log scan found Git commit hashes in API image tags and connection details from already-terminated isolated PostgreSQL tests in two old failed runs. The logs for runs `38090741418` and `38281698138` were privately preserved and deleted from GitHub before publication. Their workflow results and the source history are retained. New release logs must be reviewed as they complete. Private scan reports and original logs stay under ignored `.local/publication-audit/`.

The first release audit also caught newly published advisories affecting Next.js 16.4.0 and Fastify 5.12.5. Publication preparation upgrades to Next.js 16.4.3 and Fastify 5.12.7 and records the SHA-512 integrity of the official SheetJS 0.20.3 archive. The dependency gate continues to reject unknown advisories; the existing isolated Expo tooling exception is not expanded. Required CI verifies the final lockfile, real PostgreSQL API, browser flows, native exports and a fresh Docker installation.

## Local verification

Verified on Linux x86_64 on 2026-10-22, using committed source `ab9524b51d2be52ff7d763973a5bf98113c74208` and `./scripts/pnpm exec node scripts/check-self-hosting.mjs --screenshots`.

The eight checks cover a clean clone without host app dependencies/user configuration, isolated Docker project/ports/volumes, builds and service health, packaged license/notices, Web/API/CORS/private access, open signup and explicit synthetic fixtures, browser login/screenshots, and persisted data/sessions plus logout after restart. The temporary database and containers were removed. Logs and the machine-readable result remain in ignored `.local/`; no user or provider data was used. The same check now runs as a required job in both branch pipelines.

## Before changing visibility

- Review the complete Git history and assets, not only the latest tree. A secret scan is one check; manually confirm that no user data, private documents, dumps or unintended files are published.
- Confirm the selected license covers the code the owner can license; retain third-party terms.
- Make the prepared changes available on `main` through the normal `dev` → `main` release PR. GitHub uses the default branch for the README, license, security policy and issue templates.
- Set a factual repository description/topics and enable Issues for reports.
- Confirm required checks and deployment branch restrictions remain active, and that external contributor PRs receive no deployment secrets.

## Publication

- Change visibility only with the owner's explicit publication instruction.
- Enable GitHub private vulnerability reporting after publication and verify that **Report a vulnerability** is available. GitHub documents this feature for [public repositories](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository); the security policy has a contact-only fallback.
- Verify the clone instructions without an authenticated GitHub session.

## Before advertising the hosted app

Use [web launch](web-launch.md). Verify the real public registration, email confirmation, login, first property and password-recovery path. Keep private preview credentials separate. A source release can be self-hostable before the hosted service is ready for unrestricted signup.

For the first feedback round, follow the [five-owner pilot](feedback-pilot.md), show only a labeled synthetic demo, and track whether participants can create their first property and return. Outreach drafts live in [marketing](marketing-launch.md); they are not evidence of a completed hosted launch or of existing users.
