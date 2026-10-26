#!/usr/bin/env bash
# Lance les vrais scripts de deploy/ sur une stack jetable (projet langestloc-repetition).
# Depuis le Mac : deploy/test/run-in-docker.sh. Les vérifications n'utilisent pas
# common.sh, pour qu'un bug du code testé ne cache pas un bug du test.
set -euo pipefail

repo=$(cd "$(dirname "$0")/../.." && pwd)
work=$(mktemp -d)
export LANGESTLOC_DIR="$work/stack"
export COMPOSE_PROJECT=langestloc-repetition
export SKIP_PULL=1
export HEALTH_TIMEOUT=30
export DB_WAIT_TIMEOUT=30
created_proxy=0

readonly IMAGE_REPO=ghcr.io/cheickla/langestloc-api
readonly TAG_A=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
readonly TAG_B=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
readonly TAG_C=cccccccccccccccccccccccccccccccccccccccc
readonly TAG_ABSENT=dddddddddddddddddddddddddddddddddddddddd
readonly S3_CONTAINER=langestloc-repetition-s3
s3_endpoint=

step() { printf '\n== %s\n' "$*"; }
ok() { printf '   ok : %s\n' "$*"; }
fail() {
  printf '   ÉCHEC : %s\n' "$*" >&2
  local logs=("$LANGESTLOC_DIR"/logs/deploy-*.log)
  if [[ -f ${logs[-1]} ]]; then
    printf -- '--- dernier journal de déploiement (%s) ---\n' "${logs[-1]}" >&2
    cat "${logs[-1]}" >&2
  fi
  exit 1
}

compose_t() { docker compose -p "$COMPOSE_PROJECT" -f "$LANGESTLOC_DIR/compose.prod.yml" "$@"; }
sql() {
  # shellcheck disable=SC2016
  compose_t exec -T db sh -c 'psql -X -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' psql "$1"
}

