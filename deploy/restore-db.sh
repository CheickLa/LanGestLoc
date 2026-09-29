#!/usr/bin/env bash
# Restaure une sauvegarde en remplaçant tout le schéma public, en une seule
# transaction. pg_restore --clean ne suffit pas : il laisserait en place les tables
# créées par une migration ratée.
# Usage (API arrêtée) : restore-db.sh <sauvegarde.dump>
set -euo pipefail
umask 077

# Dans main() pour que bash lise tout le fichier avant de l'exécuter (voir deploy.sh).
main() {
  # shellcheck source=deploy/common.sh
  source "$(dirname "$0")/common.sh"

  local dump=${1:-}
  [[ -n $dump && -f $dump ]] || die "usage : restore-db.sh <sauvegarde.dump>"

  if [[ -n $(compose ps -q --status running api) ]]; then
    die "l'API tourne : l'arrêter d'abord (docker compose -f compose.prod.yml stop api)"
  fi

  # Pas de local : le trap tourne après la fin de main.
  sql=$(mktemp)
  trap 'rm -f "$sql"' EXIT

  # SQL généré avant de toucher la base : un flux coupé finirait quand même par un COMMIT.
  compose exec -T db pg_restore --no-owner -f - < "$dump" > "$sql" \
    || die "sauvegarde illisible : $dump (base inchangée)"

  log "Restauration de $dump"
  if ! { printf 'DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n'; cat "$sql"; } \
    | db_psql --single-transaction > /dev/null; then
    die "restauration annulée : base inchangée"
  fi
  log "Base restaurée"
}

main "$@"; exit
