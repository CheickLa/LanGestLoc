# LanGestLoc

Property management app for a portfolio of commercial premises in Guinea.

The owner used to manage the whole portfolio on paper, and wanted to move off it, automate the follow-up and never lose track of a single transaction. With LanGestLoc:

- every lease is generated as a PDF when the contract is created, ready to print or send;
- every rent collected is recorded with its date, its payment method (cash, Orange Money, Mobile Money) and a PDF receipt for the tenant;
- monthly rent dues are created automatically, and late payments show up on their own;
- the dashboard shows at a glance what has been collected, what is still due and who is late;
- the history is complete: a recorded payment or receipt can never be edited or deleted;
- an agent can collect rent from a phone, without being able to touch the contracts.

**In production: [langestloc.cheickla.fr](https://langestloc.cheickla.fr)**

![Dashboard on desktop](docs/screenshots/desktop.jpg)

It is used mostly on phones, and works just as well on desktop. On a phone it is a PWA: it installs on the home screen and opens full screen.

![Dashboard, contract details and payment on a phone](docs/screenshots/phones.jpg)

<sub>Screenshots taken with fictitious data. The interface is in French.</sub>

## Architecture

- **Front end**: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui (Radix UI), Lucide icons, Sonner toasts, TanStack Query, react-hook-form and Zod. Installable PWA. Reads in Server Components, forms and payments in Client Components.
- **Back end**: REST API in NestJS 11 and TypeScript, with Prisma 7, JWT authentication (Passport, local and JWT strategies), input validation (class-validator and class-transformer), environment-based configuration (@nestjs/config), rate limiting (@nestjs/throttler), scheduled jobs (@nestjs/schedule) and Swagger documentation.
- **Database**: PostgreSQL 16, Prisma migrations.
- **Documents**: leases and receipts generated as PDFs with PDFKit, in the app's branding, then stored on AWS S3 (AWS SDK v3). The upload to S3 happens after the database commit, never during it.
- **Containers**: Docker, with Docker Compose both locally and in production.
- **Shared types**: front-end types are generated from the API's OpenAPI spec (openapi-typescript). No API response is typed by hand.
- **Analytics**: Google Analytics 4, loaded once the visitor accepts the cookie banner.

## Security

- The browser never talks to the API: Next relays it server-side. The JWT stays in an httpOnly cookie, out of reach of JavaScript, and there is no CORS to open.
- Passwords hashed with bcrypt.
- Roles are checked by the API on every route (Passport guards), not just hidden in the interface.
- Rate limiting: 100 requests per minute per user and per route, and 5 login attempts per minute per email address.
- Swagger is disabled in production.
- Server: key-only SSH, firewall limited to ports 22, 80 and 443, automatic HTTPS with Caddy.

## Tests and quality

- About 390 unit tests on the API (Jest), and Vitest tests on the front end.
- An end-to-end scenario runs in CI: the API starts on a real PostgreSQL database and S3 storage, then the script walks through the whole cycle (contract, rent dues, payments, receipts, termination, cancellation), checking response codes and business rules.
- Every PR goes through lint (ESLint, Prettier), build and tests. Merging is blocked if CI fails.

## Deployment and backups

- A merge to `main` deploys everything, with no manual step. GitHub Actions publishes the image to GHCR and deploys it over SSH to an OVH VPS (Docker Compose, Caddy): database backup, migrations, switchover, then automatic rollback with restore if anything fails.
- The front end is on Vercel, and only goes live once CI has passed.
- The database is backed up every night, encrypted with age, to S3. A restore is tested automatically every Monday.
- Any change to the deployment is rehearsed in Docker first, locally and in PRs.

Detailed procedures (in French): [deploy/README.md](deploy/README.md).

## Running locally

You need Docker, Node.js (npm) and a `.env` file at the root (database, JWT, S3, seed accounts).

```sh
docker compose up        # Postgres, local S3 storage (RustFS) and the API on port 3000
cd frontend && npm install && npm run dev   # front end on port 3001
```

The cookie banner only shows when `NEXT_PUBLIC_GA_ID` is set: `NEXT_PUBLIC_GA_ID=G-TEST123 npm run dev` shows it locally.

Prisma Studio: `cd backend && npx prisma studio`. It reads `DATABASE_URL` from `backend/.env`, not from the root `.env`: the database is on `localhost:5432` there.
