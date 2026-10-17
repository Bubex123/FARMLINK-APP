import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { CREATE_STATE_TABLE } from '../src/database.service';

type LegacyStore = { users?: unknown[]; sellers?: unknown[]; products?: unknown[]; orders?: unknown[] };

async function migrate() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is missing from backend/.env.');

  const file = process.env.FARMLINK_DATA_FILE || resolve(process.cwd(), 'data', 'farmlink.json');
  let data: LegacyStore = { users: [], sellers: [], products: [], orders: [] };
  try {
    data = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')) as LegacyStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    console.log(`No legacy JSON file found at ${file}; the database will remain empty.`);
  }
  data.users ||= [];
  data.sellers ||= [];
  data.products ||= [];
  data.orders ||= [];

  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(CREATE_STATE_TABLE);
    await client.query(`CREATE TABLE IF NOT EXISTS farmlink_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const prior = await client.query('SELECT 1 FROM farmlink_migrations WHERE name = $1', ['001_import_json_store']);
    if (prior.rowCount) {
      await client.query('COMMIT');
      console.log('JSON migration was already applied; no data was changed.');
      return;
    }

    const current = await client.query<{ data: LegacyStore }>('SELECT data FROM farmlink_state WHERE id = 1 FOR UPDATE');
    const existing = current.rows[0]?.data;
    const hasExistingData = existing && ['users', 'sellers', 'products', 'orders'].some((key) => ((existing as Record<string, unknown>)[key] as unknown[] | undefined)?.length);
    if (hasExistingData) throw new Error('The PostgreSQL database already contains FarmLink records; refusing to overwrite them.');

    await client.query(
      `INSERT INTO farmlink_state (id, data, updated_at) VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [JSON.stringify(data)],
    );
    await client.query('INSERT INTO farmlink_migrations (name) VALUES ($1)', ['001_import_json_store']);
    await client.query('COMMIT');
    console.log(`Imported records: ${data.users.length} users, ${data.sellers.length} farms, ${data.products.length} products, ${data.orders.length} orders.`);
    console.log('The source JSON file was left unchanged as a backup.');
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
  console.error(`FarmLink data migration failed (${failure.name || 'Error'}): ${message}`);
  process.exitCode = 1;
});
