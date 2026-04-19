# Architecture

## Full system overview

```mermaid
flowchart TB
  subgraph client [Browser]
    REACT[React SPA]
    SOCK_C[Socket.IO client]
    REACT --- SOCK_C
  end
  subgraph node [Node processes]
    HTTP[Express HTTP]
    IO[Socket.IO server]
    SUB[Redis subscriber]
    HTTP --- IO
    SUB --> IO
  end
  subgraph worker_proc [Worker process]
    WK[jobProcessor loop]
  end
  subgraph redis [Redis]
    PUBSUB[Pub/Sub channel chat:fanout:v1]
    KEYS[Presence keys SETs / INCR]
  end
  subgraph pg [PostgreSQL]
    T_USERS[User / Conversation / Message / ...]
    T_QUEUE[QueueJob / DeadLetterJob / Notification]
  end
  REACT -->|REST| HTTP
  SOCK_C <-->|WS| IO
  HTTP --> pg
  WK --> pg
  IO -->|publish| PUBSUB
  SUB -->|subscribe| PUBSUB
  IO --> KEYS
  WK --> redis
```

**Relationship summary**

| Piece | Role |
|-------|------|
| **React** | Auth UI, dashboard, REST via Axios, sockets via `socket.ts` |
| **Express** | REST routes under `/api/*`, JSON body, Zod validation, JWT middleware |
| **Socket.IO** | Attached to same HTTP server in `server.ts`; shares Redis with REST |
| **PostgreSQL** | Source of truth for users, conversations, messages, notifications, jobs, DLQ |
| **Redis** | Pub/Sub fan-out channel + ephemeral presence/session keys |
| **Worker** | Separate entry `worker.ts`; polls `QueueJob`, no HTTP server |

---

## Why this architecture

| Decision | Reason |
|----------|--------|
| **Monorepo services in Compose** | Easy demo; mirrors splitting API vs worker in prod |
| **Redis Pub/Sub vs only Socket.IO Redis adapter** | Explicit envelope format; every instance runs identical subscriber code (`chatEventBus.ts`) |
| **Queue in Postgres (local)** | Zero AWS dependency for CI/demo; same job shape as SQS migration |
| **JWT** | Stateless auth for horizontal API replicas (with known cookie tradeoffs for prod) |

---

## Request / response flow (REST)

```mermaid
sequenceDiagram
  participant C as Client
  participant E as Express
  participant M as authMiddleware
  participant V as Zod validate
  participant S as Service
  participant P as Prisma
  C->>E: HTTP /api/...
  E->>M: Bearer JWT
  M->>P: load user by sub
  M->>E: req.userId
  E->>V: body/query
  V->>S: validated input
  S->>P: queries / transactions
  P-->>S: rows
  S-->>E: domain result
  E-->>C: JSON success envelope
```

Standard envelope: `{ success: true, message: string, data: T }` from `utils/apiResponse.ts`. Errors flow through `middlewares/errorHandler.ts`.

---

## Real-time flow (conceptual)

```mermaid
sequenceDiagram
  participant C as Client
  participant IO as Socket.IO
  participant SVC as message.service
  participant R as Redis publish
  participant SUB as Fanout subscriber
  C->>IO: connect auth JWT
  IO->>IO: join user:userId
  C->>IO: conversation:join
  IO->>IO: join conversation:id
  C->>IO: REST send message optional
  Note over C,SVC: Or socket message:send same service path
  C->>SVC: POST /api/messages
  SVC->>SVC: transaction + publishFanout
  SVC->>R: message:new per participant user room
  R->>SUB: envelope
  SUB->>IO: io.to(room).emit
  IO-->>C: message:new
```

---

## Async notification flow

1. `sendMessage` completes DB work, then `void dispatchMessageSideEffects(...)` (`notificationPipeline.service.ts`).
2. For each **other** participant: if **not** (online **and** in conversation room Redis set), create `Notification`, `emitNotificationSocket` → fan-out `notification:new` to `user:<id>`, `queue.enqueue(PROCESS_NOTIFICATION)`.
3. Worker claims job → marks notification `SENT` (or fails → retry / DLQ).

---

## Major modules (backend `src/`)

| Path | Responsibility |
|------|----------------|
| `config/env.ts` | Zod-validated environment |
| `app.ts` | Express app, middleware, route mounting |
| `server.ts` | HTTP server, Socket.IO, `attachSocketServer`, `startFanoutSubscriber` |
| `modules/auth/*` | Register, login, JWT, rate limit on auth routes |
| `modules/users/*` | Search + list users for starting chats |
| `modules/conversations/*` | Direct/group CRUD, participants |
| `modules/messages/*` | Send, list with cursor, mark delivered/read |
| `modules/notifications/*` | List/mark read, test failure enqueue |
| `modules/redis/*` | Client, subscriber duplicate, chat fan-out, presence helpers |
| `modules/socket/*` | Socket auth, room join/leave, typing, message socket handlers |
| `modules/queue/*` | Provider abstraction + local + SQS stub |
| `modules/worker/jobProcessor.ts` | Claim, process, retry, DLQ |
| `modules/ops/*` | Health, metrics, DLQ list |

---

## Modularity and scaling story

- **API replicas**: Add instances behind a TCP-aware load balancer; enable Socket.IO **Redis adapter** if you rely on in-memory rooms across hosts (this project also uses explicit Pub/Sub for envelopes—see tradeoffs doc).
- **Worker replicas**: `SKIP LOCKED` reduces double processing; tune `WORKER_POLL_INTERVAL_MS`.
- **Postgres**: Read replicas for history; primary for writes (not implemented—document as future).

---

## Architecture diagram (deployment)

```mermaid
flowchart LR
  subgraph compose [Docker Compose]
    PG[(postgres:5432)]
    RD[(redis:6379)]
    BE[backend:4000]
    WK[worker]
    FE[frontend:80]
    NX[nginx:8080]
  end
  U[User browser] --> NX
  NX --> FE
  NX --> BE
  BE --> PG
  BE --> RD
  WK --> PG
  WK --> RD
```

This matches `docker-compose.yml` in the repository root.
