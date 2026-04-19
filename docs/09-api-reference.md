# REST API reference

**Base path:** `/api`  
**Envelope (success):** `{ "success": true, "message": string, "data": T }`  
**Envelope (error):** `{ "success": false, "message": string, "errors": unknown[] }`

Unless noted, routes require **`Authorization: Bearer <JWT>`**.

---

## Auth

### `POST /api/auth/register`

| | |
|--|--|
| **Auth** | No |
| **Purpose** | Create account |
| **Body** | `{ "email": string, "name": string, "password": string }` |
| **Validation** | `auth.validation.ts` |

**Sample request**

```http
POST /api/auth/register HTTP/1.1
Content-Type: application/json

{"email":"you@example.com","name":"You","password":"Password123!"}
```

**Sample response** `201`

```json
{
  "success": true,
  "message": "Registered",
  "data": {
    "user": { "id": "…", "email": "you@example.com", "name": "You", "createdAt": "…" },
    "token": "<jwt>"
  }
}
```

**Errors:** `409` email exists; `400` validation; `429` rate limit.

---

### `POST /api/auth/login`

| | |
|--|--|
| **Auth** | No |
| **Body** | `{ "email", "password" }` |

**Response** `200`: `{ user: { id, email, name }, token }` inside `data`.

**Errors:** `401` invalid credentials; `429` rate limit.

---

### `GET /api/auth/me`

| | |
|--|--|
| **Auth** | Yes |

**Response** `200`: `data` is current user profile (includes `avatarUrl`, `isOnline`, `lastSeenAt` per `getMe` select).

**Errors:** `401`.

---

## Users

### `GET /api/users/search?q=`

| | |
|--|--|
| **Auth** | Yes |
| **Query** | `q` required (validated) |

Returns matching users for starting DMs / groups.

---

### `GET /api/users`

| | |
|--|--|
| **Auth** | Yes |
| **Query** | Pagination/limit per `users.validation.ts` |

---

## Conversations

### `POST /api/conversations`

| | |
|--|--|
| **Auth** | Yes |
| **Purpose** | Create direct or group |

**Direct body:** `{ "type": "DIRECT", "participantId": "<uuid>" }`  
**Group body:** `{ "type": "GROUP", "name": "Team", "participantIds": ["<uuid>", ...] }`

**Response** `201`: full conversation DTO (shape from Prisma include in service).

**Errors:** `400` invalid combo; `403` / `404` domain errors from service.

---

### `GET /api/conversations`

| | |
|--|--|
| **Auth** | Yes |

**Response** `200`: `data` = array of conversations for current user (with participants, titles, latest message preview—see `conversation.service.ts` mapping).

---

### `GET /api/conversations/:id`

| | |
|--|--|
| **Auth** | Yes |

Single conversation detail if member.

---

### `GET /api/conversations/:id/messages`

| | |
|--|--|
| **Auth** | Yes |
| **Query** | `cursor` optional (opaque string), `limit` optional default 50 max 100 |

**Response** `200`:

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "messages": [ { "id", "conversationId", "senderId", "content", "type", "status", "createdAt", "sender": {…} } ],
    "nextCursor": "<opaque-or-null>",
    "hasMore": true
  }
}
```

Messages are **chronological** (oldest → newest) in `data.messages`.

---

### `POST /api/conversations/:id/participants` (groups)

**Body:** `{ "userId": "<uuid>" }` — add member.

---

### `DELETE /api/conversations/:id/participants/:userId` (groups)

Remove participant (service enforces permissions).

---

## Messages

### `POST /api/messages`

| | |
|--|--|
| **Auth** | Yes |
| **Body** | `{ "conversationId": "<uuid>", "content": string, "type"?: "TEXT"|… }` |

**Response** `201`: created `Message` as `data`.

**Side effects:** unread increments, Redis fan-out `message:new`, async notification pipeline.

---

### `PATCH /api/messages/:id/delivered`

| | |
|--|--|
| **Auth** | Yes |
| **Purpose** | Mark inbound message delivered (not sender) |

**Response** `200`: updated message.

---

### `PATCH /api/messages/:id/read`

| | |
|--|--|
| **Auth** | Yes |

Marks read, clears participant unread, fan-out `conversation:updated` to reader’s `user:<id>` room.

---

## Notifications

### `GET /api/notifications`

| | |
|--|--|
| **Auth** | Yes |

List recent notifications for user.

---

### `PATCH /api/notifications/:id/read`

| | |
|--|--|
| **Auth** | Yes |

---

### `POST /api/notifications/test-failure`

| | |
|--|--|
| **Auth** | Yes |
| **Body** | `{ "forceFail"?: boolean }` default true |

Creates a notification + enqueue job that **always fails** (DLQ demo).  
**Response** `201`: `{ notificationId, jobId }`.

---

## Ops

### `GET /api/health`

**Auth:** No.

**Response** `200`: `{ status: "ok", ts: ISO }`.

---

### `GET /api/metrics`

**Auth:** Yes.

Counts users, conversations, messages, pending jobs, DLQ size, Redis ping.

---

### `GET /api/dlq`

**Auth:** Yes.

Up to 100 latest **`DeadLetterJob`** rows.

---

## Swagger

Interactive docs: **`GET /api/docs`** (subset documented in `openApiDocument.ts`—not every route is duplicated there; this markdown is the fuller list).
