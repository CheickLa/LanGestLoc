# Déploiement de LanGestLoc

- API : `https://api.langestloc.cheickla.fr` (VPS OVH, derrière le Caddy partagé)
- Application : `https://langestloc.cheickla.fr` (Vercel)

Les sections 1 à 6 décrivent le premier déploiement, fait à la main une seule
fois. La section 7 met en place le déploiement automatique et les
sauvegardes, une fois aussi. Ensuite, chaque merge sur `main` met à jour l'API
puis le front (section 8), et une sauvegarde chiffrée part chaque jour sur S3
(section 9).

Pour reconstruire un serveur perdu, ne pas refaire les sections 1 à 6 : suivre
« Depuis une sauvegarde quotidienne », dans *Revenir en arrière*.

## Prérequis

- Le serveur est installé avec le README de
  [CheickLa/vps](https://github.com/CheickLa/vps) : Docker, réseau `proxy`,
  Caddy démarré avec le bloc `api.langestloc.cheickla.fr`.
- L'enregistrement DNS A `api.langestloc` → IP du VPS existe chez OVH (zone
  `cheickla.fr`).

Dans les commandes, `<user>` est l'utilisateur SSH (`ubuntu` chez OVH) et
`<ip-du-vps>` l'IP publique du serveur.

## 1. AWS : bucket et accès limité

1. Créer un bucket S3 en `eu-west-3` (Paris), accès public bloqué (c'est le
   réglage par défaut).
2. Créer un utilisateur IAM sans accès console, avec cette politique
   (remplacer `NOM-DU-BUCKET`) :

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::NOM-DU-BUCKET"
       },
       {
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject"],
         "Resource": "arn:aws:s3:::NOM-DU-BUCKET/*"
       }
     ]
   }
   ```

3. Lui créer une clé d'accès, pour `S3_ACCESS_KEY` et `S3_SECRET_KEY`.

## 2. GitHub : publier l'image

1. Merger la branche dans `main`. Le job « Image Docker » construit l'image,
   la vérifie et la publie sur `ghcr.io/cheickla/langestloc-api:<SHA>`.
2. Une fois le job vert, noter le SHA complet du commit
   (`git rev-parse origin/main`).
3. Créer un token GitHub classic avec la seule permission `read:packages`
   (Settings → Developer settings → Personal access tokens). Le serveur s'en
   sert pour télécharger l'image, privée comme le repo.

## 3. Serveur : fichiers et secrets

Depuis le Mac, à la racine du repo :

```bash
ssh <user>@<ip-du-vps> 'sudo mkdir -p /opt/langestloc && sudo chown "$USER": /opt/langestloc'
scp deploy/compose.prod.yml deploy/.env.example <user>@<ip-du-vps>:/opt/langestloc/
```

Sur le serveur :

```bash
cd /opt/langestloc
mv .env.example .env
chmod 600 .env
openssl rand -hex 32      # → POSTGRES_PASSWORD
openssl rand -base64 48   # → JWT_SECRET
nano .env                 # tout remplir, API_IMAGE_TAG compris
docker login ghcr.io -u CheickLa   # coller le token read:packages
```

## 4. Démarrage

Toujours dans `/opt/langestloc`, dans cet ordre :

```bash
docker compose -f compose.prod.yml pull
docker compose -f compose.prod.yml up -d db
docker compose -f compose.prod.yml run --rm api npx prisma migrate deploy
docker compose -f compose.prod.yml up -d api
docker compose -f compose.prod.yml run --rm api node dist/src/cli/create-admin.js
```

La dernière commande demande l'e-mail, le nom et le mot de passe (masqué) du
premier ADMIN. Elle refuse s'il en existe déjà un.

## 5. Vérifications

```bash
docker compose -f compose.prod.yml ps                          # api et db : healthy
docker compose -f compose.prod.yml logs api | grep -i bucket   # Bucket "…" prêt
curl https://api.langestloc.cheickla.fr/health                 # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://api.langestloc.cheickla.fr/api-json   # 404
```

Depuis le Mac, `nc -zv -w 5 <ip-du-vps> 5432` doit échouer : la base n'est pas
joignable de l'extérieur.

## 6. Vercel

1. Projet Vercel relié au repo, Root Directory `frontend`.
   `frontend/vercel.json` fixe la région des fonctions (`cdg1`, Paris, près du
   VPS de Strasbourg).
2. Variable d'environnement de Production :
   `BACKEND_URL=https://api.langestloc.cheickla.fr`.
