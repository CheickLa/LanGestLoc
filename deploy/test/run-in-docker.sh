#!/usr/bin/env bash
# Lance la répétition depuis le Mac (ni flock ni bash 4) dans un conteneur Ubuntu qui
# pilote le Docker local. Docker Desktop doit tourner. Le nettoyage de deploy.sh supprime
# au passage les images locales ghcr.io/cheickla/langestloc-api:* (elles se retéléchargent).
set -euo pipefail

repo=$(cd "$(dirname "$0")/../.." && pwd)
docker build -q -t langestloc-repetition-runner "$repo/deploy/test" > /dev/null
exec docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$repo:/repo:ro" -w /repo \
  langestloc-repetition-runner bash deploy/test/rehearse.sh
