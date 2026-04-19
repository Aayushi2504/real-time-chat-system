# Real-Time Chat & Notification System

A production-style full-stack chat application that combines **REST + WebSockets**, **PostgreSQL** with cursor-based pagination, **Redis Pub/Sub** for multi-instance fan-out, and an **async notification pipeline** with retries and a dead-letter queue (DLQ)—designed to read like a small product, not a toy CRUD demo.

---

## One-paragraph summary

Users authenticate with JWT-backed accounts, participate in **direct** or **group** conversations, send persisted messages with delivery/read signals, and receive **in-app notifications** when they are offline or not actively viewing a thread. The API is **Express + Prisma**; real-time updates use **Socket.IO**; **Redis** broadcasts events so every API instance can emit to its own sockets; a separate **worker** drains a database-backed queue with **exponential backoff** and **DLQ** for fault-tolerant side effects.

---

## Major features

| Area | What you get |
|------|----------------|
| **Auth** | Register, login, JWT bearer for REST and Socket.IO handshake |
| **Messaging** | Text messages, status (`SENT` → `DELIVERED` → `READ`), real-time push to all participants |
| **Conversations** | Direct (deduplicated pair key) and groups; list, detail, add/remove participants (groups) |
| **Real-time** | `message:new`, typing, presence (online/offline fan-out), receipt updates |
| **Notifications** | In-app rows + socket push + queued processing; mention parsing in groups; DLQ demo endpoint |
| **Ops** | Health, metrics (counts + Redis ping), authenticated DLQ listing |
| **UI** | React dashboard: sidebar, chat pane, composer, typing line, dark theme (`api.ts` also exposes notification helpers for Swagger/curl or future UI) |

---

## Architecture (high level)

```mermaid
flowchart LR
  subgraph clients [Clients]
    FE[React SPA]
  end
  subgraph edge [Edge]
    NG[Optional Nginx]
  end
  subgraph app [Application tier]
    API[Express + Socket.IO]
    W[Worker process]
  end
  subgraph data [Data tier]
    PG[(PostgreSQL)]
    RD[(Redis)]
  end
  FE -->|REST / WS| API
  FE --> NG
  NG --> API
  API --> PG
  API --> RD
  W --> PG
  API -.->|enqueue| PG
```

- **Deep dives:** [`docs/02-architecture.md`](docs/02-architecture.md), [`docs/06-realtime-flow.md`](docs/06-realtime-flow.md), [`docs/07-notification-queue-retries-dlq.md`](docs/07-notification-queue-retries-dlq.md)

---

## Tech stack

| Layer | Technologies |
|--------|--------------|
| **Frontend** | React 19, TypeScript, Vite, React Router, Axios, Socket.IO client, Tailwind, Vitest |
| **Backend** | Node 22, Express, Socket.IO, Prisma, PostgreSQL, Redis (ioredis), JWT, bcrypt, Zod, Pino, Helmet, express-rate-limit |
| **Queue** | `LocalQueueProvider` (Postgres `QueueJob`) or `SQSQueueProvider` scaffold |
| **Infra** | Docker Compose (Postgres, Redis, backend, worker, frontend, nginx) |

---

## Screenshots

_Add screenshots of login, dashboard with two chats, typing indicator, and notifications/DLQ demo here for portfolio pages._

---

## Quick start (Docker)

From the `chat-system` directory:

```bash
cp .env.example .env   # adjust secrets for anything beyond local demo
docker compose up --build -d
```

| URL | Purpose |
|-----|---------|
| http://localhost:4000 | API + Socket.IO + Swagger `/api/docs` |
| http://localhost:3000 | Static frontend (built SPA) |
| http://localhost:8080 | Nginx: `/api`, `/socket.io`, `/` |

Seed users (host must reach Postgres; port `5432` if mapped):

```bash
cd backend
DATABASE_URL=postgresql://chat:chatsecret@localhost:5432/chatdb?schema=public npx prisma migrate deploy
npm run prisma:seed
```

Demo accounts: `alice@example.com`, `bob@example.com`, `carol@example.com` — password **`Password123!`**.

---

## Local development (no Docker)

See **[`docs/11-local-setup-and-running.md`](docs/11-local-setup-and-running.md)** for prerequisites, env files, and multi-terminal layout.

