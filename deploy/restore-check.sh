#!/usr/bin/env bash
# Restaure la dernière sauvegarde quotidienne dans un Postgres jetable et la contrôle.
# Lancé chaque lundi par restore-test.yml. AGE_SECRET_KEY contient la clé privée
# elle-même, jamais écrite sur le disque.
set -euo pipefail
umask 077
# shellcheck source=deploy/common.sh
source "$(dirname "$0")/common.sh"

: "${BACKUP_BUCKET:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}" "${AGE_SECRET_KEY:?}"
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-west-3}
max_age_hours=${MAX_AGE_HOURS:-26}
TABLES=(User Local Tenant Contract Rent RentDue Payment PaymentLine Deposit Receipt)

aws_cli() {
  docker run --rm -i --network "${S3_DOCKER_NETWORK:-bridge}" \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION -e AWS_ENDPOINT_URL \
    "$AWS_CLI_IMAGE" "$@"
}

tmp=$(mktemp -d)
pg=langestloc-restore-check-$$
# -v : le volume du Postgres jetable contient la base en clair.
trap 'docker rm -fv "$pg" > /dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

log "Recherche de la dernière sauvegarde dans s3://$BACKUP_BUCKET/daily/"
# --query s'applique page par page (1000 objets) : on retrie le tout.
latest=$(aws_cli s3api list-objects-v2 --bucket "$BACKUP_BUCKET" --prefix daily/ \
  --query 'sort_by(Contents, &LastModified)[-1].[Key, LastModified]' --output text \
  | sort -k2 | tail -n 1) \
  || die "liste des sauvegardes impossible (bucket vide ou accès refusé)"
read -r key modified <<< "$latest"
[[ -n $key && $key != None ]] || die "aucune sauvegarde dans daily/"
age_s=$(( $(date -u +%s) - $(date -u -d "$modified" +%s) ))
log "Dernière sauvegarde : $key ($((age_s / 3600)) h)"
(( age_s <= max_age_hours * 3600 )) \
  || die "dernière sauvegarde trop ancienne : $((age_s / 3600)) h (maximum $max_age_hours h)"

log "Téléchargement et déchiffrement"
aws_cli s3 cp "s3://$BACKUP_BUCKET/$key" - --only-show-errors > "$tmp/backup.age" \
  || die "téléchargement impossible"
age -d -i <(printf '%s\n' "$AGE_SECRET_KEY") -o "$tmp/backup.dump" "$tmp/backup.age" \
  || die "déchiffrement impossible (mauvaise clé ou fichier abîmé)"

log "Restauration dans un Postgres jetable"
docker run -d --name "$pg" -e POSTGRES_PASSWORD=restore -e POSTGRES_DB=restore postgres:16-alpine > /dev/null
# En TCP : pendant l'initialisation, Postgres n'écoute que sur la socket locale.
for _ in $(seq 1 30); do
  docker exec "$pg" pg_isready -q -h 127.0.0.1 -U postgres && break
  sleep 1
done
docker exec "$pg" pg_isready -q -h 127.0.0.1 -U postgres || die "le Postgres jetable ne démarre pas"
# --no-acl : les rôles de prod n'existent pas ici.
docker exec -i "$pg" pg_restore -U postgres -d restore --no-owner --no-acl --exit-on-error < "$tmp/backup.dump" \
  || die "pg_restore en échec"

q() { docker exec "$pg" psql -X -tA -v ON_ERROR_STOP=1 -U postgres -d restore -c "$1"; }

log "Contrôles"
for table in "${TABLES[@]}"; do
  [[ $(q "SELECT to_regclass('public.\"$table\"') IS NOT NULL") == t ]] || die "table absente : $table"
done
failed=$(q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL")
[[ $failed == 0 ]] || die "$failed migration(s) en échec dans la sauvegarde"
admins=$(q "SELECT count(*) FROM \"User\" WHERE role = 'ADMIN'")
(( admins >= 1 )) || die "aucun ADMIN dans la sauvegarde"
log "Sauvegarde valide : $(q 'SELECT count(*) FROM "Contract"') contrat(s), $(q 'SELECT count(*) FROM "Payment"') paiement(s)"

if [[ -n ${HEALTHCHECK_URL:-} ]]; then
  curl -fsS -m 10 --retry 3 -o /dev/null "$HEALTHCHECK_URL" || die "signal Healthchecks impossible"
fi