env_tag() { sed -n 's/^API_IMAGE_TAG=//p' "$LANGESTLOC_DIR/.env"; }
api_healthy() {
  local out
  out=$(compose_t exec -T api wget -q -T 5 -O- http://127.0.0.1:3000/health 2> /dev/null) && [[ $out == *'"status":"ok"'* ]]
}
api_image() { docker inspect --format '{{.Config.Image}}' "$(compose_t ps -q api)"; }
latest_backup() {
  local backups=("$LANGESTLOC_DIR"/backups/avant-*.dump)
  printf '%s\n' "${backups[-1]}"
}
latest_log() {
  local logs=("$LANGESTLOC_DIR"/logs/deploy-*.log)
  printf '%s\n' "${logs[-1]}"
}

cleanup() {
  local status=$?
  step "Nettoyage"
  if [[ -f $LANGESTLOC_DIR/compose.prod.yml ]]; then
    compose_t down -v --remove-orphans > /dev/null 2>&1 || true
  fi
  docker rm -fv "$S3_CONTAINER" > /dev/null 2>&1 || true
  local tag
  for tag in "$TAG_A" "$TAG_B" "$TAG_C"; do docker rmi "$IMAGE_REPO:$tag" > /dev/null 2>&1 || true; done
  if (( created_proxy )); then docker network rm proxy > /dev/null 2>&1 || true; fi
  rm -rf "$work"
  if (( status == 0 )); then echo "Répétition réussie"; else echo "Répétition en échec" >&2; fi
}
trap cleanup EXIT

setup_stack() {
  step "Préparation de la stack jetable ($COMPOSE_PROJECT)"
  if ! docker network inspect proxy > /dev/null 2>&1; then
    docker network create proxy > /dev/null
    created_proxy=1
  fi
  mkdir -p "$LANGESTLOC_DIR"
  cp "$repo/deploy/compose.prod.yml" "$LANGESTLOC_DIR/"
  # Le .env laissé par le premier déploiement manuel
  cat > "$LANGESTLOC_DIR/.env" <<EOF
API_IMAGE_TAG=$TAG_A
POSTGRES_USER=repetition
POSTGRES_PASSWORD=repetition
POSTGRES_DB=langestloc
JWT_SECRET=repetition-jwt-secret
JWT_EXPIRES_IN=1h
S3_ENDPOINT=http://127.0.0.1:9
S3_REGION=eu-west-3
S3_BUCKET=repetition
S3_ACCESS_KEY=repetition
S3_SECRET_KEY=repetition
BAILLEUR_NAME=Répétition
BAILLEUR_LIEU=Conakry
BAILLEUR_REP=
EOF
  chmod 600 "$LANGESTLOC_DIR/.env"
  compose_t up -d --wait db > /dev/null
  ok "base démarrée"
}

stage_files() {
  mkdir -p "$LANGESTLOC_DIR/incoming"
  cp "$repo/deploy/compose.prod.yml" "$repo"/deploy/*.sh "$LANGESTLOC_DIR/incoming/"
}

# Fait comme le job du CI et renvoie le code de deploy.sh.
ship() {
  stage_files
  bash "$LANGESTLOC_DIR/incoming/deploy.sh" "$1" repetition < /dev/null
}

# Comme ship, avec un autre compose.prod.yml ($2).
ship_with_compose() {
  stage_files
  cp "$2" "$LANGESTLOC_DIR/incoming/compose.prod.yml"
  bash "$LANGESTLOC_DIR/incoming/deploy.sh" "$1" repetition < /dev/null
}

test_restore_db() {
  step "restore-db.sh : remplace tout le schéma, ou rien"
  local good="$work/avant.dump" bad="$work/tronquee.dump"
  sql 'CREATE TABLE "Marqueur" (id INT PRIMARY KEY); INSERT INTO "Marqueur" VALUES (1);' > /dev/null
  # shellcheck disable=SC2016
  compose_t exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$good"
  head -c 200 "$good" > "$bad"
  # Ce qu'une migration ratée aurait ajouté après la sauvegarde
  sql "CREATE TYPE \"EtatIntrus\" AS ENUM ('X'); CREATE TABLE \"Intrus\" (id INT); ALTER TABLE \"Marqueur\" ADD COLUMN ajout INT;" > /dev/null

  if bash "$LANGESTLOC_DIR/incoming/restore-db.sh" "$bad"; then fail "une sauvegarde tronquée a été acceptée"; fi
  [[ $(sql "SELECT to_regclass('public.\"Intrus\"') IS NOT NULL") == t ]] || fail "la base a changé malgré l'échec"
  ok "sauvegarde tronquée refusée, base intacte"

  bash "$LANGESTLOC_DIR/incoming/restore-db.sh" "$good" || fail "restauration en échec"
  [[ $(sql "SELECT to_regclass('public.\"Intrus\"') IS NULL") == t ]] || fail "la table créée après la sauvegarde est restée"
  [[ $(sql "SELECT count(*) FROM pg_type WHERE typname = 'EtatIntrus'") == 0 ]] || fail "le type créé après la sauvegarde est resté"
  [[ $(sql "SELECT count(*) FROM information_schema.columns WHERE table_name = 'Marqueur' AND column_name = 'ajout'") == 0 ]] \
    || fail "la colonne ajoutée après la sauvegarde est restée"
  [[ $(sql 'SELECT count(*) FROM "Marqueur"') == 1 ]] || fail "les données de la sauvegarde manquent"
  ok "schéma et données revenus à l'état de la sauvegarde"
  sql 'DROP TABLE "Marqueur";' > /dev/null
}

build_image_a() {
  step "Construction de l'image A (backend/Dockerfile)"
  docker build -q -t "$IMAGE_REPO:$TAG_A" "$repo/backend" > /dev/null
  ok "image A construite"
}

# Image B : A + une migration factice + un démarrage qui échoue
build_image_b() {
  docker build -q -t "$IMAGE_REPO:$TAG_B" - > /dev/null <<EOF
FROM $IMAGE_REPO:$TAG_A
USER root
RUN mkdir -p prisma/migrations/99990101000000_repetition_casse \\
 && printf '%s\n' 'CREATE TABLE "RepetitionCasse" (id INT);' 'ALTER TABLE "User" ADD COLUMN "repetition" INT;' \\
    > prisma/migrations/99990101000000_repetition_casse/migration.sql
USER node
CMD ["sh", "-c", "echo 'version cassée volontairement' >&2; exit 1"]
EOF
}

scenario_1() {
  step "Scénario 1 : premier déploiement (A), migrations comprises"
  ship "$TAG_A" || fail "le déploiement de A a échoué"
  [[ $(env_tag) == "$TAG_A" ]] || fail ".env ne pointe pas sur A"
  api_healthy || fail "/health ne répond pas"
  [[ $(sql "SELECT count(*) FROM _prisma_migrations") -gt 0 ]] || fail "aucune migration appliquée"
  [[ $(sql "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL") == 0 ]] || fail "migration inachevée"
  local backup
  backup=$(latest_backup)
  [[ -f $backup ]] || fail "pas de sauvegarde de déploiement"
  [[ $(stat -c %a "$backup") == 600 ]] || fail "sauvegarde lisible par d'autres ($(stat -c %a "$backup"))"
  [[ $(stat -c %a "$LANGESTLOC_DIR/.env") == 600 ]] || fail ".env n'est plus en 600"
  local refus
  if refus=$(bash "$LANGESTLOC_DIR/restore-db.sh" "$backup" 2>&1); then
    fail "restore-db.sh a accepté de tourner avec l'API démarrée"
  fi
  [[ $refus == *"l'API tourne"* ]] || fail "refus inattendu de restore-db.sh : $refus"
  sql "INSERT INTO \"Local\" (code, name) VALUES ('REPETITION', 'Marqueur de la répétition')" > /dev/null
  ok "A en ligne, migrations appliquées, sauvegarde en 600, marqueur inséré"
}

test_log_rotation() {
  step "Logs Docker de l'API et de la base limités en taille"
  local service config
  for service in api db; do
    config=$(docker inspect --format '{{.HostConfig.LogConfig.Type}} {{index .HostConfig.LogConfig.Config "max-size"}} {{index .HostConfig.LogConfig.Config "max-file"}}' "$(compose_t ps -q "$service")")
    [[ $config == 'json-file 10m 5' ]] || fail "logs de $service sans rotation ($config)"
  done
  ok "json-file, 5 fichiers de 10 Mo au plus"
}

test_graceful_stop() {
  step "Arrêt de l'API : elle s'arrête d'elle-même au SIGTERM, sans SIGKILL"
  local id
  id=$(compose_t ps -q api)
  compose_t stop api > /dev/null 2>&1
  local code
  code=$(docker inspect --format '{{.State.ExitCode}}' "$id")
  [[ $code == 0 ]] || fail "code de sortie $code (137 : tuée par Docker au bout de 10 s)"
  compose_t up -d --wait api > /dev/null 2>&1 || fail "l'API ne redémarre pas"
  ok "sortie 0, API redémarrée"
}

scenario_2() {
  step "Scénario 2 : version cassée avec migration (B), retour arrière et restauration"
  build_image_b
  local status=0
  ship "$TAG_B" || status=$?
  (( status == 1 )) || fail "code de sortie $status au lieu de 1 (retour arrière réussi)"
  [[ $(env_tag) == "$TAG_A" ]] || fail ".env ne pointe plus sur A"
  api_healthy || fail "/health ne répond pas après le retour arrière"
  [[ $(sql "SELECT count(*) FROM _prisma_migrations WHERE migration_name LIKE '%repetition_casse'") == 0 ]] \
    || fail "la migration factice est restée enregistrée"
  [[ $(sql "SELECT to_regclass('public.\"RepetitionCasse\"') IS NULL") == t ]] || fail "la table de la migration factice est restée"
  [[ $(sql "SELECT count(*) FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'repetition'") == 0 ]] \
    || fail "la colonne de la migration factice est restée"
  [[ $(sql "SELECT count(*) FROM \"Local\" WHERE code = 'REPETITION'") == 1 ]] || fail "le marqueur a disparu"
  grep -q "Base restaurée" "$(latest_log)" || fail "le journal ne montre pas la restauration de la base"
  grep -q "Retour arrière terminé" "$(latest_log)" || fail "le journal ne montre pas la fin du retour arrière"
  ok "retour sur A, base restaurée, marqueur présent"
}

test_backup_failure() {
  step "Sauvegarde impossible avec une migration en attente : l'API repart sur A"
  mv "$LANGESTLOC_DIR/backups" "$work/backups.sauve"
  # Personne, même root, ne peut créer de fichier dans /proc/1.
  ln -s /proc/1 "$LANGESTLOC_DIR/backups"
  local status=0
  ship "$TAG_B" > /dev/null || status=$?
  rm "$LANGESTLOC_DIR/backups"
  mv "$work/backups.sauve" "$LANGESTLOC_DIR/backups"
  (( status == 1 )) || fail "code de sortie $status au lieu de 1"
  [[ $(env_tag) == "$TAG_A" ]] || fail ".env a changé"
  api_healthy || fail "l'API n'a pas redémarré"
  [[ $(sql "SELECT count(*) FROM _prisma_migrations WHERE migration_name LIKE '%repetition_casse'") == 0 ]] \
    || fail "la migration a été appliquée sans sauvegarde"
  grep -q "Arrêt de l'API" "$(latest_log)" || fail "le journal ne montre pas l'arrêt de l'API avant la sauvegarde"
  grep -q "ÉCHEC : sauvegarde impossible" "$(latest_log)" || fail "le journal ne montre pas l'échec de la sauvegarde"
  ok "migration non appliquée, l'API tourne de nouveau sur A"
}

scenario_3() {
  step "Scénario 3 : redéploiement sans migration (C), sortie fermée comme une connexion SSH coupée"
  docker tag "$IMAGE_REPO:$TAG_A" "$IMAGE_REPO:$TAG_C"
  local status
  # | true ferme la sortie tout de suite, comme une connexion SSH coupée.
  set +e
  ship "$TAG_C" | true
  status=${PIPESTATUS[0]}
  set -e
  (( status == 0 )) || fail "le déploiement de C a échoué (code $status)"
  [[ $(env_tag) == "$TAG_C" ]] || fail ".env ne pointe pas sur C"
  api_healthy || fail "/health ne répond pas"
  [[ $(api_image) == "$IMAGE_REPO:$TAG_C" ]] || fail "l'API ne tourne pas sur C"
  [[ $(sql "SELECT count(*) FROM \"Local\" WHERE code = 'REPETITION'") == 1 ]] || fail "le marqueur a disparu"
  grep -q "Aucune migration à appliquer" "$(latest_log)" || fail "le journal ne confirme pas l'absence de migration"
  ok "C en ligne sans migration, malgré la sortie fermée"
}

test_lock() {
  step "Verrou : un déploiement attend la fin du précédent"
  # On vérifie l'ordre, pas la durée : rien dans le journal tant que le verrou est pris.
  local acquired="$work/verrou-acquis" before holder waiter new_log now
  rm -f "$acquired"
  flock "$LANGESTLOC_DIR/.deploy.lock" sh -c "touch '$acquired'; sleep 6" &
  holder=$!
  while [[ ! -f $acquired ]]; do sleep 0.2; done

  before=$(latest_log)
  ship "$TAG_C" > /dev/null &
  waiter=$!

  new_log=
  while [[ -z $new_log ]]; do
    now=$(latest_log)
    [[ $now != "$before" ]] && new_log=$now
    sleep 0.2
  done

  while kill -0 "$holder" 2> /dev/null; do
    grep -q "Déploiement de" "$new_log" 2> /dev/null \
      && fail "le déploiement en attente a démarré avant la fin du verrou"
    sleep 0.2
  done
  wait "$holder"
  wait "$waiter" || fail "le déploiement en attente a échoué"
  grep -q "Déploiement de" "$new_log" || fail "le journal ne montre pas que le déploiement a démarré"
  ok "attente du verrou (preuve par l'ordre), puis déploiement"
}

test_invalid_env_tag() {
  step ".env sans API_IMAGE_TAG valide : arrêt avant toute modification"
  cp "$LANGESTLOC_DIR/.env" "$work/env.sauve"
  sed -i 's/^API_IMAGE_TAG=.*/API_IMAGE_TAG=latest/' "$LANGESTLOC_DIR/.env"
  local status=0
  # C existe : sans la vérification, ce déploiement réussirait.
  ship "$TAG_C" > /dev/null || status=$?
  [[ $(env_tag) == latest ]] || fail ".env a été modifié avant la vérification de l'ancienne version"
  cp "$work/env.sauve" "$LANGESTLOC_DIR/.env"
  (( status == 1 )) || fail "code de sortie $status au lieu de 1"
  api_healthy || fail "l'API ne répond plus"
  [[ $(api_image) == "$IMAGE_REPO:$TAG_C" ]] || fail "l'API a changé de version"
  ok "arrêt immédiat, l'API tourne toujours sur C"
}

test_db_start_failure() {
  step "compose.prod.yml cassé : db ne redémarre plus, abort() la relève depuis les anciens fichiers"
  local broken="$work/compose-db-cassee.yml" before_compose status=0 deadline
  sed '/^  db:$/a\    command: ["postgres", "-c", "parametre_inexistant=1"]' \
    "$repo/deploy/compose.prod.yml" > "$broken"
  grep -q parametre_inexistant "$broken" || fail "compose.prod.yml cassé mal construit (sed n'a rien inséré)"
  before_compose=$(cat "$LANGESTLOC_DIR/compose.prod.yml")

  ship_with_compose "$TAG_C" "$broken" > /dev/null || status=$?
  (( status == 1 )) || fail "code de sortie $status au lieu de 1"
  grep -q "la base ne démarre pas" "$(latest_log)" || fail "le journal ne montre pas l'échec de la base"
  [[ $(cat "$LANGESTLOC_DIR/compose.prod.yml") == "$before_compose" ]] \
    || fail "compose.prod.yml cassé est resté installé (anciens fichiers non remis en place)"
  [[ $(env_tag) == "$TAG_C" ]] || fail ".env a changé"

  deadline=$((SECONDS + HEALTH_TIMEOUT))
  until api_healthy; do
    (( SECONDS < deadline )) || fail "/health ne répond plus après l'échec de db (Prisma n'a pas reconnecté)"
    sleep 2
  done
  [[ $(docker inspect --format '{{.State.Health.Status}}' "$(compose_t ps -q db)") == healthy ]] \
    || fail "db n'est pas revenue en bonne santé"
  [[ $(sql "SELECT count(*) FROM \"Local\" WHERE code = 'REPETITION'") == 1 ]] || fail "le marqueur a disparu"
  ok "db relevée depuis les anciens fichiers, l'API répond de nouveau, marqueur et .env intacts"
}

scenario_4() {
  step "Scénario 4 : image absente, échec avant toute modification"
  local status=0
  ship "$TAG_ABSENT" || status=$?
  (( status == 1 )) || fail "code de sortie $status au lieu de 1"
  [[ $(env_tag) == "$TAG_C" ]] || fail ".env a changé"
  api_healthy || fail "l'API ne répond plus"
  [[ $(api_image) == "$IMAGE_REPO:$TAG_C" ]] || fail "l'API a changé de version"
  ok "échec propre : .env inchangé, l'API tourne toujours sur C"
}

aws_t() {
  docker run --rm --network proxy \
    -e AWS_ACCESS_KEY_ID=repetition -e AWS_SECRET_ACCESS_KEY=repetition-secret \
    -e AWS_DEFAULT_REGION=eu-west-3 -e AWS_ENDPOINT_URL="$s3_endpoint" \
    amazon/aws-cli:2.37.4 "$@"
}

start_s3() {
  docker run -d --name "$S3_CONTAINER" --network proxy \
    -e RUSTFS_ACCESS_KEY=repetition -e RUSTFS_SECRET_KEY=repetition-secret \
    rustfs/rustfs:1.0.0 > /dev/null
  # Une IP : avec un nom, le client AWS viserait bucket.nom:9000, qui n'existe pas.
  s3_endpoint="http://$(docker inspect -f '{{(index .NetworkSettings.Networks "proxy").IPAddress}}' "$S3_CONTAINER"):9000"
  local _
  for _ in $(seq 1 30); do
    if docker exec "$S3_CONTAINER" curl -sf -o /dev/null http://localhost:9000/health/ready; then
      aws_t s3 mb s3://repetition-sauvegardes > /dev/null
      ok "S3 local prêt"
      return 0
    fi
    sleep 2
  done
  fail "le S3 local n'a pas démarré"
}

scenario_5() {
  step "Scénario 5 : sauvegarde quotidienne, puis test de restauration (S3 local)"
  start_s3
  age-keygen -o "$work/age.key" 2> /dev/null
  age-keygen -o "$work/autre.key" 2> /dev/null
  sql "INSERT INTO \"User\" (name, email, password, role) VALUES ('Répétition', 'admin@repetition.local', 'x', 'ADMIN')" > /dev/null
  cat > "$LANGESTLOC_DIR/backup.env" <<EOF
BACKUP_BUCKET=repetition-sauvegardes
AWS_ACCESS_KEY_ID=repetition
AWS_SECRET_ACCESS_KEY=repetition-secret
AWS_DEFAULT_REGION=eu-west-3
AWS_ENDPOINT_URL=$s3_endpoint
AGE_RECIPIENT=$(age-keygen -y "$work/age.key")
HEALTHCHECK_URL=
EOF

  bash "$LANGESTLOC_DIR/backup.sh" || fail "backup.sh a échoué"
  local key
  key=$(aws_t s3 ls s3://repetition-sauvegardes/daily/ | awk '{print $4}')
  [[ $key =~ ^langestloc-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}Z\.dump\.age$ ]] \
    || fail "sauvegarde absente ou mal nommée : « $key »"
  [[ $(aws_t s3 cp "s3://repetition-sauvegardes/daily/$key" - | head -c 21) == age-encryption.org/v1 ]] \
    || fail "la sauvegarde déposée n'est pas chiffrée"
  ok "sauvegarde chiffrée déposée : $key"

  local check=(env BACKUP_BUCKET=repetition-sauvegardes AWS_ACCESS_KEY_ID=repetition
    AWS_SECRET_ACCESS_KEY=repetition-secret AWS_ENDPOINT_URL="$s3_endpoint" S3_DOCKER_NETWORK=proxy)
  "${check[@]}" AGE_SECRET_KEY="$(cat "$work/age.key")" bash "$repo/deploy/restore-check.sh" \
    || fail "restore-check.sh a échoué"
  ok "sauvegarde retrouvée, restaurée et contrôlée"

  local out
  if out=$("${check[@]}" AGE_SECRET_KEY="$(cat "$work/autre.key")" bash "$repo/deploy/restore-check.sh" 2>&1); then
    fail "une sauvegarde a été acceptée avec la mauvaise clé"
  fi
  [[ $out == *"déchiffrement impossible"* ]] || fail "message inattendu (mauvaise clé) : $out"
  ok "mauvaise clé refusée"

  if out=$("${check[@]}" AGE_SECRET_KEY="$(cat "$work/age.key")" MAX_AGE_HOURS=0 bash "$repo/deploy/restore-check.sh" 2>&1); then
    fail "une sauvegarde trop ancienne a été acceptée"
  fi
  [[ $out == *"trop ancienne"* ]] || fail "message inattendu (trop ancienne) : $out"
  ok "sauvegarde trop ancienne refusée"
}

main() {
  step "shellcheck"
  (cd "$repo" && shellcheck -x deploy/*.sh deploy/test/*.sh)
  ok "scripts sans avertissement"
  setup_stack
  stage_files
  test_restore_db
  build_image_a
  scenario_1
  test_log_rotation
  test_graceful_stop
  scenario_2
  test_backup_failure
  scenario_3
  test_lock
  test_invalid_env_tag
  test_db_start_failure
  scenario_4
  scenario_5
}

main
