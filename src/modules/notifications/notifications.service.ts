import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { NotificationType } from './notification.entity';

function toDto(row: any) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    is_read: row.is_read,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly notifications: NotificationsRepository) {}

  /** Fire-and-forget from other modules on real lifecycle events — never throws into the caller's flow. */
  async notify(userId: string, type: NotificationType, title: string, body?: string, data?: Record<string, unknown>) {
    try {
      if (!(await this.notifications.isEnabled(userId, type))) return;
      await this.notifications.create(userId, type, title, body, data);
    } catch {
      // A notification failing to write should never fail the underlying
      // action (accepting a proposal, releasing a milestone, etc).
    }
  }

  async listForUser(userId: string, page = 1, limit = 20) {
    const { rows, total } = await this.notifications.listForUser(userId, page, limit);
    return { items: rows.map(toDto), meta: { page, limit, total } };
  }

  async countUnread(userId: string): Promise<number> {
    return this.notifications.countUnread(userId);
  }

  async markRead(id: string, userId: string) {
    const updated = await this.notifications.markRead(id, userId);
    if (!updated) throw new NotFoundException('Notification not found');
    return { id, is_read: true };
  }

  async markAllRead(userId: string) {
    await this.notifications.markAllRead(userId);
    return { marked: true };
  }
}
