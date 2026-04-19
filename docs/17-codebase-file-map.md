# Codebase file map

Quick navigation for interviews and onboarding. Paths relative to **`chat-system/`**.

---

## Root

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | All services, env defaults, ports |
| `.env.example` | Compose / local variable template |
| `nginx/nginx.conf` | Reverse proxy: `/api`, `/socket.io`, `/` |
| `README.md` | Polished overview + link to `/docs` |

---

## Backend — entry & app shell

| Path | Purpose |
|------|---------|
| `backend/src/server.ts` | HTTP server, Socket.IO, Prisma ping, fan-out subscriber start |
| `backend/src/app.ts` | Express middleware + route mounting + Swagger + error handler |
| `backend/src/worker.ts` | Worker process entry loop |
| `backend/src/openApiDocument.ts` | Swagger JSON subset |

---

## Auth

| Path | Purpose |
|------|---------|
| `backend/src/modules/auth/auth.routes.ts` | Register/login/me routes |
| `backend/src/modules/auth/auth.controller.ts` | HTTP handlers |
| `backend/src/modules/auth/auth.service.ts` | bcrypt + JWT + user lookup |
| `backend/src/modules/auth/auth.validation.ts` | Zod schemas |
| `backend/src/middlewares/authMiddleware.ts` | Bearer JWT for REST |

---

## Users & conversations

| Path | Purpose |
|------|---------|
| `backend/src/modules/users/users.*` | Search/list users |
| `backend/src/modules/conversations/conversation.*` | Create/list/get DM+group, participants |
| `backend/src/modules/conversations/conversation.service.ts` | Direct dedupe key, group creation |

---

## Messages

| Path | Purpose |
|------|---------|
| `backend/src/modules/messages/message.routes.ts` | POST send, PATCH delivered/read |
| `backend/src/modules/messages/message.controller.ts` | Thin controllers |
| `backend/src/modules/messages/message.service.ts` | **Core send**, pagination, receipts, **Redis fan-out** |
| `backend/src/modules/messages/message.validation.ts` | Zod |
| `backend/src/modules/messages/message.utils.ts` | Cursor encode/decode |

---

## Notifications & pipeline

| Path | Purpose |
|------|---------|
| `backend/src/modules/notifications/notification.service.ts` | CRUD + `emitNotificationSocket` |
| `backend/src/modules/notifications/notificationPipeline.service.ts` | **Who gets notified** + mention logic |
| `backend/src/modules/notifications/notification.controller.ts` | REST + **test-failure** enqueue |
| `backend/src/modules/notifications/notification.routes.ts` | Router |

---

## Queue & worker

| Path | Purpose |
|------|---------|
| `backend/src/modules/queue/getQueueProvider.ts` | Factory |
| `backend/src/modules/queue/LocalQueueProvider.ts` | DB enqueue |
| `backend/src/modules/queue/SQSQueueProvider.ts` | Scaffold |
| `backend/src/modules/queue/queue.types.ts` | `JOB_TYPES`, payload types |
| `backend/src/modules/worker/jobProcessor.ts` | **Claim, process, retry, DLQ** |

---

## Redis & sockets

| Path | Purpose |
|------|---------|
| `backend/src/modules/redis/redisClient.ts` | ioredis + duplicate subscriber |
| `backend/src/modules/redis/chatEventBus.ts` | **publishFanout**, subscriber → `io.to().emit` |
| `backend/src/modules/redis/presence.service.ts` | Session + conv room membership keys |
| `backend/src/modules/socket/socket.handlers.ts` | **All socket events**, connection auth |
| `backend/src/modules/socket/socketRegistry.ts` | Optional `io` reference |

---

## Ops & infra code

| Path | Purpose |
|------|---------|
| `backend/src/modules/ops/ops.routes.ts` | `/health`, `/metrics`, `/dlq` |
| `backend/src/modules/ops/ops.controller.ts` | Implementations |
| `backend/prisma/schema.prisma` | **All models** |
| `backend/prisma/seed.ts` | Demo data |
| `backend/prisma/migrations/*` | Schema history |

---

## Frontend — chat & auth

| Path | Purpose |
|------|---------|
| `frontend/src/pages/DashboardPage.tsx` | **Main UI**: sidebar, messages, composer, sockets, typing |
| `frontend/src/hooks/useAuth.tsx` | Auth state + **connectSocket** |
| `frontend/src/services/api.ts` | Axios + all REST helpers |
| `frontend/src/services/socket.ts` | Socket.IO singleton |
| `frontend/src/App.tsx` | Routes + private wrapper |
| `frontend/src/types/index.ts` | Shared TS types |
| `frontend/src/lib/formatChatTime.ts` | Time formatting |
| `frontend/src/components/Avatar.tsx` | Avatar UI |

---

## Tests

| Path | Purpose |
|------|---------|
| `backend/tests/chat.api.test.ts` | Integration: auth, messages, pagination, DLQ |
| `backend/tests/setup.ts` | Test bootstrap |
| `frontend/src/pages/LoginPage.test.tsx` | Example Vitest |

---

## Config & middleware

| Path | Purpose |
|------|---------|
| `backend/src/config/env.ts` | Zod env |
| `backend/src/middlewares/validate.ts` | Zod hook |
| `backend/src/middlewares/errorHandler.ts` | Global errors |
| `backend/src/middlewares/rateLimiter.ts` | Auth rate limit |
| `backend/src/utils/errors.ts` | AppError classes |
| `backend/src/utils/apiResponse.ts` | JSON helpers |

---

## Typing indicator logic (quick jump)

- **Server:** `socket.handlers.ts` → `typing:start` / `typing:stop` → `publishFanout` to `conversation:<id>`.
- **Client:** `DashboardPage.tsx` → composer `onChange` debounce + socket handlers `onTypingStart` / `onTypingStop`.

---

## Docker / deployment

| Path | Purpose |
|------|---------|
| `backend/Dockerfile` | Multi-stage API/worker image |
| `frontend/Dockerfile` | Vite build + nginx serve |
