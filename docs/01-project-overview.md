# Project overview

## What problem this solves

Teams and individuals need **low-latency, persistent chat**: messages must be stored, ordered, and visible across devices and sessions, with optional **unread** semantics and **notifications** when someone is not actively looking at a thread. This repository implements a **credible subset** of that problem with direct messaging, group chat, read/delivery signals, and an async notification pipeline suitable for portfolio and interview discussion.

## Primary use case

- **Authenticated users** open a web dashboard, pick a conversation, send and receive messages in near real time, and see conversation previews / unread counts update even when another thread is selected.

## Who the users are (conceptually)

- **End users** of a messaging product (demo personas: Alice, Bob, Carol from `prisma/seed.ts`).
- **Operators / developers** inspecting health, metrics, and DLQ rows via REST (`ops` module).

## Main workflows

1. **Register / login** → JWT stored client-side → REST calls include `Authorization: Bearer` → Socket connects with `auth: { token }`.
2. **List conversations** → select one → HTTP loads recent messages (cursor pagination) + socket `conversation:join` for the open thread (typing, receipts, presence to that room).
3. **Send message** → `POST /api/messages` → Prisma transaction creates message, bumps `updatedAt`, increments others’ `unreadCount` → Redis fan-out `message:new` to **each participant’s** `user:<id>` room (so sidebar updates without being inside that conversation room) → optional notification pipeline for recipients who are offline or not in the conversation room.
4. **Mark delivered/read** (when viewing incoming traffic) → PATCH endpoints → fan-out receipt events to the conversation room.
5. **Notifications** → worker processes `QueueJob` rows; failures retry with backoff; exhausted retries → `DeadLetterJob`.

## What makes this more than basic CRUD

| Beyond CRUD | Where it shows up |
|-------------|-------------------|
| **Real-time** | Socket.IO + Redis Pub/Sub (`chatEventBus.ts`, `socket.handlers.ts`) |
| **Cross-instance fan-out** | Same envelope consumed on every Node process attached to `io` |
| **Durable async processing** | `QueueJob` + `jobProcessor.ts` + DLQ |
| **Concurrency-safe dequeue** | `FOR UPDATE SKIP LOCKED` in raw SQL |
| **Scalable history reads** | Cursor + composite index on `Message` |
| **Presence / typing** | Redis keys + conversation-scoped emits |

## Engineering challenges demonstrated

- Keeping **HTTP**, **WebSockets**, and **workers** consistent with one schema (Prisma).
- Avoiding **split-brain** sockets when scaling out (Redis channel).
- Separating **synchronous chat path** from **best-effort notification delivery** (queue).
- **UI correctness** with concurrent events (dedupe by `message.id`, merged join/listener effect in `DashboardPage.tsx`).

---

## “Baby explanation”

“When you send a chat message, it gets saved like email in a database so you never lose it. The server also shouts ‘new message!’ through the internet wire so the other person’s screen updates right away. If their computer was doing something else, they still get a little ping or badge. Some cleanup jobs run in the background so the main ‘send button’ never gets stuck.”

---

## Professional explanation

“The system is a React SPA on an Express API with Socket.IO. Messages are persisted in PostgreSQL with Prisma. Real-time delivery uses Socket.IO rooms; cross-process broadcasting uses Redis Pub/Sub so every API instance can emit to its local connections. Side effects for offline users are modeled as notification rows plus jobs in a Postgres-backed queue processed by a dedicated worker with exponential backoff and a dead-letter table after max retries.”

---

## Interview time-boxes

### ~30 seconds

“Full-stack real-time chat: React and Socket.IO client, Node/Express API, Postgres for history and users, Redis for pub/sub so multiple servers can push to the right sockets. There’s a worker that processes notification jobs with retries and a DLQ—similar to how you’d use SQS in production.”

### ~60 seconds

(Add to 30s) “Direct and group conversations, JWT auth on REST and sockets, cursor-based message pagination for performance, typing and presence, read receipts. Messages fan out to each user’s personal socket room so the conversation list updates even when that chat isn’t open. Notifications are decoupled: if you’re not in the room, we persist a notification row, push over the socket, and enqueue work the worker picks up with SKIP LOCKED–style claiming.”

### ~2 minutes

(Add to 60s) “Schema-wise, direct chats use a uniqueness table so two users only ever get one DM thread. Groups have participants and roles. The queue is abstracted behind `QueueProvider` with a local implementation and an SQS stub for migration stories. Docker Compose runs Postgres, Redis, API, worker, static frontend, and optional nginx. Tests cover registration, messaging, pagination, and DLQ behavior.”
