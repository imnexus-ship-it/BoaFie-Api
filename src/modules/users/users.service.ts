import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
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
      return {
        ...base,
        active_jobs: parseInt(rows[0].count, 10),
        open_contracts: parseInt(contractRows[0].count, 10),
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
}
