# FarmLink

FarmLink is a farm-to-customer marketplace for Tanzania. Customers can discover produce from approved farms, place cash-on-delivery orders, and follow each order as the farmer accepts and delivers it. Farmers can create a farm profile and manage product listings. Admins review farm applications and oversee marketplace activity.

## Main features

- Customer and farmer registration, login, and role-based dashboards.
- Admin review and approval for farmer profiles before their products appear publicly.
- Product browsing, shopping basket, checkout, and cash-on-delivery orders.
- Order status tracking for customers and order management for farmers.
- PostgreSQL persistence for users, farms, products, and orders.

## Technology

- **Frontend:** Next.js and React (`frontend/`)
- **Backend:** NestJS REST API (`backend/`)
- **Database:** PostgreSQL; the current hosted database is on Neon.

The frontend runs on port `3000`; the backend runs on port `3001` and exposes routes under `/api`.

## Run locally

Use Node.js and npm. Install dependencies in each application folder:

```powershell
cd backend
npm install
```

Create `backend/.env` from `backend/.env.example` and set `DATABASE_URL` to the PostgreSQL connection string and `JWT_SECRET` to a random secret of at least 32 characters. Keep `.env` private and out of Git.

Start the API in the first terminal:

```powershell
cd backend
npm run start:dev
```

Install and start the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API health endpoint is [http://localhost:3001/api/health](http://localhost:3001/api/health). The frontend uses that local API address by default; set `NEXT_PUBLIC_API_URL` if the backend is hosted elsewhere.

## Database migration

The backend uses separate PostgreSQL tables for users, farms, products, and orders. The old `farmlink_state` JSONB row and local JSON file are retained as backups. For a database that already has the JSONB import, run this once from `backend/`:

```powershell
npm run db:migrate:relational
```

For a new database that still needs the original local JSON data imported, run `npm run db:migrate:json` first, then `npm run db:migrate:relational`. These migrations refuse to overwrite populated relational tables.

## Deployment configuration

Set secrets in the hosting providers' environment settings; do not commit them:

- **Backend:** `DATABASE_URL`, a unique `JWT_SECRET` (32+ characters), and `FRONTEND_URL` set to the exact deployed frontend origin.
- **Frontend:** `NEXT_PUBLIC_API_URL` set to the deployed backend URL ending in `/api`.

FarmLink currently supports cash on delivery. Before scaling to multiple backend instances, replace the process-local rate-limit storage with a shared store and review session storage and operational backup policies.
