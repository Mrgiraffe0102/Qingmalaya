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

RUN npm install -g pnpm@10.33.0

WORKDIR /app

# Copy workspace manifests first for layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# Copy source for shared + admin.
COPY packages/shared/ packages/shared/
COPY apps/admin/ apps/admin/

# Build shared types package (admin imports from its source via Vite alias,
# but we build it so the dist/ output is available for tsc resolution too).
RUN pnpm --filter @qingmalaya/shared build

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
