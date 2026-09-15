# Restaurant Stock Management System

A production-quality inventory and stock management system for a restaurant, built as
a monorepo with a Node.js/Express/Prisma backend and a React/Vite frontend.

## Contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Folder structure](#folder-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Development](#development)
- [Production build](#production-build)
- [Testing](#testing)
- [API overview](#api-overview)
- [Roles & permissions](#roles--permissions)
- [Stock accuracy model](#stock-accuracy-model)

## Architecture

```
Route -> Middleware (auth, permission, validation) -> Controller -> Service -> Prisma -> PostgreSQL
```

- Controllers are thin: they parse the request and call a service.
- Business logic and every stock-affecting operation lives in services.
- Every operation that changes inventory runs inside a Prisma `$transaction` and writes
  an immutable `StockMovement` row via a single choke point (`applyStockMovement` in
  `backend/src/services/inventory.service.ts`), so the stock ledger can never drift from
  reality and can never be partially updated.

## Tech stack

**Backend:** Node.js, TypeScript (strict), Express, PostgreSQL, Prisma ORM, JWT auth,
bcrypt, Zod validation, REST API, Helmet, rate limiting.

**Frontend:** React, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query,
React Hook Form + Zod, Recharts.

## Folder structure

```
restaurant-stock/            (this repo)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── config/          env + Prisma client
│       ├── controllers/     thin HTTP handlers
│       ├── services/        business logic & transactions
│       ├── routes/          Express routers, one per resource
│       ├── middleware/      auth, authorize, validate, error handler
│       ├── validators/      Zod schemas
│       ├── constants/       permission catalogue & role->permission map
│       ├── errors/          AppError
│       ├── utils/           jwt, password, pagination, response helpers
│       └── tests/           vitest business-logic tests
└── frontend/
    └── src/
        ├── components/      ui/ (buttons, inputs, modals...) + common/
        ├── layouts/         DashboardLayout, AuthLayout, Sidebar, Topbar
        ├── pages/           one folder per route/feature
        ├── services/        typed API clients (axios)
        ├── contexts/        AuthContext
        ├── hooks/           useAuth, useDebouncedValue
        ├── routes/          ProtectedRoute, PermissionRoute
        ├── lib/             axios instance, crud service factory, cn()
        └── types/           shared frontend types mirroring the API
```

## Requirements

- Node.js 20+
- PostgreSQL 14+ (a local install, or a Docker container - see below)

## Installation

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in real values:

```bash
cd backend
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Sign access/refresh tokens - use long random values in production |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes |
| `CORS_ORIGIN` | Frontend origin allowed to call the API |
| `SEED_*` | Credentials created by `npm run seed` |
| `RATE_LIMIT_*` | API rate limiting window/max |

Never commit `.env`.

## Database setup

You need a running PostgreSQL server. Two options:

**Option A - Docker (if available):**

```bash
docker compose up -d   # from the repo root; starts Postgres on localhost:5432
```

**Option B - a local PostgreSQL install:** create a database and point `DATABASE_URL`
at it, e.g.:

```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/restaurant_stock?schema=public"
```

Then run migrations and seed data:

```bash
cd backend
npx prisma migrate dev --name init
npm run seed
```

The seed creates roles, permissions, a super admin, a manager, a staff member, a retail
customer, sample categories/units/products/suppliers/a warehouse with opening stock, two
burger recipes, and menu items. Credentials are printed at the end of the seed run and
also documented below.

### Development credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@restaurant.com | Admin@12345 |
| Manager | manager@restaurant.com | Manager@12345 |
| Staff | staff@restaurant.com | Staff@12345 |
| Retail customer | customer@restaurant.com | Customer@12345 |

Override these via the `SEED_*` variables in `.env` before seeding if you want different
credentials.

## Development

```bash
# terminal 1
cd backend && npm run dev        # http://localhost:4000

# terminal 2
cd frontend && npm run dev       # http://localhost:5173 (proxies /api to :4000)
```

Prisma Studio (visual DB browser):

```bash
cd backend && npm run prisma:studio
```

## Production build

```bash
cd backend && npm run build && npm start
cd frontend && npm run build     # outputs static files to frontend/dist
```

## Testing

```bash
cd backend && npm test
```

Tests run against your configured `DATABASE_URL` and exercise real business logic, not
just HTTP status codes:

- Stock ledger accuracy and negative-stock prevention
- Purchase receiving (partial + full) updates inventory exactly once per unit received
- Wastage: staff reports require manager approval before stock is deducted; manager
  reports auto-approve and deduct immediately
- Sales deduct recipe ingredients atomically and roll back completely if any ingredient
  is insufficient; cancelling a sale reverses the deduction
- Password hashing, JWT round-trips, and permission middleware (including the
  `SUPER_ADMIN` wildcard bypass)

## API overview

All routes are versioned under `/api/v1`. Highlights:

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
POST   /api/v1/auth/change-password
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password

GET    /api/v1/products            POST   /api/v1/products
GET    /api/v1/products/:id        PATCH  /api/v1/products/:id
                                    DELETE /api/v1/products/:id

GET    /api/v1/categories | /api/v1/units | /api/v1/warehouses | /api/v1/suppliers
       (same CRUD shape as products)

GET    /api/v1/purchases           POST   /api/v1/purchases
GET    /api/v1/purchases/:id       PATCH  /api/v1/purchases/:id
POST   /api/v1/purchases/:id/receive

GET    /api/v1/inventory
GET    /api/v1/stock-movements
POST   /api/v1/stock/adjust
POST   /api/v1/stock/consume
POST   /api/v1/stock/transfer

GET    /api/v1/wastage             POST   /api/v1/wastage
POST   /api/v1/wastage/:id/review

GET    /api/v1/recipes | /api/v1/menu   (full CRUD)

GET    /api/v1/sales               POST   /api/v1/sales
POST   /api/v1/sales/:id/cancel

GET    /api/v1/users               POST   /api/v1/users
GET    /api/v1/roles               GET    /api/v1/permissions

GET    /api/v1/reports/stock | /purchases | /sales | /wastage
GET    /api/v1/dashboard
GET    /api/v1/audit-logs
```

Every response follows:

```json
{ "success": true, "message": "Product created successfully", "data": { } }
{ "success": false, "message": "Product not found", "error": "PRODUCT_NOT_FOUND" }
```

## Roles & permissions

Four system roles: `SUPER_ADMIN`, `MANAGER`, `STAFF`, `RETAIL_USER`. Authorization is
permission-based (`products.read`, `stock.adjust`, `wastage.approve`, ...), not
hardcoded role checks - see `backend/src/constants/permissions.ts` for the full
catalogue and the role->permission map, and `backend/src/middleware/authorize.ts` for
the `requirePermission()` middleware. `SUPER_ADMIN` holds a wildcard (`*`) and bypasses
the permission list entirely. The frontend mirrors this with a `<Can permission="...">`
component and route guards, but the backend is the actual enforcement boundary.

## Stock accuracy model

Every inventory-affecting action - purchase receiving, consumption, wastage approval,
sales, adjustments, transfers - funnels through one function,
`applyStockMovement(tx, ...)`, inside a database transaction. It:

1. Reads the current `Inventory` row for `(product, warehouse)`.
2. Refuses to go negative unless `allowNegative` is explicitly passed.
3. Updates the running weighted-average cost on purchases.
4. Writes the new quantity and an immutable `StockMovement` row recording
   `previousQuantity`, `newQuantity`, the signed `quantity` delta, and who/why.

This keeps `Opening Stock + Purchases + Transfers In + Positive Adjustments -
Sales/Consumption - Wastage - Transfers Out - Negative Adjustments = Current Stock`
true by construction, and gives a complete audit trail of every change.
