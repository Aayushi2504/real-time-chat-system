# Socket.IO events reference

**Path:** `/socket.io`  
**Auth:** JWT in `handshake.auth.token` **or** `Authorization: Bearer …` header (see `socket.handlers.ts`).

---

## Client → server

| Event | Payload | Purpose |
|-------|---------|---------|
| **`conversation:join`** | `{ conversationId: string }` | Join `conversation:<id>` room + Redis presence set |
| **`conversation:leave`** | `{ conversationId: string }` | Leave room + Redis |
| **`message:send`** | `{ conversationId, content }` | Persist via `messageService.sendMessage` (optional; UI uses REST) |
| **`message:delivered`** | `{ messageId }` | Forward to service |
| **`message:read`** | `{ messageId }` | Forward to service |
| **`typing:start`** | `{ conversationId, userName?, senderId? }` | Fan-out to conversation room; **sender identity from JWT**, not client `senderId` |
| **`typing:stop`** | `{ conversationId }` | Fan-out stop |
| **`presence:update`** | _(empty)_ | Refresh session TTL / `lastSeenAt` on heartbeat |

**Acknowledgements:** `conversation:join` supports an optional ack callback `{ ok: true }` / `{ ok: false, error }`.

---

## Server → client

| Event | Payload (conceptual) | When emitted | UI use |
|-------|----------------------|--------------|--------|
| **`message:new`** | `{ message: { id, conversationId, senderId, content, type, status, createdAt, sender } }` | After message persisted — **to each participant’s `user:<id>` room** | Append bubble if convo open; always refresh sidebar |
| **`message:delivered`** | `{ messageId, conversationId?, status, deliveredAt }` | After PATCH delivered | Update bubble status |
| **`message:read`** | `{ messageId, conversationId?, status, readAt }` | After PATCH read | Update bubble status |
| **`notification:new`** | Notification DTO | After `emitNotificationSocket` | (Wire in UI if desired) |
| **`typing:start`** | `{ conversationId, userId, senderId, userName }` | Fan-out from Redis | Typing line |
| **`typing:stop`** | `{ conversationId, userId, senderId }` | Fan-out | Clear typing |
| **`user:online`** | `{ userId }` | On connect, to each conv membership room | Direct header / future presence |
| **`user:offline`** | `{ userId }` | On disconnect | Same |
| **`conversation:updated`** | `{ conversationId, unreadCount }` | After read path | Patch sidebar unread |
| **`error:event`** | `{ message }` | Socket handler failures | Log / toast (not heavily used in UI) |

---

## Example: typing start (client)

```ts
socket.emit('typing:start', {
  conversationId: selectedId,
  userName: user.name,
});
```

Server overwrites identity using authenticated user when fanning out.

---

## Example: message:new (server → client)

```json
{
  "message": {
    "id": "uuid",
    "conversationId": "uuid",
    "senderId": "uuid",
    "content": "hello",
    "type": "TEXT",
    "status": "SENT",
    "createdAt": "2026-01-01T12:00:00.000Z",
    "sender": { "id": "…", "name": "Alice", "email": "…", "avatarUrl": null }
  }
}
```

---

## Rooms reference

| Room | Joined by |
|------|-----------|
| `user:<userId>` | Automatically on socket connection |
| `conversation:<conversationId>` | Successful `conversation:join` |

---

## Files

- **Server handlers:** `backend/src/modules/socket/socket.handlers.ts`
- **Fan-out helper:** `backend/src/modules/redis/chatEventBus.ts`
- **Client:** `frontend/src/services/socket.ts`, `frontend/src/pages/DashboardPage.tsx`
