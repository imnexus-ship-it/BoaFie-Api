import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TOGGLEABLE_NOTIFICATION_TYPES } from '../notifications/notification.entity';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { toPublicUser } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async getMe(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user);
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const updated = await this.users.updateById(userId, dto as Record<string, unknown>);
    if (!updated) throw new NotFoundException('User not found');
    return toPublicUser(updated);
  }

  /** Absence of a key means enabled (default-on) — see notifications.repository.ts's isEnabled(). */
  async getNotificationPreferences(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const prefs = user.notification_prefs ?? {};
    return Object.fromEntries(TOGGLEABLE_NOTIFICATION_TYPES.map((type) => [type, prefs[type] !== false]));
  }

  async updateNotificationPreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const merged = { ...(user.notification_prefs ?? {}), ...dto };
    await this.db.query('UPDATE users SET notification_prefs = $2 WHERE id = $1', [userId, JSON.stringify(merged)]);
    return this.getNotificationPreferences(userId);
  }

  async getPublicProfile(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      avatar_url: user.avatar_url,
      bio: user.bio,
    };
  }

  async getDashboard(userId: string, role: string) {
    const walletRow = await this.db.query<{ balance_ghs: string; pending_ghs: string; lifetime_earned: string }>(
      'SELECT balance_ghs, pending_ghs, lifetime_earned FROM wallets WHERE user_id = $1',
      [userId],
    );
    const wallet = walletRow.rows[0]
      ? {
          balance_ghs: Number(walletRow.rows[0].balance_ghs),
          pending_ghs: Number(walletRow.rows[0].pending_ghs),
          lifetime_earned: Number(walletRow.rows[0].lifetime_earned),
        }
      : null;

    const unreadNotifications = await this.notifications.countUnread(userId);
    const base = { role, unread_notifications: unreadNotifications, wallet };

    if (role === 'client') {
      const { rows } = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM jobs WHERE client_id = $1 AND status IN ('open','in_progress')`,
        [userId],
      );
      const { rows: contractRows } = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM contracts WHERE client_id = $1 AND status = 'in_progress'`,
        [userId],
      );
      // "Pending actions" = milestones actually waiting on this client right
      // now (submitted for review) — a more precise trigger for attention
      // than just counting every in-progress contract.
      const { rows: pendingActionRows } = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM milestones m JOIN contracts c ON c.id = m.contract_id
         WHERE c.client_id = $1 AND m.status = 'submitted'`,
        [userId],
      );
      return {
        ...base,
        active_jobs: parseInt(rows[0].count, 10),
        open_contracts: parseInt(contractRows[0].count, 10),
        pending_actions: parseInt(pendingActionRows[0].count, 10),
      };
    }

    const { rows: proposalRows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM proposals WHERE worker_id = $1 AND status = 'pending'`,
      [userId],
    );
    const { rows: contractRows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM contracts WHERE worker_id = $1 AND status = 'in_progress'`,
      [userId],
    );
    return {
      ...base,
      active_proposals: parseInt(proposalRows[0].count, 10),
      open_contracts: parseInt(contractRows[0].count, 10),
    };
  }

  /**
   * Soft-delete: scrubs PII and blocks login, but keeps the row (and its
   * id) intact since contracts/transactions/reviews reference it. Blocked
   * while the user has an open contract — deleting mid-escrow would orphan
   * funds a counterparty is relying on.
   */
  async deleteMe(userId: string) {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM contracts WHERE (client_id = $1 OR worker_id = $1) AND status = 'in_progress'`,
      [userId],
    );
    if (parseInt(rows[0].count, 10) > 0) {
      throw new ConflictException('Cannot delete account while a contract is in progress. Complete or resolve it first.');
    }

    await this.db.query(
      `UPDATE users SET
         status = 'deleted',
         deleted_at = NOW(),
         email = 'deleted-' || id || '@deleted.boafie.local',
         phone = NULL,
         password_hash = NULL,
         google_id = NULL,
         full_name = 'Deleted user',
         avatar_url = NULL,
         bio = NULL
       WHERE id = $1`,
      [userId],
    );
    await this.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    await this.db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

    return { deleted: true };
  }
}
