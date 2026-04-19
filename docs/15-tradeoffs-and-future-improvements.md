# Tradeoffs and future improvements

## Design tradeoffs

| Choice | Benefit | Cost |
|--------|---------|------|
| **Monolith Node** (Express + Socket.IO) | Simple deploy, shared Prisma client | Tighter coupling than separate “realtime service” |
| **JWT in localStorage** | Easy SPA | XSS steals token; prefer httpOnly cookies in prod |
| **Postgres-backed queue** | No AWS dependency for demo | DB becomes queue bottleneck under extreme load |
| **Redis Pub/Sub** | Simple cross-process emit | No persisted event log; subscribers must be up |
| **message:new to `user:` rooms** | Sidebar updates without joining every convo | N publishes per message |
| **Single message status** | Simple schema | Weak group read-receipt modeling |

---

## Tools chosen over alternatives

| Instead of | This project uses | Reason |
|------------|-------------------|--------|
| Polling | Socket.IO | Lower latency, less waste |
| Offset pagination | Keyset cursor | Stable performance on deep history |
| Synchronous push provider | Queue + worker | Resilience + retry story |
| GraphQL | REST + OpenAPI subset | Straightforward for mobile/web clients in demo |
| MongoDB | PostgreSQL | Relational integrity for conversations/memberships |

---

## Intentional simplifications

- **No message attachments** in UI (schema enums hint future).
- **No E2E encryption**.
- **No push notifications** to real devices—notification pipeline updates DB status only.
- **SQS provider** is scaffold—local queue demonstrates pattern.
- **No rich admin RBAC**.

---

## Production-grade changes

- **Auth:** refresh tokens, secure cookies, CSRF strategy.
- **Sockets:** Redis adapter + load test under NLB.
- **Data:** soft-delete consistency audit, partition strategy for messages.
- **Security:** stricter rate limits, WAF, input sanitization for XSS in rendered messages (currently `whitespace-pre-wrap`—treat as text but still escape if adding HTML).
- **Compliance:** retention policies, export/delete user GDPR flows.

---

## Future features ( roadmap ideas )

- File uploads (S3 + virus scan).
- Per-member read cursors in groups.
- Message search (OpenSearch / Postgres FTS).
- Mobile clients sharing same API.
- Feature flags / gradual rollout.

---

## Why WebSockets instead of polling

Polling increases latency and wastes requests; chat expects **push**. SSE could work for read-only push but not typing without a second channel.

---

## Why Redis Pub/Sub instead of only DB polling

DB polling for every client is expensive and still laggy. Pub/Sub gives **sub-millisecond fan-out** to all interested Node processes with minimal coupling.

---

## Why queue + retries + DLQ instead of inline notification send

Inline calls couple availability of your API to downstream systems, amplify tail latency, and make **poison messages** dangerous. Queueing gives **backpressure**, **retry**, and **isolation**.
