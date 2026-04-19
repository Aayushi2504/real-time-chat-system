# Notifications, queue, retries, and DLQ

## Why a queue exists

When a message is sent, some work is **fast and synchronous** (write message, fan-out `message:new`). Other work is **slow, flaky, or should not block the HTTP request**:

- Marking downstream systems as notified (email, mobile push)—**simulated** here by flipping `Notification.status` to `SENT`.
- Retrying transient failures without wedging the API thread pool.

So: **`Notification` row + `QueueJob` row** decouple **acceptance** from **processing**.

---

## Real-time vs async notifications

| Path | When | What happens |
|------|------|----------------|
| **Real-time chat** | Recipient connected | `message:new` over socket; if they have the thread open they mark read/delivered via REST |
| **Async notification** | Recipient **offline OR not in conversation room** (Redis heuristic) | `createNotification`, `emitNotificationSocket` (`notification:new` to `user:<id>`), **`enqueue(PROCESS_NOTIFICATION)`** |

Code: **`notificationPipeline.service.ts`** `dispatchMessageSideEffects`.

**Additional:** Group **@mentions** (regex on content) can create **`MENTION`** notifications even when the NEW_MESSAGE branch skipped someone—see same file.

---

## How a job is created

1. **`LocalQueueProvider.enqueue`** (`modules/queue/LocalQueueProvider.ts`):
   - Inserts `QueueJob` with `status=PENDING`, `payload` JSON, `maxRetries` from env or override, `availableAt = now + delayMs`.
2. **`getQueueProvider()`** (`getQueueProvider.ts`) picks implementation from **`QUEUE_PROVIDER`** env (`local` | `sqs`).

---

## How the worker processes jobs

Entry: **`worker.ts`** infinite loop calling **`runJobCycle`** (`jobProcessor.ts`).

**`runJobCycle`:**

1. **`claimNextJob()`** — runs **one SQL statement** that:
   - Selects a single eligible `QueueJob` (`PENDING` and `availableAt <= now`) **`ORDER BY createdAt ASC`** with **`FOR UPDATE SKIP LOCKED`** (PostgreSQL) so concurrent workers don’t double-claim.
   - Updates that row to `PROCESSING`, sets `lockedAt`, `lockedBy` (`WORKER_ID` or `worker-<pid>`).
2. **`processClaimedJob(job)`**:
   - If `type === PROCESS_NOTIFICATION`, cast payload to **`ProcessNotificationPayload`**.
   - **`handleProcessNotification`**: unless `forceFail`, updates notification to **`SENT`**.
   - On success: mark job **`COMPLETED`**, clear lock fields.
   - On error: see retry section.

---

## Retry logic

On failure:

1. `nextRetry = job.retryCount + 1`.
2. If **`nextRetry > job.maxRetries`** → **DLQ path** (below).
3. Else compute **`backoffMs = min(1000 * 2 ** retryCount, 60_000)`** (exponential cap at 60s).
4. Set job back to **`PENDING`**, increment `retryCount`, set **`availableAt = now + delay`**, clear locks.

This is **not** identical to SQS visibility timeout (which is lease-based) but demonstrates the **same product goals**: spacing retries, bounding attempts.

---

## DLQ behavior

When retries are exhausted:

1. **`DeadLetterJob`** insert with `originalJobId`, `type`, `payload`, `error`, `retryCount`.
2. **`QueueJob`** update to `status=FAILED`, store `lastError`, bump retry count metadata.

Logged as **moved to DLQ**. Listed via **`GET /api/dlq`** (`ops.controller.ts` `listDlq`) — **requires JWT**.

---

## Failure cases

| Failure | Result |
|---------|--------|
| Unknown `job.type` | Throw → retry / DLQ |
| `forceFail: true` demo | Always throws → retries → DLQ |
| DB unavailable during claim | Worker loop logs error, sleeps (`worker.ts`) |

---

## Fault tolerance story (interview)

- **At-least-once-ish processing:** jobs can be attempted multiple times; handler should be **idempotent** where possible (here: setting `SENT` repeatedly is mostly harmless).
- **Poison messages:** DLQ preserves evidence instead of infinite loops.
- **Worker isolation:** API stays responsive even if workers lag.

---

## AWS SQS mapping (mental model)

| Local concept | SQS analogue |
|---------------|--------------|
| `QueueJob` row | Message in queue |
| `availableAt` | Visibility timeout / delay seconds |
| `FOR UPDATE SKIP LOCKED` claim | `ReceiveMessage` + in-flight visibility window + competing consumers |
| `maxRetries` + DLQ table | Redrive policy + DLQ ARN |
| `LocalQueueProvider` | SQS `SendMessage` |
| `SQSQueueProvider` (scaffold) | Placeholder for real SDK wiring |

**`VISIBILITY_TIMEOUT_MS`** in env is oriented to SQS semantics; the **local** worker primarily uses `availableAt` + polling interval.

---

## Demo: forced DLQ

1. Authenticate.
2. `POST /api/notifications/test-failure` with body `{ "forceFail": true }` (default) — see **`notification.controller.ts`**.
3. Watch worker logs for retry lines then DLQ.
4. `GET /api/dlq` to inspect rows.

---

## Files to cite in interviews

| File | Talking point |
|------|----------------|
| `queue/LocalQueueProvider.ts` | Durable enqueue |
| `queue/queue.types.ts` | Typed job payloads |
| `modules/worker/jobProcessor.ts` | SKIP LOCKED + backoff + DLQ |
| `notificationPipeline.service.ts` | When to notify vs skip |
| `ops.controller.ts` | Operational visibility |
