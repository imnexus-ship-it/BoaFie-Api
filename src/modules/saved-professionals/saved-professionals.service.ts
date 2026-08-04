import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SavedProfessionalsService {
  constructor(private readonly db: DatabaseService) {}

  async list(clientId: string) {
    const { rows } = await this.db.query(
      `SELECT sp.id, sp.worker_user_id, sp.created_at,
         u.full_name, u.avatar_url, u.role,
         ap.id AS artisan_profile_id, ap.trade_category,
         fp.id AS freelancer_profile_id, fp.title,
         r.avg_rating, r.review_count
       FROM saved_professionals sp
       JOIN users u ON u.id = sp.worker_user_id
       LEFT JOIN artisan_profiles ap ON ap.user_id = sp.worker_user_id
       LEFT JOIN freelancer_profiles fp ON fp.user_id = sp.worker_user_id
       LEFT JOIN (
         SELECT reviewee_id, AVG(rating)::numeric(3,2) AS avg_rating, COUNT(*) AS review_count
         FROM reviews WHERE is_public = TRUE GROUP BY reviewee_id
       ) r ON r.reviewee_id = sp.worker_user_id
       WHERE sp.client_id = $1
       ORDER BY sp.created_at DESC`,
      [clientId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      worker_user_id: row.worker_user_id,
      profile_id: row.artisan_profile_id ?? row.freelancer_profile_id ?? null,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      role: row.role,
      heading: row.trade_category ?? row.title ?? null,
      avg_rating: row.avg_rating ? Number(row.avg_rating) : null,
      review_count: row.review_count ? Number(row.review_count) : 0,
      saved_at: row.created_at,
    }));
  }

  async save(clientId: string, workerUserId: string) {
    const { rows: workerRows } = await this.db.query('SELECT id FROM users WHERE id = $1', [workerUserId]);
    if (!workerRows[0]) throw new NotFoundException('Professional not found');

    const { rows: existing } = await this.db.query(
      'SELECT 1 FROM saved_professionals WHERE client_id = $1 AND worker_user_id = $2',
      [clientId, workerUserId],
    );
    if (existing[0]) throw new ConflictException('Already saved');

    await this.db.query('INSERT INTO saved_professionals (client_id, worker_user_id) VALUES ($1, $2)', [
      clientId,
      workerUserId,
    ]);
    return { saved: true };
  }

  async unsave(clientId: string, workerUserId: string) {
    await this.db.query('DELETE FROM saved_professionals WHERE client_id = $1 AND worker_user_id = $2', [
      clientId,
      workerUserId,
    ]);
    return { saved: false };
  }
}
