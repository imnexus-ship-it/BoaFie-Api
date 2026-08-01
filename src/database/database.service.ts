import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import databaseConfig from '../config/database.config';

/**
 * Thin wrapper over a pg Pool. Every repository goes through this instead
 * of talking to `pg` directly, so swapping the underlying client (e.g. to
 * Supabase's Postgres later) only touches this one file.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool: Pool;

  constructor(@Inject(databaseConfig.KEY) config: ConfigType<typeof databaseConfig>) {
    this.pool = new Pool({
      connectionString: config.url,
      // Neon (and most managed Postgres) requires SSL; pg's own parsing of
      // `sslmode=require` from the connection string isn't reliable enough
      // to depend on, so set it explicitly. Local dev URLs have no
      // sslmode param and are left alone.
      ssl: config.url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
    });
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
