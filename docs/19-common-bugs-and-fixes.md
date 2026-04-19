# Common bugs and fixes

## Real-time / UI

| Symptom | Likely cause | Fix / check |
|---------|--------------|-------------|
| Other user must **refresh** to see messages | Old bug: only `conversation:*` fan-out, or listener/join race | Confirm **`message.service.ts`** fans out to **`user:<participantId>`**; confirm **`DashboardPage`** registers socket handlers **before** `conversation:join` in same effect |
| Duplicate messages in list | `message:new` + REST append both fire | Client dedupes by `id` — ensure **not** double-subscribing handlers (Strict Mode double mount should still be OK if cleanup correct) |
| Typing shows for **self** | Client not filtering `userId` | `DashboardPage` typing handlers compare `typerId === user.id` |
| CORS error on API | Origin not allowed | Add UI origin to **`CORS_ORIGIN`** in backend env |

---

## Socket connection

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Immediate disconnect | JWT missing/invalid | Re-login; verify `auth: { token }` in `socket.ts` |
| Works in dev, fails in Docker | Wrong **`VITE_SOCKET_URL`** baked into frontend build | Rebuild frontend with correct URL or use nginx on **8080** so browser hits one origin |
| 404 on `/socket.io` | Proxy not forwarding | Check `vite.config.ts` proxy or `nginx/nginx.conf` |

---

## Redis / fan-out

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No realtime at all | Redis down or wrong `REDIS_URL` | `redis-cli ping`; check compose logs |
| Partial delivery | Only one API instance has subscriber | Every **`server.js`** process must call **`startFanoutSubscriber`** (worker does **not** — by design) |

---

## Database / migrations

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Backend crash on boot | Invalid env / DB unreachable | Check `DATABASE_URL`, postgres health |
| `P2021` / missing table | Migrations not applied | `npx prisma migrate deploy` |

---

## Queue / worker

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Notifications stuck `PENDING` | Worker not running | Start **`npm run worker`** or `worker` container |
| Jobs never claimed | `availableAt` in future | Inspect row; adjust clock skew |
| DLQ empty but job fails | `maxRetries` high | Wait or lower for demo DB test |

---

## Auth

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 401 on all routes | Token cleared / wrong header | `setAuthToken` + `Authorization: Bearer` |
| 429 on login | Rate limit hit | Wait window or adjust `rateLimiter.ts` for local dev |

---

## Docker-specific

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Frontend calls `localhost:4000` from another machine | Build args point to localhost | Set `VITE_API_URL` to reachable host IP or use nginx-only URL |
| Worker starts before migrations | Rare race | Backend command runs `migrate deploy` first; worker depends on `backend` started |
