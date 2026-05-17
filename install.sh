#!/usr/bin/env sh
set -eu

APP_NAME="Snakes-Ladders"
REPO_URL="${REPO_URL:-https://github.com/Bradderz65/Snakes-Ladders.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/$APP_NAME}"
START_SERVER=0

usage() {
  cat <<EOF
Usage: sh install.sh [--start] [--dir PATH] [--repo URL]

Installs system dependencies, fetches this repo when needed, and runs npm install.

Options:
  --start       Start the game server after installation
  --dir PATH    Install/use the repo at PATH (default: ~/Snakes-Ladders)
  --repo URL    Git repository URL to clone when not already inside the repo
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --start)
      START_SERVER=1
      shift
      ;;
    --dir)
      if [ "$#" -lt 2 ]; then
        echo "--dir requires a path" >&2
        exit 1
      fi
      INSTALL_DIR="$2"
      shift 2
      ;;
    --repo)
      if [ "$#" -lt 2 ]; then
        echo "--repo requires a URL" >&2
        exit 1
      fi
      REPO_URL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

log() {
  printf '%s\n' "$1"
}

have() {
  command -v "$1" >/dev/null 2>&1
}

as_root() {
  if [ "$(id -u)" = "0" ]; then
    "$@"
  elif have sudo; then
    sudo "$@"
  else
    echo "Need root privileges to run: $*" >&2
    echo "Install Node.js, npm, and git manually, then rerun this script." >&2
    exit 1
  fi
}

install_system_deps() {
  if have node && have npm && have git; then
    return
  fi

  log "Installing system dependencies..."

  if have pkg; then
    pkg update -y
    pkg install -y nodejs git
  elif have apt-get; then
    as_root apt-get update
    as_root apt-get install -y nodejs npm git
  elif have dnf; then
    as_root dnf install -y nodejs npm git
  elif have yum; then
    as_root yum install -y nodejs npm git
  elif have apk; then
    as_root apk add nodejs npm git
  elif have brew; then
    brew install node git
  else
    echo "Unsupported package manager." >&2
    echo "Install Node.js, npm, and git manually, then rerun this script." >&2
    exit 1
  fi
}

inside_repo() {
  [ -f "package.json" ] && [ -f "server.js" ] && [ -d "public" ]
}

prepare_repo() {
  if inside_repo; then
    return
  fi

  if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating existing repo at $INSTALL_DIR..."
    git -C "$INSTALL_DIR" pull --ff-only
  elif [ -e "$INSTALL_DIR" ]; then
    echo "$INSTALL_DIR already exists but is not a git checkout." >&2
    echo "Choose another location with: INSTALL_DIR=/path/to/dir sh install.sh" >&2
    exit 1
  else
    log "Cloning repo into $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"
}

print_access_info() {
  port="${PORT:-3000}"
  log ""
  log "Installed successfully."
  log "Start the server with:"
  log "  cd $(pwd) && npm start"
  log ""
  log "Open on this device:"
  log "  http://127.0.0.1:$port"

  ip_addr=""
  if have hostname; then
    ip_addr="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  if [ -z "$ip_addr" ] && have ip; then
    ip_addr="$(ip -o -4 addr show wlan0 2>/dev/null | awk '{split($4,a,"/"); print a[1]; exit}' || true)"
  fi

  if [ -n "$ip_addr" ]; then
    log ""
    log "Open from another device on the same Wi-Fi:"
    log "  http://$ip_addr:$port"
  fi
}

install_system_deps
prepare_repo

log "Installing npm dependencies..."
npm install

print_access_info

if [ "$START_SERVER" = "1" ]; then
  log ""
  log "Starting server..."
  npm start
fi
