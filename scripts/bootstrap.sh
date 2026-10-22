#!/usr/bin/env bash
set -euo pipefail
if (( $# > 1 )) || [[ $# == 1 && "$1" != --runtime-only ]]; then
  echo 'Usage: ./scripts/bootstrap.sh [--runtime-only]' >&2
  exit 1
fi
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TASK_ROOT"
mkdir -p .local/cache .local/tmp
export TMPDIR="$TASK_ROOT/.local/tmp"
case "$(uname -s)" in Linux) TASK_OS=linux ;; Darwin) TASK_OS=darwin ;; *) echo 'Use Node 22.13+ and pnpm 10 on this platform.'; exit 1 ;; esac
case "$(uname -m)" in x86_64) TASK_ARCH=x64 ;; aarch64|arm64) TASK_ARCH=arm64 ;; *) echo 'Unsupported CPU'; exit 1 ;; esac
TASK_NODE_VERSION=v22.23.3
TASK_ARCHIVE="node-$TASK_NODE_VERSION-$TASK_OS-$TASK_ARCH.tar.xz"
if [ ! -x .local/node/bin/node ]; then
  curl -fsSL "https://nodejs.org/dist/$TASK_NODE_VERSION/SHASUMS256.txt" -o .local/cache/node-shasums.txt
  curl -fsSL "https://nodejs.org/dist/$TASK_NODE_VERSION/$TASK_ARCHIVE" -o ".local/cache/$TASK_ARCHIVE"
  (cd .local/cache; if command -v sha256sum >/dev/null; then sed -n "/  $TASK_ARCHIVE\$/p" node-shasums.txt | sha256sum -c -; else sed -n "/  $TASK_ARCHIVE\$/p" node-shasums.txt | shasum -a 256 -c -; fi)
  tar -xJf ".local/cache/$TASK_ARCHIVE" -C .local
  ln -s "${TASK_ARCHIVE%.tar.xz}" .local/node
fi
export PATH="$TASK_ROOT/.local/node/bin:$PATH"
if [[ "${1:-}" == --runtime-only ]]; then
  echo 'Project-local Node is ready. Start Docker with ./scripts/docker up -d --build --wait.'
  exit 0
fi
export npm_config_cache="$TASK_ROOT/.local/cache/npm"
export npm_config_update_notifier=false
if [ ! -f .local/tools/node_modules/pnpm/bin/pnpm.cjs ]; then
  npm install --prefix .local/tools --no-audit --no-fund pnpm@10.34.6
fi
./scripts/pnpm install --frozen-lockfile
