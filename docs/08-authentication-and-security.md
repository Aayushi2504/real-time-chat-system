# Authentication and security

## Registration and login

| Step | Location |
|------|----------|
| HTTP routes | `modules/auth/auth.routes.ts` — `POST /register`, `POST /login`, `GET /me` |
| Rate limit | `middlewares/rateLimiter.ts` **`authRateLimiter`** on register/login (30 / 15 min per IP) |
| Validation | `auth.validation.ts` + `middlewares/validate.ts` |
| Domain logic | `auth.service.ts` |

**Register:** checks email uniqueness, **`bcrypt.hash(password, 12)`**, creates user, returns **`signToken`** + user DTO (no hash).

**Login:** loads user by email, **`bcrypt.compare`**, same token issuance.

**Me:** `authMiddleware` + `getMe` selecting safe fields including `isOnline`, `lastSeenAt`.

---

## JWT usage

- **Signed** with `jsonwebtoken` using **`JWT_SECRET`** (min 8 chars enforced by Zod in `config/env.ts`).
- **Payload:** `{ sub: userId, email }`.
- **Expiry:** `JWT_EXPIRES_IN` (default `7d`).

**REST:** clients send **`Authorization: Bearer <token>`** — parsed in **`authMiddleware.ts`**.

**Sockets:** same secret verified in **`socket.handlers.ts`** `io.use` from `handshake.auth.token` or `Authorization` header.

---

## Password hashing

- **bcrypt** with cost factor **12** on register (`auth.service.ts`).
- **Compare** on login.

---

## Protected routes

Any router that calls **`r.use(authMiddleware)`** requires a valid JWT (users, conversations, messages, notifications, secured ops).

**Public:** `POST /api/auth/register`, `POST /api/auth/login`, **`GET /api/health`**.

---

## Validation

- **Zod** schemas per module (`*.validation.ts`).
- **`validateBody` / `validateQuery`** attach parsed values; controllers read from `req.validated*` per route wiring.

**Errors:** `ZodError` → HTTP **400** with issues array (`errorHandler.ts`).

---

## Error handling

- **`AppError`** subclasses (`utils/errors.ts`) carry `statusCode` and optional `errors`.
- **`errorHandler`** maps them to **`fail()`** JSON.
- **Unexpected errors:** logged; in **production** response message is generic **500** string; in dev, exposes error message (useful for local debugging—**tighten** for real prod).

---

## HTTP security middleware

- **Helmet** (`app.ts`) — default security headers.
- **CORS** — `credentials: true`, origins from **`CORS_ORIGIN`** comma list.
- **JSON body limit** — `express.json({ limit: '2mb' })`.
- **Pino HTTP** logging with status-based log levels.

---

## Current limitations (be honest in interviews)

| Topic | Current state | Production direction |
|-------|---------------|----------------------|
| **Token storage** | `localStorage` in SPA | **httpOnly** cookies + CSRF or BFF |
| **Refresh tokens** | Not implemented | Short-lived access + refresh rotation |
| **RBAC** | Minimal (participant checks) | Fine-grained roles, audit logs |
| **Rate limits** | Auth routes only | Broader limits + WAF / API gateway |
| **Password policy** | Zod on register | Centralized policy, breach checks |
| **mTLS / service auth** | N/A for demo | Internal service mesh |

---

## Socket authentication

Mirrors REST: **no token → connection rejected** in `io.use`.

**Trust boundary:** typing payload’s `senderId` from client is **not** trusted for fan-out; server uses authenticated **`userId`** when publishing (`socket.handlers.ts` comment).

---

## CORS

Must include every browser origin that loads the SPA (e.g. `http://localhost:5173`, `8080`, `3000`) in **`CORS_ORIGIN`** or browsers block credentialed requests.

---

## Summary sound bite

“JWT for REST and Socket handshake, bcrypt for passwords, Zod for input validation, Helmet + CORS + rate limit on auth. Tokens in localStorage are a deliberate demo tradeoff—I’d move to cookies in production.”
