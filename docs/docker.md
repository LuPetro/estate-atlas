# Self-hosting with Docker

This guide starts a new, private localhost installation. It uses production-built Web/API images with an explicit localhost HTTP exception. A public service additionally needs the [public launch configuration](web-launch.md).

## Requirements

- Git, Bash, curl, tar and xz support.
- Docker Engine/Desktop with Compose v2 and permission to access its daemon.
- Outbound access to Node's downloads, npm and the public container registry during installation/builds.
- Free loopback ports 3000 (Web) and 4000 (API), or the overrides below.

The fresh-checkout check runs on Linux x86_64. The bootstrap also selects Node artifacts for Linux/macOS and x64/arm64, but those other combinations have not been validated here. Windows needs a Linux environment such as WSL2; PowerShell is not the shell used by these scripts. Do not treat native-device support as established by a server-side JavaScript export.

Build API and Web sequentially on a small host. The wrapper does this automatically; avoid running builds, browser tests and mobile exports at the same time on a memory-constrained machine.

The dependency installation stage limits Node's heap to 192 MiB per process and uses one pnpm tarball worker. Application builds have a separate 384 MiB heap limit. Heap limits do not cap total build memory: on a small host also use a dedicated BuildKit container with a hard memory limit. For the shared EstateAtlas VPS, this builder is selected in the repository's private Docker configuration:

```bash
DOCKER_CONFIG="$PWD/.local/docker/cli" docker buildx create \
  --name estateatlas-vps --driver docker-container --use \
  --driver-opt image=moby/buildkit:v0.34.0,memory=640m,memory-swap=640m,default-load=true,restart-policy=no
```

This requires Buildx with the Docker container driver and `default-load` support. The cap applies to the builder and its build processes, so memory exhaustion fails the build. `default-load=true` places completed images in the local image store for Compose. The builder starts on demand; its cache is separate from the default Docker builder. Inspect an existing builder before creating another one, and stop it with the same `DOCKER_CONFIG` and `docker buildx stop estateatlas-vps` when idle.

## First start

```bash
git clone https://github.com/LuPetro/estate-atlas.git
cd estate-atlas
./scripts/bootstrap.sh --runtime-only
./scripts/docker config --quiet
./scripts/docker up -d --build --wait
./scripts/docker ps
```

`--runtime-only` installs checksum-verified Node under `.local/node/`; it does not install host application dependencies or pnpm. Docker builds install locked dependencies inside their build stages. The complete developer bootstrap is documented in [development](development.md).

Open **http://localhost:3000** and register an account. Registration is open, with rate limits and a minimum 12-character password. There are no preset credentials or account invitation codes. In this local setup no SMTP server is configured and email verification is not required; password-recovery email cannot arrive until SMTP is configured. You may explicitly load the app's labeled synthetic portfolio after signing in.

The database is private to Docker. Web/API bind to host loopback only. This command does not bind public ports 80/443 or publish the site.

## Configuration and data

The first wrapper call initializes these files once:

| Location                               | Purpose                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `.local/docker/compose.env`            | Compose settings and build arguments                    |
| `.local/docker/site.json`              | Operator/support/privacy text used by the web app       |
| `.local/docker/postgres-*-password`    | Separate administrator and application database secrets |
| `.local/docker/account-encryption-key` | Encrypts MFA seeds; retain it with protected backups    |
| `.local/docker/smtp-password`          | SMTP secret, initially empty                            |
| `.local/docker/openai-api-key`         | Optional research provider secret, initially empty      |
| `.local/backups/automatic/`            | Automatic PostgreSQL dumps                              |

The private parent directories are mode 0700. File-backed Compose secrets are readable inside non-root containers; protect and back up the parent directories. Initialization preserves existing secrets and `.env`; copying `.env.example` is not a Docker setup step. Do not commit `.local`, backups or actual configuration.

To select different ports, first run `./scripts/docker config --quiet`, then edit the generated `.local/docker/compose.env`:

