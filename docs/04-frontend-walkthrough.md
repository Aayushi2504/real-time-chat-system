# Frontend walkthrough

## Folder structure (`frontend/src/`)

```
src/
  main.tsx              # createRoot + BrowserRouter + AuthProvider
  App.tsx               # Routes: /login, /register, / (private Dashboard)
  vite-env.d.ts         # import.meta.env typings
  hooks/
    useAuth.tsx         # Auth context: token, user, login/register/logout, connectSocket
  services/
    api.ts              # Axios instance, setAuthToken, REST helpers
    socket.ts           # Singleton Socket.IO client
  types/
    index.ts            # User, Conversation, Message, ApiResponse, NotificationRow
  pages/
    LoginPage.tsx
    RegisterPage.tsx
    DashboardPage.tsx   # Main shell: conversations, messages, composer, group modal
  components/
    Avatar.tsx
  lib/
    formatChatTime.ts   # Relative / absolute times for list + bubbles
    initials.ts         # Avatar initials helper
```

**Tests:** `pages/LoginPage.test.tsx` (Vitest + Testing Library).

---

## State management

- **`useAuth`** (`hooks/useAuth.tsx`): global **user**, **loading**, **login/register/logout**, **`refreshMe`**. On successful auth it calls **`connectSocket(token)`** so REST and realtime share the same session.
- **`DashboardPage`**: local `useState` for conversations, selected id, messages, cursor/pagination, composer text, group-creation modal state, typing indicator name, timers in `useRef`.

There is **no** Redux, React Query, or Zustand—appropriate for the scope; scaling up would likely add a server-state library for cache + invalidation.

---

## API client (`services/api.ts`)

| Concern | Implementation |
|---------|----------------|
| Base URL | `import.meta.env.VITE_API_URL` or empty string so **Vite dev server** can proxy `/api` |
| Auth header | `setAuthToken` writes `Authorization: Bearer` + `localStorage['chat_token']` |
| Types | Responses wrapped as `ApiResponse<T>` matching backend `{ success, message, data }` |

Notable helpers: `listConversations`, `fetchMessages`, `sendMessage`, `createDirect`, `createGroup`, `markMessageRead`, `markMessageDelivered`, **`listNotifications`**, **`markNotificationRead`**, **`enqueueTestFailure`**.

**Honest gap:** `DashboardPage` currently focuses on chat; it does **not** import or render a notifications panel. Notification flows are still demonstrable via **Swagger** (`/api/docs`), **curl**, or by extending the dashboard to call `listNotifications` / `enqueueTestFailure`.

---

## Socket client (`services/socket.ts`)

- **`connectSocket(token)`**: disconnects previous socket, creates `io(VITE_SOCKET_URL || window.location.origin, { path: '/socket.io', auth: { token }, transports: ['websocket','polling'] })`.
- **`getSocket()`**: returns singleton or `null`.
- **`disconnectSocket()`**: `removeAllListeners()`, disconnect, clear singleton (used on logout).

---

## `DashboardPage.tsx` — major behaviors

### Conversation list

- Loads on mount via `loadConversations` → `api.listConversations`.
- Click selects `selectedId`; shows title (group name vs other user in direct), time (`formatConversationTime`), unread count.

### Message stream

- **`loadMessages(convId, cursor?)`**: initial load replaces `messages`; pagination prepends older rows.
- **`onSend`**: stops typing, **`POST /api/messages`**, appends returned `Message` to state (dedupe by id), scrolls to bottom, `loadConversations()` for sidebar ordering; restores input on failure.
- **Socket `message:new`**: appends if `conversationId === selectedId` and id not seen; triggers mark delivered/read for incoming in open thread; always `loadConversations()` for sidebar.

### Join + listeners (single `useEffect`)

Registers **`message:new`**, **`conversation:updated`**, **`message:delivered`**, **`message:read`**, **`typing:start`**, **`typing:stop`**, then **`conversation:join`** when `selectedId` is set—**after** attaching handlers—to avoid missing events during React effect ordering. See comment block in file.

### Typing

- Debounced **`typing:start`** from input `onChange`; **`typing:stop`** when empty, on send, and from timer cleanup.
- Handlers ignore events where `senderId`/`userId` equals current user (server also uses authenticated user for fan-out).

### Direct vs group UI

| Aspect | Direct | Group |
|--------|--------|-------|
| Header | Other user’s avatar + name + **`DirectChatStatusLine`** (online / last seen) | Group title + member count + participant list snippet |
| Message labels | None (alignment shows sender) | Sender name on first bubble of a run from each user |
| Receipts | Shown on own messages (cluster end) | Same pattern |

### “Load older”

- Button when `hasMore`; uses `cursor` from last page; prepends to `messages`.

### Group creation modal

- Picks users from `api.listUsers` / search, posts `api.createGroup`, refreshes list, selects new conversation.

---

## Styling

- **Tailwind** with custom tokens in `tailwind.config.js` (`surface-*`, `accent`, etc.).
- **`index.css`** for base styles / scrollbar utilities if defined there.

---

## Vite config (`vite.config.ts`)

- Dev server port **5173**.
- **Proxy** `/api` and `/socket.io` to `VITE_PROXY_TARGET` or `http://localhost:4000` with `ws: true` for sockets.

---

## Key UX decisions (interview talking points)

1. **Stable chat lanes** — full-width column with `max-w-chat`, bubbles `max-w-[85%]`, metadata below cluster end to avoid misaligned footers.
2. **Single effect for socket join + listeners** — reliability over micro-optimization.
3. **REST send + socket receive** — HTTP remains the source of returned entity; sockets push to all participants’ **`user:`** rooms on the server (see backend doc), so sidebar stays fresh when another thread is open.
4. **No notification UI yet** — backend + `api.ts` ready; product gap called out explicitly.
