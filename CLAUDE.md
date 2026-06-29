# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (localhost:3000)
npm run build      # production build
npm run lint       # ESLint
npx tsc --noEmit   # type check only
```

No test suite is set up.

## Architecture

Next.js 16 App Router with PostgreSQL. The app is a Thai-language warehouse management system ("DiaM") supporting two user types with different login flows.

### Auth Model

Two distinct login flows share the same `token` httpOnly cookie:

| Flow | Route | Payload | Expiry |
|------|-------|---------|--------|
| Admin (email + password) | `POST /api/auth/login` | `{ id, name, email, role }` | 7 days |
| Staff (store name + 4-digit PIN) | `POST /api/auth/login-pin` | `{ id, name, role, storeId, storeName, type: "staff" }` | 12 hours |

`proxy.ts` (root level, Next.js 16 uses this name instead of `middleware.ts`) guards all `/dashboard/*` routes. Staff (`type === "staff"`) are restricted to `/dashboard/movement` only; admins can access everything.

All API routes that require auth call `getUser()` from `lib/auth.ts`, which reads the cookie and verifies with `jsonwebtoken` using `process.env.JWT_SECRET`.

### Key Libraries

- **DB**: `postgres` (not Prisma) — raw SQL tagged templates via `lib/db.ts`. Uses `sql.begin()` for transactions and `FOR UPDATE` locking for stock changes.
- **Auth**: `jsonwebtoken` + `bcryptjs` — JWT in httpOnly cookie. `jose` is in package.json but unused; use `jsonwebtoken` only.
- **AI**: `lib/aiParse.ts` — parses Thai natural-language warehouse commands via OpenAI structured output into typed `ParsedCommand` intents (`MOVE_IN`, `MOVE_OUT`, `CHECK_STOCK`, `ADD_ITEM`, `UNKNOWN`).
- **UI**: Tailwind CSS v4, Framer Motion.

### Database Schema (inferred)

```
users          — id, name, email, password (bcrypt), role, pin (plain text), store_id, active
stores         — id, owner_id, name, business_type, phone
store_members  — id, store_id, user_id, role, joined_at
products       — id, name, category, zone, stock, min_stock, unit, image
movements      — id, product_id, employee_pin, type (MOVE_IN|MOVE_OUT), qty, note, created_at
cash_withdrawals — id, store_id, amount, reason, employee_pin, created_at
```

`movements` and `cash_withdrawals` store `employee_pin` as plain text and JOIN with `users.pin` to resolve names. **Hashing PINs requires a DB migration** (adding `user_id` columns to those tables) — do not hash PINs without coordinating a migration first.

### API Route Conventions

- All routes that mutate or return sensitive data must call `getUser()` from `@/lib/auth` and return 401 if null.
- Ownership checks: verify `store.owner_id === user.id` before allowing store/member mutations.
- Error responses must use generic messages (not `error.message`) to avoid leaking internals.
- Movement type must be validated as `MOVE_IN` or `MOVE_OUT` before inserting.

### Environment Variables

```
DATABASE_URL     — PostgreSQL connection string (ssl: require)
JWT_SECRET       — signs/verifies the token cookie
OPENAI_API_KEY   — used by lib/aiParse.ts for Thai command parsing
SESSION_SECRET   — referenced by deleted lib/session.ts; no longer used
```
