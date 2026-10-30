#!/bin/sh
# Creates the separate database for the self-hosted Umami analytics service (it never shares a
# schema with the application's own tables). Idempotent: does nothing when it already exists.
#
# Runs in two places:
# - /docker-entrypoint-initdb.d on the very first start of an empty data volume (local socket);
# - the one-shot `db-init` service in docker-compose.yml on EVERY start (PGHOST=postgres,
#   PGPASSWORD set) - the initdb hook alone never runs again once the volume exists, so an
#   interrupted first start used to leave Umami without its database for good.
set -e

if [ -z "$UMAMI_DB" ] || [ "$UMAMI_DB" = "$POSTGRES_DB" ]; then
  echo "UMAMI_DB is empty or the application database itself: nothing to create"
  exit 0
fi

# %I quotes the name as an identifier; the value is passed as a psql variable, never spliced into SQL
psql -v ON_ERROR_STOP=1 -v umami_db="$UMAMI_DB" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
	SELECT format('CREATE DATABASE %I', :'umami_db')
	WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'umami_db')\gexec
EOSQL

echo "Umami database \"$UMAMI_DB\" is present"
