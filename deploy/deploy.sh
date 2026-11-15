#!/usr/bin/env bash
# Refresh the frontend and data-science checkouts on lazarvps, rebuild the stack and wait for the front to answer.
# Run by the self-hosted runner on pushes to main, or by hand: ~/arecibo/frontend/deploy/deploy.sh
set -euo pipefail

ROOT="${ARECIBO_ROOT:-$HOME/arecibo}"
PORT="$(grep -s '^FRONTEND_PORT=' "$ROOT/frontend/.env" | cut -d= -f2 || true)"
PORT="${PORT:-8088}"

for repo in frontend data-science; do
  git -C "$ROOT/$repo" fetch --quiet origin main
  git -C "$ROOT/$repo" reset --hard --quiet origin/main
done

cd "$ROOT/frontend"
docker compose up -d --build --remove-orphans
docker compose ps

for _ in $(seq 1 30); do
  if curl -fs "http://127.0.0.1:$PORT/" >/dev/null && curl -fs "http://127.0.0.1:$PORT/amber/health" >/dev/null; then
    echo "frontend answers on port $PORT"
    exit 0
  fi
  sleep 5
done

echo "frontend does not answer on port $PORT" >&2
exit 1
