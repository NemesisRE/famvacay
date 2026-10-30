# ==============================================================================
# Multi-Stage, Multi-Arch Dockerfile for FamVacay
# Target architectures: linux/amd64, linux/arm64
# Base: Node.js 26 Active LTS Alpine (Node 22 is Maintenance LTS)
# Package manager: pnpm, via Corepack (pinned by packageManager in package.json)
# Stages: deps -> builder -> migrator -> runner
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies
# ------------------------------------------------------------------------------
FROM node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl
RUN npm install -g corepack && corepack enable

# Fetch into the pnpm content-addressable store first (cached as long as the
# lockfile is unchanged), then install by linking from the store offline.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install
RUN pnpm fetch

COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile --offline

# ------------------------------------------------------------------------------
# Stage 2: Builder
# ------------------------------------------------------------------------------
FROM node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN npm install -g corepack && corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client
RUN pnpm exec prisma generate

# Build Next.js in standalone mode. The generated Prisma Client (src/generated)
# is bundled like app code, and output file tracing copies its runtime and the
# pg driver into .next/standalone/node_modules; no manual copy step needed.
RUN pnpm run build

# ------------------------------------------------------------------------------
# Stage 3: Migrator (Dedicated one-shot container for database migrations)
# ------------------------------------------------------------------------------
FROM node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS migrator
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Non-root user nextjs (UID/GID 10001) matching runner and k8s securityContext
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 nextjs

# Since Prisma 7 the CLI reads the connection URL from prisma.config.ts, which
# imports `prisma/config` and `dotenv`. Install just those two, at the exact
# versions the lockfile resolved (read from the deps stage), instead of the
# whole dev toolchain. npm runs prisma's postinstall here as root, so the schema
# engine is downloaded before we drop to the non-root user.
COPY --from=deps /app/node_modules/prisma/package.json /tmp/versions/prisma.json
COPY --from=deps /app/node_modules/dotenv/package.json /tmp/versions/dotenv.json
RUN npm install --no-save --no-package-lock --no-audit --no-fund \
      "prisma@$(node -p "require('/tmp/versions/prisma.json').version")" \
      "dotenv@$(node -p "require('/tmp/versions/dotenv.json').version")" && \
    npm cache clean --force && rm -rf /tmp/versions

COPY prisma.config.ts ./
COPY --chown=nextjs:nodejs prisma ./prisma/

USER nextjs
ENTRYPOINT ["node_modules/.bin/prisma"]
CMD ["migrate", "deploy"]

# ------------------------------------------------------------------------------
# Stage 4: Runner (Target size < 150MB, read-only root compatible)
# ------------------------------------------------------------------------------
FROM node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS runner
WORKDIR /app


ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user nextjs (UID/GID 10001)
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 nextjs

# Copy standalone build & static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Release version (the tag, set by CI on release builds; reported by /api/health). Declared after
# the copies so a new version does not invalidate the cached layers above.
ARG APP_VERSION=""
ENV APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.version=${APP_VERSION}

USER nextjs
EXPOSE 3000

# Curl-free readiness healthcheck using Node.js built-in HTTP client. Hits
# /api/ready (checks Postgres + Valkey connectivity), not /api/health (pure
# liveness, always 200), so this actually reports an outage.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/ready', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
