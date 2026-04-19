# Database schema (Prisma)

Source of truth: **`backend/prisma/schema.prisma`**.

---

## Entity overview

| Model | Purpose |
|-------|---------|
| **User** | Accounts, profile fields, online flags |
| **Conversation** | Thread container (`DIRECT` or `GROUP`) |
| **DirectConversationKey** | Guarantees **one** DM row per unordered user pair |
| **ConversationParticipant** | Membership, role, unread, last-read pointer |
| **Message** | Chat payload + delivery state + soft-delete support |
| **Notification** | In-app notification rows (async pipeline) |
| **QueueJob** | Durable jobs for worker |
| **DeadLetterJob** | Poison / exhausted jobs |

---

## User

| Field | Notes |
|-------|--------|
| `id` | UUID PK |
| `email` | Unique login |
| `name` | Display |
| `passwordHash` | bcrypt output (never returned on API) |
| `avatarUrl` | Optional |
| `isOnline`, `lastSeenAt` | Presence-ish; updated on socket connect/disconnect |

---

## Conversation

| Field | Notes |
|-------|--------|
| `type` | `DIRECT` \| `GROUP` |
| `name` | Group title (nullable for direct) |
| `createdBy` | FK User |

**Indexes:** `createdBy`, `updatedAt DESC` — list conversations sorted by activity.

---

## DirectConversationKey

**Why it exists:** Without it, two “create DM” calls could insert duplicate conversations for the same pair. The app stores canonical `(userIdLow, userIdHigh)` with a **unique** constraint.

| Field | Notes |
|-------|--------|
| `conversationId` | 1:1 with Conversation |
| `userIdLow`, `userIdHigh` | Sorted pair |

---

## ConversationParticipant

| Field | Notes |
|-------|--------|
| `conversationId`, `userId` | **Unique** together |
| `role` | `MEMBER` \| `ADMIN` (groups) |
| `unreadCount` | Incremented when others post; zeroed on read path |
| `lastReadMessageId` | Optional pointer for read cursor |

**Indexes:** `userId`, `conversationId` — “my memberships” and “who’s in this thread.”

---

## Message

| Field | Notes |
|-------|--------|
| `content` | Text body (large max enforced in Zod on API) |
| `type` | `TEXT` default; enum allows future attachment types |
| `status` | `SENT` → `DELIVERED` → `READ` |
| `deliveredAt`, `readAt` | Timestamps when advanced |
| `deletedAt` | Soft delete filter in queries (if used consistently) |
| `metadata` | JSONB extensibility |

**Critical index:** `@@index([conversationId, createdAt(sort: Desc)])` — aligns with **keyset pagination** in `message.service.ts` (`ORDER BY createdAt DESC, id DESC` + cursor filter).

Also `@@index([senderId])`, `@@index([conversationId])` for auxiliary lookups.

---

## Notification

| Field | Notes |
|-------|--------|
| `type` | `NEW_MESSAGE`, `MENTION`, `ADDED_TO_GROUP` |
| `status` | `PENDING` until worker marks `SENT` / `FAILED` |
| `retryCount` | On notification row (distinct from job retries—both exist) |
| `data` | JSON metadata (`conversationId`, `messageId`, …) |

**Index:** `(userId, createdAt DESC)` — inbox listing.

---

## QueueJob

| Field | Notes |
|-------|--------|
| `type` | String job type (see `queue.types.ts`) |
| `payload` | JSONB |
| `status` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `retryCount`, `maxRetries` | Backoff / DLQ policy |
| `availableAt` | When job becomes claimable (delay / retry scheduling) |
| `lockedAt`, `lockedBy` | Worker claim metadata |

**Index:** `(status, availableAt)` — efficient “due work” scans.

---

## DeadLetterJob

Stores **failed permanently** jobs: original id, payload snapshot, error text, `failedAt`.

**Index:** `failedAt DESC` for ops listing.

---

## Direct vs group representation

- **Direct:** one `Conversation` row, `type=DIRECT`, `DirectConversationKey` row, exactly two `ConversationParticipant` rows (enforced by service logic).
- **Group:** `type=GROUP`, `name` set, N participants, optional `ADMIN` role for creator in seed/service patterns.

---

## Message status lifecycle

1. Insert as **`SENT`**.
2. Recipient APIs **`markDelivered`** → `DELIVERED` + `deliveredAt`.
3. **`markRead`** → `READ` + `readAt`, participant unread cleared.

---

## Pagination mechanics

- **Cursor** is base64url JSON `{ t: ISO8601, id }` encoding `createdAt` + `id` tie-breaker (`message.utils.ts`).
- **Query:** messages strictly “older than cursor” using `OR` on `(createdAt < t)` OR `(createdAt = t AND id < cursorId)` — stable ordering.
- **`take = limit + 1`** to detect `hasMore`, then reverse slice to chronological for the client.

---

## Honest limitations

- No separate **read receipts per member** for groups (single message status row).
- **`VISIBILITY_TIMEOUT_MS`** in env is meaningful for an SQS provider; local worker uses `availableAt` + SKIP LOCKED pattern instead of a long visibility lease.
