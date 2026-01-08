#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${MIRROR_BROADCAST_URL:-}" || -z "${MIRROR_ADMIN_TOKEN:-}" ]]; then
  echo "mirror_broadcast: missing MIRROR_BROADCAST_URL or MIRROR_ADMIN_TOKEN; skipping."
  exit 0
fi

if [[ "${MIRROR_BROADCAST_FORCE:-}" != "1" ]]; then
  if [[ "${CF_PAGES_ENVIRONMENT:-}" != "production" ]]; then
    echo "mirror_broadcast: not production environment; skipping."
    exit 0
  fi
fi

message="${MIRROR_BROADCAST_MESSAGE:-}"
if [[ -z "$message" ]]; then
  commit_subject=""
  if command -v git >/dev/null 2>&1; then
    commit_subject="$(git log -1 --pretty=%s 2>/dev/null || true)"
  fi
  if [[ -n "$commit_subject" ]]; then
    message="Release update: ${commit_subject}"
  else
    message="Release update: deployment completed."
  fi
fi

export MIRROR_BROADCAST_MESSAGE_INTERNAL="$message"
payload="$(node -e "console.log(JSON.stringify({message: process.env.MIRROR_BROADCAST_MESSAGE_INTERNAL}))")"

curl -sS -X POST "$MIRROR_BROADCAST_URL" \
  -H "Content-Type: application/json" \
  -H "x-mirror-admin: ${MIRROR_ADMIN_TOKEN}" \
  -d "$payload"
