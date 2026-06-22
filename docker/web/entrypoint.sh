#!/bin/sh
set -eu

if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
  echo "NEXT_PUBLIC_API_URL is required" >&2
  exit 1
fi

node -e "const fs = require('fs'); const apiUrl = process.env.NEXT_PUBLIC_API_URL; fs.writeFileSync('/app/apps/web/public/runtime-config.js', 'window.__LEADOPS_CONFIG__ = ' + JSON.stringify({ apiUrl }) + ';\\n');"

exec "$@"
