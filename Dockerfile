# ==============================================================================
# Multi-Stage, Multi-Arch Dockerfile for FamVacay
# Target architectures: linux/amd64, linux/arm64
# Base: Node.js 22 Active LTS Alpine (Node 20 is end-of-life)
# Stages: deps -> builder -> migrator -> runner
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies
# ------------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Builder
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js in standalone mode
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Migrator (Dedicated one-shot container for database migrations)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS migrator
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
RUN npm install -g prisma@5.22.0

COPY prisma ./prisma/

USER node
ENTRYPOINT ["prisma"]
CMD ["migrate", "deploy"]

# ------------------------------------------------------------------------------
# Stage 4: Runner (Target size < 150MB, read-only root compatible)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
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
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000

# Curl-free liveness healthcheck using Node.js built-in HTTP client
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
