import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { NotificationRow, NotificationType } from './notification.entity';
import { offsetFor } from '../../common/dto/pagination.dto';

@Injectable()
export class NotificationsRepository extends BaseRepository<NotificationRow> {
  constructor(db: DatabaseService) {
    super(db, 'notifications');
  }

  create(userId: string, type: NotificationType, title: string, body?: string, data?: Record<string, unknown>) {
    return this.insert({
      user_id: userId,
      type,
      title,
      body: body ?? null,
      data: data ? JSON.stringify(data) : null,
    });
  }

  /** Absence of a key in `notification_prefs` means enabled (default-on). */
  async isEnabled(userId: string, type: NotificationType): Promise<boolean> {
    const { rows } = await this.db.query<{ enabled: boolean | null }>(
      `SELECT (notification_prefs->>$2)::boolean AS enabled FROM users WHERE id = $1`,
      [userId, type],
    );
    return rows[0]?.enabled !== false;
  }

  async listForUser(userId: string, page = 1, limit = 20) {
    const total = await this.count({ user_id: userId });
    const rows = await this.findMany(
      { user_id: userId },
      { limit, offset: offsetFor(page, limit), orderBy: 'created_at DESC' },
    );
    return { rows, total };
  }

  async countUnread(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId],
    );
    return parseInt(rows[0].count, 10);
  }

  async markRead(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    );
  }
}
