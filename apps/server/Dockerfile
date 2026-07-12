# syntax=docker/dockerfile:1
#
# Multi-stage Dockerfile for the 万卷回响 NestJS backend (apps/server).
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

# Use Aliyun mirror for Alpine packages (much faster from China mainland).
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories

# Native build tools are included as a fallback for bcrypt / prisma engines
# in case a prebuilt binary is unavailable for musl.
RUN apk add --no-cache python3 make g++ openssl

# Use npmmirror.com (China mainland) for npm / pnpm.
ENV npm_config_registry=https://registry.npmmirror.com
# Prisma engine binary mirror (China mainland).
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
# Node.js headers mirror for node-gyp (used by bcrypt to compile its native
# addon). The default unofficial-builds.nodejs.org is unreliable from China
# mainland — point node-gyp at the npmmirror binary proxy instead.
ENV NODEJS_ORG_MIRROR=https://registry.npmmirror.com/-/binary/node

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
# tsconfig.base.json is required because packages/shared/tsconfig.json
# `extends` it — without it `tsc` fails with TS5083 in the shared build.
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/

# Build the shared types package first (server imports its compiled output).
RUN pnpm --filter @qingmalaya/shared build

# Generate the Prisma client into node_modules first — nest build needs the
# generated types (UserAction, Prisma.XxxGetPayload, etc.) to compile.
RUN pnpm --filter @qingmalaya/server prisma:generate

# Build the NestJS server (nest build → dist/).
RUN pnpm --filter @qingmalaya/server build

# ----------------------------------------------------------------------------
# Stage 2 — Runner
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Use Aliyun mirror for Alpine packages (much faster from China mainland).
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories

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
# tsconfig.json + tsconfig.base.json are needed for `npx ts-node prisma/seed.ts`
# — without them ts-node can't resolve `module: "commonjs"` and falls back to
# Node's ESM loader, which fails with ERR_UNKNOWN_FILE_EXTENSION for .ts files.
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/tsconfig.json ./apps/server/tsconfig.json
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

WORKDIR /app/apps/server

# Directory for uploaded podcast covers / audio files (mounted as a volume).
RUN mkdir -p /app/uploads

EXPOSE 3000

# Apply pending Prisma migrations, then start the NestJS server.
# `prisma migrate deploy` is a no-op when no migration files exist yet.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
