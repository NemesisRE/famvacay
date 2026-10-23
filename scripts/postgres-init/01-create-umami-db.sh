#!/bin/sh
# Runs automatically on first container start (empty data volume only) via
# /docker-entrypoint-initdb.d - creates a separate database for the self-hosted Umami
# analytics service so it never shares a schema with the application's own tables.
#
# On an EXISTING deployment (volume already initialized), this script will NOT run again.
# Create the database manually instead:
#   docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
#     -c "CREATE DATABASE \"$UMAMI_DB\";"
set -e

if [ -n "$UMAMI_DB" ] && [ "$UMAMI_DB" != "$POSTGRES_DB" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE "$UMAMI_DB"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$UMAMI_DB')\gexec
EOSQL
fi
