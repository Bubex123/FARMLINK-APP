import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { Store } from './store.models';

export const CREATE_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS farmlink_state (
    id smallint PRIMARY KEY CHECK (id = 1),
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

export const CREATE_RELATIONAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS farmlink_users (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    role text NOT NULL,
    password_hash text NOT NULL,
    data jsonb NOT NULL
  );
  CREATE TABLE IF NOT EXISTS farmlink_sellers (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE REFERENCES farmlink_users(id) ON DELETE CASCADE,
    verification_status text NOT NULL,
    data jsonb NOT NULL
  );
  CREATE TABLE IF NOT EXISTS farmlink_products (
    id uuid PRIMARY KEY,
    seller_id uuid NOT NULL REFERENCES farmlink_sellers(id) ON DELETE CASCADE,
    name text NOT NULL,
    category text NOT NULL,
    price numeric(12, 2) NOT NULL CHECK (price > 0),
    quantity numeric(12, 3) NOT NULL CHECK (quantity >= 0),
    is_active boolean NOT NULL DEFAULT true,
    data jsonb NOT NULL
  );
  CREATE TABLE IF NOT EXISTS farmlink_orders (
    id uuid PRIMARY KEY,
    order_number text NOT NULL UNIQUE,
    buyer_id uuid NOT NULL REFERENCES farmlink_users(id),
    seller_id uuid NOT NULL REFERENCES farmlink_sellers(id),
    product_id uuid NOT NULL REFERENCES farmlink_products(id),
    status text NOT NULL,
    created_at timestamptz NOT NULL,
    data jsonb NOT NULL
  );
  CREATE INDEX IF NOT EXISTS farmlink_products_marketplace_idx ON farmlink_products (is_active, category);
  CREATE INDEX IF NOT EXISTS farmlink_orders_buyer_created_idx ON farmlink_orders (buyer_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS farmlink_orders_seller_created_idx ON farmlink_orders (seller_id, created_at DESC);
`;

type Queryable = Pick<PoolClient, 'query'>;

export async function persistStore(queryable: Queryable, data: Store) {
  await queryable.query('DELETE FROM farmlink_orders');
  await queryable.query('DELETE FROM farmlink_products');
  await queryable.query('DELETE FROM farmlink_sellers');
  await queryable.query('DELETE FROM farmlink_users');

  for (const user of data.users) {
    await queryable.query('INSERT INTO farmlink_users (id, email, role, password_hash, data) VALUES ($1, $2, $3, $4, $5::jsonb)', [user.id, user.email, user.role, user.passwordHash, JSON.stringify(user)]);
  }
  for (const seller of data.sellers) {
    await queryable.query('INSERT INTO farmlink_sellers (id, user_id, verification_status, data) VALUES ($1, $2, $3, $4::jsonb)', [seller.id, seller.userId, seller.verificationStatus, JSON.stringify(seller)]);
  }
  for (const product of data.products) {
    await queryable.query('INSERT INTO farmlink_products (id, seller_id, name, category, price, quantity, is_active, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)', [product.id, product.sellerId, product.name, product.category, product.price, product.quantity, product.isActive, JSON.stringify(product)]);
  }
  for (const order of data.orders || []) {
    await queryable.query('INSERT INTO farmlink_orders (id, order_number, buyer_id, seller_id, product_id, status, created_at, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)', [order.id, order.orderNumber, order.buyerId, order.sellerId, order.productId, order.status, order.createdAt, JSON.stringify(order)]);
  }
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly pool: Pool;
  private readonly transactionContext = new AsyncLocalStorage<PoolClient>();

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is missing. Add your Neon connection string to backend/.env.');
    // Allow a sleeping Neon compute endpoint enough time to wake on the first request.
    this.pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 30000, idleTimeoutMillis: 30000 });
    this.pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', error.message));
  }

  async onModuleInit() {
    await this.pool.query(CREATE_RELATIONAL_SCHEMA);
    await this.pool.query('CREATE TABLE IF NOT EXISTS farmlink_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.transactionContext.getStore()) return operation();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize changes to this small marketplace store across API instances.
      await client.query('SELECT pg_advisory_xact_lock(54121984)');
      const result = await this.transactionContext.run(client, operation);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async query<T extends QueryResultRow>(sql: string) {
    const client = this.transactionContext.getStore();
    return client ? client.query<T>(sql) : this.pool.query<T>(sql);
  }

  async loadStore(): Promise<Store> {
    const read = async (): Promise<Store> => {
      const [users, sellers, products, orders] = await Promise.all([
        this.query<{ data: Store['users'][number] }>('SELECT data FROM farmlink_users ORDER BY id'),
        this.query<{ data: Store['sellers'][number] }>('SELECT data FROM farmlink_sellers ORDER BY id'),
        this.query<{ data: Store['products'][number] }>('SELECT data FROM farmlink_products ORDER BY id'),
        this.query<{ data: Store['orders'][number] }>('SELECT data FROM farmlink_orders ORDER BY created_at'),
      ]);
      return { users: users.rows.map((row) => row.data), sellers: sellers.rows.map((row) => row.data), products: products.rows.map((row) => row.data), orders: orders.rows.map((row) => row.data) };
    };

    if (this.transactionContext.getStore()) return read();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result = await this.transactionContext.run(client, read);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async saveStore(data: Store) {
    const client = this.transactionContext.getStore();
    if (!client) throw new Error('A database transaction is required to save FarmLink data.');
    await persistStore(client, data);
  }
}
