import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ACTIVE_DISPUTE_STATUSES, DisputeRow, toDisputeDto } from './dispute.entity';

@Injectable()
export class DisputesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(contractId: string, raisedById: string, dto: CreateDisputeDto) {
    const { rows } = await this.db.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
    const contract = rows[0];
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.client_id !== raisedById && contract.worker_id !== raisedById) {
      throw new ForbiddenException('Not a participant on this contract');
    }

    const { rows: activeRows } = await this.db.query(
      'SELECT 1 FROM disputes WHERE contract_id = $1 AND status = ANY($2)',
      [contractId, ACTIVE_DISPUTE_STATUSES],
    );
    if (activeRows[0]) throw new ConflictException('This contract already has an open dispute');

    const againstUser = raisedById === contract.client_id ? contract.worker_id : contract.client_id;

    const { rows: inserted } = await this.db.query<DisputeRow>(
      `INSERT INTO disputes (contract_id, raised_by, against_user, reason, description, evidence_urls)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [contractId, raisedById, againstUser, dto.reason, dto.description, dto.evidence_urls ?? []],
    );

    // Only flip escrow into the 'disputed' state while it's still actually
    // held — a dispute raised after funds already released/refunded
    // shouldn't overwrite that terminal state (admins can still see and
    // resolve the dispute itself either way).
    await this.db.query(
      `UPDATE escrow_accounts SET status = 'disputed' WHERE contract_id = $1 AND status = 'held'`,
      [contractId],
    );

    await this.notifications.notify(
      againstUser,
      'system',
      'A dispute was raised on your contract',
      `"${contract.title}": ${dto.reason}`,
      { contract_id: contractId, dispute_id: inserted[0].id },
    );

    return toDisputeDto(inserted[0]);
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

    const { rows } = await this.db.query<DisputeRow>(
      'SELECT * FROM disputes WHERE contract_id = $1 ORDER BY created_at DESC',
      [contractId],
    );
    return rows.map(toDisputeDto);
  }

  /** Used by MilestonesService/ContractsService to block actions while a dispute is unresolved. */
  async hasActiveDispute(contractId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      'SELECT 1 FROM disputes WHERE contract_id = $1 AND status = ANY($2)',
      [contractId, ACTIVE_DISPUTE_STATUSES],
    );
    return !!rows[0];
  }

  async assertNoActiveDispute(contractId: string) {
    if (await this.hasActiveDispute(contractId)) {
      throw new BadRequestException('This contract has an open dispute — action blocked until it is resolved.');
    }
  }
}
