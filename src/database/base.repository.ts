import { DatabaseService } from './database.service';

export type Where = Record<string, unknown>;

/**
 * Generic CRUD over a single table. Every method builds a parameterized
 * query — table name comes only from the subclass constructor (never from
 * user input), column names only from object keys the subclass itself
 * controls or that TypeScript already typed, values always go through
 * placeholders. Good enough for straightforward per-table access; a
 * repository can still drop to `this.db.query(...)` directly for anything
 * more bespoke (joins, PostGIS, full-text search).
 */
export abstract class BaseRepository<T extends { id: string }> {
  protected constructor(
    protected readonly db: DatabaseService,
    protected readonly table: string,
  ) {}

  private whereClause(where: Where, startAt = 1): { clause: string; values: unknown[] } {
    const keys = Object.keys(where);
    if (keys.length === 0) return { clause: '', values: [] };
    const clause =
      'WHERE ' + keys.map((k, i) => `"${k}" = $${startAt + i}`).join(' AND ');
    return { clause, values: keys.map((k) => where[k]) };
  }

  async findById(id: string): Promise<T | null> {
    const { rows } = await this.db.query<T>(
      `SELECT * FROM "${this.table}" WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findOne(where: Where): Promise<T | null> {
    const { clause, values } = this.whereClause(where);
    const { rows } = await this.db.query<T>(
      `SELECT * FROM "${this.table}" ${clause} LIMIT 1`,
      values,
    );
    return rows[0] ?? null;
  }

  async findMany(
    where: Where = {},
    opts: { limit?: number; offset?: number; orderBy?: string } = {},
  ): Promise<T[]> {
    const { clause, values } = this.whereClause(where);
    const order = opts.orderBy ? `ORDER BY ${opts.orderBy}` : '';
    let sql = `SELECT * FROM "${this.table}" ${clause} ${order}`;
    const params = [...values];
    if (opts.limit !== undefined) {
      params.push(opts.limit);
      sql += ` LIMIT $${params.length}`;
    }
    if (opts.offset !== undefined) {
      params.push(opts.offset);
      sql += ` OFFSET $${params.length}`;
    }
    const { rows } = await this.db.query<T>(sql, params);
    return rows;
  }

  async count(where: Where = {}): Promise<number> {
    const { clause, values } = this.whereClause(where);
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM "${this.table}" ${clause}`,
      values,
    );
    return parseInt(rows[0].count, 10);
  }

  async insert(data: Record<string, unknown>): Promise<T> {
    const keys = Object.keys(data);
    const columns = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await this.db.query<T>(
      `INSERT INTO "${this.table}" (${columns}) VALUES (${placeholders}) RETURNING *`,
      keys.map((k) => data[k]),
    );
    return rows[0];
  }

  async updateById(id: string, data: Record<string, unknown>): Promise<T | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) return this.findById(id);
    const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const { rows } = await this.db.query<T>(
      `UPDATE "${this.table}" SET ${set} WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => data[k]), id],
    );
    return rows[0] ?? null;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.query(`DELETE FROM "${this.table}" WHERE id = $1`, [id]);
  }
}
