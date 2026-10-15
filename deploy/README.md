# Déploiement de LanGestLoc

L'API tourne sur le VPS OVH (`https://api.langestloc.cheickla.fr`), en Docker
Compose derrière le Caddy de [CheickLa/vps](https://github.com/CheickLa/vps).
Ses fichiers sont dans `/opt/langestloc`. Le front est sur Vercel
(`https://langestloc.cheickla.fr`).

Dans les commandes, `<user>` est l'utilisateur SSH (`ubuntu`) et `<ip>` l'IP du
VPS.

## Déployer

Il suffit de merger sur `main`. Le CI teste et publie l'image sur GHCR, puis le
job « Déploiement API (VPS) » lance `deploy.sh` sur le serveur par SSH. Vercel
met le front en ligne quand ce job est vert.

`deploy.sh` sauvegarde la base dans `backups/` (il garde les 10 dernières),
applique les migrations, démarre la nouvelle version et attend `/health`. S'il
échoue, il remet l'ancienne version, et la base si une migration est passée.

L'API change une à deux minutes avant le front. Un changement d'API qui
casserait le front en ligne doit donc se faire en deux merges. Chaque
déploiement coupe l'API quelques secondes, une trentaine de plus s'il y a une
migration.

Le journal s'affiche à la fin de l'étape « Déployer sur le VPS », et le serveur
garde les 30 derniers dans `logs/`. Quand le job est rouge, il indique ce qui
s'est passé :

| Journal | Situation |
|---|---|
| `ERREUR : …` | Le script s'est arrêté avant de toucher à quoi que ce soit. |
| `ÉCHEC : … La base n'a pas été modifiée.` | L'ancienne version tourne toujours. |
| `Retour arrière terminé` | L'ancienne version tourne de nouveau, avec la base restaurée si besoin. Corriger, puis merger à nouveau. |
| `RETOUR ARRIÈRE ÉCHOUÉ` | Il faut intervenir à la main : voir « Revenir en arrière ». |
| `Déploiement réussi`, mais « Vérifier l'API depuis Internet » échoue | La nouvelle version reste en place et le front ne part pas. |
| Aucun journal | La connexion SSH a coupé ou le job a expiré. `deploy.sh` continue sur le serveur : son issue est dans le dernier fichier de `logs/`. |

Pour redéployer la même version, relancer seulement le job « Déploiement API
(VPS) » du dernier run. « Re-run all jobs » reconstruirait l'image sous le même
SHA.

Pour mettre un front en ligne sans attendre les checks : Vercel → Deployments →
la version → Promote.

Après une modification de `deploy/`, lancer la répétition sur le Mac avec
`deploy/test/run-in-docker.sh` (Docker Desktop démarré). Sur une PR, le
workflow « Répétition du déploiement » la lance tout seul.

Si un job du CI change de nom, mettre à jour les Deployment Checks de Vercel et
le ruleset GitHub.

## Sauvegardes

| Quoi | Quand | Où | Durée |
|---|---|---|---|
| Sauvegarde de déploiement | avant chaque déploiement | `backups/avant-*.dump` sur le serveur, en clair | les 10 dernières |
| Sauvegarde quotidienne | 03:00 UTC | `s3://langestloc-backups-cheickla/daily/`, chiffrée avec age | 30 jours, puis 30 jours en ancienne version |
| Test de restauration | le lundi à 05:00 UTC | GitHub Actions, dans une base jetable | la base est supprimée à la fin |

Le serveur chiffre avec la clé publique age, il ne peut donc pas relire ses
sauvegardes. La clé privée est dans le gestionnaire de mots de passe
(« LanGestLoc, clé des sauvegardes ») et dans le secret GitHub
`AGE_SECRET_KEY`, nulle part ailleurs. Si elle est perdue aux deux endroits,
les sauvegardes deviennent illisibles.

Healthchecks.io prévient par e-mail si la sauvegarde quotidienne n'arrive pas
ou si le test ne tourne plus. Le test échoue aussi quand la dernière sauvegarde
a plus de 26 h, et GitHub envoie alors un e-mail.

Pour lancer une sauvegarde tout de suite, sur le serveur :

```bash
sudo systemctl start langestloc-backup.service
sudo journalctl -u langestloc-backup -n 20 --no-pager   # « Sauvegarde envoyée : … »
```

Pour lancer le test : GitHub → Actions → Test de restauration → Run workflow.

Avant d'intervenir à la main sur la base, faire une sauvegarde et ne continuer
que si « Sauvegarde vérifiée » s'affiche :

```bash
cd /opt/langestloc
DUMP=~/langestloc-$(date +%F-%H%M).dump
docker compose -f compose.prod.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DUMP" \
  && docker compose -f compose.prod.yml exec -T db pg_restore --list < "$DUMP" > /dev/null \
  && echo "Sauvegarde vérifiée : $DUMP"
```

## Revenir en arrière

Cette section sert quand le retour automatique a échoué, ou pour quitter une
version qui démarre mais se comporte mal. Il faut aussi annuler le commit sur
`main` (`git revert` + PR), sinon le prochain merge le redéploie.

Le serveur garde l'image en place et la précédente
(`docker images ghcr.io/cheickla/langestloc-api`). Les journaux de `logs/`
donnent les versions et le nom de chaque sauvegarde, et `previous/` contient
les fichiers de déploiement d'avant le dernier déploiement.

S'il n'y a pas eu de migration :

```bash
cd /opt/langestloc
cp -p previous/* .                          # anciens fichiers de déploiement
nano .env                                   # ancien API_IMAGE_TAG
docker compose -f compose.prod.yml up -d api
curl https://api.langestloc.cheickla.fr/health
```

S'il y a eu une migration, il faut restaurer la sauvegarde prise juste avant,
et ce qui a été écrit depuis est perdu. `restore-db.sh` fait tout en une seule
transaction : s'il échoue, la base ne bouge pas.

```bash
cd /opt/langestloc
docker compose -f compose.prod.yml stop api
bash restore-db.sh backups/avant-AAAAMMJJ-HHMMSS-<sha>.dump
cp -p previous/* .
nano .env                                   # ancien API_IMAGE_TAG
docker compose -f compose.prod.yml up -d api
curl https://api.langestloc.cheickla.fr/health
```

## Reconstruire depuis une sauvegarde S3

Si le serveur est perdu ou la base détruite, on repart de la dernière
sauvegarde quotidienne. Il ne faut pas créer de nouveau bucket pour les PDF, ni
tester avec un faux contrat ou paiement : sur une base vide, les numéros
repartent à 1 et les nouveaux PDF écraseraient les vrais dans le bucket
(`receipts/<année>/REC-<année>-00001.pdf`, `contracts/1/BAIL-<année>-00001.pdf`).
La base restaurée a déjà ses ADMIN, `create-admin` ne sert donc pas.

1. Installer le nouveau serveur avec le README de
   [CheickLa/vps](https://github.com/CheickLa/vps) (Docker, réseau `proxy`,
   Caddy), puis faire pointer chez OVH l'enregistrement A `api.langestloc` sur
   sa nouvelle IP.
2. Depuis le Mac, à la racine du repo, créer le dossier et y copier les
   fichiers :

   ```bash
   ssh <user>@<ip> 'sudo mkdir -p /opt/langestloc && sudo chown "$USER": /opt/langestloc'
   scp deploy/compose.prod.yml deploy/.env.example deploy/common.sh deploy/restore-db.sh \
     deploy/backup.sh <user>@<ip>:/opt/langestloc/
   ```

3. Sur le serveur, créer `.env` et le remplir :

   ```bash
   cd /opt/langestloc
   mv .env.example .env && chmod 600 .env
   openssl rand -hex 32      # POSTGRES_PASSWORD
   openssl rand -base64 48   # JWT_SECRET
   nano .env
   ```

   `API_IMAGE_TAG` prend le SHA du dernier run CI de `main` dont le job
   « Déploiement API (VPS) » est vert. Les clés S3 sont celles de
   l'utilisateur IAM `langestloc-api` ; si elles sont perdues, lui en créer une
   nouvelle dans IAM. L'image est privée : pour la télécharger à la main, créer
   un token GitHub classic avec la seule permission `read:packages`, puis
   lancer `docker login ghcr.io -u CheickLa`.
4. Télécharger la sauvegarde depuis la console S3
   (`langestloc-backups-cheickla` → `daily/`). Au-delà de 30 jours, elle
   n'apparaît qu'en activant « Afficher les versions ». La déchiffrer ensuite
   sur le Mac, dans son dossier :

   ```bash
   nano cle.txt      # les trois lignes de la clé age
   docker run --rm -v "$PWD:/w" -w /w alpine:3.24 \
     sh -c 'apk add -q age && age -d -i cle.txt -o base.dump langestloc-XXXX.dump.age'
   rm cle.txt
   scp base.dump <user>@<ip>:~/
   ```

   Sur le serveur, `chmod 600 ~/base.dump`. Le fichier ne doit pas aller dans
   `/tmp`, que tout le monde peut lire.
5. Sur le serveur, restaurer et démarrer :

   ```bash
   cd /opt/langestloc
   docker compose -f compose.prod.yml pull
   docker compose -f compose.prod.yml up -d --wait db
   bash restore-db.sh ~/base.dump      # doit finir par « Base restaurée »
   docker compose -f compose.prod.yml run --rm api npx prisma migrate deploy
   docker compose -f compose.prod.yml up -d api
   curl https://api.langestloc.cheickla.fr/health
   rm ~/base.dump
   ```

   Si `restore-db.sh` ne finit pas par « Base restaurée », la base est restée
   vide et `~/base.dump` est intact : lire l'erreur, corriger, relancer. À la
   fin, `https://api.langestloc.cheickla.fr/api-json` doit répondre 404 et
   `nc -zv -w 5 <ip> 5432` doit échouer depuis le Mac. Supprimer ensuite
   `base.dump` sur le Mac.
6. Refaire la clé de déploiement et la sauvegarde quotidienne (voir « Mise en
   place »). `langestloc-backup-writer` a besoin d'une nouvelle clé d'accès,
   l'ancienne était dans le `backup.env` perdu. Après le premier déploiement
   automatique réussi, supprimer le token `read:packages` sur GitHub.

## Mise en place

Tout ceci est déjà en place. Il ne faut le refaire que sur un nouveau serveur.

### Clé de déploiement

Sur le Mac :

```bash
ssh-keygen -t ed25519 -N '' -C github-deploy-langestloc -f ~/.ssh/langestloc_deploy
echo "restrict $(cat ~/.ssh/langestloc_deploy.pub)" | ssh <user>@<ip> 'cat >> ~/.ssh/authorized_keys'
ssh-keyscan -t ed25519 <ip> 2> /dev/null | tee /tmp/langestloc_known_hosts | ssh-keygen -lf -
```

Sur le serveur, `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` doit
afficher la même empreinte. Si ce n'est pas le cas, ce n'est pas le bon
serveur : s'arrêter.

Dans GitHub, l'environnement `vps` est limité à `main`. Il contient le secret
`SSH_PRIVATE_KEY` (`pbcopy < ~/.ssh/langestloc_deploy`, puis coller) et les
variables `SSH_HOST`, `SSH_USER` et `SSH_KNOWN_HOSTS`
(`pbcopy < /tmp/langestloc_known_hosts`).

Supprimer ensuite la clé privée du Mac avec
`rm ~/.ssh/langestloc_deploy /tmp/langestloc_known_hosts` : seul GitHub la
garde. Cette clé donne en pratique tous les droits sur le VPS, puisque `<user>`
est dans le groupe `docker`.

### Sauvegarde quotidienne

Depuis le Mac :

```bash
scp deploy/backup.env.example deploy/systemd/langestloc-backup.service \
  deploy/systemd/langestloc-backup.timer <user>@<ip>:/tmp/
```

Sur le serveur :

```bash
sudo apt update && sudo apt install -y age
cd /opt/langestloc
install -m 600 /tmp/backup.env.example backup.env
nano backup.env
sudo install -m 644 /tmp/langestloc-backup.service /tmp/langestloc-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now langestloc-backup.timer
sudo systemctl start langestloc-backup.service
sudo journalctl -u langestloc-backup -n 20 --no-pager
rm /tmp/backup.env.example /tmp/langestloc-backup.service /tmp/langestloc-backup.timer
```

`backup.env` contient les clés de `langestloc-backup-writer`, la clé publique
`age1…` et l'adresse Healthchecks de « Sauvegarde quotidienne ». La clé privée
age ne va jamais sur le serveur. Le service tourne sous `ubuntu` (ligne
`User=`) : si `<user>` est un autre compte, changer cette ligne avant de copier
le fichier.

### AWS, GitHub, Healthchecks et Vercel

Sur AWS, l'utilisateur IAM `langestloc-api` a `s3:ListBucket` sur le bucket des
PDF, et `s3:GetObject` et `s3:PutObject` sur ses objets. Le bucket
`langestloc-backups-cheickla` (eu-west-3) a l'historique des versions activé.
Sur `daily/`, ses règles de cycle de vie font expirer les versions courantes et
les anciennes au bout de 30 jours, et nettoient les marqueurs de suppression
expirés. `langestloc-backup-writer` n'a que `s3:PutObject` sur `daily/*` ;
`langestloc-backup-reader` a `s3:ListBucket` sur le bucket et `s3:GetObject`
sur `daily/*`.

Sur GitHub, l'environnement `sauvegardes` est limité à `main`. Il contient les
secrets `AGE_SECRET_KEY`, `BACKUP_READER_ACCESS_KEY_ID`,
`BACKUP_READER_SECRET_ACCESS_KEY` et `HEALTHCHECK_RESTORE_URL`, et la variable
`BACKUP_BUCKET`. Un espace en trop à la fin d'une clé AWS fait échouer le test
avec `SignatureDoesNotMatch`.

Healthchecks.io a deux contrôles : « Sauvegarde quotidienne » (période 1 jour,
marge 1 h) et « Test de restauration » (7 jours, marge 1 jour).

Sur Vercel, le projet a `frontend` comme Root Directory, la variable de
Production `BACKEND_URL=https://api.langestloc.cheickla.fr` et le domaine
`langestloc.cheickla.fr`. Ses Deployment Checks portent sur les 5 jobs du CI,
en Blocking, et l'attribution automatique des domaines de production est
active.

Le premier ADMIN d'une base neuve se crée avec
`docker compose -f compose.prod.yml run --rm api node dist/src/cli/create-admin.js`.

## Limite connue

La connexion est limitée à 5 tentatives par minute et par adresse e-mail,
quelle que soit l'IP, car en production toutes les requêtes arrivent du BFF
Vercel. Quelqu'un qui connaît l'e-mail d'un compte peut donc bloquer sa
connexion en insistant. Les sessions déjà ouvertes (24 h) continuent de
marcher.
