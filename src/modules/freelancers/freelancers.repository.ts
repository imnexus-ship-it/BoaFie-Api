import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { FreelancerProfileRow, FreelancerProfileWithUser } from './freelancer-profile.entity';

const USER_JOIN_SELECT = `
  fp.*,
  json_build_object(
    'id', u.id,
    'full_name', u.full_name,
    'avatar_url', u.avatar_url,
    'bio', u.bio,
    'status', u.status
  ) AS users
`;

export interface FreelancerFilters {
  skills?: string[];
  rate_max?: number;
  remote?: boolean;
}

@Injectable()
export class FreelancersRepository extends BaseRepository<FreelancerProfileRow> {
  constructor(db: DatabaseService) {
    super(db, 'freelancer_profiles');
  }

  findByUserId(userId: string): Promise<FreelancerProfileRow | null> {
    return this.findOne({ user_id: userId });
  }

  async findByIdWithUser(id: string): Promise<FreelancerProfileWithUser | null> {
    const { rows } = await this.db.query<FreelancerProfileWithUser>(
      `SELECT ${USER_JOIN_SELECT} FROM freelancer_profiles fp JOIN users u ON u.id = fp.user_id WHERE fp.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(
    filters: FreelancerFilters,
    sort: string | undefined,
    limit: number,
    offset: number,
  ): Promise<{ rows: FreelancerProfileWithUser[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.skills && filters.skills.length > 0) {
      values.push(filters.skills);
      conditions.push(`fp.skills && $${values.length}::text[]`);
    }
    if (filters.rate_max !== undefined) {
      values.push(filters.rate_max);
      conditions.push(`fp.hourly_rate_ghs <= $${values.length}`);
    }
    if (filters.remote !== undefined) {
      values.push(filters.remote);
      conditions.push(`fp.remote_only = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = sort === 'rate' ? 'fp.hourly_rate_ghs ASC NULLS LAST' : 'fp.created_at DESC';

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM freelancer_profiles fp ${where}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listValues = [...values, limit, offset];
    const { rows } = await this.db.query<FreelancerProfileWithUser>(
      `SELECT ${USER_JOIN_SELECT}
       FROM freelancer_profiles fp JOIN users u ON u.id = fp.user_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues,
    );

    return { rows, total };
  }

  async incrementViews(id: string): Promise<void> {
    await this.db.query('UPDATE freelancer_profiles SET profile_views = profile_views + 1 WHERE id = $1', [id]);
  }
}
