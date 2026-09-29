# shellcheck shell=bash
# Sourcé par les scripts de deploy/. La répétition change LANGESTLOC_DIR et
# COMPOSE_PROJECT pour ne jamais toucher une vraie stack.

export LANGESTLOC_DIR=${LANGESTLOC_DIR:-/opt/langestloc}
export COMPOSE_PROJECT=${COMPOSE_PROJECT:-langestloc}

# shellcheck disable=SC2034
IMAGE_REPO=ghcr.io/cheickla/langestloc-api
# shellcheck disable=SC2034
AWS_CLI_IMAGE=amazon/aws-cli:2.37.4

# Ne doit jamais échouer : un log raté couperait un retour arrière en plein milieu.
log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" || true; }
die() { log "ERREUR : $*" >&2; exit 1; }

compose() {
  docker compose -p "$COMPOSE_PROJECT" -f "$LANGESTLOC_DIR/compose.prod.yml" "$@"
}

db_psql() {
  # shellcheck disable=SC2016
  compose exec -T db sh -c 'psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"
}

# La relecture repère un dump tronqué.
dump_db() {
  # shellcheck disable=SC2016
  compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$1" || return 1
  compose exec -T db pg_restore --list < "$1" > /dev/null || return 1
}
