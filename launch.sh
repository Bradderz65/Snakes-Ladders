#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Install Node.js 22 or newer and npm, or run sh install.sh."
    exit 1
fi
node -e "if (Number(process.versions.node.split('.')[0]) < 20) { console.error('Node.js 20 or newer is required.'); process.exit(1); }"

if [ ! -d node_modules ]; then
    npm ci
fi

# The server prints both local and LAN URLs and handles shutdown signals.
# An occupied port is reported normally; never terminate an unrelated service.
exec node server.js
