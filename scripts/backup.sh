#!/bin/sh
set -eu
umask 077
export PGPASSWORD="$(cat /run/secrets/postgres_app_password)"
interval="${BACKUP_INTERVAL_SECONDS:-86400}"
retention="${BACKUP_RETENTION_DAYS:-7}"
case "$interval" in ''|*[!0-9]*) exit 1;; esac
case "$retention" in ''|*[!0-9]*) exit 1;; esac
[ "$interval" -ge 300 ] && [ "$retention" -ge 1 ] || exit 1
while :; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="/backups/estateatlas-$stamp.dump"
  pg_dump --format=custom --no-owner --no-acl --file="$target.tmp"
  pg_restore --list "$target.tmp" >/dev/null
  mv "$target.tmp" "$target"
  find /backups -name 'estateatlas-*.dump' -type f -mtime "+$((retention-1))" -delete
  echo "EstateAtlas database backup completed: $stamp"
  elapsed=0
  while [ "$elapsed" -lt "$interval" ]; do
    date +%s >/tmp/backup-health
    sleep 30
    elapsed=$((elapsed+30))
  done
done
