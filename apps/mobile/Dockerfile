# syntax=docker/dockerfile:1
#
# Multi-stage Dockerfile for the 万卷回响 mobile H5 app (apps/mobile).
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
# Use Debian slim (glibc) instead of Alpine (musl) because Taro 4.2's native
# binding @tarojs/binding does not publish a linux-x64-musl variant — only
# linux-x64-gnu. Alpine builds fail with "Cannot find module
# '@tarojs/binding-linux-x64-musl'" at build time.
FROM node:20-slim AS builder

# Use Aliyun mirror for Debian packages (much faster from China mainland).
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
        sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi

# Native build tools for bcrypt (server dependency compiled by node-gyp).
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*

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

# Build-time API + static origin. Override via:
#   docker build --build-arg API_BASE_URL=https://qhfzwjhx.cn/api \
#                   --build-arg STATIC_ORIGIN=https://qhfzwjhx.cn .
# or the `args:` block in docker-compose.yml. Defaults point at the local
# server so `docker compose build mobile` keeps working out of the box.
ARG API_BASE_URL=http://localhost:3000/api
ARG STATIC_ORIGIN=http://localhost:3000
ENV API_BASE_URL=$API_BASE_URL
ENV STATIC_ORIGIN=$STATIC_ORIGIN

# Copy source for shared + mobile.
# tsconfig.base.json is required because packages/shared/tsconfig.json
# `extends` it — without it `tsc` fails with TS5083 in the shared build.
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/mobile/ apps/mobile/

# Build shared types package.
RUN pnpm --filter @qingmalaya/shared build

# Increase Node.js heap limit — Taro/webpack can OOM on memory-constrained servers.
ENV NODE_OPTIONS=--max-old-space-size=4096

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
