#!/bin/bash

set -e

# Always run from project root (script location)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Use nodemon when available for backend file watching only.
# Frontend files in public/ are served statically and picked up on browser refresh.
if command -v npx >/dev/null 2>&1; then
  echo "Starting dev server with live restart (nodemon)..."
  exec npx nodemon --watch server.js --ext js,json --signal SIGTERM server.js
fi

# Fallback: built-in Node watcher (backend files)
echo "npx not found; starting with node --watch"
exec node --watch server.js
