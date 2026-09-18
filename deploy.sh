#!/usr/bin/env bash
# Publish the current state of this folder to GitHub Pages.
# Usage:  ./deploy.sh "what changed"
set -euo pipefail
cd "$(dirname "$0")"

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "Usage: ./deploy.sh \"what changed\"" >&2
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing to commit — working tree is clean."
else
  git add -A
  git commit -q -m "$MSG"
  echo "Committed: $MSG"
fi

git push -q origin main
echo
echo "Pushed. Live in ~1 min at:"
echo "  https://luhman-studio.github.io/green-app/"
echo "(hard-reload with Cmd+Shift+R if you still see the old version)"
