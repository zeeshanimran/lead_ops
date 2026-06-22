#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_INTERNAL_PORT:?POSTGRES_INTERNAL_PORT is required}"

export DATABASE_URL="$(node -e "const user = encodeURIComponent(process.env.POSTGRES_USER); const password = encodeURIComponent(process.env.POSTGRES_PASSWORD); const database = encodeURIComponent(process.env.POSTGRES_DB); const host = process.env.POSTGRES_HOST; const port = process.env.POSTGRES_INTERNAL_PORT; process.stdout.write(\`postgresql://\${user}:\${password}@\${host}:\${port}/\${database}?sslmode=disable\`);")"

cd /app/apps/api

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  npm run prisma:seed
fi

cd /app
exec "$@"