3. Settings → Domains : ajouter `langestloc.cheickla.fr`, puis créer chez OVH
   l'enregistrement DNS indiqué par Vercel.
4. Redéployer, puis sur `https://langestloc.cheickla.fr` : se connecter avec
   l'ADMIN, créer un contrat (PDF du bail sur S3), enregistrer un paiement
   (reçu PDF).

## 7. Déploiement automatique et sauvegardes : mise en place

À faire une seule fois, dans l'ordre.

### Avant le merge

#### 7.1 Clé SSH de déploiement

Sur le Mac :

```bash
ssh-keygen -t ed25519 -N '' -C github-deploy-langestloc -f ~/.ssh/langestloc_deploy
# restrict : ni redirection ni terminal
echo "restrict $(cat ~/.ssh/langestloc_deploy.pub)" | ssh <user>@<ip-du-vps> 'cat >> ~/.ssh/authorized_keys'
ssh-keyscan -t ed25519 <ip-du-vps> 2> /dev/null | tee /tmp/langestloc_known_hosts | ssh-keygen -lf -
```

Sur le serveur, la même empreinte doit s'afficher. Sinon, s'arrêter : ce n'est
pas le bon serveur.

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Depuis le Mac,
`ssh -i ~/.ssh/langestloc_deploy -o IdentitiesOnly=yes <user>@<ip-du-vps> 'echo ok'`
doit afficher `ok`.

Dans GitHub, repo → Settings → Environments → New environment : `vps`,
limité à `main` (Deployment branches and tags → Selected branches). Y
ajouter :

- le secret `SSH_PRIVATE_KEY` : `pbcopy < ~/.ssh/langestloc_deploy`, puis coller ;
- les variables `SSH_HOST` (`<ip-du-vps>`), `SSH_USER` (`<user>`) et
  `SSH_KNOWN_HOSTS` (`pbcopy < /tmp/langestloc_known_hosts`, puis coller).

Ensuite, sur le Mac : `rm ~/.ssh/langestloc_deploy /tmp/langestloc_known_hosts`.
Seul GitHub a besoin de la clé privée ; si elle se perd, on en génère une
autre. La clé publique reste dans `~/.ssh/langestloc_deploy.pub`, pour la
reconnaître dans `authorized_keys`.

#### 7.2 Clés de chiffrement des sauvegardes (age)

Sur le Mac, avec Docker Desktop démarré (rien à installer) :

```bash
docker run --rm alpine:3.24 sh -c 'apk add -q age && age-keygen 2> /dev/null'
```

Trois lignes s'affichent : `# created: …`, `# public key: age1…` et
`AGE-SECRET-KEY-1…`. Les trois vont dans le gestionnaire de mots de passe
(« LanGestLoc, clé des sauvegardes ») et dans le secret `AGE_SECRET_KEY` de
l'environnement GitHub `sauvegardes` (7.5). La clé publique `age1…` sert pour
`AGE_RECIPIENT` dans `backup.env` (7.8).

Si la clé privée est perdue à ces deux endroits, les sauvegardes deviennent
illisibles.

#### 7.3 AWS : bucket et utilisateurs des sauvegardes

1. S3 → Create bucket `langestloc-backups-cheickla`, région `eu-west-3`,
   accès public bloqué, Bucket Versioning sur Enable.
2. Bucket → Management → Create lifecycle rule, deux règles sur le préfixe
   `daily/` :
   - `expiration-30-jours` : *Expire current versions of objects* à 30 jours,
     *Permanently delete noncurrent versions of objects* à 30 jours, et
     incomplete multipart uploads à 1 jour ;
   - `nettoyage-marqueurs` : *Delete expired object delete markers*.
