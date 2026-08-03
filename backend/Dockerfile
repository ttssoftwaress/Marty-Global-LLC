FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
# prisma.config.ts is deliberately NOT copied before this step. It resolves
# env('DATABASE_URL') the moment Prisma loads it, and there is no database URL at
# build time — `generate` reads the schema on its own and does not need it.
# The config arrives with `COPY . .` below, which is what the migrate stage uses.
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# GHCR links a package to a repository by reading this label on push, and a
# linked package inherits that repository's permissions. Without it the image
# name (marty-global-llc/backend) matches no repository name, so the release
# workflow's GITHUB_TOKEN has no claim on the package and the push 403s.
LABEL org.opencontainers.image.source="https://github.com/ttssoftwaress/Marty-Global-LLC"

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]

# One-shot migration runner, run to completion by the deploy before the API
# starts. It exists because migrations cannot run from the production stage:
# `prisma` is a devDependency stripped by `npm ci --omit=dev`, and
# prisma.config.ts is never copied there. Building FROM build keeps both, and
# DATABASE_URL is supplied at run time, which is when the config resolves it.
FROM build AS migrate
LABEL org.opencontainers.image.source="https://github.com/ttssoftwaress/Marty-Global-LLC"
CMD ["npx", "prisma", "migrate", "deploy"]
