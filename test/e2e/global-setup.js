// Runs once in Jest's main process before any e2e test file starts.
// Plain CommonJS (not ts-jest transformed) per Jest's globalSetup contract.
const { config } = require('dotenv');
const { resolve } = require('path');
const { readdirSync, readFileSync } = require('fs');
const { Pool } = require('pg');

config({ path: resolve(__dirname, '../../.env.test') });

const TEST_DB_URL = process.env.DATABASE_URL;
const TEST_DB_NAME = new URL(TEST_DB_URL).pathname.replace(/^\//, '');
const MAINTENANCE_URL = TEST_DB_URL.replace(`/${TEST_DB_NAME}`, '/postgres');

const TRANSACTIONAL_TABLES = [
  'refresh_tokens', 'id_blocklist', 'verifications', 'artisan_profiles', 'freelancer_profiles',
  'portfolio_items', 'jobs', 'proposals', 'contracts', 'milestones', 'escrow_accounts',
  'escrow_releases', 'wallets', 'transactions', 'conversations', 'messages', 'reviews',
  'saved_workers', 'saved_jobs', 'notifications', 'disputes', 'admin_audit_log', 'users',
];

module.exports = async function globalSetup() {
  const maintenance = new Pool({ connectionString: MAINTENANCE_URL });
  const { rows } = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB_NAME]);
  if (rows.length === 0) {
    await maintenance.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  }
  await maintenance.end();

  const db = new Pool({ connectionString: TEST_DB_URL });

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const migrationsDir = resolve(__dirname, '../../src/database/migrations');
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const { rows: applied } = await db.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (applied.length > 0) continue;
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
  }

  // Clean slate for every e2e run — keep categories/platform_settings (static
  // reference data seeded by migrations) so GET /categories etc. still work.
  await db.query(`TRUNCATE TABLE ${TRANSACTIONAL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);

  await db.end();
};
