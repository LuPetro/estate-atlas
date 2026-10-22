# Public web launch

This guide describes production readiness. It does not assert that the hosted service has been launched. The local Docker defaults and the password-protected Dev preview are separate configurations.

## Choose the correct installation

| Installation           | Private configuration                     | Operation                                       |
| ---------------------- | ----------------------------------------- | ----------------------------------------------- |
| Standalone checkout    | `.local/docker/`                          | `./scripts/docker …`                            |
| Maintained Dev preview | `.local/environments/development/docker/` | `EA_ENVIRONMENT=development ./scripts/docker …` |
| Maintained production  | `.local/environments/production/docker/`  | `EA_ENVIRONMENT=production ./scripts/docker …`  |

Do not copy Dev secrets, accounts, backups or database volumes into production. On the project's VPS the retired legacy stack must not start against the database volume adopted by Dev. See [deployment](development-deployment.md) for the current gateway, release archives and environment layout.

## Configuration prerequisites

Use `config/production.env.example` and `config/site.example.json` as references; edit the generated private files for the chosen installation. Do not overwrite existing secrets or use example values as real operator information.

- **HTTPS and origins:** a real domain and correct DNS; `WEB_ORIGIN` and `ACCOUNT_PUBLIC_URL` equal to its canonical HTTPS origin; `NEXT_PUBLIC_API_URL=/api`; `ALLOW_LOCAL_HTTP=false`; exactly one controlled proxy hop via `TRUST_PROXY=1`.
- **Mail:** authenticated TLS SMTP, the matching sender/domain settings, a protected SMTP password file, mandatory email verification and a real delivery check. Set `SMTP_DELIVERY_CONFIRMED=true` only after verifying delivery. Password recovery needs the same real mail setup.
- **Operator text:** complete and review the actual operator, support/privacy contacts, hosting location and policy text in `site.json`; `reviewed=true` records that review. Do not replace these with generated identities or placeholder addresses.
- **Administrator:** deliberately bootstrap an existing account, verify its email, enroll MFA and retain recovery codes privately. See [accounts and administration](accounts-admin.md).
- **Recovery:** a recent local PostgreSQL backup and a successful isolated restore proof; retain the MFA encryption key securely. Keep a protected off-host copy and use an external availability check before expanding service use. The automated gate currently enforces local backup/restore checks, not those external services.
- **Limits:** bounded property/storage/audit settings; if research is enabled, positive public user/global budgets and explicit request consent. No provider is enabled just by publishing the source.

The checked-in configuration and live preflight are authoritative. Documentation cannot establish successful mail delivery, operator review or device behavior on its own.

## Validate and publish

Operational checks need locked host dependencies: run `./scripts/bootstrap.sh` in the appropriate source checkout first. Configure mail and create the initial verified administrator through a controlled private onboarding path before enabling public routing. The production preflight deliberately requires that account and does not offer a bypass for first launch.

For the maintained production environment:

```bash
EA_ENVIRONMENT=production ./scripts/pnpm release:check
EA_ENVIRONMENT=production ./scripts/check-backup
```

An incomplete setup fails these checks; resolve the actual reported settings. Backup/restore commands affect only their selected environment. Do not restore into the live database to demonstrate recovery.

Release through **Actions → EstateAtlas Main pipeline → Run workflow → main → production_approval=deploy** after the `dev` → `main` release PR and successful Main push checks. Authorization verifies the identical source tree already deployed successfully on Dev. The VPS promotes its exact API/Web image IDs, runs preflight, starts production and checks HTTPS. This does not rebuild a different production application or transfer Dev data.

The shared VPS checkout is preserved; deployment uses immutable source archives. A failed release does not automatically roll back containers or database migrations. Details and records are in [deployment](development-deployment.md).

For a separate standalone installation, the optional `public` Compose profile provides Caddy with `/api` routing. `./scripts/docker --profile public up -d --wait` runs the same production preflight before exposing 80/443. Configure the standalone state and administrator first; it must not run alongside the maintained gateway on those ports.

## First-user acceptance

Before directing new users to the hosted service, check the actual HTTPS site with your own account:

1. Register, receive the verification mail and confirm it.
2. Sign in, create a synthetic first property and confirm it survives a reload.
3. Sign out and confirm the previous portfolio is no longer visible.
4. Receive a password-reset mail, change the password and confirm the old session/password no longer works.
5. Check support/operator pages, mobile viewport, account export/deletion and the public health endpoint.

Use only your own test account. Do not present synthetic portfolios as real customer data. Record device, mail-delivery and public-service results separately from automated CI.

## Native scope

Native Android/iOS clients use the same HTTPS API. JavaScript exports are checked in CI, while signing, real device checks, deep links, uploads, maps and store distribution need separate acceptance. See [mobile testing](mobile-testing.md). The private Dev gateway is not yet a supported native authentication path.
