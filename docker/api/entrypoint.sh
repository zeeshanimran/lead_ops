#!/bin/sh
set -e

cd /app/apps/api

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  npm run prisma:seed
fi

cd /app
exec "$@"

