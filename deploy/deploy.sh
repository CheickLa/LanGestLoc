#!/usr/bin/env bash
# Déploie une version de l'API sur le VPS. Lancé par le job « Déploiement API (VPS) »
# depuis /opt/langestloc/incoming/, avec le jeton GHCR sur l'entrée standard.
# Usage : deploy.sh <sha> <utilisateur-ghcr>
# Sortie : 0 déployé, 1 échec (l'ancienne version tourne), 2 retour arrière échoué.
set -euo pipefail
umask 077

set_tag() {
  sed -i "s/^API_IMAGE_TAG=.*/API_IMAGE_TAG=$1/" "$env_file" \
    && [[ $(sed -n 's/^API_IMAGE_TAG=//p' "$env_file" | tail -n 1) == "$1" ]]
}

save_previous_files() {
  local f
  rm -rf "$LANGESTLOC_DIR/previous" || return 1
  mkdir "$LANGESTLOC_DIR/previous" || return 1
  for f in "${FILES[@]}"; do
    if [[ -f $LANGESTLOC_DIR/$f ]]; then cp -p "$LANGESTLOC_DIR/$f" "$LANGESTLOC_DIR/previous/" || return 1; fi
  done
}

# Copie puis renommage : un script en cours d'exécution garde l'ancien fichier.
install_files() {
  local f
  for f in "${FILES[@]}"; do
    if [[ -f $1/$f ]]; then
      cp -p "$1/$f" "$LANGESTLOC_DIR/.$f.tmp" || return 1
      mv -f "$LANGESTLOC_DIR/.$f.tmp" "$LANGESTLOC_DIR/$f" || return 1
    fi
  done
}

