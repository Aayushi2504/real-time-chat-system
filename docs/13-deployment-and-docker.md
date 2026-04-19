# Deployment and Docker

## Docker Compose (`chat-system/docker-compose.yml`)

| Service | Image / build | Command | Depends on |
|---------|---------------|---------|------------|
| **postgres** | `postgres:16-alpine` | default | healthcheck |
| **redis** | `redis:7-alpine` | default | healthcheck |
| **backend** | `build: ./backend` | `npx prisma migrate deploy && node dist/server.js` | healthy postgres + redis |
| **worker** | same image as backend | `node dist/worker.js` | healthy DB/redis, backend started |
| **frontend** | `build: ./frontend` | nginx serves static `dist` | backend (ordering) |
| **nginx** | `nginx:alpine` | custom config volume | frontend + backend |

**Volumes:** named volume `pgdata` for Postgres durability across restarts.

---

## Backend Dockerfile (multi-stage)

1. **deps** — `npm install` production deps.
2. **build** — copy Prisma + TS sources, `prisma generate`, `npm run build` (tsc → `dist/`).
3. **runner** — copies `dist`, generated `.prisma` client subset, `prisma/` for migrations, **`CMD node dist/server.js`**.

**Note:** `runner` copies `node_modules` from deps stage—not a full prune—acceptable for demo; production images often use `npm ci --omit=dev` only.

---

## Frontend Dockerfile

1. **build** — `npm install`, `npm run build` (Vite). `ARG` for `VITE_API_URL` / `VITE_SOCKET_URL` baked at build time.
2. **stage-1** — `nginx:alpine` serves static files; tiny inline default server config for SPA fallback (`try_files … /index.html`).

**Implication:** changing API URL for a deployed static build requires **rebuild** with new build args.

---

## Nginx gateway (`nginx/nginx.conf`)

- **`/api/`** → upstream `backend:4000` with HTTP/1.1 + Upgrade headers (for consistency; REST doesn’t need upgrade).
- **`/socket.io/`** → same upstream, long read/send timeouts for WebSockets.
- **`/`** → static `frontend:80`.

---

## Environment variables (Compose)

Passed from **`.env`** in project root; defaults inlined in `docker-compose.yml` for dev convenience.

Key vars: **`DATABASE_URL`**, **`REDIS_URL`**, **`JWT_SECRET`**, **`CORS_ORIGIN`**, queue tuning, **`VITE_*`** build args for frontend service.

---

## Container networking

Services resolve each other by **Compose service name** (`postgres`, `redis`, `backend`, `frontend`). Browser **never** talks to `backend` hostname—only `localhost` ports published to host.

---

## Production changes (checklist)

| Area | Demo state | Production direction |
|------|------------|----------------------|
| **Secrets** | Default JWT in compose | Secrets manager, strong random JWT |
| **HTTPS** | HTTP localhost | TLS termination at LB or nginx |
| **DB** | Single Postgres container | RDS / Cloud SQL, backups, PITR |
| **Redis** | Single node | ElastiCache with TLS + AUTH |
| **Sockets** | One backend replica easy | Horizontal pods + **Redis adapter** + stickiness audit |
| **Frontend** | Static nginx | CDN + immutable assets |
| **Observability** | Pino to stdout | Centralized logs, metrics, traces |
| **Migrations** | On backend boot | Dedicated job / init container with backoff |

---

## Optional cloud sketches

- **AWS:** ECS services for `api`, `worker`, ALB/NLB front door, RDS, ElastiCache, S3+CloudFront for SPA.
- **GCP:** Cloud Run **only for HTTP** unless configuring session affinity; sockets often → GKE or Compute Engine with LB.

This project is intentionally **VM/container friendly** because of WebSockets + worker.
