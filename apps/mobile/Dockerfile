# syntax=docker/dockerfile:1
#
# Multi-stage Dockerfile for the Qing Malaya mobile H5 app (apps/mobile).
# Builds the Taro H5 static bundle, then serves it with nginx.
#
# Build context must be the repository root so pnpm can resolve the workspace.
# Usage in docker-compose:
#   build:
#     context: .
#     dockerfile: apps/mobile/Dockerfile

# ----------------------------------------------------------------------------
# Stage 1 — Builder
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN npm install -g pnpm@10.33.0

WORKDIR /app

# Copy workspace manifests first for layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# Copy source for shared + mobile.
COPY packages/shared/ packages/shared/
COPY apps/mobile/ apps/mobile/

# Build shared types package.
RUN pnpm --filter @qingmalaya/shared build

# Build the Taro H5 bundle (taro build --type h5 → apps/mobile/dist).
RUN pnpm --filter @qingmalaya/mobile build:h5

# ----------------------------------------------------------------------------
# Stage 2 — nginx serving static files
# ----------------------------------------------------------------------------
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

# Copy the built H5 bundle.
COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html

# Custom nginx config with SPA fallback and /api proxy.
COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
