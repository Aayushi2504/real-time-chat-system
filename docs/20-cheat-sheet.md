# One-page interview cheat sheet

## Elevator (20s)

Real-time chat (React + Socket.IO + Node + Postgres). Redis Pub/Sub fans out events across API instances. Queue worker retries notification jobs with DLQ—SQS-style pattern.

---

## Stack tokens

React 19 · Vite · Express · Socket.IO · Prisma · PostgreSQL · Redis · JWT · bcrypt · Zod · Docker

---

## Data model (one breath)

User, Conversation (DIRECT|GROUP), Participant (unread, lastRead), Message (status + cursor index), Notification, QueueJob, DeadLetterJob, DirectConversationKey (pair uniqueness).

---

## Hot paths (file names)

- Send message: **`message.service.ts`**
- Socket auth/events: **`socket.handlers.ts`**
- Redis emit bridge: **`chatEventBus.ts`**
- Worker claim/retry/DLQ: **`jobProcessor.ts`**
- When to notify: **`notificationPipeline.service.ts`**
- Main UI: **`DashboardPage.tsx`**

---

## Real-time rooms

- **`user:<id>`** — always joined on connect; **`message:new`** + **`notification:new`**
- **`conversation:<id>`** — joined when thread open; typing, receipts, presence to that thread

---

## Pagination

**Keyset** cursor = base64url `{ createdAt, id }` · index **`(conversationId, createdAt DESC)`**

---

## Queue math

Backoff **`min(1000 * 2^retry, 60000)`** ms · default **`maxRetries`** from env (5) · claim uses **`FOR UPDATE SKIP LOCKED`**

---

## Security tokens

JWT bearer REST + socket handshake · bcrypt cost **12** · Helmet + CORS + **auth rate limit 30/15min**

---

## Ports (Docker defaults)

**4000** API · **3000** SPA · **8080** nginx · **5432** PG · **6379** Redis

---

## Honest gaps (say if asked)

JWT in **localStorage** · **No** Socket.IO Redis adapter (Pub/Sub used) · **Notification list UI** not wired in dashboard (API exists) · **SQS** scaffold only

---

## “Why not just CRUD?”

Sockets + cross-process fan-out + async fault-tolerant worker + concurrency-safe queue + indexed cursor pagination.
