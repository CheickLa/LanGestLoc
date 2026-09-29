#!/usr/bin/env bash
# Sauvegarde quotidienne : pg_dump chiffré avec la clé publique age, puis envoyé sur S3.
# Le serveur ne peut pas relire ses propres sauvegardes. Configuration : backup.env.
set -euo pipefail
umask 077

# Sans HEALTHCHECK_URL, rien n'est envoyé : Healthchecks alertera faute de signal.
signal() {
  [[ -n ${HEALTHCHECK_URL:-} ]] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "$HEALTHCHECK_URL$1" || log "signal Healthchecks impossible"
}

# Global : on_exit la lit après la fin de main.
tmp=
# shellcheck disable=SC2317
on_exit() {
  local status=$?
  if [[ -n $tmp ]]; then rm -rf "$tmp"; fi
  if (( status != 0 )); then signal /fail; fi
}

# Dans main() pour que bash lise tout le fichier avant de l'exécuter (voir deploy.sh).
main() {
  # shellcheck source=deploy/common.sh
  source "$(dirname "$0")/common.sh"
  trap on_exit EXIT

  # Même verrou que deploy.sh : pas de sauvegarde en pleine migration.
  exec 9> "$LANGESTLOC_DIR/.deploy.lock"
  flock -w 600 9 || die "un déploiement tourne depuis plus de 10 min"

  [[ -f $LANGESTLOC_DIR/backup.env ]] || die "$LANGESTLOC_DIR/backup.env introuvable"
  set -a
  # shellcheck source=/dev/null
  source "$LANGESTLOC_DIR/backup.env"
  set +a

  : "${BACKUP_BUCKET:?manquant dans backup.env}" "${AGE_RECIPIENT:?manquant dans backup.env}"
  : "${AWS_ACCESS_KEY_ID:?manquant dans backup.env}" "${AWS_SECRET_ACCESS_KEY:?manquant dans backup.env}"
  export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-west-3}

  tmp=$(mktemp -d)
  local name
  name="langestloc-$(date -u +%Y-%m-%dT%H%M%SZ).dump.age"

  log "Sauvegarde de la base"
  dump_db "$tmp/base.dump" || die "pg_dump ou relecture en échec"
  age -r "$AGE_RECIPIENT" -o "$tmp/$name" "$tmp/base.dump" || die "chiffrement en échec"
  rm -f "$tmp/base.dump"

  log "Envoi vers s3://$BACKUP_BUCKET/daily/$name"
  # Réseau proxy : c'est par lui que la stack sort vers Internet.
  docker run --rm -i --network proxy \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION -e AWS_ENDPOINT_URL \
    "$AWS_CLI_IMAGE" s3 cp - "s3://$BACKUP_BUCKET/daily/$name" --only-show-errors < "$tmp/$name" \
    || die "envoi vers S3 en échec"

  signal ""
  log "Sauvegarde envoyée : $name"
}

main "$@"; exit