3. IAM → Users → Create user `langestloc-backup-writer`, sans accès console,
   avec la politique en ligne `langestloc-backup-write` :

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "s3:PutObject",
         "Resource": "arn:aws:s3:::langestloc-backups-cheickla/daily/*"
       }
     ]
   }
   ```

   Lui créer une clé d'accès (*Application running outside AWS*), pour
   `backup.env` (7.8).
4. Même chose pour `langestloc-backup-reader`, avec la politique
   `langestloc-backup-read` :

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::langestloc-backups-cheickla"
       },
       {
         "Effect": "Allow",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::langestloc-backups-cheickla/daily/*"
       }
     ]
   }
   ```

   Sa clé d'accès va dans l'environnement GitHub `sauvegardes` (7.5).

Ne rien changer à `langestloc-api` : il n'a aucun droit sur ce bucket.

#### 7.4 Healthchecks.io

Créer un compte gratuit et deux contrôles, avec alertes par e-mail :

- « Sauvegarde quotidienne » : Period 1 day, Grace 1 hour ;
- « Test de restauration » : Period 7 days, Grace 1 day.

Noter l'adresse de signal de chacun (`https://hc-ping.com/…`).

#### 7.5 GitHub : environnement `sauvegardes` et notifications

Créer l'environnement `sauvegardes`, limité à `main`, avec :

- les secrets `AGE_SECRET_KEY` (les trois lignes de 7.2),
  `BACKUP_READER_ACCESS_KEY_ID` et `BACKUP_READER_SECRET_ACCESS_KEY` (7.3),
  `HEALTHCHECK_RESTORE_URL` (contrôle « Test de restauration », 7.4) ;
- la variable `BACKUP_BUCKET` = `langestloc-backups-cheickla`.

Côté notifications (avatar → Settings → Notifications → System → Actions) :
e-mail activé, *Only notify for failed workflows*.

### Le merge

#### 7.6 Premier déploiement automatique

