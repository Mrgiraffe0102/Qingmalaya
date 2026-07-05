# syntax=docker/dockerfile:1
#
# Multi-stage Dockerfile for the Qing Malaya NestJS backend (apps/server).
#
# Build context must be the repository root so pnpm can resolve the workspace.
# Usage in docker-compose:
#   build:
#     context: .
#     dockerfile: apps/server/Dockerfile

# ----------------------------------------------------------------------------
# Stage 1 — Builder
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Native build tools are included as a fallback for bcrypt / prisma engines
# in case a prebuilt binary is unavailable for musl.
RUN apk add --no-cache python3 make g++ openssl

# Enable pnpm (pinned to the version declared in the root package.json).
RUN npm install -g pnpm@10.33.0

WORKDIR /app

# Copy workspace manifests first for better Docker layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/

# Install all workspace dependencies (frozen — must match pnpm-lock.yaml).
RUN pnpm install --frozen-lockfile

# Copy the source code needed to build shared + server.
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/

# Build the shared types package first (server imports its compiled output).
RUN pnpm --filter @qingmalaya/shared build

# Build the NestJS server (nest build → dist/).
RUN pnpm --filter @qingmalaya/server build

# Generate the Prisma client into node_modules.
RUN pnpm --filter @qingmalaya/server prisma:generate

# ----------------------------------------------------------------------------
# Stage 2 — Runner
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner

# openssl: needed by the Prisma engine binary.
# libstdc++: runtime dependency for bcrypt's native addon.
RUN apk add --no-cache openssl libstdc++

WORKDIR /app

# Copy the pnpm node_modules trees. With BuildKit (default on Docker 23+),
# COPY preserves symlinks so the pnpm .pnpm-store layout stays intact.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/packages/shared ./packages/shared

# Copy the compiled server, Prisma schema, and package.json (for npx).
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

WORKDIR /app/apps/server

# Directory for uploaded podcast covers / audio files (mounted as a volume).
RUN mkdir -p /app/uploads

EXPOSE 3000

# Apply pending Prisma migrations, then start the NestJS server.
# `prisma migrate deploy` is a no-op when no migration files exist yet.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
