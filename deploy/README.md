# Déploiement de LanGestLoc

Procédure du **premier déploiement**, faite à la main. Le déploiement
automatique (et les sauvegardes) viendront ensuite, en reprenant exactement
ces étapes.

- API : `https://api.langestloc.cheickla.fr` (VPS OVH, derrière le Caddy partagé)
- Application : `https://langestloc.cheickla.fr` (Vercel)

## Prérequis

- Le serveur est installé en suivant le README du repo
  [CheickLa/vps](https://github.com/CheickLa/vps) : Docker, réseau `proxy`,
  Caddy démarré avec le bloc `api.langestloc.cheickla.fr`.
- L'enregistrement DNS **A** `api.langestloc` → IP du VPS existe chez OVH
  (zone DNS de `cheickla.fr`).

Dans les commandes ci-dessous, `<user>` est ton utilisateur SSH (`ubuntu`
par défaut chez OVH) et `<ip-du-vps>` l'IP publique du serveur.

## 1. AWS : bucket et accès limité

1. Créer un bucket S3 en `eu-west-3` (Paris), accès public bloqué (réglage
   par défaut).
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

3. Créer une clé d'accès pour cet utilisateur : elle ira dans `S3_ACCESS_KEY`
   et `S3_SECRET_KEY`.

## 2. GitHub : publier l'image

1. Merger la branche dans `main`. Le job **« Image Docker »** du workflow CI
   construit l'image, la vérifie, puis la publie sur
   `ghcr.io/cheickla/langestloc-api:<SHA>`.
2. Vérifier que le job est vert et noter le **SHA complet** du commit
   (`git rev-parse origin/main`).
3. Créer un token GitHub **classic** avec la seule permission `read:packages`
   (Settings → Developer settings → Personal access tokens). Il sert au
   serveur à télécharger l'image, qui est privée comme le repo.

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
nano .env                 # remplir toutes les valeurs, dont API_IMAGE_TAG
docker login ghcr.io -u CheickLa   # coller le token read:packages quand il est demandé
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

La dernière commande demande l'e-mail, le nom et le mot de passe du premier
ADMIN (mot de passe masqué). Elle refuse s'il existe déjà un ADMIN.

## 5. Vérifications

```bash
docker compose -f compose.prod.yml ps                          # api et db : healthy
docker compose -f compose.prod.yml logs api | grep -i bucket   # Bucket "…" prêt
curl https://api.langestloc.cheickla.fr/health                 # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://api.langestloc.cheickla.fr/api-json   # 404
```

Depuis le Mac, la base ne doit pas être joignable :
`nc -zv -w 5 <ip-du-vps> 5432` doit échouer.

## 6. Vercel

1. Projet Vercel relié au repo, **Root Directory** : `frontend`.
   La région des fonctions (`cdg1`, Paris, au plus près du VPS de Strasbourg)
   est fixée par `frontend/vercel.json`.
2. Variable d'environnement (Production) :
   `BACKEND_URL=https://api.langestloc.cheickla.fr`.
3. Settings → Domains : ajouter `langestloc.cheickla.fr`, puis créer chez OVH
   l'enregistrement DNS indiqué par Vercel.
4. Redéployer, puis sur `https://langestloc.cheickla.fr` : se connecter avec
   l'ADMIN créé, créer un contrat (PDF du bail sur S3), enregistrer un
   paiement (reçu PDF).

## Sauvegarder la base

À faire **avant chaque migration**. La seconde commande relit l'archive :
ne continuer que si « Sauvegarde vérifiée » s'affiche (un `pg_dump` en échec
laisse un fichier vide ou tronqué).

```bash
cd /opt/langestloc
DUMP=~/langestloc-$(date +%F-%H%M).dump
docker compose -f compose.prod.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DUMP" \
  && docker compose -f compose.prod.yml exec -T db pg_restore --list < "$DUMP" > /dev/null \
  && echo "Sauvegarde vérifiée : $DUMP"
```

## Mettre à jour (en attendant le déploiement automatique)

```bash
cd /opt/langestloc
# 1. Sauvegarder la base (section ci-dessus) et attendre « Sauvegarde vérifiée »
nano .env                                   # 2. nouveau API_IMAGE_TAG
docker compose -f compose.prod.yml pull api
docker compose -f compose.prod.yml run --rm api npx prisma migrate deploy
docker compose -f compose.prod.yml up -d api
curl https://api.langestloc.cheickla.fr/health
```

## Revenir en arrière

Si la nouvelle version ne convient pas et **qu'aucune migration n'a été
appliquée** : remettre l'ancien `API_IMAGE_TAG` dans `.env`, puis
`docker compose -f compose.prod.yml up -d api`.

Si une migration a modifié la base, restaurer la sauvegarde prise juste
avant (les données écrites depuis sont perdues), puis relancer l'ancienne
version :

```bash
cd /opt/langestloc
docker compose -f compose.prod.yml stop api
docker compose -f compose.prod.yml exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' \
  < ~/langestloc-AAAA-MM-JJ-HHMM.dump
nano .env                                   # ancien API_IMAGE_TAG
docker compose -f compose.prod.yml up -d api
curl https://api.langestloc.cheickla.fr/health
```

`--single-transaction` : si la restauration échoue, la base reste telle
qu'elle était avant la commande.

## Limite connue : blocage de la connexion par e-mail

La connexion est limitée à 5 tentatives par minute **et par adresse
e-mail**, quelle que soit l'IP (en production, toutes les requêtes arrivent
du BFF Vercel). Quelqu'un qui connaît l'e-mail d'un compte peut donc, en
envoyant de mauvais mots de passe en continu, empêcher ce compte de se
connecter tant qu'il insiste. Les sessions déjà ouvertes (jeton de 24 h) ne
sont pas affectées. C'est le prix d'une protection efficace contre le
brute-force ; la parade complète (le BFF transmet l'IP réelle du navigateur,
signée) est écartée pour l'instant.
