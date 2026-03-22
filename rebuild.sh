#!/bin/bash
# Rebuild the container image and restart NanoClaw

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Building TypeScript..."
npm run build

echo "==> Rebuilding container image..."
bash container/build.sh "$@"

echo "==> Stopping running containers..."
CONTAINERS=$(docker ps --filter name=nanoclaw- -q)
if [ -n "$CONTAINERS" ]; then
  docker stop $CONTAINERS
  echo "Stopped containers."
else
  echo "No running containers."
fi

echo "==> Restarting NanoClaw service..."
launchctl kickstart -k "gui/$(id -u)/com.nanoclaw"

echo "Done! NanoClaw is restarting with the new image."
