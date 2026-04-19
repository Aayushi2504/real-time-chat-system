# Demo script (live presentation)

Use two browser profiles (or normal + incognito) for **Alice** and **Bob** after seeding.

**Prep (one-time):** `docker compose up -d`, run migrations + seed, open **http://localhost:8080** or **http://localhost:5173** (dev).

---

## Act 1 — Auth & setup (1 min)

1. Log in as **Alice** (`alice@example.com` / `Password123!`).
2. Point out: **sidebar** conversations, **JWT** persisted (localStorage—mention prod tradeoff).
3. Open the **pre-seeded DM** with Bob or create via user search if UI allows.

---

## Act 2 — Real-time messaging (2–3 min)

1. In **second window**, log in as **Bob**.
2. **Alice** sends “Hello in real time”.
3. **Bob** sees message **without refresh**; highlight **WebSockets** + **Postgres persistence** (refresh still shows history).
4. **Alice** switches to another conversation (or stays on list view if possible); **Bob** sends to Alice — call out **sidebar unread / preview updates** thanks to **`message:new` to `user:<id>` rooms**.
5. **Alice** opens thread again — show **read/delivered** metadata on last own bubble (direct).

---

## Act 3 — Typing & presence (1 min)

1. **Alice** types in composer (don’t send); **Bob** sees **typing indicator**.
2. **Alice** clears input or sends — typing stops.
3. Mention **server-trusted identity** for typing (no spoofing other users).

---

## Act 4 — Group (2 min) (optional)

1. **Alice** creates **Engineering**-style group (or new group) including Bob.
2. Send a few messages in a row — show **clustered bubbles** + **sender names** on group.
3. Optionally mention **@mention** regex in `notificationPipeline.service.ts` (backend creates MENTION notifications).

---

## Act 5 — Reliability story (2 min)

1. Open **Swagger** `POST /api/notifications/test-failure` with JWT (or curl).
2. Show **worker logs**: retries then DLQ.
3. **`GET /api/dlq`** (Swagger) — dead-letter rows appear.
4. Tie to **SQS** / production async processing narrative.

---

## Act 6 — Engineering depth (1 min)

1. Show **GitHub / folder** structure: `modules/*`, `prisma/schema.prisma`.
2. One sentence: **cursor pagination** + composite index on `Message`.
3. Close: what you’d add next (**httpOnly cookies**, notification UI, metrics).

---

## Backup if live demo fails

- Walk **architecture diagram** from `docs/02-architecture.md`.
- Show **tests passing** in terminal screen share.
- Screen recording fallback recorded earlier.
