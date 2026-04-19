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

<img width="1438" height="899" alt="image" src="https://github.com/user-attachments/assets/c88ad9a1-e7c2-4f57-a721-af14e1c6b912" />


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

## Testing

```bash
# Backend (requires DATABASE_URL, REDIS_URL, JWT_SECRET)
cd backend && npx prisma migrate deploy && npm test

# Frontend
cd frontend && npm test
