# Testing and debugging

## Automated tests

### Backend (`backend/`)

**Runner:** Jest + Supertest  
**File:** `tests/chat.api.test.ts`  
**Setup:** `tests/setup.ts` (loads env / prisma — requires real DB + Redis URL in environment).

**Coverage (high level):**

1. **Auth:** register + login + protected `/me`.
2. **Conversations:** create direct between two seeded users in test `beforeAll`.
3. **Messages:** send five messages; fetch page with `limit=2` + `hasMore`; second page with cursor.
4. **Queue / DLQ:** inserts `Notification` + `QueueJob` with `forceFail`, runs **`claimNextJob` / `processClaimedJob`** twice, asserts retry then **`FAILED`** + **`DeadLetterJob`** row.

**Run:**

```bash
cd backend
export DATABASE_URL=postgresql://...
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=dev-secret-change-in-prod-min-8-chars
npx prisma migrate deploy
npm test
```

### Frontend (`frontend/`)

**Runner:** Vitest (`npm test`).  
**Example:** `pages/LoginPage.test.tsx`.

```bash
cd frontend
npm test
```

---

## Manual test scenarios (demo checklist)

1. **Register** new user → redirected / session works.
2. **Login** as Alice → conversations load.
3. **Open DM** with Bob → messages appear; send message → Bob’s session (other browser) sidebar updates **without** opening DM (validates `user:` room fan-out).
4. **Typing** — Alice types, Bob sees indicator; Alice stops, indicator clears.
5. **Load older** — if enough messages exist, pagination prepends.
6. **Create group** — add members, send messages, @mention if testing pipeline.
7. **Offline notification path** — recipient not in room / offline: notification row created (inspect DB) and worker marks `SENT`.
8. **DLQ demo** — `POST /api/notifications/test-failure` then `GET /api/dlq`.

---

## Debugging WebSockets

| Step | Action |
|------|--------|
| Confirm transport | Browser devtools → Network → WS; should see `/socket.io/?EIO=` |
| Token | Application tab → localStorage `chat_token`; decode jwt at jwt.io (unsigned verify locally) |
| CORS / URL mismatch | If UI on `:8080` but socket on wrong host, check `VITE_SOCKET_URL` baked into build |
| Server logs | Pino logs on connection / warnings in `socket.handlers.ts` |
| Redis | `redis-cli MONITOR` briefly to see PUBLISH volume (noisy) |

---

## Debugging Redis Pub/Sub

1. **`SUBSCRIBE chat:fanout:v1`** in `redis-cli` — you should see JSON envelopes when messages send (if publisher uses same channel name **`CHAT_FANOUT_CHANNEL`**).
2. Confirm **subscriber** is running inside API process (`startFanoutSubscriber` in `server.ts`). **Worker container does not run subscriber** — only API does.

---

## Debugging queue failures

1. Query **`QueueJob`** table: statuses, `lastError`, `availableAt`, `retryCount`.
2. Tail **worker** logs (`docker compose logs -f worker`).
3. Force deterministic failure with **`forceFail`** payload.

---

## Testing retries and DLQ

- Prefer **automated** test in `chat.api.test.ts` (deterministic, cleans up rows).
- Or **HTTP** test-failure endpoint + worker logs + `GET /api/metrics` (`pendingQueueJobs`, `deadLetterJobs`).

---

## Safe demo practices

- Use **seed accounts** in disposable DB.
- Do **not** expose production secrets; rotate `JWT_SECRET` if ever deployed beyond lab.
- For screen recording, hide email domains if privacy-sensitive.
