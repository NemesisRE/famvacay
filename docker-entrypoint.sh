#!/bin/sh
set -e

echo "[FamVacay Entrypoint] Starting container initialization..."

if [ -n "$DATABASE_URL" ]; then
  echo "[FamVacay Entrypoint] Checking database migrations..."
  npx prisma migrate deploy || echo "[FamVacay Entrypoint] Migration step skipped or failed, proceeding with server startup..."
fi

echo "[FamVacay Entrypoint] Launching Next.js standalone server on port ${PORT:-3000}..."
exec "$@"

