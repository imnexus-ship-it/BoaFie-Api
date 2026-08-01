import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { PortfolioItemRow } from './portfolio-item.entity';

@Injectable()
export class PortfolioRepository extends BaseRepository<PortfolioItemRow> {
  constructor(db: DatabaseService) {
    super(db, 'portfolio_items');
  }

  listForUser(userId: string): Promise<PortfolioItemRow[]> {
    return this.findMany({ user_id: userId }, { orderBy: 'created_at DESC' });
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'DELETE FROM portfolio_items WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async toggleFeatured(id: string, userId: string): Promise<PortfolioItemRow | null> {
    const { rows } = await this.db.query<PortfolioItemRow>(
      `UPDATE portfolio_items SET is_featured = NOT is_featured WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId],
    );
    return rows[0] ?? null;
  }
}
