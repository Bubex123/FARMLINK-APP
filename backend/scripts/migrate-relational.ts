import 'dotenv/config';
import { Client } from 'pg';
import { CREATE_RELATIONAL_SCHEMA, persistStore } from '../src/database.service';
import type { Store } from '../src/store.models';

async function migrate() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is missing from backend/.env.');

  const client = new Client({ connectionString, connectionTimeoutMillis: 30000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(54121984)');
    await client.query(CREATE_RELATIONAL_SCHEMA);
    await client.query('CREATE TABLE IF NOT EXISTS farmlink_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const migrationName = '002_normalize_json_store';
    const prior = await client.query('SELECT 1 FROM farmlink_migrations WHERE name = $1', [migrationName]);
    if (prior.rowCount) {
      await client.query('COMMIT');
      console.log('Relational migration was already applied; no data was changed.');
      return;
    }

    const legacy = await client.query<{ data: Store }>('SELECT data FROM farmlink_state WHERE id = 1');
    if (!legacy.rows[0]?.data) throw new Error('The legacy FarmLink JSONB backup row was not found.');
    const counts = await client.query<{ count: string }>(`SELECT
      (SELECT count(*) FROM farmlink_users) + (SELECT count(*) FROM farmlink_sellers) +
      (SELECT count(*) FROM farmlink_products) + (SELECT count(*) FROM farmlink_orders) AS count`);
    if (Number(counts.rows[0]?.count || 0) > 0) throw new Error('Relational tables already contain records and this migration has no completion marker; refusing to overwrite them.');

    const data = legacy.rows[0].data;
    data.orders ||= [];
    await persistStore(client, data);
    await client.query('INSERT INTO farmlink_migrations (name) VALUES ($1)', [migrationName]);
    await client.query('COMMIT');
    console.log(`Moved records into relational tables: ${data.users.length} users, ${data.sellers.length} farms, ${data.products.length} products, ${data.orders.length} orders.`);
    console.log('The original farmlink_state JSONB row was left unchanged as a database backup.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch((error: unknown) => {
  const failure = error as { name?: string; message?: string; code?: string; errors?: Array<{ code?: string; message?: string }> };
  const causes = failure.errors?.map((cause) => cause.code || cause.message || 'unknown connection error').join(', ');
  const message = failure.message || failure.code || causes || 'Unknown migration error';
  console.error(`FarmLink relational migration failed (${failure.name || 'Error'}): ${message}`);
  process.exitCode = 1;
});