Short version: run Postgres + Redis, `backend` with `npm run dev`, `worker` with `npm run worker`, `frontend` with `npm run dev` (Vite proxies `/api` and `/socket.io`).

---

## Testing

```bash
# Backend (requires DATABASE_URL, REDIS_URL, JWT_SECRET)
cd backend && npx prisma migrate deploy && npm test

# Frontend
cd frontend && npm test
```

Details: **[`docs/12-testing-and-debugging.md`](docs/12-testing-and-debugging.md)**.

---

## Documentation index

Full table of contents: **[`docs/README.md`](docs/README.md)**.

| Doc | Topic |
|-----|--------|
| [01-project-overview.md](docs/01-project-overview.md) | Problem, users, workflows, interview summaries |
| [02-architecture.md](docs/02-architecture.md) | System design, diagrams, module responsibilities |
| [03-backend-walkthrough.md](docs/03-backend-walkthrough.md) | Backend structure and request paths |
| [04-frontend-walkthrough.md](docs/04-frontend-walkthrough.md) | UI, state, sockets, chat UX |
| [05-database-schema.md](docs/05-database-schema.md) | Prisma models, indexes, pagination |
| [06-realtime-flow.md](docs/06-realtime-flow.md) | Socket.IO, rooms, Redis fan-out |
| [07-notification-queue-retries-dlq.md](docs/07-notification-queue-retries-dlq.md) | Queue, worker, DLQ, SQS mapping |
| [08-authentication-and-security.md](docs/08-authentication-and-security.md) | JWT, hashing, CORS, limits |
| [09-api-reference.md](docs/09-api-reference.md) | REST endpoints |
| [10-socket-events.md](docs/10-socket-events.md) | Socket event catalog |
| [11-local-setup-and-running.md](docs/11-local-setup-and-running.md) | Runbooks |
| [12-testing-and-debugging.md](docs/12-testing-and-debugging.md) | Tests, manual scenarios, debug |
| [13-deployment-and-docker.md](docs/13-deployment-and-docker.md) | Dockerfiles, compose, prod notes |
| [14-performance-and-scalability.md](docs/14-performance-and-scalability.md) | Scale story |
| [15-tradeoffs-and-future-improvements.md](docs/15-tradeoffs-and-future-improvements.md) | Tradeoffs, roadmap |
| [16-interview-prep.md](docs/16-interview-prep.md) | Questions, STAR, cheat sheet |
| [17-codebase-file-map.md](docs/17-codebase-file-map.md) | Where to look in code |
| [18-demo-script.md](docs/18-demo-script.md) | Live demo script |
| [19-common-bugs-and-fixes.md](docs/19-common-bugs-and-fixes.md) | Troubleshooting |
| [20-cheat-sheet.md](docs/20-cheat-sheet.md) | One-page revision |

---

## Why this project is strong (engineering lens)

1. **Split real-time from durable state** — Messages are authoritative in Postgres; sockets are a cache invalidation / push layer, with Redis bridging processes.
2. **Horizontal fan-out** — `publishFanout` + subscriber in `server.ts` avoids “only the instance that handled HTTP knows about the socket.”
3. **At-least-once style async work** — Queue jobs with retries and DLQ mirror how production systems isolate flaky downstream work.
4. **Keyset pagination** — Message history uses cursor + composite index, not naive `OFFSET`.
5. **Clear module boundaries** — Auth, conversations, messages, notifications, queue, redis, socket, worker are separable concerns.

---

## How to explain this project in an interview

**One sentence (recruiter):** “It’s a Slack-style chat app where messages save to a database, appear instantly through WebSockets, and if you’re not looking at the chat you still get updated through the same connection; background jobs handle notification processing with retries.”

**One sentence (engineer):** “Express + Prisma API with Socket.IO, Redis Pub/Sub for cross-node fan-out to rooms, Postgres with cursor pagination, and a worker consuming a DB-backed queue with exponential backoff and DLQ—structured so an SQS swap is mostly the queue provider.”

**If they ask “what did you learn?”:** Mention sticky sessions vs Redis fan-out, why queues beat synchronous push in the request path, and tradeoffs of JWT in `localStorage` for a demo vs cookies in production.

---

## License

MIT (sample / portfolio use).
