# LanGestLoc

Application de gestion locative pour des boutiques et locaux commerciaux en Guinée. Elle sert au quotidien, surtout depuis un téléphone : c'est une PWA, qui s'installe sur l'écran d'accueil et s'ouvre en plein écran.

> **Projet en cours de développement.** Une partie est déjà en production, le reste arrive au fil des PR.

## Ce que fait l'application

- Locaux, locataires et contrats de bail, avec le bail généré en PDF.
- Loyers : une augmentation crée un nouveau montant à partir d'une date, l'historique reste intact.
- Échéances mensuelles créées automatiquement, et passées en retard si elles ne sont pas payées le 5 du mois suivant.
- Paiements : un paiement règle un ou plusieurs mois d'un coup, du plus ancien dû au mois choisi, jamais en partie. Chaque paiement donne un reçu PDF.
- Caution d'un mois de loyer, restituée à la fin du contrat.
- Deux rôles : l'administrateur gère tout, l'agent consulte et enregistre les paiements.

## Stack

- **Front** : Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, TanStack Query, react-hook-form et Zod. Les types de l'API sont générés depuis sa spec OpenAPI (openapi-typescript). Le navigateur ne parle jamais à l'API : Next la relaie côté serveur, avec le jeton dans un cookie httpOnly.
- **API** : NestJS, TypeScript, Prisma, PostgreSQL 16, JWT avec Passport, class-validator, documentation Swagger, limitation de débit (@nestjs/throttler), tâches planifiées (@nestjs/schedule). Bail et reçus générés en PDF avec PDFKit et stockés sur AWS S3.
- **Tests** : Jest et Supertest (unitaires et e2e sur une vraie base).
- **Déploiement** : GitHub Actions publie l'image sur GHCR et la déploie par SSH sur un VPS OVH (Docker Compose, Caddy) ; le front est sur Vercel. Sauvegarde de la base chaque nuit, chiffrée avec age sur S3, et test de restauration chaque semaine (voir [deploy/README.md](deploy/README.md)).
- **En local** : Docker Compose, avec RustFS à la place de S3.

## Lancer en local

Il faut Docker et un fichier `.env` à la racine (base, JWT, S3, comptes du seed).

```sh
docker compose up        # Postgres, stockage S3 local et API sur le port 3000
cd frontend && npm install && npm run dev   # front sur le port 3001
```

Prisma Studio : `cd backend && npx prisma studio`.