```dotenv
WEB_ORIGIN=http://localhost:3300
ACCOUNT_PUBLIC_URL=http://localhost:3300
NEXT_PUBLIC_API_URL=http://localhost:4400
WEB_PORT=3300
API_PORT=4400
ALLOW_LOCAL_HTTP=true
```

Then run `./scripts/docker up -d --build --wait`. `NEXT_PUBLIC_API_URL` and the optional public CARTO key are build arguments, so changing them requires a Web rebuild. Origins must match exactly; use the same hostname in the browser and configuration.

The default Compose project is `estate-atlas`. To run another **new** installation, set a unique `COMPOSE_PROJECT_NAME`, unique `API_IMAGE`/`WEB_IMAGE` tags, different ports and a separate checkout/state directory before its first command. Reuse those settings on every later command. Simply cloning into another directory does not create a different default project or database.

AI research is disabled by default. It needs explicit configuration, a provider key and a cost decision; see [AI research](ai-research.md). Ordinary portfolio use does not require a provider key. Address search sends only an explicit query to the configured Photon service; detail maps may contact map providers. The overview map and fonts are local; see [third-party notices](../THIRD_PARTY_NOTICES.md).

## Operation, updates and backups

```bash
./scripts/docker ps
./scripts/docker logs --tail=100 api web worker
./scripts/docker stop
./scripts/docker up -d --wait
./scripts/docker down
```

`stop` and `down` preserve the named PostgreSQL volume. **`down -v` deletes the database volume.** Do not change project names or regenerate secrets when updating an existing installation.

Before an update, keep a protected database backup and the account-encryption key. Review changes, pull the intended branch/release, then run `./scripts/docker up -d --build --wait`. API startup runs migrations; there is no automatic schema downgrade. Docker images can be replaced independently of your database volume.

The backup service creates daily local dumps with seven-day retention by default. Local dumps do not protect against losing the host. Keep a separate protected copy and verify recovery. The [account/operator guide](accounts-admin.md) documents administrator bootstrap, restore checks and recovery exports. Operational Node helpers need the full developer bootstrap because they use locked host dependencies.

## Public hosting and maintained environments

For public access, configure HTTPS, exact origins, TLS SMTP, mandatory email verification, real operator texts, a verified MFA administrator and recovery checks. Start with [web launch](web-launch.md). Local HTTP and mail settings are not a public deployment configuration.

The project's own VPS uses isolated `development` and `production` environments, not this default local project. Its commands must select `EA_ENVIRONMENT=development` or `EA_ENVIRONMENT=production`; see [deployment](development-deployment.md). The retired legacy project must not mount Dev's adopted database volume.

## Troubleshooting

| Symptom                                             | What to check                                                                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `node: command not found`                           | Run `./scripts/bootstrap.sh --runtime-only` in this checkout.                                                           |
| Cannot connect to the Docker daemon                 | Confirm daemon access in your own terminal; the wrapper does not change groups or socket permissions.                   |
| Port already allocated                              | Set both port and matching origin/API URL overrides, then rebuild Web.                                                  |
| Browser cannot reach API                            | Open `http://localhost:4000/health` (or your configured port); check Web's build-time API URL and exact browser origin. |
| Signup works but no reset/verification mail arrives | SMTP is disabled by default; configure it explicitly using the account guide.                                           |
| Services fail healthchecks                          | Inspect `./scripts/docker logs --tail=100 db api web worker`; remove secrets and private data before sharing logs.      |
| Build killed for lack of memory                     | Stop concurrent build/test work and ensure the host has sufficient memory; the wrapper serializes API/Web builds.       |

## Reproduce the fresh-checkout check

From a developer checkout after bootstrap:

```bash
./scripts/pnpm exec node scripts/check-self-hosting.mjs
```

This checks the **committed HEAD**, clones it without ignored files, installs only its local runtime and builds/runs its own temporary Docker project. It checks health, CORS, anonymous access denial, signup, labeled test-data persistence after restart and logout. Only its own temporary containers/volumes are removed. Its report and build logs stay under ignored `.local/`. It never opens a public port or contacts mail/AI/geocoding providers.
