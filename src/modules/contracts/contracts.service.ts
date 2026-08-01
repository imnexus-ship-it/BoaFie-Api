import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { offsetFor } from '../../common/dto/pagination.dto';

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
  constructor(private readonly db: DatabaseService) {}

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

    await this.db.query(`UPDATE contracts SET status = 'completed' WHERE id = $1`, [id]);
    await this.db.query(`UPDATE jobs SET status = 'completed' WHERE id = $1`, [contract.job_id]);
    await this.db.query('UPDATE artisan_profiles SET total_jobs_done = total_jobs_done + 1 WHERE user_id = $1', [
      contract.worker_id,
    ]);
    await this.db.query('UPDATE freelancer_profiles SET total_jobs_done = total_jobs_done + 1 WHERE user_id = $1', [
      contract.worker_id,
    ]);

    return this.findById(id, clientId);
  }
}
