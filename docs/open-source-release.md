# Open-source publication checklist

Preparing the repository, publishing its source, and launching a public hosted instance are separate steps. GitHub visibility is an owner decision. Do not infer publication from a successful pipeline or a private Dev deployment.

## Repository preparation

- [ ] Owner selects the source license; add the unmodified license text and matching workspace metadata.
- [x] README explains the product, local start, native limitations and contribution path.
- [x] Self-hosting, development and maintainer deployment guides are separated.
- [x] Contributor/PR guidance, issue forms, security reporting and bundled-asset notices are present.
- [ ] Generate and inspect the synthetic desktop/mobile previews from the fresh-install check.
- [ ] Pass the fresh-checkout Docker check for the committed code; retain its local report.
- [ ] Pass documentation links, workflow validation, full-history secret scanning and both branch pipelines.

## Before changing visibility

- Review the complete Git history and assets, not only the latest tree. A secret scan is one check; manually confirm that no user data, private documents, dumps or unintended files are published.
- Confirm the selected license covers the code the owner can license; retain third-party terms.
- Make the prepared changes available on `main` through the normal `dev` → `main` release PR. GitHub uses the default branch for the README, license, security policy and issue templates.
- Set a factual repository description/topics and enable Issues for reports.
- Enable GitHub private vulnerability reporting when the repository supports it; keep the security policy's fallback usable until then.
- Confirm required checks and deployment branch restrictions remain active, and that external contributor PRs receive no deployment secrets.
- Change visibility only with the owner's explicit publication instruction. Then verify the clone instructions without an authenticated GitHub session.

## Before advertising the hosted app

Use [web launch](web-launch.md). Verify the real public registration, email confirmation, login, first property and password-recovery path. Keep private preview credentials separate. A source release can be self-hostable before the hosted service is ready for unrestricted signup.

For the first feedback round, invite a small group of property owners, show only a labeled synthetic demo, and track whether they can create their first property and return. Outreach drafts live in [marketing](marketing-launch.md); they are not evidence of a completed launch or of existing users.
