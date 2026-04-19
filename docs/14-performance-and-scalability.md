# Performance and scalability

## Why WebSockets

- **Server push** without polling overhead.
- **Bidirectional** channel for typing and future features.
- Tradeoff: connection statefulness vs horizontal scaling (mitigated with Redis adapter + sticky routing).

---

## Why Redis Pub/Sub (here)

- Socket.IO connections are **process-local**. Publishing envelopes to Redis lets **every** API instance emit to its connected clients.
- Tradeoff: Redis Pub/Sub is **fire-and-forget**—no persistence of events. If no subscriber is connected, message is dropped (chat events are OK because **Postgres is source of truth**; client refetches if needed).

---

## Why async queue processing

- Isolates **flaky/slow** work from user-facing latency.
- Enables **retries** and **DLQ** without blocking HTTP handlers.

---

## Indexing strategy (messages)

Composite index **`(conversationId, createdAt DESC)`** matches the pagination query pattern (filter older than cursor, ordered by time + id). Avoids large `OFFSET` scans.

Other indexes support membership lookups (`ConversationParticipant.userId`) and inbox listing (`Notification.userId, createdAt`).

---

## Pagination strategy

**Keyset / cursor** using `(createdAt, id)` tie-breaker encoded in base64url (`message.utils.ts`). Stable under concurrent inserts unlike offset.

---

## Current bottlenecks (honest)

| Bottleneck | Why | Mitigation ideas |
|------------|-----|------------------|
| **Single hot conversation** | Many writes to one partition | Partitioning by time/archival (not implemented) |
| **Fan-out N Redis publishes per message** | One `publishFanout` per participant | Batch or pipeline Redis (future); acceptable for small N |
| **Worker single-threaded loop** | Simple poll | Multiple worker replicas + SKIP LOCKED |
| **No read replicas** | All reads hit primary | Add replica for `GET messages` |

---

## Rough scale thought experiment

| Scale | What likely breaks first | Mitigations |
|-------|--------------------------|-------------|
| **~100 concurrent users** | Probably fine on modest VM + Postgres tuning | Connection pool sizing, Pino log volume |
| **~1,000** | DB connections, socket FD limits | PgBouncer, horizontal API replicas, NLB |
| **~10,000+** | Postgres write throughput on hot threads, Redis fan-out volume | Sharding/partitioning, dedicated messaging infra (Kafka/NATS), move history to cold storage |

---

## Horizontal scaling considerations

- **API + Socket.IO:** multiple instances; enable **Socket.IO Redis adapter** so emits reach sockets on all nodes **or** keep current explicit Pub/Sub pattern and ensure each instance runs subscriber (already does).
- **Sticky sessions:** still help reduce reconnect churn onto cold nodes.
- **Worker:** horizontally safe with `SKIP LOCKED`.

---

## Database scaling

- **Vertical** scale first (CPU/IOPS).
- **Read replicas** for conversation list + message history reads (application must route queries).
- **Archival** of old messages to cheaper storage for huge histories.

---

## Monitoring (production wishlist)

- **RED metrics** for API latency/error rate, worker lag (oldest `PENDING` job age), DLQ growth rate.
- **Traces** across HTTP → Prisma → Redis publish.
- **Alerts** on DLQ spike, Redis down, migration failures.

---

## Interview sound bite

“We optimized the hot path with composite indexes and cursor pagination, pushed real-time across nodes with Redis Pub/Sub, and kept side effects off the request thread with a DB-backed queue and exponential backoff—things you’d tune further with connection pooling, replicas, and observability at higher scale.”
