# Local setup and running

## Prerequisites

- **Node.js 22+** (matches Dockerfiles)
- **PostgreSQL 16+**
- **Redis 7+**
- **Docker + Docker Compose** (optional all-in-one path)

---

## Repository layout reminder

Root folder: **`chat-system/`** containing `backend/`, `frontend/`, `docker-compose.yml`, `.env.example`.

---

## Environment files

| File | Used by |
|------|---------|
| **`chat-system/.env.example`** | Docker Compose variable substitution (copy to `.env`) |
| **`backend/.env.example`** | Local `npm run dev` / tests when not using Compose |

Minimum variables: **`DATABASE_URL`**, **`REDIS_URL`**, **`JWT_SECRET`** (≥ 8 chars).

For Vite dev with proxy, **`frontend/.env.example`**: leave `VITE_API_URL` / `VITE_SOCKET_URL` **empty** so browser hits same origin (`:5173`) and Vite proxies to `:4000`. Optionally set **`VITE_PROXY_TARGET`** if API is not on localhost:4000.

---

## Database setup (local Postgres)

```bash
createdb chatdb   # or use Docker only for Postgres
cd backend
cp .env.example .env
# edit DATABASE_URL → postgresql://user:pass@localhost:5432/chatdb?schema=public
npx prisma migrate deploy   # or migrate dev for iterative dev
npm run prisma:seed         # demo users + sample conversations
```

---

## Run backend API + Socket.IO

```bash
cd backend
npm install
npm run dev        # tsx watch src/server.ts
```

Default listens on **`PORT`** from env (4000).

**Swagger:** http://localhost:4000/api/docs

---

## Run worker (separate terminal)

```bash
cd backend
npm run worker
```

Without the worker, **notifications stay `PENDING`** and jobs remain queued.

---

## Run frontend (Vite)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — proxied `/api` and `/socket.io` to backend.

---

## Run everything with Docker

From **`chat-system/`**:

```bash
cp .env.example .env
docker compose up --build -d
```

| Service | Port | Role |
|---------|------|------|
| postgres | 5432 | Data |
| redis | 6379 | Pub/Sub + presence |
| backend | 4000 | API + Socket.IO + migrations on boot |
| worker | (none) | Queue consumer |
| frontend | 3000 | Static SPA in nginx container |
| nginx | 8080 | Routes `/api`, `/socket.io`, `/` |

**Seed from host** (Postgres exposed):

```bash
cd backend
DATABASE_URL=postgresql://chat:chatsecret@localhost:5432/chatdb?schema=public npx prisma migrate deploy
npm run prisma:seed
```

Demo logins: **`alice@example.com`**, **`bob@example.com`**, **`carol@example.com`** / **`Password123!`**.

---

## Known local issues

| Symptom | Fix |
|---------|-----|
| `Invalid environment configuration` | Set required env vars; check Zod schema in `config/env.ts` |
| Frontend calls wrong API host | Set `VITE_API_URL` / `VITE_SOCKET_URL` for production build; use proxy for dev |
| Socket connects but 401 | Token expired or not passed in `auth`; re-login |
| Migrations pending | `npx prisma migrate deploy` inside backend container or host |
| Worker does nothing | `QUEUE_PROVIDER=local`, DB reachable, jobs exist with `availableAt <= now` |
| CORS errors | Add browser origin to `CORS_ORIGIN` comma list |

---

## Optional: load test script

`backend/scripts/load-test-socket.mjs` — requires `SOCKET_URL` and `TOKEN` env vars (see root README).
