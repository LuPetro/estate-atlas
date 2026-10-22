# Open-source publication checklist

Preparing the repository, publishing its source, and launching a public hosted instance are separate steps. GitHub visibility is an owner decision. Do not infer publication from a successful pipeline or a private Dev deployment.

## Repository preparation

The owner confirmed MIT on 2026-10-22. The [license text](../LICENSE) and all workspace manifests use MIT; third-party terms remain in [their notices](../THIRD_PARTY_NOTICES.md). Repository publication remains a separate owner decision.

- [x] Owner selects the source license; add the unmodified license text and matching workspace metadata.
- [x] README explains the product, local start, native limitations and contribution path.
- [x] Self-hosting, development and maintainer deployment guides are separated.
- [x] Contributor/PR guidance, issue forms, security reporting and bundled-asset notices are present.
- [x] Generate and inspect the synthetic desktop/mobile previews from the fresh-install check.
- [x] Pass the fresh-checkout Docker check for the committed onboarding code; retain its local report.
- [ ] Pass documentation links, workflow validation, full-history secret scanning and both branch pipelines.

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

For the first feedback round, invite a small group of property owners, show only a labeled synthetic demo, and track whether they can create their first property and return. Outreach drafts live in [marketing](marketing-launch.md); they are not evidence of a completed launch or of existing users.
