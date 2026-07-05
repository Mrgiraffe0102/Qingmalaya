# 清马拉雅 (Qingmalaya) — Campus Podcast Platform

A pnpm monorepo for a campus podcast platform with a NestJS backend, an Ant
Design Pro admin console, and a Taro 4 mobile H5 app.

```
apps/server   — NestJS backend (Prisma + MySQL, global prefix /api, port 3000)
apps/admin    — React 18 + Vite + Ant Design Pro (dev port 5174)
apps/mobile   — Taro 4.2 React H5 (dev port 10086)
packages/shared — Shared TypeScript types, enums, Zod schemas
```

---

## Prerequisites

| Tool           | Version  |
|----------------|----------|
| Docker         | 24+      |
| Docker Compose | v2+      |
| Node.js        | 20+      |
| pnpm           | 9+ (10.x recommended — matches `packageManager` in `package.json`) |

---

## Quick start (local development)

```bash
# 1. Start MySQL only
docker compose up -d mysql

# 2. Install workspace dependencies
pnpm install

# 3. Build the shared types package (required by server / admin / mobile)
pnpm --filter @qingmalaya/shared build

# 4. Apply database migrations + seed
pnpm --filter @qingmalaya/server prisma:migrate
pnpm --filter @qingmalaya/server prisma:seed

# 5. Start dev servers (in separate terminals)
pnpm dev:server   # http://localhost:3000/api
pnpm dev:admin    # http://localhost:5174
pnpm dev:mobile   # http://localhost:10086
```

The admin and mobile dev servers proxy `/api` requests to the local server
(see `apps/admin/vite.config.ts` and `apps/mobile/src/utils/request.ts`).

---

## Production deployment (Docker Compose)

A single command builds and starts every service:

```bash
docker compose up -d --build
```

This brings up four containers:

| Service | Container            | Image / build              | Host port | Container port |
|---------|----------------------|----------------------------|----------|----------------|
| mysql   | qingmalaya-mysql     | mysql:8.0                  | 3306     | 3306           |
| server  | qingmalaya-server    | `apps/server/Dockerfile`   | 3000     | 3000           |
| admin   | qingmalaya-admin     | `apps/admin/Dockerfile`    | 5174     | 80             |
| mobile  | qingmalaya-mobile    | `apps/mobile/Dockerfile`   | 10086    | 80             |

After the stack is up:

- **Admin console** — http://localhost:5174
- **Mobile H5** — http://localhost:10086
- **API** — http://localhost:3000/api
- **MySQL** — localhost:3306

The server container runs `npx prisma migrate deploy` before starting
`node dist/main.js`, so pending Prisma migrations are applied automatically
on every container start.

### Initial database setup

If you have not yet created Prisma migration files, create them first
(run once against the running MySQL container):

```bash
# Ensure MySQL is running
docker compose up -d mysql

# Generate the first migration from the schema
DATABASE_URL="mysql://qingmalaya:qingmalaya123@localhost:3306/qingmalaya" \
  pnpm --filter @qingmalaya/server exec prisma migrate dev --name init

# Seed initial data (users, tags, sample podcasts, etc.)
pnpm --filter @qingmalaya/server prisma:seed
```

For subsequent production deploys, `prisma migrate deploy` inside the server
container applies any new migration files automatically.

### Stopping the stack

```bash
docker compose down        # stop containers, keep data volume
docker compose down -v     # stop containers AND delete the MySQL data volume
```

---

## Default credentials

These are created by `apps/server/prisma/seed.ts`:

| Role          | Username (studentId) | Password    |
|---------------|----------------------|-------------|
| SUPER_ADMIN   | `admin`              | `admin123`  |
| OPERATOR      | `operator`           | `operator123` |

**Change these and the `JWT_SECRET` environment variable before exposing
the deployment to the public internet.**

---

## Architecture notes

### Admin (nginx)

The admin container uses a multi-stage build: the Vite SPA is compiled in a
`node:20-alpine` builder stage, then the static `dist/` is copied into an
`nginx:alpine` image. The bundled `apps/admin/nginx.conf` serves the SPA
with an `index.html` fallback for client-side routes and reverse-proxies
`/api/*` to the `server` service (preserving the `/api` prefix, which the
NestJS global prefix expects).

### Mobile (nginx)

The mobile container follows the same multi-stage pattern: Taro H5 build in
the builder stage, `nginx:alpine` serving `dist/` in the runner. The mobile
app currently hardcodes `API_BASE_URL = 'http://localhost:3000/api'` in
`apps/mobile/src/utils/request.ts`; when accessed from a browser on the same
host as the Docker deployment, API calls reach the server's published port
3000 directly. The bundled `apps/mobile/nginx.conf` includes an `/api`
proxy for future use if `API_BASE_URL` is switched to a relative path.

### Server (NestJS)

The server container uses a multi-stage build. The builder stage installs
all workspace dependencies with pnpm, builds the shared package, builds the
NestJS server, and generates the Prisma client. The runner stage copies
only the compiled `dist/`, `node_modules`, and `prisma/` directory. The
upload directory (`/app/uploads`) is mounted as a bind volume so uploaded
podcast covers and audio files persist across container restarts.

---

## Environment variables

The server reads configuration from environment variables (validated by
`appConfig()`). In Docker Compose these are set in the `server` service
definition. For local development they live in `apps/server/.env`.

| Variable             | Default (compose)                                              | Description                          |
|----------------------|----------------------------------------------------------------|--------------------------------------|
| `DATABASE_URL`       | `mysql://qingmalaya:qingmalaya123@mysql:3306/qingmalaya`       | MySQL connection string              |
| `JWT_SECRET`         | `change-me-in-production-please`                               | JWT signing secret                   |
| `JWT_ACCESS_TTL`     | `2h`                                                           | Access token lifetime                |
| `JWT_REFRESH_TTL`    | `7d`                                                           | Refresh token lifetime               |
| `UPLOAD_DIR`         | `/app/uploads`                                                 | Directory for uploaded files         |
| `MAX_COVER_SIZE`     | `5242880` (5 MB)                                               | Max cover image size in bytes        |
| `MAX_AUDIO_SIZE`     | `209715200` (200 MB)                                           | Max audio file size in bytes         |
| `MAX_AUDIO_DURATION` | `3600` (60 min)                                                | Max audio duration in seconds        |
