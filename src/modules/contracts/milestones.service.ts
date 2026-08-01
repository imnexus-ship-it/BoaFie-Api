import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CommissionService } from './commission.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

function toMilestoneDto(row: any) {
  return {
    id: row.id,
    contract_id: row.contract_id,
    title: row.title,
    description: row.description,
    amount_ghs: Number(row.amount_ghs),
    due_date: row.due_date,
    status: row.status,
    submission_note: row.submission_note,
    submission_media: row.submission_media,
    sort_order: row.sort_order,
  };
}

@Injectable()
export class MilestonesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly commission: CommissionService,
  ) {}

  private async getContractForMilestone(milestoneId: string) {
    const { rows } = await this.db.query(
      `SELECT m.*, c.client_id, c.worker_id, c.id AS contract_id_check
       FROM milestones m JOIN contracts c ON c.id = m.contract_id
       WHERE m.id = $1`,
      [milestoneId],
    );
    return rows[0] as any;
  }

  async listForContract(contractId: string, userId: string) {
    const { rows: contractRows } = await this.db.query('SELECT client_id, worker_id FROM contracts WHERE id = $1', [
      contractId,
    ]);
    const contract = contractRows[0];
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.client_id !== userId && contract.worker_id !== userId) {
      throw new ForbiddenException('Not a participant on this contract');
    }
    const { rows } = await this.db.query(
      'SELECT * FROM milestones WHERE contract_id = $1 ORDER BY sort_order, created_at',
      [contractId],
    );
    return rows.map(toMilestoneDto);
  }

  async create(contractId: string, clientId: string, dto: CreateMilestoneDto) {
    const { rows: contractRows } = await this.db.query('SELECT client_id FROM contracts WHERE id = $1', [
      contractId,
    ]);
    const contract = contractRows[0];
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.client_id !== clientId) throw new ForbiddenException('Only the client can add milestones');

    const { rows } = await this.db.query(
      `INSERT INTO milestones (contract_id, title, description, amount_ghs, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [contractId, dto.title, dto.description ?? null, dto.amount_ghs, dto.due_date ?? null],
    );
    return toMilestoneDto(rows[0]);
  }

  async start(milestoneId: string, workerId: string) {
    const m = await this.getContractForMilestone(milestoneId);
    if (!m) throw new NotFoundException('Milestone not found');
    if (m.worker_id !== workerId) throw new ForbiddenException('Not your contract');
    if (m.status !== 'pending') throw new BadRequestException('Milestone is not pending');

    const { rows } = await this.db.query(
      `UPDATE milestones SET status = 'in_progress' WHERE id = $1 RETURNING *`,
      [milestoneId],
    );
    return toMilestoneDto(rows[0]);
  }

  async submit(milestoneId: string, workerId: string, note: string) {
    const m = await this.getContractForMilestone(milestoneId);
    if (!m) throw new NotFoundException('Milestone not found');
    if (m.worker_id !== workerId) throw new ForbiddenException('Not your contract');
    if (m.status !== 'in_progress') throw new BadRequestException('Milestone must be started before submitting');

    const { rows } = await this.db.query(
      `UPDATE milestones SET status = 'submitted', submission_note = $2 WHERE id = $1 RETURNING *`,
      [milestoneId, note],
    );
    return toMilestoneDto(rows[0]);
  }

  /**
   * The frontend's endpoint is named `/reject`, but per boafie-web's own
   * README the UX is "Request changes (with feedback)" — the worker must
   * be able to act again, so this returns the milestone to `in_progress`
   * (which is what makes the "Submit milestone" action reappear
   * client-side) rather than a dead-end `rejected` state.
   */
  async reject(milestoneId: string, clientId: string, feedback: string) {
    const m = await this.getContractForMilestone(milestoneId);
    if (!m) throw new NotFoundException('Milestone not found');
    if (m.client_id !== clientId) throw new ForbiddenException('Not your contract');
    if (m.status !== 'submitted') throw new BadRequestException('Milestone is not awaiting review');

    const { rows } = await this.db.query(
      `UPDATE milestones SET status = 'in_progress', submission_note = $2 WHERE id = $1 RETURNING *`,
      [milestoneId, `Changes requested: ${feedback}`],
    );
    return toMilestoneDto(rows[0]);
  }

  /**
   * The core interactive piece: approving a milestone releases its amount
   * from escrow, deducts commission per the worker's plan, and credits
   * the worker's wallet — all in one transaction.
   */
  async approve(milestoneId: string, clientId: string) {
    const m = await this.getContractForMilestone(milestoneId);
    if (!m) throw new NotFoundException('Milestone not found');
    if (m.client_id !== clientId) throw new ForbiddenException('Not your contract');
    if (m.status !== 'submitted') throw new BadRequestException('Milestone is not awaiting review');

    const { commissionRate, commissionAmount, netAmount } = await this.commission.calculate(
      m.worker_id,
      Number(m.amount_ghs),
    );

    const updated = await this.db.withTransaction(async (client) => {
      const { rows: milestoneRows } = await client.query(
        `UPDATE milestones SET status = 'approved', approved_at = NOW(), approved_by = $2 WHERE id = $1 RETURNING *`,
        [milestoneId, clientId],
      );

      const { rows: escrowRows } = await client.query(
        'SELECT * FROM escrow_accounts WHERE contract_id = $1',
        [m.contract_id],
      );
      const escrow = escrowRows[0];
      const newHeld = Math.max(0, Number(escrow.held_amount) - Number(m.amount_ghs));
      const newReleased = Number(escrow.released_amount) + Number(m.amount_ghs);
      await client.query(
        `UPDATE escrow_accounts SET held_amount = $2, released_amount = $3, status = $4 WHERE id = $1`,
        [escrow.id, newHeld, newReleased, newHeld <= 0 ? 'released' : 'held'],
      );

      await client.query(
        `INSERT INTO escrow_releases (escrow_id, milestone_id, amount, released_by)
         VALUES ($1, $2, $3, $4)`,
        [escrow.id, milestoneId, m.amount_ghs, clientId],
      );

      const { rows: walletRows } = await client.query('SELECT id FROM wallets WHERE user_id = $1', [
        m.worker_id,
      ]);
      const walletId = walletRows[0].id;

      await client.query(
        `INSERT INTO transactions
           (user_id, wallet_id, type, status, amount, currency, contract_id, escrow_id, milestone_id,
            commission_rate, commission_amount, net_amount, description)
         VALUES ($1, $2, 'escrow_release', 'completed', $3, 'GHS', $4, $5, $6, $7, $8, $9, $10)`,
        [
          m.worker_id,
          walletId,
          m.amount_ghs,
          m.contract_id,
          escrow.id,
          milestoneId,
          commissionRate,
          commissionAmount,
          netAmount,
          `Milestone released: ${m.title}`,
        ],
      );

      await client.query(
        `UPDATE wallets SET balance_ghs = balance_ghs + $2, lifetime_earned = lifetime_earned + $2,
           last_escrow_credit_at = NOW() WHERE user_id = $1`,
        [m.worker_id, netAmount],
      );

      return milestoneRows[0];
    });

    return toMilestoneDto(updated);
  }
}
