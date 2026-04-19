# Backend walkthrough

## Folder structure (`backend/src/`)

```
src/
  app.ts                 # Express factory: middleware + routes + Swagger + error handler
  server.ts              # HTTP + Socket.IO bootstrap, Redis fan-out subscriber start
  worker.ts              # Worker entry: tight loop calling runJobCycle
  openApiDocument.ts     # Swagger document (subset of routes)
  config/env.ts          # Zod schema for process.env
  lib/prisma.ts          # PrismaClient singleton
  middlewares/
    authMiddleware.ts    # JWT bearer → req.userId / req.user
    validate.ts          # Zod body/query attach to req
    rateLimiter.ts       # express-rate-limit on auth routes
    errorHandler.ts      # Maps domain errors to HTTP status
  modules/
    auth/
    users/
    conversations/
    messages/
    notifications/
    queue/
    redis/
    socket/
    worker/
    ops/
  utils/
    apiResponse.ts       # ok() / fail() JSON helpers
    errors.ts            # AppError hierarchy
    logger.ts            # Pino logger
```

---

## HTTP routing (`app.ts`)

| Mount path | Router file | Notes |
|------------|-------------|--------|
| `/api/auth` | `auth/auth.routes.ts` | Public register/login; `GET /me` protected |
| `/api/users` | `users/users.routes.ts` | All routes behind `authMiddleware` |
| `/api/conversations` | `conversations/conversation.routes.ts` | CRUD + nested messages |
| `/api/messages` | `messages/message.routes.ts` | Send + patch delivered/read |
| `/api/notifications` | `notifications/notification.routes.ts` | List, read, test-failure |
| `/api` | `ops/ops.routes.ts` | `/health` public; `/metrics`, `/dlq` JWT |

Swagger UI: `/api/docs` (serves `openApiDocument.ts`).

---

## Controllers and services

Pattern: **route** → **validate** (optional) → **authMiddleware** → **controller** (thin) → **service** (Prisma + domain rules).

Examples:

- **`auth.controller.ts`** → `auth.service.ts` (`registerUser`, `loginUser`, `getMe`).
- **`conversation.controller.ts`** → `conversation.service.ts` (`createOrGetDirect`, `createGroup`, `listConversations`, …).
- **`message.controller.ts`** → `message.service.ts` (`sendMessage`, `listMessagesPaginated`, `markDelivered`, `markRead`).

There is **no separate repository layer**; Prisma calls live in services. This keeps the sample small; a larger codebase might introduce repositories.

---

## Middleware

| File | Behavior |
|------|----------|
| `authMiddleware.ts` | Requires `Authorization: Bearer <jwt>`, verifies with `env.JWT_SECRET`, loads user, sets `req.userId`. |
| `validate.ts` | Runs Zod schema from route; attaches `req.validatedBody` / `req.validatedQuery` (or similar per route wiring—see route files). |
| `rateLimiter.ts` | Stricter limits on `/register` and `/login` to reduce brute force. |
| `errorHandler.ts` | Catches thrown `AppError` subclasses → JSON `{ success: false, message, errors }`. |

---

## Socket server (`server.ts` + `socket/socket.handlers.ts`)

- **Auth**: `io.use` reads JWT from `socket.handshake.auth.token` or `Authorization` header (mirrors REST).
- **On connection**: marks user online in Prisma, `addUserSession`, joins `user:<userId>`, emits `user:online` to each conversation the user belongs to (via `publishFanout`).
- **Events**: `conversation:join` / `leave`, `message:send` (optional path—UI uses REST), `message:delivered`, `message:read`, `typing:start` / `stop`, `presence:update`, disconnect cleanup.

Socket server reference is also stored via `socketRegistry.ts` for code that needs `io` outside handlers (if extended).

---

## Queue and worker

- **`queue/getQueueProvider.ts`**: Returns `LocalQueueProvider` or `SQSQueueProvider` based on `QUEUE_PROVIDER` env.
- **`LocalQueueProvider.enqueue`**: Inserts `QueueJob` with `availableAt` (supports delayed start via `delayMs` option).
- **`worker/jobProcessor.ts`**:
  - `claimNextJob`: single-statement `UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED)` to claim one `PENDING` job due for work.
  - `processClaimedJob`: dispatches by `job.type` (currently only `PROCESS_NOTIFICATION`), marks `COMPLETED`, or schedules retry / DLQ.

Worker **does not** run Socket.IO or Express; it only touches Postgres (+ Redis if extended).

---

## Redis modules

| File | Purpose |
|------|---------|
| `redis/redisClient.ts` | `ioredis` client + `duplicate()` subscriber connection |
| `redis/chatEventBus.ts` | `publishFanout`, `attachSocketServer`, `startFanoutSubscriber` — parses JSON envelope and `io.to(room).emit(event, payload)` |
| `redis/presence.service.ts` | Session counters, conversation room membership sets in Redis for “should we notify?” heuristics |

---

## Config (`config/env.ts`)

Validates: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (min 8 chars), `PORT`, `CORS_ORIGIN`, queue tuning, optional AWS fields for SQS mode.

---

## End-to-end: sending a message via REST

1. **Client** `POST /api/messages` with `{ conversationId, content }` and bearer token.
2. **`message.routes.ts`** → `authMiddleware` → `validateBody(sendMessageSchema)`.
3. **`message.controller.ts` `send`** → `message.service.sendMessage`.
4. **`sendMessage`**:
   - `assertConversationMember`.
   - Transaction: `message.create`, `conversation.update` (`updatedAt`), `conversationParticipant.updateMany` increment unread for others.
   - Build `payload` for socket.
   - Load participants; **`Promise.all` of `publishFanout`** to `user:<participantId>` with event `message:new` (see `message.service.ts` — this is how recipients get updates when not in `conversation:*` room).
   - `dispatchMessageSideEffects` (non-blocking `void` + `.catch` log).
5. **Redis subscriber** (same or another API process) receives envelope, emits to local sockets in `user:<id>` rooms.
6. **Response** returns full Prisma message row as JSON `data`.

---

## Where validation happens

- **Zod** in `*.validation.ts` files (e.g. `message.validation.ts`, `conversation.validation.ts`, `auth.validation.ts`).
- **Route wiring** via `middlewares/validate.ts` `validateBody` / `validateQuery`.

---

## Where persistence happens

All in **Prisma** calls inside `*.service.ts` files, plus raw SQL in `jobProcessor.ts` for job claiming.

---

## Where Pub/Sub and notifications happen

- **Pub/Sub**: `publishFanout` in `redis/chatEventBus.ts`, invoked from `message.service.ts`, `message.service` receipt methods, `notification.service.ts` (`emitNotificationSocket`), `socket.handlers.ts` (typing, user online/offline), `conversation.service.ts` for some participant events.
- **Notification creation**: `notificationPipeline.service.ts`, `notification.service.ts` (`createNotification`), `notifyAddedToGroup` in pipeline file.