Merger la PR, puis suivre le run CI de `main` dans l'onglet Actions. Le job
« Déploiement API (VPS) » doit passer au vert (son journal s'affiche à la fin
de l'étape « Déployer sur le VPS »), et
`curl https://api.langestloc.cheickla.fr/health` doit renvoyer
`{"status":"ok"}`. Pour ce merge-là, Vercel met le front en ligne sans
attendre l'API.

Si « Déployer sur le VPS » échoue sur `denied` au téléchargement de l'image :
sur GitHub, paquet `langestloc-api` (onglet Packages du profil) → Package
settings → Manage Actions access, et donner l'accès Read au repo LanGestLoc.

### Après le premier déploiement

#### 7.7 Vercel : le front attend l'API

Cette étape vient après le merge : Vercel ne propose que des checks qui ont
déjà tourné.

1. Projet → Settings → Environments → Production : l'attribution automatique
   des domaines de production doit être active (c'est le réglage par défaut).
2. Projet → Settings → Build and Deployment → Deployment Checks → Add Checks →
   GitHub, et cocher `Backend (lint, build, tests)`,
   `API e2e (Postgres + MinIO)`, `Frontend (lint, build)`,
   `Image Docker (build, vérification, push GHCR)` et `Déploiement API (VPS)`.

Au merge suivant, la nouvelle version doit rester en attente dans Vercel
jusqu'à la fin du job « Déploiement API (VPS) ».

#### 7.8 Serveur : sauvegarde quotidienne

Le service tourne sous `ubuntu` (`User=` dans `langestloc-backup.service`).
Si `<user>` est un autre compte, changer cette ligne avant de copier le
fichier : `backup.env` et le verrou des déploiements n'appartiennent qu'à
`<user>`.

Depuis le Mac, à la racine du repo :

```bash
scp deploy/backup.env.example deploy/systemd/langestloc-backup.service \
  deploy/systemd/langestloc-backup.timer <user>@<ip-du-vps>:/tmp/
```

Sur le serveur :

```bash
sudo apt update && sudo apt install -y age
cd /opt/langestloc
install -m 600 /tmp/backup.env.example backup.env
nano backup.env      # clés du writer (7.3), clé publique age (7.2), adresse Healthchecks (7.4)
sudo install -m 644 /tmp/langestloc-backup.service /tmp/langestloc-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now langestloc-backup.timer
sudo systemctl start langestloc-backup.service         # première sauvegarde tout de suite
sudo journalctl -u langestloc-backup -n 20 --no-pager  # « Sauvegarde envoyée : … »
systemctl list-timers langestloc-backup.timer
rm /tmp/backup.env.example /tmp/langestloc-backup.service /tmp/langestloc-backup.timer
```

Le contrôle Healthchecks « Sauvegarde quotidienne » doit passer au vert, et
`list-timers` montrer le prochain passage à 03:00 UTC (affiché à l'heure du
serveur).

#### 7.9 Premier test de restauration

GitHub → Actions → Test de restauration → Run workflow sur `main`. Le run et
le contrôle Healthchecks « Test de restauration » doivent passer au vert.

#### 7.10 Supprimer l'ancien token GHCR

Le déploiement se connecte à GHCR avec un jeton temporaire, le token
`read:packages` de l'étape 2 ne sert plus. Vérifier que
`cat ~/.docker/config.json` ne mentionne plus `ghcr.io` sur le serveur, puis
supprimer le token sur GitHub (Settings → Developer settings → Personal access
tokens).

## 8. Déploiement automatique : au quotidien

Chaque merge sur `main` lance le CI (backend, e2e, frontend), publie l'image
sur GHCR, puis lance le job « Déploiement API (VPS) ». Vercel met le front en
ligne une fois ce job vert.

Sur le serveur, `deploy.sh` attend la fin d'un éventuel autre déploiement,
télécharge l'image et regarde s'il y a une migration à appliquer ; si oui, il
arrête l'API. Il sauvegarde toujours la base (`backups/avant-*.dump`, les 10
dernières), applique la migration, démarre la nouvelle version et attend
`/health`. Si ça échoue, il revient seul à l'ancienne version, base comprise
si une migration est passée.

Pour redéployer la même version sans rien reconstruire, ouvrir le job
« Déploiement API (VPS) » du dernier run CI de `main` et le relancer avec son
propre bouton de relance. « Re-run all jobs » et « Run workflow »
reconstruisent l'image sous le même SHA : un retour arrière viserait alors
cette image reconstruite au lieu de celle qui a été vérifiée.

Le journal du déploiement s'affiche à la fin de l'étape « Déployer sur le
VPS ». Le serveur garde les 30 derniers dans `/opt/langestloc/logs`
(`ls -t /opt/langestloc/logs | head`).

En cas d'échec, GitHub envoie un e-mail et le front ne part pas. Le journal
dit ce qui s'est passé :

- « ERREUR : … » : refus avant toute action (SHA invalide, `.env` introuvable,
  `API_IMAGE_TAG` absent ou invalide). Un SHA invalide n'apparaît que dans
  l'étape du job, pas dans `/opt/langestloc/logs`.
- « ÉCHEC : … La base n'a pas été modifiée. » : échec avant la migration
  (image, sauvegarde…). L'ancienne version tourne toujours.
- « Retour arrière terminé » : échec pendant ou après la migration.
  L'ancienne version tourne de nouveau, avec la base restaurée si besoin.
  Corriger, puis merger à nouveau.
- « RETOUR ARRIÈRE ÉCHOUÉ » : suivre « Revenir en arrière » plus bas.

Si la connexion SSH a coupé ou si le job a expiré, le job est rouge sans
journal, mais le déploiement est allé au bout sur le serveur : lire le dernier
fichier de `/opt/langestloc/logs`.

Autres cas :

- Mettre une version du front en ligne sans attendre les checks : Vercel →
  Deployments → la version → *Force Promote*.
- Modifier `deploy/` : lancer la répétition, qui exécute les vrais scripts sur
  une stack jetable. Sur le Mac, `deploy/test/run-in-docker.sh` avec Docker
  Desktop démarré ; en PR, le workflow « Répétition du déploiement » tourne
  seul.
- Renommer un job du CI : mettre à jour les Deployment Checks de Vercel (7.7)
  et le ruleset GitHub pour les checks obligatoires.

## 9. Sauvegardes

| Quoi | Quand | Où | Durée |
|---|---|---|---|
| Sauvegarde de déploiement | avant chaque déploiement | `/opt/langestloc/backups/avant-*.dump` (non chiffrée, sur le serveur) | 10 dernières |
| Sauvegarde quotidienne | 03:00 UTC | `s3://langestloc-backups-cheickla/daily/langestloc-<date>.dump.age` (chiffrée) | 30 jours, puis 30 jours en ancienne version |
| Test de restauration | lundi 05:00 UTC | GitHub Actions, base jetable | supprimée à la fin |

Après 30 jours, S3 masque la sauvegarde mais la garde encore 30 jours comme
ancienne version (console S3 → *Afficher les versions*) : un fichier écrasé
reste récupérable.

Healthchecks alerte si une sauvegarde échoue ou manque, ou si le test ne
tourne plus ; GitHub envoie un e-mail si le test échoue. Pour lancer une
sauvegarde à la main : `sudo systemctl start langestloc-backup.service`, puis
`sudo journalctl -u langestloc-backup -n 20 --no-pager`.

## Sauvegarder la base

Le déploiement le fait tout seul. À la main, avant d'intervenir sur la base,
ne continuer que si « Sauvegarde vérifiée » s'affiche : un `pg_dump` raté
laisse un fichier vide ou tronqué.

```bash
cd /opt/langestloc
DUMP=~/langestloc-$(date +%F-%H%M).dump
docker compose -f compose.prod.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DUMP" \
  && docker compose -f compose.prod.yml exec -T db pg_restore --list < "$DUMP" > /dev/null \
  && echo "Sauvegarde vérifiée : $DUMP"
```

## Revenir en arrière

Le déploiement revient seul à la version précédente quand la nouvelle ne
démarre pas. Cette section sert quand ce retour a échoué (« RETOUR ARRIÈRE
ÉCHOUÉ »), ou pour quitter une version qui démarre mais se comporte mal. Il
faut aussi annuler le commit fautif sur `main` (`git revert` + PR), sinon le
prochain merge le redéploie.

Le serveur garde l'image en place et la précédente
(`docker images ghcr.io/cheickla/langestloc-api`). Les journaux de
`/opt/langestloc/logs` donnent les versions et le nom de chaque sauvegarde, et
`previous/` contient l'ancien `compose.prod.yml` s'il a changé.

### Sans migration

```bash
cd /opt/langestloc
nano .env                                   # ancien API_IMAGE_TAG
docker compose -f compose.prod.yml up -d api
curl https://api.langestloc.cheickla.fr/health
```

### Avec une migration

Restaurer la sauvegarde prise juste avant, puis relancer l'ancienne version.
Les données écrites depuis sont perdues. `restore-db.sh` remplace tout le
schéma en une seule transaction : s'il échoue, la base ne bouge pas.

```bash
cd /opt/langestloc
docker compose -f compose.prod.yml stop api
bash restore-db.sh backups/avant-AAAAMMJJ-HHMMSS-<sha>.dump
nano .env                                   # ancien API_IMAGE_TAG
docker compose -f compose.prod.yml up -d api
curl https://api.langestloc.cheickla.fr/health
```

### Depuis une sauvegarde quotidienne

Pour un serveur perdu ou une base détruite. Ne pas refaire les sections 1 à 6
telles quelles : la section 1 créerait un second bucket, sans les PDF déjà en
ligne, et l'étape 4 de la section 6 écrirait un contrat et un paiement de test
sur une base vide. Ils reprendraient les numéros 1, et leurs PDF
(`receipts/<année>/REC-<année>-00001.pdf`,
`contracts/1/BAIL-<année>-00001.pdf`) écraseraient le vrai premier reçu et le
vrai premier bail de l'année dans le bucket.

À la place, dans l'ordre :

1. Nouveau serveur : README de [CheickLa/vps](https://github.com/CheickLa/vps)
   (Docker, réseau `proxy`, Caddy), puis chez OVH l'enregistrement A
   `api.langestloc` → IP du nouveau serveur.
2. AWS : ne pas faire la section 1. Garder le bucket PDF et l'utilisateur IAM
   `langestloc-api` ; si sa clé est perdue, lui en créer une nouvelle (IAM →
   l'utilisateur → Security credentials). Jamais de nouveau bucket.
3. Section 2 étape 3 (token `read:packages`), puis section 3. Dans `.env`,
   `API_IMAGE_TAG` est le SHA du dernier déploiement réussi : GitHub → Actions
   → dernier run CI de `main` dont le job « Déploiement API (VPS) » est vert.
4. Depuis le Mac :
   `scp deploy/common.sh deploy/restore-db.sh deploy/backup.sh <user>@<ip-du-vps>:/opt/langestloc/`.
   D'habitude, c'est un déploiement qui pose ces fichiers ; `backup.sh` sert à
   l'étape 8.
5. Sur le Mac, dans le dossier du `.dump.age` téléchargé depuis la console S3
   (`langestloc-backups-cheickla` → `daily/`) :

   ```bash
   nano cle.txt      # les trois lignes de la clé age
   docker run --rm -v "$PWD:/w" -w /w alpine:3.24 \
     sh -c 'apk add -q age && age -d -i cle.txt -o base.dump langestloc-XXXX.dump.age'
   rm cle.txt
   scp base.dump <user>@<ip-du-vps>:~/
   ```

   Puis sur le serveur : `chmod 600 ~/base.dump`. Pas dans `/tmp`, que tout le
   monde peut lire.
6. Sur le serveur, dans `/opt/langestloc` :

   ```bash
   docker compose -f compose.prod.yml pull
   docker compose -f compose.prod.yml up -d --wait db
   bash restore-db.sh ~/base.dump
   ```

   Ne continuer que si la dernière ligne affichée est « Base restaurée ».
   Sinon, s'arrêter : la base est restée vide, `~/base.dump` est intact, et on
   peut relancer `bash restore-db.sh ~/base.dump` après avoir lu l'erreur. Si
   tout va bien :

   ```bash
   docker compose -f compose.prod.yml run --rm api npx prisma migrate deploy   # l'image peut être plus récente que la sauvegarde
   docker compose -f compose.prod.yml up -d api
   curl https://api.langestloc.cheickla.fr/health
   rm ~/base.dump
   ```

   Sur le Mac : `rm base.dump`.
7. Ne pas lancer `create-admin` ni refaire le test de l'étape 4 de la section
   6 : la base restaurée a déjà ses ADMIN, et le test écraserait un vrai PDF.
8. Refaire 7.1 (nouvelle empreinte : mettre à jour `SSH_HOST` et
   `SSH_KNOWN_HOSTS`, poser la clé publique avec `restrict` sur le nouveau
   serveur) et 7.8. Les clés de `langestloc-backup-writer` étaient dans le
   `backup.env` perdu : lui en créer une nouvelle, sans refaire 7.3. Faire
   7.10 après le prochain déploiement automatique réussi.

## Limites connues

### Connexion bloquée par e-mail

La connexion est limitée à 5 tentatives par minute et par adresse e-mail,
quelle que soit l'IP : en production, toutes les requêtes arrivent du BFF
Vercel. Quelqu'un qui connaît l'e-mail d'un compte peut donc bloquer sa
connexion en envoyant de mauvais mots de passe sans arrêt. Les sessions déjà
ouvertes (jeton de 24 h) continuent de marcher. C'est le prix d'une vraie
protection contre le brute-force ; la parade complète, où le BFF transmet l'IP
réelle du navigateur en la signant, est écartée pour l'instant.

### Déploiement automatique

- L'API est à jour une à deux minutes avant le front, et pendant ce temps
  l'ancien front parle à la nouvelle API. Un changement d'API qui casserait le
  front en ligne (un champ supprimé qu'il utilise encore, par exemple) doit
  être découpé en deux merges.
- Chaque déploiement coupe l'API quelques secondes, le temps de recréer le
  conteneur, et une trentaine de secondes de plus s'il y a une migration.
- Si `/health` ne répond pas depuis Internet alors que le serveur a validé la
  version, la nouvelle version reste en place : le job est rouge et le front
  ne part pas.
- La clé SSH de déploiement donne en pratique tous les droits sur le VPS
  (groupe `docker`). Seul l'environnement GitHub `vps`, réservé à `main`,
  peut s'en servir.
- La clé privée `age` n'existe que dans le gestionnaire de mots de passe et
  dans GitHub.
