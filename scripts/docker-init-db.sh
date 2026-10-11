#!/bin/sh
set -eu
app_password=$(cat /run/secrets/postgres_app_password)
# Secrets are generated locally as 64 hex characters. Reject SQL metacharacters.
case "$app_password" in ''|*[!0-9a-f]*) exit 1 ;; esac
[ "${#app_password}" = 64 ] || exit 1
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<SQL
CREATE ROLE estateatlas LOGIN PASSWORD '$app_password';
ALTER DATABASE estateatlas OWNER TO estateatlas;
GRANT ALL ON SCHEMA public TO estateatlas;
SQL
