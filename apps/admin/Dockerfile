# syntax=docker/dockerfile:1
#
# Multi-stage Dockerfile for the 万卷回响 admin console (apps/admin).
# Builds the React + Vite static bundle, then serves it with nginx.
#
# Build context must be the repository root so pnpm can resolve the workspace.
# Usage in docker-compose:
#   build:
#     context: .
#     dockerfile: apps/admin/Dockerfile

# ----------------------------------------------------------------------------
# Stage 1 — Builder
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Use Aliyun mirror for Alpine packages (much faster from China mainland).
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories

# Native build tools are required because pnpm install pulls in server's
# bcrypt dependency, which has no prebuilt binary for Alpine musl and must
# be compiled from source by node-gyp.
RUN apk add --no-cache python3 make g++ openssl

# Use npmmirror.com (China mainland) for npm / pnpm.
ENV npm_config_registry=https://registry.npmmirror.com
# Node.js headers mirror for node-gyp (used by bcrypt to compile its native
# addon). The default unofficial-builds.nodejs.org is unreliable from China
# mainland — point node-gyp at the npmmirror binary proxy instead.
ENV NODEJS_ORG_MIRROR=https://registry.npmmirror.com/-/binary/node

RUN npm install -g pnpm@10.33.0

WORKDIR /app

# Copy workspace manifests first for layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Create .npmrc inline so the build doesn't depend on the hidden file
# being present in the build context (easy to miss when uploading).
RUN printf 'auto-install-peers=true\nstrict-peer-dependencies=false\nshamefully-hoist=true\n' > .npmrc
COPY apps/server/package.json apps/server/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# Copy source for shared + admin.
# tsconfig.base.json is required because packages/shared/tsconfig.json
# `extends` it — without it `tsc` fails with TS5083 in the shared build.
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/admin/ apps/admin/

# Build shared types package (admin imports from its source via Vite alias,
# but we build it so the dist/ output is available for tsc resolution too).
RUN pnpm --filter @qingmalaya/shared build

# Increase Node.js heap limit — Vite/Rollup can OOM on memory-constrained servers.
ENV NODE_OPTIONS=--max-old-space-size=4096

# Build the admin SPA (tsc && vite build → apps/admin/dist).
RUN pnpm --filter @qingmalaya/admin build

# ----------------------------------------------------------------------------
# Stage 2 — nginx serving static files
# ----------------------------------------------------------------------------
FROM nginx:alpine

# Remove the default nginx static site.
RUN rm -rf /usr/share/nginx/html/*

# Copy the built SPA bundle.
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

# Custom nginx config: SPA fallback + /api reverse proxy to the server service.
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
