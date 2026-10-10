#!/usr/bin/env bash
# Extract Ubuntu 24.04 browser libraries into this repository; never apt install.
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TASK_ROOT"
mkdir -p .local/debs .local/sysroot
cd .local/debs
apt-get download libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 libxrender1 libxi6
for TASK_DEB in *.deb; do dpkg-deb -x "$TASK_DEB" ../sysroot; done
