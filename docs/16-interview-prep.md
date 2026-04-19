# Interview preparation

## A. Resume-ready bullets (3–4)

- Built a **full-stack real-time chat** (React, Socket.IO, Node, Express, PostgreSQL, Prisma) with **direct and group** conversations, **typing indicators**, **read/delivery** signals, and **cursor-based message pagination** backed by composite DB indexes.
- Implemented **horizontal-friendly real-time** using **Redis Pub/Sub** to fan out Socket.IO events so every API instance can push to its local connections.
- Designed an **async notification pipeline** with a **database-backed job queue**, **exponential backoff retries**, and a **dead-letter queue**, modeled after **AWS SQS** concepts for resilient side effects.
- **Dockerized** the stack (Postgres, Redis, API, worker, static frontend, nginx) with **JWT authentication** on REST and WebSockets, plus integration tests for messaging, pagination, and DLQ behavior.

---

## B. Explain to a recruiter (non-jargony)

“It’s like a mini Slack. You log in, pick a chat, and messages show up instantly for the other person. Everything is saved in a proper database. If someone isn’t looking at the chat, the system can still notify them, and there’s background processing so the app stays fast even when something fails and needs a retry.”

---

## C. Explain to an engineer (technical)

“React SPA talking to an Express API. Real-time layer is Socket.IO; persistence is Postgres via Prisma. When a message is saved, we publish JSON envelopes over Redis Pub/Sub so every Node process running Socket.IO can emit to the right rooms. Participants get `message:new` on their personal `user:<id>` socket room so the sidebar updates even when that conversation isn’t open. Side effects for offline users go through notification rows plus a worker consuming `QueueJob` rows with SKIP LOCKED claiming, exponential backoff, and DLQ.”

---

## D. Explain deeply (architecture + tradeoffs)

Cover: **separation of concerns** (HTTP vs worker vs socket), **source of truth** (Postgres), **fan-out** (Redis + per-user rooms), **pagination** (keyset + index alignment), **failure isolation** (queue/DLQ), **security limits** (JWT, bcrypt, rate limit on auth, Helmet, CORS).  
Acknowledge: **localStorage JWT**, **no Socket.IO Redis adapter** in addition to custom Pub/Sub (discuss when to consolidate), **single shared status** on messages for groups.

---

## E. Likely questions and strong answers

**What does this project do?**  
Real-time messaging app with DMs/groups, persisted history, receipts, typing, presence hooks, and async notifications with retries/DLQ.

**Why WebSockets?**  
Low-latency server push; avoids polling cost; supports bidirectional typing.

**Why Redis Pub/Sub?**  
Socket connections stick to a process; Pub/Sub broadcasts a small envelope so **each** API replica can emit locally—foundation for horizontal scale.

**Why a queue for notifications?**  
Decouple flaky/slow work from the send path; retries without blocking HTTP; DLQ for poison messages.

**How do retries and DLQ work?**  
Worker claims job with `SKIP LOCKED`; on failure increments `retryCount`, sets `availableAt` with exponential backoff; after `maxRetries` inserts `DeadLetterJob` and marks job `FAILED`.

**How is data stored?**  
PostgreSQL normalized schema: users, conversations, participants, messages, notifications, queue tables—see Prisma schema doc.

**How did you optimize performance?**  
Composite index for message timeline + cursor pagination; async worker; minimal hot-path work in HTTP handler.

**How would you scale it?**  
Horizontal API replicas + Redis adapter audit; PgBouncer; read replicas for history; tune worker pool; CDN for static assets.

**What was hardest?**  
Real-time correctness across React effects (join vs listeners ordering), cross-user delivery when not in conversation room (solved with per-user socket rooms), reasoning about at-least-once job handling.

**What would you improve next?**  
httpOnly cookies, refresh tokens, notification UI, Socket.IO Redis adapter decision, integration tests for sockets.

**What bugs did you face?**  
Stale sidebar when not in room (fixed by fan-out to `user:` rooms); dropped events when effects unsubscribed before re-subscribe (fixed by merging join + listeners).

**Direct vs group behavior?**  
`Conversation.type`, `DirectConversationKey` uniqueness, group participant management, @mention branch in notification pipeline, conditional sender labels in UI.

**Why not show your own typing indicator?**  
Client ignores events where typer id equals current user; server attributes typing to authenticated socket user.

**Why more than CRUD?**  
Realtime fan-out, cross-process coordination, async fault-tolerant processing, concurrency-safe queue claiming, pagination strategy beyond naive lists.

---

## F. STAR-style talking points

**Challenge:** “Recipients didn’t see live updates unless they had the exact chat open.”  
**Action:** “Traced Socket.IO room membership and React effect ordering; shifted `message:new` fan-out to per-user rooms and merged join + listener registration.”  
**Result:** “Sidebar and open thread stay consistent in multi-tab/multi-conversation scenarios without refresh.”

**Challenge:** “Demonstrate production-style failure handling without real AWS.”  
**Action:** “Implemented DB-backed `QueueJob` + worker with exponential backoff and `DeadLetterJob` + authenticated DLQ API; added forced-failure test.”  
**Result:** “Interview-ready story mapping cleanly to SQS semantics.”

---

## G. Cheat sheet (buzzwords + anchors)

| Term | Anchor in repo |
|------|----------------|
| Keyset pagination | `message.service.ts` + `message.utils.ts` |
| Composite index | `schema.prisma` `Message` @@index |
| Pub/Sub fan-out | `chatEventBus.ts` |
| SKIP LOCKED | `jobProcessor.ts` `claimNextJob` |
| DLQ | `DeadLetterJob` + `ops.controller.ts` |
| Prisma transaction | `sendMessage` create + unread bump |
| Helmet / CORS / rate limit | `app.ts`, `rateLimiter.ts` |
| Zod validation | `*.validation.ts` |

**Numbers to remember:** default `MAX_QUEUE_RETRIES=5`, backoff cap **60s**, auth rate limit **30 req / 15 min**, bcrypt cost **12**, message max length **20000** (Zod).
