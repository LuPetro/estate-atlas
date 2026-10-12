# Accounts and platform administration

The existing PostgreSQL-backed sessions and scrypt password hashes are retained. Migration `005_accounts` adds roles, status, verification, MFA, account action tokens, beta invitations, registration settings and an audit log without rewriting existing identities or property content.

## User-facing flows

Web: **Mein Konto** in the sidebar, or `/account`. Native: **Mein Konto & Sicherheit** on the overview. Both clients support profile editing, verification/resend, verified email changes, password changes, session listing/revocation, logout everywhere, TOTP enrollment with ten one-time recovery codes, owned-content export and account deletion. Password recovery and manual email/reset code entry are available from both login screens. Mail links open `/account-action`; their tokens live in a fragment, are removed from browser history on page load, and are used only after explicit confirmation. Native users may enter the code from the mail directly; automatic native deep-link routing is not yet provided.

Reset links expire after 30 minutes, verification/email-change links after 24 hours. Only token hashes are stored; tokens are single-use. Generic forgot-password responses do not reveal whether an account exists. SMTP failure in that public endpoint returns the same response; affected users can retry later. MFA seeds are encrypted with AES-256-GCM; recovery codes are hashed. Password reset never disables MFA. New sensitive account actions require the current password and, when configured, MFA. Normal TOTP login rejects replayed steps. Authenticator rotation requires current password/MFA and keeps the previous seed active until the new one is confirmed. Password/MFA/email/role changes and account suspension revoke sessions; credential versions prevent a concurrent old-password login from minting a new session after revocation.

Account deletion is immediate and transactional because attachments are stored in PostgreSQL. Sessions, tokens, owned properties, documents and memberships cascade away; another owner's content survives. A user who still owns shared properties must transfer each property to an active editor or remove its shares first. Transfers are in the collaboration panel in web and native; outstanding property invitations are revoked. Admin deletion is restricted to accounts with no owned properties. The last active administrator cannot be deleted, suspended or downgraded.

Exports are streamed JSON containing owned properties, valuations, workspaces, public analysis results/diagnostics and Base64 document content. They exclude password/session/MFA secrets and other users' account identities. No currency conversion or paid research is triggered. Mobile exports are shared as a temporary JSON file, then removed from app cache.

## First administrator: deliberate one-time bootstrap

An existing, active registered account is required. A future `admin@...` mailbox need not exist yet; an existing personal email can hold the platform role, and later be changed after mail verification. No invented admin account or default password is created.

```bash
./scripts/docker exec -T api node dist/bootstrap-admin.mjs 'your-existing-account@example.com'
```

The command refuses to run when an admin already exists, revokes this account's old sessions and audits the promotion. Log in again, open **Mein Konto**, enroll an authenticator by entering the provided secret, confirm its six-digit code and save the recovery codes. Then `/admin` is accessible. Further role changes use the admin panel and require password/MFA plus an audit reason. If Docker group state is stale, prefix the command with `sg docker -c '...'` as described in AGENTS.md.

Roles are `user`, `support` and `admin`, separate from property `owner`, `editor` and `viewer`. Admin access requires an MFA-authenticated session even in the localhost test deployment. Admins get account metadata and aggregate counts, not automatic access to private property details or files. Support can inspect metadata, revoke ordinary user sessions and send recovery/verification emails; it cannot change roles, suspend/delete accounts, create beta invites, view the complete audit log, or act on another staff account. There is no impersonation/backdoor or unimplemented promise of support content access.

## Closed beta and registration

Docker defaults to `REGISTRATION_MODE=invite`; existing accounts continue to work. Admin creates a 1–30 day, one-time invitation, optionally tied to an email. Its code appears only at creation. Users enter it during registration. Admin can revoke it and view expiry/usage.

An explicit `REGISTRATION_MODE` deployment setting overrides the database setting. To let the panel control it, set `REGISTRATION_MODE=` in `.local/docker/compose.env`, then recreate API/worker. The panel will only allow open signup when SMTP is configured and `ACCOUNT_REQUIRE_VERIFICATION=true`. Full production mode also refuses unsafe public signup without verification or an explicit invite-only override. With verification required, an unverified account can manage its account and resend verification but cannot access portfolio APIs.

