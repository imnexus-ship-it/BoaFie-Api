import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

/**
 * Minimal migration runner: applies every migrations/*.sql file, in
 * filename order, inside its own transaction, tracked in a
 * schema_migrations table so re-running is a no-op for files already
 * applied. No new dependency (node-pg-migrate etc.) — the migrations here
 * are simple enough not to need one.
 */
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dir = join(__dirname, 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (rows.length > 0) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`apply ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`FAILED ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log('migrations complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
