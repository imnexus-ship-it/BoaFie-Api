import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { ArtisanProfileRow, ArtisanProfileWithUser } from './artisan-profile.entity';

const USER_JOIN_SELECT = `
  ap.*,
  json_build_object(
    'id', u.id,
    'full_name', u.full_name,
    'avatar_url', u.avatar_url,
    'bio', u.bio,
    'status', u.status
  ) AS users
`;

export interface ArtisanFilters {
  category?: string;
  location?: string;
  availability?: string;
  rate_max?: number;
}

@Injectable()
export class ArtisansRepository extends BaseRepository<ArtisanProfileRow> {
  constructor(db: DatabaseService) {
    super(db, 'artisan_profiles');
  }

  findByUserId(userId: string): Promise<ArtisanProfileRow | null> {
    return this.findOne({ user_id: userId });
  }

  async findByIdWithUser(id: string): Promise<ArtisanProfileWithUser | null> {
    const { rows } = await this.db.query<ArtisanProfileWithUser>(
      `SELECT ${USER_JOIN_SELECT} FROM artisan_profiles ap JOIN users u ON u.id = ap.user_id WHERE ap.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(
    filters: ArtisanFilters,
    sort: string | undefined,
    limit: number,
    offset: number,
  ): Promise<{ rows: ArtisanProfileWithUser[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.category) {
      values.push(filters.category);
      conditions.push(`ap.trade_category = $${values.length}`);
    }
    if (filters.location) {
      values.push(`%${filters.location}%`);
      conditions.push(`ap.location_text ILIKE $${values.length}`);
    }
    if (filters.availability) {
      values.push(filters.availability);
      conditions.push(`ap.availability = $${values.length}`);
    }
    if (filters.rate_max !== undefined) {
      values.push(filters.rate_max);
      conditions.push(`ap.hourly_rate_ghs <= $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy =
      sort === 'rate'
        ? 'ap.hourly_rate_ghs ASC NULLS LAST'
        : sort === 'jobs_done'
          ? 'ap.total_jobs_done DESC'
          : 'ap.created_at DESC';

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM artisan_profiles ap ${where}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listValues = [...values, limit, offset];
    const { rows } = await this.db.query<ArtisanProfileWithUser>(
      `SELECT ${USER_JOIN_SELECT}
       FROM artisan_profiles ap JOIN users u ON u.id = ap.user_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues,
    );

    return { rows, total };
  }

  async incrementViews(id: string): Promise<void> {
    await this.db.query('UPDATE artisan_profiles SET profile_views = profile_views + 1 WHERE id = $1', [id]);
  }
}
