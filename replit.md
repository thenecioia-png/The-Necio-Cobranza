# The Necio Cobranza — Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
Full-stack debt collection SaaS for the Dominican Republic — dark theme, red accents, Spanish UI.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Charts**: recharts (AreaChart, PieChart, BarChart)
- **Animations**: framer-motion
- **Payments**: Stripe (via Replit connector `conn_stripe_01KMG23FJ50CNTF9N7A6B36A18`)
- **WhatsApp**: Twilio — ACTIVO. Secretos configurados: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`. El middleware inyecta el cliente en cada request. Confirmación automática al cobrar una cuota. Recordatorios masivos desde `/billing`.

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── necio-app/          # React frontend (Vite)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — actual JS bundling by esbuild/vite
- **Project references** — A depends on B → A's tsconfig lists B in `references`

## Root Scripts

- `pnpm run build` — typecheck then recursively build all packages
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API. Routes in `src/routes/`. Auth via cookie-session (`necio_session`).

Key routes:
- `GET /api/health`
- `POST /api/auth/login`, `POST /api/auth/register` (creates business + admin)
- `GET /api/auth/me`
- `GET /api/clients`, `POST /api/clients`
- `GET /api/loans`, `POST /api/loans`
- `GET /api/installments/today`, `POST /api/installments/:id/pay`
- `POST /api/installments/pay-bulk`, `POST /api/installments/abono/:clientId`
- `GET /api/dashboard/stats`, `GET /api/dashboard/cash-flow`
- `GET /api/dashboard/top-cobradores`, `GET /api/dashboard/payment-methods`
- `GET /api/cobradores`, `POST /api/cobradores`
- `POST /api/storage/uploads/request-url`, `GET /api/storage/objects/*`
- `GET /api/stripe/plans`, `GET /api/stripe/subscription`
- `POST /api/stripe/create-checkout`, `POST /api/stripe/cancel`
- `GET /api/notifications/whatsapp/status`
- `POST /api/notifications/whatsapp/payment-confirmation`
- `POST /api/notifications/whatsapp/payment-reminder`
- `POST /api/notifications/whatsapp/bulk-reminders`
- `GET /api/backup/settings`, `POST /api/backup/settings` — load/save backup config (email, frequency, smtp)
- `POST /api/backup/send` — sends CSV backup via Gmail SMTP (nodemailer)
- `GET /api/backup/download?type=clientes|prestamos|cuotas` — download CSV with UTF-8 BOM

Lib helpers:
- `src/lib/stripe.ts` — Replit connector-based Stripe client (`getUncachableStripeClient()`)

### `lib/db` (`@workspace/db`)

Database schema tables:
- `businesses` — id, name, planType, stripeCustomerId, stripeSubscriptionId, subscriptionStatus
- `users` — id, name, username, passwordHash, role, businessId
- `clients` — id, name, phone, address, sector, ciudad, riskScore, businessId
- `loans` — id, clientId, principal, interestRate, frequency, startDate, status
- `installments` — id, loanId, clientId, dueDate, amount, status, paymentMethod, gpsLat, gpsLng, photoUrl, cobradorId, paidAt
- `backup_settings` — id, businessId, email, frequency, enabled, lastSentAt, smtpUser, smtpPass

Push schema: `pnpm --filter @workspace/db run push`

### `artifacts/necio-app` (`@workspace/necio-app`)

React frontend pages:
- `/` — Login
- `/register` — Register (creates business + admin account)
- `/dashboard` — KPI cards + recharts (cash flow area chart, payment method pie, top cobradores ranking)
- `/today` — Daily collection route with GPS capture, photo upload, single/bulk pay, abono modal, offline banner
- `/clients` — Client list with risk scoring, avatar photos (uses GetClientsResponseItem which now includes avatarUrl + cobrador)
- `/clients/:id` — Client detail
- `/clients/new` — Create client
- `/loans/new` — Create loan
- `/cobradores` — Cobrador management (admin only)
- `/billing` — Subscription plan cards + WhatsApp notification management + Respaldo de Datos (admin only)

Layout (`src/components/layout.tsx`):
- `useIsDesktop()` hook detects viewport >= 768px
- Mobile: renders hamburger top bar (h-14), sidebar hidden with aria-hidden when closed
- Desktop: persistent sidebar (w-64), no hamburger
- Sidebar opens via hamburger button (aria-label="Abrir menú"), closes via X or overlay tap

Service worker at `public/sw.js`:
- Caches GET API responses for offline use
- Queues payment POSTs in IndexedDB when offline
- Syncs on reconnect (SYNC_NOW message, BackgroundSync tag)

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

## Auth

- Cookie session: `necio_session`, SHA-256 password hash
- Default admin: username `admin`, password `admin123`
- Roles: `admin` (full access), `cobrador` (only sees today route)
- Multi-tenancy: every query filtered by `businessId` from session user

## Object Storage

- Bucket: `replit-objstore-8fe8e2d1-345e-4d2e-ab74-3bfc5af1e965`
- Flow: `POST /api/storage/uploads/request-url` → PUT to GCS → save `objectPath` in DB
- Serve: `GET /api/storage/objects/{path}`

## Integrations

### Stripe ✅ Connected
- Replit connector: `conn_stripe_01KMG23FJ50CNTF9N7A6B36A18`
- Client via `getUncachableStripeClient()` in `src/lib/stripe.ts`
- Plans: Basic (free, 50 clients), Pro ($29/mo, unlimited), Enterprise ($99/mo)
- Webhooks: `/api/stripe/webhook`

### Twilio / WhatsApp ⚠️ NOT YET CONNECTED
- User dismissed the Replit Twilio integration flow.
- To enable WhatsApp notifications, either:
  1. Connect via Replit integration: connector ID `ccfg_twilio_01K69QJTED9YTJFE2SJ7E4SY08`
  2. Or provide `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM` as env secrets
- Backend routes are fully implemented in `src/routes/notifications.ts`
- UI is on the `/billing` page, shows status and falls back gracefully if not configured

## Frequency Enum

`"daily"` | `"weekly"` | `"biweekly"` | `"monthly"` (English values in DB)

## UI Conventions

- Language: Spanish
- Currency: `formatRD()` in `artifacts/necio-app/src/lib/utils.ts`
- Theme: Dark with red accent (`--primary: 225 29 72`)
- Font: `font-display` (Rajdhani) for headings
