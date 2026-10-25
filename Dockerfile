# syntax=docker/dockerfile:1

FROM node:lts AS base
WORKDIR /app
# Newer Node releases no longer bundle corepack. It installs the pnpm that
# package.json pins in `packageManager`.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install --global corepack && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# The runtime needs varlock to load .env.schema when the server boots, and
# prisma for `migrate deploy`. The server bundle carries everything else.
FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SOURCE_COMMIT
# The Varlock plugin validates .env.schema during the build. The build opens
# no database, so any valid path will do.
ENV DATABASE_URL=file:/tmp/build.db
# The image is public, so the token comes in as a secret and never reaches a
# layer or the build history.
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
  pnpm build

FROM node:lts-slim
WORKDIR /app
# Prisma's schema engine, which runs `migrate deploy`, links against OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ARG VERSION=dev
ARG SOURCE_COMMIT=unknown
LABEL org.opencontainers.image.source="https://github.com/Shtian/inflation-station" \
  org.opencontainers.image.version="$VERSION" \
  org.opencontainers.image.revision="$SOURCE_COMMIT"
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
# Varlock regenerates its types when the server boots and writes only when
# they differ, so the build's copy keeps it from writing into /app.
COPY --from=build /app/env.d.ts ./
COPY package.json .env.schema prisma.config.ts ./
COPY prisma ./prisma
COPY scripts/backup-db.sh scripts/docker-entrypoint.sh scripts/healthcheck.mjs ./scripts/
# A new volume mounted at /data takes this ownership, so the app can create
# its database there.
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
# The start period covers the entrypoint's backup and `prisma migrate deploy`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "/app/scripts/healthcheck.mjs"]
ENTRYPOINT ["scripts/docker-entrypoint.sh"]
