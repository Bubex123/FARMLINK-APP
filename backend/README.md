# FarmLink API

NestJS API used by the FarmLink frontend. It listens on port `3001` and serves routes under `/api`.

## Run locally

```powershell
cd backend
npm install
$env:JWT_SECRET = (node -p "require('crypto').randomBytes(32).toString('hex')")
npm run start:dev
```

For a compiled production build, use `npm run build` followed by `npm run start:prod`.

The API refuses to start if `JWT_SECRET` is missing or shorter than 32 characters. Copy `.env.example` to `.env`, then set `DATABASE_URL` to your pooled PostgreSQL connection string; never commit or share this secret. For the JSON import, set optional `MIGRATION_DATABASE_URL` to Neon's direct (non-pooled) connection string. Use a different randomly generated `JWT_SECRET` in each environment and store it in your host's secret manager. In production, set `FRONTEND_URL` to the exact frontend origin (or a comma-separated list of origins); the API refuses to start in production without it.

The frontend defaults to `http://localhost:3001/api`. Set `NEXT_PUBLIC_API_URL` in the frontend environment if the API runs elsewhere.

## SMS access for farmers using basic phones

Farmers can opt in from registration or their farmer dashboard. When an order is placed, the API sends an SMS through Africa's Talking with the order details and a one-time reply code. The farmer can reply `YES <order number> <code>` to confirm or `NO <order number> <code>` to reject. The API checks both the farmer's registered phone number and the one-time code; the code is removed after use. Orders still work normally when SMS credentials are absent or a text cannot be delivered.

To enable live SMS, create/configure an Africa's Talking account and add `AT_USERNAME` and `AT_API_KEY` as private environment variables on the Render backend. Add `AT_SENDER_ID` only if your provider account has an approved sender ID; otherwise leave it unset. For the provider sandbox, also set `AT_ENVIRONMENT=sandbox`; leave it unset for live traffic. Two-way replies require a provider service/number that supports incoming SMS and its callback configured to send `from` and `text` to `https://<your-render-host>/api/sms/inbound`. Confirm the callback payload and incoming SMS capability with the provider before relying on replies. Existing farmers can enable the preference in their farmer dashboard. No database migration is needed; the preference and one-time order code are stored in the existing JSON data columns.

## Implemented routes

- `GET /api/health`
- `POST /api/auth/register` with `email`, `password`, `firstName`, `lastName`, `phone`, and `role` (`buyer` or `seller`)
- `POST /api/auth/login` with `email` and `password`
- `GET /api/products?limit=48&offset=0` returns `{ data, total }`
- `POST /api/sellers` and `GET /api/sellers/me` for farmer profiles
- `PUT /api/sellers/:id/verification` for admin farm review
- `GET /api/products/mine` and `POST /api/products` for a farmer's catalog
- `GET /api/products/admin/all` for admin catalog access

Protected routes expect `Authorization: Bearer <accessToken>`. Passwords are stored as scrypt hashes. Users, farms, products, and orders are stored in separate PostgreSQL tables with relational keys. The legacy `farmlink_state` JSONB row is retained as a database backup after migration.

Farm profiles start in `pending` review status; product creation and public listings require a verified farm. Use the admin verification route to approve a farm. Admin accounts must be provisioned by an administrator; self-registration cannot assign the admin role. To import old local JSON data into a fresh database, run `npm run db:migrate:json`, then `npm run db:migrate:relational` from `backend`. For a database that already has the legacy JSONB import, run only `npm run db:migrate:relational`. Both migrations are transactional and refuse to overwrite existing relational records. The original JSON file and legacy JSONB row remain unchanged as backups.

## Security protections currently enabled

- Startup requires a 32-character `JWT_SECRET`; production also requires explicit `FRONTEND_URL` origins.
- New passwords use scrypt with `N=2^17`, `r=8`, and `p=1`. Existing hashes are upgraded after successful login.
- Login is limited to 5 attempts per email/IP per 15 minutes; registration to 10 attempts per IP per hour; other API requests to 120 per IP per minute.
- Request bodies reject unknown fields, missing required fields, oversized strings, and invalid image lists.
- Responses include basic browser security headers.

The rate limiter is process-local, so production with multiple API instances needs a shared store such as Redis. These safeguards are a foundation, not a security certification. The browser currently keeps access tokens in local storage; review session storage and operational backup policies before a high-traffic production launch.