On a fresh empty localhost-only deployment, temporarily use `REGISTRATION_MODE=open` to register the initial operator, bootstrap and enroll MFA, then return to `invite`. Never use this temporary onboarding configuration for public deployment.

## Mail adapter and secrets

No external mail provider is selected or paid for. SMTP is configurable and disabled by default. Add these settings to the private `.local/docker/compose.env` when a sender/domain is ready:

```dotenv
ACCOUNT_PUBLIC_URL=https://your-web-domain.example
SMTP_HOST=your-provider-smtp-host
SMTP_PORT=587
SMTP_FROM=EstateAtlas <accounts@your-domain.example>
SMTP_USER=your-provider-user
SMTP_SECURE=false
SMTP_ALLOW_INSECURE=false
ACCOUNT_REQUIRE_VERIFICATION=true
```

Put the SMTP password in `.local/docker/smtp-password` on the server, never in chat/Git. Port 465 uses `SMTP_SECURE=true`; port 587 uses required STARTTLS. Certificate validation stays enabled. Recreate the API after changing credentials/configuration. `ALLOW_LOCAL_HTTP=false`, matching HTTPS WEB_ORIGIN/API addresses and sender configuration are still required for public launch.

`./scripts/docker` creates `.local/docker/account-encryption-key` once and never overwrites it. Back it up separately in protected operator storage; losing it makes existing encrypted MFA seeds unusable. SMTP password and account key are mounted only into API, never into web/native bundles. Existing OpenAI secrets are unchanged.

For a private SMTP test without a domain:

```bash
./scripts/docker --profile mail-preview up -d mail-preview
./scripts/pnpm exec tsx scripts/check-account-mail.ts
```

Mailpit only captures mail locally; it does not deliver to real inboxes. Its UI is bound to VPS `127.0.0.1:8025` and SMTP to `127.0.0.1:1025`; use an SSH forward to inspect the UI. To test app delivery through it, temporarily set `SMTP_HOST=mail-preview`, `SMTP_PORT=1025`, `SMTP_FROM=EstateAtlas preview <preview@example.test>`, `SMTP_ALLOW_INSECURE=true` in compose.env and recreate the API while ALLOW_LOCAL_HTTP=true. Do not treat Mailpit capture as real email verification for a public deployment. Remove these settings and stop the preview afterwards.

## Backups and operator checks

The Docker `backup` service writes a full custom-format PostgreSQL dump immediately and every 24 hours to `.local/backups/automatic`, including DB-backed attachments. Retention defaults to seven days; interval and retention are configurable. It verifies the dump's archive listing before publishing it, writes through a temporary filename, and becomes unhealthy if it cannot continue. Filenames/logs contain no user addresses, tokens or document names.

```bash
./scripts/check-backup
./scripts/docker ps
./scripts/docker logs --tail=30 backup
```

`check-backup` restores the latest dump with `--exit-on-error` into a disposable PostgreSQL service, checks the restored core tables, and removes that service. It never restores into the live database or mounts the live data volume. Dumps and MFA encryption key need an encrypted off-VPS copy before public launch; no external backup destination or credentials have been supplied. Deleted data can remain in retained backups until rotation. Any operator restore from an older backup must reconcile deletions/revocations made since that snapshot before opening access.

## Verification and remaining operator work

Automated checks cover PostgreSQL migrations, password reset/verification single-use and expiry, MFA RFC vectors and recovery replay, session isolation, suspension and restoration, support/admin boundaries, last-admin protection, invitation binding/usage/revocation, owned-file exports and transfer/deletion semantics. Browser checks cover real account settings and admin workflows on desktop and a mobile viewport. Android/iOS Hermes export validates bundles, not installation or an actual device.

Pending external setup: select the real first-admin account and run bootstrap; configure a real sender/provider and HTTPS domain; copy backups/key off the VPS; finalize published retention/support/privacy information; exercise the native screens on a real iPhone/TestFlight build. Admin assignment and SMTP delivery are not claimed active until those operator steps occur.
