# Branches and deployments

| Branch | Pipeline                  | Deployment                                                           |
| ------ | ------------------------- | -------------------------------------------------------------------- |
| `dev`  | EstateAtlas Dev pipeline  | Automatic after successful checks: https://dev.estateatlas.app       |
| `main` | EstateAtlas Main pipeline | Production after explicit workflow approval: https://estateatlas.app |

Features and fixes target `dev`. A release pull request merges `dev` into `main`. Each branch has its own workflow and runs the shared checks from `.github/workflows/ci.yml`: workflow/shell validation, full-history secret scanning, types, dependency audit, real PostgreSQL API tests, proxy/gateway checks, production builds, Android/iOS exports and desktop/mobile browser tests. `checks / Required checks` fails if any check fails, is cancelled or is skipped. Pull requests, including forks, cannot access deployment secrets or deploy. There are no path filters that can silently skip required checks.

The Dev pipeline runs on pushes to `dev`, pull requests targeting `dev`, and manual runs. Only a trusted push/manual run on `refs/heads/dev` can deploy. The VPS checks that the approved commit is still the remote `dev` head before building. A push to `main` never deploys Dev.

For production use **Actions → EstateAtlas Main pipeline → Run workflow → main → production_approval=deploy**. The latest push checks for this exact `main` commit must have succeeded. The workflow locates the identical full Git source tree in `dev` history and verifies its latest successful Dev pipeline/deployment attempt. This supports both merge commits and squash releases. Any extra source change must pass through Dev first.

The VPS checks the source trees again, plus the Dev release record, run ID/attempt and immutable Docker image IDs. Production reuses those API/Web images with `--no-build`; it never copies Dev accounts, data, secrets or configuration. Both deployments use `.local/releases/<commit>` archives and share a server lock. Neither deployment changes the branch, commits or unfinished edits in the shared VPS checkout.

## GitHub policies

The intended policy lives in `config/github-branches.json`: pull requests and the GitHub Actions `checks / Required checks` result are required for `dev` and `main`; force pushes and branch deletion are forbidden. Zero required third-party approvals keeps the sole maintainer able to merge their own reviewed changes. Deployment environments are restricted to `dev` and `main`, respectively. Workflow tokens default to read-only, and permanent branches are retained after merges.

Review the policy with `./scripts/pnpm exec node scripts/configure-github.mjs`. Apply it using the already authenticated local CLI:

```bash
GH_BIN=./scripts/gh ./scripts/pnpm exec node scripts/configure-github.mjs --apply
```

GitHub may reject protection rules for a private repository depending on its plan; the script reports each rejected operation and never changes visibility or secrets. Reapply after the repository becomes public if needed. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Namecheap

Domain List → estateatlas.app → Manage → Advanced DNS → Host Records → Add New Record:

| Type     | Host | Value         | TTL       |
| -------- | ---- | ------------- | --------- |
| A Record | dev  | 82.223.203.49 | Automatic |

Keep the root `@` record. Remove only conflicting records for `dev`. Do not add an AAAA record without working VPS IPv6. DNS alone does not issue a certificate. Caddy obtains HTTPS after the record resolves and 80/443 are externally reachable. A separate SSL purchase is unnecessary.

## Isolation and private access

- Docker projects: `estate-atlas-development`, `estate-atlas-production`, and one `estate-atlas-gateway` exposing 80/443. Only API/Web join the shared proxy network; each database stays on its own project network.
- Private state: `.local/environments/development/` and `.local/environments/production/`; separate database credentials, MFA encryption keys, mail/API secrets, runtime configuration, backups and restore proofs. Production initialization generates fresh secrets and does not copy the Dev API key.
- The initial Dev setup adopts the existing private test database volume `estate-atlas_postgres_data` and preserves its users/properties/credentials. The old `estate-atlas` containers stop only after Dev images build. No volume is deleted. Production uses `estate-atlas-production_postgres_data` and starts empty.
- Host API/Web ports remain loopback-only: Dev 4100/3100, Prod 4200/3200. A single Caddy routes by hostname; the root domain has no production route until full Prod preflight succeeds.
- Dev has HTTPS cookies, strict origin/proxy checks, email-verified registration behind an additional gateway password and `noindex`. Existing app credentials still apply after the gateway login. Admin MFA stays required. SMTP and email verification are disabled only in this restricted Dev configuration; accounts are not marked as verified. Email actions cannot deliver until Dev SMTP is configured separately. Production requirements remain unchanged.
- Gateway user: `estateatlas-dev`. Read its generated password **in your own VPS terminal**, not in chat: `cat /home/codexdev/projects/estate-atlas/.local/gateway/access-password`. This file is mode 600; Caddy receives only the bcrypt hash.
- Protected Dev HTTPS is currently for browser/PWA testing. Native Expo clients do not yet implement the additional gateway credentials; keep using the separately documented native preview until a native development build supports this access path.

## Server and GitHub setup

`./scripts/setup-development.mjs` is run with the project Node toolchain. It preserves existing state and initializes the gateway and both environment directories. The GitHub environments `development` and `production` each need `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_PORT`, `DEPLOY_PATH`, `DEPLOY_SSH_KNOWN_HOSTS` and secret `DEPLOY_SSH_PRIVATE_KEY`. The trusted known-host key must come directly from the VPS, not an unchecked network scan. The owner authorized the dedicated restricted deployment key; no SSH daemon or firewall configuration changes are needed.

The deploy key has deployment privileges on this VPS; Docker access is powerful. Environment separation prevents accidental data mixing, but one shared host/daemon is not an isolation boundary against a compromised deployment account. No application container receives the Docker socket.

Operational commands, run at the repository root:

After adoption, legacy `./scripts/docker up` is refused to prevent a second PostgreSQL container from mounting the adopted Dev volume. Always select the intended environment explicitly.

```bash
EA_ENVIRONMENT=development ./scripts/docker ps
EA_ENVIRONMENT=development ./scripts/docker logs --tail=100 api web
EA_ENVIRONMENT=development ./scripts/check-backup
EA_ENVIRONMENT=production ./scripts/docker ps
EA_ENVIRONMENT=production ./scripts/pnpm release:check
EA_ENVIRONMENT=production ./scripts/check-backup
EA_ENVIRONMENT=production ./scripts/pnpm exec node scripts/recovery-kit.mjs export
./scripts/gateway logs --tail=100
```

Dev deployment records live in `.local/environments/development/releases/<source-commit>.json`; `last-release.json` also identifies the currently deployed Dev version. Records include branch, source tree, workflow run/attempt and immutable image IDs. Image IDs become promotable only after authenticated HTTPS checks pass and unauthenticated access returns 401. Retaining records lets an older tested release be promoted while development continues. Source archives live under `.local/releases/<commit>`. Keep the tested images while a release is eligible for promotion; pruning them makes promotion fail explicitly. Failed deployment records do not imply the previous stack was rolled back.

## First production launch later

Complete the production state, not the legacy `.local/docker` files: SMTP, real operator/legal texts, verified administrator with MFA, offsite backup, restore proof and external monitoring. Production needs private initial onboarding before the first full release preflight; do not enable its public gateway route to bypass onboarding. Use the procedure in `web-launch.md`, adapted to the isolated production state. Root `estateatlas.app` remains unpublished until this is done and the approved Main pipeline succeeds. Dev success alone never publishes Prod.

Both app stacks share the resources of this small VPS. Watch memory/disk before running both under load; upgrade capacity or split hosts before a wider release. Cross-host deployment would require transporting the already-tested images through a registry or verified image archive; this implementation intentionally promotes local image IDs on the same VPS.
