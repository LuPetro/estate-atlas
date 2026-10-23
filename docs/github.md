# GitHub maintainer tools

Contributors can use their own Git client and GitHub account. GitHub authentication is not required to run a public checkout locally. Never share tokens or keys in issues, chat or pull requests.

## Branch model

Features target `dev`; release PRs go from `dev` to `main`. Both branches require pull requests and `checks / Required checks`. Dev deploys automatically after checks. Main deploys production automatically after its checks, using identical successfully deployed Dev source/images and passing production preflight. Merging the release PR authorizes publication; no separate workflow approval is needed. See [CONTRIBUTING.md](../CONTRIBUTING.md) and [deployment](development-deployment.md).

The reusable checks live in `.github/workflows/ci.yml`; callers are `development.yml` and `main.yml`. Fork PRs receive no deployment secrets. Repository-default workflow tokens are read-only, and only the intended branch can deploy to each environment.

## Optional project-local CLI

The maintainer's `./scripts/gh` wrapper uses the ignored `.local/gh/` binary and `.local/github/` configuration. This is separate from an ordinary contributor setup; do not copy the maintainer's directory to another checkout. CLI installation is handled by `scripts/bootstrap-github.mjs` when needed.

An operator can authenticate in their own terminal:

```bash
./scripts/gh auth login --hostname github.com --git-protocol https --web
./scripts/gh auth status
```

Complete the device flow only in the operator's browser. Avoid global credential configuration if it is unwanted; protect `.local/github/`, particularly on a server without a credential-store service.

## Policy management

The intended branch/environment policy lives in `config/github-branches.json`. Read it with `./scripts/pnpm exec node scripts/configure-github.mjs`; apply it with an authenticated admin CLI:

```bash
GH_BIN=./scripts/gh ./scripts/pnpm exec node scripts/configure-github.mjs --apply
```

This preserves visibility and secrets, requires PRs/checks, blocks force pushes/deletions and restricts environment branches. GitHub may reject settings unsupported by the repository's plan; inspect the reported result and read back the actual policy. Publishing source is a separate owner decision; see [open-source release](open-source-release.md).
