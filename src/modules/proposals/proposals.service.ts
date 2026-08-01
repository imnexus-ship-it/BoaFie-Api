import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProposalsRepository } from './proposals.repository';
import { JobsRepository } from '../jobs/jobs.repository';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { ProposalRow, toProposalDto } from './proposal.entity';

const JOB_WORKER_JOIN = `
  SELECT proposals.*,
    jsonb_build_object('id', j.id, 'title', j.title, 'status', j.status,
      'budget_min_ghs', j.budget_min_ghs, 'budget_max_ghs', j.budget_max_ghs) AS job,
    jsonb_build_object('id', w.id, 'full_name', w.full_name, 'avatar_url', w.avatar_url, 'role', w.role) AS worker
  FROM proposals
  JOIN jobs j ON j.id = proposals.job_id
  JOIN users w ON w.id = proposals.worker_id
`;

@Injectable()
export class ProposalsService {
  constructor(
    private readonly proposals: ProposalsRepository,
    private readonly jobs: JobsRepository,
    private readonly db: DatabaseService,
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationsService,
  ) {}

  private rowToDto(row: ProposalRow & { job: unknown; worker: unknown }) {
    return toProposalDto(row, row.job, row.worker);
  }

  async listMine(workerId: string) {
    const { rows } = await this.db.query<ProposalRow & { job: unknown; worker: unknown }>(
      `${JOB_WORKER_JOIN} WHERE proposals.worker_id = $1 ORDER BY proposals.created_at DESC`,
      [workerId],
    );
    return rows.map((r) => this.rowToDto(r));
  }

  async listForJob(jobId: string, requesterId: string) {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if (job.client_id !== requesterId) {
      throw new ForbiddenException('Only the job owner can view its proposals');
    }
    const { rows } = await this.db.query<ProposalRow & { job: unknown; worker: unknown }>(
      `${JOB_WORKER_JOIN} WHERE proposals.job_id = $1 ORDER BY proposals.created_at DESC`,
      [jobId],
    );
    return rows.map((r) => this.rowToDto(r));
  }

  async create(jobId: string, workerId: string, dto: CreateProposalDto) {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== 'open') throw new BadRequestException('This job is no longer accepting proposals');

    const existing = await this.proposals.findOne({ job_id: jobId, worker_id: workerId });
    if (existing) throw new ConflictException('You already submitted a proposal for this job');

    const proposal = await this.proposals.insert({
      job_id: jobId,
      worker_id: workerId,
      cover_letter: dto.cover_letter,
      proposed_rate: dto.proposed_rate,
      rate_type: dto.rate_type ?? 'fixed',
      estimated_days: dto.estimated_days ?? null,
    });
    await this.jobs.incrementProposalCount(jobId);
    await this.notifications.notify(
      job.client_id,
      'proposal',
      'New proposal received',
      `You have a new proposal on "${job.title}"`,
      { job_id: jobId, proposal_id: proposal.id },
    );

    const { rows } = await this.db.query<ProposalRow & { job: unknown; worker: unknown }>(
      `${JOB_WORKER_JOIN} WHERE proposals.id = $1`,
      [proposal.id],
    );
    return this.rowToDto(rows[0]);
  }

  async reject(proposalId: string, clientId: string) {
    const proposal = await this.proposals.findById(proposalId);
    if (!proposal) throw new NotFoundException('Proposal not found');
    const job = await this.jobs.findById(proposal.job_id);
    if (!job || job.client_id !== clientId) throw new ForbiddenException('Not your job posting');
    if (proposal.status !== 'pending') throw new BadRequestException('Proposal already processed');

    await this.proposals.updateById(proposalId, { status: 'rejected' });
    await this.notifications.notify(
      proposal.worker_id,
      'proposal',
      'Proposal declined',
      `Your proposal for "${job.title}" was declined.`,
      { job_id: job.id, proposal_id: proposalId },
    );
    const { rows } = await this.db.query<ProposalRow & { job: unknown; worker: unknown }>(
      `${JOB_WORKER_JOIN} WHERE proposals.id = $1`,
      [proposalId],
    );
    return this.rowToDto(rows[0]);
  }

  /**
   * Accepting a proposal auto-creates the contract and its escrow account
   * (per the docs' flow). Since live payment gateways are stubbed in this
   * build and boafie-web has no "fund escrow" UI yet, the escrow is
   * marked funded immediately at creation — real funding would instead
   * wait for a payment webhook before crediting held_amount.
   */
  async accept(proposalId: string, clientId: string) {
    const proposal = await this.proposals.findById(proposalId);
    if (!proposal) throw new NotFoundException('Proposal not found');
    const job = await this.jobs.findById(proposal.job_id);
    if (!job) throw new NotFoundException('Job not found');
    if (job.client_id !== clientId) throw new ForbiddenException('Not your job posting');
    if (proposal.status !== 'pending') throw new BadRequestException('Proposal already processed');

    const contract = await this.db.withTransaction(async (client) => {
      await client.query(`UPDATE proposals SET status = 'accepted' WHERE id = $1`, [proposalId]);
      await client.query(
        `UPDATE proposals SET status = 'rejected' WHERE job_id = $1 AND id != $2 AND status = 'pending'`,
        [proposal.job_id, proposalId],
      );
      await client.query(
        `UPDATE jobs SET status = 'in_progress', hired_worker_id = $1 WHERE id = $2`,
        [proposal.worker_id, proposal.job_id],
      );

      const { rows: contractRows } = await client.query(
        `INSERT INTO contracts (job_id, client_id, worker_id, proposal_id, title, agreed_amount, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'in_progress') RETURNING *`,
        [proposal.job_id, clientId, proposal.worker_id, proposalId, job.title, proposal.proposed_rate, job.currency ?? 'GHS'],
      );
      const newContract = contractRows[0];

      const { rows: escrowRows } = await client.query(
        `INSERT INTO escrow_accounts (contract_id, client_id, worker_id, total_amount, held_amount, currency, status)
         VALUES ($1, $2, $3, $4, $4, $5, 'held') RETURNING *`,
        [newContract.id, clientId, proposal.worker_id, proposal.proposed_rate, job.currency ?? 'GHS'],
      );
      const escrow = escrowRows[0];

      const { rows: walletRows } = await client.query(
        'SELECT id FROM wallets WHERE user_id = $1',
        [clientId],
      );
      if (walletRows[0]) {
        await client.query(
          `INSERT INTO transactions (user_id, wallet_id, type, status, amount, currency, contract_id, escrow_id, description)
           VALUES ($1, $2, 'escrow_hold', 'completed', $3, $4, $5, $6, $7)`,
          [
            clientId,
            walletRows[0].id,
            proposal.proposed_rate,
            job.currency ?? 'GHS',
            newContract.id,
            escrow.id,
            `Escrow funded for "${job.title}"`,
          ],
        );
      }

      return newContract;
    });

    await this.messaging.createForContract(clientId, proposal.worker_id, proposal.job_id, contract.id);
    await this.notifications.notify(
      proposal.worker_id,
      'proposal',
      'Proposal accepted',
      `Your proposal for "${job.title}" was accepted — a contract has been created.`,
      { job_id: job.id, proposal_id: proposalId, contract_id: contract.id },
    );

    return {
      proposal_id: proposalId,
      contract: { ...contract, agreed_amount: Number(contract.agreed_amount) },
    };
  }
}
