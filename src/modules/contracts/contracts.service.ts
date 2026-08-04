import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { offsetFor } from '../../common/dto/pagination.dto';
import { CommissionService } from './commission.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DisputesService } from '../disputes/disputes.service';

const DETAIL_JOIN = `
  SELECT contracts.*,
    jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url) AS client,
    jsonb_build_object('id', w.id, 'full_name', w.full_name, 'avatar_url', w.avatar_url) AS worker,
    jsonb_build_object('id', j.id, 'title', j.title) AS job
  FROM contracts
  JOIN users c ON c.id = contracts.client_id
  JOIN users w ON w.id = contracts.worker_id
  JOIN jobs j ON j.id = contracts.job_id
`;

function toContractDto(row: any) {
  return {
    id: row.id,
    job_id: row.job_id,
    client_id: row.client_id,
    worker_id: row.worker_id,
    title: row.title,
    agreed_amount: Number(row.agreed_amount),
    currency: row.currency,
    status: row.status,
    created_at: row.created_at,
    client: row.client,
    worker: row.worker,
    job: row.job,
  };
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly commission: CommissionService,
    private readonly notifications: NotificationsService,
    private readonly disputes: DisputesService,
  ) {}

  async list(userId: string, page = 1, limit = 20) {
    const { rows: countRows } = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) FROM contracts WHERE client_id = $1 OR worker_id = $1',
      [userId],
    );
    const total = parseInt(countRows[0].count, 10);
    const { rows } = await this.db.query(
      `${DETAIL_JOIN} WHERE contracts.client_id = $1 OR contracts.worker_id = $1
       ORDER BY contracts.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offsetFor(page, limit)],
    );
    return { items: rows.map(toContractDto), meta: { page, limit, total } };
  }

  async findById(id: string, userId: string) {
    const { rows } = await this.db.query(`${DETAIL_JOIN} WHERE contracts.id = $1`, [id]);
    const row = rows[0];
    if (!row) throw new NotFoundException('Contract not found');
    if (row.client_id !== userId && row.worker_id !== userId) {
      throw new ForbiddenException('Not a participant on this contract');
    }

    const { rows: escrowRows } = await this.db.query(
      'SELECT total_amount, held_amount, released_amount, refunded_amount, status FROM escrow_accounts WHERE contract_id = $1',
      [id],
    );
    const escrow = escrowRows[0]
      ? {
          total_amount: Number(escrowRows[0].total_amount),
          held_amount: Number(escrowRows[0].held_amount),
          released_amount: Number(escrowRows[0].released_amount),
          refunded_amount: Number(escrowRows[0].refunded_amount),
          status: escrowRows[0].status,
        }
      : null;

    return { ...toContractDto(row), escrow };
  }

  async complete(id: string, clientId: string) {
    const { rows } = await this.db.query('SELECT * FROM contracts WHERE id = $1', [id]);
    const contract = rows[0];
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.client_id !== clientId) throw new ForbiddenException('Only the client can complete a contract');
    await this.disputes.assertNoActiveDispute(id);

    await this.db.query(`UPDATE contracts SET status = 'completed' WHERE id = $1`, [id]);
    await this.db.query(`UPDATE jobs SET status = 'completed' WHERE id = $1`, [contract.job_id]);
    await this.db.query('UPDATE artisan_profiles SET total_jobs_done = total_jobs_done + 1 WHERE user_id = $1', [
      contract.worker_id,
    ]);
    await this.db.query('UPDATE freelancer_profiles SET total_jobs_done = total_jobs_done + 1 WHERE user_id = $1', [
      contract.worker_id,
    ]);

    await this.releaseEscrowForMilestonelessContract(id, contract, clientId);

    return this.findById(id, clientId);
  }

  /**
   * Milestones are optional — a contract can be completed with zero
   * milestones ever created. Before this fix, MilestonesService.approve
   * was the ONLY place escrow money ever moved, so a lump-sum contract's
   * held funds had no path to the worker at all. Scoped deliberately
   * narrow: only auto-releases when there are NO milestones, so a
   * contract that used milestones for partial payment still requires
   * each one to go through explicit client approval — completing the
   * contract never bypasses that review.
   */
  private async releaseEscrowForMilestonelessContract(contractId: string, contract: any, releasedBy: string) {
    const { rows: milestoneRows } = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) FROM milestones WHERE contract_id = $1',
      [contractId],
    );
    if (parseInt(milestoneRows[0].count, 10) > 0) return;

    await this.db.withTransaction(async (client) => {
      const { rows: escrowRows } = await client.query(
        'SELECT * FROM escrow_accounts WHERE contract_id = $1 FOR UPDATE',
        [contractId],
      );
      const escrow = escrowRows[0];
      const heldAmount = escrow ? Number(escrow.held_amount) : 0;
      if (!escrow || heldAmount <= 0) return;

      const breakdown = await this.commission.calculate(contract.worker_id, heldAmount);

      await client.query(
        `UPDATE escrow_accounts SET held_amount = 0, released_amount = released_amount + $2, status = 'released' WHERE id = $1`,
        [escrow.id, heldAmount],
      );
      await client.query(
        `INSERT INTO escrow_releases (escrow_id, amount, released_by, note) VALUES ($1, $2, $3, $4)`,
        [escrow.id, heldAmount, releasedBy, 'Released on contract completion (no milestones set up)'],
      );

      const { rows: walletRows } = await client.query('SELECT id FROM wallets WHERE user_id = $1', [
        contract.worker_id,
      ]);
      if (walletRows[0]) {
        await client.query(
          `INSERT INTO transactions
             (user_id, wallet_id, type, status, amount, currency, contract_id, escrow_id,
              commission_rate, commission_amount, net_amount, description)
           VALUES ($1, $2, 'escrow_release', 'completed', $3, 'GHS', $4, $5, $6, $7, $8, $9)`,
          [
            contract.worker_id,
            walletRows[0].id,
            heldAmount,
            contractId,
            escrow.id,
            breakdown.commissionRate,
            breakdown.commissionAmount,
            breakdown.netAmount,
            `Full payment released: ${contract.title}`,
          ],
        );
        await client.query(
          `UPDATE wallets SET balance_ghs = balance_ghs + $2, lifetime_earned = lifetime_earned + $2,
             last_escrow_credit_at = NOW() WHERE user_id = $1`,
          [contract.worker_id, breakdown.netAmount],
        );
      }

      await this.notifications.notify(
        contract.worker_id,
        'payment',
        'Payment released',
        `"${contract.title}" was marked complete. GHS ${breakdown.netAmount.toFixed(2)} was credited to your wallet after commission.`,
        { contract_id: contractId, net_amount: breakdown.netAmount },
      );
    });
  }
}
