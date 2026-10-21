# Contributing to EstateAtlas

`dev` is the integration branch and the source of [dev.estateatlas.app](https://dev.estateatlas.app). `main` contains production releases. Start feature branches from `dev` and target `dev` with your pull request.

```text
feature branch → pull request → dev → checks → automatic Dev deployment
                                  ↓
                          release pull request
                                  ↓
                                main → checks → production approval → production
```

Both branches run workflow validation, a redacted secret scan over the full Git history, workspace type checks, dependency auditing, real PostgreSQL API tests, production builds, desktop/mobile browser tests and Android/iOS exports. `checks / Required checks` succeeds only when every required job succeeds. Pull requests, including forks, run without deployment secrets and cannot deploy.

Use the project-local toolchain via `./scripts/pnpm`. Application operation uses Docker Compose; see [README](README.md) and [development deployment](docs/development-deployment.md). Tests use isolated databases and synthetic fixtures. Never commit `.env`, `.local`, database dumps, user data or credentials. Do not run real provider requests as tests.

For a release, open a pull request from `dev` to `main`. Both merge and squash commits are supported: production requires the same complete source tree as a successful Dev release. An untested change introduced during merging must go through `dev` first. The release promotes immutable Docker image IDs and never copies Dev data into production.

Production is released through **Actions → EstateAtlas Main pipeline → Run workflow → main → production_approval=deploy**. A push to `main` runs checks. Production preflight and HTTPS checks remain required.

Repository administrators can inspect the intended branch/environment policy with `node scripts/configure-github.mjs` and apply it with `node scripts/configure-github.mjs --apply` using an authenticated GitHub CLI. The script changes neither repository visibility nor secrets. Some GitHub plans restrict protection rules in private repositories; rerun after making the repository public if GitHub rejects those settings.