wait_healthy() {
  local out deadline=$((SECONDS + HEALTH_TIMEOUT))
  while (( SECONDS < deadline )); do
    if out=$(compose exec -T api wget -q -T 5 -O- http://127.0.0.1:3000/health 2> /dev/null) \
      && [[ $out == *'"status":"ok"'* ]]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

running_image() {
  docker inspect --format '{{.Config.Image}}' "$(compose ps -q api)"
}

# Pas de `prisma migrate status` : son code de sortie ne distingue pas
# « migration en attente » et « erreur ».
pending_migrations() {
  local in_image has_table applied=
  # shellcheck disable=SC2016
  in_image=$(docker run --rm --entrypoint sh "$IMAGE_REPO:$new_tag" \
    -c 'cd prisma/migrations && for d in */; do [ -d "$d" ] && printf "%s\n" "${d%/}"; done') || return 1
  has_table=$(db_psql -tA -c "SELECT to_regclass('public._prisma_migrations') IS NOT NULL") || return 1
  if [[ $has_table == t ]]; then
    applied=$(db_psql -tA -c "SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL") || return 1
  fi
  LC_ALL=C comm -23 <(LC_ALL=C sort <<< "$in_image") <(LC_ALL=C sort <<< "$applied") | sed '/^$/d'
}

# Échec avant la migration : la base n'a pas bougé.
abort() {
  log "ÉCHEC : $1. La base n'a pas été modifiée."
  install_files "$LANGESTLOC_DIR/previous" || log "ATTENTION : fichiers précédents non remis en place"
  # Si c'est le nouveau compose.prod.yml qui a cassé db, l'ancien la relance.
  export API_IMAGE_TAG=$old_tag
  compose up -d --wait --wait-timeout "$DB_WAIT_TIMEOUT" db || rollback_failed "la base ne redémarre pas"
  if (( api_stopped )); then
    if ! compose up -d api || ! wait_healthy; then
      rollback_failed "l'ancienne version ne répond pas"
    fi
  fi
  exit 1
}

# Échec pendant la migration ou la bascule. L'API était arrêtée depuis la sauvegarde :
# seul ce que la nouvelle version a écrit pendant ses quelques secondes en ligne est perdu.
rollback() {
  log "ÉCHEC : $1. Retour à la version $old_tag."
  export API_IMAGE_TAG=$old_tag
  compose stop api || true
  if (( migration_tried )); then
    log "Restauration de la base depuis $backup"
    bash "$LANGESTLOC_DIR/restore-db.sh" "$backup" || rollback_failed "restauration de la base impossible"
  fi
  install_files "$LANGESTLOC_DIR/previous" || rollback_failed "fichiers précédents non remis en place"
  set_tag "$old_tag" || rollback_failed "écriture de API_IMAGE_TAG impossible"
  if ! compose up -d api || ! wait_healthy; then
    rollback_failed "l'ancienne version ne répond pas"
  fi
  log "Retour arrière terminé : l'API tourne sur $old_tag"
  exit 1
}

rollback_failed() {
  log "RETOUR ARRIÈRE ÉCHOUÉ : $1."
  log "Intervention manuelle : section « Revenir en arrière » de deploy/README.md (sauvegarde : ${backup:-aucune})."
  exit 2
}

# Tout est dans main() : bash lit le fichier en entier avant de l'exécuter. Sans ça, un
# déploiement qui a survécu à sa session SSH lirait les octets que le job suivant vient
# de réécrire dans incoming/.
main() {
  incoming=$(cd "$(dirname "$0")" && pwd)
  # shellcheck source=deploy/common.sh
  source "$incoming/common.sh"

  # Le job envoie tout deploy/*.sh, seuls ceux-là sont installés.
  FILES=(compose.prod.yml common.sh deploy.sh restore-db.sh backup.sh)
  HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}
  DB_WAIT_TIMEOUT=${DB_WAIT_TIMEOUT:-120}
  KEEP_BACKUPS=10
  KEEP_LOGS=30

  new_tag=${1:-}
  ghcr_user=${2:-}
  [[ $new_tag =~ ^[0-9a-f]{40}$ ]] || die "SHA invalide : « $new_tag » (40 caractères hexadécimaux attendus)"

  ghcr_token=
  if [[ ${SKIP_PULL:-} != 1 ]]; then
    [[ -n $ghcr_user ]] || die "utilisateur GHCR manquant (2e argument)"
    IFS= read -r ghcr_token || [[ -n $ghcr_token ]] || die "jeton GHCR attendu sur l'entrée standard"
  fi
  exec < /dev/null

  # Sortie dans un fichier, recopiée vers SSH seulement à la fin : si la connexion
  # tombe, le script n'y écrit pas et va quand même au bout.
  mkdir -p "$LANGESTLOC_DIR"/{logs,backups,previous}
  run_log="$LANGESTLOC_DIR/logs/deploy-$(date -u +%Y%m%d-%H%M%S)-${new_tag:0:7}.log"
  exec 3>&1
  exec >> "$run_log" 2>&1
  trap '' HUP PIPE
  trap 'cat "$run_log" >&3 2> /dev/null || true' EXIT
  # shellcheck disable=SC2012
  ls -1t "$LANGESTLOC_DIR"/logs/deploy-*.log | tail -n +$((KEEP_LOGS + 1)) | xargs -r rm -f -- \
    || log "ATTENTION : purge des anciens journaux impossible"

  exec 9> "$LANGESTLOC_DIR/.deploy.lock"
  flock -w 600 9 || die "un autre déploiement tourne depuis plus de 10 min"

  log "Déploiement de $new_tag"
  env_file="$LANGESTLOC_DIR/.env"
  [[ -f $env_file ]] || die "$env_file introuvable"
  old_tag=$(sed -n 's/^API_IMAGE_TAG=//p' "$env_file" | tail -n 1)
  [[ $old_tag =~ ^[0-9a-f]{40}$ ]] || die "API_IMAGE_TAG absent ou invalide dans $env_file : « $old_tag »"
  log "Version en place : $old_tag"

  api_stopped=0
  migration_tried=0
  backup=

  save_previous_files || die "copie des fichiers en place impossible"
  install_files "$incoming" || abort "installation des fichiers impossible"
  export API_IMAGE_TAG=$new_tag

  if [[ ${SKIP_PULL:-} != 1 ]]; then
    log "Téléchargement de $IMAGE_REPO:$new_tag"
    printf '%s\n' "$ghcr_token" | docker login ghcr.io -u "$ghcr_user" --password-stdin > /dev/null \
      || abort "connexion à GHCR impossible"
    pulled=1
    compose pull --quiet api || pulled=0
    docker logout ghcr.io > /dev/null || true
    (( pulled )) || abort "téléchargement de l'image impossible"
  fi
  docker image inspect "$IMAGE_REPO:$new_tag" > /dev/null 2>&1 \
    || abort "image $IMAGE_REPO:$new_tag introuvable"

  compose up -d --wait --wait-timeout "$DB_WAIT_TIMEOUT" db || abort "la base ne démarre pas"

  pending=$(pending_migrations) || abort "lecture des migrations impossible"
  if [[ -n $pending ]]; then
    log "Migrations à appliquer :"
    while IFS= read -r m; do printf '  %s\n' "$m"; done <<< "$pending"
    log "Arrêt de l'API : plus aucune écriture jusqu'à la fin du déploiement"
    api_stopped=1
    compose stop api || abort "arrêt de l'API impossible"
  else
    log "Aucune migration à appliquer"
  fi

  backup="$LANGESTLOC_DIR/backups/avant-$(date -u +%Y%m%d-%H%M%S)-${new_tag:0:7}.dump"
  log "Sauvegarde de la base : $backup"
  if ! dump_db "$backup"; then
    rm -f "$backup"
    backup=
    abort "sauvegarde impossible"
  fi
  # shellcheck disable=SC2012
  ls -1t "$LANGESTLOC_DIR"/backups/avant-*.dump | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f -- \
    || log "ATTENTION : purge des anciennes sauvegardes impossible"

  if [[ -n $pending ]]; then
    migration_tried=1
    log "Application des migrations"
    compose run --rm -T api npx prisma migrate deploy || rollback "migration en échec"
  fi

  set_tag "$new_tag" || rollback "écriture de API_IMAGE_TAG impossible"
  log "Démarrage de l'API $new_tag"
  compose up -d api || rollback "démarrage de l'API impossible"
  wait_healthy || rollback "/health ne répond pas après ${HEALTH_TIMEOUT} s"
  [[ $(running_image) == "$IMAGE_REPO:$new_tag" ]] || rollback "l'API ne tourne pas sur l'image attendue"

  # On garde la nouvelle image et la précédente.
  docker images "$IMAGE_REPO" --format '{{.Tag}}' \
    | { grep -vxF -e "$new_tag" -e "$old_tag" || true; } \
    | while read -r tag; do docker rmi "$IMAGE_REPO:$tag" > /dev/null || true; done \
    || log "ATTENTION : nettoyage des anciennes images impossible"
  log "Déploiement réussi : l'API tourne sur $new_tag"
}

main "$@"; exit
