import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { offsetFor } from '../../common/dto/pagination.dto';
import { toPublicUser } from '../users/user.entity';
import { SuspendUserDto, ResolveDisputeDto } from './dto/admin-actions.dto';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async stats() {
    const q = (sql: string) => this.db.query<{ count: string }>(sql).then((r) => parseInt(r.rows[0].count, 10));
    const [totalUsers, totalArtisans, totalFreelancers, openJobs, activeContracts, openDisputes] =
      await Promise.all([
        q('SELECT COUNT(*) FROM users'),
        q(`SELECT COUNT(*) FROM users WHERE role = 'artisan'`),
        q(`SELECT COUNT(*) FROM users WHERE role = 'freelancer'`),
        q(`SELECT COUNT(*) FROM jobs WHERE status = 'open'`),
        q(`SELECT COUNT(*) FROM contracts WHERE status = 'in_progress'`),
        q(`SELECT COUNT(*) FROM disputes WHERE status IN ('open', 'under_review')`),
      ]);
    const { rows } = await this.db.query<{ total: string | null }>(
      `SELECT SUM(commission_amount) AS total FROM transactions WHERE commission_amount IS NOT NULL`,
    );
    return {
      total_users: totalUsers,
      total_artisans: totalArtisans,
      total_freelancers: totalFreelancers,
      open_jobs: openJobs,
      active_contracts: activeContracts,
      open_disputes: openDisputes,
      total_commission_earned_ghs: Number(rows[0].total ?? 0),
    };
  }

  async listUsers(page = 1, limit = 20, role?: string, status?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: countRows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM users ${where}`,
      params,
    );
    const total = parseInt(countRows[0].count, 10);

    const listParams = [...params, limit, offsetFor(page, limit)];
    const { rows } = await this.db.query(
      `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );
    return { items: rows.map(toPublicUser), meta: { page, limit, total } };
  }

  private async setUserStatus(
    userId: string,
    status: 'active' | 'suspended' | 'banned',
    adminId: string,
    reason?: string,
  ) {
    const { rows } = await this.db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!rows[0]) throw new NotFoundException('User not found');

    await this.db.query('UPDATE users SET status = $2 WHERE id = $1', [userId, status]);
    await this.db.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, 'user', $3, $4)`,
      [adminId, `user_${status}`, userId, JSON.stringify({ reason: reason ?? null })],
    );

    if (status === 'banned') {
      const { rows: verificationRows } = await this.db.query(
        'SELECT id_number FROM verifications WHERE user_id = $1 AND id_number IS NOT NULL',
        [userId],
      );
      if (verificationRows[0]?.id_number) {
        await this.db.query(
          'INSERT INTO id_blocklist (id_number, banned_user_id, reason) VALUES ($1, $2, $3)',
          [verificationRows[0].id_number, userId, reason ?? 'Banned by admin'],
        );
      }
    }
    return { id: userId, status };
  }

  suspendUser(userId: string, adminId: string, dto: SuspendUserDto) {
    return this.setUserStatus(userId, 'suspended', adminId, dto.reason);
  }

  banUser(userId: string, adminId: string, dto: SuspendUserDto) {
    return this.setUserStatus(userId, 'banned', adminId, dto.reason);
  }

  reinstateUser(userId: string, adminId: string) {
    return this.setUserStatus(userId, 'active', adminId);
  }

  async listJobs(page = 1, limit = 20, status?: string, flagged?: boolean) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (flagged !== undefined) {
      params.push(flagged);
      conditions.push(`is_flagged = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows: countRows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM jobs ${where}`,
      params,
    );
    const total = parseInt(countRows[0].count, 10);
    const listParams = [...params, limit, offsetFor(page, limit)];
    const { rows } = await this.db.query(
      `SELECT * FROM jobs ${where} ORDER BY created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );
    return {
      items: rows.map((r) => ({ ...r, budget_min_ghs: r.budget_min_ghs === null ? null : Number(r.budget_min_ghs), budget_max_ghs: r.budget_max_ghs === null ? null : Number(r.budget_max_ghs) })),
      meta: { page, limit, total },
    };
  }

  async removeJob(jobId: string, adminId: string) {
    const { rows } = await this.db.query('SELECT id FROM jobs WHERE id = $1', [jobId]);
    if (!rows[0]) throw new NotFoundException('Job not found');
    await this.db.query(`UPDATE jobs SET status = 'cancelled' WHERE id = $1`, [jobId]);
    await this.db.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id) VALUES ($1, 'job_removed', 'job', $2)`,
      [adminId, jobId],
    );
    return { id: jobId, status: 'cancelled' };
  }

  async listTransactions(page = 1, limit = 20) {
    const { rows: countRows } = await this.db.query<{ count: string }>('SELECT COUNT(*) FROM transactions');
    const total = parseInt(countRows[0].count, 10);
    const { rows } = await this.db.query(
      `SELECT t.*, jsonb_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) AS user
       FROM transactions t JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offsetFor(page, limit)],
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        amount: Number(r.amount),
        currency: r.currency,
        commission_amount: r.commission_amount === null ? null : Number(r.commission_amount),
        created_at: r.created_at,
        user: r.user,
      })),
      meta: { page, limit, total },
    };
  }

  async commissionSummary() {
    const { rows } = await this.db.query<{ total: string | null; sample_size: string }>(
      `SELECT SUM(commission_amount) AS total, COUNT(*) AS sample_size
       FROM transactions WHERE commission_amount IS NOT NULL`,
    );
    return {
      total_commission_ghs: Number(rows[0].total ?? 0),
      sample_size: parseInt(rows[0].sample_size, 10),
    };
  }

  async auditLog(page = 1, limit = 20) {
    const { rows: countRows } = await this.db.query<{ count: string }>('SELECT COUNT(*) FROM admin_audit_log');
    const total = parseInt(countRows[0].count, 10);
    const { rows } = await this.db.query(
      `SELECT a.*, jsonb_build_object('id', u.id, 'full_name', u.full_name) AS admin
       FROM admin_audit_log a JOIN users u ON u.id = a.admin_id
       ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offsetFor(page, limit)],
    );
    return { items: rows, meta: { page, limit, total } };
  }

  async listDisputes(page = 1, limit = 20) {
    const { rows: countRows } = await this.db.query<{ count: string }>('SELECT COUNT(*) FROM disputes');
    const total = parseInt(countRows[0].count, 10);
    const { rows } = await this.db.query(
      `SELECT d.*, jsonb_build_object('id', c.id, 'title', c.title) AS contract
       FROM disputes d JOIN contracts c ON c.id = d.contract_id
       ORDER BY d.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offsetFor(page, limit)],
    );
    return { items: rows, meta: { page, limit, total } };
  }

  async resolveDispute(disputeId: string, adminId: string, dto: ResolveDisputeDto) {
    const { rows } = await this.db.query('SELECT id FROM disputes WHERE id = $1', [disputeId]);
    if (!rows[0]) throw new NotFoundException('Dispute not found');
    if (!['open', 'under_review', 'escalated'].includes(rows[0].status)) {
      throw new BadRequestException('Dispute already resolved');
    }
    await this.db.query(
      `UPDATE disputes SET status = $2, resolution_note = $3, resolved_by = $4, resolved_at = NOW() WHERE id = $1`,
      [disputeId, dto.outcome, dto.resolution_note, adminId],
    );
    await this.db.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, 'dispute_resolved', 'dispute', $2, $3)`,
      [adminId, disputeId, JSON.stringify({ outcome: dto.outcome })],
    );
    return { id: disputeId, status: dto.outcome };
  }
}
