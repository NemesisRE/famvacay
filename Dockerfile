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
FROM node:26-alpine AS deps
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
FROM node:26-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN npm install -g corepack && corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client
RUN pnpm exec prisma generate

# Build Next.js in standalone mode
RUN pnpm run build

# Under pnpm's isolated node_modules, Prisma generates the client (including
# the query engine binary) directly inside @prisma/client's own package
# directory rather than a separate node_modules/.prisma -- and node_modules/
# @prisma is a symlink into the content-addressable .pnpm store, which the
# runner stage below cannot follow (it only copies this one subpath, not the
# whole store). Dereference it into real files so that targeted COPY --from
# has something to copy. (Do not set the Prisma Client generator's `output`
# field to force the classic node_modules/.prisma/client layout instead --
# that breaks TypeScript's "bundler" module resolution for the generated
# types under pnpm, intermittently, depending on install freshness.)
RUN mkdir -p /app/.prisma-deploy/node_modules && \
    cp -rL node_modules/@prisma /app/.prisma-deploy/node_modules/@prisma

# ------------------------------------------------------------------------------
# Stage 3: Migrator (Dedicated one-shot container for database migrations)
# ------------------------------------------------------------------------------
FROM node:26-alpine AS migrator
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN npm install -g corepack && corepack enable

# Non-root user nextjs (UID/GID 10001) matching runner and k8s securityContext
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 nextjs

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install && pnpm install --frozen-lockfile --prod --ignore-scripts
RUN pnpm add -g prisma@6.19.3

COPY --chown=nextjs:nodejs prisma ./prisma/

USER nextjs
ENTRYPOINT ["prisma"]
CMD ["migrate", "deploy"]

# ------------------------------------------------------------------------------
# Stage 4: Runner (Target size < 150MB, read-only root compatible)
# ------------------------------------------------------------------------------
FROM node:26-alpine AS runner
WORKDIR /app

# Only openssl required by Prisma client runtime
RUN apk add --no-cache openssl

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
COPY --from=builder --chown=nextjs:nodejs /app/.prisma-deploy/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000

# Curl-free readiness healthcheck using Node.js built-in HTTP client. Hits
# /api/ready (checks Postgres + Valkey connectivity), not /api/health (pure
# liveness, always 200), so this actually reports an outage.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/ready', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
