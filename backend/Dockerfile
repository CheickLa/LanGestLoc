# Image de production de l'API LanGestLoc, construite par la CI (linux/amd64),
# jamais sur le serveur. Le développement local utilise Dockerfile.dev.

# ── Dépendances de production ────────────────────────────────────────────────
# Étape séparée qui ne dépend que du lockfile : tant qu'il ne change pas, sa
# couche reste identique d'un build à l'autre, et un déploiement qui ne touche
# que le code ne retélécharge pas node_modules sur le serveur.
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Compilation ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ── Image finale, sans outils de build ───────────────────────────────────────
FROM node:24-alpine
# Pas d'appel au registre npm à chaque `npx prisma …` (annonce de mise à jour de npm)
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
# Schéma, migrations et configuration : nécessaires à `npx prisma migrate deploy`
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

CMD ["node", "dist/src/main"]
