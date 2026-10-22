# Development

Use `dev` as the integration branch. The default app runtime is Docker Compose, with native clients developed separately using Expo.

## Toolchain

```bash
git clone https://github.com/LuPetro/estate-atlas.git
cd estate-atlas
git switch dev
./scripts/bootstrap.sh
git switch -c feat/your-change
```

The bootstrap installs pinned Node 22.23.3, pnpm 10.34.6 and locked dependencies under the checkout. It does not install global packages or change system settings. The root `.env.example` documents mobile/legacy tooling variables; Docker configuration is generated separately by `./scripts/docker`.

Use `./scripts/pnpm` to keep caches, browser downloads and temporary databases in ignored `.local/`. Use `./scripts/docker up -d --build --wait` to run the localhost app; see [self-hosting](docker.md). On the maintained VPS select the environment described in [deployment](development-deployment.md).

## Checks

Run resource-intensive commands sequentially on a small machine:

```bash
./scripts/pnpm typecheck
./scripts/pnpm test
./scripts/pnpm build
./scripts/pnpm mobile:export
./scripts/check-workflows
./scripts/check-secrets
./scripts/pnpm exec node scripts/check-docs.mjs
```

API tests start a temporary real PostgreSQL cluster on port 55433. Browser tests use a separate PostgreSQL cluster on 55434 and API/Web on 4001/3001. They use synthetic accounts/data and do not clear the application database. Do not run multiple copies of these test suites at the same time.

For desktop and mobile browser tests:

```bash
./scripts/pnpm exec playwright install chromium
./scripts/pnpm test:e2e
```

On Ubuntu 24.04 x64 without browser libraries, `./scripts/browser-deps.sh` can extract the needed libraries into `.local/sysroot/` without system installation. On other systems provide the platform's supported Playwright dependencies. Traces/screenshots remain ignored in `work/`, `test-results/` and `playwright-report/`.

For a real fresh-clone Docker check, run `./scripts/pnpm exec node scripts/check-self-hosting.mjs`; see its scope in [self-hosting](docker.md). Add `--screenshots` to regenerate the documented synthetic desktop/mobile previews; this also needs the local Playwright browser and its runtime libraries.

## Native apps

```bash
./scripts/pnpm dev:mobile
./scripts/docker --profile mobile logs --tail=50 mobile
./scripts/docker --profile mobile stop mobile
```

This optional Docker profile runs Metro on loopback port 8081. A phone's `localhost` is not your development computer: use a controlled connection and the appropriate `EXPO_PUBLIC_API_URL`. Read [mobile testing](mobile-testing.md) before device work. The CI export builds Android/iOS JavaScript, not signed applications. Do not substitute the PWA for native validation.

## Conventions

- Shared validation and business rules live in `packages/shared`; shared HTTP behavior in `packages/api-client`.
- Private resources require ownership/membership checks on the server. Keep currency totals separate.
- Use synthetic fixtures, including map/provider responses. No real provider requests or user data in tests.
- Describe checks actually performed. Device checks, public mail delivery and provider costs need their own validation.
- Read relevant `AGENTS.md` instructions before changing a component. Next.js-specific instructions are in `apps/web/AGENTS.md`.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for pull requests and [Security](../SECURITY.md) for private reports.
