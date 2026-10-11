# Docker Compose

Docker Compose is the default app/server runtime requested by the owner. The native apps still run on Android/iOS; the shared Web/API/PostgreSQL backend runs in containers. No global software, users, Docker socket permissions, SSH, firewall or AppArmor configuration is modified by these scripts.

## Start and operate

```bash
cd /home/codexdev/projects/estate-atlas
./scripts/docker config --quiet
./scripts/docker build
./scripts/docker up -d --wait
./scripts/docker ps
./scripts/docker logs -f --tail=100
./scripts/docker down
```

`pnpm dev` and `pnpm docker:up` now start this same Compose stack. Secrets and settings are generated once in private `.local/docker/`; the original `.env` is never replaced. Web/API listen only on host loopback ports 3000/4000; PostgreSQL is accessible only inside the Compose network. The existing two-port SSH tunnel keeps working. `down` retains the named PostgreSQL volume. **Do not use `down -v`: it deletes the database volume.**

Healthchecks enforce DB → API/migrations → Web startup. App processes run as the image's non-root `node` user. PostgreSQL initializes a separate, non-superuser application role. Secrets are mounted from files; they are not build arguments or baked into images. Host secret directory is 0700; files are 0644 to support non-root readers of Compose file-backed secrets. Keep the directory private. Logs rotate; services restart unless explicitly stopped. The wrapper limits Compose concurrency; BuildKit shares dependency layers. Next uses a 384 MB heap.

Local Docker uses optimized production Web/API artifacts with explicitly permitted **localhost-only** HTTP cookies for SSH testing. Public deployment requires HTTPS `WEB_ORIGIN` and `ALLOW_LOCAL_HTTP=false` in `.local/docker/compose.env`. Set the public `NEXT_PUBLIC_API_URL` there and rebuild Web. Production security remains the default outside this explicit loopback-only exception.

## Import the existing host database

Build images before cutover, then pause the old host API/Web so there are no writes during migration. Keep the original project PostgreSQL running on 55432. Do not start Docker API/Web before import:

```bash
./scripts/docker up -d --wait db
./scripts/pnpm docker:import
./scripts/docker up -d --wait
./scripts/pnpm web:check
```

Import refuses any target that already contains tables. It exports a consistent PostgreSQL snapshot using a PostgreSQL 18 Docker client, stores a private custom-format dump under `.local/backups/`, restores transactionally into the fresh volume, and compares every application table's row count, including sessions, private attachments and migration history. Keep the original app paused until verification. The original host database, credentials and backup are retained for recovery; no host database files are copied into the Docker volume. Resume the original app if cutover fails. The import script itself does not stop user processes.

## Verified server state

On 11 October 2026, the owner granted `codexdev` Docker-group membership after explicitly authorizing it. This agent's existing session uses `sg docker -c '…'` to apply the new group; new login sessions inherit it normally. No other host account, global software, SSH, firewall or AppArmor settings were changed.

Both images were built using the Docker daemon. PostgreSQL was initialized with the restricted app role. The old host API/Web were paused; the consistent dump was restored into the fresh Compose volume. Row counts and full row fingerprints matched for all seven tables, including attachment bytes, session hashes and migration history. Original `.env`, database directory and private backup remain intact. The old host PostgreSQL was then stopped.

Web, API and database pass their container healthchecks, including after restart; all seven row counts still match the private backup. Services retain the original loopback ports; PostgreSQL has no host port. The server-side Chromium check passed Web/API connectivity and CORS without creating accounts or properties. A separate isolated production-API artifact smoke check passed migrations, registration, localhost-cookie authentication and private-route protection. Device checks remain pending.
