import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { offsetFor } from '../../common/dto/pagination.dto';
import { toPublicUser } from '../users/user.entity';
import { CommissionService } from '../contracts/commission.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SuspendUserDto, ResolveDisputeDto } from './dto/admin-actions.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly commission: CommissionService,
    private readonly notifications: NotificationsService,
  ) {}

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

  async promoteToAdmin(userId: string, adminId: string) {
    const { rows } = await this.db.query<{ id: string; role: string }>('SELECT id, role FROM users WHERE id = $1', [
      userId,
    ]);
    if (!rows[0]) throw new NotFoundException('User not found');
    if (rows[0].role === 'admin') throw new BadRequestException('User is already an admin');

    await this.db.query('UPDATE users SET role = $2 WHERE id = $1', [userId, 'admin']);
    await this.db.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id) VALUES ($1, 'user_promoted_admin', 'user', $2)`,
      [adminId, userId],
    );
    return { id: userId, role: 'admin' };
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
      `SELECT d.*, jsonb_build_object('id', c.id, 'title', c.title) AS contract,
         jsonb_build_object('id', ru.id, 'full_name', ru.full_name) AS raised_by_user,
         jsonb_build_object('id', au.id, 'full_name', au.full_name) AS against_user_user
       FROM disputes d
       JOIN contracts c ON c.id = d.contract_id
       JOIN users ru ON ru.id = d.raised_by
       JOIN users au ON au.id = d.against_user
       ORDER BY d.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offsetFor(page, limit)],
    );
    return { items: rows, meta: { page, limit, total } };
  }

  /**
   * Releasing/refunding here moves the contract's remaining held escrow
   * for real — same accounting the milestone approval flow uses
   * (MilestonesService.approve). It's the same "money" the rest of the
   * app already treats as real the instant a contract is created (see
   * ProposalsService.accept), so this stays consistent with that even
   * though no actual payment gateway sits behind any of it yet.
   */
  private async settleDisputeEscrow(contractId: string, outcome: 'resolved_client' | 'resolved_worker', adminId: string) {
    return this.db.withTransaction(async (client) => {
      const { rows: escrowRows } = await client.query(
        'SELECT * FROM escrow_accounts WHERE contract_id = $1 FOR UPDATE',
        [contractId],
      );
      const escrow = escrowRows[0];
      const heldAmount = escrow ? Number(escrow.held_amount) : 0;
      if (!escrow || heldAmount <= 0) return null;

      const { rows: contractRows } = await client.query(
        'SELECT client_id, worker_id FROM contracts WHERE id = $1',
        [contractId],
      );
      const contract = contractRows[0];

      if (outcome === 'resolved_worker') {
        const { commissionRate, commissionAmount, netAmount } = await this.commission.calculate(
          contract.worker_id,
          heldAmount,
        );
        await client.query(
          `UPDATE escrow_accounts SET held_amount = 0, released_amount = released_amount + $2, status = 'released' WHERE id = $1`,
          [escrow.id, heldAmount],
        );
        await client.query(
          `INSERT INTO escrow_releases (escrow_id, amount, released_by, note) VALUES ($1, $2, $3, $4)`,
          [escrow.id, heldAmount, adminId, 'Released via dispute resolution'],
        );
        const { rows: walletRows } = await client.query('SELECT id FROM wallets WHERE user_id = $1', [
          contract.worker_id,
        ]);
        await client.query(
          `INSERT INTO transactions
             (user_id, wallet_id, type, status, amount, currency, contract_id, escrow_id, commission_rate, commission_amount, net_amount, description)
           VALUES ($1, $2, 'escrow_release', 'completed', $3, 'GHS', $4, $5, $6, $7, $8, $9)`,
          [
            contract.worker_id,
            walletRows[0].id,
            heldAmount,
            contractId,
            escrow.id,
            commissionRate,
            commissionAmount,
            netAmount,
            'Dispute resolved in your favor',
          ],
        );
        await client.query(
          `UPDATE wallets SET balance_ghs = balance_ghs + $2, lifetime_earned = lifetime_earned + $2,
             last_escrow_credit_at = NOW() WHERE user_id = $1`,
          [contract.worker_id, netAmount],
        );
        return { released_to: contract.worker_id, amount: netAmount };
      }

      // resolved_client: refund the remaining held amount, no commission deducted.
      await client.query(
        `UPDATE escrow_accounts SET held_amount = 0, refunded_amount = refunded_amount + $2, status = 'refunded' WHERE id = $1`,
        [escrow.id, heldAmount],
      );
      const { rows: walletRows } = await client.query('SELECT id FROM wallets WHERE user_id = $1', [
        contract.client_id,
      ]);
      await client.query(
        `INSERT INTO transactions (user_id, wallet_id, type, status, amount, currency, contract_id, escrow_id, description)
         VALUES ($1, $2, 'refund', 'completed', $3, 'GHS', $4, $5, $6)`,
        [contract.client_id, walletRows[0].id, heldAmount, contractId, escrow.id, 'Dispute resolved in your favor — escrow refunded'],
      );
      await client.query(`UPDATE wallets SET balance_ghs = balance_ghs + $2 WHERE user_id = $1`, [
        contract.client_id,
        heldAmount,
      ]);
      return { released_to: contract.client_id, amount: heldAmount };
    });
  }

  async resolveDispute(disputeId: string, adminId: string, dto: ResolveDisputeDto) {
    const { rows } = await this.db.query('SELECT * FROM disputes WHERE id = $1', [disputeId]);
    const dispute = rows[0];
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (!['open', 'under_review', 'escalated'].includes(dispute.status)) {
      throw new BadRequestException('Dispute already resolved');
    }

    const escrowOutcome =
      dto.outcome === 'resolved_client' || dto.outcome === 'resolved_worker'
        ? await this.settleDisputeEscrow(dispute.contract_id, dto.outcome, adminId)
        : null;

    await this.db.query(
      `UPDATE disputes SET status = $2, resolution_note = $3, resolved_by = $4, resolved_at = NOW() WHERE id = $1`,
      [disputeId, dto.outcome, dto.resolution_note, adminId],
    );
    await this.db.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, 'dispute_resolved', 'dispute', $2, $3)`,
      [adminId, disputeId, JSON.stringify({ outcome: dto.outcome, escrow: escrowOutcome })],
    );

    if (escrowOutcome) {
      await this.notifications.notify(
        escrowOutcome.released_to,
        'payment',
        dto.outcome === 'resolved_worker' ? 'Dispute resolved — funds released' : 'Dispute resolved — escrow refunded',
        `GHS ${escrowOutcome.amount.toFixed(2)} was credited to your wallet. ${dto.resolution_note}`,
        { dispute_id: disputeId, amount: escrowOutcome.amount },
      );
    }

    return { id: disputeId, status: dto.outcome, escrow: escrowOutcome };
  }
}
