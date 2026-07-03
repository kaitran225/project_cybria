#!/usr/bin/env sh
# Cross-platform launcher — run from repo: .tools/run.sh <service>
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"
cd "$TOOLS"
exec python3 -m cybria_cli "$@"
